/**
 * Student FAQs — accordion rows on cream, answers in inkMuted.
 */
import { useState } from "react";
import { GAP, SECTION_Y, STACK, SURFACE, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

const STORIES = [
  { name: "Ashley S.", line: "UNC Chapel Hill · Class of 2026" },
  { name: "Olivia R.", line: "University of Alabama · Class of 2027" },
  { name: "Hannah M.", line: "San Diego State · Class of 2028" },
] as const;

const FAQS = [
  {
    q: "When will I receive my payment?",
    a: "Accepted orgs are paid after the drop window closes and posts are linked. Timing is on the campaign brief.",
  },
  {
    q: "Can I use Buzz outside of the United States?",
    a: "Shipping and campus drops are US-only, including campus CPO and PO Boxes.",
  },
  {
    q: "Do I need to be currently in college to apply to a campaign?",
    a: "Yes. Buzz is for recognized student organizations at US campuses, with a verifiable .edu email.",
  },
  {
    q: "How long does it take to hear back from a campaign?",
    a: "Brands batch-finalize after the apply window closes. You will see a decision on My Campaigns.",
  },
  {
    q: "Will I get tax forms for working campaigns?",
    a: "If a stipend is paid, Buzz or the brand shares the tax paperwork that applies to that drop.",
  },
] as const;

export function InspoFaqs() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faqs" className={cn("mx-auto max-w-6xl scroll-mt-20 px-6", SECTION_Y)}>
      <div className={cn("mb-12 grid md:grid-cols-3", GAP.default)}>
        {STORIES.map((story) => (
          <article
            key={story.name}
            className="flex items-center gap-4 rounded-buzzModal bg-gradient-to-br from-buzz-butter to-buzz-cream px-5 py-6"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-buzz-paper text-sm font-semibold text-buzz-coral">
              {story.name.slice(0, 1)}
            </span>
            <div>
              <p className={cn(TEXT.body, "font-semibold")}>{story.name}</p>
              <p className={TEXT.meta}>{story.line}</p>
            </div>
          </article>
        ))}
      </div>
      <div className="mx-auto max-w-3xl">
        <h2 className={cn(TEXT.h1, "mb-8 text-center")}>
          Student <span className="text-buzz-coral">FAQs</span>
        </h2>
        <ul className={STACK.default}>
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            return (
              <li key={item.q}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className={cn(
                    SURFACE.inset,
                    "flex w-full items-center justify-between px-5 py-4 text-left",
                    TEXT.body,
                    "font-medium",
                  )}
                >
                  {item.q}
                  <span className="text-lg leading-none text-buzz-coral">
                    {isOpen ? "–" : "+"}
                  </span>
                </button>
                {isOpen ? (
                  <p className={cn(TEXT.body, "px-5 py-3 text-buzz-inkMuted")}>
                    {item.a}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export default InspoFaqs;
