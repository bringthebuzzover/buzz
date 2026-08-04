---
id: jobs.metric-sync-single-page
title: metric_sync discovery is single-page (limit=50)
kind: silent_loss
severity: P2
status: open
surface: jobs
evidence:
  - path: backend/app/services/instagram.py
    note: fetch_user_media one GET limit=50 ignores paging.next
repro: |
  Org with >50 media in 30-day window; older in-window posts never inserted.
fix_when: |
  Media discovery follows paging within the window; list failures increment job failures.
---

`HttpInstagramClient.fetch_user_media` issues one Graph GET with `limit=50` and
ignores `paging.next`. Orgs with more than 50 media items in the 30-day window
silently never insert the older in-window posts. Media-list exceptions set
`media = []` without incrementing the job's `failures` counter.
