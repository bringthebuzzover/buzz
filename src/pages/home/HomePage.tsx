/**
 * Marketing home: stacks `HomeHero`, college `Marquee`, `FeaturedCollaborations`, and `HomeCallouts`
 * (hero through dual-audience CTAs) in visual order.
 */
import Marquee from "../../components/site/Marquee";
import HomeHero from "../../components/home/HomeHero";
import FeaturedCollaborations from "../../components/home/FeaturedCollaborations";
import HomeCallouts from "../../components/home/HomeCallouts";
import { COLLEGES } from "../../data/colleges";

export default function HomePage() {
  return (
    <div className="w-full">
      <HomeHero />
      <Marquee
        items={COLLEGES}
        title="Our College Network"
        subtitle="Our ambassadors are ready to bring your brand to top campuses nationwide"
      />
      <FeaturedCollaborations />
      <HomeCallouts />
    </div>
  );
}
