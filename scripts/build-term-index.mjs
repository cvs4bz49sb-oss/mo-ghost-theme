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
import { readFile, writeFile, mkdir, appendFile, readdir, stat } from "node:fs/promises";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";
import os from "node:os";
import zlib from "node:zlib";
import { promisify } from "node:util";

const gunzip = promisify(zlib.gunzip);
const LIBRARY = "https://mo-tfr-library.mo-podcast-feed.workers.dev";
const OUT = process.env.TERM_OUT || path.join(os.tmpdir(), "mo-term-index");
const SHARDS = 4096;
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
    for (const f of files) {
      try {
        const d = await getJSON(`${LIBRARY}/v1/works/${slug}/${f}`);
        (d.pages || d || []).forEach((p) => { if (p.en) out.push(p.en); });
      } catch (_) { /* a shard short is better than nothing */ }
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
};

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
  let n = 0, empty = 0, postings = 0;
  const t0 = Date.now();
  const queue = todo.slice();

  await Promise.all(Array.from({ length: 8 }, async () => {
    while (queue.length) {
      const id = queue.pop();
      let text = "";
      try { text = await READERS[corpus](id); } catch (_) { text = ""; }
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
        console.log(`  ${n.toLocaleString()}/${todo.length.toLocaleString()}  ${postings.toLocaleString()} postings  ${empty} empty  ${(rate * 3600).toFixed(0)}/h`);
        await writeFile(donePath, JSON.stringify([...done]));
      }
    }
  }));
  out.end();
  await writeFile(donePath, JSON.stringify([...done]));
  console.log(`${corpus}: ${n.toLocaleString()} read, ${postings.toLocaleString()} postings, ${empty} with no English text`);
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

  // The manifest: every work gets an integer, so a posting is a number
  // rather than a corpus and a slug repeated a hundred thousand times.
  const works = [];
  const index = new Map();
  const df = new Map();

  console.log("counting...");
  for (const f of files) {
    const rl = createInterface({ input: createReadStream(path.join(OUT, f)), crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line) continue;
      let d; try { d = JSON.parse(line); } catch (_) { continue; }
      const key = `${d.c}:${d.i}`;
      if (!index.has(key)) { index.set(key, works.length); works.push([d.c, d.i]); }
      for (const w of Object.keys(d.t)) df.set(w, (df.get(w) || 0) + 1);
    }
  }
  const wide = [...df.values()].filter((n) => n > POSTINGS_CAP).length;
  console.log(`${works.length.toLocaleString()} works, ${df.size.toLocaleString()} distinct words`);
  console.log(`${wide.toLocaleString()} appear in more than ${POSTINGS_CAP.toLocaleString()} works and will be cut to the ${POSTINGS_CAP.toLocaleString()} that use them most`);

  const dir = path.join(OUT, "out", "terms");
  await mkdir(dir, { recursive: true });
  const buckets = new Map();

  console.log("sharding...");
  let lines = 0;
  for (const f of files) {
    const rl = createInterface({ input: createReadStream(path.join(OUT, f)), crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line) continue;
      let d; try { d = JSON.parse(line); } catch (_) { continue; }
      const wi = index.get(`${d.c}:${d.i}`);
      for (const [w, c] of Object.entries(d.t)) {
        const s = shardOf(w);
        let b = buckets.get(s);
        if (!b) { b = new Map(); buckets.set(s, b); }
        let arr = b.get(w);
        if (!arr) { arr = []; b.set(w, arr); }
        arr.push(wi, c);
      }
      lines += 1;
      if (lines % 2000 === 0) process.stdout.write(`  ${lines.toLocaleString()} works folded in\r`);
    }
  }
  console.log(`\n  ${lines.toLocaleString()} works folded in`);

  let bytes = 0;
  let capped = 0;
  for (const [s, b] of buckets) {
    const obj = {};
    // "12,5,88,3" — pairs of work and count, flat, because a hundred
    // million little arrays is a hundred million allocations.
    for (const [w, arr] of b) {
      let pairs = arr;
      if (arr.length > POSTINGS_CAP * 2) {
        // Most-used first, then keep the head. A reader looking for a
        // common word wants the works it matters in.
        const rows = [];
        for (let i = 0; i < arr.length; i += 2) rows.push([arr[i], arr[i + 1]]);
        rows.sort((x, y) => y[1] - x[1]);
        pairs = rows.slice(0, POSTINGS_CAP).flat();
        capped += 1;
      }
      obj[w] = pairs.join(",");
    }
    const body = JSON.stringify(obj);
    bytes += body.length;
    await writeFile(path.join(dir, `${s}.json`), body);
  }
  await writeFile(path.join(OUT, "out", "term-works.json"), JSON.stringify({ shards: SHARDS, works }));
  console.log(`${buckets.size} shards, ${(bytes / 1048576).toFixed(0)} MB, manifest ${works.length.toLocaleString()} works`);
  if (capped) console.log(`${capped.toLocaleString()} words were cut to their ${POSTINGS_CAP.toLocaleString()} most-using works`);
}

if (flag("--shard")) await shard();
else await extract();
