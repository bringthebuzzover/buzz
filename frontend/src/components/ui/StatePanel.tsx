import type { ReactNode } from "react";
import { TEXT, TONE, type Tone } from "../../theme/tokens";
import { cn } from "../../theme/cn";

/**
 * Loading / empty / error panel.
 *
 * The app had the same `p-12` box duplicated three times in the drop feed,
 * three in My Campaigns, and twice on the brand dashboard, with failure
 * signalled only by swapping the text colour — so an error read as content.
 * Four admin list pages re-implemented the same states as a bare `<p>`.
 *
 * Tone carries the meaning; callers do not pick colours.
 */
export function StatePanel({
  tone = "neutral",
  title,
  className,
  children,
}: {
  tone?: Tone;
  title?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-buzzCard border p-8 text-center",
        TONE[tone],
        className,
      )}
      role={tone === "danger" ? "alert" : "status"}
    >
      {title && <p className={cn(TEXT.h3, "mb-1")}>{title}</p>}
      {children && <p className={TEXT.body}>{children}</p>}
    </div>
  );
}

/**
 * The three states a server-backed list can be in, in one place, so pages stop
 * inventing their own trio.
 */
export function QueryStatePanel({
  isPending,
  isError,
  label,
  empty,
  isEmpty,
}: {
  isPending: boolean;
  isError: boolean;
  /** Noun for the messages, e.g. "drops", "organizations". */
  label: string;
  /** Shown when the request succeeded but returned nothing. */
  empty?: ReactNode;
  isEmpty?: boolean;
}) {
  if (isPending) {
    return <StatePanel>Loading {label}…</StatePanel>;
  }
  if (isError) {
    return (
      <StatePanel tone="danger" title="Could not load">
        Something went wrong loading {label}. Try again.
      </StatePanel>
    );
  }
  if (isEmpty) {
    return <StatePanel>{empty ?? `No ${label} yet.`}</StatePanel>;
  }
  return null;
}
