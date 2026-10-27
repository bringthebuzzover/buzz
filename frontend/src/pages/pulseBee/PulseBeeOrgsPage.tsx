/**
 * /pulse-bee/orgs — /pulse-bee for student organizations.
 * Copy comes from /pulse-bee, /for-orgs, /inspo's "Partner with brands",
 * and PRODUCT.md (§3.1, §6.1, §6.3, §7). No numbers, payouts, or timelines.
 */
import { Link } from "react-router-dom";
import { FEATURED_COLLABS } from "../../data/featuredCollabs";
import { siteIdentity } from "../../data/siteIdentity";
import { DropsCarousel, SCREENS, STEPS } from "./PulseBeeHomePage";
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

const GETS: readonly NumberedCard[] = [
  {
    title: "Brand products, shipped to you",
    body: "If you’re accepted on a drop, products ship to the address you gave when you applied.",
    image: theta.image,
  },
  {
    title: "Post from your own account",
    body: "Post from the organization’s Instagram and see your posts, likes, comments, and reach in My Campaigns.",
    image: ent.image,
  },
  {
    title: "More than one drop",
    body: "Your organization can hold spots on more than one drop at the same time.",
  },
];

const FAQ: readonly FaqItem[] = [
  {
    q: "Who can apply?",
    a: "Student organizations with a campus .edu email you can verify and the organization’s Instagram Business or Creator account.",
  },
  {
    q: "Can we use a personal Instagram account?",
    a: "No. Use the organization’s Business or Creator account, not a member’s personal profile. Personal accounts cannot be used on Buzz.",
  },
  {
    q: "When do we connect Instagram?",
    a: "After Buzz approves you. Accept Buzz’s Instagram Tester invite, then Connect Instagram on the organization account. It binds that account; it does not create a new one.",
  },
  {
    q: "We didn’t get the verification email.",
    a: "Check Junk on campus Outlook.",
  },
  {
    q: "How do we log in later?",
    a: "With Login with Instagram, on the organization account you connected.",
  },
  {
    q: "When can we apply to a drop?",
    a: "While it’s Open. An Upcoming drop shows a countdown, and Notify Me emails your .edu address before it opens.",
  },
  {
    q: "How do we hear back on a drop?",
    a: "After the apply window closes, the brand picks organizations up to the number of spots. Accepted drops move to My Campaigns. If you’re not picked, you get an email.",
  },
  {
    q: "Where do products ship?",
    a: "To the shipping address on your application. Shipping is US-only, including PO Boxes and campus CPO.",
  },
];

export const ORG_NAV = {
  links: [
    { href: "/pulse-bee/orgs", label: "Organizations" },
    { href: "/pulse-bee/brands", label: "Brands" },
    { href: "#how", label: "How it works" },
    { href: "/login", label: "Login" },
  ],
  sections: ["how"],
  cta: { href: "/org/apply", label: "Join" },
} as const;

export default function PulseBeeOrgsPage() {
  const leftSteps = STEPS.filter((step) => step.side === "left");
  const rightSteps = STEPS.filter((step) => step.side === "right");

  return (
    <>
      <AudienceHero
        image={theta.image}
        lines={["Brand drops", "for student", "organizations."]}
        sub="You apply on the website first. Instagram comes after Buzz approves you."
        actions={
          <>
            <Link className="pulse2-pill" to="/org/apply">
              Join
            </Link>
            <a className="pulse2-textlink" href="#how">
              How it works
              <span aria-hidden="true">→</span>
            </a>
          </>
        }
        aside={{ kicker: "Collaboration", text: siteIdentity.content.heroSpotlightLine }}
      />

      <Statement
        id="pulsebee-orgs-statement"
        lead="Give your community something extra to show up for"
        quiet="while cutting hosting costs."
      />

      <section
        className="pulse2-band pulse2-band--tight"
        id="gets"
        data-theme="paper"
        aria-labelledby="pulsebee-orgs-gets"
      >
        <div className="pulsebee-aud-head">
          <h2 id="pulsebee-orgs-gets">Partner with brands</h2>
          <p className="pulse2-support">Merch and product samples for your organization.</p>
        </div>
        <NumberedCards cards={GETS} />
      </section>

      <section className="pulse2-how" id="how" data-theme="paper" aria-labelledby="pulse2-how-title">
        <h2 id="pulse2-how-title" className="pulse2-sr">
          How it works
        </h2>
        <div className="pulse2-how__pin">
          <div className="pulse2-how__copy">
            {leftSteps.map((step) => (
              <p key={step.caption} className="pulse2-step" data-side="left" data-index={step.index}>
                {step.caption}
              </p>
            ))}
          </div>
          <div className="pulse2-phone" aria-hidden="true">
            {STEPS.map((step) => {
              const Screen = SCREENS[step.index];
              return (
                <div key={step.caption} className="pulse2-phone__screen" data-index={step.index}>
                  <Screen />
                </div>
              );
            })}
          </div>
          <div className="pulse2-how__copy pulse2-how__copy--right">
            {rightSteps.map((step) => (
              <p key={step.caption} className="pulse2-step" data-side="right" data-index={step.index}>
                {step.caption}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="pulse2-band" id="drops" data-theme="paper" aria-labelledby="pulse2-drops">
        <DropsCarousel />
      </section>

      <Faq id="faq" items={FAQ} />

      <JoinBlock
        halves={[
          {
            id: "students",
            kicker: "For organizations",
            title: (
              <>
                Apply with your <span className="pulse2-join__nowrap">campus .edu.</span>
              </>
            ),
            support: "You apply on the website first.",
            pill: "Apply as an organization",
            to: "/org/apply",
            quiet: { label: "Already connected? Log in", to: "/login" },
          },
          {
            id: "brands",
            kicker: "For brands",
            title: "Request a campaign.",
            support: "You request a call. Buzz mints and publishes the drop.",
            pill: "See Buzz for brands",
            to: "/pulse-bee/brands",
          },
        ]}
      />
    </>
  );
}
