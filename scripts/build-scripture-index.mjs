#!/usr/bin/env node
/*
 * Build a scripture index across The Faith Received corpora.
 *
 * The collections ship partial indexes at best: Early English Books
 * covers 31.4% of its own works, the Latin Library 28.9% of its own,
 * and Aquinas, Augustine, PanGrammata, Patrologia Graeca/Orientalis/
 * Latina have none at all. This walks the actual text and extracts
 * every citation it can recognise.
 *
 *   node scripts/build-scripture-index.mjs --corpus eebo [--limit N]
 *   node scripts/build-scripture-index.mjs --corpus tfr
 *   node scripts/build-scripture-index.mjs --corpus aquinas
 *
 * Output: data/scripture/<corpus>.json, gitignored — it is far too
 * large for the theme zip and belongs on the CDN. Merge and upload
 * with --merge once the parts exist.
 *
 * Shape: { "romans": { "9": [[id, count], …] }, … }
 * ids are corpus-local; the corpus is the filename.
 */

import { readFile, writeFile, mkdir, readdir, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import zlib from "node:zlib";
import { promisify } from "node:util";

const gunzip = promisify(zlib.gunzip);
const ROOT = path.join(import.meta.dirname, "..");
// NOT inside the repo. This directory holds hundreds of megabytes and
// the extractor rewrites its whole index every 250 works — doing that
// inside a Dropbox-synced folder had the sync layer replace the file
// mid-write, and a completed 372 MB EEBO index came back as a
// truncated 132 MB with 25,510 of 53,831 works recorded as done. The
// output is a build artifact bound for R2; it has no business in
// Dropbox.
const OUT_DIR = process.env.SCRIPTURE_OUT
  || path.join(os.tmpdir(), "mo-scripture-index");
const BLOB = "https://0ss8v4l06kodnhp0.public.blob.vercel-storage.com";

/* ── Canon ──────────────────────────────────────────────────────── */

const MAX_CHAPTERS = {
  genesis: 50, exodus: 40, leviticus: 27, numbers: 36, deuteronomy: 34,
  joshua: 24, judges: 21, ruth: 4, "1 samuel": 31, "2 samuel": 24,
  "1 kings": 22, "2 kings": 25, "1 chronicles": 29, "2 chronicles": 36,
  ezra: 10, nehemiah: 13, esther: 10, job: 42, psalms: 150, proverbs: 31,
  ecclesiastes: 12, "song of solomon": 8, isaiah: 66, jeremiah: 52,
  lamentations: 5, ezekiel: 48, daniel: 12, hosea: 14, joel: 3, amos: 9,
  obadiah: 1, jonah: 4, micah: 7, nahum: 3, habakkuk: 3, zephaniah: 3,
  haggai: 2, zechariah: 14, malachi: 4, matthew: 28, mark: 16, luke: 24,
  john: 21, acts: 28, romans: 16, "1 corinthians": 16, "2 corinthians": 13,
  galatians: 6, ephesians: 6, philippians: 4, colossians: 4,
  "1 thessalonians": 5, "2 thessalonians": 3, "1 timothy": 6,
  "2 timothy": 4, titus: 3, philemon: 1, hebrews: 13, james: 5,
  "1 peter": 5, "2 peter": 3, "1 john": 5, "2 john": 1, "3 john": 1,
  jude: 1, revelation: 22,
  // Deuterocanon. The Latin corpus, Migne and the schoolmen cite these
  // constantly — Aquinas's "Eccli." is Ecclesiasticus, not Ecclesiastes
  // — and omitting them would silently drop a large share of the
  // citations in exactly the collections that need indexing most.
  tobit: 14, judith: 16, wisdom: 19, ecclesiasticus: 51, baruch: 6,
  "1 maccabees": 16, "2 maccabees": 15,
};

// Aliases cover early modern English spellings, the Latin forms the
// scholastics cite by, and the abbreviations both use. Ordinals are
// normalised separately so "1", "I", "first" and "1st" all work.
const ALIASES = {
  genesis: ["gen", "genes", "gn"],
  exodus: ["exod", "exo"],  // "ex" removed: Latin preposition
  leviticus: ["lev", "levit", "lv"],
  numbers: ["num", "numb", "nu", "numeri"],
  deuteronomy: ["deut", "deu", "dt", "deuter"],
  joshua: ["josh", "jos", "iosue", "josue"],
  judges: ["judg", "jud", "jdg", "iudicum", "judicum"],
  ruth: ["rut"],  // "ru" removed: too short to be safe
  "1 samuel": ["1 sam", "1 sm", "1 kingdoms", "1 reg", "1 regum"],
  "2 samuel": ["2 sam", "2 sm", "2 kingdoms", "2 reg", "2 regum"],
  "1 kings": ["1 kin", "1 kgs", "3 reg", "3 regum", "3 kingdoms"],
  "2 kings": ["2 kin", "2 kgs", "4 reg", "4 regum", "4 kingdoms"],
  "1 chronicles": ["1 chron", "1 chr", "1 paral", "1 paralipomenon"],
  "2 chronicles": ["2 chron", "2 chr", "2 paral", "2 paralipomenon"],
  ezra: ["esdr", "esdras", "ezr", "1 esdras"],
  nehemiah: ["neh", "nehem", "2 esdras"],
  esther: ["esth"],  // "est" removed: Latin for "is"
  job: ["iob"],
  psalms: ["psalm", "psal", "ps", "psa", "psalmus", "psalmos", "psalmis"],
  proverbs: ["prov", "pro", "prv", "proverb", "proverbiorum"],
  ecclesiastes: ["eccles", "eccl", "eccle", "ecclesiast"],
  "song of solomon": ["cant", "canticles", "canticorum", "cantic"],  // "song"/"songs"/"sol" removed: ordinary words
  isaiah: ["isa", "esay", "esaias", "isai", "isaias"],  // "es" removed: Latin "you are"
  jeremiah: ["jer", "ier", "jerem", "ieremias", "jeremias"],
  lamentations: ["lam", "thren", "threni", "lament"],
  ezekiel: ["ezek", "eze", "ezech", "ezechiel"],
  daniel: ["dan", "dn"],
  hosea: ["hos", "osee", "ose"],
  joel: ["ioel", "joe"],
  amos: [],  // "am" removed: the English verb, 11,444 false hits in Amos 1 alone
  obadiah: ["obad", "abd", "abdias"],
  jonah: ["jon", "ion", "jonas", "ionas"],
  micah: ["mic", "mich", "michaeas"],
  nahum: ["nah"],  // "na" removed: too short to be safe
  habakkuk: ["hab", "habac", "abac", "habacuc"],
  zephaniah: ["zeph", "soph", "sophonias"],
  haggai: ["hag", "agg", "aggaeus", "aggeus"],
  zechariah: ["zech", "zach", "zacharias"],
  malachi: ["mal", "malach", "malachias"],
  matthew: ["matt", "mat", "mt", "matth", "matthaeus", "matthaei"],
  mark: ["mk", "marc", "marci", "marcus"],  // "mar" removed: too ambiguous
  luke: ["luk", "lk", "luc", "lucae", "lucas"],
  john: ["joh", "jn", "ioan", "ioannis", "ioannem", "johan"],
  acts: ["act", "acta", "actorum", "actes"],
  romans: ["rom", "rm", "romanos"],
  "1 corinthians": ["1 cor", "1 co", "1 corinth"],
  "2 corinthians": ["2 cor", "2 co", "2 corinth"],
  galatians: ["gal", "ga", "galat", "galatas"],
  ephesians: ["eph", "ephes", "ephesios"],
  philippians: ["phil", "philip", "philipp", "philippenses"],
  colossians: ["col", "coloss", "colossenses"],
  "1 thessalonians": ["1 thess", "1 thes", "1 the"],
  "2 thessalonians": ["2 thess", "2 thes", "2 the"],
  "1 timothy": ["1 tim", "1 ti"],
  "2 timothy": ["2 tim", "2 ti"],
  titus: ["tit", "tt"],
  philemon: ["philem", "phlm", "phile"],
  hebrews: ["heb", "hebr", "hebraeos"],
  james: ["jam", "jas", "iac", "iacobi", "jacobi"],
  "1 peter": ["1 pet", "1 pe", "1 petr"],
  "2 peter": ["2 pet", "2 pe", "2 petr"],
  "1 john": ["1 joh", "1 jn", "1 ioan"],
  "2 john": ["2 joh", "2 jn", "2 ioan"],
  "3 john": ["3 joh", "3 jn", "3 ioan"],
  jude: ["iud", "iudae", "judae"],
  revelation: ["rev", "apoc", "apocalypse", "apocalypsis", "revel"],
  tobit: ["tob", "tobias", "tobiae"],
  judith: ["judith", "iudith", "jdt"],
  wisdom: ["wisd", "sapientiae", "sapient", "wisdome"],  // "sap" removed
  ecclesiasticus: ["ecclus", "eccli", "sirach", "sir", "ecclesiastici"],
  baruch: ["bar", "baruc"],
  "1 maccabees": ["1 macc", "1 mac", "1 machab"],
  "2 maccabees": ["2 macc", "2 mac", "2 machab"],
};

// Bare stems of the numbered books. "1 Cor" is already an alias, but
// "I Corinthians" arrives with the ordinal detached, and the
// alternation below can only match strings that appear in it — so the
// stem has to be matchable on its own and rejoined with the ordinal.
const NUMBERED_STEMS = [
  "corinthians", "corinth", "thessalonians", "thess", "timothy", "tim",
  "peter", "pet", "petr", "john", "joh", "ioan", "samuel", "sam",
  "kings", "kin", "kgs", "chronicles", "chron", "chr", "esdras",
  "maccabees", "macc", "mac", "regum", "reg", "paralipomenon", "paral",
  "kingdoms",
];

// Longest alias first so "1 corinthians" wins over "1 cor".
const LOOKUP = new Map();
for (const [canon, alts] of Object.entries(ALIASES)) {
  LOOKUP.set(canon, canon);
  for (const a of alts) LOOKUP.set(a, canon);
}
for (const canon of Object.keys(MAX_CHAPTERS)) LOOKUP.set(canon, canon);

const ORDINALS = {
  // Bare digits matter as much as the roman and written forms: "2 Tim"
  // splits into ordinal "2" plus the stem "tim", and without these the
  // rejoined lookup fails and the reference is dropped silently.
  1: "1", 2: "2", 3: "3", 4: "4",
  i: "1", ii: "2", iii: "3", iv: "4",
  first: "1", second: "2", third: "3", fourth: "4",
  "1st": "1", "2nd": "2", "3rd": "3", "4th": "4",
};

// Kings and Samuel are numbered 1-4 in the Vulgate ("3 Reg." is
// 1 Kings), which is how the Latin corpus and Migne cite them.
const VULGATE_REGNUM = {
  "1 regum": "1 samuel", "2 regum": "2 samuel",
  "3 regum": "1 kings", "4 regum": "2 kings",
  "1 reg": "1 samuel", "2 reg": "2 samuel",
  "3 reg": "1 kings", "4 reg": "2 kings",
  "1 kingdoms": "1 samuel", "2 kingdoms": "2 samuel",
  "3 kingdoms": "1 kings", "4 kingdoms": "2 kings",
  "1 paralipomenon": "1 chronicles", "2 paralipomenon": "2 chronicles",
  "1 paral": "1 chronicles", "2 paral": "2 chronicles",
};

const NAMES = [...new Set([...LOOKUP.keys(), ...NUMBERED_STEMS])]
  .sort((a, b) => b.length - a.length);
const NAME_ALT = NAMES.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");

// "Rom. 9", "1 Cor 3:1", "Matth. xii. 3", "Psalm cxix", "Ioan. i. 14"
const REF_RE = new RegExp(
  String.raw`\b(?:(1|2|3|i{1,3}|iv|first|second|third|fourth|1st|2nd|3rd|4th)\s+)?` +
  String.raw`(${NAME_ALT})\b\.?\s*` +
  String.raw`(\d{1,3}|[ivxlc]{1,7})\b`,
  "gi"
);

function romanToInt(s) {
  const map = { i: 1, v: 5, x: 10, l: 50, c: 100 };
  let total = 0;
  const t = s.toLowerCase();
  for (let i = 0; i < t.length; i += 1) {
    const cur = map[t[i]];
    const next = map[t[i + 1]];
    if (!cur) return 0;
    total += next && next > cur ? -cur : cur;
  }
  return total;
}

// Each hit records where it sits and the words around it, so the
// index can preview a reference before the reader clicks and land them
// on the right spot afterwards. Only the first hit per chapter keeps an
// excerpt — a work citing Romans 9 eleven times needs one preview, not
// eleven, and excerpts are what would make this file unservable.
// Segments are the smallest addressable unit of a work — one parallel
// row, one page. Each carries the id or page the reader can scroll to,
// the text to search (both languages, so a Latin-only citation is not
// missed), and the English to quote from.
//
// Excerpting from English matters: these works are printed Latin
// beside translation, and quoting whichever column the regex happened
// to land in produced Latin previews. Excerpts are also snapped to
// word boundaries — slicing at a fixed offset opened previews
// mid-word, "equuntur" for "sequuntur".
export function extractRefs(segments) {
  const found = new Map();
  if (!segments || !segments.length) return found;

  for (let si = 0; si < segments.length; si += 1) {
    const seg = segments[si];
    const hay = seg.text || "";
    if (!hay) continue;
    let m;
    REF_RE.lastIndex = 0;
    while ((m = REF_RE.exec(hay))) {
      const raw = m[2];
      // Citations capitalise the book: "Acts 2", never "he acts 2".
      // Without this, ordinary words that happen to be book names or
      // abbreviations flood the index — "Job", "Acts", "Mark", and
      // worst of all the verb "am", which alone produced 11,444
      // phantom hits in Amos 1.
      if (raw[0] !== raw[0].toUpperCase() || raw[0] === raw[0].toLowerCase()) continue;
      const name = raw.toLowerCase();
      const ord = m[1] ? ORDINALS[m[1].toLowerCase()] : null;
      const joined = ord ? `${ord} ${name}` : null;
      const canon = (joined && (VULGATE_REGNUM[joined] || LOOKUP.get(joined)))
        || VULGATE_REGNUM[name] || LOOKUP.get(name);
      if (!canon) continue;
      const ch = m[3];
      const n = /^\d+$/.test(ch) ? parseInt(ch, 10) : romanToInt(ch);
      if (!n) continue;
      const max = MAX_CHAPTERS[canon];
      if (max && n > max) continue;

      const key = `${canon}|${n}`;
      const prev = found.get(key);
      if (prev) { prev.n += 1; continue; }
      found.set(key, {
        n: 1,
        loc: seg.loc == null ? null : seg.loc,
        excerpt: excerptFrom(seg, m.index, segments, si),
      });
    }
  }
  return found;
}

// Always English. Prefer this segment's translation; where a row is
// Latin- or Greek-only — a heading, or a stretch the translator ran
// together — borrow the nearest neighbouring row that has one.
// Returning the Latin instead was the whole complaint.
function excerptFrom(seg, at, segments, si) {
  if (seg.en && seg.en.trim()) {
    // The hit may have been in the other lane, where the offset means
    // nothing in this string; centre on the segment instead.
    const centre = seg.text === seg.en ? at : 0;
    return snap(seg.en, centre);
  }
  for (let d = 1; d <= 3; d += 1) {
    const before = segments[si - d];
    const after = segments[si + d];
    if (after && after.en && after.en.trim()) return snap(after.en, 0);
    if (before && before.en && before.en.trim()) return snap(before.en, 0);
  }
  // No English anywhere nearby. Better a card with no preview than a
  // card previewing a language the reader did not ask for.
  return "";
}

function snap(src, at) {
  let from = Math.max(0, at - 90);
  let to = Math.min(src.length, at + 150);
  // Grow outward to the nearest space so a preview never opens or
  // closes mid-word.
  if (from > 0) {
    const sp = src.indexOf(" ", from);
    if (sp > -1 && sp - from < 30) from = sp + 1;
  }
  if (to < src.length) {
    const sp = src.lastIndexOf(" ", to);
    if (sp > from) to = sp;
  }
  return src.slice(from, to).replace(/\s+/g, " ").trim();
}

/* ── Corpus readers ─────────────────────────────────────────────── */

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

async function eeboWorks(limit) {
  const cat = await getJSON("https://eebo-backup.vercel.app/data/catalogue.json");
  const list = Array.isArray(cat) ? cat : cat.works || [];
  return (limit ? list.slice(0, limit) : list).map((w) => String(w.i));
}

async function tfrWorks(limit) {
  const idx = await getJSON(`${BLOB}/v1/works-index.json`);
  const list = idx.works || [];
  return (limit ? list.slice(0, limit) : list).map((w) => w.slug);
}

// Aquinas and Augustine share one source catalogue, split at file id
// 150 — the same boundary faith-corpora.js uses.
async function aquinasStudiesWorks(limit, wantAugustine) {
  const nav = await getJSON("https://aquinas-studies.vercel.app/data/nav.json");
  const out = [];
  (Array.isArray(nav) ? nav : []).forEach((g) => {
    (g.s || []).forEach((sec) => {
      const n = parseInt((String(sec.f || "").match(/_(\d+)\.html$/) || [])[1], 10);
      if ((n >= 151) !== !!wantAugustine) return;
      out.push(String(sec.f || "").replace(/\.html$/, ""));
    });
  });
  return limit ? out.slice(0, limit) : out;
}

// Every reader returns an array of segments: { loc, text, en }.
//
// `loc` is what the reader can scroll to and must come from the source
// itself, never from a count. An earlier version numbered sections as
// it walked and had the reader number them again independently — they
// disagreed by one on every Aquinas work, because the reader prepends
// a prologue section the extractor never saw, so every link landed a
// section early. Source ids cannot drift.

async function eeboText(id) {
  const r = await fetch(`${BLOB}/eebo/${id}.json.gz`);
  if (!r.ok) throw new Error(`${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const j = JSON.parse((await gunzip(buf)).toString("utf8"));
  const segs = [];
  (function walk(nodes) {
    (nodes || []).forEach((n) => {
      if (n.html) {
        const t = n.html.replace(/<[^>]+>/g, " ");
        segs.push({ loc: n.id || null, text: t, en: t });
      }
      walk(n.kids);
    });
  })(j.toc);
  return segs;
}

async function tfrText(slug) {
  const meta = await getJSON(`${BLOB}/v1/works/${slug}/meta.json`);
  const files = meta.shards && meta.shards.length
    ? meta.shards.map((s) => s.file)
    : [meta.single || "work.json"];
  const segs = [];
  for (const f of files) {
    const d = await getJSON(`${BLOB}/v1/works/${slug}/${f}`);
    for (const p of d.pages || d) {
      // Page number: the reader resolves it to the section covering
      // that page, then scrolls to the page block itself.
      segs.push({ loc: p.n, text: `${p.la || ""} ${p.en || ""}`, en: p.en || "" });
    }
  }
  return segs;
}

async function aquinasStudiesText(id) {
  const r = await fetch(`https://aquinas-studies.vercel.app/read/${id}.html`);
  if (!r.ok) throw new Error(String(r.status));
  const html = await r.text();
  const segs = [];
  // Each parallel row carries its own id in the source. That id is the
  // anchor, and the reader stamps the same one onto the block it
  // renders, so the two can never drift apart.
  const rowRe = /<div class="parallel [^"]*"\s+id="([^"]+)"[^>]*>([\s\S]*?)(?=<div class="parallel |<\/details>)/g;
  let m;
  while ((m = rowRe.exec(html))) {
    const chunk = m[2];
    const la = (chunk.match(/<div class="col-la"[^>]*>([\s\S]*?)<\/div>/) || [])[1] || "";
    const en = (chunk.match(/<div class="col-en"[^>]*>([\s\S]*?)<\/div>/) || [])[1] || "";
    const strip = (x) => x.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const laT = strip(la);
    const enT = strip(en);
    if (!laT && !enT) continue;
    segs.push({ loc: m[1], text: `${laT} ${enT}`, en: enT });
  }
  return segs;
}

const CORPORA = {
  eebo: { works: eeboWorks, text: eeboText, concurrency: 12 },
  tfr: { works: tfrWorks, text: tfrText, concurrency: 4 },
  aquinas: {
    works: (l) => aquinasStudiesWorks(l, false),
    text: aquinasStudiesText,
    concurrency: 3,
  },
  augustine: {
    works: (l) => aquinasStudiesWorks(l, true),
    text: aquinasStudiesText,
    concurrency: 3,
  },
};

/* ── Runner ─────────────────────────────────────────────────────── */

// Two outputs, not one.
//
// A single merged file reached 49.6 MB, which every visitor to the
// Scripture tab had to download before seeing a book list. Now:
//
//   index/scripture-books.json         { book: { chapter: count } }
//   index/scripture/<book>/<ch>.json   [[corpus, id, times, loc, excerpt]]
//
// The summary is small enough to load up front; a chapter's works and
// their previews arrive only when that chapter is opened.
async function merge() {
  const files = (await readdir(OUT_DIR)).filter(
    (f) => f.endsWith(".json") && !f.endsWith(".done.json") && f !== "books.json"
  );
  const detail = new Map(); // "book/ch" -> rows
  const summary = {};
  let cites = 0;
  const works = new Set();

  for (const f of files) {
    const corpus = f.replace(/\.json$/, "");
    const d = JSON.parse(await readFile(path.join(OUT_DIR, f), "utf8"));
    for (const [book, chs] of Object.entries(d)) {
      for (const [ch, list] of Object.entries(chs)) {
        const key = `${book}/${ch}`;
        if (!detail.has(key)) detail.set(key, []);
        const rows = detail.get(key);
        for (const [id, n, loc, excerpt] of list) {
          rows.push([corpus, id, n, loc ?? null, excerpt || ""]);
          cites += n;
          works.add(`${corpus}:${id}`);
        }
      }
    }
  }

  const detailDir = path.join(OUT_DIR, "out", "scripture");
  await mkdir(detailDir, { recursive: true });
  let bytes = 0;
  for (const [key, rows] of detail) {
    const [book, ch] = key.split("/");
    summary[book] = summary[book] || {};
    summary[book][ch] = rows.length;
    const dir = path.join(detailDir, book);
    await mkdir(dir, { recursive: true });
    const body = JSON.stringify(rows);
    bytes += body.length;
    await writeFile(path.join(dir, `${ch}.json`), body);
  }

  const summaryPath = path.join(OUT_DIR, "out", "scripture-books.json");
  await writeFile(summaryPath, JSON.stringify(summary));
  const sBytes = (await readFile(summaryPath)).length;

  console.log(`${Object.keys(summary).length} books, ${detail.size} chapters`);
  console.log(`${cites.toLocaleString()} citations across ${works.size.toLocaleString()} works`);
  console.log(`summary  ${(sBytes / 1024).toFixed(0)} KB  (loaded up front)`);
  console.log(`detail   ${(bytes / 1024 / 1024).toFixed(1)} MB across ${detail.size} files (loaded per chapter)`);
}

async function run() {
  const args = process.argv.slice(2);
  if (args.includes("--merge")) return merge();
  const corpus = args[args.indexOf("--corpus") + 1];
  const limitArg = args.indexOf("--limit");
  const limit = limitArg >= 0 ? parseInt(args[limitArg + 1], 10) : 0;
  const c = CORPORA[corpus];
  if (!c) {
    console.error(`Usage: --corpus <${Object.keys(CORPORA).join("|")}> [--limit N]`);
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `${corpus}.json`);

  // Resumable: a run over 53,831 works will be interrupted.
  const index = existsSync(outPath) ? JSON.parse(await readFile(outPath, "utf8")) : {};
  const donePath = path.join(OUT_DIR, `${corpus}.done.json`);
  const done = new Set(existsSync(donePath) ? JSON.parse(await readFile(donePath, "utf8")) : []);

  const ids = (await c.works(limit)).filter((id) => !done.has(id));
  console.log(`${corpus}: ${ids.length} works to scan (${done.size} already done)`);

  let scanned = 0;
  let refs = 0;
  let failed = 0;
  const t0 = Date.now();

  async function worker(queue) {
    while (queue.length) {
      const id = queue.pop();
      try {
        const found = extractRefs(await c.text(id));
        found.forEach((hit, key) => {
          const [book, ch] = key.split("|");
          index[book] = index[book] || {};
          index[book][ch] = index[book][ch] || [];
          index[book][ch].push([id, hit.n, hit.loc, hit.excerpt]);
          refs += hit.n;
        });
      } catch { failed += 1; }
      done.add(id);
      scanned += 1;
      if (scanned % 250 === 0) {
        const rate = scanned / ((Date.now() - t0) / 1000);
        console.log(`  ${scanned}/${ids.length}  ${refs.toLocaleString()} refs  ${rate.toFixed(1)}/s  ${failed} failed`);
        await save();
      }
    }
  }

  // Write to a temp file and rename. A plain write leaves a truncated
  // file if the process dies mid-flush, and a 360 MB index takes long
  // enough to flush that this is not hypothetical — it cost a full
  // 53,831-work re-run. rename() is atomic on the same filesystem.
  async function save() {
    await writeFile(`${outPath}.tmp`, JSON.stringify(index));
    await rename(`${outPath}.tmp`, outPath);
    await writeFile(`${donePath}.tmp`, JSON.stringify([...done]));
    await rename(`${donePath}.tmp`, donePath);
  }

  const queue = ids.slice();
  await Promise.all(Array.from({ length: c.concurrency }, () => worker(queue)));
  await save();

  const books = Object.keys(index).length;
  let cites = 0;
  const works = new Set();
  for (const chs of Object.values(index)) {
    for (const list of Object.values(chs)) {
      for (const [id, n] of list) { cites += n; works.add(id); }
    }
  }
  console.log(`\n${corpus}: ${books} books, ${cites.toLocaleString()} citations, ${works.size.toLocaleString()} works with at least one`);
  console.log(`written to ${path.relative(ROOT, outPath)} (${((await readFile(outPath)).length / 1024 / 1024).toFixed(1)} MB)`);
  if (failed) console.log(`${failed} works could not be fetched`);
}

if (process.argv[1] && process.argv[1].endsWith("build-scripture-index.mjs")) {
  run().catch((e) => { console.error(e); process.exit(1); });
}
