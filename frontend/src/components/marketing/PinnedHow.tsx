/**
 * Sticky “how it works” hero laptop demo on the public Home page.
 * Three student organization steps over ~3600px track, cross-fading
 * with 700ms cinematic ease as the visitor scrolls or clicks step tabs.
 * Reduced motion stacks every step.
 */
import { useEffect, useRef, useState } from "react";
import { cn } from "../../theme/cn";
import { ORG_LAPTOP_STEPS } from "./mockups";
import { LaptopMockup } from "./LaptopMockup";
import { useReducedMotion } from "./useReducedMotion";
import { TEXT } from "../../theme/tokens";

const STEP_LABELS = ["1. Profile", "2. Drops", "3. Collaborate"];

export function PinnedHow() {
  const reduce = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);

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
      const ratio = scrolled / total;
      // Generous deadbands so each stage has deliberate dwell time
      const next = ratio < 0.38 ? 0 : ratio < 0.72 ? 1 : 2;
      setStep(next);
      setProgress(Math.min(Math.max(ratio, 0), 1));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [reduce]);

  const scrollToStep = (targetStep: number) => {
    const el = trackRef.current;
    if (!el) return;
    const total = el.offsetHeight - window.innerHeight;
    if (total <= 0) return;
    // Map step 0 -> 10% (safe dwell), step 1 -> 50%, step 2 -> 90%
    const targetRatios = [0.1, 0.52, 0.92];
    const targetRatio = targetRatios[targetStep] ?? targetStep / (ORG_LAPTOP_STEPS.length - 1);
    const rect = el.getBoundingClientRect();
    const currentScrollY = window.scrollY;
    const trackTopY = currentScrollY + rect.top;
    const targetY = trackTopY + total * targetRatio;
    window.scrollTo({ top: targetY, behavior: "smooth" });
  };

  if (reduce) {
    return (
      <section id="how-it-works" data-nav-surface="paper" className="bg-[#f0f0f0] text-on-accent py-16 px-4">
        <div className="mx-auto flex max-w-4xl flex-col gap-16">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">How it works</p>
            <h2 className={cn(TEXT.h2, "mt-2")}>Student organizations join in 3 steps</h2>
          </div>
          {ORG_LAPTOP_STEPS.map((item, index) => (
            <div key={item.title} className="flex flex-col items-center gap-6 rounded-buzzBoard bg-white/60 p-8 text-center border border-on-accent/10">
              <div>
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent">
                  {index + 1}
                </span>
                <h3 className={cn(TEXT.h3, "mt-3")}>{item.title}</h3>
                <p className="mt-1 text-base text-on-accent/60 max-w-lg mx-auto">{item.body}</p>
              </div>
              <LaptopMockup
                size="hero"
                videoMp4={item.videoMp4}
                videoWebm={item.videoWebm}
                poster={item.poster}
                alt={item.alt}
              />
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
      className="relative h-[3600px] bg-[#f0f0f0] text-on-accent"
    >
      <div className="sticky top-0 flex h-screen min-h-[750px] flex-col items-center justify-center px-4 overflow-hidden">
        {/* Top Centered Section Header & Clickable Step Buttons */}
        <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center text-center mb-6 sm:mb-8">
          {/* Step Buttons */}
          <div
            className="inline-flex items-center gap-1.5 rounded-full border border-on-accent/15 bg-white/60 p-1 shadow-sm backdrop-blur-md"
            role="tablist"
            aria-label="How it works steps"
          >
            {STEP_LABELS.map((label, idx) => (
              <button
                key={label}
                type="button"
                role="tab"
                aria-selected={idx === step}
                onClick={() => scrollToStep(idx)}
                className={cn(
                  "cursor-pointer rounded-full px-3.5 py-1 text-xs font-medium transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  idx === step
                    ? "bg-accent text-on-accent font-semibold shadow-sm"
                    : "text-on-accent/60 hover:text-on-accent/90",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Top-Anchored Step Titles (Frozen Y-Position, Zero Vertical Jitter) */}
          <div className="relative mt-4 h-[92px] w-full">
            {ORG_LAPTOP_STEPS.map((item, index) => (
              <div
                key={item.title}
                aria-hidden={index !== step}
                className={cn(
                  "absolute inset-x-0 top-0 transition-all duration-700 ease-in-out",
                  index === step
                    ? "opacity-100 translate-y-0 visible"
                    : "pointer-events-none opacity-0 translate-y-2 invisible",
                )}
              >
                <h3 className="text-2xl font-bold tracking-tight text-on-accent sm:text-3xl">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-sm sm:text-base text-on-accent/65 max-w-xl mx-auto min-h-[44px]">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Centered Hero Laptop Mockup (Fixed Position Below Text) */}
        <div
          data-laptop-chassis
          className="relative z-10 w-full max-w-[620px]"
        >
          {ORG_LAPTOP_STEPS.map((item, index) => (
            <div
              key={item.title}
              className={cn(
                "transition-opacity duration-700 ease-in-out",
                index === step ? "block opacity-100" : "hidden opacity-0",
              )}
            >
              <LaptopMockup
                size="hero"
                videoMp4={item.videoMp4}
                videoWebm={item.videoWebm}
                poster={item.poster}
                alt={item.alt}
              />
            </div>
          ))}
        </div>

        {/* Minimal Scroll Progress Rail (Text Label Removed) */}
        <div className="relative z-10 mt-6 flex flex-col items-center">
          <div className="h-1 w-32 overflow-hidden rounded-full bg-on-accent/15">
            <div
              className="h-full bg-accent transition-all duration-150 ease-out"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
