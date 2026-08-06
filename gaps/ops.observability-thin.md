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

## Plan verification

**Verdict: NO_PLAN**

### Sources reviewed

| Source | What it says about this gap |
|--------|-----------------------------|
| This file | Problem inventory + soft `fix_when`; **no** `## Locked v1 fix`, forks, SQL diffs, or acceptance checklist |
| `gaps/CLUSTERS.md` → `ops-deploy` | Cluster `status: ops`. Approach: not a normal code swarm; cron-logging / DEPLOYMENT / Railway checklists only. Explicit: “Email ledger and **full observability are larger**; split follow-ups rather than boiling the ocean.” |
| `backend/app/routes/health.py` | `GET /api/health` runs `SELECT 1`, raises 503 `INTERNAL_ERROR` envelope on DB failure; returns `{status, version}` |
| `backend/app/services/admin_read.py` | Counter SQL for the cited signals (see below) |
| `backend/app/jobs/metric_sync.py` | Refresh loop **excludes** `media_product_type == STORY` |
| `frontend/src/components/admin/labels.ts` | UI copy for signals; does not mention STORY exclusion |
| `DEPLOYMENT.md` | API healthcheck = `/api/health` (DB ping); **1 replica** MVP; in-memory rate limit documented |

### Evidence check (claims vs code)

1. **No `/readyz` / `/livez` / `/metrics`** — **True.** Only `/api/health` (+ `/api/config`). No Prometheus/Sentry/OTel/structlog/request-logging middleware in the backend surface reviewed.

2. **`/api/health` already DB-gates** — **True.** It is effectively a **readiness** probe (process + Postgres), not a pure liveness probe. Railway and Playwright already point at `/api/health`. Splitting livez/readyz is optional ops hygiene, not required to make the current healthcheck honest.

3. **`posts_never_refreshed` / `metric_sync_stale` over-count STORYs** — **True, and mechanistically clear:**
   - `posts_never_refreshed`: `count(SocialPost) WHERE metrics_updated_at IS NULL` — no media-type filter.
   - `metric_sync_stale`: recent posts with null or >36h-old `metrics_updated_at` — no media-type filter.
   - `metric_sync` refresh: `media_product_type != STORY` — STORYs are discovered but never refreshed → permanent counter inflation.
   - UI note (“Discovered … but never successfully refreshed”) is therefore misleading for STORYs.

4. **`awaiting_products_no_tracking` is stage-scoped** — **True:** counts drops where `brand_tracker_stage == awaiting_products AND tracking_number IS NULL`. Advancing the tracker clears the signal without requiring a TN. That is **not** an “over-count”; it is a **semantic choice** (current-stage hygiene vs “TN must exist once shipping started”). Gap body correctly describes behavior; calling the whole gap “over-count” conflates this with the STORY issue.

5. **`drop_reopened_stuck` clears on stage leave while `manual_reopen` stays** — **True:** signal = `manual_reopen AND stage == request_received`. Auto-close skips `manual_reopen`; admin `clear_manual_reopen` exists. Whether clearing the *signal* on advance is wrong depends on intended meaning (“stuck at request_received” vs “any reopen flag still set”). **No product decision locked.**

6. **In-memory rate limit ⇒ single replica** — **True** (`DEPLOYMENT.md` + `app/security/rate_limit.py`). Multi-replica needs Redis (or similar); out of scope unless product commits to horizontal scale.

### What “the plan” is today

There is **no implementable fix plan**. The only guidance is:

- Cluster: **defer** full observability; do not boil the ocean in `ops-deploy`.
- `fix_when`: “signals match intended semantics” (**semantics undefined**) + “optional readiness/metrics stack **if** product requires multi-replica ops” (**product-gated, not required**).

An agent asked to “fix this gap” would have to invent scope, forks, and acceptance — which CLUSTERS explicitly forbids for this cluster.

### Feasibility if a plan were written later (not verified as locked)

| Slice | Feasibility | Notes |
|-------|-------------|-------|
| A. Exclude `STORY` (and decide on `AD`) from `posts_never_refreshed` + `metric_sync_stale`; update `SIGNAL_META` / `PIPELINE_META` notes + admin tests | **High** | Small, local, matches job behavior; clear pass criteria |
| B. Redefine `awaiting_products_no_tracking` / `drop_reopened_stuck` | **Blocked on product** | Stage-scoped vs TN-invariant vs reopen-flag lifetime; wrong choice is a silent ops lie |
| C. Add `/livez` (no DB) + `/readyz` (DB) ; keep `/api/health` or alias | **Medium** | Easy FastAPI routes; must update Railway health path, Playwright `webServer.url`, docs, OpenAPI; dual probes only matter if orchestrator distinguishes them (Railway does not today) |
| D. `/metrics` (Prometheus), Sentry, OTel, structlog, request logging | **Large** | New deps, secrets, PII/redaction, scrape/ops runbooks; correctly called “larger” in CLUSTERS |
| E. Redis-backed rate limit for multi-replica | **Large + ops** | Requires infra + config; only justified with multi-replica product decision |

Mixing A–E in one fix_when without phases is how this gap became un-swarmable.

### Gaps in the current write-up (why not PASS / FAIL)

- **NO locked approach** in the gap file (contrast: peers like `ops.email-best-effort-no-ledger`, `deploy.samesite-lax-railway-preview`).
- **`fix_when` is not falsifiable:** “intended semantics” never stated; observability half is optional.
- **Two problem classes fused:** admin counter semantics (code) vs platform observability / multi-replica (ops product). CLUSTERS already says split follow-ups — gap file was never split.
- **Status drift:** frontmatter `status: open` while cluster membership is `ops-deploy` / `status: ops` (living statuses allow `ops`; file should probably be `ops` or `deferred` until a locked slice exists).
- **Label drift:** `awaiting_products_no_tracking` note (“Tracking is only writable on the transition into this stage”) understates admin `set_drop_tracking_number` repair path cited in the gap body.
- **No tests** currently assert STORY exclusion from those counters (`test_admin_panel.py` hits `/api/admin/health` but not this edge).

### What would turn this into a verifiable plan

Minimum for a future **PASS**-able locked v1 (suggested split, not approved here):

1. **New/narrow gap or locked section** for counter semantics only, e.g. “exclude STORY from refresh-derived silent/pipeline counts; document AD policy; add regression tests.” Explicit non-goals: no Prometheus/Sentry/Redis.
2. Separate product decision tickets for TN-invariant vs stage-scoped shipping signal, and for `manual_reopen` lifetime.
3. Observability stack remains deferred until product names multi-replica / scrape / error-tracking requirements; then a new gap with endpoint list, Railway checklist, and secret inventory.

Until then, swarming this id is incorrect: there is nothing to implement against, only an inventory and an explicit deferral.
