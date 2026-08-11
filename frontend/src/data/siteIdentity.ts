/**
 * Public links, handles, contact person, logo assets, and hero copy.
 * Edit values here instead of hunting through components; consumed by header,
 * footer, modals, and hero.
 *
 * Email addresses (transactional From + public contact) live in
 * ``backend/brand_emails.json`` — imported via the ``@brandEmails`` alias.
 *
 * Buzz wordmarks live under `public/logos/` (`publicLogo()`). Social icons stay bundled in `src/assets/`.
 */
import brandEmails from "@brandEmails";
import instaIcon from "../assets/insta-icon.png";
import linkedinIcon from "../assets/linkedin-icon.png";
import { publicLogo } from "../utils/publicLogo";

/** Read-only config object consumed by header, footer, modals, and hero. */
export const siteIdentity = {
  images: {
    /** Full-color mark for dark / coral bars (white wordmark). */
    logo: publicLogo("buzz-logo.svg"),
    /** Coral wordmark for light backgrounds (footer, etc.). */
    logoCoral: publicLogo("buzz-logo-coral.svg"),
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
    primaryPersonName: "Melissa Chowdhury",
    email: brandEmails.contactEmail,
  },
  content: {
    /** Line under hero CTAs */
    heroSpotlightLine: "Yerba Madre x Cornell University",
  },
} as const;
