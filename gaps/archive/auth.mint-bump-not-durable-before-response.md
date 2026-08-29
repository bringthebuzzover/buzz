---
id: auth.mint-bump-not-durable-before-response
title: token_version bump is still uncommitted when the mint response reaches the client
kind: invariant_break
severity: P1
status: fixed
surface: auth
evidence:
  - path: backend/app/deps/db.py
    note: get_db commits after `yield`, i.e. in the dependency exit code
  - path: backend/app/services/auth.py
    note: issue_token_pair bumped token_version and only flushed; commit was left to get_db
  - path: backend/app/deps/auth.py
    note: access-token validation compares the JWT `ver` against the committed users row
  - path: frontend/src/api/client.ts
    note: apiFetch nulls the bearer when the recovery refresh also 401s, so the page never recovers
repro: |
  Measured, not inferred:

  1. FastAPI (0.136) sends the response BEFORE a yield-dependency's exit code
     runs. A probe app with `await asyncio.sleep(1)` after `yield` delivered the
     200 to the client 1 ms after the handler returned, with the exit code not
     yet started.
  2. So `POST /api/auth/admin/login` (or `/refresh`) hands the client an access
     token + refresh cookie stamped `ver = V` while the `users.token_version = V`
     UPDATE is still uncommitted.
  3. Any request the client makes inside that window is validated against the
     pre-bump row (`ver = V-1`) and 401s with UNAUTHORIZED
     "This session has been revoked. Please sign in again."

  Observed in E2E stress run 33277143292/33278203837 (shards 2, 12, 14). From
  the Playwright network traces:

      POST /api/auth/admin/login   200
      GET  /api/admin/overview     401 "This session has been revoked"
      POST /api/auth/refresh       401 "This session has been revoked"
      GET  /api/admin/overview     401 "Missing or malformed Authorization header"

  Shard 2 is the tightest: `/refresh` 200 then `POST /impersonate` 401 revoked
  10 ms later. Both the access token and the cookie carry the same uncommitted
  `ver`, so the recovery refresh fails too; apiFetch then nulls the bearer and
  every later request goes out unauthenticated.
fix_when: |
  A token pair is never handed to a client before its token_version bump is
  committed, so a client that immediately uses what it was just given cannot be
  told the session is revoked.
---

# Mint bump not durable before the response

Root cause of the long-running View-as / session-restore stress flakes
(`auth.ci-session-restore-flake` family). Every earlier fix treated the symptom
on the client — retry the remint, refresh on `UNAUTHORIZED`, skip the follow-up
`/me` — because the server looked correct in isolation. It was not: the mint was
not durable at the moment the client was allowed to act on it.

User-visible shape: the authenticated shell renders (sidebar, "Signed in as
admin") while every query fails, e.g. "Could not load the overview." /
"Could not load organizations." Reload recovers, because bootstrap mints again.

Fixed by committing the bump in `issue_token_pair` instead of leaving it to
`get_db`. That also releases the `FOR UPDATE` row lock sooner. The invariant it
imposes on callers: **mint last** — nothing may write after `issue_token_pair`
returns, which every call site already satisfies.

Not covered by this fix, filed separately:

- [`auth.refresh-rotation-not-compare-and-swap`](../auth.refresh-rotation-not-compare-and-swap.md)
  — a superseded refresh can still bump and revoke the winner.
- [`auth.failed-refresh-leaves-authenticated-shell`](../auth.failed-refresh-leaves-authenticated-shell.md)
  — why one transient 401 becomes a permanently broken page.
