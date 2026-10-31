import { useEffect, useRef, type ReactNode } from "react";
import { useReducedMotion } from "./useReducedMotion";

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** Native equivalents of Lab's reveals and scroll scrubs, scoped to these pages. */
export function MarketingPage({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const root = ref.current;
    if (!root || reduce) return;
    const animations: Animation[] = [];
    const reveal = (group: Element) => {
      group
        .querySelectorAll<HTMLElement>("[data-reveal-line]")
        .forEach((line, index) => {
          if (typeof line.animate !== "function") return;
          animations.push(
            line.animate(
              [
                { transform: "translateY(50%)", opacity: 0 },
                { transform: "translateY(0)", opacity: 1 },
              ],
              {
                duration: 1400,
                delay: index * 100,
                easing: "cubic-bezier(0.16, 1, 0.3, 1)",
                fill: "backwards",
              },
            ),
          );
        });
    };
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) =>
              entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                reveal(entry.target);
                observer?.unobserve(entry.target);
              }),
            { rootMargin: "0px 0px -15% 0px" },
          );
    root
      .querySelectorAll("[data-reveal-group]")
      .forEach((group) => observer?.observe(group));
    const hero = root.querySelector<HTMLElement>(".marketing-hero");
    if (hero) reveal(hero);
    const cards = Array.from(
      root.querySelectorAll<HTMLElement>(".marketing-stack"),
    );
    const shade = root.querySelector<HTMLElement>(".marketing-hero-shade");
    let frame = 0;
    const paint = () => {
      frame = 0;
      const height = window.innerHeight;
      if (hero && shade) {
        const rect = hero.getBoundingClientRect();
        shade.style.opacity = String(clamp(-rect.top / rect.height));
      }
      cards.forEach((card, index) => {
        const next = cards[index + 1];
        if (!next) return;
        const progress = clamp(1 - next.getBoundingClientRect().top / height);
        card.style.setProperty("--stack-scale", String(1 - progress * 0.15));
        card.style.setProperty("--stack-rotate", `${-progress * 3}deg`);
      });
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(paint);
    };
    paint();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      observer?.disconnect();
      animations.forEach((animation) => animation.cancel());
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      shade?.style.removeProperty("opacity");
      cards.forEach((card) => {
        card.style.removeProperty("--stack-scale");
        card.style.removeProperty("--stack-rotate");
      });
    };
  }, [reduce]);

  return (
    <div ref={ref} className="marketing-page w-full overflow-x-clip bg-page">
      {children}
    </div>
  );
}
