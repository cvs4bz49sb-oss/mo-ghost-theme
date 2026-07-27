/*
 * The Faith Received — Latin Library Integration
 *
 * Surfaces the corpus catalogues on the landing page:
 *   1. The Library tab — a bounded preview + a link to full browse
 *   2. The matching Traditions tab grids — likewise bounded
 *   3. The search index (if search is active) — every work, since
 *      that's data, not DOM
 *
 * Deliberately does NOT inject a card per work. The corpus is 1,195
 * Latin works + 260 confessions; rendering ~1,455 anchors into the
 * landing page cost more layout time than the rest of the page put
 * together. Full browse with filtering and paging lives on its own
 * route.
 */

(function () {
  "use strict";

  const baseMeta = document.querySelector('meta[name="tfr-library-base"]');
  const BASE = ((baseMeta && baseMeta.getAttribute("content")) || "").replace(/\/+$/, "");
  if (!BASE) return;

  // How many cards to show per grid before deferring to full browse.
  const PREVIEW_N = 12;

  // Corpus tradition → the landing page's tradition section key.
  // Source values come from works-index.json: Reformed (389),
  // Roman Catholic (437), Lutheran (162), Medieval (162),
  // Humanism and Law (45).
  const TRADITION_MAP = {
    "Reformed": "reformed",
    "Roman Catholic": "catholic",
    "Catholic": "catholic",
    "Lutheran": "lutheran",
    "Medieval": "scholastic",
    "Humanism and Law": "scholastic",
    "Humanism": "scholastic",
  };

  fetch(`${BASE}/v1/works-index.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((data) => {
      const works = data.works || [];
      if (!works.length) return;
      injectLibraryCards(works);
      injectTraditionCards(works);
      injectSearchEntries(works);
    })
    .catch(() => {});

  function readerUrl(slug) {
    return `/the-faith-received/reader/?w=${encodeURIComponent(slug)}`;
  }

  function buildCard(w) {
    const tradition = escapeHtml(w.tradition || "");
    const title = escapeHtml(w.title || w.slug);
    const author = escapeHtml(w.author || "");
    const pages = w.n_pages ? `${w.n_pages.toLocaleString()} pp.` : "";
    return `<a class="faith-card" href="${readerUrl(w.slug)}">${
      tradition ? `<p class="faith-card-date">${tradition}</p>` : ""
      }<h3 class="faith-card-title"><em>${title}</em></h3>${
      author ? `<p class="faith-card-author"><em>${author}</em></p>` : ""
      }${pages ? `<p class="faith-card-desc">${pages}</p>` : ""
      }<span class="faith-card-link">Read <span class="faith-card-arrow" aria-hidden="true">&rarr;</span></span>` +
      `</a>`;
  }

  // A "see all" row rendered in the site's editorial idiom — a
  // hairline-separated link, not a button or a card.
  function buildMoreRow(count, href, label) {
    return `<p class="faith-library-more">` +
      `<a href="${href}">${label} <span aria-hidden="true">&rarr;</span></a>` +
      `<span class="faith-library-more-count">${count.toLocaleString()} works</span>` +
      `</p>`;
  }

  function injectLibraryCards(works) {
    const section = document.querySelector('[data-faith-section="library"]');
    if (!section) return;
    const grid = section.querySelector(".faith-card-grid");
    if (!grid) return;

    const preview = works.slice(0, PREVIEW_N);
    grid.insertAdjacentHTML("beforeend", preview.map(buildCard).join(""));

    if (works.length > preview.length) {
      // Points at search until the dedicated /library/ browse route
      // lands; every work is in the search index already (see
      // injectSearchEntries), so nothing is unreachable meanwhile.
      grid.insertAdjacentHTML(
        "afterend",
        buildMoreRow(works.length, "/the-faith-received/search/", "Search the whole library")
      );
    }
  }

  function injectTraditionCards(works) {
    // Bucket first, then render once per tradition — the old version
    // did a DOM query per work.
    const buckets = new Map();
    works.forEach((w) => {
      const key = TRADITION_MAP[w.tradition];
      if (!key) return;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(w);
    });

    buckets.forEach((list, key) => {
      const section = document.querySelector(`[data-faith-tradition="${key}"]`);
      if (!section) return;
      const grid = section.querySelector(".faith-card-grid");
      if (!grid) return;

      const preview = list.slice(0, PREVIEW_N);
      grid.insertAdjacentHTML("beforeend", preview.map(buildCard).join(""));

      if (list.length > preview.length) {
        grid.insertAdjacentHTML(
          "afterend",
          buildMoreRow(list.length, "/the-faith-received/search/", "Search all")
        );
      }
    });
  }

  function injectSearchEntries(works) {
    if (!window.__tfrSearchAppend) return;
    const entries = works.map((w) => {
      return {
        type: "library",
        slug: w.slug,
        url: readerUrl(w.slug),
        title: w.title || w.slug,
        author: w.author || null,
        date: null,
        snippet: (w.tradition || "") + (w.n_pages ? ` — ${w.n_pages.toLocaleString()} pages` : ""),
      };
    });
    window.__tfrSearchAppend(entries);
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
