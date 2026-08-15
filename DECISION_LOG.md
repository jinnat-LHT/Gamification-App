# Leadership Quest — Decision Log

> Record approved deviations and product decisions. New entries require owner, date, and impact.

| Date | Decision | Status | Rationale | Impact |
|---|---|---|---|---|
| 2026-08-14 | Remove Quick Role Switcher / Admin Learner Preview. | Approved | Admin users do not need this feature in their working flow. | Deviation from the original Admin Portal Spec; learner flow is tested through the dedicated learner frontend. |
| 2026-08-14 | Pre/Post report displays cohort averages for the selected Batch, not individual learner comparison. | Approved | Executive report should focus on cohort-level outcomes. | Knowledge chart and KPI must aggregate data; learner-level detail remains restricted. |
| 2026-08-15 | Keep Admin and Learner frontends as separate HTML prototype files. | Approved for prototype | Enables independent frontend review while production architecture is planned. | Production integration must replace localStorage and mock login with API/authentication. |
| TBD | Define MVP Organization scope: single organization vs multi-organization. | Pending | Determines tenant model, data isolation, and authorization design. | Blocks final database schema and RBAC policy. |
| TBD | Confirm whether Facilitator is a distinct MVP role and its permissions. | Pending | The spec identifies Admin and Learner behavior but not a final Facilitator authority model. | Blocks authorization matrix and API policies. |
| TBD | Approve XP awards beyond Rapid Group Score (+1,000) and Attendance (+2,000/session). | Pending | Prototype contains gamification awards that are not fully specified as business rules. | Blocks final XP transaction rules, ranking, and KPI validation. |
| TBD | Approve quiz/versioning policy when Program questions change after a Batch starts. | Pending | Changes must not corrupt historical assessments. | Blocks database versioning and report reproducibility. |
| TBD | Define retention, backup, and audit-log requirements. | Pending | Required for production data governance. | Blocks operational readiness and compliance planning. |

## Decision process

1. Add a row before implementing a behavior that differs from the spec.
2. Mark the row **Approved** only when the product owner confirms it.
3. Link the implementing PR and acceptance-test evidence once available.
