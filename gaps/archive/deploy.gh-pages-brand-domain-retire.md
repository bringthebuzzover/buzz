---
id: deploy.gh-pages-brand-domain-retire
title: GitHub Pages still holds brand custom domain; Lawrence cannot clear it
kind: ops
severity: P2
status: fixed
surface: deploy
evidence:
  - path: gaps/archive/deploy.apex-hostinger-forward-blocked.md
    note: Cloudflare apex→www live; Pages remove no longer required for apex health
  - path: frontend/package.json
    note: gh-pages deploy script removed; frontend/public/CNAME deleted in tree
repro: |
  gh api user → login lawrencegranda
  gh api repos/ShannonLin284/buzz → permissions.admin=false (push only)
  gh api -X PUT/DELETE repos/ShannonLin284/buzz/pages → HTTP 404
  gh api repos/ShannonLin284/buzz/pages → cname=www.bringthebuzzover.com still set
  (cert domains include www + apex)
fix_when: |
  GitHub Pages no longer lists bringthebuzzover.com / www as custom domain
  (cname cleared or Pages unpublished). www still serves Railway
  (server railway-hikari). Repo stays free of Pages deploy + public/CNAME.
---

# Retire GitHub Pages brand domain

## Context

Plan A Phase 4: remove brand custom domain from GitHub Pages after www moved
to Railway. Repo-side retire is done (`CNAME` file gone, `gh-pages` npm deploy
removed). **Settings → Pages** still had `cname: www.bringthebuzzover.com`.

**2026-08-10:** Apex → www is now Cloudflare (see archived
`deploy.apex-hostinger-forward-blocked`). Clearing Pages is **hygiene only** —
safe for apex; no longer blocks brand DNS.

## Resolution (2026-08-11)

Shannon cleared the custom domain on `ShannonLin284/buzz` Settings → Pages
(UI; Lawrence lacks admin). Verified:

- `gh api repos/ShannonLin284/buzz/pages` → `cname: null` (site still at
  `https://shannonlin284.github.io/buzz/` from `gh-pages` branch — optional)
- `bringthebuzzover/buzz` → no Pages site (404)
- `https://www.bringthebuzzover.com` → `server: railway-hikari`, HTTP 200
- Repo: no `frontend/public/CNAME`, no `gh-pages` npm deploy

## Historical blocker

- Actor `lawrencegranda` had **push**, not **admin**, on `ShannonLin284/buzz`.
- Pages mutate API returned **404**; domain unchanged until Shannon UI clear.

## Verify probes (pass state)

```bash
gh api repos/ShannonLin284/buzz/pages --jq '{status,cname}'
# expect cname null

curl -4 -sI https://www.bringthebuzzover.com | rg -i 'server:|HTTP/'
# expect railway-hikari + 200
```
