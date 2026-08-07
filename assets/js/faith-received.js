/*
 * The Faith Received — frontend.
 *
 * One file, several feature areas:
 *   1. Search page (fuse.js over assets/data/faith-received/search-index.json)
 *   2. Scripture index (assets/data/faith-received/scripture-index.json)
 *   3. Today's reading (assets/data/faith-received/today.json, day-of-year)
 *   4. Modernizer toggle on document pages (placeholder — no docs ship
 *      with a modernized variant yet, button stays hidden until data
 *      includes one)
 *
 * Email signup forms reuse the global inline-signup.js (data-inline-signup)
 * so this file does not duplicate that flow.
 *
 * Each feature is self-bounded — the file safely no-ops if its
 * required DOM elements aren't on the page.
 */

(function () {
  "use strict";

  const DATA_BASE = "/assets/data/faith-received";

  // ── 1. Search ─────────────────────────────────────────────────
  initSearch();

  function initSearch() {
    const input = document.querySelector("[data-faith-search-input]");
    const results = document.querySelector("[data-faith-search-results]");
    const status = document.querySelector("[data-faith-search-status]");
    const empty = document.querySelector("[data-faith-search-empty]");
    const form = document.querySelector("[data-faith-search]");
    if (!input || !results) return;

    let index = null;
    let fuse = null;
    let loading = null;

    function ensureIndex() {
      if (fuse) return Promise.resolve(fuse);
      if (loading) return loading;
      loading = fetch(window.moAssetUrl(`${DATA_BASE}/search-index.json`), { credentials: "same-origin" })
        .then((r) => {
          if (!r.ok) throw new Error("Search index failed to load.");
          return r.json();
        })
        .then((data) => {
          index = data;
          fuse = new window.Fuse(index, {
            keys: [
              { name: "title", weight: 3 },
              { name: "snippet", weight: 1.2 },
              { name: "body", weight: 0.8 },
              { name: "author", weight: 1 },
            ],
            threshold: 0.36,
            ignoreLocation: true,
            minMatchCharLength: 2,
            includeScore: true,
          });
          window.__tfrSearchAppend = function (entries) {
            index.push(...entries);
            fuse.setCollection(index);
          };
          return fuse;
        })
        .catch((err) => {
          if (status) {
            status.textContent = err.message || "Search is unavailable.";
            status.classList.add("is-error");
          }
          throw err;
        });
      return loading;
    }

    function run(q) {
      const query = String(q || "").trim();
      if (query.length < 2) {
        results.innerHTML = "";
        if (empty) empty.hidden = true;
        if (status) status.textContent = "Type at least two characters to search.";
        return;
      }
      if (status) status.textContent = "Searching…";
      ensureIndex().then(() => {
        const hits = fuse.search(query, { limit: 50 });
        renderResults(hits, query);
      });
    }

    function renderResults(hits, query) {
      // Telemetry fires here, after a real render, rather than on a timer.
      // The search index is ~1.6 MB and must load and build before the first
      // query resolves, so any fixed delay reports a cold search as
      // zero-result — which would file successful searches into the
      // "searched for, not found" list the dashboard leads with. This also
      // catches the live-as-you-type path and ?q= deep links, neither of
      // which submits the form.
      try {
        document.dispatchEvent(
          new CustomEvent("mo:faith-search", {
            detail: { query, count: hits.length, capped: hits.length >= 50 },
          })
        );
      } catch (_) {
        /* telemetry must never break search */
      }
      results.innerHTML = "";
      if (!hits.length) {
        if (empty) empty.hidden = false;
        if (status) status.textContent = `No results for "${escapeHtml(query)}".`;
        return;
      }
      if (empty) empty.hidden = true;
      if (status) {
        status.textContent =
          hits.length === 1 ? "1 result." : `${hits.length} results.`;
      }
      const frag = document.createDocumentFragment();
      hits.forEach((h) => {
        const {item} = h;
        const li = document.createElement("li");
        li.className = "faith-search-hit";
        const typeLabel = (item.type || "result").replace(/^./, (c) => {
          return c.toUpperCase();
        });
        // encodeURI does NOT strip javascript:, so we run through
        // MOSafeHref.sanitize first. Bad scheme → empty string → the
        // href becomes harmless.
        li.innerHTML =
          `<a href="${ 
          escapeHtml(window.MOSafeHref.sanitize(item.url, "#")) 
          }" class="faith-search-hit-link">` +
          `<p class="faith-search-hit-meta"><span class="faith-search-hit-type">${ 
          escapeHtml(typeLabel) 
          }</span>${ 
          item.author
            ? ` <span class="faith-search-hit-author">${ 
              escapeHtml(item.author) 
              }</span>`
            : "" 
          }</p>` +
          `<h3 class="faith-search-hit-title"><em>${ 
          escapeHtml(item.title) 
          }</em></h3>${ 
          item.snippet
            ? `<p class="faith-search-hit-snippet">${ 
              highlight(escapeHtml(item.snippet), query) 
              }</p>`
            : "" 
          }${item.body
            ? `<p class="faith-search-hit-body">${ 
              highlight(escapeHtml(item.body), query) 
              }</p>`
            : "" 
          }</a>`;
        frag.appendChild(li);
      });
      results.appendChild(frag);
    }

    function highlight(text, q) {
      if (!q) return text;
      try {
        const re = new RegExp(
          `(${ 
            q
              .split(/\s+/)
              .filter(Boolean)
              .map((t) => {
                return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
              })
              .join("|") 
            })`,
          "ig"
        );
        return text.replace(re, "<mark>$1</mark>");
      } catch (_) {
        return text;
      }
    }

    let inputDebounce = 0;
    input.addEventListener("input", () => {
      clearTimeout(inputDebounce);
      inputDebounce = setTimeout(() => {
        run(input.value);
      }, 80);
    });
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        run(input.value);
      });
    }

    // Pre-fetch the index on first focus (before the visitor types) so
    // search latency on the very first character is hidden.
    let prefetched = false;
    input.addEventListener("focus", () => {
      if (prefetched) return;
      prefetched = true;
      ensureIndex();
    });

    // Support ?q= deep-links.
    try {
      const qParam = new URLSearchParams(window.location.search).get("q");
      if (qParam) {
        input.value = qParam;
        run(qParam);
      }
    } catch (_) {}
  }

  // ── 2. Scripture index ────────────────────────────────────────
  //
  // Moved to assets/js/faith-indexes.js. It used to read the
  // theme-local scripture-index.json, which covered only the 69
  // curated English works; the index now spans every collection and
  // is served from MO's R2. Both renderers briefly ran at once and
  // the tab showed two stacked scripture indexes.

  // ── 3. Today's reading ────────────────────────────────────────
  initToday();

  function initToday() {
    const card = document.querySelector("[data-faith-today-card]");
    const status = document.querySelector("[data-faith-today-status]");
    const dateEl = document.querySelector("[data-faith-today-date]");
    const sourceEl = document.querySelector("[data-faith-today-source]");
    const titleEl = document.querySelector("[data-faith-today-title]");
    const contentEl = document.querySelector("[data-faith-today-content]");
    const linkEl = document.querySelector("[data-faith-today-link]");
    if (!card || !status) return;

    const now = new Date();
    const dayOfYear = computeDayOfYear(now);

    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }

    fetch(window.moAssetUrl(`${DATA_BASE}/today.json`), { credentials: "same-origin" })
      .then((r) => {
        if (!r.ok) throw new Error("Today's reading is unavailable.");
        return r.json();
      })
      .then((plan) => {
        if (!plan || !plan.length) {
          status.textContent = "Today's reading is unavailable.";
          return;
        }
        const pick = plan[dayOfYear % plan.length];
        const labelParts = (pick.label || "").split(" · ");
        if (sourceEl) sourceEl.textContent = labelParts[0] || "";
        if (titleEl) titleEl.textContent = labelParts.slice(1).join(" · ");
        if (linkEl) linkEl.setAttribute("href", pick.url);
        // Pull the actual passage text from the document partial via a
        // hidden scrape: fetch the document HTML, find the matching
        // anchor, render its content. Cheaper than maintaining a third
        // copy of all the texts.
        if (contentEl) {
          fetch(pick.url, { credentials: "same-origin" })
            .then((r) => { return r.ok ? r.text() : ""; })
            .then((html) => {
              if (!html) return;
              const anchor = pick.url.split("#")[1];
              if (!anchor) return;
              const parser = new DOMParser();
              const doc = parser.parseFromString(html, "text/html");
              const node = doc.getElementById(anchor);
              if (!node) return;
              const body = node.querySelector(".faith-section-body, .faith-qa-answer, .faith-edwards-text, .faith-thesis-text");
              // Codex audit 2026-05-11: even same-origin HTML should
              // be DOMPurify'd before innerHTML — if a Faith Received
              // page is ever compromised it becomes a stored XSS sink
              // for every dashboard that paints from it. Fail closed
              // to textContent if DOMPurify didn't load.
              if (body) {
                contentEl.innerHTML = window.DOMPurify
                  ? window.DOMPurify.sanitize(body.innerHTML)
                  : (body.textContent || "").trim().slice(0, 600);
              } else contentEl.textContent = (node.textContent || "").trim().slice(0, 600);
            });
        }
        status.hidden = true;
        card.hidden = false;
      })
      .catch((err) => {
        status.textContent = err.message || "Today's reading is unavailable.";
        status.classList.add("is-error");
      });
  }

  function computeDayOfYear(d) {
    const start = new Date(d.getFullYear(), 0, 0);
    const diff = d - start + (start.getTimezoneOffset() - d.getTimezoneOffset()) * 60000;
    return Math.floor(diff / 86400000);
  }

  // ── Scripture reference popovers ──────────────────────────────
  // Each `<button data-faith-verse data-book="…" data-reference="…">`
  // in a Q&A's references list opens a popover with the verse text
  // fetched from bolls.life (CSB17, public Bible API). Cached
  // per (book, reference) so repeat clicks are instant.
  initScripturePopovers();

  function initScripturePopovers() {
    const refs = document.querySelectorAll("[data-faith-verse]");
    if (!refs.length) return;

    let popover = null;
    let popoverContent = null;
    let arrow = null;
    let currentTrigger = null;
    const cache = new Map();

    const BOOK_NUMBERS = {
      "Genesis": 1, "Exodus": 2, "Leviticus": 3, "Numbers": 4, "Deuteronomy": 5,
      "Joshua": 6, "Judges": 7, "Ruth": 8, "1 Samuel": 9, "2 Samuel": 10,
      "1 Kings": 11, "2 Kings": 12, "1 Chronicles": 13, "2 Chronicles": 14,
      "Ezra": 15, "Nehemiah": 16, "Esther": 17, "Job": 18, "Psalms": 19, "Psalm": 19,
      "Proverbs": 20, "Ecclesiastes": 21, "Song of Solomon": 22,
      "Isaiah": 23, "Jeremiah": 24, "Lamentations": 25, "Ezekiel": 26, "Daniel": 27,
      "Hosea": 28, "Joel": 29, "Amos": 30, "Obadiah": 31, "Jonah": 32, "Micah": 33,
      "Nahum": 34, "Habakkuk": 35, "Zephaniah": 36, "Haggai": 37, "Zechariah": 38,
      "Malachi": 39, "Matthew": 40, "Mark": 41, "Luke": 42, "John": 43, "Acts": 44,
      "Romans": 45, "1 Corinthians": 46, "2 Corinthians": 47, "Galatians": 48,
      "Ephesians": 49, "Philippians": 50, "Colossians": 51,
      "1 Thessalonians": 52, "2 Thessalonians": 53,
      "1 Timothy": 54, "2 Timothy": 55, "Titus": 56, "Philemon": 57,
      "Hebrews": 58, "James": 59, "1 Peter": 60, "2 Peter": 61,
      "1 John": 62, "2 John": 63, "3 John": 64, "Jude": 65, "Revelation": 66,
    };

    function ensurePopover() {
      if (popover) return;
      popover = document.createElement("div");
      popover.className = "faith-verse-popover";
      popover.setAttribute("role", "dialog");
      popover.setAttribute("aria-live", "polite");
      popover.hidden = true;
      popover.innerHTML =
        '<p class="faith-verse-popover-ref" data-faith-verse-ref></p>' +
        '<p class="faith-verse-popover-translation">Christian Standard Bible</p>' +
        '<p class="faith-verse-popover-text" data-faith-verse-text></p>' +
        '<span class="faith-verse-popover-arrow" data-faith-verse-arrow aria-hidden="true"></span>';
      popoverContent = popover.querySelector("[data-faith-verse-text]");
      arrow = popover.querySelector("[data-faith-verse-arrow]");
      document.body.appendChild(popover);
    }

    function parseReference(reference) {
      const m = String(reference || "").match(/(\d+):(\d+)(?:-(\d+))?/);
      if (!m) return null;
      return {
        chapter: parseInt(m[1], 10),
        startVerse: parseInt(m[2], 10),
        endVerse: m[3] ? parseInt(m[3], 10) : parseInt(m[2], 10),
      };
    }

    function stripHtml(html) {
      return String(html || "")
        .replace(/<[^>]*>/g, "")
        .replace(/\[\d+\]/g, "")
        .replace(/[Ⓐ-ⓩ①-⑳⓪]/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();
    }

    function setStatus(msg) {
      popoverContent.textContent = msg;
      popoverContent.classList.remove("is-loaded");
    }

    function setText(text) {
      popoverContent.textContent = text;
      popoverContent.classList.add("is-loaded");
    }

    function loadVerse(book, reference) {
      const key = (`${book}|${reference}`).toLowerCase();
      if (cache.has(key)) {
        setText(cache.get(key));
        return;
      }
      const bookNum = BOOK_NUMBERS[book];
      const parsed = parseReference(reference);
      if (!bookNum || !parsed) {
        setStatus("Could not load verse text.");
        return;
      }
      setStatus("Loading…");
      fetch(`https://bolls.life/get-text/CSB17/${bookNum}/${parsed.chapter}/`)
        .then((r) => { return r.ok ? r.json() : Promise.reject(); })
        .then((verses) => {
          const picked = (verses || [])
            .filter((v) => { return v.verse >= parsed.startVerse && v.verse <= parsed.endVerse; })
            .map((v) => { return stripHtml(v.text); })
            .join(" ");
          if (!picked) throw new Error("empty");
          cache.set(key, picked);
          setText(picked);
        })
        .catch(() => {
          setStatus("Could not load verse text.");
        });
    }

    function position(trigger) {
      const rect = trigger.getBoundingClientRect();
      const popoverWidth = window.innerWidth < 640 ? 280 : 320;
      const padding = 14;
      const triggerCenter = rect.left + rect.width / 2;

      let left = triggerCenter - popoverWidth / 2;
      if (left < padding) left = padding;
      if (left + popoverWidth > window.innerWidth - padding) {
        left = window.innerWidth - padding - popoverWidth;
      }

      let arrowPct = ((triggerCenter - left) / popoverWidth) * 100;
      arrowPct = Math.max(8, Math.min(92, arrowPct));
      arrow.style.left = `${arrowPct}%`;

      // Default: position above the trigger.
      const top = rect.top + window.scrollY - 14; // 14px gap above
      popover.classList.remove("is-below");
      // Once rendered we know the popover height; flip below if no
      // room above.
      popover.style.left = `${left}px`;
      popover.style.top = `${top}px`;
      // Use translateY(-100%) so `top` aligns to the popover's
      // bottom edge.
      popover.style.transform = "translateY(-100%)";
      // After paint, check if it's clipped above the viewport.
      requestAnimationFrame(() => {
        const pop = popover.getBoundingClientRect();
        if (pop.top < 12) {
          // Flip below.
          popover.classList.add("is-below");
          popover.style.transform = "translateY(0)";
          popover.style.top = `${rect.bottom + window.scrollY + 14}px`;
        }
      });
    }

    function open(trigger) {
      ensurePopover();
      currentTrigger = trigger;
      const book = trigger.getAttribute("data-book") || "";
      const reference = trigger.getAttribute("data-reference") || "";
      popover.querySelector("[data-faith-verse-ref]").textContent = reference;
      setStatus("Loading…");
      popover.hidden = false;
      // Defer a frame so the browser sees the hidden→visible flip
      // and animates if we add a transition.
      requestAnimationFrame(() => { popover.classList.add("is-open"); });
      position(trigger);
      loadVerse(book, reference);
      trigger.setAttribute("aria-expanded", "true");
    }

    function close() {
      if (!popover) return;
      popover.classList.remove("is-open");
      // Hide after the transition.
      setTimeout(() => { if (!popover.classList.contains("is-open")) popover.hidden = true; }, 180);
      if (currentTrigger) currentTrigger.setAttribute("aria-expanded", "false");
      currentTrigger = null;
    }

    document.addEventListener("click", (e) => {
      const trigger = e.target && e.target.closest && e.target.closest("[data-faith-verse]");
      if (trigger) {
        e.preventDefault();
        e.stopPropagation();
        if (currentTrigger === trigger) close();
        else open(trigger);
        return;
      }
      // Click outside an open popover closes it.
      if (currentTrigger && popover && !popover.contains(e.target)) close();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && currentTrigger) close();
    });

    function reposition() { if (currentTrigger) position(currentTrigger); }
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
  }

  // ── Section copy + link actions ───────────────────────────────
  // For every section/article/chapter/Q&A, inject a small action
  // row at the bottom: "Link" copies a deep link to that anchor;
  // "Copy" copies the section's text content (with scripture refs
  // when present). Match the original TFR pattern.
  initSectionActions();

  function initSectionActions() {
    if (!navigator.clipboard) return;
    // Every readable unit gets its own Copy link / Copy passage row.
    // Includes: collapsibles (sections, articles, chapters, Lord's
    // Days, library books, library chapters, Westminster Larger
    // Q&A, topic rows), flat sections (creeds), Q&A rows (Westminster
    // Shorter, Heidelberg's nested Q&A), and the smaller numbered
    // units (95 Theses, Edwards' Resolutions).
    const targets = document.querySelectorAll(
      ".faith-doc .faith-section-details, " +
      ".faith-doc .faith-doc-inner > .faith-section, " +
      ".faith-doc .faith-qa, " +
      ".faith-doc .faith-thesis, " +
      ".faith-doc .faith-edwards-item, " +
      ".faith-doc .faith-book-details, " +
      ".faith-doc .faith-topic-row-details"
    );
    Array.prototype.forEach.call(targets, (target) => {
      if (!target.id) return;
      // Don't double-inject if we've already added actions.
      if (target.querySelector(":scope > .faith-section-actions, :scope > .faith-section-body > .faith-section-actions, :scope > .faith-book-body > .faith-section-actions, :scope > .faith-topic-row-body > .faith-section-actions")) {
        return;
      }
      const actions = buildActionsRow(target);
      if (!actions) return;
      // Where to inject: at the END of the body (for collapsibles)
      // or at the END of the section (for flat).
      if (target.classList.contains("faith-section-details")) {
        const body = target.querySelector(":scope > .faith-section-body");
        if (body) {
          // If the section contains Q&A cards, each Q&A injects its
          // own action row — skip the section-level row so the user
          // doesn't see two stacked copy bars per card.
          if (body.querySelector(":scope > .faith-qa")) return;
          body.appendChild(actions);
        }
      } else if (target.classList.contains("faith-book-details")) {
        const bbody = target.querySelector(":scope > .faith-book-body");
        if (bbody) bbody.appendChild(actions);
      } else if (target.classList.contains("faith-topic-row-details")) {
        // Topic rows lazy-load their body; inject the actions row
        // only after the body has content. Listen for the toggle
        // event and append on first open.
        target.addEventListener("toggle", function inject() {
          if (!target.open) return;
          const tbody = target.querySelector(":scope > .faith-topic-row-body");
          if (!tbody || tbody.querySelector(":scope > .faith-section-actions")) return;
          // Wait one tick for the lazy-fetch to populate, then inject.
          setTimeout(() => {
            if (!tbody.querySelector(":scope > .faith-section-actions")) {
              tbody.appendChild(buildActionsRow(target));
            }
          }, 100);
        });
      } else {
        target.appendChild(actions);
      }
    });
  }

  function buildActionsRow(section) {
    const url = `${location.origin + location.pathname}#${section.id}`;
    const actions = document.createElement("div");
    actions.className = "faith-section-actions";
    actions.innerHTML =
      `<button type="button" class="faith-section-action" data-faith-copy-link>${ 
        iconLink()}<span class="faith-section-action-label">Copy link</span>` +
      `</button>` +
      `<button type="button" class="faith-section-action" data-faith-copy-text>${ 
        iconCopy()}<span class="faith-section-action-label">Copy passage</span>` +
      `</button>`;
    actions.querySelector("[data-faith-copy-link]").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      navigator.clipboard.writeText(url).then(() => { flashCopied(e.currentTarget); });
    });
    actions.querySelector("[data-faith-copy-text]").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      navigator.clipboard.writeText(extractCopyText(section)).then(() => { flashCopied(e.currentTarget); });
    });
    return actions;
  }

  function flashCopied(btn) {
    const label = btn.querySelector(".faith-section-action-label");
    if (!label) return;
    const prev = label.textContent;
    label.textContent = "Copied";
    btn.classList.add("is-copied");
    setTimeout(() => {
      label.textContent = prev;
      btn.classList.remove("is-copied");
    }, 1600);
  }

  function extractCopyText(section) {
    // Pull a clean text representation regardless of section shape.
    // Strip every UI artifact (action rows, chev icons, popover,
    // toggle buttons), replace verse-ref <button>s with plain text
    // references, then assemble: numeral/eyebrow + title + body +
    // scripture refs.
    const clone = section.cloneNode(true);
    const noise = clone.querySelectorAll(
      ".faith-section-actions, .faith-chev, .faith-verse-popover, " +
      ".faith-section-action, .faith-verse-sep, " +
      ".faith-topic-row-continue, " +
      "[data-modernizer-toggle]"
    );
    Array.prototype.forEach.call(noise, (n) => { n.remove(); });
    const verseBtns = clone.querySelectorAll("[data-faith-verse]");
    Array.prototype.forEach.call(verseBtns, (b) => {
      b.replaceWith(document.createTextNode(b.textContent));
    });
    const lines = [];
    function pushTrim(text) {
      const t = String(text || "").replace(/\s+/g, " ").trim();
      if (t) lines.push(t);
    }
    // Numeral / eyebrow — covers section, Q&A, Lord's Day, thesis,
    // edwards, library book, topic row.
    const numeral = clone.querySelector(
      ".faith-section-numeral, .faith-qa-number, .faith-lords-day-numeral, " +
      ".faith-thesis-number, .faith-edwards-number, " +
      ".faith-part-eyebrow, .faith-topic-row-label"
    );
    // Title / heading.
    const title = clone.querySelector(
      ".faith-section-title, .faith-qa-question, " +
      ".faith-book-title, .faith-topic-row-snippet"
    );
    if (numeral) pushTrim(numeral.textContent);
    if (title) pushTrim(title.textContent);
    // Body — broadest selector for any reading-content container.
    const body = clone.querySelector(
      ".faith-section-body, .faith-qa-answer, " +
      ".faith-thesis-text, .faith-edwards-text, " +
      ".faith-book-body, .faith-topic-row-body"
    );
    if (body) {
      const refsInBody = body.querySelector(".faith-qa-references");
      if (refsInBody) refsInBody.remove();
      const paras = body.querySelectorAll("p, li");
      if (paras.length) {
        Array.prototype.forEach.call(paras, (p) => { pushTrim(p.textContent); });
      } else {
        pushTrim(body.textContent);
      }
    } else {
      // Theses + Edwards items have no .faith-section-body wrapper —
      // the text is a direct sibling of the number. Pull whatever's
      // left after numeral/title removal.
      const fallback = clone.querySelector(
        ".faith-thesis-text, .faith-edwards-text"
      );
      if (fallback) pushTrim(fallback.textContent);
    }
    const refs = clone.querySelector(".faith-qa-references");
    if (refs) {
      const refText = refs.textContent.replace(/^Scripture\s*/i, "").trim();
      if (refText) lines.push(`Scripture: ${refText}`);
    }
    return lines.join("\n\n");
  }

  function iconLink() {
    return '<svg class="faith-section-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>';
  }
  function iconCopy() {
    return '<svg class="faith-section-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  }

  // ── Mobile TOC drawer ─────────────────────────────────────────
  // On mobile the .faith-toc-sidebar is fixed-positioned off-canvas
  // and slides in via the .is-open class. Toggle from the "Contents"
  // button in the doc header; close on backdrop click, the close
  // button, Escape, or any TOC link click (so a tap navigates and
  // closes in one move).
  initTocDrawer();

  function initTocDrawer() {
    const drawer = document.querySelector("[data-faith-toc-drawer]");
    const toggle = document.querySelector("[data-faith-toc-toggle]");
    if (!drawer || !toggle) return;
    const close = drawer.querySelector("[data-faith-toc-close]");
    const backdrop = document.querySelector("[data-faith-toc-backdrop]");

    function isMobile() {
      return window.matchMedia("(max-width: 1023px)").matches;
    }

    function open() {
      if (!isMobile()) return;
      drawer.classList.add("is-open");
      if (backdrop) {
        backdrop.classList.add("is-open");
        backdrop.hidden = false;
      }
      document.body.classList.add("faith-toc-open");
      toggle.setAttribute("aria-expanded", "true");
    }
    function closeFn() {
      drawer.classList.remove("is-open");
      if (backdrop) backdrop.classList.remove("is-open");
      document.body.classList.remove("faith-toc-open");
      toggle.setAttribute("aria-expanded", "false");
      // Hide backdrop after the transition so it's not in the AT tree.
      if (backdrop) {
        setTimeout(() => {
          if (!backdrop.classList.contains("is-open")) backdrop.hidden = true;
        }, 320);
      }
    }

    toggle.addEventListener("click", () => {
      if (drawer.classList.contains("is-open")) closeFn();
      else open();
    });
    if (close) close.addEventListener("click", closeFn);
    if (backdrop) backdrop.addEventListener("click", closeFn);

    // Tap a TOC link → navigate, then close the drawer. Both happen
    // since we don't preventDefault — anchor scroll fires, drawer
    // closes after.
    drawer.addEventListener("click", (e) => {
      const a = e.target && e.target.closest && e.target.closest('a[href^="#"]');
      if (a) closeFn();
    });

    // Close on Escape.
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && drawer.classList.contains("is-open")) closeFn();
    });

    // If the viewport flips to desktop while the drawer is open
    // (rotate, resize), un-stick the body scroll lock.
    window.addEventListener("resize", () => {
      if (!isMobile() && drawer.classList.contains("is-open")) closeFn();
    });
  }

  // ── Topic-page row lazy expansion ────────────────────────────
  // Each <details data-faith-topic-row> on a topic page opens to
  // show the full passage from the source document. Rather than
  // inlining every passage into the topic partial (which inflates
  // the theme deploy substantially), the JS fetches the source HTML
  // on first open, extracts the matching anchor's content, and
  // injects it. Cached per-source so opening 5 Heidelberg passages
  // hits the network once.
  initTopicRowExpansion();

  function initTopicRowExpansion() {
    const rows = document.querySelectorAll("[data-faith-topic-row]");
    if (!rows.length) return;
    const pageCache = new Map();

    function fetchSource(url) {
      if (pageCache.has(url)) return pageCache.get(url);
      const p = fetch(url, { credentials: "same-origin" })
        .then((r) => { return r.ok ? r.text() : ""; })
        .then((html) => {
          if (!html) return null;
          const parser = new DOMParser();
          return parser.parseFromString(html, "text/html");
        })
        .catch(() => { return null; });
      pageCache.set(url, p);
      return p;
    }

    function extractPassage(doc, anchor) {
      if (!doc || !anchor) return "";
      const node = doc.getElementById(anchor);
      if (!node) return "";
      // The "passage" — pick the right element shape depending on
      // what the anchor points to.
      const body = node.querySelector(".faith-section-body, .faith-qa-answer");
      if (body) {
        // Strip section-actions injected client-side on the source page.
        const clone = body.cloneNode(true);
        clone.querySelectorAll(".faith-section-actions").forEach((n) => { n.remove(); });
        // Codex audit 2026-05-11: pipe through DOMPurify before
        // returning HTML for innerHTML insertion (see callers in
        // load() / topic-row render). Fall back to textContent if
        // DOMPurify is unavailable.
        return window.DOMPurify
          ? window.DOMPurify.sanitize(clone.innerHTML)
          : (clone.textContent || "");
      }
      // Fallback for theses / Edwards items where the whole node is
      // the passage.
      if (node.classList.contains("faith-thesis") ||
          node.classList.contains("faith-edwards-item")) {
        const p = node.querySelector(".faith-thesis-text, .faith-edwards-text");
        if (p) {
          const inner = window.DOMPurify
            ? window.DOMPurify.sanitize(p.innerHTML)
            : (p.textContent || "");
          return `<p>${inner}</p>`;
        }
      }
      return "";
    }

    function load(row) {
      const url = row.getAttribute("data-source-url") || "";
      const anchor = row.getAttribute("data-source-anchor") || "";
      const body = row.querySelector("[data-faith-topic-body]");
      if (!body || row.dataset.faithLoaded === "1") return;
      const pageUrl = url.split("#")[0];
      fetchSource(pageUrl).then((doc) => {
        const html = extractPassage(doc, anchor);
        if (html) {
          body.innerHTML = html;
        } else {
          body.innerHTML = '<p class="faith-topic-row-fallback">Could not load passage. Open the source document instead.</p>';
        }
        row.dataset.faithLoaded = "1";
      });
    }

    Array.prototype.forEach.call(rows, (row) => {
      row.addEventListener("toggle", () => {
        if (row.open) load(row);
      });
    });
  }

  // ── Topic page: tradition / period filters ───────────────────
  // Filter buttons show/hide document groups based on data-tradition
  // and data-period attributes. "All" resets the filter.
  initTopicFilters();

  function initTopicFilters() {
    const filterBar = document.querySelector("[data-faith-topic-filters]");
    if (!filterBar) return;
    const groups = document.querySelectorAll(".faith-topic-group[data-tradition]");
    if (!groups.length) return;

    let activeTradition = "all";
    let activePeriod = "all";

    function applyFilters() {
      Array.prototype.forEach.call(groups, (g) => {
        const traditions = (g.getAttribute("data-tradition") || "").split(" ");
        const period = g.getAttribute("data-period") || "";
        const showTradition = activeTradition === "all" || traditions.indexOf(activeTradition) >= 0;
        const showPeriod = activePeriod === "all" || period === activePeriod;
        if (showTradition && showPeriod) {
          g.removeAttribute("hidden");
        } else {
          g.setAttribute("hidden", "");
        }
      });
    }

    filterBar.addEventListener("click", (e) => {
      const btn = e.target.closest(".faith-filter-pill");
      if (!btn) return;

      const tradition = btn.getAttribute("data-filter-tradition");
      const period = btn.getAttribute("data-filter-period");

      if (tradition !== null && tradition !== undefined) {
        activeTradition = tradition;
        // Update active state for tradition pills
        const group = btn.closest(".faith-filter-group");
        Array.prototype.forEach.call(group.querySelectorAll("[data-filter-tradition]"), (p) => {
          p.classList.toggle("is-active", p.getAttribute("data-filter-tradition") === tradition);
        });
      }
      if (period !== null && period !== undefined) {
        activePeriod = period;
        const group2 = btn.closest(".faith-filter-group");
        Array.prototype.forEach.call(group2.querySelectorAll("[data-filter-period]"), (p) => {
          p.classList.toggle("is-active", p.getAttribute("data-filter-period") === period);
        });
      }

      applyFilters();
    });
  }

  // ── Sidebar active-section tracking ──────────────────────────
  // As the reader scrolls, mark the top-most visible section's TOC
  // link with `is-active` so the sidebar shows where they are. Uses
  // IntersectionObserver, so no scroll listeners burning the main
  // thread.
  initActiveSection();

  function initActiveSection() {
    const sidebar = document.querySelector(".faith-toc-sidebar");
    if (!sidebar || !("IntersectionObserver" in window)) return;
    const anchors = Array.prototype.slice.call(sidebar.querySelectorAll('a[href^="#"]'));
    if (!anchors.length) return;
    // Map of id → anchor element.
    const byId = {};
    anchors.forEach((a) => {
      const id = decodeURIComponent((a.getAttribute("href") || "").slice(1));
      if (id) byId[id] = a;
    });
    const ids = Object.keys(byId);
    if (!ids.length) return;
    const visible = new Set();
    const observer = new IntersectionObserver(((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) visible.add(e.target.id);
        else visible.delete(e.target.id);
      });
      // Pick the visible section closest to the top of the viewport.
      let best = null;
      let bestTop = Infinity;
      ids.forEach((id) => {
        if (!visible.has(id)) return;
        const node = document.getElementById(id);
        if (!node) return;
        const {top} = node.getBoundingClientRect();
        if (top < bestTop) { bestTop = top; best = id; }
      });
      anchors.forEach((a) => { a.classList.remove("is-active"); });
      if (best && byId[best]) {
        byId[best].classList.add("is-active");
        // No auto-scroll — the sidebar is static (scrolls with the
        // page), so calling scrollIntoView on a sidebar link would
        // scroll the whole page back up to wherever that link sits
        // in the document, fighting the reader's own scrolling. Keep
        // the active-state highlight; let the page scroll be theirs.
      }
    }), {
      rootMargin: "-80px 0px -60% 0px",
      threshold: 0,
    });
    ids.forEach((id) => {
      const node = document.getElementById(id);
      if (node) observer.observe(node);
    });
  }

  // ── 4. Reading controls (Expand all / Collapse all) ───────────
  initReadingControls();

  function initReadingControls() {
    const controls = document.querySelector("[data-faith-controls]");
    if (!controls) return;
    const details = function () {
      return Array.prototype.slice.call(
        document.querySelectorAll(".faith-doc-body .faith-section-details")
      );
    };
    const toggle = controls.querySelector("[data-faith-expand-toggle]");
    if (toggle) {
      toggle.addEventListener("click", () => {
        const expanded = toggle.getAttribute("aria-pressed") !== "true";
        toggle.setAttribute("aria-pressed", String(expanded));
        const label = toggle.querySelector(".faith-toggle-label");
        if (label) label.textContent = expanded ? label.dataset.on : label.dataset.off;
        details().forEach((d) => { d.open = expanded; });
      });
    }
  }

  // ── 4b. View toggle (Heidelberg: Lord's Day / Section / Memorize) ──
  // All three tabs flip [data-faith-view] on the wrapper. CSS keys
  // off that attribute to swap which [data-faith-view-content] block
  // is visible. In section view the LD <details> are forced open so
  // each Part reads as a continuous body of text. Memorize swaps to
  // its own content block on the same page (no navigation away).
  initViewToggle();

  function initViewToggle() {
    const nav = document.querySelector("[data-faith-view-toggle]");
    if (!nav) return;
    const wrapper = document.querySelector("[data-faith-view]");
    if (!wrapper) return;
    const tabs = nav.querySelectorAll(".faith-view-toggle-tab[data-faith-view-target]");
    const partSummaries = document.querySelectorAll("[data-faith-part-summary]");
    const contentBlocks = wrapper.querySelectorAll("[data-faith-view-content]");

    const layout = wrapper.closest(".faith-doc-layout");

    function setView(view) {
      wrapper.setAttribute("data-faith-view", view);
      // Layout class drives sidebar/reading-controls visibility in CSS.
      if (layout) layout.classList.toggle("is-memorize-view", view === "memorize");
      Array.prototype.forEach.call(tabs, (t) => {
        const on = t.getAttribute("data-faith-view-target") === view;
        t.classList.toggle("is-active", on);
        t.setAttribute("aria-pressed", on ? "true" : "false");
      });
      // Show the matching content block, hide the rest. "lords-day"
      // and "section" share the "reading" content block (DOM is the
      // same; CSS swaps presentation via [data-faith-view]).
      const contentKey = view === "memorize" ? "memorize" : "reading";
      Array.prototype.forEach.call(contentBlocks, (b) => {
        const match = b.getAttribute("data-faith-view-content") === contentKey;
        if (match) b.removeAttribute("hidden");
        else b.setAttribute("hidden", "");
      });
      const lds = document.querySelectorAll(".faith-lords-day-details");
      if (view === "section") {
        // In section view the Part containers themselves collapse.
        // Default each Part closed so the reader sees the three Part
        // headings before drilling in. LDs inside auto-open so the
        // Part reads continuously when the reader does open it.
        Array.prototype.forEach.call(partSummaries, (s) => {
          s.setAttribute("aria-expanded", "false");
          const part = s.closest(".faith-heidelberg-part");
          if (part) part.classList.remove("is-open");
        });
        Array.prototype.forEach.call(lds, (d) => { d.open = true; });
      } else if (view === "lords-day") {
        // Lord's Day view: Part containers are inert headers; LDs
        // collapse back to default so the reader picks one to read.
        Array.prototype.forEach.call(partSummaries, (s) => {
          s.setAttribute("aria-expanded", "true");
          const part = s.closest(".faith-heidelberg-part");
          if (part) part.classList.add("is-open");
        });
        Array.prototype.forEach.call(lds, (d) => { d.open = false; });
      }
    }

    Array.prototype.forEach.call(tabs, (t) => {
      t.addEventListener("click", (e) => {
        e.preventDefault();
        const view = t.getAttribute("data-faith-view-target");
        if (view) setView(view);
      });
    });

    // Part summaries are clickable in section view, inert in LD view.
    // The CSS gates pointer-events; the JS handles the toggle.
    Array.prototype.forEach.call(partSummaries, (s) => {
      s.addEventListener("click", () => {
        if (wrapper.getAttribute("data-faith-view") !== "section") return;
        const part = s.closest(".faith-heidelberg-part");
        if (!part) return;
        const open = !part.classList.contains("is-open");
        part.classList.toggle("is-open", open);
        s.setAttribute("aria-expanded", open ? "true" : "false");
      });
    });

    // Initial state: LD view, all Parts marked open (visible) so the
    // page renders content immediately.
    setView("lords-day");
  }

  // ── 5. Auto-open <details> when its anchor is targeted ───────
  // A reader clicking a TOC link to #chapter-3 (or arriving at the URL
  // with the hash already present) needs the matching <details> to
  // open, otherwise the scroll lands on a closed accordion row and
  // nothing's visible.
  initAnchorOpener();

  function initAnchorOpener() {
    function openTarget() {
      const hash = window.location.hash || "";
      if (!hash || hash.length < 2) return;
      const id = hash.slice(1);
      let node;
      try { node = document.getElementById(decodeURIComponent(id)); }
      catch (_) { node = document.getElementById(id); }
      if (!node) return;
      // Walk up: open every <details> ancestor (and the target itself
      // if it IS a <details>).
      let cur = node;
      while (cur && cur !== document.body) {
        if (cur.tagName === "DETAILS") cur.open = true;
        cur = cur.parentNode;
      }
      // Re-trigger scroll after open so the browser lands on the
      // element's new (post-open) position.
      requestAnimationFrame(() => {
        try { node.scrollIntoView({ behavior: "smooth", block: "start" }); }
        catch (_) { node.scrollIntoView(); }
      });
    }
    window.addEventListener("hashchange", openTarget);
    if (window.location.hash) {
      // Defer one frame so the rest of the page is parsed first.
      requestAnimationFrame(openTarget);
    }
    // Intercept clicks on in-page anchor links (TOC items, scripture
    // refs, etc.) so the open-target runs before the scroll lands.
    document.addEventListener("click", (e) => {
      const a = e.target && e.target.closest && e.target.closest("a[href^='#']");
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (href.length < 2) return;
      // Let the browser handle history; we'll catch the hashchange.
      // But also pre-open synchronously so smooth scroll lands right.
      setTimeout(openTarget, 0);
    });
  }

  // ── 6. Force-open every <details> before printing ─────────────
  // CSS can fake "show inner content even when closed" but the
  // <summary> + body still render as separate visual blocks. The
  // cleanest print result is to actually flip every details open
  // before the print preview captures the page, then restore prior
  // state after.
  initPrintHandler();

  function initPrintHandler() {
    let saved = null;
    function openAll() {
      const ds = document.querySelectorAll(".faith-doc details");
      saved = [];
      Array.prototype.forEach.call(ds, (d) => {
        saved.push({ node: d, wasOpen: d.open });
        d.open = true;
      });
    }
    function restore() {
      if (!saved) return;
      saved.forEach((s) => { s.node.open = s.wasOpen; });
      saved = null;
    }
    window.addEventListener("beforeprint", openAll);
    window.addEventListener("afterprint", restore);
    // Some browsers (older Safari) don't fire beforeprint. Hook into
    // matchMedia as a fallback.
    if (window.matchMedia) {
      try {
        const mq = window.matchMedia("print");
        if (typeof mq.addEventListener === "function") {
          mq.addEventListener("change", (e) => {
            if (e.matches) openAll();
            else restore();
          });
        }
      } catch (_) {}
    }
  }

  // ── 7. Modernizer toggle ──────────────────────────────────────
  // Ported from cvs4bz49sb-oss/heidelberg/lib/modernize.ts via
  // assets/js/faith-modernize.js. Dictionary + pattern-based archaic
  // English → modern English engine, deterministic, runs entirely
  // client-side. Detect whether any prose on the page contains
  // archaic forms ("Thou hast", "saith", "-eth" verbs, etc.); if so,
  // unhide the toggle button so the reader can flip between Original
  // and Modern English.
  initModernizer();

  function initModernizer() {
    const toggle = document.querySelector("[data-modernizer-toggle]");
    if (!toggle || !window.FaithModernize) return;
    const FM = window.FaithModernize;

    // Targets: every prose-bearing element. `.article-content` is the
    // shared class on all prose containers (section bodies, prayer
    // cards, QA answers, topic rows, front-matter). The three
    // standalone selectors cover elements that sit outside an
    // article-content wrapper. Scoped to `.faith-doc` so nav/UI
    // text is never touched.
    const elements = Array.prototype.slice.call(document.querySelectorAll(
      ".faith-doc .article-content p, " +
      ".faith-doc .article-content li, " +
      ".faith-doc .faith-qa-question, " +
      ".faith-doc .faith-edwards-text, " +
      ".faith-doc .faith-edwards-preamble, " +
      ".faith-doc .faith-thesis-text"
    ));

    let hasArchaic = false;
    elements.forEach((el) => {
      // Snapshot the original HTML once so we can flip back without
      // reading text we already mutated.
      el._faithOriginalHTML = el.innerHTML;
      if (FM.hasArchaicLanguage(el.textContent || "")) hasArchaic = true;
    });
    if (!hasArchaic) return;

    toggle.hidden = false;
    toggle.addEventListener("click", () => {
      const nowOn = toggle.getAttribute("aria-pressed") !== "true";
      toggle.setAttribute("aria-pressed", String(nowOn));
      document.body.classList.toggle("faith-modernized", nowOn);
      const label = toggle.querySelector(".faith-toggle-label");
      if (label) label.textContent = nowOn ? label.dataset.on : label.dataset.off;

      elements.forEach((el) => {
        if (nowOn) {
          modernizeTextNodes(el);
        } else {
          el.innerHTML = el._faithOriginalHTML;
        }
      });
    });
  }

  // Walk every text node descendant of `root` and run the modernizer
  // on its value. Preserves element structure (verse-ref buttons,
  // <em>, <strong>, <a>, etc.).
  function modernizeTextNodes(root) {
    if (!window.FaithModernize) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walker.nextNode())) {
      const modern = window.FaithModernize.modernizeText(node.nodeValue);
      if (modern !== node.nodeValue) node.nodeValue = modern;
    }
  }

  // ── helpers ────────────────────────────────────────────────────
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
