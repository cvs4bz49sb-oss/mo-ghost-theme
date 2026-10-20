#!/usr/bin/env node
/*
 * Builds assets/data/faith-received/mo-articles.json: the Mere Orthodoxy essays that serve the library, and the
 * indexes that tell a page which of them belong on it (2026-10-20).
 *
 *   node scripts/build-mo-articles.mjs          write the file and print the coverage report
 *   node scripts/build-mo-articles.mjs --check  exit 1 if the file is stale or any entity does not resolve
 *   node scripts/build-mo-articles.mjs --live   also check every work slug against the live works index
 *
 * Input: scripts/mo-articles-input.json (prepared by scripts/prep-mo-articles-input.mjs; Ian approved all 493 rows).
 * Only a 240-character excerpt and keywords of each essay are kept. Every entry links to mereorthodoxy.com.
 *
 * Entities are checked against the library as it is checked in: loci.json (topics, with children), the
 * confession-proofs index and the councils guide (documents), the works index recorded in the input (works) and
 * the author names recorded there (authors). An entity that does not resolve is dropped and reported; the
 * --check run fails on any, so a bad row cannot ship quietly.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rel = (p) => path.join(root, p);
const readJson = (p) => JSON.parse(readFileSync(rel(p), "utf8"));
const OUT = "assets/data/faith-received/mo-articles.json";
const MAX_BYTES = 450 * 1024; // was 400 KB; the why line adds about 20 KB

const KIND = {
  "CREED-CONFESSION": "doc",
  "RESOURCE-FOR-WORK/AUTHOR": "work",
  "RETRIEVAL-GENERAL": "retrieval",
  "DOCTRINE/TEXT-ENGAGEMENT": "topic",
};

const input = readJson("scripts/mo-articles-input.json");
const imageInput = readJson("scripts/mo-articles-images.json");
const IMG_PATH = /^\d{4}\/\d{2}\/[A-Za-z0-9._%()~-]+\.(?:jpe?g|png|gif|webp|avif)$/i;
let withImage = 0;
let topicsWeak = 0;

// ── what the library has ──
const loci = new Map();
const lociObj = new Map();
for (const part of readJson("assets/data/faith-received/loci.json").parts) {
  for (const l of part.loci) {
    loci.set(l.id, l.label);
    lociObj.set(l.id, l);
    for (const c of l.children || []) { loci.set(c.id, c.label); lociObj.set(c.id, c); }
  }
}
const docTitle = new Map(readJson("assets/data/faith-received/confession-proofs/index.json").docs.map((d) => [d.s, d.t]));
const councils = JSON.stringify(readJson("assets/data/faith-received/guides/councils.json"));
const DOC_SLUG = /^(cf|rc|lc)-\d{3}-[a-z0-9-]+$/;
const docKnown = (s) => DOC_SLUG.test(s) && (docTitle.has(s) || councils.includes(`"${s}"`));
const books = new Map();
const bookNames = new Map();
{
  const core = readFileSync(rel("assets/js/page/scripture-dev-core.js"), "utf8");
  const canon = core.slice(core.indexOf("const CANON = ["), core.indexOf("const APOCRYPHA = ["));
  for (const m of canon.matchAll(/\["([a-z0-9-]+)", "([^"]+)", (\d+)/g)) { books.set(m[1], Number(m[3])); bookNames.set(m[1], m[2] === "Psalms" ? "Psalm" : m[2]); }
  if (books.size !== 66) throw new Error(`mo-articles: expected 66 canon books in scripture-dev-core.js, found ${books.size}`);
}

// Namesakes: the scan matched names, and some names belong to other people. An essay whose title or excerpt shows the other person, and not the
// library's author (or whose title is the other person's), is not tagged with the author. Each removal is printed so it can be read over.
const NAMESAKES = {
  "Martin Luther": { other: /martin luther king|\bMLK\b|king jr/i, own: /martin luther(?! king)|luther's/i },
  "John Calvin": { other: /calvin (coolidge|and hobbes|klein|college|university)|calvin & hobbes/i, own: /john calvin|jean calvin|calvin's institutes|calvinist/i },
  "Augustine of Hippo": { other: /st\.? augustine,? (fl\b|florida)|augustine, florida/i, own: /hippo|city of god|confessions/i },
};
const namesakeRemoved = [];
const problems = [];
const dropped = [];
const drop = (id, kind, v, why) => dropped.push(`${id} ${kind} ${v}: ${why}`);

// "romans.8", "romans.8.28", "romans.8.28-30" -> {book, c, from, to}; null when it is not a verse of the canon.
const parseVerse = (ref) => {
  const m = /^([a-z0-9-]+)\.(\d{1,3})(?:\.(\d{1,3})(?:-(\d{1,3}))?)?$/.exec(ref);
  if (!m || !books.has(m[1])) return null;
  const c = +m[2];
  if (c < 1 || c > books.get(m[1])) return null;
  const from = m[3] ? +m[3] : 0;
  const to = m[4] ? +m[4] : from;
  if (to < from) return null;
  return { book: m[1], c, from, to };
};

// ── the strong-signal rule for a topic (the Topic Desk's, assets/js/lib/mo-articles-module.js topic()): a loose keyword somewhere is not enough ──
const COMMON = new Set(["works", "merit", "word", "the word", "prophecy", "prophets", "cross", "mass", "canon", "bible", "ministry", "preaching",
  "discipline", "decree", "decrees", "sacrifice", "salvation", "persecution", "martyrdom", "reason", "tradition", "heresy", "revelation",
  "adoption", "theology", "method", "forgiveness", "faith", "law", "church", "christ", "god", "sin", "grace", "love", "death", "life", "worship"]);
const reEsc = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function topicTerms(l) {
  if (!l) return [];
  const raw = [l.label, ...(l.aliases || []).map((x) => String(x).replace(/-/g, " ")), ...(l.find || [])];
  const label = String(l.label || "").replace(/^(the|of|on)\s+/i, "").replace(/^person and work of /i, "");
  return [...new Set([...raw, label].map((x) => String(x || "").toLowerCase().trim()).filter((x) => x.length > 3 && !COMMON.has(x)))];
}
const termRe = (terms) => (terms.length ? new RegExp(`\\b(?:${terms.map(reEsc).join("|")})`, "i") : null);
const strongTopic = (o, id, order) => {
  const re = termRe(topicTerms(lociObj.get(id)));
  if (!re) return false;
  const tk = `${o.t} ${(o.w || []).join(" ")}`;
  return re.test(o.t) || (re.test(tk) && re.test(o.x)) || /^[\u2018\u2019'"]?Passages[,.:]? (Season|Chapter|Episode)/i.test(o.t) ||
    ((o.k === "doc" || o.k === "work") && o.f === "high" && order.slice(0, 2).includes(id) && re.test(`${tk} ${o.x}`));
};

// ── why an essay is here, in words: from what it matched and the scan's own reason, never from anything else ──
const DOC_NAMES = {
  "cf-001-apostolic-and-ancient-creeds": "the ancient creeds", "cf-013-council-of-nicea-i-325": "the Council of Nicaea",
  "cf-025-council-of-chalcedon-451": "the Council of Chalcedon", "cf-048-council-of-nicea-ii-787": "the Second Council of Nicaea",
  "cf-092-council-of-trent-1545-1563": "the Council of Trent", "lc-002-augsburg-confession-1530": "the Augsburg Confession",
  "rc-057-belgic-confession-1561": "the Belgic Confession", "rc-061-heidelberg-catechism-1563": "the Heidelberg Catechism",
  "rc-105-canons-of-dort-1618": "the Canons of Dort", "rc-111-westminster-confession-of-faith-1646": "the Westminster Confession",
  "rc-114-westminster-larger-catechism-1647": "the Westminster Larger Catechism", "rc-115-westminster-shorter-catechism-1647": "the Westminster Shorter Catechism",
  "x:bcp": "the Book of Common Prayer", "x:thirty-nine-articles": "the Thirty-Nine Articles", "x:confessionalism": "confessional standards",
  "x:savoy-declaration": "the Savoy Declaration", "x:vatican-ii": "Vatican II", "x:ccc": "the Catechism of the Catholic Church",
  "umb:westminster-standards": "the Westminster Standards",
};
const lowerThe = (t) => String(t).replace(/^The /, "the ");
const shortWork = (t) => lowerThe(String(t).replace(/\s*\([^)]*\)\s*$/, "").replace(/\.$/, ""));
const shortAuthor = (n) => (/ of | the /.test(n) ? n.split(/ of | the /)[0] : n);
function verseWords(refs) {
  const parsed = refs.map((r) => ({ r, v: parseVerse(r) })).filter((x) => x.v);
  const pick = parsed.find((x) => x.v.from) || parsed[0];
  if (!pick) return "";
  const v = pick.v;
  return `${bookNames.get(v.book)} ${v.c}${v.from ? `:${v.from}${v.to > v.from ? `-${v.to}` : ""}` : ""}`;
}
const FALLBACK = { doc: "On creeds and confessions", work: "Engages works and authors in the library", retrieval: "On theological retrieval", topic: "Engages doctrine and Scripture" };
function whyOf(o, a, docNames) {
  const clauses = [];
  const about = new Set(a.about || []);
  const slugs = a.docs;
  if (o.ks && o.ks.includes("retrieval") || o.k === "retrieval") clauses.push("On theological retrieval");
  // (a) creeds, confessions, councils: About when the essay is about them (title or central), Mentions otherwise
  const docs = slugs.map((slug) => ({ slug, name: docNames.get(slug) })).filter((d) => d.name);
  if (docs.length && clauses.length < 2) {
    const isAbout = docs.filter((d) => about.has(`doc:${d.slug}`));
    const use = (isAbout.length ? isAbout : docs).slice(0, 2);
    clauses.push(`${isAbout.length ? "About" : "Mentions"} ${use.map((d) => d.name).join(" and ")}`);
  }
  // (b) works and (c) authors, the author only when the essay shows the name or the scan counted two or more mentions
  const text = `${o.t} ${(o.w || []).join(" ")} ${o.x}`.toLowerCase();
  const strongAuthors = a.authors.filter((n) => {
    const word = shortAuthor(n).split(" ").pop().toLowerCase();
    const m = new RegExp(`${n.replace(/[.*+?^$()|[\]\\]/g, "\\$&")}[^;]*?(\\d+) mentions`, "i").exec(a.reason || "");
    return text.includes(word) || about.has(`author:${n}`) || (m && Number(m[1]) >= 2);
  });
  // a work counts when the scan marked it central, or counted it cited twice or more, or the essay shows its title
  const strongWork = (o.works || []).find((slug) => {
    const title = shortWork(labels.works[slug]).replace(/^the /i, "").toLowerCase();
    const m = new RegExp(`${reEsc(labels.works[slug].replace(/\s*\([^)]*\)\s*$/, ""))}[^;]*? cited (\\d+)x`, "i").exec(a.reason || "");
    return about.has(`work:${slug}`) || (m && Number(m[1]) >= 2) || (title.length > 4 && text.includes(title));
  });
  const workName = strongWork ? shortWork(labels.works[strongWork]) : "";
  if (clauses.length < 2 && (strongAuthors.length || workName)) {
    const parts = [];
    if (strongAuthors.length) parts.push(shortAuthor(strongAuthors[0]));
    if (workName) parts.push(workName);
    clauses.push(`Engages ${parts.join(" and ")}`);
  }
  // (d) Scripture, once
  const ref = verseWords(a.verses);
  if (ref && clauses.length < 2) clauses.push(`On ${ref}`);
  // (e) strong topics
  // Only the topic's own name counts here, not its looser aliases: "hell" in a reading of Dante is not the doctrine of Death and Judgment.
  const nameRe = (id) => {
    const l = lociObj.get(id);
    const label = String(l.label || "").replace(/^(the|of|on)\s+/i, "").replace(/^person and work of /i, "").toLowerCase();
    const terms = [String(l.label).toLowerCase(), label].filter((x) => x.length > 3 && !COMMON.has(x));
    return termRe(terms);
  };
  const topicId = (o.topics || []).find((id) => { const re = nameRe(id); return re && (re.test(o.t) || (re.test(`${o.t} ${(o.w || []).join(" ")}`) && re.test(o.x)) || /^[\u2018\u2019'"]?Passages[,.:]? (Season|Chapter|Episode)/i.test(o.t)); });
  if (topicId && clauses.length < 2) clauses.push(`Discusses ${lowerThe(labels.topics[topicId])}`);
  if (!clauses.length) return "";
  return clauses.map((c, i) => (i ? `${c.charAt(0).toLowerCase()}${c.slice(1)}` : c)).join("; ");
}

const articles = [];
const labels = { docs: {}, works: {}, topics: {} };
for (const a of input.articles) {
  const kind = KIND[a.class];
  if (!kind) { problems.push(`${a.id}: unknown class ${a.class}`); continue; }
  const o = { id: a.id, t: a.title, u: a.url, d: a.date, a: a.byline, k: kind, f: a.confidence, x: a.excerpt, w: a.keywords };
  if (!/^https:\/\/mereorthodoxy\.com\//.test(a.url)) problems.push(`${a.id}: url is not on mereorthodoxy.com`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date)) problems.push(`${a.id}: bad date ${a.date}`);
  const img = imageInput.images[a.id];
  if (img) {
    const ok = IMG_PATH.test(img.i) || /^https:\/\/(images\.unsplash\.com|storage\.ghost\.io)\/[^\s"<>]+$/.test(img.i);
    if (ok) { o.i = img.i; withImage++; if (img.ia) o.ia = img.ia; } else problems.push(`${a.id}: image ${img.i} is not a valid path or URL`);
  } else o.i = null;
  if (a.excerpt.length > 241) problems.push(`${a.id}: excerpt is ${a.excerpt.length} characters`);

  const works = [];
  for (const s of a.works) {
    if (input.workTitles[s]) { works.push(s); labels.works[s] = input.workTitles[s]; } else drop(a.id, "work", s, "not in the works index");
  }
  const authors = [];
  for (const s of a.authors) {
    const guard = NAMESAKES[s];
    const text = `${a.title} ${a.excerpt}`;
    if (guard && (guard.other.test(a.title) || (guard.other.test(text) && !guard.own.test(text)))) { namesakeRemoved.push(`${a.title} (${a.byline}): not ${s}`); continue; }
    if (input.authorWorks[s] > 0) authors.push(s); else drop(a.id, "author", s, "no works under that name in the library");
  }
  const docs = [], names = [];
  for (const s of a.docs) {
    if (docKnown(s)) { docs.push(s); labels.docs[s] = docTitle.get(s) || input.docLabels[s]; }
    else if (/^(x|umb):/.test(s)) names.push(input.docLabels[s] || s);
    else drop(a.id, "doc", s, "not in the confession-proofs index or the councils guide");
  }
  const topics = [];
  let weakTopics = 0;
  for (const s of a.topics) {
    if (!loci.has(s)) { drop(a.id, "topic", s, "not in loci.json"); continue; }
    // Only a strong signal keeps a topic: a word for it in the title, or in both a keyword and the excerpt, a Passages episode, or a high-confidence document or work essay.
    if (!strongTopic(o, s, a.topics)) { weakTopics++; continue; }
    topics.push(s); labels.topics[s] = loci.get(s);
  }
  topicsWeak += weakTopics;
  const verses = [];
  for (const s of a.verses) {
    if (parseVerse(s)) verses.push(s); else drop(a.id, "verse", s, "not a verse of the canon");
  }
  if (works.length) o.works = works;
  if (authors.length) o.authors = authors;
  if (docs.length) o.docs = docs;
  if (verses.length) o.verses = verses;
  if (topics.length) o.topics = topics;
  if (names.length) o.n = names;
  // Every kind the essay really has, from what it matched: k stays the primary one (it orders the groups).
  const has = { doc: docs.length > 0 || names.length > 0, work: works.length > 0 || authors.length > 0, retrieval: kind === "retrieval" || a.retrieval === true, topic: topics.length > 0 || verses.length > 0 };
  has[kind] = true;
  // Written only when there is more than one (to stay under the size cap); the loader answers [k] otherwise.
  const ks = [kind, ...["doc", "work", "retrieval", "topic"].filter((x) => x !== kind && has[x])];
  if (ks.length > 1) o.ks = ks;
  const docNames = new Map(a.docs.map((slug) => [slug, DOC_NAMES[slug] || (docTitle.get(slug) && lowerThe(docTitle.get(slug))) || (input.docLabels[slug] && lowerThe(input.docLabels[slug]))]));
  const y = whyOf(o, a, docNames);
  if (y) o.y = y;
  o.about = a.about; // consumed below, removed before writing
  articles.push(o);
}
for (const d of dropped) problems.push(`dropped ${d}`);

// ── indexes: about-the-subject first, then newest ──
const idx = { verse: {}, topic: {}, work: {}, author: {}, doc: {} };
const add = (table, key, o, about) => {
  const t = idx[table];
  (t[key] ||= []).push([about ? 0 : 1, o]);
};
for (const o of articles) {
  const about = new Set(o.about || []);
  for (const s of o.works || []) add("work", s, o, about.has(`work:${s}`));
  for (const s of o.authors || []) add("author", s, o, about.has(`author:${s}`));
  for (const s of o.docs || []) add("doc", s, o, about.has(`doc:${s}`));
  for (const s of o.topics || []) add("topic", s, o, about.has(`topic:${s}`));
  const seen = new Set();
  for (const ref of o.verses || []) {
    const v = parseVerse(ref);
    const isAbout = about.has(`verse:${ref}`) || about.has(`verse:${v.book}.${v.c}`);
    const keys = [`${v.book}.${v.c}`];
    if (v.from) for (let n = v.from; n <= v.to; n++) keys.push(`${v.book}.${v.c}.${n}`);
    for (const k of keys) if (!seen.has(k)) { seen.add(k); add("verse", k, o, isAbout); }
  }
}
const sortKey = (a, b) => a[0] - b[0] || (a[1].d < b[1].d ? 1 : a[1].d > b[1].d ? -1 : a[1].id < b[1].id ? -1 : 1);
for (const t of Object.values(idx)) {
  for (const k of Object.keys(t).sort()) t[k] = t[k].sort(sortKey).map((p) => p[1].id);
}
const sortedIdx = {};
for (const [name, t] of Object.entries(idx)) sortedIdx[name] = Object.fromEntries(Object.keys(t).sort().map((k) => [k, t[k]]));

for (const o of articles) delete o.about;
articles.sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : a.id < b.id ? -1 : 1));
const sortLabels = (m) => Object.fromEntries(Object.keys(m).sort().map((k) => [k, m[k]]));
const out = {
  v: 1,
  generated: input.generated,
  note: "Built by scripts/build-mo-articles.mjs from scripts/mo-articles-input.json. Do not edit by hand. Essays from Mere Orthodoxy that serve the library. Each entry links to the original. Keys: t title, u url, d date, a author, k kind, f confidence, x excerpt, w keywords.",
  imgBase: imageInput.imgBase,
  articles,
  lab: { docs: sortLabels(labels.docs), works: sortLabels(labels.works), topics: sortLabels(labels.topics) },
  idx: sortedIdx,
};
// The data version: a short hash of the content, written into the file as dv and into assets/js/lib/mo-articles-dv.js, which a page
// loads before the loader so the loader can ask for the file under a URL that changes exactly when the content does. The CDN keys the
// theme's data files on ?v= alone and keeps the old copy under an old key, so the version has to ride in v.
const DV_FILE = "assets/js/lib/mo-articles-dv.js";
const dv = createHash("sha1").update(JSON.stringify(out)).digest("hex").slice(0, 10);
const { v: outV, ...outRest } = out;
const text = `${JSON.stringify({ v: outV, dv, ...outRest })}\n`;
// The full-text index (mo-articles-index.json, from scripts/prep-mo-articles-search.mjs) carries its own dv; the stamp passes it on.
let indexDv = "";
try { indexDv = JSON.parse(readFileSync(rel("assets/data/faith-received/mo-articles-index.json"), "utf8")).dv || ""; } catch { /* no index yet */ }
const stamp = `/* Written by scripts/build-mo-articles.mjs: the versions of mo-articles.json and mo-articles-index.json. Do not edit. */\nwindow.MO_ARTICLES_DV = "${dv}";\n${indexDv ? `window.MO_ARTICLES_INDEX_DV = "${indexDv}";\n` : ""}`;
const bytes = Buffer.byteLength(text);
if (bytes > MAX_BYTES) problems.push(`${OUT} is ${(bytes / 1024).toFixed(0)} KB, over the ${MAX_BYTES / 1024} KB target`);

// ── coverage ──
const ids = new Set(articles.map((o) => o.id));
for (const [name, t] of Object.entries(sortedIdx)) for (const [k, list] of Object.entries(t)) for (const id of list) if (!ids.has(id)) problems.push(`idx.${name}.${k} names unknown article ${id}`);
const kinds = {};
for (const o of articles) kinds[o.k] = (kinds[o.k] || 0) + 1;
const report = [
  `mo-articles: ${articles.length} articles, ${(bytes / 1024).toFixed(0)} KB (target under ${MAX_BYTES / 1024} KB)`,
  `  kinds: ${Object.entries(kinds).map(([k, n]) => `${k} ${n}`).join(", ")}`,
  ...Object.entries(sortedIdx).map(([name, t]) => `  idx.${name}: ${Object.keys(t).length} keys, ${Object.values(t).reduce((n, l) => n + l.length, 0)} entries`),
  `  kinds per article: ${[1, 2, 3, 4].map((n) => `${n}: ${articles.filter((o) => (o.ks || [o.k]).length === n).length}`).join(", ")}`,
  `  topics dropped as weak signals: ${topicsWeak}; articles with a why line: ${articles.filter((o) => o.y).length} of ${articles.length}`,
  `  with a featured image: ${withImage} of ${articles.length}`,
  `  without any entity: ${articles.filter((o) => !o.works && !o.authors && !o.docs && !o.verses && !o.topics).length}`,
  `  unresolved or dropped: ${dropped.length}`,
  `  namesake guard removed ${namesakeRemoved.length} author tags${namesakeRemoved.map((x) => `\n    ${x}`).join("")}`,
];

const check = process.argv.includes("--check");
if (process.argv.includes("--live")) {
  const r = await fetch("https://mo-tfr-library.mo-podcast-feed.workers.dev/v1/works-index.json", { headers: { "User-Agent": "curl/8.7.1" } });
  if (!r.ok) problems.push(`live works index: HTTP ${r.status}`);
  else {
    const slugs = new Set((await r.json()).works.map((w) => w.slug));
    for (const s of Object.keys(labels.works)) if (!slugs.has(s)) problems.push(`work ${s} is not in the live works index`);
    report.push(`  live works index: ${slugs.size} works, ${Object.keys(labels.works).length} used`);
  }
}
console.log(report.join("\n"));
for (const p of problems) console.error(`  ! ${p}`);
if (check) {
  let current = "";
  try { current = readFileSync(rel(OUT), "utf8"); } catch { /* missing */ }
  let currentStamp = "";
  try { currentStamp = readFileSync(rel(DV_FILE), "utf8"); } catch { /* missing */ }
  if (currentStamp !== stamp) { console.error(`mo-articles: ${DV_FILE} does not match the data (dv ${dv}). Run node scripts/build-mo-articles.mjs`); process.exit(1); }
  if (current !== text) { console.error(`mo-articles: ${OUT} is stale. Run node scripts/build-mo-articles.mjs`); process.exit(1); }
  if (problems.length) process.exit(1);
  console.log("mo-articles: file current");
} else {
  writeFileSync(rel(OUT), text);
  writeFileSync(rel(DV_FILE), stamp);
  if (problems.length) process.exit(1);
}
