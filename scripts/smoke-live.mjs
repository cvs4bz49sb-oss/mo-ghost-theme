#!/usr/bin/env node
/*
 * smoke-live: load every fixed path in routes.yaml on the live site and
 * fail if any of them errors.
 *
 *   node scripts/smoke-live.mjs                       # https://mereorthodoxy.com
 *   node scripts/smoke-live.mjs --base https://...    # another host
 *   node scripts/smoke-live.mjs --json out.json       # also write every status
 *
 * A path passes on 200 or on a redirect (member-only pages answer 301 to a
 * signed-out visitor). Anything 400 or above, or no answer at all, fails.
 * Paths with a {slug} in them are skipped: there is nothing fixed to load.
 *
 * It reads only, sends no cookies and posts nothing. Run it before and
 * after a deploy; the Live Smoke workflow runs it after every theme deploy.
 * routes.yaml is uploaded to Ghost by hand, so a route added in the repo and
 * not yet uploaded shows here as a 404. That is a true report, not a flake.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const base = arg("--base", "https://mereorthodoxy.com").replace(/\/$/, "");
const jsonOut = arg("--json", null);
const CONCURRENCY = 6;
const TIMEOUT_MS = 30000;
const ALWAYS = ["/", "/about/", "/membership/", "/rss/"];

const yaml = readFileSync(join(root, "routes.yaml"), "utf8");
const paths = [...ALWAYS];
for (const m of yaml.matchAll(/^ {2}(\/[^\s:]*):/gm)) {
  const p = m[1];
  if (!p.includes("{") && !paths.includes(p)) paths.push(p);
}

async function check(path) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(base + path, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "user-agent": "mo-theme-smoke/1 (+https://mereorthodoxy.com)" },
      });
      await res.arrayBuffer().catch(() => {});
      if (res.status < 500 || attempt === 2) return { path, status: res.status };
    } catch (e) {
      if (attempt === 2) return { path, status: 0, error: String(e.message || e) };
    }
  }
  return { path, status: 0 };
}

const results = [];
let next = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (next < paths.length) {
      const p = paths[next++];
      results.push(await check(p));
    }
  }),
);
results.sort((a, b) => paths.indexOf(a.path) - paths.indexOf(b.path));

const bad = results.filter((r) => r.status === 0 || r.status >= 400);
const counts = {};
for (const r of results) counts[r.status] = (counts[r.status] || 0) + 1;
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ base, results }, null, 2) + "\n");

console.log(`${base}: ${results.length} paths. ` + Object.entries(counts).map(([s, n]) => `${s} x ${n}`).join(", "));
if (bad.length) {
  for (const r of bad) console.log(`  FAIL ${r.status || "no answer"} ${r.path}${r.error ? ` (${r.error})` : ""}`);
  process.exit(1);
}
console.log("All paths answered.");
