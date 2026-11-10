/*
 * The Scripture pane run as a browser runs it: the real commentary-pages.js, commentary-anchor.js and commentary-pane.js loaded into a
 * DOM (jsdom), a verse selected, and what the Commentary tab shows read back. The node checks beside it (check-commentary-pages.mjs)
 * call the loaders directly; none of them runs the pane's own code, which is where the 2026-10-19 live bug hid: every commentary
 * showed "This page could not be loaded." and the creeds "could not be loaded", the exceptions swallowed by catch-alls.
 *
 * Needs jsdom (not a dependency of the theme: `npm i --no-save jsdom`) and, to talk to the library, the network. Skips, and passes,
 * without either. Run: node scripts/check-commentary-browser.mjs
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let JSDOM;
try { ({ JSDOM } = createRequire(import.meta.url)('jsdom')); } catch (_) { console.log('skip  pane in a DOM: jsdom is not installed (npm i --no-save jsdom)'); process.exit(0); }
const SITE = 'https://mereorthodoxy.com';
const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36' };
try { await fetch(`${SITE}/assets/data/faith-received/confession-proofs/index.json`, { headers: UA }); } catch (_) { console.log('skip  pane in a DOM: the network is not reachable'); process.exit(0); }

let failed = 0;
const ok = (cond, msg) => { if (!cond) { failed += 1; console.error(`FAIL  ${msg}`); } else console.log(`ok    ${msg}`); };
const logged = [];

const dom = new JSDOM(`<!doctype html><html><head><meta name="tfr-library-base" content="https://mo-tfr-library.mo-podcast-feed.workers.dev"></head><body>
<main data-sd-reader><div class="sd-layout"><article class="sd-text" data-sd-text>
${Array.from({ length: 8 }, (_, i) => `<span class="bible-verse" data-v="${i + 1}" tabindex="0"><sup>${i + 1}</sup> Verse ${i + 1} text of Genesis one.</span>`).join(' ')}
</article><aside class="sd-side" data-sd-side></aside></div></main></body></html>`,
{ url: `${SITE}/the-faith-received/scripture/?ref=genesis.1.1`, runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
window.console = { log() {}, info() {}, warn() {}, error: (...a) => logged.push(a.map((x) => (x && x.stack) || String(x)).join(' ')) };
window.matchMedia = (q) => ({ matches: /min-width/.test(q), media: q, addEventListener() {}, removeEventListener() {} });
window.IntersectionObserver = class { observe() {} disconnect() {} unobserve() {} };
window.Element.prototype.scrollIntoView = function scrollIntoView() {};
for (const k of ['DecompressionStream', 'Response', 'Blob', 'TextDecoder', 'Uint8Array']) if (!window[k]) window[k] = globalThis[k];
// moDataUrl keys a file by theme version and hour, and the edge can hold an older shape of it for the hour: the stale index is served here
window.moDataUrl = (p) => `${p}?v=stale-key`;
window.fetch = (u, o) => {
  const href = new URL(u, `${SITE}/`).href;
  if (/confession-proofs\/index\.json\?v=stale-key/.test(href)) return Promise.resolve(new window.Response(JSON.stringify({ v: 1, docs: [], books: {} }), { status: 200 }));
  return fetch(href, { ...(o || {}), headers: { ...UA, ...((o && o.headers) || {}) } });
};
const book = { lib: 'genesis', slug: 'genesis', name: 'Genesis', chapters: 50 };
window.MOScriptureDev = {
  parseRef: (q) => { const m = /^genesis\.(\d+)(?:\.(\d+))?$/.exec(q); return m ? { book, c: +m[1], v: +(m[2] || 0) } : null; },
  legacyRef: () => null, centuryLabel: (c) => `${c}th c.`, emptyFilters: () => ({}), fetchCommentaries: async () => ({ items: [] }),
  sourceHref: (h) => h,
};
const run = (file) => window.eval(readFileSync(path.join(root, file), 'utf8'));
run('assets/js/page/commentary-pages.js'); run('assets/js/page/commentary-anchor.js'); run('assets/js/page/commentary-pane.js');

const until = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await new Promise((r) => setTimeout(r, 250)); } return false; };
const text = (sel) => ((window.document.querySelector(sel) || {}).textContent || '').trim();
const listed = await until(() => window.document.querySelectorAll('.cp-keys .cp-key').length > 1, 60000);
ok(listed, 'the pane builds and lists the key commentaries on Genesis 1');
window.document.querySelector('.bible-verse[data-v="1"]').click();
// (2026-11-08) "Its comment on Genesis 1:1 is on this page": a page the library files as holding the note, its heading not found (the survey)
const loaded = await until(() => /Its (note|comment|next note|closest earlier note)|No note on|This is where it opens/.test(text('.cp-where')) && !window.document.querySelector('.cp-body').classList.contains('cp-loading') && text('.cp-body').length > 200, 90000);
console.log(`      where: ${text('.cp-where')}`);
ok(loaded && !/could not be loaded|Opening the page|Looking for/.test(text('.cp-body')), `the Commentary tab shows the commentary's words for Genesis 1:1 (got: ${text('.cp-body').slice(0, 90)})`);
// the editors' critical apparatus of a scholarly edition is never set as the commentary: any such paragraph sits under the closed disclosure
const AN = window.FRCommentaryAnchor;
const loose = [...window.document.querySelectorAll('.cp-body p')].filter((el) => !el.closest('details.cp-app') && AN.isApparatus(el.textContent));
ok(loose.length === 0, `no apparatus paragraph is set as commentary (got: ${loose.slice(0, 2).map((el) => el.textContent.slice(0, 50)).join(' | ') || 'none'})`);
const creedsDone = await until(() => !window.document.querySelector('.cp-creeds [data-cp-creeds-loading], .cp-cr-loading'), 30000);
const cr = text('.cp-creeds') || text('.cp-cr');
ok(creedsDone && !/could not be loaded/.test(cr), `the creeds and confessions load for Genesis 1:1 (got: ${cr.slice(0, 90) || 'nothing'})`);
// a second commentary, by the same route the buttons use
const second = window.document.querySelectorAll('.cp-keys .cp-key')[1];
if (second) {
  second.click();
  const again = await until(() => !window.document.querySelector('.cp-body').classList.contains('cp-loading') && text('.cp-body').length > 200, 90000);
  ok(again && !/could not be loaded/.test(text('.cp-body')), `a second commentary (${second.textContent}) loads too`);
}
ok(logged.length === 0, `the pane logged no exception (got: ${logged.slice(0, 2).join(' | ').slice(0, 300) || 'none'})`);
window.close();
if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1); }
console.log('\ncommentary pane in a DOM: all checks passed');
process.exit(0);
