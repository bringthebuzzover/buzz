# Buzz

Marketing site for BUZZ: connecting brands with campus communities.

Built with **React 18**, **TypeScript**, **Tailwind CSS**, **lucide-react** (icons), and **Firebase** (Firestore for the brand waitlist). Bundling uses **Create React App** with **CRACO** so PostCSS can run Tailwind.

**Routes:** `/` (home, public landing), `/waitlist` (brand waitlist form, full-page), and the demo-gated portals:

- **Org portal** (`requiredDemoView="org"`): `/org/drops` (Drop Feed), `/org/campaigns` (My Campaigns), `/org/campaigns/:campaignId` (per-status detail).
- **Brand portal** (`requiredDemoView="brand"`): `/brand/dashboard` (aggregate dashboard), `/brand/drops/:dropId` (per-drop tracker + KPIs), `/brand/requests/new` (Request a Drop).
- **Legacy redirects** for old bookmarks: `/register` → `/org/drops`, `/campaigns[/:id]` → `/org/drops`, `/brand` → `/brand/dashboard`, `/brand/campaigns/new` → `/brand/requests/new`.

The full product spec lives in [`PRODUCT.md`](PRODUCT.md) — that is the source of truth for behavior and UX rules. A reference single-file prototype lives at [`new.ts`](new.ts) in the repo root; the app is split into modules under `src/` and does not import that file.

## Prerequisites

- **Node.js** 18 or newer (LTS recommended)
- **npm** (comes with Node)

## Setup

1. Clone the repository and install dependencies:

   ```bash
   git clone <repository-url>
   cd buzz
   npm install
   ```

2. **Firebase (waitlist)** — Copy `.env.example` to `.env` and fill in values from Firebase Console → Project settings → Web app. **Do not commit `.env`** (it is gitignored and may contain your API key). Create React App only exposes variables whose names start with `REACT_APP_`:

   ```bash
   cp .env.example .env
   # then edit .env
   ```

   Restart the dev server after changing `.env`. Other Firebase fields are committed in `src/firebase.ts`; adjust there if your project differs. Publish `firestore.rules` in the console (Firestore → Rules) so waitlist writes are allowed.

3. **Optional** — Place the hero video at `public/hero.mp4` (the home hero loads it via `PUBLIC_URL`).

## Run locally

```bash
npm start
```

Opens the app at [http://localhost:3000](http://localhost:3000) with hot reload.

## Build

```bash
npm run build
```

Outputs an optimized production bundle in the `build/` folder.

## Deploy (GitHub Pages)

This repo deploys with **gh-pages**. `homepage` in `package.json` is set to `https://www.bringthebuzzover.com` so asset URLs match the live site. For GitHub Pages **Settings → Pages**, point the site at the **`gh-pages`** branch and set your custom domain there. To ship a `CNAME` with every build, add `public/CNAME` (Create React App copies `public/` into `build/`).

1. Ensure you are on the branch you want to publish (often `main`).

2. Deploy (this runs `npm run build` first because of the `predeploy` script):

   ```bash
   npm run deploy
   ```

   That runs `gh-pages -d build` and pushes the contents of `build/` to the `gh-pages` branch.

3. In the GitHub repository **Settings → Pages**, set the source to the **`gh-pages`** branch (usually `/ (root)`).

If you use a **project URL** (for example `https://<user>.github.io/buzz/`) instead of a custom domain, set `homepage` in `package.json` to that URL so asset paths resolve correctly, then run `npm run deploy` again.

## Scripts summary

| Command          | Description                                |
| ---------------- | ------------------------------------------ |
| `npm start`      | Dev server (CRACO + React)                 |
| `npm run build`  | Production build into `build/`             |
| `npm run deploy` | Build, then publish `build/` to `gh-pages` |

There is no `npm test` script configured; add one with `craco test` if you introduce tests.

## Project layout (high level)

- `src/AppRoot.tsx` — React Router routes (public + persona-gated org/brand portals)
- `src/layouts/SiteLayout.tsx` — Shared chrome (header, footer, contact modal via `SiteChromeProvider`)
- `src/pages/home/` — Public landing
- `src/pages/org/` — Org portal pages (`OrgDropFeedPage`, `OrgMyCampaignsPage`, `OrgCampaignDetailPage`)
- `src/pages/brand/` — Brand portal pages (`BrandAggregateDashboardPage`, `BrandDropDetailPage`, `BrandRequestDropPage`)
- `src/pages/waitlist/` — Standalone brand waitlist
- `src/components/org/`, `src/components/brand/` — Persona-specific components (cards, stepper, tables, charts)
- `src/components/site/` — Header, footer, marquee, modals (passcode, contact, change-view)
- `src/components/routing/DemoOnly.tsx` — Persona-aware route guard (`requiredDemoView`)
- `src/contexts/AccessGateContext.tsx` — Demo session + persona state
- `src/contexts/MockDataContext.tsx` — `useSyncExternalStore` hooks over the localStorage mock layer
- `src/contexts/DemoClockContext.tsx` — 1s tick + scheduled tracker transitions + periodic metrics jitter
- `src/data/store/` — Entity stores backed by `localStorage` (namespace `buzz.v1.*`)
- `src/data/seed/` — Seed data covering every drop / application status
- `src/utils/` — Pure helpers (`dropStatus`, `orgCampaignStatus`, `postAttribution`, `notifyMe`, `metrics`, `useCountdown`)
- `src/types/` — Domain types (`drop`, `orgCampaign`, `brandPortal`, `socialPost`, `metrics`, `access`, `campaign`)
- `src/firebase.ts` — Firestore client; `brand_waitlist` (brands) and `org_waitlist` (student orgs from home)
- `public/` — Static assets (e.g. `index.html`, `hero.mp4`, favicon)
- `craco.config.js` — CRA overrides (PostCSS + Tailwind)
- `tailwind.config.js` — Tailwind theme (includes BUZZ palette `buzz.coral`, `buzz.cream`, `buzz.butter`, marquee animations)
