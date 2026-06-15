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
  var baseMeta = document.querySelector('meta[name="tfr-library-base"]');
  var BASE = ((baseMeta && baseMeta.getAttribute("content")) || "").replace(/\/+$/, "");
  var LANG_KEY = "fr_lang_pref";
  var LASTREAD_KEY = "fr_lastread";

  // ── DOM refs ──────────────────────────────────────────────────
  var titleEl      = document.querySelector("[data-fr-title]");
  var dekEl        = document.querySelector("[data-fr-dek]");
  var traditionEl  = document.querySelector("[data-fr-tradition]");
  var translatorEl = document.querySelector("[data-fr-translator]");
  var descEl       = document.querySelector("[data-fr-description]");
  var tocNav       = document.querySelector("[data-fr-toc]");
  var contentEl    = document.querySelector("[data-fr-content]");
  var loadingEl    = document.querySelector("[data-fr-loading]");
  var errorEl      = document.querySelector("[data-fr-error]");
  var langToggle   = document.querySelector("[data-faith-lang-toggle]");

  // Bail if we're not on the reader page.
  if (!contentEl) return;

  // ── Read slug from query string ───────────────────────────────
  var slug = "";
  try {
    slug = new URLSearchParams(window.location.search).get("w") || "";
  } catch (_) {}
  slug = slug.replace(/[^a-z0-9_-]/gi, "");

  if (!slug) {
    showError("No work specified. Add ?w=slug-name to the URL.");
    return;
  }

  // ── State ─────────────────────────────────────────────────────
  var meta = null;
  var pages = [];
  var currentLang = restoreLang();

  // ── Boot ──────────────────────────────────────────────────────
  applyLang(currentLang);
  fetchWork();

  // ── Fetch meta + content ──────────────────────────────────────

  function fetchWork() {
    var metaUrl = BASE + "/v1/works/" + slug + "/meta.json";
    fetch(metaUrl, { credentials: "same-origin" })
      .then(function (r) {
        if (!r.ok) throw new Error("meta " + r.status);
        return r.json();
      })
      .then(function (m) {
        meta = m;
        populateHeader(m);
        buildToc(m.structure || []);
        return fetchPages(m);
      })
      .then(function (p) {
        pages = p;
        renderContent(meta, pages);
        hideLoading();
        saveLastRead();
      })
      .catch(function (err) {
        showError("Could not load this work. (" + (err.message || err) + ")");
      });
  }

  function fetchPages(m) {
    // If meta indicates sharding, fetch each shard; otherwise fetch
    // a single work.json.
    if (m.shards && m.shards.length) {
      var promises = m.shards.map(function (shard) {
        var file = typeof shard === "string" ? shard : shard.file;
        return fetch(BASE + "/v1/works/" + slug + "/" + file, {
          credentials: "same-origin",
        }).then(function (r) {
          if (!r.ok) throw new Error("shard " + file + " " + r.status);
          return r.json();
        });
      });
      return Promise.all(promises).then(function (results) {
        // Each shard is an array of page objects; flatten.
        var all = [];
        results.forEach(function (arr) {
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
    return fetch(BASE + "/v1/works/" + slug + "/work.json", {
      credentials: "same-origin",
    })
      .then(function (r) {
        if (!r.ok) throw new Error("work " + r.status);
        return r.json();
      })
      .then(function (data) {
        return Array.isArray(data) ? data : (data.pages || []);
      });
  }

  // ── Populate header from meta ─────────────────────────────────

  function populateHeader(m) {
    if (titleEl) titleEl.textContent = m.title || "Untitled";
    if (dekEl) {
      var parts = [];
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
        translatorEl.textContent = "Translated by " + m.translator;
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
      document.title = m.title + " — The Faith Received — Mere Orthodoxy";
    }
  }

  // ── Build TOC ─────────────────────────────────────────────────

  function buildToc(structure) {
    if (!tocNav || !structure.length) {
      if (tocNav) {
        var loadNote = tocNav.querySelector(".faith-toc-loading");
        if (loadNote) loadNote.textContent = "No contents available.";
      }
      return;
    }

    // Remove the loading note.
    var loadNote = tocNav.querySelector(".faith-toc-loading");
    if (loadNote) loadNote.remove();

    // Group entries by top-level (depth 0/1) book-like items and
    // nested chapter-like items (depth > first entry's depth).
    var minDepth = structure[0].depth || 0;
    var groups = [];
    var currentGroup = null;

    structure.forEach(function (entry) {
      var depth = entry.depth != null ? entry.depth : 0;
      if (depth <= minDepth) {
        // Top-level item: start a new group.
        currentGroup = { entry: entry, children: [] };
        groups.push(currentGroup);
      } else if (currentGroup) {
        currentGroup.children.push(entry);
      } else {
        // No parent yet; treat as top-level.
        currentGroup = { entry: entry, children: [] };
        groups.push(currentGroup);
      }
    });

    // If everything is at the same depth, render a flat list.
    var allSameDepth = groups.every(function (g) { return g.children.length === 0; });

    if (allSameDepth) {
      var ol = document.createElement("ol");
      ol.className = "faith-toc-list faith-toc-book-list";
      groups.forEach(function (g, i) {
        var li = document.createElement("li");
        li.className = "faith-toc-item";
        li.innerHTML =
          '<a href="#section-' + g.entry.page + '">' +
          '<span class="faith-toc-num">' + toRoman(i + 1) + "</span>" +
          '<span class="faith-toc-label">' + escapeHtml(g.entry.title) + "</span>" +
          "</a>";
        ol.appendChild(li);
      });
      tocNav.appendChild(ol);
    } else {
      // Grouped: details/summary for each book, ol for chapters.
      groups.forEach(function (g) {
        var details = document.createElement("details");
        details.className = "faith-toc-book-details";

        var summary = document.createElement("summary");
        summary.className = "faith-toc-book-summary";
        summary.innerHTML =
          '<span class="faith-toc-book-label">' + escapeHtml(g.entry.title) + "</span>" +
          '<span class="faith-toc-book-count">' + g.children.length + " ch" + (g.children.length === 1 ? "" : "s") + "</span>" +
          '<span class="faith-chev" aria-hidden="true"></span>';
        details.appendChild(summary);

        if (g.children.length) {
          var ol = document.createElement("ol");
          ol.className = "faith-toc-list faith-toc-book-list";
          g.children.forEach(function (ch, ci) {
            var li = document.createElement("li");
            li.className = "faith-toc-item";
            li.innerHTML =
              '<a href="#section-' + ch.page + '">' +
              '<span class="faith-toc-num">' + toRoman(ci + 1) + "</span>" +
              '<span class="faith-toc-label">' + escapeHtml(ch.title) + "</span>" +
              "</a>";
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

    var structure = m.structure || [];
    if (!structure.length) {
      // No structure: render all pages as a single section.
      var section = createSection("Content", 1, pages);
      contentEl.appendChild(section);
      return;
    }

    // Determine grouping. Top-level entries are "books"; children are
    // "chapters". Same logic as TOC.
    var minDepth = structure[0].depth || 0;
    var groups = [];
    var currentGroup = null;

    structure.forEach(function (entry) {
      var depth = entry.depth != null ? entry.depth : 0;
      if (depth <= minDepth) {
        currentGroup = { entry: entry, children: [] };
        groups.push(currentGroup);
      } else if (currentGroup) {
        currentGroup.children.push(entry);
      } else {
        currentGroup = { entry: entry, children: [] };
        groups.push(currentGroup);
      }
    });

    var allFlat = groups.every(function (g) { return g.children.length === 0; });

    if (allFlat) {
      // Flat: each structure entry is a section.
      groups.forEach(function (g, i) {
        var startPage = g.entry.page;
        var endPage = (i + 1 < groups.length) ? groups[i + 1].entry.page : Infinity;
        var sectionPages = filterPages(pages, startPage, endPage);
        var section = createSection(g.entry.title, startPage, sectionPages);
        contentEl.appendChild(section);
      });
    } else {
      // Nested: books > chapters.
      groups.forEach(function (g, gi) {
        var bookEl = document.createElement("details");
        bookEl.className = "faith-book faith-book-details faith-book-details--editorial";
        bookEl.id = "book-" + (gi + 1);

        var bookSummary = document.createElement("summary");
        bookSummary.className = "faith-book-summary";
        bookSummary.innerHTML =
          '<div class="faith-book-summary-inner">' +
          '<p class="eyebrow faith-part-eyebrow">' + escapeHtml(g.entry.title) + "</p>" +
          '<p class="faith-book-subtitle">' + g.children.length + " chapter" + (g.children.length === 1 ? "" : "s") + "</p>" +
          "</div>" +
          '<span class="faith-chev" aria-hidden="true"></span>';
        bookEl.appendChild(bookSummary);

        var bookBody = document.createElement("div");
        bookBody.className = "faith-book-body";

        if (g.children.length) {
          g.children.forEach(function (ch, ci) {
            var startPage = ch.page;
            // End page: next child, or next book, or Infinity.
            var endPage = Infinity;
            if (ci + 1 < g.children.length) {
              endPage = g.children[ci + 1].page;
            } else if (gi + 1 < groups.length) {
              endPage = groups[gi + 1].entry.page;
            }
            var chPages = filterPages(pages, startPage, endPage);
            var section = createSection(ch.title, ch.page, chPages);
            bookBody.appendChild(section);
          });
        } else {
          // Book with no children: render the book's own pages.
          var bookStart = g.entry.page;
          var bookEnd = (gi + 1 < groups.length) ? groups[gi + 1].entry.page : Infinity;
          var bPages = filterPages(pages, bookStart, bookEnd);
          var section = createSection(g.entry.title, g.entry.page, bPages);
          bookBody.appendChild(section);
        }

        bookEl.appendChild(bookBody);
        contentEl.appendChild(bookEl);
      });
    }
  }

  function filterPages(pages, startPage, endPage) {
    return pages.filter(function (p) {
      return p.n >= startPage && p.n < endPage;
    });
  }

  function createSection(title, page, sectionPages) {
    var details = document.createElement("details");
    details.className = "faith-section-details faith-book-chapter";
    details.id = "section-" + page;

    var summary = document.createElement("summary");
    summary.className = "faith-section-summary";
    summary.innerHTML =
      '<div class="faith-section-summary-inner">' +
      '<h2 class="faith-section-title"><em>' + escapeHtml(title) + "</em></h2>" +
      "</div>" +
      '<span class="faith-chev" aria-hidden="true"></span>';
    details.appendChild(summary);

    var body = document.createElement("div");
    body.className = "faith-section-body article-content";

    sectionPages.forEach(function (p) {
      var block = document.createElement("div");
      block.className = "faith-parallel-block";
      block.setAttribute("data-page", p.n);

      // English column.
      var enCol = document.createElement("div");
      enCol.className = "faith-col-en";
      enCol.innerHTML =
        '<span class="faith-page-marker">[p. ' + p.n + "]</span>" +
        renderMarkdown(p.en || "");

      // Latin column.
      var laCol = document.createElement("div");
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
    var paragraphs = text.split(/\n\n+/);
    var html = "";
    paragraphs.forEach(function (para) {
      para = para.trim();
      if (!para) return;
      // Headings.
      var hMatch;
      if ((hMatch = para.match(/^### (.+)$/))) {
        html += "<h3>" + inlineFormat(hMatch[1]) + "</h3>";
      } else if ((hMatch = para.match(/^## (.+)$/))) {
        html += "<h2>" + inlineFormat(hMatch[1]) + "</h2>";
      } else if ((hMatch = para.match(/^# (.+)$/))) {
        html += "<h1>" + inlineFormat(hMatch[1]) + "</h1>";
      } else {
        // Regular paragraph. Handle line breaks within a paragraph.
        html += "<p>" + inlineFormat(para.replace(/\n/g, " ")) + "</p>";
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
    contentEl.classList.add("faith-lang-" + lang);

    if (langToggle) {
      var btns = langToggle.querySelectorAll("[data-lang]");
      for (var i = 0; i < btns.length; i++) {
        btns[i].setAttribute("aria-pressed", btns[i].getAttribute("data-lang") === lang ? "true" : "false");
      }
    }
  }

  function restoreLang() {
    try {
      var stored = localStorage.getItem(LANG_KEY);
      if (stored === "en" || stored === "la" || stored === "parallel") return stored;
    } catch (_) {}
    return "en";
  }

  function saveLang(lang) {
    try { localStorage.setItem(LANG_KEY, lang); } catch (_) {}
  }

  if (langToggle) {
    langToggle.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-lang]");
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

  var expandToggle = document.querySelector("[data-faith-expand-toggle]");
  if (expandToggle) {
    expandToggle.addEventListener("click", function () {
      var expanded = expandToggle.getAttribute("aria-pressed") === "true";
      var allDetails = contentEl.querySelectorAll(".faith-section-details, .faith-book-details");
      for (var i = 0; i < allDetails.length; i++) {
        allDetails[i].open = expanded;
      }
    });
  }

  // ── Continue Reading ──────────────────────────────────────────

  function saveLastRead() {
    if (!meta || !slug) return;
    try {
      localStorage.setItem(LASTREAD_KEY, JSON.stringify({
        slug: slug,
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
      var textEl = errorEl.querySelector(".faith-reader-error-text");
      if (textEl) textEl.textContent = msg;
    }
  }

  function hideLoading() {
    if (loadingEl) loadingEl.hidden = true;
  }

  // ── Utility ───────────────────────────────────────────────────

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function toRoman(num) {
    var vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
    var syms = ["M","CM","D","CD","C","XC","L","XL","X","IX","V","IV","I"];
    var result = "";
    for (var i = 0; i < vals.length; i++) {
      while (num >= vals[i]) {
        result += syms[i];
        num -= vals[i];
      }
    }
    return result;
  }
})();
