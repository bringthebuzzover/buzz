---
id: jobs.follower-refresh-silent-zero
title: metric_sync can report followers_refreshed 0 with no follower warning
kind: ops
severity: P3
status: fixed
surface: jobs
evidence:
  - path: backend/app/jobs/metric_sync.py
    note: _refresh_follower_counts logs only on fetch error or omitted followers_count; token skip and missing org row are silent
  - path: backend/app/jobs/metric_sync.py
    note: media sync can refresh posts for an org whose user is then absent from the follower candidate query
repro: |
  Production cron-metric-sync at 2026-10-28 00:57 UTC (deploy 545ddd0) logged
  orgs 3, posts_refreshed 2, followers_refreshed 0, followers_failed 0.
  Stderr had two thumbnail_url omissions for one org and no
  followers_omitted, followers_failed, or profile-lookup warnings.
  The same shape appeared on the 2026-10-27 19:04 UTC scheduled run.
  Omit and fail both warning-log before returning those counters, so Graph
  /me was not counted. The only silent exits are an empty candidate query,
  _token_for returning None, or no organizations row. Media refresh of that
  org's posts requires a usable token on organizations.user_id, which the
  follower query also requires plus portal_role=org and a non-null token column.
fix_when: |
  A metric_sync run that refreshes posts for an org either updates that org's
  follower_count or emits a follower warning / non-zero followers_failed or
  followers_omitted. Silent token or missing-org skips are visible in the
  summary. No behavior change that overwrites a stored count with null.
---

# Follower refresh can finish at zero with no warning

`_refresh_follower_counts` increments `followers_refreshed` only after a
present `followers_count`, and increments `followers_omitted` /
`followers_failed` only around `fetch_profile`. Both of those branches log
`metric sync followers_omitted` or `metric sync followers_failed`.

A summary of `followers_refreshed: 0` and `followers_failed: 0` with none of
those warnings means the loop never called Graph. That is what production
logged at 2026-10-28 00:57 UTC and on the previous scheduled run, while still
refreshing two posts for one eligible org.

Those posts prove that org's user had a decryptable, unexpired token in the
same process. The follower query should include that user when
`portal_role` is `org`, `status` is not `erased`, and
`instagram_access_token` is not null. This pass did not query production
`job_runs` or Postgres (Railway's log view stored the stdout JSON as an
empty info line), so the excluding column is not identified here. Not changed
in the bind-time follower seed: there is no proven write bug on the refresh
path, and tests already cover omit, fail, zero, and erased.

## Resolution

Media sync loads `organizations.user_id` and refreshes posts whenever
`_token_for` returns a token. It does not filter `portal_role`. Follower
refresh only selected users with `portal_role=org`, a non-null token column,
and a non-erased status, then `continue`d with no log when `_token_for`
returned None or no organization row existed. Those are the only exits that
produce `followers_refreshed 0` and `followers_failed 0` with no follower
warning. A post refresh already proves the token is usable and the org row
exists, and `_eligible_orgs` uses the same non-erased status predicate, so the
candidate predicate media sync does not share is `portal_role=org`. Production
rows were not queried (no database credentials in this run). Railway deploy
logs for 2026-10-27 19:04 UTC, 2026-10-28 00:57 UTC, and later runs through
03:04 UTC show thumbnail omissions and no `followers_omitted`,
`followers_failed`, or `followers_skipped` lines, which matches that silent
exit.

The job now still walks that candidate query, but logs and counts
`followers_skipped` for an unusable token or a missing org row. It then
loads any media-sync org user the query did not return (same `db.get` as
media sync, erased accounts still skipped) and refreshes that org's follower
count, warning `followers candidate missed` with `portal_role` and `status`.
Omit and fetch failure still keep the stored count.
