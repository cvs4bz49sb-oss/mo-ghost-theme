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
     - the reception history: v1/reception/scripture/<book>/<ch>.json (runs/reception_1015), every page that cites the verse. */
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
  const impOf = (slug, a) => { const r = RANK.works[slug]; return r ? r[0] : (RANK.authors[a] || 0); };
  const KIND_W = { commentary: 1, sermons: 0.8, collected: 0.7 };
  function weigh(c) {
    // a series of sermons or tractates through the book (Augustine's 124 Tractates on John) is read as its commentary
    const kind = c.k === 'sermons' && c.cov >= 5 ? 1 : (KIND_W[c.k] || (c.overlay ? 1 : 0.65));
    const cov = c.cov >= 5 ? 1 : c.cov >= 2 ? 0.92 : 0.86;
    c.wb = (RANK.works[c.slug] || [])[1] === 1 || !!c.overlay ? 1 : 0;
    // verse notes on the chapter only break near-ties: importance leads (Augustine's Expositions before Calvin on Psalm 51)
    c.score = impOf(c.slug, c.a) * kind * cov + (Object.keys(c.notes).length ? 0.5 : 0);
    return c;
  }
  // the name a key button carries: "Augustine", "Chrysostom", "Glossa", "Critici Sacri"
  const SHORT = { 'Augustine of Hippo': 'Augustine', 'John Chrysostom': 'Chrysostom', 'Walafrid Strabo': 'Glossa', 'Walahfrid Strabo': 'Glossa',
    'Westminster Assembly': 'Westminster Annotations', 'Gregory I': 'Gregory the Great', 'Theophylact, Archbishop of Bulgaria': 'Theophylact',
    'The critics, collected by John Pearson and others': 'Critici Sacri', 'Cornelius a Lapide': 'Lapide', 'collected by Thomas Aquinas': 'Catena Aurea',
    'collected by Thomas Aquinas The catena': 'Catena Aurea',
    'Denys the Carthusian': 'Denys', 'Willem van Est': 'Estius', 'Nicholas of Lyra': 'Lyra', 'Matthew Poole': 'Poole' };
  const short = (a) => {
    if (SHORT[a]) return SHORT[a];
    if (/catena/i.test(a) && /aquinas/i.test(a)) return 'Catena Aurea'; // "The catena, collected by Thomas Aquinas" in the chapter files
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
    p.catch(() => { if (cache.get(u) === p) cache.delete(u); }); // a failed fetch is tried again, not remembered
    cache.set(u, p); return p;
  }
  const gz = json;
  const where = () => SITE.where();

  // ── the commentaries on this chapter ──────────────────────────────────────────────────────────────────────────────────────
  // The loaders (a work's pages, TEI, Migne columns, EEBO books) and the list of works a chapter has are in commentary-pages.js, so
  // scripts/check-commentary-pages.mjs can open every one of them against the live library.
  const PG = window.FRCommentaryPages.createPages({ base: BASE, mo: SITE.name === 'mo', json,
    text(u) { return fetch(u, { credentials: 'omit' }).then((r) => { if (!r.ok) throw new Error(u); return r.text(); }); } });
  async function commentaries(book, ch) {
    const { works, meta, sigla } = await PG.listWorks(book, ch);
    Object.assign(S.meta, meta); Object.assign(SIGLA, sigla);
    await loadRank();
    for (const c of works) weigh(c);
    return works.sort((x, y) => x.wb - y.wb || y.score - x.score || x.a.localeCompare(y.a));
  }

  // ── a commentary page ─────────────────────────────────────────────────────────────────────────────────────────────────────
  // page() belongs to the loader built above; stride() and paragraphs() are the module's own helpers (not on the loader: reading them
  // from PG left both undefined, so every commentary page threw in show() and the catch below reported "could not be loaded")
  const { page } = PG;
  const { stride, paragraphs } = window.FRCommentaryPages;
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
    shown: null, token: 0, meta: {}, cen: {}, rec: null, pin: false, tab: firstTab() };
  const A = window.FRCommentaryAnchor;
  let pane, layout, observer;

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
          <ol class="cp-list" id="cpList" hidden></ol>
        </div>
        <div class="cp-lang" role="group" aria-label="Language of the commentary">
          <button type="button" data-lang="en">English</button><span aria-hidden="true">·</span><button type="button" data-lang="la">Latin</button>
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
      ? '<button type="button" data-tab="c">Commentary</button><button type="button" data-tab="s">Citations</button><button type="button" data-tab="r">Reception</button>'
      : '<button type="button" data-tab="c">Commentary</button><button type="button" data-tab="r">Reception</button><button type="button" data-tab="s">Citations</button>';
    // The Verse Desk, at the end of the tab row on Mere Orthodoxy's page (Ian, 2026-10-20: a button always there for opening it). The
    // row is sticky, so it stays in reach as the page scrolls; head() points it at the verse the rail is on.
    if (SITE.name === 'mo') tabs.insertAdjacentHTML('beforeend', '<a class="btn cp-desk" href="/the-faith-received/scripture/desk/">Verse Desk</a>');
    pane.prepend(tabs);
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
    pick.onclick = () => { const open = list.hidden; list.hidden = !open; pick.setAttribute('aria-expanded', String(open)); pick.textContent = open ? 'Hide list' : 'Change'; };
    const closeList = () => { list.hidden = true; pick.setAttribute('aria-expanded', 'false'); pick.textContent = 'Change'; };
    list.onclick = (e) => {
      if (e.target.closest('[data-cp-more]')) { S.allCited = true; list.querySelectorAll('[hidden]').forEach((x) => { x.hidden = false; }); e.target.closest('[data-cp-more]').remove(); return; }
      const li = e.target.closest('[data-slug]'); if (!li) return; choose(li.dataset.slug, true); closeList();
    };
    pane.querySelector('.cp-keys').onclick = (e) => { const b = e.target.closest('[data-slug]'); if (b) { choose(b.dataset.slug, true); closeList(); } };
    // Close (Scripture page only): the same way out as the Citations panel's, which the reader's script carries out
    const closeBtn = pane.querySelector('.cp-close');
    if (closeBtn) closeBtn.onclick = () => window.dispatchEvent(new Event('sd:close-verse'));
    // Escape shuts the open list of commentaries first; the reader's own Escape then closes the verse
    pane.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !list.hidden) { closeList(); pick.focus(); e.stopPropagation(); } });
    pane.querySelectorAll('.cp-pages button').forEach((b) => { b.onclick = () => step(+b.dataset.step); });
    wide.addEventListener('change', () => setTab(S.tab, true));
    setTab(S.tab, true);
    return true;
  }

  // the rail's three views; Citations is the site's own verse panel, shown in the rail's place
  function setTab(t, quiet) {
    S.tab = t;
    pane.dataset.tab = t;
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
    if (t === 's' && SITE.name === 'tfr') {
      const side = layout.querySelector(SITE.side), b = SITE.pick(S.verse || 1);
      if (side && side.hidden && b) b.click();
    }
  }
  // the label and the large heading over each view, as the Citations view sets its own: "COMMENTARY / Genesis 1:1"
  function head() {
    if (!pane) return;
    const w = where(); if (!w) return;
    const name = w.name || w.book.replace(/-/g, ' ');
    pane.querySelector('.cp-eyebrow').textContent = S.tab === 'r' ? 'Reception history' : (S.verse ? 'Commentary on this verse' : 'Commentary');
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
    const href = M.deskHref(w.bk, w.ch, v, t), label = `Open the Verse Desk for ${w.name} ${w.ch}:${v}`;
    document.querySelectorAll('.cp-tabs .cp-desk').forEach((a) => { a.href = href; a.setAttribute('aria-label', label); });
  }
  // a verse chosen from the rail: as if clicked in the text (the site's panel follows), brought to the reading line
  function select(v) {
    const b = SITE.pick(v), el = SITE.verseEl(v);
    S.pin = true;
    if (el) el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
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

  function paintRec() {
    const box = pane && pane.querySelector('.cp-rec'), w = where(); if (!box || !w) return;
    const {rec} = S, n = S.verse || 1, rv = rec && rec.verses && rec.verses[String(n)];
    const name = w.name || w.book.replace(/-/g, ' ');
    const all = Object.entries((rec && rec.verses) || {}).map(([k, x]) => [+k, x.works || 0]);
    const most = all.slice().sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 6);
    const top = Math.max(1, ...most.map(([, x]) => x));
    // the most cited verses of the chapter: the rows the Citations view uses, a verse and a meter and a count
    const mostHTML = most.length ? `<h3 class="cp-h3">Most cited verses</h3><ol class="cp-top-list" aria-label="Most cited verses of ${esc(name)} ${esc(w.ch)}">${most.map(([k, x]) =>
      `<li><button type="button" class="cp-verse-row" data-cp-verse="${k}"${k === n ? ' aria-current="true"' : ''}><span class="cp-vr-ref">${esc(w.ch)}:${k}</span>`
      + `<span class="cp-meter" aria-hidden="true"><i style="width:${Math.max(3, Math.round((x / top) * 100))}%"></i></span><span class="cp-vr-n">${fmt(x)}</span></button></li>`).join('')}</ol>` : '';
    if (!rec) { box.innerHTML = '<p class="cp-empty">The reception history of this chapter is not yet available.</p>'; return; }
    if (!rv) { box.innerHTML = `<p class="cp-empty">No page in the library cites this verse yet.</p>${mostHTML}`; return; }
    const strip = rv.strip || [];
    const ns = Object.entries(rv.notes || {}).map(([slug, p]) => {
      const c = S.list.find((x) => x.slug === slug) || S.meta[slug] || {};
      return { slug, p, a: c.a || '', t: c.t || slug };
    }).sort((x, y) => rankOf(x.slug, x.a) - rankOf(y.slug, y.a) || x.a.localeCompare(y.a));
    const tiles = `<div class="cp-stats"><div class="cp-stat"><b>${fmt(rv.works)}</b><span>${rv.works === 1 ? 'work cites it' : 'works cite it'}</span></div>`
      + `<div class="cp-stat"><b>${fmt(ns.length)}</b><span>${ns.length === 1 ? 'commentary on it' : 'commentaries on it'}</span></div></div>`;
    const span = strip.length ? `<p class="cp-lede">From the ${ord(strip[0][0])} century to the ${ord(strip[strip.length - 1][0])}.</p>` : '';
    let bars = '';
    if (strip.length >= 2) {
      const max = Math.max(...strip.map(([, k]) => k)), by = new Map(strip), cols = [];
      for (let c = strip[0][0]; c <= strip[strip.length - 1][0]; c += 1) {
        const k = by.get(c) || 0, tip = `${ord(c)} century: ${fmt(k)} ${k === 1 ? 'work' : 'works'}`;
        cols.push(`<li${k ? '' : ' class="is-zero"'} style="--k:${k ? Math.max(0.08, Math.sqrt(k / max)).toFixed(3) : 0}" title="${tip}"><span class="cp-bar"></span><small aria-hidden="true">${c}</small><span class="cp-sr">${tip}</span></li>`);
      }
      bars = `<figure class="cp-rec-strip"><ol>${cols.join('')}</ol><figcaption>Works citing it, by century</figcaption></figure>${method("<p>Every page in the library that cites the verse, dated by its author's life.</p>")}`;
    }
    const notes = ns.length ? `<h3 class="cp-h3">Commentaries on this verse</h3><ol class="cp-rows">${ns.map((c) =>
      `<li class="cp-row-li"><button type="button" class="cp-row" data-cp-open="${esc(c.slug)}" data-cp-p="${esc(c.p)}" title="Read beside the text"><span class="cp-row-t">${esc(c.t)}</span><span class="cp-row-m">${esc(c.a)}</span></button>`
      + `<a class="cp-row-pg" href="${esc(SITE.read(c.slug, c.p))}" aria-label="${esc(`${c.a || c.t}, page ${c.p}, in the reader`)}">p. ${esc(c.p)}</a></li>`).join('')}</ol>` : '';
    const SHOW = 4, byYear = (a, b) => (a.y || 9999) - (b.y || 9999);
    const wit = (x, hid) => `<li class="cp-row-li cp-wit"${hid ? ' hidden' : ''}><a class="cp-row-t" href="${esc(SITE.read(x.w, x.p))}">${esc(x.t || x.w)}</a>`
      + `<span class="cp-row-m">${[x.a || x.w, x.d ? x.d : (x.y ? `fl. c. ${x.y}` : ''), `p. ${x.p}`, VERB[x.how] || 'cites it'].filter(Boolean).map(esc).join(dot)}</span>`
      + `${x.g && !(x.commentary && x.how === 'exegesis') ? `<span class="cp-w-g">${esc(gist(x.g))}</span>` : ''}</li>`;
    const eras = (rv.eras || []).map((e) => {
      const [label, years] = ERA[e.id] || [e.label, ''];
      const xs = (e.top || []).slice().sort(byYear);
      return `<li class="cp-era"><h4 class="cp-era-h">${esc(label)} <small>${years ? `${esc(years)}${dot}` : ''}${fmt(e.works)} ${e.works === 1 ? 'work' : 'works'}</small></h4>`
        + `<ul class="cp-rows">${xs.map((x, j) => wit(x, j >= SHOW)).join('')}</ul>${xs.length > SHOW ? `<button type="button" class="cp-more">Show ${fmt(xs.length - SHOW)} more</button>` : ''}`
        + `${e.more ? `<p class="cp-era-more">${fmt(e.more)} more ${e.more === 1 ? 'author' : 'authors'} in this period (Citations lists every use).</p>` : ''}</li>`;
    }).join('');
    box.innerHTML = `${tiles}${span}${bars}${notes}`
      + `${eras ? `<h3 class="cp-h3">Through the centuries</h3><ol class="cp-eras">${eras}</ol>` : ''}${mostHTML}`;
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
    const {docs} = docsIdx, name = w.name || w.book.replace(/-/g, ' ');
    const main = rows.filter((r) => !docs[d.a[r[0]][0]].p), papal = rows.filter((r) => docs[d.a[r[0]][0]].p);
    const n = rows.length;
    box.hidden = false;
    box.querySelector('.cp-cr-h').textContent = `Creeds, confessions and catechisms (${fmt(n)})`;
    const open = CF.open && (n > 3 || whole.length || papal.length);
    box.classList.toggle('is-open', !!open);
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
      if (c) { c.born = born; out.push(c); }
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
  const tradOf = (c) => {
    const sh = c.sh || '', cen = S.cen[c.slug] || (RANK.works[c.slug] || [])[2] || 0;
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
  // in the order their authors came: the curated key's year (Luther 1483, Bucer 1491, Musculus 1497, Calvin 1509), else the century
  const when = (c) => c.born || cenOf(c) * 100 - 50;
  function fillList() {
    const list = pane.querySelector('.cp-list'), w = where() || {};
    const bookName = w.book === 'psalms' ? 'the Psalms' : (w.name || 'this book');
    const keys = curated(w.book), keySet = new Set(keys.map((c) => c.slug));
    /* ONE ROW PER AUTHOR (owner 10-19 on Psalm 51: "how are there 10 luther vols this is type of organization im asking"): the
     * author's key work, else his first-ranked; his other works on the chapter beneath it, each by the piece it is. The curated key
     * commentaries lead, in the order they wrote; the rest by tradition, each by weight; then the whole Bible; then the commentaries
     * on other books that cite the chapter (owner 10-20), one row per author however many of his volumes cite it (Salmerón). */
    /* ONE ROW PER AUTHOR ACROSS ALL THE LISTS (review of #175: Luther's volumes on Psalm 51 were in his card and again as a second row
     * under the cited list). An author is in the first list he earns, the book's, else the whole Bible's, else the cited; the rest of
     * his volumes are beneath his row. A guessed attribution ("Uncertain author (Bede?)") is under Other works, one row to a work. */
    const listOf = (c) => (guessed(c) ? 3 : c.wb === 1 && namesOneBook(c.t) ? 0 : c.wb);
    const byAuthor = new Map();
    for (const c of S.list) {
      const k = anonymous(c) ? c.slug : String(c.a || c.slug).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
      if (!byAuthor.has(k)) byAuthor.set(k, []);
      byAuthor.get(k).push(c);
    }
    const lists = [[], [], [], []];
    for (const cs of byAuthor.values()) {
      const dest = Math.min(...cs.map(listOf));
      const mine = cs.filter((c) => listOf(c) === dest);
      const main = dest === 0 ? (mine.find((c) => keySet.has(c.slug)) || mine[0]) : mine[0];
      const score = cs.reduce((t, c) => t + (c.hit ? c.hit.n * (c.hit.how === 'allusion' ? 0.3 : 1) : 0), 0);
      lists[dest].push({ main, more: cs.filter((c) => c !== main).sort((x, y) => listOf(x) - listOf(y)), score, alludesOnly: cs.every((c) => c.hit && c.hit.how === 'allusion') });
    }
    const onBook = lists[0], whole = lists[1], other = lists[3];
    // the cited, the strongest first: those who quote or cite the chapter most; those who only allude to it last
    const cited = lists[2].sort((x, y) => (x.alludesOnly ? 1 : 0) - (y.alludesOnly ? 1 : 0) || y.score - x.score);
    const keyRows = onBook.filter((r) => keySet.has(r.main.slug)).sort((x, y) => when(x.main) - when(y.main) || keys.indexOf(x.main) - keys.indexOf(y.main));
    const restRows = onBook.filter((r) => !keySet.has(r.main.slug));
    const notes = (c) => (c.hit ? `${c.hit.how === 'allusion' ? 'alludes to' : 'cites'} ${c.hit.v.length ? `v. ${c.hit.v.slice(0, 3).join(', ')}` : 'the chapter'}, p. ${c.open}`
      : Object.keys(c.notes).length ? `${Object.keys(c.notes).length} verse notes` : 'chapter');
    const li = (c, sub, hid) => `<li class="cp-row-li${sub ? ' cp-row-sub' : ''}" data-slug="${esc(c.slug)}"${hid ? ' hidden' : ''}><button type="button" class="cp-row" aria-pressed="${!!(S.cur && S.cur.slug === c.slug)}">`
      + `<span class="cp-row-t">${esc(c.t)}</span><span class="cp-row-m">${(sub ? [volShort(c.vol), notes(c)] : [authorName(c), centuryOf(c.slug), volShort(c.vol), notes(c)]).filter(Boolean).map(esc).join(dot)}</span></button></li>`;
    const row = (r, hid) => li(r.main, false, hid) + r.more.map((c) => li(c, true, hid)).join('');
    const h = (t) => `<li class="cp-li-h" role="presentation">${esc(t)}</li>`;
    const SHOWN_CITED = 10; // the strongest ten; the rest after "Show all"
    const citedRows = cited.map((r, i) => row(r, !S.allCited && i >= SHOWN_CITED)).join('')
      + (!S.allCited && cited.length > SHOWN_CITED ? `<li class="cp-li-more" data-cp-more><button type="button" class="cp-more-btn">Show all ${cited.length}</button></li>` : '');
    const byTrad = TRADS.map(([k, label]) => [label, restRows.filter((r) => tradOf(r.main) === k)])
      .concat([['Other', restRows.filter((r) => !TRADS.some(([k]) => k === tradOf(r.main)))]]).filter(([, rs]) => rs.length);
    list.innerHTML = (keyRows.length ? h(`Key commentaries on ${bookName}`) + keyRows.map((r) => row(r)).join('') : '')
      + byTrad.map(([label, rs]) => h(keyRows.length ? `More on ${bookName}: ${label}` : `On ${bookName}: ${label}`) + rs.map((r) => row(r)).join('')).join('')
      + (whole.length ? h('On the whole Bible') + whole.map((r) => row(r)).join('') : '')
      + (cited.length ? h('Cited in commentaries on other books') + citedRows : '')
      + (other.length ? h(`Other works on ${bookName}`) + other.map((r) => row(r)).join('') : '')
      || h('No commentary on this chapter yet');
    // The key works, one click away (owner 10-19: "connect readers to what they want and should see, which is usually looking at key
    // bible book commentaries, and whole bible commentaries"): the book's curated keys, at most eight, the most needed, in the order
    // their authors came; else the curated key commentators (rank.json tier 1, then tier 2), at most five; a rule; the first two sets on
    // the whole Bible (the Glossa, the Westminster Annotations, Poole …). A chapter with neither shows its first four.
    const tierOf = (c) => (RANK.works[c.slug] || [])[4] || 0;
    const firsts = onBook.map((r) => r.main);
    const book = (keys.length ? keys.slice(0, 8) : firsts.filter((c) => tierOf(c)).sort((x, y) => tierOf(x) - tierOf(y) || y.score - x.score).slice(0, 5))
      .sort((x, y) => when(x) - when(y) || y.score - x.score);
    const strip = (book.length ? book : firsts.slice(0, 4)).concat(whole.slice(0, 2).map((r) => r.main));
    const nb = book.length || Math.min(4, firsts.length);
    pane.querySelector('.cp-keys').innerHTML = strip.length < 2 ? '' : strip.map((c, i) =>
      `${i === nb && i ? '<span class="cp-keys-sep" aria-hidden="true"></span>' : ''}<button type="button" class="cp-key" data-slug="${esc(c.slug)}" aria-pressed="${!!(S.cur && S.cur.slug === c.slug)}" title="${esc(`${c.t}${volShort(c.vol) ? ` (${volShort(c.vol)})` : ''}, ${c.a}`)}">${esc(short(c.a))}</button>`).join('');
  }

  function nameCur() {
    pane.querySelector('.cp-who').textContent = S.cur ? [authorName(S.cur), centuryOf(S.cur.slug)].filter(Boolean).join(dot) || 'Commentary' : 'No commentary';
    pane.querySelector('.cp-what').textContent = S.cur ? `${S.cur.t}${volShort(S.cur.vol) ? ` (${volShort(S.cur.vol)})` : ''}` : '';
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
  function parasOf(slug, n) { // a page's paragraphs in both lanes: the English if it has one, and the Latin
    const k = paraKey(slug, n);
    if (!cache.has(k)) {
      // a page that is not there is remembered as empty; a page that failed to load is not (it is asked for again)
      cache.set(k, page(slug, n).then((g) => (g && g.p ? [paragraphs(g.p.en), paragraphs(g.p.la)] : [[], []])).catch((err) => { console.error('Scripture pane: a page could not be read', err); cache.delete(k); return [[], []]; }));
    }
    return cache.get(k);
  }
  const resolver = A ? A.createResolver(parasOf, { verseText(v) { const el = SITE.verseEl(v); return el ? el.textContent : ''; } }) : null;
  // the work's own first (collected) or indexed target, with no page to read
  function quickTarget(v) {
    const c = S.cur; if (!c) return null;
    if (c.collected) {
      if (c.collected[v]) return { p: c.collected[v][0][1], how: 'collected', v, items: c.collected[v] };
      const next = Object.keys(c.collected).map(Number).filter((x) => x > v).sort((a, b) => a - b)[0];
      const prev = Object.keys(c.collected).map(Number).filter((x) => x < v).sort((a, b) => b - a)[0];
      const x = next != null ? next : prev;
      if (x != null) return { p: c.collected[x][0][1], how: 'collected', v: x, items: c.collected[x], nearest: true };
    }
    if (!resolver && c.notes[v] != null) return { p: c.notes[v], how: 'note', v, indexed: true }; // without the resolver, the library's index
    return null;
  }
  async function resolve(c, v, w) {
    if (resolver) return resolver.resolve(c, v, { name: w.name, ch: w.ch });
    return c.open != null ? { p: c.open, how: 'chapter' } : null; // without commentary-anchor.js: the map's opening, said to be only that
  }

  async function show(v, force) {
    S.verse = +v;
    head();
    if (SITE.name === 'mo') creeds();
    if (S.tab === 'r') paintRec();
    const w = where(); if (!S.cur || !w) return;
    const tok = ++S.token, cur = S.cur;
    const bodyEl = pane.querySelector('.cp-body'), whereEl = pane.querySelector('.cp-where');
    let t = quickTarget(S.verse);
    if (!t) {
      bodyEl.classList.add('cp-loading');
      whereEl.textContent = `Looking for its note on ${w.name || w.book} ${w.ch}:${S.verse}…`;
      if (!bodyEl.textContent.trim()) bodyEl.innerHTML = '<p class="cp-empty">Looking for the note…</p>';
      try { t = await resolve(cur, S.verse, w); } catch (err) { t = null; console.error('Scripture pane: finding the note failed', err); }
      if (tok !== S.token) return;
      if (!t && cur.open != null) t = { p: cur.open, how: 'chapter' };
    }
    if (!t) { bodyEl.classList.remove('cp-loading'); S.shown = null; paint(); return; }
    const same = S.shown && S.shown.slug === cur.slug && +S.shown.p === +t.p && S.shown.t.how === t.how && S.shown.t.v === t.v;
    S.shown = { slug: cur.slug, p: +t.p, t, book: w.book, ch: w.ch };
    if (same && !force) return paint(true);
    bodyEl.classList.add('cp-loading');
    // a large volume takes a few seconds to open: say what is coming rather than show an empty page
    if (!bodyEl.textContent.trim() || !same) {
      whereEl.textContent = `Opening ${cur.a || cur.t} on ${w.name || w.book} ${w.ch}:${t.v || S.verse}, p. ${t.p}…`;
      if (!bodyEl.textContent.trim()) bodyEl.innerHTML = `<p class="cp-empty">${PG.EEBO.test(cur.slug) ? 'Opening the book (a large file, loaded once)…' : 'Opening the page…'}</p>`;
    }
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
    const bookName = (where() || {}).name || sh.book.replace(/-/g, ' ');
    const {t} = sh, read = SITE.read(sh.slug, sh.p), ref = (n) => `${bookName} ${sh.ch}:${n}`;
    const say = t.how === 'note' ? `Its note on ${ref(t.v)}`
      : t.how === 'page' ? `Its comment on ${ref(t.v)} is on this page`
      : t.how === 'later' ? `No separate note on ${sh.ch}:${S.verse}. Its next note is on ${ref(t.v)}`
      : t.how === 'nearest' ? `No separate note on ${sh.ch}:${S.verse}. Its closest earlier note is on ${ref(t.v)}`
      : t.how === 'chapter' ? `No note on ${ref(S.verse)} was found. This is where it opens ${bookName} ${sh.ch}` : 'Reading on';
    whereEl.innerHTML = `<span>${esc(say)}</span>${dot}<span class="cp-pg">p. ${sh.p}</span>${dot}<a href="${read}">Open in the reader</a>`;
    const pages = sh.pages || [];
    if (!pages.length) { body.innerHTML = '<p class="cp-empty">This page could not be loaded.</p>'; return; }
    if (t.how === 'collected') return paintCollected(sh, t, bookName, body, whereEl);
    const hasEn = pages.some((p) => p.en), lane = S.lang === 'la' || !hasEn ? 'la' : 'en';
    pane.querySelector('.cp-lang').hidden = !(hasEn && pages.some((p) => p.la));
    const printed = (S.cur && S.cur.pv && S.cur.pv[t.v]) || t.v;
    // the pages as one run of paragraphs, so a note that crosses the page break is one note
    const all = [], pageOf = [];
    pages.forEach((p, i) => { paragraphs(p[lane] || p.la || p.en).forEach((s) => { all.push(s); pageOf.push(i); }); });
    let h = -1;
    if (t.how === 'note' || t.how === 'later' || t.how === 'nearest' || t.how === 'page') {
      if (A) h = A.findNote(all, printed, !!t.indexed);
      // a page the library indexed as holding the note keeps the older reading if the stricter one finds none
      if (h < 0 && t.indexed) h = all.findIndex((s) => noteRx(printed).test(s));
    }
    const from = h > 0 ? h : 0;
    // the editors' textual notes of a scholarly edition (variant readings, line numbers) are set apart, and do not count toward what is shown
    const app = A ? A.apparatusIndexes(all) : new Set();
    const shown = (n) => { let seen = 0, j = 0; for (; j < all.length && seen < n; j += 1) if (!app.has(j)) seen += 1; while (j < all.length && app.has(j)) j += 1; return j; };
    const to = h >= 0 ? (A ? A.noteEnd(all, h, printed, 14) : Math.min(all.length, h + 8)) : (t.how === 'browse' ? all.length : shown(14));
    const sig = siglaOf(sh.slug);
    const withSigla = (txt) => {
      if (!sig) return { html: esc(txt), who: [] };
      const who = [];
      const html = esc(txt).replace(sig.rx, (m0, pre, k) => { const n = sig.sg[k]; if (n && !who.includes(n)) who.push(n); return `${pre}<abbr title="${esc(n)}">${k}</abbr>`; });
      return { html, who };
    };
    const one = (s, i) => {
      if (app.has(i)) { // set small and plain, with no critics' sigla marked up: these are the editors' lines, not the commentary
        const pb = i && pageOf[i] !== pageOf[i - 1] ? `<div class="cp-break"><span>p. ${pages[pageOf[i]].n}</span></div>` : '';
        return `${pb}<p>${esc(s)}</p>`;
      }
      const head1 = /^#{1,6}\s+/.test(s); // the page's own heads ("### CAPUT V.") are set as heads, not printed with their marks
      const x = withSigla(head1 ? s.replace(/^#{1,6}\s+/, '') : s);
      const brk = i && pageOf[i] !== pageOf[i - 1] ? `<div class="cp-break"><span>p. ${pages[pageOf[i]].n}</span></div>` : '';
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
    whereEl.innerHTML = `<span>${t.nearest ? `No critic on ${sh.ch}:${S.verse}. ` : ''}${crit} ${crit === 1 ? 'critic' : 'critics'} on ${esc(bookName)} ${sh.ch}:${t.v}</span>`
      + `${dot}<a href="${esc(SITE.read(sh.slug, t.items[0][1]))}">Open in the reader</a>`;
    const anyEn = Object.values(sh.byPage || {}).some((p) => p && p.en), lane = S.lang === 'la' || !anyEn ? 'la' : 'en';
    pane.querySelector('.cp-lang').hidden = !anyEn;
    const rxV = noteRx(t.v);
    const firstOf = new Map(); t.items.forEach(([who], i) => { if (!firstOf.has(who)) firstOf.set(who, i); });
    const idx = `<p class="cp-index">${[...firstOf].map(([who, i]) => `<a href="#cp-c${i}" data-cp-jump="${i}">${esc(who)}</a>`).join(', ')}</p>`;
    body.innerHTML = idx + t.items.map(([who, pn, k, pv], i) => {
      const rx = pv ? noteRx(pv) : rxV; // a critic's own number for the verse, where his numbering counts the psalm's title
      const p = (sh.byPage || {})[pn]; if (!p) return '';
      const pick = (ln) => paragraphs(p[ln]).filter((x) => rx.test(x))[k] || paragraphs(p[ln]).filter((x) => rx.test(x))[0];
      let note = (pick(lane) || pick(lane === 'en' ? 'la' : 'en') || '').replace(/^#{1,6}\s+/, '');
      if (note.length > 1100) note = `${note.slice(0, 1100).replace(/\s+\S*$/, '')} …`;
      return `<section class="cp-crit" id="cp-c${i}"><h4><span>${esc(who)}</span><a href="${esc(SITE.read(sh.slug, pn))}">p. ${pn}</a></h4>`
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
    S.rec = null; S.pin = false; S.allCited = false; // a new chapter: the rail follows the reading line again
    const [list, rec, hits] = await Promise.all([commentaries(w.book, w.ch), recOf(w.book, w.ch), hitsOf(w.book, w.ch)]);
    // the hits join the list as works the pane can open at their page (wb 2: a list of their own, never a key)
    const have = new Set(list.map((c) => c.slug));
    for (const x of hits) {
      if (have.has(x.w)) continue;
      list.push({ slug: x.w, a: x.a || '', t: x.t || x.w, notes: {}, open: x.p, rows: {}, hit: { v: x.v || [], n: x.n, g: x.g, how: x.how || '' }, sh: x.sh, wb: 2, score: 0 });
      S.cen[x.w] = x.cen || 0;
    }
    S.list = list; S.rec = rec;
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
    const c = (want && (keys.find((x) => x.a === want) || S.list.find((x) => x.a === want))) || keys[0] || S.list[0];
    S.verse = w.v || 1;
    head();
    if (SITE.name === 'mo') creeds();
    choose(c ? c.slug : null);
    S.firstEl = document.querySelector(SITE.verses);
    watch();
  }
  const kick = () => { clearTimeout(kick.t); kick.t = setTimeout(init, 250); };
  window.addEventListener('hashchange', kick); window.addEventListener('popstate', kick);
  new MutationObserver((ms) => { if (ms.some((m) => !pane || !pane.contains(m.target))) kick(); })
    .observe(document.body, { childList: true, subtree: true });
  kick();
})();
