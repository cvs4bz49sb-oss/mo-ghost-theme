/* The Migne finder (10-10, owner: "for mansi i want the previous dropdown selection tools ... add that same capability elsewhere"):
   the PG/PL prototypes' selection tools, ported for the Greek and Latin guides. One search for names, titles and citations
   ("PG 6:475B", "PL 158:227C", resolved to the work and column with a drawing of the volume, the page, the column and its letter),
   and three tabs: By author (a fold per century with its sparkline; a writer opens to his works, the editors' matter last), By volume
   (the shelf, earlier spines lighter, and a panel with the volume's years and contents), By century (every life as a line, colored by
   region, with the general councils above; eras glide; a click opens a card). Scoped .tf, ids tf-*. */
window.TGFinder = (host, D, C) => {
  const method = (html) => (window.TFRMethod ? window.TFRMethod.html(html) : html);
  const {TG} = window, { esc, fmt } = TG, G = TG.hasG && !TG.reduce ? window.gsap : null, K = C.key;
  const clamp = (u) => Math.max(0, Math.min(1, u)), outC = (u) => 1 - (1 - u)**3, inOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2)**3 / 2);
  const CENT = (y) => Math.floor((y - 1) / 100) + 1, ORD = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : (n % 10 < 4 ? n % 10 : 0)]);
  if (!document.getElementById('tf-css')) { const st = document.createElement('style'); st.id = 'tf-css'; st.textContent = `
.tg .tf-finder { display: flex; gap: 8px; flex-wrap: wrap; max-width: 48rem; }
.tg .tf-finder input { flex: 1 1 18rem; min-width: 0; font: 1.12rem var(--display); color: var(--ink); background: var(--card); border: 1px solid var(--rule); border-radius: 4px; padding: 10px 14px; }
.tg .tf-finder button { font: 600 0.9rem var(--body); background: var(--rubric); color: var(--card); border: 0; border-radius: 4px; padding: 10px 18px; cursor: pointer; }
.tg .tf-ex { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0 0; }
.tg .tf-out { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 0.9fr); gap: 10px 32px; align-items: center; margin-top: 12px; }
.tg .tf-out:empty { display: none; }
.tg .tf-out .msg { font-size: 0.98rem; } .tg .tf-out .msg p { margin: 0 0 6px; }
.tg .tf-out svg { width: 100%; max-width: 460px; height: auto; display: block; justify-self: center; }
.tg .tf-out svg text { font-family: var(--body); }
.tg .tf-tabs { position: relative; display: flex; flex-wrap: wrap; border-bottom: 1px solid var(--rule); margin-top: 30px; }
.tg .tf-tabs button { font: 0.98rem var(--body); color: var(--muted); background: none; border: 0; padding: 12px 18px; cursor: pointer; }
.tg .tf-tabs button[aria-selected="true"] { color: var(--ink); font-weight: 600; }
.tg .tf-ink { position: absolute; left: 0; bottom: -1px; height: 2px; width: 0; background: var(--rubric); pointer-events: none; }
.tg .tf-panel { padding-block: 22px 0; } .tg .tf-panel > .intro { color: var(--muted); max-width: 48rem; margin: 0 0 16px; }
.tg .tf-cent { border-bottom: 1px solid var(--rule); }
.tg .tf-cent > summary { cursor: pointer; list-style: none; display: flex; align-items: center; gap: 14px; padding: 12px 4px; }
.tg .tf-cent > summary::-webkit-details-marker, .tg .tf-auth > summary::-webkit-details-marker { display: none; }
.tg .tf-cent > summary b { font: 400 1.5rem/1 var(--display); min-width: 9.5rem; } .tg .tf-cent > summary span { color: var(--muted); font-size: 0.9rem; min-width: 6.5rem; }
.tg .tf-cent > summary svg.spark { flex: 1 1 8rem; max-width: 26rem; min-width: 0; height: 18px; }
.tg .spark line { stroke: var(--muted); stroke-opacity: 0.5; } .tg .spark line.g { stroke: var(--rubric); stroke-opacity: 1; stroke-width: 2; }
.tg .tf-cent > summary i { margin-left: auto; color: var(--muted); font-style: normal; transition: transform 0.2s; } .tg .tf-cent[open] > summary i { transform: rotate(90deg); }
.tg .tf-alist { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 24rem), 1fr)); gap: 0 34px; margin: 0 0 14px; }
.tg .tf-auth { border-top: 1px solid color-mix(in srgb, var(--rule) 55%, transparent); }
.tg .tf-auth > summary { list-style: none; cursor: pointer; display: grid; grid-template-columns: 6.8rem minmax(0, 1fr); gap: 10px; padding: 7px 0; font-size: 0.95rem; }
.tg .tf-auth > summary .d { color: var(--rubric); font-weight: 600; font-variant-numeric: tabular-nums; font-size: 0.82rem; padding-top: 2px; }
.tg .tf-auth > summary small { display: block; color: var(--muted); font-size: 0.8rem; }
.tg .tf-auth > summary .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; vertical-align: 1px; }
.tg .tf-auth[open] > summary { color: var(--rubric); }
.tg .tf-wlist { list-style: none; margin: 0 0 10px 6.8rem; padding: 0 0 0 10px; border-left: 2px solid var(--rule); font-size: 0.88rem; }
.tg .tf-wlist li { padding: 3px 0; } .tg .tf-wlist a { color: var(--ink); } .tg .tf-wlist a:hover { color: var(--rubric); } .tg .tf-wlist small { color: var(--muted); }
.tg .tf-wlist .who { margin: 4px 0 6px; font-size: 0.85rem; } .tg .tf-wlist .who a { color: var(--rubric); }
.tg .tf mark { background: color-mix(in srgb, var(--gilt) 30%, transparent); color: inherit; border-radius: 2px; }
.tg .tf-whits { margin: 0 0 20px; } .tg .tf-whits h3 { font: 400 1.4rem var(--display); margin: 0 0 6px; } .tg .tf-whits .tf-wlist { margin-left: 0; }
.tg .tf-vgrid { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 24px 32px; align-items: start; }
.tg .tf-shelf { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 6px 2px; padding: 10px 6px 0; border-bottom: 6px solid var(--leather); }
.tg .tf-spine { position: relative; width: 19px; border: 0; padding: 0; border-radius: 2px 2px 1px 1px; cursor: pointer; color: #f1e3c4; box-shadow: inset -2px 0 0 rgba(0,0,0,0.2); }
.tg .tf-spine::before { content: ""; position: absolute; left: 3px; right: 3px; top: 8px; height: 2px; border-top: 1px solid var(--gilt); border-bottom: 1px solid var(--gilt); opacity: 0.8; }
.tg .tf-spine span { position: absolute; left: 0; right: 0; bottom: 6px; font: 9px var(--body); writing-mode: vertical-rl; transform: rotate(180deg); display: flex; align-items: center; justify-content: center; }
.tg .tf-spine[aria-pressed="true"] { outline: 2px solid var(--rubric); outline-offset: 1px; transform: translateY(-6px); }
.tg .tf-spine:hover { filter: brightness(1.12); }
.tg .tf-vpanel { background: var(--card); border: 1px solid var(--rule); border-radius: 4px; padding: 16px 18px; position: sticky; top: 16px; max-height: 82vh; overflow: auto; }
.tg .tf-vpanel h3 { font: 400 1.6rem/1.1 var(--display); margin: 0 0 4px; } .tg .tf-vpanel .meta { color: var(--muted); font-size: 0.88rem; margin: 0 0 6px; }
.tg .tf-vpanel ol { list-style: none; margin: 0; padding: 0; } .tg .tf-vpanel li { padding: 4px 0; font-size: 0.9rem; border-top: 1px solid color-mix(in srgb, var(--rule) 55%, transparent); }
.tg .tf-vpanel li a { color: var(--ink); text-decoration: none; } .tg .tf-vpanel li a:hover { color: var(--rubric); } .tg .tf-vpanel li small { color: var(--muted); display: block; font-size: 0.78rem; }
.tg .tf-rib { display: block; width: 100%; height: 30px; margin: 0 0 10px; overflow: visible; } .tg .tf-rib text { font: 9px var(--body); fill: var(--muted); }
.tg .tf-life { display: block; width: 100%; height: 540px; cursor: crosshair; }
.tg .tf-canvas { position: relative; }
.tg .tf-lpick { min-height: 2.6em; padding: 10px 2px 4px; font-size: 0.95rem; } .tg .tf-lpick b { font-weight: 600; } .tg .tf-lpick a { color: var(--ink); } .tg .tf-lpick small { color: var(--muted); }
.tg .tf-lpick .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; } .tg .tf-lpick .chips a.chip { text-decoration: none; }
.tg .tf-legend i.r { background: var(--rubric); transform: rotate(45deg); border-radius: 1px; }
@media (max-width: 860px) { .tg .tf-vgrid, .tg .tf-out { grid-template-columns: minmax(0, 1fr); } .tg .tf-vpanel { position: static; max-height: none; } .tg .tf-life { height: 440px; } .tg .tf-wlist { margin-left: 0; } }
`; document.head.appendChild(st); }

  // ---------- the data, as the tools want it ----------
  const A = D.authors.map((a, i) => ({ ...a, i, works: [], vols: [] })), V = D.vols, VBY = Object.fromEntries(V.map((v) => [v.v, v]));
  const Wk = D.works.map((w) => ({ t: w[0], s: w[1], v: w[2], c: [w[3], w[4]], a: w[5], k: w[6], an: w[7] }));
  Wk.forEach((w) => { if (w.a >= 0) A[w.a].works.push(w); });
  const KO = { w: 0, f: 1, p: 2, a: 3 };
  A.forEach((a) => { a.works.sort((p, q) => KO[p.k] - KO[q.k] || p.v - q.v || (p.c[0] || 0) - (q.c[0] || 0)); a.vols = [...new Set(a.works.map((w) => w.v))].sort((x, y) => x - y); });
  const ECU = C.ecu || [];
  const vr = (vs) => { if (!vs.length) return ''; const r = []; let s = vs[0], p = vs[0]; for (const v of vs.slice(1).concat([null])) { if (v === p + 1) { p = v; continue; } r.push(s === p ? `${s}` : `${s}–${p}`); s = p = v; } return `${K} ${r.slice(0, 3).join(', ')}${r.length > 3 ? '…' : ''}`; };
  const wref = (w) => `${K} ${w.v}${w.c[0] ? `:${w.c[0]}${w.c[1] && w.c[1] !== w.c[0] ? `–${w.c[1]}` : ''}` : ''}`;
  const aname = (w) => (w.a >= 0 ? A[w.a].n : w.an || '');
  const READ = (s, col) => TG.read(s, col);
  const hl = (t, ql) => (ql ? esc(t).replace(new RegExp(ql.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), (m) => `<mark>${m}</mark>`) : esc(t));

  host.classList.add('tf');
  host.innerHTML = `
    <form class="tf-finder" id="tf-form" role="search" autocomplete="off"><input id="tf-q" type="search" aria-label="Search the shelf" placeholder="${esc(C.placeholder)}"><button type="submit">Search</button></form>
    <div class="tf-ex" id="tf-ex"></div>
    <div class="tf-out" id="tf-out" aria-live="polite"></div>
    <div class="tf-tabs" role="tablist" aria-label="Browse the shelf">
      <button role="tab" id="tf-t-author" aria-controls="tf-p-author" aria-selected="true">By author</button>
      <button role="tab" id="tf-t-volume" aria-controls="tf-p-volume" aria-selected="false">By volume</button>
      <button role="tab" id="tf-t-century" aria-controls="tf-p-century" aria-selected="false">By century</button>
      <span class="tf-ink" id="tf-ink" aria-hidden="true"></span></div>
    <section class="tf-panel" id="tf-p-author" role="tabpanel" aria-labelledby="tf-t-author"><p class="intro" id="tf-a-intro"></p><div id="tf-whits"></div><div id="tf-alist"></div></section>
    <section class="tf-panel" id="tf-p-volume" role="tabpanel" aria-labelledby="tf-t-volume" hidden><p class="intro">${esc(C.volintro)}</p>
      <div class="tf-vgrid"><div><div class="tf-shelf" id="tf-shelf"></div><div class="small" id="tf-vkey"></div></div><aside class="tf-vpanel" id="tf-vpanel" aria-live="polite"></aside></div></section>
    <section class="tf-panel" id="tf-p-century" role="tabpanel" aria-labelledby="tf-t-century" hidden>
      <div class="instrument"><div class="controls" role="group" aria-label="Choose a period"><span id="tf-eras"></span></div>
        <div class="tf-canvas"><canvas class="tf-life" id="tf-life" aria-label="Every writer as a line from birth to death, colored by region"></canvas><div class="tip" id="tf-tip" hidden></div></div>
        <div class="tf-lpick" id="tf-lpick" aria-live="polite"></div>
        <div class="legend tf-legend" id="tf-legend"></div>${method(esc(C.centintro))}</div></section>`;
  const $ = (id) => document.getElementById(id);

  // ---------- tabs ----------
  const tabs = [...host.querySelectorAll('[role=tab]')], ink = $('tf-ink'); let cur = null, firstV = false;
  function moveInk(instant) { const btn = tabs.find((t) => t.getAttribute('aria-selected') === 'true'); if (!btn) return; const x = btn.offsetLeft, w = btn.offsetWidth, y = btn.offsetTop + btn.offsetHeight - ink.parentElement.offsetHeight;
    if (G && !instant) G.to(ink, { x, y, width: w, duration: 0.5, ease: 'power3.out' }); else if (window.gsap) gsap.set(ink, { x, y, width: w }); else Object.assign(ink.style, { transform: `translate(${x}px,${y}px)`, width: `${w}px` }); }
  function show(id, instant) { if (id === cur) return; cur = id; let pane;
    tabs.forEach((t) => { const on = t.id === `tf-t-${id}`, el = $(t.getAttribute('aria-controls')); t.setAttribute('aria-selected', on); el.hidden = !on; if (on) pane = el; });
    moveInk(instant); if (G && !instant) G.fromTo(pane, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out', clearProps: 'transform,opacity' });
    if (id === 'volume' && !firstV) { firstV = true; if (G) G.from(host.querySelectorAll('.tf-spine'), { scaleY: 0, transformOrigin: '50% 100%', duration: 0.55, stagger: 0.005, ease: 'power3.out', clearProps: 'transform' }); }
    if (id === 'century') lifeInit(); }
  tabs.forEach((t) => { t.onclick = () => show(t.id.slice(5)); }); new ResizeObserver(() => moveInk(true)).observe(ink.parentElement);

  // ---------- by author ----------
  const alist = $('tf-alist'), whits = $('tf-whits'), sorted = A.filter((a) => a.fl).sort((a, b) => a.fl - b.fl || a.n.localeCompare(b.n));
  const worksHtml = (ws, ql) => ws.map((w) => `<li><a href="${READ(w.s, w.c[0])}" target="_blank" rel="noopener">${hl(w.t, ql)}</a> <small>${wref(w)}${w.k === 'f' ? ' · fragment' : w.k === 'p' ? ' · preface' : w.k === 'a' ? ' · editors’ matter' : ''}</small></li>`).join('');
  const spark = (k, as) => { const x = (y) => clamp((y - (k - 1) * 100 - 1) / 99) * 100, g = ECU.filter((e) => CENT(e.y) === k);
    return `<svg class="spark" viewBox="0 0 100 18" preserveAspectRatio="none" aria-hidden="true">${as.map((a) => `<line x1="${x(a.fl).toFixed(2)}" x2="${x(a.fl).toFixed(2)}" y1="5" y2="15" vector-effect="non-scaling-stroke"/>`).join('')}${g.map((e) => `<line class="g" x1="${x(e.y).toFixed(2)}" x2="${x(e.y).toFixed(2)}" y1="1" y2="18" vector-effect="non-scaling-stroke"/>`).join('')}</svg>`; };
  const intro = () => `${fmt(sorted.length)} writers in the order of their lives. Open a century and then a writer to see the works and the columns where Migne printed them.`;
  function drawAuthors(q, openFirst = true) { const ql = (q || '').toLowerCase().trim(), hitA = ql ? sorted.filter((a) => a.n.toLowerCase().includes(ql)) : sorted;
    const hitW = ql ? Wk.filter((w) => (w.t || '').toLowerCase().includes(ql)).slice(0, 60) : [];
    whits.innerHTML = hitW.length ? `<div class="tf-whits"><h3>Works</h3><ul class="tf-wlist">${worksHtml(hitW.map((w) => ({ ...w, t: `${w.t}${aname(w) ? `, ${aname(w)}` : ''}` })), ql)}</ul></div>` : '';
    $('tf-a-intro').textContent = ql ? `${fmt(hitA.length)} writers and ${fmt(hitW.length)}${hitW.length === 60 ? '+' : ''} works match “${q}”.` : intro();
    const by = new Map(); hitA.forEach((a) => { const k = CENT(a.fl); if (!by.has(k)) by.set(k, []); by.get(k).push(a); });
    alist.innerHTML = [...by.entries()].map(([k, as], i) => `<details class="tf-cent" data-c="${k}"${ql || (openFirst && i === 0) ? ' open' : ''}><summary><b>${ORD(k)} century</b><span>${as.length} writer${as.length === 1 ? '' : 's'}</span>${spark(k, as)}<i aria-hidden="true">›</i></summary><div class="tf-alist">${
       as.map((a) => `<details class="tf-auth" data-i="${a.i}"><summary><span class="d">${esc(a.d)}</span><span><i class="dot" style="background:${C.fc(a.f)}"></i>${hl(a.n, ql)}<small>${a.works.length} work${a.works.length === 1 ? '' : 's'} · ${vr(a.vols)}${a.pl ? ` · ${esc(a.pl)}` : ''}</small></span></summary></details>`).join('')}</div></details>`).join(''); }
  alist.addEventListener('toggle', (ev) => { const d = ev.target; if (!d.open) return;
    if (d.classList.contains('tf-auth') && !d.querySelector('.tf-wlist')) { const a = A[+d.dataset.i];
      d.insertAdjacentHTML('beforeend', `<ul class="tf-wlist"><li class="who"><a href="${TG.href(`author/?a=${encodeURIComponent(a.n)}`)}" target="_blank" rel="noopener">About ${esc(a.n)}</a>${a.aff ? ` · <small>${esc(a.aff)}</small>` : ''}</li>${worksHtml(a.works)}</ul>`);
      if (G) G.from(d.querySelectorAll('.tf-wlist li:nth-child(-n+30)'), { opacity: 0, x: -6, duration: 0.3, stagger: 0.015, ease: 'power2.out', clearProps: 'opacity,transform' }); }
    else if (d.classList.contains('tf-cent') && G) G.from(d.querySelectorAll(':scope > .tf-alist > .tf-auth:nth-child(-n+40)'), { opacity: 0, y: 8, duration: 0.35, stagger: 0.012, ease: 'power2.out', clearProps: 'opacity,transform' }); }, true);
  drawAuthors('');
  if (G && window.ScrollTrigger) ScrollTrigger.create({ trigger: alist, start: 'top 85%', once: true, onEnter: () => G.fromTo(host.querySelectorAll('.spark'), { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 1.1, stagger: 0.04, ease: 'power2.inOut', clearProps: 'clipPath' }) });
  function openAuthor(name) {
    const a = A.find((x) => x.n === name); if (!a) return false;
    $('tf-q').value = ''; $('tf-out').innerHTML = ''; show('author'); drawAuthors('', false);
    const c = alist.querySelector(`.tf-cent[data-c="${CENT(a.fl)}"]`), d = alist.querySelector(`.tf-auth[data-i="${a.i}"]`); if (!c || !d) return false;
    c.open = true; d.open = true; d.scrollIntoView({ behavior: TG.reduce ? 'auto' : 'smooth', block: 'center' });
    if (G) G.fromTo(d, { backgroundColor: 'rgba(160,124,53,0.25)' }, { backgroundColor: 'rgba(160,124,53,0)', duration: 1.6, delay: 0.4 }); return true; }

  // ---------- search: a citation opens at its column, anything else filters writers and works ----------
  const out = $('tf-out'), fq = $('tf-q'), CITE = new RegExp(`^(?:${K}\\s*)?(\\d{1,3})\\s*[,:.]\\s*(\\d{1,4})\\s*([A-Da-d])?$`, 'i');
  $('tf-ex').innerHTML = C.examples.map(([r, t]) => `<button type="button" class="chip" data-r="${esc(r)}" title="${esc(t)}">${esc(r)}</button>`).join('') + C.nameExamples.map((n) => `<button type="button" class="chip" data-r="${esc(n)}">${esc(n)}</button>`).join('');
  host.querySelectorAll('#tf-ex .chip').forEach((b) => b.onclick = () => { fq.value = b.dataset.r; run(); });
  function diagram(v, col, li) {
    const left = col % 2 === 1, nums = V.map((x) => x.v), at = nums.indexOf(v), lo = Math.max(0, Math.min(at - 8, nums.length - 17)), sp = 14.5;
    let s = `<svg viewBox="0 0 520 300" role="img" aria-label="${K} ${v}, column ${col}${li >= 0 ? `, letter ${'ABCD'[li]}` : ''}"><g transform="translate(16 40)">`;
    for (let k = lo; k < lo + 17 && k < nums.length; k++) { const vv = V[k], tgt = vv.v === v, h = 120 + ((vv.c1 || 1000) / 1600) * 60;
      s += `<g class="${tgt ? 'cspine' : ''}"><rect x="${(k - lo) * sp}" y="${200 - h}" width="${sp - 2}" height="${h}" rx="1.2" fill="${tgt ? TG.css('--gilt') : vv.idx ? '#2b2724' : TG.css('--leather')}" opacity="${tgt ? 1 : 0.78}"/>${tgt ? `<text x="${(k - lo) * sp + sp / 2 - 1}" y="222" text-anchor="middle" font-size="11" fill="${TG.css('--rubric')}">${v}</text>` : ''}</g>`; }
    s += `<rect x="-6" y="200" width="${17 * sp + 10}" height="7" rx="2" fill="${TG.css('--leather')}"/><text x="${8.5 * sp}" y="244" text-anchor="middle" font-size="11" fill="${TG.css('--muted')}">the volume</text></g>`;
    const px = 300, py = 22, pw = 200, ph = 250, cw = 86, gx = px + pw / 2;
    s += `<g class="cpage"><rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="2" fill="#fbf7ee" stroke="${TG.css('--rule')}"/>`;
    s += `<text x="${px + 14 + cw / 2}" y="${py + 16}" text-anchor="middle" font-size="11" fill="${TG.css('--ink')}">${left ? col : col - 1}</text><text x="${gx + 6 + cw / 2}" y="${py + 16}" text-anchor="middle" font-size="11" fill="${TG.css('--ink')}">${left ? col + 1 : col}</text>`;
    s += `<rect class="ccol" x="${left ? px + 10 : gx + 2}" y="${py + 24}" width="${cw + 4}" height="${ph - 34}" fill="${TG.css('--gilt')}" fill-opacity="0.26"/>`;
    for (let r = 0; r < 26; r++) { const y = py + 30 + r * 8.6; s += `<line x1="${px + 14}" x2="${px + 14 + cw - (r % 6 === 5 ? 26 : 0)}" y1="${y}" y2="${y}" stroke="${TG.css('--ink')}" stroke-opacity="0.35" stroke-width="2.2"/><line x1="${gx + 6}" x2="${gx + 6 + cw - (r % 7 === 6 ? 30 : 0)}" y1="${y}" y2="${y}" stroke="${TG.css('--ink')}" stroke-opacity="0.35" stroke-width="2.2"/>`; }
    'ABCD'.split('').forEach((c, i) => { s += `<text x="${gx}" y="${py + 40 + i * 56}" text-anchor="middle" font-size="11" fill="${TG.css('--rubric')}">${c}</text>`; });
    if (li >= 0) s += `<rect class="cband" x="${left ? px + 10 : gx + 2}" y="${py + 28 + li * 56}" width="${cw + 4}" height="52" fill="none" stroke="${TG.css('--rubric')}" stroke-width="2" rx="2"/>`;
    return `${s}<text x="${px + pw / 2}" y="${py + ph + 22}" text-anchor="middle" font-size="11" fill="${TG.css('--muted')}">the column${li >= 0 ? ' and its letter' : ''}</text></g></svg>`;
  }
  function animateDiagram(li) {
    const svg = out.querySelector('svg'); if (!svg) return;
    if (!G) { const c = svg.querySelector('.cspine'); if (c) c.setAttribute('transform', 'translate(0 -26)'); return; }
    const tl = gsap.timeline(); tl.to(svg.querySelector('.cspine'), { y: -26, duration: 0.6, ease: 'power3.out' })
      .from(svg.querySelector('.cpage'), { opacity: 0, x: -40, scale: 0.9, transformOrigin: '0% 50%', duration: 0.7, ease: 'power3.out' }, '-=0.2')
      .from(svg.querySelector('.ccol'), { scaleY: 0, transformOrigin: '50% 0%', duration: 0.6, ease: 'power2.out' }, '-=0.2');
    if (li >= 0) tl.from(svg.querySelector('.cband'), { y: -li * 56, opacity: 0, duration: 0.6, ease: 'power2.inOut' }, '-=0.1');
    G.from(out.querySelector('.msg'), { opacity: 0, x: -8, duration: 0.5, delay: 0.2 });
  }
  function run(ev) {
    if (ev) ev.preventDefault(); const q = fq.value.trim(), m = q.match(CITE);
    if (m) { const v = +m[1], col = +m[2], L = (m[3] || '').toUpperCase(), li = L ? 'ABCD'.indexOf(L) : -1, left = col % 2 === 1;
      if (!VBY[v]) { out.innerHTML = `<div class="msg">${esc(C.missing(v))}</div>`; return; }
      const inV = Wk.filter((w) => w.v === v && w.c[0]), hit = inV.filter((w) => w.c[0] <= col && col <= (w.c[1] || w.c[0])).sort((a, b) => (a.k === 'a') - (b.k === 'a') || (a.c[1] - a.c[0]) - (b.c[1] - b.c[0]))[0];
      const near = hit || inV.slice().sort((a, b) => Math.abs(a.c[0] - col) - Math.abs(b.c[0] - col))[0];
      if (!near) { out.innerHTML = `<div class="msg">No work in ${K} ${v} is mapped to its columns yet.</div>`; return; }
      out.innerHTML = `<div class="msg"><p>${K} ${v}, column ${col}${L ? `, at ${L}` : ''}. Column ${col} is the ${left ? 'left' : 'right'}-hand column of its page${L ? `, and ${L} marks its ${['first', 'second', 'third', 'last'][li]} quarter` : ''}.</p><p>${hit ? 'It falls in' : 'The nearest work is'} <i>${esc(near.t)}</i>${aname(near) ? `, by ${esc(aname(near))}` : ''} (${wref(near)}).</p><p><a href="${READ(near.s, hit ? col : near.c[0])}" target="_blank" rel="noopener">Open it at column ${hit ? col : near.c[0]}</a></p></div>${diagram(v, col, li)}`;
      animateDiagram(li); return; }
    out.innerHTML = ''; show('author'); drawAuthors(q); if (ev) $('tf-p-author').scrollIntoView({ behavior: TG.reduce ? 'auto' : 'smooth', block: 'start' });
  }
  $('tf-form').addEventListener('submit', run);
  fq.addEventListener('input', () => { if (!fq.value.trim()) { out.innerHTML = ''; drawAuthors(''); } });

  // ---------- by volume ----------
  const shelf = $('tf-shelf'), vpanel = $('tf-vpanel'), maxC = Math.max(...V.map((v) => v.c1 || 0)), [r0, r1] = C.range;
  const tone = (v) => v.idx ? '#2b2724' : `color-mix(in srgb, var(--leather) ${Math.round(18 + 82 * clamp(((v.y0 ?? r0) - r0) / (r1 - r0)))}%, var(--coast))`;
  function openVol(v, btn) { shelf.querySelectorAll('.tf-spine').forEach((s) => s.setAttribute('aria-pressed', 'false')); if (btn) btn.setAttribute('aria-pressed', 'true');
    const ws = Wk.filter((w) => w.v === v.v).sort((a, b) => (a.c[0] || 0) - (b.c[0] || 0)), RX = (y) => 4 + ((y - r0) / (r1 - r0)) * 292;
    const a = RX(Math.max(r0, v.y0 ?? r0)), b = Math.max(a + 2.5, RX(Math.min(r1, v.y1 ?? v.y0 ?? r0)));
    const ticks = C.ticks.map((y) => `<line x1="${RX(y)}" x2="${RX(y)}" y1="9" y2="15" stroke="var(--rule)"/><text x="${RX(y)}" y="27" text-anchor="middle">${y}</text>`).join('');
    const rib = v.y0 && !v.idx ? `<svg class="tf-rib" viewBox="0 0 300 30" aria-label="Writers of ${v.y0}–${v.y1}"><line x1="4" x2="296" y1="12" y2="12" stroke="var(--rule)"/>${ticks}<rect class="span" x="${a}" y="8" width="${b - a}" height="8" rx="1.5" fill="var(--rubric)"/><text x="${Math.min(280, Math.max(20, (a + b) / 2))}" y="5" text-anchor="middle" style="fill:var(--ink)">${v.y0 === v.y1 ? v.y0 : `${v.y0}–${v.y1}`}</text></svg>` : '';
    vpanel.innerHTML = `<h3>${K} ${v.v}</h3><p class="meta">${v.idx ? 'The indexes, 1862–1864 · ' : ''}${ws.length} item${ws.length === 1 ? '' : 's'}${v.c1 ? ` · ${fmt(v.c1)} columns` : ''}${v.top.length ? ` · ${esc(v.top.join(', '))}` : ''}</p>${rib}<ol>${ws.slice(0, 180).map((w) => `<li><a href="${READ(w.s, w.c[0])}" target="_blank" rel="noopener">${esc(w.t)}</a><small>${esc(aname(w))}${aname(w) ? ' · ' : ''}${w.c[0] ? `col. ${w.c[0]}${w.c[1] && w.c[1] !== w.c[0] ? `–${w.c[1]}` : ''}` : ''}${w.k === 'a' ? ' · editors’ matter' : ''}</small></li>`).join('')}</ol>`;
    if (G && btn) { G.from(vpanel.children, { opacity: 0, y: 8, duration: 0.4, stagger: 0.05, ease: 'power2.out', clearProps: 'opacity,transform' }); const s2 = vpanel.querySelector('.tf-rib .span'); if (s2) G.from(s2, { attr: { width: 0 }, duration: 0.8, delay: 0.15, ease: 'power3.out' }); } }
  V.forEach((v) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'tf-spine'; b.setAttribute('aria-pressed', 'false');
    b.style.height = `${86 + 70 * ((v.c1 || maxC * 0.6) / maxC)}px`; b.style.background = tone(v); b.title = `${K} ${v.v}${v.idx ? ' · indexes' : v.y0 ? ` · ${v.y0}–${v.y1}` : ''}${v.top[0] ? ` · ${v.top[0]}` : ''}`;
    b.setAttribute('aria-label', b.title);
    b.innerHTML = `<span${!v.idx && clamp(((v.y0 ?? r0) - r0) / (r1 - r0)) < 0.4 ? ' style="color:var(--ink)"' : ''}>${v.v}</span>`; b.onclick = () => openVol(v, b); shelf.appendChild(b); });
  $('tf-vkey').innerHTML = `${V.length} volumes.${esc(C.vkeyMore || '')}${method('Lighter spines hold earlier writers and darker spines later ones. Taller spines run to more columns.')}`;
  const v0 = VBY[C.firstVol] || V[0]; openVol(v0, shelf.children[V.indexOf(v0)]);

  // ---------- by century: every life a line ----------
  let lifeReady = false;
  $('tf-legend').innerHTML = `${D.fam.filter(([k]) => A.some((a) => a.f === k)).map(([k, n]) => `<span><i style="background:${C.fc(k)}"></i>${esc(n)}</span>`).join('')}<span><i class="r"></i>A general council</span><span id="tf-count"></span>`;
  function lifeInit() { if (lifeReady) return; lifeReady = true;
    const eraBox = $('tf-eras'); let range = C.range.slice();
    C.eras.forEach(([name, a, b], i) => { const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'chip'; btn.textContent = name; btn.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
      btn.onclick = () => { eraBox.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', 'false')); btn.setAttribute('aria-pressed', 'true'); range = [a, b]; layout('move');
        const n = A.filter((x) => x.y0 && x.y1 >= a && x.y0 <= b).length; $('tf-count').textContent = `${fmt(n)} writers, ${a}–${b}`; }; eraBox.appendChild(btn); eraBox.append(' '); });
    const cv = $('tf-life'), ctx = cv.getContext('2d'), tip = $('tf-tip'), lpick = $('tf-lpick');
    let W, H; const M = { l: 12, r: 12, t: 84, b: 40 }; let pitch = 4, hover = null, sel = null, prog = 1, mode = 'snap', start = 0, raf = null;
    const L = A.filter((a) => a.y0 && a.y1).map((a) => ({ a, col: C.fc(a.f) }));
    const X = (y) => M.l + ((y - range[0]) / (range[1] - range[0])) * (W - M.l - M.r);
    function size() { const dpr = devicePixelRatio || 1; W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    function layout(m = 'snap') { const vis = L.filter((l) => l.a.y1 >= range[0] && l.a.y0 <= range[1]).sort((p, q) => p.a.y0 - q.a.y0), ends = [], gap = (range[1] - range[0]) * 0.006;
      vis.forEach((l) => { let r = ends.findIndex((e) => e < l.a.y0 - gap); if (r < 0) { r = ends.length; ends.push(0); } ends[r] = l.a.y1; l.row = r; });
      pitch = Math.max(1.6, Math.min(7, (H - M.t - M.b) / Math.max(1, ends.length))); const base = H - M.b;
      for (const l of L) { const inV = l.a.y1 >= range[0] && l.a.y0 <= range[1]; l.out = !inV;
        l.t0 = X(l.a.y0); l.t1 = X(l.a.y1); l.ty = inV ? base - 4 - l.row * pitch : base - 4;
        l.f0 = m === 'drop' ? l.t0 : (l.x0 ?? l.t0); l.f1 = m === 'drop' ? l.t0 : (l.x1 ?? l.t1); l.fy = m === 'drop' ? l.ty : (l.y ?? l.ty);
        if (m === 'snap' || !G) { l.x0 = l.t0; l.x1 = l.t1; l.y = l.ty; } }
      mode = m; if (m === 'snap' || !G) { prog = 1; draw(); return; } start = performance.now(); prog = 0; hover = null; tip.hidden = true; if (!raf) raf = requestAnimationFrame(tick); }
    function tick(now) { prog = clamp((now - start) / (mode === 'drop' ? 2000 : 950)); const e = mode === 'drop' ? outC : inOut;
      for (const l of L) { const lag = mode === 'drop' ? clamp((l.t0 - M.l) / W) * 0.5 : clamp((l.t0 - M.l) / W) * 0.25, u = e(clamp((prog - lag) / (mode === 'drop' ? 0.5 : 0.75)));
        l.x0 = l.f0 + (l.t0 - l.f0) * u; l.x1 = l.f1 + (l.t1 - l.f1) * u; l.y = l.fy + (l.ty - l.fy) * u; }
      draw(); raf = prog < 1 ? requestAnimationFrame(tick) : null; }
    function draw() { ctx.clearRect(0, 0, W, H); const muted = TG.css('--muted'), rub = TG.css('--rubric'), rule = TG.css('--rule'), base = H - M.b, span = range[1] - range[0];
      ctx.strokeStyle = rule; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(M.l, base + 0.5); ctx.lineTo(W - M.r, base + 0.5); ctx.stroke();
      const step = span > 900 ? 100 : span > 400 ? 50 : 25; ctx.fillStyle = muted; ctx.font = `12px ${TG.css('--body')}`; ctx.textAlign = 'center';
      for (let y = Math.ceil(range[0] / step) * step; y <= range[1]; y += step) ctx.fillText(String(y), X(y), base + 19);
      ctx.lineCap = 'round'; const lw = Math.max(1.1, Math.min(3, pitch * 0.55));
      for (const l of L) { if (l.x1 < -4 || l.x0 > W + 4) continue; const big = l.a.works.length >= 25, alpha = l.out ? 0.5 * (1 - prog) : 1;
        ctx.globalAlpha = (big ? 0.95 : 0.6) * alpha * (l.a.u ? 0.6 : 1); ctx.lineWidth = big ? lw * 1.35 : lw; ctx.strokeStyle = l.col; ctx.setLineDash(l.a.u ? [2, 4] : []); ctx.beginPath(); ctx.moveTo(l.x0, l.y); ctx.lineTo(Math.max(l.x0 + 1, l.x1), l.y); ctx.stroke(); ctx.setLineDash([]); } // dashed: the record gives only a window of dates
      const la = prog < 1 ? clamp((prog - 0.55) / 0.45) : 1; ctx.globalAlpha = 1;
      if (la > 0) { ctx.font = `11.5px ${TG.css('--body')}`; const lanes = [12, 30, 48, 66], lastX = lanes.map(() => -1e9);
        for (const e of ECU) { if (e.y < range[0] || e.y > range[1]) continue; const x = X(e.y), w = ctx.measureText(e.name).width + 10; let lane = 0;
          while (lane < lanes.length - 1 && x - w / 2 < lastX[lane]) lane++; lastX[lane] = x + w / 2;
          ctx.strokeStyle = rub; ctx.lineWidth = 1; ctx.globalAlpha = 0.3 * la; ctx.beginPath(); ctx.moveTo(x + 0.5, lanes[lane] + 6); ctx.lineTo(x + 0.5, base); ctx.stroke();
          ctx.globalAlpha = la; ctx.fillStyle = rub; ctx.save(); ctx.translate(x, lanes[lane] + 10); ctx.rotate(Math.PI / 4); ctx.fillRect(-3.5, -3.5, 7, 7); ctx.restore(); ctx.fillText(e.name, x, lanes[lane] + 2); } }
      ctx.globalAlpha = 1;
      for (const h of [sel, hover]) { if (!h || h.out) continue; ctx.strokeStyle = rub; ctx.lineWidth = Math.max(2.5, pitch * 0.9); ctx.beginPath(); ctx.moveTo(h.x0, h.y); ctx.lineTo(Math.max(h.x0 + 2, h.x1), h.y); ctx.stroke();
        ctx.fillStyle = rub; ctx.font = `600 12px ${TG.css('--body')}`; ctx.textAlign = h.x1 > W - 160 ? 'right' : 'left'; ctx.fillText(h.a.n, h.x1 > W - 160 ? h.x0 - 6 : h.x1 + 6, h.y + 4); } ctx.textAlign = 'center'; }
    function pick(mx, my) { if (prog < 1) return null; let best = null, bd = 1e9; for (const l of L) { if (l.out) continue; const dx = mx < l.x0 ? l.x0 - mx : mx > l.x1 ? mx - l.x1 : 0, d = Math.hypot(dx, (l.y - my) * 1.4); if (d < bd) { bd = d; best = l; } } return bd < Math.max(7, pitch * 1.5) ? best : null; }
    cv.addEventListener('mousemove', (ev) => { const b = cv.getBoundingClientRect(), mx = ev.clientX - b.left, my = ev.clientY - b.top, h = pick(mx, my); if (h === hover) return; hover = h; draw();
      if (!h) { tip.hidden = true; return; } tip.innerHTML = `${esc(h.a.n)}<small>${esc(h.a.d)}${h.a.u ? ' (dates uncertain)' : ''} · ${h.a.works.length} work${h.a.works.length === 1 ? '' : 's'} · ${vr(h.a.vols)}</small>`; tip.hidden = false;
      let left = mx + 14; if (left + tip.offsetWidth > b.width) left = mx - tip.offsetWidth - 14; tip.style.left = `${Math.max(0, left)}px`; tip.style.top = `${Math.max(0, my - 10)}px`; });
    cv.addEventListener('mouseleave', () => { hover = null; tip.hidden = true; draw(); });
    cv.addEventListener('click', (ev) => { const b = cv.getBoundingClientRect(), h = pick(ev.clientX - b.left, ev.clientY - b.top); if (!h) return; sel = h; draw(); const {a} = h;
      lpick.innerHTML = `<b>${esc(a.n)}</b> <small>${esc(a.d)} · ${vr(a.vols)}${a.pl ? ` · ${esc(a.pl)}` : ''}</small><div class="chips">${a.works.slice(0, 8).map((w) => `<a class="chip" href="${READ(w.s, w.c[0])}" target="_blank" rel="noopener">${esc(w.t.length > 48 ? `${w.t.slice(0, 46)}…` : w.t)}</a>`).join('')}${a.works.length > 8 ? `<button type="button" class="chip" data-all>all ${a.works.length} works</button>` : ''}</div>`;
      const all = lpick.querySelector('[data-all]'); if (all) all.onclick = () => openAuthor(a.n);
      if (G) G.from(lpick, { opacity: 0, y: 6, duration: 0.3, ease: 'power2.out', clearProps: 'opacity,transform' }); });
    $('tf-count').textContent = `${fmt(L.length)} dated writers`;
    size(); layout('drop'); let firstRO = true; new ResizeObserver(() => { if (firstRO) { firstRO = false; return; } size(); layout('snap'); }).observe(cv); }

  if (G && window.ScrollTrigger) ScrollTrigger.create({ trigger: host, start: 'top 75%', once: true, onEnter() { fq.value = C.examples[0][0]; run(); } });
  else { fq.value = C.examples[0][0]; run(); }
  const h = (location.hash.match(/^#by-(author|volume|century)$/) || [])[1]; show(h || 'author', true);
  return { openAuthor, show };
};

/* The Latin Fathers guide: the writers as a page of script, the volumes piled by century, the West from Carthage to Clairvaux,
   a column set from the library's text that opens into the reader's rows, a citation finder, and the lifelines. */
(async () => {
  const method = (html) => (window.TFRMethod ? window.TFRMethod.html(html) : html);
  const {TG} = window, D = await TG.load('data'), LAND = await TG.load('land');
  const { esc, fmt, clamp, ease, lerp } = TG, G = TG.hasG && !TG.reduce ? window.gsap : null, NS = 'http://www.w3.org/2000/svg';
  const FAMS = D.fam.map((f) => f[0]), fc = (k) => TG.css(`--f${FAMS.indexOf(k) + 1}`);
  const mk = (tag, at, parent) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); if (parent) parent.appendChild(e); return e; };
  const ROM = (n) => { let s = ''; for (const [v, r] of [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]) while (n >= v) { s += r; n -= v; } return s; };
  const cent = (y) => Math.floor((y - 1) / 100) + 1, ord = (n) => ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth'][n] || `${n}th`;
  const firstWork = {}; D.works.forEach((w) => { if (w[6] !== 'a' && w[3] && !firstWork[w[2]]) firstWork[w[2]] = w; });
  D.authors.forEach((a) => { a.w = []; });
  D.works.forEach((w) => { if (w[5] >= 0 && (w[6] === 'w' || w[6] === 'f')) D.authors[w[5]].w.push([`${w[0]} · ${D.key} ${w[2]}${w[3] ? `:${w[3]}` : ''}`, w[1], 0, w[3]]); });
  D.authors.forEach((a) => a.w.sort((x, y) => x[0].localeCompare(y[0])));
  let explorer = null; const showWriter = (n) => explorer && explorer.show(n);

  /* ---------- hero: the writers as a page of script ---------- */
  const facts = { vols: D.n_vols, works: D.n_works, auth: D.n_auth, cols: D.n_cols };
  document.querySelectorAll('[data-count]').forEach((el) => TG.countUp(el, facts[el.dataset.count], 1.8));
  (function script() {
    const svg = document.querySelector('.script svg'), cap = document.querySelector('.script .cap');
    const defs = mk('defs', {}, svg); defs.innerHTML = `<radialGradient id="tg-vel" cx="45%" cy="40%" r="75%"><stop offset="0" stop-color="#fbf6e9"/><stop offset="1" stop-color="#ead9b5"/></radialGradient>`;
    mk('rect', { class: 'vel', x: 18, y: 12, width: 564, height: 616, rx: 3 }, svg);
    const inc = mk('text', { class: 'incipit', x: 92, y: 44 }, svg); inc.textContent = 'Patrologia Latina · the writers, century by century';
    const A = D.authors.filter((a) => a.fl).sort((a, b) => a.fl - b.fl || a.n.localeCompare(b.n)), byC = {};
    A.forEach((a) => { (byC[Math.max(2, cent(a.fl))] ||= []).push(a); });
    const X0 = 92, X1 = 550, Y0 = 72;
    // lay the strokes out: words are decades, lines are centuries (a long century runs on to the next line)
    let sp = 4.1, gap = 5.5, lines;
    const layout = () => { const L = []; for (const c of Object.keys(byC).map(Number).sort((a, b) => a - b)) {
        let line = { c, first: true, marks: [] }; L.push(line); let x = X0, dec = null;
        for (const a of byC[c]) { const d = Math.floor(a.fl / 10); if (dec !== null && d !== dec) x += gap; dec = d;
          if (x > X1) { line = { c, first: false, marks: [] }; L.push(line); x = X0 + 10; }
          line.marks.push({ a, x }); x += sp; } }
      return L; };
    lines = layout(); while (Y0 + lines.length * 21.5 > 612 && sp > 3) { sp -= 0.15; gap -= 0.2; lines = layout(); }
    const LH = Math.min(32, (606 - Y0) / lines.length), kH = LH / 21;
    const lineEls = lines.map((ln, i) => {
      const base = Y0 + i * LH, g = mk('g', {}, svg);
      mk('line', { class: 'ruling', x1: 84, x2: 556, y1: base + 0.5, y2: base + 0.5 }, g); mk('circle', { class: 'prick', cx: 568, cy: base, r: 0.9 }, g);
      if (ln.first) { const t = mk('text', { class: 'ini', x: 80, y: base + 1, 'text-anchor': 'end', 'font-size': (17 * Math.min(1.3, kH)).toFixed(1) }, g); t.textContent = ROM(ln.c); }
      const cp = mk('clipPath', { id: `tg-ln${i}` }, defs); const cr = mk('rect', { x: 84, y: base - 18 * kH, width: 480, height: 24 * kH }, cp);
      const ink = mk('g', { 'clip-path': `url(#tg-ln${i})` }, g);
      ln.marks.forEach(({ a, x }) => { const h = (a.nw >= 10 ? 13 : a.nw >= 3 ? 9.5 : 6.5) * kH;
        const hit = mk('rect', { class: 'hit', x: x - 2, y: base - 15 * kH, width: sp, height: 19 * kH }, ink); hit.__a = a;
        mk('path', { class: `mk${a.pope ? ' r' : ''}`, d: `M${x.toFixed(1)},${base} V${(base - h).toFixed(1)} M${(x - 1.1).toFixed(1)},${(base - h + 1.8).toFixed(1)} L${(x + 1.3).toFixed(1)},${(base - h).toFixed(1)}` }, ink); });
      return { ln, cr, base, xEnd: ln.marks.length ? ln.marks[ln.marks.length - 1].x + 4 : X0 };
    });
    const quill = mk('circle', { class: 'quill', r: 2.2, cx: X0, cy: Y0, opacity: 0 }, svg);
    const say = (a) => {
      if (a) { cap.dataset.m = ''; cap.textContent = `${a.n}, ${TG.yr(a)}${a.pl ? ` · ${a.pl}` : ''} · ${a.nw} ${a.nw === 1 ? 'work' : 'works'} on the shelf`; }
      else if (cap.dataset.m !== '1') { cap.dataset.m = '1'; cap.innerHTML = method(`Each line is a century. Each word is a decade. Each stroke is a writer. Taller strokes mark writers who wrote more. The popes are written in red. ${fmt(A.length)} writers.`); }
    };
    say(null);
    svg.addEventListener('mousemove', (e) => { const a = e.target.__a; if (a) say(a); });
    svg.addEventListener('mouseleave', () => say(null));
    svg.addEventListener('click', (e) => { const a = e.target.__a; if (a) showWriter(a.n); });
    if (!G) return;
    lineEls.forEach((l) => l.cr.setAttribute('width', 0));
    const tl = TG.intro({ delay: 0.4 });
    tl.from(svg.querySelector('.vel'), { opacity: 0, y: 10, duration: 0.8, ease: 'power2.out' }).from(inc, { opacity: 0, duration: 0.6 }, 0.3);
    let t0 = 0.8;
    lineEls.forEach((l, i) => {
      const dur = 0.12 + 0.3 * ((l.xEnd - X0) / (X1 - X0));
      tl.set(quill, { attr: { cx: X0, cy: l.base - 4 * kH }, opacity: 1 }, t0)
        .to(l.cr, { attr: { width: l.xEnd - 84 + 6 }, duration: dur, ease: 'none' }, t0)
        .to(quill, { attr: { cx: l.xEnd + 2 }, duration: dur, ease: 'none' }, t0);
      if (l.ln.first) tl.add(() => { cap.dataset.m = ''; cap.textContent = `The ${ord(l.ln.c)} century: ${byC[l.ln.c].length} writers`; }, t0);
      t0 += dur + 0.02;
    });
    tl.to(quill, { opacity: 0, duration: 0.3 }, t0).add(() => say(null), t0 + 0.2);
  })();

  /* ---------- 1. the shelf, then the piles ---------- */
  (function shelf() {
    const host = document.getElementById('tg-stage'), svg = host.querySelector('svg'), tip = host.querySelector('.tip'), W = 1000, H = 625;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const V = D.vols, text = V.filter((v) => !v.idx), idx = V.filter((v) => v.idx), maxc = Math.max(...V.map((v) => v.c1 || 0));
    const ramp = d3.interpolateRgbBasis(['#2e6e6a', '#2f4a6b', '#6d4c7d', '#a3382a', '#b8913f']), ccol = (c) => ramp(clamp((c - 2) / 11, 0, 1));
    const LEATHER = ['#5a2e22', '#6b3a28', '#4d2a21', '#61392a'];
    const per = Math.ceil((text.length + idx.length) / 2), sw = (W - 40) / per, base = [292, 592];
    const defs = mk('defs', {}, svg); defs.innerHTML = `<radialGradient id="tg-fire" cx="50%" cy="80%" r="70%"><stop offset="0" stop-color="#ffb347" stop-opacity="0.75"/><stop offset="0.55" stop-color="#e2582a" stop-opacity="0.35"/><stop offset="1" stop-color="#e2582a" stop-opacity="0"/></radialGradient>`;
    const planks = mk('g', {}, svg); base.forEach((b) => mk('rect', { class: 'plank', x: 12, y: b, width: W - 24, height: 9, rx: 2 }, planks));
    const pileG = mk('g', { opacity: 0 }, svg), books = mk('g', {}, svg), fire = mk('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#tg-fire)', opacity: 0, 'pointer-events': 'none' }, svg);
    // piles: one per century, the indexes apart
    const cs = [...new Set(text.map((v) => cent((v.y0 + v.y1) / 2)))].sort((a, b) => a - b), keys = [...cs, 'idx'], pw = (W - 80) / keys.length, px = (k) => 40 + pw * (keys.indexOf(k) + 0.5);
    const stack = {}; const PB = 560, SH = 6.2, SG = 1.3;
    const all = [...text, ...idx];
    const R = all.map((v, i) => {
      const s = i < per ? 0 : 1, k = i < per ? i : i - per, h = 70 + 190 * ((v.c1 || maxc * 0.6) / maxc), c = cent((v.y0 + v.y1) / 2), key = v.idx ? 'idx' : c;
      const n = (stack[key] = (stack[key] || 0) + 1) - 1;
      const A = { x: 20 + k * sw, y: base[s] - h, w: sw - 1.5, h }, B = { x: px(key) - pw * 0.4, y: PB - (n + 1) * (SH + SG), w: pw * 0.8, h: SH };
      const fw = firstWork[v.v], a = mk('a', fw ? { href: TG.read(fw[1], fw[3]), target: '_blank', rel: 'noopener', 'aria-label': `PL ${v.v}` } : {}, books);
      const leather = v.idx ? '#2b2724' : LEATHER[v.v % 4], body = mk('rect', { x: A.x, y: A.y, width: A.w, height: A.h, rx: 1, fill: leather }, a);
      const lab = mk('rect', { x: A.x + 0.8, y: A.y + 12, width: A.w - 1.6, height: 11, fill: v.idx ? '#b8913f' : ccol(c), 'pointer-events': 'none' }, a);
      a.addEventListener('mousemove', (e) => { const b = host.getBoundingClientRect(); tip.innerHTML = v.idx ? `PL ${v.v} · the indexes, 1862–1864<small>${fmt(v.c1)} columns</small>` : `PL ${v.v} · ${v.y0}–${v.y1}<small>${esc(v.top.join(', ') || 'editors’ matter')} · ${fmt(v.c1)} columns</small>`; tip.hidden = false;
        tip.style.left = `${Math.min(e.clientX - b.left + 12, b.width - 220)}px`; tip.style.top = `${e.clientY - b.top + 12}px`; });
      a.addEventListener('mouseleave', () => { tip.hidden = true; });
      return { v, body, lab, A, B, from: leather, to: v.idx ? '#2b2724' : ccol(c), mix: d3.interpolateRgb(leather, v.idx ? '#2b2724' : ccol(c)) };
    });
    keys.forEach((k) => { const t = mk('text', { class: 'pl', x: px(k), y: PB + 22, 'text-anchor': 'middle' }, pileG); t.textContent = k === 'idx' ? 'Index' : ROM(k);
      const n = mk('text', { class: 'pn', x: px(k), y: PB - stack[k] * (SH + SG) - 8, 'text-anchor': 'middle' }, pileG); n.textContent = stack[k]; });
    mk('line', { x1: 30, x2: W - 30, y1: PB + 1, y2: PB + 1, stroke: TG.css('--ink-2') }, pileG);
    const vn = document.getElementById('tg-vn'), vname = document.getElementById('tg-vname'), vnote = document.getElementById('tg-vnote');
    const top = cs.slice().sort((a, b) => stack[b] - stack[a])[0];
    function render(p) {
      const p1 = clamp(p / 0.42, 0, 1), pI = clamp((p - 0.42) / 0.06, 0, 1), pF = clamp((p - 0.46) / 0.1, 0, 1), p2 = clamp((p - 0.58) / 0.4, 0, 1);
      const k = p1 * text.length;
      R.forEach((r, i) => {
        const o = r.v.idx ? pI : clamp(k - i, 0, 1), u = clamp(p2 * 1.6 - (i / R.length) * 0.6, 0, 1);
        // the spine sinks onto its shelf first, then glides to its century's pile: two moves, never both at once (10-10)
        const us = ease(clamp(u * 2, 0, 1)), ug = ease(clamp(u * 2 - 1, 0, 1));
        const h = lerp(r.A.h, r.B.h, us), w = lerp(r.A.w, r.B.w, ug), x = lerp(r.A.x, r.B.x, ug), y = lerp(r.A.y + r.A.h - h + (1 - o) * 26, r.B.y, ug);
        r.body.setAttribute('x', x.toFixed(1)); r.body.setAttribute('y', y.toFixed(1)); r.body.setAttribute('width', w.toFixed(1)); r.body.setAttribute('height', h.toFixed(1));
        r.body.setAttribute('fill', u > 0 ? r.mix(u) : r.from); r.body.style.opacity = p2 > 0 ? 1 : o;
        r.lab.setAttribute('x', (x + 0.8).toFixed(1)); r.lab.setAttribute('y', (y + 12).toFixed(1)); r.lab.setAttribute('width', Math.max(0, w - 1.6).toFixed(1));
        r.lab.style.opacity = (p2 > 0 ? Math.max(0, 1 - u * 3) : 1) * o;
      });
      fire.setAttribute('opacity', (Math.sin(pF * Math.PI) * (0.8 + 0.2 * Math.sin(pF * 40))).toFixed(3));
      planks.style.opacity = 1 - p2 * 1.5; pileG.style.opacity = clamp(p2 * 1.6 - 0.5, 0, 1);
      if (p2 > 0) { vn.textContent = `${V.length}`; vname.textContent = 'Piled by century';
        vnote.textContent = `Each pile holds the volumes whose writers belong to that century. The ${ord(top)} century fills ${stack[top]}. The four volumes of indexes stand apart.`; }
      else if (pF > 0) { vn.textContent = `${V.length}`; vname.textContent = 'February 1868';
        vnote.textContent = 'On the night of 12 to 13 February fire swept the workshop at Montrouge and destroyed the stereotype plates. Later printings were partly reset. Printings of one volume can therefore differ.'; }
      else if (pI > 0) { vn.textContent = `${text.length + Math.round(pI * idx.length)}`; vname.textContent = 'The indexes, 1862–1864'; vnote.textContent = 'Four volumes of indexes to the whole series: authors, subjects and Scripture.'; }
      else { const i = clamp(Math.ceil(k) - 1, 0, text.length - 1), v = text[i]; vn.textContent = Math.round(Math.min(k, text.length));
        vname.textContent = `Volume ${v.v}, ${v.y0}–${v.y1}`; vnote.textContent = v.top.length ? v.top.join(', ') : 'The editors’ matter'; }
    }
    TG.chapter('#tg-shelf', 4000, render, { scrub: 0.5 });
  })();

  /* ---------- 2. the West ---------- */
  (function west() {
    const box = document.getElementById('tg-map'), M = TG.map(box, D.land || LAND, [[-10, 34.5], [20.5, 57.5]], { parallels: [38, 56], phone: [[-7, 36], [18, 56]] });
    const cv = TG.canvas(box.querySelector('canvas')), {ctx} = cv;
    const A = D.authors.filter((a) => a.pl && a.fl && D.places[a.pl]), places = {};
    A.forEach((a) => { (places[a.pl] ||= { k: a.pl, ll: D.places[a.pl], f: a.f, ys: [] }).ys.push(a.fl); });
    const LBL = new Set(D.label), ribbon = document.getElementById('tg-ribbon');
    const chron = TG.chronicle(document.getElementById('tg-chron'), D.events, ([y, e, w]) => `<li><span class="d">${y}</span><span class="e">${esc(e)}</span><span class="w">${esc(w)}</span></li>`);
    document.getElementById('tg-legend').innerHTML = D.fam.filter(([k]) => k !== 'none' && A.some((a) => a.f === k)).map(([k, nm]) => `<span><i style="background:${fc(k)};border-radius:50%"></i>${esc(nm)}</span>`).join('');
    let year = 150, last = '';
    function render(Y) {
      year = Y; ctx.clearRect(0, 0, cv.W, cv.H); const gold = TG.css('--gilt'), ink = TG.css('--ink');
      const ps = Object.values(places).map((p) => ({ p, n: p.ys.filter((y) => y <= Y).length, fresh: p.ys.some((y) => y <= Y && Y - y < 30) })).filter((x) => x.n).sort((a, b) => b.n - a.n);
      for (const { p, n, fresh } of ps) { const [x, y] = M.xy(p.ll), r = 2.4 + Math.sqrt(n) * 2.3;
        if (fresh) { ctx.globalAlpha = 0.3; ctx.fillStyle = gold; ctx.beginPath(); ctx.arc(x, y, r + 7, 0, 6.283); ctx.fill(); }
        ctx.globalAlpha = fresh ? 0.95 : 0.6; ctx.fillStyle = fc(p.f); ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
        ctx.globalAlpha = 1; ctx.strokeStyle = TG.css('--card'); ctx.lineWidth = 1; ctx.stroke(); }
      ctx.font = `italic 12.5px ${TG.css('--display')}`; ctx.fillStyle = ink; const boxes = [];
      for (const { p, n } of ps) { if (!LBL.has(p.k)) continue; const [x, y] = M.xy(p.ll), r = 2.4 + Math.sqrt(n) * 2.3, w = ctx.measureText(p.k).width;
        let lx = x + r + 4, ly = y + 4; const hit = (bx, by) => boxes.some((b) => bx < b[0] + b[2] && bx + w > b[0] && by - 11 < b[1] + 3 && by + 3 > b[1] - 11);
        if (hit(lx, ly)) lx = x - r - 4 - w; if (hit(lx, ly)) { lx = x - w / 2; ly = y - r - 5; } if (hit(lx, ly)) continue;
        boxes.push([lx, ly, w]); ctx.globalAlpha = 0.9; ctx.fillText(p.k, lx, ly); }
      ctx.globalAlpha = 1;
      document.getElementById('tg-year').textContent = Math.round(Y);
      document.getElementById('tg-yearbar').style.width = `${((Y - 150) / 1110) * 100}%`;
      chron(Y);
      const now = D.authors.filter((a) => a.fl && Math.abs(a.fl - Y) <= 18).sort((a, b) => b.nw - a.nw).slice(0, 10), key = now.map((a) => a.n).join('|');
      if (key !== last) { last = key; ribbon.innerHTML = now.map((a) => `<span><i style="background:${fc(a.f)}"></i>${esc(a.n)}</span>`).join('') || '<span class="small" style="border:0;background:none">No writer on the shelf flourished in these years.</span>'; }
    }
    M.onfit = () => { cv.size(); render(year); };
    TG.chapter('#tg-west', 4400, (p) => render(lerp(150, 1260, p)), { scrub: 0.4 });
  })();

  /* ---------- 3. from a column to a page ---------- */
  (function column() {
    const O = D.open, page = document.getElementById('tg-mpage'), rowsEl = document.getElementById('tg-lrows'), stepsEl = document.getElementById('tg-steps');
    const words = (s) => s.split(/\s+/);
    const cut = (s, a, b) => words(s).slice(a, b).join(' ');
    const ch = Object.fromEntries(O.ch.map((c) => [c.ms, c.rows]));
    const II = ch['227C'], III = ch['228B'], IV = ch['228C'], IVb = ch['228D'];
    const t1 = words(O.tail1), half = Math.floor(t1.length / 2), body2 = II[2].la, b2 = words(body2).length, third = Math.ceil(b2 / 3);
    const Q = {
      '227A': `… ${cut(O.tail1, 1, half)}`, '227B': cut(O.tail1, half, t1.length),
      '227C': `<span class="cap">CAPUT II.</span><span class="sum">${esc(II[1].la)}</span> ${esc(cut(body2, 0, third))}`,
      '227D': esc(cut(body2, third, third * 2)), '228A': esc(cut(body2, third * 2, b2)),
      '228B': `<span class="cap">CAPUT III.</span><span class="sum">${esc(III[1].la)}</span> ${esc(III[2] ? III[2].la : '')}`,
      '228C': `<span class="cap">CAPUT IV.</span><span class="sum">${esc(IV[1].la)}</span>`,
      '228D': esc(IVb[0].la),
    };
    const colHTML = (c) => `<div class="mcol">${'ABCD'.split('').map((q) => `<div class="qbox" lang="la" data-q="${c}${q}">${['227A', '227B'].includes(c + q) ? esc(Q[c + q]) : Q[c + q]}</div>`).join('')}</div>`;
    page.innerHTML = `<div class="mhead"><span class="cn">${O.cols[0]}</span><span class="t">PROSLOGION</span><span class="cn r">${O.cols[1]}</span></div>
      <div class="mcols">${colHTML(O.cols[0])}<div class="gut2">${'ABCD'.split('').map((q) => `<span data-l="${q}">${q}</span>`).join('')}</div>${colHTML(O.cols[1])}</div>
      <p class="mnote">Set in type from PL 158. The columns and letters are Migne’s. The line breaks are not.</p>`;
    const qb = Object.fromEntries([...page.querySelectorAll('.qbox')].map((e) => [e.dataset.q, e])), letters = [...page.querySelectorAll('.gut2 span')], cn = [...page.querySelectorAll('.mhead .cn')];
    const ROWS = [
      ['227C', 'Chapter II', `${II[0].la} ${II[1].la}`, `${II[0].en} ${II[1].en}`],
      ['227C', 'to 228A', II[2].la, II[2].en],
      ['228B', 'Chapter III', `${III[1].la} ${III[2] ? III[2].la : ''}`, `${III[1].en} ${III[2] ? III[2].en : ''}`],
      ['228C', 'Chapter IV', IV[1].la, IV[1].en],
      ['228D', '', IVb[0].la, IVb[0].en],
    ];
    rowsEl.innerHTML = `${ROWS.map(([r, lab, la, en]) => `<div class="lrow" data-src="${r}"><div class="ref">PL 158:${r}<small>${esc(lab)}</small></div><div class="la"><span class="lane">Latin</span>${esc(la)}</div><div class="en"><span class="lane">English</span>${esc(en)}</div></div>`).join('')
       }<a class="open" href="${TG.read(O.slug, O.cols[0])}" target="_blank" rel="noopener">Read the Proslogion from column ${O.cols[0]}</a>`;
    const rows = [...rowsEl.querySelectorAll('.lrow')];
    const STEPS = [
      ['Two columns to a page', 'Migne numbers columns rather than pages. This opening is columns 227 and 228 of volume 158.'],
      ['Letters in the gutter', 'Between the columns the letters A to D divide each column into quarters.'],
      ['Where a chapter begins', 'Chapter two begins at 227C. Chapter three begins at 228B and chapter four at 228C. A reference names the column and the letter. It holds in any printing.'],
      ['Into the library', 'In the reader the columns open into rows. Each row sets the Latin beside its English and keeps its place in Migne.'],
      ['Read it', `<a href="${TG.read(O.slug, O.cols[0])}" target="_blank" rel="noopener">Anselm’s Proslogion at PL 158:227C</a> in Latin and English.`],
    ];
    stepsEl.innerHTML = STEPS.map(([b, p]) => `<li><b>${esc(b)}</b><p>${p}</p></li>`).join('');
    const lis = [...stepsEl.children]; let cur = -1, lt = null;
    const allQ = Object.values(qb);
    function step(i, instant) {
      if (i === cur) return; const prev = cur; cur = i;
      lis.forEach((li, j) => li.classList.toggle('now', j === i));
      cn.forEach((c) => { c.style.color = i === 0 ? TG.css('--rubric') : ''; });
      if (G && i === 0 && !instant) gsap.fromTo(cn, { scale: 1 }, { scale: 1.35, yoyo: true, repeat: 1, duration: 0.35, transformOrigin: '50% 60%' });
      if (lt) { lt.kill(); lt = null; }
      letters.forEach((l) => l.classList.remove('on')); allQ.forEach((q) => q.classList.remove('on'));
      if (i === 1) { letters.forEach((l) => l.classList.add('on'));
        if (G && !instant) { lt = gsap.timeline({ repeat: -1 }); 'ABCD'.split('').forEach((L) => lt.add(() => { allQ.forEach((q) => q.classList.toggle('on', q.dataset.q.endsWith(L))); }).to({}, { duration: 0.7 })); } }
      if (i === 2) ['227C', '228B', '228C'].forEach((k) => qb[k].classList.add('on'));
      const lib = i >= 3;
      rowsEl.classList.toggle('on', lib);
      if (G && !instant) {
        if (lib && prev < 3) {
          gsap.set(rowsEl, { opacity: 1 });
          rows.forEach((r, j) => { const src = qb[r.dataset.src].getBoundingClientRect(), dst = r.getBoundingClientRect();
            gsap.fromTo(r, { x: src.left - dst.left, y: src.top - dst.top, scaleX: src.width / dst.width, scaleY: src.height / dst.height, transformOrigin: '0 0', opacity: 0.2 },
              { x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1, duration: 1.0, ease: 'expo.inOut', delay: j * 0.08 }); });
          gsap.to(page, { opacity: 0.1, scale: 0.96, duration: 0.8, ease: 'power2.inOut' });
        }
        if (!lib && prev >= 3) { gsap.to(rowsEl, { opacity: 0, duration: 0.3 }); gsap.to(page, { opacity: 1, scale: 1, duration: 0.5 }); }
      } else if (TG.plays()) { rowsEl.style.opacity = lib ? 1 : 0; page.style.opacity = lib ? 0.1 : 1; }
    }
    const st = TG.chapter('#tg-col', 3000, (p, fin) => { if (fin) { lis.forEach((li) => li.classList.add('now')); ['227C', '228B', '228C'].forEach((k) => qb[k].classList.add('on')); letters.forEach((l) => l.classList.add('on')); return; } step(Math.min(STEPS.length - 1, Math.floor(p * STEPS.length)), false); }, { scrub: true });
    if (!st) rowsEl.style.opacity = 1;
  })();

  /* ---------- 4. find: the selection tools of the Migne shelves ---------- */
  explorer = TGFinder(document.getElementById('tg-find-host'), D, { key: 'PL', range: [100, 1260], ticks: [400, 700, 1000], firstVol: 158, ecu: D.ecu, fc, placeholder: 'A writer, a work, or a reference like PL 158:227C',
    examples: [['PL 158:227C', 'Anselm, Proslogion'], ['PL 32:659', 'Augustine, Confessions'], ['PL 41:14', 'Augustine, The City of God'], ['PL 95:21', 'Bede, Ecclesiastical History'], ['PL 82:73', 'Isidore, Etymologies'], ['PL 75:509', 'Gregory the Great, Moralia on Job']],
    nameExamples: ['Ambrose', 'Bede', 'Rule of'], missing: (v) => (v === 37 ? 'PL 37 is not in the library yet.' : `PL ${v} is not on the shelf. The Patrologia Latina has 221 volumes.`),
    volintro: 'The volumes stand as Migne printed them. The four index volumes come at the end. Choose one to see the years of its main writers and what it holds. Each work is listed with the column where it begins.',
    vkeyMore: ' Volume 37 is not yet in the library.',
    centintro: 'Each dated writer is a line from birth to death. Its color is his region. The lines are stacked so that none overlap. The red marks are the general councils. Choose a period and then a line.',
    eras: [['All', 100, 1260], ['Before Nicaea', 100, 330], ['The age of Augustine', 300, 470], ['Gregory the Great to Bede', 450, 740], ['Carolingians', 730, 900], ['Reform and the schools', 1000, 1260]] });
  explorer.show = (n) => explorer.openAuthor(n);
  TG.reveal('.tg .reveal');
})();
