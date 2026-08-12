---
id: admin.drops-list-filters-multiselect
title: Admin drops list filters should be combinable dropdown multiselects
kind: ux_hole
severity: P2
status: fixed
closed_in: ca28fa6
surface: admin
evidence:
  - path: frontend/src/pages/admin/AdminDropsPage.tsx
    note: Two FilterChips rows for stage and attention; each chip link rebuilds only its own query param
  - path: frontend/src/components/admin/AdminPrimitives.tsx
    note: FilterChips builds basePath?param=value and drops sibling params, so stage and attention cannot combine
  - path: backend/app/routes/admin.py
    note: GET /api/admin/drops accepts a single optional stage and attention string
  - path: backend/app/services/admin_read.py
    note: list_drops equality-filters stage; attention uses one _attention_clause bundle
repro: |
  Open /admin/drops?attention=no_tracking, then click a stage chip.
  URL becomes /admin/drops?stage=<stage> — attention is gone.
  There is no way to select multiple stages or multiple attention keys.
fix_when: |
  - /admin/drops exposes two dropdown multiselects (Stage, Attention), not chip rows.
  - Selecting values in one dimension does not clear the other; both appear in the URL and both apply.
  - Multiple stages ⇒ OR (IN); multiple attentions ⇒ OR of attention clauses; stage ∩ attention when both set.
  - Empty selection omits that param (same as “all”).
  - Overview deep links like /admin/drops?attention=awaiting_finalization still work (single value).
  - Unknown stage/attention values still 400.
  - Shareable URL round-trips selection after reload.
  - Backend tests cover multi-stage, multi-attention, combined, and invalid values; openapi + FE schema regenerated.
---

# Admin drops list — dropdown multiselect filters

## Problem

Admin drops list has **two filter dimensions** (tracker `stage`, ops `attention`) that should be **combinable** and **multi-value** dropdowns. Today each dimension is a single-select `FilterChips` row whose links **wipe the other query param**, and the API only accepts one value per dimension.

These are **not** org/brand category filters — stage + attention only. PRODUCT has no admin drop-list filter UX requirements; this is an ops UX hole on an existing surface.

## Locked v1 approach

### FE — dropdown multiselect for both dimensions

1. Replace both `FilterChips` rows on `AdminDropsPage` with two **`FilterMultiSelect`** controls (labels: **Stage**, **Attention**).
2. Options:
   - Stage: `STAGE_ORDER` + `STAGE_LABELS` (no “All stages” option — empty = all).
   - Attention: existing five keys/labels from `ATTENTION_FILTERS` (drop the null “Everything” chip; empty = all).
3. URL is source of truth via `useSearchParams`:
   - Read with `searchParams.getAll("stage")` / `getAll("attention")`.
   - Write by **merging** into the current params (never rebuild from a single param alone).
   - Toggle: add/remove value; if last value removed, delete the key.
4. Trigger button shows summary: `Stage` / `Stage (2)` / first label + `+N`; same for Attention. Selected rows use buzz coral accent to match admin chips/pills.
5. Panel: checkbox list, click-outside / Escape to close, keyboard-usable enough for admin ops (button + checkboxes). No new dependency.

### BE — multi-value query (LOCKED; not client-only)

1. Change `GET /api/admin/drops` to accept repeated query keys:
   - `stage: list[str] | None = Query(default=None)`
   - `attention: list[str] | None = Query(default=None)`
2. `list_drops(..., stage: list[str] | None = None, attention: list[str] | None = None)`:
   - Validate every value against `BrandTrackerStage` / `_ATTENTION_FILTERS`; any unknown ⇒ 400.
   - Empty list / omitted ⇒ no filter on that dimension.
   - **Stages:** `Drop.brand_tracker_stage.in_(stages)` (OR).
   - **Attentions:** `or_(*[and_(*_attention_clause(a, now)) for a in attentions])` (OR within dimension).
   - **Across dimensions:** AND.
3. Single-value URLs (`?attention=no_tracking`) remain valid. Overview badge links in `labels.ts` need no changes.
4. Regen openapi + FE schema; update `useAdminDrops` for `string[]` + repeated keys.

### Query encoding (LOCKED)

**Repeated keys**, not comma-separated:

```
/admin/drops?stage=request_received&stage=awaiting_products&attention=no_tracking
```

### Reuse vs new component (LOCKED)

- **New** `FilterMultiSelect` in `AdminPrimitives` (admin design-system cohesion).
- **Do not** overload `FilterChips` (orgs/brands still use it).
- **Do not** change AdminOrgs/AdminBrands filter UX in this gap.

### File touch list

| Area | Files |
| ---- | ----- |
| FE UI | `AdminDropsPage.tsx`, `AdminPrimitives.tsx` |
| FE data | `useAdminHooks.ts` (`useAdminDrops`) |
| BE | `routes/admin.py`, `services/admin_read.py` |
| Contract | `openapi.json`, `frontend/src/api/generated/schema.ts` (regen) |
| Tests | `backend/tests/test_admin_panel.py` |

### Non-goals / stop_if

**Non-goals:** org/brand category filters; pagination; migrating other admin lists off `FilterChips`; client-only filter path; PRODUCT edits; CSV encoding.

**Confirmed 2026-08-11 (handoff):** keep OR-within / AND-across dimensions.
Do **not** implement XOR dimensions or AND-within-attention.

**stop_if:** list volume forces pagination design before multi-filter ships — ask.
