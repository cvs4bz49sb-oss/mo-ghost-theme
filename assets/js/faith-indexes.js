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

  // The loci in the order a systematic theology takes them, rather
  // than by how many works happen to touch each one. Sorting by count
  // put Sin first and Prolegomena two thirds of the way down, which is
  // no order at all: it read as a tag cloud. This is the shape of the
  // discipline, from method and Scripture through God, creation, sin,
  // Christ, salvation, the church and the Christian life to the last
  // things. Anything not listed falls to the end, largest first.
  const TOPIC_ORDER = [
    "prolegomena / theological method", "scripture", "religion / true worship",
    "the existence of god", "god", "the divine attributes & the essence of god",
    "divine simplicity", "the eternity of god", "divine omnipresence & immensity",
    "omnipotence & absolute power", "god's knowledge & middle knowledge",
    "the will of god", "the trinity", "the divine processions & emanations",
    "subsistent relations & the persons", "the filioque & the procession of the spirit",
    "the holy spirit",
    "predestination", "covenant",
    "creation", "providence", "angels", "man / anthropology",
    "sin", "free will",
    "christ / christology", "the gospel",
    "grace", "faith", "justification", "sanctification", "christian liberty",
    "the church", "sacraments", "baptism", "the lord's supper",
    "the law", "virtues / moral theology", "prayer", "the civil magistrate",
    "resurrection", "eternal life", "last things",
  ];

  // Prefix match, because the labels are long and the sources abbreviate
  // them inconsistently ("Prolegomena / Theological Method" against
  // "Prolegomena / Theological").
  function topicRank(label) {
    const l = String(label || "").toLowerCase().trim();
    for (let i = 0; i < TOPIC_ORDER.length; i += 1) {
      const t = TOPIC_ORDER[i];
      if (l === t || l.startsWith(t) || t.startsWith(l)) return i;
    }
    return TOPIC_ORDER.length + 1;
  }

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

  // \b matches after an apostrophe, so a naive title case produced
  // "God'S Knowledge", and capitalising every word gave "The Existence
  // Of God". Small words stay down unless they open the label.
  const TITLE_DOWN = new Set([
    "of", "the", "and", "in", "to", "for", "or", "a", "an", "on", "by", "from",
  ]);
  const titleCase = (s) => String(s || "")
    .split(/(\s+)/)
    .map((word, i) => {
      if (!word.trim()) return word;
      const lower = word.toLowerCase();
      if (i > 0 && TITLE_DOWN.has(lower)) return lower;
      return lower.replace(/^[a-z]|(?<=[^a-z'])[a-z]/g, (m) => m.toUpperCase());
    })
    .join("");

  // ── Data ──────────────────────────────────────────────────────

  // book -> chapter -> [{corpus, id, title, ref}]
  const scripture = new Map();
  // canonical topic -> { label, genre, entries: [{corpus, id, title, author}] }
  const topics = new Map();

  // Which collections actually contribute, so the pages can be honest
  // about what a reader is and isn't searching.
  const COVERAGE = { scripture: [], topics: [], missing: { scripture: [], topics: [] } };

  // The same derivation the reading rooms use, so a work's century is
  // the same number in both places. Cached on the work.
  function centuryOf(w) {
    if (!w) return 0;
    if (w._c === undefined) {
      w._c = window.MOCentury ? window.MOCentury.of(w) : 0;
    }
    return w._c || 0;
  }

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
              // `loc`, not `page`. refItem reads loc, so storing it
              // under another name dropped the page from all 12,659 of
              // these links and landed every one at the top of the
              // work instead of at the citation.
              loc: e[1],
              tradition: w ? w.tradition || "" : "",
              century: w ? centuryOf(w) : 0,
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
            addScripture(m[1], m[2], {
              corpus: "eebo", id: w.id, title: w.title, author: w.author,
              tradition: w.tradition || "", century: centuryOf(w),
            });
          });
        });
        COVERAGE.scripture.push({ id: "eebo", n });
      });
  }

  // { topics: [{ label, works: [{ slug|d, title|t|te, author|a }] }] }
  function loadTopics(url, corpusId, catalogue) {
    // Joined against the collection's own catalogue for the same reason
    // the scripture loaders are: the topic files carry an author and a
    // tradition but no date, so without this the Century filter has
    // nothing to offer and quietly does not appear.
    const byId = new Map((catalogue || []).map((w) => [String(w.id), w]));
    return fetch(url).then((r) => r.json()).then((d) => {
      const list = d.topics || d;
      if (!Array.isArray(list)) return;
      let n = 0;
      list.forEach((t) => {
        (t.works || []).forEach((w) => {
          n += 1;
          // `secs` is where in the work the topic is actually
          // treated: a page and the section's own heading. Without it
          // a topic link opens a nine-hundred-page folio at page one
          // and leaves the reader to find the passage themselves.
          // Three sources, three names for the same thing. Patrologia
          // Latina ships `divs`, a list of [anchor, heading] pairs, and
          // reading only `secs` threw away the section for all 3,697 of
          // its works: every one of them opened at the front of the
          // volume. Patrologia Orientalis ships no sections at all, so
          // its 231 works legitimately open whole.
          const raw = w.secs || w.sections || w.divs || [];
          const secs = raw
            .map((x) => (Array.isArray(x)
              ? { p: x[0], t: x[1] || "" }
              : { p: x.p != null ? x.p : x.page, t: x.t || x.title || "" }))
            .filter((x) => x.p != null && x.p !== "");
          const id = String(w.slug || w.d || w.id || "");
          const cat = byId.get(id);
          addTopic(t.label || t.id, {
            corpus: corpusId,
            id,
            title: w.te || w.title || w.t || "",
            author: w.ae || w.author || w.a || "",
            tradition: w.tradition || (cat ? cat.tradition || "" : ""),
            // Patrologia Latina and Orientalis state the century
            // outright; the Latin Library does not, so it comes from
            // the catalogue entry the same way it does everywhere else
            // in the library, and a work reads as the same century here
            // as it does on the shelf.
            century: w.c || (cat ? centuryOf(cat) : 0),
            secs,
            // The card opens at the first relevant section rather than
            // at the front of the book.
            loc: secs.length ? secs[0].p : null,
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
  function readerUrl(corpus, id, loc, opts) {
    const c = window.MOCorpora.get(corpus);
    if (!c) return "/the-faith-received/";
    if (c.readable === false) return `/the-faith-received/?collection=${encodeURIComponent(corpus)}`;
    const q = corpus === "tfr" || corpus === "confessions" ? "" : `c=${encodeURIComponent(corpus)}&`;
    let url = `/the-faith-received/reader/?${q}w=${encodeURIComponent(id)}`;
    // The fragment has to be last, so it is held back rather than
    // appended in place: "?w=x#sec&ref=Romans+8" would make the
    // reference part of the fragment and the reader would never see it.
    let hash = "";
    if (loc != null && loc !== "") {
      // The Latin Library and the confessions are paginated, so their
      // locator is a page number the reader resolves to the section
      // covering it. Everywhere else the locator IS the id of the
      // paragraph in the source, and the reader stamps that same id
      // onto the block it renders — so it is the anchor verbatim.
      // Wrapping it as "#section-<loc>" pointed every link at an
      // element that does not exist.
      if (corpus === "tfr" || corpus === "confessions") {
        url += `&p=${encodeURIComponent(loc)}`;
      } else {
        hash = `#${String(loc).trim().replace(/\s+/g, "-")}`;
      }
    }
    const o = opts || {};
    // Carried even when there is a page, because a page is a folio side
    // and the citation is one line on it.
    if (o.ref) url += `&ref=${encodeURIComponent(o.ref)}`;
    // Patrologia Latina numbers its sections in the topic file as
    // <work>_<section>_<n>, and n indexes nothing the reader holds: for
    // Lactantius it is two off the heading it names. Rather than guess
    // at the offset, send the heading itself, which that file gives
    // verbatim, and let the reader match it.
    if (o.h) url += `&h=${encodeURIComponent(String(o.h).slice(0, 120))}`;
    return url + hash;
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


  // 1 … 5 6 [7] 8 9 … 42
  //
  // Previous and Next alone make a reader who wants page nine press
  // Next seven times, and give no way at all to reach the end. The
  // window is the first page, the last, and two either side of where
  // the reader is; the gaps are elided rather than printing forty
  // numbers across a phone.
  function pageWindow(page, pages) {
    const out = [];
    const push = (n) => { if (out[out.length - 1] !== n) out.push(n); };
    push(1);
    if (page - 2 > 2) out.push(null);
    for (let n = Math.max(2, page - 2); n <= Math.min(pages - 1, page + 2); n += 1) push(n);
    if (page + 2 < pages - 1) out.push(null);
    if (pages > 1) push(pages);
    return out;
  }

  function pageLinks(page, pages, attr) {
    return pageWindow(page, pages).map((n) => (n === null
      ? '<span class="faith-pager-gap" aria-hidden="true">&hellip;</span>'
      : `<button type="button" class="faith-pager-num${n === page ? " is-current" : ""}"`
        + ` ${attr}="${n}"${n === page ? ' aria-current="page"' : ""}`
        + ` aria-label="Page ${n}">${n}</button>`)).join("");
  }

  function chrome(host, opts) {
    host.querySelectorAll("[data-faith-index-chrome]").forEach((el) => el.remove());
    const head = document.createElement("div");
    head.className = "faith-browse-head";
    head.setAttribute("data-faith-index-chrome", "");
    const pager = opts.pager
      ? `<p class="faith-pager">` +
        `<button type="button" class="faith-pager-btn" data-faith-index-page="${opts.pager.page - 1}"${opts.pager.page <= 1 ? " disabled" : ""}>&larr; Previous</button>` +
        `<span class="faith-pager-nums">${pageLinks(opts.pager.page, opts.pager.pages, "data-faith-index-page")}</span>` +
        `<button type="button" class="faith-pager-btn" data-faith-index-page="${opts.pager.page + 1}"${opts.pager.page >= opts.pager.pages ? " disabled" : ""}>Next &rarr;</button>` +
        `<span class="faith-pager-count">${opts.pager.total.toLocaleString()} ${escapeHtml(opts.pager.label)}</span></p>`
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

  // A page number the reader can resolve on its own; anything else and
  // the heading is what actually finds the passage.
  function secOpts(sec) {
    if (!sec || typeof sec.p === "number" || !sec.t) return null;
    return { h: sec.t };
  }

  function workCard(e) {
    const c = window.MOCorpora.get(e.corpus);
    const pending = c && c.readable === false;
    const secs = e.secs || [];
    // A work that treats the topic in several places gets a link to
    // each. A work that is about the topic end to end, Tertullian on
    // baptism, carries no sections and opens at its first page, which
    // is the right place for it.
    const more = secs.length > 1
      ? `<span class="faith-card-secs">${secs.slice(0, 4).map((x) =>
        `<span class="faith-card-sec" role="link" tabindex="0" data-go="${escapeHtml(readerUrl(e.corpus, e.id, x.p, secOpts(x)))}">${
          escapeHtml(x.t ? shorten(x.t) : (typeof x.p === "number" ? `Page ${x.p}` : "This passage"))}</span>`).join("")}${
        secs.length > 4 ? `<span class="faith-card-sec-more">and ${secs.length - 4} more</span>` : ""}</span>`
      : "";
    const label = pending ? "Browse" : (secs.length ? "Read the passage" : "Read");
    return `<a class="faith-card" href="${escapeHtml(readerUrl(e.corpus, e.id, e.loc, secOpts(secs[0])))}">` +
      `<p class="faith-card-date">${escapeHtml(c ? c.label : e.corpus)}</p>` +
      `<h3 class="faith-card-title">${escapeHtml(e.title || e.id)}</h3>${
      e.author ? `<p class="faith-card-author">${escapeHtml(e.author)}</p>` : ""
      }${secs.length === 1 && secs[0].t ? `<p class="faith-card-desc">${escapeHtml(shorten(secs[0].t, 150))}</p>` : ""
      }${e.excerpt ? `<p class="faith-card-desc">${escapeHtml(e.excerpt.slice(0, 160))}</p>` : ""
      }${more}<span class="faith-card-link">${label} <span class="faith-card-arrow" aria-hidden="true">&rarr;</span></span></a>`;
  }

  // Section headings in this corpus run to full sentences.
  function shorten(text, max) {
    const t = String(text || "").trim();
    const n = max || 64;
    if (t.length <= n) return t;
    const cut = t.slice(0, n);
    return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[\s,;:—-]+$/, "")}…`;
  }

  // These URLs are ours, built by readerUrl from a slug and a page,
  // but they still go through the theme's sanitiser rather than round
  // it: the rule exists so that no path to navigation is exempt.
  function goTo(href) {
    const safe = window.MOSafeHref ? window.MOSafeHref.sanitize(href) : "";
    if (!safe) return;
    // eslint-disable-next-line no-restricted-syntax -- same-origin reader path, sanitized above
    window.location.href = safe;
  }

  // Every named section is its own way in.
  //
  // The section lines sit inside the card's own <a>, and an anchor
  // cannot contain another anchor, so a click on one would otherwise
  // follow the card and land at the first passage rather than the one
  // the reader actually pointed at. Delegated once, at the document,
  // because the grids are rebuilt on every view change.
  document.addEventListener("click", (e) => {
    const sec = e.target.closest("[data-go]");
    if (!sec) return;
    const href = sec.getAttribute("data-go");
    if (!href) return;
    e.preventDefault();
    e.stopPropagation();
    goTo(href);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const sec = e.target.closest && e.target.closest("[data-go]");
    if (!sec) return;
    e.preventDefault();
    goTo(sec.getAttribute("data-go"));
  });

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
  //
  // A chapter of Romans cited by four thousand works is a list nobody
  // can read. The point of this index is to be a commentary, so a
  // reader has to be able to ask it a question: what did the Reformed
  // say about this, what did the seventeenth century say, what did
  // this one man say. Collection, tradition and century narrow it, and
  // the box searches author and title together.
  //
  // Shell and slots, for the reason the reading rooms are: rebuilding
  // the controls on every render tears an open dropdown out from under
  // the reader mid-gesture.
  // Collection, tradition, century, and a box that searches author and
  // title together. Lifted out of the scripture chapter view so the
  // topic view can have the same instrument: a topic that gathers four
  // hundred works is no more usable than a chapter that does.
  //
  // Handed back rather than wired in, because the caller owns its own
  // rows. The bar is built once and never rebuilt: replacing it under
  // an open select closes the select mid-gesture, and replacing it
  // under the search box takes focus away between keystrokes.
  function filterControls(entries, onChange) {
    const state = { collection: "", tradition: "", century: "", q: "" };

    const counts = (key) => {
      const m = new Map();
      entries.forEach((e) => {
        const v = key === "century" ? e.century : e[key];
        if (v) m.set(v, (m.get(v) || 0) + 1);
      });
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    };

    const select = (name, label, all, opts, fmt) => {
      if (opts.length < 2) return "";
      const o = opts.map(([v, n]) =>
        `<option value="${escapeHtml(String(v))}">${escapeHtml(fmt ? fmt(v) : String(v))} (${n.toLocaleString()})</option>`).join("");
      return `<label class="faith-refs-select"><span>${escapeHtml(label)}</span>` +
        `<select data-refs-${name}><option value="">${escapeHtml(all)}</option>${o}</select></label>`;
    };

    const cLabel = (id) => {
      const c = window.MOCorpora.get(id);
      return c ? c.label : id;
    };
    const yLabel = (n) => (window.MOCentury ? window.MOCentury.label(n) : String(n));

    const el = document.createElement("div");
    el.className = "faith-refs-controls";
    el.innerHTML =
      `<input type="search" class="faith-refs-search" data-refs-q placeholder="Search an author or a title&hellip;" aria-label="Search these works">` +
      `<div class="faith-refs-selects">${
        select("collection", "Collection", "All collections", counts("corpus"), cLabel)}${
        select("tradition", "Tradition", "All traditions", counts("tradition"))}${
        select("century", "Century", "All centuries", counts("century"), yLabel)}</div>` +
      `<p class="faith-refs-count" data-refs-count></p>`;

    const fold = (x) => String(x || "")
      .normalize("NFD").replace(/\p{M}/gu, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "");

    function matching() {
      const q = fold(state.q);
      return entries.filter((e) => {
        if (state.collection && e.corpus !== state.collection) return false;
        if (state.tradition && e.tradition !== state.tradition) return false;
        if (state.century && String(e.century) !== state.century) return false;
        if (!q) return true;
        if (e._q === undefined) e._q = fold(`${e.author || ""} ${e.title || ""}`);
        return e._q.includes(q);
      });
    }

    function setCount(shown, noun) {
      const countEl = el.querySelector("[data-refs-count]");
      if (!countEl) return;
      const word = `${noun}${shown === 1 ? "" : "s"}`;
      countEl.textContent = shown === entries.length
        ? `${shown.toLocaleString()} ${word}`
        : `${shown.toLocaleString()} of ${entries.length.toLocaleString()} ${word}`;
    }

    const bind = (sel, key) => {
      const node = el.querySelector(`[data-refs-${sel}]`);
      if (node) node.addEventListener("change", () => { state[key] = node.value; onChange(); });
    };
    bind("collection", "collection");
    bind("tradition", "tradition");
    bind("century", "century");
    const box = el.querySelector("[data-refs-q]");
    if (box) {
      let t = null;
      box.addEventListener("input", () => {
        window.clearTimeout(t);
        t = window.setTimeout(() => { state.q = box.value.trim(); onChange(); }, 180);
      });
    }

    return { el, state, matching, setCount };
  }

  function pagerNav(page, pages, go) {
    const nav = document.createElement("p");
    nav.className = "faith-pager";
    nav.innerHTML =
      `<button type="button" class="faith-pager-btn" data-ref-page="${page - 1}"${page <= 1 ? " disabled" : ""}>&larr; Previous</button>` +
      `<span class="faith-pager-nums">${pageLinks(page, pages, "data-ref-page")}</span>` +
      `<button type="button" class="faith-pager-btn" data-ref-page="${page + 1}"${page >= pages ? " disabled" : ""}>Next &rarr;</button>`;
    nav.querySelectorAll("[data-ref-page]").forEach((b) => {
      b.addEventListener("click", (ev) => {
        ev.preventDefault();
        if (b.disabled) return;
        go(parseInt(b.getAttribute("data-ref-page"), 10));
      });
    });
    return nav;
  }

  function fillChapter(body, book, ch, entries) {
    body.innerHTML = "";
    const list = document.createElement("div");
    list.className = "faith-refs-list";
    const f = filterControls(entries, () => render(1));
    body.appendChild(f.el);
    body.appendChild(list);

    function render(page) {
      const rows = f.matching();
      const p = page || 1;
      const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
      const slice = rows.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE);
      f.setCount(rows.length, "work");
      list.innerHTML = "";
      if (!rows.length) {
        list.innerHTML = `<p class="faith-refs-empty">Nothing here matches that. Try another name, or widen the filters.</p>`;
        return;
      }
      const ol = document.createElement("ol");
      ol.className = "faith-scripture-refs";
      slice.forEach((e) => ol.appendChild(refItem(e, `${book} ${ch}`)));
      list.appendChild(ol);
      if (pages > 1) list.appendChild(pagerNav(p, pages, render));
    }

    render(1);
  }

  // One reference: who cites it, and the words around the citation, so
  // the reader can judge before opening a 900-page folio.
  // The verses this work names, each its own way in. Where the source
  // gave a chapter and nothing more there is nothing to show, which is
  // most of the Latin corpus: "as it is written Rom. 8" was a complete
  // citation in 1640.
  function verseLinks(e, ref) {
    const vs = e.verses || [];
    if (!vs.length) return "";
    const shown = vs.slice(0, 12);
    const links = shown.map(([v, loc]) =>
      `<span class="faith-verse-link" role="link" tabindex="0" data-go="${
        escapeHtml(readerUrl(e.corpus, e.id, loc == null ? e.loc : loc, { ref: `${ref}:${v}` }))
      }">${v}</span>`).join("");
    const more = vs.length > shown.length
      ? `<span class="faith-verse-more">and ${vs.length - shown.length} more</span>` : "";
    return `<p class="faith-verse-row"><span class="faith-verse-label">Verses</span>${links}${more}</p>`;
  }

  function refItem(e, ref) {
    const c = window.MOCorpora.get(e.corpus);
    const li = document.createElement("li");
    li.className = "faith-scripture-ref";
    // The reference travels with the link. Where the source gave no
    // locator, which is every Early English Books citation, the reader
    // matches the reference against the work's own text and lands on
    // the line that makes it.
    const href = readerUrl(e.corpus, e.id, e.loc, { ref });
    li.innerHTML =
      `<a class="faith-scripture-ref-link" href="${escapeHtml(href)}">` +
      `<span class="faith-scripture-ref-source">${escapeHtml(c ? c.label : e.corpus)}</span>` +
      `<span class="faith-scripture-ref-title">${escapeHtml(e.title || String(e.id))}</span>${ 
      e.author ? `<span class="faith-scripture-ref-author">${escapeHtml(e.author)}</span>` : "" 
      }${e.excerpt ? `<span class="faith-scripture-ref-excerpt">${escapeHtml(e.excerpt)}</span>` : "" 
      }${e.times > 1 ? `<span class="faith-scripture-ref-times">cited ${e.times} times</span>` : "" 
      }</a>${verseLinks(e, ref)}`;
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
        .sort((a, b) => (a.genre - b.genre)
          || (topicRank(a.label) - topicRank(b.label))
          || b.n - a.n);
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

    // Shell and slots. The heading and the filter bar are built once
    // when the topic opens; only the grid is redrawn as the filters
    // move. A topic that gathers two thousand works needs the same
    // instrument a chapter of Romans does: narrow by collection,
    // tradition or century, or go straight to one author and read what
    // that person said about it.
    chrome(host, {
      back: { to: "topics", label: "All topics" },
      title: t.label,
      sub: `${t.entries.length.toLocaleString()} work${t.entries.length === 1 ? "" : "s"}`,
    });
    const f = filterControls(t.entries, () => draw(1));
    // Marked as chrome so the next topic's chrome() clears it rather
    // than stacking a second bar underneath the first.
    f.el.setAttribute("data-faith-index-chrome", "");
    const head = host.querySelector(".faith-browse-head");
    if (head && head.nextSibling) host.insertBefore(f.el, head.nextSibling);
    else host.appendChild(f.el);

    function draw(page) {
      const rows = f.matching();
      const { slice, page: p, pages } = paged(rows, page);
      f.setCount(rows.length, "work");
      const g = grid(host);
      if (!rows.length) {
        g.innerHTML = `<p class="faith-refs-empty">Nothing here matches that. Try another name, or widen the filters.</p>`;
        return;
      }
      g.insertAdjacentHTML("beforeend", slice.map(workCard).join(""));
      const old = host.querySelector(".faith-pager[data-faith-topic-pager]");
      if (old) old.remove();
      if (pages > 1) {
        const nav = pagerNav(p, pages, draw);
        nav.setAttribute("data-faith-topic-pager", "");
        g.parentNode.insertBefore(nav, g.nextSibling);
      }
    }

    draw(topicState.page || 1);
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
          const [corpus, id, times, loc, excerpt, verses] = row;
          const w = (cats.get(corpus) || new Map()).get(String(id));
          return {
            corpus,
            id,
            times: times || 1,
            loc: loc == null ? null : loc,
            excerpt: excerpt || "",
            title: w ? w.title : String(id),
            author: w ? w.author : "",
            // [[verse, locator], …] where the citation named one. Each
            // has its own place in the text, so Romans 8:28 opens at
            // the line that cites 8:28 and not at the head of the
            // chapter's first mention.
            verses: Array.isArray(verses) ? verses : [],
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
    window.MOCorpora.load("tfr")
      .then((cat) => loadTopics(`${BLOB}/v1/topics.json`, "tfr", cat))
      .catch(() => {}),
    window.MOCorpora.load("pld")
      .then((cat) => loadTopics("https://pld-patrologia-latina.vercel.app/data/topics.json", "pld", cat))
      .catch(() => {}),
    window.MOCorpora.load("po")
      .then((cat) => loadTopics("https://patrologia-orientalis.vercel.app/data/topics.json", "po", cat))
      .catch(() => {}),
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
