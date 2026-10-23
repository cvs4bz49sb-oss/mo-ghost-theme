/* The Lexicon (/the-faith-received/lexicon/), a reading reference. The library worker's v1/lexicon files:
     index.json                 the alphabet (letters and their counts) and the most defined terms
     letters/<letter>.json      rows [id, headword, works, Latin form, Greek form] for a letter
     forms/<two letters>.json   form -> term id, for the search box
     terms/<id>.json            the headword, its forms and its senses; a sense is a gloss and the pages that define it
     history/<n>.json.gz        every work that defines a term, oldest author first
     redirects.json             an id merged into another entry
   Every string in these files is data. Each one goes through esc() before it is drawn, and a link is built from encodeURIComponent.
   Three views, one address. No query and no hash is the front page. ?l=<letter> or ?q=<text> is a list. #<term id> is an entry and
   #<term id>/<n> its nth sense (the reader's Define popover links to #<term id>). */
(() => {
  'use strict';
  window.__FR_BLOB_BASE__ = window.__FR_BLOB_BASE__ || 'https://mo-tfr-library.mo-podcast-feed.workers.dev';
  window.__FR_READER_PATH__ = window.__FR_READER_PATH__ || '/the-faith-received/read/';
  window.__FR_LEXICON_PATH__ = window.__FR_LEXICON_PATH__ || '/the-faith-received/lexicon/';
  const BLOB = String(window.__FR_BLOB_BASE__).replace(/\/$/, '');
  const READER = window.__FR_READER_PATH__;
  const PATH = window.__FR_LEXICON_PATH__;
  const TITLE = 'Lexicon | The Faith Received | Mere Orthodoxy';
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = (n) => Number(n || 0).toLocaleString('en-US');
  const fold = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
  const scriptOf = (s) => (/[Ͱ-Ͽἀ-῿]/.test(s) ? 'grc' : /[֐-׿]/.test(s) ? 'he' : 'en');
  const read = (w, p) => `${READER}?w=${encodeURIComponent(w)}#b${encodeURIComponent(p)}-0`;
  const plural = (n, one, many) => `${nf(n)} ${n === 1 ? one : many}`;
  const SCRIPTS = [['en', 'Latin', /^[a-zæœ]$/], ['grc', 'Greek', /^[Ͱ-Ͽἀ-῿]$/], ['he', 'Hebrew', /^[֐-׿]$/]];

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

  const S = { q: '', letter: '', rows: [], shown: 0, id: '', rendered: '', sense: 0 };
  let INDEX = null;
  let LSEQ = 0;
  let TSEQ = 0;
  let IO = null;
  const PAGE = 100;

  function parseHash() {
    let h = '';
    try { h = decodeURIComponent(location.hash.slice(1)); } catch (_) { h = location.hash.slice(1); }
    const m = /^(.*?)(?:\/(\d+))?$/.exec(h);
    return { id: m ? m[1] : '', sense: m && m[2] ? Number(m[2]) : 0 };
  }
  const urlFor = (o) => {
    const p = new URLSearchParams();
    if (o.q) p.set('q', o.q); else if (o.letter) p.set('l', o.letter);
    const s = p.toString();
    return `${PATH}${s ? `?${s}` : ''}`;
  };
  const go = (url, push) => { history[push ? 'pushState' : 'replaceState'](null, '', url); viaHistory = false; route(); };

  /* ── Pieces ──────────────────────────────────────────────────────────────────────────────────────────────────────── */
  const skRows = (n) => Array.from({ length: n }, (_, i) => `<li class="lx-sk-row" aria-hidden="true"><span class="lx-sk lx-sk-w" style="width:${40 + ((i * 17) % 40)}%"></span><span class="lx-sk lx-sk-s" style="width:${50 + ((i * 11) % 30)}%"></span></li>`).join('');
  const skEntry = '<div class="lx-sk-entry" aria-hidden="true"><span class="lx-sk lx-sk-h"></span><span class="lx-sk" style="width:60%"></span><span class="lx-sk" style="width:92%"></span><span class="lx-sk" style="width:86%"></span><span class="lx-sk" style="width:74%"></span></div>';
  const retry = (what) => `<p class="lx-note">${what} <button type="button" class="lx-btn" data-retry>Try again</button></p>`;
  const letterRows = (l) => (l && INDEX && Object.hasOwn(INDEX.letters, l) ? once(`l:${l}`, async () => { const r = await get(`/v1/lexicon/letters/${encodeURIComponent(l)}.json`); return r.data || (r.status === 404 ? [] : null); }) : Promise.resolve([]));
  /* one row a headword: the lexicon filed some headwords several times (wages: merces, merces with ὀψώνια, opsōnion). A list shows each once,
     with the fullest entry, and the entry opened names the others under "Also filed as". */
  function groupRows(rows) {
    const by = new Map();
    rows.forEach((r) => { const k = String(r[1]).toLowerCase(); if (!by.has(k)) by.set(k, []); by.get(k).push(r); });
    return [...by.values()].map((v) => { v.sort((a, b) => (b[2] || 0) - (a[2] || 0)); const r = v[0]; return { id: r[0], hw: r[1], works: r[2], la: r[3], grc: r[4], n: v.length, via: r.via || '' }; });
  }
  const metaHTML = (r, extra) => {
    const bits = [];
    if (r.la) bits.push(`<span>Latin <i lang="la">${esc(r.la)}</i></span>`);
    if (r.grc) bits.push(`<span>Greek <span lang="grc">${esc(r.grc)}</span></span>`);
    if (extra) bits.push(`<span>${extra}</span>`);
    if (r.works) bits.push(`<span>${plural(r.works, 'work', 'works')}</span>`);
    if (r.n > 1) bits.push(`<span>${r.n} entries</span>`);
    if (r.via) bits.push(`<span>as ${esc(r.via)}</span>`);
    return bits.join('');
  };
  const rowHTML = (r) => `<li><a class="lx-row" href="#${encodeURIComponent(r.id)}"><span class="lx-hw" lang="${scriptOf(r.hw)}" dir="auto">${esc(r.hw)}</span><span class="lx-meta">${metaHTML(r)}</span></a></li>`;

  /* ── The front page: the alphabet as large letters, then the most defined terms ──────────────────────────────────── */
  function paintFront() {
    const all = Object.keys(INDEX.letters).filter((l) => l !== '_');
    $('#lx-az').innerHTML = SCRIPTS.map(([k, name, rx]) => [k, name, all.filter((l) => rx.test(l))]).filter(([, , ls]) => ls.length)
      .map(([k, name, ls]) => `<div class="lx-azg"><p class="lx-azl">${name}</p><div class="lx-azs">${ls.map((l) => `<a href="${esc(urlFor({ letter: l }))}" data-nav lang="${k === 'en' ? 'en' : k}" aria-label="${esc(l.toUpperCase())}, ${plural(INDEX.letters[l], 'term', 'terms')}">${esc(l.toUpperCase())}</a>`).join('')}</div></div>`).join('');
    const top = groupRows(INDEX.top.slice(0, 12));
    $('#lx-top').innerHTML = top.map((r) => `<li><a class="lx-feat-a" href="#${encodeURIComponent(r.id)}" data-fid="${esc(r.id)}"><span class="lx-hw" lang="${scriptOf(r.hw)}" dir="auto">${esc(r.hw)}</span><span class="lx-meta">${metaHTML(r)}</span><span class="lx-gl"></span></a></li>`).join('');
    // each featured term's first sense and sense count, read as the row nears the screen
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      termOf(e.target.dataset.fid).then((t) => {
        if (!t || !t.senses || !t.senses.length || !e.target.isConnected) return;
        e.target.querySelector('.lx-gl').textContent = t.senses[0].gloss;
        e.target.querySelector('.lx-meta').insertAdjacentHTML('afterbegin', `<span>${plural(t.senses.length, 'sense', 'senses')}</span>`);
      });
    }), { rootMargin: '200px 0px' });
    $('#lx-top').querySelectorAll('[data-fid]').forEach((a) => io.observe(a));
  }

  /* ── Lists: a letter or a search, in chunks of a hundred, each chunk three columns on a wide screen ─────────────── */
  function paintRows(from) {
    const upto = Math.min(S.rows.length, S.shown);
    const list = $('#lx-list');
    if (!from) list.innerHTML = '';
    list.removeAttribute('aria-busy');
    if (upto > from) list.insertAdjacentHTML('beforeend', `<ul class="lx-words">${S.rows.slice(from, upto).map(rowHTML).join('')}</ul>`);
    const more = $('#lx-more');
    more.hidden = upto >= S.rows.length;
    more.textContent = `Show ${Math.min(PAGE, S.rows.length - upto)} more`;
    $('#lx-shown').textContent = S.rows.length > PAGE ? `Showing ${nf(upto)} of ${nf(S.rows.length)}` : '';
  }
  function setRows(rows, head, count, empty) {
    S.rows = rows; S.shown = PAGE;
    $('#lx-head').textContent = head;
    $('#lx-count').textContent = count;
    $('#lx-empty').textContent = empty;
    $('#lx-empty').hidden = rows.length > 0;
    paintRows(0);
  }
  function busy(head) {
    $('#lx-head').textContent = head; $('#lx-count').textContent = '';
    $('#lx-list').innerHTML = `<ul class="lx-words">${skRows(9)}</ul>`;
    $('#lx-list').setAttribute('aria-busy', 'true');
    $('#lx-empty').hidden = true; $('#lx-more').hidden = true; $('#lx-shown').textContent = ''; $('#lx-lnav').innerHTML = '';
  }
  const failed = (msg) => { $('#lx-list').innerHTML = ''; $('#lx-list').removeAttribute('aria-busy'); $('#lx-empty').hidden = false; $('#lx-empty').innerHTML = retry(msg); };

  async function showLetter(l) {
    const seq = ++LSEQ;
    busy(l.toUpperCase());
    const rows = await letterRows(l);
    if (seq !== LSEQ) return;
    if (rows === null) { failed('This letter did not load.'); return; }
    const g = groupRows(rows);
    setRows(g, l.toUpperCase(), plural(g.length, 'term', 'terms'), `No term under ${l.toUpperCase()}.`);
    // the letters on either side, in the same alphabet
    const mine = SCRIPTS.find(([, , rx]) => rx.test(l));
    const ls = Object.keys(INDEX.letters).filter((x) => mine && mine[2].test(x));
    const i = ls.indexOf(l);
    const link = (x, arrow) => (x ? `<a href="${esc(urlFor({ letter: x }))}" data-nav>${arrow === 'prev' ? '← ' : ''}${esc(x.toUpperCase())}${arrow === 'next' ? ' →' : ''}</a>` : '<span></span>');
    $('#lx-lnav').innerHTML = `${link(ls[i - 1], 'prev')}${link(ls[i + 1], 'next')}`;
  }

  /* THE SEARCH. A form's shard (its first two letters) names the term for each Latin, Greek and English form that begins with what was typed.
     The headword's letter file holds the headwords that begin with it. Both land on the same rows. */
  const shardKey = (f) => f.slice(0, 2).replace(/ς/g, 'σ').replace(/[^\p{L}\p{N}]/gu, '_');
  const shardOf = (f) => once(`f:${shardKey(f)}`, async () => { const r = await get(`/v1/lexicon/forms/${encodeURIComponent(shardKey(f))}.json`); return r.data || (r.status === 404 ? {} : null); });
  async function search(q) {
    const f = fold(q);
    const [shard, own] = await Promise.all([shardOf(f), letterRows(f.slice(0, 1))]);
    if (shard === null && own === null) return null;
    const hits = new Map();
    const add = (id, rank, via) => { const h = hits.get(id); if (!h || rank < h.rank) hits.set(id, { rank, via }); };
    Object.entries(shard || {}).forEach(([k, id]) => { if (k === f) add(id, 0, k); else if (k.startsWith(f)) add(id, 2, k); });
    const byId = new Map();
    (own || []).forEach((r) => {
      byId.set(r[0], r);
      const h = fold(r[1]);
      if (h === f) add(r[0], 0, '');
      else if (h.startsWith(f)) add(r[0], 1, '');
      else if (h.split(' ').some((w) => w.startsWith(f))) add(r[0], 3, '');
      else if (fold(r[3]).startsWith(f) || fold(r[4]).startsWith(f)) add(r[0], 2, '');
    });
    const ordered = [...hits.entries()].sort((a, b) => a[1].rank - b[1].rank || ((byId.get(b[0]) || [])[2] || 0) - ((byId.get(a[0]) || [])[2] || 0)).slice(0, 200);
    // the terms a form names that sit under another letter: that letter's file gives their row
    const need = [...new Set(ordered.filter(([id]) => !byId.has(id)).slice(0, 60).map(([id]) => fold(id).slice(0, 1)))].slice(0, 10);
    const more = await Promise.all(need.map(letterRows));
    more.forEach((rs) => (rs || []).forEach((r) => { if (!byId.has(r[0])) byId.set(r[0], r); }));
    return ordered.map(([id, h]) => {
      const r = byId.get(id) || [id, id.replace(/-/g, ' '), 0, '', ''];
      return { id, hw: r[1], works: r[2], la: r[3], grc: r[4], n: 1, via: h.via && fold(h.via) !== fold(r[1]) ? h.via : '' };
    });
  }
  async function showSearch(q) {
    const seq = ++LSEQ;
    const head = `Results for “${q}”`;
    busy(head);
    if (fold(q).length < 2) { $('#lx-list').innerHTML = ''; $('#lx-list').removeAttribute('aria-busy'); $('#lx-empty').hidden = false; $('#lx-empty').textContent = 'Type two letters or more.'; return; }
    const rows = await search(q);
    if (seq !== LSEQ) return;
    if (rows === null) { failed('The search did not load.'); return; }
    setRows(rows, head, rows.length >= 200 ? '200 or more terms' : plural(rows.length, 'term', 'terms'), `No term matches “${q}”.`);
  }

  /* ── An entry, as a page of its own ──────────────────────────────────────────────────────────────────────────────── */
  const SRC = 3;
  const SSTEP = 10;
  const STEP = 20;
  const srcRow = ([w, p, a, ti]) => `<li><span class="lx-who">${a ? `<span class="lx-au">${esc(a)}</span>` : ''}<span class="lx-wk">${esc(ti || w)}</span></span><a class="lx-btn lx-open" href="${esc(read(w, p))}" aria-label="Open p. ${esc(p)} of ${esc(ti || w)}${esc(a ? ` by ${a}` : '')} in the reader">Open p. ${esc(p)}</a></li>`;
  function senseHTML(s, i, id) {
    const src = s.src || [];
    const n = src.length - SRC;
    const list = src.map((x, j) => srcRow(x).replace('<li>', j >= SRC ? '<li hidden>' : '<li>')).join('');
    return `<li class="lx-sense" id="s${i + 1}"><a class="lx-sn" href="#${encodeURIComponent(id)}/${i + 1}" aria-label="Sense ${i + 1}, link to this sense">${i + 1}</a><div><p class="lx-gloss">${esc(s.gloss)}</p>${src.length ? `<p class="lx-def">Defined by</p><ul class="lx-src">${list}${n > 0 ? `<li class="lx-srcmore"><button type="button" class="lx-link" data-srcmore aria-expanded="false" data-n="${n}">Show ${plural(n, 'more page', 'more pages')}</button></li>` : ''}</ul>` : ''}</div></li>`;
  }
  function formsHTML(t) {
    const part = (name, lang, xs) => {
      if (!xs || !xs.length) return '';
      const first = xs.slice(0, 10);
      const rest = xs.slice(10);
      return `<div><dt>${name}</dt><dd lang="${lang}">${first.map(esc).join(', ')}${rest.length ? `<span class="lx-rest" hidden>, ${rest.map(esc).join(', ')}</span> <button type="button" class="lx-link" data-formsmore aria-expanded="false" data-n="${rest.length}">and ${nf(rest.length)} more</button>` : ''}</dd></div>`;
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
  const who = (a) => (a ? `<span class="lx-au">${esc(a[0] || 'Unknown author')}</span>${a[1] ? ` (${esc(a[1])})` : ''}` : '');
  /* the works draw forty at a time as the page scrolls toward the end of the list, each century under its own head */
  const HSTEP = 40;
  function histRows(h, from, to, last) {
    let out = '';
    let lastC = last;
    h.rows.slice(from, to).forEach((r) => {
      const a = h.authors[r[2]] || [];
      const c = cent(a[2]);
      if (c !== lastC) { out += `<li class="lx-hc">${esc(c)}</li>`; lastC = c; }
      out += `<li class="lx-hr"><p class="lx-hw2">${who(a)}${a.length ? ', ' : ''}<a href="${esc(read(r[0], r[3]))}">${esc(r[1] || r[0])}, p. ${esc(r[3])}</a>${r[5] > 1 ? ` (${nf(r[5])} pages)` : ''}</p><p>${esc(r[4])}</p></li>`;
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
    const method = window.TFRMethod ? window.TFRMethod.html("<p>Each line is a one-line English summary made by machine. Open the page to read the author\u2019s own words.</p>") : '';
    box.innerHTML = `<h2 id="lx-hist-h">Every work that defines it <small>${nf(h.works)}</small></h2><p class="lx-hnote">${span}</p>${method}<ol class="lx-hlist">${html}</ol><div class="lx-sentinel" aria-hidden="true"></div>`;
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
    el.scrollIntoView({ block: 'start', behavior: 'auto' });
  }
  const crumb = (l) => `<nav class="lx-crumb" aria-label="Breadcrumb"><a href="${PATH}" data-nav>Lexicon</a>${l ? ` <span aria-hidden="true">/</span> <a href="${esc(urlFor({ letter: l }))}" data-nav>${esc(l.toUpperCase())}</a>` : ''}</nav>`;
  async function openEntry(id, sense) {
    show('entry');
    if (S.id === id) { if (S.rendered === id) focusSense(sense); else S.sense = sense; return; }
    const seq = ++TSEQ;
    S.id = id; S.rendered = ''; S.sense = sense;
    if (IO) { IO.disconnect(); IO = null; }
    const box = $('#lx-entry');
    box.innerHTML = `${crumb('')}${skEntry}`;
    $('#lx-live').textContent = 'Loading the term';
    window.scrollTo(0, 0);
    const t = await loadTerm(id);
    if (seq !== TSEQ) return;
    if (t && t.missing) { box.innerHTML = `${crumb('')}<p class="lx-note">No term has the address “${esc(id)}”.</p>`; return; }
    if (!t) { box.innerHTML = `${crumb('')}${retry('This term did not load.')}`; return; }
    const tid = t.id || id;
    if (tid !== id) { history.replaceState(null, '', `${location.pathname}${location.search}#${encodeURIComponent(tid)}${S.sense ? `/${S.sense}` : ''}`); S.id = tid; }
    // the headword's letter file: whether the term is filed more than once, and the terms on either side
    const hw = String(t.headword || '');
    const hk = hw.toLowerCase();
    const hl = fold(hk).slice(0, 1);
    const rows = (await letterRows(hl)) || [];
    if (seq !== TSEQ) return;
    const sib = rows.filter((x) => String(x[1]).toLowerCase() === hk && x[0] !== tid).sort((a, b) => (b[2] || 0) - (a[2] || 0));
    const order = groupRows(rows);
    const at = order.findIndex((r) => String(r.hw).toLowerCase() === hk);
    const pn = (r, dir) => (r ? `<a class="lx-pn lx-pn-${dir}" href="#${encodeURIComponent(r.id)}"><span>${dir === 'prev' ? 'Previous term' : 'Next term'}</span><b lang="${scriptOf(r.hw)}" dir="auto">${esc(r.hw)}</b></a>` : '<span></span>');
    const also = sib.length ? `<p class="lx-also">Also filed as ${sib.map((x) => `<a href="#${encodeURIComponent(x[0])}">${esc([x[3], x[4]].filter(Boolean).join(' / ') || x[1])}</a> <span class="lx-via">${plural(x[2], 'work', 'works')}</span>`).join(', ')}</p>` : '';
    const senses = t.senses || [];
    let shown = Math.min(senses.length, Math.max(SSTEP, Math.ceil(S.sense / STEP) * STEP));
    const moreLabel = () => `Show ${plural(Math.min(STEP, senses.length - shown), 'more sense', 'more senses')}`;
    const moreBtn = () => (senses.length > shown ? `<button type="button" class="lx-btn" id="lx-smore">${moreLabel()}</button>` : '');
    document.title = `${hw} | ${TITLE}`;
    const lang = scriptOf(hw);
    const langs = [t.latin && t.latin.length ? 'Latin' : '', t.greek && t.greek.length ? 'Greek' : ''].filter(Boolean);
    const fact = (k, v, idv, hide) => `<div${hide ? ' hidden' : ''}><dt>${k}</dt><dd${idv ? ` id="${idv}"` : ''}>${v}</dd></div>`;
    box.innerHTML = `${crumb(hl)}<div class="lx-ent">
<header class="lx-eh"><h1 id="lx-title" tabindex="-1" lang="${lang}" dir="auto">${esc(hw)}</h1>${formsHTML(t)}${also}</header>
<aside class="lx-facts" aria-label="Quick facts about ${esc(hw)}"><h2>Quick facts</h2><dl>${fact('Headword', { en: 'English', grc: 'Greek', he: 'Hebrew' }[lang])}${langs.length ? fact('Forms in', langs.join(' and ')) : ''}${fact('Senses', nf(senses.length))}${t.works ? fact('Works', nf(t.works)) : ''}${fact('Authors', '', 'lx-f-authors', true)}${fact('Earliest source', '', 'lx-f-first', true)}</dl><button type="button" class="lx-btn" data-copy>Copy link</button></aside>
<div class="lx-body">${senses.length ? `<section aria-labelledby="lx-sen-h"><h2 id="lx-sen-h">Senses <small>${nf(senses.length)}</small></h2><ol class="lx-senses">${senses.slice(0, shown).map((s, i) => senseHTML(s, i, tid)).join('')}</ol>${moreBtn()}</section>` : '<p class="lx-note">This term has no sense recorded yet.</p>'}
<section class="lx-hist" id="lx-hist"></section>
<nav class="lx-pnav" aria-label="Neighboring terms">${pn(order[at - 1], 'prev')}${pn(order[at + 1], 'next')}</nav></div></div>`;
    S.rendered = tid;
    $('#lx-live').textContent = `${hw}, ${plural(senses.length, 'sense', 'senses')}`;
    const want = S.sense;
    box.onclick = (e) => {
      const sm = e.target.closest('#lx-smore');
      if (sm) {
        const from = shown;
        shown = Math.min(senses.length, shown + STEP);
        $('#lx-entry .lx-senses').insertAdjacentHTML('beforeend', senses.slice(from, shown).map((s, j) => senseHTML(s, from + j, tid)).join(''));
        if (senses.length > shown) { sm.textContent = moreLabel(); return; }
        const next = $('#lx-entry .lx-senses').children[from];
        sm.remove();
        if (next) { next.tabIndex = -1; next.focus({ preventScroll: true }); }
        return;
      }
      const sr = e.target.closest('[data-srcmore]');
      if (sr) {
        const open = sr.getAttribute('aria-expanded') !== 'true';
        const n = Number(sr.dataset.n);
        sr.closest('ul').querySelectorAll('li:not(.lx-srcmore)').forEach((li, j) => { if (j >= SRC) li.hidden = !open; });
        sr.setAttribute('aria-expanded', String(open));
        sr.textContent = open ? 'Show fewer pages' : `Show ${plural(n, 'more page', 'more pages')}`;
        return;
      }
      const fm = e.target.closest('[data-formsmore]');
      if (fm) {
        const open = fm.getAttribute('aria-expanded') !== 'true';
        fm.previousElementSibling.hidden = !open;
        fm.setAttribute('aria-expanded', String(open));
        fm.textContent = open ? 'Show fewer' : `and ${nf(Number(fm.dataset.n))} more`;
        return;
      }
      const cp = e.target.closest('[data-copy]');
      if (cp) copyLink(cp, tid);
    };
    const title = $('#lx-title');
    if (want) focusSense(want); else if (title) title.focus({ preventScroll: true });
    showHistory(tid, seq);
  }
  async function copyLink(btn, id) {
    const url = `${location.origin}${PATH}#${encodeURIComponent(id)}`;
    try { await navigator.clipboard.writeText(url); btn.textContent = 'Link copied'; $('#lx-live').textContent = 'Link copied'; } catch (_) { btn.textContent = 'Copy failed'; }
    setTimeout(() => { btn.textContent = 'Copy link'; }, 2000);
  }

  /* ── Routing: the address is the state ───────────────────────────────────────────────────────────────────────────── */
  function show(view) {
    $('#lx-hero').hidden = view === 'entry';
    $('#lx-front').hidden = view !== 'front';
    $('#lx-results').hidden = view !== 'list';
    $('#lx-entry').hidden = view !== 'entry';
    $('#lx-find').hidden = false;
  }
  let listScroll = 0;
  let wasEntry = false;
  let viaHistory = false;
  let booted = false;
  function route() {
    if (!INDEX) return;
    const { id, sense } = parseHash();
    const sp = new URLSearchParams(location.search);
    S.q = (sp.get('q') || '').slice(0, 80);
    S.letter = sp.get('l') && Object.hasOwn(INDEX.letters, sp.get('l')) ? sp.get('l') : '';
    if (id) {
      if (!wasEntry) listScroll = window.scrollY;
      wasEntry = true;
      openEntry(id, sense);
      return;
    }
    const back = wasEntry && viaHistory;
    viaHistory = false;
    wasEntry = false; S.id = ''; S.rendered = ''; TSEQ += 1;
    const mine = TSEQ;
    if (IO) { IO.disconnect(); IO = null; }
    document.title = TITLE;
    if (document.activeElement !== $('#lx-q')) $('#lx-q').value = S.q;
    let done;
    if (S.q) { show('list'); done = showSearch(S.q); } else if (S.letter) { show('list'); done = showLetter(S.letter); } else { show('front'); done = Promise.resolve(); }
    Promise.resolve(done).then(() => {
      if (mine !== TSEQ) return;
      const typing = document.activeElement === $('#lx-q');
      if (back) window.scrollTo(0, listScroll); else if (!typing) window.scrollTo(0, 0);
      if (booted && !typing) { const h = S.q || S.letter ? $('#lx-head') : $('#lx-az-h'); h.tabIndex = -1; h.focus({ preventScroll: true }); }
      booted = true;
    });
  }

  /* ── Wiring ──────────────────────────────────────────────────────────────────────────────────────────────────────── */
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-retry]')) { S.id = ''; if (INDEX) route(); else init(); return; }
    const nav = e.target.closest('a[data-nav]');
    if (nav && !(e.metaKey || e.ctrlKey || e.shiftKey || e.button)) { e.preventDefault(); go(nav.getAttribute('href'), true); return; }
    if (e.target.closest('#lx-more')) {
      const from = S.shown;
      S.shown = Math.min(S.rows.length, S.shown + PAGE);
      paintRows(from);
      const next = $('#lx-list').lastElementChild.querySelector('a');
      if (next) next.focus({ preventScroll: true });
    }
  });
  let findT = 0;
  $('#lx-q').addEventListener('input', () => {
    clearTimeout(findT);
    findT = setTimeout(() => {
      S.q = $('#lx-q').value.trim();
      go(urlFor({ q: S.q }), !!parseHash().id);
    }, 200);
  });
  $('#lx-find').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearTimeout(findT);
    S.q = $('#lx-q').value.trim();
    if (fold(S.q).length < 2) return;
    const rows = await search(S.q);
    if (rows && rows.length) { history.pushState(null, '', urlFor({ q: S.q })); location.hash = `#${encodeURIComponent(rows[0].id)}`; } else go(urlFor({ q: S.q }), false);
  });
  // Back and Forward between hash states fire both events: one route a tick
  let routeT = 0;
  const routeSoon = () => { clearTimeout(routeT); viaHistory = true; routeT = setTimeout(route, 0); };
  window.addEventListener('hashchange', routeSoon);
  window.addEventListener('popstate', routeSoon);

  async function init() {
    // a link to a term (the reader's Define popover) opens on the entry: no hero and no front page flash first
    if (parseHash().id) { $('#lx-hero').hidden = true; $('#lx-front').hidden = true; $('#lx-entry').hidden = false; $('#lx-entry').innerHTML = skEntry; }
    $('#lx-top').innerHTML = skRows(6);
    const r = await get('/v1/lexicon/index.json');
    if (!r.data) { $('#lx-top').innerHTML = ''; $('#lx-boot').hidden = false; $('#lx-boot').innerHTML = retry('The lexicon did not load.'); return; }
    INDEX = r.data;
    $('#lx-boot').hidden = true;
    paintFront();
    route();
  }
  init();
})();
