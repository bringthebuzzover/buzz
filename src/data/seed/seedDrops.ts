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
import sorority from "../../assets/sorority.png";
import trackandfield from "../../assets/trackandfield.png";
import pinkGuava from "../../assets/pinkguava.png";
import rareBeauty from "../../assets/rarebeauty.png";
import primeImage from "../../assets/prime.png";
import poppi from "../../assets/poppi.png";

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
      image: poppi,
      location: "Multiple Campuses",
      capacityTotal: 10,
      applyOpenAt: now + 2 * MS_PER_DAY,
      applyCloseAt: now + 9 * MS_PER_DAY,
      manualReopen: false,
      brandTrackerStage: "active_campaign",
      totalProductUnits: 800,
      createdAt: now - 5 * MS_PER_DAY,
    },
    {
      id: "drop-summer-fridays-balm",
      brandId: "brand-summer-fridays",
      brandName: "Summer Fridays",
      title: "Pink Guava Butter Balm Pop-Up",
      description:
        "Bring Summer Fridays' viral Pink Guava Lip Butter Balm to your campus. Host a sensory pop-up with pink decor, lip touch-ups, and photo moments for students to try the new shade.",
      image: pinkGuava,
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
      image: rareBeauty,
      location: "Your Campus",
      capacityTotal: 5,
      applyOpenAt: now - 4 * MS_PER_DAY,
      applyCloseAt: now + 4 * MS_PER_DAY,
      manualReopen: false,
      brandTrackerStage: "active_campaign",
      createdAt: now - 6 * MS_PER_DAY,
    },
    {
      id: "drop-celsius-finals-fuel",
      brandId: "brand-yerba-mate",
      brandName: "Yerba Madre",
      title: "Yerba Madre — Energy for Your Run",
      description:
        "Fuel your run club and campus routes with clean energy from Yerba Madre. We send product, coolers, and branding so your org can host post-run sampling, group runs, and tabling outside the rec center.",
      image: trackandfield,
      location: "Your Campus",
      capacityTotal: 8,
      applyOpenAt: now - 9 * MS_PER_DAY,
      applyCloseAt: now - 2 * MS_PER_DAY,
      manualReopen: false,
      brandTrackerStage: "completed",
      createdAt: now - 14 * MS_PER_DAY,
    },
    {
      id: "drop-poppi-spring-tour",
      brandId: DEMO_BRAND_ID,
      brandName: "PRIME Hydration",
      title: "PRIME Hydration Campus Partnership",
      description:
        "Partner with PRIME Hydration to bring bold flavors and high-energy sampling to your campus — hydration stations, tabling, and ambassador-style activations. A few host spots just opened up; we're accepting last-minute applications.",
      image: primeImage,
      location: "Multiple Campuses",
      capacityTotal: 6,
      applyOpenAt: now - 12 * MS_PER_DAY,
      applyCloseAt: now - 1 * MS_PER_DAY,
      manualReopen: true,
      brandTrackerStage: "products_in_transit",
      trackingNumber: "1Z999AA10123456784",
      totalProductUnits: 600,
      createdAt: now - 14 * MS_PER_DAY,
    },
    {
      id: "drop-poppi-finalizing",
      brandId: DEMO_BRAND_ID,
      brandName: "Yerba Madre",
      title: "Yerba Madre — Sorority Bid Day",
      description:
        "Bring clean energy to bid day with Yerba Madre sampling for PNMs and sisters — tabling, welcome bags, and post-ceremony toasts. Applications are closed; review orgs that applied, allocate units, and finalize your campus partners.",
      image: sorority,
      location: "Your Campus",
      capacityTotal: 4,
      applyOpenAt: now - 8 * MS_PER_DAY,
      applyCloseAt: now - 1 * MS_PER_HOUR,
      manualReopen: false,
      brandTrackerStage: "applicant_selection",
      totalProductUnits: 420,
      createdAt: now - 1 * MS_PER_DAY,
    },
  ];
}
