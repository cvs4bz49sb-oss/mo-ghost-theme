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
      grid.innerHTML = authors.map(renderCard).join("");
    })
    .catch(function () { /* keep server render */ });

  function renderCard(tag) {
    var portrait = tag.feature_image
      ? '<img src="' + escapeAttr(tag.feature_image) + '" alt="' + escapeAttr(tag.name) + '" />'
      : '<span class="contributor-card-initial">' + escapeHtml(tag.name) + "</span>";
    var bio = tag.description
      ? '<p class="contributor-card-bio">' + escapeHtml(tag.description) + "</p>"
      : "";
    var count = (tag.count && tag.count.posts) || 0;
    var essayWord = count === 1 ? "essay" : "essays";
    return (
      '<a href="' + escapeAttr(tag.url) + '" class="contributor-card contributor-card--candidate" data-tag-slug="' + escapeAttr(tag.slug) + '">' +
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
