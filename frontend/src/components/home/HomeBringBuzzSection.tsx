/**
 * Public home only: two role-tour cards into /for-orgs and /for-brands
 * (LAUNCH.md Phase C), above the Join Us section.
 */
import { Link } from "react-router-dom";
import { Card } from "../ui/Card";
import HomeFlyingBee from "./HomeFlyingBee";
import { GAP, SECTION_Y, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

const CARDS = [
  {
    to: "/for-orgs",
    title: "For student organizations",
    teaser:
      "Apply with your campus .edu, confirm the organization Instagram, then connect after Buzz review.",
  },
  {
    to: "/for-brands",
    title: "For brands",
    teaser:
      "Request a campaign. Buzz writes and publishes it. You choose which student groups join after applications close.",
  },
] as const;

export default function HomeBringBuzzSection() {
  return (
    <section className={cn("bg-buzz-cream px-8", SECTION_Y)}>
      <div className="mx-auto max-w-5xl">
        <div className="relative mx-auto w-fit max-w-full">
          <h2 className={cn(TEXT.h2, "text-center text-buzz-coral md:text-4xl")}>
            How to Bring the Buzz Over
          </h2>
          <HomeFlyingBee />
        </div>
        <p className={cn(TEXT.bodyLong, "mx-auto mt-8 max-w-2xl text-center font-medium text-buzz-inkMuted")}>
          Our platform makes it easy for brands to connect with student
          ambassadors and campus organizations for authentic marketing
          campaigns.
        </p>

        <div className={cn("mt-12 grid md:grid-cols-2", GAP.group, "md:gap-8")}>
          {CARDS.map((card) => (
            <Link key={card.to} to={card.to} className="block h-full">
              <Card
                kind="card"
                pad="roomy"
                className="flex h-full flex-col text-left transition hover:border-buzz-coral"
              >
                <h3 className={cn(TEXT.h3, "mb-3 text-buzz-ink")}>{card.title}</h3>
                <p className={cn(TEXT.body, "mb-6 flex-1 font-medium leading-relaxed text-buzz-inkMuted")}>
                  {card.teaser}
                </p>
                <span className={cn(TEXT.body, "font-semibold text-buzz-coral")}>
                  See how it works
                </span>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
