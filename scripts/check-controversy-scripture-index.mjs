#!/usr/bin/env node
/*
 * The verse index of the controversies (v1/enrich/controversies/scripture/<lib>/<c>.json, 2026-11-08; owner: "integrate the
 * commentaries and controversies (thomists vs scotist) pages in the mereO site"; the plan: links both ways between the Scripture page and
 * the Controversies page). The Scripture page's verse panel draws "Controversies that name this verse" from it
 * (assets/js/page/faith-port-scripture-notes.js, controversyModel), each question opening the Controversies page at #<id>.
 *
 * WHY A GUARD. A line in that fold is a claim that the controversy names the verse: the file must name a real chapter of a book the
 * Scripture page has (the library slug of scripture-dev-core.js CANON / APOCRYPHA, never the Psalms, whose numbering differs by
 * edition), a verse inside the chapter, and an address the Controversies page opens (faith-controversies.js: #<id>, the controversy's
 * id beginning with its work). Every entry must survive the page's own model unchanged, so nothing the file holds is silently dropped.
 *
 * Run (as a theme script, from the theme root):
 *   node scripts/check-controversy-scripture-index.mjs --dir=<root holding v1/enrich/...>   the built files, before they are published
 *       [--counts=<{"<lib>/<c>": last verse}>]  [--data=<dir: index.json + pairs/<pair>.json>]  (the round trip through the linker)
 *   node scripts/check-controversy-scripture-index.mjs --live     the published files on the library worker (a fixed list of chapters)
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// as a theme script ROOT is the theme; from scratch, the worktree
const ROOT = existsSync(join(here, "..", "assets/js/faith-controversies.js")) ? resolve(here, "..") : "/Users/speter/.tfr_worktrees/theme-desk-1020";
const arg = (k) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : ""; };
const LIVE = process.argv.includes("--live"), DIR = arg("dir"), COUNTS = arg("counts") ? JSON.parse(readFileSync(arg("counts"), "utf8")) : null, DATA = arg("data");
if (!LIVE && !DIR) { console.error("usage: --dir=<root> [--counts=<file>] [--data=<dir>] | --live"); process.exit(2); }
const LIBRARY = "https://mo-tfr-library.mo-podcast-feed.workers.dev";

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass += 1; else { fail += 1; if (fail <= 60) console.log(`  FAIL ${msg}`); } };

// the Scripture page's books (library slug -> chapters), the linker of the Controversies page, the verse panel's model
const core = readFileSync(join(ROOT, "assets/js/page/scripture-dev-core.js"), "utf8");
const table = (name) => JSON.parse(new RegExp(`const ${name} = (\\[[\\s\\S]*?\\])\\.map\\(`).exec(core)[1].replace(/,\s*\]$/, "]"));
const BOOKS = new Map();
for (const b of table("CANON").concat(table("APOCRYPHA"))) BOOKS.set(b[3] || b[0], { slug: b[0], chapters: b[2] });
const csrc = readFileSync(join(ROOT, "assets/js/faith-controversies.js"), "utf8");
const A = csrc.indexOf("/* ── Scripture references ──"), B = csrc.indexOf("/* ── end Scripture references ── */");
ok(A >= 0 && B > A, "faith-controversies.js keeps its \"Scripture references\" banners");
const L = new Function(`${csrc.slice(A, B)}\nreturn { verseRefs };`)();
const KINDS = new Set(Object.keys(JSON.parse(/const KIND=(\{[^}]*\});/.exec(csrc)[1].replace(/'/g, '"').replace(/([{,])(\w+):/g, '$1"$2":'))));
const T = createRequire(import.meta.url)(join(ROOT, "assets/js/page/faith-port-scripture-notes.js"));
ok(typeof T.controversyModel === "function", "faith-port-scripture-notes.js exports controversyModel");
const FIELDS = ["question", "position", "report", "argument", "judgment", "resolution"];
const rank = (e) => (e.on.includes("question") ? 0 : e.on.some((k) => k === "position" || k === "report" || k === "argument") ? 1 : 2);

// the model on hand-made entries: what it draws, what it refuses
{
  const m = T.controversyModel([
    { id: "bellarmine-reformers-3-120", frag: "bellarmine-reformers-3-120", q: "Whether faith alone is sufficient for justification and salvation?", source: "Robert Bellarmine", debate_label: "Rome and the Reformation" },
    { id: "english-divines-698-1613", frag: "english-divines-698-1613", q: "Whether Christ’s righteousness or faith itself is imputed?", source: "The English divines", debate_label: "The English divines among themselves" },
    { id: "covenant-cocceian-2-043", frag: "covenant-cocceian-2-043", q: "Whether Old Testament believers had full remission?", source: "The Cocceians and the Voetians", debate_label: "The covenant: federal theology and its controversies" },
    { id: "x-1-1", frag: "x-1-1\"><script>alert(1)</script>", q: "an address the page does not read" },
    { id: "bellarmine-reformers-3-120", frag: "bellarmine-reformers-3-120", q: "the same controversy again" },
    { id: "y-1-1", frag: "y-1-1", q: "  " }, null, "text",
  ]);
  ok(m.length === 3, `the model keeps the three good entries (kept ${m.length})`);
  ok(m[0] && m[0].label === "Robert Bellarmine · Rome and the Reformation", `a work and its debate: "${m[0] && m[0].label}"`);
  ok(m[1] && m[1].label === "The English divines", `a debate named after the work is not repeated: "${m[1] && m[1].label}"`);
  ok(m[2] && m[2].label === "The Cocceians and the Voetians · The covenant", `a debate's name stops at its colon: "${m[2] && m[2].label}"`);
  ok(T.controversyModel(undefined).length === 0 && T.controversyModel({}).length === 0, "no list, no lines");
}

// the files
const files = [];
if (LIVE) {
  // chapters the 11-08 build has (the six verses the Scripture page was tested on, and more), and one it has not
  for (const k of ["romans/3", "romans/5", "john/6", "matthew/16", "james/2", "i-corinthians/11", "hebrews/6", "ii-maccabees/12"]) {
    const r = await fetch(`${LIBRARY}/v1/enrich/controversies/scripture/${k}.json`);
    ok(r.ok, `live ${k}.json is published (HTTP ${r.status})`);
    if (r.ok) files.push([k, await r.text()]);
  }
  const none = await fetch(`${LIBRARY}/v1/enrich/controversies/scripture/obadiah/1.json`);
  ok(none.status === 404, `a chapter no controversy names has no file (obadiah/1: HTTP ${none.status})`);
} else {
  const root = join(DIR, "v1/enrich/controversies/scripture");
  for (const lib of readdirSync(root)) for (const f of readdirSync(join(root, lib))) files.push([`${lib}/${f.replace(/\.json$/, "")}`, readFileSync(join(root, lib, f), "utf8")]);
}
ok(files.length > 0, "there are files to check");

// the controversies' own texts, for the round trip (the entry's verse is named where the entry says)
let CTRL = null;
if (DATA) {
  CTRL = new Map();
  for (const f of readdirSync(join(DATA, "pairs"))) for (const c of JSON.parse(readFileSync(join(DATA, "pairs", f), "utf8")).controversies || []) CTRL.set(c.id, c);
}
const textsOf = (c, k) => {
  if (k === "question") return [c.question];
  if (k === "judgment") return [(c.judgment || {}).why];
  if (k === "resolution") return [(c.resolution || {}).why];
  const o = [];
  for (const s of ["a", "b"]) { const x = c[s] || {}; if (k === "report") o.push(x.reported); if (k === "position") o.push(x.position); if (k === "argument") for (const g of x.arguments || []) o.push(g && g.arg); }
  return o;
};

let entries = 0, verses = 0;
const ids = new Set();
for (const [key, body] of files) {
  const [lib, cs] = key.split("/"), c = Number(cs), bk = BOOKS.get(lib);
  ok(Boolean(bk), `${key}: ${lib} is a library slug of the Scripture page's books`);
  ok(lib !== "psalms", `${key}: never the Psalms`);
  ok(bk && Number.isInteger(c) && c >= 1 && c <= bk.chapters, `${key}: chapter ${cs} is in ${lib}`);
  let d = null;
  try { d = JSON.parse(body); } catch (e) { ok(false, `${key}: JSON (${e.message})`); continue; }
  ok(d && d.book === lib && d.c === c && d.verses && typeof d.verses === "object", `${key}: {book: "${lib}", c: ${c}, verses}`);
  const vs = Object.entries((d && d.verses) || {});
  ok(vs.length > 0, `${key}: a file has a verse`);
  for (const [v, es] of vs) {
    verses += 1;
    const n = Number(v), last = COUNTS && COUNTS[key];
    ok(String(n) === v && n >= 1 && n <= 176, `${key}:${v} is a verse number`);
    if (COUNTS) ok(Boolean(last) && n <= last, `${key}:${v} is inside the chapter (${last || "?"} verses)`);
    ok(Array.isArray(es) && es.length > 0, `${key}:${v} has entries`);
    const seen = new Set();
    let prev = -1;
    for (const e of es || []) {
      entries += 1;
      ids.add(e.id);
      ok(typeof e.id === "string" && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.id), `${key}:${v} id ${e.id}`);
      ok(typeof e.pair === "string" && e.id.startsWith(`${e.pair}-`), `${key}:${v} ${e.id} begins with its work ${e.pair}`);
      ok(e.frag === e.id || e.frag === `${e.pair}/${e.id}`, `${key}:${v} ${e.id} has the address the Controversies page reads (${e.frag})`);
      ok(typeof e.q === "string" && e.q.trim().length > 8, `${key}:${v} ${e.id} has its question`);
      ok(KINDS.has(e.kind), `${key}:${v} ${e.id} kind ${e.kind}`);
      for (const f of ["pair_label", "source", "debate", "debate_label"]) ok(typeof e[f] === "string" && e[f].length > 0, `${key}:${v} ${e.id} ${f}`);
      ok(Array.isArray(e.on) && e.on.length > 0 && e.on.every((k) => FIELDS.includes(k)), `${key}:${v} ${e.id} says where the verse is named (${e.on})`);
      ok(!seen.has(e.id), `${key}:${v} ${e.id} once a verse`);
      seen.add(e.id);
      const r = Array.isArray(e.on) ? rank(e) : 9;
      ok(r >= prev, `${key}:${v} ${e.id} in order (named in the question first, then a side, then the judgment)`);
      prev = r;
      if (CTRL) {
        const ctl = CTRL.get(e.id);
        ok(Boolean(ctl) && !ctl.hide, `${key}:${v} ${e.id} is a shown controversy`);
        if (ctl) {
          ok(ctl.question === e.q, `${key}:${v} ${e.id} carries its own question`);
          const named = (e.on || []).every((k) => textsOf(ctl, k).some((t) => L.verseRefs(t).some((x) => BOOKS.get(lib) && x.slug === BOOKS.get(lib).slug && x.c === c && x.v === n)));
          ok(named, `${key}:${v} ${e.id}: the linker finds the verse in each field it is said to be named in (${e.on})`);
        }
      }
    }
    // the verse panel draws every entry, and its labels are the page's own words
    const m = T.controversyModel(es);
    ok(m.length === (es || []).length, `${key}:${v} the panel's model keeps every entry (${m.length} of ${(es || []).length})`);
    for (const x of m) ok(!/[—]/.test(x.label), `${key}:${v} ${x.frag}: no em dash in the label "${x.label}"`);
  }
}
console.log(`${files.length} files, ${verses} verses, ${entries} entries, ${ids.size} controversies`);
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
