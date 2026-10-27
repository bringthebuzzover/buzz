/**
 * Pulse footer. Same destinations as the live site footer, without its modal.
 */
import { Link } from "react-router-dom";
import { siteIdentity } from "../../data/siteIdentity";

export default function PulseFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="pulse-footer">
      <div className="pulse-wrap pulse-footer__grid">
        <div className="pulse-footer__brand">
          <img
            src={siteIdentity.images.logo}
            alt={siteIdentity.images.logoAlt}
            className="pulse-footer__logo"
          />
          <p className="pulse-footer__blurb">
            Connecting brands with campus communities for authentic college
            marketing, at scale.
          </p>
          <p className="pulse-footer__concept">
            Pulse is a design exploration.{" "}
            <Link to="/">Current site</Link>
          </p>
        </div>

        <div>
          <h2>How it works</h2>
          <ul>
            <li>
              <Link to="/for-orgs">For organizations</Link>
            </li>
            <li>
              <Link to="/for-brands">For brands</Link>
            </li>
          </ul>
        </div>

        <div>
          <h2>Apply</h2>
          <ul>
            <li>
              <Link to="/org/apply">Apply as Organization</Link>
            </li>
            <li>
              <Link to="/brand/apply">Apply as Brand</Link>
            </li>
            <li>
              <Link to="/login">Organization login</Link>
            </li>
            <li>
              <Link to="/brand/login">Brand login</Link>
            </li>
          </ul>
        </div>

        <div>
          <h2>Company</h2>
          <ul>
            <li>
              <a href="#contact">Contact</a>
            </li>
            <li>
              <Link to="/privacy">Privacy Policy</Link>
            </li>
            <li>
              <Link to="/terms">Terms of Service</Link>
            </li>
            <li>
              <Link to="/data-deletion">Data Deletion</Link>
            </li>
            <li>
              <a href={siteIdentity.social.instagram.profileUrl} target="_blank" rel="noreferrer">
                Instagram
              </a>
            </li>
            <li>
              <a href={siteIdentity.social.linkedin.companyUrl} target="_blank" rel="noreferrer">
                LinkedIn
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="pulse-wrap">
        <p className="pulse-footer__end">© {year} {siteIdentity.brand.displayName}</p>
      </div>
    </footer>
  );
}
