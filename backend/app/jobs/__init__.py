"""Background jobs (architecture.md §10).

Each job is a pure async function taking an ``AsyncSession`` (and, for the
Instagram-backed jobs, an ``InstagramClient``) and returning a small summary
dict. They're invoked by ``scripts/run_job.py`` from a scheduler (Railway Cron,
§1.3) and are unit-tested directly against a rolled-back session. Jobs are
idempotent so a missed/duplicated run is safe.
"""
