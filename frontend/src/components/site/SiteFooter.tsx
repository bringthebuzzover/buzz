/** Shared full marketing footer used on public, legal, and portal routes. */
import { Link } from "react-router-dom";
import { siteIdentity } from "../../data/siteIdentity";
import { BeeMark } from "../ui/BrandMark";
import { LinkButton } from "../forms/controls";
import { cn } from "../../theme/cn";
import { focusRingClass } from "../../theme/controls";
import { footerLinkClass, SOCIAL_LINKS } from "./footerLinks";

export type SiteFooterAudience = "both" | "org" | "brand";

export default function SiteFooter({
  audience = "both",
}: {
  audience?: SiteFooterAudience;
}) {
  const { contact } = siteIdentity;
  const isBrand = audience === "brand";
  const primary = isBrand
    ? { label: "Apply as a brand", to: "/brand/apply" }
    : { label: "Join as a student organization", to: "/org/apply" };

  return (
    <footer
      id={audience === "both" ? "home-join" : undefined}
      data-reveal-group
      role="contentinfo"
      data-nav-surface="ink"
      className="flex min-h-[844px] flex-col bg-page px-4 pb-28 pt-24 text-primary md:min-h-[900px] md:px-12 md:pb-16 md:pt-[135px]"
    >
      <h2
        data-reveal-line
        className="max-w-full text-[40px] font-medium leading-none tracking-tight md:text-buzzDisplay"
      >
        {isBrand ? "Request a campaign" : "Want to join?"}
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
          <Link to="/brand/apply" className={cn("text-sm text-primary", footerLinkClass)}>
            Apply as a brand
          </Link>
        ) : null}
      </div>
      <a
        href={`mailto:${contact.email}`}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "mt-8 break-all text-[20px] font-medium leading-tight md:text-buzzStatement",
          focusRingClass,
        )}
      >
        {contact.email}
      </a>

      <div className="mt-auto grid grid-cols-2 gap-x-6 gap-y-10 pt-16 md:grid-cols-4 md:gap-8">
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
      <div className="mt-10 flex flex-col items-center gap-4 text-center text-xs text-muted md:flex-row md:justify-between md:text-left">
        <BeeMark className="h-7 w-7" />
        <p>
          Connecting brands with campus communities for authentic college
          marketing, at scale.
        </p>
        <p>{new Date().getFullYear()}</p>
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
