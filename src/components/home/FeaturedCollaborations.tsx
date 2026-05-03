/**
 * “Featured Campus Collaborations” section: responsive grid of `FEATURED_COLLABS` tiles
 * (image, title, subtitle each).
 */
import { FEATURED_COLLABS } from "../../data/featuredCollabs";

export default function FeaturedCollaborations() {
  return (
    <section className="mx-auto max-w-6xl px-8 py-7">
      <h2 className="mb-12 text-center text-3xl font-bold">
        Featured Campus <span className="text-buzz-coral">Collaborations</span>
      </h2>
      <div className="relative grid grid-cols-1 gap-8 md:grid-cols-2">
        {FEATURED_COLLABS.map(collab => (
          <div
            key={collab.id}
            className="overflow-hidden rounded-xl border border-buzz-lineMid bg-buzz-butter shadow-sm transition hover:shadow-md"
          >
            <div className="h-64 overflow-hidden border-b border-buzz-lineMid">
              <img
                src={collab.image}
                alt={collab.title}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="bg-buzz-butter p-6 text-center">
              <h3 className="mb-1 text-xl font-bold italic text-buzz-coral">
                {collab.title}
              </h3>
              <p className="text-sm font-medium text-buzz-inkMuted">{collab.subtitle}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
