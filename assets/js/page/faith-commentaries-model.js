/* THE COMMENTARIES, BOOK BY BOOK: THE MODEL (2026-11-08, owner: "integrate the commentaries and controversies (thomists vs scotist)
 * pages in the mereO site", then "run the recommendations, and the plan"; the plan: "a Commentaries page on Mere Orthodoxy: every Bible
 * commentary we hold, by book and by tradition, plus the whole-Bible sets. Each row opens the Scripture desk at that book with that
 * commentary already open. It must look and behave like part of the Scripture desk").
 *
 * No DOM: faith-commentaries.js draws what this returns, and scripts/check-faith-commentaries.mjs holds it to the Scripture desk's own
 * rules. Its data are the files the desk's commentary pane reads (commentary-pane.js, commentary-pages.js):
 *   v1/devotion.json.gz      the map: per book (the library's name for it, `lib`: i-corinthians, revelation-of-john) every work with
 *                            the chapters it holds and the page each opens at (an), the reader's page id where a print repeats its page
 *                            numbers (ar), where the book begins in a whole-Bible volume (sp), its shelf (sh, tr) and kind (k);
 *   v1/scripture/rank.json   the curated standing (works: [weight, whole-Bible, century, ., tier]), and the key commentaries on each book
 *                            in the order to open them (books: [author, [slugs], year]);
 *   v1/scripture/sets.json   the whole-Bible sets (Lapide, Poole's Synopsis, the Critici Sacri, the Glossa ...), by tradition and year;
 *   v1/enrich/author_dates.json   the years of a name (2,799 names as the surfaces spell them).
 * The names, the tradition labels and the folding of volumes are the verse rail's (scripture-verse-rail.js, FRVerseRail): one taxonomy
 * for the Change list and this page.
 *
 * WHERE A ROW OPENS (nothing here guesses). The Scripture desk reads a commentary named in its address (?ref=<book>.<c>.<v>&cp=<slug>)
 * only when the chapter's list holds it, and a map entry is in a chapter's list only where the map gives its page there (an), or, for a
 * work the rank calls whole-Bible, where the book begins in it (sp, the chapter its range starts at). So a row opens at the first
 * chapter the map places it at; a work the map places at no chapter of the book (676 of the 790 such entries are Migne volumes filed
 * under a book with no chapter pages) is offered in the reader only, never as "Open in Scripture" landing on someone else's commentary.
 * The reader opens where the Change list's row does (dirRead in commentary-pane.js): the chapter's page, the reader's own page id for
 * it in a book whose page numbers repeat (ar), at the chapter's printed heading (?at=ch:<c>) except in the Psalms, whose numbering
 * differs between prints. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FRCommentaries = api;
}(typeof window !== 'undefined' ? window : globalThis, () => {
  'use strict';

  const SCRIPTURE = '/the-faith-received/scripture/';
  const READER = '/the-faith-received/read/';
  // the map's tradition for a work it leaves on no shelf ('x'): kept in step with X_SHELF in commentary-pages.js
  const X_SHELF = { Reformed: 'rf', 'Continental Reformed': 'rf', 'Roman Catholic': 'rc', Lutheran: 'lu', Medieval: 'md', 'English Divines': 'ed',
    'Humanism & Law': 'hl', 'Humanism and Law': 'hl' };
  // a Father in Migne or the Patrologia Orientalis is on the shelf of his Patrologia (commentary-pane.js famShelf)
  const famShelf = (slug) => { const m = /^(pld|pg|po)-/.exec(slug || ''); return m ? { pld: 'pl', pg: 'gf', po: 'po' }[m[1]] : ''; };
  /* A WORK'S TRADITION, as the Scripture desk files it: kept in step with tradOf in commentary-pane.js and scripture-dev-core.js. The
   * shelf (or the map's tradition where it gives no shelf, or the Patrologia's), and the century: a Latin writer from the 8th century
   * through the 15th is Medieval, a Greek from the 9th Byzantine, a later editor on either shelf Other. The century is the rank's for
   * the work; where the rank has none, the author's from his dates (born, and forty years on), as near as the page can know it. */
  function tradOf(e, cen) {
    let sh = e.sh === 'x' ? (X_SHELF[e.tr] || 'x') : (e.sh || '');
    if (!sh || sh === 'x') sh = famShelf(e.w) || sh;
    if (sh === 'pl') return cen >= 16 ? 'x' : cen >= 8 ? 'md' : sh;
    if (sh === 'gf') return cen >= 16 ? 'x' : cen >= 9 ? 'by' : sh;
    return sh || 'x';
  }
  /* A WORK WHOSE TITLE NAMES ONE BOOK belongs to that book's list, not the whole Bible's (Baxter's and Hammond's Psalms, Bucer on
   * Romans in his set): kept in step with namesOneBook in commentary-pane.js and titleBook in scripture-dev-core.js. */
  const BOOK_RX = /\b(Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|Samuel|Kings|Chronicles|Ezra|Nehemiah|Esther|Job|Psalms?|Proverbs|Ecclesiastes|Canticles?|Song of (?:Songs|Solomon)|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|Corinthians|Galatians|Ephesians|Philippians|Colossians|Thessalonians|Timothy|Titus|Philemon|Hebrews|James|Peter|Jude|Revelation|Apocalypse)\b/gi;
  const WHOLE_WORDS = /\b(?:all|whole|entire|every)\b|\bBible\b|\bTestaments?\b|\bGospels\b|\bScriptures?\b|\bPentateuch\b|\bEpistles\b|\bbooks\b/i;
  const namesOneBook = (t) => {
    const found = new Set();
    String(t || '').replace(BOOK_RX, (m) => { found.add(m.toLowerCase().replace(/^psalm$/, 'psalms').replace(/^(?:canticle|song).*$/, 'song')); return m; });
    return found.size === 1 && !WHOLE_WORDS.test(t || '');
  };
  // the kinds that are not commentaries (scripture-dev-core.js NOT_COMMENTARY), and a reference work outside the sets
  const NOT_COMMENTARY = new Set(['law', 'letters', 'polemical', 'treatises', 'devotional', 'poetry', 'catechetical', 'reference']);
  const ord = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')}`;
  const foldText = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const titleVolume = (t) => { const x = /\b(Vol(?:ume)?|Tom(?:us)?)\.?\s+([IVXLC]+|\d+)\b/.exec(String(t || '')); return x ? `${/^T/.test(x[1]) ? 'Tom.' : 'Vol.'} ${x[2]}` : ''; };

  /* WHERE THE DESK OPENS A MAP ENTRY (the rule above): the first chapter of the book the map gives a page for, inside the entry's range
   * (commentary-pages.js listWorks reads a chapter from c1, else 1, to c2, else 999) and inside the book; else, for a work the rank calls
   * whole-Bible with the book's start in it (commentary-pane.js, the `sp` rule), the first chapter of its range at that page. */
  function place(e, book, rank) {
    const lo = Number(e.c1) || 1, hi = Number(e.c2) || 999, max = Number(book.chapters) || 999, an = e.an || {};
    const ks = Object.keys(an).map(Number).filter((k) => Number.isInteger(k) && k >= lo && k <= hi && k <= max && an[k] != null && an[k] !== '')
      .sort((a, b) => a - b);
    if (ks.length) {
      const fc = ks[0];
      return { fc, p: an[fc], rp: e.ar && e.ar[fc] != null ? e.ar[fc] : an[fc], own: true, chs: ks };
    }
    const c1 = Number(e.c1);
    if (c1 > 0 && c1 <= max && !(Number(e.c2) < c1) && e.sp != null && ((rank.works[e.w] || [])[1] === 1)) return { fc: c1, p: e.sp, rp: e.sp, own: false, chs: [] };
    return null;
  }
  // the Scripture desk at the chapter, its first verse in view, the commentary open beside it (the pane's cp=<slug>)
  const deskHref = (book, c, slug) => `${SCRIPTURE}?ref=${book.slug}.${c}.1&cp=${encodeURIComponent(slug)}`;
  // the reader, as the Change list's row opens it (commentary-pane.js dirRead through SITE.read); no page known: the work's start
  const readHref = (slug, p, at) => (p == null || p === '' ? `${READER}?w=${encodeURIComponent(slug)}`
    : `${READER}?w=${encodeURIComponent(slug)}${at ? `&at=${encodeURIComponent(at)}` : ''}#b${encodeURIComponent(p)}-0`);
  // what a row covers of the book: "Chapters 1–16", "Chapter 5", "Psalms 1–41", "Psalm 51"
  function coverage(chs, book) {
    if (!chs.length) return '';
    const a = chs[0], b = chs[chs.length - 1], ps = book.slug === 'psalms';
    if (a === b) return `${ps ? 'Psalm' : 'Chapter'} ${a}`;
    return `${ps ? 'Psalms' : 'Chapters'} ${a}–${b}`;
  }

  /* build({book, entries, rank, sets, dates, VR}) -> the page's groups.
   *   book     the Scripture desk's book (scripture-dev-core.js BOOKS: slug, lib, name, chapters)
   *   entries  the map's entries on it (devotion.json.gz books[book.lib])
   *   rank, sets   rank.json, sets.json as served
   *   dates    Map of a name (and its aliases) to {y, dates}, from author_dates.json
   *   VR       the verse rail (FRVerseRail): properName, authorKey, workKey, slugVolume, TRADS, TRAD_NAME
   * Returns {book, keys, groups: [{key, name, authors, n}], whole: [{key, name, rows, n}], other, n: {...}}. Every work carries vols,
   * each vol its place (or null) and its two links. */
  function build(input) {
    const { book, VR } = input;
    const rank = { works: {}, authors: {}, books: {}, ...(input.rank || {}) };
    const SETOF = (input.sets && input.sets.of) || {}, SETS = new Map(((input.sets && input.sets.sets) || []).map((s) => [s.id, s]));
    const dates = input.dates || new Map();
    const { TRADS, TRAD_NAME } = VR;
    const tradIndex = (k) => { const i = TRADS.findIndex(([x]) => x === k); return i < 0 ? TRADS.length : i; };
    const keyAt = new Map();
    const keyBorn = new Map();
    (rank.books[book.lib] || []).forEach(([, slugs, born]) => (slugs || []).forEach((s) => { if (!keyAt.has(s)) { keyAt.set(s, keyAt.size); keyBorn.set(s, Number(born) || 0); } }));
    const dateOf = (a) => dates.get(a) || dates.get(VR.properName(a)) || null;
    const standing = (w, a) => { const r = rank.works[w]; return r ? Number(r[0]) || 0 : Number(rank.authors[a]) || 0; };
    const centuryOf = (w, a) => {
      const r = rank.works[w]; if (r && Number(r[2]) > 0) return Number(r[2]);
      const d = dateOf(a); return d && Number(d.y) > 0 ? Math.floor((Number(d.y) + 40 - 1) / 100) + 1 : 0;
    };

    // one volume a work on the map (the map may list a volume twice on a book, as two pieces: their chapters are taken together)
    const byW = new Map();
    for (const e of input.entries || []) { if (e && e.w) { if (!byW.has(e.w)) byW.set(e.w, []); byW.get(e.w).push(e); } }
    const vols = [];
    for (const [w, es] of byW) {
      let best = null;
      for (const e of es) { const pl = place(e, book, rank); if (pl && (!best || pl.fc < best.pl.fc)) best = { e, pl }; }
      const e = best ? best.e : es[0], pl = best ? best.pl : null;
      // the chapters the map gives pages for; a volume known only by where the book begins in it (sp) claims none (the Change list's
      // "Chapter N not mapped")
      const chs = [...new Set(es.flatMap((x) => { const q = place(x, book, rank); return q ? q.chs : []; }))].sort((a, b) => a - b);
      const fc = pl ? pl.fc : 0;
      // a volume of collected works is named by the piece that holds the chapter (map st/stc), its volume beside it (commentary-pages.js)
      const piece = (fc && e.stc && e.stc[fc]) || e.st || '';
      const tl = (fc && e.stcl && e.stcl[fc]) || e.stl || '';
      const cov = Object.keys(e.an || {}).length || ((Number(e.c2) || 0) - (Number(e.c1) || 0) + 1);
      const v = { slug: w, a: e.a || '', t: piece || e.t || w, tl, vol: piece ? (e.t || '') : '', k: e.k || '', e, place: pl, chs, cov,
        set: SETOF[w] || '', key: keyAt.has(w) ? keyAt.get(w) : Infinity, imp: standing(w, e.a), cen: centuryOf(w, e.a) };
      v.trad = tradOf(e, v.cen);
      v.desk = pl ? deskHref(book, pl.fc, w) : '';
      v.read = pl ? readHref(w, pl.rp, pl.own && book.slug !== 'psalms' ? `ch:${pl.fc}` : '') : readHref(w, null);
      v.label = VR.slugVolume(w) || titleVolume(v.t) || titleVolume(v.vol) || coverage(chs, book);
      vols.push(v);
    }

    /* Which part of the page a volume belongs to: a key, a set or a work the rank calls whole-Bible, a commentary on the book, the rest.
     * A volume of a set is the set's, whatever its own title, as the pane's Whole Bible row has it (setsOn in commentary-pane.js): the
     * Glossa's volumes are titled book by book ("Epistle to the Romans") and are the Glossa still. A work the rank calls whole-Bible
     * outside the sets is the book's when its title names that one book (the pane's namesOneBook, scripture-dev-core.js titleBook), the
     * piece's own title counting as the volume's: Wesley's sermon "On Romans iv. 5" in a volume the rank calls whole-Bible is a sermon on
     * Romans. */
    const inWhole = (v) => (!!v.set && SETS.has(v.set)) || ((rank.works[v.slug] || [])[1] === 1 && !namesOneBook(v.e.t || '') && !namesOneBook(v.t));
    // a set's own names find its volumes wherever they stand ("Glossa", "Poole, Synopsis"), as the Change list's find box does (alias)
    const setWords = (v) => { const s = v.set && SETS.get(v.set); return s ? `${s.label} ${s.title}` : ''; };
    const isOther = (v) => NOT_COMMENTARY.has(v.k) || (v.k === 'sermons' && !(v.cov >= 5));
    // the volumes of one work fold under it (one author with one title, or one slug stem: the verse rail's workKey)
    const worksOf = (vs) => {
      const by = new Map();
      for (const v of vs) { const k = VR.workKey({ slug: v.slug, a: v.a, t: v.t, vol: v.vol }); if (!by.has(k)) by.set(k, []); by.get(k).push(v); }
      return [...by.entries()].map(([k, xs]) => {
        xs.sort((p, q) => (p.place ? p.place.fc : 1e9) - (q.place ? q.place.fc : 1e9) || q.imp - p.imp || String(p.slug).localeCompare(String(q.slug)));
        const main = xs.find((x) => x.place) || xs[0];
        const chs = [...new Set(xs.flatMap((x) => x.chs))].sort((p, q) => p - q);
        return { key: k, main, vols: xs, chs, cover: coverage(chs, book), keyAt: Math.min(...xs.map((x) => x.key)), imp: Math.max(...xs.map((x) => x.imp)),
          trad: main.trad, find: foldText([VR.properName(main.a), main.a, ...xs.map((x) => `${x.t} ${x.tl} ${x.vol} ${x.label} ${setWords(x)}`)].join(' ')) };
      });
    };
    const yearOf = (a, w) => {
      if (keyBorn.get(w)) return keyBorn.get(w);
      const d = dateOf(a); if (d && Number(d.y) > 0) return Number(d.y);
      const c = centuryOf(w, a); return c ? c * 100 - 50 : 9999;
    };
    // a work's author once: the name as the verse rail sets it, his years, the tradition most of his works are filed under (a named one
    // before Other), the order the authors came
    const authorsOf = (ws) => {
      const am = new Map();
      for (const w of ws) {
        const k = VR.authorKey(w.main.a) || w.main.slug;
        if (!am.has(k)) am.set(k, { key: k, name: VR.properName(w.main.a) || w.main.t, a: w.main.a, works: [] });
        am.get(k).works.push(w);
      }
      for (const au of am.values()) {
        au.works.sort((p, q) => p.keyAt - q.keyAt || q.imp - p.imp || (p.chs[0] || 999) - (q.chs[0] || 999) || String(p.main.t).localeCompare(String(q.main.t)));
        const n = new Map();
        for (const w of au.works) n.set(w.trad, (n.get(w.trad) || 0) + (w.trad === 'x' ? 0.5 : 1));
        au.trad = [...n.entries()].sort((p, q) => q[1] - p[1] || tradIndex(p[0]) - tradIndex(q[0]))[0][0];
        au.when = Math.min(...au.works.map((w) => yearOf(w.main.a, w.main.slug)));
        au.imp = Math.max(...au.works.map((w) => w.imp));
        au.keyAt = Math.min(...au.works.map((w) => w.keyAt));
        const d = dateOf(au.a), cen = Math.max(...au.works.map((w) => w.main.cen));
        au.years = d && d.dates ? d.dates : cen > 0 ? `${ord(cen)} c.` : '';
      }
      return [...am.values()];
    };
    const byWhen = (p, q) => p.when - q.when || q.imp - p.imp || p.name.localeCompare(q.name);

    // the key commentaries on the book, in the curated order (rank.json `books`), whatever else they are: the Change list's first group
    const keyVols = vols.filter((v) => v.key < Infinity);
    const keys = authorsOf(worksOf(keyVols)).sort((p, q) => p.keyAt - q.keyAt || p.when - q.when);
    const rest = vols.filter((v) => v.key === Infinity);
    // the commentaries on the book by tradition, the traditions in the verse rail's order, Other last
    const onBook = authorsOf(worksOf(rest.filter((v) => !inWhole(v) && !isOther(v))));
    const bookGroups = TRADS.map(([k]) => k).concat(['x']).map((k) => {
      const aus = onBook.filter((au) => (k === 'x' ? !TRADS.some(([t]) => t === au.trad) : au.trad === k)).sort(byWhen);
      return { key: k, name: TRAD_NAME[k] || 'Other', authors: aus, n: aus.reduce((s, au) => s + au.works.length, 0) };
    }).filter((g) => g.n);
    // the whole-Bible sets with a volume on the book, one row a set (its volumes on the book under it), by tradition and then the year it
    // was printed; then the other works the rank calls whole-Bible, in the order their authors came
    const wholeVols = vols.filter(inWhole);
    const setRows = [];
    const bySet = new Map();
    for (const v of wholeVols) if (v.set && SETS.has(v.set)) { if (!bySet.has(v.set)) bySet.set(v.set, []); bySet.get(v.set).push(v); }
    for (const [id, vs] of bySet) {
      const s = SETS.get(id);
      vs.sort((p, q) => (p.place ? p.place.fc : 1e9) - (q.place ? q.place.fc : 1e9) || String(p.slug).localeCompare(String(q.slug)));
      const chs = [...new Set(vs.flatMap((x) => x.chs))].sort((p, q) => p - q);
      const d = dateOf(s.author);
      setRows.push({ kind: 'set', key: `set:${id}`, set: s, trad: s.trad || 'x', year: Number(s.year) || 0, main: vs.find((x) => x.place) || vs[0], vols: vs, chs,
        cover: coverage(chs, book), name: VR.properName(s.author) || s.author || s.label, years: d && d.dates ? d.dates : s.year ? `${s.year}` : '',
        find: foldText([s.label, s.title, s.author, ...vs.map((x) => `${x.t} ${x.label}`)].join(' ')) });
    }
    const loose = authorsOf(worksOf(wholeVols.filter((v) => !(v.set && SETS.has(v.set)))));
    const whole = TRADS.map(([k]) => k).concat(['x']).map((k) => {
      const inK = (t) => (k === 'x' ? !TRADS.some(([x]) => x === t) : t === k);
      const rows = setRows.filter((r) => inK(r.trad)).sort((p, q) => p.year - q.year || p.name.localeCompare(q.name))
        .concat(loose.filter((au) => inK(au.trad)).sort(byWhen).map((au) => ({ kind: 'author', key: `a:${au.key}`, au })));
      return { key: k, name: TRAD_NAME[k] || 'Other', rows, n: rows.reduce((s, r) => s + (r.kind === 'set' ? 1 : r.au.works.length), 0) };
    }).filter((g) => g.n);
    // the rest: sermons on a passage or two, treatises, letters and the like that the map files under the book
    const other = authorsOf(worksOf(rest.filter((v) => !inWhole(v) && isOther(v)))).sort(byWhen);

    const count = (aus) => aus.reduce((s, au) => s + au.works.length, 0);
    const n = { keys: count(keys), book: bookGroups.reduce((s, g) => s + g.n, 0), whole: whole.reduce((s, g) => s + g.n, 0), other: count(other), vols: vols.length };
    n.commentaries = n.keys + n.book;
    n.all = n.commentaries + n.whole + n.other;
    return { book, keys, groups: bookGroups, whole, other, n };
  }

  /* THE VOLUMES OF ONE ROW, EACH NAMED APART (21 rows on the live map named two volumes alike: Bucer's two works on Romans both
   * "Chapters 1–16", Benson's two parts of his second volume both "Vol. 2"): the volume's own name where the names differ; else its own
   * title where the titles differ; else its name with its chapters; else its place in the row. A name for each row's list, never written
   * back: a key's volume also stands in its set's row. */
  function volLabels(vols, book) {
    const differ = (xs) => new Set(xs).size === xs.length;
    const own = vols.map((v) => v.label || v.t);
    if (differ(own)) return own;
    const ts = vols.map((v) => v.t);
    if (differ(ts)) return ts;
    const withCh = vols.map((v, i) => [own[i], v.label === coverage(v.chs, book) ? '' : coverage(v.chs, book)].filter(Boolean).join(' · '));
    if (differ(withCh)) return withCh;
    return withCh.map((x, i) => `${x} (${i + 1})`);
  }
  // the dates of names, every spelling (author_dates.json)
  const datesMap = (d) => {
    const m = new Map();
    for (const [n, x] of Object.entries((d && d.authors) || {})) { m.set(n, x); for (const al of x.aliases || []) if (!m.has(al)) m.set(al, x); }
    return m;
  };

  return { build, place, tradOf, namesOneBook, coverage, volLabels, deskHref, readHref, datesMap, X_SHELF, NOT_COMMENTARY };
}));
