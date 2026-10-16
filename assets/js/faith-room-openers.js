/* The two ways into the library, above the table of contents.
 *
 * "Continue reading" is the reader's own history: the reader writes
 * fr_lastread on every page turn, so this is the same record the ported
 * library landing read. "Browse the shelves" is the catalogue grouped by
 * tradition, which is the same facet the room's Tradition filter cuts on,
 * so a shelf is a link into the table of contents below rather than a
 * separate page.
 *
 * Both sections remove themselves when they have nothing to say. A reader
 * with no history sees the shelves alone, and neither leaves a heading
 * standing over an empty row.
 */
(function () {
  "use strict";

  const root = document.querySelector("[data-faith-openers]");
  if (!root || !window.MOCorpora) return;

  // The same seven the room reads on the all-works page. Kept in step
  // deliberately: a shelf count that disagrees with the table of
  // contents under it is worse than no shelf count at all.
  const ALL = ["pg", "pld", "po", "tfr", "eebo", "mo"];

  // The shelves that are a room. Each of these rooms declares the same
  // tradition in its tfr-room-shelf meta, so what it lists and what this
  // card counts are the same set of works, down to the last one.
  const SHELF_ROOM = {
    "Latin Fathers": "/the-faith-received/patrologia-latina/",
    "Greek Fathers": "/the-faith-received/patrologia-graeca/",
    "Eastern Fathers": "/the-faith-received/patrologia-orientalis/",
  };

  // English Divines is ONE shelf. Early English Books files its works by
  // party, Puritan or Anglican, and the Latin Library files the same men
  // under "English Divines" with the party in a field of its own — three
  // shelves for one body of divinity, and "Anglican" standing beside
  // "English Divines" as if it were something else. The room already
  // reads them as one family (faith-room.js, FAMILY); the strip does the
  // same, and prints the parties under the shelf as its subsets, each a
  // door into the room cut to that party. The Westminster Assembly is the
  // third subset: a body rather than a party, its roster the explicit
  // list in v1/schools.json, so a work can be Puritan and on it.
  const FAMILY = { Puritan: "English Divines", Anglican: "English Divines" };
  const ENGLISH = "English Divines";
  const ASSEMBLY = "Westminster Assembly";
  // Methodist (2026-09-29): the Wesleyans, a party of the English Divines like the other two; shown only once works carry it.
  const PARTIES = ["Puritan", "Anglican", "Methodist", ASSEMBLY];
  function rosterKey(slug) {
    const m = /^eebo-(\d+)$/.exec(slug);
    return m ? `eebo|${m[1]}` : `tfr|${slug}`;
  }
  // Lowercase, strip accents, drop everything that is not a letter or a
  // number — the room's fold, so a roster name and a catalogue name meet.
  const fold = (s) => String(s || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  // The roster's works by slug, and its members by name: the corpus site's
  // rule (a work is the Assembly's if its slug is on the roster OR its
  // author is a member), so both sites file the same work the same way.
  function loadRoster() {
    const tfr = window.MOCorpora.get("tfr");
    return fetch(`${(tfr && tfr.base) || ""}/v1/schools.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => {
        const e = ((d || {})[ASSEMBLY] || {});
        return {
          keys: new Set((e.slugs || []).map((x) => rosterKey(String(x)))),
          authors: new Set((e.authors || []).map((a) => fold(a))),
        };
      })
      .catch(() => ({ keys: new Set(), authors: new Set() }));
  }

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
  const num = (n) => Number(n).toLocaleString();

  /* ---- Continue reading ------------------------------------------- */

  function continueReading() {
    let lr;
    try {
      lr = JSON.parse(localStorage.getItem("fr_lastread") || "{}");
    } catch (e) { return ""; }
    if (!lr || typeof lr !== "object") return "";

    const items = Object.keys(lr)
      .map((k) => [k, lr[k]])
      .filter(([key, e]) => window.MOFaithCatalogue.displayWork(e?.slug || key))
      .filter(([, e]) => e && e.page !== null && e.page !== undefined &&
        e.page !== "" && (e.slug || e.title))
      .sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0))
      .slice(0, 4);
    if (!items.length) return "";

    const cards = items.map(([ws, e]) => {
      const slug = e.slug || ws;
      const title = e.title || String(ws).split("/").pop();
      // The reader anchors a page as #b<page>-0, so the link reopens on
      // the page last read rather than at the title page.
      const href = `/the-faith-received/read/?w=${encodeURIComponent(slug)}`
        + `#b${encodeURIComponent(e.page)}-0`;
      const contents=window.MOCollectedContents?.get(slug);
      const preview=window.MOCollectedContents?.preview(slug)||"";
      const meta = [e.author, contents?.volume, `fol. ${e.page}`].filter(Boolean).join(" · ");
      return `<a class="fro-card" href="${esc(href)}" title="${esc(title)}">` +
        `<span class="fro-card-t">${esc(title)}</span>` +
        `<span class="fro-card-m">${esc(meta)}</span>${preview}</a>`;
    }).join("");

    return `<div class="fro-block fro-continue">` +
      `<h2 class="fro-h">Continue reading</h2>` +
      `<div class="fro-cards">${cards}</div></div>`;
  }

  /* ---- Browse the shelves ------------------------------------------ */

  // The source library's nine shelf research doors. The code travels with
  // each link so moving from the catalogue to research keeps its scope.
  const RESEARCH_SHELVES = {
    "Latin Fathers": "pl", "Greek Fathers": "gf", "Eastern Fathers": "po",
    "Medieval": "md", "Roman Catholic": "rc", "Reformed": "rf",
    "Continental Reformed": "rf", "English Divines": "ed", "Lutheran": "lu",
    "Humanism and Law": "hl"
  };
  // Printed shelf names go through the one display rule ("English
  // Divines" reads "English writers"). Keys, links and matching keep
  // the data's own name.
  const shelfName = (t) => (window.MOFaithLabel ? window.MOFaithLabel.shelf(t) : t);
  // The shelves with a guide in motion (/the-faith-received/guide/?s=). The
  // links stay hidden until faith-guide-links.js finds that route live.
  const GUIDES = { pl: "latin", gf: "greek", po: "eastern", md: "medieval", rc: "catholic", rf: "reformed", lu: "lutheran", ed: "english" };
  // The guides of a shelf as buttons beside it (owner, 2026-10-11: "make the guides easier to click into"):
  // the shelf's own guide, and on the English shelf the guides to its parties as well.
  const SUBGUIDES = { ed: [["puritans", "the Puritans"], ["anglicans", "the Anglicans"], ["methodists", "the Methodists"], ["westminster", "the Westminster Assembly"]] };
  function guideButtons(name) {
    const sh = RESEARCH_SHELVES[name];
    if (!sh || !GUIDES[sh]) return "";
    const base = "/the-faith-received/guide/?s=";
    const subs = (SUBGUIDES[sh] || []).map(([k, t]) => `<a class="fro-shelf-sub" href="${base}${k}">${esc(t)}</a>`);
    return `<p class="fro-shelf-guides" data-guide-link hidden><a class="fr-btn" href="${base}${GUIDES[sh]}">Guide to this shelf</a>${ 
      subs.length ? `<span class="fro-shelf-subs"><span class="fro-shelf-subs-l">Guides to</span>${subs.join('<span class="fro-shelf-sep"> · </span>')}</span>` : "" 
      }</p>`;
  }
  function studyShelf(name) {
    const sh = RESEARCH_SHELVES[name];
    if (!sh) return "";
    const base = "/the-faith-received/";
    const trad = name === "Reformed" ? "Continental Reformed" : name;
    // The DCT on the Roman Catholic shelf only (Ian, 2026-09-24).
    const dct = sh === "rc" ? `<a href="${base}dictionary/">Dictionary of Catholic Theology</a>` : "";
    return `<details class="fro-study"><summary>Study this shelf</summary>` +
      `<nav aria-label="Study ${esc(shelfName(name))}">` +
      `${GUIDES[sh] ? `<a href="${base}guide/?s=${GUIDES[sh]}" data-guide-link hidden>Guide to this shelf</a>` : ""}` +
      `${(SUBGUIDES[sh] || []).map(([k, t]) => `<a href="${base}guide/?s=${k}" data-guide-link hidden>Guide to ${esc(t)}</a>`).join("")}` +
      `<a href="${base}ask/?trad=${encodeURIComponent(trad)}">Ask this shelf</a>` +
      `<a href="${base}bible/?sh=${sh}">Scripture</a>` +
      `<a href="${base}author/?sh=${sh}">Authors</a>` +
      `<a href="${base}topics/?sh=${sh}">Topics</a>` +
      `<a href="${base}web/#shelves=${trad === "Continental Reformed" ? "reformed" : trad.toLowerCase().replace(/ /g,"-")}/authors">Connections</a>` +
      `${dct}` +
      `</nav></details>`;
  }


  // A catalogue's stand-in for a name it does not have. Naming these
  // under a shelf tells a reader nothing, and "Unknown author · Editors ·
  // Various authors" under the Latin Fathers is worse than no line at
  // all, so they are skipped and the next real name takes the place.
  const PLACEHOLDER = /^(unknown|anonymous|anon|various|editors?|unknown author|various authors|no author|s\.n\.)\b/i;

  // Early English Books files a name inverted, with dates: "Prynne,
  // William, 1600-1669". That is a sort key, not a name, and printing it
  // under a shelf reads as a database leak. Turned back into a name for
  // display only; the room still sorts on its own surname key.
  function displayName(raw) {
    const s = String(raw || "").trim().replace(/^\[+/, "").replace(/\]+$/, "").trim();
    if (!s) return "";
    const parts = s.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) return s;
    // A trailing part that is only dates is the catalogue's, not the
    // name's. What is left is surname, forename.
    const named = parts.filter((p) => !/^(?:b\.|d\.|ca\.|fl\.|active\s)?\s*\d{3,4}\??(?:\s*[-–]\s*\d{0,4}\??)?$/i.test(p));
    if (named.length < 2) return named[0] || s;
    // Not every comma is an inversion. "Jacques d'Édesse, traductions
    // syriaques" is a name followed by a descriptor, and swapping those
    // produces "traductions syriaques Jacques d'Édesse". A forename opens
    // with a capital and is a word or two; anything else is left alone.
    const fore = named[1];
    if (!/^\p{Lu}/u.test(fore) || fore.split(/\s+/).length > 2) return named[0];
    return `${fore} ${named[0]}`;
  }

  // A shelf is a tradition as the catalogue declares it. Where that
  // tradition sits under a parent the shelf keeps its own name and the
  // parent becomes the group it prints under, so "English Divines" reads
  // as itself rather than disappearing into "Protestant".
  // The shelves, in the TFR home's order and no others (Ian, 2026-09-24:
  // "that section should be the exact same sections as on the home page.
  // All 10."). Keep in step with "The shelves" in custom-the-faith-received.hbs.
  const HOME_SHELVES = [
    "Confessions", "Councils", "Latin Fathers", "Greek Fathers", "Eastern Fathers", "Medieval",
    "Roman Catholic", "Continental Reformed", ENGLISH, "Lutheran", "Humanism and Law",
  ];
  // The confessions are a collection of their own, not a tradition, so
  // their card is built from that catalogue and opens its room.
  const CONFESSIONS = {
    label: "Creeds, Confessions, & Catechisms",
    href: "/the-faith-received/confessions/",
    who: "Nicaea · Chalcedon · Augsburg · Trent · Westminster",
  };
  // Mansi's acts of the councils are a shelf of their own (owner, 2026-10-11: "add Mansi's Acts as a
  // separate shelf please, The Councils, with its guide like PL"): the councils and synods themselves,
  // where the creeds and confessions above are the documents every tradition confesses. Its works file
  // under Roman Catholic in the catalogue and stay there too, counted on both shelves (owner, 2026-10-11:
  // "double count mansi as its own shelf ... double shelving is fine"), so each count matches its list.
  const COUNCILS = {
    label: "The Councils",
    href: "/the-faith-received/guide/?s=councils",
    who: "Mansi · from the apostles at Jerusalem to the First Vatican Council",
    first: "/the-faith-received/read/?w=mansi-sacrorum-conciliorum-collectio-1",
  };
  const isMansi = (w) => /^mansi-/.test(String(w.id || w.slug || ""));

  function shelves(works, roster, confessions) {
    const by = new Map();
    let councils = 0;

    works.forEach((w) => {
      let t = String(w.tradition || "").trim();
      if (!t) return;
      if (isMansi(w)) councils++;
      const parent = (window.MOCorpora.traditionParent
        ? window.MOCorpora.traditionParent(t, w.corpus) : "") || "";
      // The party, then the family it files under.
      let party = "";
      if (FAMILY[t] && parent === "Protestant") { party = t; t = FAMILY[t]; }
      else if (t === ENGLISH) party = String(w.party || "").trim();
      let s = by.get(t);
      if (!s) {
        s = { name: t, parent, n: 0, works: [], authors: new Map(), parties: new Map() };
        by.set(t, s);
      }
      s.n++;
      s.works.push(w);
      if (party) s.parties.set(party, (s.parties.get(party) || 0) + 1);
      // The Assembly is a subset of the English Divines and of nothing
      // else: two of its members' works file under Reformed in the Latin
      // Library, and counted there they made a one-line "Westminster
      // Assembly 2" under that shelf.
      if (t === ENGLISH && roster && (roster.keys.has(`${w.corpus}|${w.id}`) || roster.authors.has(fold(displayName(w.author))))) {
        s.parties.set(ASSEMBLY, (s.parties.get(ASSEMBLY) || 0) + 1);
      }
      const a = String(w.author || "").trim();
      if (a && !PLACEHOLDER.test(a)) s.authors.set(a, (s.authors.get(a) || 0) + 1);
    });

    if (!by.size) return "";
    const list = HOME_SHELVES.map((name) => (name === "Confessions"
      ? ((confessions || []).length ? { name, confessions: true, n: confessions.length, works: [], authors: new Map(), parties: new Map() } : null)
      : name === "Councils" ? (councils ? { name, councils: true, n: councils } : null)
      : by.get(name))).filter(Boolean);
    if (!list.length) return "";

    const rows = list.map((s) => {
      if (s.councils) {
        return `<li class="fro-shelf"><a href="${esc(COUNCILS.href)}">` +
          `<span class="fro-shelf-row">` +
          `<span class="fro-shelf-name">${esc(COUNCILS.label)}</span>` +
          `<span class="fro-shelf-n"><b>${num(s.n)}</b> ${s.n === 1 ? "volume" : "volumes"}</span>` +
          `</span><span class="fro-shelf-who">${esc(COUNCILS.who)}</span></a>` +
          `<p class="fro-shelf-guides" data-guide-link hidden><a class="fr-btn" href="${esc(COUNCILS.href)}">Guide to the Councils</a></p>` +
          `<details class="fro-study"><summary>Study this shelf</summary>` +
          `<nav aria-label="Study ${esc(COUNCILS.label)}">` +
          `<a href="${esc(COUNCILS.href)}" data-guide-link hidden>Guide to this shelf</a>` +
          `<a href="${esc(COUNCILS.first)}">Read the first volume</a>` +
          // every page of the 57 tomes, in the guide's own search (2026-10-16: "make it easy to do on multiple surfaces")
          `<a href="${esc(COUNCILS.href)}#find">Search the text of every tome</a>` +
          `</nav></details></li>`;
      }
      if (s.confessions) {
        return `<li class="fro-shelf"><a href="${esc(CONFESSIONS.href)}">` +
          `<span class="fro-shelf-row">` +
          `<span class="fro-shelf-name">${esc(CONFESSIONS.label)}</span>` +
          `<span class="fro-shelf-n"><b>${num(s.n)}</b> ${s.n === 1 ? "document" : "documents"}</span>` +
          `</span><span class="fro-shelf-who">${esc(CONFESSIONS.who)}</span></a>` +
          // Its study doors: the confessions set side by side, and the
          // topics, where every topic opens on what the confessions say.
          `<details class="fro-study"><summary>Study this shelf</summary>` +
          `<nav aria-label="Study ${esc(CONFESSIONS.label)}">` +
          `<a href="/the-faith-received/research/#compare">Compare</a>` +
          `<a href="/the-faith-received/topics/">Topics</a>` +
          `</nav></details></li>`;
      }
      const extra = s.works.filter(w => w.supplement).length;
      const core = s.n - extra;
      // The filter contract the room reads: a tradition with a parent is
      // reached as a denomination under it, one without is a tradition
      // in its own right.
      const q = new URLSearchParams({ collection: "all" });
      // The shelf by name, parent or child. This used to send a child
      // shelf as tradition=<parent>&denomination=<name>, which works
      // only where the child is also a church: "English Divines" is not
      // one (its works are Anglican, Presbyterian, Congregational), so
      // that door opened on all 5,140 Protestant works under a card
      // promising 4,426. faith-room.js reads a child tradition as the
      // shelf it names.
      q.set("tradition", s.name);
      // Three shelves have a room of their own, and a room is the better
      // door: it opens on an index of AUTHORS, each with dates and
      // office, and it offers the volume view beside it, because Migne is
      // cited by volume and column and a reader arriving with a citation
      // needs that first. The table below cuts by tradition and is the
      // right answer for every shelf that has no room.
      // esc() ONCE, on output. Building the href pre-escaped and escaping it again
      // at the attribute turned every & into &amp;amp;, so the browser followed a
      // literal "?collection=all&amp;tradition=Protestant" and every shelf without a
      // room of its own landed on the unfiltered table (2026-09-17).
      const room = SHELF_ROOM[s.name];
      const href = room || `?${q.toString()}`;

      // The three names a reader is most likely to recognise, which is
      // the three most published, not the first three alphabetically.
      const names = Array.from(s.authors.entries())
        .sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([a]) => displayName(a)).filter(Boolean);
      const under = names.length
        ? `<span class="fro-shelf-who">${esc(names.join(" · "))}`
          + `${s.authors.size > names.length ? " · …" : ""}</span>`
        : "";

      // The subsets of a shelf that has them, each its own door: the
      // room cut to that party. Outside the shelf's own link, because a
      // link inside a link is not markup.
      const subs = PARTIES.filter((p) => s.parties.get(p)).map((p) => {
        const pq = new URLSearchParams(q);
        pq.set("party", p);
        return `<a class="fro-shelf-sub" href="?${esc(pq.toString())}">${esc(p)} <b>${num(s.parties.get(p))}</b></a>`;
      });
      const within = subs.length
        ? `<span class="fro-shelf-subs"><span class="fro-shelf-subs-l">Within</span>${subs.join('<span class="fro-shelf-sep"> · </span>')}</span>`
        : "";

      return `<li class="fro-shelf"><a href="${esc(href)}">` +
        `<span class="fro-shelf-row">` +
        `<span class="fro-shelf-name">${esc(shelfName(s.name))}</span>` +
        // One library: the English editions are works on the shelf like any other, counted with it.
        `<span class="fro-shelf-n"><b>${num(core + extra)}</b> ${core + extra === 1 ? "work" : "works"}</span>` +
        `</span>${under}</a>${within}${guideButtons(s.name)}${studyShelf(s.name)}</li>`;
    }).join("");

    // No aggregate work count in the heading. Only a work with a declared
    // tradition can sit on a shelf, so that total is always smaller than
    // the catalogue's own, and printing it a few inches above "30,682
    // works in the whole library" reads as one of the two being wrong.
    // The smaller traditions are not shelves on the home page either;
    // they are in the Tradition filter below.
    const foot = `<p class="fro-foot">Smaller traditions are in the Tradition filter below.</p>` +
      `<p class="fro-foot fro-guides" data-guide-link hidden><a class="fr-btn" href="/the-faith-received/guide/">Guides to the shelves</a></p>`;

    // A fold, closed on arrival (Ian, 2026-09-23: "make this section
    // collapsible and start it collapsed"): the shelves are a way in, and
    // the catalogue below is what most readers came for.
    return `<details class="fro-block fro-shelves fro-fold">` +
      `<summary class="fro-fold-sum"><h2 class="fro-h">Browse the shelves` +
      `<span class="fro-tally">${num(list.length)} shelves</span></h2></summary>` +
      `<ul class="fro-shelf-list">${rows}</ul>${foot}</details>`;
  }

  /* ---- Render ------------------------------------------------------ */

  const catalogueReturn = '<nav class="fro-catalogue-return" aria-label="Catalogue navigation"><a href="/the-faith-received/all-works/?collection=all">← All shelves</a></nav>';
  const initial = new URLSearchParams(location.search);
  root.classList.toggle("is-filtered", ["q", "tradition", "denomination", "party", "century", "in", "letter", "page"].some(k => !!initial.get(k)));
  // Continue reading is local and instant, so it paints before the
  // catalogue is in rather than waiting on a fetch it does not need.
  const first = continueReading();
  root.innerHTML = catalogueReturn + first;

  Promise.all([
    Promise.all(ALL.map((id) => window.MOFaithCatalogue.load(id).catch(() => []))),
    loadRoster(),
    window.MOCollectedContents?.ready,
    window.MOFaithCatalogue.load("confessions").catch(() => []),
  ])
    .then(([sets, roster, , confessions]) => {
      // A shelf counts what its room lists: Migne's apparatus (indices, notices, admonitions) is not a work (2026-09-25).
      const html = catalogueReturn + continueReading() + shelves(sets.flat().filter((w) => window.MOFaithCatalogue.shelved(w)), roster, confessions);
      if (html) root.innerHTML = html;
      else root.remove();
    })
    .catch(() => { if (!first) root.remove(); });
})();
