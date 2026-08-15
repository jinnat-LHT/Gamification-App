# Supabase Development Setup

## 1. Create separate projects

Create separate Supabase projects for Development, Staging, and Production. Never share production keys with local development or commit any key to GitHub.

## 2. Required environment variables

Create a local .env.local or equivalent secret store:

~~~text
SUPABASE_URL=<project-url>
SUPABASE_ANON_KEY=<publishable-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<server-only-key>
~~~

Rules:
- SUPABASE_ANON_KEY may be used by the browser with RLS enabled.
- SUPABASE_SERVICE_ROLE_KEY must only be used by the server-side service layer/Edge Functions.
- Never put SUPABASE_SERVICE_ROLE_KEY in HTML, frontend JavaScript, GitHub, or a public deployment.

## 3. Apply migrations

Using the Supabase CLI in a disposable Development project:

~~~bash
supabase login
supabase link --project-ref <development-project-ref>
supabase db push
supabase db reset
~~~

Expected order:
1. supabase/migrations/0001_initial_schema.sql
2. supabase/migrations/0002_rls_policies.sql
3. supabase/seed.sql (Development only)

## 4. Auth bootstrap

Create test Auth users only in Development, then insert matching user_accounts, learner_profiles, and role_assignments records through a secured local bootstrap process.

Required test identities:
- Provider Admin
- Client Alpha Admin
- Client Alpha Facilitator
- Client Beta Facilitator
- Alpha Learner A/B
- Beta Learner A

Never use real learner email addresses in seed fixtures.

## 5. Storage

Create a private bucket for Assignment files. The server-side service layer must validate MIME type and file size/count, scan before marking a file CLEAN, issue short-lived signed download URLs, write upload/download/delete audit events, and enforce the one-year post-Batch retention rule.

## 6. Verification gate

Before connecting a frontend:
- Run the RLS test plan with authenticated JWT contexts.
- Confirm Alpha identities cannot read Beta data.
- Confirm Facilitators cannot write Learner or Group records.
- Confirm Learners cannot write XP, role, import, or audit data.
- Confirm Post-test pass/retest and Assignment XP idempotency.
- Capture migration and restore evidence for the PR/UAT record.
