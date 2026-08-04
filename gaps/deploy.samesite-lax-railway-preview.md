---
id: deploy.samesite-lax-railway-preview
title: SameSite=lax cookies break on cross-site Railway preview hosts
kind: ops
severity: P1
status: ops
surface: deploy
evidence:
  - path: DEPLOYMENT.md
    note: REFRESH_COOKIE_SAMESITE default lax; distinct *.up.railway.app are cross-site
repro: |
  FE and API on distinct railway.app hosts; Instagram callback / refresh omit cookies.
fix_when: |
  Preview/staging use same-site cookie setup or same eTLD+1 custom domains; documented for Railway previews.
---

Refresh / OAuth state cookies use `REFRESH_COOKIE_SAMESITE` (default `lax`) on
the API host. FE and API on distinct `*.up.railway.app` sites are cross-site for
cookies, so Instagram callback and refresh XHR omit them. Custom
`www` + `api` on the same eTLD+1 is fine; preview/staging pairs are not.
