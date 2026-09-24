/*
 * The Faith Received — a collection's page
 *
 * The whole table of contents for one collection: every work, in the
 * row treatment the browse page uses. English title, the work's own
 * title beneath it where the catalogue carries one, then the author.
 *
 * Sorted by author, then by title within an author, so an author's
 * works sit together without a heading interrupting the list. Fifty to
 * a page, an A-Z rail keyed on the author's surname, and one box that
 * searches authors first and titles second (see tierOf).
 *
 * This replaced the author-card view, which showed a count and the
 * first five titles and repeated itself wherever an author had a
 * multi-volume set. A reader opening a table of contents wants the
 * works.
 *
 * Migne's three collections carry a second view beside that one. The
 * Patrologia is cited by volume and column, "PL 139 / 473a", and that
 * address is how every footnote in the discipline reaches it, so a
 * scholar who arrives at Patrologia Latina holding a citation and finds
 * only an A-Z of authors cannot get to what they came for. Those three
 * rooms therefore offer By volume beside By author. It is a second door
 * into the same shelf, not a replacement: By author stays the default,
 * because most readers have never seen a Migne citation. See SHELVES.
 *
 * The address lives in the query string, `?view=volume&vol=139` on the
 * two Latin and Greek series and `?view=tome&tome=2` on Patrologia
 * Orientalis, which is cited by tome and fascicle rather than by
 * volume. Same grammar as the rest of this page: short lowercase keys,
 * defaults omitted, written with replaceState.
 */

(function () {
  "use strict";
  // ONE LIBRARY (owner, 2026-09-23: "take out the whole latin library vs english things"). The library is one library,
  // shelved by tradition. "The Latin Library" is the name of the pipeline most of it came through, and it holds English
  // works (Davenant, Baxter, the Westminster minutes); Early English Books and the English Editions are the same
  // library's English shelves. So where a reader is told what a work is, the label is its shelf, never tfr / eebo / mo.
  // The printed series (Patrologia Latina, Graeca, Orientalis) and the confessions keep their own names.
  const ONE_LIBRARY = new Set(["tfr", "eebo", "mo", "mo-english"]);
  const shelfOf = (w) => {
    const t = String((w && w.tradition) || "").trim();
    if (!t) return "";
    const L = window.MOFaithLabel;
    return L && L.of ? L.of(t, w) : t;
  };
  /* One shelf order for the whole library, so a multi-volume set reads
   1, 2, 3 rather than 1, 10, 11, 2. window.MOTitleOrder ships in boot,
   which runs before every page script; the fallback is the ordering
   this line had before it existed, so a boot that failed to load costs
   the order and never the list. See assets/js/lib/faith-title-order.js. */
  function cmpTitle(a, b) {
    const x = String(a || ""), y = String(b || "");
    return window.MOTitleOrder
      ? window.MOTitleOrder.compareTitles(x, y)
      : x.localeCompare(y);
  }

  const root = document.querySelector("[data-faith-room]");
  if (!root || !window.MOCorpora) return;

  // A page of AUTHORS, not of works. Every author folds shut, so a page
  // is a list of names, and a hundred of those is a screen or two of
  // scrolling rather than the tens of thousands of rows a hundred
  // authors' works would be. Paging by works also cut an author across
  // the boundary, which is how Cyprian's eighteen could land on two
  // pages; a page break now only ever falls between authors.
  const PAGE_SIZE = 100;
  const params = new URLSearchParams(window.location.search);
  // The page says which collection it is; ?collection= is only a
  // fallback for the shared /room/ route.
  const meta = document.querySelector('meta[name="tfr-room-collection"]');
  const collectionId = ((meta && meta.getAttribute("content")) ||
    params.get("collection") || "tfr").replace(/[^a-z0-9_-]/gi, "");
  /* THE CREEDS AND CONFESSIONS GROUP BY TRADITION, NOT AUTHOR (Ian,
     2026-09-24: "it doesn't make sense to have these all labeled under
     unattributed ... give the option of splitting by tradition or by
     chronology"). A confession has no author to file under, so on that
     collection the first view is By tradition, in the order the church's
     history reads them, and the second stays By century. */
  const BY_TRADITION = collectionId === "confessions";
  const TRADITION_RANK = [
    "The Whole Church", "Ecumenical", "Orthodox", "Eastern Orthodox", "Oriental Orthodox",
    "Roman Catholic", "Waldensian", "Bohemian Brethren", "Protestant", "Lutheran", "Reformed",
    "Continental Reformed", "Anglican", "Presbyterian", "Congregational", "Baptist",
    "Anabaptist", "Remonstrant", "Methodist",
  ];
  const traditionOf = (w) => {
    const t = String((w && w.tradition) || "").trim() || "Other";
    return window.MOFaithLabel && window.MOFaithLabel.shelf ? window.MOFaithLabel.shelf(t) : t;
  };
  const traditionRank = (name) => {
    const k = TRADITION_RANK.indexOf(name);
    return k < 0 ? TRADITION_RANK.length : k;
  };

  // A room is a collection. A SHELF is a tradition, and the two stopped
  // being the same thing on 2026-09-17, when the Fathers in English were
  // filed into Migne's two series: "Latin Fathers" is now Patrologia
  // Latina plus 22 works from English Editions, "Greek Fathers" is
  // Patrologia Graeca plus 27. The all-works page counts the shelf, so a
  // room that counted only its own collection would disagree with the
  // shelf a reader just clicked — and a count that disagrees with the
  // list under it is worse than no count at all.
  //
  // Where this meta names a tradition the room is that whole shelf:
  // its own collection, plus every work under that tradition in the
  // collections that carry more than one. The single-tradition
  // collections (eebo, and the Migne series themselves) can contribute
  // nothing to another shelf and are not fetched.
  const shelfMeta = document.querySelector('meta[name="tfr-room-shelf"]');
  const shelfTradition = (shelfMeta && shelfMeta.getAttribute("content") || "").trim();
  const MIXED = ["mo", "tfr"];

  let works = [];
  let tradition = params.get("tradition") || "";
  let denomination = params.get("denomination") || "";
  // /the-faith-received/curated/ has shipped ?denomination=Reformed since
  // the shelf cards were written, and it means the continental Reformed.
  // This once sent the reader to tradition=Continental Reformed, which
  // worked only while that value was orphaned at the top level; it is a
  // church under Protestant now, so the address has to say so or the
  // bookmark lands on nothing.
  if (denomination === "Reformed") { denomination = "Continental Reformed"; tradition = "Protestant"; }
  let century = parseInt(params.get("century"), 10) || 0;
  // Only meaningful on the all-works page, where more than one
  // collection is in the room at once.
  let collection = params.get("in") || "";
  // An old ?in=tfr / eebo / mo link names a collection this page no longer offers: it opens on the whole library.
  if (ONE_LIBRARY.has(collection)) collection = "";
  let filter = params.get("q") || "";
  let letter = params.get("letter") || "";
  // The party a work's author stood in, cutting across the churches:
  // Puritan, Conformist, or the Westminster Assembly's roster. See the
  // note above PARTIES below, and assets/js/faith-denominations.js for
  // why the party is its own axis and not a denomination.
  let party = params.get("party") || "";
  // A ?scope= written by the old "Search in" select is read and dropped:
  // the box now searches authors first and titles second on its own
  // (see tierOf), which is what the select was for.
  let page = Math.max(1, parseInt(params.get("page"), 10) || 1);

  // Research belongs inside an opened shelf as well as on its catalogue card.
  // These are the source library's nine shelf codes; the existing catalogue
  // alias "Reformed" displays the canonical research label at the destination.
  const RESEARCH_SHELVES = {
    "Latin Fathers": "pl", "Greek Fathers": "gf", "Eastern Fathers": "po",
    "Medieval": "md", "Roman Catholic": "rc", "Reformed": "rf",
    "Continental Reformed": "rf", "English Divines": "ed", "Lutheran": "lu",
    "Humanism and Law": "hl"
  };
  const RESEARCH_COLLECTIONS = { pld: "pl", pg: "gf", po: "po", eebo: "ed" };
  const RESEARCH_NAMES = {
    pl: "Latin Fathers", gf: "Greek Fathers", po: "Eastern Fathers", md: "Medieval",
    rc: "Roman Catholic", rf: "Continental Reformed", ed: "English Divines",
    lu: "Lutheran", hl: "Humanism and Law"
  };
  const studyRoot = document.createElement("section");
  studyRoot.className = `faith-shelf-research${root.classList.contains("container") ? " container" : ""}`;
  studyRoot.setAttribute("aria-label", "Shelf research and reference");
  studyRoot.hidden = true;
  root.insertAdjacentElement("beforebegin", studyRoot);
  // Printed shelf names go through the one display rule ("English
  // Divines" reads "English writers"). Values, URLs and matching keep
  // the data's own name.
  const shelfName = (t) => (window.MOFaithLabel ? window.MOFaithLabel.shelf(t) : t);
  function renderShelfResearch() {
    const code = RESEARCH_SHELVES[shelfTradition || denomination || tradition]
      || RESEARCH_COLLECTIONS[collection || collectionId];
    const valid = Object.hasOwn(RESEARCH_NAMES, code);
    studyRoot.hidden = !valid;
    if (!valid || studyRoot.dataset.shelf === code) return;
    studyRoot.dataset.shelf = code;
    const base = "/the-faith-received/";
    const name = RESEARCH_NAMES[code];
    const doors = [
      ["Scripture", `bible/?sh=${code}`, "Find where these works cite a biblical book, chapter or verse."],
      ["Authors", `author/?sh=${code}`, "Read each author’s works, topics and reception."],
      ["Topics", `topics/?sh=${code}`, "Find theological topics and the passages that discuss them."],
      ["Connections", `web/#shelves=${name === "Continental Reformed" ? "reformed" : name.toLowerCase().replace(/ /g,"-")}/authors`, "Explore this shelf’s Scripture connections and follow citations between authors."]
    ];
    studyRoot.innerHTML = `<div class="faith-shelf-study-head"><div><h2>Study this shelf</h2><p>${escapeHtml(shelfName(name))}</p></div>`
      + `<a class="faith-shelf-ask" href="${base}ask/?trad=${encodeURIComponent(name)}">Ask this shelf</a></div>`
      + `<nav class="faith-shelf-study-grid" aria-label="Study ${escapeHtml(shelfName(name))}">${
       doors.map(([label, href, description]) => `<a class="faith-shelf-study-card" href="${base}${href}"><strong>${label}</strong><span>${description}</span></a>`).join("")
       }</nav>${
      // The Dictionary of Catholic Theology on the Roman Catholic shelf
      // only (Ian, 2026-09-24: "We don't need the DCT on all of the
      // shelf pages").
      code === "rc"
        ? `<div class="faith-shelf-reference"><h2>Reference</h2>`
          + `<a class="faith-shelf-study-card" href="${base}dictionary/"><strong>Dictionary of Catholic Theology</strong>`
          + `<span>The French theological dictionary (Vacant–Mangenot–Amann, 1899–1950). Search a headword and read the article in French and English.</span>`
          + `<span class="faith-shelf-reference-action">Open dictionary</span></a></div>`
        : ""}`;
  }
  renderShelfResearch();

  // ── The shelf a collection is cited by ───────────────────────────
  //
  // Only Migne's three. The other collections are cited by title and
  // author like any other book, so a volume view there would be a door
  // onto nothing and they get no toggle at all.
  //
  //   of      the record's shelf mark, set in faith-corpora.js
  //   face    the catalogue's own name for a bucket, where it has one
  //   name    what the bucket is called in a heading
  //   cite    the address a footnote would print
  //   mark    what a row shows once the reader is inside the bucket
  //
  // `mark` returns nothing on the two Latin and Greek series: inside PL
  // 139 the volume number on every row is the one fact the reader
  // already has. Patrologia Orientalis is addressed one level finer, so
  // there the row carries its fascicle instead.
  const SHELVES = {
    pld: {
      view: "volume", param: "vol", tab: "By volume", one: "volume", many: "volumes",
      of: (w) => w.volume,
      face: () => "",
      name: (s) => (s.num ? `Patrologia Latina ${s.num}` : s.label || s.v),
      cite: (s) => (s.num ? `PL ${s.num}` : s.label || s.v),
      mark: () => "",
      lead: "Migne is cited by volume and column, as PL 139 / 473a. Choose a volume to see what it holds.",
    },
    pg: {
      view: "volume", param: "vol", tab: "By volume", one: "volume", many: "volumes",
      of: (w) => w.volume,
      face: () => "",
      name: (s) => (s.num ? `Patrologia Graeca ${s.num}` : s.label || s.v),
      cite: (s) => (s.num ? `PG ${s.num}` : s.label || s.v),
      mark: () => "",
      lead: "Migne is cited by volume and column, as PG 44 / 125a. Choose a volume to see what it holds.",
    },
    po: {
      view: "tome", param: "tome", tab: "By tome", one: "tome", many: "tomes",
      of: (w) => w.tome,
      // "Tome 2" for a numbered one, "Patrologia Syriaca" for the one
      // that is a series of its own. Both come from the catalogue.
      face: (w) => w.tomeLabel,
      name: (s) => s.label || s.v,
      cite: (s) => (s.num ? `PO ${s.num}` : s.label || s.v),
      mark: (w) => (w.fasc ? `fasc. ${w.fasc}` : ""),
      lead: "Patrologia Orientalis is cited by tome and page, as PO 2, 421. Choose a tome to see what it holds.",
    },
  };
  // Which shelf the reader is standing on. In a room it is the room's own
  // collection. On the all-works page it is whichever Migne series the
  // Denomination filter names — because that filter cuts the library down
  // to exactly one series, and a series is cited by volume. Arriving at
  // ?tradition=The+Fathers&denomination=Latin+Fathers and being offered
  // only an A-Z was the gap: the same 8,989 works, the same shelf, and no
  // way to reach PL 139 but to know an author who is in it.
  // A Patrologia volume is a printed object whose contents run in Migne's order.
  // A year and a century are not: nothing was printed "in" 1640 in a sequence.
  // Only a printed shelf opens on the work order; the others open on the authors.
  SHELVES.pld.printed = true;
  SHELVES.pg.printed = true;
  SHELVES.po.printed = true;

  // Every shelf has a second way in, not only the three Migne numbered.
  //
  // A Patrologia is cited by volume and that is the whole reason those three
  // rooms carry a second view. The other shelves are cited by nothing, but they
  // are still ordered by something a reader has in hand: Early English Books is
  // dated to the year it was printed, and everything else sits in a century.
  // So a shelf offers whichever of the three its own works can answer, and the
  // machinery below — the grid, the tiles, the head, the way back — does not
  // care which of them it was handed.
  const YEAR_SHELF = {
    view: "year", param: "yr", tab: "By year", one: "year", many: "years",
    of(w) {
      const y = String(w.eyebrow || "").match(/\b(1[3-9]\d\d)\b/);
      return y ? y[1] : "";
    },
    face: () => "",
    name: (s) => s.v,
    cite: (s) => s.v,
    mark: () => "",
    lead: "Printed year by year. Choose a year to see what came out in it.",
  };
  const CENTURY_SHELF = {
    view: "century", param: "cy", tab: "By century", one: "century", many: "centuries",
    of: (w) => String(cent(w) || ""),
    face: () => "",
    name: (s) => (window.MOCentury ? window.MOCentury.label(Number(s.v)) : s.v),
    cite: (s) => (window.MOCentury ? window.MOCentury.label(Number(s.v)) : s.v),
    mark: () => "",
    lead: "Choose a century to see what this shelf holds from it.",
  };

  const DENOM_SHELF = { "Latin Fathers": "pld", "Greek Fathers": "pg", "Eastern Fathers": "po" };
  // Which second view this shelf can answer. The named series first, because a
  // volume is an address and a century is only a date; then the year, where the
  // works carry one; then the century, which every dated work has. A shelf whose
  // works are undated — the creeds — gets no second view, and the toggle hides.
  function kindFor(list) {
    if (!list || !list.length) return null;
    const n = list.length;
    let years = 0, cents = 0;
    for (const w of list) {
      if (YEAR_SHELF.of(w)) years += 1;
      if (cent(w)) cents += 1;
    }
    if (years >= n * 0.6) return YEAR_SHELF;
    if (cents >= n * 0.6) return CENTURY_SHELF;
    return null;
  }

  function shelfFor(denom) {
    if (collectionId !== "all") return SHELVES[collectionId] || kindFor(works);
    const id = DENOM_SHELF[String(denom || "").trim()];
    if (id) return SHELVES[id];
    // On the all-works page a shelf is whatever the filters have cut it down to,
    // so the question is asked of the works actually in hand.
    return kindFor(works.filter(matches));
  }
  let shelf = shelfFor(denomination);
  // A hand-typed address is accepted on the shelf mark alone, so
  // `?vol=139` opens volume 139 without also being told which view that
  // is. Letters are kept because one bucket is named PS rather than
  // numbered; everything else is dropped, and the value is escaped on
  // output as well.
  let vol = shelf ? String(params.get(shelf.param) || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 12) : "";
  let view = shelf && (vol || params.get("view") === shelf.view) ? shelf.view : "author";
  // Filled once the catalogue is in: shelf mark -> { v, num, label },
  // in the order the buckets are printed in.
  let shelfOrder = [];

  // "all" is every collection at once, which is what the century page
  // reads: one table of contents cut by date rather than by shelf.
  //
  // Every collection means every collection. "mo" (English Editions, 69
  // works) was missing until 2026-09-15, so the one page that promises
  // the whole library was the one page those works could not be found
  // from.
  const ALL = ["pg", "pld", "po", "tfr", "eebo", "mo"];
  const isAll = collectionId === "all";
  const corpus = isAll ? null : window.MOCorpora.get(collectionId);
  root.innerHTML = '<p class="faith-room-status">Loading the collection&hellip;</p>';

  const source = isAll
    ? Promise.all(ALL.map((id) => window.MOFaithCatalogue.load(id).catch(() => [])))
        .then((sets) => sets.flat())
    : Promise.all([
      window.MOFaithCatalogue.load(collectionId),
      shelfTradition
        ? Promise.all(MIXED.filter((id) => id !== collectionId)
          .map((id) => window.MOFaithCatalogue.load(id).catch(() => [])))
          .then((sets) => sets.flat().filter((w) =>
            String(w.tradition || "").trim() === shelfTradition))
        : [],
      // Curated works that also stand in this collection. The confessions
      // catalogue is the corpus owner's and we do not write it, so a
      // confession we add ourselves (the New Hampshire Confession, 1833)
      // lives in English Editions and names this page in its `also_in`.
      // Only the confessions page asks, so no other room pays for the
      // extra catalogue.
      collectionId === "confessions"
        ? window.MOFaithCatalogue.load("mo").catch(() => [])
          .then((mo) => mo.filter((w) => (w.alsoIn || []).includes(collectionId))
            // Every document on this page prints its year after its title,
            // "The London Baptist Confession (1677)", so a guest does too.
            .map((w) => (/^\d{3,4}$/.test(String(w.eyebrow || "")) && !/\(\d{3,4}/.test(w.title || "")
              ? { ...w, title: `${w.title} (${w.eyebrow})` } : w)))
        : [],
    ]).then(([own, guests, curated]) => own.concat(guests, curated));

  // Name, dates and office for the authors this collection has them for,
  // keyed by name. The Patrologia rooms are an index of names, and a name
  // alone does not say who it is: "Abbo of Fleury" means one thing beside
  // "c. 945-1004 · Abbot of Fleury" and nothing without it. Resolves to an
  // empty map rather than rejecting, and the room renders either way.
  let authorNotes = new Map();
  const notes = corpus && corpus.authors
    ? fetch((corpus.notesBase || corpus.base) + corpus.authors)
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => {
        const m = new Map();
        Object.keys(d || {}).forEach((name) => {
          const e = d[name] || {};
          if (e.dates || e.affiliation) m.set(fold(name), { dates: e.dates || "", office: e.affiliation || "" });
        });
        return m;
      })
      .catch(() => new Map())
    : Promise.resolve(new Map());

  Promise.all([source, notes, window.MOCollectedContents?.ready]).then(([list, noteMap]) => {
    authorNotes = noteMap;
    // Alphabetical, by where each author files, then by title (Ian,
    // 2026-09-23: every list of authors and works in alphabetical
    // order). The whole library used to go by century first, which also
    // split one author's works: Justin's Hortatory Address sat after his
    // Second Apology because it is dated a century later. A writer's
    // century decides only HOW the name files (MOTitleOrder.fileAs):
    // before 1500 by the name they are known by, after by surname.
    authorCentury = new Map();
    list.forEach((w) => {
      const name = (w.author || "").trim();
      const c = cent(w);
      if (!name || !c) return;
      const had = authorCentury.get(name);
      if (!had || c < had) authorCentury.set(name, c);
    });
    const T = window.MOTitleOrder;
    works = list.slice().sort((a, b) => {
      if (T && T.compareNames) {
        return T.compareNames(a.author, isEarly(a.author), b.author, isEarly(b.author)) || compareWorks(a, b);
      }
      const an = surname(a.author), bn = surname(b.author);
      return an.localeCompare(bn) || compareWorks(a, b);
    });
    // A shelf with no named series cannot be known until its works are in, so the
    // address is read here rather than at startup: a reader who arrived on
    // ?view=year&yr=1640 asked for that year before the catalogue had landed, and
    // reading it any earlier dropped it and showed them the whole grid.
    if (!shelf) {
      shelf = shelfFor(denomination);
      if (shelf) {
        vol = String(params.get(shelf.param) || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 12);
        if (vol || params.get("view") === shelf.view) view = shelf.view;
      }
    }
    // Addresses written before the churches had their own field.
    //
    // "English Divines" is a SHELF, and since 2026-09-23 the filter can
    // hold one: a tradition with a parent matches that tradition rather
    // than its communion (see isShelfAsk). This used to send such a link
    // to Protestant with no church chosen, which is why the shelf card
    // promised 4,426 works and its own link opened on all 5,140
    // Protestant works. An older link naming it as a DENOMINATION means
    // the same shelf, so it lands there too. "Reformed" meant the
    // continental Reformed and has to keep meaning it —
    // /the-faith-received/curated/ has shipped that link since the shelf
    // cards were written.
    //
    // A tradition or denomination of Puritan or Anglican was, in the
    // older scheme, a party. Puritan still is. Anglican is now a church,
    // so it moves to the denomination rather than the party: a reader
    // who bookmarked the Anglicans gets the Anglicans.
    if (tradition === ENGLISH || denomination === ENGLISH) {
      tradition = ENGLISH;
      denomination = "";
    }
    if (tradition === "Puritan" || denomination === "Puritan") {
      party = "Puritan";
      if (tradition === "Puritan") tradition = "Protestant";
      denomination = "";
    }
    if (tradition === "Anglican" || denomination === "Anglican") {
      denomination = "Anglican";
      tradition = "Protestant";
    }
    // A denomination named without its parent, in a room that offers more
    // than one tradition, would filter the list and hide the select that
    // says so. Its parent is whatever the works under it file at.
    if (denomination && !tradition) {
      const tops = new Set(works.map(topTrad).filter(Boolean));
      const w0 = tops.size > 1 ? works.find((w) => denomOf(w) === denomination) : null;
      if (w0) tradition = topTrad(w0);
    }
    if (works.some((w) => topTrad(w) === "Protestant")) loadRoster();
    rebuildShelfOrder();
    render();
  });

  // The volumes of the shelf now in hand. In a room that is the whole
  // collection; on the all-works page it is only the works under the
  // denomination, or Patrologia Graeca's volume 44 would be counted into
  // Patrologia Latina's grid, both series carrying a `volume`.
  let shelfSig = null;
  function rebuildShelfOrder() {
    if (!shelf) { shelfOrder = []; return; }
    // Everything the filters admit, so a year grid under Puritan counts Puritan
    // works and a volume grid under Latin Fathers counts that series only.
    shelfOrder = indexShelves(collectionId === "all" ? works.filter(matches) : works);
  }

  // Every shelf mark in the collection, once each, in the order the
  // set was printed. Built from the catalogue the room has already
  // loaded, so the grid of volumes costs no second request.
  //
  // Numbered buckets come first and in numeric order; anything else
  // follows, sorted by name. That is what puts the Patrologia Syriaca
  // at the end of Patrologia Orientalis rather than between tomes 1
  // and 2, where a string sort would have left it.
  function indexShelves(list) {
    if (!shelf) return [];
    const seen = new Map();
    list.forEach((w) => {
      const v = String(shelf.of(w) || "");
      if (!v || seen.has(v)) return;
      seen.set(v, {
        v,
        num: /^\d+$/.test(v) ? parseInt(v, 10) : 0,
        label: String(shelf.face(w) || ""),
      });
    });
    return [...seen.values()].sort((a, b) =>
      (a.num ? 0 : 1) - (b.num ? 0 : 1)
      || a.num - b.num
      || a.label.localeCompare(b.label)
      || a.v.localeCompare(b.v));
  }

  // The name a work files under. Two catalogue conventions collide
  // here, so the comma decides which one we are looking at.
  //
  //   Inverted, "Little, Richard, fl. 1645-1646". EEBO catalogues this
  //   way and it is 87% of that collection: 12,240 of 14,033 authors.
  //   The filing name is everything before the first comma. Reading
  //   the last word instead took a death date, which is why 7,521 EEBO
  //   authors sat under "#" and the rest filed under a forename.
  //
  //   Direct, "Johann Heinrich Alsted". The Latin corpora give names
  //   this way round, so the last word is the one to file under.
  //   Sorting the raw string here files every Johann together.
  //
  // Two things are never part of a direct name:
  //
  //   A trailing parenthetical is an editorial role or a byname, so
  //   "Heinrich Finke (ed.)" filed under "(" and the rail sent it to
  //   "#". Stripped, it lands under F, and "Council of Pisa (acta)"
  //   under P.
  //
  //   A second author after "&" is not who the work is filed under,
  //   but only where the first side is a whole name. "August Franzen &
  //   Wolfgang Müller" belongs at Franzen, the way a library shelves
  //   it. "Adrian & Peter Walenburg" is two brothers sharing one
  //   surname, so the "&" there joins forenames and the name to file
  //   under is still Walenburg. One word before the "&" means the
  //   surname is on the far side; two or more means it is not.
  //
  // Both fall back to the raw string rather than to nothing, so a name
  // that is only a parenthetical still sorts somewhere.
  const PARTICLE = /^(?:le|la|les|du|de|del|della|delle|di|da|dos|van|von|der|den|ten|ter)$/i;

  function surname(name) {
    // Square brackets around a name are the cataloguer saying the
    // attribution is conjectural, not part of it: "[Brothyel,
    // Mathias]" files at Brothyel like any other.
    const raw = String(name || "")
      .trim()
      .replace(/^\[+/, "")
      .replace(/\]+$/, "")
      .trim();
    if (!raw) return "￿";
    const comma = raw.indexOf(",");
    if (comma > 0) return raw.slice(0, comma).trim().toLowerCase();
    let n = raw.replace(/\s*\([^()]*\)\s*$/, "").trim() || raw;
    const amp = n.split(/\s+(?:&|and)\s+/i);
    if (amp.length > 1 && amp[0].trim().split(/\s+/).length > 1) n = amp[0].trim();
    const parts = n.split(/\s+/);
    // A capitalised particle opens the surname and is part of it, so
    // "Louis Le Blanc de Beaulieu" files at Le Blanc rather than at
    // Beaulieu. Jake went looking for Louis Le Blanc under L and found
    // nothing, because the last word of his name is a place.
    //
    // The particle must be followed by a capitalised word, or EEBO's
    // author field, which sometimes holds a Latin title, files
    // "Plutarch. De capienda ex inimicis utilitate" under D.
    for (let i = 1; i < parts.length - 1; i++) {
      if (PARTICLE.test(parts[i]) && /^[A-ZÀ-Þ]/.test(parts[i])
        && /^[A-ZÀ-Þ]/.test(parts[i + 1])) {
        return parts.slice(i).join(" ").toLowerCase();
      }
    }
    return parts[parts.length - 1].toLowerCase();
  }

  // The rail is A-Z, so a name opening on a diacritic needs folding
  // rather than a "#": Marcin Śmiglecki belongs under S. NFD splits
  // most accents off their letter; the handful below carry the stroke
  // inside the glyph and do not decompose, so they are mapped by hand.
  const STRUCK = { Ł: "L", Ø: "O", Đ: "D", Ð: "D", Þ: "T", Æ: "A", Œ: "O", ẞ: "S" };
  function initial(name) {
    const T = window.MOTitleOrder;
    if (T && T.initialOf) return T.initialOf(name, isEarly(name));
    const c = surname(name)
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .charAt(0)
      .toUpperCase();
    return /[A-Z]/.test(c) ? c : STRUCK[c] || "#";
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Only a declared tradition counts. The eyebrow is whatever a corpus
  // chooses to print under a title, and in Early English Books that is
  // the year of printing, so falling back to it turned every year from
  // 1641 to 1700 into its own filter. A corpus that says it has no
  // traditions gets no chips.
  function trad(w) {
    return String(w.tradition || "").trim();
  }

  // The tradition a work files under at the top level. A value with a
  // declared parent shows under that parent, so "Reformed" sits inside
  // "Protestant" rather than beside "Roman Catholic" as a peer. A value
  // with no parent is its own top level and does not move.
  function topTrad(w) {
    const t = trad(w);
    if (!t) return "";
    if (w._tp === undefined) {
      w._tp = (window.MOCorpora && window.MOCorpora.traditionParent
        ? window.MOCorpora.traditionParent(t, w.corpus) : "") || "";
    }
    return w._tp || t;
  }

  // ── English Divines and their parties ────────────────────────────
  //
  // The English shelves come labelled two ways. Early English Books files
  // each work by the party of its author, Puritan or Anglican; the Latin
  // Library files the same men under "English Divines" and carries the
  // party in a second field. On the all-works page that stood Puritan,
  // Anglican and English Divines side by side as three denominations of
  // the one body of English Protestant divinity, and a reader choosing
  // Anglican lost the Anglicans of the Latin Library. Owner, 2026-09-19:
  // English Divines subsumes Anglican; within it are the Puritans, the
  // Anglicans and the Westminster Assembly.
  //
  // So the denomination a work files under is its FAMILY where it has
  // one, and the party is a third level beneath that. The Assembly is
  // not a party but a body: its roster is v1/schools.json's explicit list
  // of works by its members, most of them Puritan, so a work can be both.
  // Kept only to read the addresses that still name it. Nothing files
  // under it any more.
  const ENGLISH = "English Divines";
  const ASSEMBLY = "Westminster Assembly";
  // Puritan and Conformist cut across the churches; the Assembly is a
  // roster rather than a party, and a work can be on it and Puritan
  // both. It sits with the parties because it answers the same question
  // — where did this man stand — and a reader looking for the Assembly
  // looks where he looked for the Puritans.
  const PARTIES = ["Puritan", "Conformist", ASSEMBLY];
  // Under Protestant the denomination is the church body, which is its
  // own field now: see assets/js/faith-denominations.js for why the
  // tradition string could not do the job. Under anything else it is
  // still the child tradition, because Migne's two series are what
  // "within The Fathers" means and no denomination table has an opinion
  // about them.
  function denomOf(w) {
    if (topTrad(w) === "Protestant") return String(w.denomination || "");
    return trad(w);
  }
  // Stamped on the work when its corpus loads, from the same table —
  // but lib/faith-catalogue.js rebuilds a record from the raw index as
  // it canonicalises, and takes `party` from there, so the stamp does
  // not always survive. The raw value is the source's own vocabulary,
  // where "Anglican" is a PARTY meaning a conformist; here Anglican is
  // a church and the party is Conformist. Translated on read, which is
  // the one place both spellings arrive.
  function partyOf(w) {
    const p = String(w.party || "").trim();
    return p === "Anglican" ? "Conformist" : p;
  }
  // The Assembly's roster, keyed the way a loaded record is, `corpus|id`.
  // An Early English Books slug in the roster is `eebo-30376`; the room's
  // record for it is corpus "eebo", id "30376". Everything else in the
  // roster is a Latin Library slug. Empty until schools.json lands.
  const roster = new Set();
  // The roster's members by name as well, because that is the corpus
  // site's rule (build_lf_bible.py: a work is the Assembly's if its slug
  // is on the roster OR its author is a member), and the two sites should
  // file the same work the same way. Early English Books writes a name
  // inverted with dates — "Twisse, William, 1578?-1646" — so the name is
  // turned round before it is folded.
  const rosterAuthors = new Set();
  let rosterState = "";
  function rosterKey(slug) {
    const m = /^eebo-(\d+)$/.exec(slug);
    return m ? `eebo|${m[1]}` : `tfr|${slug}`;
  }
  function directName(raw) {
    const t = String(raw || "").trim().replace(/^\[+/, "").replace(/\]+$/, "").trim();
    const parts = t.split(",").map((x) => x.trim()).filter(Boolean);
    if (parts.length < 2) return t;
    const named = parts.filter((x) => !/^(?:b\.|d\.|ca\.|fl\.|active\s)?\s*\d{3,4}\??(?:\s*[-\u2013]\s*\d{0,4}\??)?$/i.test(x));
    if (named.length < 2) return named[0] || t;
    return `${named[1]} ${named[0]}`;
  }
  function inAssembly(w) {
    if (roster.has(`${w.corpus}|${w.id}`)) return true;
    if (w._ra === undefined) w._ra = fold(directName(w.author));
    return rosterAuthors.has(w._ra);
  }
  function inParty(w, p) { return p === ASSEMBLY ? inAssembly(w) : partyOf(w) === p; }
  function loadRoster() {
    if (rosterState) return;
    rosterState = "loading";
    const tfr = window.MOCorpora.get("tfr");
    fetch(`${(tfr && tfr.base) || ""}/v1/schools.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        const e = d && d[ASSEMBLY];
        ((e && e.slugs) || []).forEach((slug) => roster.add(rosterKey(String(slug))));
        ((e && e.authors) || []).forEach((a) => rosterAuthors.add(fold(a)));
        rosterState = "ready";
        render();
      })
      .catch(() => { rosterState = "failed"; render(); });
  }
  // UNUSED since the party tabs were removed (2026-09-22); kept beside
  // the rest of the party axis, which still filters from ?party=.
  // Which parties the works in hand can answer, with counts. Asked of the
  // English Divines actually present, so a room with no Anglicans offers
  // no Anglican option.
  function partiesUnder(list) {
    const c = new Map();
    list.forEach((w) => {
      const p = partyOf(w);
      if (p) c.set(p, (c.get(p) || 0) + 1);
      if (inAssembly(w)) c.set(ASSEMBLY, (c.get(ASSEMBLY) || 0) + 1);
    });
    return PARTIES.filter((p) => c.get(p)).map((p) => [p, c.get(p)]);
  }

  // What the second level is called depends on what it holds. Under
  // Protestant it is a denomination; under The Fathers it is one of
  // Migne's series and calling those a denomination is nonsense.
  const CHILD_LABEL = {
    Protestant: ["Denomination", "All denominations"],
    "The Fathers": ["Series", "All series"],
  };
  function childLabel(parent) {
    return CHILD_LABEL[parent] || ["Within", "All"];
  }

  // Children of the selected parent that are actually present, so a
  // collection only ever offers denominations it holds.
  function denomsUnder(list, parent) {
    const seen = new Map();
    list.forEach((w) => {
      if (topTrad(w) !== parent) return;
      const t = denomOf(w);
      // A work sitting on the parent itself (a pan-Protestant union
      // document) has no denomination and adds no option.
      if (!t || t === parent) return;
      seen.set(t, (seen.get(t) || 0) + 1);
    });
    return [...seen.entries()].sort((a, b) => b[1] - a[1]);
  }

  /* A TRADITION VALUE CAN NAME A SHELF (2026-09-23). The filter used to
     read every tradition as a top level, so asking for "English Divines"
     answered with its communion, Protestant: 5,140 works where the shelf
     card beside it promised 4,426. There was no other way to ask for that
     shelf. The denomination axis is the church a man belonged to
     (Anglican, Presbyterian), which is a different question, and the
     English works carry those values, never "English Divines".

     So: a value with a parent of its own is a shelf and matches the
     shelf; a value with no parent is a top level and matches the
     communion, as before. The answer is cached per value because
     matches() runs per work per keystroke. */
  /* One shelf, three spellings. Early English Books files its works by
     party (Puritan, Anglican); the main collection files the same men
     under "English Divines" and carries the party in its own field. The
     shelf cards and the landing counts already read the three as one
     family (faith-room-openers.js FAMILY), so a shelf ask has to as
     well, or the shelf's own card counts 4,426 and its list shows
     4,424. */
  const SHELF_FAMILY = { Puritan: "English Divines", Anglican: "English Divines" };
  const shelfFamilyOf = (w) => { const t = trad(w); return SHELF_FAMILY[t] || t; };

  const askedForShelf = new Map();
  function isShelfAsk(t) {
    if (!askedForShelf.has(t)) {
      const parent = window.MOCorpora && window.MOCorpora.traditionParent
        ? window.MOCorpora.traditionParent(t) : "";
      askedForShelf.set(t, !!parent && parent !== t);
    }
    return askedForShelf.get(t);
  }

  // The year a document is dated to, for the confessions' chronological
  // order: the catalogue's date, else the year its title prints, else the
  // middle of its century. Undated sorts last.
  function yearOf(w) {
    if (w._y !== undefined) return w._y;
    const hit = String(w.date || w.eyebrow || "").match(/\b(\d{3,4})\b/)
      || String(w.title || "").match(/\((?:c\.\s*)?(\d{2,4})\b[^)]*\)/);
    const y = hit ? parseInt(hit[1], 10) : 0;
    const c = cent(w);
    w._y = y > 0 && y < 2100 ? y : (c ? c * 100 - 50 : 9999);
    return w._y;
  }

  // Derived once per work on load, not per keystroke.
  function cent(w) {
    return w._c === undefined ? (w._c = window.MOCentury ? window.MOCentury.of(w) : 0) : w._c;
  }

  // The filters. The box is answered separately, by tierOf, because a
  // search is not a filter: it has an order.
  function matches(w) {
    if (tradition && (isShelfAsk(tradition) ? shelfFamilyOf(w) !== tradition : topTrad(w) !== tradition)) return false;
    if (denomination && denomOf(w) !== denomination) return false;
    if (party && !inParty(w, party)) return false;
    if (century && cent(w) !== century) return false;
    if (collection && w.corpus !== collection) return false;
    return true;
  }

  // ── The box ──────────────────────────────────────────────────────
  //
  // One box, no "Search in". It works the way the corpus site's library
  // search does: the words are tried against the AUTHOR first, then the
  // title, then the catalogue's own words — subject, shelf, volume. A
  // work answers with the best tier it reaches, and the page is drawn in
  // that order: the authors whose name matched, each with their whole
  // shelf, and under them the other works whose title did. That is what
  // the "Search in" select was for. Baxter's name is in the title of
  // everything written against him, and one flat list buried the man
  // under the argument; ranking the author above the title keeps him on
  // top without asking the reader to choose a scope first. The
  // catalogue's own words count only when neither a name nor a title
  // answered, or "puritan" would list the shelf.
  //
  // Folded on both sides, so a reader who types the name the way it is
  // usually written finds it however the catalogue spells it: "leblanc"
  // reaches "Louis Le Blanc de Beaulieu", "sanchez" reaches "Sánchez",
  // "a lasco" reaches "à Lasco". Jake searched LeBlanc, got nothing, and
  // reasonably concluded the man was missing.
  const AUTHOR = 0, TITLE = 1, KEYWORD = 2, NONE = -1;
  function tierOf(w, q) {
    if (w._qa === undefined) w._qa = fold(w.author || "");
    if (w._qa.includes(q)) return AUTHOR;
    if (w._qt === undefined) w._qt = fold(`${w.title || ""} ${w.titleLatin || ""} ${window.MOCollectedContents?.search(w.id) || ""}`);
    if (w._qt.includes(q)) return TITLE;
    if (w._qk === undefined) {
      w._qk = fold([w.subject, w.topic, w.tradition, w.school, w.eyebrow, w.volume]
        .filter(Boolean).join(" "));
    }
    return w._qk.includes(q) ? KEYWORD : NONE;
  }

  // Lowercase, strip accents, drop everything that is not a letter or a
  // number. Spaces go too, which is the point.
  function fold(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  function pushState() {
    const q = new URLSearchParams();
    q.set("collection", collectionId);
    if (filter) q.set("q", filter);
    if (tradition) q.set("tradition", tradition);
    if (denomination) q.set("denomination", denomination);
    if (party) q.set("party", party);
    if (century) q.set("century", String(century));
    if (collection) q.set("in", collection);
    if (letter) q.set("letter", letter);
    // By author is the default and, like the others here, is left out
    // rather than written down. The shelf mark is what makes a volume
    // linkable, so it is the half that matters.
    if (shelf && view !== "author") {
      q.set("view", shelf.view);
      if (vol) q.set(shelf.param, vol);
    }
    if (page > 1) q.set("page", String(page));
    window.history.replaceState(null, "", `?${q.toString()}`);
  }

  // A work, under its author's name. The author is the block heading,
  // so the row carries the title and the work's own title only.
  //
  // `mark` is the small line at the end of the row, and defaults to the
  // work's volume, which is what tells two printings of one title
  // apart. A caller that has already said which volume this is passes
  // its own, or an empty string for none.
  // Where the work is, in the form its own shelf is cited by. The bare "101"
  // under a title in the Patrologia said nothing — a number with no series in
  // front of it is not an address. The catalogues already carry the citable
  // form in `eyebrow` for the four shelves that have one; the Latin Library is
  // cited by the volume of its set, and the confessions and the English
  // editions are not cited by place at all, so they get none rather than a
  // tradition name pretending to be a location.
  const WHERE = {
    pld: (w) => w.eyebrow, pg: (w) => w.eyebrow, po: (w) => w.eyebrow,
    eebo: (w) => w.eyebrow, tfr: (w) => w.volume,
  };
  function where(w) {
    const f = WHERE[w.corpus];
    return f ? String(f(w) || "").trim() : "";
  }

  function compareWorks(a, b) {
    // A leading "The", "A" or "An" does not file a title: "The First
    // Apology" at F. Self-contained on purpose: check-title-order.mjs
    // lifts this function out and runs it with only cmpTitle.
    const bare = (t) => String(t || "").replace(/^[^A-Za-z\u00C0-\u024F0-9]+/, "").replace(/^(?:the|a|an)\s+/i, "");
    return cmpTitle(bare(a.title), bare(b.title)) || cmpTitle(a.volume || "", b.volume || "");
  }

  // The earliest century an author's works are dated to, by name; set
  // once the catalogue is in. Before 1500 a name files as it is known.
  let authorCentury = new Map();
  function isEarly(name) {
    const c = authorCentury.get((name || "").trim());
    return Boolean(c) && c <= 15;
  }

  function row(w, mark) {
    const second = w.titleLatin && w.titleLatin !== w.title ? w.titleLatin : "";
    const second2 = second ? `<span class="brow-la">${escapeHtml(second)}</span>` : "";
    const contents=window.MOCollectedContents?.get(w.id);
    const rawMark = String(mark === undefined ? where(w) : mark || "").trim();
    const m = contents && rawMark.includes(" · ") ? rawMark.split(" · ")[0] : rawMark;
    // An address is short. "PL 101", "1640", "Tome 2 · fasc. 4" — the longest of
    // them is 28 characters, and they belong in the right-hand column where the
    // numbers line up. The Latin Library's volume field is not always an address:
    // it runs to 141 characters of description, and a volume of the Westminster
    // Assembly minutes put in a nowrap column took the whole row, squeezed the
    // title to nothing and set it one word per line with the description printed
    // over the top of it. Anything that long is a subtitle, so it goes under the
    // title where a subtitle goes, and wraps.
    const ADDRESS = 30;
    const vol = m && m.length <= ADDRESS ? `<span class="brow-m">${escapeHtml(m)}</span>` : "";
    const sub = m && m.length > ADDRESS ? `<span class="brow-sub">${escapeHtml(m)}</span>` : "";
    const preview=window.MOCollectedContents?.preview(w.id)||"";
    const details=window.MOCollectedContents?.disclosure(w.id)||"";
    const inner = `<span class="brow-t">${escapeHtml(w.title || w.id)}</span>${sub}${second2}${vol}${preview}`;
    // Facsimile or digital text, and the other edition's volume, when the work is
    // held both ways (faith-editions.js; outside the link — the slot holds links).
    const edition = window.MOEditions ? window.MOEditions.slot(w.url) : "";
    if (w.readable !== false && w.url) {
      return `<li${contents?' class="frcw-volume"':""}><a href="${escapeHtml(w.url)}">${inner}</a>${edition}${details}</li>`;
    }
    return `<li class="faith-room-pending"><span class="faith-room-row">${inner}</span></li>`;
  }

  // A name that names nobody. Migne's catalogue fills the author column with
  // the state of the question — "Unknown author", "Various", "Editors", the
  // Maurines who edited the volume — and a row reading "— Editors" says less
  // than a row saying nothing. Same list the corpus site suppresses.
  const NO_NAME = /^(unknown|auctor|various|editors|anonym|maurines|editores|unattributed)/i;

  // A work as it stands IN ITS VOLUME: the columns it occupies, its title, who
  // wrote it, and whether Migne wrote it rather than printed it.
  //
  // Not grouped under an author, and that is the point. A volume of the
  // Patrologia is a printed object with an order — column 10 to column 78,
  // then 79 to 82, then 83 to 90 — and grouping its contents under author
  // headings sorted A to Z destroys the one order the volume actually has.
  // The author moves onto the row instead, where it costs nothing.
  function volRow(w, num, oneAuthor) {
    // The gutter carries whatever locator the series is cited by: Migne's
    // column range in the two Patrologiae, the fascicle in the Orientalis,
    // which is how a tome is divided and how it is cited. A series with
    // neither gets no gutter at all rather than an empty one.
    const c = w.columns;
    const range = c ? `${c[0]}${c[1] !== c[0] ? `\u2013${c[1]}` : ""}` : "";
    // The volume number is set lighter than the columns: it is the same on
    // every row of the page and the head has already said it; the columns
    // are what the row is for.
    const cite = range ? `${num ? `<span class="brow-c-v">${num}:</span>` : ""}${escapeHtml(range)}` : "";
    const loc = cite || (w.fasc ? escapeHtml(`fasc. ${w.fasc}`) : "");
    // Every row keeps its gutter cell, filled or not: a row with nothing to
    // cite (an index, an admonition) otherwise slid into the gutter column
    // and its title wrapped there five words tall (PL 3, 2026-09-19).
    const col = loc
      ? `<span class="brow-c"${cite ? ' title="Migne columns"' : ""}>${loc}</span>`
      : `<span class="brow-c brow-c--blank" aria-hidden="true"></span>`;
    const second = w.titleLatin && w.titleLatin !== w.title ? w.titleLatin : "";
    const la = second ? `<span class="brow-la">${escapeHtml(second)}</span>` : "";
    const name = (w.author || "").trim();
    // One author's volume says so once, in the head. Printing "— Gregory of
    // Nyssa" against all twenty-four of his own entries is noise.
    // The dash and the space are in the text, not in a ::before, so a copied
    // row reads "Acts — Council of Carthage" rather than "ActsCouncil of Carthage".
    const who = name && !oneAuthor && !NO_NAME.test(name)
      ? ` <span class="brow-a">\u2014 ${escapeHtml(name)}</span>` : "";
    const kind = w.editorial ? ` <span class="brow-kind">Editorial</span>` : "";
    const inner = `${col}<span class="brow-t">${escapeHtml(w.title || w.id)}${who}${kind}</span>${la}`;
    // Migne's own apparatus is set a step quieter than the father it surrounds.
    const cls = w.editorial ? ' class="is-editorial"' : "";
    if (w.readable !== false && w.url) {
      return `<li${cls}><a href="${escapeHtml(w.url)}">${inner}</a></li>`;
    }
    return `<li class="faith-room-pending${w.editorial ? " is-editorial" : ""}"><span class="faith-room-row">${inner}</span></li>`;
  }

  // One block per author, laid out two across, exactly as the traditions
  // are on the browse page.
  // An author with a long shelf spans the full width and runs their works
  // in two columns. A block cannot break across a column, so leaving
  // Aquinas in one would hold the left column for pages together and
  // leave the right one empty.
  const WIDE_AT = 10;

  function authorLabel(value) {
    const raw = String(value || "");
    if (!raw.includes("&")) return raw;
    const decoder = document.createElement("textarea");
    // Decode entity tokens only. The resulting label is escaped before rendering.
    return raw.replace(/&(?:#[0-9]+|#x[0-9a-f]+|[a-z][a-z0-9]+);/gi, entity => {
      decoder.innerHTML = entity;
      return decoder.value;
    });
  }

  // The tradition page's address for a tradition group's name. The page
  // (custom-faith-tradition.hbs, assets/data/faith-received/traditions.json)
  // resolves every spelling a heading can carry, so this only slugs.
  const traditionHref = (name) => `/the-faith-received/tradition/?t=${encodeURIComponent(
    String(name || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))}`;

  // `kind` is the group's kind as the grouping decided it. A tradition or
  // century heading is not an author, and asking authorGroup about
  // "Baptist" answers "author": that is how every tradition panel on the
  // Confessions page came to link /author/?a=baptist, a page that cannot
  // load (Ian, 2026-09-24). Only the author view asks authorGroup.
  function block(name, list, markOf, kind) {
    const wide = list.length >= WIDE_AT ? " btrad--wide" : "";
    const key = fold(name);
    const group = kind === "tradition" || kind === "century"
      ? { kind, label: name }
      : window.MOFaithCatalogue.authorGroup(name, list);
    name = authorLabel(group.label);
    const rows = list.map((w) => row(w, markOf ? markOf(w) : undefined)).join("");
    const n = list.length;

    // Every author folds shut, and starts shut. Open, this page is tens
    // of thousands of rows; closed, it is an index of names, which is
    // what a reader scanning for someone actually wants.
    //
    // <details> rather than a button and a class: it opens on Enter and
    // on Space, it is announced as expanded or collapsed, and the
    // browser's own find-in-page opens a closed block to show a hit.
    // None of that is free when the fold is hand-rolled.
    //
    // The heading lives inside the summary, which is the one place the
    // content model allows a heading, so the outline still reads as a
    // list of authors.
    //
    // The author's own page used to hang off the heading. A link inside
    // a summary is a coin toss between navigating and toggling, so it
    // moved into the open panel, where it can say what it is: first in
    // it, directly under the name (Ian, 2026-09-24).
    // A tradition's panel opens on its own page in the same place (Ian,
    // 2026-09-24: "Looks like we need tradition pages!"). "Other" is the
    // bucket for undeclared documents and has no page.
    const all = key && group.kind === "author"
      ? `<a class="btrad-all btrad-all--top" href="/the-faith-received/author/?a=${encodeURIComponent(key)}">About ${escapeHtml(name)} &rarr;</a>`
      : group.kind === "tradition" && name !== "Other"
        ? `<a class="btrad-all btrad-all--top" href="${traditionHref(name)}">About ${escapeHtml(name)} &rarr;</a>`
        : "";
    // Dates beside the name, office beneath it — the shape the shelf
    // pages on the corpus site use, and the one a reader scanning two
    // thousand names needs to tell one Abbo from another.
    const note = authorNotes.get(key) || null;
    const dates = note && note.dates
      ? `<span class="btrad-dates">${escapeHtml(note.dates)}</span>` : "";
    const office = note && note.office
      ? `<span class="btrad-office">${escapeHtml(note.office)}</span>` : "";
    return `<details class="btrad${wide}">
  <summary class="btrad-sum"><h3>${escapeHtml(name)}${dates}<span class="btrad-n">${n.toLocaleString()} ${group.kind === "collection" ? (n === 1 ? "entry" : "entries") : (n === 1 ? "work" : "works")}</span></h3>${office}</summary>
  ${all}<ul class="blist">${rows}</ul>
</details>`;
  }

  // ── The volume grid ──────────────────────────────────────────────
  //
  // One tile per volume, carrying its number and how many works it
  // holds. The counts are taken off the same filtered list the author
  // view is drawing, so a search narrows the grid the way it narrows
  // the A-Z rail, and a volume that holds nothing under the current
  // filters is not drawn at all. That is also the whole answer to dead
  // tiles: a tile exists because works were counted into it.
  //
  // A bucket with no number takes the full width of the grid and prints
  // its name. There is exactly one today, the Patrologia Syriaca, whose
  // 38 works are shelved under "PS" in the catalogue. "PS" alone means
  // nothing on a page, and dropping the bucket would lose the works.
  function volTile(s, n) {
    const held = `${n.toLocaleString()} work${n === 1 ? "" : "s"}`;
    const wide = s.num ? "" : " faith-room-vol--wide";
    const face = s.num ? String(s.num) : escapeHtml(s.label || s.v);
    return `<button type="button" class="faith-room-vol${wide}${s.v === vol ? " is-active" : ""}"`
      + ` data-room-vol="${escapeHtml(s.v)}"`
      + ` aria-label="${escapeHtml(shelf.name(s))}, ${held}">`
      + `<span class="faith-room-vol-n">${face}</span>`
      + `<span class="faith-room-vol-c">${held}</span></button>`;
  }

  function volGrid(list) {
    const counts = new Map();
    let unshelved = 0;
    list.forEach((w) => {
      const v = String(shelf.of(w) || "");
      if (v) counts.set(v, (counts.get(v) || 0) + 1); else unshelved += 1;
    });
    const tiles = shelfOrder.filter((s) => counts.get(s.v));
    if (!tiles.length) {
      return `<p class="faith-room-status">Nothing matches that. Try another name or title.</p>`;
    }
    // Said plainly rather than left to be noticed. Every work in all
    // three collections carries a shelf mark today, so this line does
    // not print; it is here so that a catalogue that stops carrying one
    // does not quietly shrink the library instead.
    const rest = unshelved
      ? `<p class="faith-room-undated">${unshelved.toLocaleString()} work${unshelved === 1 ? " names" : "s name"} no ${shelf.one}</p>`
      : "";
    return `<p class="faith-room-shelf-note">${escapeHtml(shelf.lead)}</p>`
      + `<div class="faith-room-vols">${tiles.map((s) => volTile(s, counts.get(s.v))).join("")}</div>${rest}`;
  }

  // The heading over one volume's works, with the address a footnote
  // would print and the way back to the grid. The address is dropped
  // where it only repeats the heading, which is the Patrologia Syriaca:
  // that bucket is named rather than numbered, so the two lines were
  // the same line twice.
  // Who is in this volume, most published first, editors and "Unknown author"
  // left out: Migne bound a father's works together, so the volume has a
  // byline, and naming it in the head is what lets the rows below stop
  // repeating it.
  function volAuthors(list) {
    const c = new Map();
    list.forEach((w) => {
      const a = String(w.author || "").replace(/\s*\(.*$/, "").trim();
      if (!a || NO_NAME.test(a)) return;
      c.set(a, (c.get(a) || 0) + 1);
    });
    return [...c.entries()].sort((x, y) => y[1] - x[1]).map(([a]) => a);
  }

  function volHead(s, list) {
    const cite = shelf.cite(s);
    const line = cite && cite !== shelf.name(s)
      ? `<p class="faith-room-vol-cite">Cited as ${escapeHtml(cite)}</p>` : "";
    const who = volAuthors(list || []);
    const by = who.length
      ? `<p class="faith-room-vol-by">${escapeHtml(who.slice(0, 4).join(" \u00b7 "))}${who.length > 4 ? " \u00b7 \u2026" : ""}</p>`
      : "";
    return `<div class="faith-room-vol-head">`
      + `<h2>${escapeHtml(shelf.name(s))}</h2>${line}${by}`
      + `<button type="button" class="faith-room-vol-back" data-room-vol="">`
      + `&larr; All ${escapeHtml(shelf.many)}</button></div>`;
  }

  const pageHeading = document.querySelector(".bhero-title");
  const pageLede = document.querySelector(".bhero-lede");
  const originalHeading = pageHeading?.textContent || "";
  const originalLede = pageLede?.textContent || "";
  function updateRoomContext() {
    const narrowed = isAll && !!(filter || tradition || denomination || party || century || collection || letter || page > 1);
    const openers = document.querySelector("[data-faith-openers]");
    if (openers) openers.classList.toggle("is-filtered", narrowed);
    if (isAll) {
      const name = RESEARCH_NAMES[RESEARCH_SHELVES[denomination || tradition]] || "";
      if (pageHeading) pageHeading.textContent = shelfName(name) || originalHeading;
      if (pageLede) pageLede.textContent = name ? "Browse the works below, or search for an author or title." : originalLede;
    }
  }

  function render() {
    updateRoomContext();
    renderShelfResearch();
    // The denomination filter can move the reader from one series to
    // another, or off the Fathers entirely, between renders. A volume
    // number from the series they just left means nothing in the one they
    // arrived at, so it goes with the shelf.
    // The shelf follows the filters, because on the all-works page the filters are
    // what a shelf IS. A signature rather than one field: moving from Puritan to
    // Medieval changes which second view the works can answer, and so does
    // changing collection or century.
    const sig = [collection, tradition, denomination, party, century].join("\u0000");
    if (sig !== shelfSig) {
      shelfSig = sig;
      const next = shelfFor(denomination);
      if (next !== shelf) {
        const first = shelf === null;
        shelf = next;
        // First time this shelf is known, the address gets its say: a reader who
        // arrived on ?view=year&yr=1640 asked for that year before the catalogue
        // had even landed, and dropping it sent them to an empty grid.
        vol = first && shelf
          ? String(params.get(shelf.param) || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 12)
          : "";
        if (!shelf) view = "author";
        else if (vol || params.get("view") === shelf.view) view = shelf.view;
        else if (view !== "author") view = shelf.view;
      }
      rebuildShelfOrder();
    }
    const facet = works.filter(matches);
    // The box. Every work in hand answers with its tier; the catalogue's
    // own words count only when neither a name nor a title did.
    const q = fold(filter);
    let tiers = null;
    let filtered = facet;
    if (q) {
      tiers = new Map();
      let best = NONE;
      facet.forEach((w) => {
        const t = tierOf(w, q);
        if (t === NONE) return;
        tiers.set(w, t);
        if (best === NONE || t < best) best = t;
      });
      if (best !== NONE && best < KEYWORD) {
        tiers.forEach((t, w) => { if (t === KEYWORD) tiers.delete(w); });
      }
      filtered = facet.filter((w) => tiers.has(w));
    }
    // Three states, not two. By author is the page as it has always
    // been; the volume view is either the grid of volumes or one volume
    // opened, and on the grid there is no list of works to page
    // through.
    // On the creeds and confessions the century view is a list too (Ian,
    // 2026-09-24: "the same format as author, except just centuries"):
    // one fold per century, not a grid of centuries to choose from.
    const centuryList = BY_TRADITION && Boolean(shelf) && shelf.view === "century" && view === "century";
    const onShelf = Boolean(shelf) && view !== "author" && !centuryList;
    const onGrid = onShelf && !vol;
    const chosen = onShelf && vol ? shelfOrder.find((s) => s.v === vol) : null;
    const scoped = onShelf
      ? (vol ? filtered.filter((w) => String(shelf.of(w) || "") === vol) : [])
      : (letter ? filtered.filter((w) => initial(w.author) === letter) : filtered);
    // Group the whole filtered set under its authors first, then page the
    // authors. Grouping after the slice was what let one author land on
    // two pages.
    // Inside one volume there are no author blocks to page through: the volume
    // itself is the page. `order` is Migne's, set per series in faith-corpora.js.
    const inVolume = onShelf && Boolean(chosen) && shelf.printed === true;
    const printed = inVolume
      ? scoped.slice().sort((a, b) => (a.order == null ? Infinity : a.order) - (b.order == null ? Infinity : b.order)
        || compareWorks(a, b))
      : [];

    const allGroups = [];
    const byName = new Map();
    (inVolume ? [] : scoped).forEach((w) => {
      const name = centuryList
        ? (cent(w) ? (window.MOCentury ? window.MOCentury.label(Number(cent(w))) : `${cent(w)}th century`) : "Undated")
        : BY_TRADITION ? traditionOf(w) : ((w.author || "").trim() || "Unattributed");
      // By NAME, not by consecutive run. A run only merged neighbours,
      // and the catalogue's several "Unknown author" spellings interleave
      // in the sort, so one page of the Latin Fathers printed twenty-two
      // separate "Unknown author" rows. A name gets one block, at the
      // place it first appears.
      const key = `${w.corpus}|${w.id}`;
      let g = byName.get(name);
      if (!g) {
        g = { name, works: [], seen: new Set() };
        byName.set(name, g);
        allGroups.push(g);
      }
      if (!g.seen.has(key)) { g.seen.add(key); g.works.push(w); }
    });

    // The authors whose name matched come first, whole; then the other
    // works, under their authors. Stable, so each half keeps its A-Z.
    const authorHit = (g) => Boolean(tiers) && g.works.some((w) => tiers.get(w) === AUTHOR);
    const anyAuthor = Boolean(tiers) && allGroups.some(authorHit);
    const groupOrder = {tradition:0, century:0, author:1, unattributed:2, collection:3, editorial:4};
    // A century group sorts by its works' century; Undated goes last.
    const centuryRank = (g) => {
      const c = g.works.length ? Number(cent(g.works[0])) : NaN;
      return Number.isFinite(c) && c ? c : 99;
    };
    allGroups.forEach(g => { g.kind = centuryList ? "century" : BY_TRADITION ? "tradition" : window.MOFaithCatalogue.authorGroup(g.name, g.works).kind; });
    // Confessions read in the order they were written, inside a tradition
    // as inside a century (Ian, 2026-09-24). Undated documents close the
    // group, A-Z among themselves.
    if (BY_TRADITION) allGroups.forEach((g) => { g.works.sort((a, b) => yearOf(a) - yearOf(b) || compareWorks(a, b)); });
    allGroups.sort((a, b) => groupOrder[a.kind] - groupOrder[b.kind]
      || (centuryList ? centuryRank(a) - centuryRank(b) : 0)
      || (BY_TRADITION && !centuryList ? traditionRank(a.name) - traditionRank(b.name) || a.name.localeCompare(b.name) : 0)
      || (anyAuthor ? Number(authorHit(b)) - Number(authorHit(a)) : 0));

    const pages = inVolume ? 1 : Math.max(1, Math.ceil(allGroups.length / PAGE_SIZE));
    if (page > pages) page = pages;
    const groups = allGroups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const inCounts = new Map();
    if (isAll) works.forEach((w) => inCounts.set(w.corpus, (inCounts.get(w.corpus) || 0) + 1));
    const ins = [...inCounts.entries()].sort((a, b) => b[1] - a[1]);

    const cs = new Map();
    works.forEach((w) => {
      const c = cent(w);
      if (c) cs.set(c, (cs.get(c) || 0) + 1);
    });
    const cents = [...cs.entries()].sort((a, b) => a[0] - b[0]);

    // Counted at the top level, so "Protestant" reports the whole of
    // its denominations rather than only the works sitting on it.
    const tCounts = new Map();
    works.forEach((w) => {
      const t = topTrad(w);
      if (t) tCounts.set(t, (tCounts.get(t) || 0) + 1);
    });
    const trads = [...tCounts.entries()].sort((a, b) => b[1] - a[1]);

    // Denominations are offered only once their parent is chosen, and
    // only where that parent actually has children here.
    const denoms = tradition ? denomsUnder(works, tradition) : [];

    function select(name, label, all, options, current) {
      if (options.length < 2) return "";
      const opts = options.map(([value, text, n]) =>
        `<option value="${escapeHtml(value)}"${String(current) === String(value) ? " selected" : ""}>`
        + `${escapeHtml(text)} (${n.toLocaleString()})</option>`).join("");
      return `<label class="faith-room-select"><span>${escapeHtml(label)}</span>`
        + `<select data-room-${name}><option value="">${escapeHtml(all)}</option>${opts}</select></label>`;
    }

    const cLabel = (c) => (window.MOCentury ? window.MOCentury.label(c) : `${c}`);
    const controls = [
      isAll ? select("in", "Collection", "All collections",
        ins.filter(([id]) => !ONE_LIBRARY.has(id)).map(([id, n]) => {
          const c = window.MOCorpora.get(id);
          return [id, c ? c.label : id, n];
        }), collection) : "",
      select("cent", "Century", "All centuries",
        cents.map(([c, n]) => [c, cLabel(c), n]), century || ""),
      select("trad", "Tradition", "All traditions",
        trads.map(([t, n]) => [t, shelfName(t), n]), tradition),
      // Always in the shell, shown only when it has something to offer.
      // Built here rather than injected on change, because the shell is
      // written once and rewriting it mid-gesture is what tore the
      // dropdowns out from under the reader before.
      `<label class="faith-room-select" data-room-denom-wrap hidden><span data-room-denom-label>Denomination</span><select data-room-denom></select></label>`,
    ].filter(Boolean).join("");
    const filters = controls
      ? `<div class="faith-room-filters">${controls}<p class="faith-room-undated" data-room-undated hidden></p></div>`
      : "";

    // Counted by AUTHOR and not by work: the rail sits over a list of
    // names, so "A 215" has to mean 215 names under A. Counting works
    // would have promised 215 rows and shown a fraction of that.
    const letterCounts = new Map();
    new Set(filtered.map((w) => `${initial(w.author)}\u0000${fold(w.author)}`))
      .forEach((k) => {
        const l = k.split("\u0000")[0];
        letterCounts.set(l, (letterCounts.get(l) || 0) + 1);
      });
    const letters = [...letterCounts.keys()]
      .sort((a, b) => (a === "#") - (b === "#") || a.localeCompare(b));

    // What the count is counting. "8,989 works in the whole library" was
    // true of the page and false of the list under it once the filter had
    // cut the library down to one shelf, so a shelf in hand names itself.
    const label = isAll
      ? shelfName(denomination || tradition) || (collection && window.MOCorpora.get(collection)?.label) || "the whole library"
      : (corpus ? corpus.label : "the collection");
    // The rail files by the author's surname, which is the other view's
    // question. Inside a volume it would be a second index over at most
    // a few dozen works.
    const rail = letters.length > 1 && !onShelf
      ? `<nav class="faith-room-letters" aria-label="Jump to a letter"><button type="button" data-room-letter="" class="${letter ? "" : "is-active"}">All<span class="faith-room-letter-n">${
          [...letterCounts.values()].reduce((a, b) => a + b, 0).toLocaleString()}</span></button>${
          letters.map((l) => `<button type="button" data-room-letter="${l}" class="${letter === l ? "is-active" : ""}">${l}<span class="faith-room-letter-n">${
            letterCounts.get(l).toLocaleString()}</span></button>`).join("")}</nav>`
      : "";
    const volNum = inVolume && chosen ? (chosen.num || "") : "";
    const volWho = inVolume ? volAuthors(printed) : [];
    const oneAuthor = volWho.length === 1;
    const gutter = inVolume && printed.some((w) => w.columns || w.fasc)
      ? " faith-room-printed--loc" : "";
    const list = inVolume
      ? (printed.length
        ? `<ul class="blist faith-room-printed${gutter}">${printed.map((w) => volRow(w, volNum, oneAuthor)).join("")}</ul>`
        : `<p class="faith-room-status">Nothing matches that. Try another name or title.</p>`)
      : groups.length
        ? (() => {
        // TWO COLUMNS, and they are two real columns in the markup
        // rather than one balanced multicol. A balanced multicol
        // re-flows its whole content whenever anything in it changes
        // height, so opening an author could throw the block you just
        // clicked into the other column. Two independent columns each
        // flow on their own: opening an author in the left one pushes
        // only what is below it, and the right one does not move at
        // all. On a phone they collapse back into one run in order.
        const col = (list) => `<div class="btrads-col">${list
          .map((g) => block(g.name, g.works, onShelf ? shelf.mark : null, g.kind))
          .join("")}</div>`;
        const blocks = (list) => {
          const half = Math.ceil(list.length / 2);
          return `<div class="btrads faith-room-blocks faith-room-blocks--fold">`
            + `${col(list.slice(0, half))}${col(list.slice(half))}</div>`;
        };
        const headings = {author:'Authors', unattributed:'Unattributed works', collection:'Collections and editorial material', editorial:'Editors and reference material'};
        return Object.keys(groupOrder).map(kind => {
          const section = groups.filter(g => g.kind === kind);
          if (!section.length) return "";
          if (kind === 'author' && anyAuthor) {
            const named = section.filter(authorHit), others = section.filter(g => !authorHit(g));
            return (named.length ? `<h3 class="faith-room-section">Matching authors</h3>${blocks(named)}` : "")
              + (others.length ? `<h3 class="faith-room-section">Other matching works</h3>${blocks(others)}` : "");
          }
          if (kind === 'tradition') return blocks(section);
          return `<h3 class="faith-room-section">${headings[kind]}</h3>${blocks(section)}`;
        }).join("");
        })()
        : `<p class="faith-room-status">Nothing matches that. Try another name or title.</p>`;
    // An address that names no volume in this collection is the one
    // case where a reader can arrive holding something we cannot open,
    // so it says so and puts the grid back within reach.
    let body = list;
    if (party === ASSEMBLY && rosterState !== "ready") {
      // The Assembly is its roster, and the roster is a second file. A
      // reader arriving on ?party=Westminster+Assembly asked for it
      // before that file had landed; an empty list would read as an
      // empty shelf, so the page says what it is waiting for.
      body = `<p class="faith-room-status">${rosterState === "failed"
        ? "The Westminster Assembly&rsquo;s roster could not be loaded. Reload the page to try again."
        : "Loading the Westminster Assembly&rsquo;s roster&hellip;"}</p>`;
    } else if (onGrid) {
      body = volGrid(filtered);
    } else if (onShelf && chosen) {
      body = volHead(chosen, printed) + list;
    } else if (onShelf) {
      body = `<p class="faith-room-status">There is no ${escapeHtml(shelf.one)} ${escapeHtml(vol)} in ${escapeHtml(label)}.</p>`
        + `<p><button type="button" class="faith-room-vol-back" data-room-vol="">&larr; All ${escapeHtml(shelf.many)}</button></p>`;
    }

    // Two doors into the same shelf, and only where the collection has
    // a second one. By author is written first and is the default, so a
    // reader who has never heard of a Migne citation is not asked to
    // choose before they can read anything.
    // Written whenever the page can ever have a shelf, not only when it has
    // one now: the shell is built once, and on the all-works page the
    // Denomination filter can hand the reader a series after that. A nav
    // that was never written cannot be shown later, so it is written and
    // hidden, and the block below keeps its name and its state in step.
    const views = `${shelf || isAll
      ? `<nav class="faith-view-toggle faith-room-views" role="tablist" aria-label="How to browse this collection"${shelf ? "" : " hidden"}>`
        + `<button type="button" class="faith-view-toggle-tab" data-room-view="author" role="tab">${BY_TRADITION ? "By tradition" : "By author"}</button>`
        + `<button type="button" class="faith-view-toggle-tab" data-room-shelf-tab data-room-view="${shelf ? shelf.view : "volume"}" role="tab">${escapeHtml(shelf ? shelf.tab : "By volume")}</button>`
        + `</nav>`
      : ""
      // The party TABS are gone (Ian, 2026-09-22: "I'm not sure we need
      // this"). They asked a question the shelf pages already answer —
      // /the-faith-received/puritans/ and /anglicans/ are those two
      // parties, each with its own page — and the third tab was not a
      // party at all but the Westminster Assembly's roster.
      //
      // The party AXIS stays underneath: `?party=` still filters, and
      // the canonicaliser above still turns an older ?tradition=Puritan
      // link into it, so every link anyone has bookmarked still lands
      // where it did. The count line says which party is in hand, and
      // picking any tradition or denomination clears it.
       }`;

    // What the count reports is whatever the reader is looking at: the
    // works in the collection, the volumes on the shelf, or the works
    // in the one volume they have opened.
    // A search says what it matched; a party says which it is.
    const matching = filter ? ` matching &ldquo;${escapeHtml(filter)}&rdquo;` : "";
    const within = party ? ` &middot; ${escapeHtml(party)}` : "";
    // One library: English editions are counted as works (MOFaithCatalogue.countLabel adds "+ N English editions").
    const oneCount = (list) => `${list.length.toLocaleString()} work${list.length === 1 ? "" : "s"}`;
    let counted = `${oneCount(scoped)}${matching} in ${escapeHtml(label)}${within}`;
    if (party === ASSEMBLY && rosterState !== "ready") counted = "";
    if (onGrid) {
      const shelved = new Set();
      filtered.forEach((w) => {
        const v = String(shelf.of(w) || "");
        if (v) shelved.add(v);
      });
      counted = `${shelved.size.toLocaleString()} ${shelved.size === 1 ? shelf.one : shelf.many}`
        + ` &middot; ${filtered.length.toLocaleString()} work${filtered.length === 1 ? "" : "s"}${matching} in ${escapeHtml(label)}${within}`;
    } else if (onShelf && chosen) {
      counted = `${scoped.length.toLocaleString()} work${scoped.length === 1 ? "" : "s"} in ${escapeHtml(shelf.name(chosen))}`;
    } else if (onShelf) {
      // An address that names nothing here. The collection's own total
      // is the true thing to print: a bare zero beside its name would
      // read as an empty shelf rather than a bad link.
      counted = `${oneCount(filtered)}${matching} in ${escapeHtml(label)}${within}`;
    }

    // The search box and the selects are built once and left alone.
    // Rewriting the whole subtree on every render tore them out from
    // under the reader: an open dropdown vanished the moment it was
    // touched, because choosing an option rebuilt the element.
    if (!root.querySelector("[data-room-shell]")) {
      // The search, count, filters and letter rail sit in one thin-line
      // panel (.faith-room-panel), as the controls on every other TFR
      // surface do (Ian, 2026-09-23).
      root.innerHTML = `<div data-room-shell>${views}<div class="faith-room-panel"><div class="faith-room-head"><div class="faith-room-searchbar"><input type="search" class="faith-room-filter" data-room-filter placeholder="Search an author or a title&hellip;" value="${escapeHtml(filter)}" aria-label="Search this collection by author or title" /></div><p class="faith-room-count" data-room-count></p></div><div data-room-controls>${filters}</div><div data-room-rail></div></div><div data-room-list></div><div data-room-pager></div></div>`;
      wireOnce();
    }

    root.querySelector("[data-room-count]").innerHTML = counted;
    const undatedNote = root.querySelector("[data-room-undated]");
    if (undatedNote) {
      const n = scoped.filter(w => !cent(w)).length;
      undatedNote.hidden = !n;
      undatedNote.textContent = `${n.toLocaleString()} ${n === 1 ? "work has" : "works have"} no date`;
    }
    root.querySelector("[data-room-rail]").innerHTML = rail;
    root.querySelector("[data-room-list]").innerHTML = body;
    // The grid of volumes is one screen of tiles and has nothing to
    // page through.
    root.querySelector("[data-room-pager]").innerHTML = onGrid || inVolume ? "" : pager(page, pages);

    // The toggle is part of the shell and is never rebuilt, so the chosen
    // view is marked on it here rather than written into it. On the
    // all-works page the shelf itself changes under the Denomination
    // filter, so the second tab's name and the view it selects are kept in
    // step too, and the whole nav goes when the filter names no series:
    // "By volume" over a list of every tradition in the library would
    // promise a grid that cannot be drawn.
    const viewsNav = root.querySelector(".faith-room-views");
    if (viewsNav) {
      viewsNav.hidden = !shelf;
      const shelfTab = viewsNav.querySelector("[data-room-shelf-tab]");
      if (shelfTab && shelf) {
        if (shelfTab.getAttribute("data-room-view") !== shelf.view) shelfTab.setAttribute("data-room-view", shelf.view);
        if (shelfTab.textContent !== shelf.tab) shelfTab.textContent = shelf.tab;
      }
    }
    root.querySelectorAll("[data-room-view]").forEach((b) => {
      const on = b.getAttribute("data-room-view") === view;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });

    // The denomination list follows the chosen tradition, so its options
    // are rewritten when that choice changes. Guarded on the option set
    // actually differing: this element must not be touched while the
    // reader has it open, and the only thing that changes it is a
    // different select.
    const dWrap = root.querySelector("[data-room-denom-wrap]");
    const dSel = root.querySelector("[data-room-denom]");
    if (dWrap && dSel) {
      const [dLabel, dAll] = childLabel(tradition);
      const dOpts = denoms.map(([t, n]) =>
        `<option value="${escapeHtml(t)}">${escapeHtml(shelfName(t))} (${n.toLocaleString()})</option>`).join("");
      const want = denoms.length ? `<option value="">${escapeHtml(dAll)}</option>${dOpts}` : "";
      if (dSel.innerHTML !== want) dSel.innerHTML = want;
      const dSpan = root.querySelector("[data-room-denom-label]");
      if (dSpan && dSpan.textContent !== dLabel) dSpan.textContent = dLabel;
      dWrap.hidden = !denoms.length;
    }
    // Keep the selects in step with the state without replacing them.
    [["in", collection], ["cent", century || ""], ["trad", tradition],
      ["denom", denomination]].forEach(([k, v]) => {
      const el = root.querySelector(`[data-room-${k}]`);
      if (el && el.value !== String(v)) el.value = String(v);
    });

    wireList();
    pushState();
  }


  // 1 … 5 6 [7] 8 9 … 42
  //
  // Previous and Next alone make a reader who wants page nine press
  // Next seven times, and give no way at all to reach the end. The
  // window is the first page, the last, and two either side of where
  // the reader is; the gaps are elided rather than printing forty
  // numbers across a phone.
  // Paging by author brought the count down from 180 to a number worth
  // printing in full, and a reader who can see page 14 can go straight
  // to it. Past forty the row would wrap into a block of numbers on a
  // phone, so the elided window below takes over again.
  const ALL_PAGES_UP_TO = 40;

  function pageWindow(page, pages) {
    const out = [];
    const push = (n) => { if (out[out.length - 1] !== n) out.push(n); };
    if (pages <= ALL_PAGES_UP_TO) {
      for (let n = 1; n <= pages; n += 1) out.push(n);
      return out;
    }
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

  function pager(p, pages) {
    if (pages < 2) return "";
    return `<nav class="faith-room-pager" aria-label="Pages">` +
      `<button type="button" data-room-page="${p - 1}" ${p <= 1 ? "disabled" : ""}>&larr; Previous</button>` +
      `<span class="faith-pager-nums">${pageLinks(p, pages, "data-room-page")}</span>` +
      `<button type="button" data-room-page="${p + 1}" ${p >= pages ? "disabled" : ""}>Next &rarr;</button>` +
      `</nav>`;
  }

  // Bound once, on elements that are never rebuilt.
  function wireOnce() {
    const input = root.querySelector("[data-room-filter]");
    if (input) {
      let t = null;
      input.addEventListener("input", () => {
        window.clearTimeout(t);
        t = window.setTimeout(() => {
          filter = input.value.trim();
          page = 1;
          render();
        }, 180);
      });
    }
    const onPick = (sel, apply) => {
      const el = root.querySelector(`[data-room-${sel}]`);
      if (!el) return;
      el.addEventListener("change", () => {
        apply(el.value);
        letter = "";
        page = 1;
        render();
      });
    };
    onPick("in", (v) => { collection = v; });
    onPick("cent", (v) => { century = parseInt(v, 10) || 0; });
    // Changing the tradition drops any denomination under the old one,
    // which would otherwise filter to nothing.
    onPick("trad", (v) => { tradition = v; denomination = ""; party = ""; });
    onPick("denom", (v) => { denomination = v; party = ""; });
    // Switching views drops the other view's place in the shelf: a
    // letter means nothing inside a volume, and a volume means nothing
    // under an A-Z.
    root.querySelectorAll("[data-room-view]").forEach((b) => {
      b.addEventListener("click", () => {
        const next = b.getAttribute("data-room-view");
        if (next === view) return;
        view = next;
        letter = "";
        vol = "";
        page = 1;
        render();
      });
    });
  }

  function wireList() {
    // Both the tiles and the way back out of one. An empty value is the
    // way back, which is why this reads the attribute rather than
    // trusting the button's class.
    root.querySelectorAll("[data-room-vol]").forEach((b) => {
      b.addEventListener("click", () => {
        vol = b.getAttribute("data-room-vol") || "";
        page = 1;
        render();
        root.scrollIntoView({ block: "start" });
      });
    });
    root.querySelectorAll("[data-room-letter]").forEach((b) => {
      b.addEventListener("click", () => {
        letter = b.getAttribute("data-room-letter");
        page = 1;
        render();
        root.scrollIntoView({ block: "start" });
      });
    });
    root.querySelectorAll("[data-room-page]").forEach((b) => {
      b.addEventListener("click", () => {
        const n = parseInt(b.getAttribute("data-room-page"), 10);
        if (!isNaN(n)) { page = n; render(); root.scrollIntoView({ block: "start" }); }
      });
    });
  }

  updateRoomContext();
})();
