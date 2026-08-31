---
id: auth.failed-refresh-leaves-authenticated-shell
title: apiFetch failed refresh nulls the bearer but leaves AuthContext authenticated
kind: ux_hole
severity: P3
status: fixed
surface: auth
evidence:
  - path: frontend/src/api/client.ts
    note: failed refresh CAS-nulls then notifyApiSessionLost if bearer still empty
  - path: frontend/src/contexts/AuthContext.tsx
    note: handler failHards only when status is authenticated
  - path: frontend/src/api/auth.ts
    note: registerApiSessionLostHandler avoids a client↔AuthContext import cycle
repro: |
  Authenticated session; expire access JWT; fail POST /api/auth/refresh (no cookie).
  apiFetch throws; RequireAuth sees status error and navigates to login.
fix_when: |
  Dead cookie after a settled authenticated session signs the SPA out without
  treating login/bootstrap 401 races as logout. Stress E2E must not bounce
  successful logins to /login or /admin/login.
---

# Failed refresh leaves authenticated shell

Fixed: `apiFetch` notifies AuthContext only after a failed refresh that left
no bearer. The handler no-ops unless `status === "authenticated"` (bootstrap
stays authenticating). Post-login mint races are closed by
`auth.mint-bump-not-durable-before-response` plus CAS-null (do not wipe a
newer `acceptSession` token). View-as still does not refresh.

Residual: a query that already exhausted `retry: 1` stays errored until
unmount; RequireAuth navigation unmounts it.
