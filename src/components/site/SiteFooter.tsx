/**
 * Site-wide footer: brand blurb plus three link columns (students, brands, company).
 * “Contact” opens the same global modal as the header; “Privacy Policy” is a non-functional placeholder.
 */
import { Link } from "react-router-dom";
import { siteIdentity } from "../../data/siteIdentity";
import { useSiteChrome } from "../../contexts/SiteChromeContext";

export default function SiteFooter() {
  const { openContactModal } = useSiteChrome();
  const { brand } = siteIdentity;

  return (
    <footer className="mt-20 border-t border-buzz-line bg-buzz-paper px-8 py-16">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-4">
        <div>
          <div className="mb-4 flex items-center space-x-2 font-bold text-buzz-ink">
            <span className="rounded border border-buzz-lineMid bg-buzz-butter px-2 py-1 text-xs text-buzz-coral">
              {brand.shortBadge}
            </span>
            <span className="text-buzz-coral">{brand.displayName}</span>
          </div>
          <p className="max-w-xs text-sm font-medium leading-relaxed text-buzz-inkMuted">
            Connecting brands with college campuses through authentic student
            ambassadors and group pop-ups.
          </p>
        </div>

        <div>
          <h4 className="mb-4 font-bold text-buzz-ink">For Students</h4>
          <ul className="space-y-2 text-sm font-medium text-buzz-inkMuted">
            <li>
              <Link to="/register" className="hover:text-buzz-coral">
                Register Student Org
              </Link>
            </li>
            <li>
              <Link to="/campaigns" className="hover:text-buzz-coral">
                Browse Campaigns
              </Link>
            </li>
            <li>
              <Link to="/" className="hover:text-buzz-coral">
                Ambassador Resources
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="mb-4 font-bold text-buzz-ink">For Brands</h4>
          <ul className="space-y-2 text-sm font-medium text-buzz-inkMuted">
            <li>
              <Link to="/brand" className="hover:text-buzz-coral">
                Brand Portal
              </Link>
            </li>
            <li>
              <Link to="/brand/campaigns/new" className="hover:text-buzz-coral">
                Post a Campaign
              </Link>
            </li>
            <li>
              <Link to="/brand" className="hover:text-buzz-coral">
                Book a Strategy Call
              </Link>
            </li>
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
            <li>
              <span className="cursor-pointer hover:text-buzz-coral">
                Privacy Policy
              </span>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
