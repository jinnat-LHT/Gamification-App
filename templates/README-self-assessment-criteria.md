# Self-assessment criteria CSV template

Use this template to create the 1–5 criteria used in Self-assessment before/after learning.

Required columns:
- `criterion_key`: stable uppercase identifier; unique per program.
- `title`: learner-facing criterion title.
- `description`: short learner-facing explanation.
- `scale_1` through `scale_5`: rating labels.
- `sort_order`: display order.

The importer will publish the criteria to a selected Program Version. A Batch uses its published version snapshot, so historical responses remain interpretable after later edits.
