#!/usr/bin/env node
/*
 * Header colour check for the TFR reader, in real Chrome (an installed Chrome driven over its DevTools socket, no packages).
 *
 * The reader's top bar (.ph.fr-reader-head) once turned white for a reader set to Light on a dark-OS machine, because a rule
 * was keyed to the OS (prefers-color-scheme) instead of the reader's own data-theme. A second path did the same on every
 * dark-OS visit: the article dark-mode script rewrote data-theme to "dark" after the reader had set the saved Light or Sepia.
 * This drives the reader through every viewport x OS scheme x reader theme x state that matters and asserts, from computed styles:
 *   - html[data-theme] is the theme the reader was told to use (the OS never overrides it);
 *   - the bar is the reader's tan, rgb(245, 239, 225), in Light and Sepia, and its dark surface, rgb(43, 44, 41), in Dark;
 *   - no bar, wrapper or sub-bar in the header is white (#fffdfa / #fff, any channel >= 250) in Light or Sepia;
 *   - the bar and the site rail are not left behind when the phone header hides (they move together);
 *   - the Aa and Tools popovers, the contents sidebar and the ask-source reader state keep the theme's own tokens.
 *
 *   node scripts/check-reader-header-color.mjs [baseUrl] [--local] [--quick] [--verbose]
 * baseUrl defaults to https://mereorthodoxy.com. --width=N runs one viewport. --local serves /assets/* from this checkout instead of the site (pre-merge check
 * of an unpushed change). --quick runs 375 and 1440 only. Needs network and Chrome (CHROME env or the macOS default path).
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.argv.find((a) => /^https?:/.test(a)) || "https://mereorthodoxy.com").replace(/\/$/, "");
const LOCAL = process.argv.includes("--local");
const QUICK = process.argv.includes("--quick");
const VERBOSE = process.argv.includes("--verbose");
const WIDTH = Number((process.argv.find((a) => a.startsWith("--width=")) || "").slice(8)) || 0;
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

const VIEWPORTS = [
  ["iPhone 375", 375, 812, true],
  ["small phone 360", 360, 740, true],
  ["large phone 430", 430, 932, true],
  ["iPad portrait 768", 768, 1024, true],
  ["iPad landscape 1024", 1024, 768, true],
  ["laptop 1440", 1440, 900, false],
].filter(([, w]) => (WIDTH ? w === WIDTH : !QUICK || w === 375 || w === 1440));
const OS = ["dark", "light"];
const THEMES = ["light", "sepia", "dark"];
// A creed, and a Patrologia Latina work (Boethius, On the Person and the Two Natures: Migne PL 64) with its volume strip.
const WORKS = ["the-faith-received/read/?w=nicene-creed", "the-faith-received/read/?w=pld-3284"];
// One page load walks the scroll states in order; a second walks the open-panel states (the ask-source class stays on, then each panel opens on top of it).
const WALKS = [["top", "scrolled", "scrolled-up", "hidden"], ["ask-source", "aa-open", "tools-open", "contents-open"]];

const TAN = "rgb(245, 239, 225)";
const DARK = "rgb(43, 44, 41)";

const probe = (theme, expectedTan, expectedDark) => {
  const parse = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return null; const p = m[1].split(",").map((x) => parseFloat(x)); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const white = (c) => { const p = parse(c); return !!p && p.a > 0.5 && p.r >= 250 && p.g >= 250 && p.b >= 250; };
  const vis = (e) => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.display !== "none" && c.visibility !== "hidden"; };
  const nm = (e) => `${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ""}${e.classList.length ? `.${e.classList[0]}` : ""}`;
  const out = { problems: [], info: {} };
  const html = document.documentElement;
  out.info.dataTheme = html.getAttribute("data-theme");
  const want = theme === "light" ? ["light", null] : [theme];
  if (!want.includes(out.info.dataTheme)) out.problems.push(`data-theme is ${out.info.dataTheme}, the reader was set to ${theme}`);
  const head = document.querySelector(".ph.fr-reader-head");
  if (!head) { out.problems.push("no .ph.fr-reader-head"); return out; }
  const hs = getComputedStyle(head);
  out.info.head = hs.backgroundColor;
  out.info.headRect = (({ top, bottom }) => ({ top: Math.round(top), bottom: Math.round(bottom) }))(head.getBoundingClientRect());
  out.info.headClass = head.className;
  const rail = document.querySelector(".tfr-rail");
  out.info.rail = rail ? getComputedStyle(rail).backgroundColor : null;
  out.info.railRect = rail ? (({ top, bottom }) => ({ top: Math.round(top), bottom: Math.round(bottom) }))(rail.getBoundingClientRect()) : null;
  const site = document.querySelector("header.site-header");
  out.info.site = site ? getComputedStyle(site).backgroundColor : null;
  if (vis(head)) {
    const exp = theme === "dark" ? expectedDark : expectedTan;
    if (hs.backgroundColor !== exp) out.problems.push(`.ph.fr-reader-head is ${hs.backgroundColor}, wanted ${exp}`);
    if (theme !== "dark" && white(hs.backgroundColor)) out.problems.push(".ph.fr-reader-head is white");
    // Wrappers and sub-bars inside the bar paint nothing white over it in Light/Sepia.
    if (theme !== "dark") {
      head.querySelectorAll(".phl, .ctr, .reader-identity, .reader-reference, .mh-home, .sub, .ploc, .rdtw, .aaw").forEach((e) => {
        if (vis(e) && white(getComputedStyle(e).backgroundColor)) out.problems.push(`${nm(e)} inside the bar is white`);
      });
    }
  }
  // Anything pinned across the top of the viewport (rail, sub-bars, a second row) that is white where it should be tan.
  if (theme !== "dark") {
    document.querySelectorAll("body *").forEach((e) => {
      if (e === head || head.contains(e) || !vis(e)) return;
      const c = getComputedStyle(e);
      if (c.position !== "fixed" && c.position !== "sticky") return;
      const r = e.getBoundingClientRect();
      if (r.top > 220 || r.bottom < 0 || r.height > 140 || r.width < innerWidth * 0.6) return;
      if (e.matches("#aaPop, #rdToolsPop, #frToolsDrawer, .skiplink, [role=dialog], [role=menu]") || e.closest("#aaPop, #rdToolsPop, #frToolsDrawer, [role=dialog], .nav-dropdown-menu")) return;
      if (white(c.backgroundColor)) out.problems.push(`${nm(e)} (${c.position}, y ${Math.round(r.top)}-${Math.round(r.bottom)}) is ${c.backgroundColor}`);
    });
  }
  return out;
};

const profile = mkdtempSync(path.join(tmpdir(), "reader-header-color-"));
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run", `--user-data-dir=${profile}`, "--remote-debugging-port=0", "about:blank"], { stdio: "ignore" });
const cleanup = () => { try { chrome.kill("SIGKILL"); } catch (_) { /* gone */ } try { rmSync(profile, { recursive: true, force: true }); } catch (_) { /* busy */ } };
process.on("exit", cleanup);
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => process.exit(130));
let port = 0;
for (let i = 0; i < 100 && !port; i += 1) {
  await new Promise((r) => setTimeout(r, 150));
  const f = path.join(profile, "DevToolsActivePort");
  if (existsSync(f)) port = Number(readFileSync(f, "utf8").split("\n")[0]);
}
if (!port) { console.error("check-reader-header-color: Chrome did not start (set CHROME)"); process.exit(2); }
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0;
const waiting = new Map();
const MIME = { ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml" };
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && waiting.has(d.id)) { waiting.get(d.id)(d); waiting.delete(d.id); return; }
  if (d.method === "Fetch.requestPaused") {
    const { requestId, request } = d.params;
    const u = new URL(request.url);
    const file = path.join(ROOT, decodeURIComponent(u.pathname));
    if (u.origin === new URL(BASE).origin && file.startsWith(path.join(ROOT, "assets") + path.sep) && existsSync(file)) {
      send("Fetch.fulfillRequest", { requestId, responseCode: 200, responseHeaders: [{ name: "Content-Type", value: MIME[path.extname(file)] || "application/octet-stream" }, { name: "Cache-Control", value: "no-store" }], body: readFileSync(file).toString("base64") });
    } else send("Fetch.continueRequest", { requestId });
  }
};
const send = (method, params = {}) => new Promise((res) => { seq += 1; waiting.set(seq, res); ws.send(JSON.stringify({ id: seq, method, params })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  return r.result && r.result.result ? r.result.result.value : undefined;
};

await send("Page.enable");
if (LOCAL) await send("Fetch.enable", { patterns: [{ urlPattern: `${new URL(BASE).origin}/assets/*`, requestStage: "Request" }] });

const scroller = "(document.querySelector('#scroll')||document.scrollingElement)";
const enterState = async (state) => {
  switch (state) {
    case "top": return;
    case "scrolled": await ev(`(()=>{const s=${scroller};s.scrollTo(0,300);s.scrollTo(0,600);})()`); await sleep(700); return;
    case "scrolled-up": await ev(`(()=>{const s=${scroller};s.scrollTo(0,1200);})()`); await sleep(500); await ev(`(()=>{const s=${scroller};s.scrollTo(0,1100);s.scrollTo(0,900);s.scrollTo(0,700);s.scrollTo(0,500);})()`); await sleep(700); return;
    case "hidden": await ev(`(()=>{const s=${scroller};s.scrollTo(0,500);s.scrollTo(0,1000);s.scrollTo(0,1600);window.scrollTo(0,1600);})()`); await sleep(900); return;
    case "ask-source": await ev("document.documentElement.classList.add('fr-ask-source')"); await sleep(400); return;
    case "aa-open": await ev("document.querySelector('#aaBtn')&&document.querySelector('#aaBtn').click()"); await sleep(400); return;
    case "tools-open": await ev("document.querySelector('#rdTools')&&document.querySelector('#rdTools').click()"); await sleep(400); return;
    case "contents-open": await ev("document.querySelector('#sbT')&&document.querySelector('#sbT').click()"); await sleep(500); return;
    default:
  }
};

let failed = 0;
let runs = 0;
for (const [vname, w, h, mobile] of VIEWPORTS) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 2, mobile });
  await send("Emulation.setTouchEmulationEnabled", { enabled: mobile });
  await send("Emulation.setUserAgentOverride", { userAgent: mobile ? MOBILE_UA : "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36" });
  for (const os of OS) {
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: os }] });
    for (const theme of THEMES) {
      const hook = await send("Page.addScriptToEvaluateOnNewDocument", { source: `try{localStorage.setItem("fr_theme","${theme}")}catch(e){}` });
      for (const work of WORKS) {
        for (const walk of WALKS) {
          await send("Page.navigate", { url: `${BASE}/${work}&cb=${Date.now()}` });
          for (let i = 0; i < 40; i += 1) {
            await sleep(500);
            if (await ev("!!document.querySelector('.ph.fr-reader-head')&&!!document.querySelector('#scroll')&&document.readyState==='complete'")) break;
          }
          await sleep(1200);
          for (const state of walk) {
            await enterState(state);
            const res = await ev(`(${probe.toString()})(${JSON.stringify(theme)},${JSON.stringify(TAN)},${JSON.stringify(DARK)})`);
            runs += 1;
            const bad = !res ? ["probe failed"] : res.problems;
            // The bar and the rail move together: if one is off-screen, the other is too.
            if (res && res.info.headRect && res.info.railRect && state === "hidden" && mobile && w < 700) {
              const headGone = res.info.headRect.bottom <= 0;
              const railGone = res.info.railRect.bottom <= 0;
              if (headGone !== railGone) bad.push(`bar and rail hide separately (bar gone ${headGone}, rail gone ${railGone})`);
            }
            const tag = `${vname} ${work.split("w=")[1]} os:${os} theme:${theme} ${state}`;
            if (bad.length) failed += 1;
            if (bad.length || VERBOSE) console.log(`${bad.length ? "FAIL" : "ok  "} ${tag}${res ? ` [bar ${res.info.head} y${res.info.headRect.top}-${res.info.headRect.bottom}, rail ${res.info.rail} y${res.info.railRect ? `${res.info.railRect.top}-${res.info.railRect.bottom}` : "none"}, data-theme ${res.info.dataTheme}]` : ""}${bad.length ? `\n   - ${bad.join("\n   - ")}` : ""}`);
          }
        }
      }
      await send("Page.removeScriptToEvaluateOnNewDocument", { identifier: hook.result.identifier });
    }
  }
}
chrome.kill();
if (failed) { console.error(`check-reader-header-color: ${failed} of ${runs} runs failed`); process.exit(1); }
console.log(`check-reader-header-color: ok (${runs} runs)`);
