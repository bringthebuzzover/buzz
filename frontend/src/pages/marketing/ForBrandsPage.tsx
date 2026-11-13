/**
 * /for-brands — brands request a campaign. BUZZ builds and publishes the drop.
 */
import { MarketingPage } from "../../components/marketing/MarketingPage";
import { FEATURED_COLLABS } from "../../data/featuredCollabs";
import { CollegeNetwork } from "../../components/marketing/CollegeNetwork";
import { SideBySideHow } from "../../components/marketing/SideBySideHow";
import {
  FaqList,
  GoalChips,
  MarketingHero,
  Statement,
} from "../../components/marketing/sections";
import SiteFooter from "../../components/site/SiteFooter";

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
  const update = FEATURED_COLLABS[1];
  return (
    <MarketingPage>
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
        tone="dark"
      />
      <SideBySideHow kind="brand" />
      <CollegeNetwork />
      <GoalChips />
      <FaqList items={BRAND_FAQ} />
      <SiteFooter audience="brand" />
    </MarketingPage>
  );
}
