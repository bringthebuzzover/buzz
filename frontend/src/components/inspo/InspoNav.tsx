/**
 * One marketing chrome for every Inspo surface. Coral wordmark, cream bar,
 * Students / Brands / Resources jump to assembled sections.
 */
import { Link } from "react-router-dom";
import { siteIdentity } from "../../data/siteIdentity";
import { LinkButton } from "../forms/controls";
import { TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

const LINKS = [
  { to: "/inspo#opportunities", label: "Students" },
  { to: "/inspo#map", label: "Brands" },
  { to: "/inspo#faqs", label: "Resources" },
] as const;

export default function InspoNav() {
  const { images } = siteIdentity;
  return (
    <header className="sticky top-0 z-buzzBanner border-b border-buzz-lineMid bg-buzz-cream/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/inspo" className="flex items-center">
          <img src={images.logoCoral} alt={images.logoAlt} className="h-7 w-auto" />
        </Link>
        <nav className={cn("hidden items-center gap-8 md:flex", TEXT.body)}>
          {LINKS.map((link) => (
            <a
              key={link.to}
              href={link.to}
              className="font-medium text-buzz-inkMuted hover:text-buzz-coral"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="text-sm font-medium text-buzz-inkMuted hover:text-buzz-coral"
          >
            Log in
          </Link>
          <LinkButton to="/org/apply" size="compact">
            Sign up
          </LinkButton>
        </div>
      </div>
    </header>
  );
}
