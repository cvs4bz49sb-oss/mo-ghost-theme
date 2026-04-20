/*
 * Podcast feed wiring.
 *
 * Fetches the Cloudflare Worker proxy (which merges both podcast
 * RSS feeds into one JSON payload), flattens every episode across
 * shows, sorts by publish date descending, and renders the four
 * most recent as cards in the homepage Listen section.
 *
 * Configure the theme's `podcast_feed_url` custom setting to the
 * deployed Worker URL. The theme exposes it as
 * data-podcast-feed-url on <body>. When unset or the fetch fails,
 * the static fallback markup in index.hbs stays put.
 */
(function () {
  var FEED_URL = document.body.getAttribute("data-podcast-feed-url") || "";
  if (!FEED_URL) return;

  var grid = document.querySelector(".listen-grid");
  if (!grid) return;

  // Ask the worker for the 5 latest per show; we'll merge + trim to 4
  // client-side so a single show can't hog the layout when the other
  // is quiet.
  var url = FEED_URL + (FEED_URL.indexOf("?") > -1 ? "&" : "?") + "limit=5";
  console.log("[podcast-feed] fetching", url);
  fetch(url, { cache: "default" })
    .then(function (r) {
      console.log("[podcast-feed] response", r.status, r.ok);
      return r.ok ? r.json() : null;
    })
    .then(function (data) {
      if (!data) {
        console.warn("[podcast-feed] no data returned; keeping fallback");
        return;
      }
      console.log("[podcast-feed] shows:", Object.keys(data));
      var all = [];
      Object.keys(data).forEach(function (slug) {
        var payload = data[slug];
        if (!payload || payload.error || !Array.isArray(payload.episodes)) {
          console.warn("[podcast-feed] skipping", slug, payload && payload.error);
          return;
        }
        var showTitle = (payload.show && payload.show.title) || slug;
        payload.episodes.forEach(function (ep) {
          if (!ep) return;
          var ts = ep.pubDate ? Date.parse(ep.pubDate) : NaN;
          all.push({
            slug: slug,
            showTitle: showTitle,
            title: ep.title || "",
            link: ep.link || "#",
            description: ep.description || "",
            pubDate: ep.pubDate || "",
            ts: isNaN(ts) ? 0 : ts,
            episode: ep.episode || "",
          });
        });
      });

      console.log("[podcast-feed] episodes collected:", all.length);
      if (!all.length) return;
      all.sort(function (a, b) { return b.ts - a.ts; });
      var top = all.slice(0, 4);

      grid.innerHTML = top.map(renderCard).join("");
      console.log("[podcast-feed] rendered", top.length, "cards");
    })
    .catch(function (err) {
      console.error("[podcast-feed] fetch failed:", err);
    });

  function renderCard(ep) {
    var date = ep.ts
      ? new Date(ep.ts).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "";
    var topicBits = [];
    if (ep.showTitle) topicBits.push(escapeHtml(ep.showTitle));
    if (date) topicBits.push(escapeHtml(date));
    var topic = topicBits.join(" \u00b7 ");

    var summary = String(ep.description).replace(/\s+/g, " ").slice(0, 180).trim();
    var initial = summary.charAt(0) || "";
    var rest = summary.slice(1);
    var excerpt = summary
      ? '<span class="pod-initial">' + escapeHtml(initial) + "</span>" + escapeHtml(rest)
      : "";

    return (
      '<a href="' + escapeAttr(ep.link) + '" class="pod-entry" data-show="' + escapeAttr(ep.slug) + '">' +
      '<p class="pod-topic">' + topic + "</p>" +
      '<h3 class="pod-title">' + escapeHtml(ep.title) + "</h3>" +
      (excerpt ? '<p class="pod-excerpt pod-excerpt-dropcap">' + excerpt + "</p>" : "") +
      '<span class="pod-listen-link">Listen &rarr;</span>' +
      "</a>"
    );
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function escapeAttr(s) {
    return escapeHtml(s);
  }
})();
