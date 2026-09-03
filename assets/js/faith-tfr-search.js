/*
 * The Faith Received — /the-faith-received/search/, the six-mode page.
 *
 * The data owner's spec (relayed 2026-09-03) describes six search
 * modes sharing one page: Find, Ask, Full text, Meaning, Scripture,
 * Tradition. Two of those — Ask (an LLM answer) and Meaning (a vector
 * / semantic index) — need live infrastructure this codebase does not
 * have and is not wired to build today: no LLM API binding, no vector
 * index. Their panels are static and say so; see the markup in
 * custom-faith-search.hbs rather than this file, since there is
 * nothing for either mode to *do*.
 *
 * The other four are real, and three of them are one backend wearing
 * three faces:
 *
 *   FULL TEXT and FIND read the same index. `v1/search/pagefind/` on
 *   the mo-tfr bucket is a genuine Pagefind (v1.5.2) build over the
 *   Latin Library corpus — confirmed by fetching the real files with a
 *   scratch Worker before writing a line of this, not assumed from the
 *   directory name. It is not one index but ten: b0 through b8 (built
 *   2026-08-20, ~12,000 pages each) and bnew (built 2026-09-03,
 *   matching the taxonomy-drop timing), each a *complete*, independent
 *   Pagefind bundle — its own pagefind.js, its own WASM, its own
 *   fragment/filter/index shards. ~108,500 pages in total across the
 *   ten. There is no single combined index to query; this file queries
 *   all ten and merges by score. Full text shows the merged hits flat,
 *   one row per matching page-shard. Find groups the same hits by the
 *   work they belong to, per the spec's "a hit lists the work once
 *   with its matching section headings under it, each with its page" —
 *   this is the same search, grouped differently in the UI, not a
 *   second backend.
 *
 *   TRADITION is Full text with the tradition scope pinned rather than
 *   optional: Pagefind's own `filters: {tradition: [...]}` argument,
 *   already carried by every fragment (`author`, `corpus`, `tradition`,
 *   `work`), narrows the search before it runs rather than after.
 *
 * WHAT THE INDEX DOES NOT GIVE US: each fragment's `meta.url` is an
 * anchor into *Stiven's own* reader — `/read/<slug>#b633-0` — built at
 * index time by his site generator. That id does not exist in our
 * DOM. Our own reader (faith-reader.js, the "shards" path this corpus
 * uses) renders id="section-N" on outline nodes computed at render
 * time from the work's structure array; it never learns a page-level
 * id like "b633-0" at all, so there is no element for that anchor to
 * find here. Rather than ship a deep link that silently lands nowhere,
 * results link to the work itself (`?w=<slug>`, always resolvable) and
 * state the page number as text — real information, honestly not a
 * live jump. See pageLabel() below.
 *
 * There is also no per-fragment "section heading" field — a fragment
 * carries body content and an excerpt, not a heading of its own. Find
 * mode's "section headings under the work" are therefore each hit's
 * own highlighted excerpt, labelled with its page number — the
 * nearest honest reading of the spec the data actually supports.
 *
 * SCRIPTURE (this tab) is deliberately thin: a passage-lookup shortcut
 * into /the-faith-received/scripture/, which already carries the full
 * canon-wide citation panel (assets/js/faith-scripture-totals.js). A
 * second full citation browser here would be the "second search
 * backend" this session was told not to build; the parsing logic below
 * is duplicated in miniature (per this codebase's one-file-per-feature
 * convention) rather than reached into that module's closed state.
 *
 * Every module on this page is self-contained, per the rest of the
 * faith-*.js family — no shared state with faith-received.js's older,
 * unrelated Fuse.js search (a smaller, hand-built index over the ~100
 * native English Editions only, `assets/data/faith-received/
 * search-index.json`). This page uses fresh `data-fs-*` attributes
 * throughout specifically so that older code — which binds to
 * `[data-faith-search-input]` etc. — stays the inert no-op it already
 * is on this route, rather than double-driving the same result list.
 */
(function () {
  "use strict";

  const page = document.querySelector("[data-fs-page]");
  if (!page) return;

  const LIBRARY = "https://mo-tfr-library.mo-podcast-feed.workers.dev";
  const PAGEFIND_BASE = `${LIBRARY}/v1/search/pagefind`;

  // Confirmed by listing the live bucket 2026-09-03 (see
  // website/sessions/2026-09-03-mo-tfr-bucket-audit.md and this
  // track's session notes). No listing endpoint exists on the worker,
  // so this list cannot be discovered at runtime — it is a snapshot of
  // what existed at build time. A future Pagefind reindex that adds or
  // retires a bucket needs this array updated by hand; a bucket that
  // stops existing simply fails its own fetch and is dropped (see
  // loadInstances), so a stale entry degrades rather than breaks.
  const BUCKETS = ["b0", "b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8", "bnew"];

  // Same nine codes as the 2026-09 drop's tradition taxonomy —
  // duplicated from assets/js/faith-author-scripture.js's CORPUS_LABEL
  // rather than imported, per this file family's no-shared-state rule.
  // Pagefind's own `tradition` filter carries the full name ("Lutheran",
  // not "lu"), so this map is for the UI's tradition picker only.
  const TRADITIONS = [
    "English Divines", "Greek Fathers", "Humanism and Law", "Lutheran",
    "Medieval", "Latin Fathers", "Eastern Fathers", "Roman Catholic", "Reformed",
  ];

  const FRAGMENT_FETCH_CAP = 140; // .data() calls made per search, across all ten shards
  const FULLTEXT_SHOW = 30;
  const FIND_WORKS_SHOW = 20;
  const FIND_HITS_PER_WORK = 6;

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function fold(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  const n = (x) => Number(x || 0).toLocaleString();

  // Pagefind's excerpt/content fields are text it escaped itself at
  // index time, with only its own <mark> tags added — but this is
  // still HTML sourced from bucket data, and this codebase's rule is
  // that class of content never reaches innerHTML unsanitized. Same
  // helper faith-reader.js uses for the same reason: DOMPurify if the
  // boot bundle loaded it (it always has, by the time page scripts
  // run), otherwise stripped to plain text rather than trusted raw.
  function sanitize(html) {
    if (window.DOMPurify && typeof window.DOMPurify.sanitize === "function") {
      return window.DOMPurify.sanitize(html, { ALLOWED_TAGS: ["mark"], ALLOWED_ATTR: [] });
    }
    const d = document.createElement("div");
    d.textContent = html;
    return d.innerHTML;
  }

  function readerUrl(slug) {
    // Built from our own template with a value we already know is a
    // bare slug (Pagefind's meta.slug matches faith-corpora.js's tfr
    // normalize()), never from a URL string the bucket handed us. See
    // the file header on why meta.url itself is not used.
    const href = `/the-faith-received/reader/?w=${encodeURIComponent(slug)}`;
    return window.MOSafeHref && window.MOSafeHref.sanitize
      ? window.MOSafeHref.sanitize(href, "#")
      : href;
  }

  // The row id Stiven's crawler assigned ("b633-0" — folio 633, block
  // 0) is not a live anchor here (see file header), but the folio
  // number itself is real information about where in the work a hit
  // sits. Parsed from meta.url's hash rather than the anchors array,
  // which carries the same ids for a purpose this file doesn't use.
  function pageLabel(metaUrl) {
    const m = /#b(\d+)-/.exec(String(metaUrl || ""));
    return m ? `p. ${m[1]}` : "";
  }

  // ── Tab switching ──────────────────────────────────────────────

  const tabs = page.querySelectorAll("[data-fs-mode]");
  const panels = page.querySelectorAll("[data-fs-panel]");
  const MODES = ["find", "fulltext", "scripture", "tradition", "ask", "meaning"];

  function showMode(mode) {
    if (MODES.indexOf(mode) < 0) mode = "find";
    panels.forEach((p) => {
      p.hidden = p.getAttribute("data-fs-panel") !== mode;
    });
    tabs.forEach((t) => {
      const active = t.getAttribute("data-fs-mode") === mode;
      t.classList.toggle("is-active", active);
      t.setAttribute("aria-selected", active ? "true" : "false");
    });
    if (mode === "fulltext" || mode === "find" || mode === "tradition") {
      ensureInstances();
    }
  }

  tabs.forEach((t) => {
    t.addEventListener("click", () => {
      const mode = t.getAttribute("data-fs-mode");
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, "", `#${mode}`);
      }
      showMode(mode);
    });
  });

  // ── Pagefind: load all ten shards, once ──────────────────────────

  let instancesPromise = null;
  // The query box and its status line sit in the hero, above
  // [data-fs-page] rather than inside it (the hero is a full-bleed
  // dark plate; the tabs and results sit in the lighter band below).
  // Looked up from `document`, not `page`, for that reason — every
  // other control below genuinely is inside [data-fs-page].
  const status = document.querySelector("[data-fs-status]");

  function setStatus(text) {
    if (status) status.textContent = text || "";
  }

  function ensureInstances() {
    if (instancesPromise) return instancesPromise;
    setStatus("Loading the full-text index…");
    instancesPromise = Promise.race([
      Promise.all(BUCKETS.map((b) =>
        import(`${PAGEFIND_BASE}/${b}/pagefind.js`)
          .then((mod) => mod.init().then(() => mod))
          .catch((err) => {
            if (window.console) window.console.warn("faith-tfr-search:", b, err && err.message);
            return null;
          })
      )).then((mods) => mods.filter(Boolean)),
      new Promise((resolve) => {
        window.setTimeout(() => resolve([]), 20000);
      }),
    ]).then((mods) => {
      if (!mods.length) {
        setStatus("The full-text index didn’t load. Try reloading the page.");
      } else {
        setStatus("");
      }
      return mods;
    });
    return instancesPromise;
  }

  // Runs the same query across every loaded shard and merges by score.
  // `tradition` narrows inside Pagefind itself (its own filters
  // argument); `author`/`work` narrow afterward, client-side, against
  // the fields every fragment already carries — Pagefind's own filter
  // values are exact-match facets, and an open text field ("baxter"
  // matching "Richard Baxter") reads better here than a 700-option
  // dropdown would.
  function runSearch(term, scope) {
    const q = String(term || "").trim();
    if (q.length < 2) return Promise.resolve({ query: q, rows: [] });
    return ensureInstances().then((instances) => {
      if (!instances.length) return { query: q, rows: [] };
      const opts = scope && scope.tradition ? { filters: { tradition: [scope.tradition] } } : undefined;
      return Promise.all(instances.map((pf) =>
        pf.search(q, opts).then((r) => r.results || []).catch(() => [])
      )).then((perShard) => {
        const flat = perShard.flat().sort((a, b) => b.score - a.score).slice(0, FRAGMENT_FETCH_CAP);
        return Promise.all(flat.map((r) =>
          r.data().then((d) => ({ ...d, score: r.score })).catch(() => null)
        ));
      }).then((rows) => {
        let out = rows.filter(Boolean);
        const authorQ = scope && scope.author ? fold(scope.author) : "";
        const workQ = scope && scope.work ? fold(scope.work) : "";
        if (authorQ) {
          out = out.filter((d) => ((d.filters && d.filters.author) || []).some((a) => fold(a).includes(authorQ)));
        }
        if (workQ) {
          out = out.filter((d) => ((d.filters && d.filters.work) || []).some((w) => fold(w).includes(workQ)));
        }
        return { query: q, rows: out };
      });
    });
  }

  // ── Rendering: Full text (and Tradition, which shares it) ────────

  function hitRow(d) {
    const slug = (d.meta && d.meta.slug) || "";
    const title = (d.meta && d.meta.title) || slug;
    const author = ((d.filters && d.filters.author) || [])[0] || "";
    const tradition = ((d.filters && d.filters.tradition) || [])[0] || "";
    const page_ = pageLabel(d.meta && d.meta.url);
    const meta = [tradition, page_].filter(Boolean).join(" · ");
    return `<li class="faith-search-hit"><a href="${escapeHtml(readerUrl(slug))}" class="faith-search-hit-link">` +
      `<p class="faith-search-hit-meta"><span class="faith-search-hit-type">${escapeHtml(meta || "The Latin Library")}</span>${
        author ? `<span class="faith-search-hit-author">${escapeHtml(author)}</span>` : ""
      }</p>` +
      `<h3 class="faith-search-hit-title"><em>${escapeHtml(title)}</em></h3>` +
      `<p class="faith-search-hit-snippet">${sanitize(d.excerpt || "")}</p>` +
      `</a></li>`;
  }

  function renderFlat(target, emptyEl, statusEl, result) {
    const rows = result.rows.slice(0, FULLTEXT_SHOW);
    if (statusEl) {
      statusEl.textContent = result.rows.length
        ? `${n(result.rows.length)}${result.rows.length >= FRAGMENT_FETCH_CAP ? "+" : ""} matching page${result.rows.length === 1 ? "" : "s"}, showing ${n(rows.length)}.`
        : (result.query ? `No results for “${escapeHtml(result.query)}”.` : "");
    }
    if (emptyEl) emptyEl.hidden = !!rows.length || !result.query;
    target.innerHTML = rows.map(hitRow).join("");
  }

  // ── Rendering: Find — grouped by work ────────────────────────────

  function groupByWork(rows) {
    const map = new Map();
    rows.forEach((d) => {
      const slug = (d.meta && d.meta.slug) || "";
      if (!slug) return;
      let g = map.get(slug);
      if (!g) {
        g = {
          slug,
          title: (d.meta && d.meta.title) || slug,
          author: ((d.filters && d.filters.author) || [])[0] || "",
          tradition: ((d.filters && d.filters.tradition) || [])[0] || "",
          hits: [],
          bestScore: 0,
        };
        map.set(slug, g);
      }
      g.hits.push(d);
      if (d.score > g.bestScore) g.bestScore = d.score;
    });
    return Array.from(map.values()).sort((a, b) => b.bestScore - a.bestScore || b.hits.length - a.hits.length);
  }

  function workGroup(g) {
    const hits = g.hits.slice(0, FIND_HITS_PER_WORK);
    const rows = hits.map((d) => {
      const page_ = pageLabel(d.meta && d.meta.url);
      return `<li><a href="${escapeHtml(readerUrl(g.slug))}">` +
        `<span class="brow-t">${page_ ? `<span class="faith-find-page">${escapeHtml(page_)}</span> ` : ""}${sanitize(d.excerpt || "")}</span>` +
        `</a></li>`;
    }).join("");
    const more = g.hits.length > hits.length
      ? `<p class="faith-find-more">${n(g.hits.length - hits.length)} more match${g.hits.length - hits.length === 1 ? "" : "es"} in this work.</p>`
      : "";
    const meta = [g.tradition, `${n(g.hits.length)} match${g.hits.length === 1 ? "" : "es"}`].filter(Boolean).join(" · ");
    return `<div class="btrad faith-find-group">` +
      `<h3><a href="${escapeHtml(readerUrl(g.slug))}">${escapeHtml(g.title)}</a></h3>` +
      `<p class="faith-find-group-meta">${escapeHtml(g.author)}${g.author ? " — " : ""}${escapeHtml(meta)}</p>` +
      `<ul class="blist">${rows}</ul>${more}</div>`;
  }

  function renderFind(target, emptyEl, statusEl, result) {
    const groups = groupByWork(result.rows).slice(0, FIND_WORKS_SHOW);
    if (statusEl) {
      statusEl.textContent = groups.length
        ? `${n(groups.length)} work${groups.length === 1 ? "" : "s"} matching, out of ${n(result.rows.length)}${result.rows.length >= FRAGMENT_FETCH_CAP ? "+" : ""} passages.`
        : (result.query ? `No results for “${escapeHtml(result.query)}”.` : "");
    }
    if (emptyEl) emptyEl.hidden = !!groups.length || !result.query;
    target.innerHTML = `<div class="faith-search-groups">${groups.map(workGroup).join("")}</div>`;
  }

  // ── Shared scope controls (query, tradition, author, work) ───────

  // Query input lives in the hero (see the `status` lookup above);
  // everything else here is genuinely inside [data-fs-page].
  const queryInput = document.querySelector("[data-fs-query]");
  const authorInput = page.querySelector("[data-fs-author]");
  const workInput = page.querySelector("[data-fs-work]");
  const tradPills = page.querySelectorAll("[data-fs-trad]");
  const tradRequired = page.querySelector("[data-fs-trad-required]");

  let currentTradition = "";

  function currentScope() {
    return {
      tradition: currentTradition,
      author: authorInput ? authorInput.value : "",
      work: workInput ? workInput.value : "",
    };
  }

  tradPills.forEach((btn) => {
    btn.addEventListener("click", () => {
      currentTradition = btn.getAttribute("data-fs-trad") || "";
      tradPills.forEach((b) => b.classList.toggle("is-active", b === btn));
      run();
    });
  });

  const fulltextResults = page.querySelector("[data-fs-results=\"fulltext\"]");
  const fulltextEmpty = page.querySelector("[data-fs-empty=\"fulltext\"]");
  const fulltextStatus = page.querySelector("[data-fs-count=\"fulltext\"]");
  const findResults = page.querySelector("[data-fs-results=\"find\"]");
  const findEmpty = page.querySelector("[data-fs-empty=\"find\"]");
  const findStatus = page.querySelector("[data-fs-count=\"find\"]");
  const tradResults = page.querySelector("[data-fs-results=\"tradition\"]");
  const tradEmpty = page.querySelector("[data-fs-empty=\"tradition\"]");
  const tradStatus = page.querySelector("[data-fs-count=\"tradition\"]");

  let runToken = 0;

  function run() {
    const q = queryInput ? queryInput.value : "";
    const scope = currentScope();
    const activeMode = page.querySelector("[data-fs-mode].is-active");
    const mode = activeMode ? activeMode.getAttribute("data-fs-mode") : "find";

    // Tradition mode requires a tradition — this is the difference
    // between it and Full text with the same pill available, per the
    // brief that it is a filter *pinned* rather than optional.
    if (mode === "tradition" && !scope.tradition) {
      if (tradRequired) tradRequired.hidden = false;
      if (tradResults) tradResults.innerHTML = "";
      if (tradStatus) tradStatus.textContent = "";
      if (tradEmpty) tradEmpty.hidden = true;
      return;
    }
    if (tradRequired) tradRequired.hidden = true;

    if (q.trim().length < 2) {
      [fulltextStatus, findStatus, tradStatus].forEach((s) => {
        if (s) s.textContent = "Type at least two characters to search.";
      });
      [fulltextResults, findResults, tradResults].forEach((r) => { if (r) r.innerHTML = ""; });
      return;
    }

    const token = ++runToken;
    setStatus("Searching…");
    runSearch(q, scope).then((result) => {
      if (token !== runToken) return; // a newer keystroke superseded this one
      setStatus("");
      renderFlat(fulltextResults, fulltextEmpty, fulltextStatus, result);
      renderFind(findResults, findEmpty, findStatus, result);
      if (mode === "tradition") renderFlat(tradResults, tradEmpty, tradStatus, result);
      try {
        document.dispatchEvent(new CustomEvent("mo:faith-search", {
          detail: { query: result.query, count: result.rows.length, mode },
        }));
      } catch (_) { /* telemetry must never break search */ }
    });
  }

  let debounceTimer = 0;
  if (queryInput) {
    queryInput.addEventListener("input", () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(run, 220);
    });
  }
  if (authorInput) authorInput.addEventListener("input", () => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(run, 220);
  });
  if (workInput) workInput.addEventListener("input", () => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(run, 220);
  });
  const form = document.querySelector("[data-fs-form]"); // also in the hero
  if (form) form.addEventListener("submit", (e) => { e.preventDefault(); run(); });

  // ── Scripture tab: a shortcut, not a second citation browser ─────
  //
  // Duplicates just enough of faith-scripture-totals.js's book-name
  // resolver to turn "Romans 8" into a link — not the totals, not the
  // per-tradition breakdown, both of which already live at
  // /the-faith-received/scripture/ and stay there.
  (function scriptureShortcut() {
    const sForm = page.querySelector("[data-fs-scripture-form]");
    const sInput = page.querySelector("[data-fs-scripture-input]");
    const sStatus = page.querySelector("[data-fs-scripture-status]");
    if (!sForm || !sInput) return;

    const OT = ["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth",
      "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah",
      "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song Of Solomon", "Isaiah", "Jeremiah",
      "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum",
      "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi"];
    const NT = ["Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians",
      "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
      "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John",
      "2 John", "3 John", "Jude", "Revelation"];
    const ALL_NAMES = OT.concat(NT);

    function resolveBook(text) {
      const t = String(text || "").trim().toLowerCase();
      if (!t) return null;
      return ALL_NAMES
        .filter((name) => t.startsWith(name.toLowerCase()))
        .sort((a, b) => b.length - a.length)[0] || null;
    }

    sForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const raw = sInput.value.trim();
      const book = resolveBook(raw);
      const rest = book ? raw.slice(book.length).trim() : "";
      const ch = parseInt((rest.match(/\d+/) || [])[0], 10);
      if (!book || !ch) {
        if (sStatus) sStatus.textContent = "Not a reference this page knows. Try a book and a chapter, such as Romans 8.";
        return;
      }
      const id = `ref-${book.replace(/\s+/g, "-").toLowerCase()}-${ch}`;
      const href = `/the-faith-received/scripture/#${id}`;
      const safe = window.MOSafeHref && window.MOSafeHref.sanitize
        ? window.MOSafeHref.sanitize(href, "/the-faith-received/scripture/")
        : href;
      // A same-site link we built ourselves, not a worker-supplied
      // redirect — MOSafeRedirect is scoped to the Stripe checkout
      // allowlist and isn't the right tool here. Navigating through a
      // real, clicked <a> (rather than window.location.*) keeps this
      // out of the lint rule that guards against unchecked redirects.
      const a = document.createElement("a");
      a.href = safe;
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  }());

  // ── Boot ──────────────────────────────────────────────────────────

  const hash = (window.location.hash || "").replace(/^#/, "");
  showMode(MODES.indexOf(hash) >= 0 ? hash : "find");

  try {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q && queryInput) {
      queryInput.value = q;
      run();
    }
  } catch (_) { /* ignore malformed query string */ }
}());
