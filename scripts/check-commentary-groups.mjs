/*
 * The commentary lists on a chapter (assets/js/page/scripture-dev-core.js commentaryGroups), run on the live library.
 *
 * WHY THIS EXISTS. Review of #175, 2026-10-20: on Psalm 51 Luther's volumes were in two places (15 in his card, 11 more as a second
 * Luther row under "Cited in commentaries on other books"), Salmeron and Albert and Melanchthon were in two lists, a 17th-century Dutch
 * Reformed scholar (Heinsius) was filed under Byzantine, Baxter's and Hammond's Psalms were listed "On the whole Bible", and an
 * allusion was labeled "Cites". This loads the core with a stubbed page, fetches what the page fetches (rank.json, the hits file, the
 * verse worker's commentaries) for five chapters, and asserts the rules below on what comes out.
 *
 * Run: node scripts/check-commentary-groups.mjs     Skips (exit 0) when the library cannot be reached.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UA = { 'User-Agent': 'curl/8.7.1' };
const real = (url, init) => fetch(url, { ...(init || {}), headers: { ...UA, ...((init && init.headers) || {}) } });

const CORE_SRC = readFileSync(path.join(root, 'assets/js/page/scripture-dev-core.js'), 'utf8');
const win = {};
const ctx = vm.createContext({
  window: win,
  document: { addEventListener() {}, querySelector() { return null; }, createElement() { return {}; }, documentElement: {} },
  location: { search: '', hash: '', origin: 'https://example.test' },
  localStorage: { getItem() { return null; }, setItem() {} },
  navigator: {}, console, URL, URLSearchParams, Promise, setTimeout, Intl,
  fetch: real,
});
ctx.globalThis = ctx;
vm.runInContext(CORE_SRC, ctx);
vm.runInContext(readFileSync(path.join(root, 'assets/js/page/scripture-source-groups.js'), 'utf8'), ctx);
const S = win.MOScriptureDev;

let failed = 0;
const ok = (cond, msg) => { if (!cond) { failed += 1; console.error(`FAIL  ${msg}`); } else console.log(`ok    ${msg}`); };

// offline: skip, as the other live checks do
try {
  const r = await real('https://mo-tfr-library.mo-podcast-feed.workers.dev/v1/scripture/rank.json');
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
} catch (err) {
  console.log(`skip  the library is not reachable (${err.message}); check-commentary-groups not run`);
  process.exit(0);
}

const CHAPTERS = [['psalms', 51], ['psalms', 22], ['john', 1], ['genesis', 1], ['romans', 3]];
const nameOf = (e) => String(e.a || '');
const isFirm = (e) => !/^Uncertain author/i.test(nameOf(e));
const strip = (a) => a.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
const LISTS = ['book', 'whole', 'cited', 'other'];
const tradLabel = (list) => { let cur = ''; return list.map((e) => { if (e.tradHead) cur = e.tradHead; return [e, cur]; }); };

await S.loadRank();
for (const [slug, c] of CHAPTERS) {
  const book = S.BOOK_BY_SLUG.get(slug);
  const label = `${book.name} ${c}`;
  const d = await S.fetchCommentaries(book, c, S.emptyFilters());
  if (!d) { ok(false, `${label}: the worker returned no commentaries`); continue; }
  const g = S.commentaryGroups(d.items, book, d.cited);
  const rows = LISTS.flatMap((k) => g[k].map((e) => [k, e]));

  // 1. one row per author, in one list
  const seen = new Map();
  let dupes = [];
  for (const [k, e] of rows) {
    if (!isFirm(e)) continue;
    // a whole-Bible set (sets.json, 2026-10-23) has its own row: Poole's Synopsis and his Annotations are two sets of one author
    const key = e.setId ? `set:${e.setId}` : strip(nameOf(e));
    if (seen.has(key)) dupes.push(`${nameOf(e)} (${seen.get(key)} and ${k})`); else seen.set(key, k);
  }
  ok(!dupes.length, `${label}: one row per author across the four lists${dupes.length ? ` -- ${dupes.slice(0, 4).join('; ')}` : ''}`);

  // every volume once: in a row or beneath one
  const placed = [];
  rows.forEach(([, e]) => { placed.push(e.w, ...(e.more || []).map((x) => x.w)); });
  const all = [...(d.items || []), ...(d.cited || [])].map((e) => e.w);
  ok(new Set(placed).size === placed.length, `${label}: no volume is listed twice`);
  ok(all.every((w) => placed.includes(w)), `${label}: no volume is lost (${all.length})`);

  // 2. Luther at most one row
  ok(rows.filter(([, e]) => /Luther/.test(nameOf(e)) && /Martin/.test(nameOf(e))).length <= 1, `${label}: Martin Luther has at most one row`);

  // 3. no later scholar under the Byzantine or the Medieval
  const bad = [...tradLabel(g.book), ...tradLabel(g.whole)].filter(([e, t]) => (t === 'Byzantine' || t === 'Medieval') && Number(e.cen) >= 16);
  ok(!bad.length, `${label}: no 16th-century or later author under Byzantine or Medieval${bad.length ? ` -- ${bad.map(([e]) => nameOf(e)).join('; ')}` : ''}`);

  // 4. no work whose title names one book in the whole-Bible list
  const named = g.whole.filter((e) => /\b(Psalms?|Genesis|Romans|John)\b/.test(e.t || '') && !/\b(all|whole|Testament|Bible|Gospels|Scriptures?|books)\b/i.test(e.t || ''));
  ok(!named.length, `${label}: the whole-Bible list holds no work titled for one book${named.length ? ` -- ${named.map((e) => e.t).join('; ')}` : ''}`);

  // 5. an allusion is never labeled "Cites": the row's label is built in commentaryItem (it needs a page), so the rule is read from
  // the source and the rows that reach it are counted
  const allusions = rows.flatMap(([, e]) => [e, ...(e.more || [])]).filter((e) => e.hit && e.hit.how === 'allusion');
  ok(/alludes\(e\) \? "Alludes to" : "Cites"/.test(CORE_SRC), `${label}: ${allusions.length} allusion row(s) go through the "Alludes to" label`);

  // 6. the cited list: the strongest authors first, allusions last
  const firstAllusion = g.cited.findIndex((e) => e.allusionOnly);
  ok(firstAllusion < 0 || g.cited.slice(firstAllusion).every((e) => e.allusionOnly), `${label}: authors who only allude come last in the cited list`);

  // 7. a speculative attribution is under Other works, not a tradition
  const guessIn = rows.filter(([k, e]) => /^Uncertain author\s*\(/i.test(nameOf(e)) && k !== 'other');
  ok(!guessIn.length, `${label}: guessed authors ("Uncertain author (Bede?)") are only under Other works`);

  if (slug === 'psalms' && c === 51) {
    const mus = tradLabel(g.book).find(([e]) => /Musculus/.test(nameOf(e)));
    ok(mus && mus[1] === 'Continental Reformed', 'Psalm 51: Musculus is under Continental Reformed');
    ok(mus && mus[0].isKey && mus[0].tradRank != null, 'Psalm 51: Musculus is a key commentary on the Psalms');
    const lu = rows.find(([, e]) => /Martin Luther/.test(nameOf(e)));
    ok(lu && lu[0] === 'book' && (lu[1].more || []).length >= 20, `Psalm 51: Luther's one row is in the book list with his volumes beneath (${lu ? (lu[1].more || []).length + 1 : 0})`);
    const sal = rows.find(([, e]) => /Salmer/.test(nameOf(e)));
    ok(sal && sal[0] === 'cited', 'Psalm 51: Salmeron is in the cited list only');
  }
  if (slug === 'john' && c === 1) {
    const h = tradLabel(g.book).find(([e]) => /Heinsius/.test(nameOf(e)));
    ok(!h || h[1] !== 'Byzantine', 'John 1: Daniel Heinsius is not under Byzantine');
  }
}

if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1); }
console.log('\nall commentary-group checks passed');
