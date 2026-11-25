#!/usr/bin/env node
/*
 * Bring MOOS into the theme for /admin/moos/app/ (MOCA website/moos/WEB.md,
 * piece B).
 *
 * MOOS is written in the MOCA as a Claude artifact: website/moos/moos.html
 * (a <style>, the markup, one inline <script type="module"> core, then
 * <script type="module" src="parts/..."> tags), website/moos/parts/** and
 * website/moos/geo/*.json. This script turns that into theme files:
 *
 *   assets/moos/moos.css        the <style> block
 *   assets/moos/moos.js         the inline core module (the CSP has no
 *                               'unsafe-inline' for scripts, so it cannot
 *                               stay inline)
 *   assets/moos/web.js          parts/web.js, the web adapter (piece C),
 *                               which the host page loads before MOOS
 *   assets/moos/parts/**        every other part
 *   assets/moos/docs/**         the Documents section's JSON, PDFs and images, byte for byte
 *   assets/moos/geo/*.<hash>.json  the map outlines, the content hash in the
 *                               name because the core fetches them by bare
 *                               path and a bare /assets/ path can be served
 *                               stale (FRONTEND-AGENT 6.51 and 6.53)
 *   partials/moos-app-head.hbs  fonts, the MOOS stylesheet, d3 and topojson
 *   partials/moos-app-body.hbs  the markup, web.js, the core and the parts
 *
 * custom-admin-moos-app.hbs includes the two partials. Everything under
 * assets/moos/ and both partials are generated: edit MOOS in the MOCA and
 * re-run this, never the output.
 *
 * Rewrites, all checked (the build fails rather than ship a MOOS the page
 * would block):
 *   - cdnjs d3 7.9.0, topojson 3.0.2 and xlsx 0.18.5 become the same files
 *     from cdn.jsdelivr.net, which the site's CSP allows, with SRI. Any other
 *     cdnjs URL fails the build: add it to CDN below.
 *   - "geo/<name>.json" literals become /assets/moos/geo/<name>.<hash>.json.
 *   - The artifact manifest and <title> are dropped (the template has its own).
 *
 * Usage:
 *   node scripts/build-moos.mjs [source] [--check]
 *
 *   source   the MOCA root, or its website/moos folder. Default: ../moos when
 *            this repo is the MOCA's website/ghost-theme, else the MOCA path
 *            on the office Mac mini.
 *   --check  write nothing; exit 1 if the committed output differs from what
 *            the source would build.
 *
 * Idempotent: the same source always writes the same bytes, and assets/moos/
 * is rebuilt from empty so a part deleted in the MOCA leaves the theme too.
 * Commit the output.
 */
import { createHash } from "node:crypto";
import { existsSync, promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MOCA_DEFAULT = "/Users/ianharber/Library/Mobile Documents/com~apple~CloudDocs/Mere Orthodoxy/Mere Orthodoxy Claude Agent";
const OUT = "assets/moos";
const HEAD_PARTIAL = "partials/moos-app-head.hbs";
const BODY_PARTIAL = "partials/moos-app-body.hbs";

// cdnjs file -> the same bytes on jsDelivr (checked byte for byte 2026-11-25;
// d3's SRI matches custom-faith-guide.hbs).
const CDN = {
  "https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js": {
    url: "https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js",
    sri: "sha384-CjloA8y00+1SDAUkjs099PVfnY2KmDC2BZnws9kh8D/lX1s46w6EPhpXdqMfjK6i",
  },
  "https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js": {
    url: "https://cdn.jsdelivr.net/npm/topojson@3.0.2/dist/topojson.min.js",
    sri: "sha384-9dCJK6nh7skY14HrcvlLYlFga9/MehJjL9ONWRflmiXNRuf8p2jiF4Y5PR881PTq",
  },
  "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js": {
    url: "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
    sri: "sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw",
  },
};

const args = process.argv.slice(2);
const checkMode = args.includes("--check");
const srcArg = args.find((a) => !a.startsWith("--"));

const fail = (msg) => {
  console.error(`build-moos: ${msg}`);
  process.exit(1);
};

function resolveSource() {
  const candidates = srcArg
    ? [path.resolve(srcArg), path.resolve(srcArg, "website/moos")]
    : [path.resolve(REPO, "../moos"), path.join(MOCA_DEFAULT, "website/moos")];
  for (const dir of candidates) if (existsSync(path.join(dir, "moos.html"))) return dir;
  fail(`no moos.html in ${candidates.join(" or ")}. Pass the MOCA root or its website/moos folder.`);
}

const SRC = resolveSource();
const sha = (buf) => createHash("sha256").update(buf).digest("hex");
const posix = (p) => p.split(path.sep).join("/");

async function walk(dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(abs)));
    else out.push(abs);
  }
  return out.sort();
}

// ---------------------------------------------------------------- read
const html = await fs.readFile(path.join(SRC, "moos.html"), "utf8");
const manifest = [];
const note = async (abs) => {
  const st = await fs.stat(abs);
  manifest.push(`${posix(path.relative(SRC, abs))}  ${st.size} bytes  ${st.mtime.toISOString()}`);
};
await note(path.join(SRC, "moos.html"));

// ---------------------------------------------------------------- split moos.html
const styleOpen = html.indexOf("<style>");
const styleClose = html.indexOf("</style>");
const coreOpen = html.indexOf('<script type="module">');
const coreClose = coreOpen < 0 ? -1 : html.indexOf("</script>", coreOpen);
if (styleOpen < 0 || styleClose < styleOpen || coreOpen < styleClose || coreClose < 0) {
  fail("moos.html no longer reads <head bits>, <style>, markup, <script type=\"module\"> core, part tags. Update this script.");
}
if (html.indexOf("<style>", styleOpen + 1) >= 0) fail("moos.html has a second <style> block; the build expects one.");
if (html.indexOf('<script type="module">', coreOpen + 1) >= 0) fail("moos.html has a second inline module script; the build expects one.");

const headSrc = html.slice(0, styleOpen);
const css = `${html.slice(styleOpen + "<style>".length, styleClose).replace(/^\n/, "")}`;
const markup = html.slice(styleClose + "</style>".length, coreOpen).trim();
let core = html.slice(coreOpen + '<script type="module">'.length, coreClose).replace(/^\n/, "");
const tail = html.slice(coreClose + "</script>".length);

// The head: keep the font links, swap the two CDN scripts, drop the rest.
const headOut = [];
for (const raw of headSrc.split("\n")) {
  const line = raw.trim();
  if (!line) continue;
  if (/^<title>[\s\S]*<\/title>$/.test(line)) continue;
  if (/^<script type="application\/json" id="claude-artifacts-manifest">/.test(line)) continue;
  if (/^<link rel="preconnect" href="https:\/\/fonts\.(googleapis|gstatic)\.com"( crossorigin)?>$/.test(line)) { headOut.push(line); continue; }
  if (/^<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]+">$/.test(line)) { headOut.push(line); continue; }
  const script = line.match(/^<script src="([^"]+)"><\/script>$/);
  if (script) {
    const lib = CDN[script[1]];
    if (!lib) fail(`moos.html loads ${script[1]}, which is not in CDN. Add its jsDelivr copy and SRI.`);
    headOut.push(`<script src="${lib.url}" integrity="${lib.sri}" crossorigin="anonymous"></script>`);
    continue;
  }
  fail(`moos.html's head has a line this build does not know: ${line.slice(0, 120)}`);
}

// The parts, in load order.
const partTags = [];
for (const raw of tail.split("\n")) {
  const line = raw.trim();
  if (!line) continue;
  const m = line.match(/^<script type="module" src="(parts\/[a-z0-9/_-]+\.js)"><\/script>$/);
  if (!m) fail(`moos.html ends with a line this build does not know: ${line.slice(0, 120)}`);
  partTags.push(m[1]);
}
// The host page loads web.js itself, before the core. If MOOS ever lists it
// too, it would run twice.
const parts = partTags.filter((p) => p !== "parts/web.js");

if (/\{\{/.test(markup) || /\{\{/.test(headOut.join("\n"))) {
  fail("the MOOS markup contains {{, which Handlebars would read as an expression.");
}
if (/<script[\s>]/i.test(markup)) fail("the MOOS markup has a <script> of its own; the build expects scripts only after it.");
// The stylesheet moves to /assets/moos/, so a relative url() would point somewhere else, and the page's CSP
// takes fonts and images from data: and fonts.gstatic.com only (images from any https host).
if (/url\(\s*(?!["']?(data:|https:))/i.test(css)) fail("MOOS's <style> has a relative url(); it would break once moved to /assets/moos/.");
if (/@font-face[^}]*url\(\s*["']?https:\/\/(?!fonts\.gstatic\.com\/)/i.test(css)) fail("MOOS's <style> loads a font from a host the page's CSP does not allow.");
if (/@import/i.test(css)) fail("MOOS's <style> has an @import; link the stylesheet from the head instead.");

// ---------------------------------------------------------------- geo
const files = new Map(); // repo-relative path -> Buffer | string
const geoDir = path.join(SRC, "geo");
const geoNames = {};
if (existsSync(geoDir)) {
  for (const abs of await walk(geoDir)) {
    if (!abs.endsWith(".json")) continue;
    await note(abs);
    const buf = await fs.readFile(abs);
    JSON.parse(buf.toString("utf8")); // fail early on a broken outline
    const base = path.basename(abs, ".json");
    const hashed = `${base}.${sha(buf).slice(0, 10)}.json`;
    geoNames[`geo/${base}.json`] = `/${OUT}/geo/${hashed}`;
    files.set(`${OUT}/geo/${hashed}`, buf);
  }
}

// ---------------------------------------------------------------- docs
// The Documents section's files (website/moos/docs/: each document's JSON, its PDF and the images it shows), copied
// byte for byte to assets/moos/docs/. documents.js resolves "../docs/<name>" from its own URL and adds the part's ?v=,
// so these keep their names. Dotfiles (.DS_Store) stay behind.
const docsDir = path.join(SRC, "docs");
if (existsSync(docsDir)) {
  for (const abs of await walk(docsDir)) {
    if (path.basename(abs).startsWith(".")) continue;
    await note(abs);
    files.set(`${OUT}/${posix(path.relative(SRC, abs))}`, await fs.readFile(abs));
  }
}

// ---------------------------------------------------------------- rewrites
const usedLibs = new Set(); // jsDelivr URLs the page will load
headOut.forEach((line) => { const m = line.match(/src="(https:\/\/cdn\.jsdelivr\.net\/[^"]+)"/); if (m) usedLibs.add(m[1]); });

function rewrite(js, where) {
  let out = js;
  // A dynamically loaded library keeps its SRI: `src: "<cdnjs>"` in an h("script", …) call.
  out = out.replace(/src: "(https:\/\/cdnjs\.cloudflare\.com\/[^"]+)"/g, (whole, url) => {
    const lib = CDN[url];
    if (!lib) fail(`${where} loads ${url}, which is not in CDN. Add its jsDelivr copy and SRI.`);
    usedLibs.add(lib.url);
    return `src: "${lib.url}", integrity: "${lib.sri}", crossorigin: "anonymous"`;
  });
  // Any other use of cdnjs would lose its SRI or be blocked by the CSP. Teach this script the form first.
  const cdnjs = out.match(/https?:\/\/cdnjs\.cloudflare\.com\/[^"'`\s)]*/);
  if (cdnjs) fail(`${where} uses ${cdnjs[0]} in a form this build cannot carry over with SRI (only \`src: "…"\` in h("script", …)).`);
  // A remote script the page could not vouch for: anything but a jsDelivr file with SRI.
  const bare = out.match(/src: "(https?:\/\/[^"]+)"(?!, integrity: ")/);
  if (bare) fail(`${where} loads the script ${bare[1]} with no SRI, or from a host the page's CSP does not allow.`);
  const remoteImport = out.match(/\bimport\s*\(\s*["'`]https?:|\bfrom\s+["'`]https?:/);
  if (remoteImport) fail(`${where} imports a module from another site, which the page's CSP blocks.`);
  if (/<script[^>]*\ssrc=\\?["']https?:/i.test(out)) fail(`${where} writes a <script src="https://…"> tag, which the page's CSP would block.`);
  out = out.replace(/(["'`])(geo\/[a-z0-9_-]+\.json)\1/g, (whole, q, name) => {
    if (!geoNames[name]) fail(`${where} fetches ${name}, which is not in website/moos/geo/.`);
    return `${q}${geoNames[name]}${q}`;
  });
  if (/["'`](geo|parts)\//.test(out)) {
    fail(`${where} still has a relative "geo/" or "parts/" path, which would resolve under /admin/moos/app/.`);
  }
  return out;
}

core = rewrite(core, "the core script");
files.set(`${OUT}/moos.css`, css);
files.set(`${OUT}/moos.js`, core);

// ---------------------------------------------------------------- parts
const partsDir = path.join(SRC, "parts");
const onDisk = existsSync(partsDir) ? (await walk(partsDir)).filter((f) => f.endsWith(".js")) : [];
const rel = (abs) => posix(path.relative(SRC, abs));
for (const p of parts) if (!onDisk.some((abs) => rel(abs) === p)) fail(`moos.html loads ${p}, which is not on disk.`);

let webJs = null;
for (const abs of onDisk) {
  await note(abs);
  const name = rel(abs);
  const src = rewrite(await fs.readFile(abs, "utf8"), name);
  if (name === "parts/web.js") {
    webJs = src;
    files.set(`${OUT}/web.js`, src);
    continue;
  }
  if (!parts.includes(name)) console.warn(`  ! ${name} is not loaded by moos.html; copied, but nothing runs it`);
  files.set(`${OUT}/${name}`, src);
}

// web.js runs before MOOS. A classic script runs as it is parsed, ahead of
// every module; an ES module (one with top-level import/export) is tagged as a
// module and placed before the core, and modules run in document order.
const webIsModule = webJs !== null && /^\s*(import|export)\b/m.test(webJs);
if (webJs === null) console.warn("  ! website/moos/parts/web.js is missing: the page will load MOOS with no web adapter (no data). Re-run when it lands.");

// ---------------------------------------------------------------- the page's CSP
// custom-admin-moos-app.hbs pins script-src to package folders on jsDelivr. A library MOOS starts using
// has to be added there too, or the browser refuses it.
{
  const page = await fs.readFile(path.join(REPO, "custom-admin-moos-app.hbs"), "utf8");
  const scriptSrc = (page.match(/script-src ([^;"]+)/) || [])[1] || "";
  for (const url of usedLibs) {
    const folder = (url.match(/^https:\/\/cdn\.jsdelivr\.net\/npm\/[^/]+\//) || [])[0];
    if (!folder || !scriptSrc.split(/\s+/).includes(folder)) {
      fail(`MOOS loads ${url}, but custom-admin-moos-app.hbs's script-src does not list ${folder || "its package folder"}.`);
    }
  }
}

// ---------------------------------------------------------------- partials
const GENERATED = (what) =>
  `{{!-- GENERATED by scripts/build-moos.mjs from MOCA website/moos/ (${what}).\n` +
  "     Do not edit: change MOOS in the MOCA and re-run\n" +
  "     `node scripts/build-moos.mjs`. Included by custom-admin-moos-app.hbs. --}}\n";

const asset = (p) => `{{asset "${p.replace(/^assets\//, "")}"}}`;

const head = `${GENERATED("the fonts, MOOS's stylesheet and the two map libraries")}${[
  ...headOut,
  `<link rel="stylesheet" href="${asset(`${OUT}/moos.css`)}">`,
].join("\n")}\n`;

const bodyLines = [];
if (webJs !== null) {
  bodyLines.push(webIsModule
    ? `<script type="module" src="${asset(`${OUT}/web.js`)}"></script>`
    : `<script src="${asset(`${OUT}/web.js`)}"></script>`);
}
bodyLines.push(markup);
bodyLines.push(`<script type="module" src="${asset(`${OUT}/moos.js`)}"></script>`);
for (const p of parts) bodyLines.push(`<script type="module" src="${asset(`${OUT}/${p}`)}"></script>`);
const body = `${GENERATED("web.js, the markup, the core and every part, in moos.html's order")}${bodyLines.join("\n")}\n`;

files.set(HEAD_PARTIAL, head);
files.set(BODY_PARTIAL, body);

// ---------------------------------------------------------------- write or check
const same = async (relPath, data) => {
  try { return Buffer.compare(await fs.readFile(path.join(REPO, relPath)), Buffer.from(data)) === 0; }
  catch { return false; }
};
const existing = existsSync(path.join(REPO, OUT)) ? (await walk(path.join(REPO, OUT))).map((a) => posix(path.relative(REPO, a))) : [];

if (checkMode) {
  const stale = [];
  for (const [p, data] of files) if (!(await same(p, data))) stale.push(p);
  for (const p of existing) if (!files.has(p)) stale.push(`${p} (no longer in MOOS)`);
  if (stale.length) {
    console.error(`build-moos: the theme's copy of MOOS is stale against ${SRC}:`);
    for (const p of stale) console.error(`  STALE: ${p}`);
    console.error("Run `node scripts/build-moos.mjs` and commit.");
    process.exit(1);
  }
  console.log(`  OK: MOOS in the theme matches ${SRC}`);
  process.exit(0);
}

await fs.rm(path.join(REPO, OUT), { recursive: true, force: true });
let bytes = 0;
for (const [p, data] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
  const abs = path.join(REPO, p);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, data);
  bytes += Buffer.byteLength(data);
}

console.log(`build-moos: read ${SRC}`);
for (const line of manifest) console.log(`  < ${line}`);
console.log(`  > ${files.size} files, ${(bytes / 1024).toFixed(0)} KB (${parts.length} parts${webJs === null ? ", no web.js" : `, web.js as a ${webIsModule ? "module" : "classic script"}`})`);
console.log("Commit assets/moos/ and partials/moos-app-*.hbs.");
