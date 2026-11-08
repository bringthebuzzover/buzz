---
name: buzz-coding-agent
description: >-
  BUZZ coding-agent brief and handoff: repository sources, implementation and
  review loop, feature branches into staging, caller-owned gate, and approvals.
---

# BUZZ coding agent

Project layer for work on `bringthebuzzover/buzz`. Read
[AGENTS.md](../../../AGENTS.md) first. Provider invocation, model selection,
sandbox setup, and usage tracking belong to the caller's native CLI guidance;
do not embed host wrappers, private briefs, or provider flags here. This skill
does not authorize delegation to persistent OpenBot bots.

## Establish scope

1. Confirm the assigned checkout, branch, working-tree state, goal, acceptance
   criteria, approved decisions, exclusions, and checks. Preserve unrelated work.
2. Read relevant [PRODUCT.md](../../../PRODUCT.md),
   [ARCHITECTURE.md](../../../ARCHITECTURE.md), tests, and related
   [gaps](../../../gaps/). Investigate before patching; ask on unapproved product forks.
3. Use [ship-change](../ship-change/SKILL.md) for ordinary features/fixes/chores
   or [fix-gap-cluster](../fix-gap-cluster/SKILL.md) for cluster work.
   Visual work also uses [design and brand](../buzz-design-and-brand/SKILL.md).
4. Handoffs include relevant repo-relative paths, evidence, decisions, line
   budget if supplied, and verification requirements. Keep private operational
   context outside the public repository.

## Implement and review

- Backend uses FastAPI, async SQLAlchemy, Pydantic, and Poetry under
  [backend](../../../backend/README.md). Reuse services and keep routes thin.
- Frontend is a React 18 / TypeScript SPA. Follow
  [React patterns](../react-patterns/SKILL.md) and
  [React testing](../react-testing/SKILL.md).
- Regenerate contracts after route/schema changes: from `backend/`,
  `poetry run python scripts/dump_openapi.py`; from `frontend/`, `npm run gen:api`.
  Never hand-edit generated contract files.
- Keep backend and frontend drop lifecycle computations consistent. Check
  callers, tests, and PRODUCT before changing stage behavior.
- Prefer the smallest complete fix and existing helpers. No drive-by changes,
  new dependencies, or unrequested persistent writes.
- Run [simplify-pass](../simplify-pass/SKILL.md). Run authorized focused checks
  from [TESTING.md](../../../TESTING.md), recording exact commands and outcomes.
  Native CLI subagents do not run `./scripts/ci-local.sh`; the calling bot owns
  the serialized full gate on a fresh local test database. Full CI including
  Playwright remains required for behavior changes before declaring readiness.
  Docs/skills-only work needs focused validation. Stress runs require a request.
- The caller reviews the diff and public-data hygiene, obtains a fresh review
  when appropriate, fixes findings, and repeats until ready.

## Branch and approval boundaries

Follow [AGENTS.md](../../../AGENTS.md#branching) for app and skill-source branch
policies. App production promotion requires separate approval.
Never push, force-push, or delete `main`; never infer merge or production
approval from green checks. Do not release an item on hold without explicit approval.

CLI subagents leave changes uncommitted. The calling bot owns authorized Git
operations and PRs; a coding request alone does not authorize commit, push, PR,
merge, deploy, email, or service writes. After an approved staging merge, use
[staging operations](../buzz-staging-operations/SKILL.md) to verify the intended
deployment without promoting it.

Report changed files, diff size and reasons for growth, exact checks/results,
pending caller gate, residual gaps, and blockers. Never put credentials, real
contact data, private host paths, infrastructure identifiers, or internal URLs
in tracked code, fixtures, docs, or handoffs.
