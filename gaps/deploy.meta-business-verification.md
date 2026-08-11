---
id: deploy.meta-business-verification
title: Meta Business Verification not completed — blocks Advanced Access / public IG login
kind: ops
severity: P1
status: ops
surface: deploy
evidence:
  - path: META.md
    note: §E Business Verification required for Advanced Access; A–D done 2026-08-11
  - path: gaps/archive/deploy.meta-brand-url-cutover.md
    note: Hosts §C archived; launch residual was §E→F→G with no living gap until this file
  - path: gaps/CLUSTERS.md
    note: Cluster meta-business-verification (parked); human Meta dashboard only
repro: |
  Meta MCP (BUZZ app 1589568552810678), 2026-08-11:
  app_review requirements → business_verification_passes: false
  privileges → [] (no Advanced Access)
  submission_status → NO_SUBMISSION
  Pilot testers can still IG-login (Standard Access). Non-tester public orgs cannot
  be granted Advanced Access until a verified Business is linked.
fix_when: |
  BUZZ app is connected to a Meta Business (business portfolio) that has completed
  Business Verification. Meta MCP app_review requirements shows
  business_verification_passes: true (or App Dashboard Settings → Basic →
  Verification shows Verified next to the Business name).
  Out of archive scope: App Review / Advanced Access submission (§F) and public
  login without testers (§G) — file or track separately when started.
---

# Meta Business Verification (§E)

Independent of Hosts cutover (`deploy.meta-brand-url-cutover`, archived).
Human Meta dashboard / Business Manager only — agents verify via MCP; do not
mutate Meta without explicit OK.

## Official path

Docs: [Business Verification](https://developers.facebook.com/docs/development/release/business-verification/),
[documents](https://www.facebook.com/business/help/2058515294227817).

1. **App Dashboard** → [BUZZ](https://developers.facebook.com/apps/1589568552810678/)
   → **App settings → Basic → Verification** → **Start Verification**
   (or **+ Business Verification**). Link or create a **business portfolio**.
   Newer use-case UI: left nav **Review → Verification**.
2. **Business Manager** ([business.facebook.com](https://business.facebook.com/)) —
   Business Admin completes verification (tax / registration / utility docs).
3. Return to Basic → Verification should show **Verified**.

| Role | Can do |
| ---- | ------ |
| App Admin | Connect app ↔ Business |
| Business Admin | Finish verification in Business Manager |

## Why required

| Goal | Need BV? |
| ---- | -------- |
| Pilot (Instagram Testers / app roles) | No |
| Public orgs (Advanced Access) | **Yes** |

Buzz needs Advanced Access for `instagram_business_basic` +
`instagram_business_manage_insights` before non-tester campus orgs can log in.

## Verify (read-only)

```text
Meta MCP → devtools_app_review action=requirements app_id=1589568552810678
→ app_settings_valid.business_verification_passes === true
```

Optional: `devtools_app` basic_settings (privacy already on www); privileges still
empty until App Review (§F) approves Advanced Access.
