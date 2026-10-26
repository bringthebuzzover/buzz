---
id: auth.ig-long-lived-get-unsupported
title: Graph 100 on long-lived GET — absorbed into deploy.meta-app-review
kind: ops
severity: P0
status: fixed
surface: auth
closed_in: b535aae
evidence:
  - path: gaps/deploy.meta-app-review.md
    note: Living gap. Graph 100 for non-testers is Development / Standard Access, fixed by App Review plus Live mode
repro: |
  Superseded. The 2026-09-17 Graph 100 repro lives on
  gaps/deploy.meta-app-review.md. Do not track work here.
fix_when: |
  Already redirected. If an accepted tester still gets Graph 100 after
  Advanced Access and Live mode, reopen a code gap from the living file.
  Do not switch the long-lived exchange to POST.
---

# Absorbed into deploy.meta-app-review

Not code-fixed. Non-tester Instagram accounts, and **11 pending** tester
invites, get Graph 100 on `GET graph.instagram.com/access_token` because the
app is in Development on Standard Access. App Review approval (Advanced
Access) plus Live mode is the same workstream as the resubmission.

Living gap: [`deploy.meta-app-review`](../deploy.meta-app-review.md).

Handles are not listed here.
