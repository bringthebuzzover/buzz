/**
 * Sample “featured collaboration” cards for the home page section below the marquee.
 */
import type { FeaturedCollab } from "../types/campaign";
import sorority from "../assets/sorority.png";
import yerbamate from "../assets/yerbamate.png";

/** Title, subtitle, and hero image per collaboration tile. */
export const FEATURED_COLLABS: FeaturedCollab[] = [
  {
    id: 1,
    title: "Sigma Kappa x Garnier",
    subtitle: "Product sampling event at Babson College",
    image: sorority,
  },
  {
    id: 2,
    title: "Sigma Kappa x Hero Cosmetics",
    subtitle: "Brand activation at Babson College",
    image: yerbamate,
  },
];
