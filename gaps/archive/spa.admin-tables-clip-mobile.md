---
id: spa.admin-tables-clip-mobile
title: Admin 6–7 column tables clip at 375px with no stacked fallback
kind: ux_hole
severity: P3
status: fixed
surface: spa
evidence:
  - path: frontend/src/components/admin/AdminPrimitives.tsx
    note: AdminTable hybrid cards below md (title + 2-col labeled facts + actions)
  - path: frontend/docs/ui-defect-map.md
    note: "c1 — deferred because stacking or hiding columns changes what an admin sees"
repro: |
  Sign in as admin, open /admin/orgs (or brands, drops, requests) at 375px.
  The rightmost columns are cut off. Horizontal scroll exists but has no affordance.
fix_when: |
  PRODUCT picks a small-viewport strategy (stacked cards, priority columns, or
  an explicit scroll hint) that does not silently drop data. Implement that
  one strategy in AdminTable so all four list pages inherit it. Do not hide
  columns without an explicit copy/UX decision.
---

# Admin tables clip on phones

Found in the UI revamp audit (c1). Fit-and-finish did not stack or hide columns
because that changes the admin information hierarchy. Desktop is consistent;
this gap is the missing mobile strategy only.

**Locked (2026-09-10, Paper):** below `md`, `AdminTable` rows are **hybrid cards**
(title + 2-col labeled facts + trailing actions). Desktop stays a table. All
fields remain visible; nothing is hidden.

**Fixed:** `AdminTable` injects header labels onto cells; below `md` rows are
hybrid cards and the wrapper does not sideways-scroll. Playwright covers
`/admin/orgs|brands|requests|drops` at 375px.
