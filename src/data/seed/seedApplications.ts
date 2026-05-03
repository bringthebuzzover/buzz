/**
 * Seed applications covering all decision states (`applied`, `accepted`, `denied`,
 * `waitlisted`) so the org persona sees Applied/Waitlisted/Accepted/Active/Finished
 * and so the demo proves Denied stays hidden in My Campaigns.
 *
 * The demo org id is referenced for first-person campaigns; other orgs populate
 * the brand-side aggregations and per-drop fill counts.
 */

import type { DropApplication } from "../../types/orgCampaign";
import { DEMO_ORG_ID } from "./seedOrgs";

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export function buildSeedApplications(now: number): DropApplication[] {
  return [
    /** Active campaign for the demo org — Poppi launch is `active_campaign`. */
    {
      id: "app-demo-poppi-launch",
      dropId: "drop-poppi-launch",
      orgId: DEMO_ORG_ID,
      decision: "accepted",
      appliedAt: now - 6 * MS_PER_DAY,
      decisionAt: now - 4 * MS_PER_DAY,
      pitch: "We can host a high-traffic pop-up at the campus center.",
      trackingNumber: "1Z999AA10123456784",
    },

    /** Accepted on PRIME Hydration partnership drop, products in transit — shows tracking number. */
    {
      id: "app-demo-prime-partnership",
      dropId: "drop-poppi-spring-tour",
      orgId: DEMO_ORG_ID,
      decision: "accepted",
      appliedAt: now - 7 * MS_PER_DAY,
      decisionAt: now - 3 * MS_PER_DAY,
      trackingNumber: "1Z999AA10987654321",
    },

    /** Applied (no decision yet) on Summer Fridays. */
    {
      id: "app-demo-sf-balm",
      dropId: "drop-summer-fridays-balm",
      orgId: DEMO_ORG_ID,
      decision: "applied",
      appliedAt: now - 1 * MS_PER_DAY,
      pitch: "We have a glam-room space perfect for a sensory activation.",
    },

    /** Waitlisted on Rare Beauty (full but the org opted into the waitlist). */
    {
      id: "app-demo-rare-waitlist",
      dropId: "drop-rare-beauty-soft-pinch",
      orgId: DEMO_ORG_ID,
      decision: "waitlisted",
      appliedAt: now - 2 * MS_PER_DAY,
      decisionAt: now - 1 * MS_PER_DAY,
    },

    /** Finished campaign for the demo org (Yerba Madre — Energy for Your Run). */
    {
      id: "app-demo-yerba-run",
      dropId: "drop-celsius-finals-fuel",
      orgId: DEMO_ORG_ID,
      decision: "accepted",
      appliedAt: now - 13 * MS_PER_DAY,
      decisionAt: now - 11 * MS_PER_DAY,
      trackingNumber: "1Z999AA10555555555",
    },

    /** Applicant Selection demo — Yerba Madre sorority bid day: pending applications from multiple orgs. */
    {
      id: "app-bidday-cornell",
      dropId: "drop-poppi-finalizing",
      orgId: "org-cornell-alpha-phi",
      decision: "applied",
      appliedAt: now - 5 * MS_PER_DAY,
      pitch:
        "Strong Greek life presence; can host Yerba Madre bid day tabling on Ho Plaza.",
    },
    {
      id: "app-bidday-usc",
      dropId: "drop-poppi-finalizing",
      orgId: "org-usc-mktg",
      decision: "applied",
      appliedAt: now - 4 * MS_PER_DAY,
      pitch:
        "Weekly marketing events with 200+ attendees — great for run-club + Yerba Madre sampling.",
    },
    {
      id: "app-bidday-mit",
      dropId: "drop-poppi-finalizing",
      orgId: "org-mit-women-business",
      decision: "applied",
      appliedAt: now - 4 * MS_PER_DAY,
      pitch:
        "Corporate partners network aligns with campus run clubs and beverage sampling.",
    },
    {
      id: "app-bidday-nyu",
      dropId: "drop-poppi-finalizing",
      orgId: "org-nyu-stern-marketing",
      decision: "applied",
      appliedAt: now - 3 * MS_PER_DAY,
      pitch:
        "Washington Square Park adjacent space — strong for bid week Yerba Madre activations.",
    },
    {
      id: "app-bidday-babson",
      dropId: "drop-poppi-finalizing",
      orgId: DEMO_ORG_ID,
      decision: "applied",
      appliedAt: now - 2 * MS_PER_DAY,
      pitch:
        "Bid week visibility across business school cohorts; can merchandise Yerba Madre welcome bags.",
    },

    /** Denied — must NOT appear in My Campaigns. */
    {
      id: "app-demo-rare-prior-denied",
      dropId: "drop-rare-beauty-soft-pinch",
      orgId: DEMO_ORG_ID,
      decision: "denied",
      appliedAt: now - 4 * MS_PER_DAY,
      decisionAt: now - 3 * MS_PER_DAY,
    },

    // Other orgs participating in Poppi launch (so brand sees aggregate of multiple orgs).
    {
      id: "app-cornell-poppi",
      dropId: "drop-poppi-launch",
      orgId: "org-cornell-alpha-phi",
      decision: "accepted",
      appliedAt: now - 6 * MS_PER_DAY,
      decisionAt: now - 4 * MS_PER_DAY,
    },
    {
      id: "app-usc-poppi",
      dropId: "drop-poppi-launch",
      orgId: "org-usc-mktg",
      decision: "accepted",
      appliedAt: now - 6 * MS_PER_DAY,
      decisionAt: now - 4 * MS_PER_DAY,
    },
    {
      id: "app-mit-poppi",
      dropId: "drop-poppi-launch",
      orgId: "org-mit-women-business",
      decision: "accepted",
      appliedAt: now - 6 * MS_PER_DAY,
      decisionAt: now - 4 * MS_PER_DAY,
    },

    // Fill Rare Beauty to capacity (5 accepted) so its feed status is "Closed (filled)".
    {
      id: "app-cornell-rare",
      dropId: "drop-rare-beauty-soft-pinch",
      orgId: "org-cornell-alpha-phi",
      decision: "accepted",
      appliedAt: now - 3 * MS_PER_DAY,
      decisionAt: now - 2 * MS_PER_DAY,
    },
    {
      id: "app-usc-rare",
      dropId: "drop-rare-beauty-soft-pinch",
      orgId: "org-usc-mktg",
      decision: "accepted",
      appliedAt: now - 3 * MS_PER_DAY,
      decisionAt: now - 2 * MS_PER_DAY,
    },
    {
      id: "app-mit-rare",
      dropId: "drop-rare-beauty-soft-pinch",
      orgId: "org-mit-women-business",
      decision: "accepted",
      appliedAt: now - 3 * MS_PER_DAY,
      decisionAt: now - 2 * MS_PER_DAY,
    },
    {
      id: "app-nyu-rare",
      dropId: "drop-rare-beauty-soft-pinch",
      orgId: "org-nyu-stern-marketing",
      decision: "accepted",
      appliedAt: now - 3 * MS_PER_DAY,
      decisionAt: now - 2 * MS_PER_DAY,
    },

    // Yerba Madre run drop (finished) — multiple orgs participated.
    {
      id: "app-cornell-yerba-run",
      dropId: "drop-celsius-finals-fuel",
      orgId: "org-cornell-alpha-phi",
      decision: "accepted",
      appliedAt: now - 13 * MS_PER_DAY,
      decisionAt: now - 11 * MS_PER_DAY,
    },
    {
      id: "app-nyu-yerba-run",
      dropId: "drop-celsius-finals-fuel",
      orgId: "org-nyu-stern-marketing",
      decision: "accepted",
      appliedAt: now - 13 * MS_PER_DAY,
      decisionAt: now - 11 * MS_PER_DAY,
    },
  ];
}
