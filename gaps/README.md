# Gaps tracker (SOT)

This folder is the **only** living source of truth for product holes, silent
data loss, broken invariants, authz bugs, UX holes, and ops debt.

- One file per gap: `gaps/<id>.md` (filename stem must equal frontmatter `id`).
- Agents discover open work by listing `gaps/*.md` excluding this README,
  `CLUSTERS.md`, and `gaps/archive/`.
- **Execution queue:** [`CLUSTERS.md`](CLUSTERS.md) holds cluster order, locked
  approaches, and cluster status. It is not a second bug list.
- **Close policy:** move the file to `gaps/archive/<id>.md` and set
  `status: fixed` (add `closed_in: <commit>` when known). Do not delete.
- Statuses in the living folder: `open` | `in_progress` | `deferred` | `ops` | `wontfix`.
- Archive-only status: `fixed`.

Cluster execution: see [`.agents/skills/fix-gap-cluster/SKILL.md`](../.agents/skills/fix-gap-cluster/SKILL.md)
(`run next cluster` / `run cluster <id>`).

Do not recreate `KNOWN_GAPS.md`, triage tables, or parallel bug lists.
Historical audits under `private/reports/` are evidence only — promote into a
gap file or discard.

## Frontmatter schema

```yaml
---
id: surface.slug-here
title: One-line title
kind: unrecoverable | silent_loss | invariant_break | authz | ux_hole | ops | dead_code | test_gap | doc_drift
severity: P0 | P1 | P2 | P3
status: open | in_progress | deferred | ops | wontfix | fixed
surface: auth | org | brand | admin | drops | jobs | models | spa | deploy | product | openapi
closed_in: optional-short-sha  # archive only
evidence:
  - path: path/to/file.py
    note: one-sentence why
repro: |
  Short test / curl / SQL outline.
fix_when: |
  Acceptance criteria for archiving this file.
---
```

Body: notes, SQL probes, and links. Keep probes read-only-safe.

## Agent workflow

1. **Discover** → create `gaps/<id>.md` only (never append to a megafile).
2. **Cluster** → add the id to [`CLUSTERS.md`](CLUSTERS.md) (or park it) with a
   locked approach when batching work.
3. **Work** → set `status: in_progress`; cite `id` in commit/PR body.
4. **Done** → move to `gaps/archive/<id>.md`, set `status: fixed`, set `closed_in`
   to the fixing commit when known.
5. **Defer / ops / wontfix** → keep the file in `gaps/`; change `status` only.
6. PRODUCT “Later” is not a gap until it is a broken path today.

To run a cluster: `run next cluster` / `run cluster <id>` (see
`fix-gap-cluster` skill). That explores, plans todos, implements, gates CI,
archives — then **waits** for you to ask for commit/push.
