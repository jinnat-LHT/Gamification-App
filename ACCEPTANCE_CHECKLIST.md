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
- CSV export, bulk CSV/XLSX import, and Projector Arena Top 10.

### Deferred from MVP
- Client-organization self-service administration (deferred; provider Admins manage client organizations in MVP).
- Corporate SSO, password reset, cross-device logout, real-time updates, audit-log viewer, and production monitoring.
- Any feature not explicitly listed above.

## Roles & permissions

| Capability | Admin | Facilitator | Learner |
|---|---:|---:|---:|
| Manage Program, Batch, Group, Quiz Bank within assigned Client Organizations | Allow | Deny | Deny |
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
- The platform has one provider organization and supports multiple Client Organizations. Rankings, XP totals, reports, and CSV exports are isolated to the selected Client Organization and Batch.
- Feature configuration is set per Batch: Pre-test, Post-test, Self-Behavior Before/After, Peer Review, and 0–3 Assignments can each be enabled or disabled. Disabled features are unavailable to learners and excluded from KPI/chart denominators.
- Gate default states apply only to enabled features: Pre-test and Self-Behavior (Before) open; Post-test, Self-Behavior (After), Peer Review, and enabled Assignments closed.
- Admin can bulk-import learner rosters, knowledge-test questions, and behavioral-assessment criteria from approved CSV/XLSX templates. Import runs as validate → preview → confirm; invalid rows are reported and no partial import is committed.
- Rapid Group Score: +1,000 XP per learner in the selected Group, capped at 5 awards per learner per Batch.
- Attendance: +2,000 XP per attended session; 5 sessions per Batch.
- Pre-test and Self-Behavior Before: +500 XP each, once per learner per Batch.
- Post-test: +1,500 XP once per learner per Batch; this is a completion reward, not a reward based on correct-answer count.
- Self-Behavior After: +1,000 XP once per learner per Batch.
- Peer Review: +2,000 XP once per learner per Batch.
- Each enabled Assignment is configurable by Batch with one submission mode: text response, file upload, or text + file upload. Required fields are set per Assignment.
- Assignment file uploads must use private object storage and authorized download URLs; file-size limits, allowed formats, retention period, and malware-scanning policy are **TBD**.
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
| AC-04 | Two Batches or Client Organizations exist | Admin views a Batch report/leaderboard | Only learners, XP, and results from the selected Client Organization and Batch are included. |
| AC-05 | Any Admin page is open | Admin changes Program then Batch in the context bar | All context-bound content refreshes for the selection. |
| AC-06 | A Batch is selected | Admin views the context bar | Group count, member count, and Batch XP total are shown. |
| AC-07 | A Group contains learners/data | Admin attempts deletion | System prevents destructive deletion or requires a safe-delete flow that preserves auditability. |

### B. Quiz Bank and behavioral criteria

| ID | Given | When | Then |
|---|---|---|---|
| AC-08 | A Program is selected | Admin opens Quiz Bank | Knowledge Test and Behavioral Criteria are separate views. |
| AC-09 | Admin creates a knowledge question | They enter 4 choices and one correct answer | Question is saved to the Program bank and available to its Batches. |
| AC-10 | Admin edits/removes a question | They save the change | Before Batch start, the current Version may be edited; after Batch start, a new Version is created, the active Batch keeps its Snapshot, and historical results remain unchanged. Deletion is soft. |
| AC-11 | Admin configures behavioral criteria | They save all five competencies | Strategic Thinking, Coaching, Growth Mindset, Team Execution, and Agility are available for assessment. |
| AC-11a | A Batch is being configured | Admin enables/disables tests, assessments, peer review, and selects 0–3 Assignments | Only enabled features are created for that Batch and are eligible for Gate control. |
| AC-11b | Admin uploads an approved knowledge-test or behavioral-criteria CSV/XLSX template | System validates the rows | Admin receives a preview and row-level errors before choosing to commit the import. |

### C. Gatekeeper and learner flow

| ID | Given | When | Then |
|---|---|---|---|
| AC-12 | A new Batch is created with enabled learning features | Learner opens assessment area | Enabled Pre-test and Self-Behavior Before are available; enabled Post-test, Self-Behavior After, Peer Review, and Assignments are locked. Disabled features are not shown. |
| AC-13 | An enabled feature gate is locked | Learner selects it | They cannot submit and see “รอวิทยากรเปิดระบบ”. |
| AC-14 | Admin opens a gate for the current Batch | Learner refreshes/reopens the page | The relevant task becomes available only to learners in that Batch. |
| AC-15 | Admin opens Post-test or Self-Behavior After | Learner submits valid answers | Self-Behavior saves once; Post-test requires ≥80%, permits retest while failed, saves every attempt, and locks after the first passing attempt. XP is awarded once on pass. |
| AC-16 | Admin opens Peer Review | Learner submits peer feedback | Feedback is stored against the correct Batch/Group; the recipient cannot see reviewer identity; one final submission is allowed per Learner/Batch. |
| AC-17 | Admin configures and opens Assignment #n | Learner supplies all required text and/or file fields | Submission is stored against the learner and Batch; status is tracked without a numeric grade; private files are downloadable only by authorized users; completion reporting updates; XP is awarded once. |

### D. Learners, attendance, and XP

| ID | Given | When | Then |
|---|---|---|---|
| AC-17a | An Assignment has a due date or its Gate closes | Learner submits after the deadline/closure | Submission is marked late or rejected according to the configured policy; Admin may override acceptance per Assignment. |
| AC-18 | A Batch and Group exist | Admin adds/edits a learner or changes their Group | Learner is listed once in the selected Batch and assigned to one valid Group. |
| AC-18a | Admin uploads an approved learner-roster CSV/XLSX template | System validates the rows and Admin confirms the preview | Valid learners are added to the selected Batch/Group; duplicate email, missing required columns, and unknown Groups are reported without committing a partial import. |
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
| AC-26 | Data exists for the enabled features | Admin views Reports | Applicable charts render from selected-Batch data. A disabled test/assessment/assignment is hidden or marked N/A and is never treated as a zero score/completion rate. |
| AC-27 | A Batch is selected | Admin exports CSV | File includes approved learner-level fields and uses UTF-8 BOM for Thai characters. |
| AC-28 | A user lacks management permission | They request data outside their scope | Server rejects the request; the UI does not expose it. |
| AC-28a | A Facilitator is assigned to a Batch | They review work or attendance | They can work within the assigned Batch but cannot add/edit/delete/import Learners, Groups, or permissions. |
| AC-29 | A learner uploads an Assignment file | The file violates the allowed type, size, count, or malware policy | Upload is rejected before submission and the learner sees a clear validation message. |
| AC-29a | An authorized user requests an Assignment file | The system creates a download URL | The URL is short-lived and access is limited to the submitting Learner and permitted Admins. |
| AC-30 | Admin uploads an invalid import file | Validation finds errors | No data is written until errors are resolved and Admin explicitly confirms a clean preview. |
| AC-31 | A Learner attempts self-review, duplicate review, or inappropriate feedback | The API processes the submission/moderation action | The invalid review is rejected or comment is hidden; Admin identity and reason are retained in the audit log. |
| AC-32 | An Admin changes Program quiz/criteria after a Batch starts | A learner views or submits an existing activity | The learner uses the Batch Snapshot; results retain the original content Version and answer key. |
| AC-33 | A Learner starts Post-test | The test is rendered | The Batch question set is unchanged, but question order is randomized for that Learner; option order remains A–D as authored; the presented question order is auditable. |
| AC-34 | A Learner has passed Post-test | They attempt to open it again | The system blocks retake and shows the passed status. |

## Production acceptance gates

- All relevant scenarios pass in automated or documented UAT tests.
- APIs enforce individual Admin authentication, Client Organization/Program/Batch scope, and gate state server-side.
- XP is persisted as immutable/auditable transactions; duplicate submissions are idempotent and Rapid Group Score cannot exceed 5 awards per learner per Batch.
- No business-critical read/write depends on localStorage.
- No unresolved Critical or High security findings.
