/*
 * related.js — Read Next section enhancements.
 *
 * 1. "More on this theme" grid: the server renders via {{#get}} using
 *    primary_tag, which is wrong when Ghost assigns an author-<slug> tag
 *    as primary (contributor tagging convention). This script swaps the
 *    grid using Ghost's Content API, picking the first public tag whose
 *    slug doesn't start with "author-" so matches are topical, not
 *    by-author. If the API key isn't configured or the fetch fails, the
 *    server-rendered fallback stays in place.
 *
 * 2. Recent Articles neighbor bylines: {{#next_post}} / {{#prev_post}}
 *    don't load tags, so primary_author is always the Ghost house
 *    account ("Mere Orthodoxy"). This script fetches the real tag data
 *    for each neighbor post and populates the byline using the same
 *    author-* tag CSS convention used everywhere else on the site.
 *
 * Both operations share the same IIFE, API key, and escape helpers.
 */
(function () {
  var section = document.querySelector("[data-related]");
  if (!section) return;

  var apiKeyMeta = document.querySelector('meta[name="ghost-content-api-key"]');
  var API_KEY = apiKeyMeta ? apiKeyMeta.getAttribute("content") : "";
  if (!API_KEY) return;

  var API_BASE = (window.location.origin || "") + "/ghost/api/content";

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s); }

  // ── 1. "More on this theme" grid ────────────────────────────────────

  var grid = section.querySelector("[data-related-grid]");
  if (grid) {
    var postId = section.getAttribute("data-post-id") || "";
    var slugsRaw = section.getAttribute("data-tag-slugs") || "";
    var slugs = slugsRaw.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    var topicSlug = null;
    for (var i = 0; i < slugs.length; i++) {
      if (slugs[i].indexOf("author-") !== 0) { topicSlug = slugs[i]; break; }
    }

    if (topicSlug) {
      var relatedUrl = API_BASE + "/posts/?key=" + encodeURIComponent(API_KEY) +
        "&filter=" + encodeURIComponent("tag:" + topicSlug + "+id:-" + postId) +
        "&limit=4&include=tags,authors&fields=id,url,title,feature_image,custom_excerpt,excerpt,published_at,reading_time";

      fetch(relatedUrl, { cache: "default" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (!data || !Array.isArray(data.posts) || !data.posts.length) return;
          grid.innerHTML = data.posts.map(renderEntry).join("");
        })
        .catch(function () { /* leave server render */ });
    }
  }

  // ── 2. Recent Articles neighbor bylines ─────────────────────────────

  var neighborEntries = section.querySelectorAll("a[data-neighbor-entry][data-post-id]");
  if (neighborEntries.length) {
    var ids = Array.prototype.map.call(neighborEntries, function (a) {
      return a.getAttribute("data-post-id");
    }).filter(Boolean);

    var neighborUrl = API_BASE + "/posts/?key=" + encodeURIComponent(API_KEY) +
      "&filter=" + encodeURIComponent("id:[" + ids.join(",") + "]") +
      "&limit=2&include=tags&fields=id,tags";

    fetch(neighborUrl, { cache: "default" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !Array.isArray(data.posts)) return;
        data.posts.forEach(function (p) {
          var link = section.querySelector('a[data-neighbor-entry][data-post-id="' + p.id + '"]');
          if (!link) return;
          var byline = link.querySelector("[data-byline]");
          if (!byline) return;
          var prefix = '<span class="entry-byline-prefix">By </span>';
          var contributors = (p.tags || []).map(function (t) {
            return '<em class="entry-contributor entry-contributor--candidate" data-tag-slug="' +
              escapeAttr(t.slug) + '">' + escapeHtml(t.name) + "</em>";
          }).join("");
          byline.innerHTML = prefix + contributors;
        });
      })
      .catch(function () { /* leave server render */ });
  }

  // ── Render helper (used by "More on this theme" grid) ───────────────

  function renderEntry(p) {
    var plateStyle = p.feature_image
      ? ' style="background-image: url(' + escapeAttr(p.feature_image) + ');"'
      : "";

    var topicTags = (p.tags || [])
      .map(function (t) {
        return '<span class="entry-topic-tag" data-tag-slug="' + escapeAttr(t.slug) + '">' + escapeHtml(t.name) + '</span>';
      })
      .join("");
    var topic = '<p class="entry-topic entry-topic--candidates" data-topic>' + topicTags + '</p>';

    var excerptText = p.custom_excerpt || p.excerpt || "";
    excerptText = String(excerptText).replace(/\s+/g, " ").trim();
    if (excerptText.length > 180) excerptText = excerptText.slice(0, 180).replace(/\s+\S*$/, "") + "…";
    var excerpt = excerptText
      ? '<p class="entry-excerpt entry-excerpt-dropcap">' +
          '<span class="entry-initial">' + escapeHtml(excerptText.charAt(0)) + "</span>" +
          escapeHtml(excerptText.slice(1)) +
        "</p>"
      : "";

    var contributorTags = (p.tags || [])
      .map(function (t) {
        return '<em class="entry-contributor entry-contributor--candidate" data-tag-slug="' + escapeAttr(t.slug) + '">' + escapeHtml(t.name) + '</em>';
      })
      .join("");
    var contributorLine =
      '<p class="entry-byline entry-byline-contributors" data-byline>' +
        '<span class="entry-byline-prefix">By </span>' + contributorTags +
      "</p>";
    var fallbackAuthor = (p.authors && p.authors[0] && p.authors[0].name) || "";
    var fallbackLine = fallbackAuthor
      ? '<p class="entry-byline entry-byline-fallback">By <em>' + escapeHtml(fallbackAuthor) + "</em></p>"
      : "";

    var dateStr = "";
    if (p.published_at) {
      var d = new Date(p.published_at);
      if (!isNaN(d.getTime())) {
        dateStr = d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
      }
    }
    var mins = p.reading_time ? (p.reading_time + " min read") : "";
    var metaBits = [dateStr, mins].filter(Boolean).join(" · ");
    var dateLine = metaBits
      ? '<p class="entry-date">' + escapeHtml(metaBits) + "</p>"
      : "";

    return (
      '<a href="' + escapeAttr(p.url) + '" class="entry">' +
        '<div class="entry-plate">' +
          '<div class="entry-plate-inner"' + plateStyle + "></div>" +
        "</div>" +
        '<div class="entry-text">' +
          topic +
          '<h3 class="entry-title">' + escapeHtml(p.title) + "</h3>" +
          excerpt +
          '<div class="entry-meta">' +
            contributorLine +
            fallbackLine +
            dateLine +
          "</div>" +
        "</div>" +
      "</a>"
    );
  }
})();
