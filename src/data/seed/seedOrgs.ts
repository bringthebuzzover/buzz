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
};

/** Demo persona's org id (the one an org demo user "is"). */
export const DEMO_ORG_ID = "org-babson-sigma-kappa";

export const SEED_ORGS: SeedOrg[] = [
  {
    id: DEMO_ORG_ID,
    name: "Sigma Kappa",
    campus: "Babson College",
    followers: 1240,
  },
  {
    id: "org-cornell-alpha-phi",
    name: "Alpha Phi",
    campus: "Cornell University",
    followers: 2510,
  },
  {
    id: "org-usc-mktg",
    name: "USC Marketing Association",
    campus: "USC",
    followers: 880,
  },
  {
    id: "org-mit-women-business",
    name: "MIT Women in Business",
    campus: "MIT",
    followers: 1620,
  },
  {
    id: "org-nyu-stern-marketing",
    name: "Stern Marketing Society",
    campus: "NYU",
    followers: 2050,
  },
];
