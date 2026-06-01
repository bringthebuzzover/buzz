# Buzz backend (FastAPI)

Python service that will replace the demo's `localStorage` mock layer with a real API, JWT auth, and PostgreSQL. See [`../private/reports/architecture.md`](../private/reports/architecture.md) for the target design and [`../private/reports/transition-plan.md`](../private/reports/transition-plan.md) for the rollout order. Stage 1 landed the foundation; Stage 2 added the full schema, Alembic migrations, and a dev seed; Stage 3 adds JWT auth, the auth dependencies, and the org Instagram OAuth login flow.

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
# => seed complete -> users: 6  organizations: 2  brands: 2  drops: 4  drop_applications: 6  ...
```

Verify counts directly with `psql`:

```bash
psql -d buzz -c "SELECT count(*) FROM drops"
```

## Authentication (Stage 3)

JWT auth with the org **Instagram OAuth** login flow. Tokens follow architecture §5.3: a short-lived access token (`Authorization: Bearer`, 1h) and a long-lived refresh token in an httpOnly cookie (`buzz_refresh`, 7d, `SameSite=Lax`, path `/api/auth`). The long-lived Instagram token is Fernet-encrypted at rest; the short-lived IG token is never persisted.

`/api/auth/*` surface:

```
GET  /api/auth/instagram/login     302 -> Instagram OAuth (signed `state`)
POST /api/auth/instagram/callback  { code, state } -> { access_token, user } + refresh cookie
POST /api/auth/refresh             refresh cookie -> new access token (cookie rotated)
POST /api/auth/logout              clears the refresh cookie
GET  /api/auth/me                  current user (Authorization: Bearer)
POST /api/auth/dev-login           dev-only: token + refresh cookie for a seeded org (404 outside ENVIRONMENT=development)
```

Endpoint authorization composes three dependencies from `app/deps/auth.py` (§5.4): `get_current_user` (auth), `require_role` (role), `require_status` (status), plus the combined `require_active_role` and the `CurrentOrg` / `CurrentBrand` aliases.

## Drops (Stage 4)

First vertical slice — the org browse feed read (the rest of the drops surface lands in Stage 5):

```
GET  /api/drops                    org browse feed (CurrentOrg) — camelCase + epoch-ms; ?page=&per_page=
```

Each item carries server-computed `acceptedCount` and `alreadyApplied`; pagination rides `meta` (`page`/`per_page`/`total`). `POST /api/auth/dev-login` (above) lets the SPA obtain a session in local dev without Meta credentials. See [`../private/guides/stage-04-first-vertical-slice.md`](../private/guides/stage-04-first-vertical-slice.md).

New env vars are documented in [`.env.example`](./.env.example); only `SECRET_KEY`, `TOKEN_ENCRYPTION_KEY`, and the three `INSTAGRAM_*` credentials must be set for staging/prod (and for a live local OAuth run). Tests use a fake Instagram client and need none of them.

```bash
# Login redirect (302 to Instagram with a signed state)
curl -i http://localhost:8000/api/auth/instagram/login

# /me with a dev-minted token for the seeded active org user
TOK=$(poetry run python -c "from app.security import jwt; \
print(jwt.create_access_token('00000000-0000-0000-0000-000000000002','org','active'))")
curl http://localhost:8000/api/auth/me -H "Authorization: Bearer $TOK"
```

The brand password/invite path is deferred; the JWT/deps/refresh core is identity-agnostic so it slots in later. See [`../private/guides/stage-03-auth-core.md`](../private/guides/stage-03-auth-core.md).

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
    config.py      # pydantic-settings (DB, JWT, refresh cookie, Instagram, encryption)
    response.py    # APIResponse / ErrorDetail / api_response / api_error_response
    exceptions.py  # BuzzAPIException
    errors.py      # Stable error code constants (see architecture §11.3)
    deps/
      db.py        # Async engine + AsyncSession dependency
      auth.py      # get_current_user / require_role / require_status / require_active_role
    security/
      jwt.py         # Access/refresh/oauth-state encode + decode (TokenPayload)
      token_crypto.py# Fernet encrypt/decrypt for IG tokens at rest
    models/
      base.py      # SQLAlchemy DeclarativeBase
      enums.py     # StrEnums + reusable PG ENUM type instances
      *.py         # One module per aggregate (users, drops, social_posts, ...)
    routes/
      health.py    # GET /api/health
      auth.py      # /api/auth/* (Instagram OAuth, refresh, logout, me, dev-login)
      drops.py     # GET /api/drops (org browse feed)
    schemas/
      auth.py      # Auth request/response models
    services/
      instagram.py # InstagramClient protocol + HttpInstagramClient + DI
      auth.py      # handle_instagram_callback, token issuance, user response
  scripts/
    check.sh       # Local quality gate (black → ruff → mypy → pytest)
    seed_dev.py    # Destructive local dev seed
  tests/
    conftest.py    # engine / db_session / app_client / fake IG / token helpers
    test_health.py
    test_response.py
    test_models.py
    test_constraints.py
    test_migrations.py
    test_security.py
    test_auth_deps.py
    test_instagram_auth.py
    test_auth_routes.py
```
