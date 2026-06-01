# Buzz backend (FastAPI)

Python service that will replace the demo's `localStorage` mock layer with a real API, JWT auth, and PostgreSQL. See [`../private/reports/architecture.md`](../private/reports/architecture.md) for the target design and [`../private/reports/transition-plan.md`](../private/reports/transition-plan.md) for the rollout order. Stage 1 landed the foundation; Stage 2 adds the full schema, Alembic migrations, and a dev seed.

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

## Database migrations (Alembic)

The schema lives in [`app/models/`](./app/models/) and is versioned with Alembic. Always run Alembic from `backend/` so `app.config` and `app.models` resolve:

```bash
cd backend
poetry run alembic upgrade head        # apply all pending migrations
poetry run alembic downgrade base      # tear the schema all the way down
poetry run alembic current             # show the applied revision
```

### Workflow when changing a model

1. Edit the relevant class under `app/models/`.
2. `poetry run alembic revision --autogenerate -m "<short slug>"` — generates a new file in `migrations/versions/`.
3. **Read the generated file.** Autogenerate is a starting point, not the ground truth — confirm enum diffs, FK `ondelete`, and that `downgrade()` symmetrically reverses `upgrade()` (including any `DROP TYPE` for new PG ENUMs).
4. `poetry run alembic upgrade head` to apply locally, then round-trip with `downgrade base` + `upgrade head` to prove symmetry.

### Adding a new PG enum value

PG `ENUM` values can be appended with `ALTER TYPE`, but values cannot be renamed or removed in place. Write the migration by hand:

```python
op.execute("ALTER TYPE portal_role ADD VALUE IF NOT EXISTS 'new_role'")
```

`downgrade()` for an enum-value addition is typically a no-op since dropping a value requires recreating the type. Document the irreversibility in the migration's docstring.

## Dev seed data

`scripts/seed_dev.py` resets the local database to a known fixture set so the Stage 4 vertical slice has data to query. It is **destructive** — every domain table is `TRUNCATE`d before inserts. A localhost guard aborts the script if `DATABASE_URL` points anywhere other than `localhost`/`127.0.0.1`.

```bash
cd backend
poetry run python scripts/seed_dev.py
# => seed complete -> users: 5  organizations: 2  brands: 2  drops: 4  drop_applications: 6  ...
```

Verify counts directly with `psql`:

```bash
psql -d buzz -c "SELECT count(*) FROM drops"
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
  alembic.ini      # Alembic CLI config; URL injected from app.config
  migrations/
    env.py         # Async runner using Base.metadata + settings.DATABASE_URL
    versions/      # Generated migration scripts (timestamped)
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
      enums.py     # StrEnums + reusable PG ENUM type instances
      *.py         # One module per aggregate (users, drops, social_posts, ...)
    routes/
      health.py    # GET /api/health
    schemas/       # (Stage 4+) Pydantic request/response shapes
    services/      # (Stage 4+) Business logic and integrations
  scripts/
    check.sh       # Local quality gate (black → ruff → mypy → pytest)
    seed_dev.py    # Destructive local dev seed
  tests/
    conftest.py    # engine / db_session / schema fixtures
    test_health.py
    test_response.py
    test_models.py
    test_constraints.py
    test_migrations.py
```
