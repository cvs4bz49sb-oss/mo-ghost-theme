/*
 * The Faith Received — Compare.
 *
 * Two to four authors set side by side on one topic, their statements
 * grouped by the work each came from. Binds to custom-faith-compare.hbs;
 * read that template's header for the DOM contract.
 *
 * PORTED FROM the corpus owner's comparison desk (`compareDesk()` in
 * his assets/js/port/compare.in03.js). His interaction model is kept
 * whole and is the reason this file is shaped the way it is:
 *
 *   - the ADDRESS IS THE VIEW. Everything that makes this screen what
 *     it is lives in the hash — which authors, which topic, which
 *     grouping, which stance, which phrase — so a comparison can be
 *     linked, bookmarked and saved without a server knowing anything.
 *   - AUTHORS ARE COLUMNS, capped at four and ordered oldest first, so
 *     reading left to right reads as a reception history.
 *   - THE TOPIC IS THE ROW. The topic list is the UNION of the authors'
 *     own topics with each author's count beside it, so a topic only
 *     one of them treats is visible as exactly that rather than hidden.
 *   - STATEMENTS GROUP BY WORK, collapsible, because "what does Calvin
 *     say about grace" is really "what does he say where".
 *
 * WHAT WAS DROPPED, AND WHY. His desk also carried a "where they meet"
 * finder that pairs statements from different authors by shared rare
 * vocabulary. It is genuinely clever and it is not here, because it
 * presents a lexical coincidence in a layout that reads as a scholarly
 * claim — two passages side by side under one heading. On a publication
 * that says its sources are extracted statements and sometimes
 * summaries, that is a claim we would be making on the reader's behalf
 * and could not stand behind. The columns say what each author says and
 * let the reader do the comparing, which is the honest version of the
 * same idea.
 *
 * WHERE THE DATA COMES FROM. Everything is mo-tfr-library, read from
 * the tfr-library-base meta tag the way every other Faith Received page
 * reads it. Four shapes, all already live:
 *
 *   /v1/bible/<shelf>/rooms/index.json      the roster, per shelf
 *   /v1/bible/<shelf>/rooms/<author>.json   one author: works + topics,
 *                                           each topic carrying a small
 *                                           selection of statements
 *   /v1/bible/<shelf>/rooms/t/<author>/<topic>.json
 *                                           that topic in full (Augustine
 *                                           on Sin: 400 statements against
 *                                           the room's 40)
 *   /v1/mine/topic2-all/<topic>.json        the topic across every author,
 *                                           and the paging contract below
 *
 * ── THE STATEMENTS NOW COME FROM /v1/evidence (2026-09-11) ──
 *
 * They used to be read out of the room and topic files above, and set
 * straight into a blockquote. They should never have been. NOTHING in
 * those files is a quotation: a position row's `q` is a machine-written
 * statement of the position and a page row's `g` is a machine-written
 * description of the page. Checked against the works themselves, 70 of
 * 3,240 position rows appear in the text they cite, and none of the
 * page summaries do. Ambrose's own words at PL 14:0123 begin "Have men
 * assumed so much opinion that some of them established three
 * principles of all things"; the mined row is a summary of that, in
 * somebody else's voice, complete with em dashes the corpus does not
 * use. Forty of those down a column, set as blockquotes under a
 * Father's name, is a fabrication however carefully it is hedged.
 *
 * /v1/evidence resolves each citation against the work itself and
 * returns the author's actual words — see website/workers/tfr-library/
 * lib/locus-text.js. That cannot be done in the browser: a Patrologia
 * Latina work is 150KB to 2.1MB of JSON and a column has to be
 * assembled from its blocks, so four columns of forty statements would
 * be tens of megabytes over the reader's connection.
 *
 * The mined files are still fetched, for the topic grid and its counts,
 * and their rows are the FALLBACK if the endpoint cannot be reached.
 * In that case the column says so in a line of its own and every row is
 * painted as the index's labelled note. It is never quietly promoted
 * back into a blockquote, which is the one lie this screen could tell
 * that a reader would carry away and repeat.
 *
 * SAFETY. Every string on this screen came off the network. There is no
 * innerHTML anywhere below: rows are built with createElement and
 * textContent, and the only hrefs are ones this file constructs itself
 * from an id it has already matched against /^[a-z0-9-]+$/ and then
 * passes through MOSafeHref. The `h` field the data carries IS a URL
 * and is deliberately ignored — it addresses the owner's own site, and
 * re-pointing a fetched URL is exactly the sink that shipped an XSS
 * here before.
 *
 * ── LIVING IN A TAB ──────────────────────────────────────────────
 *
 * This panel is normally the Compare tab of
 * /the-faith-received/research/, and it is written to work either way:
 * inside that shell, or dropped on a page of its own. Two things follow
 * from being one of seven panels, and both are handled by asking the
 * markup rather than by being told.
 *
 * THE MODE PREFIX. The shell puts the workspace name in the first
 * segment of the hash and leaves everything after the first "&" to the
 * panel (see assets/js/page/faith-research.js for why that grammar).
 * So hosted, this file reads and writes
 * #compare&a=…&sel=…&g=…&s=…&q=… , and standalone it reads and writes
 * #a=…&sel=… exactly as it always did. MODE below is "" or the host
 * panel's name, and it is discovered from
 * root.closest("[data-research-panel]"). The tail after the prefix is
 * unchanged in either case, so parseHash() is the same URLSearchParams
 * call it has always been and a link shared from either shape carries
 * the same five parameters.
 *
 * NOT READING SOMEBODY ELSE'S ADDRESS. When the reader is on another
 * tab the hash names that tab, and this file's hashchange listener must
 * not treat #notebook as an instruction to empty the comparison. It
 * returns early on any hash whose mode is not its own, and keeps its
 * state in memory until its tab comes back.
 *
 * WAKING UP. The roster is nine fetches (one shelf index apiece) and
 * they are the whole cost of this panel. Hidden behind a tab, that cost
 * would be spent on every reader who only wanted to Ask a question. So
 * the fetch waits for the tab: a MutationObserver on the host panel's
 * `hidden` attribute, which is the same signal and the same reasoning
 * faith-constellations.js sets out at length — a ResizeObserver or any
 * rAF-driven visibility trap is not delivered at all in a background
 * tab, so a panel that woke on one would sit blank forever. Everything
 * that costs nothing (binding, reading the address, painting saved
 * views) still happens at parse time.
 */
(function () {
  "use strict";

  const root = document.querySelector("[data-cmp-root]");
  if (!root) return;
  // The partial ships its own <script> tags so it can be dropped into
  // any page. If a host page loads this file a second time, bind once.
  if (root.getAttribute("data-cmp-bound") === "1") return;
  root.setAttribute("data-cmp-bound", "1");

  // "" standalone, or the name of the workspace this panel is a tab of.
  const hostPanel = root.closest ? root.closest("[data-research-panel]") : null;
  const MODE = (hostPanel && hostPanel.getAttribute("data-research-panel")) || "";

  const baseMeta = document.querySelector('meta[name="tfr-library-base"]');
  const BASE = ((baseMeta && baseMeta.content) || "").replace(/\/$/, "");

  /* ── Elements ────────────────────────────────────────────────── */

  const authorsEl = root.querySelector("[data-cmp-authors]");
  const addForm = root.querySelector("[data-cmp-add-form]");
  const addInput = root.querySelector("[data-cmp-add]");
  const addList = root.querySelector("[data-cmp-add-list]");
  const addNote = root.querySelector("[data-cmp-add-note]");
  const toolsEl = root.querySelector("[data-cmp-tools]");
  const groupSel = root.querySelector("[data-cmp-group]");
  const stanceSel = root.querySelector("[data-cmp-stance]");
  const phraseInput = root.querySelector("[data-cmp-phrase]");
  const topicsWrap = root.querySelector("[data-cmp-topics-wrap]");
  const topicsEl = root.querySelector("[data-cmp-topics]");
  const topicHeadEl = root.querySelector("[data-cmp-topic-head]");
  const columnsEl = root.querySelector("[data-cmp-columns]");
  const statusEl = root.querySelector("[data-cmp-status]");
  const emptyEl = root.querySelector("[data-cmp-empty]");
  const saveBtn = root.querySelector("[data-cmp-save]");
  const exportBtn = root.querySelector("[data-cmp-export]");
  const savedWrap = root.querySelector("[data-cmp-saved]");
  const savedList = root.querySelector("[data-cmp-saved-list]");
  const savedCount = root.querySelector("[data-cmp-saved-count]");

  /* ── The nine shelves ────────────────────────────────────────── *
   * Byte-identical to the owner's own shelf map, and to the nine
   * traditions the Research page's scope control offers. A shelf key
   * that is not one of these has no room index, so the roster fetch for
   * it would 404 rather than return nothing. */
  const SHELVES = {
    pl: "Latin Fathers",
    gf: "Greek Fathers",
    po: "Eastern Fathers",
    ed: "English Divines",
    md: "Medieval",
    rc: "Roman Catholic",
    lu: "Lutheran",
    rf: "Reformed",
    hl: "Humanism and Law",
  };

  // The four stances the extraction records. `qualifies` is shown as
  // "qualifies or other" because the data also carries a handful of
  // rows with no stance at all, and a filter that silently excluded
  // them would under-report an author.
  const STANCES = [
    ["asserts", "Asserts"],
    ["denies", "Denies"],
    ["reports", "Reports another view"],
    ["qualifies", "Qualifies or other"],
  ];

  const MAX_AUTHORS = 4;

  /* ── State ───────────────────────────────────────────────────── */

  let state = { a: [], sel: "", g: "work", s: "", q: "" };
  let roster = null; // [{a, s, sh, y, w, n}]
  let rosterMissing = []; // shelves that failed, named on screen
  let authors = []; // resolved, ordered oldest first
  let topics = []; // union of the authors' topics
  let current = null; // the selected topic row
  const cells = new Map(); // author slug + "|" + topic slug -> cell
  const roomCache = new Map();
  const fullCache = new Map();
  const exportCache = new Map();
  let run = 0; // guards against a stale fetch painting

  /* ── Small helpers ───────────────────────────────────────────── */

  const SLUG = /^[a-z0-9][a-z0-9-]*$/;
  const isSlug = (s) => typeof s === "string" && SLUG.test(s);

  const fold = (s) => String(s == null ? "" : s)
    .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ").trim();

  const tslugOf = (t) => fold(t).replace(/ /g, "-") || "topic";

  const fmt = (n) => Number(n || 0).toLocaleString();

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = String(text);
    return n;
  }

  // How the quotations were found goes in the shared Methodology dropdown (tfr-method.js); a plain note is the fallback.
  function methodEl(text, cls) {
    if (!window.TFRMethod) return el("p", cls, text);
    const p = el("p", "", text), box = el("div", cls);
    box.innerHTML = window.TFRMethod.html(p.outerHTML);
    return box;
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  // Fetch JSON, resolving to null on any failure. Every caller treats
  // null as "this piece is not available" and says so on screen rather
  // than throwing the whole page away.
  function getJSON(url) {
    return fetch(url, { signal: AbortSignal.timeout(25000) })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  }

  /* ── Reader links ────────────────────────────────────────────── *
   * Mirrors readerUrlFor() in website/workers/tfr-library/lib/collections.js
   * and readerUrl() in assets/js/lib/faith-notebook-store.js: the
   * corpus goes in `c=` and the work's own id in `w=`, with `c` omitted
   * for the native collection. `pld-2809` is corpus pld and work 2809 —
   * `?w=pld-2809` loads nothing at all.
   *
   * ── WHAT ACTUALLY MAKES A CITATION LAND (2026-09-11) ──
   *
   * This table used to carry a hasPages flag per collection and append
   * `?p=` on its say-so, and the diagnosis that Patrologia Latina's
   * page was being thrown away was correct. The cure is not to set the
   * flag: the reader CANNOT honour `?p=` for pld, and it cannot honour
   * it for Early English Books either, whatever this table says.
   * openInitialSection() in assets/js/faith-reader.js resolves `?p=N`
   * by looking for the section whose [data-from, data-to) covers N, and
   * only the shard reader writes those attributes. The reader's own
   * pageResolves() says so in as many words: "Early English Books is
   * `gz-toc` and renders sections with no data-from at all: a `p=`
   * there resolves to nothing and drops the reader at the top of the
   * work having promised otherwise." So `eebo: true` here was a lie of
   * the same kind as `pld: false`, pointing the other way.
   *
   * What DOES land, in every collection, is `?q=` — landOnQuote()
   * searches the rendered text for the passage and scrolls to it,
   * retrying while the section hydrates. It only works if the text
   * really is in the work, which is exactly what changed: the worker
   * now sends the work's own words rather than the index's summary of
   * them, and a summary could never be found. That is why a citation
   * used to open at the top of an 881,000-character work.
   *
   * `?p=` is therefore appended only for the native collection, which
   * is the one the reader can resolve it in, and the quotation is what
   * carries the landing everywhere.
   *
   * The statement's own `h` anchor is still not used: it addresses the
   * owner's reader, whose block ids are not ours. */
  const PREFIXES = [
    [/^pld-/, "pld", 4],
    [/^mo-/, "mo", 3],
    [/^eebo-/, "eebo", 5],
    [/^pg-/, "pg", 3],
  ];

  // landOnQuote needs 30 characters and takes up to 160.
  const LANDING_MIN = 30;
  const LANDING_MAX = 150;

  function readerHref(work, page, quote) {
    const w = String(work || "");
    if (!w) return "";
    let corpus = "";
    let id = w;
    for (let i = 0; i < PREFIXES.length; i += 1) {
      if (PREFIXES[i][0].test(w)) {
        corpus = PREFIXES[i][1];
        id = w.slice(PREFIXES[i][2]);
        break;
      }
    }
    const params = [];
    if (corpus) params.push(`c=${encodeURIComponent(corpus)}`);
    params.push(`w=${encodeURIComponent(id)}`);
    // Native works only — see the note above.
    if (!corpus && page != null && page !== "") params.push(`p=${encodeURIComponent(page)}`);
    const landing = String(quote || "").replace(/\s+/g, " ").trim().slice(0, LANDING_MAX);
    if (landing.length >= LANDING_MIN) params.push(`q=${encodeURIComponent(landing)}`);
    return `/the-faith-received/reader/?${params.join("&")}`;
  }

  /* The worker builds the same link and knows the collection rules
   * first-hand, so its `url` is preferred where there is one. Ours is
   * the fallback for the index-only rows the panel falls back to when
   * /v1/evidence cannot be reached. Both go through MOSafeHref in
   * link(). A same-origin absolute path only: anything else is dropped
   * rather than followed. */
  function hrefOf(r) {
    const given = String(r.url || "");
    if (/^\/the-faith-received\/reader\/\?/.test(given)) return given;
    return readerHref(r.w, r.p, r.q);
  }

  // The one place a link is made. Built from ids this file validated,
  // then through MOSafeHref anyway — belt and braces, because the cost
  // of being wrong here is an XSS and the cost of the extra call is
  // nothing.
  function link(href, text, cls) {
    const a = el("a", cls, text);
    if (window.MOSafeHref) window.MOSafeHref.set(a, href, "#");
    else a.setAttribute("href", href || "#");
    return a;
  }

  /* ── The address ─────────────────────────────────────────────── *
   *
   * Standalone:  #a=augustine-of-hippo,jerome&sel=sin&g=canon
   * In the shell: #compare&a=augustine-of-hippo,jerome&sel=sin&g=canon
   *
   * One grammar with an optional first segment, so the parameters and
   * their order are identical in both and a link made in either shape
   * carries the same view. Everything below the two helpers works on
   * the tail alone and does not know which shape it is in. */

  // The part of the hash that belongs to this panel, mode segment
  // stripped. "" when the hash names some other tab, which is how the
  // hashchange listener knows to leave it alone.
  function tailOfHash(hash) {
    const s = String(hash || "").replace(/^#/, "");
    if (!MODE) return s;
    if (s === MODE) return "";
    if (s.slice(0, MODE.length + 1) === `${MODE}&`) return s.slice(MODE.length + 1);
    return null; // not ours
  }

  const isOurs = (hash) => tailOfHash(hash) !== null;

  function parseHash() {
    const P = new URLSearchParams(tailOfHash(location.hash) || "");
    const list = (P.get("a") || "").split(",").map((x) => x.trim()).filter(isSlug).slice(0, MAX_AUTHORS);
    return {
      a: list,
      sel: P.get("sel") || "",
      g: P.get("g") === "canon" ? "canon" : "work",
      s: STANCES.some((x) => x[0] === P.get("s")) ? P.get("s") : "",
      q: P.get("q") || "",
    };
  }

  // The tail on its own, so that the example links in the empty state
  // and the saved-view rows can be built from one place.
  function tailOf(st) {
    let t = `a=${st.a.map(encodeURIComponent).join(",")}`;
    if (st.sel) t += `&sel=${encodeURIComponent(st.sel)}`;
    if (st.g !== "work") t += `&g=${st.g}`;
    if (st.s) t += `&s=${encodeURIComponent(st.s)}`;
    if (st.q) t += `&q=${encodeURIComponent(st.q)}`;
    return t;
  }

  // A whole hash from a tail. With no authors chosen the tail is the
  // bare "a=", which says nothing the mode does not already say, so
  // hosted it is dropped and the address is just "#compare".
  function hashFromTail(tail) {
    if (!MODE) return `#${tail}`;
    return tail && tail !== "a=" ? `#${MODE}&${tail}` : `#${MODE}`;
  }

  function hashOf(st) {
    return hashFromTail(tailOf(st));
  }

  function writeHash() {
    const h = hashOf(state);
    if (location.hash !== h) history.replaceState(null, "", location.pathname + location.search + h);
    paintSaved();
  }

  /* ── Saved views ─────────────────────────────────────────────── *
   * A saved view is an ADDRESS and a name, nothing more: re-opening it
   * re-fetches, so a view saved in March shows what the library holds
   * today rather than a stale copy of what it held in March. Kept in
   * this browser, and the page says so. */
  const VIEWS_KEY = "fr_compare_views";

  // A saved view keeps the TAIL, not the whole hash. It used to keep the
  // hash, from before this panel could be a tab, and those records are
  // still on readers' machines: their `hash` is always the standalone
  // "#a=…" shape, since that is the only shape that existed when they
  // were written. Normalising on the way in means an old saved view
  // opens correctly inside the tab shell instead of pointing at a hash
  // the shell reads as an unknown mode and clamps to Ask.
  function readViews() {
    try {
      const v = JSON.parse(window.localStorage.getItem(VIEWS_KEY) || "[]");
      if (!Array.isArray(v)) return [];
      return v.map((x) => {
        if (!x || typeof x !== "object") return null;
        const tail = x.tail != null ? String(x.tail) : String(x.hash || "").replace(/^#/, "");
        return { ...x, tail };
      }).filter((x) => x && x.tail);
    } catch (_) {
      return [];
    }
  }

  function writeViews(v) {
    try {
      window.localStorage.setItem(VIEWS_KEY, JSON.stringify(v.slice(0, 60)));
      return true;
    } catch (_) {
      return false;
    }
  }

  function say(msg) {
    if (statusEl) statusEl.textContent = msg || "";
  }

  /* ── Roster ──────────────────────────────────────────────────── */

  function loadRoster() {
    if (roster) return Promise.resolve(roster);
    const keys = Object.keys(SHELVES);
    return Promise.all(keys.map((sh) => getJSON(`${BASE}/v1/bible/${sh}/rooms/index.json`)
      .then((d) => ({ sh, rows: d && Array.isArray(d.authors) ? d.authors : null }))))
      .then((parts) => {
        rosterMissing = parts.filter((p) => !p.rows).map((p) => shelfText(p.sh));
        const rows = [];
        parts.forEach((p) => {
          (p.rows || []).forEach((r) => {
            if (isSlug(r.s)) rows.push({ a: String(r.a || r.s), s: r.s, sh: p.sh, y: r.y, w: r.w, n: r.n });
          });
        });
        // One row per author: the same person can keep a room on more
        // than one shelf, and the heaviest is the one with the works.
        const best = new Map();
        rows.forEach((r) => {
          const cur = best.get(r.s);
          if (!cur || (r.w || 0) > (cur.w || 0)) best.set(r.s, r);
        });
        roster = [...best.values()].sort((x, y) => x.a.localeCompare(y.a));
        return roster;
      });
  }

  function rosterRow(slug) {
    return (roster || []).filter((r) => r.s === slug)[0] || null;
  }

  // Printed through the one display rule (lib/faith-catalogue.js): a
  // shelf name reads "English writers" for "English Divines", and one
  // author's label is his church where the denomination table is on the
  // page. SHELVES itself stays the data.
  function shelfText(sh) {
    const t = SHELVES[sh] || "";
    return window.MOFaithLabel && t ? window.MOFaithLabel.shelf(t) : t;
  }
  function authorShelf(r) {
    const t = SHELVES[r.sh] || "";
    return window.MOFaithLabel && t ? window.MOFaithLabel.of(t, r.a) : t;
  }

  function whenOf(r) {
    return [r.y ? `c. ${r.y}` : "", authorShelf(r)].filter(Boolean).join(" · ");
  }

  /* ── Author rooms and topics ─────────────────────────────────── */

  function loadRoom(r) {
    const k = `${r.sh}/${r.s}`;
    if (!roomCache.has(k)) roomCache.set(k, getJSON(`${BASE}/v1/bible/${r.sh}/rooms/${r.s}.json`));
    return roomCache.get(k);
  }

  function loadFull(sh, slug, tslug) {
    const k = `${sh}/${slug}/${tslug}`;
    if (!fullCache.has(k)) fullCache.set(k, getJSON(`${BASE}/v1/bible/${sh}/rooms/t/${slug}/${tslug}.json`));
    return fullCache.get(k);
  }

  function loadExport(reg) {
    if (!exportCache.has(reg)) exportCache.set(reg, getJSON(`${BASE}/v1/mine/topic2-all/${reg}.json`));
    return exportCache.get(reg);
  }

  /* ── A statement row ─────────────────────────────────────────── *
   *
   * NOTHING THE INDEX WROTE IS A QUOTATION. The mined files' `q` on a
   * position row is a machine-written statement of the position and
   * their `g` is a machine-written description of the page; measured
   * against the works themselves, 70 of 3,240 position rows and none
   * of the page summaries appear in the text they cite. This panel
   * used to set the first of them in a blockquote, which put words in
   * a Father's mouth.
   *
   * So a row now carries two separable things and the painter keeps
   * them apart:
   *
   *   r.q      THE AUTHOR'S WORDS at the cited locus, resolved by the
   *            worker out of the work itself. Empty when it could not
   *            be resolved — never a summary standing in for one.
   *   r.quote  where those words came from: unit ("extract" for the
   *            index's own quotation proved to sit at the locus,
   *            "column"/"page" for the opening of the cited locus),
   *            the printed locus ("PL 14:0123"), and a status.
   *   r.index  the machine-written strings, which are labelled on
   *            screen as the index's own note and are never quoted.
   */
  function evidenceRows(list) {
    return (list || [])
      .map((r) => {
        const quote = r.quote && typeof r.quote === "object" ? r.quote : null;
        const idx = r.indexer && typeof r.indexer === "object" ? r.indexer : {};
        return {
          id: String(r.id || ""),
          q: quote && quote.status === "ok" ? String(r.q || "") : "",
          quote,
          index: {
            statement: String(idx.statement || ""),
            pageQuotation: String(idx.page_quotation || ""),
            summary: String(idx.page_summary || ""),
          },
          s: String(r.s || ""),
          w: String(r.w || ""),
          wt: String(r.wt || ""),
          p: r.p == null ? null : r.p,
          url: String(r.url || ""),
        };
      })
      .filter((r) => r.q || r.index.statement || r.index.summary || r.index.pageQuotation);
  }

  /* The index rows read straight off the mined files, used ONLY when
   * /v1/evidence cannot be reached. They carry no resolved text, so
   * `quote` is null and the painter says the library could not reach
   * the passage rather than quoting the summary in its place. */
  function indexOnlyRows(list) {
    return (list || [])
      .map((r) => ({
        id: "",
        q: "",
        quote: null,
        index: { statement: String(r.q || ""), pageQuotation: "", summary: String(r.g || "") },
        s: String(r.s || ""),
        w: String(r.w || ""),
        wt: String(r.wt || ""),
        p: r.p == null ? null : r.p,
        url: "",
      }))
      .filter((r) => r.index.statement || r.index.summary);
  }

  const rowKey = (r) => r.id
    || `${r.w}|${r.p}|${(r.index.statement || r.index.summary).slice(0, 60)}`;

  /* ── Building the author set ─────────────────────────────────── */

  async function resolveAuthors(token) {
    const out = [];
    for (const slug of state.a) {
      const r = rosterRow(slug);
      if (!r) continue;
      const room = await loadRoom(r);
      if (token !== run) return null;
      if (!room) continue;
      const works = new Map();
      (room.works || []).forEach((w) => works.set(String(w.w), w));
      const byTopic = new Map();
      (room.topics || []).forEach((t) => {
        const label = String(t.t || "").trim();
        if (!label) return;
        byTopic.set(fold(label), {
          label,
          tslug: tslugOf(label),
          npos: t.npos || 0,
          full: !!t.full,
          pos: t.pos || [],
          pages: t.pages || [],
          byw: t.byw || [],
        });
      });
      out.push({ s: slug, a: String(room.a || r.a), sh: r.sh, r, works, topics: byTopic });
    }
    // Oldest first, so left-to-right reads as a reception history.
    out.sort((x, y) => ((x.r.y || 9999) - (y.r.y || 9999)) || x.a.localeCompare(y.a));
    return out;
  }

  function buildTopics() {
    const map = new Map();
    authors.forEach((au, i) => {
      au.topics.forEach((t, key) => {
        if (!map.has(key)) {
          map.set(key, {
            key,
            label: t.label,
            tslug: t.tslug,
            counts: authors.map(() => 0),
            parts: authors.map(() => null),
          });
        }
        const row = map.get(key);
        row.counts[i] = t.npos || 0;
        row.parts[i] = t;
      });
    });
    topics = [...map.values()]
      .map((t) => ({ ...t, total: t.counts.reduce((n, x) => n + x, 0), shared: t.counts.filter(Boolean).length }))
      .filter((t) => t.total > 0)
      // Shared first, then weight. A topic every author treats is the
      // one worth comparing; a topic only one of them treats is still
      // listed, and its count column says so at a glance.
      .sort((x, y) => (y.shared - x.shared) || (y.total - x.total) || x.label.localeCompare(y.label));
  }

  /* ── Cells ───────────────────────────────────────────────────── */

  function cellFor(au, topic) {
    const k = `${au.s}|${topic.tslug}`;
    if (!cells.has(k)) {
      cells.set(k, {
        rows: [], seen: new Set(), total: 0, loading: true,
        contract: null, author: null, cursor: null,
        done: false, deepUnavailable: false, failed: false, open: new Set(),
        // Set when /v1/evidence could not answer and the column is
        // showing the mined index rows instead. Nothing in an
        // index-only column is ever set as a quotation.
        indexOnly: false,
        held: 0,
        // coverage.text from the last page fetched: how many of the
        // served citations resolved to the sentence the index marks,
        // how many to the opening of the cited column, how many not at
        // all. Painted as one sentence under the count line.
        textStats: null,
      });
    }
    return cells.get(k);
  }

  /* ── Filling a column ────────────────────────────────────────── *
   *
   * The rows come from /v1/evidence, NOT from the mined files this page
   * reads for everything else. The mined files carry no quotation — see
   * the note on evidenceRows() — and /v1/evidence is the only place the
   * author's actual words at a cited locus can be got, because
   * resolving one means reading the work (150KB to 2.1MB) and joining a
   * Migne column against its blocks. Doing that in the browser, for
   * four columns of forty statements, would be tens of megabytes.
   *
   * The mined files are still read, for the topic grid and its counts,
   * and their rows are the FALLBACK when the endpoint cannot be
   * reached — shown as the index's own notes, under a line saying the
   * passages could not be reached, and never as quotations. */
  async function fillCell(au, topic, token) {
    const cell = cellFor(au, topic);
    const idx = authors.indexOf(au);
    const part = topic.parts[idx];
    if (!part) { cell.loading = false; return; }

    cell.total = part.npos || 0;

    const reg = topic.reg || topic.tslug;
    const ex = await loadExport(reg);
    if (token !== run) return;
    const mine = ex && Array.isArray(ex.authors) ? ex.authors.filter((x) => x.s === au.s)[0] : null;
    if (ex && ex.evidence && mine) {
      cell.contract = ex.evidence;
      cell.author = mine;
      if (mine.np && mine.np > cell.total) cell.total = mine.np;
    }

    const got = cell.contract ? await loadEvidence(cell, token) : false;
    if (token !== run) return;
    if (got) {
      cell.loading = false;
      paintColumns();
      return;
    }

    /* The endpoint could not answer. Fall back to the mined rows so the
     * column is not empty, and mark the cell so every statement in it
     * is painted as an index note rather than as a quotation. */
    cell.indexOnly = true;
    cell.deepUnavailable = true;
    indexOnlyRows(part.pos).forEach((r) => {
      const k = rowKey(r);
      if (!cell.seen.has(k)) { cell.seen.add(k); cell.rows.push(r); }
    });
    paintColumns();

    const full = part.full ? await loadFull(au.sh, au.s, topic.tslug) : null;
    if (token !== run) return;
    if (full) {
      indexOnlyRows(full.pos).forEach((r) => {
        const k = rowKey(r);
        if (!cell.seen.has(k)) { cell.seen.add(k); cell.rows.push(r); }
      });
    } else if (part.full) {
      // The room said a full file existed and it did not answer. Say
      // so: the column is a SAMPLE, not the author's whole hand.
      cell.failed = true;
    }
    cell.loading = false;
    paintColumns();
  }

  /* One page of /v1/evidence into a cell. Returns false on any failure,
   * which is what sends fillCell() to the index-only fallback.
   *
   * `include=positions` drops the page-level records: they carry no
   * stance, and this panel groups by work and filters by stance. The
   * count line names them rather than hiding them. */
  async function loadEvidence(cell, token) {
    if (!cell.contract || !cell.author) return false;
    const params = new URLSearchParams({
      snapshot: String(cell.contract.snapshot || ""),
      topic: String(cell.contract.topic || ""),
      author: String(cell.author.id || cell.author.s || ""),
      include: "positions",
      limit: "50",
    });
    if (cell.cursor) params.set("cursor", cell.cursor);
    const res = await getJSON(`${BASE}/v1/evidence?${params}`);
    if (token !== run) return false;
    if (!res || !Array.isArray(res.items)) return false;

    evidenceRows(res.items).forEach((r) => {
      const k = rowKey(r);
      if (!cell.seen.has(k)) { cell.seen.add(k); cell.rows.push(r); }
    });
    cell.cursor = res.has_more ? String(res.next_cursor || "") : null;
    cell.done = !cell.cursor;
    const cov = res.coverage || {};
    const positions = cov.positions || null;
    if (positions && positions.total != null && positions.total > cell.total) cell.total = positions.total;
    cell.held = cov.total_held == null ? cell.rows.length : cov.total_held;
    cell.textStats = cov.text || null;
    cell.deepUnavailable = false;
    return true;
  }

  /* ── Filtering ───────────────────────────────────────────────── */

  function matches(r) {
    if (state.s && r.s !== state.s) return false;
    if (state.q) {
      const needle = fold(state.q);
      const hay = `${r.q} ${r.index.statement} ${r.index.summary} ${r.wt}`;
      if (needle && fold(hay).indexOf(needle) === -1) return false;
    }
    return true;
  }

  function groupsOf(au, cell) {
    const kept = cell.rows.filter(matches);
    const byWork = new Map();
    kept.forEach((r) => {
      if (!byWork.has(r.w)) byWork.set(r.w, []);
      byWork.get(r.w).push(r);
    });
    const out = [...byWork.entries()].map(([w, rs]) => {
      const meta = au.works.get(w);
      return {
        w,
        label: (meta && meta.t) || rs[0].wt || w || "Source work",
        sub: (meta && meta.vs) || "",
        rows: rs.slice().sort((a, b) => (Number(a.p) || 0) - (Number(b.p) || 0)),
      };
    });
    if (state.g === "canon") out.sort((x, y) => x.label.localeCompare(y.label));
    else out.sort((x, y) => y.rows.length - x.rows.length || x.label.localeCompare(y.label));
    return out;
  }

  /* ── Painting ────────────────────────────────────────────────── */

  function paintAuthors() {
    clear(authorsEl);
    authors.forEach((au, i) => {
      const chip = el("span", "cmp-chip");
      chip.appendChild(link(`/the-faith-received/author/?a=${encodeURIComponent(au.s)}`, au.a, "cmp-chip-name"));
      chip.appendChild(el("small", "cmp-chip-when", whenOf(au.r)));
      const x = el("button", "cmp-chip-remove", "×");
      x.type = "button";
      x.setAttribute("aria-label", `Remove ${au.a} from the comparison`);
      x.addEventListener("click", () => {
        state.a = state.a.filter((s) => s !== au.s);
        writeHash();
        render();
        (addInput || authorsEl).focus();
      });
      chip.appendChild(x);
      authorsEl.appendChild(chip);
      if (i < authors.length - 1) authorsEl.appendChild(document.createTextNode(" "));
    });
    const full = authors.length >= MAX_AUTHORS;
    if (addForm) addForm.hidden = full;
    if (addNote) {
      addNote.hidden = !full;
      addNote.textContent = full
        ? "Four authors is the width of the desk. Remove one to add another."
        : "";
    }
  }

  function paintAddList() {
    if (!addList || !roster) return;
    clear(addList);
    const chosen = new Set(state.a);
    const needle = fold(addInput ? addInput.value : "");
    roster
      .filter((r) => !chosen.has(r.s))
      .filter((r) => !needle || fold(r.a).indexOf(needle) !== -1)
      .slice(0, 40)
      .forEach((r) => {
        const o = el("option");
        o.value = r.a;
        o.label = `${authorShelf(r)} · ${fmt(r.w)} works`;
        addList.appendChild(o);
      });
  }

  function paintTopics() {
    if (!topicsEl) return;
    clear(topicsEl);
    if (!topics.length) {
      topicsEl.appendChild(el("p", "cmp-note", authors.length
        ? "No topics are recorded for these authors."
        : ""));
      return;
    }
    topics.forEach((t) => {
      const b = el("button", "cmp-topic");
      b.type = "button";
      b.setAttribute("role", "tab");
      const on = !!current && current.key === t.key;
      b.setAttribute("aria-selected", String(on));
      if (on) b.classList.add("is-active");
      if (t.shared < authors.length) b.classList.add("cmp-topic-partial");
      b.appendChild(el("span", "cmp-topic-label", t.label));
      const counts = el("span", "cmp-topic-counts");
      authors.forEach((au, i) => {
        const c = el("span", "cmp-topic-count");
        c.appendChild(el("i", null, au.a));
        c.appendChild(el("b", null, fmt(t.counts[i])));
        counts.appendChild(c);
      });
      b.appendChild(counts);
      b.addEventListener("click", () => selectTopic(t));
      topicsEl.appendChild(b);
    });
  }

  function paintTopicHead() {
    if (!topicHeadEl) return;
    clear(topicHeadEl);
    if (!current) return;
    const h = el("h2", "cmp-topic-title", current.label);
    topicHeadEl.appendChild(h);
    const line = authors
      .map((au, i) => `${au.a} ${fmt(current.counts[i])}`)
      .join(" · ");
    topicHeadEl.appendChild(el("p", "cmp-note", `${line} recorded statements`));
  }

  /* Why a citation has no text, in the reader's words rather than in
   * the endpoint's. `not-resolved-here` is the per-request file budget
   * on the worker and genuinely means "ask again", so it says so. */
  const NO_TEXT = {
    "licensed": "The licence on this collection does not allow the passage to be shown here.",
    "work-not-held": "This library does not hold the text of this work, only the citation.",
    "locus-not-found": "The cited place is not in the copy of the work held here.",
    "work-has-no-columns": "The copy of this work held here carries no column numbers, so the citation cannot be located in it.",
    "locus-not-held": "The text of this part of the work is not held here.",
    "no-column-range": "This work has no column range recorded, so the citation cannot be located.",
    "no-locus": "The index recorded no place in the work for this statement.",
    "not-resolved-here": "The passage was not fetched with this page of results. Load more to bring it in.",
    "read-failed": "The passage could not be read just now.",
  };
  const NO_TEXT_DEFAULT = "The passage behind this citation could not be reached.";

  /* How precise the quotation is, said plainly. "extract" is the
   * index's own sentence, proved to sit at the cited place. Anything
   * else is the opening of the cited column or page, taken whole from
   * the work — a Migne column runs to some hundreds of words and the
   * index points at the column, not at a sentence in it, so the label
   * must not imply otherwise. */
  function provenanceOf(q) {
    if (!q || q.status !== "ok") return "";
    const locus = q.locus ? `${q.locus} · ` : "";
    if (q.unit === "extract") return `${locus}the passage the index marks`;
    if (q.unit === "column") return `${locus}the opening of the cited column`;
    return `${locus}the opening of the cited page`;
  }

  function statementNode(r, au) {
    const art = el("article", "cmp-statement");

    if (r.q) {
      art.appendChild(el("blockquote", "cmp-quote", r.q));
      const prov = provenanceOf(r.quote);
      if (prov) art.appendChild(el("p", "cmp-provenance", prov));
    } else {
      const why = (r.quote && NO_TEXT[r.quote.status]) || NO_TEXT_DEFAULT;
      art.appendChild(el("p", "cmp-notext", why));
    }

    /* The index's own words, always labelled and never in a blockquote.
     * `statement` is its summary of the position; `summary` its
     * description of the page. Neither is anything the author wrote,
     * and an unlabelled line under a quotation reads as the quotation
     * continuing. */
    const note = r.index.statement || r.index.summary;
    if (note) {
      const gloss = el("p", "cmp-gloss");
      gloss.appendChild(el("span", "cmp-gloss-label", "Index note"));
      gloss.appendChild(document.createTextNode(note));
      art.appendChild(gloss);
    }

    const cite = el("p", "cmp-cite");
    const meta = au.works.get(r.w);
    const title = (meta && meta.t) || r.wt || r.w || "Source work";
    cite.appendChild(el("span", "cmp-cite-work", title));
    if (r.s) cite.appendChild(el("span", "cmp-stance", r.s));
    const href = hrefOf(r);
    if (href) cite.appendChild(link(href, "Read the passage", "cmp-read"));
    art.appendChild(cite);
    return art;
  }

  function paintColumns() {
    if (!columnsEl) return;
    clear(columnsEl);
    if (!current || !authors.length) return;
    columnsEl.style.setProperty("--cmp-cols", String(authors.length));

    authors.forEach((au) => {
      const cell = cellFor(au, current);
      const col = el("section", "cmp-col");

      const head = el("header", "cmp-col-head");
      const h = el("h3", "cmp-col-name");
      h.appendChild(link(`/the-faith-received/author/?a=${encodeURIComponent(au.s)}`, au.a));
      head.appendChild(h);
      head.appendChild(el("p", "cmp-note", whenOf(au.r)));
      col.appendChild(head);

      const groups = groupsOf(au, cell);
      const shown = groups.reduce((n, g) => n + g.rows.length, 0);

      // The count line, and the one place the deep index is talked
      // about. Four different truths, four different sentences.
      const prog = el("p", "cmp-progress");
      if (cell.loading) prog.textContent = "Loading…";
      else if (!cell.rows.length) prog.textContent = "No statements recorded on this topic.";
      else {
        let t = `${fmt(shown)} of ${fmt(cell.rows.length)} loaded`;
        if (shown === cell.rows.length) t = `${fmt(shown)} loaded`;
        if (cell.total > cell.rows.length) {
          t += cell.deepUnavailable
            ? `, of ${fmt(cell.total)} in the index. The rest of the index is not open yet.`
            : `, of ${fmt(cell.total)} in the index.`;
        } else t += ".";
        if (cell.failed) t += " This is the room's selection; the full file did not answer.";
        prog.textContent = t;
      }
      col.appendChild(prog);

      /* One sentence on what is being quoted, because the two units are
       * not the same claim and the reader should not have to work it
       * out from forty provenance lines. */
      if (!cell.loading && cell.indexOnly && cell.rows.length) {
        col.appendChild(el(
          "p",
          "cmp-note cmp-warn",
          "The passages behind these citations could not be reached, so what follows is the index's own note on each one and not the writer's words.",
        ));
      } else if (!cell.loading && cell.textStats && cell.textStats.resolved != null) {
        const s = cell.textStats;
        const parts = [];
        if (s.extract) parts.push(`${fmt(s.extract)} at the sentence the index marks`);
        if (s.locus) parts.push(`${fmt(s.locus)} at the opening of the cited column or page`);
        let line = parts.length
          ? `Quotations are taken from the works themselves: ${parts.join(", ")}.`
          : "";
        if (s.unresolved) {
          line += ` ${fmt(s.unresolved)} could not be reached and are shown as citations alone.`;
        }
        if (line) col.appendChild(methodEl(line.trim(), "cmp-note"));
      }

      const body = el("div", "cmp-col-body");
      if (!cell.loading && cell.rows.length && !shown) {
        body.appendChild(el("p", "cmp-note", "No loaded statements match these filters."));
      }
      groups.forEach((g) => {
        const d = el("details", "cmp-work");
        if (cell.open.has(g.w) || (!cell.open.size && g === groups[0])) d.open = true;
        const sum = el("summary", "cmp-work-head");
        const t = el("span", "cmp-work-title", g.label);
        sum.appendChild(t);
        if (g.sub) sum.appendChild(el("small", "cmp-work-sub", g.sub));
        sum.appendChild(el("small", "cmp-work-n", fmt(g.rows.length)));
        d.appendChild(sum);
        const wrap = el("div", "cmp-work-body");
        g.rows.forEach((r) => wrap.appendChild(statementNode(r, au)));
        const openWork = readerHref(g.w, null);
        if (openWork) wrap.appendChild(link(openWork, "Open the work", "cmp-open-work"));
        d.appendChild(wrap);
        d.addEventListener("toggle", () => {
          if (d.open) cell.open.add(g.w);
          else cell.open.delete(g.w);
        });
        body.appendChild(d);
      });

      /* Paging. /v1/evidence answers fifty statements at a time, and it
       * reads a work file per page to quote from, so the rest is asked
       * for rather than pulled down unbidden. A column that fell back
       * to the index rows has nothing to page. */
      if (!cell.loading && !cell.indexOnly && cell.cursor && !cell.done) {
        const more = el("button", "cmp-more", cell.paging ? "Loading…" : "Show more statements");
        more.type = "button";
        more.disabled = !!cell.paging;
        more.addEventListener("click", async () => {
          if (cell.paging) return;
          cell.paging = true;
          paintColumns();
          const token = run;
          const ok = await loadEvidence(cell, token);
          if (token !== run) return;
          cell.paging = false;
          if (!ok) cell.done = true;
          paintColumns();
        });
        body.appendChild(more);
      }

      col.appendChild(body);
      columnsEl.appendChild(col);
    });
  }

  function paintSaved() {
    if (!savedList) return;
    const views = readViews();
    const here = tailOf(state);
    if (savedCount) savedCount.textContent = views.length ? `${fmt(views.length)} in this browser` : "none yet";
    clear(savedList);
    if (!views.length) {
      savedList.appendChild(el("p", "cmp-note",
        "Save a comparison and it appears here, kept in this browser."));
      return;
    }
    views.forEach((v) => {
      const row = el("div", "cmp-saved-row");
      if (v.tail === here) row.classList.add("is-active");
      // This page, at another address. Hosted that is an in-page anchor
      // and the hashchange it fires is what re-renders the panel;
      // standalone it is the same link it always was.
      row.appendChild(link(location.pathname + hashFromTail(v.tail), v.name, "cmp-saved-name"));
      row.appendChild(el("small", "cmp-saved-meta",
        (v.authors || []).join(" · ") + (v.topic ? ` · ${v.topic}` : "") + (v.tail === here ? " · this view" : "")));
      const del = el("button", "cmp-saved-remove", "Remove");
      del.type = "button";
      del.setAttribute("aria-label", `Remove the saved view ${v.name}`);
      del.addEventListener("click", () => {
        writeViews(readViews().filter((x) => x.id !== v.id));
        paintSaved();
        say("Saved view removed.");
      });
      row.appendChild(del);
      savedList.appendChild(row);
    });
  }

  /* ── Actions ─────────────────────────────────────────────────── */

  function selectTopic(t) {
    current = t;
    state.sel = t.tslug;
    writeHash();
    paintTopics();
    paintTopicHead();
    paintColumns();
    const token = run;
    authors.forEach((au) => {
      const cell = cellFor(au, t);
      if (!cell.rows.length && cell.loading !== false) fillCell(au, t, token);
    });
    if (topicHeadEl) topicHeadEl.setAttribute("tabindex", "-1");
    if (topicHeadEl) topicHeadEl.focus({ preventScroll: false });
  }

  function saveView() {
    if (!authors.length) { say("Add an author before saving a view."); return; }
    const tail = tailOf(state);
    const views = readViews();
    const existing = views.filter((v) => v.tail === tail)[0];
    const name = [
      authors.map((a) => a.a).join(" · "),
      current ? `on ${current.label}` : "",
    ].filter(Boolean).join(" ");
    const entry = {
      id: existing ? existing.id : `v${Date.now().toString(36)}`,
      name: (existing && existing.name) || name || "Comparison",
      tail,
      authors: authors.map((a) => a.a),
      topic: current ? current.label : "",
      at: new Date().toISOString().slice(0, 10),
    };
    const ok = writeViews([entry].concat(views.filter((v) => v.tail !== tail)));
    paintSaved();
    say(ok
      ? "Saved in this browser."
      : "This view could not be saved. Your browser's storage for this site is full.");
  }

  // Compare's one hand-off to the Desk: the comparison on screen
  // becomes a draft with every statement quoted and cited. The Desk
  // reads the same store, so this is a write and a redirect, not an
  // integration.
  function exportToDesk() {
    if (!window.MOFaithDesk) { say("The Desk could not be opened from here."); return; }
    if (!current || !authors.length) { say("Choose a topic before sending this to the Desk."); return; }

    const doc = document.createElement("div");
    const title = `${authors.map((a) => a.a).join(", ")} on ${current.label}`;
    const h1 = document.createElement("h2");
    h1.textContent = title;
    doc.appendChild(h1);

    const intro = document.createElement("p");
    intro.textContent = "Quoted passages are the writer's own words at the place cited, taken "
      + "from the work itself. Where the citation names a printed column, the quotation is the "
      + "opening of that column rather than a single sentence. Lines marked \"Index note\" are "
      + "the library's own description of a passage and are not quotations. A passage can report "
      + "another speaker or a view its author rejects. Read each one in its source before "
      + "attributing it.";
    doc.appendChild(intro);

    let n = 0;
    authors.forEach((au) => {
      const cell = cellFor(au, current);
      const groups = groupsOf(au, cell);
      if (!groups.length) return;
      const h = document.createElement("h3");
      h.textContent = `${au.a}, ${whenOf(au.r)}`;
      doc.appendChild(h);
      groups.forEach((g) => {
        const hw = document.createElement("p");
        const b = document.createElement("strong");
        b.textContent = g.label;
        hw.appendChild(b);
        doc.appendChild(hw);
        g.rows.forEach((r) => {
          n += 1;
          /* A blockquote ONLY where there are the writer's own words to
           * put in it. A row whose passage could not be reached goes
           * out as a citation and a labelled index note, so a draft
           * written from this export cannot carry a machine summary
           * inside quotation marks. */
          const locus = (r.quote && r.quote.locus) || (r.p != null ? String(r.p) : "");
          const citeText = `${au.a}, ${g.label}${locus ? `, ${locus}` : ""}${r.s ? ` · ${r.s}` : ""}`;
          const href = hrefOf(r);
          const readLink = () => {
            if (!href || !window.MOSafeHref || !window.MOSafeHref.isSafe(href)) return null;
            const a = document.createElement("a");
            a.href = href;
            a.textContent = "Read the passage";
            return a;
          };

          if (r.q) {
            const bq = document.createElement("blockquote");
            const p = document.createElement("p");
            p.textContent = r.q;
            bq.appendChild(p);
            const cite = document.createElement("cite");
            cite.textContent = citeText;
            const a = readLink();
            if (a) { cite.appendChild(document.createTextNode(" · ")); cite.appendChild(a); }
            bq.appendChild(cite);
            doc.appendChild(bq);
          } else {
            const p = document.createElement("p");
            const em = document.createElement("em");
            em.textContent = `${citeText} — passage not held here. `;
            p.appendChild(em);
            const a = readLink();
            if (a) p.appendChild(a);
            doc.appendChild(p);
          }

          const note = r.index.statement || r.index.summary;
          if (note) {
            const p = document.createElement("p");
            const label = document.createElement("strong");
            label.textContent = "Index note: ";
            p.appendChild(label);
            p.appendChild(document.createTextNode(note));
            doc.appendChild(p);
          }
        });
      });
    });

    if (!n) { say("There are no statements on screen to send."); return; }
    const created = window.MOFaithDesk.create({ title, html: doc.innerHTML });
    if (!created) {
      say("The draft could not be saved. Your browser's storage for this site is full.");
      return;
    }
    window.MOFaithDesk.setContext(created.id);

    // Hosted, the Desk is the next tab along rather than another page,
    // so this is a tab switch and not a navigation: reloading the whole
    // document to reach a panel that is already in it would throw away
    // the comparison the reader just made, and they will want to come
    // back to it. ?doc= is still written, because that is the address of
    // a paper and the Desk reads it on both its first wake and every
    // later one; and it is still what makes the result linkable.
    //
    // The tab is asked for by CLICKING ITS BUTTON rather than by writing
    // the hash. The button is the shell's own entry point: it carries
    // the tail memo and the aria-selected bookkeeping with it, neither
    // of which this file knows anything about.
    if (MODE) {
      const url = new URL(location.href);
      url.searchParams.set("doc", created.id);
      history.replaceState(null, "", url.pathname + url.search + location.hash);
      const tab = document.querySelector('[data-research-mode="desk"]');
      if (tab) { tab.click(); return; }
    }
    location.assign(`/the-faith-received/desk/?doc=${encodeURIComponent(created.id)}`);
  }

  /* ── Render ──────────────────────────────────────────────────── */

  async function render() {
    run += 1;
    const token = run;
    const resolved = await resolveAuthors(token);
    if (token !== run || resolved === null) return;
    authors = resolved;

    // An author asked for by address that the roster does not hold.
    const missing = state.a.filter((s) => !authors.some((a) => a.s === s));
    state.a = authors.map((a) => a.s);

    paintAuthors();
    paintAddList();

    // Said in BOTH branches below, and computed here so it cannot drift
    // out of one of them. A link that named two authors and resolved
    // none of them used to fall through the early return with nothing
    // on screen and nothing in the status line — an empty comparison
    // and a broken one look identical, and the reader was shown the
    // empty one. That matters more now than it did: a Compare link
    // shared before this panel moved into the Research desk arrives
    // through a redirect, so a reader landing on an empty tab has even
    // less idea what became of it.
    const notes = [];
    if (missing.length) notes.push(`${missing.length === 1 ? "One author" : `${missing.length} authors`} in this link could not be found in the library.`);
    if (rosterMissing.length) notes.push(`${rosterMissing.join(" and ")} did not answer, so those authors are missing from the list.`);

    const has = authors.length > 0;
    if (toolsEl) toolsEl.hidden = !has;
    if (topicsWrap) topicsWrap.hidden = !has;
    if (emptyEl) emptyEl.hidden = has;
    if (saveBtn) saveBtn.disabled = !has;
    if (exportBtn) exportBtn.disabled = !has;

    if (!has) {
      topics = [];
      current = null;
      clear(columnsEl);
      clear(topicHeadEl);
      paintTopics();
      writeHash();
      // Only when the address actually asked for somebody. An ordinary
      // empty desk is not a failure and the empty state already speaks
      // for it.
      say(notes.join(" "));
      return;
    }

    buildTopics();
    const wanted = state.sel;
    current = topics.filter((t) => t.tslug === wanted)[0] || topics[0] || null;
    if (current) state.sel = current.tslug;
    writeHash();
    paintTopics();
    paintTopicHead();
    paintColumns();
    say(notes.join(" "));

    if (current) {
      authors.forEach((au) => fillCell(au, current, token));
    }
  }

  /* ── Wiring ──────────────────────────────────────────────────── */

  function addAuthorByName(value) {
    const needle = fold(value);
    if (!needle || !roster) return false;
    const chosen = new Set(state.a);
    const pool = roster.filter((r) => !chosen.has(r.s));
    const exact = pool.filter((r) => fold(r.a) === needle);
    const hits = exact.length ? exact : pool.filter((r) => fold(r.a).indexOf(needle) !== -1);
    if (!hits.length) { say("No author of that name is in the library."); return false; }
    if (hits.length > 1 && !exact.length) {
      say(`${fmt(hits.length)} authors match that. Choose one from the list.`);
      return false;
    }
    if (state.a.length >= MAX_AUTHORS) { say("Four authors is the width of the desk."); return false; }
    state.a.push(hits[0].s);
    say("");
    writeHash();
    render();
    return true;
  }

  if (addForm) {
    addForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (addAuthorByName(addInput.value)) addInput.value = "";
    });
  }
  if (addInput) {
    addInput.addEventListener("input", () => {
      paintAddList();
      // A datalist pick fires `input` with the full name and no
      // keystroke, so an exact match commits immediately.
      const needle = fold(addInput.value);
      if (needle && roster && roster.some((r) => fold(r.a) === needle && state.a.indexOf(r.s) === -1)) {
        if (addAuthorByName(addInput.value)) addInput.value = "";
      }
    });
  }
  if (groupSel) {
    groupSel.addEventListener("change", () => {
      state.g = groupSel.value === "canon" ? "canon" : "work";
      writeHash();
      paintColumns();
    });
  }
  if (stanceSel) {
    stanceSel.addEventListener("change", () => {
      state.s = stanceSel.value;
      writeHash();
      paintColumns();
    });
  }
  if (phraseInput) {
    let t = null;
    phraseInput.addEventListener("input", () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        state.q = phraseInput.value;
        writeHash();
        paintColumns();
      }, 180);
    });
  }
  if (saveBtn) saveBtn.addEventListener("click", saveView);
  if (exportBtn) exportBtn.addEventListener("click", exportToDesk);

  // A real navigation: a pasted link, one of the example links or a
  // saved view below, or the back button. Hosted, the hash spends most
  // of its life naming some OTHER tab, and #notebook is not an
  // instruction to empty the comparison — so anything that is not ours
  // is left alone and the state stays in memory until the tab returns.
  window.addEventListener("hashchange", () => {
    if (!isOurs(location.hash)) return;
    const next = parseHash();
    if (tailOf(next) === tailOf(state)) return;
    state = next;
    if (groupSel) groupSel.value = state.g;
    if (stanceSel) stanceSel.value = state.s;
    if (phraseInput) phraseInput.value = state.q;
    render();
  });

  /* ── Binding ─────────────────────────────────────────────────── *
   * Everything to here costs nothing and runs at parse time, hidden
   * tab or not. The address is read now rather than on wake so that a
   * link opened straight onto this tab is already parsed by the time
   * the roster lands. */

  state = parseHash();
  if (groupSel) groupSel.value = state.g;
  if (stanceSel) stanceSel.value = state.s;
  if (phraseInput) phraseInput.value = state.q;
  if (savedWrap) savedWrap.hidden = false;
  paintSaved();

  // The example links in the empty state. Written in the markup as the
  // standalone "#a=…" so the panel is correct with no script at all,
  // and re-pointed at this page's own address here, which is what makes
  // them work inside the tab shell.
  root.querySelectorAll("[data-cmp-example]").forEach((a) => {
    const href = location.pathname + hashFromTail(a.getAttribute("data-cmp-example") || "");
    if (window.MOSafeHref) window.MOSafeHref.set(a, href, "#");
    else a.setAttribute("href", href);
  });

  /* ── Waking up ───────────────────────────────────────────────── *
   *
   * The roster is nine fetches and it is the entire cost of this panel.
   * Behind a tab it waits for the tab. The trigger is a
   * MutationObserver on the host panel's `hidden` attribute, for the
   * reason faith-constellations.js sets out at length: attribute
   * mutations are delivered as microtasks and do not care whether
   * anything is being painted, where a ResizeObserver or any
   * rAF-driven visibility trap is not delivered AT ALL in a tab the
   * browser is not painting, so a panel woken by one sits blank
   * forever.
   *
   * Once only. Nothing here is re-read on a second visit: the roster
   * does not change while the page is open, and loadRoster() memoises
   * anyway. */
  let booted = false;

  function boot() {
    if (booted) return;
    booted = true;

    if (!BASE) {
      say("The library could not be reached from this page, so nothing can be compared. Reload, and tell us if it keeps happening.");
      if (toolsEl) toolsEl.hidden = true;
      if (topicsWrap) topicsWrap.hidden = true;
      return;
    }

    say("Loading the library…");
    loadRoster().then(() => {
      say("");
      paintAddList();
      render();
    }).catch(() => {
      say("The list of authors could not be loaded, so nothing can be added to the comparison. Reload to try again.");
    });
  }

  if (hostPanel && hostPanel.hidden && typeof MutationObserver === "function") {
    const watch = new MutationObserver(() => {
      if (hostPanel.hidden) return;
      watch.disconnect();
      boot();
    });
    watch.observe(hostPanel, { attributes: true, attributeFilter: ["hidden"] });
  } else {
    // Standalone, or hosted and already the open tab because the reader
    // arrived on #compare.
    boot();
  }
})();
