---
id: admin.add-tracking-wipes-draft
title: Second tracking number is wiped after Add tracking waits on admin refetch
kind: ux_hole
severity: P2
status: fixed
surface: admin
evidence:
  - path: frontend/src/api/hooks/useAdminHooks.ts
    note: useAdminMutation onSuccess returned invalidateQueries(["admin"]); mutateAsync waited on sidebar overview plus drop detail
  - path: frontend/src/pages/admin/AdminDropDetailPage.tsx
    note: ApplicantShipmentEditor now clears the input on click and restores on error
  - path: frontend/e2e/admin.spec.ts
    note: Test waits for the input to clear and for the second value to stick before click
repro: |
  Stress ×30 on 74f9e06 run 34785713203 shard 21. admin.spec "admin can add
  two tracking numbers on an accepted applicant": POST first number 200, list
  showed UPS #1ZE2EADD001, tracking input was empty, Add tracking stayed
  disabled until the 30s test timeout. 29/30 shards passed. Screenshot
  playwright-report-21.
fix_when: |
  mutateAsync after Add tracking does not wait on the ["admin"] refetch
  fan-out. Drop detail cache is seeded from the POST body so the new number
  appears without waiting on GET. The tracking field clears on click (restore
  on error), not after mutateAsync. E2E scopes to the Berkeley row, waits for
  the input to clear after the first POST, then asserts the second value
  stuck before click. Playwright retries stay 0.
---

# Add tracking wipes an in-flight draft

Same family as [`admin.publish-disabled-after-draft.md`](admin.publish-disabled-after-draft.md).

`useAdminMutation` awaited `invalidateQueries({ queryKey: ["admin"] })`. TanStack Query `mutateAsync` waits for `onSuccess` when it returns a promise. The admin sidebar always mounts `useAdminOverview()`, so Add tracking held `setTn("")` until overview **and** drop detail finished refetching.

Drop detail often landed first. The list showed `#1ZE2EADD001`, the E2E filled `999999999999`, then `setTn("")` ran and disabled Add tracking (`disabled={add.isPending || !tn.trim()}`). The failure screenshot is an empty tracking field with the first new UPS number already in the list.

## Fix

- `useAdminMutation` fire-and-forgets invalidate (same as `useCreateAdminDrop`).
- Add/delete shipment seed `["admin","drop", dropId]` from the mutation result.
- The editor clears the draft on click and restores it if the POST fails.
- E2E scopes to the Berkeley row, waits for empty, asserts the second value before click.
