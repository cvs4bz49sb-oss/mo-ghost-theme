/*
 * Podcast feed wiring.
 *
 * Fetches the Cloudflare Worker proxy (which now hits Captivate's
 * API for Mere Fidelity and falls back to RSS for shows still on
 * Libsyn/Anchor), flattens episodes across shows, sorts by publish
 * date descending, and renders cards in any [data-show] grid on
 * the page. The worker's enriched payload includes per-episode
 * artwork, episode/season numbers, slugs, transcript availability,
 * and a Captivate player embed URL when available — those drive
 * the show-page card variant.
 *
 * Per-show Apple/Spotify URLs are read from data-* attributes on
 * the .listen-grid so they can be edited in Ghost admin via
 * @custom settings (podcast_mf_apple_url, etc.).
 *
 * Configure the theme's `podcast_feed_url` custom setting to the
 * deployed worker URL. When unset or the fetch fails, the static
 * fallback markup stays put.
 */
(function () {
  var FEED_URL = document.body.getAttribute("data-podcast-feed-url") || "";
  if (!FEED_URL) return;

  var grid = document.querySelector(".listen-grid");
  if (!grid) return;

  var isCoversLayout = grid.getAttribute("data-layout") === "covers";

  // data-show (optional): filter episodes to a single show slug on
  // dedicated podcast pages. When absent (homepage), all shows merge.
  // When present, render the full-detail card variant (artwork,
  // iframe player, transcript link). When absent, stay compact.
  var showFilter = grid.getAttribute("data-show") || "";
  var isShowPage = !!showFilter;
  var showLimit = parseInt(grid.getAttribute("data-show-limit"), 10);
  if (!showLimit || showLimit <= 0) showLimit = isShowPage ? 8 : 4;

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

  // Most-Listened side rail. Show page only. Lives outside the
  // .listen-grid so it has its own root; the same fetch below
  // populates both lists.
  var mostListenedRoot = isShowPage
    ? document.querySelector('[data-most-listened][data-show="' + cssEscape(showFilter) + '"]')
    : null;

  var feedLimit = isShowPage ? Math.max(showLimit, 12) : 5;
  var qsParts = ["limit=" + feedLimit];
  if (mostListenedRoot) qsParts.push("top=true");
  var url = FEED_URL + (FEED_URL.indexOf("?") > -1 ? "&" : "?") + qsParts.join("&");
  fetch(url, { cache: "default" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (!data) return;
      var all = [];
      Object.keys(data).forEach(function (slug) {
        if (showFilter && slug !== showFilter) return;
        var payload = data[slug];
        if (!payload || payload.error || !Array.isArray(payload.episodes)) return;
        var showTitle = (payload.show && payload.show.title) || slug;
        payload.episodes.forEach(function (ep) {
          if (!ep) return;
          var ts = ep.pubDate ? Date.parse(ep.pubDate) : NaN;
          all.push({
            // Show context.
            showSlug: slug,
            showTitle: showTitle,
            // Episode core.
            id: ep.id || ep.captivateId || "",
            captivateId: ep.captivateId || "",
            episodeSlug: ep.slug || "",
            title: ep.title || "",
            description: ep.description || "",
            ts: isNaN(ts) ? 0 : ts,
            episode: ep.episode || "",
            season: ep.season || "",
            duration: ep.duration || "",
            artwork: ep.artwork || "",
            // Transcripts + embed (Captivate-only fields).
            hasTranscript: !!ep.hasTranscript,
            transcriptUrl: ep.transcriptUrl || "",
            embedUrl: ep.embedUrl || "",
          });
        });
      });

      if (isCoversLayout) {
        renderCoversLayout(data);
      } else if (all.length) {
        all.sort(function (a, b) { return b.ts - a.ts; });
        var top = all.slice(0, showLimit);
        grid.innerHTML = top.map(isShowPage ? renderShowCard : renderCompactCard).join("");
      }

      // Most Listened sidebar — Captivate insights, only shown when
      // the worker returned a topEpisodes array for the current
      // show. Silent failure: if the array is empty or missing, the
      // <section hidden> stays hidden.
      if (mostListenedRoot && data[showFilter] && Array.isArray(data[showFilter].topEpisodes)) {
        renderMostListened(mostListenedRoot, data[showFilter].topEpisodes, showFilter);
      }
    })
    .catch(function () { /* static fallback stays */ });

  // ─── Compact card (homepage Listen rail, mixed shows) ──────────

  function renderCompactCard(ep) {
    var date = ep.ts
      ? new Date(ep.ts).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "";
    var topicHtml = "";
    if (ep.showTitle) topicHtml += '<p class="pod-topic">' + escapeHtml(ep.showTitle) + "</p>";
    if (date) topicHtml += '<p class="pod-date">' + escapeHtml(date) + "</p>";

    var summary = sanitize(ep.description).replace(/\s+/g, " ").slice(0, 180).trim();
    var excerpt = summary
      ? '<p class="pod-excerpt">' + escapeHtml(summary) + "</p>"
      : "";

    var linksBlock = renderListenLinks(ep);

    return (
      '<article class="pod-entry pod-entry--episode" data-show="' + escapeAttr(ep.showSlug) + '">' +
      topicHtml +
      '<h3 class="pod-title"><em>' + escapeHtml(ep.title) + "</em></h3>" +
      excerpt +
      linksBlock +
      "</article>"
    );
  }

  // ─── Show-page card (full detail, single show) ─────────────────
  //
  // Layout:
  //   meta row  : SHOW · DATE · EP NN
  //   title     : italic display
  //   embed     : Captivate iframe (lazy-loaded, only if embedUrl set)
  //   excerpt   : description
  //   footer    : "Listen on Apple | Spotify"  ·  "Read transcript →"

  function renderShowCard(ep) {
    var date = ep.ts
      ? new Date(ep.ts).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "";
    var metaParts = [];
    if (ep.showTitle) metaParts.push('<span class="pod-meta-show">' + escapeHtml(ep.showTitle) + '</span>');
    if (date) metaParts.push('<span class="pod-meta-date">' + escapeHtml(date) + '</span>');
    if (ep.episode) metaParts.push('<span class="pod-meta-ep">Ep ' + escapeHtml(String(ep.episode)) + '</span>');
    var metaHtml = metaParts.length
      ? '<p class="pod-meta">' + metaParts.join('<span class="pod-meta-sep" aria-hidden="true"> · </span>') + '</p>'
      : "";

    var summary = sanitize(ep.description).replace(/\s+/g, " ").slice(0, 240).trim();
    var excerpt = summary
      ? '<p class="pod-excerpt">' + escapeHtml(summary) + "</p>"
      : "";

    var embed = ep.embedUrl
      ? '<div class="pod-embed">' +
        '<iframe src="' + escapeAttr(ep.embedUrl) + '" loading="lazy" frameborder="0" scrolling="no" title="Listen to ' + escapeAttr(ep.title) + '"></iframe>' +
        '</div>'
      : "";

    var transcriptLink = ep.hasTranscript && ep.transcriptUrl
      ? '<a class="pod-transcript-link" href="' + escapeAttr(absoluteWorkerUrl(ep.transcriptUrl)) + '">Read transcript &rarr;</a>'
      : "";

    var listenBlock = renderListenLinks(ep);

    var footerInner = [listenBlock, transcriptLink].filter(Boolean).join("");
    var footer = footerInner
      ? '<div class="pod-footer">' + footerInner + '</div>'
      : "";

    var idAttr = ep.id ? ' id="ep-' + escapeAttr(ep.id) + '"' : "";
    return (
      '<article class="pod-entry pod-entry--episode pod-entry--full"' + idAttr + ' data-show="' + escapeAttr(ep.showSlug) + '">' +
      metaHtml +
      '<h3 class="pod-title"><em>' + escapeHtml(ep.title) + "</em></h3>" +
      embed +
      excerpt +
      footer +
      "</article>"
    );
  }

  function renderListenLinks(ep) {
    var p = platforms[ep.showSlug] || {};
    var links = [];
    if (p.apple) {
      links.push('<a href="' + escapeAttr(p.apple) + '" target="_blank" rel="noopener">Apple</a>');
    }
    if (p.spotify) {
      links.push('<a href="' + escapeAttr(p.spotify) + '" target="_blank" rel="noopener">Spotify</a>');
    }
    if (!links.length) return "";
    return (
      '<div class="pod-listen"><p class="pod-listen-label">Listen</p><p class="pod-listen-platforms">' +
      links.join('<span class="pod-listen-sep" aria-hidden="true"> | </span>') +
      "</p></div>"
    );
  }

  // ─── Most Listened sidebar ─────────────────────────────────────

  function renderMostListened(root, items, showSlug) {
    var list = root.querySelector("[data-most-listened-list]");
    if (!list || !items || !items.length) return;

    var ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
    var rows = items.slice(0, 5).map(function (ep, i) {
      var numeral = ROMAN[i] || String(i + 1);
      var titleHtml = escapeHtml(ep.title || "");
      // Link to the transcript when available (deeper engagement);
      // fall back to a hash anchor that scrolls to the embed in
      // the main list. If the main list doesn't have IDs yet, the
      // anchor is harmless — it just scrolls to top.
      var href = ep.hasTranscript && ep.transcriptUrl
        ? absoluteWorkerUrl(ep.transcriptUrl)
        : (ep.id ? "#ep-" + escapeAttr(ep.id) : "#");
      return (
        '<li class="podcast-most-listened-item">' +
          '<a class="podcast-most-listened-link" href="' + escapeAttr(href) + '">' +
            '<span class="podcast-most-listened-numeral">' + numeral + '</span>' +
            '<span class="podcast-most-listened-title"><em>' + titleHtml + '</em></span>' +
          '</a>' +
        '</li>'
      );
    });
    list.innerHTML = rows.join("");
    root.removeAttribute("hidden");
  }

  // Handles slug values for use in CSS attribute selectors. Older
  // browsers don't have CSS.escape — ours doesn't need full
  // escaping, just a safety net for unexpected characters.
  function cssEscape(s) {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return CSS.escape(s);
    }
    return String(s || "").replace(/[^a-zA-Z0-9\-_]/g, "");
  }

  // The transcript URL from the worker is a relative path
  // (/transcript/<show>/<slug>/) — turn it into an absolute URL
  // pointing at the worker. Post-domain-flip, when transcripts are
  // proxied through mereorthodoxy.com, this shim becomes a no-op.
  function absoluteWorkerUrl(path) {
    if (/^https?:\/\//i.test(path)) return path;
    try {
      var base = new URL(FEED_URL);
      return base.origin + path;
    } catch (e) {
      return path;
    }
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
    var PROSE = /^[A-Za-z][A-Za-z'‘’-]+[.,!?;:]?$/;
    while (start < parts.length) {
      if (PROSE.test(parts[start])) break;
      start++;
    }
    if (start >= parts.length) return "";
    return parts.slice(start).join(" ").trim();
  }

  // ─── Covers layout (homepage — cover art + latest episode) ─────

  function renderCoversLayout(data) {
    var showDivs = grid.querySelectorAll(".pod-show[data-show]");
    for (var i = 0; i < showDivs.length; i++) {
      var div = showDivs[i];
      var slug = div.getAttribute("data-show");
      var payload = data[slug];
      if (!payload || payload.error || !Array.isArray(payload.episodes) || !payload.episodes.length) continue;

      var eps = payload.episodes.slice().sort(function (a, b) {
        return (Date.parse(b.pubDate) || 0) - (Date.parse(a.pubDate) || 0);
      });
      var ep = eps[0];
      var target = div.querySelector(".pod-show-latest");
      if (!target) continue;

      var date = ep.pubDate
        ? new Date(Date.parse(ep.pubDate)).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
        : "";
      var summary = sanitize(ep.description || "").replace(/\s+/g, " ").slice(0, 160).trim();

      var p = platforms[slug] || {};
      var links = [];
      if (p.apple) links.push('<a href="' + escapeAttr(p.apple) + '" target="_blank" rel="noopener">Apple</a>');
      if (p.spotify) links.push('<a href="' + escapeAttr(p.spotify) + '" target="_blank" rel="noopener">Spotify</a>');
      var listenHtml = links.length
        ? '<div class="pod-listen"><p class="pod-listen-label">Listen</p><p class="pod-listen-platforms">' +
          links.join('<span class="pod-listen-sep" aria-hidden="true"> | </span>') +
          '</p></div>'
        : '';

      target.innerHTML =
        '<p class="pod-show-ep-label">Latest Episode</p>' +
        (date ? '<p class="pod-show-ep-date">' + escapeHtml(date) + '</p>' : '') +
        '<h3 class="pod-title"><em>' + escapeHtml(ep.title || "") + '</em></h3>' +
        (summary ? '<p class="pod-excerpt">' + escapeHtml(summary) + '</p>' : '') +
        listenHtml;
    }
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s); }
})();
