// One-off preparation of assets/data/faith-received/mo-articles-index.json (2026-10-20): the full-text index behind the Resources search.
//
//   node scripts/prep-mo-articles-search.mjs <articles.jsonl> [--stats]
//   node scripts/prep-mo-articles-search.mjs --podcasts [--stats]   the episodes: show notes only (scripts/mo-podcasts-input.json `note`), mo-podcasts-index.json
//
// <articles.jsonl> is the catalogue's corpus (field `body`); it is NOT in the repo and no body text is written anywhere. The output holds
// term counts and postings only: no positions, no sentences, so an article cannot be rebuilt from it. It covers the articles of
// assets/data/faith-received/mo-articles.json, in that file's order.
//
// Terms: the loader's own tokenizer (assets/js/lib/mo-articles.js: folded, possessives and plurals stemmed, stopwords out, 3+ letters or
// digits), single words, plus phrases: two or three adjacent non-stopword words, and "X of Y", kept only when they occur in 2 or more
// articles. Very common words (in over 60% of articles) are dropped. Postings are [article, count] pairs, delta-encoded and written as
// one base-36 string per term: "a.c,a.c" with the article gap first and the count after the dot (count omitted when 1).
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const M = require(path.join(root, "assets/js/lib/mo-articles.js"));
const PODCASTS = process.argv.includes("--podcasts");
const src = process.argv[2];
if (!PODCASTS && (!src || src.startsWith("--"))) { console.error("usage: prep-mo-articles-search.mjs <articles.jsonl> | --podcasts"); process.exit(2); }
const DATA = PODCASTS ? "mo-podcasts.json" : "mo-articles.json";
const OUTFILE = PODCASTS ? "mo-podcasts-index.json" : "mo-articles-index.json";
const BUDGET = 700 * 1024; // the stated target, missed on purpose (see below)
const MAX = 1500 * 1024;

const data = JSON.parse(readFileSync(path.join(root, "assets/data/faith-received", DATA), "utf8"));
const ids = data.articles.map((a) => a.id);
const index = new Map(ids.map((id, i) => [id, i]));
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };
const plain = (html) => String(html || "").replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")
  .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(Number(d)))
  .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] || " ");

const bodies = new Array(ids.length);
if (PODCASTS) {
  for (const e of JSON.parse(readFileSync(path.join(root, "scripts/mo-podcasts-input.json"), "utf8")).episodes) if (index.has(e.id)) bodies[index.get(e.id)] = e.note;
} else {
  for (const line of readFileSync(src, "utf8").split("\n")) {
    if (!line) continue;
    const a = JSON.parse(line);
    if (index.has(a.id)) bodies[index.get(a.id)] = plain(a.body);
  }
}
if (bodies.some((b) => b === undefined)) throw new Error("some articles have no body in the corpus");

// per article: Map term -> count
const perArticle = bodies.map((body) => {
  const toks = M.stream(body);
  const c = new Map();
  const bump = (k) => c.set(k, (c.get(k) || 0) + 1);
  for (let i = 0; i < toks.length; i++) {
    const a = toks[i];
    if (!a || a === "of") continue;
    bump(a);
    const b = toks[i + 1];
    if (b && b !== "of") {
      bump(`${a} ${b}`);
      const c3 = toks[i + 2];
      if (c3 && c3 !== "of") bump(`${a} ${b} ${c3}`);
    } else if (b === "of") {
      const c3 = toks[i + 2];
      if (c3 && c3 !== "of") bump(`${a} of ${c3}`);
    }
  }
  return c;
});

const df = new Map();
for (const c of perArticle) for (const k of c.keys()) df.set(k, (df.get(k) || 0) + 1);
const N = ids.length;
// Words in more than 30% of the articles say nothing about one of them and cost the most postings: they are listed (`common`), not indexed.
const COMMON = Number(process.env.COMMON || 0.3);
const keep = (k) => {
  const d = df.get(k);
  if (k.includes(" ")) return d >= 2 && d <= N * 0.6;
  return d <= N * COMMON;
};
// Over budget on purpose (2026-10-20): all phrases in 2+ articles alone are 580 KB, so the 700 KB target is not reachable; the file is about 1.4 MB raw, 560 KB gzipped, loaded lazily on the first search. A word used once in the whole corpus is dropped (hapax: names and typos the title, byline and keywords already cover); MINTF=2 tunes it.
const MINTF = Number(process.env.MINTF || 2);
const postings = new Map();
for (let i = 0; i < N; i++) {
  for (const [k, n] of perArticle[i]) {
    if (!keep(k)) continue;
    // 
    if (!k.includes(" ") && n < MINTF && df.get(k) === 1) continue;
    if (!postings.has(k)) postings.set(k, []);
    postings.get(k).push([i, n]);
  }
}
const t = {};
for (const k of [...postings.keys()].sort()) {
  let prev = 0;
  t[k] = postings.get(k).map(([i, n]) => { const g = (i - prev).toString(36); prev = i; return n > 1 && !k.includes(" ") ? `${g}.${Math.min(n, 1295).toString(36)}` : g; }).join(",");
}
const common = [...df].filter(([k, d]) => !k.includes(" ") && d > N * COMMON).map(([k]) => k).sort();
const body = { v: 1, n: N, ids, common, t };
const dv = createHash("sha1").update(JSON.stringify(body)).digest("hex").slice(0, 10);
const text = `${JSON.stringify({ v: 1, dv, n: N, ids, common, t })}\n`;
const kb = Buffer.byteLength(text) / 1024;
const uni = Object.keys(t).filter((k) => !k.includes(" ")).length;
console.log(`${Object.keys(t).length} terms (${uni} words, ${Object.keys(t).length - uni} phrases), ${kb.toFixed(0)} KB, budget ${BUDGET / 1024} KB`);
if (process.argv.includes("--stats")) {
  const size = (f) => Object.entries(t).filter(([k]) => f(k)).reduce((n, [k, v]) => n + k.length + v.length + 6, 0) / 1024;
  console.log(`  words ${size((k) => !k.includes(" ")).toFixed(0)} KB, bigrams ${size((k) => k.split(" ").length === 2 && !k.includes(" of ")).toFixed(0)} KB, trigrams ${size((k) => k.includes(" of ") || k.split(" ").length === 3).toFixed(0)} KB`);
  process.exit(0);
}
if (Buffer.byteLength(text) > MAX) { console.error("over the hard limit: not written"); process.exit(1); }
writeFileSync(path.join(root, "assets/data/faith-received", OUTFILE), text);
