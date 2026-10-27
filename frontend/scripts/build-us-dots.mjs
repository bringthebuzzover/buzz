/**
 * Precompute the dotted United States for /pulse2.
 * Dots are the points of a grid that fall inside the us-atlas nation outline,
 * projected with geoAlbersUsa. Pins are projected at runtime with the same
 * scale and translate, so a new school only needs lat/lng.
 */
import { readFileSync, writeFileSync } from "fs";
import { createRequire } from "module";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { geoAlbersUsa, geoContains } from "d3-geo";
import { feature } from "topojson-client";

const require = createRequire(import.meta.url);
const topo = JSON.parse(readFileSync(require.resolve("us-atlas/nation-10m.json"), "utf8"));
const nation = feature(topo, topo.objects.nation);

const width = 960;
const height = 600;
const projection = geoAlbersUsa().fitExtent(
  [
    [12, 12],
    [width - 12, height - 12],
  ],
  nation,
);

const step = 9;
const points = [];
for (let y = step / 2; y < height; y += step) {
  for (let x = step / 2; x < width; x += step) {
    const coord = projection.invert([x, y]);
    if (!coord || !geoContains(nation, coord)) continue;
    points.push([Math.round(x), Math.round(y)]);
  }
}

const translate = projection.translate();
const out = {
  source: "us-atlas nation-10m.json",
  projection: "geoAlbersUsa",
  width,
  height,
  scale: projection.scale(),
  translate: [translate[0], translate[1]],
  r: 1.8,
  points,
};

const here = dirname(fileURLToPath(import.meta.url));
const dest = join(here, "../src/pages/pulse2/us-dots.json");
writeFileSync(dest, `${JSON.stringify(out)}\n`);
console.log(`wrote ${points.length} dots to ${dest}`);
