#!/usr/bin/env node
/*
 * Build the daily catechism rotation.
 *
 * The front door of The Faith Received needs something that asks
 * nothing of the visitor — no browsing, no choosing, no knowing what a
 * "locus" is. A catechism question a day is the natural fit: it is
 * already written in exactly that form, it is devotional on its own
 * terms, and reading it is how someone discovers the confessional
 * corpus without being told to go browse it.
 *
 * Heidelberg is 129 questions and Westminster Shorter is 107. Together
 * that is 236 — more than a year, so nobody sees a repeat inside a
 * twelvemonth.
 *
 *   node scripts/build-catechism-daily.mjs
 *
 * Reads the generated partials (the same text the document pages
 * serve, so the daily reading and the full document can never drift)
 * and writes assets/data/faith-received/catechism-daily.json.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const PARTIALS = path.join(ROOT, "partials", "faith-received");
const OUT = path.join(ROOT, "assets", "data", "faith-received", "catechism-daily.json");

const SOURCES = [
  { slug: "heidelberg", label: "The Heidelberg Catechism", year: "1563" },
  { slug: "westminster-shorter", label: "The Westminster Shorter Catechism", year: "1647" },
];

const strip = (html) =>
  html
    .replace(/<button[\s\S]*?<\/button>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&mdash;/g, "—")
    .replace(/&middot;/g, "·")
    .replace(/&hellip;/g, "…")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

async function extract(source) {
  const html = await readFile(path.join(PARTIALS, `${source.slug}.hbs`), "utf8");
  const out = [];
  // Each Q&A is a question heading followed by its answer block. The
  // enclosing <article> carries the anchor the document page uses, so
  // "read it in full" lands on the same question.
  const re = /<article[^>]*id="(q-\d+)"[\s\S]*?<h3 class="faith-qa-question">([\s\S]*?)<\/h3>\s*<div class="faith-qa-answer[^"]*">([\s\S]*?)<\/div>/g;
  let m;
  while ((m = re.exec(html))) {
    const question = strip(m[2]);
    const answer = strip(m[3]);
    if (!question || !answer) continue;
    out.push({
      source: source.slug,
      sourceLabel: source.label,
      year: source.year,
      n: parseInt(m[1].replace(/^q-/, ""), 10),
      anchor: m[1],
      question,
      answer,
    });
  }
  return out;
}

const all = [];
for (const s of SOURCES) {
  const found = await extract(s);
  console.log(`${s.slug}: ${found.length} questions`);
  all.push(...found);
}

if (!all.length) {
  console.error("No questions extracted — the partial markup has changed.");
  process.exit(1);
}

// Interleave the two catechisms rather than running one then the
// other, so a reader who visits for a fortnight meets both traditions
// rather than four months of Heidelberg before Westminster appears.
const bySource = SOURCES.map((s) => all.filter((q) => q.source === s.slug));
const rotation = [];
for (let i = 0; i < Math.max(...bySource.map((l) => l.length)); i += 1) {
  bySource.forEach((list) => { if (list[i]) rotation.push(list[i]); });
}

await writeFile(OUT, JSON.stringify({ v: 1, count: rotation.length, questions: rotation }));
const bytes = (await readFile(OUT)).length;
console.log(`\n${rotation.length} questions → ${path.relative(ROOT, OUT)} (${(bytes / 1024).toFixed(0)} KB)`);
console.log(`${(rotation.length / 365).toFixed(1)} years before a repeat.`);
