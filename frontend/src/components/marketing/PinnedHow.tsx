/**
 * Sticky “how it works” hero laptop demo on the public Home page.
 * Three student organization steps over ~4200px track with:
 * - Single persistent laptop chassis (never blinks, unmounts, or disappears)
 * - Screen-only GPU cross-dissolve (smooth 500ms blend between video loops)
 * - Concurrent text cross-fade (no blank gap or delayed pop)
 * - Fixed Y-anchored headlines (0px vertical jitter)
 * - Interactive clickable step buttons with smooth scroll
 * - Balanced vertical spacing and minimal progress rail
 */
import { useEffect, useRef, useState } from "react";
import { cn } from "../../theme/cn";
import { ORG_LAPTOP_STEPS } from "./mockups";
import { LaptopMockup } from "./LaptopMockup";
import { useReducedMotion } from "./useReducedMotion";
import { TEXT } from "../../theme/tokens";

const STEP_LABELS = ["1. Profile", "2. Drops", "3. Collaborate"];
const COOLDOWN_MS = 500;

export function PinnedHow() {
  const reduce = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const stepRef = useRef(0);
  const lastChangeRef = useRef(0);
  const trailingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

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

      // Calculate target step with generous deadbands and a half-size exit dwell cushion (~400px)
      const next = ratio < 0.32 ? 0 : ratio < 0.64 ? 1 : 2;

      // Progress bar fills over the 3 active steps (0 to 0.90)
      // and locks at 100% through the compact exit cushion (0.90 to 1.0)
      const visualProgress = Math.min(Math.max(ratio / 0.90, 0), 1);
      setProgress(visualProgress);

      // Minimum dwell protection: prevent skipping stages on fast trackpad flicks
      const now = performance.now();
      if (next !== stepRef.current) {
        if (trailingTimerRef.current) {
          clearTimeout(trailingTimerRef.current);
          trailingTimerRef.current = null;
        }

        const elapsed = now - lastChangeRef.current;
        if (elapsed < COOLDOWN_MS) {
          // Schedule trailing update so the final resting position always reconciles
          trailingTimerRef.current = setTimeout(() => {
            lastChangeRef.current = performance.now();
            setStep(next);
          }, COOLDOWN_MS - elapsed);
          return;
        }
        lastChangeRef.current = now;
        setStep(next);
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (trailingTimerRef.current) clearTimeout(trailingTimerRef.current);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [reduce]);

  const scrollToStep = (targetStep: number) => {
    const el = trackRef.current;
    if (!el) return;
    const total = el.offsetHeight - window.innerHeight;
    if (total <= 0) return;
    const targetRatios = [0.16, 0.48, 0.77];
    const targetRatio = targetRatios[targetStep] ?? targetStep / (ORG_LAPTOP_STEPS.length - 1);
    const rect = el.getBoundingClientRect();
    const currentScrollY = window.scrollY;
    const trackTopY = currentScrollY + rect.top;
    const targetY = trackTopY + total * targetRatio;

    lastChangeRef.current = performance.now();
    setStep(targetStep);
    window.scrollTo({ top: targetY, behavior: "smooth" });
  };

  if (reduce) {
    return (
      <section id="how-it-works" data-nav-surface="paper" className="bg-surface-paper text-on-accent py-16 px-4">
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

  const currentStepData = ORG_LAPTOP_STEPS[step];

  return (
    <div
      ref={trackRef}
      id="how-it-works"
      data-nav-surface="paper"
      className="relative h-[4700px] bg-surface-paper text-on-accent"
    >
      <div className="sticky top-0 flex h-screen min-h-[750px] flex-col items-center justify-center pt-10 pb-4 sm:pt-14 sm:pb-6 px-4 overflow-hidden">
        {/* Top Centered Section Header & Clickable Step Buttons */}
        <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center text-center mb-5 sm:mb-6">
          {/* Step Buttons */}
          <div
            className="inline-flex items-center gap-1.5 rounded-full border border-on-accent/15 bg-white/60 p-1 shadow-buzz backdrop-blur-md"
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
                  "cursor-pointer rounded-full px-3.5 py-1 text-xs font-medium transition-all duration-200 active:scale-95 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  idx === step
                    ? "bg-accent text-on-accent font-semibold"
                    : "text-on-accent/60 hover:text-on-accent/90 hover:bg-white/50",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Top-Anchored Step Titles with Concurrent Cross-Dissolve (No blank gap, no instant pop) */}
          <div className="relative mt-4 h-[88px] w-full">
            {ORG_LAPTOP_STEPS.map((item, index) => {
              const isActive = index === step;
              return (
                <div
                  key={item.title}
                  aria-hidden={!isActive}
                  className={cn(
                    "absolute inset-x-0 top-0 transition-opacity duration-500 ease-in-out",
                    isActive
                      ? "opacity-100 z-10"
                      : "opacity-0 pointer-events-none z-0",
                  )}
                >
                  <h3 className="text-2xl font-bold tracking-tight text-on-accent sm:text-3xl">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-sm sm:text-base text-on-accent/65 max-w-xl mx-auto min-h-[44px]">
                    {item.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Single Persistent Hero Laptop Mockup (Screen-Only Smooth Dissolve) */}
        <div
          className="relative z-10 w-full max-w-[620px]"
        >
          <LaptopMockup
            size="hero"
            poster={currentStepData.poster}
            alt={currentStepData.alt}
          >
            {/* Stacked Screen Layers for Seamless Cross-Dissolve without Chassis Unmounting */}
            {ORG_LAPTOP_STEPS.map((item, index) => {
              const isActive = index === step;
              return (
                <div
                  key={item.title}
                  className={cn(
                    "absolute inset-0 transition-opacity duration-500 ease-in-out",
                    isActive ? "opacity-100 z-10" : "opacity-0 pointer-events-none z-0",
                  )}
                >
                  <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    poster={item.poster}
                    aria-hidden="true"
                    className="h-full w-full object-cover"
                  >
                    <source src={item.videoWebm} type="video/webm" />
                    <source src={item.videoMp4} type="video/mp4" />
                  </video>
                </div>
              );
            })}
          </LaptopMockup>
        </div>

        {/* Minimal Scroll Progress Rail */}
        <div className="relative z-10 mt-4 flex flex-col items-center">
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
