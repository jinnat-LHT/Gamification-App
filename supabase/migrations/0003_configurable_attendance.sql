-- Configurable attendance schedule per Batch (1-20 sessions).
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'attendance_sessions_session_number_check'
      and conrelid = 'public.attendance_sessions'::regclass
  ) then
    alter table public.attendance_sessions
      drop constraint attendance_sessions_session_number_check;
  end if;
end $$;

alter table public.attendance_sessions
  add constraint attendance_sessions_session_number_check
  check (session_number between 1 and 20);

alter table public.attendance_sessions
  add column if not exists title text;

create table if not exists public.batch_attendance_settings (
  batch_id uuid primary key references public.batches(id) on delete restrict,
  session_count smallint not null default 5 check (session_count between 1 and 20),
  session_labels_json jsonb not null default '{}'::jsonb,
  updated_by uuid references public.user_accounts(id) on delete restrict,
  updated_at timestamptz not null default now()
);

alter table public.batch_attendance_settings enable row level security;

create index if not exists attendance_sessions_batch_number_idx
  on public.attendance_sessions(batch_id, session_number);
