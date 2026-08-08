# Buzz — as-built architecture

Short description of **what is implemented today**. Behavior and UX rules live in [`PRODUCT.md`](PRODUCT.md) — do not restate them here. Agent workflow: [`AGENTS.md`](AGENTS.md). Deploy/ops: [`DEPLOYMENT.md`](DEPLOYMENT.md).

---

## 1. Stack & monorepo

| Layer | Technology |
| ----- | ---------- |
| Frontend | React 18, TypeScript, Tailwind, CRA + CRACO, React Router 7, TanStack Query |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2 async + asyncpg, Alembic, Pydantic v2 |
| Auth | JWT access (Bearer) + httpOnly refresh cookie; org Instagram OAuth; brand/admin password (bcrypt) |
| Email | Resend |
| DB | PostgreSQL |
| Hosting | Railway — SPA + API + Postgres + six cron services; autodeploy from `mvp` |

```
frontend/     CRA SPA (REACT_APP_API_URL baked at build)
backend/      FastAPI app, migrations, jobs, tests
openapi.json  API contract (dump from backend → npm run gen:api)
scripts/      ci-local.sh (full CI mirror)
gaps/         Living bugs / product holes
```

---

## 2. Request path

```
SPA (apiFetch) → /api/* (FastAPI)
                   ├─ deps.auth (JWT + role/status)
                   ├─ routes → services → models (async SQLAlchemy)
                   ├─ Instagram Graph (org media/tokens)
                   ├─ Resend (transactional email)
                   └─ Cron: scripts/run_job.py → jobs/* → job_runs
```

JSON API responses use `{ data, meta, error }` (camelCase, epoch-ms timestamps). OAuth authorize (`GET /api/auth/instagram/login`) is a redirect, not the envelope. Stable error `code` strings in `backend/app/errors.py`.

OpenAPI regen:

```bash
cd backend && poetry run python scripts/dump_openapi.py
cd ../frontend && npm run gen:api
```

Commit both `openapi.json` and `frontend/src/api/generated/schema.ts` when routes/schemas change.

---

## 3. Auth model

| Role | Login | Notes |
| ---- | ----- | ----- |
| `org` | Instagram Business Login | Long-lived IG token Fernet-encrypted on `users` |
| `brand` | Email + password | Invite / self-reg (`BRAND_SELF_REGISTRATION_ENABLED`) |
| `admin` | Email + password | Panel + View as (impersonation) |

- **Access JWT** (~1h) in memory on the SPA (`Authorization: Bearer`).
- **Refresh** (~7d) httpOnly cookie `buzz_refresh`, path `/api/auth`. OAuth CSRF: `buzz_oauth_state` cookie on IG login.
- Both access and refresh JWTs carry `ver`; API compares to `users.token_version` (revocation on logout, deny, password reset, re-login/refresh rotation, IG token clear/deauth, etc.).
- Guards: `get_current_user` → `require_role` / `require_status` → aliases `CurrentOrg` / `CurrentBrand` / `CurrentAdmin`.
- Impersonation: short-lived access token (default ~15m); admin refresh cookie untouched; default `IMPERSONATION_READONLY=true`.
- Org portal access statuses on `users.status`: `pending_org_profile` → `pending_email_verification` → `pending_approval` → `active` | `denied` (behavior: PRODUCT §6.1). Brand review lives on `brands.status` (`pending_review` / `approved` / `denied`).

Cookie SameSite on today’s dual Railway hosts vs future custom DNS: see [`DEPLOYMENT.md`](DEPLOYMENT.md) (do not invent cookie policy here).

---

## 4. Core tables

ORM modules under `backend/app/models/`. Services use explicit joins (no SQLAlchemy `relationship()` APIs).

| Table | Role |
| ----- | ---- |
| `users` | Identity for all portals; IG ids/tokens; `edu_email`; `password_hash`; `token_version` |
| `organizations` | Org profile (1:1 `user_id`) |
| `brands` | Brand profile (1:1 `user_id`); `instagram_handle` for autolink |
| `drops` | Campaign instance; capacity; apply window; tracker stage; units; tracking # |
| `drop_applications` | Org ↔ drop; decision applied/accepted/denied |
| `social_posts` | Cached IG media + metrics; unique `(org_id, platform, external_id)` |
| `post_campaign_links` | Confirmed post → application (one post → one campaign) |
| `post_campaign_suggestions` | Autolink pending accept/dismiss |
| `notify_me` | Org reminder subscription; `sent_at` when email dispatched |
| `drop_tracker_events` | Tracker stage audit |
| `email_verification_tokens` / `brand_invite_tokens` / `password_reset_tokens` | One-shot tokens |
| `job_runs` | Cron observability |

Brand tracker stages (enum): `request_received` → `finalizing_agreements` → `awaiting_products` → `drop_active` → `drop_finished`.

Data ownership facts (which column owns which fact): **PRODUCT §3.1.1** — do not duplicate the table here.

---

## 5. API domains (`/api`)

Mounted in `backend/app/main.py`:

| Prefix | Module | Purpose |
| ------ | ------ | ------- |
| `/api/health`, `/api/config` | `routes/health.py` | Liveness + public flags |
| `/api/auth/*` | `routes/auth.py` | IG OAuth, refresh/logout/me, brand/admin login, verify-email, password reset, deauthorize |
| `/api/orgs/*` | `routes/orgs.py` | Onboarding, org profile, post library |
| `/api/drops/*` | `routes/drops.py` | Org feed, detail, apply, Notify Me |
| `/api/campaigns/*` | `routes/campaigns.py` | My campaigns, link/unlink, suggestions, aggregate |
| `/api/brands/*` | `routes/brands.py` | Apply, brand profile, drops, finalize, aggregates |
| `/api/admin/*` | `routes/admin.py` | Queues, lifecycle, drop config/tracker, health, impersonate |

Thin routes; business logic in `backend/app/services/`.

---

## 6. Frontend shape

- Entry: `frontend/src/index.tsx` → `BrowserRouter` → `QueryClientProvider` → `AuthProvider` → `AppRoot.tsx` routes.
- Shells: marketing `SiteLayout`; admin `AdminLayout`.
- Guards: `RequireAuth` → `RequireStatus` → `RequireRole`.
- HTTP: hand-written `apiFetch` (`frontend/src/api/client.ts`) + TanStack Query hooks; OpenAPI types for typing (`schema.ts`), not a generated runtime SDK.
- Access token in memory; refresh via cookie; IG reconnect latch → `/reconnect-instagram`.

---

## 7. Background jobs

One-shot scripts via `backend/scripts/run_job.py <name>` (Railway Cron). Idempotent; JSON on stdout; row in `job_runs`.

| Job | Typical UTC cadence | Role |
| --- | ------------------- | ---- |
| `drop_autoclose` | `*/5` | Close apply window → `finalizing_agreements` |
| `notify_reminders` | `*/5` | Notify Me emails |
| `metric_sync` | daily ~03:00 | Instagram media + insights |
| `token_cleanup` | daily ~03:00 | Sweep spent tokens |
| `autolink_scan` | daily ~03:30 | Caption suggestions (`drop_active`) |
| `token_refresh` | daily ~04:00 | IG long-lived refresh safety net |

Cadences are ops SOT in [`DEPLOYMENT.md`](DEPLOYMENT.md) (cron table). Primary IG token refresh is on-login (`deps/auth` + `instagram_token` service).

---

## 8. Quality gate

Full local CI (mirrors GitHub Actions):

```bash
./scripts/ci-local.sh
```

Backend: black → ruff → mypy → openapi dump+diff → alembic → pytest.  
Frontend: tsc → gen:api diff → build → Playwright E2E (`CI=true`).

Stress E2E ×N is opt-in (`workflow_dispatch` / `[e2e-stress-N]`), not default DoD — see [`TESTING.md`](TESTING.md).

---

## 9. Railway topology (pointer)

Live SPA + API on distinct `*.up.railway.app` hosts; custom `www` / `api.bringthebuzzover.com` is Phase 2. Cookie SameSite and env invariants: [`DEPLOYMENT.md`](DEPLOYMENT.md). Meta hosts: [`META.md`](META.md).
