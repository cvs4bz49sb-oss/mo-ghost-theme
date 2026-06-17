/*
 * The Faith Received — Dynamic Reader
 *
 * Powers the /the-faith-received/reader/?w=slug route. Fetches work
 * metadata and page content from an R2-backed CDN, populates the
 * header, builds the TOC, renders parallel Latin/English text with
 * language toggle, collapsible sections, and continue-reading state.
 *
 * No dependencies beyond the DOM. Lightweight markdown rendering
 * for scholarly texts (paragraphs, headings, bold, italic).
 */

(function () {
  "use strict";

  // ── Config ────────────────────────────────────────────────────
  const baseMeta = document.querySelector('meta[name="tfr-library-base"]');
  const BASE = ((baseMeta && baseMeta.getAttribute("content")) || "").replace(/\/+$/, "");
  const LANG_KEY = "fr_lang_pref";
  const LASTREAD_KEY = "fr_lastread";

  // ── DOM refs ──────────────────────────────────────────────────
  const titleEl = document.querySelector("[data-fr-title]");
  const dekEl = document.querySelector("[data-fr-dek]");
  const traditionEl = document.querySelector("[data-fr-tradition]");
  const translatorEl = document.querySelector("[data-fr-translator]");
  const descEl = document.querySelector("[data-fr-description]");
  const tocNav = document.querySelector("[data-fr-toc]");
  const contentEl = document.querySelector("[data-fr-content]");
  const loadingEl = document.querySelector("[data-fr-loading]");
  const errorEl = document.querySelector("[data-fr-error]");
  const langToggle = document.querySelector("[data-faith-lang-toggle]");

  // Bail if we're not on the reader page.
  if (!contentEl) return;

  // ── Read slug from query string ───────────────────────────────
  let slug = "";
  try {
    slug = new URLSearchParams(window.location.search).get("w") || "";
  } catch (_) {}
  slug = slug.replace(/[^a-z0-9_-]/gi, "");

  if (!slug) {
    showError("No work specified. Add ?w=slug-name to the URL.");
    return;
  }

  // ── State ─────────────────────────────────────────────────────
  let meta = null;
  let pages = [];
  let currentLang = restoreLang();

  // ── Boot ──────────────────────────────────────────────────────
  applyLang(currentLang);
  fetchWork();

  // ── Fetch meta + content ──────────────────────────────────────

  function fetchWork() {
    const metaUrl = `${BASE}/v1/works/${slug}/meta.json`;
    fetch(metaUrl, { credentials: "same-origin" })
      .then((r) => {
        if (!r.ok) throw new Error(`meta ${r.status}`);
        return r.json();
      })
      .then((m) => {
        meta = m;
        populateHeader(m);
        buildToc(m.structure || []);
        return fetchPages(m);
      })
      .then((p) => {
        pages = p;
        renderContent(meta, pages);
        hideLoading();
        saveLastRead();
      })
      .catch((err) => {
        showError(`Could not load this work. (${err.message || err})`);
      });
  }

  function fetchPages(m) {
    // If meta indicates sharding, fetch each shard; otherwise fetch
    // a single work.json.
    if (m.shards && m.shards.length) {
      const promises = m.shards.map((shard) => {
        const file = typeof shard === "string" ? shard : shard.file;
        return fetch(`${BASE}/v1/works/${slug}/${file}`, {
          credentials: "same-origin",
        }).then((r) => {
          if (!r.ok) throw new Error(`shard ${file} ${r.status}`);
          return r.json();
        });
      });
      return Promise.all(promises).then((results) => {
        // Each shard is an array of page objects; flatten.
        let all = [];
        results.forEach((arr) => {
          if (Array.isArray(arr)) {
            all = all.concat(arr);
          } else if (arr && arr.pages) {
            all = all.concat(arr.pages);
          }
        });
        return all;
      });
    }
    // Single file.
    return fetch(`${BASE}/v1/works/${slug}/work.json`, {
      credentials: "same-origin",
    })
      .then((r) => {
        if (!r.ok) throw new Error(`work ${r.status}`);
        return r.json();
      })
      .then((data) => {
        return Array.isArray(data) ? data : (data.pages || []);
      });
  }

  // ── Populate header from meta ─────────────────────────────────

  function populateHeader(m) {
    if (titleEl) titleEl.textContent = m.title || "Untitled";
    if (dekEl) {
      const parts = [];
      if (m.author) parts.push(escapeHtml(m.author));
      if (m.date) parts.push(escapeHtml(m.date));
      dekEl.innerHTML = parts.join(" &middot; ");
    }
    if (traditionEl && m.tradition) {
      traditionEl.textContent = m.tradition;
      traditionEl.href = "/the-faith-received/#traditions";
    }
    if (translatorEl) {
      if (m.translator) {
        translatorEl.textContent = `Translated by ${m.translator}`;
      } else {
        translatorEl.hidden = true;
      }
    }
    if (descEl) {
      descEl.textContent = m.description || "";
      if (!m.description) descEl.hidden = true;
    }
    // Update the page title.
    if (m.title) {
      document.title = `${m.title} — The Faith Received — Mere Orthodoxy`;
    }
  }

  // ── Build TOC ─────────────────────────────────────────────────

  function buildToc(structure) {
    if (!tocNav || !structure.length) {
      if (tocNav) {
        const loadNote = tocNav.querySelector(".faith-toc-loading");
        if (loadNote) loadNote.textContent = "No contents available.";
      }
      return;
    }

    // Remove the loading note.
    const loadNote = tocNav.querySelector(".faith-toc-loading");
    if (loadNote) loadNote.remove();

    // Group entries by top-level (depth 0/1) book-like items and
    // nested chapter-like items (depth > first entry's depth).
    const minDepth = structure[0].depth || 0;
    const groups = [];
    let currentGroup = null;

    structure.forEach((entry) => {
      const depth = entry.depth != null ? entry.depth : 0;
      if (depth <= minDepth) {
        // Top-level item: start a new group.
        currentGroup = { entry, children: [] };
        groups.push(currentGroup);
      } else if (currentGroup) {
        currentGroup.children.push(entry);
      } else {
        // No parent yet; treat as top-level.
        currentGroup = { entry, children: [] };
        groups.push(currentGroup);
      }
    });

    // If everything is at the same depth, render a flat list.
    const allSameDepth = groups.every((g) => { return g.children.length === 0; });

    if (allSameDepth) {
      const ol = document.createElement("ol");
      ol.className = "faith-toc-list faith-toc-book-list";
      groups.forEach((g, i) => {
        const li = document.createElement("li");
        li.className = "faith-toc-item";
        li.innerHTML =
          `<a href="#section-${g.entry.page}">` +
          `<span class="faith-toc-num">${toRoman(i + 1)}</span>` +
          `<span class="faith-toc-label">${escapeHtml(g.entry.title)}</span>` +
          `</a>`;
        ol.appendChild(li);
      });
      tocNav.appendChild(ol);
    } else {
      // Grouped: details/summary for each book, ol for chapters.
      groups.forEach((g) => {
        const details = document.createElement("details");
        details.className = "faith-toc-book-details";

        const summary = document.createElement("summary");
        summary.className = "faith-toc-book-summary";
        summary.innerHTML =
          `<span class="faith-toc-book-label">${escapeHtml(g.entry.title)}</span>` +
          `<span class="faith-toc-book-count">${g.children.length} ch${g.children.length === 1 ? "" : "s"}</span>` +
          `<span class="faith-chev" aria-hidden="true"></span>`;
        details.appendChild(summary);

        if (g.children.length) {
          const ol = document.createElement("ol");
          ol.className = "faith-toc-list faith-toc-book-list";
          g.children.forEach((ch, ci) => {
            const li = document.createElement("li");
            li.className = "faith-toc-item";
            li.innerHTML =
              `<a href="#section-${ch.page}">` +
              `<span class="faith-toc-num">${toRoman(ci + 1)}</span>` +
              `<span class="faith-toc-label">${escapeHtml(ch.title)}</span>` +
              `</a>`;
            ol.appendChild(li);
          });
          details.appendChild(ol);
        }

        tocNav.appendChild(details);
      });
    }
  }

  // ── Render content ────────────────────────────────────────────

  function renderContent(m, pages) {
    if (!contentEl) return;
    contentEl.innerHTML = "";

    const structure = m.structure || [];
    if (!structure.length) {
      // No structure: render all pages as a single section.
      const section = createSection("Content", 1, pages);
      contentEl.appendChild(section);
      return;
    }

    // Determine grouping. Top-level entries are "books"; children are
    // "chapters". Same logic as TOC.
    const minDepth = structure[0].depth || 0;
    const groups = [];
    let currentGroup = null;

    structure.forEach((entry) => {
      const depth = entry.depth != null ? entry.depth : 0;
      if (depth <= minDepth) {
        currentGroup = { entry, children: [] };
        groups.push(currentGroup);
      } else if (currentGroup) {
        currentGroup.children.push(entry);
      } else {
        currentGroup = { entry, children: [] };
        groups.push(currentGroup);
      }
    });

    const allFlat = groups.every((g) => { return g.children.length === 0; });

    if (allFlat) {
      // Flat: each structure entry is a section.
      groups.forEach((g, i) => {
        const startPage = g.entry.page;
        const endPage = (i + 1 < groups.length) ? groups[i + 1].entry.page : Infinity;
        const sectionPages = filterPages(pages, startPage, endPage);
        const section = createSection(g.entry.title, startPage, sectionPages);
        contentEl.appendChild(section);
      });
    } else {
      // Nested: books > chapters.
      groups.forEach((g, gi) => {
        const bookEl = document.createElement("details");
        bookEl.className = "faith-book faith-book-details faith-book-details--editorial";
        bookEl.id = `book-${gi + 1}`;

        const bookSummary = document.createElement("summary");
        bookSummary.className = "faith-book-summary";
        bookSummary.innerHTML =
          `<div class="faith-book-summary-inner">` +
          `<p class="eyebrow faith-part-eyebrow">${escapeHtml(g.entry.title)}</p>` +
          `<p class="faith-book-subtitle">${g.children.length} chapter${g.children.length === 1 ? "" : "s"}</p>` +
          `</div>` +
          `<span class="faith-chev" aria-hidden="true"></span>`;
        bookEl.appendChild(bookSummary);

        const bookBody = document.createElement("div");
        bookBody.className = "faith-book-body";

        if (g.children.length) {
          g.children.forEach((ch, ci) => {
            const startPage = ch.page;
            // End page: next child, or next book, or Infinity.
            let endPage = Infinity;
            if (ci + 1 < g.children.length) {
              endPage = g.children[ci + 1].page;
            } else if (gi + 1 < groups.length) {
              endPage = groups[gi + 1].entry.page;
            }
            const chPages = filterPages(pages, startPage, endPage);
            const section = createSection(ch.title, ch.page, chPages);
            bookBody.appendChild(section);
          });
        } else {
          // Book with no children: render the book's own pages.
          const bookStart = g.entry.page;
          const bookEnd = (gi + 1 < groups.length) ? groups[gi + 1].entry.page : Infinity;
          const bPages = filterPages(pages, bookStart, bookEnd);
          const section = createSection(g.entry.title, g.entry.page, bPages);
          bookBody.appendChild(section);
        }

        bookEl.appendChild(bookBody);
        contentEl.appendChild(bookEl);
      });
    }
  }

  function filterPages(pages, startPage, endPage) {
    return pages.filter((p) => {
      return p.n >= startPage && p.n < endPage;
    });
  }

  function createSection(title, page, sectionPages) {
    const details = document.createElement("details");
    details.className = "faith-section-details faith-book-chapter";
    details.id = `section-${page}`;

    const summary = document.createElement("summary");
    summary.className = "faith-section-summary";
    summary.innerHTML =
      `<div class="faith-section-summary-inner">` +
      `<h2 class="faith-section-title"><em>${escapeHtml(title)}</em></h2>` +
      `</div>` +
      `<span class="faith-chev" aria-hidden="true"></span>`;
    details.appendChild(summary);

    const body = document.createElement("div");
    body.className = "faith-section-body article-content";

    sectionPages.forEach((p) => {
      const block = document.createElement("div");
      block.className = "faith-parallel-block";
      block.setAttribute("data-page", p.n);

      // English column.
      const enCol = document.createElement("div");
      enCol.className = "faith-col-en";
      enCol.innerHTML =
        `<span class="faith-page-marker">[p. ${p.n}]</span>${ 
        renderMarkdown(p.en || "")}`;

      // Latin column.
      const laCol = document.createElement("div");
      laCol.className = "faith-col-la";
      laCol.innerHTML = renderMarkdown(p.la || "");

      block.appendChild(enCol);
      block.appendChild(laCol);
      body.appendChild(block);
    });

    details.appendChild(body);
    return details;
  }

  // ── Lightweight markdown renderer ─────────────────────────────

  function renderMarkdown(text) {
    if (!text) return "";
    const paragraphs = text.split(/\n\n+/);
    let html = "";
    paragraphs.forEach((para) => {
      para = para.trim();
      if (!para) return;
      // Headings.
      let hMatch;
      if ((hMatch = para.match(/^### (.+)$/))) {
        html += `<h3>${inlineFormat(hMatch[1])}</h3>`;
      } else if ((hMatch = para.match(/^## (.+)$/))) {
        html += `<h2>${inlineFormat(hMatch[1])}</h2>`;
      } else if ((hMatch = para.match(/^# (.+)$/))) {
        html += `<h1>${inlineFormat(hMatch[1])}</h1>`;
      } else {
        // Regular paragraph. Handle line breaks within a paragraph.
        html += `<p>${inlineFormat(para.replace(/\n/g, " "))}</p>`;
      }
    });
    return html;
  }

  function inlineFormat(text) {
    text = escapeHtml(text);
    // Bold: **text**
    text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    // Italic: *text*
    text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");
    return text;
  }

  // ── Language toggle ───────────────────────────────────────────

  function applyLang(lang) {
    if (!contentEl) return;
    contentEl.classList.remove("faith-lang-en", "faith-lang-la", "faith-lang-parallel");
    contentEl.classList.add(`faith-lang-${lang}`);

    if (langToggle) {
      const btns = langToggle.querySelectorAll("[data-lang]");
      for (let i = 0; i < btns.length; i++) {
        btns[i].setAttribute("aria-pressed", btns[i].getAttribute("data-lang") === lang ? "true" : "false");
      }
    }
  }

  function restoreLang() {
    try {
      const stored = localStorage.getItem(LANG_KEY);
      if (stored === "en" || stored === "la" || stored === "parallel") return stored;
    } catch (_) {}
    return "en";
  }

  function saveLang(lang) {
    try { localStorage.setItem(LANG_KEY, lang); } catch (_) {}
  }

  if (langToggle) {
    langToggle.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-lang]");
      if (!btn) return;
      currentLang = btn.getAttribute("data-lang");
      applyLang(currentLang);
      saveLang(currentLang);
    });
  }

  // ── Expand / collapse all ─────────────────────────────────────
  // Works with the existing toggle from faith-received.js (initReadingControls).
  // But because faith-received.js may init before our content is rendered,
  // we re-wire the expand toggle here to also cover dynamically added sections.

  const expandToggle = document.querySelector("[data-faith-expand-toggle]");
  if (expandToggle) {
    expandToggle.addEventListener("click", () => {
      const expanded = expandToggle.getAttribute("aria-pressed") === "true";
      const allDetails = contentEl.querySelectorAll(".faith-section-details, .faith-book-details");
      for (let i = 0; i < allDetails.length; i++) {
        allDetails[i].open = expanded;
      }
    });
  }

  // ── Continue Reading ──────────────────────────────────────────

  function saveLastRead() {
    if (!meta || !slug) return;
    try {
      localStorage.setItem(LASTREAD_KEY, JSON.stringify({
        slug,
        title: meta.title || "",
        author: meta.author || "",
        page: 1,
        ts: Date.now(),
      }));
    } catch (_) {}
  }

  // ── UI helpers ────────────────────────────────────────────────

  function showError(msg) {
    if (loadingEl) loadingEl.hidden = true;
    if (errorEl) {
      errorEl.hidden = false;
      const textEl = errorEl.querySelector(".faith-reader-error-text");
      if (textEl) textEl.textContent = msg;
    }
    if (titleEl) titleEl.textContent = "The Faith Received";
    const tocLoading = tocNav && tocNav.querySelector(".faith-toc-loading");
    if (tocLoading) tocLoading.hidden = true;
  }

  function hideLoading() {
    if (loadingEl) loadingEl.hidden = true;
  }

  // ── Utility ───────────────────────────────────────────────────

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function toRoman(num) {
    const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
    const syms = ["M","CM","D","CD","C","XC","L","XL","X","IX","V","IV","I"];
    let result = "";
    for (let i = 0; i < vals.length; i++) {
      while (num >= vals[i]) {
        result += syms[i];
        num -= vals[i];
      }
    }
    return result;
  }
})();
