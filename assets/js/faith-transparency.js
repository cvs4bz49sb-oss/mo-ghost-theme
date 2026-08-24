/*
 * The Faith Received — every work carrying a machine translation.
 *
 * Built from the same catalogues the rest of the library reads, rather
 * than from a list generated at build time: fourteen thousand titles
 * are not something to ship as markup, and a frozen list would go
 * stale the moment a collection moved.
 *
 * The same collections the Translation Transparency panel labels, for
 * the same reason. Early English Books is English already, the English
 * Editions are historic translations made by people, and Patrologia
 * Orientalis prints the translation its own fascicles carry. Listing
 * those here would be claiming a machine wrote something a person did.
 *
 * The creeds are mixed and have to be asked one at a time: 29 of the
 * 260 were composed in English and were never translated at all.
 *
 * Fifty at a time. The whole list is thousands long, and a page that
 * renders all of it at once is a page that stops responding.
 */
(function () {
  const root = document.querySelector("[data-faith-transparency]");
  if (!root) return;

  const AI_CORPORA = ["tfr", "pld", "pg", "augustine"];
  // The creeds are mixed: 29 of the 260 were composed in English and
  // were never translated. Each one has to be asked where it came
  // from, so this collection is resolved separately.
  const MIXED = "confessions";
  const ENGLISH_ORIGIN = /^(English|Scottish)/i;
  const PAGE = 50;

  const worksEl = root.querySelector("[data-tp-works]");
  const countEl = root.querySelector("[data-tp-count]");
  const noteEl = root.querySelector("[data-tp-note]");
  const moreEl = root.querySelector("[data-tp-more]");

  const all = [];
  let shown = 0;

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }


  // Ask each creed where it came from, sixteen at a time. Two hundred
  // and sixty small files, and the alternative is calling a work
  // written in English a translation.
  function addMixed() {
    const meta = window.MOCorpora.get(MIXED);
    if (!meta) return Promise.resolve();
    const label = meta.label || MIXED;
    return window.MOCorpora.load(MIXED).then((works) => {
      let i = 0;
      const base = (document.querySelector('meta[name="tfr-library-base"]') || {}).content || "";
      const root = String(base).replace(/\/+$/, "");
      return Promise.all(Array.from({ length: 16 }, async () => {
        while (i < works.length) {
          const w = works[i]; i += 1;
          if (!w) continue;
          let region = "";
          try {
            const r = await fetch(`${root}/v1/works/${encodeURIComponent(w.id)}/meta.json`);
            if (r.ok) region = String((await r.json()).region || "");
          } catch (_) { region = ""; }
          if (ENGLISH_ORIGIN.test(region)) continue;
          all.push({ id: w.id, title: w.title, author: w.author, url: w.url, corpus: label });
        }
      }));
    }).catch(() => {});
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

  // Which Latin Library works carry no Latin at all. The catalogue
  // records the size of each lane, so this is one file rather than
  // 2,296 questions. (meta.json answers with en_only instead, which is
  // what the reader uses; the index is the cheaper way to ask about
  // every work at once.)
  const englishOriginals = new Set();
  function loadOriginals() {
    const base = (document.querySelector('meta[name="tfr-library-base"]') || {}).content || "";
    return fetch(`${String(base).replace(/\/+$/, "")}/v1/works-index.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((idx) => {
        if (!idx || !idx.works) return;
        idx.works.forEach((w) => {
          if (!(Number(w.la_chars) > 0)) englishOriginals.add(w.slug);
        });
      })
      .catch(() => {});
  }

  loadOriginals().then(() => Promise.all(AI_CORPORA.map((id) =>
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
          // Nor is a work that was written in English. The Latin
          // Library holds 732 English divines, and listing them as
          // machine translations from the Latin would be a false claim
          // about 732 books.
          if (id === "tfr" && englishOriginals.has(w.id)) return;
          all.push({
            id: w.id,
            title: w.title,
            author: w.author,
            url: w.url,
            corpus: label,
          });
        });
      });

      return addMixed();
    })
    .then(() => {
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
    }));

  moreEl.addEventListener("click", render);
}());
