/**
 * Public home only: two role-tour cards into /for-orgs and /for-brands
 * (LAUNCH.md Phase C), above the Join Us section.
 */
import { Link } from "react-router-dom";

const CARDS = [
  {
    to: "/for-orgs",
    title: "For student organizations",
    teaser:
      "Apply with your campus .edu, confirm the org Instagram, then connect after Buzz review.",
  },
  {
    to: "/for-brands",
    title: "For brands",
    teaser:
      "Request a campaign. Buzz drafts and publishes; you monitor and finalize.",
  },
] as const;

export default function HomeBringBuzzSection() {
  return (
    <section className="bg-buzz-cream px-8 py-16 md:py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-3xl font-bold tracking-tight text-buzz-coral md:text-4xl">
          How to Bring the Buzz Over
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-base font-medium leading-relaxed text-buzz-inkMuted">
          Our platform makes it easy for brands to connect with student
          ambassadors and campus organizations for authentic marketing
          campaigns.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-2 md:gap-8">
          {CARDS.map((card) => (
            <Link
              key={card.to}
              to={card.to}
              className="flex flex-col rounded-2xl border border-buzz-lineMid bg-buzz-paper p-8 text-left shadow-sm transition hover:border-buzz-coral hover:shadow-md"
            >
              <h3 className="mb-3 text-xl font-bold text-buzz-ink">{card.title}</h3>
              <p className="mb-6 flex-1 text-sm font-medium leading-relaxed text-buzz-inkMuted">
                {card.teaser}
              </p>
              <span className="text-sm font-bold text-buzz-coral">
                See how it works
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
