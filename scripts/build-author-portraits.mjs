#!/usr/bin/env node
/*
 * Which authors have a portrait the author room can show, and the credit each one needs.
 *
 * The shelf guides carry the portraits (assets/data/faith-received/guides/portraits/*.jpg) and, in each guide's `portraits` map, who made
 * each picture, when, under what licence and where it came from. The author room (faith-author-redesign.js) reads one small file instead
 * of fourteen guides:
 *
 *   p      portrait slug -> { n name, f file (with its content hash, as the Verse Desk uses it), k kind, a artist, d date, l licence, u source }
 *   by     folded author name -> portrait slug (rooms whose slug is spelled differently from the portrait's)
 *   alias  room slug -> portrait slug, for the few names the folds cannot join
 *
 *   node scripts/build-author-portraits.mjs           write assets/data/faith-received/author-portraits.json
 *   node scripts/build-author-portraits.mjs --check   fail if the committed file is stale or names a missing picture
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GUIDES = path.join(ROOT, "assets/data/faith-received/guides");
const OUT = path.join(ROOT, "assets/data/faith-received/author-portraits.json");

// Room slugs that differ in more than spelling from the portrait's name.
const ALIAS = {
  "pietro-martire-vermigli": "peter-martyr-vermigli",
  "poinsot-john-of-st-thomas": "john-of-st-thomas",
  "theodore-the-studite": "theodori-studit",
  jerome: "jerome-of-stridon",
};

const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
// "Unknown author Unknown author" -> "Unknown artist"; "17 th century" -> "17th century"
const tidyArtist = (s) => {
  const t = String(s || "").trim();
  const half = t.length % 2 === 0 ? t.slice(0, t.length / 2) : "";
  const once = half && t === `${half}${half}` ? half : (/^(.+?)\s+\1$/.exec(t) || [])[1] || t;
  return /^unknown/i.test(once) ? "Unknown artist" : once;
};
const tidyDate = (s) => String(s || "").trim().replace(/(\d)\s+(st|nd|rd|th)\b/gi, "$1$2");

const p = {};
for (const f of fs.readdirSync(GUIDES).filter((x) => x.endsWith(".json")).sort()) {
  let d;
  try { d = JSON.parse(fs.readFileSync(path.join(GUIDES, f), "utf8")); } catch (_) { continue; }
  const ps = d && typeof d === "object" && !Array.isArray(d) ? d.portraits : null;
  if (!ps || typeof ps !== "object") continue;
  for (const [name, v] of Object.entries(ps)) {
    if (!v || !v.src) continue;
    const slug = path.basename(v.src.split("?")[0], ".jpg");
    if (p[slug]) continue;
    p[slug] = { n: name, f: v.src, k: v.kind || "portrait", a: tidyArtist(v.artist), d: tidyDate(v.date), l: v.license || "", u: v.url || "" };
  }
}
const sorted = Object.fromEntries(Object.keys(p).sort().map((k) => [k, p[k]]));
const by = {};
for (const [slug, v] of Object.entries(sorted)) by[fold(v.n)] = slug;
const text = `${JSON.stringify({ v: 1, note: "Built by scripts/build-author-portraits.mjs from the shelf guides. Do not edit by hand.", p: sorted, by, alias: ALIAS })}\n`;

if (process.argv.includes("--check")) {
  const bad = [];
  if (!fs.existsSync(OUT) || fs.readFileSync(OUT, "utf8") !== text) bad.push("author-portraits.json is stale: run node scripts/build-author-portraits.mjs");
  for (const [slug, v] of Object.entries(sorted)) if (!fs.existsSync(path.join(GUIDES, v.f.split("?")[0]))) bad.push(`${slug}: ${v.f} is not in the portraits folder`);
  for (const [room, slug] of Object.entries(ALIAS)) if (!sorted[slug]) bad.push(`alias ${room} names ${slug}, which has no portrait`);
  if (bad.length) { console.error(`build-author-portraits: ${bad.length} problem(s)\n - ${bad.join("\n - ")}`); process.exit(1); }
  console.log(`build-author-portraits: ok (${Object.keys(sorted).length} portraits)`);
} else {
  fs.writeFileSync(OUT, text);
  console.log(`wrote ${path.relative(ROOT, OUT)} (${Object.keys(sorted).length} portraits)`);
}
