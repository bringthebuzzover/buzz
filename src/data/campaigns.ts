/**
 * Static campaign catalog for the marketing site (list + detail + apply modal).
 */
import type { Campaign } from "../types/campaign";
import aboutBackground from "../assets/aboutBackground.png";
import campus1 from "../assets/campus1.png";

/** All campaigns shown on `/campaigns` and linked from the home hero. */
export const CAMPAIGNS: Campaign[] = [
  {
    id: "1",
    title: "Poppi New Flavor Launch Pop-Up",
    brand: "Poppi",
    description:
      "Poppi is dropping a brand new flavor! We are looking for campus organizations to host a launch pop-up on their campus. We will send cases of the new flavor, merch, and everything you need for an amazing event.",
    location: "Multiple Campuses",
    date: "Coming Soon",
    image: aboutBackground,
  },
  {
    id: "2",
    title: "Pink Guava Butter Balm Pop-Up",
    brand: "Summer Fridays",
    description:
      "Bring Summer Fridays' viral Pink Guava Lip Butter Balm to your campus! Host a sensory pop-up (think: pink decor, lip touch-ups, photo moments) for students to try the new shade.",
    location: "Your Campus",
    date: "5/8/2026",
    image: campus1,
  },
];

/** Resolves a campaign by route param `campaignId`; returns `undefined` if unknown. */
export function getCampaignById(id: string): Campaign | undefined {
  return CAMPAIGNS.find(c => c.id === id);
}
