#!/usr/bin/env node
/*
 * Narrow Early English Books to the theological and devotional works.
 *
 * EEBO is every book printed in English before 1700 — 53,831 of them,
 * and most are not what a theological reading room is for. A random
 * dozen turns up a newsbook, poor-relief proposals, Edinburgh council
 * orders, a ballad, an Italian poem and a Newgate dialogue. Carrying
 * all of it makes the library harder to use and misrepresents what MO
 * is offering.
 *
 *   node scripts/build-eebo-theological.mjs
 *
 * Two signals, unioned:
 *
 *   1. Scripture density. A work citing three or more distinct
 *      chapters is almost certainly theological whatever its title
 *      says. Sampling works above twenty chapters found nothing that
 *      was not — the Sabbath, invocation of saints, the Cartwright
 *      controversy, the church catholic.
 *   2. Title vocabulary. Words that on a title page of this period
 *      belong to divinity and almost nothing else. This catches works
 *      the scripture signal misses — "The excellence of the order of
 *      the Church of England, under Episcopal government" cites no
 *      chapter but is plainly ecclesiology.
 *
 * Neither alone is enough: 5,101 works pass on scripture without the
 * vocabulary, 7,207 on vocabulary without the scripture.
 *
 * EDITORIAL: the threshold and the word list are judgement calls, not
 * facts. Both are meant to be argued with. Loosen CHAPTER_THRESHOLD to
 * take in more; tighten it to take in less. Print the sample at the
 * end and read it before believing the number.
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "data", "eebo");
const OUT = path.join(OUT_DIR, "theological.json");

const CHAPTER_THRESHOLD = 3;

const KEYWORDS = new RegExp(
  "\\b(" + [
    // Preaching and instruction
    "sermon", "sermons", "catechis", "preacher", "preaching", "pulpit",
    "exposition", "commentar", "paraphrase", "homil",
    // The discipline itself
    "divinit", "divine", "theolog", "doctrine of", "body of divinity",
    // Devotion and the interior life
    "godly", "godlin", "piet", "pious", "devotion", "devout", "meditat",
    "prayer", "prayers", "praier", "psalm", "psalter", "consolation",
    // Scripture and gospel
    "scriptur", "gospel", "bible", "testament", "evangelist",
    // Christ and God
    "christ", "christian", "jesus", "saviour", "trinit", "holy ghost",
    "holy spirit",
    // Sacraments and worship
    "sacrament", "baptis", "lord's supper", "eucharist", "liturg",
    "common prayer", "communion",
    // Church and polity
    "church", "churches", "ecclesiast", "bishop", "episcopa", "presbyter",
    "synod", "councel of", "discipline of the church",
    // Controversy
    "papist", "popish", "popery", "antichrist", "heresie", "heretic",
    "schism", "idolatr", "superstition", "recusant", "nonconformi",
    // The order of salvation
    "salvation", "saluation", "justificat", "sanctificat", "repentance",
    "conversion", "grace", "faith", "redempt", "covenant", "predestinat",
    "election", "reprobat", "providence", "resurrection", "damnation",
    "regenerat", "perseverance",
    // Last things and the soul
    "soul", "soule", "sinner", "sinne", "heaven", "hell", "eternal life",
    "immortalit", "judgement day", "day of judgement",
    // Confessional documents
    "confession of faith", "articles of religion", "creed",
    // Added after reading the dropped sample: "A treatise of the
    // Sabbath" and a Quaker tract on Babylon's merchants were both
    // being discarded. Sabbatarianism and the sect controversies are
    // exactly the divinity this library is for.
    "sabbath", "saint", "saints", "worship", "minister", "ministry",
    "apostle", "prophet", "spiritual", "holiness", "righteous",
    "blessed", "mercy", "word of god", "babylon", "quaker", "anabaptist",
    "arminian", "calvinist", "puritan", "protestant", "catholick",
    "reformation", "martyr", "persecut", "conscience", "pilgrim",
    "vanity", "worldly", "flesh and", "day of the lord", "kingdom of god",
    "kingdome of god", "new birth", "born again",
  ].join("|") + ")\\b",
  "ig"
);

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

const cat = await getJSON("https://eebo-backup.vercel.app/data/catalogue.json");
const works = Array.isArray(cat) ? cat : cat.works || [];

const scripture = await getJSON("https://eebo-backup.vercel.app/data/scripture.json");
const chaptersCited = new Map();
for (const ids of Object.values(scripture.byref || {})) {
  for (const id of ids) {
    const k = String(id);
    chaptersCited.set(k, (chaptersCited.get(k) || 0) + 1);
  }
}

const keep = [];
const drop = [];
let byScripture = 0;
let byTitle = 0;
let byBoth = 0;

// A single theological word proves little on a title page of this
// period — political tracts invoke grace, conscience and the church
// constantly. "A Petition humbly presented to his Highness the Lord
// Protector" matched on one word and is not divinity. Two independent
// words is a far better bar; one word still passes if the work also
// carries scripture.
function titleHits(title) {
  KEYWORDS.lastIndex = 0;
  const seen = new Set();
  let m;
  while ((m = KEYWORDS.exec(title || ""))) seen.add(m[1].toLowerCase());
  return seen.size;
}

for (const w of works) {
  const cites = chaptersCited.get(String(w.i)) || 0;
  const hits = titleHits(w.t);
  const s = cites >= CHAPTER_THRESHOLD;
  const t = hits >= 2 || (hits >= 1 && cites >= 1);
  if (s && t) byBoth += 1;
  else if (s) byScripture += 1;
  else if (t) byTitle += 1;
  (s || t ? keep : drop).push(w);
}

// ── Second pass: the author ───────────────────────────────────────
//
// Title vocabulary judges each work alone, and a divine does not put
// divinity words on every title page. Perkins's "The whole duty of
// man", Hieron's "Workes", Gillespie's "Reasons for which the service
// booke, urged upon Scotland, ought to bee refused" and Jeremy Taylor
// on the power of parents over their children were all being thrown
// away — none carries two keywords, and Taylor's carries none.
//
// So identify the divines from the first pass and give them the
// benefit of the doubt on the rest of their shelf. An author with at
// least five works of which seven in ten are already theological is
// not writing almanacs with the remainder. That is deliberately
// self-bootstrapping: it needs no hand-kept list of names and it
// widens as the vocabulary widens.
//
// The bar matters. At 60% it lets in 1,039 and starts admitting
// pamphleteers who wrote about religion sometimes; at 80% it recovers
// only 314 and still misses Taylor. Five and 70% recovers 541 and
// catches 118 of the 287 authors on the source site's own curated
// Puritan and Anglican lists.

const AUTHOR_MIN_WORKS = 5;
const AUTHOR_PASS_RATE = 0.7;

const authorTotal = new Map();
const authorPassed = new Map();
const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);
for (const w of works) {
  const a = (w.a || "").trim();
  if (a) bump(authorTotal, a);
}
for (const w of keep) {
  const a = (w.a || "").trim();
  if (a) bump(authorPassed, a);
}

const divines = new Set();
for (const [a, n] of authorTotal) {
  if (n >= AUTHOR_MIN_WORKS && (authorPassed.get(a) || 0) / n >= AUTHOR_PASS_RATE) {
    divines.add(a);
  }
}

const recovered = [];
const stillDropped = [];
for (const w of drop) {
  (divines.has((w.a || "").trim()) ? recovered : stillDropped).push(w);
}
keep.push(...recovered);
drop.length = 0;
drop.push(...stillDropped);

await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT, JSON.stringify({
  v: 1,
  threshold: CHAPTER_THRESHOLD,
  total: works.length,
  kept: keep.length,
  ids: keep.map((w) => String(w.i)),
}));

const pct = (n) => `${((100 * n) / works.length).toFixed(1)}%`;
console.log(`EEBO: ${works.length.toLocaleString()} works`);
console.log(`  scripture and title : ${byBoth.toLocaleString()}`);
console.log(`  scripture only      : ${byScripture.toLocaleString()}`);
console.log(`  title only          : ${byTitle.toLocaleString()}`);
console.log(`  known divine        : ${recovered.length.toLocaleString()} (${divines.size.toLocaleString()} authors)`);
console.log(`\nkept    ${keep.length.toLocaleString()} (${pct(keep.length)})`);
console.log(`dropped ${drop.length.toLocaleString()} (${pct(drop.length)})`);

const sample = (list, n = 8) => list
  .filter((_, i) => i % Math.max(1, Math.floor(list.length / n)) === 0)
  .slice(0, n)
  .forEach((w) => console.log(`   ${(w.t || "").slice(0, 82)}`));

console.log("\nRead these before believing the number.");
console.log("\n— a sample of what is KEPT —");
sample(keep);
console.log("\n— a sample recovered by the author pass —");
sample(recovered);
console.log("\n— a sample of what is DROPPED —");
sample(drop);
