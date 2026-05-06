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

  var DATA_BASE = "/assets/data/faith-received";

  // ── 1. Search ─────────────────────────────────────────────────
  initSearch();

  function initSearch() {
    var input = document.querySelector("[data-faith-search-input]");
    var results = document.querySelector("[data-faith-search-results]");
    var status = document.querySelector("[data-faith-search-status]");
    var empty = document.querySelector("[data-faith-search-empty]");
    var form = document.querySelector("[data-faith-search]");
    if (!input || !results) return;

    var index = null;
    var fuse = null;
    var loading = null;

    function ensureIndex() {
      if (fuse) return Promise.resolve(fuse);
      if (loading) return loading;
      loading = fetch(DATA_BASE + "/search-index.json", { credentials: "same-origin" })
        .then(function (r) {
          if (!r.ok) throw new Error("Search index failed to load.");
          return r.json();
        })
        .then(function (data) {
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
          return fuse;
        })
        .catch(function (err) {
          if (status) {
            status.textContent = err.message || "Search is unavailable.";
            status.classList.add("is-error");
          }
          throw err;
        });
      return loading;
    }

    function run(q) {
      var query = String(q || "").trim();
      if (query.length < 2) {
        results.innerHTML = "";
        if (empty) empty.hidden = true;
        if (status) status.textContent = "Type at least two characters to search.";
        return;
      }
      if (status) status.textContent = "Searching…";
      ensureIndex().then(function () {
        var hits = fuse.search(query, { limit: 50 });
        renderResults(hits, query);
      });
    }

    function renderResults(hits, query) {
      results.innerHTML = "";
      if (!hits.length) {
        if (empty) empty.hidden = false;
        if (status) status.textContent = 'No results for "' + escapeHtml(query) + '".';
        return;
      }
      if (empty) empty.hidden = true;
      if (status) {
        status.textContent =
          hits.length === 1 ? "1 result." : hits.length + " results.";
      }
      var frag = document.createDocumentFragment();
      hits.forEach(function (h) {
        var item = h.item;
        var li = document.createElement("li");
        li.className = "faith-search-hit";
        var typeLabel = (item.type || "result").replace(/^./, function (c) {
          return c.toUpperCase();
        });
        li.innerHTML =
          '<a href="' +
          encodeURI(item.url) +
          '" class="faith-search-hit-link">' +
          '<p class="faith-search-hit-meta"><span class="faith-search-hit-type">' +
          escapeHtml(typeLabel) +
          "</span>" +
          (item.author
            ? ' <span class="faith-search-hit-author">' +
              escapeHtml(item.author) +
              "</span>"
            : "") +
          "</p>" +
          '<h3 class="faith-search-hit-title"><em>' +
          escapeHtml(item.title) +
          "</em></h3>" +
          (item.snippet
            ? '<p class="faith-search-hit-snippet">' +
              highlight(escapeHtml(item.snippet), query) +
              "</p>"
            : "") +
          (item.body
            ? '<p class="faith-search-hit-body">' +
              highlight(escapeHtml(item.body), query) +
              "</p>"
            : "") +
          "</a>";
        frag.appendChild(li);
      });
      results.appendChild(frag);
    }

    function highlight(text, q) {
      if (!q) return text;
      try {
        var re = new RegExp(
          "(" +
            q
              .split(/\s+/)
              .filter(Boolean)
              .map(function (t) {
                return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
              })
              .join("|") +
            ")",
          "ig"
        );
        return text.replace(re, "<mark>$1</mark>");
      } catch (_) {
        return text;
      }
    }

    var inputDebounce = 0;
    input.addEventListener("input", function () {
      clearTimeout(inputDebounce);
      inputDebounce = setTimeout(function () {
        run(input.value);
      }, 80);
    });
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        run(input.value);
      });
    }

    // Pre-fetch the index on first focus (before the visitor types) so
    // search latency on the very first character is hidden.
    var prefetched = false;
    input.addEventListener("focus", function () {
      if (prefetched) return;
      prefetched = true;
      ensureIndex();
    });

    // Support ?q= deep-links.
    try {
      var qParam = new URLSearchParams(window.location.search).get("q");
      if (qParam) {
        input.value = qParam;
        run(qParam);
      }
    } catch (_) {}
  }

  // ── 2. Scripture index ────────────────────────────────────────
  initScripture();

  function initScripture() {
    var grid = document.querySelector("[data-faith-scripture-books]");
    var detail = document.querySelector("[data-faith-scripture-detail]");
    var detailTitle = document.querySelector("[data-faith-scripture-detail-title]");
    var detailRefs = document.querySelector("[data-faith-scripture-refs]");
    var back = document.querySelector("[data-faith-scripture-back]");
    var status = document.querySelector("[data-faith-scripture-status]");
    var tabs = document.querySelectorAll("[data-faith-scripture-tab]");
    if (!grid || !detail) return;

    var data = null;

    var OT = [
      "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
      "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
      "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles",
      "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
      "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah",
      "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
      "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah",
      "Haggai", "Zechariah", "Malachi",
    ];

    var current = "ot";

    fetch(DATA_BASE + "/scripture-index.json", { credentials: "same-origin" })
      .then(function (r) {
        if (!r.ok) throw new Error("Scripture index unavailable.");
        return r.json();
      })
      .then(function (d) {
        data = d;
        if (status) status.remove();
        renderBooks();
      })
      .catch(function (err) {
        if (status) {
          status.textContent = err.message || "Scripture index unavailable.";
          status.classList.add("is-error");
        }
      });

    function renderBooks() {
      if (!data) return;
      // Group references by book name from the index keys.
      var byBook = {};
      Object.keys(data.index || {}).forEach(function (passage) {
        var m = passage.match(/^(.+?)\s+\d/);
        if (!m) return;
        var book = m[1];
        byBook[book] = (byBook[book] || 0) + (data.index[passage] || []).length;
      });
      var books = (data.books || []).filter(function (b) {
        return current === "ot" ? OT.indexOf(b) > -1 : OT.indexOf(b) === -1;
      });
      grid.innerHTML = "";
      books.forEach(function (book) {
        var count = byBook[book] || 0;
        var el = document.createElement(count ? "a" : "div");
        el.className = "faith-scripture-book";
        if (count) {
          el.href = "#" + encodeURIComponent(book);
          el.addEventListener("click", function (e) {
            e.preventDefault();
            renderBook(book);
          });
        } else {
          el.classList.add("is-empty");
        }
        el.innerHTML =
          '<span class="faith-scripture-book-name">' +
          escapeHtml(book) +
          "</span>" +
          '<span class="faith-scripture-book-count">' +
          count +
          " refs</span>";
        grid.appendChild(el);
      });
    }

    function renderBook(book) {
      // Collect every reference whose passage starts with the book name.
      var refs = [];
      Object.keys(data.index || {}).forEach(function (passage) {
        var m = passage.match(/^(.+?)(\s+\d.*)$/);
        if (!m || m[1] !== book) return;
        (data.index[passage] || []).forEach(function (r) {
          refs.push(Object.assign({ passage: passage }, r));
        });
      });
      // Sort by chapter + verse if parseable.
      refs.sort(function (a, b) {
        return parseChapter(a.passage) - parseChapter(b.passage);
      });
      detailTitle.textContent = book;
      detailRefs.innerHTML = "";
      refs.forEach(function (r) {
        var li = document.createElement("li");
        li.className = "faith-scripture-ref";
        var url = sourceToUrl(r);
        li.innerHTML =
          '<a class="faith-scripture-ref-link" href="' +
          encodeURI(url) +
          '">' +
          '<span class="faith-scripture-ref-passage">' +
          escapeHtml(r.passage) +
          "</span>" +
          '<span class="faith-scripture-ref-source">' +
          escapeHtml(prettifySource(r.source || "")) +
          "</span>" +
          (r.title
            ? '<span class="faith-scripture-ref-title">' +
              escapeHtml(r.title) +
              "</span>"
            : "") +
          (r.excerpt
            ? '<span class="faith-scripture-ref-excerpt">' +
              escapeHtml(truncate(r.excerpt, 240)) +
              "</span>"
            : "") +
          "</a>";
        detailRefs.appendChild(li);
      });
      grid.hidden = true;
      detail.hidden = false;
    }

    function parseChapter(passage) {
      var m = passage.match(/(\d+)/);
      return m ? parseInt(m[1], 10) : 0;
    }

    function sourceToUrl(r) {
      // The heidelberg scripture-index uses TFR's id conventions
      // ("q6", "art-1", "sec-1", "ch1-p2"). Translate to the Ghost
      // theme's anchor formats: question → #q-N, article → #article-N,
      // section/chapter → matches the rendering. Per-source quirks
      // first because the right anchor depends on how each doc is
      // rendered (e.g. Lausanne renders sections as articles).
      var slug = r.source === "confession-1689" ? "1689" : (r.source || "");
      var id = r.id || "";
      var anchor = "";
      // Per-source: Lausanne sections render as articles in the Ghost theme.
      if (slug === "lausanne") {
        var lm = id.match(/^sec-(\d+)/);
        if (lm) anchor = "#article-" + lm[1];
      }
      if (!anchor) {
        var qm = id.match(/^q(\d+)/);
        var artm = id.match(/^art-(\d+)/);
        var secm = id.match(/^sec-(\d+)/);
        var cm = id.match(/^ch(?:apter)?-?(\d+)/);
        var resm = id.match(/^res-(\d+)/);
        var thm = id.match(/^thesis-(\d+)/);
        if (qm) anchor = "#q-" + qm[1];
        else if (artm) anchor = "#article-" + artm[1];
        else if (secm) anchor = "#section-" + secm[1];
        else if (cm) anchor = "#chapter-" + cm[1];
        else if (resm) anchor = "#resolution-" + resm[1];
        else if (thm) anchor = "#thesis-" + thm[1];
        else if (id) anchor = "#" + id;
      }
      return "/the-faith-received/" + slug + "/" + anchor;
    }

    function prettifySource(s) {
      return s
        .split("-")
        .map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); })
        .join(" ");
    }

    function truncate(s, n) {
      s = String(s || "").trim();
      return s.length > n ? s.slice(0, n) + "…" : s;
    }

    if (back) {
      back.addEventListener("click", function (e) {
        e.preventDefault();
        detail.hidden = true;
        grid.hidden = false;
      });
    }
    Array.prototype.forEach.call(tabs, function (btn) {
      btn.addEventListener("click", function () {
        Array.prototype.forEach.call(tabs, function (b) {
          b.classList.remove("is-active");
          b.setAttribute("aria-selected", "false");
        });
        btn.classList.add("is-active");
        btn.setAttribute("aria-selected", "true");
        current = btn.getAttribute("data-faith-scripture-tab");
        renderBooks();
      });
    });
  }

  // ── 3. Today's reading ────────────────────────────────────────
  initToday();

  function initToday() {
    var card = document.querySelector("[data-faith-today-card]");
    var status = document.querySelector("[data-faith-today-status]");
    var dateEl = document.querySelector("[data-faith-today-date]");
    var sourceEl = document.querySelector("[data-faith-today-source]");
    var titleEl = document.querySelector("[data-faith-today-title]");
    var contentEl = document.querySelector("[data-faith-today-content]");
    var linkEl = document.querySelector("[data-faith-today-link]");
    if (!card || !status) return;

    var now = new Date();
    var dayOfYear = computeDayOfYear(now);

    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }

    fetch(DATA_BASE + "/today.json", { credentials: "same-origin" })
      .then(function (r) {
        if (!r.ok) throw new Error("Today's reading is unavailable.");
        return r.json();
      })
      .then(function (plan) {
        if (!plan || !plan.length) {
          status.textContent = "Today's reading is unavailable.";
          return;
        }
        var pick = plan[dayOfYear % plan.length];
        var labelParts = (pick.label || "").split(" · ");
        if (sourceEl) sourceEl.textContent = labelParts[0] || "";
        if (titleEl) titleEl.textContent = labelParts.slice(1).join(" · ");
        if (linkEl) linkEl.setAttribute("href", pick.url);
        // Pull the actual passage text from the document partial via a
        // hidden scrape: fetch the document HTML, find the matching
        // anchor, render its content. Cheaper than maintaining a third
        // copy of all the texts.
        if (contentEl) {
          fetch(pick.url, { credentials: "same-origin" })
            .then(function (r) { return r.ok ? r.text() : ""; })
            .then(function (html) {
              if (!html) return;
              var anchor = pick.url.split("#")[1];
              if (!anchor) return;
              var parser = new DOMParser();
              var doc = parser.parseFromString(html, "text/html");
              var node = doc.getElementById(anchor);
              if (!node) return;
              var body = node.querySelector(".faith-section-body, .faith-qa-answer, .faith-edwards-text, .faith-thesis-text");
              if (body) contentEl.innerHTML = body.innerHTML;
              else contentEl.textContent = (node.textContent || "").trim().slice(0, 600);
            });
        }
        status.hidden = true;
        card.hidden = false;
      })
      .catch(function (err) {
        status.textContent = err.message || "Today's reading is unavailable.";
        status.classList.add("is-error");
      });
  }

  function computeDayOfYear(d) {
    var start = new Date(d.getFullYear(), 0, 0);
    var diff = d - start + (start.getTimezoneOffset() - d.getTimezoneOffset()) * 60000;
    return Math.floor(diff / 86400000);
  }

  // ── Scripture reference popovers ──────────────────────────────
  // Each `<button data-faith-verse data-book="…" data-reference="…">`
  // in a Q&A's references list opens a popover with the verse text
  // fetched from bolls.life (CSB17, public Bible API). Cached
  // per (book, reference) so repeat clicks are instant.
  initScripturePopovers();

  function initScripturePopovers() {
    var refs = document.querySelectorAll("[data-faith-verse]");
    if (!refs.length) return;

    var popover = null;
    var popoverContent = null;
    var arrow = null;
    var currentTrigger = null;
    var cache = new Map();

    var BOOK_NUMBERS = {
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
      var m = String(reference || "").match(/(\d+):(\d+)(?:-(\d+))?/);
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
      var key = (book + "|" + reference).toLowerCase();
      if (cache.has(key)) {
        setText(cache.get(key));
        return;
      }
      var bookNum = BOOK_NUMBERS[book];
      var parsed = parseReference(reference);
      if (!bookNum || !parsed) {
        setStatus("Could not load verse text.");
        return;
      }
      setStatus("Loading…");
      fetch("https://bolls.life/get-text/CSB17/" + bookNum + "/" + parsed.chapter + "/")
        .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
        .then(function (verses) {
          var picked = (verses || [])
            .filter(function (v) { return v.verse >= parsed.startVerse && v.verse <= parsed.endVerse; })
            .map(function (v) { return stripHtml(v.text); })
            .join(" ");
          if (!picked) throw new Error("empty");
          cache.set(key, picked);
          setText(picked);
        })
        .catch(function () {
          setStatus("Could not load verse text.");
        });
    }

    function position(trigger) {
      var rect = trigger.getBoundingClientRect();
      var popoverWidth = window.innerWidth < 640 ? 280 : 320;
      var padding = 14;
      var triggerCenter = rect.left + rect.width / 2;

      var left = triggerCenter - popoverWidth / 2;
      if (left < padding) left = padding;
      if (left + popoverWidth > window.innerWidth - padding) {
        left = window.innerWidth - padding - popoverWidth;
      }

      var arrowPct = ((triggerCenter - left) / popoverWidth) * 100;
      arrowPct = Math.max(8, Math.min(92, arrowPct));
      arrow.style.left = arrowPct + "%";

      // Default: position above the trigger.
      var top = rect.top + window.scrollY - 14; // 14px gap above
      popover.classList.remove("is-below");
      // Once rendered we know the popover height; flip below if no
      // room above.
      popover.style.left = left + "px";
      popover.style.top = top + "px";
      // Use translateY(-100%) so `top` aligns to the popover's
      // bottom edge.
      popover.style.transform = "translateY(-100%)";
      // After paint, check if it's clipped above the viewport.
      requestAnimationFrame(function () {
        var pop = popover.getBoundingClientRect();
        if (pop.top < 12) {
          // Flip below.
          popover.classList.add("is-below");
          popover.style.transform = "translateY(0)";
          popover.style.top = (rect.bottom + window.scrollY + 14) + "px";
        }
      });
    }

    function open(trigger) {
      ensurePopover();
      currentTrigger = trigger;
      var book = trigger.getAttribute("data-book") || "";
      var reference = trigger.getAttribute("data-reference") || "";
      popover.querySelector("[data-faith-verse-ref]").textContent = reference;
      setStatus("Loading…");
      popover.hidden = false;
      // Defer a frame so the browser sees the hidden→visible flip
      // and animates if we add a transition.
      requestAnimationFrame(function () { popover.classList.add("is-open"); });
      position(trigger);
      loadVerse(book, reference);
      trigger.setAttribute("aria-expanded", "true");
    }

    function close() {
      if (!popover) return;
      popover.classList.remove("is-open");
      // Hide after the transition.
      setTimeout(function () { if (!popover.classList.contains("is-open")) popover.hidden = true; }, 180);
      if (currentTrigger) currentTrigger.setAttribute("aria-expanded", "false");
      currentTrigger = null;
    }

    document.addEventListener("click", function (e) {
      var trigger = e.target && e.target.closest && e.target.closest("[data-faith-verse]");
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

    document.addEventListener("keydown", function (e) {
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
    var targets = document.querySelectorAll(
      ".faith-doc .faith-section-details, " +
      ".faith-doc .faith-doc-inner > .faith-section, " +
      ".faith-doc .faith-qa, " +
      ".faith-doc .faith-thesis, " +
      ".faith-doc .faith-edwards-item, " +
      ".faith-doc .faith-book-details, " +
      ".faith-doc .faith-topic-row-details"
    );
    Array.prototype.forEach.call(targets, function (target) {
      if (!target.id) return;
      // Don't double-inject if we've already added actions.
      if (target.querySelector(":scope > .faith-section-actions, :scope > .faith-section-body > .faith-section-actions, :scope > .faith-book-body > .faith-section-actions, :scope > .faith-topic-row-body > .faith-section-actions")) {
        return;
      }
      var actions = buildActionsRow(target);
      if (!actions) return;
      // Where to inject: at the END of the body (for collapsibles)
      // or at the END of the section (for flat).
      if (target.classList.contains("faith-section-details")) {
        var body = target.querySelector(":scope > .faith-section-body");
        if (body) body.appendChild(actions);
      } else if (target.classList.contains("faith-book-details")) {
        var bbody = target.querySelector(":scope > .faith-book-body");
        if (bbody) bbody.appendChild(actions);
      } else if (target.classList.contains("faith-topic-row-details")) {
        // Topic rows lazy-load their body; inject the actions row
        // only after the body has content. Listen for the toggle
        // event and append on first open.
        target.addEventListener("toggle", function inject() {
          if (!target.open) return;
          var tbody = target.querySelector(":scope > .faith-topic-row-body");
          if (!tbody || tbody.querySelector(":scope > .faith-section-actions")) return;
          // Wait one tick for the lazy-fetch to populate, then inject.
          setTimeout(function () {
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
    var url = location.origin + location.pathname + "#" + section.id;
    var actions = document.createElement("div");
    actions.className = "faith-section-actions";
    actions.innerHTML =
      '<button type="button" class="faith-section-action" data-faith-copy-link>' +
        iconLink() + '<span class="faith-section-action-label">Copy link</span>' +
      '</button>' +
      '<button type="button" class="faith-section-action" data-faith-copy-text>' +
        iconCopy() + '<span class="faith-section-action-label">Copy passage</span>' +
      '</button>';
    actions.querySelector("[data-faith-copy-link]").addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      navigator.clipboard.writeText(url).then(function () { flashCopied(e.currentTarget); });
    });
    actions.querySelector("[data-faith-copy-text]").addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      navigator.clipboard.writeText(extractCopyText(section)).then(function () { flashCopied(e.currentTarget); });
    });
    return actions;
  }

  function flashCopied(btn) {
    var label = btn.querySelector(".faith-section-action-label");
    if (!label) return;
    var prev = label.textContent;
    label.textContent = "Copied";
    btn.classList.add("is-copied");
    setTimeout(function () {
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
    var clone = section.cloneNode(true);
    var noise = clone.querySelectorAll(
      ".faith-section-actions, .faith-chev, .faith-verse-popover, " +
      ".faith-section-action, .faith-verse-sep, " +
      ".faith-topic-row-continue, " +
      "[data-modernizer-toggle]"
    );
    Array.prototype.forEach.call(noise, function (n) { n.remove(); });
    var verseBtns = clone.querySelectorAll("[data-faith-verse]");
    Array.prototype.forEach.call(verseBtns, function (b) {
      b.replaceWith(document.createTextNode(b.textContent));
    });
    var lines = [];
    function pushTrim(text) {
      var t = String(text || "").replace(/\s+/g, " ").trim();
      if (t) lines.push(t);
    }
    // Numeral / eyebrow — covers section, Q&A, Lord's Day, thesis,
    // edwards, library book, topic row.
    var numeral = clone.querySelector(
      ".faith-section-numeral, .faith-qa-number, .faith-lords-day-numeral, " +
      ".faith-thesis-number, .faith-edwards-number, " +
      ".faith-part-eyebrow, .faith-topic-row-label"
    );
    // Title / heading.
    var title = clone.querySelector(
      ".faith-section-title, .faith-qa-question, " +
      ".faith-book-title, .faith-topic-row-snippet"
    );
    if (numeral) pushTrim(numeral.textContent);
    if (title) pushTrim(title.textContent);
    // Body — broadest selector for any reading-content container.
    var body = clone.querySelector(
      ".faith-section-body, .faith-qa-answer, " +
      ".faith-thesis-text, .faith-edwards-text, " +
      ".faith-book-body, .faith-topic-row-body"
    );
    if (body) {
      var refsInBody = body.querySelector(".faith-qa-references");
      if (refsInBody) refsInBody.remove();
      var paras = body.querySelectorAll("p, li");
      if (paras.length) {
        Array.prototype.forEach.call(paras, function (p) { pushTrim(p.textContent); });
      } else {
        pushTrim(body.textContent);
      }
    } else {
      // Theses + Edwards items have no .faith-section-body wrapper —
      // the text is a direct sibling of the number. Pull whatever's
      // left after numeral/title removal.
      var fallback = clone.querySelector(
        ".faith-thesis-text, .faith-edwards-text"
      );
      if (fallback) pushTrim(fallback.textContent);
    }
    var refs = clone.querySelector(".faith-qa-references");
    if (refs) {
      var refText = refs.textContent.replace(/^Scripture\s*/i, "").trim();
      if (refText) lines.push("Scripture: " + refText);
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
    var drawer = document.querySelector("[data-faith-toc-drawer]");
    var toggle = document.querySelector("[data-faith-toc-toggle]");
    if (!drawer || !toggle) return;
    var close = drawer.querySelector("[data-faith-toc-close]");
    var backdrop = document.querySelector("[data-faith-toc-backdrop]");

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
        setTimeout(function () {
          if (!backdrop.classList.contains("is-open")) backdrop.hidden = true;
        }, 320);
      }
    }

    toggle.addEventListener("click", function () {
      if (drawer.classList.contains("is-open")) closeFn();
      else open();
    });
    if (close) close.addEventListener("click", closeFn);
    if (backdrop) backdrop.addEventListener("click", closeFn);

    // Tap a TOC link → navigate, then close the drawer. Both happen
    // since we don't preventDefault — anchor scroll fires, drawer
    // closes after.
    drawer.addEventListener("click", function (e) {
      var a = e.target && e.target.closest && e.target.closest('a[href^="#"]');
      if (a) closeFn();
    });

    // Close on Escape.
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && drawer.classList.contains("is-open")) closeFn();
    });

    // If the viewport flips to desktop while the drawer is open
    // (rotate, resize), un-stick the body scroll lock.
    window.addEventListener("resize", function () {
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
    var rows = document.querySelectorAll("[data-faith-topic-row]");
    if (!rows.length) return;
    var pageCache = new Map();

    function fetchSource(url) {
      if (pageCache.has(url)) return pageCache.get(url);
      var p = fetch(url, { credentials: "same-origin" })
        .then(function (r) { return r.ok ? r.text() : ""; })
        .then(function (html) {
          if (!html) return null;
          var parser = new DOMParser();
          return parser.parseFromString(html, "text/html");
        })
        .catch(function () { return null; });
      pageCache.set(url, p);
      return p;
    }

    function extractPassage(doc, anchor) {
      if (!doc || !anchor) return "";
      var node = doc.getElementById(anchor);
      if (!node) return "";
      // The "passage" — pick the right element shape depending on
      // what the anchor points to.
      var body = node.querySelector(".faith-section-body, .faith-qa-answer");
      if (body) {
        // Strip section-actions injected client-side on the source page.
        var clone = body.cloneNode(true);
        clone.querySelectorAll(".faith-section-actions").forEach(function (n) { n.remove(); });
        return clone.innerHTML;
      }
      // Fallback for theses / Edwards items where the whole node is
      // the passage.
      if (node.classList.contains("faith-thesis") ||
          node.classList.contains("faith-edwards-item")) {
        var p = node.querySelector(".faith-thesis-text, .faith-edwards-text");
        if (p) return "<p>" + p.innerHTML + "</p>";
      }
      return "";
    }

    function load(row) {
      var url = row.getAttribute("data-source-url") || "";
      var anchor = row.getAttribute("data-source-anchor") || "";
      var body = row.querySelector("[data-faith-topic-body]");
      if (!body || row.dataset.faithLoaded === "1") return;
      var pageUrl = url.split("#")[0];
      fetchSource(pageUrl).then(function (doc) {
        var html = extractPassage(doc, anchor);
        if (html) {
          body.innerHTML = html;
        } else {
          body.innerHTML = '<p class="faith-topic-row-fallback">Could not load passage. Open the source document instead.</p>';
        }
        row.dataset.faithLoaded = "1";
      });
    }

    Array.prototype.forEach.call(rows, function (row) {
      row.addEventListener("toggle", function () {
        if (row.open) load(row);
      });
    });
  }

  // ── Sidebar active-section tracking ──────────────────────────
  // As the reader scrolls, mark the top-most visible section's TOC
  // link with `is-active` so the sidebar shows where they are. Uses
  // IntersectionObserver, so no scroll listeners burning the main
  // thread.
  initActiveSection();

  function initActiveSection() {
    var sidebar = document.querySelector(".faith-toc-sidebar");
    if (!sidebar || !("IntersectionObserver" in window)) return;
    var anchors = Array.prototype.slice.call(sidebar.querySelectorAll('a[href^="#"]'));
    if (!anchors.length) return;
    // Map of id → anchor element.
    var byId = {};
    anchors.forEach(function (a) {
      var id = decodeURIComponent((a.getAttribute("href") || "").slice(1));
      if (id) byId[id] = a;
    });
    var ids = Object.keys(byId);
    if (!ids.length) return;
    var visible = new Set();
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) visible.add(e.target.id);
        else visible.delete(e.target.id);
      });
      // Pick the visible section closest to the top of the viewport.
      var best = null;
      var bestTop = Infinity;
      ids.forEach(function (id) {
        if (!visible.has(id)) return;
        var node = document.getElementById(id);
        if (!node) return;
        var top = node.getBoundingClientRect().top;
        if (top < bestTop) { bestTop = top; best = id; }
      });
      anchors.forEach(function (a) { a.classList.remove("is-active"); });
      if (best && byId[best]) {
        byId[best].classList.add("is-active");
        // No auto-scroll — the sidebar is static (scrolls with the
        // page), so calling scrollIntoView on a sidebar link would
        // scroll the whole page back up to wherever that link sits
        // in the document, fighting the reader's own scrolling. Keep
        // the active-state highlight; let the page scroll be theirs.
      }
    }, {
      rootMargin: "-80px 0px -60% 0px",
      threshold: 0,
    });
    ids.forEach(function (id) {
      var node = document.getElementById(id);
      if (node) observer.observe(node);
    });
  }

  // ── 4. Reading controls (Expand all / Collapse all) ───────────
  initReadingControls();

  function initReadingControls() {
    var controls = document.querySelector("[data-faith-controls]");
    if (!controls) return;
    var details = function () {
      return Array.prototype.slice.call(
        document.querySelectorAll(".faith-doc-body .faith-section-details")
      );
    };
    var expand = controls.querySelector("[data-faith-expand-all]");
    var collapse = controls.querySelector("[data-faith-collapse-all]");
    if (expand) {
      expand.addEventListener("click", function () {
        details().forEach(function (d) { d.open = true; });
      });
    }
    if (collapse) {
      collapse.addEventListener("click", function () {
        details().forEach(function (d) { d.open = false; });
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
    var nav = document.querySelector("[data-faith-view-toggle]");
    if (!nav) return;
    var wrapper = document.querySelector("[data-faith-view]");
    if (!wrapper) return;
    var tabs = nav.querySelectorAll(".faith-view-toggle-tab[data-faith-view-target]");
    var partSummaries = document.querySelectorAll("[data-faith-part-summary]");
    var contentBlocks = wrapper.querySelectorAll("[data-faith-view-content]");

    var layout = wrapper.closest(".faith-doc-layout");

    function setView(view) {
      wrapper.setAttribute("data-faith-view", view);
      // Layout class drives sidebar/reading-controls visibility in CSS.
      if (layout) layout.classList.toggle("is-memorize-view", view === "memorize");
      Array.prototype.forEach.call(tabs, function (t) {
        var on = t.getAttribute("data-faith-view-target") === view;
        t.classList.toggle("is-active", on);
        t.setAttribute("aria-pressed", on ? "true" : "false");
      });
      // Show the matching content block, hide the rest. "lords-day"
      // and "section" share the "reading" content block (DOM is the
      // same; CSS swaps presentation via [data-faith-view]).
      var contentKey = view === "memorize" ? "memorize" : "reading";
      Array.prototype.forEach.call(contentBlocks, function (b) {
        var match = b.getAttribute("data-faith-view-content") === contentKey;
        if (match) b.removeAttribute("hidden");
        else b.setAttribute("hidden", "");
      });
      var lds = document.querySelectorAll(".faith-lords-day-details");
      if (view === "section") {
        // In section view the Part containers themselves collapse.
        // Default each Part closed so the reader sees the three Part
        // headings before drilling in. LDs inside auto-open so the
        // Part reads continuously when the reader does open it.
        Array.prototype.forEach.call(partSummaries, function (s) {
          s.setAttribute("aria-expanded", "false");
          var part = s.closest(".faith-heidelberg-part");
          if (part) part.classList.remove("is-open");
        });
        Array.prototype.forEach.call(lds, function (d) { d.open = true; });
      } else if (view === "lords-day") {
        // Lord's Day view: Part containers are inert headers; LDs
        // collapse back to default so the reader picks one to read.
        Array.prototype.forEach.call(partSummaries, function (s) {
          s.setAttribute("aria-expanded", "true");
          var part = s.closest(".faith-heidelberg-part");
          if (part) part.classList.add("is-open");
        });
        Array.prototype.forEach.call(lds, function (d) { d.open = false; });
      }
    }

    Array.prototype.forEach.call(tabs, function (t) {
      t.addEventListener("click", function (e) {
        e.preventDefault();
        var view = t.getAttribute("data-faith-view-target");
        if (view) setView(view);
      });
    });

    // Part summaries are clickable in section view, inert in LD view.
    // The CSS gates pointer-events; the JS handles the toggle.
    Array.prototype.forEach.call(partSummaries, function (s) {
      s.addEventListener("click", function () {
        if (wrapper.getAttribute("data-faith-view") !== "section") return;
        var part = s.closest(".faith-heidelberg-part");
        if (!part) return;
        var open = !part.classList.contains("is-open");
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
      var hash = window.location.hash || "";
      if (!hash || hash.length < 2) return;
      var id = hash.slice(1);
      var node;
      try { node = document.getElementById(decodeURIComponent(id)); }
      catch (_) { node = document.getElementById(id); }
      if (!node) return;
      // Walk up: open every <details> ancestor (and the target itself
      // if it IS a <details>).
      var cur = node;
      while (cur && cur !== document.body) {
        if (cur.tagName === "DETAILS") cur.open = true;
        cur = cur.parentNode;
      }
      // Re-trigger scroll after open so the browser lands on the
      // element's new (post-open) position.
      requestAnimationFrame(function () {
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
    document.addEventListener("click", function (e) {
      var a = e.target && e.target.closest && e.target.closest("a[href^='#']");
      if (!a) return;
      var href = a.getAttribute("href") || "";
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
    var saved = null;
    function openAll() {
      var ds = document.querySelectorAll(".faith-doc details");
      saved = [];
      Array.prototype.forEach.call(ds, function (d) {
        saved.push({ node: d, wasOpen: d.open });
        d.open = true;
      });
    }
    function restore() {
      if (!saved) return;
      saved.forEach(function (s) { s.node.open = s.wasOpen; });
      saved = null;
    }
    window.addEventListener("beforeprint", openAll);
    window.addEventListener("afterprint", restore);
    // Some browsers (older Safari) don't fire beforeprint. Hook into
    // matchMedia as a fallback.
    if (window.matchMedia) {
      try {
        var mq = window.matchMedia("print");
        if (typeof mq.addEventListener === "function") {
          mq.addEventListener("change", function (e) {
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
    var toggle = document.querySelector("[data-modernizer-toggle]");
    if (!toggle || !window.FaithModernize) return;
    var FM = window.FaithModernize;

    // Targets: every prose-bearing element. We scope tightly to
    // avoid touching nav/UI text. The node walk inside each target
    // ignores nested element structure (e.g. verse-ref buttons stay
    // intact because we only modernize text nodes).
    var elements = Array.prototype.slice.call(document.querySelectorAll(
      ".faith-doc .faith-section-body p, " +
      ".faith-doc .faith-section-body li, " +
      ".faith-doc .faith-qa-answer p, " +
      ".faith-doc .faith-qa-question, " +
      ".faith-doc .faith-edwards-text, " +
      ".faith-doc .faith-thesis-text, " +
      ".faith-doc .faith-edwards-preamble, " +
      ".faith-doc .faith-topic-row-body p, " +
      ".faith-doc .faith-topic-row-body li, " +
      ".faith-doc .faith-topic-row-body .faith-qa-answer p"
    ));

    var hasArchaic = false;
    elements.forEach(function (el) {
      // Snapshot the original HTML once so we can flip back without
      // reading text we already mutated.
      el._faithOriginalHTML = el.innerHTML;
      if (FM.hasArchaicLanguage(el.textContent || "")) hasArchaic = true;
    });
    if (!hasArchaic) return;

    toggle.hidden = false;
    toggle.addEventListener("click", function () {
      var nowOn = toggle.getAttribute("aria-pressed") !== "true";
      toggle.setAttribute("aria-pressed", String(nowOn));
      document.body.classList.toggle("faith-modernized", nowOn);
      var label = toggle.querySelector(".faith-modernizer-label");
      if (label) label.textContent = nowOn ? "Original language" : "Modernize language";

      elements.forEach(function (el) {
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
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      var modern = window.FaithModernize.modernizeText(node.nodeValue);
      if (modern !== node.nodeValue) node.nodeValue = modern;
    }
  }

  // ── helpers ────────────────────────────────────────────────────
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
