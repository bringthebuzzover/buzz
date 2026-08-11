---
id: jobs.metric-sync-omitted-engagement
title: metric_sync zeros likes/comments when Graph omits like_count/comments_count
kind: silent_loss
severity: P2
status: fixed
surface: jobs
evidence:
  - path: backend/app/services/instagram.py
    note: fetch_media returns None when like_count/comments_count keys omitted
  - path: backend/app/jobs/metric_sync.py
    note: _apply_basics carries prior DB values; likes_omitted/comments_omitted summary
repro: |
  Linked post with likes=120. Mock/Graph GET /{media-id} succeeds but omits
  like_count (or comments_count). After metric_sync refresh, post.likes becomes 0
  and brand drop KPIs drop with no error in job summary.
fix_when: |
  If Graph response omits like_count and/or comments_count: keep prior DB value
  (carry-over); log a warning with org_id, post_id, external_id, previous value;
  increment likes_omitted / comments_omitted (or a combined omitted_engagement)
  in the metric_sync job JSON summary. Present fields still overwrite. Tests cover
  omit-likes, omit-comments, both-present, and exception path still skips (no
  overwrite).
---

# Graph omitted engagement overwrites KPIs

Discovered while reviewing KPI staleness vs admin org erase (2026-08-11).

**Shipped:** Graph omit → carry prior DB likes/comments; warn +
`likes_omitted` / `comments_omitted` in job summary; present `0` still applies;
fetch exception path unchanged.

Out of scope (still open): follower_count Graph refresh.
