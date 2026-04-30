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
const INTRO_PATH = path.join(ROOT, "scripts", "faith-received-introductions.json");
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

function smarten(text) {
  if (!text) return "";
  let s = String(text);
  s = s.replace(/(^|[\s\(\[\{])'/g, "$1‘").replace(/'/g, "’");
  s = s.replace(/(^|[\s\(\[\{])"/g, "$1“").replace(/"/g, "”");
  s = s.replace(/\.\.\./g, "…");
  return s;
}

function paragraphs(text) {
  return String(text)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escape(smarten(p)).replace(/\n/g, "<br />\n")}</p>`)
    .join("\n      ");
}

function paragraphsArray(arr) {
  return (arr ?? [])
    .map((p) => `<p>${escape(smarten(p)).replace(/\n/g, "<br />\n")}</p>`)
    .join("\n        ");
}

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
    while (num >= val) { result += sym; num -= val; }
  }
  return result;
}

// Render an array of {book, reference} into clickable buttons that
// the frontend popover handler upgrades into verse-text popovers.
// Each button carries the full book name (for the API lookup) and
// the abbreviated reference (for display + chapter:verse parsing).
function renderScriptureRefs(refs) {
  if (!refs || !refs.length) return "";
  const buttons = refs.map((r) => {
    const book = escape(r.book || "");
    const ref = escape(r.reference || r.book || "");
    return `<button type="button" class="faith-verse-ref" data-faith-verse data-book="${book}" data-reference="${ref}">${ref}</button>`;
  }).join(`<span class="faith-verse-sep" aria-hidden="true"> &middot; </span>`);
  return `<p class="faith-qa-references"><span class="faith-qa-ref-label">Scripture</span> ${buttons}</p>`;
}

// Per-shape decision: do sections of this document collapse?
// Short docs (creeds, theses, edwards, westminster shorter) read
// better laid out flat. Longer docs (articles, library chapters,
// lord's days, larger Q&A) are easier to navigate as accordions.
const FLAT_KINDS = new Set([
  "sections", // creeds — typically 3-4 short sections
  "theses",   // 95 short numbered statements
  "edwards",  // 70 short numbered statements
]);
const FLAT_SLUGS = new Set(["westminster-shorter"]); // 107 short Q&A

function isCollapsible(doc) {
  if (FLAT_KINDS.has(doc.kind)) return false;
  if (FLAT_SLUGS.has(doc.slug)) return false;
  return true;
}

// Library / chapter source data uses `title` for the canonical
// numbered label ("Chapter I") and `subtitle` for the real
// descriptive name ("The Connection Between The Knowledge Of God
// And The Knowledge Of Ourselves"). The eyebrow already carries
// the "Chapter I" prefix, so prefer the subtitle as the section
// heading when one exists.
function stripHtml(s) {
  return String(s ?? "").replace(/<[^>]+>/g, "");
}
function titleFor(c) {
  const looksLikeNumberedLabel = /^(chapter|discourse|section|article)\s+[\divxlcm]+$/i.test(
    String(c.title || "").trim()
  );
  if (c.subtitle && (looksLikeNumberedLabel || !c.title)) {
    return escape(smarten(c.subtitle));
  }
  return escape(smarten(c.title || ""));
}

// ── Header (dark hero atop every document) ────────────────────
function header(doc, hasToc) {
  const sub = doc.author
    ? `${escape(doc.author)} &middot; ${escape(doc.date)}`
    : escape(doc.date);
  // The "Contents" toggle only renders for documents that ship a
  // sidebar TOC. On desktop the sidebar is always visible so the
  // button is hidden via CSS; on mobile the button opens the slide-
  // out drawer.
  const tocToggle = hasToc ? `
        <button type="button" class="faith-doc-toc-toggle" data-faith-toc-toggle aria-label="Open contents">
          <span class="faith-doc-toc-toggle-icon" aria-hidden="true">
            <span></span><span></span><span></span>
          </span>
          <span class="faith-doc-toc-toggle-label">Contents</span>
        </button>` : "";
  return `
  <section class="article-header faith-doc-header">
    <div class="article-header-inner">
      <p class="article-topic"><a href="/the-faith-received/" class="article-topic-tag">The Faith Received</a></p>
      <h1 class="article-title">${escape(smarten(doc.title))}</h1>
      <p class="article-dek faith-doc-dek">${sub}</p>
      ${doc.description ? `<p class="faith-doc-description">${escape(smarten(doc.description))}</p>` : ""}
      <div class="faith-doc-actions">
        ${tocToggle}
        <button type="button" class="faith-modernizer-toggle" data-modernizer-toggle aria-pressed="false" hidden>
          <span class="faith-modernizer-label">Modernize language</span>
        </button>
        <a href="/the-faith-received/" class="faith-doc-back"><span aria-hidden="true">&larr;</span> The Faith Received</a>
      </div>
    </div>
  </section>`;
}

// ── Editorial introduction (always open, dropcap on first ¶) ──
function intro(doc, intros) {
  const text = intros[doc.slug];
  if (!text) return "";
  return `
  <section class="faith-intro">
    <div class="container container-narrow">
      <p class="eyebrow faith-intro-eyebrow">An Introduction</p>
      <p class="faith-intro-prose hero-excerpt-dropcap">${escape(smarten(text))}</p>
      <div class="flourish faith-intro-flourish">{{> "flourish-mark"}}</div>
    </div>
  </section>`;
}

// ── Reading controls (Expand / Collapse all + Read aloud later) ─
function readingControls(doc) {
  if (!isCollapsible(doc)) return "";
  return `
  <div class="faith-reading-controls" data-faith-controls>
    <span class="faith-reading-controls-label">Reading</span>
    <button type="button" class="faith-reading-control" data-faith-expand-all>Expand all</button>
    <span class="faith-reading-controls-sep" aria-hidden="true">&middot;</span>
    <button type="button" class="faith-reading-control" data-faith-collapse-all>Collapse all</button>
  </div>`;
}

// ── Table of contents (rendered inside .faith-toc-sidebar) ────
//
// Returns the inner <nav> markup. The page layout (via wrapBody)
// drops it into a sticky-on-desktop / inline-on-mobile sidebar.
// Returns empty string when fewer than 4 items — the doc renders
// without a sidebar in that case.
function tocBlock(items, getNum, getTitle, getAnchor, opts = {}) {
  if (!items || items.length < 4) return "";
  const links = items.map((c) => `
        <li class="faith-toc-item"><a href="#${getAnchor(c)}"><span class="faith-toc-num">${roman(getNum(c))}</span><span class="faith-toc-label">${escape(smarten(getTitle(c)))}</span></a></li>`).join("");
  return `
  <nav class="faith-toc" aria-label="Contents">
    <p class="faith-toc-label-heading">${opts.label ? escape(opts.label) : "Contents"}</p>
    <ol class="faith-toc-list">${links}
    </ol>
  </nav>`;
}

// Heidelberg-specific: TOC grouped by Part (Misery / Deliverance /
// Gratitude). Matches the original TFR sidebar treatment.
function heidelbergTocBlock(lordsDays) {
  if (!lordsDays || lordsDays.length < 4) return "";
  const sections = [
    { key: "misery", label: "Part I · Misery" },
    { key: "deliverance", label: "Part II · Deliverance" },
    { key: "gratitude", label: "Part III · Gratitude" },
  ];
  const blocks = sections.map((s) => {
    const days = lordsDays.filter((d) => d.section === s.key);
    if (!days.length) return "";
    const links = days.map((d) => `
          <li class="faith-toc-item"><a href="#lords-day-${d.number}"><span class="faith-toc-num">LD ${d.number}</span><span class="faith-toc-label">${escape(smarten(d.title))}</span></a></li>`).join("");
    return `
      <div class="faith-toc-group">
        <p class="faith-toc-group-label">${s.label}</p>
        <ol class="faith-toc-list">${links}
        </ol>
      </div>`;
  }).join("");
  return `
  <nav class="faith-toc faith-toc--heidelberg" aria-label="Contents">
    <p class="faith-toc-label-heading">Lord's Days</p>
    ${blocks}
  </nav>`;
}

function booksTocBlock(books) {
  if (!books || !books.length) return "";
  const blocks = books.map((b) => {
    const links = (b.chapters ?? []).map((c) => `
          <li class="faith-toc-item"><a href="#book-${b.bookNumber}-chapter-${c.number}"><span class="faith-toc-num">${roman(c.number)}</span><span class="faith-toc-label">${titleFor(c)}</span></a></li>`).join("");
    return `
      <div class="faith-toc-group">
        <p class="faith-toc-group-label">${b.bookNumber > 0 ? `Book ${roman(b.bookNumber)}` : "Preface"}</p>
        <ol class="faith-toc-list">${links}
        </ol>
      </div>`;
  }).join("");
  return `
  <nav class="faith-toc faith-toc--books" aria-label="Contents">
    <p class="faith-toc-label-heading">Contents</p>
    ${blocks}
  </nav>`;
}

// Wraps the doc body. When a TOC is present, lays out as a 2-column
// grid: sticky sidebar TOC + reading column on desktop ≥1024px.
// On mobile the sidebar becomes a slide-out drawer triggered by the
// "Contents" button in the header. When there's no TOC, falls back
// to the single centered reading column.
function wrapBody({ toc, controls, sections, kindClass = "" }) {
  const inner = `${controls || ""}\n        ${sections}`;
  if (!toc) {
    return `
    <div class="article-body faith-doc-body">
      <div class="container container-narrow faith-doc-inner">
        ${inner}
      </div>
    </div>`;
  }
  return `
    <div class="article-body faith-doc-body faith-doc-body--has-sidebar">
      <div class="faith-doc-layout ${kindClass}">
        <aside class="faith-toc-sidebar" data-faith-toc-drawer aria-label="Document contents">
          <button type="button" class="faith-toc-close" data-faith-toc-close aria-label="Close contents">
            <span aria-hidden="true">&times;</span>
          </button>${toc}
        </aside>
        <div class="faith-doc-inner">
          ${inner}
        </div>
      </div>
      <div class="faith-toc-backdrop" data-faith-toc-backdrop hidden></div>
    </div>`;
}

// ── Wrap a section in <details> (or not) ─────────────────────
//
// open: should this section be open by default? Pass i === 0 to
// open the first one so the page has visible content on landing.
function wrapDetails({ id, eyebrow, title, body, open, kindClass = "" }) {
  return `
        <details class="faith-section-details ${kindClass}" id="${id}"${open ? " open" : ""}>
          <summary class="faith-section-summary">
            <div class="faith-section-summary-inner">
              <p class="faith-section-numeral">${eyebrow}</p>
              <h2 class="faith-section-title"><em>${title}</em></h2>
            </div>
            <span class="faith-chev" aria-hidden="true"></span>
          </summary>
          <div class="faith-section-body article-content">
            ${body}
          </div>
        </details>`;
}

function renderSectionFlat({ id, eyebrow, title, body, kindClass = "" }) {
  return `
        <article class="faith-section ${kindClass}" id="${id}">
          <p class="faith-section-numeral">${eyebrow}</p>
          <h2 class="faith-section-title"><em>${title}</em></h2>
          <div class="faith-section-body article-content">
            ${body}
          </div>
        </article>`;
}

// ── Per-shape renderers ─────────────────────────────────────────

function renderSections(doc) {
  // Apostles, Nicene, Athanasian, Chalcedonian — short creeds. Flat,
  // no sidebar (3-4 items doesn't earn the navigation chrome).
  const items = (doc.sections ?? []).map((s) =>
    renderSectionFlat({
      id: `section-${s.number}`,
      eyebrow: roman(s.number),
      title: escape(smarten(s.title)),
      body: paragraphs(s.text),
    })
  ).join("\n");
  return `
  <main class="article faith-doc faith-doc--sections">
    ${header(doc, false)}
    ${intro(doc, INTROS)}
    ${wrapBody({ toc: "", controls: "", sections: items })}
  </main>`;
}

function renderChapters(doc, opts = {}) {
  // Didache, Diognetus — multi-chapter early-church or library short.
  const items = (doc.chapters ?? []).map((c, i) => {
    const body = c.paragraphs
      ? paragraphsArray(c.paragraphs)
      : paragraphs(c.text || "");
    const args = {
      id: `chapter-${c.number}`,
      eyebrow: `${opts.label || "Chapter"} ${roman(c.number)}`,
      title: escape(smarten(c.title)) + (c.subtitle ? ` <span class="faith-section-subtitle-inline">${escape(smarten(c.subtitle))}</span>` : ""),
      body,
    };
    return isCollapsible(doc)
      ? wrapDetails({ ...args, open: i === 0 })
      : renderSectionFlat(args);
  }).join("\n");
  const toc = tocBlock(
    doc.chapters,
    (c) => c.number,
    (c) => stripHtml(titleFor(c)) || `Chapter ${c.number}`,
    (c) => `chapter-${c.number}`,
    { label: "Chapters" }
  );
  return `
  <main class="article faith-doc faith-doc--chapters">
    ${header(doc, !!toc)}
    ${intro(doc, INTROS)}
    ${wrapBody({ toc, controls: readingControls(doc), sections: items })}
  </main>`;
}

function renderArticles(doc) {
  // Augsburg, Belgic, 39 Articles, 1689, Lausanne — confessional articles.
  const items = (doc.articles ?? []).map((a, i) => {
    const args = {
      id: `article-${a.number}`,
      eyebrow: a.number > 0 ? `Article ${roman(a.number)}` : "Preface",
      title: escape(smarten(a.title)),
      body: paragraphs(a.text),
    };
    return isCollapsible(doc)
      ? wrapDetails({ ...args, open: i === 0 })
      : renderSectionFlat(args);
  }).join("\n");
  const numberedArticles = (doc.articles ?? []).filter((a) => a.number > 0);
  const toc = tocBlock(
    numberedArticles,
    (a) => a.number,
    (a) => a.title,
    (a) => `article-${a.number}`,
    { label: "Articles" }
  );
  return `
  <main class="article faith-doc faith-doc--articles">
    ${header(doc, !!toc)}
    ${intro(doc, INTROS)}
    ${wrapBody({ toc, controls: readingControls(doc), sections: items })}
  </main>`;
}

function renderTheses(doc) {
  // 95 Theses — flat numbered list, each thesis is short.
  const items = (doc.theses ?? []).map((t) => `
        <li class="faith-thesis" id="thesis-${t.number}">
          <span class="faith-thesis-number">${t.number}</span>
          <p class="faith-thesis-text">${escape(smarten(t.text))}</p>
        </li>
  `).join("\n");
  const list = `
        <ol class="faith-thesis-list">
          ${items}
        </ol>`;
  return `
  <main class="article faith-doc faith-doc--theses">
    ${header(doc, false)}
    ${intro(doc, INTROS)}
    ${wrapBody({ toc: "", controls: "", sections: list })}
  </main>`;
}

function renderQA(doc) {
  // Westminster Shorter (flat) or Larger (collapsible). The question
  // serves as the "summary" of each <details>.
  const collapsible = isCollapsible(doc);
  const items = (doc.questions ?? []).map((q, i) => {
    const refs = q.references && q.references.length
      ? renderScriptureRefs(q.references)
      : "";
    const body = `${paragraphs(q.answer)}${refs}`;
    if (!collapsible) {
      return `
        <article class="faith-qa" id="q-${q.number}">
          <p class="faith-qa-number">Q. ${q.number}</p>
          <h3 class="faith-qa-question"><em>${escape(smarten(q.question))}</em></h3>
          <div class="faith-qa-answer article-content">
            ${body}
          </div>
        </article>`;
    }
    return `
        <details class="faith-section-details faith-qa-details" id="q-${q.number}"${i === 0 ? " open" : ""}>
          <summary class="faith-section-summary faith-qa-summary">
            <div class="faith-section-summary-inner">
              <p class="faith-qa-number">Q. ${q.number}</p>
              <h3 class="faith-qa-question"><em>${escape(smarten(q.question))}</em></h3>
            </div>
            <span class="faith-chev" aria-hidden="true"></span>
          </summary>
          <div class="faith-section-body faith-qa-answer article-content">
            ${body}
          </div>
        </details>`;
  }).join("\n");
  // Larger Catechism gets a numerical-jump TOC; Shorter doesn't
  // (107 short Q&A flow more naturally as a single column).
  const toc = collapsible
    ? tocBlock(
        doc.questions ?? [],
        (q) => q.number,
        (q) => q.question,
        (q) => `q-${q.number}`,
        { label: "Questions" }
      )
    : "";
  return `
  <main class="article faith-doc faith-doc--qa">
    ${header(doc, !!toc)}
    ${intro(doc, INTROS)}
    ${wrapBody({ toc, controls: readingControls(doc), sections: items, kindClass: "faith-doc-layout--qa" })}
  </main>`;
}

function renderHeidelberg(doc) {
  // 52 Lord's Days grouped by Part (Misery, Deliverance, Gratitude).
  // Each Lord's Day is a collapsible. Q&A inside a Lord's Day stay
  // flat. Sidebar TOC groups by part to match the original TFR.
  const partList = ["misery", "deliverance", "gratitude"];
  const partLabels = {
    misery: "Part I &middot; Misery",
    deliverance: "Part II &middot; Deliverance",
    gratitude: "Part III &middot; Gratitude",
  };

  const allDays = doc.lordsDays ?? [];
  const toc = heidelbergTocBlock(allDays);

  let sectionsHtml = "";
  for (const sec of partList) {
    const days = allDays.filter((d) => d.section === sec);
    if (!days.length) continue;
    sectionsHtml += `
        <section class="faith-heidelberg-part" id="part-${sec}">
          <p class="eyebrow faith-part-eyebrow">${partLabels[sec]}</p>
          <div class="flourish">{{> "flourish-mark"}}</div>
          ${days.map((d, i) => renderLordsDay(d, sec === "misery" && i === 0)).join("\n")}
        </section>`;
  }
  return `
  <main class="article faith-doc faith-doc--heidelberg">
    ${header(doc, !!toc)}
    ${intro(doc, INTROS)}
    ${wrapBody({ toc, controls: readingControls(doc), sections: sectionsHtml })}
  </main>`;
}

function renderLordsDay(d, openByDefault) {
  const qs = (d.questions ?? []).map((q) => `
              <article class="faith-qa" id="q-${q.number}">
                <p class="faith-qa-number">Q. ${q.number}</p>
                <h3 class="faith-qa-question"><em>${escape(smarten(q.question))}</em></h3>
                <div class="faith-qa-answer article-content">
                  ${paragraphs(q.answer)}
                </div>
                ${
                  q.references && q.references.length
                    ? renderScriptureRefs(q.references)
                    : ""
                }
              </article>
  `).join("\n");
  return `
          <details class="faith-section-details faith-lords-day-details" id="lords-day-${d.number}"${openByDefault ? " open" : ""}>
            <summary class="faith-section-summary">
              <div class="faith-section-summary-inner">
                <p class="faith-section-numeral">Lord's Day ${d.number}</p>
                <h2 class="faith-section-title"><em>${escape(smarten(d.title))}</em></h2>
              </div>
              <span class="faith-chev" aria-hidden="true"></span>
            </summary>
            <div class="faith-section-body faith-lords-day-body">
              ${qs}
            </div>
          </details>`;
}

function renderEdwards(doc) {
  // 70 numbered resolutions, prefaced by an opening note. Flat.
  const items = (doc.resolutions ?? []).map((r, i) => {
    if (i === 0) {
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
    ${header(doc, false)}
    ${intro(doc, INTROS)}
    ${wrapBody({ toc: "", controls: "", sections: items })}
  </main>`;
}

function renderLibraryChapters(doc) {
  // Single-flat-list of chapters (athanasius-incarnation,
  // charnock-discourses, rerum-novarum). Each chapter is its own
  // collapsible.
  const list = doc.chapters ?? doc.discourses ?? doc.sections ?? [];
  const label = doc.discourses ? "Discourse" : doc.sections ? "Section" : "Chapter";

  const items = list.map((c, i) => {
    const args = {
      id: `chapter-${c.number}`,
      eyebrow: `${label} ${roman(c.number)}`,
      title: titleFor(c),
      body: paragraphsArray(c.paragraphs),
    };
    return isCollapsible(doc)
      ? wrapDetails({ ...args, open: i === 0 })
      : renderSectionFlat(args);
  }).join("\n");

  const toc = tocBlock(
    list,
    (c) => c.number,
    (c) => stripHtml(titleFor(c)) || `${label} ${c.number}`,
    (c) => `chapter-${c.number}`,
    { label: `${label}s` }
  );
  return `
  <main class="article faith-doc faith-doc--library">
    ${header(doc, !!toc)}
    ${intro(doc, INTROS)}
    ${wrapBody({ toc, controls: readingControls(doc), sections: items })}
  </main>`;
}

function renderLibraryBooks(doc) {
  // Multi-book classics (Calvin, Augustine, Imitation). Each book has
  // chapters underneath. Chapter is the collapsible unit; book level
  // is a fixed grouping with its own eyebrow + flourish.
  const html = (doc.books ?? []).map((b, bookIdx) => {
    const chapters = (b.chapters ?? []).map((c, i) => {
      const args = {
        id: `book-${b.bookNumber}-chapter-${c.number}`,
        eyebrow: `Chapter ${roman(c.number)}`,
        title: titleFor(c),
        body: paragraphsArray(c.paragraphs),
      };
      // First chapter of first book is open by default; everything
      // else collapsed.
      return wrapDetails({ ...args, open: bookIdx === 0 && i === 0, kindClass: "faith-book-chapter" });
    }).join("\n");
    return `
        <section class="faith-book" id="book-${b.bookNumber}">
          <p class="eyebrow faith-part-eyebrow">${b.bookNumber > 0 ? `Book ${roman(b.bookNumber)}` : "Preface"}</p>
          ${b.bookTitle && b.bookTitle !== `Book ${b.bookNumber}` ? `<h2 class="faith-book-title"><em>${escape(smarten(b.bookTitle))}</em></h2>` : ""}
          <div class="flourish">{{> "flourish-mark"}}</div>
          ${chapters}
        </section>`;
  }).join("\n");
  const toc = booksTocBlock(doc.books);
  return `
  <main class="article faith-doc faith-doc--library faith-doc--books">
    ${header(doc, !!toc)}
    ${intro(doc, INTROS)}
    ${wrapBody({ toc, controls: readingControls(doc), sections: html })}
  </main>`;
}

// ── Dispatch ────────────────────────────────────────────────────
function renderDoc(doc) {
  switch (doc.kind) {
    case "sections":           return renderSections(doc);
    case "chapters":           return renderChapters(doc, { label: "Chapter" });
    case "articles":           return renderArticles(doc);
    case "theses":             return renderTheses(doc);
    case "qa":                 return renderQA(doc);
    case "heidelberg":         return renderHeidelberg(doc);
    case "edwards":            return renderEdwards(doc);
    case "library-chapters":
    case "library-discourses":
    case "library-sections":   return renderLibraryChapters(doc);
    case "library-books":      return renderLibraryBooks(doc);
    default:
      console.warn(`Unknown kind: ${doc.kind} for ${doc.slug}`);
      return `\n  <main class="faith-doc"><div class="container container-narrow"><p>Document not yet ported.</p></div></main>`;
  }
}

// ── Main ────────────────────────────────────────────────────────
const INTROS = JSON.parse(await readFile(INTRO_PATH, "utf-8"));

// Only document JSONs go through the renderer. Underscore-prefixed
// files (_manifest.json, _topics.json) are sidecars consumed below.
const files = (await readdir(DATA_DIR)).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
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

manifest.sort((a, b) => {
  if (a.category !== b.category) return a.category < b.category ? -1 : 1;
  const ya = parseDateStart(a.date);
  const yb = parseDateStart(b.date);
  if (ya !== yb) return ya - yb;
  return a.title.localeCompare(b.title);
});
await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

// Homepage card grid — one chronological list of every document.
// Sorted by parseDateStart (Apostles' first, Lausanne last). Card
// shows the date as an editorial eyebrow, italic display title,
// optional author, description, and read link. The category
// (documents vs library) drops out of the visual; the items merge
// into a single timeline so the page reads as a literal canon
// from oldest to newest.
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
// Sort by parsed start year (sub-sorts: BC negative, AD positive).
const chronological = manifest.slice().sort((a, b) => {
  const ya = parseDateStart(a.date);
  const yb = parseDateStart(b.date);
  if (ya !== yb) return ya - yb;
  return a.title.localeCompare(b.title);
});
await writeFile(
  path.join(OUT_DIR, "_cards-chronological.hbs"),
  `{{!-- Generated by scripts/build-faith-received.mjs. Do not edit by hand. --}}\n<div class="faith-card-grid">${chronological.map(cardMarkup).join("\n")}\n</div>\n`
);

// Wrapper templates, one per document. Each loads faith-received.js
// for the reading controls (Expand all / Collapse all), the
// auto-open-on-anchor handler, and the print handler.
const TEMPLATE_DIR = path.join(ROOT);
for (const item of manifest) {
  const tmpl = `{{!< default}}\n{{!-- Generated wrapper for /the-faith-received/${item.slug}/. Edit\n     scripts/build-faith-received.mjs (or the underlying partial) and\n     re-run \`node scripts/build-faith-received.mjs\` to regenerate. --}}\n{{> "faith-received/${item.slug}"}}\n<script src="{{asset "js/faith-received.js"}}"></script>\n`;
  await writeFile(path.join(TEMPLATE_DIR, `custom-faith-${item.slug}.hbs`), tmpl);
}

// ── Topic pages ─────────────────────────────────────────────────
// One partial per topic, listing every passage assigned to that
// topic across the whole library, grouped by source document. Plus
// a top-level topics index partial showing all 13 topics as cards.
const TOPICS_PATH = path.join(DATA_DIR, "_topics.json");
let topicsBundle = null;
try {
  topicsBundle = JSON.parse(await readFile(TOPICS_PATH, "utf-8"));
} catch {
  console.log("  ! _topics.json not found; topics pages skipped");
}

if (topicsBundle) {
  // Per-topic counts.
  const counts = {};
  for (const a of topicsBundle.assignments) {
    for (const t of a.topics) counts[t] = (counts[t] || 0) + 1;
  }

  // Topics index page partial.
  const topicCards = topicsBundle.order.map((slug, idx) => {
    const meta = topicsBundle.meta[slug];
    const count = counts[slug] || 0;
    return `
        <a class="faith-topic-card" href="/the-faith-received/topics/${slug}/">
          <span class="faith-topic-card-numeral">${roman(idx + 1)}</span>
          <h3 class="faith-topic-card-title"><em>${escape(smarten(meta.label))}</em></h3>
          <p class="faith-topic-card-desc">${escape(smarten(meta.description))}</p>
          <p class="faith-topic-card-count">${count} passage${count === 1 ? "" : "s"}</p>
        </a>`;
  }).join("\n");
  const topicsIndexBody = `
  <main class="faith-received faith-feature faith-topics-index">
    ${heroForFeature({
      kicker: "The Faith Received &middot; Topics",
      headline: "The great themes of the <span class=\"highlight\"><em>Christian faith</em></span>, cross-referenced.",
      sub: "From God and the Trinity to salvation, the Church, and the life to come. Trace each doctrine across two millennia of Christian writing.",
    })}
    <section class="faith-feature-body">
      <div class="container">
        <div class="faith-topic-card-grid">
          ${topicCards}
        </div>
      </div>
    </section>
  </main>
<script src="{{asset "js/faith-received.js"}}"></script>`;
  await writeFile(
    path.join(OUT_DIR, "_topics-index.hbs"),
    `{{!-- Generated by scripts/build-faith-received.mjs. Do not edit by hand. --}}\n${topicsIndexBody.trim()}\n`
  );

  // Per-topic detail partials. Build a doc-keyed lookup from the JSON
  // we already loaded so we can enrich each assignment with a real
  // label + snippet.
  const docByslug = {};
  for (const f of files) {
    const d = JSON.parse(await readFile(path.join(DATA_DIR, f), "utf-8"));
    docByslug[d.slug] = d;
  }

  for (const slug of topicsBundle.order) {
    const meta = topicsBundle.meta[slug];
    const items = topicsBundle.assignments.filter((a) => a.topics.includes(slug));

    // Group by source document, keep document order from the manifest
    // (chronological). Inside each group, keep TFR's original order.
    const groups = {};
    for (const a of items) {
      const src = normalizeSource(a.source);
      if (!groups[src]) groups[src] = [];
      groups[src].push(a);
    }
    const orderedSources = chronological
      .map((m) => m.slug)
      .filter((s) => groups[s] && groups[s].length);

    const groupHtml = orderedSources.map((src) => {
      const docMeta = chronological.find((m) => m.slug === src);
      const rows = groups[src].map((a) => topicAssignmentRow(a, docByslug[src])).join("\n");
      return `
        <section class="faith-topic-group" id="doc-${src}">
          <header class="faith-topic-group-header">
            <p class="eyebrow">${escape(docMeta.date)}</p>
            <h2 class="section-heading"><em>${escape(smarten(docMeta.title))}</em></h2>
            ${docMeta.author ? `<p class="faith-topic-group-author"><em>${escape(smarten(docMeta.author))}</em></p>` : ""}
          </header>
          <ol class="faith-topic-row-list">
            ${rows}
          </ol>
        </section>`;
    }).join("\n");

    // Sidebar TOC of source docs for this topic.
    const sidebarItems = orderedSources.map((src) => {
      const m = chronological.find((x) => x.slug === src);
      return `
        <li class="faith-toc-item"><a href="#doc-${src}"><span class="faith-toc-num">${escape(m.date)}</span><span class="faith-toc-label">${escape(smarten(m.title))}</span></a></li>`;
    }).join("");
    const sidebar = orderedSources.length >= 4 ? `
  <nav class="faith-toc" aria-label="Documents">
    <p class="faith-toc-label-heading">Documents</p>
    <ol class="faith-toc-list">${sidebarItems}
    </ol>
  </nav>` : "";

    const body = `
  <main class="article faith-doc faith-doc--topic" data-topic-slug="${slug}">
    <section class="article-header faith-doc-header faith-topic-header">
      <div class="article-header-inner">
        <p class="article-topic"><a href="/the-faith-received/topics/" class="article-topic-tag">All topics</a></p>
        <h1 class="article-title">${escape(smarten(meta.label))}</h1>
        <p class="faith-doc-description">${escape(smarten(meta.description))}</p>
        <div class="faith-doc-actions">
          ${sidebar ? `<button type="button" class="faith-doc-toc-toggle" data-faith-toc-toggle aria-label="Open contents"><span class="faith-doc-toc-toggle-icon" aria-hidden="true"><span></span><span></span><span></span></span><span class="faith-doc-toc-toggle-label">Documents</span></button>` : ""}
          <a href="/the-faith-received/topics/" class="faith-doc-back"><span aria-hidden="true">&larr;</span> All topics</a>
        </div>
      </div>
    </section>
    ${
      sidebar
        ? `
    <div class="article-body faith-doc-body faith-doc-body--has-sidebar">
      <div class="faith-doc-layout">
        <aside class="faith-toc-sidebar" data-faith-toc-drawer aria-label="Documents">
          <button type="button" class="faith-toc-close" data-faith-toc-close aria-label="Close documents"><span aria-hidden="true">&times;</span></button>${sidebar}
        </aside>
        <div class="faith-doc-inner">
          ${
            items.length === 0
              ? `<p class="faith-topic-empty">No passages assigned to this topic yet.</p>`
              : groupHtml
          }
        </div>
      </div>
      <div class="faith-toc-backdrop" data-faith-toc-backdrop hidden></div>
    </div>`
        : `
    <div class="article-body faith-doc-body">
      <div class="container container-narrow faith-doc-inner">
        ${
          items.length === 0
            ? `<p class="faith-topic-empty">No passages assigned to this topic yet.</p>`
            : groupHtml
        }
      </div>
    </div>`
    }
  </main>
<script src="{{asset "js/faith-received.js"}}"></script>`;
    await writeFile(
      path.join(OUT_DIR, `_topic-${slug}.hbs`),
      `{{!-- Generated by scripts/build-faith-received.mjs. Do not edit by hand. --}}\n${body.trim()}\n`
    );

    // Wrapper template
    const tmpl = `{{!< default}}\n{{!-- /the-faith-received/topics/${slug}/. Auto-generated; edit\n     scripts/build-faith-received.mjs (or the underlying partial). --}}\n{{> "faith-received/_topic-${slug}"}}\n`;
    await writeFile(path.join(TEMPLATE_DIR, `custom-faith-topic-${slug}.hbs`), tmpl);
  }

  // Topics index wrapper
  await writeFile(
    path.join(TEMPLATE_DIR, `custom-faith-topics.hbs`),
    `{{!< default}}\n{{!-- /the-faith-received/topics/ — auto-generated index of every topic. --}}\n{{> "faith-received/_topics-index"}}\n`
  );

  console.log(`  + ${topicsBundle.order.length} topic pages + topics index`);
}

// ── Helpers used by topic rendering ──────────────────────────────
function normalizeSource(source) {
  // TFR uses "confession-1689"; my slug is "1689".
  if (source === "confession-1689") return "1689";
  return source;
}

function normalizeAnchor(source, type, id) {
  // TFR id formats → my anchor id formats. Per-source quirks first,
  // then a generic prefix swap for the common shorthand.
  if (source === "athanasius-incarnation") {
    if (id === "introduction") return "chapter-1";
    const m = id.match(/^(?:ch(?:apter)?-?)(\d+)$/);
    return m ? `chapter-${m[1]}` : id;
  }
  if (source === "augustine-confessions" || source === "calvin-institutes" ||
      source === "imitation-of-christ") {
    const m = id.match(/^book-(\d+)-ch-(\d+)$/);
    return m ? `book-${m[1]}-chapter-${m[2]}` : id;
  }
  if (source === "rerum-novarum") {
    const m = id.match(/^section-(\d+)$/);
    return m ? `chapter-${m[1]}` : id;
  }
  if (source === "lausanne") {
    const m = id.match(/^sec-(\d+)$/);
    return m ? `article-${m[1]}` : id;
  }
  if (source === "charnock-attributes") {
    const m = id.match(/^discourse-(\d+)$/);
    return m ? `chapter-${m[1]}` : id;
  }
  // Generic shorthand mapping.
  if (id.startsWith("sec-")) return "section-" + id.slice(4);
  if (id.startsWith("ch-")) return "chapter-" + id.slice(3);
  if (id.startsWith("art-")) return "article-" + id.slice(4);
  if (id.startsWith("res-")) return "resolution-" + id.slice(4);
  if (id.startsWith("thesis-")) return id; // already correct
  if (/^q\d+$/.test(id)) return "q-" + id.slice(1);
  return id;
}

// Look up the actual label / question / chapter title from the
// document JSON so the topic page row is meaningful, not just
// "Q. 1" with no context.
function lookupContent(doc, type, id) {
  if (!doc) return { label: "", snippet: "" };
  const num = parseInt((id.match(/\d+$/) || [""])[0], 10);
  if (type === "question") {
    if (doc.lordsDays) {
      for (const ld of doc.lordsDays) {
        for (const q of ld.questions || []) {
          if (q.number === num) return { label: `Q. ${num} (Lord's Day ${ld.number})`, snippet: q.question };
        }
      }
    }
    if (doc.questions) {
      const q = doc.questions.find((q) => q.number === num);
      if (q) return { label: `Q. ${num}`, snippet: q.question };
    }
  }
  if (type === "section") {
    const s = (doc.sections || []).find((s) => s.number === num);
    if (s) return { label: `Section ${roman(s.number)}`, snippet: s.title };
  }
  if (type === "chapter") {
    if (doc.chapters) {
      const c = doc.chapters.find((c) => c.number === num);
      if (c) return { label: `Chapter ${roman(c.number)}`, snippet: stripHtml(titleFor(c)) };
    }
    if (doc.books) {
      const m = id.match(/book-(\d+)-ch-(\d+)/);
      if (m) {
        const bookNum = parseInt(m[1], 10);
        const chNum = parseInt(m[2], 10);
        const b = doc.books.find((b) => b.bookNumber === bookNum);
        if (b) {
          const c = (b.chapters || []).find((c) => c.number === chNum);
          if (c) return { label: `Book ${roman(bookNum)} · Chapter ${roman(chNum)}`, snippet: stripHtml(titleFor(c)) };
        }
      }
    }
    if (doc.discourses) {
      const c = doc.discourses.find((d) => d.number === num);
      if (c) return { label: `Discourse ${roman(c.number)}`, snippet: stripHtml(titleFor(c)) };
    }
  }
  if (type === "discourse") {
    const c = (doc.discourses || []).find((d) => d.number === num);
    if (c) return { label: `Discourse ${roman(c.number)}`, snippet: stripHtml(titleFor(c)) };
  }
  if (type === "article") {
    const a = (doc.articles || []).find((a) => a.number === num);
    if (a) return { label: `Article ${roman(a.number)}`, snippet: a.title };
  }
  if (type === "thesis") {
    const t = (doc.theses || []).find((t) => t.number === num);
    if (t) return { label: `Thesis ${num}`, snippet: snippetOfShort(t.text) };
  }
  if (type === "resolution") {
    const r = (doc.resolutions || []).find((r, i) => i === num);
    if (r) return { label: `Resolution ${num}`, snippet: snippetOfShort(r.text) };
  }
  return { label: type, snippet: "" };
}

function snippetOfShort(text) {
  if (!text) return "";
  const t = String(text).replace(/\s+/g, " ").trim();
  return t.length > 160 ? t.slice(0, 160) + "…" : t;
}

function topicAssignmentRow(a, doc) {
  const src = normalizeSource(a.source);
  const anchor = normalizeAnchor(src, a.type, a.id);
  const url = `/the-faith-received/${src}/#${anchor}`;
  const info = lookupContent(doc, a.type, a.id);
  return `
            <li class="faith-topic-row">
              <a href="${url}" class="faith-topic-row-link">
                <span class="faith-topic-row-label">${escape(info.label || a.type)}</span>
                ${info.snippet ? `<span class="faith-topic-row-snippet">${escape(smarten(info.snippet))}</span>` : ""}
                <span class="faith-topic-row-arrow" aria-hidden="true">&rarr;</span>
              </a>
            </li>`;
}

// Shared hero block used by topic-related pages and other features.
function heroForFeature({ kicker, headline, sub }) {
  return `
  <section class="hero faith-feature-hero">
    <div class="container">
      <p class="hero-kicker"><span class="dot"></span> ${kicker}</p>
      <h1 class="hero-headline faith-hero-headline">
        ${headline}
      </h1>
      ${sub ? `<p class="hero-sub">${sub}</p>` : ""}
    </div>
  </section>`;
}

// ── Search index ────────────────────────────────────────────────
const ASSET_DATA_DIR = path.join(ROOT, "assets", "data", "faith-received");
await mkdir(ASSET_DATA_DIR, { recursive: true });

const searchIndex = [];
for (const file of files) {
  const doc = JSON.parse(await readFile(path.join(DATA_DIR, file), "utf-8"));
  const baseUrl = `/the-faith-received/${doc.slug}/`;
  searchIndex.push({
    type: "document",
    slug: doc.slug,
    url: baseUrl,
    title: doc.title,
    author: doc.author ?? null,
    date: doc.date,
    snippet: doc.description,
  });
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

function snippetOf(text) {
  if (!text) return "";
  const trimmed = String(text).replace(/\s+/g, " ").trim();
  return trimmed.length > 280 ? trimmed.slice(0, 280) + "…" : trimmed;
}

// ── Today's reading plan ────────────────────────────────────────
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
await writeFile(path.join(ASSET_DATA_DIR, "today.json"), JSON.stringify(todayPlan));

// Scripture index — copy from the source repo if present.
const SCRIPTURE_SRC = "/Users/ianharber/Dropbox/Mac (2)/Documents/Claude Code Files/the-faith-received/data/scripture-index.json";
try {
  const sc = await readFile(SCRIPTURE_SRC, "utf-8");
  await writeFile(path.join(ASSET_DATA_DIR, "scripture-index.json"), sc);
} catch {
  // skip
}

// ── Summary ─────────────────────────────────────────────────────
console.log(`Built ${manifest.length} partials in ${OUT_DIR}`);
console.log(`  + _cards-chronological.hbs (${chronological.length})`);
console.log(`  + ${manifest.length} custom-faith-{slug}.hbs wrappers`);
console.log(`  + assets/data/faith-received/search-index.json (${searchIndex.length} entries)`);
console.log(`  + assets/data/faith-received/today.json (${todayPlan.length} entries)`);

function parseDateStart(d) {
  if (!d) return 9999;
  const s = String(d);
  const bc = s.match(/(\d+)\s*BC/i);
  if (bc) return -parseInt(bc[1], 10);
  // Century notation: "c. 2nd–4th Century" → 100, "c. 5th–6th Century" → 400.
  const cent = s.match(/(\d+)(?:st|nd|rd|th)\b/i);
  if (cent) return (parseInt(cent[1], 10) - 1) * 100;
  // Otherwise the first 2+ digit run is the year (catches "c. 50–120 AD"
  // → 50, "1517" → 1517, "1722–1723" → 1722).
  const yr = s.match(/\d{2,}/);
  return yr ? parseInt(yr[0], 10) : 9999;
}
