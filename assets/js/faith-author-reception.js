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
 *   v1/reception/full/<slug>.json.gz — the records. Every extracted
 *   citation, one row each, with the work it sits in, its printed
 *   page, the locator the extractor read off it, the surface form of
 *   the name and the verb. NEVER fetched on page load: it is the
 *   heaviest thing this panel can ask for and most readers open none
 *   of it. A reader presses a verb in an open pair detail and only
 *   then does it go over the wire. See § THE FULL LIST below.
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
 *
 * ── THE FULL LIST ────────────────────────────────────────────────
 *
 * The sample is the honest default; it is not the answer. Ames names
 * Bellarmine 2,924 times and the request is to read every one of
 * them, so each open pair detail carries a row of verb chips ("2,078
 * refutations", "413 paraphrases", ...) and pressing one fetches
 * v1/reception/full/ and prints that verb's rows in full, grouped by
 * the work they sit in and paged in at FULL_CHUNK a time.
 *
 * DIRECTION. `to` in the full file is OUTBOUND ONLY, which is what
 * keeps these files down to a few dozen KB over the wire. So an
 * "Also cites" row reads the page author's own file at to[neighbour],
 * and a "Cited by" row reads THE NEIGHBOUR'S file at to[pageAuthor].
 * Getting this backwards yields a plausible, populated, wrong list, so
 * the file slug and the map key are computed once in mount() and
 * carried on the pair state rather than re-derived at press time.
 *
 * WHICH NUMBER WINS. Three files count the same pair three ways.
 * Ames on Bellarmine is 2,920/2,075 in v1/graph/nb, 2,917/2,072 in
 * v1/reception, and 2,924/2,078 in v1/reception/full. They were built
 * by different sweeps and none is a rounding of another. The full
 * file is the records themselves, and `rows.length` matched the
 * declared `n` exactly on every one of the 216 pairs measured on
 * Ames, so once it has loaded for a pair EVERY figure that pair shows
 * is recounted from those rows: the lede, the chips, the row's own
 * count button and the refutation line beside it. Nothing on screen
 * may say 2,917 above a list of 2,924 items. Before the full file
 * loads the summary still wins over nb, for the same reason it did
 * before (it is closer to the records than the ranked file is), and
 * the ranked file keeps only what no number depends on: which
 * neighbours appear, in what order, at what bar width.
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

  /* ── The full file ────────────────────────────────────────────────
   *
   * Opt-in, never on page load. Measured against the live worker
   * 2026-09-04, wire bytes then parsed JSON:
   *
   *   augustine-of-hippo    19 KB ->   102 KB
   *   john-calvin           46 KB ->   352 KB
   *   thomas-aquinas        77 KB ->   611 KB
   *   william-ames          75 KB ->   784 KB
   *   gisbertus-voetius    452 KB -> 3,817 KB
   *
   * So the wire cost is half a megabyte at worst and the PARSED cost
   * is nearly four, which is the number that matters on a phone. Two
   * things follow. The timeout is long and real (AbortController, so
   * a stalled transfer is actually cancelled rather than left running
   * behind a Promise.race that has already given up), and the cache
   * holds at most FULL_CACHE_MAX whole files: each pair extracts the
   * slice it needs and keeps only that, so opening ten pairs does not
   * retain ten copies of Voetius. Evicted files re-fetch from the
   * browser's HTTP cache, which the worker allows for a day.
   *
   * A 404 is a resolution, not a rejection: coverage is 92% and the
   * missing 8% are missing permanently, so the sentinel is cached and
   * never retried. A network failure deletes its cache entry so the
   * reader's "Try again" can actually try again. */
  const FULL_PATIENCE = 20000;
  const FULL_CACHE_MAX = 2;
  const NOT_PUBLISHED = "mo-rc-not-published";
  const fullCache = new Map();

  function loadFull(slug) {
    if (!slug) return Promise.resolve(NOT_PUBLISHED);
    if (fullCache.has(slug)) return fullCache.get(slug);

    const controller = typeof window.AbortController === "function"
      ? new window.AbortController() : null;
    const timer = window.setTimeout(() => {
      if (controller) controller.abort();
    }, FULL_PATIENCE);

    const url = `${LIBRARY}/v1/reception/full/${encodeURIComponent(slug)}.json.gz`;
    const p = fetch(url, controller ? { signal: controller.signal } : undefined)
      .then((r) => {
        if (r.status === 404) return NOT_PUBLISHED;
        if (!r.ok) throw new Error(`reception/full ${r.status}`);
        // The same sniffing decoder the summary uses. Do NOT write a
        // second one: ".json.gz" is a file name, not a promise about
        // the bytes, and assuming gzip is what made this whole feature
        // silently dead once already.
        return gunzip(r);
      })
      .then((data) => { window.clearTimeout(timer); return data; })
      .catch((err) => {
        window.clearTimeout(timer);
        fullCache.delete(slug);
        throw err;
      });

    fullCache.set(slug, p);
    // Oldest-first eviction. Map iterates in insertion order, and the
    // entry just set is by definition the newest, so it is never the
    // one dropped.
    while (fullCache.size > FULL_CACHE_MAX) {
      const oldest = fullCache.keys().next().value;
      if (oldest === slug) break;
      fullCache.delete(oldest);
    }
    return p;
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

  const verbLabel = (k, count) => `${n(count)} ${HOW_NOUN[k][count === 1 ? 0 : 1]}`;

  // Kept for the one path that has to reproduce the panel exactly as
  // it stood before the full list existed: a pair the extraction never
  // published, where the chips have nothing to offer and revert to the
  // plain sentence they replaced.
  function howLine(how) {
    if (!how) return "";
    const parts = Object.keys(how)
      .filter((k) => HOW_NOUN[k] && how[k] > 0)
      .sort((a, b) => how[b] - how[a])
      .map((k) => verbLabel(k, how[k]));
    return parts.length ? `${parts.join(", ")}.` : "";
  }

  // Verbs in descending order of how much of the pair they account
  // for, which is also the order the sentence they replaced used. The
  // dominant verb is the interesting one and it reads first.
  function verbKeys(how) {
    return Object.keys(how || {})
      .filter((k) => HOW_NOUN[k] && how[k] > 0)
      .sort((a, b) => how[b] - how[a]);
  }

  // Recount from the records. Called only on full rows, never on the
  // summary's own `how`, so the counts it returns sum to rows.length.
  function countVerbs(rows) {
    const how = {};
    for (let i = 0; i < rows.length; i++) {
      const k = rows[i].h;
      if (HOW_NOUN[k]) how[k] = (how[k] || 0) + 1;
    }
    return how;
  }

  // The one sentence the whole third ask turns on. Kept as a function
  // so the row tag and the detail lede cannot drift apart.
  function refutationTag(opp, total) {
    if (!opp || !total) return "";
    return opp === 1
      ? `1 of the ${n(total)} is a refutation.`
      : `${n(opp)} of the ${n(total)} are refutations.`;
  }

  /* The extractor leaks a few of its own absent-values through as
   * literal strings rather than as null. Measured 2026-09-04: `loc` is
   * the four-character string "null" on 23 of Ames's 6,038 rows and 22
   * of Voetius's 29,308. At four examples a pair that almost never
   * surfaced, and it went unnoticed. At 2,078 rows it is on screen
   * inside the first page, printed as a quotation, p. 32, "null",
   * which reads as a citation of a passage that says null.
   *
   * A truthiness check does not catch it, because "null" is truthy.
   * Everything that crosses the network and gets printed as prose goes
   * through here. */
  const ABSENT = /^(?:null|undefined|none|nan|n\/?a|-{1,2})$/i;
  function printable(v) {
    if (v == null) return "";
    const s = String(v).trim();
    return s && !ABSENT.test(s) ? s : "";
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
  // One sentence, one source. Whoever calls this has already decided
  // which total is authoritative, so the lede cannot be built from one
  // file while the chips beneath it are built from another.
  function ledeText(citing, cited, total, opp) {
    const parts = [
      `${citing} names ${cited} ${n(total)} time${total === 1 ? "" : "s"} across the library.`,
    ];
    if (opp) {
      parts.push(refutationTag(opp, total));
      parts.push(`A refutation is a passage where ${citing} argues against ${cited}.`);
    }
    return parts.join(" ");
  }

  /* The sample body: the five capped works and the four printed
   * citations the summary file carries. This is what a pair shows
   * before anyone asks for more, and what it falls back to when the
   * full file cannot be had. Unchanged from what it printed before the
   * full list existed, including the honesty line at the bottom. */
  function sampleFragment(row, citing, cited) {
    const frag = document.createDocumentFragment();
    const total = Number(row.n || 0);

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
        const loc = printable(s.loc);
        const twt = printable(s.twt);
        const sf = printable(s.sf);
        if (loc) {
          li.appendChild(document.createTextNode(", "));
          li.appendChild(el("span", "fa-rc-loc", `“${loc}”`));
        } else if (twt) {
          li.appendChild(document.createTextNode(", on "));
          li.appendChild(el("em", null, twt));
        }
        if (sf) {
          li.appendChild(document.createTextNode(", named "));
          li.appendChild(el("span", "fa-rc-sf", `“${sf}”`));
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

  /* ── Printing 2,924 rows ──────────────────────────────────────────
   *
   * Two decisions carry this, and both are about node count rather
   * than about bytes.
   *
   * GROUP BY WORK. Ames's 2,924 citations of Bellarmine sit in six
   * works, one of which holds 1,482 of them. A flat list prints
   * "Bellarminus Enervatus (Amsterdam 1630, 4 toms)" 1,482 times, which
   * is unreadable and is also most of the DOM. The title is printed
   * once as a heading and each citation under it is its own page
   * number, which is the only part that differs. Screen readers get
   * the work back through aria-label on the link, not through 1,482
   * more elements.
   *
   * CHUNK. Even so, rows are appended FULL_CHUNK at a time behind a
   * "Show N more" that says where it has got to. Measured in Chrome on
   * this markup, Ames on Bellarmine filtered to refutations:
   *
   *   2,078 rows -> 8,112 elements, 6 groups, 134,433px of page
   *   ~3.9 elements per row, ~0.08ms per row to build
   *   one 250-row chunk: 19 to 24ms, appended in two operations
   *   all 2,078 in one go: 197ms of scripting
   *
   * 197ms is a dozen dropped frames on this machine and close to a
   * second on a mid-range phone, for something a reader did not ask
   * for all at once. A chunk is one dropped frame on a deliberate
   * press, with a line underneath saying how far in it has got. The
   * cursor is (group index, row index) so a chunk boundary inside a
   * work continues into the same list rather than starting a second
   * heading for it. */
  const FULL_CHUNK = 250;

  function groupsFor(rows, works) {
    const byWork = new Map();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const key = r.w || "";
      const bucket = byWork.get(key);
      if (bucket) bucket.push(r);
      else byWork.set(key, [r]);
    }
    const out = [];
    byWork.forEach((rs, w) => {
      rs.sort((a, b) => (Number(a.p) || 0) - (Number(b.p) || 0));
      out.push({ w, title: (works && printable(works[w])) || w, rows: rs });
    });
    // Heaviest work first. Six works over 2,924 rows means heavy title
    // repetition across groups is normal and not a bug: the library
    // genuinely holds three separate records of the Bellarminus
    // Enervatus, and each opens a different scan.
    out.sort((a, b) => b.rows.length - a.rows.length);
    return out;
  }

  // `noun` is the active filter's word, so a group under the
  // refutations filter says "1,070 refutations in this work" and not
  // "1,070 citations in this work", which would be a different and
  // much larger claim about the same heading.
  function makeChunker(groups, works, container, noun) {
    let gi = 0;
    let ri = 0;
    let openList = null;
    let shown = 0;

    function groupHead(g) {
      const h = el("h5", "fa-rc-group-head");
      const url = safeHref(readerUrl(g.w));
      if (url) {
        const a = el("a", "fa-rc-group-link", g.title);
        a.href = url;
        h.appendChild(a);
      } else {
        h.appendChild(el("span", "fa-rc-group-link", g.title));
      }
      const count = el("span", "fa-rc-group-n", n(g.rows.length));
      // Sighted readers get "1,070" beside a heading and the state
      // line above tells them what of. A screen reader takes the
      // heading and this figure as one run of text, so the unit rides
      // along here: "1,070 refutations in this work".
      count.appendChild(el("span", "visually-hidden",
        ` ${noun(g.rows.length)} in this work`));
      h.appendChild(count);
      return h;
    }

    function pageRow(r, workTitle) {
      const li = el("li", "fa-rc-page-row");
      const pg = Number(r.p);
      const printed = Number.isFinite(pg) && pg > 0 && Math.floor(pg) === pg;
      const label = printed ? `p. ${n(pg)}` : "page not recorded";
      const url = printed ? safeHref(readerUrl(r.w, pg)) : "";
      if (url) {
        const a = el("a", "fa-rc-page", label);
        a.href = url;
        a.setAttribute("aria-label", `${label}, ${workTitle}`);
        li.appendChild(a);
      } else {
        li.appendChild(el("span", "fa-rc-page", label));
      }
      const loc = printable(r.loc);
      if (loc) {
        li.appendChild(document.createTextNode(", "));
        li.appendChild(el("span", "fa-rc-loc", `“${loc}”`));
      }
      // `tw` names the work of the party being CITED, and it is on
      // about a fifth of rows. Where the extractor caught it, say so.
      const twt = r.tw && works ? printable(works[r.tw]) : "";
      if (twt) {
        li.appendChild(document.createTextNode(", on "));
        li.appendChild(el("em", null, twt));
      }
      const sf = printable(r.sf);
      if (sf) {
        li.appendChild(document.createTextNode(", named "));
        li.appendChild(el("span", "fa-rc-sf", `“${sf}”`));
      }
      li.appendChild(document.createTextNode("."));
      return li;
    }

    return {
      shown: () => shown,
      done: () => gi >= groups.length,
      // Appends up to `limit` rows and returns the first link it added,
      // which is where focus goes after a "Show more".
      render(limit) {
        let added = 0;
        let firstLink = null;
        const fresh = document.createDocumentFragment();
        let pending = null;
        const flush = () => {
          if (pending && openList) openList.appendChild(pending);
          pending = null;
        };
        while (gi < groups.length && added < limit) {
          const g = groups[gi];
          if (ri === 0) {
            flush();
            const li = el("li", "fa-rc-group");
            const head = groupHead(g);
            if (!firstLink) firstLink = head.querySelector("a");
            li.appendChild(head);
            openList = el("ol", "fa-rc-pages");
            li.appendChild(openList);
            fresh.appendChild(li);
          }
          if (!pending) pending = document.createDocumentFragment();
          while (ri < g.rows.length && added < limit) {
            const node = pageRow(g.rows[ri], g.title);
            if (!firstLink) firstLink = node.querySelector("a");
            pending.appendChild(node);
            ri += 1;
            added += 1;
            shown += 1;
          }
          if (ri >= g.rows.length) { gi += 1; ri = 0; }
        }
        flush();
        if (fresh.childNodes.length) container.appendChild(fresh);
        return firstLink;
      },
    };
  }

  /* ── The pair detail, as a small machine ──────────────────────────
   *
   * Four states, in one host element, with a fixed skeleton so nothing
   * has to be re-found by selector:
   *
   *   lede   the sentence, rebuilt whenever the authoritative total
   *          changes
   *   hint   the lead-in above the chips, and the one place the panel
   *          reverts to its pre-full-list sentence
   *   chips  the verbs. Before the full file loads they are loaders
   *          that preselect a filter; after it loads they are the
   *          filter, with aria-pressed
   *   body   sample | loading | full list | failed
   *
   * ctx.sync is how the row above gets its figure corrected once the
   * records are in hand. Without it the row would keep saying 2,917
   * over a list of 2,924, which is the one thing this must not do. */
  function buildDetail(host, ctx) {
    const {
      row, citing, cited, fileSlug, mapKey, say, sync,
    } = ctx;

    const summaryTotal = Number(row.n || 0);
    const summaryOpp = (row.how && row.how.refutes) || 0;

    const lede = el("p", "fa-rc-detail-lede");
    const hint = el("p", "fa-rc-detail-how");
    const chips = el("div", "fa-rc-verbs");
    chips.setAttribute("role", "group");
    const body = el("div", "fa-rc-body");
    host.appendChild(lede);
    host.appendChild(hint);
    host.appendChild(chips);
    host.appendChild(body);

    let full = null;
    let loading = false;
    let active = "";

    function chipsDisabled(on) {
      const list = chips.querySelectorAll("button");
      for (let i = 0; i < list.length; i++) list[i].disabled = on;
    }

    function paintChips(how, total, loaded) {
      chips.hidden = false;
      chips.textContent = "";
      chips.setAttribute(
        "aria-label",
        loaded ? "Filter these citations by kind" : "Read every citation, by kind",
      );
      const add = (key, text, aria) => {
        const b = el("button", "fa-rc-verb", text);
        b.type = "button";
        if (loaded) {
          b.setAttribute("aria-pressed", key === active ? "true" : "false");
        } else {
          b.setAttribute("aria-label", aria);
        }
        b.addEventListener("click", () => { press(key); });
        chips.appendChild(b);
      };
      add("", `All ${n(total)}`, total === 1
        ? "Show the one citation"
        : `Show all ${n(total)} citations`);
      verbKeys(how).forEach((k) => {
        const label = verbLabel(k, how[k]);
        // "Show all 1 approval" is the kind of sentence a screen
        // reader makes a meal of. One of a thing gets said as one.
        add(k, label, how[k] === 1
          ? `Show the one ${HOW_NOUN[k][0]}`
          : `Show all ${label}`);
      });
    }

    function paintSample() {
      lede.textContent = ledeText(citing, cited, summaryTotal, summaryOpp);
      hint.hidden = false;
      hint.textContent = "Press a kind to read every one of them.";
      paintChips(row.how, summaryTotal, false);
      body.textContent = "";
      body.appendChild(sampleFragment(row, citing, cited));
    }

    function paintLoading() {
      body.textContent = "";
      body.appendChild(el("p", "fa-rc-detail-note",
        "Loading every citation for this pair. This is a large file, so it can take a moment on a slow connection."));
      say("Loading every citation for this pair.");
    }

    /* A pair the extraction never published. Coverage is 92%, the
     * missing 8% are missing for good, and the reader is owed the
     * panel exactly as it stood before any of this existed: the same
     * four examples, the same plain verb sentence, no error, nothing
     * emptied. The one addition is a single factual line, because a
     * control that vanishes without a word after you press it reads
     * as a bug. */
    function paintUnpublished() {
      chips.textContent = "";
      chips.hidden = true;
      hint.hidden = false;
      hint.textContent = howLine(row.how);
      body.textContent = "";
      body.appendChild(sampleFragment(row, citing, cited));
      body.appendChild(el("p", "fa-rc-detail-note",
        "The full list has not been published for this pair."));
      say("The full list has not been published for this pair.");
    }

    function paintFailed() {
      body.textContent = "";
      body.appendChild(sampleFragment(row, citing, cited));
      body.appendChild(el("p", "fa-rc-detail-note",
        "The full list did not load. The examples above are still here."));
      const retry = el("button", "fa-fp-more", "Try again");
      retry.type = "button";
      retry.addEventListener("click", () => { start(); });
      body.appendChild(retry);
      say("The full list did not load. The examples above are still here.");
    }

    function paintFull() {
      const { how, total, works } = full;
      const opp = how.refutes || 0;
      lede.textContent = ledeText(citing, cited, total, opp);
      hint.hidden = true;
      hint.textContent = "";
      paintChips(how, total, true);

      const count = active ? (how[active] || 0) : total;
      const rows = active ? full.rows.filter((r) => r.h === active) : full.rows;
      const nounFor = (c) => (active
        ? HOW_NOUN[active][c === 1 ? 0 : 1]
        : `citation${c === 1 ? "" : "s"}`);
      const noun = nounFor(count);

      body.textContent = "";
      body.appendChild(el("h4", "fa-rc-detail-sub", "Every citation"));
      // One of a thing is said as one. "Showing all 1 approval" is a
      // sentence no reader should have to parse, and Ames has a pair
      // with exactly one of four of the five verbs.
      const many = count === 1 ? `the one ${noun}` : `all ${n(count)} ${noun}`;
      const grouped = count === 1 ? "" : ", grouped by the work each appears in";
      const state = el("p", "fa-rc-state", active
        ? `Showing ${many}, out of ${n(total)} citations in all${grouped}.`
        : `Showing ${many}${grouped}.`);
      body.appendChild(state);

      // The only place the disagreement between the files is visible,
      // and it is said out loud rather than papered over. Shown once,
      // and only when the figure actually moved under the reader.
      if (summaryTotal && summaryTotal !== total) {
        body.appendChild(el("p", "fa-rc-detail-note",
          `Counted from the citation records themselves. A separate summary pass counted ${n(summaryTotal)} for this pair, and the records are the authority here.`));
      }

      const list = el("ul", "fa-rc-groups");
      body.appendChild(list);
      const progress = el("p", "fa-rc-progress");
      const more = el("button", "fa-fp-more");
      more.type = "button";
      const chunk = makeChunker(groupsFor(rows, works), works, list, nounFor);
      const step = () => {
        const first = chunk.render(FULL_CHUNK);
        const done = chunk.done();
        let where;
        if (!done) where = `${n(chunk.shown())} of ${n(count)} shown.`;
        else if (count === 1) where = "That is the only one.";
        else where = `All ${n(count)} shown.`;
        progress.textContent = where;
        more.hidden = done;
        if (!done) {
          more.textContent = `Show ${n(Math.min(FULL_CHUNK, count - chunk.shown()))} more`;
        }
        return first;
      };
      more.addEventListener("click", () => {
        const first = step();
        say(progress.textContent);
        if (first) first.focus({ preventScroll: false });
      });
      body.appendChild(progress);
      body.appendChild(more);
      step();
      say(`${state.textContent} ${progress.textContent}`);
    }

    function start() {
      if (loading) return;
      loading = true;
      chipsDisabled(true);
      paintLoading();
      loadFull(fileSlug).then((data) => {
        loading = false;
        chipsDisabled(false);
        if (data === NOT_PUBLISHED) { paintUnpublished(); return; }
        // `to` is outbound only, so a "Cited by" pair is read out of
        // the NEIGHBOUR's file under the page author's key. A miss here
        // means the two files disagree about how to spell one of them,
        // which is indistinguishable to a reader from the pair never
        // having been published, and is handled the same way.
        const pair = data && data.to ? data.to[mapKey] : null;
        const rows = pair && Array.isArray(pair.rows) ? pair.rows : null;
        if (!rows || !rows.length) { paintUnpublished(); return; }
        const how = countVerbs(rows);
        // rows.length, not the declared `n`. They matched on all 216
        // pairs measured, and if they ever stop matching the count on
        // screen has to be the count of what is on screen.
        full = { rows, works: data.works || {}, how, total: rows.length };
        if (active && !how[active]) active = "";
        sync(full.total, how.refutes || 0);
        paintFull();
      }).catch(() => {
        loading = false;
        chipsDisabled(false);
        paintFailed();
      });
    }

    function press(key) {
      if (full) { active = key; paintFull(); return; }
      if (loading) return;
      active = key;
      start();
    }

    paintSample();
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
   * below it. Ranking and bar width still come from nb.
   *
   * That is the figure a row is BORN with. If the reader then loads
   * the full list for that pair, syncTotals rewrites this button and
   * the refutation line beneath it from the records (2,924 and 2,078),
   * because the row and the list under it are one reading and may not
   * carry two totals. The bar is left alone: it is a proportion, not a
   * figure, and nothing on screen states the number behind it. */
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
    const say = (text) => { if (status) status.textContent = text; };

    /* The page author's own two keys, resolved once. `s` and `fk` were
     * identical on every row measured, so this is belt and braces
     * rather than a real branch, but the full-file lookup is the one
     * place where getting a key wrong yields a populated, plausible,
     * wrong list instead of an empty one. */
    const pageFile = (excerpts && (excerpts.s || excerpts.fk)) || libraryKey(name);
    const pageKey = (excerpts && (excerpts.fk || excerpts.s)) || libraryKey(name);

    // The row's figure and its refutation line, rewritten once the
    // records are in hand. See § WHICH NUMBER WINS at the top.
    function syncTotals(li, isIn, other, total, opp) {
      const btn = li.querySelector(".fa-rc-open");
      if (btn) {
        btn.textContent = n(total);
        btn.setAttribute("aria-label", isIn
          ? `${other} names ${name} ${n(total)} times. Show the works and citations.`
          : `${name} names ${other} ${n(total)} times. Show the works and citations.`);
      }
      const tag = refutationTag(opp, total);
      let line = li.querySelector(".fa-rc-opp");
      if (!tag) { if (line) line.remove(); return; }
      if (!line) {
        line = el("p", "fa-rc-opp");
        li.insertBefore(line, li.querySelector(".fa-rc-detail"));
      }
      line.textContent = tag;
    }

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
      const neighbourKey = row.fk || row.s || "";
      buildDetail(host, {
        row,
        citing: isIn ? other : name,
        cited: isIn ? name : other,
        // OUTBOUND ONLY, both times. "Also cites" is this author's own
        // file read at the neighbour's key; "Cited by" is the
        // neighbour's file read at this author's key.
        fileSlug: isIn ? neighbourKey : pageFile,
        mapKey: isIn ? pageKey : neighbourKey,
        say,
        sync(total, opp) { syncTotals(li, isIn, other, total, opp); },
      });
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
