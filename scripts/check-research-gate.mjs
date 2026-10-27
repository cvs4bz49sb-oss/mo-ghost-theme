#!/usr/bin/env node
/*
 * Real-Chrome check of the Research freewall (Ian, 2026-10-24). A fresh browser context with no cookies (a signed-out reader) loads
 * every Research tool address and asserts, for each:
 *   - the subscribe modal opens on arrival (the page was reached by address, not by a click);
 *   - no request went to the library workers or to a /v1/ data path: the page did not fetch tool data;
 *   - closing the modal leaves the quiet "Free account required" state: a hollow "Create a free account" button and a "Sign in" link;
 *   - there is no horizontal scroll at 375px.
 * It then loads the open surfaces (Dictionary, Guides, ...) and asserts they answer 200 with no modal, and opens the
 * reader and asserts the Scan button shows the modal while the text stays on the page.
 * Signed-in behavior is verified by hand, in a signed-in pane: this script never signs in and never types credentials.
 *
 * Run: npm run check:research-gate [-- --base https://mereorthodoxy.com] [--chrome <path>]
 * Needs puppeteer-core (not a dependency of the theme: npm i --no-save puppeteer-core) and a Chrome. Skips, and passes, without them.
 */
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const BASE = arg("--base", "https://mereorthodoxy.com").replace(/\/$/, "");
const CHROME = arg("--chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
let puppeteer;
try { puppeteer = createRequire(import.meta.url)("puppeteer-core"); } catch (_) { console.log("skip  check-research-gate: puppeteer-core is not installed (npm i --no-save puppeteer-core)"); process.exit(0); }
if (!existsSync(CHROME)) { console.log(`skip  check-research-gate: no Chrome at ${CHROME}`); process.exit(0); }

const reg = JSON.parse(readFileSync(join(ROOT, "scripts/data/research-tools.json"), "utf8"));
const toolUrls = [...new Set([reg.research.url, ...reg.tools.map((t) => t.href.split("#")[0]), "/the-faith-received/research/#compare", "/the-faith-received/research/#bookmarks", "/the-faith-received/research/#notebook", "/the-faith-received/research/#desk", "/the-faith-received/commentary-decks/#summa", "/the-faith-received/lexicon/#grace", "/the-faith-received/set-index/?set=luther-wa"])];
const DATA = /(workers\.dev|\/v1\/)/;
/* What every TFR page loads for the shell, tool or not: the small catalogue files (names, groupings, the title index) and the page-view
   beacon. None is a tool's data, so none is a leak. */
const SHELL = /(\/v1\/(dupfold|workgroups|author_aliases|works-index|editions)\.json|mo-tfr-events\.|mo-admin\.)/;
let failed = 0;
const ok = (c, m) => { if (!c) { failed += 1; console.error(`FAIL  ${m}`); } else console.log(`ok    ${m}`); };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
async function visit(path, width = 1280) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width, height: 900 });
  const reqs = [];
  page.on("request", (r) => { const u = r.url(); if (DATA.test(u) && !SHELL.test(u) && !u.startsWith(BASE + "/assets/")) reqs.push(u); });
  const res = await page.goto(BASE + path, { waitUntil: "networkidle2", timeout: 60000 }).catch(() => null);
  await new Promise((r) => setTimeout(r, 900));
  return { ctx, page, reqs, status: res ? res.status() : 0 };
}

for (const path of toolUrls) {
  const { ctx, page, reqs, status } = await visit(path);
  ok(status === 200, `${path} answers 200 signed out`);
  ok(await page.evaluate(() => !!document.querySelector(".feature-gate-modal")), `${path} opens the subscribe modal on arrival`);
  ok(reqs.length === 0, `${path} made no tool-data requests${reqs.length ? ` (${reqs.slice(0, 3).join(", ")})` : ""}`);
  await page.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 400));
  const quiet = await page.evaluate(() => ({
    modal: !!document.querySelector(".feature-gate-modal"),
    title: [...document.querySelectorAll("h2")].some((h) => /Free account required/.test(h.textContent)),
    btn: [...document.querySelectorAll("button")].some((b) => /Create a free account/.test(b.textContent)),
    signin: [...document.querySelectorAll("a")].some((a) => /^Sign in$/.test(a.textContent.trim()) && a.hasAttribute("data-portal")),
  }));
  ok(!quiet.modal && quiet.title && quiet.btn && quiet.signin, `${path} leaves the quiet "Free account required" state once the modal closes`);
  await ctx.close();
}
{
  const { ctx, page } = await visit("/the-faith-received/research/", 375);
  const w = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
  ok(w.s <= w.c, `the Research page has no horizontal scroll at 375px (${w.s}/${w.c})`);
  await ctx.close();
}
for (const path of reg.accountSurfaces || []) {
  for (const width of [375, 820, 1280]) {
    const { ctx, page, status } = await visit(path, width);
    ok(status === 200, `${path} answers 200 at ${width}px`);
    const state = await page.evaluate(() => ({
      gate: !!document.querySelector('[data-tfr-account-gate][role="dialog"][aria-modal="true"]'),
      background: !!document.querySelector("main"),
      required: document.querySelectorAll("[data-tfr-account-gate] input[required]").length,
      signin: !!document.querySelector('[data-tfr-account-gate] [data-portal="signin"]'),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    ok(state.gate && state.background && state.required === 3 && state.signin, `${path} shows a free account dialog over the page`);
    ok(!state.overflow, `${path} has no horizontal overflow at ${width}px`);
    await page.keyboard.press("Escape");
    ok(await page.evaluate(() => !!document.querySelector("[data-tfr-account-gate]")), `${path} cannot dismiss the gate with Escape`);
    await ctx.close();
  }
}
for (const path of reg.open) {
  const { ctx, page, status } = await visit(path);
  ok(status === 200, `${path} (open) answers 200`);
  ok(await page.evaluate(() => !document.querySelector(".feature-gate-modal") && !document.querySelector("[data-gate-on-arrival]") && !document.querySelector("[data-tfr-account-gate]")), `${path} (open) shows no gate`);
  await ctx.close();
}
{
  /* The reader text is open; the Scan pane is not. pg-2880 has page scans. */
  const { ctx, page } = await visit("/the-faith-received/read/?w=pg-2880&p=95");
  const text = await page.evaluate(() => (document.body.innerText || "").length);
  ok(text > 2000, `the reader text stays open signed out (${text} characters)`);
  const clicked = await page.evaluate(() => { const b = document.querySelector('#m-study, [data-t="study"]'); if (!b) return false; b.click(); return true; });
  await new Promise((r) => setTimeout(r, 700));
  if (clicked) ok(await page.evaluate(() => !!document.querySelector(".feature-gate-modal")) && await page.evaluate(() => !(window.LN && window.LN.fx)), "the reader's Scan button shows the modal and leaves the scan pane closed");
  else console.log("skip  the reader's Scan button was not found on this build");
  await ctx.close();
}
await browser.close();
if (failed) { console.error(`\n${failed} check(s) failed.`); process.exit(1); }
console.log("\nThe Research freewall holds signed out.");
