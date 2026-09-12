---
id: brand.finalize-ignores-hidden
title: Brand finalize still mutates a hidden drop
kind: invariant_break
severity: P2
status: fixed
surface: brand
evidence:
  - path: backend/app/services/brands.py
    note: finalize_applicants lock query includes hidden_at IS NULL (404 like resolve_brand_drop)
  - path: backend/tests/test_brand_routes.py
    note: TestFinalizeApplicants.test_hidden_drop_404s_until_unhide
repro: |
  Admin hides a published drop. Brand GET /api/brands/me/drops/{id} is 404.
  Brand still POSTs /api/brands/me/drops/{id}/finalize-applicants with the
  known UUID and can accept/deny applicants and trigger denial emails.
fix_when: |
  Finalize (and any other brand write that skips resolve_brand_drop) 404s when
  hidden_at is set, same as list/detail. Tests cover POST finalize on a hidden
  drop. Unhide restores finalize. Residual of archive admin.drop-hide-unhide.
---

# Finalize bypasses hide

**Shipped:** finalize lock requires `hidden_at IS NULL`; POST finalize on a
hidden UUID 404s; unhide restores. `closed_in` at commit.
