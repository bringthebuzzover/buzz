import { cn } from "../../theme/cn";

/** Marketing nav item: paper type, hairline underline when active. */
export function marketingNavItemClass(active: boolean) {
  return cn(
    "whitespace-nowrap text-sm text-buzz-fg transition hover:text-buzz-yellow",
    active && "underline decoration-buzz-fg decoration-1 underline-offset-8",
  );
}

/** App / admin nav item: pill. Active is the yellow wash. */
export function appNavItemClass(active: boolean) {
  return cn(
    "inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition",
    active
      ? "bg-buzz-yellowFaded text-buzz-yellow"
      : "text-buzz-inkMuted hover:bg-buzz-paper08 hover:text-buzz-fg",
  );
}
