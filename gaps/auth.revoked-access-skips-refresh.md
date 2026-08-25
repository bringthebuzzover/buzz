---
id: auth.revoked-access-skips-refresh
title: apiFetch does not refresh on UNAUTHORIZED from token_version rotation
kind: ux_hole
severity: P2
status: open
surface: auth
evidence:
  - path: frontend/src/api/client.ts
    note: interceptor refreshes only on TOKEN_EXPIRED; UNAUTHORIZED is thrown
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

Access JWTs die two ways: clock expiry (`TOKEN_EXPIRED`) and `token_version`
mismatch (`UNAUTHORIZED`, “This session has been revoked”). `apiFetch` only
auto-refreshes the first. Refresh **success** bumps `token_version`, so a
second document (other tab, in-flight navigation, View-as vs admin) that still
holds the previous access token gets UNAUTHORIZED on the next API call and
does **not** call `POST /api/auth/refresh`. TanStack Query retries once
(`retry: 1`) → two console 401s. A full reload often works because the winning
refresh cookie was intentionally **not** cleared on ver-mismatch (see refresh
docstring).

`apiFetch` on TOKEN_EXPIRED + failed refresh also `setAccessToken(null)`
without updating `AuthContext`, so `status === "authenticated"` can remain true
with a null bearer; the next query is UNAUTHORIZED with no interceptor refresh.

The `/api/orgs/me` 401 pair is this path on the org profile query, not an
endpoint bug (`CurrentOrg` would 403 on wrong role). Independent of
`spa.csp-blocks-gh-pages-inline`.
