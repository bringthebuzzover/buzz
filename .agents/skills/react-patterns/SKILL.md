---
name: react-patterns
description: >-
  BUZZ React SPA patterns grounded in the active branch's installed stack,
  state, forms, accessibility, shared primitives, and measured performance.
---

# React patterns

Run `buzz-coding-agent` (active-checkout discovery)
first. If there is no React app, report these steps as not applicable.
Inspect the actual package manifest, versions, entry/provider tree, router,
API hooks, forms, and adjacent components. The observed app branches use React
18; do not assume React 19 actions, Server Components, Next.js, a particular
router/query version, or uninstalled state/form libraries.

## State, hooks, and data

- Keep render pure; derive values instead of effect-driven state copies.
  Use event handlers for actions and effects for external synchronization.
- Call hooks at the top level; preserve complete dependencies and functional
  updates. Clean up timers, listeners, subscriptions, and asynchronous work.
- Keep state local, lifting only to its shared owner. Reuse existing contexts
  and server-state facilities after inspecting their responsibilities.
- Reuse the branch's API client, hooks, generated types, query keys, auth gates,
  error handling, and cache invalidation. Avoid duplicate fetch/auth logic.
  Where TanStack Query is present, use its installed API and existing defaults.
- Preserve loading, error, empty, pending, and retry behavior. Prevent duplicate
  submissions and surface failures; gate requests on valid IDs/auth.
- Use existing router navigation and role/status guards. Frontend guards do
  not replace backend authorization.

## Forms and accessibility

Discover and reuse current validation, controls, shells, theme tokens, and
dialog primitives. Candidates may live under `frontend/src/components/`,
`frontend/src/theme/`, and `frontend/src/utils/`; verify files and callers
before use. Names such as AuthShell, Modal, or RemoteImage are not guaranteed.

Follow existing form state/submit patterns and installed APIs. Connect labels
and errors to fields, preserve native controls, semantic buttons/links,
appropriate button types, keyboard access, and visible focus. Reuse an existing
accessible dialog's focus/escape behavior when available. If an essential
primitive is missing, resolve that implementation decision within task scope.
New visual decisions follow `buzz-design-and-brand`.

## Performance within the SPA

- Start independent queries independently; preserve pagination/deduplication.
- Keep frequently changing state near consumers, stable list keys, and component
  definitions outside render to avoid accidental remounts.
- Avoid effect-derived state and unnecessary heavy imports. Memoize only for
  measured expensive work or a demonstrated consumer/dependency need.
- Reserve image/layout space and reuse existing loading/error behavior if
  available. Do not assume a specific image component exists.
- Add virtualization, dependencies, or code-splitting infrastructure only with
  evidence and approval for resulting dependency/UX changes.

General measured browser audits remain the separate OpenBot `web-perf` skill's
job. Verify the measured improvement instead of applying generic optimizations.
