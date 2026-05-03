/**
 * Seed post-to-campaign links so the active Poppi campaign already has a couple
 * of posts attributed (proves the aggregate score card has data and that
 * one-post-one-campaign is enforced).
 */

import type { PostCampaignLink } from "../../types/socialPost";

const MS_PER_HOUR = 60 * 60 * 1000;

export function buildSeedLinks(now: number): PostCampaignLink[] {
  return [
    /** Demo org's Poppi posts — attached to active campaign. */
    {
      postId: "post-demo-poppi-ig",
      applicationId: "app-demo-poppi-launch",
      dropId: "drop-poppi-launch",
      linkedAt: now - 12 * MS_PER_HOUR,
    },
    {
      postId: "post-demo-poppi-tt",
      applicationId: "app-demo-poppi-launch",
      dropId: "drop-poppi-launch",
      linkedAt: now - 8 * MS_PER_HOUR,
    },

    /** Cornell's Poppi posts (other org, used to roll up brand-side aggregates). */
    {
      postId: "post-cornell-poppi-1",
      applicationId: "app-cornell-poppi",
      dropId: "drop-poppi-launch",
      linkedAt: now - 14 * MS_PER_HOUR,
    },
    {
      postId: "post-cornell-poppi-2",
      applicationId: "app-cornell-poppi",
      dropId: "drop-poppi-launch",
      linkedAt: now - 6 * MS_PER_HOUR,
    },
    /** USC + MIT Poppi posts. */
    {
      postId: "post-usc-poppi",
      applicationId: "app-usc-poppi",
      dropId: "drop-poppi-launch",
      linkedAt: now - 18 * MS_PER_HOUR,
    },
    {
      postId: "post-mit-poppi",
      applicationId: "app-mit-poppi",
      dropId: "drop-poppi-launch",
      linkedAt: now - 10 * MS_PER_HOUR,
    },

    /** Celsius (finished) — preserved final attributions. */
    {
      postId: "post-demo-celsius",
      applicationId: "app-demo-celsius",
      dropId: "drop-celsius-finals-fuel",
      linkedAt: now - 11 * 24 * MS_PER_HOUR,
    },
    {
      postId: "post-cornell-celsius",
      applicationId: "app-cornell-celsius",
      dropId: "drop-celsius-finals-fuel",
      linkedAt: now - 11 * 24 * MS_PER_HOUR,
    },
    {
      postId: "post-nyu-celsius",
      applicationId: "app-nyu-celsius",
      dropId: "drop-celsius-finals-fuel",
      linkedAt: now - 11 * 24 * MS_PER_HOUR,
    },
  ];
}
