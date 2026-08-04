---
id: auth.logout-without-cookie-skips-revocation
title: Logout without a refresh cookie skips revocation
kind: authz
severity: P2
status: fixed
surface: auth
closed_in: 7911d84
evidence:
  - path: backend/app/routes/auth.py
    note: logout only bumps token_version when refresh cookie decodes
repro: |
  Call POST /api/auth/logout without cookie (or with garbage); response ok; other devices' refresh still valid.
fix_when: |
  Logout always revokes when the caller is known (e.g. access-authenticated bump), even without a refresh cookie.
---

`POST /api/auth/logout` only bumps `token_version` when a decodable refresh cookie
is present. Missing/garbage cookie still returns `{ok: true}` and clears
Set-Cookie, but every outstanding refresh (other devices / stolen copies) stays
valid. Orgs have no password-reset revoke path.
