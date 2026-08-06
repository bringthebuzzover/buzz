---
id: auth.expired-ig-token-reconnect
title: Expired Instagram token needs org reconnect UX
kind: ux_hole
severity: P1
status: fixed
closed_in: 5eb38df
surface: auth
evidence:
  - path: backend/app/services/instagram_token.py
    note: maybe_refresh_on_login raises INSTAGRAM_TOKEN_EXPIRED when remaining <= 0; clock-expiry leaves ciphertext (unlike undecryptable clear)
  - path: backend/app/deps/auth.py
    note: get_current_user runs IG gate on every authenticated request (not just login); impersonation skips it
  - path: backend/app/jobs/token_refresh.py
    note: cron window is still-valid only (now < expires_at < now+14d); already-expired never selected
  - path: frontend/src/api/client.ts
    note: apiFetch only special-cases Buzz TOKEN_EXPIRED; INSTAGRAM_TOKEN_EXPIRED is rethrown
  - path: frontend/src/api/auth.ts
    note: fetchMe treats any post-refresh 401 as unauthenticated — ignores error.code
  - path: backend/app/services/auth.py
    note: Instagram OAuth callback overwrites long-lived token — self-heal without admin clear
  - path: backend/app/jobs/metric_sync.py
    note: skips expired orgs (skipped_token); live metrics silent until reconnect
repro: |
  SQL: UPDATE users SET instagram_token_expires_at = now() - interval '1 hour'
  WHERE id = '<org-user-uuid>' AND portal_role = 'org';
  UI cold start: hard-refresh → Restoring… → /login with no reconnect copy.
  Mid-session: stay without reload → org API calls fail while AuthContext can
  stay authenticated.
  Self-heal: Continue with Instagram → OAuth overwrites token → portal works.
  Cron: token_refresh does not select that user.
fix_when: |
  Cold start: refresh cookie OK + GET /api/auth/me → INSTAGRAM_TOKEN_EXPIRED
  lands the org on /reconnect-instagram (not silent /login), with reconnect
  framing and an Instagram OAuth CTA.
  Mid-session: apiFetch on INSTAGRAM_TOKEN_EXPIRED hard-navigates to
  /reconnect-instagram (AuthContext does not stay authenticated+broken).
  fetchMe returns a distinct MeResult for INSTAGRAM_TOKEN_EXPIRED (never
  collapses it to unauthenticated); AuthStatus includes
  needs_instagram_reconnect; RequireAuth / LoginPage route there.
  Clock-expiry in maybe_refresh_on_login clears IG ciphertext + bumps
  token_version (parity with undecryptable) in a dedicated session before
  raising INSTAGRAM_TOKEN_EXPIRED.
  sessionStorage latch buzz.instagramReconnect preserves reconnect framing
  across bootstrap after the version bump; /reconnect-instagram stays usable
  with status idle/error/needs_instagram_reconnect and never calls
  authenticated APIs (no hard-nav loop).
  pending_email_verification orgs see the same CTA; post-OAuth
  InstagramCallbackPage setAccessToken + hard-nav /org/browse, then
  RequireStatus lands them on /onboarding/verify-email. Impersonation
  IG-gate skip unchanged.
  Admin expired-bucket / org-detail copy no longer claims total auth
  impossibility or that Clear is required to reconnect; DEPLOYMENT.md states
  token_refresh cannot resurrect already-expired tokens.
  Unit/API/FE acceptance checklist in "## Locked v1 fix" all green.
---

## Problem

When an org’s Instagram long-lived token is past `expires_at`, every
`get_current_user` call raises `INSTAGRAM_TOKEN_EXPIRED` (401). Meta cannot
refresh already-expired tokens; cron only covers still-valid tokens within
14 days of expiry. Live metric sync skips those orgs.

The SPA does **not** branch on this code: `apiFetch` only auto-handles Buzz
`TOKEN_EXPIRED`, and `fetchMe` collapses any 401 into generic unauthenticated
→ silent `/login` bounce (or mid-session authenticated + broken queries).
Login copy never says “reconnect Instagram.”

## Contradicts prior framing

**Not a hard lockout with no self-serve path.** Unauthenticated Instagram
OAuth login/callback already overwrites the token and restores access —
admin `clear-instagram-token` is an **ops assist** (null ciphertext, bump
`token_version`), not a prerequisite for reconnect. Admin UI copy that says
orgs “cannot authenticate at all” / must Clear to reconnect overclaims.

Also: the raise is on **every** authenticated request via `get_current_user`
(including `/me`), not on the Instagram login route itself.

## Failure modes

| Mode | Behavior |
|---|---|
| Cold start | Refresh cookie OK → `/me` 401 IG → `/login`, no reconnect framing |
| Mid-session | `apiFetch` rethrows; AuthContext may stay authenticated; queries fail until reload |
| Jobs | `token_refresh` skips; `metric_sync` `skipped_token` — metrics silent |
| Onboarding | pending_email_verification + expired IG blocks authenticated resend until OAuth |
| Impersonation | Admin View-as skips IG gate — can still diagnose |

**Window asymmetry:** on-login refresh net = 30 days; cron = 14 days. Active
logins are safer than inactive cron-only orgs.

## Severity

Keep **~P1** for UX + live-metric silence. Not “impossible to reconnect.”
Downgrade to P2 only if rare + generic login CTA is accepted as enough and
mid-session broken-authenticated state is tolerated. Do not drop below P2
while that mid-session hole remains.

## Locked v1 fix

Ship as one change set. No dual options below.

### 1. Auth state machine (FE)

**Files:** `frontend/src/api/auth.ts`, `frontend/src/api/client.ts`,
`frontend/src/contexts/AuthContext.tsx`,
`frontend/src/components/routing/RequireAuth.tsx`,
`frontend/src/pages/auth/LoginPage.tsx`, new page + route (see §2).

**Constants**

- Error code (already exists BE): `INSTAGRAM_TOKEN_EXPIRED`
- sessionStorage key: `buzz.instagramReconnect` (`"1"` when set)
- New `MeResult` variant: `{ kind: "instagram_reconnect" }`
- New `AuthStatus`: `"needs_instagram_reconnect"`

**`fetchMe` (`frontend/src/api/auth.ts`)**

1. On every `/api/auth/me` 401, parse the envelope `error.code` **before**
   deciding refresh vs logout.
2. If `code === "INSTAGRAM_TOKEN_EXPIRED"`:
   - `sessionStorage.setItem("buzz.instagramReconnect", "1")`
   - return `{ kind: "instagram_reconnect" }`
   - **Do not** treat as `"unauthenticated"`. **Do not** refresh-and-retry
     hoping IG recovers (Meta cannot).
3. If `code === "TOKEN_EXPIRED"` (Buzz access JWT): keep today’s
   refresh-once-and-retry path (unchanged).
4. After a successful refresh retry, if the second `/me` is still 401 with
   `INSTAGRAM_TOKEN_EXPIRED`, same as step 2.
5. Any other definitive 401 → `"unauthenticated"` (unchanged).
6. 5xx / network → `"error"` (unchanged).

**`apiFetch` (`frontend/src/api/client.ts`) — mid-session path**

1. Keep Buzz `TOKEN_EXPIRED` → refresh → replay (unchanged).
2. **New:** if `ApiError.code === "INSTAGRAM_TOKEN_EXPIRED"`:
   - `sessionStorage.setItem("buzz.instagramReconnect", "1")`
   - `setAccessToken(null)`
   - hard-navigate `window.location.href = "/reconnect-instagram"`
     (same “no Router import” pattern as `endImpersonation` in `auth.ts`)
   - rethrow (page unload follows)
3. Do **not** attempt Buzz access-token refresh for this code.

**`AuthContext` (`frontend/src/contexts/AuthContext.tsx`) — cold-start path**

1. Extend `AuthStatus` with `"needs_instagram_reconnect"`.
2. Helper `enterInstagramReconnect()`:
   - `setAccessToken(null)`; clear `user`; `setStatus("needs_instagram_reconnect")`.
3. Bootstrap / `applyMeResult` / `refreshUser` / `retryRestore`:
   - on `me.kind === "instagram_reconnect"` → `enterInstagramReconnect()`.
4. **Post-clear bootstrap (version bump):** after BE clears + bumps
   `token_version`, the refresh cookie is dead. Bootstrap after refresh
   **fails**: if `sessionStorage.getItem("buzz.instagramReconnect") === "1"`
   → `enterInstagramReconnect()` (do **not** `failHard` to generic `"error"`
   and dump to `/login`). Latch path is the correct recovery.
5. `onAuthRoute()`: treat `/reconnect-instagram` like `/login` (skip
   auto `devLogin`).
6. Clear the latch on:
   - **Required:** `InstagramCallbackPage` success path (immediately after
     `setAccessToken`, before `window.location.href = "/org/browse"`) —
     org OAuth never calls `acceptSession`.
   - Also: `acceptSession` (brand/admin) and `logout`.
   - `sessionStorage.removeItem("buzz.instagramReconnect")`.
7. `login()` unchanged — still `GET ${API_BASE}/api/auth/instagram/login`.

**Files also:** `frontend/src/pages/auth/InstagramCallbackPage.tsx` (latch clear).

**`RequireAuth` / `LoginPage` — cold-start Navigate (not hard-nav)**

- If `status === "needs_instagram_reconnect"` →
  `<Navigate to="/reconnect-instagram" replace />`
  (RequireAuth: before generic `/login`; LoginPage: never show “Join or
  sign in” for this state).

#### Entry-path split (both OK — no double-bounce)

| Entry | Mechanism | Who navigates |
|---|---|---|
| Cold start / bootstrap `/me` | `MeResult` → status `needs_instagram_reconnect` → React `<Navigate>` | `RequireAuth` / `LoginPage` |
| Mid-session org API | `apiFetch` hard-nav `window.location.href` | `client.ts` |

Both set the same latch and land on the same public page. **Anti-loop rule:**
`ReconnectInstagramPage` (and any layout it sits under for this visit) must
**not** call `apiFetch` / authenticated hooks / `refreshUser` / `/me` polls.
Only `login()` (full document nav to Instagram OAuth) and static links.
Otherwise a stuck bearer could re-trigger hard-nav in a loop. Bootstrap’s
own `fetchMe` may still run once on remount after hard-nav — that is fine
(returns `instagram_reconnect` or latch path); the **page itself** must not
issue further authenticated fetches.

### 2. UX surface — dedicated route only

**Pick for v1:** dedicated public route `/reconnect-instagram`.
**Not** a modal. **Not** a `/login?reason=…` variant.

**Wire-up**

- New page: `frontend/src/pages/auth/ReconnectInstagramPage.tsx`
- Register in `frontend/src/AppRoot.tsx` next to `login` (public,
  under `SiteLayout`, **no** `RequireAuth`).
- **Must render with status `idle`, `error`, or `needs_instagram_reconnect`**
  (and during `authenticating` bootstrap): show the same H1 + CTA. Do
  **not** gate the CTA on `status === "needs_instagram_reconnect"` only —
  post-bump hard-nav remounts often land as `idle`/`error` until latch
  bootstrap finishes; the page must stay usable either way.
- **No authenticated fetches** on this page (see anti-loop rule above).

**Copy outline (lock wording intent; exact punctuation flexible)**

- **H1:** Reconnect Instagram
- **Body:** Your organization’s Instagram connection expired. Buzz can’t
  refresh an already-expired token — reconnect with the organization’s
  Instagram Business or Creator account to restore portal access.
- **Primary CTA:** Reconnect with Instagram → `login()`
  (`data-testid="reconnect-instagram-cta"`)
- **Secondary:** Back to home → `<Link to="/">` (do not require logout API
  success; do not call `apiLogout` unless already best-effort and
  non-blocking — prefer plain link to avoid authenticated `/logout`)
- **Optional footer line:** Brands use Brand login — link `/brand/login`
  (same affordance as `/login`, keep for consistency)

#### Onboarding (`pending_email_verification`) + expired IG

Same surface — **no special reconnect variant**:

1. Still show the full reconnect page + **same Instagram OAuth CTA**
   (expired IG blocks authenticated resend; OAuth is the unlock).
2. **Post-OAuth landing:** existing `InstagramCallbackPage` —
   `setAccessToken` + `window.location.href = "/org/browse"` (not
   `acceptSession` / not `pathForUser`). `RequireAuth` → `RequireStatus`
   then forwards `pending_email_verification` to `/onboarding/verify-email`
   (`landing.ts` / `RequireStatus`). Do **not** rewrite the callback to
   call `acceptSession` for this gap.
3. Clear latch on Instagram callback success (same as active orgs). No
   extra onboarding branch in the reconnect page.

#### Impersonation / admin View-as — unchanged

- `get_current_user` continues to **skip** `maybe_refresh_on_login` when
  `impersonated_by` is set (diagnose expired orgs).
- Do **not** send impersonation sessions through `/reconnect-instagram` or
  the latch. No FE changes to View-as / `endImpersonation` for this gap.

**Post-OAuth (all org statuses):** existing `/auth/instagram/callback` —
`setAccessToken` + `/org/browse` + **mandatory latch clear** on that
success path; status-specific landing via RequireStatus (active → feed,
`pending_email_verification` → verify-email, etc.). No other special
callback branch.

### 3. Backend clear-on-expiry — IN for v1

**File:** `backend/app/services/instagram_token.py` → `maybe_refresh_on_login`.

When `remaining <= timedelta(0)` (clock-expiry), **do not** only raise.
Match the undecryptable path:

1. In a **dedicated** `async_session_factory()` session (request `get_db`
   rolls back on the 401): load user, call
   `clear_unusable_instagram_token(row)` (nulls
   `instagram_access_token` / issued / expires / refreshed; **bumps
   `token_version`** via default `bump_session=True`), `commit`.
2. Also `clear_unusable_instagram_token(user)` on the in-memory request user.
3. Then raise `BuzzAPIException(code=INSTAGRAM_TOKEN_EXPIRED, …, 401)` with
   the existing message.

**Do not** change the raise code or status. **Impersonation skip unchanged**
(see §2). Admin `clear_org_instagram_token` stays as ops assist (same field
clears + bump).

### 4. Admin copy + DEPLOYMENT — IN for v1

Minimal string/doc edits only (no new admin features).

| Location | Change |
|---|---|
| `frontend/src/components/admin/labels.ts` → `TOKEN_BUCKET_META.expired.note` | Replace “cannot authenticate at all…” with: authenticated org requests return `INSTAGRAM_TOKEN_EXPIRED` until the org reconnects via Instagram OAuth; `token_refresh` will not retry already-expired tokens. |
| `frontend/src/components/admin/labels.ts` → `verification_blocked_by_ig.note` | Keep “rejects every request including resend”; add that org self-serve reconnect is `/reconnect-instagram` / Instagram OAuth (Clear is optional ops assist). |
| `frontend/src/pages/admin/AdminOrgDetailPage.tsx` ErrorNote | Stop saying Clear is required to authenticate. State: portal API rejects with `INSTAGRAM_TOKEN_EXPIRED`; nightly refresh will not retry; org reconnects via Instagram OAuth; Clear IG token is optional ops assist (null ciphertext + revoke sessions). |
| `frontend/src/pages/admin/AdminHealthPage.tsx` IG tokens description | Align with above (no “cannot authenticate” absolute). |
| `DEPLOYMENT.md` cron-token-refresh blurb | Add one sentence: `refresh_due_tokens` only selects still-valid tokens with `now < expires_at < now+14d`; already-expired tokens are never selected and cannot be Meta-refreshed — org must OAuth reconnect (`/reconnect-instagram`). |

Also fix `PIPELINE_META.token_refresh.inference` if it still implies cron should have healed already-expired rows — point at the expired-bucket / reconnect path instead.

### 5. Explicit OUT of scope for v1

- Modal / drawer / toast-only reconnect UX
- `/login?reason=instagram_expired` (or any login-page variant) as the
  primary surface
- Email / push / in-app warning **before** expiry
- Changing on-login 30d vs cron 14d refresh windows
- Teaching `token_refresh` / Meta to refresh already-expired tokens
  (impossible)
- Changing `metric_sync` `skipped_token` behavior beyond what reconnect
  restores
- Brand or admin portal reconnect flows
- Changing impersonation IG-gate skip (must remain skip — see §2)
- New admin “force reconnect email” tooling
- OpenAPI / product marketing copy beyond the admin + DEPLOYMENT rows above

### 6. Acceptance tests checklist

**Backend (API / unit)**

- [ ] `test_on_login_raises_when_expired` (or successor): clock-expiry raises
      `INSTAGRAM_TOKEN_EXPIRED` **and** persists null IG ciphertext +
      incremented `token_version` (assert DB row after call via dedicated
      session / `db_session`).
- [ ] Undecryptable path still clears + raises (no regression).
- [ ] Sub-day remaining still enqueues refresh, does **not** clear/raise.
- [ ] `refresh_due_tokens` still skips `expires_at <= now` (candidate count 0).
- [ ] `GET /api/auth/me` with valid Buzz JWT + clock-expired IG → 401
      envelope `error.code === "INSTAGRAM_TOKEN_EXPIRED"`.
- [ ] After that response, a second `/me` with the **same** access JWT →
      401 unauthorized / revoked (version bump), not a silent 200 with
      empty IG.
- [ ] Impersonation: View-as on an expired-IG org still skips the IG gate
      (existing behavior; no reconnect raise for the admin session).

**Frontend (unit)**

- [ ] `fetchMe`: 401 `INSTAGRAM_TOKEN_EXPIRED` →
      `{ kind: "instagram_reconnect" }` and sets `buzz.instagramReconnect`
      (does not return `unauthenticated`).
- [ ] `fetchMe`: 401 Buzz `TOKEN_EXPIRED` → refresh + retry (unchanged);
      still distinct from IG path.
- [ ] `apiFetch`: `INSTAGRAM_TOKEN_EXPIRED` sets latch, clears access token,
      assigns `window.location.href` to `/reconnect-instagram` (mock
      location); does not call refresh.
- [ ] `AuthContext` bootstrap: `instagram_reconnect` → status
      `needs_instagram_reconnect` (not `error`).
- [ ] `AuthContext` bootstrap: refresh fails + latch set →
      `needs_instagram_reconnect` (not generic login dump without framing).
- [ ] `RequireAuth` / `LoginPage`: `needs_instagram_reconnect` navigates to
      `/reconnect-instagram`.
- [ ] Latch cleared on `InstagramCallbackPage` success (and `acceptSession` /
      logout); stale latch after OAuth must not re-enter reconnect.
- [ ] `ReconnectInstagramPage`: with status `idle` **or** `error` **or**
      `needs_instagram_reconnect`, CTA is visible; page module does not
      import/call `apiFetch` or org/authenticated hooks (static review or
      render test that no authenticated fetch fires).
- [ ] `pathForUser({ status: "pending_email_verification", … })` still
      returns `/onboarding/verify-email` (post-OAuth landing unchanged).

**Frontend (smoke / light E2E if feasible in CI)**

- [ ] `/reconnect-instagram` renders H1 + CTA
      (`data-testid="reconnect-instagram-cta"`) without auth / with no
      session — and does not 401-loop (no authenticated API from the page).
- [ ] Existing Instagram login smoke still passes.

**Manual repro gate (before archive)**

- [ ] SQL expiry repro → cold refresh lands on `/reconnect-instagram` with
      reconnect copy (not silent `/login`) via AuthContext + RequireAuth
      Navigate (no hard-nav required on cold start).
- [ ] Mid-session: with session alive, trip any org `apiFetch` after SQL
      expiry → hard nav to `/reconnect-instagram`; page stable (no reload
      loop).
- [ ] CTA → OAuth → active org portal restored; latch gone.
- [ ] Same CTA path for `pending_email_verification` + expired IG → after
      OAuth lands on `/onboarding/verify-email`.
- [ ] Admin View-as expired org still works (IG gate skipped).

## Recommended fix

Implement **## Locked v1 fix** exactly:

1. **SPA state machine** — distinguish `INSTAGRAM_TOKEN_EXPIRED` in
   `fetchMe` / `apiFetch` / `AuthContext`; status
   `needs_instagram_reconnect`; sessionStorage latch.
2. **Dedicated route** `/reconnect-instagram` with reconnect copy + OAuth CTA.
3. **BE clock-expiry clear** — ciphertext null + `token_version` bump
   (undecryptable parity) before raise.
4. **Admin + DEPLOYMENT copy** — remove “cannot authenticate / Clear
   required” overclaims; document cron cannot resurrect expired tokens.

## Plan verification
- verdict: PASS_WITH_NITS (nits amended into Locked v1 — 2026-08-06)
- feasibility: high
- blockers: none
- nits_amended:
  - OAuth path = `setAccessToken` + `/org/browse` + RequireStatus (not
    `acceptSession`/`pathForUser` as primary).
  - Latch clear required on `InstagramCallbackPage` success.
  - Remaining implementer caution: `fetchMe` parse-before-refresh is
    load-bearing with BE `token_version` bump; second-`/me` test needs
    `async_session_factory` harness (see verification body below).
- nits: (historical detail retained below for evidence)

### Historical nit detail (now folded where noted)

  - **OAuth landing mechanism** — **amended** into Locked §2 / onboarding /
    Post-OAuth / checklist.
  - **Latch clear file gap** — **amended** (InstagramCallbackPage required).
  - **`fetchMe` parse-before-refresh is load-bearing with §3.** Today
    `auth.ts:177-189` refreshes on any 401 and collapses a post-refresh
    401 to `unauthenticated` without reading `error.code`. BE clear +
    `token_version` bump (`instagram_token.py` undecryptable pattern
    `103-108`; access/refresh `ver` checks at `deps/auth.py:102-103` and
    (unchanged — still required by Locked §1 step 1).
    `routes/auth.py:292-296`) makes a naive refresh-after-IG-401 lose the
    IG signal (refresh fails → silent `/login`). Plan step §1.1–2 is
    correct and mandatory — miss it and §3 regresses cold-start UX.
  - **Bootstrap / `refreshUser` duplication hazard.** Bootstrap
    (`AuthContext.tsx:182-196`) and `refreshUser` (`240-258`) do **not**
    use `applyMeResult` (`147-163`). Plan says all four paths handle
    `instagram_reconnect`; easy to patch only `applyMeResult` and leave
    bootstrap/`refreshUser` calling `failHard` / `setStatus("error")`.
  - **`onAuthRoute` must include `/reconnect-instagram`.** Stated (§1.5);
    without it, local DX auto-`devLogin` on that path
    (`AuthContext.tsx:202-214`) can mint a seeded session over the latch.
  - **Second-`/me` acceptance test vs test harness.** Claim “same access
    JWT → revoked (version bump)” is prod-correct, but
    `async_session_factory()` commits on the module engine while
    `app_client` uses rolled-back `db_session` (`conftest.py:217-227`).
    Uncommitted fixture rows are invisible to the dedicated session →
    clear/bump may no-op in naive API tests; assert persistence with the
    existing `engine.dispose()` + `async_session_factory` commit/cleanup
    pattern (`test_jobs.py:772-803`), not vanilla `db_session` alone.
    Current `test_on_login_raises_when_expired` (`test_jobs.py:467-474`)
    has no DB and must become a successor.
  - **Secondary “Back to home” leaves latch set** (by design: plain
    `<Link to="/">`). Harmless if reconnect page stays usable under
    `idle`/`error`; Header “Login” → `/login` must Navigate to reconnect
    (§1 RequireAuth/LoginPage) or framing is lost.
  - Admin/DEPLOYMENT string targets exist (`labels.ts:146-162`,
    `AdminOrgDetailPage.tsx:135-141`, `DEPLOYMENT.md:108`);
    `PIPELINE_META.token_refresh.inference` still implies cron should
    have healed expiry — plan correctly flags it.
- notes: Locked plan matches auth architecture: dedicated-session clear
  is required (`get_db` rolls back on 401 — `deps/db.py:42-44`) and
  already proven by undecryptable (`instagram_token.py:103-108`);
  entry-path split (SPA Navigate vs `apiFetch` hard-nav) and anti-loop
  rule (no authenticated fetches on reconnect page; `SiteLayout` /
  `SiteHeader` are safe) are sound; impersonation IG-gate skip
  (`deps/auth.py:143-144`) unchanged; `pathForUser` pending-email landing
  already correct. No impossible steps or missing public APIs. Highest
  implementation risk is coupling §3 bump with §1 code-aware `fetchMe`
  plus explicit OAuth latch clear outside `acceptSession`.
