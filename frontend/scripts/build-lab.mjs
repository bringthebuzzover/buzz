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

const badgeCss = fs.readFileSync(
  path.join(frontendRoot, "src/lab/badge.css"),
  "utf8",
);
const BADGE = `<p class="buzz-lab-badge">Design preview</p><style>${badgeCss}</style>`;

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

// Copy with symlinks resolved to real files. Pages rejects build output
// that contains links, and fs.cpSync's `dereference` is not honored on
// Node 22 (it writes absolute links). statSync follows links.
function copyResolved(src, dest) {
  if (fs.statSync(src).isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyResolved(path.join(src, name), path.join(dest, name));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

function findLinks(dir, links = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) links.push(full);
    else if (entry.isDirectory()) findLinks(full, links);
  }
  return links;
}

copyResolved(
  path.join(frontendRoot, "lab-static/drop-editor"),
  path.join(buildDir, "lab/drop-editor"),
);
copyResolved(
  path.join(repoRoot, "design/logo-options"),
  path.join(buildDir, "lab/logo-options"),
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
// Trailing-slash only. Pages follows every redirect even when a file
// matches, so a `/* /index.html 200` splat would hide robots.txt, the JS
// bundles, and the mockup. No top-level 404.html: Pages falls back to the
// SPA for paths that are not files. See docs/LAB.md.
const redirects = [
  "/lab/drop-editor  /lab/drop-editor/  301",
  "/lab/logo-options  /lab/logo-options/  301",
  "",
].join("\n");
if (redirects.includes("/index.html")) {
  console.error("Lab _redirects must not rewrite paths to index.html.");
  process.exit(1);
}
fs.writeFileSync(path.join(buildDir, "_redirects"), redirects);

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
if (bundled.includes("REACT_APP_API_URL is unset")) {
  console.error("Lab bundle still contains the production API URL warning.");
  process.exit(1);
}

const links = findLinks(buildDir);
if (links.length) {
  console.error(`Lab build output contains symlinks: ${links.join(", ")}`);
  process.exit(1);
}

console.log("Lab build ready: directory at /, static mockups under /lab/.");
