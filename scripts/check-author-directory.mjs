/* Every author name the site can write must open an author page.
 *
 * Runs author-address.js's own rules, in the order the page runs them,
 * over every author spelling in the catalogues (the title index, the
 * works index's English, Latin and catalogue names, the English Editions
 * and both alias tables), in each shape a link sends it: the raw name,
 * its fold (All Works, search), and the plain key. Each must reach a
 * room on the rosters or an entry in the directory. Exits 1 on a miss.
 *
 *   node scripts/check-author-directory.mjs [--sample 50]
 * --sample prints that many random ?a= values for a headless check.
 */
import { readFileSync } from "node:fs";

const B = "https://mo-tfr-library.mo-podcast-feed.workers.dev";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36";
const j = async (u) => { const r = await fetch(u, { headers: { "user-agent": UA } }); if (!r.ok) throw new Error(`${r.status} ${u}`); return r.json(); };
await import(new URL("../assets/js/port/author-address.js", import.meta.url));
const { fold, plain, words, years, slug, unnamed, bare, numerals } = globalThis.MOAuthorAddress;
const DIR = new URL("../assets/data/faith-received/authors/", import.meta.url);
const read = (f) => JSON.parse(readFileSync(new URL(f, DIR), "utf8"));
const names = read("names.json").names;
const people = read("people.json").people;
const shards = {};
const entry = (key) => { const s = /^[a-z]/.test(key) ? key[0] : "0"; shards[s] = shards[s] || read(`w-${s}.json`).authors; return shards[s][key]; };

const NS = ["pl", "gf", "po", "ed", "md", "rc", "lu", "rf", "hl"];
const rosters = (await Promise.all(NS.map((ns) => j(`${B}/v1/bible/${ns}/rooms/index.json`)))).flatMap((d) => d.authors);
const roomFold = new Map();
const roomWords = new Map();
for (const e of rosters) {
  roomFold.set(fold(e.s), e); roomFold.set(fold(e.a), e);
  const w = words(e.a); if (!roomWords.has(w)) roomWords.set(w, []); roomWords.get(w).push(e);
}

// The page's order: rosters by fold, rosters by words (year-checked), directory. A designation that names nobody
// ("Uncertain author (Bede?)") meets the rosters under its whole name only, a bare one ("Anonymous") not at all, and a
// match by words agrees on a regnal number (author-address.js, 2026-10-23).
function resolve(a) {
  const pl = plain(a), ys = years(a);
  const nobody = unnamed(a) || unnamed(pl);
  const rosters = !bare(a);
  if (rosters) for (const f of nobody ? [fold(a)] : [fold(a), fold(pl)]) if (roomFold.has(f)) return `room ${roomFold.get(f).s}`;
  const by = rosters && !nobody ? (roomWords.get(words(pl)) || []).filter((e) => numerals(e.a) === numerals(pl)) : [];
  if (by.length) {
    let best = by[0];
    if (by.length > 1 && ys.length) {
      const gap = (e) => (e.y ? Math.min(...ys.map((y) => Math.abs(y - e.y))) : 9999);
      for (const e of by) if (gap(e) < gap(best)) best = e;
    }
    if (!(ys.length && best.y && Math.abs(ys[0] - best.y) > 20 && !(ys[0] > best.y && ys[0] - best.y <= 95))) return `room ${best.s}`;
  }
  const t = names[fold(a)] || names[fold(pl)] || names[fold(slug(pl))] || "";
  if (!t) return null;
  if (t.startsWith("@@")) return Object.keys(people).some((k) => k.startsWith(`${t.slice(2)}-`)) ? `list ${t}` : null;
  if (t.startsWith("@")) return people[t.slice(1)] && entry(t.slice(1)) ? `page ${t}` : null;
  return `room ${t}`;
}

// --links <file>: resolve one ?a= value per line (decoded) and print where each lands.
const li = process.argv.indexOf("--links");
if (li > 0) {
  const lines = readFileSync(process.argv[li + 1], "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
  let bad = 0;
  for (const l of lines) { const a = decodeURIComponent(l); const r = resolve(a); if (!r) bad++; console.log(`${(r || "NO PAGE").padEnd(44)} ${a}`); }
  process.exit(bad ? 1 : 0);
}
const all = new Set();
const add = (s) => { s = String(s || "").replace(/&agrave;/g, "à").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim(); if (s) all.add(s); };
const titles = await j(`${B}/v1/index/works-titles.json`);
for (const r of titles.rows) add(r[3]);
for (const w of (await j(`${B}/v1/works-index.json`)).works) { add(w.author); add(w.author_en); add(w.author_la); }
for (const w of (await j(`${B}/v1/mo/index.json`)).works || []) add(w.author);
for (const [k, v] of Object.entries(await j(`${B}/v1/author_aliases.json`))) { add(k); add(v); }
const local = JSON.parse(readFileSync(new URL("../assets/data/faith-received/english-author-aliases.json", import.meta.url), "utf8")).aliases || {};
for (const [k, v] of Object.entries(local)) { add(k); add(v); }
for (const e of rosters) { add(e.a); }
for (const [k, p] of Object.entries(people)) { add(k); add(p[0]); }

const fails = [];
let n = 0;
for (const a of all) {
  for (const shape of [a, fold(a)]) {
    n++;
    if (!resolve(shape)) fails.push(shape === a ? a : `${a}  (folded: ${shape})`);
  }
}
// Names that once opened someone else's room (Ian, 2026-10-23: "for migne we name pelagius but clicking we get to
// uncertain author"): each must land where its name says, or at least not in the room it used to reach.
const RULES = [
  ["Uncertain author (Jerome of Stridon?)", (r) => !/^room /.test(r || "")],
  ["Uncertain author", (r) => !/^room /.test(r || "")],
  ["uncertainauthor", (r) => !/^room /.test(r || "")],
  ["Anonymous", (r) => !/^room /.test(r || "")],
  ["Anonymous (Paschal Chronicle)", (r) => r === "room anonymous-paschal-chronicle"],
  ["Pelagius", (r) => /^room (pl\/)?pelagius$/.test(r || "")],
  ["Pelagius the Heresiarch", (r) => /^room (pl\/)?pelagius$/.test(r || "")],
  ["Pelagius I", (r) => !/^room (pl\/)?pelagius$/.test(r || "")],
];
for (const [a, ok] of RULES) if (!ok(resolve(a))) fails.unshift(`${a}  (lands on ${resolve(a) || "no page"}, against the rule)`);
const ownKeys = Object.keys(people).length;
console.log(`${all.size.toLocaleString()} distinct author names (${n.toLocaleString()} link shapes); ${rosters.length} rooms; ${ownKeys.toLocaleString()} directory pages`);
console.log(`${fails.length} names reach no page`);
for (const f of fails.slice(0, 60)) console.log(`  ${f}`);
const si = process.argv.indexOf("--sample");
if (si > 0) {
  const k = Number(process.argv[si + 1] || 50);
  const arr = [...all];
  const pick = [];
  for (let i = 0; i < k; i++) pick.push(arr[Math.floor(Math.random() * arr.length)]);
  console.log("SAMPLE " + JSON.stringify(pick));
}
process.exit(fails.length ? 1 : 0);
