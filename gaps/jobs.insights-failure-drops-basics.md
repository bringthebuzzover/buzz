---
id: jobs.insights-failure-drops-basics
title: Insights failure drops an otherwise-successful basic metrics pull
kind: silent_loss
severity: P2
status: open
surface: jobs
evidence:
  - path: backend/app/jobs
    note: fetch_media and fetch_media_insights share one try/except in metric_sync
repro: |
  Basics succeed; insights throws; likes/comments/metrics_updated_at not written.
fix_when: |
  Basics persist independently of insights failures (or failures are split and counted).
---

In `metric_sync`, `fetch_media` and `fetch_media_insights` share one try/except.
An insights error skips updating likes/comments/`metrics_updated_at` even when
basic fields already succeeded.
