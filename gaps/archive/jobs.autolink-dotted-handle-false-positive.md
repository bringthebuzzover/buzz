---
id: jobs.autolink-dotted-handle-false-positive
title: Autolink @handle false-positives on dotted mentions
kind: silent_loss
severity: P2
status: fixed
closed_in: c21fcc3
surface: jobs
evidence:
  - path: backend/app/jobs/autolink_scan.py
    note: _match (?<!\w)@{handle}\b matches inside @nike.official
repro: |
  Caption contains @nike.official with brand handle nike; suggestion minted incorrectly.
fix_when: |
  Matcher rejects dotted/path continuations; tests cover dotted handles.
---

`_match` uses `(?<!\w)@{handle}`. Word-boundary `` fires before `.` / `/`, so
`@nike` matches inside `@nike.official` and `instagram.com/@nike/...`. (`@nike_official`
is safe — `_` is a word character.) Tests only cover `@nikeshoes`-style prefixes,
not dotted handles.
