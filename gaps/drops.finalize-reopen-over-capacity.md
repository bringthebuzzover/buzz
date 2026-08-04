---
id: drops.finalize-reopen-over-capacity
title: Finalize after reopen can exceed capacity and unit budget
kind: invariant_break
severity: P1
status: open
surface: drops
evidence:
  - path: backend/app/services/brands.py
    note: finalize_applicants checks len(allocations)/unit sum only against currently applied rows
  - path: backend/app/services/admin.py
    note: reopen clears finalized_at for pre-live and leaves prior accepted seats
repro: |
  ```sql
  SELECT d.id, d.title, d.capacity_total, count(a.id) AS accepted
  FROM drops d JOIN drop_applications a ON a.drop_id = d.id AND a.decision = 'accepted'
  GROUP BY d.id HAVING count(a.id) > d.capacity_total;
  ```
fix_when: |
  Finalize validates cumulative accepted seats and allocated units across reopen rounds.
---

Capacity and unit budget are validated per finalize call, not cumulatively:
`finalize_applicants` (in `brands.py`) compares `len(allocations)` against
`capacity_total` and the current request's unit sum against `total_product_units`,
and only re-decides rows that are currently `applied`. After a reopen and a second
round, both ceilings are exceedable.

```sql
SELECT d.id, d.title, d.capacity_total, count(a.id) AS accepted
FROM drops d JOIN drop_applications a ON a.drop_id = d.id AND a.decision = 'accepted'
GROUP BY d.id HAVING count(a.id) > d.capacity_total;

SELECT d.id, d.title, d.total_product_units, sum(a.allocated_units) AS allocated
FROM drops d JOIN drop_applications a ON a.drop_id = d.id AND a.decision = 'accepted'
WHERE d.total_product_units IS NOT NULL
GROUP BY d.id HAVING sum(a.allocated_units) > d.total_product_units;

SELECT a.id FROM drop_applications a JOIN drops d ON d.id = a.drop_id
WHERE a.decision = 'accepted' AND d.total_product_units IS NOT NULL
  AND (a.allocated_units IS NULL OR a.allocated_units = 0);
```
