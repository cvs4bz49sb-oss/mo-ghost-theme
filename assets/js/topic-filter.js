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
  const defaultView = document.querySelector(".today-default");
  const tagView = document.querySelector(".today-tag");
  const pills = document.querySelectorAll(".topic-pill");

  if (!pills.length || !defaultView || !tagView) return;

  const apiKeyMeta = document.querySelector('meta[name="ghost-content-api-key"]');
  const API_KEY = apiKeyMeta ? apiKeyMeta.getAttribute("content") : "";
  const API_BASE = `${window.location.origin || ""}/ghost/api/content`;

  const plateGradients = {
    1: "linear-gradient(135deg, #4a3f36 0%, #2d2927 100%)",
    2: "linear-gradient(135deg, #e6d5b8 0%, #c8b898 100%)",
    3: "linear-gradient(135deg, #6b6660 0%, #3a332e 100%)",
    4: "linear-gradient(135deg, #c1593c 0%, #8a3e29 100%)",
    5: "linear-gradient(135deg, #d9c6a7 0%, #a89677 100%)",
    6: "linear-gradient(135deg, #2d2927 0%, #5a4a3e 100%)",
    7: "linear-gradient(135deg, #ee7d51 0%, #c1593c 100%)"
  };

  pills.forEach((pill) => {
    pill.addEventListener("click", (e) => {
      const tag = pill.getAttribute("data-tag");
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

      const label = pill.textContent.trim();
      renderLoading(label);

      const url = `${API_BASE}/posts/?key=${encodeURIComponent(API_KEY) 
        }&filter=${encodeURIComponent(`tag:${tag}`) 
        }&limit=6&include=authors,tags`;

      fetch(url, { credentials: "omit" })
        .then((r) => { return r.ok ? r.json() : null; })
        .then((data) => {
          if (!data || !data.posts || !data.posts.length) {
            // eslint-disable-next-line no-restricted-syntax -- href attr is theme-rendered, fallback is same-origin path literal
            window.location.href = pill.getAttribute("href") || (`/tag/${tag}/`);
            return;
          }
          renderTag(tag, label, data.posts);
          defaultView.hidden = true;
          tagView.hidden = false;
        })
        .catch(() => {
          // eslint-disable-next-line no-restricted-syntax -- href attr is theme-rendered, fallback is same-origin path literal
          window.location.href = pill.getAttribute("href") || (`/tag/${tag}/`);
        });
    });
  });

  function setActive(pill) {
    pills.forEach((p) => { p.classList.remove("is-active"); });
    pill.classList.add("is-active");
  }

  function renderLoading(label) {
    tagView.innerHTML =
      `<div class="tag-header">` +
        `<p class="eyebrow">Filed under</p>` +
        `<h3>${escapeHtml(label)}</h3>` +
      `</div>`;
    tagView.hidden = false;
    defaultView.hidden = true;
  }

  function renderTag(slug, label, posts) {
    const entries = posts.map(entryHtml).join("");
    tagView.innerHTML =
      `<div class="tag-header">` +
        `<p class="eyebrow">Filed under</p>` +
        `<h3>${escapeHtml(label)}</h3>` +
      `</div>` +
      `<div class="week-grid">${entries}</div>` +
      `<div class="tag-more">` +
        `<a href="/tag/${encodeURIComponent(slug)}/" class="tag-more-link">Read more in ${escapeHtml(label)} \u2192</a>` +
      `</div>`;
  }

  function entryHtml(post, i) {
    let excerpt = (post.custom_excerpt || post.excerpt || "").replace(/\s+/g, " ").trim();
    if (excerpt.length > 220) excerpt = `${excerpt.slice(0, 220).replace(/\s+\S*$/, "")}\u2026`;
    const first = excerpt.charAt(0);
    const rest = excerpt.slice(1);
    const date = formatDate(post.published_at);
    const readingTime = post.reading_time ? `${post.reading_time} min` : "";
    const meta = [date, readingTime].filter(Boolean).join(" \u00b7 ");

    let bgStyle = "";
    if (post.feature_image && window.MOSafeHref.isSafe(post.feature_image)) {
      // JSON-stringify into the CSS string so a tampered feature_image
      // can't break out via `");` or quote characters.
      bgStyle = `style="background-image: url(${escapeAttr(JSON.stringify(post.feature_image))});"`;
    } else {
      const plate = plateGradients[(i % 7) + 1];
      bgStyle = `style="background: ${plate};"`;
    }

    // Topic eyebrow: every public tag as a candidate. CSS hides
    // author-* slugs and shows the first remaining one. Matches the
    // .entry-topic--candidates pattern in post-entry.hbs.
    const tags = Array.isArray(post.tags) ? post.tags : [];
    const topicTags = tags.map((t) => {
      return `<span class="entry-topic-tag" data-tag-slug="${escapeAttr(t.slug || "")}">${ 
        escapeHtml(t.name || "")}</span>`;
    }).join("");
    const topic = `<p class="entry-topic entry-topic--candidates" data-topic>${topicTags}</p>`;

    // Byline: contributor override when any author-* tag exists,
    // otherwise falls back to primary_author. CSS handles both.
    const contributorTags = tags.map((t) => {
      return `<em class="entry-contributor entry-contributor--candidate" data-tag-slug="${escapeAttr(t.slug || "")}">${ 
        escapeHtml(t.name || "")}</em>`;
    }).join("");
    const contributorLine =
      `<p class="entry-byline entry-byline-contributors" data-byline>` +
        `<span class="entry-byline-prefix">By </span>${contributorTags 
      }</p>`;
    const fallbackName = (post.primary_author && post.primary_author.name) || "";
    const fallbackLine = fallbackName
      ? `<p class="entry-byline entry-byline-fallback">By <em>${escapeHtml(fallbackName)}</em></p>`
      : "";

    // Codex audit 2026-05-11: Ghost Content API URLs are theme-trusted
    // but Codex flagged this as a missing MOSafeHref pass. Belt-and-
    // braces: validate scheme before render. MOSafeHref.sanitize falls
    // back to "" for unsafe schemes, which escapeAttr then renders as
    // a no-op href — far safer than `javascript:` slipping through.
    const safePostUrl = window.MOSafeHref ? window.MOSafeHref.sanitize(post.url) : post.url;
    return `` +
      `<a href="${escapeAttr(safePostUrl)}" class="entry">` +
        `<div class="entry-plate">` +
          `<div class="entry-plate-inner" ${bgStyle}></div>` +
        `</div>` +
        `<div class="entry-text">${ 
          topic 
          }<h3 class="entry-title">${escapeHtml(post.title)}</h3>${ 
          excerpt ? `<p class="entry-excerpt">` +
            `<span class="entry-initial">${escapeHtml(first)}</span>${ 
            escapeHtml(rest)}</p>` : '' 
          }<div class="entry-meta">${ 
            contributorLine 
            }${fallbackLine 
            }${meta ? `<p class="entry-date">${escapeHtml(meta)}</p>` : '' 
          }</div>` +
        `</div>` +
      `</a>`;
  }

  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function escapeAttr(s) {
    return escapeHtml(s);
  }
})();
