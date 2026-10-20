/* THE VERSE DESK'S MODULES, BUILT FROM THE LIBRARY'S DATA (2026-10-19, owner: "push the new desks").

   Pure functions, no DOM and no network, so scripts/check-verse-desk.mjs can run them on real data for any verse. verse-desk.js loads
   the files and places what these return.

   THE RULES THIS FILE EXISTS TO KEEP (the owner found wrong claims on the live site):
     1. Every number and sentence is computed from the data by a fixed rule. The lede is composed from counts only. Nothing is
        written by a model or by hand for a particular verse.
     2. A module with no data is null here and renders nothing: it is never shown empty, "planned" or "data needed".
     3. A name is attached to a position only where the data gives a stance. The points in dispute carry NONE (a "witness" of a side is
        any page that discusses the position, including one that reports and refutes it), so a dispute side shows its position and
        "N pages discuss this position". A reading names authors only under the pages that HOLD it (FRScriptureTrust.readingModel,
        faith-port-scripture-notes.js, the same rule as the reader's panel). The ribbon and the ladder name no author as holding anything.
     4. Every link goes to something that exists: the reader (ctx.read), another verse's desk (ctx.desk), a creed's article at the
        paragraph that cites the verse.

   Data (all keyed by book and chapter, fetched once per visit by verse-desk.js):
     rec   v1/reception/scripture/<lib>/<c>.json  per verse: works, strip (century counts), eras (leading witnesses), notes
     fv    v1/enrich/scripture-readings/<lib>/<c>.json  per verse: readings (n = [holds, reports, rejects], holds), disputes
     base  v1/reception/scripture/_baseline.json  the library's usual share of each century
     rank  v1/scripture/rank.json  authors' standing; books: the curated key commentators
     cf    assets/data/faith-received/confession-proofs/ (index.json + <lib>/<c>.json)
     portraits  assets/data/faith-received/verse-desk-portraits.json (name -> picture), built by scripts/build-verse-desk-portraits.mjs */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FRVerseDeskModel = api;
}(typeof window !== 'undefined' ? window : globalThis, () => {
  'use strict';

  // The commentary anchor's own test of whether a page's gist is about a given verse (commentary-anchor.js, pure).
  const A = (() => { try { return typeof require === 'function' ? require('./commentary-anchor.js') : globalThis.FRCommentaryAnchor; } catch (e) { return globalThis.FRCommentaryAnchor || null; } })();

  // ── small helpers ─────────────────────────────────────────────────────────────────────────────────────────────────────────
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => Number(n || 0).toLocaleString('en-US');
  const plural = (n, one, many) => `${fmt(n)} ${n === 1 ? one : many}`;
  const ord = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')}`;
  const and = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
  const arr = (x) => (Array.isArray(x) ? x : []);
  // The library's machine-written prose (gists, a reading's sentence, a question) can carry an em dash; the site's copy has none, so a
  // comma stands where it was. Quoted source text (a creed's own words) and titles are left exactly as they are.
  const plain = (s) => String(s == null ? '' : s).replace(/\s*\u2014\s*/g, ', ');

  // The periods, named for a reader who does not know them (the same names as the reception history on the reader's panel).
  const ERA = {
    fathers: ['The Fathers', 'to 600'], 'early-medieval': ['Early Middle Ages', '600 to 1100'],
    scholastic: ['High and late Middle Ages', '1100 to 1500'], reformation: ['Reformation', '1500 to 1600'],
    '17th': ['Seventeenth century', '1600 to 1700'], '18th': ['Eighteenth century', '1700 to 1800'], modern: ['Modern era', 'since 1800'],
  };
  const ERA_ORDER = ['fathers', 'early-medieval', 'scholastic', 'reformation', '17th', '18th', 'modern'];
  const eraName = (e) => ERA[e.id] || [e.label || e.id, ''];
  // Five groups for the ribbon: the readings file keys its witnesses by the seven eras, and the ribbon merges the middle ones.
  const GROUPS = [
    { id: 'fathers', label: 'The Fathers', years: 'to 600', eras: ['fathers'] },
    { id: 'medieval', label: 'Medieval', years: '600 to 1500', eras: ['early-medieval', 'scholastic'] },
    { id: 'reformation', label: 'Reformation', years: '1500 to 1600', eras: ['reformation'] },
    { id: 'post', label: 'Post-Reformation', years: '1600 to 1800', eras: ['17th', '18th'] },
    { id: 'modern', label: 'Modern', years: 'since 1800', eras: ['modern'] },
  ];
  const groupOfEra = (id) => GROUPS.find((g) => g.eras.includes(id)) || null;

  // The library's usual share of each century, as faith-port-scripture-notes.js reads _baseline.json.
  function baseFrom(raw) {
    if (!raw || !Array.isArray(raw.centuries) || !raw.centuries.length) return null;
    const m = new Map(raw.centuries);
    const total = raw.centuries.reduce((a, [, n]) => a + n, 0);
    const peak = raw.centuries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
    return { share: (c) => (m.get(c) || 0) / total, peak };
  }
  // The centuries where the verse is cited half again above the library's usual share, the strongest first (at most three).
  // Identical to outliers() in faith-port-scripture-notes.js, so the desk and the reader's panel agree.
  function outliers(x, base) {
    if (!base || !x) return [];
    const out = [];
    for (const [c, n] of arr(x.strip)) {
      if (n < Math.max(3, 0.02 * x.works) || !base.share(c)) continue;
      const r = n / x.works / base.share(c);
      if (r >= 1.5) out.push([c, r]);
    }
    return out.sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => c);
  }

  /* A page's one-line gist is kept to ~180 characters upstream, so a long one ends mid-word. It is ended at a sentence if it holds
     one, else at the last whole word with an ellipsis; a gist short enough to be whole is left alone. */
  function cleanGist(g) {
    let t = plain(g).replace(/\s+/g, ' ').trim();
    if (!t) return '';
    if (/[.!?]["'”’)\]]*$/.test(t)) return t;
    if (t.length < 165) return t;
    const sentence = /^(.*[.!?]["'”’)\]]*)\s+\S[^.!?]*$/.exec(t);
    if (sentence && sentence[1].length >= 70) return sentence[1];
    t = t.replace(/\s+\S*$/, '');
    if ((t.match(/\(/g) || []).length > (t.match(/\)/g) || []).length) t = t.slice(0, t.lastIndexOf('(')).trim();
    t = t.replace(/[\s,;:\u2013\u2014-]+$/, '');
    return t ? `${t}…` : '';
  }
  // A title the catalogue cut at 80 characters can end inside a parenthesis ("(Expositio in Epistolam III S. Joa"); the open part goes.
  function cleanTitle(t) {
    let s = String(t || '').replace(/\s+/g, ' ').trim();
    if ((s.match(/\(/g) || []).length > (s.match(/\)/g) || []).length) s = s.slice(0, s.lastIndexOf('(')).trim();
    return s;
  }
  // What a page does with the verse, in the site's one vocabulary (scripture-kinds.js: quotes, cites, alludes, expounds).
  const VERB = { quotation: 'Quotes', explicit: 'Cites', allusion: 'Alludes to', exegesis: 'Expounds' };
  const lifeOf = (x) => x.d || (x.y ? `fl. c. ${x.y}` : '');

  // ── hero: the century ruler and the four tiles ────────────────────────────────────────────────────────────────────────
  function rulerModel(rv, base, label) {
    const s = arr(rv && rv.strip);
    if (s.length < 2) return null;
    const by = new Map(s);
    const lo = s[0][0], hi = s[s.length - 1][0];
    const max = Math.max(...s.map(([, n]) => n));
    const outs = outliers(rv, base), isOut = new Set(outs);
    const cols = [];
    for (let c = lo; c <= hi; c += 1) {
      const n = by.get(c) || 0;
      cols.push({
        c, n, hot: isOut.has(c),
        h: n ? Math.max(2, Math.round((n / max) * 1000) / 10) : 0,
        axis: (c === lo && (5 - (lo % 5)) % 5 >= 2) || c % 5 === 0 || (c === hi && hi % 5 >= 2),
        text: `${ord(c)} century: ${plural(n, 'work', 'works')}${isOut.has(c) ? ', cited more often than the library\'s usual share' : ''}`,
      });
    }
    const tall = cols.reduce((a, b) => (b.n > a.n ? b : a));
    const dated = s.reduce((a, [, n]) => a + n, 0);
    const parts = [`The ${ord(tall.c)} century is tallest (${fmt(tall.n)} ${tall.n === 1 ? 'work' : 'works'}).`];
    if (base && base.peak) parts.push(`The library holds the most from the ${ord(base.peak)} century, so that bar runs tall for most verses.`);
    if (outs.length) parts.push(`Colored bars are the centuries where this verse is cited more than the library's usual share.`);
    if (rv.works > dated) parts.push(`${plural(rv.works - dated, 'work carries', 'works carry')} no date and ${rv.works - dated === 1 ? 'is' : 'are'} not on the ruler.`);
    return { title: `Works citing ${label}, by century`, cols, lo, hi, tall: tall.c, tallN: tall.n, outs, caption: parts.join(' ') };
  }

  // ── creeds, confessions and catechisms (assets/data/faith-received/confession-proofs) ────────────────────────────────────────
  // The same data and the same links as the Scripture page's creeds box (commentary-pane.js: cfRank, cfPhrase, cfHref, cfWords).
  const CF_RANK = ['The Whole Church', 'Early church', 'Ecumenical', 'Orthodox', 'Eastern Orthodox', 'Oriental Orthodox', 'Roman Catholic', 'Waldensian',
    'Bohemian Brethren', 'Protestant', 'Lutheran', 'Reformed', 'Continental Reformed', 'Anglican', 'Presbyterian', 'Congregational',
    'Baptist', 'Anabaptist', 'Remonstrant', 'Arminian', 'Methodist'];
  const cfRank = (c) => { const i = CF_RANK.indexOf(c); return i < 0 ? CF_RANK.length : i; };
  // the words a link asks the reader to mark: the clause itself (the reader marks a whole phrase of 24 characters or more)
  const cfPhrase = (x) => {
    if (String(x).startsWith('\u0001')) return '';
    const t = String(x).split('\t')[0].replace(/^…\s*/, '').trim();
    return t.length >= 24 ? t.slice(0, 110).replace(/\s+\S*$/, '') : '';
  };
  const cfWords = (x) => {
    const raw = String(x), [clause, tail] = (raw.startsWith('\u0001') ? raw.slice(1) : raw).split('\t');
    return clause ? `${/^[a-z]/.test(clause) ? '… ' : ''}${clause}${tail ? ` ${tail}` : ''}` : '';
  };
  // the reader numbers a page's paragraphs b<page>-<n>: the link goes to the paragraph that cites the verse
  function cfHref(read, slug, art, x) {
    const base = read(slug, art[2]), hl = cfPhrase(x), i = base.indexOf('#');
    return `${base.slice(0, i < 0 ? base.length : i)}${hl ? `&hl=${encodeURIComponent(hl)}` : ''}#b${encodeURIComponent(art[2])}-${art[4] || 0}`;
  }
  const clip = (s, n) => (s.length <= n ? s : `${s.slice(0, n).replace(/\s+\S*$/, '').replace(/[\s,;:]+$/, '')}…`);
  // Papal letters are not creeds, confessions or catechisms (the Scripture page's box sets them apart), so they are not counted here.
  function confessModel(cf, v, read) {
    if (!cf || !cf.index || !cf.chapter) return null;
    const docs = arr(cf.index.docs), d = cf.chapter;
    const rows = arr(d.v && d.v[String(v)]).map(([a, x]) => ({ art: d.a[a], x, doc: docs[(d.a[a] || [])[0]] })).filter((r) => r.art && r.doc && !r.doc.p);
    if (!rows.length) return null;
    const by = new Map();
    rows.forEach((r) => {
      if (!by.has(r.doc.c)) by.set(r.doc.c, []);
      by.get(r.doc.c).push(r);
    });
    const groups = [...by.entries()].sort((a, b) => cfRank(a[0]) - cfRank(b[0])).map(([church, rs]) => ({
      church, n: rs.length,
      rows: rs.sort((p, q) => (p.doc.y || 0) - (q.doc.y || 0)).map((r) => {
        // the words are shown inside quotation marks of our own, so a mark the document's text carries at either end is dropped
        const words = clip(cfWords(d.x[r.x]).replace(/^[\s"\u201c\u2018]+/, '').replace(/[\s"\u201d]+$/, ''), 150);
        return {
          title: r.doc.t, label: r.art[1], year: r.doc.y ? String(r.doc.y) : '', part: r.art[3] && r.art[3] !== r.doc.t ? r.art[3] : '',
          words, href: cfHref(read, r.doc.s, r.art, d.x[r.x]),
        };
      }),
    }));
    return {
      n: rows.length, docs: new Set(rows.map((r) => r.doc.s)).size, churches: groups.length, groups,
    };
  }

  // ── readings, disputes and the ribbon ─────────────────────────────────────────────────────────────────────────────────────
  const authorOf = (w) => String((w && (w[2] || w[0])) || '');
  const standing = (rank, a) => (rank && rank.authors && rank.authors[a]) || 0;
  function readingsModel(fv, T, rank) {
    const list = arr(fv && fv.readings).filter((r) => r && r.label);
    if (!list.length) return null;
    const items = list.map((rd) => {
      const M = T.readingModel(rd), n = rd.n || [0, 0, 0];
      // No author is named under a reading: the data says a page was sorted to a reading, not that its author holds it (a page that
      // reports or refutes a position is sorted there too). Only counts and links to the pages are kept.
      const pages = M.holds.slice(0, 6).map((w) => ({ w: w[0], p: w[1] }));
      return {
        label: plain(rd.label), text: plain(rd.reading), proves: plain(rd.proves), hold: n[0] || 0, reported: n[1] || 0, rejected: n[2] || 0,
        unverified: M.unverified, pages, holdsList: M.holds,
      };
    });
    const max = Math.max(...items.map((i) => i.hold), 1);
    items.forEach((i) => { i.pct = i.hold ? Math.max(3, Math.round((i.hold / max) * 100)) : 0; });
    return { of: fv.of || 0, items };
  }
  function disputesModel(fv, T) {
    const ds = T.disputeModel(arr(fv && fv.disputes)).map((d) => ({
      question: plain(d.question),
      sides: d.sides.filter((s) => s.position).map((s) => ({ ...s, position: plain(s.position) })),
    })).filter((d) => d.question && d.sides.length >= 2);
    return ds.length ? ds : null;
  }
  // For each period, the reading held on the most pages placed in it. A reading whose only sources are pages that discuss it (no
  // report, no rejection, a heterodox label) has its holds withheld by readingModel, so it cannot win a period.
  const RIBBON_MIN = 5;
  function ribbonModel(rv, readings) {
    if (!readings) return null;
    const eraWorks = new Map(arr(rv && rv.eras).map((e) => [e.id, e.works || 0]));
    const cells = [];
    GROUPS.forEach((g) => {
      const works = g.eras.reduce((a, id) => a + (eraWorks.get(id) || 0), 0);
      let placed = 0, best = null, tie = false;
      readings.items.forEach((it) => {
        const k = it.holdsList.filter((w) => g.eras.includes(w[3])).length;
        placed += k;
        if (!k) return;
        if (!best || k > best.k) { best = { label: it.label, k }; tie = false; } else if (k === best.k) tie = true;
      });
      // A leading reading is claimed only from at least five placed pages, and never from a tie.
      if (placed < RIBBON_MIN || tie) best = null;
      const why = placed < RIBBON_MIN ? 'few' : tie ? 'tie' : '';
      if (works || placed) cells.push({ id: g.id, label: g.label, years: g.years, works, placed, best, why: best ? '' : why });
    });
    return cells.some((c) => c.best) ? { cells } : null;
  }

  // ── key voices ────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // Chosen by rule from the library's own ranking (v1/scripture/rank.json): the curated key commentators of the book, in the order
  // curated, each with the best page the reception history holds for this verse.
  // A voice is an author with a page on THIS verse; no stance is claimed.
  const NOT_A_PERSON = /^(council|concilium|synod|acts of|ecumenical council|westminster assembly|the councils)/i;
  function voicesModel(rv, rank, ref, portraits) {
    if (!rank || !rv) return null;
    const keyList = arr(rank.books && (rank.books[ref.slug] || rank.books[ref.lib])).map((x) => x[0]);
    const best = new Map();
    const quality = (x) => (x.commentary && x.how === 'exegesis' ? 0 : x.how === 'exegesis' ? 1 : x.how === 'explicit' ? 2 : 3);
    arr(rv.eras).forEach((e) => arr(e.top).forEach((x, i) => {
      // a voice comments on the verse or cites it by name; a page that only quotes or alludes to it is not an interpreter
      if (!x || !x.a || !x.w || !(x.how === 'exegesis' || x.how === 'explicit')) return;
      const cur = best.get(x.a);
      if (!cur || quality(x) < quality(cur.x)) best.set(x.a, { x, e, i });
    }));
    const cands = [...best.entries()].map(([a, c]) => {
      const key = keyList.indexOf(a), tier = standing(rank, a);
      return { a, ...c, key, tier, score: key >= 0 ? 1000 - key : tier };
    }).filter((c) => c.key >= 0 && c.x.how === 'exegesis' && !NOT_A_PERSON.test(c.a))
      .sort((p, q) => q.score - p.score || quality(p.x) - quality(q.x) || (p.x.y || 0) - (q.x.y || 0));
    const per = new Map(), picked = [];
    cands.forEach((c) => {
      const g = (groupOfEra(c.e.id) || {}).id || '';
      if ((per.get(g) || 0) >= 3 || picked.length >= 6) return;
      per.set(g, (per.get(g) || 0) + 1);
      picked.push(c);
    });
    if (picked.length < 3) return null;
    picked.sort((p, q) => (p.x.y || 9999) - (q.x.y || 9999));
    const pmap = portraits || {};
    return picked.map((c) => {
      // a description is kept only where the page's own gist names this verse; one about the page before or after is left out
      const about = A && A.gistClaims ? A.gistClaims(c.x.g, ref.name, ref.c, ref.v) === 'yes' : false;
      const raw = about ? cleanGist(c.x.g) : '';
      const pic = pmap[c.a] || null;
      return {
        author: c.a, life: lifeOf(c.x), era: eraName(c.e)[0], w: c.x.w, p: c.x.p, h: c.x.h, title: cleanTitle(c.x.t),
        gist: raw || `${VERB[c.x.how] || 'Cites'} this verse.`, gistFromData: Boolean(raw), how: c.x.how,
        portrait: pic ? { src: pic.src, kind: pic.kind || 'portrait' } : null,
      };
    });
  }

  // ── the commentary ladder ─────────────────────────────────────────────────────────────────────────────────────────────────
  function ladderModel(rv) {
    const rungs = [];
    let total = 0;
    ERA_ORDER.forEach((id) => {
      const e = arr(rv && rv.eras).find((x) => x.id === id);
      if (!e) return;
      const notes = (rv && rv.notes) || {};
      // a rung shows only commentaries the reception history holds a note on this verse for, and opens at that note
      const rows = arr(e.top).filter((x) => x && x.commentary && x.w && notes[x.w]).sort((a, b) => (a.y || 9999) - (b.y || 9999)).slice(0, 3);
      if (!rows.length) return;
      total += rows.length;
      const [name, years] = eraName(e);
      rungs.push({
        name, years, works: e.works || 0, authors: e.authors || 0,
        rows: rows.map((x) => ({ author: x.a, life: lifeOf(x), title: cleanTitle(x.t), p: notes[x.w], w: x.w })),
      });
    });
    return rungs.length ? { rungs, total } : null;
  }

  // ── the chapter's heat ────────────────────────────────────────────────────────────────────────────────────────────────────
  function heatModel(chapterRec, c, v, label) {
    const told = Object.entries((chapterRec && chapterRec.verses) || {}).map(([k, x]) => [Number(k), (x && x.works) || 0]).filter(([k, n]) => k > 0 && n > 0)
      .sort((a, b) => a[0] - b[0]);
    if (told.length < 3) return null;
    const by = new Map(told);
    const lo = told[0][0], hi = told[told.length - 1][0];
    const max = Math.max(...told.map(([, n]) => n));
    const cols = [];
    for (let k = lo; k <= hi; k += 1) {
      const n = by.get(k) || 0;
      cols.push({ v: k, n, h: n ? Math.max(2, Math.round((n / max) * 1000) / 10) : 0, cur: k === v, text: `${label(c, k)}: ${plural(n, 'work', 'works')}` });
    }
    const top = told.slice().sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 5).map(([k, n]) => ({ v: k, n, label: label(c, k), cur: k === v }));
    return { cols, top, lo, hi, here: by.get(v) || 0 };
  }

  // ── the lede, composed from the counts and nothing else ──────────────────────────────────────────────────────────────────
  function ledeModel(m) {
    const s = [];
    const { rv } = m;
    if (rv && rv.works) {
      let t = `Cited in ${plural(rv.works, 'work', 'works')}`;
      if (m.ruler && arr(rv.strip).length > 1) t += `, most in the ${ord(m.ruler.tall)} century (${fmt(m.ruler.tallN)})`;
      s.push(`${t}.`);
      if (m.ruler && m.ruler.outs.length) {
        const cs = m.ruler.outs.slice().sort((a, b) => a - b).map(ord);
        s.push(`Measured against the library's usual share, the ${and(cs)} ${cs.length > 1 ? 'centuries cite' : 'century cites'} it unusually often.`);
      }
    }
    const rd = m.readings;
    if (rd) {
      const top = rd.items.reduce((a, b) => (b.hold > a.hold ? b : a));
      const found = rd.items.length === 1 ? 'one reading' : `${rd.items.length} readings`;
      s.push(`The readings pass read a sample of ${plural(rd.of, 'page', 'pages')} on it and found ${found}.`);
      if (top.hold) s.push(`The largest, “${top.label}”, is held on ${fmt(top.hold)}.`);
    }
    if (m.disputes) s.push(`It records ${plural(m.disputes.length, 'question', 'questions')} with competing positions.`);
    if (m.confess) {
      const c = m.confess;
      s.push(`${plural(c.n, 'article', 'articles')} in ${c.docs} ${c.docs === 1 ? 'creed, confession or catechism cites' : 'creeds, confessions and catechisms cite'} it.`);
    }
    return s.length ? { text: s.join(' '), note: 'Composed from the counts on this page by fixed rules.' } : null;
  }

  // ── the whole desk ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /* input: { ref: { slug, lib, name, c, v }, label(c, v), rec (the chapter's reception file), fv (this verse's entry in the readings
     file), base ({ share, peak } from baseFrom), rank, cf: { index, chapter }, portraits, T (FRScriptureTrust), read(slug, page) } */
  function build(input) {
    const { ref, rec, fv, base, rank, cf, portraits, T, read } = input;
    const label = input.label || ((c, v) => `${ref.name} ${c}:${v}`);
    const rv = rec && rec.verses ? rec.verses[String(ref.v)] || null : null;
    const here = label(ref.c, ref.v);
    const m = { rv: rv && rv.works ? rv : null };
    m.ruler = m.rv ? rulerModel(m.rv, base, here) : null;
    m.readings = readingsModel(fv, T, rank);
    m.disputes = disputesModel(fv, T);
    m.ribbon = ribbonModel(m.rv, m.readings);
    m.confess = confessModel(cf, ref.v, read);
    m.voices = voicesModel(m.rv, rank, ref, portraits);
    m.ladder = ladderModel(m.rv);
    m.heat = heatModel(rec, ref.c, ref.v, label);
    const notes = m.rv ? Object.keys(m.rv.notes || {}).length : 0;
    const tiles = [];
    if (m.rv) {
      const lo = arr(m.rv.strip)[0], hi = arr(m.rv.strip)[arr(m.rv.strip).length - 1];
      tiles.push({ n: m.rv.works, label: m.rv.works === 1 ? 'Work cites it' : 'Works cite it', sub: lo && hi && lo[0] !== hi[0] ? `${ord(lo[0])} to ${ord(hi[0])} century` : lo ? `${ord(lo[0])} century` : '' });
    }
    if (notes) tiles.push({ n: notes, label: notes === 1 ? 'Commentary' : 'Commentaries', sub: 'with a page on this verse' });
    if (m.confess) tiles.push({ n: m.confess.n, label: m.confess.n === 1 ? 'Confession proof' : 'Confession proofs', sub: `${plural(m.confess.docs, 'document', 'documents')}, ${plural(m.confess.churches, 'tradition', 'traditions')}` });
    if (m.readings) tiles.push({ n: m.readings.items.length, label: m.readings.items.length === 1 ? 'Reading' : 'Readings', sub: m.disputes ? plural(m.disputes.length, 'point in dispute', 'points in dispute') : '' });
    m.hero = m.rv ? { ref: here, ruler: m.ruler, tiles, notes } : null;
    m.lede = ledeModel(m);
    m.share = m.rv ? { line: [here, `cited in ${plural(m.rv.works, 'work', 'works')}`, m.confess ? plural(m.confess.n, 'confession proof', 'confession proofs') : ''].filter(Boolean).join(' · ') } : null;
    m.tier = m.rv && m.rv.works >= 1000 && m.readings && m.confess ? 'marquee' : m.readings || m.confess ? 'full' : 'thin';
    return m;
  }

  // ── markup ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // How a figure was made is a closed Methodology (assets/js/lib/tfr-method.js); without the helper (Node) it stays the paragraph it was.
  const method = (html) => {
    const M = typeof window !== 'undefined' ? window.TFRMethod : globalThis.TFRMethod;
    return M ? M.html(html) : (/^</.test(html) ? html : `<p class="vd-dek">${html}</p>`);
  };
  // dek stays in view; how (HTML paragraphs: the section's selection and counting rule, and any machine-written disclosure) goes in a Methodology under the heading.
  const sec = (id, eyebrow, h2, dek, body, how) => `<section class="vd-sec" id="vd-${id}" aria-labelledby="vd-${id}-h" data-vd="${id}"><p class="vd-eyebrow">${esc(eyebrow)}</p><h2 class="vd-h2" id="vd-${id}-h">${esc(h2)}</h2>${dek ? `<p class="vd-dek">${dek}</p>` : ''}${how ? method(how) : ''}${body}</section>`;
  const initials = (n) => { const w = String(n).split(/\s+/).filter((x) => /^[A-ZÀ-Ý]/.test(x)); return ((w[0] || '?')[0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase(); };

  function renderHero(m) {
    if (!m.hero) return '';
    const r = m.hero.ruler;
    const ruler = r ? `<figure class="vd-ruler"><figcaption class="vd-ruler-t">${esc(r.title)}</figcaption><ol class="vd-ruler-bars">${r.cols.map((c) =>
      `<li class="${c.hot ? 'is-hot' : ''}" style="--vd-h:${c.h}%"><span class="vd-bar-n" aria-hidden="true">${c.n ? fmt(c.n) : ''}</span><i aria-hidden="true"></i><b aria-hidden="true">${c.axis ? c.c : ''}</b><span class="vd-sr">${esc(c.text)}</span></li>`).join('')
    }</ol><p class="vd-ruler-axis" aria-hidden="true">Century</p>${method(`<p class="vd-note">${esc(r.caption)}</p>${m.lede ? `<p class="vd-note">${esc(m.lede.note)}</p>` : ''}`)}</figure>` : '';
    const tiles = m.hero.tiles.length ? `<ul class="vd-tiles">${m.hero.tiles.map((t) =>
      `<li class="vd-tile"><b>${fmt(t.n)}</b><span>${esc(t.label)}</span>${t.sub ? `<small>${esc(t.sub)}</small>` : ''}</li>`).join('')}</ul>` : '';
    // The lede's "composed by fixed rules" note joins the ruler's Methodology; with no ruler it has one of its own.
    const lede = m.lede ? `<p class="vd-lede">${esc(m.lede.text)}</p>${r ? '' : method(`<p class="vd-note">${esc(m.lede.note)}</p>`)}` : '';
    return `<div class="vd-hero" data-vd="hero">${ruler}${tiles}${lede}</div>`;
  }

  function renderVoices(m, ctx) {
    if (!m.voices || !m.voices.length) return '';
    const li = m.voices.map((v) => {
      const pic = v.portrait && ctx.portrait ? `<img src="${esc(ctx.portrait(v.portrait.src))}" alt="Portrait of ${esc(v.author)}" width="84" height="84" loading="lazy" decoding="async" data-por="${esc(v.portrait.src.replace(/^.*\//, '').replace(/\.jpg.*$/, ''))}" data-por-name="${esc(v.author)}">`
        : `<span class="vd-ini tfr-por-ini" aria-hidden="true">${esc(initials(v.author))}</span>`;
      const meta = [v.life, v.era].filter(Boolean).join(' · ');
      return `<li class="vd-voice"><div class="vd-port tfr-por tfr-por--m">${pic}</div><div class="vd-vbody"><h3 class="vd-vname">${esc(v.author)}</h3>${meta ? `<p class="vd-vmeta">${esc(meta)}</p>` : ''}<p class="vd-gist">${esc(v.gist)}</p><a class="vd-vlink" href="${esc(ctx.read(v.w, v.p, v.h))}">${esc(v.title)}, p. ${esc(v.p)}</a></div></li>`;
    }).join('');
    return sec('voices', 'Key voices', 'Who to read first', '', `<ul class="vd-voices">${li}</ul>`, `<p class="vd-dek">The library\u2019s importance ranking puts these authors first. Each has a page that comments on this verse or cites it by name. They are listed oldest first. Each link opens that page.</p>${m.voices.some((v) => v.gistFromData) ? '<p class="vd-dek">Each description is machine-written from the page it links to. A line that only says how the page uses the verse is not.</p>' : ''}`);
  }

  function renderReadingItem(it, of, ctx) {
    const pages = it.pages.length ? `<div class="vd-pagelinks"><p class="vd-sublabel">Pages sorted to this reading</p><ul>${it.pages.map((x) =>
      `<li><a href="${esc(ctx.read(x.w, x.p))}">Page ${esc(x.p)}</a></li>`).join('')}</ul>${it.hold > it.pages.length ? `<p class="vd-dim">${fmt(it.hold - it.pages.length)} more pages are sorted here.</p>` : ''}</div>` : '';
    // A reading the library found no page reporting or rejecting is marked unverified and carries no stance line at all.
    const stance = it.unverified ? '' : `<p class="vd-stance">${fmt(it.hold)} of ${fmt(of)} pages read are sorted to this reading${it.reported ? `. ${fmt(it.reported)} report it` : ''}${it.rejected ? `. ${fmt(it.rejected)} reject it` : ''}.</p>`;
    const unv = it.unverified ? `<p class="vd-dim">Unverified: the library found no page that reports or rejects this position.</p>` : '';
    return `<li class="vd-reading"><details><summary><span class="vd-rt">${esc(it.label)}</span><span class="vd-rbar" aria-hidden="true"><i style="width:${it.pct}%"></i></span><span class="vd-rn">${fmt(it.hold)}<span class="vd-sr"> ${it.hold === 1 ? 'page' : 'pages'}</span></span></summary><div class="vd-rbody">${it.text ? `<p>${esc(it.text)}</p>` : ''}${it.proves ? `<p class="vd-dim"><em>Used to prove:</em> ${esc(it.proves)}</p>` : ''}${stance}${unv}${pages}</div></details></li>`;
  }
  function renderChurch(m, ctx) {
    const rb = m.ribbon, rd = m.readings;
    if (!rb && !rd) return '';
    const ribbon = rb ? `<ol class="vd-ribbon">${rb.cells.map((c) => `<li><span class="vd-lab">${esc(c.label)}</span><span class="vd-sp">${esc(c.years)}</span><b class="vd-big">${fmt(c.works)}</b><span class="vd-sp">${c.works === 1 ? 'work cites it' : 'works cite it'}</span>${c.best
      ? `<h3 class="vd-rh">${esc(c.best.label)}</h3><p class="vd-sm">Most pages: ${fmt(c.best.k)} of ${fmt(c.placed)} placed</p>`
      : `<h3 class="vd-rh vd-dim">${c.why === 'tie' ? 'No single leading reading' : c.why === 'few' && c.placed ? 'Too few pages to name a leading reading' : 'No reading placed'}</h3><p class="vd-sm">${c.why === 'tie' ? `Two or more readings are level among ${fmt(c.placed)} placed pages.` : c.placed ? `Only ${plural(c.placed, 'page', 'pages')} from this period ${c.placed === 1 ? 'is' : 'are'} placed.` : 'The readings pass has no page dated to this period.'}</p>`}</li>`).join('')}</ol>` : '';
    const list = rd ? `<p class="vd-sublabel vd-gap">${rd.items.length === 1 ? 'The reading' : `All ${fmt(rd.items.length)} readings`}, by pages sorted to it (of ${fmt(rd.of)} pages read)</p><ul class="vd-readings">${rd.items.map((it) => renderReadingItem(it, rd.of, ctx)).join('')}</ul>` : '';
    return sec('church', 'How the church read it', rb ? 'The reading in each age' : 'The readings', '', `${ribbon}${list}<p class="vd-note">A page can report or refute a position without holding it, so no author is named.</p>`, `${rb ? '<p class="vd-dek">For each period, the reading with the most placed pages. A period needs five placed pages, and no other reading may be level. Counts of works are works citing the verse.</p>' : ''}<p class="vd-dek">Sorted by machine from the pages of the library read on this verse.</p>`);
  }

  function renderDisputes(m) {
    if (!m.disputes) return '';
    const q = m.disputes.map((d) => `<li class="vd-dq"><h3 class="vd-qh">${esc(d.question)}</h3><ul class="vd-sides">${d.sides.map((s) =>
      `<li class="vd-side"><p class="vd-pos">${esc(s.position)}</p>${s.pages ? `<p class="vd-cnt">${plural(s.pages, 'page discusses', 'pages discuss')} this position${s.authors > 1 ? ` (${plural(s.authors, 'author', 'authors')})` : ''}</p>` : ''}</li>`).join('')}</ul></li>`).join('');
    return sec('dispute', 'Points in dispute', 'Positions the library records', 'The library records which pages discuss each position. It does not record who holds one, so no names are listed.', `<ol class="vd-dqs">${q}</ol>`, '<p class="vd-dek">Questions and positions are sorted by machine from the pages of the library read on this verse.</p>');
  }

  function renderConfess(m, ctx) {
    const c = m.confess;
    if (!c) return '';
    const g = c.groups.map((gr) => `<section class="vd-church"><h3 class="vd-chname">${esc(gr.church)} <small>${fmt(gr.n)}</small></h3><ul>${gr.rows.map((r) =>
      `<li><a href="${esc(r.href)}"><b>${esc(r.title)}</b> <small>${esc([r.year, r.label].filter(Boolean).join(' · '))}</small></a>${r.part ? `<span class="vd-part">${esc(r.part)}</span>` : ''}${r.words ? `<q class="vd-q">${esc(r.words)}</q>` : ''}</li>`).join('')}</ul></section>`).join('');
    return sec('confess', 'Who confesses it', `Creeds and confessions that cite ${ctx.label}`, `${plural(c.n, 'article', 'articles')} in ${plural(c.docs, 'document', 'documents')}.`, `<div class="vd-confs">${g}</div>`);
  }

  function renderLadder(m, ctx) {
    const l = m.ladder;
    if (!l) return '';
    const r = l.rungs.map((u) => `<li class="vd-rung"><span class="vd-lab">${esc(u.name)}</span><p class="vd-sm">${esc([u.years, plural(u.works, 'work', 'works'), plural(u.authors, 'author', 'authors')].filter(Boolean).join(' · '))}</p><ul>${u.rows.map((x) =>
      `<li><a href="${esc(ctx.read(x.w, x.p))}"><b>${esc(x.author)}</b>${x.life ? ` <small>${esc(x.life)}</small>` : ''}<span>${esc(x.title)}, p. ${esc(x.p)}</span></a></li>`).join('')}</ul></li>`).join('');
    return sec('ladder', 'The commentary ladder', 'The note on this verse, by age', '', `<ol class="vd-ladder">${r}</ol>`);
  }

  function renderHeat(m, ctx) {
    const h = m.heat;
    if (!h) return '';
    const bars = `<ol class="vd-heat" aria-label="Works citing each verse">${h.cols.map((c) => {
      const lab = (c.v === h.lo && (10 - (h.lo % 10)) % 10 >= 4) || c.v % 10 === 0 || (c.v === h.hi && h.hi % 10 >= 4) || c.cur ? c.v : '';
      const inner = `<i aria-hidden="true"></i><b aria-hidden="true">${lab}</b><span class="vd-sr">${esc(c.text)}${c.cur ? ', this verse' : ''}</span>`;
      return `<li class="${c.cur ? 'is-cur' : ''}" style="--vd-h:${c.h}%">${c.cur ? `<span class="vd-barlink" aria-current="true">${inner}</span>` : `<a class="vd-barlink" href="${esc(ctx.desk(ctx.c, c.v))}">${inner}</a>`}</li>`;
    }).join('')}</ol>`;
    const top = `<p class="vd-sublabel vd-gap">Most cited in ${esc(ctx.chapter)}</p><ol class="vd-top">${h.top.map((t) =>
      `<li>${t.cur ? `<span class="vd-here"><b>${esc(t.label)}</b> <small>${plural(t.n, 'work', 'works')} · this verse</small></span>` : `<a href="${esc(ctx.desk(ctx.c, t.v))}"><b>${esc(t.label)}</b> <small>${plural(t.n, 'work', 'works')}</small></a>`}</li>`).join('')}</ol>`;
    return sec('heat', `Where it sits in ${ctx.chapter}`, 'Chapter heat', '', `${bars}${top}`, `<p class="vd-dek">Works citing each verse of the chapter, one bar a verse. ${esc(ctx.label)} is marked.</p>`);
  }

  function renderShare(m, ctx) {
    if (!m.share) return '';
    return sec('share', 'Share', 'Share this verse', '', `<p class="vd-shareline">${esc(m.share.line)}</p><div class="vd-actions"><button type="button" class="sd-btn" data-vd-copy data-vd-url="${esc(ctx.url)}">Copy link to this verse</button><span class="vd-copied" role="status" aria-live="polite" data-vd-copied></span></div>`);
  }

  /* ctx: { label, chapter, c, url, read(slug, page, href), desk(c, v), portrait(src) }. Each entry is { id, html } for a module that has
     data; a module without data is absent, never an empty shell. */
  function render(m, ctx) {
    const mods = [
      ['hero', renderHero(m, ctx)], ['voices', renderVoices(m, ctx)], ['church', renderChurch(m, ctx)], ['dispute', renderDisputes(m, ctx)],
      ['confess', renderConfess(m, ctx)], ['ladder', renderLadder(m, ctx)], ['heat', renderHeat(m, ctx)], ['share', renderShare(m, ctx)],
    ];
    return mods.filter(([, html]) => html).map(([id, html]) => ({ id, html }));
  }

  return {
    esc, fmt, ord, and, plural, plain, baseFrom, outliers, cleanGist, cleanTitle, build, render, GROUPS, ERA_ORDER, CF_RANK,
    parts: { rulerModel, readingsModel, disputesModel, ribbonModel, confessModel, voicesModel, ladderModel, heatModel, ledeModel },
  };
}));
