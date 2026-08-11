---
id: deploy.npm-workspaces-wontfix
title: Do not adopt npm workspaces for the polyglot monorepo
kind: ops
severity: P3
status: wontfix
surface: deploy
evidence:
  - path: package.json
    note: Thin Railway/Railpack shim — build/start delegate via npm --prefix frontend
  - path: frontend/package-lock.json
    note: Sole JS lockfile SOT; CI caches this path
  - path: .github/workflows/ci.yml
    note: frontend job uses working-directory frontend + cache-dependency-path frontend/package-lock.json
repro: |
  N/A — decision record, not a broken path. Root package.json exists so Railpack
  detects the Node provider with Root Directory `/` (reads backend/brand_emails.json).
  Scripts use --prefix frontend; no shared JS packages.
fix_when: |
  N/A — wontfix unless the repo gains 2+ JS packages that share code/deps.
  If revisited: Locked v1 for workspaces (root lockfile, CI cache, CRA hoist
  checks), migrate, archive with closed_in. Do not delete this file solely to
  “clean up” the decision.
---

# npm workspaces not adopted (wontfix)

**Verdict: WONTFIX_OK** — keep the thin root `package.json` + `--prefix frontend`.

## Why considered

After Root Directory `/` for `backend/brand_emails.json`, Railpack needed a root
`package.json` so one mise Node covers build and runtime. `--prefix` vs npm
`workspaces` was evaluated as a follow-on elegance pass.

## Decision

**Do not** add `"workspaces": ["frontend"]` (or equivalent).

| | `--prefix` (current) | npm workspaces |
| --- | --- | --- |
| Fit | Polyglot repo, one JS app | 2+ JS packages that link/share deps |
| Lockfile | `frontend/package-lock.json` only | Root lockfile + hoist rules |
| Gain here | Railway Node detection | Cosmetic `-w frontend`; no shared packages today |
| Cost | None beyond existing shim | CI/cache churn, CRA hoist risk, dual install mental model |

Not cleaner, leaner, or easier to maintain for Buzz’s shape today. Revisit only
if a second JS package (e.g. shared UI/lib) is extracted.

## Related

- Frontend Railway notes: [`DEPLOYMENT.md`](../DEPLOYMENT.md) (Frontend build / start)
- Living email ops (unrelated): `ops.resend-domain-unverified`, `ops.brand-mailbox`
