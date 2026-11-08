/*
 * Every commentary the Scripture pane offers must open: a page loader that returns text, and an anchor for the verse.
 *
 * WHY THIS EXISTS. 2026-10-19, the owner, choosing "Westminster Annotations" (eebo-53832) on /the-faith-received/scripture/?ref=genesis.1.3:
 * "This page could not be loaded." The pane read every work from v1/works/<slug>/meta.json; an EEBO work has no such file (404), its
 * text is /eebo/<id>.json.gz, a tree of HTML with page marks. "We need to make sure everything is loading."
 *
 * Offline (always): the page loaders on small fixtures, including the DOM-free TEI scanner and the EEBO page map.
 * Live (opt in: --live, or COMMENTARY_LIVE=1): for Genesis 1, John 6, Psalm 22, Romans 8 and Isaiah 53, opens every commentary the
 * pane lists (works with a note on the chapter or a page the map gives for it) through the pane's own loader and resolver, and
 * prints what loaded and what did not. A live run that cannot reach the library says so and passes.
 *
 * Run: node scripts/check-commentary-pages.mjs [--live] [--verbose]
 */
import { createRequire } from 'node:module';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(import.meta.url);
const P = req(path.join(root, 'assets/js/page/commentary-pages.js'));
const A = req(path.join(root, 'assets/js/page/commentary-anchor.js'));
let failed = 0;
const ok = (cond, msg) => { if (!cond) { failed += 1; console.error(`FAIL  ${msg}`); } else console.log(`ok    ${msg}`); };

// ── offline: the loaders on fixtures ────────────────────────────────────────────────────────────────────────────────────
const TEI = `<?xml version="1.0"?><TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><p>header is not body</p></teiHeader><text><body>
<pb n="3"/><p>First &amp; <hi>second</hi> words.<note><p>inner note text</p></note> After.</p>
<pb n="4"/><head>A head</head><p xml:lang="la">Latin line</p><div><p xml:lang="en">English line</p></div>
<note><p>a note paragraph is left out</p></note><!-- a comment --></body></text></TEI>`;
const marks = [], blocks = [];
P.scanTei(TEI, (t, a) => marks.push([t, a.trim()]), (t, l) => blocks.push([t, l]));
ok(marks.length === 2 && /n="3"/.test(marks[0][1]), 'TEI scanner: page breaks are found, the header is not read');
ok(blocks[0][0] === 'First & second words.inner note text After.', 'TEI scanner: a paragraph keeps its inline note text and decodes entities');
ok(blocks.map((b) => b[0]).join('|') === 'First & second words.inner note text After.|A head|Latin line|English line', 'TEI scanner: a paragraph inside a note is left out');
ok(blocks[2][1] === 'la' && blocks[3][1] === 'en', 'TEI scanner: xml:lang is inherited');

const EEBO_DATA = { meta: { title: 'Annotations' }, toc: [
  { id: 'a', label: 'Title', html: '<span class="pb" data-n="1"></span> <p>ANNOTATIONS Upon all the BOOKS</p>', kids: [] },
  { id: 'b', label: 'Genesis', html: '<p><b>GENESIS</b></p>', kids: [
    { id: 'b1', label: 'Chap. 1', html: '<span class="pb" data-n="11"></span><p>1. <i>In the beginning</i> God created &amp; made.</p><p>2. And the earth</p><span class="pb" data-n="12"></span><p>3. And God said</p>', kids: [] }] }] };
const pm = P.eeboPageMap(EEBO_DATA);
ok(pm.get('1')[0] === 'ANNOTATIONS Upon all the BOOKS' && pm.get('11').length === 2 && pm.get('11')[0].startsWith('1. In the beginning God created & made'),
  'EEBO: paragraphs fall under the page mark they follow, tags and entities removed');

const fake = { async json(u) { if (/\/eebo\/53832\.json\.gz$/.test(u)) return EEBO_DATA; throw new Error(`404 ${u}`); }, async text() { throw new Error('no text'); } };
const pg = P.createPages({ base: 'http://x', mo: true, ...fake });
const e11 = await pg.page('eebo-53832', 11);
ok(e11.p && /In the beginning/.test(e11.p.en) && e11.last === 12, 'EEBO work: page 11 loads from /eebo/<id>.json.gz, never from v1/works/<slug>/meta.json');
ok((await pg.page('eebo-53832', 99)).p === null, 'EEBO work: a page that does not exist is null, not an error');
const R = A.createResolver(async (slug, n) => { const d = await pg.page(slug, n); const lines = d.p ? d.p.en.split('\n') : []; return [lines, []]; });
const rr = await R.resolve({ slug: 'eebo-53832', notes: {}, rows: {}, open: 11, close: 13, pv: {} }, 3, { name: 'Genesis', ch: '1' });
ok(rr && rr.p >= 11, `EEBO work: the resolver anchors on it (got ${JSON.stringify(rr)})`);

// (2026-11-08) a Migne file that opens with the volume's own mark where the first column's would be ("35", then "35:1380", Augustine's
// Tractates on John): the text before the first column mark is its column, 1379, and the map's "35" opens there
const PLD = `<?xml version="1.0"?><TEI xmlns="http://www.tei-c.org/ns/1.0"><text xml:lang="la"><body><div>
<milestone unit="column" n="35"/><p xml:lang="la">In Joannis evangelium tractatus CXXIV</p>
<head>TRACTATUS I. In illud Joannis, In principio erat Verbum. Cap. I, V\\. 1-5.</head><p xml:lang="en">TRACTATE I. On that of John, In the beginning was the Word. Chap. I, V. 1-5.</p>
<p xml:lang="la">1. Intuens quod modo audivimus.</p><p xml:lang="en">1. Seeing what we have just heard.</p>
<milestone unit="column" n="35:1380"/><p xml:lang="en">2. For this John, most beloved brothers.</p>
<milestone unit="column" n="35:1381"/><p xml:lang="en">3. For there are other mountains.</p>
<milestone unit="column" n="35"/><p xml:lang="en">124. The end of the work.</p></div></body></text></TEI>`;
const pgM = P.createPages({ base: 'http://x', mo: true, async json() { throw new Error('no json'); }, async text(u) { if (/\/v1\/tei\/pld\/2824\.xml$/.test(u)) return PLD; throw new Error(`404 ${u}`); } });
const m35 = await pgM.page('pld-2824', 35), m1379 = await pgM.page('pld-2824', 1379);
ok(m1379.p && m1379.p.n === 1379 && /TRACTATE I\./.test(m1379.p.en) && /1\. Seeing/.test(m1379.p.en), "Migne: the text before the first column mark is the column before it (Tractate I's heading and its §1, col. 1379)");
ok(m35.p && m35.p.n === 1379, "Migne: the volume's number on the map opens that first column");
ok(/124\. The end/.test((await pgM.page('pld-2824', 1381)).p.en), 'Migne: a volume mark after the first column is no column, and its text stays with the column before');

// ── live ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const live = process.argv.includes('--live') || process.env.COMMENTARY_LIVE === '1';
if (live) {
  const BASE = 'https://mo-tfr-library.mo-podcast-feed.workers.dev';
  const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36' };
  const get = async (u) => {
    let r = await fetch(u, { headers: UA });
    if (r.status === 403) r = await fetch(u, { headers: { 'User-Agent': 'curl/8.7.1' } });
    if (!r.ok) throw new Error(`${r.status} ${u}`);
    let b = Buffer.from(await r.arrayBuffer());
    if (b[0] === 0x1f && b[1] === 0x8b) b = zlib.gunzipSync(b); // the worker already opens them; this is for a plain file server
    return b.toString();
  };
  const memo = new Map();
  const json = (u) => { if (!memo.has(u)) { const p = get(u).then(JSON.parse); p.catch(() => memo.delete(u)); memo.set(u, p); } return memo.get(u); };
  let reachable = true;
  try { await json(`${BASE}/v1/devotion.json.gz`); } catch (e) { reachable = false; console.log(`skip  live matrix: the library is not reachable (${e.message})`); }
  if (reachable) {
    const live1 = P.createPages({ base: BASE, mo: true, json, text: get });
    const chapters = [['genesis', 1, 'Genesis', 3], ['john', 6, 'John', 35], ['psalms', 22, 'Psalms', 1], ['romans', 8, 'Romans', 1], ['isaiah', 53, 'Isaiah', 5]];
    const verbose = process.argv.includes('--verbose');
    const rows = [];
    for (const [book, ch, name, verse] of chapters) {
      const { works } = await live1.listWorks(book, ch);
      const getParas = async (slug, n) => { try { const d = await live1.page(slug, n); return d.p ? [P.paragraphs(d.p.en), P.paragraphs(d.p.la)] : [[], []]; } catch (_) { return [[], []]; } };
      const res = A.createResolver(getParas);
      let good = 0; const bad = [];
      const queue = works.slice();
      await Promise.all(Array.from({ length: 6 }, async () => {
        for (let c = queue.shift(); c; c = queue.shift()) {
          try {
            let t = null;
            if (c.collected) t = { p: (c.collected[verse] || Object.values(c.collected)[0])[0][1] };
            else t = await res.resolve(c, verse, { name, ch: String(ch) });
            if (!t) throw new Error('no anchor');
            const d = await live1.page(c.slug, t.p);
            const p2 = d.p || (await live1.page(c.slug, t.p + P.stride(c.slug))).p;
            if (!p2 || !(p2.en || p2.la)) throw new Error(`page ${t.p} is empty`);
            good += 1;
          } catch (e) { bad.push(`${c.slug} (${c.a}): ${e.message}`); }
        }
      }));
      rows.push([`${name} ${ch}`, works.length, good, bad]);
      console.log(`${name} ${ch}: ${good} of ${works.length} commentaries load`);
      for (const b of bad) console.log(`   FAIL ${b}`);
      if (verbose) console.log(`   (verse ${verse})`);
    }
    const total = rows.reduce((a, r) => a + r[1], 0), loaded = rows.reduce((a, r) => a + r[2], 0);
    console.log(`\nmatrix: ${loaded} of ${total} commentaries load`);
    ok(loaded === total, 'every commentary the pane offers on the five chapters loads (see the list above for any that do not)');
  }
}

if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1); }
console.log('\ncommentary pages: all checks passed');
