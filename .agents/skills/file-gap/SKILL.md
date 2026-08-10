---
name: file-gap
description: >-
  Turn a finding into a proper gaps/<id>.md with YAML frontmatter per
  gaps/README.md. Use when the user says file a gap, or when explore/simplify
  discovers a hole that must not stay chat-only.
---

# File a gap

Living shortcomings SOT is [`gaps/`](../../../gaps/) only. Schema: [`gaps/README.md`](../../../gaps/README.md).

## Steps

1. Confirm it is a **broken path today** (not a PRODUCT “Later” idea).
2. Choose `id` = `surface.slug` (filename stem must match), e.g. `auth.example-hole`.
3. Create `gaps/<id>.md` with frontmatter:

```yaml
---
id: surface.slug-here
title: One-line title
kind: unrecoverable | silent_loss | invariant_break | authz | ux_hole | ops | dead_code | test_gap | doc_drift
severity: P0 | P1 | P2 | P3
status: open
surface: auth | org | brand | admin | drops | jobs | models | spa | deploy | product | openapi
evidence:
  - path: path/to/file
    note: one-sentence why
repro: |
  Short test / curl / SQL outline.
fix_when: |
  Acceptance criteria for archiving.
---
```

4. Body: notes, read-only-safe probes, links. No secrets.
5. Optionally note the id under a cluster in [`gaps/CLUSTERS.md`](../../../gaps/CLUSTERS.md) **only** if batching — do not invent a parallel bug list.
6. Do **not** recreate `KNOWN_GAPS.md` or append to mega triage tables as SOT.

## Do not

- Delete gap files (archive when fixed).
- Un-park deferred/parked items unless the user names them.
- Change PRODUCT to “fix” a gap without explicit ask.
