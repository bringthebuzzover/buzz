---
id: auth.impersonation-unbound-from-admin
title: View-as JWT not bound to admin session; logout with imp Bearer revokes target
kind: authz
severity: P2
status: fixed
closed_in: a32463a
surface: admin
evidence:
  - path: backend/app/services/admin_auth.py
    note: mint stamps ver from target only
  - path: backend/app/deps/auth.py
    note: loads target; never checks admin liveness/token_version
  - path: backend/app/routes/auth.py
    note: logout bumps payload.sub without get_current_user / readonly gate
repro: |
  Admin View-as → hold imp access JWT → admin logout/password-reset in another tab.
  Imp Bearer still works until IMPERSONATION_TOKEN_TTL_MINUTES.
  POST /api/auth/logout with Authorization Bearer <imp> bumps target token_version
  (bypasses readonly).
fix_when: |
  Imp JWT bound to admin ver/liveness (or denylist on admin bump); logout
  refuses impersonation Bearer for target revoke (or ends View-as without
  bumping target); tests cover both.
---

# Impersonation unbound from admin

Security audit 2026-08-11 (areas 1b/3a/3b). Parent-verified. Default readonly
limits write blast; TTL ~15m is backstop.
