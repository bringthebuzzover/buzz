---
id: drops.creator-link-before-accept
title: A creator can link a post before the brand accepts them
kind: invariant_break
severity: P2
status: fixed
surface: drops
closed_in: 9153e54
evidence:
  - path: backend/app/services/creator_posts.py
    note: link_creator_post checks ownership only, then writes PostCampaignLink and content_state in_review
  - path: backend/app/models/post_link.py
    note: post_id is unique, so that early link occupies the post for one campaign
repro: |
  Active creator applies to an open creator drop (decision applied).
  Sync a post they own. POST /api/creators/posts/link with that application
  and post. Response is 200 and content_state becomes in_review.
  The same post cannot be linked to another campaign.
fix_when: |
  Link returns 400 unless that application decision is accepted.
  An applied or denied row gets no post_campaign_links row.
  An accepted creator can still link their own post, and a second campaign
  for the same post still returns 409.
---

# Linking before acceptance locks the post

Organization posts are linked from an accepted seat. Creator link skips that check. Because each post can belong to only one campaign, an early link also blocks a later accepted campaign from using it.
