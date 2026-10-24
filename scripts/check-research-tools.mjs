#!/usr/bin/env node
/*
 * The Research tools are declared in four places and all four must agree (the three-places rule, FEATURE-GATE tier note):
 *   1. scripts/data/research-tools.json   the registry: name, group, href, feature key, purpose line, server tier
 *   2. partials/faith-received/_tfr-rail.hbs   the Research drawer: same hrefs, in order, each with data-feature-gate = the key
 *   3. assets/js/feature-gate.js   a FEATURES entry per key (and a route entry for the tools that have their own page)
 *   4. the page templates   each page-gated template serves its tool only inside {{#if @member}}
 * and the Research page index (custom-faith-research.hbs) lists every tool with the registry's purpose line and key, and How to use
 * marks each Research tool block "Needs a free account". Pass --workers <path to mo-workers> to also assert that every tool declared
 * 'member' has its route behind a member check in the worker. Run: node scripts/check-research-tools.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const reg = JSON.parse(read("scripts/data/research-tools.json"));
let bad = 0;
const fail = (m) => { bad += 1; console.error(`FAIL  ${m}`); };
const ok = (m) => console.log(`ok    ${m}`);

const rail = read("partials/faith-received/_tfr-rail.hbs");
const dStart = rail.indexOf('id="tfrDrawerResearch"');
const drawer = rail.slice(dStart, rail.indexOf("</div>", dStart));
const railLinks = [...drawer.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map((m) => ({ href: m[1], name: m[2].trim(), gate: (m[0].match(/data-feature-gate="([^"]+)"/) || [])[1] }));
if (railLinks.length !== reg.tools.length) fail(`the rail's Research drawer has ${railLinks.length} links, the registry ${reg.tools.length}`);
reg.tools.forEach((t, i) => {
  const r = railLinks[i];
  if (!r) return;
  if (r.name !== t.name) fail(`rail position ${i + 1} is "${r.name}", registry says "${t.name}"`);
  if (r.href !== t.href) fail(`rail ${t.name}: href ${r.href} != ${t.href}`);
  if (r.gate !== t.gate) fail(`rail ${t.name}: data-feature-gate ${r.gate} != ${t.gate}`);
});
if (!bad) ok(`the rail's Research drawer matches the registry (${reg.tools.length} tools, hrefs, order, keys)`);

const fg = read("assets/js/feature-gate.js");
const keys = new Set([...reg.tools.map((t) => t.gate), reg.research.gate]);
for (const k of keys) {
  const q = k.includes("-") ? `"${k}"` : `(?:"${k}"|\\b${k})`;
  if (!new RegExp(`${q}\\s*:`).test(fg)) fail(`feature-gate.js has no FEATURES entry for "${k}"`);
}
for (const t of reg.tools) {
  const u = new URL(t.href, "https://x");
  const seg = u.pathname.replace("/the-faith-received/", "").split("/")[0];
  if (seg === "research" || seg === "search" || seg === "") continue;
  if (!new RegExp(`"${seg}"\\s*:\\s*"${t.gate}"`).test(fg)) fail(`feature-gate.js TFR_TOOL_ROUTES does not map /${seg}/ to "${t.gate}"`);
}
ok("feature-gate.js declares every key and routes every tool page");

for (const f of reg.pageGated) {
  const s = read(f);
  if (!/\{\{#if @member\}\}/.test(s)) fail(`${f} does not serve its tool inside {{#if @member}}`);
  if (!/data-gate-on-arrival/.test(s) && !/_research-gate/.test(s)) fail(`${f} has no signed-out gate (data-gate-on-arrival or _research-gate)`);
}
for (const t of reg.tools.filter((x) => x.page.endsWith(".hbs"))) {
  const s = read(t.page);
  if (!s.includes(`feature="${t.gate}"`)) fail(`${t.page} does not call _research-gate with feature="${t.gate}"`);
}
ok("every tool page is wrapped in {{#if @member}} with a signed-out gate");

const page = read(reg.research.template);
const idx = page.slice(page.indexOf('class="rx-index"'), page.indexOf("</section>\n\n  {{!-- THE DESK"));
for (const t of reg.tools) {
  const row = new RegExp(`<span class="rx-name">${t.name}</span><span class="rx-what">([^<]*)</span></div><a class="rx-open" href="([^"]+)" data-feature-gate="([^"]+)"`).exec(idx);
  if (!row) { fail(`the Research page index has no row for ${t.name}`); continue; }
  if (row[1].replace(/&[a-z]+;/g, "") !== t.what.replace(/'/g, "'")) fail(`index purpose for ${t.name} differs from the registry`);
  if (row[2] !== t.href) fail(`index href for ${t.name}: ${row[2]} != ${t.href}`);
  if (row[3] !== t.gate) fail(`index key for ${t.name}: ${row[3]} != ${t.gate}`);
  if (!idx.includes(`<h3 id=`) || !idx.includes(t.group)) fail(`index group "${t.group}" missing`);
}
ok("the Research page index lists every tool with the registry's words, address and key");

const htu = read("custom-faith-how-to-use.hbs");
for (const t of reg.tools) {
  const re = new RegExp(`<a class="ht-btn"[^>]*href="${t.href.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}[^"]*"[^>]*>Try it`, "g");
  for (const m of htu.matchAll(re)) {
    const block = htu.slice(htu.lastIndexOf("<article", m.index), m.index);
    if (!/Needs a free account/.test(block)) fail(`How to use: the ${t.name} block lacks "Needs a free account"`);
  }
}
ok('How to use marks every Research tool block "Needs a free account"');

const wi = process.argv.indexOf("--workers");
if (wi > 0) {
  const w = resolve(process.argv[wi + 1]);
  const lib = join(w, "tfr-library/worker.js"), ask = join(w, "tfr-library/ask-dev/worker.js"), kit = join(w, "kit/kit.js");
  const all = [lib, ask, kit].filter(existsSync).map((f) => readFileSync(f, "utf8")).join("\n");
  for (const t of reg.tools.filter((x) => x.server === "member")) for (const r of t.serverRoutes) {
    if (!all.includes(r)) fail(`${t.name}: worker route ${r} not found`);
  }
  if (!/requireLibraryMember|requireMember/.test(all)) fail("no member check found in the workers");
  ok("workers: every 'member' tool's route exists behind a member check");
}
if (bad) { console.error(`\n${bad} problem(s). The tools are declared in the registry, the rail, feature-gate.js and the templates; fix the one that drifted.`); process.exit(1); }
console.log("\nResearch tools agree in every place.");
