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
  if (!scriptureSection && !topicsSection) return;

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

  function readerUrl(corpus, id) {
    const c = window.MOCorpora.get(corpus);
    if (!c) return "/the-faith-received/";
    if (c.readable === false) return `/the-faith-received/?collection=${encodeURIComponent(corpus)}`;
    const q = corpus === "tfr" || corpus === "confessions" ? "" : `c=${encodeURIComponent(corpus)}&`;
    return `/the-faith-received/reader/?${q}w=${encodeURIComponent(id)}`;
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

  let scriptureState = { view: "books", book: null, chapter: null, page: 1 };

  function renderScripture() {
    const host = scriptureSection && scriptureSection.querySelector(".container");
    if (!host) return;
    const s = scriptureState;

    if (s.view === "books") {
      const books = [...scripture.entries()]
        .map(([b, chs]) => {
          let n = 0;
          chs.forEach((l) => { n += l.length; });
          return { book: b, chapters: chs.size, refs: n };
        })
        .filter((b) => b.refs)
        .sort((a, b) => b.refs - a.refs);
      chrome(host, {
        title: "Scripture",
        sub: `${books.length} books · ${books.reduce((a, b) => a + b.refs, 0).toLocaleString()} citations`,
        note: coverageNote("scripture"),
      });
      grid(host).insertAdjacentHTML("beforeend", books.map((b) =>
        `<a class="faith-card" href="#" data-faith-book="${escapeHtml(b.book)}">` +
        `<p class="faith-card-date">${b.chapters} chapter${b.chapters === 1 ? "" : "s"}</p>` +
        `<h3 class="faith-card-title"><em>${escapeHtml(b.book)}</em></h3>` +
        `<p class="faith-card-desc">${b.refs.toLocaleString()} citation${b.refs === 1 ? "" : "s"}</p>` +
        `<span class="faith-card-link">Open <span class="faith-card-arrow" aria-hidden="true">&rarr;</span></span></a>`
      ).join(""));
      return;
    }

    const chs = scripture.get(s.book);
    if (!chs) { scriptureState = { view: "books" }; return renderScripture(); }

    if (s.view === "chapters") {
      const list = [...chs.entries()]
        .map(([ch, l]) => ({ ch, n: l.length }))
        .sort((a, b) => (parseInt(a.ch, 10) || 0) - (parseInt(b.ch, 10) || 0));
      chrome(host, {
        back: { to: "books", label: "All books" },
        title: s.book,
        sub: `${list.length} chapters · ${list.reduce((a, c) => a + c.n, 0).toLocaleString()} citations`,
      });
      grid(host).insertAdjacentHTML("beforeend", list.map((c) =>
        `<a class="faith-card" href="#" data-faith-chapter="${escapeHtml(c.ch)}">` +
        `<h3 class="faith-card-title"><em>${escapeHtml(s.book)} ${escapeHtml(c.ch)}</em></h3>` +
        `<p class="faith-card-desc">${c.n.toLocaleString()} citation${c.n === 1 ? "" : "s"}</p>` +
        `<span class="faith-card-link">Open <span class="faith-card-arrow" aria-hidden="true">&rarr;</span></span></a>`
      ).join(""));
      return;
    }

    const entries = chs.get(String(s.chapter)) || [];
    const { slice, page, pages } = paged(entries, s.page);
    chrome(host, {
      back: { to: "chapters", label: s.book },
      title: `${s.book} ${s.chapter}`,
      sub: `${entries.length.toLocaleString()} work${entries.length === 1 ? "" : "s"} cite this chapter`,
      pager: pages > 1 ? { page, pages, total: entries.length, label: "citations" } : null,
    });
    grid(host).insertAdjacentHTML("beforeend", slice.map(workCard).join(""));
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

  // ── Events ────────────────────────────────────────────────────

  document.addEventListener("click", (e) => {
    const book = e.target.closest("[data-faith-book]");
    if (book) {
      e.preventDefault();
      scriptureState = { view: "chapters", book: book.getAttribute("data-faith-book"), page: 1 };
      return renderScripture();
    }
    const ch = e.target.closest("[data-faith-chapter]");
    if (ch) {
      e.preventDefault();
      scriptureState.view = "verses";
      scriptureState.chapter = ch.getAttribute("data-faith-chapter");
      scriptureState.page = 1;
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
      if (to === "books") { scriptureState = { view: "books" }; return renderScripture(); }
      if (to === "chapters") { scriptureState.view = "chapters"; return renderScripture(); }
      if (to === "topics") { topicState = { view: "topics" }; return renderTopics(); }
    }
    const pg = e.target.closest("[data-faith-index-page]");
    if (pg && !pg.disabled) {
      e.preventDefault();
      const n = parseInt(pg.getAttribute("data-faith-index-page"), 10) || 1;
      if (pg.closest('[data-faith-section="scripture"]')) {
        scriptureState.page = n; renderScripture();
      } else {
        topicState.page = n; renderTopics();
      }
    }
  });

  // ── Boot ──────────────────────────────────────────────────────

  // Collections with no index of their own. Named on the page so their
  // absence reads as "not yet indexed" rather than "nothing to find".
  ["eebo", "aquinas", "augustine", "pangrammata", "pg"].forEach((id) => COVERAGE.missing.topics.push(id));
  ["aquinas", "augustine", "pangrammata", "pg", "po", "pld"].forEach((id) => COVERAGE.missing.scripture.push(id));

  // A generated index, built by scripts/build-scripture-index.mjs by
  // walking the actual text, supersedes the partial indexes the source
  // sites ship. It is far too large for the theme zip, so it lives on
  // the CDN and this points at it once uploaded — set the meta tag and
  // the sources below stop being used.
  const genMeta = document.querySelector('meta[name="tfr-scripture-index"]');
  const GENERATED = genMeta && genMeta.getAttribute("content");

  function loadGenerated(url) {
    return fetch(url).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    }).then((d) => {
      const cats = new Map();
      return Promise.all(["tfr", "eebo", "aquinas", "augustine", "pangrammata"]
        .map((id) => window.MOCorpora.load(id)
          .then((list) => cats.set(id, new Map(list.map((w) => [String(w.id), w]))))
          .catch(() => {})))
        .then(() => {
          const counts = {};
          Object.keys(d).forEach((book) => {
            Object.keys(d[book]).forEach((ch) => {
              d[book][ch].forEach((row) => {
                const [corpus, id] = row;
                const w = (cats.get(corpus) || new Map()).get(String(id));
                counts[corpus] = (counts[corpus] || 0) + 1;
                addScripture(book, ch, {
                  corpus,
                  id,
                  title: w ? w.title : String(id),
                  author: w ? w.author : "",
                });
              });
            });
          });
          Object.keys(counts).forEach((id) => COVERAGE.scripture.push({ id, n: counts[id] }));
          COVERAGE.missing.scripture.length = 0;
        });
    });
  }

  const scriptureSources = GENERATED
    ? [loadGenerated(GENERATED).catch(() => {})]
    : [
      window.MOCorpora.load("tfr").then((cat) => loadLatinScripture(cat)).catch(() => {}),
      window.MOCorpora.load("eebo").then((cat) => loadEeboScripture(cat)).catch(() => {}),
    ];

  Promise.all([
    ...scriptureSources,
    loadTopics(`${BLOB}/v1/topics.json`, "tfr").catch(() => {}),
    loadTopics("https://pld-patrologia-latina.vercel.app/data/topics.json", "pld").catch(() => {}),
    loadTopics("https://patrologia-orientalis.vercel.app/data/topics.json", "po").catch(() => {}),
  ]).then(() => {
    renderScripture();
    renderTopics();
  });
})();
