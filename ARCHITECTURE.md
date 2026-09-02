# Buzz — as-built architecture

Short description of **what is implemented today**. Behavior and UX rules live in [`PRODUCT.md`](PRODUCT.md) — do not restate them here. **Seeded-launch target** (apply-first orgs, admin-minted drops): [`LAUNCH.md`](LAUNCH.md). Agent workflow: [`AGENTS.md`](AGENTS.md). Deploy/ops: [`DEPLOYMENT.md`](DEPLOYMENT.md).

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
                   ├─ Google Places Autocomplete (New) + Address Validation (org ship-to; server-side key)
                   ├─ Resend (transactional email)
                   └─ Cron: scripts/run_job.py → jobs/* → job_runs
```

JSON API responses use `{ data, meta, error }` (camelCase, epoch-ms timestamps). OAuth authorize (`GET /api/auth/instagram/login`) is a redirect, not the envelope. Stable error `code` strings in `backend/app/errors.py`. Per-request SQLAlchemy sessions (`get_db`) commit on FastAPI's function stack so flushed writes are durable before the HTTP body is sent.

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
- Both access and refresh JWTs carry `ver`; API compares to `users.token_version` (revocation on logout, deny, password reset, re-login/refresh rotation, IG token clear/deauth, etc.). Refresh rotation is compare-and-swap: a superseded cookie 401s without bumping so it cannot revoke the winner.
- Guards: `get_current_user` → `require_role` / `require_status` → aliases `CurrentOrg` / `CurrentBrand` / `CurrentAdmin`.
- Impersonation: short-lived access token (default ~15m); admin refresh cookie untouched; default `IMPERSONATION_READONLY=true`. Same-tab reload remints via a `sessionStorage` View-as latch (Exit / logout clear it); access JWT stays memory-only.
- Org portal access statuses on `users.status` (**as-built today**): `pending_org_profile` → `pending_email_verification` → `pending_approval` → `active` | `denied` | `erased`. `erased` is terminal after admin org erase (identity scrubbed; campaign KPIs retained — PRODUCT §4.3). Brand review lives on `brands.status` (`pending_review` / `approved` / `denied`).

**Seeded-launch target** ([`LAUNCH.md`](LAUNCH.md) Phase A): after admin Approve → `pending_instagram` (until IG bind) → `active`; legacy rows with Graph already on file may skip to `active`. Public `/org/apply` creates the account without IG OAuth; returning login is Instagram on the bound account. Full status machine: LAUNCH §4.

Cookie SameSite on today’s dual Railway hosts vs future custom DNS: see [`DEPLOYMENT.md`](DEPLOYMENT.md) (do not invent cookie policy here).

---

## 4. Core tables

ORM modules under `backend/app/models/`. Services use explicit joins (no SQLAlchemy `relationship()` APIs).

| Table | Role |
| ----- | ---- |
| `users` | Identity for all portals; IG ids/tokens; `edu_email`; `password_hash`; `token_version` |
| `organizations` | Org profile (1:1 `user_id`); structured US `shipping_*` plus formatted `delivery_address` |
| `brands` | Brand profile (1:1 `user_id`); `instagram_handle` for autolink |
| `drops` | Campaign instance; capacity; apply window; tracker stage; units; tracking #; `published_at`; optional `drop_request_id`; `brand_can_edit_creative` (default false) |
| `drop_requests` | Brand intake tickets (not live campaigns); converted to a draft drop by admin |
| `drop_applications` | Org ↔ drop; decision applied/accepted/denied |
| `social_posts` | Cached IG media + metrics; unique `(org_id, platform, external_id)`. **Stories unsupported** — `metric_sync` does not catalog `STORY`; refresh/autolink/link skip them |
| `post_campaign_links` | Confirmed post → application (one post → one campaign) |
| `post_campaign_suggestions` | Autolink pending accept/dismiss |
| `notify_me` | Org reminder subscription; `sent_at` when email dispatched |
| `drop_tracker_events` | Tracker stage audit |
| `email_verification_tokens` / `brand_invite_tokens` / `password_reset_tokens` / `org_connect_tokens` / `org_apply_prefills` | One-shot tokens; prefills are apply **drafts** (no user until submit) |
| `job_runs` | Cron observability |

Brand tracker stages (enum, **as-built today**): `request_received` and `finalizing_agreements` remain on the PG enum for legacy rows. New drops start at `awaiting_products` on **Publish**. Post-publish order: `awaiting_products` → `drop_active` → `drop_finished`. Org feed / apply / Notify Me require `published_at IS NOT NULL`. See [`PRODUCT.md`](PRODUCT.md) §5.2.

Data ownership facts (which column owns which fact): **PRODUCT §3.1.1** — do not duplicate the table here.

---

## 5. API domains (`/api`)

Mounted in `backend/app/main.py`:

| Prefix | Module | Purpose |
| ------ | ------ | ------- |
| `/api/health`, `/api/config` | `routes/health.py` | Liveness + public flags |
| `/api/auth/*` | `routes/auth.py` | IG OAuth, refresh/logout/me, brand/admin login, verify-email, password reset, deauthorize |
| `/api/orgs/*` | `routes/orgs.py` | Apply/onboarding, address suggest/preview, org profile, post library |
| `/api/drops/*` | `routes/drops.py` | Org feed, detail, apply, Notify Me |
| `/api/campaigns/*` | `routes/campaigns.py` | My campaigns, link/unlink, suggestions, aggregate |
| `/api/brands/*` | `routes/brands.py` | Apply, brand profile, drops, finalize, aggregates |
| `/api/admin/*` | `routes/admin.py` | Queues, lifecycle, org erase (`POST …/orgs/{user_id}/erase` → `services/admin_erase.py`), drop config/tracker, health, impersonate |

Thin routes; business logic in `backend/app/services/`.

---

## 6. Frontend shape

- Entry: `frontend/src/index.tsx` → `BrowserRouter` → `QueryClientProvider` → `AuthProvider` → `AppRoot.tsx` routes.
- Shells: marketing `SiteLayout`; admin `AdminLayout`.
- Public marketing under `SiteLayout`: `/`, `/for-orgs`, `/for-brands`, legal pages.
- Guards: `RequireAuth` → `RequireStatus` → `RequireRole`.
- HTTP: hand-written `apiFetch` (`frontend/src/api/client.ts`) + TanStack Query hooks; OpenAPI types for typing (`schema.ts`), not a generated runtime SDK.
- Access token in memory; refresh via cookie; IG reconnect latch → `/reconnect-instagram`.

---

## 7. Background jobs

One-shot scripts via `backend/scripts/run_job.py <name>` (Railway Cron). Idempotent; JSON on stdout; row in `job_runs`.

| Job | Typical UTC cadence | Role |
| --- | ------------------- | ---- |
| `drop_autoclose` | `*/5` | Published drops whose window closed (does not advance `request_received` stubs) |
| `notify_reminders` | `*/5` | Notify Me emails |
| `metric_sync` | daily ~03:00 | Instagram FEED/REELS media + insights (`/me/media`); also refreshes `organizations.follower_count` from Graph `/me` for all tokened non-erased orgs. Stories out of scope (no `/stories` poller) |
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
