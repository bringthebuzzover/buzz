---
id: admin.reopen-live-leaves-finalized
title: Live Reopen apply window does not reopen apply
kind: invariant_break
severity: P1
status: open
surface: admin
evidence:
  - path: backend/app/services/admin.py
    note: reopen_drop for live stages sets manual_reopen but leaves finalized_at
repro: |
  Drop in drop_active; admin Reopen apply window; apply_to_drop still closed because applicant_selection_finalized_at set.
fix_when: |
  Live reopen either clears finalize (truly reopens apply) or the button/copy is removed/corrected so admins are not misled.
---

For `drop_active` / `drop_finished`, `reopen_drop` sets `manual_reopen=true` but
**leaves** `applicant_selection_finalized_at`. `apply_to_drop` and feed status still
treat the drop as closed. Admin UI still offers “Reopen apply window.”
