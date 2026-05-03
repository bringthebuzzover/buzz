/**
 * Site-wide footer: brand blurb plus three link columns (students, brands, company).
 * “Contact” opens the same global modal as the header; “Privacy Policy” is a non-functional placeholder.
 */
import { Link } from "react-router-dom";
import { siteIdentity } from "../../data/siteIdentity";
import { useSiteChrome } from "../../contexts/SiteChromeContext";
import { useAccessGate } from "../../contexts/AccessGateContext";

export default function SiteFooter() {
  const { openContactModal } = useSiteChrome();
  const { isDemoActive, demoView } = useAccessGate();
  const { brand } = siteIdentity;
  const showStudentLinks = isDemoActive && demoView === "org";
  const showBrandDemoLinks = isDemoActive && demoView === "brand";
  const showPublicBrandLinks = !isDemoActive;

  return (
    <footer className="mt-20 border-t border-buzz-line bg-buzz-paper px-8 py-16">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-3">
        <div>
          <div className="mb-4 flex items-center space-x-2 font-bold text-buzz-ink">
            <span className="rounded border border-buzz-lineMid bg-buzz-butter px-2 py-1 text-xs text-buzz-coral">
              {brand.shortBadge}
            </span>
            <span className="text-buzz-coral">{brand.displayName}</span>
          </div>
          <p className="max-w-xs text-sm font-medium leading-relaxed text-buzz-inkMuted">
            Connecting brands with college campuses through student
            organizations, trusted representatives, partnerships, and group
            pop-ups.
          </p>
        </div>

        {showStudentLinks ? (
          <div>
            <h4 className="mb-4 font-bold text-buzz-ink">For Students</h4>
            <ul className="space-y-2 text-sm font-medium text-buzz-inkMuted">
              <li>
                <Link to="/org/drops" className="hover:text-buzz-coral">
                  Drop Feed
                </Link>
              </li>
              <li>
                <Link to="/org/campaigns" className="hover:text-buzz-coral">
                  My Campaigns
                </Link>
              </li>
            </ul>
          </div>
        ) : null}

        {!showStudentLinks ? (
          <div>
            <h4 className="mb-4 font-bold text-buzz-ink">For Brands</h4>
            <ul className="space-y-2 text-sm font-medium text-buzz-inkMuted">
              {showBrandDemoLinks ? (
                <>
                  <li>
                    <Link to="/brand/dashboard" className="hover:text-buzz-coral">
                      Brand Dashboard
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/brand/dashboard"
                      state={{ openPlanCampaign: true }}
                      className="hover:text-buzz-coral"
                    >
                      Plan your Campaign
                    </Link>
                  </li>
                </>
              ) : null}
              {showPublicBrandLinks ? (
                <li>
                  <Link to="/waitlist" className="hover:text-buzz-coral">
                    Brand waitlist
                  </Link>
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}

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
