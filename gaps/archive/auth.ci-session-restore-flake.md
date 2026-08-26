---
id: auth.ci-session-restore-flake
title: E2E asserts the next screen before session restore settles; refresh/dev-login are single-shot
kind: test_gap
severity: P2
status: fixed
closed_in: e429c7a
surface: auth
evidence:
  - path: frontend/e2e/guards.spec.ts
    note: Asserts heading 403 immediately after goto; RequireAuth still shows Restoring while bootstrap runs
  - path: frontend/e2e/admin.spec.ts
    note: Reload/exit expect Overview without waiting for restore; flake lands on /admin/login or stuck authenticating
  - path: frontend/e2e/org.spec.ts
    note: Desktop-nav test looks for My Campaigns before Org Portal chrome exists
  - path: frontend/src/components/routing/RequireAuth.tsx
    note: authenticating/idle → Restoring your session…; tests look through that at Overview/403/nav
  - path: frontend/src/api/auth.ts
    note: refreshAccessToken and devLogin are one attempt; catch returns false/null with no retry
  - path: frontend/src/api/auth.ts
    note: fetchMeWithRetry already retries /me on kind error; refresh/dev-login have no equivalent
  - path: frontend/src/contexts/AuthContext.tsx
    note: onAuthRoute is any /admin* so failed admin refresh never falls back to dev-login
  - path: frontend/playwright.config.ts
    note: retries 0 by design; stress is the flake detector
repro: |
  Push to main or workflow_dispatch CI. 2026-08-25 dd0dcb9 run 32892971766
  failed guards.spec 403 heading (10s). Stress ×10 run 32893559065: 7 pass / 3
  fail. Failures: admin.spec session survives reload (URL /admin/login or
  Overview missing on /admin); admin View as exit Overview missing; org.spec
  My Campaigns not visible at 1280 (guest header). Same family on docs-only
  0aaa92d. Local ci-local often green (faster machine, warm webpack).
fix_when: |
  E2E waits for settled auth (Restoring gone) before Overview / 403 / persona
  nav. refreshAccessToken and devLogin retry once on thrown network errors
  only (not 401/4xx). After successful devLogin, if immediate /me is
  unauthenticated, remint once via a second devLogin (dev-only;
  auth.ci-session-restore-flake v2). POST /api/auth/refresh returns the same
  UserResponse as /me in the same transaction; bootstrap +
  restoreAdminFromCookie + retryRestore consume the returned user and skip
  the follow-up /me on the refresh path — closing the mint-then-read race
  window structurally (v4). Same for POST /api/admin/impersonate (already
  returns user; resumeImpersonation now consumes it). waitForAuthSettled org
  path fails fast on /login. Playwright retries stay 0. Unit tests cover the
  retry and same-transaction-user paths. workflow_dispatch e2e_repeat=10 all
  E2E jobs green. Do not rewrite RequireAuth, do not treat all /admin* as a
  reason to skip refresh, do not retry UNAUTHORIZED (that is
  auth.revoked-access-skips-refresh).
---

# CI session restore flakes (tests + one-shot refresh)

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
