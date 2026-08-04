---
id: models.social-posts-global-unique
title: social_posts uniqueness is global not per-org
kind: invariant_break
severity: P2
status: open
surface: models
evidence:
  - path: backend/app/models
    note: unique (platform, external_id) globally; collision silently drops second insert
repro: |
  Two orgs somehow share an external_id; second insert silently dropped.
fix_when: |
  Uniqueness is scoped per-org (or collisions are explicit errors).
---

`social_posts` uniqueness is `(platform, external_id)` globally rather than
per-org, so a collision silently drops the second insert.
