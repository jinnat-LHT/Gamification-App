-- Automatic Batch lifecycle: preparation makes a Batch READY; learner activity makes it ACTIVE.
create or replace function public.refresh_batch_lifecycle(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.batch_status;
  v_ready boolean;
  v_active boolean;
begin
  select status into v_status from public.batches where id = p_batch_id and deleted_at is null;
  if v_status is null or v_status in ('COMPLETED', 'ARCHIVED') then return; end if;

  select
    exists(select 1 from public.groups where batch_id=p_batch_id and deleted_at is null and status='ACTIVE')
    and exists(select 1 from public.batch_learners where batch_id=p_batch_id and enrollment_status in ('INVITED','ACTIVE'))
    and exists(select 1 from public.batch_activity_configs where batch_id=p_batch_id and enabled=true)
  into v_ready;

  if v_status='DRAFT' and v_ready then
    update public.batches set status='READY',updated_at=now() where id=p_batch_id;
    v_status:='READY';
  end if;

  select
    exists(select 1 from public.submissions where batch_id=p_batch_id)
    or exists(
      select 1 from public.attendance_records ar
      join public.attendance_sessions s on s.id=ar.session_id
      where s.batch_id=p_batch_id
    )
  into v_active;

  if v_status='READY' and v_active then
    update public.batches set status='ACTIVE',started_at=coalesce(started_at,now()),updated_at=now() where id=p_batch_id;
  end if;
end;
$$;

create or replace function public.refresh_batch_lifecycle_from_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'DELETE' then
    perform public.refresh_batch_lifecycle(old.batch_id);
    return old;
  end if;
  perform public.refresh_batch_lifecycle(new.batch_id);
  return new;
end;
$$;

create or replace function public.refresh_batch_lifecycle_from_attendance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_batch_id uuid;
begin
  select s.batch_id into v_batch_id
  from public.attendance_sessions s
  where s.id = case when TG_OP = 'DELETE' then old.session_id else new.session_id end;
  if v_batch_id is not null then perform public.refresh_batch_lifecycle(v_batch_id); end if;
  if TG_OP = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists batch_lifecycle_groups on public.groups;
create trigger batch_lifecycle_groups after insert or update or delete on public.groups
for each row execute function public.refresh_batch_lifecycle_from_row();

drop trigger if exists batch_lifecycle_learners on public.batch_learners;
create trigger batch_lifecycle_learners after insert or update or delete on public.batch_learners
for each row execute function public.refresh_batch_lifecycle_from_row();

drop trigger if exists batch_lifecycle_activities on public.batch_activity_configs;
create trigger batch_lifecycle_activities after insert or update or delete on public.batch_activity_configs
for each row execute function public.refresh_batch_lifecycle_from_row();

drop trigger if exists batch_lifecycle_submissions on public.submissions;
create trigger batch_lifecycle_submissions after insert or update or delete on public.submissions
for each row execute function public.refresh_batch_lifecycle_from_row();

drop trigger if exists batch_lifecycle_attendance on public.attendance_records;
create trigger batch_lifecycle_attendance after insert or update or delete on public.attendance_records
for each row execute function public.refresh_batch_lifecycle_from_attendance();

do $$
declare r record;
begin
  for r in select id from public.batches where deleted_at is null loop
    perform public.refresh_batch_lifecycle(r.id);
  end loop;
end $$;