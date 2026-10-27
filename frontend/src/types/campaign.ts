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
  /**
   * Manual title color on the drop photo. "light" is white, "dark" is ink.
   * When set, it wins over the sampled tone.
   */
  titleTone?: "light" | "dark";
};

/** One school row in the scrolling college network; optional local logo overrides remote URLs. */
export type CollegeMarqueeItem = {
  name: string;
  domain: string;
  /** Local logo (bundled asset or a file under public/colleges). */
  logoSrc: string;
  /** Campus latitude (Wikipedia article coordinates). */
  lat: number;
  /** Campus longitude (Wikipedia article coordinates). */
  lng: number;
};
