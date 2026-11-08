---
name: file-gap
description: >-
  Record a verified BUZZ broken path in the active checkout's canonical gaps
  source and schema, respecting private-source access and write authorization.
---

# File a gap

Run [source discovery](../buzz-coding-agent/SKILL.md#discover-the-active-checkout-first)
before filing. Resolve the canonical gap root, schema, status vocabulary, and
close policy from active instructions or an authorized context pack.
Local `gaps/README.md` is only one possible source; some branches keep the
tracker in the private operations repository. Do not create a competing local
tracker when sources moved private.

## Steps

1. Confirm a broken path today, not a future product idea. Verify evidence
   against the active app or authorized artifacts; if required code/context is
   missing, report that limitation rather than inventing a gap.
2. Verify read access and explicit authorization for writes to the canonical
   destination. An app coding request does not authorize private-repo edits.
   If blocked, provide a concise proposed finding/schema fields to the caller
   for filing; do not write a substitute tracker or expose private context.
3. Read the actual schema before writing. Where it uses `gaps/<id>.md`, choose
   an ID such as `auth.example-hole` with matching filename/frontmatter ID.
   Typical fields include title, kind, severity, status, surface, evidence,
   repro, and fix_when; use the canonical required fields/enums, not a copied
   universal template.
4. Include current evidence, a read-only-safe repro, acceptance criteria, and
   relevant links. Use obviously fake data, never secrets or personal data.
5. If batching and authorized, add the ID to the resolved canonical cluster
   queue with its locked approach. Do not invent a parallel queue or mega-list.

## Close and hold boundaries

Follow the canonical archive/status policy; do not delete gap records or mark
an unverified fix complete. Do not un-park deferred work unless the user names
it, or change product behavior without approval. Report the record ID/location,
verification, and any caller-owned filing/approval still needed.
