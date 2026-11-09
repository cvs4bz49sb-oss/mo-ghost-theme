#!/usr/bin/env node
/*
 * The verses the Controversies page links to the Scripture desk (assets/js/faith-controversies.js, "Scripture references",
 * 2026-11-08; owner: "integrate the commentaries and controversies (thomists vs scotist) pages in the mereO site"; the plan: "a verse
 * cited in a controversy opens the Scripture desk").
 *
 * WHY A GUARD. A verse rendered as a link must be a real one: the book, the chapter and the verse read from the text, never guessed.
 * The linker is a block inside a browser file with no exports, so it is lifted out between its two banner comments and evaluated here,
 * as check-scripture-linker.mjs lifts the reader's. Its book table must agree with the Scripture desk's (scripture-dev-core.js CANON and
 * APOCRYPHA: the slugs its ?ref= reads and each book's chapters), or a link would open the wrong book or a chapter the desk refuses.
 *
 * Run: node scripts/check-controversy-verses.mjs
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = "assets/js/faith-controversies.js";
const src = readFileSync(join(ROOT, SRC), "utf8");
const START = "/* ── Scripture references ──", END = "/* ── end Scripture references ── */";
const a = src.indexOf(START), b = src.indexOf(END);
if (a < 0 || b < a) { console.error(`✗ ${SRC}: the "Scripture references" block's banners were not found.`); process.exit(1); }
const L = new Function(`${src.slice(a, b)}\nreturn { VERSE_BOOKS, VERSE_FORM, verseRefs, verseHref };`)();

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass += 1; else { fail += 1; console.log(`  FAIL ${msg}`); } };
const refs = (t) => L.verseRefs(t).map((r) => `${r.slug}.${r.c}.${r.v}`).join(" | ");

// [text, the references it must yield] (each from the controversies' own text or a form it uses)
const CASES = [
  ["Romans 5:12", "romans.5.12"],
  ["as Paul says (Rom. 5:12), death", "romans.5.12"],
  // a range opens at its first verse; the en dash too
  ["1 Cor. 11:24-26", "1-corinthians.11.24"],
  ["Titus 1:5–7", "titus.1.5"],
  ["Matthew 16:18-19 and John 20:23", "matthew.16.18 | john.20.23"],
  ["Acts 20:28, Philippians 1:1, 1 Timothy 3:2", "acts.20.28 | philippians.1.1 | 1-timothy.3.2"],
  ["II Thessalonians 2:4", "2-thessalonians.2.4"],
  ["I John 5:7", "1-john.5.7"],
  ["Gal. 6:6; Heb. 13:16-17", "galatians.6.6 | hebrews.13.16"],
  ["Hebr. 7:9", "hebrews.7.9"],
  ["Dan. 9:27 and 2 Thess. 2:4", "daniel.9.27 | 2-thessalonians.2.4"],
  // the deuterocanon as the desk names it
  ["Ecclesiasticus 11:2", "sirach.11.2"],
  ["2 Maccabees 12:43", "2-maccabees.12.43"],
  ["Song of Songs 2:4", "song-of-solomon.2.4"],
  ["Revelation 22:18", "revelation.22.18"],
  ["Jude 1:3", "jude.1.3"],
  // never the Psalms: the Vulgate's numbering and verse count are not the English Bible's
  ["Psalm 110:1", ""],
  ["Ps. 51:5", ""],
  ["Psalms 50:7", ""],
  // a book named in lower case is prose
  ["we mark 3:4 here", ""],
  ["john 3:16", ""],
  // a chapter the book does not have is no reference
  ["2 John 15:2", ""],
  ["Col. 1379:12", ""],
  ["Jude 2:1", ""],
  // the dotted and comma forms are left as text: chapter and verse are not certain in them
  ["Hebr. 7. 9", ""],
  ["Colossians 2, 2", ""],
  // a book's name inside a word is no book
  ["Johnson 3:16", ""],
  ["Romans 5", ""],
  // no verse past the longest chapter
  ["John 3:999", ""],
];
for (const [t, want] of CASES) ok(refs(t) === want, `${JSON.stringify(t)}: got "${refs(t)}", want "${want}"`);
ok(L.verseHref({ slug: "1-corinthians", c: 11, v: 24 }) === "/the-faith-received/scripture/?ref=1-corinthians.11.24", "a reference opens the Scripture desk at its verse");
// the link covers the reference as printed, from the book's name
{ const t = "see Rom. 5:12, where", r = L.verseRefs(t)[0]; ok(r && t.slice(r.start, r.end) === "Rom. 5:12", `the link's text is the reference as printed (got "${r && t.slice(r.start, r.end)}")`); }

// the book table against the Scripture desk's (scripture-dev-core.js), loaded with a stub document
globalThis.window = globalThis; globalThis.document = { querySelector: () => null };
createRequire(import.meta.url)(join(ROOT, "assets/js/page/scripture-dev-core.js"));
const S = globalThis.MOScriptureDev;
const desk = new Map(S.BOOKS.map((x) => [x.slug, x.chapters]));
const mine = new Map(L.VERSE_BOOKS.map(([slug, n]) => [slug, n]));
ok(desk.size === mine.size, `the table has ${mine.size} books, the Scripture desk ${desk.size}`);
for (const [slug, n] of desk) ok(mine.get(slug) === n, `${slug}: ${mine.get(slug)} chapters here, ${n} on the Scripture desk`);
// each form names one book, and each book's own name resolves on the desk
const seen = new Map();
for (const [slug, , forms] of L.VERSE_BOOKS) for (const f of forms.split("|")) { const k = f.toLowerCase(); ok(!seen.has(k), `"${f}" names both ${seen.get(k)} and ${slug}`); seen.set(k, slug); }
for (const [slug, , forms] of L.VERSE_BOOKS) { const full = forms.split("|")[0], bk = S.bookFrom(full); ok(bk && bk.slug === slug, `"${full}" is ${slug} on the Scripture desk (got ${bk && bk.slug})`); }

if (fail) { console.log(`\n✗ controversy verses: ${pass} passed, ${fail} failed.`); process.exit(1); }
console.log(`✓ controversy verses: ${pass} checks, every reference read as printed and every book as the Scripture desk has it.`);
