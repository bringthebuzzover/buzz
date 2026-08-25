---
id: drops.unconfigured-request-on-org-feed
title: Brand drop requests appear on the org feed with placeholder logistics
kind: ux_hole
severity: P2
status: open
surface: drops
evidence:
  - path: backend/app/services/drops.py
    note: create_brand_drop writes a real Drop (placehold.co image, location Multiple Campuses, capacity 10, apply window now+1d/+8d, stage request_received)
  - path: backend/app/services/drops.py
    note: _browsable_drop_filters only requires approved brand and stage != drop_finished — request_received stubs are Upcoming/Open
  - path: frontend/src/pages/brand/BrandRequestDropPage.tsx
    note: Plan your Campaign POSTs title+description only; navigates to the new drop immediately
  - path: frontend/src/components/org/DropFeedCard.tsx
    note: Org card renders drops.image — product-created drops are the placeholder hero
  - path: PRODUCT.md
    note: §5.2 brand request is logistics-owned by Buzz; §6.3 feed is available/upcoming campaigns — not unconfigured stubs
repro: |
  1. Brand POST /api/brands/me/drops {title, description}. 200.
  2. GET /api/drops as an active org. The new id is in the feed (Upcoming until apply_open_at).
  3. Card shows placehold.co hero, location "Multiple Campuses", "Up to 10 spots".
  4. After ~1 day the window is Open; orgs can Apply / Notify Me before admin PATCHes logistics or creative.
fix_when: |
  Brand "Plan your Campaign" creates an intake ticket (`drop_requests`), not a
  `drops` row. Admin POSTs a fully configured drop; org feed / apply / Notify Me
  only see that drop. Brand portal shows the request until converted, then the
  existing drop monitor + finalize. Tests: request absent from GET /api/drops;
  admin-created drop present. Locked approach: ideas/admin-drops.md option B.
---

# Unconfigured drop requests leak onto the org feed

`brand.drop-create-thin` made brand create **title + description** and moved
logistics to admin PATCH. Create still inserts a **live** `drops` row with a
real apply window starting tomorrow. The org feed predicate does not care
that the tracker is `request_received` or that the hero/location/capacity
are server placeholders.

PRODUCT §5.2 is request-then-rep; §6.3 is a catalog of campaigns orgs can
plan around. A placeholder card with a ticking countdown is neither.

Locked fix: [`ideas/admin-drops.md`](../ideas/admin-drops.md) **option B** —
intake ticket + admin POSTs a real drop. A request is not a `drops` row.

Downstream: [`spa.for-orgs-for-brands.md`](spa.for-orgs-for-brands.md) stays
parked until this is archived so `/for-brands` does not teach stub-as-campaign.

## Notes

- Notify Me cron keys off `apply_open_at`; a stub window will email orgs if
  they subscribed from the leaked Upcoming card.
- `drop_autoclose` will move a never-configured stub into
  `finalizing_agreements` after +8d.
- Hide-until-publish (idea option A) is **not** the locked fix.

## Explicit OUT

- Option A (keep brand POST as a hidden `drops` stub).
- Option C (no intake table; mailto-only CTA).
- Brand creative editor (`brand.drop-creative-uneditable`) — separate gap.
- Campus targeting / eligibility.
