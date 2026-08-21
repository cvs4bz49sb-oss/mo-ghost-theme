// Which authors have no biography, and which works have no introduction.
//
//   node scripts/tfr-content-gaps.mjs            report only
//   node scripts/tfr-content-gaps.mjs --write    also emit the work lists
//
// Reads the live catalogues, so the numbers are today's. Writes nothing
// unless asked. The lists it emits are the input for whoever fills the
// gap, whether that is a generation pass on our side or Stiven's.

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const BLOB = "https://0ss8v4l06kodnhp0.public.blob.vercel-storage.com";
const OUT = path.join(import.meta.dirname, "..", "data", "faith-received");
const WRITE = process.argv.includes("--write");

const get = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
};

const fold = (s) => String(s || "")
  .normalize("NFD").replace(/\p{M}/gu, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "");

// A stub is not coverage. Sixty characters is about a sentence.
const usable = (v, min) => {
  const t = typeof v === "string" ? v : (v && (v.bio || v.blurb)) || "";
  return t.trim().length >= min;
};

const [index, authors, blurbs] = await Promise.all([
  get(`${BLOB}/v1/works-index.json`),
  get(`${BLOB}/v1/authors.json`).catch(() => ({})),
  get(`${BLOB}/v1/blurbs.json`).catch(() => ({})),
]);

const works = (index.works || index)
  .filter((w) => !/^(pld|pg|po|eebo)-\d+$/.test(w.slug || ""));

const haveBio = new Set(
  Object.keys(authors).filter((n) => usable(authors[n], 60)).map(fold)
);
const haveBlurb = new Set(
  Object.keys(blurbs).filter((s) => usable(blurbs[s], 40))
);

const authorNames = [...new Set(works.map((w) => w.author).filter(Boolean))];
const missingBio = authorNames.filter((a) => !haveBio.has(fold(a))).sort();
const missingIntro = works.filter((w) => !haveBlurb.has(w.slug));

const pct = (a, b) => `${((100 * a) / b).toFixed(0)}%`;

console.log("The Latin Library, against the live catalogues\n");
console.log(`  authors            ${authorNames.length}`);
console.log(`    with a biography ${authorNames.length - missingBio.length}  (${pct(authorNames.length - missingBio.length, authorNames.length)})`);
console.log(`    WITHOUT          ${missingBio.length}`);
console.log(`  works              ${works.length}`);
console.log(`    with an intro    ${works.length - missingIntro.length}  (${pct(works.length - missingIntro.length, works.length)})`);
console.log(`    WITHOUT          ${missingIntro.length}`);

// Where the gap sits, so it can be filled in a useful order.
const byAuthor = new Map();
missingIntro.forEach((w) => {
  const a = w.author || "(unattributed)";
  byAuthor.set(a, (byAuthor.get(a) || 0) + 1);
});
console.log("\n  authors with the most unintroduced works:");
[...byAuthor.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
  .forEach(([a, n]) => console.log(`    ${String(n).padStart(4)}  ${a}`));

// ── Multi-volume sets ────────────────────────────────────────────
//
// A set with a hole in it is a different kind of gap from a work with
// no introduction, and it is the source's to fill rather than ours.
// Found by writing about Calvin: the Jeremiah lectures are one volume
// slugged vol-1 and labelled Vol. 5, so four volumes are simply absent.
const mismatched = [];
const sets = new Map();
works.forEach((w) => {
  const inSlug = (w.slug || "").match(/-vol-(\d+)$/);
  const inField = String(w.volume || "").match(/(\d+)/);
  if (inSlug && inField && inSlug[1] !== inField[1]) {
    mismatched.push([w.slug, w.volume]);
  }
  const m = (w.slug || "").match(/^(.*)-vol-(\d+)$/);
  if (!m) return;
  if (!sets.has(m[1])) sets.set(m[1], []);
  sets.get(m[1]).push(parseInt(m[2], 10));
});
const holes = [...sets.entries()]
  .map(([base, ns]) => {
    const max = Math.max(...ns);
    const have = new Set(ns);
    const missing = [];
    for (let i = 1; i <= max; i += 1) if (!have.has(i)) missing.push(i);
    return { base, count: ns.length, max, missing };
  })
  .filter((s) => s.missing.length);

console.log(`\n  slug and volume disagree on ${mismatched.length} works:`);
mismatched.forEach(([s, v]) => console.log(`    ${s}  says ${JSON.stringify(v)}`));
console.log(`\n  ${holes.length} multi-volume sets have holes:`);
holes.forEach((h) =>
  console.log(`    ${h.base.slice(0, 46).padEnd(48)} ${h.count}/${h.max}, missing ${h.missing.join(", ")}`));

// ── Conflated authors ────────────────────────────────────────────
//
// One author field, more than one man. Found by writing about Thomas
// Watson and discovering the shelf held Elizabethan love sonnets and a
// Marian bishop's sacramental treatise alongside the Puritan divine.
//
// The test is crude on purpose: nobody publishes across seventy years.
// It catches genuine conflation and also honest posthumous reprinting,
// so the two have to be told apart by eye, and the report prints the
// earliest and latest titles so they can be.
const dated = new Map();
works.forEach((w) => {
  const y = parseInt((String(w.volume || "").match(/\b1[45678]\d{2}|\b1[89]\d{2}/) || [])[0], 10);
  if (!y || !w.author) return;
  if (!dated.has(w.author)) dated.set(w.author, []);
  dated.get(w.author).push({ y, t: w.title || "" });
});
const spans = [...dated.entries()]
  .map(([a, ws]) => {
    const ys = ws.map((x) => x.y);
    const sorted = ws.slice().sort((p, q) => p.y - q.y);
    return { a, lo: Math.min(...ys), hi: Math.max(...ys), n: ws.length, sorted };
  })
  .filter((x) => x.hi - x.lo > 65)
  .sort((x, y) => (y.hi - y.lo) - (x.hi - x.lo));

console.log(`\n  ${spans.length} authors publish across more than 65 years, which one man cannot:`);
spans.forEach((x) => {
  const first = x.sorted[0];
  const last = x.sorted[x.sorted.length - 1];
  console.log(`    ${x.a.padEnd(24)} ${x.lo}–${x.hi}  (${x.n} works)`);
  console.log(`        ${first.y}  ${first.t.slice(0, 62)}`);
  console.log(`        ${last.y}  ${last.t.slice(0, 62)}`);
});

// ── Printed long after the author died ───────────────────────────
//
// A posthumous edition is normal and a work by a different man with
// the same name is not, and the two look identical from here, so this
// lists candidates rather than pronouncing. It found the Jeremy Taylor
// pamphlet of 1673, six years after he died, and a 1689 letter under
// John Lightfoot, who died in 1675.
const deathYear = (e) => {
  const s2 = typeof e === "string" ? "" : String((e && e.dates) || "");
  const m = s2.match(/(?:–|-|d\.\s*|died\s*)\s*(1[45678]\d{2}|1[89]\d{2})\s*$/);
  return m ? parseInt(m[1], 10) : 0;
};
let ourAuthors = {};
try {
  ourAuthors = JSON.parse(await readFile(
    path.join(ROOT, "assets", "data", "faith-received", "tfr-authors.json"), "utf-8"));
} catch { /* not written yet */ }
const died = {};
Object.entries({ ...ourAuthors, ...authors }).forEach(([n, e]) => {
  const y = deathYear(e);
  if (y) died[n] = y;
});
const posthumous = [];
works.forEach((w) => {
  const y = parseInt((String(w.volume || "").match(/1[45678]\d{2}|1[89]\d{2}/) || [])[0], 10);
  const d = died[w.author];
  if (y && d && y - d > 25) posthumous.push({ ...w, printed: y, died: d, gap: y - d });
});
posthumous.sort((a, b) => b.gap - a.gap);
console.log(`\n  ${posthumous.length} works printed more than 25 years after the author died,`);
console.log("  which is either a posthumous edition or a different man:");
posthumous.slice(0, 20).forEach((w) =>
  console.log(`    ${String(w.gap).padStart(3)}y  ${String(w.author).slice(0, 22).padEnd(24)} d.${w.died} printed ${w.printed}  ${String(w.title).slice(0, 44)}`));

if (WRITE) {
  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, "_gap-bios.json"),
    JSON.stringify(missingBio, null, 1));
  await writeFile(path.join(OUT, "_gap-intros.json"),
    JSON.stringify(missingIntro.map((w) => ({
      slug: w.slug, title: w.title, title_la: w.title_la || "",
      author: w.author || "", tradition: w.tradition || "",
      volume: w.volume || "", n_pages: w.n_pages || 0,
    })), null, 1));
  console.log(`\n  wrote _gap-bios.json (${missingBio.length}) and _gap-intros.json (${missingIntro.length})`);
}
