/**
 * Lenis + GSAP scroll for /pulse.
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

export function setPulseScrollLocked(locked: boolean): void {
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

export function usePulseMotion(rootRef: RefObject<HTMLElement | null>): void {
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
          ".pulse-line[data-reveal='load'] > span",
          { yPercent: 50, opacity: 0 },
          { yPercent: 0, opacity: 1, duration: 1.4, ease: EASE, stagger: 0.1 },
        );
        gsap.fromTo(
          ".pulse-hero__actions",
          { y: 12, opacity: 0 },
          { y: 0, opacity: 1, duration: 1.2, ease: EASE, delay: 0.15 },
        );

        gsap.utils.toArray<HTMLElement>("[data-reveal-group]").forEach((group) => {
          const lines = group.querySelectorAll<HTMLElement>(".pulse-line > span");
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
          ".pulse-hero__shade",
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: "none",
            scrollTrigger: {
              trigger: ".pulse-hero",
              start: "top top",
              end: "bottom top",
              scrub: true,
            },
          },
        );

        gsap.utils.toArray<HTMLElement>(".pulse-reveal").forEach((frame) => {
          const media = frame.querySelector(".pulse-reveal__media");
          const reveal = () => ({
            trigger: frame,
            start: "top bottom",
            end: "top 50%",
            scrub: 0.8,
          });
          gsap.fromTo(
            frame,
            { clipPath: "inset(100% 0 0 0 round 8px)" },
            { clipPath: "inset(0% 0 0 0 round 8px)", ease: "none", scrollTrigger: reveal() },
          );
          if (media) {
            gsap.fromTo(media, { scale: 1.15 }, { scale: 1, ease: "none", scrollTrigger: reveal() });
          }
        });

        const steps = gsap.utils.toArray<HTMLElement>(".pulse-step");
        const screens = gsap.utils.toArray<HTMLElement>(".pulse-phone__screen");
        const how = document.querySelector(".pulse-how");
        if (how && steps.length) {
          const apply = (index: number) => {
            steps.forEach((el) => {
              el.style.opacity = Number(el.dataset.index) === index ? "1" : "0";
            });
            screens.forEach((el) => {
              el.style.opacity = Number(el.dataset.index) === index ? "1" : "0";
            });
          };
          apply(0);
          ScrollTrigger.create({
            trigger: how,
            start: "top top",
            end: "bottom bottom",
            scrub: true,
            onUpdate: (self) => {
              const index = Math.min(steps.length - 1, Math.floor(self.progress * steps.length));
              apply(index);
            },
          });
        }

        const cards = gsap.utils.toArray<HTMLElement>(".pulse-card");
        cards.forEach((card, index) => {
          const next = cards[index + 1];
          const media = card.querySelector(".pulse-card__media");
          if (!next || !media) return;
          gsap.to(media, {
            scale: 0.85,
            rotate: -3,
            ease: "none",
            scrollTrigger: {
              trigger: next,
              start: "top bottom",
              end: "top top",
              scrub: true,
            },
          });
        });

        gsap.utils.toArray<HTMLElement>("[data-theme]").forEach((section) => {
          const paper = section.dataset.theme === "paper";
          ScrollTrigger.create({
            trigger: section,
            start: "top 65%",
            end: "bottom 35%",
            onToggle: (self) => {
              if (!self.isActive) return;
              gsap.to(root, {
                backgroundColor: paper ? "#f0f0f0" : "#0b0b0b",
                duration: 1,
                ease: "power2.out",
                overwrite: "auto",
              });
            },
          });
        });

        const footer = document.querySelector(".pulse-footer");
        const footerInner = document.querySelector(".pulse-footer__inner");
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
