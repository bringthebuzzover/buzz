---
id: deploy.meta-brand-url-cutover
title: Meta dashboard still on Railway hosts after brand DNS cutover
kind: ops
severity: P1
status: fixed
surface: deploy
evidence:
  - path: META.md
    note: Hosts SOT is www+api; §C paste + §D testers confirmed 2026-08-11
  - path: backend/app/services/instagram.py
    note: authorize + code exchange use INSTAGRAM_REDIRECT_URI only — must exactly match Meta allowlist
  - path: gaps/archive/deploy.custom-domain-samesite-lax.md
    note: sibling infra cutover archived; this gap was Phase 8 Meta paste residual
repro: |
  After Plan A env flip to www/api: start Instagram login from https://www.bringthebuzzover.com.
  If Meta still lacks the www OAuth redirect URI, Instagram rejects redirect_uri.
  Privacy/terms/deauth Meta fields may still point at frontend-production-3819 / api-production-fbbc1.
fix_when: |
  Meta dashboard OAuth redirect, privacy, terms, data-deletion, and deauthorize URLs match the
  Target list below (character-for-character, trailing-slash rules per META.md). Optional IG login
  smoke on www succeeds. Archive this file only after that paste (Phase 8 of Plan A).
---

## Closed (ops 2026-08-11)

| Check | Evidence |
| ----- | -------- |
| Privacy / Terms / Data deletion (App Basic) | Meta MCP `basic_settings` → www Hosts URLs; `has_privacy_policy: true`; app **live** |
| Deauthorize + data-deletion (Business login) | Human confirm (MCP does not expose IG Business login fields) |
| OAuth redirect www | Live `GET /api/auth/instagram/login` → `redirect_uri=https://www.bringthebuzzover.com/auth/instagram/callback`; production IG login smoke succeeded after MEDIA_CREATOR + Fernet fixes |
| Scopes | Live authorize requests only `instagram_business_basic` + `instagram_business_manage_insights` |

Residual Meta launch path (not this gap): META.md **§E** Business Verification → **§F** App Review Advanced Access → **§G** public login. MCP still: `business_verification_passes: false`, privileges `[]`.

## Target URLs (Phase 8 — pasted)

| Role | Exact URL |
| ---- | --------- |
| OAuth redirect | `https://www.bringthebuzzover.com/auth/instagram/callback` |
| Privacy | `https://www.bringthebuzzover.com/privacy` |
| Terms | `https://www.bringthebuzzover.com/terms` |
| Data deletion | `https://www.bringthebuzzover.com/data-deletion` |
| Deauthorize | `https://api.bringthebuzzover.com/api/auth/instagram/deauthorize` |
