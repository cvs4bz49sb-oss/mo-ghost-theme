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
 *   - the verse in all five translations, except in the deuterocanon,
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
    return;
  }
  const { book, c, v } = ref;
  const label = S.refLabel(book, c, v);
  document.title = `${label} | Verse Desk | The Faith Received | Mere Orthodoxy`;

  // The deuterocanon is in none of the five translations, and mo-bible
  // has no book number for it, so that section is replaced by the one
  // line that says so rather than left as five rows that all fail.
  const transSection = book.ap
    ? `<section class="sd-desk-sec" aria-labelledby="sd-h-trans">` +
        `<h2 class="sd-h2" id="sd-h-trans">The text</h2>` +
        `<p class="sd-muted">${esc(S.APOCRYPHA_TEXT)}, from the library's own index. The five translations this reader offers do not carry the deuterocanon.</p>` +
      `</section>`
    : `<section class="sd-desk-sec" aria-labelledby="sd-h-trans">` +
        `<h2 class="sd-h2" id="sd-h-trans">In five translations</h2>` +
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
      `<details class="sd-desk-fold"><summary><h2 class="sd-h2" id="sd-h-comm">Chapter commentaries <span class="sd-muted" data-sd-comm-n></span></h2></summary>` +
      `<div data-sd-comm><p class="sd-muted" role="status">Loading commentaries…</p></div></details>` +
    `</section>` +
    `<section class="sd-desk-sec" aria-labelledby="sd-h-wb">` +
      `<details class="sd-desk-fold"><summary><h2 class="sd-h2" id="sd-h-wb">Whole-Bible commentaries <span class="sd-muted" data-sd-wb-n></span></h2></summary>` +
      `<div data-sd-wb></div></details>` +
    `</section>` +

    `<section class="sd-desk-sec" aria-labelledby="sd-h-cite">` +
      `<details class="sd-desk-fold" open><summary><h2 class="sd-h2" id="sd-h-cite">Citations</h2></summary>` +
      `<p class="sd-count" data-sd-count><span class="sd-muted">Counting citations…</span></p>` +
      `<div class="sd-charts" data-sd-charts></div>` +
      `<div data-sd-filters></div>` +
      `<h3 class="sd-h3">Most-cited sources</h3>` +
      `<ol class="sd-sources sd-top" data-sd-top></ol>` +
      `<h3 class="sd-h3" id="sd-h-all" data-sd-all-h>All citations</h3>` +
      `<p class="sd-muted">By author, then by work; a work that cites the verse on several pages is one row.</p>` +
      `<div class="sd-kinds" data-sd-kinds hidden></div>` +
      `<div class="sd-groups" data-sd-rows></div>` +
      `<button type="button" class="sd-more" data-sd-more hidden>Show more</button>` +
      `</details>` +
    `</section>` +

    `<section class="sd-desk-sec" aria-labelledby="sd-h-sim">` +
      `<details class="sd-desk-fold" open><summary><h2 class="sd-h2" id="sd-h-sim">Similar passages</h2></summary>` +
      `<h3 class="sd-h3">Similar Scripture use</h3>` +
      `<p class="sd-muted">Verses of this chapter cited on the same pages as ${esc(label)}, from the citations loaded above. A shared page does not mean a shared interpretation.</p>` +
      `<ol class="sd-companions" data-sd-companions><li class="sd-muted">Loading…</li></ol>` +
      `<h3 class="sd-h3">Similar wording</h3>` +
      `<p class="sd-muted">Passages whose wording resembles this verse, found by meaning search when you ask. Similarity does not establish agreement. Open to members.</p>` +
      `<button type="button" class="sd-btn" data-sd-similar data-feature-gate="ask">Find passages like this verse</button>` +
      `<ol class="sd-sources" data-sd-similar-rows></ol>` +
      `</details>` +
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

  // ── The verse, its neighbours, and five translations ──────────
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
  let companionCounts = new Map();
  const bar = S.filterBar($root.querySelector("[data-sd-filters]"), {
    search: true,
    searchLabel: `Search the citations of ${label}`,
    onChange: () => query(false),
  });
  $more.addEventListener("click", () => query(true));

  function query(more) {
    const my = more ? run : ++run;
    if (!more) {
      offset = 0;
      $top.innerHTML = `<li class="sd-muted" role="status">Loading…</li>`;
      resetGroups();
    }
    $more.disabled = true;
    S.fetchVerse(book, c, v, bar.filters, offset, 50).then((d) => {
      if (my !== run) return;
      $more.disabled = false;
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
      updateKinds(d.matched);
      offset = d.next_offset || 0;
      $more.hidden = !d.next_offset;
      $more.textContent = d.next_offset ? `Show more (${fmt(d.matched - d.next_offset)} left)` : "Show more";
    }).catch(() => {
      if (my !== run) return;
      $more.disabled = false;
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
  let closed = {};
  try { closed = JSON.parse(window.localStorage.getItem(FOLD_KEY) || "{}") || {}; } catch (e) { closed = {}; }
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
  const commentaryList = (host, items) => {
    const $ol = document.createElement("ol");
    $ol.className = "sd-sources sd-panel-commentaries";
    items.forEach((e) => $ol.appendChild(S.commentaryItem(e, ctx)));
    host.replaceChildren($ol);
  };
  S.fetchCommentaries(book, c, S.emptyFilters()).then((d) => {
    const { chapter, whole } = S.commentaryGroups(d && d.items);
    const $comm = $root.querySelector("[data-sd-comm]");
    const $wb = $root.querySelector("[data-sd-wb]");
    if (chapter.length) commentaryList($comm, chapter);
    else $comm.innerHTML = `<p class="sd-muted">No commentaries on ${esc(book.name)} are catalogued yet.</p>`;
    if (whole.length) commentaryList($wb, whole);
    else $wb.innerHTML = `<p class="sd-muted">No whole-Bible commentaries are catalogued for ${esc(book.name)} yet.</p>`;
    $root.querySelector("[data-sd-comm-n]").textContent = `(${fmt(chapter.length)})`;
    $root.querySelector("[data-sd-wb-n]").textContent = `(${fmt(whole.length)})`;
  }).catch(() => {
    $root.querySelector("[data-sd-comm]").innerHTML = `<p class="sd-muted">Commentaries did not load.</p>`;
  });

  // ── Kinds: quotes, cites, alludes ─────────────────────────────
  // Corpus owner, 2026-09-25: "verses should include citations allusion classification". Each row
  // already says its kind; this counts the kinds among the rows loaded so far and shows one kind at a
  // time. The worker has no kind filter or facet, so the counts are of loaded rows and say so until
  // every citation is loaded; "Show more" adds to them.
  const $kinds = $root.querySelector("[data-sd-kinds]");
  let kindSel = "";
  function applyKind() {
    $rows.querySelectorAll(".sd-work").forEach((w) => {
      let shown = 0;
      w.querySelectorAll(":scope > ol > .sd-source").forEach((li) => {
        li.hidden = Boolean(kindSel) && li.dataset.kind !== kindSel;
        if (!li.hidden) shown += 1;
      });
      w.hidden = !shown;
    });
    $rows.querySelectorAll(".sd-group").forEach((g) => {
      g.hidden = !g.querySelector(".sd-work:not([hidden])");
    });
  }
  function updateKinds(matched) {
    const items = [...$rows.querySelectorAll(".sd-work > ol > .sd-source")];
    const n = new Map();
    items.forEach((li) => { const k = li.dataset.kind; if (k) n.set(k, (n.get(k) || 0) + 1); });
    if (n.size < 2 && !kindSel) { $kinds.hidden = true; $kinds.innerHTML = ""; return; }
    if (kindSel && !n.has(kindSel)) kindSel = "";
    const chip = (k, text) => `<button type="button" class="sd-kind" data-kind="${esc(k)}" aria-pressed="${kindSel === k}">${esc(text)}</button>`;
    const loadedAll = items.length >= Number(matched || 0);
    $kinds.hidden = false;
    const chips = [...n.entries()].sort((a, b) => b[1] - a[1]).map(([k, x]) => chip(k, `${k} ${fmt(x)}`)).join("");
    const note = loadedAll ? "" : `<span class="sd-muted sd-kinds-note">among the ${fmt(items.length)} loaded so far</span>`;
    $kinds.innerHTML = `<span class="sd-filter-label">Kind</span>${chip("", "All")}${chips}${note}`;
    applyKind();
  }
  $kinds.addEventListener("click", (e) => {
    const b = e.target.closest(".sd-kind");
    if (!b) return;
    kindSel = b.dataset.kind;
    $kinds.querySelectorAll(".sd-kind").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.kind === kindSel)));
    applyKind();
  });

  // ── All citations, by author and then by work ─────────────────
  // Rows arrive fifty at a time; each lands in its author's fold and its work's fold, so a work that
  // cites the verse on thirty pages is one row with its count, open on a click, never a new page.
  function resetGroups() {
    groups = new Map();
    companionCounts = new Map();
    $rows.innerHTML = "";
  }
  function addGrouped(r) {
    const aKey = r.a || "Author not recorded";
    let g = groups.get(aKey);
    if (!g) {
      const el = document.createElement("details");
      el.className = "sd-group";
      if (!groups.size) el.open = true;
      el.innerHTML = `<summary><span class="sd-group-name">${esc(aKey)}</span> <span class="sd-muted" data-sd-group-n></span></summary><div class="sd-group-body"></div>`;
      $rows.appendChild(el);
      g = { el, works: new Map(), n: 0 };
      groups.set(aKey, g);
    }
    let w = g.works.get(r.w);
    if (!w) {
      const el = document.createElement("details");
      el.className = "sd-work";
      el.innerHTML = `<summary><span class="sd-source-title">${esc(r.t || r.w)}</span> <span class="sd-muted" data-sd-work-n></span></summary><ol class="sd-sources"></ol>`;
      g.el.querySelector(".sd-group-body").appendChild(el);
      w = { el, n: 0 };
      g.works.set(r.w, w);
    }
    w.el.querySelector("ol").appendChild(S.sourceItem(r, ctx));
    w.n += 1;
    g.n += 1;
    w.el.querySelector("[data-sd-work-n]").textContent = plural(w.n, "page", "pages");
    g.el.querySelector("[data-sd-group-n]").textContent = `${plural(g.works.size, "work", "works")} · ${plural(g.n, "citation", "citations")}`;
    if (g.works.size === 1 && !g.el.querySelector(".sd-work[open]")) w.el.open = true;
    (r.vv || []).forEach((n) => { if (Number(n) !== Number(v)) companionCounts.set(Number(n), (companionCounts.get(Number(n)) || 0) + 1); });
  }
  // Similar Scripture use: the verses of this chapter the loaded pages cite beside this one.
  function updateCompanions() {
    const $c = $root.querySelector("[data-sd-companions]");
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
