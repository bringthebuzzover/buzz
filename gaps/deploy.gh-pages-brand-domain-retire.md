---
id: deploy.gh-pages-brand-domain-retire
title: GitHub Pages still holds brand custom domain; Lawrence cannot clear it
kind: ops
severity: P2
status: ops
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
removed). **Settings → Pages** still has `cname: www.bringthebuzzover.com`.

**2026-08-10:** Apex → www is now Cloudflare (see archived
`deploy.apex-hostinger-forward-blocked`). Clearing Pages is **hygiene only** —
safe for apex; no longer blocks brand DNS.

## Current blocker

- Actor `lawrencegranda` has **push**, not **admin**, on `ShannonLin284/buzz`.
- Pages mutate API returns **404**; domain unchanged.
- Ask sent to **Shannon** (repo owner) to clear custom domain in UI.
- **Waiting on Shannon.**

## Coupling / order

Cloudflare apex redirect is **already live**. Pages Remove can proceed whenever
Shannon clears the custom domain; apex stays healthy.

## Shannon UI checklist

1. https://github.com/ShannonLin284/buzz → **Settings → Pages**
2. Clear / remove custom domain `www.bringthebuzzover.com` and save
3. Optional: unpublish Pages / stop `gh-pages` branch deploy
4. Do **not** change Cloudflare DNS or Railway

## Verify probes

```bash
# Pass when cname null / Pages gone
gh api repos/ShannonLin284/buzz/pages --jq '{status,cname,domains:.https_certificate.domains}'

# www must stay Railway
curl -4 -sI --resolve www.bringthebuzzover.com:443:$(dig @1.1.1.1 +short A p29bzdj1.up.railway.app | head -1) \
  https://www.bringthebuzzover.com | rg -i 'server:|HTTP/'
```
