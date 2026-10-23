/* The Lexicon (/the-faith-received/lexicon/). The library worker's v1/lexicon files:
     index.json                 the alphabet (letters and their counts) and the most defined terms
     letters/<letter>.json      rows [id, headword, works, Latin form, Greek form] for a letter
     forms/<two letters>.json   form -> term id, for the search box
     terms/<id>.json            the headword, its forms and its senses; a sense is a gloss and the pages that define it
     history/<n>.json.gz        every work that defines a term, oldest author first
     redirects.json             an id merged into another entry
   Every string in these files is data. Each one goes through esc() before it is drawn, and a link is built from encodeURIComponent.
   The Define popover in the reader links here by #<term id>. A sense is #<term id>/<number>. The list state is ?l=<letter>, ?t=<tab>, ?q=<text>. */
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

  /* A file the library has not got (404, 410) is status 404. One it could not be asked for (the network, a 5xx, a 429) is asked again twice
     first, then status 0. The two read differently: a missing term says so, a failed one offers another try. */
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

  /* ── State and address ───────────────────────────────────────────────────────────────────────────────────────────── */
  const TABS = [['all', 'All'], ['en', 'English'], ['grc', 'Greek'], ['he', 'Hebrew']];
  const SCRIPT_RX = { en: /^[a-zæœ]$/, grc: /^[Ͱ-Ͽἀ-῿]$/, he: /^[֐-׿]$/ };
  const S = { tab: 'all', letter: '', q: '', rows: [], shown: 0, heading: '', id: '', rendered: '' };
  let INDEX = null;
  let LSEQ = 0;
  let TSEQ = 0;
  let IO = null;
  const PAGE = 100;

  function parseHash() {
    let h = '';
    try { h = decodeURIComponent(location.hash.slice(1)); } catch (_) { h = ''; }
    const m = /^(.*?)(?:\/(\d+))?$/.exec(h);
    return { id: m ? m[1] : '', sense: m && m[2] ? Number(m[2]) : 0 };
  }
  function listUrl() {
    const p = new URLSearchParams();
    if (S.tab !== 'all') p.set('t', S.tab);
    if (S.q) p.set('q', S.q);
    else if (S.letter) p.set('l', S.letter);
    const s = p.toString();
    return `${PATH}${s ? `?${s}` : ''}`;
  }
  const go = (url, push) => { history[push ? 'pushState' : 'replaceState'](null, '', url); route(); };

  /* ── Skeletons ───────────────────────────────────────────────────────────────────────────────────────────────────── */
  const skRows = (n) => Array.from({ length: n }, (_, i) => `<li class="lx-sk-row" aria-hidden="true"><span class="lx-sk" style="width:${38 + ((i * 17) % 40)}%"></span><span class="lx-sk lx-sk-s" style="width:${24 + ((i * 11) % 30)}%"></span></li>`).join('');
  const skEntry = '<div class="lx-sk-entry" aria-hidden="true"><span class="lx-sk lx-sk-h"></span><span class="lx-sk" style="width:60%"></span><span class="lx-sk" style="width:90%"></span><span class="lx-sk" style="width:84%"></span><span class="lx-sk" style="width:72%"></span></div><p class="sr" role="status">Loading the term</p>';
  const retry = (what) => `<p class="lx-note">${what} <button type="button" class="lx-btn" data-retry>Try again</button></p>`;

  /* ── Letters and rows ────────────────────────────────────────────────────────────────────────────────────────────── */
  const letterRows = (l) => (l && INDEX && Object.hasOwn(INDEX.letters, l) ? once(`l:${l}`, async () => { const r = await get(`/v1/lexicon/letters/${encodeURIComponent(l)}.json`); return r.data || (r.status === 404 ? [] : null); }) : Promise.resolve([]));
  /* one row a headword: the lexicon filed some headwords several times (wages: merces, merces with ὀψώνια, opsōnion). The list shows each once,
     with the fullest entry, and the entry opened names the others under "Also filed as". */
  function groupRows(rows) {
    const by = new Map();
    rows.forEach((r) => { const k = String(r[1]).toLowerCase(); if (!by.has(k)) by.set(k, []); by.get(k).push(r); });
    return [...by.values()].map((v) => { v.sort((a, b) => (b[2] || 0) - (a[2] || 0)); const r = v[0]; return { id: r[0], hw: r[1], works: r[2], la: r[3], grc: r[4], n: v.length, via: r.via || '' }; });
  }
  function rowHTML(r) {
    const forms = [r.la ? `<span class="lx-lb">Latin</span> <i lang="la">${esc(r.la)}</i>` : '', r.grc ? `<span class="lx-lb">Greek</span> <span lang="grc">${esc(r.grc)}</span>` : ''].filter(Boolean);
    const via = r.via ? `<span class="lx-via">as ${esc(r.via)}</span>` : '';
    return `<li><a class="lx-row" href="#${encodeURIComponent(r.id)}"><span class="lx-hw" lang="${scriptOf(r.hw)}" dir="auto">${esc(r.hw)}</span>${r.n > 1 ? `<span class="lx-via">${r.n} entries</span>` : ''}<span class="lx-n">${r.works ? plural(r.works, 'work', 'works') : ''}</span>${forms.length || via ? `<span class="lx-fm">${forms.join('')}${via}</span>` : ''}</a></li>`;
  }
  function paintRows() {
    const list = $('#lx-list');
    const upto = Math.min(S.rows.length, S.shown);
    list.innerHTML = S.rows.slice(0, upto).map(rowHTML).join('');
    list.removeAttribute('aria-busy');
    const more = $('#lx-more');
    more.hidden = upto >= S.rows.length;
    more.textContent = `Show ${Math.min(PAGE, S.rows.length - upto)} more`;
    $('#lx-shown').textContent = S.rows.length > PAGE ? `Showing ${nf(upto)} of ${nf(S.rows.length)}` : '';
  }
  function setRows(rows, heading, count) {
    S.rows = rows; S.shown = PAGE; S.heading = heading;
    $('#lx-head').textContent = heading;
    $('#lx-count').textContent = count;
    paintRows();
    $('#lx-empty').hidden = rows.length > 0;
  }
  function busy() {
    $('#lx-list').innerHTML = skRows(8);
    $('#lx-list').setAttribute('aria-busy', 'true');
    $('#lx-empty').hidden = true; $('#lx-more').hidden = true; $('#lx-shown').textContent = '';
  }

  let barTab = '';
  function paintBar() {
    if (barTab === S.tab) {
      document.querySelectorAll('#lx-letters [data-l]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.l === S.letter && !S.q)));
      document.querySelectorAll('#lx-tabs [data-t]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.t === S.tab)));
      return;
    }
    barTab = S.tab;
    const all = Object.keys(INDEX.letters).filter((l) => l !== '_');
    const groups = [['en', 'English'], ['grc', 'Greek'], ['he', 'Hebrew']].filter(([k]) => S.tab === 'all' || S.tab === k)
      .map(([k, name]) => [k, name, all.filter((l) => SCRIPT_RX[k].test(l))]).filter(([, , ls]) => ls.length);
    $('#lx-letters').innerHTML = groups.map(([k, name, ls]) => `<div class="lx-az-g" role="group" aria-label="${esc(name)} letters">${ls.map((l) => `<button type="button" data-l="${esc(l)}" lang="${k === 'en' ? 'en' : k}" aria-pressed="${l === S.letter && !S.q}" aria-label="${esc(l.toUpperCase())}, ${plural(INDEX.letters[l], 'term', 'terms')}">${esc(l.toUpperCase())}</button>`).join('')}</div>`).join('');
    document.querySelectorAll('#lx-tabs [data-t]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.t === S.tab)));
  }

  /* ── The list view: the most defined terms, a letter, or a search ───────────────────────────────────────────────── */
  async function showLetter(l) {
    const seq = ++LSEQ;
    busy();
    $('#lx-head').textContent = `Terms under ${l.toUpperCase()}`; $('#lx-count').textContent = '';
    const rows = await letterRows(l);
    if (seq !== LSEQ) return;
    if (rows === null) { $('#lx-list').innerHTML = ''; $('#lx-list').removeAttribute('aria-busy'); $('#lx-empty').hidden = false; $('#lx-empty').innerHTML = retry('This letter did not load.'); return; }
    $('#lx-empty').textContent = `No term under ${l.toUpperCase()}.`;
    const g = groupRows(rows);
    setRows(g, `Terms under ${l.toUpperCase()}`, plural(g.length, 'term', 'terms'));
  }
  function showTop() {
    const g = groupRows(INDEX.top.slice(0, 120));
    $('#lx-empty').textContent = 'Nothing to show.';
    setRows(g, 'The most defined terms', plural(g.length, 'term', 'terms'));
  }

  /* THE SEARCH. A form's shard (its first two letters) names the term for each Latin, Greek and English form that begins with what was typed.
     The headword's letter file holds the headwords that begin with it. Both land on the same rows. */
  const shardKey = (f) => f.slice(0, 2).replace(/ς/g, 'σ').replace(/[^\p{L}\p{N}]/gu, '_');
  const shardOf = (f) => once(`f:${shardKey(f)}`, async () => { const r = await get(`/v1/lexicon/forms/${encodeURIComponent(shardKey(f))}.json`); return r.data || (r.status === 404 ? {} : null); });
  async function search(q) {
    const f = fold(q);
    const first = f.slice(0, 1);
    const [shard, own] = await Promise.all([shardOf(f), letterRows(first)]);
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
    // the terms named by a form that sit under another letter: that letter's file gives their row
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
    busy();
    $('#lx-head').textContent = `Results for “${q}”`; $('#lx-count').textContent = '';
    if (fold(q).length < 2) { $('#lx-list').innerHTML = ''; $('#lx-list').removeAttribute('aria-busy'); $('#lx-empty').hidden = false; $('#lx-empty').textContent = 'Type two letters or more.'; return; }
    const rows = await search(q);
    if (seq !== LSEQ) return;
    if (rows === null) { $('#lx-list').innerHTML = ''; $('#lx-list').removeAttribute('aria-busy'); $('#lx-empty').hidden = false; $('#lx-empty').innerHTML = retry('The search did not load.'); return; }
    $('#lx-empty').textContent = `No term matches “${q}”.`;
    setRows(rows, `Results for “${q}”`, rows.length >= 200 ? '200 or more terms' : plural(rows.length, 'term', 'terms'));
  }

  function showList() {
    $('#lx-entry').hidden = true; $('#lx-browse').hidden = false;
    document.title = TITLE;
    if (IO) { IO.disconnect(); IO = null; }
    if (document.activeElement !== $('#lx-q')) $('#lx-q').value = S.q;
    paintBar();
    if (S.q) return showSearch(S.q);
    if (S.letter) return showLetter(S.letter);
    if (S.tab === 'grc' || S.tab === 'he') {
      const first = Object.keys(INDEX.letters).find((l) => SCRIPT_RX[S.tab].test(l));
      if (first) { S.letter = first; history.replaceState(null, '', listUrl()); paintBar(); return showLetter(first); }
    }
    return showTop();
  }

  /* ── An entry ────────────────────────────────────────────────────────────────────────────────────────────────────── */
  const SRC = 3;
  const SSTEP = 12;
  const STEP = 20;
  const srcRow = ([w, p, a, ti], j) => {
    return `<li${j >= SRC ? ' hidden' : ''}><span class="lx-who">${a ? `<span class="lx-au">${esc(a)}</span>, ` : ''}${esc(ti || w)}</span><a class="lx-btn lx-open" href="${esc(read(w, p))}" aria-label="Open p. ${esc(p)} of ${esc(ti || w)}${esc(a ? ` by ${a}` : '')} in the reader">Open p. ${esc(p)}</a></li>`;
  };
  function senseHTML(s, i, id) {
    const src = s.src || [];
    const n = src.length - SRC;
    return `<li class="lx-sense" id="s${i + 1}"><a class="lx-sn" href="#${encodeURIComponent(id)}/${i + 1}" aria-label="Sense ${i + 1}, link to this sense">${i + 1}</a><div><p class="lx-gloss">${esc(s.gloss)}</p>${src.length ? `<p class="lx-def">Defined on</p><ul class="lx-src">${src.map(srcRow).join('')}${n > 0 ? `<li class="lx-srcmore"><button type="button" class="lx-link" data-srcmore aria-expanded="false" data-n="${n}">Show ${plural(n, 'more page', 'more pages')}</button></li>` : ''}</ul>` : ''}</div></li>`;
  }
  function formsHTML(t) {
    const part = (name, lang, xs) => {
      if (!xs || !xs.length) return '';
      const first = xs.slice(0, 12);
      const rest = xs.slice(12);
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
  /* the works draw forty at a time, as the page scrolls toward the end of the list, each century under its own head */
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
    const span = a0 && a1 && a0 !== a1 ? `From ${esc(a0[0])} to ${esc(a1[0])}, oldest first.` : 'Oldest first.';
    const [html, lastC0] = histRows(h, 0, HSTEP, null);
    let lastC = lastC0;
    let drawn = Math.min(HSTEP, h.rows.length);
    const method = window.TFRMethod ? window.TFRMethod.html("<p>Each line is a one-line English summary made by machine. Open the page to read the author's own words.</p>") : '';
    box.innerHTML = `<h3 id="lx-hist-h">Every work that defines it <small>${nf(h.works)}</small></h3><p class="lx-hnote">${span}</p>${method}<ol class="lx-hlist">${html}</ol><div class="lx-sentinel" aria-hidden="true"></div>`;
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
    let r = await get(`/v1/lexicon/terms/${encodeURIComponent(id)}.json`);
    // an id merged into another entry: redirects.json names the entry that holds it now
    if (r.status === 404) {
      if (REDIR === null) REDIR = (await get('/v1/lexicon/redirects.json')).data || {};
      const to = Object.hasOwn(REDIR, id) ? REDIR[id] : '';
      if (to && to !== id) r = await get(`/v1/lexicon/terms/${encodeURIComponent(to)}.json`);
    }
    return r;
  }
  function focusSense(n) {
    document.querySelectorAll('#lx-entry .lx-sense.is-target').forEach((e) => e.classList.remove('is-target'));
    const el = n ? document.getElementById(`s${n}`) : null;
    if (!el) return;
    el.classList.add('is-target');
    el.scrollIntoView({ block: 'start', behavior: 'auto' });
  }
  async function openEntry(id, sense) {
    $('#lx-browse').hidden = true; $('#lx-entry').hidden = false;
    if (S.id === id) { if (S.rendered === id) focusSense(sense); else S.sense = sense; return; }
    const seq = ++TSEQ;
    S.id = id; S.rendered = ''; S.sense = sense;
    if (IO) { IO.disconnect(); IO = null; }
    const box = $('#lx-entry');
    box.innerHTML = skEntry;
    window.scrollTo(0, 0);
    const r = await loadTerm(id);
    if (seq !== TSEQ) return;
    if (r.status === 404) { box.innerHTML = `<p class="lx-back"><a href="${esc(listUrl())}" data-list>All terms</a></p><p class="lx-note">No term has the address “${esc(id)}”.</p>`; return; }
    if (!r.data) { box.innerHTML = `<p class="lx-back"><a href="${esc(listUrl())}" data-list>All terms</a></p>${retry('This term did not load.')}`; return; }
    const t = r.data;
    const tid = t.id || id;
    if (tid !== id) { history.replaceState(null, '', `${location.pathname}${location.search}#${encodeURIComponent(tid)}${S.sense ? `/${S.sense}` : ''}`); S.id = tid; }
    // the headword's letter file tells whether the term is filed more than once
    const hk = String(t.headword || '').toLowerCase();
    const rows = await letterRows(fold(hk).slice(0, 1));
    if (seq !== TSEQ) return;
    const sib = (rows || []).filter((x) => String(x[1]).toLowerCase() === hk && x[0] !== tid).sort((a, b) => (b[2] || 0) - (a[2] || 0));
    const also = sib.length ? `<p class="lx-also">Also filed as ${sib.map((x) => `<a href="#${encodeURIComponent(x[0])}">${esc([x[3], x[4]].filter(Boolean).join(' / ') || x[1])}</a> <span class="lx-via">${plural(x[2], 'work', 'works')}</span>`).join(', ')}</p>` : '';
    const senses = t.senses || [];
    let shown = Math.min(senses.length, Math.max(SSTEP, Math.ceil(S.sense / STEP) * STEP));
    const moreLabel = () => `Show ${plural(Math.min(STEP, senses.length - shown), 'more sense', 'more senses')}`;
    const moreBtn = () => (senses.length > shown ? `<button type="button" class="lx-btn" id="lx-smore">${moreLabel()}</button>` : '');
    document.title = `${t.headword} | ${TITLE}`;
    const hw = String(t.headword || '');
    box.innerHTML = `<p class="lx-back"><a href="${esc(listUrl())}" data-list>All terms</a></p>
<header class="lx-eh"><h2 id="lx-title" tabindex="-1" lang="${scriptOf(hw)}" dir="auto">${esc(hw)}</h2><p class="lx-meta">${[senses.length ? plural(senses.length, 'sense', 'senses') : '', t.works ? plural(t.works, 'work', 'works') : ''].filter(Boolean).join(' · ')}<button type="button" class="lx-btn" data-copy>Copy link</button></p></header>${formsHTML(t)}${also}${
      senses.length ? `<section aria-labelledby="lx-sen-h"><h3 id="lx-sen-h">Senses <small>${nf(senses.length)}</small></h3><ol class="lx-senses">${senses.slice(0, shown).map((s, i) => senseHTML(s, i, tid)).join('')}</ol>${moreBtn()}</section>` : '<p class="lx-note">This term has no sense recorded yet.</p>'
    }<section class="lx-hist" id="lx-hist"></section>`;
    S.rendered = tid;
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
    try { await navigator.clipboard.writeText(url); btn.textContent = 'Link copied'; } catch (_) { btn.textContent = 'Copy failed'; }
    setTimeout(() => { btn.textContent = 'Copy link'; }, 2000);
  }

  /* ── Routing: the address is the state. #<id> is an entry, #<id>/<n> a sense; no hash is the list. ──────────────── */
  let listScroll = 0;
  let wasEntry = false;
  function route() {
    if (!INDEX) return;
    const { id, sense } = parseHash();
    const sp = new URLSearchParams(location.search);
    S.tab = TABS.some(([k]) => k === sp.get('t')) ? sp.get('t') : 'all';
    S.q = (sp.get('q') || '').slice(0, 80);
    S.letter = sp.get('l') && Object.hasOwn(INDEX.letters, sp.get('l')) ? sp.get('l') : '';
    if (id) {
      if (!wasEntry) listScroll = window.scrollY;
      wasEntry = true;
      openEntry(id, sense);
      return;
    }
    const back = wasEntry;
    wasEntry = false; S.id = ''; S.rendered = '';
    TSEQ += 1;
    Promise.resolve(showList()).then(() => { if (back) { window.scrollTo(0, listScroll); const h = $('#lx-head'); h.tabIndex = -1; h.focus({ preventScroll: true }); } });
  }

  /* ── Wiring ──────────────────────────────────────────────────────────────────────────────────────────────────────── */
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-retry]')) { S.id = ''; if (INDEX) route(); else init(); return; }
    const t = e.target.closest('#lx-tabs [data-t]');
    if (t) { if (t.dataset.t === S.tab && !S.q && !S.letter) return; S.tab = t.dataset.t; S.q = ''; S.letter = ''; go(listUrl(), true); return; }
    const l = e.target.closest('#lx-letters [data-l]');
    if (l) { if (l.dataset.l === S.letter && !S.q) return; S.q = ''; S.letter = l.dataset.l; go(listUrl(), true); return; }
    const back = e.target.closest('[data-list]');
    if (back && !(e.metaKey || e.ctrlKey || e.shiftKey || e.button)) { e.preventDefault(); go(back.getAttribute('href'), true); return; }
    if (e.target.closest('#lx-more')) {
      const from = S.shown;
      S.shown = Math.min(S.rows.length, S.shown + PAGE);
      $('#lx-list').insertAdjacentHTML('beforeend', S.rows.slice(from, S.shown).map(rowHTML).join(''));
      const more = $('#lx-more');
      more.hidden = S.shown >= S.rows.length;
      more.textContent = `Show ${Math.min(PAGE, S.rows.length - S.shown)} more`;
      $('#lx-shown').textContent = `Showing ${nf(S.shown)} of ${nf(S.rows.length)}`;
      const nextRow = $('#lx-list').children[from];
      if (nextRow) { const a = nextRow.querySelector('a'); if (a) a.focus({ preventScroll: true }); }
    }
  });
  let findT = 0;
  $('#lx-q').addEventListener('input', () => {
    clearTimeout(findT);
    findT = setTimeout(() => {
      S.q = $('#lx-q').value.trim();
      if (S.q) S.letter = '';
      go(listUrl(), !!parseHash().id);
    }, 200);
  });
  $('#lx-find').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearTimeout(findT);
    S.q = $('#lx-q').value.trim();
    if (fold(S.q).length < 2) return;
    const rows = await search(S.q);
    if (rows && rows.length) { history.pushState(null, '', listUrl()); location.hash = `#${encodeURIComponent(rows[0].id)}`; }
    else go(listUrl(), false);
  });
  // Back and Forward between hash states fire both events: one route a tick
  let routeT = 0;
  const routeSoon = () => { clearTimeout(routeT); routeT = setTimeout(route, 0); };
  window.addEventListener('hashchange', routeSoon);
  window.addEventListener('popstate', routeSoon);

  async function init() {
    $('#lx-list').innerHTML = skRows(8);
    $('#lx-list').setAttribute('aria-busy', 'true');
    const r = await get('/v1/lexicon/index.json');
    if (!r.data) { $('#lx-list').innerHTML = ''; $('#lx-list').removeAttribute('aria-busy'); $('#lx-empty').hidden = false; $('#lx-empty').innerHTML = retry('The lexicon did not load.'); return; }
    INDEX = r.data;
    $('#lx-empty').hidden = true;
    $('#lx-tabs').innerHTML = TABS.map(([k, name]) => `<button type="button" data-t="${k}" aria-pressed="false">${name}</button>`).join('');
    route();
  }
  init();
})();
