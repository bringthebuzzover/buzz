---
id: spa.admin-tables-clip-mobile
title: Admin 6–7 column tables clip at 375px with no stacked fallback
kind: ux_hole
severity: P3
status: deferred
surface: spa
evidence:
  - path: frontend/src/components/admin/AdminPrimitives.tsx
    note: AdminTable only wraps overflow-x-auto; at 375px Contact / View as / Open sit off-screen with no fade
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
