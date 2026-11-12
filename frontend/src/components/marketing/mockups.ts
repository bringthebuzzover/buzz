/**
 * Sample story shared by the Home, For organizations, and For brands phones.
 * Copy matches the pen (pass 8): Sample Org / Sample Brand / Fall Cold Brew Launch.
 */

import { publicAsset } from "../../utils/publicAsset";

export const MOCKUP = {
  cans: publicAsset("images/mockups/cold-brew-cans.webp"),
  bottle: publicAsset("images/mockups/cold-brew-bottle.webp"),
  table: publicAsset("images/mockups/sampling-table.webp"),
  event: publicAsset("images/mockups/campus-event.webp"),
  box: publicAsset("images/mockups/shipment-box.webp"),
  study: publicAsset("images/mockups/study-night.webp"),
} as const;

export const MOCKUP_ALT = {
  cans: "Plain black cold brew cans on a dark table",
  bottle: "Unlabeled cold brew bottle",
  table: "Outdoor campus sampling table with cans",
  event: "Evening campus event with string lights, crowd seen from behind",
  box: "Plain kraft shipping box",
  study: "Library study table with drinks, no faces visible",
} as const;

export const SAMPLE = {
  brand: "Sample Brand",
  org: "Sample Org",
  orgB: "Sample Org B",
  university: "Sample University",
  handle: "@sampleorg",
  handleB: "@sampleorgb",
  email: "org@sample.edu",
  drop: {
    title: "Fall Cold Brew Launch",
    description:
      "200 cans of cold brew + branded koozies for tailgates and study nights.",
    spots: "Up to 8 spots",
    status: "Open",
  },
  campaign:
    "We're launching our cold brew this fall and want student orgs to sample it at tailgates and study nights.",
  sending: "200 cans of cold brew + branded koozies",
} as const;

// Home shows four onboarding screens; portal pages use condensed three-step tours from the pen.
export const ORG_STEPS = [
  { caption: "Apply with your campus .edu email.", side: "left" },
  { caption: "Use the Business or Creator account.", side: "right" },
  { caption: "Connect Instagram after approval.", side: "left" },
  { caption: "Apply when a drop is Open.", side: "right" },
] as const;

export const PORTAL_STEPS = {
  org: [
    {
      title: "Apply with your .edu email",
      body: "Tell BUZZ about your organization and campus.",
      screen: 0,
    },
    {
      title: "Connect Instagram",
      body: "After approval, connect your Business or Creator account.",
      screen: 2,
    },
    {
      title: "Apply to open drops",
      body: "Browse current drops and apply for your organization.",
      screen: 3,
    },
  ],
  brand: [
    {
      title: "Tell us about your campaign",
      body: "Share your goals and the products you want to send.",
      screen: 0,
    },
    {
      title: "Choose the organizations",
      body: "BUZZ builds and publishes your drop. Review applicants and send your decisions.",
      screen: 2,
    },
    {
      title: "Follow every post",
      body: "Track organization posts and see the finished drop.",
      screen: 3,
    },
  ],
} as const;

export const ORG_LAPTOP_STEPS = [
  {
    title: "Create your student organization’s profile",
    body: "Apply with your campus .edu email and verify your student organization profile.",
    videoMp4: publicAsset("videos/org-step1-apply.mp4"),
    videoWebm: publicAsset("videos/org-step1-apply.webm"),
    poster: publicAsset("videos/org-step1-apply-poster.webp"),
    alt: "Student organization onboarding showing application form and verification email code",
  },
  {
    title: "Discover new brand campaigns as they drop",
    body: "Browse active drops tailored for your campus and see what products are available.",
    videoMp4: publicAsset("videos/org-step2-discover.mp4"),
    videoWebm: publicAsset("videos/org-step2-discover.webm"),
    poster: publicAsset("videos/org-step2-discover-poster.webp"),
    alt: "Student organization portal browse feed featuring Saie, David Protein, and Bloom drops",
  },
  {
    title: "Apply to collaborate with your favorite brands",
    body: "Submit your pitch in one click and follow campaign status in My Campaigns.",
    videoMp4: publicAsset("videos/org-step3-collaborate.mp4"),
    videoWebm: publicAsset("videos/org-step3-collaborate.webm"),
    poster: publicAsset("videos/org-step3-collaborate-poster.webp"),
    alt: "1-click drop application for David Protein bar with instant submission toast",
  },
] as const;

export const BRAND_LAPTOP_STEPS = [
  {
    title: "Tell us about your campaign",
    body: "Share your goals, target campuses, and the products you want to send.",
    videoMp4: publicAsset("videos/brand-step1-campaign.mp4"),
    videoWebm: publicAsset("videos/brand-step1-campaign.webm"),
    poster: publicAsset("videos/brand-step1-campaign-poster.webp"),
    alt: "Brand portal campaign request form with goals and product shipment specs",
  },
  {
    title: "Choose the organizations",
    body: "BUZZ publishes your drop. Review applicant pitches and confirm your decisions.",
    videoMp4: publicAsset("videos/brand-step2-select.mp4"),
    videoWebm: publicAsset("videos/brand-step2-select.webm"),
    poster: publicAsset("videos/brand-step2-select-poster.webp"),
    alt: "Brand portal applicant review table accepting The BUZZ Club application with unit allocation",
  },
  {
    title: "Follow every post & metric",
    body: "Track live campus activations, engagement, reach, and student organization posts.",
    videoMp4: publicAsset("videos/brand-step3-metrics.mp4"),
    videoWebm: publicAsset("videos/brand-step3-metrics.webm"),
    poster: publicAsset("videos/brand-step3-metrics-poster.webp"),
    alt: "Brand dashboard showing engagement over time chart, reach totals, and active campaign stats",
  },
] as const;


