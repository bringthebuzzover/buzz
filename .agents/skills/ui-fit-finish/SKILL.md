---
name: ui-fit-finish
description: >-
  Standardize Buzz SPA shells and form controls onto theme tokens plus shared
  primitives. Use when the user says run ui fit-finish, run UI token pass, or
  asks to apply AuthShell / form primitives across the frontend.
---

# UI fit-finish

Agent map: [`AGENTS.md`](../../../AGENTS.md). Gap: [`gaps/spa.form-shells-and-controls.md`](../../../gaps/spa.form-shells-and-controls.md) (or archive). This is **`ship-change`**, not `run next cluster`.

## Locked decisions (do not re-ask)

1. Fit-and-finish only — keep cream/coral/ink. No Paper / Home / `for-orgs` theme redo.
2. `AuthShell` `align="center"` for short auth (org login is the reference). `align="stack"` only for long scrolling forms (org apply).
3. Primitives beat extra CSS variables. Pages import `AuthShell`, `PageShell`, `TextField`, `Select`, `Checkbox`, `Button`, `ErrorBanner`.
4. Agents fail a **rubric + leftover grep + screenshots**, not taste.

## Spine

1. **Screenshot classify** — 3 agents (public-auth, admin, portals). Schema: shot, route, file, kind, chrome. Pass `file_attachments`.
2. **Reviewer** — fresh agent confirms or reclassifies. Parent spot-checks.
3. **Defect map** — `ok` shots stay ok. Parent verifies fails in TSX.
4. **Code inventory** — remaining `inputClass`, native checkbox/select, shells not in the atlas.
5. **Serial SOT** — only parent/one agent edits `theme/`, `components/forms/`, `AuthShell`, `PageShell`, `tailwind.config.js`.
6. **Parallel apply** — auth-onboarding / org-brand / admin. Must not edit theme or form primitives. Primitive API change → bounce to parent.
7. **Leftover hunter** — `frontend/scripts/check-ui-primitives.sh` (wired in `ci-local.sh`).
8. **Visual QA** — 3 agents re-shot fail rows; do not “improve” `ok` rows.
9. **simplify-pass** then `./scripts/ci-local.sh`. **Stop** — no commit unless asked.

## Rubric

- Checkbox/select/`datetime-local` use primitives, not bare OS widgets next to Buzz cards.
- Shell matches kind (`center` vs `stack`; `PageShell` width).
- No nested `<label>`.
- Control padding is `size="default" | "compact"`, not mixed `p-2`/`p-3` strings.
- No new hex / purple gradients.

## Out of scope

Paper.design, PRODUCT copy/flows, Railway/Meta/Resend, parallel branches that edit `palette.ts` or form primitives.
