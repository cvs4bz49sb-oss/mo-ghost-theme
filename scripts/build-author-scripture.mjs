#!/usr/bin/env node
/*
 * Scripture fingerprint, per author.
 *
 *   node scripts/build-author-scripture.mjs [--out DIR] [--limit N]
 *   node website/workers/tfr-library/upload-index.mjs <DIR> v1/index
 *
 * upload-index.mjs, not upload-scripture-index.mjs: the latter spawns
 * one wrangler per file and a wrangler start-up is 13 seconds, so 968
 * files is 26 minutes. The worker's own /admin/put takes the body over
 * HTTP and does the same upload in 21 seconds.
 *
 * The prefix is v1/index because the tree under DIR already begins
 * with author-scripture/.
 *
 * The generated scripture index answers "who cites Romans 8" — it is
 * keyed by book and chapter, and a chapter file lists the works. The
 * author page asks the question the other way round: given this man,
 * what did he read? Answering that at read time would mean fetching
 * every one of the 2,527 chapter files, so it is answered here, once,
 * and written as one small file per author.
 *
 * Output, per folded author name (the same fold faith-author.js uses,
 * so the page can address it from the URL it already has):
 *
 *   v1/index/author-scripture/<folded>.json
 *   { name, works, worksCiting, citations, rank, of,
 *     books: [[book, n], …], verses: [[book, ch, v, works], …],
 *     volumes: [lo, hi], corpora: [[corpus, works, citations], …],
 *     dubia: { works, worksCiting, citations }, collective: true? }
 *
 * Two counts, and they are not the same count:
 *
 *   `citations` and the book totals are occurrences. The extractor
 *   increments per citation, so Psalms 4,806 means the author cited
 *   the Psalms 4,806 times.
 *
 *   the verse counts are WORKS, not occurrences. The index records a
 *   verse once per work with the locator to reach it (see the
 *   `prev.verses.has(v)` guard in build-scripture-index.mjs), so the
 *   most this can say is how many of an author's works turn on John
 *   1:1. The page must label it that way and does. Making these
 *   occurrences means changing that guard to a counter and re-running
 *   the extractor over the whole corpus.
 *
 * Dubia are the catalogue's own judgement, not ours. Migne's editors
 * filed a doubtful work under "Unknown author (Augustine of Hippo?)",
 * and there are 29 of those beside Augustine's 143. They are counted,
 * and counted separately: a verse Augustine cited twice is a fact
 * about Augustine, and a verse cited in a sermon somebody once
 * thought was his is not. So dubia never enter the book totals, the
 * signature verses or the ranking — they are one line saying how much
 * more sits under the name if you accept the attribution.
 *
 * "Unknown author", "Editors" and "Various authors" are 2,317 of the
 * 8,967 works between them. They get a fingerprint, because someone
 * arriving at that page should see what is there, but they are marked
 * `collective` and left out of the ranking, which is a ranking of
 * people.
 *
 * Only the corpora the scripture index actually covers appear here —
 * Patrologia Latina and the Augustine collection. An author whose
 * shelf is Early English Books gets no fingerprint rather than a
 * fingerprint of zero, and the page says nothing rather than saying
 * he cited nothing.
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const LIBRARY = "https://mo-tfr-library.mo-podcast-feed.workers.dev";
const INDEX = `${LIBRARY}/v1/index`;
const PLD = "https://pld-patrologia-latina.vercel.app";
const AUGUSTINE = "https://aquinas-studies.vercel.app";
// The aquinas-studies catalogue runs one id counter across both
// halves; 1–150 is Aquinas, pulled from TFR in July 2026, and 151+ is
// Augustine. Same constant as faith-corpora.js.
const AUGUSTINE_FROM = 151;

const args = process.argv.slice(2);
const argOf = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const OUT_DIR = argOf("--out", path.join(os.tmpdir(), "mo-author-scripture"));
const LIMIT = parseInt(argOf("--limit", "0"), 10) || 0;
// --limit reads a handful of chapters to check the shape of the thing.
// Its output has the same filenames and the same fields as a real run
// and is wrong in every figure, so it must never be the directory
// somebody then points the uploader at. The completeness guard below
// is also skipped under --limit, which is the whole hazard: a partial
// run is the one that looks finished.
if (LIMIT && args.includes("--out") && !args.includes("--i-know")) {
  console.error("--limit writes partial figures; use the default temp dir, "
    + "or pass --i-know if you are certain you will not upload it");
  process.exit(1);
}
const CONCURRENCY = 10;
// Below this an author's fingerprint is noise: one citation in one
// work says nothing about how he read, and the page is better with no
// panel than with a panel holding a single bar.
const MIN_CITATIONS = 5;
// The page shows a handful and offers the rest behind a control. More
// than this is weight nobody scrolls to.
const TOP_BOOKS = 20;
const TOP_VERSES = 24;

/* ── The same fold the theme uses ───────────────────────────────── */

function fold(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/* ── Fetch ──────────────────────────────────────────────────────── */

async function getJSON(url, tries = 3) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
      if (r.status === 404) return null;
    } catch (_) { /* retry */ }
    await new Promise((res) => setTimeout(res, 400 * (i + 1)));
  }
  return null;
}

// Run `work` over `items` with a fixed number of workers rather than
// Promise.all over the whole list: 2,527 concurrent fetches at the
// worker is a rate limit, and the last full index run died on one.
async function pool(items, worker, concurrency = CONCURRENCY, onTick) {
  const queue = items.slice();
  let done = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (queue.length) {
      const item = queue.pop();
      await worker(item);
      done += 1;
      if (onTick && done % 200 === 0) onTick(done, items.length);
    }
  }));
}

/* ── Attribution ────────────────────────────────────────────────── */

// The catalogue's way of saying "this is probably his, and probably
// isn't". 29 works sit under Augustine's name this way.
const DUBIA = /^\s*unknown author\s*\((.+?)\?\)\s*$/i;

// Not people. Migne's editors, the anonymous mass, and the volumes
// gathering several hands at once.
const COLLECTIVE = new Set(["unknownauthor", "editors", "variousauthors"]);

// An author string can name more than one hand: "Agobard of Lyon;
// Various authors". The whole string is the author page, because that
// is what the theme folds and links; the parts are only read to find
// dubia attributions inside it.
function dubiaFor(name) {
  const out = [];
  String(name).split(";").forEach((part) => {
    const m = part.match(DUBIA);
    if (!m) return;
    const who = m[1].trim();
    if (who) out.push({ key: fold(who), name: who });
  });
  return out;
}

// True when no part of the string names a person: the anonymous mass,
// the editors, and the "probably Bede" bucket, which is a statement
// about an attribution rather than an author with a life.
function isCollective(name) {
  const parts = String(name).split(";").map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return true;
  return parts.every((p) => COLLECTIVE.has(fold(p)) || DUBIA.test(p));
}

/* ── Who wrote what ─────────────────────────────────────────────── */

// corpus:id -> { author, name, volume }
async function workAuthors() {
  const map = new Map();

  const nav = await getJSON(`${PLD}/data/nav.json`);
  if (!nav || !nav.docs) throw new Error("Patrologia Latina catalogue unavailable");
  Object.entries(nav.docs).forEach(([id, w]) => {
    // te/ae are the English title and author; t/a Migne's Latin. The
    // theme normalizes to ae||a and the page folds that, so the key
    // has to be built from the same string or the file the page asks
    // for is not the file that was written.
    const name = String(w.ae || w.a || "").trim();
    if (!name) return;
    map.set(`pld:${id}`, {
      key: fold(name),
      name,
      volume: Number(w.v) || 0,
      dubia: dubiaFor(name),
      collective: isCollective(name),
    });
  });

  // Loudly, like the Patrologia Latina branch above. A warning here was
  // the wrong shape of failure: the index still holds every augustine:
  // row, so they would be read, found to have no author, and dropped —
  // and the completeness guard downstream counts rows READ, so it sees
  // nothing wrong. Augustine's own file would then be written from
  // Patrologia Latina alone, with a plausible total, a corpora line
  // silently missing his own collection, and no sign anything was lost.
  // A source that has moved should stop the build, not shrink it.
  const aug = await getJSON(`${AUGUSTINE}/data/nav.json`);
  if (!Array.isArray(aug)) throw new Error("Augustine catalogue unavailable");
  let augustineWorks = 0;
  aug.forEach((group) => {
    (group.s || []).forEach((sec) => {
      const file = String(sec.f || "");
      const n = parseInt((file.match(/_(\d+)\.html$/) || [])[1], 10);
      if (!(n >= AUGUSTINE_FROM)) return;
      const id = file.replace(/\.html$/, "");
      augustineWorks += 1;
      map.set(`augustine:${id}`, {
        key: fold("Augustine of Hippo"),
        name: "Augustine of Hippo",
        volume: 0,
        dubia: [],
        collective: false,
      });
    });
  });
  // The catalogue answering with the right shape is not the same as the
  // catalogue still holding what we think it holds. 124 works as of
  // 2026-07-28; a fraction of that means the id split moved or the
  // second half was republished, and the fingerprint would be wrong
  // rather than absent.
  if (augustineWorks < 100) {
    throw new Error(`Augustine catalogue held ${augustineWorks} works, expected ~124`);
  }

  return map;
}

/* ── Walk the index ─────────────────────────────────────────────── */

function blank(name) {
  return {
    name,
    citations: 0,
    books: new Map(),        // book -> occurrences
    verses: new Map(),       // "book|ch|v" -> works citing it
    works: new Set(),        // every work of his the index knows
    corpora: new Map(),      // corpus -> { works:Set, citations:n }

    collective: false,
    // Counted, never mixed in: see the head of this file.
    dubiaCitations: 0,
    dubiaWorks: new Set(),
  };
}

// An accumulator is created by whichever comes first, a work of his or
// a work doubtfully his, so both paths go through here.
function accFor(out, key, name) {
  let a = out.get(key);
  if (!a) { a = blank(name); out.set(key, a); }
  return a;
}

async function build() {
  const authors = await workAuthors();
  console.log(`${authors.size.toLocaleString()} works with an author`);

  const books = await getJSON(`${INDEX}/scripture-books.json`);
  if (!books) throw new Error("scripture-books.json unavailable");

  let chapters = [];
  let expected = 0;
  Object.entries(books).forEach(([book, chs]) => {
    Object.entries(chs).forEach(([ch, n]) => { chapters.push([book, ch]); expected += n; });
  });
  if (LIMIT) chapters = chapters.slice(0, LIMIT);
  console.log(`${chapters.length.toLocaleString()} chapter files to read`);

  const out = new Map();   // folded key -> accumulator
  let rows = 0;
  let unknown = 0;
  let missed = [];

  const readChapter = async ([book, ch]) => {
    const list = await getJSON(`${INDEX}/scripture/${encodeURIComponent(book)}/${ch}.json`);
    // A chapter that would not load is a hundred works missing from
    // somebody's fingerprint, and the first run of this dropped 20,246
    // rows while printing the same cheerful total as a clean one.
    // Collected, retried, and failing that, said out loud.
    if (!Array.isArray(list)) { missed.push([book, ch]); return; }
    list.forEach((row) => {
      const [corpus, id, n, , , verses] = row;
      rows += 1;
      const who = authors.get(`${corpus}:${id}`);
      if (!who) { unknown += 1; return; }

      const a = accFor(out, who.key, who.name);
      a.collective = who.collective;

      const times = Number(n) || 0;

      // Doubtfully his: credited to the man the catalogue names, and
      // nowhere near his own totals.
      (who.dubia || []).forEach((d) => {
        const target = accFor(out, d.key, d.name);
        target.dubiaCitations += times;
        target.dubiaWorks.add(`${corpus}:${id}`);
      });
      a.citations += times;
      a.books.set(book, (a.books.get(book) || 0) + times);
      a.works.add(`${corpus}:${id}`);

      let c = a.corpora.get(corpus);
      if (!c) { c = { works: new Set(), citations: 0 }; a.corpora.set(corpus, c); }
      c.works.add(id);
      c.citations += times;

      if (Array.isArray(verses)) {
        verses.forEach((v) => {
          const num = Array.isArray(v) ? Number(v[0]) : Number(v);
          if (!num) return;
          const key = `${book}|${ch}|${num}`;
          a.verses.set(key, (a.verses.get(key) || 0) + 1);
        });
      }
    });
  };

  await pool(chapters, readChapter, CONCURRENCY, (d, t) => console.log(`  ${d}/${t} chapters`));

  // Two more passes at whatever the worker refused, more slowly each
  // time. What survives that is a hole in the data and the run says so
  // rather than writing a fingerprint that quietly lacks a book.
  for (let attempt = 1; attempt <= 2 && missed.length; attempt += 1) {
    const again = missed;
    missed = [];
    console.log(`  retry ${attempt}: ${again.length} chapters`);
    await pool(again, readChapter, 3);
  }
  if (missed.length) {
    console.warn(`! ${missed.length} chapters never loaded: ${
      missed.slice(0, 6).map(([b, c]) => `${b} ${c}`).join(", ")}`);
  }

  console.log(`${rows.toLocaleString()} of ${expected.toLocaleString()} rows, ${unknown.toLocaleString()} with no author in the catalogue`);
  if (!LIMIT && rows !== expected) {
    throw new Error(`${(expected - rows).toLocaleString()} rows missing; not writing a partial fingerprint`);
  }

  // How many works the library holds under each name, not only how
  // many of them cite scripture. "126 of 143" is the interesting
  // sentence; "126 works" alone is not. Same count again for the
  // doubtful ones, which are held under a different name.
  const worksHeld = new Map();
  const dubiaHeld = new Map();
  const add = (map, key, value) => {
    let s = map.get(key);
    if (!s) { s = new Set(); map.set(key, s); }
    s.add(value);
  };
  // "PL 6–195" is where the man sits in Migne, so it is read off every
  // work held under the name. Reading it off the citing works instead
  // printed Augustine as PL 32–123, which is true of the works that
  // quote scripture and not of him.
  const volumes = new Map();
  authors.forEach((who, workKey) => {
    add(worksHeld, who.key, workKey);
    (who.dubia || []).forEach((d) => add(dubiaHeld, d.key, workKey));
    if (!who.volume) return;
    const v = volumes.get(who.key);
    if (!v) volumes.set(who.key, [who.volume, who.volume]);
    else { v[0] = Math.min(v[0], who.volume); v[1] = Math.max(v[1], who.volume); }
  });

  // Citations of their own, not only doubtful ones. A name whose every
  // citation sits in a work the catalogue doubts has no fingerprint to
  // draw — and the page agrees, refusing to render a panel with no
  // `citations`. Writing the file anyway left several hundred that
  // nothing would ever read and whose dubia line nobody would ever see.
  const kept = [...out.entries()].filter(([, a]) => a.citations >= MIN_CITATIONS);
  kept.sort((x, y) => y[1].citations - x[1].citations);
  const people = kept.filter(([, a]) => !a.collective).length;
  console.log(`${kept.length.toLocaleString()} names above ${MIN_CITATIONS} citations, ${people.toLocaleString()} of them people`);

  await mkdir(path.join(OUT_DIR, "author-scripture"), { recursive: true });

  const summary = [];
  // The ranking is of people. A collective takes no place in it and
  // does not push anybody down one.
  let i = 0;
  for (const [key, a] of kept) {
    if (!a.collective) i += 1;
    const held = worksHeld.get(key);
    const bookRows = [...a.books.entries()].sort((p, q) => q[1] - p[1] || p[0].localeCompare(q[0]));
    const verseRows = [...a.verses.entries()]
      .map(([k, n]) => { const [b, c, v] = k.split("|"); return [b, Number(c), Number(v), n]; })
      // Ties are common in the tail, and a stable order means the same
      // page renders the same way twice.
      .sort((p, q) => q[3] - p[3] || p[0].localeCompare(q[0]) || p[1] - q[1] || p[2] - q[2])
      .slice(0, TOP_VERSES);
    const vols = volumes.get(key) || null;

    const dubiaHeldFor = dubiaHeld.get(key);
    const doc = {
      name: a.name,
      works: held ? held.size : a.works.size,
      worksCiting: a.works.size,
      citations: a.citations,
      books: bookRows.slice(0, TOP_BOOKS),
      booksTotal: bookRows.length,
      verses: verseRows,
      volumes: vols,
      corpora: [...a.corpora.entries()]
        .map(([c, v]) => [c, v.works.size, v.citations])
        .sort((p, q) => q[2] - p[2]),
    };
    if (a.collective) doc.collective = true;
    else { doc.rank = i; doc.of = people; }
    if (a.dubiaCitations) {
      doc.dubia = {
        works: dubiaHeldFor ? dubiaHeldFor.size : a.dubiaWorks.size,
        worksCiting: a.dubiaWorks.size,
        citations: a.dubiaCitations,
      };
    }
    await writeFile(
      path.join(OUT_DIR, "author-scripture", `${key}.json`),
      JSON.stringify(doc)
    );
    if (!a.collective) summary.push([key, a.name, a.citations, doc.works, doc.worksCiting]);
  }

  await writeFile(
    path.join(OUT_DIR, "author-scripture.json"),
    JSON.stringify({ built: new Date().toISOString().slice(0, 10), authors: summary })
  );

  const top = kept.slice(0, 8)
    .map(([, a]) => `${a.name} ${a.citations.toLocaleString()}`).join(", ");
  console.log(`\nwrote ${kept.length + 1} files to ${OUT_DIR}`);
  console.log(top);
}

build().catch((e) => { console.error(e); process.exit(1); });
