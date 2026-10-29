/** Static marketing types used by the public landing experience. */

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
   * Max-width classes for a wide wordmark. Caps the mark inside its tile so
   * the letters sit near half a seal instead of filling the square.
   */
  logoClassName?: string;
};
