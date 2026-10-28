/**
 * Static marketing types still used by the public landing experience.
 *
 * `Campaign` and `MockApplicant` were retired alongside the legacy `/campaigns`
 * and `/brand` (dashboard) flows — the canonical drop/application/post types
 * live under `src/types/{drop,orgCampaign,socialPost,brandPortal}.ts`.
 */

/** Past or spotlight partnership shown on the home page grid. */
export type FeaturedCollab = {
  id: number;
  title: string;
  subtitle: string;
  image: string;
};

/** One school row in the scrolling college network. */
export type CollegeMarqueeItem = {
  name: string;
  domain: string;
  /** Committed logo asset. The marquee does not fetch a remote logo. */
  logoSrc: string;
  /**
   * Width classes for a wide wordmark. The square logo box would otherwise
   * letterbox it down to a sliver; these let it grow into the gap between tiles.
   */
  logoClassName?: string;
};
