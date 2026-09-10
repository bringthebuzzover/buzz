/**
 * Page/auth shell class roles. Import AuthShell / PageShell instead of
 * copying these strings in pages.
 */
export const AUTH_SHELL = {
  center:
    "mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-8 py-24",
  stack: "mx-auto max-w-md px-8 py-16",
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

export const PAGE_SHELL =
  "mx-auto px-8 py-12" as const;

export function cx(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}
