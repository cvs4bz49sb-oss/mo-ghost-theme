/*
 * The Faith Received — Scripture and Topics indexes
 *
 * Every collection ships its own prebuilt index, in its own shape and
 * its own vocabulary. This merges them into two browsable indexes
 * spanning the whole reading room:
 *
 *   Scripture  ->  book  ->  chapter  ->  the works that cite it
 *   Topics     ->  locus ->  the works that treat it
 *
 * Like the Library browse, nothing renders a whole level: Genesis 1
 * alone is cited by hundreds of works, and Early English Books
 * contributes 449,002 citations.
 *
 * Coverage is honest, not implied. Where a collection has no index we
 * say so rather than letting its absence read as "nothing to find" —
 * see COVERAGE below and the note rendered at the head of each index.
 */

(function () {
  "use strict";

  if (!window.MOCorpora) return;

  const scriptureSection = document.querySelector('[data-faith-section="scripture"]');
  const topicsSection = document.querySelector('[data-faith-section="topics"]');
  const traditionsSection = document.querySelector('[data-faith-section="traditions"]');
  if (!scriptureSection && !topicsSection && !traditionsSection) return;

  const PAGE_SIZE = 120;

  // Topic vocabularies differ collection to collection — only 13 of
  // the Latin Library's 43 loci match Patrologia Latina's 41 by label.
  // These pairs are the same doctrine under different names; anything
  // not listed stays separate rather than being forced together.
  const TOPIC_CROSSWALK = {
    "sin & the fall": "sin",
    "scripture & exegesis": "scripture",
    "christ / incarnation": "christ / christology",
    "christology & incarnation": "christ / christology",
    "creation / hexaemeron": "creation",
    "angels & demons": "angels",
    "the eucharist": "the lord's supper",
    "prayer & liturgy": "prayer",
    "man / the soul": "man / anthropology",
    "the church & its unity": "the church",
  };

  // Patrologia Orientalis indexes by genre (Lives of Saints, Letters,
  // Homilies, Synaxaria), not by doctrine. Merging those into a list
  // of theological loci would be a category error, so they are kept
  // apart and labelled for what they are.
  const GENRE_LABELS = new Set([
    "martyrdom & acts", "lives of saints", "homilies & sermons",
    "liturgy & hymnography", "synaxaria & calendars",
    "church history & patriarchates", "letters",
    "canons & church order", "councils & creeds",
    "apologetic & polemic", "monasticism & asceticism",
  ]);

  // Canonical chapter counts, mirroring MAX_CHAPTERS in
  // scripts/build-faith-received.mjs. The Latin Library's index
  // carries chapter numbers no book has — Romans runs to 98, and 174
  // of 2,287 checked chapters are beyond their book's length, most
  // likely verse or column numbers that leaked into the chapter slot
  // upstream. EEBO's index is clean. Rather than print "Romans 98" and
  // lose the reader's trust in the whole index, drop the impossible
  // ones and count them.
  const MAX_CHAPTERS = {
    genesis: 50, exodus: 40, leviticus: 27, numbers: 36, deuteronomy: 34,
    joshua: 24, judges: 21, ruth: 4, "1 samuel": 31, "2 samuel": 24,
    "1 kings": 22, "2 kings": 25, "1 chronicles": 29, "2 chronicles": 36,
    ezra: 10, nehemiah: 13, esther: 10, job: 42, psalms: 150, proverbs: 31,
    ecclesiastes: 12, "song of solomon": 8, isaiah: 66, jeremiah: 52,
    lamentations: 5, ezekiel: 48, daniel: 12, hosea: 14, joel: 3, amos: 9,
    obadiah: 1, jonah: 4, micah: 7, nahum: 3, habakkuk: 3, zephaniah: 3,
    haggai: 2, zechariah: 14, malachi: 4, matthew: 28, mark: 16, luke: 24,
    john: 21, acts: 28, romans: 16, "1 corinthians": 16, "2 corinthians": 13,
    galatians: 6, ephesians: 6, philippians: 4, colossians: 4,
    "1 thessalonians": 5, "2 thessalonians": 3, "1 timothy": 6,
    "2 timothy": 4, titus: 3, philemon: 1, hebrews: 13, james: 5,
    "1 peter": 5, "2 peter": 3, "1 john": 5, "2 john": 1, "3 john": 1,
    jude: 1, revelation: 22,
  };
  let droppedRefs = 0;

  const norm = (s) => String(s || "").toLowerCase().trim();
  const canonical = (label) => TOPIC_CROSSWALK[norm(label)] || norm(label);

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  const titleCase = (s) => s.replace(/\b[a-z]/g, (m) => m.toUpperCase());

  // ── Data ──────────────────────────────────────────────────────

  // book -> chapter -> [{corpus, id, title, ref}]
  const scripture = new Map();
  // canonical topic -> { label, genre, entries: [{corpus, id, title, author}] }
  const topics = new Map();

  // Which collections actually contribute, so the pages can be honest
  // about what a reader is and isn't searching.
  const COVERAGE = { scripture: [], topics: [], missing: { scripture: [], topics: [] } };

  function addScripture(book, chapter, entry) {
    const lower = norm(book);
    const n = parseInt(chapter, 10);
    const max = MAX_CHAPTERS[lower];
    if (!n || n < 1 || (max && n > max)) { droppedRefs += 1; return; }
    const b = titleCase(lower);
    if (!scripture.has(b)) scripture.set(b, new Map());
    const chs = scripture.get(b);
    const key = String(n);
    if (!chs.has(key)) chs.set(key, []);
    chs.get(key).push(entry);
  }

  function addTopic(label, entry) {
    const key = canonical(label);
    if (!topics.has(key)) {
      topics.set(key, { label: titleCase(key), genre: GENRE_LABELS.has(norm(label)), entries: [] });
    }
    topics.get(key).entries.push(entry);
  }

  // ── Loaders, one per source shape ─────────────────────────────

  const BLOB = "https://0ss8v4l06kodnhp0.public.blob.vercel-storage.com";

  // { genesis: { "1": [[slug, page, excerpt], …] } }
  // The Latin Library's shipped scripture index mistakes a work's own
  // chapter heading for a biblical chapter. "Romans 98" is not Romans
  // 9:8 — its excerpt reads "CHAPTER XCVIII. — The Catholic doctrine
  // concerning justification…", so the XCVIII is Bellarmine's chapter,
  // matched against a nearby mention of Romans.
  //
  // 10,166 of its 12,659 entries (80.3%) open with "CHAPTER <roman>",
  // and in every one of those the roman numeral equals the chapter it
  // was filed under. Dropping impossible chapters only caught the
  // 2,497 where the work ran past the book's length; the rest sit in
  // range and read as real citations. Discard the whole signature
  // until the generated index replaces this source outright.
  const ROMAN = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
  function romanValue(s) {
    let total = 0;
    const t = String(s).toLowerCase();
    for (let i = 0; i < t.length; i += 1) {
      const cur = ROMAN[t[i]];
      const next = ROMAN[t[i + 1]];
      if (!cur) return 0;
      total += next && next > cur ? -cur : cur;
    }
    return total;
  }
  function isOwnChapterHeading(excerpt, chapter) {
    const m = String(excerpt || "").trim().match(/^CHAPTER\s+([IVXLCDM]+)\b/i);
    return !!m && romanValue(m[1]) === parseInt(chapter, 10);
  }

  function loadLatinScripture(catalogue) {
    // The index stores slugs; titles and authors come from the
    // catalogue, or a card would read
    // "adrian-peter-walenburg-tractatus-generales-de-controversiis".
    const byId = new Map((catalogue || []).map((w) => [String(w.id), w]));
    return fetch(`${BLOB}/v1/scripture.json`).then((r) => r.json()).then((d) => {
      let n = 0;
      Object.keys(d).forEach((book) => {
        Object.keys(d[book]).forEach((ch) => {
          d[book][ch].forEach((e) => {
            if (isOwnChapterHeading(e[2], ch)) { droppedRefs += 1; return; }
            const w = byId.get(String(e[0]));
            n += 1;
            addScripture(book, ch, {
              corpus: "tfr",
              id: e[0],
              title: w ? w.title : e[0],
              author: w ? w.author : "",
              page: e[1],
              excerpt: e[2] || "",
            });
          });
        });
      });
      COVERAGE.scripture.push({ id: "tfr", n });
    });
  }

  // { byref: { "Genesis 1": ["6", "231", …] } } — ids into the EEBO
  // catalogue, so titles are resolved from the loaded collection.
  function loadEeboScripture(catalogue) {
    return fetch("https://eebo-backup.vercel.app/data/scripture.json")
      .then((r) => r.json())
      .then((d) => {
        const byId = new Map(catalogue.map((w) => [String(w.id), w]));
        let n = 0;
        Object.keys(d.byref || {}).forEach((ref) => {
          const m = ref.match(/^(.*?)\s+(\d+)$/);
          if (!m) return;
          d.byref[ref].forEach((id) => {
            const w = byId.get(String(id));
            if (!w) return;
            n += 1;
            addScripture(m[1], m[2], { corpus: "eebo", id: w.id, title: w.title, author: w.author });
          });
        });
        COVERAGE.scripture.push({ id: "eebo", n });
      });
  }

  // { topics: [{ label, works: [{ slug|d, title|t|te, author|a }] }] }
  function loadTopics(url, corpusId) {
    return fetch(url).then((r) => r.json()).then((d) => {
      const list = d.topics || d;
      if (!Array.isArray(list)) return;
      let n = 0;
      list.forEach((t) => {
        (t.works || []).forEach((w) => {
          n += 1;
          addTopic(t.label || t.id, {
            corpus: corpusId,
            id: String(w.slug || w.d || w.id || ""),
            title: w.te || w.title || w.t || "",
            author: w.ae || w.author || w.a || "",
          });
        });
      });
      COVERAGE.topics.push({ id: corpusId, n });
    });
  }

  // ── Render helpers ────────────────────────────────────────────

  // `loc` is where the citation sits: a section index for the
  // collections whose readers count sections (EEBO, Augustine),
  // a page number for the Latin Library, whose sections
  // are page ranges. The reader resolves ?p= to the section holding
  // that page, so both land on the passage rather than the front page.
  function readerUrl(corpus, id, loc) {
    const c = window.MOCorpora.get(corpus);
    if (!c) return "/the-faith-received/";
    if (c.readable === false) return `/the-faith-received/?collection=${encodeURIComponent(corpus)}`;
    const q = corpus === "tfr" || corpus === "confessions" ? "" : `c=${encodeURIComponent(corpus)}&`;
    let url = `/the-faith-received/reader/?${q}w=${encodeURIComponent(id)}`;
    if (loc != null && loc !== "") {
      // The Latin Library and the confessions are paginated, so their
      // locator is a page number the reader resolves to the section
      // covering it. Everywhere else the locator IS the id of the
      // paragraph in the source, and the reader stamps that same id
      // onto the block it renders — so it is the anchor verbatim.
      // Wrapping it as "#section-<loc>" pointed every link at an
      // element that does not exist.
      url += corpus === "tfr" || corpus === "confessions"
        ? `&p=${encodeURIComponent(loc)}`
        : `#${String(loc).trim().replace(/\s+/g, "-")}`;
    }
    return url;
  }

  function coverageNote(kind) {
    const have = COVERAGE[kind].filter((c) => c.n).map((c) => {
      const m = window.MOCorpora.get(c.id);
      return m ? m.label : c.id;
    });
    const missing = COVERAGE.missing[kind].map((id) => {
      const m = window.MOCorpora.get(id);
      return m ? m.label : id;
    });
    if (!have.length) return "";
    let s = `Indexed from ${have.join(", ")}.`;
    if (missing.length) {
      s += ` Not yet indexed: ${missing.join(", ")}.`;
    }
    if (kind === "scripture" && droppedRefs) {
      s += ` ${droppedRefs.toLocaleString()} malformed references were dropped.`;
    }
    return s;
  }

  function chrome(host, opts) {
    host.querySelectorAll("[data-faith-index-chrome]").forEach((el) => el.remove());
    const head = document.createElement("div");
    head.className = "faith-browse-head";
    head.setAttribute("data-faith-index-chrome", "");
    const pager = opts.pager
      ? `<p class="faith-pager">` +
        `<button type="button" class="faith-pager-btn" data-faith-index-page="${opts.pager.page - 1}"${opts.pager.page <= 1 ? " disabled" : ""}>&larr; Previous</button>` +
        `<span class="faith-pager-count">Page ${opts.pager.page} of ${opts.pager.pages} · ${opts.pager.total.toLocaleString()} ${escapeHtml(opts.pager.label)}</span>` +
        `<button type="button" class="faith-pager-btn" data-faith-index-page="${opts.pager.page + 1}"${opts.pager.page >= opts.pager.pages ? " disabled" : ""}>Next &rarr;</button></p>`
      : "";
    head.innerHTML =
      `${opts.back
        ? `<button type="button" class="faith-author-back" data-faith-index-back="${escapeHtml(opts.back.to)}">` +
          `<span aria-hidden="true">&larr;</span> ${escapeHtml(opts.back.label)}</button>`
        : "" 
      }<h2 class="faith-author-name"><em>${escapeHtml(opts.title)}</em></h2>${ 
      opts.sub ? `<p class="faith-author-dates">${escapeHtml(opts.sub)}</p>` : "" 
      }${opts.note ? `<p class="faith-browse-note">${escapeHtml(opts.note)}</p>` : "" 
      }${pager}`;
    host.insertBefore(head, host.firstChild);
  }

  function grid(host) {
    let g = host.querySelector(".faith-card-grid[data-faith-index-grid]");
    if (!g) {
      g = document.createElement("div");
      g.className = "faith-card-grid";
      g.setAttribute("data-faith-index-grid", "");
      host.appendChild(g);
    }
    g.innerHTML = "";
    return g;
  }

  function workCard(e) {
    const c = window.MOCorpora.get(e.corpus);
    const pending = c && c.readable === false;
    return `<a class="faith-card" href="${escapeHtml(readerUrl(e.corpus, e.id))}">` +
      `<p class="faith-card-date">${escapeHtml(c ? c.label : e.corpus)}</p>` +
      `<h3 class="faith-card-title"><em>${escapeHtml(e.title || e.id)}</em></h3>${ 
      e.author ? `<p class="faith-card-author"><em>${escapeHtml(e.author)}</em></p>` : "" 
      }${e.excerpt ? `<p class="faith-card-desc">${escapeHtml(e.excerpt.slice(0, 160))}</p>` : "" 
      }<span class="faith-card-link">${pending ? "Browse" : "Read"} <span class="faith-card-arrow" aria-hidden="true">&rarr;</span></span></a>`;
  }

  function paged(list, page) {
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    const p = Math.min(Math.max(1, page || 1), pages);
    return { slice: list.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE), page: p, pages };
  }

  // ── Scripture views ───────────────────────────────────────────
  //
  // Canonical order, Old Testament and New held apart, every book
  // listed whether or not anything cites it — an index that hides its
  // empty shelves is lying about its coverage. A chapter's works and
  // their previews load only when that chapter opens.

  const OT = [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua",
    "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings",
    "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job",
    "Psalms", "Proverbs", "Ecclesiastes", "Song Of Solomon", "Isaiah",
    "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel",
    "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk",
    "Zephaniah", "Haggai", "Zechariah", "Malachi",
  ];
  // Kept with the Old Testament, which is where these writers found
  // them — the Latin corpus cites Ecclesiasticus as freely as Proverbs.
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

  let testament = "ot";
  const openChapters = new Set();
  const chapterCache = new Map();

  function scriptureHost() {
    return scriptureSection && scriptureSection.querySelector(".container");
  }

  function bookList() {
    return testament === "ot" ? OT.concat(DEUTERO) : NT;
  }

  function renderScripture() {
    const host = scriptureHost();
    if (!host) return;
    host.querySelectorAll("[data-faith-index-chrome], [data-faith-scripture-list], [data-faith-scripture-status]").forEach((n) => n.remove());
    const grid = host.querySelector(".faith-card-grid[data-faith-index-grid]");
    if (grid) grid.remove();

    // With the split index the page holds counts, not works, until a
    // chapter is opened — so report what is actually known here rather
    // than a number that would be wrong.
    let entries = 0;
    let chapters = 0;
    scripture.forEach((chs) => chs.forEach((l) => { entries += l.length; chapters += 1; }));

    chrome(host, {
      title: "Scripture",
      sub: `${entries.toLocaleString()} references across ${chapters.toLocaleString()} chapters`,
      note: coverageNote("scripture"),
    });

    const wrap = document.createElement("div");
    wrap.setAttribute("data-faith-scripture-list", "");

    const toggle = document.createElement("div");
    toggle.className = "faith-scripture-toggle";
    toggle.setAttribute("role", "tablist");
    toggle.innerHTML = ["ot", "nt"].map((t) =>
      `<button type="button" class="faith-scripture-toggle-btn${t === testament ? " is-active" : ""}" ` +
      `data-faith-testament="${t}" role="tab" aria-selected="${t === testament}">` +
      `${t === "ot" ? "Old Testament" : "New Testament"}</button>`
    ).join("");
    wrap.appendChild(toggle);

    const list = document.createElement("div");
    list.className = "faith-scripture-grid";
    bookList().forEach((book) => {
      const chs = scripture.get(book) || new Map();
      let total = 0;
      chs.forEach((l) => { total += l.length; });
      list.appendChild(bookRow(book, chs, total));
    });
    wrap.appendChild(list);
    host.appendChild(wrap);
  }

  function bookRow(book, chs, total) {
    const details = document.createElement("details");
    details.className = `faith-scripture-book-details${total ? "" : " is-empty"}`;
    const summary = document.createElement("summary");
    summary.className = "faith-scripture-book";
    summary.innerHTML =
      `<span class="faith-scripture-book-name">${escapeHtml(book)}</span>` +
      `<span class="faith-scripture-book-count">${total ? `${total.toLocaleString()} reference${total === 1 ? "" : "s"}` : "none yet"}</span>` +
      `<span class="faith-chev faith-scripture-chev" aria-hidden="true"></span>`;
    details.appendChild(summary);
    if (!total) return details;

    const body = document.createElement("div");
    body.className = "faith-scripture-book-body";
    [...chs.keys()]
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
      .forEach((ch) => body.appendChild(chapterRow(book, ch, chs.get(ch))));
    details.appendChild(body);
    return details;
  }

  function chapterRow(book, ch, entries) {
    const key = `${book} ${ch}`;
    const details = document.createElement("details");
    details.className = "faith-scripture-chapter-details";
    details.id = `ref-${book.replace(/\s+/g, "-").toLowerCase()}-${ch}`;
    const summary = document.createElement("summary");
    summary.className = "faith-scripture-chapter";
    summary.innerHTML =
      `<span class="faith-scripture-chapter-name">${escapeHtml(key)}</span>` +
      `<span class="faith-scripture-chapter-count">${entries.length.toLocaleString()} work${entries.length === 1 ? "" : "s"}</span>` +
      `<span class="faith-chev faith-scripture-chev" aria-hidden="true"></span>`;
    details.appendChild(summary);

    const body = document.createElement("div");
    body.className = "faith-scripture-refs-body";
    body.innerHTML = `<p class="faith-section-loading">Loading references&hellip;</p>`;
    details.appendChild(body);

    details.addEventListener("toggle", () => {
      if (!details.open || details.dataset.filled) return;
      details.dataset.filled = "1";
      // Placeholders carry counts only; the works, their excerpts and
      // their locations come from the per-chapter file.
      if (entries.length && entries[0].pending) {
        loadChapter(book, ch).then((rows) => {
          if (!rows || !rows.length) {
            body.innerHTML = `<p class="faith-section-loading">References unavailable.</p>`;
            return;
          }
          fillChapter(body, book, ch, rows);
        });
        return;
      }
      fillChapter(body, book, ch, entries);
    });
    return details;
  }

  // 120 at a time: Romans 9 alone is cited by 4,509 works.
  function fillChapter(body, book, ch, entries, page) {
    const p = page || 1;
    const pages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
    const slice = entries.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE);
    body.innerHTML = "";
    const ol = document.createElement("ol");
    ol.className = "faith-scripture-refs";
    slice.forEach((e) => ol.appendChild(refItem(e)));
    body.appendChild(ol);
    if (pages > 1) {
      const nav = document.createElement("p");
      nav.className = "faith-pager";
      nav.innerHTML =
        `<button type="button" class="faith-pager-btn" data-ref-page="${p - 1}"${p <= 1 ? " disabled" : ""}>&larr; Previous</button>` +
        `<span class="faith-pager-count">Page ${p} of ${pages} · ${entries.length.toLocaleString()} works</span>` +
        `<button type="button" class="faith-pager-btn" data-ref-page="${p + 1}"${p >= pages ? " disabled" : ""}>Next &rarr;</button>`;
      nav.querySelectorAll("[data-ref-page]").forEach((b) => {
        b.addEventListener("click", (ev) => {
          ev.preventDefault();
          if (b.disabled) return;
          fillChapter(body, book, ch, entries, parseInt(b.getAttribute("data-ref-page"), 10));
        });
      });
      body.appendChild(nav);
    }
  }

  // One reference: who cites it, and the words around the citation, so
  // the reader can judge before opening a 900-page folio.
  function refItem(e) {
    const c = window.MOCorpora.get(e.corpus);
    const li = document.createElement("li");
    li.className = "faith-scripture-ref";
    const href = readerUrl(e.corpus, e.id, e.loc);
    li.innerHTML =
      `<a class="faith-scripture-ref-link" href="${escapeHtml(href)}">` +
      `<span class="faith-scripture-ref-source">${escapeHtml(c ? c.label : e.corpus)}</span>` +
      `<span class="faith-scripture-ref-title">${escapeHtml(e.title || String(e.id))}</span>${ 
      e.author ? `<span class="faith-scripture-ref-author">${escapeHtml(e.author)}</span>` : "" 
      }${e.excerpt ? `<span class="faith-scripture-ref-excerpt">${escapeHtml(e.excerpt)}</span>` : "" 
      }${e.times > 1 ? `<span class="faith-scripture-ref-times">cited ${e.times} times</span>` : "" 
      }</a>`;
    return li;
  }

  // ── Topics views ──────────────────────────────────────────────

  let topicState = { view: "topics", topic: null, page: 1 };

  function renderTopics() {
    const host = topicsSection && topicsSection.querySelector(".container");
    if (!host) return;

    if (topicState.view === "topics") {
      const list = [...topics.entries()]
        .map(([key, t]) => ({ key, ...t, n: t.entries.length }))
        .filter((t) => t.n)
        .sort((a, b) => (a.genre - b.genre) || b.n - a.n);
      chrome(host, {
        title: "Topics",
        sub: `${list.length} headings · ${list.reduce((a, t) => a + t.n, 0).toLocaleString()} entries`,
        note: coverageNote("topics"),
      });
      grid(host).insertAdjacentHTML("beforeend", list.map((t) =>
        `<a class="faith-card" href="#" data-faith-topic="${escapeHtml(t.key)}">` +
        `<p class="faith-card-date">${t.genre ? "Genre" : "Doctrine"}</p>` +
        `<h3 class="faith-card-title"><em>${escapeHtml(t.label)}</em></h3>` +
        `<p class="faith-card-desc">${t.n.toLocaleString()} work${t.n === 1 ? "" : "s"}</p>` +
        `<span class="faith-card-link">Open <span class="faith-card-arrow" aria-hidden="true">&rarr;</span></span></a>`
      ).join(""));
      return;
    }

    const t = topics.get(topicState.topic);
    if (!t) { topicState = { view: "topics" }; return renderTopics(); }
    const { slice, page, pages } = paged(t.entries, topicState.page);
    chrome(host, {
      back: { to: "topics", label: "All topics" },
      title: t.label,
      sub: `${t.entries.length.toLocaleString()} work${t.entries.length === 1 ? "" : "s"}`,
      pager: pages > 1 ? { page, pages, total: t.entries.length, label: "works" } : null,
    });
    grid(host).insertAdjacentHTML("beforeend", slice.map(workCard).join(""));
  }

  // ── Traditions ────────────────────────────────────────────────
  //
  // Grouped, not flat: "Reformed" spans the Latin Library and the
  // confessions, but "Greek Fathers" is what a whole collection is.
  // Ordered roughly chronologically — the fathers, the schoolmen, the
  // Reformation and its opponents — rather than by size, which would
  // put Migne's volume count ahead of the Reformation.
  const TRADITION_ORDER = [
    "Classical", "Patristic", "Greek Fathers", "Latin Fathers",
    "Eastern Fathers", "Medieval", "Medieval Scholastic",
    "Humanism and Law", "Roman Catholic", "Lutheran", "Reformed",
    "Anglican", "Puritan",
  ];

  const traditions = new Map();
  let traditionState = { view: "list", tradition: null, page: 1 };

  function addTradition(name, entry) {
    if (!name) return;
    if (!traditions.has(name)) traditions.set(name, []);
    traditions.get(name).push(entry);
  }

  function traditionsHost() {
    const sec = document.querySelector('[data-faith-section="traditions"]');
    return sec ? (sec.querySelector(".container") || sec) : null;
  }

  function renderTraditions() {
    const host = traditionsHost();
    if (!host) return;
    host.querySelectorAll(
      "[data-faith-index-chrome], [data-faith-trad-grid], [data-faith-traditions-status]"
    ).forEach((n) => n.remove());

    const grid = document.createElement("div");
    grid.className = "faith-card-grid";
    grid.setAttribute("data-faith-trad-grid", "");

    if (traditionState.view === "list") {
      const ordered = TRADITION_ORDER
        .filter((t) => traditions.has(t))
        .concat([...traditions.keys()].filter((t) => TRADITION_ORDER.indexOf(t) < 0).sort());
      const total = ordered.reduce((a, t) => a + traditions.get(t).length, 0);
      chrome(host, {
        title: "Traditions",
        sub: `${ordered.length} traditions · ${total.toLocaleString()} works`,
        note: unassignedNote(),
      });
      grid.insertAdjacentHTML("beforeend", ordered.map((t) => {
        const n = traditions.get(t).length;
        const froms = [...new Set(traditions.get(t).map((w) => w.corpus))]
          .map((id) => (window.MOCorpora.get(id) || {}).label)
          .filter(Boolean);
        return `<a class="faith-card" href="#" data-faith-trad="${escapeHtml(t)}">` +
          `<p class="faith-card-date">${escapeHtml(froms.slice(0, 2).join(" · "))}${froms.length > 2 ? " · …" : ""}</p>` +
          `<h3 class="faith-card-title"><em>${escapeHtml(t)}</em></h3>` +
          `<p class="faith-card-desc">${n.toLocaleString()} work${n === 1 ? "" : "s"}</p>` +
          `<span class="faith-card-link">Open <span class="faith-card-arrow" aria-hidden="true">&rarr;</span></span></a>`;
      }).join(""));
      host.appendChild(grid);
      return;
    }

    const list = traditions.get(traditionState.tradition) || [];
    const { slice, page, pages } = paged(list, traditionState.page);
    chrome(host, {
      back: { to: "traditions", label: "All traditions" },
      title: traditionState.tradition,
      sub: `${list.length.toLocaleString()} work${list.length === 1 ? "" : "s"}`,
      pager: pages > 1 ? { page, pages, total: list.length, label: "works" } : null,
    });
    grid.insertAdjacentHTML("beforeend", slice.map(workCard).join(""));
    host.appendChild(grid);
  }

  // Early English Books carries no per-work tradition field, only
  // curated author lists, so most of it stays unassigned even after
  // the theological filter. Say so rather than let the count read as
  // a gap in the index.
  function unassignedNote() {
    const c = window.MOCorpora.get("eebo");
    return c
      ? "Early English Books is catalogued by author rather than tradition; " +
        "its Puritan and Anglican writers are indexed here, and the rest — " +
        "anonymous, pre-Reformation, or unplaced — is left unassigned."
      : "";
  }

  // The citation resolver hands us a parsed reference; open the book
  // and chapter it names and scroll to it.
  window.addEventListener("faith:goto-scripture", (e) => {
    const d = e.detail || {};
    if (!d.book) return;
    testament = (scripture.has(d.book) && NT.indexOf(d.book) >= 0) ? "nt" : "ot";
    renderScripture();
    window.requestAnimationFrame(() => {
      const host = scriptureHost();
      if (!host) return;
      const book = [...host.querySelectorAll(".faith-scripture-book-details")]
        .find((b) => b.querySelector(".faith-scripture-book-name")?.textContent.trim() === d.book);
      if (!book) return;
      book.open = true;
      const ch = [...book.querySelectorAll(".faith-scripture-chapter-details")]
        .find((c) => c.querySelector(".faith-scripture-chapter-name")?.textContent.trim() === `${d.book} ${d.chapter}`);
      if (!ch) { book.scrollIntoView({ block: "start" }); return; }
      ch.open = true;
      ch.scrollIntoView({ block: "start" });
    });
  });

  // ── Events ────────────────────────────────────────────────────

  document.addEventListener("click", (e) => {
    const trad = e.target.closest("[data-faith-trad]");
    if (trad) {
      e.preventDefault();
      traditionState = { view: "tradition", tradition: trad.getAttribute("data-faith-trad"), page: 1 };
      return renderTraditions();
    }
    const test = e.target.closest("[data-faith-testament]");
    if (test) {
      e.preventDefault();
      testament = test.getAttribute("data-faith-testament");
      return renderScripture();
    }
    const topic = e.target.closest("[data-faith-topic]");
    if (topic) {
      e.preventDefault();
      topicState = { view: "topic", topic: topic.getAttribute("data-faith-topic"), page: 1 };
      return renderTopics();
    }
    const back = e.target.closest("[data-faith-index-back]");
    if (back) {
      e.preventDefault();
      const to = back.getAttribute("data-faith-index-back");
      if (to === "topics") { topicState = { view: "topics" }; return renderTopics(); }
      if (to === "traditions") { traditionState = { view: "list" }; return renderTraditions(); }
    }
    const pg = e.target.closest("[data-faith-index-page]");
    if (pg && !pg.disabled) {
      e.preventDefault();
      const n = parseInt(pg.getAttribute("data-faith-index-page"), 10) || 1;
      if (pg.closest('[data-faith-section="traditions"]')) {
        traditionState.page = n;
        renderTraditions();
      } else {
        topicState.page = n;
        renderTopics();
      }
    }
  });

  // ── Boot ──────────────────────────────────────────────────────

  // Collections with no index of their own. Named on the page so their
  // absence reads as "not yet indexed" rather than "nothing to find".
  ["eebo", "augustine", "pg"].forEach((id) => COVERAGE.missing.topics.push(id));
  ["augustine", "pg", "po", "pld"].forEach((id) => COVERAGE.missing.scripture.push(id));

  // A generated index, built by scripts/build-scripture-index.mjs by
  // walking the actual text, supersedes the partial indexes the source
  // sites ship. It is far too large for the theme zip, so it lives on
  // the CDN and this points at it once uploaded — set the meta tag and
  // the sources below stop being used.
  const genMeta = document.querySelector('meta[name="tfr-scripture-index"]');
  const GENERATED = genMeta && genMeta.getAttribute("content");

  // The summary is { book: { chapter: worksCiting } } and is small.
  // A chapter's works, their excerpts and their locations arrive from
  // a per-chapter file only when that chapter is opened — the merged
  // single file was 49.6 MB and every visitor paid for it before
  // seeing a book list.
  let generatedBase = null;

  function loadGenerated(url) {
    return fetch(url).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    }).then((summary) => {
      generatedBase = url.replace(/scripture-books\.json$/, "scripture");
      Object.keys(summary).forEach((book) => {
        Object.keys(summary[book]).forEach((ch) => {
          // Placeholder entries: enough to render counts and chapter
          // rows. Replaced with the real works when opened.
          const n = summary[book][ch];
          for (let i = 0; i < n; i += 1) addScripture(book, ch, { pending: true, times: 1 });
        });
      });
      COVERAGE.scripture.push({ id: "generated", n: 1 });
      COVERAGE.missing.scripture.length = 0;
    });
  }

  // Fetch one chapter's references and swap them in for the
  // placeholders.
  function loadChapter(book, ch) {
    const key = `${book}/${ch}`;
    if (chapterCache.has(key)) return chapterCache.get(key);
    if (!generatedBase) return Promise.resolve(null);
    const slug = book.toLowerCase();
    const p = fetch(`${generatedBase}/${encodeURIComponent(slug)}/${encodeURIComponent(ch)}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((rows) => Promise.all(
        ["tfr", "eebo", "augustine", "confessions"].map((id) =>
          window.MOCorpora.load(id).then((list) => [id, new Map(list.map((w) => [String(w.id), w]))]).catch(() => [id, new Map()])
        )
      ).then((pairs) => {
        const cats = new Map(pairs);
        return rows.map((row) => {
          const [corpus, id, times, loc, excerpt] = row;
          const w = (cats.get(corpus) || new Map()).get(String(id));
          return {
            corpus,
            id,
            times: times || 1,
            loc: loc == null ? null : loc,
            excerpt: excerpt || "",
            title: w ? w.title : String(id),
            author: w ? w.author : "",
          };
        });
      }))
      .catch(() => null);
    chapterCache.set(key, p);
    return p;
  }

  function loadSourceScripture() {
    return Promise.all([
      window.MOCorpora.load("tfr").then((cat) => loadLatinScripture(cat)).catch(() => {}),
      window.MOCorpora.load("eebo").then((cat) => loadEeboScripture(cat)).catch(() => {}),
    ]);
  }

  // If the generated index is configured but unreachable — worker not
  // deployed yet, bucket empty, a bad deploy — fall back to the source
  // indexes rather than showing an empty Scripture tab.
  const scriptureSources = GENERATED
    ? [loadGenerated(GENERATED).catch(() => {
      scripture.clear();
      COVERAGE.scripture.length = 0;
      return loadSourceScripture();
    })]
    : [loadSourceScripture()];

  Promise.all([
    ...scriptureSources,
    loadTopics(`${BLOB}/v1/topics.json`, "tfr").catch(() => {}),
    loadTopics("https://pld-patrologia-latina.vercel.app/data/topics.json", "pld").catch(() => {}),
    loadTopics("https://patrologia-orientalis.vercel.app/data/topics.json", "po").catch(() => {}),
  ]).then(() => {
    renderScripture();
    renderTopics();
  });

  // Traditions need no prebuilt index — every catalogue either carries
  // the field or the collection is a tradition in itself. That is why
  // this one covers all 37,223 works where scripture and topics do not.
  Promise.all(window.MOCorpora.all.map((c) =>
    window.MOCorpora.load(c.id)
      .then((works) => works.forEach((w) => addTradition(w.tradition, w)))
      .catch(() => {})
  )).then(renderTraditions);
})();
