---
id: brand.org-attributed-totals-duplicate
title: Org attributed totals can duplicate across denied + re-applied rows
kind: invariant_break
severity: P2
status: open
surface: brand
evidence:
  - path: backend/app/services/brands.py
    note: _org_attributed_totals sums all apps for org+drop with no decision filter; _drop_aggregate is accepted-only
repro: |
  Deny then re-apply; brand applicant row rollup can double-count the same org's posts across both application rows.
fix_when: |
  Attribution rollups filter on the active/accepted decision consistently.
---

`_org_attributed_totals` aggregates across all of an org's applications on a drop,
so an org holding a denied row plus a re-applied row can render duplicate totals in
the brand view (each applicant row reuses that rollup). Brand-side `_drop_aggregate`
counts only accepted. Org-side `get_campaign_aggregate` is per `application_id`, not
an unfiltered multi-app aggregate.

`uq_drop_application_active` is partial (`WHERE decision <> 'denied'`), so a denied
org that re-applies holds two rows.
