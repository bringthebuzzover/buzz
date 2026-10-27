# Meta / Instagram API setup

Guide for configuring Instagram login for Buzz’s org portal. Written so a non-engineer can complete the Meta dashboard work; hand credentials back to engineering when done.

Buzz uses **Instagram API with Instagram Login** (Business Login): no Facebook Page required. Orgs **bind** a Business or Creator account after Buzz approval; **returning** sign-in is Instagram on that bound account. Personal accounts are not supported. New org accounts are created via public **org apply**, not Instagram OAuth — see [`LAUNCH.md`](LAUNCH.md) Phase A.

**Seeded launch (current product work):** testers + apply-first. Public login without testers still waits on App Review. **Business Verification is Verified** (dashboard 2026-10-26). **App Review** for `instagram_business_basic` and `instagram_business_manage_insights` was submitted 2026-10-07 and **rejected**; resubmission is in progress — [`gaps/deploy.meta-app-review.md`](gaps/deploy.meta-app-review.md). [`LAUNCH.md`](LAUNCH.md) §3 still treats Advanced Access as out of the seeded revamp (testers do not need it). App mode is **Development**.

---

## Decision summary

| | |
| --- | --- |
| Meta app type | **Business** |
| Instagram product | **API setup with Instagram login** |
| Permissions | `instagram_business_basic`, `instagram_business_manage_insights` only |
| Pilot (testers only) | **Standard Access** + Instagram Tester roles |
| Public orgs (no testers) | **Advanced Access** on both permissions + **Business Verification** |

**Standard Access** (default): only app roles (Admin / Developer / Instagram Tester) can log in.  
**Advanced Access**: any Instagram Business/Creator account can log in. That is the public launch requirement.

Docs: [platform overview](https://developers.facebook.com/docs/instagram-platform/overview), [access levels](https://developers.facebook.com/docs/graph-api/overview/access-levels/).

### Stories (unsupported in Buzz v1)

Instagram **Stories** are **out of product scope**. Buzz syncs durable FEED/REELS via
`GET /me/media` only — not `GET /{ig-user-id}/stories`.

| Why | Source |
| --- | ------ |
| Story media metrics available ~**24 hours** only | [Media Insights](https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights/) |
| Live stories listed on `/stories`, not `/media` | [IG User Stories](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/stories/), [IG User Media](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media/) |
| Post-expiry `story_insights` webhook is **Facebook Login only** | [Webhooks](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-instagram/), [Insights overview](https://developers.facebook.com/docs/instagram-platform/insights/) |

Buzz uses **Instagram Login** (`graph.instagram.com`) — no `story_insights` path.
Do not add a Stories poller or request Facebook Login solely for Stories without a
PRODUCT change.

---

## Hosts (exact strings)

**Brand DNS is live on Railway.** Meta Hosts paste (Phase 8) **done 2026-08-11** —
archived [`gaps/archive/deploy.meta-brand-url-cutover.md`](gaps/archive/deploy.meta-brand-url-cutover.md)
(+ [`gaps/archive/deploy.samesite-lax-railway-preview.md`](gaps/archive/deploy.samesite-lax-railway-preview.md)).

| Role | URL |
| ---- | --- |
| Site | `https://www.bringthebuzzover.com` |
| OAuth redirect | `https://www.bringthebuzzover.com/auth/instagram/callback` |
| Privacy | `https://www.bringthebuzzover.com/privacy` |
| Terms | `https://www.bringthebuzzover.com/terms` |
| Data deletion | `https://www.bringthebuzzover.com/data-deletion` |
| API / deauthorize | `https://api.bringthebuzzover.com/api/auth/instagram/deauthorize` |

Backend env matches: `INSTAGRAM_REDIRECT_URI` and `FRONTEND_URL` use www. Trailing slashes matter.

**Secondary Railway hosts** (optional; remove from Meta allowlist when unused):

| Role | URL |
| ---- | --- |
| Site | `https://frontend-production-3819.up.railway.app` |
| OAuth redirect | `https://frontend-production-3819.up.railway.app/auth/instagram/callback` |
| API / deauthorize | `https://api-production-fbbc1.up.railway.app/api/auth/instagram/deauthorize` |

---

## Timeline

| Step | Review? | Typical wait |
| ---- | ------- | ------------ |
| Create app + save URLs | No | Immediate |
| Pilot with Instagram Testers | No | Immediate after they accept |
| Business Verification | Yes (documents) | Days to weeks — start early |
| App Review → Advanced Access | Yes | Often up to ~20 days |
| Public login without testers | After both permissions approved | — |

Saving redirect URIs does **not** start App Review.

**Configure now (public launch path).** For the **seeded launch**, A–D (tester pilot) are enough — do **not** block Phase A/B on §F–G. Business Verification (§E) is **Verified** (2026-10-26). App Review (§F) was rejected; the resubmission checklist is the living gap linked above.

**Submit App Review only when** privacy, terms, and OAuth work on the www/api Hosts above. Meta crawls privacy/terms ([policy](https://developers.facebook.com/docs/development/terms-and-policies/privacy-policy/)).

Keep `INSTAGRAM_REDIRECT_URI` in sync with Meta if Hosts change. Changing permissions or data use may need a new App Review.

---

## Hand back to engineering

| Value | Env var | Status (2026-08-08) |
| ----- | ------- | ------------------- |
| Instagram App ID | `INSTAGRAM_CLIENT_ID` | **Set** on Railway `api` + crons; also local `backend/.env` (gitignored) |
| Instagram App Secret | `INSTAGRAM_CLIENT_SECRET` | **Set** same places — treat like a password; rotate if exposed in chat/logs |

Engineering does **not** need you to paste secrets into git. Railway Variables + local `.env` only.

---

## Checklist

- [x] **A.** Create a **Business** app
- [x] **B.** Add Instagram → **API setup with Instagram login**; copy App ID + Secret → engineering / Railway
- [x] **C.** Business Login: redirect, permissions, deauthorize, data deletion (+ privacy / terms URLs) — done 2026-08-11
- [x] **D.** Pilot: Instagram Testers (Standard Access) — confirmed 2026-08-11
- [x] **E.** Business Verification — **Verified** 2026-10-26 (dashboard)
- [ ] **F.** App Review: Advanced Access for both permissions — submitted 2026-10-07, **rejected** (Developer Policy 1.6); resubmission in progress — [`gaps/deploy.meta-app-review.md`](gaps/deploy.meta-app-review.md)
- [ ] **G.** Confirm public login works without testers

A–D done (tester pilot). **E done.** **F–G** are the public-login gate (testers still do not need them — [`LAUNCH.md`](LAUNCH.md) §3 Out).

---

## A. Create the app

1. <https://developers.facebook.com/> → register / sign in.
2. <https://developers.facebook.com/apps/> → **Create App**.
3. Use case: **Other** → **Next**. ([walkthrough](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/create-a-meta-app-with-instagram/))
4. App type: **Business** → **Next**.
5. Name the app (e.g. Buzz), set contact email, create.

---

## B. Instagram product + credentials

1. Sidebar → **Instagram** → **Set up**.
2. Open **Instagram → API setup with Instagram login**.
3. Under **Instagram app credentials**, copy **Instagram App ID** and **Instagram App Secret**.

> Hand ID → `INSTAGRAM_CLIENT_ID`, secret → `INSTAGRAM_CLIENT_SECRET`. Treat the secret like a password.
>
> **Done (2026-08-08):** credentials are on Railway production and in local `backend/.env` (never commit). **§C–D done 2026-08-11. §E Verified 2026-10-26.** Continue with **§F** (resubmission).

---

## C. Business Login settings

Reference: [Business Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/).

1. **Instagram → API setup with Instagram login → Set up Instagram business login → Business login settings**.
2. **OAuth redirect URIs** — add **all** of:
   - `https://www.bringthebuzzover.com/auth/instagram/callback` (**required** — matches Railway env)
   - `http://localhost:3000/auth/instagram/callback` (**optional**, for local SPA ↔ local API OAuth)
   - Optional until IG smoke: `https://frontend-production-3819.up.railway.app/auth/instagram/callback`
3. **Permissions** — Buzz requests only:
   - `instagram_business_basic`
   - `instagram_business_manage_insights`  
   Do not add publishing, comments, or messaging scopes in code (`INSTAGRAM_SCOPES`).

   **Dashboard (2026-10-27):** those two are Active and **App Review rejected**, pending resubmission. All other permissions and features were removed on 2026-10-27 (reversible). `public_profile` is a Meta default. It can't be removed, has 0 calls, and is not requested. Fields the code reads: [`gaps/deploy.meta-app-review.md`](gaps/deploy.meta-app-review.md).
4. **Deauthorize callback URL:** `https://api.bringthebuzzover.com/api/auth/instagram/deauthorize`
5. **Data deletion instructions URL:** `https://www.bringthebuzzover.com/data-deletion`  
   Advanced settings also recommends a **Data Deletion Callback URL**. The instructions URL is set. Lawrence skipped the callback on 2026-10-27; it is not required.
6. **Save.** Confirm the saved redirect string with engineering (dashboard may add a trailing slash).
7. **App settings → Basic:** Privacy + Terms → `https://www.bringthebuzzover.com/privacy` and `…/terms`.

---

## D. Pilot — Instagram Testers

Standard Access only allows role users. Enough for a small pilot; not public launch.  
Roles: [App roles](https://developers.facebook.com/docs/development/build-and-test/app-roles/).

**First testers** (add these Instagram usernames):

- `lawrence_granda`
- `melissaachowdhury`

For each:

1. Their Instagram account must be **Business or Creator** (not Personal).
2. App Dashboard → **App roles → Roles** → **Add People** → **Instagram Tester** → username.
3. They must **Accept** at <https://www.instagram.com/accounts/manage_access/> → **Tester Invites**.

Pending invites cannot log in. Invites are manual on both sides.

**Dashboard (2026-10-26):** 3 accepted, 11 pending. Handles are not listed in the living gap. Only an accepted tester can finish login while App mode stays **Development** and the permissions stay on Standard Access.

**Seeded org onboarding** ([`LAUNCH.md`](LAUNCH.md) §7): copy the org’s **claimed `@handle`** from Buzz admin → add as Instagram Tester **before** Approve → org accepts invite → approval email → Connect Instagram (not `/login` as signup). Honor-system confirm on admin Approve.

### Apply-time handle (no Meta lookup)

[`PRODUCT.md`](PRODUCT.md) §6.1.1: `/org/apply` asks for the organization’s Instagram handle as typed text. Buzz does **not** call Meta to look it up. There is no confirm card and no `GET /api/orgs/instagram-lookup`.

The handle is stored **unconfirmed** until Connect Instagram (Instagram Login on `graph.instagram.com`) binds the account. Username-shape validation stays on apply.

**Removed 2026-10-26** (Facebook Login Business Discovery). These env vars are no longer read. If they are still set on Railway **api**, delete them. Do not mint a replacement token:

- `INSTAGRAM_BUSINESS_DISCOVERY_TOKEN`
- `INSTAGRAM_BUSINESS_DISCOVERY_IG_USER_ID`
- `FACEBOOK_GRAPH_BASE`

The API ignores unknown env vars, so leaving them does not change behavior. Archived ops note: [`gaps/archive/ops.ig-business-discovery-unset.md`](gaps/archive/ops.ig-business-discovery-unset.md). App Review: [`gaps/deploy.meta-app-review.md`](gaps/deploy.meta-app-review.md) checklist 1c.

---

## E. Business Verification

**Status (2026-10-26): Verified.** Facebook app BUZZ (`1589568552810678`) and Instagram app BUZZ - IG (`2056969808271074`). App mode is **Development**.

Required for Advanced Access.  
Docs: [Business Verification](https://developers.facebook.com/docs/development/release/business-verification/), [documents](https://www.facebook.com/business/help/2058515294227817).

Path that was completed:

1. App settings → Basic → start Business Verification (attach or create a Business).
2. Complete verification in Business Manager (tax / registration / utility docs as requested).
3. Basic → Verification shows **Verified**.

---

## F. App Review — Advanced Access

Unlocks login for orgs that are not testers.  
Docs: [Instagram App Review](https://developers.facebook.com/docs/instagram-platform/app-review/).

**Status (2026-10-26):** Submitted 2026-10-07 for both permissions. **Rejected** (Developer Policy 1.6 — reviewers could not verify the use case / login flow). Do not resubmit those screencasts or that reviewer text. Checklist, owners, and the 2026-10-07 form: [`gaps/deploy.meta-app-review.md`](gaps/deploy.meta-app-review.md).

**Before the next submit:**

- [x] Business Verification done (Verified 2026-10-26)
- [ ] Successful API use of both permissions via an **accepted** tester login (confirm with engineering; metrics sync should have run)
- [x] Privacy + Terms on the www URLs above; set in App settings → Basic (reconfirmed 2026-10-26, with data-deletion instructions and icon)
- [ ] Reviewers use an accepted tester account and a Buzz test org from the test-credentials field
- [ ] Screencast(s): one file per permission. Each file is **Connect with Instagram** → credentials → first-time consent under **BUZZ - IG** listing that permission → Allow → that account’s data (profile and comment counts, or **Instagram Reach**). English captions. Not Continue with Instagram, and not a clip that starts after login ([recording guide](https://developers.facebook.com/docs/app-review/submission-guide/screen-recordings/))

**Submit:**

1. Instagram → API setup with Instagram login → Complete app review → App Review → Requests.
2. Request **Advanced Access** for `instagram_business_basic` and `instagram_business_manage_insights`.
3. Describe use cases, attach screencasts, submit.

Each permission is reviewed separately. Both must be approved.

---

## G. After approval

1. Confirm Advanced Access on both permissions.
2. Tell engineering to verify Railway env (`INSTAGRAM_*`, `FRONTEND_URL`) and a public login with a non-tester account on www.

Publish checklist: <https://developers.facebook.com/docs/development/release/>

---

## Agent verification (Meta Developer Tools MCP)

After the Buzz Meta app is granted to **Meta Developer Tools** MCP (user Cursor
config — not committed), agents can **read** app settings, App Review /
compliance status, and API usage and diff them against this file. See
[`AGENTS.md`](AGENTS.md) → MCP. Humans still paste Hosts (§C), run Business
Verification, and submit App Review; MCP does not replace the dashboard for those.

---

## Buzz platform (engineering)

Already in code: OAuth handshake, signed state cookie, encrypted tokens, Business/Creator gate, token refresh job, deauthorize webhook, data-deletion page, fail-fast missing IG config off-dev.

**Railway production (set):**

- [x] `INSTAGRAM_CLIENT_ID` / `INSTAGRAM_CLIENT_SECRET` (real Meta app; live login no longer uses a placeholder client id)
- `INSTAGRAM_GRAPH_VERSION` (optional; default `v26.0`) prefixes `graph.instagram.com` reads: `/me`, `/me/media`, `/{media-id}`, `/{media-id}/insights`. That matches the [get started](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/get-started/) samples (Graph API v26.0, current on the [versions](https://developers.facebook.com/docs/graph-api/changelog/versions/) table as of 2026-10-26). Leave `INSTAGRAM_GRAPH_BASE` as the host only (`https://graph.instagram.com`). Set the version empty to call those reads unversioned.
- `GET /access_token` (short→long exchange) and `GET /refresh_access_token` stay **unversioned** on that host. [Access Token](https://developers.facebook.com/docs/instagram-platform/reference/access_token/) (updated 2026-03-09) and [Refresh Access Token](https://developers.facebook.com/docs/instagram-platform/reference/refresh_access_token/) (updated 2025-07-17) show `https://graph.instagram.com/access_token` and `https://graph.instagram.com/refresh_access_token` with no version segment.
- Code exchange (`api.instagram.com/oauth/access_token`) `permissions` is logged (no token) and stored on `users.instagram_granted_permissions` when present. A grant outside `instagram_business_basic` and `instagram_business_manage_insights` is a warning. Omitted `permissions` does not clear a previously stored value. Railway pre-deploy `alembic upgrade head` adds the nullable column; no new env var is required.
- [x] `INSTAGRAM_REDIRECT_URI=https://www.bringthebuzzover.com/auth/instagram/callback`
- [x] `FRONTEND_URL=https://www.bringthebuzzover.com`
- [x] `REFRESH_COOKIE_SAMESITE=lax` + `REFRESH_COOKIE_SECURE=true` (brand www+api same eTLD+1)
- [x] `SECRET_KEY`, `TOKEN_ENCRYPTION_KEY`, `DATABASE_URL` (+ migrations)
- Egress to `api.instagram.com`, `graph.instagram.com`, `www.instagram.com`

**Local laptop:** copy `backend/.env.example` → `backend/.env` (gitignored). Fill the same `INSTAGRAM_CLIENT_*` values; keep `INSTAGRAM_REDIRECT_URI=http://localhost:3000/auth/instagram/callback` and add that URI in Meta §C if you test OAuth locally. Frontend: `REACT_APP_API_URL=http://localhost:8000` in `frontend/.env`.

**Still human (Meta launch):** §E Business Verification is **Verified** (2026-10-26). §F App Review was rejected; resubmission is [`gaps/deploy.meta-app-review.md`](gaps/deploy.meta-app-review.md). §G public login is still open. Hosts §C archived 2026-08-11 — see `gaps/archive/deploy.meta-brand-url-cutover.md`. App mode is **Development**.

Details: `DEPLOYMENT.md`.

---

## Links

- Developers: <https://developers.facebook.com/>
- Apps: <https://developers.facebook.com/apps/>
- Create app + Instagram: <https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/create-a-meta-app-with-instagram/>
- Instagram Login overview: <https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/>
- Standard vs Advanced: <https://developers.facebook.com/docs/instagram-platform/overview/>
- Business Login: <https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/>
- Get started: <https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/get-started/>
- App roles: <https://developers.facebook.com/docs/development/build-and-test/app-roles/>
- Tester accept: <https://www.instagram.com/accounts/manage_access/>
- Access levels: <https://developers.facebook.com/docs/graph-api/overview/access-levels/>
- App Review: <https://developers.facebook.com/docs/instagram-platform/app-review/>
- Screencasts: <https://developers.facebook.com/docs/app-review/submission-guide/screen-recordings/>
- Privacy policy URLs: <https://developers.facebook.com/docs/development/terms-and-policies/privacy-policy/>
- Business Verification: <https://developers.facebook.com/docs/development/release/business-verification/>

---

## Notes

- Instagram accounts must be **Business or Creator**.
- Redirect URI in Meta and `INSTAGRAM_REDIRECT_URI` must match character-for-character.
- Code requests only the two listed permissions (`INSTAGRAM_SCOPES` in `backend/app/config.py`). All other permissions and features were removed on 2026-10-27 (reversible). `public_profile` is a Meta default, 0 calls, not requested. There are no `graph.facebook.com` calls.
- Public launch still needs Advanced Access on both permissions. Business Verification is already Verified. Testers alone are the seeded pilot.
