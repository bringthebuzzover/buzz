/**
 * Social post domain types — posts owned by an org, optional links to a campaign
 * (one post can belong to at most one campaign across the system, PRODUCT.md §4.2).
 */

/** Supported social platforms in v1. */
export type SocialPlatform = "instagram" | "tiktok";

/** Latest periodic snapshot of post metrics (refreshed by demo clock). */
export type PostMetricsSnapshot = {
  likes: number;
  comments: number;
  /** When the snapshot was last refreshed by the demo clock. */
  fetchedAt: number;
};

/** A canonical social media post owned by an org. */
export type SocialPost = {
  id: string;
  orgId: string;
  platform: SocialPlatform;
  /** Post URL (canonical link to the post on the platform). */
  url: string;
  /** Optional thumbnail asset (URL or local key). */
  thumbnail?: string;
  /** Short caption/title shown in the selector UI. */
  caption: string;
  /** When the post itself was published on the platform. */
  postedAt: number;
  /** Latest metrics snapshot (refreshed periodically). */
  metrics: PostMetricsSnapshot;
};

/**
 * Link join row connecting a post to a campaign (an org's participation in a drop).
 * Uniqueness is enforced at the application layer via `utils/postAttribution`:
 * a single `postId` may appear in at most one link.
 */
export type PostCampaignLink = {
  /** Post id (also unique within the links table). */
  postId: string;
  /** Application id (the org's specific participation in a drop). */
  applicationId: string;
  /** Drop id (denormalized for fast lookup of "all posts in drop X"). */
  dropId: string;
  /** When the org linked this post to this campaign. */
  linkedAt: number;
};
