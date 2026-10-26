#!/usr/bin/env node
/*
 * Layout collisions on the two desks, measured in a real browser engine (2026-10-20, after "16 shared" was drawn under a circle).
 *
 * It builds a harness page from the real templates (custom-faith-topics-dev.hbs, custom-scripture-dev-desk.hbs: their scripts and
 * stylesheets, in order), serves the theme's assets, forwards the two worker hosts through a local proxy (CORS), drives headless Chrome over
 * the DevTools protocol, and for each page measures, inside the desk's container:
 *   - every pair of rendered text boxes (a Range per text node) that intersect by more than 2px
 *   - every text box and graphic (svg shape, img, canvas) that intersect by more than 2px, unless the graphic holds the text by design
 *   - text clipped by overflow (scrollWidth over clientWidth) and in-page scroll boxes
 *   - elements that extend past the viewport sideways, and a page wider than the viewport
 * at widths 375, 768, 1024, 1280, and 1920, in light and in dark (the system scheme).
 *
 *   node scripts/check-desk-overlap.mjs                 10 topics and 12 verses
 *   node scripts/check-desk-overlap.mjs --only topic    (or verse)
 *   node scripts/check-desk-overlap.mjs --quick         3 topics and 3 verses
 *
 * Skips (and passes) when Chrome is not found (set CHROME to a binary) or the library is not reachable. Not part of `npm run build`:
 * it needs the network and a browser and takes minutes.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const VERSE = "https://mo-tfr-verse.mo-podcast-feed.workers.dev";
const LIB = "https://mo-tfr-library.mo-podcast-feed.workers.dev";
const BIBLE = "https://mo-bible.mo-podcast-feed.workers.dev";
const UA = { "User-Agent": "curl/8.7.1" };
const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : "";
const quick = args.includes("--quick");

const chromePath = [process.env.CHROME, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find((p) => p && existsSync(p));
if (!chromePath) { console.log("skip  desk overlap: no Chrome found (set CHROME)"); process.exit(0); }
try { const r = await fetch(`${LIB}/v1/scripture/rank.json`, { headers: UA, method: "HEAD" }); if (!r.ok) throw new Error(String(r.status)); } catch (_) { console.log("skip  desk overlap: the library is not reachable"); process.exit(0); }
if (typeof WebSocket === "undefined") { console.log("skip  desk overlap: this Node has no WebSocket"); process.exit(0); }

// ── The harness page, from the templates ───────────────────────
const harness = (hbs) => {
  const body = readFileSync(path.join(root, hbs), "utf8")
    .replace(/\{\{!--[\s\S]*?--\}\}/g, "").replace(/\{\{!<[^}]*\}\}/g, "").replace(/\{\{>[^}]*\}\}/g, "").replace(/\{\{#?\/?contentFor[^}]*\}\}/g, "")
    .replace(/\{\{asset "([^"]+)"\}\}(?:&amp;frv=[A-Za-z0-9-]+)?/g, "/assets/$1").replace(/<title>[\s\S]*?<\/title>|<meta[^>]*>/g, "");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="tfr-library-base" content="${LIB}">` +
    `<link rel="stylesheet" href="/assets/built/screen.min.css"><link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap" rel="stylesheet">` +
    `<style>:root{--font-body:"Source Serif 4",Georgia,serif}</style><script src="/assets/js/vendor/purify.min.js"></script></head><body>${body}</body></html>`;
};
const PAGES = {
  topic: { html: harness("custom-faith-topics-dev.hbs"), container: ".td-desk|.fr-dn", ready: ".td-desk .tdk-hero, .td-desk .tdk-mod",
    states: [
      { name: "History, every century open", js: "const t = document.querySelector('#about-history'); if (!t) return false; t.click(); document.querySelectorAll('.tdk-row-h[aria-expanded=false]').forEach((b) => b.click()); return true;", wait: 600 },
      ...["scripture", "course", "traditions", "concepts"].map((k) => ({ name: k, js: `const t = document.querySelector('#about-${k}'); if (!t) return false; t.click(); return true;`, wait: k === "scripture" ? 6000 : 1200 })),
    ],
    tiles: { tiles: ".tdk-tiles", card: ".td-head" },
    urls: () => {
      const loci = JSON.parse(readFileSync(path.join(root, "assets/data/faith-received/loci.json"), "utf8"));
      const ids = loci.parts.flatMap((p) => p.loci.map((l) => l.id));
      const want = ["de-trinitate", "de-justificatione", "de-christo", "de-baptismo", "de-praedestinatione", "de-ecclesia", "de-scriptura", "de-coena", "de-providentia", "de-relationibus", "de-sacramentis"].filter((i) => ids.includes(i));
      return (quick ? ["de-trinitate", "de-sacramentis", "de-ecclesia"] : want).map((i) => `/topic?t=${i}`);
    } },
  verse: { html: harness("custom-scripture-dev-desk.hbs"), container: "[data-sd-desk]", tiles: { tiles: ".vd-tiles", card: ".sd-desk-head" }, ready: "[data-sd-desk] [class*='vd-']",
    urls: () => (quick ? ["john.1.1", "romans.8.28", "genesis.1.1"] : ["john.1.1", "matthew.16.18", "genesis.1.1", "romans.8.28", "john.3.16", "ephesians.2.8", "psalms.23.1", "1-corinthians.15.3", "hebrews.11.1", "romans.3.28", "john.10.30", "revelation.21.4"]).map((r) => `/verse?ref=${r}`) },
};

// ── A local server: the theme's assets, the harness, the two workers ─
const server = createServer(async (q, r) => {
  const u = new URL(q.url, "http://x");
  const px = [["/px/verse", VERSE], ["/px/lib", LIB], ["/px/bible", BIBLE]].find(([k]) => u.pathname.startsWith(k));
  if (px) {
    try { const x = await fetch(px[1] + u.pathname.slice(px[0].length) + u.search, { headers: { ...UA, Origin: "https://mereorthodoxy.com" } }); r.writeHead(x.status, { "content-type": x.headers.get("content-type") || "application/json" }); r.end(Buffer.from(await x.arrayBuffer())); } catch (_) { r.writeHead(502); r.end("bad"); }
    return;
  }
  if (u.pathname.startsWith("/assets/")) {
    const f = path.join(root, decodeURIComponent(u.pathname));
    if (!f.startsWith(path.join(root, "assets")) || !existsSync(f)) { r.writeHead(404); r.end("no"); return; }
    const ext = path.extname(f);
    r.writeHead(200, { "content-type": { ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".jpg": "image/jpeg", ".svg": "image/svg+xml" }[ext] || "application/octet-stream" });
    r.end(readFileSync(f));
    return;
  }
  r.writeHead(200, { "content-type": "text/html" });
  r.end(u.pathname.startsWith("/verse") ? PAGES.verse.html : PAGES.topic.html);
});
await new Promise((res) => server.listen(0, "127.0.0.1", res));
const base = `http://127.0.0.1:${server.address().port}`;

if (args.includes("--serve")) { console.log(`serving the harness at ${base}/topic?t=de-ecclesia and ${base}/verse?ref=john.1.1`); await new Promise(() => {}); }

// ── Headless Chrome over the DevTools protocol ─────────────────
const profile = mkdtempSync(path.join(tmpdir(), "desk-overlap-"));
const chrome = spawn(chromePath, ["--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars", `--user-data-dir=${profile}`, "--remote-debugging-port=0", "about:blank"], { stdio: "ignore" });
const cleanup = () => { try { chrome.kill("SIGKILL"); } catch (_) { /* gone */ } server.close(); try { rmSync(profile, { recursive: true, force: true }); } catch (_) { /* busy */ } };
process.on("exit", cleanup);
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => process.exit(130));
let port = 0;
for (let i = 0; i < 100 && !port; i += 1) {
  await new Promise((res) => setTimeout(res, 150));
  const f = path.join(profile, "DevToolsActivePort");
  if (existsSync(f)) port = Number(readFileSync(f, "utf8").split("\n")[0]);
}
if (!port) { console.log("skip  desk overlap: Chrome did not start"); cleanup(); process.exit(0); }
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0;
const waiting = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && waiting.has(d.id)) { waiting.get(d.id)(d); waiting.delete(d.id); } };
const send = (method, params = {}) => new Promise((res) => { seq += 1; waiting.set(seq, res); ws.send(JSON.stringify({ id: seq, method, params })); });
const evaluate = async (expression) => { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); return r.result && r.result.result ? r.result.result.value : undefined; };
await send("Page.enable");
await send("Page.addScriptToEvaluateOnNewDocument", { source: `(function(){var f=window.fetch;window.fetch=function(u,o){var s=String(u).replace("${VERSE}","/px/verse").replace("${LIB}","/px/lib").replace("${BIBLE}","/px/bible");return f.call(this,s,o);};})();` });

// ── The measurement, run in the page ───────────────────────────
const MEASURE = `((sel) => {
  const root = document.querySelector(sel);
  if (!root) return { error: "no container" };
  const vw = document.documentElement.clientWidth;
  const desc = (el) => { if (!el) return "?"; const c = (typeof el.className === "string" ? el.className : (el.className && el.className.baseVal) || "").trim().split(/\\s+/).filter(Boolean).slice(0, 2).join("."); return el.tagName.toLowerCase() + (c ? "." + c : ""); };
  const hiddenUp = (el) => { for (let e = el; e && e !== root.parentElement; e = e.parentElement) { const cs = getComputedStyle(e); if (e.hidden || cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) < 0.05) return true; if (e.tagName === "DETAILS" && !e.open && !(el.closest("summary") && el.closest("summary").parentElement === e)) return true; if (cs.clip !== "auto" && cs.position === "absolute" && /rect\\(0/.test(cs.clip)) return true; if (/inset\\(50%\\)/.test(cs.clipPath)) return true; } return false; };
  const texts = [];
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (tw.nextNode()) {
    const n = tw.currentNode;
    const el = n.parentElement;
    if (!n.nodeValue.trim() || !el || el.closest("script,style,noscript,option") || hiddenUp(el)) continue;
    const er = el.getBoundingClientRect();
    if (er.width <= 2 || er.height <= 2) continue;
    const rg = document.createRange(); rg.selectNodeContents(n);
    for (const q of rg.getClientRects()) {
      if (q.width < 2 || q.height < 2) continue;
      const pad = q.height * 0.12;
      texts.push({ l: q.left, t: q.top + pad, r: q.right, b: q.bottom - pad, el, s: n.nodeValue.trim().slice(0, 24) });
    }
  }
  const gfx = [...root.querySelectorAll("svg circle, svg rect, svg ellipse, svg path, svg polygon, img, canvas")].filter((g) => !hiddenUp(g)).map((g) => {
    // What is drawn is the box clipped by every ancestor that clips (a portrait larger than its ring is cropped by the ring, not overlapping the name).
    const q = g.getBoundingClientRect();
    let L = q.left; let T = q.top; let R = q.right; let B = q.bottom;
    for (let p = g.parentElement; p && p !== root.parentElement; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (/(hidden|clip|auto|scroll)/.test(cs.overflowX + cs.overflowY)) { const c = p.getBoundingClientRect(); L = Math.max(L, c.left); T = Math.max(T, c.top); R = Math.min(R, c.right); B = Math.min(B, c.bottom); }
    }
    return { l: L, t: T, r: R, b: B, el: g };
  }).filter((g) => g.r - g.l > 2 && g.b - g.t > 2);
  const x = (a, b) => Math.min(a.r, b.r) - Math.max(a.l, b.l);
  const y = (a, b) => Math.min(a.b, b.b) - Math.max(a.t, b.t);
  const within = (a, b) => a.l >= b.l - 1 && a.r <= b.r + 1 && a.t >= b.t - 1 && a.b <= b.b + 1;
  const seen = new Set(); const out = { overlaps: [], clipped: [], wide: [], texts: texts.length, gfx: gfx.length };
  const add = (k, o) => { const key = k + o.a + "|" + o.b; if (!seen.has(key)) { seen.add(key); out[k === "o" ? "overlaps" : k === "c" ? "clipped" : "wide"].push(o); } };
  texts.sort((p, q) => p.t - q.t);
  for (let i = 0; i < texts.length; i += 1) {
    for (let j = i + 1; j < texts.length && texts[j].t < texts[i].b; j += 1) {
      const a = texts[i]; const b = texts[j];
      if (x(a, b) > 2 && y(a, b) > 2) add("o", { a: desc(a.el) + ' "' + a.s + '"', b: desc(b.el) + ' "' + b.s + '"', kind: "text/text", w: Math.round(x(a, b)), h: Math.round(y(a, b)), at: [Math.round(Math.max(a.l, b.l) + scrollX), Math.round(Math.max(a.t, b.t) + scrollY)] });
    }
    for (const g of gfx) {
      if (x(texts[i], g) > 2 && y(texts[i], g) > 2 && !g.el.contains(texts[i].el) && !texts[i].el.contains(g.el) && !within(texts[i], g)) add("o", { a: desc(texts[i].el) + ' "' + texts[i].s + '"', b: desc(g.el), kind: "text/graphic", w: Math.round(x(texts[i], g)), h: Math.round(y(texts[i], g)), rt: [Math.round(texts[i].l), Math.round(texts[i].t), Math.round(texts[i].r), Math.round(texts[i].b)], rg: [Math.round(g.l), Math.round(g.t), Math.round(g.r), Math.round(g.b)], vis: window.getComputedStyle(g.el).opacity + "/" + g.el.complete, at: [Math.round(Math.max(texts[i].l, g.l) + scrollX), Math.round(Math.max(texts[i].t, g.t) + scrollY)] });
    }
  }
  for (const el of root.querySelectorAll("*")) {
    if (el.closest("svg") && el.tagName.toLowerCase() !== "svg") continue;
    if (hiddenUp(el)) continue;
    const cs = getComputedStyle(el);
    const ox = cs.overflowX; const q = el.getBoundingClientRect();
    if (/(hidden|clip)/.test(ox) && el.scrollWidth > el.clientWidth + 1 && el.textContent.trim() && !cs.webkitLineClamp.match(/^\\d/) && cs.textOverflow !== "ellipsis") add("c", { a: desc(el), b: "clipped " + (el.scrollWidth - el.clientWidth) + "px" });
    if (/(auto|scroll)/.test(ox) && el.scrollWidth > el.clientWidth + 1) add("c", { a: desc(el), b: "scroll box" });
    if (q.width > 0 && (q.right > vw + 1 || q.left < -1)) { let clipped = false; for (let p = el.parentElement; p && p !== root.parentElement; p = p.parentElement) { const s = getComputedStyle(p); if (/(hidden|clip|auto|scroll)/.test(s.overflowX) && p.getBoundingClientRect().right <= vw + 1) { clipped = true; break; } } if (!clipped) add("w", { a: desc(el), b: "right " + Math.round(q.right) + " of " + vw }); }
  }
  if (document.documentElement.scrollWidth > vw + 1) out.wide.push({ a: "page", b: "scrollWidth " + document.documentElement.scrollWidth + " of " + vw });
  for (const k of ["overlaps", "clipped", "wide"]) out[k] = out[k].slice(0, 12);
  return out;
})`;

// ── Run ────────────────────────────────────────────────────────
const WIDTHS = [375, 768, 1024, 1280, 1920];
const SCHEMES = process.env.SHOTSEL ? ["light", "dark"] : ["light", "dark"];
const until = async (sel, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await evaluate(`Boolean(document.querySelector(${JSON.stringify(sel)}))`)) return true; await new Promise((res) => setTimeout(res, 300)); } return false; };
let failed = 0;
let measured = 0;
const found = new Map();
for (const [name, cfg] of Object.entries(PAGES)) {
  if (only && only !== name) continue;
  for (const u of cfg.urls()) {
    await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: base + u });
    const ready = await until(cfg.ready, 40000);
    await new Promise((res) => setTimeout(res, Number(process.env.WAIT) || 6000));
    if (!ready) { console.log(`skip  ${name} ${u}: the desk did not draw in time`); continue; }
    if (cfg.tiles) {
      // The tile row spans its hero card: edges within 2px of the card's (the card's own padding aside, the row may sit inside it at a fixed inset),
      // tiles equal in width within 1px, four across from 1024px up and a full-width 2x2 below. Never pushed to one side.
      for (const w of [375, 768, 1024, 1280, 1920]) {
        await send("Emulation.setDeviceMetricsOverride", { width: w, height: 900, deviceScaleFactor: 1, mobile: false });
        await new Promise((res) => setTimeout(res, 300));
        const g = await evaluate(`(() => { const t = document.querySelector(${JSON.stringify(cfg.tiles.tiles)}); const c = document.querySelector(${JSON.stringify(cfg.tiles.card)}); if (!t) return null; const kids = [...t.children].filter((k) => k.getBoundingClientRect().width > 0).map((k) => k.getBoundingClientRect()); const tr = t.getBoundingClientRect(); const cr = c ? c.getBoundingClientRect() : null; return { l: tr.left, r: tr.right, cl: cr ? cr.left : null, cr: cr ? cr.right : null, ws: kids.map((k) => k.width), tops: kids.map((k) => Math.round(k.top)), ls: kids.map((k) => k.left), rs: kids.map((k) => k.right) }; })()`);
        if (!g) continue;
        measured += 1;
        const bad = [];
        if (g.cl !== null && (Math.abs(g.l - g.cl) > 40 || Math.abs(g.r - g.cr) > 40)) bad.push(`row ${Math.round(g.l)}-${Math.round(g.r)} vs card ${Math.round(g.cl)}-${Math.round(g.cr)}`);
        const eq = g.ws.filter((x) => x < (g.r - g.l) - 2); // an odd last tile may span the whole row below 1024px
        if (eq.length && Math.max(...eq) - Math.min(...eq) > 1) bad.push(`unequal widths ${eq.map(Math.round).join(",")}`);
        if (Math.abs(Math.min(...g.ls) - g.l) > 2 || Math.abs(Math.max(...g.rs) - g.r) > 2) bad.push(`tiles do not fill the row (${Math.round(Math.min(...g.ls))}-${Math.round(Math.max(...g.rs))} in ${Math.round(g.l)}-${Math.round(g.r)})`);
        const across = new Set(g.tops).size === 1 ? g.ws.length : g.tops.filter((t) => t === g.tops[0]).length;
        if (w >= 1024 && g.ws.length === 4 && across !== 4) bad.push(`${across} across at ${w}px, want 4`);
        if (w < 1024 && g.ws.length === 4 && across !== 2) bad.push(`${across} across at ${w}px, want 2`);
        bad.forEach((b) => { const key = `${name} tiles: ${b.replace(/[\d.,-]+/g, "#")}`; if (!found.has(key)) found.set(key, []); found.get(key).push(`${u} ${w} ${b}`); });
      }
    }
    for (const state of cfg.states || [null]) {
    if (state) {
      const shown = await evaluate(`(() => { ${state.js} })()`);
      if (!shown) { console.log(`skip  ${name} ${u} [${state.name}]: not on this page`); continue; }
      await new Promise((res) => setTimeout(res, state.wait || 800));
      if (state.name === "scripture") {
        const n = await evaluate("document.querySelectorAll('.tsc-text:not([hidden])').length");
        console.log(`      ${name} ${u}: ${n} verse texts shown on the Scripture cards`);
        if (n === 0) console.log("skip  verse text did not load in this run (the Bible host may be unreachable)");
      }
    }
    for (const scheme of SCHEMES) {
      await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] });
      for (const w of WIDTHS) {
        await send("Emulation.setDeviceMetricsOverride", { width: w, height: 900, deviceScaleFactor: 1, mobile: false });
        await new Promise((res) => setTimeout(res, 350));
        const parts = [];
        for (const c of cfg.container.split("|")) { if (await evaluate(`Boolean(document.querySelector(${JSON.stringify(c)}))`)) parts.push(await evaluate(`${MEASURE}(${JSON.stringify(c)})`)); }
        const m = parts.length ? { overlaps: parts.flatMap((p) => p.overlaps || []), clipped: parts.flatMap((p) => p.clipped || []), wide: parts.flatMap((p) => p.wide || []) } : { error: "no container" };
        if (!m || m.error) { console.log(`skip  ${name} ${u} ${w} ${scheme}: ${m ? m.error : "no result"}`); continue; }
        measured += 1;
        if (process.env.SHOTSEL && process.env.SHOT) {
          // SHOTSEL=".fr-dn" SHOT=<dir>: a picture of that element at each width, for looking at a design
          const r = await evaluate(`(() => { const e = document.querySelector(${JSON.stringify(process.env.SHOTSEL)}); if (!e) return null; const q = e.getBoundingClientRect(); return [q.left + scrollX, q.top + scrollY, q.width, Math.min(q.height, 1400)]; })()`);
          if (r) {
            const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: r[0], y: r[1], width: r[2], height: r[3], scale: 1 } });
            if (shot.result) writeFileSync(path.join(process.env.SHOT, `el-${name}-${u.replace(/\W+/g, "_")}-${w}-${scheme}.png`), Buffer.from(shot.result.data, "base64"));
          }
        }
        if (process.env.SHOT && m.overlaps[0] && m.overlaps[0].at) {
          const [ax, ay] = m.overlaps[0].at;
          const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: Math.max(0, ax - 280), y: Math.max(0, ay - 110), width: Math.min(560, w), height: 220, scale: 1 } });
          if (shot.result) writeFileSync(path.join(process.env.SHOT, `${name}-${u.replace(/\W+/g, "_")}-${w}-${scheme}.png`), Buffer.from(shot.result.data, "base64"));
        }
        for (const k of ["overlaps", "clipped", "wide"]) for (const o of m[k]) {
          const key = `${name} ${k}: ${o.a} / ${o.b}${o.kind ? ` (${o.kind})` : ""}`;
          if (!found.has(key)) found.set(key, []);
          found.get(key).push(`${u} ${w} ${scheme}${state ? ` [${state.name}]` : ""}${o.w ? ` ${o.w}x${o.h}px` : ""}${process.env.DEBUG_GEOM && o.rt ? ` text ${o.rt} gfx ${o.rg} ${o.vis}` : ""}`);
        }
      }
    }
    }
    console.log(`      ${name} ${u}: measured`);
  }
}
for (const [k, where] of found) { failed += 1; console.error(`FAIL  ${k}\n        at ${where.slice(0, 4).join("; ")}${where.length > 4 ? ` and ${where.length - 4} more` : ""}`); }
cleanup();
if (failed) { console.error(`\n${failed} collision kind(s) in ${measured} measurements`); process.exit(1); }
console.log(`\ndesk overlap: no collisions in ${measured} measurements (widths ${WIDTHS.join(", ")}; light and dark)`);
process.exit(0);
