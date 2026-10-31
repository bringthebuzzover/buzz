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
      title: "BUZZ publishes your drop",
      body: "See your published drop and available spots in the portal.",
      screen: 1,
    },
    {
      title: "Follow every post",
      body: "Track organization posts and see the finished drop.",
      screen: 3,
    },
  ],
} as const;
