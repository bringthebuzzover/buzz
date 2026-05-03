/**
 * Home: public lead-gen (hero + marquee + waitlist) or full demo stack when `isDemoActive`.
 */
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Marquee from "../../components/site/Marquee";
import HomeHero from "../../components/home/HomeHero";
import FeaturedCollaborations from "../../components/home/FeaturedCollaborations";
import HomeCallouts from "../../components/home/HomeCallouts";
import HomeBringBuzzSection from "../../components/home/HomeBringBuzzSection";
import HomeWaitlistSection from "../../components/home/HomeWaitlistSection";
import { COLLEGES } from "../../data/colleges";
import { useAccessGate } from "../../contexts/AccessGateContext";
import {
  scrollToHomeWaitlist,
  type HomeLocationState,
} from "../../utils/scrollHomeWaitlist";

export default function HomePage() {
  const { isDemoActive } = useAccessGate();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const state = location.state as HomeLocationState | null;
    if (!state?.scrollToWaitlist || isDemoActive) {
      return;
    }
    const t = window.setTimeout(() => {
      scrollToHomeWaitlist();
      navigate(".", { replace: true, state: {} });
    }, 0);
    return () => window.clearTimeout(t);
  }, [location.state, navigate, isDemoActive]);

  if (isDemoActive) {
    return (
      <div className="w-full">
        <HomeHero />
        <Marquee
          items={COLLEGES}
          title="Our College Network"
          subtitle="Student organizations and campus reps help bring your brand to top universities nationwide"
        />
        <FeaturedCollaborations />
        <HomeCallouts />
      </div>
    );
  }

  return (
    <div className="w-full">
      <HomeHero />
      <Marquee
        items={COLLEGES}
        title="Our College Network"
        subtitle="Student organizations and campus reps help bring your brand to top universities nationwide"
        hideBottomBorder
      />
      <HomeBringBuzzSection />
      <HomeWaitlistSection />
      <FeaturedCollaborations />
    </div>
  );
}
