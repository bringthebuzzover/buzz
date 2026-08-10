---
id: deploy.meta-brand-url-cutover
title: Meta dashboard still on Railway hosts after brand DNS cutover
kind: ops
severity: P1
status: ops
surface: deploy
evidence:
  - path: META.md
    note: Hosts table still lists Railway SPA/API as App Review SOT; brand Target is www+api
  - path: backend/app/services/instagram.py
    note: authorize + code exchange use INSTAGRAM_REDIRECT_URI only — must exactly match Meta allowlist
  - path: gaps/archive/deploy.custom-domain-samesite-lax.md
    note: sibling infra cutover archived; Meta paste deferred so this gap is not lost
repro: |
  After Plan A env flip to www/api: start Instagram login from https://www.bringthebuzzover.com.
  If Meta still lacks the www OAuth redirect URI, Instagram rejects redirect_uri.
  Privacy/terms/deauth Meta fields may still point at frontend-production-3819 / api-production-fbbc1.
fix_when: |
  Meta dashboard OAuth redirect, privacy, terms, data-deletion, and deauthorize URLs match the
  Target list below (character-for-character, trailing-slash rules per META.md). Optional IG login
  smoke on www succeeds. Archive this file only after that paste (Phase 8 of Plan A).
---

## Why this exists

Plan A cuts over DNS/Railway/env/`SameSite=lax` **before** Meta. Temporary OAuth breakage is
accepted (no users). This gap is the living reminder to finish Meta — do not close it when
`deploy.custom-domain-samesite-lax` archives.

## Target URLs (paste only — Phase 8)

| Role | Exact URL |
| ---- | --------- |
| OAuth redirect | `https://www.bringthebuzzover.com/auth/instagram/callback` |
| Privacy | `https://www.bringthebuzzover.com/privacy` |
| Terms | `https://www.bringthebuzzover.com/terms` |
| Data deletion | `https://www.bringthebuzzover.com/data-deletion` |
| Deauthorize | `https://api.bringthebuzzover.com/api/auth/instagram/deauthorize` |

Dashboard: Instagram → API setup with Instagram login → Business login settings (plus app
privacy/terms/data-deletion fields per [META.md](../META.md) §C).

No DNS, Railway env, or cookie changes in that step — URLs only. Optional: keep Railway OAuth
redirect listed until IG smoke passes, then remove.
