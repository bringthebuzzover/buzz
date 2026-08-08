# AGENTS.md — Buzz agent operating guide

Buzz connects brands with campus student organizations for campaign drops, applications, and Instagram engagement tracking. Two portals (brand vs org) do not overlap for real users; admins may View as.

**Behavior / UX SOT:** [`PRODUCT.md`](PRODUCT.md) — read relevant §§ before changing a surface. Do not restate PRODUCT rules in this file, in rules, or in [`ARCHITECTURE.md`](ARCHITECTURE.md).

This repo is **agent-first**: humans review and commit; agents implement. Follow the norms and DoD below.

---

## Sources of truth

| Concern | Location |
| ------- | -------- |
| Product behavior & UX | [`PRODUCT.md`](PRODUCT.md) |
| As-built system | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| Living bugs / holes | [`gaps/`](gaps/) (`gaps/<id>.md`) |
| Fix queue / locked approaches | [`gaps/CLUSTERS.md`](gaps/CLUSTERS.md) |
| HTTP contract | [`openapi.json`](openapi.json) → `frontend` `npm run gen:api` |
| Deploy / cookies / Railway | [`DEPLOYMENT.md`](DEPLOYMENT.md) |
| Meta / Instagram app | [`META.md`](META.md) |
| Test layers & CI | [`TESTING.md`](TESTING.md) |
| Backend details | [`backend/README.md`](backend/README.md) |

Rules and skills **point** here; they must not copy PRODUCT §§.

**Shortcomings:** discover with `gaps/*.md` (exclude `README.md`, `CLUSTERS.md`, `gaps/archive/`). Do not invent a second mega-list.

---

## Working norms

1. **Deep investigation first** (proportional to risk) — PRODUCT §§, code, tests, related gaps; brainstorm options before the first patch.
2. **Evidence-driven** — cite code, repros, tests, PRODUCT, or CI. Say when guessing. Product/UX forks → **stop and ask**.
3. **Clean UX + full correctness** — fix the surface end-to-end (API + SPA + jobs as needed); no silent half-fixes.
4. **Gaps honesty** — file or update `gaps/<id>.md` for holes; never bury in chat. Check related gaps when touching a surface; report residual risk when done.
5. **Parallel subagents** — for non-trivial or forked questions, launch concurrent explore agents (backend vs frontend, PRODUCT vs as-built, option A vs B, correctness vs UX). Parent synthesizes. Skip for single-file needles or trivial edits.
6. **Always verify subagent findings** — subagent output is a hypothesis, not truth. Before acting on it (edits, user claims, DoD), the parent **must** spot-check: open cited paths, confirm claims against code/PRODUCT/tests, resolve contradictions between subagents, and discard or re-investigate anything that does not reproduce. Never rubber-stamp parallel research.

**Anti-pattern:** drive-by edits, skipped explore, untracked debt, serial research that should have been parallel POVs, or trusting subagent summaries without re-reading the evidence.

---

## Definition of done

For any **behavior-touching** change:

1. Run the **simplify-pass** skill ([`.agents/skills/simplify-pass/SKILL.md`](.agents/skills/simplify-pass/SKILL.md)).
2. Run **`./scripts/ci-local.sh`** from repo root; must be green before claiming ready to commit (includes Playwright E2E).
3. **Stop** — do not commit or push unless the user explicitly asks.
4. Stress Playwright ×N **only if the user asks** (`workflow_dispatch` / `[e2e-stress-N]`).

Docs/rules/skills-only changes: no PRODUCT edits unless asked; commit when the user asks; `ci-local` not required unless app code was touched.

### Hard stops (ask first)

- PRODUCT / UX / behavior changes
- Railway, Meta dashboard, or Resend domain mutations
- Un-parking `parked` / deferred gaps unless the user names the id
- Committing secrets (`.env`, tokens, `.cursor/mcp.json`)

---

## Repo skills

Read the skill file when the trigger matches. Skills live under [`.agents/skills/`](.agents/skills/).

| Skill | When |
| ----- | ---- |
| [`fix-gap-cluster`](.agents/skills/fix-gap-cluster/SKILL.md) | `run next cluster`, `run cluster <id>`, `swarm gaps` |
| [`ship-change`](.agents/skills/ship-change/SKILL.md) | Feature / fix / chore that is not a gap cluster |
| [`simplify-pass`](.agents/skills/simplify-pass/SKILL.md) | After implementation, before claiming done / before CI archive |
| [`file-gap`](.agents/skills/file-gap/SKILL.md) | New finding → create `gaps/<id>.md` correctly |
| [`react-patterns`](.agents/skills/react-patterns/SKILL.md) | Writing/reviewing React components |
| [`react-performance`](.agents/skills/react-performance/SKILL.md) | React/Next performance work |
| [`react-testing`](.agents/skills/react-testing/SKILL.md) | Component tests vs E2E boundary |

Cursor **user** skills under `~/.cursor/skills-cursor/` are IDE-local and **not** repo SOT.

---

## MCP (Buzz-relevant)

Use project/user MCP when it helps. **Read** is fine; **mutate** needs explicit user OK.

| Server | Use for | Do not |
| ------ | ------- | ------ |
| **Railway** | Status, logs, vars (read), docs | Redeploy, set vars, accept-deploy, create services without explicit OK |
| **GitHub** | PRs, checks, issues, file reads for this repo | Force-push, surprise merges; prefer `gh` when user rules say so |

Personal MCPs (e.g. Hevy, Obsidian) are **out of scope** for Buzz work — ignore them here.

Never commit `.cursor/mcp.json` (local secrets).

---

## Gaps workflow (pointer)

Schema and close policy: [`gaps/README.md`](gaps/README.md). Always-on rule: [`.cursor/rules/gaps-tracker.mdc`](.cursor/rules/gaps-tracker.mdc). Cluster execution: `fix-gap-cluster` skill.
