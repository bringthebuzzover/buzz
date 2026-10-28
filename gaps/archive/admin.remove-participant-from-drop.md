---
id: admin.remove-participant-from-drop
title: Admin can remove one participant from one drop
kind: ux_hole
severity: P3
status: fixed
surface: admin
closed_in:
evidence:
  - path: backend/app/services/remove_participant.py
    note: Confirmed delete of one seat, its shipments, link, and linked post
  - path: backend/app/models/admin_audit_event.py
    note: Append-only participant_removed row with no foreign keys
  - path: frontend/src/pages/admin/AdminDropDetailPage.tsx
    note: Type remove to confirm on each applicant
  - path: PRODUCT.md
    note: §7.1 documents shipment deletion and unchanged published capacity
repro: |
  Accept an org on a drop, link a post, and optionally add a shipment. Admin
  drop detail had no way to remove that seat. Erase froze the metrics instead
  of dropping them, so the Meta Review test org stayed in the drop totals.
fix_when: |
  POST /api/admin/drops/{drop_id}/applications/{application_id}/remove with
  confirm "remove" deletes that seat, its shipments, its post link, and the
  linked post. That drop's totals, allocated units, and accepted count fall.
  Published capacity is unchanged. The action is audit-logged. A sibling org
  on the same drop is untouched.
---

# Remove one participant from one drop

Erase freezes campaign metrics. This action is the explicit way to drop a
seat for test data or a mistake, including erased test org
`798bf694-9ebf-41fc-8fda-57eec7f15e1a` on the Meta Review test drop.

Shipments on that seat are deleted (tracking numbers included) rather than
blocking the removal, so a test org with a tracking number can still be
cleared. Published capacity is not edited. Allocated units fall because the
application row is gone.

The audit row stores counts and whether the account was already erased. It
does not store handles, captions, or tracking numbers. A still-active org can
have the same media rediscovered by a later sync. An erased org is not synced.
