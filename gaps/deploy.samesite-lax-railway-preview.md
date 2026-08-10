---
id: deploy.samesite-lax-railway-preview
title: SameSite cookie invariant for Railway dual-host (App Review path)
kind: ops
severity: P1
status: ops
surface: deploy
evidence:
  - path: backend/app/config.py
    note: code default REFRESH_COOKIE_SAMESITE=lax; Secure fail-fast off-dev
  - path: backend/app/routes/auth.py
    note: buzz_oauth_state + buzz_refresh both use REFRESH_COOKIE_SAMESITE; missing state → 401
  - path: frontend/src/pages/auth/InstagramCallbackPage.tsx
    note: credentialed POST to API callback — cross-site XHR needs SameSite=none on *.up.railway.app
  - path: META.md
    note: App Review strategy = Railway SPA + Railway API (PSL → cross-site); host SOT
  - path: DEPLOYMENT.md
    note: only Railway env is production; no separate preview/staging; target www+api same eTLD+1
repro: |
  Cross-site + lax (broken): SPA frontend-….up.railway.app → API api-….up.railway.app
  with REFRESH_COOKIE_SAMESITE=lax → Instagram callback POST omits buzz_oauth_state → 401.
  Live mitigation check (GET, do not follow redirects — HEAD returns 405):
  curl -sSD - -o /dev/null '<META.md API host>/api/auth/instagram/login'
  → Set-Cookie includes SameSite=none; Secure.
  Custom-domain claim check: dig api.bringthebuzzover.com (NXDOMAIN);
  www → GitHub Pages; Railway list-domains = only *.up.railway.app.
fix_when: |
  ALL of the v1 verification checklist rows PASS (binary). Docs scrub + live
  Set-Cookie + Railway env + FRONTEND_URL / INSTAGRAM_REDIRECT_URI / Meta
  alignment to hosts named in META.md “Hosts (exact strings)” / App Review
  section. No waivers. Fail any row → stay open (or status: wontfix if
  deliberately abandoned). Archiving means Railway+none App Review invariant
  is documented and verified — NOT www+api cutover or SameSite=lax.
---

## Progress (2026-08-08)

| Check | Status |
| ----- | ------ |
| Cookie env / Set-Cookie `none`+`Secure` | **PASS** (live GET login) |
| `FRONTEND_URL` / `INSTAGRAM_REDIRECT_URI` = META Railway SPA | **PASS** (Railway vars; authorize `redirect_uri` matches) |
| Docs invariant (`none` required on dual-host) | **PASS** (DEPLOYMENT + META scrubbed) |
| Real `INSTAGRAM_CLIENT_ID` / `_SECRET` on Railway | **PASS** (live authorize uses real App ID; local `.env` also set) |
| Meta dashboard URLs = META Hosts | **PENDING** — Meta app exists (META §A–B done); finish §C (redirect / deauth / legal URLs), then re-verify |

Do **not** archive until Meta dashboard row PASSes. Phase 2 custom-domain follow-up stays open.

## Locked v1 fix

**Host SOT:** Exact SPA, API, OAuth redirect, privacy/terms/data-deletion, and
deauthorize URLs live only in `META.md` → **Hosts (exact strings)** (App Review
section). This gap never hardcodes Railway hostnames; checklist always resolves
against that table.

**What “fixed” means for App Review TODAY:** SPA and API stay on distinct
`*.up.railway.app` hosts. Cookies are cross-site. Live must keep
`REFRESH_COOKIE_SAMESITE=none` + `REFRESH_COOKIE_SECURE=true`. Code default
`lax` is fine for same-site / local; **production Railway dual-host must override
to `none`**. Closing v1 does **not** require custom domains or flipping to `lax`.

### Verification checklist (v1) — binary

Every row must **PASS**. Any FAIL → gap stays `ops`/`open` (or `wontfix` only if
explicitly abandoned). No written waivers, owner notes, or forever-open deferrals
count as pass.

| Check | PASS criteria | Who |
| ----- | ------------- | --- |
| Cookie env | Railway API has `REFRESH_COOKIE_SAMESITE=none`, `REFRESH_COOKIE_SECURE=true` | Human read of Railway vars (agents: document only; no mutations) |
| Set-Cookie | `curl -sSD - -o /dev/null '<META.md API host>/api/auth/instagram/login'` (GET; **not** `-sI`/HEAD — that 405s with no cookie) → `Set-Cookie` includes `SameSite=none` and `Secure` | Agent or human, read-only |
| `FRONTEND_URL` | Equals META.md Site URL exactly (trailing-slash rules per META) | Human confirm on Railway |
| `INSTAGRAM_REDIRECT_URI` | Equals META.md OAuth redirect URL character-for-character with Meta dashboard | Human confirm Railway + Meta |
| Meta dashboard | Redirect / privacy / terms / data-deletion = META.md SPA URLs; deauthorize = META.md API URL | Human |
| Docs invariant | `DEPLOYMENT.md` + `META.md` (+ README if it claims preview/custom-DNS-fixes-prod) state **none is required** on dual-host Railway; custom DNS is Phase 2; no dual OR close criteria | Agent may edit |

### Split-brain (`www` vs Railway redirect)

If live `INSTAGRAM_REDIRECT_URI` or Meta still advertise `www.bringthebuzzover.com`
while App Review uses the Railway SPA (META.md hosts), that is a **FAIL** on the
`FRONTEND_URL` / `INSTAGRAM_REDIRECT_URI` / Meta rows — not a SameSite-only issue,
but it blocks v1 close.

- Aligning those to META.md App Review hosts **is in v1**.
- Agents do **not** flip Railway/Meta; humans must.
- Deliberate keep-www while shipping Railway SPA → checklist FAIL → stay open,
  or set `status: wontfix` (not archive as fixed).

### Agents may change (no Railway mutations)

- This gap file (milestones, checklist, archive policy).
- `DEPLOYMENT.md`, `META.md`, and README wording that contradicts the invariant
  (preview/staging fiction; “custom domains already fix prod”; dual OR close
  criteria; soft “none may be required” → hard “none required on dual-host”).
- Tiny doc comments in `.env.example` / config descriptions if they imply `lax`
  is always correct for production Railway dual-host.

### Needs human Railway / Meta OK

- Setting or changing `REFRESH_COOKIE_*`, `FRONTEND_URL`, `INSTAGRAM_REDIRECT_URI`.
- Meta dashboard URL edits.
- Any DNS / custom-domain attach.
- Confirming live env matches the checklist (agents may curl Set-Cookie only).

### Explicitly OUT of v1 (Phase 2)

- Attach `www` / `api.bringthebuzzover.com` on Railway.
- Rebuild SPA against `api.bringthebuzzover.com`.
- Flip Meta + env to brand domains.
- Set `REFRESH_COOKIE_SAMESITE=lax` and retire `none`.
- Claiming prod is same-site before `api` DNS + Railway custom domains exist.

### How to archive after v1 (binary)

**Archive iff** every checklist row is PASS. Then:

1. Move to `gaps/archive/deploy.samesite-lax-railway-preview.md`, set
   `status: fixed`, set `closed_in` when known.
2. Archive note: **closed for Railway+none App Review invariant — Phase 2
   cutover/`lax` not done.**
3. Incomplete checklist → do **not** archive; keep living with `ops`/`open`, or
   `wontfix` if abandoned.
4. **Required follow-up:** Phase 2 infra archived as
   `gaps/archive/deploy.custom-domain-samesite-lax.md`. Remaining:
   `gaps/deploy.meta-brand-url-cutover.md` (Meta paste) and
   `gaps/deploy.apex-hostinger-forward-blocked.md` (apex).

---

## Phase 2 — custom DNS + SameSite=lax (DONE infra 2026-08-09)

Archived: `gaps/archive/deploy.custom-domain-samesite-lax.md`.

Done: www+api Railway TLS, SPA rebuild, env → www, `SameSite=lax` Set-Cookie.
Still open: Meta dashboard URL paste (`deploy.meta-brand-url-cutover`); IG login
E2E; apex Hostinger forward (`deploy.apex-hostinger-forward-blocked`).

---

## Problem

Credentialed auth cookies (`buzz_oauth_state`, `buzz_refresh`) use
`REFRESH_COOKIE_SAMESITE` (code default **`lax`**). On distinct
`*.up.railway.app` hosts, sites are cross-site (public suffix), so `lax`
cookies are omitted on SPA→API XHR → Instagram callback 401 and refresh
session death.

## Facts (do not contradict)

- There is **no** separate Railway preview/staging env — only `production`.
- **Custom domains do not fix prod today:** Railway has no custom domains;
  `api.bringthebuzzover.com` NXDOMAIN; `www` is GitHub Pages, not Railway.
- Live Railway API already sets **`SameSite=none; Secure`** — dual-host lax
  breakage is **mitigated in current deploy**; remaining debt is doc/invariant
  footgun (someone flipping back to default `lax`) plus any redirect split-brain.
- META App Review path **is** Railway SPA↔API → needs `none` until Phase 2.

## Symptoms (if `lax` on dual-host)

Org IG login → “Login Failed” / Invalid or expired OAuth state. Brand/admin
may get a short-lived access token then hard logout on refresh/reload.

## Severity

**P1 while this gap is living** — archive criteria unmet. Live `none` softens
runtime risk but does not close the gap. On archive (`status: fixed`), the
footgun is mitigated by docs+verify; severity is historical. Do **not** lower
to P2 and leave living, and do **not** archive on partial checklist.

## Risks

Third-party cookie blocking can still drop `SameSite=None`; Phase 2 footgun
(flip to `lax` before both hosts same-site); GH Pages www vs Railway FE
mismatch; code default `lax` silently breaks new Railway dual-host envs.

## Plan verification

**Verdict: PASS_WITH_NITS**

Verified against Locked v1, `META.md` Hosts, `backend/app/config.py`,
`backend/app/routes/auth.py` cookie helpers, `InstagramCallbackPage`
`credentials: "include"` POST, `DEPLOYMENT.md`, live read-only probes, and
Railway `list-domains` (no mutations; API `list-variables` not used).

### Live SameSite claim — correct

`GET https://api-production-fbbc1.up.railway.app/api/auth/instagram/login`
returns `Set-Cookie: buzz_oauth_state=…; HttpOnly; Max-Age=600; Path=/api/auth;
SameSite=none; Secure`. Gap Facts claim that live dual-host is already
mitigated with `none`+Secure is **true**. DNS claims also hold:
`api.bringthebuzzover.com` NXDOMAIN; `www` → GitHub Pages
(`ShannonLin284.github.io`); Railway domains for api/frontend are only
`*.up.railway.app`.

### META.md as App Review host SOT — correct

META **Hosts (exact strings)** is the right SOT for App Review URLs. Code
paths match the dual-host story: both `buzz_oauth_state` and `buzz_refresh`
use `REFRESH_COOKIE_SAMESITE` / `REFRESH_COOKIE_SECURE`; callback 401s without
matching state cookie; SPA callback is cross-origin credentialed XHR.
`DEPLOYMENT.md` currently contradicts META/reality (canonical www+api “in
use”, soft “none may be required”) — exactly the Docs invariant scrub target.

### Docs-only v1 cannot close — plan agrees (good)

Locked v1 correctly requires **all** checklist rows, including human Railway
env + Meta alignment to META hosts. Agent-only docs edits cannot archive.
Live authorize `redirect_uri` is the META Railway SPA callback (and live
`client_id` is the real Meta App ID as of 2026-08-08). Meta **dashboard** §C
URLs still need human confirmation before this gap can archive.

### Checklist correctness — one blocking nit

| Row | Assessment |
| --- | --- |
| Cookie env | Sound; live Set-Cookie implies `none`+Secure; human still confirms vars |
| Set-Cookie | **Amended:** use GET `curl -sSD - -o /dev/null` (not `-sI`/HEAD — 405). Locked checklist updated 2026-08-06. |
| `FRONTEND_URL` / `INSTAGRAM_REDIRECT_URI` / Meta | Correct binary criteria vs META; live www redirect proves why they matter |
| Docs invariant | Correct; DEPLOYMENT soft OR + false “custom DNS in use” must harden |

### Other nits (non-blocking)

- Fix repro + checklist to stop recommending `-sI`.
- `config.py` / `.env.example` still read as “lax is the OAuth answer”; optional
  comment scrub already allowed under Agents may change.
- Live authorize URL showed `client_id=PENDING` — out of SameSite scope, but
  App Review readiness is not cookie-only.
- Phase 2 / archive policy / “do not claim lax closes v1” — sound.

**Bottom line:** Locked approach and close criteria are right; live `none`
claim is right; META SOT is right; docs-only cannot close. Patch the
Set-Cookie probe to GET before treating that row as executable.
