/*
 * Podcast feed wiring.
 *
 * Fetches the Cloudflare Worker proxy (which merges both podcast
 * RSS feeds into one JSON payload), flattens every episode across
 * shows, sorts by publish date descending, and renders the four
 * most recent as cards in the homepage Listen section.
 *
 * Per-show Apple/Spotify URLs are read from data-* attributes on
 * the .listen-grid so they can be edited in Ghost admin via
 * @custom settings (podcast_mf_apple_url, etc.).
 *
 * Configure the theme's `podcast_feed_url` custom setting to the
 * deployed Worker URL. When unset or the fetch fails, the static
 * fallback markup in index.hbs stays put.
 */
(function () {
  var FEED_URL = document.body.getAttribute("data-podcast-feed-url") || "";
  if (!FEED_URL) return;

  var grid = document.querySelector(".listen-grid");
  if (!grid) return;

  var platforms = {
    "mere-fidelity": {
      apple: grid.getAttribute("data-mf-apple") || "",
      spotify: grid.getAttribute("data-mf-spotify") || "",
    },
    "christians-reading-classics": {
      apple: grid.getAttribute("data-crc-apple") || "",
      spotify: grid.getAttribute("data-crc-spotify") || "",
    },
  };

  var url = FEED_URL + (FEED_URL.indexOf("?") > -1 ? "&" : "?") + "limit=5";
  fetch(url, { cache: "default" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (!data) return;
      var all = [];
      Object.keys(data).forEach(function (slug) {
        var payload = data[slug];
        if (!payload || payload.error || !Array.isArray(payload.episodes)) return;
        var showTitle = (payload.show && payload.show.title) || slug;
        payload.episodes.forEach(function (ep) {
          if (!ep) return;
          var ts = ep.pubDate ? Date.parse(ep.pubDate) : NaN;
          all.push({
            slug: slug,
            showTitle: showTitle,
            title: ep.title || "",
            description: ep.description || "",
            ts: isNaN(ts) ? 0 : ts,
          });
        });
      });

      if (!all.length) return;
      all.sort(function (a, b) { return b.ts - a.ts; });
      var top = all.slice(0, 4);

      grid.innerHTML = top.map(renderCard).join("");
    })
    .catch(function () { /* static fallback stays */ });

  function renderCard(ep) {
    var date = ep.ts
      ? new Date(ep.ts).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "";
    var topicHtml = "";
    if (ep.showTitle) topicHtml += '<p class="pod-topic">' + escapeHtml(ep.showTitle) + "</p>";
    if (date) topicHtml += '<p class="pod-date">' + escapeHtml(date) + "</p>";

    var summary = sanitize(ep.description).replace(/\s+/g, " ").slice(0, 180).trim();
    var initial = summary.charAt(0) || "";
    var rest = summary.slice(1);
    var excerpt = summary
      ? '<p class="pod-excerpt pod-excerpt-dropcap"><span class="pod-initial">' +
        escapeHtml(initial) + "</span>" + escapeHtml(rest) + "</p>"
      : "";

    var p = platforms[ep.slug] || {};
    var links = [];
    if (p.apple) {
      links.push('<a href="' + escapeAttr(p.apple) + '" target="_blank" rel="noopener">Apple</a>');
    }
    if (p.spotify) {
      links.push('<a href="' + escapeAttr(p.spotify) + '" target="_blank" rel="noopener">Spotify</a>');
    }
    var linksBlock = links.length
      ? '<div class="pod-listen"><p class="pod-listen-label">Listen</p><p class="pod-listen-platforms">' +
        links.join('<span class="pod-listen-sep" aria-hidden="true"> | </span>') + "</p></div>"
      : "";

    return (
      '<article class="pod-entry pod-entry--episode" data-show="' + escapeAttr(ep.slug) + '">' +
      topicHtml +
      '<h3 class="pod-title"><em>' + escapeHtml(ep.title) + "</em></h3>" +
      excerpt +
      linksBlock +
      "</article>"
    );
  }

  // The worker's HTML-strip regex misses attribute values that contain
  // `>` characters (common with Tailwind arbitrary selectors like
  // `<div class="[&_pre>div]:border-0.5">`), leaking class-token gibberish
  // into the start of descriptions. Walk tokens from the front and
  // drop any that clearly aren't prose — arbitrary selectors, HTML
  // fragment markers, markdown build classes, etc. Stop at the first
  // token that looks like a real word.
  function sanitize(text) {
    var s = String(text == null ? "" : text).trim().replace(/^[">\s]+/, "");
    if (!s) return "";
    var parts = s.split(/\s+/);
    var start = 0;
    // Strict prose-token test: the whole token must be letters,
    // apostrophes, or hyphens, optionally with a single trailing
    // punctuation mark (comma, period, etc.). No digits, brackets,
    // quotes, slashes, underscores, or `>` — all dead giveaways of
    // CSS / HTML fragments that leaked through broken parsing.
    var PROSE = /^[A-Za-z][A-Za-z'\u2018\u2019-]+[.,!?;:]?$/;
    while (start < parts.length) {
      if (PROSE.test(parts[start])) break;
      start++;
    }
    if (start >= parts.length) return "";
    return parts.slice(start).join(" ").trim();
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s); }
})();
