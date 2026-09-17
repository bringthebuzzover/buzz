---
id: auth.ig-long-lived-get-unsupported
title: Documented long-lived GET /access_token returns Graph 100 in production
kind: ops
severity: P0
status: open
surface: auth
evidence:
  - path: backend/app/services/instagram.py
    note: exchange_for_long_lived uses the documented GET graph.instagram.com/access_token
  - path: gaps/deploy.meta-business-verification.md
    note: App Live, privileges empty — Standard Access; non-testers fail Graph
  - path: frontend/src/utils/instagramCallbackCopy.ts
    note: API UNAUTHORIZED maps to "Instagram didn't connect" / didn't hand Buzz a session
repro: |
  After 1f389a9, org Connect on www.bringthebuzzover.com.
  SPA GET /auth/instagram/callback 200; POST /api/auth/instagram/callback 401
  "Instagram long-lived token exchange failed."
  API log 2026-09-17 20:32–20:34Z:
  status=400 type=IGApiException message=Unsupported request - method type: get code=100
fix_when: |
  A known Instagram Tester (invite accepted) completes Connect through the
  documented GET long-lived exchange. If a tester still gets Graph 100, reopen
  as a code gap — do not switch to POST; Access Token docs mark Creating as
  unsupported. Non-tester public login stays on deploy.meta-business-verification.
---

# Graph 100 on documented long-lived GET

Short-lived code exchange is fixed (`auth.ig-token-exchange-data-wrap`). The next
hop is [Access Token](https://developers.facebook.com/docs/instagram-platform/reference/access_token/)
(updated 2026-03-09):

- **Reading:** `GET https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=…&access_token=…`
- **Creating / Updating / Deleting:** not supported (do not POST)

Production returns Graph **400** `IGApiException` **100** “Unsupported request -
method type: get”. That string is Meta’s usual Standard Access miss for an
Instagram handle that is **not** an accepted [Instagram Tester](https://developers.facebook.com/docs/development/build-and-test/app-roles/)
— testers can GET; other accounts get this 100. Community threads that “fixed”
it with POST are fighting the same access gate; official CRUD still forbids
Creating on this node.

Pilot handles in [`META.md`](../META.md) §D: `lawrence_granda`,
`melissaachowdhury` (must Accept at instagram.com/accounts/manage_access).
Campus org handles need a tester invite before Connect until Advanced Access.

Chrome AutoClicker / LMS / `Receiving end does not exist` lines are extensions.
