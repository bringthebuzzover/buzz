---
id: auth.ig-oauth-mobile-app-hijack
title: Instagram OAuth on phones opens the Instagram app and fails
kind: ux_hole
severity: P1
status: fixed
surface: auth
evidence:
  - path: backend/app/services/instagram.py
    note: HttpInstagramClient.build_authorize_url appends #weblink (iOS AASA Universal Link exclusion)
  - path: backend/app/config.py
    note: INSTAGRAM_AUTHORIZE_URL default remains www.instagram.com/oauth/authorize (Meta Business Login host)
  - path: frontend/src/pages/auth/LoginPage.tsx
    note: Continue with Instagram → full-document nav to /api/auth/instagram/login
  - path: frontend/src/pages/onboarding/ConnectInstagramPage.tsx
    note: Connect with Instagram → window.location.href = bind-start authorizeUrl
  - path: frontend/src/pages/auth/ReconnectInstagramPage.tsx
    note: Reconnect with Instagram uses the same login() OAuth entry
repro: |
  On an iPhone with the Instagram app installed, open Buzz in Safari (or Chrome).
  Tap Continue / Connect / Reconnect with Instagram.
  Before the fix, the Instagram app opened and showed “something went wrong”.
  Authorize URLs now end with #weblink so iOS should keep the flow in the browser.
fix_when: |
  Phone OAuth stays in the browser through authorize → consent → redirect_uri
  for login, connect, and reconnect. Document residual Android risk if the
  iOS-only #weblink AASA exclusion is the ship. Do not switch to Facebook Login
  without a PRODUCT decision (META.md / PRODUCT §3.1).
---

# Instagram OAuth hijacked by the native app on phones

Shipped: every authorize URL from `HttpInstagramClient.build_authorize_url`
ends with `#weblink` (login 302, bind-start `authorizeUrl`, reconnect via
login). Instagram’s
[apple-app-site-association](https://www.instagram.com/.well-known/apple-app-site-association)
excludes that fragment from Universal Links; IG is reported to keep it across
OAuth hops
([Meta forum](https://developers.facebook.com/community/threads/922374286525063/)).

**Residual:** `#weblink` is iOS AASA only. Android App Links ignore fragments.
No helper copy (PRODUCT/UX ask). Facebook Login is still out.
