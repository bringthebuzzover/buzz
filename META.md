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

   **Dashboard (2026-10-26):** those two are Active (Standard Access) and were **rejected** in App Review. Meta also shows `instagram_business_manage_messages` (Active, no review requested; auto-added with the Instagram use case), plus `manage_comments` and `content_publish` (Ready to use, 0 calls). Removal is on the resubmission checklist (Lawrence). Buzz has never requested those three.
4. **Deauthorize callback URL:** `https://api.bringthebuzzover.com/api/auth/instagram/deauthorize`
5. **Data deletion instructions URL:** `https://www.bringthebuzzover.com/data-deletion`  
   Advanced settings also recommends a **Data Deletion Callback URL**. As of 2026-10-26 only this instructions URL is set. Adding the callback is optional (living gap, Lawrence).
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

### Apply-time handle lookup (Business Discovery)

[`PRODUCT.md`](PRODUCT.md) §6.1.1: `/org/apply` shows an **inline confirm card** after an exact-username lookup (not an IG-app typeahead). Implementation uses Meta **Business Discovery** on `graph.facebook.com` — **not** the org’s Instagram Login token.

**Ops / engineering setup (one-time):**

1. Connect a Buzz-owned **Instagram Business or Creator** account to the Meta app via **Facebook Login for Business** (Page-linked path — separate from org Instagram Login OAuth).
2. Store a long-lived **server** access token (env var; rotate like other secrets). Used only for public `GET /api/orgs/instagram-lookup` (rate-limited).
3. Query shape: `GET /{buzz-ig-user-id}?fields=business_discovery.username({handle}){username,name,profile_picture_url,biography,followers_count}`.

**Railway env (api service only — after human mint):**

- `INSTAGRAM_BUSINESS_DISCOVERY_TOKEN`
- `INSTAGRAM_BUSINESS_DISCOVERY_IG_USER_ID`
- `FACEBOOK_GRAPH_BASE` (default `https://graph.facebook.com`)

Until those are set, lookup **soft-fails** (PRODUCT §6.1.1) — apply still works with handle marked unconfirmed.

**Status (2026-10-26):** Facebook app BUZZ (`1589568552810678`) and Instagram app BUZZ - IG (`2056969808271074`) are in **Development**. Business Verification is **Verified**. Service IG + Facebook Login long-lived token are still **unset** on Railway `api` — production lookup returns `reason=unavailable`. Living ops runbook: [`gaps/ops.ig-business-discovery-unset.md`](gaps/ops.ig-business-discovery-unset.md). App Review resubmission: [`gaps/deploy.meta-app-review.md`](gaps/deploy.meta-app-review.md).

**Product rules:**

- Lookup is **exact username** after debounce — no similar-handle suggestions.
- Not found / personal account → surface **Business or Creator required**; **blocks** apply submit.
- Transient / rate-limited / token-unset → **soft-fail**: allow submit with handle marked **unconfirmed** (admin sees the flag). See [`PRODUCT.md`](PRODUCT.md) §6.1.1.
- Does **not** replace Connect at approval; only helps the applicant confirm the right handle on the apply form.

Docs: [Business Discovery](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/business-discovery/), [Graph API rate limiting](https://developers.facebook.com/docs/graph-api/overview/rate-limiting/).

**Meta rate limits (Business Discovery):**

Business Discovery is **not** counted against the Instagram BUC budget (`4800 × impressions` / 24h). Meta documents it under **Platform Rate Limits** instead ([Instagram Platform overview — Rate limiting](https://developers.facebook.com/docs/instagram-platform/overview/)).

| Bucket | Official rule | Buzz implication |
| ------ | ------------- | ---------------- |
| **Platform (app token)** | `Calls within 1 hour = 200 × Number of Users` (app DAU; scales with engagement) | Shared **app-wide** hourly budget — not per applicant |
| **Platform (user token)** | Rolling 1h per token; Meta does **not** publish the numeric cap | Our service IG token is likely one user bucket — treat as **finite** |
| **CPU / wall time** | `X-App-Usage`: `total_cputime` / `total_time` are **percentages**; throttling at 100% can happen **before** the hourly call budget | Avoid burst lookups; space Meta calls |

Community reports (low-DAU apps) often see **~200 lookups/hour** as a practical ceiling when using a single service token — enough for seeded apply **if** Buzz does not call Meta on every keystroke.

**Buzz-side protections (required in Phase A):**

1. **Client debounce** — lookup only after typing pauses (~500ms) on a **complete** username shape; never on partial strings (Meta needs exact `username` anyway).
2. **Server cache** — cache lookup results by normalized handle (hit + miss) for **≥15 minutes**; dedupe concurrent requests for the same handle.
3. **Public endpoint limits** — `GET /api/orgs/instagram-lookup`: per-IP cap (e.g. **30/hour**, **10/min burst**) independent of Meta; return **429** with retry-after when exceeded.
4. **Meta throttle handling** — on Graph `4` / `17` / `32` / `613` or `429`, serve “try again in a few minutes” on the confirm card; log `X-App-Usage` when present; optional short server-side backoff when `call_count` or `total_time` > **80%**.
5. **One Meta call per debounced lookup** — no retry storm; applicant can click Retry manually.

**Seeded-launch capacity (order of magnitude):** with debounce + cache, dozens of applies per hour are fine on a ~200/hr Meta budget; a campus tabling event with hundreds of simultaneous typists needs cache + IP limits so duplicate handles and retries do not fan out to Meta.

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
- Code requests only the two listed permissions. Dashboard extras (messaging, comments, content publish) are on the resubmission gap for removal.
- Public launch still needs Advanced Access on both permissions. Business Verification is already Verified. Testers alone are the seeded pilot.
