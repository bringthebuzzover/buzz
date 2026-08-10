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

/** One school row in the scrolling college network; optional local logo overrides remote URLs. */
export type CollegeMarqueeItem = {
  name: string;
  domain: string;
  /** Local asset; when absent, Clearbit / icon fallback is used in the UI */
  logoSrc?: string;
};
