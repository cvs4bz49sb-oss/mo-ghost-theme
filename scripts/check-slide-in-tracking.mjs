#!/usr/bin/env node
/*
 * check-slide-in-tracking: the slide-in's measurement, run for real.
 *
 *   node scripts/check-slide-in-tracking.mjs
 *
 * Loads assets/js/slide-in.js and assets/js/lifetime-checkout.js into a
 * small fake page (no browser, no network) and checks the four things the
 * slide-in numbers on /admin/slide-ins/ depend on:
 *
 *   - a show, a button click and a close each send their own beacon;
 *   - the button's link to a page on this site carries ?slide-in=<id>,
 *     ahead of any #hash, and a link off the site is left alone;
 *   - an unsafe button URL still renders as "#", param or no param;
 *   - the Lifetime checkout passes the id from its page URL to the worker.
 *
 * How the id becomes a conversion is mo-workers'
 * membership/lib/slide-in-attribution.js.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const SLIDE_IN = read("assets/js/slide-in.js");
const SAFE_HREF = read("assets/js/lib/safe-href.js");
const LIFETIME = read("assets/js/lifetime-checkout.js");

const failures = [];
const need = (ok, msg) => { if (!ok) failures.push(msg); };

const SITE = "https://mereorthodoxy.com";
const WORKER = "https://mo-admin.test";

function makeEl(tag) {
  const attrs = {};
  const listeners = {};
  const el = {
    tagName: tag.toUpperCase(), children: [], style: {}, className: "", textContent: "", innerHTML: "",
    dataset: {}, disabled: false,
    classList: { add() {}, remove() {}, contains() { return false; } },
    setAttribute(k, v) { attrs[k] = String(v); },
    getAttribute(k) { return k in attrs ? attrs[k] : null; },
    appendChild(c) { el.children.push(c); return c; },
    remove() {},
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    fire(type, ev = {}) { for (const fn of listeners[type] || []) fn(ev); },
    find(pred) {
      if (pred(el)) return el;
      for (const c of el.children) { const hit = c.find && c.find(pred); if (hit) return hit; }
      return null;
    },
  };
  Object.defineProperty(el, "href", {
    get() { return attrs.href ? new URL(attrs.href, SITE + "/").href : ""; },
    set(v) { attrs.href = String(v); },
  });
  return el;
}

// One page load of slide-in.js with `items` as the worker's /slide-ins.
// Timers run immediately, so the slide-in renders and reports at once.
function runSlideIn(items, path = "/the-article/") {
  const beacons = [];
  const body = makeEl("body");
  body.className = "post-template";
  body.setAttribute("data-admin-worker-url", WORKER);
  const store = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
  const win = {
    location: new URL(path, SITE),
    matchMedia: () => ({ matches: false }),
    innerHeight: 800,
    addEventListener() {}, removeEventListener() {},
  };
  const ctx = {
    window: win, console: { error() {}, warn() {}, log() {} }, URL, URLSearchParams, JSON, Date, Math, parseInt, isNaN, String,
    setTimeout: (fn) => { fn(); return 0; },
    document: {
      body,
      documentElement: { scrollTop: 0, scrollHeight: 0, addEventListener() {}, removeEventListener() {} },
      createElement: makeEl,
      querySelector: () => null,
    },
    navigator: { sendBeacon: (url) => { beacons.push(url); return true; } },
    localStorage: store(), sessionStorage: store(),
    fetch: async () => ({ ok: true, json: async () => items }),
  };
  win.document = ctx.document;
  vm.createContext(ctx);
  vm.runInContext(SAFE_HREF, ctx);
  ctx.MOSafeHref = win.MOSafeHref;
  vm.runInContext(SLIDE_IN, ctx);
  return new Promise((resolve) => setImmediate(() => {
    const card = body.children[0] || null;
    resolve({
      beacons, card,
      button: card && card.find((e) => e.className && e.className.includes("slide-in-btn")),
      close: card && card.find((e) => e.className === "slide-in-close"),
    });
  }));
}

const base = { headline: "Support thoughtful Christian writing", button_text: "Become a Member", pages: "all", audience: "everyone", frequency: "weekly", priority: 1 };

// ---- beacons and the landing link
{
  const r = await runSlideIn([{ ...base, id: "abc-123", button_url: "/membership/" }]);
  need(!!r.card, "slide-in did not render");
  need(r.beacons.includes(`${WORKER}/slide-ins/abc-123/impression`), "no impression beacon on show");
  need(r.button && r.button.getAttribute("href") === "/membership/?slide-in=abc-123", `button link not tagged: ${r.button && r.button.getAttribute("href")}`);
  r.button.fire("click");
  need(r.beacons.includes(`${WORKER}/slide-ins/abc-123/click`), "no click beacon");
  r.close.fire("click");
  need(r.beacons.includes(`${WORKER}/slide-ins/abc-123/dismiss`), "no dismiss beacon on close");
  need(r.beacons.length === 3, `expected 3 beacons, got ${r.beacons.length}`);
}

// ---- the hash stays last
{
  const r = await runSlideIn([{ ...base, id: "life-1", button_url: "/membership/#lifetime-upgrade" }]);
  need(r.button.getAttribute("href") === "/membership/?slide-in=life-1#lifetime-upgrade", `hash link wrong: ${r.button.getAttribute("href")}`);
}

// ---- an existing query is kept, an absolute link to this site is tagged
{
  const r = await runSlideIn([{ ...base, id: "q-1", button_url: `${SITE}/membership/?plan=annual` }]);
  need(r.button.getAttribute("href") === "/membership/?plan=annual&slide-in=q-1", `query link wrong: ${r.button.getAttribute("href")}`);
}

// ---- off-site links are left exactly as entered
{
  const url = "https://www.bhpublishinggroup.com/product/the-lord-is-my-light/";
  const r = await runSlideIn([{ ...base, id: "off-1", button_url: url }]);
  need(r.button.getAttribute("href") === url, `off-site link changed: ${r.button.getAttribute("href")}`);
}

// ---- an unsafe URL is still refused
{
  const r = await runSlideIn([{ ...base, id: "bad-1", button_url: "javascript:alert(1)" }]);
  need(r.button.getAttribute("href") === "#", `unsafe link rendered: ${r.button.getAttribute("href")}`);
}

// ---- Lifetime checkout passes the id on
async function runLifetime(path) {
  const sent = [];
  const btn = makeEl("button");
  const ctx = {
    console: { warn() {}, error() {} }, URLSearchParams, JSON,
    window: {
      MO_API_BASE: "https://mo-membership.test",
      location: new URL(path, SITE),
      addEventListener() {},
      fetch: async (url, init) => { sent.push({ url, body: JSON.parse(init.body) }); return { ok: true, json: async () => ({ url: "https://checkout.stripe.com/x" }) }; },
      MOSafeRedirect: { go() {} },
      MOAuth: { fetch: async () => ({ ok: true, json: async () => ({}) }) },
    },
    document: { querySelectorAll: () => [btn], querySelector: () => null },
  };
  ctx.window.fetch.bind = () => ctx.window.fetch;
  vm.createContext(ctx);
  vm.runInContext(LIFETIME, ctx);
  btn.fire("click");
  await new Promise((r) => setImmediate(r));
  return sent;
}
{
  const sent = await runLifetime("/membership/?slide-in=life-1#lifetime-upgrade");
  need(sent.length === 1 && sent[0].body.slide_in === "life-1", `lifetime checkout did not pass the slide-in id: ${JSON.stringify(sent)}`);
  const plain = await runLifetime("/membership/");
  need(plain.length === 1 && !("slide_in" in plain[0].body), "lifetime checkout sent a slide_in with no slide-in in the URL");
}

if (failures.length) {
  console.error(`check-slide-in-tracking: ${failures.length} failure(s)`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("check-slide-in-tracking: ok");
