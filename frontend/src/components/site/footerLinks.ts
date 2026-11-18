/** Link styling and social links shared by the site footer and the marketing footer. */
import { siteIdentity } from "../../data/siteIdentity";
import { focusRingClass } from "../../theme/controls";
import { cn } from "../../theme/cn";
import { MOTION } from "../../theme/motion";

export const footerLinkClass = cn(
  "text-sm inline-block",
  MOTION.interactiveLink,
  focusRingClass,
);

const { social, images } = siteIdentity;

export const SOCIAL_LINKS = [
  { label: "Instagram", href: social.instagram.profileUrl, icon: images.socialInstagramIcon },
  { label: "LinkedIn", href: social.linkedin.companyUrl, icon: images.socialLinkedinIcon },
] as const;
