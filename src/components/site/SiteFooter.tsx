/**
 * Site-wide footer: brand blurb plus three link columns (students, brands, company).
 * “Contact” opens the same global modal as the header; “Privacy Policy” is a non-functional placeholder.
 */
import { Link } from "react-router-dom";
import { siteIdentity } from "../../data/siteIdentity";
import { useSiteChrome } from "../../contexts/SiteChromeContext";

export default function SiteFooter() {
  const { openContactModal } = useSiteChrome();

  return (
    <footer className="mt-16 border-t border-buzz-line bg-buzz-paper px-8 py-12">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-3">
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
          <h4 className="mb-4 font-bold text-buzz-ink">For Brands</h4>
          <ul className="space-y-2 text-sm font-medium text-buzz-inkMuted">
            <li>
              <Link to="/waitlist" className="hover:text-buzz-coral">
                Brand waitlist
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
                className="hover:text-buzz-coral"
              >
                Contact
              </button>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
