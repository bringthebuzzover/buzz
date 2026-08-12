---
id: ops.brand-mailbox
title: No company mailbox — need send+receive @bringthebuzzover.com; Cornell contact still public
kind: ops
severity: P1
status: ops
surface: deploy
evidence:
  - path: backend/brand_emails.json
    note: contactEmail still mc3237@cornell.edu; SPA imports via @brandEmails (CRACO)
  - path: frontend/craco.config.js
    note: "@brandEmails" → ../backend/brand_emails.json (webpack + Jest); no tsconfig paths
  - path: frontend/src/data/siteIdentity.ts
    note: contact.email = brandEmails.contactEmail (Contact modal + legal pages)
  - path: frontend/src/data/siteIdentity.test.ts
    note: Hard-codes Cornell expectation — must update on cutover
  - path: DEPLOYMENT.md
    note: Domain/DNS ownership map; no inbox ownership section yet
  - path: frontend/src/components/admin/AdminSidebar.tsx
    note: no Settings page; natural home for optional Open inbox link-out later
repro: |
  dig @1.1.1.1 NS bringthebuzzover.com → felipe/melody
  dig @1.1.1.1 MX bringthebuzzover.com → empty (apex)
  dig @1.1.1.1 TXT bringthebuzzover.com → no human SPF / _dmarc
  dig @1.1.1.1 MX/TXT send.bringthebuzzover.com → Resend SES SPF+MX (leave alone)
  Hostinger mail_listOrdersV1 → total 0 (no mail order; MCP cannot purchase)
  Cloudflare Email Routing → enabled false / status unconfigured (2026-08-11)
  rg mc3237@cornell.edu → brand_emails.json + siteIdentity.test.ts (keep colleges.edu / test scripts)
fix_when: |
  Google Workspace Business Starter org live for bringthebuzzover.com.
  A real *@bringthebuzzover.com mailbox exists that can **receive and send**
  (Gmail webmail — not forward-only).
  Apex MX (+ Google TXT/SPF/DKIM as required) published in Cloudflare only.
  Receive-proof: external → company addr visible in mail.google.com.
  Send-as-proof: company mailbox → external; recipient From = company address.
  brand_emails.json contactEmail flipped; siteIdentity.test.ts updated; Cornell
  gone from brand contact paths (rg clean excluding gaps/ + colleges.edu + test orgs).
  Frontend redeployed so build-time @brandEmails import serves new mailto.
  DEPLOYMENT.md inbox ownership notes updated (provider, address, webmail URL, admin).
  Optional (not required): admin sidebar Open inbox link-out; Cursor Gmail MCP.
  Out of archive scope: in-app admin inbox (PRODUCT ask + OAuth weeks).
  Out of scope: Resend transactional domain (archived sibling).
---

# Company mailbox (send + receive) — Google Workspace

Split from [`ops.brand-domain-email-unset`](archive/ops.brand-domain-email-unset.md)
(2026-08-11). Sibling (done):
[`ops.resend-domain-unverified`](archive/ops.resend-domain-unverified.md)
(app autosend via Resend on `send.` — verified 2026-08-11).

Parked under `follow-ups` in [`CLUSTERS.md`](CLUSTERS.md) — do not auto-execute;
un-park only when named explicitly. **Provider is locked** (below); remaining
human decisions still block cutover.

## Intent (locked)

**Remove the personal email.** Public contact and other Buzz-facing human
addresses must be **company-domain** (`*@bringthebuzzover.com`) only — not
`mc3237@cornell.edu`. Provision a **full mailbox** that can **receive and send**
as that address (not Cloudflare Email Routing / ImprovMX forward-only).

App transactional From (`noreply@` via Resend) is a **different** system —
leave `send.` / `resend._domainkey` alone. Do not archive this gap while the SPA
still shows a personal contact address.

## Locked decisions (2026-08-11)

| Decision | Lock |
| -------- | ---- |
| **Provider** | **Google Workspace Business Starter** (or current equivalent entry tier) |
| **DNS SOT** | Cloudflare only (Hostinger = registrar; never publish MX there) |
| **Webmail** | https://mail.google.com |
| **Admin** | https://admin.google.com |
| **Resend** | Stays on `send.` for app mail; **do not** enable Resend Receiving on apex |
| **CF Email Routing** | Stay off (would fight Google MX) |
| **Agent assist** | Official **Gmail MCP** after mailbox exists (draft/triage; human sends) |
| **In-app inbox** | Still out of scope (PRODUCT ask) |

### Still open (required before cutover)

| Decision | Notes |
| -------- | ----- |
| **Local-part** | Recommend `contact@` as public SOT; aliases (`hello@`, `support@`) free on same user (≤30) |
| **Billing owner** | Who pays the Workspace org / attaches payment method for trial → paid |
| **First Super Admin** | Same as `contact@` (one seat) vs separate `admin@` + `contact@` seat |
| **Display name** | Keep “Melissa Chowdhury” in Contact modal or switch |
| **Aliases** | Which alternate addresses (optional) |

Do **not** flip `contactEmail` until receive + send-as proofs pass.

## Why Google (decision log)

- Full send+receive webmail (archive criteria).
- DNS stays on Cloudflare — Google only needs apex MX + verification/auth TXT.
- Clean split with Resend already on `send.` (no MX conflict if Receiving stays off).
- Official Gmail MCP (Developer Preview) fits agent triage/draft without putting
  send in the tool surface; Resend MCP stays for transactional debug.
- Rejected for this gap: forward-only, Resend-as-inbox, Hostinger Email (higher
  Melissa coordination; MCP cannot purchase).

## Ownership (re-verified 2026-08-11; dig spot-check same day)

| Layer | Where | Account |
| ----- | ----- | ------- |
| Registrar | Hostinger | Melissa — Active, expires 2026-12-21; NS → Cloudflare |
| Authoritative DNS | Cloudflare zone `9103e4c774707bf5b2f17fbb9d9144cf` | Lawrence — Free; NS `felipe` / `melody` |
| Transactional send | Resend domain + Railway `RESEND_API_KEY` | Verified on `send.`; From `noreply@…` |
| Human inbox | **None yet** | Contact = `mc3237@cornell.edu` |

Live probes (leave Resend rows unchanged during cutover):

| Name | Type | Today |
| ---- | ---- | ----- |
| apex | MX | empty |
| apex | SPF / `_dmarc` | none |
| `send` | TXT SPF | `include:amazonses.com` |
| `send` | MX | Amazon SES feedback |
| `resend._domainkey` | TXT | Resend DKIM |

## Independent of Resend autosend

| | This gap | Resend (archived sibling) |
| --- | --- | --- |
| Purpose | Humans ↔ company mailbox | App → verify/invite/deny/Notify/reset |
| DNS | Apex MX + Google TXT/SPF/DKIM | `send.` SPF/MX + `resend._domainkey` |
| Blocks the other? | **No** | **No** |

Railway hosts the app only — **irrelevant for mailboxes**.

## SPA / contact SOT (code)

| Piece | Path |
| ----- | ---- |
| JSON SOT | [`backend/brand_emails.json`](../backend/brand_emails.json) |
| Alias | [`frontend/craco.config.js`](../frontend/craco.config.js) `@brandEmails` (webpack + Jest; **no** `tsconfig` paths) |
| Bridge | [`frontend/src/data/siteIdentity.ts`](../frontend/src/data/siteIdentity.ts) → `contact.email` |
| UI | Contact modal; Privacy; Terms; Data deletion (mailto) |
| Backend `CONTACT_EMAIL` | Loaded in `brand_emails.py` / tested — **not used at runtime** by API services (only `EMAIL_FROM` → Resend) |

**Cornell literals to change on cutover:** `brand_emails.json`, `siteIdentity.test.ts`.
**Keep:** `frontend/src/data/colleges.ts` (`cornell.edu` college domain), test-org
scripts using `.edu` addresses.

## MCPs used for this gap

| MCP | Role | Mutate? |
| --- | ---- | ------- |
| **Cloudflare** (`user-cloudflare` / bindings) | Read DNS; later publish Google MX/TXT with explicit OK | Yes only with OK |
| **Hostinger** | Registrar / NS check; mail orders stay unused | No mail purchase via MCP |
| **Resend** (`plugin-resend-resend`) | Confirm domain Verified; **never** enable Receiving on apex | Domain mutate = hard stop |
| **Gmail** (official, post-mailbox) | Cursor agent triage/draft on `contact@` | User MCP only — not repo |
| Railway / Meta | Irrelevant to mailbox cutover | — |

Secrets stay in **user** `~/.cursor/mcp.json` / env — never commit repo
`.cursor/mcp.json` (see [`AGENTS.md`](../AGENTS.md)).

### Official Gmail MCP (after Workspace is live)

| Item | Value |
| ---- | ----- |
| Endpoint | `https://gmailmcp.googleapis.com/mcp/v1` |
| Status | Developer Preview — enroll at [Workspace preview](https://developers.google.com/workspace/preview) with Workspace identity + GCP project |
| Docs | [Configure Gmail MCP](https://developers.google.com/workspace/gmail/api/guides/configure-mcp-server) · [Tool reference](https://developers.google.com/workspace/gmail/api/reference/mcp) |
| Enable | `gmail.googleapis.com` + `gmailmcp.googleapis.com` |
| Scopes | `https://www.googleapis.com/auth/gmail.readonly` + `https://www.googleapis.com/auth/gmail.compose` |
| Tools | `search_threads`, `get_thread`, `create_draft`, `list_drafts`, `list_labels`, label/unlabel message/thread — **no send tool** |
| Cursor redirects | Desktop `http://localhost:8787/callback`; Agents `https://www.cursor.com/agents/mcp/oauth/callback` ([Cursor MCP](https://cursor.com/docs/mcp)) |
| Config home | **User** `~/.cursor/mcp.json` with `url` + `auth.CLIENT_ID` / `CLIENT_SECRET` / `scopes` (env interpolation) |

Example shape (secrets via env — do not commit):

```json
{
  "mcpServers": {
    "gmail": {
      "url": "https://gmailmcp.googleapis.com/mcp/v1",
      "auth": {
        "CLIENT_ID": "${env:GOOGLE_GMAIL_MCP_CLIENT_ID}",
        "CLIENT_SECRET": "${env:GOOGLE_GMAIL_MCP_CLIENT_SECRET}",
        "scopes": [
          "https://www.googleapis.com/auth/gmail.readonly",
          "https://www.googleapis.com/auth/gmail.compose"
        ]
      }
    }
  }
}
```

**Security posture:** agents draft + label; humans send from Gmail. Treat inbound mail
as untrusted (indirect prompt injection — Google’s own warning). Prefer Internal
OAuth audience when the Workspace org allows it. Skip Drive/Calendar MCP until
there is a concrete job.

**Fallback if preview allowlist is slow:** community
[`taylorwilsdon/google_workspace_mcp`](https://github.com/taylorwilsdon/google_workspace_mcp)
with `--tools gmail` and send tools disabled / read-only until official MCP works.
Do not default to community servers that expose send for the public contact inbox.

Gmail MCP is **not** archive-blocking for this gap (mailbox + SPA cutover is).

## Google Workspace cutover runbook

Mutate Cloudflare / Google billing only with explicit OK ([`AGENTS.md`](../AGENTS.md)).

### A. Prep (no DNS yet)

1. Name billing owner + local-part (+ whether first admin = that mailbox).
2. Sign up [Google Workspace](https://workspace.google.com/) → Business Starter →
   **I have a domain** → `bringthebuzzover.com` (do not buy a new domain from Google).
3. Complete payment method / start trial ([trial help](https://support.google.com/a/answer/53926)).
4. Confirm NS still Cloudflare: `dig NS bringthebuzzover.com` → `felipe` / `melody`.
5. Snapshot Resend records (must stay): `TXT`/`MX` on `send`, `TXT` `resend._domainkey`.

### B. Verify domain (Cloudflare)

6. Admin → Account → Domains → Manage domains → copy
   `google-site-verification=…` ([TXT verify](https://support.google.com/a/answer/7011689)).
7. Cloudflare DNS → TXT `@` = that value (DNS-only).
8. Confirm Verified in Admin.

### C. Mailbox before MX

9. Ensure primary user exists ([add user](https://support.google.com/a/answer/33310)) and
   can sign in once Gmail is live ([avoid empty MX](https://support.google.com/a/answer/45679)).
10. Optional: aliases on that user ([aliases](https://support.google.com/a/answer/33327)).

### D. Apex MX → Google

11. Cloudflare → **only** MX `@` priority `1` → `smtp.google.com`
    ([MX setup](https://support.google.com/a/answer/33353)). Remove any other apex MX.
12. Admin → **Activate Gmail** for the domain.
13. Receive-proof: external → company addr in https://mail.google.com
14. Send-as-proof: company → external; From = company address.

### E. Auth records (apex Google; leave `send.` alone)

15. Apex SPF TXT `@` (single SPF on apex):

    ```text
    v=spf1 include:_spf.google.com ~all
    ```

    Do **not** put `include:amazonses.com` on apex — Resend return-path SPF is on
    `send.` ([Google SPF](https://support.google.com/a/answer/33786)).
16. After Gmail settles (Google often suggests waiting before DKIM): Admin →
    Gmail → Authenticate email → generate DKIM → publish `google._domainkey` on
    Cloudflare → Start authentication ([DKIM](https://support.google.com/a/answer/174126)).
    Coexists with `resend._domainkey` (different selectors).
17. Optional (not archive-blocking): `_dmarc` with `p=none` first
    ([DMARC](https://support.google.com/a/answer/2466580)). Omit `aspf`/`adkim`
    (defaults relaxed) or set `aspf=r`; avoid `aspf=s` until reviewed — Resend
    MAIL FROM is on `send.` (apex DKIM via `resend._domainkey` may still align,
    but don’t tighten yet).
18. Re-check Resend still Verified; spot-check one Buzz transactional send.

### F. App cutover (Buzz)

19. Flip `backend/brand_emails.json` `contactEmail` → company address; update
    `siteIdentity.test.ts`; deploy frontend.
20. Update [`DEPLOYMENT.md`](../DEPLOYMENT.md) inbox ownership (Workspace, address,
    webmail, admin console, who pays/admins).
21. Optional later: AdminSidebar “Open inbox” → `https://mail.google.com`.
22. Optional later: enroll Gmail MCP + user Cursor config (above).

### G. Verify commands

```bash
dig @1.1.1.1 TXT bringthebuzzover.com +short
dig @1.1.1.1 MX bringthebuzzover.com +short   # expect: 1 smtp.google.com.
dig @1.1.1.1 TXT send.bringthebuzzover.com +short
dig @1.1.1.1 MX send.bringthebuzzover.com +short
dig @1.1.1.1 TXT google._domainkey.bringthebuzzover.com +short
dig @1.1.1.1 TXT _dmarc.bringthebuzzover.com +short
```

### RACI

| Task | Who |
| ---- | --- |
| Buy Workspace / billing | Named billing owner |
| Create users / aliases | Workspace Super Admin |
| Publish MX/TXT on Cloudflare | Lawrence (+ explicit OK) |
| Receive + send-as proof → flip `contactEmail` | Ops + Lawrence |
| Gmail MCP OAuth (user Cursor) | Ops (local secrets) |

## Cutover risks

- Enabling **CF Email Routing** publishes CF MX → fights Google MX.
- **Resend Receiving on apex** same fight
  ([Resend KB](https://resend.com/docs/knowledge-base/how-do-i-avoid-conflicting-with-my-mx-records)).
- Publishing MX on **Hostinger DNS** is wrong (NS → CF; zone cleared).
- Dual / blended apex SPF (Google + Amazon SES) — unnecessary and brittle.
- Touching `send` / `resend._domainkey` during mailbox cutover breaks Resend.
- Orange-cloud mail-related targets — MX must be DNS-only
  ([CF email troubleshooting](https://developers.cloudflare.com/dns/troubleshooting/email-issues/)).
- Do not orange-cloud `www`/`api` (Railway TLS).
- Apex proxied dummy `A` + redirect can coexist with MX — don’t “fix mail” by
  flipping apex proxy/redirect.
- Do not flip `contactEmail` before proofs.

## Repo checklist (after proofs)

```text
[ ] backend/brand_emails.json contactEmail → company address
[ ] frontend/src/data/siteIdentity.test.ts expectation updated
[ ] rg -n 'mc3237@cornell\.edu' --glob '!gaps/**' → only intentional non-contact hits
[ ] Frontend redeployed (build-time JSON import)
[ ] Smoke Contact modal + Data Deletion mailto
[ ] DEPLOYMENT.md inbox ownership row
[ ] Optional: AdminSidebar Open inbox → mail.google.com
[ ] Optional: user Gmail MCP connected as mailbox user
```

## Admin panel (later — not archive-blocking)

| Idea | Feasible? | Complexity |
| ---- | --------- | ---------- |
| **Open inbox** link-out near Sign out | Yes | Hours |
| Embed Gmail iframe | Usually blocked | Dead end |
| In-app list/read | OAuth + proxy + SPA | Weeks–months; PRODUCT hard stop |
| Cursor Gmail MCP (draft/triage) | Yes after preview enroll | Hours–days |

PRODUCT.md has **no** admin inbox / public mailbox requirement.

## Coupling

- [`ops.resend-domain-unverified`](archive/ops.resend-domain-unverified.md) — **archived**; parallel DNS OK.
- [`ops.email-ledger`](ops.email-ledger.md) — app send honesty; does not create mailboxes.
- Soft: deny email copy “reply to this email” has no Reply-To until a human
  mailbox / Reply-To policy exists (optional follow after this gap).

## Probes (read-only)

```bash
dig @1.1.1.1 NS bringthebuzzover.com +short
dig @1.1.1.1 MX bringthebuzzover.com +short
dig @1.1.1.1 TXT bringthebuzzover.com +short
dig @1.1.1.1 TXT _dmarc.bringthebuzzover.com +short
# Sibling untouched:
dig @1.1.1.1 MX send.bringthebuzzover.com +short
dig @1.1.1.1 TXT send.bringthebuzzover.com +short
# Cloudflare MCP: email routing still disabled; DNS list
# Resend MCP: domain Verified; Receiving off on apex
rg -n 'mc3237@cornell\.edu' --glob '!gaps/**' --glob '!**/archive/**'
# After cutover unit: cd frontend && npm test -- --watchAll=false siteIdentity.test.ts
```

## Sources

| Topic | Link / path |
| ----- | ----------- |
| Workspace trial | https://support.google.com/a/answer/53926 |
| Domain TXT verify | https://support.google.com/a/answer/7011689 |
| MX (`smtp.google.com`) | https://support.google.com/a/answer/33353 |
| Avoid MX cutover issues | https://support.google.com/a/answer/45679 |
| Add user / aliases | https://support.google.com/a/answer/33310 · https://support.google.com/a/answer/33327 |
| SPF / DKIM / DMARC | https://support.google.com/a/answer/33786 · https://support.google.com/a/answer/174126 · https://support.google.com/a/answer/2466580 |
| Gmail MCP configure | https://developers.google.com/workspace/gmail/api/guides/configure-mcp-server |
| Workspace Developer Preview | https://developers.google.com/workspace/preview |
| Cursor MCP (static OAuth + redirects) | https://cursor.com/docs/mcp |
| Resend vs mailbox MX | https://resend.com/docs/knowledge-base/how-do-i-avoid-conflicting-with-my-mx-records |
| Cloudflare email / proxy | https://developers.cloudflare.com/dns/troubleshooting/email-issues/ |
| Deploy / DNS ownership | [`DEPLOYMENT.md`](../DEPLOYMENT.md) |
| Contact SOT | [`backend/brand_emails.json`](../backend/brand_emails.json) |
| Alias | [`frontend/craco.config.js`](../frontend/craco.config.js) |
| Admin chrome | [`frontend/src/components/admin/AdminSidebar.tsx`](../frontend/src/components/admin/AdminSidebar.tsx) |
