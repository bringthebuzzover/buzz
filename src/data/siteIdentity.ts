/**
 * Single source of truth for public links, handles, contact info, logo assets, and hero copy.
 * Edit values here instead of hunting through components; consumed by header, footer, modals, and hero.
 */
import buzzLogo from "../assets/buzz-logo.svg";
import instaIcon from "../assets/insta-icon.png";
import linkedinIcon from "../assets/linkedin-icon.png";

/** Read-only config object consumed by header, footer, modals, and hero. */
export const siteIdentity = {
  images: {
    logo: buzzLogo,
    logoAlt: "BUZZ",
    socialInstagramIcon: instaIcon,
    socialLinkedinIcon: linkedinIcon,
  },
  brand: {
    name: "BUZZ",
    /** Full name shown in footer, etc. */
    displayName: "Bring the Buzz Over",
    shortBadge: "BZ",
  },
  social: {
    instagram: {
      /** Full profile URL (with www if you prefer) */
      profileUrl: "https://www.instagram.com/bringthebuzzover/",
      /** Shorter variant for modals / deep links */
      webUrl: "https://instagram.com/bringthebuzzover",
      handleWithAt: "@bringthebuzzover",
      handleBare: "bringthebuzzover",
    },
    linkedin: {
      /** Company page — header top bar */
      companyUrl: "https://www.linkedin.com/company/bringthebuzzover/",
      /** Personal / founder — use in bios, press, etc. */
      personalProfileUrl: "https://www.linkedin.com/in/melissachowdhury/",
    },
  },
  contact: {
    primaryPersonName: "Avery Example",
    email: "ae101@example.edu",
  },
  content: {
    /** Line under hero CTAs */
    heroSpotlightLine: "Yerba Madre x Cornell University",
  },
} as const;
