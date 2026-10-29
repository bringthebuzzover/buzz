/**
 * Org portal top bar. Pen `App / TopBar`: logo, portal label, nav pills,
 * then Contact, the initials avatar, and Log out. Below `lg` the nav folds
 * into a menu under the bar.
 *
 * Also drawn on `/onboarding/denied`, where the visitor may have no session:
 * nav, avatar, and Log out need a signed-in org, otherwise the bar offers Log in.
 */
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useSiteChrome } from "../../contexts/SiteChromeContext";
import { useSignOut } from "../../api/hooks/useSignOut";
import { Logo } from "../ui/BrandMark";
import { appNavItemClass, quietLinkClass } from "../ui/navItem";
import { imageInitials } from "../ui/RemoteImage";
import { focusRingClass } from "../../theme/controls";
import { cn } from "../../theme/cn";

/** Org portal links. The marketing header shows the same ones to signed-in orgs. */
export const ORG_PORTAL_LINKS = [
  { to: "/org/browse", label: "Browse campaigns" },
  { to: "/org/campaigns", label: "My campaigns" },
  { to: "/org/profile", label: "Profile" },
] as const;

const NAV_LINKS = [{ to: "/", label: "Home" }, ...ORG_PORTAL_LINKS];

export default function OrgPortalHeader() {
  const { pathname } = useLocation();
  const { user, status } = useAuth();
  const { openContactModal } = useSiteChrome();
  const signOut = useSignOut();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const signedIn = status === "authenticated" && user?.portalRole === "org";
  const initials = imageInitials(user?.instagramUsername?.replace(/^@/, "") ?? "");

  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);

  const navLinks = signedIn ? NAV_LINKS : [];

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-page/80 backdrop-blur-lg">
      <div className="flex h-16 items-center gap-5 px-6 xl:px-12">
        <Link
          to="/"
          data-testid="site-header-logo"
          className={cn("flex shrink-0 items-center", focusRingClass)}
        >
          <Logo className="h-6 w-[79px]" />
        </Link>
        <span className="truncate text-xs text-quiet">Organization Portal</span>

        {navLinks.length > 0 ? (
          <>
            <span className="hidden h-5 w-px shrink-0 bg-line lg:block" aria-hidden />
            <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  aria-current={isActive(link.to) ? "page" : undefined}
                  className={appNavItemClass(isActive(link.to))}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </>
        ) : null}

        <span className="flex-1" aria-hidden />

        <div className="hidden items-center gap-5 lg:flex">
          <button type="button" onClick={openContactModal} className={quietLinkClass}>
            Contact
          </button>
          {signedIn ? (
            <>
              {initials ? (
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-on-accent"
                  aria-hidden
                >
                  {initials}
                </span>
              ) : null}
              <button type="button" onClick={signOut} className={quietLinkClass}>
                Log out
              </button>
            </>
          ) : (
            <Link to="/login" className={quietLinkClass}>
              Log in
            </Link>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line text-primary lg:hidden",
            focusRingClass,
          )}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav-menu"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {menuOpen ? (
        <nav
          id="mobile-nav-menu"
          aria-label="Menu"
          className="flex flex-col gap-1 border-t border-line px-4 py-4 lg:hidden"
        >
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              aria-current={isActive(link.to) ? "page" : undefined}
              className={appNavItemClass(isActive(link.to))}
            >
              {link.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              openContactModal();
            }}
            className={cn(appNavItemClass(false), "text-left")}
          >
            Contact
          </button>
          {signedIn ? (
            <button
              type="button"
              onClick={signOut}
              className={cn(appNavItemClass(false), "text-left")}
            >
              Log out
            </button>
          ) : (
            <Link to="/login" className={appNavItemClass(false)}>
              Log in
            </Link>
          )}
        </nav>
      ) : null}
    </header>
  );
}
