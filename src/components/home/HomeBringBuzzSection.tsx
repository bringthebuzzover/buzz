/**
 * Public home only: value props for brands vs student orgs, above the waitlist form.
 */
import type { LucideIcon } from "lucide-react";
import {
  BarChart2,
  Handshake,
  Layers,
  Megaphone,
  PenLine,
  TrendingUp,
} from "lucide-react";

type IconLine = { Icon: LucideIcon; text: string };

const BRAND_LINES: IconLine[] = [
  {
    Icon: Megaphone,
    text: "Nationwide campus network",
  },
  {
    Icon: Layers,
    text: "End-to-end campaign coordination",
  },
  {
    Icon: BarChart2,
    text: "Authentic student engagement at scale",
  },
];

const STUDENT_ORG_LINES: IconLine[] = [
  {
    Icon: Handshake,
    text: "Access exclusive brand partnerships",
  },
  {
    Icon: PenLine,
    text: "Power your events with product sponsorships",
  },
  {
    Icon: TrendingUp,
    text: "Apply in minutes and get products delivered directly to your organization",
  },
];

function IconLineList({ items }: { items: readonly IconLine[] }) {
  return (
    <ul className="space-y-5">
      {items.map(({ Icon, text }) => (
        <li key={text} className="flex gap-4 text-left">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-buzz-butter text-buzz-ink shadow-sm ring-1 ring-buzz-lineMid"
            aria-hidden
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
          </span>
          <span className="pt-1.5 text-sm font-medium leading-relaxed text-buzz-ink md:text-base">
            {text}
          </span>
        </li>
      ))}
    </ul>
  );
}

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

        <div className="mt-12 grid gap-12 md:grid-cols-2 md:gap-14 lg:gap-16">
          <div>
            <h3 className="mb-6 text-center text-xl font-bold text-buzz-ink md:text-left">
              For Brands
            </h3>
            <IconLineList items={BRAND_LINES} />
          </div>
          <div>
            <h3 className="mb-6 text-center text-xl font-bold text-buzz-ink md:text-left">
              For Student Organizations
            </h3>
            <IconLineList items={STUDENT_ORG_LINES} />
          </div>
        </div>
      </div>
    </section>
  );
}
