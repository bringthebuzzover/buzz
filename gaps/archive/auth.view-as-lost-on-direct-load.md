---
id: auth.view-as-lost-on-direct-load
title: View as dies on a full reload and the intent cookie is not bound to the session
kind: authz
severity: P1
status: fixed
closed_in: 4f054d9
surface: admin
evidence:
  - path: backend/app/security/jwt.py
    note: view_as intent carries imp_ver and an exp fixed at the first mint
  - path: backend/app/security/view_as.py
    note: refresh rebinds imp_ver and keeps the remaining lifetime
  - path: backend/app/routes/admin.py
    note: resume matches the page role and does not rewrite the cookie
  - path: backend/app/routes/auth.py
    note: a dead refresh credential clears the intent cookie
  - path: frontend/src/contexts/AuthContext.tsx
    note: failHard ends the intent; bootstrap resumes only for the page role
  - path: frontend/src/pages/auth/BrandSetupPage.tsx
    note: a signed-in invitee with a token still sees the setup form
  - path: backend/tests/test_admin_impersonation.py
    note: bad signature, expiry, deactivated target, readonly, version mismatch
repro: |
  Admin View as an org, then load /org or /campaigns directly (or a new tab).
  Before the intent cookie, the page showed "Restoring your session…" and
  sent the admin to /login. View as a brand and open /brand/setup with no
  invite token dumped the public home. A cookie without imp_ver would still
  remint after the admin session was revoked, and resume rewrote exp.
fix_when: |
  A full load remints only for the same admin, the same token_version, and
  the page's portal role, inside the original 8h. A bad, expired, or
  mismatched cookie is 401 and cleared. Logout, a dead refresh, and a hard
  session failure clear it. A resumed token cannot mutate. /brand/setup
  still shows the invite form when the visitor is signed in and holds the token.
---

Full reloads and direct URLs had no durable View-as intent: the access token
is memory-only, and the same-tab latch does not exist in a new tab. `/campaigns`
was not treated as an org page, and `/brand/setup` redirected every
authenticated visitor, including a real invitee.

The httpOnly `buzz_view_as` cookie is not a bearer. Resume still requires the
admin access token. `imp_ver` must match the admin `token_version` after
refresh rebinds it; resume does not slide the 8h cap. This is a different
hole from `auth.view-as-remint-fails-after-reload` (latch retry after a
refresh 401).
