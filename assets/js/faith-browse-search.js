/*
 * The reading room's own search bar.
 *
 * It used to be a form that left the page. Now it answers in place: the
 * results open in a section directly under the hero, and the shelves
 * below stay where they were.
 *
 * Four scopes, and they are not equally cheap, which the page says
 * rather than hides:
 *
 *   All / Author / Title   the catalogue of every collection, about
 *                          seventy thousand works, already in memory.
 *                          Instant.
 *   Keyword                the text itself, read work by work. Bounded
 *                          by the filters, because Early English Books
 *                          alone is 1.66 GB and a browser cannot read
 *                          the library to answer one question.
 *
 * Keyword over everything is a server-side index, and when that exists
 * this is where it plugs in: the scope stays, the fetching moves.
 */
(function () {
  const form = document.querySelector(".bsearch");
  const hero = document.querySelector(".bhero");
  if (!form || !hero) return;

  // Above this, reading the works themselves is not a search, it is a
  // download. The number is a judgement: 400 works is roughly a dozen
  // megabytes and under a minute.
  const KEYWORD_MAX = 400;

  const SCOPES = { all: "All", author: "Author", title: "Title", keyword: "Keyword" };

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  const fold = (s) => String(s || "")
    .normalize("NFD").replace(/\p{M}/gu, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "");

  // Tradition has two levels here as everywhere else: the communion,
  // and the denomination or series under it. Under Protestant it is a
  // denomination; under The Fathers it is one of Migne's series, and
  // calling those denominations is nonsense.
  const CHILD_LABEL = {
    Protestant: ["Denomination", "All denominations"],
    "The Fathers": ["Series", "All series"],
  };

  function tradOf(w) {
    return String(w.tradition || "").trim();
  }

  function topTradOf(w) {
    const t = tradOf(w);
    if (!t) return "";
    if (w._tp === undefined) {
      w._tp = (window.MOCorpora && window.MOCorpora.traditionParent
        ? window.MOCorpora.traditionParent(t, w.corpus) : "") || "";
    }
    return w._tp || t;
  }

  // ── The panel, built once and opened when there is something ──
  const panel = document.createElement("section");
  panel.className = "bband bsearch-results";
  panel.hidden = true;
  panel.innerHTML =
    `<div class="container">` +
    `<div class="bsearch-controls">` +
    `<label class="faith-refs-select"><span>Search in</span>` +
    `<select data-bs-scope>${Object.keys(SCOPES)
      .map((k) => `<option value="${k}">${SCOPES[k]}</option>`).join("")}</select></label>` +
    `<label class="faith-refs-select"><span>Collection</span>` +
    `<select data-bs-collection><option value="">All collections</option></select></label>` +
    `<label class="faith-refs-select"><span>Tradition</span>` +
    `<select data-bs-tradition><option value="">All traditions</option></select></label>` +
    `<label class="faith-refs-select" data-bs-denom-wrap hidden>` +
    `<span data-bs-denom-label>Denomination</span>` +
    `<select data-bs-denom></select></label>` +
    `<label class="faith-refs-select"><span>Century</span>` +
    `<select data-bs-century><option value="">All centuries</option></select></label>` +
    `<button type="button" class="bsearch-close" data-bs-close aria-label="Close results">&times;</button>` +
    `</div>` +
    `<p class="bsearch-count" data-bs-count></p>` +
    `<div data-bs-out></div></div>`;
  hero.insertAdjacentElement("afterend", panel);

  const out = panel.querySelector("[data-bs-out]");
  const countEl = panel.querySelector("[data-bs-count]");
  const scopeEl = panel.querySelector("[data-bs-scope]");
  const input = form.querySelector("input[name='q']");

  // Every work in every collection.
  let all = null;
  let running = null;
  let term = "";
  let lastTerm = "";

  function corpora() {
    if (all) return Promise.resolve(all);
    const list = (window.MOCorpora && window.MOCorpora.all) || [];
    return Promise.all(list.map((c) =>
      window.MOCorpora.load(c.id).catch(() => [])))
      .then((sets) => {
        all = sets.flat();
        fillSelect("[data-bs-collection]", tally(all, (w) => w.corpus), (id) => {
          const c = window.MOCorpora.get(id);
          return c ? c.label : id;
        });
        fillSelect("[data-bs-tradition]", tally(all, topTradOf), null);
        fillSelect("[data-bs-century]", tally(all, century), (n) =>
          (window.MOCentury ? window.MOCentury.label(n) : String(n)));
        return all;
      });
  }

  function century(w) {
    if (w._c === undefined) w._c = window.MOCentury ? window.MOCentury.of(w) : 0;
    return w._c;
  }

  function tally(list, pick) {
    const m = new Map();
    list.forEach((w) => {
      const v = pick(w);
      if (v) m.set(v, (m.get(v) || 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
  }

  function fillSelect(sel, pairs, fmt) {
    const el = panel.querySelector(sel);
    if (!el || pairs.length < 2) return;
    el.insertAdjacentHTML("beforeend", pairs.map(([v, n]) =>
      `<option value="${escapeHtml(String(v))}">${escapeHtml(fmt ? fmt(v) : String(v))} (${n.toLocaleString()})</option>`).join(""));
  }

  function filters() {
    return {
      collection: panel.querySelector("[data-bs-collection]").value,
      tradition: panel.querySelector("[data-bs-tradition]").value,
      denomination: panel.querySelector("[data-bs-denom]").value,
      century: panel.querySelector("[data-bs-century]").value,
    };
  }

  function narrowed(list) {
    const f = filters();
    return list.filter((w) => {
      if (f.collection && w.corpus !== f.collection) return false;
      if (f.tradition && topTradOf(w) !== f.tradition) return false;
      if (f.denomination && tradOf(w) !== f.denomination) return false;
      if (f.century && String(century(w)) !== f.century) return false;
      return true;
    });
  }

  // The denominations actually present under the chosen communion, so
  // the control never offers one the library does not hold. Rewritten
  // in place rather than rebuilt, because this element must not be
  // replaced while the reader has it open.
  function paintDenoms() {
    const wrap = panel.querySelector("[data-bs-denom-wrap]");
    const sel = panel.querySelector("[data-bs-denom]");
    const parent = panel.querySelector("[data-bs-tradition]").value;
    if (!wrap || !sel || !all) return;
    const m = new Map();
    if (parent) {
      all.forEach((w) => {
        if (topTradOf(w) !== parent) return;
        const t = tradOf(w);
        // A work sitting on the communion itself, a pan-Protestant
        // confession, has no denomination and adds no option.
        if (!t || t === parent) return;
        m.set(t, (m.get(t) || 0) + 1);
      });
    }
    const kids = [...m.entries()].sort((a, b) => b[1] - a[1]);
    const [label, allLabel] = CHILD_LABEL[parent] || ["Within", "All"];
    const want = kids.length
      ? `<option value="">${escapeHtml(allLabel)}</option>${kids.map(([t, n]) =>
        `<option value="${escapeHtml(t)}">${escapeHtml(t)} (${n.toLocaleString()})</option>`).join("")}`
      : "";
    if (sel.innerHTML !== want) sel.innerHTML = want;
    const lab = panel.querySelector("[data-bs-denom-label]");
    if (lab) lab.textContent = label;
    wrap.hidden = !kids.length;
  }

  function matchCatalogue(list, scope) {
    const q = fold(term);
    if (!q) return [];
    return list.filter((w) => {
      if (scope === "author") {
        if (w._fa === undefined) w._fa = fold(w.author);
        return w._fa.includes(q);
      }
      if (scope === "title") {
        if (w._ft === undefined) w._ft = fold(`${w.title || ""} ${w.titleLatin || ""}`);
        return w._ft.includes(q);
      }
      if (w._fq === undefined) w._fq = fold(`${w.author || ""} ${w.title || ""} ${w.titleLatin || ""}`);
      return w._fq.includes(q);
    });
  }

  function card(w, extra) {
    const c = window.MOCorpora && window.MOCorpora.get(w.corpus);
    return `<li class="bsearch-hit">` +
      `<a class="bsearch-hit-title" href="${escapeHtml(w.url || "#")}">${escapeHtml(w.title || w.id)}</a>${ 
      w.author ? `<span class="bsearch-hit-author">${escapeHtml(w.author)}</span>` : "" 
      }<span class="bsearch-hit-where">${escapeHtml(c ? c.label : w.corpus)}${
        w.tradition ? ` · ${escapeHtml(w.tradition)}` : ""}</span>${ 
      extra || ""}</li>`;
  }

  // Entries in the author field that are not a person: the
  // catalogue's own annotations. "Unknown author (Augustine of
  // Hippo?)" is a librarian's guess, and offering it as a page beside
  // Augustine's own reads as though the library thinks they are two
  // men who happen to share a name.
  const NOT_A_NAME = /^(unknown|anonymous|anon\b|unattributed|\[?various)|\?\s*\)?$/i;

  // ── The people, before their books ────────────────────────────
  //
  // Searching a name and being handed 345 title cards buries the man
  // under his own bibliography. If the name matches an author the
  // library knows, say so first and offer the page that gathers
  // everything under it.
  //
  // Counted against the whole catalogue rather than the filtered set,
  // because the number has to be what the author's page will show.
  function authorsMatching() {
    const q = fold(term);
    if (!q || !all) return [];
    const m = new Map();
    all.forEach((w) => {
      const a = String(w.author || "").trim();
      if (!a || NOT_A_NAME.test(a)) return;
      if (w._fa === undefined) w._fa = fold(a);
      if (!w._fa.includes(q)) return;
      m.set(a, (m.get(a) || 0) + 1);
    });
    return [...m.entries()]
      // All of them, most works first. Three was a cap, and a cap on
      // a name search is what hid the fact that the catalogue spells
      // Calvin two ways.
      .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));
  }

  // A page of names, then a pager. It used to scroll inside a box,
  // which put 1,903 authors behind a 320px window and made the reader
  // drag a scrollbar to see the second Calvin. Paged, the whole block
  // is on the page and the numbers say how much more there is.
  const AUTHORS_PER_PAGE = 24;
  let authorPage = 1;

  function authorPager(pages) {
    if (pages < 2) return "";
    const win = [];
    const push = (n) => { if (win[win.length - 1] !== n) win.push(n); };
    push(1);
    if (authorPage - 2 > 2) win.push(null);
    for (let n = Math.max(2, authorPage - 2); n <= Math.min(pages - 1, authorPage + 2); n += 1) push(n);
    if (authorPage + 2 < pages - 1) win.push(null);
    push(pages);
    return `<p class="faith-pager bsearch-authors-pager">`
      + `<button type="button" class="faith-pager-btn" data-bs-apage="${authorPage - 1}"${authorPage <= 1 ? " disabled" : ""}>&larr; Previous</button>`
      + `<span class="faith-pager-nums">${win.map((n) => (n === null
        ? `<span class="faith-pager-gap" aria-hidden="true">&hellip;</span>`
        : `<button type="button" class="faith-pager-num${n === authorPage ? " is-current" : ""}" data-bs-apage="${n}"${n === authorPage ? ' aria-current="page"' : ""}>${n}</button>`)).join("")}</span>`
      + `<button type="button" class="faith-pager-btn" data-bs-apage="${authorPage + 1}"${authorPage >= pages ? " disabled" : ""}>Next &rarr;</button></p>`;
  }

  function authorBlock() {
    const found = authorsMatching();
    if (!found.length) return "";
    const pages = Math.max(1, Math.ceil(found.length / AUTHORS_PER_PAGE));
    if (authorPage > pages) authorPage = 1;
    const from = (authorPage - 1) * AUTHORS_PER_PAGE;
    const slice = found.slice(from, from + AUTHORS_PER_PAGE);
    const label = found.length === 1 ? "Author" : `${found.length.toLocaleString()} authors`;
    const rows = slice.map(([name, n]) =>
      `<a class="bsearch-author" href="/the-faith-received/author/?a=${encodeURIComponent(fold(name))}">`
      + `<span class="bsearch-author-name">${escapeHtml(name)}</span>`
      + `<span class="bsearch-author-n">${n.toLocaleString()} work${n === 1 ? "" : "s"}</span>`
      + `<span class="bsearch-author-go" aria-hidden="true">&rarr;</span></a>`).join("");
    return `<div class="bsearch-authors">`
      + `<p class="bsearch-authors-label">${escapeHtml(label)}</p>`
      + `<div class="bsearch-authors-list">${rows}</div>${
       authorPager(pages)}</div>`;
  }

  const PAGE = 60;
  let shown = PAGE;

  function renderCatalogue(hits) {
    const slice = hits.slice(0, shown);
    const where = scopeEl.value === "author" ? "with that author"
      : scopeEl.value === "title" ? "with that in the title"
        : "by author or title";
    countEl.textContent = hits.length
      ? `${hits.length.toLocaleString()} work${hits.length === 1 ? "" : "s"} matching "${term}"`
      : `No works ${where}`;
    // Not on a title search: someone looking for a title has not asked
    // about a person.
    const people = scopeEl.value === "title" ? "" : authorBlock();
    out.innerHTML = hits.length
      ? `${people}<ol class="bsearch-list">${slice.map((w) => card(w)).join("")}</ol>${
        hits.length > slice.length
          ? `<button type="button" class="bsearch-more" data-bs-more>Show more</button>` : ""}`
      : `${people}<p class="bsearch-msg">No author or title in the library uses that word. `
        + `Words like this usually live inside the works rather than on their covers.</p>`
        + `<button type="button" class="bsearch-more" data-bs-totext>Search inside the works instead</button>`;
    const more = out.querySelector("[data-bs-more]");
    if (more) {
      more.addEventListener("click", () => { shown += PAGE; renderCatalogue(hits); });
    }
    // A word that is not in any title is usually a word in the text.
    // "procreation" appears on no cover in the library and in eight of
    // our sixty-nine English editions alone, so a bare "nothing
    // matches" was telling the reader something false.
    const toText = out.querySelector("[data-bs-totext]");
    if (toText) {
      toText.addEventListener("click", () => {
        scopeEl.value = "keyword";
        search();
      });
    }
  }

  // How many of the index's answers to open for a preview. The index
  // says which works use the word; the snippet has to come from the
  // work itself, and forty is enough to fill a page of results
  // without reading a library to do it.
  const SNIPPET_DEPTH = 40;

  async function runIndexed(list) {
    countEl.textContent = "Asking the index\u2026";
    out.innerHTML = "";
    let found;
    try { found = await window.MOTermIndex.search(term); } catch (_) { found = null; }
    // null means the index could not be reached, which is not the same
    // as a word nobody uses.
    if (found === null) return false;

    // The filters apply to the index's answer, not to a page of it.
    const allow = new Set(list.map((w) => `${w.corpus}:${w.id}`));
    const byKey = new Map(list.map((w) => [`${w.corpus}:${w.id}`, w]));
    const hits = found.filter((h) => allow.has(`${h.corpus}:${h.id}`));

    if (!hits.length) {
      countEl.textContent = "";
      out.innerHTML = `<p class="bsearch-msg">No work in the library uses "${escapeHtml(term)}"`
        + `${found.length ? " within these filters" : ""}.</p>`;
      return true;
    }

    // A word in tens of thousands of works keeps only the two thousand
    // it matters most in. Saying "2,000 works" alone would pass that
    // off as the whole answer: God is in 55,252 of the 68,724.
    const total = hits.reduce((a, h) => a + h.count, 0);
    const note = found.usedBy && found.usedBy > found.length
      ? `, the ones that use it most of ${found.usedBy.toLocaleString()}`
      : found.capped ? ", the works these words are commonest in" : "";
    countEl.textContent = `${total.toLocaleString()} mention${total === 1 ? "" : "s"} of "${term}" `
      + `in ${hits.length.toLocaleString()} work${hits.length === 1 ? "" : "s"}${note}`;

    // Drawn at once from the index, then filled in with previews as
    // the works arrive, so the answer is on screen immediately. The
    // rest are a button away rather than a count of what is being
    // withheld.
    let shownHits = SNIPPET_DEPTH;
    const draw = () => {
      const top = hits.slice(0, shownHits);
      out.innerHTML = `<ol class="bsearch-list">${top.map((h) => {
        const w = byKey.get(`${h.corpus}:${h.id}`);
        return card(w, `<span class="bsearch-hit-times">${h.count.toLocaleString()} mention${h.count === 1 ? "" : "s"}</span>`
          + `<span class="bsearch-hit-snippet" data-snip="${escapeHtml(`${h.corpus}:${h.id}`)}">reading&hellip;</span>`);
      }).join("")}</ol>${hits.length > top.length
        ? `<button type="button" class="bsearch-more" data-bs-hitmore>Show more</button>` : ""}`;

      const more = out.querySelector("[data-bs-hitmore]");
      if (more) {
        more.addEventListener("click", () => { shownHits += SNIPPET_DEPTH; draw(); });
      }

      if (running) { running.cancel(); running = null; }
      running = window.MOCorpusSearch.run(top.map((h) => byKey.get(`${h.corpus}:${h.id}`)), term, {
        progress() { /* the results are already up; previews arrive quietly */ },
        done({ results }) {
          running = null;
          results.forEach((r) => {
            const el = out.querySelector(`[data-snip="${CSS.escape(`${r.work.corpus}:${r.work.id}`)}"]`);
            if (el && r.hits[0]) el.textContent = r.hits[0].snippet;
          });
          out.querySelectorAll("[data-snip]").forEach((el) => {
            if (el.textContent === "reading\u2026") el.remove();
          });
        },
      });
    };
    draw();
    return true;
  }

  function runKeyword(list) {
    if (running) { running.cancel(); running = null; }
    if (!window.MOCorpusSearch || !window.MOText) {
      out.innerHTML = `<p class="bsearch-msg">Keyword search is not available on this page.</p>`;
      return;
    }
    // The index answers for the whole library. Reading the works is
    // the fallback for when it cannot be reached, and it is the reason
    // this used to refuse anything over four hundred.
    if (window.MOTermIndex) {
      runIndexed(list).then((ok) => { if (!ok) runByReading(list); });
      return;
    }
    runByReading(list);
  }

  function runByReading(list) {
    if (list.length > KEYWORD_MAX) {
      countEl.textContent = "";
      out.innerHTML =
        `<p class="bsearch-msg">Keyword search reads the works themselves, and ${list.length.toLocaleString()} ` +
        `of them is more than a browser can read to answer one question. Narrow by collection, ` +
        `tradition or century first, or search an author's page.</p>` +
        `<button type="button" class="bsearch-more" data-bs-anyway>Read the first ${KEYWORD_MAX} anyway</button>`;
      const anyway = out.querySelector("[data-bs-anyway]");
      if (anyway) anyway.addEventListener("click", () => runKeyword(list.slice(0, KEYWORD_MAX)));
      return;
    }
    countEl.textContent = `Reading ${list.length.toLocaleString()} work${list.length === 1 ? "" : "s"}…`;
    out.innerHTML = `<p class="bsearch-msg" data-bs-progress>Starting…</p>` +
      `<button type="button" class="bsearch-more" data-bs-stop>Stop</button>`;
    const stop = out.querySelector("[data-bs-stop]");
    if (stop) stop.addEventListener("click", () => { if (running) running.cancel(); });

    running = window.MOCorpusSearch.run(list, term, {
      progress(n, total, found) {
        const p = out.querySelector("[data-bs-progress]");
        if (p) p.textContent = `Read ${n} of ${total}… ${found} work${found === 1 ? "" : "s"} so far`;
      },
      done({ results, searched, cancelled, short }) {
        running = null;
        if (short) return;
        const mentions = results.reduce((a, r) => a + r.total, 0);
        countEl.textContent = results.length
          ? `${mentions.toLocaleString()} mention${mentions === 1 ? "" : "s"} of "${term}" in ${results.length.toLocaleString()} work${results.length === 1 ? "" : "s"}${cancelled ? `, of ${searched} read` : ""}`
          : "";
        out.innerHTML = results.length
          ? `<ol class="bsearch-list">${results.map((r) => card(r.work,
            `<span class="bsearch-hit-times">${r.total.toLocaleString()} mention${r.total === 1 ? "" : "s"}</span>${ 
            r.hits.map((h) => `<span class="bsearch-hit-snippet">${escapeHtml(h.snippet)}</span>`).join("")}`
          )).join("")}</ol>`
          : `<p class="bsearch-msg">Not one of the ${searched.toLocaleString()} works read uses "${escapeHtml(term)}".</p>`;
      },
    });
  }

  function search() {
    term = (input.value || "").trim();
    if (!term) return;
    if (term !== lastTerm) { authorPage = 1; lastTerm = term; }
    panel.hidden = false;
    shown = PAGE;
    countEl.textContent = "Loading the catalogue…";
    out.innerHTML = "";
    corpora().then((list) => {
      paintDenoms();
      const scope = scopeEl.value;
      const set = narrowed(list);
      if (scope === "keyword") runKeyword(set);
      else renderCatalogue(matchCatalogue(set, scope));
    });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    search();
  });
  ["[data-bs-scope]", "[data-bs-collection]", "[data-bs-tradition]",
    "[data-bs-denom]", "[data-bs-century]"].forEach((sel) => {
    const el = panel.querySelector(sel);
    if (!el) return;
    el.addEventListener("change", () => {
      // Changing the communion drops any denomination under the old
      // one, which would otherwise filter to nothing.
      if (sel === "[data-bs-tradition]") {
        const d = panel.querySelector("[data-bs-denom]");
        if (d) d.value = "";
        paintDenoms();
      }
      if (term) search();
    });
  });
  out.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-bs-apage]");
    if (!btn || btn.disabled) return;
    const n = parseInt(btn.getAttribute("data-bs-apage"), 10);
    if (!n) return;
    authorPage = n;
    search();
    // Back to the names, not to wherever the click happened to leave
    // the viewport.
    const block = out.querySelector(".bsearch-authors");
    if (block) block.scrollIntoView({ block: "start" });
  });

  panel.querySelector("[data-bs-close]").addEventListener("click", () => {
    if (running) running.cancel();
    panel.hidden = true;
  });
}());
