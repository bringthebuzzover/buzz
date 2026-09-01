---
id: paper-ui
title: Paper.design for Buzz UI / theme redo
status: exploring
updated: 2026-09-01
---

# Paper for Buzz frontend design

Brainstorm (2026-08-11). **Not committed behavior.** Promoting any visual
system or portal redesign needs an explicit PRODUCT / UX decision
([`AGENTS.md`](../AGENTS.md) hard stop). Related: [`ai.md`](ai.md) (platform
AI bets — different lane).

Primary refs: [paper.design](https://paper.design/),
[MCP docs](https://paper.design/docs/mcp),
[pricing](https://paper.design/pricing),
YC interview [How To Design In The Agent Era](https://youtu.be/P06RgnUKX_I)
(Stephen Haney × Aaron Epstein, Aug 2026 — captions pulled locally).

## Why this idea exists

Buzz already ships React + Tailwind with Cursor agents editing TSX directly.
That works for correctness, but **layout / theme / visual hierarchy** still
lags what we want for a campus × brand product (marketing home, org PLG,
brand dashboards). Hypothesis: Paper is a better **visual iteration layer**
than “prompt the agent to restyle components cold,” then we land changes back
into `frontend/` as the real SOT.

This is **not** a bet that Paper becomes Buzz’s design system forever. It is a
bet that a short, deliberate **theme + key pages** pass in Paper → code lands
a stronger UI faster than Figma theater or chat-only restyles.

## What Paper is (from product + interview)

- Canvas rendered as **HTML/CSS** (browser engine), so agents read/write DOM
  natively — lower token waste / higher accuracy than proprietary scene graphs
  (Haney’s claim in the YC talk).
- **Human design tool first** that also works as a visual interface for agents
  (Cursor / Claude Code / Codex). Prompting alone is not always the best input;
  drag + direct manipulation stays in the loop.
- Desktop hosts local **MCP** (`http://127.0.0.1:29979/mcp`): inspect selection /
  screenshot / JSX, `write_html`, update styles, export, etc.
- **Snapshot** Chrome extension: grab a live page section as editable layers
  (not a flat screenshot) — paste into Paper and iterate.
- Brand/graphics side: GPU **Paper Shaders**, multi-model image gen (“variety
  pack”), vectorize, extract colors — useful for marketing assets too.
- Explicit philosophy in the talk: agents speed work (resize, variants,
  translation); **taste and care** remain the differentiator. Avoid shipping
  generic “cloud design” slop.

## Thesis for Buzz

**Code stays source of truth** (`frontend/` Tailwind + components). Paper is
the **visual workshop** for a one-time (or episodic) redesign of:

1. **Main theme** — type scale, color, spacing, density, motion language
2. **Marketing / trust surfaces** — home, `/for-orgs` / `/for-brands`, org apply, brand apply, login, join story
3. **Highest-traffic portal shells** — org Drop Feed + campaign detail; brand
   drop detail + aggregate dashboard; light admin chrome if needed

Then agents push accepted frames into existing React components. Do **not**
maintain a parallel forever-synced Paper design system (Haney’s own warning:
two copies of a design system is “impossible, really” to keep accurate —
prefer codebase SOT).

## UI inventory (candidates to redesign)

Re-verified **2026-09-01** against `frontend/src/AppRoot.tsx` (SOT for routes),
page modules on disk, `SiteHeader` / `SiteFooter` / `AdminSidebar` links, plus
tabs, query filters, same-route layouts, and overlays. Earlier 2026-08-11
count (**34** pages) was stale: it missed `/for-orgs`, `/for-brands`,
`/org/apply`, `/onboarding/connect-instagram`, `/admin/requests`, and
`/admin/requests/:requestId`.

Paper scope is **~50–55 designed surfaces**, not one file per filter chip or
loading spinner. Snapshot **pages + tab panels + the two real modals + chrome**;
list filters and native `confirm`/`prompt` inherit the language.

### How we identify a surface

| Field            | Rule                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **id** (primary) | Canonical React Router path, leading `/`, params as `:param` (e.g. `/org/campaigns/:campaignId`). One id = one navigable URL pattern. |
| **file**         | Page module under `frontend/src/pages/…` (or `Navigate` / helper in `AppRoot.tsx` for redirects).                                     |
| **shell**        | `SiteLayout` (marketing chrome) or `AdminLayout` (admin panel).                                                                       |
| **kind**         | `page` = real UI surface; `redirect` = legacy alias (not a redesign target).                                                          |
| **area**         | `public` · `auth` · `onboarding` · `org` · `brand` · `admin`                                                                          |

Not used as primary id: component display name, filesystem alone, or query
strings (admin list filters stay on the list route). **Modals, drawers, tabs,
and status layouts are not extra routes** — listed after the page table.

There is **no 404 page** and no React `ErrorBoundary`. Unmatched URLs match
no `<Route>` in `AppRoot`, so React Router renders **nothing** (not
`SiteLayout` with an empty `<Outlet />`).

### Counts (verified 2026-09-01)

|                              | n                                                                |
| ---------------------------- | ---------------------------------------------------------------- |
| `kind: page`                 | **40**                                                           |
| `kind: redirect`             | **5**                                                            |
| Total AppRoot URL patterns   | **45**                                                           |
| True tab strip               | **1** page (`/admin/drops/:dropId`, 4 tabs)                      |
| Custom modals                | **2** (Contact, Notify Me)                                       |
| Mobile overlay drawer        | **1** (`SiteHeader` nav + backdrop)                              |
| Admin mobile nav             | In-flow expand under header (`AdminSidebar`); not a fixed drawer |
| Missing nav→route            | **0**                                                            |
| Orphan page modules (routed) | **0** (`LegalLayout.tsx` is a wrapper, not a route)              |

Forgot/reset password are **two templates** (`ForgotPasswordPage`,
`ResetPasswordPage`) used at **four URLs** (`portal="brand"` vs `admin`).

### Redesign priority (Paper candidates)

| Tier   | Meaning                                             | Page ids                                                                                                                                                                    |
| ------ | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0** | Theme + trust / daily paths — start here            | `/`, `/for-orgs`, `/for-brands`, `/org/apply`, `/brand/apply`, `/login`, `/org/browse`, `/org/campaigns/:campaignId`, `/brand/dashboard`, `/brand/drops/:dropId`            |
| **P1** | High-traffic remainder of portals + request flow    | `/org/campaigns`, `/org/profile`, `/brand/requests/new`, `/onboarding/profile`, `/onboarding/verify-email`, `/onboarding/connect-instagram`, `/onboarding/pending-approval` |
| **P2** | Auth / legal / admin chrome — after language locked | remaining `auth` + `legal` + `admin` pages (including `/admin/requests` + `/:requestId`); `/onboarding/denied`                                                              |
| **—**  | Skip for redesign                                   | all `kind: redirect`; `/auth/instagram/callback` (transient OAuth)                                                                                                          |

### Full inventory — `kind: page`

#### Public (`SiteLayout`)

| id               | file                                | notes                                                                |
| ---------------- | ----------------------------------- | -------------------------------------------------------------------- |
| `/`              | `pages/home/HomePage.tsx`           | Hero, marquee, bring-buzz, join, featured (one route, five sections) |
| `/for-orgs`      | `pages/marketing/ForOrgsPage.tsx`   | Org role tour; `TourFrame` mock chrome (not live portal)             |
| `/for-brands`    | `pages/marketing/ForBrandsPage.tsx` | Brand role tour; `TourFrame` mock chrome                             |
| `/privacy`       | `pages/legal/PrivacyPolicyPage.tsx` | Legal                                                                |
| `/terms`         | `pages/legal/TermsPage.tsx`         | Legal                                                                |
| `/data-deletion` | `pages/legal/DataDeletionPage.tsx`  | Meta data-deletion instructions                                      |

#### Auth (`SiteLayout`)

| id                         | file                                    | notes                                            |
| -------------------------- | --------------------------------------- | ------------------------------------------------ |
| `/login`                   | `pages/auth/LoginPage.tsx`              | Org IG login                                     |
| `/reconnect-instagram`     | `pages/auth/ReconnectInstagramPage.tsx` | Public IG reconnect                              |
| `/auth/instagram/callback` | `pages/auth/InstagramCallbackPage.tsx`  | OAuth callback (skip Paper); exchanging vs error |
| `/org/apply`               | `pages/auth/OrgApplyPage.tsx`           | Public apply-first signup + IG lookup card       |
| `/brand/login`             | `pages/auth/BrandLoginPage.tsx`         | Brand password login                             |
| `/brand/forgot-password`   | `pages/auth/ForgotPasswordPage.tsx`     | Shared; `portal="brand"`                         |
| `/brand/reset-password`    | `pages/auth/ResetPasswordPage.tsx`      | Shared; `portal="brand"`                         |
| `/brand/setup`             | `pages/auth/BrandSetupPage.tsx`         | Invite/setup                                     |
| `/brand/apply`             | `pages/auth/BrandApplyPage.tsx`         | Public brand apply                               |
| `/admin/login`             | `pages/admin/AdminLoginPage.tsx`        | Public admin login (marketing chrome)            |
| `/admin/forgot-password`   | `pages/auth/ForgotPasswordPage.tsx`     | Shared; `portal="admin"`                         |
| `/admin/reset-password`    | `pages/auth/ResetPasswordPage.tsx`      | Shared; `portal="admin"`                         |

#### Onboarding (`SiteLayout`)

| id                              | file                                        | notes                                                  |
| ------------------------------- | ------------------------------------------- | ------------------------------------------------------ |
| `/onboarding/profile`           | `pages/onboarding/OrgProfilePage.tsx`       | `RequireAuth`; `pending_org_profile` (legacy IG-first) |
| `/onboarding/verify-email`      | `pages/onboarding/VerifyEmailPage.tsx`      | Several full-page modes (see same-route layouts)       |
| `/onboarding/connect-instagram` | `pages/onboarding/ConnectInstagramPage.tsx` | Bind IG after approve; `?token=` redeem                |
| `/onboarding/pending-approval`  | `pages/onboarding/PendingApprovalPage.tsx`  | `RequireAuth`; wait + `.edu` rotate                    |
| `/onboarding/denied`            | `pages/onboarding/DeniedPage.tsx`           | Terminal denied                                        |

#### Org portal (`SiteLayout` + `PortalGuard` org)

| id                           | file                                  | notes                                              |
| ---------------------------- | ------------------------------------- | -------------------------------------------------- |
| `/org/browse`                | `pages/org/OrgDropFeedPage.tsx`       | Drop feed **or** inline apply form (replaces grid) |
| `/org/profile`               | `pages/org/OrgPortalProfilePage.tsx`  | Edit profile + `.edu` rotate                       |
| `/org/campaigns`             | `pages/org/OrgMyCampaignsPage.tsx`    | My campaigns list                                  |
| `/org/campaigns/:campaignId` | `pages/org/OrgCampaignDetailPage.tsx` | Status-specific detail (see same-route layouts)    |

#### Brand portal (`SiteLayout` + `PortalGuard` brand)

| id                     | file                                          | notes                                    |
| ---------------------- | --------------------------------------------- | ---------------------------------------- |
| `/brand/dashboard`     | `pages/brand/BrandAggregateDashboardPage.tsx` | Totals, chart, compare table, requests   |
| `/brand/drops/:dropId` | `pages/brand/BrandDropDetailPage.tsx`         | Tracker + stage-specific body (not tabs) |
| `/brand/requests/new`  | `pages/brand/BrandRequestDropPage.tsx`        | New drop request                         |

#### Admin panel (`AdminLayout` + `PortalGuard` admin)

| id                           | file                                         | notes                                            |
| ---------------------------- | -------------------------------------------- | ------------------------------------------------ |
| `/admin`                     | `pages/admin/AdminOverviewPage.tsx`          | Overview queues + warnings                       |
| `/admin/orgs`                | `pages/admin/AdminOrgsPage.tsx`              | Org list; `?status=` chips                       |
| `/admin/orgs/:userId`        | `pages/admin/AdminOrgDetailPage.tsx`         | Org detail (approve / deny / erase)              |
| `/admin/brands`              | `pages/admin/AdminBrandsPage.tsx`            | Brand list + inline create form; `?status=`      |
| `/admin/brands/:brandId`     | `pages/admin/AdminBrandDetailPage.tsx`       | Brand detail                                     |
| `/admin/requests`            | `pages/admin/AdminDropRequestsPage.tsx`      | Drop-request tickets; `?status=`                 |
| `/admin/requests/:requestId` | `pages/admin/AdminDropRequestDetailPage.tsx` | Ticket \| draft editor                           |
| `/admin/drops`               | `pages/admin/AdminDropsPage.tsx`             | Drop list; published + stage + attention filters |
| `/admin/drops/:dropId`       | `pages/admin/AdminDropDetailPage.tsx`        | Tracker + **only real tab strip**                |
| `/admin/health`              | `pages/admin/AdminHealthPage.tsx`            | Pipeline / IG tokens / integrity / silent loss   |

### Legacy redirects (`kind: redirect` — not redesign targets)

| id                       | forwards to                  |
| ------------------------ | ---------------------------- |
| `/campaigns`             | `/org/browse`                |
| `/campaigns/:campaignId` | `/org/campaigns/:campaignId` |
| `/register`              | `/org/browse`                |
| `/brand`                 | `/brand/dashboard`           |
| `/brand/campaigns/new`   | `/brand/requests/new`        |

### Tabs (true tab chrome — one page)

`/admin/drops/:dropId?tab=` — shareable. Default `config` if unpublished,
`applicants` if published.

| `tab`         | Label       |
| ------------- | ----------- |
| `config`      | Config      |
| `applicants`  | Applicants  |
| `timeline`    | Timeline    |
| `attribution` | Attribution |

No other route uses a tab strip. Brand drop detail and org campaign detail
switch **composition by tracker/status**, not tabs. Admin
`TrackerControls` sit **above** the tab strip (stage-conditional fields).
`BrandDropTrackerStepper` is a read-only 3-step progress, not tabs.

### Filter chips (same page, not extra Paper files)

| Page                      | Controls                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `/org/browse`             | All drops / Upcoming / Open / Closed (local state, not URL). Closed+full is a **card chip**, not a filter. |
| `/brand/drops/:dropId`    | Applicant **type** `<select>` (local; not chips/URL)                                                       |
| `/admin/orgs?status=`     | All, awaiting approval, awaiting IG, unverified, no profile, active, denied, erased                        |
| `/admin/brands?status=`   | All, awaiting review, approved, denied                                                                     |
| `/admin/requests?status=` | All, received, converted, closed                                                                           |
| `/admin/drops`            | All / Draft / Published **plus** stage multi-select **plus** attention multi-select                        |

Admin overview queue cards deep-link these filters (e.g.
`/admin/orgs?status=pending_approval`). Inherit theme; do not snapshot each
chip as its own UI.

### Same-route layouts (extra frames on one id)

| Route                                                 | Distinct designed layouts                                                                                                                                  |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/onboarding/verify-email`                            | Token confirm; verifying; success; failure; signed-in wait (resend / change email); public wait after `/org/apply`                                         |
| `/onboarding/connect-instagram`                       | Redeeming `?token=`; bad/expired link; connect CTA                                                                                                         |
| `/auth/instagram/callback`                            | Exchanging; error (incl. apply-first) — skip Paper                                                                                                         |
| `/org/browse`                                         | Card grid; full-page inline apply (pitch)                                                                                                                  |
| `/org/campaigns/:campaignId`                          | Applied; accepted (awaiting ship vs on-the-way + tracking); **active and finished share** KPI grid + post linker (finished adds Final results + read-only) |
| `/brand/apply`                                        | Invitation-only (flag off); apply form; submitted success                                                                                                  |
| `/brand/forgot-password` and `/admin/forgot-password` | Form vs “reset link sent”                                                                                                                                  |
| `/brand/drops/:dropId`                                | Tracker always; optional creative editor; selection table; finalized roster; awaiting-products roster; live KPIs; empty “when live”                        |
| `/admin/requests/:requestId`                          | Always two columns: ticket + right panel (**draft form** or **published drop summary**). There is no ticket-only layout.                                   |

Brand `/brand/drops/:dropId` finalize uses **`window.confirm`**. Admin org
erase uses **`window.prompt`** (type IG handle). Not custom modals.

### Shared chrome / overlays (not routes; redesign with theme)

| Surface                        | where                                        | notes                                                                              |
| ------------------------------ | -------------------------------------------- | ---------------------------------------------------------------------------------- |
| `SiteHeader`                   | `components/site/SiteHeader.tsx`             | Marketing + persona nav; **mobile drawer**                                         |
| `SiteFooter`                   | `components/site/SiteFooter.tsx`             | Footer links                                                                       |
| `AdminSidebar` / `AdminLayout` | `components/admin/`, `layouts/`              | Admin shell; **mobile in-flow menu** (not overlay drawer)                          |
| Contact modal                  | `components/site/modals/ContactModal.tsx`    | Header/footer; any `SiteLayout` page (`SiteChromeProvider`)                        |
| Notify-me modal                | `components/org/modals/NotifyMeModal.tsx`    | Upcoming cards on `/org/browse`                                                    |
| Impersonation banner           | `components/site/ImpersonationBanner.tsx`    | View-as; `SiteLayout` only                                                         |
| Session restore                | `components/routing/SessionRestorePanel.tsx` | Soft `/me` failure: `RequireAuth` **and** `/login`, `/brand/login`, `/admin/login` |
| Restoring session…             | `RequireAuth`; brand/admin login pages       | Transient; skip Paper                                                              |
| 403                            | `RequireRole`                                | Org↔brand mismatch; admins redirect to `/admin`                                    |
| `TourFrame`                    | `components/tours/TourFrame.tsx`             | Mock browser chrome on `/for-orgs` / `/for-brands` only                            |
| Address autocomplete           | `ShippingAddressFields`                      | Apply / onboarding profile / org profile                                           |
| Filter multi-select menus      | `AdminPrimitives.FilterMultiSelect`          | Admin drops list                                                                   |
| Upcoming countdown overlay     | `DropFeedCard`                               | On-card, not a dialog                                                              |
| IG lookup card                 | `OrgApplyPage`                               | Inline, not a modal                                                                |

### Verification notes

- Re-audited 2026-09-01: parent re-read `AppRoot.tsx` plus page/overlay
  files after three explore agents (routes / overlays / in-page variants).
  Route tables **40 / 5 / 45** match. No Toast/Dialog library; no
  `createPortal`; no `window.alert`.
- Nav coverage: org (`ORG_NAV_LINKS`), brand (`BRAND_NAV_LINKS`), admin
  (`AdminSidebar` `NAV`), footer (`/for-orgs`, `/for-brands`, `/org/apply`,
  legal) — all hrefs have AppRoot routes.
- No bare `/org` route (helpers may treat it as role hint only).
- Admin overview queue deep-links use **query strings on list routes**, not
  new paths.
- Dual-listed: `/admin/login` (+ forgot/reset) live under **auth**
  (SiteLayout); panel under **admin**.

## Proposed workflow (if we try it)

1. Install **Paper Desktop** + Cursor plugin (`/add-plugin paper-desktop`).
2. Run Buzz locally; **Snapshot** hero + 1–2 key portal pages while logged in
   as each role (or recreate from TSX via MCP if Snapshot is awkward).
3. Lock a **Buzz design language** note agents can reuse (type weights, size
   budget, contrast, campus/brand voice — see anti-slop below).
4. Iterate theme + layouts in Paper with Cursor MCP (variants side-by-side).
5. Select winners → agent implements into `frontend/` matching current
   architecture (no greenfield stack swap).
6. PRODUCT/UX review before any broad portal ship. Visual polish that changes
   information hierarchy or flows is a hard stop.

### Batch order (use inventory ids; do not dump all 40 pages)

| Batch | Page ids (P0/P1)                                                                                                    | Why                               |
| ----- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| A     | `/`, `/for-orgs`, `/for-brands`, `/org/apply`, `/brand/apply`, `/login` + `SiteHeader`/`SiteFooter` + Contact modal | Trust + acquisition; lock theme   |
| B     | `/org/browse` (grid + apply + Notify Me), `/org/campaigns/:campaignId` (± `/org/campaigns`, `/org/profile`)         | Org PLG daily path                |
| C     | `/brand/dashboard`, `/brand/drops/:dropId` (± `/brand/requests/new`)                                                | Brand renewal / proof             |
| D     | P1 onboarding (incl. verify-email modes + connect-instagram) + P2 auth/legal/admin as needed                        | Consistency after language locked |

Snapshot / recreate per batch; one Paper file (or folder) per batch. Large
nested “whole app” files burn MCP quota and agent context.

## Design principles: look less AI / what “good” means

From the **full** [How To Design In The Agent Era](https://youtu.be/P06RgnUKX_I)
transcript (captions): opening thesis, shader craft (~5–11), Legion Health
live crit + anti-slop rules (~17–27), SciTechs / Maridata + AI-tells list
(~28–40), taste / humans (~40–43). Adopt as **Buzz Paper + Cursor
guardrails**, not PRODUCT.

Haney’s spine: agents accelerate; **taste + care** differentiate. Shipping
raw model output makes you look like “one of a million,” less intentional,
less like you care — and that kills trust (health, payments, campus brands).

### Philosophy (what good design is doing)

- **Comprehension first.** “Can you understand what’s going on?” Clear value
  prop beats decoration. If users only “get it” from a below-the-fold demo,
  the hero failed.
- **Trust is a design outcome.** Sloppy alignment / contrast / generic chrome
  reads as “they didn’t spend attention” → mind asks _what else_ they don’t
  care about. Tightening fit-and-finish makes brands feel more serious,
  elevated, trustworthy — even when content was already fine.
- **Intentional > generated.** Fit-and-finish = care. Generic cloud/vibe look
  = nobody edited.
- **Craft = alignment + contrast + gaps.** Awkward section gaps, misaligned
  stacks, and lazy contrast are early “vibe-coded” tells (Legion Health).
- **Less is more; design is deleting.** Agents are “insecure designers” —
  they fill space. Overbuild → pull back. Canvas delete that reflows is
  often faster than re-prompting.
- **Every chrome element must earn its job.** Decorative numbers, corner
  anchors, extra icons, generic top pills — delete if they don’t communicate.
- **Energy vs trust is a product choice.** Keep unique energy (global vibe,
  campus heat) but wild text gradients / sloppy layout can kill credibility.
  Pattern: agent builds a calmer foundation → human restores excitement.
- **Hero should work hard.** Put primary affordances / proof in the main
  composition, not a ignored corner (chat-widget zone).
- **Social proof when it matters.** Call out real credibility (e.g. YC) when
  trust is the product — don’t leave it implied.
- **Variants → branch → own it.** Ask for several variations focused on
  craft/alignment/contrast; pick pieces; then apply anti-slop rules so it
  stops looking like default model output. Simple prompts are enough.
- **Human taste stays in the loop.** Models get better at tactics (less
  bold); they don’t replace org decisions, audience judgment, or “should we
  be fun or trustworthy for _this_ market?”
- **Prompting vs direct edit.** Use the right tool; don’t re-prompt what a
  delete/drag fixes.
- **Intentional craft elevates; freebie effects don’t.** Thoughtful shaders /
  motifs (subtle, branded) can feel special; the same family of effects used
  as default gen chrome reads as slop.
- **Code is SOT.** Don’t maintain two design systems; Snapshot live UI →
  iterate → push back into the codebase.

### Process Haney actually uses (steal for Buzz)

1. Snapshot the live section (not a screenshot).
2. Ask for **N variations** (“focusing on craft, alignment, and contrast”).
3. First cleanup pass: **≤3 font sizes**, **pull bold/black weights way
   back** (often ≤500; supporting text not pure black).
4. Fix **contrast**: readable body; supporting chrome _less_ contrasty than
   primary (models often over-contrast step numbers / icons).
5. **Delete** non-communicating numbers/icons/pills; layout should snap.
6. Human restore Buzz voice / energy without reintroducing tells.
7. Agent implements selection into existing React/Tailwind conventions.

### AI / “vibe-coded” tells to avoid (whole video)

| Tell                                                                    | Where said     | Fix                                                             |
| ----------------------------------------------------------------------- | -------------- | --------------------------------------------------------------- |
| **Super-bold / heavy weights** (models love bold; pure black headlines) | ~24–26, ~30–33 | Regular or lighter; pull “black is so heavy” back               |
| **Too many font sizes** (5–8)                                           | ~24–26, ~30–33 | Cap at **~3**                                                   |
| **Generic top pill / eyebrow chrome**                                   | ~17 Legion     | Remove or make it specific; don’t use default agent pill        |
| **Sloppy alignment / section gaps**                                     | ~17–18         | Craft pass on spacing + alignment                               |
| **Bad contrast** (unreadable _or_ supporting bits too loud)             | ~18, ~25       | Check readability; quiet secondary UI                           |
| **Purple / vibe gradients** (Linear-era encoded into models)            | ~28, ~33–36    | Buzz palette; no purple→indigo default                          |
| **Glows**                                                               | ~28 SciTechs   | Flatten                                                         |
| **Card farms** + **2px side color swoops** on every card                | ~33–34         | Fewer cards; featured+secondary layout; many variants, pick one |
| **Icon / pill / badge spam** (badges with extra little icons)           | ~34–36         | Cut unless necessary                                            |
| **Tiny ALL-CAPS kickers** + **extra letter-spacing**                    | ~36            | Normal case; normal tracking                                    |
| **Widgets for widgets’ sake** (1/2/3 corner anchors, fake stats)        | ~25, ~34       | Delete                                                          |
| **Freebie light+dark** (esp. naive black invert)                        | ~35–36         | Don’t ship until intentional                                    |
| **Wall of copy / text gradients too wild**                              | ~38–39         | Cut copy; calmer type for trust                                 |
| **Trend-default / everyone-looks-like-Linear**                          | ~36–37, ~43    | Stay ahead of the average baseline                              |
| **Hero that doesn’t say what’s special**                                | ~29–30         | Differentiate above the fold                                    |

Haney: Paper’s agent “secret sauce” is mostly baking **basic typography +
contrast** into instructions (senior designers → model guardrails) — not
magic. Still edit by hand after.

### Ready-to-paste prompts (from demos)

**Variations (craft):**

> Make three new variations of my selection focusing on craft, alignment,
> and contrast choices to elevate the visuals.

**Anti-slop cleanup:**

> Clean up this frame using **at most three font sizes** and **no bold**.
> Everything **regular or below** in weight (avoid pure black on large type).
> Fix alignment and section spacing. Quiet supporting contrast. Remove
> purple gradients, glows, generic pills, card side-swoops, decorative
> numbers/icons. Prefer fewer cards. Keep the value prop clear above the
> fold. Less is more.

Then **human pass**: restore Buzz-specific energy without reintroducing
tells. Portals: no shader chrome by default. Marketing: shaders only if
subtle and on-brand.

### Buzz-specific application

- **Public / brand apply / login:** trust + clarity first (P0). Anti-tells
  and fit-and-finish matter most (same logic as health/payments in the
  video).
- **Org / brand portals:** dense ops UI — real metrics only; delete filler
  cards/step ornaments; hierarchy via weight restraint, not bold spam.
- **Align with existing frontend rules** (expressive type, avoid purple
  gradients / cream+serif+terracotta clichés, no emoji chrome) — this video
  is the _why_ behind those constraints.

## Cost / limits (as of pricing page)

|              | Free           | Pro                                    |
| ------------ | -------------- | -------------------------------------- |
| Price        | $0             | **$20**/editor/mo or **$16**/mo yearly |
| MCP calls    | **100 / week** | **1M / week**                          |
| Image gen    | Limited        | ~100× free                             |
| Max image    | 25 MB          | 100 MB                                 |
| Video export | —              | Yes                                    |

Editors free until Pro; viewers always free. A real theme+pages agent pass
likely needs **Pro** — free 100 MCP calls/week is a smoke test only.

## Fit vs non-fit

**Good fit**

- Visual redo of theme + main pages with agents already in Cursor
- Side-by-side layout variants before touching PRODUCT flows
- Marketing / shareable brand assets (shaders, gen) if we want more “campus
  energy” on public pages

**Poor fit**

- Replacing gap-cluster / correctness work
- Platform AI in [`ai.md`](ai.md) (matching, authenticity, ops)
- Living dual SOT (Paper file = truth forever)
- Non-technical one-off Canva-style social posts (overkill)

## Open questions (ask before promoting)

1. Is the goal a **full visual system** or a **marketing + shell polish** pass?
2. Who has taste veto (Lawrence / Melissa / both) on Paper variants?
3. Any PRODUCT surfaces we must **not** restyle yet (finalize, tracker)?
4. Budget: stay on Free for a spike, or Pro for a dedicated week?
5. Do we extract tokens from current Tailwind into Paper first, or Snapshot
   live UI and reverse into tokens?

## Suggested spike (cheap)

One evening, Free tier: Snapshot home hero → 3 Paper variants under anti-slop
rules → implement **only** the hero into `HomeHero` if clearly better. If the
loop feels slower than editing TSX directly, **park** this idea.

## Discard / park triggers

- Spike shows no quality gain over Cursor-in-repo restyles
- We start maintaining Paper as a second design system
- MCP / Desktop friction dominates session time
