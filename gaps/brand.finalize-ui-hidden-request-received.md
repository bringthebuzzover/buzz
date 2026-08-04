---
id: brand.finalize-ui-hidden-request-received
title: Brand finalize UI hidden while API can still finalize
kind: ux_hole
severity: P1
status: open
surface: brand
evidence:
  - path: frontend/src/pages/brand
    note: selection UI only when brandTrackerStage === finalizing_agreements
  - path: backend/app/services/drops.py
    note: finalize_applicants auto-advances from request_received when window closed
repro: |
  Drop stuck in request_received past apply_close_at; brand UI has no Finalize; POST finalize-applicants succeeds.
fix_when: |
  Brand SPA shows finalize when the API allows it (closed window / request_received escape hatch).
---

`BrandDropDetailPage` mounts applicant selection only when
`brandTrackerStage === "finalizing_agreements"`. `finalize_applicants` auto-advances
from `request_received` when the apply window is closed (autoclose miss escape
hatch). A drop stuck in `request_received` past close has no Finalize UI, but
`POST …/finalize-applicants` succeeds.
