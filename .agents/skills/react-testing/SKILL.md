---
name: react-testing
description: >-
  BUZZ frontend testing with the installed CRA/CRACO Jest DOM harness,
  server-render smoke tests, and thin Playwright cross-stack journeys.
---

# React testing

Read [TESTING.md](../../../TESTING.md),
[package.json](../../../frontend/package.json), and nearby tests first.
This checkout uses Jest through CRACO, jsdom, React DOM, and Playwright.
It has no shared `renderWithProviders` helper and does not install React Testing
Library, user-event, MSW, axe, Vitest, or Cypress. Do not prescribe those APIs
or add dependencies just to follow a generic testing recipe.

## Choose the cheapest useful layer

- Pure logic: unit tests. Backend invariants: backend tests.
- [Page smoke inventory](../../../frontend/src/pages.smoke.test.tsx):
  server-render checks; effects and network do not run. Keep top-level page
  coverage current when adding pages.
- Component interaction: follow the native DOM harness in
  [BrandRequestDropPage.test.tsx](../../../frontend/src/pages/brand/BrandRequestDropPage.test.tsx).
- Full auth/navigation/API journeys, real layout and browser focus behavior:
  existing [Playwright suite](../../../frontend/e2e/). Keep it thin; jsdom
  cannot prove visual match or browser layout.

## Existing interaction harness

Use `createRoot`, `act` from React, and the existing act-environment setup.
Mount into a DOM container; provide a MemoryRouter and fresh QueryClient with
retries disabled when needed. Unmount inside `act`, remove containers, and
clean up timers, mocks, and query clients. Reuse
[setupTests.ts](../../../frontend/src/setupTests.ts) and
[CRACO configuration](../../../frontend/craco.config.js), including router
polyfills/mappings, rather than adding a parallel runner.

Use native DOM queries/events and Jest mocks consistent with adjacent tests.
Assert visible state, errors, request payloads, and navigation outcomes instead
of hook internals. Cover relevant loading/error/empty/submitting states and
regressions; parametrize similar cases. Avoid tests that merely mirror code or
add maintenance for trivial reversible edits.

Playwright uses semantic locators and stable test IDs. Its setup seeds a local
test database and starts servers; do not run it against staging or production.

## Checks and ownership

From `frontend/`, focused commands are:

```bash
npx tsc --noEmit
CI=true npm test -- --watchAll=false --runTestsByPath src/pages/brand/BrandRequestDropPage.test.tsx
```

Choose actual relevant test paths. Lint only touched files under `frontend/src`;
never pass `e2e/*.spec.ts` to the frontend ESLint configuration.
Record exact commands/results and missing dependencies or database blockers.
The calling bot owns the serialized full CI gate, including Playwright, for
behavior changes; native CLI subagents do not run `./scripts/ci-local.sh`.
Documentation-only work needs focused validation, not app tests or full CI.
Stress Playwright only when requested.
