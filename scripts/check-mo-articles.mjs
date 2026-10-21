#!/usr/bin/env node
/*
 * Checks for the Mere Orthodoxy articles data and its loader (assets/js/lib/mo-articles.js).
 *
 *   node scripts/check-mo-articles.mjs
 *
 * 1. The loader, on a small fixture: AND across words, diacritics, prefix on the last word, kind filter, ordering, lookups.
 * 2. The built file: shape, attribution (every entry links to mereorthodoxy.com), no body text beyond the excerpt, every
 *    index entry names a real article and agrees with the article's own entity arrays, and the lookups answer from it.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const MOArticles = require(path.join(root, "assets/js/lib/mo-articles.js"));

let failed = 0;
const test = (name, fn) => {
  try { fn(); console.log(`ok   ${name}`); } catch (e) { failed++; console.error(`FAIL ${name}\n     ${e.message}`); }
};

// ── 1. the loader on a fixture ──
const art = (id, t, d, k, extra) => ({ id, t, u: `https://mereorthodoxy.com/${id}/`, d, a: "A. Writer", k, f: "high", x: "", w: [], ...extra });
const fixture = {
  v: 1,
  articles: [
    art("a1", "Augustine and the Restless Heart", "2020-01-01", "work", { authors: ["Augustine of Hippo"], works: ["pld-2722"], w: ["confessions", "memory"], x: "A reading of the Confessions." }),
    art("a2", "The Résumé of Hooker", "2021-05-05", "work", { authors: ["Richard Hooker"], x: "Hooker on order." }),
    art("a3", "Nicaea at 1700", "2025-03-03", "doc", { docs: ["cf-013-council-of-nicea-i-325"], x: "The creed and the council, with Augustine in the margin.", verses: ["john.1.1-3"] }),
    art("a4", "Why God Hides", "2019-02-02", "topic", { topics: ["de-christo"], verses: ["romans.8", "romans.8.28"], w: ["veil", "covering"] }),
    art("a5", "Romans 8 for Weary People", "2018-08-08", "topic", { verses: ["romans.8"], a: "Zoë Müller" }),
    art("a6", "Ressourcement Again", "2022-02-02", "retrieval", { n: ["Book of Common Prayer"], x: "Retrieval, ressourcement, and the sources." }),
  ],
  lab: { works: { "pld-2722": "Confessions" }, docs: { "cf-013-council-of-nicea-i-325": "Council of Nicaea I (325)" }, topics: { "de-christo": "The Person and Work of Christ" } },
  idx: {
    verse: { "john.1": ["a3"], "john.1.1": ["a3"], "john.1.2": ["a3"], "john.1.3": ["a3"], "romans.8": ["a5", "a4"], "romans.8.28": ["a4"] },
    topic: { "de-christo": ["a4"] }, work: { "pld-2722": ["a1"] },
    author: { "Augustine of Hippo": ["a1"], "Richard Hooker": ["a2"] }, doc: { "cf-013-council-of-nicea-i-325": ["a3"] },
  },
};
const M = MOArticles.create();
test("answers [] before the data loads", () => {
  assert.deepEqual(M.search("augustine"), []);
  assert.deepEqual(M.forTopic("de-christo"), []);
  assert.deepEqual(M.forVerse("romans.8"), []);
});
M.use(fixture);
const ids = (l) => l.map((a) => a.id);
test("single word: title outranks keyword outranks excerpt", () => {
  assert.deepEqual(ids(M.search("augustine")), ["a1", "a3"]); // a1 title and entity; a3 excerpt only
  assert.deepEqual(ids(M.search("confessions")), ["a1"]);
});
test("AND across words", () => {
  assert.deepEqual(ids(M.search("augustine confessions")), ["a1"]);
  assert.deepEqual(ids(M.search("augustine hooker")), []);
  assert.deepEqual(ids(M.search("creed council")), ["a3"]);
});
test("folds diacritics and case, both ways", () => {
  assert.deepEqual(ids(M.search("RESUME")), ["a2"]);
  assert.deepEqual(ids(M.search("résumé")), ["a2"]);
  assert.deepEqual(ids(M.search("zoe muller")), ["a5"]);
  assert.deepEqual(ids(M.search("Müller")), ["a5"]);
});
test("prefix matches the last word only", () => {
  assert.deepEqual(ids(M.search("ressour")), ["a6"]);
  assert.deepEqual(ids(M.search("augustine conf")), ["a1"]);
  assert.deepEqual(ids(M.search("conf augustine")), []); // "conf" is not the last word, so it must be a whole word
});
test("searches names of what the essay serves", () => {
  assert.deepEqual(ids(M.search("person work")), ["a4"]); // topic label
  assert.deepEqual(ids(M.search("nicaea council")), ["a3"]);
  assert.deepEqual(ids(M.search("common prayer")), ["a6"]); // a non-linkable document name
  assert.deepEqual(ids(M.search("richard")), ["a2"]);
});
test("kind filter and limit", () => {
  assert.deepEqual(ids(M.search("", { kind: "doc" })), ["a3"]);
  assert.deepEqual(ids(M.search("augustine", { kind: "doc" })), ["a3"]);
  assert.deepEqual(ids(M.search("augustine", { kind: "retrieval" })), []);
  assert.equal(M.search("", { limit: 2 }).length, 2);
});
test("empty query lists everything, newest first", () => {
  assert.deepEqual(ids(M.search("")), ["a3", "a6", "a2", "a1", "a4", "a5"]);
  assert.deepEqual(ids(M.search("   ")), ids(M.search("")));
});
test("ties break by date, newest first", () => {
  assert.deepEqual(ids(M.search("romans")), ["a5"]);
  const T = MOArticles.create();
  T.use({ articles: [art("o", "Grace", "2001-01-01", "topic"), art("n", "Grace", "2024-01-01", "topic")], idx: {} });
  assert.deepEqual(ids(T.search("grace")), ["n", "o"]);
});
test("kinds() counts in display order", () => {
  assert.deepEqual(M.kinds().map((k) => [k.k, k.n]), [["doc", 1], ["work", 2], ["retrieval", 1], ["topic", 2]]);
  assert.equal(M.kinds()[0].label, "Creeds and confessions");
});
test("lookups keep the build's order", () => {
  assert.deepEqual(ids(M.forTopic("de-christo")), ["a4"]);
  assert.deepEqual(ids(M.forWork("pld-2722")), ["a1"]);
  assert.deepEqual(ids(M.forDoc("cf-013-council-of-nicea-i-325")), ["a3"]);
  assert.deepEqual(ids(M.forAuthor("Augustine of Hippo")), ["a1"]);
  assert.deepEqual(ids(M.forAuthor("augustine  of hippo")), ["a1"]);
  assert.deepEqual(ids(M.forAuthor("Nobody")), []);
  assert.deepEqual(ids(M.forVerse("romans.8")), ["a5", "a4"]);
});
test("forVerse: a verse, a range, and the chapter-wide essays", () => {
  assert.deepEqual(ids(M.forVerse("romans.8.28")), ["a4", "a5"]); // a4 names the verse, a5 is on the whole chapter
  assert.deepEqual(ids(M.forVerse("romans.8.29")), ["a5", "a4"]); // both are on the whole chapter
  assert.deepEqual(ids(M.forVerse("john.1.2-3")), ["a3"]);
  assert.deepEqual(ids(M.forVerse("Romans 8:28")), []); // not the address form
  assert.deepEqual(ids(M.forVerse("nonsense")), []);
});
test("entities() lists documents first and labels them", () => {
  const e = M.entities(fixture.articles[2]);
  assert.deepEqual(e.map((x) => x.type), ["doc", "verse"]);
  assert.equal(e[0].label, "Council of Nicaea I (325)");
});

const read = (p) => readFileSync(path.join(root, p), "utf8");
const tpl = read("custom-faith-resources.hbs");
// ── 2. the built file ──
const file = path.join(root, "assets/data/faith-received/mo-articles.json");
const text = readFileSync(file, "utf8");
const data = JSON.parse(text);
const B = MOArticles.create();
B.use(data);
const byId = new Map(data.articles.map((a) => [a.id, a]));

test("size under 450 KB", () => assert.ok(Buffer.byteLength(text) < 450 * 1024, `${text.length} bytes`));
test("the 493 approved essays, and any added since (Ian's requests), are present once each", () => {
  assert.ok(data.articles.length >= 493);
  assert.equal(byId.size, data.articles.length);
  assert.ok(byId.has("6ad7ac859d1a6d00018c46af"), "Against Theological Retrieval as Resource Gathering");
});
test("every entry is attributed: title, author, date, a link back to mereorthodoxy.com", () => {
  for (const a of data.articles) {
    assert.ok(a.t && a.a && /^\d{4}-\d{2}-\d{2}$/.test(a.d), `${a.id} lacks title, author or date`);
    assert.match(a.u, /^https:\/\/mereorthodoxy\.com\/[^\s]+$/, a.id);
    assert.ok(["doc", "work", "retrieval", "topic"].includes(a.k), `${a.id} kind ${a.k}`);
  }
});
test("no body text beyond a 240-character excerpt; at most 12 keywords", () => {
  for (const a of data.articles) {
    assert.ok(a.x.length <= 241, `${a.id} excerpt is ${a.x.length}`);
    assert.ok(!/<[a-z/][^>]*>/i.test(a.x), `${a.id} excerpt has markup`);
    assert.ok(a.w.length <= 12, `${a.id} has ${a.w.length} keywords`);
  }
});
test("the index agrees with the articles, both ways", () => {
  const field = { work: "works", author: "authors", doc: "docs", topic: "topics" };
  for (const [table, key] of Object.entries(field)) {
    for (const [k, list] of Object.entries(data.idx[table])) {
      assert.equal(new Set(list).size, list.length, `${table} ${k} repeats an article`);
      for (const id of list) assert.ok((byId.get(id)[key] || []).includes(k), `${table} ${k} lists ${id}, which does not carry it`);
    }
    for (const a of data.articles) for (const k of a[key] || []) assert.ok(data.idx[table][k].includes(a.id), `${a.id} carries ${table} ${k} but the index lacks it`);
  }
  for (const [k, list] of Object.entries(data.idx.verse)) for (const id of list) assert.ok(byId.has(id), `verse ${k} names unknown ${id}`);
  for (const a of data.articles) for (const v of a.verses || []) {
    const [book, c] = v.split(".");
    assert.ok(data.idx.verse[`${book}.${c}`].includes(a.id), `${a.id} ${v} missing from its chapter`);
  }
});
test("verse keys are book.chapter or book.chapter.verse", () => {
  for (const k of Object.keys(data.idx.verse)) assert.match(k, /^[a-z0-9]+(-[a-z0-9]+)*\.\d{1,3}(\.\d{1,3})?$/, k);
});
test("no index list is empty", () => {
  for (const table of ["author", "work", "doc", "topic"]) for (const [k, list] of Object.entries(data.idx[table])) {
    assert.ok(list.length >= 1, `${table} ${k} is empty`);
  }
});
test("labels exist for every work, document and topic used", () => {
  for (const a of data.articles) {
    for (const s of a.works || []) assert.ok(data.lab.works[s], s);
    for (const s of a.docs || []) assert.ok(data.lab.docs[s], s);
    for (const s of a.topics || []) assert.ok(data.lab.topics[s], s);
  }
});
test("featured images: null or a valid path or URL, and most essays have one", () => {
  let n = 0;
  for (const a of data.articles) {
    assert.ok(a.i === null || typeof a.i === "string", `${a.id} has no i`);
    if (a.i) { n++; assert.ok(/^\d{4}\/\d{2}\/[^\s"<>]+$/.test(a.i) || /^https:\/\/[^\s"<>]+$/.test(a.i), `${a.id} image ${a.i}`); }
    if (a.ia) assert.ok(a.i, `${a.id} has alt text but no image`);
  }
  assert.ok(n >= 380, `only ${n} essays have an image`);
  const stamp = read("assets/js/lib/mo-articles-dv.js");
  assert.ok(stamp.includes(`"${data.dv}"`), "mo-articles-dv.js does not match the data's dv");
  assert.ok(tpl.indexOf("mo-articles-dv.js") > 0 && tpl.lastIndexOf("mo-articles-dv.js") < tpl.lastIndexOf("js/lib/mo-articles.js"), "the stamp must load before the loader");
  assert.match(data.imgBase, /^https:\/\/storage\.ghost\.io\/.+\/content\/images\/$/);
});
test("image() asks for a size Ghost serves, and never answers for an essay without one", () => {
  const withImg = data.articles.find((a) => a.i && !/^https:/.test(a.i));
  assert.match(B.image(withImg, 600), /\/content\/images\/size\/w600\/\d{4}\/\d{2}\//);
  assert.equal(B.image(data.articles.find((a) => !a.i), 600), "");
  const un = data.articles.find((a) => /unsplash/.test(a.i || ""));
  if (un) assert.match(B.image(un, 300), /[?&]w=300(&|$)/);
});

test("namesakes: no Martin Luther King essay is tagged Martin Luther, and no Calvin and Hobbes piece John Calvin", () => {
  for (const id of data.idx.author["Martin Luther"]) assert.ok(!/martin luther king|\bMLK\b|king jr/i.test(byId.get(id).t), byId.get(id).t);
  for (const a of data.articles) {
    if (/martin luther king/i.test(a.t)) assert.ok(!(a.authors || []).includes("Martin Luther"), a.t);
    if (/calvin and hobbes/i.test(a.x) && !/john calvin/i.test(a.x)) assert.ok(!(a.authors || []).includes("John Calvin"), a.t);
  }
});
test("kinds: every essay has valid kinds with its primary first; filters overlap and the unique total is every essay", () => {
  const K = ["doc", "work", "retrieval", "topic"];
  let multi = 0;
  for (const a of data.articles) {
    const ks = B.kindsOf(a);
    assert.equal(ks[0], a.k, a.t);
    assert.ok(ks.every((k) => K.includes(k)) && new Set(ks).size === ks.length, a.t);
    if (a.ks) { assert.ok(a.ks.length > 1, `${a.t} writes ks for one kind`); multi++; }
    if ((a.docs || []).length) assert.ok(ks.includes("doc"), `${a.t} has docs`);
    if ((a.works || []).length || (a.authors || []).length) assert.ok(ks.includes("work"), `${a.t} has works or authors`);
    if ((a.topics || []).length || (a.verses || []).length) assert.ok(ks.includes("topic"), `${a.t} has topics or verses`);
  }
  assert.ok(multi >= 30, `only ${multi} multi-kind essays`);
  const counts = Object.fromEntries(B.kinds().map((k) => [k.k, k.n]));
  for (const k of K) assert.equal(B.search("", { kind: k }).length, counts[k]);
  assert.ok(K.reduce((n, k) => n + counts[k], 0) > data.articles.length, "the kind counts should overlap");
  assert.equal(B.search("").length, data.articles.length);
  const flat = B.search("", { kind: "work" }).map((a) => a.id);
  assert.equal(new Set(flat).size, flat.length);
});
test("why lines: strong signals only, so no loose 'Death and Judgment' or 'Person and Work of Christ'", () => {
  for (const re of [/Dante/i, /Dostoevsk|Brothers Karamazov/i, /Tucker Carlson/, /Dark Triad/, /Secular Protestantism/, /Annunciation/, /Magician and Mechanic/]) {
    for (const a of data.articles.filter((x) => re.test(x.t))) assert.ok(!/Death and Judgment|Person and Work of Christ|Humanity/.test(a.y || ""), `${a.t}: ${a.y}`);
  }
  assert.ok(data.articles.filter((a) => a.y).length >= 300);
  for (const a of data.articles) if (a.y) assert.ok(!/ and .* and .* and /.test(a.y) && a.y.split("; ").length <= 2, `${a.t}: ${a.y}`);
  for (const a of data.articles) assert.ok(!/(\w+ \d+)(:\d+)? and \1/.test(a.y || ""), `${a.t} repeats a chapter: ${a.y}`);
});
test("the lookups answer from the built file", () => {
  assert.ok(B.forAuthor("Augustine of Hippo").length >= 30, "Augustine's essays");
  assert.ok(B.forWork("pld-2722").length >= 20, "Confessions");
  assert.ok(B.forTopic("de-trinitate").length >= 10);
  assert.ok(B.forDoc("cf-001-apostolic-and-ancient-creeds").length >= 20);
  assert.ok(B.forVerse("genesis.1").length >= 3);
  assert.ok(B.search("heidelberg catechism").some((a) => /Heidelberg/.test(a.t)));
  assert.ok(B.search("augustin").length >= 30, "prefix on the last word");
  assert.equal(B.search("zzzqqq").length, 0);
});

// ── full-text search, on the real data and index ──
const indexText = readFileSync(path.join(root, "assets/data/faith-received/mo-articles-index.json"), "utf8");
const index = JSON.parse(indexText);
const F = MOArticles.create();
F.use(data);
F.useIndex(index);
const byTitle = (re) => data.articles.find((a) => re.test(a.t));
const coonce = byTitle(/Wrong with a .?Rule of Life/i);
const tids = (q) => F.search(q).map((a) => a.id);

test("the index is a stamped, positionless set of postings under the size cap", () => {
  assert.equal(index.n, data.articles.length);
  assert.deepEqual(index.ids, data.articles.map((a) => a.id));
  assert.ok(Buffer.byteLength(indexText) < 1500 * 1024, `${indexText.length} bytes`);
  const stamp = readFileSync(path.join(root, "assets/js/lib/mo-articles-dv.js"), "utf8");
  assert.ok(stamp.includes(`MO_ARTICLES_INDEX_DV = "${index.dv}"`), "the stamp does not carry the index's dv");
  for (const [k, v] of Object.entries(index.t).slice(0, 2000)) assert.match(v, /^[0-9a-z]+(\.[0-9a-z]+)?(,[0-9a-z]+(\.[0-9a-z]+)?)*$/, k);
});
test("'ten commandments' finds the Coonce essay and at least ten others", () => {
  assert.ok(coonce, "Coonce essay is in the data");
  const r = tids("ten commandments");
  assert.ok(r.includes(coonce.id));
  assert.ok(r.length >= 11, `${r.length}`);
});
test("'decalogue' finds the same essays (alias), and overlaps 'ten commandments'", () => {
  const a = new Set(tids("ten commandments"));
  const b = tids("decalogue");
  assert.ok(b.length >= 10 && b.filter((id) => a.has(id)).length >= 10);
  assert.ok(b.includes(coonce.id));
});
test("'rule of life' puts the Coonce essay in the top three", () => {
  assert.ok(tids("rule of life").slice(0, 3).includes(coonce.id));
});
test("'nicene creed' finds the Passages series", () => {
  const titles = F.search("nicene creed").map((a) => a.t);
  assert.ok(titles.filter((t) => /^Passages: Season 1/.test(t)).length >= 5, titles.slice(0, 12).join(" | "));
});
test("'heidelberg' finds the Heidelberg Catechism pieces", () => {
  assert.ok(F.search("heidelberg").slice(0, 3).some((a) => /Heidelberg/.test(a.t)));
  assert.ok(F.search("heidelberg").length >= 10);
});
test("AND: more terms narrow the results", () => {
  const wide = tids("ten commandments");
  const narrow = tids("ten commandments augustine");
  assert.ok(narrow.length < wide.length && narrow.length >= 1);
  assert.ok(narrow.every((id) => wide.includes(id)));
});
test("a body-only match says what matched; a title match does not", () => {
  const body = F.search("ten commandments").find((a) => !/commandments/i.test(a.t) && F.mentions(a, "ten commandments").length);
  assert.ok(body, "some essay mentions it only in the text");
  assert.deepEqual(F.mentions(coonce, "rule of life"), []);
  assert.ok(F.mentions(F.article(coonce.id), "ten commandments").length >= 1);
});
test("diacritics and case do not change results; empty and short queries are safe", () => {
  assert.deepEqual(tids("calvin"), tids("calviń"));
  assert.deepEqual(tids("CALVIN"), tids("calvin"));
  assert.equal(F.search("").length, data.articles.length);
  assert.equal(F.search("   ").length, data.articles.length);
  for (const q of ["a", "x", "of", "the", "..", "\"", "'", "ro", "  a  b "]) assert.doesNotThrow(() => F.search(q), q);
  assert.equal(F.search("zzzqqqxx").length, 0);
});
test("a query is fast", () => {
  const t0 = Date.now();
  for (let i = 0; i < 20; i++) F.search("ten commandments");
  assert.ok((Date.now() - t0) / 20 < 30, "over 30 ms per query");
});

// ── the podcast episodes ──
const podText = readFileSync(path.join(root, "assets/data/faith-received/mo-podcasts.json"), "utf8");
const pods = JSON.parse(podText);
const podIndexText = readFileSync(path.join(root, "assets/data/faith-received/mo-podcasts-index.json"), "utf8");
const podIndex = JSON.parse(podIndexText);
const PM = MOArticles.create();
PM.use(pods);
PM.useIndex(podIndex);
const podById = new Map(pods.articles.map((a) => [a.id, a]));
const SHOWS = ["passages", "mere-fidelity", "christians-reading-classics"];

test("podcasts: every Passages episode is present, and each entry is attributed with an episode page and an image", () => {
  assert.equal(pods.articles.filter((a) => a.s === "passages").length, 13);
  assert.equal(podById.size, pods.articles.length);
  for (const a of pods.articles) {
    assert.ok(SHOWS.includes(a.s), a.id);
    assert.ok(a.t && a.a && /^\d{4}-\d{2}-\d{2}$/.test(a.d), a.id);
    assert.match(a.u, /^https:\/\/mereorthodoxy\.com\/[^\s]+$/, a.id);
    assert.ok(!/\.mp3|buzzsprout\.com\/.*\/episodes|libsyn\.com\/.*\.mp3/.test(a.u), `${a.id} links the audio`);
    assert.match(a.i, /^https:\/\/(storage\.buzzsprout\.com|static\.libsyn\.com)\//, a.id);
    assert.ok(a.x.length <= 241 && a.w.length <= 12, a.id);
    assert.ok(["doc", "work", "retrieval", "topic"].includes(a.k) && PM.kindsOf(a)[0] === a.k, a.id);
  }
});
test("podcasts: the show counts and the stamp", () => {
  const n = (k) => pods.articles.filter((a) => a.s === k).length;
  assert.ok(n("mere-fidelity") >= 50 && n("christians-reading-classics") >= 3, `${n("mere-fidelity")} and ${n("christians-reading-classics")}`);
  assert.ok(Buffer.byteLength(podText) < 120 * 1024);
  const stamp = readFileSync(path.join(root, "assets/js/lib/mo-podcasts-dv.js"), "utf8");
  assert.ok(stamp.includes(`MO_PODCASTS_DV = "${pods.dv}"`) && stamp.includes(`MO_PODCASTS_INDEX_DV = "${podIndex.dv}"`));
  assert.deepEqual(podIndex.ids, pods.articles.map((a) => a.id));
});
test("podcasts: the index agrees with the entries and every entity resolves", () => {
  for (const [table, key] of Object.entries({ work: "works", author: "authors", doc: "docs", topic: "topics" })) {
    for (const [k, list] of Object.entries(pods.idx[table])) for (const id of list) assert.ok((podById.get(id)[key] || []).includes(k), `${table} ${k} lists ${id}`);
    for (const a of pods.articles) for (const k of a[key] || []) assert.ok(pods.idx[table][k].includes(a.id), `${a.id} ${table} ${k}`);
  }
  for (const a of pods.articles) for (const s of a.works || []) assert.ok(pods.lab.works[s], s);
});
test("podcasts: nicene creed finds Passages, confessions finds the Reading Club, and searching shows is safe", () => {
  const r = PM.search("nicene creed");
  assert.ok(r.filter((a) => a.s === "passages").length >= 8, r.map((a) => a.t).slice(0, 5).join(" | "));
  assert.ok(PM.search("confessions augustine").filter((a) => /Confessions/.test(a.t)).length >= 10);
  assert.ok(PM.search("heidelberg").length >= 1);
  for (const q of ["", "a", "of", "\"", "zzzqqq"]) assert.doesNotThrow(() => PM.search(q), q);
});
test("podcasts: no Martin Luther King episode is tagged Martin Luther; no loose topic in a why line", () => {
  for (const id of pods.idx.author["Martin Luther"] || []) assert.ok(!/king/i.test(podById.get(id).t), podById.get(id).t);
  for (const a of pods.articles) assert.ok(!a.y || a.y.split("; ").length <= 2, `${a.t}: ${a.y}`);
});

test("podcasts: the placement functions place episodes on work, author, document and topic pages", () => {
  const MOD = require(path.join(root, "assets/js/lib/mo-articles-module.js"));
  const P = MOD.pick;
  assert.ok(P.work(PM, "pld-2722").length >= 10, "Confessions reading club");
  assert.ok(P.author(PM, "Augustine of Hippo").length >= 10);
  assert.ok(P.doc(PM, "cf-001-apostolic-and-ancient-creeds").filter((a) => a.s === "passages").length >= 5);
  const loci = JSON.parse(readFileSync(path.join(root, "assets/data/faith-received/loci.json"), "utf8"));
  let trin = null;
  (function walk(x) { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === "object") { if (x.id === "de-trinitate" && x.label) trin = x; else Object.values(x).forEach(walk); } }(loci));
  const t = P.topic(PM, "de-trinitate", [], P.topicTerms(trin));
  assert.ok(t.length >= 1 && t.every((a) => (a.topics || []).includes("de-trinitate") || a.s === "passages"), t.map((a) => a.t).join(" | "));
  assert.ok(P.author(PM, "Martin Luther").every((a) => !/king/i.test(a.t)));
});
async function asyncTest() {
  const seen = [];
  const warns = [];
  const realFetch = globalThis.fetch, realWarn = console.warn;
  globalThis.window = { MO_ARTICLES_DV: "abc123" };
  globalThis.fetch = (u) => { seen.push(u); return Promise.resolve({ ok: true, json: () => Promise.resolve({ imgBase: "https://x/", dv: "old", articles: [art("z", "Z", "2020-01-01", "work")], idx: {} }) }); };
  console.warn = (...a) => warns.push(a.join(" "));
  try {
    const L = MOArticles.create();
    await L.load();
    assert.deepEqual(seen, ["/assets/data/faith-received/mo-articles.json?v=abc123"]);
    assert.equal(warns.length, 2, warns.join(" | "));
    console.log("ok   load() asks for the data under its own version, in v, and warns on a stale copy");
  } finally { globalThis.fetch = realFetch; console.warn = realWarn; delete globalThis.window; }
}

// ── 3. the Resources page ──
const pageJs = read("assets/js/page/faith-resources.js");

test("every id the page script looks up is in the template, for both panels", () => {
  const names = new Set([...pageJs.matchAll(/ids\("([A-Za-z]+)"\)/g)].map((m) => m[1]));
  assert.ok(names.size >= 9, `found only ${names.size} ids`);
  for (const prefix of ["res", "pod"]) for (const n of names) assert.ok(new RegExp(`id="${prefix}${n}"`).test(tpl), `#${prefix}${n} is not in custom-faith-resources.hbs`);
});
test("one real tablist with the Articles and Podcasts tabs, each with its panel", () => {
  assert.equal((tpl.match(/role="tablist"/g) || []).length, 1);
  assert.equal((tpl.match(/role="tab"/g) || []).length, 2);
  for (const k of ["articles", "podcasts"]) {
    assert.match(tpl, new RegExp(`role="tab"[^>]*aria-controls="res-panel-${k}"`));
    assert.match(tpl, new RegExp(`role="tabpanel"[^>]*id="res-panel-${k}"[^>]*aria-labelledby="res-tab-${k}"`));
  }
  assert.match(tpl, /data-k="articles"[^>]*>Articles</);
  assert.match(tpl, /data-k="podcasts"[^>]*>Podcasts</);
  assert.match(tpl, /id="res-panel-podcasts"[^>]*hidden/);
});
test("each search box is a labelled type=search with a clear button and a live count", () => {
  for (const p of ["res", "pod"]) {
    assert.match(tpl, new RegExp(`<label[^>]*for="${p}Query"`));
    assert.match(tpl, new RegExp(`<input type="search" id="${p}Query"`));
    assert.match(tpl, new RegExp(`id="${p}Clear"`));
    assert.match(tpl, new RegExp(`id="${p}Count" role="status" aria-live="polite"`));
  }
});
test("scripts load in dependency order and the page has no inline script", () => {
  const order = ["js/lib/mo-podcasts-dv.js", "js/lib/mo-articles.js", "js/page/scripture-dev-core.js", "js/page/faith-resources.js"].map((f) => tpl.lastIndexOf(f));
  assert.ok(order.every((i) => i > 0) && order[0] < order[1] && order[1] < order[2] && order[2] < order[3], order.join(","));
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(tpl), "inline script");
  assert.ok(!/ on[a-z]+="/i.test(tpl), "inline handler");
});
test("the rail carries Resources between Research and About", () => {
  const rail = read("partials/faith-received/_tfr-rail.hbs");
  const a = rail.indexOf('data-tfr-drawer="research"');
  const b = rail.indexOf('href="/the-faith-received/resources/"');
  const c = rail.indexOf('data-tfr-drawer="about"');
  assert.ok(a > 0 && b > a && c > b, `${a} ${b} ${c}`);
});
test("a card is one link with an image or a placeholder, a sized image box, alt text and lazy loading", () => {
  const css = read("assets/css/faith-resources.css");
  assert.match(pageJs, /<a class="fr-res-cardlink" href=/);
  assert.match(pageJs, /<img class="fr-res-photo"[^`]*width="600" height="400" alt="[^`]*loading="lazy" decoding="async"/);
  assert.match(pageJs, /class="fr-res-ph" aria-hidden="true"/);
  assert.match(css, /\.fr-res-img \{[^}]*aspect-ratio: 3 \/ 2/);
  assert.match(css, /min-width: 1000px\) \{ \.fr-res \.fr-res-grid \{ grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.ok(!/line-clamp|text-overflow/.test(css), "a card clamps or ellipsizes text");
  assert.match(css, /align-items: start/);
  assert.match(css, /\.fr-res-img \{[^}]*border-radius: 8px/);
  assert.match(pageJs, /class="fr-res-cwhy"/);
  assert.ok(!/max-width: 820px/.test(css), "the narrow column is back");
  assert.match(tpl, /class="container fr-res-wrap"/);
  assert.ok(!/\.bhero-inner\.container \{/.test(css), "the hero container is overridden");
  assert.ok(!/container-narrow/.test(tpl), "the narrow container is back");
});
test("the page shows everything: no Show more control anywhere", () => {
  assert.ok(!/show (\d+ |all )?more|show all|resMore/i.test(tpl + pageJs) && !/\bPAGE\b/.test(pageJs), "a pagination control is back");
  assert.match(read("assets/css/faith-resources.css"), /\.fr-res-card \{[^}]*content-visibility: auto/);
  assert.match(pageJs, /loading="lazy" decoding="async"/);
});
test("the page copy has no em dash and the links open the original safely", () => {
  assert.ok(!/\u2014|&mdash;/.test(tpl + pageJs), "em dash");
  assert.match(pageJs, /target="_blank" rel="noopener"/);
});

try { await asyncTest(); } catch (e) { failed++; console.error(`FAIL load() version\n     ${e.message}`); }
if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log("\nmo-articles: all checks passed");
