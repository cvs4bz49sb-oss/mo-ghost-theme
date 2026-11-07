/*
 * The Verse Desk's modules, built from the library's real data for twelve verses (2026-10-19).
 *
 * The desk shows only what the data supports, and the owner found wrong claims on the live site, so this runs the page's own module
 * builders (assets/js/page/verse-desk-model.js, pure functions) on John 1:1, John 3:16, Romans 3:23, Genesis 1:1, Genesis 1:26,
 * Psalm 22:1, Isaiah 53:5, Matthew 28:19, 1 Corinthians 15:3, Ephesians 2:8, Hebrews 1:3 and one obscure verse (Nehemiah 7:50), and asserts:
 *   - no module renders with empty data (and none is a shell: no empty list, no "undefined", no "planned" or "data needed");
 *   - a module is present exactly when its source data is non-empty (counted here from the raw files, not from the model);
 *   - the lede and the four tiles carry exactly the source counts, and the lede says nothing a count did not;
 *   - no author is named under a dispute side, none under the ribbon, and a reading names authors only under its "hold" list;
 *   - a gist never ends mid-word; every link has a shape that exists (reader page, a verse's desk, a creed's article paragraph);
 *   - John 1:1 reproduces the figures of the approved mockup.
 *
 * The reception, readings, baseline and rank files come from the library worker (cached in the temp folder; the check skips, and
 * passes, when the network is not reachable). The creeds' files and the portraits are the theme's own.
 *   node scripts/check-verse-desk.mjs
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const M = require(path.join(ROOT, "assets/js/page/verse-desk-model.js"));
const T = require(path.join(ROOT, "assets/js/page/faith-port-scripture-notes.js"));
const BASE = "https://mo-tfr-library.mo-podcast-feed.workers.dev";
const CACHE = path.join(os.tmpdir(), "mo-verse-desk-check");
fs.mkdirSync(CACHE, { recursive: true });

let failed = 0;
const fail = (m) => { failed += 1; console.error(`FAIL  ${m}`); };
const ok = (cond, m) => { if (!cond) fail(m); };

// ── the pure helpers first (no network) ──
ok(M.cleanGist("") === "", "cleanGist of nothing is nothing");
ok(M.cleanGist("Expounds the verse.") === "Expounds the verse.", "a whole sentence is left alone");
ok(M.cleanGist("A short phrase with no stop") === "A short phrase with no stop", "a short whole gist is left alone");
{
  const cut = "Concluding his prologue on the Gospel and its preachers, Origen opens the commentary on John 1:1 by surveying the manifold senses of the word 'beginning' (ἀρχή), beginnin";
  const g = M.cleanGist(cut);
  ok(g.endsWith("…") && !/beginnin…?$/.test(g) && /ἀρχή\)…$/.test(g), `a gist cut mid-word ends at a whole word: ${g}`);
  ok(M.plain("one "+String.fromCharCode(0x2014)+" two"+String.fromCharCode(0x2014)+"three") === "one, two, three", "an em dash in the library's prose becomes a comma");
  const two = "Luther preaches on the Trinity and John 1:1, defending the three persons. He insists on the unity of the divine essence against Arians, Jews, and Turks, who deny that the Word was God and so on and on and o";
  ok(/\.$/.test(M.cleanGist(two)), "a cut gist ends at the last whole sentence when it holds one");
  ok(M.cleanTitle("Exposition on the Third Epistle of Saint John (Expositio in Epistolam III S. Joa") === "Exposition on the Third Epistle of Saint John", "an unclosed parenthesis in a title is dropped");
  ok(M.cleanTitle("Homilies on John (Greek)") === "Homilies on John (Greek)", "a closed one is kept");
}
{
  const base = M.baseFrom({ centuries: [[1, 1], [2, 1], [3, 98]] });
  ok(M.outliers({ works: 100, strip: [[1, 1], [2, 1], [3, 98]] }, base).length === 0, "a verse cited as the library is cited has no standout century");
  ok(M.ord(11) === "11th" && M.ord(22) === "22nd" && M.ord(3) === "3rd" && M.ord(13) === "13th", "ordinals");
}

// ── the data ──
const get = async (rel) => {
  const f = path.join(CACHE, rel.replace(/[/]/g, "_"));
  if (fs.existsSync(f) && Date.now() - fs.statSync(f).mtimeMs < 6 * 3600e3) return JSON.parse(fs.readFileSync(f, "utf8"));
  const r = await fetch(`${BASE}/v1/${rel}`, { headers: { "User-Agent": "curl/8.7.1" } });
  if (!r.ok) throw new Error(`${rel}: ${r.status}`);
  const text = await r.text();
  fs.writeFileSync(f, text);
  return JSON.parse(text);
};
try { await get("scripture/rank.json"); } catch (e) { console.log(`skip  the library worker is not reachable (${e.message})`); process.exit(failed ? 1 : 0); }

const rank = await get("scripture/rank.json");
const base = M.baseFrom(await get("reception/scripture/_baseline.json"));
const cfIndex = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/data/faith-received/confession-proofs/index.json"), "utf8"));
const portraits = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/data/faith-received/verse-desk-portraits.json"), "utf8")).p;

const VERSES = [
  ["John", "john", "john", 1, 1], ["John", "john", "john", 3, 16], ["Romans", "romans", "romans", 3, 23], ["Genesis", "genesis", "genesis", 1, 1],
  ["Genesis", "genesis", "genesis", 1, 26], ["Psalm", "psalms", "psalms", 22, 1], ["Isaiah", "isaiah", "isaiah", 53, 5], ["Matthew", "matthew", "matthew", 28, 19],
  ["1 Corinthians", "1-corinthians", "i-corinthians", 15, 3], ["Ephesians", "ephesians", "ephesians", 2, 8], ["Hebrews", "hebrews", "hebrews", 1, 3],
  // The obscure verse was 3 John 13 until 2026-11 brought it a reading and a dispute (unwritten tradition), so it is a full
  // desk now. Nehemiah 7:50 is a name in a list of temple servants.
  ["Nehemiah", "nehemiah", "nehemiah", 7, 50],
];

// the same shapes scripture-dev-core.js builds (sourceHref, deskHref), for the links the modules make
const readHref = (slug, page, href) => {
  const m = String(href || "").match(/^\/read\/?\?(w=[^#]*)(#[A-Za-z0-9_.:-]*)?$/);
  if (m) return `/the-faith-received/read/?${m[1]}${m[2] || ""}`;
  return `/the-faith-received/read/?w=${encodeURIComponent(slug)}${page ? `#b${encodeURIComponent(page)}-0` : ""}`;
};
const READ_RX = /^\/the-faith-received\/read\/\?w=[A-Za-z0-9._%-]+(?:&hl=[^#"]*)?#b[A-Za-z0-9._%-]+-\d+$/;

const decode = (s) => s.replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const text = (html) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");

let portraitsSeen = 0, voicesSeen = 0;
for (const [name, slug, lib, c, v] of VERSES) {
  const tag = `${name} ${c}:${v}`;
  const rec = await get(`reception/scripture/${lib}/${c}.json`);
  const rdf = await get(`enrich/scripture-readings/${lib}/${c}.json`);
  const chapterFile = path.join(ROOT, `assets/data/faith-received/confession-proofs/${lib}/${c}.json`);
  const cfChapter = (cfIndex.chapters[lib] || []).includes(c) && fs.existsSync(chapterFile) ? JSON.parse(fs.readFileSync(chapterFile, "utf8")) : null;
  const fv = rdf.verses ? rdf.verses[String(v)] || null : null;
  const rv = rec.verses[String(v)] || null;
  const label = (cc, vv) => `${name} ${cc}:${vv}`;
  const ctx = {
    label: label(c, v), chapter: `${name} ${c}`, c, url: `https://mereorthodoxy.com/the-faith-received/scripture/desk/?ref=${slug}.${c}.${v}`,
    read: readHref, desk: (cc, vv) => `/the-faith-received/scripture/desk/?ref=${slug}.${cc}.${vv}`, portrait: (src) => `/assets/data/faith-received/guides/${src}`,
  };
  const m = M.build({ ref: { slug, lib, name, c, v }, label, rec, fv, base, rank, cf: cfChapter ? { index: cfIndex, chapter: cfChapter } : null, portraits, T, read: readHref });
  const mods = M.render(m, ctx);
  const html = Object.fromEntries(mods.map((x) => [x.id, x.html]));
  const all = mods.map((x) => x.html).join("\n");
  const say = (s) => console.log(`${failed ? "    " : "ok  "}  ${tag}: ${s}`);

  // ── the source counts, taken from the raw files ──
  const srcWorks = rv ? rv.works : 0;
  const srcReadings = ((fv && fv.readings) || []).filter((r) => r && r.label);
  const srcDisputes = ((fv && fv.disputes) || []).filter((d) => d.question && (d.sides || []).filter((s) => s.position).length >= 2);
  const srcCf = cfChapter ? (cfChapter.v[String(v)] || []).filter(([a]) => !cfIndex.docs[cfChapter.a[a][0]].p) : [];
  const srcCfDocs = new Set(srcCf.map(([a]) => cfIndex.docs[cfChapter.a[a][0]].s)).size;
  const srcCommentaries = rv ? Object.keys(rv.notes || {}).length : 0;
  const srcLadder = rv ? (rv.eras || []).some((e) => (e.top || []).some((x) => x.commentary && x.w && x.p)) : false;
  const srcHeat = Object.values(rec.verses).filter((x) => x && x.works > 0).length >= 3;

  // ── a module is there exactly when its data is ──
  ok(Boolean(html.hero) === Boolean(rv && rv.works), `${tag}: hero ${html.hero ? "present" : "absent"} but the reception entry ${rv ? "exists" : "is missing"}`);
  ok(Boolean(html.church) === Boolean(srcReadings.length), `${tag}: the church module and the readings file disagree (${srcReadings.length} readings)`);
  ok(Boolean(html.dispute) === Boolean(srcDisputes.length), `${tag}: the disputes module and the readings file disagree (${srcDisputes.length})`);
  ok(Boolean(html.confess) === Boolean(srcCf.length), `${tag}: the creeds module and the creeds file disagree (${srcCf.length})`);
  ok(Boolean(html.ladder) === srcLadder, `${tag}: the ladder and the commentary rows disagree`);
  ok(Boolean(html.heat) === srcHeat, `${tag}: the heat strip and the chapter file disagree`);
  ok(Boolean(html.share) === Boolean(rv && rv.works), `${tag}: share`);

  // ── no empty shell, no placeholder, no stray value ──
  for (const [id, h] of Object.entries(html)) {
    ok(h.trim().length > 0, `${tag}: module ${id} is empty`);
    ok(!/<(ul|ol)\b[^>]*>\s*<\/\1>/.test(h), `${tag}: module ${id} holds an empty list`);
    ok(!/undefined|NaN|\[object|>null</.test(h), `${tag}: module ${id} prints a missing value`);
    ok(!/planned|data needed|coming soon/i.test(h), `${tag}: module ${id} shows a placeholder`);
    ok(!/\u2014/.test(h.replace(/<q class="vd-q">[\s\S]*?<\/q>/g, "")), `${tag}: module ${id} has an em dash outside a quotation`);
    ok(!/\b(colour|centre|defence|honour|neighbour)\b/i.test(text(h)), `${tag}: module ${id} has British spelling`);
  }
  // ── tiles and lede equal the source counts ──
  const tiles = rv ? (m.hero.tiles || []) : [];
  const tile = (rx) => tiles.find((t) => rx.test(t.label));
  if (rv) {
    ok((tile(/Work/) || {}).n === srcWorks, `${tag}: works tile ${(tile(/Work/) || {}).n} vs ${srcWorks}`);
    ok(srcCommentaries ? (tile(/Commentar/) || {}).n === srcCommentaries : !tile(/Commentar/), `${tag}: commentaries tile vs ${srcCommentaries}`);
    ok(srcCf.length ? (tile(/Confession/) || {}).n === srcCf.length : !tile(/Confession/), `${tag}: confession tile vs ${srcCf.length}`);
    ok(srcReadings.length ? (tile(/Reading/) || {}).n === srcReadings.length : !tile(/Reading/), `${tag}: readings tile vs ${srcReadings.length}`);
    ok(tiles.every((t) => t.n > 0), `${tag}: a tile shows zero`);
    const lede = m.lede && m.lede.text;
    ok(Boolean(lede), `${tag}: no lede`);
    if (lede) {
      ok(lede.startsWith(`Cited in ${srcWorks.toLocaleString("en-US")} work`), `${tag}: the lede's works are not ${srcWorks}`);
      const nums = [...lede.matchAll(/\d[\d,]*/g)].map((x) => Number(x[0].replace(/,/g, "")));
      const allowed = new Set([srcWorks]);
      (rv.strip || []).forEach(([, n]) => allowed.add(n));
      if (srcReadings.length) {
        allowed.add(srcReadings.length); allowed.add(rdf.verses[String(v)].of);
        srcReadings.forEach((r) => allowed.add((r.n || [])[0]));
      }
      if (srcDisputes.length) allowed.add(srcDisputes.length);
      if (srcCf.length) { allowed.add(srcCf.length); allowed.add(srcCfDocs); }
      // century ordinals ("17th") are read as numbers too; they must be centuries in the strip
      const cents = new Set((rv.strip || []).map(([k]) => k));
      for (const x of lede.matchAll(/(\d+)(?:st|nd|rd|th)\b/g)) ok(cents.has(Number(x[1])), `${tag}: the lede names the ${x[0]} century, which is not in the strip`);
      const rest = lede.replace(/\d+(?:st|nd|rd|th)\b/g, "");
      for (const n of [...rest.matchAll(/\d[\d,]*/g)].map((x) => Number(x[0].replace(/,/g, "")))) ok(allowed.has(n), `${tag}: the lede prints ${n}, which no source count gives`);
      if (srcReadings.length) ok(lede.includes("a sample of"), `${tag}: the lede does not call the readings pages a sample`);
      if (srcReadings.length) ok(lede.includes(`found ${srcReadings.length === 1 ? "one reading" : `${srcReadings.length} readings`}`), `${tag}: lede readings count`);
      if (srcDisputes.length) ok(lede.includes(`records ${srcDisputes.length} question`), `${tag}: lede disputes count`);
      if (srcCf.length) ok(lede.includes(`${srcCf.length} article`) && lede.includes(`in ${srcCfDocs} `), `${tag}: lede confession counts`);
      if (!srcReadings.length) ok(!/reading/i.test(lede), `${tag}: the lede speaks of readings the verse does not have`);
      if (!srcCf.length) ok(!/article|creed|confession/i.test(lede), `${tag}: the lede speaks of confessions the verse does not have`);
      ok(!nums.some((n) => Number.isNaN(n)), `${tag}: lede number`);
    }
  }
  // ── no author under a dispute side or the ribbon; readings name authors only under "hold" ──
  const disputeNames = new Set();
  srcDisputes.forEach((d) => d.sides.forEach((s) => (s.witnesses || []).forEach((w) => disputeNames.add(String(w[2] || w[0] || "")))));
  if (html.dispute) {
    const t = text(html.dispute);
    for (const n of disputeNames) if (n.length > 3) ok(!t.includes(n), `${tag}: the disputes module names ${n}`);
    ok(!/<a\b/.test(html.dispute), `${tag}: a dispute side links to a page, which would imply a holder`);
    ok(/pages? discuss/.test(t), `${tag}: a dispute side shows no page count`);
  }
  const holdNames = new Set();
  srcReadings.forEach((r) => (r.holds || []).forEach((w) => holdNames.add(String(w[2] || w[0] || ""))));
  if (html.church) {
    const ribbon = (/<ol class="vd-ribbon">[\s\S]*?<\/ol>/.exec(html.church) || [""])[0];
    const rt = text(ribbon);
    for (const n of holdNames) if (n.length > 3) ok(!rt.includes(n), `${tag}: the ribbon names ${n}`);
    // TRUST: no author is named anywhere under a reading, held or not (the data gives no stance), only counts and page links
    const own = srcReadings.map((r) => `${r.label} ${r.reading} ${r.proves}`).join(" ");
    const whole = text(html.church);
    const exemplarNames = new Set();
    srcReadings.forEach((r) => (r.exemplars || []).forEach((e) => exemplarNames.add(String(e.author || ""))));
    for (const n of new Set([...holdNames, ...exemplarNames, ...disputeNames])) if (n.length > 3 && !own.includes(n)) ok(!whole.includes(n), `${tag}: the readings module names ${n}`);
    ok(!/vd-holders|Pages that hold|Held on/.test(html.church), `${tag}: the readings module still uses holder language`);
    // the ribbon's reading for a period is the one held on the most pages placed in it
    (m.ribbon ? m.ribbon.cells : []).forEach((cell) => {
      const g = M.GROUPS.find((x) => x.id === cell.id);
      const counts = srcReadings.map((r, i) => ({ label: r.label, k: m.readings.items[i].holdsList.filter((w) => g.eras.includes(w[3])).length }));
      const top = Math.max(0, ...counts.map((x) => x.k));
      const level = counts.filter((x) => x.k === top).length > 1;
      ok(cell.best ? cell.best.k === top && !level && cell.placed >= 5 : top === 0 || level || cell.placed < 5, `${tag}: ribbon ${cell.id} names a leader it cannot (placed ${cell.placed}, top ${top}, level ${level})`);
      ok(!cell.best || cell.placed >= 5, `${tag}: ribbon ${cell.id} has a leading reading from under five pages`);
      ok(cell.placed === counts.reduce((a, x) => a + x.k, 0), `${tag}: ribbon ${cell.id} placed count`);
    });
    // every reading's count is the file's own
    m.readings.items.forEach((it, i) => ok(it.hold === (srcReadings[i].n || [])[0], `${tag}: reading ${it.label} holds`));
  }
  // ── voices and gists ──
  (m.voices || []).forEach((vc) => {
    voicesSeen += 1; if (vc.portrait) portraitsSeen += 1;
    ok(!/[A-Za-z]{3,}$/.test(vc.gist) || /[.!?)"”’]$/.test(vc.gist) || vc.gist.endsWith("…"), `${tag}: ${vc.author}'s gist ends mid-word: ${vc.gist}`);
    ok(vc.gist.length <= 260, `${tag}: ${vc.author}'s gist is long`);
    ok(vc.w && vc.p, `${tag}: ${vc.author} has no page`);
  });
  ok(!m.voices || (m.voices.length >= 3 && m.voices.length <= 6), `${tag}: voices count ${m.voices && m.voices.length}`);
  {
    const curated = new Set(((rank.books && (rank.books[slug] || rank.books[lib])) || []).map((x) => x[0]));
    (m.voices || []).forEach((vc) => ok(curated.has(vc.author), `${tag}: ${vc.author} is a voice but not on the curated list for the book`));
    if (!curated.size) ok(!m.voices && !html.voices, `${tag}: voices on a book with no curated list`);
  }
  // every ladder rung opens at a note the reception history holds for this verse
  (m.ladder ? m.ladder.rungs : []).forEach((u) => u.rows.forEach((x) => ok(rv.notes[x.w] && String(rv.notes[x.w]) === String(x.p), `${tag}: ladder row ${x.w} has no note page ${x.p}`)));
  // ── links ──
  for (const mm of all.matchAll(/href="([^"]*)"/g)) {
    const h = decode(mm[1]);
    ok(READ_RX.test(h) || /^\/the-faith-received\/scripture\/desk\/\?ref=[a-z0-9-]+\.\d+\.\d+$/.test(h) || /^#/.test(h), `${tag}: a link with no known shape: ${h}`);
  }
  for (const mm of all.matchAll(/ref=([a-z0-9-]+)\.(\d+)\.(\d+)/g)) ok(mm[1] === slug && Number(mm[2]) === c, `${tag}: a desk link leaves the chapter`);
  // ── the heat strip's figures are the chapter file's ──
  (m.heat ? m.heat.top : []).forEach((t) => ok(t.n === rec.verses[String(t.v)].works, `${tag}: heat ${t.v}`));
  // ── tiers ──
  if (srcWorks >= 1000 && srcReadings.length && srcCf.length) ok(m.tier === "marquee", `${tag}: tier ${m.tier}`);
  if (!srcReadings.length && !srcCf.length) ok(m.tier === "thin", `${tag}: tier ${m.tier}`);
  say(`${m.tier}: ${mods.map((x) => x.id).join(", ")}${m.voices ? ` (${m.voices.length} voices)` : ""}`);

  // ── John 1:1 against the approved mockup ──
  if (slug === "john" && c === 1 && v === 1) {
    ok(tiles.map((t) => t.n).join() === "1915,33,21,9", `John 1:1 tiles ${tiles.map((t) => t.n)}`);
    ok(/15 documents, 7 traditions/.test(tiles[2].sub) && tiles[3].sub === "5 points in dispute", "John 1:1 tile subtitles");
    const want = { fathers: [27, 64], medieval: [7, 22], reformation: [16, 42], post: [36, 93] };
    for (const [id, [k, n]] of Object.entries(want)) {
      const cell = m.ribbon.cells.find((x) => x.id === id);
      ok(cell && cell.best && cell.best.k === k && cell.placed === n, `John 1:1 ribbon ${id}: ${cell && cell.best && cell.best.k} of ${cell && cell.placed}, wanted ${k} of ${n}`);
    }
    const modern = m.ribbon.cells.find((x) => x.id === "modern");
    ok(modern && !modern.best && modern.works === 73, "John 1:1 modern period has works but no reading");
    ok(m.ruler.outs.slice().sort((a, b) => a - b).join() === "3,4,6", `John 1:1 standout centuries ${m.ruler.outs}`);
    ok(m.ruler.tall === 17 && m.ruler.tallN === 552, "John 1:1 tallest century is the 17th with 552");
    ok(m.disputes.length === 5 && m.readings.items.length === 9, "John 1:1 has 9 readings and 5 questions");
  }
  if (slug === "nehemiah") {
    ok(!html.church && !html.dispute && !html.confess, "Nehemiah 7:50 shows no readings, disputes or creeds");
    ok(m.tier === "thin", "Nehemiah 7:50 is the compact desk");
  }
}
ok(voicesSeen > 0, "no voices on any verse");
console.log(`      ${portraitsSeen} of ${voicesSeen} voices have a portrait`);

if (failed) { console.error(`\ncheck-verse-desk: ${failed} failure(s)`); process.exit(1); }
console.log("\ncheck-verse-desk: ok");
