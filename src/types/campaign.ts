/**
 * Shared domain types for campaigns, home page marquee, featured cards, and brand dashboard mocks.
 */

/** A brand-run activation students can apply to host on campus. */
export type Campaign = {
  id: string;
  title: string;
  brand: string;
  description: string;
  location: string;
  date: string;
  image: string;
};

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

/** Fake applicant row for the brand portal campaigns table and IG preview demo. */
export type MockApplicant = {
  id: number;
  org: string;
  handle: string;
  followers: string;
  status: string;
};
