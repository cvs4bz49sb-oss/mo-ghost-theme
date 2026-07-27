/*
 * The Faith Received — Library browse
 *
 * Three levels, all in place on the Library tab:
 *
 *   Collection  ->  Author  ->  Works
 *
 * The reading room spans 72,670 works across eight collections and
 * roughly 18,000 authors, so a flat shelf is not an option — EEBO
 * alone has 14,032 authors. Collection first keeps the top level to
 * nine cards; the author level is filterable; the work level is one
 * author's shelf.
 *
 * State lives in the URL (?collection=, ?author=) so the back button
 * works and any level is a shareable link.
 *
 * Documents is handled separately and holds the creeds, confessions
 * and catechisms — 13 curated English documents plus the 260-strong
 * confessions corpus.
 *
 * Where a collection's text is not reachable yet (see `readable` in
 * faith-corpora.js) works are still listed, searchable and indexed;
 * their cards say so instead of linking into a reader that would fail.
 */

(function () {
  "use strict";

  const baseMeta = document.querySelector('meta[name="tfr-library-base"]');
  const BASE = ((baseMeta && baseMeta.getAttribute("content")) || "").replace(/\/+$/, "");
  if (!BASE || !window.MOCorpora) return;

  const librarySection = document.querySelector('[data-faith-section="library"]');
  const documentsSection = document.querySelector('[data-faith-section="documents"]');

  // Collections that make up the Library tab, in reading order.
  // Confessions are excluded — they belong to Documents.
  const LIBRARY_IDS = ["tfr", "eebo", "pld", "pangrammata", "po", "aquinas", "pg"];

  // Curated English works ship server-rendered in the Library grid.
  // Harvest them before anything clears it; they become their own
  // collection rather than being replaced by the corpus.
  const nativeWorks = harvestNativeCards();

  // collection id -> { meta, works[], authors: Map }
  const collections = new Map();

  bootstrap();

  function bootstrap() {
    registerNativeCollection();
    // Render the shelf immediately from what we already have, then
    // fill in each corpus as its catalogue lands. A slow source must
    // never hold up the whole page.
    renderCollections();
    LIBRARY_IDS.forEach((id) => {
      window.MOCorpora.load(id).then((works) => {
        if (!works.length) return;
        const c = window.MOCorpora.get(id);
        collections.set(id, { id, meta: c, works, authors: groupByAuthor(works) });
        if (currentView().view === "collections") renderCollections();
        appendSearchEntries(works, c);
      });
    });
    loadConfessions();
    restoreFromUrl();
  }

  function registerNativeCollection() {
    if (!nativeWorks.length) return;
    collections.set("mo-english", {
      id: "mo-english",
      meta: {
        id: "mo-english",
        label: "English Editions",
        short: "Curated English texts of the fathers and classics",
        readable: true,
      },
      works: nativeWorks,
      authors: groupByAuthor(nativeWorks),
    });
  }

  // ── Harvest the server-rendered cards ─────────────────────────

  function harvestNativeCards() {
    const grid = libraryGrid();
    if (!grid) return [];
    const out = [];
    grid.querySelectorAll("a.faith-card").forEach((a) => {
      const href = a.getAttribute("href");
      if (!href) return;
      const pick = (sel) => {
        const el = a.querySelector(sel);
        return el ? el.textContent.trim() : "";
      };
      out.push({
        corpus: "mo-english",
        native: true,
        readable: true,
        id: href,
        url: href,
        title: pick(".faith-card-title"),
        author: pick(".faith-card-author"),
        eyebrow: pick(".faith-card-date"),
        description: pick(".faith-card-desc"),
        extent: 0,
      });
    });
    return out;
  }

  // ── Grouping ──────────────────────────────────────────────────

  function groupByAuthor(works) {
    const idx = new Map();
    works.forEach((w) => {
      const name = (w.author || "").trim() || "Unattributed";
      if (!idx.has(name)) idx.set(name, []);
      idx.get(name).push(w);
    });
    return new Map([...idx.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  }

  // ── DOM helpers ───────────────────────────────────────────────

  function libraryGrid() {
    return librarySection ? librarySection.querySelector(".faith-card-grid") : null;
  }

  function clearChrome() {
    document.querySelectorAll("[data-faith-browse-chrome]").forEach((el) => el.remove());
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function appendCards(grid, list, build) {
    if (!grid || !list.length) return;
    grid.insertAdjacentHTML("beforeend", list.map(build).join(""));
  }

  // ── Cards ─────────────────────────────────────────────────────

  function buildCollectionCard(c) {
    const n = c.works.length;
    const authors = c.authors.size;
    const pending = c.meta.readable === false;
    return `<a class="faith-card" href="?collection=${encodeURIComponent(c.id)}" data-faith-collection="${escapeHtml(c.id)}">` +
      `<p class="faith-card-date">${escapeHtml(c.meta.short || "")}</p>` +
      `<h3 class="faith-card-title"><em>${escapeHtml(c.meta.label)}</em></h3>` +
      `<p class="faith-card-desc">${n.toLocaleString()} work${n === 1 ? "" : "s"} &middot; ` +
      `${authors.toLocaleString()} author${authors === 1 ? "" : "s"}</p>${ 
      pending ? `<p class="faith-pending">Catalogue and indexes only &mdash; full text in progress</p>` : "" 
      }<span class="faith-card-link">${pending ? "Browse" : "Read"} ` +
      `<span class="faith-card-arrow" aria-hidden="true">&rarr;</span></span></a>`;
  }

  function buildAuthorCard(collectionId, name, works) {
    const n = works.length;
    const pages = works.reduce((a, w) => a + (w.extent || 0), 0);
    const withEyebrow = works.find((w) => w.eyebrow);
    return `<a class="faith-card" href="?collection=${encodeURIComponent(collectionId)}&author=${encodeURIComponent(name)}" data-faith-author="${escapeHtml(name)}">${ 
      withEyebrow ? `<p class="faith-card-date">${escapeHtml(withEyebrow.eyebrow)}</p>` : "" 
      }<h3 class="faith-card-title"><em>${escapeHtml(name)}</em></h3>` +
      `<p class="faith-card-desc">${n.toLocaleString()} work${n === 1 ? "" : "s"}` +
      `${pages ? ` &middot; ${pages.toLocaleString()} pp.` : ""}</p>` +
      `<span class="faith-card-link">Works <span class="faith-card-arrow" aria-hidden="true">&rarr;</span></span></a>`;
  }

  function buildWorkCard(w) {
    const readable = w.readable !== false;
    const desc = w.native
      ? escapeHtml(w.description || "")
      : (w.extent ? `${w.extent.toLocaleString()} pp.` : "");
    const inner =
      `${w.eyebrow ? `<p class="faith-card-date">${escapeHtml(w.eyebrow)}</p>` : "" 
      }<h3 class="faith-card-title"><em>${escapeHtml(w.title)}</em></h3>${ 
      w.titleLatin && w.titleLatin !== w.title
        ? `<p class="faith-card-author"><em>${escapeHtml(w.titleLatin)}</em></p>` : "" 
      }${desc ? `<p class="faith-card-desc">${desc}</p>` : ""}`;
    if (!readable) {
      // No href — linking into a reader that cannot load the text
      // would be a dead end dressed up as a link.
      return `<div class="faith-card faith-card--pending">${inner}` +
        `<span class="faith-card-link faith-card-link--muted">Text in progress</span></div>`;
    }
    return `<a class="faith-card" href="${escapeHtml(w.url)}">${inner}` +
      `<span class="faith-card-link">${w.native ? "Read &amp; study" : "Read"} ` +
      `<span class="faith-card-arrow" aria-hidden="true">&rarr;</span></span></a>`;
  }

  // ── Views ─────────────────────────────────────────────────────

  function renderCollections() {
    const grid = libraryGrid();
    if (!grid) return;
    clearChrome();
    grid.innerHTML = "";
    const ordered = ["mo-english"].concat(LIBRARY_IDS)
      .map((id) => collections.get(id))
      .filter(Boolean);
    appendCards(grid, ordered, buildCollectionCard);
  }

  function renderAuthors(collectionId, filterText) {
    const c = collections.get(collectionId);
    const grid = libraryGrid();
    if (!c || !grid) return;
    clearChrome();
    grid.innerHTML = "";

    const q = (filterText || "").trim().toLowerCase();
    let entries = [...c.authors.entries()];
    if (q) entries = entries.filter(([name]) => name.toLowerCase().includes(q));

    insertChrome(grid, {
      back: { label: "All collections", to: "collections" },
      title: c.meta.label,
      sub: `${c.works.length.toLocaleString()} works &middot; ${c.authors.size.toLocaleString()} authors`,
      note: c.meta.readable === false
        ? "Catalogue and indexes are available. Full text is being ported."
        : "",
      // A filter is the only workable entry point at EEBO's 14,032.
      filter: c.authors.size > 40 ? (filterText || "") : null,
      count: q ? `${entries.length.toLocaleString()} matching` : "",
    });

    appendCards(grid, entries, ([name, works]) => buildAuthorCard(collectionId, name, works));
  }

  function renderWorks(collectionId, author) {
    const c = collections.get(collectionId);
    const grid = libraryGrid();
    if (!c || !grid) return;
    const works = c.authors.get(author);
    if (!works) return renderAuthors(collectionId, "");
    clearChrome();
    grid.innerHTML = "";

    insertChrome(grid, {
      back: { label: c.meta.label, to: "authors", collection: collectionId },
      title: author,
      sub: `${works.length.toLocaleString()} work${works.length === 1 ? "" : "s"} in ${escapeHtml(c.meta.label)}`,
      note: c.meta.readable === false
        ? "These works are catalogued and indexed. Full text is being ported."
        : "",
    });

    appendCards(grid, works, buildWorkCard);
  }

  // Header above the grid: back link, title, count, optional filter.
  function insertChrome(grid, opts) {
    const head = document.createElement("div");
    head.className = "faith-browse-head";
    head.setAttribute("data-faith-browse-chrome", "");
    const filterHtml = opts.filter != null
      ? `<input type="search" class="faith-browse-filter" data-faith-filter ` +
        `placeholder="Filter authors&hellip;" value="${escapeHtml(opts.filter)}" ` +
        `aria-label="Filter authors">`
      : "";
    head.innerHTML =
      `<button type="button" class="faith-author-back" data-faith-back ` +
      `data-to="${opts.back.to}" data-collection="${escapeHtml(opts.back.collection || "")}">` +
      `<span aria-hidden="true">&larr;</span> ${escapeHtml(opts.back.label)}</button>` +
      `<h2 class="faith-author-name"><em>${escapeHtml(opts.title)}</em></h2>` +
      `<p class="faith-author-dates">${opts.sub}${opts.count ? ` &middot; ${opts.count}` : ""}</p>${ 
      opts.note ? `<p class="faith-browse-note">${escapeHtml(opts.note)}</p>` : "" 
      }${filterHtml}`;
    grid.parentNode.insertBefore(head, grid);
  }

  // ── Routing ───────────────────────────────────────────────────

  function currentView() {
    let collection = "";
    let author = "";
    try {
      const q = new URLSearchParams(window.location.search);
      collection = q.get("collection") || "";
      author = q.get("author") || "";
    } catch (_) {}
    if (collection && author) return { view: "works", collection, author };
    if (collection) return { view: "authors", collection };
    return { view: "collections" };
  }

  function restoreFromUrl() {
    const v = currentView();
    if (v.view === "works") renderWorks(v.collection, v.author);
    else if (v.view === "authors") renderAuthors(v.collection, "");
    else renderCollections();
  }

  function go(url, render) {
    window.history.pushState({}, "", url);
    render();
    const head = document.querySelector("[data-faith-browse-chrome]");
    if (head) head.scrollIntoView({ block: "start" });
  }

  document.addEventListener("click", (e) => {
    const back = e.target.closest("[data-faith-back]");
    if (back) {
      e.preventDefault();
      const to = back.getAttribute("data-to");
      const col = back.getAttribute("data-collection");
      if (to === "authors" && col) {
        go(`${window.location.pathname}?collection=${encodeURIComponent(col)}`, () => renderAuthors(col, ""));
      } else {
        go(window.location.pathname, renderCollections);
      }
      return;
    }
    const col = e.target.closest("[data-faith-collection]");
    if (col) {
      e.preventDefault();
      const id = col.getAttribute("data-faith-collection");
      go(`${window.location.pathname}?collection=${encodeURIComponent(id)}`, () => renderAuthors(id, ""));
      return;
    }
    const auth = e.target.closest("[data-faith-author]");
    if (auth) {
      e.preventDefault();
      const name = auth.getAttribute("data-faith-author");
      const v = currentView();
      if (!v.collection) return;
      go(`${window.location.pathname}?collection=${encodeURIComponent(v.collection)}&author=${encodeURIComponent(name)}`,
        () => renderWorks(v.collection, name));
    }
  });

  // Filtering re-renders the author level without touching history —
  // a keystroke should not be a back-button stop.
  document.addEventListener("input", (e) => {
    const input = e.target.closest("[data-faith-filter]");
    if (!input) return;
    const v = currentView();
    if (v.view !== "authors") return;
    const caret = input.selectionStart;
    renderAuthors(v.collection, input.value);
    const again = document.querySelector("[data-faith-filter]");
    if (again) {
      again.focus();
      try { again.setSelectionRange(caret, caret); } catch (_) {}
    }
  });

  window.addEventListener("popstate", restoreFromUrl);

  // ── Documents: the confessions corpus ─────────────────────────

  function loadConfessions() {
    if (!documentsSection) return;
    window.MOCorpora.load("confessions").then((list) => {
      if (!list.length) return;
      const grid = documentsSection.querySelector(".faith-card-grid");
      appendCards(grid, list, (c) =>
        `<a class="faith-card" href="${escapeHtml(c.url)}">${ 
        c.eyebrow ? `<p class="faith-card-date">${escapeHtml(c.eyebrow)}</p>` : "" 
        }<h3 class="faith-card-title"><em>${escapeHtml(c.title)}</em></h3>${ 
        c.year ? `<p class="faith-card-desc">${escapeHtml(String(c.year))}</p>` : "" 
        }<span class="faith-card-link">Read <span class="faith-card-arrow" aria-hidden="true">&rarr;</span></span></a>`);
      appendSearchEntries(list, window.MOCorpora.get("confessions"));
    });
  }

  // ── Search index ──────────────────────────────────────────────

  function appendSearchEntries(works, meta) {
    if (!window.__tfrSearchAppend) return;
    // Works whose text isn't ported stay searchable — finding out that
    // Migne has a thing is worth something — but they must not link
    // into the reader, which cannot open them. Point them at their
    // collection instead, and say why in the snippet.
    const pending = meta && meta.readable === false;
    const collectionUrl = meta
      ? `/the-faith-received/?collection=${encodeURIComponent(meta.id)}`
      : "/the-faith-received/";
    window.__tfrSearchAppend(works.map((w) => ({
      type: w.corpus || "library",
      slug: w.id,
      url: pending ? collectionUrl : w.url,
      title: w.title,
      author: w.author || null,
      date: w.year ? String(w.year) : null,
      snippet: [
        meta && meta.label,
        w.eyebrow,
        w.extent ? `${w.extent} pages` : "",
        pending ? "text in progress" : "",
      ].filter(Boolean).join(" · "),
    })));
  }
})();
