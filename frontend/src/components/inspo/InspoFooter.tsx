/**
 * Coral marketing footer — white wordmark on coral, same social marks as live site.
 */
import { siteIdentity } from "../../data/siteIdentity";
import { PAD } from "../../theme/tokens";
import { cn } from "../../theme/cn";

export default function InspoFooter() {
  const { images, social } = siteIdentity;
  return (
    <footer className="bg-buzz-coral">
      <div
        className={cn(
          "mx-auto flex max-w-6xl items-center justify-between px-6",
          PAD.card,
        )}
      >
        <img src={images.logo} alt={images.logoAlt} className="h-8 w-auto" />
        <div className="flex gap-4">
          <a href={social.instagram.profileUrl} aria-label="Instagram">
            <img
              src={images.socialInstagramIcon}
              alt=""
              className="h-5 w-5 brightness-0 invert"
            />
          </a>
          <a href={social.linkedin.companyUrl} aria-label="LinkedIn">
            <img
              src={images.socialLinkedinIcon}
              alt=""
              className="h-5 w-5 brightness-0 invert"
            />
          </a>
        </div>
      </div>
    </footer>
  );
}
