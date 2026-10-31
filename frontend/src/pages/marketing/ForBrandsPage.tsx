/**
 * /for-brands — brands request a campaign. BUZZ builds and publishes the drop.
 */
import { FEATURED_COLLABS } from "../../data/featuredCollabs";
import { CollegeNetwork } from "../../components/marketing/CollegeNetwork";
import { SideBySideHow } from "../../components/marketing/SideBySideHow";
import {
  FaqList,
  GoalChips,
  JoinSplit,
  MarketingFooter,
  MarketingHero,
  NumberedCards,
  Statement,
} from "../../components/marketing/sections";

const BRAND_FAQ = [
  {
    q: "How do we get started?",
    a: "Apply as a brand with your brand name and company email. BUZZ reviews it, then emails you a setup link to set your password.",
  },
  {
    q: "Do we build the campaign ourselves?",
    a: "No. You do not create a live campaign from the portal. You send a request. A representative will contact you. BUZZ writes the drop and hits Publish.",
  },
  {
    q: "Who handles logistics?",
    a: "The sales call and logistics happen with BUZZ. You don’t build or edit the campaign yourself.",
  },
  {
    q: "Who posts about our brand?",
    a: "Organizations post from their Instagram Business or Creator account after they’re accepted.",
  },
  {
    q: "Do we choose the organizations?",
    a: "Yes. After the apply window you accept or deny each applicant up to capacity, then send your decisions. You can add more later.",
  },
  {
    q: "What can we see after the drop is published?",
    a: "Applicants, read-only totals, and the drop's stage: Upcoming, Applying, Selecting, Live, then Wrapped.",
  },
];

export default function ForBrandsPage() {
  const yerba = FEATURED_COLLABS[0];
  const update = FEATURED_COLLABS[1];
  return (
    <div className="w-full overflow-x-clip bg-page">
      <MarketingHero
        media={{ src: update.image, alt: update.title }}
        title={"Authentic college\nmarketing,\nat scale."}
        sub="BUZZ connects brands with student organizations to execute large-scale campus activations nationwide."
        primary={{ label: "Apply as a brand", to: "/brand/apply" }}
        aside={{ kicker: "Collaboration", line: "Epsilon Nu Tau x UPDATE" }}
      />
      <Statement
        line1="You request a call."
        line2="BUZZ builds and publishes the drop."
      />
      <NumberedCards
        kicker="How it works"
        support="Request a campaign. BUZZ runs the drop. Organizations post."
        cards={[
          {
            n: "1",
            title: "Request a call",
            body: "Apply as a brand and request a campaign. A representative will contact you.",
            mark: true,
          },
          {
            n: "2",
            title: "BUZZ builds and publishes the drop",
            body: "BUZZ writes the drop. Once it’s published, vetted student organizations see it on the Drop Feed.",
            image: update.image,
            alt: update.title,
          },
          {
            n: "3",
            title: "Organizations post",
            body: "Organizations apply while the drop is Open, then post from their Instagram Business or Creator account.",
            image: yerba.image,
            alt: yerba.title,
          },
        ]}
      />
      <SideBySideHow kind="brand" />
      <GoalChips />
      <CollegeNetwork />
      <FaqList items={BRAND_FAQ} />
      <JoinSplit
        left={{
          kicker: "For brands",
          title: "Request a campaign.",
          support: "You request a call. BUZZ builds and publishes the drop.",
          action: { label: "Apply as a brand", to: "/brand/apply" },
          quiet: { label: "Already have an account? Log in", to: "/brand/login" },
        }}
        right={{
          kicker: "For organizations",
          title: "Apply with your\ncampus .edu.",
          support: "You apply on the website first.",
          action: { label: "See BUZZ for organizations", to: "/for-orgs" },
        }}
      />
      <MarketingFooter />
    </div>
  );
}
