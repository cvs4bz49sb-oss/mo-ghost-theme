/*
 * Citations across the whole canon — the Scripture Index page, above
 * the book-by-book browser faith-indexes.js already draws.
 *
 * faith-indexes.js answers "who cites Genesis 3" from two collections
 * it has walked itself, work by work. This answers a different,
 * coarser question — "how much does the library cite Genesis, next to
 * everything else" — from files the 2026-09 mo-tfr drop ships whole:
 * v1/bible/all/books.json (6,037,993 citations, all nine traditions
 * combined) and, per tradition, v1/bible/{code}/books.json — the same
 * per-book/per-chapter shape, just scoped to one of the nine codes
 * (ed/gf/hl/lu/md/pl/po/rc/rf; see TRADITION_LABEL below, duplicated
 * from assets/js/faith-author-scripture.js's CORPUS_LABEL per this
 * file family's no-shared-state convention rather than imported).
 *
 * Two pieces of the door were deferred when this panel first shipped
 * (2026-09-03, see the git log around "canon-wide citation totals"):
 * tradition filter chips on the count, and a citation-density strip
 * across the whole canon. Both are built here now, from data that was
 * always there — v1/bible/{code}/books.json for the chips, and
 * v1/bible/all/books.json (already fetched) for the strip.
 *
 * Deliberately still not the full "Scripture door": no chapter-level
 * density, no cross-tradition comparison chart. What is here is real
 * and load-bearing: the per-book figures, filterable by tradition, a
 * way to jump straight to a passage, and a single-glance shape of the
 * whole canon.
 *
 * Fetched and drawn independently of faith-indexes.js — this panel
 * does not read its data, wait on its fetches, or touch the DOM it
 * builds — so a fault in one can never take down the other.
 *
 * The jump control does not reach into faith-indexes.js's markup
 * either. It only ever sets `location.hash` to the id that script
 * gives a chapter's own <details> when that chapter has something in
 * the OLD index — `ref-<book>-<chapter>`, built the same way here as
 * there, so the ids agree without the two files knowing about each
 * other. A browser that supports scroll-to-fragment inside a closed
 * <details> — every evergreen one does — opens it and scrolls there on
 * its own. Nothing to wire up. A chapter the old index has not read
 * yet jumps nowhere; the number from this file is shown beside it
 * anyway, because that number does not depend on the old index having
 * read that far. The tradition filter never changes what the jump
 * control can reach — the old index has no tradition granularity of
 * its own, so narrowing the count above it would be a filter with
 * nothing underneath to honour it.
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

  function maxOf(names, byKey) {
    return names.reduce((max, name) => {
      const row = byKey.get(toBooksJsonKey(name));
      return row && row.n > max ? row.n : max;
    }, 1);
  }

  // ── Rendering pieces ──────────────────────────────────────────────

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

  function ledeHtml(rows, scopeLabel) {
    const total = rows.reduce((s, b) => s + (b.n || 0), 0);
    const top = rows.slice().sort((a, b) => b.n - a.n)[0] || {};
    return `${n(total)} citations of scripture${scopeLabel}, counted across every tradition the library` +
      ` now sorts into — Latin and Greek Fathers, the English Divines, the schoolmen, the Reformers and those` +
      ` who answered them. <b>${escapeHtml(top.book || "")}</b>` +
      ` is cited more than any other book, at ${n(top.n)}.`;
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

  function mount(allRows) {
    const otNames = OT.concat(DEUTERO);
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
      `<p class="faith-scripture-jump-status visually-hidden" role="status" aria-live="polite" data-faith-scripture-jump-status></p>` +
      `<div class="fa-fp-cols">` +
      `<div class="fa-fp-col"><h3 class="fa-fp-sub">Old Testament</h3>` +
      `<ol class="fa-fp-books faith-scripture-totals-list" data-fst-ot></ol></div>` +
      `<div class="fa-fp-col"><h3 class="fa-fp-sub">New Testament</h3>` +
      `<ol class="fa-fp-books faith-scripture-totals-list" data-fst-nt></ol></div>` +
      `</div>` +
      `<p class="fa-fp-source" data-fst-source></p>`;

    host.insertBefore(panel, host.firstChild);

    const ledeEl = panel.querySelector("[data-fst-lede]");
    const stripEl = panel.querySelector("[data-fst-strip]");
    const otEl = panel.querySelector("[data-fst-ot]");
    const ntEl = panel.querySelector("[data-fst-nt]");
    const sourceEl = panel.querySelector("[data-fst-source]");
    const tradStatus = panel.querySelector("[data-fst-trad-status]");

    function draw(rows, scopeLabel, sourceNote) {
      const byKey = byKeyOf(rows);
      const otMax = maxOf(otNames, byKey);
      const ntMax = maxOf(NT, byKey);
      ledeEl.innerHTML = ledeHtml(rows, scopeLabel);
      stripEl.innerHTML = canonStrip(byKey);
      otEl.innerHTML = bookBars(otNames, byKey, otMax);
      ntEl.innerHTML = bookBars(NT, byKey, ntMax);
      sourceEl.textContent = sourceNote;
    }

    draw(allRows, "", "Counted from v1/bible/all/books.json, the 2026-09 library-wide index. A dash"
      + " means the book has no citations recorded there yet, not that none exist.");

    function refresh() {
      if (!active.size) {
        draw(allRows, "", "Counted from v1/bible/all/books.json, the 2026-09 library-wide index. A dash"
          + " means the book has no citations recorded there yet, not that none exist.");
        if (tradStatus) tradStatus.textContent = "Showing every tradition.";
        return;
      }
      const codes = Array.from(active);
      tradStatus.textContent = `Loading ${codes.map((c) => TRADITION_LABEL[c]).join(", ")}…`;
      Promise.all(codes.map(loadTradition)).then((sets) => {
        const rows = sumBooks(sets);
        const labels = codes.map((c) => TRADITION_LABEL[c]);
        const scopeLabel = ` in ${labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`}`;
        draw(rows, scopeLabel, `Counted from v1/bible/${codes.join(", ")}/books.json, scoped to`
          + ` ${labels.join(" + ")}. A dash means the book has no citations recorded there.`);
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
        const row = byKeyOf(allRows).get(toBooksJsonKey(book));
        status.textContent = row && row.chapters
          ? `${book} ${ch} is not yet open below — the book browser only reads two of the library's collections so far.`
          : `${book} ${ch} is not in the index.`;
      }
    });
  }

  fetch(`${LIBRARY}/v1/bible/all/books.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => { if (data && (data.books || []).length) mount(data.books); })
    .catch(() => {});
}());
