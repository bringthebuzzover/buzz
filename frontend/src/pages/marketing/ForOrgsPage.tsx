/**
 * /for-orgs — how student organizations join. Instagram-first signup.
 */
import { MarketingPage } from "../../components/marketing/MarketingPage";
import { FEATURED_COLLABS } from "../../data/featuredCollabs";
import { SideBySideHow } from "../../components/marketing/SideBySideHow";
import {
  CurrentDrops,
  FaqList,
  MarketingHero,
  Statement,
} from "../../components/marketing/sections";
import SiteFooter from "../../components/site/SiteFooter";

const ORG_FAQ = [
  {
    q: "Who can apply?",
    a: "Student organizations with a campus .edu email you can verify and the organization’s Instagram Business or Creator account.",
  },
  {
    q: "Can we use a personal Instagram account?",
    a: "No. Use your organization’s account. Switch it to a free Business or Creator account in Instagram Settings, then retry your application.",
  },
  {
    q: "When do we connect Instagram?",
    a: "Connect your organization’s Business or Creator account first, then complete your campus profile and verify your .edu email. BUZZ reviews your application before opening portal access.",
  },
  {
    q: "We didn’t get the verification email.",
    a: "Check Junk on campus Outlook. The link verifies the .edu address you applied with.",
  },
  {
    q: "How do we log in later?",
    a: "Use organization login after you have connected Instagram.",
  },
  {
    q: "When can we apply to a drop?",
    a: "Browse published campaigns on the Drop Feed and apply when a drop is Open.",
  },
  {
    q: "How do we hear back on a drop?",
    a: "If you’re accepted, products ship to the address you gave and you post from that organization Instagram.",
  },
  {
    q: "Where do products ship?",
    a: "To the shipping address you gave when you applied.",
  },
];

export default function ForOrgsPage() {
  const yerba = FEATURED_COLLABS[0];
  return (
    <MarketingPage>
      <MarketingHero
        media={{ src: yerba.image, alt: yerba.title }}
        title={"Brand drops\nfor student\norganizations."}
        sub="Connect Instagram, complete your campus profile, and verify your .edu email. BUZZ reviews your application."
        primary={{ label: "Join Us!", to: "/org/apply" }}
        aside={{ kicker: "Collaboration", line: "Yerba Madre x Cornell University" }}
      />
      <Statement
        line1="Give your community something extra to show up for"
        line2="while cutting hosting costs."
      />
      <SideBySideHow kind="org" />
      <CurrentDrops />
      <div id="instagram-guide">
        <FaqList items={ORG_FAQ} />
      </div>
      <SiteFooter audience="org" />
    </MarketingPage>
  );
}
