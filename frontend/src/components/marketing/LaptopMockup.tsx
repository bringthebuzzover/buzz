import React from "react";
import { cn } from "../../theme/cn";
import { useReducedMotion } from "./useReducedMotion";

export interface LaptopMockupProps {
  videoMp4?: string;
  videoWebm?: string;
  poster: string;
  alt: string;
  className?: string;
  aspectRatio?: string;
  size?: "card" | "hero";
  children?: React.ReactNode;
}

export function LaptopMockup({
  videoMp4,
  videoWebm,
  poster,
  alt,
  className,
  aspectRatio = "aspect-[16/10]",
  size = "card",
  children,
}: LaptopMockupProps) {
  const reduceMotion = useReducedMotion();
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    if (videoRef.current && !reduceMotion) {
      videoRef.current.defaultMuted = true;
      videoRef.current.muted = true;
      try {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined && typeof playPromise.catch === "function") {
          playPromise.catch(() => {});
        }
      } catch {
        // Ignored: environments without media engine (e.g. jsdom)
      }
    }
  }, [reduceMotion]);

  const isHero = size === "hero";

  return (
    <div
      className={cn(
        "relative mx-auto flex w-full flex-col items-center select-none drop-shadow-2xl",
        isHero
          ? "max-w-[580px] md:max-w-[620px] lg:max-w-[660px]"
          : "max-w-[340px] md:max-w-[360px] xl:max-w-[330px]",
        className,
      )}
      aria-label={alt}
    >
      {/* Laptop Lid / Display Assembly */}
      <div
        className={cn(
          "relative w-full border border-[#2b2c30] bg-[#121316] shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]",
          isHero
            ? "rounded-t-[18px] p-[10px] pb-[14px] sm:p-[12px] sm:pb-[16px]"
            : "rounded-t-[14px] p-[7px] pb-[9px] sm:p-[9px] sm:pb-[11px]",
        )}
      >
        {/* Top Bezel: Centered Camera Dot */}
        <div
          className={cn(
            "absolute left-1/2 -translate-x-1/2 flex items-center justify-center",
            isHero ? "top-[4px] sm:top-[5px]" : "top-[3px] sm:top-[4px]",
          )}
        >
          <span
            className={cn(
              "rounded-full bg-[#08080a] ring-1 ring-white/10",
              isHero ? "h-2 w-2" : "h-1.5 w-1.5",
            )}
          />
        </div>

        {/* Screen Viewport */}
        <div
          className={cn(
            "relative w-full overflow-hidden bg-black ring-1 ring-white/10",
            isHero ? "rounded-[8px]" : "rounded-[6px]",
            aspectRatio,
          )}
        >
          {reduceMotion || !videoMp4 ? (
            <img
              src={poster}
              alt={alt}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              loop
              muted
              playsInline
              poster={poster}
              aria-hidden="true"
              className="h-full w-full object-cover"
            >
              {videoWebm && <source src={videoWebm} type="video/webm" />}
              <source src={videoMp4} type="video/mp4" />
            </video>
          )}

          {/* Subtle Glass Reflection Gradient */}
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.02] to-white/[0.06]"
            aria-hidden="true"
          />

          {children}
        </div>
      </div>

      {/* Laptop Base / Aluminum Chassis */}
      <div className="relative -mt-[1px] w-[105%] flex flex-col items-center">
        {/* Base Top Plate with Chamfer & Notch */}
        <div
          className={cn(
            "relative w-full border-t border-white/25 bg-gradient-to-b from-[#2e2f34] via-[#212226] to-[#161719] shadow-md",
            isHero ? "h-[10px] rounded-b-[10px] sm:h-[13px]" : "h-[8px] rounded-b-[7px] sm:h-[10px]",
          )}
        >
          {/* Display Opener Thumb Notch */}
          <div
            className={cn(
              "absolute -top-[1px] left-1/2 -translate-x-1/2 rounded-b-[4px] bg-[#121316] shadow-inner",
              isHero ? "h-[5px] w-16 sm:h-[6px] sm:w-20" : "h-[4px] w-12 sm:h-[5px] sm:w-14",
            )}
          />
        </div>

        {/* Base Bottom Edge Shadow / Contact Area */}
        <div className="h-[2px] w-[96%] rounded-b-full bg-[#0e0f11] shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />

        {/* Soft Ambient Contact Shadow Under Laptop */}
        <div
          className={cn(
            "absolute rounded-full bg-black/35 blur-[6px]",
            isHero ? "-bottom-3 h-4 w-[90%]" : "-bottom-2 h-3 w-[92%]",
          )}
        />
      </div>
    </div>
  );
}
