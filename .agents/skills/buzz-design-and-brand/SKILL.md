---
name: buzz-design-and-brand
description: >-
  BUZZ visual work: pen-first design, approved UI, staging screenshot match,
  logo and theme reuse, visual trims, and verification guides.
---

# BUZZ design and brand

Use with `buzz-coding-agent` for visual work.
Run its active-checkout discovery first. If only screenshots/artifacts exist,
review those within scope; app implementation is not applicable without code.
Deployment and external asset boundaries are in
`buzz-staging-operations`.

## Pen first, then match

1. Obtain the approved pen.dev design and frame through the task's authorized
   design source. Do not assume a private filesystem path. If the design is
   unavailable, ask for access before inventing new UI.
2. Update the design for the item before implementation. New UI or behavior
   needs user approval; a coding request does not settle a product fork.
   An external design edit also requires authorization for that write.
3. Where app code exists, implement for the caller-authorized target. Real interactions
   and animations may extend a static frame while preserving the approved design.
4. Compare each relevant frame with screenshots of the explicitly selected UI at matching viewport
   sizes and states. Fix missing frames and visual drift before claiming a match.
   Request permission before each laptop UI-control action.
5. Visual trims preserve appearance and behavior; use before/after screenshots
   and pixel diffs as evidence. Disclose any missing visual verification.

### Five-step layout and verification loop

For every screen or UI change, follow these five steps in order:

1. **Map the hierarchy first.** Confirm the element order and content structure make sense before tuning spacing.
2. **Use auto-layout groups.** Use hug-content sizing and consistent gaps so elements do not drift apart when text wraps. Use a centered, width-bounded content group for vertical alignment instead of placing each element independently.
3. **Check geometry and text.** Compare margins, widths, baselines, line wraps, and gaps against the reference frames. Check that no text or controls overlap or clip.
4. **Export at matching dimensions.** Place the reference (before / Fig) and updated frame side by side at identical dimensions, and use overlays or pixel differences for shared regions where useful. Always show before/after comparisons for all UI changes.
5. **Iterate on specific mismatches.** Fix the layout settings, re-export, and inspect again until shared elements line up and each new screen has clear spacing and hierarchy. Compare both visually and programmatically.

## Reuse the current branch's brand assets

Discover existing identity configuration, assets, styles, tokens, and callers.
Candidates include `frontend/src/data/siteIdentity.ts`, `frontend/public/logos/`,
and `frontend/src/theme/`; inspect only paths present in this checkout.
Logo filenames and component names differ by branch. Reuse the approved current
assets rather than requiring a particular wordmark variant to exist.

Preserve the original bee's body, stripes, and wings; never invert or recolor
the bee. Approved light/dark wordmark variants change letters and flight-path
dots; the approved dark variant may use a thin light head/antenna outline.
Reuse existing SVG art and the approved frame rather than generating a new mark.
Show the full logo without cropping.

Discover and reuse existing shared form controls, shells, and theme tokens.
Do not assume exact filenames or create a parallel control system. Missing
required design/assets means request context; do not import from another tree
or invent a new design as a fallback.

## External assets and guides

Staging, lab login, and gate assets should match the approved staging logo
byte-for-byte where the same asset is intended. Report external follow-up;
this repo task does not authorize edits to the separate operations repository,
lab branch, Worker, Pages configuration, or deployed assets. Any approved sync
must preserve unrelated bindings and be visually verified by its owner.

Verification/tester guides match the approved current pen/site theme: the current
default is light pink/cream, with approved dark variants only where appropriate.
Identify the screen, expected behavior, and pen frame. Private guides may include authorized
staging links and clearly marked staging-only account identifiers, never passwords.
Keep live addresses, accounts, and private design locations out of public files.
Do not publish a guide or send messages without explicit approval.

Never post or change anything on the user's Instagram.
