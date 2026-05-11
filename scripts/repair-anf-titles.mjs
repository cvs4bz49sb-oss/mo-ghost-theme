// Repair truncated ANF chapter titles.
//
// Many sub-page titles from Wikisource were split: the TOC link label
// became the title and the continuation ended up as the first paragraph.
// This script detects and repairs those splits.
//
// Patterns handled:
//   1. Title is partial, first paragraph continues it (e.g. "Of the" + "Unction.")
//   2. Title is just a Roman numeral, first paragraph has "Chapter N.—Real Title."
//   3. Title is "Chapter N", first paragraph has the full heading or is just "N."
//
//   node scripts/repair-anf-titles.mjs
//
// After running, rebuild:
//   node scripts/build-faith-received.mjs

import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const DATA_DIR = path.join(ROOT, "data", "faith-received");

const files = (await readdir(DATA_DIR)).filter(
  (f) => f.startsWith("anf-") && f.endsWith(".json")
);

let totalFixed = 0;
let totalChapters = 0;

for (const file of files) {
  const filePath = path.join(DATA_DIR, file);
  const doc = JSON.parse(await readFile(filePath, "utf-8"));
  let docFixed = 0;

  const processChapters = (chapters) => {
    if (!chapters) return;
    for (const c of chapters) {
      totalChapters++;
      if (!c.paragraphs || c.paragraphs.length === 0) continue;

      const origTitle = c.title;
      const p0 = c.paragraphs[0];

      // Pattern 1: First paragraph is "Chapter N.—Full Title Here."
      // The title field is just "Chapter N" or a Roman numeral or "N"
      const chapterHeadingMatch = p0.match(
        /^Chapter\s+([IVXLC0-9]+)\.?\s*(?:—|\.—|[-–—])\s*(.+?)\.?\s*$/
      );
      if (chapterHeadingMatch) {
        const newTitle = chapterHeadingMatch[2].trim().replace(/\.$/, "");
        if (newTitle && newTitle.length > origTitle.length) {
          c.title = newTitle;
          c.paragraphs.shift(); // Remove the heading paragraph
          docFixed++;
          continue;
        }
      }

      // Pattern 1b: First paragraph is just "N." (Roman numeral repeated)
      // or "Chapter N." with no title
      if (/^[IVXLC]+\.?\s*$/.test(p0) || /^Chapter\s+[IVXLC0-9]+\.?\s*$/.test(p0)) {
        // This is just a redundant heading — remove it but don't change title
        c.paragraphs.shift();
        continue;
      }

      // Pattern 2: Title looks truncated (ends mid-phrase) and first paragraph
      // continues it. Detect by checking if title doesn't end with a complete
      // word pattern and p0 starts lowercase or is very short.
      const titleLooksComplete =
        /[.!?:;]$/.test(origTitle) || // Ends with punctuation
        /^[IVXLC]+$/.test(origTitle) || // Just a Roman numeral
        /^Chapter\s+[IVXLC0-9]+$/.test(origTitle) || // "Chapter N"
        origTitle === "Introduction" ||
        origTitle === "Preface" ||
        origTitle === "Postscript" ||
        origTitle === "Prologue" ||
        origTitle === "Appendix" ||
        origTitle === "General Introduction" ||
        origTitle === "Text";

      if (!titleLooksComplete) {
        // Title ends with a preposition, article, or conjunction — very strong
        // signal of truncation regardless of paragraph length
        const endsWithConnector =
          /\b(?:of|the|a|an|and|or|to|for|in|on|by|with|from|at|without|against|that|than|into|upon|over|under|about|between|through|after|before|during)\s*$/i.test(origTitle);

        // Check if first paragraph is a continuation
        // Short title (≤30 chars, ≤4 words) + paragraph that looks like a subtitle
        // (title-case, ends with period, no "we"/"I"/"the" sentence starters)
        const titleIsShort = origTitle.length <= 30 && origTitle.split(/\s+/).length <= 4;
        const p0LooksLikeSubtitle = titleIsShort &&
          p0.length < 250 &&
          /^[A-Z]/.test(p0) &&
          // Not a body paragraph: doesn't start with common sentence patterns
          !/^(?:We |I |The |In |It |He |She |They |This |That |But |For |And |If |Now |As |So )/i.test(p0.slice(0,4) === p0.slice(0,4).toUpperCase() ? "SKIP" : p0);
        const isShortContinuation =
          p0.length < 250 &&
          !p0.includes("\n") &&
          // Either starts lowercase, or title ends with connector,
          // or title is short and p0 looks like a subtitle continuation
          (/^[a-z]/.test(p0) || endsWithConnector || p0LooksLikeSubtitle ||
            (p0.length < 100 && !p0.match(/^[A-Z][a-z].*[.!?].*[.!?].*[.!?]/)));

        if (isShortContinuation) {
          // Merge: "Of the" + "Unction." → "Of the Unction"
          let merged = origTitle + " " + p0;
          // Clean up trailing period
          merged = merged.replace(/\.\s*$/, "").trim();
          c.title = merged;
          c.paragraphs.shift();
          docFixed++;
          continue;
        }
      }

      // Pattern 3: Title is "Chapter N" but first paragraph has
      // "Chapter N.—Title." inline. Extract the title.
      if (/^Chapter\s+[IVXLC0-9]+$/.test(origTitle)) {
        const inlineMatch = p0.match(
          /^(?:Chapter\s+)?([IVXLC0-9]+)\.?\s*(?:—|\.—|[-–—])\s*(.+?)\.?\s*$/
        );
        if (inlineMatch) {
          const newTitle = inlineMatch[2].trim().replace(/\.$/, "");
          if (newTitle) {
            c.title = newTitle;
            c.paragraphs.shift();
            docFixed++;
            continue;
          }
        }
      }
    }
  };

  if (doc.kind === "library-chapters") {
    processChapters(doc.chapters);
  } else if (doc.kind === "library-books") {
    for (const b of doc.books || []) {
      processChapters(b.chapters);
    }
  } else if (doc.kind === "library-sections") {
    // Sections use .text not .paragraphs — less likely to have this issue
    // but check anyway
  }

  if (docFixed > 0) {
    await writeFile(filePath, JSON.stringify(doc, null, 2) + "\n");
    console.log(`  ${file}: fixed ${docFixed} titles`);
    totalFixed += docFixed;
  }
}

console.log(`\nTotal: fixed ${totalFixed} titles across ${totalChapters} chapters`);
console.log(`Run 'node scripts/build-faith-received.mjs' to rebuild.`);
