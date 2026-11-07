#!/usr/bin/env node
// Every book abbreviation the citation resolver knows must resolve in
// every form a citation is actually written in.
//
// WHY THIS EXISTS. `faith-resolve.js` turns the editors' apparatus into
// links: 3,235 citations in the Confessions alone, and far more across
// Migne. Both ways it can fail are silent.
//
//   A citation that does not resolve stays plain text. Nobody reports
//   it, because an unlinked reference looks exactly like a reference
//   the editors never linked. Nineteen aliases were in that state —
//   Prov., Gal., Phil., Col., Rev., Mal., Lev., Mic., Luc., Marc. and
//   Apoc. among them — because the roman-numeral branch of the pattern
//   ate the last letter of any abbreviation ending in i, v, x, l or c
//   whenever it was written with the period it is normally written
//   with. They all worked without the period, which is why it survived.
//
//   A citation that resolves to the WRONG book is worse: the reader
//   follows it and lands somewhere else with nothing to tell them so.
//   Six short forms are also ordinary structural abbreviations in the
//   Latin apparatus this library is mostly made of — col. (columna),
//   num./nu. (numero), tit. (titulus), act. (actus) — and "is", which
//   is a word. Those count as Scripture only on an explicit verse.
//
// Neither failure raises anything at runtime, so this is the only place
// either of them can be caught.
//
// Run: npm run check:citations

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = "assets/js/faith-resolve.js";

const src = await readFile(path.join(ROOT, SOURCE), "utf-8");

// The module is an IIFE that publishes itself on `window` and returns
// early unless `window.MOCorpora` is present. Give it just enough of a
// browser to reach its own export rather than keeping a second copy of
// the parser in sync here.
// faith-resolve.js asks MOCorpora.url() for each corpus's refindex at
// load time (since 8550f3fb, 2026-10-01), so the stub needs that one
// method. The parser under test never fetches, so the path is enough.
const win = { MOCorpora: { url: (_id, p) => p } };
const doc = {
  querySelector: () => null,
  addEventListener: () => {},
  createElement: () => ({
    style: {}, classList: { add() {} }, appendChild() {}, setAttribute() {},
  }),
};
globalThis.fetch = () => Promise.resolve({ ok: false });
new Function("window", "document", src)(win, doc);

if (!win.MOResolve || typeof win.MOResolve.parse !== "function") {
  console.error(`✗ ${SOURCE}: the IIFE did not publish window.MOResolve.parse.`);
  console.error("  The early return at the top (`if (!window.MOCorpora) return;`)");
  console.error("  or the export at the bottom has moved.");
  process.exit(1);
}
const { parse } = win.MOResolve;

// The book table, lifted from the same file so this can never drift out
// of step with what the resolver actually knows.
const tableSrc = src.match(/const BOOKS = \{[\s\S]*?\n {2}\};/);
if (!tableSrc) {
  console.error(`✗ ${SOURCE}: could not find the BOOKS table.`);
  process.exit(1);
}
const BOOKS = new Function(`${tableSrc[0]}\nreturn BOOKS;`)();

// Keep in step with AMBIGUOUS_ABBR in the source.
const AMBIGUOUS = new Set(["col", "num", "nu", "tit", "act", "is"]);

const failures = [];
let checked = 0;

// Every alias, in the four ways a citation gets written: with and
// without the abbreviation's period, with and without an explicit verse.
for (const [canon, aliases] of Object.entries(BOOKS)) {
  for (const alias of [canon, ...aliases]) {
    for (const form of [`${alias} 5`, `${alias}. 5`, `${alias} 5:3`, `${alias}. 5:3`]) {
      checked += 1;
      const got = parse(form);
      const bare = !form.includes(":");

      if (AMBIGUOUS.has(alias.toLowerCase()) && bare) {
        if (got) {
          failures.push(`"${form}" resolved to ${got.label}; an ambiguous short form without a verse must not resolve`);
        }
        continue;
      }
      if (!got) {
        failures.push(`"${form}" did not resolve; expected ${canon}`);
        continue;
      }
      if (got.book.toLowerCase() !== canon.toLowerCase()) {
        failures.push(`"${form}" resolved to ${got.book}; expected ${canon}`);
      }
    }
  }
}

// The specific cases behind this check, named so a regression says which
// rule it broke rather than only which string moved.
const CASES = [
  // The period must not cost an abbreviation its last letter.
  ["Apoc. 21", "Revelation 21"],
  ["Prov. 8", "Proverbs 8"],
  ["Gal. 3", "Galatians 3"],
  ["Phil. 2", "Philippians 2"],
  ["Mal. 3", "Malachi 3"],
  ["Lev. 19", "Leviticus 19"],
  ["Mic. 5", "Micah 5"],
  // Col. ends in a roman-numeral letter too, but `col` is ambiguous
  // (columna), so it is covered below rather than here: the period fix
  // alone is not enough to make it resolve, and should not be.
  // The Vulgate runs Samuel and Kings straight through as 1-4 Regum.
  ["4 Reg. 5", "2 Kings 5"],
  ["iv reg 5", "2 Kings 5"],
  // Ambiguous bare forms are not Scripture.
  ["num. 5", null],
  ["nu. 7", null],
  ["tit. 3", null],
  ["col. 5", null],
  ["act. 4", null],
  ["is 3", null],
  // The same books resolve when the citation is unambiguous.
  ["Num 5:3", "Numbers 5:3"],
  ["Numbers 5", "Numbers 5"],
  ["Tit 3:5", "Titus 3:5"],
  ["Colossians 5", "Colossians 5"],
  ["Acts 4", "Acts 4"],
  ["Isaiah 3", "Isaiah 3"],
  // Forms that were already right and must stay right.
  ["Rom. ix. 16", "Romans 9:16"],
  ["1 Cor 3", "1 Corinthians 3"],
  ["Gen 3:16", "Genesis 3:16"],
];

for (const [input, expected] of CASES) {
  checked += 1;
  const got = parse(input);
  const label = got && got.kind === "scripture" ? got.label : null;
  if (label !== expected) {
    failures.push(`"${input}" gave ${label === null ? "no match" : label}; expected ${expected === null ? "no match" : expected}`);
  }
}

// Migne citations share the parser and must not be disturbed by any of it.
for (const [input, expected] of [
  ["PL 176, 17c", "PL 176, 17c"],
  ["PG 78, 1709", "PG 78, 1709"],
  ["PL176:17", "PL 176, 17"],
]) {
  checked += 1;
  const got = parse(input);
  if (!got || got.kind !== "migne" || got.label !== expected) {
    failures.push(`"${input}" did not parse as Migne ${expected}; got ${got ? `${got.kind} ${got.label}` : "no match"}`);
  }
}

if (failures.length) {
  console.error(`✗ ${SOURCE}: ${failures.length} of ${checked} citation forms are wrong.\n`);
  for (const f of failures.slice(0, 40)) console.error(`  ${f}`);
  if (failures.length > 40) console.error(`  … and ${failures.length - 40} more`);
  process.exit(1);
}

console.log(`✓ citation parser: ${checked} forms, all correct.`);
