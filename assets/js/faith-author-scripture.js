/*
 * The scripture fingerprint, on an author page.
 *
 * What a writer quoted is the nearest thing a library has to a
 * portrait of how they read. The shelf below already says what they
 * wrote; this says which books they lived in — Augustine at 19,823
 * citations of the Psalms, Bernard's Song of Songs, Rupert on Genesis.
 *
 * Two sources feed this panel now, and they are not the same shape:
 *
 *   THE OLD INDEX — v1/index/author-scripture/<folded>.json, built by
 *   scripts/build-author-scripture.mjs from a chapter-by-chapter crawl
 *   of the old bucket. It only ever read two collections, Patrologia
 *   Latina and Augustine, and its "verses" figure counts WORKS: a verse
 *   is recorded once per work that turns on it, never once per
 *   occurrence.
 *
 *   THE NEW PROFILE — v1/bible/all/a2/<slug>.json.gz, shipped whole by
 *   the 2026-09 mo-tfr drop. One file per author, already merged across
 *   all nine traditions the drop sorts the library into (English
 *   Divines, Greek Fathers, Humanism and Law, Lutheran, Medieval, Latin
 *   Fathers, Patrologia Orientalis, Roman Catholic, Reformed — codes
 *   ed/gf/hl/lu/md/pl/po/rc/rf). Its "books" and "verses" are both
 *   OCCURRENCES: how many times, not how many works.
 *
 * Fetched in parallel and merged where the new one, being the fuller
 * of the two, wins whenever it has anything to say. The old index
 * survives as a fallback (an author it named but the new drop somehow
 * missed still gets a panel) and as the only source of two figures the
 * new file does not carry at all: this author's rank among the whole
 * index, and the doubtful ("dubia") attributions Migne's editors filed
 * under a name in parentheses. A merged panel keeps whichever of those
 * the old index had to offer, on top of the new file's wider shelf.
 *
 * Because the two sources count verses two different ways, the panel
 * says which way it is counting rather than picking one label and
 * hoping it stays true. `d.verseUnit` is "citations" for the new
 * source and "works" for the old, and the note under the verse list
 * is written from that flag, not hard-coded.
 *
 * The headings and notes name nobody's sex. This shelf is mostly men
 * and it is not only men — Hildegard of Bingen is in the index — and
 * "Books he cites" over her chart is simply wrong.
 *
 * Nothing here is decorative. Every verse is a button that runs the
 * search panel below on that reference, so "Romans 5:5, in 89 works"
 * is one tap from the works with the lines in front of you. A second,
 * smaller control beside it — "Read" — is new: it opens the verse's
 * own text in place, fetched from the ASV (public domain) the new
 * drop ships at v1/bible/asv/. That is the whole of what this file
 * does with the Bible text itself: no new reader, just the one verse
 * a reader is already looking at, one tap away rather than a
 * navigation off the page and back.
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

  // The new file ships every book and verse an author was ever caught
  // at, uncapped — the old build script capped this at build time
  // (TOP_BOOKS/TOP_VERSES in build-author-scripture.mjs) and the new
  // source needs the same ceiling applied client-side, or Migne's most
  // prolific quoters render a list nobody scrolls to the end of.
  const TOP_BOOKS_NEW = 24;
  const TOP_VERSES_NEW = 60;

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

  // The same fold the rest of the theme uses to match a name to a URL
  // (faith-author.js, faith-browse-search.js, faith-room.js). Used
  // here only to recognise the catalogue's own collective buckets.
  function fold(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  // The new drop's own slugifier, reverse-engineered from its output
  // rather than documented anywhere: lower-case, then any run of
  // characters outside a-z0-9 becomes one hyphen, edges trimmed. It is
  // NOT the same function as `fold` above — it does not strip accents,
  // it turns them into a hyphen — which is why "Adomnán of Iona" ships
  // as "adomn-n-of-iona" and not "adomnanofiona". Confirmed against a
  // live sample of the bucket before writing this rather than guessed:
  // both forms were fetched and compared for a handful of names,
  // ordinary and accented, before this was trusted for every author
  // page on the site.
  function slugify(s) {
    return String(s || "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  // Only PLD and the Augustine collection were ever in the old index.
  // The new drop's nine tradition codes are added beside them; an
  // author's provenance line can now name either set depending on
  // which source answered.
  const CORPUS_LABEL = {
    pld: "Patrologia Latina",
    augustine: "the Augustine collection",
    tfr: "the Latin Library",
    eebo: "Early English Books",
    ed: "the English Divines",
    gf: "the Greek Fathers",
    hl: "Humanism and Law",
    lu: "the Lutherans",
    md: "the Medieval writers",
    pl: "the Latin Fathers",
    po: "the Eastern Fathers",
    rc: "Roman Catholic writers",
    rf: "the Reformed",
  };

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
      bits.push(`That is the ${ordinal(Number(d.rank))} heaviest of the ${n(d.of)} authors the old index has read.`);
    }
    if (d.dubia && d.dubia.citations) {
      bits.push(`A further ${n(d.dubia.citations)} sit in ${n(d.dubia.works)} work${
        d.dubia.works === 1 ? "" : "s"} the catalogue files as doubtfully theirs, counted here and nowhere in the figures below.`);
    }
    // A bucket, not a person. The figures below are a true description
    // of that bucket and not a portrait of how one man read. Said
    // rather than suppressed: what the anonymous half of a catalogue
    // quotes is worth knowing, and it is only misleading if the page
    // lets it pass for a life.
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
     own shelf and leaves the reader where they were.

     A second, smaller control sits beside the search button now: Read
     opens the verse's own words in place, from the ASV text the new
     drop ships. It is a second control rather than a second behaviour
     bolted onto the first, because a button should do one thing, and
     "search this author's shelf" and "show me the verse" are two
     different questions a reader might have. */

  function versesList(d, canSearch) {
    const rows = d.verses || [];
    if (!rows.length) return "";
    const byOccurrence = d.verseUnit === "citations";
    const items = rows.map(([book, ch, v, count], i) => {
      const ref = `${title(book)} ${ch}:${v}`;
      const unitWord = byOccurrence
        ? (count === 1 ? "time" : "times")
        : (count === 1 ? "work" : "works");
      const inner = `<span class="fa-fp-verse-ref">${escapeHtml(ref)}</span>` +
        `<span class="fa-fp-verse-n">${n(count)}` +
        `<span class="visually-hidden"> ${unitWord}</span></span>`;
      // The accessible name says the unit and says what pressing does,
      // because the button reads otherwise as "Romans 5:5, 89" and
      // eighty-nine of nothing is not a fact.
      const control = canSearch
        ? `<button type="button" class="fa-fp-verse" data-fp-ref="${escapeHtml(ref)}"` +
          ` aria-label="Search this author for ${escapeHtml(ref)}, cited ${n(count)} ${unitWord}">` +
          `${inner}</button>`
        : `<span class="fa-fp-verse-static">${inner}</span>`;
      const readBtn = `<button type="button" class="fa-fp-verse-read" data-fp-read` +
        ` data-fp-book="${escapeHtml(book)}" data-fp-ch="${ch}" data-fp-v="${v}"` +
        ` data-fp-refname="${escapeHtml(ref)}" aria-expanded="false"` +
        ` aria-label="Show the text of ${escapeHtml(ref)}, American Standard Version">` +
        `Read<span aria-hidden="true"> &#9662;</span></button>`;
      return `<li class="fa-fp-verse-item${i >= VERSES_SHOWN ? " fa-fp-rest" : ""}"${
        i >= VERSES_SHOWN ? " hidden" : ""}>` +
        `<div class="fa-fp-verse-row">${control}${readBtn}</div>` +
        `<div class="fa-fp-verse-body" hidden></div></li>`;
    }).join("");
    const hidden = rows.length - VERSES_SHOWN;
    const more = hidden > 0
      ? `<button type="button" class="fa-fp-more" data-fp-more="verse">` +
        `Show ${n(hidden)} more verse${hidden === 1 ? "" : "s"}</button>`
      : "";
    const note = byOccurrence
      ? "The figure is how many times the verse is cited, counted across everything the library holds under the name."
      : "The figure is how many of the works cite the verse, not how many times it is cited.";
    return `<div class="fa-fp-col">` +
      `<h3 class="fa-fp-sub">Verses returned to</h3>` +
      `<p class="fa-fp-note">${note}${
        canSearch ? " Choose one to search this author's shelf for it, in the panel below." : ""
      }</p>` +
      `<ul class="fa-fp-verses">${items}</ul>${more}</div>`;
  }

  /* ── The ASV text, fetched on request ──────────────────────────── */

  // The new bucket writes a chapter's own book name with a Roman
  // numeral ("I Corinthians") and the ASV folder tree with an Arabic
  // one and an underscore ("1_Corinthians"); a few titles differ
  // outright (Sirach ships in the ASV under the Apocrypha's older
  // English name, Ecclesiasticus; "Revelation of John" is filed as
  // plain Revelation; the Song of Solomon is filed as Song of Songs).
  // Confirmed against a live listing of v1/bible/asv/ before writing
  // this table — it is not a guess at the convention, it is the
  // convention, for the three cases the site actually cites often
  // enough to have hit them.
  const ROMAN_ONE_TO_THREE = { I: "1", II: "2", III: "3" };
  const ASV_BOOK_ALIAS = {
    "revelation of john": "Revelation",
    "song of solomon": "Song_of_Songs",
    "song of songs": "Song_of_Songs",
    sirach: "Ecclesiasticus",
  };
  function asvPath(book) {
    let b = String(book || "").trim();
    const m = b.match(/^(I{1,3})\s+(.*)$/);
    if (m && ROMAN_ONE_TO_THREE[m[1]]) b = `${ROMAN_ONE_TO_THREE[m[1]]} ${m[2]}`;
    const alias = ASV_BOOK_ALIAS[b.toLowerCase()];
    if (alias) return alias;
    return b.replace(/\s+/g, "_");
  }

  // One request per chapter, not per verse: a reader who opens two
  // verses from the same Psalm should not cost the worker two fetches
  // for the one file that answers both.
  const chapterCache = new Map();
  function loadChapterText(book, chapter) {
    const key = `${asvPath(book)}/${chapter}`;
    if (chapterCache.has(key)) return chapterCache.get(key);
    const p = Promise.race([
      fetch(`${LIBRARY}/v1/bible/asv/${encodeURIComponent(asvPath(book))}/${encodeURIComponent(chapter)}.json`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      new Promise((resolve) => { setTimeout(() => resolve(null), 6000); }),
    ]);
    chapterCache.set(key, p);
    return p;
  }

  function toggleVerseText(btn) {
    const item = btn.closest(".fa-fp-verse-item");
    const body = item && item.querySelector(".fa-fp-verse-body");
    if (!body) return;
    const open = btn.getAttribute("aria-expanded") === "true";
    if (open) {
      btn.setAttribute("aria-expanded", "false");
      body.hidden = true;
      return;
    }
    btn.setAttribute("aria-expanded", "true");
    body.hidden = false;
    // Fetched once, kept: closing and reopening the same verse should
    // not ask the worker twice.
    if (body.dataset.loaded) return;
    const book = btn.getAttribute("data-fp-book");
    const ch = btn.getAttribute("data-fp-ch");
    const v = btn.getAttribute("data-fp-v");
    const ref = btn.getAttribute("data-fp-refname");
    body.innerHTML = `<p class="fa-fp-verse-loading">Loading&hellip;</p>`;
    loadChapterText(book, ch).then((data) => {
      const text = data && data.verses && data.verses[String(v)];
      body.dataset.loaded = "1";
      if (!text) {
        body.innerHTML = `<p class="fa-fp-verse-missing">The text of ${
          escapeHtml(ref)} is not available here.</p>`;
        return;
      }
      body.innerHTML = `<blockquote class="fa-fp-verse-text">${escapeHtml(text)}` +
        `<cite>${escapeHtml(ref)} <span class="fa-fp-verse-version">ASV</span></cite></blockquote>`;
    });
  }

  /* ── Where the figures come from ────────────────────────────────
     Named rather than left as a bare code, and honest about how much
     of the shelf the figures actually cover when that is less than
     everything on the page. */

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

  /* ── Fetching ───────────────────────────────────────────────────
     Two independent fetches, two independent budgets. Neither should
     hold up the page: `fetch` has no timeout of its own, and the panel
     is the part of an author page that can be missing without the page
     failing to be useful, so it is the part that gives up first. */

  const PATIENCE = 6000;
  const PATIENCE_EXTRA = 9000;

  // The old prebuilt index. Kept for the ~2,000 names it still covers
  // that the new drop, for whatever reason, does not — and for the
  // two figures (rank, dubia) that only it carries.
  function load(key) {
    if (!key) return Promise.resolve(null);
    return Promise.race([
      fetch(`${INDEX}/author-scripture/${encodeURIComponent(key)}.json`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      new Promise((resolve) => { setTimeout(() => resolve(null), PATIENCE); }),
    ]);
  }

  // The new per-author profile, fetched by the slug the drop itself
  // uses — not by the theme's folded key, which cannot be turned back
  // into "abbo-of-fleury" once it has thrown the word boundaries away.
  // Wants the resolved catalogue name (see faith-author.js), not the
  // raw URL parameter: the URL often carries an already-folded string,
  // and folding that a second time answers nothing.
  function loadExtra(name) {
    const slug = slugify(name);
    if (!slug) return Promise.resolve(null);
    return Promise.race([
      fetch(`${LIBRARY}/v1/bible/all/a2/${encodeURIComponent(slug)}.json.gz`)
        .then((r) => (r.ok ? r : null))
        .then((r) => (r ? gunzip(r) : null))
        .catch(() => null),
      new Promise((resolve) => { setTimeout(() => resolve(null), PATIENCE_EXTRA); }),
    ]);
  }

  // Same DecompressionStream pattern faith-text.js uses for EEBO's
  // gzipped documents. Duplicated rather than shared: this file has no
  // other dependency on faith-text.js and script order on this page
  // does not guarantee one is loaded before the other.
  async function gunzip(response) {
    if (typeof window.DecompressionStream === "function") {
      const blob = await response.blob();
      const stream = blob.stream().pipeThrough(new window.DecompressionStream("gzip"));
      return JSON.parse(await new Response(stream).text());
    }
    // No DecompressionStream: if the host ever serves this with a real
    // Content-Encoding header the browser will have inflated it already.
    return response.json();
  }

  /* ── Merging the two sources ────────────────────────────────────ㅤ */

  // "Unknown author", "Editors", "Various authors" — the catalogue's
  // own way of saying a work has no one hand behind it. Checked
  // against the new source's own name field, the same test the old
  // build script ran against the PLD catalogue.
  const COLLECTIVE_NAMES = new Set(["unknownauthor", "editors", "variousauthors"]);
  function looksCollective(name) {
    const parts = String(name || "").split(";").map((p) => p.trim()).filter(Boolean);
    if (!parts.length) return true;
    return parts.every((p) => COLLECTIVE_NAMES.has(fold(p)) || /^unknown author\s*\(/i.test(p));
  }

  // The new file's citation instances (flattened out of `books`, a
  // dict of book-slug -> instance list) say which work and which
  // corpus code each citation sits in. Walked once to answer two
  // questions the profile summary does not: how many distinct works
  // actually cite something, and which traditions they come from.
  function tallyInstances(booksDict) {
    const works = new Set();
    const corpora = new Map();
    Object.values(booksDict || {}).forEach((list) => {
      (list || []).forEach((row) => {
        if (row.w) works.add(row.w);
        const code = row.sh || "";
        if (!code) return;
        let c = corpora.get(code);
        if (!c) { c = { works: new Set(), citations: 0 }; corpora.set(code, c); }
        if (row.w) c.works.add(row.w);
        c.citations += 1;
      });
    });
    return { works, corpora };
  }

  function buildDoc(oldData, extraData, shelfTotal) {
    const profile = extraData && extraData.profile;
    if (profile && (profile.books || []).length) {
      const citations = profile.books.reduce((s, b) => s + (b.n || 0), 0);
      if (!citations) return oldData ? { ...oldData, verseUnit: "works" } : null;

      const instances = tallyInstances(extraData.books);
      const books = profile.books.slice()
        .sort((a, b) => b.n - a.n)
        .slice(0, TOP_BOOKS_NEW)
        .map((b) => [b.book, b.n]);
      const verses = (profile.verses || []).slice()
        .sort((a, b) => b.n - a.n
          || String(a.book).localeCompare(String(b.book)) || a.c - b.c || a.v - b.v)
        .slice(0, TOP_VERSES_NEW)
        .map((v) => [v.book, v.c, v.v, v.n]);
      const corpora = [...instances.corpora.entries()]
        .map(([c, v]) => [c, v.works.size, v.citations])
        .sort((a, b) => b[2] - a[2]);
      const collective = !!(oldData && oldData.collective) || looksCollective(profile.a);

      const doc = {
        name: profile.a || (oldData && oldData.name) || "",
        citations,
        // Never lets the "citing" figure outrun the "held" figure the
        // page already knows from the shelf itself — the new source
        // can name a work in a tradition this page has not loaded, and
        // "89 of 42 works" is not a sentence to print.
        works: Math.max(shelfTotal || 0, instances.works.size),
        worksCiting: instances.works.size,
        books,
        booksTotal: profile.books.length,
        verses,
        verseUnit: "citations",
        corpora,
      };
      if (collective) doc.collective = true;
      else if (oldData && oldData.rank) { doc.rank = oldData.rank; doc.of = oldData.of; }
      if (oldData && oldData.dubia) doc.dubia = oldData.dubia;
      return doc;
    }
    // No usable new-source profile: the old index alone, unchanged
    // except for the flag that tells the verse list which unit it is
    // reading.
    return oldData ? { ...oldData, verseUnit: "works" } : null;
  }

  /* ── Mount ──────────────────────────────────────────────────────── */

  function mount(oldData, extraData, root, shelfTotal) {
    const d = buildDoc(oldData, extraData, shelfTotal);
    // No entry, or an entry with nothing in it, draws nothing. Silence
    // is the honest answer for an author neither source has read; an
    // empty chart would be a claim that they cited nothing.
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
      const readBtn = e.target.closest("[data-fp-read]");
      if (readBtn) { toggleVerseText(readBtn); return; }
      const verse = e.target.closest("[data-fp-ref]");
      if (verse && window.MOAuthorSearch && window.MOAuthorSearch.find) {
        window.MOAuthorSearch.find(verse.getAttribute("data-fp-ref"));
      }
    });
  }

  window.MOAuthorScripture = { load, loadExtra, mount };
}());
