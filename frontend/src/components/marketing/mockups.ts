/**
 * Laptop step definitions for Home (`PinnedHow`), `/for-orgs`, and `/for-brands` (`SideBySideHow`).
 */

import { publicAsset } from "../../utils/publicAsset";

export const ORG_LAPTOP_STEPS = [
  {
    title: "Create your student organization’s profile",
    body: "Connect Instagram, complete your campus profile, and verify your .edu email.",
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


