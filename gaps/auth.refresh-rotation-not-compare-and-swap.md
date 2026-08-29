---
id: auth.refresh-rotation-not-compare-and-swap
title: A superseded refresh cookie can still bump token_version and revoke the winner
kind: invariant_break
severity: P3
status: open
surface: auth
evidence:
  - path: backend/app/routes/auth.py
    note: /refresh checks cookie `ver` against the row BEFORE issue_token_pair takes the row lock
  - path: backend/app/services/auth.py
    note: issue_token_pair bumps unconditionally once it holds the lock — no re-check of the caller's ver
  - path: backend/app/routes/auth.py
    note: the /refresh docstring documents dual-200 rotation as tolerated, not prevented
repro: |
  Two refreshes with the same cookie (`ver = V`), e.g. an old document's request
  completing after the new document's bootstrap refresh:

  1. A reads the row (V == V, passes), B reads the row (V == V, passes).
  2. A takes `FOR UPDATE`, bumps to V+1, commits, returns 200 (cookie V+1).
  3. B takes the lock, reloads V+1, bumps to V+2, commits, returns 200.
  4. A's just-issued pair is now revoked. Whichever `Set-Cookie` the browser
     wrote last wins, so the surviving cookie may be the loser's.
fix_when: |
  Rotation is compare-and-swap: `/refresh` re-validates the presented `ver`
  after acquiring the row lock and 401s without bumping when it has been
  superseded, so a stale credential can never revoke the winner and the
  surviving cookie is always the valid one.
---

# Refresh rotation is not compare-and-swap

Found while diagnosing
[`auth.mint-bump-not-durable-before-response`](archive/auth.mint-bump-not-durable-before-response.md).
That gap (commit-after-response) fully explains the observed stress failures —
this one is a separate latent hazard in the same code and was **not** needed to
explain them, so it is filed rather than bundled into that fix.

Shape of the fix when it is picked up: give `issue_token_pair` an optional
expected-version guard and have `/refresh` pass the cookie's `ver`; on mismatch
return the existing 401 without bumping and without clearing the cookie. That
turns a double refresh into "one winner, one harmless 401" instead of
"both succeed, winner revoked", and leaves a valid cookie behind so the next
refresh recovers.

Same class, also unfixed: `/logout` and the deny / password-reset paths bump
`token_version` and return before `get_db` commits, so revocation becomes
durable slightly after the client is told it happened. Lower stakes (nobody is
racing to use a credential they were just told is dead) and the deny/reset
handlers write after the bump, so they cannot simply commit in place.
