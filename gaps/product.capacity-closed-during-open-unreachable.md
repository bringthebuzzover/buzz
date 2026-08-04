---
id: product.capacity-closed-during-open-unreachable
title: PRODUCT capacity-Closed during Open is unreachable
kind: doc_drift
severity: P1
status: deferred
surface: product
evidence:
  - path: PRODUCT.md
    note: §6.3 / §7.2 describe capacity closing feed during Open
  - path: backend/app/services/brands.py
    note: finalize_applicants requires now > apply_close_at
repro: |
  During open window, acceptedCount stays 0 on product paths; spots-remaining never decreases from accepts.
fix_when: |
  Either change PRODUCT to match finalize-after-close, or allow mid-window accepts that close the feed.
---

PRODUCT §6.3 / §7.2 describe filling capacity closing the feed during Open. Accepts
only happen in `finalize_applicants`, which requires `now > apply_close_at`. During
the chronological Open window `acceptedCount` stays 0 on product paths, so
spots-remaining never decreases and capacity-exhaustion Closed cannot occur while
the window is still open.
