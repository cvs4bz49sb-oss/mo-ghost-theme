/*
 * Contributors page full-list loader.
 *
 * Ghost's {{#get "tags"}} helper returns a single page of the Content
 * API (max 100 tags), which truncates the roster at Dennis Sansom
 * once the corpus has more than 100 total tags. This script fetches
 * every page of public tags, filters to contributors (slug prefix
 * "author-") with at least one post, and rebuilds the grid.
 *
 * If the Content API key isn't present or the fetch fails, the
 * server-rendered first page stays in place.
 */
(function () {
  var grid = document.querySelector(".contributors-grid");
  if (!grid) return;

  var apiKeyMeta = document.querySelector('meta[name="ghost-content-api-key"]');
  var API_KEY = apiKeyMeta ? apiKeyMeta.getAttribute("content") : "";
  if (!API_KEY) return;

  var API_BASE = (window.location.origin || "") + "/ghost/api/content/tags/";

  function pageUrl(page) {
    return API_BASE + "?key=" + encodeURIComponent(API_KEY) +
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
      if (!tags) return;
      var authors = tags.filter(function (t) {
        return t && t.slug && t.slug.indexOf("author-") === 0 &&
          t.count && t.count.posts > 0;
      }).sort(function (a, b) { return a.name.localeCompare(b.name); });
      if (!authors.length) return;

      // Mark the first author for each initial letter so the A-Z rail
      // can scroll-link to it. Compare letters in a case-insensitive
      // way and fall back to "#" for anything that doesn't start with
      // a letter.
      var seenLetters = {};
      authors = authors.map(function (t) {
        var ch = (t.name || "").trim().charAt(0).toUpperCase();
        var letter = /^[A-Z]$/.test(ch) ? ch : "#";
        var isFirst = !seenLetters[letter];
        seenLetters[letter] = true;
        return Object.assign({}, t, { __letter: letter, __isLetterAnchor: isFirst });
      });

      grid.innerHTML = authors.map(renderCard).join("");
      renderAzRail(seenLetters);
    })
    .catch(function () { /* keep server render */ });

  function renderAzRail(activeLetters) {
    var rail = document.querySelector("[data-contributors-az]");
    if (!rail) return;
    var letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    var lettersHtml = letters.map(function (L) {
      if (activeLetters[L]) {
        return '<a href="#letter-' + L + '" class="contributors-az-letter" data-letter="' + L + '">' + L + "</a>";
      }
      return '<span class="contributors-az-letter is-disabled" aria-disabled="true">' + L + "</span>";
    }).join("");
    if (activeLetters["#"]) {
      lettersHtml += '<a href="#letter-num" class="contributors-az-letter" data-letter="#">#</a>';
    }
    rail.innerHTML =
      '<button type="button" class="contributors-az-toggle" aria-label="Collapse alphabet jump rail" aria-expanded="true" data-az-toggle>' +
        '<span class="contributors-az-toggle-icon" aria-hidden="true">&lsaquo;</span>' +
      "</button>" +
      '<div class="contributors-az-letters" data-az-letters>' + lettersHtml + "</div>";
    rail.hidden = false;

    wireToggle(rail);
  }

  var STORAGE_KEY = "mo_contributors_az_collapsed";

  function wireToggle(rail) {
    var layout = rail.closest(".contributors-layout") || rail.parentNode;
    var toggle = rail.querySelector("[data-az-toggle]");
    if (!layout || !toggle) return;

    // Restore the previous collapsed state on load.
    try {
      if (window.localStorage && localStorage.getItem(STORAGE_KEY) === "1") {
        layout.classList.add("is-az-collapsed");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Expand alphabet jump rail");
      }
    } catch (e) { /* ignore */ }

    toggle.addEventListener("click", function () {
      var collapsed = layout.classList.toggle("is-az-collapsed");
      toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
      toggle.setAttribute(
        "aria-label",
        collapsed ? "Expand alphabet jump rail" : "Collapse alphabet jump rail"
      );
      try {
        if (window.localStorage) {
          localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
        }
      } catch (e) { /* ignore */ }
    });
  }

  function renderCard(tag) {
    var portrait = tag.feature_image
      ? '<img src="' + escapeAttr(tag.feature_image) + '" alt="' + escapeAttr(tag.name) + '" />'
      : '<span class="contributor-card-initial">' + escapeHtml(tag.name) + "</span>";
    var bio = tag.description
      ? '<p class="contributor-card-bio">' + escapeHtml(tag.description) + "</p>"
      : "";
    var count = (tag.count && tag.count.posts) || 0;
    var essayWord = count === 1 ? "essay" : "essays";
    // First contributor in each letter group gets an id so the A-Z
    // rail can scroll-link directly to it.
    var anchorId = "";
    if (tag.__isLetterAnchor) {
      anchorId = ' id="letter-' + (tag.__letter === "#" ? "num" : tag.__letter) + '"';
    }
    return (
      '<a' + anchorId + ' href="' + escapeAttr(tag.url) + '" class="contributor-card contributor-card--candidate" data-tag-slug="' + escapeAttr(tag.slug) + '" data-letter="' + escapeAttr(tag.__letter || "") + '">' +
        '<div class="contributor-card-portrait" aria-hidden="true">' + portrait + "</div>" +
        '<div class="contributor-card-body">' +
          '<h2 class="contributor-card-name"><em>' + escapeHtml(tag.name) + "</em></h2>" +
          bio +
          '<p class="contributor-card-count">' + count + " " + essayWord + "</p>" +
        "</div>" +
      "</a>"
    );
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s); }
})();
