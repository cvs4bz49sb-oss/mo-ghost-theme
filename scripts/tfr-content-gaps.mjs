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
