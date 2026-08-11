---
id: auth.logout-clears-cookie-without-revoke
title: POST /logout always Set-Cookie Max-Age=0 even when token_version is not bumped
kind: authz
severity: P1
status: fixed
closed_in: a32463a
surface: auth
evidence:
  - path: backend/app/routes/auth.py
    note: _clear_refresh_cookie always runs; bump only if Bearer or cookie decodes
  - path: backend/app/config.py
    note: REFRESH_COOKIE_SAMESITE=lax — cross-site POST omits cookie
repro: |
  Victim has buzz_refresh on api.bringthebuzzover.com.
  Attacker page cross-site POSTs /api/auth/logout (form/no-cors).
  Lax omits cookie → no bump; response still clears host cookie.
  Stolen refresh JWT (if any) remains valid until another bump.
fix_when: |
  Cookie clear only after successful bump, or require CSRF/double-submit for
  logout; document intentional forced-logout if kept. Test cross-site cookieless
  logout does not clear without revoke (or explicitly accepts that tradeoff).
---

# Logout clears cookie without revoke

Security audit 2026-08-11 (area 1a). Parent-verified code path; exploitability
depends on browser accepting Set-Cookie from the cookieless cross-site response.
