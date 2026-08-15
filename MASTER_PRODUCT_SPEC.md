# Leadership Quest — Master Product Specification

> **Canonical product reference** for the Leadership Quest enterprise LMS and gamification platform.
>
> This document supersedes separate Admin/User functional descriptions where they conflict. The Acceptance Checklist and Decision Log remain supporting evidence; this document is the source of truth for product scope and business rules.
>
> **Status:** Phase 1 baseline — approved decisions incorporated on 15 Aug 2026.

## 1. Product intent

Leadership Quest is an enterprise learning platform that helps an organization run leadership-development programs and sustain engagement through structured learning, evidence-based assessment, and gamification.

The system must balance three goals:

1. **Learning integrity** — assessments, assignments, attendance, and outcomes are accurate and governed.
2. **Operational efficiency** — administrators can create and run a Batch without manual, repetitive setup.
3. **Positive engagement** — XP, levels, group competition, and recognition encourage participation without allowing gamification to distort learning results.

## 2. MVP scope and operating model

- The platform is operated by **one provider organization** (your organization) and supports **multiple client organizations** from day one. Each client organization can have multiple Programs.
- Client organizations do not receive self-service administration in MVP; provider Admin accounts manage only the client-organization scopes assigned to them.
- Roles in MVP: **Admin**, **Facilitator**, and **Learner**. Multiple individual Admin accounts are supported. Facilitator access is explicitly assigned by Client Organization, Program, and Batch.
- The product has separate Admin and Learner experiences connected to the same backend.
- The current standalone HTML files are prototypes only. Production must use authenticated accounts, a backend API, a central database, and private file storage; `localStorage` is not a system of record.
- Self-service client-organization administration, corporate SSO, real-time collaboration, and advanced automation are deferred unless explicitly approved.

## 3. Core hierarchy and data boundaries

```
Provider Organization
  └─ Client Organization
       └─ Program
       └─ Batch
            └─ Group
                 └─ Learner
```

- **Client Organization** is the customer-data boundary. Learners, Programs, Batches, Groups, reports, exports, and files must never cross this boundary.
- **Program** is a reusable course template. It owns reusable Quiz Bank content and behavioral criteria.
- **Batch** is a real delivery cohort. It owns learners, groups, enabled learning features, Gate settings, attendance, XP, results, reports, and rankings.
- **Group** is a competition/peer-review team within one Batch.
- All learner data, XP totals, reports, CSV exports, and leaderboards are scoped to the selected Client Organization and Batch. Data must never mix across Client Organizations or Batches.

## 4. Roles and authorization

| Capability | Admin | Facilitator | Learner |
|---|---:|---:|---:|
| Manage Program, Batch, Group, learning configuration | Allow | Deny | Deny |
| View assigned Batch learner roster | Allow | Read-only | Own profile only |
| Add/edit/delete/import Learners, Groups, or learner fields | Allow | Deny | Deny |
| Import quizzes/assessment criteria | Allow | Deny | Deny |
| Manage Quiz Bank and behavioral criteria | Allow | Deny | Deny |
| Review Assignments and provide feedback | Allow | Allow (assigned scope) | Own submissions |
| View assigned Test/Assessment results | Allow | Allow (assigned scope) | Own results |
| Manage attendance | Allow | Allow (assigned scope) | Deny |
| Open/close enabled learning gates | Allow | Allow (assigned scope) | Deny |
| Manual XP adjustment / Rapid Group Score | Allow | Only if explicitly granted | Deny |
| View executive reports and export CSV | Allow | Assigned scope; export policy-controlled | Deny |
| Complete tests, assessments, peer review, assignments | Deny in normal account | Deny in normal account | Allow |
| View Batch leaderboard | Allow | Assigned scope | Allow |

Every management, configuration, import, attendance, gate, and XP action must record the individual Admin account, timestamp, and reason where applicable.

## 5. Batch configuration: feature availability and gates

The system separates **feature enablement** from **time-based gate control**.

- **Feature enablement:** Admin chooses what applies to a Batch.
- **Gate control:** Admin chooses when an enabled activity becomes available.

Per Batch, Admin can enable or disable:
- Pre-test Knowledge
- Post-test Knowledge
- Self-Behavior Before
- Self-Behavior After
- Group Peer Review
- 0–3 Assignments

Default gates for enabled features:

| Activity | Default |
|---|---|
| Pre-test Knowledge | Open |
| Self-Behavior Before | Open |
| Post-test Knowledge | Closed |
| Self-Behavior After | Closed |
| Group Peer Review | Closed |
| Each enabled Assignment | Closed |

A disabled activity is not shown to Learners, does not generate XP, and is excluded from KPI/chart denominators. A closed enabled activity is visible but unavailable, with the message “รอวิทยากรเปิดระบบ”.

## 6. Admin experience

### 6.1 Setup Center
- Create/edit Program and Batch.
- Configure Batch learning features and gates.
- Create/manage Groups.
- Use safe-delete behavior: prevent destructive deletion when dependent learner/results data exists; retain audit history.
- Persistent context bar: Program → Batch selector, group/member/Batch-XP indicators, quick create actions.

### 6.2 Quiz Bank and assessment configuration
- Knowledge questions use four options (A–D) and one correct answer.
- Behavioral criteria use five leadership dimensions: Strategic Thinking, Coaching, Growth Mindset, Team Execution, and Agility.
- Program content is reusable by its Batches.
- When a Batch starts, its Quiz and Behavioral Criteria are locked as a Batch Snapshot.
- Editing Program questions/criteria creates a new Version. New Batches use the latest Version; an active Batch continues using its Snapshot.
- Before a Batch starts, Admin may edit the current Version. After it starts, content uses a new Version and existing results retain the original Question Version and answer key.
- Questions/criteria use Soft Delete; historical records are never physically removed.

### 6.3 Bulk Import
Admin can download and upload approved **CSV/XLSX templates** for:
- Learner roster and Group assignment
- Knowledge Test questions
- Behavioral Assessment criteria

Import workflow:

```
Download template → Upload → Validate → Preview rows/errors → Explicit confirm → Commit
```

Rules:
- No partial writes when validation has errors.
- Validate duplicate emails, required fields, Group validity, answer structure, and Batch/Program scope.
- Provide row-level error messages and a downloadable error report.
- Free-form Word/PDF parsing is not an MVP data-entry path; it may become an assisted draft workflow later, but requires human review before import.

### 6.4 Learner operations and scoring
- Manage learner roster, email, and Group assignment.
- Mark attendance for 5 sessions.
- Award Rapid Group Score.
- Create a Live XP adjustment with mandatory reason.
- Open Projector Arena: current-Batch Top 10 leaderboard.
- CSV export for the current Batch only.

### 6.5 Reports
The Admin Reports area includes:
- learner count
- cohort knowledge-growth percentage
- attendance rate
- total Batch XP
- Pre vs Post cohort-average knowledge chart
- competency gap radar
- attendance trend
- assignment completion
- level distribution
- group-average XP standing

If an activity is disabled, the related metric/chart is hidden or shown as **N/A**; it is never reported as zero.

## 7. Learner experience

### 7.1 Access and dashboard
- Learners sign in with a registered account.
- Dashboard shows personal level, total XP, activity status, attendance summary, personal learning growth, badges earned, and pending tasks.
- A first-login guided tour may be shown. It must not be required to complete learning activities.
- Learner sees only their own detailed assessment/submission data and their authorized Batch leaderboard.

### 7.2 Tests and assessments
- Knowledge Test supports Pre and Post according to Batch configuration and gate state.
- Self-Behavior uses a 1–5 scale for the five configured leadership dimensions.
- Peer Review requires a rating and written feedback for required peers before submission.
- A learner cannot access or submit a disabled/closed activity.
- Knowledge Test and Self-Behavior/Peer Review allow one final submission per Learner/Batch, except Post-test: a Learner may retest while not yet passed. Post-test requires at least 80%; after passing, the activity is locked and cannot be retaken. Each attempt is retained for audit.
- Post-test uses the same Batch Snapshot question set for every Learner, while randomizing question order only per Learner. Option order remains A–D as authored. The presented question order is stored with each attempt; question content is not randomly substituted. XP is awarded once on the first passing attempt.
- Assignments are completion/feedback activities, not numeric-scored assessments. Facilitator status is Not Reviewed / Reviewed / Needs Revision. Assignment XP is awarded once on the first successful submission; later revisions do not award additional XP.
- Due dates are optional per Assignment. After a due date, the Assignment is marked late; Admin may keep accepting late submissions per Assignment.

### 7.3 Assignments
Each enabled Assignment can be configured independently with:
- instructions and due date (due-date policy TBD)
- required text response
- required file upload
- text + file submission

Assignment files are stored in private object storage. Downloads use authorized URLs and are limited to permitted Admins and the submitting Learner. Upload type/size limits, retention, malware scanning, and resubmission policy must be finalized before production.

### 7.4 Leaderboard
- Individual leaderboard ranks learners by **total approved Batch XP**.
- Group Battle displays **total Group XP**.
- Executive reporting displays **average XP per Group**; this is a different metric and must be labeled clearly.
- Tie-breaking rule is **TBD**.
- Badge/archetype display is cosmetic unless a future approved rule assigns value.

## 8. Gamification and XP rules

### 8.1 Principles
- XP rewards participation and application; correctness remains a learning outcome, not a mechanism to inflate game points.
- A principal activity awards XP at most once per Learner per Batch.
- Attendance and Rapid Group Score are exceptions under their limits.
- Every XP change is a traceable transaction with source, amount, Batch, Learner, actor/system, timestamp, and reason/reference.
- Repeated requests must be idempotent: double clicks/retries cannot create duplicate XP.

### 8.2 Approved XP schedule

| Activity | XP | Limit |
|---|---:|---|
| Pre-test Knowledge | +500 | Once per Learner/Batch |
| Self-Behavior Before | +500 | Once per Learner/Batch |
| Attendance | +2,000 | Per attended session; 5 sessions |
| Rapid Group Score | +1,000 | Maximum 5 awards per Learner/Batch |
| Post-test Knowledge | +1,500 | Once per Learner/Batch; completion-based |
| Self-Behavior After | +1,000 | Once per Learner/Batch |
| Peer Review | +2,000 | Once per Learner/Batch |
| Assignment #1–#3 | +3,000 each | Once per enabled Assignment/Learner/Batch |
| Live XP Adjustment | +/- specified amount | Admin only; reason required |

Level thresholds retained for the MVP:
- Level 1: Emerging Leader
- Level 2: Strategic Visionary — 15,000 XP
- Level 3: Strategic Leader — 30,000 XP
- Level 4: Executive Master — 50,000+ XP

### 8.3 Deferred gamification
Loot Chests, XP-bearing Badges, and automatic bonus awards are **not part of the approved MVP XP schedule**. They should remain visual/cosmetic or be disabled until their rules, Admin controls, transaction sources, and anti-abuse limits are approved.

## 9. Reporting, privacy, and learning outcomes

- Executive Pre/Post reporting uses the **cohort average of the selected Batch**; it does not expose individual learner comparisons. For Post-test, each Learner contributes the score from their first passing Attempt (≥80%).
- Learners can see their own Pre/Post and self-assessment growth.
- Peer Review is anonymous to the recipient: the reviewed Learner does not see the reviewer’s name. Admin can see reviewer identity for audit and complaint handling.
- A Learner cannot review themselves or submit duplicate reviews for the same peer/Batch. Admin can hide/remove inappropriate comments, while preserving the moderation audit record.
- CSV export includes only fields authorized for Admin use, with UTF-8 BOM for Thai text.
- Report formulas use only enabled activities and must retain data-version references for reproducibility.

## 10. Production architecture and non-functional requirements

### Required before pilot
- Central relational database with Client Organization, Program, Batch, Group, User, content, result, submission, attendance, XP transaction, import job, audit-log, and Admin-scope records.
- Backend API enforcing authentication, authorization, Batch scope, gates, validation, and idempotency server-side.
- Private object storage for Assignment files.
- Audit log, soft delete, backup/restore process, and retention policy.
- Input validation, rate limiting, secure secrets, and security review.
- Responsive UX for mobile, tablet, desktop, and projector.
- Loading, empty, error, and retry states.
- Accessibility baseline: keyboard operation, readable contrast, form errors, and Thai/English text support.

### Recommended before wider rollout
- In-app/email notifications for gate opening, upcoming/overdue assignments, and Admin import failures.
- Admin search/filter and saved views for large cohorts.
- Dashboard data-quality alerts: missing Group, duplicate roster, incomplete attendance, unconfigured gate.
- Monitoring, error alerting, and usage metrics.
- UAT with one representative pilot Batch and documented sign-off.

### Future candidates
- Delegated self-service administration for client organizations
- expanded Facilitator permissions
- Corporate SSO and automated provisioning
- AI-assisted import drafting from Word/PDF with compulsory Admin review
- Rubrics, scoring, and written feedback on Assignments
- Certificates, approval workflows, and HR/LMS integrations
- Native mobile app, push notifications, and offline attendance capture
- Advanced analytics, benchmark cohorts, and scheduled executive reports

## 11. Open decisions before implementation

| Decision | Why it matters |
|---|---|
| Score-release display policy for tests and assessments | Defines when feedback/results become visible |
| Score-release display policy for tests and assessments | Defines when feedback/results become visible |
| Score-release display policy for tests and assessments | Defines when feedback/results become visible |
| Score-release display policy for tests and assessments | Defines when feedback/results become visible |
| Data retention, backup, recovery target, and audit-log retention | Required for governance and operations |
| Leaderboard tie-breaking rule | Makes rankings deterministic |
| Whether Levels/Badges are visual only or carry future privileges | Prevents hidden gamification rules |

## 12. Delivery sequence

1. **Phase 1 — Scope & acceptance:** resolve the open decisions above and approve this specification.
2. **Phase 2 — Data architecture:** ERD, schema, migration, seed data, storage plan, and import templates.
3. **Phase 3 — Authentication & authorization:** individual Admin accounts, Learner access, RBAC, audit events.
4. **Phase 4 — Backend APIs:** hierarchical data, activity configuration/gates, transactions, imports, reporting.
5. **Phase 5 — Frontend integration:** replace prototype storage/login with APIs while retaining approved UX.
6. **Phase 6 — QA/UAT:** security, data isolation, XP/report formulas, imports, file uploads, responsive flow.
7. **Phase 7 — Pilot launch:** staging, monitoring, backups, support runbook, and controlled first Batch.
