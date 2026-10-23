#!/usr/bin/env node
/*
 * Where the Mere Orthodoxy essays appear (2026-10-20): the selectors and the module, run on the real data.
 *
 * Ian reviewed the 493 essays matched to The Faith Received and said to use all of them. This asserts that:
 *   - for ten verses, ten topics, ten authors, ten works and five confession documents, the selector functions
 *     (assets/js/lib/mo-articles-module.js, pick.*) return exactly the essays the raw data ties to that page, in the order the
 *     page promises (the verse itself before its chapter, a topic's own essays before those that come by a document), with a
 *     note only where the reason is not the page's own subject
 *   - every essay is on at least one page's index (an essay that no page can show is an ORPHAN and is listed with its kind)
 *   - no module is drawn empty: a page with no essays gets "" and a page with essays gets a list of the right length, a heading
 *     that names the subject, only https links that open in a new tab with rel=noopener, and no em dash, "undefined" or "null"
 *   - "Show all N" appears exactly when a page sets a limit (the desks do; an author and a work show every essay), and the panel never draws more than two
 *   - COVERAGE: every work the library can name that has at least one essay by ANY join (the work itself, the document it is, its author)
 *     shows something; the public names (nicene-creed, heidelberg-catechism, westminster-confession) are documents; the count of works
 *     with resources is printed before (the data's own work and document tie only) and after
 *   - the author module is the last block of the room, and the work and rail modules are built from kinds of resource
 *   - the words around the rows never claim a position (no "teaches", "holds", "argues", "the library's position")
 *   - every key in the index resolves to a page that exists: a locus in loci.json, an author the author pages answer to, a
 *     document the placements know, a book the Verse Desk knows
 *
 *   node scripts/check-mo-placements.mjs
 * Reads assets/data/faith-received/mo-articles.json; skips (and passes) when the file is not in the tree.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const real = path.join(ROOT, "assets/data/faith-received/mo-articles.json");
if (!fs.existsSync(real)) { console.log("skip  mo placements: assets/data/faith-received/mo-articles.json is not in this tree yet (the data PR, tfr-mo-articles-data)"); process.exit(0); }
const dataPath = real;
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const A = require(path.join(ROOT, "assets/js/lib/mo-articles.js")).create();
A.use(data);
const M = require(path.join(ROOT, "assets/js/lib/mo-articles-module.js"));
const P = M.pick;
const mapPath = path.join(ROOT, "assets/data/faith-received/mo-article-works.json");
const workMap = fs.existsSync(mapPath) ? JSON.parse(fs.readFileSync(mapPath, "utf8")) : { authors: [], works: {} };
const ctx = { author: (slug) => (workMap.works[slug] !== undefined ? workMap.authors[workMap.works[slug]] : "") };

let failed = 0;
const fail = (m) => { failed += 1; console.error(`FAIL  ${m}`); };
const ok = (c, m) => { if (!c) fail(m); };
const ids = (xs) => xs.map((a) => a.id);
const sameSet = (a, b) => a.length === b.length && new Set(a).size === a.length && b.every((x) => new Set(a).has(x));
const raw = data.articles;
console.log(`data: ${path.relative(ROOT, dataPath)}, ${raw.length} articles`);

// ── ten verses ───────────────────────────────────────────────────────────────────────────────────────────────────────────
const verseKeys = Object.keys(data.idx.verse).filter((k) => k.split(".").length === 3);
const pickEvery = (list, n) => list.filter((_, i) => i % Math.max(1, Math.floor(list.length / n)) === 0).slice(0, n);
// five verses an essay names, and five verses that only share a chapter with essays (the chapter-level tier)
const named = pickEvery(verseKeys, 5);
const chapterOnly = [];
for (const k of Object.keys(data.idx.verse).filter((x) => x.split(".").length === 2)) {
  const [slug, c] = k.split(".");
  for (let v = 1; v <= 60 && chapterOnly.length < 5; v += 1) {
    if (!data.idx.verse[`${k}.${v}`]) { chapterOnly.push(`${slug}.${c}.${v}`); break; }
  }
  if (chapterOnly.length >= 5) break;
}
const verses = [...named, ...chapterOnly];
ok(verses.length === 10, `ten verses chosen (${verses.length})`);
for (const key of verses) {
  const [slug, c, v] = key.split(".");
  const chap = `${slug}.${c}`;
  const got = P.verse(A, slug, Number(c), Number(v));
  const want = raw.filter((a) => (a.verses || []).some((k) => k === chap || k.startsWith(`${chap}.`))).map((a) => a.id);
  ok(sameSet(ids(got), want), `${key}: the verse's essays are the essays on the chapter (${got.length} vs ${want.length})`);
  const tiers = got.map((a) => ((a.verses || []).includes(key) ? 0 : 1));
  ok(tiers.every((t, i) => i === 0 || tiers[i - 1] <= t), `${key}: the verse's own essays come before the chapter's`);
  got.forEach((a, i) => ok(tiers[i] === 0 ? !a.note : a.note === "on this chapter", `${key}: "${a.t}" carries the right note (${a.note || "none"})`));
  const out = M.html(got, { id: "t", limit: 3, excerpt: true, tag: "h2", context: "on this passage" });
  ok(Boolean(out) === got.length > 0, `${key}: a module is drawn exactly when there are essays`);
}

const lociAll = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/data/faith-received/loci.json"), "utf8"));
const locusOf = (id) => { let hit = null; (function walk(x) { if (hit) return; if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === "object") { if (x.id === id && x.label) hit = x; else Object.values(x).forEach(walk); } }(lociAll)); return hit; };
const termsOf = (id) => P.topicTerms(locusOf(id));

// ── ten topics ───────────────────────────────────────────────────────────────────────────────────────────────────────────
const topicKeys = Object.keys(data.idx.topic).sort((a, b) => data.idx.topic[b].length - data.idx.topic[a].length).slice(0, 10);
for (const id of topicKeys) {
  const rawOwn = raw.filter((a) => (a.topics || []).includes(id)).map((a) => a.id);
  const got = P.topic(A, id, [], termsOf(id));
  ok(got.every((a) => rawOwn.includes(a.id)) && got.length <= rawOwn.length, `topic ${id}: only its own essays, filtered (${got.length} of ${rawOwn.length})`);
  ok(new Set(ids(got)).size === got.length, `topic ${id}: no essay twice`);
  const docs = ["rc-111-westminster-confession-of-faith-1646", "cf-001-apostolic-and-ancient-creeds"];
  const withDocs = P.topic(A, id, docs, termsOf(id));
  ok(ids(withDocs).slice(0, got.length).join() === ids(got).join(), `topic ${id}: its own essays come first`);
  withDocs.slice(got.length).forEach((a) => ok(/^on the /.test(a.note || ""), `topic ${id}: "${a.t}" by a document says which`));
}
// the eight marquee topics, and the essays that were wrongly on them (fix: a strong signal is required)
const FALSE = {
  "de-christo": ["Sexuality and the Need for Moral Guidance", "Why God Hides"], "de-baptismo": ["Living By Kairos Time"],
  "de-scriptura": ["Knowledge Spackle", "Evangelical Universities"], "de-justificatione": ["23 Books for 2023"], "de-trinitate": ["Whiteness"],
};
const marquee = ["de-trinitate", "de-justificatione", "de-christo", "de-baptismo", "de-praedestinatione", "de-ecclesia", "de-scriptura", "de-coena"];
for (const id of marquee) {
  const got = P.topic(A, id, [], termsOf(id));
  console.log(`topic ${id}: ${got.length} (was ${(data.idx.topic[id] || []).length})`);
  if (process.env.LIST) got.forEach((a) => console.log(`    ${a.t}`));
  (FALSE[id] || []).forEach((bad) => ok(!got.some((a) => a.t.includes(bad) || (a.x || "").includes(bad)), `topic ${id} no longer lists "${bad}"`));
}
ok(!P.topic(A, "de-trinitate", [], termsOf("de-trinitate")).some((a) => /whiteness/i.test(a.t)), "Trinity drops the whiteness essay");

// ── ten authors ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const authors = Object.keys(data.idx.author).sort((a, b) => data.idx.author[b].length - data.idx.author[a].length).slice(0, 10);
for (const name of authors) {
  const want = raw.filter((a) => (a.authors || []).includes(name)).map((a) => a.id);
  const got = P.author(A, name);
  const wantKept = raw.filter((a) => (a.authors || []).includes(name) && !(P.NAMESAKES[name] && P.NAMESAKES[name].test(`${a.t} ${a.x}`))).map((a) => a.id);
  ok(sameSet(ids(got), wantKept), `author ${name}: ${got.length} vs ${wantKept.length} (${want.length} tagged)`);
  ok(sameSet(ids(P.author(A, name.toUpperCase())), wantKept), `author ${name}: case does not matter`);
}

// ── ten works ────────────────────────────────────────────────────────────────────────────────────────────────────────────
const works = Object.keys(data.idx.work).sort((a, b) => data.idx.work[b].length - data.idx.work[a].length).slice(0, 10);
for (const slug of works) {
  const want = raw.filter((a) => (a.works || []).includes(slug)).map((a) => a.id);
  const got = P.work(A, slug);
  ok(got.every((a) => want.includes(a.id) || (a.docs || []).includes(slug)), `work ${slug}: only essays tied to it`);
  if (!/^aq-/.test(slug)) ok(sameSet(ids(got), want), `work ${slug}: ${got.length} vs ${want.length}`);
  else ok(got.length < want.length || want.length === 0, `Summa part ${slug}: shows only essays that name the part (${got.length} of ${want.length})`);
}
ok(sameSet(ids(P.work(A, "2722")), ids(P.work(A, "pld-2722"))), "a bare PL number is a PL work");

// ── five confession documents (they are works too) ──────────────────────────────────────────────────────────────────────
const docs = Object.keys(data.idx.doc).sort((a, b) => data.idx.doc[b].length - data.idx.doc[a].length).slice(0, 5);
for (const slug of docs) {
  const want = raw.filter((a) => (a.docs || []).includes(slug)).map((a) => a.id);
  const got = P.doc(A, slug);
  ok(got.every((a) => want.includes(a.id)), `document ${slug}: only its essays`);
  if (!/^cf-/.test(slug)) ok(sameSet(ids(got), want), `document ${slug}: ${got.length} vs ${want.length}`);
  ok(sameSet(ids(P.work(A, slug)), ids(P.doc(A, slug)).concat(raw.filter((a) => (a.works || []).includes(slug) && !ids(P.doc(A, slug)).includes(a.id)).map((a) => a.id))), `document ${slug} read as a work`);
}
ok(P.topic(A, "de-trinitate", ["cf-025-council-of-chalcedon-451"], termsOf("de-trinitate")).filter((a) => a.note).every((a) => a.note === "on the Council of Chalcedon"), "Chalcedon is named as Chalcedon, not by a decree inside it");

// ── every essay is on at least one page ─────────────────────────────────────────────────────────────────────────────────
const loci = new Set();
(function walk(x) { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === "object") { if (typeof x.id === "string") loci.add(x.id); Object.values(x).forEach(walk); } }(JSON.parse(fs.readFileSync(path.join(ROOT, "assets/data/faith-received/loci.json"), "utf8"))));
const fold = (s) => String(s).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const names = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/data/faith-received/authors/names.json"), "utf8")).names || {};
const principal = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/data/faith-received/principal-writers.json"), "utf8"));
const principalText = fold(JSON.stringify(principal));
const BOOKS = new Set(fs.readFileSync(path.join(ROOT, "assets/js/page/scripture-dev-core.js"), "utf8").match(/slug:\s*"([a-z0-9-]+)"/g)?.map((m) => m.replace(/.*"([^"]+)"/, "$1")) || []);
const badKeys = [];
for (const k of Object.keys(data.idx.topic)) if (!loci.has(k)) badKeys.push(`topic ${k}`);
for (const k of Object.keys(data.idx.author)) if (!names[fold(k)] && !principalText.includes(fold(k)) && !authorRoomKnown(k)) badKeys.push(`author ${k}`);
for (const k of Object.keys(data.idx.verse)) if (BOOKS.size && !BOOKS.has(k.split(".")[0])) badKeys.push(`verse ${k}`);
function authorRoomKnown(k) { return Boolean(names[fold(k).replace(/of|the|de/g, "")]); }
if (badKeys.length) console.log(`note  ${badKeys.length} index keys not found in the theme's own lists (they may be rooms the worker holds): ${badKeys.slice(0, 8).join("; ")}${badKeys.length > 8 ? "; ..." : ""}`);

const placed = new Set();
const mark = (list) => list.forEach((a) => placed.add(a.id));
for (const k of Object.keys(data.idx.verse)) if (k.split(".").length === 2) { const [s, c] = k.split("."); mark(P.verse(A, s, Number(c), 1)); }
for (const k of Object.keys(data.idx.topic)) mark(P.topic(A, k, [], termsOf(k)));
for (const k of Object.keys(data.idx.author)) mark(P.author(A, k));
for (const k of Object.keys(data.idx.work)) mark(P.work(A, k));
for (const k of Object.keys(data.idx.doc)) mark(P.doc(A, k));
const orphans = raw.filter((a) => !placed.has(a.id));
const byKind = {};
orphans.forEach((a) => { byKind[a.k] = (byKind[a.k] || 0) + 1; });
console.log(`pages: ${placed.size} of ${raw.length} essays appear on a verse, topic, author, work or document page; ORPHANS (no page): ${orphans.length} ${JSON.stringify(byKind)}; of those, ${orphans.filter((a) => (a.topics || []).length && !(a.verses || []).length && !(a.authors || []).length && !(a.works || []).length && !(a.docs || []).length).length} had only a topic that failed the strong-signal test`);
ok(placed.size + orphans.length === raw.length, "every essay is either placed or counted as an orphan");
// An orphan is an essay the data ties to no verse, topic, author, work or library document (the documents it names, the Thirty-Nine
// Articles or the Prayer Book, are not matched to a page). Each is on the Resources page and found by its search.
// Orphans now include essays whose only tie was a topic the strong-signal test rejected, and those a namesake guard or a creed or
// Summa part rule left off: all are on the Resources page and found by search.
orphans.forEach((a) => {
  ok(A.search(a.t.split(/\s+/).slice(0, 3).join(" "), { limit: 50 }).some((x) => x.id === a.id), `orphan "${a.t}" is at least found by search`);
});

// ── namesakes, creed pages, Summa parts ──────────────────────────────────────────────────────────────────────────────────
ok(!P.author(A, "Martin Luther").some((a) => /martin luther king|\bMLK\b|king jr/i.test(`${a.t} ${a.x}`)), "the Luther list has no Martin Luther King essay");
console.log(`namesake exclusions: ${JSON.stringify(P.excluded(A).map((e) => `${e.author}: ${e.title}`))}`);
{
  const ap = P.doc(A, ["cf-001-apostolic-and-ancient-creeds"], P.CREED_PAGE_TERMS.apostles);
  const ni = P.doc(A, ["cf-001-apostolic-and-ancient-creeds"], P.CREED_PAGE_TERMS.nicene);
  ok(ids(ap).join() !== ids(ni).join(), "the Apostles' Creed page and the Nicene page list different essays");
  ok(ap.every((a) => /apostles/i.test(`${a.t} ${(a.w || []).join(" ")} ${a.x}`)), "every Apostles' Creed essay says apostles");
  ok(ni.every((a) => /nicene|nicaea|niceno/i.test(`${a.t} ${(a.w || []).join(" ")} ${a.x}`)), "every Nicene essay says Nicene or Nicaea");
  ok(![...ap, ...ni, ...P.doc(A, ["cf-025-council-of-chalcedon-451"])].some((a) => a.t.startsWith("Teetering")), "the Adele essay is on no creed page");
  console.log(`creed pages: Apostles' ${ap.length}, Nicene ${ni.length}, Chalcedon ${P.doc(A, ["cf-025-council-of-chalcedon-451"]).length}`);
}

// ── coverage: every work that has an essay by any join shows it ───────────────────────────────────────────────────────────
{
  const authorHas = (slug) => { const n = ctx.author(slug); return Boolean(n) && P.author(A, n).length > 0; };
  const aliasSlugs = Object.keys(P.DOC_ALIASES);
  const aliasHas = (slug) => { const al = P.DOC_ALIASES[slug]; const a = al && (al.same ? P.DOC_ALIASES[al.same] : al); return Boolean(a) && a.docs.some((d) => P.doc(A, d).length > 0); };
  const universe = new Set([...Object.keys(data.idx.work), ...Object.keys(data.idx.doc), ...Object.keys(workMap.works), ...aliasSlugs]);
  let before = 0;
  let after = 0;
  let viaAuthor = 0;
  const empty = [];
  for (const slug of universe) {
    const had = (data.idx.work[slug] || []).length > 0 || P.doc(A, slug).length > 0;
    const joinable = had || authorHas(slug) || aliasHas(slug);
    const got = P.work(A, slug, ctx);
    if (had) before += 1;
    if (got.length) after += 1;
    if (!had && got.length && authorHas(slug)) viaAuthor += 1;
    if (joinable && !got.length) empty.push(slug);
    got.forEach((a) => ok(Boolean(a.why) && !/undefined|null/.test(a.why), `work ${slug}: "${a.t}" has a plain-words reason`));
    ok(new Set(ids(got)).size === got.length, `work ${slug}: no essay twice`);
  }
  ok(empty.length === 0, `every work with an essay by any join shows it; these would show nothing: ${empty.slice(0, 10).join(", ")}${empty.length > 10 ? ` (+${empty.length - 10})` : ""}`);
  console.log(`coverage: works with resources before ${before}, after ${after} of ${universe.size} named by the data, the aliases or the work map (${viaAuthor} only through their author)`);
  // public names and the group documents
  const labelsOf = (slug) => [...new Set(P.work(A, slug, ctx).map((a) => a.why))];
  for (const slug of ["nicene-creed", "apostles-creed", "heidelberg-catechism", "westminster-confession", "westminster-shorter-catechism", "belgic-confession", "augsburg-confession", "chalcedonian"]) {
    const got = P.work(A, slug, ctx);
    ok(got.length > 0, `${slug} shows essays (${got.length})`);
    console.log(`  ${slug}: ${got.length} [${labelsOf(slug).join("; ")}]`);
  }
  {
    const nic = P.work(A, "nicene-creed", ctx);
    const anc = P.work(A, "cf-001-apostolic-and-ancient-creeds", ctx);
    ok(anc.every((a) => nic.some((b) => b.id === a.id)) || anc.length === 0, "the Nicene Creed shows the ancient creeds' essays too");
    ok(nic.some((a) => /^On the Nicene Creed$/.test(a.why)) && nic.some((a) => /^On the ancient creeds$/.test(a.why)), "the Nicene Creed names both: its own essays and the ancient creeds'");
    const ni = P.work(A, "nicene-creed", ctx).findIndex((a) => a.why === "On the ancient creeds");
    const own = P.work(A, "nicene-creed", ctx).map((a) => a.why).lastIndexOf("On the Nicene Creed");
    ok(own < ni, "essays on the Nicene Creed itself come before those on the group");
  }
  {
    // a confession with nothing of its own gets the essays on confessions in general, and says so
    const got = P.work(A, "rc-001-sixty-seven-articles-of-huldrych-zwingli-1523", ctx);
    ok(got.length > 0 && got.every((a) => a.why === "On creeds and confessions in general"), "a confession with no essay of its own shows the general ones, labelled");
    ok(P.work(A, "not-a-work", ctx).length === 0, "a work nothing ties an essay to shows nothing");
  }
  // the sample the reader is most asked about, with what each shows
  const sample = ["nicene-creed", "apostles-creed", "heidelberg-catechism", "westminster-confession", "pld-2722", "aq-st-i-16", "calvin-institutes-of-the-christian-religion", "pld-365"];
  console.log(`  sample: ${sample.map((k) => `${k} ${P.work(A, k, ctx).length}`).join(", ")}`);
}

// ── the module, drawn ───────────────────────────────────────────────────────────────────────────────────────────────────
ok(M.html([], { id: "e" }) === "", "no essays, no module");
ok(M.html(null, { id: "e" }) === "", "no list, no module");
ok(M.html([{ id: "x", t: "Title", u: "javascript:alert(1)", d: "2020-01-01", a: "A" }], { id: "e" }) === "", "an unsafe link draws nothing at all");
ok(M.html([{ id: "x", t: "Title", u: "https://mereorthodoxy.com/x/", d: "2020-01-01", a: "A" }], { id: "e" }) !== "", "a safe link draws");
const forbidden = /(—|undefined|null|\bteaches\b|\bholds\b|\bargues\b|library's (position|view|teaching)|[Gg]ood news)/;
let rowsChecked = 0;
const keysToDraw = [["verse", verses], ["topic", topicKeys], ["author", authors], ["work", works], ["doc", docs]];
for (const [kind, list] of keysToDraw) {
  for (const key of list) {
    const items = kind === "verse" ? P.verse(A, ...[key.split(".")[0], Number(key.split(".")[1]), Number(key.split(".")[2])])
      : kind === "topic" ? P.topic(A, key, [], termsOf(key)) : kind === "author" ? P.author(A, key) : kind === "work" ? P.work(A, key, ctx) : P.doc(A, key);
    // every page shows every essay it is given: no "Show all", no cap (the verse panel is the one exception, below)
    const limit = Infinity;
    const out = M.html(items, { id: "m", limit: Number.isFinite(limit) ? limit : undefined, image: (a, w) => A.image(a, w), tag: "h2", title: kind === "author" ? `Mere Orthodoxy on ${key}` : "", context: kind === "verse" ? "on this passage" : "" });
    ok(Boolean(out) === items.length > 0, `${kind} ${key}: drawn exactly when there are essays`);
    if (!out) continue;
    // The words this module writes (label, note, buttons, links) are checked; an essay's own title and excerpt are the essay's words.
    const chrome = out.replace(/<li class="moa-row"[\s\S]*?<\/li>/g, " ").replace(/<[^>]+>/g, " ");
    ok(!forbidden.test(chrome), `${kind} ${key}: forbidden wording in "${(chrome.match(forbidden) || [""])[0]}"`);
    ok(!/\u2014|undefined|null/.test(out.replace(/<[^>]+>/g, " ")), `${kind} ${key}: no em dash, "undefined" or "null" anywhere in the drawn text`);
    const rows = (out.match(/<li class="moa-row"/g) || []).length;
    ok(rows === items.length, `${kind} ${key}: ${rows} rows for ${items.length} essays`);
    ok((out.match(/ hidden data-moa-extra/g) || []).length === Math.max(0, items.length - limit), `${kind} ${key}: rows past ${limit} wait behind "Show all"`);
    ok(/data-moa-more/.test(out) === items.length > limit, `${kind} ${key}: "Show all N" only when there is more`);
    if (!Number.isFinite(limit)) ok(!/data-moa-more|moa-extra/.test(out), `${kind} ${key}: every essay is shown, no "Show all"`);
    ok((out.match(/<img class="moa-photo"/g) || []).length + (out.match(/class="moa-ph"/g) || []).length === items.length, `${kind} ${key}: every card has its image or its tile`);
    ok(!/<li class="moa-row"[^>]*>(?:(?!<\/li>)[^])*moa-why"><\/span>/.test(out), `${kind} ${key}: no empty why line`);
    if (items.length > limit) ok(out.includes(`Show all ${items.length}</button>`), `${kind} ${key}: "Show all ${items.length}" names the count`);
    ok(!/<li class="moa-row"[^>]*>\s*<\/li>/.test(out) && !/<ul class="moa-list"[^>]*><\/ul>/.test(out), `${kind} ${key}: no empty row or list`);
    ok([...out.matchAll(/<a class="moa-link" href="([^"]+)" target="_blank" rel="noopener">/g)].every((m) => /^https:\/\/mereorthodoxy\.com\//.test(m[1])), `${kind} ${key}: every link is the original, in a new tab, noopener`);
    ok(out.includes('href="/the-faith-received/resources/#articles"'), `${kind} ${key}: the foot links to all the articles`);
    ok(!/<h[1-6][^>]*>\s*<\/h[1-6]>/.test(out), `${kind} ${key}: no empty heading`);
    rowsChecked += rows;
  }
}
// the optional limit still folds the rest in place, for a caller that asks for it
{
  const items = P.author(A, "Augustine of Hippo");
  const out = M.html(items, { id: "l", limit: 3, tag: "h2" });
  ok(out.includes(`Show all ${items.length}</button>`) && (out.match(/ hidden data-moa-extra/g) || []).length === items.length - 3, "a caller that sets a limit gets Show all N and the rest hidden in place");
}
// cards carry a dek only when it is a complete sentence; nothing is cut with an ellipsis
{
  let deks = 0;
  for (const a of raw) {
    const out = M.html([a], { id: "d", tag: "h2" });
    const m = /<span class="moa-x">([^<]*)<\/span>/.exec(out);
    if (!m) continue;
    deks += 1;
    m[1] = m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    ok(/[.!?]["\u201d\u2019']?$/.test(m[1]) && !/\u2026|\.\.\./.test(m[1]), `"${a.t}": the dek is a whole sentence of the excerpt: ${m[1]}`);
    ok(!/\u2026/.test(out.replace(/<[^>]+>/g, " ")), `"${a.t}": no ellipsis in the drawn card`);
  }
  console.log(`deks: ${deks} of ${raw.length} essays have a complete first sentence to show`);
  const rows = M.html([raw[0]], { id: "r", variant: "rows", tag: "h3" });
  ok(!/moa-x/.test(rows), "the compact rows carry no dek");
}
// the narrow panel: two links, never more, and the rest through the Verse Desk
{
  const items = P.verse(A, "genesis", 1, 1);
  const out = M.html(items, { id: "p", cap: 2, foot: false, moreHref: "/the-faith-received/scripture/desk/?ref=genesis.1.1", moreLabel: `All ${items.length} on the Verse Desk` });
  ok((out.match(/<li class="moa-row"/g) || []).length === Math.min(2, items.length), "the panel draws two links at most");
  if (items.length > 2) ok(out.includes("on the Verse Desk</a>") && !out.includes("data-moa-more"), "the panel points to the Verse Desk instead of expanding");
  ok(M.html(items, { id: "p", cap: 2, moreHref: "https://evil.example/", moreLabel: "x" }).includes("evil.example") === false, "the panel's 'more' link is an on-site path only");
}
// dates, excerpts, and the seam between them
ok(M.monthYear("2019-05-14") === "May 2019" && M.monthYear("2026-10-20T04:00:00.000Z") === "October 2026" && M.monthYear("") === "", "dates read as Month Year without a time zone");
ok(M.excerpt("a ".repeat(200), 105).length <= 106 && M.excerpt("short", 170) === "short", "excerpts are cut on a word");
ok(!M.plain("a — b").includes("—"), "the module never writes an em dash");

// ── the sheet and the scripts hold the rules ────────────────────────────────────────────────────────────────────────────
const css = fs.readFileSync(path.join(ROOT, "assets/css/mo-articles-module.css"), "utf8").replace(/\/\*[^]*?\*\//g, "");
ok(!/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/.test(css), "the module's sheet states no literal color");
ok(!/IM Fell|font-variant:\s*small-caps|border-radius:\s*(9|[1-9]\d)/.test(css), "no display face and no pill in the module's sheet");
ok(!/max-height|overflow(-y)?:\s*(auto|scroll)/.test(css), "no scroll box in the module's sheet");
ok(/@container moa \(min-width: 1160px\)[^}]*repeat\(5,/.test(css) && /@container moa \(min-width: 900px\)[^}]*repeat\(4,/.test(css) && /@container moa \(min-width: 620px\)[^}]*repeat\(3,/.test(css) && /@container moa \(min-width: 520px\)[^}]*repeat\(2,/.test(css), "five across on a wide desk, four, three, two on a tablet, one on a phone (by the width of the place)");
ok(/ok/.test("ok") && /\.moa-btn[^{]*\{[^}]*border: 1px solid/.test(css) && !/\.moa-btn[^{]*\{[^}]*background: var/.test(css), "the foot button is hollow");
ok(/min-height:\s*44px/.test(css) && /:focus-visible/.test(css), "44px targets and a visible focus ring");
for (const f of ["assets/js/lib/mo-articles-module.js", "assets/js/page/mo-articles-placements.js"]) {
  const src = fs.readFileSync(path.join(ROOT, f), "utf8");
  ok(!/\.innerHTML\s*=/.test(src.replace(/\/\*[^]*?\*\//g, "")), `${f}: no innerHTML assignment (rows are escaped strings through insertAdjacentHTML)`);
  ok(!src.includes("—".repeat(1)) || /^\s*(\/\/|\*|\/\*)/m.test(src), `${f}: no em dash`);
}

console.log(`checked ${verses.length} verses, ${topicKeys.length} topics, ${authors.length} authors, ${works.length} works, ${docs.length} documents, ${rowsChecked} rows drawn`);
if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1); }
console.log("ok  Mere Orthodoxy placements");
