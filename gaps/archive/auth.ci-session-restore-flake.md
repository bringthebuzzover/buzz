---
id: auth.ci-session-restore-flake
title: Concurrent token_version bumps lose an increment; next request looks revoked
kind: invariant_break
severity: P2
status: fixed
surface: auth
evidence:
  - path: backend/app/services/auth.py
    note: issue_token_pair used to bump in-memory token_version without locking/reloading the row
  - path: backend/app/deps/auth.py
    note: Access JWT ver must equal users.token_version or 401 revoked
  - path: backend/app/routes/auth.py
    note: Refresh cookie ver mismatch is the same 401, cookie left intact
  - path: frontend/e2e/admin.spec.ts
    note: "the session survives a reload" lands on /admin/login when the just-minted cookie is already stale
  - path: frontend/playwright.config.ts
    note: retries 0 by design; stress is the flake detector
repro: |
  Stress ×10 on c37eb1c run 33172931838 shard 9. admin.spec "session survives
  a reload": POST /admin/login 200 mints access+cookie ver=2; 268ms later
  GET /admin/overview and POST /refresh both 401 "This session has been
  revoked" with the same ver=2. Trace:
  test-results/admin-the-session-survives-a-reload-chromium/trace.zip
fix_when: |
  issue_token_pair SELECT FOR UPDATE + refresh so concurrent mints serialize
  and waiters see the latest row_ver (v6). Version-mismatch branches log
  token_ver vs row_ver. Sequential double-mint unit test. v1–v5 client
  restore helpers stay. Playwright retries stay 0. No RequireAuth rewrite,
  no grace-window rotation, no retry UNAUTHORIZED
  (auth.revoked-access-skips-refresh). Archive bar is still stress ×10.
---

# CI session restore flakes (tests + one-shot refresh)

## Locked v6 (serialize the `token_version` bump)

v4/v5 closed the mint-then-`/me` window. Residual on
[`c37eb1c` stress ×10 run 33172931838](https://github.com/bringthebuzzover/buzz/actions/runs/33172931838)
shard 9: `POST /admin/login` 200 minted access + cookie `ver:2`; 268ms later
`GET /admin/overview` and `POST /refresh` both 401 “This session has been
revoked” with the same `ver:2`. Client did not race `/me`. The row’s
`token_version` had already moved past the just-minted pair — a lost update
when two `issue_token_pair` calls both compute `(old or 0) + 1` from the same
snapshot.

1. **`issue_token_pair` refreshes `FOR UPDATE`** before bumping, so concurrent
   mints serialize and the waiter reloads the latest row version.
2. **Mismatch branches log `token_ver` vs `row_ver`** (access + refresh) so a
   recurrence is diagnosable from CI logs without a Playwright trace.
3. Unit test: two sequential mints produce strictly increasing `ver`.

OUT (unchanged): Playwright `retries`, grace-window rotation, RequireAuth
rewrite, retrying `UNAUTHORIZED`.

---

Access JWT is memory-only. After reload or a cold `goto`, bootstrap must
`POST /api/auth/refresh` (cookie) or, in development on portal routes,
`POST /api/auth/dev-login`. Tests then assert the **destination** screen
(Overview, heading 403, My Campaigns) while `RequireAuth` may still show
“Restoring your session…” or while a single dropped `fetch` has already
`failHard`’d to login.

This is a **broken CI path today**. It is not a PRODUCT “Later” item. Human
prod reload usually works; GitHub Actions E2E on `ubuntu-latest` does not
always.

Sibling (do not merge): [`auth.revoked-access-skips-refresh.md`](auth.revoked-access-skips-refresh.md)
is `apiFetch` skipping refresh on `UNAUTHORIZED` / `token_version`. This gap
is bootstrap + E2E timing and **thrown** refresh/dev-login failures.

## What CI showed (2026-08-25)

[`dd0dcb9` run](https://github.com/bringthebuzzover/buzz/actions/runs/32892971766):
backend + frontend green; E2E failed
`org session is blocked from the brand dashboard (403)` — heading `403` not
found in 10s. New header geometry tests passed.

[`stress ×10`](https://github.com/bringthebuzzover/buzz/actions/runs/32893559065)
(`workflow_dispatch` `e2e_repeat=10`): **7 E2E jobs passed, 3 failed**.
`guards.spec` passed all 10 this round.

| Job | Test | Observed |
| --- | --- | --- |
| 2 | admin session survives reload | URL `http://localhost:3000/admin/login` |
| 2 | org desktop nav at 1280px | `My Campaigns` not visible (guest chrome) |
| 6 | admin session survives reload | URL still `/admin`, Overview never appeared |
| 7 | admin View as / exit | Overview missing after Exit (login heading count 0) |

Docs-only `0aaa92d` already failed the same admin reload + View-as tests.

Local `CI=true npx playwright test --repeat-each=10` (2026-08-25, after
the helper + throw retry): **171 passed / 9 failed**. All 9 were
`org can apply to an open drop` repeats 2–10 — first apply consumed the
seeded open drop; later repeats share that DB. Auth restore / header /
guards were 10/10. That command is **not** the archive bar: GitHub
`e2e_repeat` is N isolated jobs each with its own Postgres.

[`stress ×10` on `4620f47`](https://github.com/bringthebuzzover/buzz/actions/runs/32917060798)
(`[e2e-stress-10]`): **8 E2E jobs passed, 2 failed**. Backend + frontend
green. Original family is gone this round: admin reload, View as / exit,
guards 403, and org desktop nav at 1280 were **10/10**.

| Job | Test | Observed |
| --- | --- | --- |
| 5 | org can apply | `waitForAuthSettled` Org Portal not visible (10s) |
| 5 | org mid-width hamburger | same Org Portal timeout; desktop 1280 passed in this job |
| 1 | org phone chrome | same Org Portal timeout; apply + mid-width passed in this job |

Not a hidden-label / Restoring-count race. Artifacts (all 3):
guest `/login` (“Join or sign in to Buzz”). Network is the same
sequence: `POST /refresh` 401 missing cookie → `POST /dev-login`
**200** (JWT `ver: 3` for seed org `…0002`) → `GET /me` 401
“This session has been revoked” ~15–27ms later → `POST /refresh`
401 revoked (cookie already stale). Something else called
`issue_token_pair` on that user in the gap; this tab’s mint is
dead, `failHard` → `/login`. Sibling
`auth.revoked-access-skips-refresh` is `apiFetch`; here `fetchMe`
*does* refresh and the cookie is already revoked too.

## `[e2e-stress-10]` on `f4364ca` (v2)

[Run 32974819755](https://github.com/bringthebuzzover/buzz/actions/runs/32974819755):
**8/10 jobs green**. v2 remint fully closed the dev-login family — org
apply / mid-width / phone are **10/10**. The race resurfaced on the
symmetric refresh-cookie path we intentionally left out of v2:

| Job | Test | Observed |
| --- | --- | --- |
| 8 | admin session survives a reload | `waitForAuthSettled(admin-overview)` timed out on `/admin/login` |
| 4 | admin View as / exit | `bootstrap fell back to /login` at [`admin.spec.ts:139`](../frontend/e2e/admin.spec.ts) (reload during impersonation) |
| 8 | admin View as / exit | same as above |

Same 15-27 ms token_version race, refresh path: `POST /refresh` mints
admin `ver:N`, then `GET /me` immediately after → 401 revoked because
`user.token_version` has moved past N. `fetchMe`'s internal refresh
retry hits 401 revoked too, `applyMeResult({kind:"unauthenticated"})`
→ `failHard` → `/admin/login`.

## `[e2e-stress-10]` on `112c1f5` (v3)

[Run 32976891708](https://github.com/bringthebuzzover/buzz/actions/runs/32976891708):
still **8/10** — same two admin failures. v3's "refresh once more" was a
no-op for this race:

- `refresh` mints access `ver:N` and rotates cookie to `ver:N`.
- `/me` immediately 401s revoked → `user.token_version` has moved past N.
- `fetchMe`'s internal retry calls `refresh` again with the just-rotated
  cookie `ver:N`; server sees `user.ver > N` → 401 revoked, cookie left
  intact (superseded-rotation policy). Client returns `unauthenticated`.
- v3's extra `refresh` in bootstrap runs a **third** time with the same
  stale cookie → same 401 → same `unauthenticated` → `failHard`.

Dev-login self-heals because it is stateless (mints from the row's
current `token_version`). A stale refresh cookie cannot self-heal:
once the cookie's `ver` trails `user.token_version`, only a fresh
login can revive the session. v3 fundamentally could not fix the
refresh path.

## Locked v4 (same-transaction user in /refresh)

Kill the race window instead of retrying inside it. `POST /api/auth/refresh`
now returns the same `UserResponse` payload that `GET /api/auth/me` would
have returned for the newly minted bearer, built from the same DB
transaction as `issue_token_pair`. Bootstrap consumes that user directly
and skips the follow-up `/me` — there is no window in which
`user.token_version` can drift between mint and read.

1. **Backend `RefreshResponse` gets `user: UserResponse`.**
   [`backend/app/routes/auth.py`](../backend/app/routes/auth.py) `/refresh`
   builds `build_user_response(user)` after `issue_token_pair`. Same
   fields as `/me`. `openapi.json` regenerated. No new auth surface
   (proving cookie ownership already yields `/me` today).
2. **Frontend `refreshAccessToken` stashes `lastRefreshedUser`.**
   [`frontend/src/api/auth.ts`](../frontend/src/api/auth.ts) exposes
   `takeRefreshedUser()` (single-use). Bootstrap, `restoreAdminFromCookie`,
   and `retryRestore` in
   [`frontend/src/contexts/AuthContext.tsx`](../frontend/src/contexts/AuthContext.tsx)
   consume it and only fall back to `/me` when the response lacked user
   (older mocks). The v3 remint code is removed.
3. **`POST /api/admin/impersonate` already returns user** — the SPA now
   consumes it too (`takeImpersonatedUser`) so bootstrap's View-as
   resume no longer calls `/me` on the imp bearer either. Test 6
   (`View as / exit` reload) is covered by the same fix.
4. Tests: backend `test_refresh_valid_cookie_rotates` now asserts
   `data.user.id/portal_role/status`. Two new unit tests replace the
   obsolete v3 pair: bootstrap uses same-transaction user with **zero**
   `/me` calls; falls back to `/me` when user is absent from the
   response.

Security: the response already gives the caller everything they need to
call `/me` themselves; inlining the same payload does not widen the
surface. CSRF posture unchanged (cross-origin can't read the body). Load
cost is one fewer `/me` per bootstrap.

## `[e2e-stress-10]` on `4e02a6b` (v4)

[Run 32985226853 (rerun)](https://github.com/bringthebuzzover/buzz/actions/runs/32985226853):
**9/10 jobs green**. v4 fully closed the admin refresh + View-as / imp
family — admin session survives reload and View-as / exit were **10/10**.
Guards, brand, marketing, join, reconnect, admin queues, sidebar, orgs
detail were all clean. The initial attempt was cancelled at the runner
scheduler during a GitHub Actions Major Outage (2026-08-26 15:11 UTC);
rerun after recovery went 9/10.

Sole remaining failure — same dev-login mint-then-read race that v2
tried to remint through:

| Job | Test | Observed |
| --- | --- | --- |
| 9 | org drop feed renders cards | `bootstrap fell back to /login` at [`authSettled.ts`](../frontend/e2e/authSettled.ts) |

Even with the v2 remint (call `devLogin` twice on immediate `/me`
unauthenticated), the second mint's `/me` also 401s in the failing case
— identical shape to why v3 didn't fix the refresh path.

## Locked v5 (same-transaction user in dev-login bootstrap)

`POST /api/auth/dev-login` already returns `TokenResponse` with
`access_token + user` in the same transaction. Bootstrap was ignoring
that user and calling `/me` — the exact race window v4 killed for
`/refresh`. Symmetric structural fix:

1. **`authUserFromWire` exported** from
   [`frontend/src/api/auth.ts`](../frontend/src/api/auth.ts) — was the
   private `_authUserFromWire` helper.
2. **Bootstrap dev-login branch consumes `dev.user` directly** and skips
   `/me`. Fallback to `fetchMeWithRetry` remains for the (only in tests)
   case where the response lacks user. The v2 remint is removed — it
   couldn't fix the case v5 now sidesteps.
3. Unit tests: replaced the two v2 remint cases with
   `dev-login returns user → bootstrap skips /me` and
   `dev-login without user → /me fallback`.

Same rationale as v4: proving cookie/dev-login response ownership
already yields `/me`; inlining does not widen the surface. Off-dev
`dev-login` 404s so the path never runs in prod. All admin/refresh
paths remain covered by v4.

## Locked v2 (token_version race after dev-login)

Exact race root between mint and `/me` is unproven (pool visibility,
cancelled-but-processed request, etc.). Recovery is clear in
development: a second `dev-login` reads the row’s current
`token_version` and remints.

1. **Bootstrap remint (dev-only).** After a successful `devLogin`, if
   the immediate `/me` is `unauthenticated` (and no Instagram reconnect
   latch), call `devLogin` once more and `/me` again, then
   `applyMeResult`. Still soft-fail on `kind: "error"`; still
   `failHard` if the second `/me` is unauthenticated. Off-dev
   `dev-login` 404s so this path cannot run in prod. Refresh / admin
   cookie bootstrap unchanged (those specs were 10/10 on `4620f47`).
2. **`waitForAuthSettled` org fast-fail.** Race Org Portal vs
   `/login`; if guest login wins, throw with a pointer to this gap
   instead of hanging 10s on Org Portal. Debuggability only — not a
   retry.
3. Unit coverage in `AuthContext.bootstrap.test.tsx`: remint→authenticated
   and double-unauth→error.

Archive bar unchanged: `workflow_dispatch e2e_repeat=10` all green.

## Why

1. **Tests race bootstrap.** `RequireAuth` gates Overview and 403. Persona
   nav (`SiteHeader` `isApiAuth`) is guest until `authenticated`. Specs
   `goto`/`reload`/`exit` then immediately `getByRole`.
2. **Refresh and dev-login are single-shot.** `fetchMeWithRetry` retries
   `/me` on `kind === "error"`. `refreshAccessToken` / `devLogin` `catch`
   return `false`/`null`. One dropped connection → `failHard` → login
   (admin, because `onAuthRoute()` is `p.startsWith("/admin")` and skips
   dev-login) or guest org chrome.
3. **`retries: 0`** is intentional (`TESTING.md`). Do not “fix” by retrying
   the Playwright job.

## Locked v1

Keep Playwright `retries: 0`. Do not rewrite the guard stack. Do not
change PRODUCT.

### 1. E2E settled-auth helper

Add something like `waitForAuthSettled(page)` used by org, admin, and
guards specs:

- Wait until “Restoring your session…” is gone.
- Org journeys: then wait for **Org Portal** (utility bar) or the
  destination already under test — not My Campaigns / 403 while guest.
- Admin reload / View-as exit: then wait for **Overview** *or* a stable
  `/admin/login` (assert which, fail clearly). Do not hang 10s on Overview
  while restoring.
- Guard: wait for heading `403` after org session is attached (Org Portal
  or equivalent), not while bootstrap is in flight.

One helper; do not copy the wait into each test. Header geometry tests
must use it too (that flake was missing org chrome, not overlap).

### 2. One retry on thrown network errors

In `frontend/src/api/auth.ts`:

- `refreshAccessToken`: if the `fetch` **throws** (network), retry **once**.
  `!resp.ok` (401/4xx/5xx) still returns false — not a retry. Do not wipe a
  newer in-flight login token (keep `tokenAtStart` / `refreshInFlight`
  rules in `auth.refresh.test.ts`).
- `devLogin`: same — retry once on throw only; `!resp.ok` stays null.

Add unit tests next to `auth.refresh.test.ts` (throw then success; 401
still one call). Do not retry `UNAUTHORIZED` here.

## Explicit OUT

- `retries: 1` (or any job-level retry) as the fix.
- Expanding `onAuthRoute` so `/admin` (panel) auto `dev-login`s (would
  mint an org on the admin panel).
- Merging this into `auth.revoked-access-skips-refresh`.
- RequireAuth / RequireRole redesign.
- Claiming zero flakes forever; archive bar is stress ×10 green.
