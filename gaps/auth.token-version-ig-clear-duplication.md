---
id: auth.token-version-ig-clear-duplication
title: token_version bump and IG token clear are copy-pasted across services
kind: dead_code
severity: P2
status: deferred
surface: auth
evidence:
  - path: backend/app/services/instagram_token.py
    note: clear_unusable_instagram_token already clears ciphertext + optional bump
  - path: backend/app/services/auth.py
    note: revoke_instagram_authorization re-implements the same field nulls + bump
  - path: backend/app/services/admin.py
    note: clear_org_instagram_token duplicates the clear+bump block; deny paths inline bump
  - path: backend/app/routes/auth.py
    note: logout / refresh paths inline (user.token_version or 0) + 1
  - path: backend/app/services/password_reset.py
    note: another inline bump on consume
repro: |
  Grep `token_version = (user.token_version or 0) + 1` and IG field nulls under
  backend/app — multiple independent copies; a future revocation path can miss
  a field or skip the bump.
fix_when: |
  Single bump_token_version(user) helper used by logout, refresh rotate, deny,
  password-reset consume, and IG clear paths. IG ciphertext clears (admin clear,
  Meta deauthorize, undecryptable/expiry) go through clear_unusable_instagram_token
  (or a thin wrapper) so field set + bump stay one SOT. Existing tests for
  revocation / reconnect stay green; no behavior change for clients.
---

## Context (SOT/DRY audit)

Internal DRY debt from the SOT/DRY audit — **not** a user-visible bug today.
Parked so agents do not auto-execute; un-park only when named explicitly.

### Locked v1 (when un-parked)

1. Add `bump_token_version(user: User) -> int` (e.g. in `app/services/auth.py` or
   a tiny `app/security/session.py`) that does
   `user.token_version = (user.token_version or 0) + 1` and returns the new ver.
2. Replace every inline bump under `backend/app` (routes + services) with that
   helper — tests may keep literals.
3. Route `revoke_instagram_authorization` and `clear_org_instagram_token` through
   `clear_unusable_instagram_token` (already supports `bump_session`) instead of
   re-nulling the four IG columns + bump by hand.
4. Non-goals: no JWT claim changes; no new admin UX; no OpenAPI change.

### Out

- Email DEV console DRY, schema validator DRY, OpenAPI typed responses (separate
  gaps / not tracked).
- Intentional stage-list splits (metric vs autolink mint).
