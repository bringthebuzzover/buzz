import { siteIdentity } from "../../data/siteIdentity";
import { cn } from "../../theme/cn";
import { publicAsset } from "../../utils/publicAsset";

/**
 * The pulse bee. Decorative — pass a real alt only when it is the sole
 * content of a control. Default alt is empty.
 */
export function BeeMark({
  className,
  alt = "",
}: {
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src={publicAsset("logos/bee.svg")}
      alt={alt}
      className={cn("h-10 w-10 object-contain", className)}
    />
  );
}

/**
 * Wordmark slot. `ink` is the paper-colored mark for dark surfaces (the
 * default, now that the page is ink). `paper` is the original black mark
 * for a light band, if a later page still needs one.
 */
export function Logo({
  surface = "ink",
  className,
  alt = siteIdentity.images.logoAlt,
}: {
  surface?: "ink" | "paper";
  className?: string;
  alt?: string;
}) {
  const src =
    surface === "paper" ? siteIdentity.images.logoOnPaper : siteIdentity.images.logo;
  return (
    <img
      src={src}
      alt={alt}
      className={cn("h-8 w-auto max-w-full object-contain", className)}
    />
  );
}
