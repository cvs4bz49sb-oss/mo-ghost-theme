/*
 * The Faith Received — Positions.
 *
 * What a writer is recorded as holding on a doctrine: mined statements
 * grouped by what each one does (asserts, denies, reports another
 * view), each carrying the work and page it was drawn from and a link
 * that opens it in our reader.
 *
 * PORTED FROM the corpus owner's research build, where the same screen
 * appears on four of his pages. His `authors.in03.js`, `topics.in03.js`
 * and `bible.in03.js` are BYTE-IDENTICAL (sha 3c419cbe…) and
 * `fathers.in03.js` differs only in trivia: it is one engine, copied
 * four times, with the page it happens to be on read back out of
 * `location.pathname`. So this is one file, mounted on four pages with
 * different configuration, and nothing below knows or cares which page
 * it is drawing on beyond the attributes in § CONFIGURATION.
 *
 * What was kept from his version, because it is the good part:
 *
 *   - STANCE IS THE HEADING. A statement is filed under what it does,
 *     not under where it was found, so "what did he deny" is one glance
 *     rather than a read-through. Grouping by work is the alternative,
 *     not the default.
 *   - THE LOCI ARE THE ORDER. The doctrine picker is grouped into the
 *     eight classical loci in their classical order rather than sorted
 *     alphabetically or by size. All 43 of his locus labels exist in
 *     our topic registry, verified against the live index 2026-09-11;
 *     the other 137 topics follow under one heading of their own.
 *   - PAGE BY PAGE, AS YOU READ. The index pages at 50 a time behind a
 *     control that scrolls into view rather than behind a "load all".
 *   - IT STOPS. Two consecutive failures halt the surface instead of
 *     hammering a worker that is plainly not answering.
 *
 * What was dropped: his inline CSS, his fonts, his bridge bar, his
 * `safeReaderURL` (it validates against a hardcoded Vercel origin and a
 * `/read` path this site does not serve, so every URL it accepts 404s
 * here), and his comparison column, which belongs to the Compare panel
 * and is already built there.
 *
 * ── CONFIGURATION ────────────────────────────────────────────────
 *
 * A mount is a `[data-faith-positions]` element. The engine reads these
 * off it and everything else follows:
 *
 *   data-positions-topic        a fixed topic slug ("scripture")
 *   data-positions-topic-param  query param carrying the topic slug
 *   data-positions-author-param query param carrying the author, folded
 *   data-positions-before-year  keep only authors born before this year
 *   data-positions-lede         page-specific opening sentence
 *   data-positions-note         page-specific footnote
 *
 * Which of the two axes the page fixes decides the mode:
 *
 *   author page      author fixed from ?a=      -> pick a doctrine
 *   doctrines page   topic fixed from ?s=       -> pick a writer
 *   scripture page   topic fixed to "scripture" -> pick a writer
 *   fathers page     neither, born before 325   -> pick both
 *
 * ── WHERE THE DATA COMES FROM ────────────────────────────────────
 *
 * mo-tfr-library only, read from the tfr-library-base meta tag the way
 * every other Faith Received page reads it. Three shapes:
 *
 *   /v1/mine/topic2-all/index.json    every topic, 4 KB over the wire.
 *                                     The doctrine picker.
 *   /v1/mine/topic2-all/<topic>.json  one topic: the author directory
 *                                     (id, name, slug, shelf, birth
 *                                     year, catalogue counts) and the
 *                                     `evidence` paging contract.
 *   GET /v1/evidence?snapshot&topic&author&limit&cursor&include
 *                                     the statements themselves.
 *
 * `snapshot` is an OPAQUE TOKEN, echoed back so the client's own
 * equality check passes, and the response says so (snapshot_is_opaque).
 * There is no frozen-result store behind it, so nothing on screen
 * presents it as a durable citation and nothing here stores one.
 *
 * THE AUTHOR ID IS THE JOIN, and the topic file is the only place it
 * exists: `/v1/evidence` takes an opaque `a-<hex>`, and neither the
 * shelf roster nor our own catalogue carries one. Ids are global rather
 * than per topic (verified 2026-09-11: Augustine is a-accc1434… on both
 * `sin` and `grace`), but the file has to be opened to learn one, so
 * the resolution order is always topic first, author second, on all
 * four pages. That is why the author page asks for a doctrine before it
 * can say anything at all.
 *
 * ── COVERAGE, WHICH IS THE WHOLE POINT ───────────────────────────
 *
 * The catalogue records 12,075 positions for Augustine on Sin. This
 * library holds 401 of them, because the per-author topic files we were
 * given are capped and the database behind those counts was not.
 *
 * `coverage.positions` carries {held, total, capped, cap} and all four
 * matter. `held` is ours, `total` is the catalogue's, and `capped` says
 * which kind of number `held` is: a count of everything there is, or the
 * ceiling of the file it was read out of. Luther on Justification is 400
 * held against 20,748 recorded, `capped` true, and 400 is the end of the
 * road rather than a page that has not turned yet. A label that read the
 * catalogue's figure and ignored `capped` would render honest exhaustion
 * as a loader that never finishes. (The older flat `total_held` /
 * `catalogue_total` pair is read as a fallback and says one fact less.)
 *
 * Showing 401 as though it were the record is the one lie this screen
 * could tell that a reader would carry away and repeat, and an empty
 * panel that reads as "this author said nothing about sin" is the
 * second. Both are handled in statusLine() and every branch of it is a
 * sentence somebody could defend.
 *
 * ── WHAT IS IN THE BLOCKQUOTE (2026-09-11) ───────────────────────
 *
 * The writer's own words, and nothing else.
 *
 * The index's `q` was never a quotation. It is a machine-written
 * statement of the position, and checked against the works themselves
 * it appears in the text it cites 70 times in 3,240. Ambrose at
 * PL 14:0123 actually begins "Have men assumed so much opinion that
 * some of them established three principles of all things"; the index
 * says "Plato and his disciples posited three uncreated principles —
 * God, the exemplar/idea, and matter (hyle)". Four pages of those, set
 * as blockquotes under a Father's name, would be a fabrication however
 * carefully the surrounding copy hedged. Ian's ruling: no paraphrases,
 * direct quotes only.
 *
 * So `item.q` is now the text at the cited place, read out of the work
 * by the worker (website/workers/tfr-library/lib/locus-text.js), and
 * `item.quote.unit` says how precise it is:
 *
 *   "extract"  the index's own sentence, PROVED to sit at the cited
 *              place before it was shown
 *   "column"   the opening of the cited Migne column, taken whole
 *   "page"     the opening of the cited printed page, taken whole
 *
 * The second is the common case here, and it is the honest one: the
 * index's anchors point at a column's first block and never at a
 * sentence, so the unit of citation is the column. Each statement
 * prints which of the three it is, under the quotation.
 *
 * Every machine-written string has moved to `item.indexer` and is
 * printed under an "Index note" label. Where the passage could not be
 * reached at all the row stays, its citation stays, and the panel says
 * the passage is not held rather than putting the summary in its place.
 *
 * ── POSITIONS, NOT PAGE SUMMARIES ────────────────────────────────
 *
 * Items carry `src`: "position", "sample" or "page". A page row is a
 * SUMMARY OF A PAGE rather than something its author said on it and it
 * never carries a stance. Over half the rows in a sweep of 3,531 items
 * were page rows.
 *
 * A panel that files everything under Asserts, Denies and Reports has no
 * honest place to put them: filed under a stance they become claims the
 * writer never made, and filed under "other" they pad the count. So this
 * one asks for `include=positions` and drops any page row that arrives
 * anyway. The page annotations are not hidden, they are NAMED: the
 * footnote says how many exist for the pairing on screen and what they
 * are, so a short list of positions is never read as the whole index.
 *
 * `move` (the extraction's own label for what a statement is doing:
 * thesis, objection, proof) exists on a row here and there and on
 * nothing at all for most authors. It is printed when it is present and
 * nothing on this screen is arranged around it.
 *
 * ── LAZY ─────────────────────────────────────────────────────────
 *
 * Nothing is fetched until the panel is actually on screen. The trigger
 * is an IntersectionObserver on the mount, plus a MutationObserver on
 * an enclosing tab panel's `hidden` attribute for the case where this
 * is ever dropped into the research shell — the reasoning
 * faith-constellations.js sets out at length: attribute mutations are
 * delivered as microtasks, where a ResizeObserver or anything
 * rAF-driven is not delivered AT ALL in a tab the browser is not
 * painting, so a panel woken by one sits blank forever.
 *
 * ── SAFETY ───────────────────────────────────────────────────────
 *
 * Every string here came off the network. There is no innerHTML in this
 * file: nodes are built with createElement and filled with textContent.
 * The only href is the `url` the worker computed for the statement, and
 * it is required to be a path-relative link into /the-faith-received/
 * before MOSafeHref ever sees it. A statement whose link fails that
 * check still renders; it just has no link.
 *
 * `url` is used AS GIVEN and the source row's own `h` is ignored. Two
 * reasons, and the second is the load-bearing one. The owner's
 * `safeReaderURL` validates `h` against a hardcoded Vercel origin and a
 * `/read` path this site does not serve, so it rejects every correct URL
 * and accepts only ones that 404 here. And `url` is the only link that
 * is right for all four collections: pld, eebo and pg works need a `c=`
 * corpus param and pg takes no page at all, so a link rebuilt the native
 * way loads nothing for roughly nine items in ten.
 *
 * Page scripts run BEFORE site.min.js, so the only globals this file
 * may touch at parse time are the boot bundle's. It touches one:
 * MOSafeHref.
 */
(function () {
  "use strict";

  const hosts = document.querySelectorAll("[data-faith-positions]");
  if (!hosts.length) return;

  const baseMeta = document.querySelector('meta[name="tfr-library-base"]');
  const BASE = ((baseMeta && baseMeta.content) || "").replace(/\/$/, "");

  /* ── Small helpers ───────────────────────────────────────────── */

  const PAGE_SIZE = 50;
  const TIMEOUT = 25000;
  // Two consecutive failures and the surface stops asking. The owner's
  // own halt rule, kept: a worker that has refused twice in a row is not
  // going to be talked round by a third request made on the reader's
  // behalf without being asked for.
  const MAX_FAILURES = 2;
  // How many pages the scroll control is allowed to press on its own
  // before a reader has to press it themselves. Without a cap, a short
  // list re-arms the observer under the reader's thumb and 401
  // statements arrive in one uninterrupted cascade.
  const AUTO_PAGES = 4;

  const fmt = (x) => Number(x || 0).toLocaleString();

  const fold = (s) => String(s == null ? "" : s)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = String(text);
    return node;
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  function fetchOptions() {
    if (typeof AbortSignal !== "undefined" && AbortSignal.timeout) {
      return { signal: AbortSignal.timeout(TIMEOUT) };
    }
    return undefined;
  }

  // Resolves to null on any failure. Every caller treats null as "this
  // piece is not available" and says so on screen.
  function getJSON(url) {
    return fetch(url, fetchOptions())
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  }

  /* The statement's reader link.
   *
   * `url` is computed by the worker (readerUrlFor in
   * workers/tfr-library/lib/collections.js) and is the only link that is
   * right for all four collections: pld, pg and eebo works need a `c=`
   * corpus param, and a link built the native-only way loads nothing at
   * all. So it is used as given rather than rebuilt here.
   *
   * Used as given is not used unchecked. It crossed the network, so it
   * has to be a path-relative link into the reader's own corner of the
   * site before MOSafeHref sees it: MOSafeHref would happily pass
   * https://anywhere.example/, which is a correct scheme and the wrong
   * place entirely. */
  function readerHref(raw) {
    const url = typeof raw === "string" ? raw : "";
    if (!url || url.charAt(0) !== "/" || url.charAt(1) === "/" || url.charAt(1) === "\\") return "";
    if (url.indexOf("/the-faith-received/") !== 0) return "";
    return window.MOSafeHref ? window.MOSafeHref.sanitize(url, "") : url;
  }

  function link(href, text, cls) {
    const a = el("a", cls, text);
    if (window.MOSafeHref) window.MOSafeHref.set(a, href, "#");
    else a.setAttribute("href", href || "#");
    return a;
  }

  /* ── The loci ────────────────────────────────────────────────── *
   *
   * The classical order of the common places, and the owner's own
   * grouping of our topic registry into them. Checked against the live
   * /v1/mine/topic2-all/index.json on 2026-09-11: all 43 labels below
   * are present in it, and 137 further topics are not, which is what the
   * last group in the picker is for.
   *
   * Matched on the folded label rather than on a slug because the
   * registry's slug for "Christ / Christology" is christ-christology and
   * for "God's Will" is god-s-will, and one of those two conventions
   * will eventually change. */
  const LOCI = [
    ["Prolegomena and Scripture", [
      "Prolegomena / Theological Method", "Scripture", "Religion / True Worship"]],
    ["God and the Trinity", [
      "God", "The Existence of God", "The Divine Attributes & their Distinction",
      "Divine Simplicity", "The Eternity of God", "Divine Omnipresence & Immensity",
      "Omnipotence & Absolute Power", "God's Knowledge & Middle Knowledge",
      "The Will of God", "The Trinity", "Subsistent Relations & the Divine Persons",
      "The Divine Processions & Eternal Generation",
      "The Filioque & the Procession of the Spirit"]],
    ["Creation, providence and man", [
      "Creation", "Angels", "Providence", "Man / Anthropology", "Free Will"]],
    ["Sin", ["Sin"]],
    ["Christ and the Holy Spirit", ["Christ / Christology", "The Holy Spirit"]],
    ["Grace and salvation", [
      "Grace", "Predestination", "Covenant", "The Law", "The Gospel", "Faith",
      "Justification", "Sanctification", "Virtues / Moral Theology",
      "Christian Liberty", "Prayer"]],
    ["The church and the sacraments", [
      "The Church", "Sacraments", "Baptism", "The Lord's Supper",
      "The Civil Magistrate"]],
    ["Last things", ["Last Things", "Resurrection", "Eternal Life"]],
  ];
  const OTHER_LOCUS = "Everything else in the index";

  /* Stances, in the order they are read in. The fourth bucket carries
   * both `qualifies` and the rows that have no stance at all: a heading
   * that silently dropped them would under-report an author, which is
   * the failure mode this panel exists to avoid. */
  const STANCES = [
    ["asserts", "Asserts"],
    ["denies", "Denies"],
    ["reports", "Reports another view"],
    ["", "Qualifies or other"],
  ];
  const STANCE_KEYS = { asserts: "asserts", denies: "denies", reports: "reports" };
  const stanceKey = (r) => STANCE_KEYS[r.s] || "";

  /* A handful of registry entries are pipeline artifacts rather than
   * doctrines and say so in their own title ("Marriage is not in list").
   * The same filter faith-doctrines.js applies to the same file. */
  const JUNK = /not in (the )?(closed )?list|not listed/i;

  /* ── Shared fetches ──────────────────────────────────────────── *
   * Memoised across mounts. There is one mount per page today, but the
   * doctrines page already fetches its topic file for the synthesis
   * block above this panel, and a second parse of a 460 KB document is
   * worth not doing twice. */

  let topicIndexPromise = null;
  function loadTopicIndex() {
    if (!topicIndexPromise) {
      topicIndexPromise = getJSON(`${BASE}/v1/mine/topic2-all/index.json`);
    }
    return topicIndexPromise;
  }

  const topicFiles = new Map();
  function loadTopicFile(slug) {
    if (!topicFiles.has(slug)) {
      topicFiles.set(slug, getJSON(`${BASE}/v1/mine/topic2-all/${encodeURIComponent(slug)}.json`));
    }
    return topicFiles.get(slug);
  }

  /* One page of the index.
   *
   * The four things the response has to get right, and what each one
   * means if it does not:
   *   snapshot_id must echo what we sent, or we are reading a different
   *     corpus than the one we counted against;
   *   filters.author_id must echo what we sent, or these are somebody
   *     else's statements;
   *   items must be an array, or there is nothing to read;
   *   next_cursor must move when has_more is true, or the next request
   *     returns this same page forever.
   * Any of the four is a failure, not a page. */
  function loadPage(contract, authorId, cursor) {
    const params = new URLSearchParams({
      snapshot: String(contract.snapshot || ""),
      topic: String(contract.topic || ""),
      author: String(authorId || ""),
      limit: String(PAGE_SIZE),
      // POSITIONS ONLY. See § POSITIONS, NOT PAGE SUMMARIES at the top.
      // Additive: a worker that does not know the parameter ignores it
      // and the src filter in loadMore() catches what comes back anyway.
      include: "positions",
    });
    if (cursor) params.set("cursor", cursor);
    return fetch(`${BASE}/v1/evidence?${params}`, fetchOptions()).then((r) => {
      if (!r.ok) throw new Error(`evidence ${r.status}`);
      return r.json();
    }).then((result) => {
      if (!result || result.snapshot_id !== contract.snapshot) throw new Error("snapshot moved");
      if (!result.filters || result.filters.author_id !== authorId) throw new Error("author moved");
      if (!Array.isArray(result.items)) throw new Error("no items");
      if (result.has_more && (!result.next_cursor || result.next_cursor === cursor)) {
        throw new Error("cursor did not advance");
      }
      return result;
    });
  }

  /* ── One mount ───────────────────────────────────────────────── */

  function build(host) {
    if (host.getAttribute("data-positions-bound") === "1") return;
    host.setAttribute("data-positions-bound", "1");

    const attr = (name) => host.getAttribute(name) || "";
    const params = new URLSearchParams(window.location.search);

    const topicParam = attr("data-positions-topic-param");
    const authorParam = attr("data-positions-author-param");
    const fixedTopic = attr("data-positions-topic")
      || (topicParam ? (params.get(topicParam) || "") : "");
    const fixedAuthorKey = authorParam ? fold(params.get(authorParam) || "") : "";
    const beforeYear = parseInt(attr("data-positions-before-year"), 10);

    // A doctrine page with no ?s= is the index of every doctrine, and a
    // panel about one doctrine has nothing to say there.
    if (topicParam && !fixedTopic) { host.hidden = true; return; }
    // Likewise an author page reached without a name.
    if (authorParam && !fixedAuthorKey) { host.hidden = true; return; }

    const mode = fixedAuthorKey ? "author" : (fixedTopic ? "topic" : "open");

    const LEDE = {
      author: "What this writer is recorded as holding, doctrine by doctrine. "
        + "Choose a doctrine and the statements load below, each one carrying the work and page it was drawn from.",
      topic: "What the writers in this library are recorded as holding on this doctrine. "
        + "Choose a writer and the statements load below, each one carrying the work and page it was drawn from.",
      open: "What the earliest writers are recorded as holding, doctrine by doctrine. "
        + "Choose a doctrine and a writer; the statements load below, each one carrying the work and page it was drawn from.",
    };

    /* ── State ─────────────────────────────────────────────────── */

    let topics = []; // the registry, for the doctrine picker
    let topicSlug = fixedTopic;
    let topicLabel = "";
    let directory = null; // { contract, authors: [], label }
    let author = null; // the resolved directory row
    let group = "stance";
    let phrase = "";

    // Everything about the statements currently on screen. Reset
    // whenever the topic or the author changes.
    let run = 0;
    let rows = [];
    let seenIds = new Set();
    let seenContent = new Set();
    let duplicates = 0;
    let cursor = null;
    let held = null; // positions this library holds
    let catalogue = null; // positions the catalogue records
    let capped = false; // `held` is a file's ceiling, not a count
    let pageRows = null; // the page annotations, which are not shown here
    /* coverage.text from the pages fetched so far, summed: how many
     * citations resolved to the sentence the index marks, how many to
     * the opening of the cited column, how many to nothing. */
    let textStats = null;
    let reason = ""; // coverage.reason
    let loading = false;
    let done = false;
    let failures = 0;
    let halted = false;
    let autoLoads = 0;
    let fatal = ""; // the whole panel could not be set up

    /* ── Chrome ────────────────────────────────────────────────── */

    host.classList.add("fpos");
    const wrap = el("div", "container");
    const headingId = `fpos-head-${Math.random().toString(36).slice(2, 8)}`;
    const heading = el("h2", "fpos-head", "Positions");
    heading.id = headingId;
    host.setAttribute("aria-labelledby", headingId);
    wrap.appendChild(heading);
    wrap.appendChild(el("p", "fpos-lede", attr("data-positions-lede") || LEDE[mode]));

    // The same disclosure the curated topic pages and /doctrines/ carry,
    // in the same words. These statements come from the same extraction.
    const ai = el("div", "fr-ai-method");
    const aiBody = "<p>These statements were extracted and summarized by AI. The stance labels and the English are the extraction's, not an editor's.</p>";
    if (window.TFRMethod) {
      ai.innerHTML = window.TFRMethod.html(aiBody); // static markup, no data
    } else {
      ai.className = "fr-ai-note";
      ai.innerHTML = aiBody;
    }
    // The caution stays in view: it prevents misreading a statement, and says nothing about how it was made.
    ai.appendChild(el("p", "fr-ai-note-body",
      "A statement can report an objection or a view its author rejects, so read the passage "
      + "in its source before attributing it to anyone."));
    wrap.appendChild(ai);

    const controls = el("div", "fpos-controls");
    wrap.appendChild(controls);

    const statusEl = el("p", "fpos-status");
    statusEl.setAttribute("role", "status");
    statusEl.setAttribute("aria-live", "polite");
    wrap.appendChild(statusEl);

    const listEl = el("div", "fpos-list");
    wrap.appendChild(listEl);

    const moreBtn = el("button", "fpos-more", "Show more statements");
    moreBtn.type = "button";
    moreBtn.hidden = true;
    wrap.appendChild(moreBtn);

    const footEl = el("p", "fpos-note");
    footEl.hidden = true;
    wrap.appendChild(footEl);

    const pageNote = attr("data-positions-note");
    if (pageNote) wrap.appendChild(el("p", "fpos-note", pageNote));

    host.appendChild(wrap);

    /* ── Controls ──────────────────────────────────────────────── */

    function labelled(text, control) {
      const label = el("label", "fpos-field");
      label.appendChild(el("span", "fpos-field-label", text));
      label.appendChild(control);
      controls.appendChild(label);
      return control;
    }

    const topicSel = mode === "topic" ? null : labelled("Doctrine", el("select", "fpos-select"));
    const authorSel = mode === "author" ? null : labelled("Writer", el("select", "fpos-select"));
    const groupSel = labelled("Group by", el("select", "fpos-select"));
    [["stance", "What the statement does"], ["work", "The work it is in"]].forEach(([v, t]) => {
      const o = el("option", null, t);
      o.value = v;
      groupSel.appendChild(o);
    });
    const phraseInput = labelled("Find a phrase", el("input", "fpos-input"));
    phraseInput.type = "search";
    phraseInput.placeholder = "Search the statements loaded";

    if (topicSel) {
      topicSel.addEventListener("change", () => {
        topicSlug = topicSel.value;
        directory = null;
        topicLabel = "";
        author = null;
        fatal = "";
        // The previous doctrine's writers are not this doctrine's, so the
        // picker goes back to its loading state rather than standing there
        // offering names that may not be in the file now being fetched.
        if (authorSel) { clear(authorSel); authorsPaintedFor = null; }
        resetRows();
        paint();
        if (topicSlug) openTopic();
      });
    }
    if (authorSel) {
      authorSel.addEventListener("change", () => {
        author = (directory ? directory.authors : []).filter((a) => a.id === authorSel.value)[0] || null;
        resetRows();
        paint();
        if (author) loadMore();
      });
    }
    groupSel.addEventListener("change", () => { group = groupSel.value; paintList(); });
    let phraseTimer = null;
    phraseInput.addEventListener("input", () => {
      window.clearTimeout(phraseTimer);
      phraseTimer = window.setTimeout(() => { phrase = phraseInput.value; paintList(); }, 180);
    });
    moreBtn.addEventListener("click", () => { autoLoads = AUTO_PAGES; loadMore(); });

    /* ── Loading ───────────────────────────────────────────────── */

    function resetRows() {
      run += 1;
      rows = [];
      seenIds = new Set();
      seenContent = new Set();
      duplicates = 0;
      cursor = null;
      held = null;
      catalogue = null;
      capped = false;
      pageRows = null;
      textStats = null;
      reason = "";
      loading = false;
      done = false;
      failures = 0;
      halted = false;
      autoLoads = AUTO_PAGES;
    }

    // The topic file: the author directory and the paging contract. This
    // is the fetch that costs something (150 KB over the wire), so it
    // happens once per topic and only after a reader has asked for that
    // topic.
    function openTopic() {
      const token = run;
      loading = true;
      paint();
      loadTopicFile(topicSlug).then((file) => {
        if (token !== run) return;
        loading = false;
        if (!file || !Array.isArray(file.authors)) {
          fatal = "This doctrine's index could not be loaded, so no statements can be shown here. "
            + "Reload the page to try again.";
          paint();
          return;
        }
        const contract = file.evidence || {};
        directory = {
          label: file.t || topicSlug,
          contract: {
            snapshot: contract.snapshot || file.snapshot_id || "",
            topic: contract.topic || topicSlug,
          },
          authors: file.authors.filter((a) => a && a.id),
        };
        topicLabel = directory.label;
        chooseAuthor();
        paint();
        if (author) loadMore();
      });
    }

    const licensedOnly = (a) => {
      const shelves = Array.isArray(a.shelves) && a.shelves.length ? a.shelves : [a.sh];
      return shelves.every((s) => s === "po");
    };

    // The page's own filter on the directory, licence aside. On the
    // fathers page that is a date; everywhere else it is nothing.
    const inScope = (a) => !Number.isFinite(beforeYear) || (a.y != null && a.y < beforeYear);

    // The writers this mount will offer, in the order it offers them.
    function pickable() {
      if (!directory) return [];
      return directory.authors
        .filter((a) => inScope(a) && !licensedOnly(a))
        .slice()
        .sort((x, y) => (y.np || 0) - (x.np || 0) || String(x.a).localeCompare(String(y.a)));
    }

    function chooseAuthor() {
      if (mode === "author") {
        // The page's own ?a= is a folded name; the directory keys on a
        // slug and a display name. Fold both sides and compare, which is
        // what every other author-keyed panel in this theme does.
        author = directory.authors.filter((a) =>
          fold(a.s) === fixedAuthorKey || fold(a.a) === fixedAuthorKey)[0] || null;
        return;
      }
      // A picker opens on its best-attested writer rather than on
      // nothing, because a list whose first entry is "choose one" makes
      // every reader do the same piece of work.
      const list = pickable();
      author = list[0] || null;
    }

    function loadMore() {
      if (!directory || !author || loading || done || halted) return;
      const token = run;
      loading = true;
      paint();
      loadPage(directory.contract, author.id, cursor).then((result) => {
        if (token !== run) return;
        loading = false;
        failures = 0;
        result.items.forEach((item) => {
          if (!item || !item.w) return;
          /* A row with no `q` is one whose passage the library could
           * not reach. It is KEPT: the citation and the stance are
           * still a record of where the index found something, and
           * dropping it would quietly shrink a count the panel prints.
           * statementNode() paints it as a citation with a line saying
           * the passage is not held, never as a quotation. */
          if (!item.q && !(item.indexer && (item.indexer.statement || item.indexer.page_summary))) return;
          // A page row is a summary OF a page, not a statement made on
          // it, and it never carries a stance. `include=positions`
          // should have kept them off the wire; this is the check that
          // makes sure one never lands under an "Asserts" heading if a
          // worker somewhere has not learned the parameter yet.
          if (item.src === "page") return;
          const id = item.id == null ? "" : String(item.id);
          if (id && seenIds.has(id)) return;
          // The same statement reaches us twice under two ids: once from
          // the per-author file and once from the topic file's own
          // sample. Deduped on its content, and counted, so the footnote
          // can account for the gap between what the worker says it
          // holds and how many rows are on screen.
          const key = `${item.w}|${item.p == null ? "" : item.p}|`
            + `${(item.indexer && item.indexer.statement) || item.q || ""}`;
          if (seenContent.has(key)) { duplicates += 1; return; }
          if (id) seenIds.add(id);
          seenContent.add(key);
          rows.push(item);
        });
        /* COVERAGE. `coverage.positions` is the shape to read: {held,
         * total, capped, cap}. `held` is what this library actually has
         * and `total` is what the catalogue claims, and when `capped` is
         * true the first of those is a file's array ceiling rather than
         * a count, which is the difference between "that is all of it"
         * and "that is all we were given". The older flat fields are
         * read as a fallback so a worker mid-deploy degrades to the same
         * sentences with one fact less. */
        const coverage = result.coverage || {};
        const positions = coverage.positions || null;
        if (positions) {
          held = positions.held == null ? result.total : positions.held;
          catalogue = positions.total == null ? null : positions.total;
          capped = !!positions.capped;
        } else {
          held = coverage.total_held == null ? result.total : coverage.total_held;
          catalogue = coverage.catalogue_total == null ? null : coverage.catalogue_total;
          capped = false;
        }
        pageRows = coverage.pages || null;
        const t = coverage.text || null;
        if (t) {
          if (!textStats) textStats = { extract: 0, locus: 0, unresolved: 0 };
          textStats.extract += t.extract || 0;
          textStats.locus += t.locus || 0;
          textStats.unresolved += t.unresolved || 0;
        }
        reason = coverage.reason || "";
        cursor = result.next_cursor || null;
        done = !result.has_more;
        paint();
      }).catch(() => {
        if (token !== run) return;
        loading = false;
        failures += 1;
        if (failures >= MAX_FAILURES) halted = true;
        paint();
      });
    }

    /* The scroll control. The button is the control; the observer only
     * presses it, and only AUTO_PAGES times, so a reader who wants the
     * rest of a long index asks for it in the end. */
    let autoObserver = null;
    function armAutoLoad() {
      if (typeof IntersectionObserver !== "function") return;
      if (!autoObserver) {
        autoObserver = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            autoObserver.unobserve(entry.target);
            if (loading || done || halted || autoLoads <= 0) return;
            autoLoads -= 1;
            loadMore();
          });
        }, { rootMargin: "240px 0px" });
      }
      if (!moreBtn.hidden) autoObserver.observe(moreBtn);
    }

    /* ── Copy ──────────────────────────────────────────────────── *
     *
     * Every branch below is a sentence somebody could defend, and the
     * two that matter most are the last two: an empty panel must never
     * read as "this writer said nothing", and a partial one must never
     * read as the whole record.  */

    const authorName = () => (author && author.a) || "";
    const topicName = () => topicLabel || directory && directory.label || "";

    function statusLine() {
      if (fatal) return fatal;
      if (!topicSlug) return "Choose a doctrine to begin.";
      if (!directory) return loading ? "Loading the doctrine's index…" : "";
      if (!author) {
        if (mode === "author") {
          return `The statement index for ${topicName()} does not name this writer. `
            + `It covers ${fmt(directory.authors.length)} writers, and this one is not among them.`;
        }
        return `No writer in this list has statements recorded on ${topicName()}.`;
      }
      if (reason === "licensed-corpus") {
        return `${authorName()} is held here under a licence that does not let this library quote the text, `
          + "so no statements are shown.";
      }
      if (!rows.length) {
        if (loading) return `Loading ${authorName()} on ${topicName()}…`;
        if (halted || failures) return indexFailure();
        return `This library holds no mined statements from ${authorName()} on ${topicName()}. `
          + "That is a gap in what has been indexed here, not a sign that the writer was silent on it.";
      }
      const shown = fmt(rows.length);
      const total = held == null ? null : fmt(held);
      let line = done && total
        ? `All ${total} statements this library holds for ${authorName()} on ${topicName()} are loaded.`
        : `Showing ${shown}${total ? ` of the ${total}` : ""} statements this library holds for ${authorName()} on ${topicName()}.`;
      /* The sentence this panel exists to print. `capped` decides which
       * of the two versions is true: a held figure that is a file's
       * ceiling is not a count of what exists, and saying "401 of
       * 12,075" without saying why would read as a loader that has
       * stalled rather than as a library that was handed 401 rows. */
      if (catalogue != null && held != null && catalogue > held) {
        line += capped
          ? ` The catalogue records ${fmt(catalogue)} in all. The rest were never given to this library, `
            + "so this is a part of the record and not the whole of it."
          : ` The catalogue records ${fmt(catalogue)} in all, so this is a part of the record and not the whole of it.`;
      }
      if (loading) line += " Loading more…";
      // A retry button with nothing to explain it is a button a reader
      // has to guess at. The failure is said in the same breath as the
      // count it interrupted.
      else if (halted || failures) line += ` ${indexFailure()}`;
      return line;
    }

    /* Four sentences, because "it broke before it said anything" and "it
     * broke after fifty" are different facts and only the first of them
     * could be mistaken for a statement about the writer. */
    function indexFailure() {
      if (!rows.length) {
        return halted
          ? "The statement index did not answer, twice over, so this panel has stopped asking. "
            + "Nothing loaded at all, which is a fault at this end rather than anything about the writer. "
            + "Reload the page to try it again."
          : "The statement index did not answer. Nothing loaded at all, which is a fault at this end "
            + "rather than anything about the writer.";
      }
      return halted
        ? "The index then stopped answering, twice over, so this panel has stopped asking. "
          + "Nothing was dropped: what is above is what arrived before it stopped. "
          + "Reload the page to try for the rest."
        : "The index did not answer the request for the next page. "
          + "Nothing was dropped: what is above is what arrived before it stopped.";
    }

    function footLine() {
      const bits = [];
      /* What the reader is actually looking at, counted. The two units
       * are different claims about the text and the difference belongs
       * on screen, not only in this file's comments. */
      if (textStats && (textStats.extract || textStats.locus || textStats.unresolved)) {
        const parts = [];
        if (textStats.extract) {
          parts.push(`${fmt(textStats.extract)} at the sentence the index marks`);
        }
        if (textStats.locus) {
          parts.push(`${fmt(textStats.locus)} at the opening of the cited column or page`);
        }
        let line = parts.length
          ? `Quotations are taken from the works themselves: ${parts.join(", ")}.`
          : "";
        if (textStats.unresolved) {
          line += ` ${fmt(textStats.unresolved)} passage${textStats.unresolved === 1 ? "" : "s"} `
            + "could not be reached and appear as a citation alone.";
        }
        if (line) bits.push(line.trim());
      }
      /* The page annotations. They are indexed on the same author and
       * the same doctrine and they are NOT statements: a page summary
       * describes a page, and this panel would be claiming the writer
       * said it. Named rather than shown, so nobody reads a short list
       * of positions as the whole of what the index holds. */
      if (pageRows && pageRows.held) {
        bits.push(`The index also holds ${fmt(pageRows.held)} page annotations for this pairing. `
          + "Those summarise a page rather than quote a statement made on it, so they are not listed here.");
      }
      if (duplicates) {
        bits.push(`${fmt(duplicates)} of them ${duplicates === 1 ? "is a duplicate record" : "are duplicate records"} `
          + `of a passage already listed and ${duplicates === 1 ? "is" : "are"} shown once.`);
      }
      /* Counted against the page's own scope rather than against the
       * whole doctrine. On the fathers page the list is already narrowed
       * to writers born before Nicaea, and quoting the doctrine-wide
       * figure there would say 68 names were withheld from a list that
       * would only ever have held 5 of them. */
      if (directory) {
        const licensed = directory.authors.filter((a) => inScope(a) && licensedOnly(a)).length;
        if (licensed && mode !== "author") {
          bits.push(`${fmt(licensed)} writers who would otherwise be listed here sit in the Eastern Fathers, `
            + "which this library holds under a licence that does not allow quotation, so they are not offered.");
        }
      }
      return bits.join(" ");
    }

    /* ── Painting ──────────────────────────────────────────────── */

    function paint() {
      paintTopics();
      paintAuthors();
      statusEl.textContent = statusLine();
      paintList();
    }

    function paintTopics() {
      if (!topicSel || !topics.length || topicSel.getAttribute("data-filled") === "1") return;
      topicSel.setAttribute("data-filled", "1");
      const byLabel = new Map();
      topics.forEach((t) => { if (!byLabel.has(fold(t.t))) byLabel.set(fold(t.t), t); });
      const placed = new Set();
      const first = el("option", null, "Choose a doctrine");
      first.value = "";
      topicSel.appendChild(first);
      LOCI.forEach(([head, labels]) => {
        const grp = document.createElement("optgroup");
        grp.label = head;
        labels.forEach((label) => {
          const t = byLabel.get(fold(label));
          if (!t) return;
          placed.add(t.s);
          grp.appendChild(option(t));
        });
        if (grp.childNodes.length) topicSel.appendChild(grp);
      });
      const rest = topics.filter((t) => !placed.has(t.s))
        .slice().sort((a, b) => (b.na || 0) - (a.na || 0));
      if (rest.length) {
        const grp = document.createElement("optgroup");
        grp.label = OTHER_LOCUS;
        rest.forEach((t) => grp.appendChild(option(t)));
        topicSel.appendChild(grp);
      }
      topicSel.value = topicSlug || "";

      function option(t) {
        const o = el("option", null, t.t || t.s);
        o.value = t.s;
        return o;
      }
    }

    /* The writers this mount offers.
     *
     * The rebuild is keyed on the DIRECTORY, not on the topic slug. Keyed
     * on the slug, the paint that runs before the topic file has landed
     * claims the key with an empty list, and the paint that runs when the
     * writers actually arrive sees a key that already matches and returns:
     * the doctrines page kept "No writers recorded" on screen above
     * forty-nine of Luther's statements. */
    let authorsPaintedFor = null;
    function paintAuthors() {
      if (!authorSel) return;
      const want = author ? author.id : "";
      if (!directory) {
        if (authorsPaintedFor === null && !authorSel.options.length) {
          const o = el("option", null, "Loading writers…");
          o.value = "";
          authorSel.appendChild(o);
          authorSel.disabled = true;
        }
        return;
      }
      const list = pickable();
      const key = `${topicSlug}|${list.length}`;
      if (authorsPaintedFor === key) {
        if (authorSel.value !== want) authorSel.value = want;
        return;
      }
      authorsPaintedFor = key;
      clear(authorSel);
      if (!list.length) {
        const o = el("option", null, "No writers recorded");
        o.value = "";
        authorSel.appendChild(o);
        authorSel.disabled = true;
        return;
      }
      authorSel.disabled = false;
      list.forEach((a) => {
        const o = el("option", null,
          `${a.a}${a.y != null ? ` (b. ${a.y})` : ""} · ${fmt(a.np)} in the catalogue`);
        o.value = a.id;
        authorSel.appendChild(o);
      });
      authorSel.value = want;
    }

    function matches(r) {
      if (!phrase) return true;
      const needle = fold(phrase);
      if (!needle) return true;
      const idx = r.indexer || {};
      const hay = `${r.q || ""} ${idx.statement || ""} ${idx.page_summary || ""} ${r.wt || r.w}`;
      return fold(hay).indexOf(needle) !== -1;
    }

    function groupsOf(kept) {
      if (group === "work") {
        const byWork = new Map();
        kept.forEach((r) => {
          if (!byWork.has(r.w)) byWork.set(r.w, []);
          byWork.get(r.w).push(r);
        });
        return [...byWork.entries()].map(([w, rs]) => ({
          key: w,
          label: rs[0].wt || w,
          rows: rs,
        })).sort((a, b) => b.rows.length - a.rows.length || a.label.localeCompare(b.label));
      }
      const byStance = new Map();
      kept.forEach((r) => {
        const k = stanceKey(r);
        if (!byStance.has(k)) byStance.set(k, []);
        byStance.get(k).push(r);
      });
      return STANCES
        .filter(([k]) => byStance.has(k))
        .map(([k, label]) => ({ key: k || "other", label, rows: byStance.get(k) }));
    }

    /* Why a citation has no text, in the reader's words rather than in
     * the endpoint's. */
    const NO_TEXT = {
      "licensed": "The licence on this collection does not allow the passage to be shown here.",
      "work-not-held": "This library holds the citation for this passage but not the text of the work.",
      "locus-not-found": "The cited place is not in the copy of the work held here.",
      "work-has-no-columns": "The copy of this work held here carries no column numbers, so the citation cannot be located in it.",
      "locus-not-held": "The text of this part of the work is not held here.",
      "no-column-range": "This work has no column range recorded, so the citation cannot be located.",
      "no-locus": "The index recorded no place in the work for this statement.",
      "not-resolved-here": "The passage was not fetched with this page of results. Load more to bring it in.",
      "read-failed": "The passage could not be read just now.",
    };
    const NO_TEXT_DEFAULT = "The passage behind this citation could not be reached.";

    /* ── HOW PRECISE THE QUOTATION IS ────────────────────────────── *
     *
     * Two units, and the difference is a claim about the text, so it is
     * printed rather than implied.
     *
     *   "the passage the index marks"       the index's own sentence,
     *                                       proved to sit at the cited
     *                                       place before it was shown.
     *   "the opening of the cited column"   the first words printed at
     *                                       that column, taken whole
     *                                       from the work.
     *
     * The second is the common case for mined positions and it is not a
     * shortcoming: Migne is cited BY COLUMN, the index's own anchors
     * point at a column's first block and never at a sentence, and a
     * column runs to some hundreds of words. Saying "the opening of the
     * cited column" is the true version of what the reader is looking
     * at; implying a sentence would not be. */
    function provenanceOf(q) {
      if (!q || q.status !== "ok") return "";
      const locus = q.locus ? `${q.locus} · ` : "";
      if (q.unit === "extract") return `${locus}the passage the index marks`;
      if (q.unit === "column") return `${locus}the opening of the cited column`;
      return `${locus}the opening of the cited page`;
    }

    /* ── ONE COLUMN, ONE QUOTATION ───────────────────────────────── *
     *
     * The index regularly mines several positions from a single Migne
     * column — Ambrose on Creation has two at PL 14:0285 alone — and
     * the honest unit of quotation is the column, so each of those
     * rows resolves to the SAME words. Printed one per row that is the
     * same paragraph of Ambrose set out twice under two different
     * notes, which reads as two passages and is not.
     *
     * Rows are therefore bucketed by the place they cite, in the order
     * the list already has them, and a bucket is one article: the
     * column quoted once, then each index note under it. */
    function bucketByLocus(rs) {
      const out = [];
      let last = null;
      rs.forEach((r) => {
        const key = `${r.w}|${r.p == null ? "" : r.p}|${r.q || ""}`;
        if (last && last.key === key) { last.rows.push(r); return; }
        last = { key, rows: [r] };
        out.push(last);
      });
      return out;
    }

    function noteOf(r) {
      const idx = r.indexer && typeof r.indexer === "object" ? r.indexer : {};
      return idx.statement || idx.page_summary || "";
    }

    function statementNode(bucket) {
      const rs = Array.isArray(bucket) ? bucket : [bucket];
      const r = rs[0];
      const art = el("article", "fpos-statement");
      const q = r.quote && typeof r.quote === "object" ? r.quote : null;
      const idx = r.indexer && typeof r.indexer === "object" ? r.indexer : {};

      if (r.q) {
        art.appendChild(el("blockquote", "fpos-quote", r.q));
        const prov = provenanceOf(q);
        if (prov) art.appendChild(el("p", "fpos-provenance", prov));
      } else {
        art.appendChild(el("p", "fpos-notext", (q && NO_TEXT[q.status]) || NO_TEXT_DEFAULT));
      }

      /* The index's own strings: its statement of the position and its
       * summary of the page. NOT more of the writer, so they are
       * labelled rather than set as a second paragraph of the
       * quotation — an unlabelled line under a blockquote reads as part
       * of it, which is how a machine summary came to be read as
       * Ambrose for as long as it did. */
      rs.map(noteOf).filter(Boolean).forEach((note) => {
        const gloss = el("p", "fpos-gloss");
        gloss.appendChild(el("span", "fpos-gloss-label", "Index note"));
        gloss.appendChild(document.createTextNode(String(note)));
        art.appendChild(gloss);
      });

      const cite = el("p", "fpos-cite");
      cite.appendChild(el("span", "fpos-work", r.wt || r.w));
      // The printed locus where there is one ("PL 14:0123"), which is
      // how these works are cited; the bare index number otherwise.
      const locus = q && q.locus ? q.locus : (r.p != null && r.p !== "" ? `p. ${r.p}` : "");
      if (locus) cite.appendChild(el("span", "fpos-page", locus));
      if (group === "work" && r.s) cite.appendChild(el("span", "fpos-tag", r.s));
      if (idx.move) cite.appendChild(el("span", "fpos-tag", String(idx.move)));
      const href = readerHref(r.url);
      if (href) cite.appendChild(link(href, "Read the passage", "fpos-read"));
      art.appendChild(cite);
      return art;
    }

    function paintList() {
      clear(listEl);
      footEl.hidden = true;
      moreBtn.hidden = true;
      if (!rows.length) return;

      const kept = rows.filter(matches);
      if (!kept.length) {
        listEl.appendChild(el("p", "fpos-note", "No loaded statement matches that phrase."));
        return;
      }
      groupsOf(kept).forEach((g, i) => {
        const box = el("details", "fpos-group");
        if (i === 0) box.open = true;
        const sum = el("summary", "fpos-group-head");
        sum.appendChild(el("span", "fpos-group-label", g.label));
        sum.appendChild(el("span", "fpos-group-n", fmt(g.rows.length)));
        box.appendChild(sum);
        const body = el("div", "fpos-group-body");
        bucketByLocus(g.rows).forEach((b) => body.appendChild(statementNode(b.rows)));
        box.appendChild(body);
        listEl.appendChild(box);
      });

      /* Halted means halted. The retry does NOT reset the counter, so
       * two consecutive failures end the offer however they were asked
       * for, and the status line says to reload. Resetting it here would
       * make the owner's halt rule unreachable: the first failure hides
       * the automatic control, so a second consecutive one can only ever
       * come from a press. */
      if (halted) {
        // No control. statusLine() has said why and what to do instead.
      } else if (failures && !loading) {
        const retry = el("button", "fpos-retry", "Try the index again");
        retry.type = "button";
        retry.addEventListener("click", () => {
          autoLoads = 0;
          loadMore();
        });
        listEl.appendChild(retry);
      } else if (!done) {
        moreBtn.hidden = false;
        moreBtn.disabled = loading;
        moreBtn.textContent = loading ? "Loading…" : "Show more statements";
        armAutoLoad();
      }

      const foot = footLine();
      if (foot) {
        footEl.textContent = foot;
        footEl.hidden = false;
      }
    }

    /* ── Waking up ─────────────────────────────────────────────── *
     * Everything above costs nothing and has run already. Below is the
     * first byte over the wire, and it waits for the panel to be looked
     * at. See § LAZY at the top of the file. */

    function boot() {
      if (!BASE) {
        fatal = "The library could not be reached from this page, so no statements can be shown here.";
        paint();
        return;
      }
      paint();
      if (mode === "topic") {
        // The topic is already known, so the directory is the only thing
        // standing between a visible panel and its statements.
        openTopic();
        return;
      }
      loadTopicIndex().then((data) => {
        topics = ((data && data.topics) || []).filter((t) => t && t.s && !JUNK.test(t.t || t.s));
        if (!topics.length) {
          fatal = "The doctrine index could not be loaded, so no statements can be shown here. "
            + "Reload the page to try again.";
        }
        paint();
        if (topicSlug) openTopic();
      });
    }

    whenVisible(host, boot);
  }

  /* ── Visibility ──────────────────────────────────────────────── *
   *
   * Runs `fn` once, the first time the node could actually be seen.
   *
   * Two observers, because they cover two different kinds of hidden. An
   * IntersectionObserver answers "has it been scrolled to", which is the
   * case on all four pages this mounts on today. A MutationObserver on
   * an enclosing tab panel's `hidden` attribute answers "has the tab
   * been opened", and it is the load-bearing one if this is ever dropped
   * into the research shell: a hidden panel has no box, so the
   * intersection observer would never fire, and neither would anything
   * rAF-driven (FRONTEND §6.30). Attribute mutations are delivered as
   * microtasks and do not care whether anything is being painted. */
  function whenVisible(node, fn) {
    let fired = false;
    let io = null;

    function go() {
      if (fired) return;
      fired = true;
      if (io) io.disconnect();
      fn();
    }

    function watchScroll() {
      if (typeof IntersectionObserver !== "function") { go(); return; }
      io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => { if (entry.isIntersecting) go(); });
      }, { rootMargin: "300px 0px" });
      io.observe(node);
    }

    const panel = node.closest ? node.closest("[data-research-panel]") : null;
    if (panel && panel.hidden && typeof MutationObserver === "function") {
      const watch = new MutationObserver(() => {
        if (panel.hidden) return;
        watch.disconnect();
        watchScroll();
      });
      watch.observe(panel, { attributes: true, attributeFilter: ["hidden"] });
      return;
    }
    watchScroll();
  }

  hosts.forEach(build);
}());
