/*
 * Citations across the whole canon — the Scripture Index page, above
 * the book-by-book browser faith-indexes.js already draws.
 *
 * faith-indexes.js answers "who cites Genesis 3" from two collections
 * it has walked itself, work by work. This answers a different,
 * coarser question — "how much does the library cite Genesis, next to
 * everything else" — from one file the 2026-09 mo-tfr drop ships
 * whole: v1/bible/all/books.json, a single 66 KB summary already
 * totalled across all nine traditions the drop sorts the library
 * into. 6,037,993 citations in all, Psalms alone accounting for
 * 592,661 of them.
 *
 * Deliberately the smaller half of what a "Scripture door" could be.
 * The full design also calls for tradition filters on this count and
 * a chapter-by-chapter density strip across the canon; neither is
 * built here. What is here is real and load-bearing on its own: the
 * per-book figures, in canonical order, and a way to jump straight to
 * a passage. Fetched and drawn independently of faith-indexes.js —
 * this panel does not read its data, wait on its fetches, or touch
 * the DOM it builds — so a fault in one can never take down the
 * other.
 *
 * The jump control does not reach into faith-indexes.js's markup
 * either. It only ever sets `location.hash` to the id that script
 * gives a chapter's own <details> when that chapter has something in
 * the OLD index — `ref-<book>-<chapter>`, built the same way here as
 * there, so the ids agree without the two files knowing about each
 * other. A browser that supports scroll-to-fragment inside a closed
 * <details> — every evergreen one does — opens it and scrolls there on
 * its own. Nothing to wire up. A chapter the old index has not read
 * yet, which is most of them now that the whole canon is counted here,
 * jumps nowhere; the number from this file is shown beside it anyway,
 * because that number does not depend on the old index having read
 * that far.
 */
(function () {
  "use strict";

  const section = document.querySelector('[data-faith-section="scripture"]');
  if (!section) return;
  const host = section.querySelector(".container");
  if (!host) return;

  const LIBRARY = "https://mo-tfr-library.mo-podcast-feed.workers.dev";

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

  // v1/bible/all/books.json spells three books differently from the
  // list above — Roman numerals ("I Samuel"), "Revelation of John",
  // "Ecclesiasticus" as "Sirach" — because it comes out of a different
  // build than the one faith-indexes.js's OT/NT arrays were written
  // against. Reconciled here rather than by renaming either list, so
  // neither file has to change to agree with the other.
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

  function bookBars(names, byKey, testamentMax) {
    return names.map((name) => {
      const row = byKey.get(toBooksJsonKey(name));
      const total = row ? row.n : 0;
      const pct = total ? Math.max(1.5, (total / testamentMax) * 100) : 0;
      return `<li class="fa-fp-book${total ? "" : " is-empty"}">` +
        `<span class="fa-fp-book-name">${escapeHtml(name)}</span>` +
        `<span class="fa-fp-bar"><span class="fa-fp-bar-fill" style="width:${pct.toFixed(1)}%"></span></span>` +
        `<span class="fa-fp-book-n">${total ? n(total) : "—"}` +
        `<span class="visually-hidden"> citation${total === 1 ? "" : "s"}</span></span></li>`;
    }).join("");
  }

  function maxOf(names, byKey) {
    return names.reduce((max, name) => {
      const row = byKey.get(toBooksJsonKey(name));
      return row && row.n > max ? row.n : max;
    }, 1);
  }

  function render(data) {
    const rows = (data && data.books) || [];
    if (!rows.length) return;
    const byKey = new Map(rows.map((b) => [String(b.book || "").toLowerCase(), b]));
    const total = rows.reduce((s, b) => s + (b.n || 0), 0);

    const otNames = OT.concat(DEUTERO);
    const otMax = maxOf(otNames, byKey);
    const ntMax = maxOf(NT, byKey);

    const panel = document.createElement("section");
    panel.className = "fa-fp faith-scripture-totals";
    panel.setAttribute("aria-labelledby", "faith-scripture-totals-head");
    panel.innerHTML =
      `<h2 class="fa-fp-head" id="faith-scripture-totals-head">Citations across the canon</h2>` +
      `<p class="fa-fp-lede">${n(total)} citations of scripture, counted across every tradition the library` +
      ` now sorts into — Latin and Greek Fathers, the English Divines, the schoolmen, the Reformers and those` +
      ` who answered them. <b>${escapeHtml((rows.slice().sort((a, b) => b.n - a.n)[0] || {}).book || "")}</b>` +
      ` is cited more than any other book, at ${n((rows.slice().sort((a, b) => b.n - a.n)[0] || {}).n)}.</p>` +
      `<form class="faith-scripture-jump" data-faith-scripture-jump>` +
      `<label class="faith-scripture-jump-label"><span>Go to a passage</span>` +
      `<input type="text" class="faith-scripture-jump-input" data-faith-scripture-jump-input` +
      ` placeholder="Romans 8, or Genesis 1" aria-label="Go to a book and chapter"></label>` +
      `<button type="submit" class="fa-search-btn">Go</button></form>` +
      `<p class="faith-scripture-jump-status visually-hidden" role="status" aria-live="polite" data-faith-scripture-jump-status></p>` +
      `<div class="fa-fp-cols">` +
      `<div class="fa-fp-col"><h3 class="fa-fp-sub">Old Testament</h3>` +
      `<ol class="fa-fp-books faith-scripture-totals-list">${bookBars(otNames, byKey, otMax)}</ol></div>` +
      `<div class="fa-fp-col"><h3 class="fa-fp-sub">New Testament</h3>` +
      `<ol class="fa-fp-books faith-scripture-totals-list">${bookBars(NT, byKey, ntMax)}</ol></div>` +
      `</div>` +
      `<p class="fa-fp-source">Counted from v1/bible/all/books.json, the 2026-09 library-wide index. A dash` +
      ` means the book has no citations recorded there yet, not that none exist.</p>`;

    host.insertBefore(panel, host.firstChild);

    const form = panel.querySelector("[data-faith-scripture-jump]");
    const input = panel.querySelector("[data-faith-scripture-jump-input]");
    const status = panel.querySelector("[data-faith-scripture-jump-status]");
    const ALL_NAMES = otNames.concat(NT);

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
      const id = chapterId(book, ch);
      const target = document.getElementById(id);
      if (target) {
        status.textContent = `Opening ${book} ${ch}.`;
        window.location.hash = id;
        target.scrollIntoView({ block: "start", behavior: "smooth" });
        if (typeof target.open !== "undefined") target.open = true;
      } else {
        const row = byKey.get(toBooksJsonKey(book));
        status.textContent = row && row.chapters
          ? `${book} ${ch} is not yet open below — the book browser only reads two of the library's collections so far.`
          : `${book} ${ch} is not in the index.`;
      }
    });
  }

  fetch(`${LIBRARY}/v1/bible/all/books.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => { if (data) render(data); })
    .catch(() => {});
}());
