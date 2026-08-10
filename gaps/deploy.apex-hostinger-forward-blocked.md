---
id: deploy.apex-hostinger-forward-blocked
title: Hostinger cannot apex→www (API 2047 + UI); apex still needs non-GH redirect
kind: ops
severity: P2
status: open
surface: deploy
evidence:
  - path: gaps/archive/deploy.custom-domain-samesite-lax.md
    note: Plan A Phase 3b intended Hostinger 302→301 apex→www
  - path: DEPLOYMENT.md
    note: Brand DNS cutover; apex redirect ownership
  - path: gaps/deploy.gh-pages-brand-domain-retire.md
    note: sibling Phase 4 — Pages custom domain still set; Lawrence lacks admin
repro: |
  Hostinger MCP domains_createDomainForwardingV1 (and Hostinger UI):
  domain=bringthebuzzover.com → https://www.bringthebuzzover.com
  → API [Domains:2047] / UI "You cannot redirect your domain to itself".
  dig A bringthebuzzover.com → 185.199.* (GitHub Pages).
  curl -sI https://bringthebuzzover.com → Server: GitHub.com, Location: www.
fix_when: |
  Apex bringthebuzzover.com permanently redirects to
  https://www.bringthebuzzover.com with Server ≠ GitHub.com (e.g. Cloudflare
  redirect rule after NS cutover). Apex no longer depends on GitHub Pages A
  records for that redirect.
---

# Apex → www blocked on Hostinger

## Context

Plan A Phase 3b: Hostinger forward apex → `https://www.bringthebuzzover.com`
(302 then 301).

**Blocked on Hostinger (confirmed):**

| Path | Result |
| ---- | ------ |
| MCP `domains_createDomainForwardingV1` | `[Domains:2047] Domain and redirect url cannot be the same` |
| Hostinger UI Forwarding | “You cannot redirect your domain to itself” |

Railway docs also list Hostinger as lacking apex CNAME/ALIAS flattening for
attaching the root directly to Railway.

## Interim (today)

- Apex **A** → `185.199.*` (GitHub Pages); Pages **301** → www.
- **www** is already on Railway (Plan A Phases 1–3).
- Apex works **only while** GH Pages still serves the brand custom domain.

## Future options (pick one)

1. **Cloudflare (preferred “B”)** — Point Hostinger NS to Cloudflare; recreate
   `www`/`api` CNAME+TXT → Railway; Redirect Rule apex →
   `https://www.bringthebuzzover.com` (301). Then apex provenance ≠ GitHub.
2. **Keep GH Pages as apex-only redirect** — Accept GitHub forever for apex;
   do not claim this gap fixed. Couples to Pages staying published.
3. **Railway apex + flattening DNS** — Attach `bringthebuzzover.com` on
   frontend (Hobby allows 2 customs; www already uses one). Still needs a
   DNS host that supports apex ALIAS/CNAME flattening (typically Cloudflare,
   not Hostinger parking NS).

**Not viable:** Hostinger built-in domain forward apex → www on the same
registration.

## Sibling

Pages Remove / admin gate: [`deploy.gh-pages-brand-domain-retire.md`](deploy.gh-pages-brand-domain-retire.md).
Removing Pages **before** option 1 lands will break apex until Cloudflare (or
equivalent) is live — acceptable only if we knowingly accept a broken apex
window.

## Verify probes

```bash
# Fail while GH-owned: Server: GitHub.com + A 185.199.*
curl -4 -sI http://bringthebuzzover.com | rg -i 'server:|location:'
curl -4 -sI https://bringthebuzzover.com | rg -i 'server:|location:'
dig @1.1.1.1 +short A bringthebuzzover.com
```

Pass when Location still → www and `Server` is not `GitHub.com`.
