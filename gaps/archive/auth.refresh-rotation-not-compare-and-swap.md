---
id: auth.refresh-rotation-not-compare-and-swap
title: A superseded refresh cookie can still bump token_version and revoke the winner
kind: invariant_break
severity: P3
status: fixed
surface: auth
evidence:
  - path: backend/app/services/auth.py
    note: issue_token_pair(expected_version=...) raises StaleRefreshToken under FOR UPDATE
  - path: backend/app/routes/auth.py
    note: /refresh passes cookie ver; 401 without Set-Cookie on stale
repro: |
  Two refreshes with the same cookie (`ver = V`):
  1. Both pass the unlocked ver check.
  2. A takes FOR UPDATE, bumps to V+1, commits, 200.
  3. B takes the lock, reloads V+1, mismatches expected_version, 401, no bump.
fix_when: |
  Rotation is compare-and-swap: `/refresh` re-validates the presented `ver`
  after acquiring the row lock and 401s without bumping when it has been
  superseded, so a stale credential can never revoke the winner and the
  surviving cookie is always the valid one.
---

# Refresh rotation is not compare-and-swap

Fixed: `issue_token_pair(..., expected_version=)` re-checks under `FOR UPDATE`.
`/refresh` passes the cookie's `ver`. Login-style mints leave `expected_version`
unset so a new session still revokes outstanding ones.

Residual: jobs / on-login IG clears already commit on their own sessions.
