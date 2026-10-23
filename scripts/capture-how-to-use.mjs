#!/usr/bin/env node
/*
 * Regenerates the screenshots on /the-faith-received/how-to-use/ from the live site.
 *
 *   node scripts/capture-how-to-use.mjs              every shot
 *   node scripts/capture-how-to-use.mjs laity-topics  one or more shots by id
 *   node scripts/capture-how-to-use.mjs --base=http://localhost:2368   another origin
 *   node scripts/capture-how-to-use.mjs --png        also keep PNGs in $TMPDIR/how-to-use (for review)
 *
 * Needs Google Chrome (CHROME_BIN overrides the macOS default) and Node 22+ (global WebSocket). No npm packages.
 * Signed-out, light mode, 1440x900 at device scale 1. Each shot is cropped to a 16:10 box of its own width
 * and written as 1200x750 WebP under assets/images/faith-received/how-to-use/, at the highest quality that
 * stays under MAX_BYTES. Fixed elements (the feedback tab) are always hidden; sticky ones (the masthead and
 * the rail) are hidden unless a shot sets sticky: true.
 *
 * Blocks that need a signed-in account have no screenshot yet (laity-ask, laity-bookmarks, laity-notebook, pastors-ask,
 * pastors-compare, pastors-notebook, pastors-desk, academics-power-search, academics-compare, academics-connections,
 * academics-notebook, academics-desk, academics-ask). Capture each by hand while signed in, keep the account menu, name and
 * saved items out of frame, save it here as <block id>.webp (1200x750) and add an <figure class="ht-fig"> to its block.
 *
 * Add a shot: append to SHOTS. url is relative to the base. prep is a JS expression run after load (click,
 * type, scroll). vh is the viewport height (default 900). inView captures only what the viewport shows (for panes sized to the viewport). wait is the milliseconds to let the page settle (default 9000). scroll is the page's scrollY before the crop. clip is {x, y, w} in viewport pixels after
 * the scroll; the height is w * 0.625.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const OUT = path.join(import.meta.dirname, "..", "assets", "images", "faith-received", "how-to-use");
const MAX_BYTES = 140 * 1024;
const OUT_W = 1200;
const OUT_H = 750;

// Types a word into the Resources article search.
const SEARCH = (q) => `(() => { const i = document.querySelector('.fr-res input'); i.value = ${JSON.stringify(q)}; i.dispatchEvent(new Event('input', { bubbles: true })); })()`;

const SHOTS = [
  // Laity
  { id: "laity-reader", url: "/the-faith-received/read/?w=calvin-institutes-of-the-christian-religion&p=6", clip: { x: 0, y: 133, w: 1440 }, sticky: true },
  { id: "laity-creeds", url: "/the-faith-received/read/?w=nicene-creed", clip: { x: 0, y: 133, w: 1440 }, sticky: true },
  { id: "laity-scripture", url: "/the-faith-received/scripture/?ref=romans.8.1", scroll: 495, clip: { x: 40, y: 0, w: 1360 } },
  { id: "laity-guides", url: "/the-faith-received/guide/", scroll: 480, clip: { x: 80, y: 0, w: 1280 } },
  { id: "laity-lexicon", url: "/the-faith-received/lexicon/#grace", scroll: 330, clip: { x: 100, y: 0, w: 1240 } },
  { id: "laity-resources", url: "/the-faith-received/resources/", scroll: 540, clip: { x: 120, y: 0, w: 1200 }, prep: SEARCH("Nicene") },
  // Pastors
  { id: "pastors-scripture", url: "/the-faith-received/scripture/?ref=john.1.1", scroll: 495, clip: { x: 40, y: 0, w: 1360 } },
  { id: "pastors-verse-desk", url: "/the-faith-received/scripture/desk/?ref=romans.3.28", scroll: 530, clip: { x: 80, y: 0, w: 1280 } },
  { id: "pastors-lexicon", url: "/the-faith-received/lexicon/#fides", scroll: 330, clip: { x: 100, y: 0, w: 1240 } },
  { id: "pastors-decks", url: "/the-faith-received/commentary-decks/", scroll: 330, wait: 15000, inView: true, sticky: true, vh: 1000, clip: { x: 0, y: 45, w: 1440 } },
  { id: "pastors-repentance", url: "/the-faith-received/topics/?t=repentance", scroll: 520, clip: { x: 80, y: 0, w: 1280 } },
  { id: "pastors-traditions", url: "/the-faith-received/tradition/", scroll: 520, clip: { x: 120, y: 0, w: 1200 } },
  // Academics
  { id: "academics-lexicon", url: "/the-faith-received/lexicon/?q=fides", scroll: 330, clip: { x: 100, y: 0, w: 1240 } },
  { id: "academics-disputed", url: "/the-faith-received/disputed-questions/", scroll: 520, clip: { x: 120, y: 0, w: 1200 } },
  { id: "academics-set-index", url: "/the-faith-received/set-index/?set=luther-wa", scroll: 360, clip: { x: 120, y: 0, w: 1200 } },
  { id: "academics-scans", url: "/the-faith-received/read/?w=pg-2880&p=95", wait: 12000, sticky: true, inView: true, vh: 1100, clip: { x: 0, y: 133, w: 1440 },
    prep: "(async () => { document.getElementById('rdTools').click(); await new Promise((r) => setTimeout(r, 600)); document.getElementById('m-study').click(); await new Promise((r) => setTimeout(r, 4000)); })()" },
    prep: "[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Both').click()" },
];

const args = process.argv.slice(2);
const base = (args.find((a) => a.startsWith("--base=")) || "--base=https://mereorthodoxy.com").slice(7);
const keepPng = args.includes("--png");
const ids = args.filter((a) => !a.startsWith("--"));
const todo = ids.length ? SHOTS.filter((s) => ids.includes(s.id)) : SHOTS;
if (!todo.length) { console.error("no matching shot ids"); process.exit(1); }

const chromeBin = process.env.CHROME_BIN || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const profile = mkdtempSync(path.join(tmpdir(), "how-to-use-"));
const chrome = spawn(chromeBin, ["--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars", `--user-data-dir=${profile}`, "--remote-debugging-port=0", "about:blank"], { stdio: "ignore" });
let port = 0;
for (let i = 0; i < 100 && !port; i += 1) {
  await new Promise((r) => setTimeout(r, 150));
  const f = path.join(profile, "DevToolsActivePort");
  if (existsSync(f)) port = Number(readFileSync(f, "utf8").split("\n")[0]);
}
if (!port) { chrome.kill(); console.error("Chrome did not start"); process.exit(1); }
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0;
const waiting = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && waiting.has(d.id)) { waiting.get(d.id)(d); waiting.delete(d.id); } };
const send = (method, params = {}) => new Promise((res) => { seq += 1; waiting.set(seq, res); ws.send(JSON.stringify({ id: seq, method, params })); });
const ev = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
mkdirSync(OUT, { recursive: true });
const pngDir = path.join(tmpdir(), "how-to-use");
if (keepPng) mkdirSync(pngDir, { recursive: true });

for (const shot of todo) {
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: shot.vh || 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: base + shot.url });
  await wait(shot.wait || 9000);
  await ev(`localStorage.setItem("fr_sd_theme","light"); document.documentElement.setAttribute("data-sd-theme","light")`);
  if (shot.prep) { await ev(shot.prep); await wait(1500); }
  await ev(`window.scrollTo(0, ${shot.scroll || 0})`);
  await wait(700);
  await ev(`(() => { for (const el of document.querySelectorAll("body *")) { const p = getComputedStyle(el).position; if (p === "fixed" || (${shot.sticky ? "false" : "true"} && p === "sticky")) el.style.visibility = "hidden"; } })()`);
  await wait(300);
  const { x, w } = shot.clip;
  const y = shot.clip.y + (await ev("window.scrollY"));
  const h = w * 0.625;
  const scale = OUT_W / w;
  let webp;
  let png;
  for (const quality of [92, 85, 78, 70, 62, 55, 48]) {
    const r = await send("Page.captureScreenshot", { format: "webp", quality, captureBeyondViewport: !shot.inView, clip: { x, y, width: w, height: h, scale } });
    webp = Buffer.from(r.result.data, "base64");
    if (webp.length <= MAX_BYTES) break;
  }
  if (keepPng) png = Buffer.from((await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x, y, width: w, height: h, scale } })).result.data, "base64");
  writeFileSync(path.join(OUT, `${shot.id}.webp`), webp);
  if (png) writeFileSync(path.join(pngDir, `${shot.id}.png`), png);
  console.log(`${shot.id}: ${OUT_W}x${OUT_H} ${(webp.length / 1024).toFixed(0)} KB`);
}
chrome.kill();
await wait(800);
try { rmSync(profile, { recursive: true, force: true, maxRetries: 3 }); } catch { /* the profile is in the temp folder */ }
process.exit(0);
