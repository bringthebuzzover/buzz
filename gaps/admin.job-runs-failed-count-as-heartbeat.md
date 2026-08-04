---
id: admin.job-runs-failed-count-as-heartbeat
title: Failed job_runs still look like a healthy heartbeat
kind: ops
severity: P2
status: open
surface: admin
evidence:
  - path: backend/app/services/admin_read.py
    note: last-run age uses max(finished_at) without ok filter
  - path: frontend/src/components/admin/labels.ts
    note: token_refresh inference copy says inside 1 day of expiry
repro: |
  Crash a cron (ok=false); health still shows recent last-run. Compare token_refresh label vs expired-token signal.
fix_when: |
  Heartbeat prefers successful runs (or surfaces failures); token_refresh inference copy matches the expired-token signal.
---

`get_health` pipeline last-run age is `max(JobRun.finished_at)` with no `ok`
filter. A crashing cron writes `finished_at` with `ok=false` and still appears
recently run. Separately, `PIPELINE_META.token_refresh.inference` says “inside 1
day of expiry” while the signal counts `instagram_token_expires_at <= now`
(already expired).
