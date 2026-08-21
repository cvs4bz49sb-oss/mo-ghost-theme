/*
 * The Faith Received section of the member dashboard.
 *
 * Reads the raw bookmark ids from mo-kit and resolves the "tfr:" ones
 * against the catalogues. The enriched /bookmarks list cannot be used
 * here: it resolves ids against Ghost and drops everything Ghost does
 * not know, which is every work in the library.
 *
 * Also fills the count on the dashboard card, so the card is honest
 * before anyone opens it.
 */
(function () {
  const body = document.body;
  const WORKER = (body.getAttribute("data-kit-worker-url") || "").replace(/\/$/, "");
  const list = document.querySelector("[data-faith-saved]");
  const countEl = document.querySelector('[data-card-count="faith-received"]');
  if (!WORKER || !window.MOAuth || (!list && !countEl)) return;

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  window.MOAuth.fetch(`${WORKER}/bookmarks?ids_only=1`, {
    method: "GET", mode: "cors", credentials: "omit",
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      const ids = ((data && data.postIds) || []).filter((s) => /^tfr:/.test(s));
      if (countEl) countEl.textContent = ids.length ? `${ids.length} saved` : "";
      if (!list) return null;
      if (!ids.length) {
        list.innerHTML =
          `<p class="faith-saved-empty">Nothing saved yet. ` +
          `<a href="/the-faith-received/browse/">Browse the library</a> and use Save on any work.</p>`;
        return null;
      }
      return render(ids);
    })
    .catch(() => {
      if (list) {
        list.innerHTML = `<p class="faith-saved-empty">Could not load your saved works just now.</p>`;
      }
    });

  function render(ids) {
    // Group the wanted slugs by collection so each catalogue is fetched
    // once rather than once per work.
    const wanted = new Map();
    ids.forEach((raw) => {
      const parts = raw.split(":");
      const corpusId = parts[1] || "tfr";
      const slug = parts.slice(2).join(":");
      if (!slug) return;
      if (!wanted.has(corpusId)) wanted.set(corpusId, new Set());
      wanted.get(corpusId).add(slug);
    });

    return Promise.all([...wanted.keys()].map((id) =>
      window.MOCorpora.load(id).then((works) => ({ id, works })).catch(() => ({ id, works: [] }))
    )).then((sets) => {
      const rows = [];
      sets.forEach(({ id, works }) => {
        const slugs = wanted.get(id);
        const corpus = window.MOCorpora.get(id);
        works.forEach((w) => {
          if (!slugs.has(String(w.id))) return;
          rows.push({ w, corpus });
        });
      });

      if (!rows.length) {
        list.innerHTML =
          `<p class="faith-saved-empty">Your saved works could not be found in the library. ` +
          `They may have been renamed at the source.</p>`;
        return;
      }

      rows.sort((a, b) => String(a.w.author || "").localeCompare(String(b.w.author || ""))
        || String(a.w.title || "").localeCompare(String(b.w.title || "")));

      list.innerHTML = `<ol class="faith-saved-list">${rows.map(({ w, corpus }) => {
        const author = w.author
          ? `<span class="faith-saved-author">${escapeHtml(w.author)}</span>` : "";
        const shelf = corpus
          ? `<span class="faith-saved-shelf">${escapeHtml(corpus.label)}</span>` : "";
        return `<li><a href="${escapeHtml(w.url)}">` +
          `<span class="faith-saved-title">${escapeHtml(w.title || w.id)}</span>` +
          `${author}${shelf}</a></li>`;
      }).join("")}</ol>`;
    });
  }
})();
