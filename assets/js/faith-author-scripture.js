/*
 * The scripture fingerprint, on an author page.
 *
 * What a writer quoted is the nearest thing a library has to a
 * portrait of how they read. The shelf below already says what they
 * wrote; this says which books they lived in — Augustine at 19,823
 * citations of the Psalms, Bernard's Song of Songs, Rupert on Genesis.
 *
 * The whole panel is one small file, built by
 * scripts/build-author-scripture.mjs and keyed on the same folded name
 * the page already has in its URL, so this costs one fetch and no
 * work. An author the index has never read gets nothing at all: an
 * empty chart is a claim that they cited nothing, which is false.
 *
 * The headings and notes name nobody's sex. This shelf is mostly men
 * and it is not only men — Hildegard of Bingen is in the index at
 * 1,335 citations across nine works — and "Books he cites" over her
 * chart is simply wrong.
 *
 * Two counts sit here and they are different counts, so they are
 * labelled differently and never added together:
 *
 *   the books are OCCURRENCES. 19,823 times.
 *   the verses are WORKS. In 76 of the works, not 76 times.
 *
 * Nothing here is decorative. Every verse is a button that runs the
 * search panel below on that reference, so "Romans 5:5, in 89 works"
 * is one tap from the 89 works with the lines in front of you. That is
 * the whole reason to draw the chart on this page rather than as a
 * chart somewhere else.
 */
(function () {
  "use strict";

  const LIBRARY = (document.querySelector('meta[name="tfr-library-base"]') || {}).content
    || "https://mo-tfr-library.mo-podcast-feed.workers.dev";
  const INDEX = `${LIBRARY}/v1/index`;

  // Shown before the control offers the rest. Eight bars is a shape a
  // reader takes in at a glance; twenty is a table.
  const BOOKS_SHOWN = 8;
  const VERSES_SHOWN = 12;

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // The index keys books in lower case; a reader reads them in title
  // case, and the ordinal stays a numeral. "of" stays lower, because
  // the book is the Song of Solomon and not the Song Of Solomon.
  const LOWER = new Set(["of", "the"]);
  function title(book) {
    return String(book || "").split(" ").map((w, i) =>
      (i && LOWER.has(w) ? w : w.replace(/^[a-z]/, (c) => c.toUpperCase()))
    ).join(" ");
  }

  const n = (x) => Number(x || 0).toLocaleString();

  /* ── The sentence ────────────────────────────────────────────────
     Said in prose before it is drawn, because the number a reader
     repeats afterwards is "he quotes the Psalms more than anyone in
     Migne", not a bar. */

  function lede(d) {
    const bits = [];
    const name = escapeHtml(d.name);
    const cites = `<b>${n(d.citations)}</b> citation${d.citations === 1 ? "" : "s"} of scripture`;
    if (d.works && d.worksCiting && d.works !== d.worksCiting) {
      bits.push(`${name} carries ${cites}, across ${n(d.worksCiting)} of the ${n(d.works)} works the library holds under the name.`);
    } else {
      bits.push(`${name} carries ${cites} across ${n(d.worksCiting)} work${d.worksCiting === 1 ? "" : "s"}.`);
    }
    if (d.rank && d.of && d.rank <= 25) {
      // Coerced before it is drawn. The `<= 25` guard above already
      // forces a numeric comparison, so a string carrying markup can
      // never reach here — but that is an accident of the guard and
      // not a property of the interpolation, and the guard is one edit
      // away from being loosened.
      bits.push(`That is the ${ordinal(Number(d.rank))} heaviest of the ${n(d.of)} authors the index has read.`);
    }
    if (d.dubia && d.dubia.citations) {
      bits.push(`A further ${n(d.dubia.citations)} sit in ${n(d.dubia.works)} work${
        d.dubia.works === 1 ? "" : "s"} the catalogue files as doubtfully theirs, counted here and nowhere in the figures below.`);
    }
    // A bucket, not a person. 1,466 works sit under "Unknown author",
    // and the figures below are a true description of that bucket and
    // not a portrait of how one man read. Said rather than suppressed:
    // what the anonymous half of Migne quotes is worth knowing, and it
    // is only misleading if the page lets it pass for a life.
    if (d.collective) {
      bits.push(`These are works the catalogue could not assign to one hand, `
        + `so this describes what the collection cites and not how a single writer read.`);
    }
    return bits.join(" ");
  }

  function ordinal(i) {
    const t = i % 100;
    if (t >= 11 && t <= 13) return `${i}th`;
    return `${i}${({ 1: "st", 2: "nd", 3: "rd" })[i % 10] || "th"}`;
  }

  /* ── The books ──────────────────────────────────────────────────
     Bars against the author's own top book rather than against a
     library-wide maximum: the question is what he read most, not how
     he compares with Augustine, and scaling to Augustine flattens
     every other author on the site into one indistinguishable row. */

  function booksList(d) {
    const rows = d.books || [];
    if (!rows.length) return "";
    const max = rows[0][1] || 1;
    const items = rows.map(([book, count], i) => {
      const pct = Math.max(1.5, (count / max) * 100);
      return `<li class="fa-fp-book${i >= BOOKS_SHOWN ? " fa-fp-rest" : ""}"${
        i >= BOOKS_SHOWN ? " hidden" : ""}>` +
        `<span class="fa-fp-book-name">${escapeHtml(title(book))}</span>` +
        `<span class="fa-fp-bar"><span class="fa-fp-bar-fill" style="width:${pct.toFixed(1)}%"></span></span>` +
        // The unit is carried on the figure itself, because a screen
        // reader reads this column as "Psalms, 19,823" and the two
        // columns of this panel count different things.
        `<span class="fa-fp-book-n">${n(count)}` +
        `<span class="visually-hidden"> citation${count === 1 ? "" : "s"}</span></span></li>`;
    }).join("");
    const hidden = rows.length - BOOKS_SHOWN;
    const more = hidden > 0
      ? `<button type="button" class="fa-fp-more" data-fp-more="book">` +
        `Show ${n(hidden)} more book${hidden === 1 ? "" : "s"}</button>`
      : "";
    const all = d.booksTotal && d.booksTotal > rows.length
      ? `<p class="fa-fp-foot">Of ${n(d.booksTotal)} books cited in all.</p>` : "";
    // Said here as well as in the lede, and set beside the note in the
    // other column, because the two figures on this row of the page are
    // not the same unit: a book is counted in times, a verse in works.
    // Without this the reader has "Psalms 19,823" and "Romans 5:5, 89"
    // side by side and nothing telling them they are different kinds of
    // number. It also squares the tops of the two lists.
    return `<div class="fa-fp-col">` +
      `<h3 class="fa-fp-sub">Books most cited</h3>` +
      `<p class="fa-fp-note">The figure is how many times the book is cited, ` +
      `counted across everything the library holds under the name.</p>` +
      `<ol class="fa-fp-books">${items}</ol>${more}${all}</div>`;
  }

  /* ── The verses ─────────────────────────────────────────────────
     Buttons, not links. A link would take the reader off the page to
     a chapter listing; the button drives the search panel already on
     this page, which answers the same question against this author's
     own shelf and leaves the reader where they were. */

  function versesList(d, canSearch) {
    const rows = d.verses || [];
    if (!rows.length) return "";
    const items = rows.map(([book, ch, v, works], i) => {
      const ref = `${title(book)} ${ch}:${v}`;
      const inner = `<span class="fa-fp-verse-ref">${escapeHtml(ref)}</span>` +
        `<span class="fa-fp-verse-n">${n(works)}` +
        `<span class="visually-hidden"> work${works === 1 ? "" : "s"}</span></span>`;
      // The accessible name says the unit and says what pressing does,
      // because the button reads otherwise as "Romans 5:5, 89" and
      // eighty-nine of nothing is not a fact.
      const control = canSearch
        ? `<button type="button" class="fa-fp-verse" data-fp-ref="${escapeHtml(ref)}"` +
          ` aria-label="Search this author for ${escapeHtml(ref)}, cited in ${n(works)} of the works">` +
          `${inner}</button>`
        : `<span class="fa-fp-verse-static">${inner}</span>`;
      return `<li${i >= VERSES_SHOWN ? ` class="fa-fp-rest" hidden` : ""}>${control}</li>`;
    }).join("");
    const hidden = rows.length - VERSES_SHOWN;
    const more = hidden > 0
      ? `<button type="button" class="fa-fp-more" data-fp-more="verse">` +
        `Show ${n(hidden)} more verse${hidden === 1 ? "" : "s"}</button>`
      : "";
    return `<div class="fa-fp-col">` +
      `<h3 class="fa-fp-sub">Verses returned to</h3>` +
      `<p class="fa-fp-note">The figure is how many of the works cite the verse, not how many times it is cited.${
        canSearch ? " Choose one to search this author's shelf for it, in the panel below." : ""
      }</p>` +
      `<ul class="fa-fp-verses">${items}</ul>${more}</div>`;
  }

  /* ── Where the figures come from ────────────────────────────────
     The index has read two of the library's eight collections. An
     author who is also in Early English Books is being described from
     part of his shelf, and the panel says which part rather than
     letting the reader assume it counted everything. */

  const CORPUS_LABEL = {
    pld: "Patrologia Latina",
    augustine: "the Augustine collection",
    tfr: "the Latin Library",
    eebo: "Early English Books",
  };

  function provenance(d, shelfTotal) {
    const from = (d.corpora || []).map(([c]) => CORPUS_LABEL[c] || c);
    if (!from.length) return "";
    const list = from.length === 1
      ? from[0]
      : `${from.slice(0, -1).join(", ")} and ${from[from.length - 1]}`;
    const rest = shelfTotal - d.works;
    const partial = shelfTotal && d.works && rest > 0
      ? ` The other ${n(rest)} work${rest === 1 ? " on this page sits" : "s on this page sit"} in collections the index has not read yet.`
      : "";
    return `<p class="fa-fp-source">Counted from ${escapeHtml(list)}.${partial}</p>`;
  }

  /* ── Mount ──────────────────────────────────────────────────────── */

  // Fetching and drawing are separate so the page can start the fetch
  // alongside the catalogue loads and draw the panel in the first
  // paint. Fetching inside mount meant one extra round trip after the
  // page had already painted, and the panel then inserted itself
  // between the life and the search box and pushed some six hundred
  // pixels of shelf down under a reader mid-sentence. This costs
  // nothing: the file is a couple of kilobytes and the corpus
  // catalogues it waits beside are megabytes.
  // The price of waiting beside the catalogues rather than after them:
  // this promise is now one of the four the whole page waits on, so a
  // request that hangs rather than fails holds the name, the life and
  // the shelves at "Loading…" for as long as the browser will wait.
  // `fetch` has no timeout of its own. The panel is the part of this
  // page that can be missing, so it is the part that gives up: six
  // seconds, then the page draws without it.
  const PATIENCE = 6000;

  function load(key) {
    if (!key) return Promise.resolve(null);
    return Promise.race([
      fetch(`${INDEX}/author-scripture/${encodeURIComponent(key)}.json`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      new Promise((resolve) => { setTimeout(() => resolve(null), PATIENCE); }),
    ]);
  }

  function mount(d, root, shelfTotal) {
    // No entry, or an entry with nothing in it, draws nothing. Silence
    // is the honest answer for an author the index has never opened;
    // an empty chart would be a claim that they cited nothing.
    if (!d || !root || !d.citations || !(d.books || []).length) return;
    draw(d, root, shelfTotal);
  }

  function draw(d, root, shelfTotal) {
    // Whether the search panel below actually mounted. It does not when
    // the shelf is empty, and its exported `find` is a wrapper that
    // exists either way — so without asking, the verses would render as
    // buttons that swallow the press and show nothing at all.
    const canSearch = !!(window.MOAuthorSearch
      && window.MOAuthorSearch.ready && window.MOAuthorSearch.ready());

    const panel = document.createElement("section");
    panel.className = "fa-fp";
    panel.setAttribute("aria-labelledby", "fa-fp-head");
    panel.innerHTML =
      `<h2 class="fa-fp-head" id="fa-fp-head">Scripture fingerprint</h2>` +
      `<p class="fa-fp-lede">${lede(d)}</p>` +
      `<div class="fa-fp-cols">${booksList(d)}${versesList(d, canSearch)}</div>` +
      `${provenance(d, shelfTotal)}` +
      // Nothing on screen changes when a list opens except the list
      // itself, which a screen reader does not notice. One line, said
      // once, politely.
      `<p class="fa-fp-status visually-hidden" role="status" aria-live="polite"></p>`;

    // Above the search panel and the shelves, below the life: the
    // order a reader wants is who he was, how he read, then how to
    // look, then what there is.
    const search = root.querySelector(".fa-search");
    const shelf = root.querySelector(".fa-shelf");
    const before = search || shelf;
    if (before) root.insertBefore(panel, before);
    else root.appendChild(panel);

    const status = panel.querySelector(".fa-fp-status");

    // The control is one-way on purpose. A reader who asked for the
    // rest of a twenty-row list is not asking to put it back, and a
    // toggle that says "Show 12 more" and then "Show fewer" is two
    // labels for one small list. But it is an action, not a disclosure
    // that stays on the page, so it carries no `aria-expanded`: that
    // attribute describes a control which is still there in its other
    // state, and this one is gone.
    //
    // Removing the pressed element drops focus onto <body>, which puts
    // a keyboard reader back at the top of the document. So focus moves
    // to the first row that appeared.
    function reveal(more) {
      const scope = more.previousElementSibling;
      const rest = scope ? [...scope.querySelectorAll(".fa-fp-rest")] : [];
      rest.forEach((el) => { el.hidden = false; });
      if (status) {
        status.textContent = `${n(rest.length)} more shown. ${
          n(scope ? scope.children.length : rest.length)} in all.`;
      }
      more.remove();
      const first = rest[0];
      const target = first && (first.querySelector("button, a") || first);
      if (target) {
        if (target.tagName !== "BUTTON" && target.tagName !== "A") {
          target.setAttribute("tabindex", "-1");
        }
        target.focus({ preventScroll: false });
      }
    }

    panel.addEventListener("click", (e) => {
      const more = e.target.closest("[data-fp-more]");
      if (more) { reveal(more); return; }
      const verse = e.target.closest("[data-fp-ref]");
      if (verse && window.MOAuthorSearch && window.MOAuthorSearch.find) {
        window.MOAuthorSearch.find(verse.getAttribute("data-fp-ref"));
      }
    });
  }

  window.MOAuthorScripture = { load, mount };
}());
