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
    note: A new erase also matches unclaimed drafts by edu email and claimed handle before those columns are nulled. Drafts already used by another account are kept.
  - path: backend/app/erased_apply_prefills.py
    note: Reviewed one-off count/delete. Status stays ops until the delete has been run in production.
repro: |
  An org erased before this freeze migration already has a null edu_email and a
  null claimed handle. An org_apply_prefills row that stored that email or
  handle but never set used_by_user_id is not selected by the migration. Read
  production with the count command below. It prints counts and row ids only.
fix_when: |
  Production has no apply-draft row that still stores an email, handle, or
  shipping address for an org erased before the freeze migration, or those
  rows have been deleted in a reviewed one-off. New erases delete drafts
  claimed by that user, and unclaimed drafts matched by email or handle.
---

# Unlinked apply drafts after an earlier erase

Orgs erased before migration `e0f1a2b3c4d5` already had a null school email and
a null claimed handle. That migration deletes `org_apply_prefills` only where
`used_by_user_id` is the erased user. A draft that never set
`used_by_user_id` and only stored the old email, handle, or shipping address
stays.

New erases still delete drafts claimed by that user, and unclaimed drafts
whose school email or Instagram handle matches, and they do that before those
columns are cleared. A draft already used by a different account stays. A
blank email or handle matches nothing. This one-off does not change that path
and does not touch the Meta reviewer path.

## Matching

`count` and `delete --yes` use the same rules. A row is in the set when either
of these holds:

1. `used_by_user_id` is an org user with `status = erased`.
2. `used_by_user_id` is null, and `edu_email` or `invite_email` equals the
   recipient of an org-erasure message Resend still lists. The draft's
   `created_at` is at or before the earliest such message for that address.
   When a non-erased user currently has that address on `edu_email` or
   `pending_edu_email`, unclaimed drafts for it stay.

An org-erasure message has the subject `Your Buzz account data has been
deleted` and a body that contains `Instagram credentials`. That phrase is in
the original org template and the current one. Brand erasure uses the same
subject and a different body, so those recipients are ignored. Addresses are
trimmed and lowercased. A blank address matches nothing.

Handle text and shipping text are not match keys. The erased org no longer
stores them, and a live applicant's pending draft stores them too. When a row
is deleted for an email or user-id match, the handle and shipping on that row
go with it.

The earliest message is the cutoff, so a draft created after the first
org-erasure email for that address stays. That includes a later prefill sent
to the same address. A draft whose `used_by_user_id` is some other account
stays even when the email matches.

If Resend no longer lists an org-erasure message for an address (the send
failed, or the message is outside the list), an unclaimed draft for that
address stays. `org_erasure_notices=0` after a successful scan means nothing
was attributed that way. `unclaimed` counts every draft with a null
`used_by_user_id`, including live applicants. Only `id=` lines are the delete
set.

`count` rolls back. `delete --yes` recomputes the set and deletes it in one
transaction. A draft claimed by someone else between the select and the
delete stays. `delete` without `--yes` writes nothing. The command refuses to
run when `RESEND_API_KEY` is unset or the Resend scan errors, so a partial
list is not applied.

## Run

After this revision is on the production API, from Lawrence's laptop, run
count first:

```
railway ssh -p cd2769a4-2518-4714-8ef6-03209a75230d -e production -s api -- sh -c 'cd /app && .venv/bin/python -m app.erased_apply_prefills count'
```

Read `matched`, `unclaimed`, `org_erasure_notices`, and the `id=` lines. The
output has no emails, handles, or addresses. Then:

```
railway ssh -p cd2769a4-2518-4714-8ef6-03209a75230d -e production -s api -- sh -c 'cd /app && .venv/bin/python -m app.erased_apply_prefills delete --yes'
```

That prints `deleted=<n>`. This file stays `status: ops` until that delete has
been run.
