#!/usr/bin/env node
/*
 * Convert our own texts into the reader's format.
 *
 * A hundred works were built as hand-written Handlebars templates, one
 * page each, before there was a reader: the creeds, the catechisms and
 * confessions, the Ante-Nicene fathers in English, and a shelf of
 * classics. They are the only copy of those texts we have, and several
 * of them are in no other collection in the library — the Didache, the
 * Chalcedonian Definition, Rerum Novarum, the 1928 prayer book, the
 * 1689, and eight of the Ante-Nicene fathers are all absent from the
 * Latin library and from Migne.
 *
 * So they are not replaced, they are converted. Each becomes a work in
 * the same JSON shape Patrologia Latina uses — reader "json-sections" —
 * which means the new reader serves them with no new code path, and the
 * old templates can then go.
 *
 *   node scripts/convert-native-works.mjs [--out DIR]
 *
 * Output: one <slug>.json per work, ready to upload to R2 under v1/mo/.
 */
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const ROOT = path.join(import.meta.dirname, "..");
const SRC = path.join(ROOT, "partials/faith-received");
const outArg = process.argv.indexOf("--out");
const OUT = outArg >= 0 ? process.argv[outArg + 1]
  : path.join(os.tmpdir(), "mo-native-works");

// Partials that are page furniture rather than a work: the nav, the
// card decks, the topic and scripture bodies, the memorize drills.
const SKIP = /^_/;

const decodeEntities = (s) => String(s)
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&nbsp;/g, " ").replace(/&mdash;/g, "—").replace(/&ndash;/g, "–")
  .replace(/&rsquo;/g, "’").replace(/&lsquo;/g, "‘")
  .replace(/&rdquo;/g, "”").replace(/&ldquo;/g, "“")
  .replace(/&hellip;/g, "…").replace(/&middot;/g, "·")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"');

const strip = (html) => decodeEntities(String(html).replace(/<[^>]+>/g, " "))
  .replace(/\s+/g, " ").trim();

// Keep the inline emphasis the text carries; drop everything else.
const inline = (html) => decodeEntities(String(html)
  .replace(/<\/?(?:em|i)\b[^>]*>/gi, (m) => (m[1] === "/" ? "</em>" : "<em>"))
  .replace(/<\/?(?:strong|b)\b[^>]*>/gi, (m) => (m[1] === "/" ? "</strong>" : "<strong>"))
  .replace(/<(?!\/?(?:em|strong)\b)[^>]+>/g, " "))
  .replace(/[ \t]+/g, " ").trim();

function pick(html, re) {
  const m = html.match(re);
  return m ? strip(m[1]) : "";
}

function parse(html, slug) {
  const title = pick(html, /<h1[^>]*class="[^"]*article-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i);
  const dek = pick(html, /<p[^>]*class="[^"]*article-dek[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
  const description = pick(html, /<p[^>]*class="[^"]*faith-doc-description[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
  const intro = pick(html, /<p[^>]*class="[^"]*faith-intro-prose[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
  const tags = [...html.matchAll(/class="article-topic-tag"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => strip(m[1])).filter((t) => t && t !== "The Faith Received");

  // Sections. Four shapes were used over the life of these pages and
  // all four are still in the folder:
  //
  //   details.faith-section-details   the confessions and the fathers
  //   article.faith-section           the creeds, which have no drawer
  //   details.faith-thesis-details    the 95 theses, whose text is in
  //                                   the summary and whose body is empty
  //   article.faith-qa                the catechisms, question and answer
  //
  // Reading only the first left the creeds, the theses and the Shorter
  // Catechism behind — and the creeds are exactly the works no other
  // collection in the library has.
  //
  // The markup nests, so openings are found by position and each
  // section runs to the next; counting closing tags would need a real
  // parser and the shape here is regular.
  const OPEN = /<(?:details|article)[^>]*class="[^"]*(faith-section-details|faith-section |faith-qa)[^"]*"[^>]*id="([^"]*)"[^>]*>/gi;
  const opens = [...html.matchAll(OPEN)];
  const sections = [];
  opens.forEach((m, i) => {
    const from = m.index;
    const to = i + 1 < opens.length ? opens[i + 1].index : html.length;
    const chunk = html.slice(from, to);
    const id = m[2];

    const numeral = pick(chunk, /<p[^>]*class="[^"]*(?:faith-section-numeral|faith-qa-number)[^"]*"[^>]*>([\s\S]*?)<\/p>/i)
      || pick(chunk, /<span[^>]*class="[^"]*(?:faith-thesis-number|faith-edwards-number)[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const heading = pick(chunk, /<h2[^>]*class="[^"]*faith-section-title[^"]*"[^>]*>([\s\S]*?)<\/h2>/i)
      || pick(chunk, /<h3[^>]*class="[^"]*faith-qa-question[^"]*"[^>]*>([\s\S]*?)<\/h3>/i);

    const bodyAt = chunk.search(/<div[^>]*class="[^"]*(?:faith-section-body|faith-qa-answer)[^"]*"[^>]*>/i);
    const body = bodyAt >= 0 ? chunk.slice(bodyAt) : "";
    let rows = [...body.matchAll(/<p\b(?![^>]*(?:faith-section-numeral|faith-qa-number))[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((x, j) => ({ kind: "body", id: `${id}-${j + 1}`, en: inline(x[1]) }))
      .filter((r) => r.en);

    // A thesis carries its whole text in the summary and leaves the
    // body empty, so the drawer opens on nothing.
    if (!rows.length) {
      const summaryText = pick(chunk, /<p[^>]*class="[^"]*(?:faith-thesis-text|faith-edwards-text)[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
      if (summaryText) rows = [{ kind: "body", id: `${id}-1`, en: summaryText }];
    }

    if (!rows.length && !heading) return;
    sections.push({
      id,
      title: heading || (numeral ? `${numeral}` : `Section ${i + 1}`),
      subtitle: heading && numeral ? numeral : "",
      rows,
    });
  });

  if (!title || !sections.length) return null;
  return {
    slug,
    title,
    author: "",           // filled from the browse page below
    subtitle: dek,
    description,
    intro,
    tags,
    tradition: "",
    sections,
  };
}

// The browse page lists eighteen of the Ante-Nicene fathers and the
// folder holds thirty-four more, so half of them had no name against
// them. The slug carries it: every one of these was named
// anf-<father>-<work> when it was built.
const BY_SLUG = [
  [/^anf-tertullian-/, "Tertullian"],
  [/^anf-clement-alexandria-/, "Clement of Alexandria"],
  [/^anf-clement-corinthians/, "Clement of Rome"],
  [/^anf-justin-/, "Justin Martyr"],
  [/^anf-irenaeus-/, "Irenaeus of Lyons"],
  [/^anf-athenagoras-/, "Athenagoras"],
  [/^anf-theophilus-/, "Theophilus of Antioch"],
  [/^anf-ignatius-/, "Ignatius of Antioch"],
  [/^anf-polycarp-/, "Polycarp"],
  [/^anf-papias-/, "Papias"],
  [/^anf-tatian-/, "Tatian"],
  [/^anf-barnabas/, "Barnabas"],
  [/^anf-hermas-/, "Hermas"],
];

// The templates carry a title and a tradition but no author: the name
// and the dates were only ever written on the browse page, in the line
// under each link. Harvested from there rather than retyped.
const BROWSE = path.join(ROOT, "custom-faith-browse.hbs");
const byline = new Map();
try {
  const b = await readFile(BROWSE, "utf8");
  const rows = b.matchAll(/<a href="\/the-faith-received\/([^/"]+)\/"[^>]*>[\s\S]*?<span class="brow-m">([\s\S]*?)<\/span>/gi);
  for (const m of rows) {
    const parts = decodeEntities(m[2]).split("·").map((x) => strip(x));
    byline.set(m[1], { author: parts[0] || "", eyebrow: parts[1] || "" });
  }
} catch { /* the page is optional; the works still convert */ }

const files = (await readdir(SRC)).filter((f) => f.endsWith(".hbs") && !SKIP.test(f));
await mkdir(OUT, { recursive: true });

const catalogue = [];
let skipped = 0;
for (const f of files) {
  const slug = f.replace(/\.hbs$/, "");
  const html = await readFile(path.join(SRC, f), "utf8");
  const work = parse(html, slug);
  if (!work) { skipped += 1; continue; }
  const bySlug = BY_SLUG.find(([re]) => re.test(slug));
  if (bySlug) work.author = bySlug[1];
  const line = byline.get(slug);
  if (line) {
    // "The early church" and "The whole church" name a body, not a
    // person, and belong on the shelf rather than in a byline.
    // The line under a link is "Author · date" for a book and
    // "Tradition · year" for a confession, and they are the same
    // shape. Reading it blind put "Reformed Baptist" in the author
    // field of the 1689. A name that is one of the tradition tags the
    // page itself uses is a tradition.
    const TRADITIONS = /^(reformed|reformed baptist|lutheran|anglican|baptist|evangelical|roman catholic|the early church|the whole church|the church at smyrna|congregational|arminian|eastern orthodox|presbyterian)$/i;
    const named = TRADITIONS.test(line.author) ? "" : line.author;
    // A martyrdom is written about its subject, not by them.
    if (named && !/^(the )?(martyrdom|passion)\b/i.test(work.title)) work.author = named;
    if (!named && line.author) work.tradition = line.author;
    work.eyebrow = line.eyebrow || work.subtitle;
  }
  const words = work.sections.reduce((a, s) =>
    a + s.rows.reduce((b, r) => b + r.en.split(/\s+/).length, 0), 0);
  await writeFile(path.join(OUT, `${slug}.json`), JSON.stringify(work));
  catalogue.push({
    slug: work.slug,
    title: work.title,
    author: work.author,
    tradition: work.tradition || (work.tags || [])[0] || "",
    eyebrow: work.eyebrow || work.subtitle,
    subtitle: work.subtitle,
    description: work.description,
    tags: work.tags,
    n_sections: work.sections.length,
    words,
  });
}

catalogue.sort((a, b) => a.title.localeCompare(b.title));
await writeFile(path.join(OUT, "index.json"), JSON.stringify({ works: catalogue }));

const words = catalogue.reduce((a, w) => a + w.words, 0);
console.log(`${catalogue.length} works converted, ${skipped} partials skipped as furniture`);
console.log(`${words.toLocaleString()} words, ${catalogue.reduce((a, w) => a + w.n_sections, 0).toLocaleString()} sections`);
console.log(`written to ${OUT}`);
console.log(catalogue.slice(0, 6).map((w) => `  ${w.slug.padEnd(34)} ${w.n_sections} sections  ${w.words.toLocaleString()} words`).join("\n"));
