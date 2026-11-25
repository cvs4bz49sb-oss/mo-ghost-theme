#!/usr/bin/env node
/*
 * check-page-keys — the heatmap's page buckets (assets/js/page-key.js).
 *
 * Every page family on the site must land in a named bucket, and every
 * bucket the classifier can return must be on its KEYS list, because the
 * worker (mo-admin lib/heatmap-pages.js, a mirror of KEYS) drops any
 * beacon whose page it does not know. When the workers checkout sits
 * beside this one, the two lists are compared as well.
 *
 *   node scripts/check-page-keys.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const src = readFileSync(path.join(ROOT, "assets/js/page-key.js"), "utf8");

const ctx = { window: {}, document: { body: { className: "" } } };
vm.createContext(ctx);
vm.runInContext(src, ctx);
const pageKey = ctx.window.MOPageKey;
const { classify, KEYS } = pageKey;

// A stand-in document answering only the two DOM tells classify() reads.
const docWith = (...selectors) => ({ querySelector: (sel) => (selectors.includes(sel) ? {} : null) });
const none = docWith();

const CASES = [
  ["/", "", none, "home"],
  ["/the-world-that-will-not-stay/", "post-template tag-author-benjamin-shear tag-formation", none, "post"],
  ["/some-event/", "post-template tag-hash-event", docWith("[data-event-post]"), "event"],
  ["/transcripts/mere-fidelity-123/", "post-template", none, "transcript"],
  ["/the-faith-received/", "", none, "tfr-home"],
  ["/the-faith-received/read/", "", none, "tfr-reader"],
  ["/the-faith-received/read", "", none, "tfr-reader"],
  ["/the-faith-received/review/", "", none, "tfr-reader"],
  ["/the-faith-received/reader/", "", none, "tfr-reader-classic"],
  ["/the-faith-received/heidelberg/", "", docWith("main.faith-doc"), "tfr-document"],
  ["/the-faith-received/anf-barnabas/", "", docWith("main.faith-doc"), "tfr-document"],
  ["/the-faith-received/augustine-confessions/", "", docWith("main.faith-doc"), "tfr-document"],
  ["/the-faith-received/scripture/", "", none, "tfr-scripture"],
  ["/the-faith-received/scripture/desk/", "", none, "tfr-scripture"],
  ["/the-faith-received/bible/", "", none, "tfr-scripture"],
  ["/the-faith-received/topics/", "", none, "tfr-topics"],
  ["/the-faith-received/topics/prayer/", "", none, "tfr-topics"],
  ["/the-faith-received/doctrines/", "", none, "tfr-topics"],
  ["/the-faith-received/authors/", "", none, "tfr-authors"],
  ["/the-faith-received/author/", "", none, "tfr-authors"],
  ["/the-faith-received/fathers/reading-guides/", "", none, "tfr-authors"],
  ["/the-faith-received/curated/", "", none, "tfr-curated"],
  ["/the-faith-received/browse/", "", none, "tfr-curated"],
  ["/the-faith-received/all-works/", "", none, "tfr-library"],
  ["/the-faith-received/centuries/", "", none, "tfr-library"],
  ["/the-faith-received/puritans/", "", none, "tfr-collections"],
  ["/the-faith-received/patrologia-graeca/", "", none, "tfr-collections"],
  ["/the-faith-received/augustine/", "", none, "tfr-collections"],
  ["/the-faith-received/search/", "", none, "tfr-search"],
  ["/the-faith-received/research/", "", none, "tfr-search"],
  ["/the-faith-received/ask/", "", none, "tfr-ask"],
  ["/the-faith-received/pins/", "", none, "tfr-workspace"],
  ["/the-faith-received/desk/", "", none, "tfr-workspace"],
  ["/the-faith-received/compare/", "", none, "tfr-workspace"],
  ["/the-faith-received/manifesto/", "", none, "tfr-other"],
  ["/daily-liturgy/", "", none, "liturgy"],
  ["/daily-liturgy/read/", "", none, "liturgy-reader"],
  ["/daily-liturgy/advent/", "", none, "liturgy-advent"],
  ["/membership/", "", none, "membership"],
  ["/offer/", "", none, "offer"],
  ["/kirk-offer/", "", none, "offer"],
  ["/welcome-back/", "page-template page-welcome-back", none, "offer"],
  ["/student/", "", none, "student"],
  ["/groups/", "", none, "groups"],
  ["/institutions/", "", none, "institutions"],
  ["/institutions/checkout/", "", none, "institutions"],
  ["/join/", "", none, "institutions"],
  ["/welcome/", "", none, "welcome"],
  ["/complete-membership/", "", none, "complete-membership"],
  ["/success/", "", none, "success"],
  ["/manage/", "", none, "account"],
  ["/give/", "", none, "give"],
  ["/give/lifetime/", "", none, "give-lifetime"],
  ["/year-end/", "", none, "year-end"],
  ["/podcasts/mere-fidelity/", "", none, "podcast"],
  ["/podcasts/christians-reading-classics/", "", none, "podcast"],
  ["/journal/", "", none, "journal"],
  ["/journal/preview/", "", none, "journal"],
  ["/tag/culture/", "tag-template tag-culture", none, "tag"],
  ["/tag/culture/page/2/", "tag-template tag-culture paged", none, "tag"],
  ["/tag/author-jake-meador/", "tag-template tag-author-jake-meador", none, "author"],
  ["/author/jake/", "author-template author-jake", none, "author"],
  ["/contributors/", "", none, "contributors"],
  ["/contributors/all/", "", none, "contributors"],
  ["/archive/", "", none, "archive"],
  ["/archive/page/3/", "", none, "archive"],
  ["/page/2/", "home-template paged", none, "archive"],
  ["/search/", "", none, "search"],
  ["/about/", "", none, "about"],
  ["/events/", "", none, "events"],
  ["/forum/", "", none, "forum"],
  ["/contact/", "", none, "contact"],
  ["/submissions/", "", none, "submissions"],
  ["/writers-meetings/", "", none, "writers-meetings"],
  ["/sponsorship/", "", none, "sponsorship"],
  ["/store/", "", none, "store"],
  ["/books/", "", none, "store"],
  ["/ebooks/", "", none, "ebooks"],
  ["/ebook/formation/", "", none, "ebooks"],
  ["/dashboard/", "", none, "dashboard"],
  ["/dashboard/bookmarks/", "", none, "dashboard"],
  ["/bible/", "", none, "bible"],
  ["/privacy/", "", none, "other"],
  ["/some-ghost-page/", "page-template page-some-ghost-page", none, "page"],
  ["/admin/", "", none, null],
  ["/admin/heatmap/", "", none, null],
  ["/digest-gen/", "", none, null],
];

let failed = 0;
for (const [p, cls, doc, want] of CASES) {
  const got = classify(p, cls, doc);
  if (got !== want) {
    failed += 1;
    console.error(`  ✗ ${p} [${cls}] -> ${got}, want ${want}`);
  }
  if (got !== null && !KEYS.includes(got)) {
    failed += 1;
    console.error(`  ✗ ${p} -> ${got}, which is not in KEYS (the worker would drop it)`);
  }
}

if (new Set(KEYS).size !== KEYS.length) {
  failed += 1;
  console.error("  ✗ KEYS has a duplicate");
}

// Every key should be reachable from some case, so a stale key is noticed.
const reached = new Set(CASES.map((c) => c[3]).filter(Boolean));
for (const k of KEYS) {
  if (!reached.has(k)) {
    failed += 1;
    console.error(`  ✗ KEYS has ${k}, which no case above produces`);
  }
}

// The worker's mirror, when the workers checkout is beside this one.
const mirrors = [
  path.resolve(ROOT, "../workers/admin/lib/heatmap-pages.js"),
];
const mirror = mirrors.find((f) => existsSync(f));
if (mirror) {
  const ws = readFileSync(mirror, "utf8");
  const block = /export const HM_PAGES = \[([\s\S]*?)\];/.exec(ws);
  const workerKeys = block ? [...block[1].matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]) : [];
  const a = [...KEYS].sort().join(",");
  const b = [...workerKeys].sort().join(",");
  if (a !== b) {
    failed += 1;
    console.error(`  ✗ KEYS and the worker's HM_PAGES (${mirror}) differ`);
  }
}

if (failed) {
  console.error(`\ncheck-page-keys: ${failed} problem(s)`);
  process.exit(1);
}
console.log(`  ✓ page keys: ${CASES.length} paths, ${KEYS.length} keys${mirror ? ", worker list matches" : ""}`);
