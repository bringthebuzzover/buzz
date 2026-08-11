---
id: jobs.follower-count-never-refreshed
title: Brand estimated reach uses stale org follower_count — never refreshed from Graph
kind: silent_loss
severity: P2
status: open
surface: jobs
evidence:
  - path: backend/app/services/onboarding.py
    note: follower_count set once from onboarding form
  - path: backend/app/services/orgs.py
    note: PATCH /api/orgs/me can update manually; no Graph write path
  - path: backend/app/services/instagram.py
    note: fetch_profile only requests id,username,account_type — no followers_count
  - path: backend/app/services/brands.py
    note: total_reach / drop reach = SUM(Organization.follower_count) for accepted orgs
  - path: PRODUCT.md
    note: §4.3 reach from follower counts; §8 diagram says reach estimates are refreshed
repro: |
  Org onboards with follower_count=1000. IG grows to 5000. Never PATCH profile.
  Brand drop/aggregate totalReach still uses 1000 until manual edit or null.
fix_when: |
  Daily job (prefer phase inside metric_sync — no 7th Railway cron) refreshes
  organizations.follower_count from Graph `followers_count` for every org user
  with a usable IG token (not only live-stage campaign orgs). If the field is
  omitted, null, or the call fails: keep prior DB value, log warning
  (org_id, user_id, previous value, reason), increment job-summary counter
  (e.g. followers_omitted / followers_failed). Present numeric values overwrite
  including real 0. Skip erased / no-token orgs (leave stored count for KPI
  retention). Tests + DEPLOYMENT/ARCHITECTURE note. PRODUCT §4.3 may note
  Graph refresh cadence when implementing.
---

# Stale follower_count / estimated reach

**No existing gap** covered this (search 2026-08-11). Related only by exclusion in
`jobs.metric-sync-omitted-engagement`.

## As-built

| Source | Updates `follower_count`? |
| --- | --- |
| Onboarding profile submit | Yes (manual form) |
| `PATCH /api/orgs/me` | Yes (manual) |
| `metric_sync` / `token_refresh` / deauthorize | **No** |
| Graph `/me` profile fetch | Does not request `followers_count` |

Brand **estimated reach** is entirely this column (`brands.py` aggregates). Null → 0 reach for that org.

PRODUCT §8 implies “reach estimates” are pulled/refreshed with post metrics; as-built they are not.

## Locked approach

**Cadence: daily** — same order of magnitude as `metric_sync` (`0 3 * * *`). Followers do not need hourly refresh; daily keeps reach honest without a new high-frequency cron.

**Where:** Prefer a **phase inside `metric_sync`** (after or before post sync) that walks **all** org users with a decryptable, non-expired token — not only `_LIVE_STAGES` accepted orgs — so inactive/onboarding-complete orgs also stay current before they appear on a drop. Avoid a 7th Railway cron unless the phase makes the job too long.

**Graph:** `GET /me?fields=…,followers_count` (or dedicated fetch) with the org’s long-lived token. Confirm field works with Buzz’s Instagram Login scopes during implement; if Meta denies the field, log + omit counter and keep prior (do not invent Business Discovery for other users).

**Omit / fail = carry-over (same spirit as `jobs.metric-sync-omitted-engagement`):**

1. `"followers_count" not in body` or null → keep prior; warn; `followers_omitted++`
2. HTTP / decrypt failure → keep prior; warn; `followers_failed++`
3. Present integer (including `0`) → write `organizations.follower_count`
4. Skip `status=erased` and tokenless users (erase plan keeps last count for KPIs)

**Out of scope:** scrubbing follower_count on erase; changing reach definition away from follower sums; Business Discovery of third-party accounts.
