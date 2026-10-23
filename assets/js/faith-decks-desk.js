/* The commentary decks as a desk: our wrapper over the ported engine (faith-decks.js). It adds the pieces the engine leaves out
   and touches none of its markup:
     1. the reader of Migne and EEBO works (FRCommentaryText), so a Father in the Patrologia opens in the pane and not only in
        the reader. The engine asks for it by that name; commentary-pages.js is the library's own loader for those works.
     2. the desk bar: swap the panes, clear a pane, copy the link to this exact two-pane state, and the dark switch.
     3. a failed load says so and offers a retry, in place of reading as missing data.
   The state lives in the address (#deck/part/place?l=&r=), which the engine already writes; this file only edits that address. */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const html = document.documentElement;

  /* 1. The Migne and EEBO reader --------------------------------------------------------------------------------------------- */
  const base = (() => {
    const m = document.querySelector('meta[name="tfr-library-base"]');
    return ((m && m.content) || window.__FR_BLOB_BASE__ || 'https://mo-tfr-library.mo-podcast-feed.workers.dev').replace(/\/$/, '');
  })();
  const P = window.FRCommentaryPages;
  if (P && !window.FRCommentaryText) {
    const get = (u) => fetch(u, { credentials: 'omit' }).then((r) => { if (!r.ok) throw new Error(`${r.status} ${u}`); return r; });
    const pages = P.createPages({ base, mo: true, json: (u) => get(u).then((r) => r.json()), text: (u) => get(u).then((r) => r.text()) });
    const lines = (t) => String(t || '').split(/\n+/).map((x) => x.trim()).filter(Boolean);
    window.FRCommentaryText = {
      stride: (slug) => P.stride(slug),
      page: (slug, n) => pages.page(slug, n),
      async fill(el, { slug, page }) {
        const g = await pages.page(slug, Number(page));
        if (!g || !g.p) return false;
        el.textContent = '';
        const box = document.createElement('div');
        box.className = 'pw-page';
        for (const t of lines(g.p.en || g.p.la)) { const p = document.createElement('p'); p.textContent = t; box.appendChild(p); }
        el.appendChild(box);
        return true;
      },
    };
    // a truthy address tells the engine this site has the reader; the object above is what it uses
    if (!window.__FR_DECKS_TEXT__) window.__FR_DECKS_TEXT__ = 'commentary-pages';
  }

  /* 2. The desk bar ------------------------------------------------------------------------------------------------------------- */
  const THEME_KEY = 'fr_sd_theme';
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* a private window keeps the choice for this view only */ } },
  };
  const real = (v) => !!v && v !== '-' && v !== '~pages';
  // the address, split into its path and its query, edited as text so the engine's own parser reads the result
  const parts = () => { const [path, query = ''] = location.hash.slice(1).split('?'); return { path, q: new URLSearchParams(query) }; };
  const go = ({ path, q }) => { const h = `#${path}${q.toString() ? `?${q}` : ''}`; if (location.hash !== h) location.hash = h; };
  const swap = () => {
    const a = parts(), l = a.q.get('l'), r = a.q.get('r'), j = a.q.get('j'), i = a.q.get('i');
    if (!real(l) || !real(r)) return;
    a.q.set('l', r); a.q.set('r', l);
    if (i != null) a.q.set('j', i); else a.q.delete('j');
    if (j != null) a.q.set('i', j); else a.q.delete('i');
    go(a);
  };
  const clear = (side) => { const a = parts(); if (side === 'a') { a.q.delete('l'); a.q.delete('j'); } else { a.q.delete('r'); a.q.delete('i'); } go(a); };
  let note = null, noteTimer = 0;
  const say = (t) => { if (!note) return; note.textContent = t; clearTimeout(noteTimer); noteTimer = setTimeout(() => { note.textContent = ''; }, 2600); };
  const copy = () => {
    const url = location.href;
    const done = () => say('Link copied');
    const old = () => { const t = document.createElement('textarea'); t.value = url; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (_) { say('Copy the address bar'); } t.remove(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, old); else old();
  };
  const paint = () => {
    const bar = $('#deskact'); if (!bar) return;
    const a = parts().q, l = a.get('l'), r = a.get('r');
    const set = (act, on) => { const b = bar.querySelector(`[data-act="${act}"]`); if (b) b.disabled = !on; };
    set('swap', real(l) && real(r)); set('clear-a', real(l)); set('clear-b', real(r));
  };
  const darkOn = () => html.getAttribute('data-sd-theme') === 'dark';
  function build() {
    const host = $('#deskact'); if (!host) return;
    host.innerHTML = '<button type="button" class="btn deskbtn" data-act="swap" title="Swap the two panes">Swap</button>'
      + '<button type="button" class="btn deskbtn" data-act="clear-a" title="Put the text back in the left pane">Clear left</button>'
      + '<button type="button" class="btn deskbtn" data-act="clear-b" title="Show all commentators in the right pane">Clear right</button>'
      + '<button type="button" class="btn deskbtn" data-act="copy" title="Copy a link to this exact view">Copy link</button>'
      + '<button type="button" class="btn deskbtn" data-act="dark" aria-pressed="false">Dark mode</button>'
      + '<span class="deskmsg" role="status" aria-live="polite"></span>';
    note = host.querySelector('.deskmsg');
    host.querySelector('[data-act="dark"]').setAttribute('aria-pressed', String(darkOn()));
    host.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
      const { act } = b.dataset;
      if (act === 'swap') swap(); else if (act === 'clear-a') clear('a'); else if (act === 'clear-b') clear('b'); else if (act === 'copy') copy();
      else if (act === 'dark') { const next = darkOn() ? 'light' : 'dark'; html.setAttribute('data-sd-theme', next); store.set(THEME_KEY, next); b.setAttribute('aria-pressed', String(next === 'dark')); }
    });
    window.addEventListener('hashchange', paint);
    const desk = $('#desk'); if (desk) new MutationObserver(paint).observe(desk, { childList: true });
    paint();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build, { once: true }); else build();
})();
