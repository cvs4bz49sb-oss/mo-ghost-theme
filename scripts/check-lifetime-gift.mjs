#!/usr/bin/env node
/*
 * check-lifetime-gift: contract check for the lifetime-member gift surfaces.
 *
 *   node scripts/check-lifetime-gift.mjs
 *   node scripts/check-lifetime-gift.mjs --harness <outdir>
 *
 * The first form is the CI check. It asserts the markup and script rules that
 * keep two real bugs from returning: the "Sent!" confirmation living inside
 * the form that is hidden after the last credit, and the address note or the
 * gift line on /complete-membership/ showing before the worker that makes
 * them true is live.
 *
 * The second form writes two static pages (dash.html, survey.html) built from
 * the real partial and template, with the API stubbed in the page, so the
 * behaviour can be driven in real Chrome without Ghost and without any
 * network. See scripts/lifetime-gift-chrome-test.md for the scenarios.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const dashPartial = read("partials/dashboard-body.hbs");
const dashJs = read("assets/js/dashboard.js");
const surveyHbs = read("custom-complete-membership.hbs");
const surveyJs = read("assets/js/page/welcome-survey.js");
const strip = (s) => s.replace(/\{\{!--[\s\S]*?--\}\}/g, "");

const failures = [];
const need = (ok, msg) => { if (!ok) failures.push(msg); };

// ---- dashboard block
const blockStart = dashPartial.indexOf("data-lifetime-gift hidden");
const block = strip(dashPartial.slice(dashPartial.lastIndexOf("<div", blockStart), dashPartial.indexOf("data-lifetime-gift-list", blockStart) + 60));
const formOpen = block.indexOf("<form");
const formClose = block.indexOf("</form>");
const doneAt = block.indexOf("data-lifetime-gift-done");
need(formOpen > -1 && formClose > formOpen, "gift form not found");
need(doneAt > formClose, "the Sent! confirmation must sit outside the form, or it is hidden with the form after the last credit");
need(/data-lifetime-gift-done[^>]*hidden/.test(block), "the Sent! confirmation must start hidden");
need(/data-lifetime-gift-address-note[^>]*hidden/.test(block), "the address note must start hidden");
need(/data-lifetime-gift-error[^>]*hidden/.test(block), "the error line must start hidden");
need(/data\.asks_address\s*===\s*true/.test(dashJs), "the address note must show only when the worker says asks_address === true");
need(/wrap\.querySelector\("\[data-lifetime-gift-done\]"\)/.test(dashJs), "dashboard.js must look for the confirmation in the block, not the form");
need(!/form\.querySelector\("\[data-lifetime-gift-done\]"\)/.test(dashJs), "dashboard.js still looks for the confirmation inside the form");

// ---- survey page
need(/data-gift-note[^>]*hidden/.test(surveyHbs), "the gift line must start hidden");
need(/data-step="8"[^>]*data-answered-by="join"[^>]*data-gift-skip/.test(surveyHbs), "the 'what prompted you to become a member' step must carry data-gift-skip");
need(/d\.gift\s*===\s*"lifetime"/.test(surveyJs), "welcome-survey.js must act on the server's gift flag only");
need(!/location\.search|URLSearchParams/.test(surveyJs), "welcome-survey.js must not read the gift state from the URL");
need(!/data-gift-skip/.test(read("custom-welcome.hbs")), "/welcome/ (free signup) must not use the gift skip");

// ---- copy
for (const [name, text] of [["partial", block], ["survey", strip(surveyHbs)]]) {
  need(!/—/.test(text.match(/(lifetime member|mailing address)[^<]*/g)?.join(" ") || ""), `${name}: em dash in gift copy`);
}

const harness = process.argv.indexOf("--harness");
if (harness > -1) {
  const out = process.argv[harness + 1];
  if (!out) { console.error("--harness needs an output directory"); process.exit(2); }
  mkdirSync(join(out, "css"), { recursive: true });
  mkdirSync(join(out, "js"), { recursive: true });
  copyFileSync(join(root, "assets/built/screen.css"), join(out, "css/screen.css"));
  copyFileSync(join(root, "assets/js/dashboard.js"), join(out, "js/dashboard.js"));
  copyFileSync(join(root, "assets/js/page/welcome-survey.js"), join(out, "js/welcome-survey.js"));
  const dashBody = block.replace(/<div class="dashboard-rail-sep"[^>]*><\/div>/g, "");
  const dashStub = `<script>
window.__posts = [];
window.__mode = new URLSearchParams(location.search).get("mode") || "eligible2";
window.MOAuth = { fetch(u, o) {
  const m = (o && o.method) || "GET";
  const R = (ok, b) => Promise.resolve({ ok, json: () => Promise.resolve(b) });
  if (/lifetime-gift\\/status/.test(u)) {
    if (__mode === "ineligible") return R(true, { eligible: false });
    if (__mode === "failed") return R(false, null);
    const one = __mode === "eligible1";
    return R(true, { eligible: true, credits_total: 2, credits_remaining: one ? 1 : 2, asks_address: __mode !== "oldworker",
      gifts: one ? [{ recipient_email: "old@example.test", recipient_name: "Old Friend", status: "active" }] : [] });
  }
  if (/api\\/lifetime-gift$/.test(u) && m === "POST") {
    const b = JSON.parse(o.body); window.__posts.push(b);
    if (/bad/.test(b.recipient_email)) return R(false, { error: "That person already has a membership, so a gift wouldn't add anything." });
    window.__left = (window.__left == null ? (__mode === "eligible1" ? 1 : 2) : window.__left) - 1;
    return R(true, { ok: true, credits_remaining: window.__left });
  }
  return R(false, null);
} };
</script>`;
  writeFileSync(join(out, "dash.html"), `<!doctype html><html><head><meta charset="utf-8"><meta name="mo-api-base" content="https://api.invalid"><link rel="stylesheet" href="css/screen.css"></head><body data-member-email="lifer@example.test" style="max-width:300px;margin:20px"><div class="dashboard-rail">${dashBody}</div>${dashStub}<script src="js/dashboard.js"></script></body></html>`);
  const main = strip(surveyHbs.slice(surveyHbs.indexOf('<main class="welcome-page">'), surveyHbs.indexOf("</main>", surveyHbs.indexOf('<main class="welcome-page">')) + 7))
    .replace("{{@member.name}}", "Test Reader").replace("{{@custom.membership_api_base}}", "https://api.invalid");
  const surveyStub = `<script>
window.__calls = [];
window.MOAuth = { fetch(u, o) {
  window.__calls.push({ u: String(u).replace("https://api.invalid", ""), m: (o && o.method) || "GET", b: o && o.body ? JSON.parse(o.body) : null });
  if (/welcome-survey\\/me/.test(u)) return Promise.resolve({ ok: true, json: () => Promise.resolve(new URLSearchParams(location.search).get("gift") === "1" ? { answered: false, gift: "lifetime" } : { answered: false, gift: null }) });
  return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
} };
</script>`;
  writeFileSync(join(out, "survey.html"), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="css/screen.css"></head><body>${surveyStub}${main}<script src="js/welcome-survey.js"></script></body></html>`);
  console.log(`harness written to ${out}`);
}

if (failures.length) {
  console.error(failures.map((f) => `  FAIL ${f}`).join("\n"));
  process.exit(1);
}
console.log("lifetime-gift contract: ok");
