/*
 * The Faith Received — Latin Library Integration
 *
 * Fetches the 503-work index from R2 and injects cards into:
 *   1. The Library tab card grid
 *   2. The matching Traditions tab grids
 *   3. The search index (if search is active)
 */

(function () {
  "use strict";

  const baseMeta = document.querySelector('meta[name="tfr-library-base"]');
  const BASE = ((baseMeta && baseMeta.getAttribute("content")) || "").replace(/\/+$/, "");
  if (!BASE) return;

  const TRADITION_MAP = {
    "Catholic": "catholic",
    "Reformed": "reformed",
    "Lutheran": "lutheran",
    "Humanism": "scholastic",
    "Unsorted": null
  };

  fetch(`${BASE}/v1/works-index.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((data) => {
      const works = data.works || [];
      injectLibraryCards(works);
      injectTraditionCards(works);
      injectSearchEntries(works);
    })
    .catch(() => {});

  function buildCard(w) {
    const tradition = escapeHtml(w.tradition || "");
    const title = escapeHtml(w.title || w.slug);
    const author = escapeHtml(w.author || "");
    const pages = w.n_pages ? `${w.n_pages} pp.` : "";
    return `<a class="faith-card" href="/the-faith-received/reader/?w=${encodeURIComponent(w.slug)}">${ 
      tradition ? `<p class="faith-card-date">${tradition}</p>` : '' 
      }<h3 class="faith-card-title"><em>${title}</em></h3>${ 
      author ? `<p class="faith-card-author"><em>${author}</em></p>` : '' 
      }${pages ? `<p class="faith-card-desc">${pages}</p>` : '' 
      }<span class="faith-card-link">Read <span class="faith-card-arrow" aria-hidden="true">&rarr;</span></span>` +
      `</a>`;
  }

  function injectLibraryCards(works) {
    const grid = document.querySelector('[data-faith-section="library"] .faith-card-grid');
    if (!grid) return;
    const html = works.map(buildCard).join("");
    grid.insertAdjacentHTML("beforeend", html);
  }

  function injectTraditionCards(works) {
    works.forEach((w) => {
      const key = TRADITION_MAP[w.tradition];
      if (!key) return;
      const section = document.querySelector(`[data-faith-tradition="${key}"]`);
      if (!section) return;
      const grid = section.querySelector(".faith-card-grid");
      if (!grid) return;
      grid.insertAdjacentHTML("beforeend", buildCard(w));
    });
  }

  function injectSearchEntries(works) {
    if (!window.__tfrSearchAppend) return;
    const entries = works.map((w) => {
      return {
        type: "library",
        slug: w.slug,
        url: `/the-faith-received/reader/?w=${encodeURIComponent(w.slug)}`,
        title: w.title || w.slug,
        author: w.author || null,
        date: null,
        snippet: (w.tradition || "") + (w.n_pages ? ` — ${w.n_pages} pages` : "")
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
