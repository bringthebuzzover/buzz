---
name: fix-gap-cluster
description: >-
  Execute the next (or named) gap cluster from gaps/CLUSTERS.md end-to-end:
  mark gaps in_progress, implement the locked approach, full CI gate, archive
  fixed gaps, commit and push to mvp. Use when the user says run next cluster,
  run cluster <id>, swarm gaps, or fix gap cluster.
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

1. **Read** [`gaps/CLUSTERS.md`](../../gaps/CLUSTERS.md).
2. **Select cluster**
   - `run next cluster` → first cluster with `status: pending` (skip `parked` / `ops` / `done`).
   - `run cluster <id>` → that id only.
   - `ops-deploy` requires the user to name it; never auto-pick as “next”.
3. **Honor `stop_if`** — if a listed condition is true before or during work, stop and ask; do not invent product decisions.
4. Set cluster `status: in_progress` in `CLUSTERS.md`.
5. Set each listed gap file `status: in_progress`.
6. **Implement** exactly the cluster `approach` (locked). Re-read gap bodies for evidence paths; do not expand scope to neighboring clusters.
7. **CI gate** (must be green before archive):
   - Backend: `poetry run black --check app/ tests/`, `ruff check app/ tests/`, `mypy app/`, `pytest`
   - If OpenAPI/schemas changed: `poetry run python scripts/dump_openapi.py` clean vs committed `openapi.json`; frontend `npm run gen:api` clean vs `schema.ts`
   - Frontend (if touched): `npx tsc --noEmit`, `npm run build`
8. **Archive** each fixed gap: move `gaps/<id>.md` → `gaps/archive/<id>.md`, set `status: fixed`. Leave `closed_in` for the commit step.
9. Set cluster `status: done` in `CLUSTERS.md` (or leave `in_progress` only if partially blocked by `stop_if`).
10. **Commit + push** to current branch (`mvp` unless user said otherwise) without asking:
    - One primary commit for the fix; optional tiny follow-up for `closed_in: <short-sha>` on archived files (prefer including `closed_in` in a second commit rather than amend).
    - Use HEREDOC commit messages; cite cluster id and gap ids in the body.
    - Do not force-push; do not skip hooks.
11. Reply with: cluster id, gaps archived, commit SHAs, CI summary, what remains `pending`.

## Non-negotiables

- Do not edit plan files under `.cursor/plans/` unless the user asks.
- Do not implement `parked` gaps unless the user names them.
- Do not strip Batch 1 token_version / access JWT checks or Batch 2–4 fixes while touching nearby code.
- Prefer existing patterns; no drive-by refactors.
- Ops/Railway mutations need explicit user OK even inside `ops-deploy`.

## If CI fails

Fix in the same cluster run; do not archive or push red CI. If blocked >2 attempts on the same error class, stop and report.
