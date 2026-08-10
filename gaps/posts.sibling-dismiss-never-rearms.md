---
id: posts.sibling-dismiss-never-rearms
title: Sibling dismiss never rearms suggestions
kind: invariant_break
severity: P2
status: wontfix
surface: org
evidence:
  - path: backend/app/services/posts.py
    note: _confirm_own_and_dismiss_siblings / _dismiss_pending_for_post; unlink clears confirmed_at only
  - path: PRODUCT.md
    note: §4.2 one-post-one-campaign hard constraint; §6.4.2 org selects posts under that rule
  - path: frontend/src/pages/admin/AdminDropDetailPage.tsx
    note: Admin Attribution tab is counts only — no per-post verify/override
repro: |
  Org has active campaigns A and B. Autolink mints pending suggestions for the
  same post on both. Org accepts (or manually links) on A → B's suggestion gets
  dismissed_at. Org unlinks from A → A's confirmed_at clears (can re-suggest);
  B's dismissed_at stays set (no rearm). Manual link to B still works.
fix_when: |
  N/A — wontfix unless PRODUCT reverses. If reversed: document Locked v1
  (rearm-on-unlink vs admin override vs copy-only), implement, archive with
  closed_in. Do not delete this file solely to “clean up” the decision.
---

# Sibling dismiss never rearms (wontfix)

Audit triage: **wontfix / product accept**. Kept living so the decision, failure
modes, and rejected alternatives stay visible.

## Plan verification

**Verdict: WONTFIX_OK**

Code matches the claim: accept/link dismisses sibling pending suggestions
(`_confirm_own_and_dismiss_siblings` / `_dismiss_pending_for_post`); unlink only
clears `confirmed_at` for the owning `(post, application)` — never clears sibling
`dismissed_at`. No rearm path for dismissed siblings. Intentional under
**PRODUCT §4.2** one-post-one-campaign.

## Why the behavior exists

- A post may be suggested for **multiple** campaigns (caption matches more than
  one brand handle / drop).
- Once the post is attributed to one campaign, siblings on other campaigns can
  never be accepted without violating one-post-one-campaign
  (`UNIQUE(post_id)` on `post_campaign_links`).
- Dismissing siblings prevents zombie “Accept suggestion” rows on losing
  campaigns.
- Unlink **re-arms the winner only** (clear `confirmed_at`) so the same campaign
  can get the suggestion again — the recommended architecture §7.4.2 path.

## User impact

| Actor | Effect |
| ----- | ------ |
| Org (happy path) | None — siblings vanishing after a correct link is expected. |
| Org (change of mind A → B) | Autolink “Accept” for B typically stays gone; **manual link to B still works** after unlink from A. |
| Brand | None in the happy path; aggregates count linked posts only. |
| Admin | No per-post verify/override today (Attribution = counts). Ops workaround: **View as** org → unlink/link. |

**Not a hard dead-end for attribution.** The loss is convenience (re-suggestion on
the other campaign), not the ability to attribute the post.

## Failure / edge scenarios

1. **Wrong campaign accepted first**  
   Org accepts suggestion on A by mistake → unlinks A → wants B.  
   **Outcome:** B’s old suggestion stays dismissed; org must **manually link** on B
   (or wait for product/scan changes that do not exist today).

2. **Temporary park on A**  
   Org links to A while deciding, then unlinks to move to B.  
   **Same outcome** as (1) for B’s autolink path.

3. **Sibling never existed**  
   Only one campaign ever had a suggestion; unlink/rearm behaves normally for
   that campaign. This gap does not apply.

4. **Finished campaign**  
   Link/unlink blocked once `drop_finished` (`_reject_if_drop_finished`). Wrong
   attribution late in life needs ops/View-as before finish, or a future
   override — not covered by this gap’s wontfix.

5. **Admin expects to “fix” from the panel**  
   Admin drop Attribution shows counts only. There is **no** admin
   accept/dismiss/unlink/force-relink API. Expectation mismatch is an ops UX
   hole (PRODUCT Later mentions override paths) — separate from sibling rearm.

6. **Dual Cookie / race (unrelated)**  
   Concurrent org tabs linking the same post → `POST_ALREADY_LINKED` (409).
   Sibling dismiss is not the failure mode there.

## Options considered (not implementing while wontfix)

| Option | Pros | Cons / why not MVP |
| ------ | ---- | ------------------ |
| **A. Status quo (chosen)** | Simple; matches §4.2; manual link works; View-as for ops | Rare convenience loss on A→B autolink |
| **B. UX copy only** | Cheap; sets expectation at accept/link | Does not restore B’s suggestion; still need manual link |
| **C. On unlink, clear sibling `dismissed_at`** | Autolink returns on other campaigns after unlink | PRODUCT reverse; other campaigns suddenly re-light; need eligibility rules (still active? already linked elsewhere?) |
| **D. Admin override (unlink/relink + audit note)** | Best ops lever; matches PRODUCT Later “exception / override” | New admin API + UI; larger than this edge case |
| **E. Email / in-app notify on sibling dismiss or link** | Could warn “removed from other campaigns” | Noisy; email honesty/ledger debt; no attribution inbox today |
| **F. Brand “flag wrong post”** | Brand-driven correction | Heavy; brand is not the attribution owner in v1 |

## Locked decision (current)

- **Keep wontfix** for sibling rearm-on-unlink.
- **Do not** add notification/email for this path in v1.
- **Ops:** use View-as → org unlink/link; do not pretend admin Attribution can override.
- **If volume grows:** prefer filing a **new** gap for admin override (option D),
  not silently reversing this wontfix. Option C only with explicit PRODUCT ask.

## Related

- PRODUCT §4.2 (one-post-one-campaign), §6.4.2 (org selects posts).
- PRODUCT Later: admin tooling for reopen / exception / Buzz override paths.
- `ops.email-ledger` — do not route this edge case through email until ledger
  honesty exists and PRODUCT asks for it.
- Admin Attribution counts: `AdminDropDetailPage` + `admin_read` pending
  suggestion / linked post counters.
