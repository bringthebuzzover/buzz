/**
 * Latest opportunities carousel + community stories.
 */
import { Link } from "react-router-dom";
import sorority from "../../assets/sorority.png";
import ztaLacroix from "../../assets/sorority.png";
import { LinkButton } from "../../components/forms/controls";
import { GAP, SECTION_Y, SURFACE, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

const DROPS: ReadonlyArray<{
  name: string;
  image?: string;
  fill?: "geo" | "wash";
}> = [
  { name: "Yerba Madre", image: sorority },
  { name: "Campus Kickoff", fill: "geo" },
  { name: "Trail Run", fill: "wash" },
  { name: "Spring Sip", fill: "wash" },
  { name: "La Croix", image: ztaLacroix },
  { name: "Hydrate", fill: "wash" },
];

const STORIES = ["$6,000 earned", "Full-time offer", "$2,200 earned"] as const;

export function InspoOpportunities() {
  return (
    <section
      id="opportunities"
      className={cn("mx-auto max-w-6xl scroll-mt-20 px-6", SECTION_Y)}
    >
      <div className={cn("mb-10 grid md:grid-cols-2", GAP.default)}>
        <div className="flex min-h-[140px] flex-col items-center justify-center rounded-buzzModal bg-gradient-to-br from-buzz-butter to-buzz-cream">
          <p className={cn(TEXT.meta, "mb-3")}>Drops</p>
          <LinkButton to="/inspo/drop" variant="outline" size="compact">
            Explore campaigns
          </LinkButton>
        </div>
        <div className="flex min-h-[140px] flex-col justify-center rounded-buzzModal bg-gradient-to-br from-buzz-cream to-buzz-butter p-6">
          <p className={cn(TEXT.metric, "text-buzz-coral")}>$1,250</p>
          <p className={TEXT.meta}>Typical org stipend</p>
        </div>
      </div>
      <h2 className={cn(TEXT.h1, "mb-10 text-center")}>
        Latest <span className="text-buzz-coral">opportunities</span>
      </h2>
      <div className={cn("flex overflow-x-auto pb-4", GAP.default)}>
        {DROPS.map((drop) => (
          <Link
            key={drop.name}
            to="/inspo/drop"
            className={cn(SURFACE.cardFlat, "w-40 shrink-0 overflow-hidden")}
          >
            <div className="flex h-36 items-center justify-center overflow-hidden bg-buzz-paper">
              {drop.image ? (
                <img
                  src={drop.image}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : drop.fill === "geo" ? (
                <span className="h-full w-full bg-gradient-to-br from-buzz-coral to-buzz-coralDark" />
              ) : (
                <span className="h-full w-full bg-buzz-butter" />
              )}
            </div>
            <p className={cn(TEXT.body, "py-3 text-center font-medium")}>
              {drop.name}
            </p>
          </Link>
        ))}
      </div>
      <div className="mt-8 text-center">
        <LinkButton to="/org/apply">Apply now</LinkButton>
      </div>
      <h2 className={cn(TEXT.h1, "mb-8 mt-16 text-center")}>
        Stories from the <span className="text-buzz-coral">community</span>
      </h2>
      <div className={cn("grid md:grid-cols-3", GAP.default)}>
        {STORIES.map((title) => (
          <div
            key={title}
            className="min-h-[120px] rounded-buzzModal bg-gradient-to-br from-buzz-butter to-buzz-cream p-6"
          >
            <p className={cn(TEXT.h3, "text-buzz-ink")}>{title}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default InspoOpportunities;
