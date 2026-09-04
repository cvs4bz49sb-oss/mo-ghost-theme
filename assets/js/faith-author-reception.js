/*
 * Reception, on an author page.
 *
 * The scripture fingerprint says which books an author lived in. This
 * says which OTHER authors he lived among: who he leaned on, and who
 * leaned on him. A library that has both a Lutheran's and a Jesuit's
 * shelf can finally show that they were reading each other, not just
 * sitting on adjacent traditions.
 *
 * Two sources, used for two different jobs:
 *
 *   v1/graph/nb/<slug>.json — the ranked list. Sixteen names each
 *   way, already scored by weight, already sorted, plain JSON (no
 *   gzip). Built for exactly this render — two lists with a hairline
 *   bar each — so it is trusted as the primary source rather than
 *   re-derived from something heavier.
 *
 *   v1/reception/<slug>.json.gz — the texture. Not fetched for its
 *   ranking (the file duplicates one PLD-only sweep of it and is
 *   slower to parse); fetched for the pair detail that opens under a
 *   row: which works are being cited, how often, and four citations
 *   printed as they appear on the page. If it does not arrive in
 *   time, or 404s, the ranked lists still render and the rows simply
 *   do not open; the panel does not wait on it.
 *
 * "Cites" and "cited by" are asymmetric on purpose. A name near the
 * top of "cited by" was read closely by the tradition after him; a
 * name near the top of "cites" is who he was reading. Printing them
 * as two columns rather than one merged list keeps that distinction
 * visible instead of flattening two different facts into one number.
 *
 * The two directions are also independent at render time. Measured
 * 2026-09-04 against the live worker: 551 of the 718 catalogue authors
 * have an nb file at all, and 197 of those 551 have one direction
 * empty. Petrus van Mastricht cites sixteen writers and is cited by
 * none of them; the Sedan Academy is the reverse. Each column is
 * therefore gated on its own array, never on the pair, and an author
 * with nothing either way gets no panel rather than an empty one.
 *
 * WHAT sm IS NOT. `sm` is capped at four entries per neighbour and is
 * a sample, never an inventory. Voetius names Ames 359 times and `sm`
 * carries four of them, drawn from three works. `tw` is capped at five
 * works and its counts sum to 179 of those 359. Every place either one
 * is printed says so, in the visible text, with the true total beside
 * it. A reader who walks away thinking "Voetius cites Ames in three
 * works" has been misled by this panel, and that is the one failure
 * mode it may not have.
 */
(function () {
  "use strict";

  const root = document.querySelector("[data-faith-author]");
  if (!root) return;

  const LIBRARY = (document.querySelector('meta[name="tfr-library-base"]') || {}).content
    || "https://mo-tfr-library.mo-podcast-feed.workers.dev";

  const SHOWN = 6;

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  const n = (x) => Number(x || 0).toLocaleString();

  const safeHref = (u) => (window.MOSafeHref ? window.MOSafeHref.sanitize(u, "") : "");

  // The same fold faith-author.js, faith-browse-search.js and
  // faith-room.js all use to turn a catalogue name into the URL an
  // author page will recognise.
  function fold(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  // v1/graph/nb and v1/reception both key their files by this same
  // slugifier — lower-case, any run outside a-z0-9 becomes one hyphen
  // — which faith-author-scripture.js already reverse-engineered
  // against a live sample of the bucket. Duplicated locally rather
  // than shared: this file has no load-order guarantee against that
  // one.
  function slugify(s) {
    return String(s || "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  /* ── Name variants ────────────────────────────────────────────────
   *
   * The catalogue and the citation index were named by different
   * hands, so a figure can sit in both under two spellings and look
   * absent in one. Measured 2026-09-04: 167 of the 718 catalogue
   * authors have no nb file under their own slug, and 21 of those are
   * this problem rather than an absence of data.
   *
   * EVERY ENTRY BELOW IS HAND-CHECKED, one at a time, against the
   * catalogue's dates, see and key works on one side and the index
   * entry's own display name and the works its citers actually name on
   * the other. That verification is the whole point of the map. Do not
   * add entries by string similarity. Jaccard token overlap was tried
   * on this exact pair of files and returned confident nonsense:
   * "Abbot Paul" and "Paul Petau" both matched Pope `paul-i`, "Leo of
   * Bourges" matched `leo-i`, "John Baconthorpe" matched
   * `john-of-b-ze`. Handing one theologian's reception history to
   * another is a factual claim this library must not make, and it is
   * strictly worse than the panel not rendering.
   *
   * Rejected on inspection, recorded so nobody re-proposes them:
   *   Polycarp -> polycarp-bishop-of-smyrna. The catalogue's Polycarp
   *     is a Latin Father credited with a "Chain on the four Gospels",
   *     a catena, not the second-century bishop of Smyrna.
   *   Theophilus -> theophilus-bishop-of-antioch. The catalogue's
   *     Theophilus is tied to a Life of St Macarius, not to Ad
   *     Autolycum.
   *   Cornelius Jansenius -> cornelius-jansen. The index entry is two
   *     men merged: its cited works include the Augustinus (Jansen of
   *     Ypres, 1585-1638, who is the catalogue's man) and also the
   *     Tetrateuchus and Pentateuchus (Jansen of Ghent, 1510-1576).
   *     Aliasing would hand the elder's reception to the younger.
   *   Heraclides Cappadociae -> heraclides-of-alexandria, and
   *     Eutherius of Tyana -> pope-eleutherius. Different people.
   *
   * Keyed by slugify(catalogue name) so the lookup is one map read,
   * and pointed at the index slug. */
  const ALIASES = {
    // — Latin or vernacular form of the same name —
    // Albert the Great, O.P., c.1200-1280.
    "albertus-magnus": "albert-the-great",
    // Charlemagne, 742/748-814.
    "carolus-magnus": "charlemagne",
    // Charles the Bald, 823-877.
    "carolus-ii-calvus": "charles-ii-the-bald",
    // Patriarch of Alexandria, c.376-444. Pointed at the clean entry,
    // not at the composite cyril-of-alexandria-theodotus-of-ancyranus-etc.
    "cyrillus-alexandrinus": "cyril-of-alexandria",
    // Archbishop of Constantinople, c.390-446.
    "proclus-constantinopolitanus": "proclus-of-constantinople",
    // Author of the Lausiac History, c.363-430.
    "palladius-helenopolitanus": "palladius-of-helenopolis",
    // The same epithet, translated. Both catalogue and index carry a
    // separate Palladius of Helenopolis, so this is not a collision.
    "palladius-cappadociae": "palladius-of-cappadocia",
    // Durand of Saint-Pourcain, O.P., c.1270-1334.
    "durandus-de-s-porciano": "durand-of-saint-pour-ain",
    // Manuel II Palaiologos, Byzantine emperor 1391-1425. "imp" is
    // imperator, and he is the only Palaeologus of that name who is
    // both emperor and author.
    "manuel-ii-palaiologos": "manuel-palaeologus-imp",
    // Andre Galland / Andrea Gallandi, 1709-1779, the Bibliotheca
    // Veterum Patrum editor.
    "galland-andr": "andrea-gallandi",
    // Guillaume (Wilhelm) Bucanus of Lausanne, d.1603.
    "wilhelm-bucanus": "william-bucanus",
    // Johannes Cocceius, 1603-1669.
    "johannes-coccejus": "johannes-cocceius",
    // Girolamo Zanchi, 1516-1590. The catalogue's bare "Zanchi" gives
    // his dates and his Strasbourg and Heidelberg chairs, and the
    // index entry's cited works are De Natura Dei, De Tribus Elohim
    // and the Ephesians commentary.
    "zanchi": "girolamo-zanchi",
    // Bartholomaeus de Barberiis, Capuchin, 1615-1697.
    "bartholomaeus-de-barberiis": "bartholomew-de-barberiis",
    // Alcimus Ecdicius Avitus, c.450-518. The catalogue's bio names
    // the see of Vienne, so the bare "Avitus" is not Avitus of Braga.
    "avitus": "avitus-of-vienne",

    // — Spelling variants of a single early-modern name —
    // Emanuel Schelstrate, Vatican librarian, 1649-1692.
    "emmanuel-schelstrate": "emanuel-schelstrate",
    // Johann Franz Buddeus / Budde, 1667-1729.
    "johann-franz-buddeus": "johann-franz-budde",

    // — Fuller form on one side than the other —
    // Johann Ludwig Fabricius, 1632-1696, Heidelberg. The middle name
    // is load-bearing: the index also holds a separate and different
    // johann-fabricius.
    "joh-ludwig-fabricius": "johann-ludwig-fabricius",
    // Willem Hessels van Est (Estius), 1542-1613. The catalogue holds
    // two rows for him and both point at the one index entry.
    "willem-hessels-van-est-estius": "willem-hessels-van-est",
    "willem-van-est": "willem-hessels-van-est",

    // — Inverted "Surname, Forename", the known EEBO-era quirk —
    // Salomon Glass (Glassius), 1593-1656.
    "salomon-glassius": "glassius-salomon",

    // — Correct, but inert today —
    // Patriarch Michael I Cerularius, c.1000-1059. The index has his
    // reception file but no nb file, so this recovers no panel yet. It
    // is kept so the pairing is not re-derived from scratch if the
    // ranked file is ever published.
    "michael-keroularios": "michael-cerularius-patriarcha-constantinople",
  };

  function libraryKey(name) {
    const slug = slugify(name);
    return (slug && ALIASES[slug]) || slug;
  }

  /* ── Reader links ─────────────────────────────────────────────────
   *
   * Mirrors collectionFor() in tfr-library/lib/collections.js, which
   * is the authority. `cut` is the length of the prefix including its
   * hyphen, because the reader addresses these collections by their
   * own bare id: ?c=pld&w=2741, never ?w=pld-2741. Anything without a
   * known prefix is the native collection and takes no c= at all.
   *
   * Written out again rather than imported. There is no exported
   * helper for this in the theme: faith-shelves.js, faith-bookmarks.js,
   * faith-notebook.js, faith-indexes.js and faith-constellations.js
   * each carry their own copy, and this file is a page-template script
   * with no load-order guarantee against any of them (FRONTEND §6.18).
   * The table below is byte-identical to the one in
   * faith-constellations.js; change them together.
   *
   * `p` is emitted here, unlike in constellations, because sm.p is a
   * printed page number the extractor read off the citation itself and
   * the reader can land on it. It is only appended when it is a
   * positive integer. */
  const READER = "/the-faith-received/reader/";
  const PREFIXES = [
    { re: /^pld-/, corpus: "pld", cut: 4 },
    { re: /^eebo-/, corpus: "eebo", cut: 5 },
    { re: /^pg-/, corpus: "pg", cut: 3 },
    { re: /^po-/, corpus: "po", cut: 3 },
    { re: /^mo-/, corpus: "mo", cut: 3 },
  ];

  function readerUrl(slug, page) {
    const s = typeof slug === "string" ? slug.trim() : "";
    if (!s) return "";
    let url = `${READER}?w=${encodeURIComponent(s)}`;
    for (let i = 0; i < PREFIXES.length; i++) {
      const p = PREFIXES[i];
      if (p.re.test(s)) {
        url = `${READER}?c=${p.corpus}&w=${encodeURIComponent(s.slice(p.cut))}`;
        break;
      }
    }
    const pg = Number(page);
    if (Number.isFinite(pg) && pg > 0 && Math.floor(pg) === pg) {
      url += `&p=${encodeURIComponent(String(pg))}`;
    }
    return url;
  }

  /* The ".json.gz" in the path is a file name, not a promise about the
   * bytes. Measured against the live worker 2026-09-04: it answers
   * `content-type: application/json` and Cloudflare re-encodes at the
   * edge (`content-encoding: br`), so what reaches fetch() is plain
   * JSON that the browser has already decoded. Handing that to
   * DecompressionStream("gzip") throws, the throw is swallowed by
   * loadExcerpts's catch, and the panel quietly loses every pair
   * detail with nothing in the console to say why.
   *
   * So sniff instead of assuming. 1f 8b is the gzip magic; anything
   * else is read as the text it already is. Both paths survive the
   * worker changing its mind about which one it serves. */
  async function gunzip(response) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    const gzipped = bytes.length > 1 && bytes[0] === 0x1f && bytes[1] === 0x8b;
    if (gzipped && typeof window.DecompressionStream === "function") {
      const stream = new Blob([bytes]).stream()
        .pipeThrough(new window.DecompressionStream("gzip"));
      return JSON.parse(await new Response(stream).text());
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  const PATIENCE = 6000;
  const PATIENCE_EXTRA = 8000;

  function loadNeighbors(name) {
    const slug = libraryKey(name);
    if (!slug) return Promise.resolve(null);
    return Promise.race([
      fetch(`${LIBRARY}/v1/graph/nb/${encodeURIComponent(slug)}.json`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      new Promise((resolve) => { setTimeout(() => resolve(null), PATIENCE); }),
    ]);
  }

  // Enrichment only — a slower, heavier fetch the panel does not wait
  // on before drawing the ranked lists themselves.
  function loadExcerpts(name) {
    const slug = libraryKey(name);
    if (!slug) return Promise.resolve(null);
    return Promise.race([
      fetch(`${LIBRARY}/v1/reception/${encodeURIComponent(slug)}.json.gz`)
        .then((r) => (r.ok ? r : null))
        .then((r) => (r ? gunzip(r) : null))
        .catch(() => null),
      new Promise((resolve) => { setTimeout(() => resolve(null), PATIENCE_EXTRA); }),
    ]);
  }

  /* ── The verbs ────────────────────────────────────────────────────
   *
   * `how` is the extractor's classification of every instance, and it
   * is complete: measured across 2,898 rows on four authors, the five
   * counts sum to `n` exactly, every time. That is what earns it a
   * place in the panel. Printing "refutations" beside "approvals" and
   * "paraphrases" is also the plainest possible answer to what the
   * disagreement figure means, which a tooltip was never going to give
   * a reader on a phone. */
  const HOW_NOUN = {
    cites: ["citation", "citations"],
    reports: ["paraphrase", "paraphrases"],
    approves: ["approval", "approvals"],
    refutes: ["refutation", "refutations"],
    quotes: ["quotation", "quotations"],
  };

  function howLine(how) {
    if (!how) return "";
    const parts = Object.keys(how)
      .filter((k) => HOW_NOUN[k] && how[k] > 0)
      .sort((a, b) => how[b] - how[a])
      .map((k) => `${n(how[k])} ${HOW_NOUN[k][how[k] === 1 ? 0 : 1]}`);
    return parts.length ? `${parts.join(", ")}.` : "";
  }

  // The one sentence the whole third ask turns on. Kept as a function
  // so the row tag and the detail lede cannot drift apart.
  function refutationTag(opp, total) {
    if (!opp || !total) return "";
    return opp === 1
      ? `1 of the ${n(total)} is a refutation.`
      : `${n(opp)} of the ${n(total)} are refutations.`;
  }

  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };

  /* ── The pair detail ──────────────────────────────────────────────
   *
   * Built with createElement and textContent throughout, so there is
   * no escaping step to forget on a string that crossed the network,
   * and every href goes through MOSafeHref. Same shape as
   * faith-constellations.js.
   *
   * Direction. `tw` is always the works of the party being CITED and
   * `sm.cw` is always the work of the party doing the CITING, whichever
   * list the row came from. On a "Cited by" row the neighbour cites the
   * page's author, so tw holds the page author's works; on an "Also
   * cites" row it is the other way round. citing/cited are passed in
   * already swapped rather than branched on here. */
  function detailFragment(row, citing, cited) {
    const frag = document.createDocumentFragment();
    const total = Number(row.n || 0);

    const lede = el("p", "fa-rc-detail-lede");
    lede.appendChild(document.createTextNode(
      `${citing} names ${cited} ${n(total)} time${total === 1 ? "" : "s"} across the library.`,
    ));
    const opp = (row.how && row.how.refutes) || 0;
    if (opp) {
      lede.appendChild(document.createTextNode(` ${refutationTag(opp, total)}`));
      lede.appendChild(document.createTextNode(
        ` A refutation is a passage where ${citing} argues against ${cited}.`,
      ));
    }
    frag.appendChild(lede);

    const verbs = howLine(row.how);
    if (verbs) frag.appendChild(el("p", "fa-rc-detail-how", verbs));

    // Which works. Absent on 207 of the 378 rows measured on Ames, so
    // the section is dropped rather than shown empty.
    const tw = Array.isArray(row.tw) ? row.tw.filter((w) => w && w[0]) : [];
    if (tw.length) {
      frag.appendChild(el("h4", "fa-rc-detail-sub", `Works of ${cited} that ${citing} cites`));
      const list = el("ul", "fa-rc-works");
      let sum = 0;
      tw.forEach((w) => {
        const count = Number(w[2] || 0);
        sum += count;
        const li = el("li");
        const url = safeHref(readerUrl(w[0]));
        const label = w[1] || w[0];
        if (url) {
          const a = el("a", "fa-rc-work-link", label);
          a.href = url;
          li.appendChild(a);
        } else {
          li.appendChild(el("span", "fa-rc-work-link", label));
        }
        li.appendChild(el("span", "fa-rc-work-n", n(count)));
        list.appendChild(li);
      });
      frag.appendChild(list);
      // Never "the works", always this many of that many. tw is capped
      // at five and its counts routinely cover well under half of n.
      frag.appendChild(el("p", "fa-rc-detail-note",
        `${n(tw.length)} work${tw.length === 1 ? "" : "s"}, accounting for ${n(sum)} of the ${n(total)} citations.`));
    }

    // The printed citations. Capped at four by the source.
    const sm = Array.isArray(row.sm) ? row.sm.filter((s) => s && s.cw) : [];
    if (sm.length) {
      frag.appendChild(el("h4", "fa-rc-detail-sub", "Citations, as printed"));
      const list = el("ul", "fa-rc-cites");
      sm.forEach((s) => {
        const li = el("li");
        const url = safeHref(readerUrl(s.cw, s.p));
        const label = s.ct || s.cw;
        if (url) {
          const a = el("a", "fa-rc-cite-link", label);
          a.href = url;
          li.appendChild(a);
        } else {
          li.appendChild(el("span", "fa-rc-cite-link", label));
        }
        if (s.p) li.appendChild(document.createTextNode(`, p. ${s.p}`));
        // Quotation marks written out rather than left to <q>, whose
        // marks are generated content: they are absent from copied
        // text, and a locator like "Medulla, lib. 1, c. 38, 39" runs
        // into the surrounding commas without them.
        if (s.loc) {
          li.appendChild(document.createTextNode(", "));
          li.appendChild(el("span", "fa-rc-loc", `“${String(s.loc)}”`));
        } else if (s.twt) {
          li.appendChild(document.createTextNode(", on "));
          li.appendChild(el("em", null, String(s.twt)));
        }
        if (s.sf) {
          li.appendChild(document.createTextNode(", named "));
          li.appendChild(el("span", "fa-rc-sf", `“${String(s.sf)}”`));
        }
        li.appendChild(document.createTextNode("."));
        list.appendChild(li);
      });
      frag.appendChild(list);
      // The honesty line. sm is a sample of at most four; only when the
      // total is no larger than the sample is it the whole story.
      frag.appendChild(el("p", "fa-rc-detail-note",
        total > sm.length
          ? `${n(sm.length)} example${sm.length === 1 ? "" : "s"} out of ${n(total)}. This is a sample, not the full list.`
          : `All ${n(total)} of them.`));
    }

    return frag;
  }

  let uid = 0;

  /* ── One ranked column ────────────────────────────────────────────
   *
   * `dir` is "in" when the neighbour cites the page's author ("Cited
   * by") and "out" when the page's author cites the neighbour ("Also
   * cites"). It decides who is named as the citing party in the
   * detail, and nothing else.
   *
   * The count doubles as the disclosure control. It is the number a
   * reader wants broken down, so it is the thing they press; the name
   * beside it stays an ordinary link to that author's own page, which
   * is what the row did before and must keep doing. Expanding in place
   * rather than opening a panel keeps both columns and the whole
   * ranking on screen, which is the comparison the section exists to
   * make.
   *
   * Where a reception row exists, its own `n` and `how.refutes` are
   * used for the figure and the tag instead of the nb file's `w` and
   * `opp`. The two files were built from different sweeps and disagree
   * slightly (Ames on Bellarmine: 2,920 against 2,917), so mixing them
   * would print one number on the row and a different one three lines
   * below it. Ranking and bar width still come from nb. */
  function neighborList(rows, byKey, dir, pageName) {
    if (!rows.length) return "";
    const max = rows[0].w || 1;
    const items = rows.map((row, i) => {
      const href = safeHref(`/the-faith-received/author/?a=${encodeURIComponent(fold(row.a))}`);
      const pct = Math.max(1.5, (row.w / max) * 100);
      const extra = byKey.get(row.s) || byKey.get(row.fk) || byKey.get(fold(row.a));
      const total = (extra && Number(extra.n)) || row.w;
      const opp = extra && extra.how ? (extra.how.refutes || 0) : (row.opp || 0);
      const trad = extra && extra.tr
        ? `<span class="fa-rc-trad">${escapeHtml(extra.tr)}</span>` : "";
      const tag = refutationTag(opp, total);
      const oppLine = tag ? `<p class="fa-rc-opp">${escapeHtml(tag)}</p>` : "";
      const detailId = `fa-rc-d${(uid += 1)}`;
      const readingLabel = dir === "in"
        ? `${row.a} names ${pageName} ${n(total)} times. Show the works and citations.`
        : `${pageName} names ${row.a} ${n(total)} times. Show the works and citations.`;
      const figure = extra
        ? `<button type="button" class="fa-rc-n fa-rc-open" data-rc-open="1"` +
          ` data-rc-dir="${escapeHtml(dir)}" data-rc-key="${escapeHtml(fold(row.a))}"` +
          ` aria-expanded="false" aria-controls="${escapeHtml(detailId)}"` +
          ` aria-label="${escapeHtml(readingLabel)}">${n(total)}</button>`
        : `<span class="fa-rc-n">${n(total)}<span class="visually-hidden"> citation${
          total === 1 ? "" : "s"}, ${dir === "in" ? "citing" : "cited"}</span></span>`;
      const host = extra ? `<div class="fa-rc-detail" id="${escapeHtml(detailId)}" hidden></div>` : "";
      const beyond = i >= SHOWN;
      return `<li class="fa-rc-row${beyond ? " fa-rc-rest" : ""}"${beyond ? " hidden" : ""}>` +
        `<a class="fa-rc-name" href="${escapeHtml(href)}">${escapeHtml(row.a)}</a>${trad}` +
        `<span class="fa-rc-bar"><span class="fa-rc-bar-fill" style="width:${pct.toFixed(1)}%"></span></span>` +
        `${figure}${oppLine}${host}</li>`;
    }).join("");
    const hidden = rows.length - SHOWN;
    const more = hidden > 0
      ? `<button type="button" class="fa-fp-more" data-rc-more>Show ${n(hidden)} more</button>` : "";
    return `<ol class="fa-rc-list">${items}</ol>${more}`;
  }

  function mount(neighbors, excerpts, root2) {
    // No data either way means no section. An author nobody in this
    // library cites and who cites nobody in it gets the page he had
    // before this panel existed, with no placeholder and no apology.
    if (!neighbors || (!(neighbors.cites || []).length && !(neighbors.cited_by || []).length)) return;

    const cites = neighbors.cites || [];
    const citedBy = neighbors.cited_by || [];
    const name = neighbors.a || "";

    // Keyed on the reception row's own fk, which every row carries,
    // then on slug and the folded name. `s` is absent on 10 to 27 per
    // cent of rows depending on the author (40 of 378 on Ames, 245 of
    // 896 on Voetius), so keying on it alone loses the detail for a
    // quarter of the neighbours.
    const inByKey = new Map();
    const outByKey = new Map();
    // FIRST WRITE WINS, and that is the whole point of this function.
    // The reception file carries more than one row for the same
    // neighbour: Ames's `out` has two Robert Bellarmines (n 2,917 and
    // n 7), two John Chrysostoms and two Theodore Bezas, and his `in`
    // has two Westminster Assemblies. Rows arrive sorted by n
    // descending, so the first row for a key is the substantive one
    // and a last-write-wins map hands the panel the scrap: Bellarmine
    // rendered as "7" with "6 of the 7 are refutations" under a
    // full-width bar, next to a ranked list that had him first.
    const indexRows = (rows, map) => {
      (rows || []).forEach((r) => {
        [r.fk, r.s, fold(r.a)].forEach((k) => {
          if (k && !map.has(k)) map.set(k, r);
        });
      });
    };
    if (excerpts) {
      indexRows(excerpts.in && excerpts.in.rows, inByKey);
      indexRows(excerpts.out && excerpts.out.rows, outByKey);
    }

    const bits = [];
    if (citedBy.length) {
      bits.push(`${citedBy.length === 1 ? "One writer" : `${n(citedBy.length)} writers`} in the library ${
        citedBy.length === 1 ? "cites" : "cite"} ${escapeHtml(name)} by name.`);
    }
    if (cites.length) {
      bits.push(`${escapeHtml(name)} in turn cites ${cites.length === 1 ? "one other writer" : `${n(cites.length)} others`} the library holds.`);
    }
    if (!bits.length) return;

    const panel = document.createElement("section");
    panel.className = "fa-rc";
    panel.setAttribute("aria-labelledby", "fa-rc-head");
    // Each column is gated on its own array. A writer nobody cites
    // still gets "Also cites", and the reverse.
    panel.innerHTML =
      `<h2 class="fa-rc-head" id="fa-rc-head">Reception</h2>` +
      `<p class="fa-rc-lede">${bits.join(" ")}</p>` +
      `<div class="fa-rc-cols">${
      citedBy.length
        ? `<div class="fa-rc-col"><h3 class="fa-fp-sub">Cited by</h3>` +
          `<p class="fa-fp-note">Other writers the library holds, ranked by how often they name ${escapeHtml(name)}. Press a figure to see the works and the citations behind it.</p>${
          neighborList(citedBy, inByKey, "in", name)}</div>` : ""
      }${cites.length
        ? `<div class="fa-rc-col"><h3 class="fa-fp-sub">Also cites</h3>` +
          `<p class="fa-fp-note">Who ${escapeHtml(name)} himself returns to most, by the same count. Press a figure to see the works and the citations behind it.</p>${
          neighborList(cites, outByKey, "out", name)}</div>` : ""
      }</div>` +
      `<p class="fa-rc-status visually-hidden" role="status" aria-live="polite"></p>`;

    // Right after the scripture fingerprint if it drew one — "how he
    // read" and "who he read among" belong together — otherwise in the
    // same spot the fingerprint would have taken.
    const fp = root2.querySelector(".fa-fp");
    const search = root2.querySelector(".fa-search");
    const shelf = root2.querySelector(".fa-shelf");
    if (fp) fp.insertAdjacentElement("afterend", panel);
    else if (search) root2.insertBefore(panel, search);
    else if (shelf) root2.insertBefore(panel, shelf);
    else root2.appendChild(panel);

    const status = panel.querySelector(".fa-rc-status");

    // The detail is built on first press, not at render. Sixteen rows
    // each way against a payload that runs to 1,217 rows on Augustine
    // is a lot of DOM to make for something most readers open none of.
    function fillDetail(btn) {
      const li = btn.closest(".fa-rc-row");
      const host = li && li.querySelector(".fa-rc-detail");
      if (!host || host.getAttribute("data-rc-filled") === "1") return host;
      // Direction and lookup key are carried on the button rather than
      // read back out of the rendered copy, so renaming a column
      // heading cannot silently swap who is citing whom.
      const isIn = btn.getAttribute("data-rc-dir") === "in";
      const row = (isIn ? inByKey : outByKey).get(btn.getAttribute("data-rc-key"));
      if (!row) return host;
      const nameEl = li.querySelector(".fa-rc-name");
      const other = nameEl ? nameEl.textContent : (row.a || "");
      host.appendChild(isIn
        ? detailFragment(row, other, name)
        : detailFragment(row, name, other));
      host.setAttribute("data-rc-filled", "1");
      return host;
    }

    panel.addEventListener("click", (e) => {
      const open = e.target.closest("[data-rc-open]");
      if (open) {
        const host = fillDetail(open);
        if (!host) return;
        const wasOpen = open.getAttribute("aria-expanded") === "true";
        open.setAttribute("aria-expanded", wasOpen ? "false" : "true");
        host.hidden = wasOpen;
        return;
      }
      const more = e.target.closest("[data-rc-more]");
      if (!more) return;
      const scope = more.previousElementSibling;
      const rest = scope ? [...scope.querySelectorAll(".fa-rc-rest")] : [];
      rest.forEach((node) => { node.hidden = false; });
      if (status) status.textContent = `${n(rest.length)} more shown.`;
      more.remove();
      const first = rest[0] && rest[0].querySelector("a, button");
      if (first) first.focus({ preventScroll: false });
    });
  }

  function load(name) {
    return Promise.all([loadNeighbors(name), loadExcerpts(name)]);
  }

  window.MOAuthorReception = { load, mount };
}());
