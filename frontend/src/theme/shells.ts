/**
 * Page/auth shell class roles. Import AuthShell / PageShell instead of
 * copying these strings in pages.
 */

/**
 * `center` used to center inside `min-h-[60vh]`, which ignored the ~136px
 * header and the footer entirely — so every "centered" auth page actually sat
 * above optical center with a void beneath it. It now claims the real leftover
 * space via `flex-1`, which only works because `SiteLayout` is a flex column
 * down to the outlet. Children stay stretched (so forms fill the column);
 * hugging CTAs opt out with `self-center`, which `Button` sets for itself.
 */
export const AUTH_SHELL = {
  center:
    "mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16 sm:px-8",
  stack: "mx-auto w-full max-w-md px-6 py-16 sm:px-8",
} as const;

export type AuthShellAlign = keyof typeof AUTH_SHELL;

export const PAGE_WIDTH = {
  auth: "max-w-md",
  form: "max-w-2xl",
  reading: "max-w-3xl",
  portal: "max-w-4xl",
  wide: "max-w-6xl",
} as const;

export type PageWidth = keyof typeof PAGE_WIDTH;

export const PAGE_SHELL = "mx-auto w-full px-6 py-12 sm:px-8" as const;

export function cx(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}
