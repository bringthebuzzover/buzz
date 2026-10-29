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

const linkClass = cn("text-sm text-muted hover:text-primary", focusRingClass);

export default function SiteFooter() {
  const { openContactModal } = useSiteChrome();
  const { contact, social } = siteIdentity;

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
            <Link to="/for-orgs" className={linkClass}>
              For organizations
            </Link>
            <Link to="/for-brands" className={linkClass}>
              For brands
            </Link>
          </FooterCol>
          <FooterCol title="Get started">
            <Link to="/org/apply" className={linkClass}>
              Apply as Organization
            </Link>
            <Link to="/brand/apply" className={linkClass}>
              Apply as Brand
            </Link>
            <Link to="/login" className={linkClass}>
              Organization login
            </Link>
            <Link to="/brand/login" className={linkClass}>
              Brand login
            </Link>
          </FooterCol>
          <FooterCol title="Company">
            <button type="button" onClick={openContactModal} className={cn(linkClass, "text-left")}>
              Contact
            </button>
            <Link to="/privacy" className={linkClass}>
              Privacy Policy
            </Link>
            <Link to="/terms" className={linkClass}>
              Terms of Service
            </Link>
            <Link to="/data-deletion" className={linkClass}>
              Data Deletion
            </Link>
          </FooterCol>
        </div>
        <div className="flex flex-wrap items-center gap-4 border-t border-line pt-6">
          <a href={`mailto:${contact.email}`} className={cn(linkClass, "text-xs")}>
            {contact.email}
          </a>
          <div className="flex-1" />
          <a
            href={social.instagram.profileUrl}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border border-line px-3 py-2 text-xs text-muted",
              focusRingClass,
            )}
          >
            <img
              src={siteIdentity.images.socialInstagramIcon}
              alt=""
              className="buzz-icon-on-ink h-4 w-4"
            />
            Instagram
          </a>
          <a
            href={social.linkedin.companyUrl}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border border-line px-3 py-2 text-xs text-muted",
              focusRingClass,
            )}
          >
            <img
              src={siteIdentity.images.socialLinkedinIcon}
              alt=""
              className="buzz-icon-on-ink h-4 w-4"
            />
            LinkedIn
          </a>
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
