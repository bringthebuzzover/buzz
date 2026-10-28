---
id: drops.erased-org-metrics-leak
title: Erased org campaign metrics stay frozen for the brand
kind: invariant_break
severity: P1
status: fixed
surface: drops
closed_in: d2d1086
evidence:
  - path: backend/app/services/admin_erase.py
    note: Org erase freezes linked posts and strips Instagram identifiers
  - path: backend/app/services/erased_org_participation.py
    note: Same strip runs for orgs already erased, without deleting seats
  - path: backend/app/jobs/metric_sync.py
    note: Sync skips erased orgs and posts with metrics_frozen_at set
  - path: PRODUCT.md
    note: §3.1.2 keeps the anonymized numeric snapshot; §7.1 is the separate remove action
repro: |
  Accept an org on a live drop, link a post with likes and reach, then erase the
  org from /admin/orgs. Brand drop detail, the brand drops list, and
  GET /api/brands/me/aggregate still included that org and its metrics, and the
  post still carried a permalink and caption. Observed 2026-10-28 on drop
  647ea986-5af0-44c8-b5ff-03cbddf2d2fd after org
  798bf694-9ebf-41fc-8fda-57eec7f15e1a was erased. Replacement org
  d76c91b2-b8c1-4157-8f61-d046b7c9d2a1 was a separate row.
fix_when: |
  Erase keeps the accepted seat, the post link, and the last numeric snapshot,
  strips Instagram identifiers, and stamps metrics_frozen_at so sync skips the
  post. Brand and admin totals still include those numbers. The brand sees
  Deleted organization with a metrics-frozen label and the freeze date.
  Already-erased rows are frozen by an idempotent migration that does not
  delete seats. A live org that later uses the former handle is untouched.
---

# Erased org metrics stay, identifiers do not

The first cut of this gap deleted the seat so the tombstone left brand totals.
That dropped campaign attribution. The locked behavior is freeze, not delete.

Erase keeps the accepted application, its shipments, the post link, and likes,
comments, reach, views, saved, and shares. It clears the Graph media id
(rewritten to `frozen-{post id}`), permalink, media URL, thumbnail, caption,
raw insight payload, profile visits, follows, watch time, skip rate, reposts,
and total interactions, and stamps `metrics_frozen_at`. Metric sync, autolink,
and manual link or unlink skip that post. `follower_count` and `university`
are cleared so campus totals do not keep the label. Pending applications are
denied. Application and apply-intent pitches are cleared, and open apply
intents expire. Post suggestions, notify-me rows, connect tokens, Instagram
change requests, and linked apply drafts are removed. A later Instagram login
cannot write a token or handle back onto the tombstone.

Migration `e0f1a2b3c4d5` does the same strip for orgs already `status = erased`.
It does not delete applications, links, shipments, or posts. The earlier
destructive revision `c8d9e0f1a2b3` is not in the tree. Deploy applies
`e0f1a2b3c4d5`. Do not run it by hand against production. Downgrade cannot
restore stripped permalinks.

Brand erase is unchanged. An Instagram account switch still keeps the previous
account's last-known post metrics.

Removing one participant from one drop, including the Meta Review test org, is
`admin.remove-participant-from-drop`.
