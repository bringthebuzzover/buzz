---
id: ops.email-best-effort-no-ledger
title: Email false-success and one-shot burns (best-effort, no ledger)
kind: silent_loss
severity: P2
status: fixed
closed_in: 7b3ae53
surface: ops
evidence:
  - path: backend/app/services/email.py
    note: _dispatch never raises; logs warning/exception + optional resend_id; no DB row
  - path: backend/app/services/brands.py
    note: finalize denial emails after business flush; PRODUCT denial is email-only
  - path: backend/app/services/campaigns.py
    note: denied apps filtered from My Campaigns / detail 404 — no in-app denial channel
  - path: backend/app/services/onboarding.py
    note: mint EmailVerificationToken then send; UI claims re-sent; max-3 live tokens burn on failed dispatch
  - path: backend/app/jobs/notify_reminders.py
    note: stamps notify_me.sent_at after attempt — one-shot permanent miss if Resend failed
  - path: backend/app/services/password_reset.py
    note: always {ok:true}; mint-then-send with no delivery signal (OUT of v1)
  - path: PRODUCT.md
    note: §7.1 drop denial email-only; §6.3.1 / §11 Notify Me email-only
repro: |
  1. Off-dev with RESEND_API_KEY set but unverified domain / bad EMAIL_FROM / revoked key
     (empty key fails boot — not a running misconfig).
  2. Brand finalizes with ≥1 denied applicant → API success, denied_count > 0.
  3. Org: no My Campaigns row; no denial email; logs Email send failed; no Buzz send row.
  Verification variant: resend 3× with Resend down → UI “re-sent” → 4th hits MAX_VERIFICATION_ATTEMPTS.
  Notify variant: due reminder with Resend down → sent_at set → never retried.
fix_when: |
  Close condition is false-success / one-shot burns — not “we shipped a ledger.”
  `_dispatch` (and v1 send wrappers) return bool: true only on provider accept
  (HTTP 2xx / Resend id path) or intentional development console success; false
  on unset-key / HTTP error / exception — still never raises.

  Verification — resend + change-email: on false, delete/invalidate the
  just-minted live token (no max-3 burn); API raises `EMAIL_SEND_FAILED`
  (HTTP 502 or 503); SPA must not claim “re-sent” / “sent to …” (branch on
  `error.code`).

  Verification — initial onboarding submit (`submit_org_onboarding`): profile
  write still commits (user keeps `edu_email` + `pending_email_verification`,
  org row kept). On dispatch false: delete the just-minted token; response
  succeeds for profile creation with explicit `email_sent: false` (no
  success-sent copy). SPA lands on verify-await with a send-failure message +
  Resend CTA. User cannot re-submit profile (status left
  `pending_email_verification`); recovery is resend / change-email only. No
  orphan: profile is intentional; failed first mail is a verify-state resend
  path. SPA must honor wire `emailSent` (camelCase): OrgProfilePage /
  AwaitVerification / VerifyEmailPage must not claim “We sent…” / “re-sent”
  when false; prefer durable query/local flag over `location.state` alone
  (state is lost on hard refresh). Resend/change-email dispatch false →
  raise with stable code `EMAIL_SEND_FAILED` (HTTP 502 or 503); SPA branches
  on `ApiError.code`. Additive OpenAPI/FE types for `emailSent`.

  Notify Me: stamp `sent_at` only when dispatch returned true (failed rows stay
  eligible for the next job run).

  Drop-application denial: finalize still commits; each denial send may use the
  bool and emit a structured failure log (recipient + drop id) when false —
  structured log only; does **not** close org-visible silent loss (PRODUCT
  email-only + no My Campaigns row remains). No business rollback, no finalize
  response field, no in-app denial channel required for archive.

  Invite, password reset, platform approve/deny/undeny, `email_sends` ledger,
  admin email UI, health counters, Resend webhooks, and outbox/retry queues are
  not required to archive this gap. Archiving this gap does **not** ship a
  ledger.
---

## Problem

`_dispatch` swallows all failures so business writes never roll back on mail
errors. That coupling is intentional and correct — but providers can fail while
API/UI still report success, and some paths permanently consume a one-shot
(token slot / `notify_me.sent_at`). Failed sends exist only as stderr logs
(`Email send failed` / `RESEND_API_KEY unset`). There is also no email ledger
(out of v1 close — see follow-up pointer).

## Sharpest user harm

| Priority | Path | Why | v1 closes? |
|---|---|---|---|
| P0 | Verification (incl. resend + first signup) | UI says sent/re-sent; live tokens burn on failed dispatch | **Yes** — honesty + no burn + first-submit lock |
| P0 | Notify Me reminder | Email-only; `sent_at` after attempt → permanent miss | **Yes** — `sent_at` only on true |
| P0 (open) | Drop-application denial | PRODUCT email-only; My Campaigns hides denied | **No** — v1 log-only; org-visible silent loss remains |
| P1 | Brand invite | First approve can look done with no mail (admin resend exists) | No |
| P1 | Password reset | Always `{ok:true}` + success copy | No |
| P2 | Platform approve/deny/undeny | Often have in-app or admin recovery | No |

Denial stays a real product P0 harm, but **v1 does not claim to close it** for
the org. Notify Me is a **v1 close target** (one-shot permanent miss) even if
product severity was previously ranked P1.

## Pattern

Flush business write → await send → commit (email never raises). Token rows
(verification / invite / reset) can exist even when mail never left Buzz.

## Severity

Keep **P2** / `silent_loss`. Raise toward P1 only if launching without domain
verify / no log alerting. Surface is **ops** (request-path + one job), not
`jobs` alone. Fits `ops-deploy` as a larger follow-up — don’t boil the ocean.

## Recommended MVP

**Cheap wins only — no `email_sends` table.** Wire `_dispatch` → `bool`, honor
it on verification + Notify Me (close targets), plus denial structured logging
only. Keep best-effort (never roll back finalize / onboarding profile on
provider fail). Logs-only observability. Defer ledger, admin UI, health
counters, webhooks, outbox.

## Locked v1 fix

**Close alias:** archiving this gap means **false-success and one-shot burns are
fixed** for verification + Notify Me — **not** “we have an email ledger.”
Filename/id keep `…-no-ledger` as historical context; title reflects the close
story.

**Decision: cheap wins, not a ledger.**

| Choice | v1 lock |
|---|---|
| Ledger vs cheap wins | **Cheap wins only.** No `email_sends` migration/table. |
| Email kinds (behavior change) | **Close targets:** verification (`send_verification_email` — onboarding submit, resend, change-email), Notify Me (`send_drop_opening_reminder_email`). **Denial:** bool + structured log only (ops signal); does not close org-visible silent loss. Other kinds unchanged beyond shared `_dispatch` bool plumbing if convenient. |
| Observability | **Logs-only.** No admin email UI, no `/health` failure counter. |
| Notify `sent_at` | **Stamp only when dispatch returns true.** False → leave `sent_at` NULL so the next `notify_reminders` run retries. Chronic bounce spam is accepted for v1 (no N-strike). |
| Verification — resend / change-email | On false: **delete** just-minted live token; API **raises** `EMAIL_SEND_FAILED` (502/503); SPA must not claim sent/re-sent (branch on `error.code`). Dev console path = true. |
| Verification — first signup (`submit_org_onboarding`) | On false: **keep** user (`edu_email`, `pending_email_verification`) + **keep** org row; **delete** just-minted token; return profile success with **`email_sent: false`** (`emailSent` on wire); SPA → verify-await + failure notice + Resend CTA (not “sent to …”); durable send-failure UX beyond `location.state`. **No re-submit** of profile; recovery = resend / change-email only. |
| Denial | Finalize **still commits**. Bool + structured log on false. **No** `denial_emails_failed` response field, no org in-app channel, no admin resend, no finalize rollback. Explicitly **does not** close org-visible silent loss. |

### Explicitly OUT of v1

- `email_sends` / any durable send ledger
- Resend delivery webhooks
- Outbox / queued retry / worker replay
- Rolling back onboarding profile or finalize because mail failed
- Brand invite, password reset, platform approve/deny/undeny honesty
- Admin UI or health metrics for email failures
- In-app drop-denial channel or finalize `denial_emails_failed` (kept out to keep v1 small)
- Closing org-visible drop-denial silent loss

### Follow-up (required — not timeless-complete)

**Must stay open after archive:** `gaps/ops.email-ledger.md` (`status: deferred`).
Covers durable ledger, drop-denial org-visible channel (or product wontfix),
invite/password-reset honesty, optional webhooks/outbox.

Archiving this file **requires** that follow-up gap still exist; do not claim
email silent-loss is fully closed.

### Why this slice

Verification false-success / token burn and Notify Me one-shot are fixable
without schema and are the archive criteria. Denial org silence stays open
product debt (log-only in v1). Ledger + webhook + invite/reset honesty are
separate follow-ups.

## Notes vs prior gap text

Empty `RESEND_API_KEY` no longer runs off-dev (boot fail-fast) — repro via
unverified domain / bad key / bad `EMAIL_FROM`. Filtering lives in
`services/campaigns.py`. Prior “Recommended MVP” ledger + admin/health mix and
any claim that v1 closes denial for the org are superseded by **Locked v1 fix**.

## Plan verification

**Verdict: PASS_WITH_NITS**

**Feasibility:** High. Locked v1 is implementable with no schema migration, no
ledger, and no impossible lifecycle. `_dispatch` → `bool`, token remove on
failed verification send, `email_sent: false` on first submit, `sent_at` only
on provider accept, and denial structured-log-only all fit the existing
flush→send→`get_db` commit pattern.

### Evidence reviewed

| Area | Path | Relevant behavior today |
|---|---|---|
| Dispatch | `backend/app/services/email.py` `_dispatch` | Never raises; unset key / HTTP error / exception → log + `return`; success logs `resend_id`. Dev `send_*` short-circuit **before** `_dispatch` (console only). |
| Session | `backend/app/deps/db.py` `get_db` | Services `flush()` only; commit on clean exit; **rollback on any exception** (incl. `BuzzAPIException`). |
| Onboarding | `backend/app/services/onboarding.py` | `_mint_and_send_verification`: add token → `flush` → `send_verification_email` (ignored result). Submit returns `{org_id, status, email_sent_to}` always. Resend counts live unused unexpired tokens (max 3). |
| Notify | `backend/app/jobs/notify_reminders.py` | After `send_drop_opening_reminder_email`, **always** stamps `sent_at`; docstring admits one-shot after attempt. Job commits via `scripts/run_job.py`. |
| Denial | `backend/app/services/brands.py` `finalize_applicants` | Flush accept/deny → send denial emails → return counts; outer `try/except` around send (redundant once send never raises). |
| SPA | `OrgProfilePage.tsx`, `VerifyEmailPage.tsx`, `useOnboardingHooks.ts` | Profile always navigates to verify-await; await copy always “We sent…”; resend success hard-codes “re-sent”; no `emailSent` field typed. |
| Errors | `backend/app/errors.py` | No `EMAIL_SEND_FAILED` (or similar) yet. |
| OpenAPI | routes use untyped `APIResponse` + `camelize(dict)` | Additive `email_sent` → `emailSent` does not break a typed response model; FE types still need update. |

### Checks (requested)

**1. `_dispatch` → bool — PASS**

Current `_dispatch` already has clear success / soft-fail exit points (`return`
after unset key, after `except`, fall-through after 2xx). Changing those to
`return False` / `return True` is mechanical. Plan’s “true only on provider
accept (HTTP 2xx / Resend id path) or intentional development console success”
matches code: `raise_for_status()` already gates 2xx; missing/unparsed `id`
still counts as accept today (log `resend_id=None`) — keep that unless
tightening (not required).

**Wrappers must also return bool.** Dev branches in `send_verification_email` /
`send_drop_opening_reminder_email` / `send_application_denied_email` return
early **without** calling `_dispatch` — they must `return True` (plan: “Dev
console path = true”). Production paths `return await _dispatch(...)`.

**2. Verification token delete on fail — PASS (with txn nuance)**

Same-request delete/invalidate after mint is **possible and correct**:
token is only `flush()`ed; `get_db` has not committed. `db.delete(evt)` or
reuse `_invalidate_verification_tokens` / set `expires_at=now` before the
request returns removes it from the committed snapshot. Max-3 query uses
`used_at IS NULL AND expires_at > now`, so expire **or** delete both prevent
burn.

**Resend / change-email API failure:** if the service raises
`BuzzAPIException`, `get_db` **rolls back the whole request**. That alone
undoes the mint — explicit delete is redundant but harmless (and required
documentation if a future path returns an error envelope **without** raising,
which would commit). Prefer raise + stable error code so SPA `ApiError`
branching works.

**change-email + raise:** rolling back also reverts `user.edu_email` and
prior-token invalidation. That is coherent with “clear failure / retry”;
Locked text does not require the email change to stick on send failure.

**First submit:** must **not** raise on dispatch false (else profile + status
roll back, contradicting Locked). Order that works:

1. flush org + `edu_email` + `pending_email_verification`
2. mint + flush token
3. `ok = await send_verification_email(...)`
4. if not ok: delete/expire that token
5. return success dict with `email_sent: false`
6. `get_db` commits → profile kept, no live token

**3. `email_sent: false` on signup — PASS**

Additive field on existing camelized dict; route already
`api_response(data=camelize(result))`. Wire: `emailSent`. Update
`OnboardingResult` in `useOnboardingHooks.ts`. No typed OpenAPI data schema
on `/api/orgs/onboarding` today — not a contract break; regenerate
`openapi.json` if the dump includes examples.

**4. `sent_at` only on true — PASS**

Replace unconditional stamp in `notify_reminders.py` with
`if await send_...(): notify.sent_at = now; sent += 1`. Failed rows stay
`sent_at IS NULL`, still selected next run (`FOR UPDATE SKIP LOCKED`).
Bounded by existing `apply_close_at > now` predicate — retries stop when the
window closes (not infinite forever).

**5. Denial log-only — PASS**

Finalize already commits business writes before mail; plan correctly keeps
that. Bool + structured log (`recipient`, `drop_id`, maybe `org_id`) replaces
the dead outer `try/except`. No response field / rollback — matches Locked
“does not close org-visible silent loss.”

### Transaction / commit order

```
request txn:  [ business flush ] → [ mint flush ] → [ HTTP to Resend ] → [ optional token delete ]
                                                                    └→ return
get_db: commit on success | rollback on raise
job txn:  [ select FOR UPDATE SKIP LOCKED ] → [ send ] → [ maybe stamp ] → flush → run_job commit
```

External send sits inside the open DB transaction (already true today). Known
pre-existing edge: provider accept then process crash before commit → inbox
link with no DB token. v1 does not fix that; outbox is OUT.

### SPA `email_sent: false`

Backend alone is insufficient for archive honesty:

- `OrgProfilePage` ignores response and always `navigate("/onboarding/verify-email")`.
- `AwaitVerification` always claims “We sent a verification link…”.
- Resend/change success paths always claim sent/re-sent on HTTP 200.

Required FE (in scope of Locked): pass failure into verify-await (e.g.
`navigate(..., { state: { emailSent: false } })`), show failure + Resend CTA;
resend/change must treat non-2xx as error (already) and must not toast success
on failure. **Nit:** `location.state` is lost on hard refresh — consider
`sessionStorage` / query flag if that matters; soft nit only.

### Notify retry storms

Not impossible; **accepted by Locked** (“Chronic bounce spam is accepted for
v1”). Under sustained Resend outage, every due `notify_me` row is retried each
`~5m` cron until `apply_close_at`. Volume = due subscribers × runs while
windows remain open. No N-strike / backoff in v1 — do not treat as a blocker;
ops follow-up if noisy.

Also update `NotifyMe.sent_at` model comment (today: “attempted”) when
stamping semantics change; keep `reminders_sent` aligned with true successes.

### Impossible? None found

| Claim | Possible? |
|---|---|
| Bool from `_dispatch` without raising | Yes |
| Delete/invalidate token after mint, same request, before commit | Yes |
| Profile commit + `email_sent: false` without re-submit | Yes (`pending_email_verification` blocks `submit_org_onboarding`) |
| Resend failure without max-3 burn | Yes (rollback and/or delete/expire) |
| `sent_at` only on true + natural retry | Yes |
| Denial finalize + log-only | Yes |

### Blockers

None for Locked v1 as written.

### Nits (amended into Locked / fix_when — 2026-08-06)

Prior nits folded: `pending_email_verification` typo fixed; `EMAIL_SEND_FAILED`;
SPA `emailSent` honesty + durable failure UX; OpenAPI/FE types called out in
`fix_when`. Remaining implementer notes (non-blocking): delete vs expire both
OK; resend raise makes delete redundant under `get_db`; dampen
`brands.py` outer try/except once send returns bool; notify
`reminders_sent` only when dispatch true; outage retry storms accepted.

### Notes

- Off-dev empty `RESEND_API_KEY` still fail-fast at boot (`config.py`); `_dispatch` false on unset remains useful for tests / defense in depth.
- Denial org-visible silent loss correctly remains **open** after archive; do not expand v1.
- Invite / password-reset honesty correctly OUT — leaving their wrappers on bool plumbing without behavior change is fine.
