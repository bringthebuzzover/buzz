---
id: auth.revocation-bump-uncommitted-until-teardown
title: Logout, deny, and password-reset bump token_version only when get_db commits
kind: invariant_break
severity: P3
status: open
surface: auth
evidence:
  - path: backend/app/routes/auth.py
    note: logout calls bump_token_version then returns; commit is get_db teardown
  - path: backend/app/services/admin.py
    note: deny org/brand bump then continue writing in the same request
  - path: backend/app/services/password_reset.py
    note: reset bumps then returns; commit is get_db teardown
  - path: backend/app/deps/db.py
    note: FastAPI sends the response before yield-dependency exit code (mint-bump gap)
  - path: gaps/archive/auth.refresh-rotation-not-compare-and-swap.md
    note: Split out of that archive so the residual does not live only in closed prose
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
[`auth.mint-bump-not-durable-before-response`](archive/auth.mint-bump-not-durable-before-response.md):
the response can reach the client before `get_db`'s `session.commit()`.

Lower stakes than mint: nobody is racing to *use* a credential they were just
told is dead. Deny and password-reset also write after the bump, so they cannot
simply commit in the bump helper without splitting the request into two
transactions.

Not in the refresh CAS / zombie-shell commit.
