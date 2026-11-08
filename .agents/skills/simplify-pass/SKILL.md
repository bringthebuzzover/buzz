---
name: simplify-pass
description: >-
  Post-change BUZZ hygiene: scope, reuse, single sources of truth, naming,
  dead code, generated contracts, doc links, gaps, and explicit-write boundaries.
---

# Simplify pass

Run after implementation and before claiming ready or handing off the gate.
This checklist authorizes neither broad refactors nor product/external writes.
Run `buzz-coding-agent` (active-checkout/source discovery).
Apply only relevant steps; absent app code makes code/contract checks not
applicable. Missing required canonical context blocks dependent claims.

## Checklist

1. **Scope:** only files needed for the task; preserve unrelated user changes.
2. **Reuse:** no duplicate helper or competing source for a touched concern.
   Prefer deletion/reuse over abstractions or dependencies without evidence.
3. **Sources:** refer to resolved product, architecture, and gap sources rather
   than copying behavior into rules/comments. Respect private context boundaries;
   do not create local competing sources when documentation lives elsewhere.
4. **Names/dead code:** consistent names across touched layers; no unused
   exports, imports, flags, branches, or obsolete links from this diff.
5. **Contract:** for route/schema changes, discover existing generator scripts
   and commands first; regenerate and include the actual contract artifacts.
   Never hand-edit them or require app generators in artifact-only trees.
6. **Docs:** fix drift caused within the authorized scope. PRODUCT/behavior
   changes need approval. For skills-only work, verify frontmatter, relative
   links, index, inventory, and public-data hygiene.
7. **Gaps:** record discovered broken paths with
   `file-gap` under the resolved canonical gap schema
   when within authorized write scope, including separate private-repo approval.
   If gap writes are excluded, report the finding for the caller to file.
   Never create a second debt list, un-park deferred work, or archive an
   unverified fix.
8. **Write boundaries:** no credentials, personal data, private paths,
   infrastructure IDs, or internal URLs in tracked additions. No unauthorized
   edits to a private operations repo, bot skill stores, infrastructure, or
   deployed assets. Report external follow-up to its owner.

## Finish

Report checklist exceptions and residual gap IDs. Native CLI subagents hand off
authorized focused check results; the calling bot owns the serialized
`./scripts/ci-local.sh` gate for behavior changes, including Playwright.
Do not claim readiness before that gate passes. Docs/skills-only changes need
focused validation and no app CI. Leave commit, push, PR, merge, publication,
and installation to the explicitly authorized owner.
