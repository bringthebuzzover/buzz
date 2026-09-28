---
id: org-social-accounts
title: Link Instagram and TikTok; aggregate across both
status: exploring
updated: 2026-09-28
---

# Dual-platform org accounts (IG + TikTok)

Brainstorm (2026-08-25; locks 2026-09-28). **Not PRODUCT.** [`PRODUCT.md`](../PRODUCT.md)
§6.1 / §11 still say typed TikTok handle only and OAuth out of v1. Promoting
into shipped behavior needs an explicit PRODUCT / UX edit — do not implement
from this file alone ([`AGENTS.md`](../AGENTS.md) hard stop).

Related: [`archive/org-precreate.md`](archive/org-precreate.md),
[`campus-creators.md`](campus-creators.md) (later participant kind; socials as
attachments), [`META.md`](../META.md),
[`gaps/deploy.meta-business-verification.md`](../gaps/deploy.meta-business-verification.md).

Lovable’s workspace TikTok connector is **not** the integration (one shared
account, no per-org OAuth). Implementation, when PRODUCT allows, is Login Kit
and Display API per org.

---

## Locked for later (option A) — 2026-09-28

Intent if/when this ships. **B** and **C** (email identity / dual OAuth login)
are not this slice.

1. **Identity is A.** Instagram remains login and portal gate. TikTok is an
   optional connector on an **already-active** org. No TikTok-only Buzz orgs.
   No Continue with TikTok as signup.
2. **Connecting TikTok is optional.** IG-only orgs stay valid. Copy may still
   say “link both.” No apply/finalize rule that requires a live TikTok token.
3. **Dead TikTok does not close the portal.** Expired/revoked TT → reconnect on
   org profile. `/reconnect-instagram` stays IG-only. Disconnect TikTok does
   not log them out or bump `token_version`.
4. **Estimated reach stays Instagram `follower_count`.** Do not sum IG + TT.
   TikTok followers, if shown, are a **separate** labeled number. Unique
   cross-platform audience is not a product claim.
5. **Roll-ups:** likes, comments, and linked post count stay platform-blind.
   IG reach / saved / reel watch time stay IG-native. TT `view_count` / shares
   stay TT-native until a later PRODUCT pass.
6. **Typed handle on apply stays.** Optional unverified `tiktok_handle` on
   apply/profile until OAuth. After connect, handle and TT follower count are
   API-owned (same spirit as claimed IG vs bind). Switching TikTok is
   disconnect + reconnect — **not** the IG identity-change ticket (§3.1.4).
7. **Campaign deliverable:** a linked **Instagram or TikTok** post can satisfy
   “they posted.” No must-post-on-both gate in this slice (a later campaign
   flag could add that).
8. **Architecture:** store TikTok as an **org-attached** account (tokens /
   `open_id` on the org or a child social table), not as a second login on
   `users`. Keeps A compatible with later creators / extra networks
   ([`campus-creators.md`](campus-creators.md)).
9. **Public promise:** do not market dual-platform metrics as PLG until the
   TikTok developer app is **Live** (sandbox testers only until then).

### Still deferred (do not invent at implement time without asking)

- Autolink TikTok posts (skip vs hashtag-only).
- Brand applicant row chrome (two follower chips vs IG-only until TT connected).
- `media_product_type` mapping for TT videos.
- Labeled “combined (not unique)” reach total vs two numbers only.
- TikTok admin mismatch / identity-change queue.

---

## Desired motion (longer-term, not A)

Orgs **link both** Instagram and TikTok. Buzz **aggregates** posts, engagement,
and reach **across both**. That “TikTok-only org” / not-Instagram-dependent
onboarding is **B/C**, not the locked slice above.

This is **not** “replace Login with Instagram with Login with TikTok.” It is
**connected social accounts** plus **platform-agnostic metrics**.

## What exists today

| Piece | Today |
| ----- | ----- |
| Org identity | Instagram Business Login **is** the Buzz user ([`PRODUCT.md`](../PRODUCT.md) §3.1, §6.1) |
| Login UI | Single **Continue with Instagram** |
| TikTok | Optional typed `organizations.tiktok_handle` (unverified). No OAuth, no token |
| Posts | `social_posts.platform` already `instagram \| tiktok`; sync only writes IG |
| Followers / estimated reach | One `organizations.follower_count` from IG Graph; brand `total_reach` = `SUM(follower_count)` of accepted orgs |
| Campaign aggregate likes/comments | Sum of **linked** posts (platform-blind already) |
| PRODUCT | §6.1 typed TT handle; §11 OAuth / dual metrics **out of v1** |

## Historical options (identity)

| Option | Signup | Later login | TikTok-only org? |
| --- | --- | --- | --- |
| **A. IG login + connect TikTok** | Continue with Instagram (today) | IG | No — **locked for later** |
| **B. `.edu` / claim is identity; both socials are connects** | Email / magic link; then Connect IG and/or TT | Email or linked provider | Yes — not this slice |
| **C. Dual OAuth login** | Continue with IG **or** TT creates the user | Either | Yes — not this slice |

## As-built implication (when PRODUCT promotes A)

- Org-attached TikTok OAuth: tokens, `open_id`, reconnect, revoke. Typed handle
  remains until first successful connect, then API-owned.
- Keep `social_posts.platform`; extend `metric_sync` with Display API
  (`video.list` / `video.query`) beside IG `/me/media`. Access tokens are ~24h;
  refresh tokens ~365d and may rotate — needs its own refresh job, not IG’s
  14-day window.
- Do **not** overwrite `organizations.follower_count` with TikTok stats; add a
  separate TT follower field. Brand estimated reach stays the IG sum.
- Campaign post picker lists both libraries when TT is connected; one-post-one-
  campaign stays (`UNIQUE(org_id, platform, external_id)`). Linked IG **or**
  TT counts as posted.
- Erase / TikTok data-deletion callback: scrub TT tokens and handle; keep
  numeric KPIs (§3.1.2 / §4.3).

## Ops (parallel to Meta)

TikTok Login Kit + Display API need a **TikTok for Developers** app, URL
verification, sandbox (≤10 testers), then **app review** (demo video; often
days–two weeks, no SLA). Independent of Meta Business Verification.

Until the TikTok app is Live, dual-link cannot be a public PLG promise.

## Out of scope unless locked

- Replacing IG login with TikTok-only login (identity swap).
- Content Posting API (Buzz reading posts, not publishing).
- Stories (already out for IG).
- Manual follower entry (still Graph/API-owned).
- Summing IG + TikTok followers into one unlabeled reach number.
