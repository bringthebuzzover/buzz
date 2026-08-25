---
id: spa.header-logo-overlaps-org-nav
title: Centered coral-nav logo covers org My Campaigns and Profile links
kind: ux_hole
severity: P2
status: open
surface: spa
evidence:
  - path: frontend/src/components/site/SiteHeader.tsx
    note: Desktop row is flex justify-between; logo is absolute left-1/2 z-10 w-56 so it paints over the left cluster
  - path: frontend/src/components/site/SiteHeader.tsx
    note: ORG_NAV_LINKS adds Browse Campaigns + My Campaigns + Profile next to Home; guest/brand left clusters are short enough to usually miss the mark
  - path: frontend/src/layouts/SiteLayout.tsx
    note: Org, brand, and marketing routes all share this header (admin panel does not)
  - path: frontend/tailwind.config.js
    note: No spacing 17; class h-17 on the logo button is a no-op
  - path: frontend/e2e/org.spec.ts
    note: Org E2E never asserts header geometry; Playwright Desktop Chrome is 1280px where overlap is easy to miss
  - path: PRODUCT.md
    note: §6.2 Drop Feed and My Campaigns are the two org surfaces; Profile is a real portal page — chrome must keep those links clickable
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

The coral bar is meant to be **left links | centered BUZZ | Contact**. That
composition is implemented by taking the logo **out of flow** and stacking it
on the flex row. Once an org is authenticated, the left cluster is four
labels with `space-x-8`. From about **650px** (when the desktop row appears)
through roughly **1100px**, the left cluster’s right edge crosses the 224px
centered mark. `z-10` on the logo wins paint and hit-testing.

This is a broken path **today** for the primary org chrome. It is not a
PRODUCT “Later” item and not a Paper redesign (`ideas/paper-ui.md`).

## Why it happens

`SiteHeader` desktop row (`min-[650px]:flex`, `h-[6rem]`, `justify-between`):

1. **Left cluster is in-flow.** Always `Home`, plus `navLinks` from auth.
   Org (`ORG_NAV_LINKS`): Browse Campaigns, My Campaigns, Profile. Brand:
   Dashboard only. Guest / admin-on-marketing-chrome: no extra links.
2. **Logo is `position: absolute; left: 50%; transform: translate(-50%,
   -50%); z-index: 10`** with a fixed `w-56` (14rem / 224px) hit box. Absolute
   positioning does not reserve space. The flex row lays out as if the mark
   were not there.
3. **`h-17` is not in the Tailwind spacing scale** (`theme.extend` in
   `tailwind.config.js` only adds colors/shadows/motion). The class is
   dropped. Height falls through to the SVG’s aspect inside `max-w-full`
   (`buzz-logo.svg` viewBox ~1920×873 → ~102px tall in a 224px box, slightly
   taller than the 96px bar). Horizontal collision is the bug; the dead
   class is leftover slop.
4. **Breakpoint is 650px, not `md`/`lg`.** Below 650px the hamburger +
   right-aligned logo (`max-w-[55vw]`) works. The hole is the desktop row
   at tablet and mid-laptop widths — the same band you get with DevTools
   docked. Playwright `devices["Desktop Chrome"]` is **1280×720**, where a
   ~16px `text-base` left cluster (~490px including `px-8`) can still clear
   a centered 224px mark by a few dozen pixels. CI would stay green.

Auth wiring is doing what it should: `isApiAuth` → org role → four links on
every `SiteLayout` page (home included). `RequireStatus` only gates portal
*routes*, not the header. View-as org uses the same links.

## What it is not

- Console red `GET` / CSP noise on www — see
  [`spa.csp-blocks-gh-pages-inline.md`](spa.csp-blocks-gh-pages-inline.md)
  (and session 401s if present). Unrelated to layout.
- Admin chrome — `AdminLayout` / `AdminSidebar`, no coral wordmark row.
- A missing PRODUCT page. Labels match §6.2 / §6.4; the links exist and
  route. They are just covered.

## Locked v1

Keep the centered marketing mark. Do not rewrite PRODUCT. Do not invent
shorter labels or a left-aligned portal header without an explicit UX ask.

1. **Put the logo in flow.** Three-column grid
   `grid-cols-[1fr_auto_1fr]` (or equivalent flex with a reserved center
   slot). Left cluster / logo / right cluster are siblings. Drop
   `absolute` + `z-10` overlay. `min-w-0` on the side columns so they
   cannot paint into the mark.
2. **Hamburger until the org row actually fits.** Today `min-[650px]`
   shows the desktop row too early for four long labels + `w-56` mark.
   When `navLinks` is the org set, keep the existing mobile panel until
   **`lg` (1024px)** (or measure, but lock a named breakpoint). Guest and
   brand may stay at 650px (short left clusters) so marketing iPad is
   unchanged. One shared breakpoint at `lg` for everyone is acceptable if
   simpler; do not leave org at 650px.
3. **Real logo box.** Replace `h-17` with a valid height (`h-16` or
   `h-[4.25rem]`). `w-56` may shrink toward footer/`ContactModal` scale
   (`w-36` / `max-w-[180px]`) if the grid still crowds at `lg`; do not
   grow it.
4. **Test the geometry.** Playwright org session (dev auto-login is
   enough): viewport **900px** (must) and **1280px** (still must pass).
   Assert My Campaigns and Profile are visible; `getBoundingClientRect`
   of each link does not intersect the logo image; clicking My Campaigns
   goes to `/org/campaigns`, not `/`. Keep a **375px** check that the
   hamburger is used and those links appear in the panel. No new E2E
   journey beyond header chrome.

## Explicit OUT

- Paper / theme redo.
- Shortening “Browse Campaigns” / “My Campaigns” as the fix.
- Moving the wordmark to the left on portal pages (different product look).
- Changing org routes or PRODUCT §6.
- Chasing www console errors in this gap.
