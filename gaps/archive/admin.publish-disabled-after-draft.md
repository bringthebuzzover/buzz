---
id: admin.publish-disabled-after-draft
title: Publish stays disabled after a successful Save draft until ticket refetch lands
kind: ux_hole
severity: P2
status: fixed
surface: admin
evidence:
  - path: frontend/src/pages/admin/AdminDropRequestDetailPage.tsx
    note: Publish enablement is linkedDrop from ticket.convertedDropId refetch, not the create POST body
  - path: frontend/src/pages/admin/AdminDropRequestDetailPage.tsx
    note: Placeholder Publish uses the same data-testid as the live button and is always disabled
  - path: frontend/src/api/hooks/useAdminHooks.ts
    note: useCreateAdminDrop only invalidates ["admin"]; index.tsx staleTime is 30s
  - path: frontend/e2e/admin.spec.ts
    note: Waits for getByTestId("publish-drop") toBeEnabled after POST 200
repro: |
  Stress ×10 on 5a5ec70 run 33176288682 shard 10. admin.spec "admin saves a
  draft from a ticket and publishes it": POST /api/admin/brands/.../drops 200,
  then getByTestId("publish-drop") stayed disabled 10s (the placeholder
  control). 9/10 shards passed.
fix_when: |
  Save draft adopts the create response (or seeds the drop + ticket query
  cache) so Publish enables without waiting on convertedDropId refetch.
  data-testid="publish-drop" is only on the live control. Component test
  covers save → Publish enabled. E2E draft-and-publish still green.
  Playwright retries stay 0.
---

# Publish disabled after Save draft

Admin ticket detail shows a disabled **Publish** stub until
`ticket.convertedDropId` is set and `GET /api/admin/drops/:id` returns. Save
draft's `POST` already returns that drop. Invalidate-and-refetch of the whole
`["admin"]` key space (30s `staleTime`) can leave the stub up long enough for
E2E `toBeEnabled` (10s) and for a human to think Publish is broken.

The stub and the live button share `data-testid="publish-drop"`, so Playwright
attaches to the stub and waits for it to become enabled — it never does.

## Locked

1. **Use the create response.** After `create.mutateAsync`, keep that
   `AdminDropDetail` as the linked draft until the ticket query supplies the
   same id (prefer query data when present).
2. **testid only on the live Publish** (the one that can fire). Stub stays
   visible+disabled for humans, no colliding test id.
3. Component test: fill required fields, save resolves a drop, Publish
   enables. No Playwright `retries`.
