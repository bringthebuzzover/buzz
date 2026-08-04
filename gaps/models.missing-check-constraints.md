---
id: models.missing-check-constraints
title: No DB CheckConstraints for capacity, units, or apply window
kind: invariant_break
severity: P1
status: deferred
surface: models
evidence:
  - path: backend/app/models
    note: zero CheckConstraint in models or migrations
repro: |
  ```sql
  -- capacity_total <= 0, total_product_units <= 0, apply_open_at > apply_close_at all storable
  SELECT id FROM drops WHERE capacity_total <= 0 OR apply_open_at > apply_close_at;
  ```
fix_when: |
  Migrations enforce non-positive capacity/units and open<close (and related invariants) at the DB layer.
---

There are zero `CheckConstraint` declarations in `backend/app/models/` and zero in
`backend/migrations/versions/`. Also unconstrained: `capacity_total <= 0`,
`total_product_units <= 0`, and `apply_open_at > apply_close_at` are all storable.

Related probes for stranded / missing profile rows:

```sql
SELECT a.id FROM drop_applications a JOIN drops d ON d.id = a.drop_id
WHERE a.decision = 'applied' AND d.applicant_selection_finalized_at IS NOT NULL;

SELECT u.id, u.portal_role FROM users u
LEFT JOIN organizations o ON o.user_id = u.id
WHERE u.status = 'active' AND u.portal_role = 'org' AND o.id IS NULL;
```
