---
name: fix-gap-cluster
description: >-
  Run a BUZZ gap cluster from its resolved canonical queue: investigate,
  plan, implement, simplify, obtain caller CI, then archive only with approval.
---

# Fix gap cluster

Use for `run next cluster`, `run cluster <id>`, `swarm gaps`, or
`execute gap cluster`. Not for inventing clusters, whole-repo audits, or
un-parking deferred work without named IDs.

## Resolve sources and permissions

Run active-checkout discovery with
`buzz-coding-agent`.
Resolve canonical gap records, schema/close policy, queue, and locked approaches
from active instructions. Examples such as `gaps/README.md`,
`gaps/CLUSTERS.md`, and `.cursor/rules/gaps-tracker.mdc` apply only when
present and canonical. They may instead live in authorized private operations
sources. Use `file-gap` for new findings.

Do not create a local competing tracker. Missing queue/schema/access means
request the needed context before selection or writes. Private-repo status,
queue, and archive edits need explicit write authorization; if unavailable,
hand proposed changes to the caller and report the cluster as pending.
On artifact-only branches, code implementation/CI is not applicable; request
the authorized app task/context if a code fix is required.

## Execution spine

1. **Select:** read the canonical queue. For “next,” choose the first actionable
   pending cluster, resuming an actionable in-progress cluster when appropriate.
   Skip parked/deferred/ops/done items; ops work requires a named request.
   A named cluster selects only that cluster. Honor every `stop_if`.
2. **Explore:** read each record, evidence, callers, and tests. Verify the locked
   approach still matches current code. Use CLI subagents only where authorized;
   never delegate bots from this skill or trust unverified summaries. Ask on
   new product forks, conflicting sources, or a changed locked approach.
3. **Plan:** keep concrete tasks for implementation, simplify, checks, and
   authorized tracker updates. Tell the caller the cluster, IDs, and plan.
   Set queue/record status to in-progress only where authorized by the resolved
   schema and write scope; otherwise request caller-owned updates.
4. **Implement:** execute only the locked approach. Preserve auth/security
   invariants and unrelated changes; no drive-by refactors or neighboring work.
5. **Simplify:** run `simplify-pass`.
6. **Verify:** run only authorized focused checks discovered for this app.
   Native CLI subagents never run `./scripts/ci-local.sh`; the caller owns the
   serialized full gate on a fresh local test database. Behavior fixes need
   full green CI including Playwright before closure, even backend-only fixes.
   Missing/broken gate setup is a blocker, not a pass. Stress only on request.
7. **Archive:** only after verified acceptance and required green CI, move fixed
   records and set statuses under the canonical close policy, within explicit
   write scope. Where the schema uses an archive and `status: fixed`, preserve
   that convention and add `closed_in` only when known. Mark the queue done
   only after all required work is verified; otherwise leave it pending.
8. **Stop:** report IDs, changed files, checks, pending caller gate/tracker
   writes, residual risks, blockers, and remaining actionable queue items.
   Leave changes uncommitted; Git/PR/merge/deploy actions need separate approval.

Never archive on red CI, including setup failures before tests. Diagnose within
scope and report repeated blockers; do not bypass checks, mutate services, or
rerun shared gates without authorization. Do not edit unrelated plan files,
release held items, or change product decisions to make a cluster pass.
