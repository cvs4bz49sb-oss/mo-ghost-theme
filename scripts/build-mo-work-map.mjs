#!/usr/bin/env node
/*
 * assets/data/faith-received/mo-article-works.json: which library works are by an author the Mere Orthodoxy essays are about (2026-10-20).
 *
 * The essays are tied to an author by name (mo-articles.json idx.author) but a work page knows only its slug, and the library's catalogue
 * (the worker's v1/works-index.json, 19k works, 7MB) is far too large for a page to fetch. This builds the small join: for every work
 * whose author has essays, the work's slug -> that author's name as the essays index it. The work page and the reader's Research rail
 * use it to show "On <Author>, who wrote this work" (assets/js/lib/mo-articles-module.js, pick.work).
 *
 *   node scripts/build-mo-work-map.mjs                  fetch the catalogues from the worker and write the file
 *   node scripts/build-mo-work-map.mjs --from <dir>     read works-index.json and mo-index.json from <dir> instead (offline)
 *
 * Run it again whenever the essays gain an author or the library gains works. Fragments, prefaces and works are all included;
 * apparatus (indexes, tables) and works of uncertain author are not.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const OUT = path.join(ROOT, "assets/data/faith-received/mo-article-works.json");
const BASE = process.env.FR_BLOB_BASE || "https://mo-tfr-library.mo-podcast-feed.workers.dev";
const fromIdx = process.argv.indexOf("--from");
const from = fromIdx > 0 ? process.argv[fromIdx + 1] : "";

const get = async (name) => {
  if (from) return JSON.parse(fs.readFileSync(path.join(from, name), "utf8"));
  const r = await fetch(`${BASE}/v1/${name === "mo-index.json" ? "mo/index.json" : name}`, { headers: { "User-Agent": "Mozilla/5.0 (mo-theme build)" } });
  if (!r.ok) throw new Error(`${name}: ${r.status}`);
  return r.json();
};

const fold = (s) => String(s || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/data/faith-received/mo-articles.json"), "utf8"));
const names = Object.keys(data.idx.author).sort();
const byFold = new Map(names.map((n, i) => [fold(n), i]));

const works = {};
const take = (list) => {
  for (const w of list) {
    if (!w || !w.slug || w.kind === "apparatus") continue;
    const i = byFold.get(fold(w.author_en || w.author));
    if (i !== undefined) works[w.slug] = i;
  }
};
take((await get("works-index.json")).works || []);
take((await get("mo-index.json")).works || []);

const sorted = Object.fromEntries(Object.keys(works).sort().map((k) => [k, works[k]]));
const out = {
  v: 1,
  note: "work slug -> index into `authors` (the names mo-articles.json idx.author uses). Built by scripts/build-mo-work-map.mjs from the library catalogues; not hand-edited.",
  authors: names,
  works: sorted,
};
fs.writeFileSync(OUT, `${JSON.stringify(out)}\n`);
const per = {};
Object.values(sorted).forEach((i) => { per[names[i]] = (per[names[i]] || 0) + 1; });
console.log(`wrote ${path.relative(ROOT, OUT)}: ${Object.keys(sorted).length} works by ${Object.keys(per).length} of ${names.length} authors with essays`);
