---
id: admin.remove-participant-from-drop
title: Admin cannot remove a live org from one drop
kind: ux_hole
severity: P3
status: open
surface: admin
evidence:
  - path: frontend/src/pages/admin/AdminDropDetailPage.tsx
    note: Drop roster has late-add and shipments, no remove-participant control
  - path: backend/app/routes/admin.py
    note: No route to withdraw one accepted application without erasing the org
  - path: gaps/archive/drops.erased-org-metrics-leak.md
    note: Erase now drops seats for a deleted org; a live org still has no per-drop removal
repro: |
  Accept an org on a drop. Admin drop detail can late-add another org and edit
  shipments. It cannot remove that accepted org from this drop without erasing
  the whole account.
fix_when: |
  PRODUCT names an admin remove-from-drop action. It unlinks that seat's posts,
  drops the application and its shipments, and frees the capacity and allocated
  units, without erasing the org or touching its other campaigns. Tests cover
  a live sibling on the same drop staying put.
---

# Admin cannot remove a live participant

Erasing an org now removes it from every drop. That does not help when the
org should stay on Buzz and leave only one campaign.

Not included with `drops.erased-org-metrics-leak` because it is a new admin
action: confirm UI, unlink (one-post-one-campaign), shipments, allocated
units, capacity, and whether the org or brand is emailed. Needs a PRODUCT
pass before anyone builds it.
