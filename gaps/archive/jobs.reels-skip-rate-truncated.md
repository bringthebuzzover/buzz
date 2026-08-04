---
id: jobs.reels-skip-rate-truncated
title: reels_skip_rate silently truncated to 0/1
kind: silent_loss
severity: P2
status: fixed
surface: jobs
evidence:
  - path: backend/app/services/instagram.py
    note: int(values[0][value]) on fractional reels_skip_rate
repro: |
  Insights returns fractional skip rate; stored value becomes 0.0 or 1.0 after cast.
fix_when: |
  Fractional metrics stored as floats without int truncation.
---

`fetch_media_insights` does `int(values[0]["value"])` for every metric, including
fractional `reels_skip_rate`. Stored value becomes `0.0` / `1.0` after
`_apply_metrics` casts back to float — corrupt success, not a counted failure.

Fixed by parsing reels_skip_rate as float.
