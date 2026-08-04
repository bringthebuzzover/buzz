# Buzz

Full-stack platform connecting brands with campus student organizations for campaign drops, applications, and Instagram engagement tracking.

**Stack:** React 18 + TypeScript + Tailwind (CRA/CRACO) frontend · FastAPI + PostgreSQL backend · JWT auth (Instagram OAuth for orgs, password login for brands) · Resend for transactional email.

Product behavior and UX rules live in [`PRODUCT.md`](PRODUCT.md) (including **§3.1.1** data ownership / single source of truth). Living product holes and bugs: [`gaps/`](gaps/). Launch ops: [`DEPLOYMENT.md`](DEPLOYMENT.md). Meta/Instagram app setup: [`META.md`](META.md). Backend details: [`backend/README.md`](backend/README.md).

---

## What’s in the app

| Surface        | Routes (high level)                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| Marketing      | `/` (Join Us → `/login` or `/brand/apply`)                                                              |
| Legal          | `/privacy`, `/terms`, `/data-deletion`                                                                  |
| Auth           | `/login` (org Instagram), `/auth/instagram/callback`, `/brand/login`, `/brand/forgot-password`, `/brand/reset-password`, `/brand/setup`, `/brand/apply`, `/admin/login`, `/admin/forgot-password`, `/admin/reset-password` |
| Org onboarding | `/onboarding/profile`, `/onboarding/verify-email`, `/onboarding/pending-approval`, `/onboarding/denied` |
| Org portal     | `/org/browse`, `/org/campaigns`, `/org/campaigns/:campaignId`                                           |
| Brand portal   | `/brand/dashboard`, `/brand/drops/:dropId`, `/brand/requests/new`                                       |
| Admin          | `/admin` (overview, queues, drops, health, Invite brand, View as)                                       |

Portals are gated by real auth (`RequireAuth` → `RequireStatus` → `RequireRole`), not a demo passcode. Public join intent goes through real account paths: student orgs via Instagram (`/login`), brands via `/brand/apply`.

Admins sign in with email + password (`/admin/login`) and can "View as" any active org or brand from `/admin`. Impersonation rides a short-lived access token — the admin's own refresh cookie is untouched — and is read-only unless `IMPERSONATION_READONLY=false`. See [`TESTING.md`](TESTING.md) for the permanent test accounts.

---

## Prerequisites

- **Node.js** 18+ and **npm**
- For the API: **Python** 3.12+, **Poetry**, **PostgreSQL** 14+

---

## Local setup

The repo is a monorepo: SPA under [`frontend/`](frontend/), FastAPI service under [`backend/`](backend/), shared [`openapi.json`](openapi.json) at the root.

### Frontend

```bash
git clone <repository-url>
cd buzz/frontend
npm install
cp .env.example .env
```

Set `REACT_APP_API_URL` (default `http://localhost:8000`). Ignore leftover `REACT_APP_FIREBASE_*` entries — they are unused.

```bash
npm start
```

App: [http://localhost:3000](http://localhost:3000).

### Backend

From the repo root (or `cd ../backend` if you're still in `frontend/`):

```bash
cd backend
poetry install
cp .env.example .env
# start Postgres, createdb buzz, then:
poetry run alembic upgrade head
poetry run uvicorn app.main:app --reload --port 8000
```

Smoke check:

```bash
curl http://localhost:8000/api/health
# => {"data":{"status":"ok","version":"0.1.0"},"meta":null,"error":null}
```

Full backend setup, jobs, and tests: [`backend/README.md`](backend/README.md).

---

## Scripts

Run inside [`frontend/`](frontend/):

| Command           | Description                                                              |
| ----------------- | ------------------------------------------------------------------------ |
| `npm start`       | Frontend dev server                                                      |
| `npm run build`      | Production SPA bundle → `frontend/build/` (CI; no API URL required)           |
| `npm run build:prod` | Guard `REACT_APP_API_URL` then build (Railway / real deploys)                 |
| `npm run start:prod` | Serve `build/` with History API fallback (`serve -s`, binds `$PORT`)          |
| `npm test`        | Frontend Jest/CRACO smoke tests                                          |
| `npm run e2e`     | Playwright end-to-end tests                                              |
| `npm run gen:api` | Regenerate `src/api/generated/schema.ts` from the root `../openapi.json` |

Backend (inside `backend/`): `poetry run pytest`, `poetry run alembic upgrade head`, `poetry run python scripts/run_job.py <job>` (see backend README).

---

## Deploy

Production target is **Railway** (SPA + FastAPI + Postgres + cron jobs). See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the launch checklist, env parity, and Meta/Resend prerequisites.

A legacy `npm run deploy` (GitHub Pages) still exists in `package.json` but is **not** the launch path.

---

## Project layout (high level)

```
frontend/                  # CRA/CRACO SPA (own package.json)
  src/
    AppRoot.tsx            # Routes + auth guards
    api/                   # API client, hooks, generated OpenAPI types
    contexts/              # AuthContext, SiteChromeContext
    pages/                 # home, auth, onboarding, org, brand, legal
    components/            # site chrome, org/brand UI, routing guards
    data/siteIdentity.ts   # Brand, contact, social (single source)
    types/                 # Domain types
  e2e/                     # Playwright specs + global-setup
  public/                  # index.html, CNAME, static assets
backend/                   # FastAPI app, Alembic migrations, jobs, tests
openapi.json               # API contract (regen TS types via cd frontend && npm run gen:api)
DEPLOYMENT.md              # Launch & Railway runbook
META.md                    # Meta / Instagram API setup
PRODUCT.md                 # Product spec
```
