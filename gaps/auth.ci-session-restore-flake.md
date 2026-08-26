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
  only (not 401/4xx). Playwright retries stay 0. Unit tests cover the retry.
  workflow_dispatch e2e_repeat=10 all E2E jobs green. Do not rewrite
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
