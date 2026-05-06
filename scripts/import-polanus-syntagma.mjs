#!/usr/bin/env node
// Parses the pdftotext -layout output of Polanus's Syntagma Liber I
// into the data/faith-received/polanus-syntagma.json shape
// (kind: library-books, one book per Liber, each book with chapters
// matching the Latin "Caputs"). Run after pdftotext extracts the
// .txt — see scripts/polanus-source/.
//
//   pdftotext -layout polanus-syntagma.pdf polanus-syntagma.txt
//   node scripts/import-polanus-syntagma.mjs
//
// Currently the source PDF only contains Liber I (47 caputs). When
// further Libri ship as separate PDFs, extend SOURCE_FILES and the
// per-Liber config table.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const SOURCE_DIR = path.join(import.meta.dirname, "polanus-source");
const OUT_PATH = path.join(ROOT, "data", "faith-received", "polanus-syntagma.json");

const ROMAN_VALUES = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
function romanToInt(s) {
  if (!s) return 0;
  const str = s.toUpperCase();
  let total = 0;
  for (let i = 0; i < str.length; i++) {
    const cur = ROMAN_VALUES[str[i]] || 0;
    const next = ROMAN_VALUES[str[i + 1]] || 0;
    total += cur < next ? -cur : cur;
  }
  return total;
}

const LIBRI = [
  {
    bookNumber: 1,
    bookTitle: "Liber I — De Theologiae Principiis",
    sourceFile: "polanus-syntagma.txt",
    bodyStartMarker: /^Liber I - De Theologiae Principiis\s*$/, // header line in body
    indexStartMarker: /^\s*INDEX OF SCRIPTURE\s*$/,
  },
];

// Strip pdftotext-layout artefacts from a body line:
// - Bare page-number lines: whitespace + 1–3 digits + whitespace
// - Footnote-separator markers
// - Trailing whitespace
const isPageNumber = (line) => /^\s*\d{1,4}\s*$/.test(line);
const isFootnoteStart = (line) => /^\s{0,6}\d{1,3}\.\s/.test(line);
const isCaputHeader = (line) => /^\s*Caput\s+([IVXLCDM]+)\s*[-–]/.test(line);

// Reformat the per-page text into clean paragraphs:
// 1. Drop page-number lines.
// 2. Cut any footnote block — once a line matches isFootnoteStart, skip
//    everything until the next blank line (so multi-line footnotes are
//    fully removed). Some footnote blocks span across the page break;
//    we treat each footnote as ending at the next blank line.
// 3. Group remaining lines into paragraphs separated by blank lines.
function cleanCaputBody(rawLines) {
  // Pass 1: drop page numbers and footnote blocks.
  const kept = [];
  let inFootnote = false;
  for (const line of rawLines) {
    if (inFootnote) {
      if (line.trim() === "") {
        inFootnote = false;
        kept.push("");
      }
      continue;
    }
    if (isPageNumber(line)) {
      kept.push(""); // treat page break as paragraph break
      continue;
    }
    if (isFootnoteStart(line)) {
      inFootnote = true;
      continue;
    }
    kept.push(line);
  }

  // Pass 2: group consecutive non-blank lines into paragraphs.
  const paragraphs = [];
  let buf = [];
  for (const line of kept) {
    if (line.trim() === "") {
      if (buf.length) {
        paragraphs.push(buf.join(" ").replace(/\s+/g, " ").trim());
        buf = [];
      }
      continue;
    }
    buf.push(line.trim());
  }
  if (buf.length) {
    paragraphs.push(buf.join(" ").replace(/\s+/g, " ").trim());
  }

  // Drop footnote-reference superscripts that ended up trailing words
  // (e.g. "...the archetype.12 Therefore..." → "...the archetype.")
  // Heuristic: a digit immediately following a sentence-ending
  // punctuation and preceded by no space.
  return paragraphs
    .map((p) => p.replace(/([.\?!"\)])(\d{1,3})(?=\s|$)/g, "$1"))
    .filter((p) => p.length > 0);
}

async function parseLiber(cfg) {
  const text = await readFile(path.join(SOURCE_DIR, cfg.sourceFile), "utf-8");
  const lines = text.split("\n");

  // Find body start: skip the title page + TOC. The TOC is marked by
  // header "Liber I - De Theologiae Principiis" (occurs once before
  // the body content), then the first "Caput I -" body line follows.
  let bodyStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (cfg.bodyStartMarker.test(lines[i])) {
      // Skip past the TOC after this header — the body's first
      // "Caput I -" line is the next "Caput I - " full title line
      // *with body text* following. The TOC entries are also
      // "Caput I -" but they don't have a substantial body.
      // Heuristic: search for the FIRST "^Caput I - " line that's
      // followed (within ~3 lines) by a line of body text starting
      // with capital letters and no Roman numeral.
      for (let j = i + 1; j < lines.length; j++) {
        const m = lines[j].match(/^\s*Caput\s+I\s+[-–]/);
        if (!m) continue;
        // Look ahead for a body line — should be substantive prose.
        let next = j + 1;
        while (next < j + 6 && next < lines.length && lines[next].trim() === "") next++;
        if (next < lines.length && lines[next].trim().length > 30) {
          bodyStart = j;
          break;
        }
      }
      break;
    }
  }
  if (bodyStart < 0) throw new Error(`Body start not found for ${cfg.bookTitle}`);

  // Find body end: where the Index begins.
  let bodyEnd = lines.length;
  for (let i = bodyStart; i < lines.length; i++) {
    if (cfg.indexStartMarker.test(lines[i])) {
      bodyEnd = i;
      break;
    }
  }

  // Walk through the body, splitting at "Caput X - Title" headers.
  const chapters = [];
  let curHeader = null;
  let curStart = -1;
  for (let i = bodyStart; i < bodyEnd; i++) {
    const line = lines[i];
    const m = line.match(/^\s*Caput\s+([IVXLCDM]+)\s*[-–]\s*(.*)$/);
    if (!m) continue;

    // Title may span multiple lines; collect until the next blank line.
    let title = m[2].trim();
    let j = i + 1;
    while (j < bodyEnd && lines[j].trim() !== "" && !isCaputHeader(lines[j])) {
      title += " " + lines[j].trim();
      j++;
    }
    title = title.replace(/\s+/g, " ").trim();

    // Close the previous caput.
    if (curHeader !== null) {
      const body = cleanCaputBody(lines.slice(curStart, i));
      chapters.push({ ...curHeader, paragraphs: body });
    }

    curHeader = {
      number: romanToInt(m[1]),
      roman: m[1],
      title,
    };
    curStart = j;
    i = j - 1; // jump to where title ended; for-loop will i++
  }
  // Close the final caput.
  if (curHeader !== null) {
    const body = cleanCaputBody(lines.slice(curStart, bodyEnd));
    chapters.push({ ...curHeader, paragraphs: body });
  }

  return {
    bookNumber: cfg.bookNumber,
    bookTitle: cfg.bookTitle,
    chapters,
  };
}

const books = [];
for (const cfg of LIBRI) {
  const book = await parseLiber(cfg);
  console.log(`Parsed ${cfg.bookTitle}: ${book.chapters.length} caputs`);
  for (const c of book.chapters) {
    const totalChars = c.paragraphs.reduce((s, p) => s + p.length, 0);
    console.log(`  Caput ${c.roman} (${c.number}) — ${c.paragraphs.length} paragraphs, ${totalChars} chars — ${c.title.slice(0, 60)}…`);
  }
  books.push(book);
}

const doc = {
  slug: "polanus-syntagma",
  title: "Syntagma Theologiae Christianae",
  author: "Amandus Polanus von Polansdorf",
  date: "1615",
  description:
    "The first fully systematic Reformed scholastic theology, organised on the Ramist bifurcating method by Amandus Polanus von Polansdorf (1561–1610), professor at Basel. The Syntagma covers all loci of dogmatics across ten books and was the leading textbook of the early Reformed orthodoxy, drawn upon by virtually every later Reformed scholastic.",
  category: "library",
  kind: "library-books",
  books,
};

await writeFile(OUT_PATH, JSON.stringify(doc, null, 2));
console.log(`\nWrote ${OUT_PATH}`);
