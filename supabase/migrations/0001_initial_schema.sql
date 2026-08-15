-- Leadership Quest initial logical schema
-- Supabase PostgreSQL / Migration 0001
-- No real learner data belongs in this migration.

create extension if not exists pgcrypto;

create type public.account_type as enum ('ADMIN', 'FACILITATOR', 'LEARNER');
create type public.account_status as enum ('INVITED', 'ACTIVE', 'SUSPENDED', 'DELETED');
create type public.role_scope_type as enum ('PROVIDER', 'CLIENT_ORGANIZATION', 'PROGRAM', 'BATCH');
create type public.lifecycle_status as enum ('DRAFT', 'ACTIVE', 'ARCHIVED');
create type public.batch_status as enum ('DRAFT', 'READY', 'ACTIVE', 'COMPLETED', 'ARCHIVED');
create type public.enrollment_status as enum ('INVITED', 'ACTIVE', 'COMPLETED', 'WITHDRAWN');
create type public.activity_type as enum ('PRE_TEST', 'POST_TEST', 'SELF_BEFORE', 'SELF_AFTER', 'PEER_REVIEW', 'ASSIGNMENT');
create type public.gate_state as enum ('OPEN', 'LOCKED');
create type public.submission_status as enum ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'PASSED', 'NEEDS_REVISION', 'REVIEWED', 'LATE');
create type public.pass_state as enum ('NOT_APPLICABLE', 'FAILED', 'PASSED');
create type public.scan_status as enum ('PENDING', 'CLEAN', 'REJECTED');
create type public.peer_review_status as enum ('SUBMITTED', 'HIDDEN');
create type public.xp_source_type as enum ('ATTENDANCE', 'RAPID_GROUP', 'PRE_TEST', 'POST_TEST', 'SELF_BEFORE', 'SELF_AFTER', 'PEER_REVIEW', 'ASSIGNMENT', 'LIVE_ADJUSTMENT');
create type public.import_type as enum ('LEARNER_ROSTER', 'QUIZ_BANK', 'BEHAVIOR_CRITERIA');
create type public.import_status as enum ('UPLOADED', 'VALIDATING', 'PREVIEW', 'CONFIRMED', 'COMMITTED', 'FAILED');

create table public.provider_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status public.lifecycle_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.client_organizations (
  id uuid primary key default gen_random_uuid(),
  provider_organization_id uuid not null references public.provider_organizations(id),
  name text not null,
  external_code text not null,
  status public.lifecycle_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (provider_organization_id, external_code)
);

create table public.user_accounts (
  id uuid primary key references auth.users(id) on delete restrict,
  email text not null,
  display_name text not null,
  account_type public.account_type not null,
  status public.account_status not null default 'INVITED',
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index user_accounts_email_normalized_idx on public.user_accounts (lower(email));

create table public.learner_profiles (
  user_id uuid primary key references public.user_accounts(id) on delete restrict,
  employee_code text,
  locale text not null default 'th',
  archetype_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_accounts(id) on delete restrict,
  role public.account_type not null,
  scope_type public.role_scope_type not null,
  provider_organization_id uuid references public.provider_organizations(id) on delete restrict,
  client_organization_id uuid references public.client_organizations(id) on delete restrict,
  program_id uuid,
  batch_id uuid,
  created_by uuid references public.user_accounts(id) on delete restrict,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (
    (scope_type = 'PROVIDER' and provider_organization_id is not null and client_organization_id is null and program_id is null and batch_id is null)
    or (scope_type = 'CLIENT_ORGANIZATION' and client_organization_id is not null and program_id is null and batch_id is null)
    or (scope_type = 'PROGRAM' and program_id is not null and batch_id is null)
    or (scope_type = 'BATCH' and batch_id is not null)
  )
);

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  client_organization_id uuid not null references public.client_organizations(id) on delete restrict,
  name text not null,
  description text,
  status public.lifecycle_status not null default 'DRAFT',
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.program_versions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  status public.lifecycle_status not null default 'DRAFT',
  published_at timestamptz,
  created_by uuid references public.user_accounts(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (program_id, version_number)
);

alter table public.programs
  add constraint programs_current_version_fk
  foreign key (current_version_id) references public.program_versions(id) on delete restrict;

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete restrict,
  topic text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.quiz_question_versions (
  id uuid primary key default gen_random_uuid(),
  quiz_question_id uuid not null references public.quiz_questions(id) on delete restrict,
  program_version_id uuid not null references public.program_versions(id) on delete restrict,
  question_text text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option char(1) not null check (correct_option in ('A', 'B', 'C', 'D')),
  difficulty text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.behavior_criteria (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete restrict,
  criterion_key text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (program_id, criterion_key)
);

create table public.behavior_criterion_versions (
  id uuid primary key default gen_random_uuid(),
  behavior_criterion_id uuid not null references public.behavior_criteria(id) on delete restrict,
  program_version_id uuid not null references public.program_versions(id) on delete restrict,
  title text not null,
  description text,
  scale_labels jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.batches (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete restrict,
  name text not null,
  external_code text not null,
  start_date date,
  end_date date,
  status public.batch_status not null default 'DRAFT',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (program_id, external_code)
);

create table public.batch_activity_configs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete restrict,
  activity_type public.activity_type not null,
  activity_key text not null,
  enabled boolean not null default false,
  gate_state public.gate_state not null default 'LOCKED',
  due_at timestamptz,
  config_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id, activity_type, activity_key),
  check (enabled or gate_state = 'LOCKED')
);

create table public.batch_content_snapshots (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null unique references public.batches(id) on delete restrict,
  program_version_id uuid not null references public.program_versions(id) on delete restrict,
  snapshot_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete restrict,
  name text not null,
  external_code text not null,
  status public.lifecycle_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (batch_id, external_code)
);

create table public.batch_learners (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete restrict,
  learner_id uuid not null references public.learner_profiles(user_id) on delete restrict,
  group_id uuid not null references public.groups(id) on delete restrict,
  enrollment_status public.enrollment_status not null default 'INVITED',
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (batch_id, learner_id)
);

create table public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete restrict,
  session_number smallint not null check (session_number between 1 and 5),
  session_date date,
  unique (batch_id, session_number)
);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_sessions(id) on delete restrict,
  batch_learner_id uuid not null references public.batch_learners(id) on delete restrict,
  status text not null check (status in ('PRESENT', 'ABSENT', 'EXCUSED')),
  recorded_by uuid not null references public.user_accounts(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  unique (session_id, batch_learner_id)
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete restrict,
  batch_learner_id uuid not null references public.batch_learners(id) on delete restrict,
  activity_config_id uuid not null references public.batch_activity_configs(id) on delete restrict,
  activity_type public.activity_type not null,
  status public.submission_status not null default 'NOT_STARTED',
  first_submitted_at timestamptz,
  last_submitted_at timestamptz,
  passed_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.user_accounts(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (activity_config_id, batch_learner_id)
);

create table public.submission_attempts (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete restrict,
  attempt_number integer not null check (attempt_number > 0),
  response_json jsonb not null default '{}'::jsonb,
  score_percent numeric(5,2) check (score_percent between 0 and 100),
  pass_state public.pass_state not null default 'NOT_APPLICABLE',
  question_order_json jsonb not null default '[]'::jsonb,
  submitted_at timestamptz not null default now(),
  unique (submission_id, attempt_number)
);

create table public.submission_files (
  id uuid primary key default gen_random_uuid(),
  submission_attempt_id uuid not null references public.submission_attempts(id) on delete restrict,
  storage_key text not null unique,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 20971520),
  scan_status public.scan_status not null default 'PENDING',
  uploaded_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.facilitator_feedback (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete restrict,
  facilitator_id uuid not null references public.user_accounts(id) on delete restrict,
  status text not null check (status in ('REVIEWED', 'NEEDS_REVISION')),
  feedback_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.peer_reviews (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete restrict,
  reviewer_batch_learner_id uuid not null references public.batch_learners(id) on delete restrict,
  reviewee_batch_learner_id uuid not null references public.batch_learners(id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  status public.peer_review_status not null default 'SUBMITTED',
  submitted_at timestamptz not null default now(),
  unique (batch_id, reviewer_batch_learner_id, reviewee_batch_learner_id),
  check (reviewer_batch_learner_id <> reviewee_batch_learner_id)
);

create table public.xp_transactions (
  id uuid primary key default gen_random_uuid(),
  client_organization_id uuid not null references public.client_organizations(id) on delete restrict,
  batch_id uuid not null references public.batches(id) on delete restrict,
  batch_learner_id uuid not null references public.batch_learners(id) on delete restrict,
  source_type public.xp_source_type not null,
  source_id uuid,
  amount integer not null check (amount <> 0),
  reason text,
  idempotency_key text not null unique,
  created_by uuid references public.user_accounts(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (source_type <> 'LIVE_ADJUSTMENT' or reason is not null)
);

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  import_type public.import_type not null,
  status public.import_status not null default 'UPLOADED',
  client_organization_id uuid not null references public.client_organizations(id) on delete restrict,
  program_id uuid references public.programs(id) on delete restrict,
  batch_id uuid references public.batches(id) on delete restrict,
  source_filename text not null,
  template_version text not null,
  uploaded_by uuid not null references public.user_accounts(id) on delete restrict,
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  error_rows integer not null default 0,
  created_at timestamptz not null default now(),
  committed_at timestamptz
);

create table public.import_row_errors (
  id uuid primary key default gen_random_uuid(),
  import_job_id uuid not null references public.import_jobs(id) on delete restrict,
  row_number integer not null,
  field_name text,
  error_code text not null,
  message text not null,
  raw_row jsonb not null default '{}'::jsonb
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.user_accounts(id) on delete restrict,
  client_organization_id uuid references public.client_organizations(id) on delete restrict,
  batch_id uuid references public.batches(id) on delete restrict,
  event_type text not null,
  target_type text not null,
  target_id uuid,
  before_json jsonb,
  after_json jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create table public.report_export_jobs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete restrict,
  requested_by uuid not null references public.user_accounts(id) on delete restrict,
  status text not null default 'QUEUED' check (status in ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED')),
  storage_key text,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index client_organizations_provider_idx on public.client_organizations(provider_organization_id);
create index programs_client_org_idx on public.programs(client_organization_id);
create index batches_program_idx on public.batches(program_id);
create index batch_learners_batch_group_idx on public.batch_learners(batch_id, group_id, enrollment_status);
create index submissions_batch_activity_status_idx on public.submissions(batch_id, activity_type, status);
create index submission_attempts_submission_idx on public.submission_attempts(submission_id, attempt_number);
create index xp_transactions_batch_learner_time_idx on public.xp_transactions(batch_id, batch_learner_id, created_at);
create index audit_events_scope_time_idx on public.audit_events(client_organization_id, batch_id, created_at);
create index import_jobs_status_time_idx on public.import_jobs(status, created_at);

-- RLS is enabled at the table level. Policies are added in the authorization migration
-- after role scope helper functions are reviewed.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'provider_organizations','client_organizations','user_accounts','learner_profiles',
    'role_assignments','programs','program_versions','quiz_questions','quiz_question_versions',
    'behavior_criteria','behavior_criterion_versions','batches','batch_activity_configs',
    'batch_content_snapshots','groups','batch_learners','attendance_sessions','attendance_records',
    'submissions','submission_attempts','submission_files','facilitator_feedback','peer_reviews',
    'xp_transactions','import_jobs','import_row_errors','audit_events','report_export_jobs'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;
