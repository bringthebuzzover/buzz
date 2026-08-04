# Gap clusters (execution queue)

Living bugs remain **one file per gap** under `gaps/<id>.md`. This file is only
the **execution order**, locked approaches, and cluster status. Do not treat it
as a second bug SOT.

Agents: follow [`.agents/skills/fix-gap-cluster/SKILL.md`](../.agents/skills/fix-gap-cluster/SKILL.md)
when the user says `run next cluster`, `run cluster <id>`, or `swarm gaps`.
Flow: explore → plan/todos → implement → full CI (always include Playwright
E2E) → archive → wait for explicit commit/push.

Statuses: `pending` | `in_progress` | `done` | `parked` | `ops`

---

## jobs-metrics

status: done
gaps:
  - jobs.reels-insights-feed-metrics
  - jobs.insights-failure-drops-basics
  - jobs.reels-skip-rate-truncated
  - jobs.metric-sync-single-page
  - jobs.metric-sync-per-post-failures
  - jobs.engagement-over-time-cliff
approach: |
  Touch `backend/app/services/instagram.py` + `backend/app/jobs/metric_sync.py`
  + `backend/app/services/brands.py` (`compute_engagement_series`) + tests in
  `backend/tests/test_jobs.py` (and brand series tests if present).

  1. REELS metric set: In `HttpInstagramClient.fetch_media_insights`, when
     `is_reel=True`, request ONLY reel-safe metrics (reach, views, saved, shares,
     reposts, total_interactions, ig_reels_avg_watch_time,
     ig_reels_video_view_total_time, reels_skip_rate). Do NOT include
     profile_visits, profile_activity, follows on REELS. FEED keeps the current
     non-reel set including profile_* / follows.
  2. Fractional metrics: Parse insight values with a helper that uses `float`
     for `reels_skip_rate` (and any other known fractional names) and `int` for
     the rest. Update return type to `dict[str, int | float]` (or keep dict and
     cast in `_apply_metrics`). Fake client + tests must exercise fractional
     skip rate.
  3. Split basics vs insights in `sync_metrics` refresh loop: `fetch_media`
     success always writes likes/comments (and related basic fields) via a
     basics path; `fetch_media_insights` in its own try. Insights success applies
     insight columns + stamps `metrics_updated_at`. Insights failure: keep
     basics, do not wipe prior insight columns, increment `failures`, leave
     `metrics_updated_at` unchanged unless product already stamped on basics —
     LOCKED: stamp `metrics_updated_at` only when insights succeed OR when
     basics succeed and insights were skipped as N/A; for insights failure after
     basics, still stamp `metrics_updated_at` so charts include the post, and
     leave insight columns null/prior. Count insights failures in `failures`.
  4. Pagination: `fetch_user_media` follows `paging.next` until exhausted or
     items fall outside the 30-day window (stop early when timestamps age out).
     Cap pages (e.g. 10) to bound runtime; document the cap. Media-list
     exceptions increment `failures` (not silent empty list alone).
  5. Failure accounting: skipped orgs with present-but-unusable tokens
     (expired/undecryptable) increment `failures` (or a dedicated
     `skipped_token` counter that rolls into the job summary and is treated as
     non-clean). Document in job docstring that sync eligibility
     (`_LIVE_STAGES` / finalize→awaiting blackout) is intentional for this
     batch — do NOT expand stage gating here.
  6. Engagement series: bucket by `posted_at` (stable axis), not
     `metrics_updated_at`. Include posts that have engagement fields even if
     insights are partial, consistent with drop aggregates. Update tests.

stop_if:
  - Meta docs contradict reel-safe metric names after checking META.md / Graph
    docs; pause and ask before inventing metrics.

---

## jobs-autolink

status: done
gaps:
  - jobs.autolink-dotted-handle-false-positive
  - jobs.autolink-after-drop-finished
approach: |
  Touch `backend/app/jobs/autolink_scan.py` + tests.

  1. Dotted handle: tighten `_match` so `@handle` does not match inside
     `@handle.more` or path continuations (negative lookahead for `[A-Za-z0-9._]`
     after the handle). Keep underscore-safe behavior. Add tests for
     `@nike.official`, URL path mentions, and exact `@nike` / `@nike_official`.
  2. Finished drops: exclude `drop_finished` from suggestion minting (remove
     from `_LIVE_STAGES` for autolink, or cap window using finished transition
     time if available). Prefer: stop minting new pending suggestions once
     stage is `drop_finished`. Do not change metric_sync stage lists in this
     cluster. Add a test that finished drops do not gain new suggestions.

stop_if:
  - PRODUCT explicitly requires post-finished autolink; ask before changing.

---

## auth-session

status: pending
gaps:
  - auth.deauthorize-userid-mismatch-noop
  - auth.undecryptable-ig-ciphertext
  - auth.denied-org-loses-denial-ui
  - auth.suspended-no-writer
approach: |
  1. Deauthorize: stop returning silent `{ok:true}` on unknown Meta user_id —
     log + return a non-ok or distinct acknowledged-noop that operators can
     detect; on successful revoke, bump `token_version` (or clear such that
     access JWTs die) consistent with Batch 1 revocation. Prefer storing both
     Graph `/me.id` and token-exchange `user_id` if they can differ, or document
     and match the id Meta actually sends on deauthorize callbacks.
  2. Undecryptable ciphertext: on `TokenDecryptionError` in login/jobs paths,
     clear unusable ciphertext (or mark needs_reauth) and surface
     INSTAGRAM_TOKEN_EXPIRED / reconnect to the org; admin health can count
     undecryptable. Do not leave "authenticated" with dead tokens.
  3. Denied UI: allow `/onboarding/denied` without a live session when status
     is denied (route guard exception), and/or Instagram callback maps denied
     users to that page instead of generic 403.
  4. SUSPENDED: remove dead enum + checks if unused, OR add admin
     suspend/unsuspend writers. LOCKED default: remove SUSPENDED from enum and
     auth checks (no writer ever existed); migration/data note if any row has
     the value (unlikely).

stop_if:
  - Removing SUSPENDED conflicts with uncommitted product intent to ship
    suspend UX soon; ask.

---

## drops-brand-integrity

status: pending
gaps:
  - drops.detail-notify-skip-browsable-gates
  - brand.org-attributed-totals-duplicate
  - admin.undeny-silent-no-email
  - admin.job-runs-failed-count-as-heartbeat
approach: |
  1. Drop detail/notify: apply the same browsable gates as feed/apply
     (approved brand, not finished / same filters as `list_org_drop_feed`)
     to get detail, notify subscribe, and clear notify. Reminder job should
     skip non-browsable drops. Tests for finished + unapproved brand.
  2. Attribution: `_org_attributed_totals` filter to the application row's
     decision (or only non-denied / the current applicant row's posts) so
     deny+reapply cannot double-count. Align with `_drop_aggregate` semantics.
  3. Un-deny email: send a restore/access email on admin un-deny (reuse email
     service patterns) OR if PRODUCT says intentional silence, update PRODUCT
     and archive as wontfix — LOCKED: send email (mirror deny/approve).
  4. Health heartbeat: last-run age prefer latest `ok=true` run (fallback:
     show failed distinctly). Fix token_refresh inference copy to match
     expired-token signal (`expires_at <= now`).

---

## models-unique

status: pending
gaps:
  - models.social-posts-global-unique
approach: |
  Change uniqueness to per-org `(org_id, platform, external_id)` via Alembic
  migration. Handle existing duplicates carefully (unlikely). Update insert
  paths / IntegrityError handling in metric_sync. Do NOT ship
  `models.missing-check-constraints` in this cluster (parked deferred).

stop_if:
  - Production data has cross-org external_id collisions; pause for data plan.

---

## ops-deploy

status: ops
gaps:
  - ops.notify-cron-not-created
  - deploy.samesite-lax-railway-preview
  - ops.cron-logging-thin
  - ops.email-best-effort-no-ledger
  - ops.observability-thin
approach: |
  Not a normal code swarm. Agent may:
  - Add cron logging `basicConfig` for info in `run_job.py` (cron-logging-thin
    code slice) when executing a dedicated ops-code pass.
  - Update DEPLOYMENT.md checklists for notify cron + SameSite/custom domains.
  - Prepare Railway steps; do NOT invent production secrets.
  Human must create `cron-notify-reminders` on Railway and decide preview
  cookie/domain strategy. Email ledger and full observability are larger;
  split follow-ups rather than boiling the ocean in one run.

stop_if:
  - Always pause before mutating Railway production without explicit user OK.

---

## parked

status: parked
gaps:
  - brand.drop-create-thin
  - auth.expired-ig-token-reconnect
  - models.missing-check-constraints
  - openapi.422-wrong-shape
  - org.awaiting-products-suggestions-no-ui
  - product.capacity-closed-during-open-unreachable
  - posts.sibling-dismiss-never-rearms
note: |
  deferred / ops-heavy / wontfix. Do not auto-execute. Un-park only with an
  explicit user request naming the gap id.
