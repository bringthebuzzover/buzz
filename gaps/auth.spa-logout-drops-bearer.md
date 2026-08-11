---
id: auth.spa-logout-drops-bearer
title: SPA logout clears Bearer before /logout so cookie-less revoke never runs
kind: authz
severity: P1
status: open
surface: auth
evidence:
  - path: frontend/src/contexts/AuthContext.tsx
    note: logout() setAccessToken(null) then apiLogout()
  - path: frontend/src/api/auth.ts
    note: logout() only sends Authorization if getAccessToken() is set
  - path: backend/app/routes/auth.py
    note: Bearer bump path exists; cookie-less logout returns 200 without bump
  - path: gaps/archive/auth.logout-without-cookie-skips-revocation.md
    note: API fixed; SPA order regresses the intended Bearer revoke path
repro: |
  Log in; clear buzz_refresh (or block cookie); click Logout.
  Observe POST /api/auth/logout has no Authorization and no cookie.
  users.token_version unchanged → other-device refresh still works.
fix_when: |
  SPA preserves access JWT until after /logout succeeds (or sends it
  explicitly), with a regression test. Cookie-absent logout still bumps when
  Bearer is present.
---

# SPA logout drops Bearer before revoke

Security audit 2026-08-11 (areas 1a/1b). Parent-verified.

Backend can revoke via Bearer even when refresh cookie is missing. The SPA
clears the in-memory access token first, so production logout depends only on
the refresh cookie — reopening the hole archived for the API alone.
