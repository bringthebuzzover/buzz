# Buzz backend (FastAPI)

Python service for Buzz: JWT auth, PostgreSQL, and the `/api` surface. Agent guide: [`../AGENTS.md`](../AGENTS.md).

## Prerequisites

- **Python** 3.12 or newer
- **Poetry** 1.8+ for dependency management
- **PostgreSQL** 14+ (local dev uses Homebrew `postgresql@14`; CI runs Postgres 16 — any 14–16 works)

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

Local auth smoke (dev-minted token; no Meta credentials):

```bash
# Login redirect (302 to Instagram with a signed state)
curl -i http://localhost:8000/api/auth/instagram/login

# /me with a dev-minted token for the seeded active org user
TOK=$(poetry run python -c "from app.security import jwt; \
print(jwt.create_access_token('00000000-0000-0000-0000-000000000002','org','active'))")
curl http://localhost:8000/api/auth/me -H "Authorization: Bearer $TOK"
```

Auto-generated OpenAPI docs (development only): <http://localhost:8000/api/docs>.

## Lint, type-check, tests

Individual commands:

```bash
poetry run black app/ tests/      # format in place
poetry run ruff check app/ tests/
poetry run mypy app/
poetry run pytest
```

### One-shot quality gate

Run the full gate from the repo root (backend, frontend, then Playwright):

```bash
./scripts/ci-local.sh
```

CI runs `black --check`, then `ruff check`, then `mypy`, then `pytest`
([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)).

## Background jobs (Stage 8)

Scheduled work runs as one-shot scripts a scheduler such as Railway Cron invokes — no
extra runtime/worker. Each job is idempotent and prints a JSON summary.

```bash
poetry run python scripts/run_job.py notify_reminders # §10.6 — every ~5 min
poetry run python scripts/run_job.py metric_sync      # §10.1 — every 8h (Instagram)
poetry run python scripts/run_job.py autolink_scan    # §10.4 — daily, after metric_sync
poetry run python scripts/run_job.py token_refresh    # §10.5.2 — daily safety net (Instagram)
poetry run python scripts/run_job.py token_cleanup    # §10.3 — daily
```

Suggested cron (UTC): `metric_sync` 03:00 / 11:00 / 19:00 → `autolink_scan` 03:30 →
`token_refresh` 04:00; `token_cleanup` 03:00; `notify_reminders` every 5 min. The
primary Instagram token refresh is **on-login** (`get_current_user`, §10.5.1);
`token_refresh` only catches inactive orgs and is optional for a tight MVP.

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
      orgs.py      # GET/PATCH /api/orgs/me + /me/posts (+ refresh)
      drops.py     # /api/drops feed + detail + apply + notify
      campaigns.py # /api/campaigns + detail + aggregate + link-post + suggestions
      brands.py    # /api/brands profile + drops + finalize + aggregate + engagement-series
    schemas/
      common.py    # CamelModel + to_epoch_ms (camelCase + epoch-ms convention)
      auth.py      # Auth request/response models
      orgs.py      # Org profile read/update models
      drops.py     # Feed/detail/apply/notify models + BrandDropRequest Create/Response
      campaigns.py # My-campaigns list/detail models
      posts.py     # Post library / aggregate / suggestion / link-post models
      brands.py    # Brand profile, drop list/detail, finalize, aggregate, engagement-series
    services/
      instagram.py       # InstagramClient protocol + HttpInstagramClient (OAuth + §10 media/refresh)
      instagram_token.py # §10.5.1 on-login long-lived token refresh (BackgroundTasks + advisory lock)
      auth.py      # handle_instagram_callback, token issuance, user response
      orgs.py      # Org profile orchestration
      drops.py     # Feed + drop detail + apply + notify
      campaigns.py # My-campaigns list/detail + resolve_owned_application gate
      posts.py     # Post library + link/unlink + aggregate + suggestions
      brands.py    # Brand aggregate, engagement series, finalize (7 rules + atomic txn)
    jobs/          # Stage 8 background jobs (architecture §10), run by scripts/run_job.py
      token_cleanup.py  # §10.3
      autolink_scan.py  # §10.4
      token_refresh.py  # §10.5.2 safety-net cron
      metric_sync.py    # §10.1 Instagram metric sync
  scripts/
    run_job.py      # Background-job runner: run_job.py <name> (Railway Cron)
    dump_openapi.py # Write ../openapi.json at the repo root (source for `cd ../frontend && npm run gen:api`)
    seed_dev.py     # Destructive local dev seed
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
    test_orgs_routes.py
    test_apply.py
    test_notify.py
    test_campaigns.py
    test_drop_detail.py
    test_org_posts.py
    test_post_links.py
    test_campaign_aggregate.py
    test_suggestions.py
    test_brand_routes.py   # Brand profile + drops + finalize + aggregate + engagement-series
```
