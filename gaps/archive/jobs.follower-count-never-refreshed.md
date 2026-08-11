---
id: jobs.follower-count-never-refreshed
title: Brand estimated reach uses stale org follower_count — never refreshed from Graph
kind: silent_loss
severity: P2
status: fixed
surface: jobs
evidence:
  - path: backend/app/jobs/metric_sync.py
    note: _refresh_follower_counts phase after media sync
  - path: backend/app/services/instagram.py
    note: fetch_profile requests followers_count (None when omitted)
  - path: backend/app/services/brands.py
    note: total_reach / drop reach = SUM(Organization.follower_count) for accepted orgs
  - path: PRODUCT.md
    note: §4.3 notes daily Graph follower refresh
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

**Shipped:** daily `metric_sync` phase refreshes `organizations.follower_count`
from Graph `/me?fields=…,followers_count` for all tokened non-erased orgs.
Omit/fail keep prior; summary counters `followers_refreshed` /
`followers_omitted` / `followers_failed`. Meta docs confirm the field under
`instagram_business_basic`.

**Out of scope (unchanged):** scrubbing follower_count on erase; changing reach
definition; Business Discovery of third-party accounts.
