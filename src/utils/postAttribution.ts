/**
 * Post attribution rules — enforces that a single post belongs to at most one campaign
 * (PRODUCT.md §4.3). The rule applies across all of an org's campaigns simultaneously.
 *
 * `canAssignPostToCampaign` returns `true` if the post is unlinked OR already linked to
 * the same campaign (re-linking is a no-op). The reason string is provided for UI copy
 * when the rule blocks an assignment.
 */

import type { PostCampaignLink } from "../types/socialPost";

export type PostAttributionResult = {
  allowed: boolean;
  /** Human-readable reason when `allowed` is false. */
  reason?: string;
  /** Application id this post is currently linked to (if any). */
  conflictingApplicationId?: string;
};

/**
 * Determine whether the given `postId` may be linked to `targetApplicationId`.
 * `links` should be the full set of links from `linksStore` (caller passes in the
 * snapshot to keep this function pure and easy to test).
 */
export function canAssignPostToCampaign(
  postId: string,
  targetApplicationId: string,
  links: readonly PostCampaignLink[]
): PostAttributionResult {
  const existing = links.find((l) => l.postId === postId);
  if (!existing) {
    return { allowed: true };
  }
  if (existing.applicationId === targetApplicationId) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: "This post is already linked to another campaign.",
    conflictingApplicationId: existing.applicationId,
  };
}
