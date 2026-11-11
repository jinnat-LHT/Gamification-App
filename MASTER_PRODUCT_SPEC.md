# Leadership Quest — Master Product Specification

> **Canonical product reference** for the Leadership Quest enterprise LMS and gamification platform.
>
> This document supersedes separate Admin/User functional descriptions where they conflict. The Acceptance Checklist, Database Schema, and Decision Log remain supporting evidence; this document is the source of truth for product scope, business rules, and system behavior.
>
> **Status:** Active baseline — aligned with `main` branch (Phase 2 schema migrations 0001–0004 and Supabase Edge Functions implementation through 17 Aug 2026).

---

## 1. Product intent

Leadership Quest is an enterprise learning platform that helps an organization run leadership-development programs and sustain engagement through structured learning, evidence-based assessment, and gamification.

The system balances three core goals:

1. **Learning integrity** — assessments, assignments, attendance, and outcomes are accurate, governed, and tamper-resistant.
2. **Operational efficiency** — administrators can create and run Batches without manual, repetitive setup through bulk save, guided setup, and CSV import workflows.
3. **Positive engagement** — XP, levels, group competition, and recognition encourage participation without allowing gamification to distort learning results.

---

## 2. MVP scope and operating model

- **Provider Organization:** Operated by one provider organization (Learning Hub Thailand) supporting multiple client organizations from day one.
- **Client Organizations:** Customer-data boundary. Each client organization can have multiple Programs and Batches. Client self-service administration is deferred in MVP; provider Admin accounts manage assigned client-organization scopes.
- **Roles in MVP:**
  - **Admin:** Full management across assigned Client Organizations, Programs, Batches, Groups, Quiz Bank, imports, scoring, gates, and reports.
  - **Facilitator:** Assigned by Client Organization, Program, and Batch. Can review assignments, provide feedback, record attendance, and toggle gates within scope; cannot modify rosters, groups, or question banks.
  - **Learner:** Completes tests, self-assessments, peer reviews, and assignments; views personal progress, review feedback, and the Batch leaderboard.
- **Architecture:** Authenticated accounts using Supabase Auth, backend API via Supabase Edge Functions, Supabase PostgreSQL with Row-Level Security (RLS), and private Supabase Storage. Client-side `localStorage` is never a system of record.
- **Deferred:** Corporate SSO, automated SCIM provisioning, client self-service admin, and real-time collaboration.

---

## 3. Core hierarchy and data boundaries

```
Provider Organization
  └─ Client Organization (Customer Data Boundary)
       └─ Program (Reusable Template & Content Bank)
            └─ Batch (Delivery Cohort & Learning Context)
                 └─ Group (Competition & Peer Review Team)
                      └─ Learner (Enrolled Participant)
```

- **Client Organization:** Customer-data isolation boundary. Learners, Programs, Batches, Groups, reports, exports, and files never cross this boundary.
- **Program:** Reusable course template. Owns versioned Quiz Bank questions and behavioral assessment criteria.
- **Batch:** Real delivery cohort. Owns enrolled learners, groups, enabled activity configs, gate states, attendance sessions/records, XP transactions, results, reports, and rankings.
- **Group:** Competition and peer-review team within a single Batch. Group names must be unique within their Batch.
- All learner records, XP totals, reports, CSV exports, and leaderboards are strictly scoped to the selected Client Organization and Batch.

---

## 4. Roles and authorization

| Capability | Admin | Facilitator | Learner |
|---|:---:|:---:|:---:|
| Manage Program, Batch, Group, learning configuration | Allow | Deny | Deny |
| View assigned Batch learner roster | Allow | Read-only | Own profile only |
| Add/edit/delete/import Learners, Groups, or learner fields | Allow | Deny | Deny |
| Import quizzes / assessment criteria from CSV/XLSX | Allow | Deny | Deny |
| Manage Quiz Bank and behavioral criteria | Allow | Deny | Deny |
| Review Assignments and provide written feedback | Allow | Allow (assigned scope) | Own submissions |
| View assigned Test/Assessment results | Allow | Allow (assigned scope) | Own results |
| Manage attendance sessions and records | Allow | Allow (assigned scope) | Deny |
| Open/close enabled learning gates | Allow | Allow (assigned scope) | Deny |
| Manual XP adjustment / Rapid Group Score | Allow | Explicit grant only | Deny |
| View executive reports and export CSV | Allow | Assigned scope (read-only) | Deny |
| Complete tests, assessments, peer review, assignments | Deny in normal account | Deny in normal account | Allow |
| View Batch leaderboard & Top 3 Podium | Allow | Assigned scope | Allow |

Every management, configuration, import, attendance, gate, and XP action records the actor user ID, timestamp, and reason where applicable in an immutable audit log.

---

## 5. Batch configuration: feature availability, gates, and content

The system separates **feature enablement** from **time-based gate control**:

- **Feature enablement:** Admin chooses which learning activities apply to a Batch. Disabled activities are hidden from Learners, generate no XP, and are excluded from KPI/chart denominators (reported as **N/A**, never zero).
- **Gate control:** Admin controls when an enabled activity becomes accessible to Learners. A closed enabled activity is visible to learners with the status *"รอวิทยากรเปิดระบบ"*.

### 5.1 Configurable activities per Batch
- Pre-test Knowledge
- Post-test Knowledge
- Self-Behavior Before
- Self-Behavior After
- Group Peer Review
- 0–3 Assignments (individually titled and configured)

### 5.2 Default gate states for enabled features

| Activity | Default State | Description |
|---|:---:|---|
| Pre-test Knowledge | **Open** | Available upon enrollment |
| Self-Behavior Before | **Open** | Available upon enrollment |
| Post-test Knowledge | **Closed** | Opened by facilitator/admin during or after training |
| Self-Behavior After | **Closed** | Opened by facilitator/admin after training |
| Group Peer Review | **Closed** | Opened by facilitator/admin during peer session |
| Each enabled Assignment | **Closed** | Opened by facilitator/admin per schedule |

### 5.3 Single bulk-save & per-batch assignment customization
- **Bulk Save:** Admin activity controls use a single sticky **"บันทึกการเปลี่ยนแปลงทั้งหมด"** button. Admins can adjust multiple activity toggles, gate states, and assignment details before saving once atomically.
- **Assignment Content Customization:** For each enabled Assignment (1–3), Admins can customize the **Title** and **Learner-facing Instructions** per Batch directly within activity controls.

---

## 6. Admin experience

### 6.1 Setup Center & Batch lifecycle
- **Guided Setup Order:** Program creation → Batch creation → Group creation → Learner enrollment.
- **Inline Editors:** Program, Batch, and Group management use clean inline forms with clear feedback and auto-selection of newly created records, replacing browser prompt dialogs.
- **Validation Rules:**
  - Program names must be unique within a Client Organization.
  - Group names must be unique within a Batch (enforced on create and rename).
  - Batch schedule dates must be valid (`start_date <= end_date`).
  - Safe delete: Prevents destructive deletion when dependent learner/results/XP data exists; retains audit history.
  - Inactive groups can be reactivated with an explicit reactivation control.
  - Generated Batch codes are immutable once created.
- **Automatic Batch Lifecycle:**
  - `DRAFT`: Initial batch setup in progress.
  - `READY`: Automatically transitions from `DRAFT` when active groups exist, learners are enrolled, and activities are enabled.
  - `ACTIVE`: Automatically transitions from `READY` when the first submission or attendance record is logged.
  - `COMPLETED`: Admin marks completion with explicit confirmation; prevents duplicate completion.
  - `ARCHIVED`: Archived for historical records.

### 6.2 Quiz Bank and assessment configuration
- **Knowledge Test:** Questions use four choices (A–D) and one correct answer.
- **Behavioral Criteria:** Covers five leadership dimensions: *Strategic Thinking, Coaching, Growth Mindset, Team Execution, Agility* (1–5 scale).
- **Batch Content Snapshot:** When a Batch starts, its Quiz and Behavioral Criteria are frozen as an immutable Batch Snapshot. Editing Program content creates a new Version; existing active Batches continue using their Snapshot.
- **Soft Delete:** Questions and criteria use Soft Delete; historical assessment records are never orphaned or deleted.

### 6.3 Bulk import workflows
Admin can download approved templates and upload:
1. **Learner roster & Group assignments** (`.csv`, `.xlsx`)
2. **Knowledge Test questions** (`.csv`)
3. **Behavioral Assessment criteria** (`.csv`)

Import pipeline:
```
Download template → Upload file → Server validation → Preview rows/errors → Explicit confirm → Atomic commit
```
- Atomic writes: No partial data is written if validation encounters errors.
- Validates duplicate emails, required headers, group existence, answer structure, and scope.
- Provides row-level error reporting and clear validation messages.

### 6.4 Learner operations and scoring
- **Configurable Attendance Schedule:** Configured per Batch for **1 to 20 sessions** (default: 5 sessions). Each session can have an optional title. Recorded via an explicit checkbox matrix where checked means present; one save commits all changes and creates auditable XP transactions.
- **Rapid Group Score:** +1,000 XP awarded to all members of the selected Group (capped at 5 awards per learner per Batch).
- **Live XP Adjustment:** Signed (+/-) amount with mandatory written reason, actor ID, and timestamp.
- **Projector Arena:** Full-screen Top 10 leaderboard with Top 3 awards podium (Gold, Silver, Bronze styling) for in-person projection.
- **CSV Cohort Export:** Exports authorized learner data for the selected Batch using UTF-8 BOM for Thai character compatibility.

### 6.5 Facilitator review queue
- Displays pending and reviewed Assignment submissions filtered by Batch and Assignment.
- Reviewers inspect learner text submissions and download attached files via secure signed URLs.
- Review status: `NOT_REVIEWED` | `REVIEWED` | `NEEDS_REVISION`.
- Reviewers provide written qualitative feedback directly visible on the learner dashboard.

### 6.6 Executive reports
The Admin Reports dashboard includes:
- Total learner count
- Cohort knowledge-growth percentage (Pre vs Post average)
- Attendance rate
- Total Batch XP
- Pre vs Post cohort-average knowledge comparison chart
- Competency gap radar / spider chart
- Attendance trend across configured sessions
- Assignment completion rates
- Level distribution
- Group-average XP standing

Disabled activities are hidden or shown as **N/A**; they are never factored in as zero.

---

## 7. Learner experience

### 7.1 Access, onboarding, and dashboard
- **Activation & Login:** Learners activate their account and set their password via a dedicated activation portal (`set-password.html`) linked to Supabase Auth invitations.
- **Learner Dashboard:** Displays personal level badge, total approved XP, activity status cards, attendance progress, personal growth metrics, earned badges, and pending tasks.
- **Live Context:** Live XP, group assignment, activity gates, and facilitator feedback are fetched live from Supabase.
- **Privacy:** Learners see only their own submission details, personal scores, and the authorized Batch leaderboard.

### 7.2 Tests and assessments
- **Pre-test:** Completed once; awards +500 XP upon submission.
- **Self-Behavior Before & After:** 1–5 rating across the five leadership dimensions. Completed once; awards +500 XP (Before) and +1,000 XP (After).
- **Post-test Knowledge:**
  - Requires **$\ge 80\%$** to pass.
  - If a learner fails, they may retest while the Gate is open.
  - After passing ($\ge 80\%$), the Post-test is locked and cannot be retaken.
  - Every attempt is recorded with question presentation order, responses, score, and pass state.
  - Question presentation order is randomized per Learner; option order remains A–D as authored.
  - XP (+1,500 XP) is awarded once upon the first passing attempt.
- **Group Peer Review:**
  - Learners provide ratings and written feedback for required peers within their assigned Group.
  - Anonymous to recipient: The reviewed peer sees ratings and feedback without reviewer names. Admin retains full reviewer identity for moderation and audit.
  - Self-review and duplicate reviews are rejected server-side.
  - Awards +2,000 XP once upon full submission.

### 7.3 Assignments & Facilitator feedback
- Each enabled Assignment (1–3) requires:
  - Text response only,
  - File upload only, or
  - Text response + file upload.
- **File Upload Specifications:**
  - Allowed formats: `PDF`, `DOC`, `DOCX`, `PPT`, `PPTX`, `XLS`, `XLSX`, `PNG`, `JPG`.
  - Max file size: **20 MB per file**.
  - Max files: **3 files per assignment**.
  - Stored in private Supabase Storage buckets; downloaded via short-lived authorized signed URLs.
  - Files retained for at least 1 year after Batch completion.
- **Grading & Status:** Assignments are qualitative (not numeric grades). Status: `NOT_REVIEWED` | `REVIEWED` | `NEEDS_REVISION`.
- **Resubmission:** Learners may revise submissions until gate closure or due date.
- **XP Award:** +3,000 XP is awarded once upon first successful submission; later revisions do not grant duplicate XP.

### 7.4 Leaderboard & Awards podium
- **Individual Leaderboard:** Ranks learners by total approved Batch XP. Top 3 participants are highlighted on an **Awards Podium** with Gold, Silver, and Bronze distinction.
- **Group Battle:** Ranks Groups by total Group XP.
- **Executive Group View:** Displays average XP per Group (clearly distinguished from total Group XP).
- **Deterministic Tie-Breaking:**
  1. Total approved Batch XP descending.
  2. Timestamp of reaching that XP total ascending (earlier achiever ranks higher).
  3. Normalized display name alphabetically.

---

## 8. Gamification and XP rules

### 8.1 Principles
- XP rewards active participation, completion, and applied learning; test correctness remains an academic outcome and does not inflate game points.
- Core activities award XP at most once per Learner per Batch.
- Every XP change is an immutable transaction record containing source, amount, Batch, Learner, actor ID/system, timestamp, and idempotency key.
- Double clicks and retries are idempotent and cannot create duplicate XP awards.

### 8.2 Approved XP schedule

| Activity | XP Amount | Rules & Limits |
|---|---:|---|
| **Pre-test Knowledge** | +500 XP | Once per Learner / Batch on submission |
| **Self-Behavior Before** | +500 XP | Once per Learner / Batch on submission |
| **Attendance** | +2,000 XP / session | Awarded per attended session across configured sessions (1–20 sessions, default 5) |
| **Rapid Group Score** | +1,000 XP / award | Maximum 5 awards per Learner / Batch |
| **Post-test Knowledge** | +1,500 XP | Once per Learner / Batch upon achieving $\ge 80\%$ |
| **Self-Behavior After** | +1,000 XP | Once per Learner / Batch on submission |
| **Group Peer Review** | +2,000 XP | Once per Learner / Batch upon completing required reviews |
| **Assignments (#1–#3)** | +3,000 XP / assignment | Once per enabled Assignment on first submission; revisions grant +0 XP |
| **Live XP Adjustment** | $\pm$ Specified amount | Admin only; mandatory reason; creates compensating transaction |

### 8.3 Level thresholds

| Level | Title | Required XP |
|---|---|---:|
| **Level 1** | Emerging Leader | 0 XP |
| **Level 2** | Strategic Visionary | 15,000 XP |
| **Level 3** | Strategic Leader | 30,000 XP |
| **Level 4** | Executive Master | 50,000+ XP |

*Note:* Levels and badges are cosmetic milestones. Loot boxes, XP-bearing badges, and automated bonus multipliers remain excluded from MVP.

---

## 9. Reporting, privacy, and data governance

- **Cohort-Level Executive Reporting:** Executive Pre/Post and growth reports display cohort averages for the selected Batch; individual learner comparison rows are not exposed in executive views. Post-test calculations use each Learner's first passing attempt ($\ge 80\%$).
- **Immediate Learner Feedback:** Learners see automated test results, pass/fail status, and submission receipts immediately. Facilitator feedback appears once reviewed.
- **Peer Review Anonymity:** Reviewee sees ratings and qualitative comments anonymously. Full reviewer identity is stored privately for Admin moderation and audit.
- **Audit Log & Soft Delete:**
  - Audit log is append-only and immutable. Retained for at least 2 years following Batch completion.
  - Soft Delete (`deleted_at`) is enforced on Learners, Groups, Questions, Assignments, and Files; physical hard delete is prohibited for records linked to submissions, results, or XP transactions.
- **Database Backup & Recovery:** Daily backups retained for 30 days; monthly backups retained for 12 months. MVP targets: RPO $\le 24$ hours, RTO $\le 8$ hours.
- **CSV Exports:** UTF-8 BOM encoding for complete Thai text compatibility.

---

## 10. Production architecture and technical implementation

### Implemented stack on `main`
- **Database:** Supabase PostgreSQL with versioned SQL migrations (`0001_initial_schema.sql` through `0004_automatic_batch_lifecycle.sql`).
- **Authentication:** Supabase Auth for Admin, Facilitator, and Learner accounts. Learner password setup handled via `set-password.html`.
- **Authorization:** PostgreSQL Row-Level Security (RLS) enforcing Client Organization, Program, and Batch data isolation.
- **Serverless API Layer (Supabase Edge Functions):**
  - `assignment-submit`: Secure submission of assignment text and files.
  - `assignment-review`: Facilitator review queue, status updates, and feedback.
  - `attendance-management`: Configurable attendance recording and XP synchronization.
  - `batch-activity-admin`: Bulk save of activity states, gates, and assignment titles/instructions.
  - `cohort-export-report`: UTF-8 BOM CSV export for batch reporting.
  - `group-management`: Group creation, inline rename, duplicate validation, and reactivation.
  - `import-quiz-bank`: Validation, preview, and import of quiz questions.
  - `import-roster`: Validation, preview, and import of learner rosters.
  - `post-test`: Secure Post-test evaluation, randomized question presentation, passing threshold validation, and XP awarding.
  - `roster-management`: Learner enrollment and profile operations.
  - `self-assessment`: Self-behavior assessment submissions.
  - `self-assessment-report`: Cohort and individual radar/spider chart aggregation.
  - `setup-management`: Program/Batch lifecycle, date validation, and inline editing.
  - `xp-management`: Auditable, idempotent XP transaction logging and Rapid Group Score.
- **File Storage:** Private Supabase Storage bucket (`assignment-files`) with short-lived signed URLs.
- **Web Portals:** Separate Admin Portal (`index.html` / `Leadership_quest_Admin_Enhanced.html`) and Learner Portal (`leadership_quest_User.html`) hosted with GitHub Pages compatibility.

---

## 11. Resolved architectural and product decisions

All prior open decisions have been formally approved and verified in the codebase on `main`:

| Area | Approved Decision | Verification on `main` |
|---|---|---|
| **Score & Feedback Release** | Immediate display of automated results/receipts to Learners. Assignment facilitator feedback displayed after review. Peer Review remains anonymous to recipient. | Implemented in `post-test`, `assignment-review`, and learner UI |
| **Leaderboard Tie-Breaking** | Tie-break order: (1) Total approved XP desc, (2) Timestamp of reaching total asc, (3) Normalized name alphabetically. Top 3 on Awards Podium. | Implemented in PR #5 and leaderboard renderers |
| **Levels & Badges** | Levels 1–4 with thresholds at 0 / 15k / 30k / 50k XP are cosmetic. No unapproved XP-bearing badges. | Implemented in learner dashboard & XP engine |
| **Assignment File Policy** | PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, PNG, JPG; max 20 MB/file; max 3 files/assignment; private Supabase Storage with signed URLs; 1-year retention. | Enforced in `assignment-submit` & schema constraints |
| **Attendance Configuration** | Configurable between 1 and 20 sessions per Batch (default 5). Checkbox matrix with single explicit save. | Schema migration `0003` & `attendance-management` |
| **Batch Lifecycle** | Automatic transition: `DRAFT` → `READY` → `ACTIVE`. Immutable batch codes. Single-save activity controls. | Schema migration `0004` & `batch-activity-admin` |
| **Post-test Rules** | Pass threshold $\ge 80\%$. Failed learners can retest while gate open; passing locks test. Random question order per learner; A–D option order unchanged. | Enforced in `post-test` Edge Function |
| **Data Retention & Audit** | Immutable Audit Log retained 2 years. Soft Delete for all referenced records. Daily backups 30d, monthly 12m. | Implemented in RLS, schema triggers, and audit tables |

---

## 12. Delivery sequence and status

1. **Phase 1 — Scope & Acceptance:** Approved & Baseline locked.
2. **Phase 2 — Data Architecture & Migrations:** Complete (`0001_initial_schema.sql` through `0004_automatic_batch_lifecycle.sql`).
3. **Phase 3 — Authentication & Authorization:** Complete (Supabase Auth, invite password flow, RLS policies).
4. **Phase 4 — Backend APIs & Edge Functions:** Complete (14 Supabase Edge Functions deployed for core workflows).
5. **Phase 5 — Frontend Integration:** Complete on `main` (Admin & Learner portals connected to Supabase backend).
6. **Phase 6 — Staging QA & Security Verification:** Active.
7. **Phase 7 — Pilot Batch Launch:** Scheduled upon staging sign-off.

---

## 13. LHT Ecosystem Integration Architecture

Leadership Quest operates within the broader **Learning Hub Thailand (LHT) Training & AI Ecosystem**, connecting with **Training Ops (`lht-training-os`)** as the Master Data Authority and **AI Leadership Companion ("Linn" / `Ai-Leadership-Companion`)** as the primary learner engagement front-door.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   Training Ops (lht-training-os)                      │
│                  Master Data & Business Lifecycle                      │
│   - Jobs (Clients, Courses, Dates)  - Billing / Invoicing / Payout     │
│   - Learner Rosters & HR Contacts    - Survey / Evaluations (LS/HS)    │
└──────────────┬──────────────────────────────────────────┬──────────────┘
               │ (1) Master Data Sync                     │ (3) Batch & Roster Provisioning
               │ (SSO & Hand-off)                         │ (XP / Gate Completion)
               ▼                                          ▼
┌───────────────────────────────┐          ┌─────────────────────────────┐
│    Ai-Leadership-Companion    │          │      Gamification App       │
│       (Linn: LINE Bot)        │          │     (Leadership Quest)      │
│ - 30-Day Follow-up & Nudges   │◄────────►│ - In-Class Attendance / Gate│
│ - Reflection & Learning RAG   │ (2) Data │ - Quests, XP & Leaderboard  │
│ - Assignments (PDF/LIFF)      │  Exchange│ - Facilitator Review Queue  │
└───────────────────────────────┘          └─────────────────────────────┘
```

### 13.1 Tri-App Roles & Data Ownership

| System | Role | Authority & Data Ownership |
|---|---|---|
| **Training Ops (`lht-training-os`)** | **Master Data Authority (Source of Truth)** | Owns Clients, Courses, Training Jobs (`job_ref`), Trainer assignments, Billing/Payout, and Surveys/Certifications. |
| **Gamification App (`Gamification-App`)** | **In-Class Learning & Quest Engine** | Owns Session Attendance matrices, Quest & Level rules, XP Ledger, Leaderboard/Podium calculations, and Facilitator Review Queue. |
| **AI Leadership Companion (`Ai-Leadership-Companion`)** | **User Front Door & 30-Day Coach** | Owns Dedicated LINE OA, LIFF Onboarding, Long-term AI memory (Linn), Proactive Nudge schedules, and Rich Menu navigation. |

### 13.2 Global Entity Mapping & Key Conventions

- **Job / Batch Reference:** `job_ref` (UUID) from Training Ops is the immutable master key, mapped as `batch_code = OPS-{job_ref}` across both Gamification App and AI Companion.
- **Learner Identity:** Unified via `line_user_id` and corporate email. Gamification accounts can be auto-provisioned or mapped directly from the roster sync.
- **Shared Secret Pattern:** Cross-system server-to-server calls authenticate using HMAC-SHA256 with timing-safe comparisons guarded by shared secret headers (matching `x-ops-sync-secret` convention).

### 13.3 End-User Touchpoints & Rich Menu Hub

Learners interact primarily through the dedicated LINE OA ("Linn"), which acts as the unified launcher for all modules via a standardized 6-button Rich Menu (English-first with Thai subtitles):

1. 🏆 **Quest & Ranking** *(ภารกิจและอันดับ)*: Deep-links via LIFF to Leadership Quest Learner Portal (Attendance check-in, Group/Individual XP, Leaderboard). General learners without active quest batches receive a standard course progress summary.
2. 💬 **Ask Linn** *(คุยกับลินน์)*: Interactive AI coaching session on LINE, extracting reflective commitments and crediting micro-quest XP back to the Gamification ledger.
3. 📝 **Assignment** *(ส่งงาน / การบ้าน)*: Opens assignment submission form (text / PDF $\le 10$ MB), routed to the Facilitator Review Queue.
4. 📚 **Handout** *(เอกสารประกอบการเรียน)*: Downloads course handouts, slides, and reference infographics.
5. 🎯 **Assess & Cert** *(ทดสอบ ประเมิน ใบเซอร์)*: Unified hub for Pre/Post-tests, Behavioral/Competency Assessments (e.g., BCI), Learner Satisfaction Survey (LS-01), and e-Certificate download upon passing all gates.
6. 🆘 **Contact Admin** *(ติดต่อทีมงาน)*: Switches conversation to `HUMAN` mode and triggers facilitator notifications with `#CODE` in LHT admin LINE group.

### 13.4 Inter-System Integration Workflows

1. **Inbound Batch & Roster Provisioning:**
   - When Training Ops confirms an active Job, it triggers a webhook payload to create a corresponding `Batch` with status `READY`, pre-configuring `attendance_total_sessions` (1–20) and importing participants.
2. **Seamless LIFF Authentication (SSO):**
   - When learners launch Leadership Quest from LINE OA, their verified LINE ID or signed token automatically resolves their Batch and Group membership without requiring manual password entry.
3. **Outbound Gate Completion & Certification Callback:**
   - When a learner completes all mandatory Gates (Attendance $\ge$ threshold, Assignment approved, Post-test $\ge 80\%$), Leadership Quest notifies Training Ops to release e-Certificate and unlock Survey LS-01.
4. **AI Companion Reflection XP Bridge:**
   - Validated reflection completions and proactive follow-up commitments captured by Linn generate XP credit transactions directly in `user_xp_ledger`.
