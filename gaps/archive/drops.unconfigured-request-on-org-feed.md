---
id: drops.unconfigured-request-on-org-feed
title: Brand drop requests appear on the org feed with placeholder logistics
kind: ux_hole
severity: P2
status: fixed
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
    note: §5.2 ticket ≠ drop; org feed is published campaigns only — not unconfigured stubs
repro: |
  1. Brand POST /api/brands/me/drops {title, description}. 200.
  2. GET /api/drops as an active org. The new id is in the feed (Upcoming until apply_open_at).
  3. Card shows placehold.co hero, location "Multiple Campuses", "Up to 10 spots".
  4. After ~1 day the window is Open; orgs can Apply / Notify Me before admin PATCHes logistics or creative.
fix_when: |
  Full lock: [`LAUNCH.md`](../../LAUNCH.md) Phase B + §2 Brand/drops. Do not implement from
  `ideas/admin-drops.md` alone.

  1. Brand "Plan your Campaign" creates a `drop_requests` ticket only — not a `drops` row.
  2. Admin side-by-side ticket | draft editor; every `drops` row links to a ticket.
  3. Save **unpublished draft** (https image, real window, no placeholders). Brand may see
     drafts on brand surfaces; orgs do not.
  4. **Publish** sets `published_at`; tracker starts at `awaiting_products`; brand email on
     publish (not on draft save).
  5. Org feed / apply / Notify Me / autoclose: **published** drops only (`published_at IS NOT NULL`).
  6. Stop brand `create_brand_drop`; hide legacy `request_received` stubs from org feed until ops cleans.
  Tests: ticket absent from GET /api/drops; unpublished draft absent; published present; email on publish only.
---

# Unconfigured drop requests leak onto the org feed

Fixed in Phase B (`launch-admin-drops`): brand intake writes `drop_requests` only;
admin mints an unpublished draft and **Publish** sets `published_at`. Org feed /
apply / Notify Me / autoclose gate on published. Set `closed_in` at the fixing commit.

**Locked fix:** [`LAUNCH.md`](../../LAUNCH.md) Phase B — ticket + admin draft + **Publish**
(`published_at`). A request is not a `drops` row. Orgs never see unpublished drafts.

Downstream: [`spa.for-orgs-for-brands.md`](../spa.for-orgs-for-brands.md) stays
parked until this is archived so `/for-brands` does not teach stub-as-campaign.

## Explicit OUT

- Brand POST as a hidden `drops` stub (idea option A).
- Option C (no intake table; mailto-only CTA).
- Brand creative editor (`brand.drop-creative-uneditable`) — Want after revamp.
- Campus targeting / eligibility.
