---
id: auth.view-as-remint-fails-after-reload
title: View-as latch remint can fail after reload and RequireRole dumps to /admin
kind: ux_hole
severity: P2
status: fixed
surface: admin
evidence:
  - path: frontend/src/contexts/AuthContext.tsx
    note: bootstrap retries refresh + resumeImpersonation once before clearing latch
  - path: frontend/src/components/routing/RequireRole.tsx
    note: authenticated admin on /org/* Navigate to /admin (true remint failure only)
  - path: frontend/src/api/auth.ts
    note: fetchMe ends View-as on TOKEN_EXPIRED only, not UNAUTHORIZED
  - path: frontend/e2e/admin.spec.ts
    note: org-list click scoped to the org row
repro: |
  Stress ×20 on 9e295ef: View-as lands /org/browse + banner, then page.reload().
  Expected /org/browse; received http://localhost:3000/admin (no impersonation=expired).
  17/20 shards passed; first View-as (no remint) always worked.
fix_when: |
  Reload during View-as remints from the latch even when the first POST
  /impersonate 401s after cookie refresh rotated token_version (one retry).
  fetchMe does not hard-nav on UNAUTHORIZED while impersonating.
  RequireRole /admin fallback stays for a true failed remint (inactive target).
---

# View-as remint fails after reload

Fixed: bootstrap retries `refreshAccessToken` + `resumeImpersonation` once
before dropping the latch. `fetchMe` matches `apiFetch` (clock expiry ends
View-as; ver-mismatch does not). Org-list E2E clicks the name link inside the
row. Residual zombie-auth hole remains
[`auth.failed-refresh-leaves-authenticated-shell`](../auth.failed-refresh-leaves-authenticated-shell.md).
