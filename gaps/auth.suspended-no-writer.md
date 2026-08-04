---
id: auth.suspended-no-writer
title: `suspended` has no writer and no reverse
kind: unrecoverable
severity: P2
status: open
surface: auth
evidence:
  - path: backend/app/models/enums.py
    note: OrgUserStatus.SUSPENDED exists but nothing sets or clears it
repro: |
  Direct SQL set status=suspended; refresh/callback reject; no product path to recover.
fix_when: |
  Either remove SUSPENDED from the enum and checks, or add admin suspend/unsuspend writers and recovery UX.
---

`OrgUserStatus.SUSPENDED` exists in the enum, and the refresh and Instagram-callback
paths check for it explicitly, but nothing in the codebase ever sets it and nothing
clears it. (`require_active_role` never names it — it rejects any status other than
`active`.) Reachable only by direct SQL, and unrecoverable the same way.
