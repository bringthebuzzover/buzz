---
id: deploy.cron-races-api-predeploy
title: Cron services start on git-push before API pre-deploy Alembic finishes
kind: ops
severity: P2
status: fixed
surface: deploy
evidence:
  - path: DEPLOYMENT.md
    note: api + all six crons now run pre-deploy `.venv/bin/alembic upgrade head`.
  - path: backend/migrations/env.py
    note: pg_advisory_xact_lock serializes concurrent upgrade-head (api + crons).
  - path: backend/app/jobs/notify_reminders.py
    note: SELECT of Organization loads every mapped column, including shipping_* fields.
repro: |
  Historical: push a revision that adds mapped columns (d4e5f6a7b8c9 shipping_line1).
  Railway started cron-notify-reminders in parallel with api. Cron queried
  organizations before api pre-deploy applied the migration →
  UndefinedColumnError / Railway "Deploy Crashed".
  Confirmed 2026-09-01: cron 194e5c5a crashed at 00:40:05 UTC;
  api pre-deploy ran upgrade c3d4e5f6a7b8 → d4e5f6a7b8c9 at 00:41:24 UTC.
fix_when: |
  Schema-changing deploys do not crash crons. Every backend cron has the same
  Alembic pre-deploy as api; concurrent upgrades serialize.
---

# Cron races API pre-deploy migrations

## Closeout

Railway production: `.venv/bin/alembic upgrade head` pre-deploy on **api** and
all six crons (`cron-drop-autoclose`, `cron-metric-sync`, `cron-token-cleanup`,
`cron-autolink-scan`, `cron-token-refresh`, `cron-notify-reminders`). Config
takes effect on each service’s next deployment (git-push or scheduled cron
tick — no extra redeploy).

`migrations/env.py` takes a transaction-scoped `pg_advisory_xact_lock` so
parallel pre-deploys cannot both apply the same `ADD COLUMN`.

Residual: the lock ships only after the env.py commit is deployed. Until then,
cron pre-deploy is still `upgrade head` (no-op at current head).
