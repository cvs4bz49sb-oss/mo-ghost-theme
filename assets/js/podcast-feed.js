/*
 * Podcast feed wiring.
 *
 * Fetches the latest episode for each show from the Cloudflare Worker proxy
 * and replaces the static episode meta + excerpt on the homepage's
 * Patient Conversations section. If the fetch fails (worker not deployed,
 * offline, etc.) the static fallback copy stays put.
 *
 * Configure by setting the theme's `podcast_feed_url` custom setting. The
 * theme exposes it as data-podcast-feed-url on <body>.
 */
(function () {
  var FEED_URL = document.body.getAttribute("data-podcast-feed-url") || "";
  if (!FEED_URL) return;

  fetch(FEED_URL + (FEED_URL.indexOf("?") > -1 ? "&" : "?") + "limit=1", { cache: "default" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (!data) return;
      document.querySelectorAll(".pod-entry[data-show]").forEach(function (entry) {
        var slug = entry.getAttribute("data-show");
        var show = data[slug];
        if (!show || show.error || !show.episodes || !show.episodes[0]) return;
        var ep = show.episodes[0];

        var topicEl = entry.querySelector("[data-ep-topic]");
        if (topicEl) topicEl.textContent = formatTopic(ep);

        var titleEl = entry.querySelector("[data-ep-title]");
        if (titleEl && show.show && show.show.title) {
          titleEl.textContent = show.show.title;
        }

        var excerptEl = entry.querySelector("[data-ep-excerpt]");
        if (excerptEl && ep.description) {
          var summary = ep.description.replace(/\s+/g, " ").slice(0, 180).trim();
          var initial = summary.charAt(0) || "";
          var rest = summary.slice(1);
          excerptEl.innerHTML = '<span class="pod-initial">' +
            escapeHtml(initial) + "</span>" + escapeHtml(rest);
        }

        if (ep.link) entry.setAttribute("href", ep.link);
      });
    })
    .catch(function () { /* static fallback stays */ });

  function formatTopic(ep) {
    var parts = [];
    if (ep.episode) parts.push("Episode " + ep.episode);
    if (ep.pubDate) {
      var d = new Date(ep.pubDate);
      if (!isNaN(d.getTime())) {
        parts.push(d.toLocaleDateString("en-US", {
          month: "long", day: "numeric", year: "numeric"
        }));
      }
    }
    return parts.join(" \u00b7 ");
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
