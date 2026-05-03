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
    title: "Kappa Alpha Theta x Yerba Madre",
    subtitle: "Collaboration at Cornell University",
    image: sorority,
  },
  {
    id: 2,
    title: "Sigma Kappa x Mighty Patch",
    subtitle: "Collaboration at Babson College",
    image: yerbamate,
  },
];
