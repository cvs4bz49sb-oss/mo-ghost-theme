#!/usr/bin/env node
// A multi-volume set must read in the order it was printed.
//
// WHY THIS EXISTS. Eight surfaces sorted titles with a plain
// `localeCompare`, which orders digit runs as text, so Abraham Calov's
// System of Theological Topics stood on his shelf as Vol. 1, Vol. 10,
// Vol. 11, Vol. 12, Vol. 2 ... and 242 of the library's 3,213 authors
// had a work list out of order for the same reason. Order is the one
// thing a volume number is for, so this is not cosmetic: a reader
// looking for where a work continues was told it continues in volume 10.
//
// Roman numerals fail worse, because text order puts IX between IV and
// V, and 68 titles in the catalogue number their parts in Roman.
//
// The comparator is in assets/js/lib/faith-title-order.js and ships in
// BOOT, because page scripts run before site.min.js in this theme.
//
// Run: npm run check:titles

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = "assets/js/lib/faith-title-order.js";
const BUILD = "scripts/build-theme.mjs";

const src = await readFile(path.join(ROOT, SOURCE), "utf-8");
const win = {};
new Function("window", src)(win);

if (!win.MOTitleOrder || typeof win.MOTitleOrder.compareTitles !== "function") {
  console.error(`✗ ${SOURCE} did not publish window.MOTitleOrder.compareTitles.`);
  process.exit(1);
}
const { compareTitles } = win.MOTitleOrder;

// It is only useful if it is actually in the bundle that loads first.
// Anchor on the bundle DEFINITION (`name: "boot.min.js"`), not on the
// first mention of the string: both bundle names appear in this file's
// header comment first, and slicing between those found nothing.
const build = await readFile(path.join(ROOT, BUILD), "utf-8");
const bootStart = build.indexOf('name: "boot.min.js"');
if (bootStart < 0) {
  console.error(`✗ ${BUILD}: could not find the boot bundle definition.`);
  process.exit(1);
}
const nextName = build.indexOf('name: "', bootStart + 20);
const bootBlock = build.slice(bootStart, nextName < 0 ? build.length : nextName);
if (!bootBlock.includes(SOURCE)) {
  console.error(`✗ ${SOURCE} is not in the boot bundle in ${BUILD}.`);
  console.error("  Page scripts run before site.min.js, so a comparator that");
  console.error("  ships in the site bundle is undefined when a room sorts.");
  process.exit(1);
}

const failures = [];
const ordered = (list) => list.slice().sort(compareTitles);
function expect(name, input, want) {
  const got = ordered(input);
  if (got.join(" | ") !== want.join(" | ")) {
    failures.push(`${name}\n      got:  ${got.join(" | ")}\n      want: ${want.join(" | ")}`);
  }
}

// The case that started this, as it appears in the catalogue.
const calov = (n) => `System of Theological Topics, Vol. ${n} (1677)`;
expect("Arabic volumes, the Calov shelf",
  [1, 10, 11, 12, 2, 3, 4, 5, 7, 8, 9].map(calov),
  [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12].map(calov));

// Roman parts, where text order puts IX between IV and V.
const part = (r) => `Sober Philosophy, Part ${r}`;
expect("Roman parts",
  ["III", "I", "X", "IV", "IX", "II", "V"].map(part),
  ["I", "II", "III", "IV", "V", "IX", "X"].map(part));

expect("Tome, the Patrologia Orientalis word",
  ["Tome 11", "Tome 2", "Tome 1"],
  ["Tome 1", "Tome 2", "Tome 11"]);

// A numeral that is not a number must not be reordered as one. This is
// the direction that matters: a wrong reordering is silent and a
// missed one merely leaves things as they were.
expect("a Roman-looking word is left alone",
  ["Liber Isaiah", "Liber Ezekiel"],
  ["Liber Ezekiel", "Liber Isaiah"]);
expect("an ordinal in a book name is not a volume",
  ["Commentary on II Corinthians", "Commentary on I Corinthians"],
  ["Commentary on I Corinthians", "Commentary on II Corinthians"]);

// Titles with no volume number keep plain alphabetical order.
expect("plain titles are unaffected",
  ["On the Trinity", "Confessions", "The City of God"],
  ["Confessions", "On the Trinity", "The City of God"]);

// Mixed widths inside one set, the failure mode `numeric: true` fixes.
expect("mixed-width Arabic",
  ["Vol. 100", "Vol. 9", "Vol. 10", "Vol. 1"],
  ["Vol. 1", "Vol. 9", "Vol. 10", "Vol. 100"]);


// Generic catalogue titles carry their number in the separate volume field.
const roomSource = await readFile(path.join(ROOT, "assets/js/faith-room.js"), "utf8");
const workComparator = roomSource.match(/function compareWorks\(a, b\) \{[\s\S]*?\n  \}/);
if (!workComparator) throw new Error("Room work comparator missing");
const compareWorks = new Function("cmpTitle", `${workComparator[0]}; return compareWorks;`)(compareTitles);
for (const volumes of [["Vol. 1", "Vol. 2", "Vol. 10"], ["Tomus I", "Tomus II", "Tomus IX"]]) {
  const works = [volumes[2], volumes[0], volumes[1]].map(volume => ({ title: "Works", volume }));
  const got = works.sort(compareWorks).map(w => w.volume);
  if (got.join("|") !== volumes.join("|")) failures.push(`Separate volume fields: ${got.join(", ")}`);
}

if (failures.length) {
  console.error(`✗ ${SOURCE}: ${failures.length} ordering(s) wrong.\n`);
  for (const f of failures) console.error(`  ${f}\n`);
  process.exit(1);
}

// Every surface that sorts a shelf must go through the comparator.
const CALLERS = [
  "assets/js/faith-author.js",
  "assets/js/faith-room.js",
  "assets/js/faith-shelves.js",
  "assets/js/faith-transparency.js",
  "assets/js/page/faith-bookmarks.js",
  "assets/js/admin-tfr-review.js",
];
const stragglers = [];
for (const file of CALLERS) {
  const text = await readFile(path.join(ROOT, file), "utf-8");
  if (!text.includes("cmpTitle")) stragglers.push(`${file} no longer routes its title sort through cmpTitle`);
  for (const line of text.split("\n")) {
    if (/title[^\n]*\.localeCompare\(/.test(line) && !line.includes("cmpTitle")) {
      stragglers.push(`${file}: a title still sorts with a bare localeCompare —\n      ${line.trim()}`);
    }
  }
}
if (stragglers.length) {
  console.error(`✗ ${stragglers.length} surface(s) sort titles outside the comparator.\n`);
  for (const s of stragglers) console.error(`  ${s}`);
  process.exit(1);
}

console.log(`✓ title order: 9 orderings, ${CALLERS.length} surfaces routed through the comparator.`);
