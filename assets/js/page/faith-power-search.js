/*
 * Power Search — the semantic-search workspace on
 * /the-faith-received/research/ (the "Power Search" tab).
 *
 * Search by MEANING rather than by word. Talks to the mo-tfr-library
 * Worker's GET /v1/vsearch, which embeds the query once and runs it
 * against the Vectorize index over the corpus. See
 * website/workers/tfr-library/lib/vsearch.js — that file is the
 * authority on both the query params and the result shape:
 *
 *   GET /v1/vsearch?q=<text>&k=<n>&tradition=<one>&slug=<one>&group=work
 *   -> { query, results: [ { doc, anchor, cit, snippet, score,
 *                            tradition, author, title, page, locus,
 *                            corpus, url, workUrl?, centuries? } ] }
 *
 * THE LIST IS A LIST OF WORKS. This is the shape of the whole file and
 * it is worth stating before anything else. The endpoint retrieves
 * PASSAGES; a reader thinks in works. So the top level asks for
 * `group=work`, which returns one row per work carrying that work's
 * best-matching passage, and each row's dropdown asks a SECOND,
 * slug-scoped query for that one work's own passages. Two calls
 * instead of one because of a hard ceiling, not a preference:
 *
 *   Vectorize returns at most 50 candidates when metadata comes back
 *   with them (MAX_TOPK in lib/vsearch.js). One query therefore cannot
 *   hold both a wide set of works and everything inside each of them.
 *
 * That ceiling is the honest limit of this feature and the numbers
 * below are built around it rather than around it being hidden.
 * Measured against the live index, four real queries returned 33, 36,
 * 40 and 47 distinct works out of those 50 candidates. So: at most two
 * pages of 25, usually two, never three, and the note under the list
 * says as much rather than letting a reader believe page 3 is missing.
 *
 * Three fields do real work here and all three are built server-side:
 *
 *   `url`      A finished reader link for one PASSAGE, carrying `?p=`
 *              where the collection has printed pages and `?q=` (the
 *              snippet) everywhere else, which is what puts a reader on
 *              the retrieved sentence in a 785k-character work rather
 *              than at the top of it. Used exactly as given.
 *   `workUrl`  The same link for the WORK, with no page and no quote.
 *              The work title goes here: a reader who clicked a title
 *              asked for the work, not for one sentence inside it.
 *   `centuries` [16, 17] — the author's centuries, joined on the worker
 *              from v1/authors.json's free-text `dates` field, plus
 *              Early English Books' own inline dating. An EMPTY array
 *              means the library does not know, never "modern", and is
 *              rendered as nothing at all. See the century filter below
 *              for what happens to those works when a century is
 *              selected: they are not silently dropped.
 *
 * ACCESS. /v1/vsearch is paid-member gated on the worker
 * (requirePaidMember() in tfr-library/worker.js: verified Ghost member
 * JWT, then a 30-per-60s limit on that identity, then paid/comped).
 * So every call goes through window.MOAuth.fetch (assets/js/admin-auth.js,
 * in boot.min.js in <head>), which attaches the member's bearer token
 * and refuses outright if the destination isn't on the page's
 * mo-trusted-hosts allowlist. The submit button also carries
 * data-feature-gate="ask" so feature-gate.js intercepts a free or
 * anonymous visitor's click before it reaches the handler below — the
 * standing rule is that a member-gated, money-spending endpoint is
 * gated on BOTH sides, the client side existing only to explain why
 * rather than to enforce. Anyone who gets here anyway (console, gate
 * bypass) gets the worker's own 401/403 `.error` string, surfaced
 * verbatim: it already says "This feature is for paid members. Sign
 * in, or become a member at /membership/." and papering that over with
 * "search is unavailable" would tell a signed-out reader there was an
 * outage.
 *
 * That 30-per-60s limit is also why every expanded work's passages are
 * cached for the life of the query. Expanding a row twice must not
 * spend a second call, and a reader working down a page of 25 rows has
 * a real budget to stay inside.
 *
 * RENDERING. Every field below crossed a trust boundary. Results are
 * built with createElement + textContent rather than a template
 * string, so there is no HTML-escaping step to forget and no path from
 * a server string to markup at all; every URL is routed through
 * MOSafeHref, which rejects anything that isn't http(s)/relative. A
 * previous session shipped an XSS here through `href="${esc(url)}"`,
 * which escapes the string perfectly and does nothing whatsoever about
 * `javascript:`.
 *
 * INDEX COVERAGE. The vector index is still being populated across the
 * collections. A thin result set is therefore not necessarily a bug —
 * the no-results copy in the template says so rather than implying the
 * library has nothing on the subject.
 *
 * Loaded as a page-template script (FRONTEND §6.18): runs before
 * site.min.js, touches no bundle globals. window.MOAuth and
 * window.MOSafeHref both ship in boot.min.js in <head> and are already
 * present.
 */
(function () {
  const form = document.querySelector("[data-ps-form]");
  if (!form) return;

  const input = form.querySelector("[data-ps-input]");
  const submitBtn = form.querySelector("[data-ps-submit]");
  const statusEl = document.querySelector("[data-ps-status]");
  const errorEl = document.querySelector("[data-ps-error]");
  const emptyEl = document.querySelector("[data-ps-empty]");
  const countEl = document.querySelector("[data-ps-count]");
  const resultsEl = document.querySelector("[data-ps-results]");
  const noResultsEl = document.querySelector("[data-ps-noresults]");
  const ceilingEl = document.querySelector("[data-ps-ceiling]");

  const scopeEl = document.querySelector("[data-ps-scope]");
  const scopeStateEl = document.querySelector("[data-ps-scope-state]");
  const tradPills = Array.from(document.querySelectorAll("[data-ps-tradition]"));

  const filtersEl = document.querySelector("[data-ps-filters]");
  const filtersStateEl = document.querySelector("[data-ps-filters-state]");
  const narrowEl = document.querySelector("[data-ps-narrow]");
  const facetsEl = document.querySelector("[data-ps-facets]");
  const clearEl = document.querySelector("[data-ps-clear]");
  const filterStatusEl = document.querySelector("[data-ps-filter-status]");
  const noMatchEl = document.querySelector("[data-ps-nomatch]");
  const noMatchNoteEl = document.querySelector("[data-ps-nomatch-note]");
  const pagerEl = document.querySelector("[data-ps-pager]");
  const prevEl = document.querySelector("[data-ps-prev]");
  const nextEl = document.querySelector("[data-ps-next]");
  const pageLabelEl = document.querySelector("[data-ps-page-label]");

  // Same worker every other faith-*.js file in this theme talks to.
  // Each file defines its own copy of the base URL rather than sharing
  // a global — matching the existing convention (see faith-ask.js and
  // faith-corpora.js).
  const WORKER = "https://mo-tfr-library.mo-podcast-feed.workers.dev";
  const VSEARCH_URL = `${WORKER}/v1/vsearch`;

  // Asking for the ceiling costs nothing extra — one embedding and one
  // Vectorize query either way — and under group=work the worker
  // clamps to 50, which is the same 50 candidates Vectorize was going
  // to return regardless. See the header: 50 is the arithmetic
  // maximum, not a tuning knob.
  const WORK_K = 50;
  // A work's own passages. MAX_K in lib/vsearch.js is 20 and the
  // endpoint clamps to it, so this is the ceiling for one work too.
  const PASSAGE_K = 20;
  const PAGE_SIZE = 25;

  // Which collections carry real printed page numbers. Mirrors
  // collectionHasPages() in tfr-library/lib/collections.js, which is
  // the authority: `page` is a SECTION ordinal for the others, and
  // printing "p. 12" for a Patrologia Latina row would invent a page
  // number the edition does not have. Written out again rather than
  // imported for the reason faith-author-reception.js gives for its own
  // copy of the collection table: there is no exported helper for this
  // in the theme and a page script has no load-order guarantee against
  // any file that might hold one (FRONTEND §6.18).
  const PAGED_CORPORA = new Set(["tfr", "eebo"]);

  // Reader-facing collection names, from the adapter registry in
  // assets/js/faith-corpora.js. Same reasoning as above for the copy.
  const CORPUS_LABELS = {
    tfr: "The Latin Library",
    eebo: "Early English Books",
    mo: "English Editions",
    pld: "Patrologia Latina",
    pg: "Patrologia Graeca",
    po: "Patrologia Orientalis",
  };

  // The sentinel for "this result has no value on this dimension." It
  // is a real, selectable filter value with its own count rather than
  // an absence, because the alternative is a reader picking "17th
  // century" and silently losing every work whose author this library
  // has never dated. See buildFacets().
  const UNKNOWN = " unknown";

  // ── Scope ──────────────────────────────────────────────────────
  //
  // Single-select, unlike Ask's multi-select control, because
  // handleVSearch() reads exactly one `tradition` param and passes it
  // as an exact-match Vectorize metadata filter. Offering checkboxes
  // here would promise a query the endpoint cannot run. The nine
  // values live in the template and must stay byte-identical to
  // KNOWN_TRADITIONS in the worker's lib/ask.js — an unrecognised
  // value doesn't error, it just matches nothing, which reads as "the
  // library has nothing on this."
  //
  // Scope is NOT the same control as the filters further down, and the
  // template says so in as many words. Scope decides what gets
  // searched and costs a new query; the filters narrow the works
  // already on screen and cost nothing. Conflating them is the one
  // confusion this workspace can produce, so they are separated by the
  // result list, named differently, and each states what it does.
  function currentTradition() {
    const active = tradPills.find((p) => p.classList.contains("is-active"));
    return active ? (active.getAttribute("data-ps-tradition") || "") : "";
  }

  function renderScopeState() {
    if (!scopeStateEl) return;
    const trad = currentTradition();
    scopeStateEl.textContent = trad || "The whole library";
    if (scopeEl) scopeEl.classList.toggle("ps-scope--set", Boolean(trad));
  }

  tradPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      tradPills.forEach((p) => {
        const active = p === pill;
        p.classList.toggle("is-active", active);
        p.setAttribute("aria-pressed", active ? "true" : "false");
      });
      renderScopeState();
      // Changing the scope does NOT re-run the search: a search spends
      // a real embedding call and the paid-member gate lives on the
      // submit button's own click, so nothing may reach the worker
      // without a deliberate press. But results already on screen were
      // retrieved under the OLD scope, and leaving them there
      // unremarked is the "the filter did nothing" failure in a
      // different costume. Say so instead.
      if (resultsEl && !resultsEl.hidden) {
        setStatus("Scope changed. Search again to apply it.");
      }
    });
  });

  // ── Small formatters ───────────────────────────────────────────
  function ordinal(n) {
    const teens = n % 100;
    if (teens >= 11 && teens <= 13) return `${n}th`;
    const last = n % 10;
    if (last === 1) return `${n}st`;
    if (last === 2) return `${n}nd`;
    if (last === 3) return `${n}rd`;
    return `${n}th`;
  }

  // [16] -> "16th century". [16, 17] -> "16th and 17th centuries".
  // [11, 12, 13] -> "11th to 13th centuries". An author whose life
  // crosses a boundary belongs to both, which is why this is ever a
  // range: Scheibler, 1589 to 1653, is a sixteenth-century man and a
  // seventeenth-century one and appears under both filters.
  function centuryPhrase(list) {
    if (!list || !list.length) return "";
    if (list.length === 1) return `${ordinal(list[0])} century`;
    if (list.length === 2) return `${ordinal(list[0])} and ${ordinal(list[1])} centuries`;
    return `${ordinal(list[0])} to ${ordinal(list[list.length - 1])} centuries`;
  }

  /*
   * "Sedgwick, Obadiah, 1600?-1658" -> "Obadiah Sedgwick".
   *
   * Early English Books stores 87% of its authors inverted, with the
   * catalogue's own dates trailing the name, and that string is what
   * arrives in `author`. Printed raw it reads as a card-catalogue
   * entry rather than as a byline, three lines below a work title set
   * as prose.
   *
   * Deliberately conservative. Only a two-part name flips, and only
   * when the second part starts with a capital: "Augustine, of Hippo"
   * is a byname, not an inversion, and "of Hippo Augustine" would be
   * worse than leaving it alone. Anything with no comma is returned
   * untouched, which is every native and Patrologia author.
   */
  function displayAuthor(name) {
    const raw = String(name || "").trim();
    if (!raw || raw.indexOf(",") < 0) return raw;
    const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
    // Trailing date segments: "1600?-1658", "d. 1654", "1553 or 4-1600".
    while (parts.length > 1 && /\d/.test(parts[parts.length - 1])) parts.pop();
    if (parts.length !== 2) return parts.join(", ");
    if (!/^[A-ZÀ-ɏ]/.test(parts[1])) return parts.join(", ");
    return `${parts[1]} ${parts[0]}`;
  }

  // The locus a reader can actually find. `locus` is the printed
  // address the source carries ("PL 80", "On the Immutability of
  // God"); `page` is only a real page for the paginated collections.
  function passageLocus(r) {
    if (r.locus) return r.locus;
    if (r.page && PAGED_CORPORA.has(r.corpus)) return `p. ${r.page}`;
    return "";
  }

  // ── States ─────────────────────────────────────────────────────
  //
  // Six of them and they are mutually exclusive: empty (nothing asked
  // yet), loading, results, no-results (the library answered with
  // nothing), no-match (it answered, and the reader's own filters
  // excluded all of it), error. Each transition below sets all of them
  // rather than only the one it cares about, because the bug this
  // shape prevents — a stale result list still on screen under a fresh
  // error, or a "no results" line under twenty hits — is exactly what a
  // half-updated state produces.
  //
  // No-results and no-match are separate on purpose. "The library has
  // nothing" and "you filtered it all away" look identical as an empty
  // list and mean opposite things (FRONTEND §6.33).
  function setStatus(message) {
    if (!statusEl) return;
    if (!message) { statusEl.hidden = true; statusEl.textContent = ""; return; }
    statusEl.hidden = false;
    statusEl.textContent = message;
  }

  function clearResults() {
    if (resultsEl) { resultsEl.textContent = ""; resultsEl.hidden = true; }
    if (countEl) { countEl.textContent = ""; countEl.hidden = true; }
    if (noResultsEl) noResultsEl.hidden = true;
    if (noMatchEl) noMatchEl.hidden = true;
    if (filtersEl) filtersEl.hidden = true;
    if (pagerEl) pagerEl.hidden = true;
    if (ceilingEl) ceilingEl.hidden = true;
    if (filterStatusEl) filterStatusEl.textContent = "";
  }

  function showError(message) {
    setStatus("");
    clearResults();
    if (emptyEl) emptyEl.hidden = true;
    if (errorEl) {
      errorEl.hidden = false;
      errorEl.textContent = message || "Something went wrong searching the library. Please try again.";
    }
  }

  // ── The model ──────────────────────────────────────────────────
  //
  // `works` is what the worker returned and never changes until a new
  // search. Everything the filters and the pager do is a view over it.
  // Nothing below re-queries; that is the whole point of the control.
  const state = {
    query: "",
    trad: "",
    works: [],
    narrow: "",
    picked: { corpus: new Set(), tradition: new Set(), century: new Set() },
    page: 1,
  };

  // Passages, keyed by the query they answer as well as the work, so
  // a second search never serves the first one's passages.
  const passageCache = new Map();

  function passageKey(slug) {
    return `${state.query} ${state.trad} ${slug}`;
  }

  function centuryKeys(r) {
    const list = Array.isArray(r.centuries) ? r.centuries : [];
    return list.length ? list.map(String) : [UNKNOWN];
  }

  function dimensionKeys(r, dim) {
    if (dim === "century") return centuryKeys(r);
    const v = dim === "corpus" ? r.corpus : r.tradition;
    return [v || UNKNOWN];
  }

  function narrowHaystack(r) {
    return `${r.title || ""} ${displayAuthor(r.author)}`.toLowerCase();
  }

  function matchesFilters(r) {
    if (state.narrow && narrowHaystack(r).indexOf(state.narrow) < 0) return false;
    // AND across dimensions, OR within one. Picking two centuries
    // widens; picking a century and a tradition narrows. That is the
    // rule every faceted list uses and the only one that stays
    // predictable once three dimensions are in play.
    const dims = ["corpus", "tradition", "century"];
    for (const dim of dims) {
      const picked = state.picked[dim];
      if (!picked.size) continue;
      const keys = dimensionKeys(r, dim);
      if (!keys.some((k) => picked.has(k))) return false;
    }
    return true;
  }

  function filtered() {
    return state.works.filter(matchesFilters);
  }

  function anyFilterActive() {
    if (state.narrow) return true;
    return ["corpus", "tradition", "century"].some((d) => state.picked[d].size > 0);
  }

  // ── The filter control ─────────────────────────────────────────
  //
  // Built from the works actually on screen, not from a fixed
  // vocabulary: a dimension with one value is not a filter, it is a
  // row of chrome, so a group renders only when the result set holds
  // at least two distinct values for it.
  //
  // Counts on each chip are counts within the CURRENT result set and
  // are deliberately not recalculated against the other active
  // filters. A count that changes as you click elsewhere makes a chip
  // impossible to aim at, and the honest number for "how many works
  // are 17th century" does not depend on what tradition you happen to
  // have selected.
  function facetValues(dim) {
    const counts = new Map();
    for (const r of state.works) {
      for (const k of dimensionKeys(r, dim)) counts.set(k, (counts.get(k) || 0) + 1);
    }
    const entries = Array.from(counts.entries());
    if (dim === "century") {
      entries.sort((a, b) => {
        if (a[0] === UNKNOWN) return 1;
        if (b[0] === UNKNOWN) return -1;
        return Number(a[0]) - Number(b[0]);
      });
    } else {
      entries.sort((a, b) => {
        if (a[0] === UNKNOWN) return 1;
        if (b[0] === UNKNOWN) return -1;
        return b[1] - a[1] || a[0].localeCompare(b[0]);
      });
    }
    return entries;
  }

  function facetLabel(dim, key) {
    if (key === UNKNOWN) {
      if (dim === "century") return "Century unknown";
      return "Not recorded";
    }
    if (dim === "century") return `${ordinal(Number(key))} century`;
    if (dim === "corpus") return CORPUS_LABELS[key] || key;
    return key;
  }

  const FACET_TITLES = { corpus: "Collection", tradition: "Tradition", century: "Century" };

  function buildFacets() {
    if (!facetsEl) return;
    facetsEl.textContent = "";
    ["corpus", "tradition", "century"].forEach((dim) => {
      const values = facetValues(dim);
      if (values.length < 2) return;

      const group = document.createElement("div");
      group.className = "ps-facet";

      const legend = document.createElement("p");
      legend.className = "ps-facet-legend";
      legend.id = `ps-facet-${dim}`;
      legend.textContent = FACET_TITLES[dim];
      group.appendChild(legend);

      const row = document.createElement("div");
      row.className = "ps-facet-chips";
      row.setAttribute("role", "group");
      row.setAttribute("aria-labelledby", legend.id);

      values.forEach(([key, n]) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "ps-chip";
        const on = state.picked[dim].has(key);
        chip.classList.toggle("is-on", on);
        chip.setAttribute("aria-pressed", on ? "true" : "false");

        const label = document.createElement("span");
        label.className = "ps-chip-label";
        label.textContent = facetLabel(dim, key);
        chip.appendChild(label);

        const num = document.createElement("span");
        num.className = "ps-chip-count";
        num.textContent = String(n);
        chip.appendChild(num);

        // Toggled in place rather than by rebuilding the group. A
        // rebuild would replace the button the reader is standing on
        // and drop keyboard focus to the top of the document, which
        // makes the control unusable without a mouse.
        chip.addEventListener("click", () => {
          const set = state.picked[dim];
          const nowOn = !set.has(key);
          if (nowOn) set.add(key); else set.delete(key);
          chip.classList.toggle("is-on", nowOn);
          chip.setAttribute("aria-pressed", nowOn ? "true" : "false");
          state.page = 1;
          renderView(true);
        });
        row.appendChild(chip);
      });

      group.appendChild(row);

      if (dim === "century" && values.some(([k]) => k === UNKNOWN)) {
        const note = document.createElement("p");
        note.className = "ps-facet-note";
        // Two things a reader will otherwise work out the hard way:
        // why the counts sum to more than the result total, and where
        // the undated works went.
        note.textContent = "An author whose life crosses a century counts under both. Not every author here carries a date. Those works sit under Century unknown, and picking a century leaves them out.";
        group.appendChild(note);
      }

      facetsEl.appendChild(group);
    });
  }

  // ── The result list ────────────────────────────────────────────
  //
  // Flat editorial rows separated by hairlines, one per WORK. Each row
  // is three lines and then it stops: the tradition as an eyebrow, the
  // work title, and the author with their century. No snippet at this
  // level — the passages are behind the disclosure below, which is the
  // whole reason the list groups.
  //
  // No score, either. A raw cosine number is noise to a reader and an
  // invitation to over-read a 0.71 against a 0.68.
  //
  // HOVER, and the rule the dropdown forced. Underline means "this
  // navigates," and each clickable row has exactly ONE line that
  // carries it: the line that names the thing. For a work row that is
  // the title; the tradition eyebrow and the byline are metadata about
  // the target, not targets, and stay inert. For a passage row there is
  // no title, so the passage text itself is the naming line and takes
  // the underline while its locus stays inert. The disclosure button is
  // the exception that proves it: it is a control, not a link, it goes
  // nowhere, and it must NOT underline — it answers hover by moving to
  // the dark ink and turning its caret. If the toggle underlined too,
  // "underline" would stop meaning anything.
  function renderWork(r, index) {
    const li = document.createElement("li");
    li.className = "ps-work";

    const tradLabel = r.tradition || CORPUS_LABELS[r.corpus] || "";
    if (tradLabel) {
      const meta = document.createElement("p");
      meta.className = "ps-work-trad";
      meta.textContent = tradLabel;
      li.appendChild(meta);
    }

    const titleP = document.createElement("p");
    titleP.className = "ps-work-title";
    const titleA = document.createElement("a");
    titleA.className = "ps-work-titlelink";
    // workUrl is the worker's own readerUrlFor() output with no page
    // and no quote, but it still crossed the network, so it goes
    // through the same scheme check every other non-literal href in
    // this theme does.
    window.MOSafeHref.set(titleA, r.workUrl || r.url, "#");
    titleA.target = "_blank";
    titleA.rel = "noopener";
    // `doc` (the canonical slug) is the last-resort label so a row is
    // never blank and unclickable-looking.
    titleA.textContent = r.title || r.doc || "Untitled work";
    titleP.appendChild(titleA);
    li.appendChild(titleP);

    const author = displayAuthor(r.author);
    const century = centuryPhrase(r.centuries);
    if (author || century) {
      const by = document.createElement("p");
      by.className = "ps-work-by";
      // A work whose author this library has never dated shows the
      // author and stops. No "date unknown", no dash standing in for a
      // century: an absence rendered as a label is still a label.
      by.textContent = author && century ? `${author}, ${century}` : (author || century);
      li.appendChild(by);
    }

    const regionId = `ps-passages-${index}`;
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "ps-work-toggle";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", regionId);
    const toggleLabel = document.createElement("span");
    toggleLabel.className = "ps-work-toggle-label";
    toggleLabel.textContent = "Passages in this work";
    toggle.appendChild(toggleLabel);
    li.appendChild(toggle);

    const region = document.createElement("div");
    region.className = "ps-passages";
    region.id = regionId;
    region.hidden = true;
    li.appendChild(region);

    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", open ? "false" : "true");
      region.hidden = open;
      if (!open) loadPassages(r, region, toggleLabel);
    });

    return li;
  }

  function renderPassages(list, region, toggleLabel, capped) {
    region.textContent = "";

    const ol = document.createElement("ol");
    ol.className = "ps-passage-list";
    list.forEach((p) => {
      const li = document.createElement("li");
      li.className = "ps-passage";

      const a = document.createElement("a");
      a.className = "ps-passage-link";
      window.MOSafeHref.set(a, p.url, "#");
      a.target = "_blank";
      a.rel = "noopener";

      const locus = passageLocus(p);
      if (locus) {
        const loc = document.createElement("span");
        loc.className = "ps-passage-locus";
        loc.textContent = locus;
        a.appendChild(loc);
      }

      const text = document.createElement("span");
      text.className = "ps-passage-text";
      text.textContent = p.snippet || "Open this passage in the reader.";
      a.appendChild(text);

      li.appendChild(a);
      ol.appendChild(li);
    });
    region.appendChild(ol);

    if (capped) {
      const note = document.createElement("p");
      note.className = "ps-passages-note";
      note.textContent = "The twenty closest passages in this work. A long work may hold more.";
      region.appendChild(note);
    }

    const n = list.length;
    toggleLabel.textContent = n === 1 ? "1 passage in this work" : `${n} passages in this work`;
  }

  function passageStatus(region, message, isError) {
    region.textContent = "";
    const p = document.createElement("p");
    p.className = isError ? "ps-passages-error" : "ps-passages-status";
    p.setAttribute("role", isError ? "alert" : "status");
    p.textContent = message;
    region.appendChild(p);
  }

  /*
   * One work's own matching passages, from the same query scoped by
   * `slug`. Cached for the life of the query: the worker allows 30
   * calls a minute against a member's identity and a reader working
   * down a page of 25 rows has a real budget to stay inside, so
   * re-opening a row must cost nothing.
   *
   * The grouped row already carries this work's best passage, so a
   * scoped query that comes back empty (a witness-collapse mismatch,
   * say) still has something true to show rather than an empty
   * dropdown under a work that demonstrably matched.
   */
  async function loadPassages(r, region, toggleLabel) {
    const key = passageKey(r.doc);
    const cached = passageCache.get(key);
    if (cached) {
      renderPassages(cached.list, region, toggleLabel, cached.capped);
      return;
    }
    if (region.getAttribute("data-loading") === "1") return;
    region.setAttribute("data-loading", "1");
    passageStatus(region, "Finding passages in this work…", false);

    const params = new URLSearchParams({ q: state.query, k: String(PASSAGE_K), slug: r.doc });
    if (state.trad) params.set("tradition", state.trad);

    let resp;
    try {
      resp = await (window.MOAuth && window.MOAuth.fetch
        ? window.MOAuth.fetch(`${VSEARCH_URL}?${params.toString()}`)
        : fetch(`${VSEARCH_URL}?${params.toString()}`));
    } catch (err) {
      console.error("[faith-power-search] slug-scoped /v1/vsearch failed before a response was received", err);
      region.removeAttribute("data-loading");
      passageStatus(region, "Could not reach the library for this work. Close this and open it again to retry.", true);
      return;
    }

    if (!resp.ok) {
      // 401/403 are the paid-member gate and 429 the burst limiter,
      // and all three answer with a reader-facing string the worker
      // already wrote. Shown as-is: a reader who has just tripped the
      // rate limit needs to be told that, not told the work is broken.
      let message = "Could not load the passages in this work. Please try again shortly.";
      try {
        const j = await resp.json();
        if (j && j.error) message = j.error;
      } catch (_) { /* non-JSON error body — keep the generic message */ }
      region.removeAttribute("data-loading");
      passageStatus(region, message, true);
      return;
    }

    let data;
    try {
      data = await resp.json();
    } catch (err) {
      console.error("[faith-power-search] slug-scoped /v1/vsearch returned an unreadable body", err);
      region.removeAttribute("data-loading");
      passageStatus(region, "The library sent back something we couldn't read for this work.", true);
      return;
    }

    region.removeAttribute("data-loading");
    const results = Array.isArray(data && data.results) ? data.results : [];
    const list = results.length ? results : [r];
    const entry = { list, capped: results.length >= PASSAGE_K };
    passageCache.set(key, entry);
    renderPassages(entry.list, region, toggleLabel, entry.capped);
  }

  // ── Counts, pager, and the view ────────────────────────────────
  function countSentence(shown, total, from, to) {
    const noun = total === 1 ? "work" : "works";
    let head = shown === total ? `${total} ${noun}` : `${shown} of ${total} ${noun}`;
    if (state.trad) head += ` in ${state.trad}`;
    if (to - from + 1 < shown) head += `, showing ${from} to ${to}`;
    return head;
  }

  function renderFiltersState(shown, total) {
    if (!filtersStateEl) return;
    const noun = total === 1 ? "work" : "works";
    filtersStateEl.textContent = shown === total
      ? `All ${total} ${noun}`
      : `${shown} of ${total} ${noun}`;
    if (filtersEl) filtersEl.classList.toggle("ps-filters--set", anyFilterActive());
    if (clearEl) clearEl.hidden = !anyFilterActive();
  }

  /*
   * Renders the current view of `state.works`.
   *
   * `announce` is true for every change the reader made deliberately
   * (a chip, the narrow box, a page) and false for the first paint
   * after a search, where the count line is already new content and a
   * second announcement of the same number is noise.
   *
   * `moveFocus` is true only for a page change. A pager that swaps 25
   * rows underneath a reader and leaves focus on a Next button that
   * may have just become disabled is how a keyboard user loses their
   * place entirely. Focus goes to the count line, which has been
   * rewritten to say exactly where they now are.
   */
  function renderView(announce, moveFocus) {
    if (!resultsEl) return;
    const total = state.works.length;
    const list = filtered();
    const shown = list.length;

    const pages = Math.max(1, Math.ceil(shown / PAGE_SIZE));
    if (state.page > pages) state.page = pages;
    const from = shown ? ((state.page - 1) * PAGE_SIZE) + 1 : 0;
    const to = Math.min(shown, state.page * PAGE_SIZE);

    renderFiltersState(shown, total);

    resultsEl.textContent = "";
    if (!shown) {
      resultsEl.hidden = true;
      if (pagerEl) pagerEl.hidden = true;
      if (ceilingEl) ceilingEl.hidden = true;
      if (countEl) { countEl.textContent = ""; countEl.hidden = true; }
      if (noMatchEl) noMatchEl.hidden = false;
      if (noMatchNoteEl) {
        const noun = total === 1 ? "work" : "works";
        noMatchNoteEl.textContent = `Loosen one of them, or clear them all to see the ${total} ${noun} this search found.`;
      }
      if (announce && filterStatusEl) filterStatusEl.textContent = "No works match these filters.";
      return;
    }

    if (noMatchEl) noMatchEl.hidden = true;
    list.slice(from - 1, to).forEach((r, i) => {
      resultsEl.appendChild(renderWork(r, from - 1 + i));
    });
    resultsEl.hidden = false;

    if (countEl) {
      countEl.textContent = countSentence(shown, total, from, to);
      countEl.hidden = false;
    }
    if (ceilingEl) ceilingEl.hidden = false;

    if (pagerEl) {
      // The pager appears only when there is a second page. Drawing
      // "Page 1 of 1" under twelve works advertises a depth this
      // endpoint cannot supply — 50 candidate passages is the hard
      // Vectorize ceiling, so two pages of 25 is the most that can
      // ever exist here.
      pagerEl.hidden = pages < 2;
      if (pages >= 2) {
        if (pageLabelEl) pageLabelEl.textContent = `Page ${state.page} of ${pages}`;
        if (prevEl) prevEl.disabled = state.page <= 1;
        if (nextEl) nextEl.disabled = state.page >= pages;
      }
    }

    if (announce && filterStatusEl) filterStatusEl.textContent = `${countSentence(shown, total, from, to)}.`;
    if (moveFocus && countEl) {
      countEl.focus();
      // `scroll-behavior: smooth` is global on <html>, and a smooth
      // scroll silently does nothing in a background tab (FRONTEND
      // §6.30). Instant, and asserted.
      countEl.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }

  function resetFilters() {
    state.narrow = "";
    state.picked.corpus.clear();
    state.picked.tradition.clear();
    state.picked.century.clear();
    state.page = 1;
    if (narrowEl) narrowEl.value = "";
  }

  if (narrowEl) {
    narrowEl.addEventListener("input", () => {
      state.narrow = (narrowEl.value || "").trim().toLowerCase();
      state.page = 1;
      renderView(true);
    });
  }

  if (clearEl) {
    clearEl.addEventListener("click", () => {
      resetFilters();
      buildFacets();
      renderView(true);
      if (narrowEl) narrowEl.focus();
    });
  }

  if (prevEl) {
    prevEl.addEventListener("click", () => {
      if (state.page <= 1) return;
      state.page -= 1;
      renderView(true, true);
    });
  }

  if (nextEl) {
    nextEl.addEventListener("click", () => {
      state.page += 1;
      renderView(true, true);
    });
  }

  function renderResults(results, trad, query) {
    state.query = query;
    state.trad = trad;
    state.works = results;
    resetFilters();
    passageCache.clear();

    if (!results.length) {
      clearResults();
      if (noResultsEl) noResultsEl.hidden = false;
      return;
    }

    if (noResultsEl) noResultsEl.hidden = true;
    buildFacets();
    // The control is worth offering only when it can do something.
    if (filtersEl) filtersEl.hidden = !facetsEl || !facetsEl.children.length;
    renderView(false);
  }

  // ── The search ─────────────────────────────────────────────────
  //
  // A token rather than an AbortController: two searches in flight is
  // the only race here and all it needs is "ignore anything that isn't
  // the newest". Aborting would also need the disabled button and the
  // status line unwound from the abort path, for no reader benefit on
  // a call that returns in under a second.
  let runToken = 0;

  async function runSearch(query) {
    const token = ++runToken;
    const trad = currentTradition();

    const params = new URLSearchParams({ q: query, k: String(WORK_K), group: "work" });
    if (trad) params.set("tradition", trad);
    const url = `${VSEARCH_URL}?${params.toString()}`;

    let resp;
    try {
      // MOAuth.fetch attaches the member's Ghost bearer token when one
      // exists and refuses the call outright if the worker host isn't
      // on the page's mo-trusted-hosts allowlist (default.hbs). The
      // fallback to a bare fetch() only matters if boot.min.js failed
      // to load; the worker then answers 401 with a real message,
      // which is a better outcome than a TypeError.
      //
      // The branch is at the CALL, not hoisted into a variable:
      // `const go = window.fetch; go(url)` throws "Illegal invocation"
      // because the native fetch needs its Window receiver. Same shape
      // faith-ask.js's loadUsage() uses, for the same reason.
      resp = await (window.MOAuth && window.MOAuth.fetch ? window.MOAuth.fetch(url) : fetch(url));
    } catch (err) {
      // Keep the real reason in the console — an untrusted-destination
      // refusal and a network/CORS failure produce the same sentence
      // on screen and are otherwise indistinguishable in a bug report.
      console.error("[faith-power-search] GET /v1/vsearch failed before a response was received", err);
      if (token === runToken) showError("Could not reach the library. Please check your connection and try again.");
      return;
    }

    if (token !== runToken) return;

    if (!resp.ok) {
      // 401/403 are the worker's paid-member gate and 429 its burst
      // limiter; all three answer with a reader-facing `.error` string
      // the worker already wrote, and all three are shown as-is. A
      // generic "temporarily unavailable" here would tell a visitor
      // who simply isn't signed in that the library is down.
      let message = "Search is temporarily unavailable. Please try again shortly.";
      try {
        const j = await resp.json();
        if (j && j.error) message = j.error;
      } catch (_) { /* non-JSON error body — keep the generic message */ }
      // Re-checked after the await: a newer search may have started
      // while the error body was being read, and painting this one's
      // failure over that one's results would be a lie about the
      // query on screen.
      if (token === runToken) showError(message);
      return;
    }

    let data;
    try {
      data = await resp.json();
    } catch (err) {
      console.error("[faith-power-search] /v1/vsearch returned an unreadable body", err);
      if (token === runToken) showError("The library sent back something we couldn't read. Please try again.");
      return;
    }

    if (token !== runToken) return;

    setStatus("");
    if (errorEl) errorEl.hidden = true;
    if (emptyEl) emptyEl.hidden = true;
    renderResults(Array.isArray(data && data.results) ? data.results : [], trad, query);
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const query = (input.value || "").trim();
    if (!query) { input.focus(); return; }

    if (errorEl) errorEl.hidden = true;
    clearResults();
    if (emptyEl) emptyEl.hidden = true;
    if (submitBtn) submitBtn.disabled = true;
    setStatus("Searching the library…");

    runSearch(query).finally(() => {
      if (submitBtn) submitBtn.disabled = false;
    });
  });

  // Example searches fill the box and stop there — same reasoning as
  // Ask's: the paid-member gate is on the submit button's own click
  // and a search spends real money, so nothing here may reach the
  // worker on its own.
  document.querySelectorAll("[data-ps-example]").forEach((btn) => {
    btn.addEventListener("click", () => {
      input.value = (btn.textContent || "").trim();
      input.focus();
    });
  });

  // A ?q= in the URL prefills the box and stops there, for the same
  // reason. Pair it with #power-search to land on this tab:
  // /the-faith-received/research/?q=justification#power-search
  try {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) input.value = q.slice(0, 300);
  } catch (_) { /* malformed query string — nothing to prefill */ }

  renderScopeState();
})();
