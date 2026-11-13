#!/usr/bin/env node
// Daily Liturgy data check. Run: npm run check:liturgy-data
//
// Fails if any text in devotionals.json or calendar.json carries markup:
// inline CSS, HTML tags or attributes, entities, braces. The Deploy Ghost
// Theme workflow runs this before uploading, so bad prayer text cannot reach
// the reader page, the email (mo-kit reads this file) or the YouTube render.
//
// Why: on 2026-11-13 the email and the reader both showed
// "--stroke-style: none;--stroke-thickness: 6px;" after three prayers. The
// text had been scraped from Coram Deo's Squarespace archive on 2026-10-14
// and carried a divider block's inline CSS with it.
//
// The patterns match mo-workers kit/lib/liturgy-guard.js. Keep them in step.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "assets/data/daily-liturgy");

const LEAK_PATTERNS = [
  { code: "css-custom-property", re: /--[a-z][a-z0-9-]*\s*:\s*[^;\n]{0,40};/ },
  { code: "css-declaration", re: /\b[a-z]+(?:-[a-z]+)+\s*:\s*(?:[a-z-]+|#[0-9a-fA-F]{3,8}|-?\d[\d.]*(?:px|em|rem|%|vh|vw)?)(?:\s+(?:[a-z-]+|-?\d[\d.]*(?:px|em|rem|%)?)){0,2}\s*;/ },
  { code: "css-declaration", re: /\b(?:color|display|margin|padding|width|height|border|background|font|opacity|position)\s*:\s*(?:[a-z-]+|#[0-9a-fA-F]{3,8}|-?\d[\d.]*(?:px|em|rem|%|vh|vw)?)(?:\s+(?:[a-z-]+|-?\d[\d.]*(?:px|em|rem|%)?)){0,2}\s*;/ },
  { code: "css-length", re: /\b\d+(?:\.\d+)?(?:px|rem|em|vh|vw)\b/i },
  { code: "html-tag", re: /<\/?[a-z][a-z0-9-]*(?:\s[^>]*)?\/?>/i },
  { code: "html-entity", re: /&(?:[a-z]{2,8}|#\d{2,6}|#x[0-9a-f]{2,6});/i },
  { code: "html-attribute", re: /\b(?:style|class|data-[a-z-]+|aria-[a-z-]+)\s*=\s*["']/i },
  { code: "squarespace-class", re: /\bsqs-[a-z-]+/i },
  { code: "brace", re: /[{}]/ },
];

const problems = [];
function walk(v, where) {
  if (typeof v === "string") {
    for (const { code, re } of LEAK_PATTERNS) {
      const m = v.match(re);
      if (m) {
        const i = m.index || 0;
        problems.push(`${where}: ${code} near "${v.slice(Math.max(0, i - 30), i + m[0].length + 10).replace(/\s+/g, " ").trim()}"`);
      }
    }
  } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${where}[${i}]`));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, `${where}.${k}`);
}

let files = 0;
for (const name of ["devotionals.json", "calendar.json"]) {
  const p = path.join(DIR, name);
  if (!fs.existsSync(p)) continue;
  files++;
  let data;
  try { data = JSON.parse(fs.readFileSync(p, "utf8")); }
  catch (e) { problems.push(`${name}: not valid JSON (${e.message})`); continue; }
  walk(data, name.replace(/\.json$/, ""));
}

if (!files) { console.error("check-liturgy-data: no Daily Liturgy data files found"); process.exit(1); }
if (problems.length) {
  console.error(`check-liturgy-data: ${problems.length} problem(s). Remove the markup from the source text before deploying.`);
  for (const p of problems.slice(0, 50)) console.error("  " + p);
  process.exit(1);
}
console.log(`check-liturgy-data: ${files} file(s) clean`);
