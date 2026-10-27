/**
 * Ink footer. Sign-off, email that breaks only at @,
 * and the live site's real destinations.
 */
import { Link } from "react-router-dom";
import { siteIdentity } from "../../data/siteIdentity";
import { publicLogo } from "../../utils/publicLogo";

function ContactEmail({ email }: { email: string }) {
  const at = email.indexOf("@");
  if (at < 1) {
    return (
      <a className="pulse2-email" href={`mailto:${email}`}>
        {email}
      </a>
    );
  }
  return (
    <a className="pulse2-email" href={`mailto:${email}`}>
      {email.slice(0, at)}@<wbr />
      {email.slice(at + 1)}
    </a>
  );
}

export default function PulseBeeFooter() {
  const { contact, social } = siteIdentity;
  const year = new Date().getFullYear();

  return (
    <footer className="pulse2-footer" id="contact" data-theme="ink" data-surface="dark">
      <div className="pulse2-footer__inner">
        <div className="pulse2-footer__sign" data-reveal-group>
          <h2 className="pulse2-display">
            <span className="pulse2-line">
              <span>Want to join?</span>
            </span>
          </h2>
          <div className="pulse2-footer__actions">
            <Link className="pulse2-ghost" to="/org/apply">
              Join as a student organization
            </Link>
            <Link className="pulse2-footer__text" to="/brand/apply">
              Apply as a brand
            </Link>
          </div>
          <ContactEmail email={contact.email} />
        </div>

        <div className="pulse2-footer__cols">
          <div>
            <h3>Organizations</h3>
            <ul>
              <li>
                <Link to="/for-orgs">How it works</Link>
              </li>
              <li>
                <Link to="/org/apply">Apply</Link>
              </li>
              <li>
                <Link to="/login">Login</Link>
              </li>
            </ul>
          </div>
          <div>
            <h3>Brands</h3>
            <ul>
              <li>
                <Link to="/for-brands">How it works</Link>
              </li>
              <li>
                <Link to="/brand/apply">Apply</Link>
              </li>
              <li>
                <Link to="/brand/login">Login</Link>
              </li>
            </ul>
          </div>
          <div>
            <h3>Social</h3>
            <ul>
              <li>
                <a href={social.instagram.profileUrl} rel="noreferrer" target="_blank">
                  Instagram
                </a>
              </li>
              <li>
                <a href={social.linkedin.companyUrl} rel="noreferrer" target="_blank">
                  LinkedIn
                </a>
              </li>
              <li>
                <a href={`mailto:${contact.email}`}>Email</a>
              </li>
            </ul>
          </div>
          <div>
            <h3>Legal</h3>
            <ul>
              <li>
                <Link to="/privacy">Privacy</Link>
              </li>
              <li>
                <Link to="/terms">Terms</Link>
              </li>
              <li>
                <Link to="/data-deletion">Data deletion</Link>
              </li>
              <li>
                <Link to="/">Current site</Link>
              </li>
            </ul>
          </div>
        </div>

        <p className="pulse2-footer__meta">
          <img className="pulse2-footer__bee" src={publicLogo("bee.svg")} alt="" />
          <span>
            Connecting brands with campus communities for authentic college marketing, at scale.
          </span>
          <span>{year}</span>
        </p>
      </div>
    </footer>
  );
}
