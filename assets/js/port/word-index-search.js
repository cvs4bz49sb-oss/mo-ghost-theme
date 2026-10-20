/* EVERY TEXT WITH A WORD (2026-09-29). A reader: "I searched for 'suspicion' in English and 'suspicio' in Latin and came back with
   one text … the same with 'fama': only 10 texts, but it's a huge category for moral theology." Exact-word search read only the
   full-text (Pagefind) index — about 2,700 of the library's works, none of the Latin, Greek or Eastern Fathers nor EEBO — one spelling
   at a time, ten sections a page. This panel answers from the concordance instead (every word of every page of every work; a
   duplicate edition once): how many works, where, and which use the word most, with the word's own inflections (fama, famae, famam…).
   Shared by the corpus site (search.html: answered in the page by word-index-local.js, no server call) and MereO (the theme's port,
   the Ask worker's /v1/words; the same in-page engine once MereO's store serves byte ranges).

   FRWordIndex.mount(host, {query, post, readHref, title, meta})
     post(body)            → Promise of the {op:'words'} answer ({rows} or {forms, more})
     readHref(slug,page,w) → the reader URL for a page with the word highlighted
     title(slug,row)       → the work's display title (HTML-escaped)
     meta(row)             → the line under the title (HTML-escaped): author, volume, tradition
     scope                 → optional {label, by}: the answer is limited to one author's works (the author page's Search sends
                             room: <slug>; the search page's author filter sends authors: [names]; mo-workers #41), so the heading
                             names them (label: "Richard Baxter’s works"), the teaser says whose (by: "by Richard Baxter") and the
                             concept card is left out
     keep(slug)            → optional: only these works count (the author page's "Search in" set, 2026-10-14: Calvin's 45
                             commentary volumes of his 48 works). The room's whole list of works is asked for once and kept to the
                             set, and the counts are made from it, so "N works · pages · times" is the set's, not the room's. */
(function () {
  'use strict';
  const method = html => (window.TFRMethod ? window.TFRMethod.html(html) : html);
  const STOP = new Set(('et in est non ad cum ut quod qui quae quo de sed per ab ex se si enim etiam autem quia hoc esse sunt eius nec vel uel aut ita sic tamen nam id ea eo ' +
    'the of and to in a is that it be as by for not which with this his he but are from or they we all was have so an their on him them you our shall will hath doth were').split(' '));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fold = w => String(w || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ſ/g, 's').replace(/æ/g, 'ae').replace(/œ/g, 'oe').replace(/j/g, 'i').replace(/v/g, 'u').replace(/ς/g, 'σ');
  const n = x => Number(x || 0).toLocaleString();
  // works added per "More works" (2026-10-10, owner: "work search only returns max 10 items"; it was 10): each still reads its best
  // passage only as it scrolls into view, three at a time, so a longer batch costs nothing until it is read
  const WORKS_STEP = 25;

  /* A word's likely inflections: Latin by its ending (the common declensions), English plurals. Only the forms the library actually
     holds are shown, each with its count, and any can be unticked. */
  function inflect(w) { return forms(w).all; }
  /* {all, off}: off = forms shown but unticked at first (a 1st-declension -is also inflects other words: famis is mostly fames). The
     Latin forms carry their enclitic -que too (famaque, famamque): the same word. */
  function forms(w) {
    const out = new Set([w]), off = new Set(), add = (stem, ends) => ends.forEach(e => out.add(stem + e));
    let latin = true;
    if (/tudo$/.test(w)) add(w.slice(0, -4), ['tudo', 'tudinis', 'tudini', 'tudinem', 'tudine', 'tudines', 'tudinum', 'tudinibus']);
    else if (/io$/.test(w)) add(w.slice(0, -2), ['io', 'ionis', 'ioni', 'ionem', 'ione', 'iones', 'ionum', 'ionibus']);
    else if (/tas$/.test(w)) add(w.slice(0, -3), ['tas', 'tatis', 'tati', 'tatem', 'tate', 'tates', 'tatum', 'tatibus']);
    else if (/or$/.test(w)) add(w.slice(0, -2), ['or', 'oris', 'ori', 'orem', 'ore', 'ores', 'orum', 'oribus']);
    else if (/us$/.test(w)) add(w.slice(0, -2), ['us', 'i', 'o', 'um', 'e', 'orum', 'os', 'is', 'ui', 'u', 'uum', 'ibus']);
    else if (/um$/.test(w)) add(w.slice(0, -2), ['um', 'i', 'o', 'a', 'orum', 'is']);
    else if (/a$/.test(w)) add(w.slice(0, -1), ['a', 'ae', 'am', 'as', 'arum', 'is']);
    else if (/es$/.test(w)) add(w.slice(0, -2), ['es', 'ei', 'em', 'e', 'erum', 'ebus', 'is', 'i', 'ium', 'ibus']);
    else if (/is$/.test(w)) add(w.slice(0, -2), ['is', 'i', 'em', 'e', 'es', 'ium', 'ibus']);
    else latin = false;
    if (latin) {
      if (/a$/.test(w) && !/ia$/.test(w)) off.add(w.slice(0, -1) + 'is');
      [...out].forEach(f => { if (!/que$/.test(f)) out.add(f + 'que'); });
    } else {
      // ENGLISH FORMS (10-02, the Pagefind comparison: Pagefind's stemming found 'antinomians', 'predestined'; "lords supper" missed
      // 900 works because "Lord's" is indexed as lord + s): plurals, the singular of a plural or possessive, and the verb's forms,
      // early-modern -eth/-est included. Only forms the library holds are shown, each with its count, and any can be unticked.
      if (!/s$/.test(w)) out.add(w + 's');
      if (/(s|x|z|ch|sh)$/.test(w)) out.add(w + 'es');
      if (/[^aeiou]y$/.test(w)) { out.add(w.slice(0, -1) + 'ies'); out.add(w.slice(0, -1) + 'ied'); }
      if (/[^s]s$/.test(w) && w.length > 3) out.add(w.slice(0, -1));
      if (/ies$/.test(w)) out.add(w.slice(0, -3) + 'y');
      if (w.length >= 4 && !/s$/.test(w)) {
        const b = /e$/.test(w) ? w.slice(0, -1) : w;
        [b + 'ed', b + 'ing', w + (/e$/.test(w) ? 'th' : 'eth'), w + (/e$/.test(w) ? 'st' : 'est'), b + 'er', b + 'ers'].forEach(f => out.add(f));
        if (/e$/.test(w)) out.add(w + 'd');
        if (/(ion|ism|ist|ian)$/.test(w)) out.add(w + 's');
      }
    }
    return { all: [...out].filter(f => f.length >= 2), off };
  }
  /* A QUOTED PHRASE (2026-10-01, the Parquet phrase index): its indexed words in order (2–6) and the small words the index leaves out
     (et, of, the …: "covenant of works" is couenant → works standing next to each other on a page). Null when it is not a phrase. */
  /* 10-02 PM: and each indexed word's OFFSET in tokens from the first, counted as the positions index counts a page (\p{L}+ runs,
     every one, small words included), so "covenant of works" is works exactly two tokens after couenant. */
  function phraseOf(query) {
    const m = /["“”]([^"“”]{2,240})["“”]?/.exec(String(query || '').trim());
    if (!m) return null;
    const toks = (m[1].normalize('NFC').match(/\p{L}+/gu) || []).map(fold), ws = [], at = [];
    toks.forEach((w, i) => { if (w.length >= 2 && w.length <= 40 && !STOP.has(w)) { ws.push(w); at.push(i); } });
    const skipped = [...new Set(toks.filter(w => w.length >= 2 && STOP.has(w)))];
    return ws.length >= 2 && ws.length <= 6 ? { ws, skipped, offsets: at.map(i => i - at[0]), text: m[1].trim().replace(/\s+/g, ' ') } : null;
  }
  /* The words of a query worth counting (letters only, no stopwords); null for a quoted phrase or more than three words. */
  function words(query) {
    const s = String(query || '').trim();
    if (!s || /["“”]/.test(s)) return null;
    const ws = [...new Set((s.match(/[\p{L}\p{M}'’-]+/gu) || []).map(fold).map(w => w.replace(/['’-]/g, '')).filter(w => w.length >= 2 && !STOP.has(w)))];
    return ws.length && ws.length <= 3 ? ws : null;
  }

  /* MereO delta (2026-10-01): show the words as the reader typed them.
     fold() is for matching (j→i, v→u, accents off), so a search for
     "justification" was announced as “iustification”. Each folded word is
     mapped back to its first typed form for display only; matching is
     unchanged. Re-apply when re-vendoring this file. */
  function shown(query, ws) {
    const typed = new Map();
    (String(query || '').match(/[\p{L}\p{M}'’-]+/gu) || []).forEach(t => {
      const f = fold(t).replace(/['’-]/g, '');
      if (!typed.has(f)) typed.set(f, t.toLowerCase().replace(/['’-]/g, ''));
    });
    return (ws || []).map(w => typed.get(w) || w);
  }

  let styled = false;
  function style() {
    if (styled) return; styled = true;
    const css = `.wix{margin:0 0 1.4rem;padding:1.05rem 1.15rem 1.1rem;border:1px solid var(--border,#ddd);border-radius:10px;background:var(--card-bg,#fff)}
.wix h3{margin:0 0 .3rem;font:600 1.05rem/1.35 var(--font-ui,inherit)}.wix .wix-sub{margin:0 0 .75rem;color:var(--muted,#666);font-size:.85rem;line-height:1.45}
.wix .wix-jump{white-space:nowrap;color:inherit}
.wix .wix-forms{display:flex;flex-wrap:wrap;gap:.35rem .4rem;align-items:center;margin:.2rem 0 .55rem;font-size:.84rem}
.wix .wix-forms b{font-weight:600;margin-right:.2rem}.wix label.wix-f{display:inline-flex;gap:.25rem;align-items:center;padding:.12rem .5rem;border:1px solid var(--border,#ddd);border-radius:999px;cursor:pointer}
.wix label.wix-f span{color:var(--muted,#666)}.wix .wix-more{color:var(--muted,#666)}.wix .wix-more button{border:0;background:none;padding:0 .2rem;color:inherit;text-decoration:underline;cursor:pointer;font:inherit}
.wix .wix-sum{margin:.5rem 0 .55rem;font-size:.98rem}.wix .wix-sum b{font-size:1.08rem}
.wix .wix-trad,.wix .wix-dist{display:flex;flex-wrap:wrap;gap:.35rem;margin:0 0 .4rem;align-items:center}
.wix .wix-dist button{padding:.2rem .65rem;border:1px solid var(--border,#ddd);border-radius:999px;background:none;color:inherit;font:inherit;font-size:.82rem;cursor:pointer}
.wix .wix-dist button[aria-pressed=true]{background:var(--fg,#222);color:var(--card-bg,#fff);border-color:var(--fg,#222)}
.wix .wix-dist .wix-ord{font-size:.82rem;color:var(--muted,#666);display:inline-flex;gap:.3rem;align-items:center;margin-left:.2rem}
.wix .wix-trad button{padding:.2rem .65rem;border:1px solid var(--border,#ddd);border-radius:999px;background:none;color:inherit;font:inherit;font-size:.82rem;cursor:pointer}
.wix .wix-trad button span{color:var(--muted,#666);margin-left:.3rem}.wix .wix-trad button[aria-pressed=true]{background:var(--fg,#222);color:var(--card-bg,#fff);border-color:var(--fg,#222)}
.wix .wix-trad button[aria-pressed=true] span{color:inherit;opacity:.75}
.wix .wix-sec{margin:1.1rem 0 0}.wix .wix-sec>h4{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:.2rem .8rem;margin:0;padding:0 0 .35rem;border-bottom:2px solid var(--fg,#222);font:600 .98rem/1.3 var(--font-ui,inherit)}
.wix .wix-sec>h4 .wix-ts{font-weight:400;font-size:.8rem;color:var(--muted,#666)}
.wix ol{margin:0;padding:0;list-style:none}.wix li.wix-w{padding:.6rem 0 .55rem;border-bottom:1px solid var(--border,#e6e6e6)}
.wix .wix-h{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:.1rem 1rem}
.wix a.wix-t{font-weight:600;font-size:.98rem;color:var(--fg,#222);text-decoration:none}.wix a.wix-t:hover{text-decoration:underline}
.wix .wix-n{font-size:.8rem;color:var(--muted,#666);white-space:nowrap;font-variant-numeric:tabular-nums}
.wix .wix-m{color:var(--muted,#666);font-size:.84rem;margin-top:.1rem}
.wix .wix-c{display:flex;flex-wrap:wrap;align-items:center;gap:.35rem .6rem;margin-top:.35rem;font-size:.82rem}.wix .wix-fl{color:var(--muted,#666)}
.wix .wix-plus{color:var(--muted,#666);cursor:help}
.wix button.wix-pv,.wix button.wix-vol{padding:.12rem .6rem;border:1px solid var(--border,#ddd);border-radius:999px;background:none;color:inherit;font:inherit;font-size:.8rem;cursor:pointer;white-space:nowrap}
.wix button.wix-vol span{color:var(--muted,#666);margin-left:.25rem;font-variant-numeric:tabular-nums}
.wix button.wix-pv[aria-expanded=true],.wix button.wix-vol[aria-expanded=true]{background:var(--fg,#222);color:var(--card-bg,#fff);border-color:var(--fg,#222)}
.wix button.wix-vol[aria-expanded=true] span{color:inherit;opacity:.75}.wix .wix-vl{color:var(--muted,#666)}
.wix .wix-inst{margin:.6rem 0 .1rem;padding:.1rem 0 .15rem .85rem;border-left:2px solid var(--border,#ddd)}.wix .wix-ih{margin:.2rem 0 .1rem;font-size:.8rem;color:var(--muted,#666)}
.wix .wix-i{margin:.5rem 0;font-size:.9rem;line-height:1.55}.wix .wix-i a.wix-p{display:inline-block;min-width:3.2rem;margin-right:.5rem;font-size:.78rem;font-weight:600;color:inherit;white-space:nowrap}
.wix .wix-s{overflow-wrap:anywhere}.wix .wix-s+.wix-s{margin-left:.3em}
.wix .wix-pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:.15rem 1.1rem;margin:.1rem 0 .45rem}
.wix .wix-pair.wix-one{grid-template-columns:minmax(0,1fr)}.wix .wix-pair .wix-s+.wix-s{margin-left:0}
.wix .wix-pair .wix-en{color:var(--fg,#222);border-left:1px solid var(--border,#ddd);padding-left:.8rem}
.wix .wix-pair .wix-en>b{display:block;font:600 .66rem/1.2 var(--font-ui,inherit);letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#666);margin-bottom:.1rem}
@media (max-width:680px){.wix .wix-pair{grid-template-columns:minmax(0,1fr)}.wix .wix-pair .wix-en{border-left:0;padding-left:0;border-top:1px dashed var(--border,#ddd);padding-top:.2rem}}
.wix .wix-i>.wix-pairs{margin:.15rem 0 0}.wix .wix-allpv{display:inline-flex;align-items:center;gap:.35rem;font-size:.82rem;color:var(--muted,#666);margin:.1rem 0 .5rem;cursor:pointer}
.wix .wix-s mark{background:color-mix(in srgb,var(--accent,#b8860b) 26%,transparent);color:inherit;padding:0 .12em;border-radius:3px}
.wix .wix-none{color:var(--muted,#666);font-style:italic;font-size:.84rem}
.wix .wix-pages{display:flex;flex-wrap:wrap;gap:.25rem .6rem;margin-top:.35rem;font-size:.82rem}.wix .wix-pages a{color:inherit}
.wix details.wix-all{margin:.4rem 0 .2rem}.wix details.wix-all summary{cursor:pointer;font-size:.82rem;color:var(--muted,#666)}
.wix .wix-go{margin-top:.6rem;padding:.35rem .85rem;border:1px solid var(--border,#ddd);border-radius:6px;background:none;color:inherit;font:inherit;font-size:.86rem;cursor:pointer}
.wix .wix-if .wix-go{margin-top:.2rem;font-size:.84rem}
.wix-teaser{padding:.7rem 1rem;font-size:.92rem;line-height:1.5}.wix-teaser .wix-go{margin:0 0 0 .4rem;padding:.2rem .7rem}
.wix .wix-note{margin:.8rem 0 0;color:var(--muted,#666);font-size:.8rem;line-height:1.45}.wix .wix-err{color:#a8462b}
.wcx .wcx-k{margin:0 0 .15rem;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#666)}.wix-idea{margin:0 0 .6rem;font-size:.92rem;line-height:1.5;color:var(--muted,#666)}.wix-idea b{color:var(--fg,inherit)}.wix-idea .wix-go{margin-left:.4rem}.wix-asked{margin:0 0 .7rem;font-size:.95rem;line-height:1.5}.wix-asked .wix-k{display:block;margin:0 0 .1rem;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#666)}.wix-asked .wix-terms{display:block;margin-top:.2rem;font-size:.85rem;color:var(--muted,#666)}.wix-asked .wix-go{margin-left:.4rem}.sr .sr-why{margin:.15rem 0 .1rem;font-size:.85rem;font-style:italic;color:var(--muted,#666)}
.wcx h3{font-size:1.18rem}.wcx .wcx-gl{margin:.1rem 0 .35rem;font-size:.95rem;line-height:1.5}
.wcx .wcx-meta{margin:0 0 .7rem;color:var(--muted,#666);font-size:.82rem;line-height:1.5}.wcx .wcx-meta a{color:inherit}
.wcx .wcx-row{display:grid;grid-template-columns:5.2rem 1fr;gap:.2rem .6rem;align-items:baseline;margin:.3rem 0;font-size:.84rem}
.wcx .wcx-row>b{font-weight:600;font-size:.8rem;color:var(--muted,#666);padding-top:.15rem}
.wcx .wcx-chips{display:flex;flex-wrap:wrap;gap:.3rem .35rem}
.wcx a.wcx-t{display:inline-flex;gap:.3rem;align-items:baseline;padding:.1rem .55rem;border:1px solid var(--border,#ddd);border-radius:999px;color:inherit;text-decoration:none}
.wcx a.wcx-t:hover{border-color:var(--fg,#222)}.wcx a.wcx-t span{color:var(--muted,#666);font-size:.78rem;font-variant-numeric:tabular-nums}
.wcx a.wcx-t[data-lang=grc]{font-family:var(--font-greek,inherit)}
.wcx .wcx-v{color:var(--muted,#666);font-size:.8rem}.wcx .wcx-v i{font-style:italic;color:var(--fg,#222)}
.wcx details.wcx-off{margin:.35rem 0 0;font-size:.8rem;color:var(--muted,#666)}.wcx details.wcx-off summary{cursor:pointer}
.wcx details.wcx-off ul{margin:.3rem 0 0;padding-left:1.1rem}.wcx details.wcx-off li{margin:.15rem 0}
.wcx .wcx-why{margin:.9rem 0 0;padding:.5rem 0 0;border-top:1px solid var(--border,#e6e6e6);color:var(--muted,#666);font-size:.8rem;line-height:1.45}
.wcx .wcx-ev{color:var(--muted,#666)}
.wcx .wcx-start{margin:.85rem 0 0;font-size:.9rem;line-height:1.5}.wcx .wcx-start b{font-weight:600}.wcx .wcx-start a{color:inherit}
.wcx .wcx-near{margin:.35rem 0 0;font-size:.84rem;color:var(--muted,#666)}.wcx .wcx-near a{color:inherit}
.wcx .wix-trad{margin:.7rem 0 .2rem}.wcx .wcx-en{font-size:.74rem;border:1px solid var(--border,#ddd);border-radius:999px;padding:0 .4rem;margin-left:.35rem;color:var(--muted,#666);white-space:nowrap}
@media (max-width:640px){.wcx .wcx-row{grid-template-columns:1fr}.wcx .wcx-row>b{padding:0}}`;
    const el = document.createElement('style'); el.textContent = css; document.head.appendChild(el);
  }
  // 'Tomus XII', 'Vol. 6', 'Pars VIII', 'Book 2' → a number to put a work's volumes in order
  const ROMAN = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
  function volNo(label) {
    const m = /\b(?:tomus|tom|volume|vol|pars|part|liber|book|band|bd|t)\.?\s*([ivxlcdm]+|\d+)\b/i.exec(String(label || ''));
    if (!m) return Infinity;
    if (/^\d+$/.test(m[1])) return Number(m[1]);
    const r = m[1].toLowerCase(); let v = 0;
    for (let i = 0; i < r.length; i++) { const a = ROMAN[r[i]], b = ROMAN[r[i + 1]] || 0; v += a < b ? -a : a; }
    return v;
  }

  // a volume's button label: its number, not its description ('Vol. 1 · Letters, prefaces … (1514–1530)' → 'Vol. 1')
  function volShort(v) {
    const s = String(v || '').trim();
    if (!s) return 'another volume';
    const head = s.split(/\s*:\s+|\s+[·—–;]\s+|\s+-\s+/)[0].replace(/\s*\([^)]*\)\s*$/, '').trim() || s;
    return cap(head, 28);
  }
  const cap = (s, k) => (s.length > k ? s.slice(0, k - 2).replace(/\s+\S*$/, '') + '…' : s);
  // the labels of one work's volumes: short where the short labels tell them apart, longer where two would read alike
  function volLabels(rows) {
    const short = rows.map(r => volShort(r.volume)), seen = new Map();
    short.forEach(x => seen.set(x, (seen.get(x) || 0) + 1));
    return rows.map((r, i) => (seen.get(short[i]) > 1 ? cap(String(r.volume || '').trim(), 40) || short[i] : short[i]));
  }


  /* EVERY HIT, WITH ITS ENGLISH (2026-10-03, owner: "this just shows the latin not the english pls fix for both" + "make the layout
     able for me to see the preview of all hits everywhere"): a page's uses come as pairs — the line in the original and the same
     passage in English (FRWordPreview.pair) — every use on the page, not two; and one switch opens the passages under every work
     as the list scrolls into view (remembered in this browser). */
  function pairsHtml(list) {
    if (!list || !list.length) return '';
    const both = list.some(x => x.o && x.e);
    return `<div class="wix-pairs">${list.map(x => both
      ? `<div class="wix-pair"><span class="wix-s">${x.o || '<span class="wix-none">(English only on this page)</span>'}</span><span class="wix-s wix-en"><b>English</b>${x.e || '<span class="wix-none">not translated on this page</span>'}</span></div>`
      : `<div class="wix-pair wix-one"><span class="wix-s">${x.o || x.e}</span></div>`).join('')}</div>`;
  }
  /* ONE PASSAGE PER PAGE, AND EACH WORK'S BEST PAGE FIRST (2026-10-08). The owner, on MereO search for "justification": "this doesnt
     make sense all one one page??" — a work opened every use on its best page, Gerhard's p. 1082 twenty-seven times — then, on the
     proposal: "the concept card and word forms at the top, the rest is fine". So: one ranked list (the word service's BM25 order,
     a tradition button narrows it); under each work its single best passage, the original beside the English, read as the work
     comes into view; "More passages" lists its other pages, busiest first, one passage each with its count. Not every use. */
  function lazy(el, load) {
    if (typeof IntersectionObserver !== 'function') { load(); return; }
    const io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) { io.disconnect(); load(); } }, { rootMargin: '400px 0px' });
    io.observe(el);
  }
  // three works read at a time: a Father's TEI is a whole volume
  const waiting = []; let reading = 0;
  function limited(task) { return new Promise((res, rej) => { waiting.push([task, res, rej]); pump(); }); }
  function pump() {
    while (reading < 3 && waiting.length) {
      const [t, res, rej] = waiting.shift(); reading++;
      Promise.resolve().then(t).then(res, rej).finally(() => { reading--; pump(); });
    }
  }
  const pageText = (slug, p) => (/^(pld|pg)-/.test(slug) ? 'col.' : 'p.') + ' ' + esc(String(p).replace(/^0+(?=\d)/, ''));
  // one page: its link, how many uses it holds (and any tags), its best passage, the original beside the English
  function passageHtml(href, label, b, count, extra) {
    const c = Number(count || (b && b.uses) || 0), tags = [c ? `${n(c)} ${c === 1 ? 'use' : 'uses'} on this page` : '', extra].filter(Boolean).join(' · ');
    return `<div class="wix-i"><a class="wix-p" href="${esc(href)}">${label}</a>${tags ? `<span class="wcx-ev">${tags}</span>` : ''}`
      + (b ? pairsHtml([b]) : '<span class="wix-s wix-none">open the page to read it</span>') + '</div>';
  }
  // the best passage of each of these pages of one work: [{page, b}] in the order given
  // A page the index found the word on, whose page file has no form of it, is read again from the work's TEI, the text the reader
  // shows (2026-10-10, word-search audit: a library work's page files can be behind its TEI; word-index-preview.js teiSource).
  async function bestOf(slug, pages, look, fallback) {
    const P = window.FRWordPreview;
    if (!P || !P.best) return pages.map(p => ({ page: p, b: null }));
    const read = tei => P.lanes(slug, pages.map(String), tei ? { tei: true } : undefined).catch(() => null);
    const pick = lanes => pages.map(p => {
      const lane = lanes && lanes.get(String(p));
      let b = lane ? P.best(lane, look) : null;
      if (!b && lane && fallback) b = P.best(lane, fallback);   // a phrase across a line or a note: its words
      return { page: p, b };
    });
    const out = pick(await read(false));
    if (!out.some(x => !x.b) || /^(pld|pg|po|eebo)-/.test(slug)) return out;
    const tei = pick(await read(true));
    return out.map((x, i) => x.b ? x : tei[i]);
  }

  /* THE CONCEPT CARD (2026-10-02, owner: "build it … make of course results are tastefully done"). When the query names a doctrine or
     topic of the concept map (tools/concepts/; v1/concepts/index.json: theosis, deification, the hypostatic union, transubstantiation,
     the 198 topics and their finer doctrines), a card above the word panel shows what the library calls it in every language — the
     words and phrases the judges kept, each with its works, every one a search of its own — its key verses with their wordings, and
     the works that treat it most: ranked where its words, its verses and the statements filed under it agree on the same pages. Words
     left out because they mostly mean something else here are listed with the reason. Same files on both sites (Blob / the library
     worker); nothing changes when the query names no concept. */
  const CBASE = () => (window.__FR_BLOB_BASE__ && !/TBD/.test(String(window.__FR_BLOB_BASE__)) ? String(window.__FR_BLOB_BASE__)
    : 'https://0ss8v4l06kodnhp0.public.blob.vercel-storage.com').replace(/\/+$/, '') + '/v1/concepts/';
  let cIndex = null;
  const loadConcepts = () => cIndex || (cIndex = fetch(CBASE() + 'index.json?v=' + Math.floor(Date.now() / 600000))
    .then(r => (r.ok ? r.json() : null)).catch(() => null).then(j => { if (!j) cIndex = null; return j; }));   // a miss is not remembered
  const foldText = s => String(s || '').split(/[^\p{L}\p{N}]+/u).map(fold).filter(Boolean).join(' ');
  /* the concept the WHOLE query names (a trigger or the label, 'the' and quotes aside): a search box is not a question */
  function conceptOf(query, index) {
    const fq = foldText(String(query || '').replace(/^\s*the\s+/i, ''));
    if (!fq || !index) return null;
    let best = null, part = null;
    for (const c of index.concepts || []) {
      const ts = [foldText(String(c.label).replace(/^\s*the\s+/i, '')), ...(c.triggers || []).map(t => t.replace(/^the /, ''))];
      if (ts.includes(fq) && (!best || (c.works || 0) > (best.works || 0))) best = c;
      // one of the concept's own Latin or Greek words ('deificatio'): a line pointing to the concept, not the whole card
      else if (!best && (c.keys || []).includes(fq) && (!part || (c.works || 0) > (part.works || 0))) part = c;
    }
    return best || (part ? { ...part, part: true } : null);
  }
  /* A SLIP OF THE PEN (owner 2026-10-06: "ahec sancta" found nothing): the query names a concept when each of its words is within
     one edit of the concept's label or one of its triggers, word for word (two edits for words of eight letters or more; a swap of
     two letters is one edit). Words under four letters must match exactly, and a single short word never matches loosely. The
     closest name wins; on a tie, the concept found in more works. */
  function slip(a, b, lim) {
    if (Math.abs(a.length - b.length) > lim) return lim + 1;
    const d = [];
    for (let i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (let j = 0; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      let low = lim + 1;
      for (let j = 1; j <= b.length; j++) {
        const c = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        low = Math.min(low, d[i][j]);
      }
      if (low > lim) return lim + 1;
    }
    return d[a.length][b.length];
  }
  function conceptNear(query, index) {
    const fq = foldText(String(query || '').replace(/^\s*the\s+/i, ''));
    if (!fq || !index) return null;
    const qs = fq.split(' ');
    if (qs.length === 1 && qs[0].length < 6) return null;
    let best = null, bestD = Infinity;
    for (const c of index.concepts || []) {
      for (const name of [foldText(String(c.label).replace(/^\s*the\s+/i, '')), ...(c.triggers || []).map(t => t.replace(/^the /, ''))]) {
        const ns = name.split(' ');
        if (ns.length !== qs.length) continue;
        let d = 0;
        for (let i = 0; i < ns.length && d < Infinity; i++) {
          const x = qs[i], y = ns[i];
          if (x === y) continue;
          if (x.length < 4 || y.length < 4) { d = Infinity; break; }
          const lim = Math.max(x.length, y.length) >= 8 ? 2 : 1, e = slip(x, y, lim);
          d = e > lim ? Infinity : d + e;
        }
        if (d > 0 && d < Infinity && (d < bestD || (d === bestD && (c.works || 0) > (best.works || 0)))) { best = c; bestD = d; }
      }
    }
    return best ? { ...best, near: true } : null;
  }
  const LANG = { grc: 'Greek', la: 'Latin', en: 'English' };
  function searchHref(term) { const u = new URL(location.href); u.searchParams.set('q', term); u.searchParams.set('m', 'full'); u.hash = ''; return u.pathname + u.search; }
  async function conceptCard(slot, opts, force) {
    const index = await loadConcepts(), hit = force || conceptOf(opts.query, index);
    if (!hit) {
      const nh = conceptNear(opts.query, index);
      if (nh && slot.isConnected) {
        slot.className = 'wix wix-teaser';
        slot.innerHTML = `Did you mean <a href="${esc(searchHref(nh.label))}"><b>${esc(nh.label)}</b></a>${nh.gloss ? ` (${esc(nh.gloss.replace(/\.$/, ''))})` : ''}?`;
      }
      return;
    }
    if (hit.part && !force) {
      slot.className = 'wix wix-teaser';
      slot.innerHTML = `<b>“${esc(String(opts.query).trim())}”</b> is one of the library’s words for <b>${esc(hit.label)}</b>${hit.gloss ? ` (${esc(hit.gloss.replace(/\.$/, ''))})` : ''}. <button type="button" class="wix-go">Show the concept</button>`;
      slot.querySelector('button').onclick = () => conceptCard(slot, opts, { ...hit, part: false });
      return;
    }
    const c = await fetch(CBASE() + encodeURIComponent(hit.id) + '.json?v=' + encodeURIComponent(index.v || '')).then(r => (r.ok ? r.json() : null)).catch(() => null);
    if (!c || !slot.isConnected) return;
    const on = (c.terms || []).filter(t => t.ticked && t.kind !== 'wording'), off = (c.terms || []).filter(t => !t.ticked && t.kind !== 'wording');
    const wordings = (c.terms || []).filter(t => t.kind === 'wording' && t.ticked);
    const chip = t => `<a class="wcx-t" data-lang="${esc(t.lang)}" href="${esc(searchHref(t.kind === 'word' ? t.term : '"' + t.term + '"'))}" title="${esc(t.kind === 'word' ? 'every page with “' + t.term + '” and its forms' : 'the phrase, every page')}">${esc(t.term)} <span>${n(t.works)}</span></a>`;
    const rows = ['grc', 'la', 'en'].map(l => {
      const ts = on.filter(t => t.lang === l).sort((a, b) => b.works - a.works);
      if (!ts.length) return '';
      const first = ts.slice(0, 7), rest = ts.slice(7);
      return `<div class="wcx-row"><b>${LANG[l]}</b><div class="wcx-chips">${first.map(chip).join('')}${rest.length ? `<span class="wix-more"><button type="button" data-cmore="${l}">+${rest.length} more</button></span><span hidden data-crest="${l}">${rest.map(chip).join('')}</span>` : ''}</div></div>`;
    }).join('');
    const verses = (c.verses || []).filter(v => v.weight >= .3).slice(0, 4);
    const vrow = verses.length ? `<div class="wcx-row"><b>Scripture</b><div class="wcx-v">${verses.map(v => {
      const w = wordings.filter(t => String(t.note || '').startsWith(v.label.replace(/^(\d) /, '$1 ')) || String(t.note || '').includes(v.ref)).slice(0, 2);
      return `${esc(v.label)} · cited in ${n(v.works)} works${w.length ? ' · ' + w.map(t => `<i>${esc(t.term)}</i>`).join(', ') : ''}`;
    }).join('<br>')}</div></div>` : '';
    const offList = off.length ? `<details class="wcx-off"><summary>${off.length} ${off.length === 1 ? 'word' : 'words'} left out: mostly used in another sense</summary><ul>${off.slice(0, 12).map(t =>
      `<li><a href="${esc(searchHref(t.term))}">${esc(t.term)}</a> (${LANG[t.lang] || t.lang}${t.precision != null ? `, on topic on ${Math.round(t.precision * 100)}% of sampled pages` : ''})${t.note ? ' · ' + esc(t.note) : ''}</li>`).join('')}</ul></details>` : '';
    const up = (c.broader || []).map(id => (index.concepts.find(x => x.id === id) || {}).label).filter(Boolean);
    const meta = [`${n(c.works)} works · ${n(c.pages)} pages`, up.length ? 'within ' + up.map(esc).join(', ') : ''].filter(Boolean).join(' · ');
    // FOR EVERY READER (owner 10-02: "genuinely useful for each type of person, varying complexity and varying traditions"): a
    // newcomer gets the gloss and where to start in English; a student the nearby concepts and the dictionary article; a scholar the
    // words in every language, the verses and the evidence per work; anyone can narrow the works to one tradition.
    const conceptLabel = id => (index.concepts.find(x => x.id === id) || {}).label;
    const near = [...(c.broader || []), ...(c.narrower || []).slice(0, 4), ...(c.related || []).slice(0, 4)].filter((x, i, a) => a.indexOf(x) === i).map(conceptLabel).filter(Boolean).slice(0, 8);
    const dict = (c.dtc || [])[0];
    const dictHref = dict ? (/^\/the-faith-received\//.test(location.pathname) ? '/the-faith-received/dictionary/' : '/dtc') + '#' + encodeURIComponent(dict) : '';
    const nearLine = near.length || dict ? `<p class="wcx-near">${near.length ? 'Nearby: ' + near.map(l => `<a href="${esc(searchHref(l))}">${esc(l)}</a>`).join(' · ') : ''}${near.length && dict ? ' · ' : ''}${dict ? `<a href="${esc(dictHref)}">the dictionary article</a>` : ''}</p>` : '';
    const trads = (c.traditions || []).filter(t => t.t && t.works);
    slot.className = 'wix wcx';
    slot.innerHTML = `<p class="wcx-k">Concept</p><h3>${esc(c.label)}</h3>${c.gloss ? `<p class="wcx-gl">${esc(c.gloss)}</p>` : ''}<p class="wcx-meta">${meta}</p>
      ${rows}${vrow}${offList}${nearLine}
      ${method('<p class="wcx-why">Works that treat it most: ranked where its words, its verses and the statements filed under it meet on the same pages. Each word above is a search of its own.</p>')}
      ${trads.length > 1 ? `<div class="wix-trad" role="group" aria-label="Tradition"><button type="button" data-ct="*" aria-pressed="true">All traditions</button>${trads.map(t => `<button type="button" data-ct="${esc(t.t)}" aria-pressed="false">${esc(t.t)}<span>${n(t.works)}</span></button>`).join('')}</div>` : ''}
      <p class="wcx-start"></p><ol class="wcx-list"></ol><div class="wcx-foot"></div>`;
    const forms = [...new Set(on.filter(t => t.kind === 'word').flatMap(t => t.forms || []))];
    const pforms = [...new Set(on.filter(t => t.kind !== 'word').flatMap(t => t.chain || []))];
    // what to look for on a page: the original's words and phrases; the English words and phrases in the English
    const look = {
      forms: [...new Set(on.filter(t => t.kind === 'word' && t.lang !== 'en').flatMap(t => t.forms || []))],
      chains: on.filter(t => t.kind !== 'word' && t.lang !== 'en').map(t => t.chain || []).filter(c => c.length),
      enForms: [...new Set(on.filter(t => t.kind === 'word' && t.lang === 'en').flatMap(t => t.forms || []))],
      enChains: on.filter(t => t.kind !== 'word' && t.lang === 'en').map(t => t.chain || []).filter(c => c.length) };
    const ol = slot.querySelector('.wcx-list'), foot = slot.querySelector('.wcx-foot'), st = { shown: 0, trad: null };
    const pool = () => (c.top || []).filter(w => st.trad === null || w.tradition === st.trad);
    function startWith() {
      const el = slot.querySelector('.wcx-start'), en = pool().filter(w => w.en).slice(0, 3);
      el.innerHTML = en.length ? `<b>Start with, in English:</b> ${en.map(w => `<a href="${esc(opts.readHref(w.w, w.best, forms[0] || ''))}">${opts.title(w.w, { slug: w.w, title: w.title })}</a>${w.author ? ` (${esc(w.author)})` : ''}`).join(' · ')}` : '';
    }
    const ev = w => [w.tp ? `its words on ${n(w.tp)} ${w.tp === 1 ? 'page' : 'pages'}` : '', w.vp ? `its verses on ${n(w.vp)}` : '', w.sp ? `${n(w.sp)} ${w.sp === 1 ? 'page' : 'pages'} filed under it` : ''].filter(Boolean).join(' · ');
    function more(k) {
      pool().slice(st.shown, st.shown + k).forEach(w => {
        const li = document.createElement('li'); li.className = 'wix-w';
        const row = { slug: w.w, title: w.title, author: w.author, tradition: w.tradition, volume: w.volume };
        li.innerHTML = `<div class="wix-h"><a class="wix-t" href="${esc(opts.readHref(w.w, w.best, forms[0] || ''))}">${opts.title(w.w, row)}</a>${w.en ? '<span class="wcx-en" title="This work can be read in English">English</span>' : ''}<span class="wix-n">${n(w.pages)} ${w.pages === 1 ? 'page' : 'pages'}</span></div>
          ${opts.meta(row) ? `<div class="wix-m">${opts.meta(row)}</div>` : ''}
          <div class="wix-best"><span class="wix-none">Reading its best page…</span></div>
          <div class="wix-c"><span class="wcx-ev">${ev(w)}</span><button type="button" class="wix-pv" data-cw="${esc(w.w)}" aria-expanded="false">More passages ▾</button></div>`;
        ol.appendChild(li);
        lazy(li, () => limited(() => cardBest(li, w)).catch(() => {}));
      });
      st.shown = Math.min(pool().length, st.shown + k);
      const left = pool().length - st.shown;
      foot.innerHTML = left > 0 ? `<button type="button" class="wix-go">More works · ${n(left)} more ranked</button>` : '';
      const b = foot.querySelector('button'); if (b) b.onclick = () => more(WORKS_STEP);
    }
    // the pages the card ranks for a work, best first ([page, score, …, cites its verse, statements filed under it])
    const ranked = w => (w.pp || []).slice().sort((a, b) => b[1] - a[1]);
    const tagsOf = p => [p[3] ? 'cites its verse' : '', p[4] ? `${p[4]} ${p[4] === 1 ? 'statement' : 'statements'} filed under it` : ''].filter(Boolean).join(' · ');
    const hrefOf = (w, p) => opts.readHref(w.w, p, forms[0] || pforms[0] || '');
    async function cardBest(li, w) {
      const at = li.querySelector(':scope > .wix-best'), p = ranked(w)[0];
      if (!at) return;
      if (!p) { at.remove(); return; }
      const [x] = await bestOf(w.w, [p[0]], look);
      at.outerHTML = passageHtml(hrefOf(w, p[0]), pageText(w.w, p[0]), x.b, 0, tagsOf(p));
    }
    more(8); startWith();
    async function passages(li, w, btn) {
      let box = li.querySelector(':scope > .wix-inst');
      if (box) { box.hidden = !box.hidden; btn.setAttribute('aria-expanded', String(!box.hidden)); btn.textContent = box.hidden ? 'More passages ▾' : 'Hide ▴'; return; }
      box = document.createElement('div'); box.className = 'wix-inst'; li.appendChild(box);
      btn.setAttribute('aria-expanded', 'true'); btn.textContent = 'Hide ▴';
      const pp = ranked(w).slice(1), st = { shown: 0 };   // the best page is already shown above the button
      const il = document.createElement('div'), ft = document.createElement('div'); ft.className = 'wix-if'; box.append(il, ft);
      if (!pp.length) { il.innerHTML = '<span class="wix-none">The card ranks no other page of this work.</span>'; return; }
      async function next(k) {
        const batch = pp.slice(st.shown, st.shown + k); st.shown += batch.length;
        ft.innerHTML = '<span class="wix-none">Reading the pages…</span>';
        const got = await bestOf(w.w, batch.map(p => p[0]), look);
        got.forEach((x, i) => il.insertAdjacentHTML('beforeend', passageHtml(hrefOf(w, x.page), pageText(w.w, x.page), x.b, 0, tagsOf(batch[i]))));
        const left = pp.length - st.shown;
        ft.innerHTML = left > 0 ? `<button type="button" class="wix-go" data-n="5">${Math.min(5, left)} more pages</button> <button type="button" class="wix-go" data-n="all">all ${n(left)} left</button>` : '';
        ft.querySelectorAll('button').forEach(b => { b.onclick = () => next(b.dataset.n === 'all' ? Infinity : 5); });
      }
      await next(5);
    }
    slot.addEventListener('click', async e => {
      const t = e.target.closest('button'); if (!t || !slot.contains(t)) return;
      if (t.dataset.ct) {
        st.trad = t.dataset.ct === '*' ? null : t.dataset.ct; st.shown = 0; ol.innerHTML = '';
        slot.querySelectorAll('button[data-ct]').forEach(b => b.setAttribute('aria-pressed', String(b === t)));
        more(8); startWith(); return;
      }
      if (t.dataset.cmore) { const r = slot.querySelector(`[data-crest="${t.dataset.cmore}"]`); if (r) { r.hidden = false; r.style.display = 'contents'; } t.parentElement.remove(); }
      else if (t.dataset.cw) { const w = (c.top || []).find(x => x.w === t.dataset.cw); if (w) { t.disabled = true; await passages(t.closest('li'), w, t).catch(() => {}); t.disabled = false; } }
    });
  }

  function mount(host, opts) {
    const ph = phraseOf(opts.query), ws = ph ? ph.ws : words(opts.query);
    host.innerHTML = '';
    if (!ws || !host) return null;
    style();
    const box = document.createElement('section');
    box.className = 'wix'; box.setAttribute('aria-live', 'polite');
    const quoted = ph ? '“' + esc(ph.text) + '”' : shown(opts.query, ws).map(w => '“' + esc(w) + '”').join(' + ');
    const phNote = ph ? `<span class="wix-phn"> The words stand next to each other, in this order${ph.skipped.length ? ` — the index leaves out small words (${ph.skipped.map(esc).join(', ')}), so “${esc(ph.ws.join(' … '))}” also finds the phrase with another small word between` : ''}.</span>` : '';
    box.innerHTML = `<h3>${quoted}<span class="wix-how">${ph ? ' as a phrase' : ws.length > 1 ? ' on the same page' : ''}</span> — ${opts.scope ? 'in ' + esc(opts.scope.label) : 'every text in the library'}</h3>
      <p class="wix-sub">Counted from the library’s word index: every page of ${opts.scope ? esc(opts.scope.label) : 'every work'}, a duplicate edition once.${phNote} <a href="#" class="wix-jump">Passages with excerpts ↓</a></p>
      <div class="wix-forms"></div><div class="wix-dist" role="group" aria-label="How close" hidden></div><div class="wix-sum">Counting…</div><div class="wix-trad" role="group" aria-label="Tradition"></div><div class="wix-list"></div>`;
    host.appendChild(box);
    const cslot = document.createElement('section'); host.insertBefore(cslot, box); if (!opts.scope) conceptCard(cslot, opts).catch(e => console.warn('concept card', e));
    const $ = s => box.querySelector(s);
    const state = { dist: { k: 0, ordered: false }, seq: 0, view: 0, all: [], allFull: false, groups: ws.map(w => { const f = forms(w); return { word: w, cands: f.all.slice(0, Math.floor(40 / ws.length)), off: f.off, on: new Set(), counts: {}, more: [] }; }), trad: null, sum: [], byTrad: new Map() };
    const groups = () => state.groups.map(g => [...g.on]).filter(g => g.length);
    // the distance asked: a quoted phrase exactly (its offsets; an engine without the positions table reads the pairs), or for two or
    // three words the reader's choice (state.dist: same page, or within k words, in the typed order or not)
    const spanBody = () => (ph ? { phrase: true, offsets: ph.offsets } : state.dist.k ? { within: state.dist.k, ordered: state.dist.ordered } : {});
    const post = b => patient(opts.post)(b.by !== 'forms' ? { ...b, ...spanBody() } : b);

    function formsHtml() {
      return state.groups.map((g, gi) => {
        const have = g.cands.filter(f => g.counts[f]).sort((a, b) => g.counts[b] - g.counts[a]);
        const chips = have.map(f => `<label class="wix-f"><input type="checkbox" data-g="${gi}" data-f="${esc(f)}"${g.on.has(f) ? ' checked' : ''}>${esc(asTyped(f))} <span>${n(g.counts[f])}</span></label>`).join('');
        const extra = g.more.filter(f => !g.cands.includes(f.form)).slice(0, 8);
        const more = extra.length ? `<span class="wix-more">other words beginning “${esc(g.word)}”: ${extra.map(f => `<button type="button" data-g="${gi}" data-add="${esc(f.form)}" title="${n(f.works)} works">${esc(f.form)}</button>`).join('')}</span>` : '';
        return `<b>${esc(asTyped(g.word))}</b>${chips || '<span class="wix-more">not in the word index</span>'}${more}`;
      }).join('<span style="width:100%"></span>');
    }
    async function loadForms() {
      const all = [...new Set(state.groups.flatMap(g => g.cands))];
      const r = await post({ op: 'words', by: 'forms', groups: [all.slice(0, 40)], prefixes: ws });
      const counts = {}; (r.forms || []).forEach(x => { counts[x.form] = Number(x.works); });
      state.groups.forEach(g => {
        g.counts = Object.fromEntries(g.cands.filter(f => counts[f]).map(f => [f, counts[f]]));
        g.cands.forEach(f => { if (counts[f] && !g.off.has(f)) g.on.add(f); });
        g.more = (r.more || []).filter(x => x.prefix === g.word);
      });
      $('.wix-forms').innerHTML = formsHtml();
    }
    const tradOf = r => r.tradition || '';
    const tradName = t => t || 'Other';
    // The counts, then the works by tradition: a section per tradition (most works first), its three leading works, more on asking.
    async function loadCounts() {
      const my = ++state.seq, G = groups();
      if (G.length < state.groups.length) { $('.wix-sum').textContent = 'No form of every word is in the word index.'; $('.wix-trad').innerHTML = ''; $('.wix-list').innerHTML = ''; return; }
      $('.wix-sum').textContent = 'Counting every page…';
      const keep = typeof opts.keep === 'function' ? opts.keep : null;
      const [sum, list] = await Promise.all([
        keep ? null : post({ op: 'words', by: 'summary', groups: G }),
        post({ op: 'words', by: 'works', groups: G, limit: keep ? 2000 : 600 })]);
      if (my !== state.seq) return;
      if (keep) {
        // A SET (opts.keep): an author's works are a few hundred at most, so one list of 2,000 holds every work of the room that
        // uses the word; kept to the set, it is complete, and the counts below are summed from it rather than asked of the server.
        const kept = (list.rows || []).filter(r => keep(r.slug)), by = new Map();
        kept.forEach(r => { const t = tradOf(r), a = by.get(t) || { tradition: t, works: 0, pages: 0, occ: 0 }; a.works += 1; a.pages += Number(r.pages); a.occ += Number(r.occurrences); by.set(t, a); });
        list.rows = kept;
        state.sum = [...by.values()].sort((a, b) => (a.tradition ? 0 : 1) - (b.tradition ? 0 : 1) || b.works - a.works);
      } else state.sum = (sum.rows || []).map(r => ({ tradition: tradOf(r), works: Number(r.works), pages: Number(r.pages), occ: Number(r.occurrences) }))
        .sort((a, b) => (a.tradition ? 0 : 1) - (b.tradition ? 0 : 1) || b.works - a.works);
      const tot = state.sum.reduce((a, r) => ({ works: a.works + r.works, pages: a.pages + r.pages, occ: a.occ + r.occ }), { works: 0, pages: 0, occ: 0 });
      $('.wix-sum').innerHTML = tot.works ? `<b>${n(tot.works)}</b> ${tot.works === 1 ? 'work' : 'works'} · ${n(tot.pages)} ${tot.pages === 1 ? 'page' : 'pages'} · ${n(tot.occ)} ${tot.occ === 1 ? 'time' : 'times'}` : 'In no work of the library.';
      state.byTrad = new Map();
      const all = list.rows || [];
      state.all = all; state.allFull = !!keep || all.length >= tot.works;
      for (const s of state.sum) {
        const rows = all.filter(r => tradOf(r) === s.tradition);
        state.byTrad.set(s.tradition, { rows, full: rows.length >= s.works });
      }
      if (state.trad !== null && !state.byTrad.has(state.trad)) state.trad = null;
      tradButtons(); render();
    }
    function tradButtons() {
      $('.wix-trad').innerHTML = state.sum.length > 1 ? [`<button type="button" data-t="*" aria-pressed="${state.trad === null}">All traditions</button>`]
        .concat(state.sum.map(s => `<button type="button" data-t="${esc(s.tradition)}" aria-pressed="${state.trad === s.tradition}">${esc(tradName(s.tradition))}<span>${n(s.works)}</span></button>`)).join('') : '';
    }
    // a tradition's rows, fetched on their own when the first list did not reach them
    async function rowsOf(t, need) {
      const b = state.byTrad.get(t);
      if (b.full || b.rows.length >= need || typeof opts.keep === 'function') return b;   // a set's rows are all in hand
      const r = await post({ op: 'words', by: 'works', groups: groups(), tradition: t, limit: 2000 });
      b.rows = r.rows || b.rows; b.full = true;
      return b;
    }
    // ONE RANKED LIST (2026-10-08): every work in the word service's order (BM25: the treatises on the word first), a tradition
    // button narrowing it; WORKS_STEP works at a time, each with its best passage read as it comes into view.
    function render() {
      const listEl = $('.wix-list'); listEl.innerHTML = '';
      const ol = document.createElement('ol'); ol.className = 'wix-rank';
      const foot = document.createElement('div'); foot.className = 'wix-sf';
      listEl.append(ol, foot);
      const my = ++state.view, st = { shown: 0, works: 0 };
      const total = state.trad === null ? state.sum.reduce((a, x) => a + x.works, 0) : ((state.sum.find(x => x.tradition === state.trad) || {}).works || 0);
      async function more(k) {
        foot.innerHTML = '<span class="wix-none">Loading…</span>';
        const gs = grouped(await rowsFor(st.works + k * 3 + 30));
        if (my !== state.view) return;
        const next = gs.slice(st.shown, st.shown + k);
        next.forEach(g => {
          const li = entry(g); ol.appendChild(li); st.works += g.rows.length;
          lazy(li, () => limited(() => firstPassage(li, g)).catch(() => { const at = li.querySelector(':scope > .wix-best'); if (at) at.remove(); }));
        });
        st.shown += next.length;
        const left = total - st.works;
        foot.innerHTML = left > 0 && next.length ? `<button type="button" class="wix-go">More works · ${n(left)} more</button>` : '';
        const bt = foot.querySelector('button'); if (bt) bt.onclick = () => more(WORKS_STEP);
      }
      more(WORKS_STEP).catch(fail);
    }
    // the ranked rows the list needs: the first answer (600 rows) or, past it, a longer one; a tradition's own rows when one is chosen
    async function rowsFor(need) {
      if (state.trad !== null) return (await rowsOf(state.trad, need)).rows;
      if (!state.allFull && state.all.length < need) {
        const lim = Math.min(2000, Math.max(600, need * 2));
        const r = await post({ op: 'words', by: 'works', groups: groups(), limit: lim });
        if (r && r.rows) { state.all = r.rows; state.allFull = r.rows.length < lim; }
      }
      return state.all;
    }
    const list = v => (Array.isArray(v) ? v : String(v || '').replace(/^\[|\]$/g, '').split(',')).map(s => s.trim()).filter(Boolean);
    const times = (o, p) => `${n(o)} ${Number(o) === 1 ? 'time' : 'times'} · ${n(p)} ${Number(p) === 1 ? 'page' : 'pages'}`;
    const unit = slug => (/^(pld|pg)-/.test(slug) ? 'col.' : 'p.');
    const pageLabel = (slug, p) => unit(slug) + ' ' + esc(String(p).replace(/^0+(?=\d)/, ''));
    const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
    // One entry per work; the volumes of one work (same title, same author) are one entry, its volumes in order as buttons.
    function grouped(rows) {
      const by = new Map(), out = [];
      for (const r of rows) {
        const k = r.author ? r.author + '\u0001' + (r.title || r.slug) : r.slug;
        let g = by.get(k);
        if (!g) { g = { rows: [], occ: 0, pages: 0 }; by.set(k, g); out.push(g); }
        g.rows.push(r); g.occ += Number(r.occurrences); g.pages += Number(r.pages);
      }
      // THE SERVER'S ORDER (2026-10-08). The rows come ranked by BM25 (_words.mjs: occurrences weighed against a work's length,
      // benchmarked against raw counts 10-02: nDCG@10 .67 vs .62), so "justification" opens with the treatises on justification.
      // Re-sorting them by raw count put the longest works first (Gerhard's Loci over Owen's Doctrine of Justification by Faith).
      // A work's volumes keep the place of their best-ranked volume.
      return out;
    }
    const hlOf = r => { const f = list(r.forms), best = list(r.best_forms); return best.find(x => ws.includes(x)) || best[0] || f.find(x => ws.includes(x)) || f[0] || ws[0]; };
    // a form as the reader typed its word (10-08: the index's folded spelling showed "iustification" under a search for
    // "justification"); forms of other words keep the index's spelling
    const typedAs = new Map(ws.map((w, i) => [w, shown(opts.query, ws)[i]]));
    const asTyped = f => { for (const [w, t] of typedAs) if (t !== w && f.startsWith(w)) return t + f.slice(w.length); return f; };
    function formsLine(rows) {
      const f = new Set(); rows.forEach(r => list(r.forms).forEach(x => f.add(x)));
      const fl = [...new Set(ws.filter(x => f.has(x)).concat([...f]))].map(asTyped);
      return fl.length ? `<span class="wix-fl">${esc(fl.slice(0, 4).join(', '))}${fl.length > 4 ? ` <span class="wix-plus" title="${esc(fl.join(', '))}">+${fl.length - 4}</span>` : ''}</span>` : '';
    }
    function entry(g) {
      const top = g.rows[0], li = document.createElement('li'), vols = g.rows.length > 1;
      li.className = 'wix-w' + (vols ? ' wix-g' : '');
      const title = opts.title(top.slug, top), meta = [same(top.author, top.title) ? '' : top.author, vols ? `${g.rows.length} volumes` : top.volume].filter(Boolean).map(esc).join(' · ');
      const vrows = vols ? g.rows.slice().sort((a, b) => volNo(a.volume) - volNo(b.volume) || String(a.slug).localeCompare(String(b.slug), undefined, { numeric: true })) : [];
      const vlab = volLabels(vrows);
      const volBtns = vols ? vrows
        .map((r, i) => `<button type="button" class="wix-vol" data-pages="${esc(r.slug)}" data-hl="${esc(hlOf(r))}" aria-expanded="false"${i >= 12 ? ' hidden' : ''} title="${esc([r.volume, times(r.occurrences, r.pages)].filter(Boolean).join(' — '))}">${esc(vlab[i])}<span>${n(r.occurrences)}</span></button>`).join('')
          + (g.rows.length > 12 ? `<button type="button" class="wix-pv" data-allvols>all ${g.rows.length} volumes ▾</button>` : '') : '';
      li.innerHTML = `<div class="wix-h"><a class="wix-t" href="${esc(opts.readHref(top.slug, top.best_page, hlOf(top)))}">${title}</a><span class="wix-n">${times(g.occ, g.pages)}</span></div>
        ${meta ? `<div class="wix-m">${meta}</div>` : ''}
        <div class="wix-best"><span class="wix-none">Reading its best page…</span></div>
        <div class="wix-c">${vols ? `<span class="wix-vl">More passages in</span>${volBtns}` : `${formsLine(g.rows)}<button type="button" class="wix-pv" data-pages="${esc(top.slug)}" data-hl="${esc(hlOf(top))}" aria-expanded="false">More passages ▾</button>`}</div>`;
      return li;
    }
    // a quoted phrase is looked for as a phrase (its words in order); otherwise every form of every word, in either lane
    const lookOf = () => (ph ? { chains: [ph.ws] } : { forms: [...new Set(groups().flat())] });
    const backup = () => (ph ? { forms: [...new Set(groups().flat())] } : null);
    // the work's best page (the word service's best_page: the page with the most uses), shown before any button is pressed
    async function firstPassage(li, g) {
      const top = g.rows[0], at = li.querySelector(':scope > .wix-best');
      if (!at) return;
      if (top.best_page == null || top.best_page === '') { at.remove(); return; }
      const [x] = await bestOf(top.slug, [top.best_page], lookOf(), backup());
      const label = (g.rows.length > 1 ? esc(volShort(top.volume)) + ', ' : '') + pageLabel(top.slug, top.best_page);
      li.dataset.best = `${top.slug}|${top.best_page}`;
      at.outerHTML = passageHtml(opts.readHref(top.slug, top.best_page, hlOf(top)), label, x.b, 0, '');
    }
    // More passages: a work's (or one volume's) other pages, the most uses first, one passage each, five at a time.
    async function preview(li, slug, hl, btn) {
      let box = li.querySelector(':scope > .wix-inst');
      const toggle = btn.classList.contains('wix-pv');
      if (box && box.dataset.slug === slug) {
        box.hidden = !box.hidden; btn.setAttribute('aria-expanded', String(!box.hidden));
        if (toggle) btn.textContent = box.hidden ? 'More passages ▾' : 'Hide ▴';
        return;
      }
      li.querySelectorAll('button[aria-expanded=true]').forEach(b => b.setAttribute('aria-expanded', 'false'));
      if (box) box.remove();
      box = document.createElement('div'); box.className = 'wix-inst'; box.dataset.slug = slug; box.innerHTML = '<span class="wix-none">Reading the pages…</span>'; li.appendChild(box);
      btn.setAttribute('aria-expanded', 'true'); if (toggle) btn.textContent = 'Hide ▴';
      const r = await post({ op: 'words', by: 'pages', groups: groups(), work: slug, limit: 2000 }).catch(fail);
      if (!r || !r.rows) { box.remove(); return; }
      const all = r.rows, st = { shown: 0 };
      // the busiest pages first (book order among equals: the sort is stable); the page already shown above is not repeated
      const pages = all.filter(p => `${slug}|${p.page}` !== li.dataset.best).sort((a, b) => Number(b.occurrences) - Number(a.occurrences));
      box.innerHTML = `${btn.classList.contains('wix-vol') ? `<div class="wix-ih">${esc(btn.firstChild.textContent)} · ${n(all.length)} ${all.length === 1 ? 'page' : 'pages'}</div>` : ''}<div class="wix-il"></div><div class="wix-if"></div>
        <details class="wix-all"><summary>All ${n(all.length)} ${all.length === 1 ? 'page' : 'pages'} as links, in book order</summary><div class="wix-pages">${all.map(p => `<a href="${esc(opts.readHref(slug, p.page, hl))}">${pageLabel(slug, p.page)}${Number(p.occurrences) > 1 ? ' ×' + p.occurrences : ''}</a>`).join('')}</div></details>`;
      const il = box.querySelector('.wix-il'), foot = box.querySelector('.wix-if');
      if (!pages.length) { il.innerHTML = '<span class="wix-none">No other page holds the word.</span>'; return; }
      async function next(k) {
        const batch = pages.slice(st.shown, st.shown + k); st.shown += batch.length;
        foot.innerHTML = '<span class="wix-none">Reading the pages…</span>';
        const got = await bestOf(slug, batch.map(p => p.page), lookOf(), backup());
        got.forEach((x, i) => il.insertAdjacentHTML('beforeend', passageHtml(opts.readHref(slug, x.page, hl), pageLabel(slug, x.page), x.b, batch[i].occurrences, '')));
        const left = pages.length - st.shown;
        foot.innerHTML = left > 0 ? `<button type="button" class="wix-go" data-n="5">${Math.min(5, left)} more pages</button> <button type="button" class="wix-go" data-n="all">all ${n(left)} left</button>` : '';
        foot.querySelectorAll('button').forEach(b => { b.onclick = () => next(b.dataset.n === 'all' ? Infinity : 5); });
      }
      await next(5);
    }
    box.addEventListener('change', e => {
      const t = e.target; if (!t.matches('input[data-f]')) return;
      const g = state.groups[+t.dataset.g]; if (t.checked) g.on.add(t.dataset.f); else g.on.delete(t.dataset.f);
      loadCounts().catch(fail);
    });
    box.addEventListener('click', async e => {
      const t = e.target.closest('a,button'); if (!t || !box.contains(t)) return;
      if (t.matches('a.wix-jump')) { e.preventDefault(); const to = document.getElementById('count') || document.getElementById('results'); if (to) to.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      else if (t.matches('button[data-add]')) { const g = state.groups[+t.dataset.g]; if (!g.cands.includes(t.dataset.add)) g.cands.push(t.dataset.add); g.counts[t.dataset.add] = Number((g.more.find(x => x.form === t.dataset.add) || {}).works || 1); g.on.add(t.dataset.add); $('.wix-forms').innerHTML = formsHtml(); loadCounts().catch(fail); }
      else if (t.matches('button[data-allvols]')) { t.closest('.wix-c').querySelectorAll('button.wix-vol[hidden]').forEach(x => { x.hidden = false; }); t.remove(); }
      else if (t.matches('button[data-t]')) { state.trad = t.dataset.t === '*' ? null : t.dataset.t; tradButtons(); render(); }
      else if (t.matches('button[data-pages]')) {
        t.disabled = true;
        await preview(t.closest('li'), t.dataset.pages, t.dataset.hl, t).catch(fail);
        t.disabled = false;
      }
    });
    function fail(err) { $('.wix-sum').innerHTML = '<span class="wix-err">The word index could not be reached. The passages below are still searchable.</span>'; console.warn('word index', err); }
    // WORDS IN ORDER, AT A DISTANCE (10-02 PM): two or three words may be asked on the same page (the default), within 5 or 15 words of
    // each other, and in the typed order; offered only where the positions index is published (opts.has, else the page engine's)
    const DIST = [[0, 'On the same page'], [5, 'Within 5 words'], [15, 'Within 15 words']];
    function distButtons() {
      const el = $('.wix-dist');
      el.innerHTML = DIST.map(([k, label]) => `<button type="button" data-dist="${k}" aria-pressed="${state.dist.k === k}">${label}</button>`).join('')
        + `<label class="wix-ord"><input type="checkbox" data-ord${state.dist.ordered ? ' checked' : ''}${state.dist.k ? '' : ' disabled'}> in this order</label>`;
    }
    const howLine = () => { $('.wix-how').textContent = state.dist.k ? ` within ${state.dist.k} words${state.dist.ordered ? ', in this order' : ''}` : ' on the same page'; };
    const hasTable = opts.has || (window.FRWordLocal && window.FRWordLocal.has) || (() => Promise.resolve(false));
    if (!ph && ws.length > 1) Promise.resolve(hasTable('positions')).then(yes => { if (yes) { distButtons(); $('.wix-dist').hidden = false; } }).catch(() => {});
    if (ph) Promise.resolve(hasTable('positions')).then(yes => {
      const sub = $('.wix-sub'); if (!yes || !sub) return;
      const note = sub.querySelector('.wix-phn'); if (note) note.textContent = ' Exactly these words in this order, the small words counted too.';
    }).catch(() => {});
    box.addEventListener('click', e => {
      const t = e.target.closest('button[data-dist]'); if (!t) return;
      state.dist.k = Number(t.dataset.dist); if (!state.dist.k) state.dist.ordered = false;
      distButtons(); howLine(); loadCounts().catch(fail);
    });
    box.addEventListener('change', e => {
      if (!e.target.matches('input[data-ord]')) return;
      state.dist.ordered = e.target.checked; howLine(); loadCounts().catch(fail);
    });
    loadForms().then(loadCounts).catch(fail);
    return { words: ws };
  }
  /* A REQUEST THAT HANGS IS ASKED AGAIN (2026-10-08). One /v1/words request in three hung (the SQL worker runs one query at a time,
     and a stalled storage read held its turn): the panel waited until the page's own 45 s limit and said the index could not be
     reached. Each request now gets LIGHT_MS (counts) or HEAVY_MS (works, pages), then one more try. */
  const LIGHT_MS = 15000, HEAVY_MS = 40000;
  function patient(send) {
    return body => {
      const ms = body && (body.by === 'works' || body.by === 'pages') ? HEAVY_MS : LIGHT_MS;
      const once = () => { let t; return Promise.race([Promise.resolve().then(() => send(body)), new Promise((_, rej) => { t = setTimeout(() => rej(new Error('no answer within ' + ms / 1000 + ' s')), ms); })]).finally(() => clearTimeout(t)); };
      return once().catch(() => once());
    };
  }

  /* The Works tab searches titles, so a reader who types a word there sees only works NAMED by it. One line says how many works
     hold the word in their text and opens the full list (opts.open). Cached per query: the tab re-renders as headings load. */
  const memo = new Map();
  async function count(query, post) {
    const ws = words(query); if (!ws) return null;
    const key = ws.join(' ');
    if (!memo.has(key)) memo.set(key, (async () => {
      const gs = ws.map(w => forms(w)), all = [...new Set(gs.flatMap(g => g.all))].slice(0, 40);
      const r = await patient(post)({ op: 'words', by: 'forms', groups: [all] });
      const have = new Set((r.forms || []).map(x => x.form));
      const groups = gs.map(g => g.all.filter(f => have.has(f) && !g.off.has(f)));
      if (groups.some(g => !g.length)) return { ws, works: 0 };
      const sum = await patient(post)({ op: 'words', by: 'summary', groups });
      return { ws, works: (sum.rows || []).reduce((a, x) => a + Number(x.works), 0) };
    })().catch(() => { memo.delete(key); return null; }));
    return memo.get(key);
  }
  async function teaser(host, opts) {
    if (!host) return;
    const my = (host.__wixSeq = (host.__wixSeq || 0) + 1);
    const c = await count(opts.query, opts.post);
    if (my !== host.__wixSeq || !c || !c.works) return;
    style();
    host.innerHTML = `<div class="wix wix-teaser"><b>${shown(opts.query, c.ws).map(w => '“' + esc(w) + '”').join(' + ')}</b> ${c.ws.length > 1 ? 'occur together on the pages of' : 'occurs in the text of'} <b>${n(c.works)} ${c.works === 1 ? 'work' : 'works'}${opts.scope && opts.scope.by ? ' ' + esc(opts.scope.by) : ''}</b> (with ${c.ws.length > 1 ? 'their' : 'its'} other forms). The list below matches titles and headings only. <button type="button" class="wix-go">List every text</button></div>`;
    host.querySelector('button').onclick = () => opts.open();
  }
  /* BY IDEA (owner 2026-10-06: "haec sancta" brought pages on holiness; "make semantic search intuitive and useful"): the idea a query
     names, exactly or within a slip of the pen, gets the card Exact words shows, at the top of the passages, and is returned so the
     search can look for its meaning (its label and gloss) rather than the bare words. A query naming no concept returns null and is
     searched as typed. opts: {query, readHref, title, meta, asTyped?}; asTyped() re-runs the search on the words as typed. */
  async function idea(slot, opts) {
    const index = await loadConcepts();
    if (!index || !slot) return null;
    style();
    const hit = conceptOf(opts.query, index) || conceptNear(opts.query, index);
    if (!hit) return null;
    const line = document.createElement('p');
    line.className = 'wix-idea';
    const typed = String(opts.query || '').trim();
    line.innerHTML = hit.near
      ? `Showing the idea <b>${esc(hit.label)}</b>, the nearest name the library knows to “${esc(typed)}”.${opts.asTyped ? ' <button type="button" class="wix-go">Search the words as typed</button>' : ''}`
      : `Searched with the library's idea <b>${esc(hit.label)}</b>.${opts.asTyped ? ' <button type="button" class="wix-go">Search the words as typed</button>' : ''}`;
    const b = line.querySelector('button');
    if (b) b.onclick = () => opts.asTyped();
    const card = document.createElement('section');
    slot.append(line, card);
    conceptCard(card, { ...opts, query: hit.part ? typed : hit.label }, hit.part ? { ...hit, part: true } : { ...hit, part: false }).catch(e => console.warn('idea card', e));
    return { id: hit.id, label: hit.label, gloss: hit.gloss || '', near: !!hit.near };
  }
  /* WHAT WAS SEARCHED (2026-10-07, /api/isearch): the model's reading of the query, above the idea card — what the page understood,
     the words it searched exactly, and a way back to the words as typed. A library idea the model says names something else is
     left out of the search, and its card folds away behind a link, so a wrong concept never stands over the results. */
  function asked(slot, understood, opts = {}) {
    if (!slot || !understood) return;
    style();
    slot.querySelector('.wix-asked')?.remove();
    const terms = [...(understood.latin || []), ...(understood.english || [])].filter(Boolean).slice(0, 8);
    if (understood.description) {
      // the model's sentence as a statement of the idea: its preamble off, the first two sentences at most
      let said = String(understood.description).replace(/^(?:this (?:phrase |search |query )?(?:refers to|concerns|is about)|the reader is (?:looking|searching) for)\s+/i, '');
      said = said.charAt(0).toUpperCase() + said.slice(1);
      const two = said.match(/^(?:[^.!?]+[.!?]+\s*){1,2}/);
      if (two && two[0].length >= 40) said = two[0].trim();
      const box = document.createElement('p');
      box.className = 'wix-asked';
      box.innerHTML = `<span class="wix-k">Searched as</span> ${esc(said)}`
        + (terms.length ? `<span class="wix-terms">${terms.map(t => `<i>${esc(t)}</i>`).join(' · ')}</span>` : '')
        + (opts.asTyped && !slot.querySelector('.wix-idea .wix-go') ? ' <button type="button" class="wix-go">Search the words as typed</button>' : '');
      const b = box.querySelector('button');
      if (b) b.onclick = () => opts.asTyped();
      slot.prepend(box);
    }
    const c = understood.concept, line = slot.querySelector('.wix-idea');
    if (c && c.fits === false && line && !line.dataset.unfit) {
      line.dataset.unfit = '1';
      line.innerHTML = `The library's idea <b>${esc(c.label)}</b> names something else, so it was left out. <button type="button" class="wix-go">Show it anyway</button>`;
      const card = line.nextElementSibling;
      if (card) card.hidden = true;
      line.querySelector('button').onclick = (e) => { if (card) card.hidden = false; e.target.remove(); };
    }
  }
  window.FRWordIndex = { mount, teaser, count, inflect, forms, words, phraseOf, fold, conceptOf, conceptNear, loadConcepts, idea, asked, card: conceptCard };
})();
