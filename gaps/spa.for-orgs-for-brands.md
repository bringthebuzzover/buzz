---
id: spa.for-orgs-for-brands
title: No public tour pages that show what each side needs and how the platform works
kind: ux_hole
severity: P2
status: open
surface: spa
evidence:
  - path: frontend/src/components/home/HomeBringBuzzSection.tsx
    note: Heading is “How to Bring the Buzz Over” but the body is value props, not steps or screens
  - path: frontend/src/AppRoot.tsx
    note: Public routes are home, auth, onboarding gates, legal — no /for-orgs or /for-brands
  - path: frontend/src/pages/auth/LoginPage.tsx
    note: One paragraph on IG Business/Creator + .edu + review; no checklist, mockups, or post-approval loop
  - path: frontend/src/pages/auth/BrandApplyPage.tsx
    note: Apply copy is review-then-setup-email only; no drop / monitor / finalize explanation
  - path: frontend/src/components/home/HomeJoinSection.tsx
    note: Join CTAs go straight to /login and /brand/apply with no “see how it works” path
  - path: PRODUCT.md
    note: §5.1–5.3 and §6.1–6.3 define both motions; PRODUCT does not specify public tour pages
repro: |
  Open / as a logged-out prospect. “How to Bring the Buzz Over” lists benefits.
  There is no page that shows org Instagram → profile → .edu → approval → apply,
  or brand apply → sales call → Buzz-built drop → monitor → batch-finalize.
  /login and /brand/apply do not link to such a page. AppRoot has no /for-orgs
  or /for-brands.
fix_when: |
  Public `/for-orgs` and `/for-brands` exist (SiteLayout), each with a
  requirements list, numbered flow, stylized product frames (not stale live
  PNGs), and a CTA to `/login` or `/brand/apply`. Home “How to…” becomes two
  cards into those routes; footer (v1) links the same. for-brands teaches
  ideas/admin-drops.md option B (intake + admin-minted drop + monitor), not
  today’s brand POST → live stub. for-orgs teaches PRODUCT §6.1 unless
  org-precreate is PRODUCT-locked first. Copy does not promise public IG login
  for non-testers or a verified mailing address. Tests cover routes + home/
  footer links. Do not implement until blockers below are cleared.
---

# Public role tours missing (`/for-orgs`, `/for-brands`)

Prospects cannot see either portal until Buzz approves them, and the two
sides never overlap. The only public “how it works” surface is a value-prop
grid. Account requirements and the campaign loop live in PRODUCT, not in
the SPA.

This is the **last** comprehension step. Shipping it against today’s brand
create would teach the hole in
[`drops.unconfigured-request-on-org-feed.md`](drops.unconfigured-request-on-org-feed.md)
(brand mints a live `drops` row; orgs see placeholders). **Do not implement
until that motion is replaced.**

## Locked v1 (when un-parked)

Two pages, not one with tabs.

| | Orgs | Brands |
| --- | --- | --- |
| Route | `/for-orgs` | `/for-brands` |
| Requirements | Org Instagram **Business/Creator** (not a personal member), campus `.edu`, profile fields in PRODUCT §3.1/§6.1, then Buzz review | Company name + email; Buzz reviews; setup-password email ([`PRODUCT.md`](../PRODUCT.md) §5.1 as-built invite) |
| Flow to illustrate | IG login → profile + `.edu` → verify → pending approval → Drop Feed / apply → if accepted, products ship → post from that org account | Apply or invite → password → **Plan your Campaign** as a talk-to-Buzz ticket → sales call out of band → **admin creates the drop** → brand **monitors** applicants / KPIs / tracker → **batch-finalize after `apply_close_at`** |
| CTA | `/login` | `/brand/apply` |

Home [`HomeBringBuzzSection.tsx`](../frontend/src/components/home/HomeBringBuzzSection.tsx)
becomes two cards into these routes. Footer Get Started links the same. v1
nav: **home + footer only** (logged-out header stays Home / Contact / Join).
`/login` and `/brand/apply` keep a short “See how it works” link — the tour
is not a substitute for the IG Business / setup-email one-liners.

**Frames:** stylized product chrome with fictional campus/brand data
(Paper snapshot → simplify is the workshop in [`ideas/paper-ui.md`](../ideas/paper-ui.md)).
Not raw View-as PNGs (stale + PII). Frames must match shipped screens, not
invent targeting maps, Calendly, EasyPost, or guest brand dashboards.

**Emails stay transactional.** Do not add a handbook newsletter.

## for-brands must wait on admin-drops B

Brand motion to teach is [`ideas/admin-drops.md`](../ideas/admin-drops.md)
**option B** (promoted; PRODUCT §5.2 not rewritten yet):

1. Plan your Campaign → `drop_requests` intake, not a `drops` row.
2. Sales call out of band.
3. Admin POSTs a fully configured drop; email `{FRONTEND_URL}/brand/drops/{id}`.
4. Brand watches tracker / applicants / KPIs; finalize unchanged (§7.1).

Do **not** screenshot `/brand/requests/new` → immediate `/brand/drops/:id`
or org cards with `placehold.co` / “Multiple Campuses”.

**Hard blockers (archive or lock these first):**

1. [`drops.unconfigured-request-on-org-feed.md`](drops.unconfigured-request-on-org-feed.md)
   archived — intake + admin create shipped; org feed only sees real drops.
2. PRODUCT §5.2 rewritten so “drop request” is not `POST /api/brands/me/drops`
   (admin-drops: do not implement B until that rewrite).
3. Remaining admin-drops forks locked so frames match reality, especially
   **who owns creative** vs [`brand.drop-creative-uneditable.md`](brand.drop-creative-uneditable.md)
   (brand PATCH title/hero vs Buzz writes creative at mint). Also tracker
   start stage, publish-vs-create, intake field shape.

Until (3) is decided, do not draw a brand creative editor or claim the brand
self-configures title/hero.

## for-orgs — current PRODUCT, not precreate

[`ideas/org-precreate.md`](../ideas/org-precreate.md) is **exploring**, not
PRODUCT. Default tour is Instagram-first PLG (§3.1 / §6.1). If precreate is
PRODUCT-locked **before** this gap is un-parked, rewrite for-orgs to claim
link → waiting room / Connect Instagram; do not wait on that idea to ship.

Copy constraints (not full blockers):

- [`deploy.meta-business-verification.md`](deploy.meta-business-verification.md)
  — public IG login is still testers-only. Do not promise any campus org can
  Continue with Instagram until Advanced Access. Honest: Business/Creator
  account, then Buzz review.
- [`org.shipping-address-unverified.md`](org.shipping-address-unverified.md)
  — required ship-to is free text. Do not promise verified/structured
  address until that gap is fixed. “You’ll give a shipping address” is OK.

## Related, not blockers

- [`ops.brand-mailbox.md`](ops.brand-mailbox.md) — invite / “campaign is up”
  mail still works via Resend; public Contact mailto is still Cornell.
  Tour CTAs should not depend on a company inbox existing.
- [`ideas/paper-ui.md`](../ideas/paper-ui.md) — visual workshop for frames,
  not a second product spec.

## Explicit OUT

- A combined FAQ / `/help` as the main fix.
- One page with brand+org tabs.
- Teaching today’s brand stub-as-campaign.
- Teaching org-precreate until it is PRODUCT-locked.
- Header nav items in v1.
- Guest (logged-out) live portal demos.
- PRODUCT edits in this gap beyond naming the two public routes when
  implementing (ask first if copy would change §5 / §6 behavior).
