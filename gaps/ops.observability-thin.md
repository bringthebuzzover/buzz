---
id: ops.observability-thin
title: "Observability leftovers: no readyz/livez/metrics; (STORY counters → posts.stories-unsupported)"
kind: ops
severity: P3
status: open
surface: admin
evidence:
  - path: backend/app/routes
    note: GET /api/health exists; no /readyz /livez /metrics
  - path: gaps/posts.stories-unsupported.md
    note: STORY admin-counter lie + full Stories skip Locked v1 (split out)
repro: |
  Platform: inspect routes — only /api/health (DB-gated), no Prometheus/Sentry.
  STORY counter repro moved to posts.stories-unsupported.
fix_when: |
  Platform slice (optional): product names multi-replica / scrape / error-tracking
  requirements, then Locked v1 for that stack only.
  STORY / admin-counter honesty: archive with posts.stories-unsupported (do not
  block this file on that work).
---

# Observability leftovers (platform)

## Split (2026-08-10)

| Slice | Where |
| ----- | ----- |
| **Stories unsupported** (discovery skip, link reject, admin counter honesty, Meta sources) | **`posts.stories-unsupported`** — has Locked v1 |
| **Platform stack** (readyz/livez/metrics, Sentry/OTel/structlog, request logging, Redis multi-replica) | **This file** — still **NO_PLAN** / parked |

Do not boil the ocean in one swarm. Ship Stories skip via the other gap; leave
platform probes deferred until product asks.

## Platform inventory (still true)

`GET /api/health` pings Postgres (`SELECT 1`) and returns **503** with the
standard error envelope when the DB is unreachable. There is still no `/readyz`,
`/livez`, or `/metrics`, no Sentry/Prometheus/OpenTelemetry/structlog, and no
request-logging middleware. Rate limiting is in-memory and per-process, which
forces a single backend replica (`DEPLOYMENT.md`).

`GET /api/admin/health` is the product ops dashboard (SQL counters + `job_runs`
ages). After `posts.stories-unsupported` ships, refresh-derived counters should
stop lying about STORYs; other signal semantics
(`awaiting_products_no_tracking`, `drop_reopened_stuck`) remain product-scoped
and are **not** locked here.

## Plan verification (platform only)

**Verdict: NO_PLAN** for Prometheus/Sentry/OTel/livez split / Redis.

| Slice | Feasibility | Notes |
|-------|-------------|-------|
| Request-logging middleware (stdlib → Railway logs) | High | Best incremental platform win if product wants it later |
| `/livez` + `/readyz` | Medium | Railway uses one health path today; low urgency |
| Prometheus `/metrics`, Sentry, OTel | Large | Needs scrape/secrets/runbooks |
| Redis rate limit / multi-replica | Large + ops | Scale decision, not observability alone |

### What would make platform work swarmable

New Locked v1 naming: endpoint list, Railway checklist, secret inventory, and
explicit non-goals. Until then, do not auto-pick this gap.

## Related

- `posts.stories-unsupported` — Stories research (Meta + industry), Locked v1 full skip.
- `DEPLOYMENT.md` — 1 replica, `/api/health`, `job_runs`.
