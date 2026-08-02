# Launch & Deployment

The go-live runbook for Buzz: what has to be true before we launch, how to
provision and deploy, and the environment/operational invariants to respect.
The application code is feature-complete and tested (backend `pytest`, frontend
smoke + Playwright E2E, live API bug-bash). The remaining work to launch is
**external provisioning and configuration**, not code.

Deploy target: **Railway** — three services in one project (architecture §1.3)
plus a Cron. Run `alembic upgrade head` as a release step before the backend
starts.

---

## Launch readiness at a glance

| Area                                                 | State                               | Blocker to launch?                  |
| ---------------------------------------------------- | ----------------------------------- | ----------------------------------- |
| Application code (both portals, jobs, auth)          | Done + tested                       | No                                  |
| Instagram / Meta app review (org login scopes)       | Not started                         | **Yes** — gates all org signups     |
| Legal review of Privacy Policy + Terms               | Draft in app (`/privacy`, `/terms`) | **Yes** — required for Meta + PII   |
| Railway services provisioned (API + Postgres + Cron) | Not started                         | **Yes**                             |
| Real secrets + env parity set                        | Not started                         | **Yes**                             |
| Resend verified sender domain                        | Not started                         | **Yes** — verification/denial email |

---

## Phase 1 — Pre-launch blockers (start first, longest lead time)

- [ ] **Meta / Instagram app review.** Org login is the only production sign-in
      path and needs **Advanced Access** on the `instagram_business_basic` +
      `instagram_business_manage_insights` scopes so _any_ org (not just accounts
      with a role on our Meta app) can log in. Advanced Access requires App
      Review **and** Business Verification. Submit early — this is the
      critical-path item (can take weeks). Provides the real
      `INSTAGRAM_CLIENT_ID` / `_SECRET` / `_REDIRECT_URI`.

  **App Review requires (Meta docs):** Business Verification (proof the business
  exists); a screencast of the full login flow _including the OAuth consent
  screen_ and each scope's data being used; a public Privacy Policy URL + Terms
  URL (→ Phase 1 legal item); a live, reviewer-accessible test environment; and
  at least one successful API call per scope before you can submit (so run the
  flow with a tester first). `instagram_business_manage_insights` is reviewed
  _separately_ from basic — request only scopes we actually use (least
  privilege) or review slows down.

### No-review pilot path (Instagram tester accounts)

You do **not** need App Review to run a small, hand-picked pilot. In
**Development mode**, the real login + metric-sync flow works fully — but only
for Instagram Business/Creator accounts you add as **roles** (admin / developer /
tester) on the Meta app. This is enough for a demo or a pilot with a handful of
partner orgs, with zero review. Constraints:

- Each pilot org's IG account must be a **Business or Creator** account (the
  backend already gates out Personal accounts) **and** must accept a tester
  invite in their Meta account.
- It doesn't scale — you can't hand-add every org, so this is a bridge, not the
  launch state. Public signups still require the Advanced Access review above.
- Keep the app in **Development mode** (or Live without the scope approved) until
  review passes; flip to **Live mode** only after Advanced Access is granted.
- [ ] **Legal review.** `/privacy` and `/terms` ship as good-faith engineering
      drafts (`src/pages/legal/`). Have counsel review before public launch — a
      published Privacy Policy URL is also required for Meta app review, and we
      collect PII (waitlist emails, `.edu` addresses, org profiles).
- [ ] **Resend sender domain.** Verify the `bringthebuzzover.com` sending domain
      in Resend and obtain a real `RESEND_API_KEY` (empty key = console-only, so
      verification and denial emails silently no-op).

---

## Phase 2 — Provision infrastructure (Railway)

| Service        | What                                                                   | Notes                                                                                     |
| -------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Frontend**   | React SPA, static build (`npm run build`)                              | Set `REACT_APP_USE_API=true` and `REACT_APP_API_URL` **at build time** (CRA inlines them) |
| **Backend**    | FastAPI + Uvicorn (`uvicorn app.main:app --host 0.0.0.0 --port $PORT`) | **Run a single replica** (see "Rate limiting")                                            |
| **PostgreSQL** | Railway-managed                                                        | `DATABASE_URL` injected                                                                   |
| **Cron**       | Railway Cron running `scripts/run_job.py <name>`                       | Schedule below                                                                            |

- [ ] Create the four services in one Railway project.
- [ ] Add `alembic upgrade head` as a release/deploy step that runs **before**
      the backend starts.

### Cron schedule (UTC)

Background jobs are one-shot scripts the scheduler invokes — no worker. Each is
idempotent (`backend/README.md`, architecture §10):

| Job              | Cadence      | Purpose                                              |
| ---------------- | ------------ | ---------------------------------------------------- |
| `drop_autoclose` | every ~5 min | close drops past their apply window (§10.2)          |
| `metric_sync`    | daily 03:00  | Instagram metric sync (§10.1)                        |
| `token_cleanup`  | daily 03:00  | sweep used/expired tokens (§10.3)                    |
| `autolink_scan`  | daily 03:30  | auto-link suggestion scan, after metric_sync (§10.4) |
| `token_refresh`  | daily 04:00  | IG long-lived token refresh safety net (§10.5.2)     |

The primary IG token refresh is **on-login**; `token_refresh` only catches
inactive orgs and is optional for a tight MVP.

---

## Phase 3 — Configure environment (parity checklist)

The backend **fails fast at startup** (`backend/app/config.py`) when
`ENVIRONMENT != development` if any of these are wrong, so a misconfigured
deploy crashes instead of silently shipping an insecure or broken layer:

| Var                                                 | Requirement off-dev                          |
| --------------------------------------------------- | -------------------------------------------- |
| `ENVIRONMENT`                                       | `staging` or `production`                    |
| `SECRET_KEY`                                        | real value (not the committed dev default)   |
| `TOKEN_ENCRYPTION_KEY`                              | real Fernet key (not the dev default)        |
| `REFRESH_COOKIE_SECURE`                             | `true` (enforced)                            |
| `FRONTEND_URL`                                      | real SPA host, not `localhost` (enforced)    |
| `INSTAGRAM_CLIENT_ID` / `_SECRET` / `_REDIRECT_URI` | real Meta creds (enforced)                   |
| `RESEND_API_KEY`                                    | real key (enforced; empty would no-op email) |
| `DATABASE_URL`                                      | Railway Postgres URL                         |
| `REFRESH_COOKIE_SAMESITE`                           | `lax` (same-origin) or `none` (cross-site)   |
| `RATE_LIMIT_ENABLED`                                | `true`                                       |

Generate secrets:

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"          # SECRET_KEY
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"  # TOKEN_ENCRYPTION_KEY
```

- [ ] Backend env set (table above); secrets generated fresh, never committed.
- [ ] Frontend built with `REACT_APP_USE_API=true` and the real
      `REACT_APP_API_URL` (the `predeploy` guard, `scripts/check-deploy-env.js`,
      hard-fails if `REACT_APP_API_URL` is missing).
- [ ] `BRAND_SELF_REGISTRATION_ENABLED` set intentionally (`true` = public
      `POST /api/brands/apply`; `false` = admin-provisioned brands only).

**Operational gotcha:** `staging` and `production` both take the hardened path
(HSTS, Secure cookies, prod-only CORS), so you can't bring one up over plain
`http://localhost` — use `ENVIRONMENT=development` for local bring-up.

### Same-origin vs cross-origin (auth cookies)

The refresh + OAuth cookies are `SameSite=lax`, so the SPA and API must be
**same-site**. Two supported topologies (see `backend/.env.example`):

1. **Same-origin (preferred):** serve the API under the SPA's domain at `/api`
   via a reverse proxy. Cookies "just work".
2. **Cross-site:** API on a different registrable domain → set
   `REFRESH_COOKIE_SAMESITE=none` + `REFRESH_COOKIE_SECURE=true` (HTTPS) and keep
   the exact-origin CORS allowlist with credentials.

---

## Phase 4 — Deploy

- [ ] Run migrations: `alembic upgrade head` (release step, before backend boot).
- [ ] Deploy backend; confirm it boots (a bad env crashes it here by design).
- [ ] Build + deploy the frontend with the API URL baked in.

---

## Phase 5 — Post-deploy verification

- [ ] `GET /api/health` returns `{"data":{"status":"ok",...},"error":null}`.
- [ ] Instagram login completes end-to-end (real Meta creds, redirect URI matches).
- [ ] A verification email actually arrives (Resend live path).
- [ ] Waitlist submit from the home page and `/waitlist` both persist
      (`POST /api/waitlist` → Postgres).
- [ ] Brand login → dashboard; org role is blocked from the brand dashboard (403).
- [ ] Security headers present on API responses (see below).

---

## Operational invariants (keep these true)

### Rate limiting — single-replica

Rate limiting is **in-memory and per-process** (`app/security/rate_limit.py`).
With more than one backend replica, counters split and limits weaken
proportionally. For the MVP, **keep the backend at one replica**; to scale out,
move the limiter to Redis. Toggle with `RATE_LIMIT_ENABLED` (default true).

### Security headers

The backend sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy`, and (off-dev) `Strict-Transport-Security`. A page
`Content-Security-Policy` belongs on the **static frontend host**, not the API.

### Session revocation

Logout and admin-deny bump `users.token_version`, invalidating outstanding
**refresh** tokens immediately. **Access** tokens are stateless and remain valid
until they expire — the 1-hour access TTL (`ACCESS_TOKEN_TTL_MINUTES`) is the
load-bearing control, by design (no per-request DB check on the hot path).

---

## Known follow-ups (non-blocking)

- **Admin tooling.** Org approval, tracker advance, and reopen are API-only
  (admin JWT + curl). Fine for a hand-held pilot; add a minimal admin UI or a
  documented runbook before onboarding at volume.
- **Dead `firebase` dependency.** Nothing imports Firebase anymore (waitlist
  moved to `POST /api/waitlist`). The `firebase` package and `REACT_APP_FIREBASE_*`
  entries in `.env.example` can be removed to shrink the bundle.
- **Legal pages** should be replaced with counsel-reviewed copy (see Phase 1).

---

## Setup references & links

Official docs for each thing this runbook asks you to provision. Verify against
the live pages — Meta in particular changes its dashboard flow often.

### Meta / Instagram (org login)

The app uses **Instagram API with Instagram Login** (Business Login), scopes
`instagram_business_basic` + `instagram_business_manage_insights`, host
`graph.instagram.com`. It does **not** use Facebook Login or require a linked
Facebook Page.

- Meta App Dashboard (create/manage the app): <https://developers.facebook.com/apps/>
- Instagram API with Instagram Login (product overview): <https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/>
- Create a Meta app with Instagram (step-by-step): <https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/create-a-meta-app-with-instagram/>
- Business Login setup + token exchange (matches `services/instagram.py`): <https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/>
- Get started / first API call (needed before you can submit for review): <https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/get-started/>
- App Review for Instagram API (Advanced Access): <https://developers.facebook.com/docs/instagram-platform/app-review/>
- Access levels (Standard vs Advanced): <https://developers.facebook.com/docs/graph-api/overview/access-levels/>
- App modes (Development vs Live): <https://developers.facebook.com/docs/development/build-and-test/app-modes/>
- App roles — how to add an **Instagram Tester** (pilot path; dashboard-only, no API): <https://developers.facebook.com/docs/development/build-and-test/app-roles/>
- Tester accepts the invite here (send this link to pilot orgs): <https://www.instagram.com/accounts/manage_access/> → **Tester Invites** tab
- Screen-recording requirements for the review submission: <https://developers.facebook.com/docs/app-review/submission-guide/screen-recordings/>
- Business Verification (required for Advanced Access): <https://developers.facebook.com/docs/development/release/business-verification/>
- Publish / go-Live checklist: <https://developers.facebook.com/docs/development/release/>

Set the resulting credentials in the backend env: `INSTAGRAM_CLIENT_ID`,
`INSTAGRAM_CLIENT_SECRET`, `INSTAGRAM_REDIRECT_URI` (must exactly match an OAuth
redirect URI configured in the dashboard).

### Resend (transactional email)

- Add a domain: <https://resend.com/docs/add-a-domain>
- Managing domains / DKIM + SPF records: <https://resend.com/docs/dashboard/domains>
- Troubleshooting verification: <https://resend.com/docs/knowledge-base/what-if-my-domain-is-not-verifying>
- API keys dashboard: <https://resend.com/api-keys>

Verify the `bringthebuzzover.com` sending domain, then set `RESEND_API_KEY` and
`EMAIL_FROM` (a verified sender) in the backend env.

### Railway (hosting: API + Postgres + Cron)

- Deploy a FastAPI app: <https://docs.railway.com/guides/fastapi>
- PostgreSQL (provision + `DATABASE_URL`): <https://docs.railway.com/databases/postgresql>
- Cron jobs (one service per job; min every 5 min; UTC): <https://docs.railway.com/guides/cron-workers-queues>
- Variables & reference variables (share `DATABASE_URL` across services): <https://docs.railway.com/guides/variables>
- Pre-deploy command (run `alembic upgrade head` before boot): <https://docs.railway.com/deployments/pre-deploy-command>

### Secret generation (local, no account needed)

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"          # SECRET_KEY
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"  # TOKEN_ENCRYPTION_KEY
```
