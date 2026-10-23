/*
 * The Commentary decks in a real Chrome: every deck, five places each, both panes. A place passes when the left pane and the right
 * pane both resolve to real content within the timeout (no skeleton, no "Loading", no "did not load"), the address round-trips, and
 * the page logs no console error and makes no failed or 5xx request to the library. Written after 2026-10-23, when a place opened
 * while another was still loading left the pane blank (a stale render drew from half-loaded state), a failed fetch was kept as a
 * missing file for the whole visit, and the right pane could not read a Father in Migne at all.
 *
 *   node scripts/check-decks-panes.mjs                          the live site
 *   node scripts/check-decks-panes.mjs --base http://localhost:8788   a dev proxy
 *   node scripts/check-decks-panes.mjs --places 8 --deck summa  more places, one deck
 *
 * Needs Google Chrome (CHROME=/path to override) and the network. Skips, and passes, without either. Not part of `npm run build`,
 * which must not depend on the network: run it after a deploy and before a merge that touches faith-decks*.js.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const BASE = String(opt('--base', 'https://mereorthodoxy.com')).replace(/\/$/, '');
const PLACES = Number(opt('--places', 5));
const ONLY = opt('--deck', '');
const TIMEOUT = Number(opt('--timeout', 20000));
const CHROME = process.env.CHROME || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => existsSync(p));
if (!CHROME) { console.log('skip  decks in Chrome: no Chrome found (set CHROME=)'); process.exit(0); }
try { await fetch(`${BASE}/the-faith-received/commentary-decks/`, { headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120' } }); } catch (_) { console.log('skip  decks in Chrome: the network is not reachable'); process.exit(0); }

const DECKS = ['sentences', 'summa', 'metaphysics', 'reformed', 'vitringa', 'lutheran', 'decretals', 'decretum'].filter((d) => !ONLY || d === ONLY);
const NOISE = /Ignoring Event: localhost|ghost|analytics|slide-ins|\/settings|\/pa\/js|\/e$|members\/api|favicon|googletagmanager|plausible/i;
let failed = 0;
const ok = (cond, msg) => { if (cond) console.log(`ok    ${msg}`); else { failed += 1; console.error(`FAIL  ${msg}`); } };

const profile = mkdtempSync(path.join(tmpdir(), 'decks-'));
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank'], { stdio: 'ignore' });
const cleanup = () => { try { proc.kill(); } catch (_) { /* gone */ } try { rmSync(profile, { recursive: true, force: true }); } catch (_) { /* gone */ } };
process.on('exit', cleanup);
let port = 0;
for (let i = 0; i < 100 && !port; i += 1) { await new Promise((r) => setTimeout(r, 150)); const f = path.join(profile, 'DevToolsActivePort'); if (existsSync(f)) port = Number(readFileSync(f, 'utf8').split('\n')[0]); }
if (!port) { console.log('skip  decks in Chrome: Chrome did not start'); process.exit(0); }
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0; const waiting = new Map(); const log = { console: [], net: [], fail: [] }; const reqs = new Map();
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send('Page.enable'); await send('Network.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

const STATE = `(()=>{const q=(id)=>{const e=document.querySelector(id),s=e&&e.querySelector('.scroll'),t=((s||e)&&(s||e).innerText)||'';return {t:t.slice(0,160).replace(/\\n+/g,' | '),n:t.length,busy:!!(e&&e.querySelector('.sk')),bad:/did not load|Loading|^\\s*$/.test(t.slice(0,60))};};return {done:!!(window.FRDecks&&window.FRDecks.rendered===hashOf()),hb:(document.querySelector('#paneB h2')||{}).innerText||'',a:q('#paneA'),b:q('#paneB'),hash:location.hash,pick:(document.querySelector('#pick')||{}).textContent||''};})()`;
async function resolved(hashPrefix) {
  const t0 = Date.now(); let s = null;
  while (Date.now() - t0 < TIMEOUT) {
    s = await ev(STATE);
    if (s && s.done && s.hash.startsWith(hashPrefix) && !s.a.busy && !s.b.busy && s.a.n > 20 && s.b.n > 20 && !s.a.bad && !s.b.bad) return { ok: true, s };
    await sleep(250);
  }
  return { ok: false, s };
}

await send('Page.navigate', { url: `${BASE}/the-faith-received/commentary-decks/` });
await sleep(6000);
for (const deck of DECKS) {
  await ev(`location.hash='#${deck}'`); await sleep(1500);
  const pairs = await ev(`(()=>{const out=[];const parts=GD()?[null]:[...document.querySelectorAll('#parts [data-part]')].map(x=>x.dataset.part);const keep=S.part;for(const p of parts){if(p)S.part=p;for(const x of places())out.push({part:x.part||S.part,k:x.k,n:x.n});}S.part=keep;return out;})()`);
  if (!Array.isArray(pairs) || !pairs.length) { ok(false, `${deck}: the deck has no places`); continue; }
  const filled = pairs.filter((p) => p.n);
  const pick = new Map(); let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const add = (p) => { if (p) pick.set(`${p.part}/${p.k}`, p); };
  add(filled[0]); add(filled[filled.length - 1]); add(filled[Math.floor(filled.length / 2)]);
  while (pick.size < Math.min(PLACES, filled.length)) add(filled[Math.floor(rnd() * filled.length)]);
  for (const p of pick.values()) {
    const base = `${deck}/${p.part}/${p.k}`;
    const c0 = log.console.length, f0 = log.fail.length, n0 = log.net.length;
    await ev(`location.hash='#${base}'`);
    const r1 = await resolved(`#${base}`);
    ok(r1.ok, `${base}: both panes resolve (${r1.ok ? r1.s.pick.slice(0, 40) : JSON.stringify(r1.s && { a: r1.s.a.t.slice(0, 50), b: r1.s.b.t.slice(0, 50), hash: r1.s.hash })})`);
    // a commentator in the right pane, the same one in the left: the compare state
    const cs = await ev('commentators(true).map(c=>c.slug)');
    if (Array.isArray(cs) && cs.length) {
      const q = `r=${encodeURIComponent(cs[0])}${cs.length > 1 ? `&l=${encodeURIComponent(cs[cs.length - 1])}` : ''}`;
      await ev(`location.hash='#${base}?${q}'`);
      const r2 = await resolved(`#${base}?`);
      ok(r2.ok, `${base}?${q.slice(0, 40)}: both panes resolve (${r2.ok ? r2.s.b.t.slice(0, 40) : JSON.stringify(r2.s && { a: r2.s.a.t.slice(0, 50), b: r2.s.b.t.slice(0, 50) })})`);
    }
    const cons = log.console.slice(c0).filter((c) => !NOISE.test(c));
    const bad = log.net.slice(n0).filter((n) => n.status >= 500 && /\/v1\//.test(n.url)).map((n) => `${n.status} ${n.url.replace(/^https?:\/\/[^/]+/, '')}`);
    const fails = log.fail.slice(f0).filter((u) => /\/v1\//.test(u) && !NOISE.test(u));
    ok(!cons.length && !bad.length && !fails.length, `${base}: no console error and no failed request${cons.length || bad.length || fails.length ? ` (${[...cons, ...bad, ...fails].slice(0, 3).join(' | ')})` : ''}`);
  }
}
cleanup();
if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1); }
console.log('\ndecks: every deck resolves both panes');
process.exit(0);
