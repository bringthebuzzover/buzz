/**
 * Home: public lead-gen (hero + marquee + bring-buzz + waitlist + featured).
 */
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Marquee from "../../components/site/Marquee";
import HomeHero from "../../components/home/HomeHero";
import FeaturedCollaborations from "../../components/home/FeaturedCollaborations";
import HomeBringBuzzSection from "../../components/home/HomeBringBuzzSection";
import HomeWaitlistSection from "../../components/home/HomeWaitlistSection";
import { COLLEGES } from "../../data/colleges";
import {
  scrollToHomeWaitlist,
  type HomeLocationState,
} from "../../utils/scrollHomeWaitlist";

export default function HomePage() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const state = location.state as HomeLocationState | null;
    if (!state?.scrollToWaitlist) {
      return;
    }
    const t = window.setTimeout(() => {
      scrollToHomeWaitlist();
      navigate(".", { replace: true, state: {} });
    }, 0);
    return () => window.clearTimeout(t);
  }, [location.state, navigate]);

  return (
    <div className="w-full">
      <HomeHero />
      <Marquee
        items={COLLEGES}
        title="Our College Network"
        subtitle="Vetted student organizations powering authentic campus marketing nationwide."
        hideBottomBorder
      />
      <HomeBringBuzzSection />
      <HomeWaitlistSection />
      <FeaturedCollaborations />
    </div>
  );
}
