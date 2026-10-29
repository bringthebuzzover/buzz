/**
 * Public nav. Guests get the pen's glass bar (logo, tours, login, join).
 * Signed-in portal users keep their links. Every control takes the focus ring.
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
import { useSiteChrome } from "../../contexts/SiteChromeContext";
import { useSignOut } from "../../api/hooks/useSignOut";
import { useAuth } from "../../contexts/AuthContext";
import { goToHomeJoin } from "../../utils/scrollHomeJoin";
import { Logo } from "../ui/BrandMark";
import { Button } from "../forms/controls";
import { focusRingClass } from "../../theme/controls";
import { cn } from "../../theme/cn";

const ORG_NAV_LINKS = [
  { to: "/org/browse", label: "Browse Campaigns" },
  { to: "/org/campaigns", label: "My Campaigns" },
  { to: "/org/profile", label: "Profile" },
] as const;

const BRAND_NAV_LINKS = [
  { to: "/brand/dashboard", label: "Dashboard" as const },
  { to: "/brand/settings", label: "Setup" as const },
] as const;

const ORG_DESKTOP_MIN_PX = 1024;
const COMPACT_DESKTOP_MIN_PX = 650;

export default function SiteHeader() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { openContactModal } = useSiteChrome();
  const { user, status: authStatus } = useAuth();
  const signOut = useSignOut();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [paperTone, setPaperTone] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const [mobilePanelTopPx, setMobilePanelTopPx] = useState(0);

  const marketing =
    pathname === "/" || pathname === "/for-orgs" || pathname === "/for-brands";

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
    if (!marketing) {
      setPaperTone(false);
      return;
    }
    const read = () => {
      const header = headerRef.current;
      if (!header) return;
      const bottom = header.getBoundingClientRect().bottom;
      const under = document.elementFromPoint(window.innerWidth / 2, bottom + 12);
      const surface = under?.closest("[data-nav-surface]")?.getAttribute("data-nav-surface");
      setPaperTone(surface === "paper");
    };
    read();
    window.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", read);
    return () => {
      window.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
    };
  }, [marketing, pathname]);

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

  const navLinks = isApiAuth
    ? user.portalRole === "brand"
      ? BRAND_NAV_LINKS
      : user.portalRole === "org"
        ? ORG_NAV_LINKS
        : []
    : [
        { to: "/for-orgs", label: "Organizations" },
        { to: "/for-brands", label: "Brands" },
        { to: "/#how-it-works", label: "How it works" },
      ];

  const isNavActive = (to: string): boolean => {
    if (to === "/") return pathname === "/";
    if (to.startsWith("/#")) return false;
    return pathname === to || pathname.startsWith(`${to}/`);
  };

  const join =
    pathname.startsWith("/for-brands")
      ? { label: "Apply", onClick: () => navigate("/brand/apply") }
      : pathname === "/" || pathname === "/for-orgs"
        ? { label: "Join", onClick: () => goToHomeJoin(pathname, navigate) }
        : { label: "Join Us!", onClick: () => goToHomeJoin(pathname, navigate) };

  const linkClass = (active: boolean) =>
    cn(
      "whitespace-nowrap text-sm",
      paperTone ? "text-on-accent" : "text-primary",
      active && "underline decoration-1 underline-offset-8",
      focusRingClass,
    );

  const desktopHidden = isOrgNav ? "lg:flex" : "min-[650px]:flex";
  const desktopOnly = isOrgNav ? "max-lg:hidden" : "max-[649px]:hidden";
  const mobileOnly = isOrgNav ? "lg:hidden" : "min-[650px]:hidden";

  return (
    <header
      ref={headerRef}
      className={cn(
        marketing ? "pointer-events-none absolute inset-x-0 top-0 z-50" : "relative z-50",
        mobileNavOpen && "z-buzzBanner",
      )}
    >
      <div className={cn("pointer-events-auto px-3 pt-2 md:px-6", !marketing && "px-3 py-3 md:px-6")}>
        <nav
          className={cn(
            "mx-auto flex h-[66px] max-w-[1152px] items-center justify-between rounded-buzzCard border px-5 backdrop-blur-md",
            paperTone
              ? "border-on-accent/10 bg-white/70 text-on-accent"
              : "border-white/10 bg-page/70 text-primary",
          )}
          aria-label="Primary"
        >
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              data-testid="site-header-logo"
              onClick={() => navigate("/")}
              className={cn("flex h-10 max-w-[9rem] shrink-0 items-center", focusRingClass)}
            >
              <Logo surface={paperTone ? "paper" : "ink"} className="h-8" />
            </button>
            {isApiAuth && (user.portalRole === "org" || user.portalRole === "brand") ? (
              <span
                className={cn(
                  "truncate text-xs",
                  paperTone ? "text-on-accent" : "text-muted",
                )}
              >
                {user.portalRole === "brand" ? "Brand Portal" : "Organization Portal"}
              </span>
            ) : null}
          </div>

          <div className={cn("hidden items-center gap-6", desktopHidden, desktopOnly)}>
            {isApiAuth ? (
              <Link to="/" className={linkClass(isNavActive("/"))}>
                Home
              </Link>
            ) : null}
            {navLinks.map((link) =>
              link.to.startsWith("/#") ? (
                <a
                  key={link.label}
                  href={marketing ? "#how-it-works" : "/#how-it-works"}
                  className={linkClass(false)}
                >
                  {link.label}
                </a>
              ) : (
                <Link key={link.label} to={link.to} className={linkClass(isNavActive(link.to))}>
                  {link.label}
                </Link>
              ),
            )}
            <button
              type="button"
              onClick={openContactModal}
              className={cn("text-sm", paperTone ? "text-on-accent" : "text-primary", focusRingClass)}
            >
              Contact
            </button>
            {isApiAuth ? (
              <button
                type="button"
                onClick={signOut}
                className={cn(
                  "inline-flex items-center gap-1 text-sm",
                  paperTone ? "text-on-accent" : "text-primary",
                  focusRingClass,
                )}
                aria-label="Log out"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">Logout</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className={cn("text-sm", paperTone ? "text-on-accent" : "text-primary", focusRingClass)}
                  aria-label="Log in"
                >
                  Login
                </button>
                <Button type="button" className="h-11 px-5" onClick={join.onClick}>
                  {join.label}
                </Button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileNavOpen((open) => !open)}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full border border-line",
              mobileOnly,
              focusRingClass,
            )}
            aria-expanded={mobileNavOpen}
            aria-controls="mobile-nav-menu"
            aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
          >
            <Menu size={22} />
          </button>
        </nav>
      </div>

      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-0 z-buzzDrawer",
          mobileOnly,
          mobileNavOpen && "pointer-events-auto",
        )}
        style={{ top: mobilePanelTopPx }}
        aria-hidden={!mobileNavOpen}
      >
        <button
          type="button"
          className="absolute inset-0 bg-page/60"
          aria-label="Close menu"
          tabIndex={mobileNavOpen ? 0 : -1}
          onClick={() => setMobileNavOpen(false)}
        />
        <div
          id="mobile-nav-menu"
          className={cn(
            "absolute bottom-0 left-0 right-8 top-0 flex flex-col border border-line bg-page text-primary shadow-buzzLg transition-transform duration-300",
            mobileNavOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <nav className="flex flex-1 flex-col overflow-y-auto px-5 py-6">
            <Link to="/" className={cn("border-b border-line py-4 text-sm", focusRingClass)} onClick={() => setMobileNavOpen(false)}>
              Home
            </Link>
            {navLinks.map((link) => (
              <Link
                key={link.label}
                to={link.to.startsWith("/#") ? (marketing ? "/#how-it-works" : "/#how-it-works") : link.to}
                className={cn("flex items-center justify-between border-b border-line py-4 text-sm", focusRingClass)}
                onClick={() => setMobileNavOpen(false)}
              >
                {link.label}
                <ChevronRight size={18} className="text-muted" aria-hidden />
              </Link>
            ))}
            {isApiAuth ? null : (
              <button
                type="button"
                className={cn("flex w-full items-center justify-between border-b border-line py-4 text-left text-sm", focusRingClass)}
                onClick={() => {
                  setMobileNavOpen(false);
                  navigate("/login");
                }}
              >
                Login
                <ChevronRight size={18} className="text-muted" aria-hidden />
              </button>
            )}
            <button
              type="button"
              className={cn("flex w-full items-center justify-between border-b border-line py-4 text-left text-sm", focusRingClass)}
              onClick={() => {
                setMobileNavOpen(false);
                openContactModal();
              }}
            >
              Contact
              <ChevronRight size={18} className="text-muted" aria-hidden />
            </button>
            {isApiAuth ? (
              <button
                type="button"
                className={cn("flex w-full items-center justify-between py-4 text-left text-sm text-accent", focusRingClass)}
                onClick={() => {
                  setMobileNavOpen(false);
                  signOut();
                }}
              >
                Logout
                <LogOut size={18} aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                className={cn("py-4 text-left text-sm", focusRingClass)}
                onClick={() => {
                  setMobileNavOpen(false);
                  join.onClick();
                }}
              >
                {join.label}
              </button>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
