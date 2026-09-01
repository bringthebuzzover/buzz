---
id: ops.ig-business-discovery-unset
title: Apply Instagram confirm card always soft-fails — Business Discovery token not on Railway
kind: ops
severity: P2
status: ops
surface: deploy
evidence:
  - path: backend/app/services/instagram.py
    note: fetch_business_discovery 503s when INSTAGRAM_BUSINESS_DISCOVERY_TOKEN or IG_USER_ID is empty
  - path: backend/app/config.py
    note: both vars default empty; FACEBOOK_GRAPH_BASE defaults to graph.facebook.com
  - path: frontend/src/pages/auth/OrgApplyPage.tsx
    note: reason unavailable/throttled → “couldn’t verify… still submit”
  - path: META.md
    note: Apply-time lookup is Facebook Login Business Discovery, not org Instagram Login
repro: |
  2026-08-31: curl -sS 'https://api.bringthebuzzover.com/api/orgs/instagram-lookup?username=bringthebuzzover'
  → data.available=false, reason=unavailable (every handle).
  Railway api production variables: INSTAGRAM_CLIENT_* present; INSTAGRAM_BUSINESS_DISCOVERY_TOKEN
  and INSTAGRAM_BUSINESS_DISCOVERY_IG_USER_ID absent.
  Apply still submits; organizations.instagram_handle_confirmed stays false.
fix_when: |
  Both vars set on Railway **api** (production) and local backend/.env.
  Smoke: GET /api/orgs/instagram-lookup?username=bringthebuzzover returns available=true
  plus username/name/picture (professional account). A known-missing handle returns
  reason=not_found (not unavailable). /org/apply shows the confirm card, not the amber
  soft-fail, for @bringthebuzzover.
  Do not commit tokens. FACEBOOK_GRAPH_BASE optional (default is correct).
  Out of archive scope: App Review / Advanced Access / Business Verification
  (deploy.meta-business-verification). Token rotation calendar after first mint.
---

# Apply-time Instagram lookup unset (Business Discovery)

Code and PRODUCT §6.1.1 are in place. Production never calls Meta because the
**service** Facebook Login token is missing. Every applicant sees the amber
soft-fail; they can still apply with an **unconfirmed** handle.

This is **not** the same as org Connect Instagram (`graph.instagram.com` +
`INSTAGRAM_CLIENT_ID` / `SECRET`). Business Discovery is **Instagram API with
Facebook Login** only ([docs, updated 2025-10-16](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/business-discovery/),
[IG User `business_discovery` reference, 2025-08-18](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery/)).
Instagram Login tokens cannot run this query.

Human Meta dashboard + Railway Variables. Agents verify; **do not** mutate Meta
or set Railway secrets without explicit OK.

## Why a Facebook Page is required

Org OAuth in Buzz does **not** need a Page. Lookup **does**.

Meta’s Get Started for Facebook Login ([current](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/get-started/)):

1. Professional IG (Business or Creator).
2. A **Facebook Page connected to that IG**.
3. A Facebook user who can perform tasks on that Page.
4. A User access token with the IG Graph permissions below.

Use Buzz’s brand account **`@bringthebuzzover`** (or another Buzz-owned
professional account) as the **querying** IG user. Discovery looks up *other*
handles (`business_discovery.username({handle})`) from that IG user id.

## Permissions (current reference)

Facebook **User** access token ([reference](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery/)):

- `instagram_basic`
- `instagram_manage_insights`
- `pages_read_engagement`

Also grant **`pages_show_list`** so `/me/accounts` lists Pages (Get Started
step 4). If the Page role was granted **via Business Manager**, Meta also
requires `ads_management` **or** `ads_read`.

These are **Facebook Login** scopes (`instagram_basic`), not Instagram Login
scopes (`instagram_business_basic`). Do not reuse `INSTAGRAM_CLIENT_ID` /
`INSTAGRAM_CLIENT_SECRET` for token exchange — those are **Instagram app**
credentials. Exchange uses **App settings → Basic → App ID + App Secret**
(Facebook app).

## Token lifetime (current)

[Long-lived tokens, updated 2026-06-30](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived/):

- Graph Explorer / web login → **short-lived** User token (hours).
- Server exchange → **long-lived User** token (~**60 days**). Cannot refresh
  after expiry; mint a new short-lived token and exchange again.
- **Long-lived Page** tokens from a long-lived User token have **no calendar
  expiry** (still die if password change / deauthorize / role loss).

Business Discovery samples use a **User** token
(`YOUR_APP_USERS_INSTAGRAM_USER_ACCESS_TOKEN`), not a Page token. Prefer
storing the **long-lived User** token unless a smoke test proves a Page token
works for this query. Calendar a remint before ~60 days.

**System User** never-expire tokens need the app in a Business portfolio
(`deploy.meta-business-verification`). Until BV, use Graph Explorer as an
**app admin** who can manage the Page linked to `@bringthebuzzover`.

## Steps (human)

### 0. Preconditions

- Meta app **BUZZ** `1589568552810678` is Live (true 2026-08-26 / still listed).
- `@bringthebuzzover` is Business or Creator.
- You are App Admin (or Developer) on BUZZ.

### 1. Add Facebook Login products (once)

App Dashboard → BUZZ → **Add products** if missing:

- **Facebook Login for Business** (or Facebook Login) — Valid OAuth Redirect
  URIs can stay Graph API Explorer defaults for a one-time mint.
- Instagram → **API setup with Facebook login** (separate from **API setup
  with Instagram login** used by orgs).

Do **not** change org OAuth redirect URIs (`www…/auth/instagram/callback`).

### 2. Link IG ↔ Facebook Page

If `@bringthebuzzover` is not already Page-linked:

- Create or pick a Page that represents Buzz.
- Connect it to the Instagram professional account (Page settings → Instagram,
  or Instagram professional account → linked Facebook Page).

Facebook Login for Business can complete “professional + Page + link” in one
dialog: [Business Login for Instagram](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/business-login-for-instagram/).

### 3. Mint a User token (Graph API Explorer)

1. Open [Graph API Explorer](https://developers.facebook.com/tools/explorer/).
2. Meta App = **BUZZ**. User or Page = **User Token**.
3. Permissions: `instagram_basic`, `instagram_manage_insights`,
   `pages_read_engagement`, `pages_show_list` (+ `ads_read` if BM-granted role).
4. **Generate Access Token** and complete the Facebook Login dialog as the
   person who can manage the Buzz Page.

### 4. Resolve IG user id

```text
GET https://graph.facebook.com/v25.0/me/accounts
  ?fields=id,name,access_token,instagram_business_account
  &access_token={USER_TOKEN}
```

Pick the Page linked to `@bringthebuzzover`. Copy
`instagram_business_account.id` → **`INSTAGRAM_BUSINESS_DISCOVERY_IG_USER_ID`**.

Equivalent two-step (Get Started): `GET /me/accounts` then
`GET /{page-id}?fields=instagram_business_account`.

### 5. Exchange for long-lived User token (server / terminal, not the browser)

Use **Facebook App ID + App Secret** from App settings → Basic (not Instagram
app credentials). Do not paste the secret into chat, git, or this file.

```text
GET https://graph.facebook.com/v25.0/oauth/access_token
  ?grant_type=fb_exchange_token
  &client_id={FACEBOOK_APP_ID}
  &client_secret={FACEBOOK_APP_SECRET}
  &fb_exchange_token={SHORT_LIVED_USER_TOKEN}
```

Response: `access_token` + `expires_in` (~5.1e6 seconds ≈ 60 days). That
string is **`INSTAGRAM_BUSINESS_DISCOVERY_TOKEN`**.

Confirm in [Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/)
(type User, scopes present, expiry ~60 days).

### 6. Smoke Business Discovery **before** Railway

Buzz requests (matches `HttpInstagramClient.fetch_business_discovery`):

```text
GET https://graph.facebook.com/{IG_USER_ID}
  ?fields=business_discovery.username(bringthebuzzover){username,name,profile_picture_url,biography,followers_count}
  &access_token={LONG_LIVED_USER_TOKEN}
```

Unversioned `https://graph.facebook.com/{id}` is what production code calls
today (`FACEBOOK_GRAPH_BASE` default). Samples use **v25.0** (current Graph
in Meta docs 2026-08). Either should work; if unversioned 400s, set
`FACEBOOK_GRAPH_BASE=https://graph.facebook.com/v25.0` on api only.

Expect `business_discovery.username` = `bringthebuzzover`. Then retry with a
nonsense username: Graph error / empty discovery → Buzz maps to `not_found`
or `not_professional`, **not** `unavailable`.

Age-gated professional accounts return no data (Meta limitation).

### 7. Set env (after smoke)

**Railway `api` production only** (lookup is not used by crons):

- `INSTAGRAM_BUSINESS_DISCOVERY_TOKEN`
- `INSTAGRAM_BUSINESS_DISCOVERY_IG_USER_ID`

Redeploy api (or wait for the next deploy). Same two keys in gitignored
`backend/.env` for local `/org/apply`.

Never commit `.env` or paste tokens into PRs.

### 8. Verify production

```text
curl -sS 'https://api.bringthebuzzover.com/api/orgs/instagram-lookup?username=bringthebuzzover'
```

`available: true`. Then open `/org/apply`, type `bringthebuzzover`, wait
~500ms: confirm card, not amber soft-fail.

## What not to do

- Do not point lookup at org Instagram Login tokens.
- Do not treat Retry lookup as a product bug while these vars are unset.
- Do not add Instagram Login scopes for this; Meta documents Facebook Login
  only.
- Do not block apply on this gap — soft-fail is PRODUCT §6.1.1.

## Related

- [`META.md`](../META.md) — Apply-time handle lookup (rate limits, cache, IP caps already in code).
- [`deploy.meta-business-verification`](deploy.meta-business-verification.md) — BV / Advanced Access; not required to mint an **admin** token for seeded lookup, required for System User / public non-tester login.
- `PRODUCT.md` §6.1.1 — confirm card vs unconfirmed submit.
