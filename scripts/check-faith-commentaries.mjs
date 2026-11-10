#!/usr/bin/env node
/*
 * The Commentaries page's model (assets/js/page/faith-commentaries-model.js, 2026-11-08; owner: "integrate the commentaries and
 * controversies (thomists vs scotist) pages in the mereO site"; the plan: "every Bible commentary we hold, by book and by tradition,
 * plus the whole-Bible sets. Each row opens the Scripture desk at that book with that commentary already open").
 *
 * WHY A GUARD. The page promises that "Open in Scripture" opens the Scripture desk with THAT commentary open. The desk's pane honours
 * ?ref=<book>.<c>.<v>&cp=<slug> only when the chapter's list holds the work (commentary-pages.js listWorks, commentary-pane.js
 * commentaries): a map entry is listed on a chapter where the map gives its page there (an, inside c1..c2), or, for a work the rank calls
 * whole-Bible, at its range's first chapter where the book begins in it (sp). A row that sends the reader to a chapter where its work is
 * not listed opens someone else's commentary, silently. So: every row that offers Scripture lands on such a chapter; a work the map
 * places at no chapter offers the reader only. The groups are the Change list's (scripture-verse-rail.js): the curated keys first in
 * their order, the rest by tradition in the rail's order and names, the sets on the whole Bible one row a set.
 *
 * Run: node scripts/check-faith-commentaries.mjs            (fixtures, offline)
 *      node scripts/check-faith-commentaries.mjs --live     (also every book of the live map, from the library worker)
 */
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const req = createRequire(import.meta.url);
globalThis.window = globalThis;
globalThis.document = { querySelector: () => null };
req(join(ROOT, "assets/js/page/scripture-verse-rail.js"));
req(join(ROOT, "assets/js/page/scripture-dev-core.js"));
const VR = globalThis.FRVerseRail, S = globalThis.MOScriptureDev;
const M = req(join(ROOT, "assets/js/page/faith-commentaries-model.js"));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass += 1; else { fail += 1; console.log(`  FAIL ${msg}`); } };
const book = (slug) => S.BOOK_BY_SLUG.get(slug);
const rowsOf = (m) => [
  ...m.keys.flatMap((au) => au.works.map((w) => ({ sec: "keys", au, w }))),
  ...m.groups.flatMap((g) => g.authors.flatMap((au) => au.works.map((w) => ({ sec: `t:${g.key}`, au, w })))),
  ...m.other.flatMap((au) => au.works.map((w) => ({ sec: "other", au, w }))),
  ...m.whole.flatMap((g) => g.rows.flatMap((r) => (r.kind === "set" ? [{ sec: `w:${g.key}`, set: r, w: r }] : r.au.works.map((w) => ({ sec: `w:${g.key}`, au: r.au, w }))))),
];
const vol = (m, slug) => { for (const r of rowsOf(m)) { const v = r.w.vols.find((x) => x.slug === slug); if (v) return { ...r, v }; } return null; };
// the pane's own listing rule, stated here apart from the model: the chapters on which a map entry is in the chapter's list
const listedOn = (e, ch, rank) => {
  const inRange = ch >= (Number(e.c1) || 1) && ch <= (Number(e.c2) || 999);
  if (inRange && e.an && e.an[ch] != null && e.an[ch] !== "") return true;
  return Number(e.c1) > 0 && ch === Number(e.c1) && !(Number(e.c2) < Number(e.c1)) && !(e.an && e.an[ch] != null) && e.sp != null && ((rank.works[e.w] || [])[1] === 1);
};
const chapterOf = (href) => Number((/[?&]ref=[a-z0-9-]+\.(\d+)\./.exec(href || "") || [])[1]);

// ── fixtures, each modeled on a real entry of v1/devotion.json.gz ──────────────────────────────────────────────────────────────
const rank = {
  works: {
    "calvin-commentary-on-romans": [98, 0, 16, 100, 1], "lapide-vol-18": [94, 1, 16, 75, 2], "westminster-eebo": [96, 1, 17, 75, 2],
    "pareus-in-romanos": [60, 0, 16, 50, 0], "pld-7604": [80, 0, 12, 75, 1], "pg-theophylact": [55, 0, 11, 50, 0], "pld-bollandist": [20, 0, 17, 10, 0],
    "bucer-romans": [70, 0, 16, 60, 1], "wesley-sermons": [30, 1, 18, 20, 0], "hammond-nt": [50, 1, 17, 40, 0], "patrick-romans": [40, 1, 17, 30, 0],
  },
  authors: { "Rudolf Gwalther": 40 },
  books: { romans: [["John Calvin", ["calvin-commentary-on-romans"], 1509], ["Peter Lombard", ["pld-7604"], 1096]] },
};
const sets = {
  trads: [["md", "Medieval"], ["lu", "Lutheran"], ["rf", "Continental Reformed"], ["rc", "Roman Catholic"], ["ed", "English Divines"]],
  sets: [
    { id: "lapide", label: "Lapide", title: "Commentaries on Sacred Scripture", author: "Cornelius a Lapide", trad: "rc", year: 1614, members: ["lapide-vol-18"] },
    { id: "westminster", label: "English Annotations", title: "Annotations upon All the Books of the Old and New Testament", author: "Westminster Assembly", trad: "ed", year: 1645, members: ["westminster-eebo"] },
    { id: "bucer", label: "Bucer", title: "Commentaries on Scripture", author: "Martin Bucer", trad: "rf", year: 1527, members: ["bucer-romans"] },
  ],
  of: { "lapide-vol-18": "lapide", "westminster-eebo": "westminster", "bucer-romans": "bucer" },
};
const romans = [
  // a key with its chapters on the map
  { w: "calvin-commentary-on-romans", t: "Commentary on Romans", a: "John Calvin", sh: "x", tr: "Reformed", k: "commentary", c1: 1, c2: 16, an: { 1: 17, 2: 44, 16: 325 } },
  // a key whose map begins at chapter 3, an anchor outside its range (chapter 20) and an empty one (chapter 2)
  { w: "pld-7604", t: "Collectanea on the Epistles of Paul", a: "Peter Lombard", sh: "pl", k: "commentary", c1: 2, c2: 16, an: { 1: 1300, 2: "", 3: 1350, 20: 9 } },
  // a set volume with chapters; a whole-Bible book in a book whose page numbers repeat (ar) known only where the book begins (sp)
  { w: "lapide-vol-18", t: "Commentaries on Sacred Scripture", a: "Cornelius a Lapide", sh: "x", tr: "Roman Catholic", k: "commentary", c1: 1, c2: 16, an: { 1: 63, 2: 83 } },
  { w: "westminster-eebo", t: "Annotations upon all the books of the Old and New Testament", a: "Westminster Assembly", sh: "ed", k: "commentary", c1: 1, c2: 16, sp: 203 },
  // a Reformed commentary on the book, its first chapter's page a repeated printing (ar)
  { w: "pareus-in-romanos", t: "Commentary on the Divine Epistle to the Romans", a: "David Pareus", sh: "x", tr: "Reformed", k: "commentary", c1: 1, c2: 16, an: { 1: 5, 2: 40 }, ar: { 1: 100005 } },
  // a Migne volume filed under the book with no chapter pages: the reader only
  { w: "pld-1167", t: "Expositions on the Epistles of Saint Paul", a: "Uncertain author", sh: "pl", k: "commentary", c1: 1, c2: 1 },
  // the shelves and the centuries: a Greek of the 11th century is Byzantine, a Latin of the 17th Other
  { w: "pg-theophylact", t: "Commentary on the Epistle to the Romans", a: "Theophylact, Archbishop of Bulgaria", sh: "x", tr: "Greek Fathers", k: "commentary", c1: 1, c2: 16, an: { 1: 400 } },
  { w: "pld-bollandist", t: "Notes on Romans", a: "Jean Bolland", sh: "pl", k: "commentary", c1: 1, c2: 16, an: { 4: 77 } },
  // a set's volume titled for this one book is still the set's (the Glossa's volumes are titled book by book), as the pane's Whole Bible
  // row has it; a work the rank calls whole-Bible outside the sets, titled for this one book, is the book's
  { w: "bucer-romans", t: "Commentary on Romans", a: "Martin Bucer", sh: "x", tr: "Reformed", k: "commentary", c1: 1, c2: 16, an: { 1: 3 } },
  { w: "patrick-romans", t: "A Paraphrase and Annotations upon the Epistle to the Romans", a: "Simon Patrick", sh: "ed", k: "commentary", c1: 1, c2: 16, an: { 1: 12 } },
  // a sermon on one passage, in a volume the rank calls whole-Bible, is a sermon on the book
  { w: "wesley-sermons", t: "Sermons on Several Occasions", st: "Justification by Faith. A SERMON On ROMANS iv. 5", a: "John Wesley", sh: "ed", k: "sermons", c1: 4, c2: 4, an: { 4: 59 } },
  // a whole-Bible work outside the sets
  { w: "hammond-nt", t: "A Paraphrase and Annotations upon all the Books of the New Testament", a: "Henry Hammond", sh: "ed", k: "commentary", c1: 1, c2: 16, an: { 1: 450 } },
  // a homily series through the book is a commentary; a treatise is another work
  { w: "gwalther-ad-romanos", t: "Homilies on the Epistle to the Romans", a: "Rudolf Gwalther", sh: "x", tr: "Reformed", k: "sermons", c1: 1, c2: 16, an: { 1: 41, 2: 79, 3: 102, 4: 129, 5: 148 } },
  { w: "arminius-rom7", t: "On the True and Genuine Sense of Chapter VII of the Epistle to the Romans", a: "Jacobus Arminius", sh: "x", tr: "Reformed", k: "treatises", c1: 7, c2: 7, an: { 7: 1 } },
  // one volume listed twice on the book (two pieces of a collected volume): one row, the earlier chapter's piece
  { w: "luther-wa-17-ii", t: "Weimar Edition: Writings, Volume 17.2", st: "Sermons on Romans 12", a: "Martin Luther", sh: "x", tr: "Lutheran", k: "collected", c1: 12, c2: 12, an: { 12: 88 } },
  { w: "luther-wa-17-ii", t: "Weimar Edition: Writings, Volume 17.2", st: "Sermons on Romans 13", a: "Martin Luther", sh: "x", tr: "Lutheran", k: "collected", c1: 13, c2: 13, an: { 13: 120 } },
];
const dates = M.datesMap({ authors: { "John Calvin": { y: 1509, dates: "1509–1564" }, "Peter Lombard": { y: 1096, dates: "c. 1096–1160" }, "Walafrid Strabo": { y: 808, dates: "c. 808–849", aliases: ["Walahfrid Strabo"] } } });
const m = M.build({ book: book("romans"), entries: romans, rank, sets, dates, VR });

ok(m.keys.map((au) => au.name).join("|") === "John Calvin|Peter Lombard", `the keys in the curated order (got ${m.keys.map((au) => au.name).join("|")})`);
{
  const r = vol(m, "calvin-commentary-on-romans");
  ok(r && r.sec === "keys" && r.v.desk === "/the-faith-received/scripture/?ref=romans.1.1&cp=calvin-commentary-on-romans", `Calvin opens the desk at Romans 1 with his commentary (got ${r && r.v.desk})`);
  ok(r && r.v.read === "/the-faith-received/read/?w=calvin-commentary-on-romans&at=ch%3A1#b17-0", `Calvin's Read opens the reader at chapter 1's page and heading (got ${r && r.v.read})`);
  ok(r && r.au.years === "1509–1564" && r.w.cover === "Chapters 1–16", `Calvin's row: his years and the chapters it covers (got ${r && r.au.years}, ${r && r.w.cover})`);
}
{
  const r = vol(m, "pld-7604");
  ok(r && chapterOf(r.v.desk) === 3, `a work opens at the first chapter of its own range the map gives a page for: Lombard at 3, not 1 (out of range), 2 (empty) or 20 (got ${r && r.v.desk})`);
  ok(r && r.au.years === "c. 1096–1160", "an author's years from the dates of names");
}
{
  const r = vol(m, "pld-1167");
  ok(r && !r.v.desk && r.v.read === "/the-faith-received/read/?w=pld-1167" && r.w.cover === "", `a work placed at no chapter offers the reader at its start only (got ${r && r.v.desk}, ${r && r.v.read})`);
}
{
  const r = vol(m, "westminster-eebo");
  ok(r && r.sec === "w:ed" && r.set && chapterOf(r.v.desk) === 1 && r.v.read === "/the-faith-received/read/?w=westminster-eebo#b203-0" && r.w.cover === "",
    `a whole-Bible set known by where the book begins opens at its first chapter, Read at that page with no chapter heading, claiming no chapters (got ${r && r.sec}, ${r && r.v.desk}, ${r && r.v.read}, "${r && r.w.cover}")`);
}
{
  const r = vol(m, "pareus-in-romanos");
  ok(r && r.v.read === "/the-faith-received/read/?w=pareus-in-romanos&at=ch%3A1#b100005-0", `a repeated printing opens at the reader's own page id (ar) (got ${r && r.v.read})`);
  ok(r && r.sec === "t:rf", `Pareus under Continental Reformed (got ${r && r.sec})`);
}
{
  const t = (slug) => { const r = vol(m, slug); return r && r.sec; };
  ok(t("pg-theophylact") === "t:by", `a Greek of the 11th century is Byzantine (got ${t("pg-theophylact")})`);
  ok(t("pld-bollandist") === "t:x", `a Latin editor of the 17th century is Other (got ${t("pld-bollandist")})`);
  ok(t("lapide-vol-18") === "w:rc", `Lapide's volume is the Lapide set, Roman Catholic (got ${t("lapide-vol-18")})`);
  ok(t("bucer-romans") === "w:rf", `a set's volume titled for the one book is its set's row (got ${t("bucer-romans")})`);
  ok(t("patrick-romans") === "t:ed", `a whole-Bible work outside the sets titled for the one book is the book's (got ${t("patrick-romans")})`);
  { const r = vol(m, "bucer-romans"); ok(r && r.set && /commentaries on scripture/.test(r.set.find), "a set's volume is found by its set's own names"); }
  ok(t("wesley-sermons") === "other", `a sermon on one passage, in a volume the rank calls whole-Bible, is among the other works (got ${t("wesley-sermons")})`);
  ok(t("hammond-nt") === "w:ed", `a whole-Bible work outside the sets is under its tradition among the whole-Bible commentaries (got ${t("hammond-nt")})`);
  ok(t("gwalther-ad-romanos") === "t:rf", `a series of homilies through the book is a commentary (got ${t("gwalther-ad-romanos")})`);
  ok(t("arminius-rom7") === "other", `a treatise is among the other works (got ${t("arminius-rom7")})`);
}
{
  const rows = rowsOf(m).filter((r) => r.w.vols.some((v) => v.slug === "luther-wa-17-ii"));
  ok(rows.length === 1 && rows[0].w.main.t === "Sermons on Romans 12" && rows[0].w.main.vol === "Weimar Edition: Writings, Volume 17.2" && rows[0].w.cover === "Chapters 12–13",
    `a volume listed twice on a book is one row, named by the piece at its first chapter (got ${rows.length}, ${rows[0] && rows[0].w.main.t}, ${rows[0] && rows[0].w.cover})`);
}
{
  const set = m.whole.flatMap((g) => g.rows).find((r) => r.kind === "set" && r.set.id === "lapide");
  ok(set && set.name === "Cornelius a Lapide" && set.vols.length === 1 && set.cover === "Chapters 1–2", "a set is one row named by its author, its volumes on the book under it");
  ok(m.whole.map((g) => g.key).join(",") === "rf,rc,ed", `the whole-Bible traditions in the rail's order (got ${m.whole.map((g) => g.key).join(",")})`);
  ok(m.whole.map((g) => g.name).join(",") === "Continental Reformed,Roman Catholic,English Divines", "the traditions by the rail's names");
}
// the volumes of one row are named apart: by name, else title, else name with chapters, else place
{
  const v = (label, t, chs) => ({ label, t, chs });
  const R = book("romans");
  ok(M.volLabels([v("Vol. 4", "Synopsis", [1]), v("Vol. 5", "Synopsis", [2])], R).join("|") === "Vol. 4|Vol. 5", "volumes named apart by their own names");
  ok(M.volLabels([v("Chapters 1\u201316", "Commentary on Romans", [1, 16]), v("Chapters 1\u201316", "Paraphrase on Romans", [1, 16])], R).join("|") === "Commentary on Romans|Paraphrase on Romans", "else by their titles");
  ok(M.volLabels([v("Vol. 2", "The Holy Bible", [1, 34]), v("Vol. 2", "The Holy Bible", [35, 42])], R).join("|") === "Vol. 2 \u00b7 Chapters 1\u201334|Vol. 2 \u00b7 Chapters 35\u201342", "else by name and chapters");
  ok(new Set(M.volLabels([v("", "Exposition on Psalm 64", []), v("", "Exposition on Psalm 64", [])], R)).size === 2, "else by place, never two alike");
}
ok(m.groups.map((g) => g.key).join(",") === "pl,by,lu,rf,ed,x", `the book's traditions in the rail's order, Other last (got ${m.groups.map((g) => g.key).join(",")})`);
ok(m.n.all === rowsOf(m).length && m.n.all === m.n.keys + m.n.book + m.n.whole + m.n.other, `the counts add up (${m.n.all} rows)`);
// every row that offers Scripture lands on a chapter where the pane lists it; Psalms open without a chapter heading
for (const r of rowsOf(m)) for (const v of r.w.vols) if (v.desk) ok(listedOn(v.e, chapterOf(v.desk), rank), `${v.slug}: the desk lists it on chapter ${chapterOf(v.desk)}`);
{
  const ps = M.build({ book: book("psalms"), entries: [{ w: "augustine-ps", t: "Expositions on the Psalms", a: "Augustine of Hippo", sh: "pl", k: "commentary", c1: 1, c2: 150, an: { 51: 581 } }], rank, sets, dates, VR });
  const r = vol(ps, "augustine-ps");
  ok(r && r.v.desk === "/the-faith-received/scripture/?ref=psalms.51.1&cp=augustine-ps" && r.v.read === "/the-faith-received/read/?w=augustine-ps#b581-0" && r.w.cover === "Psalm 51",
    `the Psalms: the psalm's number, no chapter heading in the reader (got ${r && r.v.desk}, ${r && r.v.read}, ${r && r.w.cover})`);
}
{
  const none = M.build({ book: book("obadiah"), entries: [], rank, sets, dates, VR });
  ok(none.n.all === 0 && !none.keys.length && !none.groups.length && !none.whole.length, "a book with no commentary has no rows");
}

// ── the live map: every book, every row (--live) ──────────────────────────────────────────────────────────────────────────────
if (process.argv.includes("--live")) {
  const BASE = "https://mo-tfr-library.mo-podcast-feed.workers.dev";
  const get = async (p) => {
    const r = await fetch(`${BASE}/${p}`, { headers: { "User-Agent": "Mozilla/5.0 (check-faith-commentaries)" } });
    if (!r.ok) throw new Error(`${r.status} ${p}`);
    let b = Buffer.from(await r.arrayBuffer());
    if (b[0] === 0x1f && b[1] === 0x8b) b = zlib.gunzipSync(b);
    return JSON.parse(b.toString("utf8"));
  };
  const [dev, lrank, lsets, ad] = await Promise.all([get("v1/devotion.json.gz"), get("v1/scripture/rank.json"), get("v1/scripture/sets.json"), get("v1/enrich/author_dates.json")]);
  const ldates = M.datesMap(ad);
  let rows = 0, desk = 0, bad = 0;
  for (const b of S.BOOKS) {
    const entries = (dev.books || {})[b.lib] || [];
    const lm = M.build({ book: b, entries, rank: lrank, sets: lsets, dates: ldates, VR });
    const all = rowsOf(lm);
    rows += all.length;
    ok(lm.n.all === all.length, `${b.slug}: the counts add up`);
    // every map volume on the book is on the page
    const shown = new Set(all.flatMap((r) => r.w.vols.map((v) => v.slug)));
    for (const e of entries) if (!shown.has(e.w)) { bad += 1; ok(false, `${b.slug}: ${e.w} is on the map and not on the page`); }
    for (const r of all) if (r.w.vols.length > 1) ok(new Set(M.volLabels(r.w.vols, b)).size === r.w.vols.length, `${b.slug}: ${r.w.main.slug}'s volumes are named apart`);
    for (const r of all) for (const v of r.w.vols) {
      ok(!!v.read, `${b.slug}: ${v.slug} has a Read`);
      if (!v.desk) continue;
      desk += 1;
      const c = chapterOf(v.desk), es = entries.filter((e) => e.w === v.slug);
      if (!(c >= 1 && c <= b.chapters && es.some((e) => listedOn(e, c, lrank)))) { bad += 1; ok(false, `${b.slug}: ${v.slug} sent to chapter ${c}, where the desk does not list it`); }
    }
    // the curated keys: in order, each one the map holds on the book
    const keyOrder = ((lrank.books || {})[b.lib] || []).flatMap(([, slugs]) => slugs);
    const keyRows = lm.keys.flatMap((au) => au.works.flatMap((w) => w.vols.map((v) => v.slug)));
    ok(keyRows.every((s) => keyOrder.includes(s)), `${b.slug}: only curated keys among the keys`);
  }
  console.log(`  live: ${S.BOOKS.length} books, ${rows} rows, ${desk} volumes open in Scripture${bad ? `, ${bad} problems` : ""}`);
}

if (fail) { console.log(`\n✗ commentaries page: ${pass} passed, ${fail} failed.`); process.exit(1); }
console.log(`✓ commentaries page: ${pass} checks; every row that offers Scripture opens on a chapter where the desk lists its commentary.`);
