/**
 * “Featured Campus Collaborations” section: responsive grid of `FEATURED_COLLABS` tiles
 * (image, title, subtitle each).
 */
import { FEATURED_COLLABS } from "../../data/featuredCollabs";
import { Card } from "../ui/Card";
import { GAP, SECTION_Y, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

export default function FeaturedCollaborations() {
  return (
    <section className={cn("mx-auto max-w-6xl px-8", SECTION_Y)}>
      <h2 className={cn(TEXT.h2, "mb-12 text-center")}>
        Featured Campus <span className="text-buzz-coral">Collaborations</span>
      </h2>
      <div className={cn("relative grid grid-cols-1 md:grid-cols-2", GAP.section)}>
        {FEATURED_COLLABS.map((collab) => (
          <Card
            key={collab.id}
            kind="cardWarm"
            pad="none"
            className="overflow-hidden"
          >
            <div className="h-64 overflow-hidden border-b border-buzz-lineMid">
              <img
                src={collab.image}
                alt={collab.title}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="bg-buzz-butter p-6 text-center">
              <h3 className={cn(TEXT.h3, "mb-1 italic text-buzz-coral")}>
                {collab.title}
              </h3>
              <p className={cn(TEXT.body, "font-medium text-buzz-inkMuted")}>
                {collab.subtitle}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
