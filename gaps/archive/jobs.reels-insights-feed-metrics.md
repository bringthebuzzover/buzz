---
id: jobs.reels-insights-feed-metrics
title: REELS insights always request FEED-only metrics
kind: silent_loss
severity: P1
status: fixed
surface: jobs
evidence:
  - path: backend/app/services/instagram.py
    note: fetch_media_insights always asks profile_visits/activity/follows then reel metrics
repro: |
  Sync a REELS media id against real Graph; #100 unsupported metrics; metrics_updated_at never stamped.
fix_when: |
  REELS requests only reel-safe metric sets; Reels stamp metrics_updated_at on success.
---

`HttpInstagramClient.fetch_media_insights` always asks for
`profile_visits,profile_activity,follows` (Meta: FEED/STORY), then appends reel
metrics when `is_reel=True`. Graph returns `#100` for unsupported metrics on REELS;
`metric_sync` shares one try/except for basics+insights, so Reels never stamp
`metrics_updated_at`. Fake Instagram client tests hide this.

Fixed by requesting reel-safe insight metrics only (no FEED profile_* / follows on REELS).
