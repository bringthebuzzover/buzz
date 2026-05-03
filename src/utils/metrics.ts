/**
 * Pure metric helpers used by per-drop and aggregate dashboards.
 *
 * - Engagement = likes + comments per post.
 * - Reach = sum of follower counts of accepted orgs in a drop (v1 approximation).
 * - Cost-per-engagement is `null` in v1 (no cost inputs in the mock store).
 *
 * These helpers take fully-loaded snapshots to remain pure (no store imports).
 */

import type {
  BrandAggregateMetrics,
  DropAggregateMetrics,
  EngagementTimeSeriesPoint,
} from "../types/metrics";
import type { Drop } from "../types/drop";
import type { DropApplication } from "../types/orgCampaign";
import type { PostCampaignLink, SocialPost } from "../types/socialPost";
import type { SeedOrg } from "../data/seed/seedOrgs";

/** Per-post engagement = likes + comments. */
export function computePostEngagement(post: SocialPost): number {
  return post.metrics.likes + post.metrics.comments;
}

/**
 * Sums likes, comments, and engagement for every post an org has linked to any
 * campaign (any brand / drop), based on `PostCampaignLink` → `DropApplication`.
 */
export function computeOrgAttributedCampaignTotals(args: {
  orgId: string;
  applications: readonly DropApplication[];
  links: readonly PostCampaignLink[];
  posts: readonly SocialPost[];
}): {
  attributedPostCount: number;
  totalLikes: number;
  totalComments: number;
  totalEngagement: number;
} {
  const appIdsForOrg = new Set(
    args.applications
      .filter((a) => a.orgId === args.orgId)
      .map((a) => a.id)
  );
  const linkedPostIds = new Set(
    args.links
      .filter((l) => appIdsForOrg.has(l.applicationId))
      .map((l) => l.postId)
  );
  const linkedPosts = args.posts.filter((p) => linkedPostIds.has(p.id));
  let totalLikes = 0;
  let totalComments = 0;
  for (const p of linkedPosts) {
    totalLikes += p.metrics.likes;
    totalComments += p.metrics.comments;
  }
  return {
    attributedPostCount: linkedPosts.length,
    totalLikes,
    totalComments,
    totalEngagement: totalLikes + totalComments,
  };
}

/**
 * Aggregate for a single org's participation in a drop:
 * sums likes/comments across the org's linked posts and exposes that org's
 * estimated reach (their follower count).
 */
export function computeCampaignAggregate(args: {
  applicationId: string;
  links: readonly PostCampaignLink[];
  posts: readonly SocialPost[];
  orgFollowers: number;
}): {
  postCount: number;
  likes: number;
  comments: number;
  engagement: number;
  estimatedReach: number;
} {
  const linksForApp = args.links.filter(
    (l) => l.applicationId === args.applicationId
  );
  const linkedPostIds = new Set(linksForApp.map((l) => l.postId));
  const linkedPosts = args.posts.filter((p) => linkedPostIds.has(p.id));
  const likes = linkedPosts.reduce((acc, p) => acc + p.metrics.likes, 0);
  const comments = linkedPosts.reduce(
    (acc, p) => acc + p.metrics.comments,
    0
  );
  return {
    postCount: linkedPosts.length,
    likes,
    comments,
    engagement: likes + comments,
    estimatedReach: args.orgFollowers,
  };
}

/**
 * Roll-up across all orgs participating in a drop. Reach is the sum of follower
 * counts of accepted orgs.
 */
export function computeDropAggregate(args: {
  drop: Drop;
  applications: readonly DropApplication[];
  links: readonly PostCampaignLink[];
  posts: readonly SocialPost[];
  orgs: readonly SeedOrg[];
}): DropAggregateMetrics {
  const dropLinks = args.links.filter((l) => l.dropId === args.drop.id);
  const linkedPostIds = new Set(dropLinks.map((l) => l.postId));
  const dropPosts = args.posts.filter((p) => linkedPostIds.has(p.id));

  const acceptedOrgIds = new Set(
    args.applications
      .filter((a) => a.dropId === args.drop.id && a.decision === "accepted")
      .map((a) => a.orgId)
  );
  const acceptedOrgs = args.orgs.filter((o) => acceptedOrgIds.has(o.id));

  const totalLikes = dropPosts.reduce((acc, p) => acc + p.metrics.likes, 0);
  const totalComments = dropPosts.reduce(
    (acc, p) => acc + p.metrics.comments,
    0
  );
  const totalReach = acceptedOrgs.reduce((acc, o) => acc + o.followers, 0);

  return {
    dropId: args.drop.id,
    totalPosts: dropPosts.length,
    totalLikes,
    totalComments,
    totalEngagement: totalLikes + totalComments,
    totalReach,
    costPerEngagement: null,
  };
}

/** Roll-up across every drop owned by a single brand. */
export function computeBrandAggregate(args: {
  brandId: string;
  drops: readonly Drop[];
  applications: readonly DropApplication[];
  links: readonly PostCampaignLink[];
  posts: readonly SocialPost[];
  orgs: readonly SeedOrg[];
}): BrandAggregateMetrics {
  const brandDrops = args.drops.filter((d) => d.brandId === args.brandId);
  const orgsById = new Map(args.orgs.map((o) => [o.id, o]));

  let totalPosts = 0;
  let totalLikes = 0;
  let totalComments = 0;
  let totalReach = 0;
  const orgIdsTouched = new Set<string>();
  const campusesTouched = new Set<string>();

  for (const drop of brandDrops) {
    const dropAggregate = computeDropAggregate({
      drop,
      applications: args.applications,
      links: args.links,
      posts: args.posts,
      orgs: args.orgs,
    });
    totalPosts += dropAggregate.totalPosts;
    totalLikes += dropAggregate.totalLikes;
    totalComments += dropAggregate.totalComments;
    totalReach += dropAggregate.totalReach;

    for (const app of args.applications) {
      if (app.dropId === drop.id && app.decision === "accepted") {
        orgIdsTouched.add(app.orgId);
        const org = orgsById.get(app.orgId);
        if (org) campusesTouched.add(org.campus);
      }
    }
  }

  return {
    brandId: args.brandId,
    totalDrops: brandDrops.length,
    totalPosts,
    totalLikes,
    totalComments,
    totalEngagement: totalLikes + totalComments,
    totalReach,
    totalOrgs: orgIdsTouched.size,
    totalCampuses: campusesTouched.size,
  };
}

/**
 * Build an engagement time-series for a brand by bucketing post `metrics.fetchedAt`
 * into evenly-spaced steps. Each bucket reports the cumulative engagement at that
 * point in time (so the chart is monotonically non-decreasing — looks nice for v1).
 */
export function computeEngagementTimeSeries(args: {
  brandId: string;
  drops: readonly Drop[];
  links: readonly PostCampaignLink[];
  posts: readonly SocialPost[];
  /** Number of buckets in the resulting series. */
  bucketCount?: number;
  /** `now` to anchor the trailing window. */
  now: number;
  /** Window length in ms (default 14 days). */
  windowMs?: number;
}): EngagementTimeSeriesPoint[] {
  const buckets = args.bucketCount ?? 12;
  const windowMs = args.windowMs ?? 14 * 24 * 60 * 60 * 1000;

  const brandDropIds = new Set(
    args.drops.filter((d) => d.brandId === args.brandId).map((d) => d.id)
  );
  const linkedPostIds = new Set(
    args.links.filter((l) => brandDropIds.has(l.dropId)).map((l) => l.postId)
  );
  const brandPosts = args.posts.filter((p) => linkedPostIds.has(p.id));
  if (brandPosts.length === 0) return [];

  // Anchor the trailing window to real post data so the chart does not
  // oscillate as the demo clock advances or rewinds.
  const latestPostTs = brandPosts.reduce(
    (acc, p) => Math.max(acc, p.metrics.fetchedAt),
    0
  );
  const windowEnd = latestPostTs;
  const start = windowEnd - windowMs;
  const step = windowMs / buckets;
  const series: EngagementTimeSeriesPoint[] = [];

  // Sort posts by fetch time so cumulative aggregation is straightforward.
  const sortedPosts = [...brandPosts].sort(
    (a, b) => a.metrics.fetchedAt - b.metrics.fetchedAt
  );

  let cursor = 0;
  let cumulative = 0;
  for (let i = 0; i < buckets; i++) {
    const bucketEnd = start + (i + 1) * step;
    while (
      cursor < sortedPosts.length &&
      sortedPosts[cursor].metrics.fetchedAt <= bucketEnd
    ) {
      const p = sortedPosts[cursor];
      cumulative += p.metrics.likes + p.metrics.comments;
      cursor += 1;
    }
    series.push({ timestamp: bucketEnd, engagement: cumulative });
  }

  return series;
}
