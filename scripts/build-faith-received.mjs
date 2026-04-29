// Builds Handlebars partials for The Faith Received from the JSON
// files in data/faith-received/. One partial per document, written
// to partials/faith-received/{slug}.hbs. Run after every JSON
// regeneration:
//
//   node scripts/build-faith-received.mjs
//
// Pure Node — no TypeScript, no external deps. Designed to run
// post-import or as part of a pre-commit step.

import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const DATA_DIR = path.join(ROOT, "data", "faith-received");
const OUT_DIR = path.join(ROOT, "partials", "faith-received");
// `data/faith-received/_manifest.json` is regenerated each build with
// title/date/category for the homepage card grid (so the homepage
// template doesn't need its own copy of the metadata).
const MANIFEST_PATH = path.join(ROOT, "data", "faith-received", "_manifest.json");

await mkdir(OUT_DIR, { recursive: true });

// ── HTML escapers ─────────────────────────────────────────────
function escape(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Body text from the source data uses straight ASCII apostrophes and
// occasional smart quotes. Convert ASCII to typographic quotes for the
// editorial set, and preserve em dashes etc. Paragraph breaks are on
// "\n\n"; single newlines become spaces (or <br> within stanzas).
function smarten(text) {
  if (!text) return "";
  let s = String(text);
  // Smart quotes
  s = s.replace(/(^|[\s\(\[\{])'/g, "$1‘").replace(/'/g, "’");
  s = s.replace(/(^|[\s\(\[\{])"/g, "$1“").replace(/"/g, "”");
  // Triple dot to ellipsis
  s = s.replace(/\.\.\./g, "…");
  return s;
}

function paragraphs(text) {
  // Split on double-newline; render each chunk as a <p>. Single
  // newlines inside a chunk are preserved as soft breaks (rare in
  // source data).
  return String(text)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escape(smarten(p)).replace(/\n/g, "<br />\n")}</p>`)
    .join("\n      ");
}

// Render the document header that appears at the top of each
// document partial (title hero band).
function header(doc) {
  const sub = doc.author
    ? `${escape(doc.author)} &middot; ${escape(doc.date)}`
    : escape(doc.date);
  return `
  <section class="article-header faith-doc-header">
    <div class="article-header-inner">
      <p class="article-topic"><a href="/the-faith-received/" class="article-topic-tag">The Faith Received</a></p>
      <h1 class="article-title">${escape(smarten(doc.title))}</h1>
      <p class="article-dek faith-doc-dek">${sub}</p>
      ${doc.description ? `<p class="faith-doc-description">${escape(smarten(doc.description))}</p>` : ""}
      <div class="faith-doc-actions">
        <button type="button" class="faith-modernizer-toggle" data-modernizer-toggle aria-pressed="false" hidden>
          <span class="faith-modernizer-label">Modernize language</span>
        </button>
        <a href="/the-faith-received/" class="faith-doc-back"><span aria-hidden="true">&larr;</span> Back to The Faith Received</a>
      </div>
    </div>
  </section>`;
}

// ── Per-shape renderers ─────────────────────────────────────────
function renderSections(doc) {
  const items = (doc.sections ?? []).map((s) => `
        <article class="faith-section" id="section-${s.number}">
          <p class="faith-section-numeral">${roman(s.number)}</p>
          <h2 class="faith-section-title"><em>${escape(smarten(s.title))}</em></h2>
          <div class="faith-section-body article-content">
            ${paragraphs(s.text)}
          </div>
        </article>
  `).join("\n");
  return `
  <main class="article faith-doc faith-doc--sections">
    ${header(doc)}
    <div class="article-body faith-doc-body">
      <div class="container container-narrow faith-doc-inner">
        ${items}
      </div>
    </div>
  </main>`;
}

function renderChapters(doc, opts = {}) {
  const items = (doc.chapters ?? []).map((c) => `
        <article class="faith-section" id="chapter-${c.number}">
          <p class="faith-section-numeral">${opts.label || "Chapter"} ${roman(c.number)}</p>
          <h2 class="faith-section-title"><em>${escape(smarten(c.title))}</em></h2>
          ${c.subtitle ? `<p class="faith-section-subtitle">${escape(smarten(c.subtitle))}</p>` : ""}
          <div class="faith-section-body article-content">
            ${
              c.paragraphs
                ? c.paragraphs.map((p) => `<p>${escape(smarten(p)).replace(/\n/g, "<br />\n")}</p>`).join("\n            ")
                : paragraphs(c.text || "")
            }
          </div>
        </article>
  `).join("\n");
  return `
  <main class="article faith-doc faith-doc--chapters">
    ${header(doc)}
    ${tocBlock(doc.chapters, opts.label || "Chapter")}
    <div class="article-body faith-doc-body">
      <div class="container container-narrow faith-doc-inner">
        ${items}
      </div>
    </div>
  </main>`;
}

function renderArticles(doc) {
  const items = (doc.articles ?? []).map((a) => `
        <article class="faith-section" id="article-${a.number}">
          <p class="faith-section-numeral">${a.number > 0 ? `Article ${roman(a.number)}` : "Preface"}</p>
          <h2 class="faith-section-title"><em>${escape(smarten(a.title))}</em></h2>
          <div class="faith-section-body article-content">
            ${paragraphs(a.text)}
          </div>
        </article>
  `).join("\n");
  return `
  <main class="article faith-doc faith-doc--articles">
    ${header(doc)}
    ${tocBlock((doc.articles ?? []).filter((a) => a.number > 0), "Article")}
    <div class="article-body faith-doc-body">
      <div class="container container-narrow faith-doc-inner">
        ${items}
      </div>
    </div>
  </main>`;
}

function renderTheses(doc) {
  // 95 theses: render as a numbered list, each thesis a small block.
  const items = (doc.theses ?? []).map((t) => `
        <li class="faith-thesis" id="thesis-${t.number}">
          <span class="faith-thesis-number">${t.number}</span>
          <p class="faith-thesis-text">${escape(smarten(t.text))}</p>
        </li>
  `).join("\n");
  return `
  <main class="article faith-doc faith-doc--theses">
    ${header(doc)}
    <div class="article-body faith-doc-body">
      <div class="container container-narrow faith-doc-inner">
        <ol class="faith-thesis-list">
          ${items}
        </ol>
      </div>
    </div>
  </main>`;
}

function renderQA(doc) {
  // Westminster Shorter / Larger Catechism: numbered Q&A pairs.
  const items = (doc.questions ?? []).map((q) => `
        <article class="faith-qa" id="q-${q.number}">
          <p class="faith-qa-number">Q. ${q.number}</p>
          <h3 class="faith-qa-question"><em>${escape(smarten(q.question))}</em></h3>
          <div class="faith-qa-answer article-content">
            ${paragraphs(q.answer)}
          </div>
          ${
            q.references && q.references.length
              ? `<p class="faith-qa-references"><span class="faith-qa-ref-label">Scripture</span> ${q.references.map((r) => escape(r.reference || r.book)).join(" &middot; ")}</p>`
              : ""
          }
        </article>
  `).join("\n");
  return `
  <main class="article faith-doc faith-doc--qa">
    ${header(doc)}
    <div class="article-body faith-doc-body">
      <div class="container container-narrow faith-doc-inner">
        ${items}
      </div>
    </div>
  </main>`;
}

function renderHeidelberg(doc) {
  const sections = ["misery", "deliverance", "gratitude"];
  const sectionLabels = {
    misery: "Part I &middot; Misery",
    deliverance: "Part II &middot; Deliverance",
    gratitude: "Part III &middot; Gratitude",
  };
  let html = `
  <main class="article faith-doc faith-doc--heidelberg">
    ${header(doc)}
    <div class="article-body faith-doc-body">
      <div class="container container-narrow faith-doc-inner">`;
  for (const sec of sections) {
    const days = (doc.lordsDays ?? []).filter((d) => d.section === sec);
    if (!days.length) continue;
    html += `
        <section class="faith-heidelberg-part" id="part-${sec}">
          <p class="eyebrow faith-part-eyebrow">${sectionLabels[sec]}</p>
          <div class="flourish">{{> "flourish-mark"}}</div>
          ${days.map((d) => renderLordsDay(d)).join("\n")}
        </section>`;
  }
  html += `
      </div>
    </div>
  </main>`;
  return html;
}

function renderLordsDay(d) {
  const qs = (d.questions ?? []).map((q) => `
            <article class="faith-qa" id="q-${q.number}">
              <p class="faith-qa-number">Q. ${q.number}</p>
              <h3 class="faith-qa-question"><em>${escape(smarten(q.question))}</em></h3>
              <div class="faith-qa-answer article-content">
                ${paragraphs(q.answer)}
              </div>
              ${
                q.references && q.references.length
                  ? `<p class="faith-qa-references"><span class="faith-qa-ref-label">Scripture</span> ${q.references.map((r) => escape(r.reference || r.book)).join(" &middot; ")}</p>`
                  : ""
              }
            </article>
  `).join("\n");
  return `
          <section class="faith-lords-day" id="lords-day-${d.number}">
            <p class="faith-lords-day-numeral">Lord's Day ${d.number}</p>
            <h2 class="faith-section-title"><em>${escape(smarten(d.title))}</em></h2>
            ${qs}
          </section>`;
}

function renderEdwards(doc) {
  // 70 numbered resolutions, prefaced by an opening note. Each entry
  // already carries its own number prefix in the source text.
  const items = (doc.resolutions ?? []).map((r, i) => {
    if (i === 0) {
      // Preamble — the very first paragraph in the source isn't a
      // numbered resolution; render it as a lede.
      return `
          <p class="faith-edwards-preamble">${escape(smarten(r.text))}</p>`;
    }
    return `
          <article class="faith-edwards-item" id="resolution-${i}">
            <span class="faith-edwards-number">${i}</span>
            <p class="faith-edwards-text">${escape(smarten(r.text.replace(/^\d+\.\s*/, "")))}</p>
          </article>`;
  }).join("\n");
  return `
  <main class="article faith-doc faith-doc--edwards">
    ${header(doc)}
    <div class="article-body faith-doc-body">
      <div class="container container-narrow faith-doc-inner">
        ${items}
      </div>
    </div>
  </main>`;
}

function renderLibraryChapters(doc) {
  // Single-flat-list of chapters (athanasius-incarnation, charnock-discourses, rerum-novarum).
  const list =
    doc.chapters ??
    doc.discourses ??
    doc.sections ??
    [];
  const label =
    doc.discourses ? "Discourse" : doc.sections ? "Section" : "Chapter";

  // Size control: if the full inline payload would exceed ~250KB,
  // render as TOC + first item only. Keeps theme deploy small and
  // page weight reasonable for the long-form Puritan / patristic
  // works (Charnock's Discourses are the worst offender).
  const fullSize = JSON.stringify(list).length;
  const oversized = fullSize > 250000;
  const toRender = oversized ? list.slice(0, 1) : list;

  const items = toRender.map((c) => `
        <article class="faith-section" id="chapter-${c.number}">
          <p class="faith-section-numeral">${label} ${roman(c.number)}</p>
          <h2 class="faith-section-title"><em>${escape(smarten(c.title || ""))}</em></h2>
          ${c.subtitle ? `<p class="faith-section-subtitle">${escape(smarten(c.subtitle))}</p>` : ""}
          <div class="faith-section-body article-content">
            ${(c.paragraphs ?? []).map((p) => `<p>${escape(smarten(p)).replace(/\n/g, "<br />\n")}</p>`).join("\n            ")}
          </div>
        </article>
  `).join("\n");
  const oversizedNote = oversized ? `
        <aside class="faith-oversized-note">
          <p class="eyebrow">A note on this work</p>
          <p>This is a long work. The opening ${label.toLowerCase()} is set below; the rest will be added to the reading room as we typeset them. In the meantime, the structure of the work is reflected in the table of contents above.</p>
        </aside>
  ` : "";
  return `
  <main class="article faith-doc faith-doc--library">
    ${header(doc)}
    ${tocBlock(list, label)}
    <div class="article-body faith-doc-body">
      <div class="container container-narrow faith-doc-inner">
        ${oversizedNote}
        ${items}
      </div>
    </div>
  </main>`;
}

function renderLibraryBooks(doc) {
  // Multi-book classics (Calvin, Augustine, Imitation). Each book has
  // chapters underneath. Render with book-level headings + chapter
  // sections. Size-cap: if the full payload exceeds ~250KB, render
  // book-level TOC and the first chapter of book 1 only — full
  // chapter rendering for the bigger classics arrives in a later
  // pass (likely backed by per-chapter JSON in a Cloudflare Worker
  // so the theme deploy stays small).
  const fullSize = JSON.stringify(doc.books ?? []).length;
  const oversized = fullSize > 250000;

  const html = (doc.books ?? []).map((b, bookIdx) => {
    const chaptersToRender = oversized && bookIdx > 0 ? [] : (b.chapters ?? []);
    const chapters = chaptersToRender.slice(0, oversized ? 1 : chaptersToRender.length).map((c) => `
          <article class="faith-section" id="book-${b.bookNumber}-chapter-${c.number}">
            <p class="faith-section-numeral">Chapter ${roman(c.number)}</p>
            <h3 class="faith-section-title"><em>${escape(smarten(c.title || ""))}</em></h3>
            ${c.subtitle ? `<p class="faith-section-subtitle">${escape(smarten(c.subtitle))}</p>` : ""}
            <div class="faith-section-body article-content">
              ${(c.paragraphs ?? []).map((p) => `<p>${escape(smarten(p)).replace(/\n/g, "<br />\n")}</p>`).join("\n              ")}
            </div>
          </article>
    `).join("\n");
    return `
        <section class="faith-book" id="book-${b.bookNumber}">
          <p class="eyebrow faith-part-eyebrow">${b.bookNumber > 0 ? `Book ${roman(b.bookNumber)}` : "Preface"}</p>
          ${b.bookTitle && b.bookTitle !== `Book ${b.bookNumber}` ? `<h2 class="faith-book-title"><em>${escape(smarten(b.bookTitle))}</em></h2>` : ""}
          <div class="flourish">{{> "flourish-mark"}}</div>
          ${chapters}
        </section>`;
  }).join("\n");
  const oversizedNote = oversized ? `
        <aside class="faith-oversized-note">
          <p class="eyebrow">A note on this work</p>
          <p>This is a long, multi-volume work. The opening chapter is set below; the rest will be added to the reading room as we typeset them. In the meantime, the structure of the work is reflected in the table of contents above.</p>
        </aside>
  ` : "";
  return `
  <main class="article faith-doc faith-doc--library faith-doc--books">
    ${header(doc)}
    ${booksTocBlock(doc.books)}
    <div class="article-body faith-doc-body">
      <div class="container container-narrow faith-doc-inner">
        ${oversizedNote}
        ${html}
      </div>
    </div>
  </main>`;
}

// ── Helpers ─────────────────────────────────────────────────────
const ROMAN = [
  ["M", 1000], ["CM", 900], ["D", 500], ["CD", 400], ["C", 100],
  ["XC", 90], ["L", 50], ["XL", 40], ["X", 10], ["IX", 9],
  ["V", 5], ["IV", 4], ["I", 1],
];
function roman(n) {
  if (typeof n !== "number" || n <= 0 || n > 3999) return String(n ?? "");
  let result = "";
  let num = n;
  for (const [sym, val] of ROMAN) {
    while (num >= val) {
      result += sym;
      num -= val;
    }
  }
  return result;
}

function tocBlock(items, label) {
  if (!items || items.length < 4) return "";
  const links = items.map((c) => `
            <li class="faith-toc-item"><a href="#${
              label === "Article" ? "article-" : label === "Discourse" ? "chapter-" : "chapter-"
            }${c.number}"><span class="faith-toc-num">${roman(c.number)}</span><span class="faith-toc-label">${escape(smarten(c.title || ""))}</span></a></li>`).join("");
  return `
    <nav class="faith-toc" aria-label="Contents">
      <div class="container container-narrow">
        <p class="faith-toc-label-heading">Contents</p>
        <ol class="faith-toc-list">${links}
        </ol>
      </div>
    </nav>`;
}

function booksTocBlock(books) {
  if (!books || !books.length) return "";
  const blocks = books.map((b) => {
    const links = (b.chapters ?? []).map((c) => `
              <li class="faith-toc-item"><a href="#book-${b.bookNumber}-chapter-${c.number}"><span class="faith-toc-num">${roman(c.number)}</span><span class="faith-toc-label">${escape(smarten(c.title || ""))}</span></a></li>`).join("");
    return `
        <div class="faith-toc-book">
          <p class="faith-toc-book-label">${b.bookNumber > 0 ? `Book ${roman(b.bookNumber)}` : "Preface"}</p>
          <ol class="faith-toc-list">${links}
          </ol>
        </div>`;
  }).join("");
  return `
    <nav class="faith-toc faith-toc--books" aria-label="Contents">
      <div class="container container-narrow">
        <p class="faith-toc-label-heading">Contents</p>
        ${blocks}
      </div>
    </nav>`;
}

// ── Dispatch ────────────────────────────────────────────────────
function renderDoc(doc) {
  switch (doc.kind) {
    case "sections":
      return renderSections(doc);
    case "chapters":
      return renderChapters(doc, { label: "Chapter" });
    case "articles":
      return renderArticles(doc);
    case "theses":
      return renderTheses(doc);
    case "qa":
      return renderQA(doc);
    case "heidelberg":
      return renderHeidelberg(doc);
    case "edwards":
      return renderEdwards(doc);
    case "library-chapters":
    case "library-discourses":
    case "library-sections":
      return renderLibraryChapters(doc);
    case "library-books":
      return renderLibraryBooks(doc);
    default:
      console.warn(`Unknown kind: ${doc.kind} for ${doc.slug}`);
      return `\n  <main class="faith-doc"><div class="container container-narrow"><p>Document not yet ported.</p></div></main>`;
  }
}

// ── Main ────────────────────────────────────────────────────────
const files = (await readdir(DATA_DIR)).filter((f) => f.endsWith(".json") && f !== "_manifest.json");
const manifest = [];
for (const file of files) {
  const doc = JSON.parse(await readFile(path.join(DATA_DIR, file), "utf-8"));
  const html = renderDoc(doc);
  const partialPath = path.join(OUT_DIR, `${doc.slug}.hbs`);
  await writeFile(partialPath, html.trim() + "\n");
  manifest.push({
    slug: doc.slug,
    title: doc.title,
    author: doc.author,
    date: doc.date,
    description: doc.description,
    category: doc.category,
    kind: doc.kind,
  });
}

// Sort manifest by category then date (chronological where parsable;
// alphabetical fallback). Documents tab gets the historic ordering.
manifest.sort((a, b) => {
  if (a.category !== b.category) return a.category < b.category ? -1 : 1;
  // Pull leading year (or BC/AD century marker) out of date.
  const ya = parseDateStart(a.date);
  const yb = parseDateStart(b.date);
  if (ya !== yb) return ya - yb;
  return a.title.localeCompare(b.title);
});
await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

// Card-grid partials, one per category.
function cardMarkup(item) {
  const author = item.author
    ? `<p class="faith-card-author"><em>${escape(smarten(item.author))}</em></p>`
    : "";
  return `
        <a class="faith-card" href="/the-faith-received/${item.slug}/">
          <p class="faith-card-date">${escape(item.date)}</p>
          <h3 class="faith-card-title"><em>${escape(smarten(item.title))}</em></h3>
          ${author}
          <p class="faith-card-desc">${escape(smarten(item.description))}</p>
          <span class="faith-card-link">Read &amp; study <span class="faith-card-arrow" aria-hidden="true">&rarr;</span></span>
        </a>`;
}

const documents = manifest.filter((m) => m.category === "documents");
const library = manifest.filter((m) => m.category === "library");

await writeFile(
  path.join(OUT_DIR, "_cards-documents.hbs"),
  `{{!-- Generated by scripts/build-faith-received.mjs. Do not edit by hand. --}}\n<div class="faith-card-grid">${documents.map(cardMarkup).join("\n")}\n</div>\n`
);
await writeFile(
  path.join(OUT_DIR, "_cards-library.hbs"),
  `{{!-- Generated by scripts/build-faith-received.mjs. Do not edit by hand. --}}\n<div class="faith-card-grid">${library.map(cardMarkup).join("\n")}\n</div>\n`
);

// Generate one tiny wrapper template per document. routes.yaml binds
// /the-faith-received/{slug}/ to custom-faith-{slug} which simply
// pulls in the matching partial. This lets us avoid the
// no-dynamic-partial-name limitation in Ghost's Handlebars dialect.
const TEMPLATE_DIR = path.join(ROOT);
for (const item of manifest) {
  const tmpl = `{{!< default}}\n{{!-- Generated wrapper for /the-faith-received/${item.slug}/. Edit\n     scripts/build-faith-received.mjs (or the underlying partial) and\n     re-run \`node scripts/build-faith-received.mjs\` to regenerate. --}}\n{{> "faith-received/${item.slug}"}}\n`;
  await writeFile(path.join(TEMPLATE_DIR, `custom-faith-${item.slug}.hbs`), tmpl);
}
console.log(`  + ${manifest.length} custom-faith-{slug}.hbs wrappers`);

// ── Search index ────────────────────────────────────────────────
// Build a flat searchable index of every document, every section /
// chapter, and every Q&A. fuse.js consumes this at runtime on
// /the-faith-received/search/. Each entry is keyed to a URL +
// in-page anchor so results can deep-link.
const ASSET_DATA_DIR = path.join(ROOT, "assets", "data", "faith-received");
await mkdir(ASSET_DATA_DIR, { recursive: true });

const searchIndex = [];
for (const file of files) {
  const doc = JSON.parse(await readFile(path.join(DATA_DIR, file), "utf-8"));
  const baseUrl = `/the-faith-received/${doc.slug}/`;

  // Document-level entry — surfaces description + author searches.
  searchIndex.push({
    type: "document",
    slug: doc.slug,
    url: baseUrl,
    title: doc.title,
    author: doc.author ?? null,
    date: doc.date,
    snippet: doc.description,
  });

  // Per-section entries.
  if (doc.sections && Array.isArray(doc.sections)) {
    for (const s of doc.sections) {
      searchIndex.push({
        type: "section",
        slug: doc.slug,
        url: `${baseUrl}#section-${s.number}`,
        title: `${doc.title} — ${s.title}`,
        author: doc.author ?? null,
        snippet: snippetOf(s.text || ""),
      });
    }
  }
  if (doc.chapters && Array.isArray(doc.chapters)) {
    for (const c of doc.chapters) {
      searchIndex.push({
        type: "chapter",
        slug: doc.slug,
        url: `${baseUrl}#chapter-${c.number}`,
        title: `${doc.title} — ${c.title || `Chapter ${c.number}`}`,
        author: doc.author ?? null,
        snippet: snippetOf(c.text || (c.paragraphs ? c.paragraphs.join(" ") : "")),
      });
    }
  }
  if (doc.articles && Array.isArray(doc.articles)) {
    for (const a of doc.articles) {
      if (a.number === 0) continue;
      searchIndex.push({
        type: "article",
        slug: doc.slug,
        url: `${baseUrl}#article-${a.number}`,
        title: `${doc.title} — Article ${a.number}: ${a.title}`,
        author: doc.author ?? null,
        snippet: snippetOf(a.text || ""),
      });
    }
  }
  if (doc.theses && Array.isArray(doc.theses)) {
    for (const t of doc.theses) {
      searchIndex.push({
        type: "thesis",
        slug: doc.slug,
        url: `${baseUrl}#thesis-${t.number}`,
        title: `${doc.title} — Thesis ${t.number}`,
        author: doc.author ?? null,
        snippet: snippetOf(t.text || ""),
      });
    }
  }
  if (doc.questions && Array.isArray(doc.questions)) {
    for (const q of doc.questions) {
      searchIndex.push({
        type: "question",
        slug: doc.slug,
        url: `${baseUrl}#q-${q.number}`,
        title: `${doc.title} — Q. ${q.number}`,
        author: doc.author ?? null,
        snippet: q.question,
        body: snippetOf(q.answer || ""),
      });
    }
  }
  if (doc.lordsDays && Array.isArray(doc.lordsDays)) {
    for (const ld of doc.lordsDays) {
      for (const q of ld.questions ?? []) {
        searchIndex.push({
          type: "question",
          slug: doc.slug,
          url: `${baseUrl}#q-${q.number}`,
          title: `${doc.title} — Lord's Day ${ld.number}, Q. ${q.number}`,
          author: doc.author ?? null,
          snippet: q.question,
          body: snippetOf(q.answer || ""),
        });
      }
    }
  }
  if (doc.resolutions && Array.isArray(doc.resolutions)) {
    for (const r of doc.resolutions) {
      if (!r.number) continue;
      searchIndex.push({
        type: "resolution",
        slug: doc.slug,
        url: `${baseUrl}#resolution-${r.number}`,
        title: `${doc.title} — Resolution ${r.number}`,
        author: doc.author ?? null,
        snippet: snippetOf(r.text || ""),
      });
    }
  }
  if (doc.discourses && Array.isArray(doc.discourses)) {
    for (const d of doc.discourses) {
      searchIndex.push({
        type: "discourse",
        slug: doc.slug,
        url: `${baseUrl}#chapter-${d.number}`,
        title: `${doc.title} — Discourse ${d.number}: ${d.title || ""}`,
        author: doc.author ?? null,
        snippet: snippetOf(d.subtitle || (d.paragraphs ? d.paragraphs[0] : "")),
      });
    }
  }
  if (doc.books && Array.isArray(doc.books)) {
    for (const b of doc.books) {
      for (const c of b.chapters ?? []) {
        searchIndex.push({
          type: "chapter",
          slug: doc.slug,
          url: `${baseUrl}#book-${b.bookNumber}-chapter-${c.number}`,
          title: `${doc.title} — Book ${b.bookNumber} Chapter ${c.number}: ${c.title || ""}`,
          author: doc.author ?? null,
          snippet: snippetOf(c.subtitle || (c.paragraphs ? c.paragraphs[0] : "")),
        });
      }
    }
  }
}

await writeFile(
  path.join(ASSET_DATA_DIR, "search-index.json"),
  JSON.stringify(searchIndex)
);
console.log(`  + assets/data/faith-received/search-index.json (${searchIndex.length} entries, ${(JSON.stringify(searchIndex).length / 1024).toFixed(0)} KB)`);

// Helper used inside the search-index loop above.
function snippetOf(text) {
  if (!text) return "";
  const trimmed = String(text).replace(/\s+/g, " ").trim();
  return trimmed.length > 280 ? trimmed.slice(0, 280) + "…" : trimmed;
}

// ── Today's reading — deterministic daily pick across the year. ──
// 365-entry list of (slug, anchor, label). day-of-year picks one.
const todayPlan = [];
for (const file of files) {
  const doc = JSON.parse(await readFile(path.join(DATA_DIR, file), "utf-8"));
  const baseUrl = `/the-faith-received/${doc.slug}/`;
  const tag = (n, anchor, label) =>
    todayPlan.push({ slug: doc.slug, url: `${baseUrl}#${anchor}`, label, number: n });
  if (doc.kind === "sections") {
    for (const s of doc.sections ?? []) tag(s.number, `section-${s.number}`, `${doc.title} · ${s.title}`);
  } else if (doc.kind === "chapters") {
    for (const c of doc.chapters ?? []) tag(c.number, `chapter-${c.number}`, `${doc.title} · ${c.title}`);
  } else if (doc.kind === "articles") {
    for (const a of doc.articles ?? []) {
      if (a.number === 0) continue;
      tag(a.number, `article-${a.number}`, `${doc.title} · Article ${a.number}`);
    }
  } else if (doc.kind === "qa") {
    for (const q of doc.questions ?? []) tag(q.number, `q-${q.number}`, `${doc.title} · Q. ${q.number}`);
  } else if (doc.kind === "heidelberg") {
    for (const ld of doc.lordsDays ?? []) tag(ld.number, `lords-day-${ld.number}`, `${doc.title} · Lord's Day ${ld.number}`);
  } else if (doc.kind === "theses") {
    for (const t of doc.theses ?? []) tag(t.number, `thesis-${t.number}`, `${doc.title} · Thesis ${t.number}`);
  } else if (doc.kind === "edwards") {
    for (const r of doc.resolutions ?? []) {
      if (!r.number) continue;
      tag(r.number, `resolution-${r.number}`, `${doc.title} · Resolution ${r.number}`);
    }
  }
}
await writeFile(
  path.join(ASSET_DATA_DIR, "today.json"),
  JSON.stringify(todayPlan)
);
console.log(`  + assets/data/faith-received/today.json (${todayPlan.length} entries)`);

// ── Scripture index — copy from the source repo if present. ──────
const SCRIPTURE_SRC = "/Users/ianharber/Dropbox/Mac (2)/Documents/Claude Code Files/the-faith-received/data/scripture-index.json";
try {
  const sc = await readFile(SCRIPTURE_SRC, "utf-8");
  await writeFile(path.join(ASSET_DATA_DIR, "scripture-index.json"), sc);
  console.log(`  + assets/data/faith-received/scripture-index.json (${(sc.length / 1024).toFixed(0)} KB)`);
} catch {
  console.log(`  ! scripture-index.json not found at source; skipping`);
}

console.log(`Built ${manifest.length} partials in ${OUT_DIR}`);
console.log(`  + _cards-documents.hbs (${documents.length} cards)`);
console.log(`  + _cards-library.hbs (${library.length} cards)`);
console.log(`Wrote manifest to ${MANIFEST_PATH}`);

function parseDateStart(d) {
  if (!d) return 9999;
  const m = String(d).match(/(\d{3,4})/);
  if (!m) return 9999;
  const yr = parseInt(m[1], 10);
  // "BC" stays small; everything else is positive AD year.
  if (/BC/i.test(d)) return -yr;
  return yr;
}
