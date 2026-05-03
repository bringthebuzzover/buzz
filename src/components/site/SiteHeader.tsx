/**
 * Sticky two-row header: utility bar (socials, join waitlist / change demo view, demo login icon
 * in public), coral nav with centered logo, and nav actions where "Contact" calls
 * `openContactModal`. Demo mode swaps the centered utility action for the `ChangeViewMenu`
 * dropdown so internal users can switch persona or exit the demo entirely.
 *
 * Below 650px: hamburger left, logo right; nav slides in from the left as a paper sheet
 * below the header (pink bar stays visible).
 */
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ChevronRight, Menu, User } from "lucide-react";
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
  { to: "/brand/dashboard", label: "Dashboard" as const },
  {
    to: "/brand/dashboard",
    label: "Plan your Campaign" as const,
    state: { openPlanCampaign: true } as const,
  },
] as const;

export default function SiteHeader() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { openContactModal } = useSiteChrome();
  const { isDemoActive, openPasscodeModal, demoView } = useAccessGate();
  const { images, social } = siteIdentity;
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const [mobilePanelTopPx, setMobilePanelTopPx] = useState(0);

  const updateMobilePanelTop = useCallback(() => {
    const el = headerRef.current;
    if (!el) return;
    setMobilePanelTopPx(el.getBoundingClientRect().bottom);
  }, []);

  useLayoutEffect(() => {
    updateMobilePanelTop();
    window.addEventListener("resize", updateMobilePanelTop);
    window.addEventListener("scroll", updateMobilePanelTop, true);
    return () => {
      window.removeEventListener("resize", updateMobilePanelTop);
      window.removeEventListener("scroll", updateMobilePanelTop, true);
    };
  }, [updateMobilePanelTop]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 650px)");
    const onChange = () => {
      if (mq.matches) setMobileNavOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

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
    <header
      ref={headerRef}
      className={`relative w-full ${mobileNavOpen ? "z-[100]" : "z-50"}`}
    >
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

      <nav className="relative bg-buzz-coral text-buzz-paper shadow-sm">
        {/* Desktop / tablet: centered logo, links on sides */}
        <div className="relative hidden min-[650px]:flex h-[6rem] items-center justify-between px-8 py-4 font-medium">
          <div className="flex space-x-8">
            <Link to="/" className="transition hover:text-buzz-butterBright">
              Home
            </Link>
            {isDemoActive
              ? demoNavLinks.map((link) => (
                  <Link
                    key={link.label}
                    to={link.to}
                    state={"state" in link ? link.state : undefined}
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
            className="absolute left-1/2 top-1/2 z-10 flex h-17 w-56 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center px-3"
          >
            <img
              src={images.logo}
              alt={images.logoAlt}
              className="h-full w-auto max-w-full object-contain"
            />
          </button>

          <div className="flex space-x-8">
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
        </div>

        {/* Mobile: hamburger left, logo right — sheet slides from left below header */}
        <div className="flex min-[650px]:hidden items-center justify-between gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => setMobileNavOpen((o) => !o)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/30 bg-white/10 text-buzz-paper transition hover:bg-white/20"
            aria-expanded={mobileNavOpen}
            aria-controls="mobile-nav-menu"
            aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
          >
            <Menu size={22} />
          </button>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex h-12 max-h-[3.25rem] max-w-[55vw] shrink cursor-pointer items-center justify-end"
          >
            <img
              src={images.logo}
              alt={images.logoAlt}
              className="h-full w-auto max-w-full object-contain object-right"
            />
          </button>
        </div>

        {/* Mobile: backdrop + paper sheet (does not cover header — starts below it) */}
        <div
          className={`fixed inset-x-0 bottom-0 z-[55] min-[650px]:hidden transition-opacity duration-300 ${
            mobileNavOpen
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0"
          }`}
          style={{ top: mobilePanelTopPx }}
          aria-hidden={!mobileNavOpen}
        >
          <button
            type="button"
            className="absolute inset-0 z-0 bg-buzz-overlay/45"
            aria-label="Close menu"
            tabIndex={mobileNavOpen ? 0 : -1}
            onClick={() => setMobileNavOpen(false)}
          />
          <div
            id="mobile-nav-menu"
            className={`absolute bottom-0 left-0 right-8 top-0 z-[1] flex flex-col border border-buzz-lineMid bg-buzz-paper shadow-buzzLg transition-transform duration-300 ease-out ${
              mobileNavOpen ? "translate-x-0" : "-translate-x-full"
            } rounded-tl-none rounded-br-3xl rounded-tr-3xl`}
          >
            <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-8 pt-5">
              <ul className="flex flex-col gap-0 text-sm font-black uppercase tracking-wide text-buzz-ink">
                <li>
                  <Link
                    to="/"
                    className="flex items-center justify-between gap-3 border-b border-buzz-line py-4 pr-1 transition hover:text-buzz-coral"
                    onClick={() => setMobileNavOpen(false)}
                  >
                    Home
                    <ChevronRight
                      size={18}
                      className="shrink-0 text-buzz-inkFaint"
                      aria-hidden
                    />
                  </Link>
                </li>
                {isDemoActive
                  ? demoNavLinks.map((link) => (
                      <li key={link.label}>
                        <Link
                          to={link.to}
                          state={"state" in link ? link.state : undefined}
                          className="flex items-center justify-between gap-3 border-b border-buzz-line py-4 pr-1 transition hover:text-buzz-coral"
                          onClick={() => setMobileNavOpen(false)}
                        >
                          {link.label}
                          <ChevronRight
                            size={18}
                            className="shrink-0 text-buzz-inkFaint"
                            aria-hidden
                          />
                        </Link>
                      </li>
                    ))
                  : null}
                <li>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 border-b border-buzz-line py-4 pr-1 text-left transition hover:text-buzz-coral"
                    onClick={() => {
                      setMobileNavOpen(false);
                      openContactModal();
                    }}
                  >
                    Contact
                    <ChevronRight
                      size={18}
                      className="shrink-0 text-buzz-inkFaint"
                      aria-hidden
                    />
                  </button>
                </li>
                {!isDemoActive ? (
                  <li>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 py-4 pr-1 text-left transition hover:text-buzz-coral"
                      onClick={() => {
                        setMobileNavOpen(false);
                        handleJoinWaitlist();
                      }}
                    >
                      Join Waitlist!
                      <ChevronRight
                        size={18}
                        className="shrink-0 text-buzz-inkFaint"
                        aria-hidden
                      />
                    </button>
                  </li>
                ) : null}
              </ul>
            </nav>
          </div>
        </div>
      </nav>
    </header>
  );
}
