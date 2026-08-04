---
id: brand.reopen-selection-shows-prior-decisions
title: Reopen selection table shows prior decisions
kind: ux_hole
severity: P1
status: open
surface: brand
evidence:
  - path: frontend/src/pages/brand
    note: applicant table unfiltered; deny count = length - accepted
repro: |
  Finalize some accepts/denies; admin reopen; brand table still shows prior rows; capacity math ignores prior accepts.
fix_when: |
  Table filters to decision=applied for selection; capacity accounts for already-accepted seats; deny counts only current applied.
---

After admin reopen, prior `accepted`/`denied` rows remain. The brand applicant
table renders every application (no `decision === "applied"` filter); deny count
is `applicants.length - acceptedCount`. Finalize only mutates currently `applied`
rows; selecting a prior-accepted org returns `ORG_NOT_APPLIED`. Capacity UI ignores
already-accepted seats (pairs with `drops.finalize-reopen-over-capacity`).
