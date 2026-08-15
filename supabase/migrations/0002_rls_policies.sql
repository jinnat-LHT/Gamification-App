-- Leadership Quest RLS and scope helpers
-- Supabase PostgreSQL / Migration 0002
-- Trusted mutations (XP, imports, audit, file authorization) should use server-side functions/service role.

create or replace function public.current_user_account_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.user_accounts
  where id = auth.uid()
    and status in ('INVITED', 'ACTIVE');
$$;

create or replace function public.is_provider_admin(p_provider_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.role_assignments ra
    join public.user_accounts ua on ua.id = ra.user_id
    where ra.user_id = auth.uid()
      and ra.role = 'ADMIN'
      and ra.scope_type = 'PROVIDER'
      and ra.provider_organization_id = p_provider_id
      and ra.revoked_at is null
      and ua.status in ('INVITED', 'ACTIVE')
  );
$$;

create or replace function public.has_client_scope(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.client_organizations co
    join public.role_assignments ra
      on ra.user_id = auth.uid()
     and ra.revoked_at is null
     and (
       (ra.scope_type = 'CLIENT_ORGANIZATION' and ra.client_organization_id = co.id)
       or (ra.scope_type = 'PROVIDER' and ra.provider_organization_id = co.provider_organization_id and ra.role = 'ADMIN')
     )
    join public.user_accounts ua on ua.id = ra.user_id
    where co.id = p_client_id
      and ua.status in ('INVITED', 'ACTIVE')
      and (
        ra.role = 'ADMIN'
        or ra.role = 'FACILITATOR'
      )
  );
$;

create or replace function public.has_program_scope(p_program_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.programs p
    join public.client_organizations co on co.id = p.client_organization_id
    join public.role_assignments ra
      on ra.user_id = auth.uid()
     and ra.revoked_at is null
     and (
       (ra.scope_type = 'PROGRAM' and ra.program_id = p.id)
       or (ra.scope_type = 'CLIENT_ORGANIZATION' and ra.client_organization_id = co.id)
       or (ra.scope_type = 'PROVIDER' and ra.provider_organization_id = co.provider_organization_id and ra.role = 'ADMIN')
     )
    join public.user_accounts ua on ua.id = ra.user_id
    where p.id = p_program_id
      and ua.status in ('INVITED', 'ACTIVE')
      and ra.role in ('ADMIN', 'FACILITATOR')
  );
$$;

create or replace function public.has_batch_scope(p_batch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.batches b
    join public.programs p on p.id = b.program_id
    join public.client_organizations co on co.id = p.client_organization_id
    join public.role_assignments ra
      on ra.user_id = auth.uid()
     and ra.revoked_at is null
     and (
       (ra.scope_type = 'BATCH' and ra.batch_id = b.id)
       or (ra.scope_type = 'PROGRAM' and ra.program_id = p.id)
       or (ra.scope_type = 'CLIENT_ORGANIZATION' and ra.client_organization_id = co.id)
       or (ra.scope_type = 'PROVIDER' and ra.provider_organization_id = co.provider_organization_id and ra.role = 'ADMIN')
     )
    join public.user_accounts ua on ua.id = ra.user_id
    where b.id = p_batch_id
      and ua.status in ('INVITED', 'ACTIVE')
      and ra.role in ('ADMIN', 'FACILITATOR')
  );
$$;

create or replace function public.is_batch_learner(p_batch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.batch_learners bl
    where bl.batch_id = p_batch_id
      and bl.learner_id = auth.uid()
      and bl.enrollment_status in ('INVITED', 'ACTIVE', 'COMPLETED')
  );
$$;

-- Helper functions are intentionally not exposed as direct client RPC endpoints.
revoke all on function public.current_user_account_id() from public;
revoke all on function public.is_provider_admin(uuid) from public;
revoke all on function public.has_client_scope(uuid) from public;
revoke all on function public.has_program_scope(uuid) from public;
revoke all on function public.has_batch_scope(uuid) from public;
revoke all on function public.is_batch_learner(uuid) from public;

-- Identity and scope reads.
drop policy if exists user_accounts_select on public.user_accounts;
create policy user_accounts_select on public.user_accounts
for select to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.batch_learners bl
    where bl.learner_id = user_accounts.id
      and public.has_batch_scope(bl.batch_id)
  )
);

drop policy if exists learner_profiles_select on public.learner_profiles;
create policy learner_profiles_select on public.learner_profiles
for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.batch_learners bl
    where bl.learner_id = learner_profiles.user_id
      and public.has_batch_scope(bl.batch_id)
  )
);

drop policy if exists client_organizations_select on public.client_organizations;
create policy client_organizations_select on public.client_organizations
for select to authenticated
using (public.has_client_scope(id));

drop policy if exists programs_select on public.programs;
create policy programs_select on public.programs
for select to authenticated
using (public.has_program_scope(id));

drop policy if exists programs_admin_write on public.programs;
create policy programs_admin_write on public.programs
for all to authenticated
using (
  exists (
    select 1
    from public.role_assignments ra
    join public.client_organizations co on co.id = programs.client_organization_id
    where ra.user_id = auth.uid()
      and ra.role = 'ADMIN'
      and ra.revoked_at is null
      and (
        (ra.scope_type = 'CLIENT_ORGANIZATION' and ra.client_organization_id = co.id)
        or (ra.scope_type = 'PROVIDER' and ra.provider_organization_id = co.provider_organization_id)
      )
  )
)
with check (public.has_program_scope(client_organization_id));

drop policy if exists batches_select on public.batches;
create policy batches_select on public.batches
for select to authenticated
using (public.has_batch_scope(id) or public.is_batch_learner(id));

drop policy if exists batches_admin_write on public.batches;
create policy batches_admin_write on public.batches
for all to authenticated
using (
  public.has_program_scope(program_id)
  and exists (
    select 1 from public.role_assignments ra
    where ra.user_id = auth.uid()
      and ra.role = 'ADMIN'
      and ra.revoked_at is null
  )
)
with check (public.has_program_scope(program_id));

drop policy if exists groups_select on public.groups;
create policy groups_select on public.groups
for select to authenticated
using (public.has_batch_scope(batch_id) or public.is_batch_learner(batch_id));

drop policy if exists groups_admin_write on public.groups;
create policy groups_admin_write on public.groups
for all to authenticated
using (public.has_batch_scope(batch_id))
with check (public.has_batch_scope(batch_id));

drop policy if exists batch_learners_select on public.batch_learners;
create policy batch_learners_select on public.batch_learners
for select to authenticated
using (learner_id = auth.uid() or public.has_batch_scope(batch_id));

drop policy if exists batch_learners_admin_write on public.batch_learners;
create policy batch_learners_admin_write on public.batch_learners
for all to authenticated
using (
  public.has_batch_scope(batch_id)
  and exists (
    select 1 from public.role_assignments ra
    where ra.user_id = auth.uid()
      and ra.role = 'ADMIN'
      and ra.revoked_at is null
  )
)
with check (public.has_batch_scope(batch_id));

drop policy if exists activity_config_select on public.batch_activity_configs;
create policy activity_config_select on public.batch_activity_configs
for select to authenticated
using (public.has_batch_scope(batch_id) or public.is_batch_learner(batch_id));

drop policy if exists activity_config_admin_write on public.batch_activity_configs;
create policy activity_config_admin_write on public.batch_activity_configs
for all to authenticated
using (public.has_batch_scope(batch_id))
with check (public.has_batch_scope(batch_id));

drop policy if exists submissions_select on public.submissions;
create policy submissions_select on public.submissions
for select to authenticated
using (
  batch_learner_id in (select id from public.batch_learners where learner_id = auth.uid())
  or public.has_batch_scope(batch_id)
);

drop policy if exists submissions_learner_write on public.submissions;
create policy submissions_learner_write on public.submissions
for insert to authenticated
with check (
  batch_learner_id in (select id from public.batch_learners where learner_id = auth.uid())
  and not public.has_batch_scope(batch_id)
);

drop policy if exists submissions_attempts_select on public.submission_attempts;
create policy submissions_attempts_select on public.submission_attempts
for select to authenticated
using (
  exists (
    select 1 from public.submissions s
    where s.id = submission_attempts.submission_id
      and (
        s.batch_learner_id in (select id from public.batch_learners where learner_id = auth.uid())
        or public.has_batch_scope(s.batch_id)
      )
  )
);

drop policy if exists peer_reviews_select on public.peer_reviews;
create policy peer_reviews_select on public.peer_reviews
for select to authenticated
using (
  reviewer_batch_learner_id in (select id from public.batch_learners where learner_id = auth.uid())
  or public.has_batch_scope(batch_id)
);

drop policy if exists peer_reviews_learner_insert on public.peer_reviews;
create policy peer_reviews_learner_insert on public.peer_reviews
for insert to authenticated
with check (
  reviewer_batch_learner_id in (select id from public.batch_learners where learner_id = auth.uid())
  and reviewer_batch_learner_id <> reviewee_batch_learner_id
  and not public.has_batch_scope(batch_id)
);

drop policy if exists attendance_select on public.attendance_records;
create policy attendance_select on public.attendance_records
for select to authenticated
using (
  public.has_batch_scope((select batch_id from public.attendance_sessions where id = attendance_records.session_id))
  or exists (
    select 1 from public.batch_learners bl
    where bl.id = attendance_records.batch_learner_id and bl.learner_id = auth.uid()
  )
);

drop policy if exists xp_transactions_select on public.xp_transactions;
create policy xp_transactions_select on public.xp_transactions
for select to authenticated
using (
  public.has_batch_scope(batch_id)
  or batch_learner_id in (select id from public.batch_learners where learner_id = auth.uid())
);

drop policy if exists audit_events_admin_select on public.audit_events;
create policy audit_events_admin_select on public.audit_events
for select to authenticated
using (public.has_batch_scope(batch_id));

-- No direct client INSERT/UPDATE/DELETE policy is granted for XP, audit, imports,
-- file metadata, role assignments, or moderation. These writes go through the
-- trusted service layer and are checked again server-side.
