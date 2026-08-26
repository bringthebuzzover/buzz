---
id: auth.ci-session-restore-flake
title: E2E asserts the next screen before session restore settles; refresh/dev-login are single-shot
kind: test_gap
severity: P2
status: in_progress
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
  auth.ci-session-restore-flake v2). waitForAuthSettled org path fails fast
  on /login. Playwright retries stay 0. Unit tests cover the retry and
  remint. workflow_dispatch e2e_repeat=10 all E2E jobs green. Do not rewrite
  RequireAuth, do not treat all /admin* as a reason to skip refresh, do not
  retry UNAUTHORIZED (that is auth.revoked-access-skips-refresh).
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

## Locked v3 (refresh path symmetry)

Apply the v2 remint pattern to the refresh branch:

1. **Bootstrap refresh branch.** After a successful `refreshAccessToken`,
   if the immediate `/me` is `unauthenticated` (and no Instagram
   reconnect latch), call `refreshAccessToken` once more and re-fetch
   `/me` before falling through to the user / latch branches. Off-dev
   this also runs; a second refresh is a normal server operation and
   cannot escalate privileges (bumping `token_version` only invalidates
   older tokens for this user).
2. **`restoreAdminFromCookie`.** Same remint after the first `/me` is
   unauthenticated. Covers exit-impersonation from the SPA.
3. Two new unit tests in `AuthContext.bootstrap.test.tsx`:
   `refresh + /me revoked → remint + /me user → authenticated` and
   `refresh + double-unauth → failHard`.

Refresh path is not `dev-login`-guarded, so this fix lands in prod
too. Blast radius: one extra `POST /refresh` per bootstrap iff the
first `/me` says `unauthenticated`; capped by
`rate_limited("refresh", 60/60s)`.

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
