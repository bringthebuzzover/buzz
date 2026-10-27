/**
 * Lab preview build. Sets VITE_LAB=1 so craco swaps the entry, then adds
 * static mockups, noindex, and Pages files that must not live in public/
 * (those would ship in the production CRA build).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(frontendRoot, "..");
const buildDir = path.join(frontendRoot, "build");

/* Keep the badge rules aligned with .lab-badge in src/lab/lab.css. */
const BADGE =
  '<p class="buzz-lab-badge">Design preview</p>' +
  "<style>" +
  ".buzz-lab-badge{position:fixed;z-index:80;top:10px;left:50%;transform:translateX(-50%);" +
  "margin:0;padding:4px 10px;border-radius:999px;background:#f6d32a;color:#0b0b0b;" +
  "font-family:Switzer,ui-sans-serif,system-ui,sans-serif;font-size:11px;font-weight:500;" +
  "letter-spacing:.04em;line-height:1.4;text-transform:uppercase;pointer-events:none}" +
  "</style>";

const ROBOTS = '<meta name="robots" content="noindex, nofollow">';

function stampHead(html) {
  if (/name=["']robots["']/i.test(html)) return html;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (open) => `${open}${ROBOTS}`);
  }
  return ROBOTS + html;
}

function stampBadge(html) {
  if (html.includes("buzz-lab-badge")) return html;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${BADGE}</body>`);
  }
  return html + BADGE;
}

function walkHtml(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walkHtml(full, files);
    else if (name.endsWith(".html")) files.push(full);
  }
  return files;
}

const cracoBin = path.join(
  frontendRoot,
  "node_modules/@craco/craco/dist/bin/craco.js",
);
const build = spawnSync(process.execPath, [cracoBin, "build"], {
  cwd: frontendRoot,
  env: { ...process.env, VITE_LAB: "1" },
  stdio: "inherit",
});
if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

fs.cpSync(
  path.join(frontendRoot, "lab-static/drop-editor"),
  path.join(buildDir, "lab/drop-editor"),
  { recursive: true },
);
fs.cpSync(
  path.join(repoRoot, "design/logo-options"),
  path.join(buildDir, "lab/logo-options"),
  { recursive: true },
);

for (const file of walkHtml(path.join(buildDir, "lab"))) {
  const html = fs.readFileSync(file, "utf8");
  fs.writeFileSync(file, stampBadge(stampHead(html)));
}

const indexPath = path.join(buildDir, "index.html");
let indexHtml = fs.readFileSync(indexPath, "utf8");
indexHtml = stampHead(indexHtml).replace(
  "<title>BUZZ</title>",
  "<title>BUZZ Lab</title>",
);
fs.writeFileSync(indexPath, indexHtml);

fs.writeFileSync(
  path.join(buildDir, "robots.txt"),
  "User-agent: *\nDisallow: /\n",
);
fs.writeFileSync(
  path.join(buildDir, "_headers"),
  "/*\n  X-Robots-Tag: noindex, nofollow\n",
);
fs.writeFileSync(
  path.join(buildDir, "_redirects"),
  [
    "/lab/drop-editor  /lab/drop-editor/  301",
    "/lab/logo-options  /lab/logo-options/  301",
    "/*  /index.html  200",
    "",
  ].join("\n"),
);

const mainJs = fs
  .readdirSync(path.join(buildDir, "static/js"))
  .find((name) => name.startsWith("main.") && name.endsWith(".js"));
const bundled = mainJs
  ? fs.readFileSync(path.join(buildDir, "static/js", mainJs), "utf8")
  : "";
if (!bundled.includes("Design preview") || !bundled.includes("BUZZ Lab")) {
  console.error("Lab entry was not bundled. VITE_LAB did not swap the entry.");
  process.exit(1);
}

console.log("Lab build ready: directory at /, static mockups under /lab/.");
