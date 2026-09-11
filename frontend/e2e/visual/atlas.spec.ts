/**
 * Screenshot atlas: every designed surface in `surfaces.ts` at three viewports,
 * written to `ui-atlas/<phase>/`. This is review input for the UI revamp, not a
 * correctness gate — it is excluded from `npm run e2e` and runs via
 * `npm run atlas` (see `playwright.atlas.config.ts`).
 *
 *   ATLAS_PHASE=before npm run atlas     # baseline, pre-migration
 *   ATLAS_PHASE=after  npm run atlas     # post-migration
 *   npm run atlas:diff before after      # which surfaces moved
 *
 * One test per persona so a stuck login costs that persona's shots, not the
 * whole atlas, and so each gets its own timeout budget. A missing shot is a
 * real finding (surface unreachable on the seed), so per-surface failures are
 * recorded in the manifest instead of aborting the run.
 */
import fs from "node:fs";
import path from "node:path";
import { test, type Page } from "@playwright/test";
import { openPersona, discoverId, type Persona } from "./personas";
import {
  SURFACES,
  DYNAMIC_SOURCES,
  VIEWPORTS,
  resolveRoute,
  type DynamicRef,
} from "./surfaces";

const PHASE = process.env.ATLAS_PHASE ?? "before";
const OUT_DIR = path.resolve(__dirname, "..", "..", "ui-atlas", PHASE);

/** Which `:param` ids each persona can resolve from its own session. */
const PERSONA_IDS: Record<Persona, DynamicRef[]> = {
  public: [],
  org: ["campaignId"],
  brand: ["brandDropId"],
  admin: ["orgUserId", "brandId", "requestId", "adminDropId"],
};

type ManifestRow = {
  surface: string;
  viewport: string;
  route: string;
  persona: string;
  area: string;
  file: string | null;
  status: "ok" | "skipped" | "error";
  note?: string;
};

/** Load a surface and settle it enough that we do not shoot a spinner. */
async function settle(page: Page, route: string): Promise<void> {
  await page.goto(route, { waitUntil: "domcontentloaded", timeout: 20_000 });
  // Bounded: the CRA dev server holds an HMR socket open, so networkidle can
  // never arrive. Treat the timeout as "settled enough" rather than failing.
  await page.waitForLoadState("networkidle", { timeout: 4_000 }).catch(() => undefined);
  await page
    .getByText(/restoring your session/i)
    .waitFor({ state: "hidden", timeout: 8_000 })
    .catch(() => undefined);
}

for (const persona of ["public", "org", "brand", "admin"] as const) {
  const surfaces = SURFACES.filter((s) => s.persona === persona);
  if (!surfaces.length) continue;

  test(`atlas: ${persona}`, async ({ browser }) => {
    test.setTimeout(8 * 60_000);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const rows: ManifestRow[] = [];

    const { page } = await openPersona(browser, persona);

    const ids: Partial<Record<DynamicRef, string>> = {};
    for (const ref of PERSONA_IDS[persona]) {
      const src = DYNAMIC_SOURCES[ref];
      ids[ref] = await discoverId(page, src.list, src.prefix);
    }

    for (const surface of surfaces) {
      const route = resolveRoute(surface, ids);
      const base = {
        surface: surface.id,
        persona,
        area: surface.area,
        route: route ?? surface.route,
      };

      if (!route) {
        for (const vp of VIEWPORTS) {
          rows.push({
            ...base,
            viewport: vp.name,
            file: null,
            status: "skipped",
            note: `no seeded id for ${surface.dynamic}`,
          });
        }
        continue;
      }

      for (const vp of VIEWPORTS) {
        const file = `${surface.id}--${vp.name}.png`;
        const row: ManifestRow = { ...base, viewport: vp.name, file, status: "ok" };
        try {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await settle(page, route);
          if (surface.prep) await surface.prep(page);
          // `animations: "disabled"` finishes the marquee/fadeIn keyframes so
          // the same surface does not drift between phases.
          await page.screenshot({
            path: path.join(OUT_DIR, file),
            fullPage: true,
            animations: "disabled",
            timeout: 20_000,
          });
        } catch (err) {
          row.status = "error";
          row.file = null;
          row.note = (err as Error).message.split("\n")[0];
        }
        rows.push(row);
      }
    }

    fs.writeFileSync(
      path.join(OUT_DIR, `manifest-${persona}.json`),
      `${JSON.stringify({ phase: PHASE, persona, capturedAt: new Date().toISOString(), rows }, null, 2)}\n`,
    );

    const ok = rows.filter((r) => r.status === "ok").length;
    // eslint-disable-next-line no-console
    console.log(`[atlas] ${persona}: ${ok}/${rows.length} shots -> ${OUT_DIR}`);
    for (const row of rows.filter((r) => r.status !== "ok")) {
      // eslint-disable-next-line no-console
      console.log(`[atlas] ${row.status}: ${row.surface} (${row.viewport}) — ${row.note}`);
    }
  });
}
