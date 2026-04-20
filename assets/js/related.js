/*
 * Related posts ("More on this theme") replacer.
 *
 * The server renders the grid server-side via {{#get}} with primary_tag,
 * which is wrong when Ghost assigns an author-<slug> tag as primary
 * (contributor tagging convention). This script quietly replaces the
 * grid using Ghost's Content API, picking the first public tag whose
 * slug doesn't start with "author-" so the matches are topical, not
 * by-author. If the API key isn't configured or the fetch fails, the
 * server-rendered fallback stays in place.
 */
(function () {
  var section = document.querySelector("[data-related]");
  if (!section) return;

  var grid = section.querySelector("[data-related-grid]");
  if (!grid) return;

  var postId = section.getAttribute("data-post-id") || "";
  var slugsRaw = section.getAttribute("data-tag-slugs") || "";
  var slugs = slugsRaw.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
  var topicSlug = null;
  for (var i = 0; i < slugs.length; i++) {
    if (slugs[i].indexOf("author-") !== 0) { topicSlug = slugs[i]; break; }
  }
  if (!topicSlug) return;

  var apiKeyMeta = document.querySelector('meta[name="ghost-content-api-key"]');
  var API_KEY = apiKeyMeta ? apiKeyMeta.getAttribute("content") : "";
  if (!API_KEY) return;

  var API_BASE = (window.location.origin || "") + "/ghost/api/content";
  var url = API_BASE + "/posts/?key=" + encodeURIComponent(API_KEY) +
    "&filter=" + encodeURIComponent("tag:" + topicSlug + "+id:-" + postId) +
    "&limit=3&include=tags,authors&fields=id,url,title,feature_image,custom_excerpt,excerpt,published_at,reading_time";

  fetch(url, { cache: "default" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (!data || !Array.isArray(data.posts) || !data.posts.length) return;
      grid.innerHTML = data.posts.map(renderCard).join("");
    })
    .catch(function () { /* leave server render */ });

  function renderCard(p) {
    var media = p.feature_image
      ? '<div class="card-media" style="background-image: url(' + escapeAttr(p.feature_image) + ');"></div>'
      : '<div class="card-media mock-1"></div>';

    var topicTags = (p.tags || [])
      .map(function (t) {
        return '<span class="card-topic-tag" data-tag-slug="' + escapeAttr(t.slug) + '">' + escapeHtml(t.name) + '</span>';
      })
      .join("");
    var topic = '<p class="card-topic card-topic--candidates" data-topic>' + topicTags + '</p>';

    var bylineTags = (p.tags || [])
      .map(function (t) {
        return '<span class="author byline-author byline-author--candidate" data-tag-slug="' + escapeAttr(t.slug) + '">' + escapeHtml(t.name) + '</span>';
      })
      .join("");
    var byline = '<p class="card-byline byline-inline--contributors" data-byline>By ' + bylineTags + '</p>';
    var fallbackAuthor = (p.authors && p.authors[0]) ? p.authors[0].name : (p.primary_author && p.primary_author.name) || "";
    var fallback = fallbackAuthor
      ? '<p class="card-byline byline-inline--fallback">By <span class="author">' + escapeHtml(fallbackAuthor) + "</span></p>"
      : "";

    var excerptText = p.custom_excerpt || p.excerpt || "";
    excerptText = String(excerptText).replace(/\s+/g, " ").trim();
    if (excerptText.length > 160) excerptText = excerptText.slice(0, 160).replace(/\s+\S*$/, "") + "\u2026";
    var excerpt = excerptText
      ? '<p class="card-excerpt">' + escapeHtml(excerptText) + "</p>"
      : "";

    var dateStr = "";
    if (p.published_at) {
      var d = new Date(p.published_at);
      if (!isNaN(d.getTime())) {
        dateStr = d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
      }
    }
    var mins = p.reading_time ? (p.reading_time + " min read") : "";
    var metaBits = [dateStr, mins].filter(Boolean).join(" \u00b7 ");
    var meta =
      '<div class="card-meta">' +
        '<span>' + escapeHtml(metaBits) + "</span>" +
        '<span class="read-more">Read &rarr;</span>' +
      "</div>";

    return (
      '<a href="' + escapeAttr(p.url) + '" class="article-card">' +
        media +
        '<div class="card-body">' +
          topic +
          '<h3 class="card-title"><em>' + escapeHtml(p.title) + "</em></h3>" +
          byline +
          fallback +
          excerpt +
          meta +
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
