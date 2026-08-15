# RLS and migration test plan

These tests run against a disposable local/staging Supabase project after migrations '0001' and '0002' and the development seed.

## Test identities

Create test Auth users with no real personal data:

- provider Admin
- Client Alpha Admin
- Client Alpha Facilitator
- Client Beta Facilitator
- Alpha Learner A
- Alpha Learner B
- Beta Learner A

Assign each role through user_accounts and role_assignments.

## Required checks

| ID | Scenario | Expected |
|---|---|---|
| RLS-01 | Alpha Admin reads Alpha Program/Batch | Allowed |
| RLS-02 | Alpha Admin reads Beta Program/Batch | Denied |
| RLS-03 | Provider Admin reads both clients | Allowed |
| RLS-04 | Alpha Facilitator reads assigned Alpha Batch | Allowed |
| RLS-05 | Alpha Facilitator reads an unassigned Batch | Denied |
| RLS-06 | Facilitator inserts/updates a learner or Group | Denied |
| RLS-07 | Facilitator reviews assigned submissions | Allowed |
| RLS-08 | Learner reads own enrollment/submission/XP | Allowed |
| RLS-09 | Learner reads another learner's detailed submission/XP | Denied |
| RLS-10 | Learner reads another peer reviewer's identity | Denied by learner-safe API/view |
| RLS-11 | Client attempts direct XP insert/update | Denied; trusted service path required |
| RLS-12 | Duplicate XP idempotency key is submitted | Rejected/no second transaction |
| RLS-13 | Import validation finds an invalid row | No partial data write |
| RLS-14 | Post-test failed attempt is recorded | Retest remains available while Gate is open |
| RLS-15 | Post-test passing attempt is recorded | Submission locks and XP is awarded once |
| RLS-16 | Program content changes after Batch starts | Existing Batch Snapshot remains unchanged |
| RLS-17 | Soft-deleted learner/content is queried | Hidden from active views; historical results remain |
| RLS-18 | Audit event is written for a privileged mutation | Actor, scope, before/after, time are present |
| RLS-19 | Backup restore is performed | Restore evidence meets MVP RPO/RTO target |

## Migration quality gates

- Migrations run cleanly from an empty local project.
- Re-running seed is idempotent.
- No test identity can cross Client Organization scope.
- RLS policies are tested with authenticated JWT context, not only service role.
- Service-role tests are separate from end-user RLS tests.
- No production or real learner data appears in seed/test fixtures.
