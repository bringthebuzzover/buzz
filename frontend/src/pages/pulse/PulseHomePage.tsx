/**
 * `/pulse` — yellow/black marketing concept. Copy is the live site's;
 * stills from featured collaborations are graded so this page stays in palette.
 */
import { Link } from "react-router-dom";
import { FEATURED_COLLABS } from "../../data/featuredCollabs";
import { siteIdentity } from "../../data/siteIdentity";
import PulseHero from "../../components/pulse/PulseHero";
import PulseNetwork from "../../components/pulse/PulseNetwork";

const ORG_STEPS = [
  "Fill out the public apply form (profile, campus .edu, shipping address) and type the organization’s Instagram handle — the Business or Creator account, not a personal profile.",
  "Buzz reviews the claimed handle. Verify the .edu email Buzz sends you, then Connect Instagram after approval.",
  "Browse published campaigns on the Drop Feed and apply when a drop is Open.",
  "If you’re accepted, products ship to the address you gave. Post from that organization Instagram.",
] as const;

const BRAND_STEPS = [
  "Apply with company name and email. Buzz reviews, then you set a password from the setup email.",
  "Send a ticket — a message, not the campaign title. A representative will contact you. This request is not a live campaign.",
  "Buzz writes the drop and publishes it. Only then do campus organizations see the campaign.",
  "You monitor applicants. After the apply window closes, you approve or deny up to capacity.",
] as const;

function StepList({ steps }: { steps: readonly string[] }) {
  return (
    <ol className="pulse-steps">
      {steps.map((step, index) => (
        <li key={step}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <p>{step}</p>
        </li>
      ))}
    </ol>
  );
}

export default function PulseHomePage() {
  const { contact, social } = siteIdentity;

  return (
    <>
      <PulseHero />
      <PulseNetwork />

      <section className="pulse-statement">
        <div className="pulse-wrap">
          <p>
            Our platform makes it easy{" "}
            <span className="is-quiet">
              for brands to connect with student ambassadors and campus organizations{" "}
            </span>
            for authentic marketing campaigns.
          </p>
        </div>
      </section>

      <section className="pulse-roles" aria-label="Who it’s for">
        <article id="students" className="pulse-role pulse-role--dark">
          <div>
            <h2 className="pulse-display">For student organizations</h2>
            <p>
              Apply with your campus .edu, confirm the organization Instagram,
              then connect after Buzz review.
            </p>
          </div>
          <div className="pulse-role__links">
            <Link className="pulse-textlink" to="/for-orgs">
              See how it works
            </Link>
            <Link className="pulse-role__quiet" to="/login">
              Organization login
            </Link>
          </div>
        </article>

        <article id="brands" className="pulse-role pulse-role--yellow">
          <div>
            <h2 className="pulse-display">For brands</h2>
            <p>Request a campaign. Buzz drafts and publishes; you monitor and finalize.</p>
          </div>
          <div className="pulse-role__links">
            <Link className="pulse-textlink" to="/for-brands">
              See how it works
            </Link>
            <Link className="pulse-role__quiet" to="/brand/login">
              Brand login
            </Link>
          </div>
        </article>
      </section>

      <section id="how" className="pulse-how" aria-labelledby="pulse-how-title">
        <div className="pulse-wrap">
          <div className="pulse-how__intro">
            <h2 id="pulse-how-title" className="pulse-display">
              How it works
            </h2>
          </div>
          <div className="pulse-how__grid">
            <div>
              <h3>For student organizations</h3>
              <p className="pulse-how__lede">
                You apply on the website first. Instagram login comes after Buzz
                approves you — it binds the organization account, it does not
                create a new one.
              </p>
              <StepList steps={ORG_STEPS} />
              <Link className="pulse-how__more" to="/for-orgs">
                For organizations
              </Link>
            </div>
            <div>
              <h3>For brands</h3>
              <p className="pulse-how__lede">
                You request a call. Buzz mints and publishes the drop. Brands do
                not create a live campaign from the portal or edit creative in
                this motion.
              </p>
              <StepList steps={BRAND_STEPS} />
              <Link className="pulse-how__more" to="/for-brands">
                For brands
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="pulse-collabs" aria-labelledby="pulse-collab-title">
        <div className="pulse-wrap">
          <div className="pulse-collabs__intro">
            <h2 id="pulse-collab-title" className="pulse-display">
              Featured Campus Collaborations
            </h2>
          </div>
          <div className="pulse-collabs__grid">
            {FEATURED_COLLABS.map((collab) => (
              <article key={collab.id} className="pulse-collab">
                <div className="pulse-collab__media">
                  <img src={collab.image} alt={collab.title} />
                </div>
                <div className="pulse-collab__body">
                  <p className="pulse-kicker">Featured</p>
                  <h3>{collab.title}</h3>
                  <p>{collab.subtitle}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="join" className="pulse-join">
        <div className="pulse-wrap">
          <h2 className="pulse-display">Want to join?</h2>
          <p className="pulse-join__sub">
            Pick the path that fits — apply as a student organization, or apply
            as a brand.
          </p>
          <div className="pulse-join__actions">
            <Link className="pulse-btn pulse-btn--ink" to="/org/apply">
              Join as Student Organization
            </Link>
            <Link className="pulse-btn pulse-btn--line" to="/brand/apply">
              Apply as Brand
            </Link>
          </div>
        </div>
      </section>

      <section id="contact" className="pulse-contact" aria-labelledby="pulse-contact-title">
        <div className="pulse-wrap">
          <h2 id="pulse-contact-title" className="pulse-display">
            Contact
          </h2>
          <ul className="pulse-contact__list">
            <li>
              <span>Team</span>
              <a href={`mailto:${contact.email}`}>{contact.primaryPersonName}</a>
            </li>
            <li>
              <span>Email</span>
              <a href={`mailto:${contact.email}`}>{contact.email}</a>
            </li>
            <li>
              <span>Instagram</span>
              <a href={social.instagram.profileUrl} target="_blank" rel="noreferrer">
                {social.instagram.handleWithAt}
              </a>
            </li>
          </ul>
        </div>
      </section>
    </>
  );
}
