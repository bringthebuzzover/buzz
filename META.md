# Meta / Instagram API setup

Step-by-step guide to set up the Instagram login that Buzz's student-org portal depends on. This is written so someone **other than the engineer** can complete it. Where a step needs a value from engineering (or produces a value to hand back), it's called out in a box.

Buzz uses **"Instagram API with Instagram Login"** (a.k.a. Business Login) — the standalone Instagram path that does **not** require a Facebook Page. Org users log in with an Instagram **Business or Creator** account (Personal accounts are not supported by the API and are rejected by the app).

---

## What you're producing

By the end you will hand these three values back to engineering (they go into the backend environment):

| Value                                   | Where it comes from              | Backend env var           |
| --------------------------------------- | -------------------------------- | ------------------------- |
| Instagram App ID                        | App Dashboard (Step B)           | `INSTAGRAM_CLIENT_ID`     |
| Instagram App Secret                    | App Dashboard (Step B)           | `INSTAGRAM_CLIENT_SECRET` |
| Redirect URI (confirm the exact string) | Agreed with engineering (Step 3) | `INSTAGRAM_REDIRECT_URI`  |

### Values you need FROM engineering before you start

- **Redirect URI** — the page Instagram sends users back to after they approve. Format: `https://<frontend-domain>/auth/instagram/callback` (local/dev example: `https://localhost:3000/auth/instagram/callback`). Ask engineering for the exact production domain and use that.
- **Permissions (scopes) to request** — exactly these two, no more: `instagram_business_basic` and `instagram_business_manage_insights`.
- **Privacy Policy URL** and **Terms URL** — Buzz serves these at `https://<frontend-domain>/privacy` and `/terms`. Needed in Steps E–F.

---

## Checklist (high level)

- [ ] **A.** Create a Meta developer account + a Business-type app
- [ ] **B.** Add the Instagram product and copy the App ID + App Secret
- [ ] **C.** Configure Business Login: redirect URI + the two permissions
- [ ] **D.** (Pilot, optional) Add pilot orgs as Instagram Testers — works with no review
- [ ] **E.** Complete Business Verification
- [ ] **F.** Submit App Review for Advanced Access on both permissions
- [ ] **G.** Switch the app to Live mode after approval

Steps A–D can be done immediately and are enough for a **small pilot**. Steps E–G are required before the **general public** can log in.

---

## A. Create the app

1. Sign in / register at Meta for Developers: <https://developers.facebook.com/> (a Facebook account is required to register as a developer).
2. Go to the App Dashboard: <https://developers.facebook.com/apps/> and click **Create App**.
3. **Use case:** select **Other**, then **Next**. (Reference: <https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/create-a-meta-app-with-instagram/>)
4. **App type:** select **Business**, then **Next**. (Business type is required to add the Instagram product.)
5. Enter an app name (e.g. "Buzz") and contact email, then create the app.

---

## B. Add the Instagram product + get credentials

1. In the app's left sidebar, find **Instagram** and click **Set up** (this adds **API setup with Instagram login**).
2. Open **Instagram → API setup with Instagram login**.
3. In section **"2. Instagram app credentials"** you'll see the **Instagram App ID** and **Instagram App Secret**. Copy both.

> **Hand back to engineering:** the Instagram App ID → `INSTAGRAM_CLIENT_ID`, and the Instagram App Secret → `INSTAGRAM_CLIENT_SECRET`. Treat the secret like a password — send it through a secure channel, never commit it.

---

## C. Configure Business Login (redirect URI + permissions)

Reference: <https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/>

1. Still under **Instagram → API setup with Instagram login**, find section **"3. Set up Instagram business login"** and click **Business login settings**.
2. **OAuth Redirect URI:** add the exact redirect URI from engineering, e.g. `https://app.bringthebuzzover.com/auth/instagram/callback`. Save.
   - Must be **HTTPS**.
   - It must match what the backend sends **character-for-character**. The dashboard sometimes appends a trailing slash — confirm the final saved value with engineering so `INSTAGRAM_REDIRECT_URI` matches it exactly.
3. **Permissions:** ensure the login requests exactly:
   - `instagram_business_basic`
   - `instagram_business_manage_insights`

   Do **not** add publishing, comments, or messaging scopes — requesting scopes the app doesn't use slows down App Review.

4. **Deauthorize callback URL:** `https://<frontend-domain>/api/auth/instagram/deauthorize` — the backend endpoint that runs when a user removes the app from their Instagram (verifies Meta's `signed_request` and revokes the stored token).
5. **Data Deletion Instructions URL:** `https://<frontend-domain>/data-deletion` — the public page that tells users how to request account deletion by email. (Meta accepts an instructions page in place of a callback endpoint.)
6. Click **Save**.

---

## D. Pilot path — add tester accounts (no App Review needed)

While the app is in **Development mode**, the real login flow works, but **only** for Instagram accounts you explicitly add as testers. This is enough for a demo or a small pilot. Reference: <https://developers.facebook.com/docs/development/build-and-test/app-roles/>

For each pilot org:

1. Confirm their Instagram account is a **Business or Creator** account (not Personal). They can switch in the Instagram app: Settings → Account type.
2. In the App Dashboard, go to **App roles → Roles**, click **Add People**, choose **Instagram Tester**, and enter the org's **Instagram username**.
3. Tell the org to **accept the invite**: log into that Instagram account, go to <https://www.instagram.com/accounts/manage_access/>, open the **Tester Invites** tab, and click **Accept**.

Until they accept, the account shows as **Pending** and login will fail for them. There is **no API** to send or accept these invites — it's manual on both sides, which is why it only suits a small pilot.

---

## E. Business Verification (required for public launch)

Advanced Access requires your business identity to be verified. Reference: <https://developers.facebook.com/docs/development/release/business-verification/>

1. In the App Dashboard, go to **App settings → Basic**, find the **Business verification / Verification** section, and click **Start Verification** (connect the app to a Business, creating one if needed).
2. Complete verification in **Business Manager** — you'll need documents proving the business exists (e.g. tax document, utility bill, business registration). Meta's help on required documents: <https://www.facebook.com/business/help/2058515294227817>
3. This can take a few days and may involve back-and-forth. Start it early.

---

## F. App Review — request Advanced Access

This is what lets **any** org (not just testers) log in. Reference: <https://developers.facebook.com/docs/instagram-platform/app-review/>

**Before you submit, make sure you have:**

- [ ] Business Verification complete (Step E).
- [ ] The app has made **at least one successful API call** with each of the two permissions — do a real login with a tester account (Step D) first. (Ask engineering to confirm a tester login + a metrics sync ran.)
- [ ] A public **Privacy Policy URL** (`/privacy`) and **Terms URL** (`/terms`). Set these in **App settings → Basic**.
- [ ] A **live, reviewer-accessible** test environment (the deployed app) plus test instructions and, if needed, a tester Instagram account's credentials.
- [ ] **Screencast(s)** showing the full flow: the login button → the Instagram consent screen → the app using the data for **each** permission (`instagram_business_basic` = profile/media; `instagram_business_manage_insights` = the post metrics on the brand dashboard). Requirements: <https://developers.facebook.com/docs/app-review/submission-guide/screen-recordings/>

**Submit:**

1. In the App Dashboard, go to **Instagram → API setup with Instagram login**, find the **Complete app review** section, and click through to **App Review → Requests**.
2. Request **Advanced Access** for `instagram_business_basic` **and** `instagram_business_manage_insights`.
3. Fill in the use-case description (how each permission is used), attach the screencast(s), and submit.

Note: `instagram_business_manage_insights` is reviewed **separately** from the basic permission — both must be approved.

---

## G. Go Live

1. Only after **both permissions are approved** and Business Verification is complete, switch the app from **Development** to **Live** mode (toggle at the top of the App Dashboard).
2. Tell engineering it's live so they can confirm public logins work.

Reference (publish checklist): <https://developers.facebook.com/docs/development/release/>

---

## Platform prerequisites (Buzz side)

These are the technical things that must be true **on the Buzz platform** for Instagram login to work — separate from the Meta dashboard steps above. Checked boxes (`[x]`) are already built/handled in the codebase; unchecked boxes (`[ ]`) are either config you supply at deploy time or genuine gaps to close.

### Already implemented (in code)

- [x] **OAuth handshake** — code → short-lived → long-lived token exchange, then profile fetch (`backend/app/services/instagram.py`, `services/auth.py::handle_instagram_callback`).
- [x] **CSRF-protected `state`** — signed, TTL'd state token stored in a short-lived httpOnly cookie and re-checked at the callback (`routes/auth.py`, double-submit; `OAUTH_STATE_*` settings).
- [x] **Token encryption at rest** — the long-lived IG token is Fernet-encrypted before it hits the DB (`encrypt_token`, needs `TOKEN_ENCRYPTION_KEY`).
- [x] **Business/Creator-only gating** — Personal accounts rejected with a specific error (`ALLOWED_ACCOUNT_TYPES` → `INSTAGRAM_PERSONAL_ACCOUNT`).
- [x] **DB schema** — `instagram_*` columns + `token_version` exist via migrations (`0392d8ea3a28_initial_schema`, `00f8ab49f469_..._token_version`).
- [x] **Long-lived token refresh job** — cron refreshes tokens before the ~60-day expiry (`app/jobs/token_refresh.py`; uses `refresh_long_lived`).
- [x] **Frontend flow** — `login()` redirects to `/api/auth/instagram/login`, and the SPA callback route `/auth/instagram/callback` POSTs `{code, state}` with credentials (`AuthContext.tsx`, `pages/auth/InstagramCallbackPage.tsx`, `AppRoot.tsx`).
- [x] **Config fail-fast** — off-`development`, startup crashes if the IG creds / secrets are missing (`backend/app/config.py` guard).
- [x] **Session cookies configurable for cross-site** — `REFRESH_COOKIE_SAMESITE` / `_SECURE` / `_PATH` knobs exist for SPA-on-different-domain topologies.
- [x] **Deauthorize webhook** — `POST /api/auth/instagram/deauthorize` verifies Meta's `signed_request` (HMAC-SHA256 with `INSTAGRAM_CLIENT_SECRET`), nulls the stored token, and bumps `token_version` to kill live sessions (`app/security/signed_request.py`, `services/auth.py::revoke_instagram_authorization`).
- [x] **Data deletion via instructions page** — public `/data-deletion` page tells users how to request deletion by email; reuses `siteIdentity.contact` so the address stays single-sourced (`src/pages/legal/DataDeletionPage.tsx`).

### Config you must supply at deploy (code is ready, values are not)

- [ ] `INSTAGRAM_CLIENT_ID` / `INSTAGRAM_CLIENT_SECRET` — from Meta (Step B).
- [ ] `INSTAGRAM_REDIRECT_URI` — must match the dashboard **exactly** (Step C).
- [ ] `SECRET_KEY` — signs JWTs **and** the OAuth state token.
- [ ] `TOKEN_ENCRYPTION_KEY` — Fernet key; without it the callback can't persist the token.
- [ ] `DATABASE_URL` reachable + **migrations applied** (`alembic upgrade head`).
- [ ] **HTTPS end-to-end** in prod — Meta requires an https redirect URI, and secure cookies are enforced off-dev (no TLS ⇒ cookies dropped ⇒ login fails).
- [ ] **Same-site SPA/API** (recommended: API under the SPA domain at `/api`) so the `SameSite=lax` state cookie survives the redirect back. If cross-site, set `REFRESH_COOKIE_SAMESITE=none` + `_SECURE=true` + credentialed CORS.
- [ ] **Backend egress** to `api.instagram.com`, `graph.instagram.com`, `www.instagram.com` allowed by any firewall.

---

## Quick reference — all links

- Meta for Developers (home / register): <https://developers.facebook.com/>
- App Dashboard: <https://developers.facebook.com/apps/>
- Create a Meta app with Instagram (walkthrough): <https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/create-a-meta-app-with-instagram/>
- Instagram API with Instagram Login (overview): <https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/>
- Business Login setup: <https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/>
- Get started / first API call: <https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/get-started/>
- App roles (tester invites): <https://developers.facebook.com/docs/development/build-and-test/app-roles/>
- Accept a tester invite (send to orgs): <https://www.instagram.com/accounts/manage_access/>
- App modes (Development vs Live): <https://developers.facebook.com/docs/development/build-and-test/app-modes/>
- Access levels (Standard vs Advanced): <https://developers.facebook.com/docs/graph-api/overview/access-levels/>
- App Review (Instagram): <https://developers.facebook.com/docs/instagram-platform/app-review/>
- Screen-recording requirements: <https://developers.facebook.com/docs/app-review/submission-guide/screen-recordings/>
- Business Verification: <https://developers.facebook.com/docs/development/release/business-verification/>
- Publish / go-Live: <https://developers.facebook.com/docs/development/release/>

---

## Notes & gotchas

- **Business/Creator accounts only.** Personal Instagram accounts have no API access (since Dec 2024) and the app rejects them.
- **Exact redirect URI match.** The single most common failure: the URI saved in the dashboard must equal `INSTAGRAM_REDIRECT_URI` in the backend exactly (including any trailing slash and `https://`).
- **Least privilege.** Only the two listed permissions. Extra scopes = slower or rejected review.
- **Timeline.** Business Verification + App Review can take from days to a few weeks. Start Steps A–E as early as possible; the pilot (Step D) can run in parallel with zero review.
