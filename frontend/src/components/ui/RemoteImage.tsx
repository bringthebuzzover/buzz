/**
 * Image that keeps its box when the URL cannot be shown.
 *
 * Drop heroes and Instagram CDN thumbs are https URLs that can 404, come back
 * as HTML, or expire. Instagram's CDN also rejects the page Referer, so those
 * hosts are requested with `no-referrer`. A failed load swaps to initials on
 * the existing neutral wash — the same tile size, no broken alt text.
 */
import { useState } from "react";
import { cn } from "../../theme/cn";
import { safeHttpUrl } from "../../utils/safeHttpUrl";

export function imageInitials(label: string): string {
  const words = label
    .trim()
    .split(/[^A-Za-z0-9]+/)
    .filter((word) => word.length > 0);
  if (words.length === 0) {
    return "";
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

/** Bundled asset path, or an http(s) URL. Other schemes are not displayable. */
export function displayableImageSrc(src: string | null | undefined): string | null {
  if (src == null) {
    return null;
  }
  const value = src.trim();
  if (value === "" || value.startsWith("//")) {
    return null;
  }
  if (
    value.startsWith("/") ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    !value.includes(":")
  ) {
    return value;
  }
  return safeHttpUrl(value);
}

function instagramCdnHost(src: string): boolean {
  let host = "";
  try {
    host = new URL(src, "https://www.bringthebuzzover.com").hostname.toLowerCase();
  } catch {
    return false;
  }
  return (
    host === "cdninstagram.com" ||
    host.endsWith(".cdninstagram.com") ||
    host === "fbcdn.net" ||
    host.endsWith(".fbcdn.net") ||
    host === "instagram.com" ||
    host.endsWith(".instagram.com")
  );
}

type RemoteImageProps = {
  src: string | null | undefined;
  /** Name used for the initials when the image cannot be shown. */
  label: string;
  alt?: string;
  className?: string;
};

export function RemoteImage({
  src,
  label,
  alt = "",
  className,
}: RemoteImageProps) {
  const resolved = displayableImageSrc(src);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = resolved == null || failedSrc === resolved;

  if (failed) {
    return (
      <span
        className={cn(
          "flex items-center justify-center bg-buzz-neutralWash font-semibold text-buzz-inkMuted",
          className,
        )}
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        data-testid="image-fallback"
      >
        {imageInitials(label)}
      </span>
    );
  }

  return (
    <img
      src={resolved}
      alt={alt}
      className={className}
      referrerPolicy={instagramCdnHost(resolved) ? "no-referrer" : undefined}
      onError={() => setFailedSrc(resolved)}
    />
  );
}
