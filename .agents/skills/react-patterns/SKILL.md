---
name: react-patterns
description: >-
  BUZZ React 18 SPA patterns for hooks, TanStack Query state, forms, routing,
  accessibility, shared primitives, and measured rendering performance.
---

# React patterns

Ground decisions in [frontend/package.json](../../../frontend/package.json)
and existing callers. This checkout uses React 18, TypeScript 4.9, CRA/CRACO,
React Router 7, and TanStack Query 5. Use SPA patterns supported here; do not
introduce React 19 actions, Server Components, Next.js, or new state/form libraries
as assumptions.

## State, hooks, and data

- Keep render pure; derive values from props/state instead of effect-driven
  copies. Use event handlers for user actions and effects for external sync.
- Call hooks at the top level. Clean up listeners, subscriptions, timers, and
  asynchronous work; preserve complete dependencies and functional state updates.
- Keep state local, lifting it only to the nearest shared owner. Reuse existing
  [contexts](../../../frontend/src/contexts/) for auth and site chrome.
- Reuse [API hooks](../../../frontend/src/api/hooks/) and
  [apiFetch](../../../frontend/src/api/client.ts), generated types, query keys,
  auth gates, error handling, and cache invalidation. Avoid duplicate fetch/auth
  logic or copying query results into local state.
- Preserve loading, error, empty, pending, and retry behavior. Disable duplicate
  submissions and surface failures. Query enablement must respect auth and IDs.
- Use [AppRoot](../../../frontend/src/AppRoot.tsx) route/role guards and router
  navigation. UI guards do not replace backend authorization.

## Forms and accessibility

Use controlled local state and existing submit patterns; reuse
[form validation](../../../frontend/src/utils/formValidation.ts).
Prefer [form primitives](../../../frontend/src/components/forms/),
[AuthShell](../../../frontend/src/components/site/AuthShell.tsx),
[UI primitives](../../../frontend/src/components/ui/), and
[theme tokens](../../../frontend/src/theme/tokens.ts).

Keep visible labels connected to fields, field errors associated with their
controls, semantic buttons/links, appropriate button types, native control
behavior, keyboard access, and visible focus. Reuse the existing Radix-backed
[Modal](../../../frontend/src/components/ui/Modal.tsx) for dialog focus/escape
behavior. Do not replace native controls with inaccessible custom widgets.
New visual decisions follow [design and brand](../buzz-design-and-brand/SKILL.md).

## Performance within the SPA

- Avoid accidental request waterfalls; start independent queries independently.
  Preserve pagination and query deduplication instead of loading entire datasets.
- Keep frequently changing state near its consumers. Use stable list keys and
  define components outside render to avoid remounting them on each update.
- Avoid effect-derived state and unnecessary heavy imports. Add memoization only
  for measured expensive work or a demonstrated consumer/dependency need.
- Reserve image/layout space and reuse
  [RemoteImage](../../../frontend/src/components/ui/RemoteImage.tsx) behavior.
  Do not add virtualization or code-splitting infrastructure without evidence
  and approval for any dependency or UX change.

General measured browser audits remain the separate OpenBot `web-perf` skill's
job. Report the measured problem and verify the proposed improvement rather
than applying a generic optimization checklist.
