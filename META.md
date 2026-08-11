# Meta / Instagram API setup

Guide for configuring Instagram login for Buzz’s org portal. Written so a non-engineer can complete the Meta dashboard work; hand credentials back to engineering when done.

Buzz uses **Instagram API with Instagram Login** (Business Login): no Facebook Page required. Orgs sign in with an Instagram **Business or Creator** account. Personal accounts are not supported.

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

**Configure now.** App + Hosts + tester pilot are done. **Start Business Verification** (§E), then App Review (§F).

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
- [ ] **E.** Business Verification — living gap [`gaps/deploy.meta-business-verification.md`](gaps/deploy.meta-business-verification.md)
- [ ] **F.** App Review: Advanced Access for both permissions
- [ ] **G.** Confirm public login works without testers

A–D done (pilot path). **E next** (Business Verification). E–F = public launch.

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
> **Done (2026-08-08):** credentials are on Railway production and in local `backend/.env` (never commit). **§C–D done 2026-08-11.** Continue with **§E**.

---

## C. Business Login settings

Reference: [Business Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/).

1. **Instagram → API setup with Instagram login → Set up Instagram business login → Business login settings**.
2. **OAuth redirect URIs** — add **all** of:
   - `https://www.bringthebuzzover.com/auth/instagram/callback` (**required** — matches Railway env)
   - `http://localhost:3000/auth/instagram/callback` (**optional**, for local SPA ↔ local API OAuth)
   - Optional until IG smoke: `https://frontend-production-3819.up.railway.app/auth/instagram/callback`
3. **Permissions** — only:
   - `instagram_business_basic`
   - `instagram_business_manage_insights`  
   Do not add publishing, comments, or messaging scopes.
4. **Deauthorize callback URL:** `https://api.bringthebuzzover.com/api/auth/instagram/deauthorize`
5. **Data deletion instructions URL:** `https://www.bringthebuzzover.com/data-deletion`
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

---

## E. Business Verification

Required for Advanced Access.  
Docs: [Business Verification](https://developers.facebook.com/docs/development/release/business-verification/), [documents](https://www.facebook.com/business/help/2058515294227817).

1. App settings → Basic → start Business Verification (attach or create a Business).
2. Complete verification in Business Manager (tax / registration / utility docs as requested).
3. Start as soon as documents are ready.

---

## F. App Review — Advanced Access

Unlocks login for orgs that are not testers.  
Docs: [Instagram App Review](https://developers.facebook.com/docs/instagram-platform/app-review/).

**Before submit:**

- [ ] Business Verification done (or not blocking Advanced Access)
- [ ] Successful API use of both permissions via a tester login (confirm with engineering; metrics sync should have run)
- [ ] Privacy + Terms live on the www URLs above; set in App settings → Basic
- [ ] Reviewers can reach `https://www.bringthebuzzover.com`; include tester credentials if needed
- [ ] Screencast(s): login → Instagram consent → data use for **each** permission ([recording guide](https://developers.facebook.com/docs/app-review/submission-guide/screen-recordings/))

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

**Still human (Meta launch):** §E Business Verification → §F App Review Advanced Access → §G public login (Hosts §C archived 2026-08-11 — see `gaps/archive/deploy.meta-brand-url-cutover.md`).

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
- Only the two listed permissions.
- Public launch = Advanced Access + Business Verification, not testers alone.
