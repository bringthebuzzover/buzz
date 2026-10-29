/**
 * Compact site footer (pen Site / Footer): tours, apply, company.
 * Marketing home / for-orgs / for-brands render their own join footer instead.
 */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useSiteChrome } from "../../contexts/SiteChromeContext";
import { siteIdentity } from "../../data/siteIdentity";
import { BeeMark, Logo } from "../ui/BrandMark";
import { focusRingClass } from "../../theme/controls";
import { cn } from "../../theme/cn";
import { footerLinkClass, SOCIAL_LINKS } from "./footerLinks";

export default function SiteFooter() {
  const { openContactModal } = useSiteChrome();
  const { contact } = siteIdentity;

  return (
    <footer className="border-t border-line bg-page px-6 py-12 text-primary sm:px-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-14">
        <div className="flex flex-col gap-8 lg:flex-row lg:gap-6">
          <div className="max-w-sm">
            <Logo className="mb-4 h-10" />
            <p className="text-base leading-relaxed text-muted">
              Connecting brands with campus communities for authentic college
              marketing, at scale.
            </p>
          </div>
          <div className="flex-1" />
          <FooterCol title="How it works">
            <Link to="/for-orgs" className={footerLinkClass}>
              For organizations
            </Link>
            <Link to="/for-brands" className={footerLinkClass}>
              For brands
            </Link>
          </FooterCol>
          <FooterCol title="Get started">
            <Link to="/org/apply" className={footerLinkClass}>
              Apply as Organization
            </Link>
            <Link to="/brand/apply" className={footerLinkClass}>
              Apply as Brand
            </Link>
            <Link to="/login" className={footerLinkClass}>
              Organization login
            </Link>
            <Link to="/brand/login" className={footerLinkClass}>
              Brand login
            </Link>
          </FooterCol>
          <FooterCol title="Company">
            <button type="button" onClick={openContactModal} className={cn(footerLinkClass, "text-left")}>
              Contact
            </button>
            <Link to="/privacy" className={footerLinkClass}>
              Privacy Policy
            </Link>
            <Link to="/terms" className={footerLinkClass}>
              Terms of Service
            </Link>
            <Link to="/data-deletion" className={footerLinkClass}>
              Data Deletion
            </Link>
          </FooterCol>
        </div>
        <div className="flex flex-wrap items-center gap-4 border-t border-line pt-6">
          <a href={`mailto:${contact.email}`} className={cn(footerLinkClass, "text-xs")}>
            {contact.email}
          </a>
          <div className="flex-1" />
          {SOCIAL_LINKS.map(({ label, href, icon }) => (
            <a
              key={label}
              href={href}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border border-line px-3 py-2 text-xs text-muted",
                focusRingClass,
              )}
            >
              <img src={icon} alt="" className="buzz-icon-on-ink h-4 w-4" />
              {label}
            </a>
          ))}
          <BeeMark className="h-5 w-5" />
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-2 lg:w-[200px]">
      <h2 className="mb-2 text-sm font-medium text-primary">{title}</h2>
      {children}
    </div>
  );
}
