---
id: spa.unmatched-route-blank
title: Unmatched SPA URLs render a blank page (no catch-all 404)
kind: ux_hole
severity: P2
status: fixed
surface: spa
evidence:
  - path: frontend/src/AppRoot.tsx
    note: SiteLayout path=* and nested admin path=* render NotFoundPage
  - path: frontend/src/pages/NotFoundPage.tsx
    note: 403-style 404 with Home and Log in links
  - path: frontend/e2e/marketing.spec.ts
    note: /org/admin shows 404 plus marketing chrome
  - path: frontend/e2e/admin.spec.ts
    note: authed /admin/no-such-page shows 404
repro: |
  Open /org/admin (or any path not listed in AppRoot) on www.
  Console: No routes matched location. Viewport stays white; #root empty.
  Network 401 /refresh and 404 /api/auth/dev-login are bootstrap, not the blank.
fix_when: |
  Unmatched public and admin URLs show a real 404 surface (chrome + copy
  locked). Nested splat under /admin so /admin/bogus is not an empty Outlet.
  Do not restore public/404.html. Playwright covers one unmatched path.
---

# Unmatched SPA URLs render blank

Fixed with a React splat `NotFoundPage` (not `public/404.html`). HTTP from
`serve -s` remains 200.

## What we removed (not a React 404)

`8f78639` (`spa.csp-blocks-gh-pages-inline`) deleted `frontend/public/404.html`.
That file was the spa-github-pages **redirect** (`/?/path` rehydrate) so GH
Pages could host an SPA. CSP (`script-src 'self'`) blocked the matching inline
script in `index.html`. www is Railway `serve -s`, which already serves
`index.html` for unknown paths (HTTP 200). Restoring `404.html` would fight CSP
and is unrelated to painting a not-found page.

Git history had **no** `NotFound` page or `<Route path="*">` in `AppRoot` before
this fix. The blank unmatched state was never shipped as a designed 404.

## Why it was blank

React Router v6 with no splat renders **nothing** (warning only). Pathless
`SiteLayout` never mounts. HTTP is still 200 from `serve -s`.
