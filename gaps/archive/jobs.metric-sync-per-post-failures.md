---
id: jobs.metric-sync-per-post-failures
title: Per-post metric sync failures are not persisted
kind: silent_loss
severity: P2
status: fixed
closed_in: 431f6c9
surface: jobs
evidence:
  - path: backend/app/jobs
    note: metric_sync counts failures in return dict only; skipped orgs may not increment failures
repro: |
  ```sql
  SELECT count(*) FROM social_posts WHERE metrics_updated_at IS NULL;
  SELECT count(*) FROM social_posts
  WHERE likes IS NOT NULL AND reach IS NULL AND views IS NULL AND total_interactions IS NULL;
  ```
fix_when: |
  Failures are durable/observable; skipped-token orgs count as failures; freeze/blackout stages are intentional and documented.
---

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

Fixed by counting skipped-token and media-list failures in the job summary.
