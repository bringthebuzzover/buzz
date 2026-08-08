---
id: ops.notify-cron-not-created
title: Notify Me reminders depend on a cron nobody has created yet
kind: ops
severity: P1
status: fixed
closed_in: 95d1d97
surface: deploy
evidence:
  - path: backend/app/jobs/notify_reminders.py
    note: send_due_reminders; stamps notify_me.sent_at only when dispatch returns true
  - path: backend/scripts/run_job.py
    note: job name notify_reminders registered; no Instagram client; writes job_runs
  - path: backend/tests/test_jobs.py
    note: due/idempotent/closed-window/no-edu_email/finished/unapproved coverage green
  - path: DEPLOYMENT.md
    note: sixth cron created on Railway production (cron-notify-reminders */5)
  - path: backend/README.md
    note: documents poetry run … notify_reminders every ~5 min (§10.6)
  - path: backend/app/services/admin_read.py
    note: notify_me_never_sent health count; pipeline still has no notify_reminders last-run row
  - path: backend/app/services/email.py
    note: send_drop_opening_reminder_email → _dispatch never raises; Resend best-effort
  - path: Railway production (list-services 2026-08-06)
    note: pre-fix snapshot — five crons only; post-fix service cron-notify-reminders exists (see Closeout)
repro: |
  Historical (pre-fix): Railway list services — cron-notify-reminders absent.
  Post-fix verify: service present; job_runs for job=notify_reminders with ok=true.
  SQL (admin-health shaped — already-open, unsent):
    SELECT count(*) FROM notify_me n JOIN drops d ON d.id = n.drop_id
    WHERE n.enabled IS TRUE AND n.sent_at IS NULL
      AND d.apply_open_at <= now() AND d.apply_close_at > now();
  SQL (job-due shaped — lead time passed, window still open):
    SELECT count(*) FROM notify_me n JOIN drops d ON d.id = n.drop_id
    WHERE n.enabled IS TRUE AND n.sent_at IS NULL
      AND d.apply_close_at > now()
      AND d.apply_open_at - make_interval(0,0,0,0,0,n.reminder_minutes) <= now();
  job_runs: SELECT * FROM job_runs WHERE job = 'notify_reminders' ORDER BY started_at DESC LIMIT 5;
fix_when: |
  Railway production has service cron-notify-reminders with schedule */5 * * * *,
  root /backend, start command invoking run_job.py notify_reminders (parity with
  live sibling crons), env parity with other crons including RESEND_API_KEY +
  EMAIL_FROM + DATABASE_URL, restart NEVER, no public domain. After enable:
  job_runs rows appear for job=notify_reminders with ok=true; unsent due count
  stops climbing (first run may flush a backlog burst — see Locked fix).
  DEPLOYMENT.md sixth-cron checkbox marked done. Recommended enable order
  satisfied (ops.email-best-effort-no-ledger v1 sent_at-on-dispatch-true
  already shipped, OR Resend sending domain hard-verified before first fire).
  Do NOT require a full email ledger to close this gap.
---

> **Archived / fixed.** Problem + Locked v1 below describe the **pre-create**
> state. Authoritative post-fix facts are in **Closeout**. Email stamp is
> dispatch-true only (email-honesty v1); residual watch: Resend domain verify
> + `job_runs` cadence (not recreating the service).

## Problem

Notify Me delivery code is **shipped and tested** (`send_due_reminders`,
`run_job.py` name `notify_reminders`, suite in `test_jobs.py`). Production has
**no Railway cron that invokes it**.

Live Railway `production` (project `buzz`) has five cron services —
`cron-drop-autoclose`, `cron-metric-sync`, `cron-token-cleanup`,
`cron-autolink-scan`, `cron-token-refresh` — and **no**
`cron-notify-reminders`. DEPLOYMENT.md already documents the sixth service and
leaves the create checkbox unchecked.

Until that service exists, every org that tapped Notify Me on an Upcoming drop
gets **silence**: PRODUCT §6.3.1 / §11 is email-only for this path. The admin
`notify_me_never_sent` signal stays red while open windows accumulate unsent
rows. No `job_runs` heartbeat for `notify_reminders` ever appears.

## Prod impact

| Surface | Effect |
|---|---|
| Org | Reminder never arrives; drop may open/close without the lead-time email |
| Admin health | `notify_me_never_sent` climbs for open windows; no last-run age for this job |
| Ops | Code + docs claim a 5-minute cron that does not exist on Railway |

Cadence note (once created): `*/5` means a 5-minute reminder option can land up
to ~5 minutes late — accepted by DEPLOYMENT.md.

## First-run backlog

The job selects every row where lead time has passed, window still open,
`sent_at IS NULL`, browsable gates pass. The **first** successful cron run after
create will email **the entire already-due backlog** in one burst (then stamp
`sent_at`). That is correct idempotent catch-up, not a bug — but it can surprise
Resend rate limits / inbox volume if many subscriptions sat due for days.

**Mitigation (ops, before or at enable):**

1. Run the job-due SQL above; note the count.
2. Prefer enabling when count is small, or during a quiet window.
3. Optionally one-shot via Railway “Run” / CLI after env is wired, watch
   `reminders_sent` in the JSON summary + Resend dashboard, then leave cron on.
4. Closed-window rows are **not** mailed (left `sent_at NULL` forever by design
   — those are historical misses, excluded from `notify_me_never_sent`).

## Interaction with [`ops.email-best-effort-no-ledger`](ops.email-best-effort-no-ledger.md)

**In scope for this gap:** create the cron so the delivery path actually runs.

**Sibling dependency (cross-link):** At gap open, `notify_reminders` stamped
`notify_me.sent_at` **after the send attempt**; `_dispatch` never raises. If
Resend failed, the row was one-shot consumed → permanent miss. Sibling
[`ops.email-best-effort-no-ledger`](ops.email-best-effort-no-ledger.md)
(v1, now archived) returns bool from `_dispatch` and stamps Notify Me `sent_at`
**only when dispatch is true** — that fix shipped before cron enable.

**Recommended order (satisfied):** Enable `cron-notify-reminders` **after**
email-honesty v1, **or** hard-gate Resend sending-domain verify (+ known-good
`EMAIL_FROM`) before the first fire / backlog flush. Do **not** wait on a
full email ledger (`ops.email-ledger` remains deferred).

Empty `RESEND_API_KEY` fails boot off-dev, so a running cron with email unset
should not happen; misconfig is domain/key/`EMAIL_FROM` quality, not missing key.

## Severity

Keep **P1** / `ops` / `deploy`. Feature is dead in prod despite green tests.
Not a code bug; human Railway create unblocks. Downgrade only after the service
exists and `job_runs` prove cadence.

## Locked v1 fix

**Recommended order:** Prefer create/enable **after**
[`ops.email-best-effort-no-ledger`](ops.email-best-effort-no-ledger.md) v1
(`sent_at` only when dispatch true) lands; **else** hard-gate Resend sending-domain
verify before first fire. Do not require the email ledger.

Human Railway checklist (do **not** agent-create without explicit user OK).
Clone the live sibling `cron-drop-autoclose` (same cadence / layout):

1. **Ordering gate (pick one):** (A) confirm
   `ops.email-best-effort-no-ledger` v1 shipped so failed sends leave
   `sent_at` NULL and retry next tick, **or** (B) hard-verify Resend domain +
   `EMAIL_FROM` with a test send before any `notify_reminders` fire.
2. **Create service** named `cron-notify-reminders` in project `buzz`,
   environment `production` (prefer **same region as autoclose**, currently
   `sfo` / 1 replica — not token-refresh’s region).
3. **Source:** same repo/branch as other crons (`mvp`); **Root Directory**
   `/backend`; **no public domain**. Do **not** invent Watch Paths unless the
   live autoclose UI already shows them (cron sibling API dumps often omit
   `watchPatterns` even when `api` has `/backend/**`).
4. **Start command** (match live autoclose, not the older `poetry run` prose):
   ```text
   .venv/bin/python scripts/run_job.py notify_reminders
   ```
   Job name must be exactly `notify_reminders` (see `_JOBS` in `run_job.py`).
5. **Cron schedule (UTC):** `*/5 * * * *`
6. **Restart policy:** `NEVER` (one-shot; scheduler re-invokes).
7. **Env parity — copy autoclose’s exact 15 vars** (required, not “at
   minimum”):
   `BRAND_SELF_REGISTRATION_ENABLED`, `DATABASE_URL`, `EMAIL_FROM`,
   `ENVIRONMENT`, `FRONTEND_URL`, `INSTAGRAM_CLIENT_ID`,
   `INSTAGRAM_CLIENT_SECRET`, `INSTAGRAM_REDIRECT_URI`,
   `RAILPACK_PYTHON_VERSION`, `RATE_LIMIT_ENABLED`,
   `REFRESH_COOKIE_SAMESITE`, `REFRESH_COOKIE_SECURE`, `RESEND_API_KEY`,
   `SECRET_KEY`, `TOKEN_ENCRYPTION_KEY`.
   (`FRONTEND_URL` is fail-fast + used in reminder body; IG vars are
   boot-required even though this job never calls Instagram.)
8. **`RAILPACK_PYTHON_VERSION=3.12` is required for sibling parity** (all
   live crons define it — not optional).
9. **Before first scheduled fire:** run backlog SQL; optionally manual
   one-shot; then leave cron enabled (ordering gate already satisfied).
10. **Docs:** check off DEPLOYMENT.md “Add the sixth cron service
    `cron-notify-reminders`” once live. Verify via `job_runs` +
    `notify_me_never_sent` (no dedicated pipeline signal for this job).

### Verify

- Railway deployment history: each tick **Completed** (not stuck Active).
- Logs / stdout JSON: `{"job":"notify_reminders","reminders_sent":N,"reminders_skipped":M}`.
- SQL: `job_runs` rows with `job='notify_reminders'` and `ok=true` every ~5 min.
- Due unsent count stops climbing; after first flush, new dues clear within one cadence.
- Spot-check: a known due subscription receives the drop-opening reminder email.

### Code / doc must-haves for v1

- **No application code change required in this gap** — job + runner + tests
  already exist; preferred `sent_at`-on-dispatch-true lives in
  [`ops.email-best-effort-no-ledger`](ops.email-best-effort-no-ledger.md).
- **Doc:** flip DEPLOYMENT.md sixth-cron checkbox after create; keep schedule
  table row accurate.
- Do **not** block close on a full email ledger or cron `basicConfig` logging.

## Explicit OUT of scope

- Creating/mutating Railway services from an agent without explicit user OK.
- Implementing [`ops.email-best-effort-no-ledger`](ops.email-best-effort-no-ledger.md)
  here (including its v1 bool/`sent_at` change and any ledger).
- `ops.cron-logging-thin` (`basicConfig` so info “Email dispatched” survives).
- `ops.observability-thin` / adding `notify_reminders` as a dedicated pipeline
  signal beyond existing `notify_me_never_sent` + `job_runs`.
- Changing lead-time options, browsable gates, or closed-window skip policy.
- Harmonizing DEPLOYMENT.md `poetry run` prose vs live `.venv/bin/python` across
  all crons (use live sibling command for this service; broader doc cleanup later).
- Preview/staging env or a second Railway environment.
- Backfilling closed-window historical misses (intentionally never mailed).

## Plan verification

**Verdict: PASS_WITH_NITS**

Verified 2026-08-06 against Locked v1, `notify_reminders.py`, `run_job.py`,
DEPLOYMENT.md cron section, and Railway MCP **readonly**
(`list-services` + `get-service-config` on live siblings; **no create/mutate**).

### Live Railway evidence (readonly)

Project `buzz` (`cd2769a4-2518-4714-8ef6-03209a75230d`), env `production`:

| Present | Absent |
|---|---|
| `cron-drop-autoclose`, `cron-metric-sync`, `cron-token-cleanup`, `cron-autolink-scan`, `cron-token-refresh`, `api`, `frontend`, `Postgres` | **`cron-notify-reminders`** |

Gap evidence claim (no sixth cron) still holds.

**Live sibling `cron-drop-autoclose` (clone target) — exact deploy fields:**

| Field | Live value | Locked v1 |
|---|---|---|
| Start command | `.venv/bin/python scripts/run_job.py drop_autoclose` | Match pattern → `… notify_reminders` |
| Cron UTC | `*/5 * * * *` | `*/5 * * * *` |
| Restart | `NEVER` | `NEVER` |
| Root Directory | `/backend` | `/backend` |
| Branch / repo | `mvp` / `ShannonLin284/buzz` | same as siblings |
| Public domain | none (no service domain) | no public domain |
| Builder | RAILPACK | implied by clone |
| User env vars (15) | `BRAND_SELF_REGISTRATION_ENABLED`, `DATABASE_URL`, `EMAIL_FROM`, `ENVIRONMENT`, `FRONTEND_URL`, `INSTAGRAM_CLIENT_ID`, `INSTAGRAM_CLIENT_SECRET`, `INSTAGRAM_REDIRECT_URI`, `RAILPACK_PYTHON_VERSION`, `RATE_LIMIT_ENABLED`, `REFRESH_COOKIE_SAMESITE`, `REFRESH_COOKIE_SECURE`, `RESEND_API_KEY`, `SECRET_KEY`, `TOKEN_ENCRYPTION_KEY` | “env parity with autoclose” |

Other crons use the same `.venv/bin/python scripts/run_job.py <job>` shape
(`metric_sync`, `token_refresh` spot-checked). DEPLOYMENT.md still documents
`poetry run python …`; Locked v1 correctly prefers **live** start command over
doc prose (explicitly out-of-scope to harmonize docs across all crons).

### Code / job-name / JSON contract

- `_JOBS["notify_reminders"] = (send_due_reminders, False)` in
  `backend/scripts/run_job.py` — exact name required; **no IG client**.
- Import path loads `app.config.settings` via `app.deps.db` → off-dev
  fail-fast still requires the **full** shared cron/API set (IG +
  `FRONTEND_URL` + cookie flags + `RESEND_API_KEY`, etc.), not only DB/email.
  Cloning autoclose’s 15 vars is the correct way to satisfy that.
- Job returns `{"reminders_sent", "reminders_skipped"}`; runner prints
  `{"job":"notify_reminders", …}` — matches Verify bullets.
- Selection + SKIP LOCKED + closed-window skip + browsable gates +
  `sent_at`-after-attempt match gap Problem / First-run backlog /
  email-sibling notes. Tests in `test_jobs.py` cover due / idempotent /
  closed / no-edu_email / finished / unapproved.

### Cloning autoclose — feasible and correct?

**Yes.** Same cadence (`*/5`), same one-shot layout (`restart NEVER`), same
root/branch/builder, same env surface. Only deltas: service name
`cron-notify-reminders` and start arg `notify_reminders`. No application code
required for this gap. Human Railway create (no agent mutate) remains correct.

### Schedule / backlog / ordering with email gap

- **Schedule `*/5`:** Matches DEPLOYMENT.md + autoclose; 5-minute reminder
  option can land up to ~5 min late — already accepted in docs.
- **First-run backlog:** Job-due SQL in the gap is the right pre-enable check;
  first successful run emails the full due-open backlog then stamps `sent_at`.
  Closed-window rows stay unsent by design (aligned with
  `notify_me_never_sent` excluding closed windows).
- **Ordering vs `ops.email-best-effort-no-ledger`:** Sound.
  Today `notify_reminders` stamps `sent_at` after the attempt while `_dispatch`
  never raises → Resend failure = permanent miss. Sibling Locked v1 stamps
  only when dispatch is true (retry next tick). Prefer enable **after** that
  v1, **or** hard-verify Resend domain + `EMAIL_FROM` before first fire / flush.
  Correctly does **not** require a full email ledger to close this gap.
  Email gap remains `status: open` — ordering gate still applies.

### Nits (non-blocking) — amended into Locked v1 (2026-08-06)

Folded: RAILPACK required; exact 15-var autoclose env list; Watch Paths only if
live autoclose shows them; prefer autoclose region; verify via job_runs (no
pipeline row).

### Explicit non-issues / confirmations

- No Railway create performed during verification.
- Job does not need Instagram **client**; env still needs IG creds for Settings.
- Empty `RESEND_API_KEY` cannot boot off-dev — misconfig risk is domain /
  `EMAIL_FROM` / key quality, as the gap states.
- Closing this gap = service exists + `job_runs` heartbeat + DEPLOYMENT.md
  sixth-cron checkbox; not ledger, not cron `basicConfig`, not preview env.

### Bottom line

Locked v1 is the right ops playbook: clone live `cron-drop-autoclose`, swap job
name, keep `*/5` + `NEVER` + `/backend` + full env parity, gate on email v1 or
Resend domain verify, watch backlog on first fire. Nits are copy-paste precision
only — **not** approach defects.


## Closeout (2026-08-06)

Railway production service `cron-notify-reminders` created via MCP:
- service id `656c60f7-d257-4d8a-936c-dbfbfc5bd399`
- schedule `*/5 * * * *`, root `/backend`, start `.venv/bin/python scripts/run_job.py notify_reminders`
- restart `NEVER`; 15 env vars referenced from `cron-drop-autoclose`
- deploy SUCCESS on branch `mvp`; region landed `us-west2` (autoclose is `sfo` — acceptable drift)
- email-honesty v1 (`sent_at` only on dispatch true) already shipped before enable
- DEPLOYMENT.md sixth-cron checkbox + Cron×6 table marked live
