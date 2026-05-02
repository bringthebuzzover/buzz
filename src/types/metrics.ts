/**
 * Aggregated metrics types used by per-drop and aggregate brand dashboards.
 * Computed by `utils/metrics` from raw `SocialPost` snapshots and `PostCampaignLink` rows.
 */

/** Aggregated metrics for a single drop (rolled up across all orgs). */
export type DropAggregateMetrics = {
  dropId: string;
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  /** likes + comments. */
  totalEngagement: number;
  /** Estimated reach (sum of participating org follower counts; v1 definition). */
  totalReach: number;
  /** Cost per engagement; `null` in v1 (no cost inputs). */
  costPerEngagement: number | null;
};

/** Aggregated metrics across all of a brand's drops. */
export type BrandAggregateMetrics = {
  brandId: string;
  totalDrops: number;
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  totalEngagement: number;
  totalReach: number;
  /** Distinct orgs that participated across all the brand's drops. */
  totalOrgs: number;
  /** Distinct campuses (location strings) reached. */
  totalCampuses: number;
};

/** A single point in the brand engagement-over-time chart. */
export type EngagementTimeSeriesPoint = {
  /** Timestamp at which engagement was sampled. */
  timestamp: number;
  /** Total engagement (likes + comments) at this point. */
  engagement: number;
};
