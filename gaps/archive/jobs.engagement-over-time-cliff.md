---
id: jobs.engagement-over-time-cliff
title: Engagement over time is a post-sync cliff
kind: silent_loss
severity: P2
status: fixed
surface: jobs
evidence:
  - path: backend/app/services
    note: compute_engagement_series buckets by metrics_updated_at
repro: |
  After metric_sync, chart last bucket has all engagement; earlier buckets ~0; totals vs chart disagree for NULL stamp posts.
fix_when: |
  Series uses a stable time axis (e.g. posted_at) or incremental stamps so chart matches aggregates.
---

`compute_engagement_series` buckets by `metrics_updated_at`. After a successful
`metric_sync`, every refreshed post shares one stamp, so cumulative engagement
lands in the last bucket and earlier buckets stay ~0. Posts with likes but
`metrics_updated_at IS NULL` (discovery succeeded, insights failed) are excluded
from the series while `_drop_aggregate` still counts them — dashboard totals and
the chart disagree.

Fixed by bucketing engagement series on posted_at.
