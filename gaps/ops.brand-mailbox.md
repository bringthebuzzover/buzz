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
  Hostinger mail_listOrdersV1 → total 0 (no mail order; MCP cannot purchase)
  Cloudflare Email Routing → enabled false / status unconfigured (2026-08-11)
  rg mc3237@cornell.edu → brand_emails.json + siteIdentity.test.ts (keep colleges.edu / test scripts)
fix_when: |
  A real *@bringthebuzzover.com mailbox exists that can **receive and send**
  (provider webmail — not forward-only).
  Apex MX (+ provider TXT/SPF/DKIM as required) published in Cloudflare only.
  Receive-proof: external → company addr visible in that webmail.
  Send-as-proof: company mailbox → external; recipient From = company address.
  brand_emails.json contactEmail flipped; siteIdentity.test.ts updated; Cornell
  gone from brand contact paths (rg clean excluding gaps/ + colleges.edu + test orgs).
  Frontend redeployed so build-time @brandEmails import serves new mailto.
  DEPLOYMENT.md inbox ownership notes updated (provider, address, webmail URL, admin).
  Optional (not required): admin sidebar Open inbox link-out.
  Out of archive scope: in-app admin inbox (PRODUCT ask + OAuth weeks).
  Out of scope: Resend transactional domain → ops.resend-domain-unverified.
---

# Company mailbox (send + receive)

Split from [`ops.brand-domain-email-unset`](archive/ops.brand-domain-email-unset.md)
(2026-08-11). Sibling: [`ops.resend-domain-unverified`](ops.resend-domain-unverified.md)
(app autosend via Resend).

Parked under `follow-ups` in [`CLUSTERS.md`](CLUSTERS.md) — do not auto-execute;
un-park only when named explicitly.

## Intent (locked)

**Remove the personal email.** Public contact and other Buzz-facing human
addresses must be **company-domain** (`*@bringthebuzzover.com`) only — not
`mc3237@cornell.edu`. Provision a **full mailbox** that can **receive and send**
as that address (not Cloudflare Email Routing / ImprovMX forward-only).

App transactional From (`noreply@` via Resend) is a **different** system —
[`ops.resend-domain-unverified`](ops.resend-domain-unverified.md). Do not archive
this gap while the SPA still shows a personal contact address.

## Human decisions (required before cutover)

| Decision | Options / notes |
| -------- | --------------- |
| **Provider** | Google Workspace · M365 · Zoho · Hostinger Email |
| **Local-part** | e.g. `contact@` vs `hello@` / `support@` (one public SOT recommended) |
| **Billing owner** | Who pays Google/M365/Zoho org if not Hostinger? |
| **Hostinger path** | Melissa OK to buy mail order on her Hostinger account? |
| **Display name** | Keep “Melissa Chowdhury” in Contact modal (`siteIdentity.contact.primaryPersonName`) or switch? |
| **Timing vs Resend** | Parallel OK (different DNS) — order is ops preference only |

## Independent of Resend autosend

| | This gap | [`ops.resend-domain-unverified`](ops.resend-domain-unverified.md) |
| --- | --- | --- |
| Purpose | Humans ↔ company mailbox | App → verify/invite/deny/Notify/reset |
| DNS | Apex MX + provider records | `send.` + DKIM only |
| Blocks the other? | **No** | **No** |

Railway hosts the app only — **irrelevant for mailboxes**. DNS SOT remains
**Cloudflare** (never put MX on Hostinger’s empty zone).

## Ownership (re-verified 2026-08-11)

| Layer | Where | Account |
| ----- | ----- | ------- |
| Registrar | Hostinger | Melissa — Active, expires 2026-12-21; NS → Cloudflare |
| Authoritative DNS | Cloudflare zone `9103e4c774707bf5b2f17fbb9d9144cf` | Lawrence — Free; NS `felipe` / `melody` |
| Human inbox | **None** | Contact = `mc3237@cornell.edu` |

Hostinger DNS zone empty; mail orders = 0. MCP has **no purchase/create-order**
tool — Melissa buys in hPanel/billing first; then `mail_*` mailbox APIs work.

## SPA / contact SOT (code)

| Piece | Path |
| ----- | ---- |
| JSON SOT | [`backend/brand_emails.json`](../backend/brand_emails.json) |
| Alias | [`frontend/craco.config.js`](../frontend/craco.config.js) `@brandEmails` (webpack + Jest; **no** `tsconfig` paths) |
| Bridge | [`frontend/src/data/siteIdentity.ts`](../frontend/src/data/siteIdentity.ts) → `contact.email` |
| UI | Contact modal; Privacy; Terms; Data deletion (mailto) |
| Entry | Header/Footer open Contact modal (no hardcoded address) |
| Backend `CONTACT_EMAIL` | Loaded in `brand_emails.py` / tested — **not used at runtime** by API services (only `EMAIL_FROM` → Resend) |

**Cornell literals to change on cutover:** `brand_emails.json`, `siteIdentity.test.ts`.
**Keep:** `frontend/src/data/colleges.ts` (`cornell.edu` college domain), test-org
scripts using `.edu` addresses.

## Provider options (must be send + receive)

Forward-only (CF Email Routing, ImprovMX) does **not** meet archive criteria
(no native company send-as / no CF webmail). Resend Receiving on apex steals MX
and is not a support inbox — avoid.

| Option | Webmail | Who / cost | Notes |
| ------ | ------- | ---------- | ----- |
| **Google Workspace** | mail.google.com | Buy seats; name billing owner | Strong default; DNS on CF |
| **Microsoft 365** | outlook.office.com/mail | Buy seats; name billing owner | Same class as Google |
| **Zoho Mail** | mail.zoho.com | Low $; name billing owner | “Free” tiers have limits — verify eligibility |
| **Hostinger Email** | mail.hostinger.com | **Melissa** buys order; Lawrence MX on CF | MCP after order only; ignore Hostinger “auto DNS” |

Prefer lowest coordination cost if Melissa stays on Hostinger; otherwise pick a
suite ops will actually use daily. Do **not** pick a provider solely for future
in-app OAuth (PRODUCT hard stop).

### RACI (Cloudflare stays DNS SOT)

| Task | Google / Zoho / M365 | Hostinger Email |
| ---- | -------------------- | --------------- |
| Buy / subscribe | Named billing owner | **Melissa** (hPanel — not MCP) |
| Create mailbox addresses | Ops admin console | Melissa / Hostinger MCP after order |
| Publish MX (+ TXT) on Cloudflare | **Lawrence** (+ explicit OK) | **Lawrence** (not Hostinger DNS) |
| Receive + send-as proof → flip `contactEmail` | Ops + Lawrence | Melissa + Lawrence |

**SPF note:** Resend SPF stays on `send.` (sibling gap). Apex SPF belongs to the
mailbox provider for human send-as. Merge apex `include:`s only when that
provider requires them — do not copy Resend includes onto apex. SPF lookup ≤10.

Mutate Cloudflare / Hostinger only with explicit OK ([`AGENTS.md`](../AGENTS.md)).

## Cutover risks

- Enabling **CF Email Routing** publishes CF MX → fights human mailbox MX.
- **Resend Receiving on apex** same fight.
- Publishing MX on **Hostinger DNS** is wrong (NS → CF; zone cleared).
- Hostinger “auto DNS for email” → ignore; publish on Cloudflare.
- Do not orange-cloud `www`/`api` (Railway TLS). MX itself is not proxied.
- Apex proxied dummy `A` + redirect can coexist with MX — don’t “fix mail” by
  flipping apex proxy/redirect.
- After mailbox DKIM exists, optional `_dmarc` is nice-to-have (not archive-blocking
  if send-as already works).

## Cutover order (this gap)

1. Pick provider + local-part → create mailbox.
2. Publish apex MX (+ provider records) in Cloudflare.
3. Receive-proof (external → company addr in **provider webmail**) **and**
   send-as-proof (company → external; From = company).
4. Set `brand_emails.json` `contactEmail` → update `siteIdentity.test.ts` →
   deploy frontend → Cornell grep-clean (brand contact paths only).
5. Update [`DEPLOYMENT.md`](../DEPLOYMENT.md) inbox ownership (provider, address,
   webmail URL, who admins). Reminder: human MX on CF; Resend stays on `send.`;
   do not enable CF Routing / Resend Receiving on apex while human MX is live.
6. **Optional later:** admin “Open inbox” `<a target="_blank" rel="noopener noreferrer">`
   near Sign out in [`AdminSidebar.tsx`](../frontend/src/components/admin/AdminSidebar.tsx)
   (no admin external-link pattern today — copy SiteHeader). Needs provider URL.
7. **Not in this gap:** in-app admin inbox (Gmail/Graph/Zoho OAuth — PRODUCT ask).

Do not flip `contactEmail` before receive-proof.

### Repo checklist (after proofs)

```text
[ ] backend/brand_emails.json contactEmail → company address
[ ] frontend/src/data/siteIdentity.test.ts expectation updated
[ ] rg -n 'mc3237@cornell\.edu' --glob '!gaps/**' → only intentional non-contact hits
[ ] Frontend redeployed (build-time JSON import)
[ ] Smoke Contact modal + Data Deletion mailto
[ ] DEPLOYMENT.md inbox ownership row
```

## Admin panel (later — not archive-blocking)

| Idea | Feasible? | Complexity |
| ---- | --------- | ---------- |
| **Open inbox** link-out near Sign out | Yes | Hours |
| Embed provider webmail iframe | Usually blocked | Dead end |
| In-app list/read | OAuth + proxy + SPA | Weeks–months; PRODUCT hard stop |

PRODUCT.md has **no** admin inbox / public mailbox requirement.

## Coupling

- [`ops.resend-domain-unverified`](ops.resend-domain-unverified.md) — autosend; can ship in parallel.
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
# Hostinger MCP: mail_listOrdersV1 / mail_listMailboxesV1 (after order)
# Cloudflare MCP: email routing still disabled if using third-party MX; DNS list
rg -n 'mc3237@cornell\.edu' --glob '!gaps/**' --glob '!**/archive/**'
# After cutover unit: cd frontend && npm test -- --watchAll=false siteIdentity.test.ts
```

## Sources

| Topic | Link / path |
| ----- | ----------- |
| Cloudflare Email Routing (forward-only — insufficient alone) | https://developers.cloudflare.com/email-routing/ |
| Deploy / DNS ownership | [`DEPLOYMENT.md`](../DEPLOYMENT.md) |
| Contact SOT | [`backend/brand_emails.json`](../backend/brand_emails.json) |
| Alias | [`frontend/craco.config.js`](../frontend/craco.config.js) |
| Admin chrome | [`frontend/src/components/admin/AdminSidebar.tsx`](../frontend/src/components/admin/AdminSidebar.tsx) |
