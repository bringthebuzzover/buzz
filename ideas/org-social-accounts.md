---
id: org-social-accounts
title: Link Instagram and TikTok; aggregate across both
status: exploring
updated: 2026-08-25
---

# Dual-platform org accounts (IG + TikTok)

Brainstorm (2026-08-25). **Not committed behavior.** Promoting this needs an
explicit PRODUCT / UX lock ([`AGENTS.md`](../AGENTS.md) hard stop).

Related: [`ideas/org-precreate.md`](org-precreate.md) (decouple account
creation from Instagram OAuth), [`META.md`](../META.md) +
[`gaps/deploy.meta-business-verification.md`](../gaps/deploy.meta-business-verification.md)
(public IG login still tester-only).

## Desired motion

Orgs **link both** Instagram and TikTok. Buzz **aggregates** posts, engagement,
and reach **across both**. Campaigns are not Instagram-only: a TikTok-only org
(or an org that posts the drop on TikTok) still counts.

This is **not** “replace Login with Instagram with Login with TikTok.” It is
**connected social accounts** plus **platform-agnostic metrics**.

## What exists today

| Piece | Today |
| --- | --- |
| Org identity | Instagram Business Login **is** the Buzz user ([`PRODUCT.md`](../PRODUCT.md) §3.1, §6.1) |
| Login UI | Single **Continue with Instagram** |
| TikTok | Optional typed `organizations.tiktok_handle` (unverified). No OAuth, no token |
| Posts | `social_posts.platform` already `instagram \| tiktok`; sync only writes IG |
| Followers / estimated reach | One `organizations.follower_count` from IG Graph; brand `total_reach` = `SUM(follower_count)` of accepted orgs |
| Campaign aggregate likes/comments | Sum of **linked** posts (platform-blind already) |
| PRODUCT hint | §6.1: post selection **may** require connecting other accounts (e.g. TikTok) **in addition to** IG login |

## Open PRODUCT locks (do not implement until these are answered)

### 1. What is the Buzz login identity?

“Not Instagram-dependent” for **metrics** is different from “not Instagram-dependent”
for **having an account**.

| Option | Signup | Later login | TikTok-only org? |
| --- | --- | --- | --- |
| **A. IG login + connect TikTok** | Continue with Instagram (today) | IG | No — still need IG to exist |
| **B. `.edu` / claim is identity; both socials are connects** | Email invite or magic link ([org-precreate](org-precreate.md)); then Connect IG and/or Connect TikTok | Email or “continue with whichever is linked” | Yes |
| **C. Dual OAuth login** | Continue with IG **or** Continue with TikTok creates the user | Either linked provider | Yes, if they started on TT |

**A** is the smallest PRODUCT change (already sketched in §6.1) and does **not**
deliver “not Instagram-dependent” for onboarding. **B** pairs with org-precreate
and is the cleanest long-term identity (socials become attachments). **C** needs
account-linking rules (two signups, then “this TikTok is the same club”).

**Recommendation to lock:** **B** if the goal is truly platform-independent;
**A** as a v1 slice if we only need dual *metrics* while Meta BV is still the
login bottleneck.

### 2. Must they link both, or at least one?

Ideal copy says “link both.” Operating rule still needs a floor:

- Happy path: both connected.
- Allowed: IG-only, TikTok-only, or (during onboarding) neither until connect.
- Post selection / Graph-owned followers require **at least one** live token.
- Brand applicant row: show per-platform handles + per-platform followers, not
  a single unlabeled number.

### 3. How is estimated reach combined?

Today reach **is** IG followers (one number). Summing IG + TikTok followers
**double-counts** people who follow both. Options:

- **Sum** (simple; overstates; matches “aggregate across both” literally).
- **Show separately** + a labeled “combined (not unique)” total.
- **Max** of the two (understates).

Unique cross-platform audience is not knowable from either API.

### 4. Metric parity

IG insights (reach, saved, shares, reels watch time) will not 1:1 map to
TikTok Display API fields (views, likes, comments, shares). PRODUCT should
say which roll-ups are **summable across platforms** (likes, comments, post
count) vs **platform-native** (IG reach vs TT views).

## As-built implication (if promoted)

- Treat Instagram and TikTok as **connected accounts** on the org: tokens,
  handles, follower counts, reconnect, revoke — not a typed handle.
- Keep `social_posts.platform`; extend `metric_sync` with a TikTok Display API
  path (`video.list` / `video.query`) beside IG `/me/media`.
- Split `organizations.follower_count` into per-platform (or a child table);
  stop pretending one Graph number is “the org.”
- Campaign post picker lists both libraries; one-post-one-campaign stays
  (`UNIQUE(org_id, platform, external_id)` already).
- Erase / data-deletion: scrub both providers’ tokens and handles; keep
  numeric KPIs (§3.1.2 / §4.3).

## Ops (parallel to Meta)

TikTok Login Kit + Display API need a **TikTok for Developers** app, URL
verification, sandbox (≤10 testers), then **app review** (demo video; often
days–two weeks, no SLA). That is a second human dashboard track, independent
of Meta Business Verification / Advanced Access.

Until both reviews are Live, dual-link cannot be a public PLG promise.

## Out of scope unless locked

- Replacing IG login with TikTok-only login (identity swap).
- Content Posting API (Buzz reading posts, not publishing).
- Stories (already out for IG).
- Manual follower entry (still Graph/API-owned).
