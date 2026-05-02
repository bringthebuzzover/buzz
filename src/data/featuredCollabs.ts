/**
 * Sample “featured collaboration” cards for the home page section below the marquee.
 */
import type { FeaturedCollab } from "../types/campaign";
import campus1 from "../assets/campus1.png";
import contactBackground from "../assets/contactBackground.png";

/** Title, subtitle, and hero image per collaboration tile. */
export const FEATURED_COLLABS: FeaturedCollab[] = [
  {
    id: 1,
    title: "Sigma Kappa x Garnier",
    subtitle: "Product sampling event at Babson College",
    image: campus1,
  },
  {
    id: 2,
    title: "Sigma Kappa x Hero Cosmetics",
    subtitle: "Brand activation at Babson College",
    image: contactBackground,
  },
];
