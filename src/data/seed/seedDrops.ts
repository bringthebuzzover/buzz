/**
 * Seed drops covering one example per visible status:
 *
 * - Upcoming (apply window in the future).
 * - Open (apply window active, spots remaining).
 * - Closed by full (capacity met before close time).
 * - Closed by window (apply close passed, no manual reopen).
 * - Manually reopened (close time passed but `manualReopen` true).
 *
 * Plus brand-side drops at every tracker stage so the brand demo user has full coverage.
 */

import type { Drop } from "../../types/drop";
import { DEMO_BRAND_ID } from "./seedBrands";
import aboutBackground from "../../assets/aboutBackground.png";
import campus1 from "../../assets/campus1.png";
import campus2 from "../../assets/campus2.png";
import contactBackground from "../../assets/contactBackground.png";

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * Builds the seed drop list anchored to "now" so countdowns always look fresh
 * regardless of when the user opens the demo. Called once by the seed runner.
 */
export function buildSeedDrops(now: number): Drop[] {
  return [
    {
      id: "drop-poppi-launch",
      brandId: DEMO_BRAND_ID,
      brandName: "Poppi",
      title: "Poppi New Flavor Launch Pop-Up",
      description:
        "Poppi is dropping a brand new flavor. We're looking for campus organizations to host a launch pop-up. We send the cases, the merch, and everything you need for an unforgettable event.",
      image: aboutBackground,
      location: "Multiple Campuses",
      capacityTotal: 10,
      applyOpenAt: now + 2 * MS_PER_DAY,
      applyCloseAt: now + 9 * MS_PER_DAY,
      manualReopen: false,
      brandTrackerStage: "drop_active",
      createdAt: now - 5 * MS_PER_DAY,
    },
    {
      id: "drop-summer-fridays-balm",
      brandId: "brand-summer-fridays",
      brandName: "Summer Fridays",
      title: "Pink Guava Butter Balm Pop-Up",
      description:
        "Bring Summer Fridays' viral Pink Guava Lip Butter Balm to your campus. Host a sensory pop-up with pink decor, lip touch-ups, and photo moments for students to try the new shade.",
      image: campus1,
      location: "Your Campus",
      capacityTotal: 10,
      applyOpenAt: now - 2 * MS_PER_DAY,
      applyCloseAt: now + 5 * MS_PER_DAY,
      manualReopen: false,
      brandTrackerStage: "request_received",
      createdAt: now - 3 * MS_PER_DAY,
    },
    {
      id: "drop-rare-beauty-soft-pinch",
      brandId: "brand-rare-beauty",
      brandName: "Rare Beauty",
      title: "Soft Pinch Liquid Blush Sampling",
      description:
        "Rare Beauty's Soft Pinch Liquid Blush is back with two new shades. Host a sampling station where students can try the new colors and snap selfies with our brand wall.",
      image: contactBackground,
      location: "Your Campus",
      capacityTotal: 5,
      applyOpenAt: now - 4 * MS_PER_DAY,
      applyCloseAt: now + 4 * MS_PER_DAY,
      manualReopen: false,
      brandTrackerStage: "drop_active",
      createdAt: now - 6 * MS_PER_DAY,
    },
    {
      id: "drop-celsius-finals-fuel",
      brandId: "brand-celsius",
      brandName: "Celsius",
      title: "Finals Fuel Energy Drop",
      description:
        "Power your campus through finals week. We supply cases of Celsius and pop-up branding so your org can run a finals-fuel station in the library.",
      image: campus2,
      location: "Your Campus",
      capacityTotal: 8,
      applyOpenAt: now - 9 * MS_PER_DAY,
      applyCloseAt: now - 2 * MS_PER_DAY,
      manualReopen: false,
      brandTrackerStage: "drop_finished",
      createdAt: now - 14 * MS_PER_DAY,
    },
    {
      id: "drop-poppi-spring-tour",
      brandId: DEMO_BRAND_ID,
      brandName: "Poppi",
      title: "Spring Campus Tour (Reopened)",
      description:
        "Spots have reopened on our spring campus tour. Originally closed, but a few orgs dropped out — now accepting last-minute applications.",
      image: aboutBackground,
      location: "Multiple Campuses",
      capacityTotal: 6,
      applyOpenAt: now - 12 * MS_PER_DAY,
      applyCloseAt: now - 1 * MS_PER_DAY,
      manualReopen: true,
      brandTrackerStage: "awaiting_products",
      trackingNumber: "1Z999AA10123456784",
      createdAt: now - 14 * MS_PER_DAY,
    },
    {
      id: "drop-poppi-finalizing",
      brandId: DEMO_BRAND_ID,
      brandName: "Poppi",
      title: "Sorority Bid Day Sampling",
      description:
        "A targeted sampling activation timed to bid day. We're working through agreements now; once finalized this will open to applications.",
      image: campus1,
      location: "Your Campus",
      capacityTotal: 4,
      applyOpenAt: now + 5 * MS_PER_DAY,
      applyCloseAt: now + 14 * MS_PER_DAY,
      manualReopen: false,
      brandTrackerStage: "finalizing_agreements",
      createdAt: now - 1 * MS_PER_DAY,
    },
  ];
}
