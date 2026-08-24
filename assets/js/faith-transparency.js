/*
 * The Faith Received — every work carrying a machine translation.
 *
 * Built from the same catalogues the rest of the library reads, rather
 * than from a list generated at build time: fourteen thousand titles
 * are not something to ship as markup, and a frozen list would go
 * stale the moment a collection moved.
 *
 * The same four collections the Translation Transparency panel labels,
 * for the same reason. Early English Books is English already, the
 * creeds and the English Editions are historic human translations, and
 * Patrologia Orientalis prints the translation its own fascicles
 * carry. Listing those here would be claiming a machine wrote
 * something a person did.
 *
 * Fifty at a time. The whole list is thousands long, and a page that
 * renders all of it at once is a page that stops responding.
 */
(function () {
  const root = document.querySelector("[data-faith-transparency]");
  if (!root) return;

  const AI_CORPORA = ["tfr", "pld", "pg", "augustine"];
  const PAGE = 50;

  const worksEl = root.querySelector("[data-tp-works]");
  const countEl = root.querySelector("[data-tp-count]");
  const noteEl = root.querySelector("[data-tp-note]");
  const moreEl = root.querySelector("[data-tp-more]");

  let all = [];
  let shown = 0;

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function render() {
    const next = all.slice(shown, shown + PAGE);
    const rows = next.map((w) => {
      const label = w.corpus ? `<span class="faith-tp-work-coll">${escapeHtml(w.corpus)}</span>` : "";
      const author = w.author ? `<span class="faith-tp-work-author">${escapeHtml(w.author)}</span>` : "";
      const title = escapeHtml(w.title || w.id);
      return w.url
        ? `<li><a class="faith-tp-work" href="${escapeHtml(w.url)}">`
          + `<span class="faith-tp-work-title">${title}</span>${author}${label}</a></li>`
        : `<li><span class="faith-tp-work">`
          + `<span class="faith-tp-work-title">${title}</span>${author}${label}</span></li>`;
    }).join("");
    worksEl.insertAdjacentHTML("beforeend", rows);
    shown += next.length;

    const left = all.length - shown;
    if (left > 0) {
      moreEl.hidden = false;
      moreEl.textContent = `Show ${Math.min(left, PAGE).toLocaleString()} more`;
    } else {
      moreEl.hidden = true;
    }
    // Said plainly, so a reader knows how much of the list they are
    // looking at rather than guessing from the scrollbar.
    noteEl.textContent = `Showing ${shown.toLocaleString()} of ${all.length.toLocaleString()}.`;
  }

  if (!window.MOCorpora || !window.MOCorpora.load) {
    countEl.textContent = "";
    noteEl.textContent = "The catalogue could not be loaded.";
    return;
  }

  Promise.all(AI_CORPORA.map((id) =>
    window.MOCorpora.load(id).then((works) => ({ id, works })).catch(() => ({ id, works: [] }))))
    .then((sets) => {
      sets.forEach(({ id, works }) => {
        const meta = window.MOCorpora.get(id);
        const label = meta ? meta.label : id;
        works.forEach((w) => {
          // A work with no English is not a machine translation of
          // anything. Seventy-eight of the Latin Library are in that
          // state and do not belong on this list.
          if (w.readable === false) return;
          all.push({
            id: w.id,
            title: w.title,
            author: w.author,
            url: w.url,
            corpus: label,
          });
        });
      });

      all.sort((a, b) => String(a.author || "~").localeCompare(String(b.author || "~"))
        || String(a.title || "").localeCompare(String(b.title || "")));

      countEl.textContent = `${all.length.toLocaleString()} works`;
      if (!all.length) {
        noteEl.textContent = "The catalogue could not be loaded.";
        return;
      }
      render();
    })
    .catch(() => {
      countEl.textContent = "";
      noteEl.textContent = "The catalogue could not be loaded.";
    });

  moreEl.addEventListener("click", render);
}());
