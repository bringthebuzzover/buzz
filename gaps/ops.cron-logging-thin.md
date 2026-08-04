---
id: ops.cron-logging-thin
title: Cron logging is thin despite job_runs
kind: ops
severity: P2
status: open
surface: jobs
evidence:
  - path: backend/scripts/run_job.py
    note: job_runs upserted but cron process lacks info-level logging config
repro: |
  Run a cron job; logger.info (e.g. Email dispatched) may be discarded under default WARNING.
fix_when: |
  Cron entrypoints configure logging so info/success lines are retained; schedule remains documented.
---

`scripts/run_job.py` now upserts a `job_runs` row per invocation (`job`,
`started_at`, `finished_at`, `ok`, `summary` JSON), and `/api/admin/health`
appends last-run age to pipeline signal details. Cron processes still lack an
application `basicConfig`/`dictConfig`, so `logger.info` lines (including
"Email dispatched") can be discarded under the default WARNING threshold —
`logger.exception` still surfaces on stderr. The cron schedule itself lives only
as prose in `DEPLOYMENT.md` / `backend/README.md` (no `railway.toml` in-repo).
