---
name: fix-gap-cluster
description: >-
  Run a gap cluster from gaps/CLUSTERS.md: explore first, plan and create todos,
  implement, full CI gate, archive fixed gaps, then STOP and wait for the user
  to ask for commit/push. Use when the user says run next cluster, run cluster
  <id>, swarm gaps, or fix gap cluster.
---

# Fix gap cluster

## When to use

User intent matches:

- `run next cluster`
- `run cluster <id>` (e.g. `run cluster jobs-metrics`)
- `swarm gaps`
- `execute gap cluster`

Do **not** use for inventing new gaps, full-repo audits, or un-parking deferred
items unless the user names those gap ids explicitly.

## Sources of truth

| What | Where |
|------|--------|
| Bug details | `gaps/<id>.md` |
| Execution order + locked approach | `gaps/CLUSTERS.md` |
| Close policy | `gaps/README.md` + `.cursor/rules/gaps-tracker.mdc` |

Never recreate `KNOWN_GAPS.md`. Never delete gap files — archive them.

## Execution spine (every run)

Follow these phases **in order**. Do not skip Explore/Plan and jump to code.

### Phase 1 — Select

1. **Read** [`gaps/CLUSTERS.md`](../../gaps/CLUSTERS.md).
2. **Select cluster**
   - `run next cluster` → first cluster with `status: pending` (skip `parked` /
     `ops` / `done`). If the first actionable cluster is already `in_progress`
     from a prior interrupted run, resume that one.
   - `run cluster <id>` → that id only.
   - `ops-deploy` requires the user to name it; never auto-pick as “next”.
3. **Honor `stop_if`** — if a listed condition is true, stop and ask before coding.

### Phase 2 — Explore (read-only)

4. Re-read each gap file in the cluster (`gaps/<id>.md`).
5. Read the evidence paths and related tests/callers. Confirm the locked
   `approach` in `CLUSTERS.md` still matches the code. Note any drift.
6. If exploration finds a product fork not covered by `approach` / `stop_if`,
   **stop and ask** — do not invent a new approach silently.

### Phase 3 — Plan / tasks

7. Create a todo list (TodoWrite) with concrete implementation steps derived
   from the cluster `approach` (one todo per major step + CI + archive).
8. Briefly tell the user the cluster id, gap ids, and the planned task list
   **before** editing production code (a short message is enough; do not wait
   for a second “go” unless `stop_if` fired).
9. Set cluster `status: in_progress` in `CLUSTERS.md`.
10. Set each listed gap file `status: in_progress`.

### Phase 4 — Execute

11. **Implement** the cluster `approach` (locked). Do not expand to neighboring
    clusters. Mark todos completed as you go.

### Phase 5 — Full CI / E2E gate

12. Run the full gate (must be green before archive):
    - Backend: `poetry run black --check app/ tests/`, `ruff check app/ tests/`,
      `mypy app/`, `pytest`
    - If OpenAPI/schemas changed: `poetry run python scripts/dump_openapi.py`
      clean vs committed `openapi.json`; frontend `npm run gen:api` clean vs
      `schema.ts`
    - Frontend (if touched): `npx tsc --noEmit`, `npm run build`
    - If the repo’s CI includes Playwright E2E and this cluster touched
      frontend user flows, run the same frontend E2E job locally when practical;
      otherwise note it as remaining for CI on push.
13. On green: **archive** each fixed gap → `gaps/archive/<id>.md`, `status: fixed`
    (leave `closed_in` empty until commit).
14. Set cluster `status: done` in `CLUSTERS.md`.

### Phase 6 — Stop for commit/push

15. **Do not commit or push** unless the user explicitly asks.
16. Reply with: cluster id, gaps archived, CI summary, remaining `pending`
    clusters, and that the tree is ready for commit/push when they say so.

## Non-negotiables

- Do not edit plan files under `.cursor/plans/` unless the user asks.
- Do not implement `parked` gaps unless the user names them.
- Do not strip Batch 1 token_version / access JWT checks or Batch 2–4 fixes
  while touching nearby code.
- Prefer existing patterns; no drive-by refactors.
- Ops/Railway mutations need explicit user OK even inside `ops-deploy`.

## If CI fails

Fix in the same cluster run; do not archive on red CI. If blocked >2 attempts on
the same error class, stop and report (still no commit).
