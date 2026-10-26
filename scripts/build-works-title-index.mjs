/* Slim title index for GET /v1/titles.
 * Row: [corpus, id, title, author, year, alt]
 * `alt` is extra text that should MATCH but never DISPLAY: the Latin
 * title, and the slug's own words. Two real misses drove it:
 *   "de civitate dei"    — the Latin title was not indexed at all, in a
 *                          library that is mostly Latin.
 *   "ninety-five theses" — the work is titled "The 95 Theses"; only its
 *                          slug spells the number out. */
import { writeFileSync, readFileSync } from "node:fs";
const B="https://mo-tfr-library.mo-podcast-feed.workers.dev";
const j = async (u) => { const r=await fetch(u,{headers:{"user-agent":"curl/8.7.1"}}); if(!r.ok) throw new Error(`${r.status} ${u}`); return r.json(); };
const EX=/^(pld|pg|po|eebo)-\d+$/;

/* Author names, canonicalised across the shelves.
 *
 * The same person is spelled differently by different catalogues, and
 * an author scope that does not know that finds a fraction of a
 * writer's work. Athanasius is the case that exposed it: the native
 * catalogue was folded to "Athanasius of Alexandria" on 2026-09-11, but
 * Patrologia Graeca's own nav still says "Athanasius", so 110 of his
 * works sat under a name the author page never asks for.
 *
 * Two sources, and neither alone is enough:
 *   v1/author_aliases.json  the corpus owner's 42 rulings (Petau, Beza,
 *                           Photius, Mansi and the rest).
 *   FOLDS below             the two folds applied directly to the
 *                           native catalogue and recorded only in
 *                           docs/faith-received/CATALOGUE-CHANGES-2026-09-11.md,
 *                           so they are nowhere a machine can read.
 */
const FOLDS = {
  "Athanasius": "Athanasius of Alexandria",
  "Bede": "Bede the Venerable",
};
const ALIASES = { ...FOLDS, ...(await j(`${B}/v1/author_aliases.json`).catch(() => ({}))) };
const canonAuthor = (a) => ALIASES[String(a || "").trim()] || String(a || "").trim();
const rows=[];
const slugWords = (id) => /^[a-z0-9-]+$/.test(String(id)) ? String(id).replace(/-/g," ") : "";
function push(c,id,t,a,y,latin){
  t=String(t||"").trim(); if(!t) return;
  const alt=[String(latin||"").trim(), slugWords(id)].filter(Boolean).join(" ");
  rows.push([c,String(id),t,canonAuthor(a),y||0,alt]);
}
const ll=await j(`${B}/v1/works-index.json`);
for (const w of ll.works) if(!EX.test(w.slug||"")) push("tfr",w.slug,w.title,w.author,0,w.title_la);
const cf=await j(`${B}/v1/confessions-index.json`);
for (const c of (cf.confessions||[])) push("confessions",c.slug,c.title,"",c.year||0,"");
const mo=await j(`${B}/v1/mo/index.json`);
for (const w of (mo.works||[])) push("mo",w.slug,w.title,w.author,0,"");
const ee=await j("https://eebo-backup.vercel.app/data/catalogue.json");
const keep=new Set(JSON.parse(readFileSync(process.env.THEO,"utf8")).ids.map(String));
for (const w of ee) if(keep.has(String(w.i))) push("eebo",w.i,w.t,w.a,w.y||0,"");
for (const [c,host,en] of [["pld","pld-patrologia-latina","te"],["pg","patrologia-graeca","e"],["po","patrologia-orientalis","te"]]) {
  const nav=await j(`https://${host}.vercel.app/data/nav.json`);
  for (const [id,v] of Object.entries(nav.docs||{})) {
    const eng = v[en] || v.t;
    const latin = (v.t && v.t !== eng) ? v.t : "";
    push(c,id,eng,v.ae||v.a,v.v||0,latin);
  }
}
/* Augustine. Left out of every earlier build of this index, so none of
 * his 124 works could be found by name and /v1/titles answered "no such
 * work" for the City of God's own author. The catalogue is the second
 * half of the aquinas-studies nav — the first half was Thomas Aquinas
 * and was pulled on 2026-07-28 — and the cut is the same file-number
 * floor faith-corpora.js uses (AUGUSTINE_FROM = 151). Kept in step with
 * that constant: if it moves there it must move here. */
const AUGUSTINE_FROM = 151;
const au = await j("https://aquinas-studies.vercel.app/data/nav.json").catch(() => []);
for (const group of (Array.isArray(au) ? au : [])) {
  for (const sec of (group.s || [])) {
    const f = String(sec.f || "");
    const n = parseInt((f.match(/_(\d+)\.html$/) || [])[1], 10);
    if (!(n >= AUGUSTINE_FROM)) continue;
    push("augustine", f.replace(/\.html$/, ""), sec.n, "Augustine of Hippo", 0, "");
  }
}

/* Retired works (assets/data/faith-received/work-forwards.json) are gone
 * from the English Editions catalogue, so their rows are already absent;
 * their old names ride on the copy that replaced them as `alt`, so a
 * search for "1689" still finds the London Baptist Confession (1677).
 * Same rule as scripts/retire-works.mjs, which patches a live index. */
{
  const F = JSON.parse(readFileSync(new URL("../assets/data/faith-received/work-forwards.json", import.meta.url), "utf8")).works || {};
  for (const [old, w] of Object.entries(F)) {
    const m = /^(eebo|pld|pg|po)-(.+)$/.exec(w.to);
    const [c, id] = m ? [m[1], m[2]] : /^aq-/.test(w.to) ? ["augustine", w.to.slice(3)] : [w.toCorpus || "tfr", w.to];
    const row = rows.find((r) => r[0] === c && r[1] === id);
    if (!row) { console.warn(`work-forwards: no title row for ${c}:${id} (from ${old})`); continue; }
    const words = [w.title, w.search, old.replace(/-/g, " ")].filter(Boolean).join(" ");
    if (!String(row[5] || "").includes(words)) row[5] = [row[5], words].filter(Boolean).join(" ");
  }
}
/* THE CATALOGUE'S AUTHOR (2026-10-23, the owner relaying Ian: "fix this and elsewhere"). The navs above carry Migne's own
 * attributions ("Dionysius the Areopagite, pt. 2", "Clement of Rome, pt. 1", PO's French names) and this index kept them after
 * the works-index corrected them: pld-2269 Pelagius, pld-332 and pld-349 Pseudo-Hegesippus, pld-3783 Pseudo-Damasus, the
 * re-attributed Scotus and Ockham works. A row the works-index lists now takes the catalogue's English name (author_en, else
 * author) through canonAuthor, as the reader and the lexicon print it. Kept as they were: the confessions (documents), Augustine
 * and the Mere Orthodoxy texts (not in the catalogue), a retired PG record (the index lists the record itself; the work that holds
 * its first column can be another man's), and an EEBO row whose catalogue name is the same person in another form: 12,655 of the
 * 15,569 EEBO rows are not in the works-index, so the rest keep the EEBO catalogue's "Surname, Forename, dates" with them.
 * OVERRIDES=<runs/work_author_overrides.json> names the re-attributed records the works-index no longer lists (nine PG rows). */
{
  const catName = new Map(ll.works.map((w) => [w.slug, w.author_en || w.author || ""]));
  const ov = process.env.OVERRIDES ? (JSON.parse(readFileSync(process.env.OVERRIDES, "utf8")).works || {}) : {};
  const keyOf = (c, id) => (["eebo", "pld", "pg", "po"].includes(c) ? `${c}-${id}` : String(id));
  const STOPW = new Set("saint st blessed venerable bishop archbishop pope sir king doctor dr rev mr of the de la le von van ca fl approximately active pt".split(" "));
  const person = (a) => new Set((String(a || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().match(/[a-z]+/g) || []).filter((w) => w.length > 1 && !STOPW.has(w)));
  const within = (x, y) => [...x].every((w) => y.has(w));
  let changed = 0;
  for (const r of rows) {
    if (r[0] === "confessions" || r[0] === "augustine" || r[0] === "mo") continue;
    const k = keyOf(r[0], r[1]);
    const a = catName.has(k) ? catName.get(k) : (ov[k] && ov[k].author) || "";
    if (!a) continue;
    const name = canonAuthor(a);
    if (name === r[3]) continue;
    if (r[0] === "eebo") { const p = person(name), q = person(r[3]); if (p.size && q.size && (within(p, q) || within(q, p))) continue; }
    r[3] = name; changed++;
  }
  console.log(`catalogue authors: ${changed.toLocaleString()} rows renamed`);
}
const body=JSON.stringify({ v:2, n:rows.length, rows });
writeFileSync(process.env.OUT, body);
const { gzipSync } = await import("node:zlib");
console.log(`${rows.length.toLocaleString()} works, ${(body.length/1048576).toFixed(2)} MB raw, ${(gzipSync(Buffer.from(body)).length/1024).toFixed(0)} KB gz`);
