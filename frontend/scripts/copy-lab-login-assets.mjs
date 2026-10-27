// Copies the Lab login's fonts and logos into build/__lab/assets/ so the
// login page can load them before the visitor is signed in. Run after
// build-lab.mjs (see `npm run build:lab`). The production build never runs this.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dest = path.join(frontendRoot, "build/__lab/assets");
const files = [
  ["src/pages/pulse/fonts/switzer-400.woff2", "switzer-400.woff2"],
  ["src/pages/pulse/fonts/switzer-500.woff2", "switzer-500.woff2"],
  ["public/logos/buzz-logo.svg", "buzz-logo.svg"],
  ["public/logos/bee.svg", "bee.svg"],
];

if (!fs.existsSync(path.join(frontendRoot, "build"))) {
  console.error("No build/ folder. Run the lab build first.");
  process.exit(1);
}
fs.mkdirSync(dest, { recursive: true });
for (const [src, name] of files) {
  // copyFileSync follows symlinks, so the output holds real files.
  fs.copyFileSync(path.join(frontendRoot, src), path.join(dest, name));
}
console.log(`Lab login assets copied to build/__lab/assets (${files.length} files).`);
