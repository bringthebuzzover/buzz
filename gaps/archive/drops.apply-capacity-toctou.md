---
id: drops.apply-capacity-toctou
title: Apply can insert after finalize fills the last seat
kind: invariant_break
severity: P2
status: fixed
surface: drops
evidence:
  - path: backend/app/services/drops.py
    note: apply_to_drop now SELECT FOR UPDATE on drops.id before accepted_count / eligibility
  - path: backend/app/services/brands.py
    note: finalize_applicants already locks the drop; same row serializes apply vs last-seat finalize
  - path: backend/tests/test_apply.py
    note: AST contract with_for_update before _accepted_counts before drop_apply_eligibility
repro: |
  Drop capacity_total=1, window already closed. Org A starts POST apply (no
  drop lock). Concurrent brand finalize accepts org B (FOR UPDATE, last seat,
  sets finalized_at) and commits. Org A's accepted_count read raced before
  that commit, so drop_apply_eligibility still passes and flush inserts an
  APPLIED row. Unique index only blocks same-org double-apply. Sequential
  tests in test_apply.py do not cover this race.
fix_when: |
  apply_to_drop serializes against finalize (lock the drop row, then re-read
  accepted_count and applicant_selection_finalized_at) so a concurrent last-seat
  finalize yields CAPACITY_EXCEEDED or DROP_NOT_OPEN, never a new APPLIED row.
  Tests cover the race or an equivalent lock-order contract. Extra ACCEPTED
  seats must stay impossible (finalize's lock already holds that).
---

# Apply TOCTOU vs finalize capacity

**Shipped:** `apply_to_drop` locks `drops.id` (`FOR UPDATE`) before capacity /
eligibility. Concurrent last-seat finalize cannot insert an extra APPLIED row.
`closed_in` at commit.

Whole-repo Bugbot (drops slice) + independent verify. **Not** extra accepted
seats — finalize still gates accepts under `FOR UPDATE`.
