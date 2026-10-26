---
id: ops.email-ledger
title: Durable email send ledger and remaining honesty paths
kind: silent_loss
severity: P2
status: fixed
surface: ops
closed_in: f15b860
evidence:
  - path: backend/app/services/email.py
    note: Optional Resend Idempotency-Key on _dispatch; 409 is not sent-success
  - path: backend/app/jobs/notify_reminders.py
    note: reminder/{notify_me.id} so a crash after Resend 2xx does not send twice
  - path: backend/tests/test_email_idempotency.py
    note: Header, uniqueness, reminder stability, 409, no raw token or email in the key
repro: |
  Crash notify_reminders after Resend 2xx and before sent_at commits. The next
  run posts the same Idempotency-Key and the same payload. Resend returns the
  original 2xx and does not send a second opening reminder.
fix_when: |
  Double-send after a crash between provider accept and the DB stamp is
  covered without a new table. Durable email_sends and Resend webhooks are
  an explicit non-goal. Kinds that can legitimately be sent again and have
  no per-instance id are sent with no key.
---

## Decision (2026-10-26, Lawrence)

The durable `email_sends` ledger and Resend webhooks (the old “option 2”)
will **not** be built. Send history is the Resend dashboard **Emails** page.
How long those rows stay visible depends on the Resend plan.

What shipped instead is opt-in `Idempotency-Key` on `POST /emails`
(`backend/app/services/email.py`). Keys last 24 hours at Resend. Same key and
same payload returns the original response and does not send again. Same key
and a different payload returns **409** (`invalid_idempotent_request`, or
`concurrent_idempotent_requests` when the first request is still in flight).
Docs checked 2026-10-26: https://resend.com/docs/dashboard/emails/idempotency-keys

`_dispatch` stays best-effort (never raises). HTTP 2xx, including that replay,
is success. **409 is not success**: it is logged at error with the kind and
the first 16 hex chars of SHA-256 of the key, and the function returns
`False`. Callers must not stamp sent-success on `False`. An unsafe key
(empty, longer than 256, contains `@` or non-printable bytes) is dropped and
the email is still attempted with no header.

There is no new table and no migration.

## Per-kind keys

Format is `kind/<stable id>[/<per-instance id>]`. Parts are row ids or the
prior `email_sent_at` (`idempotency_generation`). A raw token, OTP, or email
address is never placed in the key. `build_idempotency_key` returns `None`
(send with no header) if a part is an email, missing, or otherwise unsafe.
Non-id parts that are printable are SHA-256 hex so a raw token cannot leak
into the header.

| Kind | Caller | Trigger | Legit repeat within 24h? | Key | Why a legit send is not suppressed |
| --- | --- | --- | --- | --- | --- |
| Verification link (signup and rotate) | `onboarding._mint_and_send_verification` | Signup, resend, public resend, email change | Yes. Each request inserts a new `email_verification_tokens` row | `verification/{token.id}` | The new code is a new row id. A retry of that same row reuses the id. The raw token is not in the key. |
| Brand invite | `admin.approve_brand`, `admin.resend_brand_invite` | Approve, or admin resend | Yes | `brand-invite/{invite.id}` | Each issue inserts a new `brand_invite_tokens` row. |
| Password reset | `password_reset.request_password_reset` | Brand or admin forgot-password | Yes | `password-reset/{token.id}` | Each request inserts a new `password_reset_tokens` row. |
| Org approved, Connect link | `admin.approve_org`, `admin.resend_org_connect` | Approve into pending Instagram, or resend Connect | Yes (resend) | `org-approved/{connect_token.id}` | Every send mints a new `org_connect_tokens` row. The new link is a new key. |
| Org approved, already bound | `admin.approve_org` | Approve when Instagram is already on the user | No. Active is not approved again | `org-approved-bound/{org.id}` | Different kind from the Connect mail. A crash retry is the same org and the same login-link payload. |
| IG switch Connect | `ig_change_requests` approve `account_switch`, `admin.resend_org_connect` | Approve a switch, or resend Connect | Yes (resend) | `ig-switch-connect/{connect_token.id}` | Keyed on the new token, not the request. A request id would 409 the resend because the URL token changed. |
| IG rename approved | `ig_change_requests` approve `rename` | One decision per request | No. A second approve is rejected | `ig-rename-approved/{request.id}` | Crash retry is the same request and the same handle. |
| IG change denied | `ig_change_requests.deny_request` | One decision per request | No | `ig-change-denied/{request.id}` | Same as rename. |
| Org apply prefill | `deliver_saved_prefill_email` | Script send, or `--resend` | Yes when resend is set | `org-apply-prefill/{prefill.id}[/{prior email_sent_at}]` | The first send has no generation. After `email_sent_at` commits, a resend includes that timestamp, so it is a new key. A crash before the stamp retries the old key. |
| Org apply prefill UPDATE | `deliver_saved_prefill_update_email` | Script `--update` | Yes | `org-apply-prefill-update/{prefill.id}[/{prior email_sent_at}]` | Different kind from the original prefill, so both can go out. Same generation rule. |
| Drop application denied | `brands` finalize | Batch deny | The same application row is denied once. Reapply inserts a new row | `application-denied/{application.id}` | Another org on the same drop has another application id. |
| Opening reminder | `notify_reminders.send_due_reminders` | Cron, once per subscription | Opt-out deletes the row. Opt-in again inserts a new id | `reminder/{notify_me.id}` | Retries of one row share the key. Two orgs on one drop do not. |
| Drop published | `admin.publish_drop` | First publish | No. A second publish is rejected before send | `drop-published/{drop.id}` | Crash retry is the same drop and the same brand payload. |
| Late-add, org | `admin.add_org_to_drop` | Optional mail when seating an org | Already accepted is refused | `late-add-org/{application.id}` | One seat per application. Another org is another application. |
| Late-add, brand | `admin.add_org_to_drop` | Optional mail to the brand | Same | `late-add-brand/{application.id}` | Different kind from the org copy. Sharing a key would 409 because the payloads differ. |
| Org erased | `admin_erase.erase_org_user` | Data deletion | No. Already erased returns before send | `org-erased/{user.id}` | Crash retry is the same user and the same captured name. |
| Brand erased | `admin_erase.erase_brand` | Data deletion | No | `brand-erased/{brand.id}` | Same as org erase. |
| Org denied | `admin.deny_org` | Deny a pending org | Yes. Undeny, then deny again | **none** | No per-decision row. An org id would suppress the second denial for 24h. |
| Brand denied | `admin.deny_brand` | Deny a pending brand | Yes | **none** | Same. |
| Org undenied | `admin.undeny_org` | Back to review | Yes. Deny, then undeny again | **none** | Same. |
| Brand undenied | `admin.undeny_brand` | Back to review | Yes | **none** | Same. |
| Drop hidden | `admin.hide_drop` with `notify_brand` | Withdrawal notice | Yes. Unhide, then hide and notify again | **none** | A drop id would suppress the second notice. `hidden_at` is new on every request, so it cannot dedupe a crash retry without also changing on a real re-hide. |
| Admin compose | `admin.compose_org_email`, `admin.compose_brand_email` | Admin clicks send | Yes, including the same text | **none** | No compose row. Hashing subject, body, or recipient would suppress an intentional second send. |

## 409, per caller

`False` keeps each caller's existing honesty behavior. Nothing new treats a
conflict as delivered.

| Caller | On 409 (`False`) |
| --- | --- |
| `notify_reminders` | `sent_at` stays null. The next cron retries. A payload mismatch keeps 409ing until the key expires (~24h), then a new send can occur. A concurrent in-flight 409 is safe to retry and should then see the original 2xx. |
| Org apply prefill | Returns `send_failed`. `email_sent_at` is not stamped. |
| Verification | The just-minted token is deleted (existing failure path). |
| Password reset | The token is burned. The client still gets `{ok: true}` (existing enumerate-safe path). |
| Brand invite resend | `EMAIL_SEND_FAILED` 502 (existing). |
| Approve brand | `email_sent: false`. The brand stays approved (existing). |
| Application denied, publish, erase, late-add, IG decision, org approve | Best-effort. The business write is not rolled back solely because mail returned `False` (existing). |

## Still out of scope

- In-app signal for a denied drop applicant. PRODUCT is email-only for that
  decision. This archive does not change that.
- Password-reset and some platform mails still do not surface provider
  failure to the end user, on purpose (enumerate-safe reset; fire-and-forget
  deny/undeny).
- Kinds with **no key** can still double-send if the process dies between
  Resend 2xx and commit. That is preferred to suppressing a second legitimate
  deny, undeny, hide, or compose.
- A retry whose **payload changed** (template deploy, renamed drop, edited
  org name) 409s for up to 24h and is not marked sent. After the key expires,
  a later retry can deliver a second email. We do not invent a new key on
  409, because that would send the changed body and also drop the dedupe.
- Token mints that share a transaction with the send: a crash before commit
  rolls the token back. The next request mints a new id and a second email
  goes out. The first link is dead. Suppressing that second email would be
  worse.
- Idempotency keys expire after 24 hours, so a retry after that window can
  duplicate.
- Development console mode never calls Resend, so it sends no header.
