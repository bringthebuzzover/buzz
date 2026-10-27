/**
 * /pulse-bee/brands — /pulse-bee for brands.
 * Steps are /pulse-bee's own copy (request a call, Buzz mints and publishes
 * the drop, organizations post). FAQ answers come from /for-brands,
 * /brand/apply, and PRODUCT.md §5. No prices, results, or timelines.
 */
import { Link } from "react-router-dom";
import { FEATURED_COLLABS } from "../../data/featuredCollabs";
import PulseBeeCampusMap from "../../components/pulseBee/PulseBeeCampusMap";
import { LogoRow } from "./PulseBeeHomePage";
import {
  AudienceHero,
  Faq,
  JoinBlock,
  NumberedCards,
  Statement,
  type FaqItem,
  type NumberedCard,
} from "./PulseBeeAudience";

const [theta, ent] = FEATURED_COLLABS;

const STEPS: readonly NumberedCard[] = [
  {
    title: "Request a call",
    body: "Apply as a brand and request a campaign. A representative will contact you.",
  },
  {
    title: "Buzz mints and publishes the drop",
    body: "Buzz writes the drop. Once it’s published, vetted student organizations see it on the Drop Feed.",
    image: ent.image,
  },
  {
    title: "Organizations post",
    body: "Organizations apply while the drop is Open, then post from their Instagram Business or Creator account.",
    image: theta.image,
  },
];

/** Goals in the words the site already uses. /brand/apply has no prefill yet. */
const GOALS = [
  "Run a campus activation",
  "Get product to student organizations",
  "Grow Instagram engagement",
  "Reach more campuses",
] as const;

const FAQ: readonly FaqItem[] = [
  {
    q: "How do we get started?",
    a: "Apply as a brand with your brand name and company email. Buzz reviews it, then emails you a setup link to set your password.",
  },
  {
    q: "Do we build the campaign ourselves?",
    a: "No. You send a drop request, and a representative will contact you. Buzz writes the drop and publishes it. Brands don’t create a live campaign from the portal.",
  },
  {
    q: "Who handles logistics?",
    a: "A Buzz representative handles agreements, logistics, product shipment, and scheduling.",
  },
  {
    q: "Who posts about our brand?",
    a: "Vetted student organizations, from the organization’s Instagram Business or Creator account.",
  },
  {
    q: "Do we choose the organizations?",
    a: "Yes. After the apply window closes, you approve or deny applicants, up to the number of spots.",
  },
  {
    q: "What can we see after the drop is published?",
    a: "A read-only tracker (Awaiting Products, Drop Active, Drop Finished), your applicants, and each post’s likes, comments, and estimated reach.",
  },
];

export const BRAND_NAV = {
  links: [
    { href: "/pulse-bee/orgs", label: "Organizations" },
    { href: "/pulse-bee/brands", label: "Brands" },
    { href: "#how", label: "How it works" },
    { href: "/brand/login", label: "Login" },
  ],
  sections: ["how"],
  cta: { href: "/brand/apply", label: "Apply" },
} as const;

export default function PulseBeeBrandsPage() {
  return (
    <>
      <AudienceHero
        image={ent.image}
        lines={["Authentic college", "marketing,", "at scale."]}
        sub="BUZZ connects brands with student organizations to execute large-scale campus activations nationwide."
        actions={
          <>
            <Link className="pulse2-pill" to="/brand/apply">
              Apply as a brand
            </Link>
            <a className="pulse2-textlink" href="#how">
              How it works
              <span aria-hidden="true">→</span>
            </a>
          </>
        }
        aside={{ kicker: "Collaboration", text: ent.title }}
      />

      <Statement
        id="pulsebee-brands-statement"
        lead="You request a call."
        quiet="Buzz mints and publishes the drop."
      />

      <section
        className="pulse2-band pulse2-band--tight"
        id="how"
        data-theme="paper"
        aria-labelledby="pulsebee-brands-how"
      >
        <div className="pulsebee-aud-head">
          <h2 id="pulsebee-brands-how">How it works</h2>
          <p className="pulse2-support">Request a campaign. Buzz runs the drop. Organizations post.</p>
        </div>
        <NumberedCards cards={STEPS} />
      </section>

      <section
        className="pulsebee-aud-goals"
        id="goals"
        data-theme="ink"
        data-surface="dark"
        aria-labelledby="pulsebee-brands-goals"
      >
        <div data-reveal-group>
          <h2 id="pulsebee-brands-goals" className="pulse2-statement">
            <span className="pulse2-line">
              <span>What are you hoping</span>
            </span>
            <span className="pulse2-line">
              <span>to do on Buzz?</span>
            </span>
          </h2>
        </div>
        <p className="pulse2-support">Tell us in your application.</p>
        <ul className="pulsebee-aud-chips">
          {GOALS.map((goal) => (
            <li key={goal}>
              <Link className="pulse2-ghost" to="/brand/apply">
                {goal}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section
        className="pulse2-band pulse2-network"
        data-theme="paper"
        aria-labelledby="pulse2-network"
      >
        <div className="pulse2-network__head">
          <h2 id="pulse2-network">College network</h2>
          <p className="pulse2-support">
            Vetted student organizations powering authentic campus marketing nationwide.
          </p>
        </div>
        <PulseBeeCampusMap />
        <div className="pulse2-marquee">
          <div className="pulse2-marquee__track">
            <LogoRow />
            <LogoRow hidden />
          </div>
        </div>
      </section>

      <Faq id="faq" items={FAQ} />

      <JoinBlock
        halves={[
          {
            id: "brands",
            kicker: "For brands",
            title: "Request a campaign.",
            support: "You request a call. Buzz mints and publishes the drop.",
            pill: "Apply as a brand",
            to: "/brand/apply",
            quiet: { label: "Already have an account? Log in", to: "/brand/login" },
          },
          {
            id: "students",
            kicker: "For organizations",
            title: (
              <>
                Apply with your <span className="pulse2-join__nowrap">campus .edu.</span>
              </>
            ),
            support: "You apply on the website first.",
            pill: "See Buzz for organizations",
            to: "/pulse-bee/orgs",
          },
        ]}
      />
    </>
  );
}
