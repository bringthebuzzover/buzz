---
id: jobs.insights-fetch-fails-every-post
title: Nightly metric sync fails the insights call for every post, so reach never fills
kind: silent_loss
severity: P2
status: fixed
closed_in: null
surface: jobs
evidence:
  - path: backend/app/jobs/metric_sync.py
    note: insights except branch counted failed += 1 with no log line, so the Graph error was invisible
  - path: backend/app/services/instagram.py
    note: _FEED_INSIGHT_METRICS / _REEL_INSIGHT_METRICS requested reposts; Graph rejects the whole call (#100)
  - path: production job_runs (metric_sync, 2026-10-03..05)
    note: every run reported posts_refreshed 7, failures 7, posts_discovered 0, thumbnail_url_omitted 5
repro: |
  Production job_runs: failures equals posts_refreshed every night. Linked UPDATE
  post (Epsilon Nu Tau reel, likes 31 / comments 7) had social_posts.reach = NULL.
  Probe from the api container: full metric list → 400 code=100 "Instagram Insights
  Media API endpoint does not support the metrics: reposts"; every other metric
  alone → 200 (FEED and REELS).
fix_when: |
  Insights failures log the Graph status + error message, the metric list contains
  only supported names, and a production run shows failures 0 with reach populated.
---

Basics (likes, comments, caption, media) refreshed fine and `metrics_updated_at`
was stamped, so the dashboard looked fresh. Every `/{media_id}/insights` call
failed because the requested metric list included `reposts`, which the Instagram
Login media insights endpoint does not support; one unsupported name fails the
whole request. The except branch swallowed the error without logging it.

Fix: drop `reposts` from both metric lists (column kept, stays NULL);
`fetch_media` / `fetch_media_insights` route HTTP failures through `_fail_ig`
(logs status + Meta error message, never the token); `metric_sync` logs org/post
ids on media and insights failures. Verify after deploy: next `metric_sync`
`job_runs.summary.failures` should be 0 and linked posts should have `reach`.
