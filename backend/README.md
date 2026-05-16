# Buzz backend (FastAPI)

Python service that will replace the demo's `localStorage` mock layer with a real API, JWT auth, and PostgreSQL. See [`../private/reports/architecture.md`](../private/reports/architecture.md) for the target design and [`../private/reports/transition-plan.md`](../private/reports/transition-plan.md) for the rollout order. Stage 1 lands the foundation: app shell, async DB plumbing, the response envelope contract, and CI.

## Prerequisites

- **Python** 3.12 or newer
- **Poetry** 1.8+ for dependency management
- **PostgreSQL** 14+ (the project assumes Homebrew `postgresql@14`)

## Setup

From the repo root:

```bash
cd backend
poetry install
cp .env.example .env
```

Edit `.env` if your local Postgres URL differs from the default `postgresql+asyncpg://localhost/buzz`.

## Bootstrap PostgreSQL (one-time, local dev)

```bash
brew services start postgresql@14
createdb buzz
```

Verify the database is reachable:

```bash
psql -d buzz -c "\\l"
```

## Run the dev server

Always run `uvicorn` from inside `backend/` so relative imports resolve:

```bash
cd backend
poetry run uvicorn app.main:app --reload --port 8000
```

Smoke-test the envelope:

```bash
curl http://localhost:8000/api/health
# => {"data":{"status":"ok","version":"0.1.0"},"meta":null,"error":null}
```

Auto-generated OpenAPI docs: <http://localhost:8000/api/docs>.

## Lint, type-check, tests

Individual commands:

```bash
poetry run black app/ tests/      # format in place
poetry run ruff check app/ tests/
poetry run mypy app/
poetry run pytest
```

### One-shot quality gate

Run all three stages — **Black → Ruff → pytest** — fail-fast:

```bash
./scripts/check.sh           # format in place, lint, test
./scripts/check.sh --check   # don't rewrite; verify only (CI mode)
```

CI runs `black --check`, then `ruff check`, then `mypy`, then `pytest`
([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)).

## Layout

```
backend/
  app/
    main.py        # FastAPI app, CORS, lifespan, exception handlers, /api/* routers
    config.py      # pydantic-settings (DATABASE_URL, SECRET_KEY, ENVIRONMENT)
    response.py    # APIResponse / ErrorDetail / api_response / api_error_response
    exceptions.py  # BuzzAPIException
    errors.py      # Stable error code constants (see architecture §11.3)
    deps/
      db.py        # Async engine + AsyncSession dependency
    models/
      base.py      # SQLAlchemy DeclarativeBase
    routes/
      health.py    # GET /api/health
    schemas/       # (Stage 2+) Pydantic request/response shapes
    services/      # (Stage 2+) Business logic and integrations
  tests/
    test_health.py
    test_response.py
```
