# Buzz admin MCP

Local **stdio** MCP for operator agents. Talks to `/api/admin/*` (default
production API). Credentials stay in **user** Cursor MCP config — never commit
them ([`AGENTS.md`](../../AGENTS.md)).

## Table / column policy

### Locked (2026-09-13)

| Fork | Lock |
| ---- | ---- |
| Transport | Local **stdio** MCP only (Cursor on this machine; HTTP to `/api/admin/*`). |
| Writes | Named admin actions + table inspect + **allowlisted** column edits. No raw SQL. |
| Default API | Production (`https://api.bringthebuzzover.com`) unless `BUZZ_API_URL` is set. |
| Secrets | Never read or write tokens, hashes, Graph user ids, `password_hash`, `token_version`. |

PII: **admin-parity** — table tools may read emails / shipping / contact /
handles (same as `/admin` detail pages) and PATCH the allowlisted profile
fields. Secrets stay hidden.

Every ORM table is visible. Columns are **hidden** (never returned), **read**,
**patch** (generic table PATCH), or **action** (named `/api/admin/*` only).

**Always hidden:** `password_hash`, `instagram_access_token`, `token_hash`,
`instagram_user_id`, `instagram_token_user_id`, `token_version`.

**Never generic-PATCH:** status machines, FKs, Graph-owned metrics, audit
timestamps, publish/hide/finalize latches. Use named admin actions.

| Table | Hidden | Read | Patch | Action-only |
| ----- | ------ | ---- | ----- | ----------- |
| `users` | hash, IG token, Graph user ids, `token_version` | role, status, emails, handle, token *timestamps*, login/created | `edu_email`, `instagram_username` | `status` (approve/deny/erase/clear-token) |
| `organizations` | — | all | name, university, tiktok, members, category, contact, campus city/state, shipping_* (recomputes `delivery_address`) | `approved_at`, `user_id`, `follower_count`, `instagram_handle_confirmed`, claimed IG / bind-mismatch timestamps (ack is named action) |
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

Not in v1: impersonate, raw SQL.

## Setup

```bash
cd tools/buzz-admin-mcp
poetry install
```

User `~/.cursor/mcp.json` (do not add this file to the repo):

```json
{
  "mcpServers": {
    "buzz-admin": {
      "command": "poetry",
      "args": ["run", "buzz-admin-mcp"],
      "cwd": "/ABS/PATH/TO/buzz/tools/buzz-admin-mcp",
      "env": {
        "BUZZ_ADMIN_EMAIL": "you@bringthebuzzover.com",
        "BUZZ_ADMIN_PASSWORD": "…"
      }
    }
  }
}
```

`BUZZ_API_URL` defaults to `https://api.bringthebuzzover.com`. Override for
local (`http://localhost:8000`). Optional `BUZZ_ADMIN_ACCESS_TOKEN` skips login.

Mutations need explicit user OK — same bar as Railway / Resend MCP.
