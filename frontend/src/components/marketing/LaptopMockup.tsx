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
  children?: React.ReactNode;
}

export function LaptopMockup({
  videoMp4,
  videoWebm,
  poster,
  alt,
  className,
  aspectRatio = "aspect-[16/10]",
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

  return (
    <div
      className={cn(
        "relative mx-auto flex w-full max-w-[340px] flex-col items-center select-none drop-shadow-xl md:max-w-[360px] xl:max-w-[330px]",
        className,
      )}
      aria-label={alt}
    >
      {/* Laptop Lid / Display Assembly */}
      <div className="relative w-full rounded-t-[14px] border border-[#2b2c30] bg-[#121316] p-[7px] pb-[9px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] sm:p-[9px] sm:pb-[11px]">
        {/* Top Bezel: Centered Camera Dot */}
        <div className="absolute top-[3px] left-1/2 -translate-x-1/2 flex items-center justify-center sm:top-[4px]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#08080a] ring-1 ring-white/10" />
        </div>

        {/* Screen Viewport */}
        <div
          className={cn(
            "relative w-full overflow-hidden rounded-[6px] bg-black ring-1 ring-white/10",
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
        <div className="relative h-[8px] w-full rounded-b-[7px] border-t border-white/25 bg-gradient-to-b from-[#2e2f34] via-[#212226] to-[#161719] shadow-md sm:h-[10px]">
          {/* Display Opener Thumb Notch */}
          <div className="absolute -top-[1px] left-1/2 h-[4px] w-12 -translate-x-1/2 rounded-b-[4px] bg-[#121316] shadow-inner sm:h-[5px] sm:w-14" />
        </div>

        {/* Base Bottom Edge Shadow / Contact Area */}
        <div className="h-[2px] w-[96%] rounded-b-full bg-[#0e0f11] shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />

        {/* Soft Ambient Contact Shadow Under Laptop */}
        <div className="absolute -bottom-2 h-3 w-[92%] rounded-full bg-black/35 blur-[5px]" />
      </div>
    </div>
  );
}
