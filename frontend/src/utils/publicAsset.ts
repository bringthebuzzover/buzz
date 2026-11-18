/**
 * URLs for files under `public/`. Uses `PUBLIC_URL` so subdirectory deploys
 * (e.g. GitHub Pages) resolve correctly.
 */
export function publicAsset(path: string): string {
  const base = process.env.PUBLIC_URL ?? "";
  return `${base}/${path.replace(/^\//, "")}`;
}

/** Buzz brand marks under `public/logos/` (wordmark, bee, etc.). */
export function publicLogo(pathWithinLogos: string): string {
  return publicAsset(`logos/${pathWithinLogos.replace(/^\//, "")}`);
}
