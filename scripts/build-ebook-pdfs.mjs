#!/usr/bin/env node
/*
 * scripts/build-ebook-pdfs.mjs
 *
 * Builds each ebook's download files into assets/files/ebooks/:
 *   <slug>.pdf   the book as the reader's magazine view sets it
 *   <slug>.epub  a plain reflowable copy, via pandoc (skipped if absent)
 *
 * THE PDF MATCHES THE MAGAZINE VIEW (Ian, 2026-11-11: "Redo ebook pdfs
 * to match magazine view"). It is not a second design kept in step by
 * hand. The script puts the ebook's cover, title and essays into a bare
 * page, loads the site's own assets/js/magazine.js and
 * assets/css/magazine.css, and lets that script typeset the book: cover,
 * contents, essays that open on one column and run in two, folios, the
 * bio under the emblem, the back cover. Each page it sets becomes one
 * page of the PDF, at the journal's trim (540 x 701 px, 5.625 x 7.3 in).
 *
 * How, without touching magazine.js:
 *   - magazine.js skips loading page-flip when window.St.PageFlip already
 *     exists. The print page defines a stand-in that does nothing, so the
 *     set pages stay in the DOM as plain blocks.
 *   - The stage is one page (540px) wide and the stand-in reports a
 *     540px page, so magazine.js sets the type for exactly that width.
 *   - magazine.css's phone rules (max-width: 700px) are taken out of the
 *     copy the print page uses. When Chrome prints, the page is 540px
 *     wide, so those rules would otherwise switch on after the pages
 *     were set and reflow every one.
 *   - The paper grain, mottle and gutter shadow are screen effects and
 *     stay off the PDF.
 *   - Links to outside sources stay clickable, and common ligatures are
 *     off so every word can be searched and copied.
 *
 * Run from the theme root:
 *   node scripts/build-ebook-pdfs.mjs            all books
 *   node scripts/build-ebook-pdfs.mjs formation  one book
 * Re-run whenever a read page's text or the magazine view changes.
 *
 * Needs a Chromium-family browser (Chrome, a Playwright Chromium, or
 * Brave; the first found is used, or set CHROME=/path). It is driven
 * over the DevTools protocol with Node's built-in WebSocket, so there
 * is nothing to npm install. Fonts load from Google Fonts: run it online.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { execSync, spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve, join } from "node:path";
import { homedir, tmpdir } from "node:os";

const THEME_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BUILD_DIR = resolve(THEME_ROOT, "scripts/.ebook-build");
const OUT_DIR = resolve(THEME_ROOT, "assets/files/ebooks");

// The journal's trim, as magazine.js has it (TRIM_W, TRIM_H).
const PAGE_W = 540;
const PAGE_H = 701;

const BOOKS = [
  { slug: "navigating-the-fracture", src: "page-ebook-navigating-the-fracture-read.hbs", subtitle: "A Pastor's Guide to Leading Through Cultural Division" },
  // Retired from the site (its routes are commented out in routes.yaml) and
  // still on the old reader template, which the magazine view does not
  // serve. Its PDF and EPUB are left as they are.
  { slug: "blueprint-for-renewal", src: "page-ebook-blueprint-for-renewal-read.hbs", subtitle: "Protestant Catholicity and Solidarity Conservatism", skip: "retired, old reader template" },
  { slug: "spiritual-formation-for-the-family", src: "page-ebook-spiritual-formation-for-the-family-read.hbs", subtitle: "" },
  { slug: "ai-and-the-church", src: "page-ebook-ai-and-the-church-read.hbs", subtitle: "Fourteen essays on artificial intelligence, formation, and faithfulness." },
  { slug: "formation", src: "page-ebook-formation-read.hbs", subtitle: "A Mere Orthodoxy Collection" },
];

const asset = (p) => pathToFileURL(join(THEME_ROOT, "assets", p)).href;
const escHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ── Reading the ebook's read page ─────────────────────────────────── */

function readBook(book) {
  const src = readFileSync(resolve(THEME_ROOT, book.src), "utf8");
  const grab = (re, what) => {
    const m = src.match(re);
    if (!m) throw new Error(`${book.src}: no ${what} found. Has the reader markup changed?`);
    return m;
  };
  const cover = grab(/<div class="rd-cover">[\s\S]*?<\/div>/, "cover (.rd-cover)")[0];
  const title = grab(/<h1 class="rd-title"[^>]*>([\s\S]*?)<\/h1>/, "title (h1.rd-title)")[1].replace(/<[^>]+>/g, "").trim();
  const article = grab(/<article class="rd-text"[^>]*>[\s\S]*?<\/article>/, "text (article.rd-text)")[0];
  // The only Handlebars inside these blocks is {{asset "…"}}.
  const local = (html) => {
    const out = html.replace(/\{\{asset "([^"]+)"\}\}/g, (_, p) => asset(p));
    const left = out.match(/\{\{[^}]*\}\}/);
    if (left) throw new Error(`${book.src}: unexpected Handlebars in the book text: ${left[0]}`);
    return out;
  };
  return { cover: local(cover), title, article: local(article) };
}

/* ── The print page ────────────────────────────────────────────────── */

// Remove one "@media (<query>) { … }" block, braces matched.
function dropMedia(css, startsWith) {
  let out = css;
  for (;;) {
    const at = out.indexOf(startsWith);
    if (at < 0) return out;
    let i = out.indexOf("{", at);
    let depth = 1;
    while (depth && ++i < out.length) {
      if (out[i] === "{") depth++;
      else if (out[i] === "}") depth--;
    }
    out = out.slice(0, at) + out.slice(i + 1);
  }
}

function printCss() {
  const magazine = dropMedia(readFileSync(join(THEME_ROOT, "assets/css/magazine.css"), "utf8"), "@media (max-width:");
  // The reader's own sheet goes in too, as on the real page: the drawn
  // covers (.lib-ecover) and the base rules (box-sizing, images) that the
  // magazine pages are set under. Its phone and print rules are for the
  // reading view and stay out.
  const reader = dropMedia(dropMedia(readFileSync(join(THEME_ROOT, "assets/css/reader-v2.css"), "utf8"), "@media (max-width:"), "@media print");
  if (!/\.lib-ecover/.test(reader)) throw new Error("reader-v2.css: no .lib-ecover rules found for the drawn covers.");
  return `${reader}\n${magazine}\n
@page { size: ${PAGE_W}px ${PAGE_H}px; margin: 0; }
html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; height: auto !important; }
body > :not(.mag) { display: none !important; }
html.mag-open, html.mag-open body { overflow: visible !important; }
/* The book out of its dialog: a plain run of pages. */
.mag { position: static !important; display: block !important; padding: 0 !important; background: none !important; }
.mag-app { display: block !important; width: auto !important; height: auto !important; }
/* One page wide. Anything wider than the sheet makes Chrome shrink the
   whole print to fit. magazine.js reads a stage under 700px as a single
   page of that width, which is the 540px wanted. */
.mag-stage { width: ${PAGE_W}px !important; visibility: visible !important; }
.mag-book { width: ${PAGE_W}px; }
.mag-bar, .mag-hint, .mag-close, .mag-loading { display: none !important; }
.mag-book { filter: none !important; }
.mag-book .mp { position: relative; width: ${PAGE_W}px; height: ${PAGE_H}px; break-after: page; break-inside: avoid; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.mag-book .mp:last-child { break-after: auto; }
/* Screen-only paper effects. */
.mp-in { background-image: none !important; box-shadow: none !important; }
.mp-in::before, .mp-in::after { display: none !important; }
/* A link over each contents line, so it jumps to its essay in the PDF. */
.mp-ic-list li { position: relative; }
.mp-ic-list a.pdf-go { position: absolute; inset: 0; }
.mp-pc a.pdf-src { color: inherit; text-decoration: none; }
/* No fi/fl/ff ligatures: Preview, Safari and iOS extract them as blanks,
   so "suffering" could not be found, copied or read aloud. The reader's
   sheet turns ligatures on with font-feature-settings, so that is the
   property that has to answer it. Kerning and old-style figures, which
   the same line asks for, stay on. */
.mag-book, .mag-book * { font-variant-ligatures: none !important; font-feature-settings: "kern" 1, "onum" 1, "liga" 0, "clig" 0, "dlig" 0 !important; }
`;
}

// Runs in the print page, before magazine.js.
const STAND_IN = `
// magazine.js turns essay links into plain text (they cannot be followed
// from a turning page). A PDF can follow them, so each outside link is
// marked here and made a link again once the pages are set.
document.querySelectorAll("article.rd-text a[href]").forEach((a) => { if (!/^https?:/.test(a.getAttribute("href"))) return; const s = document.createElement("span"); s.setAttribute("data-pdf-href", a.href); s.innerHTML = a.innerHTML; a.replaceWith(s); });
window.St = { PageFlip: class {
  loadFromHTML() {} on() {} turnToPage() {} flip() {} flipNext() {} flipPrev() {} destroy() {}
  getCurrentPageIndex() { return 0; }
  getOrientation() { return "landscape"; }
  getRender() { return { getRect() { return { pageWidth: ${PAGE_W} }; } }; }
} };`;

// Runs after magazine.js: open the book, wait for the pages, finish them.
const DRIVER = `
(function () {
  const root = document.documentElement;
  const door = document.querySelector("[data-mag-open]");
  if (!door) { root.dataset.pdfError = "magazine.js did not add its Magazine view button"; return; }
  door.click();
  const mag = document.getElementById("mag");
  const loading = mag.querySelector("[data-mag-loading]");
  (function wait() {
    if (/could not load/i.test(loading.textContent)) { root.dataset.pdfError = "magazine.js could not set the pages"; return; }
    const pages = mag.querySelectorAll(".mag-book .mp");
    if (mag.classList.contains("is-setting") || !loading.hidden || pages.length < 3) { setTimeout(wait, 100); return; }
    pages.forEach((p, i) => { p.id = "pg-" + (i + 1); });
    mag.querySelectorAll("span[data-pdf-href]").forEach((s) => { const a = document.createElement("a"); a.className = "pdf-src"; a.href = s.getAttribute("data-pdf-href"); a.innerHTML = s.innerHTML; s.replaceWith(a); });
    mag.querySelectorAll(".mp-ic-list button[data-mag-idx]").forEach((b) => {
      const a = document.createElement("a");
      a.className = "pdf-go";
      a.href = "#pg-" + (Number(b.getAttribute("data-mag-idx")) + 1);
      a.setAttribute("aria-label", b.textContent.trim());
      b.parentNode.appendChild(a);
    });
    // Text that ran past its page box would be cut off in the PDF.
    const over = [];
    pages.forEach((p, i) => {
      const pc = p.querySelector(".mp-pc");
      if (pc && (pc.scrollHeight > pc.clientHeight + 1 || pc.scrollWidth > pc.clientWidth + 1)) over.push(i + 1);
    });
    const imgs = Array.prototype.slice.call(mag.querySelectorAll("img"));
    Promise.all(imgs.map((img) => { return img.decode ? img.decode().catch(() => {}) : null; })).then(() => {
      root.dataset.pdfBroken = String(imgs.filter((img) => { return !img.naturalWidth; }).length);
      root.dataset.pdfOver = over.join(",");
      root.dataset.pdfPages = String(pages.length);
    });
  })();
})();`;

function printHtml(book, { cover, title, article }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escHtml(title)} | Mere Orthodoxy</title>
<meta name="author" content="Mere Orthodoxy">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=IM+Fell+Great+Primer:ital@0;1&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap" rel="stylesheet">
<style>${printCss()}</style>
</head>
<body>
<main>
  <section class="rd-title-page">
    ${cover}
    <h1 class="rd-title">${escHtml(title)}</h1>
    <p class="rd-actions"></p>
  </section>
  ${article}
</main>
<script>${STAND_IN}</script>
<script src="${asset("js/magazine.js")}" data-flip="about:blank" data-emblem="${asset("images/mere-o-fav-icon.png")}"></script>
<script>${DRIVER}</script>
</body>
</html>`;
}

/* ── A browser, over the DevTools protocol ─────────────────────────── */

function findBrowser() {
  if (process.env.CHROME) {
    if (!existsSync(process.env.CHROME)) throw new Error(`CHROME is set but not found: ${process.env.CHROME}`);
    return process.env.CHROME;
  }
  const found = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];
  const cache = join(homedir(), "Library/Caches/ms-playwright");
  if (existsSync(cache)) {
    for (const d of readdirSync(cache).sort().reverse()) {
      if (/^chromium_headless_shell-/.test(d)) found.push(join(cache, d, "chrome-mac/headless_shell"));
      if (/^chromium-/.test(d)) found.push(join(cache, d, "chrome-mac/Chromium.app/Contents/MacOS/Chromium"));
    }
  }
  found.push("/Applications/Chromium.app/Contents/MacOS/Chromium", "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser");
  const hit = found.find((p) => existsSync(p));
  if (!hit) throw new Error("No Chromium-family browser found. Install Chrome, or set CHROME=/path/to/browser.");
  return hit;
}

// Wait for the browser to be gone before removing its profile: it keeps
// writing while it dies and would put the folder back.
async function shutdown(proc, profile, ws) {
  try { if (ws) ws.close(); } catch (_) {}
  if (proc.exitCode === null && proc.signalCode === null) {
    const gone = new Promise((r) => proc.once("exit", r));
    proc.kill();
    let t;
    await Promise.race([gone, new Promise((r) => { t = setTimeout(r, 3000); })]);
    clearTimeout(t);
    if (proc.exitCode === null && proc.signalCode === null) { proc.kill("SIGKILL"); await gone; }
  }
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch (_) {}
}

async function launch() {
  const bin = findBrowser();
  const profile = mkdtempSync(join(tmpdir(), "mo-ebook-pdf-"));
  const args = ["--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check",
    "--disable-gpu", "--hide-scrollbars", "--window-size=1280,900", "about:blank"];
  if (!/headless_shell$/.test(bin)) args.unshift("--headless=new");
  const proc = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
  let ws;
  try {
  const wsUrl = await new Promise((ok, fail) => {
    let err = "";
    const t = setTimeout(() => fail(new Error(`${bin} did not start:\n${err.slice(-400)}`)), 20000);
    proc.stderr.on("data", (d) => {
      err += d;
      const m = err.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(t); ok(m[1]); }
    });
    proc.on("exit", (c) => { clearTimeout(t); fail(new Error(`${bin} exited (${c}):\n${err.slice(-400)}`)); });
  });
  ws = new WebSocket(wsUrl);
  await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = () => fail(new Error("could not connect to the browser")); });
  let id = 0;
  const waiting = new Map();
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    const w = waiting.get(msg.id);
    if (!w) return;
    waiting.delete(msg.id);
    if (msg.error) w.fail(new Error(msg.error.message)); else w.ok(msg.result);
  };
  // A browser that dies mid-build fails whatever is waiting on it, so
  // the build stops with an error and cannot end quietly.
  const lost = (why) => { for (const w of waiting.values()) w.fail(new Error(why)); waiting.clear(); };
  ws.onclose = () => lost("the browser connection closed mid-build");
  proc.on("exit", (c) => lost(`the browser exited mid-build (${c})`));
  const send = (method, params = {}, sessionId) => new Promise((ok, fail) => {
    if (ws.readyState !== WebSocket.OPEN) { fail(new Error("the browser connection is closed")); return; }
    const n = ++id;
    waiting.set(n, { ok, fail });
    ws.send(JSON.stringify({ id: n, method, params, sessionId }));
  });
  const close = () => shutdown(proc, profile, ws);
  return { bin, send, close };
  } catch (e) { await shutdown(proc, profile, ws); throw e; }
}

async function renderPdf(browser, htmlPath, pdfPath) {
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true });
  const cdp = (m, p) => browser.send(m, p, sessionId);
  try {
    await cdp("Page.enable");
    await cdp("Page.navigate", { url: pathToFileURL(htmlPath).href });
    const read = async (expr) => (await cdp("Runtime.evaluate", { expression: expr, returnByValue: true })).result.value;
    const started = Date.now();
    let state;
    for (;;) {
      state = await read("JSON.stringify(document.documentElement ? Object.assign({}, document.documentElement.dataset) : {})");
      state = JSON.parse(state || "{}");
      if (state.pdfError) throw new Error(state.pdfError);
      if (state.pdfPages) break;
      if (Date.now() - started > 120000) throw new Error("timed out waiting for the pages to be set (are you online? the fonts load from Google)");
      await new Promise((r) => setTimeout(r, 250));
    }
    const { data } = await cdp("Page.printToPDF", {
      printBackground: true, preferCSSPageSize: true,
      marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
      generateDocumentOutline: true, generateTaggedPDF: true,
    });
    writeFileSync(pdfPath, Buffer.from(data, "base64"));
    return { pages: Number(state.pdfPages), over: state.pdfOver ? state.pdfOver.split(",").map(Number) : [], broken: Number(state.pdfBroken || 0) };
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
  }
}

/* ── EPUB: a plain reflowable copy, as before ──────────────────────── */

// The reader's text, made plain for an e-reader: the essay counter ("2 of
// 11") and the "Next essay" link are reader furniture and come out. Each
// essay's wrapper is removed and its title becomes a top-level heading
// carrying the essay's id, because pandoc builds the EPUB's contents from
// headings that are not nested inside another element. Section headings
// move up one level to sit under it.
function epubHtml(book, { title, article }) {
  let body = article
    .replace(/<a class="rd-next"[\s\S]*?<\/a>/g, "")
    .replace(/<p class="rd-essay-n">[\s\S]*?<\/p>/g, "")
    .replace(/<(\/?)h3\b/g, "<$1h2~")
    .replace(/<section\b([^>]*)>([\s\S]*?)<h2\b(?!~)[^>]*>([\s\S]*?)<\/h2>/g, (_, attrs, before, heading) => {
      const id = (attrs.match(/\bid="([^"]+)"/) || [])[1];
      return `${before}<h1${id ? ` id="${id}"` : ""}>${heading}</h1>`;
    })
    .replace(/<\/?section\b[^>]*>/g, "")
    .replace(/<(\/?)h2~/g, "<$1h2")
    .replace(/^<article\b[^>]*>/, "").replace(/<\/article>$/, "");
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${escHtml(title)}</title></head><body>${body}</body></html>`;
}
function hasPandoc() {
  try { execSync("command -v pandoc", { stdio: "ignore" }); return true; } catch (_) { return false; }
}
function renderEpub(htmlPath, epubPath, book, title) {
  const meta = [`--metadata=title:"${title}"`, book.subtitle ? `--metadata=subtitle:"${book.subtitle}"` : "",
    '--metadata=author:"Mere Orthodoxy"', '--metadata=publisher:"Mere Orthodoxy"', '--metadata=lang:"en-US"'].filter(Boolean).join(" ");
  execSync(`pandoc "${htmlPath}" -o "${epubPath}" -f html -t epub3 --toc-depth=2 ${meta}`, { stdio: "inherit" });
}

/* ── Main ──────────────────────────────────────────────────────────── */

async function main() {
  mkdirSync(BUILD_DIR, { recursive: true });
  mkdirSync(OUT_DIR, { recursive: true });
  const only = process.argv[2];
  const books = only ? BOOKS.filter((b) => b.slug === only) : BOOKS;
  if (only && !books.length) {
    console.error(`No book with slug "${only}". Known: ${BOOKS.map((b) => b.slug).join(", ")}`);
    process.exit(1);
  }
  const pandoc = hasPandoc();
  if (!pandoc) console.log("pandoc not found: EPUBs are left as they are.");
  const browser = await launch();
  console.log(`browser: ${browser.bin}`);
  let failed = false;
  try {
    for (const book of books) {
      console.log(`\n[${book.slug}]`);
      if (book.skip) { console.log(`  skipped: ${book.skip}`); continue; }
      const parts = readBook(book);
      const htmlPath = join(BUILD_DIR, `${book.slug}.html`);
      writeFileSync(htmlPath, printHtml(book, parts), "utf8");
      const pdfPath = join(OUT_DIR, `${book.slug}.pdf`);
      const r = await renderPdf(browser, htmlPath, pdfPath);
      console.log(`  ${pdfPath.replace(`${THEME_ROOT}/`, "")}: ${r.pages} pages`);
      if (r.over.length) { failed = true; console.error(`  ✗ text runs past the page box on page(s) ${r.over.join(", ")}`); }
      if (r.broken) { failed = true; console.error(`  ✗ ${r.broken} image(s) did not load`); }
      if (pandoc) {
        const epubSrc = join(BUILD_DIR, `${book.slug}.epub.html`);
        writeFileSync(epubSrc, epubHtml(book, parts), "utf8");
        renderEpub(epubSrc, join(OUT_DIR, `${book.slug}.epub`), book, parts.title);
        console.log(`  ${book.slug}.epub`);
      }
    }
  } finally {
    await browser.close();
  }
  if (failed) { console.error("\nBuilt with problems (see ✗ above)."); process.exit(1); }
  console.log("\nDone.");
}

main().catch((err) => { console.error(`\nbuild-ebook-pdfs: ${err.message}`); process.exit(1); });
