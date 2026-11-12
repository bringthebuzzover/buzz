/** Link styling and social links shared by the site footer and the marketing footer. */
import { siteIdentity } from "../../data/siteIdentity";
import { focusRingClass } from "../../theme/controls";
import { cn } from "../../theme/cn";

export const footerLinkClass = cn(
  "text-sm text-muted hover:text-primary transition-colors duration-150 inline-block active:scale-95",
  focusRingClass,
);

const { social, images } = siteIdentity;

export const SOCIAL_LINKS = [
  { label: "Instagram", href: social.instagram.profileUrl, icon: images.socialInstagramIcon },
  { label: "LinkedIn", href: social.linkedin.companyUrl, icon: images.socialLinkedinIcon },
] as const;
