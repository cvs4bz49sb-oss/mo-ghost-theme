#!/usr/bin/env node
/*
 * The Resources page grid, measured in a real browser engine (2026-10-20).
 *
 * Builds a harness from custom-faith-resources.hbs (partials and helpers stripped, its scripts and stylesheet kept), serves the
 * theme's assets locally, drives headless Chrome over the DevTools protocol, and at 1920, 1440, 1280, 1024, 768 and 375 asserts:
 *   - the column count (4 at 1920, 1440, 1280 and 1024, 2 at 768, 1 at 375)
 *   - the grid, tab bar and hero share the theme's .container edges (1180px, 28px padding) within 1px
 *   - no horizontal overflow of the page
 *   - tiles of one grid are the same width within 1px
 *   - no two cards, and no two text lines inside a card, overlap
 *   - every article is drawn (493 unique; grouped, multi-kind essays sit under each group; each kind filter shows its own set, flat, with no repeats) and a full render takes under 150 ms of script
 *   - every card is a link, and has an image or a placeholder tile
 *
 *   node scripts/check-resources-grid.mjs
 *
 * Skips (and passes) when Chrome is not found (set CHROME to a binary). Not part of `npm run build`: it needs a browser.
 * Images come from the network; they are not needed for the layout, so a blocked image changes nothing here.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dataFile = JSON.parse(readFileSync(path.join(import.meta.dirname, "..", "assets/data/faith-received/mo-articles.json"), "utf8"));
const ksOf = (a) => a.ks || [a.k];
const WANT_KIND = Object.fromEntries(["doc", "work", "retrieval", "topic"].map((k) => [k, dataFile.articles.filter((a) => ksOf(a).includes(k)).length]));
const pods = JSON.parse(readFileSync(path.join(import.meta.dirname, "..", "assets/data/faith-received/mo-podcasts.json"), "utf8"));
const PODS = pods.articles;
const WANT_SHOW = Object.fromEntries(["passages", "mere-fidelity", "christians-reading-classics"].map((k) => [k, PODS.filter((a) => a.s === k).length]));
const WANT_POD_CARDS = PODS.length;
const WANT_CARDS = dataFile.articles.reduce((n, a) => n + ksOf(a).length, 0);

const root = path.resolve(import.meta.dirname, "..");
const chromePath = [process.env.CHROME, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find((p) => p && existsSync(p));
if (!chromePath) { console.log("skip  resources grid: no Chrome found (set CHROME)"); process.exit(0); }
if (typeof WebSocket === "undefined") { console.log("skip  resources grid: this Node has no WebSocket"); process.exit(0); }

const tpl = readFileSync(path.join(root, "custom-faith-resources.hbs"), "utf8")
  .replace(/\{\{!<.*?\}\}/g, "")
  .replace(/\{\{!--[\s\S]*?--\}\}/g, "")
  .replace(/\{\{#contentFor "moHead"\}\}[\s\S]*?\{\{\/contentFor\}\}/g, "")
  .replace(/\{\{> [^}]*\}\}/g, "")
  .replace(/<script src="\{\{asset "js\/page\/faith-tfr-rail\.js"\}\}" defer><\/script>/, "")
  .replace(/\{\{asset "([^"]+)"\}\}&amp;frv=[a-z0-9-]+/g, "/assets/$1");
const harness = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/css/faith-resources.css"><style>body{margin:0;--font-body:Georgia,serif;background:#f7f4ef}.container{width:100%;box-sizing:border-box;max-width:1180px;margin:0 auto;padding:0 28px}</style></head><body>${tpl}</body></html>`;

const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/h") { res.setHeader("content-type", "text/html"); res.end(harness); return; }
  const file = path.join(root, decodeURIComponent(url.pathname));
  if (!file.startsWith(root) || !existsSync(file) || !/\.(js|css|json)$/.test(file)) { res.statusCode = 404; res.end("no"); return; }
  res.setHeader("content-type", file.endsWith(".json") ? "application/json" : file.endsWith(".css") ? "text/css" : "text/javascript");
  res.end(readFileSync(file));
});
await new Promise((res) => server.listen(0, "127.0.0.1", res));
const base = `http://127.0.0.1:${server.address().port}`;

const profile = mkdtempSync(path.join(tmpdir(), "res-grid-"));
const chrome = spawn(chromePath, ["--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars", `--user-data-dir=${profile}`, "--remote-debugging-port=0", "about:blank"], { stdio: "ignore" });
const cleanup = () => { try { chrome.kill(); } catch (_) { /* gone */ } server.close(); try { rmSync(profile, { recursive: true, force: true }); } catch (_) { /* busy */ } };
process.on("exit", cleanup);
let port = 0;
for (let i = 0; i < 100 && !port; i += 1) {
  await new Promise((res) => setTimeout(res, 150));
  const f = path.join(profile, "DevToolsActivePort");
  if (existsSync(f)) port = Number(readFileSync(f, "utf8").split("\n")[0]);
}
if (!port) { console.log("skip  resources grid: Chrome did not start"); cleanup(); process.exit(0); }
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0;
const waiting = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && waiting.has(d.id)) { waiting.get(d.id)(d); waiting.delete(d.id); } };
const send = (method, params = {}) => new Promise((res) => { seq += 1; waiting.set(seq, res); ws.send(JSON.stringify({ id: seq, method, params })); });
const evaluate = async (expression) => { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); return r.result && r.result.result ? r.result.result.value : undefined; };
await send("Page.enable");

const measure = (panel, prefix, wantFilter, wantCards, wantCount) => `(async () => {
  const WANT_KIND = ${JSON.stringify(wantFilter)}, WANT_CARDS = ${wantCards};
  document.querySelector('[data-k="${panel}"][role=tab]').click();
  const P = document.getElementById('res-panel-${panel}');
  for (let i = 0; i < 60 && !P.querySelector(".fr-res-card"); i += 1) await new Promise((r) => setTimeout(r, 100));
  const grids = [...P.querySelectorAll(".fr-res-grid")];
  const out = { vw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth, cards: P.querySelectorAll(".fr-res-card").length, problems: [] };
  if (!grids.length) { out.problems.push("no grid"); return out; }
  let g = grids[0];
  // every article is drawn: all 493 unfiltered, and the whole set for each kind
  // grouped, a multi-kind essay is under each of its groups; the unique total stays 493
  if (out.cards !== WANT_CARDS) out.problems.push(out.cards + " cards, wanted " + WANT_CARDS);
  if (document.getElementById("${prefix}Count").textContent !== "${wantCount}") out.problems.push("the count says " + document.getElementById("${prefix}Count").textContent);
  const hrefs = [...P.querySelectorAll(".fr-res-section")].map((sec) => new Set([...sec.querySelectorAll(".fr-res-cardlink")].map((a) => a.href)).size === sec.querySelectorAll(".fr-res-cardlink").length);
  if (hrefs.includes(false)) out.problems.push("a group repeats an article");
  const counts = {};
  for (const [k, n] of Object.entries(WANT_KIND)) {
    document.querySelector('#${prefix}Filters [data-f="' + k + '"]').click();
    counts[k] = P.querySelectorAll(".fr-res-card").length;
    if (counts[k] !== n) out.problems.push(k + " shows " + counts[k] + " cards, wanted " + n);
    const flat = [...P.querySelectorAll(".fr-res-cardlink")].map((a) => a.href);
    if (new Set(flat).size !== flat.length) out.problems.push("the " + k + " filter repeats an article");
  }
  document.querySelector('#${prefix}Filters [data-f=""]').click();
  // a full render, timed: script work from the click to the DOM being built
  const t0 = performance.now();
  document.querySelector('#${prefix}Filters [data-f="' + Object.keys(WANT_KIND)[0] + '"]').click();
  document.querySelector('#${prefix}Filters [data-f=""]').click();
  out.renderMs = (performance.now() - t0) / 2;
  g = P.querySelector(".fr-res-grid");
  // nothing on a card is clipped: no line-clamp or ellipsis, and every text line holds its own text
  for (const el of P.querySelectorAll(".fr-res-card .fr-res-ctitle, .fr-res-card .fr-res-cmeta, .fr-res-card .fr-res-cwhy, .fr-res-card .fr-res-ckind, .fr-res-card .fr-res-cmore")) {
    const cs = getComputedStyle(el);
    if (cs.textOverflow === "ellipsis" || (cs.webkitLineClamp && cs.webkitLineClamp !== "none") || cs.maxHeight !== "none") { out.problems.push("clipping style on " + el.className); break; }
    if (el.scrollHeight > el.clientHeight + 1) { out.problems.push("clipped text in " + el.className); break; }
  }
  const img = P.querySelector(".fr-res-img");
  out.radius = img ? getComputedStyle(img).borderTopLeftRadius : "";
  out.whyMissing = [...P.querySelectorAll(".fr-res-card")].filter((c) => !c.querySelector(".fr-res-cwhy") || !c.querySelector(".fr-res-cwhy").textContent.trim()).length;
  out.cols = getComputedStyle(g).gridTemplateColumns.split(" ").length;
  const cards = [...g.querySelectorAll(".fr-res-card")].map((c) => c.getBoundingClientRect());
  const ws = cards.map((r) => r.width);
  out.spread = Math.max(...ws) - Math.min(...ws);
  const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  const first = cards.slice(0, 60);
  for (let i = 0; i < first.length; i += 1) for (let j = i + 1; j < first.length; j += 1) if (hit(first[i], first[j])) out.problems.push("cards " + i + " and " + j + " overlap");
  out.left = cards[0].left; out.right = out.vw - Math.max(...cards.map((r) => r.right));
  const h1 = document.querySelector(".bhero h1");
  out.heroLeft = h1 ? h1.getBoundingClientRect().left : -1;
  out.tabLeft = document.querySelector(".fr-res-tab").getBoundingClientRect().left;
  for (const c of P.querySelectorAll(".fr-res-card")) {
    const a = c.querySelector("a.fr-res-cardlink");
    if (!a) { out.problems.push("a card without a link"); continue; }
    if (!a.querySelector("img.fr-res-photo, .fr-res-ph")) out.problems.push("a card with no image or placeholder");
  }
  for (const a of [...P.querySelectorAll(".fr-res-cardlink")].slice(0, 60)) {
    const parts = [...a.querySelectorAll(".fr-res-ctitle, .fr-res-cmeta, .fr-res-cwhy, .fr-res-ckind")].map((e) => e.getBoundingClientRect());
    for (let i = 0; i < parts.length; i += 1) for (let j = i + 1; j < parts.length; j += 1) if (hit(parts[i], parts[j])) out.problems.push("text lines overlap in a card");
  }
  return out;
})()`;

const WANT = { 1920: 4, 1440: 4, 1280: 4, 1024: 4, 768: 2, 375: 1 };
let failed = 0;
await send("Page.navigate", { url: `${base}/h` });
await new Promise((res) => setTimeout(res, 800));
const judge = (m, cols) => {
  const bad = [];
  if (!m || m.problems === undefined) return ["the page did not measure"];
  if (m.renderMs > 150) bad.push(`a full render took ${m.renderMs.toFixed(0)} ms, over 150`);
  if (m.radius !== "8px") bad.push(`image corners are ${m.radius}, wanted 8px`);
  if (m.whyMissing) bad.push(`${m.whyMissing} cards have no why line`);
  if (m.cols !== cols) bad.push(`${m.cols} columns, wanted ${cols}`);
  if (m.sw > m.vw) bad.push(`page is ${m.sw}px wide in a ${m.vw}px window`);
  if (m.spread > 1) bad.push(`tiles differ in width by ${m.spread.toFixed(2)}px`);
  // The theme's .container: 1180px wide at most, 28px side padding, centered. Hero, tab, search and grid share its edges.
  const edge = (m.vw - Math.min(m.vw, 1180)) / 2 + 28;
  for (const [name, v] of [["grid left", m.left], ["grid right", m.right], ["hero", m.heroLeft], ["tab", m.tabLeft]]) {
    if (Math.abs(v - edge) > 1) bad.push(`${name} edge is ${v.toFixed(1)}px, the container's is ${edge}px`);
  }
  bad.push(...new Set(m.problems));
  return bad;
};
for (const [w, cols] of Object.entries(WANT)) {
  await send("Emulation.setDeviceMetricsOverride", { width: Number(w), height: 900, deviceScaleFactor: 1, mobile: false });
  await new Promise((res) => setTimeout(res, 300));
  const m = await evaluate(measure("articles", "res", WANT_KIND, WANT_CARDS, "493 articles"));
  const pm = await evaluate(measure("podcasts", "pod", WANT_SHOW, WANT_POD_CARDS, `${PODS.length} episodes`));
  const bad = [...judge(m, cols).map((x) => `articles: ${x}`), ...judge(pm, cols).map((x) => `podcasts: ${x}`)];
  if (bad.length) { failed += 1; console.error(`FAIL ${w}px: ${bad.join("; ")}`); } else console.log(`ok   ${w}px: ${cols} columns, ${m.cards} article cards (${m.renderMs.toFixed(0)} ms), ${pm.cards} episode cards`);
}
cleanup();
if (failed) process.exit(1);
console.log("\nresources grid: all widths pass");
