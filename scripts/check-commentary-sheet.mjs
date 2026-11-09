/*
 * The Scripture pane's seven recommendations (2026-11-08, owner: "run the reccomendations"), checked as the code states them and, where
 * jsdom and the network are there, as the pane runs.
 *
 * 1. THE PHONE'S SHEET (commentary-pane.css). The sheet is one height and moves between its stops by transform alone: no rule animates
 *    its height (a layout property), the stops are named (data-sheet peek, half, full) and set what shows (--cp-shown), a drag turns the
 *    transition off (.cp-dragging), and the slide is only for a reader who has not asked for reduced motion.
 * 2. THE ADDRESS AND BACK, AND THE CREEDS (commentary-pane.js in a DOM, as check-commentary-browser.mjs runs it): the commentary the pane
 *    opens goes in the address (cp=); a verse picked and a commentary picked each add one history entry naming both; Back puts back the
 *    commentary of the entry gone back to; the creeds are one row under the commentary, shut until the reader opens it.
 *
 * Part 2 needs jsdom (not a dependency of the theme: `npm i --no-save jsdom`) and the network; without them it says so and passes.
 * Run: node scripts/check-commentary-sheet.mjs
 */
/* global console, process, fetch, URL, URLSearchParams, setTimeout */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
const ok = (cond, msg) => { if (!cond) { failed += 1; console.error(`FAIL  ${msg}`); } else console.log(`ok    ${msg}`); };

// ── 1. the sheet's rules ──
const css = readFileSync(path.join(root, 'assets/css/commentary-pane.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const rules = [];
// every rule with the group it sits in (@media, @container: one level, as this file has them)
for (let i = 0, media = '', depth = 0, start = 0; i < css.length; i += 1) {
  if (css[i] === '{') {
    const head = css.slice(start, i).trim();
    if (/^@(media|container|supports)/.test(head)) { media = head; depth = 1; start = i + 1; continue; }
    const end = css.indexOf('}', i);
    rules.push({ media: depth ? media : '', sel: head, body: css.slice(i + 1, end) });
    i = end; start = i + 1;
  } else if (css[i] === '}' && depth) { depth = 0; media = ''; start = i + 1; }
}
// the rules whose subject is the pane itself (".cp-pane", "html.cp-site-mo .cp-pane", ".cp-pane[data-tab=\"s\"]", ".cp-pane.cp-dragging")
const paneRules = rules.filter((r) => r.sel.split(',').some((x) => /\.cp-pane(?:[.[][^\s>+~]*)?$/.test(x.trim())));
ok(rules.length > 100, `the stylesheet is read (${rules.length} rules)`);
const heightMoves = paneRules.filter((r) => /transition[^;]*\bheight\b/.test(r.body) || /transition-property:[^;]*\bheight\b/.test(r.body));
ok(!heightMoves.length, `no rule animates the pane's height (got: ${heightMoves.map((r) => r.sel).join(' | ') || 'none'})`);
const phone = paneRules.filter((r) => /max-width:\s*899px/.test(r.media));
const sheet = phone.find((r) => /^\.cp-pane$/.test(r.sel) && /transform:\s*translateY\(/.test(r.body));
ok(!!sheet && /--cp-shown/.test(sheet.body) && /height:\s*var\(--cp-full\)/.test(sheet.body), 'under 900px the pane is one height (--cp-full) moved by translateY to what shows (--cp-shown)');
ok(phone.some((r) => /\[data-sheet="peek"\]/.test(r.sel) && /--cp-shown:\s*var\(--cp-peek\)/.test(r.body))
  && phone.some((r) => /\[data-sheet="full"\]/.test(r.sel) && /--cp-shown:\s*var\(--cp-full\)/.test(r.body)), 'the stops are named: data-sheet="peek" and "full" (half is where it opens)');
ok(rules.some((r) => /\.cp-pane\.cp-dragging/.test(r.sel) && /transition:\s*none/.test(r.body)), 'a drag moves the sheet under the finger with no transition (.cp-dragging)');
const slide = rules.find((r) => /^\.cp-pane$/.test(r.sel) && /transition:\s*transform/.test(r.body));
ok(!!slide && /prefers-reduced-motion:\s*no-preference/.test(slide.media), 'the slide between stops is transform only, and only without reduced motion');
ok(rules.some((r) => /\.cp-pane\s*>\s*\.cp-stop\[data-stop="peek"\]/.test(r.sel)), 'each stop has its measure for the script (.cp-stop)');
ok(rules.some((r) => /html\.cp-site-mo body\.cp-on \.fr-survey-bar/.test(r.sel) && /display:\s*none/.test(r.body)), 'Mere Orthodoxy\'s floating feedback tab is put away while the pane is on');

// ── 2. the pane in a DOM ──
let JSDOM;
try { ({ JSDOM } = createRequire(import.meta.url)('jsdom')); } catch { JSDOM = null; }
const SITE = 'https://mereorthodoxy.com';
const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36' };
let net = !!JSDOM;
if (net) { try { await fetch(`${SITE}/assets/data/faith-received/confession-proofs/index.json`, { headers: UA }); } catch { net = false; } }
if (!JSDOM) console.log('skip  the pane in a DOM: jsdom is not installed (npm i --no-save jsdom)');
else if (!net) console.log('skip  the pane in a DOM: the network is not reachable');
else {
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
  window.scrollTo = () => {};
  for (const k of ['DecompressionStream', 'Response', 'Blob', 'TextDecoder', 'Uint8Array']) if (!window[k]) window[k] = globalThis[k];
  window.fetch = (u, o) => fetch(new URL(u, `${SITE}/`).href, { ...(o || {}), headers: { ...UA, ...((o && o.headers) || {}) } });
  const book = { lib: 'genesis', slug: 'genesis', name: 'Genesis', chapters: 50 };
  window.MOScriptureDev = {
    parseRef: (q) => { const m = /^genesis\.(\d+)(?:\.(\d+))?$/.exec(q); return m ? { book, c: +m[1], v: +(m[2] || 0) } : null; },
    legacyRef: () => null, centuryLabel: (c) => `${c}th c.`, emptyFilters: () => ({}), fetchCommentaries: async () => ({ items: [] }),
    sourceHref: (h) => h,
  };
  const run = (file) => window.eval(readFileSync(path.join(root, file), 'utf8'));
  run('assets/js/page/commentary-pages.js'); run('assets/js/page/commentary-anchor.js'); run('assets/js/page/commentary-pane.js');
  const until = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await new Promise((r) => setTimeout(r, 250)); } return false; };
  const text = (sel) => ((window.document.querySelector(sel) || {}).textContent || '').replace(/\s+/g, ' ').trim();
  const drawn = () => !!window.document.querySelector('.cp-body') && !window.document.querySelector('.cp-body').classList.contains('cp-loading') && text('.cp-body').length > 200;
  const q = () => new URLSearchParams(window.location.search);
  ok(await until(() => window.document.querySelectorAll('.cp-keys .cp-key').length > 1 && drawn() && q().get('cp'), 90000), `the commentary the pane opens is in the address (got: ${window.location.search})`);
  const first = q().get('cp'), h0 = window.history.length;
  // a verse picked
  window.document.querySelector('.bible-verse[data-v="3"]').click();
  ok(await until(() => /Genesis 1:3/.test(text('.cp-where')) && drawn(), 90000), `a verse picked: the pane is on it (got: ${text('.cp-where').slice(0, 80)})`);
  ok(q().get('ref') === 'genesis.1.3' && q().get('cp') === first && window.history.length === h0 + 1, `a verse picked: one entry added, naming the verse and the commentary (got: ${window.location.search}, ${window.history.length - h0} added)`);
  // a commentary picked
  const second = [...window.document.querySelectorAll('.cp-keys .cp-key')].find((b) => b.dataset.slug !== first);
  if (second) {
    second.click();
    ok(await until(() => q().get('cp') === second.dataset.slug && drawn(), 90000) && window.history.length === h0 + 2, `a commentary picked: one more entry, naming it (got: ${window.location.search})`);
    const name = text('.cp-what');
    window.history.back();
    ok(await until(() => q().get('cp') === first && text('.cp-what') !== name && drawn(), 90000), `Back: the commentary of the entry gone back to (got: ${q().get('cp')}, ${text('.cp-what').slice(0, 60)})`);
    ok(/Genesis 1:3/.test(text('.cp-where')), `Back: the same verse (got: ${text('.cp-where').slice(0, 80)})`);
  }
  // the creeds' row: under the commentary, shut, opened in place, kept
  const box = window.document.querySelector('.cp-creeds'), body = window.document.querySelector('.cp-body');
  ok(await until(() => box && !box.hidden, 30000) && !!(body.compareDocumentPosition(box) & window.Node.DOCUMENT_POSITION_FOLLOWING), 'the creeds come after the commentary');
  const row = box.querySelector('.cp-cr-row');
  ok(row.getAttribute('aria-expanded') === 'false' && box.querySelector('.cp-cr-in').hidden && /^Creeds, confessions and catechisms \(\d+\)$/.test(row.textContent.replace(/\s+/g, ' ').trim()), `the creeds are one counted row, shut (got: ${row.textContent.replace(/\s+/g, ' ').trim()})`);
  row.click();
  ok(row.getAttribute('aria-expanded') === 'true' && !box.querySelector('.cp-cr-in').hidden && window.localStorage.getItem('fr_cp_creeds') === '1', 'chosen, the row opens in place, and open is kept');
  ok(logged.length === 0, `the pane logged no exception (got: ${logged.slice(0, 2).join(' | ').slice(0, 300) || 'none'})`);
  window.close();
}
if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1); }
console.log('\ncommentary sheet, address and creeds: all checks passed');
process.exit(0);
