/**
 * Seed orgs referenced by applications and posts. Used to derive estimated reach
 * (sum of follower counts of accepted orgs).
 */

export type SeedOrg = {
  id: string;
  name: string;
  campus: string;
  /** Aggregate IG/TikTok follower count, used as the v1 reach approximation. */
  followers: number;
  city: string;
  state: string;
  /** Primary social handle for display (e.g. Instagram). */
  instagramHandle: string;
  memberCount: number;
  /** Primary contact for shipping coordination. */
  contactName: string;
  /** Single-line mailing address for fulfillment summary. */
  deliveryAddress: string;
};

/** Demo persona's org id (the one an org demo user "is"). */
export const DEMO_ORG_ID = "org-babson-sigma-kappa";

export const SEED_ORGS: SeedOrg[] = [
  {
    id: DEMO_ORG_ID,
    name: "Sigma Kappa",
    campus: "Babson College",
    followers: 1240,
    city: "Wellesley",
    state: "MA",
    instagramHandle: "@sigmakappababson",
    memberCount: 86,
    contactName: "Jordan Lee",
    deliveryAddress: "Sigma Kappa, 231 Forest St, Wellesley, MA 02457",
  },
  {
    id: "org-cornell-alpha-phi",
    name: "Alpha Phi",
    campus: "Cornell University",
    followers: 2510,
    city: "Ithaca",
    state: "NY",
    instagramHandle: "@alphaphicornell",
    memberCount: 120,
    contactName: "Maya Chen",
    deliveryAddress: "Alpha Phi, 409 Thurston Ave, Ithaca, NY 14850",
  },
  {
    id: "org-usc-mktg",
    name: "USC Marketing Association",
    campus: "USC",
    followers: 880,
    city: "Los Angeles",
    state: "CA",
    instagramHandle: "@uscmarketingassoc",
    memberCount: 95,
    contactName: "Alex Rivera",
    deliveryAddress: "USC Marshall, 3670 Trousdale Pkwy, Los Angeles, CA 90089",
  },
  {
    id: "org-mit-women-business",
    name: "MIT Women in Business",
    campus: "MIT",
    followers: 1620,
    city: "Cambridge",
    state: "MA",
    instagramHandle: "@mitwomeninbusiness",
    memberCount: 72,
    contactName: "Sam Okonkwo",
    deliveryAddress: "MIT Sloan, 100 Main St, Cambridge, MA 02142",
  },
  {
    id: "org-nyu-stern-marketing",
    name: "Stern Marketing Society",
    campus: "NYU",
    followers: 2050,
    city: "New York",
    state: "NY",
    instagramHandle: "@sternmarketingsociety",
    memberCount: 110,
    contactName: "Riley Patel",
    deliveryAddress: "NYU Stern, 40 W 4th St, New York, NY 10012",
  },
];
