#!/usr/bin/env node
/*
 * Harvest a modern English lexicon from the library's own translations.
 *
 * The orthography modernizer needs to know whether a word it has just
 * produced is a real modern word. "wyth" to "with" is right; "type" to
 * "tipe" is the same rule applied to a word that was never archaic, and
 * without a dictionary there is no way to tell the two apart.
 *
 * The dictionary comes from the library rather than from outside it.
 * The Latin Library ships a modern English translation beside every
 * Latin page, which is modern prose written by this project, in exactly
 * the theological vocabulary the reader will meet. A general word list
 * would know "type" and not "Sabellianism".
 *
 *   node scripts/build-modern-lexicon.mjs [--works 400]
 *
 * Output: assets/data/faith-received/modern-words.txt, one word per
 * line, words seen in at least MIN_WORKS separate works so that a
 * scanning error in one volume cannot enter the dictionary.
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const BLOB = "https://0ss8v4l06kodnhp0.public.blob.vercel-storage.com";
const OUT = path.join(ROOT, "assets/data/faith-received/modern-words.txt");

// Three was too low: "sut" and "hym" reached it from quoted archaic
// passages, and one junk entry is a wrong rewrite on every page that
// holds the word it captures. Five, over a wider sample, costs a few
// rare words and buys a dictionary that can be trusted to say no.
const MIN_WORKS = 5;
const MIN_LEN = 2;
// A word has to be this well attested before a rewrite is allowed to
// produce it.
const COMMON_WORKS = 20;

const args = process.argv.slice(2);
const WORKS = parseInt(args[args.indexOf("--works") + 1], 10) || 900;

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

const seenIn = new Map(); // word -> number of works it appeared in

function harvest(text, local) {
  const words = String(text || "").toLowerCase().match(/[a-z][a-z']*/g) || [];
  for (const w of words) {
    if (w.length < MIN_LEN) continue;
    local.add(w.replace(/'s$/, ""));
  }
}

const idx = await getJSON(`${BLOB}/v1/works-index.json`);
// Spread across the shelf: taking the first N would be four authors.
const all = idx.works.filter((w) => w.has_pages && w.en_chars > 20000);
const step = Math.max(1, Math.floor(all.length / WORKS));
const picks = [];
for (let i = 0; i < all.length && picks.length < WORKS; i += step) picks.push(all[i]);

console.log(`harvesting from ${picks.length} works of ${all.length}`);

let done = 0;
let failed = 0;

async function scan(w) {
  const local = new Set();
  try {
    const meta = await getJSON(`${BLOB}/v1/works/${w.slug}/meta.json`);
    const files = meta.shards && meta.shards.length
      ? meta.shards.slice(0, 3).map((s) => s.file)   // two shards is plenty of prose
      : [meta.single || "work.json"];
    for (const f of files) {
      const d = await getJSON(`${BLOB}/v1/works/${w.slug}/${f}`);
      for (const p of (d.pages || d)) harvest(p.en, local);
    }
  } catch {
    failed += 1;
    return;
  }
  local.forEach((word) => seenIn.set(word, (seenIn.get(word) || 0) + 1));
  done += 1;
  if (done % 25 === 0) console.log(`  ${done}/${picks.length}  ${seenIn.size.toLocaleString()} distinct`);
}

const queue = picks.slice();
await Promise.all(Array.from({ length: 12 }, async () => {
  while (queue.length) await scan(queue.pop());
}));

// Two tiers, because the two questions are not the same question.
//
// "Is this already a modern word, leave it alone?" should be answered
// generously: a rare word wrongly called archaic gets rewritten into
// something else, which is the worst outcome.
//
// "Is this a good word to rewrite towards?" should be answered
// strictly. Held to the low bar, "menne" became "mene" and "sute"
// became "sut", both real entries harvested from a handful of quoted
// passages, and both beat the right answer by being one step nearer.
const known = [...seenIn.entries()].filter(([, n]) => n >= MIN_WORKS);
const common = known.filter(([, n]) => n >= COMMON_WORKS).map(([w]) => w).sort();
const rest = known.filter(([, n]) => n < COMMON_WORKS).map(([w]) => w).sort();
const body = `${common.join("\n")}\n---\n${rest.join("\n")}`;

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, body);
console.log(`\n${done} works scanned, ${failed} failed`);
console.log(`${seenIn.size.toLocaleString()} distinct, ${known.length.toLocaleString()} known (>= ${MIN_WORKS} works)`);
console.log(`${common.length.toLocaleString()} common (>= ${COMMON_WORKS} works) — the only words a rewrite may produce`);
console.log(`written to ${path.relative(ROOT, OUT)} (${(body.length / 1024).toFixed(0)} KB)`);
