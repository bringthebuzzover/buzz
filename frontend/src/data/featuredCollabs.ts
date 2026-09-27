/**
 * Sample “featured collaboration” cards for the home page section below the marquee.
 */
import type { FeaturedCollab } from "../types/campaign";
import sorority from "../assets/sorority.png";
import entUpdate from "../assets/ent-update-cornell.jpg";

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
    title: "Epsilon Nu Tau x UPDATE",
    subtitle: "Collaboration at Cornell University",
    image: entUpdate,
  },
];
