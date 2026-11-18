---
name: buzz-design-and-brand
description: >-
  BUZZ UI concept-first work, visual comparison, approved design intent, logo
  and theme reuse, visual trims, and verification guides.
---

# BUZZ design and brand

Use with `buzz-coding-agent` for visual work. Run its active-checkout discovery
first. If only screenshots or artifacts exist, review those within scope; app
implementation is not applicable without code. Deployment and external asset
boundaries are in `buzz-staging-operations`.

## Draft, review, then implement

BUZZ uses the running app as its implementation reference and retained design
image archives as historical context. Do not require Pen.dev, OpenPencil, Pencil,
Figma, or editable `.pen`/`.fig` files.

1. **Discover and capture.** Identify the authorized checkout, route, current
   state, existing design tokens, shared components, and relevant behavior.
   Capture the current UI before changes at the affected route, state, and
   viewport sizes. Use the running app or the explicitly selected local or
   staging target; do not assume access to a private path or service.
2. **Draft a concept.** Before implementing production UI, create a reviewable
   concept, such as an isolated preview or annotated screenshot, using the
   existing tokens, assets, and shared components as appropriate. Keep it
   separate from the shipping UI. Include the affected routes, responsive
   sizes, important states, behavior, and acceptance criteria. Render and
   capture the concept at the same route/state/viewport dimensions as the
   baseline where possible. Use real browser screenshots for evidence; label
   any static or partial preview clearly.
3. **Review and iterate.** Compare the baseline and concept visually. Check
   hierarchy, spacing, text wrapping, contrast, focus and keyboard behavior,
   responsive layouts, and relevant empty, loading, error, and interactive
   states. Iterate on specific mismatches before asking for review. Use
   `visual-evidence` for capture and delivery; inspect captures yourself before
   sharing them. Pixel diffs are useful where the same regions and rendering
   conditions make them meaningful.
4. **Get concept approval.** Show Lawrence or the designated reviewer the
   baseline and concept captures, affected states/viewports, and any open
   product choices. Wait for explicit approval before implementing production
   UI. A request to code does not settle an unresolved product or UX choice.
5. **Implement the approved concept.** Reuse current tokens, assets, controls,
   shells, and component patterns. Avoid duplicate components and parallel
   sources of truth. Choose a compatible library only when it materially
   simplifies the implementation without adding needless dependencies or
   changing behavior. Keep code scoped and straightforward; real interactions
   and animations may extend the approved concept while preserving its intent.
6. **Compare and verify.** Capture the implemented UI at the same routes,
   states, and viewport sizes. Compare it with the approved concept and the
   baseline, fix visual drift, and verify relevant behavior and accessibility.
   Follow the branch's testing guidance and run `simplify-pass`. Show the
   before, approved-concept, and final captures in the handoff. Disclose any
   states or viewports that could not be checked; do not claim a match without
   visual evidence.

Request permission before each laptop UI-control action. Never use a screenshot
mock or redrawn illustration as evidence of the running UI.

## Reuse the current branch's brand assets

Discover existing identity configuration, assets, styles, tokens, and callers.
Candidates include `frontend/src/data/siteIdentity.ts`, `frontend/public/logos/`,
and `frontend/src/theme/`; inspect only paths present in this checkout. Logo
filenames and component names differ by branch. Reuse the approved current
assets rather than requiring a particular wordmark variant to exist.

Preserve the original bee's body, stripes, and wings; never invert or recolor
the bee. Approved light/dark wordmark variants change letters and flight-path
dots; the approved dark variant may use a thin light head/antenna outline.
Reuse existing SVG art rather than generating a new mark. Show the full logo
without cropping.

Discover and reuse existing shared form controls, shells, and theme tokens.
Do not assume exact filenames or create a parallel control system. Missing
required design/assets means request context; do not import from another tree
or invent a brand direction as a fallback.

## External assets and guides

Staging, lab login, and gate assets should match the approved staging logo
byte-for-byte where the same asset is intended. Report external follow-up; this
repo task does not authorize edits to the separate operations repository, lab
branch, Worker, Pages configuration, or deployed assets. Any approved sync must
preserve unrelated bindings and be visually verified by its owner.

Verification/tester guides should match the current site theme. Identify the
screen, route, expected behavior, and relevant UI state; do not require a design
file or frame. Private guides may include authorized staging links and clearly
marked staging-only account identifiers, never passwords. Keep live addresses,
accounts, and private design locations out of public files. Do not publish a
guide or send messages without explicit approval.

Never post or change anything on the user's Instagram.
