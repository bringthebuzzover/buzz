---
id: brand.drop-create-thin
title: Brand drop create hardcodes capacity, window, and omits hashtag
kind: ux_hole
severity: P2
status: deferred
surface: brand
evidence:
  - path: backend/app/services/drops.py
    note: create_brand_drop hardcodes capacity_total=10 and fixed window
  - path: backend/app/jobs/autolink_scan.py
    note: campaign_hashtag match branches unreachable without SQL/seed writes
repro: |
  Create drop via brand API; always capacity 10, open+1d/close+8d, no hashtag; hashtag autolink never fires in prod.
fix_when: |
  Admin/brand can configure capacity, window, units, and campaign_hashtag; hashtag autolink reachable in production.
---

**Deferred on purpose.** Queued last: admin drop-config PATCH (plus hashtag write
path, optional fields on brand create) is not started yet.

`BrandDropCreateRequest` accepts only `title` and `description`. `create_brand_drop`
hardcodes `capacity_total = 10`, `apply_open_at = now + 1 day`,
`apply_close_at = now + 8 days`, `total_product_units = None`, and never sets
`campaign_hashtag`. So every drop created through the product is a spot-only,
capacity-10 drop with a fixed 7-day window and no hashtag; any drop with different
values arrived via `scripts/seed_dev.py` or direct SQL.

`campaign_hashtag` is never written by any route or service (only `seed_dev.py` and
direct SQL do), which means the `campaign_hashtag` and `both` branches of
`autolink_scan`'s `match_reason` are unreachable in production. A live-stage drop
whose brand also has no `instagram_handle` can never accrue attributed posts at all.
