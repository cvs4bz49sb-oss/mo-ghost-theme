/* WHERE THE COMMENTARY PANE GETS ITS PAGES (2026-10-19). No DOM: the same code runs in the browser (commentary-pane.js) and in
   scripts/check-commentary-pages.mjs, which opens every commentary the pane offers on a chapter against the live library.

   A commentary's text reaches the pane in one of four shapes, and each had a loader of its own that could silently be missing:
     work      v1/works/<slug>/meta.json, then pages/NNNN.json shards (or work.json)                         (most works)
     tei       a work with no shards but has_tei: v1/works/<slug>/tei.<lane>.xml, pages are its <pb n> breaks   (Calvin)
     canon     pld-N, pg-N, po-N: one TEI file of the family, v1/tei/<fam>/<id>.xml, pages are columns        (the Fathers in Migne)
     eebo      eebo-N: no meta.json at all; /eebo/<id>.json.gz is {meta, toc}, a tree of HTML with
               <span class="pb" data-n="N"> page marks, ~9 MB for the Westminster Annotations                 (English divines)
   Before this file the pane knew the first three; choosing the Westminster Annotations (eebo-53832) asked for
   v1/works/eebo-53832/meta.json, got a 404, and said "This page could not be loaded." */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FRCommentaryPages = api;
}(typeof window !== 'undefined' ? window : globalThis, () => {
  'use strict';

  const CANON = /^(pld|pg|po)-(\d+)$/;
  const EEBO = /^eebo-(\d+)$/;
  const stride = (slug) => (CANON.test(slug) ? 2 : 1);
  const paragraphs = (t) => String(t || '').replace(/\[\^[^\]]*\]/g, '').split(/\n+/).map((s) => s.trim()).filter(Boolean);

  const decode = (s) => String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d))
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const attr = (attrs, name) => {
    const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(attrs || '');
    return m ? decode(m[1] != null ? m[1] : m[2]) : '';
  };

  // A TEI file read as text, with no DOM: calls onMark(local name, attrs) for every <pb> and <milestone>, and onBlock(text, lang) for
  // every <p> and <head> that is not inside a <note> (a note inside a paragraph is part of its text, as textContent had it).
  function scanTei(xml, onMark, onBlock) {
    const at = xml.search(/<body[\s>]/);
    const text = at >= 0 ? xml.slice(at) : xml;
    const rx = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([A-Za-z_][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>|([^<]+)/g;
    const stack = [];
    let note = 0, buf = null, m;
    while ((m = rx.exec(text))) {
      if (m[6] != null || m[1] != null) { if (buf) buf.t += m[6] != null ? decode(m[6]) : m[1]; continue; }
      if (m[3] == null) continue;
      const name = m[3].split(':').pop(), closing = m[2] === '/', selfClose = m[5] === '/';
      if (closing) {
        const top = stack.pop();
        if (top && top.name === 'note') note -= 1;
        if (buf && top && top === buf.el) { const t = buf.t.replace(/\s+/g, ' ').trim(); if (t) onBlock(t, buf.lang); buf = null; }
        continue;
      }
      if (name === 'pb' || name === 'milestone') onMark(name, m[4]);
      if (selfClose) continue;
      const lang = attr(m[4], 'xml:lang') || (stack.length ? stack[stack.length - 1].lang : '');
      const el = { name, lang };
      stack.push(el);
      if (name === 'note') note += 1;
      if ((name === 'p' || name === 'head') && !note && !buf) buf = { el, t: '', lang };
    }
  }

  // eebo-N: the work's tree of HTML, as paragraphs under the page mark they follow
  function eeboPageMap(data) {
    const pages = new Map();
    let cur = '0';
    const out = [];
    const walk = (nodes) => { for (const nd of nodes || []) { if (nd.html) out.push(nd.html); walk(nd.kids); } };
    walk(data && data.toc);
    const flat = out.join('\n')
      .replace(/<span class="pb" data-n="(\d+)"><\/span>/g, (m, n) => `\n\uE000${n}\uE000\n`)
      .replace(/<\/(?:p|h\d|div|li|blockquote|tr)>|<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '');
    // EVERY OCCURRENCE OF A PAGE NUMBER (10-25): a book whose paginations restart (Gouge's four parts, Trapp's volumes, the
    // Westminster Annotations' misprinted leaves) prints the same number more than once; each printed page is one occurrence in
    // document order (pages.occ), pages.all lists each number's occurrences, pages.repeats says whether any repeats; the Map
    // itself keeps the first occurrence under each number, as before
    // two marks of one number in a row (a page's two columns, a misprinted leaf) are one page; markIdx maps each printed mark, counted
    // in document order, to its occurrence, for an entry's start mark (spm) on the map
    const occ = [], all = new Map(), markIdx = [];
    let o = { n: '0', lines: [] }; occ.push(o); all.set('0', [0]);
    for (const line of decode(flat).split('\n')) {
      const mark = /^\uE000(\d+)\uE000$/.exec(line);
      if (mark) {
        if (mark[1] !== o.n) { o = { n: mark[1], lines: [] }; occ.push(o); if (!all.has(mark[1])) all.set(mark[1], []); all.get(mark[1]).push(occ.length - 1); }
        markIdx.push(occ.length - 1); continue;
      }
      const t = line.replace(/\s+/g, ' ').trim();
      if (t) o.lines.push(t);
    }
    for (const [n, is] of all) if (!pages.has(n)) pages.set(n, occ[is[0]].lines);
    pages.occ = occ; pages.all = all; pages.markIdx = markIdx; pages.repeats = [...all.values()].some((is) => is.length > 1);
    return pages;
  }

  // env: {base, mo, json(url) -> parsed JSON (gzip or not), text(url) -> string}. Every promise is kept for the session, and
  // dropped again if it failed, so a big file is fetched once and a failure is asked for again.
  function createPages(env) {
    const { base } = env;
    const kept = new Map();
    const once = (k, make) => {
      if (!kept.has(k)) { const p = Promise.resolve().then(make); p.catch(() => { if (kept.get(k) === p) kept.delete(k); }); kept.set(k, p); }
      return kept.get(k);
    };

    const canonCols = (slug) => once(`canon:${slug}`, async () => {
      const [, fam, id] = CANON.exec(slug);
      const xml = await env.text(env.mo ? `${base}/v1/tei/${fam}/${id}.xml` : `${base}/tei/${fam}/${id}.xml`);
      const en = new Map(), src = new Map(), cols = [];
      let cur = null;
      scanTei(xml, (tag, attrs) => {
        if (tag === 'milestone' && attr(attrs, 'unit') !== 'column') return;
        const raw = attr(attrs, 'n');
        if (fam === 'pld' && tag === 'milestone' && !raw.includes(':')) return; // the volume's own mark, not a column
        const c = parseInt(raw.split(':').pop(), 10); // "26:0021B": column 21, its second quarter
        if (c) { cur = c; if (!cols.includes(c)) cols.push(c); }
      }, (t, lang) => {
        if (cur == null) return;
        const m = lang === 'en' ? en : src;
        if (!m.has(cur)) m.set(cur, []);
        m.get(cur).push(t);
      });
      return { en, la: src, cols };
    });

    // a born-digital edition (Calvin's commentaries …) is held as TEI only: its pages are the <pb n> breaks
    const teiPages = (slug, meta) => once(`tei:${slug}`, async () => {
      const read = async (lane) => {
        const m = new Map();
        try {
          const xml = await env.text(`${base}/v1/works/${slug}/tei.${lane}.xml?v=${meta.tei_v || ''}`);
          let cur = '0';
          scanTei(xml, (tag, attrs) => { if (tag === 'pb') cur = String(+attr(attrs, 'n') || attr(attrs, 'n')); }, (t) => {
            if (!m.has(cur)) m.set(cur, []);
            m.get(cur).push(t);
          });
        } catch (_) { /* a lane the work does not have */ }
        return m;
      };
      const [en, la] = await Promise.all([read('en'), meta.en_only ? Promise.resolve(new Map()) : read('la')]);
      return { en, la };
    });

    // one fetch of the whole book (9 MB for the Westminster Annotations), kept for the session
    const eebo = (slug) => once(`eebo:${slug}`, async () => {
      const id = EEBO.exec(slug)[1];
      const data = await env.json(`${base}/eebo/${id}.json.gz`);
      const pages = eeboPageMap(data);
      const nums = [...pages.keys()].map(Number).filter((n) => n > 0);
      return { pages, occ: pages.occ, all: pages.all, markIdx: pages.markIdx, repeats: pages.repeats, last: nums.length ? Math.max(...nums) : 0, meta: data.meta || {} };
    });
    // the place a commentary was opened at in a book with repeating page numbers: {slug: occurrence index}, set by the pane
    const eeboCur = {};

    // {meta, p: {n, en, la} | null, last}
    async function page(slug, n) {
      if (CANON.test(slug)) {
        const d = await canonCols(slug);
        // some places on the map are a volume's number, not a column (pld-2742 opens at "34", its columns run from 173): the first
        // column after it is what is meant
        let at = Number(n);
        if (!d.cols.includes(at)) { const nx = d.cols.filter((x) => x > at).sort((a, b) => a - b)[0]; if (nx != null) at = nx; }
        const two = (m) => [at, at + 1].flatMap((c) => m.get(c) || []).join('\n');
        const p = { n: at, en: two(d.en), la: two(d.la) };
        return { meta: { canon: true }, p: p.en || p.la ? p : null, last: d.cols[d.cols.length - 1] || n };
      }
      if (EEBO.test(slug)) {
        const d = await eebo(slug);
        // a repeated page number is read at the occurrence at or after the chapter's place (the pane sets eeboCur when it opens a
        // commentary on a chapter); a book without repeats, or no place known, reads its first
        const at = eeboCur[slug];
        let lines = d.pages.get(String(n)), k = 0;
        if (d.repeats && at != null) { const is = d.all.get(String(n)) || []; const i = is.find((x) => x >= at); if (i != null) { lines = d.occ[i].lines; k = is.indexOf(i); } }
        return { meta: d.meta, p: lines && lines.length ? { n, en: lines.join('\n'), la: '' } : null, last: d.last, occ: k + 1 };
      }
      const meta = await env.json(`${base}/v1/works/${slug}/meta.json`);
      // the last page the work HAS: the shards run past n_pages where front matter is appended after the text (the WA volumes; 10-25)
      const last = Math.max(meta.n_pages || 0, (meta.shards && meta.shards.length && meta.shards[meta.shards.length - 1].to) || 0) || undefined;
      if (!(meta.shards || []).length && meta.has_tei) {
        const lanes = await teiPages(slug, meta);
        const p = { n, en: (lanes.en.get(String(n)) || []).join('\n'), la: (lanes.la.get(String(n)) || []).join('\n') };
        return { meta, p: p.en || p.la ? p : null, last };
      }
      const shard = (meta.shards || []).find((s) => s.from <= n && n <= s.to);
      const d = shard ? await env.json(`${base}/v1/works/${slug}/${shard.file}`) : await env.json(`${base}/v1/works/${slug}/work.json`);
      const p = (d.pages || []).find((x) => +x.n === +n);
      return { meta, p, last };
    }

    const X_SHELF = { Reformed: 'rf', 'Continental Reformed': 'rf', 'Roman Catholic': 'rc', Lutheran: 'lu', Medieval: 'md', 'English Divines': 'ed',
      'Humanism & Law': 'hl', 'Humanism and Law': 'hl' };
    // The works the library maps to a chapter, with where each opens and the rows that discuss each verse. No ranking (the pane ranks).
    async function listWorks(book, ch) {
      const [file, dev, ov] = await Promise.all([
        env.json(`${base}/v1/bible/all/${book}/${ch}.json.gz`).catch(() => null),
        env.json(`${base}/v1/devotion.json.gz`).catch(() => null),
        env.json(`${base}/v1/bible/commentary-overlay.json`).catch(() => null)]);
      const by = new Map(), meta = {}, sigla = {};
      const take = (slug, a, t) => {
        if (!by.has(slug)) by.set(slug, { slug, a: a || '', t: t || slug, notes: {}, open: null });
        return by.get(slug);
      };
      const rowsBy = new Map(), touch = new Map();
      for (const v of (file && file.verses) || []) {
        for (const r of v.rows || []) if (r.w && !meta[r.w]) meta[r.w] = { a: r.a || '', t: r.t || r.w };
        // how much of the chapter a work touches (10-25): the verses it has any row on, for the pane's featured strip
        for (const r of v.rows || []) if (r.w) { if (!touch.has(r.w)) touch.set(r.w, new Set()); touch.get(r.w).add(v.v); }
        for (const r of v.rows || []) if (r.w && (r.how === 'explicit' || r.how === 'exegesis') && +r.p > 0) {
          if (!rowsBy.has(r.w)) rowsBy.set(r.w, {});
          const byV = rowsBy.get(r.w); (byV[v.v] || (byV[v.v] = [])).push({ w: r.w, how: r.how, g: r.g, p: r.p });
        }
        for (const r of v.rows || []) if (r.how === 'exegesis' && /note on this verse/i.test(r.g || '')) {
          const c = take(r.w, r.a, r.t); if (!(v.v in c.notes)) c.notes[v.v] = r.p;
          if (r.sh && r.sh !== 'x') c.sh = c.sh || r.sh;
        }
      }
      for (const e of ((dev && dev.books && dev.books[book]) || [])) {
        // a volume of collected works is named by the piece in it that holds the chapter (map `stc` per chapter, else `st`; 10-19):
        // "Lectures on Psalms 2, 51, 45, 1532" in WA 40.2, not "Weimar Edition: Writings, Volume 40.2"
        const piece = (e.stc && e.stc[ch]) || e.st;
        meta[e.w] = { a: e.a || '', t: piece || e.t || e.w };
        if (+ch < (e.c1 || 1) || +ch > (e.c2 || 999)) continue;
        const c = take(e.w, e.a, e.t);
        if (piece) { c.t = piece; c.vol = e.t; }
        // its tradition: the shelf, or for the Reformed, Lutheran and Roman Catholic the map's tradition (10-20)
        c.sh = c.sh || (e.sh === 'x' ? (X_SHELF[e.tr] || 'x') : e.sh);
        c.k = c.k || e.k; c.cov = Math.max(c.cov || 0, Object.keys(e.an || {}).length || ((Number(e.c2) || 0) - (Number(e.c1) || 0) + 1));
        c.an = Object.assign(c.an || {}, e.an || {});   // every chapter's anchor: the pane's eeboCursor walks them in order
        if (e.spm != null) c.spm = e.spm;   // where the entry's first chapter opens, as a count of the book's printed page marks
        if (e.an && e.an[ch] != null) { c.open = e.an[ch]; if (e.an[String(+ch + 1)] != null) c.close = e.an[String(+ch + 1)]; }
      }
      for (const [slug, w] of Object.entries((ov && ov.works) || {})) if (w.sigla) sigla[slug] = w.sigla;
      for (const [slug, w] of Object.entries((ov && ov.works) || {})) {
        const x = w.books && w.books[book] && w.books[book][ch]; if (!x) continue;
        const c = take(slug, w.a, w.t); c.open = x.p; Object.assign(c.notes, x.v || {}); c.overlay = true;
        if (x.c) { c.collected = x.c; for (const v of Object.keys(x.c)) if (!(v in c.notes)) c.notes[v] = x.c[v][0][1]; }
        if (x.pv) c.pv = Object.assign(c.pv || {}, x.pv);
      }
      for (const c of by.values()) { c.rows = rowsBy.get(c.slug) || {}; c.touch = (touch.get(c.slug) || new Set()).size; }
      return { works: [...by.values()].filter((c) => Object.keys(c.notes).length || c.open != null), meta, sigla, nv: ((file && file.verses) || []).length };
    }

    return { page, listWorks, canonCols, teiPages, eebo, eeboCur };
  }

  return { CANON, EEBO, stride, paragraphs, scanTei, eeboPageMap, createPages, decode };
}));
