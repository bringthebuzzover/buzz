---
id: posts.skip-rate-double-percent
title: Reel skip rate rendered as a percentage of a percentage
kind: ux_hole
severity: P2
status: fixed
surface: spa
evidence:
  - path: frontend/src/components/posts/postInsights.ts
    note: formatSkipRate multiplied a 0–100 Graph percentage by 100
  - path: backend/app/services/instagram.py
    note: fetch_media_insights stores Graph's reels_skip_rate unchanged
repro: |
  A brand drop reel whose stored reels_skip_rate is 62.8 (Graph percentage
  points) showed "Skip rate 6280%" on the Instagram insights line. Org
  campaign posts and admin View as use the same formatter.
fix_when: |
  Skip rate is percentage points in [0, 100] from Graph through the API
  to the insights line, and the line cannot render a value above 100%.
---

Instagram media insights return `reels_skip_rate` as percentage points
(62.8 means 62.8%). The insights line treated the stored number as a 0–1
ratio. Brand drop posts, org linked posts, and admin View as share that
line. Reel watch time is milliseconds, and no other insight is a rate.
