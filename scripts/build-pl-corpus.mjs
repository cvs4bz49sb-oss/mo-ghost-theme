#!/usr/bin/env node
/*
 * Bake Patrologia Latina into The Faith Received's own shape.
 *
 * PL is the one corpus whose text we could not reach: the source site
 * 401s on everything but /data/. The owner's port handoff supplied the
 * unlock key, and the pages behind it turn out to carry BOTH lanes —
 * Migne's Latin in `.tx` and a machine English layer in `.blk-mt`,
 * per block, each with its Migne citation and a stable anchor id.
 *
 * So this does not proxy and it does not re-render. It crawls once
 * with the key held server-side, extracts to the same section/row
 * shape every other corpus in the reading room already produces, and
 * writes one JSON file per work for upload to R2. Readers then fetch
 * our JSON from our origin. The key never reaches a browser — which
 * it would if the reader fetched the source pages directly, and which
 * is the whole reason for baking rather than proxying.
 *
 *   PL_KEY=… node scripts/build-pl-corpus.mjs [--limit N] [--force]
 *
 * Output goes OUTSIDE the repo by default. The theme has a hard size
 * budget and this is ~9,000 files; it belongs on R2, never in a
 * template. Set PL_OUT to choose the directory — do not point it at
 * anything Dropbox or iCloud syncs, which evict large writes to
 * 0-byte stubs mid-run (the owner's handoff warns about this, and we
 * lost a finished 372 MB index to exactly that on 2026-07-27).
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const BASE = "https://pld-patrologia-latina.vercel.app";
const KEY = process.env.PL_KEY || "";
const OUT_DIR = process.env.PL_OUT || path.join(os.tmpdir(), "mo-pl-corpus");
const CONCURRENCY = Number(process.env.PL_CONCURRENCY || 6);
const LIMIT = argNum("--limit", 0);
const FORCE = process.argv.includes("--force");

function argNum(flag, dflt) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : dflt;
}

if (!KEY) {
  console.error("PL_KEY is not set. The source site 401s without it.");
  process.exit(1);
}

// ── The gate ──────────────────────────────────────────────────────
// One ?key= visit sets an fr_gate cookie; every later fetch carries it.

let cookie = "";

async function unlock() {
  // Manual redirect: the unlock is a 303 and the Set-Cookie rides on
  // the redirect itself. Following it lands on a response that has no
  // cookie to read.
  const r = await fetch(`${BASE}/?key=${encodeURIComponent(KEY)}`, { redirect: "manual" });
  const raw = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
  cookie = raw.map((c) => c.split(";")[0]).join("; ");
  if (!cookie) throw new Error("no cookie returned — is the key still current?");
  const probe = await fetch(`${BASE}/read/1.html`, { headers: { cookie } });
  if (!probe.ok) throw new Error(`gate did not open: read/1.html ${probe.status}`);
}

async function getText(url, tries = 3) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const r = await fetch(url, { headers: { cookie } });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(String(r.status));
      return await r.text();
    } catch (err) {
      if (i === tries - 1) throw err;
      await new Promise((res) => { setTimeout(res, 600 * (i + 1)); });
    }
  }
  return null;
}

// ── Extraction ────────────────────────────────────────────────────
//
// Regex rather than a DOM: the markup is machine-generated and
// uniform (the owner's own extractor works the same way), and a
// parser over 9,000 documents costs minutes we do not need to spend.

const RE_DIVISION = /<div class="division"[^>]*id="([^"]*)"[^>]*>([\s\S]*?)(?=<div class="division"|<\/main>|$)/g;
const RE_DIVHEAD = /<div class="div-head"[^>]*>([\s\S]*?)<\/div>/;
// The class test has to end at a quote or a space. Written as
// `class="blk[^"]*"` it also matches the English `blk-mt` div nested
// INSIDE each block, which ends every row just before its own
// translation and files the English as a headless block of its own —
// 40,310 rows extracted and not one of them English.
const RE_BLK = /<div class="(blk(?:\s[^"]*)?)"([^>]*)>([\s\S]*?)(?=<div class="blk(?:\s[^"]*)?"|<div class="division"|<\/main>|$)/g;
const RE_ATTR = (name) => new RegExp(`${name}="([^"]*)"`);
const RE_MT_OPEN = /<div class="blk-mt"[^>]*>/;
const RE_TX_OPEN = /<span class="tx"[^>]*>/;

const stripTags = (s) => s.replace(/<[^>]+>/g, "");
const collapse = (s) => s.replace(/\s+/g, " ").trim();

function decode(s) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, x) => String.fromCharCode(parseInt(x, 16)));
}

// The source prints its own citation chip inside the Latin span and
// labels every English block "English · machine translation". We show
// the citation ourselves and say where the English comes from once,
// on the work, rather than on every paragraph.
function cleanLatin(html) {
  return collapse(decode(stripTags(html.replace(/<span class="col-marker"[\s\S]*?<\/span>/g, ""))));
}
function cleanEnglish(html) {
  return collapse(decode(stripTags(html.replace(/<span class="mt-by"[\s\S]*?<\/span>/g, ""))));
}

function rowsIn(chunk) {
  const rows = [];
  RE_BLK.lastIndex = 0;
  let m = RE_BLK.exec(chunk);
  while (m) {
    const classes = m[1] || "";
    const attrs = m[2] || "";
    const body = m[3] || "";
    const id = (attrs.match(RE_ATTR("id")) || [])[1] || "";
    const cite = (attrs.match(RE_ATTR("data-cite")) || [])[1] || "";
    // Split at the translation rather than matching each lane: the
    // Latin span nests a citation chip, so the first </span> closes
    // the wrong element.
    const cut = body.search(RE_MT_OPEN);
    const latinPart = cut >= 0 ? body.slice(0, cut) : body;
    const englishPart = cut >= 0 ? body.slice(cut).replace(RE_MT_OPEN, "") : "";
    const la = cleanLatin(latinPart.replace(RE_TX_OPEN, ""));
    const en = cleanEnglish(englishPart);
    if (la || en) {
      rows.push({
        kind: /\bheading\b/.test(classes) ? "heading" : "body",
        id,
        cite,
        en,
        la,
      });
    }
    m = RE_BLK.exec(chunk);
  }
  return rows;
}

function extract(html, doc) {
  const title = collapse(decode((html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || ""));
  const sections = [];
  RE_DIVISION.lastIndex = 0;
  let m = RE_DIVISION.exec(html);
  while (m) {
    const id = m[1];
    const chunk = m[2];
    const head = chunk.match(RE_DIVHEAD);
    const rows = rowsIn(chunk);
    if (rows.length) {
      sections.push({
        id,
        title: head ? collapse(decode(stripTags(head[1]))) : "",
        subtitle: "",
        rows,
      });
    }
    m = RE_DIVISION.exec(html);
  }

  // A work with no divisions still has blocks. Render them as one
  // section rather than reporting the work unreadable.
  if (!sections.length) {
    const rows = rowsIn(html);
    if (rows.length) sections.push({ id: `d${doc}_1`, title: "", subtitle: "", rows });
  }

  // Divisions that carry no heading of their own get a plain ordinal,
  // decided here rather than in the browser so every reader agrees.
  sections.forEach((s, i) => {
    if (!s.title) s.title = sections.length === 1 ? "Text" : `Part ${i + 1}`;
  });

  const [head, tail] = title.split("—");
  return {
    title: (head || "").trim() || String(doc),
    work: (tail || "").trim(),
    sections,
  };
}

// ── Run ───────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`out: ${OUT_DIR}`);

  await unlock();
  console.log("gate open");

  const navRes = await fetch(`${BASE}/data/nav.json`, { headers: { cookie } });
  const nav = await navRes.json();
  let ids = Object.keys(nav.docs || {});
  if (LIMIT) ids = ids.slice(0, LIMIT);
  console.log(`works: ${ids.length}`);

  let done = 0;
  let skipped = 0;
  let failed = 0;
  let rows = 0;
  let english = 0;
  const t0 = Date.now();

  async function worker(queue) {
    for (;;) {
      const id = queue.pop();
      if (id === undefined) return;
      const outFile = path.join(OUT_DIR, `${id}.json`);
      if (!FORCE && fs.existsSync(outFile)) { skipped += 1; continue; }
      try {
        const html = await getText(`${BASE}/read/${id}.html`);
        if (!html) { failed += 1; continue; }
        const data = extract(html, id);
        if (!data.sections.length) { failed += 1; continue; }
        // The catalogue is the authority on author and title; the page
        // <title> is a display string.
        const meta = (nav.docs || {})[id] || {};
        data.author = (meta.ae || meta.a || "").trim();
        data.titleLatin = meta.t || "";
        if (meta.te) data.title = meta.te;
        data.volume = meta.v || "";
        fs.writeFileSync(outFile, JSON.stringify(data));
        data.sections.forEach((s) => {
          rows += s.rows.length;
          english += s.rows.filter((r) => r.en).length;
        });
        done += 1;
        if (done % 250 === 0) {
          const rate = done / ((Date.now() - t0) / 1000);
          console.log(`${done}/${ids.length} · ${rate.toFixed(1)}/s · ${rows} rows`);
        }
      } catch (err) {
        failed += 1;
        if (failed < 10) console.error(`  ${id}: ${err.message}`);
      }
    }
  }

  const queue = ids.slice().reverse();
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));

  console.log(`\ndone ${done} · skipped ${skipped} · failed ${failed}`);
  console.log(`rows ${rows} · with English ${english} (${rows ? ((english / rows) * 100).toFixed(1) : 0}%)`);
  console.log(`elapsed ${(((Date.now() - t0) / 1000) / 60).toFixed(1)} min`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
