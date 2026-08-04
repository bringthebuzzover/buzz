---
id: admin.undeny-silent-no-email
title: Admin un-deny does not notify the org by email
kind: ux_hole
severity: P2
status: deferred
surface: admin
evidence:
  - path: backend/app/services/admin.py
    note: un-deny path has no email dispatch
repro: |
  Deny then un-deny org; org receives no email that access was restored.
fix_when: |
  Un-deny sends a clear notification or PRODUCT documents intentional silence.
---

Confirmed in gap audit triage as deferred. Admin can restore access without telling the org.
