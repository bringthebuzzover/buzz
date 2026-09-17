---
id: auth.ig-token-exchange-data-wrap
title: Instagram code exchange ignores Meta's documented `{data:[{access_token}]}` body
kind: unrecoverable
severity: P0
status: fixed
surface: auth
evidence:
  - path: backend/app/services/instagram.py
    note: exchange_code now unwraps data[] as well as the legacy flat object
  - path: frontend/src/utils/instagramCallbackCopy.ts
    note: API UNAUTHORIZED maps to "Instagram didn't connect" / didn't hand Buzz a session
repro: |
  Org Connect or Login with Instagram on www.bringthebuzzover.com.
  Instagram redirects to /auth/instagram/callback?code=…&state=… (SPA 200).
  POST /api/auth/instagram/callback returns 401 UNAUTHORIZED (~500–900ms).
  Production 2026-09-17: bind-start 200 then callback 401 at 17:04 and 17:05 UTC;
  returning /instagram/login 302 then callback 401 at 16:53 UTC.
fix_when: |
  HttpInstagramClient.exchange_code accepts both the documented data[] token
  payload and the legacy flat object. Connect and returning login can complete
  for Instagram Testers. Safe logs record Meta error_type/error_message or
  response keys without tokens/secrets.
---

# Instagram OAuth callback 401 for every connect

Buzz CSRF binding is succeeding (469–893ms 401s are Meta RTT, not the ~10ms
`OAUTH_STATE_INVALID` cookie miss). Redirect URI on live login 302 is
`https://www.bringthebuzzover.com/auth/instagram/callback` (no trailing slash).
`SameSite=Lax` is correct for www→api on the same eTLD+1.

[Business Login Step 2](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/)
documents a **200** body:

```json
{ "data": [ { "access_token": "…", "user_id": "…", "permissions": "…" } ] }
```

`exchange_code` only read `body["access_token"]` / `body["user_id"]`, so a
documented success became `UNAUTHORIZED`. HTTP 400s from Meta were also
swallowed (`from None`, no log).

Fix: unwrap `data[0]`, keep the flat shape, request `/me` `user_id` as well as
`id`, log Meta error fields/keys without tokens. Needs a production API deploy
before live Connect works.

Chrome `Receiving end does not exist` / AutoClicker / LMS lines in the client
console are extensions, not Buzz.

**Residual:** app is Live with no Advanced Access
(`gaps/deploy.meta-business-verification.md`). Non-tester campus orgs can
still fail Graph even when testers succeed.
