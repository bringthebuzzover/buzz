/**
 * Home: Pulse Black public lead-in. Routes and the join-scroll handoff are unchanged.
 */
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CollegeNetwork } from "../../components/marketing/CollegeNetwork";
import { PinnedHow } from "../../components/marketing/PinnedHow";
import { ORG_STEPS } from "../../components/marketing/mockups";
import {
  CurrentDrops,
  JoinSplit,
  MarketingFooter,
  MarketingHero,
  StackCards,
  Statement,
} from "../../components/marketing/sections";
import { siteIdentity } from "../../data/siteIdentity";
import {
  scrollToHomeJoin,
  type HomeLocationState,
} from "../../utils/scrollHomeJoin";

export default function HomePage() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const state = location.state as HomeLocationState | null;
    if (!state?.scrollToJoin) return;
    const t = window.setTimeout(() => {
      scrollToHomeJoin();
      navigate(".", { replace: true, state: {} });
    }, 0);
    return () => window.clearTimeout(t);
  }, [location.state, navigate]);

  return (
    <div className="w-full overflow-x-clip bg-page">
      <MarketingHero
        media="video"
        title={"Campus marketing,\npowered by\nstudent communities."}
        sub="BUZZ connects brands with student organizations to execute large-scale campus activations nationwide."
        primary={{ label: "Join", onClick: scrollToHomeJoin }}
        aside={{ kicker: "Collaboration", line: siteIdentity.content.heroSpotlightLine }}
      />
      <Statement
        line1="Our platform makes it easy"
        line2="for brands to connect with student organizations."
      />
      <CollegeNetwork />
      <PinnedHow kind="org" steps={ORG_STEPS} />
      <StackCards />
      <CurrentDrops />
      <JoinSplit
        left={{
          kicker: "For organizations",
          title: "Apply with your\ncampus .edu.",
          support: "You apply on the website first.",
          action: { label: "Apply as an organization", to: "/org/apply" },
          quiet: { label: "See how organizations join", to: "/for-orgs" },
        }}
        right={{
          kicker: "For brands",
          title: "Request a campaign.",
          support: "You request a call. BUZZ builds and publishes the drop.",
          action: { label: "Apply as a brand", to: "/brand/apply" },
          quiet: { label: "See how brands run a campaign", to: "/for-brands" },
        }}
      />
      <MarketingFooter />
    </div>
  );
}
