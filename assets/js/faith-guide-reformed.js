/* The Continental Reformed shelf guide: Ramus's braces, the Institutes growing, the Reformed International, the confessions dealt,
   Polanus's tree, the stream of generations. */
(async () => {
  const {TG} = window, D = await TG.load('data'), LAND = await TG.load('land');
  const { esc, fmt, clamp, ease, lerp } = TG, G = TG.hasG && !TG.reduce ? window.gsap : null;
  const FAMS = D.fam.map((f) => f[0]), fc = (k) => TG.css(`--f${FAMS.indexOf(k) + 1}`), famName = (k) => (D.fam.find((f) => f[0] === k) || [])[1];
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, at, parent) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); if (parent) parent.appendChild(e); return e; };
  const brace = (x, y1, y2, w = 14) => { // a curly brace opening to the right, its point at (x, middle)
    if (y2 - y1 < 6) return `M${x},${(y1 + y2) / 2} L${x + w},${(y1 + y2) / 2}`;
    const m = (y1 + y2) / 2, r = Math.min(9, (y2 - y1) / 4), h = x + w / 2;
    return `M${x + w},${y1} Q${h},${y1} ${h},${y1 + r} L${h},${m - r} Q${h},${m} ${x},${m} Q${h},${m} ${h},${m + r} L${h},${y2 - r} Q${h},${y2} ${x + w},${y2}`; };
  const drawIn = (el) => { const L = el.getTotalLength(); el.style.strokeDasharray = L; el.style.strokeDashoffset = L; return el; };
  let explorer = null;
  const facts = { works: D.n_works, authors: D.authors.length, pages: D.n_pages, conf: D.conf.length };
  document.querySelectorAll('[data-count]').forEach((el) => TG.countUp(el, facts[el.dataset.count], 1.8));

  /* ---------- hero: the shelf divided in Ramus's manner ---------- */
  (function hero() {
    const svg = document.querySelector('.brace svg'), cap = document.querySelector('.brace .cap');
    const regs = D.fam.map(([k, n]) => { const A = D.authors.filter((a) => a.f === k); return { k, n, A, top: A.slice().sort((a, b) => b.p - a.p).slice(0, 3), p: A.reduce((t, a) => t + a.p, 0) }; }).filter((r) => r.A.length);
    const leaves = regs.flatMap((r) => r.top.map((a) => ({ a, r }))), H = 600, top = 26, step = (H - 2 * top) / (leaves.length - 1 + (regs.length - 1) * 0.55);
    let y = top; regs.forEach((r, i) => { if (i) y += step * 0.55; r.ys = r.top.map(() => { const v = y; y += step; return v; }); y -= step; y += step; r.y = (r.ys[0] + r.ys[r.ys.length - 1]) / 2; });
    const midY = (regs[0].y + regs[regs.length - 1].y) / 2;
    const g0 = mk('g', {}, svg);
    const rootT = mk('text', { x: 0, y: midY - 4, class: 'root' }, g0); rootT.textContent = 'The shelf';
    const rootS = mk('text', { x: 1, y: midY + 16, class: 'root2' }, g0); rootS.textContent = `${fmt(D.n_works)} works`;
    const b1 = mk('path', { class: 'br', d: brace(140, regs[0].y, regs[regs.length - 1].y, 16) }, svg);
    const regEls = regs.map((r) => { const g = mk('g', {}, svg); const t = mk('text', { x: 162, y: r.y - 2, class: 'reg', fill: fc(r.k) }, g); t.textContent = r.n;
      const s = mk('text', { x: 163, y: r.y + 14, class: 'regn' }, g); s.textContent = `${r.A.length} ${r.A.length === 1 ? 'writer' : 'writers'} · ${fmt(r.p)} pp.`; return g; });
    const b2 = regs.map((r) => mk('path', { class: 'br', d: brace(352, r.ys[0] - 4, r.ys[r.ys.length - 1] + 4, 12) }, svg));
    const leafEls = []; regs.forEach((r) => r.top.forEach((a, i) => { const g = mk('g', {}, svg);
      const t = mk('text', { x: 372, y: r.ys[i] + 4, class: 'leaf', tabindex: 0, role: 'button' }, g); t.textContent = a.n;
      const pw = mk('text', { x: 638, y: r.ys[i] + 4, class: 'lp', 'text-anchor': 'end' }, g); pw.textContent = `${fmt(a.p)} pp.`;
      const show = () => { cap.textContent = `${a.full || a.n}, ${a.d || TG.yr(a)} · ${a.w.length} works on the shelf`; };
      t.addEventListener('mouseenter', show); t.addEventListener('focus', show);
      t.addEventListener('click', () => explorer && explorer.show(a.n)); t.addEventListener('keydown', (e) => { if (e.key === 'Enter') explorer && explorer.show(a.n); });
      leafEls.push(g); }));
    cap.textContent = 'The shelf divided as Ramus divided a subject: first by where its writers taught and then by the three with the most pages in each.';
    if (!G) return;
    const tl = TG.intro({ delay: 0.3 });
    tl.from([rootT, rootS], { opacity: 0, x: -14, duration: 0.7, ease: 'power2.out', stagger: 0.1 })
      .to(drawIn(b1), { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut' }, '-=0.2')
      .from(regEls, { opacity: 0, x: -12, duration: 0.55, ease: 'power2.out', stagger: 0.09 }, '-=0.35')
      .to(b2.map(drawIn), { strokeDashoffset: 0, duration: 0.6, ease: 'power2.inOut', stagger: 0.09 }, '-=0.3')
      .from(leafEls, { opacity: 0, x: -10, duration: 0.45, ease: 'power2.out', stagger: 0.04 }, '-=0.45');
  })();

  /* ---------- 1. what is on the shelf: every work along the years, then sorted by kind into a printer's type case ---------- */
  (function kinds() {
    const K = D.kinds, host = document.getElementById('tg-case2'), tip = host.querySelector('.tip'), pickEl = document.getElementById('tg-case2-pick'), list = document.getElementById('tg-kind-list');
    const FI = Object.fromEntries(D.fam.map(([k], i) => [k, i + 1])), col = (f) => `var(--f${FI[f] || 1})`;
    const by = Object.fromEntries(K.order.map((k) => [k, K.works.filter((w) => w[6] === k)]));
    const order = K.order.filter((k) => by[k].length);
    list.innerHTML = order.map((k) => `<li data-k="${k}"><b>${esc(K.names[k])}</b><span>${by[k].length} works · ${fmt(by[k].reduce((t, w) => t + w[2], 0))} pp.</span><p>${esc(K.say[k] || '')}</p></li>`).join('');
    const lis = [...list.children];
    const sorts = K.works.map((w, i) => { const d = document.createElement('a'); d.className = 'sort'; d.href = TG.read(w[1]); d.target = '_blank'; d.rel = 'noopener'; d.style.background = col(w[5]);
      d.setAttribute('aria-label', `${w[0]}, ${w[3]}`); d.dataset.i = i; host.appendChild(d); return d; });
    // the work a compartment is shown by (10-16: Voetius's Select Disputations, Cocceius's commentaries): its squares are outlined in gilt
    const FEAT = new Set(Object.values(K.feature || {}).flatMap((f) => f.slugs));
    sorts.forEach((d, i) => { if (FEAT.has(K.works[i][1])) d.classList.add('feat'); });
    const axis = document.createElement('div'); axis.className = 'axis'; host.appendChild(axis);
    const note = document.createElement('p'); note.className = 'note'; host.appendChild(note);
    let comps = [], labs = [], years = [], L = null, cur = -1, picked = null;
    function layout() {
      const W = host.clientWidth, H = host.clientHeight, narrow = W < 640, tw = narrow ? 6 : 8, th = narrow ? 8 : 10, gx = 2, gy = 2;
      const Y0 = 1500, Y1 = 1800, base = Math.round(H * (narrow ? 0.2 : 0.36)), sx = (y) => 14 + (Math.max(Y0, Math.min(Y1, y)) - Y0) / (Y1 - Y0) * (W - 28 - tw);
      const stack = {}, A = K.works.map((w) => { const b = Math.floor((w[4] - Y0) / 4); const n = (stack[b] = (stack[b] || 0) + 1) - 1; return { x: sx(Y0 + b * 4), y: base - (n + 1) * (th + gy) }; });
      const per = narrow ? 3 : order.length, rows = Math.ceil(order.length / per), gap = narrow ? 8 : 10, cw = (W - 20 - (per - 1) * gap) / per;
      const lab = narrow ? 50 : 72, cTop = base + 30, cH = (H - cTop - lab - (rows - 1) * (lab + 6)) / rows, B = new Array(K.works.length), boxes = {}; // room under each compartment for its name
      order.forEach((k, i) => { const r = Math.floor(i / per), c = i % per, x = 10 + c * (cw + gap), y = cTop + r * (cH + lab + 6), cols = Math.max(1, Math.floor((cw - 6) / (tw + gx)));
        boxes[k] = { x, y, w: cw, h: cH };
        by[k].forEach((w, j) => { const idx = K.works.indexOf(w), cc = j % cols, rr = Math.floor(j / cols); B[idx] = { x: x + 4 + cc * (tw + gx), y: y + cH - 4 - (rr + 1) * (th + gy) }; }); });
      return { W, H, tw, th, A, B, boxes, base, sx, Y0, Y1 };
    }
    function frame() {
      L = layout(); comps.forEach((c) => c.remove()); labs.forEach((c) => c.remove()); years.forEach((c) => c.remove()); comps = []; labs = []; years = [];
      sorts.forEach((s) => { s.style.width = `${L.tw}px`; s.style.height = `${L.th}px`; });
      axis.style.top = `${L.base}px`;
      for (let y = 1525; y <= 1775; y += 50) { const t = document.createElement('span'); t.className = 'yr'; t.style.left = `${L.sx(y)}px`; t.style.top = `${L.base + 4}px`; t.textContent = y; host.appendChild(t); years.push(t); }
      order.forEach((k) => { const b = L.boxes[k], c = document.createElement('div'); c.className = 'comp'; Object.assign(c.style, { left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px` }); c.dataset.k = k;
        c.onclick = () => pick(k); host.insertBefore(c, host.firstChild); comps.push(c);
        const l = document.createElement('div'); l.className = 'clab'; Object.assign(l.style, { left: `${b.x}px`, top: `${b.y + b.h + 4}px`, width: `${b.w}px` }); l.innerHTML = `<b>0</b>${esc(K.names[k])}`; host.appendChild(l); labs.push(l); });
    }
    function pick(k, quiet) {
      if (!quiet) picked = k; comps.forEach((c) => c.classList.toggle('on', !quiet && c.dataset.k === k));
      // a work in several volumes is one row, its pages added (10-16: Voetius's five volumes of Disputations, Cocceius's commentaries in
      // six volumes of his Works stood as separate rows, or below the first eight)
      const groups = new Map(); by[k].forEach((w) => { const key = `${w[7] || w[0]}|${w[3]}`; const g = groups.get(key) || { t: w[7] || w[0], s: w[1], a: w[3], p: 0, n: 0 };
        g.p += w[2]; g.n += 1; groups.set(key, g); });
      const f = (K.feature || {})[k], fw = f ? by[k].filter((w) => f.slugs.includes(w[1])) : [];
      const ws = [...groups.values()].filter((g) => !(f && g.a === f.a && fw.some((w) => w[1] === g.s))).sort((a, b) => b.p - a.p);
      const card = f && fw.length ? `<p class="feat-card"><a href="${TG.read(f.slugs[0])}" target="_blank" rel="noopener"><b>${esc(f.t)}</b></a><small>${esc(f.a)} · ${fw.length} volumes · ${fmt(fw.reduce((t, w) => t + w[2], 0))} pp.</small><span>${esc(f.note)}</span></p>` : '';
      pickEl.innerHTML = `<h3>${esc(K.names[k])}</h3><p class="small" style="margin:0 0 6px">${esc(K.say[k] || '')} The largest first.</p>${card}<ul class="wlist">${ws.slice(0, 8).map((g) => `<li><a href="${TG.read(g.s)}" target="_blank" rel="noopener">${esc(g.t)}${g.n > 1 && !/vols\./.test(g.t) ? ` (${g.n} volumes)` : ''}</a><small>${esc(g.a)} · ${fmt(g.p)} pp.</small></li>`).join('')}</ul>${ws.length > 8 ? `<p class="small">and ${ws.length - 8} more in the finder below.</p>` : ''}`;
      if (G && !quiet) gsap.from(pickEl.querySelectorAll('.wlist li'), { opacity: 0, y: 6, duration: 0.3, stagger: 0.02 });
    }
    // the list under the case fills at the end of the scene, after the pin has measured the scene; without its room kept from the start
    // it ran into the next scene's heading (10-11). Each kind's list is set once, unseen, and the tallest height is kept.
    function reserve() {
      const keep = picked, html = pickEl.innerHTML; pickEl.style.minHeight = ''; pickEl.style.visibility = 'hidden'; let h = 0;
      order.forEach((k) => { pick(k, true); h = Math.max(h, pickEl.offsetHeight); });
      pickEl.style.minHeight = `${h}px`; pickEl.style.visibility = '';
      if (keep) pick(keep, true); else pickEl.innerHTML = html;
      picked = keep; comps.forEach((c) => c.classList.toggle('on', !!keep && c.dataset.k === keep));
    }
    lis.forEach((li) => { li.onclick = () => pick(li.dataset.k); });
    host.addEventListener('mousemove', (e) => { const s = e.target.closest('.sort'); if (!s) { tip.hidden = true; return; } const w = K.works[+s.dataset.i], b = host.getBoundingClientRect();
      tip.innerHTML = `${esc(w[0])}<small>${esc(w[3])} · ${esc(K.names[w[6]])} · ${fmt(w[2])} pp.</small>`; tip.hidden = false;
      tip.style.left = `${Math.min(e.clientX - b.left + 12, b.width - 240)}px`; tip.style.top = `${Math.min(e.clientY - b.top + 12, b.height - 60)}px`; });
    host.addEventListener('mouseleave', () => { tip.hidden = true; });
    function render(p) {
      const pA = clamp(p / 0.14, 0, 1), pB = clamp((p - 0.18) / 0.72, 0, 1), n = order.length, kNow = Math.min(n - 1, Math.floor(pB * n));
      const counts = Object.fromEntries(order.map((k) => [k, 0]));
      K.works.forEach((w, i) => {
        const a = L.A[i], b = L.B[i], appear = clamp(pA * 1.4 - (i / K.works.length) * 0.4, 0, 1), ki = order.indexOf(w[6]);
        const local = clamp((pB * n - ki) * 1.15 - (by[w[6]].indexOf(w) / by[w[6]].length) * 0.15, 0, 1), u = ease(local);
        if (local >= 1) counts[w[6]]++;
        const x = lerp(a.x, b.x, u), y = lerp(a.y, b.y, u) - Math.sin(Math.PI * u) * 40; // each sort is lifted, carried and dropped
        sorts[i].style.transform = `translate(${x.toFixed(1)}px, ${(y - (1 - appear) * 24).toFixed(1)}px)`; sorts[i].style.opacity = appear;
      });
      // MereO (2026-10-12): a compartment shows its count once its kind is being sorted, never a 0 while the list already names it
      labs.forEach((l, i) => { l.firstChild.textContent = pB > 0 && i <= kNow ? by[order[i]].length : ''; });
      const showC = clamp((p - 0.12) / 0.06, 0, 1); comps.forEach((c) => { c.style.opacity = showC; }); labs.forEach((l) => { l.style.opacity = showC; });
      axis.style.opacity = years[0] ? 1 - clamp((pB - 0.6) / 0.3, 0, 1) * 0.6 : 1; years.forEach((y) => { y.style.opacity = axis.style.opacity; });
      note.textContent = pB <= 0 ? 'Each work stands at the years its writer was at work.' : pB < 1 ? `Sorting: ${K.names[order[kNow]]}` : 'Choose a compartment to see what it holds.';
      const now = pB <= 0 ? -1 : kNow; if (now !== cur) { cur = now; lis.forEach((li, i) => { li.classList.toggle('now', i === now); li.classList.toggle('past', i < now); }); }
      if (p >= 0.999 && !picked) pick(order[0]);
    }
    // MereO (2026-10-12): the list of the chosen kind's works stands after the pinned scene, not inside it. Its reserved room made the
    // scene taller than the window, so the pin hid the scene's top. It now follows the scene in the page.
    { const sec = document.getElementById('tg-kinds'), after = document.createElement('div'); after.className = 'wrap gut tg-case2-after';
      if (sec && sec.parentNode) { sec.parentNode.insertBefore(after, sec.nextSibling); after.appendChild(pickEl); } }
    frame(); reserve(); pick(order[0], true); let lastP = 0; // the list after the scene is never an empty band
    let rw = pickEl.offsetWidth; new ResizeObserver(() => { if (Math.abs(pickEl.offsetWidth - rw) > 20) { rw = pickEl.offsetWidth; reserve(); } }).observe(pickEl);
    const st = TG.chapter('#tg-kinds', 3600, (p, fin) => { lastP = fin ? 1 : p; render(lastP); }, { scrub: 0.5 });
    if (!st) lis.forEach((li) => li.classList.add('now'));
    let rt; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { frame(); render(lastP); }, 150); }).observe(host);
  })();

  /* ---------- 2. the stream of generations ---------- */
  (function stream() {
    const host = document.getElementById('tg-stream'), svg = d3.select(host.querySelector('svg')), tip = host.querySelector('.tip');
    const Y0 = 1480, Y1 = 1790, BIN = 5, bins = d3.range(Y0, Y1 + 1, BIN);
    const active = (a) => { const coll = /^The |Synod|theses/.test(a.n) || /^fl\./.test(a.d || ''); return [coll ? a.y0 : Math.min(a.y0 + 24, a.y1), a.y1]; };
    const rows = bins.map((y) => { const r = { y }; FAMS.forEach((k) => { r[k] = 0; }); D.authors.forEach((a) => { const [s, e] = active(a); if (s <= y + BIN / 2 && e >= y - BIN / 2) r[a.f] += 1; }); return r; });
    const names = (y, k) => D.authors.filter((a) => { const [s, e] = active(a); return a.f === k && s <= y && e >= y; }).map((a) => a.n);
    const series = d3.stack().keys(FAMS).offset(d3.stackOffsetWiggle).order(d3.stackOrderInsideOut)(rows);
    document.getElementById('tg-stream-legend').innerHTML = D.fam.map(([k, n]) => `<span><i style="background:${fc(k)}"></i>${esc(n)}</span>`).join('');
    const EV = [[1536, 'Institutes'], [1559, 'Geneva Academy'], [1563, 'Heidelberg Catechism'], [1575, 'Leiden'], [1618, 'Dort'], [1634, 'Amyraut'], [1648, 'Cocceius on the covenant'], [1675, 'Formula Consensus'], [1685, 'the Revocation']];
    const PER = [[1517, 1565, 'Reformation'], [1565, 1640, 'Early orthodoxy'], [1640, 1725, 'High orthodoxy'], [1725, 1790, 'Late orthodoxy']];
    let W = 0, reveal = null, nowT = null, nowL = null, evs = [], sx;
    function build() {
      W = host.clientWidth; const H = svg.node().clientHeight, top = 52, bot = H - 54;
      sx = d3.scaleLinear([Y0, Y1], [0, W]); const ext = [d3.min(series, (s) => d3.min(s, (d) => d[0])), d3.max(series, (s) => d3.max(s, (d) => d[1]))];
      const sy = d3.scaleLinear(ext, [bot, top]);
      svg.attr('viewBox', `0 0 ${W} ${H}`).selectAll('*').remove();
      const defs = svg.append('defs'); const clip = defs.append('clipPath').attr('id', 'tg-ref-clip'); reveal = clip.append('rect').attr('x', 0).attr('y', 0).attr('height', H).attr('width', 0);
      const per = svg.append('g').attr('class', 'per');
      PER.forEach(([a, b, n], i) => { per.append('rect').attr('x', sx(a)).attr('y', bot + 22).attr('width', sx(b) - sx(a) - 2).attr('height', 3).attr('opacity', i % 2 ? 0.6 : 1);
        per.append('text').attr('x', sx(a) + 2).attr('y', bot + 40).text(W < 600 ? ['Reform.', 'Early', 'High', 'Late'][i] : n); });
      const ax = svg.append('g').attr('class', 'ax');
      for (let y = 1500; y <= 1775; y += 25) { ax.append('line').attr('x1', sx(y)).attr('x2', sx(y)).attr('y1', top - 8).attr('y2', bot + 6).attr('stroke', TG.css('--rule-2')); ax.append('text').attr('x', sx(y)).attr('y', bot + 17).attr('text-anchor', 'middle').text(y); }
      const area = d3.area().x((d) => sx(d.data.y)).y0((d) => sy(d[0])).y1((d) => sy(d[1])).curve(d3.curveBasis);
      const g = svg.append('g').attr('clip-path', 'url(#tg-ref-clip)');
      g.selectAll('path.s').data(series).join('path').attr('class', 's').attr('d', area).attr('fill', (s) => fc(s.key)).attr('opacity', 0.9)
        .on('mousemove', (e, s) => { const [mx] = d3.pointer(e, host), y = Math.round(sx.invert(mx) / 5) * 5, n = names(y, s.key); const b = host.getBoundingClientRect();
          tip.innerHTML = `${esc(famName(s.key))} in about ${y}<small>${n.length ? esc(n.slice(0, 8).join(', ')) + (n.length > 8 ? ` and ${n.length - 8} more` : '') : 'none at work'}</small>`; tip.hidden = false;
          tip.style.left = `${Math.min(mx + 14, b.width - 260)}px`; tip.style.top = `${d3.pointer(e, host)[1] - 20}px`; })
        .on('mouseleave', () => { tip.hidden = true; });
      const evg = svg.append('g').attr('class', 'ev'); const lanes = [12, 27, 42], lastX = lanes.map(() => -1e9), narrow = W < 600;
      evs = EV.filter(([y]) => !narrow || [1536, 1618, 1685].includes(y)).map(([y, t]) => { const x = sx(y); let r = 0; while (r < lanes.length - 1 && x - 4 < lastX[r]) r++; lastX[r] = x + t.length * 6.4 + 12;
        const gg = evg.append('g').attr('opacity', 0); gg.append('line').attr('x1', x).attr('x2', x).attr('y1', lanes[r] + 4).attr('y2', bot);
        gg.append('text').attr('x', x + 4).attr('y', lanes[r]).text(t); return { y, gg }; });
      nowL = svg.append('line').attr('y1', top - 10).attr('y2', bot + 6).attr('stroke', TG.css('--rubric')).attr('stroke-width', 1.2);
      nowT = svg.append('text').attr('class', 'now').attr('y', bot - 8);
    }
    let cur = 1;
    function render(p) {
      cur = p; const Y = lerp(Y0 + 10, Y1, p), x = sx(Y);
      reveal.attr('width', x); nowL.attr('x1', x).attr('x2', x).attr('opacity', p < 1 ? 1 : 0);
      nowT.attr('x', Math.min(x + 8, W - 100)).text(p < 1 ? Math.round(Y) : '').attr('text-anchor', 'start');
      evs.forEach((e) => e.gg.attr('opacity', e.y <= Y ? 1 : 0));
    }
    build();
    TG.chapter('#tg-gen', 2800, render, { scrub: 0.5 });
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (Math.abs(host.clientWidth - W) > 2) { build(); render(cur); } }, 150); });
  })();

  /* ---------- 3. the Reformed International ---------- */
  (function road() {
    const box = document.getElementById('tg-map'), M = TG.map(box, LAND, [[-4.8, 40.6], [23.9, 56.2]], { parallels: [42, 54], phone: [[-4.5, 42], [17.5, 56.4]] });
    const cv = TG.canvas(box.querySelector('canvas')), {ctx} = cv, P = D.places;
    const ACAD = new Set(D.acad.map((a) => a[0]));
    const J = D.journeys.map((j) => { const pts = j.s.map(([p, y]) => ({ p, y, ll: P[p] })), born = pts.length > 2 && !ACAD.has(pts[0].p); return { ...j, pts, from: born ? pts[1].y - 4 : pts[0].y }; });
    const acad = D.acad.map(([p, y, what]) => ({ p, y, what, ll: P[p] }));
    const LBL = { Leiden: [-7, -6, 'right'], Utrecht: [7, 12, 'left'], Franeker: [-7, -6, 'right'], Geneva: [-7, 12, 'right'], Lausanne: [-7, -4, 'right'],
                  Bern: [7, 12, 'left'], Basel: [-7, -6, 'right'], Zurich: [7, -6, 'left'], Herborn: [7, -6, 'left'], Marburg: [7, 10, 'left'], Heidelberg: [7, 12, 'left'], Strasbourg: [-7, 12, 'right'], Sedan: [-7, -6, 'right'], Bremen: [7, 12, 'left'], 'Alba Iulia': [-7, -6, 'right'], Groningen: [7, -8, 'left'], Saumur: [-7, -6, 'right'] };
    const chron = TG.chronicle(document.getElementById('tg-chron'), D.events, ([y, e, w]) => `<li><span class="d">${y}</span><span class="e">${esc(e)}</span><span class="w">${esc(w)}</span></li>`);
    document.getElementById('tg-legend').innerHTML = `${D.fam.filter(([k]) => J.some((j) => j.f === k)).map(([k, n]) => `<span><i style="background:${fc(k)}"></i>${esc(n)}</span>`).join('')}<span><i style="background:transparent;border:1.5px solid var(--ink);border-radius:1px"></i>an academy and its year</span>`;
    const ribbon = document.getElementById('tg-ribbon'); let year = 1500, last = '';
    const curve = (a, b, t) => { const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], k = 0.18, cx = mx - dy * k, cy = my + dx * k, u = 1 - t; return [u * u * a[0] + 2 * u * t * cx + t * t * b[0], u * u * a[1] + 2 * u * t * cy + t * t * b[1]]; };
    function at(j, Y) {
      const pts = j.pts.map((s) => ({ ...s, xy: M.xy(s.ll) })); if (Y < j.from) return null;
      const trail = [pts[0].xy]; let pos = pts[0].xy, moving = false;
      for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1];
        if (Y >= b.y) { for (let s = 1; s <= 16; s++) trail.push(curve(a.xy, b.xy, s / 16)); pos = b.xy; continue; }
        if (Y > a.y) { const span = Math.max(1, b.y - a.y), tr = Math.min(span, 3), t = clamp((Y - (b.y - tr)) / tr, 0, 1), e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2)**2 / 2;
          for (let s = 1; s <= 16 * e; s++) trail.push(curve(a.xy, b.xy, s / 16)); pos = curve(a.xy, b.xy, e); moving = t > 0 && t < 1; }
        break; }
      return { pos, trail, alive: Y <= pts[pts.length - 1].y + 0.5, moving };
    }
    function render(Y) {
      year = Y; ctx.clearRect(0, 0, cv.W, cv.H); const ink = TG.css('--ink'), body = TG.css('--body'), disp = TG.css('--display');
      for (const s of acad) { if (s.y > Y) continue; const [x, y] = M.xy(s.ll), pop = clamp((Y - s.y) / 5, 0, 1), sz = 5 + 3 * (1 - pop);
        if (pop < 1) { ctx.globalAlpha = 0.35 * (1 - pop); ctx.fillStyle = TG.css('--rubric'); ctx.beginPath(); ctx.arc(x, y, 6 + 18 * pop, 0, 6.283); ctx.fill(); }
        ctx.globalAlpha = 0.3 + 0.6 * pop; ctx.strokeStyle = ink; ctx.lineWidth = 1.3; ctx.strokeRect(x - sz / 2, y - sz / 2, sz, sz);
        const [dx, dy, al] = LBL[s.p] || [7, -6, 'left']; ctx.textAlign = al; ctx.font = `italic 12px ${disp}`; ctx.fillStyle = ink; ctx.globalAlpha = 0.8 * pop;
        if (cv.W < 600) ctx.font = `italic 10px ${disp}`; ctx.fillText(cv.W < 600 ? s.p : `${s.p} ${s.y}`, x + dx, y + dy); ctx.textAlign = 'left'; }
      ctx.globalAlpha = 1; const live = [], boxes = [];
      for (const j of J) { const r = at(j, Y); if (!r) continue; const c = fc(j.f);
        ctx.strokeStyle = c; ctx.lineWidth = r.alive ? 1.8 : 1.1; ctx.globalAlpha = r.alive ? 0.55 : 0.15; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); r.trail.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
        if (r.alive) live.push({ j, r, c }); else { ctx.globalAlpha = 0.35; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(r.pos[0], r.pos[1], 1.8, 0, 6.283); ctx.fill(); } }
      for (const { r, c } of live) { const [x, y] = r.pos; ctx.globalAlpha = 0.18; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r.moving ? 10 : 7, 0, 6.283); ctx.fill();
        ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(x, y, 4.2, 0, 6.283); ctx.fill(); ctx.strokeStyle = TG.css('--card'); ctx.lineWidth = 1.5; ctx.stroke(); }
      ctx.font = `600 11.5px ${body}`;
      for (const { j, r, c } of live.sort((a, b) => a.r.pos[1] - b.r.pos[1])) { const [x, y] = r.pos, w = ctx.measureText(j.a).width; let lx = x + 8, ly = y + 4;
        const hit = (bx, by) => boxes.some((b) => bx < b[0] + b[2] && bx + w > b[0] && by - 10 < b[1] + 4 && by + 2 > b[1] - 10);
        if (lx + w > cv.W - 4 || hit(lx, ly)) lx = x - 8 - w; if (hit(lx, ly)) { lx = Math.min(x + 8, cv.W - w - 4); ly = y + 16; } if (hit(lx, ly)) continue;
        boxes.push([lx, ly, w]); ctx.fillStyle = TG.css('--land'); ctx.globalAlpha = 0.85; ctx.fillRect(lx - 2, ly - 11, w + 4, 14); ctx.globalAlpha = 1; ctx.fillStyle = c; ctx.fillText(j.a, lx, ly); }
      ctx.globalAlpha = 1;
      document.getElementById('tg-year').textContent = Math.round(Y);
      document.getElementById('tg-yearbar').style.width = `${(Y - 1500) / (1725 - 1500) * 100}%`;
      chron(Y);
      const names = live.map(({ j }) => j.a).join('|');
      if (names !== last) { last = names; ribbon.innerHTML = live.map(({ j, c }) => `<span><i style="background:${c}"></i>${esc(j.a)}</span>`).join('') || `<span class="small" style="border:0;background:none">${Y < 1600 ? 'No writer on this shelf is at work yet.' : 'No writer on this shelf is still at work.'}</span>`; }
    }
    M.onfit = () => { cv.size(); render(year); };
    TG.chapter('#tg-road', 4600, (p) => render(lerp(1500, 1725, p)), { scrub: 0.4 });
  })();

  /* ---------- 4. the confessions, dealt ---------- */
  (function confessions() {
    const deck = document.getElementById('tg-deck'), svg = deck.querySelector('svg'), card = document.getElementById('tg-bigcard'), tip = deck.querySelector('.tip');
    document.getElementById('tg-conf-n').textContent = D.conf.length;
    const ORDER = ['Swiss', 'Genevan/French', 'German/Palatinate', 'Dutch', 'English', 'Scottish', 'Hungarian/Transylvanian', 'Polish/Lithuanian', 'Bohemian', 'Waldensian', 'Italian/Iberian', 'Greek', 'Other'];
    const COL = { Swiss: 'swiss', 'Genevan/French': 'french', 'German/Palatinate': 'german', Dutch: 'dutch', English: 'british', Scottish: 'british' };
    const regColor = (r) => COL[r] ? fc(COL[r]) : r === 'Hungarian/Transylvanian' ? TG.css('--f7') : r === 'Polish/Lithuanian' ? TG.css('--f8') : TG.css('--muted');
    const lanes = ORDER.filter((r) => D.conf.some((c) => c[1] === r)), Y0 = 1520, Y1 = 1700;
    document.getElementById('tg-conf-legend').innerHTML = `${lanes.slice(0, 8).map((r) => `<span><i style="background:${regColor(r)}"></i>${esc(r)}</span>`).join('')}<span><i style="background:var(--muted)"></i>others</span>`;
    let W = 0, cards = [], flags = [];
    function build() {
      W = svg.clientWidth; const H = 300, top = 72, lh = (H - top - 26) / lanes.length, sx = (y) => 104 + (y - Y0) / (Y1 - Y0) * (W - 112);
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.innerHTML = '';
      const ax = mk('g', {}, svg);
      for (let y = 1525; y <= 1700; y += 25) { mk('line', { x1: sx(y), x2: sx(y), y1: top - 4, y2: H - 20, stroke: TG.css('--rule-2') }, ax); const t = mk('text', { x: sx(y), y: H - 6, class: 'tick', 'text-anchor': 'middle' }, ax); t.textContent = y; }
      lanes.forEach((r, i) => { const t = mk('text', { x: 98, y: top + i * lh + lh * 0.72, class: 'lane', 'text-anchor': 'end' }, ax); t.textContent = r.replace('Hungarian/Transylvanian', 'Hungarian').replace('Polish/Lithuanian', 'Polish').replace('German/Palatinate', 'German').replace('Genevan/French', 'Genevan, French').replace('Italian/Iberian', 'Italian, Spanish'); });
      const seen = {}; cards = D.conf.slice().sort((a, b) => a[0] - b[0]).map((c) => { const li = lanes.indexOf(c[1]), key = `${li}.${c[0]}`, k = seen[key] = (seen[key] || 0) + 1;
        const a = mk('a', { href: TG.read(c[3]), target: '_blank' }, svg);
        const rc = mk('rect', { class: 'c', x: sx(c[0]) - 3 + (k - 1) * 4.5, y: top + li * lh + lh * 0.15, width: 4, height: lh * 0.72, rx: 1, fill: regColor(c[1]) }, a);
        rc.addEventListener('mousemove', (e) => { const b = deck.getBoundingClientRect(); tip.innerHTML = `${esc(c[2])}<small>${esc(c[1])} · ${esc(c[5])} · ${c[4]} pp. · open it</small>`; tip.hidden = false;
          tip.style.left = `${Math.min(e.clientX - b.left + 12, b.width - 240)}px`; tip.style.top = `${e.clientY - b.top - 40}px`; });
        rc.addEventListener('mouseleave', () => { tip.hidden = true; });
        return { c, a, rc }; });
      // the great confessions become flags above the lanes once dealt
      const rows = [6, 18, 30, 42, 54].map((v) => v * (top / 64)), lastX = rows.map(() => -1e9), narrow = W < 600;
      const SH = { 'rc-001': 'Sixty-Seven Articles', 'rc-016': 'First Helvetic', 'rc-027': 'Tigurinus', 'rc-046': 'French', 'rc-057': 'Belgic', 'rc-061': 'Heidelberg', 'rc-063': 'Second Helvetic', 'rc-097': 'Remonstrance', 'rc-105': 'Dort', 'rc-125': 'Consensus' };
      flags = D.big.map((b) => { const x = sx(b.y), g = mk('g', { class: 'flag', opacity: 0 }, svg), lab = narrow ? '' : (SH[b.s.slice(0, 6)] || b.t);
        let r = 0; const w = lab.length * 6.6 + 8; while (r < rows.length - 1 && x - 4 < lastX[r]) r++; lastX[r] = x + w;
        mk('line', { x1: x, x2: x, y1: rows[r] + 4, y2: top - 2 }, g); mk('circle', { cx: x, cy: rows[r] + 4, r: 2.5, fill: TG.css('--rubric') }, g);
        const t = mk('text', { x: x + 5, y: rows[r] + 8 }, g); t.textContent = lab; return { b, g }; });
    }
    let year = -1, curBig = -2;
    function render(Y, instant) {
      year = Y;
      cards.forEach(({ c, rc }) => { const on = c[0] <= Y; if (rc._on === on) return; rc._on = on;
        if (G && !instant) gsap.to(rc, { opacity: on ? 1 : 0, y: on ? 0 : -16, duration: 0.45, ease: 'power2.out' }); else { rc.style.opacity = on ? 1 : 0; rc.style.transform = on ? 'none' : 'translateY(-16px)'; } });
      let bi = -1; D.big.forEach((b, i) => { if (b.y <= Y) bi = i; });
      flags.forEach((f, i) => { const on = i < bi || (instant && i <= bi); if (f._on === on) return; f._on = on; if (G && !instant) gsap.to(f.g, { opacity: on ? 1 : 0, duration: 0.5 }); else f.g.setAttribute('opacity', on ? 1 : 0); });
      if (bi !== curBig) { const dir = bi > curBig; curBig = bi; deal(bi, dir, instant); }
    }
    function deal(i, fwd, instant) {
      const b = D.big[Math.max(0, i)];
      const html = i < 0 ? `<p class="pl">The Reformed confessions</p><h3>1523 to 1675</h3><p>From Zwingli’s theses for the first Zurich disputation to the last Swiss formula.</p>`
        : `<span class="y">${b.y}</span><h3>${esc(b.t)}</h3><span class="pl">${esc(b.place)}</span><p>${esc(b.note)}</p>
          <div class="who">${b.who.length ? `On the shelf: ${b.who.map((w) => `<button type="button" data-w="${esc(w)}">${esc(w)}</button>`).join('')}` : ''}</div>
          <p class="rd" style="margin:8px 0 0"><a href="${TG.read(b.s)}" target="_blank" rel="noopener">Read the ${esc(b.t.replace(/^The /, ''))}</a> <span class="small">${b.p} pp.</span></p>`;
      const swap = () => { card.innerHTML = html; card.querySelectorAll('button[data-w]').forEach((x) => x.addEventListener('click', () => explorer && explorer.show(x.dataset.w))); };
      if (!G || instant) { swap(); return; }
      gsap.timeline().to(card, { y: fwd ? 40 : -30, xPercent: fwd ? -44 : -56, rotation: fwd ? 4 : -4, opacity: 0, duration: 0.28, ease: 'power2.in' })
        .add(swap).fromTo(card, { y: fwd ? -60 : 40, xPercent: fwd ? -64 : -36, rotation: fwd ? -7 : 5, opacity: 0 }, { y: 0, xPercent: -50, rotation: 0, opacity: 1, duration: 0.6, ease: 'back.out(1.4)' });
    }
    if (G && TG.pinOK()) { card.style.transform = 'none'; gsap.set(card, { xPercent: -50 }); }
    build(); render(TG.pinOK() ? Y0 : Y1, true);
    TG.chapter('#tg-conf', 3800, (p, fin) => render(fin ? Y1 : lerp(Y0, 1690, p), fin), { scrub: 0.4 });
    if (!TG.pinOK()) card.style.transform = 'none';
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (Math.abs(svg.clientWidth - W) > 2) { build(); const y = year; year = -1; cards.forEach((c) => { c.rc._on = undefined; }); flags.forEach((f) => { f._on = undefined; }); render(y, true); } }, 150); });
  })();

  /* ---------- 5. the Bible, book by book: a row for each writer, a column for each book; rows fill in the order the writers worked ---------- */
  (function bible() {
    const B = D.bible, host = document.getElementById('tg-bib'), svg = host.querySelector('svg'), tip = host.querySelector('.tip'), steps = document.getElementById('tg-bsteps');
    const NB = B.books.length, rows = B.rows.map((r) => { const by = {}; r.c.forEach((c) => (by[c[0]] = by[c[0]] || []).push(c)); return { ...r, by, nb: Object.keys(by).length }; });
    const per = B.books.map((_, i) => rows.filter((r) => r.by[i]).length), most = Math.max(...per);
    const vols = new Map(); rows.forEach((r) => r.c.forEach((c) => vols.set(c[1], c[5])));
    const nVol = [...vols.values()].reduce((t, v) => t + v, 0), words = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
    const say = (n) => words[n] || fmt(n);
    document.getElementById('tg-bib-n').textContent = `${fmt(nVol)} volumes by ${rows.length} writers.`;
    // runs of books a writer has no commentary on, said the short way: "Judges to Esther"
    const runs = (idx) => { const out = []; idx.forEach((i) => { const r = out[out.length - 1]; if (r && i === r[1] + 1) r[1] = i; else out.push([i, i]); });
      return out.map(([a, b]) => a === b ? B.books[a][1] : b === a + 1 ? `${B.books[a][1]} and ${B.books[b][1]}` : `${B.books[a][1]} to ${B.books[b][1]}`); };
    const find = (n) => rows.find((r) => r.n === n) || { nb: 0, by: {} };
    const calvin = find('John Calvin'), pis = find('Johannes Piscator'), gro = find('Hugo Grotius');
    const ranks = [...new Set(per)].sort((a, b) => b - a), named = (n) => per.map((v, i) => [v, i]).filter(([v]) => v === n).map(([, i]) => B.books[i][1]);
    const list = (xs) => xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
    const GROUPS = [
      { t: 'The first teachers', f: (r) => r.y0 < 1505, p: 'Oecolampadius taught at Basel and Bullinger at Zurich. Capito and Bucer taught at Strasbourg and Musculus at Bern. They lectured and wrote commentaries one book at a time.' },
      { t: 'Calvin at Geneva', f: (r) => r === calvin, p: (() => { const all = Object.keys(calvin.by).map(Number), hom = all.filter((i) => calvin.by[i].every((c) => c[4] === 'h'));
        return `Commentaries and lectures on ${all.length - hom.length} of the sixty-six books${hom.length ? `, and sermons on ${list(hom.map((i) => B.books[i][1]))}` : ''}. Not among them on the shelf: ${list(runs(B.books.map((_, i) => i).filter((i) => !calvin.by[i])))}.`; })() },
      { t: 'Zurich pulpits, Heidelberg chairs', f: (r) => r.y0 >= 1510 && r.y0 < 1540, p: 'Gwalther and Lavater preached through whole books at Zurich. Their homilies are drawn open. Zanchi and Olevian taught at Heidelberg.' },
      { t: 'Herborn and Leiden', f: (r) => r.y0 >= 1540 && r.y0 < 1580, p: `Piscator of Herborn set out all ${pis.nb === NB ? 'sixty-six books' : `${pis.nb} books`} of both Testaments in logical analysis. Pareus lectured on Romans at Heidelberg. Junius, Arminius and Gomarus taught at Leiden.` },
      { t: 'The learned century', f: (r) => r.y0 >= 1580, p: `Grotius annotated ${gro.nb === 27 ? 'the whole New Testament' : `${gro.nb} books`}. Cartwright gathered the rabbis on Genesis and Exodus. Daillé preached on Philippians at Charenton. Cocceius expounded Hebrews.` },
      { t: 'The books they opened most', f: () => false, p: `${list(named(ranks[0]))} drew the most writers: ${say(ranks[0])} of the ${rows.length}. Next ${named(ranks[1]).length === 1 ? 'comes' : 'come'} ${list(named(ranks[1]))} with ${say(ranks[1])}.` }];
    steps.innerHTML = GROUPS.map((g) => `<li><b>${esc(g.t)}</b><p>${esc(g.p)}</p></li>`).join('');
    const sl = [...steps.children];
    document.getElementById('tg-bib-legend').innerHTML = `${D.fam.filter(([k]) => rows.some((r) => r.f === k)).map(([k, n]) => `<span><i style="background:${fc(k)}"></i>${esc(n)}</span>`).join('')
       }<span><i style="background:transparent;border:1.5px solid var(--ink-2)"></i>sermons or homilies</span>`;
    const WTS = rows.map((r) => 1 + r.nb / 14), SUM = WTS.reduce((a, b) => a + b, 0), START = []; WTS.reduce((acc, w) => { START.push(acc / SUM); return acc + w; }, 0);
    let L = null, head = [], rowEls = [], bars = [], barLab = [], dots = null, W = 0;
    function layout() {
      W = host.clientWidth; const vert = W < 600, secOf = B.books.map((b) => B.secs.findIndex((s) => s[0] === b[2]));
      if (!vert) {
        const lab = 138, tot = 26, gap = 5, cw = (W - lab - tot - gap * (B.secs.length - 1)) / NB, rh = 19, top = 60, barH = 52, barTop = top + rows.length * rh + 18;
        const bx = B.books.map((_, i) => lab + i * cw + secOf[i] * gap);
        return { vert, secOf, H: barTop + barH + 30, pos: (k, i) => [bx[i] + 0.6, top + k * rh + 2, cw - 1.2, rh - 4], bx, cw, lab, tot, top, rh, barTop, barH };
      }
      const lab = 64, gap = 5, top = 118, rh = 11, cw = Math.min(16, (W - lab - 26) / rows.length), by = B.books.map((_, i) => top + i * rh + secOf[i] * gap);
      return { vert, secOf, H: by[NB - 1] + rh + 10, pos: (k, i) => [lab + k * cw + 0.6, by[i] + 0.6, cw - 1.2, rh - 1.2], by, cw, lab, top, rh };
    }
    function build() {
      L = layout(); svg.setAttribute('viewBox', `0 0 ${W} ${L.H}`); svg.innerHTML = ''; head = []; rowEls = []; bars = []; barLab = [];
      const g0 = mk('g', {}, svg);
      // sections and books
      B.secs.forEach(([k, n], s) => { const ix = B.books.map((b, i) => (b[2] === k ? i : -1)).filter((i) => i >= 0), a = ix[0], z = ix[ix.length - 1];
        if (!L.vert) { const x0 = L.bx[a], x1 = L.bx[z] + L.cw; head.push(mk('line', { class: 'secl', x1: x0, x2: x1 - 1, y1: 17, y2: 17 }, g0));
          const t = mk('text', { class: 'sec', x: x0, y: 12 }, g0), SHORT = { Prophets: 'Proph.', 'The Twelve': 'Twelve', 'Gospels, Acts': 'Gospels', 'Letters, Revelation': 'Letters' };
          for (const label of [n, SHORT[n] || n.split(/[ ,]/)[0], '']) { t.textContent = label; if (!label || t.getComputedTextLength() <= x1 - x0 - 3) break; } head.push(t); }
        else { const y0 = L.by[a], y1 = L.by[z] + L.rh; head.push(mk('line', { class: 'secl', x1: 2, x2: 2, y1: y0, y2: y1 - 1 }, g0)); } });
      B.books.forEach(([ab], i) => { const t = L.vert ? mk('text', { class: 'bk', x: L.lab - 4, y: L.by[i] + L.rh - 2.5, 'text-anchor': 'end' }, g0)
        : mk('text', { class: 'bk', transform: `translate(${L.bx[i] + L.cw * 0.5 + 3},${L.top - 4}) rotate(-90)` }, g0); t.textContent = ab; head.push(t); });
      // the empty grid, one dot to a cell
      let d = ''; rows.forEach((_, k) => B.books.forEach((__, i) => { const [x, y, w, h] = L.pos(k, i); d += `M${(x + w / 2 - 0.8).toFixed(1)},${(y + h / 2 - 0.8).toFixed(1)}h1.6v1.6h-1.6z`; }));
      dots = mk('path', { class: 'dots', d }, g0);
      rows.forEach((r, k) => {
        const g = mk('g', {}, svg), col = fc(r.f); let name;
        if (!L.vert) { name = mk('text', { class: 'nm', x: L.lab - 8, y: L.top + k * L.rh + L.rh * 0.66, 'text-anchor': 'end' }, g); name.textContent = r.n.replace(/^(Johannes|Wolfgang|Heinrich|Martin|Rudolf|Ludwig|Caspar|Franciscus|Girolamo|David|Jacobus|Hugo|Jean|Christopher|John) /, (m, f) => `${f[0]}. `); }
        else { name = mk('text', { class: 'nm', transform: `translate(${L.lab + k * L.cw + L.cw * 0.5 + 3},${L.top - 6}) rotate(-60)`, style: 'font-size:10px' }, g); name.textContent = r.n.split(' ').slice(-1)[0]; }
        const cells = Object.entries(r.by).map(([i, cs]) => { i = +i; const [x, y, w, h] = L.pos(k, i), hom = cs.every((c) => c[4] === 'h'), first = cs[0];
          const a = mk('a', { href: TG.read(first[1], first[2] || undefined), target: '_blank', 'data-k': k, 'data-i': i, 'aria-label': `${r.n} on ${B.books[i][1]}` }, g);
          const rect = mk('rect', { class: 'cl', x, y, width: w, height: h, rx: 1.5, fill: hom ? TG.css('--card') : col, stroke: hom ? col : 'none', 'stroke-width': hom ? 1.4 : 0 }, a);
          return { rect, i }; });
        let tot = null; if (!L.vert) { tot = mk('text', { class: 'rt', x: W - L.tot + 6, y: L.top + k * L.rh + L.rh * 0.66 }, g); tot.textContent = r.nb; }
        rowEls.push({ name, cells, tot });
      });
      if (!L.vert) { // how many of the writers opened each book
        const gb = mk('g', {}, svg); const cap = mk('text', { class: 'bcap', x: L.lab - 8, y: L.barTop + L.barH - 2, 'text-anchor': 'end' }, gb); cap.textContent = 'writers on each book'; barLab.push(cap);
        B.books.forEach((_, i) => { const h = per[i] / most * L.barH, r = mk('rect', { class: `bar${per[i] === most ? ' top' : ''}`, x: L.bx[i] + 0.6, y: L.barTop + L.barH - h, width: L.cw - 1.2, height: Math.max(h, 0.5) }, gb); bars.push(r);
          if (per[i] === most) { const t = mk('text', { class: 'bl', x: L.bx[i] + L.cw / 2, y: L.barTop + L.barH - h - 5, 'text-anchor': 'middle' }, gb); t.textContent = `${B.books[i][1]} ${per[i]}`; barLab.push(t); } });
        const base = mk('line', { x1: L.lab, x2: W - L.tot, y1: L.barTop + L.barH + 0.5, y2: L.barTop + L.barH + 0.5, stroke: TG.css('--rule') }, gb); barLab.push(base);
      }
    }
    let cur = -2;
    function render(p) {
      const hd = clamp(p / 0.06, 0, 1), body = clamp((p - 0.06) / 0.8, 0, 1), end = clamp((p - 0.88) / 0.1, 0, 1);
      head.forEach((e) => { e.style.opacity = hd; }); dots.style.opacity = hd;
      let now = -1;
      rowEls.forEach((R, k) => { const t0 = START[k], t1 = t0 + WTS[k] / SUM, loc = clamp((body - t0) / (t1 - t0), 0, 1), nm = clamp(loc * 3, 0, 1);
        if (body >= t0 && body > 0) now = k;
        R.name.style.opacity = nm; R.name.style.transform = L.vert ? '' : `translateX(${((1 - nm) * -8).toFixed(1)}px)`;
        R.cells.forEach(({ rect, i }) => { const u = ease(clamp(loc * 1.3 - (i / NB) * 0.3, 0, 1)); rect.style.opacity = u > 0.01 ? 1 : 0; rect.style.transform = `scale(${u.toFixed(3)})`; });
        if (R.tot) R.tot.style.opacity = loc >= 1 ? 1 : 0; });
      bars.forEach((b) => { b.style.transform = `scaleY(${ease(end).toFixed(3)})`; }); barLab.forEach((e) => { e.style.opacity = end; });
      const si = end > 0.4 ? GROUPS.length - 1 : now < 0 ? -1 : GROUPS.findIndex((g) => g.f(rows[now]));
      if (si !== cur) { cur = si; sl.forEach((li, i) => { li.classList.toggle('now', i === si); li.classList.toggle('past', i < si); }); }
    }
    host.addEventListener('mousemove', (e) => { const a = e.target.closest('a[data-k]'); if (!a) { tip.hidden = true; return; } const r = rows[+a.dataset.k], i = +a.dataset.i, b = host.getBoundingClientRect();
      tip.innerHTML = `${esc(r.n)} on ${esc(B.books[i][1])}<small>${r.by[i].map((c) => `${esc(c[3])}${c[5] > 1 ? `, ${c[5]} vols.` : ''}`).join('<br>')}</small>`; tip.hidden = false;
      tip.style.left = `${Math.min(e.clientX - b.left + 12, b.width - 250)}px`; tip.style.top = `${e.clientY - b.top + 14}px`; });
    host.addEventListener('mouseleave', () => { tip.hidden = true; });
    build(); let lastP = 0; if (document.fonts) document.fonts.ready.then(() => { build(); render(lastP); }); // labels are fitted by measuring them
    const st = TG.chapter('#tg-bible', 4400, (p, fin) => { lastP = fin ? 1 : p; render(lastP); }, { scrub: 0.5 });
    if (!st) sl.forEach((li) => li.classList.add('now'));
    let rt; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if (Math.abs(host.clientWidth - W) > 2) { build(); render(lastP); } }, 150); }).observe(host);
  })();

  /* ---------- 6. the Heidelberg Catechism: its 129 questions, and the pages three commentaries give each, as their printed books head them ---------- */
  (function heid() {
    const Hd = D.heid, host = document.getElementById('tg-heid-stage'), svg = host.querySelector('svg'), tip = host.querySelector('.tip'), steps = document.getElementById('tg-hsteps');
    const Q = Hd.qs, CM = Hd.comm, NQ = Q.length, PC = ['--muted', '--muted', '--f1', '--f6'].map((v) => TG.css(v));
    const partOf = (q) => Hd.parts.reduce((k, p, j) => (q >= p[1] ? j : k), 0); // q is 1-based
    const shortN = (c) => c.n.split(' ').slice(-1)[0];
    const share = (c, j) => { const qs = Q.map((_, i) => i).filter((i) => partOf(i + 1) === j); return Math.round(qs.reduce((t, i) => t + (c.pp[i] || 0), 0) / c.total * 100); };
    const span = (c, i) => { let k = i + 1; while (k < NQ && c.pp[k] == null) k++; return k - 1 > i ? `Q. ${i + 1} to ${k}` : `Q. ${i + 1}`; }; // a span runs on over questions the book does not head
    steps.innerHTML = `${CM.map((c) => { const pk = c.peaks[0];
      return `<li><b>${esc(c.n)}</b><p>${esc(c.d)}${c.where ? `; this printing ${esc(c.where)}` : ''}. ${fmt(c.total)} pages on the questions, ${c.headed} of the 129 headed one by one. Longest on ${span(c, pk)}, ${esc(Hd.topic[pk + 1])}: ${c.pp[pk]} pages.</p></li>`; }).join('')
       }<li><b>Where the weight falls</b><p>The third part, thankfulness (the law and prayer), takes ${CM.map((c) => `${share(c, 3)} per cent of ${shortN(c)}’s pages`).join(', ').replace(/, ([^,]*)$/, ' and $1')}.</p></li>`;
    const sl = [...steps.children];
    document.getElementById('tg-heid-legend').innerHTML = `${Hd.parts.slice(1).map((p, j) => `<span><i style="background:${PC[j + 1]}"></i>${esc(p[0])}</span>`).join('')
       }<span><i style="background:transparent;border:1px solid var(--muted)"></i>a question the book does not head</span>`;
    const maxPP = Math.max(...CM.flatMap((c) => c.pp.map((v) => v || 0)));
    let L = null, W = 0, headEls = [], ticks = [], rowsEl = [], peaks = [], hov = null;
    function layout() {
      W = host.clientWidth; const narrow = W < 600, pad = 4, ldGap = narrow ? 0 : 1.4, ptGap = narrow ? 5 : 10;
      const nLD = new Set(Q.map((q) => q[0])).size, cw = (W - 2 * pad - (nLD - 1) * ldGap - 3 * ptGap) / NQ, xs = []; let x = pad;
      Q.forEach((q, i) => { if (i && q[0] !== Q[i - 1][0]) x += ldGap; if (i && partOf(i + 1) !== partOf(i)) x += ptGap; xs.push(x); x += cw; });
      const top = narrow ? 64 : 70, rowH = narrow ? 120 : 152, H = top + CM.length * rowH + 4;
      return { narrow, cw, xs, top, rowH, H, base: (k) => top + (k + 1) * rowH - 10, k: (rowH - 58) / maxPP };
    }
    function build() {
      L = layout(); svg.setAttribute('viewBox', `0 0 ${W} ${L.H}`); svg.innerHTML = ''; headEls = []; ticks = []; rowsEl = []; peaks = [];
      const g0 = mk('g', {}, svg);
      hov = mk('rect', { class: 'hov', x: 0, y: 44, width: 0, height: L.H - 44, opacity: 0 }, g0);
      Hd.parts.forEach(([n, q0], j) => { const q1 = (Hd.parts[j + 1] || [0, NQ + 1])[1] - 1, x0 = L.xs[q0 - 1], x1 = L.xs[q1 - 1] + L.cw;
        const ln = mk('line', { class: 'ptl', x1: x0, x2: x1, y1: 20, y2: 20 }, g0), t = mk('text', { class: 'pt', x: x0, y: 14 }, g0), num = ['', 'I', 'II', 'III'][j];
        const full = j ? `${num}. ${n.replace(/^Of /, '').replace(/^./, (m) => m.toUpperCase())}` : n;
        for (const label of [full, num, '']) { t.textContent = label; if (!label || t.getComputedTextLength() <= x1 - x0 - 2) break; } headEls.push(ln, t); });
      if (!L.narrow) Hd.subs.forEach(([n, q0], j) => { const x = L.xs[q0 - 1], nx = j + 1 < Hd.subs.length ? L.xs[Hd.subs[j + 1][1] - 1] : W, room = nx - x - 4;
        const ln = mk('line', { class: 'sbl', x1: x + 0.5, x2: x + 0.5, y1: 26, y2: 44 }, g0), t = mk('text', { class: 'sb', x: x + 3, y: 34 }, g0);
        const SUB = { 'Of God the Father': ['God the Father', 'Father'], 'Of God the Son': ['God the Son', 'The Son'], 'Of God the Holy Ghost': ['The Holy Ghost', 'Holy Ghost'], 'The Sacraments': ['The sacraments', 'Sacraments'],
          'Of Holy Baptism': ['Baptism'], 'Of the Holy Supper': ['The Supper', 'Supper'], 'The Law of God': ['The law of God', 'The law'], Prayer: ['Prayer'] }[n] || [n];
        for (const label of [...SUB, '']) { t.textContent = label; if (!label || t.getComputedTextLength() <= room) break; } headEls.push(ln, t); });
      Q.forEach((q, i) => ticks.push(mk('rect', { class: 'tk', x: L.xs[i] + L.cw / 2 - 1.2, y: 47, width: 2.4, height: 2.4, opacity: 0 }, g0)));
      CM.forEach((c, k) => {
        const g = mk('g', {}, svg), b = L.base(k), rowTop = L.top + k * L.rowH;
        const nm = mk('text', { class: 'rn', x: 4, y: rowTop + 16 }, g); nm.textContent = c.n;
        const sub = mk('text', { class: 'rs', x: 4, y: rowTop + 16 }, g); sub.textContent = `${c.d}${c.where ? ` · ${c.where}` : ''} · ${fmt(c.total)} pages on the questions`;
        if (L.narrow) sub.setAttribute('y', rowTop + 30); else sub.setAttribute('x', 4 + nm.getComputedTextLength() + 10);
        mk('line', { class: 'base', x1: 0, x2: W, y1: b + 0.5, y2: b + 0.5 }, g);
        const bars = c.pp.map((v, i) => {
          if (v == null) return { el: mk('rect', { class: 'un', x: L.xs[i] + L.cw / 2 - 1.5, y: b - 3.5, width: 3, height: 3 }, g), i, hollow: true };
          const h = Math.max(1.2, v * L.k), a = mk('a', { href: TG.read(c.slug, c.pg[i]), target: '_blank', 'aria-label': `${c.n} on question ${i + 1}: ${v} pages` }, g);
          return { el: mk('rect', { class: 'b', x: L.xs[i] + 0.3, y: b - h, width: Math.max(0.8, L.cw - (L.narrow ? 0.3 : 0.8)), height: h, fill: PC[partOf(i + 1)] }, a), i }; });
        rowsEl.push({ nm, sub, bars });
        // the questions it dwells on longest: a number over the bar, and their names in a line at the head of the row
        const pk = (L.narrow ? c.peaks.slice(0, 1) : c.peaks).map((i) => ({ i, x: L.xs[i] + L.cw / 2, y: b - c.pp[i] * L.k })).sort((a, z) => a.x - z.x);
        const line = mk('text', { class: 'rs', x: 4, y: rowTop + 31, opacity: 0 }, g);
        line.textContent = `Longest: ${c.peaks.slice(0, L.narrow ? 1 : 3).map((i) => `${span(c, i).replace('Q. ', 'Q. ')}, ${Hd.topic[i + 1]} (${c.pp[i]} pp.)`).join(' · ')}`;
        if (L.narrow) line.setAttribute('y', rowTop + 44);
        peaks.push({ g: line, row: k }); let lastX = -1e9;
        if (!L.narrow) pk.forEach((p) => { const txt = `${p.i + 1}`, w = txt.length * 6 + 4, lift = p.x - w / 2 < lastX + 4 ? 12 : 0, pg = mk('g', { class: 'pk', opacity: 0 }, g), ty = p.y - 6 - lift;
          mk('line', { x1: p.x, x2: p.x, y1: ty + 3, y2: p.y - 1 }, pg); const t = mk('text', { class: 'q', x: p.x, y: ty, 'text-anchor': 'middle' }, pg); t.textContent = txt;
          lastX = p.x + w / 2; peaks.push({ g: pg, row: k }); });
      });
      // hover: the whole column of a question
      const hit = mk('g', {}, svg); Q.forEach((q, i) => { const r = mk('rect', { x: L.xs[i], y: 44, width: L.cw + 1, height: L.H - 44, fill: 'transparent', 'data-i': i }, hit); r.style.cursor = 'crosshair'; });
      hit.style.pointerEvents = L.narrow ? 'none' : 'auto'; svg.appendChild(hit); rowsEl.forEach((R) => R.bars.forEach((x) => { if (!x.hollow) svg.appendChild(x.el.parentNode); }));
    }
    let cur = -2;
    function render(p) {
      const t = clamp(p / 0.12, 0, 1), body = clamp((p - 0.12) / 0.74, 0, 1), end = clamp((p - 0.88) / 0.1, 0, 1);
      headEls.forEach((e) => { e.style.opacity = t; }); ticks.forEach((e, i) => { e.setAttribute('opacity', t * NQ > i ? 1 : 0); });
      let now = -1;
      rowsEl.forEach((R, k) => { const loc = clamp(body * CM.length - k, 0, 1); if (loc > 0) now = k;
        R.nm.style.opacity = R.sub.style.opacity = clamp(loc * 4, 0, 1);
        R.bars.forEach(({ el, i, hollow }) => { const u = ease(clamp(loc * 1.3 - (i / NQ) * 0.3, 0, 1)); if (hollow) el.style.opacity = u > 0.5 ? 1 : 0; else el.style.transform = `scaleY(${u.toFixed(3)})`; }); });
      peaks.forEach(({ g, row }) => { const v = end > 0 ? end : 0; g.setAttribute('opacity', v.toFixed(2)); g.style.transform = `translateY(${((1 - v) * 6).toFixed(1)}px)`; });
      const si = end > 0.5 ? CM.length : now;
      if (si !== cur) { cur = si; sl.forEach((li, i) => { li.classList.toggle('now', i === si); li.classList.toggle('past', i < si); }); }
    }
    host.addEventListener('mousemove', (e) => { const r = e.target.closest('[data-i]'), i = r ? +r.dataset.i : null;
      const b = host.getBoundingClientRect(), mx = (e.clientX - b.left) * (W / b.width), qi = i != null ? i : L.xs.findIndex((x, j) => mx >= x && mx < x + L.cw + 1.5);
      if (qi < 0) { tip.hidden = true; hov.setAttribute('opacity', 0); return; }
      hov.setAttribute('x', L.xs[qi] - 0.5); hov.setAttribute('width', L.cw + 1); hov.setAttribute('opacity', 1);
      tip.innerHTML = `Question ${qi + 1} · Lord’s Day ${Q[qi][0]}<br>${esc(Q[qi][1])}<small>${CM.map((c) => `${esc(shortN(c))}: ${c.pp[qi] == null ? 'with the question before' : `${c.pp[qi]} pp.`}`).join(' · ')}</small>`; tip.hidden = false;
      tip.style.left = `${Math.min(e.clientX - b.left + 14, b.width - 300)}px`; tip.style.top = `${Math.max(0, e.clientY - b.top - 70)}px`; });
    host.addEventListener('mouseleave', () => { tip.hidden = true; hov && hov.setAttribute('opacity', 0); });
    host.addEventListener('click', (e) => { if (e.target.closest('a')) return; const r = e.target.closest('[data-i]'); if (!r) return; const i = +r.dataset.i, b = host.getBoundingClientRect();
      const y = (e.clientY - b.top) * (L.H / b.height), k = clamp(Math.floor((y - L.top) / L.rowH), 0, CM.length - 1), c = CM[k]; let j = i; while (j > 0 && c.pp[j] == null) j--;
      window.open(TG.read(c.slug, c.pg[j]), '_blank', 'noopener'); });
    build(); let lastP = 0; if (document.fonts) document.fonts.ready.then(() => { build(); render(lastP); });
    const st = TG.chapter('#tg-heid', 4200, (p, fin) => { lastP = fin ? 1 : p; render(lastP); }, { scrub: 0.5 });
    if (!st) sl.forEach((li) => li.classList.add('now'));
    let rt; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if (Math.abs(host.clientWidth - W) > 2) { build(); render(lastP); } }, 150); }).observe(host);
  })();

  /* ---------- 7. Dort: the five articles of the Remonstrance, and the four heads the synod answered them under ---------- */
  (function dort() {
    const Dt = D.dort, stage = document.getElementById('tg-dort-stage'), links = stage.querySelector('svg.links'), artsEl = document.getElementById('tg-arts'), headsEl = document.getElementById('tg-heads');
    const roman = ['I', 'II', 'III', 'IV', 'V'];
    artsEl.innerHTML = Dt.arts.map(([n, t, q]) => `<li><b>${n}</b><span>${esc(t)}</span><q>${esc(q)}</q></li>`).join('');
    headsEl.innerHTML = Dt.heads.map((h) => `<li><span class="hh">${esc(h.h)}</span><a href="${TG.read(Dt.canons, h.p)}" target="_blank" rel="noopener">${esc(h.t)}</a>
      <span class="dots" aria-hidden="true">${'<i></i>'.repeat(h.arts)}<i class="gap"></i>${'<i class="e"></i>'.repeat(h.errs)}</span>
      <small>${h.arts} articles, ${h.errs} errors rejected · answers article${h.ans.length > 1 ? 's' : ''} ${h.ans.map((a) => roman[a]).join(' and ')}</small></li>`).join('');
    const nA = Dt.heads.reduce((t, h) => t + h.arts, 0), nE = Dt.heads.reduce((t, h) => t + h.errs, 0);
    const sum = document.getElementById('tg-dort-sum'); sum.innerHTML = `${nA} articles and ${nE} rejected errors in all. <a href="${TG.read(Dt.canons)}" target="_blank" rel="noopener">Read the Canons</a> · <a href="${TG.read(Dt.remonstrance)}" target="_blank" rel="noopener">the Remonstrance</a>`;
    document.getElementById('tg-sat').innerHTML = Dt.sat.map(([n, what, p]) => `<button type="button" data-w="${esc(n)}" title="${esc(`${what}; named in the Acts of the synod, p. ${p}`)}">${esc(n)}<small>${esc(what.split(';')[0])}</small></button>`).join('');
    stage.querySelectorAll('.satl button').forEach((b) => b.addEventListener('click', () => explorer && explorer.show(b.dataset.w)));
    const li = (w) => `<li><a href="${TG.read(w[1])}" target="_blank" rel="noopener">${esc(w[0].replace(/\s*\(.*\)$/, '').replace(/:.*$/, ''))}</a><small>${/^Synod/.test(w[3]) ? 'the synod' : esc(w[3].split(' ').slice(-1)[0])} · ${fmt(w[2])} pp.</small></li>`;
    document.getElementById('tg-dort-books').innerHTML = `<h4>For the Remonstrants, on the shelf</h4><ul>${Dt.for.map(li).join('')}</ul><h4>For the synod</h4><ul>${Dt.against.map(li).join('')}</ul>`;
    const A = [...artsEl.children], Hs = [...headsEl.children], chips = [...stage.querySelectorAll('.satl button')], dotsOf = Hs.map((h) => [...h.querySelectorAll('.dots i:not(.gap)')]);
    let paths = [];
    function wire() {
      // layout boxes, not screen boxes: the cards are mid-slide when this runs
      const box = (el) => { let x = 0, y = 0, e = el; while (e && e !== stage) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; } return { x, y, w: el.offsetWidth, h: el.offsetHeight }; };
      links.setAttribute('viewBox', `0 0 ${stage.offsetWidth} ${stage.offsetHeight}`); links.innerHTML = ''; paths = [];
      Dt.heads.forEach((h, j) => h.ans.forEach((a) => { const ra = box(A[a]), rh = box(Hs[j]);
        const x0 = ra.x + ra.w, y0 = ra.y + ra.h / 2, x1 = rh.x, y1 = rh.y + Math.min(rh.h / 2, 28), mx = (x0 + x1) / 2;
        const p = mk('path', { d: `M${x0},${y0} C${mx},${y0} ${mx},${y1} ${x1},${y1}` }, links); paths.push({ p, j, L: p.getTotalLength() }); }));
    }
    let cur = -2;
    function render(p) {
      A.forEach((el, i) => { const u = ease(clamp((p - 0.02 - i * 0.05) / 0.06, 0, 1)); el.style.opacity = u; el.style.transform = `translateX(${((1 - u) * -14).toFixed(1)}px)`; });
      chips.forEach((el, i) => { el.style.opacity = clamp((p - 0.28 - i * 0.012) / 0.04, 0, 1); });
      let now = -1;
      Hs.forEach((el, j) => { const t0 = 0.44 + j * 0.11, u = ease(clamp((p - t0) / 0.06, 0, 1)), d = clamp((p - t0 - 0.03) / 0.07, 0, 1); if (p >= t0) now = j;
        el.style.opacity = u; el.style.transform = `translateX(${((1 - u) * 14).toFixed(1)}px)`;
        dotsOf[j].forEach((x, k) => { x.style.opacity = k / dotsOf[j].length < d ? 1 : 0.12; }); });
      paths.forEach(({ p: el, j, L }) => { const t0 = 0.44 + j * 0.11; el.style.strokeDasharray = L; el.style.strokeDashoffset = L * (1 - ease(clamp((p - t0) / 0.07, 0, 1))); });
      sum.style.opacity = clamp((p - 0.9) / 0.06, 0, 1);
      const hit = p > 0.92 ? -1 : now; if (hit !== cur) { cur = hit; A.forEach((el, i) => el.classList.toggle('hit', hit >= 0 && Dt.heads[hit].ans.includes(i))); }
    }
    Hs.forEach((el, j) => { el.addEventListener('mouseenter', () => A.forEach((a, i) => a.classList.toggle('hit', Dt.heads[j].ans.includes(i)))); el.addEventListener('mouseleave', () => A.forEach((a) => a.classList.remove('hit'))); });
    let lastP = 0;
    const go = () => { if (innerWidth > 860) wire(); render(lastP); }; // the curves on every wide screen, reduced motion too
    TG.chapter('#tg-dort', 3600, (p, fin) => { lastP = fin ? 1 : p; render(lastP); }, { scrub: 0.5 });
    go(); if (document.fonts) document.fonts.ready.then(go);
    let rt; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(go, 150); }).observe(stage);
  })();

  /* ---------- 8. divide, and divide again: Polanus's tree ---------- */
  (function ramus() {
    const stage = document.getElementById('tg-ramus-stage'), svg = stage.querySelector('svg'), steps = document.getElementById('tg-rsteps');
    const MAIN = new Set(['Christian theology', 'True theology', 'Ectypal', 'Of wayfarers', 'Supernatural', 'Its parts']);
    const nodes = []; let leaves = 0, maxD = 0;
    (function walk(n, d, parent) { const o = { en: n[0], la: n[1], gl: n[2], ref: n[3], kids: [], d, parent }; nodes.push(o); maxD = Math.max(maxD, d);
      if (!n[4].length) o.leaf = leaves++; n[4].forEach((k) => o.kids.push(walk(k, d + 1, o))); return o; })(D.tree, 0, null);
    const STEPS = [
      ['Theology is false or true', 'Book I, chapters I and II.'],
      ['True theology is archetypal or ectypal', 'God’s own knowledge of himself and the copy of it he gives to creatures (chapters III and IV). Polanus took the distinction from Junius.'],
      ['Ectypal theology is of union, of vision, or of wayfarers', 'In the human soul of Christ, in the blessed in heaven, and in believers on the way (chapters VII to IX).'],
      ['The wayfarers’ theology is natural or supernatural', 'What nature teaches and what God has revealed that could not be known otherwise (chapters X and XI).'],
      ['Revealed theology has its principle and its parts', 'Its principle is Scripture. Scripture fills the rest of Book I. Its parts open Book II.'],
      ['Its parts are faith and good works', 'What is to be believed and what is to be done.'],
      ['Faith is of God and his works. Good works are worship.', 'Faith treats God in himself and in his works (Books II to VII). Good works are the immediate worship of God and the mediate worship toward the neighbor. These are the two tables of the law (Books IX and X).'],
    ];
    steps.innerHTML = STEPS.map(([b, p]) => `<li><b>${esc(b)}</b><p>${esc(p)}</p></li>`).join('');
    const sl = [...steps.children];
    document.getElementById('tg-polbooks').innerHTML = D.polbooks.map(([r, t, s, n]) => `<a href="${TG.read(s)}" target="_blank" rel="noopener" title="${esc(t)}, ${n} pages"><b>${r}</b>${esc(t.replace(/^On (the )?/, '').replace(/ or the Works of.*$/, '').replace(/, and His Divine Attributes|and the Divine Persons|, Decree, and Predestination| of All Things|, Sin, Christ, Covenant.*$| and Ecclesiastical Government| and Good Works/g, ''))}</a>`).join('');
    const COLW = 196, X0 = 22, totalW = X0 + maxD * COLW + 210;
    let H = 0, W = 0, TH = 0, built = false, groups = [];
    function build() {
      W = stage.clientWidth; H = stage.clientHeight; const top = 40, rh = Math.max(84, (H - top * 2) / (leaves - 1)); TH = top * 2 + rh * (leaves - 1);
      (function place(o) { if (o.leaf !== undefined) o.y = top + o.leaf * rh; else { o.kids.forEach(place); o.y = (o.kids[0].y + o.kids[o.kids.length - 1].y) / 2; } o.x = X0 + o.d * COLW; })(nodes[0]);
      svg.setAttribute('width', totalW); svg.setAttribute('height', TH); svg.style.height = `${TH}px`; svg.setAttribute('viewBox', `0 0 ${totalW} ${TH}`); svg.innerHTML = '';
      groups = [];
      nodes.forEach((o) => {
        const g = mk('g', {}, svg); const isMain = MAIN.has(o.en);
        let br = null;
        if (o.kids.length) br = mk('path', { class: `br${isMain ? ' main' : ''}`, d: brace(o.kids[0].x - 22, o.kids[0].y - 12, o.kids[o.kids.length - 1].y - 12, 14) }, g);
        const a = mk('a', { href: TG.read(o.ref[0], o.ref[1]), target: '_blank', class: `nd${isMain ? ' main' : ''}` }, g);
        const ttl = mk('title', {}, a); ttl.textContent = `${o.en}: ${o.gl || ''} (${o.ref[2]})`;
        const la = mk('text', { x: o.x, y: o.y - 12, class: 'la' }, a); la.textContent = o.d === 0 ? 'Theologia' : `${o.la}`;
        const en = mk('text', { x: o.x, y: o.y + 4, class: 'en' }, a); en.textContent = o.en;
        const cp = mk('text', { x: o.x, y: o.y + 17, class: 'cp' }, a); cp.textContent = o.ref[2];
        groups.push({ o, g, br, a });
      });
      built = true;
    }
    let last = -1;
    function render(p, fin) {
      if (!built) build();
      const d = fin ? maxD + 0.999 : p * (maxD + 0.999);
      groups.forEach(({ o, a, br }) => {
        const vis = clamp((d - o.d) * 1.6 + 0.2, 0, 1); a.style.opacity = o.d === 0 ? 1 : vis; a.style.transform = `translateX(${(1 - vis) * -10}px)`;
        if (br) { const L = br._L || (br._L = br.getTotalLength()); br.style.strokeDasharray = L; br.style.strokeDashoffset = L * (1 - clamp((d - o.d) * 1.4, 0, 1)); }
      });
      // the camera follows the column being opened, down to the last one (10-10, owner: "at the end it shows white because it pans up":
      // past the main line it fell back to the root's height while the deepest branches sat below the frame)
      const focus = (i) => { const k = Math.min(i, maxD); let rel = nodes.filter((o) => o.d === k || o.d === k + 1); if (!rel.length) rel = nodes.filter((o) => o.d === maxD);
        const ys = rel.map((o) => o.y); return (Math.min(...ys) + Math.max(...ys)) / 2; };
      const i0 = Math.floor(d), f = clamp(d - i0, 0, 1), fy = lerp(focus(i0), focus(i0 + 1), ease(f));
      const tx = fin && !TG.pinOK() ? 0 : -clamp(X0 + d * COLW - W * 0.62, 0, Math.max(0, totalW - W));
      const ty = fin && !TG.pinOK() ? 0 : -clamp(fy - H * 0.5, 0, Math.max(0, TH - H));
      svg.style.transform = `translate(${tx}px, ${ty}px)`;
      const si = clamp(Math.floor(d) - 1, 0, STEPS.length - 1); if (si !== last) { last = si; sl.forEach((li, i) => { li.classList.toggle('now', i === si); }); }
    }
    if (!TG.pinOK()) {
      const li = (o) => `<li><a href="${TG.read(o.ref[0], o.ref[1])}" target="_blank" rel="noopener" class="${MAIN.has(o.en) ? 'main' : ''}"><i>${esc(o.d === 0 ? 'Theologia' : o.la)}</i> ${esc(o.en)} <small>${esc(o.ref[2])}</small></a>${o.kids.length ? `<ul>${o.kids.map(li).join('')}</ul>` : ''}</li>`;
      stage.classList.add('outline'); stage.innerHTML = `<ul>${li(nodes[0])}</ul>`; sl.forEach((x) => x.classList.add('now')); return; }
    TG.chapter('#tg-ramus', 3600, render, { scrub: 0.5 });
    let rt; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if (Math.abs(stage.clientWidth - W) > 2 || Math.abs(stage.clientHeight - H) > 2) { built = false; render(0); } }, 120); }).observe(stage);
  })();

  /* ---------- explore ---------- */
  explorer = TG.explorer(document.getElementById('tg-explorer'), D, { range: [1470, 1790], first: 'John Calvin', placeholder: 'Calvin, Voetius, covenant…', label: 'Lifelines of the writers on the Continental Reformed shelf' });
  TG.reveal('.tg .reveal');
})();
