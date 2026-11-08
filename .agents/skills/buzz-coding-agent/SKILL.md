---
name: buzz-coding-agent
description: >-
  BUZZ active-checkout discovery and coding handoff across app, design, and
  artifact branches: canonical sources, installed stack, checks, and approvals.
---

# BUZZ coding agent

Project layer for `bringthebuzzover/buzz`. Provider invocation, model selection,
sandbox setup, and usage tracking belong to the caller's native CLI guidance.
This skill does not authorize delegation to persistent OpenBot bots.

## Discover the active checkout first

Use this procedure before any dependent skill. Do not assume another branch's
layout, documentation, installed packages, deployment, or permissions.

1. Confirm the authorized repository root, current branch and working-tree state
   using read-only Git commands. Inspect the file inventory (for example,
   `rg --files --hidden`) before opening paths. Preserve unrelated changes.
2. Read applicable `AGENTS.md` instructions if present and the caller's current
   task/context pack. Source, PR target, rollout, and approval policy come from
   those instructions; do not infer them from a branch name. If instructions
   are absent or conflict, request the missing decision before dependent work.
3. Resolve product, architecture, testing, deployment, Meta, gaps, and ideas
   sources from those instructions. Some branches have root `PRODUCT.md`,
   `ARCHITECTURE.md`, `TESTING.md`, `DEPLOYMENT.md`, `META.md`, and `gaps/`;
   others direct them to the separate private operations repository. Verify each
   source exists and is authorized before reading it. Use a caller-supplied
   context pack if private access is unavailable; request missing sections.
   Do not create competing local docs/trackers or copy private material public.
4. Establish whether this is an app checkout. Inspect existing package manifests,
   lockfiles, scripts, source trees, tests, and tool configuration before choosing
   commands. Examples such as `frontend/package.json` and `backend/pyproject.toml`
   are candidates, not required paths. Determine actual versions and helpers.
5. Artifact/screenshot-only branches may have no app, instructions, or docs.
   Report app implementation/tests/contract/gap steps as not applicable there.
   Review authorized artifacts if relevant; request context if code work is
   required. Never invent app paths, install a stack, use production, or switch
   to another worktree/repository as an automatic fallback.
6. Record separately in discovery and the task plan/handoff: the active checkout
   root and app root (app root may be absent on artifact branches), canonical
   documentation source(s), canonical gaps/queue root, and verified project
   working directories for commands. Also record applicable steps, missing
   context, goal, approved decisions, acceptance criteria, exclusions, and allowed
   checks. Verify material claims against current files before patching.

Code, package, helper, generator, and test path examples are candidates relative
to the active app root, never the private documentation root. Product/documentation
paths and gap schema/queue paths are relative to their separately resolved
canonical documentation or tracker root. Run commands only from their verified
project working directory. Resolve skill-relative links from each SKILL.md's
directory. On artifact branches, a private docs/tracker root is not a substitute
app checkout. Skill-to-skill links are the only fixed file links.
Missing required sources block dependent work; optional absent primitives call
for an existing equivalent, not a new dependency.

## Implement and review

Use [ship-change](../ship-change/SKILL.md) for ordinary work or
[fix-gap-cluster](../fix-gap-cluster/SKILL.md) for clusters.
Visual work uses [design and brand](../buzz-design-and-brand/SKILL.md);
React work uses [patterns](../react-patterns/SKILL.md) and
[testing](../react-testing/SKILL.md).

In app checkouts, reuse existing services, API clients, generated types, and
shared primitives. Read relevant behavior sources and callers first; ask on
unapproved product forks. Keep lifecycle computations consistent across layers.

For route/schema changes, discover the actual contract generator and frontend
generation script before running them. Common candidates are
`backend/scripts/dump_openapi.py` and `frontend/`'s `gen:api` script.
Never hand-edit generated contracts or require generators in artifact branches.

Run [simplify-pass](../simplify-pass/SKILL.md) and authorized focused checks.
Native CLI subagents do not run `./scripts/ci-local.sh`; the caller owns the
serialized full gate on a fresh local test database where required by active
instructions. Report pending/full-gate failures honestly. Docs/skills-only work
uses focused validation; stress runs require a request.

## Boundaries and handoff

CLI subagents leave changes uncommitted. Commit, push, PR, merge, production
promotion, deploy, email, service writes, and private-repo writes require explicit
authorization for that action. Never push, force-push, or delete `main`, infer
approval from green checks, or release an item on hold without approval.
Deployment target must be established independently through authorized context
and verified metadata, never merely from the checked-out branch.

Report changed files, diff size/reasons for growth, exact checks/results,
non-applicable steps, pending caller gate, gaps, and blockers. Keep credentials,
personal data, private paths, infrastructure IDs, and internal URLs out of public
files. After an approved deployment, use
[operations](../buzz-staging-operations/SKILL.md) within its read/write boundaries.
