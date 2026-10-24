/*
 * The free-account prompt on Scripture and Topics (tfr-trial-prompt.js), checked as a browser runs it.
 *
 *   A. STATIC (always runs): the constants, no innerHTML, copy that survives the deslop rules, the templates wire the
 *      files in the right order, and the templates' source holds no prompt text (the card is added by script only).
 *   B. IN CHROME (skips, and passes, without puppeteer-core or a Chrome): every scenario in a fresh browser context,
 *      so nothing of anyone's own account is touched. The pages are the real templates' markup (handlebars stripped),
 *      the real stylesheets, the real counter, prompt and site.min.js (feature gate + sign-up form), served by request
 *      interception at the real address. Plausible and the Ghost sign-up endpoints are stubbed and recorded, so no
 *      event leaves the machine and no email is sent.
 *        prompt arm: no card on uses 1-3, a card on use 4 with the right events; "Not now" hides and persists;
 *          snooze for SNOOZE_DAYS (storage backdated, which is what elapsed time does); at most MAX_SHOWS shows;
 *          nothing already in view moves; 44px targets; live region; no console errors
 *        control arm: never a card, one would_show at use 4
 *        signed in (free, paid), crawler user agents, other pages: nothing, and nothing stored
 *        the button opens the sign-up dialog, the form carries source:feature-gate:tfr-trial-prompt, and an accepted
 *          sign-up sends "TFR Prompt Signup"
 *        light and dark, 320 / 375 / 820 / 1280 wide: AA contrast, no sideways scroll
 *
 *   node scripts/check-trial-prompt.mjs        (npm run check:trial-prompt)
 * Chrome: $CHROME_PATH, else /Applications/Google Chrome.app. puppeteer-core: the theme's node_modules, else
 * $PUPPETEER_CORE (a path to the package). Screenshots go to $TRIAL_PROMPT_SHOTS when it is set.
 */
import { createRequire } from "node:module";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (f) => readFileSync(path.join(root, f), "utf8");
let failed = 0;
const ok = (c, m) => { if (!c) { failed += 1; console.error(`FAIL  ${m}`); } else console.log(`ok    ${m}`); };

/* ---------------------------------------------------------------- A. static */
const JS = read("assets/js/page/tfr-trial-prompt.js");
const CSS = read("assets/css/tfr-trial-prompt.css");
const COUNTER = read("assets/js/page/tfr-use-counter.js");
const GATE = read("assets/js/feature-gate.js");
const TEMPLATES = ["custom-scripture-dev.hbs", "custom-faith-topics-dev.hbs"];
const code = JS.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

ok(/const FREE_USES = 3;/.test(JS) && /const SNOOZE_DAYS = 7;/.test(JS) && /const MAX_SHOWS = 3;/.test(JS), "thresholds are constants: FREE_USES 3, SNOOZE_DAYS 7, MAX_SHOWS 3");
ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/.test(code), "no HTML-from-string, eval or document.write in the prompt script");
ok(!/—/.test(JS + CSS) && !/—/.test(COUNTER.split("*/")[0]), "no em dash in the prompt files or the counter's header");
const copy = (JS.match(/const COPY = \{[\s\S]*?\};/) || [""])[0];
ok(copy && !/unlock|hurry|limited|last chance|only \d|exclusive|you were right|great|just /i.test(copy), "copy has no pressure, scarcity or praise");
ok(/Create a free account/.test(copy) && /Not now/.test(copy), "the button and the dismiss say what they do");
ok(/"tfr-trial-prompt": \{\s*requires: "subscriber"/.test(GATE), "feature-gate.js has the tfr-trial-prompt entry at the free-account tier");
ok(/mo:tfr-use/.test(COUNTER) && /mo:tfr-use/.test(JS), "the counter announces each use and the prompt listens");
ok(/window\.plausible\("TFR Tool Use", \{ props: \{ tool, n: String\(n\), who \} \}\)/.test(COUNTER), "the counter's own Plausible event is unchanged");
ok(!/prefers-color-scheme/.test(CSS) && /html\[data-sd-theme="dark"\]/.test(CSS), "dark keys on the page's own switch, never the system setting");
ok(!/position:\s*(fixed|sticky|absolute)|z-index|overflow:\s*(auto|scroll)|backdrop|body\.[a-z-]*open/.test(CSS), "the card is in the flow: nothing fixed, stacked, scrolled or locked");

for (const t of TEMPLATES) {
  const src = read(t);
  const order = (re) => src.search(re);
  ok(order(/tfr-trial-prompt\.js/) > 0 && order(/tfr-trial-prompt\.js/) < order(/tfr-use-counter\.js/), `${t}: the prompt loads before the counter`);
  ok(/tfr-trial-prompt\.css"\}\}&amp;frv=[0-9a-f]{16}/.test(src), `${t}: the stylesheet is linked and stamped`);
  ok(!/free account opens|Create a free account|Not now|tfr-prompt/.test(src.replace(/\{\{!--[\s\S]*?--\}\}/g, "").replace(/<(script|link)[^>]*>/g, "")), `${t}: the served markup holds no prompt text or card`);
}

/* ------------------------------------------------------------- B. in Chrome */
let puppeteer = null;
try { puppeteer = createRequire(import.meta.url)("puppeteer-core"); } catch (_) {
  try { if (process.env.PUPPETEER_CORE) puppeteer = createRequire(import.meta.url)(process.env.PUPPETEER_CORE); } catch (_e) { /* none */ }
}
const chrome = process.env.CHROME_PATH || ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find(existsSync);
if (!puppeteer || !chrome) {
  console.log("skip  prompt in Chrome: needs puppeteer-core and a Chrome (PUPPETEER_CORE, CHROME_PATH)");
  if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1); }
  process.exit(0);
}

const ORIGIN = "https://mereorthodoxy.com";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";
const SHOTS = process.env.TRIAL_PROMPT_SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const MIME = { js: "text/javascript", css: "text/css", json: "application/json" };

// A template's markup, as the page serves it: everything after the head block, handlebars and its own scripts removed.
function markup(file, fill) {
  let b = read(file).split("{{/contentFor}}").slice(1).join("");
  b = b.replace(/\{\{!--[\s\S]*?--\}\}/g, "").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<link[^>]*>/g, "").replace(/\{\{[^}]*\}\}/g, "");
  return fill(b);
}
const verses = Array.from({ length: 40 }, (_, i) => `<p class="bible-verse" data-v="${i + 1}"><button type="button">${i + 1}</button> ${"In the beginning was the Word, and the Word was with God. ".repeat(4)}</p>`).join("");
const topics = Array.from({ length: 12 }, (_, i) => `<p class="td-row"><a href="?t=locus${i + 1}">Locus ${i + 1}</a> ${"Doctrine in the classic order. ".repeat(6)}</p>`).join("");
const PAGES = {
  scripture: {
    path: "/the-faith-received/scripture/",
    html: markup("custom-scripture-dev.hbs", (b) => b.replace(/(<article class="bible-chapter sd-text" data-sd-text>)[\s\S]*?(<\/article>)/, `$1${verses}$2`)),
    css: ["scripture-dev.css", "tfr-trial-prompt.css"],
    boot: true,
  },
  topics: {
    path: "/the-faith-received/topics/",
    html: markup("custom-faith-topics-dev.hbs", (b) => b.replace(/(<div class="container td-root" data-td-root>)[\s\S]*?(<\/div>\s*<\/main>)/, `$1${topics}$2`)),
    css: ["scripture-dev.css", "topics-dev.css", "tfr-trial-prompt.css"],
    boot: false,
  },
};
const OTHER = { path: "/the-faith-received/", html: '<main class="sd"><section class="bhero"><h1>The Faith Received</h1></section><div class="container"><p>Home.</p></div></main>', css: ["tfr-trial-prompt.css"], boot: false };
const STUB_PLAUSIBLE = "window.plausible=function(n,o){fetch('/pa/e',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({n:n,p:(o&&o.props)||{}}),keepalive:true});};";

function shell(page, member) {
  const css = page.css.map((f) => `<link rel="stylesheet" href="/assets/css/${f}">`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fixture</title>${css}<link rel="stylesheet" href="/assets/built/screen.min.css"><link rel="stylesheet" href="/assets/built/faith-received.min.css">
${page.boot ? '<script src="/assets/js/page/scripture-view-boot.js"></script>' : ""}<script src="/assets/built/boot.min.js"></script></head>
<body ${member ? `data-member-email="x@example.invalid" data-member-status="${member}"` : ""}>${page.html}
<footer id="fx" style="padding:40px 28px">Footer</footer>
<script defer src="/pa/js"></script>
<script src="/assets/built/site.min.js"></script>
<script defer src="/assets/js/page/tfr-trial-prompt.js"></script><script defer src="/assets/js/page/tfr-use-counter.js"></script>
<script>
window.__openVerse = function (n) {
  history.replaceState(null, "", "?ref=john.3." + n);
  document.querySelectorAll(".bible-verse.is-active").forEach(function (e) { e.classList.remove("is-active"); });
  document.querySelector('[data-v="' + n + '"]').classList.add("is-active");
  window.dispatchEvent(new CustomEvent("sd:verse", { detail: { v: n } }));
};
window.__openTopic = function (n) { history.pushState(null, "", "?t=locus" + n); document.dispatchEvent(new MouseEvent("click", { bubbles: true })); };
window.__cls = 0;
try { new PerformanceObserver(function (l) { l.getEntries().forEach(function (e) { if (!e.hadRecentInput) window.__cls += e.value; }); }).observe({ type: "layout-shift", buffered: true }); } catch (e) {}
</script></body></html>`;
}

const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open({ page: which = "scripture", member = "", random = 0.1, ua = UA, width = 1280, height = 800, theme = "", store = null }) {
  const ctx = await browser.createBrowserContext(); // no cookies, no storage: not anyone's account
  const page = await ctx.newPage();
  const def = which === "other" ? OTHER : PAGES[which];
  const events = [];
  const posts = [];
  const errors = [];
  await page.setUserAgent(ua);
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument((r, th, st) => {
    Math.random = () => r;
    try { if (th) localStorage.setItem("fr_sd_theme", th); if (st && !localStorage.getItem("mo-tfr-prompt:v1") && st !== "-") localStorage.setItem("mo-tfr-prompt:v1", st); } catch (e) { /* none */ }
  }, random, theme, store);
  page.on("console", (m) => { if (m.type() === "error" && !/status of 404/.test(m.text())) errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const u = new URL(req.url());
    if (u.origin !== ORIGIN) return req.respond({ status: 204, body: "" });
    if (u.pathname === "/favicon.ico") return req.respond({ status: 204, body: "" });
    if (u.pathname === "/pa/js") return req.respond({ status: 200, contentType: MIME.js, body: STUB_PLAUSIBLE });
    if (u.pathname === "/pa/e") { events.push(JSON.parse(req.postData() || "{}")); return req.respond({ status: 202, body: "" }); }
    if (u.pathname === "/members/api/integrity-token/") return req.respond({ status: 200, contentType: "text/plain", body: "token" });
    if (u.pathname === "/members/api/send-magic-link/") { posts.push(JSON.parse(req.postData() || "{}")); return req.respond({ status: 201, contentType: "text/plain", body: "Created" }); }
    if (u.pathname === def.path) return req.respond({ status: 200, contentType: "text/html", body: shell(def, member) });
    const f = path.join(root, u.pathname);
    if (u.pathname.startsWith("/assets/") && f.startsWith(path.join(root, "assets")) && existsSync(f)) {
      return req.respond({ status: 200, contentType: MIME[f.split(".").pop()] || "application/octet-stream", body: readFileSync(f) });
    }
    errors.push(`unserved ${u.pathname}`);
    return req.respond({ status: 404, body: "" });
  });
  await page.goto(`${ORIGIN}${def.path}`, { waitUntil: "load" });
  await sleep(150);
  const api = {
    page, events, posts, errors,
    named: (n) => events.filter((e) => e.n === n),
    prompt: (action) => events.filter((e) => e.n === "TFR Prompt" && (!action || e.p.action === action)),
    uses: () => events.filter((e) => e.n === "TFR Tool Use").map((e) => e.p.n),
    card: () => page.$(".tfr-prompt"),
    async use(i) { await page.evaluate((k, w) => (w === "scripture" ? window.__openVerse(k) : window.__openTopic(k)), i, which); await sleep(320); },
    stored: () => page.evaluate(() => localStorage.getItem("mo-tfr-prompt:v1")),
    async backdate(days) { await page.evaluate((d) => { const s = JSON.parse(localStorage.getItem("mo-tfr-prompt:v1")); s.dismissedAt = Date.now() - d * 864e5; localStorage.setItem("mo-tfr-prompt:v1", JSON.stringify(s)); }, days); },
    async close() { await ctx.close(); },
  };
  return api;
}

try {
  for (const which of ["scripture", "topics"]) {
    const L = `${which}`;
    /* ---- prompt arm */
    const s = await open({ page: which, random: 0.1 });
    for (let i = 1; i <= 3; i += 1) {
      await s.use(i);
      ok(!(await s.card()), `${L}: no card on use ${i}`);
    }
    ok(s.prompt().length === 0, `${L}: no prompt events on uses 1-3`);
    // Everything in view, and where it is, before use 4.
    const nBefore = await s.page.evaluate(() => {
      window.__before = [];
      document.querySelectorAll("body *").forEach((e) => {
        const r = e.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight) window.__before.push([e, r.top, r.left]);
      });
      return window.__before.length;
    });
    await s.use(4);
    await s.page.waitForSelector(".tfr-prompt", { timeout: 2000 });
    const moved = await s.page.evaluate(() => window.__before
      .filter(([e, top, left]) => { const r = e.getBoundingClientRect(); return Math.abs(r.top - top) > 0.5 || Math.abs(r.left - left) > 0.5; })
      .map(([e]) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 30)}`));
    ok(nBefore > 10 && moved.length === 0, `${L}: nothing that was in view moved (${nBefore} elements checked${moved.length ? `, moved: ${moved.slice(0, 4).join(" ")}` : ""})`);
    ok((await s.page.evaluate(() => window.__cls)) < 0.01, `${L}: layout-shift score under 0.01`);

    const info = await s.page.evaluate(() => {
      const host = document.querySelector(".tfr-prompt-host");
      const card = document.querySelector(".tfr-prompt");
      const cta = card.querySelector(".tfr-prompt-cta");
      const no = card.querySelector(".tfr-prompt-dismiss");
      const b = (e) => e.getBoundingClientRect();
      return {
        live: host.getAttribute("aria-live"), tag: card.tagName, text: card.querySelector(".tfr-prompt-text").textContent,
        ctaH: b(cta).height, noH: b(no).height, noW: b(no).width, font: getComputedStyle(card).fontSize,
        modal: !!document.querySelector(".feature-gate-modal"), lock: document.body.classList.contains("feature-gate-modal-open"),
        overflow: getComputedStyle(document.body).overflow, pos: getComputedStyle(card).position,
        beforeFooter: host.compareDocumentPosition(document.getElementById("fx")) & Node.DOCUMENT_POSITION_FOLLOWING,
        parentIsMain: host.parentElement.tagName === "MAIN",
        ctaLabel: cta.textContent, noLabel: no.textContent, tabbable: card.querySelectorAll("button").length,
      };
    });
    ok(info.live === "polite" && info.tag === "SECTION" && info.parentIsMain && info.beforeFooter > 0, `${L}: a polite live region at the end of the content, before the footer`);
    ok(info.ctaH >= 44 && info.noH >= 44 && info.noW >= 44, `${L}: the button and the dismiss are 44px targets (${info.ctaH}, ${info.noH}x${info.noW})`);
    ok(info.font === "15px", `${L}: compact, 15px text`);
    ok(!info.modal && !info.lock && info.overflow !== "hidden" && info.pos === "static", `${L}: not a modal: no dialog, no scroll lock, in the flow`);
    ok(info.ctaLabel === "Create a free account" && info.noLabel === "Not now" && /^A free account opens /.test(info.text), `${L}: the copy is the copy`);
    const shown = s.prompt("shown");
    ok(s.uses().join() === "1,2,3,4", `${L}: the counter's own events are untouched (n ${s.uses().join(",")})`);
    ok(shown.length === 1 && JSON.stringify(shown[0].p) === JSON.stringify({ action: "shown", tool: which, n: "4", variant: "prompt" }), `${L}: "TFR Prompt" shown carries action, tool, n, variant (${JSON.stringify(shown[0] && shown[0].p)})`);
    if (SHOTS) await s.page.screenshot({ path: path.join(SHOTS, `${which}-card-1280.png`) });

    // Dismiss: gone, event, stored, and it stays gone.
    await s.page.focus(".tfr-prompt-dismiss");
    await s.page.keyboard.press("Enter");
    await sleep(100);
    ok(!(await s.card()) && !(await s.page.$(".tfr-prompt-host")), `${L}: "Not now" removes the card (keyboard)`);
    ok(s.prompt("dismissed").length === 1 && s.prompt("dismissed")[0].p.n === "4", `${L}: dismissed is reported`);
    const rec = JSON.parse(await s.stored());
    ok(rec.variant === "prompt" && rec.shownCount === 1 && rec.dismissedAt > 0, `${L}: stored {variant, shownCount 1, dismissedAt}`);
    await s.use(5);
    ok(!(await s.card()), `${L}: use 5 after "Not now": no card`);
    await s.page.reload({ waitUntil: "load" });
    await s.use(6);
    ok(!(await s.card()), `${L}: after a reload, still no card inside the snooze`);
    await s.backdate(6.9);
    await s.use(7);
    ok(!(await s.card()), `${L}: 6.9 days on: still snoozed`);
    await s.backdate(7.1);
    await s.use(8);
    await sleep(250);
    ok(!!(await s.card()), `${L}: 7.1 days on: the card is back (show 2)`);
    await s.page.click(".tfr-prompt-dismiss");
    await s.backdate(8);
    await s.use(9);
    await sleep(250);
    ok(!!(await s.card()), `${L}: show 3`);
    await s.page.click(".tfr-prompt-dismiss");
    await s.backdate(30);
    await s.use(10);
    await s.use(11);
    ok(!(await s.card()) && JSON.parse(await s.stored()).shownCount === 3, `${L}: never a fourth show, a month later`);
    ok(s.prompt("shown").length === 3 && s.prompt("dismissed").length === 3, `${L}: three shows, three dismissals reported`);
    ok(s.errors.length === 0, `${L}: no console errors${s.errors.length ? ` (${s.errors[0]})` : ""}`);
    await s.close();

    /* ---- control arm */
    const c = await open({ page: which, random: 0.9 });
    for (let i = 1; i <= 6; i += 1) await c.use(i);
    await sleep(300);
    ok(!(await c.card()) && c.prompt("shown").length === 0, `${L}: control never sees a card`);
    ok(c.uses().join() === "1,2,3,4,5,6", `${L}: control is counted like everyone else`);
    const would = c.prompt("would_show");
    ok(would.length === 1 && JSON.stringify(would[0].p) === JSON.stringify({ action: "would_show", tool: which, n: "4", variant: "control" }), `${L}: control reports would_show once, at use 4 (${JSON.stringify(would[0] && would[0].p)})`);
    ok(JSON.parse(await c.stored()).variant === "control", `${L}: the variant is kept`);
    ok(c.errors.length === 0, `${L}: control: no console errors`);
    await c.close();

    /* ---- signed in, crawlers */
    for (const member of ["free", "paid", "comped"]) {
      const m = await open({ page: which, member });
      for (let i = 1; i <= 6; i += 1) await m.use(i);
      await sleep(250);
      ok(!(await m.card()) && m.prompt().length === 0 && (await m.stored()) === null, `${L}: signed in (${member}): no card, no prompt events, nothing stored`);
      await m.close();
    }
    for (const [name, ua] of [["Googlebot", "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"], ["HeadlessChrome", UA.replace("Chrome/", "HeadlessChrome/")], ["Lighthouse", `${UA} Chrome-Lighthouse`], ["bingbot", "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)"]]) {
      const b = await open({ page: which, ua });
      for (let i = 1; i <= 6; i += 1) await b.use(i);
      await sleep(250);
      ok(!(await b.card()) && b.prompt().length === 0 && (await b.stored()) === null, `${L}: ${name}: no card, no prompt events, nothing stored`);
      await b.close();
    }

    /* ---- storage tampering is harmless */
    for (const junk of ["{not json", "[]", '{"variant":"<img src=x onerror=alert(1)>","shownCount":"9","dismissedAt":-5}', '{"variant":"prompt","shownCount":1e999}']) {
      const t = await open({ page: which, store: junk });
      for (let i = 1; i <= 4; i += 1) await t.use(i);
      await sleep(250);
      const fine = t.errors.length === 0 && !(await t.page.$("img[src=x]"));
      ok(fine, `${L}: tampered storage ${junk.slice(0, 24)}: no error, nothing injected`);
      await t.close();
    }
  }

  /* ---- not a tool page */
  const o = await open({ page: "other" });
  await o.page.evaluate(() => document.dispatchEvent(new CustomEvent("mo:tfr-use", { detail: { tool: "ask", n: 9, who: "anonymous" } })));
  await sleep(300);
  ok(!(await o.card()) && o.prompt().length === 0, "a page that is not Scripture or Topics: no card");
  await o.close();

  /* ---- the button, the dialog, the sign-up */
  {
    const g = await open({ page: "scripture", random: 0.1 });
    for (let i = 1; i <= 4; i += 1) await g.use(i);
    await g.page.waitForSelector(".tfr-prompt");
    await g.page.click(".tfr-prompt-cta");
    await g.page.waitForSelector(".feature-gate-modal.is-visible", { timeout: 2000 });
    const dlg = await g.page.evaluate(() => ({
      title: document.querySelector("#fg-modal-title").textContent,
      src: document.querySelector(".feature-gate-modal [data-inline-signup]").getAttribute("data-source"),
    }));
    ok(dlg.title === "Create a free account" && dlg.src === "feature-gate:tfr-trial-prompt", `the button opens the free-account dialog with source ${dlg.src}`);
    ok(g.prompt("cta_click").length === 1 && g.prompt("cta_click")[0].p.variant === "prompt", "cta_click is reported");
    ok(g.named("TFR Prompt Signup").length === 0, "no signup event before the form is accepted");
    await g.page.type("#fg-first", "Test");
    await g.page.type("#fg-last", "Reader");
    await g.page.type("#fg-email", "reader@example.invalid");
    await g.page.click("[data-signup-submit]");
    await g.page.waitForSelector(".inline-signup-success", { timeout: 3000 });
    await sleep(300);
    const su = g.named("TFR Prompt Signup");
    ok(su.length === 1 && JSON.stringify(su[0].p) === JSON.stringify({ tool: "scripture", n: "4", variant: "prompt", source: "tfr-trial-prompt" }), `an accepted sign-up reports "TFR Prompt Signup" (${JSON.stringify(su[0] && su[0].p)})`);
    ok(g.posts.length === 1 && (g.posts[0].labels || []).some((l) => l.name === "source:feature-gate:tfr-trial-prompt" || l === "source:feature-gate:tfr-trial-prompt"), `the magic-link request carries the label source:feature-gate:tfr-trial-prompt (${JSON.stringify(g.posts[0] && g.posts[0].labels)})`);
    ok(g.errors.length === 0, `sign-up path: no console errors${g.errors.length ? ` (${g.errors[0]})` : ""}`);
    await g.close();

    // Closing the dialog without signing up reports nothing, and a later gate's sign-up is not credited to the card.
    const h = await open({ page: "scripture", random: 0.1 });
    for (let i = 1; i <= 4; i += 1) await h.use(i);
    await h.page.waitForSelector(".tfr-prompt");
    await h.page.click(".tfr-prompt-cta");
    await h.page.waitForSelector(".feature-gate-modal.is-visible");
    await h.page.keyboard.press("Escape");
    await sleep(500);
    await h.page.evaluate(() => window.MOFeatureGate.open("ask"));
    await h.page.waitForSelector(".feature-gate-modal.is-visible");
    await h.page.type("#fg-first", "Test"); await h.page.type("#fg-last", "Reader"); await h.page.type("#fg-email", "other@example.invalid");
    await h.page.click("[data-signup-submit]");
    await h.page.waitForSelector(".inline-signup-success", { timeout: 3000 });
    await sleep(300);
    ok(h.named("TFR Prompt Signup").length === 0, "a sign-up from some other gate is not credited to the card");
    await h.close();
  }

  /* ---- widths and themes */
  const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const x = lum(a); const y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  for (const [theme, label] of [["", "light"], ["dark", "dark"]]) {
    for (const width of [320, 375, 820, 1280]) {
      const v = await open({ page: "scripture", random: 0.1, width, height: width < 700 ? 812 : 900, theme });
      for (let i = 1; i <= 4; i += 1) await v.use(i);
      await v.page.waitForSelector(".tfr-prompt");
      await v.page.$eval(".tfr-prompt", (e) => e.scrollIntoView({ block: "center", behavior: "instant" }));
      await sleep(250);
      const m = await v.page.evaluate(() => {
        const card = document.querySelector(".tfr-prompt");
        const cs = (e) => getComputedStyle(e);
        const solid = (e) => { for (let n = e; n; n = n.parentElement) { const c = cs(n).backgroundColor; if (!/rgba\(\d+, \d+, \d+, 0\)|transparent/.test(c)) return c; } return "rgb(255,255,255)"; };
        const r = card.getBoundingClientRect();
        const cta = card.querySelector(".tfr-prompt-cta");
        const no = card.querySelector(".tfr-prompt-dismiss");
        return {
          theme: document.documentElement.getAttribute("data-sd-theme"),
          left: r.left, right: r.right, vw: innerWidth, sw: document.documentElement.scrollWidth,
          bg: solid(card), ink: cs(card.querySelector(".tfr-prompt-text")).color, ctaInk: cs(cta).color, ctaBg: solid(cta), noInk: cs(no).color,
          ctaRect: cta.getBoundingClientRect().toJSON(), noRect: no.getBoundingClientRect().toJSON(), cardRect: r.toJSON(),
        };
      });
      const sheet = `${label} ${width}`;
      ok(m.theme === (theme || "light"), `${sheet}: the page's own switch is ${m.theme}`);
      ok(m.sw <= m.vw && m.left >= 0 && m.right <= m.vw + 0.5, `${sheet}: no sideways scroll, card inside the screen`);
      ok(ratio(rgb(m.ink), rgb(m.bg)) >= 4.5, `${sheet}: text contrast ${ratio(rgb(m.ink), rgb(m.bg)).toFixed(1)}:1`);
      ok(ratio(rgb(m.ctaInk), rgb(m.ctaBg)) >= 4.5, `${sheet}: button contrast ${ratio(rgb(m.ctaInk), rgb(m.ctaBg)).toFixed(1)}:1`);
      ok(ratio(rgb(m.noInk), rgb(m.bg)) >= 4.5, `${sheet}: "Not now" contrast ${ratio(rgb(m.noInk), rgb(m.bg)).toFixed(1)}:1`);
      ok(m.ctaRect.height >= 44 && m.noRect.height >= 44 && m.noRect.width >= 44, `${sheet}: 44px targets`);
      ok(m.cardRect.height <= (width < 700 ? 170 : 80), `${sheet}: compact (${Math.round(m.cardRect.height)}px tall)`);
      if (SHOTS) await v.page.screenshot({ path: path.join(SHOTS, `card-${label}-${width}.png`) });
      await v.close();
    }
  }
} finally {
  await browser.close();
}

if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1); }
console.log("\nall trial-prompt checks passed");
