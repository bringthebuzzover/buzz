---
name: parallel-branch-swarm
description: >-
  Orchestrate multiple disjoint work slices on parallel git branches (cloud
  agents or local worktrees): lock decisions, conflict/limit analysis, handoff
  commit, launch workers with explore→plan→CI→branch commit, then orchestrator
  merge, verify acceptance, one integrated ci-local, push on ask. Use when the
  user says swarm parallel, parallel branches, parallel slices, run N in
  parallel, or wants the multi-branch handoff used for independent gaps/clusters.
---

# Parallel branch swarm

Orchestrator + **N** branch workers for **disjoint** slices. Agent map:
[`AGENTS.md`](../../../AGENTS.md).

**Not** a substitute for [`fix-gap-cluster`](../fix-gap-cluster/SKILL.md)
when work is one tightly coupled cluster. Prefer that skill for serial
single-cluster runs.

## When to use

User intent matches:

- `swarm parallel` / `parallel branches` / `parallel slices`
- Run **multiple** independent gaps/clusters/features at once on separate branches
- Explicit “like the edu / filters / logistics handoff”

## When not to use

- Same files/routes/schemas must change together (merge hell)
- Open PRODUCT / `stop_if` forks not yet locked
- Ops mutations (Railway / Meta / Resend) — human path
- User asked for a single `run next cluster` only

## Sources of truth (Buzz)

| What | Where |
|------|--------|
| Gap details / `fix_when` | `gaps/<id>.md` |
| Cluster approach / `stop_if` | `gaps/CLUSTERS.md` |
| Behavior | [`PRODUCT.md`](../../../PRODUCT.md) |
| DoD | [`AGENTS.md`](../../../AGENTS.md) — simplify-pass + `./scripts/ci-local.sh` |
| Shell habit | [`.cursor/rules/shell-one-by-one.mdc`](../../../.cursor/rules/shell-one-by-one.mdc) |

Orchestrator: prefer **one shell command per tool call**.

---

## Spine (orchestrator)

Follow **in order**. Do not launch workers before phases 0–3.

### Phase 0 — Lock decisions

1. List candidate slices (gap ids / brief task specs).
2. Resolve PRODUCT / UX / `stop_if` asks with the user.
3. Write locks into living SOT (`gaps/<id>.md`, cluster `approach` / cleared
   `stop_if`) so workers do not re-ask.
4. Stop if any slice still has an open fork.

### Phase 1 — Conflict and limit analysis (before launch)

Produce a short **partition matrix** and show it to the user (or record in the
orchestration plan). For **each** slice, determine:

| Check | What to decide |
|-------|----------------|
| **Owns** | Primary files, routes, schemas, PRODUCT §§ |
| **Must not touch** | Explicit out-of-scope paths (sibling slices) |
| **Shared touchpoints** | e.g. `gaps/CLUSTERS.md`, `openapi.json`, `AdminPrimitives` — mark “conflicts OK at merge” or assign a single owner |
| **Coupling risk** | Same model/migration/OpenAPI path? → merge slices or serialize |
| **Worker limits** | Cloud vs worktree; no local MCP in cloud; isolated DB name if local Postgres races |
| **Acceptance SOT** | Gap `fix_when` / Locked v1 / cluster approach path |
| **Merge order hint** | Prefer order that reduces OpenAPI / shared-file pain |

**Hard stop:** if two slices must both own the same migration head, same route
handler, or same PRODUCT paragraph in incompatible ways → do **not** parallelize;
fall back to `fix-gap-cluster` / serial `ship-change`.

Only proceed to handoff when the matrix shows **disjoint ownership** (shared
files explicitly allowed as merge-time conflicts).

### Phase 2 — Handoff commit

5. Commit + **push** lock/docs updates to `main` so every worker starts from the
   same remote ref (cloud clones remote; dirty local tree is invisible).
6. Note the handoff SHA; workers must use `main` at/after that SHA.

### Phase 3 — Launch workers

7. Prefer **cloud** Task (`environment: cloud`, `cloud_base_branch: main`,
   `run_in_background: true`). On failure (no GitHub app, rate limit, auth) →
   **fallback** `best-of-n-runner` / worktrees with named branches
   `fix/<slice-slug>`.
8. Launch **one Task per slice in the same turn** (parallel).
9. Each prompt must include: locked SOT paths, owns / must-not-touch from the
   matrix, worker spine below, “do not merge or push `main`”, final report
   fields (branch, PR URL, SHAs, ci-local result, residual risk).

### Phase 4 — Await

10. Track completion reports. Nudge stuck workers (dirty tree, no commit).
11. Do **not** start merge until all slices report done (or user aborts a slice).

### Phase 5 — Merge

12. Fetch branches. Merge into local `main` using the matrix merge-order hint
    (default: fewer shared-file touches first, or documented preference).
13. Resolve conflicts (`CLUSTERS.md`, OpenAPI/schema, shared primitives).
14. Reconcile cluster/queue status so archived gaps and `status: done` match reality.

### Phase 6 — Verify

15. For each slice, check archived/`fix_when` (or task acceptance) against
    **merged** code. Spot-check; do not trust worker summaries alone
    ([`AGENTS.md`](../../../AGENTS.md) verify-subagents norm).
16. Add residual tests if verify found holes that should gate the push.

### Phase 7 — Integrated CI

17. Run **one** full gate from repo root:

    ```bash
    ./scripts/ci-local.sh
    ```

    Must be green (includes Playwright). Prefer an isolated `DATABASE_URL` if
    local DBs were contended during the swarm.

### Phase 8 — Ship

18. Push `main` only when CI is green **and** the user asks (or already
    authorized “merge and push if green”).
19. Report: SHAs, PRs, residuals, whether any new `gaps/<id>.md` were filed.

---

## Worker spine (each branch agent)

Mandatory; no skipping:

1. Read locked SOT on `main` (≥ handoff SHA) — do not re-ask PRODUCT.
2. Explore with parallel subagents; **parent worker verifies** claims.
3. Plan + short todos; set own gap `in_progress` if applicable.
4. Implement **only** locked approach / owns list.
5. [`simplify-pass`](../simplify-pass/SKILL.md) then full `./scripts/ci-local.sh`
   (isolated DB name recommended when sharing Postgres).
6. Archive **only** its gap (`status: fixed`); may touch `CLUSTERS.md` (conflicts OK).
7. Commit + push **feature branch**; open PR optional.
8. **Never** merge/push `main`.
9. Final report: branch, PR URL, commit SHA(s), ci-local result, residual risk.

---

## Orchestrator todos (minimum)

- `conflict-matrix` — phase 1 partition / limits
- `handoff-push` — locks on `main`
- `launch-N` — workers started
- `await-N` — reports collected
- `merge-verify-ci` — merge + acceptance + `ci-local`
- `push-main` — only when authorized

---

## Non-negotiables

- No launch before conflict/limit matrix and locked decisions.
- No PRODUCT drift without prior ask + SOT write.
- Workers never push `main`; orchestrator never skips integrated `ci-local`.
- Never act on unverified subagent findings.
- File new gaps for out-of-scope holes ([`file-gap`](../file-gap/SKILL.md)); do not bury in chat.
