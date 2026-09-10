#!/usr/bin/env node
/**
 * Compare two atlas phases and report which surfaces changed.
 *
 *   node scripts/atlas-diff.mjs before after
 *
 * Content hashes, not pixel math, so this needs no image dependency. It answers
 * "what moved?" — whether a change is an improvement is the vision reviewer's
 * call, working from the two PNGs side by side.
 *
 * Exit code is always 0: drift is information for review, not a build failure.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const [, , fromPhase = "before", toPhase = "after"] = process.argv;
const root = path.resolve(import.meta.dirname, "..", "ui-atlas");
const fromDir = path.join(root, fromPhase);
const toDir = path.join(root, toPhase);

for (const dir of [fromDir, toDir]) {
  if (!fs.existsSync(dir)) {
    console.error(`atlas-diff: missing ${dir} — run ATLAS_PHASE=${path.basename(dir)} npm run atlas`);
    process.exit(1);
  }
}

const shots = (dir) =>
  new Map(
    fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".png"))
      .map((f) => [f, createHash("sha256").update(fs.readFileSync(path.join(dir, f))).digest("hex")]),
  );

const before = shots(fromDir);
const after = shots(toDir);

const changed = [];
const same = [];
const added = [];
const removed = [];

for (const [file, hash] of after) {
  if (!before.has(file)) added.push(file);
  else if (before.get(file) !== hash) changed.push(file);
  else same.push(file);
}
for (const file of before.keys()) if (!after.has(file)) removed.push(file);

const bullet = (label, list) => {
  if (!list.length) return;
  console.log(`\n${label} (${list.length})`);
  for (const f of list.sort()) console.log(`  ${f}`);
};

console.log(`atlas-diff: ${fromPhase} -> ${toPhase}`);
console.log(
  `  ${changed.length} changed, ${same.length} identical, ${added.length} new, ${removed.length} missing`,
);
bullet("CHANGED — review before/after pairs", changed);
bullet("NEW — no baseline", added);
bullet("MISSING — surface no longer captured (regression?)", removed);
bullet("IDENTICAL — untouched by the migration", same);

const outPath = path.join(root, `diff-${fromPhase}-${toPhase}.json`);
fs.writeFileSync(
  outPath,
  `${JSON.stringify({ from: fromPhase, to: toPhase, changed, added, removed, same }, null, 2)}\n`,
);
console.log(`\nwrote ${outPath}`);
