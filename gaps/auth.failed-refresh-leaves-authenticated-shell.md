---
id: auth.failed-refresh-leaves-authenticated-shell
title: apiFetch failed refresh nulls the bearer but leaves AuthContext authenticated
kind: ux_hole
severity: P3
status: open
surface: auth
evidence:
  - path: frontend/src/api/client.ts
    note: TOKEN_EXPIRED / UNAUTHORIZED + failed refresh only setAccessToken(null)
  - path: frontend/src/contexts/AuthContext.tsx
    note: status can stay authenticated while getAccessToken() is null
  - path: gaps/archive/auth.revoked-access-skips-refresh.md
    note: failHard from apiFetch dumped CI E2E to /login; reverted after stress ×20 on 5ae043a
repro: |
  Authenticated session; expire access JWT; fail POST /api/auth/refresh (no cookie).
  apiFetch throws; in-memory bearer is null; RequireAuth still sees authenticated
  until a later fetchMe/bootstrap. Queries 401 with no interceptor (no bearer).
fix_when: |
  Dead cookie after a settled authenticated session signs the SPA out without
  treating login/bootstrap 401 races as logout. Stress E2E must not bounce
  successful logins to /login or /admin/login.
---

# Failed refresh leaves authenticated shell

`auth.revoked-access-skips-refresh` recovered tab-rotation by refreshing on
`UNAUTHORIZED`. Wiring that path to `failHard` made mint/bootstrap races look
like logout (stress run 33182423851, 5/20 shards). Interceptor no longer
notifies AuthContext.

The original zombie state remains: `status === "authenticated"` with a null
bearer. Reload/bootstrap still recovers when the cookie is valid.
