/* ── MASTER OMNIBOX — the one ground-source implementation for all sister sites ──────────────
 * Home: prdl_backup/_shared/omnibox/omnibox.js  ·  Contract: OMNIBOX.md beside this file.
 * Every site INLINES this file at build time (same pattern as prdl-system.css) and supplies a
 * per-site adapter. Do NOT fork the engine — fix it here and rebake; per-site behavior belongs
 * in the adapter (sources + escapes), never in engine edits.
 *
 * Adapter contract:
 *   OMNIBOX.attach({
 *     input:   <input element>,             // the landing hero search box
 *     panel:   <container element>,         // dropdown panel (may start display:none)
 *     sources: async () => [Row,...],       // Row = {k:'author'|'work'|'subject'|'volume'|…,
 *                                           //        t: main label, s: sub/meta line (dates,
 *                                           //        counts), href, x: extra match tokens}
 *     smart:   (q) => [Row,...],            // OPTIONAL: rows PARSED from the query itself
 *                                           //   (scripture refs, "PG 32:219" citations…);
 *                                           //   rendered ABOVE source matches
 *     escapes: (q) => [{t, href},...],      // ALWAYS-shown exit rows ("Search the corpus…")
 *     modes:   [{id, label, title, href(q)},…] // OPTIONAL mode-button row pinned at the panel top —
 *                                           // the R10 'palette' contract: Search · Lemma · Meaning ·
 *                                           // Ask AI (conversation chat) · Tradition. Buttons carry
 *                                           // the CURRENT query into the mode's surface.
 *     limit:   12,                          // optional, max result rows
 *   })
 *
 * Engine guarantees (the Round-6 contract, hard-won):
 *   · BOOT-RACE SAFE: a query typed — or deep-linked — before sources resolve is re-run the
 *     moment they land (PG's ?q= hang: interactive typing masks the bug, deep links don't).
 *   · COMBINED token matching: every query token must hit t+s+x (accent-folded, lowercased) —
 *     "chrysostom priesthood" finds De Sacerdotio via author + title tokens together.
 *   · Panel is shown with style.display='block' (the `.omni{display:none}` base-CSS gotcha —
 *     setting '' silently keeps it hidden).
 *   · Keyboard: ↓↑ move, Enter opens (first row if none active), Esc closes; ARIA listbox.
 */
(function (global) {
  'use strict';
  function fold(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : s;
    return d.innerHTML;
  }
  function attach(cfg) {
    var input = cfg.input, panel = cfg.panel, limit = cfg.limit || 12;
    var rows = null, pending = null, active = -1, shown = [];
    panel.setAttribute('role', 'listbox');
    // resolve sources once; boot-race rule: re-fire whatever query is pending when they land
    Promise.resolve().then(cfg.sources).then(function (r) {
      rows = (r || []).map(function (row) {
        row._m = fold(row.t + ' ' + (row.s || '') + ' ' + (row.x || ''));
        return row;
      });
      if (pending != null) run(pending);
    }).catch(function () { rows = []; });
    function run(q) {
      q = String(q || '').trim();
      if (!q) { hide(); return; }
      if (!rows) {                               // sources not ready — re-fired on resolve
        pending = q;
        panel.innerHTML = modeRow(q) + '<div class="omni-row omni-loading" role="option"><span class="omni-t">Loading the index\u2026</span></div>';
        panel.style.display = 'block';           // feedback instead of a silently dead box (PG walkthrough P1)
        input.setAttribute('aria-expanded', 'true');
        return;
      }
      pending = null;
      var toks = fold(q).split(/\s+/).filter(Boolean);
      var out = [];
      if (cfg.smart) { try { (cfg.smart(q) || []).forEach(function (r) { if (out.length < limit) out.push(r); }); } catch (e) {} }
      for (var i = 0; i < rows.length && out.length < limit; i++) {
        var r = rows[i], ok = true;
        for (var t = 0; t < toks.length; t++) if (r._m.indexOf(toks[t]) === -1) { ok = false; break; }
        if (ok) out.push(r);
      }
      // TYPO NET: exact matching found nothing — allow each token ONE edit against any word
      // in the row's match text, so "de mlo" still finds De Malo. Runs only on the zero-hit
      // path (typo queries), so the per-word scan costs nothing on normal keystrokes.
      if (!out.length && toks.some(function (t2) { return t2.length >= 3; })) {
        var ed1 = function (a, b) {
          if (a === b) return true;
          var la = a.length, lb = b.length;
          if (la > lb) { var c = a; a = b; b = c; c = la; la = lb; lb = c; }
          if (lb - la > 1) return false;
          var i2 = 0, j2 = 0, used = false;
          while (i2 < la && j2 < lb) {
            if (a[i2] === b[j2]) { i2++; j2++; continue; }
            if (used) return false;
            used = true;
            if (la === lb) { i2++; j2++; } else { j2++; }
          }
          return true;
        };
        for (var f = 0; f < rows.length && out.length < limit; f++) {
          var rf = rows[f], okf = true;
          var words = rf._w || (rf._w = rf._m.split(/[^a-z0-9]+/).filter(Boolean));
          for (var t3 = 0; t3 < toks.length; t3++) {
            var tk = toks[t3];
            if (rf._m.indexOf(tk) !== -1) continue;
            if (tk.length < 3) { okf = false; break; }
            var hit = false;
            for (var w = 0; w < words.length && !hit; w++) hit = ed1(tk, words[w]);
            if (!hit) { okf = false; break; }
          }
          if (okf) out.push(rf);
        }
      }
      render(out, q);
    }
    function modeRow(q) {
      if (!cfg.modes || !cfg.modes.length) return '';
      return '<div class="omni-modes" role="group">' + cfg.modes.map(function (m) {
        return '<a class="omni-mode" data-mid="' + m.id + '" title="' + esc(m.title || '') + '" href="' +
          esc(m.href(q || '')) + '">' + esc(m.label) + '</a>';
      }).join('') + '</div>';
    }
    function render(out, q) {
      shown = out.concat((cfg.escapes ? cfg.escapes(q) : []).map(function (e) {
        return { k: 'escape', t: e.t, href: e.href };
      }));
      active = -1;
      var pfx = (panel.id || 'omni') + '-opt-';
      panel.innerHTML = modeRow(q) + shown.map(function (r, i) {
        return '<a class="omni-row omni-' + r.k + '" data-k="' + esc(r.k) + '" role="option" id="' + pfx + i + '" data-i="' + i + '" href="' + esc(r.href) + '">' +
          '<span class="omni-t">' + esc(r.t) + '</span>' +
          (r.s ? '<span class="omni-s">' + esc(r.s) + '</span>' : '') + '</a>';
      }).join('');
      panel.style.display = 'block';             // NOT '' — see the display:none gotcha above
      input.setAttribute('aria-expanded', 'true');
    }
    function hide() { panel.style.display = 'none'; active = -1; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); }
    function mark() {
      var els = panel.querySelectorAll('.omni-row');
      els.forEach(function (el, i) { el.classList.toggle('omni-active', i === active); });
      if (active >= 0 && els[active]) { els[active].scrollIntoView({ block: 'nearest' }); input.setAttribute('aria-activedescendant', els[active].id); }
      else input.removeAttribute('aria-activedescendant');
    }
    input.addEventListener('input', function () { run(input.value); });
    input.addEventListener('keydown', function (ev) {
      if (panel.style.display !== 'block') return;
      if (ev.key === 'ArrowDown') { ev.preventDefault(); active = Math.min(active + 1, shown.length - 1); mark(); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); active = Math.max(active - 1, -1); mark(); }
      else if (ev.key === 'Enter') {
        var pick = shown[active >= 0 ? active : 0];
        if (pick) { ev.preventDefault(); navTo(pick.href); }
      } else if (ev.key === 'Escape') hide();
    });
    // navigate + ALWAYS close. A hash-only href on the same page fires no load event —
    // without this the panel sat open over the filtered page and reads as "no response"
    // (2026-07-12: author rows on TFR). If the hash is already identical, force the
    // hashchange so the page's deep-link handler still runs.
    function navTo(href) {
      hide();
      try {
        var u = new URL(href, location.href);
        if (u.pathname === location.pathname && u.search === location.search && u.hash) {
          if (u.hash === location.hash) { dispatchEvent(new HashChangeEvent('hashchange')); }
          else { location.hash = u.hash; }
          return;
        }
      } catch (e) {}
      location.href = href;
    }
    panel.addEventListener('click', function (ev) {
      var a = ev.target.closest ? ev.target.closest('a[href]') : null;
      if (!a) return;
      // modified click (cmd/ctrl/shift/alt, or non-primary button) = the reader asking the
      // BROWSER to handle it (new tab/window/download) — never intercept those (2026-07-20).
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.button !== 0) return;
      ev.preventDefault(); navTo(a.getAttribute('href'));
    });
    document.addEventListener('click', function (ev) {
      if (!panel.contains(ev.target) && ev.target !== input) hide();
    });
    // deep-link support: ?q= pre-filled by the page → run immediately (boot-race safe by design)
    if (input.value) run(input.value);
    return { run: run, hide: hide };
  }
  global.OMNIBOX = { attach: attach, fold: fold };
})(window);
