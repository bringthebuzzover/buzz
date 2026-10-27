/**
 * Partner with brands — three numbered photo cards.
 */
import sorority from "../../assets/sorority.png";
import ztaLacroix from "../../assets/sorority.png";
import { LinkButton } from "../../components/forms/controls";
import { GAP, SECTION_Y, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

const STEPS = [
  {
    n: 1,
    title: "Request to partner",
    body: "Request to partner with a brand that aligns with your community.",
    image: ztaLacroix,
    overlay: "5000 free boxes",
  },
  {
    n: 2,
    title: "Create an event",
    body: "Create and promote your event using our event planning tools.",
    image: sorority,
    overlay: "Sponsored by Buzz",
  },
  {
    n: 3,
    title: "Complete requirements",
    body: "Fulfill the brand’s partnership requirements to receive sponsorship.",
    image: ztaLacroix,
    overlay: null,
  },
] as const;

export function InspoPartner() {
  return (
    <section
      id="partner"
      className={cn(
        "mx-auto max-w-5xl scroll-mt-20 px-6 text-center",
        SECTION_Y,
      )}
    >
      <h2 className={TEXT.h1}>
        Partner with <span className="text-buzz-coral">brands</span>
      </h2>
      <p
        className={cn(
          TEXT.bodyLong,
          "mx-auto mt-4 max-w-xl text-buzz-inkMuted",
        )}
      >
        Give your community something extra to show up for while cutting hosting
        costs. Partner with food, beverage, apparel, or tech brands for merch
        and product samples.
      </p>
      <LinkButton to="/org/apply" className="mt-6">
        Get sponsored
      </LinkButton>
      <div className={cn("mt-14 grid md:grid-cols-3", GAP.section)}>
        {STEPS.map((step) => (
          <article key={step.n} className="text-left">
            <div className="relative overflow-hidden rounded-buzzModal">
              <img
                src={step.image}
                alt=""
                className="h-72 w-full object-cover"
              />
              <span className="absolute left-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-buzz-coral text-xs font-semibold text-buzz-paper">
                {step.n}
              </span>
              {step.overlay ? (
                <span className="absolute left-1/2 top-[42%] w-[72%] -translate-x-1/2 -translate-y-1/2 rounded-buzzCard bg-buzz-ink/70 px-4 py-8 text-center text-sm font-semibold text-buzz-paper">
                  {step.overlay}
                </span>
              ) : null}
            </div>
            <h3 className={cn(TEXT.h3, "mt-5")}>{step.title}</h3>
            <p
              className={cn(
                TEXT.body,
                "mt-2 leading-relaxed text-buzz-inkMuted",
              )}
            >
              {step.body}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default InspoPartner;
