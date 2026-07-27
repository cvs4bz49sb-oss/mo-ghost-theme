/*
 * The Faith Received — Dynamic Reader
 *
 * Powers the /the-faith-received/reader/?w=slug route. Fetches work
 * metadata from the corpus CDN, populates the header, builds the TOC,
 * renders parallel Latin/English text with language toggle,
 * collapsible sections, and continue-reading state.
 *
 * Loading model: meta.json only, up front. Page text is fetched per
 * 100-page shard when a section is first opened, and cached in
 * pageStore so re-opening costs nothing. The corpus is 1,195 works /
 * 785,437 pages / 5.6 GB — an earlier version Promise.all'd every
 * shard before first paint, which meant 27 MB to open Duns Scotus.
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

  // ── Read work + corpus from query string ──────────────────────
  let slug = "";
  let corpusId = "tfr";
  try {
    const q = new URLSearchParams(window.location.search);
    slug = q.get("w") || "";
    corpusId = (q.get("c") || "tfr").replace(/[^a-z0-9_-]/gi, "");
  } catch (_) {}
  slug = slug.replace(/[^a-z0-9_-]/gi, "");

  if (!slug) {
    showError("No work specified. Add ?w=slug-name to the URL.");
    return;
  }

  // The registry says how this corpus stores its text. Absent (or an
  // unknown ?c=), fall back to the page-shard reader.
  const corpus = (window.MOCorpora && window.MOCorpora.get(corpusId)) || null;
  const readerKind = corpus ? corpus.reader : "shards";

  // Collections whose text is not reachable yet must say so. Falling
  // through to the shard reader made them fetch a work id against the
  // Latin corpus's paths and fail with a bare "meta 404" — a 63,000-
  // work trapdoor, since search still indexes them.
  if (corpus && corpus.readable === false) {
    showPending(corpus);
    return;
  }

  // ── State ─────────────────────────────────────────────────────
  let meta = null;
  let currentLang = restoreLang();

  // Page store, filled lazily. Keyed by page number so repeated shard
  // loads are idempotent and sections can look up their own range.
  const pageStore = new Map();
  // shard file → Promise, so two sections needing the same shard share
  // one request instead of racing.
  const shardPromises = new Map();

  // ── Boot ──────────────────────────────────────────────────────
  // The Latin/English/Parallel switch only means something where a
  // work actually has two lanes. EEBO is English throughout.
  if (readerKind === "gz-toc" && langToggle) {
    langToggle.hidden = true;
    currentLang = "en";
  }
  applyLang(currentLang);
  fetchWork();

  // ── Fetch meta ────────────────────────────────────────────────
  //
  // Only meta.json is fetched up front. Page text is pulled per shard
  // when a section is actually opened — the corpus runs to 5.6 GB and
  // the largest works (Duns Scotus, Dionysius Cartusianus) are ~27 MB
  // across ~50 shards. Loading a whole work to show its first chapter
  // is the single worst thing this reader could do.

  function fetchWork() {
    if (readerKind === "gz-toc") return fetchGzToc();
    const metaUrl = `${BASE}/v1/works/${slug}/meta.json`;
    fetch(metaUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`meta ${r.status}`);
        return r.json();
      })
      .then((m) => {
        meta = m;
        populateHeader(m);
        buildToc(m.structure || []);
        renderContent(m);
        hideLoading();
        saveLastRead();
        openInitialSection();
      })
      .catch((err) => {
        showError(`Could not load this work. (${err.message || err})`);
      });
  }

  // ── EEBO: gzipped {meta, toc} ─────────────────────────────────
  //
  // Early English Books ships one gzipped JSON per work — a metadata
  // block and a nested contents tree whose nodes carry their own HTML.
  // Works are small (single-digit KB gzipped), so unlike the Latin
  // corpus there is nothing to shard: one fetch is the whole book.

  function fetchGzToc() {
    const url = corpus.textBase + encodeURIComponent(slug) + (corpus.textSuffix || "");
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`work ${r.status}`);
        return gunzip(r);
      })
      .then((data) => {
        const m = data.meta || {};
        meta = {
          title: m.title,
          author: m.author,
          date: m.year ? String(m.year) : "",
          description: [m.place, m.publisher, m.extent].filter(Boolean).join(" · "),
        };
        populateHeader(meta);
        const nodes = data.toc || [];
        buildTocLinks(nodes);
        renderTocTree(nodes);
        hideLoading();
        saveLastRead();
        openInitialSection();
      })
      .catch((err) => {
        showError(`Could not load this work. (${err.message || err})`);
      });
  }

  // DecompressionStream is the native path; fall back to letting the
  // CDN's own content negotiation handle it where it isn't supported.
  function gunzip(response) {
    if (typeof window.DecompressionStream === "function") {
      return response.blob().then((blob) => {
        const stream = blob.stream().pipeThrough(new window.DecompressionStream("gzip"));
        return new Response(stream).json();
      });
    }
    return response.json();
  }

  // EEBO gets its own contents rail. buildToc() groups a flat outline
  // into books and chapters and only links the chapters — right for
  // the Latin corpus, wrong here, where roughly half of works are a
  // flat list of sections and the other half nest two deep. Every node
  // gets a link; depth is carried as indentation.
  function buildTocLinks(nodes) {
    if (!tocNav) return;
    const loadNote = tocNav.querySelector(".faith-toc-loading");
    if (loadNote) loadNote.remove();
    if (!nodes.length) return;

    const ol = document.createElement("ol");
    ol.className = "faith-toc-list faith-toc-book-list";
    let counter = 0;

    (function walk(list, depth) {
      list.forEach((n) => {
        counter += 1;
        const li = document.createElement("li");
        li.className = "faith-toc-item";
        if (depth) li.style.paddingLeft = `${depth * 14}px`;
        li.innerHTML =
          `<a href="#section-${counter}">` +
          `<span class="faith-toc-label">${escapeHtml(n.label || `Section ${counter}`)}</span></a>`;
        ol.appendChild(li);
        if (n.kids && n.kids.length) walk(n.kids, depth + 1);
      });
    })(nodes, 0);

    tocNav.appendChild(ol);
  }

  // Render the contents tree directly. Text is already in hand, so
  // sections are filled at build time rather than hydrated on open.
  function renderTocTree(nodes) {
    if (!contentEl) return;
    contentEl.innerHTML = "";
    let counter = 0;

    function sectionFor(node, depth) {
      counter += 1;
      const details = document.createElement("details");
      details.className = "faith-section-details faith-book-chapter";
      details.id = `section-${counter}`;
      details.dataset.frState = "loaded";

      const summary = document.createElement("summary");
      summary.className = "faith-section-summary";
      summary.innerHTML =
        `<div class="faith-section-summary-inner">` +
        `<h2 class="faith-section-title"><em>${escapeHtml(node.label || "Untitled")}</em></h2>` +
        `</div><span class="faith-chev" aria-hidden="true"></span>`;
      details.appendChild(summary);

      const body = document.createElement("div");
      body.className = "faith-section-body article-content";
      if (node.html) body.innerHTML = sanitize(node.html);
      (node.kids || []).forEach((kid) => body.appendChild(sectionFor(kid, depth + 1)));
      details.appendChild(body);
      return details;
    }

    nodes.forEach((n) => contentEl.appendChild(sectionFor(n, 0)));
  }

  // EEBO-TCP markup is third-party HTML. DOMPurify ships in the boot
  // bundle; if it somehow isn't there, fall back to text so a missing
  // sanitizer can never become an injection.
  function sanitize(html) {
    if (window.DOMPurify && typeof window.DOMPurify.sanitize === "function") {
      return window.DOMPurify.sanitize(html);
    }
    const d = document.createElement("div");
    d.textContent = html;
    return d.innerHTML;
  }

  // ── Shard loading ─────────────────────────────────────────────

  // Normalized shard list: [{ file, from, to }]. Single-file works are
  // modelled as one shard spanning every page so the rest of the code
  // has exactly one path to reason about.
  function shardList(m) {
    if (m.shards && m.shards.length) {
      return m.shards.map((s, i) => {
        if (typeof s === "string") {
          // Legacy shape: no page range. Assume 100-page blocks.
          return { file: s, from: i * 100 + 1, to: (i + 1) * 100 };
        }
        return { file: s.file, from: s.from, to: s.to };
      });
    }
    return [{
      file: m.single || "work.json",
      from: 1,
      to: m.n_pages || Infinity,
    }];
  }

  // Which shards overlap the half-open page range [from, to)?
  function shardsFor(m, from, to) {
    return shardList(m).filter((s) => {
      return s.from < to && s.to >= from;
    });
  }

  function loadShard(shard) {
    if (shardPromises.has(shard.file)) return shardPromises.get(shard.file);
    const p = fetch(`${BASE}/v1/works/${slug}/${shard.file}`)
      .then((r) => {
        if (!r.ok) throw new Error(`shard ${shard.file} ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const arr = Array.isArray(data) ? data : (data.pages || []);
        arr.forEach((pg) => {
          if (pg && pg.n != null && !pageStore.has(pg.n)) pageStore.set(pg.n, pg);
        });
        return arr;
      })
      .catch((err) => {
        // Drop the cached rejection so a later open can retry.
        shardPromises.delete(shard.file);
        throw err;
      });
    shardPromises.set(shard.file, p);
    return p;
  }

  // Load every shard covering [from, to), then return the pages in
  // that range, in order.
  function pagesInRange(from, to) {
    const needed = shardsFor(meta, from, to);
    return Promise.all(needed.map(loadShard)).then(() => {
      const out = [];
      pageStore.forEach((pg, n) => {
        if (n >= from && n < to) out.push(pg);
      });
      out.sort((a, b) => a.n - b.n);
      return out;
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

  function renderContent(m) {
    if (!contentEl) return;
    contentEl.innerHTML = "";

    const structure = m.structure || [];
    if (!structure.length) {
      // No outline. Don't render the whole work as one section — a
      // 4,965-page work would pull every shard on first open. Chunk it
      // into shard-sized spans so each opens independently.
      shardList(m).forEach((s) => {
        const to = s.to === Infinity ? (m.n_pages || 0) : s.to;
        const section = createSection(`Pages ${s.from}–${to}`, s.from, s.from, to + 1);
        contentEl.appendChild(section);
      });
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

    // Outlines usually start a few pages in — the title page,
    // dedication and preface sit before the first entry and would
    // otherwise be unreachable. Give them their own opening section.
    const firstPage = groups.length ? groups[0].entry.page : 1;
    if (firstPage > 1) {
      contentEl.appendChild(
        createSection("Front matter", 1, 1, firstPage)
      );
    }

    if (allFlat) {
      // Flat: each structure entry is a section.
      groups.forEach((g, i) => {
        const startPage = g.entry.page;
        const endPage = (i + 1 < groups.length) ? groups[i + 1].entry.page : lastPage();
        const section = createSection(g.entry.title, startPage, startPage, endPage);
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
          // A book often carries text of its own before its first
          // chapter starts — a preface, or an untitled opening run.
          // Without this the span [book.page, firstChild.page) is
          // rendered nowhere; on the Acts of Trent that silently
          // dropped pages 773–878.
          if (g.children[0].page > g.entry.page) {
            bookBody.appendChild(
              createSection(g.entry.title, g.entry.page, g.entry.page, g.children[0].page)
            );
          }
          g.children.forEach((ch, ci) => {
            const startPage = ch.page;
            // End page: next child, or next book, or end of work.
            let endPage = lastPage();
            if (ci + 1 < g.children.length) {
              endPage = g.children[ci + 1].page;
            } else if (gi + 1 < groups.length) {
              endPage = groups[gi + 1].entry.page;
            }
            const section = createSection(ch.title, ch.page, startPage, endPage);
            bookBody.appendChild(section);
          });
        } else {
          // Book with no children: render the book's own pages.
          const bookStart = g.entry.page;
          const bookEnd = (gi + 1 < groups.length) ? groups[gi + 1].entry.page : lastPage();
          const section = createSection(g.entry.title, g.entry.page, bookStart, bookEnd);
          bookBody.appendChild(section);
        }

        bookEl.appendChild(bookBody);
        contentEl.appendChild(bookEl);
      });
    }
  }

  // Upper bound for the final section. Deliberately open-ended rather
  // than meta.n_pages + 1: that field is occasionally short by a page
  // or two (Magdeburg Centuriae 1b reports 343 and has text on 344),
  // and a tight bound silently drops the tail. Costs nothing extra —
  // shardsFor only returns shards at or after the section's start.
  function lastPage() {
    return Number.MAX_SAFE_INTEGER;
  }

  // Builds the collapsed shell only. The text arrives on first open,
  // via hydrateSection.
  function createSection(title, page, fromPage, toPage) {
    const details = document.createElement("details");
    details.className = "faith-section-details faith-book-chapter";
    details.id = `section-${page}`;
    details.setAttribute("data-from", fromPage);
    // Ranges are half-open. Consecutive outline entries frequently
    // share a start page (two chapters opening on p. 8), which yields
    // an empty [8,8) span — across the corpus that silently blanked
    // ~22% of all sections, and over half of some works. Guarantee at
    // least the section's own page; a shared page shows in both.
    details.setAttribute("data-to", Math.max(toPage, fromPage + 1));

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
    details.appendChild(body);

    // `toggle` fires for user clicks and for programmatic .open = true,
    // so expand-all hydrates through this same path.
    details.addEventListener("toggle", () => {
      if (details.open) hydrateSection(details);
    });

    return details;
  }

  function hydrateSection(details) {
    if (details.dataset.frState === "loaded" || details.dataset.frState === "loading") return;
    const from = parseInt(details.getAttribute("data-from"), 10);
    const to = parseInt(details.getAttribute("data-to"), 10);
    const body = details.querySelector(".faith-section-body");
    if (!body || isNaN(from) || isNaN(to)) return;

    details.dataset.frState = "loading";
    body.innerHTML = `<p class="faith-section-loading">Loading&hellip;</p>`;

    pagesInRange(from, to)
      .then((sectionPages) => {
        body.innerHTML = "";
        if (!sectionPages.length) {
          body.innerHTML = `<p class="faith-section-loading">No text on these pages.</p>`;
          details.dataset.frState = "loaded";
          return;
        }
        sectionPages.forEach((p) => {
          body.appendChild(buildPageBlock(p));
        });
        details.dataset.frState = "loaded";
      })
      .catch((err) => {
        details.dataset.frState = "";
        body.innerHTML =
          `<p class="faith-section-error">Could not load these pages. ` +
          `<button type="button" class="faith-retry" data-faith-retry>Retry</button></p>`;
        const retry = body.querySelector("[data-faith-retry]");
        if (retry) retry.addEventListener("click", () => hydrateSection(details));
        if (window.console) window.console.warn("faith-reader:", err);
      });
  }

  function buildPageBlock(p) {
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
    return block;
  }

  // Open a section (and its ancestor book) and scroll to it. Clicking
  // a TOC link only moves the viewport — a closed <details> stays
  // closed and unhydrated — so the reader drives it explicitly.
  function revealSection(hash, scroll) {
    let target = null;
    try { target = hash && contentEl.querySelector(hash); } catch (_) {}
    if (!target) return false;
    let parent = target.parentElement;
    while (parent && parent !== contentEl) {
      if (parent.tagName === "DETAILS") parent.open = true;
      parent = parent.parentElement;
    }
    target.open = true;
    if (scroll) target.scrollIntoView({ block: "start" });
    return true;
  }

  // Open the section a deep link points at (#section-N), else the
  // first one, so the reader never lands on a wall of closed rows.
  function openInitialSection() {
    if (window.location.hash && revealSection(window.location.hash, true)) return;
    const first = contentEl.querySelector(".faith-section-details");
    if (first) revealSection(`#${first.id}`, false);
  }

  if (tocNav) {
    tocNav.addEventListener("click", (e) => {
      const link = e.target.closest('a[href^="#section-"]');
      if (!link) return;
      revealSection(link.getAttribute("href"), true);
    });
  }

  window.addEventListener("hashchange", () => {
    revealSection(window.location.hash, true);
  });

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
        corpus: corpusId,
        title: meta.title || "",
        author: meta.author || "",
        page: 1,
        ts: Date.now(),
      }));
    } catch (_) {}
  }

  // ── UI helpers ────────────────────────────────────────────────

  // A work we can name and place, but cannot yet open. Distinct from
  // an error: nothing has gone wrong, the text simply isn't ported.
  function showPending(c) {
    if (loadingEl) loadingEl.hidden = true;
    if (titleEl) titleEl.textContent = c.label;
    if (dekEl) dekEl.textContent = c.short || "";
    if (traditionEl) traditionEl.hidden = true;
    if (langToggle) langToggle.hidden = true;
    const controls = document.querySelector("[data-faith-controls]");
    if (controls) controls.hidden = true;
    const tocLoading = tocNav && tocNav.querySelector(".faith-toc-loading");
    if (tocLoading) tocLoading.textContent = "Contents not yet available.";
    if (!contentEl) return;
    contentEl.innerHTML =
      `<div class="faith-pending-panel">` +
      `<p class="faith-pending-lede">This work is catalogued and indexed, but its text is still being ported into The Faith Received.</p>` +
      `<p class="faith-pending-note">${escapeHtml(c.label)} &mdash; ${escapeHtml(c.short || "")}</p>` +
      `<p class="faith-pending-actions">` +
      `<a href="/the-faith-received/?collection=${encodeURIComponent(c.id)}">Browse ${escapeHtml(c.label)}</a>` +
      `<a href="/the-faith-received/">The Faith Received</a>` +
      `</p></div>`;
  }

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
