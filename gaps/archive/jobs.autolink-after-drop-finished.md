---
id: jobs.autolink-after-drop-finished
title: Autolink keeps matching forever after drop_finished
kind: silent_loss
severity: P2
status: fixed
closed_in: c21fcc3
surface: jobs
evidence:
  - path: backend/app/jobs/autolink_scan.py
    note: _LIVE_STAGES includes drop_finished with window end=now
repro: |
  Months after finished, new captions still mint pending suggestions; org UI readOnly cannot Confirm/Dismiss.
fix_when: |
  Finished drops stop accruing suggestions (or UI can dismiss); stage gating is consistent.
---

`_LIVE_STAGES` includes `drop_finished` with window end = `now` (no finished-at
cap). New captions months later still mint pending suggestions. Org finished
detail sets `ApiPostSelector` `readOnly`, so Confirm/Dismiss never render — another
pending-forever path. (Link/unlink/accept are stage-gated on finished; suggestions
still accumulate.)
