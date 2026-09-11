/**
 * Screenshot one `<section>` of the UI kit at 2x, so primitives can be judged
 * at real detail instead of a downscaled full-page shot.
 *
 *   node scripts/shoot-section.mjs "Buttons" "Controls — default size"
 *
 * Requires the dev servers to be up (`npm start` + backend on :8000).
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";

const titles = process.argv.slice(2);
const OUT = "ui-atlas/kit";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 900, height: 900 },
  deviceScaleFactor: 2,
});
await page.route("**/api/auth/dev-login", (r) =>
  r.fulfill({ status: 404, contentType: "application/json", body: "{}" }),
);
await page.goto("http://localhost:3000/dev/ui-kit", {
  waitUntil: "domcontentloaded",
});
await page.getByRole("heading", { name: "UI kit" }).waitFor();

for (const title of titles) {
  const section = page.locator("section").filter({
    has: page.getByRole("heading", { name: title, exact: true }),
  });
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  // Without this the page-level `fade-in` is still running and every colour
  // reads washed out over the cream background.
  await section.screenshot({
    path: `${OUT}/section-${slug}.png`,
    animations: "disabled",
  });
  console.log(`shot ${OUT}/section-${slug}.png`);
}

await browser.close();
