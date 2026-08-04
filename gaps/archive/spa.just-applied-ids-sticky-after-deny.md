---
id: spa.just-applied-ids-sticky-after-deny
title: Feed Already applied sticks after denial
kind: ux_hole
severity: P1
status: fixed
closed_in: 1dcd270
surface: spa
evidence:
  - path: frontend/src/pages/org/OrgDropFeedPage.tsx
    note: justAppliedIds never cleared when server alreadyApplied=false
repro: |
  Apply; get denied; feed still shows Already applied until remount.
fix_when: |
  Clear or reconcile justAppliedIds when API returns alreadyApplied=false.
---

`OrgDropFeedPage` keeps `justAppliedIds` in component state and forces
`alreadyApplied: true` for those drop ids forever. After a denial the API returns
`alreadyApplied: false` (re-apply allowed), but the card stays disabled until remount.

Fixed by removing the page-level sticky Set and relying on `useApplyToDrop`'s
optimistic cache flip + post-invalidate re-assert.
