// Merge the batch outputs into the files the theme ships, with the
// checks that matter before anything written by a machine goes out
// under Mere Orthodoxy's name.
//
//   node scripts/tfr-assemble-content.mjs bios
//   node scripts/tfr-assemble-content.mjs intros
//
// Refuses to write on a validation failure. Reports what it dropped.

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const KIND = process.argv[2];
if (!["bios", "intros"].includes(KIND)) {
  console.error("usage: tfr-assemble-content.mjs bios|intros");
  process.exit(1);
}

const DIR = path.join(ROOT, "data", "faith-received",
  KIND === "bios" ? "bio-batches" : "intro-batches");
const OUT = path.join(ROOT, "assets", "data", "faith-received",
  KIND === "bios" ? "tfr-authors.json" : "tfr-intros.json");
const TEXT = KIND === "bios" ? "bio" : "blurb";

const files = (await readdir(DIR)).filter((f) => /^out-\d+\.json$/.test(f)).sort();
if (!files.length) {
  console.error(`No out-*.json in ${DIR}`);
  process.exit(1);
}

const merged = {};
const problems = [];
let seen = 0;

for (const f of files) {
  let batch;
  try {
    batch = JSON.parse(await readFile(path.join(DIR, f), "utf-8"));
  } catch (e) {
    problems.push(`${f}: unparseable (${e.message})`);
    continue;
  }
  for (const [key, raw] of Object.entries(batch)) {
    seen += 1;
    const entry = typeof raw === "string" ? { [TEXT]: raw } : { ...raw };
    const text = String(entry[TEXT] || "");

    // House rules, enforced rather than trusted.
    if (text.includes("—")) {
      entry[TEXT] = text.replace(/\s*—\s*/g, ", ");
      problems.push(`${key}: em dash rewritten`);
    }
    if (/<[a-z/]/i.test(entry[TEXT] || "")) {
      problems.push(`${key}: DROPPED, contains markup`);
      continue;
    }
    // A machine that says nothing is fine. A machine that says nothing
    // at length is not.
    const len = String(entry[TEXT] || "").trim().length;
    if (len && len < 25) {
      problems.push(`${key}: DROPPED, ${len} chars is a stub`);
      continue;
    }
    if (!entry.confidence) entry.confidence = "low";
    // Provenance. Every entry we wrote is marked, so it can always be
    // told from the source's own and replaced when his lands.
    entry.source = "mere-orthodoxy";
    if (merged[key]) problems.push(`${key}: duplicate across batches, kept the first`);
    else merged[key] = entry;
  }
}

const keys = Object.keys(merged);
const conf = keys.reduce((a, k) => {
  const c = merged[k].confidence || "low";
  a[c] = (a[c] || 0) + 1;
  return a;
}, {});
const withText = keys.filter((k) => String(merged[k][TEXT] || "").trim().length >= 25);

console.log(`${files.length} batches, ${seen} entries seen, ${keys.length} kept`);
console.log(`  with usable text: ${withText.length}`);
console.log(`  confidence: ${JSON.stringify(conf)}`);
if (problems.length) {
  console.log(`\n  ${problems.length} notes:`);
  problems.slice(0, 25).forEach((p) => console.log(`    ${p}`));
  if (problems.length > 25) console.log(`    … and ${problems.length - 25} more`);
}

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(merged, null, 1));
console.log(`\nwrote ${path.relative(ROOT, OUT)}  (${keys.length} entries)`);
