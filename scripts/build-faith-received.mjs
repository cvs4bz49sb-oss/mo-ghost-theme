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
    .replace(/"/g, "&quot;")
    .replace(/\{\{/g, "&#123;&#123;");  // prevent Handlebars interpretation
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

// ── Library translators + downloads ───────────────────────────
//
// Translators aren't in the doc JSON; the original TFR site keeps
// them in workMeta. Hardcoded here for now; can move to JSON when we
// re-run the import. Format-download routes match the TFR API shape
// even though no files exist yet — the markup is ready to wire up
// once we ship the generated PDFs/EPUBs to R2 (or stand up a Worker).
const LIBRARY_TRANSLATORS = {
  "augustine-confessions": "J.G. Pilkington",
  "polanus-syntagma": "Stiven Peter",
};
// The PDF and EPUB row is gone. It advertised four downloads on 56
// documents, every one of them a dead link: the set of slugs with files
// behind them was empty from the day the row was written, so each was
// rendered aria-disabled and did nothing when clicked. Offering a
// reader four formats and delivering none is worse than offering none.
function formatDownloadsRow() {
  return "";
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
  // Library docs get a translator line + hairline + format-downloads
  // row inside the header, matching the original TFR overview page.
  const translator = LIBRARY_TRANSLATORS[doc.slug];
  const translatorLine = translator
    ? `<p class="faith-doc-translator">Translated by ${escape(translator)}</p>`
    : "";
  const isLibrary = doc.category === "library";
  const libraryRule = isLibrary ? `<hr class="faith-doc-rule" aria-hidden="true">` : "";
  const downloads = isLibrary ? formatDownloadsRow(doc) : "";
  // Tradition pills sit alongside the project pill so each document
  // wears its lineage in the hero. Each links into the home Traditions
  // tab; the sub-tab itself doesn't deep-link so we land users on the
  // tab and let them pick from there.
  const traditionPills = (TRADITION_TAGS[doc.slug] || [])
    .map((slug) => `<a href="/the-faith-received/#traditions" class="article-topic-tag">${escape(TRADITION_LABELS[slug] || slug)}</a>`)
    .join("");
  return `
  <section class="article-header faith-doc-header${isLibrary ? " faith-doc-header--library" : ""}">
    <div class="article-header-inner">
      <p class="article-topic"><a href="/the-faith-received/" class="article-topic-tag">The Faith Received</a>${traditionPills}</p>
      <h1 class="article-title">${escape(smarten(doc.title))}</h1>
      <p class="article-dek faith-doc-dek">${sub}</p>
      ${translatorLine}
      ${doc.description ? `<p class="faith-doc-description">${escape(smarten(doc.description))}</p>` : ""}
      ${libraryRule}
      ${downloads}
      <div class="faith-doc-actions">
        ${tocToggle}
      </div>
    </div>
  </section>
`;
}

// ── Editorial introduction (collapsed by default behind "Read introduction") ──
//
// Mirrors the original TFR site's introduction disclosure pattern. The
// summary reads "Read introduction" / "Hide introduction" and toggles
// the longer editorial body underneath. Body keeps the dropcap on the
// first paragraph and the closing flourish so once opened it reads as
// a proper editorial preface.
function intro(doc, intros) {
  const text = intros[doc.slug];
  if (!text) return "";
  return `
  <section class="faith-intro">
    <div class="container container-narrow">
      <details class="faith-intro-disclosure" data-faith-intro>
        <summary class="faith-intro-summary">
          <span class="faith-intro-summary-label" data-faith-intro-label>Read introduction</span>
          <span class="faith-intro-summary-chev" aria-hidden="true"></span>
        </summary>
        <div class="faith-intro-body">
          <p class="faith-intro-prose hero-excerpt-dropcap">${escape(smarten(text))}</p>
        </div>
      </details>
    </div>
  </section>`;
}

// ── Reading controls (Expand / Collapse all + Modernize) ─────
//
// The modernize toggle lives here — quieter than a dark-hero CTA,
// but still findable next to the rest of the reading affordances.
// Hidden by default; the JS unhides it only when archaic language
// is detected on the page. Flat documents still render the bar so
// the modernize button has a home (Westminster Shorter, the older
// creeds, Edwards' Resolutions all have archaic prose worth flipping).
function readingControls(doc) {
  const collapsible = isCollapsible(doc);
  const expandPart = collapsible
    ? `
    <button type="button" class="faith-toggle-switch" data-faith-expand-toggle aria-pressed="false">
      <span class="faith-toggle-label" data-off="Collapsed" data-on="Expanded">Collapsed</span>
    </button>`
    : "";
  // Q&A docs (heidelberg + qa kinds) get a dedicated "Memorize" link
  // pointing at /the-faith-received/{slug}/memorize/. The link doesn't
  // depend on JS state — it's a real route — so it goes in markup.
  // Heidelberg suppresses this link because its view toggle owns the
  // Memorize tab instead.
  const memorizePart =
    (doc.kind === "qa" || (doc.kind === "heidelberg" && doc.slug !== "heidelberg"))
      ? `
    <a class="faith-reading-control faith-reading-control--link" href="/the-faith-received/${doc.slug}/memorize/">Memorize</a>`
      : "";
  return `
  <div class="faith-reading-controls" data-faith-controls>${expandPart}
    <button type="button" class="faith-toggle-switch faith-modernizer-toggle" data-modernizer-toggle aria-pressed="false" hidden>
      <span class="faith-toggle-label faith-modernizer-label" data-off="Original" data-on="Modern English">Original</span>
    </button>${memorizePart}
  </div>`;
}

// ── View toggle (Heidelberg's "By Lord's Day / By Section / Memorize") ──
//
// Mirrors the segmented control on the original TFR site. Rendered as
// three editorial-style buttons underlined on active rather than a pill,
// to keep the pattern consistent with the rest of the MO site. All
// three tabs swap views inline on the same page — Memorize is no
// longer a route navigation.
function viewToggle(doc) {
  if (doc.slug !== "heidelberg") return "";
  return `
  <nav class="faith-view-toggle" data-faith-view-toggle aria-label="Catechism view">
    <button type="button" class="faith-view-toggle-tab is-active" data-faith-view-target="lords-day" aria-pressed="true">
      <em>By Lord's Day</em>
    </button>
    <button type="button" class="faith-view-toggle-tab" data-faith-view-target="section" aria-pressed="false">
      <em>By Section</em>
    </button>
    <button type="button" class="faith-view-toggle-tab" data-faith-view-target="memorize" aria-pressed="false">
      <em>Memorize</em>
    </button>
  </nav>`;
}

// ── Inline memorize body ──────────────────────────────────────
//
// Just the memorize controls + card + JSON data (no hero, no _nav,
// no faith-feature wrapper). Embedded inside the same Heidelberg page
// so the view toggle can swap to it without navigating away. The
// /memorize/ subroute still exists as a fallback for direct links.
function renderInlineMemorize(doc, entries) {
  const total = entries.length;
  const json = JSON.stringify(entries).replace(/<\/script/gi, "<\\/script");
  const titleEsc = escape(smarten(doc.title));
  return `
        <div class="faith-memorize" data-faith-memorize data-doc-slug="${escape(doc.slug)}" data-doc-title="${titleEsc}">

          <div class="faith-memorize-progress">
            <div class="faith-memorize-progress-meta">
              <span class="faith-memorize-progress-label" data-faith-memorize-progress-label>0 of ${total} memorized</span>
              <span class="faith-memorize-progress-pct" data-faith-memorize-progress-pct>0%</span>
            </div>
            <div class="faith-memorize-progress-track" role="progressbar" aria-label="Memorization progress" aria-valuemin="0" aria-valuemax="100">
              <div class="faith-memorize-progress-fill" data-faith-memorize-progress-fill style="width: 0%"></div>
            </div>
          </div>

          <div class="faith-memorize-filters" role="tablist" aria-label="Filter questions">
            <button type="button" class="faith-memorize-filter is-active" role="tab" aria-selected="true" data-faith-memorize-filter="all">All</button>
            <button type="button" class="faith-memorize-filter" role="tab" aria-selected="false" data-faith-memorize-filter="unmemorized">Not yet</button>
            <button type="button" class="faith-memorize-filter" role="tab" aria-selected="false" data-faith-memorize-filter="memorized">Memorized</button>
          </div>

          <article class="faith-memorize-card" data-faith-memorize-card>
            <p class="eyebrow faith-memorize-numeral" data-faith-memorize-numeral></p>
            <h2 class="faith-memorize-question" data-faith-memorize-question></h2>

            <div class="faith-memorize-answer" data-faith-memorize-answer hidden>
              <div class="faith-memorize-answer-text article-content" data-faith-memorize-answer-text></div>
              <p class="faith-qa-references faith-memorize-refs" data-faith-memorize-refs hidden></p>
            </div>

            <div class="faith-memorize-actions">
              <button type="button" class="faith-memorize-reveal" data-faith-memorize-reveal>Reveal answer</button>
              <button type="button" class="faith-memorize-mark" data-faith-memorize-mark>Mark memorized</button>
            </div>

            <div class="faith-memorize-nav">
              <button type="button" class="faith-memorize-step" data-faith-memorize-prev aria-label="Previous question">
                <span aria-hidden="true">&larr;</span> Previous
              </button>
              <span class="faith-memorize-position">
                <span data-faith-memorize-position>1</span> of <span data-faith-memorize-total>${total}</span>
              </span>
              <button type="button" class="faith-memorize-step" data-faith-memorize-next aria-label="Next question">
                Next <span aria-hidden="true">&rarr;</span>
              </button>
            </div>

            <p class="faith-memorize-hint"><kbd>Space</kbd> reveals &middot; <kbd>&larr;</kbd>/<kbd>&rarr;</kbd> navigates &middot; <kbd>m</kbd> marks</p>
          </article>

          <div class="faith-memorize-empty" data-faith-memorize-empty hidden>
            <p class="eyebrow">All clear</p>
            <h2 class="section-heading"><em>No questions match this filter.</em></h2>
            <p class="faith-memorize-empty-body">Switch filters above, or keep going from <button type="button" class="faith-memorize-empty-link" data-faith-memorize-filter="all">All</button>.</p>
          </div>

          <script type="application/json" data-faith-memorize-data>${json}</script>
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
  // Each book is a <details> in the sidebar TOC. First book starts
  // open by default so the reader sees something on landing; the
  // rest collapse to compact book-level rows. Click to expand and
  // see chapter list.
  const blocks = books.map((b, i) => {
    const links = (b.chapters ?? []).map((c) => `
            <li class="faith-toc-item"><a href="#book-${b.bookNumber}-chapter-${c.number}"><span class="faith-toc-num">${roman(c.number)}</span><span class="faith-toc-label">${titleFor(c)}</span></a></li>`).join("");
    const label = b.bookNumber > 0 ? `Book ${roman(b.bookNumber)}` : "Preface";
    return `
      <details class="faith-toc-book-details">
        <summary class="faith-toc-book-summary">
          <span class="faith-toc-book-label">${label}</span>
          <span class="faith-toc-book-count">${(b.chapters || []).length} ${(b.chapters || []).length === 1 ? "ch" : "chs"}</span>
          <span class="faith-chev" aria-hidden="true"></span>
        </summary>
        <ol class="faith-toc-list faith-toc-book-list">${links}
        </ol>
      </details>`;
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
    ${wrapBody({ toc: "", controls: readingControls(doc), sections: items })}
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
      ? wrapDetails({ ...args, open: false })
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
      ? wrapDetails({ ...args, open: false })
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
  // 95 Theses — short numbered statements. Each thesis is wrapped in
  // a <details> collapsible so the Copy link / Copy passage row stays
  // hidden until the reader clicks the row, then opens inline. The
  // text itself sits in the summary so it's always visible. Click to
  // reveal copy features; click again to hide.
  const items = (doc.theses ?? []).map((t) => `
        <details class="faith-section-details faith-thesis-details" id="thesis-${t.number}">
          <summary class="faith-section-summary faith-thesis">
            <span class="faith-thesis-number">${t.number}</span>
            <p class="faith-thesis-text">${escape(smarten(t.text))}</p>
          </summary>
          <div class="faith-section-body faith-thesis-body"></div>
        </details>
  `).join("\n");
  const list = `
        <div class="faith-thesis-list">
          ${items}
        </div>`;
  return `
  <main class="article faith-doc faith-doc--theses">
    ${header(doc, false)}
    ${intro(doc, INTROS)}
    ${wrapBody({ toc: "", controls: readingControls(doc), sections: list })}
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
        <details class="faith-section-details faith-qa-details" id="q-${q.number}">
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
  // Sidebar TOC groups by part to match the original TFR.
  //
  // The page supports two in-page views via [data-faith-view] on the
  // body wrapper (toggled by the segmented control above):
  //
  //   "lords-day"  — Part headers inert; LD <details> collapsed by
  //                  default; reader picks an LD to open.
  //   "section"    — Part containers themselves are collapsible
  //                  (closed by default); opening one auto-opens the
  //                  LDs inside so the part reads as continuous text.
  //
  // The Memorize tab in the view toggle is a real route link, not an
  // in-page view, so it doesn't appear here.
  const partList = ["misery", "deliverance", "gratitude"];
  const partLabels = {
    misery: "Part I &middot; Misery",
    deliverance: "Part II &middot; Deliverance",
    gratitude: "Part III &middot; Gratitude",
  };
  const partSubtitles = {
    misery: "Lord's Days 1&ndash;4 &middot; Questions 1&ndash;11",
    deliverance: "Lord's Days 5&ndash;31 &middot; Questions 12&ndash;85",
    gratitude: "Lord's Days 32&ndash;52 &middot; Questions 86&ndash;129",
  };

  const allDays = doc.lordsDays ?? [];
  const toc = heidelbergTocBlock(allDays);

  let sectionsHtml = "";
  for (const sec of partList) {
    const days = allDays.filter((d) => d.section === sec);
    if (!days.length) continue;
    sectionsHtml += `
        <section class="faith-heidelberg-part" data-faith-part="${sec}" id="part-${sec}">
          <button type="button" class="faith-heidelberg-part-summary" data-faith-part-summary aria-expanded="true">
            <span class="faith-heidelberg-part-summary-inner">
              <span class="eyebrow faith-part-eyebrow">${partLabels[sec]}</span>
              <span class="faith-part-subtitle">${partSubtitles[sec]}</span>
            </span>
            <span class="faith-chev faith-heidelberg-part-chev" aria-hidden="true"></span>
          </button>
          <div class="faith-heidelberg-part-body">
            ${days.map((d) => renderLordsDay(d, false)).join("\n")}
          </div>
        </section>`;
  }
  // Inline memorize markup. Rendered inside the same page wrapped in
  // a [data-faith-view-content="memorize"] block so the view toggle
  // can swap to it without navigating to /memorize/. The standalone
  // /memorize/ route still exists as a direct-link fallback.
  const memEntries = memorizeEntries(doc) || [];
  const memorizeBody = memEntries.length ? renderInlineMemorize(doc, memEntries) : "";

  const body = `
        <div class="faith-heidelberg-views" data-faith-view="lords-day">
          <div data-faith-view-content="reading">
            ${sectionsHtml}
          </div>
          <div data-faith-view-content="memorize" hidden>
            ${memorizeBody}
          </div>
        </div>`;
  // The view toggle sits above the reading-controls bar so the order
  // matches the original site (view → reading affordances → content).
  const controlsStack = `${viewToggle(doc)}\n${readingControls(doc)}`;
  return `
  <main class="article faith-doc faith-doc--heidelberg">
    ${header(doc, !!toc)}
    ${intro(doc, INTROS)}
    ${wrapBody({ toc, controls: controlsStack, sections: body })}
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
  // 70 numbered resolutions, prefaced by an opening note. Each
  // resolution is wrapped in a <details> so the Copy link / Copy
  // passage row stays hidden until clicked — same pattern as 95
  // Theses. The opening preamble stays as flat prose.
  const items = (doc.resolutions ?? []).map((r, i) => {
    if (i === 0) {
      return `
          <p class="faith-edwards-preamble">${escape(smarten(r.text))}</p>`;
    }
    return `
          <details class="faith-section-details faith-edwards-details" id="resolution-${i}">
            <summary class="faith-section-summary faith-edwards-item">
              <span class="faith-edwards-number">${i}</span>
              <p class="faith-edwards-text">${escape(smarten(r.text.replace(/^\d+\.\s*/, "")))}</p>
            </summary>
            <div class="faith-section-body faith-edwards-body"></div>
          </details>`;
  }).join("\n");
  return `
  <main class="article faith-doc faith-doc--edwards">
    ${header(doc, false)}
    ${intro(doc, INTROS)}
    ${wrapBody({ toc: "", controls: readingControls(doc), sections: items })}
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
      ? wrapDetails({ ...args, open: false })
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

// ── Per-document config for library-books ────────────────────
// Single table for all per-doc overrides. Each entry can specify:
//   bookTitles  – editorial titles keyed by bookNumber
//   prayerCards – array of bookNumbers to render as compact cards
// Presence in this table implies editorial layout (front-matter
// split, chapter-count subtitles). Docs NOT listed here get the
// generic library-books layout.
const LIBRARY_BOOKS_CONFIG = {
  "augustine-confessions": {
    bookTitles: {
      1: "Infancy and Boyhood",
      2: "Object of These Confessions",
      3: "From Age Seventeen to Nineteen",
      4: "Teaching, Grief, and Restless Thought",
      5: "Faustus, Rome, and Milan",
      6: "Ambrose, Alypius, and the Struggle",
      7: "Finding God Through the Platonists",
      8: "The Conversion",
      9: "Cassiciacum, Baptism, and Monica's Death",
      10: "Memory and Temptation",
      11: "Time and Eternity",
      12: "On Genesis: Heaven and Earth",
      13: "On Genesis: Creation and the Spirit",
    },
  },
  "polanus-syntagma": {
    bookTitles: {
      1: "De Theologiae Principiis",
      2: "De Dei Essentia et Attributis Divinis",
      3: "De Sacrosancta Trinitate et Personis Divinis",
      4: "De Operibus Dei",
    },
  },
  "1928-bcp": {
    prayerCards: [4],
    bookTitles: {
      1: "The Order for Daily Morning Prayer",
      2: "The Order for Daily Evening Prayer",
      3: "The Litany, or General Supplication",
      4: "Prayers and Thanksgivings",
      5: "The Order for Holy Communion",
      6: "The Ministration of Holy Baptism",
      7: "The Catechism",
      8: "Offices of Instruction",
      9: "The Order of Confirmation",
      10: "The Form of Solemnization of Matrimony",
      11: "The Visitation of the Sick",
      12: "The Communion of the Sick",
      13: "The Order for the Burial of the Dead",
      14: "The Burial of a Child",
      15: "A Penitential Office for Ash Wednesday",
      16: "Forms of Prayer for Families",
      17: "The Thanksgiving of Women After Child-birth",
      18: "The Form and Manner of Making Deacons",
      19: "The Form and Manner of Ordering Priests",
      20: "The Form of Consecrating a Bishop",
      21: "A Litany for Ordinations",
      22: "The Consecration of a Church or Chapel",
      23: "The Institution of Ministers",
      24: "The Psalter, or Psalms of David",
    },
  },
};

function renderLibraryBooks(doc) {
  // Multi-book classics (Calvin, Augustine, Imitation). Each BOOK is
  // its own collapsible <details>; inside, each chapter is a nested
  // <details>. First book opens by default so the page has visible
  // content on landing. Books closed → reader sees a clean book-by-
  // book table of contents and can drill in.
  //
  // Confessions gets the new editorial treatment: front-matter (books
  // with bookNumber === 0) is split out into a labelled "Introductory
  // Material" section above the book list; numbered books carry their
  // editorial book titles ("Book I — Infancy and Boyhood") and a
  // chapter-count subtitle. Other library-books docs keep the
  // existing layout until the pattern is reviewed.
  const cfg = LIBRARY_BOOKS_CONFIG[doc.slug];
  const useEditorial = !!cfg;
  const allBooks = doc.books ?? [];
  const editorialTitles = (cfg && cfg.bookTitles) || {};
  const prayerCardSet = new Set((cfg && cfg.prayerCards) || []);

  const renderBookCollapsible = (b, opts = {}) => {
    // Front-matter books (bookNumber === 0) typically have a single
    // chapter and short content; rendering the chapter as a nested
    // <details> adds friction (two clicks to read) and risks ID
    // collisions when the import gives multiple front-matter books
    // the same chapter.number. So front-matter inlines its chapter
    // body directly in the book details. Numbered books keep the
    // nested chapter <details> for navigability.
    let chapters;
    if (b.bookNumber === 0 && (b.chapters || []).length <= 1) {
      const c = (b.chapters || [])[0];
      chapters = c
        ? `<div class="faith-front-matter-body article-content">${paragraphsArray(c.paragraphs)}</div>`
        : "";
    } else if (opts.prayerCards) {
      // Compact prayer-card layout: many short items rendered as
      // mini collapsibles (title-only summary, no eyebrow numeral).
      // Used for Prayers & Thanksgivings where each prayer is its
      // own chapter but the content is typically 1–2 paragraphs.
      chapters = `<div class="faith-prayer-cards">${
        (b.chapters ?? []).map((c) => {
          const chId = `book-${b.bookNumber}-chapter-${c.number}`;
          return `
              <details class="faith-prayer-card" id="${chId}">
                <summary class="faith-prayer-card-summary">
                  <span class="faith-prayer-card-title">${escape(smarten(titleFor(c)))}</span>
                  <span class="faith-chev faith-prayer-card-chev" aria-hidden="true"></span>
                </summary>
                <div class="faith-prayer-card-body article-content">
                  ${paragraphsArray(c.paragraphs)}
                </div>
              </details>`;
        }).join("")
      }</div>`;
    } else {
      chapters = (b.chapters ?? []).map((c) => {
        const chId = b.bookNumber === 0
          ? `book-0-${opts.idx ?? 0}-chapter-${c.number}`
          : `book-${b.bookNumber}-chapter-${c.number}`;
        return wrapDetails({
          id: chId,
          eyebrow: `Chapter ${roman(c.number)}`,
          title: titleFor(c),
          body: paragraphsArray(c.paragraphs),
          open: false,
          kindClass: "faith-book-chapter",
        });
      }).join("\n");
    }
    let bookLabel, bookHeading, bookSubtitle = "";
    if (b.bookNumber > 0) {
      bookLabel = `Book ${roman(b.bookNumber)}`;
      const ed = editorialTitles[b.bookNumber];
      if (ed) {
        bookHeading = `<h2 class="faith-book-title"><em>${escape(smarten(ed))}</em></h2>`;
      } else if (b.bookTitle && b.bookTitle !== `Book ${b.bookNumber}` && !/^Book \d+$/.test(b.bookTitle)) {
        bookHeading = `<h2 class="faith-book-title"><em>${escape(smarten(b.bookTitle))}</em></h2>`;
      } else {
        bookHeading = "";
      }
      if (useEditorial) {
        const n = (b.chapters || []).length;
        bookSubtitle = `<p class="faith-book-subtitle">${n} ${n === 1 ? "chapter" : "chapters"}</p>`;
      }
    } else {
      bookLabel = "Preface";
      bookHeading = b.bookTitle
        ? `<h2 class="faith-book-title"><em>${escape(smarten(b.bookTitle))}</em></h2>`
        : "";
    }
    // bookNumber === 0 (front-matter) needs a per-occurrence suffix
    // because Confessions ships two front-matter books. Numbered
    // books keep the bare `book-N` id so external references and the
    // existing TOC anchors don't break.
    const bookId = b.bookNumber === 0 ? `book-0-${opts.idx ?? 0}` : `book-${b.bookNumber}`;
    return `
        <details class="faith-book faith-book-details${opts.editorial ? " faith-book-details--editorial" : ""}" id="${bookId}">
          <summary class="faith-book-summary">
            <div class="faith-book-summary-inner">
              <p class="eyebrow faith-part-eyebrow">${bookLabel}</p>
              ${bookHeading}
              ${bookSubtitle}
            </div>
            <span class="faith-chev" aria-hidden="true"></span>
          </summary>
          <div class="faith-book-body">
            ${chapters}
          </div>
        </details>`;
  };

  let bodyHtml;
  if (useEditorial) {
    const frontBooks = allBooks.filter((b) => b.bookNumber === 0);
    const numberedBooks = allBooks.filter((b) => b.bookNumber > 0);

    // Front-matter rendered as a single "Introductory Material"
    // section where each row is itself a <details> collapsible: the
    // summary holds the title + subtitle, and clicking expands the
    // chapter body inline. No separate list-vs-bodies duplication —
    // the row IS the collapsible.
    const frontDetails = frontBooks.map((b, idx) => {
      const c = (b.chapters ?? [])[0] || {};
      const anchor = `book-0-${idx}`;
      const title = b.bookTitle || c.title || "Introduction";
      const sub = c.subtitle || "";
      const body = c.paragraphs ? paragraphsArray(c.paragraphs) : "";
      return `
            <details class="faith-front-matter-details" id="${anchor}">
              <summary class="faith-front-matter-summary">
                <span class="faith-front-matter-summary-inner">
                  <span class="faith-front-matter-title"><em>${escape(smarten(title))}</em></span>
                  ${sub ? `<span class="faith-front-matter-subtitle">${escape(smarten(sub))}</span>` : ""}
                </span>
                <span class="faith-chev faith-front-matter-chev" aria-hidden="true"></span>
              </summary>
              <div class="faith-front-matter-body article-content">
                ${body}
              </div>
            </details>`;
    }).join("");
    const frontSection = frontBooks.length
      ? `
        <section class="faith-front-matter" aria-labelledby="introductory-material-heading">
          <h2 class="eyebrow faith-front-matter-heading" id="introductory-material-heading">Introductory Material</h2>
          <div class="faith-front-matter-list">${frontDetails}
          </div>
        </section>`
      : "";

    const numberedBodies = numberedBooks.map((b) =>
      renderBookCollapsible(b, {
        editorial: true,
        idx: 0,
        prayerCards: prayerCardSet.has(b.bookNumber),
      })
    ).join("\n");

    bodyHtml = `${frontSection}
        <section class="faith-books-section" aria-label="Books">
          ${numberedBodies}
        </section>`;
  } else {
    bodyHtml = allBooks.map((b) => renderBookCollapsible(b, { idx: 0 })).join("\n");
  }

  // Editorial layout pulls front-matter into the Introductory Material
  // section above the book list, so the sidebar TOC focuses on the
  // numbered books to keep navigation tight.
  const tocBooks = useEditorial
    ? allBooks.filter((b) => b.bookNumber > 0)
    : allBooks;
  const toc = booksTocBlock(tocBooks);
  return `
  <main class="article faith-doc faith-doc--library faith-doc--books${useEditorial ? " faith-doc--editorial" : ""}">
    ${header(doc, !!toc)}
    ${intro(doc, INTROS)}
    ${wrapBody({ toc, controls: readingControls(doc), sections: bodyHtml })}
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

// ── Memorize mode ───────────────────────────────────────────────
// Flatten a Q&A doc into the entry shape faith-memorize.js expects:
// { number, question, answer, references[], lordsDay?, lordsDayTitle? }.
// Only `qa` and `heidelberg` are memorizable; everything else returns null.
function memorizeEntries(doc) {
  if (doc.kind === "qa") {
    return (doc.questions ?? []).map((q) => ({
      number: q.number,
      question: q.question,
      answer: q.answer,
      references: q.references ?? [],
    }));
  }
  if (doc.kind === "heidelberg") {
    const out = [];
    for (const ld of doc.lordsDays ?? []) {
      for (const q of ld.questions ?? []) {
        out.push({
          number: q.number,
          question: q.question,
          answer: q.answer,
          references: q.references ?? [],
          lordsDay: ld.number,
          lordsDayTitle: ld.title,
        });
      }
    }
    return out;
  }
  return null;
}

// Render the memorize page for a doc. Self-contained: hero, nav,
// progress bar, filters, card with reveal/mark, prev/next, empty
// state, plus the inline JSON the JS reads. Wrapper template loads
// faith-received.js (verse popovers, modernizer) + faith-memorize.js.
function renderMemorize(doc, entries) {
  // </script> inside the inline JSON would terminate the script tag,
  // so escape the closing-tag sequence per the HTML5 JSON-script rule.
  const json = JSON.stringify(entries).replace(/<\/(script)/gi, "<\\/$1");
  const total = entries.length;
  const titleEsc = escape(smarten(doc.title));
  const titleHighlight = `<span class="highlight"><em>${titleEsc}</em></span>`;
  return `
  <main class="faith-received faith-feature faith-memorize" data-faith-memorize data-doc-slug="${escape(doc.slug)}" data-doc-title="${titleEsc}">

    <section class="hero faith-feature-hero faith-memorize-hero">
      <div class="container">
        <p class="hero-kicker"><span class="dot"></span> The Faith Received &middot; ${titleEsc} &middot; Memorize</p>
        <h1 class="hero-headline faith-hero-headline">
          Learn ${titleHighlight} by heart.
        </h1>
        <p class="hero-sub">One question at a time. Reveal the answer when you're ready, mark what you've memorized, and pick up where you left off.</p>
      </div>
    </section>



    <section class="faith-feature-body faith-memorize-body">
      <div class="container container-narrow">

        <div class="faith-memorize-progress">
          <div class="faith-memorize-progress-meta">
            <span class="faith-memorize-progress-label" data-faith-memorize-progress-label>0 of ${total} memorized</span>
            <span class="faith-memorize-progress-pct" data-faith-memorize-progress-pct>0%</span>
          </div>
          <div class="faith-memorize-progress-track" role="progressbar" aria-label="Memorization progress" aria-valuemin="0" aria-valuemax="100">
            <div class="faith-memorize-progress-fill" data-faith-memorize-progress-fill style="width: 0%"></div>
          </div>
        </div>

        <div class="faith-memorize-filters" role="tablist" aria-label="Filter questions">
          <button type="button" class="faith-memorize-filter is-active" role="tab" aria-selected="true" data-faith-memorize-filter="all">All</button>
          <button type="button" class="faith-memorize-filter" role="tab" aria-selected="false" data-faith-memorize-filter="unmemorized">Not yet</button>
          <button type="button" class="faith-memorize-filter" role="tab" aria-selected="false" data-faith-memorize-filter="memorized">Memorized</button>
        </div>

        <article class="faith-memorize-card" data-faith-memorize-card>
          <p class="eyebrow faith-memorize-numeral" data-faith-memorize-numeral></p>
          <h2 class="faith-memorize-question" data-faith-memorize-question></h2>

          <div class="faith-memorize-answer" data-faith-memorize-answer hidden>
            <div class="faith-memorize-answer-text article-content" data-faith-memorize-answer-text></div>
            <p class="faith-qa-references faith-memorize-refs" data-faith-memorize-refs hidden></p>
          </div>

          <div class="faith-memorize-actions">
            <button type="button" class="btn btn-ghost faith-memorize-reveal" data-faith-memorize-reveal>Reveal answer</button>
            <button type="button" class="btn btn-primary faith-memorize-mark" data-faith-memorize-mark>Mark memorized</button>
          </div>

          <div class="faith-memorize-nav">
            <button type="button" class="faith-memorize-step" data-faith-memorize-prev aria-label="Previous question">
              <span aria-hidden="true">&larr;</span> Previous
            </button>
            <span class="faith-memorize-position">
              <span data-faith-memorize-position>1</span> of <span data-faith-memorize-total>${total}</span>
            </span>
            <button type="button" class="faith-memorize-step" data-faith-memorize-next aria-label="Next question">
              Next <span aria-hidden="true">&rarr;</span>
            </button>
          </div>

          <p class="faith-memorize-hint"><kbd>Space</kbd> reveals &middot; <kbd>&larr;</kbd>/<kbd>&rarr;</kbd> navigates &middot; <kbd>m</kbd> marks</p>
        </article>

        <div class="faith-memorize-empty" data-faith-memorize-empty hidden>
          <p class="eyebrow">All clear</p>
          <h2 class="section-heading"><em>No questions match this filter.</em></h2>
          <p class="faith-memorize-empty-body">Switch filters above, or keep going from <button type="button" class="faith-memorize-empty-link" data-faith-memorize-filter="all">All</button>.</p>
        </div>

        <p class="faith-memorize-back">
          <a href="/the-faith-received/${doc.slug}/">&larr; Read ${titleEsc} in full</a>
        </p>
      </div>
    </section>

    <script type="application/json" data-faith-memorize-data>${json}</script>
  </main>`;
}

// ── Main ────────────────────────────────────────────────────────
const INTROS = JSON.parse(await readFile(INTRO_PATH, "utf-8"));

// ── Tradition tagging (declared early so header() can reference it
// when rendering each document's hero pill row). The Traditions tab
// builder below also reads these maps. --
const TRADITION_LABELS = {
  patristic: "Patristic & Early Church",
  catholic: "Roman Catholic",
  scholastic: "Scholastic",
  lutheran: "Lutheran",
  anglican: "Anglican",
  reformed: "Reformed",
  baptist: "Baptist",
  evangelical: "Evangelical",
};
const TRADITION_ORDER = ["patristic", "catholic", "scholastic", "lutheran", "anglican", "reformed", "baptist", "evangelical"];
const TRADITION_DESCRIPTIONS = {
  patristic: "The undivided Church of the first millennium - creeds, councils, and the Greek and Latin fathers whose witness all later traditions inherit.",
  catholic: "The Western tradition continuing through Rome - the medieval doctors, the devotional classics, and modern Catholic social teaching.",
  scholastic: "The systematic dogmatics of the medieval and post-Reformation universities - theology argued in the schoolroom method, in dialogue with Aristotle and the fathers, organised by question and distinction.",
  lutheran: "The Reformation that began with Luther's protest at Wittenberg and crystallised in the Augsburg Confession.",
  anglican: "The English Reformation as set down in the Articles of Religion and the Book of Common Prayer.",
  reformed: "The Calvinist tradition - confessions, catechisms, and dogmatics from Geneva, the Netherlands, the Palatinate, Westminster, and New England.",
  baptist: "The believer-baptist confessional tradition - rooted in Reformed theology but distinguished by ecclesiology and the ordinances.",
  evangelical: "The modern world-evangelization movement - cross-denominational and missional, expressed in the Lausanne Covenant.",
};
const TRADITION_TAGS = {
  // Documents
  "apostles-creed":      ["patristic"],
  "nicene-creed":        ["patristic"],
  "chalcedonian":        ["patristic"],
  "athanasian":          ["patristic"],
  "didache":             ["patristic"],
  "augsburg":            ["lutheran"],
  "belgic":              ["reformed"],
  "heidelberg":          ["reformed"],
  "thirty-nine-articles":["anglican"],
  "westminster-shorter": ["reformed"],
  "westminster-larger":  ["reformed", "scholastic"],
  "1689":                ["reformed", "baptist"],
  "lausanne":            ["evangelical"],
  // Library
  "diognetus":               ["patristic"],
  "athanasius-incarnation":  ["patristic"],
  "augustine-confessions":   ["patristic", "catholic"],
  "imitation-of-christ":     ["catholic"],
  "ninety-five-theses":      ["lutheran"],
  "calvin-institutes":       ["reformed"],
  "edwards-resolutions":     ["reformed"],
  "charnock-attributes":     ["reformed", "scholastic"],
  "polanus-syntagma":        ["reformed", "scholastic"],
  "rerum-novarum":           ["catholic"],
  "1928-bcp":                ["anglican"],
  // Ante-Nicene Fathers (Vols I–III)
  "anf-barnabas":            ["patristic"],
  "anf-papias-fragments":    ["patristic"],
  "anf-clement-corinthians": ["patristic"],
  "anf-justin-hortatory":    ["patristic"],
  "anf-justin-sole-government": ["patristic"],
  "anf-justin-discourse-greeks": ["patristic"],
  "anf-martyrdom-ignatius":  ["patristic"],
  "anf-hermas-shepherd":     ["patristic"],
  "anf-polycarp-philippians":["patristic"],
  "anf-ignatius-epistles":   ["patristic"],
  "anf-justin-dialogue-trypho": ["patristic"],
  "anf-justin-first-apology":["patristic"],
  "anf-martyrdom-polycarp":  ["patristic"],
  "anf-justin-second-apology": ["patristic"],
  "anf-tatian-address":      ["patristic"],
  "anf-athenagoras-plea":    ["patristic"],
  "anf-athenagoras-resurrection": ["patristic"],
  "anf-irenaeus-against-heresies": ["patristic"],
  "anf-irenaeus-fragments":  ["patristic"],
  "anf-theophilus-autolycus": ["patristic"],
  "anf-clement-alexandria-exhortation": ["patristic"],
  "anf-tertullian-ad-martyras": ["patristic"],
  "anf-tertullian-answer-jews": ["patristic"],
  "anf-tertullian-apology":  ["patristic"],
  "anf-tertullian-shows":    ["patristic"],
  "anf-tertullian-on-baptism": ["patristic"],
  "anf-tertullian-idolatry": ["patristic"],
  "anf-tertullian-on-prayer":["patristic"],
  "anf-tertullian-on-repentance": ["patristic"],
  "anf-clement-alexandria-instructor": ["patristic"],
  "anf-tertullian-against-hermogenes": ["patristic"],
  "anf-tertullian-on-patience": ["patristic"],
  "anf-tertullian-prescription": ["patristic"],
  "anf-clement-alexandria-stromata": ["patristic"],
  "anf-clement-alexandria-rich-man": ["patristic"],
  "anf-perpetua-felicitas":  ["patristic"],
  "anf-tertullian-against-valentinians": ["patristic"],
  "anf-tertullian-flesh-of-christ": ["patristic"],
  "anf-tertullian-resurrection": ["patristic"],
  "anf-tertullian-against-marcion": ["patristic"],
  "anf-tertullian-soul":     ["patristic"],
  "anf-tertullian-scorpiace":["patristic"],
  "anf-tertullian-chaplet":  ["patristic"],
  "anf-tertullian-scapula":  ["patristic"],
  "anf-tertullian-against-praxeas": ["patristic"],
};

// Only document JSONs go through the renderer. Underscore-prefixed
// files (_manifest.json, _topics.json) are sidecars consumed below.
const files = (await readdir(DATA_DIR)).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
const manifest = [];
const memorizeBuilt = [];
for (const file of files) {
  const doc = JSON.parse(await readFile(path.join(DATA_DIR, file), "utf-8"));
  const html = renderDoc(doc);
  const partialPath = path.join(OUT_DIR, `${doc.slug}.hbs`);
  await writeFile(partialPath, html.trim() + "\n");

  // Memorize partial — only for Q&A docs (heidelberg + qa).
  const entries = memorizeEntries(doc);
  if (entries && entries.length) {
    const memHtml = renderMemorize(doc, entries);
    const memPath = path.join(OUT_DIR, `${doc.slug}-memorize.hbs`);
    await writeFile(memPath, memHtml.trim() + "\n");
    memorizeBuilt.push({ slug: doc.slug, title: doc.title, count: entries.length });
  }

  manifest.push({
    slug: doc.slug,
    title: doc.title,
    author: doc.author,
    date: doc.date,
    description: doc.description,
    category: doc.category,
    kind: doc.kind,
    memorizable: !!(entries && entries.length),
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
// Pad a grid out to a multiple of LCM(2, 3) = 6 with empty filler
// cells. Keeps the row-separator hairlines spanning the full grid
// width when the last row isn't fully populated, at both the 3-col
// (desktop) and 2-col (tablet) breakpoints. Fillers are display:none
// at the 1-col (mobile) breakpoint via CSS.
function padCardsForGrid(cards, columns = 6) {
  const need = (columns - (cards.length % columns)) % columns;
  if (!need) return cards;
  const filler = `\n        <div class="faith-card faith-card--filler" aria-hidden="true"></div>`;
  return cards.concat(Array(need).fill(filler));
}
// Sort by parsed start year (sub-sorts: BC negative, AD positive).
const chronological = manifest.slice().sort((a, b) => {
  const ya = parseDateStart(a.date);
  const yb = parseDateStart(b.date);
  if (ya !== yb) return ya - yb;
  return a.title.localeCompare(b.title);
});
const documents = chronological.filter((m) => m.category === "documents");
const library = chronological.filter((m) => m.category === "library");
await writeFile(
  path.join(OUT_DIR, "_cards-documents.hbs"),
  `{{!-- Generated by scripts/build-faith-received.mjs. Do not edit by hand. --}}\n<div class="faith-card-grid">${padCardsForGrid(documents.map(cardMarkup)).join("\n")}\n</div>\n`
);
await writeFile(
  path.join(OUT_DIR, "_cards-library.hbs"),
  `{{!-- Generated by scripts/build-faith-received.mjs. Do not edit by hand. --}}\n<div class="faith-card-grid">${padCardsForGrid(library.map(cardMarkup)).join("\n")}\n</div>\n`
);

// ── Traditions partial ─────────────────────────────────────────
// Groups every doc + library work by Christian tradition (Patristic /
// Catholic / Lutheran / Anglican / Reformed / Baptist / Evangelical).
// A doc may belong to multiple traditions and appears under each.
// TRADITION_LABELS / TRADITION_ORDER / TRADITION_DESCRIPTIONS /
// TRADITION_TAGS are declared near the top of this file so header()
// can reference them when rendering each document's hero pill row.
const traditionGroups = TRADITION_ORDER.map((slug) => {
  const items = chronological.filter((m) => (TRADITION_TAGS[m.slug] || []).includes(slug));
  return { slug, label: TRADITION_LABELS[slug], description: TRADITION_DESCRIPTIONS[slug], items };
}).filter((g) => g.items.length);

// Sub-nav: one italic display link per tradition. JS toggles which
// tradition band is visible inside the Traditions tab. Default is the
// first tradition. The wrapping <div data-faith-tradition-tabs>
// scopes the JS handler so it doesn't accidentally bind elsewhere.
const traditionTabs = traditionGroups.map((g, i) => `
        <button type="button" class="faith-tradition-tab${i === 0 ? " is-active" : ""}" data-faith-tradition-target="${g.slug}" aria-pressed="${i === 0 ? "true" : "false"}">
          <em>${escape(g.label)}</em>
        </button>`).join("");

const traditionsHtml = `
  <div class="container">
    <nav class="faith-tradition-tabs" data-faith-tradition-tabs aria-label="Christian traditions">
      ${traditionTabs}
    </nav>
  </div>
  ${traditionGroups.map((g, i) => `
  <section class="faith-tradition-band" id="tradition-${g.slug}" data-faith-tradition="${g.slug}"${i === 0 ? "" : " hidden"}>
    <div class="container">
      <div class="section-intro faith-tradition-intro">
        <h2 class="section-heading faith-tradition-heading"><em>${escape(g.label)}</em></h2>
        <p class="faith-section-lede">${escape(smarten(g.description))}</p>
      </div>
      <div class="faith-card-grid">
        ${padCardsForGrid(g.items.map(cardMarkup)).join("\n")}
      </div>
    </div>
  </section>`).join("\n")}`;

// _cards-traditions.hbs is NOT written any more. The Traditions tab is
// built at runtime by assets/js/faith-indexes.js, which indexes every
// collection (75,485 works) rather than only the 69 curated English
// ones this band markup covered. The committed partial is now just a
// container for that JS to render into.
//
// Writing it here would silently roll the tab back to the 69-work
// version every time anyone regenerated the theme — which is exactly
// what happened on 2026-07-29. traditionsHtml is left in place because
// traditionGroups still feeds the tradition pills on each document
// header; only the write is gone.
void traditionsHtml;

// ── Memorize feature ────────────────────────────────────────────
// One memorize page per Q&A catechism. Renders a shared shell that
// reads the catechism's Q&A from an inlined JSON script tag and
// presents a single Q at a time with reveal + mark-memorized + nav.
const MEMORIZE_TARGETS = [
  { slug: "heidelberg", title: "The Heidelberg Catechism", date: "1563", count: 129 },
  { slug: "westminster-shorter", title: "Westminster Shorter Catechism", date: "1647", count: 107 },
  { slug: "westminster-larger", title: "Westminster Larger Catechism", date: "1647", count: 196 },
];

for (const m of MEMORIZE_TARGETS) {
  const docPath = path.join(DATA_DIR, `${m.slug}.json`);
  let questions = [];
  try {
    const doc = JSON.parse(await readFile(docPath, "utf-8"));
    if (doc.lordsDays) {
      // Heidelberg: flatten Lord's Day questions, preserving lordsDay #.
      for (const ld of doc.lordsDays) {
        for (const q of ld.questions || []) {
          questions.push({ number: q.number, lordsDay: ld.number, lordsDayTitle: ld.title, question: q.question, answer: q.answer, references: q.references || [] });
        }
      }
    } else if (doc.questions) {
      // Westminster Shorter / Larger: flat list.
      for (const q of doc.questions) {
        questions.push({ number: q.number, question: q.question, answer: q.answer, references: q.references || [] });
      }
    }
  } catch { continue; }
  if (!questions.length) continue;

  const memBody = `
  <main class="faith-received faith-memorize" data-faith-memorize data-doc-slug="${m.slug}" data-doc-title="${escape(m.title)}">
    <section class="article-header faith-doc-header faith-memorize-header">
      <div class="article-header-inner">
        <p class="article-topic"><a href="/the-faith-received/${m.slug}/" class="article-topic-tag">${escape(m.title)}</a></p>
        <h1 class="article-title">Memorize</h1>
        <p class="faith-doc-description">${m.count} questions and answers, one card at a time. Press <kbd>Space</kbd> to reveal, <kbd>M</kbd> to mark memorized, <kbd>&larr;</kbd>/<kbd>&rarr;</kbd> to navigate.</p>
      </div>
    </section>

    <section class="faith-feature-body faith-memorize-body">
      <div class="container container-narrow">
        <div class="faith-memorize-progress">
          <div class="faith-memorize-progress-meta">
            <span class="faith-memorize-progress-label" data-faith-memorize-progress-label>0 of ${m.count} memorized</span>
            <span class="faith-memorize-progress-pct" data-faith-memorize-progress-pct>0%</span>
          </div>
          <div class="faith-memorize-progress-bar">
            <div class="faith-memorize-progress-fill" data-faith-memorize-progress-fill style="width: 0%"></div>
          </div>
        </div>
        <div class="faith-memorize-controls">
          <div class="faith-memorize-filter" role="tablist" aria-label="Filter questions">
            <button type="button" class="faith-memorize-filter-btn is-active" data-faith-memorize-filter="all" role="tab" aria-selected="true">All</button>
            <button type="button" class="faith-memorize-filter-btn" data-faith-memorize-filter="unmemorized" role="tab" aria-selected="false">Remaining</button>
            <button type="button" class="faith-memorize-filter-btn" data-faith-memorize-filter="memorized" role="tab" aria-selected="false">Memorized</button>
          </div>
          <div class="faith-memorize-position">
            <span data-faith-memorize-position>1</span> / <span data-faith-memorize-total>${m.count}</span>
          </div>
        </div>
        <article class="faith-memorize-card" data-faith-memorize-card>
          <header class="faith-memorize-card-header">
            <p class="faith-memorize-card-numeral" data-faith-memorize-numeral>Q. 1</p>
            <h2 class="faith-memorize-card-question" data-faith-memorize-question><em>Loading&hellip;</em></h2>
          </header>
          <div class="faith-memorize-answer" data-faith-memorize-answer hidden>
            <p class="eyebrow">Answer</p>
            <div class="faith-memorize-answer-text article-content" data-faith-memorize-answer-text></div>
            <p class="faith-qa-references" data-faith-memorize-refs hidden></p>
          </div>
          <div class="faith-memorize-actions">
            <button type="button" class="btn btn-primary" data-faith-memorize-reveal>Reveal answer</button>
            <button type="button" class="btn btn-outline" data-faith-memorize-mark>Mark memorized</button>
          </div>
        </article>
        <nav class="faith-memorize-nav" aria-label="Question navigation">
          <button type="button" class="faith-memorize-nav-btn" data-faith-memorize-prev><span aria-hidden="true">&larr;</span> Previous</button>
          <button type="button" class="faith-memorize-nav-btn" data-faith-memorize-next>Next <span aria-hidden="true">&rarr;</span></button>
        </nav>
        <p class="faith-memorize-empty" data-faith-memorize-empty hidden>No questions match this filter.</p>
      </div>
    </section>
  </main>
  <script type="application/json" data-faith-memorize-data>${JSON.stringify(questions).replace(/</g, "\\u003c")}</script>
<script src="{{asset "js/faith-modernize.js"}}"></script>
<script src="{{asset "js/faith-received.js"}}"></script>
<script src="{{asset "js/faith-memorize.js"}}"></script>`;
  await writeFile(
    path.join(OUT_DIR, `_memorize-${m.slug}.hbs`),
    `{{!-- Generated by scripts/build-faith-received.mjs. Do not edit by hand. --}}\n${memBody.trim()}\n`
  );
}

// Every wrapper owns its own <title> and social meta.
//
// These routes are bound to a template in routes.yaml with no Ghost
// Page record behind them, so {{ghost_head}} has nothing but the site
// record to work from and emits the site title as og:title. Every TFR
// document unfurled as "Mere Orthodoxy | Faith, Formation, Church, and
// Culture" until 2026-07-29. default.hbs renders {{{block "moHead"}}}
// in place of a static <title>; whatever a template puts in this
// contentFor is the document's head metadata. Emitting og:/twitter:
// tags here beats Ghost's site-level ones because the block sits above
// {{ghost_head}} and every scraper takes the first tag it sees — the
// same first-tag-wins trick default.hbs already uses for og:image.
function metaBlock(title, description, { docTitle = null } = {}) {
  const attr = (s) => String(s || "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/&(?!(?:amp|lt|gt|quot|#\d+|#x[0-9a-f]+);)/gi, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const clip = (s, limit) => {
    const t = attr(s);
    if (t.length <= limit) return t;
    return t.slice(0, limit).replace(/\s+\S*$/, "").replace(/[,;:.]+$/, "") + "…";
  };
  return [
    `{{#contentFor "moHead"}}`,
    `<title>${attr(docTitle || title)}</title>`,
    `<meta name="description" content="${clip(description, 158)}" />`,
    `<meta property="og:title" content="${attr(title)}" />`,
    `<meta property="og:description" content="${clip(description, 250)}" />`,
    `<meta name="twitter:title" content="${attr(title)}" />`,
    `<meta name="twitter:description" content="${clip(description, 250)}" />`,
    `{{/contentFor}}`,
    "",
  ].join("\n");
}

// TFR titles carry the collection name rather than the site name. The
// unfurl already shows the domain, and "Apology" on its own says
// nothing about what it is.
const tfrTitle = (t) => (/The Faith Received$/.test(t) ? t : `${t} | The Faith Received`);

// "Memorize The Heidelberg Catechism" reads badly; the article wants
// to be lowercase once it is mid-sentence.
const memorizeLabel = (title) => `Memorize ${title.replace(/^The /, "the ")}`;

// Wrapper templates, one per document. Each loads faith-received.js
// for the reading controls (Expand all / Collapse all), the
// auto-open-on-anchor handler, and the print handler.
const TEMPLATE_DIR = path.join(ROOT);
for (const m of MEMORIZE_TARGETS) {
  const meta = metaBlock(
    tfrTitle(memorizeLabel(m.title)),
    `Learn ${m.title} by heart, one question and answer at a time.`
  );
  await writeFile(
    path.join(TEMPLATE_DIR, `custom-faith-${m.slug}-memorize.hbs`),
    `{{!< default}}\n${meta}{{!-- /the-faith-received/${m.slug}/memorize/. Auto-generated. --}}\n{{> "faith-received/_memorize-${m.slug}"}}\n`
  );
}
for (const item of manifest) {
  // Heidelberg embeds the memorize view inline (the view toggle's
  // Memorize tab swaps content rather than navigating to /memorize/),
  // so its wrapper also loads faith-memorize.js. Other docs only need
  // it on the dedicated /memorize/ subroute.
  const memorizeScript = item.slug === "heidelberg"
    ? `<script src="{{asset "js/faith-memorize.js"}}"></script>\n`
    : "";
  const meta = metaBlock(tfrTitle(item.title), item.description);
  const tmpl = `{{!< default}}\n${meta}{{!-- Generated wrapper for /the-faith-received/${item.slug}/. Edit\n     scripts/build-faith-received.mjs (or the underlying partial) and\n     re-run \`node scripts/build-faith-received.mjs\` to regenerate. --}}\n{{> "faith-received/${item.slug}"}}\n<script src="{{asset "js/faith-modernize.js"}}"></script>\n<script src="{{asset "js/faith-received.js"}}"></script>\n${memorizeScript}<script src="{{asset "js/faith-gate.js"}}"></script>\n`;
  await writeFile(path.join(TEMPLATE_DIR, `custom-faith-${item.slug}.hbs`), tmpl);

  if (item.memorizable) {
    const memMeta = metaBlock(
      tfrTitle(memorizeLabel(item.title)),
      `Learn ${item.title} by heart, one question and answer at a time.`
    );
    const memTmpl = `{{!< default}}\n${memMeta}{{!-- Generated wrapper for /the-faith-received/${item.slug}/memorize/. Edit\n     scripts/build-faith-received.mjs (or the underlying partial) and\n     re-run \`node scripts/build-faith-received.mjs\` to regenerate. --}}\n{{> "faith-received/${item.slug}-memorize"}}\n<script src="{{asset "js/faith-received.js"}}"></script>\n<script src="{{asset "js/faith-memorize.js"}}"></script>\n<script src="{{asset "js/faith-gate.js"}}"></script>\n`;
    await writeFile(path.join(TEMPLATE_DIR, `custom-faith-${item.slug}-memorize.hbs`), memTmpl);
  }
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
  // Body partial — just the card grid, reused by both the standalone
  // /topics/ feature page AND the home Topics tab band. Caller wraps
  // it in .container.
  const topicsBodyMarkup = `<div class="faith-topic-card-grid">
        ${topicCards}
      </div>`;
  await writeFile(
    path.join(OUT_DIR, "_topics-body.hbs"),
    `{{!-- Generated by scripts/build-faith-received.mjs. Do not edit by hand. --}}\n${topicsBodyMarkup}\n`
  );
  const topicsIndexBody = `
  <main class="faith-received faith-feature faith-topics-index">
    ${heroForFeature({
      kicker: "The Faith Received &middot; Topics",
      headline: "<em>Topics</em>",
      sub: "From God and the Trinity to salvation, the Church, and the life to come. Trace each doctrine across two millennia of Christian writing.",
    })}

    <section class="faith-feature-body">
      <div class="container">
        {{> "faith-received/_topics-body"}}
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

  // ── Helper: time-period bucket for filtering ──────────────────
  function timePeriod(dateStr) {
    const y = parseDateStart(dateStr);
    if (y < 100) return "apostolic";
    if (y < 325) return "ante-nicene";
    if (y < 500) return "nicene";
    if (y < 1500) return "medieval";
    if (y < 1700) return "reformation";
    return "modern";
  }
  const PERIOD_LABELS = {
    "apostolic": "Apostolic Era",
    "ante-nicene": "Ante-Nicene",
    "nicene": "Nicene &amp; Post-Nicene",
    "medieval": "Medieval",
    "reformation": "Reformation",
    "modern": "Modern",
  };

  // ── Topic keyword dictionaries for paragraph relevance scoring ──
  // Compact keyword lists per topic. Used to find the most relevant
  // paragraph in a chapter/section for a given topic page.
  const TOPIC_SIGNALS = {
    "god-and-trinity": ["trinity", "triune", "godhead", "three persons", "consubstantial", "homoousios", "one god", "divine nature", "divine essence", "attributes of god", "omnipotent", "omniscient", "nature of god", "god the father", "creator", "sovereign", "logos", "monarchy", "unbegotten", "procession", "almighty", "eternal god", "unity of the godhead"],
    "scripture-and-revelation": ["scripture", "scriptures", "word of god", "revelation", "inspired", "canonical", "prophetic", "old testament", "new testament", "it is written", "saith the scripture", "the prophet", "moses", "the gospel", "apostolic teaching"],
    "creation-and-providence": ["creation", "created all things", "maker of heaven", "providence", "god created", "out of nothing", "ex nihilo", "made the world", "formed man", "six days", "angels", "heavenly host", "sustains", "governs"],
    "sin-and-the-fall": ["original sin", "the fall", "fall of adam", "fallen nature", "total depravity", "corruption", "depravity", "transgression", "iniquity", "wickedness", "devil", "satan", "serpent", "temptation", "disobedience"],
    "christ-and-the-incarnation": ["incarnation", "word became flesh", "two natures", "god and man", "son of god", "born of the virgin", "virgin mary", "hypostatic union", "person of christ", "messiah", "mediator", "only-begotten", "christ", "jesus", "the son", "saviour", "redeemer", "crucified", "passion", "cross", "resurrection of christ", "ascension"],
    "salvation-and-justification": ["justification", "justified by faith", "atonement", "redemption", "reconciliation", "propitiation", "imputation", "saving grace", "faith alone", "sola fide", "forgiveness of sins", "remission of sins", "adoption", "sanctification", "regeneration", "new birth", "born again", "election", "predestination", "salvation", "grace", "repentance", "blood of christ"],
    "the-holy-spirit": ["holy spirit", "holy ghost", "spirit of god", "paraclete", "comforter", "spirit of truth", "gifts of the spirit", "fruit of the spirit", "baptism of the spirit", "filled with the spirit", "anointing of the spirit", "indwelling spirit"],
    "the-church": ["the church", "body of christ", "communion of saints", "visible church", "invisible church", "marks of the church", "apostolic", "catholic church", "church government", "elders", "deacons", "bishops", "presbyters", "ministry", "church discipline", "excommunication", "fellowship", "congregation", "assembly", "brethren"],
    "sacraments-and-ordinances": ["baptism", "baptize", "baptized", "lord's supper", "eucharist", "communion", "sacrament", "breaking of bread", "body and blood", "this is my body", "this do in remembrance", "water of baptism", "table of the lord", "consecration"],
    "the-christian-life": ["christian life", "discipleship", "following christ", "holiness", "godliness", "spiritual growth", "walk with god", "devotion", "perseverance", "good works", "obedience", "self-denial", "mortification", "virtue", "patience", "humility", "charity", "love of neighbor", "almsgiving", "fasting", "modesty", "temperance"],
    "the-law-and-ethics": ["the law", "ten commandments", "moral law", "thou shalt", "commandment", "decalogue", "natural law", "divine law", "ethics", "duty", "obligation", "conscience", "magistrate", "civil authority", "government", "just war", "oaths", "vows", "idolatry", "blasphemy", "sabbath", "justice"],
    "prayer": ["prayer", "praying", "pray to god", "lord's prayer", "our father", "supplication", "intercession", "petition", "thanksgiving", "calling upon god", "communion with god", "kneeling"],
    "last-things": ["resurrection of the dead", "final judgment", "last judgment", "day of judgment", "second coming", "return of christ", "life everlasting", "eternal life", "eternal death", "hell", "heaven", "new heaven", "new earth", "kingdom of god", "age to come", "antichrist", "millennium", "general resurrection", "last day", "day of the lord", "eternal punishment", "immortality"],
  };

  // Score a paragraph against a topic's keywords.
  function paragraphTopicScore(text, topicSlug) {
    const lower = text.toLowerCase();
    const keywords = TOPIC_SIGNALS[topicSlug] || [];
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) score++;
    }
    return score;
  }

  // ── Helper: extract the most relevant paragraph for a topic ───
  // Scores every paragraph against the topic's keyword signals and
  // returns the highest-scoring one, truncated to 200 chars.
  function topicExcerpt(doc, type, id, topicSlug) {
    if (!doc) return "";
    const num = parseInt((id.match(/\d+$/) || [""])[0], 10);
    let paragraphs = [];
    if (type === "question") {
      const q = (doc.questions || []).find((q) => q.number === num);
      if (!q && doc.lordsDays) {
        for (const ld of doc.lordsDays) {
          const lq = (ld.questions || []).find((q) => q.number === num);
          if (lq) { paragraphs = [lq.answer || lq.question || ""]; break; }
        }
      } else if (q) paragraphs = [q.answer || q.question || ""];
    } else if (type === "section") {
      const s = (doc.sections || []).find((s) => s.number === num);
      if (s) paragraphs = s.paragraphs && s.paragraphs.length
        ? s.paragraphs
        : (s.text || "").split(/\n\s*\n|\n/).filter(Boolean);
    } else if (type === "chapter") {
      const bookMatch = id.match(/book-(\d+)-ch-(\d+)/);
      if (bookMatch) {
        const b = (doc.books || []).find((b) => b.bookNumber === parseInt(bookMatch[1], 10));
        if (b) {
          const c = (b.chapters || []).find((c) => c.number === parseInt(bookMatch[2], 10));
          if (c) paragraphs = c.paragraphs || (c.text || "").split(/\n\s*\n|\n/).filter(Boolean);
        }
      } else {
        const c = (doc.chapters || []).find((c) => c.number === num);
        if (c) paragraphs = c.paragraphs || (c.text || "").split(/\n\s*\n|\n/).filter(Boolean);
      }
    } else if (type === "article") {
      const a = (doc.articles || []).find((a) => a.number === num);
      if (a) paragraphs = (a.text || "").split(/\n\s*\n|\n/).filter(Boolean);
    } else if (type === "thesis") {
      const t = (doc.theses || []).find((t) => t.number === num);
      if (t) paragraphs = [t.text || ""];
    } else if (type === "resolution") {
      const r = (doc.resolutions || []).find((r, i) => i === num);
      if (r) paragraphs = [r.text || ""];
    } else if (type === "discourse") {
      const d = (doc.discourses || []).find((d) => d.number === num);
      if (d) paragraphs = d.paragraphs || (d.text || "").split(/\n\s*\n|\n/).filter(Boolean);
    }

    // Filter out very short / empty paragraphs
    paragraphs = paragraphs.filter((p) => p.trim().length > 30);
    if (!paragraphs.length) return "";

    // Score each paragraph against the topic and pick the best
    let bestPara = paragraphs[0];
    let bestScore = -1;
    for (const p of paragraphs) {
      const score = paragraphTopicScore(p, topicSlug);
      if (score > bestScore) {
        bestScore = score;
        bestPara = p;
      }
    }

    return truncateExcerpt(bestPara.replace(/\s+/g, " ").trim(), 200);
  }

  // ── Per-topic pages ──────────────────────────────────────────
  for (const slug of topicsBundle.order) {
    const meta = topicsBundle.meta[slug];
    const items = topicsBundle.assignments.filter((a) => a.topics.includes(slug));

    // Group by source document, chronological order.
    const groups = {};
    for (const a of items) {
      const src = normalizeSource(a.source);
      if (!groups[src]) groups[src] = [];
      groups[src].push(a);
    }
    const orderedSources = chronological
      .map((m) => m.slug)
      .filter((s) => groups[s] && groups[s].length);

    // Collect which traditions and periods are present for the filter UI
    const activeTraditions = new Set();
    const activePeriods = new Set();
    for (const src of orderedSources) {
      const docMeta = chronological.find((m) => m.slug === src);
      (TRADITION_TAGS[src] || []).forEach((t) => activeTraditions.add(t));
      activePeriods.add(timePeriod(docMeta.date));
    }

    // Filter bar: tradition pills + time period pills
    const traditionFilters = TRADITION_ORDER
      .filter((t) => activeTraditions.has(t))
      .map((t) => `<button type="button" class="faith-filter-pill" data-filter-tradition="${t}">${TRADITION_LABELS[t]}</button>`)
      .join("\n            ");
    const periodFilters = Object.entries(PERIOD_LABELS)
      .filter(([k]) => activePeriods.has(k))
      .map(([k, label]) => `<button type="button" class="faith-filter-pill" data-filter-period="${k}">${label}</button>`)
      .join("\n            ");

    const filterBar = (activeTraditions.size > 1 || activePeriods.size > 1) ? `
        <div class="faith-topic-filters" data-faith-topic-filters>
          ${activeTraditions.size > 1 ? `<div class="faith-filter-group">
            <span class="faith-filter-label">Tradition</span>
            <button type="button" class="faith-filter-pill is-active" data-filter-tradition="all">All</button>
            ${traditionFilters}
          </div>` : ""}
          ${activePeriods.size > 1 ? `<div class="faith-filter-group">
            <span class="faith-filter-label">Period</span>
            <button type="button" class="faith-filter-pill is-active" data-filter-period="all">All</button>
            ${periodFilters}
          </div>` : ""}
        </div>` : "";

    // Document groups — each is a collapsible <details>
    const groupHtml = orderedSources.map((src) => {
      const docMeta = chronological.find((m) => m.slug === src);
      const docTraditions = (TRADITION_TAGS[src] || []).join(" ");
      const docPeriod = timePeriod(docMeta.date);
      const assignmentCount = groups[src].length;

      // Each section/chapter row inside the document
      const rows = groups[src].map((a) => {
        const src2 = normalizeSource(a.source);
        const anchor = normalizeAnchor(src2, a.type, a.id);
        const url = `/the-faith-received/${src2}/#${anchor}`;
        const info = lookupContent(docByslug[src2], a.type, a.id);
        const excerpt = topicExcerpt(docByslug[src2], a.type, a.id, slug);

        return `
              <li class="faith-topic-row">
                <a href="${url}" class="faith-topic-row-link">
                  <span class="faith-topic-row-meta">
                    <span class="faith-topic-row-label">${escape(info.label || a.type)}</span>
                    ${info.snippet ? `<span class="faith-topic-row-snippet">${escape(smarten(info.snippet))}</span>` : ""}
                  </span>
                  ${excerpt ? `<p class="faith-topic-row-excerpt">${escape(smarten(excerpt))}</p>` : ""}
                  <span class="faith-topic-row-read">Read in context <span aria-hidden="true">&rarr;</span></span>
                </a>
              </li>`;
      }).join("\n");

      return `
        <details class="faith-topic-group" id="doc-${src}" data-tradition="${docTraditions}" data-period="${docPeriod}">
          <summary class="faith-topic-group-header">
            <span class="faith-topic-group-info">
              <span class="eyebrow">${escape(docMeta.date)}</span>
              <span class="section-heading"><em>${escape(smarten(docMeta.title))}</em></span>
              ${docMeta.author ? `<span class="faith-topic-group-author"><em>${escape(smarten(docMeta.author))}</em></span>` : ""}
            </span>
            <span class="faith-topic-group-count">${assignmentCount} passage${assignmentCount === 1 ? "" : "s"}</span>
            <span class="faith-chev" aria-hidden="true"></span>
          </summary>
          <ol class="faith-topic-row-list">
            ${rows}
          </ol>
        </details>`;
    }).join("\n");

    const body = `
  <main class="article faith-doc faith-doc--topic" data-topic-slug="${slug}">
    <section class="article-header faith-doc-header faith-topic-header">
      <div class="article-header-inner">
        <p class="article-topic"><a href="/the-faith-received/topics/" class="article-topic-tag">All topics</a></p>
        <h1 class="article-title">${escape(smarten(meta.label))}</h1>
        <p class="faith-doc-description">${escape(smarten(meta.description))}</p>
      </div>
    </section>

    <div class="article-body faith-doc-body">
      <div class="container faith-doc-inner">
        ${filterBar}
        ${
          items.length === 0
            ? `<p class="faith-topic-empty">No passages assigned to this topic yet.</p>`
            : groupHtml
        }
      </div>
    </div>
  </main>
<script src="{{asset "js/faith-modernize.js"}}"></script>
<script src="{{asset "js/faith-received.js"}}"></script>`;
    await writeFile(
      path.join(OUT_DIR, `_topic-${slug}.hbs`),
      `{{!-- Generated by scripts/build-faith-received.mjs. Do not edit by hand. --}}\n${body.trim()}\n`
    );

    // Wrapper template
    const topicMeta = metaBlock(tfrTitle(meta.label), meta.description);
    const tmpl = `{{!< default}}\n${topicMeta}{{!-- /the-faith-received/topics/${slug}/. Auto-generated; edit\n     scripts/build-faith-received.mjs (or the underlying partial). --}}\n{{> "faith-received/_topic-${slug}"}}\n<script src="{{asset "js/faith-gate.js"}}"></script>\n`;
    await writeFile(path.join(TEMPLATE_DIR, `custom-faith-topic-${slug}.hbs`), tmpl);
  }

  // Topics index wrapper
  const topicsIndexMeta = metaBlock(
    tfrTitle("Topics"),
    "Read the Christian tradition by topic: the Trinity, Scripture, salvation, the church, the sacraments, prayer, and last things."
  );
  await writeFile(
    path.join(TEMPLATE_DIR, `custom-faith-topics.hbs`),
    `{{!< default}}\n${topicsIndexMeta}{{!-- /the-faith-received/topics/ — auto-generated index of every topic. --}}\n{{> "faith-received/_topics-index"}}\n<script src="{{asset "js/faith-gate.js"}}"></script>\n`
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
  // Any library-books doc: book-N-ch-M → book-N-chapter-M
  {
    const m = id.match(/^book-(\d+)-ch-(\d+)$/);
    if (m) return `book-${m[1]}-chapter-${m[2]}`;
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

// Look up the actual label / question / chapter title / FULL body
// from the document JSON. Returns:
//   - label: short caption ("Q. 1", "Article III", "Chapter VII")
//   - snippet: short summary line (the question text, the section
//     title, etc.) — used as the heading inside the row's <details> summary
//   - body: pre-rendered HTML for the full passage, used inside the
//     <details> body so the reader can expand a topic row and read
//     the passage right there without navigating away.
function lookupContent(doc, type, id) {
  if (!doc) return { label: "", snippet: "", body: "" };
  const num = parseInt((id.match(/\d+$/) || [""])[0], 10);
  if (type === "question") {
    if (doc.lordsDays) {
      for (const ld of doc.lordsDays) {
        for (const q of ld.questions || []) {
          if (q.number === num) {
            return {
              label: `Q. ${num} (Lord's Day ${ld.number})`,
              snippet: q.question,
              body: qaBody(q),
            };
          }
        }
      }
    }
    if (doc.questions) {
      const q = doc.questions.find((q) => q.number === num);
      if (q) return { label: `Q. ${num}`, snippet: q.question, body: qaBody(q) };
    }
  }
  if (type === "section") {
    const s = (doc.sections || []).find((s) => s.number === num);
    if (s) {
      const bodyText = s.paragraphs && s.paragraphs.length
        ? paragraphsArray(s.paragraphs)
        : paragraphs(s.text || "");
      // If the title is generic ("Section N"), omit it — the excerpt will carry the content.
      const titleIsGeneric = !s.title || /^(Section|Text)\s*\d*$/.test(s.title);
      const snippet = titleIsGeneric ? "" : s.title;
      return { label: `Section ${roman(s.number)}`, snippet, body: bodyText };
    }
  }
  if (type === "chapter") {
    if (doc.chapters) {
      const c = doc.chapters.find((c) => c.number === num);
      if (c) return { label: `Chapter ${roman(c.number)}`, snippet: stripHtml(titleFor(c)), body: chapterBody(c) };
    }
    if (doc.books) {
      const m = id.match(/book-(\d+)-ch-(\d+)/);
      if (m) {
        const bookNum = parseInt(m[1], 10);
        const chNum = parseInt(m[2], 10);
        const b = doc.books.find((b) => b.bookNumber === bookNum);
        if (b) {
          const c = (b.chapters || []).find((c) => c.number === chNum);
          if (c) return { label: `Book ${roman(bookNum)} · Chapter ${roman(chNum)}`, snippet: stripHtml(titleFor(c)), body: chapterBody(c) };
        }
      }
    }
    if (doc.discourses) {
      const c = doc.discourses.find((d) => d.number === num);
      if (c) return { label: `Discourse ${roman(c.number)}`, snippet: stripHtml(titleFor(c)), body: chapterBody(c) };
    }
  }
  if (type === "discourse") {
    const c = (doc.discourses || []).find((d) => d.number === num);
    if (c) return { label: `Discourse ${roman(c.number)}`, snippet: stripHtml(titleFor(c)), body: chapterBody(c) };
  }
  if (type === "article") {
    const a = (doc.articles || []).find((a) => a.number === num);
    if (a) return { label: `Article ${roman(a.number)}`, snippet: a.title, body: paragraphs(a.text || "") };
  }
  if (type === "thesis") {
    const t = (doc.theses || []).find((t) => t.number === num);
    if (t) return { label: `Thesis ${num}`, snippet: snippetOfShort(t.text), body: `<p>${escape(smarten(t.text || ""))}</p>` };
  }
  if (type === "resolution") {
    const r = (doc.resolutions || []).find((r, i) => i === num);
    if (r) return { label: `Resolution ${num}`, snippet: snippetOfShort(r.text), body: `<p>${escape(smarten((r.text || "").replace(/^\d+\.\s*/, "")))}</p>` };
  }
  return { label: type, snippet: "", body: "" };
}

function qaBody(q) {
  const refs = q.references && q.references.length
    ? renderScriptureRefs(q.references)
    : "";
  return `${paragraphs(q.answer || "")}${refs}`;
}

function chapterBody(c) {
  if (c.paragraphs && c.paragraphs.length) return paragraphsArray(c.paragraphs);
  if (c.text) return paragraphs(c.text);
  return "";
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
  // The body is lazy-fetched on first open. Inlining every passage
  // ballooned the deploy zip past Ghost's comfort zone (Calvin alone
  // is referenced in dozens of places across topics). The data-*
  // attributes give the JS handler everything it needs to fetch
  // the source page and slot in the matching anchor.
  return `
            <li class="faith-topic-row">
              <details class="faith-topic-row-details"
                       id="topic-${src}-${anchor}"
                       data-faith-topic-row
                       data-source-url="${url}"
                       data-source-anchor="${anchor}">
                <summary class="faith-topic-row-summary">
                  <span class="faith-topic-row-meta">
                    <span class="faith-topic-row-label">${escape(info.label || a.type)}</span>
                    ${info.snippet ? `<span class="faith-topic-row-snippet">${escape(smarten(info.snippet))}</span>` : ""}
                  </span>
                  <span class="faith-chev" aria-hidden="true"></span>
                </summary>
                <div class="faith-topic-row-body article-content" data-faith-topic-body>
                  <p class="faith-topic-row-fallback">Loading passage&hellip;</p>
                </div>
                <p class="faith-topic-row-continue"><a href="${url}">Open in the source document <span aria-hidden="true">&rarr;</span></a></p>
              </details>
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
  } else if (doc.kind === "library-chapters") {
    for (const c of doc.chapters ?? []) tag(c.number, `chapter-${c.number}`, `${doc.title} · ${c.title || 'Chapter ' + c.number}`);
  } else if (doc.kind === "library-sections") {
    for (const s of doc.sections ?? []) tag(s.number ?? 1, `section-${s.number ?? 1}`, `${doc.title}`);
  } else if (doc.kind === "library-books") {
    for (const b of doc.books ?? []) {
      for (const c of b.chapters ?? []) {
        tag(c.number, `book-${b.bookNumber}-ch-${c.number}`, `${doc.title} · ${b.bookTitle || 'Book ' + b.bookNumber} · ${c.title || 'Chapter ' + c.number}`);
      }
    }
  }
}
await writeFile(path.join(ASSET_DATA_DIR, "today.json"), JSON.stringify(todayPlan));

// ── Prayer data (dashboard Daily Office) ────────────────────────
// Slim version of the 1928-bcp.json with just title, subtitle,
// paragraphs, and modernized arrays — what dashboard-prayer.js needs.
const bcpPath = path.join(DATA_DIR, "1928-bcp.json");
if ((await import("node:fs")).existsSync(bcpPath)) {
  const bcp = JSON.parse(await readFile(bcpPath, "utf-8"));
  // Only include Morning Prayer and Evening Prayer for the dashboard
  const officeBooks = (bcp.books || []).filter(
    (b) => b.bookTitle === "Morning Prayer" || b.bookTitle === "Evening Prayer"
  );
  const prayer = {
    books: officeBooks.map((b) => ({
      bookTitle: b.bookTitle,
      chapters: (b.chapters || []).map((c) => ({
        title: c.title,
        subtitle: c.subtitle,
        paragraphs: c.paragraphs,
        modernized: c.modernized,
      })),
    })),
  };
  await writeFile(path.join(ASSET_DATA_DIR, "prayer.json"), JSON.stringify(prayer));
}

// ── Devotional sources ──────────────────────────────────────────
// For every document, expose a flat ordered sequence of "items" the
// devotional engine can advance through one per day. Item shape:
//   { anchor: "q-1", label: "Q. 1 — Lord's Day 1" }
// JS reads this at runtime to assemble today's queue per the
// reader's selected sources.
const devotionalSources = {};
for (const file of files) {
  const doc = JSON.parse(await readFile(path.join(DATA_DIR, file), "utf-8"));
  const items = [];
  if (doc.kind === "heidelberg") {
    for (const ld of doc.lordsDays || []) {
      for (const q of ld.questions || []) {
        items.push({ anchor: `q-${q.number}`, label: `Lord's Day ${ld.number} · Q. ${q.number}` });
      }
    }
  } else if (doc.kind === "qa") {
    for (const q of doc.questions || []) {
      items.push({ anchor: `q-${q.number}`, label: `Q. ${q.number}` });
    }
  } else if (doc.kind === "sections") {
    for (const s of doc.sections || []) {
      items.push({ anchor: `section-${s.number}`, label: `Section ${roman(s.number)} · ${stripHtml(s.title || "")}` });
    }
  } else if (doc.kind === "chapters") {
    for (const c of doc.chapters || []) {
      items.push({ anchor: `chapter-${c.number}`, label: `Chapter ${roman(c.number)} · ${stripHtml(c.title || "")}` });
    }
  } else if (doc.kind === "articles") {
    for (const a of doc.articles || []) {
      if (a.number === 0) continue;
      items.push({ anchor: `article-${a.number}`, label: `Article ${roman(a.number)} · ${stripHtml(a.title || "")}` });
    }
  } else if (doc.kind === "theses") {
    for (const t of doc.theses || []) {
      items.push({ anchor: `thesis-${t.number}`, label: `Thesis ${t.number}` });
    }
  } else if (doc.kind === "edwards") {
    for (const r of doc.resolutions || []) {
      if (!r.number) continue;
      items.push({ anchor: `resolution-${r.number}`, label: `Resolution ${r.number}` });
    }
  } else if (doc.kind === "library-chapters" || doc.kind === "library-discourses" || doc.kind === "library-sections") {
    const list = doc.chapters || doc.discourses || doc.sections || [];
    const label = doc.discourses ? "Discourse" : doc.sections ? "Section" : "Chapter";
    for (const c of list) {
      items.push({ anchor: `chapter-${c.number}`, label: `${label} ${roman(c.number)} · ${stripHtml(titleFor(c))}` });
    }
  } else if (doc.kind === "library-books") {
    for (const b of doc.books || []) {
      for (const c of b.chapters || []) {
        items.push({ anchor: `book-${b.bookNumber}-chapter-${c.number}`, label: `Book ${roman(b.bookNumber)} · Chapter ${roman(c.number)} · ${stripHtml(titleFor(c))}` });
      }
    }
  }
  if (items.length) {
    devotionalSources[doc.slug] = {
      slug: doc.slug,
      title: doc.title,
      author: doc.author,
      date: doc.date,
      category: doc.category,
      itemCount: items.length,
      itemNoun: doc.kind === "qa" || doc.kind === "heidelberg" ? "questions" : doc.kind === "theses" ? "theses" : doc.kind === "edwards" ? "resolutions" : doc.kind === "articles" ? "articles" : doc.kind === "sections" ? "sections" : "chapters",
      items,
    };
  }
}
await writeFile(
  path.join(ASSET_DATA_DIR, "devotional-sources.json"),
  JSON.stringify(devotionalSources)
);

// Scripture index — copy from the source repo if present, and replace
// each ref's truncated excerpt with a fuller (but still bounded)
// snippet. Cap at ~250 chars to keep the JSON loadable in-browser.
function truncateExcerpt(text, max = 250) {
  if (!text) return "";
  const s = String(text).replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cut = s.lastIndexOf(" ", max);
  return s.slice(0, cut > 0 ? cut : max) + "…";
}
const SCRIPTURE_SRC = "/Users/ianharber/Dropbox/Mac (2)/Documents/Claude Code Files/the-faith-received/data/scripture-index.json";

function fullPlainText(doc, type, id) {
  if (!doc) return "";
  const num = parseInt((String(id).match(/\d+/) || [""])[0], 10);
  if (type === "question") {
    if (doc.lordsDays) {
      for (const ld of doc.lordsDays) {
        for (const q of ld.questions || []) {
          if (q.number === num) return q.answer || "";
        }
      }
    }
    if (doc.questions) {
      const q = (doc.questions || []).find((q) => q.number === num);
      if (q) return q.answer || "";
    }
  }
  if (type === "section") {
    const s = (doc.sections || []).find((s) => s.number === num);
    if (s) return s.text || "";
  }
  if (type === "chapter") {
    if (doc.chapters) {
      const c = (doc.chapters || []).find((c) => c.number === num);
      if (c) return Array.isArray(c.paragraphs) ? c.paragraphs.join("\n\n") : (c.text || "");
    }
    if (doc.books) {
      const m = String(id).match(/book-(\d+)-ch-?(\d+)/);
      if (m) {
        const bookNum = parseInt(m[1], 10);
        const chNum = parseInt(m[2], 10);
        const b = (doc.books || []).find((b) => b.bookNumber === bookNum);
        if (b) {
          const c = (b.chapters || []).find((c) => c.number === chNum);
          if (c) return Array.isArray(c.paragraphs) ? c.paragraphs.join("\n\n") : (c.text || "");
        }
      }
    }
    if (doc.discourses) {
      const c = (doc.discourses || []).find((d) => d.number === num);
      if (c) return Array.isArray(c.paragraphs) ? c.paragraphs.join("\n\n") : (c.text || "");
    }
  }
  if (type === "article") {
    const a = (doc.articles || []).find((a) => a.number === num);
    if (a) return a.text || "";
  }
  if (type === "thesis") {
    const t = (doc.theses || []).find((t) => t.number === num);
    if (t) return t.text || "";
  }
  if (type === "resolution") {
    const r = (doc.resolutions || []).find((r, i) => i === num);
    if (r) return (r.text || "").replace(/^\d+\.\s*/, "");
  }
  return "";
}

try {
  const sc = await readFile(SCRIPTURE_SRC, "utf-8");
  const scData = JSON.parse(sc);
  const docCache = {};
  async function getDoc(slug) {
    if (slug in docCache) return docCache[slug];
    const realSlug = slug === "confession-1689" ? "1689" : slug;
    const file = path.join(DATA_DIR, `${realSlug}.json`);
    try {
      docCache[slug] = JSON.parse(await readFile(file, "utf-8"));
    } catch {
      docCache[slug] = null;
    }
    return docCache[slug];
  }
  let replaced = 0;
  let kept = 0;
  for (const passage of Object.keys(scData.index || {})) {
    const refs = scData.index[passage] || [];
    for (const ref of refs) {
      const doc = await getDoc(ref.source || "");
      const full = fullPlainText(doc, ref.type, ref.id);
      if (full && full.length > (ref.excerpt || "").length) {
        ref.excerpt = truncateExcerpt(full);
        replaced++;
      } else {
        ref.excerpt = truncateExcerpt(ref.excerpt || "");
        kept++;
      }
    }
  }
  // Auto-scan local docs for Bible references and merge them into the
  // index. Currently runs for slugs the upstream scripture-index
  // didn't cover (e.g. Polanus, who isn't in the heidelberg repo).
  // The detector matches "Book Chapter" and "Book Chapter:Verse"
  // patterns where Book is in the canonical-book set; ignores
  // partial matches that look like dates or chapter references in
  // theological footnotes (e.g. "book five of the Stromata, p. 239").
  const BIBLE_BOOKS = {
    "Genesis": ["Genesis", "Gen", "Gn"],
    "Exodus": ["Exodus", "Exod", "Ex"],
    "Leviticus": ["Leviticus", "Lev", "Lv"],
    "Numbers": ["Numbers", "Num", "Nm"],
    "Deuteronomy": ["Deuteronomy", "Deut", "Dt"],
    "Joshua": ["Joshua", "Josh", "Jos"],
    "Judges": ["Judges", "Judg", "Jdg"],
    "Ruth": ["Ruth"],
    "1 Samuel": ["1 Samuel", "1 Sam", "1 Sm", "I Samuel", "I Sam"],
    "2 Samuel": ["2 Samuel", "2 Sam", "2 Sm", "II Samuel", "II Sam"],
    "1 Kings": ["1 Kings", "1 Kgs", "1 Ki", "I Kings"],
    "2 Kings": ["2 Kings", "2 Kgs", "2 Ki", "II Kings"],
    "1 Chronicles": ["1 Chronicles", "1 Chron", "1 Chr", "I Chronicles"],
    "2 Chronicles": ["2 Chronicles", "2 Chron", "2 Chr", "II Chronicles"],
    "Ezra": ["Ezra"],
    "Nehemiah": ["Nehemiah", "Neh"],
    "Esther": ["Esther", "Est"],
    "Job": ["Job"],
    "Psalms": ["Psalms", "Psalm", "Pss", "Ps"],
    "Proverbs": ["Proverbs", "Prov", "Pr"],
    "Ecclesiastes": ["Ecclesiastes", "Eccl", "Ecc", "Qoh"],
    "Song of Solomon": ["Song of Solomon", "Song of Songs", "Canticles", "Cant", "SoS"],
    "Isaiah": ["Isaiah", "Isa", "Is"],
    "Jeremiah": ["Jeremiah", "Jer"],
    "Lamentations": ["Lamentations", "Lam"],
    "Ezekiel": ["Ezekiel", "Ezek", "Eze"],
    "Daniel": ["Daniel", "Dan"],
    "Hosea": ["Hosea", "Hos"],
    "Joel": ["Joel"],
    "Amos": ["Amos"],
    "Obadiah": ["Obadiah", "Obad"],
    "Jonah": ["Jonah", "Jon"],
    "Micah": ["Micah", "Mic"],
    "Nahum": ["Nahum", "Nah"],
    "Habakkuk": ["Habakkuk", "Hab"],
    "Zephaniah": ["Zephaniah", "Zeph", "Zph"],
    "Haggai": ["Haggai", "Hag"],
    "Zechariah": ["Zechariah", "Zech", "Zec"],
    "Malachi": ["Malachi", "Mal"],
    "Matthew": ["Matthew", "Matt", "Mt"],
    "Mark": ["Mark", "Mk"],
    "Luke": ["Luke", "Lk"],
    "John": ["John", "Jn"],
    "Acts": ["Acts"],
    "Romans": ["Romans", "Rom", "Rm"],
    "1 Corinthians": ["1 Corinthians", "1 Cor", "I Corinthians", "I Cor"],
    "2 Corinthians": ["2 Corinthians", "2 Cor", "II Corinthians", "II Cor"],
    "Galatians": ["Galatians", "Gal"],
    "Ephesians": ["Ephesians", "Eph"],
    "Philippians": ["Philippians", "Phil", "Phl"],
    "Colossians": ["Colossians", "Col"],
    "1 Thessalonians": ["1 Thessalonians", "1 Thess", "1 Th", "I Thessalonians"],
    "2 Thessalonians": ["2 Thessalonians", "2 Thess", "2 Th", "II Thessalonians"],
    "1 Timothy": ["1 Timothy", "1 Tim", "1 Tm", "I Timothy"],
    "2 Timothy": ["2 Timothy", "2 Tim", "2 Tm", "II Timothy"],
    "Titus": ["Titus", "Tit"],
    "Philemon": ["Philemon", "Phlm", "Phm"],
    "Hebrews": ["Hebrews", "Heb"],
    "James": ["James", "Jas", "Jms"],
    "1 Peter": ["1 Peter", "1 Pet", "1 Pt", "I Peter"],
    "2 Peter": ["2 Peter", "2 Pet", "2 Pt", "II Peter"],
    "1 John": ["1 John", "1 Jn", "I John"],
    "2 John": ["2 John", "2 Jn", "II John"],
    "3 John": ["3 John", "3 Jn", "III John"],
    "Jude": ["Jude"],
    "Revelation": ["Revelation", "Rev", "Apocalypse", "Apoc"],
  };
  const ALIAS_TO_CANONICAL = {};
  for (const [canonical, aliases] of Object.entries(BIBLE_BOOKS)) {
    for (const a of aliases) ALIAS_TO_CANONICAL[a.toLowerCase()] = canonical;
  }

  // Convert Roman numeral string to integer (e.g. "iv" → 4, "xxiii" → 23).
  function romanToArabic(s) {
    const vals = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
    let total = 0;
    const upper = s.toUpperCase();
    for (let i = 0; i < upper.length; i++) {
      const cur = vals[upper[i]] || 0;
      const next = vals[upper[i + 1]] || 0;
      total += cur < next ? -cur : cur;
    }
    return total;
  }

  // Regex matches both Arabic ("Matt 5:3") and Roman ("Matt. v. 3") chapters.
  // Group 1 = book alias, Group 2 = Arabic chapter OR null,
  // Group 3 = Roman chapter OR null, Group 4 = verse (optional).
  const aliasRegex = (() => {
    const sorted = Object.values(BIBLE_BOOKS).flat().sort((a, b) => b.length - a.length);
    const escaped = sorted.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return new RegExp(
      "(?:^|[^A-Za-z])(" + escaped.join("|") +
      ")\\.?\\s+(?:(\\d{1,3})|([ivxlcIVXLC]+)\\.?)(?:[:.;,]\\s?(\\d{1,3}))?",
      "g"
    );
  })();

  // Max chapter count per canonical book for false-positive filtering.
  const MAX_CHAPTERS = {
    "Genesis": 50, "Exodus": 40, "Leviticus": 27, "Numbers": 36,
    "Deuteronomy": 34, "Joshua": 24, "Judges": 21, "Ruth": 4,
    "1 Samuel": 31, "2 Samuel": 24, "1 Kings": 22, "2 Kings": 25,
    "1 Chronicles": 29, "2 Chronicles": 36, "Ezra": 10, "Nehemiah": 13,
    "Esther": 10, "Job": 42, "Psalms": 150, "Proverbs": 31,
    "Ecclesiastes": 12, "Song of Solomon": 8, "Isaiah": 66,
    "Jeremiah": 52, "Lamentations": 5, "Ezekiel": 48, "Daniel": 12,
    "Hosea": 14, "Joel": 3, "Amos": 9, "Obadiah": 25, "Jonah": 4,
    "Micah": 7, "Nahum": 3, "Habakkuk": 3, "Zephaniah": 3, "Haggai": 2,
    "Zechariah": 14, "Malachi": 4, "Matthew": 28, "Mark": 16,
    "Luke": 24, "John": 21, "Acts": 28, "Romans": 16,
    "1 Corinthians": 16, "2 Corinthians": 13, "Galatians": 6,
    "Ephesians": 6, "Philippians": 4, "Colossians": 4,
    "1 Thessalonians": 5, "2 Thessalonians": 3, "1 Timothy": 6,
    "2 Timothy": 4, "Titus": 3, "Philemon": 25, "Hebrews": 13,
    "James": 5, "1 Peter": 5, "2 Peter": 3, "1 John": 5,
    "2 John": 25, "3 John": 25, "Jude": 25, "Revelation": 22,
  };

  function detectRefs(text) {
    const found = new Map(); // passage -> count (for de-dup)
    let m;
    aliasRegex.lastIndex = 0;
    while ((m = aliasRegex.exec(text)) !== null) {
      const alias = m[1];
      const chapter = m[2]
        ? parseInt(m[2], 10)
        : romanToArabic(m[3]);
      if (!chapter) continue;
      const canonical = ALIAS_TO_CANONICAL[alias.toLowerCase()];
      if (!canonical) continue;
      // Skip if chapter exceeds actual book length (catches Roman numeral
      // false positives like "C" → 100).
      const maxCh = MAX_CHAPTERS[canonical] || 150;
      if (chapter > maxCh) continue;
      const passage = `${canonical} ${chapter}`;
      found.set(passage, (found.get(passage) || 0) + 1);
    }
    return found;
  }

  // Auto-scan ALL docs for scripture references (library + documents).
  const AUTO_SCAN_SLUGS = manifest.map((m) => m.slug);
  let added = 0;
  for (const slug of AUTO_SCAN_SLUGS) {
    const doc = await getDoc(slug);
    if (!doc) continue;

    // Walk every chapter/section/article/question and collect refs.
    // ID format must match the shape that lookupContent + normalizeAnchor
    // + JS sourceToUrl all expect.
    const chapters = [];
    if (doc.kind === "library-books") {
      for (const b of doc.books || []) {
        for (const c of b.chapters || []) {
          chapters.push({
            id: `book-${b.bookNumber}-ch-${c.number}`,
            type: "chapter",
            title: c.title || `Chapter ${c.number}`,
            text: (c.paragraphs || []).join("\n\n"),
          });
        }
      }
    } else if (doc.kind === "library-chapters" || doc.kind === "library-discourses" || doc.kind === "library-sections" || doc.kind === "chapters") {
      const list = doc.chapters || doc.discourses || doc.sections || [];
      for (const c of list) {
        chapters.push({
          id: `chapter-${c.number}`,
          type: "chapter",
          title: c.title || `Chapter ${c.number}`,
          text: (c.paragraphs || []).join("\n\n") || c.text || "",
        });
      }
    } else if (doc.kind === "sections") {
      for (const s of doc.sections || []) {
        chapters.push({
          id: `section-${s.number}`,
          type: "section",
          title: s.title || `Section ${s.number}`,
          text: s.text || (s.paragraphs || []).join("\n\n"),
        });
      }
    } else if (doc.kind === "articles") {
      for (const a of doc.articles || []) {
        chapters.push({
          id: `article-${a.number}`,
          type: "article",
          title: a.title || `Article ${a.number}`,
          text: (a.paragraphs || []).join("\n\n") || a.text || "",
        });
      }
    } else if (doc.kind === "qa") {
      for (const q of doc.questions || []) {
        chapters.push({
          id: `question-${q.number}`,
          type: "question",
          title: q.question || `Question ${q.number}`,
          text: [q.question || "", q.answer || "", ...(q.paragraphs || [])].join("\n\n"),
        });
      }
    } else if (doc.kind === "heidelberg") {
      for (const ld of doc.lordsDays || []) {
        for (const q of ld.questions || []) {
          chapters.push({
            id: `question-${q.number}`,
            type: "question",
            title: q.question || `Question ${q.number}`,
            text: [q.question || "", q.answer || ""].join("\n\n"),
          });
        }
      }
    } else if (doc.kind === "edwards") {
      // Edwards resolutions - one flat list
      for (let i = 0; i < (doc.resolutions || []).length; i++) {
        const r = doc.resolutions[i];
        chapters.push({
          id: `resolution-${i + 1}`,
          type: "resolution",
          title: `Resolution ${i + 1}`,
          text: r.text || r || "",
        });
      }
    } else if (doc.kind === "theses") {
      for (const t of doc.theses || []) {
        chapters.push({
          id: `thesis-${t.number}`,
          type: "thesis",
          title: `Thesis ${t.number}`,
          text: t.text || "",
        });
      }
    }

    for (const ch of chapters) {
      const refs = detectRefs(ch.text);
      for (const [passage] of refs) {
        if (!scData.index[passage]) scData.index[passage] = [];
        // Skip if this exact ref is already there.
        const dup = scData.index[passage].some((r) => r.source === slug && r.id === ch.id);
        if (dup) continue;
        scData.index[passage].push({
          source: slug,
          type: ch.type,
          id: ch.id,
          title: ch.title,
          excerpt: truncateExcerpt(ch.text),
        });
        added++;
      }
    }
  }
  // Make sure scData.books includes every distinct book across the
  // index — readers can otherwise hide if not in scData.books.
  const seenBooks = new Set(scData.books || []);
  for (const passage of Object.keys(scData.index)) {
    const m = passage.match(/^(.+?)\s+\d/);
    if (m) seenBooks.add(m[1]);
  }
  scData.books = Array.from(seenBooks);

  await writeFile(
    path.join(ASSET_DATA_DIR, "scripture-index.json"),
    JSON.stringify(scData)
  );
  console.log(`  + scripture-index excerpts: ${replaced} expanded, ${kept} kept; ${added} refs auto-detected from local docs`);
} catch {
  // skip
}

// ── Summary ─────────────────────────────────────────────────────
console.log(`Built ${manifest.length} partials in ${OUT_DIR}`);
console.log(`  + _cards-documents.hbs (${documents.length}) + _cards-library.hbs (${library.length})`);
console.log(`  + ${manifest.length} custom-faith-{slug}.hbs wrappers`);
console.log(`  + ${memorizeBuilt.length} memorize partials + wrappers (${memorizeBuilt.map((m) => `${m.slug}:${m.count}`).join(", ")})`);
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
