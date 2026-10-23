/* The Lexicon (/the-faith-received/lexicon/): every term on one page, and each term as an entry with the words that define it.
   The library worker's v1/lexicon files:
     index.json                 the alphabet (letters and their counts) and the most defined terms
     letters/<letter>.json      rows [id, headword, works, Latin form, Greek form] for a letter
     forms/<two letters>.json   form -> term id, for the search box
     terms/<id>.json            the headword, its forms and its senses; a sense is a gloss and the pages that define it
     history/<n>.json.gz        every work that defines a term, oldest author first
     redirects.json             an id merged into another entry
   and, for the author names: v1/author_aliases.json and v1/bible/<shelf>/rooms/index.json, the rooms a name opens.
   The sense files name a work and a page, not the words on it. A quote is read from the work's TEI (tei/pg, tei/pld, tei/po, tei/eebo or
   works/<slug>/tei.<lane>.xml), found by page, and cut as an exact substring of that page's text. Nothing is paraphrased.
   Every string in these files is data. Each one goes through esc() before it is drawn, and a link is built from encodeURIComponent.
   One address. No hash is the list. #letter-<l> is a letter of it. #<term id> is an entry and #<term id>/<n> its nth sense
   (the reader's Define popover links to #<term id>). ?q=<text> and ?t=<en|grc|he> filter the list in place. */
(() => {
  'use strict';
  window.__FR_BLOB_BASE__ = window.__FR_BLOB_BASE__ || 'https://mo-tfr-library.mo-podcast-feed.workers.dev';
  window.__FR_READER_PATH__ = window.__FR_READER_PATH__ || '/the-faith-received/read/';
  window.__FR_LEXICON_PATH__ = window.__FR_LEXICON_PATH__ || '/the-faith-received/lexicon/';
  window.__FR_AUTHOR_PATH__ = window.__FR_AUTHOR_PATH__ || '/the-faith-received/author/';
  const BLOB = String(window.__FR_BLOB_BASE__).replace(/\/$/, '');
  const READER = window.__FR_READER_PATH__;
  const PATH = window.__FR_LEXICON_PATH__;
  const AUTHP = window.__FR_AUTHOR_PATH__;
  const TITLE = 'Lexicon | The Faith Received | Mere Orthodoxy';
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = (n) => Number(n || 0).toLocaleString('en-US');
  const fold = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
  const scriptOf = (s) => (/[Ͱ-Ͽἀ-῿]/.test(s) ? 'grc' : /[֐-׿]/.test(s) ? 'he' : 'en');
  const read = (w, p) => `${READER}?w=${encodeURIComponent(w)}#b${encodeURIComponent(p)}-0`;
  const plural = (n, one, many) => `${nf(n)} ${n === 1 ? one : many}`;
  const SCRIPTS = [['en', 'Latin', /^[a-zæœ_]$/], ['grc', 'Greek', /^[Ͱ-Ͽἀ-῿]$/], ['he', 'Hebrew', /^[֐-׿]$/]];
  const scriptOfLetter = (l) => (SCRIPTS.find(([, , rx]) => rx.test(l)) || ['en'])[0];
  const idle = () => new Promise((res) => { if (window.requestIdleCallback) window.requestIdleCallback(() => res(), { timeout: 150 }); else setTimeout(res, 0); });

  /* A file the library has not got (404, 410) is status 404. One it could not be asked for (the network, a 5xx, a 429) is asked again twice
     first, then status 0. A missing term says so. A failed one offers another try. */
  async function get(u) {
    for (let n = 0; n < 3; n += 1) {
      try {
        const r = await fetch(BLOB + u);
        if (r.ok) return { status: 200, data: await r.json() };
        if (r.status === 404 || r.status === 410) return { status: 404, data: null };
      } catch (_) { /* the network: asked again below */ }
      if (n < 2) await new Promise((res) => { setTimeout(res, 350 * (n + 1)); });
    }
    return { status: 0, data: null };
  }
  const memo = new Map();
  const once = (key, fn) => {
    if (!memo.has(key)) memo.set(key, fn().then((v) => { if (v === null) memo.delete(key); return v; }));
    return memo.get(key);
  };
  const termOf = (id) => once(`t:${id}`, async () => { const r = await get(`/v1/lexicon/terms/${encodeURIComponent(id)}.json`); return r.status === 404 ? { missing: true } : r.data; });

  const S = { tab: 'all', q: '', id: '', rendered: '', sense: 0, lane: 'en' };
  try { const v = localStorage.getItem('fr_lex_lane'); if (v === 'en' || v === 'orig' || v === 'both') S.lane = v; } catch (_) { /* storage blocked: English */ }
  let INDEX = null;
  let TSEQ = 0;
  let IO = null;
  let QIO = null;
  const ROW = 28;
  const CHUNK = 200;
  const DATA = new Map(); // letter -> rows
  const FOLD = new Map(); // letter -> folded 'headword|latin|greek' per row
  const BYID = new Map(); // id -> [row, letter]
  const LANE_KEY = 'fr_lex_lane';

  function parseHash() {
    let h = '';
    try { h = decodeURIComponent(location.hash.slice(1)); } catch (_) { h = location.hash.slice(1); }
    if (/^letter-/.test(h)) return { letter: h.slice(7), id: '', sense: 0 };
    const m = /^(.*?)(?:\/(\d+))?$/.exec(h);
    return { id: m ? m[1] : '', sense: m && m[2] ? Number(m[2]) : 0, letter: '' };
  }
  const urlFor = () => {
    const p = new URLSearchParams();
    if (S.q) p.set('q', S.q);
    if (S.tab !== 'all') p.set('t', S.tab);
    const s = p.toString();
    return `${PATH}${s ? `?${s}` : ''}`;
  };
  const go = (url, push) => { history[push ? 'pushState' : 'replaceState'](null, '', url); viaHistory = false; route(); };

  /* ── The whole list: one section a letter, built as each letter's file arrives ───────────────────────────────────── */
  const letters = () => Object.keys(INDEX.letters).sort((a, b) => (a === '_') - (b === '_'));
  const slug = (l) => (l === '_' ? 'other' : l);
  const letterName = (l) => (l === '_' ? 'Other' : l.toUpperCase());
  const rowHTML = (r) => {
    const forms = [r[3], r[4]].filter(Boolean).join(' · ');
    const sc = scriptOf(r[1]);
    return `<a class="lx-r" href="#${encodeURIComponent(r[0])}"${sc === 'en' ? '' : ` lang="${sc}"`}>${esc(r[1])}${forms ? `<small>${esc(forms)}</small>` : ''}</a>`;
  };
  function chunksHTML(rows) {
    let out = '';
    for (let i = 0; i < rows.length; i += CHUNK) {
      const part = rows.slice(i, i + CHUNK);
      out += `<div class="lx-chunk" style="--r:${part.length}">${part.map(rowHTML).join('')}</div>`;
    }
    return out;
  }
  function buildShells() {
    $('#lx-all').innerHTML = letters().map((l) => `<section class="lx-sec is-pending" id="letter-${esc(slug(l))}" data-l="${esc(l)}" data-s="${scriptOfLetter(l)}" style="--n:${Number(INDEX.letters[l]) | 0}"><h2 class="lx-lh"><span${scriptOfLetter(l) === 'en' ? '' : ` lang="${scriptOfLetter(l)}"`}>${esc(letterName(l))}</span> <small>${nf(INDEX.letters[l])}</small></h2><div class="lx-chunks"></div></section>`).join('');
    window.addEventListener('scroll', () => { if (!curT) curT = requestAnimationFrame(updateCurrent); }, { passive: true });
  }
  let curT = 0;
  /* the letter whose section holds the line just under the letter bar */
  function updateCurrent() {
    curT = 0;
    if ($('#lx-listview').hidden || $('#lx-all').hidden) return;
    const secs = document.querySelectorAll('#lx-all .lx-sec');
    const bb = $('#lx-bar').getBoundingClientRect().bottom;
    const line = (bb > 0 ? bb : 110) + 12;
    let cur = null;
    for (let i = 0; i < secs.length; i += 1) {
      if (secs[i].hidden) continue;
      const r = secs[i].getBoundingClientRect();
      if (r.top <= line + 100 && r.bottom > line) cur = secs[i];
    }
    if (cur) markCurrent(cur.dataset.l);
  }
  function markCurrent(l) {
    document.querySelectorAll('#lx-bar a[aria-current]').forEach((a) => a.removeAttribute('aria-current'));
    const a = document.querySelector(`#lx-bar a[data-jump="${CSS.escape(l)}"]`);
    if (a) a.setAttribute('aria-current', 'true');
  }
  const stat = { loaded: 0, t0: performance.now(), firstPaint: 0, complete: 0 };
  let pendingJump = '';
  let userScrolled = false;
  ['wheel', 'touchmove', 'keydown'].forEach((ev) => window.addEventListener(ev, () => { userScrolled = true; }, { passive: true }));
  /* a letter: fetched once, folded for the search, drawn into its section */
  const load = (l) => once(`load:${l}`, async () => {
    const r = await get(`/v1/lexicon/letters/${encodeURIComponent(l)}.json`);
    if (!r.data) return r.status === 404 ? [] : null;
    const rows = r.data;
    DATA.set(l, rows);
    FOLD.set(l, rows.map((x) => `${fold(x[1])}|${fold(x[3])}|${fold(x[4])}`));
    rows.forEach((x) => BYID.set(x[0], [x, l]));
    await idle();
    const sec = document.getElementById(`letter-${slug(l)}`);
    if (sec) {
      sec.querySelector('.lx-chunks').innerHTML = chunksHTML(rows);
      sec.classList.remove('is-pending');
      sec.style.removeProperty('--n');
    }
    stat.loaded += 1;
    if (!stat.firstPaint) stat.firstPaint = performance.now() - stat.t0;
    if (stat.loaded >= letters().length) stat.complete = performance.now() - stat.t0;
    if (pendingJump && !userScrolled) { const t = document.getElementById(`letter-${slug(pendingJump)}`); if (t) t.scrollIntoView({ block: 'start', behavior: 'instant' }); }
    progress();
    return rows;
  });
  window.__lexStat = stat;
  const letterRows = (l) => (l && INDEX && Object.hasOwn(INDEX.letters, l) ? load(l) : Promise.resolve([]));
  let started = false;
  function startAll(first) {
    if (started) { if (first) load(first); return; }
    started = true;
    const queue = letters();
    if (first && queue.includes(first)) queue.unshift(first);
    const worker = async () => { while (queue.length) { const l = queue.shift(); await load(l); } };
    Promise.all([worker(), worker(), worker(), worker()]).then(() => { if (S.q) applyFilter(); });
  }
  function progress() {
    const total = letters().length;
    const done = stat.loaded >= total;
    if (done) $('#lx-all').setAttribute('data-complete', 'true');
  }

  /* ── Filters in place: the alphabet tabs and the search ──────────────────────────────────────────────────────────── */
  function paintBar() {
    const tab = S.tab;
    const all = letters();
    $('#lx-bar').innerHTML = SCRIPTS.filter(([k]) => tab === 'all' || tab === k).map(([k, , rx]) => all.filter((l) => rx.test(l))
      .map((l) => `<a href="#letter-${esc(encodeURIComponent(slug(l)))}" data-jump="${esc(l)}"${k === 'en' ? '' : ` lang="${k}"`} aria-label="${esc(letterName(l))}, ${plural(INDEX.letters[l], 'term', 'terms')}">${esc(letterName(l))}</a>`).join('')).filter(Boolean)
      .map((g) => `<span class="lx-bg">${g}</span>`).join('');
    document.querySelectorAll('#lx-tabs [data-t]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.t === tab)));
    setBarH();
  }
  const setBarH = () => { const b = $('#lx-bar'); if (b && b.offsetHeight) $('main.tfr-lexicon').style.setProperty('--lx-bar', `${b.offsetHeight + 4}px`); };
  window.addEventListener('resize', setBarH);
  const tabOk = (sc) => S.tab === 'all' || S.tab === sc;
  const shardKey = (f) => f.slice(0, 2).replace(/ς/g, 'σ').replace(/[^\p{L}\p{N}]/gu, '_');
  const shardOf = (f) => once(`f:${shardKey(f)}`, async () => { const r = await get(`/v1/lexicon/forms/${encodeURIComponent(shardKey(f))}.json`); return r.data || (r.status === 404 ? {} : null); });
  const SEQ = { f: 0 };
  /* a term matches when its headword, or its Latin or Greek form, begins with what was typed or has a word that does; the forms file adds
     the terms a form beyond the first names. Exact and leading matches come first, then the alphabet. */
  async function matches(q) {
    const f = fold(q);
    const shard = await shardOf(f);
    const hits = [];
    const seen = new Set();
    letters().forEach((l) => {
      const rows = DATA.get(l);
      if (!rows) return;
      const fl = FOLD.get(l);
      rows.forEach((r, i) => {
        const [h, la, gr] = fl[i].split('|');
        let rank = 9;
        if (h === f) rank = 0; else if (h.startsWith(f)) rank = 1; else if (la.startsWith(f) || gr.startsWith(f)) rank = 2; else if (` ${h}`.includes(` ${f}`)) rank = 3; else if (` ${la}`.includes(` ${f}`) || ` ${gr}`.includes(` ${f}`)) rank = 4;
        if (rank < 9 && tabOk(scriptOf(r[1]))) { hits.push([rank, r]); seen.add(r[0]); }
      });
    });
    Object.entries(shard || {}).forEach(([k, id]) => {
      if (seen.has(id) || !k.startsWith(f)) return;
      const hit = BYID.get(id);
      if (hit && tabOk(scriptOf(hit[0][1]))) { hits.push([2, hit[0]]); seen.add(id); }
    });
    return hits.sort((a, b) => a[0] - b[0]).map((h) => h[1]);
  }
  async function applyFilter() {
    const seq = ++SEQ.f;
    const total = INDEX.n;
    const searching = fold(S.q).length >= 2;
    $('#lx-all').hidden = searching; $('#lx-bar').hidden = searching; $('#lx-found').hidden = !searching;
    $('#lx-empty').hidden = true;
    paintBar();
    document.querySelectorAll('#lx-all .lx-sec').forEach((s) => { s.hidden = !tabOk(s.dataset.s); });
    if (!searching) {
      const n = letters().filter((l) => tabOk(scriptOfLetter(l))).reduce((a, l) => a + INDEX.letters[l], 0);
      $('#lx-count').textContent = n === total ? `${nf(total)} terms` : `${nf(n)} of ${nf(total)} terms`;
      return;
    }
    const rows = await matches(S.q);
    if (seq !== SEQ.f) return;
    const complete = stat.loaded >= letters().length;
    $('#lx-count').textContent = `${nf(rows.length)} of ${nf(total)} terms${complete ? '' : ' so far'}`;
    $('#lx-found-cols').innerHTML = chunksHTML(rows);
    $('#lx-empty').textContent = `No term matches “${S.q}”.`;
    $('#lx-empty').hidden = rows.length > 0 || !complete;
    S.found = rows;
  }

  /* ── Pieces ──────────────────────────────────────────────────────────────────────────────────────────────────────── */
  const skEntry = '<div class="lx-sk-entry" aria-hidden="true"><span class="lx-sk lx-sk-h"></span><span class="lx-sk" style="width:60%"></span><span class="lx-sk" style="width:92%"></span><span class="lx-sk" style="width:86%"></span></div>';
  const retry = (what) => `<p class="lx-note">${what} <button type="button" class="lx-btn" data-retry>Try again</button></p>`;

  /* ── Quotes: the words on the page that a sense is drawn from, read from the work's TEI ──────────────────────────── */
  const QUOTE = { quote: 0, page: 0, none: 0 };
  window.__lexQuotes = QUOTE;
  let slots = 2;
  const waitQ = [];
  const take = () => new Promise((res) => { if (slots > 0) { slots -= 1; res(); } else waitQ.push(res); });
  const give = () => { const n = waitQ.shift(); if (n) n(); else slots += 1; };
  const normPage = (v) => String(v == null ? '' : v).trim().replace(/^0+(?=\d)/, '');
  const teiUrls = (w) => {
    const m = /^(pg|pld|po|eebo)-(\d+)$/.exec(w);
    return m ? [`/v1/tei/${m[1]}/${m[2]}.xml`] : [`/v1/works/${encodeURIComponent(w)}/tei.la.xml`, `/v1/works/${encodeURIComponent(w)}/tei.en.xml`];
  };
  /* one work's pages: page -> blocks [{lang, text, mt}], from its TEI. A TEI over eight megabytes is not read. */
  async function indexXml(url, pages, defLang) {
    let text = '';
    try {
      const r = await fetch(BLOB + url);
      if (!r.ok) return false;
      if (Number(r.headers.get('content-length') || 0) > 8e6) return false;
      const rd = r.body.getReader();
      const dec = new TextDecoder();
      let got = 0;
      for (;;) {
        const { done, value } = await rd.read();
        if (done) break;
        got += value.length;
        if (got > 8e6) { rd.cancel(); return false; }
        text += dec.decode(value, { stream: true });
      }
    } catch (_) { return false; }
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) return false;
    const textEl = doc.documentElement.getElementsByTagName('text')[0];
    const root = (textEl && textEl.getAttribute('xml:lang')) || defLang;
    const machine = /English translation \(machine\)|machine[- ]translat/i.test(text.slice(0, 4000));
    let page = '';
    const langOf = (el) => { for (let e = el; e && e.nodeType === 1; e = e.parentNode) { const v = e.getAttribute('xml:lang'); if (v) return v; } return root; };
    const els = doc.getElementsByTagName('*');
    for (let i = 0; i < els.length; i += 1) {
      const el = els[i];
      const ln = el.localName;
      if (ln === 'pb' || (ln === 'milestone' && el.getAttribute('unit') === 'column')) { page = normPage((el.getAttribute('n') || '').replace(/^\d+:0*(\d+)[A-Z]?$/, '$1')); continue; }
      if ((ln !== 'p' && ln !== 'l' && ln !== 'head' && ln !== 'item') || !page) continue;
      if (el.closest('note') || el.getElementsByTagName('p').length) continue;
      // a footnote inside a block ends the text before it and starts a new piece after it, so each piece is a contiguous run of the page
      let c = el;
      if (el.getElementsByTagName('note').length) { c = el.cloneNode(true); Array.from(c.getElementsByTagName('note')).forEach((n) => n.replaceWith('\u0001')); }
      const pieces = c.textContent.split('\u0001').map((x) => x.replace(/\s+/g, ' ').trim()).filter((x) => x.length >= 2);
      if (!pieces.length) continue;
      if (!pages.has(page)) pages.set(page, []);
      pieces.forEach((t) => pages.get(page).push({ lang: (langOf(el) || 'und').slice(0, 2).toLowerCase(), text: t, mt: /machine/i.test(el.getAttribute('resp') || '') || machine }));
    }
    return true;
  }
  window.__lexWork = (w) => workPages(w);
  let QGEN = 0;
  const workPages = (w) => once(`w:${w}`, async () => {
    const gen = QGEN;
    await take();
    try {
      if (gen !== QGEN) return { pages: null };
      const pages = new Map();
      const oks = await Promise.all(teiUrls(w).map((u, i, all) => indexXml(u, pages, all.length > 1 ? (i === 0 ? 'la' : 'en') : '')));
      return oks.some(Boolean) ? { pages } : { pages: null };
    } finally { give(); }
  });
  /* fold with a map back to the printed characters, so a match in the folded text marks the exact printed span */
  function foldMap(text) {
    let s = '';
    const map = [];
    for (let i = 0; i < text.length; i += 1) {
      const f = text[i].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      for (let k = 0; k < f.length; k += 1) { s += f[k]; map.push(i); }
    }
    return { s, map };
  }
  const CUE = /\b(is|are|was|called|termed|named|defined?|defines|means|meaning|namely|est|sunt|dicitur|vocatur|definitur|appellatur|nominatur|esse|sive|id est)\b|ἐστι|καλεῖται|λέγεται|ὁρίζ/i;
  function locate(blocks, forms) {
    const fs = [...new Set(forms.map(fold).filter((f) => f.length >= 3))];
    let best = null;
    blocks.forEach((b) => {
      const sents = [];
      const re = /[^.!?;·]+[.!?;·]*["”’)\]]*|[^.!?;·]+$/g;
      let m;
      while ((m = re.exec(b.text))) { const raw = m[0]; const lead = raw.length - raw.trimStart().length; const t = raw.trim(); if (t) sents.push({ start: m.index + lead, end: m.index + lead + t.length }); }
      sents.forEach((s, i) => {
        const seg = b.text.slice(s.start, s.end);
        const { s: fs0, map } = foldMap(seg);
        const spans = [];
        fs.forEach((f) => {
          const rx = new RegExp(`(^|[^\\p{L}\\p{N}])(${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\p{L}*)`, 'gu');
          let mm;
          while ((mm = rx.exec(fs0))) { const st = mm.index + mm[1].length; spans.push([map[st], (map[st + mm[2].length - 1] ?? map[map.length - 1]) + 1]); }
        });
        if (!spans.length) return;
        const score = (CUE.test(seg) ? 2 : 1) + (seg.length < 500 ? 0.5 : 0);
        if (best && best.score >= score) return;
        let a = s.start;
        // a short sentence takes the one before it in the same block, for a little context
        if (seg.length < 80 && i > 0) a = sents[i - 1].start;
        const { end } = s;
        let cutS = false;
        let cutE = false;
        let q = b.text.slice(a, end);
        if (q.length > 460) {
          const first = spans[0][0] + (a === s.start ? 0 : s.start - a);
          let x = Math.max(0, first - 180);
          let y = Math.min(q.length, first + 280);
          if (x > 0) { const sp = q.indexOf(' ', x); if (sp > -1 && sp < first) x = sp + 1; }
          if (y < q.length) { const sp = q.lastIndexOf(' ', y); if (sp > first) y = sp; }
          cutS = x > 0; cutE = y < q.length;
          q = q.slice(x, y);
          a += x;
        }
        const off = a - s.start;
        const marks = spans.map(([x, y]) => [x - off, y - off]).filter(([x, y]) => x >= 0 && y <= q.length && y > x);
        best = { score, text: q, marks, cutS, cutE, lang: b.lang, mt: b.mt };
      });
    });
    return best;
  }
  const firstLines = (blocks) => {
    const b = blocks[0];
    if (!b) return null;
    let t = b.text.slice(0, 260);
    const cut = b.text.length > 260;
    if (cut) { const sp = t.lastIndexOf(' '); if (sp > 120) t = t.slice(0, sp); }
    return { text: t, marks: [], cutS: false, cutE: cut, lang: b.lang, mt: b.mt, page: true };
  };
  const LANGNAME = { la: 'Latin', en: 'English', grc: 'Greek', gr: 'Greek', fr: 'French', de: 'German', it: 'Italian', es: 'Spanish', nl: 'Dutch', he: 'Hebrew', sy: 'Syriac', cu: 'Slavonic' };
  /* a source row's quote, per lane: { en, orig } or null when the page text is not there */
  const qcache = new Map();
  async function quoteOf(w, p, forms) {
    const key = `${w}\u0000${p}\u0000${forms[0]}`;
    if (!qcache.has(key)) {
      qcache.set(key, (async () => {
        const wp = await workPages(w);
        const blocks = wp.pages && wp.pages.get(normPage(p));
        if (!blocks || !blocks.length) return null;
        const en = blocks.filter((b) => b.lang === 'en');
        const orig = blocks.filter((b) => b.lang !== 'en');
        const pick = (bs, fm) => (bs.length ? locate(bs, fm) || firstLines(bs) : null);
        const out = { en: pick(en, [forms[0]]), orig: pick(orig, forms) };
        return out.en || out.orig ? out : null;
      })());
    }
    return qcache.get(key);
  }
  function markHTML(q) {
    let out = '';
    let at = 0;
    const ms = [...q.marks].sort((a, b) => a[0] - b[0]);
    ms.forEach(([x, y]) => { if (x < at) return; out += `${esc(q.text.slice(at, x))}<mark>${esc(q.text.slice(x, y))}</mark>`; at = y; });
    return `${q.cutS ? '…' : ''}${out}${esc(q.text.slice(at))}${q.cutE ? '…' : ''}`;
  }
  const lanesFor = (res) => {
    const a = res.en;
    const b = res.orig;
    if (S.lane === 'en') return a ? [['en', a]] : [['orig', b]];
    if (S.lane === 'orig') return b ? [['orig', b]] : [['en', a]];
    return [b && ['orig', b], a && ['en', a]].filter(Boolean);
  };
  function paintQuote(box, res, w, p, au, ti) {
    const cite = `${au ? `${au}, ` : ''}${ti || w}, p. ${p}`;
    const lanes = lanesFor(res);
    box.className = 'lx-qs';
    box.removeAttribute('aria-hidden');
    box.innerHTML = lanes.map(([lane, q]) => {
      const lang = lane === 'en' ? 'en' : (q.lang && q.lang !== 'und' ? q.lang : '');
      const label = `${q.page ? `From p. ${esc(p)}` : esc(LANGNAME[lang] || (lang ? lang.toUpperCase() : 'Original'))}${lane === 'en' && q.mt ? ' (machine translation)' : ''}`;
      return `<blockquote class="lx-q"><p${lang ? ` lang="${esc(lang)}"` : ''}>${markHTML(q)}</p><footer><span class="lx-ql">${label}</span><button type="button" class="lx-link" data-cite data-cite-text="${esc(`${cite}\n“${q.text}”`)}">Copy citation</button></footer></blockquote>`;
    }).join('');
    if (lanes.some(([, q]) => !q.page)) QUOTE.quote += 1; else QUOTE.page += 1;
  }
  /* each sense draws its quotes as it nears the screen */
  async function fillSense(li, forms) {
    li.dataset.q = '1';
    if (!li.isConnected) return;
    const rows = [...li.querySelectorAll('.lx-src > li[data-w]')];
    await Promise.all(rows.map(async (row) => {
      const box = row.querySelector('.lx-qs');
      const w = row.dataset.w;
      const p = row.dataset.p;
      let res = null;
      try { res = await quoteOf(w, p, forms); } catch (_) { res = null; }
      if (!box.isConnected) return;
      if (!res) { box.removeAttribute('aria-hidden'); box.className = 'lx-qs lx-qf'; box.textContent = `Open p. ${p} to read it.`; QUOTE.none += 1; return; }
      row._res = res;
      paintQuote(box, res, w, p, row.dataset.a, row.dataset.t);
    }));
  }
  function watchSenses(forms) {
    if (QIO) QIO.disconnect();
    QIO = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting && !e.target.dataset.q) { QIO.unobserve(e.target); fillSense(e.target, forms); } }), { rootMargin: '500px 0px' });
    document.querySelectorAll('#lx-entry .lx-sense').forEach((li) => QIO.observe(li));
  }
  function repaintQuotes() {
    document.querySelectorAll('#lx-entry .lx-src > li[data-w]').forEach((row) => {
      if (row._res) paintQuote(row.querySelector('.lx-qs'), row._res, row.dataset.w, row.dataset.p, row.dataset.a, row.dataset.t);
    });
    document.querySelectorAll('#lx-lane button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lane === S.lane)));
  }

  /* ── An entry, as a page of its own ──────────────────────────────────────────────────────────────────────────────── */
  /* AN AUTHOR'S PAGE (2026-10-23, Ian: "for migne we name pelagius but clicking we get to uncertain author. fix this and elsewhere"). A name
     opens the author's page when a room holds exactly that person (through the alias ledger, one hop, as the room builders fold), on the
     work's own shelf when the work is a Patrologia's. An unnamed designation ("Uncertain author", "Anonymous") or a joint attribution opens
     nothing: a room of that name, perhaps on another shelf, is not this work's author. The rule of The Faith Received's lexicon. */
  const nk = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const UNNAMED = /^(?:unknown|anonymous|anonymus|various|uncertain|unattributed)\b/i;
  const SHELF_OF = { pld: 'pl', pg: 'gf', po: 'po' };
  const SHELVES = ['pl', 'gf', 'po', 'md', 'rc', 'rf', 'lu', 'ed', 'hl'];
  let ROOMS = null;
  let ALIAS = {};
  const roomsP = Promise.all([get('/v1/author_aliases.json'), ...SHELVES.map((sh) => get(`/v1/bible/${sh}/rooms/index.json`))]).then(([al, ...xs]) => {
    ALIAS = al.data || {};
    const m = new Map();
    xs.forEach((x, i) => ((x.data && x.data.authors) || []).forEach((r) => { const k = nk(r.a); if (!m.has(k)) m.set(k, []); m.get(k).push({ ...r, sh: SHELVES[i] }); }));
    ROOMS = m;
  });
  function roomOf(name, w) {
    if (!ROOMS || !name || UNNAMED.test(name) || name.includes(';')) return null;
    const rs = ROOMS.get(nk(Object.hasOwn(ALIAS, name) ? ALIAS[name] : name));
    if (!rs) return null;
    const sh = SHELF_OF[String(w || '').split('-')[0]];
    if (sh) return rs.find((r) => r.sh === sh) || null;
    return rs.slice().sort((a, b) => (b.w || 0) - (a.w || 0))[0];
  }
  const roomHref = (r) => `${AUTHP}?a=${encodeURIComponent(nk(r.a))}`;
  const nameHTML = (n, w) => {
    const r = roomOf(n, w);
    return r ? `<a class="lx-au" href="${esc(roomHref(r))}">${esc(n)}</a>` : `<span class="lx-au" data-w="${esc(w || '')}">${esc(n)}</span>`;
  };
  /* names drawn before the rooms arrived become links when they do */
  function linkAuthors(root) {
    if (!ROOMS || !root) return;
    root.querySelectorAll('span.lx-au[data-w]').forEach((s) => {
      const r = roomOf(s.textContent, s.dataset.w);
      if (!r) return;
      const a = document.createElement('a');
      a.className = 'lx-au'; a.href = roomHref(r); a.textContent = s.textContent;
      s.replaceWith(a);
    });
  }
  const srcRow = ([w, p, a, ti]) => `<li data-w="${esc(w)}" data-p="${esc(p)}" data-a="${esc(a || '')}" data-t="${esc(ti || '')}"><div class="lx-sr"><span class="lx-who">${a ? nameHTML(a, w) : ''}<span class="lx-wk">${esc(ti || w)}</span></span><a class="lx-btn lx-open" href="${esc(read(w, p))}" aria-label="Open p. ${esc(p)} of ${esc(ti || w)}${esc(a ? ` by ${a}` : '')} in the reader">Open p. ${esc(p)}</a></div><div class="lx-qs lx-qpend" aria-hidden="true"><span class="lx-sk"></span></div></li>`;
  const senseHTML = (s, i, id) => `<li class="lx-sense" id="s${i + 1}"><a class="lx-sn" href="#${encodeURIComponent(id)}/${i + 1}" aria-label="Sense ${i + 1}, link to this sense">${i + 1}</a><div><p class="lx-gloss">${esc(s.gloss)}</p>${(s.src || []).length ? `<p class="lx-def">Defined by</p><ul class="lx-src">${s.src.map(srcRow).join('')}</ul>` : ''}</div></li>`;
  function formsHTML(t) {
    const part = (name, lang, xs) => {
      if (!xs || !xs.length) return '';
      const first = xs.slice(0, 10);
      const rest = xs.slice(10);
      return `<div><dt>${name}</dt><dd lang="${lang}">${first.map(esc).join(', ')}${rest.length ? `<span class="lx-rest" hidden>, ${rest.map(esc).join(', ')}</span> <button type="button" class="lx-link" data-formsmore data-n="${rest.length}">and ${nf(rest.length)} more</button>` : ''}</dd></div>`;
    };
    const html = part('Latin', 'la', t.latin) + part('Greek', 'grc', t.greek);
    return html ? `<dl class="lx-forms">${html}</dl>` : '';
  }
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h; };
  async function jz(u) {
    try {
      const r = await fetch(BLOB + u);
      if (!r.ok) return null;
      const b = new Uint8Array(await r.arrayBuffer());
      const text = b[0] === 0x1f && b[1] === 0x8b ? await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).text() : new TextDecoder().decode(b);
      return JSON.parse(text);
    } catch (_) { return null; }
  }
  const histOf = async (id) => { const d = await jz(`/v1/lexicon/history/${fnv(id) % 2048}.json.gz`); return d && d.terms && Object.hasOwn(d.terms, id) ? d.terms[id] : null; };
  const cent = (y) => {
    if (y == null) return 'Undated';
    const c = Math.floor((y - 1) / 100) + 1;
    const s = c % 100 >= 11 && c % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[c % 10] || 'th');
    return `${c}${s} century`;
  };
  const who = (a, w) => (a ? `${nameHTML(a[0] || 'Unknown author', w)}${a[1] ? ` (${esc(a[1])})` : ''}` : '');
  /* the works draw forty at a time as the page scrolls toward the end of the list, each century under its own head */
  const HSTEP = 40;
  function histRows(h, from, to, last) {
    let out = '';
    let lastC = last;
    h.rows.slice(from, to).forEach((r) => {
      const a = h.authors[r[2]] || [];
      const c = cent(a[2]);
      if (c !== lastC) { out += `<li class="lx-hc">${esc(c)}</li>`; lastC = c; }
      out += `<li class="lx-hr"><p class="lx-hw2">${who(a, r[0])}${a.length ? ', ' : ''}<a href="${esc(read(r[0], r[3]))}">${esc(r[1] || r[0])}, p. ${esc(r[3])}</a>${r[5] > 1 ? ` (${nf(r[5])} pages)` : ''}</p><p>${esc(r[4])}</p></li>`;
    });
    return [out, lastC];
  }
  async function showHistory(id, seq) {
    const box = $('#lx-hist');
    const h = await histOf(id);
    if (!box || seq !== TSEQ) return;
    if (!h || !h.rows.length) { box.innerHTML = ''; return; }
    const dated = h.rows.map((r) => h.authors[r[2]]).filter((a) => a && a[2] != null);
    const a0 = dated[0];
    const a1 = dated[dated.length - 1];
    const authors = new Set(h.rows.map((r) => r[2])).size;
    const fa = $('#lx-f-authors');
    if (fa) { fa.textContent = nf(authors); fa.closest('div').hidden = false; }
    const ff = $('#lx-f-first');
    if (ff && a0) { ff.textContent = `${a0[0]}, ${cent(a0[2])}`; ff.closest('div').hidden = false; }
    const span = a0 && a1 && a0 !== a1 ? `From ${esc(a0[0])} to ${esc(a1[0])}, oldest first.` : 'Oldest first.';
    const [html, lastC0] = histRows(h, 0, HSTEP, null);
    let lastC = lastC0;
    let drawn = Math.min(HSTEP, h.rows.length);
    const method = window.TFRMethod ? window.TFRMethod.html('<p>Each line is a one-line English summary made by machine. Open the page to read the author’s own words.</p>') : '';
    box.innerHTML = `<h2 id="lx-hist-h">Every work that defines it <small>${nf(h.works)}</small></h2><p class="lx-hnote">${span}</p>${method}<ol class="lx-hlist">${html}</ol><div class="lx-sentinel" aria-hidden="true"></div>`;
    roomsP.then(() => { if (seq === TSEQ) linkAuthors(box); });
    const ol = box.querySelector('.lx-hlist');
    const sentinel = box.querySelector('.lx-sentinel');
    if (IO) IO.disconnect();
    IO = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      const [rows, lc] = histRows(h, drawn, drawn + HSTEP, lastC);
      lastC = lc; drawn = Math.min(drawn + HSTEP, h.rows.length);
      ol.insertAdjacentHTML('beforeend', rows);
      if (drawn >= h.rows.length) { IO.disconnect(); IO = null; sentinel.remove(); } else { IO.unobserve(sentinel); IO.observe(sentinel); }
    }, { rootMargin: '800px 0px' });
    IO.observe(sentinel);
  }

  let REDIR = null;
  async function loadTerm(id) {
    let t = await termOf(id);
    // an id merged into another entry: redirects.json names the entry that holds it now
    if (t && t.missing) {
      if (REDIR === null) { const r = await get('/v1/lexicon/redirects.json'); if (r.status) REDIR = r.data || {}; }
      if (REDIR === null) return null;
      const to = Object.hasOwn(REDIR, id) ? REDIR[id] : '';
      if (to && to !== id) t = await termOf(to);
    }
    return t;
  }
  function focusSense(n) {
    document.querySelectorAll('#lx-entry .lx-sense.is-target').forEach((e) => e.classList.remove('is-target'));
    const el = n ? document.getElementById(`s${n}`) : null;
    if (!el) return;
    el.classList.add('is-target');
    el.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  const crumb = (l) => `<nav class="lx-crumb" aria-label="Breadcrumb"><a href="${PATH}${l ? `#letter-${encodeURIComponent(slug(l))}` : ''}" data-nav>Lexicon</a>${l ? ` <span aria-hidden="true">/</span> <a href="${PATH}#letter-${encodeURIComponent(slug(l))}" data-nav>${esc(letterName(l))}</a>` : ''}</nav>`;
  async function openEntry(id, sense) {
    show('entry');
    if (S.id === id) { if (S.rendered === id) focusSense(sense); else S.sense = sense; return; }
    const seq = ++TSEQ;
    S.id = id; S.rendered = ''; S.sense = sense;
    if (IO) { IO.disconnect(); IO = null; }
    // a new entry drops the last one's page text and any quote fetch still waiting
    QGEN += 1;
    [...memo.keys()].filter((k) => k.startsWith('w:')).forEach((k) => memo.delete(k));
    qcache.clear();
    const box = $('#lx-entry');
    box.innerHTML = `${crumb('')}${skEntry}`;
    $('#lx-live').textContent = 'Loading the term';
    window.scrollTo({ top: 0, behavior: 'instant' });
    const t = await loadTerm(id);
    if (seq !== TSEQ) return;
    if (t && t.missing) { box.innerHTML = `${crumb('')}<p class="lx-note">No term has the address “${esc(id)}”.</p>`; return; }
    if (!t) { box.innerHTML = `${crumb('')}${retry('This term did not load.')}`; return; }
    const tid = t.id || id;
    if (tid !== id) { history.replaceState(null, '', `${location.pathname}${location.search}#${encodeURIComponent(tid)}${S.sense ? `/${S.sense}` : ''}`); S.id = tid; }
    // the headword's letter file: whether the term is filed more than once, and the terms on either side
    const hw = String(t.headword || '');
    const hk = hw.toLowerCase();
    let hl = fold(hk).slice(0, 1);
    if (!Object.hasOwn(INDEX.letters, hl)) hl = BYID.has(tid) ? BYID.get(tid)[1] : '_';
    const rows = (await letterRows(hl)) || [];
    if (seq !== TSEQ) return;
    const sib = rows.filter((x) => String(x[1]).toLowerCase() === hk && x[0] !== tid).sort((a, b) => (b[2] || 0) - (a[2] || 0));
    const at = rows.findIndex((r) => r[0] === tid);
    const pn = (r, dir) => (r ? `<a class="lx-pn lx-pn-${dir}" href="#${encodeURIComponent(r[0])}"><span>${dir === 'prev' ? 'Previous' : 'Next'}</span><b lang="${scriptOf(r[1])}" dir="auto">${esc(r[1])}</b></a>` : '<span></span>');
    const also = sib.length ? `<p class="lx-also">Also filed as ${sib.map((x) => `<a href="#${encodeURIComponent(x[0])}">${esc([x[3], x[4]].filter(Boolean).join(' / ') || x[1])}</a> <span class="lx-via">${plural(x[2], 'work', 'works')}</span>`).join(', ')}</p>` : '';
    const senses = t.senses || [];
    document.title = `${hw} | ${TITLE}`;
    const lang = scriptOf(hw);
    const langs = [t.latin && t.latin.length ? 'Latin' : '', t.greek && t.greek.length ? 'Greek' : ''].filter(Boolean);
    const fact = (k, v, idv, hide) => `<div${hide ? ' hidden' : ''}><dt>${k}</dt><dd${idv ? ` id="${idv}"` : ''}>${v}</dd></div>`;
    const laneBtns = [['en', 'English'], ['orig', 'Original'], ['both', 'Both']].map(([k, n]) => `<button type="button" data-lane="${k}" aria-pressed="${S.lane === k}">${n}</button>`).join('');
    box.innerHTML = `${crumb(hl)}<div class="lx-ent">
<header class="lx-eh"><h1 id="lx-title" tabindex="-1" lang="${lang}" dir="auto">${esc(hw)}</h1>${formsHTML(t)}${also}</header>
<aside class="lx-facts" aria-label="Quick facts about ${esc(hw)}"><h2>Quick facts</h2><dl>${fact('Headword', { en: 'English', grc: 'Greek', he: 'Hebrew' }[lang])}${langs.length ? fact('Forms in', langs.join(' and ')) : ''}${fact('Senses', nf(senses.length))}${t.works ? fact('Works', nf(t.works)) : ''}${fact('Authors', '', 'lx-f-authors', true)}${fact('Earliest source', '', 'lx-f-first', true)}</dl><button type="button" class="lx-btn" data-copy>Copy link</button></aside>
<div class="lx-body">${senses.length ? `<section aria-labelledby="lx-sen-h"><div class="lx-sh"><h2 id="lx-sen-h">Senses <small>${nf(senses.length)}</small></h2><div class="lx-lane" id="lx-lane" role="group" aria-label="Quotation language">${laneBtns}</div></div><ol class="lx-senses">${senses.map((s, i) => senseHTML(s, i, tid)).join('')}</ol></section>` : '<p class="lx-note">This term has no sense recorded yet.</p>'}
<section class="lx-hist" id="lx-hist"></section>
<nav class="lx-pnav" aria-label="Neighboring terms">${pn(rows[at - 1], 'prev')}${pn(rows[at + 1], 'next')}</nav></div></div>`;
    S.rendered = tid;
    roomsP.then(() => { if (seq === TSEQ) linkAuthors($('#lx-entry .lx-senses')); });
    $('#lx-live').textContent = `${hw}, ${plural(senses.length, 'sense', 'senses')}`;
    const want = S.sense;
    const forms = [hw, ...(t.latin || []), ...(t.greek || [])];
    box.onclick = (e) => {
      const sr = e.target.closest('[data-formsmore]');
      if (sr) {
        const open = sr.previousElementSibling.hidden;
        sr.previousElementSibling.hidden = !open;
        sr.textContent = open ? 'Show fewer' : `and ${nf(Number(sr.dataset.n))} more`;
        return;
      }
      const ln = e.target.closest('[data-lane]');
      if (ln) { S.lane = ln.dataset.lane; try { localStorage.setItem(LANE_KEY, S.lane); } catch (_) { /* storage blocked */ } repaintQuotes(); $('#lx-live').textContent = `Showing ${{ en: 'English', orig: 'original', both: 'both' }[S.lane]} quotes`; return; }
      const ci = e.target.closest('[data-cite]');
      if (ci) { copyText(ci, ci.dataset.citeText, 'Copy citation', 'Citation copied'); return; }
      const cp = e.target.closest('[data-copy]');
      if (cp) copyText(cp, `${location.origin}${PATH}#${encodeURIComponent(tid)}`, 'Copy link', 'Link copied');
    };
    watchSenses(forms);
    const title = $('#lx-title');
    if (want) focusSense(want); else if (title) title.focus({ preventScroll: true });
    showHistory(tid, seq);
  }
  async function copyText(btn, text, idle0, done) {
    try { await navigator.clipboard.writeText(text); btn.textContent = done; $('#lx-live').textContent = done; } catch (_) { btn.textContent = 'Copy failed'; }
    setTimeout(() => { btn.textContent = idle0; }, 2000);
  }

  /* ── Routing: the address is the state ───────────────────────────────────────────────────────────────────────────── */
  function show(view) {
    $('#lx-hd').hidden = view === 'entry';
    $('#lx-listview').hidden = view === 'entry';
    $('#lx-entry').hidden = view !== 'entry';
  }
  let listScroll = 0;
  let wasEntry = false;
  let viaHistory = false;
  async function jump(l) {
    if (!Object.hasOwn(INDEX.letters, l)) return;
    pendingJump = l; userScrolled = false;
    startAll(l);
    await load(l);
    const t = document.getElementById(`letter-${slug(l)}`);
    if (t) t.scrollIntoView({ block: 'start', behavior: 'instant' });
    updateCurrent();
    // later letters still arriving move the page under it: hold the place until the list is whole, for at most 20 seconds
    const hold = setInterval(() => { if (stat.loaded >= letters().length || userScrolled || pendingJump !== l) { clearInterval(hold); if (pendingJump === l) pendingJump = ''; } }, 400);
    setTimeout(() => { clearInterval(hold); if (pendingJump === l) pendingJump = ''; }, 20000);
  }
  function route() {
    if (!INDEX) return;
    const h = parseHash();
    const sp = new URLSearchParams(location.search);
    S.q = (sp.get('q') || '').slice(0, 80);
    S.tab = ['en', 'grc', 'he'].includes(sp.get('t')) ? sp.get('t') : 'all';
    if (h.id) {
      if (!wasEntry) listScroll = window.scrollY;
      wasEntry = true;
      openEntry(h.id, h.sense);
      return;
    }
    const back = wasEntry && viaHistory;
    viaHistory = false;
    wasEntry = false; S.id = ''; S.rendered = ''; TSEQ += 1;
    if (IO) { IO.disconnect(); IO = null; }
    if (QIO) { QIO.disconnect(); QIO = null; }
    document.title = TITLE;
    show('list');
    if (document.activeElement !== $('#lx-q')) $('#lx-q').value = S.q;
    startAll(h.letter && Object.hasOwn(INDEX.letters, h.letter === 'other' ? '_' : h.letter) ? (h.letter === 'other' ? '_' : h.letter) : '');
    applyFilter();
    if (h.letter) jump(h.letter === 'other' ? '_' : h.letter);
    else if (back) window.scrollTo({ top: listScroll, behavior: 'instant' });
  }

  /* ── Wiring ──────────────────────────────────────────────────────────────────────────────────────────────────────── */
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-retry]')) { S.id = ''; if (INDEX) route(); else init(); return; }
    const jp = e.target.closest('#lx-bar a[data-jump]');
    if (jp && !(e.metaKey || e.ctrlKey || e.shiftKey || e.button)) { e.preventDefault(); history.replaceState(null, '', `${location.pathname}${location.search}#letter-${encodeURIComponent(slug(jp.dataset.jump))}`); jump(jp.dataset.jump); return; }
    const nav = e.target.closest('a[data-nav]');
    if (nav && !(e.metaKey || e.ctrlKey || e.shiftKey || e.button)) { e.preventDefault(); go(nav.getAttribute('href'), true); return; }
    const t = e.target.closest('#lx-tabs [data-t]');
    if (t) { S.tab = t.dataset.t; history.replaceState(null, '', urlFor()); applyFilter(); }
  });
  let findT = 0;
  $('#lx-q').addEventListener('input', () => {
    clearTimeout(findT);
    findT = setTimeout(() => { S.q = $('#lx-q').value.trim(); history.replaceState(null, '', urlFor()); applyFilter(); }, 150);
  });
  $('#lx-find').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearTimeout(findT);
    S.q = $('#lx-q').value.trim();
    history.replaceState(null, '', urlFor());
    await applyFilter();
    if (S.found && S.found.length && fold(S.q).length >= 2) { history.pushState(null, '', urlFor()); location.hash = `#${encodeURIComponent(S.found[0][0])}`; }
  });
  // Back and Forward between hash states fire both events: one route a tick
  let routeT = 0;
  const routeSoon = () => { clearTimeout(routeT); viaHistory = true; routeT = setTimeout(route, 0); };
  window.addEventListener('hashchange', routeSoon);
  window.addEventListener('popstate', routeSoon);

  async function init() {
    // a link to a term (the reader's Define popover) opens on the entry: no list flashes first
    if (parseHash().id) { $('#lx-hd').hidden = true; $('#lx-listview').hidden = true; $('#lx-entry').hidden = false; $('#lx-entry').innerHTML = skEntry; }
    const r = await get('/v1/lexicon/index.json');
    if (!r.data) { $('#lx-boot').hidden = false; $('#lx-boot').innerHTML = retry('The lexicon did not load.'); return; }
    INDEX = r.data;
    $('#lx-boot').hidden = true;
    buildShells();
    paintBar();
    route();
  }
  init();
})();
