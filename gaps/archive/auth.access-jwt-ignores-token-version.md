---
id: auth.access-jwt-ignores-token-version
title: Access JWT survives token_version revocation
kind: authz
severity: P1
status: fixed
surface: auth
closed_in: 7911d84
evidence:
  - path: backend/app/security
    note: create_access_token omits ver; get_current_user never checks version
repro: |
  Logout or admin-deny (bumps token_version); prior Bearer access token still works until ACCESS_TOKEN_TTL_MINUTES.
fix_when: |
  Access tokens stamp and validate `ver` against users.token_version.
---

`create_refresh_token` stamps `ver`; `create_access_token` does not.
`get_current_user` never checks version. Logout / admin deny invalidate refresh
only — a stolen or leftover Bearer access token works until
`ACCESS_TOKEN_TTL_MINUTES`.
