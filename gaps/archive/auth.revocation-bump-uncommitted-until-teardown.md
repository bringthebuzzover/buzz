---
id: auth.revocation-bump-uncommitted-until-teardown
title: Logout, deny, and password-reset bump token_version only when get_db commits
kind: invariant_break
severity: P3
status: fixed
surface: auth
evidence:
  - path: backend/app/security/session.py
    note: commit_revocation persists the bump before the HTTP body is sent
  - path: backend/app/routes/auth.py
    note: logout commits when bumped
  - path: backend/app/services/admin.py
    note: deny org/brand and clear-IG commit after flush, before email
  - path: backend/app/services/password_reset.py
    note: reset commits after used_at + password_hash + bump
  - path: backend/app/services/auth.py
    note: Meta deauthorize commits after clear_unusable
  - path: backend/app/services/admin_erase.py
    note: erase commits after all scrub writes, before email
  - path: backend/app/deps/db.py
    note: FastAPI still sends the response before yield-exit commit
repro: |
  POST /logout (or deny / reset-password) returns 200 while the token_version
  UPDATE is still uncommitted. A request that arrives in that window is still
  validated against the pre-bump row, so the just-revoked credential still
  works until get_db commits.
fix_when: |
  Revocation is durable before the client is told it happened, without
  committing mid-handler on deny/reset paths that still write after the bump.
  Do not reuse issue_token_pair's mint-last commit for these writers.
---

# Revocation bump uncommitted until teardown

Same FastAPI ordering as
[`auth.mint-bump-not-durable-before-response`](auth.mint-bump-not-durable-before-response.md):
the response can reach the client before `get_db`'s `session.commit()`.

Fixed: `commit_revocation` after the last ORM write (not inside
`bump_token_version`, not via `issue_token_pair`). Deny/reset/erase send email
after that commit so SMTP cannot split the txn. Same-class HTTP revokes
(deauthorize, admin clear-IG, erase) got the same helper so a 200 cannot precede
the bump.

Jobs / on-login `clear_unusable_instagram_token` keep their own sessions and
were already committing. Org-profile follower seed that clears a bad IG token
mid-submit still relies on `get_db` teardown (not an HTTP “you are revoked”
response).
