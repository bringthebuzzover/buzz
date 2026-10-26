# Buzz

Full-stack platform connecting brands with campus student organizations for campaign drops, applications, and Instagram engagement tracking.

**Stack:** React 18 + TypeScript + Tailwind (CRA/CRACO) frontend · FastAPI + PostgreSQL backend · JWT auth (Instagram OAuth for orgs, password login for brands) · Resend for transactional email.

Product behavior and UX rules live in [`PRODUCT.md`](PRODUCT.md) (including **§3.1.1** data ownership / single source of truth). Seeded-launch implementation sequence: [`LAUNCH.md`](LAUNCH.md). As-built system: [`ARCHITECTURE.md`](ARCHITECTURE.md). Agent operating guide: [`AGENTS.md`](AGENTS.md). Living product holes and bugs: [`gaps/`](gaps/). Future bets / brainstorm (not committed behavior): [`ideas/`](ideas/). Launch ops: [`DEPLOYMENT.md`](DEPLOYMENT.md). Meta/Instagram app setup: [`META.md`](META.md). Backend details: [`backend/README.md`](backend/README.md).

---

## What’s in the app

| Surface        | Routes (high level)                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| Marketing      | `/` (Join Us → `/org/apply` or `/brand/apply` — see [`LAUNCH.md`](LAUNCH.md); as-built Join still `/login` until Phase A) |
| Legal          | `/privacy`, `/terms`, `/data-deletion`                                                                  |
| Auth           | `/login` (returning org Instagram), `/org/apply` (new org — Phase A), `/auth/instagram/callback`, `/brand/login`, `/brand/forgot-password`, `/brand/reset-password`, `/brand/setup`, `/brand/apply`, `/admin/login`, `/admin/forgot-password`, `/admin/reset-password` |
| Org onboarding | `/org/apply` (Phase A), `/onboarding/profile` (legacy drain), `/onboarding/verify-email`, `/onboarding/pending-approval`, `/onboarding/connect-instagram` (Phase A), `/onboarding/denied` |
| Org portal     | `/org/browse`, `/org/campaigns`, `/org/campaigns/:campaignId`                                           |
| Brand portal   | `/brand/dashboard`, `/brand/drops/:dropId`, `/brand/requests/new`                                       |
| Admin          | `/admin` (overview, queues, drops, health, Invite brand, View as)                                       |

Portals are gated by real auth (`RequireAuth` → `RequireStatus` → `RequireRole`), not a demo passcode. Public join intent: student orgs via **org apply** (`/org/apply`, [`LAUNCH.md`](LAUNCH.md) Phase A); brands via `/brand/apply`. As-built until Phase A: orgs still go through Instagram (`/login`).

Admins sign in with email + password (`/admin/login`) and can "View as" any active org or brand from `/admin`. Impersonation rides a short-lived access token — the admin's own refresh cookie is untouched — and is read-only unless `IMPERSONATION_READONLY=false`. See [`TESTING.md`](TESTING.md) for the permanent test accounts.

---

## Prerequisites

- **Node.js** 18+ and **npm** (Railway frontend uses root [`package.json`](package.json) `engines.node` 22)
- For the API: **Python** 3.12+, **Poetry**, **PostgreSQL** 14+

---

## Local setup

The repo is a monorepo: SPA under [`frontend/`](frontend/), FastAPI service under [`backend/`](backend/), shared [`openapi.json`](openapi.json) at the root.

### Frontend

```bash
git clone https://github.com/bringthebuzzover/buzz.git
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

Production SPA/API are on **Railway** with brand hosts `www` / `api.bringthebuzzover.com` (see [`DEPLOYMENT.md`](DEPLOYMENT.md)). Do not run GitHub Pages deploys for the app.

---

## Branching & main protection

Decided 2026-10-26: there is no long-lived `dev` or `staging` branch and no staging environment. Short-lived feature branches open a pull request straight into `main`. Railway autodeploys from `main` only ([`DEPLOYMENT.md`](DEPLOYMENT.md)). `ENVIRONMENT=staging` is still a legal API setting (same hardened path as `production`); it is not a second deployed stack.

`main` is protected. These GitHub branch-protection settings are already applied, and admins are bound by them (`enforce_admins`):

- A pull request is required to merge. Required approving reviews: **0**, so the solo maintainer can merge agent pull requests.
- Required status checks (a failing check blocks merge; branches do **not** have to be up to date before merging):
  - `Backend (ruff + mypy + pytest)`
  - `Frontend (typecheck + build)`
- Playwright E2E is not a required check. That job’s check name includes the shard (`Frontend E2E (Playwright) #N` in [`.github/workflows/ci.yml`](.github/workflows/ci.yml)) and changes with the matrix. Still run `./scripts/ci-local.sh` before behavior changes ([`TESTING.md`](TESTING.md)).
- Force pushes to `main` are blocked, and `main` cannot be deleted.
- Every pull request conversation must be resolved before merge, including Bugbot threads.
- In an emergency, an admin can temporarily turn off **enforce admins** under the repo **Settings → Branches**, then turn it back on.

If a job `name:` in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) is renamed, update the required-check list on `main` in the same change. GitHub matches those strings exactly; a stale name blocks every merge.

High-risk pull requests get a Bugbot pass: comment `bugbot run` on the PR.

Do not push to `main` directly. Open a pull request from a feature branch.

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
    data/siteIdentity.ts   # Brand, social, contact person (emails → backend/brand_emails.json)
    types/                 # Domain types
  e2e/                     # Playwright specs + global-setup
  public/                  # index.html, static assets
backend/                   # FastAPI app, Alembic migrations, jobs, tests
openapi.json               # API contract (regen TS types via cd frontend && npm run gen:api)
scripts/ci-local.sh        # Full local CI gate (mirrors .github/workflows/ci.yml)
AGENTS.md                  # Agent OS (norms, DoD, skills, MCP)
ARCHITECTURE.md            # As-built system map
DEPLOYMENT.md              # Launch & Railway runbook
META.md                    # Meta / Instagram API setup
PRODUCT.md                 # Product behavior / UX SOT
TESTING.md                 # Test layers + ./scripts/ci-local.sh
.cursor/rules/             # Committed Cursor rules (mcp.json stays local)
.agents/skills/            # Repo agent skills
```
