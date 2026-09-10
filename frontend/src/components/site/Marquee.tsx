/**
 * Infinite horizontal scroll of college logos for the “Our College Network” section.
 * Duplicates `items` in the DOM for CSS marquee; optional `reverse` animation direction.
 * Images use `logoSrcFor` (local asset or Clearbit); `onError` falls back to icon.horse.
 */
import type { CollegeMarqueeItem } from "../../types/campaign";
import { SECTION_Y, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

type MarqueeProps = {
  /** Schools to render (array is doubled internally for seamless scroll). */
  items: CollegeMarqueeItem[];
  /** When true, uses the reverse CSS marquee animation. */
  reverse?: boolean;
  /** Section heading above the ticker. */
  title: string;
  /** Optional supporting line under the title. */
  subtitle?: string;
  /** Omit bottom border when the next section should visually blend (e.g. public home). */
  hideBottomBorder?: boolean;
};

/** Logo URL: local `logoSrc` when set, otherwise Clearbit by email domain. */
function logoSrcFor(item: CollegeMarqueeItem): string {
  return item.logoSrc ?? `https://logo.clearbit.com/${item.domain}`;
}

export default function Marquee({
  items,
  reverse = false,
  title,
  subtitle,
  hideBottomBorder = false,
}: MarqueeProps) {
  return (
    <div
      className={cn(
        "w-full overflow-hidden bg-buzz-cream",
        SECTION_Y,
        !hideBottomBorder && "border-b border-buzz-line",
      )}
    >
      <div className="mb-8 text-center">
        <h2 className={cn(TEXT.h2, "text-buzz-ink")}>{title}</h2>
        {subtitle ? (
          <p className={cn(TEXT.body, "mt-1 text-buzz-inkMuted")}>{subtitle}</p>
        ) : null}
      </div>
      <div className="relative flex w-full flex-nowrap items-center">
        <div
          className={cn(
            "flex w-max shrink-0 items-center justify-center space-x-8 px-4 sm:space-x-16 sm:px-8",
            reverse ? "animate-marquee-reverse" : "animate-marquee",
          )}
        >
          {[...items, ...items].map((item, i) => (
            <div
              key={`${item.domain}-${i}`}
              className="group flex h-20 w-20 flex-col items-center justify-center opacity-80 transition duration-300 hover:opacity-100 sm:h-32 sm:w-32"
            >
              <div className="mb-2 flex h-12 w-12 items-center justify-center sm:mb-3 sm:h-20 sm:w-20">
                <img
                  src={logoSrcFor(item)}
                  alt={item.name}
                  className="h-full w-full object-contain drop-shadow-buzz grayscale transition duration-300 group-hover:grayscale-0"
                  onError={(e) => {
                    const target = e.currentTarget;
                    const fallback = `https://icon.horse/icon/${item.domain}`;
                    if (target.src !== fallback) {
                      target.src = fallback;
                    }
                  }}
                />
              </div>
              <span className="block whitespace-nowrap text-center text-buzzMicro font-medium text-buzz-inkMuted">
                {item.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
