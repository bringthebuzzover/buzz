---
id: drops.detail-notify-skip-browsable-gates
title: Drop detail / Notify Me skip browsable gates
kind: authz
severity: P2
status: fixed
closed_in: f709a67
surface: drops
evidence:
  - path: backend/app/services/drops.py
    note: feed/apply gate approved+not finished; detail/notify only require drop exists
repro: |
  Deep-link to drop_finished or unapproved-brand drop detail; notify subscribe succeeds.
fix_when: |
  detail/notify/clear_notify (and reminder job) enforce the same browsable gates as feed/apply.
---

`list_org_drop_feed` and `apply_to_drop` require approved brand + not
`drop_finished`. `build_drop_detail`, `set_notify`, and `clear_notify` only require
the drop exists — deep links can still read and subscribe to hidden drops. (The
reminder job also does not re-check brand status / finished.)
