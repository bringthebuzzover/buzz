/**
 * Infinite horizontal scroll of college logos for the “Our College Network” section.
 * Duplicates `items` in the DOM for CSS marquee; optional `reverse` animation direction.
 * Images use `logoSrcFor` (local asset or Clearbit); `onError` falls back to icon.horse.
 */
import type { CollegeMarqueeItem } from "../../types/campaign";

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
      className={`w-full overflow-hidden bg-buzz-cream py-16 ${
        hideBottomBorder ? "" : "border-b border-buzz-line"
      }`}
    >
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold text-buzz-ink">{title}</h2>
        {subtitle ? (
          <p className="mt-1 text-sm text-buzz-inkMuted">{subtitle}</p>
        ) : null}
      </div>
      <div className="relative flex w-full flex-nowrap items-center">
        <div
          className={`flex w-max shrink-0 items-center justify-center space-x-16 px-8 ${
            reverse ? "animate-marquee-reverse" : "animate-marquee"
          }`}
        >
          {[...items, ...items].map((item, i) => (
            <div
              key={`${item.domain}-${i}`}
              className="group flex h-32 w-32 flex-col items-center justify-center opacity-80 transition duration-300 hover:opacity-100"
            >
              <div className="mb-3 flex h-20 w-20 items-center justify-center">
                <img
                  src={logoSrcFor(item)}
                  alt={item.name}
                  className="h-full w-full object-contain drop-shadow-buzz grayscale transition duration-300 group-hover:grayscale-0"
                  onError={e => {
                    const target = e.currentTarget;
                    const fallback = `https://icon.horse/icon/${item.domain}`;
                    if (target.src !== fallback) {
                      target.src = fallback;
                    }
                  }}
                />
              </div>
              <span className="block whitespace-nowrap text-center text-[10px] font-medium text-buzz-inkMuted">
                {item.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
