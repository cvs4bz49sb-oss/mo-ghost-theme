/*
 * Find, over a shelf instead of a page.
 *
 * The reader's Find walks the DOM of one open work, which costs nothing
 * because that text was already downloaded. This is the same walk over
 * a bounded set of works — an author's shelf, the results of a chapter,
 * a topic — and the only new problem is fetching them, which MOText
 * does.
 *
 * Bounded is the whole point. Augustine's 124 works are a few megabytes
 * and a few seconds; the library is sixty-eight thousand works and Early
 * English Books alone is 1.66 GB, so this stops where a reader's
 * patience and connection do. Searching everything is a server's job
 * and a different build.
 *
 * MOCorpusSearch.run(works, term, hooks) fetches with a small pool,
 * reports as it goes, and can be called off.
 */
(function () {
  const CONCURRENCY = 5;

  function fold(s) {
    return String(s || "")
      .normalize("NFD").replace(/\p{M}/gu, "")
      .toLowerCase();
  }

  // The words either side of the hit, snapped outward to whole words so
  // a preview never opens mid-word.
  function snippet(text, at, len) {
    let from = Math.max(0, at - 90);
    let to = Math.min(text.length, at + len + 110);
    if (from > 0) {
      const sp = text.indexOf(" ", from);
      if (sp > -1 && sp < at) from = sp + 1;
    }
    if (to < text.length) {
      const sp = text.lastIndexOf(" ", to);
      if (sp > at + len) to = sp;
    }
    return (from > 0 ? "…" : "") + text.slice(from, to).trim() + (to < text.length ? "…" : "");
  }

  // One pass: count every occurrence, keep the first few as previews.
  //
  // Three was enough when a preview only had to say whether a work was
  // worth opening. It is not enough now that the passages are the
  // result: a reader wants the lines that matched and a way into each
  // of them, not one line standing for a whole volume. Eight fills a
  // card without turning one book into the entire page.
  const MAX_PREVIEWS = 8;

  function searchRows(rows, re) {
    const hits = [];
    let total = 0;
    for (let i = 0; i < rows.length; i += 1) {
      const text = rows[i].text;
      re.lastIndex = 0;
      let m = re.exec(text);
      let firstInRow = true;
      while (m) {
        total += 1;
        if (firstInRow && hits.length < MAX_PREVIEWS) {
          hits.push({ loc: rows[i].loc, snippet: snippet(text, m.index, m[0].length) });
          firstInRow = false;
        }
        // A zero-length match would spin forever.
        if (re.lastIndex === m.index) re.lastIndex += 1;
        m = re.exec(text);
      }
    }
    return { hits, total };
  }

  function run(works, term, hooks) {
    // Whole words, not letters inside words: "sin" is not "choosing".
    // The pattern is built once and reused for every row of every work.
    const clean = String(term || "").trim();
    const re = window.MOText && window.MOText.wordPattern
      ? window.MOText.wordPattern(clean, "giu") : null;
    const h = hooks || {};
    if (clean.length < 2 || !re) {
      if (h.done) h.done({ results: [], searched: 0, cancelled: false, short: true });
      return { cancel() {} };
    }

    let cancelled = false;
    let searched = 0;
    const results = [];
    const queue = works.slice();

    async function worker() {
      while (queue.length && !cancelled) {
        const w = queue.shift();
        let rows = [];
        try { rows = await window.MOText.load(w.corpus, w.id); } catch (_) { rows = []; }
        if (cancelled) return;
        if (rows.length) {
          const { hits, total } = searchRows(rows, re);
          if (total) results.push({ work: w, hits, total });
        }
        searched += 1;
        if (h.progress) h.progress(searched, works.length, results.length);
      }
    }

    Promise.all(Array.from({ length: Math.min(CONCURRENCY, works.length) }, worker))
      .then(() => {
        if (cancelled) return;
        // Most mentions first: a work that names the word forty times is
        // about it, and one that names it once may only mention it.
        results.sort((a, b) => b.total - a.total);
        if (h.done) h.done({ results, searched, cancelled: false });
      });

    return { cancel() { cancelled = true; if (h.done) h.done({ results, searched, cancelled: true }); } };
  }

  window.MOCorpusSearch = { run, fold };
}());
