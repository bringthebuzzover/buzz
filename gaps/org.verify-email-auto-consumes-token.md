---
id: org.verify-email-auto-consumes-token
title: Edu verify link auto-POSTs on page load — prefetch can verify without a human click
kind: authz
severity: P2
status: open
surface: org
evidence:
  - path: frontend/src/pages/onboarding/VerifyEmailPage.tsx
    note: VerifyWithToken useEffect auto mutateAsync(token) on mount when ?token= present
  - path: frontend/src/pages/auth/BrandSetupPage.tsx
    note: Sibling magic link — form submit only (Activate); no auto-consume on mount
  - path: frontend/src/pages/auth/ResetPasswordPage.tsx
    note: Sibling magic link — form submit only; same capture/strip pattern
  - path: backend/app/routes/auth.py
    note: POST /api/auth/verify-email unauthenticated one-shot redeem; rate-limited 20/min
  - path: backend/app/services/onboarding.py
    note: hash_token + FOR UPDATE; used_at; status → pending_approval; email_verified_at
  - path: PRODUCT.md
    note: §6.1 .edu verification is an access gate before admin approval (does not mandate auto-consume)
repro: |
  Complete org onboarding → receive verify email with
  /onboarding/verify-email?token=….
  Any JS-capable client that loads that URL (Safe Links / preview / accidental
  open) POSTs /api/auth/verify-email → 200; user.status → pending_approval;
  email_verified_at set. Human never presses a confirm control.
  Observed 2026-08-11: verify delivered 21:52:27Z, POST verify 200 at 21:52:52Z
  with refresh 401 (fresh tab), then admin could approve.
fix_when: |
  Opening the email link alone does not consume the token. SPA shows an explicit
  Confirm / Verify email control; only that click POSTs /api/auth/verify-email.
  Token kept in React state from ?token=; stripTokenFromUrl runs after successful
  confirm (not on mount — so refresh-before-click still works). Double-submit /
  EMAIL_ALREADY_VERIFIED UX remains success. Waiting screen (no token) unchanged.
  Test: load with ?token= does not call verify until click. Backend unchanged for v1.
---

# Confirm button before edu verify consume

## Intent (locked by ask 2026-08-11)

Stop **auto-verify on page load**. Magic link lands on a page that requires an
explicit **button click** before `POST /api/auth/verify-email`.

## Research summary (2026-08-11)

Parallel POVs: SPA as-built, backend security, industry magic-link practice.
Parent verified cites against `VerifyEmailPage`, `BrandSetupPage`,
`ResetPasswordPage`, `onboarding.verify_email`, auth routes.

### Root cause

| Layer | Finding |
| ----- | ------- |
| SPA | `VerifyWithToken` mounts → `useEffect` → `useVerifyEmail().mutateAsync(token)`. Outlier vs brand invite / password reset (submit-gated). |
| API | Already correct: unauthenticated POST body token, SHA-256 at rest, `FOR UPDATE`, one-shot `used_at`, 24h TTL, 20/min IP rate limit. **No backend change for Locked v1.** |
| Scanners | Safe Links / Mimecast / Proofpoint / Gmail checks are GET- and sometimes JS-detonation oriented. Auto-POST on load is the anti-pattern; confirm click stops nearly all. Apple MPP prefetches images, not auth links. |
| Industry | Supabase / OWASP-aligned: GET landing must not mutate; confirm page or OTP. Confirm-on-click is default for email **verification**; OTP/two-step reserved for passwordless **login** or if burns persist after the button. |

### Feasibility

| Option | Effort | Stops GET/JS auto-POST | Notes |
| ------ | ------ | ---------------------- | ----- |
| **A. Confirm click (Locked v1)** | Small FE | Yes | Best fit; mirror BrandSetup/ResetPassword UX |
| B. Keep auto-POST | — | No | Rejected |
| C. Intent-token / OTP two-step | Medium BE+FE | Stronger | Out of v1 unless campus scanners start clicking Confirm |
| D. UA heuristics (“skip bots”) | Fragile | Partial | Do not use as primary fix |

**PRODUCT:** §6.1 requires the user complete verification; it does not require auto-consume. Explicit confirm is compatible; ask only if copy must mention the button.

## Locked v1 (enriched)

1. **Remove** mount `useEffect` that calls `verify.mutateAsync`.
2. With `?token=` in state (`useState(() => searchParams.get("token"))`):
   - Initial UI: short copy + primary **Verify email** / **Confirm** (not “Verifying…”).
   - On click: `disabled={isPending}`; existing success / `EMAIL_ALREADY_VERIFIED` → success / error paths and Continue targets unchanged.
3. **`stripTokenFromUrl` after successful confirm** (not on mount).
   - Brand/reset strip on mount is OK because the secret is only needed at form submit *in the same session*; verify must survive **refresh before click**.
   - Capture in state first (already done); strip after success so history does not keep the secret after verify.
4. Waiting screen (no token): resend / change-email / poll — **unchanged**.
5. **Backend:** no API or schema change for v1.
6. **Test:** RTL (or equivalent) — render with `?token=` → verify mutation **not** called until button click.

### Strip timing (decide once)

| Approach | Refresh before click | Secret in URL until click |
| -------- | -------------------- | ------------------------- |
| Strip on mount (brand/reset style) | **Breaks** (token gone) | Shorter |
| **Strip after success (Locked)** | Works | Until confirm — acceptable |

## Risks

| Risk | Likelihood after v1 | Disposition |
| ---- | ------------------- | ----------- |
| GET-only prefetch | None | Already POST-only API |
| SPA load + auto-POST (today’s bug) | Fixed by confirm | — |
| JS sandbox that **clicks** Confirm | Low today | Monitor; escalate to OTP if seen |
| Two-tab double-confirm | Low | Server `FOR UPDATE`; SPA treats `EMAIL_ALREADY_VERIFIED` as success |
| Token briefly in URL / history until confirm | Medium (ops) | Strip after success; short TTL already |
| Premature verify → earlier admin queue | Reduced | Still needs admin approve for portal access |
| Resend stacks up to 3 live links | Pre-existing | Optional later: invalidate-on-resend |

## Out of scope unless asked

- Intent-token / OTP two-step.
- Invalidate-all-prior on resend.
- Assert `evt.email == user.edu_email` on redeem.
- Changing admin approve rules or skipping .edu verification.
- Passwordless email login (would warrant stronger anti-prefetch).

## Implement checklist

- [ ] `VerifyWithToken`: idle → Confirm click → pending → success/error (no mount POST)
- [ ] Strip URL after successful confirm; keep token in state for the click
- [ ] Preserve `EMAIL_ALREADY_VERIFIED` → success UX
- [ ] Test: no verify call until click
- [ ] Manual: open `?token=` → confirm → pending-approval; second open → already-verified success
