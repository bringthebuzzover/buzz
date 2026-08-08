---
name: ship-change
description: >-
  Ship a non-cluster feature, fix, or chore: deep explore (parallel subagents
  when forked; always verify their findings), evidence-driven options, ask on
  PRODUCT forks, implement, simplify-pass, full ci-local, report residual gaps,
  stop for commit. Use when the user asks to implement a change that is not
  run next cluster / swarm gaps.
---

# Ship change

For work that is **not** a gap cluster (`fix-gap-cluster`). Agent map: [`AGENTS.md`](../../../AGENTS.md).

## Spine (in order)

### 1. Explore

1. Read relevant [`PRODUCT.md`](../../../PRODUCT.md) §§ and [`ARCHITECTURE.md`](../../../ARCHITECTURE.md).
2. Check related `gaps/*.md` for the surface.
3. For non-trivial or forked questions, launch **parallel subagents** (backend vs frontend, PRODUCT vs as-built, option A vs B, correctness vs UX). Parent synthesizes.
4. **Verify subagent findings** before coding: open cited files, confirm claims, resolve disagreements between agents. Treat unverified summaries as incomplete explore.
5. Brainstorm options; prefer evidence (code, tests, PRODUCT citations). Say when guessing.

### 2. Gate product forks

6. If the change would alter PRODUCT/UX/behavior, **stop and ask** before coding.

### 3. Implement

7. Prefer existing patterns; minimal scope.
8. Mark progress with todos when the work has multiple steps.

### 4. Simplify

9. Run [`.agents/skills/simplify-pass/SKILL.md`](../simplify-pass/SKILL.md).

### 5. Full CI

10. From repo root:

   ```bash
   ./scripts/ci-local.sh
   ```

   Must be green (includes Playwright E2E). Stress ×N only if the user asks.

### 6. Stop

11. Report what changed, residual gaps / risk, CI result.
12. **Do not commit or push** unless the user explicitly asks.

## Non-negotiables

- No PRODUCT drift without ask.
- No Railway/Meta/Resend mutate without ask.
- No secrets in git.
- Do not skip simplify-pass or `ci-local` for behavior-touching work.
- Never act on unverified subagent findings.
