/** Shared full marketing footer used on public, legal, and portal routes. */
import { Link } from "react-router-dom";
import { siteIdentity } from "../../data/siteIdentity";
import { BeeMark, Logo } from "../ui/BrandMark";
import { LinkButton } from "../forms/controls";
import { cn } from "../../theme/cn";
import { focusRingClass } from "../../theme/controls";
import { MOTION } from "../../theme/motion";
import { footerLinkClass, SOCIAL_LINKS } from "./footerLinks";

export type SiteFooterAudience = "both" | "org" | "brand";
export type SiteFooterMode = "public" | "signed-in";

export default function SiteFooter({
  audience = "both",
  mode = "public",
  showCta = true,
}: {
  audience?: SiteFooterAudience;
  mode?: SiteFooterMode;
  showCta?: boolean;
}) {
  const { contact } = siteIdentity;
  const isSignedIn = mode === "signed-in";
  const hasCta = !isSignedIn && showCta;
  const isBrand = audience === "brand";
  const isOrg = audience === "org";
  const primary = isBrand
    ? { label: "Apply as a brand", to: "/brand/apply" }
    : { label: "Join as a student organization", to: "/org/apply" };
  const headingText = isBrand
    ? "Request a campaign"
    : isOrg
      ? "Bring your org."
      : "Want to join?";

  return (
    <footer
      id={!isSignedIn && showCta && audience === "both" ? "home-join" : undefined}
      data-reveal-group
      role="contentinfo"
      data-nav-surface="ink"
      className={cn(
        "flex flex-col bg-page text-primary",
        hasCta
          ? "min-h-[844px] px-4 pb-28 pt-24 md:min-h-[900px] md:px-12 md:pb-16 md:pt-[135px]"
          : "px-6 py-10 md:px-12 md:py-10",
      )}
    >
      {hasCta ? (
        <>
          <h2
            data-reveal-line
            className="max-w-full text-[40px] font-medium leading-none tracking-tight md:text-buzzDisplay"
          >
            {headingText}
          </h2>
          {isBrand ? (
            <p className="mt-5 text-base text-muted">
              You request a call. BUZZ builds and publishes the drop.
            </p>
          ) : null}
          <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <LinkButton to={primary.to} className="h-11 px-5">
              {primary.label}
            </LinkButton>
            {audience === "both" ? (
              <Link to="/brand/apply" className={footerLinkClass}>
                Apply as a brand
              </Link>
            ) : null}
            {audience === "org" ? (
              <Link to="/login" className={footerLinkClass}>
                Already connected? Log in
              </Link>
            ) : null}
          </div>
          <a
            href={`mailto:${contact.email}`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "mt-8 break-all text-[20px] font-medium leading-tight md:text-buzzStatement hover:text-accent inline-block",
              MOTION.press,
              focusRingClass,
            )}
          >
            {contact.email}
          </a>
        </>
      ) : null}

      <div
        className={cn(
          "mt-auto grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-5 md:gap-8",
          hasCta && "pt-16",
        )}
      >
        <div>
          <Logo surface="ink" />
        </div>
        <FooterColumn
          title="Organizations"
          links={[
            ["/for-orgs", "How it works"],
            ["/org/apply", "Apply"],
            ["/login", "Login"],
          ]}
        />
        <FooterColumn
          title="Brands"
          links={[
            ["/for-brands", "How it works"],
            ["/brand/apply", "Apply"],
            ["/brand/login", "Login"],
          ]}
        />
        <div>
          <h3 className="mb-3 text-sm font-medium">Social</h3>
          <ul className="space-y-2">
            {SOCIAL_LINKS.map(({ label, href }) => (
              <li key={label}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={footerLinkClass}
                >
                  {label}
                </a>
              </li>
            ))}
            <li>
              <a
                href={`mailto:${contact.email}`}
                target="_blank"
                rel="noopener noreferrer"
                className={footerLinkClass}
              >
                Email
              </a>
            </li>
          </ul>
        </div>
        <FooterColumn
          title="Legal"
          links={[
            ["/privacy", "Privacy"],
            ["/terms", "Terms"],
            ["/data-deletion", "Data deletion"],
          ]}
        />
      </div>
      <div
        data-footer-meta
        className="mt-10 flex flex-col items-center gap-4 text-center text-xs text-muted md:flex-row md:justify-between md:text-left"
      >
        <p>{new Date().getFullYear()}</p>
        <p>
          Connecting brands with campus communities for authentic college
          marketing, at scale.
        </p>
        <BeeMark className="h-7 w-7" />
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: [string, string][];
}) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      <ul className="space-y-2">
        {links.map(([to, label]) => (
          <li key={to}>
            <Link to={to} className={footerLinkClass}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
