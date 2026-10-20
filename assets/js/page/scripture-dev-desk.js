/*
 * /the-faith-received/scripture/desk/?ref=john.3.16 — the Verse Desk.
 *
 * One template serves every verse in the Bible: the verse is the query
 * string, not the path, so no page exists per verse and none has to be
 * generated. A malformed or missing ref falls back to a chooser rather
 * than a guess.
 *
 * On the page, top to bottom (Ian, 2026-09-22):
 *   - the verse in the reader's translation, with its neighbours;
 *   - the verse in all four translations, except in the deuterocanon,
 *     which has one text and gets a line saying which;
 *   - every citation: the count, charts by century and tradition that
 *     double as filters, the filters and a search, the top five works,
 *     and the full list twenty at a time;
 *   - the commentaries on the book that cover this chapter;
 *   - Ask, handed the verse as its question.
 *
 * Ask HANDS OFF to /the-faith-received/ask/?ask= rather than running
 * here. The member gate, the monthly meter and the quote check all live
 * with Ask; a second copy on a public page would be a worse version of
 * the same gate. Same reasoning as mo-bible.js's verse tools.
 */
(function () {
  "use strict";
  const method = (html) => (window.TFRMethod ? window.TFRMethod.html(html) : html);
  const S = window.MOScriptureDev;
  if (!S) return;
  const { esc, fmt, plural } = S;
  const $root = document.querySelector("[data-sd-desk]");
  if (!$root) return;

  const params = new URLSearchParams(location.search);
  // ?ref=john.3.16, or the chooser's own GET form (?b=john&c=3&v=16).
  const ref = S.parseRef(params.get("ref")) ||
    S.parseRef(`${params.get("b") || ""}.${params.get("c") || ""}.${params.get("v") || ""}`);
  const t = S.recalledTranslation();
  const tParam = t === "ESV" ? "" : t;

  if (!ref || !ref.v) {
    renderChooser();
    // An address that named something the Desk could not place says so above the chooser (2026-10-15).
    const asked = (params.get("ref") || "").trim();
    if (asked) {
      const $note = document.createElement("p");
      $note.className = "sd-notice";
      $note.setAttribute("role", "status");
      $note.innerHTML = ref && !ref.v
        ? `“${esc(asked)}” names a chapter, and the Verse Desk opens one verse: choose it below, or <a href="${esc(S.readerHref(ref.book, ref.c, 0, tParam))}">read ${esc(S.refLabel(ref.book, ref.c))} in the reader</a>.`
        : `No verse matches “${esc(asked)}”. Choose a book, chapter and verse below.`;
      $root.prepend($note);
    }
    return;
  }
  const { book, c, v } = ref;
  const label = S.refLabel(book, c, v);
  document.title = `${label} | Verse Desk | The Faith Received | Mere Orthodoxy`;

  // The commentary lists' names: on this chapter, on the book, on the whole Bible (2026-10-15).
  const COMM_NAMES = S.commentaryTitles(book, c);
  // The deuterocanon is in none of the four translations, and mo-bible
  // has no book number for it, so that section is replaced by the one
  // line that says so rather than left as four rows that all fail.
  const transSection = book.ap
    ? `<section class="sd-desk-sec" aria-labelledby="sd-h-trans">` +
        `<h2 class="sd-h2" id="sd-h-trans">The text</h2>` +
        `<p class="sd-muted">${esc(S.APOCRYPHA_TEXT)}, from the library's own index. The four translations this reader offers do not carry the deuterocanon.</p>` +
      `</section>`
    : `<section class="sd-desk-sec" aria-labelledby="sd-h-trans">` +
        `<h2 class="sd-h2" id="sd-h-trans">In four translations</h2>` +
        `<dl class="sd-parallel" data-sd-parallel></dl>` +
      `</section>`;

  $root.innerHTML =
    `<header class="sd-desk-head">` +
      `<h2 class="sd-desk-title">${esc(label)}</h2>` +
      `<blockquote class="sd-desk-verse" data-sd-verse><span class="sd-muted">Loading the verse…</span></blockquote>` +
      `<p class="sd-desk-trans sd-muted" data-sd-verse-trans></p>` +
      `<nav class="sd-desk-nav" aria-label="Verse navigation">` +
        `<a data-sd-prev hidden>Previous verse</a>` +
        `<a href="${esc(S.readerHref(book, c, v, tParam))}">Back to ${esc(S.refLabel(book, c))}</a>` +
        `<a data-sd-next hidden>Next verse</a>` +
      `</nav>` +
    `</header>` +
    // The page runs long (ten screens on Romans 5:12): its sections by name, under the verse. The reception history's link
    // appears when faith-port-scripture-notes.js places that section.
    `<nav class="sd-desk-toc" aria-label="On this page"><span>On this page:</span>` +
      `<a href="#sd-h-trans">${book.ap ? "The text" : "Translations"}</a>` +
      `<a href="#sd-h-reads" data-sd-toc-reads hidden>Reception history</a>` +
      `<a href="#sd-h-comm">Commentaries</a><a href="#sd-h-cite">Citations</a><a href="#sd-h-sim">Similar passages</a><a href="#sd-h-ask">Ask</a>` +
    `</nav>` +

    `${transSection}` +

    /* The corpus owner's order (2026-09-25: "display first the chapter commentaries + whole bible
     * commentaries and the specific citations … and then similarity for verse desk"; "groupings by
     * author, work, etc and even when the same work might cite the same passage over many pages";
     * "allow the collapsing or expansion without going to a new link"): his two commentary lists,
     * the citations grouped by author and then work, similar passages, then Ask. Every section folds
     * in place. The two commentary lists start closed, with their counts, and every commentary
     * previews in place, as on the verse panel (2026-09-25: "for desk make same thing preview for
     * each"). */
    `<section class="sd-desk-sec" aria-labelledby="sd-h-comm">` +
      `<h2 class="sd-h2" id="sd-h-comm">Commentaries</h2>` +
      `${method("<p>The commentaries with their own note on this verse come first. Then come the commentaries on the book by tradition and the commentaries on the whole Bible. Last are the commentaries on other books that cite this chapter. Preview any of them without leaving the desk.</p>")}` +
      `<div data-sd-verse-comm></div>` +
      `<div class="sd-collection-index" data-sd-commentary-index>${["book", "whole", "cited", "other"].map((k) =>
        `<button type="button" class="sd-index-card" data-sd-commentary-tab="${k}" aria-expanded="false"><span>${esc(COMM_NAMES[k])}</span><small data-sd-comm-n="${k}">Loading…</small></button>`).join("")}</div>${ 
      ["book", "whole", "cited", "other"].map((k) =>
        `<section class="sd-expand-panel sd-commentary-panel" data-sd-commentary-panel="${k}" hidden><header><div><h3>${esc(COMM_NAMES[k])}</h3><p data-sd-comm-meta="${k}"></p></div><button type="button" class="sd-panel-close" data-sd-commentary-close aria-label="Close commentary collection">×</button></header><div data-sd-comm-body="${k}"><p class="sd-muted" role="status">Loading commentaries…</p></div></section>`).join("") 
    }</section>` +

    `<section class="sd-desk-sec" aria-labelledby="sd-h-cite">` +
      `<h2 class="sd-h2" id="sd-h-cite">Citations</h2>` +
      `<p class="sd-count" data-sd-count><span class="sd-muted">Counting citations…</span></p>` +
      `<div class="sd-charts" data-sd-charts></div>` +
      `<div data-sd-filters></div>` +
      `<h3 class="sd-h3">Most-cited sources</h3>` +
      `<ol class="sd-sources sd-top" data-sd-top></ol>` +
      `<h3 class="sd-h3" id="sd-h-all" data-sd-all-h>All citations</h3>` +
      `${method("<p>By author, then by work; a work that cites the verse on several pages is one row.</p>")}` +
      `<div class="sd-kinds" data-sd-kinds hidden></div>` +
      `<div class="sd-groups" data-sd-rows></div>` +
      `<button type="button" class="sd-more" data-sd-more hidden>Show more</button>` +
    `</section>` +

    `<section class="sd-desk-sec" aria-labelledby="sd-h-sim">` +
      `<h2 class="sd-h2" id="sd-h-sim">Similar passages</h2>` +
      `<div class="sd-similar-grid">` +
      `<div class="sd-similar-block">` +
      `<h3 class="sd-h3">Similar Scripture use</h3>` +
      `${method(`<p>Verses of this chapter cited on the same pages as ${esc(label)}, from the citations loaded above. A shared page does not mean a shared interpretation.</p>`)}` +
      `<ol class="sd-companions" data-sd-companions><li class="sd-muted">Loading…</li></ol>` +
      `</div><div class="sd-similar-block">` +
      `<h3 class="sd-h3">Similar wording</h3>` +
      `${method("<p>Passages whose wording resembles this verse, found by meaning search when you ask. Similarity does not establish agreement.</p>")}<p class="sd-muted">Open to members.</p>` +
      `<button type="button" class="sd-btn" data-sd-similar data-feature-gate="ask">Find passages like this verse</button>` +
      `<ol class="sd-sources" data-sd-similar-rows></ol>` +
      `</div></div>` +
    `</section>` +

    `<section class="sd-desk-sec" aria-labelledby="sd-h-ask">` +
      `<h2 class="sd-h2" id="sd-h-ask">Ask about this verse</h2>` +
      `<form class="sd-ask" data-sd-ask action="/the-faith-received/ask/" method="get">` +
        `<label class="sd-filter-label" for="sd-ask-q">Your question</label>` +
        `<textarea id="sd-ask-q" name="ask" rows="3"></textarea>` +
        `<p class="sd-muted sd-ask-note">Ask opens in the library's research workspace. It is open to members.</p>` +
        // Gated like every other Ask door (Ian, 2026-09-24): feature-gate.js
        // stops the submit click for a reader without an account and opens
        // the subscribe pop-up instead of sending them to /ask/.
        `<button type="submit" class="sd-btn" data-feature-gate="ask">Ask</button>` +
      `</form>` +
    `</section>`;

  // ── The verse, its neighbours, and four translations ──────────
  const $verse = $root.querySelector("[data-sd-verse]");
  const $verseTrans = $root.querySelector("[data-sd-verse-trans]");
  const short = S.textShort(book, t);
  /* A canonical verse is read out of its chapter, which the Desk needs
   * anyway for the parallel translations. An apocryphal one is not: the
   * citation worker already returns the verse's text, and the chapter
   * index gives the chapter's last verse, so two small responses do the
   * work of a chapter file the size of a photograph. */
  let deskVerseText = "";
  const verseAndLast = book.ap
    ? S.fetchApocryphaVerse(book, c, v)
    : S.chapterNode(t, book, c).then((box) => ({
      text: S.verseTextFrom(box, v),
      last: Math.max(0, ...Array.prototype.map.call(box.querySelectorAll(".bible-verse"), (el) => Number(el.dataset.v) || 0)),
    }));
  verseAndLast.then((d) => {
    const text = d.text || "";
    deskVerseText = text;
    $verse.textContent = text || `${label} is not in the ${short}.`;
    $verseTrans.textContent = S.textName(book, t);
    const $ask = $root.querySelector("#sd-ask-q");
    if (!$ask.value) {
      const quote = text.length > 240 ? `${text.slice(0, 240).replace(/\s+\S*$/, "")}…` : text;
      $ask.value = `What does the historic Christian tradition say about ${label}${quote ? ` (“${quote}”)` : ""}?`;
    }
    neighbours(d.last || 0);
  }).catch(() => {
    $verse.innerHTML = `<span class="sd-muted">The verse did not load in the ${esc(short)}.</span>`;
    neighbours(0);
  });

  // Previous and next cross chapter and book boundaries the same way the
  // reader's arrows do. The last verse of a chapter is only known once
  // the chapter has loaded; without it, Next steps to the next verse and
  // the page there says if it does not exist.
  function neighbours(last) {
    const $p = $root.querySelector("[data-sd-prev]");
    const $n = $root.querySelector("[data-sd-next]");
    const chain = S.chainOf(book);
    const at = chain.indexOf(book);
    let prev = null;
    if (v > 1) prev = [book, c, v - 1];
    else if (c > 1) prev = [book, c - 1, 0];
    else if (at > 0) { const b = chain[at - 1]; prev = [b, b.chapters, 0]; }
    let next = null;
    if (!last || v < last) next = [book, c, v + 1];
    else if (c < book.chapters) next = [book, c + 1, 1];
    else if (at < chain.length - 1) next = [chain[at + 1], 1, 1];
    // The last verse of the previous chapter is not known here, so that
    // step goes to the chapter in the reader rather than to a guess.
    if (prev) {
      window.MOSafeHref.set($p, prev[2] ? S.deskHref(prev[0], prev[1], prev[2], tParam) : S.readerHref(prev[0], prev[1], 0, tParam));
      $p.textContent = prev[2] ? `Previous: ${S.refLabel(prev[0], prev[1], prev[2])}` : `Previous: ${S.refLabel(prev[0], prev[1])}`;
      $p.hidden = false;
    }
    if (next) {
      window.MOSafeHref.set($n, S.deskHref(next[0], next[1], next[2], tParam));
      $n.textContent = `Next: ${S.refLabel(next[0], next[1], next[2])}`;
      $n.hidden = false;
    }
  }

  const $parallel = $root.querySelector("[data-sd-parallel]");
  if ($parallel) {
    $parallel.innerHTML = S.TRANSLATIONS.map((x) =>
      `<div class="sd-parallel-row"><dt title="${esc(x[2])}">${esc(x[1])}</dt><dd data-code="${esc(x[0])}"><span class="sd-muted">Loading…</span></dd></div>`,
    ).join("");
    S.TRANSLATIONS.forEach((x) => {
      const $dd = $parallel.querySelector(`dd[data-code="${x[0]}"]`);
      S.fetchVerseText(x[0], book, c, v)
        .then((txt) => { $dd.textContent = txt || "Not in this translation."; })
        .catch(() => { $dd.innerHTML = `<span class="sd-muted">Did not load.</span>`; });
    });
  }

  // ── Citations ─────────────────────────────────────────────────
  const $count = $root.querySelector("[data-sd-count]");
  const $charts = $root.querySelector("[data-sd-charts]");
  const $top = $root.querySelector("[data-sd-top]");
  const $rows = $root.querySelector("[data-sd-rows]");
  const $more = $root.querySelector("[data-sd-more]");
  const $allH = $root.querySelector("[data-sd-all-h]");
  const ctx = { book, c, v };
  let run = 0;
  let offset = 0;
  // All citations by author and then work, and the chapter verses the loaded pages cite beside this
  // one: declared before the first query() below runs.
  let groups = new Map();
  let openAuthor = "", openWork = "";
  /* EVERY AUTHOR, RANKED (2026-10-15, the owner: "correct ranking"). The rows arrive ranked by author weight, fifty at a time,
   * so the cards drawn from loaded rows showed Romans 5:12 as Luther alone, and seven authors after three hundred rows (no
   * Augustine, who cites it 160 times). The worker's author facet counts every citation under the filters, its hundred
   * largest first: the cards are drawn from it, and an author's rows are fetched when the card is opened. */
  let authorFacet = [];
  let authorYears = new Map(); // name -> the year the reception history dates him by (S.loadAuthorYears)
  let authorsShown = 15;
  const authorLoads = new Map();
  const authorDone = new Set();
  const PAGE_SIZE = 50;
  const MORE_PAGES = 5;
  const MORE_BATCH = PAGE_SIZE * MORE_PAGES;
  const KIND_BATCH = 100;
  let kindSel = "", kindTotals = null, lastMatched = 0, filling = false;
  const bar = S.filterBar($root.querySelector("[data-sd-filters]"), {
    search: true,
    searchLabel: `Search the citations of ${label}`,
    onChange: () => query(false),
  });
  $more.addEventListener("click", () => (kindSel ? fillKind() : loadMoreBatch()));

  async function loadMoreBatch() {
    if (filling || !offset) return;
    filling = true;
    $more.disabled = true;
    let pages = 0;
    try {
      while (offset && pages < MORE_PAGES) {
        pages += 1;
        const before = offset;
        await query(true);
        if (offset === before) break;
      }
    } finally {
      filling = false;
      $more.disabled = filling;
      updateMoreLabel();
    }
  }

  function updateMoreLabel() {
    const left = Math.max(0, Number(lastMatched || 0) - Number(offset || 0));
    // The ranked cards name the hundred largest authors; loading more rows reaches the rest (an author past the hundredth gets a
    // card from the rows) and feeds Similar Scripture use, so the button stays, named for what it loads.
    $more.hidden = !offset;
    $more.textContent = offset ? `Load ${fmt(Math.min(MORE_BATCH, left))} more citations (${fmt(left)} left)` : "Load more citations";
  }

  function query(more) {
    const my = more ? run : ++run;
    if (!more) {
      offset = 0;
      $top.innerHTML = `<li class="sd-muted" role="status">Loading…</li>`;
      resetGroups();
    }
    $more.disabled = true;
    return S.fetchVerse(book, c, v, bar.filters, offset, PAGE_SIZE).then((d) => {
      if (my !== run) return;
      $more.disabled = filling;
      if (!d || !d.total) {
        $count.textContent = `The library does not cite ${label} yet.`;
        $top.innerHTML = "";
        // The Citations fold keeps its count line; its lists and their headings go.
        $root.querySelectorAll("[data-sd-filters], .sd-top, [data-sd-rows], [data-sd-more], [aria-labelledby=\"sd-h-cite\"] .sd-h3, [aria-labelledby=\"sd-h-cite\"] .sd-h3 + .sd-muted").forEach((el) => { el.hidden = true; });
        $root.querySelector("[data-sd-companions]").innerHTML = `<li class="sd-muted">No citations of ${esc(label)} are held yet, so no companion verses either.</li>`;
        return;
      }
      bar.update(d.facets);
      const filtered = S.activeCount(bar.filters) > 0;
      $allH.textContent = filtered ? "Matching citations" : "All citations";
      $count.innerHTML = filtered
        ? `<strong>${fmt(d.matched)}</strong> of ${plural(d.total, "citation", "citations")} match`
        : `<strong>${fmt(d.total)}</strong> ${d.total === 1 ? "citation" : "citations"} of ${esc(label)} in the library`;
      if (!more) {
        authorFacet = (d.facets && d.facets.author) || [];
        charts(d.facets);
        $top.innerHTML = "";
        (d.top_works || []).forEach((w) => {
          // A work's kinds, when all its citations fit one response; the same rows give its Preview.
          const all = S.workRows(ctx, { ...bar.filters }, w);
          $top.appendChild(S.sourceItem(w, ctx, all ? {
            count: w.n,
            pickRow: () => all().then((x) => x.rows[0] || null),
            kinds: () => all().then((x) => (x.rows.length === x.matched ? S.kindsLabel(x.rows) : "")),
          } : {
            count: w.n,
            pickRow: () => S.fetchVerse(book, c, v, { ...bar.filters, w: w.w }, 0, 1)
              .then((x) => ((x && x.rows) || [])[0] || null).catch(() => null),
          }));
        });
        if (!(d.top_works || []).length) $top.innerHTML = `<li class="sd-muted">Nothing matches these filters.</li>`;
      }
      (d.rows || []).forEach(addGrouped);
      updateCompanions();
      lastMatched = d.matched;
      offset = d.next_offset || 0;
      updateKinds(d.matched);
      updateMoreLabel();
      if (kindSel) moreLabel();

    }).catch(() => {
      if (my !== run) return;
      $more.disabled = filling;
      $count.innerHTML = `<span class="sd-muted">Citations did not load.</span> <button type="button" class="sd-clear" data-sd-retry>Try again</button>`;
      $count.querySelector("[data-sd-retry]").addEventListener("click", () => query(false));
      $top.innerHTML = "";
    });
  }

  /* Two small bar charts: by century (in order) and by tradition (by
   * size). Each bar is a button that applies that filter, so the chart
   * is also the quickest way in. The counts are the facet counts, which
   * already honour the OTHER filters, so choosing a century leaves the
   * tradition chart showing that century's traditions. */
  /* Each chart folds (Ian, 2026-09-23: "Can you make these
   * collapsable?"). A <details> per chart, open by default, and the
   * choice is kept per browser: the charts are redrawn on every filter
   * change, so the state lives here rather than in the element. */
  const FOLD_KEY = "fr_sd_charts_closed";
  let closed = { cen: true, tr: true };
  try { closed = JSON.parse(window.localStorage.getItem(FOLD_KEY) || "null") || closed; } catch (e) { /* keep the compact default */ }
  // Display only: the shelf name "English Divines" is never shown.
  const trLabel = (x) => {
    const raw = x.label || x.k;
    try { return window.MOFaithLabel && window.MOFaithLabel.shelf ? window.MOFaithLabel.shelf(raw) : raw; } catch (e) { return raw; }
  };
  function charts(facets) {
    const block = (title, k, list) => {
      // Every century (they are the story); traditions are few anyway.
      const rows = list || [];
      if (!rows.length) return "";
      const max = Math.max(...rows.map((x) => x.n)) || 1;
      const cur = bar.filters[k][0] || "";
      return `<details class="sd-chart" data-sd-chart="${k}"${closed[k] ? "" : " open"}><summary>${esc(title)}${k === "cen" ? ` <span class="sd-muted">· select a bar to filter</span>` : ""}</summary><ul>${ 
        rows.map((x) =>
          `<li><button type="button" class="sd-cbar${String(x.k) === cur ? " is-on" : ""}" data-k="${k}" data-val="${esc(x.k)}" aria-pressed="${String(x.k) === cur}">` +
            `<span class="sd-cbar-label">${esc(k === "tr" ? trLabel(x) : (x.label || x.k))}</span>` +
            `<span class="sd-cbar-track"><span class="sd-cbar-fill" style="width:${Math.max(2, Math.round((x.n / max) * 100))}%"></span></span>` +
            `<span class="sd-cbar-n">${fmt(x.n)}</span>` +
          `</button></li>`,
        ).join("") 
        }</ul></details>`;
    };
    $charts.innerHTML =
      block("By century", "cen", facets && facets.century) +
      block("By tradition", "tr", facets && facets.tradition);
  }
  // toggle does not bubble; captured on the container.
  $charts.addEventListener("toggle", (e) => {
    const d = e.target;
    if (!d || !d.dataset || !d.dataset.sdChart) return;
    closed[d.dataset.sdChart] = !d.open;
    try { window.localStorage.setItem(FOLD_KEY, JSON.stringify(closed)); } catch (err) { /* not kept */ }
  }, true);
  $charts.addEventListener("click", (e) => {
    const b = e.target.closest(".sd-cbar");
    if (!b) return;
    const {k} = b.dataset;
    bar.set(k, bar.filters[k][0] === b.dataset.val ? "" : b.dataset.val);
  });

  query(false);

  // ── Commentaries ──────────────────────────────────────────────
  // The worker's list IS the corpus owner's list (v1/devotion.json.gz): works on the book (a chapter
  // range, or the whole book) and the whole-Bible sets it marks `annotation`. Each item previews in
  // place: its own comment on this verse when one is indexed, otherwise the reader at the page the
  // list links to (commentaryItem in the core).
  const commentaryList = (host, items, key) => {
    const $ol = document.createElement("ol");
    $ol.className = "sd-sources sd-panel-commentaries";
    host.replaceChildren($ol);
    S.commentaryRowsWithMore($ol, items, ctx, S.INITIAL_ROWS[key] || 9);
  };
  const $commentaryIndex = $root.querySelector("[data-sd-commentary-index]");
  const setCommentaryPanel = (name) => {
    $commentaryIndex.querySelectorAll("[data-sd-commentary-tab]").forEach((button) => {
      button.setAttribute("aria-expanded", String(button.dataset.sdCommentaryTab === name));
    });
    $root.querySelectorAll("[data-sd-commentary-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.sdCommentaryPanel !== name;
    });
  };
  $commentaryIndex.addEventListener("click", (event) => {
    const button = event.target.closest("[data-sd-commentary-tab]");
    if (!button) return;
    setCommentaryPanel(button.getAttribute("aria-expanded") === "true" ? "" : button.dataset.sdCommentaryTab);
  });
  $root.querySelectorAll("[data-sd-commentary-close]").forEach((button) => {
    button.addEventListener("click", () => setCommentaryPanel(""));
  });
  S.fetchCommentaries(book, c, S.emptyFilters()).then((d) => {
    const g = S.commentaryGroups(d && d.items, book, d && d.cited), names = S.commentaryTitles(book, c, g);
    const none = { book: `No commentary on ${book.name} is catalogued yet.`, whole: `No whole-Bible commentary is catalogued for ${book.name} yet.`,
      cited: `No commentary on another book cites ${S.refLabel(book, c)} yet.` };
    // the whole list's name says whether a Testament's sets are in it; a book with no other works shows no fourth card
    $root.querySelectorAll('[data-sd-commentary-tab="whole"] > span, [data-sd-commentary-panel="whole"] h3').forEach(($t) => { $t.textContent = names.whole; });
    $root.querySelectorAll('[data-sd-commentary-tab="other"], [data-sd-commentary-panel="other"]').forEach(($o) => { if (!g.other.length) $o.remove(); });
    ["book", "whole", "cited", "other"].filter((k) => k !== "other" || g.other.length).forEach((k) => {
      const $body = $root.querySelector(`[data-sd-comm-body="${k}"]`);
      if (g[k].length) commentaryList($body, g[k], k); else $body.innerHTML = `<p class="sd-muted">${esc(none[k])}</p>`;
      $root.querySelector(`[data-sd-comm-n="${k}"]`).textContent = plural(g[k].length, "commentary", "commentaries");
      $root.querySelector(`[data-sd-comm-meta="${k}"]`).textContent = plural(g[k].length, "commentary", "commentaries");
    });
  }).catch(() => {
    $root.querySelectorAll("[data-sd-comm-body]").forEach(($b) => { $b.innerHTML = `<p class="sd-muted">Commentaries did not load.</p>`; });
  });

  // ── Kinds: quotes, cites, alludes ─────────────────────────────
  // Corpus owner, 2026-09-25: "verses should include citations allusion classification". Each row
  // already says its kind; this counts the kinds among the rows loaded so far and shows one kind at a
  // time. The worker has no kind filter or facet, so the counts are of loaded rows and say so until
  // every citation is loaded; "Show more" adds to them.
  // EXACT AND COMPLETE (owner 2026-09-26, "fix the verse desk for ian, limits"): with no other filter the chips give the
  // verse's true totals from the library's kind index (the worker has none), and choosing a kind keeps loading until a
  // page of that kind is in hand instead of filtering only the fifty rows the worker has returned so far.
  const $kinds = $root.querySelector("[data-sd-kinds]");
  const K = window.FRScriptureKind, KORDER = ["quotation", "explicit", "allusion", "exegesis"];
  const kindWord = (k) => { const w = K ? K.verb(k) : ({ quotation: "quotes", explicit: "cites", allusion: "alludes", exegesis: "expounds" }[k] || "cites"); return w.charAt(0).toUpperCase() + w.slice(1); };
  const exactTotals = () => {
    if (!kindTotals || S.activeCount(bar.filters) > 0) return null;
    const row = ((kindTotals.verses || {})[String(c)] || {})[String(v)];
    if (!row) return null;
    const m = new Map();
    (kindTotals.kinds || KORDER).forEach((k, i) => { if (row[i]) m.set(kindWord(k), (m.get(kindWord(k)) || 0) + row[i]); });
    return m;
  };
  const loadedRows = () => [...groups.values()].flatMap((group) => [...group.works.values()].flatMap((work) => work.rows));
  const shownOfKind = () => loadedRows().filter((row) => S.kindOf(row) === kindSel).length;
  function moreLabel() {
    const ex = exactTotals(), total = ex && ex.get(kindSel), have = shownOfKind();
    $more.hidden = !offset;
    $more.textContent = total != null
      ? `Show ${fmt(Math.min(KIND_BATCH, Math.max(0, total - have)))} more ${kindSel.toLowerCase()} (${fmt(Math.max(0, total - have))} left)`
      : `Show ${fmt(KIND_BATCH)} more ${kindSel.toLowerCase()}`;
    if (total != null && have >= total) $more.hidden = true;
  }
  async function fillKind() {
    if (filling || !kindSel) return;
    filling = true; $more.disabled = true;
    const want = shownOfKind() + KIND_BATCH;
    let pages = 0;
    try { while (kindSel && offset && shownOfKind() < want && pages < 30) { pages += 1; await query(true); } }
    finally { filling = false; $more.disabled = false; moreLabel(); }
  }
  S.fetchKindTotals && S.fetchKindTotals(book).then((t) => { kindTotals = t; updateKinds(lastMatched); });
  // The fold counts follow the kind: under "Alludes" an author reads "2 works · 3 citations" of that kind.
  function applyKind() {
    renderGroups();
  }
  function updateKinds(matched) {
    const items = loadedRows();
    const exact = exactTotals();
    const n = exact || new Map();
    if (!exact) items.forEach((row) => { const k = S.kindOf(row); if (k) n.set(k, (n.get(k) || 0) + 1); });
    if (n.size < 2 && !kindSel) { $kinds.hidden = true; $kinds.innerHTML = ""; return; }
    if (kindSel && !n.has(kindSel)) kindSel = "";
    const chip = (k, text) => `<button type="button" class="sd-kind" data-kind="${esc(k)}" aria-pressed="${kindSel === k}">${esc(text)}</button>`;
    const loadedAll = items.length >= Number(matched || 0);
    $kinds.hidden = false;
    const chips = [...n.entries()].sort((a, b) => b[1] - a[1]).map(([k, x]) => chip(k, `${k} ${fmt(x)}`)).join("");
    const note = exact || loadedAll ? "" : `<span class="sd-muted sd-kinds-note">among the ${fmt(items.length)} loaded so far</span>`;
    $kinds.innerHTML = `<span class="sd-filter-label">Kind</span>${chip("", "All")}${chips}${note}`;
    applyKind();
  }
  $kinds.addEventListener("click", (e) => {
    const b = e.target.closest(".sd-kind");
    if (!b) return;
    kindSel = b.dataset.kind;
    $kinds.querySelectorAll(".sd-kind").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.kind === kindSel)));
    applyKind();
    if (kindSel) fillKind();
    else updateMoreLabel();
  });

  // ── All citations, by author and then by work ─────────────────
  // Rows arrive fifty at a time; each lands in its author's fold and its work's fold, so a work that
  // cites the verse on thirty pages is one row with its count, open on a click, never a new page.
  function resetGroups() {
    groups = new Map();
    authorLoads.clear();
    authorDone.clear();
    authorsShown = 15;
    openAuthor = "";
    openWork = "";
    $rows.innerHTML = "";
  }
  function addGrouped(r) {
    const aKey = r.a || "Author not recorded";
    let g = groups.get(aKey);
    if (!g) {
      g = { works: new Map(), n: 0, cen: 0 };
      groups.set(aKey, g);
    }
    if (Number(r.cen) > 0 && (!g.cen || Number(r.cen) < g.cen)) g.cen = Number(r.cen);
    let w = g.works.get(r.w);
    if (!w) {
      w = { title: r.t || r.w, rows: [] };
      g.works.set(r.w, w);
    }
    // An author's rows can arrive twice (the first pages, then the author's own fetch): one row per page and kind.
    const seen = `${r.p}|${r.how}|${r.h || ""}`;
    if (w.rows.some((x) => `${x.p}|${x.how}|${x.h || ""}` === seen)) return;
    w.rows.push(r);
    g.n += 1;
  }
  // Every row of one author under the current filters (fifty a response, up to 300), fetched once when the card is opened.
  function loadAuthor(key) {
    if (!authorLoads.has(key)) {
      const my = run;
      const page = (at, got) => S.fetchVerse(book, c, v, { ...bar.filters, au: [key] }, at, 50).then((d) => {
        if (my !== run) return;
        (d && d.rows || []).forEach(addGrouped);
        const next = d && d.next_offset;
        if (next && got + 50 < 300) return page(next, got + 50);
        authorDone.add(key);
      });
      authorLoads.set(key, page(0, 0).catch(() => { authorLoads.delete(key); }));
    }
    return authorLoads.get(key);
  }

  const visibleRows = (work) => work.rows.filter((row) => !kindSel || S.kindOf(row) === kindSel);
  const makeIndexCard = (type, key, title, meta, expanded, controls) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `sd-index-card sd-${type}-card`;
    button.dataset[`sd${type[0].toUpperCase()}${type.slice(1)}`] = key;
    button.setAttribute("aria-expanded", String(expanded));
    if (controls) button.setAttribute("aria-controls", controls);
    button.innerHTML = `<span>${esc(title)}</span><small>${esc(meta)}</small>`;
    return button;
  };
  // A set's volumes share one title in the index: each card says which volume it is, and they stand in volume order.
  let volumes = new Map();
  S.loadVolumes().then((loaded) => { volumes = loaded; if (groups.size) renderGroups(); });
  // when each author wrote, for every card (not only the authors whose rows are loaded)
  S.loadAuthorYears().then((loaded) => { authorYears = loaded; if (groups.size || authorFacet.length) renderGroups(); });
  function authorCentury(key, group) {
    const y = Number(authorYears.get(key));
    return y > 0 ? Math.floor((y - 1) / 100) + 1 : group.cen;
  }
  const volumeOf = (key, work) => S.volumeLabel(volumes, key, work.title);
  function renderWorkGroups(authorKey, group, host) {
    // The works that cite the verse most first (Against Julian before a letter citing it once), then by title and volume.
    const works = S.sortWorks([...group.works.entries()].map(([key, work]) => ({ key, work, rows: visibleRows(work), w: key, t: work.title })).filter((entry) => entry.rows.length), volumes)
      .map((entry, i) => [entry, i]).sort((a, b) => b[0].rows.length - a[0].rows.length || a[1] - b[1]).map(([entry]) => entry);
    for (let start = 0; start < works.length; start += 5) {
      const set = document.createElement("div");
      set.className = "sd-expand-group sd-work-set";
      const grid = document.createElement("div");
      grid.className = "sd-index-grid sd-work-grid";
      const chunk = works.slice(start, start + 5);
      chunk.forEach(({ key, work, rows }, index) => {
        const panelId = `sd-work-panel-${start + index}`;
        grid.appendChild(makeIndexCard("work", key, work.title, [volumeOf(key, work), plural(rows.length, "page", "pages")].filter(Boolean).join(" · "), openWork === key, panelId));
      });
      set.appendChild(grid);
      const selected = chunk.find(({ key }) => key === openWork);
      if (selected) {
        const panel = document.createElement("section");
        panel.className = "sd-expand-panel sd-work-panel";
        panel.id = `sd-work-panel-${start + chunk.indexOf(selected)}`;
        panel.innerHTML = `<header><div><h4>${esc(selected.work.title)}${volumeOf(selected.key, selected.work) ? `<span class="sd-source-vol">, ${esc(volumeOf(selected.key, selected.work))}</span>` : ""}</h4><p>${plural(selected.rows.length, "citation", "citations")} by ${esc(authorKey)}</p></div><button type="button" class="sd-panel-close" data-sd-work-close aria-label="Close work">×</button></header><ol class="sd-sources sd-citation-rows"></ol>`;
        const list = panel.querySelector("ol");
        selected.rows.forEach((row) => list.appendChild(S.sourceItem(row, ctx)));
        set.appendChild(panel);
      }
      host.appendChild(set);
    }
  }
  function renderGroups() {
    const fromRows = (key, group) => {
      const works = [...group.works.values()].filter((work) => visibleRows(work).length);
      return { key, group, works, n: works.reduce((sum, work) => sum + visibleRows(work).length, 0) };
    };
    const empty = { works: new Map(), n: 0, cen: 0 };
    // Under a kind chip the cards are of the rows loaded, which is what the chip counts; otherwise every author, ranked.
    const ranked = !kindSel && authorFacet.length;
    let authors = ranked
      ? authorFacet.map((x) => {
        const group = groups.get(x.k) || empty;
        const loaded = fromRows(x.k, group);
        return { key: x.k, group, works: loaded.works, n: Number(x.n) || loaded.n, whole: authorDone.has(x.k) || loaded.n >= Number(x.n) };
      })
      : [...groups.entries()].map(([key, group]) => ({ ...fromRows(key, group), whole: true })).filter((entry) => entry.n);
    if (ranked) {
      // authors past the facet's hundred, from the rows loaded so far, after the ranked ones and by their loaded count
      const named = new Set(authorFacet.map((x) => x.k));
      [...groups.entries()].filter(([key]) => !named.has(key)).map(([key, group]) => ({ ...fromRows(key, group), whole: true }))
        .filter((entry) => entry.n).sort((a, b) => b.n - a.n).forEach((entry) => authors.push(entry));
    }
    const total = authors.length;
    if (ranked) authors = authors.slice(0, Math.max(authorsShown, (authors.findIndex((x) => x.key === openAuthor) + 1) || 0));
    if (openAuthor && !authors.some((entry) => entry.key === openAuthor)) { openAuthor = ""; openWork = ""; }
    const fragment = document.createDocumentFragment();
    for (let start = 0; start < authors.length; start += 5) {
      const set = document.createElement("div");
      set.className = "sd-expand-group sd-author-set";
      const grid = document.createElement("div");
      grid.className = "sd-index-grid sd-author-grid";
      const chunk = authors.slice(start, start + 5);
      chunk.forEach(({ key, group, works, n, whole }, index) => {
        const panelId = `sd-author-panel-${start + index}`;
        // The century first, so the cards read as who and when (2026-10-15); the works once all the author's rows are in.
        grid.appendChild(makeIndexCard("author", key, key, [S.centuryLabel(authorCentury(key, group)), whole && works.length ? plural(works.length, "work", "works") : "", plural(n, "citation", "citations")].filter(Boolean).join(" · "), openAuthor === key, panelId));
      });
      set.appendChild(grid);
      const selected = chunk.find(({ key }) => key === openAuthor);
      if (selected) {
        const panel = document.createElement("section");
        panel.className = "sd-expand-panel sd-author-panel";
        panel.id = `sd-author-panel-${start + chunk.indexOf(selected)}`;
        panel.innerHTML = `<header><div><h3>${esc(selected.key)}</h3><p>${selected.whole ? `${plural(selected.works.length, "work", "works")} · ` : ""}${plural(selected.n, "citation", "citations")}</p></div><button type="button" class="sd-panel-close" data-sd-author-close aria-label="Close author">×</button></header><div class="sd-author-panel-body"></div>`;
        if (selected.whole) renderWorkGroups(selected.key, selected.group, panel.querySelector(".sd-author-panel-body"));
        else panel.querySelector(".sd-author-panel-body").innerHTML = `<p class="sd-muted" role="status">Loading ${esc(selected.key)}'s citations…</p>`;
        set.appendChild(panel);
      }
      fragment.appendChild(set);
    }
    if (ranked && total > authors.length) {
      const all = document.createElement("button");
      all.type = "button";
      all.className = "sd-commentary-more";
      all.dataset.sdAllAuthors = "";
      all.textContent = `Show all ${fmt(total)} authors`;
      fragment.appendChild(all);
    }
    $rows.replaceChildren(fragment);
  }
  $rows.addEventListener("click", (event) => {
    const author = event.target.closest("[data-sd-author]");
    const work = event.target.closest("[data-sd-work]");
    if (author) {
      const key = author.dataset.sdAuthor;
      openAuthor = openAuthor === key ? "" : key;
      openWork = "";
      renderGroups();
      const x = authorFacet.find((a) => a.k === key);
      if (openAuthor && x && !kindSel) loadAuthor(key).then(() => { if (openAuthor === key) { renderGroups(); updateCompanions(); } });
    } else if (event.target.closest("[data-sd-all-authors]")) {
      authorsShown = Infinity;
      renderGroups();
    } else if (work) {
      const key = work.dataset.sdWork;
      openWork = openWork === key ? "" : key;
      renderGroups();
    } else if (event.target.closest("[data-sd-author-close]")) {
      openAuthor = "";
      openWork = "";
      renderGroups();
    } else if (event.target.closest("[data-sd-work-close]")) {
      openWork = "";
      renderGroups();
    }
  });
  // Similar Scripture use: the verses of this chapter the loaded pages cite beside this one.
  function updateCompanions() {
    const $c = $root.querySelector("[data-sd-companions]");
    const companionCounts = new Map();
    loadedRows().forEach((r) => (r.vv || []).forEach((n) => { if (Number(n) !== Number(v)) companionCounts.set(Number(n), (companionCounts.get(Number(n)) || 0) + 1); }));
    const top = [...companionCounts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 15);
    $c.innerHTML = top.length
      ? top.map(([n, k]) => `<li class="sd-source"><a class="sd-panel-commentary" href="${esc(S.deskHref(book, c, n, tParam))}"><span class="sd-source-title">${esc(S.refLabel(book, c, n))}</span><span class="sd-source-meta">${plural(k, "shared page", "shared pages")}</span></a></li>`).join("")
      : `<li class="sd-muted">No other verse of ${esc(S.refLabel(book, c))} is cited on these pages.</li>`;
  }
  // Similar wording: the member-gated meaning search on the library worker, run only on the click
  // (feature-gate.js stops a reader without an account first; MOAuth attaches the member's token).
  const LIB = ((document.querySelector('meta[name="tfr-library-base"]') || {}).content || "https://mo-tfr-library.mo-podcast-feed.workers.dev").replace(/\/$/, "");
  let titles = null;
  $root.querySelector("[data-sd-similar]").addEventListener("click", async (e) => {
    const $b = e.currentTarget;
    const $out = $root.querySelector("[data-sd-similar-rows]");
    if (!deskVerseText) { $out.innerHTML = `<li class="sd-muted">The verse text has not loaded yet.</li>`; return; }
    $b.disabled = true;
    $out.innerHTML = `<li class="sd-muted" role="status">Searching the library…</li>`;
    try {
      const url = `${LIB}/v1/vsearch?${new URLSearchParams({ q: deskVerseText.slice(0, 480), k: "30" })}`;
      const res = await (window.MOAuth && window.MOAuth.fetch ? window.MOAuth.fetch(url, {}) : fetch(url));
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body && body.error) || "The similarity search is unavailable right now.");
      if (!titles) titles = await fetch(`${LIB}/v1/titles_en.json`, { credentials: "omit" }).then((x) => (x.ok ? x.json() : {})).catch(() => ({}));
      const seen = new Set();
      const hits = (body.results || []).filter((x) => x && x.slug && x.page != null && !seen.has(`${x.slug}|${x.page}`) && seen.add(`${x.slug}|${x.page}`)).slice(0, 20);
      $out.innerHTML = hits.length
        ? hits.map((x) => { const href = S.sourceHref(null, x.slug, x.page); const title = (titles && titles[x.slug]) || x.slug; return `<li class="sd-source"><a class="sd-panel-commentary" href="${esc(href || "#")}"><span class="sd-source-title">${esc(title)}</span><span class="sd-source-meta">page ${esc(String(x.page))}</span></a></li>`; }).join("")
        : `<li class="sd-muted">No similar passages were found for this verse.</li>`;
    } catch (err) {
      $out.innerHTML = `<li class="sd-muted" role="status">${esc(err && err.message ? err.message : "The similarity search is unavailable right now.")}</li>`;
    } finally {
      $b.disabled = false;
    }
  });

  // ── The chooser, for a Desk opened without a verse ────────────
  // Grouped by division, the same three the reader's tabs give: a flat
  // list of 73 would bury the seven that were just added.
  function renderChooser() {
    const opts = S.SECTIONS.map((s) =>
      `<optgroup label="${esc(s.label)}">${
        s.books.map((b) => `<option value="${b.slug}">${esc(b.name)}</option>`).join("")
      }</optgroup>`,
    ).join("");
    $root.innerHTML =
      `<header class="sd-desk-head"><h2 class="sd-desk-title">Choose a verse</h2></header>` +
      `<form class="sd-chooser" action="/the-faith-received/scripture/desk/" method="get">` +
        `<label class="sd-filter"><span class="sd-filter-label">Book</span><select name="b">${opts}</select></label>` +
        `<label class="sd-filter"><span class="sd-filter-label">Chapter</span><input name="c" type="number" min="1" max="150" value="1" inputmode="numeric" required></label>` +
        `<label class="sd-filter"><span class="sd-filter-label">Verse</span><input name="v" type="number" min="1" max="176" value="1" inputmode="numeric" required></label>${ 
        tParam ? `<input type="hidden" name="t" value="${esc(tParam)}">` : "" 
        }<button type="submit" class="sd-btn">Open</button>` +
      `</form>`;
  }
})();
