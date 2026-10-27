/**
 * Lenis + GSAP scroll for /pulse-bee. Copied from /pulse2 so that page stays frozen.
 *
 * GSAP 3.15 (core + ScrollTrigger) is free to use on a website, including
 * plugins, under the current Webflow standard license
 * (https://gsap.com/standard-license/). The grant covers implementation on
 * any website. The prohibited use is a no-code animation builder that
 * competes with Webflow. Buzz is not that.
 * Lenis is MIT.
 *
 * Motion is transform, opacity, and clip-path only. prefers-reduced-motion
 * skips this entirely.
 */
import { useEffect, type RefObject } from "react";

const EASE = "expo.out";

type ScrollLock = { stop: () => void; start: () => void };
let scrollLock: ScrollLock | null = null;

export function setPulseBeeScrollLocked(locked: boolean): void {
  if (!scrollLock) return;
  if (locked) scrollLock.stop();
  else scrollLock.start();
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function usePulseBeeMotion(rootRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) return undefined;

    let cancelled = false;
    let destroy = () => {};
    const failSafe = window.setTimeout(() => {
      if (!root.classList.contains("is-motion")) root.classList.add("is-settled");
    }, 1800);

    (async () => {
      const [{ default: gsap }, { ScrollTrigger }, { default: Lenis }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
        import("lenis"),
      ]);
      if (cancelled || !root.isConnected) return;

      gsap.registerPlugin(ScrollTrigger);
      root.classList.add("is-motion");

      const lenis = new Lenis({
        duration: 1.2,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        autoRaf: false,
        anchors: { offset: -96 },
      });
      scrollLock = lenis;
      lenis.on("scroll", ScrollTrigger.update);
      const onTick = (time: number) => {
        lenis.raf(time * 1000);
      };
      gsap.ticker.add(onTick);
      gsap.ticker.lagSmoothing(0);

      if (window.location.hash) {
        const target = document.querySelector(window.location.hash);
        if (target) lenis.scrollTo(target as HTMLElement, { offset: -96, immediate: true });
      }

      const ctx = gsap.context(() => {
        gsap.fromTo(
          ".pulse2-line[data-reveal='load'] > span",
          { yPercent: 50, opacity: 0 },
          { yPercent: 0, opacity: 1, duration: 1.4, ease: EASE, stagger: 0.1 },
        );
        gsap.fromTo(
          ".pulse2-hero__actions, .pulse2-hero__aside",
          { y: 12, opacity: 0 },
          { y: 0, opacity: 1, duration: 1.2, ease: EASE, delay: 0.15 },
        );

        gsap.utils.toArray<HTMLElement>("[data-reveal-group]").forEach((group) => {
          const lines = group.querySelectorAll<HTMLElement>(".pulse2-line > span");
          if (!lines.length) return;
          gsap.fromTo(
            lines,
            { yPercent: 50, opacity: 0 },
            {
              yPercent: 0,
              opacity: 1,
              duration: 1.4,
              ease: EASE,
              stagger: 0.1,
              scrollTrigger: { trigger: group, start: "top 85%", once: true },
            },
          );
        });

        gsap.fromTo(
          ".pulse2-hero__shade",
          { opacity: 0 },
          {
            opacity: 1,
            ease: "none",
            scrollTrigger: {
              trigger: ".pulse2-hero",
              start: "top top",
              end: "bottom top",
              scrub: true,
            },
          },
        );

        const marquee = document.querySelector<HTMLElement>(".pulse2-marquee__track");
        if (marquee) {
          const distance = marquee.scrollWidth / 2;
          if (distance > 0) marquee.style.animationDuration = `${distance / 32}s`;
        }

        const steps = gsap.utils.toArray<HTMLElement>(".pulse2-step");
        const screens = gsap.utils.toArray<HTMLElement>(".pulse2-phone__screen");
        const how = document.querySelector(".pulse2-how");
        if (how && steps.length > 1) {
          let active = -1;
          const paint = (progress: number) => {
            const index = Math.min(steps.length - 1, Math.round(progress * (steps.length - 1)));
            if (index === active) return;
            active = index;
            const setOpacity = (el: HTMLElement) => {
              el.style.opacity = Number(el.dataset.index) === index ? "1" : "0";
            };
            steps.forEach(setOpacity);
            screens.forEach(setOpacity);
          };
          paint(0);
          ScrollTrigger.create({
            trigger: how,
            start: "top top",
            end: "bottom bottom",
            scrub: true,
            onUpdate: (self) => paint(self.progress),
          });
        }

        const cards = gsap.utils.toArray<HTMLElement>(".pulse2-card");
        cards.forEach((card, index) => {
          const next = cards[index + 1];
          const layers = card.querySelectorAll(".pulse2-card__media, .pulse2-card__copy");
          if (!next || !layers.length) return;
          gsap.to(layers, {
            scale: 0.85,
            rotate: -3,
            transformOrigin: "center top",
            ease: "none",
            scrollTrigger: {
              trigger: next,
              start: "top bottom",
              end: "top top",
              scrub: true,
            },
          });
        });

        let surface = "";
        const paintSurface = (next: string) => {
          if (next === surface) return;
          surface = next;
          gsap.to(root, {
            backgroundColor: next === "paper" ? "#f0f0f0" : "#0b0b0b",
            duration: 1,
            ease: "power2.out",
            overwrite: "auto",
          });
        };
        gsap.utils.toArray<HTMLElement>("[data-theme]").forEach((section) => {
          ScrollTrigger.create({
            trigger: section,
            start: "top center",
            end: "bottom center",
            onToggle: (self) => {
              if (!self.isActive) return;
              paintSurface(section.dataset.theme === "paper" ? "paper" : "ink");
            },
          });
        });

        const footer = document.querySelector(".pulse2-footer");
        const footerInner = document.querySelector(".pulse2-footer__inner");
        if (footer) {
          const footerScrub = () => ({
            trigger: footer,
            start: "top bottom",
            end: "top 30%",
            scrub: true,
          });
          gsap.fromTo(
            footer,
            { clipPath: "inset(50% 0 0 0)" },
            { clipPath: "inset(0% 0 0 0)", ease: "none", scrollTrigger: footerScrub() },
          );
          if (footerInner) {
            gsap.fromTo(
              footerInner,
              { yPercent: -20 },
              { yPercent: 0, ease: "none", scrollTrigger: footerScrub() },
            );
          }
        }
      }, root);

      destroy = () => {
        ctx.revert();
        lenis.destroy();
        gsap.ticker.remove(onTick);
        gsap.ticker.lagSmoothing(500, 33);
        root.classList.remove("is-motion");
        scrollLock = null;
      };
    })().catch(() => {
      root.classList.add("is-settled");
    });

    return () => {
      cancelled = true;
      window.clearTimeout(failSafe);
      destroy();
    };
  }, [rootRef]);
}
