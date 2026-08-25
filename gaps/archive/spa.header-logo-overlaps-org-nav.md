---
id: spa.header-logo-overlaps-org-nav
title: Centered coral-nav logo covers org My Campaigns and Profile links
kind: ux_hole
severity: P2
status: fixed
surface: spa
evidence:
  - path: frontend/src/components/site/SiteHeader.tsx
    note: Desktop row is now 1fr/auto/1fr grid; org hamburger until lg; logo h-16 max-w-[11rem]
  - path: frontend/e2e/org.spec.ts
    note: Geometry at 1280; hamburger + campaign links at 900 and 375
  - path: PRODUCT.md
    note: §6.2 Drop Feed and My Campaigns are the two org surfaces; Profile is a real portal page
repro: |
  Sign in as an active org (dev auto-login or admin View as). Open / or
  /org/browse. Set the viewport to ~900px wide (iPad landscape, 13" laptop
  with a docked sidebar, or DevTools docked right). The white BUZZ wordmark
  sits on top of "My Campaigns" and "Profile". Those links are hard to read
  and clicks hit the logo (navigate home) because of z-10.
  At <650px the hamburger row is used and does not overlap.
  Logged-out Home + Contact usually clears the mark; brand Home + Dashboard
  is tighter but not the screenshot failure.
fix_when: |
  Org desktop nav at 768px, 900px, and 1280px: Home, Browse Campaigns, My
  Campaigns, Profile, and Contact are fully visible and clickable; their
  bounding boxes do not intersect the logo. Logo stays a centered home
  control. Invalid h-17 is gone. Playwright covers org chrome at a mid
  viewport (not only Desktop Chrome 1280). Do not shorten PRODUCT labels or
  left-align the marketing mark unless a separate UX ask lands.
---

# Centered logo covers org portal nav

**Shipped:** in-flow `1fr / auto / 1fr` coral row; org hamburger until `lg`
(1024px); guest/brand stay at 650px; logo `h-16 max-w-[11rem]` (no `h-17` /
absolute overlay). Playwright: no intersection at 1280px; menu at 900/375.

The coral bar is meant to be **left links | centered BUZZ | Contact**. That
composition was implemented by taking the logo **out of flow** and stacking it
on the flex row. Once an org is authenticated, the left cluster is four
labels with `space-x-8`. From about **650px** (when the desktop row appeared)
through roughly **1100px**, the left cluster’s right edge crossed the 224px
centered mark. `z-10` on the logo won paint and hit-testing.

This was a broken path for the primary org chrome. It is not a PRODUCT
“Later” item and not a Paper redesign (`ideas/paper-ui.md`).

## Why it happened

`SiteHeader` desktop row (`min-[650px]:flex`, `h-[6rem]`, `justify-between`):

1. **Left cluster is in-flow.** Always `Home`, plus `navLinks` from auth.
   Org (`ORG_NAV_LINKS`): Browse Campaigns, My Campaigns, Profile. Brand:
   Dashboard only. Guest / admin-on-marketing-chrome: no extra links.
2. **Logo was `position: absolute; left: 50%; z-index: 10`** with a fixed
   `w-56` (14rem / 224px) hit box. Absolute positioning does not reserve
   space.
3. **`h-17` is not in the Tailwind spacing scale.** Dead class.
4. **Breakpoint was 650px.** Below that the hamburger worked. The hole was
   the desktop row at tablet and mid-laptop widths. Playwright Desktop
   Chrome is **1280×720**, which could still clear a centered 224px mark.

## Locked v1 (implemented)

1. Three-column grid `grid-cols-[1fr_auto_1fr]`; logo in flow.
2. Org hamburger until **`lg` (1024px)**; guest/brand stay at 650px.
3. Logo `h-16 max-w-[11rem]`.
4. Playwright org chrome at 900px and 1280px + 375px menu.

## Explicit OUT

- Paper / theme redo.
- Shortening “Browse Campaigns” / “My Campaigns” as the fix.
- Moving the wordmark to the left on portal pages.
- Changing org routes or PRODUCT §6.
- Chasing www console errors (see
  [`../spa.csp-blocks-gh-pages-inline.md`](../spa.csp-blocks-gh-pages-inline.md)).
