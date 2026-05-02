/**
 * Sticky two-row header: utility bar (socials, join waitlist / change demo view, demo login icon
 * in public), coral nav with centered logo, and nav actions where "Contact" calls
 * `openContactModal`. Demo mode swaps the centered utility action for the `ChangeViewMenu`
 * dropdown so internal users can switch persona or exit the demo entirely.
 */
import { Link, useLocation, useNavigate } from "react-router-dom";
import { User } from "lucide-react";
import { siteIdentity } from "../../data/siteIdentity";
import { useSiteChrome } from "../../contexts/SiteChromeContext";
import { useAccessGate } from "../../contexts/AccessGateContext";
import { goToHomeWaitlist } from "../../utils/scrollHomeWaitlist";
import ChangeViewMenu from "./ChangeViewMenu";

/** Persona-aware bottom-nav links shown when the user is in demo mode. */
const ORG_NAV_LINKS = [
  { to: "/org/drops", label: "Drop Feed" },
  { to: "/org/campaigns", label: "My Campaigns" },
] as const;

const BRAND_NAV_LINKS = [
  { to: "/brand/dashboard", label: "Dashboard" },
  { to: "/brand/requests/new", label: "Request Drop" },
] as const;

export default function SiteHeader() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { openContactModal } = useSiteChrome();
  const { isDemoActive, openPasscodeModal, demoView } = useAccessGate();
  const { images, social } = siteIdentity;

  const demoNavLinks =
    demoView === "brand"
      ? BRAND_NAV_LINKS
      : demoView === "org"
        ? ORG_NAV_LINKS
        : [];

  const handleJoinWaitlist = () => {
    goToHomeWaitlist(pathname, navigate);
  };

  return (
    <header className="relative z-50 w-full">
      <div className="relative flex h-10 items-center justify-center border-b border-buzz-line bg-buzz-cream px-6 text-xs font-semibold tracking-wider">
        <div className="absolute left-6 flex space-x-4">
          <a
            href={social.instagram.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-buzz-inkMuted hover:opacity-80"
            aria-label="Instagram"
          >
            <img src={images.socialInstagramIcon} alt="" className="h-4 w-4" />
          </a>
          <a
            href={social.linkedin.companyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-buzz-inkMuted hover:opacity-80"
            aria-label="LinkedIn"
          >
            <img src={images.socialLinkedinIcon} alt="" className="h-4 w-4" />
          </a>
        </div>
        {isDemoActive ? (
          <ChangeViewMenu />
        ) : (
          <button
            type="button"
            onClick={handleJoinWaitlist}
            className="cursor-pointer text-center font-bold text-buzz-coral hover:underline"
          >
            Join Waitlist!
          </button>
        )}
        <div className="absolute right-6 flex items-center gap-4">
          {!isDemoActive ? (
            <button
              type="button"
              onClick={openPasscodeModal}
              aria-label="Open demo access"
              className="text-buzz-inkMuted hover:text-buzz-coral"
            >
              <User size={18} />
            </button>
          ) : null}
        </div>
      </div>

      <nav className="relative flex h-16 items-center justify-between bg-buzz-coral px-8 py-4 text-buzz-paper shadow-sm">
        <div className="flex space-x-8 font-medium">
          <Link to="/" className="transition hover:text-buzz-butterBright">
            Home
          </Link>
          {isDemoActive
            ? demoNavLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="transition hover:text-buzz-butterBright"
                >
                  {link.label}
                </Link>
              ))
            : null}
        </div>

        <button
          type="button"
          onClick={() => navigate("/")}
          className="absolute left-1/2 top-[-8px] z-10 flex h-20 w-72 -translate-x-1/2 origin-bottom cursor-pointer flex-col items-center justify-center bg-buzz-coralDark px-4 shadow-sm transition-transform duration-200 ease-out hover:scale-[1.03]"
        >
          <img
            src={images.logo}
            alt={images.logoAlt}
            className="max-h-11 w-auto max-w-[200px] object-contain"
          />
          <span className="mt-1 text-[10px] font-light tracking-wider text-buzz-paper">
            {social.instagram.handleWithAt}
          </span>
        </button>

        <div className="flex space-x-8 font-medium">
          <button
            type="button"
            onClick={openContactModal}
            className="transition hover:text-buzz-butterBright"
          >
            Contact
          </button>
          {!isDemoActive ? (
            <button
              type="button"
              onClick={handleJoinWaitlist}
              className="transition hover:text-buzz-butterBright"
            >
              Join Waitlist!
            </button>
          ) : null}
        </div>
      </nav>
    </header>
  );
}
