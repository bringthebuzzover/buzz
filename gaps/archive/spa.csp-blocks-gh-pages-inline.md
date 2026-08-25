---
id: spa.csp-blocks-gh-pages-inline
title: Production CSP blocks leftover GitHub Pages inline scripts on every www load
kind: ops
severity: P3
status: fixed
closed_in: 8f78639
surface: spa
evidence:
  - path: frontend/public/index.html
    note: inline spa-github-pages rehydrate script (script-src 'self' forbids it)
  - path: frontend/public/404.html
    note: matching GH Pages deep-link redirect script; unused under serve -s
  - path: frontend/public/serve.json
    note: "script-src 'self'" with no hash/nonce/unsafe-inline (intentional after deploy.spa-missing-csp)
  - path: gaps/archive/deploy.spa-missing-csp.md
    note: Wave E added the CSP; did not move or delete the GH Pages inline scripts
  - path: gaps/archive/deploy.gh-pages-brand-domain-retire.md
    note: www is Railway serve -s; GH Pages custom domain already cleared
repro: |
  Open https://www.bringthebuzzover.com/ with DevTools console.
  Expect: "Executing inline script violates ... script-src 'self'" and Chrome
  offering hash sha256-QMm9EwEAMRA/5g1wtr4+Vq8ctgGVF8ynS01bscETRYI=.
  App still mounts (webpack runtime is a file, not this snippet).
  Deep links work via `serve -s`, not via 404.html.
fix_when: |
  Production www loads with no CSP inline-script violation. Either delete
  404.html + the index.html rehydrate snippet (preferred; GH Pages is not the
  www host), or move the snippet to an external .js file allowed by
  script-src 'self'. Do not add 'unsafe-inline'. Hash allowlisting is brittle
  across builds. Live curl still shows the CSP header.
---

# CSP vs leftover GitHub Pages SPA hack

`deploy.spa-missing-csp` shipped a strict page CSP on `serve.json`. The SPA
still contains the classic spa-github-pages pair: `404.html` rewrites unknown
paths to `/?/…`, and `index.html` has an **inline** script that rehydrates
that query back into `history`. `script-src 'self'` blocks that inline script
on every www document load.

On Railway (`npm run start:prod` → `serve -s build`) the hack is a no-op:
deep links already serve `index.html`, and the rehydrate branch only runs when
`location.search` starts with `?/`. Blocking it does not break routing. It
does spam the console and would break GH Pages deep links if that host were
used again.

Not related to `/api/orgs/me` 401s (separate gap `auth.revoked-access-skips-refresh`).
