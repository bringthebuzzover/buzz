/**
 * Single source of truth for public links, handles, contact info, logo assets, and hero copy.
 * Edit values here instead of hunting through components; consumed by header, footer, modals, and hero.
 */
import buzzLogo from "../assets/buzz-logo.svg";
import buzzLogoCoral from "../assets/buzz-logo-coral.svg";
import instaIcon from "../assets/insta-icon.png";
import linkedinIcon from "../assets/linkedin-icon.png";

/** Read-only config object consumed by header, footer, modals, and hero. */
export const siteIdentity = {
  images: {
    /** Full-color mark for dark / coral bars (white wordmark). */
    logo: buzzLogo,
    /** Coral wordmark for light backgrounds (footer, etc.). */
    logoCoral: buzzLogoCoral,
    logoAlt: "BUZZ",
    socialInstagramIcon: instaIcon,
    socialLinkedinIcon: linkedinIcon,
  },
  brand: {
    name: "BUZZ",
    displayName: "Bring the Buzz Over",
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
