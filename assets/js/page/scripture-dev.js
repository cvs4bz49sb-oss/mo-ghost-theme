/*
 * /the-faith-received/scripture/ — the chapter reader with a verse sidebar.
 *
 * The chapter is typeset exactly as the old /bible/ page set it (the
 * .bible-* rules still ship in screen.css), and every verse is a
 * button. Clicking one opens the sidebar: the verse's address, a link
 * to its Verse Desk, how many times the library cites it, filters by
 * tradition, author and century, a search over its citations, and the
 * five works that cite it most, each previewable in place.
 *
 * Three tabs above the controls choose the division of the Bible, and
 * the Book select holds that division's books. The Apocrypha is one of
 * them and carries every feature the canon does: chapter navigation,
 * the citation panel with its filters, search, top works and previews,
 * the commentaries, the Verse Desk and the addresses. Its text is the
 * one thing that differs, because mo-bible has no deuterocanon.
 *
 * Address: ?ref=john.3 or ?ref=john.3.16 (&t=NIV). A verse in the
 * address opens with the sidebar showing it, so a Verse Desk's "Back to
 * the chapter" lands where the reader left.
 *
 * Wide screens: the sidebar is a column beside the text that scrolls on
 * its own (the recorded sidebar exception). Below 900px there is no room
 * for a column, so the same panel is moved into the text directly after
 * the block holding the verse, and the page scrolls (Ian, 2026-09-22:
 * "Expand under the verse").
 */
(function () {
  "use strict";
  const S = window.MOScriptureDev;
  if (!S) return;
  const { esc, fmt, plural } = S;

  const $root = document.querySelector("[data-sd-reader]");
  if (!$root) return;
  const $tabs = Array.prototype.slice.call($root.querySelectorAll("[data-sd-tab]"));
  const $bookPanel = $root.querySelector("[data-sd-book-panel]");
  const $book = $root.querySelector("[data-sd-book]");
  const $chapter = $root.querySelector("[data-sd-chapter]");
  const $transControl = $root.querySelector("[data-sd-translation-control]");
  const $fixedText = $root.querySelector("[data-sd-fixed-text]");
  const $fixedTextName = $root.querySelector("[data-sd-fixed-text-name]");
  const $trans = $root.querySelector("[data-sd-translation]");
  const $prev = $root.querySelector("[data-sd-prev]");
  const $next = $root.querySelector("[data-sd-next]");
  const $commToggle = $root.querySelector("[data-sd-comm-toggle]");
  const $commCount = $root.querySelector("[data-sd-comm-count]");
  const $commPanel = $root.querySelector("[data-sd-comm-panel]");
  const $layout = $root.querySelector("[data-sd-layout]");
  const $text = $root.querySelector("[data-sd-text]");
  const $side = $root.querySelector("[data-sd-side]");
  const $attr = $root.querySelector("[data-sd-attribution]");

  const narrow = window.matchMedia("(max-width: 899px)");

  // The sidebar sticks under the bar, whose height changes as it wraps.
  const $bar = $root.querySelector(".sd-bar");
  // The site header is fixed over the page; sticky things park under it
  // (the CSS drops the offset while header-behaviors.js has it hidden).
  const $header = document.querySelector(".site-header");
  const measureBar = () => {
    $root.style.setProperty("--sd-bar-h", `${Math.ceil($bar.getBoundingClientRect().height)}px`);
    const fixed = $header && getComputedStyle($header).position === "fixed";
    $root.style.setProperty("--sd-nav-h", fixed ? `${$header.offsetHeight}px` : "0px");
  };
  if ($bar) {
    measureBar();
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(measureBar);
      ro.observe($bar);
      if ($header) ro.observe($header);
    }
  }
  const state = { book: null, c: 0, v: 0, t: S.recalledTranslation() };
  let loadRun = 0;
  let hinted = false;
  let comm = null;

  // ── Controls ──────────────────────────────────────────────────
  // Just the abbreviation (Ian, 2026-09-23); the full name is the
  // option's title.
  $trans.innerHTML = S.TRANSLATIONS.map((t) => `<option value="${t[0]}" title="${esc(t[2])}">${esc(t[1])}</option>`).join("");
  function fillChapters(book) {
    let h = "";
    for (let n = 1; n <= book.chapters; n++) h += `<option value="${n}">${n}</option>`;
    $chapter.innerHTML = h;
  }

  // ── The three divisions ───────────────────────────────────────
  // The tabs choose a division; the Book select holds that division's
  // books and nothing else. Painting the select is the whole of what a
  // tab does to the page besides loading a chapter, so the two are one
  // function and can never drift apart.
  let section = "";
  function fillBooks(k) {
    if (section === k) return;
    section = k;
    const div = S.SECTIONS.find((s) => s.k === k) || S.SECTIONS[0];
    $book.innerHTML = div.books.map((b) => `<option value="${b.slug}">${esc(b.name)}</option>`).join("");
    $tabs.forEach((t) => {
      const on = t.dataset.sdTab === k;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
      if (on && $bookPanel) $bookPanel.setAttribute("aria-labelledby", t.id);
    });
  }

  /* Activation is on click and on Enter or Space, which a <button>
   * already gives us, and never on an arrow key: choosing a division
   * loads a chapter, and arrows that loaded would fire a chapter fetch
   * per keypress. Arrows move focus only, the manual-activation tab
   * pattern. Every tab stays in the natural tab order, so a reader who
   * never presses an arrow can still reach all three. */
  $tabs.forEach(($t) => {
    $t.addEventListener("click", () => {
      const k = $t.dataset.sdTab;
      if (state.book && state.book.section === k) return;
      const div = S.SECTIONS.find((s) => s.k === k);
      if (div && div.books.length) load(div.books[0], 1, 0, true);
    });
  });
  const TAB_DELTA = { ArrowRight: 1, ArrowLeft: -1 };
  $tabs.forEach(($t, i) => {
    $t.addEventListener("keydown", (e) => {
      let next = -1;
      if (Object.prototype.hasOwnProperty.call(TAB_DELTA, e.key)) next = (i + TAB_DELTA[e.key] + $tabs.length) % $tabs.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = $tabs.length - 1;
      if (next < 0) return;
      e.preventDefault();
      $tabs[next].focus();
    });
  });

  // ── The chapter ───────────────────────────────────────────────
  function load(book, c, v, push) {
    const my = ++loadRun;
    const changedChapter = !state.book || state.book !== book || state.c !== c;
    state.book = book; state.c = c; state.v = v || 0;
    fillBooks(book.section);
    $book.value = book.slug;
    fillChapters(book);
    $chapter.value = String(c);
    $trans.value = state.t;
    // The deuterocanon has one text, so the picker is replaced by its
    // name. Nothing is disabled: the control the page cannot honour is
    // not shown at all.
    if ($transControl) $transControl.hidden = Boolean(book.ap);
    if ($fixedText) $fixedText.hidden = !book.ap;
    if ($fixedTextName && book.ap) $fixedTextName.textContent = S.APOCRYPHA_TEXT;
    const chain = S.chainOf(book);
    const at = chain.indexOf(book);
    $prev.disabled = at === 0 && c === 1;
    $next.disabled = at === chain.length - 1 && c === book.chapters;
    writeUrl(push);
    document.title = `${S.refLabel(book, c)} | Scripture | The Faith Received | Mere Orthodoxy`;

    // closePanel() clears state.v, so the verse asked for is held here
    // and reopened once the chapter has arrived.
    const wantVerse = state.v;
    // Same chapter, new translation: keep the open panel and whatever
    // the reader had filtered or typed. Read before the text is replaced,
    // because on a phone the panel lives inside the text.
    const keepPanel = !changedChapter && Boolean(wantVerse) && $panel.isConnected;
    if (changedChapter) closePanel(true);
    $text.innerHTML = `<p class="bible-status" role="status">Loading ${esc(S.refLabel(book, c))}…</p>`;
    // Where the text on screen comes from, and on an apocryphal book the
    // one line saying why the translations above are not offered.
    $attr.textContent = book.ap
      ? `${S.APOCRYPHA_TEXT}, from the library's own index. The five translations this reader offers do not carry the deuterocanon.`
      : `${S.textName(book, state.t)} (${S.textShort(book, state.t)}), served through bolls.life.`;

    if (changedChapter || !comm) loadCommentaries();

    return S.chapterNode(state.t, book, c).then((node) => {
      if (my !== loadRun) return;
      $text.innerHTML =
        `<header class="bible-chapter-header">` +
          `<h2 class="sd-chapter-h1"><span class="bible-chapter-eyebrow">${esc(book.name)}</span> ` +
          `<span class="bible-chapter-heading">Chapter ${c}</span></h2>` +
        `</header>` +
        `<p class="sd-hint sd-muted"${hinted ? " hidden" : ""}>Select any verse to see where the library cites it.</p>` +
        `<div class="bible-chapter-content sd-chapter-content"></div>`;
      const $host = $text.querySelector(".sd-chapter-content");
      while (node.firstChild) $host.appendChild(node.firstChild);
      if (wantVerse) openVerse(wantVerse, { scroll: true, keep: keepPanel });
      else showOverview();
    }).catch(() => {
      if (my !== loadRun) return;
      $text.innerHTML = book.ap
        ? `<p class="bible-status is-error" role="alert">${esc(S.refLabel(book, c))} could not be loaded. Reload the page to try again.</p>`
        : `<p class="bible-status is-error" role="alert">${esc(S.refLabel(book, c))} could not be loaded in the ${esc(S.textShort(book, state.t))}. Try another translation or reload the page.</p>`;
    });
  }

  function writeUrl(push) {
    const url = S.readerHref(state.book, state.c, state.v, state.t === "ESV" ? "" : state.t);
    if (location.pathname + location.search === url) return;
    history[push ? "pushState" : "replaceState"](null, "", url);
  }

  // The arrows walk the book's own chain: Genesis to Revelation as one
  // run, the apocrypha as its own. See chainOf in the core.
  function step(delta) {
    let b = state.book;
    const chain = S.chainOf(b);
    const at = chain.indexOf(b);
    let n = state.c + delta;
    if (n < 1) { b = chain[at - 1]; if (!b) return; n = b.chapters; }
    else if (n > b.chapters) { b = chain[at + 1]; if (!b) return; n = 1; }
    load(b, n, 0, true);
  }

  // ── Commentaries dropdown ─────────────────────────────────────
  // The chapter commentaries and the whole-Bible commentaries, closed and
  // previewable, as in the verse panel (corpus owner, 2026-09-25). With a
  // verse open, a preview looks for the commentary's comment on it.
  function loadCommentaries() {
    $commCount.textContent = "";
    const { book, c } = state;
    const ctx = { book, c, get v() { return state.book === book && state.c === c ? state.v : 0; } };
    comm = S.commentaryFolds($commPanel.querySelector("[data-sd-comm-host]"), ctx, (n) => {
      $commCount.textContent = n ? `(${fmt(n)})` : "";
    });
  }
  $commToggle.addEventListener("click", () => {
    const open = $commToggle.getAttribute("aria-expanded") !== "true";
    $commToggle.setAttribute("aria-expanded", String(open));
    $commPanel.hidden = !open;
  });

  // ── The chapter overview ──────────────────────────────────────
  // Ian, 2026-09-23: "use the whole width". With no verse open, the
  // right of a wide page was empty. The sidebar now holds the chapter as
  // the library sees it: how often it is cited, how many of its verses
  // are, and the most-cited verses, each a way into its verse. Opening a
  // verse swaps this for the verse panel; closing the panel brings it
  // back. On a phone there is no sidebar, so there is no overview.
  const $ov = document.createElement("section");
  $ov.className = "sd-overview";
  $ov.setAttribute("aria-label", "This chapter in the library");
  let ovRun = 0;

  function hideOverview() {
    ovRun++;
    $ov.remove();
  }

  function showOverview() {
    if (narrow.matches || state.v || !state.book) return;
    const { book, c } = state;
    const my = ++ovRun;
    const head =
      `<header class="sd-panel-head">` +
        `<p class="sd-eyebrow">This chapter in the library</p>` +
        `<h2 class="sd-panel-ref">${esc(S.refLabel(book, c))}</h2>` +
      `</header>`;
    $ov.innerHTML = `${head}<p class="sd-muted">Counting citations…</p>`;
    if (!$ov.isConnected) $side.appendChild($ov);
    $side.hidden = false;
    $layout.classList.add("has-side");
    S.api("/v1/verse/chapter", { b: book.lib, c }).then((d) => {
      if (my !== ovRun || state.book !== book || state.c !== c) return;
      const verses = (d && d.verses) || {};
      const counts = Object.keys(verses).map(Number).filter((n) => n > 0)
        .map((v) => [v, Number(verses[v]) || 0]);
      const cited = counts.filter((x) => x[1] > 0);
      const whole = Number(d && d.ch_n) || 0;
      const total = counts.reduce((a, x) => a + x[1], 0) + whole;
      if (!total) {
        $ov.innerHTML = `${head}<p class="sd-muted">Nothing in the library cites this chapter yet.</p>`;
        return;
      }
      const top = cited.slice().sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 8);
      const max = top.length ? top[0][1] : 1;
      const snip = (v) => {
        const t = S.verseTextFrom($text, v);
        return t.length > 90 ? `${t.slice(0, 88).replace(/\s+\S*$/, "")}…` : t;
      };
      const wholeLine = whole
        ? `<p class="sd-muted sd-ov-whole">${esc(plural(whole, "citation", "citations"))} of the chapter as a whole.</p>`
        : "";
      const rows = top.map(([v, n]) =>
        `<li><button type="button" class="sd-ov-verse" data-v="${v}" data-w="${Math.max(3, Math.round((n / max) * 100))}">` +
          `<span class="sd-ov-ref">${esc(S.refLabel(book, c, v))}</span>` +
          `<span class="sd-ov-meter" aria-hidden="true"><i></i></span>` +
          `<span class="sd-ov-n">${fmt(n)}</span>` +
          `<span class="sd-ov-snip">${esc(snip(v))}</span>` +
        `</button></li>`).join("");
      $ov.innerHTML = `${head}<div class="sd-ov-stats">` +
          `<div class="sd-ov-stat"><b>${fmt(total)}</b><span>${total === 1 ? "citation" : "citations"}</span></div>` +
          `<div class="sd-ov-stat"><b>${fmt(cited.length)} of ${fmt(counts.length)}</b><span>verses cited</span></div>` +
        `</div>${wholeLine}` +
        `<h3 class="sd-h3">Most-cited verses</h3>` +
        `<ol class="sd-ov-top">${rows}</ol>` +
        `<p class="sd-muted sd-ov-hint">Select any verse in the text to see who cites it.</p>`;
      $ov.querySelectorAll(".sd-ov-verse").forEach((b) => {
        const bar = b.querySelector(".sd-ov-meter i");
        if (bar) bar.style.width = `${b.dataset.w}%`;
      });
    }).catch(() => {
      if (my !== ovRun) return;
      $ov.innerHTML = `${head}<p class="sd-muted">The library's citations for this chapter did not load.</p>`;
    });
  }

  $ov.addEventListener("click", (e) => {
    const b = e.target.closest(".sd-ov-verse");
    if (b) openVerse(Number(b.dataset.v), { scroll: true, focus: true });
  });

  // ── The verse panel ───────────────────────────────────────────
  const $panel = document.createElement("section");
  $panel.className = "sd-panel";
  let panelRun = 0;
  let panelCommRun = 0;
  let bar = null;
  let rowsOffset = 0;
  const panelFoldMq = window.matchMedia("(max-width: 640px)");
  /* The corpus owner's two commentary lists, in his order (2026-09-25: "display first the chapter
   * commentaries + whole bible commentaries and the specific citations … and then similarity"): the
   * works on this book that cover the chapter, then the whole-Bible sets (the worker marks them
   * `annotation`; they had been filed under "whole book"), then the verse's citations, then similarity.
   * All four start closed (corpus owner, 2026-09-25: "make this collapsible"; open, Matthew 1's 57 and
   * 21 commentaries made the panel about 6,000 pixels tall). A fold the reader opens stays open. */
  const PANEL_FOLDS = {
    chapter: { key: "chapter", title: "Chapter commentaries", wideOpen: false },
    wholeBible: { key: "whole_bible", title: "Whole-Bible commentaries", wideOpen: false },
    citations: { key: "citations", title: "Citations of this verse", wideOpen: false },
    similar: { key: "similar", title: "Similar passages", wideOpen: false },
  };

  function panelDefaultOpen(section) {
    return !panelFoldMq.matches && Boolean(section.wideOpen);
  }

  function recalledPanelOpen(section) {
    const fallback = panelDefaultOpen(section);
    try {
      const v = window.localStorage.getItem(`sd_panel_fold_${section.key}`);
      if (v === "1") return true;
      if (v === "0") return false;
      return fallback;
    } catch (e) {
      return fallback;
    }
  }

  function rememberPanelOpen(section, open) {
    try { window.localStorage.setItem(`sd_panel_fold_${section.key}`, open ? "1" : "0"); } catch (e) { /* not remembered */ }
  }

  function panelSummary(section, count) {
    const n = Number(count);
    const suffix = Number.isFinite(n) && n >= 0 ? ` <span data-sd-summary-count>(${fmt(n)})</span>` : ` <span data-sd-summary-count></span>`;
    return `${esc(section.title)}${suffix}`;
  }

  function panelDetails(section, body, count) {
    return `<details class="sd-panel-fold" data-sd-panel-section="${esc(section.key)}"${recalledPanelOpen(section) ? " open" : ""}><summary>${panelSummary(section, count)}</summary><div class="sd-panel-fold-body">${body}</div></details>`;
  }

  function bindPanelFolds() {
    $panel.querySelectorAll("[data-sd-panel-section]").forEach((el) => {
      if (el.dataset.sdPanelBound) return;
      const section = Object.values(PANEL_FOLDS).find((s) => s.key === el.dataset.sdPanelSection);
      if (!section) return;
      el.dataset.sdPanelBound = "1";
      /* Remember only what the reader chose. A fold inserted open fires `toggle` as well, so the
       * old keys (sd_panel_open_*) stored every wide-screen default as a choice: a fresh visit to
       * Matthew 1:2 saved chapter=1 and whole_bible=1 without a click. Those keys are left unread;
       * a click on the summary (Enter and Space on it click too) marks the toggle that follows. */
      const $summary = el.querySelector(":scope > summary");
      if ($summary) $summary.addEventListener("click", () => { el.dataset.sdChosen = "1"; });
      el.addEventListener("toggle", () => {
        if (el.dataset.sdChosen !== "1") return;
        delete el.dataset.sdChosen;
        rememberPanelOpen(section, el.open);
      });
    });
  }

  function placePanel(v) {
    if (narrow.matches) {
      // bolls sends a whole prose chapter as one <p> (and Psalm 23 as
      // one <p> too), so "after the paragraph" was the end of the
      // chapter. Straight after the verse's own last span instead.
      const spans = $text.querySelectorAll(`.bible-verse[data-v="${v}"]`);
      if (spans.length) spans[spans.length - 1].after($panel);
      hideOverview();
      $side.hidden = true;
      $side.style.marginTop = "";
      $layout.classList.remove("has-side");
    } else {
      hideOverview();
      $side.appendChild($panel);
      $side.hidden = false;
      $layout.classList.add("has-side");
      alignSide(v);
    }
  }

  /* The sidebar does not stick (Ian, 2026-09-23: "the side panel doesn't
     need to be sticky. It can stay where it is."), so a verse far down
     the chapter would open its panel at the top of the column, out of
     sight, and the click would look like it did nothing. The panel is
     pushed down to start level with the verse instead: it still stays
     where it is as the page scrolls. The overview goes back to the top. */
  function alignSide(v) {
    $side.style.marginTop = "";
    const span = v && $text.querySelector(`.bible-verse[data-v="${v}"]`);
    if (!span) return;
    const room = $text.getBoundingClientRect().bottom - $side.getBoundingClientRect().top - 240;
    const drop = span.getBoundingClientRect().top - $side.getBoundingClientRect().top;
    const px = Math.round(Math.min(drop, room));
    if (px > 0) $side.style.marginTop = `${px}px`;
  }

  function closePanel(silent) {
    state.v = 0;
    $text.querySelectorAll(".bible-verse.is-active").forEach((el) => el.classList.remove("is-active"));
    $panel.remove();
    $side.style.marginTop = "";
    if (!silent && !narrow.matches) {
      showOverview();
    } else if (!$ov.isConnected) {
      $side.hidden = true;
      $layout.classList.remove("has-side");
    }
    if (!silent) writeUrl(false);
  }

  function openVerse(v, opts) {
    const spans = $text.querySelectorAll(`.bible-verse[data-v="${v}"]`);
    if (!spans.length) return;
    state.v = v;
    $text.querySelectorAll(".bible-verse.is-active").forEach((el) => el.classList.remove("is-active"));
    spans.forEach((el) => el.classList.add("is-active"));
    writeUrl(false);
    if (!(opts && opts.keep)) renderPanel(v);
    placePanel(v);
    hinted = true;
    const $hint = $text.querySelector(".sd-hint");
    if ($hint) $hint.hidden = true;
    if (opts && opts.scroll) spans[0].scrollIntoView({ block: "center" });
    else if (narrow.matches) $panel.scrollIntoView({ block: "nearest", behavior: "smooth" });
    // Keyboard users land in the panel rather than behind every verse.
    if (opts && opts.focus) {
      const $ref = $panel.querySelector(".sd-panel-ref");
      if ($ref) $ref.focus({ preventScroll: true });
    }
  }

  function renderPanel(v) {
    const {book} = state;
    const {c} = state;
    const t = state.t === "ESV" ? "" : state.t;
    const citationBody = `<div data-sd-filters></div><h3 class="sd-h3">Most-cited sources</h3><ol class="sd-sources sd-top" data-sd-top></ol><div data-sd-matches hidden><h3 class="sd-h3">Matching citations</h3><ol class="sd-sources" data-sd-rows></ol><button type="button" class="sd-more" data-sd-more hidden>Show more</button></div>`;
    $panel.innerHTML = `<header class="sd-panel-head"><p class="sd-eyebrow">Verse</p><h2 class="sd-panel-ref" tabindex="-1">${esc(S.refLabel(book, c, v))}</h2><a class="sd-desk-link" href="${esc(S.deskHref(book, c, v, t))}">Open the Verse Desk</a><button type="button" class="sd-close" aria-label="Close verse panel">Close</button></header><p class="sd-count" data-sd-count role="status"><span class="sd-muted">Counting citations…</span></p><div data-sd-panel-commentaries><p class="sd-muted">Loading commentaries…</p></div>${panelDetails(PANEL_FOLDS.citations, citationBody)}${panelDetails(PANEL_FOLDS.similar, `<p class="sd-muted">Verses cited on the same pages as ${esc(S.refLabel(book, c, v))}, and passages whose wording resembles it, are on the Verse Desk.</p><p><a class="sd-desk-link" href="${esc(S.deskHref(book, c, v, t))}#sd-h-sim">Open similar passages</a></p>`)}<p class="sd-panel-foot"><a href="${esc(S.deskHref(book, c, v, t))}">Every citation of ${esc(S.refLabel(book, c, v))} on the Verse Desk</a></p>`;
    bindPanelFolds();
    $panel.querySelector(".sd-close").addEventListener("click", () => {
      const span = $text.querySelector(`.bible-verse[data-v="${v}"]`);
      closePanel();
      if (span) span.focus({ preventScroll: true });
    });
    bar = S.filterBar($panel.querySelector("[data-sd-filters]"), {
      search: true,
      searchLabel: "Search this verse's citations",
      onChange: () => query(v, false),
    });
    $panel.querySelector("[data-sd-more]").addEventListener("click", () => query(v, true));
    loadPanelCommentaries(v);
    query(v, false);
  }

  function loadPanelCommentaries(v) {
    const my = ++panelCommRun;
    const {book} = state;
    const {c} = state;
    const $host = $panel.querySelector("[data-sd-panel-commentaries]");
    if (!$host) return;
    $host.innerHTML = `<p class="sd-muted">Loading commentaries…</p>`;
    S.fetchCommentaries(book, c, S.emptyFilters()).then((d) => {
      if (my !== panelCommRun || state.v !== v || state.book !== book || state.c !== c) return;
      // Works on the book first by their chapter range, then the whole-book ones; the sets apart.
      const g = S.commentaryGroups(d && d.items);
      const list = (k) => `<ol class="sd-sources sd-panel-commentaries" data-sd-comm-list="${k}"></ol>`;
      const chunks = [];
      if (g.chapter.length) chunks.push(panelDetails(PANEL_FOLDS.chapter, list("chapter"), g.chapter.length));
      if (g.whole.length) chunks.push(panelDetails(PANEL_FOLDS.wholeBible, list("whole"), g.whole.length));
      $host.innerHTML = chunks.join("");
      // Each commentary previews in place (corpus owner, 2026-09-25); see commentaryItem in the core.
      const ctx = { book, c, v };
      [["chapter", g.chapter], ["whole", g.whole]].forEach(([k, items]) => {
        const $ol = $host.querySelector(`[data-sd-comm-list="${k}"]`);
        if ($ol) items.forEach((e) => $ol.appendChild(S.commentaryItem(e, ctx)));
      });
      bindPanelFolds();
    }).catch(() => {
      if (my !== panelCommRun || state.v !== v) return;
      $host.innerHTML = `<p class="sd-muted">Commentaries did not load.</p>`;
    });
  }

  function query(v, more) {
    // A search typed on the previous verse can fire after this one opens.
    if (v !== state.v) return;
    const my = more ? panelRun : ++panelRun;
    const {book} = state;
    const {c} = state;
    const f = bar.filters;
    if (!more) rowsOffset = 0;
    const filtered = S.activeCount(f) > 0;
    const $count = $panel.querySelector("[data-sd-count]");
    const $top = $panel.querySelector("[data-sd-top]");
    const $matches = $panel.querySelector("[data-sd-matches]");
    const $rows = $panel.querySelector("[data-sd-rows]");
    const $more = $panel.querySelector("[data-sd-more]");
    const $citationCount = $panel.querySelector('[data-sd-panel-section="citations"] [data-sd-summary-count]');
    if (!more) $top.innerHTML = `<li class="sd-muted">Loading…</li>`;
    $more.disabled = true;
    S.fetchVerse(book, c, v, f, rowsOffset, 10).then((d) => {
      if (my !== panelRun || state.v !== v) return;
      $more.disabled = false;
      if (!d || !d.total) {
        if ($citationCount) $citationCount.textContent = "(0)";
        $count.innerHTML = `The library does not cite ${esc(S.refLabel(book, c, v))} yet.`;
        $top.innerHTML = "";
        $panel.querySelectorAll(".sd-h3, [data-sd-filters]").forEach((el) => { el.hidden = true; });
        return;
      }
      if ($citationCount) $citationCount.textContent = `(${fmt(d.total)})`;
      bar.update(d.facets);
      $count.innerHTML = filtered
        ? `<strong>${fmt(d.matched)}</strong> of ${plural(d.total, "citation", "citations")} match`
        : `<strong>${fmt(d.total)}</strong> ${d.total === 1 ? "citation" : "citations"} in the library`;
      const ctx = { book, c, v };
      if (!more) {
        $top.innerHTML = "";
        (d.top_works || []).forEach((w) => {
          // A work's kinds, when all its citations fit one response; the same rows give its Preview.
          const all = S.workRows(ctx, { ...f }, w);
          $top.appendChild(S.sourceItem(w, ctx, all ? {
            count: w.n,
            pickRow: () => all().then((x) => x.rows[0] || null),
            kinds: () => all().then((x) => (x.rows.length === x.matched ? S.kindsLabel(x.rows) : "")),
          } : { count: w.n, pickRow: () => firstRowOf(w.w, v) }));
        });
        if (!(d.top_works || []).length) $top.innerHTML = `<li class="sd-muted">Nothing matches these filters.</li>`;
        $rows.innerHTML = "";
      }
      $matches.hidden = !filtered;
      if (filtered) {
        (d.rows || []).forEach((r) => $rows.appendChild(S.sourceItem(r, ctx)));
        rowsOffset = d.next_offset || 0;
        $more.hidden = !d.next_offset;
      }
    }).catch(() => {
      if (my !== panelRun) return;
      $more.disabled = false;
      $count.innerHTML = `<span class="sd-muted">Citations did not load.</span> <button type="button" class="sd-clear" data-sd-retry>Try again</button>`;
      $count.querySelector("[data-sd-retry]").addEventListener("click", () => query(v, false));
      $top.innerHTML = "";
    });
  }

  // A top work is an aggregate; previewing it means previewing one real
  // citation from it. Ask the worker for that work's first row under the
  // current filters, which is the builder's best-ranked one.
  function firstRowOf(w, v) {
    const f = bar ? bar.filters : S.emptyFilters();
    return S.fetchVerse(state.book, state.c, v, { ...f, w }, 0, 1)
      .then((d) => ((d && d.rows) || [])[0] || null)
      .catch(() => null);
  }

  // ── Events ────────────────────────────────────────────────────
  $text.addEventListener("click", (e) => {
    if (e.target.closest(".sd-panel")) return;
    const span = e.target.closest(".bible-verse");
    if (!span) return;
    const v = parseInt(span.dataset.v, 10);
    if (state.v === v && $panel.isConnected) { closePanel(); return; }
    openVerse(v);
  });
  $text.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const span = e.target.closest && e.target.closest(".bible-verse");
    if (!span || e.target.closest(".sd-panel")) return;
    e.preventDefault();
    openVerse(parseInt(span.dataset.v, 10), { focus: true });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !$panel.isConnected) return;
    if (e.target.closest && e.target.closest("input, select, textarea")) return;
    const span = $text.querySelector(`.bible-verse[data-v="${state.v}"]`);
    closePanel();
    if (span) span.focus({ preventScroll: true });
  });
  narrow.addEventListener("change", () => {
    if ($panel.isConnected && state.v) { placePanel(state.v); return; }
    if (narrow.matches) {
      hideOverview();
      $side.hidden = true;
      $layout.classList.remove("has-side");
    } else {
      showOverview();
    }
  });

  $book.addEventListener("change", () => load(S.BOOK_BY_SLUG.get($book.value), 1, 0, true));
  $chapter.addEventListener("change", () => load(state.book, parseInt($chapter.value, 10), 0, true));
  $trans.addEventListener("change", () => {
    state.t = $trans.value;
    S.rememberTranslation(state.t);
    load(state.book, state.c, state.v, false);
  });
  $prev.addEventListener("click", () => step(-1));
  $next.addEventListener("click", () => step(1));
  window.addEventListener("popstate", () => {
    const qs = new URLSearchParams(location.search);
    const r = S.parseRef(qs.get("ref"));
    const t = qs.get("t");
    state.t = t && S.translationInfo(t) ? t : "ESV";
    if (r) load(r.book, r.c, r.v, false);
  });

  const start = S.parseRef(new URLSearchParams(location.search).get("ref")) || S.legacyRef();
  load(start ? start.book : S.BOOK_BY_SLUG.get("genesis"), start ? start.c : 1, start ? start.v : 0, false);
})();
