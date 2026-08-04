# Known gaps

Working scratch doc, not product documentation. Each entry is a remaining state a
record can reach that the product cannot get itself out of, a write path that
silently loses data, or a leftover product/infra hole. Closed gaps from the
prod-ready pass are removed rather than marked done.
`GET /api/admin/health` counts many of the SQL probes below and is surfaced at
`/admin/health`; several counters still over-count (see below).

Detection queries are written against the live schema and are safe to run read-only.

---

## Unrecoverable / product holes

### `suspended` has no writer and no reverse

`OrgUserStatus.SUSPENDED` exists in the enum, and the refresh and Instagram-callback
paths check for it explicitly, but nothing in the codebase ever sets it and nothing
clears it. (`require_active_role` never names it — it rejects any status other than
`active`.) Reachable only by direct SQL, and unrecoverable the same way.

### Expired Instagram token needs org reconnect

`refresh_due_tokens` only selects tokens still valid but within 14 days of expiry
(`now < expires_at < now+14d`). Expired tokens (`expires_at <= now`) are skipped;
Meta also cannot refresh them. Login refresh uses remaining time (not `.days`
truncation) and raises `INSTAGRAM_TOKEN_EXPIRED` when `expires_at <= now`.

The SPA has no dedicated reconnect branch for `INSTAGRAM_TOKEN_EXPIRED` —
`apiFetch` only auto-refreshes and clears the token for code `TOKEN_EXPIRED`,
so it rethrows this one untouched; the bounce to login comes from `fetchMe`,
which treats any 401 as unauthenticated, plus `RequireAuth`.

Admin can clear the token (`POST /api/admin/orgs/{user_id}/clear-instagram-token`)
so the org can reconnect after a hard failure.

```sql
SELECT count(*) FROM users
WHERE portal_role = 'org' AND instagram_token_expires_at <= now();
```

### Denied org loses the denial UI once the access token dies

`/onboarding/denied` is behind `RequireAuth`. After access TTL (or a failed
refresh), Instagram callback returns 403 “not permitted” and the SPA shows a
generic failure — never the denial page. (Admin un-deny exists; this is the
post-deny UX hole for the org themselves.)

### Access JWT survives `token_version` revocation

`create_refresh_token` stamps `ver`; `create_access_token` does not.
`get_current_user` never checks version. Logout / admin deny invalidate refresh
only — a stolen or leftover Bearer access token works until
`ACCESS_TOKEN_TTL_MINUTES`.

---

## Silent data loss

### Notify Me reminders depend on a cron nobody has created yet

`notify_reminders` (`app/jobs/notify_reminders.py`) now emails subscribers and stamps
`notify_me.sent_at`, but the Railway `cron-notify-reminders` service does not exist
yet, so nothing invokes it in production. Until it is created, the query below keeps
climbing. The first run after it is created mails every already-due subscription.

```sql
SELECT count(*) FROM notify_me n JOIN drops d ON d.id = n.drop_id
WHERE n.enabled IS TRUE AND n.sent_at IS NULL
  AND d.apply_open_at <= now() AND d.apply_close_at > now();
```

Note `enabled = false` is never written by any code path (`set_notify` always writes
true, `clear_notify` deletes the row), and the seeds write `true` as well, so a
`false` row can only arrive by hand-written SQL.

### Email delivery is best-effort with no ledger

`_dispatch` in `backend/app/services/email.py` swallows every failure by design so a
bad address cannot roll back the operation that triggered it. Successful sends log
the Resend message id (`resend_id=…`), but there is still no email ledger table, no
per-send delivery status, and no Resend webhook endpoint — so a failed Buzz send
remains indistinguishable from success at the API layer. (`notify_me.sent_at` only
records that the reminder job *attempted* a send; it is not a delivery receipt.)

This is sharpest for `send_application_denied_email`: denied applicants get no
My Campaigns row (`campaigns.py` filters them out and 404s on detail), so the email
is the only channel they ever hear back on.

Also: `resend_verification_email` mints a new token before `_dispatch`. With Resend
down/misconfigured, three failed "re-sents" still consume the max-3 live-token
cap and the fourth returns 429 until the oldest expires (~24h), while the UI claims
the email was re-sent.

### Cron logging is thin despite `job_runs`

`scripts/run_job.py` now upserts a `job_runs` row per invocation (`job`,
`started_at`, `finished_at`, `ok`, `summary` JSON), and `/api/admin/health`
appends last-run age to pipeline signal details. Cron processes still lack an
application `basicConfig`/`dictConfig`, so `logger.info` lines (including
"Email dispatched") can be discarded under the default WARNING threshold —
`logger.exception` still surfaces on stderr. The cron schedule itself lives only
as prose in `DEPLOYMENT.md` / `backend/README.md` (no `railway.toml` in-repo).

### Per-post metric sync failures

`metric_sync` counts failures in its return dict and logs a warning, then continues.
Nothing is persisted. Orgs skipped for a missing, expired, or undecryptable token
are weaker still — they log a warning without incrementing `failures`, so the
summary line reports a clean run.

```sql
-- discovered but never successfully refreshed
SELECT count(*) FROM social_posts WHERE metrics_updated_at IS NULL;
-- insights call failing while basic fields succeed (usually a scope problem)
SELECT count(*) FROM social_posts
WHERE likes IS NOT NULL AND reach IS NULL AND views IS NULL AND total_interactions IS NULL;
```

Only orgs with an accepted application on a live-stage drop are synced at all
(`_eligible_orgs`), so an org's post data freezes the instant their last campaign
ends. `STORY` posts are never refreshed and never eligible for suggestions.

Correction on freeze timing: `_LIVE_STAGES` includes `drop_finished` (so finished
drops keep syncing forever) but **excludes** `finalizing_agreements`, so the gap
between brand finalize and admin advancing to `awaiting_products` is a silent
sync/autolink blackout even though accepted orgs already exist.

### `metric_sync` discovery is single-page (`limit=50`)

`HttpInstagramClient.fetch_user_media` issues one Graph GET with `limit=50` and
ignores `paging.next`. Orgs with more than 50 media items in the 30-day window
silently never insert the older in-window posts. Media-list exceptions set
`media = []` without incrementing the job's `failures` counter.

### Engagement over time is a post-sync cliff

`compute_engagement_series` buckets by `metrics_updated_at`. After a successful
`metric_sync`, every refreshed post shares one stamp, so cumulative engagement
lands in the last bucket and earlier buckets stay ~0. Posts with likes but
`metrics_updated_at IS NULL` (discovery succeeded, insights failed) are excluded
from the series while `_drop_aggregate` still counts them — dashboard totals and
the chart disagree.

### Undecryptable IG ciphertext never forces re-auth

If `TOKEN_ENCRYPTION_KEY` is rotated without re-encrypting rows, `decrypt_token`
raises `TokenDecryptionError`. `metric_sync` / `token_refresh` catch and skip; on
login, `days_until_expiry` never decrypts so a future `expires_at` looks fine.
The org stays "authenticated" while every IG call silently fails.

### Autolink `@handle` false-positives on dotted mentions

`_match` uses `(?<!\w)@{handle}\b`. Word-boundary `\b` fires before `.` / `/`, so
`@nike` matches inside `@nike.official` and `instagram.com/@nike/...`. (`@nike_official`
is safe — `_` is a word character.) Tests only cover `@nikeshoes`-style prefixes,
not dotted handles.

### `reels_skip_rate` silently truncated to 0/1

`fetch_media_insights` does `int(values[0]["value"])` for every metric, including
fractional `reels_skip_rate`. Stored value becomes `0.0` / `1.0` after
`_apply_metrics` casts back to float — corrupt success, not a counted failure.

### Insights failure drops an otherwise-successful basic metrics pull

In `metric_sync`, `fetch_media` and `fetch_media_insights` share one try/except.
An insights error skips updating likes/comments/`metrics_updated_at` even when
basic fields already succeeded.

### Deauthorize can return ok while leaving the token live

OAuth persists only Graph `/me` `profile.id` as `instagram_user_id`. The token-
exchange `user_id` is never stored. Meta’s deauthorize `signed_request.user_id`
may not match; `revoke_instagram_authorization` no-ops unknowns and the route
still returns `{ok: true}`. On a successful match, access JWTs still work until
TTL and `/me` can still show `instagram_username` with a null token.

### Autolink keeps matching forever after `drop_finished`

`_LIVE_STAGES` includes `drop_finished` with window end = `now` (no finished-at
cap). New captions months later still mint pending suggestions. Org finished
detail sets `ApiPostSelector` `readOnly`, so Confirm/Dismiss never render — another
pending-forever path. (Link/unlink/accept are stage-gated on finished; suggestions
still accumulate.)

---

## Broken invariants (no DB constraint backs them)

There are zero `CheckConstraint` declarations in `backend/app/models/` and zero in
`backend/migrations/versions/`. Capacity and unit budget are validated per finalize
call, not cumulatively: `finalize_applicants` compares `len(allocations)` against
`capacity_total` and the current request's unit sum against `total_product_units`,
and only re-decides rows that are currently `applied`. After a reopen and a second
round, both ceilings are exceedable.

```sql
-- accepted beyond capacity
SELECT d.id, d.title, d.capacity_total, count(a.id) AS accepted
FROM drops d JOIN drop_applications a ON a.drop_id = d.id AND a.decision = 'accepted'
GROUP BY d.id HAVING count(a.id) > d.capacity_total;

-- allocated beyond unit budget
SELECT d.id, d.title, d.total_product_units, sum(a.allocated_units) AS allocated
FROM drops d JOIN drop_applications a ON a.drop_id = d.id AND a.decision = 'accepted'
WHERE d.total_product_units IS NOT NULL
GROUP BY d.id HAVING sum(a.allocated_units) > d.total_product_units;

-- accepted with no units on a unit-allocated drop
SELECT a.id FROM drop_applications a JOIN drops d ON d.id = a.drop_id
WHERE a.decision = 'accepted' AND d.total_product_units IS NOT NULL
  AND (a.allocated_units IS NULL OR a.allocated_units = 0);

-- stranded applicants on a finalized drop
SELECT a.id FROM drop_applications a JOIN drops d ON d.id = a.drop_id
WHERE a.decision = 'applied' AND d.applicant_selection_finalized_at IS NOT NULL;

-- active user with no profile row (throws 500 from _require_org/_require_brand)
SELECT u.id, u.portal_role FROM users u
LEFT JOIN organizations o ON o.user_id = u.id
WHERE u.status = 'active' AND u.portal_role = 'org' AND o.id IS NULL;
```

Also unconstrained: `capacity_total <= 0`, `total_product_units <= 0`, and
`apply_open_at > apply_close_at` are all storable.

Other drift worth watching:

- `_org_attributed_totals` aggregates across all of an org's applications on a drop,
  so an org holding a denied row plus a re-applied row renders duplicate totals in
  the brand view. The org-side `get_campaign_aggregate` does not filter on decision
  while the brand-side `_drop_aggregate` counts only accepted, so the two sides can
  disagree on the same campaign.
- `uq_drop_application_active` is partial (`WHERE decision <> 'denied'`), so a denied
  org that re-applies holds two rows.
- `social_posts` uniqueness is `(platform, external_id)` globally rather than
  per-org, so a collision silently drops the second insert.

---

## Missing configuration surface

**Deferred on purpose.** This is the last queued gap: the fix is an admin drop-config
PATCH (plus a hashtag write path, and optional fields on brand create) and it is not
started yet. Everything below still describes live behavior.

`BrandDropCreateRequest` accepts only `title` and `description`. `create_brand_drop`
hardcodes `capacity_total = 10`, `apply_open_at = now + 1 day`,
`apply_close_at = now + 8 days`, `total_product_units = None`, and never sets
`campaign_hashtag`. So every drop created through the product is a spot-only,
capacity-10 drop with a fixed 7-day window and no hashtag; any drop with different
values arrived via `scripts/seed_dev.py` or direct SQL.

`campaign_hashtag` is never written by any route or service (only `seed_dev.py` and
direct SQL do), which means the `campaign_hashtag` and `both` branches of
`autolink_scan`'s `match_reason` are unreachable in production. A live-stage drop
whose brand also has no `instagram_handle` can never accrue attributed posts at all.

---

## Observability leftovers

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

---

## Infra

### SameSite=lax cookies break on cross-site Railway preview hosts

Refresh / OAuth state cookies use `REFRESH_COOKIE_SAMESITE` (default `lax`) on
the API host. FE and API on distinct `*.up.railway.app` sites are cross-site for
cookies, so Instagram callback and refresh XHR omit them. Custom
`www` + `api` on the same eTLD+1 is fine; preview/staging pairs are not.
