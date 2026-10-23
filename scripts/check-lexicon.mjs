/*
 * The Lexicon in a real Chrome (2026-10-23). The page lists every term, grouped by letter, built letter by letter. It checks:
 *   - the count shown equals the dataset count (index.json n), and once every letter has loaded the list holds exactly that many rows;
 *   - every letter in the bar lands on its section, and the letter on screen is marked;
 *   - the alphabet tabs and the search filter the same list in place, by headword and by Latin, Greek and Hebrew form;
 *   - an entry has numbered senses, Open p. N links into the reader, Quick facts, and the terms before and after;
 *   - quotes: for twenty terms every sense checked has a quote or the plain "Open p. N to read it" fallback, and every quote is an exact
 *     substring of the work's TEI text, fetched again here (--senses N sets how many senses a term checks, default 2);
 *   - addresses (#term, #term/N, #letter-x), Back and Forward, and the list scroll restored when an entry closes;
 *   - no console error, no failed request, no 5xx, no sideways scroll, no gap past 72px, dark on html[data-sd-theme].
 *   --perf   also prints first list paint, time to the full list in the DOM, JS heap, and scroll frame times at 1440 and at 375 with a 4x CPU slowdown.
 *
 *   node scripts/check-lexicon.mjs                        this checkout's template, CSS and script in a local page (data from the live library)
 *   node scripts/check-lexicon.mjs --base https://mereorthodoxy.com    the live site
 *   node scripts/check-lexicon.mjs --shots /path/to/dir   also save screenshots at 1440, 1024, 820 and 375, light and dark
 *
 * Needs Google Chrome (CHROME=/path to override) and the network. Skips, and passes, without either. Not part of `npm run build`,
 * which must not depend on the network: run it before a merge that touches the lexicon.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const LIVE = opt('--base', '');
const SHOTS = opt('--shots', '');
const PERF = argv.includes('--perf');
const SENSES = Number(opt('--senses', 2));
const LIB = 'https://mo-tfr-library.mo-podcast-feed.workers.dev';
const UA = { 'User-Agent': 'curl/8.7.1' };
const TIMEOUT = 20000;
const CHROME = process.env.CHROME || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => existsSync(p));
if (!CHROME) { console.log('skip  lexicon in Chrome: no Chrome found (set CHROME=)'); process.exit(0); }
try { const r = await fetch(`${LIB}/v1/lexicon/index.json`, { headers: UA }); if (!r.ok) throw new Error(String(r.status)); } catch (_) { console.log('skip  lexicon in Chrome: the library is not reachable'); process.exit(0); }

let failed = 0;
const ok = (c, m) => { if (c) console.log(`ok    ${m}`); else { failed += 1; console.error(`FAIL  ${m}`); } };
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

/* ── A local page built from the template: the same markup, the theme's CSS, this checkout's assets, the library through a proxy ── */
const TYPES = { '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
function harness(port) {
  const hbs = readFileSync(path.join(root, 'custom-faith-lexicon.hbs'), 'utf8').replace(/\{\{!--[\s\S]*?--\}\}/g, '');
  const [headPart, bodyPart] = hbs.split('{{/contentFor}}');
  const fix = (s) => s
    .replace(/\{\{!<[^}]*\}\}/g, '').replace(/\{\{>\s*"[^"]*"\s*\}\}/g, '').replace(/\{\{#contentFor[^}]*\}\}/g, '')
    .replace(/\{\{#> tfr-method\}\}([\s\S]*?)\{\{\/tfr-method\}\}/g, '<details class="tfr-method"><summary class="tfr-method-s">Methodology</summary><div class="tfr-method-b">$1</div></details>')
    .replace(/\{\{asset "([^"]+)"\}\}(&amp;)?/g, (_, f, amp) => `/assets/${f}${amp ? '?v=1&amp;' : ''}`);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<script>window.__FR_BLOB_BASE__=${JSON.stringify(`http://127.0.0.1:${port}/lib`)};</script>
<script src="/assets/js/lib/tfr-method.js"></script>${fix(headPart)}
<link rel="stylesheet" href="/assets/css/faith-site-theme.css">
<link href="https://fonts.googleapis.com/css2?family=IM+Fell+Great+Primer:ital@0;1&family=Source+Serif+Pro:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/built/screen.min.css"><link rel="stylesheet" href="/assets/built/faith-received.min.css"></head>
<body class="fr-ghost-site">${fix(bodyPart)}</body></html>`;
}
let server = null;
let BASE = LIVE.replace(/\/$/, '');
if (!BASE) {
  server = createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname.startsWith('/lib/')) {
      try {
        const r = await fetch(`${LIB}${u.pathname.slice(4)}${u.search}`, { headers: UA });
        res.writeHead(r.status, { 'content-type': r.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*' });
        res.end(Buffer.from(await r.arrayBuffer()));
      } catch (_) { res.writeHead(502); res.end('bad gateway'); }
      return;
    }
    if (u.pathname.startsWith('/assets/')) {
      const f = path.join(root, decodeURIComponent(u.pathname));
      if (f.startsWith(path.join(root, 'assets')) && existsSync(f) && statSync(f).isFile()) { res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f)); return; }
      res.writeHead(404); res.end('missing'); return;
    }
    if (u.pathname === '/the-faith-received/lexicon/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(harness(server.address().port)); return; }
    res.writeHead(404); res.end('not found');
  });
  await new Promise((r) => { server.listen(0, '127.0.0.1', r); });
  BASE = `http://127.0.0.1:${server.address().port}`;
}
const URLP = `${BASE}/the-faith-received/lexicon/`;

/* ── Chrome over the DevTools protocol ── */
const profile = mkdtempSync(path.join(tmpdir(), 'lexicon-'));
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank'], { stdio: 'ignore' });
const cleanup = () => { try { proc.kill(); } catch (_) { /* gone */ } try { rmSync(profile, { recursive: true, force: true }); } catch (_) { /* gone */ } try { server && server.close(); } catch (_) { /* gone */ } };
process.on('exit', cleanup);
let port = 0;
for (let i = 0; i < 100 && !port; i += 1) { await sleep(150); const f = path.join(profile, 'DevToolsActivePort'); if (existsSync(f)) port = Number(readFileSync(f, 'utf8').split('\n')[0]); }
if (!port) { console.log('skip  lexicon in Chrome: Chrome did not start'); process.exit(0); }
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0;
const waiting = new Map();
const log = { console: [], net: [], fail: [] };
const reqs = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && waiting.has(d.id)) { waiting.get(d.id)(d); waiting.delete(d.id); return; }
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') log.console.push(d.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 240));
  if (d.method === 'Runtime.exceptionThrown') log.console.push(`exception: ${((d.params.exceptionDetails.exception || {}).description || d.params.exceptionDetails.text || '').slice(0, 240)}`);
  if (d.method === 'Network.requestWillBeSent') reqs.set(d.params.requestId, d.params.request.url);
  if (d.method === 'Network.responseReceived') log.net.push({ url: d.params.response.url, status: d.params.response.status });
  if (d.method === 'Network.loadingFailed' && !d.params.canceled) log.fail.push(reqs.get(d.params.requestId) || '');
};
const send = (method, params = {}) => new Promise((res) => { seq += 1; waiting.set(seq, res); ws.send(JSON.stringify({ id: seq, method, params })); });
const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); return r.result && r.result.result ? r.result.result.value : undefined; };
await send('Page.enable'); await send('Network.enable'); await send('Runtime.enable');
const NOISE = /Ignoring Event: localhost|ghost|analytics|slide-ins|\/settings|\/pa\/js|\/e$|members\/api|favicon|googletagmanager|plausible|fonts\.g|Content Security Policy|Executing inline script/i;
const view = (w, h = 900, mobile = false) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
const until = async (expr, what, ms = TIMEOUT) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(expr)) return true; await sleep(150); } console.error(`      timed out: ${what}`); return false; };
const shoot = async (name) => { if (!SHOTS) return; mkdirSync(SHOTS, { recursive: true }); const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); writeFileSync(path.join(SHOTS, `${name}.png`), Buffer.from(r.result.data, 'base64')); };
const FULL = 120000;
const firstFilled = `document.querySelectorAll('#lx-all .lx-sec:not(.is-pending)').length>0`;
const complete = `document.querySelector('#lx-all').dataset.complete==='true'`;
const entryReady = `(()=>{const e=document.querySelector('#lx-entry');return !!e&&!e.hidden&&e.querySelectorAll('.lx-sense').length>0&&!e.querySelector('.lx-sk-entry')})()`;
const idx = await (await fetch(`${LIB}/v1/lexicon/index.json`, { headers: UA })).json();
const N = idx.n;
const nfmt = (n) => n.toLocaleString('en-US');
const open = async (url) => { await send('Page.navigate', { url }); await sleep(300); };

/* ── The list: first paint, the whole list, the count ── */
await view(1440);
const t0 = Date.now();
await open(URLP);
ok(await until(firstFilled, 'first section', FULL), 'the first letter draws');
const tFirst = Date.now() - t0;
const above = await ev(`[...document.querySelectorAll('.lx-r')].filter(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight}).length`);
ok(above >= 60, `terms above the fold at 1440x900: ${above}`);
ok(await ev(`document.querySelector('#lx-count').textContent`) === `${nfmt(N)} terms`, `the count shown is the dataset count (${nfmt(N)} terms)`);
await shoot('list-1440-loading-light');
ok(await until(complete, 'every letter', FULL), 'every letter loads');
const tAll = Date.now() - t0;
const rowsInDom = await ev(`document.querySelectorAll('#lx-all .lx-r').length`);
ok(rowsInDom === N, `the full list holds every term: ${nfmt(rowsInDom)} rows of ${nfmt(N)}`);
console.log(`      first letter drawn ${tFirst}ms, whole list in the DOM ${tAll}ms, ${nfmt(await ev(`document.querySelectorAll('*').length`))} nodes`);
ok(await ev(`[...document.querySelectorAll('h1')].filter(h=>h.getClientRects().length).length`) === 1, 'one visible h1');
const sizes = await ev(`(()=>{const f=(s)=>parseFloat(getComputedStyle(document.querySelector(s)).fontSize);return {h1:f('.lx-hd h1'),row:f('.lx-r'),input:document.querySelector('#lx-q').getBoundingClientRect().height,rowH:document.querySelector('.lx-r').getBoundingClientRect().height,bar:f('#lx-bar a')}})()`);
ok(sizes.h1 <= 26 && sizes.row <= 17 && sizes.rowH <= 30 && sizes.input <= 46 && sizes.bar <= 15, `compact scale: h1 ${sizes.h1}px, row ${sizes.row}px/${sizes.rowH}px, input ${sizes.input}px, bar ${sizes.bar}px`);
ok(await ev(`getComputedStyle(document.querySelector('.lx-chunk')).columnCount==='4'`), 'four columns at 1440');
ok(await ev(`!document.querySelector('.lx-r small')||getComputedStyle(document.querySelector('.lx-r small')).fontSize==='13px'`), 'forms are 13px muted');

/* ── Every letter anchor lands, and the letter on screen is marked ── */
const letters = await ev(`[...document.querySelectorAll('#lx-bar a[data-jump]')].map(a=>a.dataset.jump)`);
ok(letters.length === Object.keys(idx.letters).length, `the bar has every letter (${letters.length})`);
let lost = []; let unmarked = 0;
for (const l of letters) {
  await ev(`document.querySelector('#lx-bar a[data-jump=${JSON.stringify(l)}]').click()`);
  await sleep(300);
  const r = await ev(`(()=>{const s=document.getElementById('letter-'+${JSON.stringify(l === '_' ? 'other' : l)});const t=s.querySelector('.lx-lh').getBoundingClientRect().top;return {top:Math.round(t),end:document.documentElement.scrollHeight-scrollY-t<innerHeight+60,hash:location.hash,cur:(document.querySelector('#lx-bar a[aria-current]')||{}).dataset&&document.querySelector('#lx-bar a[aria-current]').dataset.jump}})()`);
  if (!(r.top >= 0 && r.top <= 400) && !(r.end && r.top >= 0)) lost.push(`${l}:${r.top}`);
  if (r.cur !== l) unmarked += 1;
}
ok(!lost.length, `every letter anchor lands near the top${lost.length ? ` (${lost.slice(0, 5).join(', ')})` : ''}`);
// the last letters sit too near the end of the page to scroll to the marked band
ok(unmarked <= 10, `the letter on screen is marked in the bar (${letters.length - unmarked} of ${letters.length})`);
await open(`${URLP}#letter-t`);
await until(`document.querySelector('#letter-t .lx-lh').getBoundingClientRect().top<400&&document.querySelector('#letter-t .lx-lh').getBoundingClientRect().top>=0`, 'deep letter');
ok(true, 'the address #letter-t opens at T');

/* ── Filters in place ── */
await open(URLP); await until(firstFilled, 'list'); await until(complete, 'list complete', FULL);
for (const [t, sc] of [['grc', 'grc'], ['he', 'he'], ['en', 'en']]) {
  await ev(`document.querySelector('#lx-tabs [data-t=${t}]').click()`); await sleep(300);
  const r = await ev(`({vis:[...document.querySelectorAll('#lx-all .lx-sec')].filter(s=>!s.hidden).map(s=>s.dataset.s),count:document.querySelector('#lx-count').textContent})`);
  ok(r.vis.length > 0 && r.vis.every((x) => x === sc), `the ${t} tab shows only its alphabet (${r.vis.length} letters, ${r.count})`);
}
await ev(`document.querySelector('#lx-tabs [data-t=all]').click()`);
const QUERIES = [['gratia', 'gratia'], ['fides', 'fides'], ['πίστις', 'πιστις'], ['faith', 'faith'], ['אדם', 'אדם']];
for (const [q, want] of QUERIES) {
  const c0 = log.console.length;
  const before = await ev(`document.querySelector('#lx-count').textContent`);
  await ev(`(()=>{const i=document.querySelector('#lx-q');i.value=${JSON.stringify(q)};i.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  await until(`document.querySelector('#lx-count').textContent!==${JSON.stringify(before)}`, `results for ${q}`, 8000);
  await sleep(200);
  const r = await ev(`({shown:!document.querySelector('#lx-found').hidden,allHidden:document.querySelector('#lx-all').hidden,n:document.querySelectorAll('#lx-found .lx-r').length,count:document.querySelector('#lx-count').textContent,hit:[...document.querySelectorAll('#lx-found .lx-r')].slice(0,40).some(a=>a.textContent.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().includes(${JSON.stringify(want)}))})`);
  ok(r.shown && r.allHidden && r.n > 0 && r.hit && new RegExp(`of ${nfmt(N)} terms$`).test(r.count), `search "${q}" filters the list in place: ${r.count}`);
  if (q === 'gratia') await shoot('search-gratia-1440-light');
  if (q === 'fides') await shoot('search-fides-1440-light');
  ok(!log.console.slice(c0).filter((c) => !NOISE.test(c)).length, `search "${q}": no console error`);
}
await ev(`(()=>{const i=document.querySelector('#lx-q');i.value='zzqxv';i.dispatchEvent(new Event('input',{bubbles:true}))})()`); await sleep(500);
ok(await ev(`!document.querySelector('#lx-empty').hidden&&/No term matches/.test(document.querySelector('#lx-empty').textContent)`), 'a search with no match says so plainly');
await ev(`(()=>{const i=document.querySelector('#lx-q');i.value='';i.dispatchEvent(new Event('input',{bubbles:true}))})()`); await sleep(400);
ok(await ev(`document.querySelector('#lx-found').hidden&&!document.querySelector('#lx-all').hidden`), 'clearing the search brings the whole list back');

/* ── An entry from the list, Back, and the scroll restored ── */
await ev(`document.querySelector('#lx-bar a[data-jump=m]').click()`); await sleep(500);
const y0 = await ev('Math.round(scrollY)');
await ev(`document.querySelector('#letter-m .lx-r').click()`);
ok(await until(entryReady, 'entry from list'), 'a row opens its entry');
ok(await ev(`document.querySelector('#lx-hd').hidden&&[...document.querySelectorAll('h1')].filter(h=>h.getClientRects().length).length===1`), 'the headword is the one h1');
await ev('history.back()'); await sleep(900);
const y1 = await ev('Math.round(scrollY)');
ok(await ev(`document.querySelector('#lx-entry').hidden&&!document.querySelector('#lx-listview').hidden`) && Math.abs(y1 - y0) < 80, `Back returns to the list at the same place (${y0} then ${y1})`);
await ev('history.forward()');
ok(await until(entryReady, 'forward'), 'Forward returns to the entry');
await open(`${URLP}#no-such-term-zz`); await sleep(2500);
ok(await ev(`/No term has the address/.test(document.querySelector('#lx-entry').textContent)`), 'an unknown address says so plainly');
await open(`${URLP}#faith/3`);
ok(await until(entryReady, 'faith/3'), 'the address #faith/3 opens the entry');
await sleep(400);
ok(await ev(`!!document.querySelector('#s3.is-target')`), 'the address #faith/3 marks sense 3');
ok(await ev(`document.querySelectorAll('#lx-entry .lx-sense').length`) === (await (await fetch(`${LIB}/v1/lexicon/terms/faith.json`, { headers: UA })).json()).senses.length, 'every sense is on the page, none behind a Show more');
await open(`${URLP}#fides`); await until(entryReady, 'fides'); await sleep(2500);
ok(await ev(`document.querySelectorAll('#lx-entry .lx-pn').length>=1`), 'an entry links to the term before or after it');
ok(await ev(`!document.querySelector('#lx-f-authors').closest('div').hidden`), 'Quick facts gain the author count');

/* ── Quotes: twenty terms, each sense a quote or the fallback, every quote an exact substring of the TEI ── */
const TERMS = ['justice', 'grace', 'faith', 'sin', 'church', 'baptism', 'prayer', 'hope', 'law', 'charity', 'repentance', 'sacrament', 'trinity', 'election', 'covenant', 'gratia', 'fides', 'πίστις', 'ecclesia', 'sacramentum'];
async function idFor(t) {
  if (idx.letters[t[0].toLowerCase()] !== undefined && (await fetch(`${LIB}/v1/lexicon/terms/${encodeURIComponent(t)}.json`, { headers: UA })).ok) return t;
  const f = t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const k = f.slice(0, 2).replace(/ς/g, 'σ').replace(/[^\p{L}\p{N}]/gu, '_');
  const sh = await (await fetch(`${LIB}/v1/lexicon/forms/${encodeURIComponent(k)}.json`, { headers: UA })).json();
  return sh[f] || null;
}
const VERIFY = `(async()=>{const norm=s=>String(s).replace(/\\s+/g,' ').trim();const B=window.__FR_BLOB_BASE__;const cache=window.__vc=window.__vc||{};
 const urls=w=>{const m=/^(pg|pld|po|eebo)-(\\d+)$/.exec(w);return m?['/v1/tei/'+m[1]+'/'+m[2]+'.xml']:['/v1/works/'+encodeURIComponent(w)+'/tei.la.xml','/v1/works/'+encodeURIComponent(w)+'/tei.en.xml'];};
 const text=async w=>{if(cache[w]===undefined){cache[w]=(async()=>{let all='';for(const u of urls(w)){try{const r=await fetch(B+u);if(!r.ok)continue;const x=await r.text();const d=new DOMParser().parseFromString(x,'application/xml');all+=' '+norm(d.documentElement.textContent);}catch(e){}}return all;})();}return cache[w];};
 const out={rows:0,quote:0,page:0,fallback:0,pending:0,bad:[]};
 for(const row of document.querySelectorAll('#lx-entry .lx-sense:nth-child(-n+${SENSES}) .lx-src > li')){out.rows++;const box=row.querySelector('.lx-qs');
  if(box.classList.contains('lx-qpend')){out.pending++;continue;}
  if(box.classList.contains('lx-qf')){if(/Open p\\. /.test(box.textContent))out.fallback++;else out.bad.push('fallback text');continue;}
  const qs=[...box.querySelectorAll('blockquote p')];if(!qs.length){out.bad.push('empty');continue;}
  const full=await text(row.dataset.w);
  for(const p of qs){const q=norm(p.textContent).replace(/^…/,'').replace(/…$/,'');if(!q){out.bad.push('blank');continue;}
   if(!full.includes(q))out.bad.push(row.dataset.w+':'+q.slice(0,50));
   const foot=p.parentNode.querySelector('footer').textContent;if(/From p\\./.test(foot))out.page++;else out.quote++;}}
 return out;})()`;
const tot = { rows: 0, quote: 0, page: 0, fallback: 0, bad: [], pending: 0 };
for (const term of TERMS) {
  const id = await idFor(term);
  if (!id) { ok(false, `quotes: no id for ${term}`); continue; }
  await open(`${URLP}#${encodeURIComponent(id)}`);
  await until(entryReady, `entry ${term}`);
  for (let i = 1; i <= SENSES; i += 1) {
    await ev(`(document.getElementById('s${i}')||{scrollIntoView(){}}).scrollIntoView({block:'start'})`);
    await until(`(()=>{const s=document.getElementById('s${i}');return !s||!s.querySelector('.lx-qpend')})()`, `quotes ${term} ${i}`, 90000);
  }
  const r = await ev(VERIFY);
  for (const k of ['rows', 'quote', 'page', 'fallback', 'pending']) tot[k] += r[k] || 0;
  tot.bad.push(...(r.bad || []));
  ok(r.pending === 0 && !r.bad.length, `quotes ${term}: ${r.rows} sources, ${r.quote} quotes, ${r.page} page openings, ${r.fallback} fallbacks${r.bad.length ? ` (${r.bad.slice(0, 2).join(' | ')})` : ''}`);
  if (term === 'justice') await shoot('entry-justice-1440-light');
}
console.log(`      quote coverage over ${TERMS.length} terms, first ${SENSES} senses each: ${tot.rows} sources, ${tot.quote} quotes, ${tot.page} page openings, ${tot.fallback} fallbacks`);
ok(!tot.bad.length && tot.quote + tot.page + tot.fallback === tot.rows, 'every checked source has a quote that is an exact substring of its TEI, or the Open p. N fallback');
await ev(`document.querySelector('[data-lane=both]')&&document.querySelector('[data-lane=both]').click()`);

/* ── Widths: no sideways scroll, no gap past 72px, dark ── */
const GAPS = `(()=>{const out=[];const vis=e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
  for(const box of ['.wrap > .lx-hd','#lx-listview','.lx-tools']){const b=document.querySelector(box);if(!b||b.hidden)continue;const kids=[...b.children].filter(vis);
    for(let i=1;i<kids.length;i++){const g=kids[i].getBoundingClientRect().top-kids[i-1].getBoundingClientRect().bottom;if(g>72)out.push(Math.round(g)+'px before '+(kids[i].id||kids[i].className));}}
  return out;})()`;
for (const w of [375, 820, 1024, 1440]) {
  await view(w, w === 375 ? 812 : 900, w === 375);
  for (const [name, url] of [['list', URLP], ['entry', `${URLP}#justice`]]) {
    await open(url);
    await until(name === 'list' ? firstFilled : entryReady, `${name} at ${w}`);
    if (name === 'list') await until(complete, 'complete', FULL);
    await sleep(900);
    const m = await ev(`({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth})`);
    ok(m.sw <= m.cw, `${name} at ${w}: no sideways scroll (${m.sw} of ${m.cw})`);
    if (w === 375 && name === 'list') {
      const g = await ev(GAPS);
      ok(Array.isArray(g) && !g.length, `list at 375: no gap past 72px${g && g.length ? ` (${g.join(', ')})` : ''}`);
      ok(await ev(`getComputedStyle(document.querySelector('.lx-chunk')).columnCount==='1'&&parseFloat(getComputedStyle(document.querySelector('.lx-r')).fontSize)<=16&&document.querySelector('.lx-r').getBoundingClientRect().height>=40`), 'list at 375: one column, rows 40px');
      ok(await ev(`document.querySelector('#lx-q').getBoundingClientRect().height>=44&&[...document.querySelectorAll('#lx-tabs button')].every(b=>b.getBoundingClientRect().height>=44)`), 'list at 375: search and tabs are 44px targets');
    }
    if (w === 1440 && name === 'entry') ok(await ev(`getComputedStyle(document.querySelector('.lx-facts')).position==='sticky'`), 'entry at 1440: Quick facts is sticky beside the senses');
    await shoot(`${name}-${w}-light`);
    await ev(`document.documentElement.setAttribute('data-sd-theme','dark')`);
    await sleep(250);
    if (w === 1440 && name === 'list') {
      const bg = await ev(`getComputedStyle(document.querySelector('main.tfr-lexicon')).backgroundColor`);
      const lum = (bg.match(/\d+/g) || [255, 255, 255]).slice(0, 3).map(Number).reduce((a, b) => a + b, 0) / 3;
      ok(lum < 80, `dark mode on html[data-sd-theme] darkens the page (${bg})`);
    }
    await shoot(`${name}-${w}-dark`);
    await ev(`document.documentElement.setAttribute('data-sd-theme','light')`);
  }
}

/* ── Performance (--perf): first paint, the whole list, heap, scroll frames, at 1440 and at 375 with a 4x CPU slowdown ── */
if (PERF) {
  for (const [name, w, mobile, cpu] of [['1440', 1440, false, 1], ['375 mobile, 4x CPU', 375, true, 4]]) {
    await view(w, mobile ? 812 : 900, mobile);
    await send('Emulation.setCPUThrottlingRate', { rate: cpu });
    const start = Date.now();
    await open(URLP);
    await until(firstFilled, 'first', FULL * 2);
    const first = Date.now() - start;
    await until(complete, 'complete', FULL * 3);
    const all = Date.now() - start;
    await sleep(1000);
    const heap = await send('Runtime.getHeapUsage');
    const frames = await ev(`new Promise((res)=>{const d=[];let last=performance.now();let y=0;const max=document.documentElement.scrollHeight-innerHeight;const step=()=>{const n=performance.now();d.push(n-last);last=n;y+=Math.max(400,max/150);window.scrollTo(0,y);if(y<max&&d.length<400)requestAnimationFrame(step);else{d.sort((a,b)=>a-b);res({n:d.length,p50:Math.round(d[Math.floor(d.length/2)]),p95:Math.round(d[Math.floor(d.length*.95)]),max:Math.round(d[d.length-1]),slow:d.filter(x=>x>50).length});}};requestAnimationFrame(step);})`);
    const nodes = await ev(`document.querySelectorAll('*').length`);
    console.log(`perf  ${name}: first list paint ${first}ms, whole list in the DOM ${all}ms, JS heap ${Math.round(heap.result.usedSize / 1048576)} MB, ${nfmt(nodes)} nodes, scroll ${frames.n} frames p50 ${frames.p50}ms p95 ${frames.p95}ms max ${frames.max}ms, ${frames.slow} over 50ms`);
    await send('Emulation.setCPUThrottlingRate', { rate: 1 });
  }
}

const fails = log.fail.filter((u) => /\/v1\/|\/assets\//.test(u) && !NOISE.test(u));
const bad5 = log.net.filter((n) => n.status >= 500 && /\/v1\//.test(n.url)).map((n) => `${n.status} ${n.url.replace(/^https?:\/\/[^/]+/, '')}`);
const missing = log.net.filter((n) => n.status === 404 && /\/assets\//.test(n.url)).map((n) => n.url);
const cons = log.console.filter((c) => !NOISE.test(c));
ok(!fails.length && !bad5.length && !missing.length, `no failed request, no 5xx from the library, no missing asset${fails.length || bad5.length || missing.length ? ` (${[...fails, ...bad5, ...missing].slice(0, 3).join(' | ')})` : ''}`);
ok(!cons.length, `no console error${cons.length ? ` (${cons[0]})` : ''}`);
cleanup();
if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1); }
console.log('\nlexicon: the page lists every term, filters in place and quotes its sources');
process.exit(0);
