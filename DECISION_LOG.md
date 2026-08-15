# Leadership Quest — Decision Log

> Record approved deviations and product decisions. New entries require owner, date, and impact.

| Date | Decision | Status | Rationale | Impact |
|---|---|---|---|---|
| 2026-08-14 | Remove Quick Role Switcher / Admin Learner Preview. | Approved | Admin users do not need this feature in their working flow. | Deviation from the original Admin Portal Spec; learner flow is tested through the dedicated learner frontend. |
| 2026-08-14 | Pre/Post report displays cohort averages for the selected Batch, not individual learner comparison. | Approved | Executive report should focus on cohort-level outcomes. | Knowledge chart and KPI must aggregate data; learner-level detail remains restricted. |
| 2026-08-15 | Keep Admin and Learner frontends as separate HTML prototype files. | Approved for prototype | Enables independent frontend review while production architecture is planned. | Production integration must replace localStorage and mock login with API/authentication. |
| 2026-08-15 | One provider organization operates the platform; MVP supports multiple Client Organizations, each with multiple Programs. | Approved (revised) | The provider needs to run leadership programs for multiple customers without mixing data. | Database and authorization must enforce Client Organization boundaries from the first release; client self-service administration is deferred. |
| 2026-08-15 | MVP roles are Admin and Learner only; multiple Admin accounts are allowed. | Approved | Facilitator operations are not required initially. | Authentication and audit logs must identify the individual Admin actor for every management/XP action. |
| 2026-08-15 | Approve XP rules: Pre-test +500; Self-Behavior Before +500; Post-test +1,500; Self-Behavior After +1,000; Peer Review +2,000; Assignments #1–3 +3,000 each; Rapid Group Score capped at 5 awards/learner/Batch. | Approved | Balance participation and applied learning while preventing in-class bonus scoring from dominating rankings. | Persist as auditable transactions; principal activities award XP once per learner per Batch; Post-test XP is completion-based. |
| 2026-08-15 | Configure enabled learning features per Batch: tests, self-assessments, peer review, and 0–3 Assignments may be disabled. Gate controls apply only to enabled features. | Approved | Different training Batches can have different learning activities without misleading reporting. | UI/API must hide disabled features; Reports must exclude them from denominators and show N/A where relevant. |
| 2026-08-15 | Each enabled Assignment may require a text response, file upload, URL/link, or text + file. | Approved | Support practical work submissions without forcing every Batch into the same format. | Production architecture needs private file storage, authorized download URLs, validation, and malware scanning; upload limits and retention remain TBD. |
| 2026-08-15 | Provide bulk CSV/XLSX import templates for learner rosters, knowledge-test questions, and behavioral-assessment criteria. | Approved | Reduce manual entry while keeping structured data reliable. | Import must validate, preview errors, require explicit confirmation, prevent duplicates, and avoid partial writes. Free-form Word/PDF import is not an MVP data-entry path. |
| TBD | Approve quiz/versioning policy when Program questions change after a Batch starts. | Pending | Changes must not corrupt historical assessments. | Blocks database versioning and report reproducibility. |
| TBD | Define retention, backup, and audit-log requirements. | Pending | Required for production data governance. | Blocks operational readiness and compliance planning. |

## Decision process

1. Add a row before implementing a behavior that differs from the spec.
2. Mark the row **Approved** only when the product owner confirms it.
3. Link the implementing PR and acceptance-test evidence once available.
