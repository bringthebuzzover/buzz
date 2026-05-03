/**
 * Seed posts owned by orgs. The demo org has both linkable and unlinked posts so
 * the post selector can demonstrate the one-post-one-campaign rule.
 */

import type { SocialPost } from "../../types/socialPost";
import { DEMO_ORG_ID } from "./seedOrgs";

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export function buildSeedPosts(now: number): SocialPost[] {
  return [
    /** Demo org Instagram post — already linked to the active Poppi campaign in seedLinks. */
    {
      id: "post-demo-poppi-ig",
      orgId: DEMO_ORG_ID,
      platform: "instagram",
      url: "https://instagram.com/p/poppi-launch-1",
      caption: "Poppi pop-up brought the energy! 🍓",
      postedAt: now - 1 * MS_PER_DAY,
      metrics: { likes: 412, comments: 38, fetchedAt: now - 1 * MS_PER_HOUR },
    },
    /** Demo org TikTok — also linked to active Poppi campaign. */
    {
      id: "post-demo-poppi-tt",
      orgId: DEMO_ORG_ID,
      platform: "tiktok",
      url: "https://tiktok.com/@sk/poppi-1",
      caption: "Tasting all 4 new flavors at Babson 🥤",
      postedAt: now - 18 * MS_PER_HOUR,
      metrics: { likes: 980, comments: 54, fetchedAt: now - 1 * MS_PER_HOUR },
    },
    /** Demo org unlinked posts — eligible to attach to the active campaign. */
    {
      id: "post-demo-unlinked-1",
      orgId: DEMO_ORG_ID,
      platform: "instagram",
      url: "https://instagram.com/p/sk-board-meet",
      caption: "Board meet & greet 💛",
      postedAt: now - 4 * MS_PER_DAY,
      metrics: { likes: 156, comments: 12, fetchedAt: now - 4 * MS_PER_DAY },
    },
    {
      id: "post-demo-unlinked-2",
      orgId: DEMO_ORG_ID,
      platform: "tiktok",
      url: "https://tiktok.com/@sk/recruitment",
      caption: "Recruitment week recap 🎉",
      postedAt: now - 9 * MS_PER_DAY,
      metrics: { likes: 540, comments: 27, fetchedAt: now - 9 * MS_PER_DAY },
    },

    /** Cornell posts on Poppi launch (rolled into brand aggregates). */
    {
      id: "post-cornell-poppi-1",
      orgId: "org-cornell-alpha-phi",
      platform: "instagram",
      url: "https://instagram.com/p/cornell-poppi-1",
      caption: "Poppi pop-up at the quad ☀️",
      postedAt: now - 1 * MS_PER_DAY,
      metrics: { likes: 612, comments: 41, fetchedAt: now - 1 * MS_PER_HOUR },
    },
    {
      id: "post-cornell-poppi-2",
      orgId: "org-cornell-alpha-phi",
      platform: "tiktok",
      url: "https://tiktok.com/@cornell-ap/poppi",
      caption: "Day 1 in 60 seconds 🎥",
      postedAt: now - 16 * MS_PER_HOUR,
      metrics: { likes: 1450, comments: 92, fetchedAt: now - 1 * MS_PER_HOUR },
    },
    /** USC, MIT — Poppi posts. */
    {
      id: "post-usc-poppi",
      orgId: "org-usc-mktg",
      platform: "instagram",
      url: "https://instagram.com/p/usc-poppi",
      caption: "Trojans love Poppi 💛",
      postedAt: now - 22 * MS_PER_HOUR,
      metrics: { likes: 380, comments: 22, fetchedAt: now - 1 * MS_PER_HOUR },
    },
    {
      id: "post-mit-poppi",
      orgId: "org-mit-women-business",
      platform: "tiktok",
      url: "https://tiktok.com/@mit-wib/poppi",
      caption: "Beavers + bubbles = chemistry 🧪",
      postedAt: now - 12 * MS_PER_HOUR,
      metrics: { likes: 820, comments: 45, fetchedAt: now - 1 * MS_PER_HOUR },
    },

    /** Yerba Madre — Energy for Your Run (finished) — preserved final metrics. */
    {
      id: "post-demo-yerba-run",
      orgId: DEMO_ORG_ID,
      platform: "instagram",
      url: "https://instagram.com/p/sk-yerba-run-club",
      caption: "Run club kickoff — Yerba Madre at the finish line 💪",
      postedAt: now - 11 * MS_PER_DAY,
      metrics: { likes: 720, comments: 48, fetchedAt: now - 8 * MS_PER_DAY },
    },
    {
      id: "post-cornell-yerba-run",
      orgId: "org-cornell-alpha-phi",
      platform: "tiktok",
      url: "https://tiktok.com/@cornell-ap/yerba-run",
      caption: "House run + Yerba Madre pit stop 🏃",
      postedAt: now - 11 * MS_PER_DAY,
      metrics: { likes: 1320, comments: 86, fetchedAt: now - 8 * MS_PER_DAY },
    },
    {
      id: "post-nyu-yerba-run",
      orgId: "org-nyu-stern-marketing",
      platform: "instagram",
      url: "https://instagram.com/p/nyu-yerba-run",
      caption: "Morning miles — fueled by Yerba Madre ⚡",
      postedAt: now - 12 * MS_PER_DAY,
      metrics: { likes: 540, comments: 31, fetchedAt: now - 8 * MS_PER_DAY },
    },
  ];
}
