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
  const section = document.querySelector("[data-related]");
  if (!section) return;

  const apiKeyMeta = document.querySelector('meta[name="ghost-content-api-key"]');
  const API_KEY = apiKeyMeta ? apiKeyMeta.getAttribute("content") : "";
  if (!API_KEY) return;

  const API_BASE = `${window.location.origin || ""}/ghost/api/content`;

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s); }

  // ── 1. "More on this theme" grid ────────────────────────────────────

  const grid = section.querySelector("[data-related-grid]");
  if (grid) {
    const postId = section.getAttribute("data-post-id") || "";
    const slugsRaw = section.getAttribute("data-tag-slugs") || "";
    const slugs = slugsRaw.split(",").map((s) => { return s.trim(); }).filter(Boolean);
    let topicSlug = null;
    for (let i = 0; i < slugs.length; i++) {
      if (slugs[i].indexOf("author-") !== 0) { topicSlug = slugs[i]; break; }
    }

    if (topicSlug) {
      const relatedUrl = `${API_BASE}/posts/?key=${encodeURIComponent(API_KEY) 
        }&filter=${encodeURIComponent(`tag:${topicSlug}+id:-${postId}`) 
        }&limit=4&include=tags,authors&fields=id,url,title,feature_image,custom_excerpt,excerpt,published_at,reading_time`;

      fetch(relatedUrl, { cache: "default" })
        .then((r) => { return r.ok ? r.json() : null; })
        .then((data) => {
          if (!data || !Array.isArray(data.posts) || !data.posts.length) return;
          grid.innerHTML = data.posts.map(renderEntry).join("");
        })
        .catch(() => { /* leave server render */ });
    }
  }

  // ── 2. Recent Articles neighbor bylines ─────────────────────────────

  const neighborEntries = section.querySelectorAll("a[data-neighbor-entry][data-post-id]");
  if (neighborEntries.length) {
    const ids = Array.prototype.map.call(neighborEntries, (a) => {
      return a.getAttribute("data-post-id");
    }).filter(Boolean);

    const neighborUrl = `${API_BASE}/posts/?key=${encodeURIComponent(API_KEY) 
      }&filter=${encodeURIComponent(`id:[${ids.join(",")}]`) 
      }&limit=2&include=tags&fields=id`;

    fetch(neighborUrl, { cache: "default" })
      .then((r) => { return r.ok ? r.json() : null; })
      .then((data) => {
        if (!data || !Array.isArray(data.posts)) return;
        data.posts.forEach((p) => {
          const link = section.querySelector(`a[data-neighbor-entry][data-post-id="${p.id}"]`);
          if (!link) return;
          const byline = link.querySelector("[data-byline]");
          if (!byline) return;
          const prefix = '<span class="entry-byline-prefix">By </span>';
          const contributors = (p.tags || []).map((t) => {
            return `<em class="entry-contributor entry-contributor--candidate" data-tag-slug="${ 
              escapeAttr(t.slug)}">${escapeHtml(t.name)}</em>`;
          }).join("");
          byline.innerHTML = prefix + contributors;
        });
      })
      .catch(() => { /* leave server render */ });
  }

  // ── Render helper (used by "More on this theme" grid) ───────────────

  function renderEntry(p) {
    // Validate URL scheme + JSON-stringify into the CSS string so a
    // tampered Ghost feature_image can't break out of the CSS context.
    const plateStyle = (p.feature_image && window.MOSafeHref.isSafe(p.feature_image))
      ? ` style="background-image: url(${escapeAttr(JSON.stringify(p.feature_image))});"`
      : "";

    const topicTags = (p.tags || [])
      .map((t) => {
        return `<span class="entry-topic-tag" data-tag-slug="${escapeAttr(t.slug)}">${escapeHtml(t.name)}</span>`;
      })
      .join("");
    const topic = `<p class="entry-topic entry-topic--candidates" data-topic>${topicTags}</p>`;

    let excerptText = p.custom_excerpt || p.excerpt || "";
    excerptText = String(excerptText).replace(/\s+/g, " ").trim();
    if (excerptText.length > 180) excerptText = `${excerptText.slice(0, 180).replace(/\s+\S*$/, "")}…`;
    const excerpt = excerptText
      ? `<p class="entry-excerpt entry-excerpt-dropcap">` +
          `<span class="entry-initial">${escapeHtml(excerptText.charAt(0))}</span>${ 
          escapeHtml(excerptText.slice(1)) 
        }</p>`
      : "";

    const contributorTags = (p.tags || [])
      .map((t) => {
        return `<em class="entry-contributor entry-contributor--candidate" data-tag-slug="${escapeAttr(t.slug)}">${escapeHtml(t.name)}</em>`;
      })
      .join("");
    const contributorLine =
      `<p class="entry-byline entry-byline-contributors" data-byline>` +
        `<span class="entry-byline-prefix">By </span>${contributorTags 
      }</p>`;
    const fallbackAuthor = (p.authors && p.authors[0] && p.authors[0].name) || "";
    const fallbackLine = fallbackAuthor
      ? `<p class="entry-byline entry-byline-fallback">By <em>${escapeHtml(fallbackAuthor)}</em></p>`
      : "";

    let dateStr = "";
    if (p.published_at) {
      const d = new Date(p.published_at);
      if (!isNaN(d.getTime())) {
        dateStr = d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
      }
    }
    const mins = p.reading_time ? (`${p.reading_time} min read`) : "";
    const metaBits = [dateStr, mins].filter(Boolean).join(" · ");
    const dateLine = metaBits
      ? `<p class="entry-date">${escapeHtml(metaBits)}</p>`
      : "";

    return (
      `<a href="${escapeAttr(window.MOSafeHref.sanitize(p.url, "#"))}" class="entry">` +
        `<div class="entry-plate">` +
          `<div class="entry-plate-inner"${plateStyle}></div>` +
        `</div>` +
        `<div class="entry-text">${ 
          topic 
          }<h3 class="entry-title">${escapeHtml(p.title)}</h3>${ 
          excerpt 
          }<div class="entry-meta">${ 
            contributorLine 
            }${fallbackLine 
            }${dateLine 
          }</div>` +
        `</div>` +
      `</a>`
    );
  }
})();
