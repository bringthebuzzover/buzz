---
id: auth.deauthorize-userid-mismatch-noop
title: Deauthorize can return ok while leaving the token live
kind: silent_loss
severity: P2
status: fixed
closed_in: c672f49
surface: auth
evidence:
  - path: backend/app/services/auth.py
    note: OAuth stores Graph /me profile.id only; short.user_id unused; revoke no-ops unknowns with ok:true
repro: |
  Unknown Meta deauthorize user_id → route returns {ok:true}, token remains.
  Successful revoke still leaves access JWT valid until TTL.
fix_when: |
  Deauthorize matches Meta's user_id reliably; mismatches are not silent ok; successful revoke invalidates access appropriately.
---

OAuth persists only Graph `/me` `profile.id` as `instagram_user_id`. The token-
exchange `user_id` is never stored. `revoke_instagram_authorization` no-ops
unknowns and the route still returns `{ok: true}` (Instagram Login `user_id` and
`/me.id` usually align, so mismatch is uncommon but still silent). On a successful
match, access JWTs still work until TTL and `/me` can still show
`instagram_username` with a null token.
