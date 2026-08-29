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
  - path: gaps/archive/auth.mint-bump-not-durable-before-response.md
    note: traces show the zombie shell is what turned one transient 401 into "Could not load the overview." for the rest of the page's life
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

Stress run 33278203837 showed the cost of that state. Once a mint race 401'd one
query and the recovery refresh also 401'd, apiFetch nulled the bearer and every
later request went out with no `Authorization` header at all — the shell stayed
signed in while all data read "Could not load …". The trigger is fixed
(`auth.mint-bump-not-durable-before-response`), so this is now an amplifier
waiting for the next transient failure rather than an active flake source. Note
that a query which has exhausted `retry: 1` stays errored until it remounts, so
recovering the token alone does not repaint the page.
