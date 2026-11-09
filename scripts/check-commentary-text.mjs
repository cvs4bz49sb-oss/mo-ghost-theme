/*
 * The Faith Received's page reader in commentary-pane.js (window.FRCommentaryText), with the pane off, as its other pages load it.
 *
 * WHY THIS EXISTS. 2026-11-08: The Faith Received's Scripture page moved from its own copy of the pane to this file. Its Preview buttons,
 * and its atlas, maps, decks, questions, controversies, set index and topic pages, read a Father in Migne or an EEBO book through
 * window.FRCommentaryText, loading this file with window.FR_COMMENTARY_PANE = false; this file used to return before it built anything
 * when the pane was off. Checked here, with no DOM and no network (node's vm, a stub page and fixtures):
 *   - with the pane off, on The Faith Received, the reader is there and the site's class (cp-site-tfr, which bible-notes.js reads as
 *     "the rail is beside the text") is not set;
 *   - fill() draws the page asked for and the next, names the source text ("Greek"), and says false for a page that is not there;
 *   - on Mere Orthodoxy's page (window.MOScriptureDev) the reader is not given: its verse rail keeps its links to the reader.
 *
 * Run: node scripts/check-commentary-text.mjs
 */
/* global console, process, Response, Blob, TextDecoder, DecompressionStream */
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(path.join(root, 'assets/js/page', f), 'utf8');
let failed = 0;
const ok = (cond, msg) => { if (!cond) { failed += 1; console.error(`FAIL  ${msg}`); } else console.log(`ok    ${msg}`); };

const EEBO = { meta: {}, toc: [{ id: 'a', html: '<span class="pb" data-n="5"></span><p>Chap. I. Verse 1. The first note.</p><span class="pb" data-n="6"></span><p>The page after.</p>', kids: [] }] };
const PG9 = `<?xml version="1.0"?><TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><div>
<milestone unit="column" n="57:0013"/><p xml:lang="grc">Βίβλος γενέσεως.</p><p xml:lang="en">The book of the generation.</p>
<milestone unit="column" n="57:0015"/><p xml:lang="grc">Ἀβραὰμ ἐγέννησε.</p><p xml:lang="en">Abraham begat.</p></div></body></text></TEI>`;
const BLOB = 'http://blob.test';
const routes = { [`${BLOB}/eebo/77.json.gz`]: JSON.stringify(EEBO), [`${BLOB}/tei/pg/9.xml`]: PG9 };

// a page of The Faith Received (or, with mo, Mere Orthodoxy's Scripture page) as far as the file reads it before the pane is built
function page(opts) {
  const classes = new Set(), asked = [];
  const store = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
  const w = {
    FR_COMMENTARY_PANE: false, __FR_BLOB_BASE__: `${BLOB}/`,
    location: { search: '', hash: '', href: 'https://site.test/atlas' },
    performance: { getEntriesByType: () => [] },
    sessionStorage: store(), localStorage: store(),
    document: { documentElement: { classList: { add: (c) => classes.add(c) } }, querySelector: () => null },
    fetch: (u) => { asked.push(u); const b = routes[u]; return Promise.resolve(b == null ? new Response('', { status: 404 }) : new Response(b, { status: 200 })); },
    Response, Blob, TextDecoder, DecompressionStream, Uint8Array, Promise, Map, Set, console,
  };
  if (opts && opts.mo) w.MOScriptureDev = {};
  w.window = w; w.globalThis = w;
  const ctx = vm.createContext(w);
  vm.runInContext(src('commentary-pages.js'), ctx);
  vm.runInContext(src('commentary-pane.js'), ctx);
  return { w, classes, asked };
}
// the box a page hands fill(): it keeps what is drawn in it
function box() {
  const parts = { '.pw-pages': { innerHTML: '', scrollTop: 0 }, '.pw-span': { textContent: '' } };
  return { parts, html: '', classList: { add() {}, remove() {} }, set innerHTML(v) { this.html = v; }, get innerHTML() { return this.html; },
    querySelector: (s) => parts[s] || null, querySelectorAll: () => [], addEventListener() {} };
}

const tfr = page();
const T = tfr.w.FRCommentaryText;
ok(!!T && ['fill', 'page', 'paragraphs', 'stride', 'label'].every((k) => typeof T[k] === 'function'), 'The Faith Received, pane off: window.FRCommentaryText is there with fill, page, paragraphs, stride and label');
ok(!tfr.classes.has('cp-site-tfr'), 'pane off: the site\'s class (cp-site-tfr) is not set, so bible-notes.js keeps its own notes');
if (T) {
  const b = box();
  ok(await T.fill(b, { slug: 'eebo-77', page: 5 }) === true, 'fill: an EEBO book\'s page is drawn');
  ok(/The first note\./.test(b.parts['.pw-pages'].innerHTML) && /The page after\./.test(b.parts['.pw-pages'].innerHTML) && b.parts['.pw-span'].textContent === 'pp. 5–6',
    `fill: the page asked for and the next, labelled (got "${b.parts['.pw-span'].textContent}")`);
  ok(tfr.asked.every((u) => u.startsWith(`${BLOB}/`)) && !tfr.asked.some((u) => u.includes('//eebo')), 'fill: read from the page\'s own Blob base (window.__FR_BLOB_BASE__, its slash trimmed)');
  const g = box();
  ok(await T.fill(g, { slug: 'pg-9', page: 13 }) === true && /data-lane="src">Greek</.test(g.html), 'fill: a Greek Father\'s columns offer English, Greek and both');
  ok(/cols\. 13–14/.test(g.parts['.pw-pages'].innerHTML) && /The book of the generation/.test(g.parts['.pw-pages'].innerHTML), 'fill: Migne is labelled by its two columns');
  ok(await T.fill(box(), { slug: 'eebo-77', page: 99 }) === false, 'fill: a page that is not there says false, so the caller can link the reader instead');
  ok(T.stride('pg-9') === 2 && T.stride('eebo-77') === 1 && T.label('pg-9', 13) === 'col. 13' && T.label('eebo-77', 100005) === 'p. 5', 'stride and label: columns two at a time, a repeated page by its printed number');
}
const mo = page({ mo: true });
ok(mo.w.FRCommentaryText === undefined, 'Mere Orthodoxy: no page reader is given (its verse rail keeps its links to the reader)');

if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1); }
console.log('\ncommentary text: all checks passed');
