/**
 * Demo applicant rows for the brand portal “Active Campaigns” table and IG preview flow.
 */
import type { MockApplicant } from "../types/campaign";

/** Fixed list keyed by `id` for stable React keys in the dashboard table. */
export const MOCK_APPLICANTS: MockApplicant[] = [
  {
    id: 1,
    org: "Babson Sigma Kappa",
    handle: "babsonsigmakappa",
    followers: "1.2K",
    status: "Pending",
  },
  {
    id: 2,
    org: "Cornell Alpha Phi",
    handle: "cornellalphaphi",
    followers: "2.5K",
    status: "Pending",
  },
  {
    id: 3,
    org: "USC Marketing Association",
    handle: "uscmktg",
    followers: "800",
    status: "Pending",
  },
];
