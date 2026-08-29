---
id: auth.revoked-access-skips-refresh
title: apiFetch does not refresh on UNAUTHORIZED from token_version rotation
kind: ux_hole
severity: P2
status: fixed
closed_in: 5ae043a
surface: auth
evidence:
  - path: frontend/src/api/client.ts
    note: interceptor refreshes TOKEN_EXPIRED and UNAUTHORIZED when a bearer was sent
  - path: backend/app/deps/auth.py
    note: ver mismatch and missing Bearer are UNAUTHORIZED 401, not TOKEN_EXPIRED
  - path: backend/app/routes/auth.py
    note: successful refresh bumps token_version (invalidates other in-memory access JWTs); ver-mismatch refresh 401 does not clear cookie
  - path: frontend/src/index.tsx
    note: QueryClient retry 1 (~1s delay) → two identical 401s in the console
  - path: frontend/src/api/hooks/useOrgHooks.ts
    note: useOrgProfile enabled whenever status === authenticated (no extra bearer check)
repro: |
  Production 2026-08-25 ~15:39Z (admin/org/View-as session): OPTIONS /api/orgs/me 200,
  GET /api/orgs/me 401, GET /api/orgs/me 401 ~1s later, no POST /auth/refresh between
  them. Earlier the same tab-set had POST /auth/refresh 401 (concurrent rotation).
  ~45s later POST /auth/refresh 200 + GET /api/orgs/me 200 (bootstrap/reload).
  Console shows two "Failed to load resource … 401" on api.bringthebuzzover.com/api/orgs/me.
fix_when: |
  After a refresh rotation in another document/tab (or a failed in-flight refresh
  that nulled the memory token), a still-mounted org/brand query recovers by
  refreshing once when the cookie is still valid, or transitions auth to signed-out
  / restore_failed instead of sitting authenticated with a dead bearer.
  TOKEN_EXPIRED path stays. Impersonation must not refresh the admin cookie into
  the target session (existing endImpersonation guard). Tests cover ver-mismatch
  401 → single refresh → replay, and dead-cookie 401 → no retry storm.
---

# Revoked access JWT skips the refresh interceptor

Fixed: `apiFetch` treats `UNAUTHORIZED` like `TOKEN_EXPIRED` when a bearer was
sent (one refresh + replay). View-as clock expiry still ends impersonation;
ver-mismatch during View-as does not (would dump to `/admin`). A newer bearer
installed mid-flight is replayed instead of wiping the login.

`failHard` from `apiFetch` was reverted after stress ×20 (5/20 shards bounced
to login). Residual: [`auth.failed-refresh-leaves-authenticated-shell`](../auth.failed-refresh-leaves-authenticated-shell.md).
