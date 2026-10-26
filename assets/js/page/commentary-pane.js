/* COMMENTARY AND RECEPTION BESIDE THE TEXT (2026-10-18; owner: "make reading the bible and looking at these landmark commentaries as
   seamless as logos"; 10-19: "this should be THE go to resource for reception history for every scripture … just fix it").
   On the Scripture page by default (?pane=0 turns it off for the tab).

   The chapter's own text on the left; beside it one rail, half the width, with three views of the verse being read, in this order
   (order 10-19, owner: Commentary, Citations, Reception, opening on the Commentary; "design wise, it should be like the citation": every view is set like the Citations view: a small
   label over a large heading, thin-ruled rows, italic work titles over a muted author and century line, no box that scrolls):
     Commentary  one chosen commentary, following the reader: the verse at the reading line (or the verse clicked) brings it to
                 ITS note on that verse, read from its page, the note marked (commentary-anchor.js: never the place where the
                 commentary merely prints the verse); else its next note, or its closest earlier one, said plainly.
     Citations   every use of the verse (the site's own verse panel), filterable by kind.
     Reception   the verse's reception history from the pages: how many works cite it and from when, the century strip, the
                 commentaries with a note on it (each opens in the Commentary view), then each era's witnesses, oldest first.

   Creeds, confessions and catechisms (Mere Orthodoxy's page only; 10-19, owner: "On Commentary, we need to add Creeds, Confessions,
   and Catechisms whenever a verse is proof texted"): above the commentary, the articles that print the verse as a proof text, each
   with the words it stands behind and a link into the document at that page. The data is built from the documents' own text
   (scripts/build-confession-proofs.mjs), one file per book, fetched when the Commentary shows a verse of it. A chapter cited as a
   whole ("Gen. 1") is listed apart and said to be that.

   Where the places come from (nothing here guesses):
     - own notes: the chapter file's exegesis rows (v1/bible/all/<book>/<ch>.json.gz, "Its note on this verse");
     - chapter openings: the commentary map (v1/devotion.json.gz, `an`: chapter → page);
     - collections not on the map as verse notes (the Critici Sacri, 1698): v1/bible/commentary-overlay.json;
     - the reception history: v1/reception/scripture/<book>/<ch>.json (runs/reception_1015), every page that cites the verse, and
       the verse notes it knows, for every verse of the chapter (10-22);
     - (10-22, owner: "make sure the pane pinpoints the right place, whole bible and book commentaries") the volume of a set that
       holds the verse; for a set on the whole Bible the map knows only by where the book begins (`sp`), the chapter's own heading
       read in its pages ("PSAL. LI.") and the verse's note under it by its heading word ("Vers. 1."); a work on another book that
       cites the chapter opens where it cites it, said to be that. */
(function () {
  'use strict';
  const method = (html) => (window.TFRMethod ? window.TFRMethod.html(html) : html);
  // On unless ?pane=0 (in the address as the page was opened: Mere Orthodoxy's reader rewrites its address before this runs, so the
  // navigation entry is read too), which keeps it off for this tab; ?pane=1 turns it back on.
  const opened = ((performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || {}).name || '';
  const asked = (rx) => rx.test(location.search) || rx.test(opened);
  let on = true;
  try {
    if (asked(/[?&]pane=0\b/)) sessionStorage.setItem('fr_cp_off', '1');
    if (asked(/[?&]pane=1\b/)) sessionStorage.removeItem('fr_cp_off');
    if (sessionStorage.getItem('fr_cp_off') === '1') on = false;
  } catch (_) { on = !asked(/[?&]pane=0\b/); }
  if (window.FR_COMMENTARY_PANE === false) on = false;
  if (!on) return;
  /* ONE PANE, TWO SITES (2026-10-18, owner: "yes to all and send to ian"). The same file runs on The Faith Received's Scripture page
     (/bible, hash addresses #b/<book>/<ch>) and on Mere Orthodoxy's (/the-faith-received/scripture/?ref=<book>.<ch>.<v>, the theme's
     window.MOScriptureDev); each site differs only in where its verses, layout and data are. */
  const SITE = (() => {
    const mo = window.MOScriptureDev || document.querySelector('[data-sd-reader]');
    if (mo) {
      const lm = document.querySelector('meta[name="tfr-library-base"]');
      const S = () => window.MOScriptureDev || {};
      return {
        name: 'mo',
        base: ((lm && lm.content) || 'https://mo-tfr-library.mo-podcast-feed.workers.dev').replace(/\/$/, ''),
        where() {
          const q = new URLSearchParams(location.search).get('ref');
          const r = (q && S().parseRef && S().parseRef(q)) || (S().legacyRef && S().legacyRef(location));
          return r && r.book ? { book: r.book.lib, ch: String(r.c), v: r.v || 0, name: r.book.name, bk: r.book } : null;
        },
        read: (slug, p) => (S().sourceHref ? S().sourceHref(`/read?w=${slug}#b${p}-0`, slug, p) : `/the-faith-received/read/?w=${encodeURIComponent(slug)}#b${p}-0`),
        layout: '.sd-layout', side: '.sd-side', verses: '.bible-verse[data-v]',
        vnum: (el) => +el.dataset.v, clicked(t) { const b = t.closest('.bible-verse[data-v]'); return b ? +b.dataset.v : 0; },
        verseEl: (v) => document.querySelector(`.bible-verse[data-v="${v}"]`),
        pick: (v) => document.querySelector(`.bible-verse[data-v="${v}"]`),
        heatEl: (v) => document.querySelector(`.bible-verse[data-v="${v}"]`),
      };
    }
    return {
      name: 'tfr',
      base: 'https://0ss8v4l06kodnhp0.public.blob.vercel-storage.com',
      where() {
        const m = /#b\/([a-z0-9-]+)\/(\d+)(?:\?v=(\d+))?/.exec(location.hash);
        const h = document.querySelector('.scripture-chapter-title, main h1');
        return m ? { book: m[1], ch: m[2], v: +(m[3] || 0), name: ((h && h.textContent) || '').replace(/\s+\d+\s*$/, '').trim() } : null;
      },
      read: (slug, p) => `/read?w=${encodeURIComponent(slug)}#b${p}-0`,
      layout: '.scripture-reader-layout', side: '.scripture-verse-summary', verses: '.scripture-verse-wrap[id^="v"]',
      vnum: (el) => +el.id.slice(1), clicked(t) { const b = t.closest('[data-select-verse]'); return b ? +b.dataset.selectVerse : 0; },
      verseEl: (v) => document.getElementById(`v${v}`),
      pick: (v) => document.querySelector(`[data-select-verse="${v}"]`),
      heatEl: (v) => document.getElementById(`v${v}`),
    };
  })();
  document.documentElement.classList.add(`cp-site-${SITE.name}`);
  const BASE = SITE.base;
  const cache = new Map();
  /* IMPORTANCE, NOT A FIXED LIST (2026-10-19, owner: "rerank by importance and relevance like augustine obv, reformers … make sure in
   * scripture reader its easy to get to the key works … not just whole bible like the glossa or poole and sacred critics and lapide
   * but also for chapter comms like Augustine on John or the Psalms"). The list above ranked whole-Bible annotators (and Wesley, Clarke,
   * Benson, Coke) over every Father: Augustine's Tractates on John came 157th of 208. v1/scripture/rank.json gives every commentary on
   * the map its weight from curated knowledge of the tradition (owner 10-19: "we dont do citation based rerank"): the key commentators'
   * tier, else its author's, and whether it belongs to a set on the whole Bible; for the books readers open most, the key commentaries
   * on the book themselves (`books`). A chapter's commentaries are ranked in two groups, on the book (Augustine on John, Chrysostom's
   * homilies) and on the whole Bible (the Glossa, Lapide, Poole): by that standing, a commentary before a sermon or a volume of
   * collected works, one that covers the book before one on a single chapter, and a note on the chapter's verses first. */
  const RANK = { works: {}, authors: {}, books: {} };
  let rankReady = null;
  const loadRank = () => rankReady || (rankReady = json(`${BASE}/v1/scripture/rank.json`)
    .then((d) => { Object.assign(RANK.works, (d && d.works) || {}); Object.assign(RANK.authors, (d && d.authors) || {}); Object.assign(RANK.books, (d && d.books) || {}); })
    .catch(() => { rankReady = null; }));
  /* THE WHOLE-BIBLE SETS (10-23, owner: "make the whole bible commentaries match and open where they need and each whole bible is grouped
   * by tradition"; "works that are multi vol are grouped, so like grotius is a whole bible, wesley, baxters paraphrase, calov, cajetan").
   * v1/scripture/sets.json (runs/scripture_sets_1023/build_sets.py): each set (Lapide, Migne, Poole's Synopsis, the Critici Sacri, Calov,
   * Piscator, Grotius …) with its label, tradition, year and every volume; the strip shows one button a set, by tradition. */
  const SETS = { list: [], of: {}, trads: [] };
  let setsReady = null;
  const loadSets = () => setsReady || (setsReady = json(`${BASE}/v1/scripture/sets.json`)
    .then((d) => { SETS.list = (d && d.sets) || []; SETS.of = (d && d.of) || {}; SETS.trads = (d && d.trads) || []; })
    .catch(() => { setsReady = null; }));
  const setIdOf = (slug) => SETS.of[slug] || '';
  const impOf = (slug, a) => { const r = RANK.works[slug]; return r ? r[0] : (RANK.authors[a] || 0); };
  const KIND_W = { commentary: 1, sermons: 0.8, collected: 0.7 };
  function weigh(c) {
    // a series of sermons or tractates through the book (Augustine's 124 Tractates on John) is read as its commentary
    const kind = c.k === 'sermons' && c.cov >= 5 ? 1 : (KIND_W[c.k] || (c.overlay ? 1 : 0.65));
    const cov = c.cov >= 5 ? 1 : c.cov >= 2 ? 0.92 : 0.86;
    c.wb = (RANK.works[c.slug] || [])[1] === 1 || !!c.overlay || !!setIdOf(c.slug) ? 1 : 0;
    // verse notes on the chapter only break near-ties: importance leads (Augustine's Expositions before Calvin on Psalm 51)
    // (10-22) counted on the chapter file's own notes, as before the reception history's notes were read for every verse
    c.score = impOf(c.slug, c.a) * kind * cov + ((c.own != null ? c.own : Object.keys(c.notes).length) ? 0.5 : 0);
    return c;
  }
  // the name a key button carries: "Augustine", "Chrysostom", "Glossa", "Critici Sacri"
  const SHORT = { 'Augustine of Hippo': 'Augustine', 'John Chrysostom': 'Chrysostom', 'Walafrid Strabo': 'Glossa', 'Walahfrid Strabo': 'Glossa',
    'Westminster Assembly': 'Westminster Annotations', 'Gregory I': 'Gregory the Great', 'Theophylact, Archbishop of Bulgaria': 'Theophylact',
    'The critics, collected by John Pearson and others': 'Critici Sacri', 'Cornelius a Lapide': 'Lapide', 'collected by Thomas Aquinas': 'Catena Aurea',
    'collected by Thomas Aquinas The catena': 'Catena Aurea',
    'Denys the Carthusian': 'Denys', 'Willem van Est': 'Estius', 'Nicholas of Lyra': 'Lyra', 'Matthew Poole': 'Poole',
    // Fathers whose given name alone names another man on the same strip (10-25: "John" on Galatians 2 was John of Damascus)
    'John of Damascus': 'Damascene', 'Gregory of Nyssa': 'Nyssen', 'Gregory of Nazianzus': 'Nazianzen' };
  const short = (a) => {
    if (SHORT[a]) return SHORT[a];
    // "The catena, collected by Thomas Aquinas" in the chapter files
    if (/catena/i.test(a) && /aquinas/i.test(a)) return 'Catena Aurea';
    // the Greek catalogue's "Archbishop of Bulgaria Theophylact", "Bishop of Trikka Oecumenius": the name comes last
    if (/^(?:Arch)?bishop\b/i.test(a || '')) return String(a).trim().split(/\s+/).pop();
    const b = String(a || '').replace(/^Uncertain author\s*\(?/i, '').replace(/\)$/, '').replace(/\s+(?:of|the)\s+.*$/i, '').trim();
    const p = b.split(/\s+/);
    return /^[IVXL]+$/.test(p[p.length - 1]) ? b : p[p.length - 1];
  };
  // Poole's sigla ("Be." Beza, "Pi." Piscator …), from each volume's own Catalogus Auctorum, carried in the overlay
  const SIGLA = {};
  const reEsc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function siglaOf(slug) {
    const sg = SIGLA[slug]; if (!sg) return null;
    const keys = Object.keys(sg).filter((k) => k.length >= 3).sort((a, b) => b.length - a.length);
    if (!keys.length) return null;
    return { sg, rx: new RegExp(`(^|[\\s;,(\\]])(${keys.map(reEsc).join('|')})(?=[\\s;,.)\\]]|$)`, 'g') };
  }
  const store = { get(k, d) { try { return localStorage.getItem(k) ?? d; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} } };
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // JSON, gzipped or not: Blob serves the .json.gz bytes, Mere Orthodoxy's library worker serves them already opened
  function json(u) {
    if (cache.has(u)) return cache.get(u);
    const p = fetch(u, { credentials: 'omit' }).then(async (r) => {
      if (!r.ok) throw new Error(u);
      const buf = new Uint8Array(await r.arrayBuffer());
      const text = buf[0] === 0x1f && buf[1] === 0x8b
        ? await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
        : new TextDecoder().decode(buf);
      return JSON.parse(text);
    });
    // a failed fetch is tried again, not remembered
    p.catch(() => { if (cache.get(u) === p) cache.delete(u); });
    cache.set(u, p); return p;
  }
  const gz = json;
  const where = () => SITE.where();
  // the book as a reference names it: "Psalm 51:3", not "Psalms 51:3"
  const refName = (w) => (w && w.book === 'psalms' ? 'Psalm' : ((w && w.name) || String((w && w.book) || '').replace(/-/g, ' ')));
  // a page or a column: only Migne's volumes are numbered by the column (as the rest of the site says it)
  const pgOf = (slug, p) => `${/^(pld|pg)-/.test(String(slug || '')) ? 'col.' : 'p.'} ${p}`;

  // ── the commentaries on this chapter ──────────────────────────────────────────────────────────────────────────────────────
  // The loaders (a work's pages, TEI, Migne columns, EEBO books) and the list of works a chapter has are in commentary-pages.js, so
  // scripts/check-commentary-pages.mjs can open every one of them against the live library.
  const PG = window.FRCommentaryPages.createPages({ base: BASE, mo: SITE.name === 'mo', json,
    text(u) { return fetch(u, { credentials: 'omit' }).then((r) => { if (!r.ok) throw new Error(u); return r.text(); }); } });
  // the verse rail (scripture-verse-rail.js) may load after this file; its sets (workKey) are needed to read a chapter's works, so it
  // is waited for, a few seconds at most
  const railReady = () => new Promise((res) => { const t0 = Date.now(); (function wait() { if (window.FRVerseRail || Date.now() - t0 > 4000) res(); else setTimeout(wait, 50); }()); });
  // the set a work belongs to (one author, one title or slug stem: the list folds its volumes under one entry)
  const setOf = (c) => { const VR = window.FRVerseRail; return VR && VR.workKey ? VR.workKey(c) : c.slug; };
  const X_SHELF = { Reformed: 'rf', 'Continental Reformed': 'rf', 'Roman Catholic': 'rc', Lutheran: 'lu', Medieval: 'md', 'English Divines': 'ed' };
  async function commentaries(book, ch) {
    // the map, the overlay and the reception file are the loader's own fetches (one cache): read again here, not fetched again
    const [{ works, meta, sigla, nv }, dev, ov, rec] = await Promise.all([PG.listWorks(book, ch),
      json(`${BASE}/v1/devotion.json.gz`).catch(() => null), json(`${BASE}/v1/bible/commentary-overlay.json`).catch(() => null),
      json(`${BASE}/v1/reception/scripture/${book}/${ch}.json`).catch(() => null), loadRank(), loadSets(), railReady()]);
    Object.assign(S.meta, meta); Object.assign(SIGLA, sigla);
    // ONE NAME A WORK (10-21): a work takes its author as the map prints it (the map's entry is the last word in `meta`), one spelling
    // to a work; the chapter file's rows spell some differently ("Walahfrid" and "Walafrid" Strabo), which made one Glossa two
    // authors and two "Glossa" buttons
    for (const c of works) { const m = meta[c.slug]; if (m && m.a) c.a = m.a; }
    const by = new Map(works.map((c) => [c.slug, c])), onMap = new Set();
    // (10-22) a set on the whole Bible whose map knows where the book begins in the volume and the chapters it holds, but not the
    // chapter's page (the Westminster Annotations on the Psalms), was left out of the chapter's list: it is offered at the book's first
    // page, said to be only that. An entry with no chapters of its own (Calov's Old Testament filed under Hebrews) is not.
    for (const e of ((dev && dev.books && dev.books[book]) || [])) {
      onMap.add(e.w);
      // (10-22, owner: "make sure this is in english") the map names the piece in English (st, stc), the name as printed beside it
      // (stl, stcl), shown on hover
      const tl = (e.stc && e.stc[ch] ? e.stcl && e.stcl[ch] : e.stl) || '';
      if (tl && by.has(e.w) && Number(ch) >= (e.c1 || 1) && Number(ch) <= (e.c2 || 999)) by.get(e.w).tl = tl;
      if (!(e.c1 > 0) || Number(ch) < e.c1 || Number(ch) > e.c2 || (e.an && e.an[ch] != null) || e.sp == null || (RANK.works[e.w] || [])[1] !== 1) continue;
      let c = by.get(e.w);
      if (!c) {
        const piece = (e.stc && e.stc[ch]) || e.st;
        c = { slug: e.w, a: e.a || '', t: piece || e.t || e.w, notes: {}, rows: {}, open: null, sh: e.sh === 'x' ? (X_SHELF[e.tr] || 'x') : e.sh, k: e.k,
          cov: Object.keys(e.an || {}).length || ((Number(e.c2) || 0) - (Number(e.c1) || 0) + 1) };
        if (piece) c.vol = e.t;
        by.set(e.w, c);
      }
      if (c.open == null && c.bookAt == null) c.bookAt = e.sp;
    }
    /* ONE VOLUME FOR THE CHAPTER (10-22). Where two volumes of one set in the overlay claim the chapter and the contents in some of
     * their labels name the book, the others are left out: Denys's Tom. XII ("Luke 10-24 and John") holds John 1, and his Tom. XIV ("the
     * Catholic Epistles, Acts and the Apocalypse") files the First Epistle of John under the Gospel's chapters. A volume the map or the
     * library's own note on a verse places in the chapter stays. The book is named by its own words ("john", "psalms"). */
    const named = new RegExp(`\\b${reEsc(book.replace(/-/g, ' '))}\\b`, 'i'), sets = new Map();
    for (const [slug, w] of Object.entries((ov && ov.works) || {})) {
      const c = by.get(slug); if (!c || !(w.books && w.books[book] && w.books[book][ch])) continue;
      const k = setOf(c); if (!sets.has(k)) sets.set(k, []);
      sets.get(k).push({ c, label: String(w.vol || '').replace(/^[^:]*:\s*/, '') });
    }
    const indexed = (c) => Object.values(c.rows || {}).some((rs) => rs.some((r) => r.how === 'exegesis' && /note on this verse/i.test(r.g || '')));
    for (const os of sets.values()) {
      const yes = os.filter((o) => o.label && named.test(o.label));
      if (os.length > 1 && yes.length && yes.length < os.length) for (const o of os) if (!yes.includes(o) && !onMap.has(o.c.slug) && !indexed(o.c)) by.delete(o.c.slug);
    }
    /* THE VERSE NOTES THE RECEPTION HISTORY KNOWS (10-22), for every verse: before, they were read for the verse the chapter opened on
     * only, so a verse opened at its note or not by the order it was read in. They are kept apart from the chapter file's (c.recNotes)
     * and used for their own verse only, where the resolver finds no note of its own (resolve): as neighbours they made it open
     * Chrysostom on Matthew 5:3 at his note on 5:13 instead of the homily's opening. */
    for (const [v, x] of Object.entries((rec && rec.verses) || {})) {
      for (const [slug, p] of Object.entries(x.notes || {})) { const c = by.get(slug); if (c && !(v in c.notes)) (c.recNotes || (c.recNotes = {}))[v] = p; }
    }
    /* A NOTE OUT OF ITS CHAPTER'S PAGES is a mis-keyed row (Augustine on John 6:42 at col. 1901, Tractate 104 on John 17), and is dropped,
     * as The Faith Received's pane drops it (10-18). (10-22) Unless most of the chapter's notes lie out of them, together: then the map's
     * page is the one out of place, and the notes are kept, the chapter taken to open where they begin. Poole's Annotations: the map puts
     * Psalm 51 at p. 612, which is Isaiah 50, and his notes on the psalm are at pp. 459-460; the resolver reads only the chapter's
     * section from the map's page, so it never reached them. */
    for (const c of by.values()) {
      const lo = Number(c.open), hi = Number(c.close);
      if (lo > 0 && hi > lo) {
        const out = Object.entries(c.notes).filter(([, p]) => { const n = Number(p); return n && (n < lo - 2 || n > hi + 2); });
        if (out.length >= 3 && out.length > Object.keys(c.notes).length - out.length) {
          // the run of them, out from the middle one while the pages run on: where it begins the chapter opens, where it ends it closes
          const ps = out.map(([, p]) => Number(p)).sort((a, b) => a - b), mid = Math.floor(ps.length / 2);
          let i = mid, j = mid;
          while (i > 0 && ps[i] - ps[i - 1] <= 6) i -= 1;
          while (j < ps.length - 1 && ps[j + 1] - ps[j] <= 6) j += 1;
          c.open = ps[i]; c.close = ps[j] + 1; c.mapOff = true;
        } else for (const [v] of out) delete c.notes[v];
      }
      // the reception history's notes out of the chapter's pages are dropped as the chapter file's are
      const lo2 = Number(c.open), hi2 = Number(c.close);
      if (c.recNotes && lo2 > 0 && hi2 > lo2) for (const [v, p] of Object.entries(c.recNotes)) { const n = Number(p); if (n && (n < lo2 - 2 || n > hi2 + 2)) delete c.recNotes[v]; }
      weigh(c);
      // (10-22) a volume of sermons the map files under the chapter for a sermon or two is listed with the homilies and sermons on the
      // passage; a series through the book (Augustine's Tractates on John, Chrysostom's homilies) is read as its commentary (weigh)
      if (c.k === 'sermons' && !(c.cov >= 5) && c.wb === 0) c.kd = 'sermons';
    }
    // the chapter's verse count, for the featured strip's rule (10-25): a curated key with no note in the chapter is featured only when
    // it touches a good part of it (c.touch, counted by the loader: Aquinas on Romans 3 has rows on most verses, none marked a note;
    // Augustine's Exposition of Propositions two quotations)
    S.nv = nv || 0;
    return [...by.values()].sort((x, y) => x.wb - y.wb || y.score - x.score || x.a.localeCompare(y.a));
  }

  // ── a commentary page ─────────────────────────────────────────────────────────────────────────────────────────────────────
  // page() belongs to the loader built above; stride() and paragraphs() are the module's own helpers (not on the loader: reading them
  // from PG left both undefined, so every commentary page threw in show() and the catch below reported "could not be loaded")
  const { page } = PG;
  const { stride, paragraphs } = window.FRCommentaryPages;
  /* THE PLACE OF A CHAPTER IN A BOOK WITH REPEATING PAGE NUMBERS (10-25): the map's anchors for the work on this book, taken in
   * chapter order, each at the first occurrence of its printed number at or after the one before (greedy, monotonic); the cursor
   * for chapter ch is the occurrence its anchor resolved to, kept in PG.eeboCur[slug] for every page read of that work until
   * another chapter is opened. */
  /* THE READER'S PAGE IDS IN A BOOK WITH REPEATING PAGE NUMBERS (10-25): the reader (reader-core.js, loadEeboCanon) keeps the bare
   * printed number for the first page so numbered and gives the k-th repeat (k from 1) the id 100000*k+n, counting the occurrences
   * as eeboPageMap does (two marks of one number in a row are one page). readerPage says the id of the occurrence page() reads for
   * a printed number under the chapter's place (PG.eeboCur), so a link opens the page the pane shows; any other work keeps its
   * number. The citations list (cfHref) keeps the mined page as it was mined. */
  const eeboReaderId = (n, k) => (k ? 100000 * k + Number(n) : Number(n));
  function readerPage(slug, n) {
    const d = (S.eeboData || {})[slug], at = PG.eeboCur[slug];
    if (!d || !d.repeats || at == null) return n;
    const is = d.all.get(String(n)) || [], i = is.find((x) => x >= at);
    return i == null ? n : eeboReaderId(n, is.indexOf(i));
  }
  const readHref = (slug, p) => SITE.read(slug, readerPage(slug, p));
  async function eeboCursor(c, ch) {
    if (!c || !window.FRCommentaryPages.EEBO.test(c.slug)) return null;
    const d = await PG.eebo(c.slug).catch(() => null);
    if (!d || !d.repeats) { delete PG.eeboCur[c.slug]; return null; }
    S.eeboData = S.eeboData || {}; S.eeboData[c.slug] = d;
    // the chain starts at the entry's start mark (spm: the printed mark, counted in document order, where its first chapter opens),
    // else at the top of the book; a chapter whose number has no page at or after the one before leaves the place where it was
    let cur = c.spm != null && d.markIdx && d.markIdx[Number(c.spm) - 1] != null ? d.markIdx[Number(c.spm) - 1] : 0;
    for (const k of Object.keys(c.an || {}).map(Number).filter((x) => x > 0 && x <= Number(ch)).sort((a, b) => a - b)) {
      const is = d.all.get(String(c.an[k])) || []; const i = is.find((x) => x >= cur);
      if (i != null) cur = i;
    }
    PG.eeboCur[c.slug] = cur;
    return cur;
  }
  // a verse's note opens its paragraph: "12. PROPTEREA…", "Vers. 12.", "V. 12", "Verse 12."
  const noteRx = (v) => new RegExp(`^(?:ver(?:s(?:e|us)?)?\\.?\\s*|v\\.\\s*)?\\(?${v}\\b\\s*[.:,)\\]]`, 'i');

  // ── the reception history of the verse ────────────────────────────────────────────────────────────────────────────────────
  const recOf = (book, ch) => json(`${BASE}/v1/reception/scripture/${book}/${ch}.json`).catch(() => null);
  const ERA = { fathers: ['The Fathers', 'to 600'], 'early-medieval': ['Early Middle Ages', '600–1100'],
    scholastic: ['High and late Middle Ages', '1100–1500'], reformation: ['Reformation', '1500–1600'],
    '17th': ['Seventeenth century', '1600–1700'], '18th': ['Eighteenth century', '1700–1800'], modern: ['Since 1800', ''] };
  const ord = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')}`;
  const fmt = (n) => Number(n || 0).toLocaleString('en-US');
  const VERB = { quotation: 'quotes it', explicit: 'cites it', allusion: 'alludes to it', exegesis: 'expounds it' };
  const rankOf = (slug, a) => -impOf(slug, a);
  // a page's one-line gist, as the reception file carries it (cut at about 170 characters): ended where it ends, else marked as cut
  const gist = (g) => { const t = String(g || '').trim(); if (/[.!?)\]"'”’]$/.test(t)) return t; const u = t.length > 200 ? t.slice(0, 200) : t; return `${u.replace(/[\s,;:]+\S*$/, '')}…`; };
  const centuryOf = (slug) => { const n = S.cen[slug], f = (window.MOScriptureDev || {}).centuryLabel; return n && f ? f(n) : ''; };
  const dot = ' · ';

  // ── the pane ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // The rail opens on the Commentary (10-19, owner, after trying Citations first), in every case: a verse selected, a deep link, the
  // phone sheet. The order of the tabs is Commentary, Citations, Reception. The last view is not remembered (the old fr_cp_tab key
  // is cleared). Below 900px the verse panel is under the verse in the text, so there Citations shrinks the sheet to its tabs.
  const wide = matchMedia('(min-width: 900px)');
  const firstTab = () => 'c';
  try { localStorage.removeItem('fr_cp_tab'); } catch (_) {}
  const S = { list: [], cur: null, verse: null, follow: store.get('fr_cp_follow', '1') === '1', lang: store.get('fr_cp_lang', 'en'),
    shown: null, token: 0, meta: {}, cen: {}, rec: null, pin: false, tab: firstTab(), dirOpen: new Set(), dirVerse: 0, years: new Map(), heads: new Map(),
    hymns: [], preach: null, vols: new Map() };
  const A = window.FRCommentaryAnchor;
  let pane, layout, observer;

  // the key row's edges: faded where it runs on past the screen (is-runs, is-scrolled, is-end), never cut at its start
  const keyEdges = (el) => {
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    el.classList.toggle('is-runs', max > 2);
    el.classList.toggle('is-scrolled', el.scrollLeft > 2);
    el.classList.toggle('is-end', max > 2 && el.scrollLeft >= max - 2);
  };
  // the chosen key in view in its row, when the row runs past the screen
  const keyInView = () => {
    const el = pane && pane.querySelector('.cp-keys'), on = el && el.querySelector('.cp-key[aria-pressed="true"]');
    if (!el || wide.matches) return;
    if (on) {
      const a = el.getBoundingClientRect(), b = on.getBoundingClientRect();
      if (b.left < a.left + 8 || b.right > a.right - 24) el.scrollLeft += b.left - a.left - 24;
    }
    keyEdges(el);
  };
  // a control the site floats at the left edge (its text-to-speech pill): where it lies over the sheet, the sheet's words start to its right
  function clearEdge() {
    if (!pane || wide.matches || SITE.name !== 'mo') return;
    const r = pane.getBoundingClientRect();
    let right = 0;
    for (let y = Math.max(0, r.top + 4); y < Math.min(innerHeight, r.bottom); y += 20) {
      for (const x of [4, 14, 26]) {
        for (const el of document.elementsFromPoint(x, y)) {
          if (el === pane || pane.contains(el)) continue;
          let f = el;
          while (f && f !== document.body && getComputedStyle(f).position !== 'fixed') f = f.parentElement;
          if (!f || f === document.body || f.contains(pane) || f.closest('.fr-survey, header, .site-header')) continue;
          const q = f.getBoundingClientRect();
          if (q.left < 24 && q.width < 140) right = Math.max(right, q.right);
        }
      }
    }
    // 14px past it: the tint a note's words sit on reaches 10px into the margin (.cp-hit), and it stays clear too
    pane.style.setProperty('--cp-clear-left', right ? `${Math.ceil(right + 14)}px` : '0px');
  }
  function build() {
    layout = document.querySelector(SITE.layout);
    if (!layout || layout.querySelector('.cp-pane')) return !!layout;
    document.body.classList.add('cp-on');
    pane = document.createElement('aside');
    pane.className = 'cp-pane'; pane.setAttribute('aria-label', 'Commentary beside the text');
    pane.innerHTML = `
      <header class="cp-top"><p class="cp-eyebrow">Commentary</p><h2 class="cp-ref"></h2>${SITE.name === 'mo' ? '<button type="button" class="sd-close cp-close" aria-label="Close verse panel" hidden>Close</button>' : ''}</header>
      <div class="cp-head">
        <div class="cp-pickwrap">
          <div class="cp-cur"><div class="cp-cur-id"><span class="cp-what"></span><span class="cp-who">Commentary</span></div>
            <button type="button" class="cp-pick" aria-expanded="false" aria-controls="cpList">Change</button></div>
          <div class="cp-keys" role="group" aria-label="Key commentaries on this chapter"></div>
          <div class="cp-list" id="cpList" role="region" aria-label="Every commentary on this chapter" hidden></div>
        </div>
        <div class="cp-lang" role="group" aria-label="Language of the commentary">
          <button type="button" data-lang="en" aria-pressed="true">English</button><button type="button" data-lang="la" aria-pressed="false">Latin</button>
        </div>
      </div>
      <p class="cp-where" aria-live="polite"></p>
      <div class="cp-body"></div>
      <div class="cp-rec" aria-live="polite"></div>
      <div class="cp-foot">
        <label class="cp-follow"><input type="checkbox"> Follow the text</label>
        <span class="cp-pages"><button type="button" data-step="-1">Previous page</button><button type="button" data-step="1">Next page</button></span>
      </div>`;
    if (SITE.name === 'mo') {
      pane.querySelector('.cp-top').insertAdjacentHTML('afterend', `
      <section class="cp-creeds" aria-labelledby="cpCreedsH" hidden>
        <div class="cp-cr-bar">
          <h3 class="cp-cr-h" id="cpCreedsH">Creeds, confessions and catechisms</h3>
          <button type="button" class="cp-cr-all" aria-expanded="false" hidden>Show all</button>
        </div>
        <p class="cp-cr-sum cp-sr" aria-live="polite"></p>
        <div class="cp-cr-body"></div>
      </section>`);
    }
    layout.appendChild(pane);
    // the pane needs room: widen the column the reader sits in while it is open (the text keeps its measure)
    for (let a = layout; a && a !== document.body; a = a.parentElement) {
      const mw = parseFloat(getComputedStyle(a).maxWidth);
      if (mw && mw < 1300) { a.dataset.cpMw = a.style.maxWidth || ''; a.style.maxWidth = 'min(1380px, 100%)'; }
    }
    const tabs = document.createElement('div');
    tabs.className = 'cp-tabs'; tabs.setAttribute('role', 'group'); tabs.setAttribute('aria-label', 'Beside the text');
    tabs.innerHTML = SITE.name === 'mo'
      ? '<button type="button" data-tab="c">Commentary</button><button type="button" data-tab="s">Citations</button><button type="button" data-tab="r">Reception</button><button type="button" data-tab="h" hidden>Hymns</button>'
      : '<button type="button" data-tab="c">Commentary</button><button type="button" data-tab="r">Reception</button><button type="button" data-tab="s">Citations</button><button type="button" data-tab="h" hidden>Hymns</button>';
    // The Verse Desk, at the end of the tab row on Mere Orthodoxy's page (Ian, 2026-10-20: a button always there for opening it). The
    // row is sticky, so it stays in reach as the page scrolls; head() points it at the verse the rail is on.
    if (SITE.name === 'mo') tabs.insertAdjacentHTML('beforeend', '<a class="btn cp-desk" href="/the-faith-received/scripture/desk/">Verse Desk</a>');
    pane.prepend(tabs);
    /* THE PHONE'S SHEET (2026-10-23, owner: "This is a mess do a design pass on mobile for this for MereO"). Under 900px the pane is a
     * sheet over the text (commentary-pane.css): a grip at its top raises it to the full screen and lowers it again, by a tap or a drag;
     * the key commentaries are one row that scrolls sideways, its edges fading where it runs on; and a control the site floats at the
     * left edge of the screen (its text-to-speech pill) is kept clear of the sheet's words. The grip is drawn only on a phone. */
    if (SITE.name === 'mo') {
      pane.insertAdjacentHTML('afterbegin', '<button type="button" class="cp-grip" aria-expanded="false" aria-label="Raise the panel to the full screen"><span aria-hidden="true"></span></button>');
      const grip = pane.querySelector('.cp-grip');
      const raise = (up) => {
        pane.classList.toggle('cp-full', up);
        grip.setAttribute('aria-expanded', String(up));
        grip.setAttribute('aria-label', up ? 'Lower the panel' : 'Raise the panel to the full screen');
        setTimeout(clearEdge, 260);
      };
      let y0 = null, dragged = false;
      grip.addEventListener('pointerdown', (e) => { y0 = e.clientY; dragged = false; if (grip.setPointerCapture) grip.setPointerCapture(e.pointerId); });
      grip.addEventListener('pointermove', (e) => { if (y0 != null && Math.abs(e.clientY - y0) > 8) dragged = true; });
      grip.addEventListener('pointerup', (e) => {
        if (y0 == null) return;
        const dy = e.clientY - y0; y0 = null;
        if (dragged && dy < -24) raise(true); else if (dragged && dy > 24) raise(false);
      });
      grip.addEventListener('pointercancel', () => { y0 = null; });
      grip.addEventListener('click', () => { if (dragged) { dragged = false; return; } raise(!pane.classList.contains('cp-full')); });
      const keysEl = pane.querySelector('.cp-keys'), tabsEl = pane.querySelector(':scope > .cp-tabs');
      keysEl.addEventListener('scroll', () => keyEdges(keysEl), { passive: true });
      // the views' row fades at its edges the same way where it runs past the screen
      tabsEl.addEventListener('scroll', () => keyEdges(tabsEl), { passive: true });
      requestAnimationFrame(() => keyEdges(tabsEl));
      addEventListener('resize', () => { keyEdges(keysEl); keyEdges(tabsEl); clearEdge(); }, { passive: true });
      setTimeout(clearEdge, 1500); setTimeout(clearEdge, 5000);
    }
    layout.addEventListener('click', (e) => {
      const b = e.target.closest('.cp-tabs [data-tab]'); if (b) return setTab(b.dataset.tab);
      const vb = e.target.closest('.cp-rec [data-cp-verse]'); if (vb) { e.preventDefault(); return select(+vb.dataset.cpVerse); }
      const ob = e.target.closest('.cp-rec [data-cp-open]'); if (ob) { e.preventDefault(); return openNote(ob.dataset.cpOpen, +ob.dataset.cpP); }
      const more = e.target.closest('.cp-rec .cp-more');
      if (more) { more.parentElement.querySelectorAll('li[hidden]').forEach((li) => { li.hidden = false; }); more.remove(); return; }
      const crMore = e.target.closest('.cp-creeds .cp-more');
      if (crMore) { const ul = crMore.previousElementSibling; if (ul) ul.querySelectorAll('li[hidden]').forEach((li) => { li.hidden = false; }); crMore.remove(); return; }
      if (e.target.closest('.cp-creeds .cp-cr-all')) { CF.open = !CF.open; creeds(); return; }
      if (e.target.closest('.cp-creeds .cp-cr-retry')) { creeds(); return; }
      const ex = e.target.closest('.cp-expand');
      if (ex) { const f = ex.parentElement.querySelector(`.cp-fold[data-cp-fold="${ex.dataset.cpExpand}"]`); if (f) f.hidden = false; ex.remove(); }
    });
    pane.querySelector('.cp-follow input').checked = S.follow;
    pane.querySelector('.cp-follow input').onchange = (e) => { S.follow = e.target.checked; store.set('fr_cp_follow', S.follow ? '1' : '0'); if (S.follow && S.verse) show(S.verse); };
    pane.querySelectorAll('.cp-lang button').forEach((b) => { b.onclick = () => { S.lang = b.dataset.lang; store.set('fr_cp_lang', S.lang); paint(); }; });
    const pick = pane.querySelector('.cp-pick'), list = pane.querySelector('.cp-list');
    // Change opens every commentary on the chapter in place (the directory, scripture-verse-rail.js), drawn as it opens
    pick.onclick = () => setDir(list.hidden);
    const closeList = () => setDir(false);
    // a key chosen from the keyboard keeps the focus on that key (the strip is drawn again for the commentary chosen)
    pane.querySelector('.cp-keys').onclick = (e) => {
      const b = e.target.closest('[data-slug]'); if (!b) return;
      const { slug } = b.dataset, kept = document.activeElement === b;
      closeList(); choose(slug, true);
      const nb = kept && [...pane.querySelectorAll('.cp-key')].find((x) => x.dataset.slug === slug); if (nb) nb.focus();
    };
    // Close (Scripture page only): the same way out as the Citations panel's, which the reader's script carries out
    const closeBtn = pane.querySelector('.cp-close');
    if (closeBtn) closeBtn.onclick = () => window.dispatchEvent(new Event('sd:close-verse'));
    // Escape shuts the open list of commentaries first (after its find box is cleared); the reader's own Escape then closes the verse
    pane.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !list.hidden) { closeList(); pick.focus(); e.stopPropagation(); } });
    pane.querySelectorAll('.cp-pages button').forEach((b) => { b.onclick = () => step(+b.dataset.step); });
    wide.addEventListener('change', () => setTab(S.tab, true));
    setTab(S.tab, true);
    return true;
  }

  // the rail's views; Citations is the site's own verse panel, shown in the rail's place; Hymns (10-22) is drawn where Reception is
  // (.cp-rec), so the pane's styles for that view serve it, and only where the chapter has hymns
  function setTab(t, quiet) {
    if (t === 'h' && !S.hymns.length) t = 'c';
    S.tab = t;
    pane.dataset.tab = t === 'h' ? 'r' : t;
    pane.dataset.view = t;
    // On a wide screen Citations is the page's sidebar, shown in the rail's place. On a phone the sidebar is not in the page: the
    // verse panel opens under the verse in the text, so there the sheet shrinks to its tabs and the panel is brought into view.
    const phone = SITE.name === 'mo' && !wide.matches;
    document.body.classList.toggle('cp-src', t === 's' && !phone);
    document.body.classList.toggle('cp-peek', t === 's' && phone);
    if (t === 's' && phone && !quiet) {
      let panel = document.querySelector('.sd-panel');
      if (!panel) { const b = SITE.pick(S.verse || 1); if (b) b.click(); panel = document.querySelector('.sd-panel'); }
      if (panel) panel.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
    layout.querySelectorAll('.cp-tabs [data-tab]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.tab === t)));
    head();
    if (t === 'r') paintRec();
    if (t === 'h') paintHymns();
    if (t === 's' && SITE.name === 'tfr') {
      const side = layout.querySelector(SITE.side), b = SITE.pick(S.verse || 1);
      if (side && side.hidden && b) b.click();
    }
  }
  // the label and the large heading over each view, as the Citations view sets its own: "COMMENTARY / Genesis 1:1"
  function head() {
    if (!pane) return;
    const w = where(); if (!w) return;
    const name = refName(w);
    pane.querySelector('.cp-eyebrow').textContent = S.tab === 'r' ? 'Reception history' : S.tab === 'h' ? 'Hymns' : (S.verse ? 'Commentary on this verse' : 'Commentary');
    const cb = pane.querySelector('.cp-close'); if (cb) cb.hidden = !w.v;
    pane.querySelector('.cp-ref').textContent = S.verse ? `${name} ${w.ch}:${S.verse}` : `${name} ${w.ch}`;
    desk();
  }
  // every copy of the Verse Desk button (the rail's and the one cloned into the Citations panel) opens the verse the rail is on
  function desk() {
    const w = where(), M = window.MOScriptureDev;
    if (!w || !w.bk || !M || !M.deskHref) return;
    const v = S.verse || w.v || 1, sel = document.querySelector('[data-sd-translation]');
    const t = (sel && sel.value) || new URLSearchParams(location.search).get('t') || '';
    const href = M.deskHref(w.bk, w.ch, v, t), label = `Open the Verse Desk for ${refName(w)} ${w.ch}:${v}`;
    document.querySelectorAll('.cp-tabs .cp-desk').forEach((a) => { a.href = href; a.setAttribute('aria-label', label); });
  }
  // a verse chosen from the rail: as if clicked in the text (the site's panel follows), brought to the reading line
  function select(v) {
    const b = SITE.pick(v), el = SITE.verseEl(v);
    S.pin = true;
    if (el) el.scrollIntoView({ block: SITE.name === 'mo' && !wide.matches ? 'start' : 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    if (b) b.click(); else show(v, true);
  }
  // a commentary's note on the verse, from the Reception view: that commentary, at that note, in the Commentary view
  function openNote(slug, p) {
    let c = S.list.find((x) => x.slug === slug);
    if (!c) {
      const m = S.meta[slug] || {};
      c = { slug, a: m.a || '', t: m.t || slug, notes: {}, rows: {}, open: null }; S.list.push(c);
    }
    if (!(S.verse in c.notes)) c.notes[S.verse] = p;
    S.pin = true;
    setTab('c'); choose(slug);
  }

  /* SERMONS AND HYMNS ON THE PASSAGE (10-22, owner: "make sure we collect everything rank it properly ... and also make sure this is in
   * english"; "have hymns be online in option too"). v1/scripture/preach/<book>.json (The Faith Received's
   * runs/scripture_keys_1019/preach_1022/build_preach.py, from its sermons page's indexes): the sermons, homilies and hymns whose own
   * heading or opening names a passage of the chapter, each at its page, the heading in English with the printed one beside it. A psalm
   * from a Vulgate source is filed under its Hebrew number and never matched to a verse. The sermons join the list (a work of its own,
   * kd "sermons", unless the work is already there); the hymns are a view of their own, offered only where the chapter has any. */
  const preachOf = (book) => json(`${BASE}/v1/scripture/preach/${book}.json`).catch(() => null);
  const preachRow = (r) => ({ slug: r[0], p: r[1], t: r[2], tl: r[3] || '', a: r[4] || '', tr: r[5] || '', year: r[6] || null, v1: r[7] || null,
    v2: r[8] || null, theme: r[9] || '', ref: r[10] || '', first: r[11] || '', vul: r[12] === 'v', fl: r[13] || null });
  // a sermon on the verse: its heading names the verse (never one in the Vulgate's count of a psalm)
  const serOn = (x, v) => !!(v && x.v1 && !x.vul && x.v1 <= v && v <= (x.v2 || x.v1));
  const SER_SHELF = { 'Greek Fathers': 'gf', 'Latin Fathers': 'pl', 'Eastern Fathers': 'po', 'Humanism & Law': 'hl', 'Humanism and Law': 'hl' };
  function addSermons(list, rows, pr) {
    const by = new Map(list.map((c) => [c.slug, c])), works = (pr && pr.works) || {}, of = new Map();
    for (const r of rows) { const x = preachRow(r); if (!of.has(x.slug)) of.set(x.slug, []); of.get(x.slug).push(x); }
    for (const [slug, xs] of of) {
      let c = by.get(slug);
      // a work found citing the chapter whose own heading names it is a sermon on it
      if (c && c.wb === 2) { c.wb = 0; c.kd = 'sermons'; }
      if (!c) {
        const [t, vol] = String(works[slug] || '').split(' · '), m = S.meta[slug] || {};
        if (vol && /^(?:P[LGO]\s*\d+|(?:Vol|Tom|Tomus|Pars|Part)\.?\s+[0-9IVXLC])/i.test(vol)) S.vols.set(slug, vol);
        c = { slug, a: m.a || xs[0].a, t: t || m.t || slug, notes: {}, rows: {}, open: null, sh: X_SHELF[xs[0].tr] || SER_SHELF[xs[0].tr] || famShelf(slug) || 'x',
          wb: 0, score: 0, kd: 'sermons', born: xs[0].fl || xs[0].year || null };
        list.push(c); by.set(slug, c);
      }
      c.ser = xs;
    }
  }
  // the hymns on the chapter, those on the verse first (scripture-verse-rail.js)
  function paintHymns() {
    const box = pane && pane.querySelector('.cp-rec'), w = where(), VR = window.FRVerseRail; if (!box || !w) return;
    if (!VR || !VR.hymns) { box.innerHTML = '<p class="cp-empty">The hymns could not be drawn.</p>'; return; }
    box.innerHTML = VR.hymns(S.hymns, { name: refName(w), ch: w.ch, verse: S.verse || 1, read: SITE.read, pg: pgOf, all: '' });
    box.scrollTop = 0;
  }

  function paintRec() {
    const box = pane && pane.querySelector('.cp-rec'), w = where(); if (!box || !w) return;
    const {rec} = S, n = S.verse || 1, rv = rec && rec.verses && rec.verses[String(n)];
    const name = refName(w);
    const all = Object.entries((rec && rec.verses) || {}).map(([k, x]) => [+k, x.works || 0]);
    const most = all.slice().sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 6);
    const mostHTML = most.length ? `<nav class="cp-rec-most" aria-label="Most cited verses of ${esc(name)} ${esc(w.ch)}"><span>Most cited</span>${most.map(([k, x]) =>
      `<button type="button" data-cp-verse="${k}"${k === n ? ' aria-current="true"' : ''}>${esc(w.ch)}:${k}<small>${fmt(x)}</small></button>`).join('')}</nav>` : '';
    if (!rec) { box.innerHTML = '<p class="cp-empty">The reception history of this chapter is not yet available.</p>'; return; }
    if (!rv) { box.innerHTML = `${mostHTML}<header class="vr-rec-head"><h3>${esc(name)} ${esc(w.ch)}:${n}</h3><p class="vr-count">No page in the library cites this verse yet.</p></header>`; return; }
    /* RECEPTION, ORGANIZED (10-21, scripture-verse-rail.js): one line of counts, the century strip, the commentaries on the verse
     * (each author once, keys first, then by tradition), each period's witnesses by standing with the gist behind the row and the
     * rest of the period one click away in Citations; one methodology line for the view. */
    const VR = window.FRVerseRail, keys = curated(w.book), keySet = new Set(keys.map((c) => c.slug));
    const ns = Object.entries(rv.notes || {}).map(([slug, p]) => {
      const c = S.list.find((x) => x.slug === slug) || S.meta[slug] || {};
      return { slug, p, a: c.a || '', t: c.t || slug, sh: c.sh || '' };
    });
    const cfg = { name, ch: w.ch, v: n, read: SITE.read, rankOf, tradOf, keySet, keyOrder: keys.map((c) => c.slug), era: ERA, show: 6 };
    box.innerHTML = VR.reception.head(rv, ns, cfg) + VR.reception.strip(rv.strip || []) + VR.reception.notes(ns, cfg) + VR.reception.eras(rv.eras || [], cfg)
      + mostHTML + VR.reception.foot('Every page in the library that cites the verse, dated by its author\'s life; the gists are machine-written from the pages.');
    VR.wire(box, { era(id) { setTab('s'); window.dispatchEvent(new CustomEvent('fr-verse-citations', { detail: { era: id, verse: n } })); } });
    box.scrollTop = 0;
  }
  // ── creeds, confessions and catechisms that cite the verse ────────────────────────────────────────────────────────────────
  // Built by scripts/build-confession-proofs.mjs from the documents' own text, one file per chapter (confession-proofs/<book>/<ch>.json).
  // v: the articles that print a verse ({ "1": [[article, words], ...] }), c: the articles that cite the chapter as a whole, a: the
  // article table [document, label, page, title, paragraph], x: the words each stands behind ("clause<TAB>what follows the citation";
  // a leading \u0001 says the words are an opening with its citations taken out, which the reader cannot mark). index.json lists the
  // documents and which chapters have a file, so a chapter with none is never asked for.
  const CF = { dir: '/assets/data/faith-received/confession-proofs/', chapters: new Map(), index: null, token: 0, open: false };
  // the churches in the order the history reads them (the creeds and confessions page sets them the same way)
  const CF_RANK = ['The Whole Church', 'Early church', 'Ecumenical', 'Orthodox', 'Eastern Orthodox', 'Oriental Orthodox', 'Roman Catholic', 'Waldensian',
    'Bohemian Brethren', 'Protestant', 'Lutheran', 'Reformed', 'Continental Reformed', 'Anglican', 'Presbyterian', 'Congregational',
    'Baptist', 'Anabaptist', 'Remonstrant', 'Arminian', 'Methodist'];
  const cfUrl = (f) => {
    const path = `${CF.dir}${f}`;
    return window.moDataUrl ? window.moDataUrl(path) : window.moAssetUrl ? window.moAssetUrl(path) : path;
  };
  // moDataUrl keys a file by the theme version and the HOUR, so a file whose shape changed within the hour (index.json went from
  // {books} to {chapters} between two deploys) is served from the edge in its old shape until the hour turns: every creeds box
  // said "could not be loaded". A file that is not the shape this code reads is asked for once more under a key of its own.
  const cfLoad = (f, shaped) => json(cfUrl(f)).then((d) => (shaped(d) ? d : json(`${CF.dir}${f}?cb=${Date.now()}`)))
    .then((d) => { if (!shaped(d)) throw new Error(`${f}: not the expected shape`); return d; });
  const cfIndex = () => CF.index || (CF.index = cfLoad('index.json', (d) => d && d.chapters && d.docs).catch((e) => { CF.index = null; throw e; }));
  const cfChapter = (book, ch) => {
    const k = `${book}/${ch}`;
    if (!CF.chapters.has(k)) CF.chapters.set(k, cfLoad(`${k}.json`, (d) => d && d.a && (d.v || d.c)).catch((e) => { CF.chapters.delete(k); throw e; }));
    return CF.chapters.get(k);
  };
  const cfRank = (c) => { const i = CF_RANK.indexOf(c); return i < 0 ? CF_RANK.length : i; };
  // the history's order: the church, then the year
  const cfOrder = (docs, d) => (p, q) => { const a = docs[d.a[p[0]][0]], b = docs[d.a[q[0]][0]]; return cfRank(a.c) - cfRank(b.c) || a.y - b.y; };
  // the words a link asks the reader to mark: the clause itself (the reader marks a whole phrase of 24 characters or more)
  const cfPhrase = (x) => {
    if (String(x).startsWith('\u0001')) return '';
    const t = String(x).split('\t')[0].replace(/^…\s*/, '').trim();
    return t.length >= 24 ? t.slice(0, 110).replace(/\s+\S*$/, '') : '';
  };
  // the reader numbers a page's paragraphs b<page>-<n>: the link goes to the paragraph that cites the verse
  const cfHref = (slug, r, x) => {
    const base = SITE.read(slug, r[2]), hl = cfPhrase(x), i = base.indexOf('#');
    return `${base.slice(0, i < 0 ? base.length : i)}${hl ? `&hl=${encodeURIComponent(hl)}` : ''}#b${encodeURIComponent(r[2])}-${r[4] || 0}`;
  };
  const cfWords = (x) => {
    const raw = String(x), [clause, tail] = (raw.startsWith('\u0001') ? raw.slice(1) : raw).split('\t');
    return clause ? `${/^[a-z]/.test(clause) ? '… ' : ''}${clause}${tail ? ` ${tail}` : ''}` : '';
  };
  function cfRow(d, docs, r, x, hid) {
    const doc = docs[r[0]], t = r[3] && r[3] !== doc.t ? r[3] : '', words = cfWords(d.x[x]);
    const meta = [doc.c, doc.y ? String(doc.y) : '', doc.u, t].filter(Boolean).map(esc).join(dot);
    return `<li class="cp-row-li cp-wit"${hid ? ' hidden' : ''}><a class="cp-row-t" href="${esc(cfHref(doc.s, r, d.x[x]))}">${esc(doc.t)} <span class="cp-cr-at">${esc(r[1])}</span></a>`
      + `<span class="cp-row-m">${meta}</span>${words ? `<span class="cp-w-g cp-cr-q">“${esc(words)}”</span>` : ''}</li>`;
  }
  // a list of rows, the first `show` open and the rest behind their own button (it opens only the list it follows)
  function cfList(d, docs, rows, show) {
    const li = rows.map(([a, x], i) => cfRow(d, docs, d.a[a], x, i >= show)).join('');
    return `<ul class="cp-rows">${li}</ul>${rows.length > show ? `<button type="button" class="cp-more">Show ${fmt(rows.length - show)} more</button>` : ''}`;
  }
  const cfGroup = (title, n, html, cls) => `<section class="cp-era ${cls || ''}"><h4 class="cp-era-h">${title} <small>${fmt(n)} ${n === 1 ? 'article' : 'articles'}</small></h4>${html}</section>`;
  async function creeds() {
    const box = pane && pane.querySelector('.cp-creeds'), w = where(); if (!box || !w) return;
    const tok = ++CF.token, v = S.verse || 1;
    // the last verse's list is not left in view while this one loads
    box.hidden = true;
    let docsIdx, d = null, failed = false;
    try {
      docsIdx = await cfIndex();
      if ((docsIdx.chapters[w.book] || []).includes(Number(w.ch))) d = await cfChapter(w.book, w.ch);
    } catch (err) { failed = true; console.error('Scripture pane: the creeds and confessions did not load', err); }
    if (tok !== CF.token) return;
    const body = box.querySelector('.cp-cr-body'), bar = box.querySelector('.cp-cr-bar');
    if (failed) {
      box.hidden = false; box.classList.remove('is-open');
      bar.hidden = true;
      body.innerHTML = '<p class="cp-cr-note">The creeds and confessions that cite this verse could not be loaded. <button type="button" class="cp-cr-retry">Try again</button></p>';
      return;
    }
    bar.hidden = false;
    const rows = d && d.v ? (d.v[String(v)] || []).slice().sort(cfOrder(docsIdx.docs, d)) : [];
    const have = new Set(rows.map((r) => `${d.a[r[0]][0]}|${d.a[r[0]][1]}|${d.a[r[0]][2]}`));
    const whole = d && d.c ? d.c.filter((r) => !have.has(`${d.a[r[0]][0]}|${d.a[r[0]][1]}|${d.a[r[0]][2]}`)).sort(cfOrder(docsIdx.docs, d)) : [];
    if (!rows.length && !whole.length) { box.hidden = true; return; }
    const {docs} = docsIdx, name = refName(w);
    const main = rows.filter((r) => !docs[d.a[r[0]][0]].p), papal = rows.filter((r) => docs[d.a[r[0]][0]].p);
    const n = rows.length;
    box.hidden = false;
    box.querySelector('.cp-cr-h').textContent = `Creeds, confessions and catechisms (${fmt(n)})`;
    const open = CF.open && (n > 3 || whole.length || papal.length);
    box.classList.toggle('is-open', !!open);
    box.classList.toggle('is-empty', !n && !open);
    const btn = box.querySelector('.cp-cr-all');
    btn.hidden = !(n > 3 || whole.length);
    btn.textContent = open ? 'Show fewer' : n > 3 ? `Show all ${fmt(n)}` : n ? 'Show more' : `Show ${fmt(whole.length)} citing the chapter`;
    btn.setAttribute('aria-expanded', String(!!open));
    box.querySelector('.cp-cr-sum').textContent = n
      ? `${fmt(n)} ${n === 1 ? 'article cites' : 'articles cite'} ${name} ${w.ch}:${v}.`
      : `None names ${name} ${w.ch}:${v}.`;
    let html = '';
    if (!open) {
      // closed: the first three entries; on the phone's sheet two, so the commentary's note is still in the first screen
      const peek = wide.matches ? 3 : 2;
      html = main.length ? cfList(d, docs, main.slice(0, peek), peek).replace(/<button[\s\S]*$/, '') : '';
      if (!main.length && papal.length) html = cfList(d, docs, papal.slice(0, peek), peek).replace(/<button[\s\S]*$/, '');
      if (!n) html = `<p class="cp-cr-note">None names ${esc(name)} ${esc(w.ch)}:${esc(v)}.</p>`;
    } else {
      if (main.length > 6) {
        const groups = new Map();
        for (const r of main) { const c = docs[d.a[r[0]][0]].c || 'Other'; if (!groups.has(c)) groups.set(c, []); groups.get(c).push(r); }
        html = [...groups].sort((a, b) => cfRank(a[0]) - cfRank(b[0]) || a[0].localeCompare(b[0]))
          .map(([c, rs]) => cfGroup(esc(c), rs.length, cfList(d, docs, rs, 3))).join('');
      } else if (main.length) {
        html = cfList(d, docs, main, 6);
      }
      if (whole.length) {
        html += cfGroup(`Citing ${esc(name)} ${esc(w.ch)} as a whole`, whole.length,
          `<p class="cp-era-more">They print the chapter reference without naming a verse.</p>${cfList(d, docs, whole, 3)}`, 'cp-cr-whole');
      }
      if (papal.length) html += cfGroup('Papal and other teaching documents', papal.length, cfList(d, docs, papal, 0), 'cp-cr-papal');
      if (!n) html = `<p class="cp-cr-note">None names ${esc(name)} ${esc(w.ch)}:${esc(v)}.</p>${html}`;
    }
    body.innerHTML = html;
  }

  // each verse number carries how much reception it has (a quiet mark in the text: four steps of the chapter's own range)
  function heat() {
    const vs = (S.rec && S.rec.verses) || {}, max = Math.max(1, ...Object.values(vs).map((x) => x.works || 0));
    for (const [k, x] of Object.entries(vs)) {
      const el = SITE.heatEl(+k); if (!el) continue;
      const r = Math.sqrt((x.works || 0) / max);
      el.dataset.cpHeat = r > 0.75 ? '4' : r > 0.5 ? '3' : r > 0.28 ? '2' : x.works ? '1' : '0';
    }
  }

  // "Weimar Edition: Writings, Volume 40.2" → "WA 40.2" beside the piece's name; a volume title with no number ("Works") says nothing
  const volShort = (t) => (/\d/.test(t || '') ? String(t).replace(/^Weimar Edition: Writings, Volume\s*/i, 'WA ').replace(/^Weimar Edition: (.+?), Volume\s*/i, 'WA $1 ') : '');
  /* THE KEY COMMENTARIES ON THE BOOK, CURATED (owner 10-19: "musculus' psalm commentary should show up when i go through a psalm these
   * are things that are important"). rank.json `books` lists them for the books readers open most, most needed first, each author with
   * his works in the order to open them and his year; on the chapter, each author's first work that has the chapter's page (Luther on
   * Psalm 51: his lectures of 1532, not the Summaries). Other books: the tier rule in fillList. */
  function curated(book) {
    const out = [];
    for (const [, slugs, born] of (RANK.books[book] || [])) {
      const have = slugs.map((s) => S.list.find((c) => c.slug === s)).filter(Boolean);
      const c = have.find((x) => x.open != null) || have.find((x) => Object.keys(x.notes).length) || have[0];
      // (10-25, owner: "change if there's no commentator, like Augustine on Romans") a key stands on the chapter only when it has a
      // note in it, or touches a good part of it (a verse in four, three at least), or the map gives the chapter room in the work:
      // a page per twelve verses or more (Calov's one page on Psalm 13 stays; Augustine's Exposition of Propositions, under a column
      // for Romans 3's thirty-one verses, does not). A chapter with no page after it (the book's last, a sermon on the pericope) is
      // taken at the map's word.
      const span = c && c.open != null && c.close != null && Number(c.close) >= Number(c.open) ? (Number(c.close) - Number(c.open) + 1) / Math.max(1, S.nv || 1) : null;
      const says = c && (Object.keys(c.notes).length || c.collected || (c.touch || 0) >= Math.max(3, Math.ceil((S.nv || 0) / 4)) || (c.open != null && (span == null || span >= 0.08)));
      if (c && says) { c.born = born; out.push(c); }
    }
    return out;
  }
  const cenOf = (c) => (RANK.works[c.slug] || [])[2] || 99;
  // the traditions in the order the list gives them (owner 10-20: "organize by tradition"; Musculus under Reformed (continental)); the
  // shelf is the Patrologia's (Peter Lombard and Haymo on the Latin Fathers' shelf): a Latin writer from the 8th century on is listed
  // with the Medieval, a Greek from the 9th with the Byzantine
  const TRADS = [['gf', 'Greek Fathers'], ['pl', 'Latin Fathers'], ['po', 'Eastern Fathers'], ['by', 'Byzantine'], ['md', 'Medieval'],
    ['lu', 'Lutheran'], ['rf', 'Continental Reformed'], ['rc', 'Roman Catholic'], ['ed', 'English writers'], ['hl', 'Humanism and Law']];
  // The shelves also hold later editors and scholars (Daniel Heinsius on the Greek shelf, the Bollandists on the Latin), who are neither
  // Byzantine nor Medieval: Byzantine and Medieval end with the 15th century and a later writer is under "Other" ('x'). The century is
  // the list's own (S.cen), else the rank map's. In step with tradOf in scripture-dev-core.js.
  // a Father in Migne or the Patrologia Orientalis is on the shelf of his Patrologia, where the map leaves him unshelved ("x"):
  // Chrysostom, Cyril, Origen and Athanasius were filed under Other (10-21)
  const famShelf = (slug) => { const m = /^(pld|pg|po)-/.exec(slug || ''); return m ? { pld: 'pl', pg: 'gf', po: 'po' }[m[1]] : ''; };
  const tradOf = (c) => {
    let sh = c.sh || '';
    if (!sh || sh === 'x') sh = famShelf(c.slug) || sh;
    const cen = S.cen[c.slug] || (RANK.works[c.slug] || [])[2] || 0;
    if (sh === 'pl') return cen >= 16 ? 'x' : cen >= 8 ? 'md' : sh;
    if (sh === 'gf') return cen >= 16 ? 'x' : cen >= 9 ? 'by' : sh;
    return sh;
  };
  // A work whose title names one book belongs to that book's list, not the whole Bible's (Baxter's and Hammond's Psalms). In step with
  // titleBook in scripture-dev-core.js.
  const BOOK_RX = /\b(Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|Samuel|Kings|Chronicles|Ezra|Nehemiah|Esther|Job|Psalms?|Proverbs|Ecclesiastes|Canticles?|Song of (?:Songs|Solomon)|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|Corinthians|Galatians|Ephesians|Philippians|Colossians|Thessalonians|Timothy|Titus|Philemon|Hebrews|James|Peter|Jude|Revelation|Apocalypse)\b/gi;
  const WHOLE_WORDS = /\b(?:all|whole|entire|every)\b|\bBible\b|\bTestaments?\b|\bGospels\b|\bScriptures?\b|\bPentateuch\b|\bEpistles\b|\bbooks\b/i;
  const namesOneBook = (t) => {
    const found = new Set();
    String(t || '').replace(BOOK_RX, (m) => { found.add(m.toLowerCase().replace(/^psalm$/, 'psalms').replace(/^(?:canticle|song).*$/, 'song')); return m; });
    return found.size === 1 && !WHOLE_WORDS.test(t || '');
  };
  // "Uncertain author (Bede?)" is a guess: filed under Other works. "Uncertain author" is anonymous, and not one author.
  const guessed = (c) => /^Uncertain author\s*\(/i.test(c.a || '');
  const anonymous = (c) => /^Uncertain author/i.test(c.a || '');
  const authorName = (c) => (anonymous(c) ? 'Uncertain author' : (c.a || ''));
  /* CITED IN COMMENTARIES ON OTHER BOOKS (owner 10-20: "where we have the commentary make a reference to a different text show up as a
   * hit"). v1/scripture/hits/<book>/<c>.json: the commentaries filed under other books (and the whole-Bible sets) that cite this
   * chapter, each at the page where it cites it most. */
  const hitsOf = (book, ch) => json(`${BASE}/v1/scripture/hits/${book}/${ch}.json`).then((d) => (d && d.hits) || []).catch(() => []);
  /* THE YEAR OF A NAME (10-22): v1/enrich/author_dates.json {authors: {name: {y, born, died, circa, fl, dates, basis, aliases}}}, 2,799
   * names as the surfaces spell them (y: the birth year, else the first attested, else the death). Read once, the first time a name has
   * no year of its own (the curated key's, the reception history's), and the lists drawn again when it comes; until then, and if it never
   * comes, the century stands. */
  let DATES = null, datesAsked = false;
  function dateYear(a) {
    if (!a) return 0;
    if (DATES) { const x = DATES.get(a); return x && Number(x.y) > 0 ? Number(x.y) : 0; }
    if (!datesAsked) {
      datesAsked = true;
      json(`${BASE}/v1/enrich/author_dates.json`).then((d) => {
        const m = new Map();
        for (const [n, x] of Object.entries((d && d.authors) || {})) { m.set(n, x); for (const al of x.aliases || []) if (!m.has(al)) m.set(al, x); }
        DATES = m;
        if (pane && S.list.length) fillList();
      }).catch(() => { DATES = new Map(); });
    }
    return 0;
  }
  // in the order their authors came: the curated key's year (Luther 1483, Bucer 1491, Musculus 1497, Calvin 1509), else his year in the
  // dates of names (10-22), else the century
  const when = (c) => c.born || dateYear(c.a) || cenOf(c) * 100 - 50;
  const aKey = (a) => { const VR = window.FRVerseRail; return VR && VR.authorKey ? VR.authorKey(a) : String(a || '').toLowerCase(); };
  // in the order their authors came, for the directory: the curated key's year, else the year the reception history gives the author
  // (his floruit), else his year in the dates of names (10-22), else the century
  const whenDir = (c) => { const cen = S.cen[c.slug] || cenOf(c); return c.born || S.years.get(aKey(c.a)) || dateYear(c.a) || (cen < 99 ? cen * 100 - 50 : 9999); };
  function readYears(rec) {
    S.years = new Map();
    for (const x of Object.values((rec && rec.verses) || {})) for (const e of x.eras || []) for (const r of e.top || []) {
      const k = aKey(r.a); if (k && r.y && !S.years.has(k)) S.years.set(k, +r.y);
    }
  }
  // the verse the directory speaks of: the one in view when it was drawn, so a row's "Note on 1:2" and its Preview agree while the
  // reading line moves on beneath the list
  const listOpen = () => !!(pane && !pane.querySelector('.cp-list').hidden);
  const dirVerse = () => (listOpen() && S.dirVerse) || S.verse || 0;
  // a row's page is where its Read opens, as near as the library's index tells it before the pages are read (placeNow)
  // (10-22) keyOrder: the book's curated keys (rank.json `books`), every volume of each, in their order: the directory's first group;
  // volOf: a sermon volume's Patrologia number ("PL 131"), from the sermons index
  const dirCfg = (w) => ({ cur: S.cur && S.cur.slug, verse: dirVerse(), ch: w.ch, bookName: refName(w), tradOf, when: whenDir, rankOf, volShort,
    read: SITE.read, pg: pgOf, open: S.dirOpen, place: placeNow, volOf: (slug) => S.vols.get(slug) || '',
    keyOrder: (RANK.books[w.book] || []).flatMap(([, slugs]) => slugs || []) });
  // a key button is pressed while its work is read, in whichever of its volumes
  const isCur = (c) => !!(S.cur && (S.cur.slug === c.slug || setOf(S.cur) === setOf(c) || (setIdOf(c.slug) && setIdOf(S.cur.slug) === setIdOf(c.slug))));
  function markKeys() {
    pane.querySelectorAll('.cp-key').forEach((b) => { const c = S.list.find((x) => x.slug === b.dataset.slug); b.setAttribute('aria-pressed', String(!!c && isCur(c))); });
    keyInView();
  }
  // the registry's sets with a volume in the chapter's list: { s, c } a set, c its volume for the verse (sermons are never a set's key)
  function setsOn(list, v) {
    const by = new Map();
    // a volume that only cites the chapter in its commentary on another book (wb 2) is not the set's commentary on it
    for (const c of list) { const id = setIdOf(c.slug); if (!id || c.kd === 'sermons' || c.wb === 2) continue; if (!by.has(id)) by.set(id, []); by.get(id).push(c); }
    const pick = (cs) => cs.find((c) => c.notes && c.notes[v] != null) || cs.find((c) => c.open != null) || cs.find((c) => Object.keys(c.notes || {}).length) || cs.find((c) => c.bookAt != null) || cs[0];
    const order = new Map(SETS.trads.map(([k], i) => [k, i]));
    return SETS.list.filter((s) => by.has(s.id)).map((s) => ({ s, c: pick(by.get(s.id)) }))
      .sort((x, y) => (order.get(x.s.trad) ?? 99) - (order.get(y.s.trad) ?? 99) || x.s.year - y.s.year);
  }
  function fillList() {
    const w = where() || {};
    const keys = curated(w.book);
    // a commentary's note on the verse known to the reception history (its exegesis rows) counts as a note here too
    const rn = ((S.rec && S.rec.verses && S.rec.verses[String(S.verse || 0)]) || {}).notes || {};
    for (const c of S.list) if (rn[c.slug] != null && S.verse && !(S.verse in c.notes)) c.notes[S.verse] = rn[c.slug];
    // the strip is for commentaries: a volume of sermons is never a key button
    const onBook = S.list.filter((c) => c.wb === 0 && c.kd !== 'sermons'), whole = S.list.filter((c) => c.wb === 1 && c.kd !== 'sermons');
    const firstsOf = (xs) => { const seen = new Set(), out = []; for (const c of xs.slice().sort((x, y) => y.score - x.score)) { const k = aKey(c.a) || c.slug; if (!seen.has(k)) { seen.add(k); out.push(c); } } return out; };
    // the key works, one click away: the book's curated keys (at most eight, the most needed), in the order they wrote; else the
    // curated key commentators (tier 1, then 2), at most five; a rule; the first two sets on the whole Bible. A chapter with neither
    // shows its first four. One button an author and one name once (10-21): the Glossa's two volumes were "Glossa, Glossa".
    const tierOf = (c) => (RANK.works[c.slug] || [])[4] || 0;
    const firsts = firstsOf(onBook);
    // (10-25, owner: "have the featured commentaries list more") sixteen, not ten: every curated key that speaks on the chapter,
    // then the chapter's other commentaries with notes on it by their standing, all in the order their authors came
    const CAP = 16;
    const book = (keys.length ? keys.slice(0, CAP) : firsts.filter((c) => tierOf(c)).sort((x, y) => tierOf(x) - tierOf(y) || y.score - x.score).slice(0, 5))
      .sort((x, y) => when(x) - when(y) || y.score - x.score);
    const seenA = new Set(), seenL = new Set();
    const keep = (c) => { const k = aKey(c.a) || c.slug, l = short(c.a); if (seenA.has(k) || seenL.has(l)) return false; seenA.add(k); seenL.add(l); return true; };
    const head = (book.length ? book : firsts.slice(0, 4)).filter(keep), tail = SETS.list.length ? [] : firstsOf(whole).filter(keep).slice(0, 6);
    for (const c of firsts) { if (head.length >= CAP) break; if (c.kd === 'sermons' || !Object.keys(c.notes).length) continue; if (keep(c)) head.push(c); }
    head.sort((x, y) => when(x) - when(y) || y.score - x.score);
    // THE WHOLE-BIBLE SETS ON THIS CHAPTER (10-23): every set the registry knows that has a volume here, one button a set (its volumes
    // folded: the one that holds the chapter, else the one with notes on it, else where the book begins), by tradition in their order,
    // each in its author's order; a book's key commentator may stand in both rows (owner: "its ok to have things appear twice")
    const sets = setsOn(S.list, S.verse || 1);
    // (10-22, owner: "quickly go to landmark whole bible and book commentaries organized on the bar") two rows, each named once:
    // the landmark commentaries on this book, then the landmark sets on the whole Bible in their curated order
    const btn = (c) => `<button type="button" class="cp-key" data-slug="${esc(c.slug)}" aria-pressed="${isCur(c)}" title="${esc(`${c.t}${volShort(c.vol) ? ` (${volShort(c.vol)})` : ''}, ${c.a}`)}">${esc(short(c.a))}</button>`;
    const row = (label, xs) => xs.length ? `<div class="cp-keys-row" role="group" aria-label="${esc(label)}"><span class="cp-keys-lab" aria-hidden="true">${esc(label)}</span>${xs.map(btn).join('')}</div>` : '';
    const setBtn = ({ s, c }) => `<button type="button" class="cp-key" data-slug="${esc(c.slug)}" data-set="${esc(s.id)}" aria-pressed="${isCur(c)}" title="${esc(`${s.title}, ${s.author}${volShort(c.vol) ? ` (${volShort(c.vol)})` : ''}`)}">${esc(s.label)}</button>`;
    const tradRow = ([k, name]) => { const xs = sets.filter((x) => x.s.trad === k); return xs.length ? `<div class="cp-keys-row cp-keys-trad" role="group" aria-label="${esc(name)}"><span class="cp-keys-sub">${esc(name)}</span><span class="cp-keys-chips">${xs.map(setBtn).join('')}</span></div>` : ''; };
    // on a phone the sets fold behind one line (10-25: five scrolling strips left the commentary no room); on a wide screen they
    // stand open as before
    const narrow = matchMedia('(max-width: 640px)').matches;
    const wholeRows = sets.length ? `<details class="cp-keys-whole"${narrow ? '' : ' open'} role="group" aria-label="Whole-Bible commentaries, by tradition"><summary class="cp-keys-lab cp-keys-wl">Whole Bible<small class="cp-keys-n">${sets.length} ${sets.length === 1 ? 'set' : 'sets'}</small></summary>${SETS.trads.map(tradRow).join('')}</details>` : '';
    pane.querySelector('.cp-keys').innerHTML = head.length + tail.length + sets.length < 2 ? '' : row(`On ${refName(w) === 'Psalm' ? 'the Psalms' : refName(w)}`, head) + row('Whole Bible', tail) + wholeRows;
    keyInView();
    if (listOpen()) renderDir();
  }
  /* THE DIRECTORY (10-21, owner: "need to be able to click into all chapter and whole bible commentaries seamlessly, and every should
   * be collapsed by tradition author expandable and previewable"; scripture-verse-rail.js): every commentary on the chapter and every
   * whole-Bible set, by tradition, then author, then work, each group shut with its count; a work reads beside the text from its row,
   * opens in the reader from its page, and previews in place. Which groups are open is kept for the chapter. */
  function renderDir() {
    const list = pane.querySelector('.cp-list'), VR = window.FRVerseRail, w = where() || {};
    if (!VR || !VR.directory) { list.innerHTML = '<p class="cp-empty">The list could not be drawn.</p>'; return; }
    S.dirVerse = S.verse || 1;
    list.innerHTML = VR.directory(S.list, dirCfg(w));
    VR.wireDirectory(list, {
      fold(id, open) { if (open) S.dirOpen.add(id); else S.dirOpen.delete(id); },
      preview,
      read(slug) { setDir(false); choose(slug, true); },
    });
  }
  function setDir(open) {
    if (!pane) return;
    const list = pane.querySelector('.cp-list'), pick = pane.querySelector('.cp-pick');
    list.hidden = !open;
    pick.setAttribute('aria-expanded', String(!!open)); pick.textContent = open ? 'Hide list' : 'Change';
    if (open) renderDir();
  }

  function nameCur() {
    pane.querySelector('.cp-who').textContent = S.cur ? [authorName(S.cur), centuryOf(S.cur.slug)].filter(Boolean).join(dot) || 'Commentary' : 'No commentary';
    pane.querySelector('.cp-what').textContent = S.cur ? `${S.cur.t}${volShort(S.cur.vol) ? ` (${volShort(S.cur.vol)})` : ''}` : '';
    pane.querySelector('.cp-what').title = S.cur && S.cur.tl ? `As printed: ${S.cur.tl}` : '';
  }
  // Only the reader's own choice is remembered (fr_cp_pick): the old key held whatever opened first, Lapide for nearly everyone.
  function choose(slug, mine) {
    S.cur = S.list.find((c) => c.slug === slug) || S.list[0] || null;
    if (S.cur && mine) store.set('fr_cp_pick', S.cur.a);
    nameCur();
    fillList();
    S.shown = null;
    if (!S.cur) { paint(); return; }
    show(S.verse || 1, true);
  }

  // ── where a commentary opens on a verse ───────────────────────────────────────────────────────────────────────────────────
  // In this order, and each says in the status line which it is:
  //   note     the library indexed the commentary's own note on the verse (or a collection holds it), or its page text carries one
  //            (a "Vers. 12." paragraph, never the run of numbered lines that reprints the chapter);
  //   page     the library files a page as discussing the verse, between the notes on the verses on either side, but the heading
  //            was not found: that page, said to be a page;
  //   later    the commentary's next note after the verse (within four verses);
  //   nearest  its closest note before (within twelve);   later again, within twelve;
  //   chapter  where the commentary opens the chapter, said to be only that.
  // Lapide on Genesis 1:1 used to open at vol. 1 p. 75, "the chapter's opening" by the devotion map: the first page of an essay on
  // the days of creation printed in his volume, which begins with the text of verses 24 to 28, with "no verse notes found".
  const paraKey = (slug, n) => `para:${slug}:${n}`;
  // a page's paragraphs in both lanes: the English if it has one, and the Latin
  function parasOf(slug, n) {
    const k = paraKey(slug, n);
    if (!cache.has(k)) {
      // a page that is not there is remembered as empty; a page that failed to load is not (it is asked for again)
      cache.set(k, page(slug, n).then((g) => (g && g.p ? [paragraphs(g.p.en), paragraphs(g.p.la)] : [[], []])).catch((err) => { console.error('Scripture pane: a page could not be read', err); cache.delete(k); return [[], []]; }));
    }
    return cache.get(k);
  }
  const resolver = A ? A.createResolver(parasOf, { verseText(v) { const el = SITE.verseEl(v); return el ? el.textContent : ''; } }) : null;
  // the work's own first (collected) or indexed target, with no page to read
  const quickTarget = (v) => quickTargetOf(S.cur, v);
  // the place of a set whose map knows only where the book begins (10-22): the chapter's heading where it has been found, else the
  // book's first page
  const bookPlace = (c) => { const w = where() || {}, h = S.heads.get(`${c.slug}|${w.book}|${w.ch}`); return h ? { p: h, how: 'head' } : { p: c.bookAt, how: 'book' }; };
  /* A SERMON ON THE PASSAGE (10-22): the work's sermon whose heading names the verse (the narrowest); for a work filed with the sermons,
   * else its sermon nearest before the verse, else its first on the chapter, said to be that. A commentary keeps its own note on the
   * verse first (Chrysostom's homilies on Matthew open at his note, not at the homily's first column). Never read for verse heads. */
  function sermonAt(c, v) {
    const xs = c.ser || []; if (!xs.length) return null;
    if (c.kd !== 'sermons' && (c.notes[v] != null || (c.recNotes && c.recNotes[v] != null) || (c.collected && c.collected[v]))) return null;
    const span = (x) => (x.v2 || x.v1) - x.v1;
    const on = xs.filter((x) => serOn(x, v)).sort((a, b) => span(a) - span(b) || a.p - b.p)[0];
    if (on) return { p: on.p, how: 'sermon', v, x: on };
    if (c.kd !== 'sermons' || c.notes[v] != null) return null;
    const before = xs.filter((x) => x.v1 && !x.vul && x.v1 < v).sort((a, b) => b.v1 - a.v1 || a.p - b.p)[0];
    const x = before || xs.slice().sort((a, b) => (a.v1 || 0) - (b.v1 || 0) || a.p - b.p)[0];
    return { p: x.p, how: 'sermon-ch', x };
  }
  // the sermon's heading on its page: its first words as printed or in English, else its division word, in either language, with its
  // number ("HOMILIA I.", "Homily I.", "SERMO CXI")
  const foldHead = (s) => String(s || '').replace(/^#{1,6}\s+/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const DIV = 'sermo|sermon|homilia|homily|homilie|tractatus|tractate|concio|contio|oratio|oration|discourse|lectio|lecture|predigt|ode|hymnus|hymn';
  function headingAt(all, x) {
    const keys = [x && x.tl, x && x.t].map((s) => foldHead(s).slice(0, 16)).filter((k) => k.length >= 6);
    const i = keys.length ? all.findIndex((s) => { const f = foldHead(s); return keys.some((k) => f.startsWith(k)); }) : -1;
    if (i >= 0) return i;
    const m = new RegExp(`^\\W*(?:${DIV})\\.?\\s+([IVXLCDM]+|\\d+)\\b`, 'i').exec(String((x && (x.tl || x.t)) || ''));
    if (!m) return -1;
    const rx = new RegExp(`^(?:#{1,6}\\s+)?\\W*(?:${DIV})\\.?\\s+${m[1]}\\b`, 'i');
    return all.findIndex((s) => rx.test(s));
  }
  const clip = (s, n) => { const t = String(s || '').replace(/[.\s]+$/, ''); return t.length > n ? `${t.slice(0, n).replace(/[\s,;:]+\S*$/, '')}…` : t; };
  const sermonSay = (t, v, ch, name) => (t.how === 'sermon' ? clip(t.x.t, 120)
    : `${clip(t.x.t, 110)}, on ${t.x.vul ? `${t.x.ref}, the Vulgate's count` : t.x.ref || `${name} ${ch}`} (no sermon on ${ch}:${v} recorded)`);
  function quickTargetOf(c, v) {
    if (!c) return null;
    const sp = sermonAt(c, v); if (sp) return sp;
    if (c.collected) {
      if (c.collected[v]) return { p: c.collected[v][0][1], how: 'collected', v, items: c.collected[v] };
      const next = Object.keys(c.collected).map(Number).filter((x) => x > v).sort((a, b) => a - b)[0];
      const prev = Object.keys(c.collected).map(Number).filter((x) => x < v).sort((a, b) => b - a)[0];
      const x = next != null ? next : prev;
      if (x != null) return { p: c.collected[x][0][1], how: 'collected', v: x, items: c.collected[x], nearest: true };
    }
    // (10-22) a work on another book that cites the chapter: its note on the verse where the library indexes one, else the page where
    // it cites the chapter, said to be that. Never read for verse heads: the resolver read that other book's pages from there and
    // took its "Vers. 1." for a note on this chapter's verse.
    if (c.wb === 2) return c.notes[v] != null ? { p: c.notes[v], how: 'note', v, indexed: true } : c.open != null ? { p: c.open, how: 'cites' } : null;
    // (10-22) a work on this book with no page for the chapter, at the page that treats it: its note on the verse where the library
    // indexes one, else that page, said to be that (never the resolver: the page is not where the chapter begins)
    if (c.treats) return c.notes[v] != null ? { p: c.notes[v], how: 'note', v, indexed: true } : c.open != null ? { p: c.open, how: 'treats' } : null;
    // a set whose map knows only where the book begins, with no note in the chapter: never the resolver either (it would read the
    // book's first chapters for this one's verse heads)
    if (c.open == null && c.bookAt != null && !Object.keys(c.notes).length) return bookPlace(c);
    // without the resolver, the library's index
    if (!resolver && c.notes[v] != null) return { p: c.notes[v], how: 'note', v, indexed: true };
    return null;
  }
  async function resolve(c, v, w) {
    let t = resolver ? await resolver.resolve(c, v, { name: w.name, ch: w.ch }) : (c.open != null ? { p: c.open, how: 'chapter' } : null);
    // the reception history's own note on this verse, where the resolver found no note of its own (10-22)
    if ((!t || t.how !== 'note') && c.recNotes && c.recNotes[v] != null) t = { p: Number(c.recNotes[v]), how: 'note', v, indexed: true };
    if (t || c.bookAt == null) return t;
    await headPage(c, w.book, w.ch);
    return bookPlace(c);
  }
  /* THE VOLUME THAT HOLDS THE VERSE (10-22, owner: "make sure the pane pinpoints the right place, whole bible and book commentaries"). A
   * commentary in several volumes is one work in the list (its volumes folded under one entry), but the pane kept to the volume first
   * chosen for every verse: Calvin's Harmony of the Law, chosen at vol. 3, opened Exodus 20:1 at that volume's first page while vol. 1
   * holds his note on the verse. For each verse the pane takes the volume with its note on the verse, else the one whose last note
   * before it is nearest; where no volume has either, the reader's own choice stands. */
  function holds(c, v) {
    if ((c.collected && c.collected[v]) || c.notes[v] != null || (c.recNotes && c.recNotes[v] != null) || (c.ser || []).some((x) => serOn(x, v))) return [2, 0];
    const before = Object.keys(c.notes).map(Number).filter((x) => x < v);
    return before.length ? [1, v - Math.max(...before)] : [0, 0];
  }
  function volumeFor(c, v) {
    if (!c || c.wb === 2 || !v) return c;
    const k = setOf(c);
    let best = c, [bt, bd] = holds(c, v);
    for (const x of S.list) {
      if (x === best || x.wb === 2 || setOf(x) !== k) continue;
      const [t, d] = holds(x, v);
      if (t > bt || (t === 1 && bt === 1 && d < bd)) { best = x; bt = t; bd = d; }
    }
    return best;
  }
  // the page a directory row links to, from the library's index in the resolver's order (its note on the verse, its next within four
  // verses, its closest earlier within twelve, the chapter's page); the pane, reading the pages, may refine it
  function placeNow(c, v) {
    const q = quickTargetOf(c, v); if (q) return q;
    if (c.notes[v] != null) return { p: c.notes[v], how: 'note', v };
    const ks = Object.keys(c.notes).map(Number).filter((x) => x > 0);
    const next = ks.filter((x) => x > v && x - v <= 4).sort((a, b) => a - b)[0], prev = ks.filter((x) => x < v && v - x <= 12).sort((a, b) => b - a)[0];
    if (next != null) return { p: c.notes[next], how: 'later', v: next };
    if (prev != null) return { p: c.notes[prev], how: 'nearest', v: prev };
    return c.open != null ? { p: c.open, how: 'chapter' } : c.bookAt != null ? bookPlace(c) : null;
  }
  /* THE CHAPTER'S OWN HEADING (10-22): "PSAL. LI.", "CHAP. XI.", "CAPUT V.", "Psalm 51", a line to itself, as the old printers set them
   * (IIII for four). It finds where a chapter begins in a set whose map knows only the book (the Westminster Annotations: Psalm 51 under
   * "PSAL. LI." at p. 212), read on from the book's first page; it stops where a new book begins (the chapter numbers start again) and
   * after 400 pages. On that page the verse's own note is then looked for, under the heading, by its heading word ("Vers. 1."). */
  const romans = (n) => { const r = ROMAN(n), old = r.replace(/IV/g, 'IIII').replace(/IX/g, 'VIIII'); return old === r ? [r] : [r, old]; };
  const HEAD_WORD = (book) => (book === 'psalms' ? 'psal(?:m(?:e|us|i)?)?' : '(?:chap(?:ter|itre)?|cap(?:ut|itulum)?|kap(?:itel)?)');
  const headRx = (ch, book) => new RegExp(`^(?:#{1,6}\\s+)?${HEAD_WORD(book)}\\.?\\s+(?:${[String(Number(ch)), ...romans(ch)].join('|')})\\.?\\s*$`, 'i');
  const anyHead = (book) => new RegExp(`^(?:#{1,6}\\s+)?${HEAD_WORD(book)}\\.?\\s+([IVXLC]+|\\d+)\\.?\\s*$`, 'i');
  const headNum = (s, book) => {
    const m = anyHead(book).exec(s); if (!m) return 0;
    if (/^\d+$/.test(m[1])) return Number(m[1]);
    const val = { I: 1, V: 5, X: 10, L: 50, C: 100 }, u = m[1].toUpperCase();
    let n = 0; for (let i = 0; i < u.length; i += 1) n += val[u[i]] < (val[u[i + 1]] || 0) ? -val[u[i]] : val[u[i]];
    return n;
  };
  function headPage(c, book, ch) {
    const k = `${c.slug}|${book}|${ch}`;
    if (S.heads.has(k)) return Promise.resolve(S.heads.get(k));
    const rx = headRx(ch, book);
    return (async () => {
      let last = 0;
      for (let n = Number(c.bookAt), end = Number(c.bookAt) + 400; n <= end; n += stride(c.slug)) {
        const g = await page(c.slug, n).catch(() => null);
        if (!g || (g.last && n > g.last)) break;
        for (const s of paragraphs(g.p && (g.p.en || g.p.la))) {
          if (rx.test(s)) { S.heads.set(k, n); return n; }
          const h = headNum(s, book);
          if (h) { if (h + 1 < last) { S.heads.set(k, null); return null; } last = Math.max(last, h); }
        }
      }
      S.heads.set(k, null);
      return null;
    })();
  }
  // the chapter's own run of paragraphs on the pages shown: from its heading, where it stands on them, to the next chapter's heading
  function chapterRun(all, w) {
    const hx = headRx(w.ch, w.book), head = all.findIndex((s) => hx.test(s)), lo = head + 1;
    let hi = all.length;
    for (let i = lo; i < all.length; i += 1) if (headNum(all[i], w.book)) { hi = i; break; }
    return { lo, hi };
  }
  // under the chapter's heading on the pages shown, the verse's note by its heading word, before the next chapter's heading: {head, hit}
  const strongRx = (v) => new RegExp(`^(?:ver(?:s(?:e|us)?)?\\.?\\s*|v\\.\\s*)\\(?${v}\\b\\s*[.:,)\\]]`, 'i');
  function underHead(all, w, v) {
    const hx = headRx(w.ch, w.book), head = all.findIndex((s) => hx.test(s));
    if (head < 0) return { head, hit: -1 };
    const sx = strongRx(v);
    for (let i = head + 1; i < all.length; i += 1) { if (headNum(all[i], w.book)) break; if (sx.test(all[i])) return { head, hit: i }; }
    return { head, hit: -1 };
  }

  /* A WORK'S PREVIEW IN THE DIRECTORY (10-21): its note on the verse the list speaks of (found as the Commentary view finds it), else
   * where its chapter opens; the note and the paragraphs that carry it on, about 900 characters, in the language the pane is set to;
   * then the two ways on, beside the text or in the reader. A collection (the Critici Sacri) gives its first critics on the verse. */
  const ROMAN = (n) => { let x = +n, s = ''; for (const [k, r] of [[100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]) while (x >= k) { s += r; x -= k; } return s; };
  async function preview(slug) {
    // (10-22) the preview is of the volume and the page the row's Read opens: the volume of the set that holds the verse, the
    // chapter's heading where the map knows only the book
    const w = where(), v = dirVerse() || 1, c = volumeFor(S.list.find((x) => x.slug === slug), v);
    if (!c || !w) return '';
    slug = c.slug;
    await eeboCursor(c, w.ch);
    const name = refName(w);
    let t = quickTargetOf(c, v);
    if (t && t.how === 'book') { await headPage(c, w.book, w.ch); t = quickTargetOf(c, v); }
    if (!t) { try { t = await resolve(c, v, w); } catch (err) { t = null; } }
    if (!t && c.open != null) t = { p: c.open, how: 'chapter' };
    if (!t) return `<p class="vr-empty">Nothing in it is indexed on ${esc(name)} ${esc(w.ch)}.</p>`;
    const acts = (p) => `<p class="vr-pv-acts"><button type="button" class="vr-pv-read" data-vr-read="${esc(slug)}">Read beside the text</button><a href="${esc(readHref(slug, p))}">Open in the reader</a></p>`;
    const cut = (s, n) => (s.length > n ? `${s.slice(0, n).replace(/\s+\S*$/, '')}…` : s);
    if (t.how === 'collected') {
      const items = t.items.slice(0, 3), ns = [...new Set(items.map((x) => +x[1]))];
      const got = await Promise.all(ns.map((n) => page(slug, n).catch(() => null)));
      const byPage = Object.fromEntries(ns.map((n, i) => [n, got[i] && got[i].p]));
      const crit = new Set(t.items.map((x) => x[0])).size;
      const notes = items.map(([who, pn, k, pv]) => {
        const p = byPage[pn]; if (!p) return '';
        const rx = noteRx(pv || t.v), lane = S.lang === 'la' || !p.en ? 'la' : 'en';
        const pick = (ln) => paragraphs(p[ln]).filter((x) => rx.test(x))[k] || paragraphs(p[ln]).filter((x) => rx.test(x))[0];
        const note = (pick(lane) || pick(lane === 'en' ? 'la' : 'en') || '').replace(/^#{1,6}\s+/, '');
        return note ? `<p><b>${esc(who)}</b> ${esc(cut(note, 320))}</p>` : '';
      }).join('');
      return `<p class="vr-pv-where">${t.nearest ? `No critic on ${esc(w.ch)}:${v}. ` : ''}${crit} ${crit === 1 ? 'critic' : 'critics'} on ${esc(name)} ${esc(w.ch)}:${esc(t.v)}, ${esc(pgOf(slug, t.p))}</p>`
        + `<div class="vr-pv-text">${notes || '<p class="vr-empty">The notes could not be found on their page.</p>'}</div>${acts(t.items[0][1])}`;
    }
    const [a, b] = await Promise.all([page(slug, +t.p).catch(() => null), page(slug, +t.p + stride(slug)).catch(() => null)]);
    const pages = [a && a.p, b && b.p].filter(Boolean);
    if (!pages.length) return `<p class="vr-empty">This page could not be opened here.</p>${acts(t.p)}`;
    const hasEn = pages.some((p) => p.en), lane = S.lang === 'la' || !hasEn ? 'la' : 'en';
    const all = [], onPage = [];
    pages.forEach((p) => paragraphs(p[lane] || p.la || p.en).forEach((s) => { all.push(s); onPage.push(p.n); }));
    const printed = (c.pv && c.pv[t.v]) || t.v;
    let from = 0, hit = -1, found = false;
    if (t.how === 'note' || t.how === 'later' || t.how === 'nearest' || t.how === 'page') {
      // only the chapter's own run of paragraphs, as the Commentary view reads it (10-22)
      const run = chapterRun(all, w), part = all.slice(run.lo, run.hi);
      let k = A ? A.findNote(part, printed, !!t.indexed) : -1;
      if (k < 0) k = part.findIndex((s) => noteRx(printed).test(s));
      hit = k >= 0 ? run.lo + k : -1;
      if (hit >= 0) from = hit;
    } else if (t.how === 'chapter') {
      // where the chapter's own heading stands on the page ("CHAPTER I.", "CAP. 1"), else the page's first words
      const rx = new RegExp(`^(?:#{1,6}\\s+)?(?:chapter|chap\\.|caput|cap\\.|psalm|psalmus)\\s+(?:${+w.ch}|${ROMAN(w.ch)})\\b`, 'i');
      const h = all.findIndex((s) => rx.test(s)); if (h >= 0) from = h;
    } else if (t.how === 'head' || t.how === 'book') {
      const u = underHead(all, w, (c.pv && c.pv[v]) || v);
      if (u.hit >= 0) { hit = u.hit; from = hit; found = true; } else if (u.head >= 0) from = u.head;
    } else if (t.how === 'sermon' || t.how === 'sermon-ch') {
      const k = headingAt(all, t.x); if (k >= 0) from = k;
    }
    const to = hit >= 0 && A ? A.noteEnd(all, hit, found ? v : printed, 6) : all.length;
    const out = []; let len = 0;
    for (let i = from; i < Math.max(to, from + 1) && i < all.length && len < 900; i += 1) {
      const s = all[i], head = /^#{1,6}\s+/.test(s), txt = head ? s.replace(/^#{1,6}\s+/, '') : s;
      out.push(`<p${head ? ' class="vr-pv-h"' : i === hit ? ' class="vr-pv-hit"' : ''}>${esc(cut(txt, Math.max(160, 900 - len)))}</p>`);
      len += txt.length;
    }
    const at = pgOf(slug, found ? onPage[hit] : t.p);
    const say = found ? `Its note on ${name} ${w.ch}:${v}, ${at}, found on the page`
      : t.how === 'note' ? `Its note on ${name} ${w.ch}:${t.v}, ${at}`
      : t.how === 'page' ? `Its comment on ${name} ${w.ch}:${t.v} is on ${at}`
      : t.how === 'later' ? `No separate note on ${w.ch}:${v}. Its next note is on ${w.ch}:${t.v}, ${at}`
      : t.how === 'nearest' ? `No separate note on ${w.ch}:${v}. Its closest earlier note is on ${w.ch}:${t.v}, ${at}`
      : t.how === 'cites' ? `It cites ${name} ${w.ch} on ${at}, in its commentary on another passage`
      : t.how === 'treats' ? `Treats this chapter on ${at}`
      : t.how === 'head' ? `No note on ${w.ch}:${v} was found. ${name} ${w.ch} begins on ${at}, by its heading`
      : t.how === 'book' ? `${name} ${w.ch} is not mapped in it. ${w.book === 'psalms' ? 'The Psalms begin' : `${name} begins`} on ${at}`
      : t.how === 'sermon' || t.how === 'sermon-ch' ? `${sermonSay(t, v, w.ch, name)}, ${at}`
      : `${name} ${w.ch} opens on ${at}`;
    return `<p class="vr-pv-where">${esc(say)}</p><div class="vr-pv-text" lang="${lane === 'en' ? 'en' : 'la'}">${out.join('') || '<p class="vr-empty">A blank page.</p>'}</div>${acts(t.p)}`;
  }

  async function show(v, force) {
    S.verse = +v;
    head();
    if (SITE.name === 'mo') creeds();
    if (S.tab === 'r') paintRec();
    if (S.tab === 'h') paintHymns();
    // a verse chosen in the text while the list is open: the list says what each work holds for that verse
    if (force && listOpen()) renderDir();
    const w = where(); if (!S.cur || !w) return;
    // the volume of the set that holds the verse (10-22)
    const vol = volumeFor(S.cur, S.verse);
    if (vol !== S.cur) { S.cur = vol; nameCur(); markKeys(); }
    const tok = ++S.token, {cur} = S;
    const bodyEl = pane.querySelector('.cp-body'), whereEl = pane.querySelector('.cp-where');
    let t = quickTarget(S.verse);
    // a set whose map knows only where the book begins: the chapter's heading, looked for once (a large book is read once)
    if (t && t.how === 'book') {
      bodyEl.classList.add('cp-loading');
      whereEl.textContent = `Looking for ${refName(w)} ${w.ch} in ${cur.a || cur.t}…`;
      await headPage(cur, w.book, w.ch);
      if (tok !== S.token) return;
      t = quickTarget(S.verse);
    }
    if (!t) {
      bodyEl.classList.add('cp-loading');
      whereEl.textContent = `Looking for its note on ${refName(w)} ${w.ch}:${S.verse}…`;
      if (!bodyEl.textContent.trim()) bodyEl.innerHTML = '<p class="cp-empty">Looking for the note…</p>';
      try { t = await resolve(cur, S.verse, w); } catch (err) { t = null; console.error('Scripture pane: finding the note failed', err); }
      if (tok !== S.token) return;
      if (!t && cur.open != null) t = { p: cur.open, how: 'chapter' };
    }
    if (!t) { bodyEl.classList.remove('cp-loading'); S.shown = null; paint(); return; }
    // the same place keeps the pages already read (they were dropped here, and the view said "This page could not be loaded")
    const prev = S.shown;
    const same = !!prev && prev.slug === cur.slug && +prev.p === +t.p && prev.t.how === t.how && prev.t.v === t.v && !!prev.pages;
    S.shown = { slug: cur.slug, p: +t.p, t, book: w.book, ch: w.ch };
    if (same) Object.assign(S.shown, { pages: prev.pages, byPage: prev.byPage, last: prev.last });
    if (same && !force) return paint(true);
    bodyEl.classList.add('cp-loading');
    // a large volume takes a few seconds to open: say what is coming rather than show an empty page
    if (!bodyEl.textContent.trim() || !same) {
      // the verse only where the place is a note on it
      whereEl.textContent = `Opening ${cur.a || cur.t} on ${refName(w)} ${w.ch}${t.v ? `:${t.v}` : ''}, ${pgOf(cur.slug, t.p)}…`;
      // (10-22) EEBO is the module's (commentary-pages.js exports it there), not the loader's: PG.EEBO was undefined and threw here
      if (!bodyEl.textContent.trim()) bodyEl.innerHTML = `<p class="cp-empty">${window.FRCommentaryPages.EEBO.test(cur.slug) ? 'Opening the book (a large file, loaded once)…' : 'Opening the page…'}</p>`;
    }
    // an EEBO book with repeating page numbers: the chapter's place first, so the pages read are the right part's
    await eeboCursor(cur, w.ch);
    if (tok !== S.token) return;
    try {
      if (t.how === 'collected') {
        const ns = [...new Set(t.items.map((x) => +x[1]))];
        const got = await Promise.all(ns.map((n) => page(cur.slug, n).catch(() => null)));
        if (tok !== S.token) return;
        S.shown.byPage = Object.fromEntries(ns.map((n, i) => [n, got[i] && got[i].p]));
        S.shown.pages = got.filter(Boolean).map((g) => g.p);
      } else {
        const [a, b] = await Promise.all([page(cur.slug, +t.p), page(cur.slug, +t.p + stride(cur.slug)).catch(() => null)]);
        if (tok !== S.token) return;
        S.shown.pages = [a.p, b && b.p].filter(Boolean); S.shown.last = a.last;
      }
    } catch (err) { console.error('Scripture pane: the commentary page did not load', err); if (tok === S.token) { S.shown.pages = []; } }
    paint();
  }

  function step(d) {
    if (!S.shown) return;
    const k = stride(S.cur.slug), p = Math.max(1, S.shown.p + d * k);
    S.follow = false; pane.querySelector('.cp-follow input').checked = false; store.set('fr_cp_follow', '0');
    S.shown = { ...S.shown, p, t: { p, how: 'browse' } };
    Promise.all([page(S.cur.slug, p), page(S.cur.slug, p + k).catch(() => null)]).then(([a, b]) => {
      S.shown.pages = [a.p, b && b.p].filter(Boolean); paint();
    });
  }

  function paint() {
    const sh = S.shown, body = pane.querySelector('.cp-body'), whereEl = pane.querySelector('.cp-where');
    body.classList.remove('cp-loading');
    pane.querySelectorAll('.cp-lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === S.lang)));
    if (!sh) { body.innerHTML = S.cur ? '<p class="cp-empty">This commentary has nothing on the verse to show.</p>' : '<p class="cp-empty">No commentary on this chapter yet.</p>'; whereEl.textContent = ''; return; }
    const bookName = refName(where() || { book: sh.book }), wr = { ...(where() || {}), book: sh.book, ch: sh.ch };
    const {t} = sh, ref = (n) => `${bookName} ${sh.ch}:${n}`;
    const say = t.how === 'note' ? `Its note on ${ref(t.v)}`
      : t.how === 'page' ? `Its comment on ${ref(t.v)} is on this page`
      : t.how === 'later' ? `No separate note on ${sh.ch}:${S.verse}. Its next note is on ${ref(t.v)}`
      : t.how === 'nearest' ? `No separate note on ${sh.ch}:${S.verse}. Its closest earlier note is on ${ref(t.v)}`
      : t.how === 'chapter' ? `No note on ${ref(S.verse)} was found. This is where it opens ${bookName} ${sh.ch}`
      // (10-22) a work on another book, at the page where it cites the chapter; a set whose map knows only where the book begins
      : t.how === 'cites' ? `It cites ${bookName} ${sh.ch} on this page, in its commentary on another passage`
      : t.how === 'treats' ? 'Treats this chapter on this page'
      : t.how === 'head' ? `No note on ${ref(S.verse)} was found. This is where ${bookName} ${sh.ch} begins, by its heading`
      : t.how === 'book' ? `${bookName} ${sh.ch} is not mapped in it. This is where ${sh.book === 'psalms' ? 'the Psalms begin' : `${bookName} begins`}`
      : t.how === 'sermon' || t.how === 'sermon-ch' ? sermonSay(t, S.verse, sh.ch, bookName) : 'Reading on';
    // where the text stands, said as a sentence: "Its note on Matthew 1:2, col. 65 · Open in the reader" (10-21); a note found on the
    // page under the chapter's heading is said to be that, at its own page (10-22)
    const setWhere = (p, found) => {
      const pg = `<span class="cp-pg">${esc(pgOf(sh.slug, p))}</span>`;
      whereEl.innerHTML = `<span>${found ? `Its note on ${esc(ref(S.verse))}, ${pg}, found on the page` : `${esc(say)}, ${pg}`}</span> <span class="cp-go"><span aria-hidden="true">· </span><a href="${esc(readHref(sh.slug, p))}">Open in the reader</a></span>`;
    };
    setWhere(sh.p, false);
    const pages = sh.pages || [];
    if (!pages.length) { body.innerHTML = '<p class="cp-empty">This page could not be loaded.</p>'; return; }
    if (t.how === 'collected') return paintCollected(sh, t, bookName, body, whereEl);
    const hasEn = pages.some((p) => p.en), lane = S.lang === 'la' || !hasEn ? 'la' : 'en';
    pane.querySelector('.cp-lang').hidden = !(hasEn && pages.some((p) => p.la));
    const printed = (S.cur && S.cur.pv && S.cur.pv[t.v]) || t.v;
    // the pages as one run of paragraphs, so a note that crosses the page break is one note
    const all = [], pageOf = [];
    pages.forEach((p, i) => { paragraphs(p[lane] || p.la || p.en).forEach((s) => { all.push(s); pageOf.push(i); }); });
    let h = -1, top = 0, found = false;
    if (t.how === 'note' || t.how === 'later' || t.how === 'nearest' || t.how === 'page') {
      // (10-22) only the chapter's own run of paragraphs is read: Poole's note on Psalm 52:2 was marked as his note on 51:2
      const run = chapterRun(all, wr), part = all.slice(run.lo, run.hi);
      if (A) { const k = A.findNote(part, printed, !!t.indexed); h = k >= 0 ? run.lo + k : -1; }
      // a page the library indexed as holding the note keeps the older reading if the stricter one finds none
      if (h < 0 && t.indexed) { const k = part.findIndex((s) => noteRx(printed).test(s)); h = k >= 0 ? run.lo + k : -1; }
    } else if (t.how === 'head' || t.how === 'book') {
      // under the chapter's heading, the verse's own note by its heading word ("Vers. 1."), else the heading itself (10-22)
      const u = underHead(all, wr, (S.cur && S.cur.pv && S.cur.pv[S.verse]) || S.verse);
      if (u.hit >= 0) { h = u.hit; found = true; setWhere(pages[pageOf[h]].n, true); } else if (u.head > 0) top = u.head;
    } else if (t.how === 'sermon' || t.how === 'sermon-ch') {
      // a sermon starts at its own heading, what came before it on the page folded away
      const k = headingAt(all, t.x); if (k > 0) top = k;
    }
    const from = h > 0 ? h : top;
    // the editors' textual notes of a scholarly edition (variant readings, line numbers) are set apart, and do not count toward what is shown
    const app = A ? A.apparatusIndexes(all) : new Set();
    const shown = (n, a = 0) => { let seen = 0, j = a; for (; j < all.length && seen < n; j += 1) if (!app.has(j)) seen += 1; while (j < all.length && app.has(j)) j += 1; return j; };
    const to = h >= 0 ? (A ? A.noteEnd(all, h, found ? S.verse : printed, 14) : Math.min(all.length, h + 8)) : (t.how === 'browse' ? all.length : shown(14, from));
    const sig = siglaOf(sh.slug);
    const withSigla = (txt) => {
      if (!sig) return { html: esc(txt), who: [] };
      const who = [];
      const html = esc(txt).replace(sig.rx, (m0, pre, k) => { const n = sig.sg[k]; if (n && !who.includes(n)) who.push(n); return `${pre}<abbr title="${esc(n)}">${k}</abbr>`; });
      return { html, who };
    };
    const one = (s, i) => {
      // set small and plain, with no critics' sigla marked up: these are the editors' lines, not the commentary
      if (app.has(i)) {
        const pb = i && pageOf[i] !== pageOf[i - 1] ? `<div class="cp-break"><span>${pgOf(sh.slug, pages[pageOf[i]].n)}</span></div>` : '';
        return `${pb}<p>${esc(s)}</p>`;
      }
      // the page's own heads ("### CAPUT V.") are set as heads, not printed with their marks
      const head1 = /^#{1,6}\s+/.test(s);
      const x = withSigla(head1 ? s.replace(/^#{1,6}\s+/, '') : s);
      const brk = i && pageOf[i] !== pageOf[i - 1] ? `<div class="cp-break"><span>${pgOf(sh.slug, pages[pageOf[i]].n)}</span></div>` : '';
      if (head1) return `${brk}<p class="cp-h">${x.html}</p>`;
      const mark = i === h;
      return `${brk}<p${mark ? ' class="cp-hit" id="cp-hit"' : i > h && h >= 0 && i < to ? ' class="cp-hit-on"' : ''}>${x.html}</p>${mark && x.who.length ? `<p class="cp-sig">Critics cited: ${esc(x.who.join(', '))}</p>` : ''}`;
    };
    // each unbroken run of apparatus is one closed disclosure, never the commentary's own text
    const run = (a, b) => {
      let out = '', buf = '';
      const flush = () => { if (buf) { out += `<details class="cp-app"><summary>Editors\u2019 textual notes (variants of the early printings)</summary>${buf}</details>`; buf = ''; } };
      for (let i = a; i < b; i += 1) { if (app.has(i)) buf += one(all[i], i); else { flush(); out += one(all[i], i); } }
      flush();
      return out;
    };
    body.innerHTML = (from > 0 ? `<button type="button" class="cp-expand" data-cp-expand="before">Earlier on these pages</button><div class="cp-fold" data-cp-fold="before" hidden>${run(0, from)}</div>` : '')
      + (run(from, to) || '<p class="cp-empty">A blank page.</p>')
      + (to < all.length ? `<div class="cp-fold" data-cp-fold="after" hidden>${run(to, all.length)}</div><button type="button" class="cp-expand" data-cp-expand="after">Keep reading</button>` : '');
    document.querySelectorAll('.cp-focus').forEach((e) => e.classList.remove('cp-focus'));
    const vEl = SITE.verseEl(S.verse); if (vEl) vEl.classList.add('cp-focus');
  }

  // a collection (the Critici Sacri): every critic's note on the verse, in the order the volume prints them
  function paintCollected(sh, t, bookName, body, whereEl) {
    const n = t.items.length, crit = new Set(t.items.map((x) => x[0])).size;
    whereEl.innerHTML = `<span>${t.nearest ? `No critic on ${sh.ch}:${S.verse}. ` : ''}${crit} ${crit === 1 ? 'critic' : 'critics'} on ${esc(bookName)} ${sh.ch}:${t.v}, ${esc(pgOf(sh.slug, t.items[0][1]))}</span>`
      + ` <span class="cp-go"><span aria-hidden="true">· </span><a href="${esc(readHref(sh.slug, t.items[0][1]))}">Open in the reader</a></span>`;
    const anyEn = Object.values(sh.byPage || {}).some((p) => p && p.en), lane = S.lang === 'la' || !anyEn ? 'la' : 'en';
    pane.querySelector('.cp-lang').hidden = !anyEn;
    const rxV = noteRx(t.v);
    const firstOf = new Map(); t.items.forEach(([who], i) => { if (!firstOf.has(who)) firstOf.set(who, i); });
    const idx = `<p class="cp-index">${[...firstOf].map(([who, i]) => `<a href="#cp-c${i}" data-cp-jump="${i}">${esc(who)}</a>`).join(', ')}</p>`;
    body.innerHTML = idx + t.items.map(([who, pn, k, pv], i) => {
      // a critic's own number for the verse, where his numbering counts the psalm's title
      const rx = pv ? noteRx(pv) : rxV;
      const p = (sh.byPage || {})[pn]; if (!p) return '';
      const pick = (ln) => paragraphs(p[ln]).filter((x) => rx.test(x))[k] || paragraphs(p[ln]).filter((x) => rx.test(x))[0];
      let note = (pick(lane) || pick(lane === 'en' ? 'la' : 'en') || '').replace(/^#{1,6}\s+/, '');
      if (note.length > 1100) note = `${note.slice(0, 1100).replace(/\s+\S*$/, '')} …`;
      return `<section class="cp-crit" id="cp-c${i}"><h4><span>${esc(who)}</span><a href="${esc(readHref(sh.slug, pn))}">${esc(pgOf(sh.slug, pn))}</a></h4>`
        + `<p>${note ? esc(note) : '<span class="cp-empty">The note could not be found on its page.</span>'}</p></section>`;
    }).join('');
    body.querySelectorAll('[data-cp-jump]').forEach((a) => { a.onclick = (e) => { e.preventDefault(); const s = body.querySelector(`#cp-c${a.dataset.cpJump}`); if (s) s.scrollIntoView({ block: 'start' }); }; });
    document.querySelectorAll('.cp-focus').forEach((e) => e.classList.remove('cp-focus'));
    const vEl = SITE.verseEl(S.verse); if (vEl) vEl.classList.add('cp-focus');
  }

  // ── following the reader ──────────────────────────────────────────────────────────────────────────────────────────────────
  function watch() {
    if (observer) observer.disconnect();
    const seen = new Map();
    observer = new IntersectionObserver((es) => {
      for (const e of es) seen.set(e.target, e.isIntersecting);
      if (!S.follow || S.pin) return;
      const vis = [...seen].filter(([, on]) => on).map(([el]) => el).sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
      const v = vis.length ? SITE.vnum(vis[0]) : null;
      if (v && v !== S.verse) { clearTimeout(watch.t); watch.t = setTimeout(() => show(v), 180); }
    }, { rootMargin: '-22% 0px -68% 0px' });
    document.querySelectorAll(SITE.verses).forEach((el) => observer.observe(el));
  }
  document.addEventListener('click', (e) => {
    const v = SITE.clicked(e.target); if (!v || !pane) return;
    S.pin = true;
    show(v, true);
  });
  // the reader's own scrolling (not the page's scrolling to a chosen verse) hands the rail back to the reading line
  const unpin = (e) => { if (e.type !== 'keydown' || ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(e.key)) S.pin = false; };
  ['wheel', 'touchmove', 'keydown'].forEach((t) => addEventListener(t, (e) => { if (!pane || !pane.contains(e.target)) unpin(e); }, { passive: true }));

  // the reader redraws its side panel on every verse: give it the switch back to the commentary each time
  function ensureTabs() {
    const side = layout && layout.querySelector(SITE.side), tabs = pane && pane.querySelector('.cp-tabs');
    if (!side || !tabs || side.querySelector('.cp-tabs')) return;
    side.prepend(tabs.cloneNode(true));
    layout.querySelectorAll('.cp-tabs [data-tab]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.tab === S.tab)));
    desk();
  }

  // the reader's script says when a verse is chosen or closed: Close shows only while one is, and a closed verse hands the rail
  // back to the reading line
  document.addEventListener('change', (e) => { if (e.target.matches && e.target.matches('[data-sd-translation]')) desk(); });
  window.addEventListener('sd:verse', (e) => { if (!pane) return; if (!(e.detail && e.detail.v)) S.pin = false; head(); });

  let lastKey = '';
  // cp=<slug> in the address (the page's query on Mere Orthodoxy, the hash's on The Faith Received)
  // read as the page opens (the reader may rewrite its address first: the navigation entry is read too) and on every change of the hash,
  // before the page redraws its own address; used once, by the chapter it was asked on
  const cpOf = (u) => { try { const x = new URL(u, location.href); return x.searchParams.get('cp') || new URLSearchParams(x.hash.split('?')[1] || '').get('cp') || ''; } catch (_) { return ''; } };
  let askedCp = cpOf(location.href) || cpOf(opened);
  window.addEventListener('hashchange', () => { const x = cpOf(location.href); if (x) askedCp = x; });
  const askedWork = () => { const x = askedCp; askedCp = ''; return x; };
  async function init() {
    const w = where(); if (!w) return;
    const fresh = !document.querySelector('.cp-pane');
    if (!build()) return;
    ensureTabs();
    const key = `${w.book}/${w.ch}`;
    if (key === lastKey && !fresh) {
      // the same chapter drawn again (another translation): follow the new verse elements
      const v1 = document.querySelector(SITE.verses);
      if (v1 && v1 !== S.firstEl) { S.firstEl = v1; watch(); paint(); heat(); }
      return;
    }
    lastKey = key;
    // a new chapter: the rail follows the reading line again, its list shut
    S.rec = null; S.pin = false; S.dirOpen = new Set();
    setDir(false);
    const [list, rec, hits, pr] = await Promise.all([commentaries(w.book, w.ch), recOf(w.book, w.ch), hitsOf(w.book, w.ch), preachOf(w.book)]);
    // the hits join the list as works the pane can open at their page (wb 2: a list of their own, never a key). (10-22) A work the map
    // files under this book with no page for the chapter is a hit flagged own: where its page is the chapter's own (treats) it is listed
    // as a commentary that treats the chapter there, on the book or the whole Bible as its standing says; the rest with the citations
    const have = new Set(list.map((c) => c.slug));
    for (const x of hits) {
      if (have.has(x.w)) continue;
      const treats = !!(x.own && x.treats);
      list.push({ slug: x.w, a: x.a || '', t: x.t || x.w, notes: {}, open: x.p, rows: {}, hit: { v: x.v || [], n: x.n, g: x.g, how: x.how || '' }, sh: x.sh,
        wb: treats ? ((RANK.works[x.w] || [])[1] === 1 ? 1 : 0) : 2, treats, score: 0 });
      S.cen[x.w] = x.cen || 0;
    }
    // a work citing the chapter opens at its note on a verse where the reception history knows one, as the commentaries do (10-22)
    const citing = new Map(list.filter((y) => y.wb === 2 || y.treats).map((y) => [y.slug, y]));
    for (const [v, x] of Object.entries((rec && rec.verses) || {})) {
      for (const [slug, p] of Object.entries(x.notes || {})) { const c = citing.get(slug); if (c && !(v in c.notes)) c.notes[v] = p; }
    }
    // the sermons and homilies whose headings name the chapter join the list; its hymns are the Hymns view, offered only where it has any
    const pc = (pr && pr.chapters && pr.chapters[String(w.ch)]) || {};
    addSermons(list, pc.s || [], pr);
    S.preach = pr; S.hymns = (pc.h || []).map(preachRow);
    layout.querySelectorAll('.cp-tabs [data-tab="h"]').forEach((b) => { b.hidden = !S.hymns.length; });
    if (S.tab === 'h' && !S.hymns.length) setTab('c', true);
    S.list = list; S.rec = rec;
    readYears(rec);
    heat();
    // the century of each commentary, from the same list the Citations view reads, so the two name a work alike
    const mo = window.MOScriptureDev;
    if (mo && mo.fetchCommentaries && w.bk) {
      mo.fetchCommentaries(w.bk, +w.ch, mo.emptyFilters()).then((d) => {
        const ofAuthor = new Map();
        for (const e of (d && d.items) || []) if (e.cen) { S.cen[e.w] = e.cen; if (e.a && !ofAuthor.has(e.a)) ofAuthor.set(e.a, e.cen); }
        // a person is one century in the whole list: his hits carry the century of his volumes among the commentaries
        for (const c of S.list) if (c.wb === 2 && ofAuthor.has(c.a)) S.cen[c.slug] = ofAuthor.get(c.a);
        if (pane && S.list === list) { fillList(); nameCur(); }
      }).catch(() => {});
    }
    // the reader's own last choice when this chapter has it (his key work on the book), else the book's first key commentary, else
    // the first-ranked commentary on the book
    const want = store.get('fr_cp_pick', ''), keys = curated(w.book);
    // (10-22) his commentary on the book or a set on the whole Bible, never a page of his on another book that only cites the chapter
    const c = (want && (keys.find((x) => x.a === want) || S.list.find((x) => x.a === want && x.wb !== 2))) || keys[0] || S.list[0];
    S.verse = w.v || 1;
    head();
    if (SITE.name === 'mo') creeds();
    // (10-22) the commentary the address asks for (cp=<slug>: the Verse Desk's "Read beside the text"), on the Commentary view, the verse in sight
    const asked = askedWork(), pick = asked && S.list.find((x) => x.slug === asked);
    if (pick) {
      setTab('c', true); S.pin = true;
      choose(pick.slug, true);
      const el = w.v && SITE.verseEl(w.v); if (el) el.scrollIntoView({ block: SITE.name === 'mo' && !wide.matches ? 'start' : 'center', behavior: 'auto' });
    } else choose(c ? c.slug : null);
    S.firstEl = document.querySelector(SITE.verses);
    watch();
  }
  const kick = () => { clearTimeout(kick.t); kick.t = setTimeout(init, 250); };
  window.addEventListener('hashchange', kick); window.addEventListener('popstate', kick);
  new MutationObserver((ms) => { if (ms.some((m) => !pane || !pane.contains(m.target))) kick(); })
    .observe(document.body, { childList: true, subtree: true });
  kick();
})();
