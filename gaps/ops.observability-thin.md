---
id: ops.observability-thin
title: "Observability leftovers: no readyz/livez/metrics; health counters over-count"
kind: ops
severity: P3
status: open
surface: admin
evidence:
  - path: backend/app/routes
    note: GET /api/health exists; no /readyz /livez /metrics
  - path: backend/app/services/admin_read.py
    note: several admin health counters over-count by design
repro: |
  Inspect health counters for STORY posts_never_refreshed; advance past awaiting_products with null tracking_number.
fix_when: |
  Ops signals match intended semantics; optional readiness/metrics stack if product requires multi-replica ops.
---

`GET /api/health` now pings Postgres (`SELECT 1`) and returns **503** with the
standard error envelope when the DB is unreachable. There is still no `/readyz`,
`/livez`, or `/metrics`, no Sentry/Prometheus/OpenTelemetry/structlog, and no
request-logging middleware. Rate limiting is in-memory and per-process, which
forces a single backend replica.

`GET /api/admin/health` is wired to `/admin/health`. Several counters still
over-count by design (`posts_never_refreshed` / `metric_sync_stale` include STORYs
that are never refreshed). Advancing a drop past `awaiting_products` clears
`awaiting_products_no_tracking` even when `drops.tracking_number` is still null
(the counter is stage-scoped, not “TN present”). Repair is
`set_drop_tracking_number` / admin tracking repair, which writes
`drops.tracking_number`. Leaving `request_received` after reopen clears
`drop_reopened_stuck` while `manual_reopen` stays true and the apply window stays
open until an admin clears reopen.
