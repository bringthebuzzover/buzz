/**
 * URL for Buzz brand marks under `public/logos/` (wordmark, bee, etc.).
 * Uses `PUBLIC_URL` so subdirectory deploys (e.g. GitHub Pages) resolve correctly.
 */
export function publicLogo(pathWithinLogos: string): string {
  const base = process.env.PUBLIC_URL ?? "";
  const rel = pathWithinLogos.replace(/^\//, "");
  return `${base}/logos/${rel}`;
}
