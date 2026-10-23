/*
 * The Lexicon in a real Chrome (2026-10-23). It loads the front page (the alphabet and the most defined terms), searches five terms (Latin gratia and fides, Greek πίστις, English faith,
 * Hebrew אדם), opens an entry for each, and checks what a reader sees:
 *   - the list and the entry fill with real content, and an entry has Quick facts, a sticky sidebar, and the terms before and after it (no skeleton left, no "did not load");
 *   - an entry has numbered senses, each with a defining page, and every "Open" link points into the reader;
 *   - Latin, Greek and Hebrew carry lang attributes, and a Hebrew headword reads right to left (dir="auto");
 *   - an address names a term (#id) and a sense (#id/3), and Back and Forward move between the list and the entry;
 *   - the DOM stays small with a 7,000-row letter open (rows draw a hundred at a time);
 *   - no console error, no failed request, no 5xx from the library;
 *   - at 375px the page does not scroll sideways, and no gap between neighboring blocks passes 72px;
 *   - dark mode follows html[data-sd-theme].
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
const until = async (expr, what) => { const t0 = Date.now(); while (Date.now() - t0 < TIMEOUT) { if (await ev(expr)) return true; await sleep(150); } console.error(`      timed out: ${what}`); return false; };
const listReady = `(()=>{const l=document.querySelector('#lx-list');return !!l&&!document.querySelector('#lx-results').hidden&&!l.hasAttribute('aria-busy')&&l.querySelectorAll('li a.lx-row').length>0})()`;
const frontReady = `(()=>{const f=document.querySelector('#lx-front');return !!f&&!f.hidden&&document.querySelectorAll('#lx-az a').length>60&&document.querySelectorAll('#lx-top .lx-feat-a').length===12})()`;
const entryReady = `(()=>{const e=document.querySelector('#lx-entry');return !!e&&!e.hidden&&e.querySelectorAll('.lx-sense').length>0&&!e.querySelector('.lx-sk-entry')})()`;
const shoot = async (name) => { if (!SHOTS) return; mkdirSync(SHOTS, { recursive: true }); const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); writeFileSync(path.join(SHOTS, `${name}.png`), Buffer.from(r.result.data, 'base64')); };
async function search(q) {
  await ev(`(()=>{const i=document.querySelector('#lx-q');i.value=${JSON.stringify(q)};i.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  await sleep(350);
  return until(listReady, `results for ${q}`);
}

await view(1440);
await send('Page.navigate', { url: URLP });
ok(await until(frontReady, 'the front page'), 'the front page opens with the alphabet and twelve most defined terms');
ok(await ev(`document.querySelector('#lx-hero').hidden===false&&document.querySelectorAll('h1').length===1`), 'the hero shows with one h1');
ok(await ev(`[...document.querySelectorAll('#lx-az .lx-azl')].map(e=>e.textContent).join()`) === 'Latin,Greek,Hebrew', 'the alphabet has a line for Latin, Greek and Hebrew');
await ev(`document.querySelector('#lx-top').scrollIntoView({block:'end'})`);
ok(await until(`document.querySelectorAll('#lx-top .lx-gl').length===12&&[...document.querySelectorAll('#lx-top .lx-gl')].filter(e=>e.textContent.length>10).length>=10`, 'first senses'), 'the featured terms show a first sense and a sense count');
ok(await ev(`document.querySelectorAll('#lx-top .lx-meta span').length>12`), 'the featured terms carry a small-caps line');
await shoot('front-1440-light');
await ev(`document.querySelector('#lx-top').scrollIntoView({block:'start'})`); await sleep(1500);
await shoot('front-featured-1440-light');
await ev('window.scrollTo(0,0)');

/* ── Five searches, each opened ── */
const QUERIES = [['gratia', 'grace'], ['fides', 'faith'], ['πίστις', 'faith'], ['faith', 'faith'], ['אדם', 'אדם']];
for (const [q, want] of QUERIES) {
  const c0 = log.console.length;
  await send('Page.navigate', { url: URLP });
  await until(frontReady, 'front');
  ok(await search(q), `search "${q}": results draw`);
  if (q === 'gratia' || q === 'fides') await shoot(`search-${q}-1440-light`);
  const heads = await ev(`[...document.querySelectorAll('#lx-list .lx-hw')].slice(0, 12).map(e=>e.textContent)`);
  ok(Array.isArray(heads) && heads.some((h) => h.toLowerCase().includes(want.toLowerCase())), `search "${q}": the results include ${want} (${(heads || []).slice(0, 4).join(', ')})`);
  const idHref = await ev(`(()=>{const a=[...document.querySelectorAll('#lx-list a.lx-row')].find(a=>a.querySelector('.lx-hw').textContent.toLowerCase().includes(${JSON.stringify(want.toLowerCase())}))||document.querySelector('#lx-list a.lx-row');return a&&a.getAttribute('href')})()`);
  await ev(`location.hash=${JSON.stringify(idHref)}`);
  ok(await until(entryReady, `entry for ${q}`), `search "${q}": the entry opens with senses`);
  const e = await ev(`(()=>{const s=[...document.querySelectorAll('#lx-entry .lx-sense')];const links=[...document.querySelectorAll('#lx-entry .lx-open')];return {n:s.length,num:s.every((x,i)=>x.querySelector('.lx-sn').textContent==String(i+1)),gloss:s.every(x=>x.querySelector('.lx-gloss').textContent.trim().length>5),links:links.length,bad:links.filter(a=>!/^\\/the-faith-received\\/read\\/\\?w=[^&#]+#b[^-]+-0$/.test(a.getAttribute('href')||'')).length,h2:document.querySelector('#lx-entry h1').textContent,h2lang:document.querySelector('#lx-entry h1').lang,dir:document.querySelector('#lx-entry h1').dir}})()`);
  ok(e && e.n > 0 && e.num && e.gloss, `search "${q}": ${e && e.n} numbered senses, each with a gloss`);
  ok(e && e.links > 0 && e.bad === 0, `search "${q}": ${e && e.links} Open links, each into the reader${e && e.bad ? ` (${e.bad} wrong)` : ''}`);
  const fx = await ev(`(()=>{const f=document.querySelector('#lx-entry .lx-facts');return {has:!!f,dts:f?[...f.querySelectorAll('dt')].map(d=>d.textContent):[],h1:[...document.querySelectorAll('h1')].filter(h=>h.getClientRects().length).length,hero:document.querySelector('#lx-hero').hidden,title:document.title}})()`);
  ok(fx.has && fx.dts.includes('Senses') && fx.h1 === 1 && fx.hero, `search "${q}": Quick facts beside the entry, the headword is the one h1 (${fx.dts.join(', ')})`);
  if (q === 'אדם') ok(e.h2lang === 'he' && e.dir === 'auto', 'a Hebrew headword carries lang="he" and dir="auto"');
  if (want === 'faith' && q !== 'fides') {
    const l = await ev(`({la:!!document.querySelector('#lx-entry .lx-forms dd[lang=la]'),grc:!!document.querySelector('#lx-entry .lx-forms dd[lang=grc]')})`);
    ok(l && l.la && l.grc, 'Latin and Greek forms carry lang="la" and lang="grc"');
  }
  await sleep(1500);
  const cons = log.console.slice(c0).filter((c) => !NOISE.test(c));
  ok(!cons.length, `search "${q}": no console error${cons.length ? ` (${cons[0]})` : ''}`);
}

/* ── Addresses, Back and Forward ── */
await send('Page.navigate', { url: `${URLP}#faith/3` });
ok(await until(entryReady, 'faith/3'), 'the address #faith/3 opens the entry');
await sleep(300);
ok(await ev(`!!document.querySelector('#s3.is-target')`), 'the address #faith/3 marks sense 3');
await shoot('entry-1440-light');
await send('Page.navigate', { url: `${URLP}?l=t` });
ok(await until(listReady, 't list'), 'the address ?l=t opens the letter T');
const dom = await ev(`({rows:document.querySelectorAll('#lx-list li a.lx-row').length,all:document.querySelectorAll('*').length,total:document.querySelector('#lx-shown').textContent})`);
ok(dom.rows <= 100 && dom.all < 2500, `a letter of thousands draws ${dom.rows} rows and ${dom.all} nodes (${dom.total})`);
await ev(`document.querySelector('#lx-more').click()`); await sleep(300);
ok(await ev(`document.querySelectorAll('#lx-list li a.lx-row').length`) === 200, 'Show 100 more adds one hundred rows');
await ev(`document.querySelector('#lx-list a.lx-row').click()`);
ok(await until(entryReady, 'entry from list'), 'a row opens its entry');
await ev('history.back()'); await sleep(600);
ok(await ev(`document.querySelector('#lx-entry').hidden&&!document.querySelector('#lx-results').hidden&&location.search==='?l=t'`), 'Back returns to the list, same letter');
await ev('history.forward()');
ok(await until(entryReady, 'forward'), 'Forward returns to the entry');
await send('Page.navigate', { url: `${URLP}#no-such-term-zz` });
await sleep(2500);
ok(await ev(`/No term has the address/.test(document.querySelector('#lx-entry').textContent)`), 'an unknown address says so plainly');
await send('Page.navigate', { url: `${URLP}?q=zzqx` });
await sleep(2500);
ok(await ev(`/No term matches/.test(document.querySelector('#lx-empty').textContent)&&!document.querySelector('#lx-empty').hidden`), 'a search with no match says so plainly');
await send('Page.navigate', { url: `${URLP}?l=${encodeURIComponent('א')}` });
ok(await until(listReady, 'hebrew letter'), 'a Hebrew letter opens its list');
ok(await ev(`[...document.querySelectorAll('#lx-list .lx-hw')].every(e=>e.lang==='he')`), 'Hebrew headwords carry lang="he"');
ok(await ev(`[...document.querySelectorAll('#lx-list .lx-row')].every(e=>e.getBoundingClientRect().height>=44)`), 'every row is at least 44px tall');
ok(await ev(`document.querySelectorAll('#lx-lnav a').length>=1`), 'a letter page links to its neighbor letters');
await send('Page.navigate', { url: `${URLP}#fides` });
await until(entryReady, 'fides');
await sleep(2500);
ok(await ev(`document.querySelectorAll('#lx-entry .lx-pn').length===2`), 'an entry links to the term before and after it');
ok(await ev(`!document.querySelector('#lx-f-authors').closest('div').hidden&&!document.querySelector('#lx-f-first').closest('div').hidden`), 'Quick facts gain the author count and the earliest source');
await ev(`document.querySelector('#lx-entry .lx-pn-next').click()`);
ok(await until(`location.hash!=='#fides'&&document.querySelector('#lx-title')&&document.querySelectorAll('#lx-entry .lx-sense').length>0`, 'next term'), 'the next-term link opens the next entry');

/* ── 375: no sideways scroll, no gap past 72px ── */
const GAPS = `(()=>{const out=[];const vis=e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
  for(const box of ['#lx-front','#lx-results','.lx-ent']){const b=document.querySelector(box);if(!b||b.hidden)continue;const kids=[...b.children].filter(vis);
    for(let i=1;i<kids.length;i++){const g=kids[i].getBoundingClientRect().top-kids[i-1].getBoundingClientRect().bottom;if(g>72)out.push(Math.round(g)+'px before '+(kids[i].id||kids[i].className));}}
  return out;})()`;
for (const w of [375, 820, 1024, 1440]) {
  await view(w, w === 375 ? 812 : 900, w === 375);
  for (const [name, url] of [['front', URLP], ['list', `${URLP}?l=g`], ['entry', `${URLP}#faith`]]) {
    await send('Page.navigate', { url });
    await until(name === 'front' ? frontReady : name === 'list' ? listReady : entryReady, `${name} at ${w}`);
    await sleep(600);
    const m = await ev(`({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth})`);
    ok(m.sw <= m.cw, `${name} at ${w}: no sideways scroll (${m.sw} of ${m.cw})`);
    if (w === 375 && name === 'front') ok(await ev(`[...document.querySelectorAll('#lx-az a')].every(a=>a.getBoundingClientRect().height>=44&&a.getBoundingClientRect().width>=44)`), 'front at 375: every letter is a 44px target');
    if (w === 1440 && name === 'entry') ok(await ev(`getComputedStyle(document.querySelector('.lx-facts')).position==='sticky'`), 'entry at 1440: Quick facts is sticky beside the senses');
    if (w === 1440 && name === 'list') ok(await ev(`getComputedStyle(document.querySelector('.lx-words')).columnCount==='3'`), 'list at 1440: three columns of words');
    if (w === 375) { const g = await ev(GAPS); ok(Array.isArray(g) && !g.length, `${name} at 375: no gap past 72px${g && g.length ? ` (${g.join(', ')})` : ''}`); }
    await shoot(`${name}-${w}-light`);
    await ev(`document.documentElement.setAttribute('data-sd-theme','dark')`);
    await sleep(250);
    if (w === 1440 && name === 'front') {
      const bg = await ev(`getComputedStyle(document.querySelector('main.tfr-lexicon')).backgroundColor`);
      const lum = (bg.match(/\d+/g) || [255, 255, 255]).slice(0, 3).map(Number).reduce((a, b) => a + b, 0) / 3;
      ok(lum < 80, `dark mode on html[data-sd-theme] darkens the page (${bg})`);
    }
    await shoot(`${name}-${w}-dark`);
    await ev(`document.documentElement.setAttribute('data-sd-theme','light')`);
  }
}
const fails = log.fail.filter((u) => /\/v1\/|\/assets\//.test(u) && !NOISE.test(u));
const bad = log.net.filter((n) => n.status >= 500 && /\/v1\//.test(n.url)).map((n) => `${n.status} ${n.url.replace(/^https?:\/\/[^/]+/, '')}`);
const missing = log.net.filter((n) => n.status === 404 && /\/assets\//.test(n.url)).map((n) => n.url);
ok(!fails.length && !bad.length && !missing.length, `no failed request, no 5xx from the library, no missing asset${fails.length || bad.length || missing.length ? ` (${[...fails, ...bad, ...missing].slice(0, 3).join(' | ')})` : ''}`);
cleanup();
if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1); }
console.log('\nlexicon: the page searches, opens entries and holds its layout');
process.exit(0);
