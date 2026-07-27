/*
 * The Faith Received — Latin Library Integration
 *
 * Surfaces the corpus catalogues on the landing page:
 *   1. The Library tab — 272 author cards; click one for their works
 *   2. The Documents tab — every one of the 260 confessions
 *   3. The matching Traditions tab grids
 *   4. The search index (if search is active)
 *
 * Library is collapsed by author: Library -> Author -> Works. The
 * drill-down happens in place and pushes ?author=... so the browser
 * back button and shared links both work.
 *
 * Nothing is capped or sampled — every work is reachable, and every
 * work is in the search index. Where a grid does hold a lot of cards
 * (Documents holds 260, the tradition grids up to 443), each grid is
 * built as one string and inserted once, never a node at a time, and
 * .faith-card carries content-visibility:auto so the browser skips
 * layout and paint for anything off-screen.
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

  // author display name → { works[], bio }
  let authorIndex = new Map();

  Promise.all([
    fetch(`${BASE}/v1/works-index.json`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }),
    // Bios are a nicety — a failure here must not cost us the library.
    fetch(`${BASE}/v1/authors.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
  ])
    .then(([data, bios]) => {
      const works = data.works || [];
      if (!works.length) return;
      authorIndex = buildAuthorIndex(works, bios);
      injectAuthorCards();
      injectTraditionCards(works);
      injectSearchEntries(works);
      // Restore a drilled-in author if the URL names one.
      const wanted = new URLSearchParams(window.location.search).get("author");
      if (wanted && authorIndex.has(wanted)) showAuthor(wanted, false);
    })
    .catch(() => {});

  function buildAuthorIndex(works, bios) {
    const idx = new Map();
    works.forEach((w) => {
      const name = (w.author || "").trim() || "Unattributed";
      if (!idx.has(name)) idx.set(name, { name, works: [], bio: bios[name] || null });
      idx.get(name).works.push(w);
    });
    // Alphabetical by display name — how a reader scans a shelf.
    return new Map([...idx.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  }

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

  // ── Library: Author → Works ───────────────────────────────────

  function libraryGrid() {
    const section = document.querySelector('[data-faith-section="library"]');
    return section ? section.querySelector(".faith-card-grid") : null;
  }

  function buildAuthorCard(entry) {
    const name = escapeHtml(entry.name);
    const n = entry.works.length;
    const dates = entry.bio && entry.bio.dates ? escapeHtml(entry.bio.dates) : "";
    const tradition = escapeHtml(entry.works[0].tradition || "");
    const pages = entry.works.reduce((a, w) => a + (w.n_pages || 0), 0);
    return `<a class="faith-card" href="?author=${encodeURIComponent(entry.name)}" data-faith-author="${escapeHtml(entry.name)}">${
      tradition ? `<p class="faith-card-date">${tradition}</p>` : ""
      }<h3 class="faith-card-title"><em>${name}</em></h3>${
      dates ? `<p class="faith-card-author"><em>${dates}</em></p>` : ""
      }<p class="faith-card-desc">${n.toLocaleString()} work${n === 1 ? "" : "s"}` +
      `${pages ? ` &middot; ${pages.toLocaleString()} pp.` : ""}</p>` +
      `<span class="faith-card-link">Works <span class="faith-card-arrow" aria-hidden="true">&rarr;</span></span>` +
      `</a>`;
  }

  function injectAuthorCards() {
    const grid = libraryGrid();
    if (!grid) return;
    grid.innerHTML = "";
    grid.classList.remove("faith-card-grid--works");
    appendCards(grid, [...authorIndex.values()], buildAuthorCard);
    const back = document.querySelector("[data-faith-author-back]");
    if (back) back.remove();
  }

  // Swap the grid to one author's works, with a way back. Done in
  // place rather than on a separate route so there is no new template
  // to keep in sync and no full page load between shelf and author.
  function showAuthor(name, push) {
    const entry = authorIndex.get(name);
    const grid = libraryGrid();
    if (!entry || !grid) return;

    grid.innerHTML = "";
    grid.classList.add("faith-card-grid--works");
    appendCards(grid, entry.works, buildCard);

    const existing = document.querySelector("[data-faith-author-back]");
    if (existing) existing.remove();

    const bio = entry.bio && entry.bio.bio ? entry.bio.bio : "";
    const dates = entry.bio && entry.bio.dates ? entry.bio.dates : "";
    const header = document.createElement("div");
    header.className = "faith-author-head";
    header.setAttribute("data-faith-author-back", "");
    const datesHtml = dates ? `<p class="faith-author-dates">${escapeHtml(dates)}</p>` : "";
    const bioHtml = bio ? `<p class="faith-author-bio">${escapeHtml(bio)}</p>` : "";
    header.innerHTML =
      `<button type="button" class="faith-author-back" data-faith-back>` +
      `<span aria-hidden="true">&larr;</span> All authors</button>` +
      `<h2 class="faith-author-name"><em>${escapeHtml(entry.name)}</em></h2>` +
      `${datesHtml}${bioHtml}`;
    grid.parentNode.insertBefore(header, grid);

    if (push) {
      const url = `${window.location.pathname}?author=${encodeURIComponent(name)}${window.location.hash}`;
      window.history.pushState({ author: name }, "", url);
    }
    header.scrollIntoView({ block: "start" });
  }

  document.addEventListener("click", (e) => {
    const back = e.target.closest("[data-faith-back]");
    if (back) {
      e.preventDefault();
      injectAuthorCards();
      window.history.pushState({}, "", window.location.pathname + window.location.hash);
      return;
    }
    const card = e.target.closest("[data-faith-author]");
    if (!card) return;
    e.preventDefault();
    showAuthor(card.getAttribute("data-faith-author"), true);
  });

  window.addEventListener("popstate", () => {
    const wanted = new URLSearchParams(window.location.search).get("author");
    if (wanted && authorIndex.has(wanted)) showAuthor(wanted, false);
    else if (authorIndex.size) injectAuthorCards();
  });

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
