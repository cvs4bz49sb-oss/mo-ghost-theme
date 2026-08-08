#!/usr/bin/env node
// Every Scripture reference in the Daily Liturgy data must be readable
// by the reader's parser.
//
// The devotional readings are hand-entered prose ("Hebrews 11:29-12:2",
// "Romans 16:17-20, 25-27", "Psalm 71 (prayer focused on 1-14)"). When
// the parser can't read one, the reader prints "Could not parse
// reference" in place of the passage and the emailed liturgy prints
// "Could not resolve" — a silent, per-day failure nobody sees until a
// subscriber reports it. This check turns that into a build failure.
//
// Run: npm run check:refs

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// The parser lives inside daily-liturgy-reader.js, which is an IIFE with
// no exports (the theme loads plain scripts, not modules). Rather than
// keep a second copy in sync, lift the parser section out of the source
// between its two banner comments and evaluate it here.
const READER = "assets/js/daily-liturgy-reader.js";
const START = "  // ── Scripture reference parser ──";
const END = "  // ── Scripture fetching ──";

const src = await readFile(path.join(ROOT, READER), "utf-8");
const from = src.indexOf(START);
const to = src.indexOf(END);
if (from < 0 || to < 0 || to < from) {
  console.error(`✗ ${READER}: could not find the parser section banners.`);
  console.error("  Expected these two comment lines, in order:");
  console.error(`    ${START}…\n    ${END}…`);
  process.exit(1);
}

const parseScriptureRef = new Function(`${src.slice(from, to)}\nreturn parseScriptureRef;`)();

const SOURCES = [
  { file: "assets/data/daily-liturgy/devotionals.json", fields: ["otReading", "ntReading", "psalmReading"] },
  { file: "assets/data/daily-liturgy/bible-in-2-years.json", fields: ["ot", "nt", "wisdom"] },
];

const problems = [];
let checked = 0;

for (const source of SOURCES) {
  const data = JSON.parse(await readFile(path.join(ROOT, source.file), "utf-8"));
  for (const [key, entry] of Object.entries(data)) {
    for (const field of source.fields) {
      const ref = entry && entry[field];
      if (!ref) continue;
      checked++;
      if (!parseScriptureRef(ref)) {
        problems.push(`${source.file} → ${key}.${field}: "${ref}" — the reader can't parse this reference`);
      }
    }
  }
}

if (problems.length) {
  console.error(`✗ ${problems.length} unreadable Scripture reference${problems.length === 1 ? "" : "s"}:\n`);
  for (const p of problems) console.error(`  ${p}`);
  console.error(`\nEither fix the reference in the data, or teach parseScriptureRef in ${READER} the form it uses.`);
  process.exit(1);
}

console.log(`✓ ${checked} Scripture references parse.`);
