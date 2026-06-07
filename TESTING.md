# Testing & bug-bashing

Four layers, cheapest → most expensive to maintain:

| Layer | Where | Runs against | Maintenance |
| --- | --- | --- | --- |
| Backend unit/integration | `backend/tests/` (`pytest`) | rolled-back DB session | low |
| Frontend smoke | `src/*.smoke.test.tsx` (`craco test`) | jsdom render | low |
| **API bug-bash (journey + fuzz)** | `backend/scripts/bugbash.py` | a **live** local server | low |
| **E2E (Playwright)** | `e2e/` | live backend **+** frontend in a real browser | medium |

The bottom two are the bug-bash tools. Both need a **local Postgres** and
`ENVIRONMENT=development` (so the dev-login shortcut works without Meta/Instagram).

## Seed personas (from `backend/scripts/seed_dev.py`)

| Persona | Login | State |
| --- | --- | --- |
| Org (active) | auto dev-login on app load | full portal |
| Org (pending approval / profile / onboarding) | `POST /api/auth/dev-login {instagram_user_id}` | onboarding gates |
| Brand | `/brand/login` → `partnerships@acme.coffee` / `buzzdev123` (also `brand@northwind.example`) | brand portal |
| Admin | API token (dev-login by `user_id`); no admin UI | approve/deny, tracker, reopen |

## API bug-bash harness — `backend/scripts/bugbash.py`

Drives a running API over HTTP the way a client would, and pokes the DB directly
only where the API can't reach (verification tokens, time-gated drop windows,
precise fixtures). It asserts **invariants** (no 5xx, well-formed error
envelopes, ownership 404s, status codes) rather than exact values, so it stays
low-maintenance across copy/amount changes.

```bash
cd backend
poetry run alembic upgrade head
poetry run python scripts/seed_dev.py                  # known starting state
# Disable rate limiting so repeated/slow runs don't hit the dev-login throttle
# (the one rate-limit scenario auto-skips when it's off):
RATE_LIMIT_ENABLED=false poetry run uvicorn app.main:app --port 8000   # another shell
poetry run python scripts/bugbash.py                   # journey only
poetry run python scripts/bugbash.py --fuzz 300        # journey + 300 fuzz iters
```

Exits non-zero if any check fails. The journey covers: health, the authz matrix
(401/403), the org happy path (feed + notify state + apply + double-apply guard),
full org onboarding (profile → email verify → admin approve), brand finalize
(accept/deny + denial email + re-finalize guard), admin tracker advance + reopen,
and rate limiting. Fuzz mode hammers 16 endpoints with randomized valid/invalid
inputs and asserts the server never 5xxes and every 4xx carries an `error.code`.

Re-seed for a clean slate; the harness creates uniquely-suffixed fixtures so
repeat runs don't collide.

## E2E — Playwright (`e2e/`)

Deliberately **thin** (6 critical cross-stack journeys) and on `data-testid`
selectors to bound maintenance. `playwright.config.ts` starts the backend (dev
mode) + frontend (reusing them if already up) and `e2e/global-setup.ts` resets
the DB to a deterministic fixture (`scripts/seed_e2e.py` = dev seed + one
guaranteed-open drop for the apply journey).

```bash
# one-time
npm install
npx playwright install chromium

# run (boots both servers + seeds automatically; needs local Postgres + poetry)
npm run e2e
npm run e2e:ui        # interactive
```

Covers: marketing home renders, brand login (good + bad creds) → dashboard, org
feed renders, org apply flow, and the role guard (org blocked from the brand
dashboard with a 403). Adding a journey: prefer `getByTestId` / `getByRole`,
keep the suite small, and rely on the API harness + unit tests for breadth.

**Maintenance notes:** E2E is the highest-cost layer — UI markup changes can
break selectors and the full stack must be up. Keep it to journeys that genuinely
span the whole stack; everything else belongs in the cheaper layers above.
