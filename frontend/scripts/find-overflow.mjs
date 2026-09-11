/**
 * Name the element that makes a route scroll sideways on a phone.
 *
 *   node scripts/find-overflow.mjs /for-brands [width]
 *
 * `e2e/layout.spec.ts` fails the build on horizontal overflow but only reports
 * the pixel count; this prints the culprits, deepest node first, because the
 * innermost overflowing element is the one whose classes need changing.
 * Requires the dev server on :3000.
 */
import { chromium } from "@playwright/test";

const route = process.argv[2] ?? "/";
const width = Number(process.argv[3] ?? 375);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height: 812 } });
await page.route("**/api/auth/dev-login", (r) =>
  r.fulfill({ status: 404, contentType: "application/json", body: "{}" }),
);
await page.goto(`http://localhost:3000${route}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);

const report = await page.evaluate(() => {
  const limit = document.documentElement.clientWidth;
  const out = [];
  for (const el of Array.from(document.querySelectorAll("body *"))) {
    const r = el.getBoundingClientRect();
    if (r.right > limit + 1 && r.width > 0) {
      let depth = 0;
      let p = el;
      while ((p = p.parentElement)) depth++;
      out.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className || "").toString().slice(0, 110),
        right: Math.round(r.right),
        width: Math.round(r.width),
        depth,
      });
    }
  }
  return { limit, scrollWidth: document.documentElement.scrollWidth, out };
});

console.log(`${route} @${width}: clientWidth=${report.limit} scrollWidth=${report.scrollWidth}`);
const byDepth = report.out.sort((a, b) => a.depth - b.depth);
const show = (label, rows) => {
  console.log(label);
  for (const c of rows) {
    console.log(`  d${c.depth} ${c.tag} right=${c.right} w=${c.width} :: ${c.cls}`);
  }
};
// The outermost overflowing node is usually the container at fault; the
// innermost is usually the content that will not shrink.
show("outermost:", byDepth.slice(0, 6));
show("innermost:", byDepth.slice(-6));

// Walk down from <body> so it is obvious which ancestor stops matching the
// viewport width — that is the box that needs `min-w-0` or `w-full`.
const chain = await page.evaluate(() => {
  const rows = [];
  let el = document.body;
  while (el) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    rows.push(
      `${el.tagName.toLowerCase()} w=${Math.round(r.width)} display=${cs.display} minWidth=${cs.minWidth} :: ${(el.className || "").toString().slice(0, 60)}`,
    );
    let next = null;
    for (const child of Array.from(el.children)) {
      const cr = child.getBoundingClientRect();
      if (cr.width > document.documentElement.clientWidth + 1) {
        next = child;
        break;
      }
    }
    el = next;
  }
  return rows;
});
console.log("ancestor chain:");
for (const row of chain) console.log(`  ${row}`);
if (!report.out.length) console.log("  no overflowing elements");

await browser.close();
