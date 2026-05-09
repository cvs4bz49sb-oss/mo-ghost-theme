/*
 * Contributors page — full-list loader + alphabet/threshold filter.
 *
 * Ghost's {{#get "tags"}} helper returns a single page of the Content
 * API (max 100 tags), which truncates the roster once the corpus has
 * more than 100 public tags. This script fetches every page, filters
 * to contributor tags (slug prefix "author-") with at least one post,
 * rebuilds the grid, and wires up the alphabet rail + view-all toggle.
 *
 * Default behavior: contributors with fewer than COUNT_THRESHOLD
 * essays are hidden so the page leads with the most prolific writers.
 * Clicking "View all" reveals everyone. Clicking an alphabet letter
 * filters by last-name initial and ignores the threshold (a specific
 * lookup should always show the match if it exists).
 *
 * If the Content API key isn't present or the fetch fails, the
 * server-rendered first page stays in place — the alphabet rail still
 * works against whatever cards are on the page.
 */
(function () {
  const COUNT_THRESHOLD = 6;

  const grid = document.querySelector("[data-contributors-grid]");
  if (!grid) return;

  const rail = document.querySelector("[data-contributors-rail]");
  const railInner = document.querySelector("[data-contributors-rail-inner]");
  const emptyEl = document.querySelector("[data-contributors-empty]");
  const emptyLetterEl = emptyEl ? emptyEl.querySelector("[data-empty-letter]") : null;
  const toggleEl = document.querySelector("[data-contributors-toggle]");
  const viewAllBtn = toggleEl ? toggleEl.querySelector("[data-view-all]") : null;
  const viewAllLabel = toggleEl ? toggleEl.querySelector("[data-view-all-label]") : null;

  let activeLetter = "all";
  let revealAll = false;

  const apiKeyMeta = document.querySelector('meta[name="ghost-content-api-key"]');
  const API_KEY = apiKeyMeta ? apiKeyMeta.getAttribute("content") : "";

  if (API_KEY) {
    loadFullRoster();
  } else {
    // No API access — wire up the existing SSR cards as-is.
    initFilter();
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
            // Sort by last name, then first name, so the alphabet rail
            // and the visual order of the grid agree with each other.
            const la = lastName(a.name), lb = lastName(b.name);
            return la.localeCompare(lb) || a.name.localeCompare(b.name);
          });
          if (authors.length) {
            grid.innerHTML = authors.map(renderCard).join("");
          }
        }
        initFilter();
      })
      .catch(() => { initFilter(); });
  }

  // ── Filter ────────────────────────────────────────────────────
  function initFilter() {
    if (!rail || !grid) return;
    const cards = Array.prototype.slice.call(grid.querySelectorAll(".contributor-card"));
    if (!cards.length) return;

    // Stamp each card with the last-name initial. Uses lastName() which
    // strips "Jr.", "Sr.", "III" suffixes so "Smith Jr." sorts under S.
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

    // Wire the view-all toggle. Surface it only when the threshold
    // actually hides anything — otherwise it's noise.
    const hiddenByThreshold = cards.filter((c) => {
      return parseInt(c.getAttribute("data-count") || "0", 10) < COUNT_THRESHOLD;
    }).length;
    if (toggleEl) {
      if (hiddenByThreshold > 0 && viewAllBtn) {
        toggleEl.hidden = false;
        viewAllLabel.textContent = `View all ${cards.length} contributors`;
        viewAllBtn.addEventListener("click", () => {
          revealAll = !revealAll;
          viewAllLabel.textContent = revealAll
            ? "Show top contributors only"
            : `View all ${cards.length} contributors`;
          apply();
        });
      } else {
        toggleEl.hidden = true;
      }
    }

    apply();

    function apply() {
      let visible = 0;
      cards.forEach((card) => {
        const initial = card.getAttribute("data-last-initial") || "";
        const count = parseInt(card.getAttribute("data-count") || "0", 10);
        const matchesLetter = activeLetter === "all" || initial === activeLetter;
        // When a specific letter is selected, ignore the threshold —
        // a deliberate lookup should always surface the match.
        const passesThreshold = activeLetter !== "all" || revealAll || count >= COUNT_THRESHOLD;
        const show = matchesLetter && passesThreshold;
        // Use inline display rather than the hidden attribute. The
        // existing `.contributor-card--candidate[data-tag-slug^="author-"]`
        // rule overrides the UA `[hidden] { display: none }` on
        // specificity, so card.hidden = true left every card visible.
        card.style.display = show ? "" : "none";
        if (show) visible++;
      });
      if (emptyEl) {
        if (visible === 0 && activeLetter !== "all") {
          emptyEl.hidden = false;
          if (emptyLetterEl) emptyLetterEl.textContent = activeLetter;
        } else {
          emptyEl.hidden = true;
        }
      }
      // Hide the view-all toggle while a letter filter is active —
      // threshold doesn't apply, so the toggle has no effect.
      if (toggleEl && hiddenByThreshold > 0) {
        toggleEl.hidden = activeLetter !== "all";
      }
    }
  }

  // ── Helpers ───────────────────────────────────────────────────
  function lastName(name) {
    if (!name) return "";
    // Strip trailing suffixes: Jr / Jr. / Sr / Sr. / II / III / IV / V / PhD / MD.
    const stripped = name.replace(/,?\s+(jr\.?|sr\.?|ii|iii|iv|v|phd|m\.?d\.?)\s*$/i, "").trim();
    const tokens = stripped.split(/\s+/);
    return tokens[tokens.length - 1] || "";
  }

  function renderCard(tag) {
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
          `<h2 class="contributor-card-name"><em>${escapeHtml(tag.name)}</em></h2>${ 
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
