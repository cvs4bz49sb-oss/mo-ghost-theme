#!/usr/bin/env node
/*
 * Audit of every author's timeline, with the same reader the page uses (assets/js/lib/author-years.js).
 *
 * Sources (all the library's own; nothing here changes a date):
 *   - the 9 shelf rosters on the library worker (every research room: slug, name, birth year y, citations n, works w);
 *   - v1/authors.json on the worker (the printed dates and affiliation for 1,230 authors);
 *   - rooms the two above do not date: the room file's own `dates` (fetched, 8 at a time; --no-rooms skips this);
 *   - assets/data/faith-received/authors/people.json (the authors with no room: name, dates, church, works).
 *
 * For each author with a date string it checks that the marker lies inside the bar, that its band is the band that holds the printed
 * midpoint, that the span reads sensibly (end after start, a person's span of at most 120 years, nothing after 2000 or before year 1),
 * and that the first year agrees with the roster's birth year when there is one (within 5 years). It prints the counts and writes
 * scripts/author-timeline-audit.csv: one row per author needing a look, largest in the library first.
 *
 *   node scripts/check-author-timelines.mjs [--no-rooms]      exits 1 when the placement itself disagrees with the dates (a bug);
 *                                                              suspect dates in the data are reported, not failed.
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const Y = require("../assets/js/lib/author-years.js");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIB = "https://mo-tfr-library.mo-podcast-feed.workers.dev";
const SHELVES = ["pl", "gf", "po", "ed", "md", "rc", "lu", "rf", "hl"];
const NO_ROOMS = process.argv.includes("--no-rooms");
const get = (u) => fetch(u, { headers: { Origin: "https://mereorthodoxy.com", "User-Agent": "curl/8.7.1" } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

const rooms = new Map();
for (const sh of SHELVES) {
  const d = await get(`${LIB}/v1/bible/${sh}/rooms/index.json`);
  for (const a of (d && d.authors) || []) {
    const prev = rooms.get(a.s);
    if (!prev || (a.n || 0) > prev.n) rooms.set(a.s, { kind: "room", sh, slug: a.s, name: a.a, born: a.y || null, n: a.n || 0, w: a.w || 0, dates: "" });
  }
}
const printed = (await get(`${LIB}/v1/authors.json`)) || {};
for (const r of rooms.values()) if (printed[r.name] && printed[r.name].dates) r.dates = printed[r.name].dates;
const todo = NO_ROOMS ? [] : Array.from(rooms.values()).filter((r) => !r.dates);
let next = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (next < todo.length) {
    const r = todo[next]; next += 1;
    const d = await get(`${LIB}/v1/bible/${r.sh}/rooms/${encodeURIComponent(r.slug)}.json`);
    if (d && d.dates) r.dates = d.dates;
  }
}));

const people = JSON.parse(readFileSync(path.join(ROOT, "assets/data/faith-received/authors/people.json"), "utf8")).people;
const all = [...rooms.values()];
for (const [key, [name, dates, church, works]] of Object.entries(people)) all.push({ kind: "no-room", slug: key, name, born: null, n: 0, w: works, dates: dates || "", church });

const out = [];
const tally = { room: { total: 0, dated: 0 }, "no-room": { total: 0, dated: 0 } };
let bugs = 0;
const flagged = {};
for (const a of all) {
  tally[a.kind].total += 1;
  const reasons = [];
  const undated = !a.dates || /^\s*(?:unknown|n\.d\.?|undated)\s*$/i.test(a.dates);
  const span = undated ? null : Y.parse(a.dates);
  if (undated) reasons.push("no dates");
  else if (!span) reasons.push(/\bB\.?\s?C/i.test(a.dates) ? "BC date (no marker)" : "unparseable dates");
  if (span) {
    tally[a.kind].dated += 1;
    span.flags.filter((f) => f !== "century").forEach((f) => reasons.push({ order: "end before start", long: "span over 120 years", late: "year after 2000", early: "year before 1" }[f]));
    if (a.dates && /\b(1[89]\d\d|20\d\d)\b/.test(a.dates) && span.from > 1900) reasons.push("born after 1900");
    if (a.born && Math.abs(span.from - a.born) > 5 && !span.flags.includes("century")) reasons.push(`first year ${Math.round(span.from)} differs from the roster's birth year ${a.born}`);
    // The placement itself: inside the bar, and in the band that holds the printed midpoint.
    const at = Y.placement(span);
    const centre = ((at.left + at.width / 2) / 100) * Y.SCALE_END;
    if (at.left < 0 || at.left + at.width > 100.001) { bugs += 1; reasons.push("BUG: marker outside the bar"); }
    if (Y.eraOf(centre) !== Y.eraOf(span.mid) && Math.abs(centre - span.mid) > 1) { bugs += 1; reasons.push("BUG: marker band differs from the midpoint's band"); }
  }
  const real = reasons.filter((r) => r !== "no dates" && r !== "BC date (no marker)");
  if (real.length || (reasons.length && a.w >= 5)) {
    out.push({ ...a, reasons });
    reasons.forEach((r) => { flagged[r.replace(/\d{3,4}/g, "N")] = (flagged[r.replace(/\d{3,4}/g, "N")] || 0) + 1; });
  }
}
out.sort((x, y) => (y.n || y.w * 1000) - (x.n || x.w * 1000));
const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
writeFileSync(path.join(ROOT, "scripts/author-timeline-audit.csv"), `kind,name,slug,dates as printed,works,citations,what looks wrong\n${out.map((o) => [o.kind, q(o.name), o.slug, q(o.dates), o.w, o.n, q(o.reasons.join("; "))].join(",")).join("\n")}\n`);
console.log(`rooms: ${tally.room.total} (${tally.room.dated} with parseable dates); no-room: ${tally["no-room"].total} (${tally["no-room"].dated} with parseable dates)`);
Object.entries(flagged).sort((x, y) => y[1] - x[1]).forEach(([k, v]) => console.log(`  ${String(v).padStart(5)}  ${k}`));
console.log(`placement bugs: ${bugs}; rows in scripts/author-timeline-audit.csv: ${out.length}`);
process.exit(bugs ? 1 : 0);
