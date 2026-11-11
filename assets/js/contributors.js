/*
 * Contributors page — full-list loader + alphabet/threshold filter.
 *
 * A page may hold more than one grid. Every `[data-contributors-grid]`
 * is configured independently via data attributes, and the Content API
 * roster is fetched once and applied to all of them:
 *
 *   data-mode="curated"      — /contributors/. Shows only the writers
 *                              the grid names. No alphabet rail. A
 *                              "+ View All" link points to
 *                              /contributors/all/.
 *   data-mode="all"          — /contributors/all/. Shows every
 *                              contributor with at least one post,
 *                              sorted by last name. Alphabet rail and
 *                              empty-state are wired up. At most one
 *                              grid per page may be in this mode.
 *
 *   data-curated             — last-name spec (see parseCuratedSpec).
 *   data-curated-slugs       — exact tag slugs, comma separated. Takes
 *                              precedence over data-curated. Use this
 *                              whenever a named writer shares a surname
 *                              with someone who is not on the list.
 *   data-exclude-slugs       — exact tag slugs to drop from this grid,
 *                              so a writer listed in a section above
 *                              isn't listed again below.
 *   data-heading="h3"        — render card names as h3 instead of h2,
 *                              for pages where a section h2 sits above
 *                              the grid.
 *
 * Ghost's {{#get "tags"}} helper returns a single page of the Content
 * API (max 100 tags), which truncates the roster once the corpus has
 * more than 100 public tags. This script fetches every page, filters
 * to contributor tags (slug prefix "author-") with at least one post,
 * rebuilds each grid, and wires up the alphabet rail on the "all" page.
 *
 * If the Content API key isn't present or the fetch fails, the
 * server-rendered first page stays in place.
 */
(function () {
  const grids = Array.prototype.slice.call(document.querySelectorAll("[data-contributors-grid]"));
  if (!grids.length) return;

  // The alphabet rail, empty state and letter filter belong to the one
  // grid in "all" mode. /contributors/ has none.
  const allGrid = grids.filter((g) => { return gridMode(g) === "all"; })[0] || null;

  const rail = document.querySelector("[data-contributors-rail]");
  const railInner = document.querySelector("[data-contributors-rail-inner]");
  const emptyEl = document.querySelector("[data-contributors-empty]");
  const emptyLetterEl = emptyEl ? emptyEl.querySelector("[data-empty-letter]") : null;

  let activeLetter = "all";

  const apiKeyMeta = document.querySelector('meta[name="ghost-content-api-key"]');
  const API_KEY = apiKeyMeta ? apiKeyMeta.getAttribute("content") : "";

  if (API_KEY) {
    loadFullRoster();
  } else {
    // No API access — wire up the existing SSR cards as-is.
    filterSSR();
    initFilter();
  }

  function gridMode(grid) {
    return grid.getAttribute("data-mode") || "all";
  }

  // Read one grid's configuration off its data attributes.
  function gridConfig(grid) {
    return {
      mode: gridMode(grid),
      curated: grid.getAttribute("data-curated") || "",
      slugs: splitList(grid.getAttribute("data-curated-slugs")),
      exclude: splitList(grid.getAttribute("data-exclude-slugs")),
      heading: grid.getAttribute("data-heading") === "h3" ? "h3" : "h2"
    };
  }

  function splitList(value) {
    if (!value) return [];
    return value.split(",").map((s) => { return s.trim(); }).filter(Boolean);
  }

  function loadFullRoster() {
    const apiBase = `${window.location.origin || ""}/ghost/api/content/tags/`;
    function pageUrl(page) {
      return `${apiBase}?key=${encodeURIComponent(API_KEY)
        }&filter=${encodeURIComponent("visibility:public")
        }&include=count.posts` +
        `&order=${encodeURIComponent("name asc")
        }&limit=100&page=${page}`;
    }
    fetch(pageUrl(1), { cache: "default" })
      .then((r) => { return r.ok ? r.json() : null; })
      .then((first) => {
        if (!first || !first.tags) return null;
        const totalPages = (first.meta && first.meta.pagination && first.meta.pagination.pages) || 1;
        if (totalPages <= 1) return first.tags;
        const rest = [];
        for (let i = 2; i <= totalPages; i++) {
          rest.push(
            fetch(pageUrl(i), { cache: "default" })
              .then((r) => { return r.ok ? r.json() : null; })
              .then((d) => { return (d && d.tags) || []; })
          );
        }
        return Promise.all(rest).then((pages) => {
          return pages.reduce((acc, t) => { return acc.concat(t); }, first.tags.slice());
        });
      })
      .then((tags) => {
        if (tags) {
          const authors = tags.filter((t) => {
            return t && t.slug && t.slug.indexOf("author-") === 0 &&
              t.count && t.count.posts > 0;
          }).sort((a, b) => {
            const la = lastName(a.name), lb = lastName(b.name);
            return la.localeCompare(lb) || a.name.localeCompare(b.name);
          });
          grids.forEach((grid) => { renderGrid(grid, authors); });
        } else {
          filterSSR();
        }
        initFilter();
      })
      .catch(() => { initFilter(); });
  }

  // Replace one grid's SSR contents with its slice of the roster. A
  // slice that comes back empty leaves the SSR markup alone rather than
  // blanking the section — an API hiccup or a renamed tag should not
  // read as "nobody writes here".
  function renderGrid(grid, authors) {
    const cfg = gridConfig(grid);
    let list = authors;
    if (cfg.exclude.length) {
      list = list.filter((t) => { return cfg.exclude.indexOf(t.slug) === -1; });
    }
    if (cfg.slugs.length) {
      list = list.filter((t) => { return cfg.slugs.indexOf(t.slug) > -1; });
    } else if (cfg.mode === "curated" && cfg.curated) {
      list = filterToCurated(list, cfg.curated);
    }
    if (list.length) {
      grid.innerHTML = list.map((t) => { return renderCard(t, cfg.heading); }).join("");
    }
  }

  // ── Curated filtering ────────────────────────────────────────

  // Parse the data-curated spec into matchers.
  // Each entry is either "LastName" (match all) or "LastName:Prefix"
  // (match only when first name starts with Prefix).
  function parseCuratedSpec(spec) {
    if (!spec) return [];
    return spec.split(",").map((entry) => {
      const trimmed = entry.trim();
      const colonIdx = trimmed.indexOf(":");
      if (colonIdx > -1) {
        return {
          last: trimmed.substring(0, colonIdx).trim().toLowerCase(),
          prefix: trimmed.substring(colonIdx + 1).trim().toLowerCase()
        };
      }
      return { last: trimmed.toLowerCase(), prefix: "" };
    });
  }

  function matchesSpec(name, matchers) {
    const authorLast = lastName(name).toLowerCase();
    const authorFirst = firstName(name).toLowerCase();
    for (let i = 0; i < matchers.length; i++) {
      const m = matchers[i];
      if (authorLast !== m.last) continue;
      if (m.prefix && authorFirst.indexOf(m.prefix) !== 0) continue;
      return true;
    }
    return false;
  }

  function filterToCurated(authors, spec) {
    const matchers = parseCuratedSpec(spec);
    const matched = [];
    const used = {}; // track which authors have been matched

    authors.forEach((author) => {
      if (!matchesSpec(author.name, matchers)) return;
      if (used[author.slug]) return;
      matched.push(author);
      used[author.slug] = true;
    });

    return matched;
  }

  // SSR fallback: hide the cards each grid shouldn't be showing.
  function filterSSR() {
    grids.forEach((grid) => {
      const cfg = gridConfig(grid);
      if (cfg.mode !== "curated") return;
      const matchers = cfg.slugs.length ? [] : parseCuratedSpec(cfg.curated);
      const cards = Array.prototype.slice.call(grid.querySelectorAll(".contributor-card"));
      cards.forEach((card) => {
        const slug = card.getAttribute("data-tag-slug") || "";
        const nameEl = card.querySelector(".contributor-card-name");
        const name = nameEl ? nameEl.textContent.trim() : "";
        let show;
        if (cfg.exclude.indexOf(slug) > -1) {
          show = false;
        } else if (cfg.slugs.length) {
          show = cfg.slugs.indexOf(slug) > -1;
        } else if (matchers.length) {
          show = matchesSpec(name, matchers);
        } else {
          show = true;
        }
        card.style.display = show ? "" : "none";
      });
    });
  }

  // ── Filter (alphabet rail — only on "all" page) ──────────────
  function initFilter() {
    if (!allGrid || !rail || !railInner) return;
    const cards = Array.prototype.slice.call(allGrid.querySelectorAll(".contributor-card"));
    if (!cards.length) return;

    // Stamp each card with the last-name initial.
    cards.forEach((card) => {
      const nameEl = card.querySelector(".contributor-card-name");
      const name = nameEl ? nameEl.textContent.trim() : "";
      const initial = (lastName(name).charAt(0) || "").toUpperCase();
      card.setAttribute("data-last-initial", initial);
    });

    // Disable rail letters that have no contributors.
    const available = {};
    cards.forEach((c) => { available[c.getAttribute("data-last-initial")] = true; });
    Array.prototype.slice.call(railInner.querySelectorAll(".contributors-rail-pill")).forEach((pill) => {
      const letter = pill.getAttribute("data-letter");
      if (letter !== "all" && !available[letter]) {
        pill.disabled = true;
        pill.setAttribute("aria-disabled", "true");
      }
    });

    // Wire the rail.
    railInner.addEventListener("click", (e) => {
      const pill = e.target.closest(".contributors-rail-pill");
      if (!pill || pill.disabled) return;
      activeLetter = pill.getAttribute("data-letter") || "all";
      Array.prototype.slice.call(railInner.querySelectorAll(".contributors-rail-pill")).forEach((p) => {
        p.classList.toggle("is-active", p === pill);
      });
      apply();
    });

    apply();

    function apply() {
      let visible = 0;
      cards.forEach((card) => {
        const initial = card.getAttribute("data-last-initial") || "";
        const matchesLetter = activeLetter === "all" || initial === activeLetter;
        card.style.display = matchesLetter ? "" : "none";
        if (matchesLetter) visible++;
      });
      if (emptyEl) {
        if (visible === 0 && activeLetter !== "all") {
          emptyEl.hidden = false;
          if (emptyLetterEl) emptyLetterEl.textContent = activeLetter;
        } else {
          emptyEl.hidden = true;
        }
      }
    }
  }

  // ── Helpers ───────────────────────────────────────────────────
  function lastName(name) {
    if (!name) return "";
    const stripped = name.replace(/,?\s+(jr\.?|sr\.?|ii|iii|iv|v|phd|m\.?d\.?)\s*$/i, "").trim();
    const tokens = stripped.split(/\s+/);
    return tokens[tokens.length - 1] || "";
  }

  // Returns everything before the last name (first + middle names).
  function firstName(name) {
    if (!name) return "";
    const stripped = name.replace(/,?\s+(jr\.?|sr\.?|ii|iii|iv|v|phd|m\.?d\.?)\s*$/i, "").trim();
    const tokens = stripped.split(/\s+/);
    if (tokens.length <= 1) return tokens[0] || "";
    return tokens.slice(0, -1).join(" ");
  }

  function renderCard(tag, headingTag) {
    const h = headingTag === "h3" ? "h3" : "h2";
    const initial = (tag.name || "").trim().charAt(0).toUpperCase();
    const portrait = (tag.feature_image && window.MOSafeHref.isSafe(tag.feature_image))
      ? `<img src="${escapeAttr(tag.feature_image)}" alt="${escapeAttr(tag.name)}" />`
      : `<span class="contributor-card-initial contributor-card-initial--rendered">${escapeHtml(initial)}</span>`;
    const bio = tag.description
      ? `<p class="contributor-card-bio">${escapeHtml(tag.description)}</p>`
      : "";
    const count = (tag.count && tag.count.posts) || 0;
    const essayWord = count === 1 ? "essay" : "essays";
    return (
      `<a href="${escapeAttr(window.MOSafeHref.sanitize(tag.url, "#"))}" class="contributor-card contributor-card--candidate" data-tag-slug="${escapeAttr(tag.slug)}" data-count="${count}">` +
        `<div class="contributor-card-portrait" aria-hidden="true">${portrait}</div>` +
        `<div class="contributor-card-body">` +
          `<${h} class="contributor-card-name"><em>${escapeHtml(tag.name)}</em></${h}>${
          bio
          }<p class="contributor-card-count">${count} ${essayWord}</p>` +
        `</div>` +
      `</a>`
    );
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s); }
})();
