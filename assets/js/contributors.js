/*
 * Contributors page — full-list loader + alphabet/threshold filter.
 *
 * Supports two modes, set via data-mode on the grid element:
 *
 *   "curated"  — /contributors/. Shows only the writers listed in
 *                data-curated. No alphabet rail. A "+ View All" link
 *                points to /contributors/all/.
 *
 *   "all"      — /contributors/all/. Shows every contributor with at
 *                least one post, sorted by last name. Alphabet rail
 *                and empty-state are wired up.
 *
 * Ghost's {{#get "tags"}} helper returns a single page of the Content
 * API (max 100 tags), which truncates the roster once the corpus has
 * more than 100 public tags. This script fetches every page, filters
 * to contributor tags (slug prefix "author-") with at least one post,
 * rebuilds the grid, and wires up the alphabet rail on the "all" page.
 *
 * If the Content API key isn't present or the fetch fails, the
 * server-rendered first page stays in place.
 */
(function () {
  var grid = document.querySelector("[data-contributors-grid]");
  if (!grid) return;

  var mode = grid.getAttribute("data-mode") || "all";
  var curatedSpec = grid.getAttribute("data-curated") || "";

  var rail = document.querySelector("[data-contributors-rail]");
  var railInner = document.querySelector("[data-contributors-rail-inner]");
  var emptyEl = document.querySelector("[data-contributors-empty]");
  var emptyLetterEl = emptyEl ? emptyEl.querySelector("[data-empty-letter]") : null;

  var activeLetter = "all";

  var apiKeyMeta = document.querySelector('meta[name="ghost-content-api-key"]');
  var API_KEY = apiKeyMeta ? apiKeyMeta.getAttribute("content") : "";

  if (API_KEY) {
    loadFullRoster();
  } else {
    // No API access — wire up the existing SSR cards as-is.
    if (mode === "curated") filterSSRToCurated();
    initFilter();
  }

  function loadFullRoster() {
    var apiBase = (window.location.origin || "") + "/ghost/api/content/tags/";
    function pageUrl(page) {
      return apiBase + "?key=" + encodeURIComponent(API_KEY) +
        "&filter=" + encodeURIComponent("visibility:public") +
        "&include=count.posts" +
        "&order=" + encodeURIComponent("name asc") +
        "&limit=100&page=" + page;
    }
    fetch(pageUrl(1), { cache: "default" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (first) {
        if (!first || !first.tags) return null;
        var totalPages = (first.meta && first.meta.pagination && first.meta.pagination.pages) || 1;
        if (totalPages <= 1) return first.tags;
        var rest = [];
        for (var i = 2; i <= totalPages; i++) {
          rest.push(
            fetch(pageUrl(i), { cache: "default" })
              .then(function (r) { return r.ok ? r.json() : null; })
              .then(function (d) { return (d && d.tags) || []; })
          );
        }
        return Promise.all(rest).then(function (pages) {
          return pages.reduce(function (acc, t) { return acc.concat(t); }, first.tags.slice());
        });
      })
      .then(function (tags) {
        if (tags) {
          var authors = tags.filter(function (t) {
            return t && t.slug && t.slug.indexOf("author-") === 0 &&
              t.count && t.count.posts > 0;
          }).sort(function (a, b) {
            var la = lastName(a.name), lb = lastName(b.name);
            return la.localeCompare(lb) || a.name.localeCompare(b.name);
          });

          if (mode === "curated" && curatedSpec) {
            authors = filterToCurated(authors, curatedSpec);
          }

          if (authors.length) {
            grid.innerHTML = authors.map(renderCard).join("");
          }
        }
        initFilter();
      })
      .catch(function () { initFilter(); });
  }

  // ── Curated filtering ────────────────────────────────────────

  // Parse the data-curated spec into matchers.
  // Each entry is either "LastName" (match all) or "LastName:Prefix"
  // (match only when first name starts with Prefix).
  function parseCuratedSpec(spec) {
    if (!spec) return [];
    return spec.split(",").map(function (entry) {
      var trimmed = entry.trim();
      var colonIdx = trimmed.indexOf(":");
      if (colonIdx > -1) {
        return {
          last: trimmed.substring(0, colonIdx).trim().toLowerCase(),
          prefix: trimmed.substring(colonIdx + 1).trim().toLowerCase()
        };
      }
      return { last: trimmed.toLowerCase(), prefix: "" };
    });
  }

  function filterToCurated(authors, spec) {
    var matchers = parseCuratedSpec(spec);
    var matched = [];
    var used = {}; // track which authors have been matched

    // For each author, check if any matcher accepts them.
    authors.forEach(function (author) {
      var authorLast = lastName(author.name).toLowerCase();
      var authorFirst = firstName(author.name).toLowerCase();

      for (var i = 0; i < matchers.length; i++) {
        var m = matchers[i];
        if (authorLast !== m.last) continue;
        if (m.prefix && authorFirst.indexOf(m.prefix) !== 0) continue;
        // Match found.
        var key = author.slug;
        if (!used[key]) {
          matched.push(author);
          used[key] = true;
        }
        break;
      }
    });

    return matched;
  }

  // SSR fallback: hide non-curated cards from the server-rendered grid.
  function filterSSRToCurated() {
    if (!curatedSpec) return;
    var matchers = parseCuratedSpec(curatedSpec);
    var cards = Array.prototype.slice.call(grid.querySelectorAll(".contributor-card"));
    cards.forEach(function (card) {
      var nameEl = card.querySelector(".contributor-card-name");
      var name = nameEl ? nameEl.textContent.trim() : "";
      var authorLast = lastName(name).toLowerCase();
      var authorFirst = firstName(name).toLowerCase();
      var isMatch = false;
      for (var i = 0; i < matchers.length; i++) {
        var m = matchers[i];
        if (authorLast !== m.last) continue;
        if (m.prefix && authorFirst.indexOf(m.prefix) !== 0) continue;
        isMatch = true;
        break;
      }
      card.style.display = isMatch ? "" : "none";
    });
  }

  // ── Filter (alphabet rail — only on "all" page) ──────────────
  function initFilter() {
    if (mode !== "all" || !rail || !grid) return;
    var cards = Array.prototype.slice.call(grid.querySelectorAll(".contributor-card"));
    if (!cards.length) return;

    // Stamp each card with the last-name initial.
    cards.forEach(function (card) {
      var nameEl = card.querySelector(".contributor-card-name");
      var name = nameEl ? nameEl.textContent.trim() : "";
      var initial = (lastName(name).charAt(0) || "").toUpperCase();
      card.setAttribute("data-last-initial", initial);
    });

    // Disable rail letters that have no contributors.
    var available = {};
    cards.forEach(function (c) { available[c.getAttribute("data-last-initial")] = true; });
    Array.prototype.slice.call(railInner.querySelectorAll(".contributors-rail-pill")).forEach(function (pill) {
      var letter = pill.getAttribute("data-letter");
      if (letter !== "all" && !available[letter]) {
        pill.disabled = true;
        pill.setAttribute("aria-disabled", "true");
      }
    });

    // Wire the rail.
    railInner.addEventListener("click", function (e) {
      var pill = e.target.closest(".contributors-rail-pill");
      if (!pill || pill.disabled) return;
      activeLetter = pill.getAttribute("data-letter") || "all";
      Array.prototype.slice.call(railInner.querySelectorAll(".contributors-rail-pill")).forEach(function (p) {
        p.classList.toggle("is-active", p === pill);
      });
      apply();
    });

    apply();

    function apply() {
      var visible = 0;
      cards.forEach(function (card) {
        var initial = card.getAttribute("data-last-initial") || "";
        var matchesLetter = activeLetter === "all" || initial === activeLetter;
        card.style.display = matchesLetter ? "" : "none";
        if (matchesLetter) visible++;
      });
      if (emptyEl) {
        if (visible === 0 && activeLetter !== "all") {
          emptyEl.hidden = false;
          if (emptyLetterEl) emptyLetterEl.textContent = activeLetter;
        } else {
          emptyEl.hidden = true;
        }
      }
    }
  }

  // ── Helpers ───────────────────────────────────────────────────
  function lastName(name) {
    if (!name) return "";
    var stripped = name.replace(/,?\s+(jr\.?|sr\.?|ii|iii|iv|v|phd|m\.?d\.?)\s*$/i, "").trim();
    var tokens = stripped.split(/\s+/);
    return tokens[tokens.length - 1] || "";
  }

  // Returns everything before the last name (first + middle names).
  function firstName(name) {
    if (!name) return "";
    var stripped = name.replace(/,?\s+(jr\.?|sr\.?|ii|iii|iv|v|phd|m\.?d\.?)\s*$/i, "").trim();
    var tokens = stripped.split(/\s+/);
    if (tokens.length <= 1) return tokens[0] || "";
    return tokens.slice(0, -1).join(" ");
  }

  function renderCard(tag) {
    var initial = (tag.name || "").trim().charAt(0).toUpperCase();
    var portrait = (tag.feature_image && window.MOSafeHref.isSafe(tag.feature_image))
      ? '<img src="' + escapeAttr(tag.feature_image) + '" alt="' + escapeAttr(tag.name) + '" />'
      : '<span class="contributor-card-initial contributor-card-initial--rendered">' + escapeHtml(initial) + '</span>';
    var bio = tag.description
      ? '<p class="contributor-card-bio">' + escapeHtml(tag.description) + '</p>'
      : "";
    var count = (tag.count && tag.count.posts) || 0;
    var essayWord = count === 1 ? "essay" : "essays";
    return (
      '<a href="' + escapeAttr(window.MOSafeHref.sanitize(tag.url, "#")) + '" class="contributor-card contributor-card--candidate" data-tag-slug="' + escapeAttr(tag.slug) + '" data-count="' + count + '">' +
        '<div class="contributor-card-portrait" aria-hidden="true">' + portrait + '</div>' +
        '<div class="contributor-card-body">' +
          '<h2 class="contributor-card-name"><em>' + escapeHtml(tag.name) + '</em></h2>' +
          bio +
          '<p class="contributor-card-count">' + count + ' ' + essayWord + '</p>' +
        '</div>' +
      '</a>'
    );
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s); }
})();
