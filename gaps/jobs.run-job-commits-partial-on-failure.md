---
id: jobs.run-job-commits-partial-on-failure
title: run_job exception path commits flushed job mutations with ok=false
kind: invariant_break
severity: P2
status: open
surface: jobs
evidence:
  - path: backend/scripts/run_job.py
    note: except commits JobRun failure without rolling back prior job flushes
  - path: backend/app/jobs/metric_sync.py
    note: await db.flush() mid-batch (representative)
repro: |
  Inject failure after a job flush mid-batch; observe partial DB side effects
  persisted alongside job_runs.ok=false.
fix_when: |
  Failure path rolls back job work then persists failure JobRun (separate
  session or savepoint); test asserts no partial mutations on ok=false.
---

# run_job commits partial work on failure

Security audit 2026-08-11 (area 9b). Parent-verified. Jobs flush; runner
exception commit persists them.
