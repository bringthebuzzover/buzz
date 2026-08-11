---
id: ops.brand-domain-email-unset
title: Replace personal contact with company-domain mail; no MX/Resend yet
kind: ops
severity: P1
status: fixed
surface: deploy
closed_in: split-2026-08-11
evidence:
  - path: backend/brand_emails.json
    note: emailFrom noreply@bringthebuzzover.com; contactEmail still mc3237@cornell.edu (personal)
  - path: backend/app/services/email.py
    note: Resend POST only when ENVIRONMENT != development; From from brand_emails.json
  - path: DEPLOYMENT.md
    note: Resend sender domain checklist still Not started; Domain/DNS ownership map
  - path: frontend/src/components/admin/AdminSidebar.tsx
    note: no Settings page; natural home for optional Open inbox link-out later
repro: |
  dig @1.1.1.1 MX bringthebuzzover.com → empty (apex)
  dig @1.1.1.1 TXT bringthebuzzover.com → no SPF; no _dmarc
  dig @1.1.1.1 TXT resend._domainkey.bringthebuzzover.com → empty
  dig @1.1.1.1 MX send.bringthebuzzover.com → empty (Resend return-path not published)
  Cloudflare zone 9103e4c774707bf5b2f17fbb9d9144cf: A/CNAME + Railway/ACME TXT only — no MX
  Hostinger mail_listOrdersV1 → total 0; mail_listMailboxesV1 → [Mail:2002] Route is not found
  SPA contact mailto = Cornell (brand_emails.json contactEmail)
fix_when: |
  Tracker closed by split (2026-08-11) — acceptance criteria moved to child gaps.
  Living work:
  - ops.resend-domain-unverified — Resend sender domain verify + prod send proof
  - ops.brand-mailbox — full company mailbox send+receive + Cornell contact cutover
---

# Brand domain email not provisioned (archived — split)

**Split 2026-08-11.** This id is closed as a tracker shell only — Resend and
mailbox work were **not** completed by this archive. See:

| Child | Scope |
| ------ | ----- |
| [`ops.resend-domain-unverified`](../ops.resend-domain-unverified.md) | App transactional From via Resend (`send.` + DKIM) |
| [`ops.brand-mailbox`](../ops.brand-mailbox.md) | Human mailbox send+receive + replace Cornell `contactEmail` |

Historical body retained below for context.

---

## Intent (locked)

**Remove the personal email.** Public contact and any other Buzz-facing addresses
must be **company-domain** (`*@bringthebuzzover.com`) only — not
`mc3237@cornell.edu` or other personal/edu inboxes. Transactional From stays
`noreply@bringthebuzzover.com` via Resend. Do not archive while the SPA still
shows a personal contact address.

## Two systems (do not conflate)

| System | Purpose | Blocks the other? |
| ------ | ------- | ----------------- |
| **Outbound (autosend)** | Resend → verify, invite, deny/undeny, Notify Me, password reset | **No** — uses `send.` + DKIM; does not need apex human MX |
| **Inbound (humans)** | People mail `contact@` / `hello@` / support | **No** — apex MX; does not unblock Resend by itself |

Railway hosts the app only — **irrelevant for inbound mailboxes**.

## Ownership map (verified 2026-08-11)

| Layer | Where | Account |
| ----- | ----- | ------- |
| Registrar | Hostinger | Melissa — domain Active, expires 2026-12-21; NS → Cloudflare |
| Authoritative DNS | Cloudflare zone `9103e4c774707bf5b2f17fbb9d9144cf` | Lawrence — Free; NS `felipe` / `melody` |
| App hosts | Railway (`www` / `api`) | Lawrence |
| Transactional send | Resend (`RESEND_API_KEY` on api + crons) | Buzz ops — **sending domain not verified** |
| Human inbox | **None** on brand domain | Contact = `mc3237@cornell.edu` |

Hostinger DNS zone empty (cleared after CF NS flip). Hostinger mail orders = 0;
no websites. Do **not** recreate www/api/apex or put MX on Hostinger DNS.

## What exists today

| Address / path | Role | Reality |
| -------------- | ---- | ------- |
| `Buzz <noreply@bringthebuzzover.com>` | Resend `from` (`emailFrom`) | Unverified domain; no Resend DNS in CF → off-dev sends fail in practice |
| `mc3237@cornell.edu` | Public contact (`contactEmail`) | **To remove** — interim personal Cornell |
| `*@bringthebuzzover.com` inbound | Support / hello / contact | **No apex MX** → undeliverable |

Code: From loaded from [`backend/brand_emails.json`](../../backend/brand_emails.json)
([`backend/app/brand_emails.py`](../../backend/app/brand_emails.py)); dispatch in
[`backend/app/services/email.py`](../../backend/app/services/email.py). Dev mode
console-logs and skips Resend.

## Outbound — make autosend work

**Prereqs**

1. Resend Domains UI → add `bringthebuzzover.com` → copy **exact** DNS values.
2. Publish in **Cloudflare** (DNS-only; do not orange-cloud carelessly):
   - `TXT` `resend._domainkey…` (DKIM)
   - `TXT` on `send` (SPF)
   - `MX` on `send` (return-path / feedback — required by Resend, not apex human MX)
   - Optional later: `_dmarc` TXT
3. Wait until Resend shows **Verified**.
4. Confirm `RESEND_API_KEY` on Railway **api** + **cron-notify-reminders** (and env
   parity crons). `FRONTEND_URL` = `https://www.bringthebuzzover.com`.

**Sources:** [Resend add a domain](https://resend.com/docs/add-a-domain),
[verify troubleshooting](https://resend.com/docs/knowledge-base/what-if-my-domain-is-not-verifying)
(DKIM + SPF + MX on `send.`). Repo checklist:
[`DEPLOYMENT.md`](../../DEPLOYMENT.md) Resend § (wording historically said “DKIM/SPF”
only — incomplete vs current Resend docs).

**Resend receiving:** product can receive inbound via separate MX +
`email.received` webhooks + [retrieve received email API](https://resend.com/docs/api-reference/emails/retrieve-received-email).
Buzz is **send-only** today. Enabling Resend Receiving on **apex** would fight a
human inbox MX — avoid for contact; subdomain only if we ever want API ingest.

**How to test outbound**

| Where | How |
| ----- | --- |
| Local | `ENVIRONMENT=development` → links in API logs; no Resend (`email.py`) |
| Unit | `backend/tests/test_email.py`, `test_brand_emails.py` (mocked httpx) |
| Prod | After Verified: one controlled trigger (invite/verify yourself) → log
`Email dispatched: … resend_id=` + Resend dashboard + destination inbox |
| Caution | Notify Me cron `*/5` can flush a backlog; don’t blast deny/notify. No
send ledger yet ([`ops.email-ledger`](../ops.email-ledger.md)) |

## Inbound — company addresses (pick one)

Public/UX addresses must be `@bringthebuzzover.com`. DNS SOT = Cloudflare.

| Option | What you get | Human access | Deep-link webmail? | Message-read API for Buzz admin? | Who / cost / effort |
| ------ | ------------ | ------------ | ------------------ | -------------------------------- | ------------------- |
| **Cloudflare Email Routing** | Forward-only to personal destination; **public** addr still company | Destination Gmail/etc. (no CF webmail) | No CF inbox URL | **No** (rules API / Workers at receive time only) | Lawrence; free; ~hours |
| **Google Workspace** | Real mailbox | [mail.google.com](https://mail.google.com) | Yes | Yes — Gmail API (weeks+, OAuth, PRODUCT ask) | Buy seats; Lawrence DNS |
| **Microsoft 365** | Real mailbox | [outlook.office.com/mail](https://outlook.office.com/mail) | Yes | Yes — Graph (same class as Gmail) | Buy seats; Lawrence DNS |
| **Zoho Mail** (Lite/Free) | Real mailbox, cheaper suite-like | [mail.zoho.com](https://mail.zoho.com) | Yes | Zoho Mail API exists | Low $; Lawrence DNS |
| **Hostinger Email** | Real mailbox | [mail.hostinger.com](https://mail.hostinger.com) | Yes | No useful inbox-read API for Buzz | **Melissa buys** order; Lawrence publishes MX on CF |
| **ImprovMX** | Forward-only | Destination only | No | No | Redundant vs CF Routing here |
| **Resend Receiving (apex)** | API ingest | Not a support inbox | Dashboard / app | Yes — but **steals apex MX** | Avoid for contact |

**SPF note:** Resend SPF lives on `send.`; apex SPF belongs to the inbound/
human-send provider. Merge `include:`s on apex only if humans also **send as**
`@bringthebuzzover.com` from that provider (lookup limit ≤10).

### RACI (Cloudflare stays DNS SOT)

| Task | CF Email Routing | Google / Zoho / M365 | Hostinger Email |
| ---- | ---------------- | -------------------- | --------------- |
| Buy / subscribe | — | Ops signs up | **Melissa** |
| Enable / create addresses | **Lawrence** (CF UI or MCP with OK) | Ops admin console | Melissa / Hostinger MCP after order |
| Publish MX (+ TXT) on Cloudflare | **Lawrence** | **Lawrence** | **Lawrence** (not Hostinger DNS) |
| Receive test → flip `contactEmail` | Lawrence | Ops + Lawrence | Melissa + Lawrence |

Cloudflare MCP can CRUD DNS and Email Routing APIs; Hostinger mailbox MCP needs a
mail **order** first (`mail_listOrdersV1` empty today). Mutate only with explicit OK
([`AGENTS.md`](../../AGENTS.md) MCP).

## Cutover order (locked sequence)

1. **Autosend:** Resend DNS on `send.` / DKIM → Verified → one prod send test.  
2. **Inbound:** pick provider → apex MX in CF → send test to `contact@…` (or chosen addr).  
3. Set `brand_emails.json` `contactEmail` → deploy → remove Cornell (grep clean).  
4. Update [`DEPLOYMENT.md`](../../DEPLOYMENT.md) Resend checkbox + inbox ownership.  
5. **Optional later:** admin “Open inbox” link-out (hours).  
6. **Not in this gap:** in-app admin inbox.

Steps 1 and 2 can run in parallel (different DNS names). Step 3 requires step 2
receive-proof. Do not flip contact before mail delivers.

## Admin panel (later — not archive-blocking)

| Idea | Feasible? | Complexity |
| ---- | --------- | ---------- |
| **Open inbox** `<a target="_blank">` in [`AdminSidebar.tsx`](../../frontend/src/components/admin/AdminSidebar.tsx) (near Sign out) | Yes — no `/admin/settings` today; no admin external-link pattern (copy marketing `noopener`) | Hours; config URL to Gmail/Outlook/Hostinger/Zoho |
| Embed provider webmail iframe | Usually blocked (`X-Frame-Options`) | Dead end |
| In-app list/read messages | Needs Gmail/Graph/Zoho (or Resend Receiving on a subdomain) + OAuth + encrypted tokens + `/api/admin/*` proxy + SPA | Weeks–months; **PRODUCT/UX ask** ([`AGENTS.md`](../../AGENTS.md) hard stop) |

No admin inbox in [`PRODUCT.md`](../../PRODUCT.md). Link-out is internal ops chrome;
in-app mail client is a product fork.

## Coupling

- [`ops.email-ledger`](../ops.email-ledger.md) — send honesty/ledger; does not create inboxes or verify Resend.
- [`DEPLOYMENT.md`](../../DEPLOYMENT.md) — Resend + Domain/DNS ownership.
- [`AGENTS.md`](../../AGENTS.md) — Cloudflare / Hostinger MCP mutate rules; prefer direct tools over `railway-agent`.

## Probes (read-only)

```bash
dig @1.1.1.1 NS bringthebuzzover.com +short
dig @1.1.1.1 MX bringthebuzzover.com +short          # apex inbound
dig @1.1.1.1 MX send.bringthebuzzover.com +short     # Resend return-path
dig @1.1.1.1 TXT resend._domainkey.bringthebuzzover.com +short
dig @1.1.1.1 TXT send.bringthebuzzover.com +short
# Cloudflare MCP execute: list zone DNS
# Hostinger MCP: mail_listOrdersV1
# Repo: rg -n 'mc3237@cornell\.edu|contactEmail' backend/brand_emails.json frontend/
```

## Sources

| Topic | Link / path |
| ----- | ----------- |
| Resend send domain | https://resend.com/docs/add-a-domain |
| Resend verify / `send.` MX | https://resend.com/docs/knowledge-base/what-if-my-domain-is-not-verifying |
| Resend receiving | https://resend.com/docs/dashboard/receiving/ |
| Resend retrieve received | https://resend.com/docs/api-reference/emails/retrieve-received-email |
| Cloudflare Email Routing | https://developers.cloudflare.com/email-routing/ |
| CF Routing API (rules, not inbox body) | https://developers.cloudflare.com/api/resources/email_routing/ |
| Deploy / DNS ownership | [`DEPLOYMENT.md`](../../DEPLOYMENT.md) |
| From / contact SOT | [`backend/brand_emails.json`](../../backend/brand_emails.json) |
| Send path | [`backend/app/services/email.py`](../../backend/app/services/email.py) |
| Admin chrome | [`frontend/src/components/admin/AdminSidebar.tsx`](../../frontend/src/components/admin/AdminSidebar.tsx) |
