/*
 * Citations across the whole canon — the Scripture Index page.
 *
 * This file used to draw its own two-column bar chart of every book,
 * stacked above the book-by-book accordion faith-indexes.js draws. Two
 * lists of the same sixty-six books, one above the other, each with its
 * own figure beside each book, and the two figures did not agree:
 * Genesis read 250,677 here and "92,022 references" there. They are
 * merged now. This file still owns the DATA; faith-indexes.js owns the
 * one list, and paints the bar and the figure into the same row that
 * carries the book's name and its disclosure control.
 *
 * WHAT THE FIGURE COUNTS, and why the old two disagreed.
 *
 * v1/bible/all/books.json counts CITATION OCCURRENCES: every place a
 * work in the library quotes or names a passage. 6,037,993 of them,
 * and the file is exactly the sum of the nine per-tradition files
 * v1/bible/{code}/books.json (verified: Genesis 250,677 = 76,118 ed +
 * 21,660 gf + 1,218 hl + 31,507 lu + 7,680 md + 34,001 pl + 2,869 po +
 * 27,148 rc + 48,476 rf, and the grand totals agree to the unit).
 *
 * The accordion's old "92,022 references" was not a citation count at
 * all. It is the sum, over a book's chapters, of the ROW COUNT in each
 * generated per-chapter file, and a row there is one WORK. So it
 * counted work-and-chapter pairs: a work citing Genesis 1 and Genesis 3
 * counts twice, and a work citing Genesis 1 eleven times counts once.
 * It also spans only the four collections whose text has been walked
 * (the Latin Library, Early English Books, Patrologia Latina and
 * Augustine), where this file spans all nine traditions.
 *
 * Both are real and both are wanted, so both are shown: the occurrence
 * count is the figure and the bar on the book's row, and the
 * work-and-chapter count is stated inside the book when it is opened,
 * next to the chapter rows that add up to it. Neither is presented as
 * the other, and the note under the list says which is which.
 *
 * Still deliberately not built: chapter-level density, and a
 * cross-tradition comparison chart.
 *
 * Fault isolation is unchanged and still the point. faith-indexes.js
 * renders a complete, usable accordion knowing nothing about this file;
 * if this fetch never lands, the rows simply carry no bar and no
 * citation figure. Nothing here reads that file's data or waits on its
 * fetches. The hand-off is one way and one object: window.MOScriptureTotals,
 * plus a `faith:scripture-totals` event when it changes, because either
 * script may finish first.
 *
 * The jump control does not reach into faith-indexes.js's markup
 * either. It only ever sets `location.hash` to the id that script
 * gives a chapter's own <details> when that chapter has something in
 * the generated index — `ref-<book>-<chapter>`, built the same way here
 * as there, so the ids agree without the two files knowing about each
 * other. The tradition filter rescopes the figure and the bar, and
 * nothing below them: the generated index has no tradition granularity
 * of its own, so the chapters a book opens to are the same whichever
 * chips are lit. The note says so rather than letting the reader assume
 * the filter reached all the way down.
 */
(function () {
  "use strict";

  const section = document.querySelector('[data-faith-section="scripture"]');
  if (!section) return;
  const host = section.querySelector(".container");
  if (!host) return;

  // mo-tfr-library, and only ever mo-tfr-library. Read from the meta
  // tag the rest of the Faith Received scripts read, with the same
  // literal fallback they carry for a page that has not set it.
  const LIBRARY = (document.querySelector('meta[name="tfr-library-base"]') || {}).content
    || "https://mo-tfr-library.mo-podcast-feed.workers.dev";

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  const n = (x) => Number(x || 0).toLocaleString();

  // Canonical display order and spelling, matching the arrays
  // faith-indexes.js builds its own book list and chapter ids from —
  // Arabic numerals, "Song Of Solomon", "Ecclesiasticus" — so a hash
  // built from these names always lands on the id that script gave
  // the matching chapter, when it gave one at all.
  const OT = [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua",
    "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings",
    "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job",
    "Psalms", "Proverbs", "Ecclesiastes", "Song Of Solomon", "Isaiah",
    "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel",
    "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk",
    "Zephaniah", "Haggai", "Zechariah", "Malachi",
  ];
  const DEUTERO = [
    "Tobit", "Judith", "Wisdom", "Ecclesiasticus", "Baruch",
    "1 Maccabees", "2 Maccabees",
  ];
  const NT = [
    "Matthew", "Mark", "Luke", "John", "Acts", "Romans",
    "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
    "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
    "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James",
    "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude",
    "Revelation",
  ];
  const CANON_ORDER = OT.concat(DEUTERO, NT);

  // v1/bible/all/books.json spells three books differently from the
  // list above — Roman numerals ("I Samuel"), "Revelation of John",
  // "Ecclesiasticus" as "Sirach" — because it comes out of a different
  // build than the one faith-indexes.js's OT/NT arrays were written
  // against. Reconciled here rather than by renaming either list, so
  // neither file has to change to agree with the other. Confirmed
  // against a live v1/bible/lu/books.json too — the per-tradition
  // files use the identical book-naming convention, so this same
  // function serves both.
  const ROMAN = { 1: "I", 2: "II", 3: "III" };
  const BOOKS_JSON_ALIAS = { revelation: "revelation of john", ecclesiasticus: "sirach" };
  function toBooksJsonKey(name) {
    let b = String(name || "").trim();
    const m = b.match(/^([123])\s+(.*)$/);
    if (m && ROMAN[m[1]]) b = `${ROMAN[m[1]]} ${m[2]}`;
    const lower = b.toLowerCase();
    return BOOKS_JSON_ALIAS[lower] || lower;
  }

  // The same id faith-indexes.js stamps on a chapter's <details>, when
  // that chapter has anything in the old index to show.
  function chapterId(book, ch) {
    return `ref-${String(book).replace(/\s+/g, "-").toLowerCase()}-${ch}`;
  }

  // ── Tradition data ────────────────────────────────────────────────

  const TRADITION_CODES = ["ed", "gf", "hl", "lu", "md", "pl", "po", "rc", "rf"];
  const TRADITION_LABEL = {
    ed: "English Divines",
    gf: "Greek Fathers",
    hl: "Humanism and Law",
    lu: "Lutheran",
    md: "Medieval",
    pl: "Latin Fathers",
    po: "Eastern Fathers",
    rc: "Roman Catholic",
    rf: "Reformed",
  };

  const tradCache = new Map();
  function loadTradition(code) {
    if (tradCache.has(code)) return tradCache.get(code);
    const p = fetch(`${LIBRARY}/v1/bible/${code}/books.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (d && d.books) || [])
      .catch(() => []);
    tradCache.set(code, p);
    return p;
  }

  // Sums per-book totals across one or more tradition datasets, keyed
  // the same way v1/bible/all/books.json's own rows are (lower-cased
  // `book`), so the result can be fed to byKeyOf() exactly like the
  // canon-wide dataset is.
  function sumBooks(rowSets) {
    const byLower = new Map();
    rowSets.forEach((rows) => {
      (rows || []).forEach((b) => {
        const key = String(b.book || "").toLowerCase();
        const acc = byLower.get(key);
        if (acc) acc.n += b.n || 0;
        else byLower.set(key, { book: b.book, n: b.n || 0 });
      });
    });
    return Array.from(byLower.values());
  }

  function byKeyOf(rows) {
    return new Map(rows.map((b) => [String(b.book || "").toLowerCase(), b]));
  }

  // ── The hand-off to faith-indexes.js ──────────────────────────────
  //
  // Keyed by the canonical display name faith-indexes.js builds its own
  // book list from ("Genesis", "1 Corinthians", "Song Of Solomon",
  // "Ecclesiasticus", "Revelation"), so that file never has to know that
  // books.json spells three of them differently. The aliasing stays
  // here, where the file that needs it is read.
  //
  // Published as a plain object with a Map on it rather than as an
  // event payload alone, because the two scripts race: whichever
  // finishes second has to be able to pick up what the first left.
  function publish(byKey, scopeLabel, note) {
    const byBook = new Map();
    CANON_ORDER.forEach((name) => {
      const row = byKey.get(toBooksJsonKey(name));
      if (row && row.n) byBook.set(name, row.n);
    });
    window.MOScriptureTotals = { byBook, scopeLabel, note };
    try {
      window.dispatchEvent(new CustomEvent("faith:scripture-totals"));
    } catch (err) {
      // An older browser without the CustomEvent constructor still gets
      // the object above; faith-indexes.js reads it on its own render.
    }
  }

  function maxOf(names, byKey) {
    return names.reduce((max, name) => {
      const row = byKey.get(toBooksJsonKey(name));
      return row && row.n > max ? row.n : max;
    }, 1);
  }

  // ── Rendering pieces ──────────────────────────────────────────────

  // One thin bar per canonical book, Genesis through Revelation in one
  // row, height on a square-root scale — Psalms outweighs Obadiah by
  // roughly a thousand times in raw citations, and a linear scale
  // would flatten every book but the handful with real volume to a
  // hairline. sqrt keeps the small books visible without pretending
  // they carry as much weight as they don't.
  function canonStrip(byKey) {
    const max = maxOf(CANON_ORDER, byKey);
    const items = CANON_ORDER.map((name) => {
      const row = byKey.get(toBooksJsonKey(name));
      const total = row ? row.n : 0;
      const h = total ? Math.max(6, Math.round(Math.sqrt(total / max) * 100)) : 3;
      const label = `${name}: ${total ? n(total) : "no"} citation${total === 1 ? "" : "s"}`;
      return `<li class="fa-canon-bar${total ? "" : " is-empty"}" title="${escapeHtml(label)}">` +
        `<span class="fa-canon-bar-fill" style="height:${h}%"></span>` +
        `<span class="visually-hidden">${escapeHtml(label)}</span></li>`;
    }).join("");
    return `<ol class="fa-canon-strip" aria-label="Citation density across the canon, Genesis to Revelation">${items}</ol>`;
  }

  // The unit is defined here, once, because it is the thing the two
  // counts on this page differ about. It opens the Methodology under the
  // book list (faith-indexes.js paintTotals), with the note on the figures.
  const UNIT = "A citation is one place a work names or quotes a passage, so a work that returns to the"
    + " same verse ten times is counted ten times.";

  function ledeHtml(rows, scopeLabel) {
    const total = rows.reduce((s, b) => s + (b.n || 0), 0);
    const top = rows.slice().sort((a, b) => b.n - a.n)[0] || {};
    // "in Lutheran, counted across every tradition the library sorts
    // into" is a sentence that contradicts itself, which is what the
    // scoped lede used to say: the scope label was dropped into a
    // clause written for the unscoped figure. Two sentences now, and
    // only the one that is true gets printed.
    const opening = scopeLabel
      ? `${n(total)} citations of scripture${scopeLabel}.`
      : `${n(total)} citations of scripture, counted across every tradition the library now sorts into:`
        + ` Latin and Greek Fathers, the English Divines, the schoolmen, the Reformers and those who`
        + ` answered them.`;
    return `${opening} <b>${escapeHtml(top.book || "")}</b>`
      + ` is cited more than any other book${scopeLabel ? " there" : ""}, at ${n(top.n)}.`;
  }

  function traditionChipsHtml(active) {
    const all = `<button type="button" class="faith-filter-pill${active.size ? "" : " is-active"}"` +
      ` data-fp-trad-all aria-pressed="${active.size ? "false" : "true"}">All</button>`;
    const rest = TRADITION_CODES.map((code) => {
      const isActive = active.has(code);
      return `<button type="button" class="faith-filter-pill${isActive ? " is-active" : ""}"` +
        ` data-fp-trad="${code}" aria-pressed="${isActive ? "true" : "false"}">${escapeHtml(TRADITION_LABEL[code])}</button>`;
    }).join("");
    return `<div class="faith-filter-group fa-fp-traditions">` +
      `<span class="faith-filter-label">Tradition</span>${all}${rest}</div>`;
  }

  // ── Mount ───────────────────────────────────────────────────────

  // The note that travels with the figures. It has to do three things
  // at once: say what the figure counts, say that the bar is not linear
  // (Psalms outweighs Philemon 785 to 1, and a linear bar would render
  // Philemon at a third of a pixel), and say that the count inside an
  // opened book is a different measure rather than a contradiction.
  const ALL_NOTE = [UNIT, "The figure beside each book counts citation occurrences: every place a work in the"
    + " library names or quotes a passage from it. Counted from v1/bible/all/books.json, the 2026-08-25"
    + " library-wide index, across all nine traditions. The bar is on a square-root scale so that the"
    + " shorter books stay visible beside Psalms, so read the figure for the size and the bar only for the"
    + " shape. Open a book and the chapter rows count something narrower, and say so there."].join("\n");

  function scopedNote(codes, labels) {
    return `${UNIT}\nThe figure beside each book counts citation occurrences, from v1/bible/${codes.join(", ")}/books.json,`
      + ` scoped to ${labels.join(" + ")}. A dash means that tradition cites nothing in the book. The chapters`
      + ` inside a book do not narrow with these chips: the generated index this list opens into records where a`
      + ` citation is, not which tradition made it.`;
  }

  function mount(allRows) {
    const active = new Set();

    const panel = document.createElement("section");
    panel.className = "fa-fp faith-scripture-totals";
    panel.setAttribute("aria-labelledby", "faith-scripture-totals-head");
    panel.innerHTML =
      `<h2 class="fa-fp-head" id="faith-scripture-totals-head">Citations across the canon</h2>` +
      `<p class="fa-fp-lede" data-fst-lede></p>` +
      `<div data-fst-strip></div>${traditionChipsHtml(active)}` +
      `<p class="fa-fp-trad-status visually-hidden" role="status" aria-live="polite" data-fst-trad-status></p>` +
      `<form class="faith-scripture-jump" data-faith-scripture-jump>` +
      `<label class="faith-scripture-jump-label"><span>Go to a passage</span>` +
      `<input type="text" class="faith-scripture-jump-input" data-faith-scripture-jump-input` +
      ` placeholder="Romans 8, or Genesis 1" aria-label="Go to a book and chapter"></label>` +
      `<button type="submit" class="fa-search-btn">Go</button></form>` +
      `<p class="faith-scripture-jump-status visually-hidden" role="status" aria-live="polite" data-faith-scripture-jump-status></p>`;

    host.insertBefore(panel, host.firstChild);

    const ledeEl = panel.querySelector("[data-fst-lede]");
    const stripEl = panel.querySelector("[data-fst-strip]");
    const tradStatus = panel.querySelector("[data-fst-trad-status]");

    // The books themselves are drawn by faith-indexes.js, one row per
    // book, bar and figure in the same row as the name and the
    // disclosure control. All this does is hand over the numbers.
    function draw(rows, scopeLabel, sourceNote) {
      const byKey = byKeyOf(rows);
      ledeEl.innerHTML = ledeHtml(rows, scopeLabel);
      stripEl.innerHTML = canonStrip(byKey);
      publish(byKey, scopeLabel, sourceNote);
    }

    draw(allRows, "", ALL_NOTE);

    function refresh() {
      if (!active.size) {
        draw(allRows, "", ALL_NOTE);
        if (tradStatus) tradStatus.textContent = "Showing every tradition.";
        return;
      }
      const codes = Array.from(active);
      tradStatus.textContent = `Loading ${codes.map((c) => TRADITION_LABEL[c]).join(", ")}…`;
      Promise.all(codes.map(loadTradition)).then((sets) => {
        const rows = sumBooks(sets);
        const labels = codes.map((c) => TRADITION_LABEL[c]);
        const scopeLabel = ` in ${labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`}`;
        draw(rows, scopeLabel, scopedNote(codes, labels));
        tradStatus.textContent = `Showing ${labels.join(", ")}.`;
      });
    }

    panel.addEventListener("click", (e) => {
      const allBtn = e.target.closest("[data-fp-trad-all]");
      if (allBtn) {
        active.clear();
        panel.querySelectorAll("[data-fp-trad]").forEach((b) => {
          b.classList.remove("is-active");
          b.setAttribute("aria-pressed", "false");
        });
        allBtn.classList.add("is-active");
        allBtn.setAttribute("aria-pressed", "true");
        refresh();
        return;
      }
      const tradBtn = e.target.closest("[data-fp-trad]");
      if (tradBtn) {
        const code = tradBtn.getAttribute("data-fp-trad");
        if (active.has(code)) active.delete(code);
        else active.add(code);
        tradBtn.classList.toggle("is-active", active.has(code));
        tradBtn.setAttribute("aria-pressed", active.has(code) ? "true" : "false");
        const allBtn2 = panel.querySelector("[data-fp-trad-all]");
        if (allBtn2) {
          allBtn2.classList.toggle("is-active", !active.size);
          allBtn2.setAttribute("aria-pressed", active.size ? "false" : "true");
        }
        refresh();
      }
    });

    // ── The jump control ─────────────────────────────────────────

    const form = panel.querySelector("[data-faith-scripture-jump]");
    const input = panel.querySelector("[data-faith-scripture-jump-input]");
    const status = panel.querySelector("[data-faith-scripture-jump-status]");
    const ALL_NAMES = CANON_ORDER;

    function resolveBook(text) {
      const t = String(text || "").trim().toLowerCase();
      if (!t) return null;
      // Longest match first: "1 corinthians" must not be matched by a
      // loose prefix test against "1 corinthians 15" leaving nothing
      // for "corinthians" itself to disambiguate against.
      return ALL_NAMES
        .filter((name) => t.startsWith(name.toLowerCase()))
        .sort((a, b) => b.length - a.length)[0] || null;
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const raw = input.value.trim();
      const book = resolveBook(raw);
      const rest = book ? raw.slice(book.length).trim() : "";
      const ch = parseInt((rest.match(/\d+/) || [])[0], 10);
      if (!book || !ch) {
        status.textContent = "Not a reference this page knows. Try a book and a chapter, such as Romans 8.";
        return;
      }
      // Ask the list to go there rather than reaching into its markup.
      // The hash trick this used to do could only ever work when the
      // book was already on screen, so a jump to Romans 8 from the Old
      // Testament tab found nothing and reported the reference missing
      // when it was merely on the other tab. faith-indexes.js already
      // listens for this, switches the testament, opens the book and
      // the chapter and scrolls to it.
      window.dispatchEvent(new CustomEvent("faith:goto-scripture", {
        detail: { book, chapter: ch },
      }));
      // Checked on the next frame, after that listener has rendered, so
      // the reader is told the truth whether it worked or not. If
      // faith-indexes.js never loaded, nothing moved and this says so.
      window.requestAnimationFrame(() => {
        status.textContent = document.getElementById(chapterId(book, ch))
          ? `Opening ${book} ${ch}.`
          : `${book} ${ch} is not in the index yet. The chapters below come from the four collections whose text has been walked.`;
      });
    });
  }

  fetch(`${LIBRARY}/v1/bible/all/books.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => { if (data && (data.books || []).length) mount(data.books); })
    .catch(() => {});
}());
