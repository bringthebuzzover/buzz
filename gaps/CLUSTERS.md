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

status: done
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

status: done
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

status: done
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

# Open queue (priority order)

Auto-pick (`run next cluster`) = first `status: pending` below.
`ops` clusters require `run cluster <id>`. Do not auto-pick `parked`.

Priority rationale (UX + prod correctness first; small batches; deps respected):
1. Email false-success / one-shot burns (unblocks safe notify cron)
2. IG reconnect SPA
3. Admin drop logistics + DB CHECKs
4. PRODUCT capacity Fork A (docs/copy)
5. Autolink mint only at drop_active
6. Cron INFO logging
Then human ops: notify Railway cron, SameSite App Review checklist.

---

## email-honesty

status: done
gaps:
  - ops.email-best-effort-no-ledger
approach: |
  Implement Locked v1 in `gaps/ops.email-best-effort-no-ledger.md` only
  (cheap wins — no ledger):
  1. `_dispatch` + v1 wrappers return bool; never raise from dispatch.
  2. Verification resend/change-email: on false, invalidate token; raise
     `EMAIL_SEND_FAILED` (502/503); SPA must not claim re-sent.
  3. First signup: keep user+org (`pending_email_verification`); delete
     token; `email_sent: false` / wire `emailSent`; SPA durable failure UX.
  4. Notify Me: stamp `sent_at` only when dispatch true.
  5. Denial: structured log only (does not close org-visible silent loss).
  Out: ledger, webhooks, invite/reset honesty, admin email UI.
  **Partial / not timeless:** on archive, leave `ops.email-ledger`
  deferred follow-up open (ledger + denial channel + invite/reset).

stop_if:
  - Product insists denial needs in-app channel in the same PR (expand scope).
  - Scope expands into `ops.email-ledger` work.
  - Archiving without `gaps/ops.email-ledger.md` still living.

---

## auth-ig-reconnect

status: done
gaps:
  - auth.expired-ig-token-reconnect
approach: |
  Implement Locked v1 in `gaps/auth.expired-ig-token-reconnect.md`:
  1. FE: `fetchMe` / `apiFetch` / `AuthContext` distinguish
     `INSTAGRAM_TOKEN_EXPIRED` → `needs_instagram_reconnect` + latch
     `buzz.instagramReconnect`; mid-session hard-nav; cold Navigate.
  2. Public `/reconnect-instagram` (no authenticated fetches / anti-loop).
  3. Latch clear on `InstagramCallbackPage` success (`setAccessToken` +
     `/org/browse`); pending_email → verify via RequireStatus.
  4. BE: clock-expiry clear ciphertext + bump `token_version` in dedicated
     session before raise (undecryptable parity).
  5. Admin + DEPLOYMENT copy: cron cannot resurrect expired; Clear is ops
     assist.

stop_if:
  - Meta OAuth reconnect path broken in staging; pause before shipping UX-only.

---

## admin-drop-config

status: done
gaps:
  - brand.drop-create-thin
  - models.missing-check-constraints
approach: |
  1. Phase 1 from `gaps/brand.drop-create-thin.md`: `PATCH /api/admin/drops/{id}`
     for capacity / window / units / hashtag (image/location OUT); omit vs null
     via `exclude_unset`; epoch-ms windows; stage gate; AdminDropDetail editors;
     `useAdminMutation` invalidate all `["admin"]`.
  2. Then (same cluster, after PATCH): Locked v1 from
     `gaps/models.missing-check-constraints.md` — named CHECKs on Drop +
     allocated_units; NOT VALID → VALIDATE; do not block Phase 1 archive if
     CHECKs slip — prefer same PR.

stop_if:
  - Prod drops already violate proposed CHECKs; pause for data repair.

---

## product-capacity-docs

status: done
gaps:
  - product.capacity-closed-during-open-unreachable
approach: |
  Fork A only (`gaps/product.capacity-closed-during-open-unreachable.md`):
  rewrite PRODUCT §4.1 / §5.3.1 / §6.3 (incl. intro spots example) / §7.1–7.2
  (+ §8–§10/glossary) to batch-finalize after `apply_close_at`; conditional
  Open spots copy (`Up to N` vs reopen `M of N`); comment updates in
  `dropStatus.ts` / `DropFeedCard`. No backend finalize/apply changes.
  Fork B out of scope.

stop_if:
  - Product locks Fork B (mid-window accept) instead; stop and open a new gap.

---

## autolink-mint-stages

status: done
gaps:
  - org.awaiting-products-suggestions-no-ui
approach: |
  Locked A in `gaps/org.awaiting-products-suggestions-no-ui.md`: mint only at
  `drop_active` (`_MINT_STAGES` / independent of metric_sync `_LIVE_STAGES`);
  update docstring; test awaiting_products → 0 suggestions; keep Active happy
  path. Do not change metric_sync stages or posts.py API gates.

stop_if:
  - Product requires suggestions UI during awaiting_products (Option B).

---

## ops-cron-logging

status: done
gaps:
  - ops.cron-logging-thin
approach: |
  Locked v1 in `gaps/ops.cron-logging-thin.md`: in `run_job.py` `main()`,
  configure INFO for `app.*` on stderr (`basicConfig` + dampen httpx/
  sqlalchemy/asyncpg, or app-scoped handler). No import-time config. Leave
  `job_runs` + stdout JSON + schedule docs alone.

stop_if: []

---

## ops-notify-cron

status: done
gaps:
  - ops.notify-cron-not-created
approach: |
  Human Railway create per Locked v1 in `gaps/ops.notify-cron-not-created.md`:
  clone `cron-drop-autoclose` → `cron-notify-reminders`; exact 15-var env;
  RAILPACK required; `*/5`; prefer after `email-honesty` (sent_at on true) or
  hard-gate Resend domain verify. Agent may tick DEPLOYMENT.md checkbox after
  human confirms; no agent Railway mutate without explicit user OK.

stop_if:
  - Always pause before mutating Railway production without explicit user OK.
  - Prefer `email-honesty` done first (or Resend hard-gate).

---

## test-jwt-secret-length

status: done
gaps:
  - test.jwt-secret-key-length-warning
approach: |
  Locked v1 in `gaps/test.jwt-secret-key-length-warning.md`:
  1. Lengthen `_DEV_SECRET_KEY` in `config.py` to ≥32 bytes (keep
     `dev-secret-change-me-…` prefix).
  2. Forbidden-dev-secret set includes historical `"dev-secret-change-me"`
     **and** current `_DEV_SECRET_KEY`; off-dev guard rejects any of them.
  3. Sync `.env.example`; update `test_hardening.py` to assert old literal
     (and preferably shared forbidden constant).
  4. No filterwarnings. Verify zero `InsecureKeyLengthWarning` in pytest.
  Non-goals: Railway/prod rotation, arbitrary min-length validator, HS256 change.

stop_if: []

---

## test-httpx-cookies

status: done
gaps:
  - test.httpx-per-request-cookies-deprecated
approach: |
  Locked v1 in `gaps/test.httpx-per-request-cookies-deprecated.md`
  (run after `test-jwt-secret-length`):
  1. Replace all 17 per-request `cookies=` in `test_auth_routes.py`,
     `test_hardening.py`, `test_instagram_auth.py`.
  2. Pattern: jar replace (`Cookies({…})`) or `clear()`+`set` before each
     explicit-cookie call — never bare `cookies=` on the request.
  3. Race test: jar=old → won → jar=old for lost → jar=winner for again.
  4. Verify with `-W error::DeprecationWarning`. No warning filters.
  Non-goals: product cookie behavior, httpx `<1` pin as DoD, Playwright.

stop_if: []

---

## posts-stories-unsupported

status: done
gaps:
  - posts.stories-unsupported
approach: |
  Locked v1 in `gaps/posts.stories-unsupported.md`:
  1. `metric_sync` discovery: skip insert when `media_product_type == STORY`
     (optional `skipped_story` in job summary).
  2. Keep refresh STORY exclusion; autolink already FEED+REELS only.
  3. `link_post` + `accept_suggestion` reject STORY (stable error code).
  4. Prefer hide STORY in `list_org_posts` (linker never shows dead rows).
  5. Admin: exclude STORY from `posts_never_refreshed` + `metric_sync_stale`;
     update admin label notes.
  6. Docs: `META.md` + `ARCHITECTURE.md` (Stories out of scope). PRODUCT
     one-liner only with explicit user OK.
  7. Tests: discovery skip, link reject, admin counter exclusion.
  8. Read-only SQL detect existing STORY rows; cleanup only if count > 0.
  Non-goals: `/stories` poller, `story_insights` webhook, AD refresh skip,
  PG enum drop, platform observability (`ops.observability-thin`).

stop_if:
  - Expanding into hourly Stories sync or Facebook Login / webhook work.
  - Skipping AD discovery/refresh without a separate product ask.
  - Editing PRODUCT.md without explicit user OK.

---

## ops-samesite

status: ops
gaps:
  - deploy.samesite-lax-railway-preview
approach: |
  Locked v1 in `gaps/deploy.samesite-lax-railway-preview.md`: docs scrub +
  binary checklist PASS (Railway+none App Review invariant). Agents may edit
  DEPLOYMENT/META/README; humans set env / Meta URLs to META.md hosts.
  Verify Set-Cookie with GET curl (not HEAD).
  **Phase 2 infra done (2026-08-09 Plan A):** www+api on Railway, SPA rebuilt,
  `SameSite=lax` verified — archived
  `gaps/archive/deploy.custom-domain-samesite-lax.md`.
  **Temporary Meta↔env misalignment OK** until
  `gaps/deploy.meta-brand-url-cutover.md` (status ops) — Meta §C still needs
  www/api paste; Railway dual-host is no longer a working auth backup after lax.
  Stay `ops` until Meta Hosts table is pasted + optional IG smoke.

stop_if:
  - Always pause before mutating Railway/Meta without explicit user OK.
  - Claiming IG login E2E PASS before Meta brand URL paste.
  - Orange-clouding `www`/`api` on Cloudflare (Railway must terminate TLS).

---

## sec-audit-quick

status: done
gaps:
  - spa.dead-firebase-dependency
  - spa.unvalidated-post-href
  - auth.email-link-tokens-linger-in-url
  - deploy.openapi-ungated
  - config.environment-dev-bypass
note: |
  Wave A archived 2026-08-11. firebase removed; safeHttpUrl; token URL strip;
  OpenAPI development-only; ENVIRONMENT Literal + Fernet-default test.

---

## sec-audit-session

status: done
gaps:
  - auth.spa-logout-drops-bearer
  - auth.logout-clears-cookie-without-revoke
  - auth.impersonation-unbound-from-admin
note: |
  Wave B archived 2026-08-11. SPA Bearer-then-clear logout; cookie clear only
  on bump or present cookie; imp_ver binds View-as to admin token_version.

---

## sec-audit-token-hash

status: done
gaps:
  - auth.invite-verify-tokens-plaintext
note: |
  Wave C archived 2026-08-11. Shared hash_token; Alembic e2f3a4b5c6d7
  token→token_hash with pgcrypto digest migration.

---

## sec-audit-abuse

status: done
gaps:
  - auth.rate-limit-trusts-client-xff
  - jobs.run-job-commits-partial-on-failure
  - ops.ig-graph-secrets-in-logs
note: |
  Wave D archived 2026-08-11. X-Real-IP rate buckets; run_job rollback then
  failure JobRun; Graph raise from None + no exc_info token leaks.

---

## sec-audit-csp

status: done
gaps:
  - deploy.spa-missing-csp
note: |
  Wave E archived 2026-08-11. frontend/public/serve.json CSP + hardening
  headers. Live curl verify after deploy to www.

---

## security-audit-product-ask

status: done
gaps:
  - product.data-deletion-overpromise
note: |
  Shipped admin org hybrid erase (PRODUCT §3.1.2 / §4.3): IG-handle confirm;
  identity scrub; KPI retention; confirmation email; legal copy align.
  No brand erase / Meta deletion callback.
  `brand.delivery-address-all-applicants` remains parked alone below.

---

## brand-delivery-address

status: parked
gaps:
  - brand.delivery-address-all-applicants
note: |
  API nulls deliveryAddress unless decision is applied or accepted; one
  backend test; no FE privacy branching. Parked separately from org erase.

---

## jobs-metric-omitted-engagement

status: done
gaps:
  - jobs.metric-sync-omitted-engagement
approach: |
  Locked in gap file. Touch `instagram.py` `fetch_media` (or MediaFields +
  apply path) and `metric_sync._apply_basics` / refresh loop + `test_jobs.py`.
  1. Omitted `like_count` / `comments_count` in Graph JSON → carry prior DB
     value (do not write 0).
  2. Warning log with org_id, post_id, external_id, previous value.
  3. Job summary counters `likes_omitted` / `comments_omitted`.
  4. Present fields still overwrite; HTTP errors still skip (unchanged).
  5. Tests: omit likes, omit comments, both present, exception path.
stop_if:
  - Treating real Graph `like_count: 0` as omit (must still apply zeros).

---

## jobs-follower-count-refresh

status: pending
gaps:
  - jobs.follower-count-never-refreshed
approach: |
  Locked in gap file. Daily refresh via a phase inside `metric_sync` (avoid
  new Railway cron): for every org user with a usable IG token, GET Graph
  `followers_count` and write `organizations.follower_count`.
  1. All tokened orgs — not only `_LIVE_STAGES` campaign eligibility.
  2. Omit/null/fail → carry prior value + warn + summary counters
     (`followers_omitted` / `followers_failed`); real 0 overwrites.
  3. Skip erased / no-token (preserve stored count for brand reach KPIs).
  4. Extend `fetch_profile` or add fetch; tests + ARCHITECTURE/DEPLOYMENT note.
stop_if:
  - Meta scopes cannot return `followers_count` for Instagram Login tokens —
    pause and report (carry-over path still ships as no-op refresh).

---

## follow-ups

status: parked
gaps:
  - ops.email-ledger
  - ops.brand-mailbox
  - deploy.npm-workspaces-wontfix
note: |
  Required follow-ups for partial v1 clusters (not timeless-complete).
  Do not auto-execute. Create Locked v1 + un-park only when named explicitly.
  - `ops.email-ledger` — after `email-honesty` archives; ledger + denial
    org channel (or wontfix) + invite/reset honesty.
  - `ops.resend-domain-unverified` — **archived** 2026-08-11 (domain Verified +
    brand invite inbox proof; key rotated onto Railway).
  - `ops.brand-mailbox` — full company mailbox send+receive + replace Cornell
    `contactEmail` (same split; not forward-only).
  - `deploy.npm-workspaces-wontfix` — Railpack ignores workspaces; keep root
    package.json scripts + engines (do not retry workspaces without OK).
  - `deploy.custom-domain-samesite-lax` — **archived** 2026-08-09 (Plan A).
    Residual: `deploy.meta-brand-url-cutover`.
    `deploy.github-repo-owner-shannon` — **archived** 2026-08-10 (all 8 Sources
    `bringthebuzzover/buzz` @ `main`; push `e27a7f6` deployed from org).
    `deploy.apex-hostinger-forward-blocked` — **archived** 2026-08-10
    (Cloudflare DNS + apex→www Single Redirect; Hostinger NS flipped).
    `deploy.gh-pages-brand-domain-retire` — **archived** 2026-08-11
    (Shannon cleared Pages `cname`; www still Railway).

---

## parked

status: parked
gaps:
  - ops.observability-thin
  - posts.sibling-dismiss-never-rearms
note: |
  `ops.observability-thin` — **deferred** (platform readyz/livez/metrics still
  NO_PLAN; STORY slice → pending `posts-stories-unsupported`).
  Sibling dismiss is wontfix. Plus deferred DRY/contract chores from the
  SOT/DRY audit:
  - `openapi.422-wrong-shape` — **archived** 2026-08-10 (app-level 422 → APIResponse)
  - `openapi.untyped-success-responses` — **archived** 2026-08-10 (all success
    routes → DataResponse[T]; FE aliases generated schemas; auth snake_case kept)
  - `auth.token-version-ig-clear-duplication` — **archived** 2026-08-10
    (`bump_token_version` + IG clears via `clear_unusable_instagram_token`)
  - `test.jwt-secret-key-length-warning` — **archived** 2026-08-10
    (`closed_in: 772305a`, cluster `test-jwt-secret-length`)
  - `test.httpx-per-request-cookies-deprecated` — **archived**
    (`closed_in: d5666e3`, cluster `test-httpx-cookies`)
  Do not auto-execute. Un-park only with an explicit user request naming the
  gap id after a Locked v1 exists (or product reverses sibling-dismiss).
