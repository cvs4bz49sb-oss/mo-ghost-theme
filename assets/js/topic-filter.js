/*
 * Topic rail filter.
 *
 * Clicking a tag pill on the homepage swaps the default Today/Most Read view
 * for a grid of articles tagged with that topic, plus a "Read more in X" link
 * to the full tag archive page.
 *
 * Posts are fetched client-side from Ghost's Content API. The API key is read
 * from a <meta name="ghost-content-api-key"> tag injected by default.hbs when
 * the theme's content_api_key custom setting is configured.
 *
 * If the key is missing, the fetch fails, or the API returns no results, the
 * pill click falls through to the tag's own archive page (the anchor's href).
 */
(function () {
  var defaultView = document.querySelector(".today-default");
  var tagView = document.querySelector(".today-tag");
  var pills = document.querySelectorAll(".topic-pill");

  if (!pills.length || !defaultView || !tagView) return;

  var apiKeyMeta = document.querySelector('meta[name="ghost-content-api-key"]');
  var API_KEY = apiKeyMeta ? apiKeyMeta.getAttribute("content") : "";
  var API_BASE = (window.location.origin || "") + "/ghost/api/content";

  var plateGradients = {
    1: "linear-gradient(135deg, #4a3f36 0%, #2d2927 100%)",
    2: "linear-gradient(135deg, #e6d5b8 0%, #c8b898 100%)",
    3: "linear-gradient(135deg, #6b6660 0%, #3a332e 100%)",
    4: "linear-gradient(135deg, #c1593c 0%, #8a3e29 100%)",
    5: "linear-gradient(135deg, #d9c6a7 0%, #a89677 100%)",
    6: "linear-gradient(135deg, #2d2927 0%, #5a4a3e 100%)",
    7: "linear-gradient(135deg, #ee7d51 0%, #c1593c 100%)"
  };

  pills.forEach(function (pill) {
    pill.addEventListener("click", function (e) {
      var tag = pill.getAttribute("data-tag");
      if (!tag) return;

      if (tag === "recent") {
        e.preventDefault();
        setActive(pill);
        defaultView.hidden = false;
        tagView.hidden = true;
        tagView.innerHTML = "";
        return;
      }

      // No API key configured — let the click navigate to the tag archive.
      if (!API_KEY) return;

      e.preventDefault();
      setActive(pill);

      var label = pill.textContent.trim();
      renderLoading(label);

      var url = API_BASE + "/posts/?key=" + encodeURIComponent(API_KEY) +
        "&filter=" + encodeURIComponent("tag:" + tag) +
        "&limit=6&include=authors,tags";

      fetch(url, { credentials: "omit" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (!data || !data.posts || !data.posts.length) {
            window.location.href = pill.getAttribute("href") || ("/tag/" + tag + "/");
            return;
          }
          renderTag(tag, label, data.posts);
          defaultView.hidden = true;
          tagView.hidden = false;
        })
        .catch(function () {
          window.location.href = pill.getAttribute("href") || ("/tag/" + tag + "/");
        });
    });
  });

  function setActive(pill) {
    pills.forEach(function (p) { p.classList.remove("is-active"); });
    pill.classList.add("is-active");
  }

  function renderLoading(label) {
    tagView.innerHTML =
      '<div class="tag-header">' +
        '<p class="eyebrow">Filed under</p>' +
        '<h3>' + escapeHtml(label) + '</h3>' +
      '</div>';
    tagView.hidden = false;
    defaultView.hidden = true;
  }

  function renderTag(slug, label, posts) {
    var entries = posts.map(entryHtml).join("");
    tagView.innerHTML =
      '<div class="tag-header">' +
        '<p class="eyebrow">Filed under</p>' +
        '<h3>' + escapeHtml(label) + '</h3>' +
      '</div>' +
      '<div class="week-grid">' + entries + '</div>' +
      '<div class="tag-more">' +
        '<a href="/tag/' + encodeURIComponent(slug) + '/" class="tag-more-link">Read more in ' + escapeHtml(label) + ' \u2192</a>' +
      '</div>';
  }

  function entryHtml(post, i) {
    var topic = post.primary_tag ? post.primary_tag.name : "";
    var author = post.primary_author ? post.primary_author.name : "";
    var excerpt = (post.custom_excerpt || post.excerpt || "").replace(/\s+/g, " ").trim();
    if (excerpt.length > 220) excerpt = excerpt.slice(0, 220).replace(/\s+\S*$/, "") + "\u2026";
    var first = excerpt.charAt(0);
    var rest = excerpt.slice(1);
    var date = formatDate(post.published_at);
    var readingTime = post.reading_time ? post.reading_time + " min" : "";
    var meta = [date, readingTime].filter(Boolean).join(" \u00b7 ");

    var bgStyle = "";
    if (post.feature_image) {
      bgStyle = 'style="background-image: url(' + post.feature_image + ');"';
    } else {
      var plate = plateGradients[(i % 7) + 1];
      bgStyle = 'style="background: ' + plate + ';"';
    }

    return '' +
      '<a href="' + escapeAttr(post.url) + '" class="entry">' +
        '<div class="entry-plate">' +
          '<div class="entry-plate-inner" ' + bgStyle + '></div>' +
        '</div>' +
        '<div class="entry-text">' +
          (topic ? '<p class="entry-topic">' + escapeHtml(topic) + '</p>' : '') +
          '<h3 class="entry-title">' + escapeHtml(post.title) + '</h3>' +
          (excerpt ? '<p class="entry-excerpt">' +
            '<span class="entry-initial">' + escapeHtml(first) + '</span>' +
            escapeHtml(rest) + '</p>' : '') +
          '<div class="entry-meta">' +
            (author ? '<p class="entry-byline">By <em>' + escapeHtml(author) + '</em></p>' : '<span></span>') +
            (meta ? '<p class="entry-date">' + escapeHtml(meta) + '</p>' : '') +
          '</div>' +
        '</div>' +
      '</a>';
  }

  function formatDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
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
