-- Leadership Quest development seed
-- No real personal data. Run only in a development Supabase project.

begin;

insert into public.provider_organizations (id, name, status)
values ('00000000-0000-0000-0000-000000000001', 'Learning Hub Provider (DEV)', 'ACTIVE')
on conflict (id) do nothing;

insert into public.client_organizations (id, provider_organization_id, name, external_code)
values
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Client Alpha (DEV)', 'CLIENT-ALPHA'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'Client Beta (DEV)', 'CLIENT-BETA')
on conflict (id) do nothing;

insert into public.programs (id, client_organization_id, name, description, status)
values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000011', 'Leadership Essentials (DEV)', 'Seed program for Client Alpha', 'ACTIVE'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000012', 'Executive Coaching (DEV)', 'Seed program for Client Beta', 'ACTIVE')
on conflict (id) do nothing;

insert into public.program_versions (id, program_id, version_number, status, published_at)
values
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000101', 1, 'ACTIVE', now()),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000102', 1, 'ACTIVE', now())
on conflict (id) do nothing;

update public.programs
set current_version_id = case id
  when '00000000-0000-0000-0000-000000000101' then '00000000-0000-0000-0000-000000000201'::uuid
  when '00000000-0000-0000-0000-000000000102' then '00000000-0000-0000-0000-000000000202'::uuid
end
where id in ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000102');

insert into public.quiz_questions (id, program_id, topic)
values
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000101', 'Strategic Thinking'),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000101', 'Coaching')
on conflict (id) do nothing;

insert into public.quiz_question_versions
  (id, quiz_question_id, program_version_id, question_text, option_a, option_b, option_c, option_d, correct_option, difficulty, sort_order)
values
  ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000201', 'DEV: What is the first step in strategic thinking?', 'Clarify the goal', 'Skip the context', 'Copy a prior plan', 'Wait for instructions', 'A', 'EASY', 1),
  ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000201', 'DEV: What supports effective coaching?', 'Only giving answers', 'Asking useful questions', 'Avoiding feedback', 'Scoring the person', 'B', 'EASY', 2)
on conflict (id) do nothing;

insert into public.behavior_criteria (id, program_id, criterion_key)
values
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000101', 'STRATEGIC_THINKING'),
  ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000101', 'COACHING'),
  ('00000000-0000-0000-0000-000000000503', '00000000-0000-0000-0000-000000000101', 'GROWTH_MINDSET'),
  ('00000000-0000-0000-0000-000000000504', '00000000-0000-0000-0000-000000000101', 'TEAM_EXECUTION'),
  ('00000000-0000-0000-0000-000000000505', '00000000-0000-0000-0000-000000000101', 'AGILITY')
on conflict (id) do nothing;

insert into public.batches (id, program_id, name, external_code, start_date, end_date, status, started_at)
values
  ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000101', 'Alpha Batch 01 (DEV)', 'ALPHA-B01', current_date, current_date + 90, 'ACTIVE', now()),
  ('00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000102', 'Beta Batch 01 (DEV)', 'BETA-B01', current_date, current_date + 90, 'READY', null)
on conflict (id) do nothing;

insert into public.batch_activity_configs
  (id, batch_id, activity_type, activity_key, enabled, gate_state, config_json)
values
  ('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000601', 'PRE_TEST', 'pre_test', true, 'OPEN', '{"question_count": 2}'),
  ('00000000-0000-0000-0000-000000000702', '00000000-0000-0000-0000-000000000601', 'POST_TEST', 'post_test', true, 'LOCKED', '{"pass_percent": 80}'),
  ('00000000-0000-0000-0000-000000000703', '00000000-0000-0000-0000-000000000601', 'SELF_BEFORE', 'self_before', true, 'OPEN', '{}'),
  ('00000000-0000-0000-0000-000000000704', '00000000-0000-0000-0000-000000000601', 'ASSIGNMENT', 'assignment_1', true, 'LOCKED', '{"mode":"TEXT_FILE","max_files":3}'),
  ('00000000-0000-0000-0000-000000000705', '00000000-0000-0000-0000-000000000601', 'ASSIGNMENT', 'assignment_2', false, 'LOCKED', '{}'),
  ('00000000-0000-0000-0000-000000000706', '00000000-0000-0000-0000-000000000601', 'ASSIGNMENT', 'assignment_3', false, 'LOCKED', '{}')
on conflict (id) do nothing;

insert into public.batch_content_snapshots (id, batch_id, program_version_id, snapshot_json)
values (
  '00000000-0000-0000-0000-000000000801',
  '00000000-0000-0000-0000-000000000601',
  '00000000-0000-0000-0000-000000000201',
  '{"question_version_ids":["00000000-0000-0000-0000-000000000401","00000000-0000-0000-0000-000000000402"],"criterion_version_ids":[]}'
)
on conflict (id) do nothing;

insert into public.groups (id, batch_id, name, external_code)
values
  ('00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000601', 'Alpha Group A (DEV)', 'ALPHA-A'),
  ('00000000-0000-0000-0000-000000000902', '00000000-0000-0000-0000-000000000601', 'Alpha Group B (DEV)', 'ALPHA-B'),
  ('00000000-0000-0000-0000-000000000903', '00000000-0000-0000-0000-000000000602', 'Beta Group A (DEV)', 'BETA-A')
on conflict (id) do nothing;

insert into public.attendance_sessions (id, batch_id, session_number, session_date)
select
  ('00000000-0000-0000-0000-' || lpad((1000 + n)::text, 12, '0'))::uuid,
  '00000000-0000-0000-0000-000000000601',
  n,
  current_date + ((n - 1) * 14)
from generate_series(1, 5) as n
on conflict (id) do nothing;

commit;

-- Auth users, learner profiles, enrollments, and role assignments are intentionally
-- not seeded here because they must be created through Supabase Auth in a
-- development-only setup. Add them with a secured local bootstrap script.
