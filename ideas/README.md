# Ideas / brainstorm (not committed product)

Park **future bets and brainstorm** here so chat does not become the only
memory. This folder is **not** a source of truth for shipped behavior.

| Concern | Location |
| ------- | -------- |
| What the product **is** today | [`PRODUCT.md`](../PRODUCT.md) |
| What is **broken** today | [`gaps/`](../gaps/) |
| What we might **build later** | `ideas/` (this folder) |

## Rules

- One theme per file: `ideas/<slug>.md` (e.g. `ai.md`).
- Ideas are **not** gaps. Do not file a gap until something is a broken path
  **today** (see [`gaps/README.md`](../gaps/README.md)).
- Promoting an idea into the product requires an explicit PRODUCT / UX decision
  (hard stop in [`AGENTS.md`](../AGENTS.md)) — do not implement from an idea
  file alone.
- Prefer updating an existing theme file over creating near-duplicates.
- Status in frontmatter is advisory only (`seed` | `exploring` | `parked` |
  `promoted` | `discarded`). `promoted` means it earned PRODUCT/gap follow-up,
  not that it shipped.

## Suggested frontmatter

```yaml
---
id: theme-slug
title: Short title
status: seed | exploring | parked | promoted | discarded
updated: YYYY-MM-DD
---
```
