---
name: buzz-design-and-brand
description: >-
  BUZZ visual work: pen-first design, approved UI, staging screenshot match,
  logo and theme reuse, visual trims, and verification guides.
---

# BUZZ design and brand

Use with [coding agent](../buzz-coding-agent/SKILL.md) for visual work.
Deployment and external asset boundaries are in
[staging operations](../buzz-staging-operations/SKILL.md).

## Pen first, then match

1. Obtain the approved pen.dev design and frame through the task's authorized
   design source. Do not assume a private filesystem path. If the design is
   unavailable, ask for access before inventing new UI.
2. Update the design for the item before implementation. New UI or behavior
   needs user approval; a coding request does not settle a product fork.
   An external design edit also requires authorization for that write.
3. Implement the approved screen in app code for staging. Real interactions
   and animations may extend a static frame while preserving the approved design.
4. Compare each relevant frame with staging screenshots at matching viewport
   sizes and states. Fix missing frames and visual drift before claiming a match.
   Request permission before each laptop UI-control action.
5. Visual trims preserve appearance and behavior; use before/after screenshots
   and pixel diffs as evidence. Disclose any missing visual verification.

## Reuse the current branch's brand assets

Consult [site identity](../../../frontend/src/data/siteIdentity.ts),
[logos](../../../frontend/public/logos/), and
[theme tokens](../../../frontend/src/theme/tokens.ts).
Current assets include `buzz-logo.svg`, `buzz-logo-coral.svg`, and `bee.svg`;
verify asset names on the selected branch before using them.

Preserve the original bee's body, stripes, and wings; never invert or recolor
the bee. Approved light/dark wordmark variants change letters and flight-path
dots; the approved dark variant may use a thin light head/antenna outline.
Reuse existing SVG art and the approved frame rather than generating a new mark.
Show the full logo without cropping.

Use shared [form controls](../../../frontend/src/components/forms/controls.tsx),
[shells](../../../frontend/src/components/site/), and theme tokens. Avoid a
parallel set of controls or arbitrary per-page colors.

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
