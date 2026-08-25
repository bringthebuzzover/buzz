/**
 * Sticky two-row header: utility bar (socials, join us / login / logout),
 * coral nav with centered logo. When a user is authenticated, shows persona-aware
 * nav links from the auth context.
 */
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ChevronRight, LogOut, Menu } from "lucide-react";
import { siteIdentity } from "../../data/siteIdentity";
import { useSiteChrome } from "../../contexts/SiteChromeContext";
import { useEndImpersonation } from "../../api/hooks/useEndImpersonation";
import { useAuth } from "../../contexts/AuthContext";
import { goToHomeJoin } from "../../utils/scrollHomeJoin";

const ORG_NAV_LINKS = [
  { to: "/org/browse", label: "Browse Campaigns" },
  { to: "/org/campaigns", label: "My Campaigns" },
  { to: "/org/profile", label: "Profile" },
] as const;

const BRAND_NAV_LINKS = [
  { to: "/brand/dashboard", label: "Dashboard" as const },
] as const;

/** Guest/brand left clusters are short; org’s four labels need lg. */
const ORG_DESKTOP_MIN_PX = 1024;
const COMPACT_DESKTOP_MIN_PX = 650;

export default function SiteHeader() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { openContactModal } = useSiteChrome();
  const { user, status: authStatus, logout } = useAuth();
  const endImpersonation = useEndImpersonation();
  const { images, social } = siteIdentity;
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const [mobilePanelTopPx, setMobilePanelTopPx] = useState(0);

  // During View-as, Logout must exit impersonation — not POST /logout, which
  // would clear the admin session cookie underneath.
  const handleLogout = () => {
    if (user?.impersonatedBy) {
      void endImpersonation();
      return;
    }
    logout();
  };

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

  const isApiAuth = authStatus === "authenticated" && user;
  const isOrgNav = authStatus === "authenticated" && user?.portalRole === "org";
  const desktopMinPx = isOrgNav ? ORG_DESKTOP_MIN_PX : COMPACT_DESKTOP_MIN_PX;

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${desktopMinPx}px)`);
    const onChange = () => {
      if (mq.matches) setMobileNavOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [desktopMinPx]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  // Determine nav links from the authenticated user's role.
  const navLinks = isApiAuth
    ? user.portalRole === "brand"
      ? BRAND_NAV_LINKS
      : user.portalRole === "org"
        ? ORG_NAV_LINKS
        : []
    : [];

  const isNavActive = (to: string): boolean => {
    if (to === "/") return pathname === "/";
    return pathname === to || pathname.startsWith(`${to}/`);
  };

  const navItemClass = (active: boolean) =>
    `whitespace-nowrap transition hover:text-buzz-butterBright ${
      active ? "underline decoration-2 underline-offset-8" : ""
    }`;

  const handleJoinClick = () => {
    goToHomeJoin(pathname, navigate);
  };

  const showCenterItem = !!isApiAuth;

  return (
    <header
      ref={headerRef}
      className={`relative w-full ${mobileNavOpen ? "z-[100]" : "z-50"}`}
    >
      {/* Top utility bar */}
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

        {showCenterItem ? (
          <span className="text-center font-bold text-buzz-coral">
            {user?.portalRole === "brand" ? "Brand Portal" : "Org Portal"}
          </span>
        ) : (
          <button
            type="button"
            onClick={handleJoinClick}
            className="cursor-pointer text-center font-bold text-buzz-coral hover:underline"
          >
            Join Us!
          </button>
        )}

        <div className="absolute right-6 flex items-center gap-4">
          {isApiAuth ? (
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1 text-buzz-inkMuted hover:text-buzz-coral"
              aria-label="Log out"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline text-xs font-bold">Logout</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="text-buzz-inkMuted hover:text-buzz-coral"
              aria-label="Log in"
            >
              <span className="text-xs font-bold">Login</span>
            </button>
          )}
        </div>
      </div>

      {/* Coral nav bar. Logo is in-flow (1fr / auto / 1fr) so it cannot cover
          the side clusters. Org uses lg; guest/brand keep 650px. */}
      <nav className="relative bg-buzz-coral text-buzz-paper shadow-sm">
        <div
          className={`relative hidden h-[6rem] grid-cols-[1fr_auto_1fr] items-center px-8 py-4 font-medium ${
            isOrgNav ? "lg:grid" : "min-[650px]:grid"
          }`}
        >
          <div
            className={
              isOrgNav
                ? "flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 xl:gap-x-8"
                : "flex min-w-0 items-center gap-x-8"
            }
          >
            <Link to="/" className={navItemClass(isNavActive("/"))}>
              Home
            </Link>
            {navLinks.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                className={navItemClass(isNavActive(link.to))}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <button
            type="button"
            data-testid="site-header-logo"
            onClick={() => navigate("/")}
            className="flex h-16 max-w-[11rem] shrink-0 cursor-pointer items-center justify-center px-2"
          >
            <img
              src={images.logo}
              alt={images.logoAlt}
              className="h-full w-auto max-w-full object-contain"
            />
          </button>

          <div className="flex min-w-0 items-center justify-end gap-x-8">
            <button
              type="button"
              onClick={openContactModal}
              className="whitespace-nowrap transition hover:text-buzz-butterBright"
            >
              Contact
            </button>
            {!showCenterItem ? (
              <button
                type="button"
                onClick={handleJoinClick}
                className="whitespace-nowrap transition hover:text-buzz-butterBright"
              >
                Join Us!
              </button>
            ) : null}
          </div>
        </div>

        {/* Mobile nav */}
        <div
          className={`flex items-center justify-between gap-3 px-4 py-3 ${
            isOrgNav ? "lg:hidden" : "min-[650px]:hidden"
          }`}
        >
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
            data-testid="site-header-logo"
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

        {/* Mobile panel */}
        <div
          className={`fixed inset-x-0 bottom-0 z-[55] transition-opacity duration-300 ${
            isOrgNav ? "lg:hidden" : "min-[650px]:hidden"
          } ${
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
                    <ChevronRight size={18} className="shrink-0 text-buzz-inkFaint" aria-hidden />
                  </Link>
                </li>
                {navLinks.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="flex items-center justify-between gap-3 border-b border-buzz-line py-4 pr-1 transition hover:text-buzz-coral"
                      onClick={() => setMobileNavOpen(false)}
                    >
                      {link.label}
                      <ChevronRight size={18} className="shrink-0 text-buzz-inkFaint" aria-hidden />
                    </Link>
                  </li>
                ))}
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
                    <ChevronRight size={18} className="shrink-0 text-buzz-inkFaint" aria-hidden />
                  </button>
                </li>
                {!showCenterItem ? (
                  <li>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 py-4 pr-1 text-left transition hover:text-buzz-coral"
                      onClick={() => {
                        setMobileNavOpen(false);
                        handleJoinClick();
                      }}
                    >
                      Join Us!
                      <ChevronRight size={18} className="shrink-0 text-buzz-inkFaint" aria-hidden />
                    </button>
                  </li>
                ) : null}
                {isApiAuth ? (
                  <li>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 py-4 pr-1 text-left font-bold text-buzz-coral transition hover:text-buzz-coralDark"
                      onClick={() => {
                        setMobileNavOpen(false);
                        handleLogout();
                      }}
                    >
                      Logout
                      <LogOut size={18} className="shrink-0" aria-hidden />
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
