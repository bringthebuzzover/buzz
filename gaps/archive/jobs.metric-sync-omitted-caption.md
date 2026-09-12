---
id: jobs.metric-sync-omitted-caption
title: metric_sync wipes caption and media URLs when Graph omits them
kind: silent_loss
severity: P2
status: fixed
surface: jobs
evidence:
  - path: backend/app/services/instagram.py
    note: fetch_media distinguishes omitted caption/URLs from present empty/null
  - path: backend/app/jobs/metric_sync.py
    note: _apply_basics carries prior caption/URLs on omit; job summary counters
  - path: backend/tests/test_jobs.py
    note: omit caption, present empty caption, omit URLs, present-null URLs
repro: |
  Linked post with a stored caption containing the brand @handle. Mock Graph
  GET /{media-id} succeeds but omits caption (and/or media_url). After
  metric_sync, post.caption is "" and autolink_scan no longer mints
  suggestions. test_jobs.py covers like/comment omit only.
fix_when: |
  Same omit/carry pattern as likes/comments (archive
  jobs.metric-sync-omitted-engagement): if Graph omits caption, media_url, or
  thumbnail_url, keep the prior DB value; present empty string still overwrites
  caption; present null URL still clears when the key exists. Job summary
  counters + warning logs. Tests for omit-caption, omit-URLs, present-empty
  caption. Do not invent Graph fields.
---

# Omitted caption / media URLs (sibling of omitted engagement)

**Shipped:** Graph omit → carry prior caption / media_url / thumbnail_url;
present `""` caption still overwrites; present-null URL still clears. Job
summary `caption_omitted` / `media_url_omitted` / `thumbnail_url_omitted`.
`closed_in` at commit.
