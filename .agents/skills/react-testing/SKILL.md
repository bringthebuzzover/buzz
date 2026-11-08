---
name: react-testing
description: >-
  Discover BUZZ's installed frontend tests and shared harness on the active
  branch; choose focused unit/component coverage or thin browser journeys.
---

# React testing

Run `buzz-coding-agent` (active-checkout discovery).
No frontend app means these test steps are not applicable. Resolve the active
testing guidance; inspect package manifests/lockfiles, test scripts, runner
configuration, setup files, helpers, and nearby tests before selecting APIs.
Do not assume a helper or dependency is globally present or absent.

## Prefer the existing harness

Search for `renderWithProviders` (a candidate is `frontend/src/testUtils.tsx`).
If present, read its implementation and callers and reuse its actual exports,
options, providers, cleanup, and return values. Do not shadow it with a second
wrapper or add duplicate routers/providers. For example, a harness may take
`route`, `path`, or `router` options and return a DOM container; inspect the
current signature instead of assuming testing-library queries or auth setup.

If no shared helper exists, follow adjacent native React DOM tests. Where they
use `createRoot` and `act`, match imports supported by installed React, existing
act-environment setup, router/query wrappers, fresh retry-disabled query clients,
and cleanup. Unmount/remove containers and restore mocks/timers. Reuse existing
polyfills and runner mappings rather than adding a parallel setup.

Use installed test APIs only. React Testing Library, user-event, MSW, axe,
Vitest, and Cypress are not prerequisites; inspect dependencies before using
any. Do not add packages just to satisfy a generic recipe.

## Choose useful coverage

- Pure logic belongs in unit tests; backend invariants in backend tests.
- If server-render smoke tests exist, maintain their relevant page inventory;
  recognize that server rendering does not run effects/network.
- Component tests assert visible state, errors, requests, and navigation using
  the existing harness. Cover relevant loading/error/empty/submitting states
  and regressions; parametrize similar cases. Avoid implementation-mirroring tests.
- Existing Playwright/browser tests cover thin cross-stack journeys, actual
  layout/focus, and visual behavior. jsdom cannot establish visual match.
  Discover the setup before running: it may seed databases and start servers.
  Use only the authorized local test target, never staging or production.

## Checks and ownership

Select commands from actual scripts/config and resolved test guidance, with
real relevant paths. In CRA/CRACO Jest checkouts, a focused invocation may be
`CI=true npm test -- --watchAll=false --runTestsByPath <existing-test-path>`
from the frontend root; typechecking may use `npx tsc --noEmit` if configured.
These are conditional examples, not instructions to run them on every branch.
Lint only touched configured source files, never `e2e/*.spec.ts` through the
frontend source ESLint config.

Record exact commands/results and missing context/dependencies/database blockers.
Native CLI subagents do not run `./scripts/ci-local.sh`; the caller owns required
serialized full CI including Playwright. Docs/skills-only work uses focused
validation without app tests. Stress runs require a request.
