# Deployment & environment parity (Stage 9)

Buzz deploys on **Railway** as three services in one project (architecture §1.3):

| Service | What | Notes |
| --- | --- | --- |
| **Frontend** | React SPA, static build (`npm run build`) | Set `REACT_APP_USE_API=true` and `REACT_APP_API_URL` at build time |
| **Backend** | FastAPI + Uvicorn (`uvicorn app.main:app --host 0.0.0.0 --port $PORT`) | **Run a single replica** (see "Rate limiting" below) |
| **PostgreSQL** | Railway-managed | `DATABASE_URL` injected |
| **Cron** | Railway Cron running `scripts/run_job.py <name>` | Schedule in `backend/README.md` (Stage 8) |

Run `alembic upgrade head` as a release/deploy step before the backend starts.

## Same-origin vs cross-origin (auth cookies)

The refresh + OAuth cookies are `SameSite=lax`, so the SPA and API must be
**same-site**. Two supported topologies (see `backend/.env.example`):

1. **Same-origin (preferred):** serve the API under the SPA's domain at `/api`
   via a reverse proxy. Cookies "just work".
2. **Cross-site:** API on a different registrable domain → set
   `REFRESH_COOKIE_SAMESITE=none` + `REFRESH_COOKIE_SECURE=true` (HTTPS) and keep
   the exact-origin CORS allowlist with credentials.

## Rate limiting (single-replica invariant)

Rate limiting is **in-memory and per-process** (`app/security/rate_limit.py`).
With more than one backend replica, counters split and the limits weaken
proportionally. For the MVP, **keep the backend at one replica**; to scale out,
move the limiter to Redis. Toggle with `RATE_LIMIT_ENABLED` (default true).

## Environment parity checklist (staging / production)

The backend **fails fast at startup** (`app/config.py`) if any of these are
wrong when `ENVIRONMENT != development`, so a misconfigured deploy crashes
instead of silently shipping an insecure session layer:

| Var | Requirement off-dev |
| --- | --- |
| `ENVIRONMENT` | `staging` or `production` |
| `SECRET_KEY` | real value (not the committed dev default) |
| `TOKEN_ENCRYPTION_KEY` | real Fernet key (not the dev default) |
| `REFRESH_COOKIE_SECURE` | `true` (enforced) |
| `FRONTEND_URL` | real SPA host, not `localhost` (enforced) |
| `DATABASE_URL` | Railway Postgres URL |
| `INSTAGRAM_CLIENT_ID` / `_SECRET` / `_REDIRECT_URI` | real Meta app creds |
| `RESEND_API_KEY` | real key (empty = console-only email) |
| `REFRESH_COOKIE_SAMESITE` | `lax` (same-origin) or `none` (cross-site) |
| `RATE_LIMIT_ENABLED` | `true` |

**Operational gotcha:** `staging` and `production` both take the hardened path
(HSTS, Secure cookies, prod-only CORS). You therefore can't bring up a `staging`
backend over plain `http://localhost` — use `ENVIRONMENT=development` for local
bring-up.

## Security headers

The backend sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy`, and (off-dev) `Strict-Transport-Security`. A page `Content-
Security-Policy` belongs on the **static frontend host**, not the API.

## Session revocation (note)

Logout and admin deny bump `users.token_version`, invalidating outstanding
**refresh** tokens immediately. **Access** tokens are stateless and remain valid
until they expire — the 1-hour access TTL (`ACCESS_TOKEN_TTL_MINUTES`) is the
load-bearing control, by design (no per-request DB check on the hot path).
