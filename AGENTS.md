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
5. **Never push to `main`** — it is protected. Feature-branch PR only ([Branching & main protection](README.md#branching--main-protection)).

Docs/rules/skills-only changes: commit when the user asks; `ci-local` not required unless app code was touched.

### Hard stops (ask first)

- PRODUCT / UX / behavior changes
- Railway, Meta dashboard, Resend, or DNS mutations
- Committing secrets (`.env`, tokens, `.cursor/mcp.json`)

## Repo skills

Read the skill file when the trigger matches. Skills live under [`.agents/skills/`](.agents/skills/).

| Skill | When |
| ----- | ---- |
| [`parallel-branch-swarm`](.agents/skills/parallel-branch-swarm/SKILL.md) | `swarm parallel`, parallel branches/slices, multi-branch handoff |
| [`ship-change`](.agents/skills/ship-change/SKILL.md) | Feature / fix / chore that is not a gap cluster |
| [`simplify-pass`](.agents/skills/simplify-pass/SKILL.md) | After implementation, before claiming done / before CI archive |
| [`react-patterns`](.agents/skills/react-patterns/SKILL.md) | Writing/reviewing React components |
| [`react-performance`](.agents/skills/react-performance/SKILL.md) | React/Next performance work |
| [`react-testing`](.agents/skills/react-testing/SKILL.md) | Component tests vs E2E boundary |
| [`ui-fit-finish`](.agents/skills/ui-fit-finish/SKILL.md) | `run ui fit-finish` / `run UI token pass` — shells + form primitives |

Cursor **user** skills under `~/.cursor/skills-cursor/` are IDE-local and **not** repo SOT.
