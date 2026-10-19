---
id: auth.creator-logout-keeps-jwt
title: Header logout for a real creator does not revoke the Buzz session
kind: authz
severity: P2
status: fixed
surface: auth
evidence:
  - path: frontend/src/components/site/SiteHeader.tsx
    note: handleSignOut calls creatorSignOut for every non-demo creator and skips useSignOut
  - path: backend/app/routes/auth.py
    note: POST /api/auth/logout bumps token_version and clears the refresh cookie
repro: |
  Sign in with a creator access token (portal_role creator, not the admin demo).
  Click Log out in the header. The browser goes to /for-creators.
  The same Bearer still succeeds on GET /api/creators/me, and the refresh cookie
  is still set. An organization logout on the same header returns 401 afterwards.
fix_when: |
  Log out for a signed-in creator calls the same sign-out as org and brand.
  A later request with the old access token is 401, and the refresh cookie is
  cleared. The admin creator demo still exits to /admin/demo without logging
  the admin out.
---

# Creator logout leaves the JWT

The header treats every creator as the in-memory demo. A real creator click clears that store and navigates away, and never calls `POST /api/auth/logout`.
