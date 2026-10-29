# Buzz

Full-stack platform connecting brands with campus student organizations for campaign drops, applications, and Instagram engagement tracking.

**Stack:** React 18 + TypeScript + Tailwind (CRA/CRACO) frontend · FastAPI + PostgreSQL backend · JWT auth (Instagram OAuth for orgs, password login for brands) · Resend for transactional email.

Product, architecture, deploy, Meta, gaps and ideas docs live in the private `bringthebuzzover/buzz-ops` repo. This repo holds code, the HTTP contract (`openapi.json`) and how to run it.

---

## What’s in the app

| Surface        | Routes (high level)                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| Marketing      | `/` (Join Us → `/org/apply` or `/brand/apply`) |
| Legal          | `/privacy`, `/terms`, `/data-deletion`                                                                  |
| Auth           | `/login` (returning org Instagram), `/org/apply` (new org), `/auth/instagram/callback`, `/brand/login`, `/brand/forgot-password`, `/brand/reset-password`, `/brand/setup`, `/brand/apply`, `/admin/login`, `/admin/forgot-password`, `/admin/reset-password` |
| Org onboarding | `/org/apply`, `/onboarding/profile` (legacy drain), `/onboarding/verify-email`, `/onboarding/pending-approval`, `/onboarding/connect-instagram`, `/onboarding/denied` |
| Org portal     | `/org/browse`, `/org/campaigns`, `/org/campaigns/:campaignId`                                           |
| Brand portal   | `/brand/dashboard`, `/brand/drops/:dropId`, `/brand/requests/new`                                       |
| Admin          | `/admin` (overview, queues, drops, health, Invite brand, View as)                                       |

Portals are gated by real auth (`RequireAuth` → `RequireStatus` → `RequireRole`), not a demo passcode. Public join intent: student orgs via **org apply** (`/org/apply`); brands via `/brand/apply`. Returning orgs sign in with Instagram at `/login`.

Admins sign in with email + password (`/admin/login`) and can "View as" any active org or brand from `/admin`. Impersonation rides a short-lived access token — the admin's own refresh cookie is untouched — and is read-only unless `IMPERSONATION_READONLY=false`.

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

## Test

### Full local CI (mirrors GitHub Actions)

From the repo root, after Postgres is up and deps are installed:

```bash
./scripts/ci-local.sh
```

Runs the same gate as [`.github/workflows/ci.yml`](.github/workflows/ci.yml):
backend format/lint/types/openapi/alembic/pytest → frontend leftover hunter /
tsc/gen:api/build → Playwright E2E with `CI=true`. Use this before merging or after a gap-cluster
fix; backend-only `./backend/scripts/check.sh` is fine for a quick loop but
does **not** replace full CI.

GitHub required checks on `main` are only `Backend (ruff + mypy + pytest)` and `Frontend (typecheck + build)`. Playwright is not required: the job name is `Frontend E2E (Playwright)`, and the check run is `Frontend E2E (Playwright) (1)` because GitHub appends the matrix value. That suffix changes if the matrix changes. If a required job `name:` changes in `.github/workflows/ci.yml`, update the required-check list in branch protection or merges block. Full rules: [Branching & main protection](#branching--main-protection).

### E2E — Playwright (`frontend/e2e/`)

Deliberately **thin** (critical cross-stack journeys) and on `data-testid`
selectors to bound maintenance. `frontend/playwright.config.ts` starts the
backend (dev mode, `RATE_LIMIT_ENABLED=false` so the suite does not self-DoS)
+ frontend (reusing them if already up) and `frontend/e2e/global-setup.ts`
resets the DB to a deterministic fixture (`backend/scripts/seed_e2e.py` = dev
seed + one guaranteed-open drop for the apply journey). Prefer
`./scripts/ci-local.sh` when you need the full gate; use the commands below
for E2E-only iteration.

```bash
# one-time — install both sides (Playwright boots the backend for you)
(cd backend && poetry install)
(cd frontend && npm install && npx playwright install chromium)

# run (from frontend/; boots both servers + seeds automatically; needs local Postgres)
cd frontend
npm run e2e
npm run e2e:ui        # interactive
CI=true npm run e2e   # CI mode: fresh servers (same as ci-local.sh / GitHub)
```

Covers: marketing home, admin/brand login journeys, org feed + apply, role
guard (org blocked from brand dashboard with 403), reconnect public surface.
Adding a journey: prefer `getByTestId` / `getByRole`, keep the suite small, and
rely on the API harness + unit tests for breadth.

**Diagnostics:** `retries: 0` (stress is the flake detector). On failure
Playwright keeps a trace, screenshot, and video under `frontend/test-results/`
and an HTML report under `frontend/playwright-report/`. CI uploads those as
`playwright-report-<matrix.attempt>` when an E2E job fails.

**Stress (flake detector, not a merge gate):** push a commit whose message
contains `[e2e-stress-N]` (N ≤ 30), or run Actions → CI → `workflow_dispatch`
with `e2e_repeat`. That expands N isolated Playwright jobs (each with its own
Postgres). Local equivalent: `CI=true npx playwright test --repeat-each=10 --retries=0`.

**Maintenance notes:** E2E is the highest-cost layer — UI markup changes can
break selectors and the full stack must be up. Keep it to journeys that genuinely
span the whole stack; everything else belongs in the cheaper layers above.

---

## Deploy

Railway hosts the SPA, API, Postgres, and cron. Production hosts are `www.bringthebuzzover.com` and `api.bringthebuzzover.com`. There is no GitHub Pages deploy for the app.

Runbook: buzz-ops `engineering/runbooks/deploy.md`.

---

## Branching & main protection

Feature PRs target `staging`, which auto-deploys to the staging site; `staging` → `main` happens only via a promotion PR after Lawrence checks staging.

`main` is protected. These GitHub branch-protection settings are already applied, and admins are bound by them (`enforce_admins`):

- A pull request is required to merge. Required approving reviews: **0**, so the solo maintainer can merge agent pull requests.
- Required status checks (a failing check blocks merge; branches do **not** have to be up to date before merging):
  - `Backend (ruff + mypy + pytest)`
  - `Frontend (typecheck + build)`
- Playwright E2E is not a required check. The job name is `Frontend E2E (Playwright)`. GitHub appends the matrix value, so the check run is `Frontend E2E (Playwright) (1)`. That suffix changes if the matrix changes. The `#${{ matrix.attempt }}` in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) is a YAML comment and is not part of the name. Still run `./scripts/ci-local.sh` before behavior changes ([Test](#test)).
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
AGENTS.md                  # Thin agent pointer (DoD, skills)
.cursor/rules/             # Committed Cursor rules (mcp.json stays local)
.agents/skills/            # Repo agent skills
```
