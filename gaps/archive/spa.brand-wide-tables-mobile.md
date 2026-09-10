---
id: spa.brand-wide-tables-mobile
title: Brand compare and applicant tables have no small-viewport strategy
kind: ux_hole
severity: P3
status: fixed
surface: spa
evidence:
  - path: frontend/src/components/brand/ApiCompareDropsTable.tsx
    note: stacked blocks below md; table above md
  - path: frontend/src/pages/brand/BrandDropDetailPage.tsx
    note: applicant roster stacked cards below md (checkbox + prose)
  - path: frontend/docs/ui-defect-map.md
    note: deferred — a sticky column or fade is new UI, not a token swap
repro: |
  Brand dashboard on a 375px viewport — Compare drops shows ~3 of 5 columns.
  Brand drop detail with a non-empty roster — applicant table scrolls sideways
  with no shadow or stacked fallback.
fix_when: |
  PRODUCT names one pattern for wide brand tables (stack rows, sticky first
  column, or a visible scroll cue). Apply it to compare-drops and the
  applicant roster. Do not add a sticky column as a drive-by.
---

# Brand wide tables on mobile

Same class of hole as `spa.admin-tables-clip-mobile`, on the brand portal.
The token pass reduced cell padding; it did not invent a responsive table.

**Locked (2026-09-10, Paper):** below `md`, brand **applicants** and **compare
drops** use **stacked cards** (checkbox + prose, not labeled 2-col). Desktop
stays a table. `ApiDropOrgTable` was already stacked — no change.

**Fixed:** exclusive card vs table render via `useMdUp`; Playwright covers
the brand dashboard at 375px.
