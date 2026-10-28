---
id: org.erased-unlinked-apply-prefills
title: Already-erased orgs can leave unlinked apply drafts
kind: ops
severity: P3
status: ops
surface: org
evidence:
  - path: backend/app/services/erased_org_participation.py
    note: Migration deletes org_apply_prefills only by used_by_user_id
  - path: backend/app/services/admin_erase.py
    note: A new erase also matches edu email and claimed handle before those columns are nulled
repro: |
  An org erased before this freeze migration already has a null edu_email and a
  null claimed handle. An org_apply_prefills row that stored that email or
  handle but never set used_by_user_id is not selected by the migration. Read
  production with a count of prefills whose used_by_user_id is null and whose
  edu_email, invite_email, or instagram_handle is still set. Do not print the
  values.
fix_when: |
  Production has no apply-draft row that still stores an email, handle, or
  shipping address for an org erased before the freeze migration, or those
  rows have been deleted in a reviewed one-off. New erases already delete
  drafts matched by user id, email, or handle.
---

# Unlinked apply drafts after an earlier erase

New erases delete `org_apply_prefills` by `used_by_user_id`, by the school
email still on the user, and by the claimed Instagram handle, and they do that
before those columns are cleared.

Orgs already `status = erased` had those columns cleared by the previous erase
path. The migration can still delete drafts linked by `used_by_user_id`. It
cannot find a draft that only stored the old email or handle. That row, if it
exists, still has Platform-adjacent identity (handle, email, shipping).

This is an ops check against production, not a change to the new erase path.
