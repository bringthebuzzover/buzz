/** Static marketing types used by the public landing experience. */

/** Past or spotlight partnership shown on the home page grid. */
export type FeaturedCollab = {
  id: number;
  title: string;
  brand?: string;
  subtitle: string;
  image: string;
};

/** One school row in the scrolling college network. */
export type CollegeMarqueeItem = {
  name: string;
  domain: string;
  /** Committed logo asset. The marquee does not fetch a remote logo. */
  logoSrc: string;
};
