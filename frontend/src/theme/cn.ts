import { extendTailwindMerge } from "tailwind-merge";
import { cx } from "./shells";

/**
 * Join classes and let the *caller's* utilities win over the primitive's.
 *
 * `cx` alone concatenates, so `cn(fieldClass, "h-9")` used to depend on CSS
 * source order to decide which height applied. `twMerge` resolves the conflict
 * by keeping the last utility in each Tailwind group, which is what makes a
 * `className` override on a primitive predictable.
 *
 * `text-buzzMicro` must be registered as a font-size. Default twMerge treats
 * unknown `text-*` as color (`isAny`), so `cn("text-buzzMicro", TONE.success)`
 * dropped the size and chips inherited 14px (tables) or 16px (body).
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["buzzMicro"] }],
    },
  },
});

export function cn(
  ...parts: Array<string | false | null | undefined>
): string {
  return twMerge(cx(...parts));
}
