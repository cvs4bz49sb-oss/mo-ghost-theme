/* THE COMMENTARIES, BOOK BY BOOK (2026-11-08, owner: "integrate the commentaries and controversies (thomists vs scotist) pages in the
 * mereO site"; the plan: "a Commentaries page on Mere Orthodoxy: every Bible commentary we hold, by book and by tradition, plus the
 * whole-Bible sets. Each row opens the Scripture desk at that book with that commentary already open. It must look and behave like part
 * of the Scripture desk").
 *
 * /the-faith-received/commentaries/?book=<book>: the book chosen as the Scripture desk chooses it (Old Testament, New Testament,
 * Apocrypha, then the book; scripture-dev-core.js SECTIONS), and the book's commentaries in the Change list's grammar
 * (scripture-verse-rail.js, the .vr- directory): the key commentaries first in the curated order (rank.json `books`), then the rest by
 * tradition, an author once with his works under him, a work's volumes under it; beside them the whole-Bible sets by tradition. Each row
 * opens the Scripture desk at the first chapter the map places it at, that commentary open beside the text (?ref=<book>.<c>.1&cp=<slug>,
 * read by commentary-pane.js), and "Read" opens it in the reader where the Change list's row does. What goes where is
 * faith-commentaries-model.js (FRCommentaries), held to the pane's rules by scripts/check-faith-commentaries.mjs.
 *
 * A work the map places at no chapter of the book is offered in the reader only: the desk would open someone else's commentary in its
 * place. The groups are shut with their counts but the key commentaries, so the page never scrolls a list of three hundred (the Psalms);
 * the find box opens what it finds, as the Change list's does (FRVerseRail.filterDirectory). */
(function () {
  'use strict';
  const S = window.MOScriptureDev, VR = window.FRVerseRail, M = window.FRCommentaries;
  const root = document.querySelector('[data-sdc]');
  if (!root || !S || !VR || !M) return;
  const host = root.querySelector('[data-sdc-host]');
  const tabs = [...root.querySelectorAll('[data-sdc-tab]')];
  const sel = root.querySelector('[data-sdc-book]');
  const panel = root.querySelector('[data-sdc-book-panel]');
  const deskLink = root.querySelector('[data-sdc-desk]');
  const say = root.querySelector('[data-sdc-say]');
  if (!host || !sel) return;
  const lm = document.querySelector('meta[name="tfr-library-base"]');
  const BASE = ((lm && lm.content) || 'https://mo-tfr-library.mo-podcast-feed.workers.dev').replace(/\/$/, '');
  const { esc, fmt } = S;
  const DOT = ' · ';
  const TITLE_TAIL = ' | The Faith Received | Mere Orthodoxy';

  // JSON, gzipped or not: the library worker serves the .json.gz files already opened, the Blob base as their bytes (commentary-pane.js)
  const cache = new Map();
  function json(u) {
    if (cache.has(u)) return cache.get(u);
    const p = fetch(u, { credentials: 'omit' }).then(async (r) => {
      if (!r.ok) throw new Error(`${r.status} ${u}`);
      const buf = new Uint8Array(await r.arrayBuffer());
      const text = buf[0] === 0x1f && buf[1] === 0x8b
        ? await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
        : new TextDecoder().decode(buf);
      return JSON.parse(text);
    });
    // a failed fetch is asked again, not remembered
    p.catch(() => { if (cache.get(u) === p) cache.delete(u); });
    cache.set(u, p);
    return p;
  }
  // the map and the standing are needed; the sets and the dates of names make the page fuller, and it stands without them
  let DATA = null;
  const load = () => Promise.all([
    json(`${BASE}/v1/devotion.json.gz`), json(`${BASE}/v1/scripture/rank.json`),
    json(`${BASE}/v1/scripture/sets.json`).catch(() => null), json(`${BASE}/v1/enrich/author_dates.json`).catch(() => null),
  ]).then(([dev, rank, sets, ad]) => {
    DATA = { dev, rank, sets, dates: M.datesMap(ad), counts: {} };
    // each book's count in the chooser is the rows its page lists (the two lists' counts added), so the numbers agree
    for (const b of S.BOOKS) DATA.counts[b.lib] = modelOf(b).n.all;
    return DATA;
  });
  const models = new Map();
  const modelOf = (book) => {
    if (!models.has(book.lib)) models.set(book.lib, M.build({ book, entries: (DATA.dev.books || {})[book.lib] || [], rank: DATA.rank, sets: DATA.sets, dates: DATA.dates, VR }));
    return models.get(book.lib);
  };

  // ── the address: ?book=<the desk's slug> ("romans", "1-corinthians"); the Scripture desk's spellings read too ("rom", "i-corinthians")
  const bookOfAddress = () => { const q = new URLSearchParams(location.search).get('book'); return (q && S.bookFrom(q)) || null; };
  const sectionOf = (book) => (book ? book.section : 'ot');
  const bookName = (book) => (book.slug === 'psalms' ? 'the Psalms' : book.name);
  let BOOK = null;

  // ── the bar: the three divisions as the Scripture desk has them, the book's select scoped to the division showing ──────────────
  function paintBar(book) {
    const k = sectionOf(book);
    tabs.forEach((t) => {
      const on = t.dataset.sdcTab === k;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && panel) panel.setAttribute('aria-labelledby', t.id);
    });
    const sec = S.SECTIONS.find((x) => x.k === k) || S.SECTIONS[0];
    const counts = (DATA && DATA.counts) || {};
    sel.innerHTML = sec.books.map((b) => {
      const n = counts[b.lib];
      return `<option value="${esc(b.slug)}"${b === book ? ' selected' : ''}>${esc(b.name)}${n ? ` (${fmt(n)})` : ''}</option>`;
    }).join('');
    if (deskLink && book) {
      deskLink.href = `/the-faith-received/scripture/?ref=${book.slug}.1`;
      deskLink.textContent = `Read ${book.slug === 'psalms' ? 'the Psalms' : book.name}`;
    }
  }

  // ── the rows (scripture-verse-rail.js's directory, as the Change list draws it) ────────────────────────────────────────────────
  const tradName = (k) => (VR.TRAD_NAME[k] && k !== 'x' ? VR.TRAD_NAME[k] : 'Other');
  // a work's title, and the one volume's name where it has one that says more than its chapters
  const titleOf = (w) => { const v = w.vols.length === 1 ? w.main.label : ''; return `${w.main.t}${v && v !== w.cover ? `${DOT}${v}` : ''}`; };
  const printed = (x) => (x.tl && x.tl !== x.t ? ` title="${esc(`As printed: ${x.tl}`)}"` : '');
  // the volumes of one work: each opens beside the text where the map places it, else in the reader; each named apart (volLabels)
  function volChips(vols) {
    if (vols.length < 2) return '';
    const names = M.volLabels(vols, BOOK);
    return `<p class="vr-e-vols"><span>${fmt(vols.length)} volumes</span>${vols.map((v, i) => (v.desk
      ? `<a class="vr-e-vol" href="${esc(v.desk)}" aria-label="${esc(`Open ${names[i]} in Scripture`)}">${esc(names[i])}</a>`
      : `<a class="vr-e-vol" href="${esc(v.read)}" aria-label="${esc(`Read ${names[i]} in the reader`)}">${esc(names[i])}</a>`)).join('')}</p>`;
  }
  /* ONE ROW A WORK. The row is the way in, and says so (owner 2026-11-07: "too many clicks"): its title as a link, "Open in Scripture" in
   * the outline the Change list's Read wears, and "Read" at the end opening the reader, in the same place on every row. The outlined
   * label is a cell of its own beside the row's link (the same address, kept for the eye and the finger and hidden from a screen reader,
   * which has the row), so on a phone it stands beside Read under the title instead of taking a line of its own. A work the desk cannot
   * open says what the map lacks, has no "Open in Scripture", and its row reads it in the reader. */
  function row(x) {
    const { main } = x;
    const meta = [x.cover || 'Chapters not mapped', x.tag || ''].filter(Boolean).join(DOT);
    const who = x.who ? `<span class="vr-a">${esc(x.who)}${x.years ? `<span class="sdc-y">${esc(x.years)}</span>` : ''}</span>` : '';
    const body = `${who}<span class="vr-e-t"${printed(main)}>${esc(x.title)}</span><span class="vr-e-m">${esc(meta)}</span>`;
    const head = main.desk
      ? `<a class="vr-e-read" href="${esc(main.desk)}" aria-label="${esc(`Open in Scripture: ${x.title}${x.who ? `, ${x.who}` : ''}`)}">${body}</a>`
        + `<a class="vr-e-go" href="${esc(main.desk)}" tabindex="-1" aria-hidden="true">Open in Scripture</a>`
        + `<a class="vr-e-pg" href="${esc(main.read)}" aria-label="${esc(`Read ${x.title} in the reader`)}">Read</a>`
      : `<a class="vr-e-read" href="${esc(main.read)}" aria-label="${esc(`Read ${x.title}${x.who ? `, ${x.who}` : ''}, in the reader`)}">${body}</a><span></span>`
        + `<a class="vr-e-pg" href="${esc(main.read)}" tabindex="-1" aria-hidden="true">Read</a>`;
    return `<li class="vr-e${x.who ? ' vr-e-solo' : ''}" data-find="${esc(x.find)}"><div class="vr-e-row sdc-row${main.desk ? '' : ' sdc-noplace'}">${head}</div>${volChips(x.vols)}</li>`;
  }
  const workRow = (w, au, solo, tag) => row({ main: w.main, vols: w.vols, cover: w.cover, title: titleOf(w), who: solo ? au.name : '', years: solo ? au.years : '',
    tag, find: `${w.find} ${solo ? '' : VR.authorKey(au.a)}` });
  const fold = (id, cls, head, n, body, open) => `<li class="${cls}"><button type="button" class="vr-fold-btn" data-vr-fold="${esc(id)}" aria-expanded="${!!open}">${head}<span class="vr-fold-n">${esc(n)}</span></button>`
    + `<ul class="vr-fold-list"${open ? '' : ' hidden'}>${body}</ul></li>`;
  // an author: one work is one row; several are his fold, shut unless asked open (the key commentators' are open, as the Change list
  // opens an author's several key works)
  function author(au, gid, opts) {
    const tag = opts.tag ? tradName(au.trad) : '';
    if (au.works.length === 1) return workRow(au.works[0], au, true, tag);
    const head = `<span class="vr-a">${esc(au.name)}</span>${au.years ? ` <span class="vr-k">${esc(au.years)}</span>` : ''}${tag ? ` <span class="vr-k">${esc(tag)}</span>` : ''}`;
    return fold(`a:${gid}:${au.key}`, 'vr-au-g', head, `${fmt(au.works.length)} works`, au.works.map((w) => workRow(w, au, false, '')).join(''), !!opts.open);
  }
  // a whole-Bible set: one row, its volumes on the book under it
  const setRow = (r) => row({ main: r.main, vols: r.vols, cover: r.cover, title: `${r.set.title}${r.vols.length === 1 && r.main.label && r.main.label !== r.cover ? `${DOT}${r.main.label}` : ''}`,
    who: r.name, years: r.years, tag: '', find: r.find });
  const group = (id, name, n, body, open) => fold(id, 'vr-tg', `<span class="vr-tg-name">${esc(name)}</span>`, fmt(n), body, open);

  function render(book) {
    const m = modelOf(book);
    document.title = `Commentaries on ${bookName(book)}${TITLE_TAIL}`;
    if (say) say.textContent = `${book.name}: ${fmt(m.n.all)} ${m.n.all === 1 ? 'work' : 'works'}`;
    if (!m.n.all) { host.innerHTML = '<p class="sdc-status">No commentaries on this book are held yet.</p>'; return; }
    const bookList = (m.keys.length ? group('g:keys', 'Key commentaries', m.n.keys, m.keys.map((au) => author(au, 'keys', { tag: true, open: true })).join(''), true) : '')
      + m.groups.map((g) => group(`t:${g.key}`, g.name, g.n, g.authors.map((au) => author(au, `t${g.key}`, {})).join(''), false)).join('')
      + (m.other.length ? group('g:other', 'Sermons and other works', m.n.other, m.other.map((au) => author(au, 'other', { tag: true })).join(''), false) : '');
    // beside the book's list on a desk's width the sets stand open, a column of them (some thirty at most); stacked under it on a
    // narrower screen they are shut with their counts, so the page does not run on
    const wholeOpen = !!(window.matchMedia && window.matchMedia('(min-width: 1080px)').matches);
    const wholeList = m.whole.map((g) => group(`w:${g.key}`, g.name, g.n, g.rows.map((r) => (r.kind === 'set' ? setRow(r) : author(r.au, `w${g.key}`, {}))).join(''), wholeOpen)).join('');
    const nBook = m.n.commentaries + m.n.other;
    const find = `<div class="vr-dir-find sdc-find"><input type="search" placeholder="Find a commentator or work" aria-label="${esc(`Find a commentary on ${bookName(book)}`)}" autocomplete="off" spellcheck="false"></div>`;
    const onBook = nBook ? `<section class="sdc-col" aria-labelledby="sdc-h-book"><h2 class="sdc-h" id="sdc-h-book">Commentaries on ${esc(bookName(book))}<span class="sdc-n">${fmt(nBook)}</span></h2><ul class="vr-dir-list">${bookList}</ul></section>` : '';
    const onWhole = m.n.whole ? `<section class="sdc-col" aria-labelledby="sdc-h-whole"><h2 class="sdc-h" id="sdc-h-whole">Whole-Bible commentaries<span class="sdc-n">${fmt(m.n.whole)}</span></h2><ul class="vr-dir-list">${wholeList}</ul></section>` : '';
    host.innerHTML = `<div class="vr-dir sdc-dir">${find}<div class="sdc-cols">${onBook}${onWhole}</div><p class="vr-empty vr-dir-none" hidden>No commentary matches.</p></div>`;
  }

  // ── choosing a book ───────────────────────────────────────────────────────────────────────────────────────────────────────────
  function show(book, how) {
    BOOK = book;
    paintBar(book);
    if (how === 'push') {
      const u = new URL(location.href);
      u.searchParams.set('book', book.slug);
      history.pushState({ book: book.slug }, '', `${u.pathname}${u.search}${u.hash}`);
    }
    if (DATA) render(book);
  }
  sel.addEventListener('change', () => { const b = S.BOOK_BY_SLUG.get(sel.value); if (b) show(b, 'push'); });
  /* The divisions are tabs, as on the Scripture desk: one activates on a click or Enter and opens the division's first book (the desk's
   * tabs load a chapter the same way); the arrow keys move between them. */
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => {
      const sec = S.SECTIONS.find((x) => x.k === t.dataset.sdcTab);
      if (sec && sectionOf(BOOK) !== sec.k) show(sec.books[0], 'push');
    });
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      next.focus();
    });
  });
  window.addEventListener('popstate', () => show(bookOfAddress() || S.BOOKS[0], 'none'));
  // the folds and the find box, as the Change list wires them (the rows here are links: nothing to read beside the text in place)
  VR.wireDirectory(host, {});
  // while a search is in the box, a list with nothing found in it steps aside, so the found rows are not set beside an empty card
  const sideCols = () => {
    const box = host.querySelector('.sdc-find input'), q = box ? box.value.trim() : '';
    host.querySelectorAll('.sdc-col').forEach((col) => { col.hidden = !!q && !col.querySelector('.vr-dir-list > li:not([hidden])'); });
  };
  host.addEventListener('input', (e) => { if (e.target.closest('.sdc-find')) sideCols(); });
  // Escape empties the box in the Change list's own handler, without an input event
  host.addEventListener('keydown', (e) => { if (e.key === 'Escape' && e.target.closest('.sdc-find')) requestAnimationFrame(sideCols); });

  function start() {
    host.innerHTML = '<p class="sdc-status" role="status">Loading the commentaries…</p>';
    load().then(() => { paintBar(BOOK); render(BOOK); }).catch(() => {
      host.innerHTML = '<p class="sdc-status">The commentaries could not be loaded. <button type="button" class="sd-clear" data-sdc-retry>Try again</button></p>';
    });
  }
  host.addEventListener('click', (e) => { if (e.target.closest('[data-sdc-retry]')) start(); });
  show(bookOfAddress() || S.BOOKS[0], 'none');
  start();
})();
