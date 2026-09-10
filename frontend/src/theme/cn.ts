import { twMerge } from "tailwind-merge";
import { cx } from "./shells";

/**
 * Join classes and let the *caller's* utilities win over the primitive's.
 *
 * `cx` alone concatenates, so `cn(fieldClass, "h-9")` used to depend on CSS
 * source order to decide which height applied. `twMerge` resolves the conflict
 * by keeping the last utility in each Tailwind group, which is what makes a
 * `className` override on a primitive predictable.
 */
export function cn(
  ...parts: Array<string | false | null | undefined>
): string {
  return twMerge(cx(...parts));
}
