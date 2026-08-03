# Launch & Deployment

The go-live runbook for Buzz: what has to be true before we launch, how to provision and deploy, and the environment/operational invariants to respect. The application code is feature-complete and tested (backend `pytest`, frontend smoke + Playwright E2E, live API bug-bash). The remaining work to launch is **external configuration** (custom DNS, Meta go-live, Resend domain verify) — not application code, and not greenfield Railway provisioning.

Deploy target: **Railway** from branch **`mvp`** (autodeploy on) — Frontend (`/frontend`) + Backend (`/backend`) + PostgreSQL + **five** cron services. Run `alembic upgrade head` as a pre-deploy step before the backend starts. Intended custom domains: `www.bringthebuzzover.com` (SPA) + `api.bringthebuzzover.com` (API) — **not attached yet**.

### Environment vocabulary

| Name | Meaning today |
| ---- | ------------- |
| **Local / `development`** | Laptop bring-up (`ENVIRONMENT=development`). Dev secrets, insecure cookies OK, localhost CORS. |
| **Railway env `production`** | The **only** Railway environment today (project **buzz**). Pre-launch: serves Railway-generated hosts, not public custom DNS. `ENVIRONMENT` for the API is whatever is set on that service (must be `staging` or `production` for the fail-fast path — not `development`). |
| **Staging (optional / future)** | A second Railway environment is **not** provisioned. Optional later if you want a separate stack from public launch. |

**Live hosts (Railway-generated, today):**

- Frontend: `https://frontend-production-3819.up.railway.app`
- API: `https://api-production-fbbc1.up.railway.app`

---

## Launch readiness at a glance

| Area                                                 | State                               | Blocker to launch?                  |
| ---------------------------------------------------- | ----------------------------------- | ----------------------------------- |
| Application code (both portals, jobs, auth)          | Done + tested                       | No                                  |
| Instagram / Meta app review (org login scopes)       | Not started                         | **Yes** — gates all org signups     |
| Legal review of Privacy Policy + Terms               | Draft in app (`/privacy`, `/terms`) | **Yes** — required for Meta + PII   |
| Railway stack (Frontend + API + Postgres + 5 crons)  | **Done** (env `production`, autodeploy from `mvp`) | No — stack exists                   |
| Custom DNS (`www` / `api.bringthebuzzover.com`)      | Not attached                        | **Yes** for public brand URLs       |
| Secrets + env for current Railway hosts              | Set (API fail-fast requires them)   | No for Railway URLs                 |
| Env parity for custom domains (SPA/API URLs, Meta)   | Not done                            | **Yes** when cutting over DNS       |
| Resend verified sender domain                        | Not started                         | **Yes** — verification/denial email |

---

## Phase 1 — Pre-launch blockers (start first, longest lead time)

- [ ] **Meta / Instagram app review.** Org login is the only production sign-in path and needs **Advanced Access** on the `instagram_business_basic` + `instagram_business_manage_insights` scopes so _any_ org (not just accounts with a role on our Meta app) can log in. Advanced Access requires App Review **and** Business Verification. Submit early — this is the critical-path item (can take weeks). Provides the real `INSTAGRAM_CLIENT_ID` / `_SECRET` / `_REDIRECT_URI`.

  **App Review requires (Meta docs):** Business Verification (proof the business exists); a screencast of the full login flow _including the OAuth consent screen_ and each scope's data being used; a public Privacy Policy URL + Terms URL (→ Phase 1 legal item); a live, reviewer-accessible test environment; and at least one successful API call per scope before you can submit (so run the flow with a tester first). `instagram_business_manage_insights` is reviewed _separately_ from basic — request only scopes we actually use (least privilege) or review slows down.

### No-review pilot path (Instagram tester accounts)

You do **not** need App Review to run a small, hand-picked pilot. In **Development mode**, the real login + metric-sync flow works fully — but only for Instagram Business/Creator accounts you add as **roles** (admin / developer / tester) on the Meta app. This is enough for a demo or a pilot with a handful of partner orgs, with zero review. Constraints:

- Each pilot org's IG account must be a **Business or Creator** account (the backend already gates out Personal accounts) **and** must accept a tester invite in their Meta account.
- It doesn't scale — you can't hand-add every org, so this is a bridge, not the launch state. Public signups still require the Advanced Access review above.
- Keep the app in **Development mode** (or Live without the scope approved) until review passes; flip to **Live mode** only after Advanced Access is granted.
- [ ] **Legal review.** `/privacy` and `/terms` ship as good-faith engineering drafts (`frontend/src/pages/legal/`). Have counsel review before public launch — a published Privacy Policy URL is also required for Meta app review, and we collect PII (`.edu` addresses, org profiles, brand application details).
- [ ] **Resend sender domain.** Verify the `bringthebuzzover.com` sending domain in Resend (DKIM/SPF). Off-dev the API already requires a non-empty `RESEND_API_KEY` to boot; without a **verified** sending domain, verification/denial emails still fail in practice even if the key is set.

---

## Phase 2 — Provision infrastructure (Railway)

Branch: **`mvp`** (autodeploy on). One Railway project (**buzz**). One Railway environment (**`production`**) — there is no separate staging environment.

| Service                 | What                                                                                      | Notes                                                                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend**            | React SPA under `/frontend`                                                               | Root Directory `/frontend`; Watch Paths `/frontend/**`; Build `npm ci && npm run build:prod`; Start `npm run start:prod` (`serve -s`) |
| **api**                 | FastAPI + Uvicorn (`poetry run uvicorn app.main:app --host 0.0.0.0 --port $PORT`)         | Root Directory `/backend`; Watch Paths `/backend/**`; Pre-deploy `poetry run alembic upgrade head`; **1 replica**; Health `/api/health` (DB ping — 503 if Postgres is down) |
| **PostgreSQL**          | Railway-managed                                                                           | Injects `DATABASE_URL` (`postgres://…` / `postgresql://…`); backend rewrites to `postgresql+asyncpg://` at startup                    |
| **Cron ×5** (named)     | One service per job: `poetry run python scripts/run_job.py <name>`                        | `cron-drop-autoclose`, `cron-metric-sync`, `cron-token-cleanup`, `cron-autolink-scan`, `cron-token-refresh`; Root `/backend`; no public domain; share API env |

- [x] Create the services in one Railway project (Frontend + API + Postgres + 5 crons) — **done**.
- [x] Set each service's **Root Directory** / Watch Paths and wire autodeploy from `mvp` — **done** (deploys follow `mvp` commits).
- [ ] Custom domains: `www.bringthebuzzover.com` → Frontend; `api.bringthebuzzover.com` → Backend (CNAME + TXT). **Not attached** — traffic is on `*.up.railway.app` today.
- [ ] Enable **Wait for CI** on Frontend + API (CI on `mvp` includes typecheck/build, backend suite, and Playwright `frontend-e2e`).
- [ ] Optional: `RAILPACK_PYTHON_VERSION=3.12` on API + cron services.
- [ ] Optional later: a second Railway environment for true staging (not required for pilot on the current stack).

### Frontend build / start

CRA inlines `REACT_APP_API_URL` at **build** time. Railway Build Command should be `npm run build:prod` (runs `frontend/scripts/check-deploy-env.js`, then `craco build`) with the **current** API origin until custom DNS is live:

```text
# Today (Railway-generated):
REACT_APP_API_URL=https://api-production-fbbc1.up.railway.app

# After custom DNS cutover:
REACT_APP_API_URL=https://api.bringthebuzzover.com
```

Start Command: `npm run start:prod` → `serve -s build -l $PORT` (History API fallback for deep links / OAuth callback; `serve` binds `0.0.0.0` by default). Plain `npm run build` stays for CI (no API URL required).

### Cron schedule (UTC)

Background jobs are one-shot scripts the scheduler invokes — no worker. Each is idempotent (`backend/README.md`, architecture §10). **One Railway cron service per row:**

| Service             | Start command                                         | Cron UTC      | Purpose                                              |
| ------------------- | ----------------------------------------------------- | ------------- | ---------------------------------------------------- |
| cron-drop-autoclose | `poetry run python scripts/run_job.py drop_autoclose` | `*/5 * * * *` | close drops past their apply window (§10.2)          |
| cron-metric-sync    | `… metric_sync`                                       | `0 3 * * *`   | Instagram metric sync (§10.1)                        |
| cron-token-cleanup  | `… token_cleanup`                                     | `0 3 * * *`   | sweep used/expired tokens (§10.3)                    |
| cron-autolink-scan  | `… autolink_scan`                                     | `30 3 * * *`  | auto-link suggestion scan, after metric_sync (§10.4) |
| cron-token-refresh  | `… token_refresh`                                     | `0 4 * * *`   | IG long-lived token refresh safety net (§10.5.2)     |

The primary IG token refresh is **on-login**; `token_refresh` only catches inactive orgs and is optional for a tight MVP. Confirm each cron run **exits** (Completed, not stuck Active). Each invocation writes a `job_runs` row (`ok` + `summary`); `/api/admin/health` surfaces last-run age on pipeline signals.

---

## Phase 3 — Configure environment (parity checklist)

The backend **fails fast at startup** (`backend/app/config.py`) when `ENVIRONMENT != development` if any of these are wrong, so a misconfigured deploy crashes instead of silently shipping an insecure or broken layer:

| Var                                                 | Requirement off-dev                          |
| --------------------------------------------------- | -------------------------------------------- |
| `ENVIRONMENT`                                       | `staging` or `production`                    |
| `SECRET_KEY`                                        | real value (not the committed dev default)   |
| `TOKEN_ENCRYPTION_KEY`                              | real Fernet key (not the dev default)        |
| `REFRESH_COOKIE_SECURE`                             | `true` (enforced)                            |
| `FRONTEND_URL`                                      | real SPA host, not `localhost` (enforced)    |
| `INSTAGRAM_CLIENT_ID` / `_SECRET` / `_REDIRECT_URI` | real Meta creds (enforced)                   |
| `RESEND_API_KEY`                                    | real key (enforced; empty would no-op email) |
| `DATABASE_URL`                                      | Railway Postgres URL (rewritten to `postgresql+asyncpg://` at startup) |
| `REFRESH_COOKIE_SAMESITE`                           | `lax` after www+api custom DNS; on today's `*.up.railway.app` hosts see SameSite note below (`none` may be required temporarily) |
| `RATE_LIMIT_ENABLED`                                | `true`                                                                 |

Generate secrets:

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"          # SECRET_KEY
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"  # TOKEN_ENCRYPTION_KEY
```

- [x] Backend env set for the current Railway hosts (table above); secrets generated fresh, never committed. Re-check when cutting over custom domains (`FRONTEND_URL`, Instagram redirect URI, cookie SameSite — see below).
- [x] Frontend built via `npm run build:prod` with a non-localhost `REACT_APP_API_URL` (guard: `frontend/scripts/check-deploy-env.js`). Rebuild with `https://api.bringthebuzzover.com` at DNS cutover.
- [ ] `BRAND_SELF_REGISTRATION_ENABLED` set intentionally (`true` = public `POST /api/brands/apply`; `false` = admin-provisioned brands only).
- [ ] Meta dashboard URLs after **custom** domains are live (or temporarily point at Railway SPA/API hosts for the pilot/tester path):
  - OAuth redirect: `https://www.bringthebuzzover.com/auth/instagram/callback` (or current Railway frontend origin + `/auth/instagram/callback`)
  - Deauthorize: `https://api.bringthebuzzover.com/api/auth/instagram/deauthorize` (API host)
  - Data deletion: `https://www.bringthebuzzover.com/data-deletion`

**Operational gotcha:** Off-dev (`staging` / `production`) both take the hardened path (HSTS, Secure cookies, no localhost CORS), so you can't bring one up over plain `http://localhost` — use `ENVIRONMENT=development` for local bring-up. CORS always allowlists apex + www and also adds `FRONTEND_URL`'s origin so temporary Railway SPA hosts work before custom DNS (`backend/app/main.py`).

### Same-site SPA + API (auth cookies)

**Target topology (custom DNS):** SPA on `www.bringthebuzzover.com`, API on `api.bringthebuzzover.com` (same eTLD+1). Use `REFRESH_COOKIE_SAMESITE=lax` + `REFRESH_COOKIE_SECURE=true`.

**Today (Railway-generated hosts):** Frontend and API are different `*.up.railway.app` hosts. Those are **cross-site** for cookies (`up.railway.app` is on the public suffix list), so `SameSite=lax` refresh/OAuth cookies set by the API often **will not** accompany credentialed XHR from the SPA. Practical options until custom DNS: (1) cut over to www+api ASAP and keep `lax`, or (2) temporarily use `REFRESH_COOKIE_SAMESITE=none` (+ Secure) on the Railway stack and accept the stricter browser rules. CORS already includes `FRONTEND_URL` so the origin allowlist is not the blocker — cookie SameSite is.

Alternative long-term: same-origin reverse proxy (`/api` under the SPA domain) — cookies "just work"; not the first deploy path.

---

## Phase 4 — Deploy

Order: Postgres → API (migrate + health) → Frontend (baked API URL) → Crons → DNS for custom domains → Meta URL update.

- [x] Pre-deploy migrations: `poetry run alembic upgrade head` (before backend boot) — wired on the API service.
- [x] Deploy backend; confirm it boots (a bad env crashes it here by design).
- [x] Build + deploy the frontend with `build:prod` + real `REACT_APP_API_URL` (Railway API host today).
- [ ] Confirm cron services exit after each run (Completed, not stuck Active) — spot-check after schedule changes.
- [ ] Attach custom domains + rebuild SPA with `REACT_APP_API_URL=https://api.bringthebuzzover.com`; set `FRONTEND_URL` to `https://www.bringthebuzzover.com`.
- [ ] Update Meta dashboard URLs to the custom hosts (see Phase 3).

---

## Phase 5 — Post-deploy verification

- [ ] `GET /api/health` returns `{"data":{"status":"ok","version":"0.1.0"},"meta":null,"error":null}` when Postgres is up (and **503** with an error envelope when it is not).
- [ ] Instagram login completes end-to-end (real Meta creds, redirect URI matches). On Railway hosts, confirm refresh cookies actually stick (SameSite caveat above).
- [ ] A verification email actually arrives (Resend live path + verified sending domain).
- [ ] Home Join Us section routes: "Join as Student Organization" → `/login` (Instagram OAuth), "Apply as Brand" → `/brand/apply` (POST /api/brands/apply).
- [ ] Brand login → dashboard; org role is blocked from the brand dashboard (403).
- [ ] Test accounts created: `TEST_ADMIN_PASSWORD=... TEST_BRAND_PASSWORD=... railway run python scripts/upsert_test_accounts.py` (one-off, non-destructive — see `TESTING.md`). Auth paths: admin email/password (`/admin/login`), brand email/password (`/brand/login`), org Instagram OAuth (`/login`).
- [ ] `/admin/login` signs the admin in; `/admin` panel covers overview, orgs, brands (including **Invite brand** when self-reg is off), drops, and health — approve/deny, tracker advance, reopen, recovery actions, and **View as** (impersonation is read-only by default; see below).
- [ ] Brand and admin **Forgot password?** flows work (`/brand/forgot-password`, `/admin/forgot-password` → email link → reset). Cron `token_cleanup` sweeps spent reset tokens with the other token tables; each cron writes a `job_runs` row.
- [ ] Security headers present on API responses (see below).

---

## Operational invariants (keep these true)

### Rate limiting — single-replica

Rate limiting is **in-memory and per-process** (`app/security/rate_limit.py`). With more than one backend replica, counters split and limits weaken proportionally. For the MVP, **keep the backend at one replica**; to scale out, move the limiter to Redis. Toggle with `RATE_LIMIT_ENABLED` (default true).

### Security headers

The backend sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, and (off-dev) `Strict-Transport-Security`. A page `Content-Security-Policy` belongs on the **static frontend host**, not the API.

### Session revocation

Logout and admin-deny bump `users.token_version`, invalidating outstanding **refresh** tokens immediately. **Access** tokens are stateless and remain valid until they expire — the 1-hour access TTL (`ACCESS_TOKEN_TTL_MINUTES`) is the load-bearing control, by design (no per-request DB check on the hot path).

### Admin auth + recovery (ops note)

- **Admin** = email/password at `/admin/login`. **Brand** = email/password. **Org** = Instagram OAuth only.
- **View as** mints a short-lived access token; the admin refresh cookie is untouched. Default `IMPERSONATION_READONLY=true` (mutating requests rejected). Set `false` only for deliberate write debugging.
- Recovery actions live in the admin panel (and matching `/api/admin/*` routes): resend brand invite, un-deny org/brand, clear reopen flag, clear stuck IG token, tracking-number repair. Prefer the UI for day-to-day ops; curl only when needed.

---

## Known follow-ups (non-blocking)

- **Custom DNS + cookie cutover.** Attach `www` / `api.bringthebuzzover.com`, rebuild the SPA, flip Meta URLs, and keep `REFRESH_COOKIE_SAMESITE=lax` on same-site custom hosts (see Phase 3).
- **Optional staging Railway environment** if you want a stack separate from the current `production` env before public launch.
- **Dead `firebase` dependency.** Nothing imports Firebase anymore. The `firebase` package and `REACT_APP_FIREBASE_*` entries in `.env.example` can be removed to shrink the bundle.
- **Legal pages** should be replaced with counsel-reviewed copy (see Phase 1).

---

## Setup references & links

Official docs for each thing this runbook asks you to provision. Verify against the live pages — Meta in particular changes its dashboard flow often.

### Meta / Instagram (org login)

The app uses **Instagram API with Instagram Login** (Business Login), scopes `instagram_business_basic` + `instagram_business_manage_insights`, host `graph.instagram.com`. It does **not** use Facebook Login or require a linked Facebook Page.

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

Set the resulting credentials in the backend env: `INSTAGRAM_CLIENT_ID`, `INSTAGRAM_CLIENT_SECRET`, `INSTAGRAM_REDIRECT_URI` (must exactly match an OAuth redirect URI configured in the dashboard).

### Resend (transactional email)

- Add a domain: <https://resend.com/docs/add-a-domain>
- Managing domains / DKIM + SPF records: <https://resend.com/docs/dashboard/domains>
- Troubleshooting verification: <https://resend.com/docs/knowledge-base/what-if-my-domain-is-not-verifying>
- API keys dashboard: <https://resend.com/api-keys>

Verify the `bringthebuzzover.com` sending domain, then set `RESEND_API_KEY` and `EMAIL_FROM` (a verified sender) in the backend env.

### Railway (hosting: Frontend + API + Postgres + Cron)

Stack is already provisioned (project **buzz**, env **`production`**). Remaining Railway work is custom domains, optional Wait-for-CI, and optional second env for staging.

- Deploy a FastAPI app: <https://docs.railway.com/guides/fastapi>
- PostgreSQL (provision + `DATABASE_URL`): <https://docs.railway.com/databases/postgresql>
- Cron jobs (one service per job; min every 5 min; UTC): <https://docs.railway.com/guides/cron-workers-queues>
- Variables & reference variables (share `DATABASE_URL` across services): <https://docs.railway.com/guides/variables>
- Pre-deploy command (run `alembic upgrade head` before boot): <https://docs.railway.com/deployments/pre-deploy-command>
- Custom domains: <https://docs.railway.com/guides/domains>

### Secret generation (local, no account needed)

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"          # SECRET_KEY
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"  # TOKEN_ENCRYPTION_KEY
```
