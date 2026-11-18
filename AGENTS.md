# AGENTS.md — Buzz agent operating guide

Buzz connects brands with campus student organizations for campaign drops, applications, and Instagram engagement tracking. Two portals (brand vs org) do not overlap for real users; admins may View as.

Docs, decisions, gaps and ideas live in the private `bringthebuzzover/buzz-ops` repo (open it as the second root of the BUZZ workspace; start at its `AGENTS.md`). Cloud agents without access get a context pack in their brief instead.

This repo is **agent-first**: humans review and commit; agents implement. Deep-investigate first, evidence-driven, and verify subagent output before acting.

## Sources of truth

In this repo:

| Concern | Location |
| ------- | -------- |
| HTTP contract | [`openapi.json`](openapi.json) → `frontend` `npm run gen:api` |
| Backend details | [`backend/README.md`](backend/README.md) |
| Repo skills | [`.agents/skills/`](.agents/skills/) (see [Repo skills](#repo-skills)) |

## Working norms

1. **Deep investigation first** (proportional to risk) — relevant product docs, code, tests; brainstorm options before the first patch.
2. **Evidence-driven** — cite code, repros, tests, or CI. Say when guessing. Product/UX forks → **stop and ask**.
3. **Clean UX + full correctness** — fix the surface end-to-end (API + SPA + jobs as needed); no silent half-fixes.
4. **Report holes honestly** — file them where they belong; never bury them in chat. Report residual risk when done.
5. **Parallel subagents** — for non-trivial or forked questions, launch concurrent explore agents (backend vs frontend, as-built vs intent, option A vs B). Parent synthesizes. Skip for single-file needles.
6. **Always verify subagent findings** — subagent output is a hypothesis, not truth. Spot-check cited paths against code and tests, resolve contradictions, discard what does not reproduce. Never rubber-stamp parallel research.

**Anti-pattern:** drive-by edits, skipped exploration, untracked debt, or trusting subagent summaries without re-reading the evidence.

## Branching

Normal app work uses short-lived feature branches based on `staging`, with PRs into `staging`. App promotion to `main` requires separate production approval; never push, force-push, or delete `main`. Skill-source-only work follows the branch policy in [Repo skills](#repo-skills). Commit, push, PR, and merge actions require explicit authorization. Older no-staging/main-only claims in README are stale; verify current operational targets with the caller. Protection/check-name background: [Branching & main protection](README.md#branching--main-protection).

## Code rules

The HTTP contract is [`openapi.json`](openapi.json). After any route or schema change, run `cd backend && poetry run python scripts/dump_openapi.py`, then `cd frontend && npm run gen:api`. Never commit `.cursor/mcp.json`, `.env*` or secrets.

## Definition of done

For any **behavior-touching** change:

1. Run the **simplify-pass** skill ([`.agents/skills/simplify-pass/SKILL.md`](.agents/skills/simplify-pass/SKILL.md)).
2. Run **`./scripts/ci-local.sh`** from repo root; must be green before claiming ready to commit (includes Playwright E2E). This is the gate for **opening a PR** too: never open or push a PR for Buzz unless local CI passed on that exact commit. A green GitHub run later does not substitute for it. The calling bot runs it serially on a fresh local test database; native CLI subagents run only authorized focused checks and report the full gate as pending; they do not run this script, including when a repo skill prescribes it.
3. **Stop** — do not commit or push unless the user explicitly asks.
4. Stress Playwright ×N **only if the user asks** (`workflow_dispatch` / `[e2e-stress-N]`).
5. **Never push to `main`** — it is protected. Feature-branch PR only (into `staging`) ([Branching & main protection](README.md#branching--main-protection)).

Docs/rules/skills-only changes: commit when the user asks; `ci-local` is not required for the commit itself, but a **PR** from any branch still needs it green.

### Hard stops (ask first)

- PRODUCT / UX / behavior changes
- Railway, Meta dashboard, Resend, or DNS mutations
- Un-parking `parked` / deferred work unless the user names the id (see `fix-gap-cluster`)
- Committing secrets (`.env`, tokens, `.cursor/mcp.json`)

## Repo skills

Read the skill file when the trigger matches. Canonical BUZZ skill sources live on `main` under [`.agents/skills/`](.agents/skills/); prepare skill-source-only work on feature branches based on `main`, targeting `main` for review. The same nine skill files are intended for every branch: discover the active checkout's instructions, source locations, stack, and applicable steps before use. Availability on other branches requires separately authorized Git propagation; editing these sources does not distribute them or promise automatic sync. Regular app feature work targets `staging`. Commit, push, PR, and merge actions still require explicit authorization. OpenBot installations are separate consumers; editing these sources does not publish, install, or update them. Provider/host CLI procedures and general measured browser audits remain outside this repo.

| Skill | When |
| ----- | ---- |
| [`buzz-coding-agent`](.agents/skills/buzz-coding-agent/SKILL.md) | BUZZ implementation/review brief, CLI handoff, branch/check/approval boundaries |
| [`buzz-design-and-brand`](.agents/skills/buzz-design-and-brand/SKILL.md) | BUZZ concept-first UI workflow, visual review, staging match, logos, visual trims, verification guides |
| [`buzz-staging-operations`](.agents/skills/buzz-staging-operations/SKILL.md) | Staging/lab verification, gates/allowlists, test access, service read/write boundaries |
| [`fix-gap-cluster`](.agents/skills/fix-gap-cluster/SKILL.md) | `run next cluster`, `run cluster <id>`, `swarm gaps` |
| [`ship-change`](.agents/skills/ship-change/SKILL.md) | Feature / fix / chore that is not a gap cluster |
| [`simplify-pass`](.agents/skills/simplify-pass/SKILL.md) | Post-change scope/reuse/docs/gaps checks, before verification and caller handoff |
| [`file-gap`](.agents/skills/file-gap/SKILL.md) | New finding → create `gaps/<id>.md` correctly |
| [`react-patterns`](.agents/skills/react-patterns/SKILL.md) | React 18 SPA components, state/forms/accessibility, shared primitives, measured rendering performance |
| [`react-testing`](.agents/skills/react-testing/SKILL.md) | Installed Jest/React DOM harness, smoke tests, component vs Playwright boundary |

Cursor **user** skills under `~/.cursor/skills-cursor/` are IDE-local and **not** repo SOT.

## MCP (Buzz-relevant)

Use project/user MCP when it helps. **Read** is fine; **mutate** needs explicit user OK.

| Server | Use for | Do not |
| ------ | ------- | ------ |
| **Railway** | Status, logs, vars (read), docs; mutations via **direct** tools only (`update-service`, `set-variables`, `list-variables`, `redeploy`, …) | Redeploy / set vars / accept-deploy / create services without explicit OK. **Minimize `railway-agent`** — do ops fully with direct tools (or human dashboard/CLI); do not ask the agent to delete/stage vars. |
| **GitHub** | PRs, checks, issues, file reads for this repo | Push or force-push `main`, surprise merges; prefer `gh` when user rules say so |
| **Hostinger** | Registrar / nameservers for `bringthebuzzover.com` | Assume Lawrence hPanel; mutate NS without explicit OK; commit API tokens; treat Hostinger DNS zone as SOT (Cloudflare is) |
| **Cloudflare** | Authoritative DNS + apex→www redirect for `bringthebuzzover.com` | Orange-cloud `www`/`api` (breaks Railway TLS); delete personal zones; mutate without OK |
| **Resend** | Domains, transactional send debug (`list-emails` / logs) | Enable Receiving on apex; create/delete API keys without OK; commit keys to the repo; treat as human inbox. **Domain mutate only with explicit OK** (see hard stops) |
| **Meta Developer Tools** | Read the Buzz Meta app settings, app review, compliance, API usage | Paste Hosts / submit App Review / Business Verification; webhook `manage`/`test` without explicit OK; put OAuth config in repo `.cursor/mcp.json` (user MCP only). Grant Buzz on consent (**Read** default; **Manage** only for webhook work) |
| **Buzz Admin** | Local stdio [`tools/buzz-admin-mcp/`](tools/buzz-admin-mcp/): inspect allowlisted tables, patch profile/copy fields, run `/api/admin/*` actions. Defaults to production API. | Brand/org agents; impersonate; raw SQL; secrets (`password_hash`, IG token, `token_hash`, Graph user ids, `token_version`). Mutate only with explicit user OK. Never commit admin email/password |

**Railway notes (hard-won):** Prefer full manual via direct MCP tools. Skip `railway-agent` unless the user explicitly asks. `set-variables` can only set/overwrite — it **cannot delete** keys; remove vars in the Railway dashboard or `railway variable delete` (CLI must be logged in). If anything claims a var was deleted, **the parent must re-check with `list-variables`** (staged/`null` is not gone).

Personal MCPs (e.g. Hevy, Obsidian) are **out of scope** for Buzz work — ignore them here.

Never commit `.cursor/mcp.json` (local secrets). Meta DevTools MCP and Resend MCP live in **user** Cursor MCP config; hard stop on Meta dashboard / Resend domain mutations still applies.
