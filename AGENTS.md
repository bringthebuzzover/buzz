# AGENTS.md — Buzz agent operating guide

Buzz connects brands with campus student organizations for campaign drops, applications, and Instagram engagement tracking. Two portals (brand vs org) do not overlap for real users; admins may View as.

Docs, decisions, gaps and ideas live in the private `bringthebuzzover/buzz-ops` repo (open it as the second root of the BUZZ workspace; start at its `AGENTS.md`). Cloud agents without access get a context pack in their brief instead.

This repo is **agent-first**: humans review and commit; agents implement. Deep-investigate first, evidence-driven, and verify subagent output before acting.

## Code rules

The HTTP contract is [`openapi.json`](openapi.json). After any route or schema change, run `cd backend && poetry run python scripts/dump_openapi.py`, then `cd frontend && npm run gen:api`. Never commit `.cursor/mcp.json`, `.env*` or secrets.

## Definition of done

For any **behavior-touching** change:

1. Run the **simplify-pass** skill ([`.agents/skills/simplify-pass/SKILL.md`](.agents/skills/simplify-pass/SKILL.md)).
2. Run **`./scripts/ci-local.sh`** from repo root; must be green before claiming ready to commit (includes Playwright E2E).
3. **Stop** — do not commit or push unless the user explicitly asks.
4. Stress Playwright ×N **only if the user asks** (`workflow_dispatch` / `[e2e-stress-N]`).
5. **Never push to `main`** — it is protected. Feature-branch PR only (into `staging`) ([Branching & main protection](README.md#branching--main-protection)).

Docs/rules/skills-only changes: commit when the user asks; `ci-local` not required unless app code was touched.

### Hard stops (ask first)

- PRODUCT / UX / behavior changes
- Railway, Meta dashboard, Resend, or DNS mutations
- Committing secrets (`.env`, tokens, `.cursor/mcp.json`)

## Repo skills

Read the skill file when the trigger matches. Canonical BUZZ skill sources live on `main` under [`.agents/skills/`](.agents/skills/); prepare skill-source-only work on feature branches based on `main`, targeting `main` for review. The same nine skill files are intended for every branch: discover the active checkout's instructions, source locations, stack, and applicable steps before use. Availability on other branches requires separately authorized Git propagation; editing these sources does not distribute them or promise automatic sync. Regular app feature work targets `staging`. Commit, push, PR, and merge actions still require explicit authorization. OpenBot installations are separate consumers; editing these sources does not publish, install, or update them. Provider/host CLI procedures and general measured browser audits remain outside this repo.

| Skill | When |
| ----- | ---- |
| [`buzz-coding-agent`](.agents/skills/buzz-coding-agent/SKILL.md) | BUZZ implementation/review brief, CLI handoff, branch/check/approval boundaries |
| [`buzz-design-and-brand`](.agents/skills/buzz-design-and-brand/SKILL.md) | BUZZ visual work, pen-first design, staging match, logos, visual trims, verification guides |
| [`buzz-staging-operations`](.agents/skills/buzz-staging-operations/SKILL.md) | Staging/lab verification, gates/allowlists, test access, service read/write boundaries |
| [`fix-gap-cluster`](.agents/skills/fix-gap-cluster/SKILL.md) | `run next cluster`, `run cluster <id>`, `swarm gaps` |
| [`ship-change`](.agents/skills/ship-change/SKILL.md) | Feature / fix / chore that is not a gap cluster |
| [`simplify-pass`](.agents/skills/simplify-pass/SKILL.md) | Post-change scope/reuse/docs/gaps checks, before verification and caller handoff |
| [`file-gap`](.agents/skills/file-gap/SKILL.md) | New finding → create `gaps/<id>.md` correctly |
| [`react-patterns`](.agents/skills/react-patterns/SKILL.md) | React 18 SPA components, state/forms/accessibility, shared primitives, measured rendering performance |
| [`react-testing`](.agents/skills/react-testing/SKILL.md) | Installed Jest/React DOM harness, smoke tests, component vs Playwright boundary |

Cursor **user** skills under `~/.cursor/skills-cursor/` are IDE-local and **not** repo SOT.
