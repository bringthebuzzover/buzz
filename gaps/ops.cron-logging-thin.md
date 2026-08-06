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
  `run_job.py` `main()` (before `asyncio.run`) configures logging so `app.*`
  INFO reaches stderr with format including `%(name)s`; stdout JSON summary
  stays clean. Prefer: root `basicConfig(INFO, stream=sys.stderr)` **plus**
  dampen noisy libs (`httpx`, `httpcore`, `sqlalchemy.engine`, `asyncpg`) to
  WARNING — **or** leave root WARNING and attach an INFO handler only to
  `logging.getLogger("app")`. Do not configure at import time (breaks
  importlib tests). `job_runs` + schedule prose in DEPLOYMENT/README unchanged.
  Out of scope: Railway cron create, email ledger, observability stack.
---

`scripts/run_job.py` now upserts a `job_runs` row per invocation (`job`,
`started_at`, `finished_at`, `ok`, `summary` JSON), and `/api/admin/health`
appends last-run age to pipeline signal details. Cron processes still lack an
application `basicConfig`/`dictConfig`, so `logger.info` lines (including
"Email dispatched") can be discarded under the default WARNING threshold —
`logger.exception` still surfaces on stderr. The cron schedule itself lives only
as prose in `DEPLOYMENT.md` / `backend/README.md` (no `railway.toml` in-repo).

## Locked v1 fix

In `backend/scripts/run_job.py` `main()`, before `asyncio.run(_run(...))`:

```python
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    stream=sys.stderr,
)
for _noisy in ("httpx", "httpcore", "sqlalchemy.engine", "asyncpg", "asyncio"):
    logging.getLogger(_noisy).setLevel(logging.WARNING)
```

Alternative equally accepted: root stays WARNING; handler on
`logging.getLogger("app")` at INFO to stderr (same format).

Do **not** configure logging at module import. Leave `job_runs` upsert + stdout
`print(json.dumps(...))` unchanged. Do not hollow out schedule tables while
editing docs for sibling gaps.

## Plan verification

**Verdict: PASS_WITH_NITS**

### What was assessed

| Source | Claim |
| --- | --- |
| Gap body / evidence | Cron process has no `basicConfig`/`dictConfig`; `logger.info` (e.g. `Email dispatched`) can be dropped at default WARNING; `logger.exception` still surfaces |
| `fix_when` | Cron entrypoints configure logging so info/success lines are retained; schedule remains documented |
| `CLUSTERS.md` ops-deploy | Code slice: add `basicConfig` for info in `run_job.py` on a dedicated ops-code pass (not a full swarm / not Railway mutation) |

### Diagnosis — correct

1. **`run_job.py` has zero logging setup.** It imports job callables, writes `job_runs`, prints one stdout JSON summary, and exits. No `logging` import.
2. **Python defaults confirm the gap.** Unconfigured root is level `WARNING` (30) with no handlers; `logging.lastResort` is also WARNING on stderr. Child loggers such as `app.services.email` inherit effective WARNING, so `logger.info` is discarded.
3. **The cited success line is real and INFO-only.** `app/services/email.py` `_dispatch` ends with `logger.info("Email dispatched: to=%s subject=%s resend_id=%s", ...)`. Failures use `logger.warning` / `logger.exception` (already visible today).
4. **Cron ≠ API process.** API traffic goes through uvicorn (which configures logging). Railway cron runs `poetry run python scripts/run_job.py <name>` and never hits that path — so the hole is entrypoint-specific, not app-wide.
5. **Most job modules barely log at INFO today.** `notify_reminders` itself has no logger; detail lives in `email._dispatch`. `metric_sync` / `token_refresh` mostly `warning`. Enabling INFO mainly unlocks email success lines (and any future `logger.info` under `app.*`).

### Implied `basicConfig` plan — feasible

Calling something equivalent to the following at the start of `main()` (before `asyncio.run(_run(...))`) is sufficient and correct for the logger hierarchy:

```python
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    stream=sys.stderr,  # keep stdout JSON summary clean
)
```

- **Hierarchy:** `getLogger(__name__)` loggers under `app.*` propagate to root. Configuring root INFO + a StreamHandler makes `app.services.email` INFO records emit without touching each module.
- **Import order:** Module-level job imports already run before `main()`, but that only *creates* loggers; levels/handlers are resolved at emit time. `basicConfig` in `main()` is enough. Prefer **not** configuring at import time — `test_job_runner_persists_job_run` loads the module via `importlib` and calls `_run` directly; import-time config would mutate global logging for the pytest process.
- **`force=`:** After a clean process start, root has no handlers, so plain `basicConfig` works (verified: handlers `[]` → StreamHandler after call). Python is `>=3.12`, so `force=True` is available if something later pre-configures root; not required for the current cron entrypoint.
- **Stdout vs stderr:** Existing `print(json.dumps({"job": name, **result}))` is the structured one-shot summary on **stdout**. Default / explicit stderr for the logging handler is the right split so Railway (and any greppers) can treat the JSON line as parseable process output while narrative logs stay on stderr. Railway captures **both** streams into service logs.

### Interaction with `job_runs` — complementary, no conflict

| Channel | What it records | Granularity |
| --- | --- | --- |
| `job_runs` row | `job`, `started_at`, `finished_at`, `ok`, `summary` JSON | One row per invocation; aggregates (e.g. `reminders_sent`) |
| stdout JSON | Same summary echoed once | One line per invocation |
| `logger.info` (after fix) | e.g. per-email `Email dispatched` + `resend_id` | Per side-effect inside the job |

- Enabling logging does **not** change upsert/commit/`ok`/`summary` behavior in `_run`.
- `job_runs.summary` does **not** store per-email Resend IDs; INFO logs are the only process-local success breadcrumb for individual sends (especially relevant while `ops.email-best-effort-no-ledger` remains open).
- Closing this gap does **not** satisfy `ops.observability-thin` (readyz/metrics/Sentry/etc.) and must not be expanded into that work.
- Failure path already persists `ok=False` and re-raises; `logger.exception` from jobs/email already reaches stderr via lastResort. INFO config does not replace that.

### `fix_when` second clause (“schedule remains documented”)

Non-regression, not a new deliverable. Schedule stays prose in `DEPLOYMENT.md` / `backend/README.md`; there is still no in-repo `railway.toml` cron definition. The ops-deploy approach correctly does **not** invent Railway secrets or create cron services as part of this code slice. Do not delete or hollow out the schedule tables while touching docs for sibling gaps (`ops.notify-cron-not-created`).

### Nits (why not plain PASS) — amended into Locked v1 (2026-08-06)

Folded into `fix_when` + Locked v1: dampen httpx/sqlalchemy (or app-scoped
handler); `main()` + stderr + `%(name)s` format; no import-time config.

### What would have been FAIL / NO_PLAN

- **FAIL** if the plan relied on `job_runs` alone to retain `"Email dispatched"` (it cannot), or put config only in FastAPI/`main.py` lifespan (cron never loads it), or used `dictConfig` that disabled stderr without a Railway-compatible handler.
- **NO_PLAN** if CLUSTERS had only “ops human work” with no code lever — but the locked approach explicitly names the `run_job.py` `basicConfig` slice.

### Implementer checklist (minimal correct close)

1. In `backend/scripts/run_job.py` `main()`, before `asyncio.run`, configure logging so `app.*` INFO reaches stderr (root `basicConfig(INFO)` **or** `app`-scoped handler; dampen httpx/sqlalchemy if using root INFO).
2. Leave `job_runs` + stdout JSON behavior unchanged.
3. Do not remove schedule prose from `DEPLOYMENT.md` / `backend/README.md`.
4. Out of scope: Railway service creation, email ledger, full observability stack.
