/**
 * Site-wide footer: brand blurb plus link columns. “Contact” opens the same
 * global modal as the header; Privacy Policy, Terms, and Data Deletion link to
 * the static legal pages (`/privacy`, `/terms`, `/data-deletion`).
 */
import { Link } from "react-router-dom";
import { siteIdentity } from "../../data/siteIdentity";
import { useSiteChrome } from "../../contexts/SiteChromeContext";

const linkClass = "hover:text-buzz-coral";

export default function SiteFooter() {
  const { openContactModal } = useSiteChrome();

  return (
    <footer className="mt-16 border-t border-buzz-line bg-buzz-paper px-8 py-12">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <img
            src={siteIdentity.images.logoCoral}
            alt={siteIdentity.images.logoAlt}
            className="-mb-4 w-36 h-auto -translate-x-2 -translate-y-3"
          />
          <p className="max-w-xs text-sm font-medium leading-relaxed text-buzz-inkMuted">
            Connecting brands with campus communities for authentic college
            marketing, at scale.
          </p>
        </div>

        <div>
          <h4 className="mb-4 font-bold text-buzz-ink">How it works</h4>
          <ul className="space-y-2 text-sm font-medium text-buzz-inkMuted">
            <li>
              <Link to="/for-orgs" className={linkClass}>
                For orgs
              </Link>
            </li>
            <li>
              <Link to="/for-brands" className={linkClass}>
                For brands
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="mb-4 font-bold text-buzz-ink">Apply</h4>
          <ul className="space-y-2 text-sm font-medium text-buzz-inkMuted">
            <li>
              <Link to="/org/apply" className={linkClass}>
                Apply as Org
              </Link>
            </li>
            <li>
              <Link to="/brand/apply" className={linkClass}>
                Apply as Brand
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="mb-4 font-bold text-buzz-ink">Company</h4>
          <ul className="space-y-2 text-sm font-medium text-buzz-inkMuted">
            <li>
              <button
                type="button"
                onClick={openContactModal}
                className={linkClass}
              >
                Contact
              </button>
            </li>
            <li>
              <Link to="/privacy" className={linkClass}>
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link to="/terms" className={linkClass}>
                Terms of Service
              </Link>
            </li>
            <li>
              <Link to="/data-deletion" className={linkClass}>
                Data Deletion
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
