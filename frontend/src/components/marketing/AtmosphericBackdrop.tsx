import { useEffect, useRef } from "react";
import { useReducedMotion } from "./useReducedMotion";

export default function AtmosphericBackdrop() {
  const reduce = useReducedMotion();
  const layer1Ref = useRef<HTMLDivElement>(null);
  const layer2Ref = useRef<HTMLDivElement>(null);
  const layer3Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduce) return;

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const scrollY = window.scrollY;
        const scrollHeight =
          document.documentElement.scrollHeight || document.body.scrollHeight;
        const maxScroll = Math.max(1, scrollHeight - window.innerHeight);
        const progress = Math.min(1, Math.max(0, scrollY / maxScroll));

        // Seamless atmospheric parallax drift (Option 3A)
        if (layer1Ref.current) {
          const dy = -progress * 260;
          const dx = -progress * 60;
          layer1Ref.current.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
        }
        if (layer2Ref.current) {
          const dy = -progress * 380;
          const dx = -progress * 70;
          layer2Ref.current.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
        }
        if (layer3Ref.current) {
          const dy = -progress * 420;
          const dx = progress * 80;
          layer3Ref.current.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
        }
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    const l1 = layer1Ref.current;
    const l2 = layer2Ref.current;
    const l3 = layer3Ref.current;
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      l1?.style.removeProperty("transform");
      l2?.style.removeProperty("transform");
      l3?.style.removeProperty("transform");
    };
  }, [reduce]);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#070708]"
      aria-hidden
    >
      {/* 
        Layer 1: Top Hero Ambient Wash
        Expansive vector ellipse with continuous asymptotic falloff.
        No bounding box, no circular clipping, no blur downsampling artifacts.
      */}
      <div
        ref={layer1Ref}
        className="pointer-events-none fixed -top-32 -bottom-96 -left-32 -right-32 motion-reduce:transform-none"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 1200px 900px at 72% 16%, rgba(241, 123, 191, 0.13) 0%, rgba(241, 123, 191, 0.085) 26%, rgba(241, 123, 191, 0.04) 50%, rgba(241, 123, 191, 0.012) 72%, rgba(241, 123, 191, 0.003) 86%, transparent 100%)",
          willChange: "transform",
        }}
      />

      {/* 
        Layer 2: Mid-page Studio Ambience (College Network / How It Works)
      */}
      <div
        ref={layer2Ref}
        className="pointer-events-none fixed -top-32 -bottom-96 -left-32 -right-32 motion-reduce:transform-none"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 1150px 1050px at 88% 54%, rgba(241, 123, 191, 0.11) 0%, rgba(241, 123, 191, 0.07) 28%, rgba(241, 123, 191, 0.03) 52%, rgba(241, 123, 191, 0.008) 74%, rgba(241, 123, 191, 0.002) 88%, transparent 100%)",
          willChange: "transform",
        }}
      />

      {/* 
        Layer 3: Lower Anchor Ambience (Current Drops / Join Split)
      */}
      <div
        ref={layer3Ref}
        className="pointer-events-none fixed -top-32 -bottom-96 -left-32 -right-32 motion-reduce:transform-none"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 1350px 1000px at 24% 86%, rgba(241, 123, 191, 0.12) 0%, rgba(241, 123, 191, 0.075) 28%, rgba(241, 123, 191, 0.032) 52%, rgba(241, 123, 191, 0.009) 74%, rgba(241, 123, 191, 0.002) 88%, transparent 100%)",
          willChange: "transform",
        }}
      />
    </div>
  );
}
