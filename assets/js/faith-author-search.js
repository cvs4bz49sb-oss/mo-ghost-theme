/*
 * Searching one author's shelf.
 *
 * An author page lists everything the library holds under a name —
 * Augustine's is 124 works, Migne's Latin fathers run to hundreds — and
 * a list that long is only a list. The question a reader actually
 * arrives with is narrower: where does this man handle Romans 8?
 *
 * This answers that from the generated scripture index, which knows
 * every citation in the corpus and the place in the work where it sits.
 * One fetch for the chapter, intersected with the works on this page.
 *
 * Keyword search across the same shelf is the other half of the
 * question and is not this: it needs the text of every work rather than
 * an index of citations, and the four collections here store their text
 * four different ways. That is a build of its own.
 */
(function () {
  const root = document.querySelector("[data-faith-author]");
  if (!root) return;

  const LIBRARY = "https://mo-tfr-library.mo-podcast-feed.workers.dev";
  const INDEX = `${LIBRARY}/v1/index`;

  let booksPromise = null;
  function books() {
    if (!booksPromise) {
      booksPromise = fetch(`${INDEX}/scripture-books.json`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
    }
    return booksPromise;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  const fold = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

  // What a reader types against what the index calls it. The ordinals
  // first, because "I Corinthians" and "1 Corinthians" are the same
  // book and only one of them is in the keys.
  const ORDINAL = { i: "1", ii: "2", iii: "3", first: "1", second: "2", third: "3" };

  const ALIAS = {
    songofsongs: "song of solomon", canticles: "song of solomon",
    cant: "song of solomon", song: "song of solomon",
    apocalypse: "revelation", apoc: "revelation",
    psalter: "psalms", psalm: "psalms",
    ecclus: "ecclesiasticus", sirach: "ecclesiasticus",
    esay: "isaiah", esaias: "isaiah",
    canticum: "song of solomon",
  };

  function normalizeBook(raw) {
    const t = String(raw || "").trim()
      .replace(/^([ivx]+|first|second|third)\s+/i,
        (m, o) => (ORDINAL[o.toLowerCase()] ? `${ORDINAL[o.toLowerCase()]} ` : m));
    const f = fold(t);
    return { text: t, folded: ALIAS[f] ? fold(ALIAS[f]) : f };
  }

  // "Romans 8", "Rom 8:28", "1 Cor 15", "I Corinthians 15.22". The book
  // is matched against the index's own keys rather than a list kept
  // here, so the two can never drift apart.
  function parseRef(text, keys) {
    const m = String(text || "").trim()
      .match(/^(.*?)[\s.,:]+(\d{1,3})(?:[\s.:,]+(\d{1,3}))?\s*$/);
    if (!m) return null;
    const want = normalizeBook(m[1]).folded;
    if (want.length < 2) return null;
    // Longest key first, so "1 john" beats "john" for "1 Joh 2".
    const key = keys
      .filter((k) => fold(k).startsWith(want) || want.startsWith(fold(k)))
      .sort((a, b) => b.length - a.length)[0];
    if (!key) return null;
    return { book: key, chapter: parseInt(m[2], 10), verse: m[3] ? parseInt(m[3], 10) : 0 };
  }

  function title(book) {
    return book.replace(/\b[a-z]/g, (c) => c.toUpperCase());
  }

  // ── Mounted after faith-author.js has drawn the shelves ────────
  function mount(works) {
    if (!works.length) return;
    const panel = document.createElement("section");
    panel.className = "fa-search";
    panel.innerHTML =
      `<h2 class="fa-search-head">Search this author</h2>` +
      `<div class="fa-search-row">` +
      `<label class="fa-search-mode"><span>Search for</span>` +
      `<select data-fa-mode aria-label="What to search for">` +
      `<option value="ref">A scripture reference</option>` +
      `<option value="kw">A word or phrase</option></select></label>` +
      `<input type="search" class="fa-search-input" data-fa-ref` +
      ` placeholder="A scripture reference, such as Romans 8 or 1 Cor 15:22"` +
      ` aria-label="Search this author">` +
      `<button type="button" class="fa-search-btn" data-fa-go>Find</button></div>` +
      `<p class="fa-search-note" data-fa-note>Every place this author cites a passage, from the generated index.</p>` +
      `<div class="fa-search-out" data-fa-out></div>`;

    const shelves = root.querySelector(".fa-shelf");
    if (shelves) root.insertBefore(panel, shelves);
    else root.appendChild(panel);

    const input = panel.querySelector("[data-fa-ref]");
    const out = panel.querySelector("[data-fa-out]");
    const byKey = new Map(works.map((w) => [`${w.corpus}:${w.id}`, w]));

    function say(html) { out.innerHTML = html; }

    async function run() {
      const raw = input.value.trim();
      if (!raw) { say(""); return; }
      const index = await books();
      if (!index) {
        say(`<p class="fa-search-msg">The scripture index is not reachable just now.</p>`);
        return;
      }
      const ref = parseRef(raw, Object.keys(index));
      if (!ref) {
        say(`<p class="fa-search-msg">Not a reference this index knows. Try a book and a chapter, such as Romans 8.</p>`);
        return;
      }
      const chapters = index[ref.book] || {};
      if (!chapters[String(ref.chapter)]) {
        say(`<p class="fa-search-msg">${escapeHtml(title(ref.book))} ${ref.chapter} is not cited anywhere the index has read yet.</p>`);
        return;
      }
      say(`<p class="fa-search-msg">Searching&hellip;</p>`);
      let rows;
      try {
        const r = await fetch(`${INDEX}/scripture/${encodeURIComponent(ref.book)}/${ref.chapter}.json`);
        rows = r.ok ? await r.json() : null;
      } catch (_) { rows = null; }
      if (!rows) {
        say(`<p class="fa-search-msg">That chapter could not be loaded.</p>`);
        return;
      }

      const label = `${title(ref.book)} ${ref.chapter}`;
      const hits = [];
      rows.forEach((row) => {
        const [corpus, id, times, loc, excerpt, verses] = row;
        const w = byKey.get(`${corpus}:${id}`);
        if (!w) return;
        const vs = Array.isArray(verses) ? verses : [];
        // A verse was asked for: keep only works that cite it.
        if (ref.verse && !vs.some(([v]) => v === ref.verse)) return;
        hits.push({ w, times, loc, excerpt, verses: vs });
      });

      if (!hits.length) {
        say(`<p class="fa-search-msg">Nothing under this name cites ${escapeHtml(label)}${
          ref.verse ? `:${ref.verse}` : ""}.</p>`);
        return;
      }

      const asked = ref.verse ? `${label}:${ref.verse}` : label;
      say(`<p class="fa-search-count">${hits.length.toLocaleString()} work${hits.length === 1 ? "" : "s"} citing ${escapeHtml(asked)}</p>` +
        `<ol class="fa-search-list">${hits.map((h) => {
          const url = readerUrl(h.w, ref.verse
            ? (h.verses.find(([v]) => v === ref.verse) || [0, h.loc])[1]
            : h.loc, ref.verse ? `${label}:${ref.verse}` : label);
          const vlinks = h.verses.length
            ? `<span class="fa-search-verses"><span class="faith-verse-label">Verses</span>${
              h.verses.map(([v, vloc]) =>
                `<a class="faith-verse-link" href="${escapeHtml(readerUrl(h.w, vloc == null ? h.loc : vloc, `${label}:${v}`))}">${v}</a>`).join("")}</span>`
            : "";
          return `<li class="fa-search-hit">` +
            `<a class="fa-search-title" href="${escapeHtml(url)}">${escapeHtml(h.w.title || h.w.id)}</a>${ 
            h.times > 1 ? `<span class="fa-search-times">cited ${h.times} times</span>` : "" 
            }${h.excerpt ? `<span class="fa-search-excerpt">${escapeHtml(h.excerpt)}</span>` : "" 
            }${vlinks}</li>`;
        }).join("")}</ol>`);
    }

    // ── A word or phrase, across the shelf ──────────────────────
    //
    // The same walk Find does over one open work, over these works
    // instead. Bounded on purpose: this shelf is a few megabytes and a
    // few seconds, where the library is sixty-eight thousand works.
    const mode = panel.querySelector("[data-fa-mode]");
    const note = panel.querySelector("[data-fa-note]");
    let running = null;

    function setMode() {
      const kw = mode.value === "kw";
      input.placeholder = kw
        ? "A word or a phrase, as it appears in the text"
        : "A scripture reference, such as Romans 8 or 1 Cor 15:22";
      note.textContent = kw
        ? `Reads the text of all ${works.length.toLocaleString()} work${works.length === 1 ? "" : "s"} under this name. It fetches as it goes, so it takes a moment.`
        : "Every place this author cites a passage, from the generated index.";
      say("");
    }
    mode.addEventListener("change", setMode);
    setMode();

    function runKeyword() {
      const term = input.value.trim();
      if (running) { running.cancel(); running = null; }
      if (term.length < 2) {
        say(`<p class="fa-search-msg">Two letters at least.</p>`);
        return;
      }
      if (!window.MOCorpusSearch || !window.MOText) {
        say(`<p class="fa-search-msg">Search is not available on this page.</p>`);
        return;
      }
      const started = escapeHtml(term);
      say(`<p class="fa-search-msg" data-fa-progress>Reading 0 of ${works.length}&hellip;</p>` +
        `<button type="button" class="fa-search-stop" data-fa-stop>Stop</button>`);
      const stop = panel.querySelector("[data-fa-stop]");
      if (stop) stop.addEventListener("click", () => { if (running) running.cancel(); });

      running = window.MOCorpusSearch.run(works, term, {
        progress(n, total, found) {
          const p = panel.querySelector("[data-fa-progress]");
          if (p) {
            p.textContent = `Reading ${n} of ${total}\u2026 ${found} work${found === 1 ? "" : "s"} so far`;
          }
        },
        done({ results, searched, cancelled, short }) {
          running = null;
          if (short) return;
          if (!results.length) {
            say(`<p class="fa-search-msg">No work under this name uses "${started}"${
              cancelled ? ` in the ${searched} read before stopping` : ""}.</p>`);
            return;
          }
          const hits = results.reduce((a, r) => a + r.total, 0);
          say(`<p class="fa-search-count">${hits.toLocaleString()} mention${hits === 1 ? "" : "s"} of "${started}" in ${results.length.toLocaleString()} work${results.length === 1 ? "" : "s"}${
            cancelled ? `, of ${searched} read` : ""}</p>` +
            `<ol class="fa-search-list">${results.map((r) => {
              const first = r.hits[0] || {};
              return `<li class="fa-search-hit">` +
                `<a class="fa-search-title" href="${escapeHtml(readerUrl(r.work, first.loc, "", term))}">${escapeHtml(r.work.title || r.work.id)}</a>` +
                `<span class="fa-search-times">${r.total.toLocaleString()} mention${r.total === 1 ? "" : "s"}</span>${ 
                r.hits.map((hh) =>
                  `<a class="fa-search-snippet" href="${escapeHtml(readerUrl(r.work, hh.loc, "", term))}">${escapeHtml(hh.snippet)}</a>`).join("") 
                }</li>`;
            }).join("")}</ol>`);
        },
      });
    }

    function go() {
      if (mode.value === "kw") runKeyword();
      else run();
    }

    panel.querySelector("[data-fa-go]").addEventListener("click", go);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  }

  // Same shape the indexes build, so a link from here lands where a
  // link from the scripture page would.
  function readerUrl(w, loc, ref, term) {
    const c = window.MOCorpora && window.MOCorpora.get(w.corpus);
    const which = w.corpus === "tfr" || w.corpus === "confessions"
      ? "" : `c=${encodeURIComponent(w.corpus)}&`;
    let url = `/the-faith-received/reader/?${which}w=${encodeURIComponent(w.id)}`;
    let hash = "";
    if (loc != null && loc !== "") {
      if (w.corpus === "tfr" || w.corpus === "confessions") url += `&p=${encodeURIComponent(loc)}`;
      else hash = `#${String(loc).trim().replace(/\s+/g, "-")}`;
    }
    if (ref) url += `&ref=${encodeURIComponent(ref)}`;
    // Carried so the work opens with the word already found in it,
    // rather than leaving the reader to type it a second time.
    if (term) url += `&q=${encodeURIComponent(term)}`;
    return (c ? url : "/the-faith-received/") + hash;
  }

  window.MOAuthorSearch = { mount };
}());
