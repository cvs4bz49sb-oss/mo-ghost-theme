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

  // From the page's own meta, like faith-author.js and
  // faith-author-scripture.js. Hardcoding it here meant this panel and
  // the fingerprint that now drives it could be pointed at two
  // different workers by one edit to the template.
  const LIBRARY = (document.querySelector('meta[name="tfr-library-base"]') || {}).content
    || "https://mo-tfr-library.mo-podcast-feed.workers.dev";
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

  // Title case, with the same two words left alone that
  // faith-author-scripture.js leaves alone: it is the Song of Solomon
  // and not the Song Of Solomon. The fingerprint above hands this panel
  // the reference it printed, so a reader who presses "Song of Solomon
  // 2:1" should not be answered under a different spelling of it.
  const LOWER = new Set(["of", "the"]);
  function title(book) {
    return String(book || "").split(" ").map((w, i) =>
      (i && LOWER.has(w) ? w : w.replace(/^[a-z]/, (c) => c.toUpperCase()))
    ).join(" ");
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
      // A one-line summary, said out loud. The search can be started
      // from the fingerprint above rather than from this field — the
      // page scrolls and a count appears — and without this a screen
      // reader is told none of it and the press reads as having done
      // nothing at all. The results themselves are not the live region:
      // eighty-nine works with excerpts would be read out entire.
      `<p class="fa-search-status visually-hidden" role="status" aria-live="polite"></p>` +
      `<div class="fa-search-out" data-fa-out></div>`;

    const shelves = root.querySelector(".fa-shelf");
    if (shelves) root.insertBefore(panel, shelves);
    else root.appendChild(panel);

    const input = panel.querySelector("[data-fa-ref]");
    const out = panel.querySelector("[data-fa-out]");
    const byKey = new Map(works.map((w) => [`${w.corpus}:${w.id}`, w]));

    const status = panel.querySelector(".fa-search-status");

    // Whatever is said on screen, said once to a screen reader: the
    // first line of the result — the count, or the message explaining
    // why there is none — and nothing of the list under it.
    function say(html) {
      out.innerHTML = html;
      if (!status) return;
      const head = out.querySelector(".fa-search-count, .fa-search-msg");
      status.textContent = head ? head.textContent : "";
    }

    async function run() {
      // A keyword crawl reads every work on the shelf and on a large
      // one that is minutes, not seconds. Left running it finishes long
      // after this answer is on screen and writes its own over the top:
      // press "Romans 5:5" a second after starting one on Augustine's
      // 268 works and the panel shows the 89 works for forty seconds,
      // then silently becomes "No work under this name uses …" under a
      // field that still reads Romans 5:5. The reader did nothing to
      // ask for that, so the crawl is stopped when a reference is
      // asked for. Cancelling calls `done` at once, which is why this
      // happens before anything is drawn rather than after.
      stopKeyword();
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
                `<a class="faith-verse-link" href="${escapeHtml(readerUrl(h.w, vloc == null ? h.loc : vloc, `${label}:${v}`))}">${escapeHtml(v)}</a>`).join("")}</span>`
            : "";
          return `<li class="fa-search-hit">` +
            `<a class="fa-search-title" href="${escapeHtml(url)}">${escapeHtml(h.w.title || h.w.id)}</a>${ 
            h.times > 1 ? `<span class="fa-search-times">cited ${escapeHtml(h.times)} times</span>` : "" 
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
    // True only while `stopKeyword` is putting a crawl down. `cancel()`
    // fires `done` synchronously, and the reference search that
    // follows waits on a fetch, so without this the panel shows "No
    // work under this name uses … in the 7 read before stopping" for
    // the second before the real answer lands. The Stop button cancels
    // directly and is deliberately left to say it: there the reader
    // asked for the stop and nothing else is coming.
    let stopping = false;

    // Hoisted, so `run` above can call it: both entries into the panel
    // have to be able to put a crawl down, not just the keyword one.
    function stopKeyword() {
      if (!running) return;
      stopping = true;
      try { running.cancel(); } finally { stopping = false; }
      running = null;
    }

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
      stopKeyword();
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
          if (stopping || short) return;
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

    // The way in from the fingerprint above. A verse there is a
    // question this panel already answers, so it asks it here rather
    // than sending the reader to a chapter listing on another page and
    // losing the author he was reading about.
    //
    // The field is filled and left filled on purpose: what got
    // searched should be visible and editable, so "Romans 5:5" can
    // become "Romans 5" without retyping it.
    find = (ref) => {
      mode.value = "ref";
      setMode();
      input.value = ref;
      // Focus follows the scroll. Without this the caret stays on the
      // verse button now well off the top of the screen, so the next
      // Tab goes to the verse beside it rather than into the results,
      // and a screen reader is left reading a part of the page the
      // sighted reader has already left. Focusing the field also puts
      // the reference under the cursor for editing, which is why it was
      // filled in and left filled, and makes Shift+Tab the way back up
      // to the fingerprint.
      //
      // Before the scroll, not after: a focus() call aborts a smooth
      // scroll already in flight, even with preventScroll set, and the
      // page then does not move at all.
      try { input.focus({ preventScroll: true }); } catch (_) { /* older engines scroll; the scroll below corrects it */ }
      // Scrolled to the panel, not to the results, because the results
      // are a moment away and an empty jump reads as a broken link.
      panel.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto" : "smooth",
      });
      run();
    };
  }

  // Set by mount. Until the shelf has been drawn there is nothing to
  // search, and the fingerprint checks for this before it offers a
  // verse as a button.
  let find = null;

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

  window.MOAuthorSearch = {
    mount,
    // Wrapped rather than exported directly, because `find` is not a
    // function until mount has run and the fingerprint may be drawn
    // first.
    // A shorthand method, not a named function expression: the name is
    // not bound inside the body, so `find` here is the module-level
    // binding below and not a self-reference.
    find(ref) { if (find) find(ref); },
    // Asked before the fingerprint draws a verse as a button. The
    // wrapper above exists whether or not the panel mounted, so it
    // cannot itself be the test: a shelf with nothing on it never
    // mounts, and a button that quietly does nothing is worse than a
    // figure set as plain type.
    ready: () => !!find,
  };
}());
