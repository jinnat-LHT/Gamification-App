# Leadership Quest — Acceptance Checklist

> Phase 1 baseline. Source: `Admin Portal Spec.docx` (14 Aug 2026) and approved product decisions.
>
> **Status:** Draft — requires product-owner sign-off before Phase 2.
>
> **Test convention:** Each scenario is verified in staging with a named Program, Batch, Groups, and test users. “Server-enforced” applies once the production backend exists.

## MVP scope

### Included
- Admin portal: Setup Center, Quiz Bank, Users & Scores, Reports.
- Learner portal: pre/post knowledge tests, self-behavior assessment, peer review, assignments, leaderboard.
- Program → Batch → Group hierarchy, per-Batch scoring/reporting, and Quest Gatekeeper.
- CSV export and Projector Arena Top 10.

### Deferred from MVP
- Multi-organization operation (deferred; MVP launches for one organization).
- Corporate SSO, password reset, cross-device logout, real-time updates, audit-log viewer, and production monitoring.
- Any feature not explicitly listed above.

## Roles & permissions

| Capability | Admin | Facilitator | Learner |
|---|---:|---:|---:|
| Manage Program, Batch, Group, Quiz Bank | Allow | Deny | Deny |
| Manage learner roster and attendance | Allow | Deny | Own profile only |
| Award/adjust XP | Allow | Deny | Deny |
| Open/close Quest Gates | Allow | Deny | Deny |
| View reports and export CSV | Allow | Deny | Own results only |
| Complete tests, peer review, assignments | Deny | Deny | Allow |
| View leaderboard | Allow | Deny | Allow |

**Approved MVP policy:** Facilitator is not a role in MVP. Multiple Admin accounts are permitted; each management action must be attributable to the individual Admin account.

## Locked rules

- Hierarchy: Program → Batch → Group → Learner.
- Quiz Bank and behavioral criteria belong to Program and are reusable by its Batches.
- MVP launches for one organization. Rankings, XP totals, reports, and CSV exports are isolated to the selected Batch.
- Gate default states: Pre-test and Self-Behavior (Before) open; Post-test, Self-Behavior (After), Peer Review, and Assignments 1–3 closed.
- Rapid Group Score: +1,000 XP per learner in the selected Group, capped at 5 awards per learner per Batch.
- Attendance: +2,000 XP per attended session; 5 sessions per Batch.
- Pre-test and Self-Behavior Before: +500 XP each, once per learner per Batch.
- Post-test: +1,500 XP once per learner per Batch; this is a completion reward, not a reward based on correct-answer count.
- Self-Behavior After: +1,000 XP once per learner per Batch.
- Peer Review: +2,000 XP once per learner per Batch.
- Assignments #1–#3: +3,000 XP each, once per learner per Batch.
- Live XP adjustment is an explicit positive or negative amount and must record a reason, authorized Admin account, and time.
- Executive Pre/Post reporting displays the selected Batch’s cohort average, not individual learner results.

## Acceptance scenarios

### A. Context, hierarchy, and setup

| ID | Given | When | Then |
|---|---|---|---|
| AC-01 | An Admin is signed in | They create a Program | Program name/details are saved and visible. |
| AC-02 | A Program exists | Admin creates a Batch under it | Batch belongs to exactly that Program. |
| AC-03 | A Batch exists | Admin creates a Group | Group belongs to exactly that Batch. |
| AC-04 | Two Batches exist | Admin views a Batch report/leaderboard | Only learners, XP, and results from that Batch are included. |
| AC-05 | Any Admin page is open | Admin changes Program then Batch in the context bar | All context-bound content refreshes for the selection. |
| AC-06 | A Batch is selected | Admin views the context bar | Group count, member count, and Batch XP total are shown. |
| AC-07 | A Group contains learners/data | Admin attempts deletion | System prevents destructive deletion or requires a safe-delete flow that preserves auditability. |

### B. Quiz Bank and behavioral criteria

| ID | Given | When | Then |
|---|---|---|---|
| AC-08 | A Program is selected | Admin opens Quiz Bank | Knowledge Test and Behavioral Criteria are separate views. |
| AC-09 | Admin creates a knowledge question | They enter 4 choices and one correct answer | Question is saved to the Program bank and available to its Batches. |
| AC-10 | Admin edits/removes a question | They save the change | Change is reflected according to the approved versioning policy (**TBD**). |
| AC-11 | Admin configures behavioral criteria | They save all five competencies | Strategic Thinking, Coaching, Growth Mindset, Team Execution, and Agility are available for assessment. |

### C. Gatekeeper and learner flow

| ID | Given | When | Then |
|---|---|---|---|
| AC-12 | A new Batch is created | Learner opens assessment area | Pre-test and Self-Behavior Before are available; all other specified gates are locked. |
| AC-13 | A gate is locked | Learner selects it | They cannot submit and see “รอวิทยากรเปิดระบบ”. |
| AC-14 | Admin opens a gate for the current Batch | Learner refreshes/reopens the page | The relevant task becomes available only to learners in that Batch. |
| AC-15 | Admin opens Post-test or Self-Behavior After | Learner submits valid answers | The result is saved once and updates relevant reporting. |
| AC-16 | Admin opens Peer Review | Learner submits peer feedback | Feedback is stored against the correct Batch/Group and is not exposed beyond authorized scope. |
| AC-17 | Admin opens Assignment #n | Learner submits required content | Submission is stored once and completion reporting updates. |

### D. Learners, attendance, and XP

| ID | Given | When | Then |
|---|---|---|---|
| AC-18 | A Batch and Group exist | Admin adds/edits a learner or changes their Group | Learner is listed once in the selected Batch and assigned to one valid Group. |
| AC-19 | A Group is selected | Admin uses Rapid Group Score | Each current group member receives one +1,000 XP transaction. |
| AC-20 | Attendance is recorded for a session | Admin checks/unchecks a learner | XP totals reflect +2,000 XP per attended session without duplicate awards. |
| AC-21 | A learner is selected | Authorized user submits a Live XP adjustment | A signed +/- transaction records amount, reason, actor, and time. |
| AC-22 | XP changes are made | Any user reloads or another Admin views the Batch | Totals, ranking, and reports are consistent; business data does not rely on localStorage, and each change identifies the individual Admin actor. |
| AC-23 | Projector Arena is opened | Scores change through the approved workflow | The Top 10 uses the current Batch only. |

### E. Reports and export

| ID | Given | When | Then |
|---|---|---|---|
| AC-24 | A Batch has learners/results | Admin opens Reports | KPI cards show learner count, cohort knowledge growth, attendance rate, and total Batch XP. |
| AC-25 | Pre/Post results exist | Admin views the Knowledge chart | It shows cohort-average Pre and Post values for the selected Batch, never individual rows. |
| AC-26 | Behavioral, attendance, assignment, XP, and level data exist | Admin views Reports | Six charts render from selected-Batch data: Knowledge, Competency Gap, Attendance Trend, Assignment Completion, Level Distribution, Group Average XP. |
| AC-27 | A Batch is selected | Admin exports CSV | File includes approved learner-level fields and uses UTF-8 BOM for Thai characters. |
| AC-28 | A user lacks management permission | They request data outside their scope | Server rejects the request; the UI does not expose it. |

## Production acceptance gates

- All relevant scenarios pass in automated or documented UAT tests.
- APIs enforce individual Admin authentication, Program/Batch scope, and gate state server-side.
- XP is persisted as immutable/auditable transactions; duplicate submissions are idempotent and Rapid Group Score cannot exceed 5 awards per learner per Batch.
- No business-critical read/write depends on localStorage.
- No unresolved Critical or High security findings.
