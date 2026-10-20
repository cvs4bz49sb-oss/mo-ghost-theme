#!/usr/bin/env node
/*
 * Layout check for the author page, in real Chrome (an installed Chrome driven over its DevTools socket, no packages), over a sample from EACH way an author is drawn:
 * a research room (?sh=<shelf>#<slug>) with a long bio, a short bio, a curated Start reading set, a portrait, and the page of an author
 * with no room (?a=<slug>) with a biography, with only works, and with one work. It fails on:
 *   - a vertical gap of more than 64px between consecutive visible blocks of the page, the About region, the library module or the pane;
 *   - a block whose left or right edge is off the page's content edge by more than 1px (the nav row, the bio column, the sidebar's right,
 *     the library module, the tabs, the Mere Orthodoxy module);
 *   - a fact printed twice (a Quick facts label repeated, or a hero tile that restates a sidebar row);
 *   - horizontal scroll;
 *   - the Mere Orthodoxy module not being the last block.
 *
 *   node scripts/check-author-layout.mjs [baseUrl] [--quick]       baseUrl defaults to https://mereorthodoxy.com
 * --quick runs 1440 and 375, light only. Needs network (the library worker) and Chrome (CHROME env or the macOS default path).
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const BASE = (process.argv.find((a) => /^https?:/.test(a)) || "https://mereorthodoxy.com").replace(/\/$/, "");
const QUICK = process.argv.includes("--quick");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SAMPLE = [
  ["room, long bio, portrait, curated set", "?sh=lu#philipp-melanchthon"],
  ["room, portrait, curated set", "?sh=lu#martin-luther"],
  ["room, short bio", "?sh=ed#james-ussher"],
  ["room, minor", "?sh=ed#isaac-ambrose"],
  ["room, Middle Ages", "?sh=md#bonaventure"],
  ["no room, biography", "?a=boethius"],
  ["no room, works only", "?a=jean-mabillon"],
  ["no room, one work", "?a=jonathan-edwards"],
];
const WIDTHS = QUICK ? [1440, 375] : [1440, 820, 375];
const THEMES = QUICK ? ["light"] : ["light", "dark"];

const probe = () => {
  const m = document.querySelector("main.research-room:has(> .rx-profile)");
  if (!m) return { error: "no room drawn" };
  const rect = (e) => e.getBoundingClientRect();
  const vis = (e) => { const r = rect(e); const c = getComputedStyle(e); return r.height > 0 && c.display !== "none" && c.visibility !== "hidden"; };
  const nm = (e) => `${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ""}.${String(e.className).split(" ")[0]}`;
  const problems = [];
  const scan = (box, label) => {
    const kids = Array.from(box.children).filter(vis).sort((a, b) => rect(a).top - rect(b).top);
    for (let i = 1; i < kids.length; i += 1) {
      const a = rect(kids[i - 1]);
      const b = rect(kids[i]);
      // The portrait beside the hero text can be taller than the text; the space it fills is not a hole.
      const por = m.querySelector(".ah-portrait");
      const pr = por && rect(por);
      if (pr && pr.bottom >= b.top - 24 && pr.top <= a.bottom) continue;
      if (b.top >= a.bottom - 1 && b.top - a.bottom > 64) problems.push(`${label}: ${Math.round(b.top - a.bottom)}px gap between ${nm(kids[i - 1])} and ${nm(kids[i])}`);
    }
  };
  scan(m, "page");
  [".ah-about", ".ah-about-more", "#rnNotes", "#pbody .view", "#frOwnBody .view"].forEach((s) => { const b = m.querySelector(s); if (b) scan(b, s); });
  const cs = getComputedStyle(m);
  const left = rect(m).left + parseFloat(cs.paddingLeft);
  const right = rect(m).right - parseFloat(cs.paddingRight);
  const edge = (sel, l, r) => {
    const e = m.querySelector(sel);
    if (!e || !vis(e)) return;
    const b = rect(e);
    if (l && Math.abs(b.left - left) > 1) problems.push(`${sel}: left edge ${Math.round(b.left)} is not the page edge ${Math.round(left)}`);
    if (r && Math.abs(b.right - right) > 1) problems.push(`${sel}: right edge ${Math.round(b.right)} is not the page edge ${Math.round(right)}`);
  };
  edge(".ah-jump", true, true);
  edge(".ah-main", true, false);
  edge(".ah-facts", false, true);
  edge("#rnNotes", true, true);
  edge("#ah-room", true, true);
  edge(".moa-host", true, true);
  const labels = Array.from(m.querySelectorAll(".ah-facts dt")).map((d) => d.textContent.trim().toLowerCase());
  labels.forEach((l, i) => { if (labels.indexOf(l) !== i) problems.push(`Quick facts prints "${l}" twice`); });
  if (labels.length) {
    const tiles = Array.from(m.querySelectorAll(".rx-profile .ar-stat")).filter(vis);
    if (tiles.length) problems.push(`${tiles.length} hero tile(s) still shown beside Quick facts`);
  }
  const last = m.lastElementChild;
  const moa = m.querySelector(".moa-host");
  if (moa && last !== moa) problems.push("the Mere Orthodoxy module is not the last block");
  if (document.documentElement.scrollWidth > innerWidth) problems.push(`horizontal scroll: ${document.documentElement.scrollWidth} > ${innerWidth}`);
  return { problems, hasAbout: !!m.querySelector(".ah-about"), mono: !!m.querySelector(".ah-portrait .tfr-por:not(:has(img))") };
};

const profile = mkdtempSync(path.join(tmpdir(), "author-layout-"));
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-web-security", `--user-data-dir=${profile}`, "--remote-debugging-port=0", "about:blank"], { stdio: "ignore" });
let port = 0;
for (let i = 0; i < 100 && !port; i += 1) {
  await new Promise((r) => setTimeout(r, 150));
  const f = path.join(profile, "DevToolsActivePort");
  if (existsSync(f)) port = Number(readFileSync(f, "utf8").split("\n")[0]);
}
if (!port) { console.error("check-author-layout: Chrome did not start (set CHROME)"); process.exit(2); }
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0;
const waiting = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && waiting.has(d.id)) { waiting.get(d.id)(d); waiting.delete(d.id); } };
const send = (method, params = {}) => new Promise((res) => { seq += 1; waiting.set(seq, res); ws.send(JSON.stringify({ id: seq, method, params })); });
const run = async () => {
  const r = await send("Runtime.evaluate", { expression: `(${probe.toString()})()`, returnByValue: true });
  return r.result && r.result.result && r.result.result.value ? r.result.result.value : { error: "evaluate failed" };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Page.enable");
let failed = 0;
for (const [label, query] of SAMPLE) {
  for (const w of WIDTHS) {
    for (const theme of THEMES) {
      await send("Page.addScriptToEvaluateOnNewDocument", { source: `try{localStorage.setItem("fr_sd_theme","${theme}")}catch(e){}` });
      await send("Emulation.setDeviceMetricsOverride", { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 700 });
      await send("Page.navigate", { url: `${BASE}/the-faith-received/author/${query}` });
      let res = null;
      for (let i = 0; i < 40; i += 1) {
        await sleep(750);
        res = await run();
        if (res && !res.error && res.hasAbout) break;
      }
      await sleep(600);
      res = await run();
      const bad = res.error ? [res.error] : res.problems;
      console.log(`${bad.length ? "FAIL" : "ok  "} ${label} ${query} ${w} ${theme}${bad.length ? `\n   - ${bad.join("\n   - ")}` : ""}`);
      if (bad.length) failed += 1;
    }
  }
}
chrome.kill();
if (failed) { console.error(`check-author-layout: ${failed} failure(s)`); process.exit(1); }
console.log("check-author-layout: ok");
