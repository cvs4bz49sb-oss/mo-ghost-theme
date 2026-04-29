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
      // Source IDs in the heidelberg index map to our slug + anchor:
      //   "heidelberg" / "q6" -> /the-faith-received/heidelberg/#q-6
      //   "diognetus"  / "ch3" -> /the-faith-received/diognetus/#chapter-3
      var slug = r.source || "";
      var id = r.id || "";
      var anchor = "";
      var qm = id.match(/^q(\d+)/);
      var cm = id.match(/^ch(?:apter)?(\d+)/);
      if (qm) anchor = "#q-" + qm[1];
      else if (cm) anchor = "#chapter-" + cm[1];
      else if (id) anchor = "#" + id;
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

  // ── 7. Modernizer toggle (placeholder) ────────────────────────
  initModernizer();

  function initModernizer() {
    var toggle = document.querySelector("[data-modernizer-toggle]");
    if (!toggle) return;
    // No document in v1 ships with a modernized text variant. The
    // button stays hidden (rendered with `hidden` attribute by the
    // builder). When data adds modernized fields, this script
    // unhides + wires the swap. Pattern stays in place so the markup
    // doesn't need to change later.
    var hasModern = !!document.querySelector("[data-modernized]");
    if (!hasModern) return;
    toggle.hidden = false;
    toggle.addEventListener("click", function () {
      var on = toggle.getAttribute("aria-pressed") === "true";
      toggle.setAttribute("aria-pressed", String(!on));
      document.body.classList.toggle("faith-modernized", !on);
      var label = toggle.querySelector(".faith-modernizer-label");
      if (label) label.textContent = !on ? "Original language" : "Modernize language";
    });
  }

  // ── helpers ────────────────────────────────────────────────────
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
