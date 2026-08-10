---
id: deploy.custom-domain-samesite-lax
title: Cut over www+api custom domains and retire SameSite=none
kind: ops
severity: P2
status: deferred
surface: deploy
evidence:
  - path: gaps/deploy.samesite-lax-railway-preview.md
    note: v1 locks Railway dual-host + SameSite=none for App Review; Phase 2 cutover deferred here
  - path: META.md
    note: target brand hosts www + api on bringthebuzzover.com
repro: |
  After samesite v1: SPA/API still on *.up.railway.app with SameSite=none.
  api.bringthebuzzover.com may still NXDOMAIN; www may still be GH Pages.
fix_when: |
  www and api.bringthebuzzover.com both serve Railway (custom domains);
  SPA rebuilt against api.*; FRONTEND_URL / INSTAGRAM_REDIRECT_URI / Meta
  URLs agree on www+api; REFRESH_COOKIE_SAMESITE=lax (+ Secure); Set-Cookie
  shows SameSite=lax; Instagram login E2E works; none retired from prod;
  docs call dual-host none historical.
---

## Follow-up (required after `ops-samesite` v1)

**Not the forever cookie topology.** `deploy.samesite-lax-railway-preview` /
cluster `ops-samesite` correctly keeps `SameSite=none` while SPA and API are
distinct `*.up.railway.app` hosts. That is right for App Review **until**
same-site brand domains exist.

Archiving the v1 gap must note: **Phase 2 cutover tracked here** — do not
claim prod is same-site/`lax` until this gap closes.

### In scope when un-parked (human + docs; agents need Railway/Meta OK)

1. Attach Railway custom domains for `www` + `api`.
2. Rebuild SPA `REACT_APP_API_URL=https://api.bringthebuzzover.com`.
3. Align Meta + env URLs to www/api.
4. Set `REFRESH_COOKIE_SAMESITE=lax`; verify Set-Cookie; retire `none`.
5. Update DEPLOYMENT/META docs.

### Dependency

Only after `ops-samesite` v1 checklist PASS (or abandoned). Do not flip to
`lax` while still on cross-site Railway dual-host.
