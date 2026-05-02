# Buzz

Marketing site for BUZZ: connecting brands with campus communities.

Built with **React 18**, **TypeScript**, **Tailwind CSS**, **lucide-react** (icons), and **Firebase** (Firestore for the brand waitlist). Bundling uses **Create React App** with **CRACO** so PostCSS can run Tailwind.

**Routes:** `/` (home), `/register`, `/campaigns`, `/campaigns/:id`, `/brand`, `/brand/campaigns/new`, and `/waitlist` (legacy brand waitlist form, full-page). A reference single-file prototype lives at [`new.ts`](new.ts) in the repo root; the app is split into modules under `src/` and does not import that file.

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

2. **Firebase (waitlist)** — Create a `.env` file in the project root (same folder as `package.json`). Create React App only exposes variables whose names start with `REACT_APP_`:

   ```bash
   REACT_APP_FIREBASE_API_KEY=your_api_key
   REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   REACT_APP_FIREBASE_PROJECT_ID=your_project_id
   ```

   Restart the dev server after changing `.env`. Other Firebase fields are committed in `src/firebase.ts`; adjust there if your project differs.

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

- `src/AppRoot.tsx` — React Router routes
- `src/layouts/SiteLayout.tsx` — Shared chrome (header, footer, contact modal via `SiteChromeProvider`)
- `src/pages/` — Route screens (`home`, `register`, `campaigns`, `brand`, `waitlist`)
- `src/components/site/` — Header, footer, marquee, modals
- `src/data/` — Static lists (colleges, campaigns, featured collabs, mock applicants) and [`siteIdentity.ts`](src/data/siteIdentity.ts) (logo, social URLs, handles, contact email / name, hero spotlight line)
- `src/types/` — Shared TypeScript types
- `src/firebase.ts` — Firestore client
- `public/` — Static assets (e.g. `index.html`, `hero.mp4`, favicon)
- `craco.config.js` — CRA overrides (PostCSS + Tailwind)
- `tailwind.config.js` — Tailwind theme (includes BUZZ palette `buzz.coral`, `buzz.cream`, `buzz.butter`, marquee animations)
