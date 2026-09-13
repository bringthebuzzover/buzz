---
id: admin-mcp
title: Admin-only MCP server for Buzz operators
status: exploring
updated: 2026-09-13
---

## Locked (2026-09-13)

| Fork | Lock |
| ---- | ---- |
| Transport | Local **stdio** MCP only (Cursor on this machine; HTTP to `/api/admin/*`). |
| Writes | Named admin actions + table inspect + **allowlisted** column edits. No raw SQL. |
| Default API | Production (`https://api.bringthebuzzover.com`) unless `BUZZ_API_URL` is set. |
| Secrets | Never read or write tokens, hashes, Graph user ids, `password_hash`, `token_version`. |

PII: **admin-parity** — table tools may read emails / shipping / contact /
handles (same as `/admin` detail pages) and PATCH the allowlisted profile
fields. Secrets stay hidden.

## Table / column policy

Every ORM table is visible. Columns are **hidden** (never returned), **read**,
**patch** (generic table PATCH), or **action** (named `/api/admin/*` only).

**Always hidden:** `password_hash`, `instagram_access_token`, `token_hash`,
`instagram_user_id`, `instagram_token_user_id`, `token_version`.

**Never generic-PATCH:** status machines, FKs, Graph-owned metrics, audit
timestamps, publish/hide/finalize latches. Use named admin actions.

| Table | Hidden | Read | Patch | Action-only |
| ----- | ------ | ---- | ----- | ----------- |
| `users` | hash, IG token, Graph user ids, `token_version` | role, status, emails, handle, token *timestamps*, login/created | `edu_email`, `instagram_username` | `status` (approve/deny/erase/clear-token) |
| `organizations` | — | all | name, university, tiktok, members, category, contact, campus city/state, shipping_* (recomputes `delivery_address`) | `approved_at`, `user_id`, `follower_count`, `instagram_handle_confirmed` |
| `brands` | — | all | `brand_name`, `company_email`, `instagram_handle`, `intent_message` | `status`, `approved_at`, `user_id` |
| `drops` | — | all | same as `AdminDropConfigPatch` (title/desc/image/location/capacity/window/units/hashtag/`brand_can_edit_creative`) | tracker, publish, hide, reopen, finalize, FKs, leftover `tracking_number` |
| `drop_requests` | — | all | `message`, `notes` | `status`, `converted_drop_id`, `brand_id` |
| `drop_applications` | — | all | `pitch`, `allocated_units` | `decision`, `decision_at`, FKs |
| `drop_application_shipments` | — | all | `tracking_number`, `carrier` | `application_id` (add/delete tools also exist) |
| `social_posts` | — | all incl. caption / `insights_raw` | — | Graph-owned; no table write |
| `post_campaign_links` | — | all | — | attribution (PRODUCT §4.2) |
| `post_campaign_suggestions` | — | all | — | confirm/dismiss |
| `notify_me` | — | all | `reminder_minutes`, `enabled` | FKs |
| `drop_tracker_events` | — | all | — | audit |
| `job_runs` | — | all | — | cron observability |
| `email_verification_tokens` | `token_hash` | id, user, email, timestamps | — | — |
| `brand_invite_tokens` | `token_hash` | id, user, brand, email, timestamps | — | — |
| `password_reset_tokens` | `token_hash` | id, user, email, timestamps | — | — |
| `org_connect_tokens` | `token_hash` | id, user, org, email, timestamps | — | — |
| `org_ig_change_requests` | — | all | — | approve/deny (named tools) |
| `org_apply_prefills` | `token_hash` | rest (incl. invite/edu/shipping) | draft profile/shipping/extras/source | `used_at`, `used_by_user_id` |

# Admin MCP (Buzz operator agents)

Brainstorm (2026-09-13). Not PRODUCT. Promoting needs an explicit PRODUCT / UX
decision ([`AGENTS.md`](../AGENTS.md) hard stop) **if** tools can change
user-visible state (approve, publish, hide, erase, mail). Internal read-only
inspect is ops tooling (same class as Railway / Resend MCP), not a brand/org
surface.

Related: [`admin-late-add-org.md`](admin-late-add-org.md),
[`admin-autolink-on-demand.md`](admin-autolink-on-demand.md),
[`admin-compose-email.md`](admin-compose-email.md),
[`admin-drops.md`](admin-drops.md).

## Desired motion

Whoever connects an MCP client with **admin credentials** can:

1. Inspect Buzz tables (list / filter / get row).
2. Run the same actions as the admin panel (`/api/admin/*`).
3. Optionally do **more** than the panel — but only as **named tools** that
   go through existing services (or a new service), not raw SQL.

Brand and org agents must never see this server. A leaked token is a full
admin session.

## How it fits today

The panel is **not** a table editor. Every mutation is a curated route in
[`backend/app/routes/admin.py`](../backend/app/routes/admin.py) calling
`app.services.admin*` / `admin_auth` / `admin_erase` / `admin_read`. Auth is
`CurrentAdmin` (active `portal_role=admin` JWT).

There is **no** MCP package in the backend today (`pyproject.toml` has no
`mcp` / `fastapi-mcp` dep). Cursor already uses **external** MCPs
(Railway, GitHub, Resend, Meta) via **user** `.cursor/mcp.json` — never
committed ([`AGENTS.md`](../AGENTS.md)).

Core tables: [`ARCHITECTURE.md`](../ARCHITECTURE.md) §4. Dangerous write
surfaces if an agent can `UPDATE` freely:

| Surface | Why not generic write |
| ------- | --------------------- |
| `users.password_hash`, IG token columns | Secrets; Fernet blob |
| `users.token_version`, `users.status` | Session revoke + org lifecycle |
| `brands.status`, drop tracker / `published_at` / `hidden_at` | Status machines + PRODUCT gates |
| `*_tokens` tables | One-shot secrets |
| `post_campaign_links` | Attribution (PRODUCT §4.2) |
| `drop_applications.decision` | Capacity / finalize / feed |

## Options

| Option | What | Verdict |
| ------ | ---- | ------- |
| A. Local stdio MCP | Python process in-repo; Cursor `command`; calls `/api/admin/*` with a token | Fastest; no new public surface; each machine needs Python + env |
| B. HTTP MCP on FastAPI | Streamable HTTP on the Railway API (e.g. `/mcp`); same process + services | Best for any approved Cursor; **new public endpoint** — token-gated only |
| C. Cloudflare Worker MCP | Worker tools proxy to Buzz API | Extra account + hop; Worker does not hold Postgres. Skip. |
| D. Auto-expose all OpenAPI | `fastapi-mcp` on every route | Leaks org/brand tools. **No.** |

**Recommended:** **A then B** — ship stdio against the existing admin API
first; mount HTTP on the API only when a second operator/machine needs it.
Tools always call **admin services**, never a second copy of approve/deny.

## Proposed tool catalog (v1)

**Read (tables + panel lists)**

- `list_tables` — allowlisted ORM tables + column names (no secrets cols)
- `query_rows` — table + filters + limit; redact token/hash columns
- `get_row` — table + id
- Panel reads already exist: overview, health, orgs, brands, drops,
  drop-requests, users (impersonation picker)

**Actions (1:1 with `/api/admin/*`)**

Org: approve / deny / undeny / resend-connect / clear-ig-token / erase /
compose-email. Brand: create / approve / deny / undeny / resend-invite /
compose-email. Drops: create from ticket, publish, patch config, tracker,
tracking, reopen, clear-reopen, hide, unhide. Plus overview/health.

**Not in v1**

- Impersonate (mints a user access token into the agent — easy to leak)
- `cleanup-request-received` (already prod-blocked)
- Raw SQL
- Late-add / sync-autolink / brand erase / IG-change review — now shipped as named tools (see MCP server)

**Table writes (only if explicitly locked)**

Allowlisted `PATCH` of non-machine columns (e.g. org shipping, brand
`instagram_handle`, drop title/description already on `update_drop_config`).
Status / tokens / hashes / links stay **named-action only**.

## Auth

- Client never gets brand/org tools.
- Token lives in **user** Cursor MCP config, not the repo.
- Prefer a dedicated `BUZZ_MCP_ADMIN_TOKEN` (or admin JWT) presented as
  Bearer. Rotate by bumping `users.token_version` / replacing the secret.
- HTTP mount must reject unauthenticated probes with 401 (no tool list).

## Docs if promoted

- [`AGENTS.md`](../AGENTS.md) MCP table row: Buzz Admin — mutate only with
  explicit user OK (same bar as Railway/Resend).
- [`ARCHITECTURE.md`](../ARCHITECTURE.md) as-built note (not PRODUCT).
- PRODUCT only if we treat MCP as a committed operator capability beyond
  “same as the panel.”
