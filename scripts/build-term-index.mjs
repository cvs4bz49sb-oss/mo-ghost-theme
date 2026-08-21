#!/usr/bin/env node
/*
 * A word index over the whole corpus.
 *
 * Find works because the text is already in the browser. Searching a
 * shelf works because a few hundred documents can be fetched. Neither
 * scales to sixty-nine thousand works and 1.2 million pages: that is
 * 1.6 GB for Early English Books alone, and no browser is going to
 * read the library to answer one question.
 *
 * So the reading happens once, here, and what it writes down is which
 * works contain which words. A search then costs one small fetch.
 *
 *   node scripts/build-term-index.mjs --corpus eebo [--limit N]
 *   node scripts/build-term-index.mjs --shard
 *   node scripts/build-term-index.mjs --upload
 *
 * Two passes, because the postings do not fit in memory. The first
 * walks the works and writes one line per work; the second turns those
 * lines inside out into shards keyed by word.
 *
 * English only. The corpus is bilingual and indexing both lanes
 * trebles the postings — 4,713 distinct English words in an average
 * Patrologia Latina volume against 16,528 across both. Latin search is
 * a second index, not a bigger one.
 */
import { appendFile, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";
import os from "node:os";
import zlib from "node:zlib";
import { promisify } from "node:util";

const gunzip = promisify(zlib.gunzip);
const LIBRARY = "https://mo-tfr-library.mo-podcast-feed.workers.dev";
const OUT = process.env.TERM_OUT || path.join(os.tmpdir(), "mo-term-index");
// How many shard files the words are spread across. The client reads
// this from the manifest, so it can change with the corpus: three
// thousand works of Patrologia came to 35 MB, and the whole library
// will be closer to seven hundred, which over 4,096 shards would mean
// a 170 KB download to look up one word. Sixteen thousand keeps a
// shard near 50 KB.
const SHARDS = parseInt(process.env.TERM_SHARDS, 10) || 4096;
// Nothing is dropped for being common. The first cut of this threw
// away any word appearing in more than half the works, which on a test
// of 69 removed "baptism" — and on a theological corpus would remove
// God, grace, sin and faith, which is to say the words people come
// here to search. Instead a word keeps the works that use it most, so
// "God" answers with the thousand most concerned with it rather than
// with nothing at all.
const POSTINGS_CAP = 2000;

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const val = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };

await mkdir(OUT, { recursive: true });

/* ── Words ──────────────────────────────────────────────────────── */

const fold = (s) => String(s || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const strip = (h) => String(h || "").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ");

function terms(text) {
  const m = fold(strip(text)).match(/[a-z][a-z0-9]{1,}/g);
  if (!m) return null;
  const counts = new Map();
  for (const w of m) counts.set(w, (counts.get(w) || 0) + 1);
  return counts;
}

/* ── Where the English of each collection lives ─────────────────── */

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}


/* ── English out of a page of HTML, without a DOM ───────────────── */
//
// The three HTML collections publish no per-work JSON, so the reader
// parses their pages in the browser. Here there is no DOM and the
// pages run to three megabytes, so the English columns are cut out by
// scanning for the opening tag and counting nesting to its close. A
// non-greedy regex would stop at the first </div> inside the column
// and drop the rest of the paragraph.
function divsWithClass(html, cls) {
  const open = new RegExp(`<div[^>]*class="[^"]*\\b${cls}\\b[^"]*"[^>]*>`, "gi");
  const out = [];
  let m;
  while ((m = open.exec(html))) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    const tag = /<\/?div\b[^>]*>/gi;
    tag.lastIndex = i;
    let t;
    while (depth > 0 && (t = tag.exec(html))) {
      depth += t[0][1] === "/" ? -1 : 1;
      i = tag.lastIndex;
    }
    if (depth === 0) out.push(html.slice(start, i - t[0].length));
    open.lastIndex = i;
  }
  return out;
}

async function getText(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(String(r.status));
  return r.text();
}

let PG_VOLS = null;

const READERS = {
  // Everything reads from our own R2 now, which is the point of the
  // port: this pass can be repeated whenever the corpus changes
  // without asking anyone's permission or waiting out a rate limiter.
  async eebo(id) {
    const r = await fetch(`${LIBRARY}/eebo/${id}.json.gz`);
    if (!r.ok) return "";
    const d = JSON.parse((await gunzip(Buffer.from(await r.arrayBuffer()))).toString("utf8"));
    const out = [];
    (function walk(ns) {
      (ns || []).forEach((n) => { if (n.html) out.push(n.html); walk(n.kids); });
    }(d.toc));
    return out.join(" ");
  },
  async tfr(slug) {
    const meta = await getJSON(`${LIBRARY}/v1/works/${slug}/meta.json`);
    const files = meta.shards && meta.shards.length
      ? meta.shards.map((s) => s.file) : [meta.single || "work.json"];
    const out = [];
    let got = 0;
    for (const f of files) {
      try {
        const d = await getJSON(`${LIBRARY}/v1/works/${slug}/${f}`);
        got += 1;
        (d.pages || d || []).forEach((p) => { if (p.en) out.push(p.en); });
      } catch (_) { /* a shard short is better than nothing */ }
    }
    // But no shard at all is not "a work with no English". meta.json is
    // written before the pages, so a work caught mid-migration answers
    // 200 for its metadata and 404 for every page of its text, and
    // recording that as English-less would bury it for good. Chamier
    // read this way and has 570,000 characters of English on its first
    // shard alone.
    if (!got) {
      // Eight hundred of the Latin Library ship no page JSON at all,
      // only TEI: Duns Scotus answers 200 for meta.json and 404 for
      // every page, and has two and a half million characters of
      // English in tei.en.xml. The reader falls back the same way, so
      // the index has to, or a work a reader can open is a work the
      // search cannot find.
      const tei = await getText(`${LIBRARY}/v1/works/${slug}/tei.en.xml`);
      const body = tei.match(/<text[^>]*>([\s\S]*)<\/text>/);
      return body ? body[1] : tei;
    }
    return out.join(" ");
  },
  async pld(id) {
    const d = await getJSON(`https://mo-tfr.mo-podcast-feed.workers.dev/v1/pl/${id}.json`);
    const out = [];
    (d.sections || []).forEach((s) => (s.rows || []).forEach((r) => { if (r.en) out.push(r.en); }));
    return out.join(" ");
  },
  async mo(slug) {
    const d = await getJSON(`${LIBRARY}/v1/mo/${slug}.json`);
    const out = [];
    (d.sections || []).forEach((s) => (s.rows || []).forEach((r) => { if (r.en) out.push(r.en); }));
    return out.join(" ");
  },
  // Bilingual pages: Latin in .col-la, English in .col-en.
  async augustine(id) {
    return divsWithClass(await getText(`${LIBRARY}/augustine/read/${id}.html`), "col-en").join(" ");
  },
  // Facing translations: .dt-tr.is-en where a fascicle has English,
  // and .dt-tr otherwise, which is the printed translation into
  // French or Latin. Only the first is indexed here; an English index
  // that quietly held French would answer questions it cannot answer.
  async po(id) {
    const html = await getText(`${LIBRARY}/po/read/${id}`);
    return divsWithClass(html, "is-en").join(" ");
  },
  // Patrologia Graeca keeps its English apart from the page: the
  // printed columns carry Greek, and the translation is served in
  // buckets of a hundred columns from our own worker, filed by
  // volume. Column 9 of volume 4 and column 9 of volume 31 are
  // different pages of different books, so the volume is half the
  // address. The reader takes it from each block's citation, "PG
  // 31:693", but two thirds of these pages carry no citation at all;
  // nav.json records the volume for every work, so it comes from
  // there. Asking for a column without a volume is what made the
  // first pass over this collection return nothing at all.
  async pg(id) {
    if (!PG_VOLS) {
      const nav = await getJSON(`${LIBRARY}/pg/nav.json`);
      PG_VOLS = new Map(Object.entries(nav.docs || {}).map(([k, d]) => [k, d.v]));
    }
    const vol = PG_VOLS.get(String(id));
    if (!vol) return "";
    const html = await getText(`${LIBRARY}/pg/read/${id}.html`);
    const cols = new Set();
    let m;
    const re = /data-col="(\d+)"/g;
    while ((m = re.exec(html))) cols.add(parseInt(m[1], 10));
    if (!cols.size) return "";
    const buckets = new Set([...cols].map((c) => Math.floor(c / 100)));
    const out = [];
    for (const b of buckets) {
      try {
        const d = await getJSON(`https://mo-tfr.mo-podcast-feed.workers.dev/v1/pg-en/${vol}/${b}.json`);
        cols.forEach((c) => {
          const t = d[String(c)];
          if (t) out.push(typeof t === "string" ? t : JSON.stringify(t));
        });
      } catch (_) { /* a bucket short beats losing the work */ }
    }
    return out.join(" ");
  },
};

const CATALOGUES = {
  eebo: async () => (await getJSON(`${LIBRARY}/eebo/catalogue.json`)).works
    ? (await getJSON(`${LIBRARY}/eebo/catalogue.json`)).works.map((w) => String(w.i))
    : (await getJSON(`${LIBRARY}/eebo/catalogue.json`)).map((w) => String(w.i)),
  tfr: async () => (await getJSON(`${LIBRARY}/v1/works-index.json`)).works
    .filter((w) => !/^(pld|pg|po|eebo)-\d+$/.test(w.slug || ""))
    .map((w) => w.slug),
  pld: async () => {
    const nav = await getJSON("https://pld-patrologia-latina.vercel.app/data/nav.json");
    return Object.keys(nav.docs || {});
  },
  mo: async () => (await getJSON(`${LIBRARY}/v1/mo/index.json`)).works.map((w) => w.slug),
  augustine: async () => navIds(await getJSON(`${LIBRARY}/augustine/nav.json`)),
  po: async () => navIds(await getJSON(`${LIBRARY}/po/nav.json`)),
  pg: async () => Object.keys((await getJSON(`${LIBRARY}/pg/nav.json`)).docs || {}),
};

// The three HTML collections publish the same navigation shape.
function navIds(d) {
  const out = [];
  (Array.isArray(d) ? d : []).forEach((g) => (g.s || []).forEach((sec) => {
    const f = String(sec.f || "");
    if (f) out.push(f.replace(/\.html$/, ""));
  }));
  if (!out.length && d && d.docs) out.push(...Object.keys(d.docs));
  return [...new Set(out)];
}

/* ── Pass one: read every work, write one line each ─────────────── */

async function extract() {
  const corpus = val("--corpus");
  if (!READERS[corpus]) {
    console.error(`--corpus ${Object.keys(READERS).join("|")}`);
    process.exit(1);
  }
  const limit = parseInt(val("--limit"), 10) || 0;
  let ids = await CATALOGUES[corpus]();
  if (limit) ids = ids.slice(0, limit);

  const linePath = path.join(OUT, `${corpus}.jsonl`);
  const donePath = path.join(OUT, `${corpus}.done.json`);
  const done = new Set(existsSync(donePath) ? JSON.parse(await readFile(donePath, "utf8")) : []);
  const todo = ids.filter((id) => !done.has(id));
  console.log(`${corpus}: ${ids.length.toLocaleString()} works, ${done.size.toLocaleString()} read, ${todo.length.toLocaleString()} to go`);

  const out = createWriteStream(linePath, { flags: "a" });
  let n = 0, empty = 0, postings = 0, failed = 0;
  const t0 = Date.now();
  const queue = todo.slice();

  await Promise.all(Array.from({ length: 8 }, async () => {
    while (queue.length) {
      const id = queue.pop();
      // A work that could not be fetched is not a work without
      // English, and the difference decides whether we ever read it
      // again. Marking a failure done is how the pull driver came to
      // report a rate-limited pass as complete: the index would then
      // answer "no work uses that word" about text it never opened.
      let text = "";
      let read = true;
      try { text = await READERS[corpus](id); } catch (_) { read = false; }
      if (!read) { failed += 1; continue; }
      const counts = text ? terms(text) : null;
      if (counts && counts.size) {
        const t = {};
        counts.forEach((c, w) => { t[w] = c; });
        out.write(`${JSON.stringify({ c: corpus, i: id, t })}\n`);
        postings += counts.size;
      } else empty += 1;
      done.add(id);
      n += 1;
      if (n % 500 === 0) {
        const rate = n / ((Date.now() - t0) / 1000);
        console.log(`  ${n.toLocaleString()}/${todo.length.toLocaleString()}  ${postings.toLocaleString()} postings  ${empty} empty  ${failed} unread  ${(rate * 3600).toFixed(0)}/h`);
        await writeFile(donePath, JSON.stringify([...done]));
      }
    }
  }));
  out.end();
  await writeFile(donePath, JSON.stringify([...done]));
  console.log(`${corpus}: ${n.toLocaleString()} read, ${postings.toLocaleString()} postings, ${empty} with no English text`);
  if (failed) {
    console.log(`${corpus}: ${failed.toLocaleString()} could not be read and are NOT marked done. Re-run to pick them up.`);
  }
}

/* ── Pass two: turn the lines inside out ────────────────────────── */

function shardOf(term) {
  // FNV-1a, so a word always lands in the same shard and the client
  // can work out which one to ask for without a lookup table.
  let h = 2166136261;
  for (let i = 0; i < term.length; i += 1) {
    h ^= term.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % SHARDS;
}

async function shard() {
  const files = (await readdir(OUT)).filter((f) => f.endsWith(".jsonl"));
  if (!files.length) { console.error("nothing extracted yet"); process.exit(1); }

  // ── Why this is on disk ──────────────────────────────────────
  //
  // The first cut of this held every posting in memory and inverted
  // them at the end. That is fine for the sixty-nine works it was
  // written against, and it is a quarter of a billion postings across
  // the whole library: several gigabytes of little arrays, on a
  // machine with sixteen. So the postings are spilled to a fixed
  // number of files as they are read, and each spill is inverted on
  // its own afterwards. A word always lands in the same spill, so a
  // spill can be finished and forgotten.
  //
  // One pass over the extract, not two. The old counting pass existed
  // only to print how many words were about to be capped, which the
  // inverting pass can say for itself.
  const SPILLS = 64;
  const spillDir = path.join(OUT, "spill");
  await rm(spillDir, { recursive: true, force: true });
  await mkdir(spillDir, { recursive: true });

  const streams = Array.from({ length: SPILLS }, (_, i) =>
    createWriteStream(path.join(spillDir, `${i}.tsv`)));
  const bufs = Array.from({ length: SPILLS }, () => []);
  const FLUSH = 20000;
  const waiting = [];
  const push = (i, line) => {
    const b = bufs[i];
    b.push(line);
    if (b.length >= FLUSH) {
      const chunk = b.join("");
      b.length = 0;
      if (!streams[i].write(chunk)) {
        waiting.push(new Promise((res) => streams[i].once("drain", res)));
      }
    }
  };

  // Every work gets an integer, so a posting is a number rather than a
  // corpus and a slug repeated a hundred thousand times.
  const works = [];
  const seen = new Map();

  console.log(`spilling to ${SPILLS} files...`);
  let lines = 0;
  const t0 = Date.now();
  for (const f of files) {
    const rl = createInterface({ input: createReadStream(path.join(OUT, f)), crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line) continue;
      let d; try { d = JSON.parse(line); } catch (_) { continue; }
      const key = `${d.c}:${d.i}`;
      let wi = seen.get(key);
      if (wi === undefined) { wi = works.length; seen.set(key, wi); works.push([d.c, d.i]); }
      for (const [w, c] of Object.entries(d.t)) {
        push(shardOf(w) % SPILLS, `${w}\t${wi}\t${c}\n`);
      }
      lines += 1;
      if (lines % 2000 === 0) {
        if (waiting.length) { await Promise.all(waiting.splice(0)); }
        const rate = lines / ((Date.now() - t0) / 1000);
        process.stdout.write(`  ${lines.toLocaleString()} works spilled, ${(rate * 60).toFixed(0)}/min\r`);
      }
    }
  }
  for (let i = 0; i < SPILLS; i += 1) {
    if (bufs[i].length) streams[i].write(bufs[i].join(""));
    streams[i].end();
  }
  await Promise.all(streams.map((st) => new Promise((res) => st.on("close", res))));
  console.log(`\n  ${lines.toLocaleString()} works spilled`);

  // ── Invert one spill at a time ───────────────────────────────
  const dir = path.join(OUT, "out", "terms");
  await mkdir(dir, { recursive: true });

  let bytes = 0, capped = 0, distinct = 0, written = 0;
  for (let i = 0; i < SPILLS; i += 1) {
    const byTerm = new Map();
    const rl = createInterface({
      input: createReadStream(path.join(spillDir, `${i}.tsv`)),
      crlfDelay: Infinity,
    });
    for await (const line of rl) {
      if (!line) continue;
      const a = line.indexOf("\t");
      const b = line.indexOf("\t", a + 1);
      if (a < 0 || b < 0) continue;
      const w = line.slice(0, a);
      let arr = byTerm.get(w);
      if (!arr) { arr = []; byTerm.set(w, arr); }
      arr.push(+line.slice(a + 1, b), +line.slice(b + 1));
    }
    distinct += byTerm.size;

    // Group this spill's words by their real shard and write each out.
    const buckets = new Map();
    for (const [w, arr] of byTerm) {
      const sh = shardOf(w);
      let o = buckets.get(sh);
      if (!o) { o = {}; buckets.set(sh, o); }
      let pairs = arr;
      if (arr.length > POSTINGS_CAP * 2) {
        // Most-used first, then keep the head. A reader looking for a
        // common word wants the works it matters in.
        const rows = [];
        for (let k = 0; k < arr.length; k += 2) rows.push([arr[k], arr[k + 1]]);
        rows.sort((x, y) => y[1] - x[1]);
        pairs = rows.slice(0, POSTINGS_CAP).flat();
        capped += 1;
        // How many works really use it. Without this the page reports
        // two thousand for every common word and reads as the whole
        // answer, when "procreation" is in more works than that and
        // these are only the ones it matters most in. A tilde cannot
        // collide with a term, which is [a-z0-9]+.
        o[`~${w}`] = rows.length;
      }
      // "12,5,88,3" — pairs of work and count, flat, because a hundred
      // million little arrays is a hundred million allocations.
      o[w] = pairs.join(",");
    }
    for (const [sh, o] of buckets) {
      const body = JSON.stringify(o);
      bytes += body.length;
      await writeFile(path.join(dir, `${sh}.json`), body);
      written += 1;
    }
    byTerm.clear();
    if ((i + 1) % 8 === 0 || i + 1 === SPILLS) {
      console.log(`  inverted spill ${i + 1}/${SPILLS}, ${written.toLocaleString()} shards, ${(bytes / 1048576).toFixed(0)} MB so far`);
    }
  }

  await writeFile(path.join(OUT, "out", "term-works.json"), JSON.stringify({ shards: SHARDS, works }));
  await rm(spillDir, { recursive: true, force: true });
  console.log(`\n${written.toLocaleString()} shards, ${(bytes / 1048576).toFixed(0)} MB, ${distinct.toLocaleString()} distinct words, manifest ${works.length.toLocaleString()} works`);
  if (capped) console.log(`${capped.toLocaleString()} words were cut to their ${POSTINGS_CAP.toLocaleString()} most-using works`);
}

if (flag("--shard")) await shard();
else await extract();
