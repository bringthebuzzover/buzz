---
closed_in: e27a7f6
id: deploy.github-repo-owner-shannon
title: Railway still Sources ShannonLin284/buzz; canonical Git is bringthebuzzover/buzz @ main
kind: ops
severity: P1
status: fixed
surface: deploy
evidence:
  - path: gaps/archive/deploy.gh-pages-brand-domain-retire.md
    note: Pages custom domain cleared by Shannon 2026-08-11
  - path: DEPLOYMENT.md
    note: Docs target bringthebuzzover/buzz @ main; Railway Source must match
repro: |
  gh repo view bringthebuzzover/buzz → exists, default_branch=main, mvp merged (PR #1)
  local origin → https://github.com/bringthebuzzover/buzz.git
  Cursor Railway MCP get-service-config (frontend/api/crons) → still
  source.repo=ShannonLin284/buzz branch=mvp (rechecked 2026-08-10).
  railway-agent repeatedly claims bringthebuzzover/buzz @ main — DO NOT TRUST;
  parent must verify with Cursor get-service-config only.
  Cursor update-service tool cannot change Source; need UI serviceConnect
  or human reconnect after Railway GitHub App on org.
fix_when: |
  All 8 Railway code services Source = bringthebuzzover/buzz @ main with correct
  rootDirectories (/frontend or /backend). Parent get-service-config confirms
  (do not trust railway-agent alone). Optional: tiny push to main triggers deploy
  from the org repo. Then archive this gap.
---

# Canonical Git moved; Railway Source lagging

## Done

| Step | Status |
| ---- | ------ |
| Org `bringthebuzzover` (Lawrence sole admin) | Done |
| Empty `bringthebuzzover/buzz` + mirror (branches/tags) | Done |
| Local `origin` → org repo | Done |
| PR `mvp` → `main` ([#1](https://github.com/bringthebuzzover/buzz/pull/1)) merged | Done |
| Default branch `main` | Done |
| Do **not** add Shannon to org | Done |

## Blocked — you must do in UI

Railway MCP `update-service` cannot change Source. **railway-agent updates did not persist** (verified still ShannonLin284/`mvp`). Likely cause: **Railway GitHub App not installed on org `bringthebuzzover`**.

### 1) Authorize Railway on the org

1. Open [Railway dashboard](https://railway.com) → account → **GitHub** / integrations  
   or GitHub → org **bringthebuzzover** → **Settings → GitHub Apps** → install **Railway**
2. Grant access to repo **`buzz`** (all repos or selected).

### 2) Reconnect each code service (×8)

Project **buzz** → each service → **Settings → Source**:

| Service | Root directory |
| ------- | -------------- |
| frontend | `/frontend` |
| api + all 6 crons | `/backend` |

- Repo: **`bringthebuzzover/buzz`**
- Branch: **`main`**
- Keep build/start/cron/env as-is

Services: frontend, api, cron-notify-reminders, cron-token-refresh, cron-autolink-scan, cron-token-cleanup, cron-metric-sync, cron-drop-autoclose.

### 3) Ping agent

We re-run `get-service-config` and archive this gap when Source matches.

## Legacy

`ShannonLin284/buzz` remains public/abandoned (no admin to archive). Stop pushing there. Pages custom domain later cleared — sibling [`deploy.gh-pages-brand-domain-retire`](deploy.gh-pages-brand-domain-retire.md).

## Closed

2026-08-10: Cursor Railway MCP `get-service-config` on all 8 code services →
`bringthebuzzover/buzz` @ `main` (frontend `/frontend`, api+crons `/backend`).
Push `e27a7f6` triggered deploys from org `main` (not Shannon/`mvp`).
