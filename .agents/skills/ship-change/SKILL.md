---
name: ship-change
description: >-
  Implement a non-cluster BUZZ feature, fix, or chore: investigate, resolve
  product forks, implement, simplify, verify, and hand off for caller-owned
  full CI and authorized feature-branch workflow from current instructions.
---

# Ship change

For work outside a gap cluster. Run active-checkout/source discovery in
`buzz-coding-agent` first. Cluster work uses
`fix-gap-cluster`.

## Explore and decide

1. Confirm the assigned branch/checkout and scope; preserve unrelated work.
2. Read resolved product/architecture guidance, related canonical gaps, callers,
   and tests. Sources may be local or caller-authorized private context. If
   this is an artifact-only branch, report code steps as not applicable; request
   missing app context before dependent work, without changing trees automatically.
3. Where authorized, use CLI subagents for independent non-trivial questions;
   do not delegate OpenBot bots. A caller's no-delegation instruction wins.
   Verify material findings against cited files before acting on them.
4. Compare options using evidence; state uncertainty. Stop for approval on
   unapproved PRODUCT/UX/behavior forks. Visual work follows
   `buzz-design-and-brand`.
5. Keep a task-specific plan for multi-step work; mark steps complete only
   after verification.

## Implement and simplify

Prefer the smallest complete fix and existing helpers/primitives. Cover API,
SPA, jobs, and generated contracts only as the task requires. Do not expand into
unrelated refactors, dependencies, infrastructure writes, or deferred gaps.
Run `simplify-pass` before claiming done.

## Verify and hand off

Run authorized focused checks from the discovered test scripts/configuration
and resolved testing guidance; verify paths and prerequisites before running.
Behavior changes require the full local gate including Playwright before being
declared ready. Native CLI subagents never run `./scripts/ci-local.sh`: the
calling bot runs it serially on a fresh local test database. If the caller has
not run it yet, report the gate as pending rather than claiming green.
Docs/rules/skills-only work uses focused validation, not app tests.
Stress runs require an explicit request.

Report changed files, diff size and justification for growth, exact commands and
results, gaps/residual risk, and blockers. Leave changes uncommitted for caller
review. Coding authorization does not authorize commit, push, PR, merge, deploy,
or external messages. The caller owns those actions when explicitly approved.

Follow the discovered checkout instructions and current caller context for
app/skill-source branch policies. Never push, force-push, or delete `main`, release an item on hold,
or promote production without approval.
