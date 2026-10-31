/**
 * Sticky “how it works” phone. Four steps over ~4 viewports, cross-fading
 * 0.35s. Reduced motion stacks every step with no pin and no fade.
 */
import { useEffect, useRef, useState } from "react";
import { cn } from "../../theme/cn";
import { MarketingPhone } from "./Phones";
import { ORG_STEPS as steps } from "./mockups";
import { useReducedMotion } from "./useReducedMotion";

export function PinnedHow() {
  const reduce = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const onScroll = () => {
      const el = trackRef.current;
      if (!el) return;
      const total = el.offsetHeight - window.innerHeight;
      if (total <= 0) return;
      const scrolled = Math.min(
        Math.max(-el.getBoundingClientRect().top, 0),
        total,
      );
      const next = Math.min(
        steps.length - 1,
        Math.floor((scrolled / total) * steps.length),
      );
      setStep(next);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [reduce]);

  if (reduce) {
    return (
      <section id="how-it-works" data-nav-surface="paper" className="bg-[#f0f0f0] text-on-accent">
        <div className="mx-auto flex max-w-3xl flex-col gap-16 px-4 py-16">
          {steps.map((item, index) => (
            <div key={item.caption} className="flex flex-col items-center gap-6">
              <p className="order-last max-w-md text-xl font-medium leading-snug md:order-none">{item.caption}</p>
              <MarketingPhone kind="org" step={index} animate={false} />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <div
      ref={trackRef}
      id="how-it-works"
      data-nav-surface="paper"
      className="relative h-[3376px] bg-[#f0f0f0] md:h-[3600px]"
    >
      <div className="sticky top-0 flex h-[844px] items-center md:h-[900px]">
        <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 items-center gap-8 px-4 md:grid-cols-[1fr_317px_1fr] md:px-12">
          {steps.map((item, index) => (
            <p
              key={item.caption}
              aria-hidden={index !== step}
              className={cn(
                "text-xl font-medium leading-snug text-on-accent transition-opacity duration-300 md:max-w-sm md:text-left",
                "row-start-2 text-center md:col-start-1 md:row-start-1",
                item.side === "right" && "md:col-start-3",
                index === step
                  ? "opacity-100"
                  : "pointer-events-none opacity-0",
              )}
            >
              {item.caption}
            </p>
          ))}
          <div className="flex justify-center md:col-start-2 md:row-start-1">
            <MarketingPhone kind="org" step={step} animate />
          </div>
        </div>
      </div>
    </div>
  );
}
