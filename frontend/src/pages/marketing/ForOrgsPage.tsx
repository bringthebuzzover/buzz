/**
 * /for-orgs — how student organizations join. Apply-first; Instagram after approval.
 */
import { FEATURED_COLLABS } from "../../data/featuredCollabs";
import { SideBySideHow } from "../../components/marketing/SideBySideHow";
import {
  CurrentDrops,
  FaqList,
  JoinSplit,
  MarketingFooter,
  MarketingHero,
  NumberedCards,
  Statement,
} from "../../components/marketing/sections";

const ORG_FAQ = [
  {
    q: "Who can apply?",
    a: "Student organizations with a campus .edu email you can verify and the organization’s Instagram Business or Creator account.",
  },
  {
    q: "Can we use a personal Instagram account?",
    a: "No. Buzz needs the organization’s Business or Creator account, not a member’s personal profile.",
  },
  {
    q: "When do we connect Instagram?",
    a: "After Buzz approves you. Connect Instagram binds the organization account. It does not create a new one.",
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
  const update = FEATURED_COLLABS[1];
  return (
    <div className="w-full overflow-x-clip bg-page">
      <MarketingHero
        media={{ src: yerba.image, alt: yerba.title }}
        title={"Brand drops\nfor student\norganizations."}
        sub="You apply on the website first. Instagram comes after BUZZ approves you."
        primary={{ label: "Join Us!", to: "/org/apply" }}
        aside={{ kicker: "Collaboration", line: "Yerba Madre x Cornell University" }}
      />
      <Statement
        line1="Give your community something extra to show up for"
        line2="while cutting hosting costs."
      />
      <NumberedCards
        kicker="Partner with brands"
        support="Merch and product samples for your organization."
        cards={[
          {
            n: "1",
            title: "Brand products, shipped to you",
            body: "If you’re accepted on a drop, products ship to the address you gave when you applied.",
            image: yerba.image,
            alt: yerba.title,
          },
          {
            n: "2",
            title: "Post from your own account",
            body: "Post from the organization’s Instagram and see your posts, likes, comments, and reach in My Campaigns.",
            image: update.image,
            alt: update.title,
          },
          {
            n: "3",
            title: "More than one drop",
            body: "Your organization can hold spots on more than one drop at the same time.",
            mark: true,
          },
        ]}
      />
      <SideBySideHow kind="org" />
      <CurrentDrops />
      <FaqList items={ORG_FAQ} />
      <JoinSplit
        left={{
          kicker: "For organizations",
          title: "Apply with your\ncampus .edu.",
          support: "You apply on the website first.",
          action: { label: "Apply as an organization", to: "/org/apply" },
          quiet: { label: "Already connected? Log in", to: "/login" },
        }}
        right={{
          kicker: "For brands",
          title: "Request a campaign.",
          support: "You request a call. BUZZ builds and publishes the drop.",
          action: { label: "See BUZZ for brands", to: "/for-brands" },
        }}
      />
      <MarketingFooter />
    </div>
  );
}
