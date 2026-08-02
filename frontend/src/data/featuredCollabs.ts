/**
 * Sample “featured collaboration” cards for the home page section below the marquee.
 */
import type { FeaturedCollab } from "../types/campaign";
import sorority from "../assets/sorority.png";
import ztaLacroix from "../assets/zta-lacroix.png";

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
    title: "Zeta Tau Alpha x La Croix",
    subtitle: "Collaboration at Stanford University",
    image: ztaLacroix,
  },
];
