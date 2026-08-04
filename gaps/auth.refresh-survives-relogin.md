---
id: auth.refresh-survives-relogin
title: Refresh tokens survive re-login and rotation
kind: authz
severity: P1
status: open
surface: auth
evidence:
  - path: backend/app/services/auth.py
    note: issue_token_pair never bumps token_version
repro: |
  Capture buzz_refresh; login again or refresh cookie; old refresh JWT still validates.
fix_when: |
  Login and refresh bump token_version (or otherwise revoke prior refresh family) so stolen cookies die.
---

`issue_token_pair` mints a refresh JWT with the **current** `token_version` and
never increments it. Login (Instagram / brand / admin / set-password) and
`POST /api/auth/refresh` all call `issue_token_pair` without a bump. A stolen
`buzz_refresh` cookie remains valid across re-login and across refresh cookie
rotation until something else bumps the version (logout-with-cookie, admin deny,
password reset, deauthorize).
