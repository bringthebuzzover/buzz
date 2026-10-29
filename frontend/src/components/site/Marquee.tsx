/**
 * College logo strip. On the paper network band the marks stay grayscale
 * (the pen's 48px / 78% / 56px gap / 100s drift). A white filter turned
 * Stanford, Yale, UPenn, UCLA, UMich, and UNC into blank silhouettes.
 * Reduced motion wraps the row into a centered grid and does not duplicate it.
 */
import { useReducedMotion } from "../marketing/useReducedMotion";
import type { CollegeMarqueeItem } from "../../types/campaign";
import { RemoteImage } from "../ui/RemoteImage";
import { SECTION_Y, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

type MarqueeProps = {
  items: CollegeMarqueeItem[];
  reverse?: boolean;
  title: string;
  subtitle?: string;
  hideBottomBorder?: boolean;
  /** Logo strip only, sitting inside a paper section that already has a title. */
  embedded?: boolean;
};

export default function Marquee({
  items,
  reverse = false,
  title,
  subtitle,
  hideBottomBorder = false,
  embedded = false,
}: MarqueeProps) {
  const reduce = useReducedMotion();
  const shown = reduce ? items : [...items, ...items];

  const strip = (
    <div
      className={cn(
        "relative w-full",
        reduce ? "flex flex-wrap items-center justify-center gap-8 px-4" : "overflow-hidden",
      )}
    >
      <div
        className={cn(
          "flex items-center",
          reduce
            ? "flex-wrap justify-center gap-8"
            : cn(
                "w-max shrink-0 gap-14 px-7 motion-reduce:animate-none",
                reverse ? "animate-marquee-reverse" : "animate-marquee",
              ),
        )}
        style={reduce ? undefined : { animationDuration: "100s" }}
      >
        {shown.map((item, i) => (
          <div key={`${item.domain}-${i}`} className="flex h-12 items-center justify-center">
            <RemoteImage
              src={item.logoSrc}
              label={item.name}
              alt={item.name}
              className={cn(
                "h-12 w-auto max-h-12 object-contain opacity-80 grayscale",
                item.logoClassName,
              )}
            />
          </div>
        ))}
      </div>
    </div>
  );

  if (embedded) {
    return strip;
  }

  return (
    <div
      className={cn(
        "w-full overflow-hidden bg-[#f0f0f0] text-on-accent",
        SECTION_Y,
        !hideBottomBorder && "border-b border-on-accent/10",
      )}
    >
      <div className="mb-8 text-center">
        <h2 className={cn(TEXT.h2, "text-on-accent")}>{title}</h2>
        {subtitle ? (
          <p className={cn(TEXT.body, "mt-1 text-on-accent/55")}>{subtitle}</p>
        ) : null}
      </div>
      {strip}
    </div>
  );
}
