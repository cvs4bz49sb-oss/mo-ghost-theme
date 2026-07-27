/*
 * The Faith Received — Latin Library Integration
 *
 * Surfaces the corpus catalogues on the landing page:
 *   1. The Library tab — every one of the 1,195 Latin works
 *   2. The Documents tab — every one of the 260 confessions
 *   3. The matching Traditions tab grids
 *   4. The search index (if search is active)
 *
 * Every work is rendered into the page. Nothing is capped, sampled or
 * deferred behind a "browse all" link: the whole corpus is meant to be
 * scrollable and findable in place.
 *
 * That is ~1,455 injected cards, so the rendering is done carefully —
 * one string build and one insertAdjacentHTML per grid (never a node
 * at a time), and .faith-card carries content-visibility:auto so the
 * browser skips layout and paint for cards outside the viewport. The
 * DOM is complete; only the rendering work is deferred.
 */

(function () {
  "use strict";

  const baseMeta = document.querySelector('meta[name="tfr-library-base"]');
  const BASE = ((baseMeta && baseMeta.getAttribute("content")) || "").replace(/\/+$/, "");
  if (!BASE) return;

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

  fetch(`${BASE}/v1/confessions-index.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((data) => {
      const confessions = data.confessions || [];
      if (!confessions.length) return;
      injectConfessionCards(confessions);
      injectConfessionSearchEntries(confessions);
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

  // Confessions carry year/type/region rather than author/pages.
  function buildConfessionCard(c) {
    const meta = escapeHtml([c.tradition, c.type].filter(Boolean).join(" · "));
    const title = escapeHtml(c.title || c.slug);
    const region = escapeHtml(c.region || "");
    const year = c.year ? escapeHtml(String(c.year)) : "";
    return `<a class="faith-card" href="${readerUrl(c.slug)}">${
      meta ? `<p class="faith-card-date">${meta}</p>` : ""
      }<h3 class="faith-card-title"><em>${title}</em></h3>${
      region ? `<p class="faith-card-author"><em>${region}</em></p>` : ""
      }${year ? `<p class="faith-card-desc">${year}</p>` : ""
      }<span class="faith-card-link">Read <span class="faith-card-arrow" aria-hidden="true">&rarr;</span></span>` +
      `</a>`;
  }

  // One string build, one DOM insertion. Appending node-by-node across
  // a thousand-odd cards forces a reflow per card.
  function appendCards(grid, list, build) {
    if (!grid || !list.length) return;
    grid.insertAdjacentHTML("beforeend", list.map(build).join(""));
  }

  function injectLibraryCards(works) {
    const section = document.querySelector('[data-faith-section="library"]');
    if (!section) return;
    appendCards(section.querySelector(".faith-card-grid"), works, buildCard);
  }

  function injectConfessionCards(confessions) {
    const section = document.querySelector('[data-faith-section="documents"]');
    if (!section) return;
    appendCards(section.querySelector(".faith-card-grid"), confessions, buildConfessionCard);
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
      appendCards(section.querySelector(".faith-card-grid"), list, buildCard);
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

  function injectConfessionSearchEntries(confessions) {
    if (!window.__tfrSearchAppend) return;
    window.__tfrSearchAppend(confessions.map((c) => {
      return {
        type: "confession",
        slug: c.slug,
        url: readerUrl(c.slug),
        title: c.title || c.slug,
        author: null,
        date: c.year ? String(c.year) : null,
        snippet: c.preview || [c.tradition, c.type, c.region].filter(Boolean).join(" · "),
      };
    }));
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
