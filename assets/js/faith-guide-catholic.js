/* The Roman Catholic shelf guide: the bookcase sorting itself into schools, the schools as streams, then one scene to a school
   (the Thomists' Summa ledger, Rada's Thomas-against-Scotus and the Punch-Mastri quarrel, Lapide's Bible, the quarrel over grace),
   the colleges on the map, the plan of Suárez's Metaphysical Disputations opening out, the sessions of Trent, and merit. */
(async () => {
  const method = (html) => (window.TFRMethod ? window.TFRMethod.html(html) : html);
  const {TG} = window, D = await TG.load('data'), LAND = await TG.load('land');
  const { esc, fmt, clamp, ease, lerp } = TG, G = TG.hasG && !TG.reduce ? window.gsap : null;
  const FAMS = D.fam.map((f) => f[0]), fc = (k) => TG.css(`--f${FAMS.indexOf(k) + 1}`), famName = (k) => (D.fam.find((f) => f[0] === k) || [])[1];
  const fcI = (i) => TG.css(`--f${i + 1}`);
  const NS = 'http://www.w3.org/2000/svg';
  let explorer = null;

  /* ---------- hero: facts, and the bookcase that sorts itself into the schools ---------- */
  const facts = { works: D.n_works, authors: D.n_authors, pages: D.n_pages, schools: D.fam.length };
  document.querySelectorAll('[data-count]').forEach((el) => TG.countUp(el, facts[el.dataset.count], 1.8));
  (function bookcase() {
    const host = document.getElementById('tg-case'), tip = host.querySelector('.tip'), tick = document.getElementById('tg-tick'), cap = document.getElementById('tg-case-cap');
    const B = D.books, H = (p) => Math.round(15 + 44 * Math.sqrt(Math.min(p, 2400) / 2400));
    const els = B.map((b, i) => { const a = document.createElement('a'); a.className = 'bk'; a.href = TG.read(b[2]); a.target = '_blank'; a.rel = 'noopener';
      a.style.background = fcI(b[4]); a.style.height = `${H(b[3])}px`; a.setAttribute('aria-label', `${b[1]}, ${b[0]}, ${fmt(b[3])} pages`); a.dataset.i = i; host.appendChild(a); return a; });
    let mode = 'date', deco = [];
    function layout(m) {
      const W = host.clientWidth, narrow = W < 700, gap = 1, pad = 12, rowGap = 14, LW = m === 'school' && !narrow ? 250 : 0;
      // by school, each school keeps to one shelf: the spines narrow until the largest school fits (the Jesuits wrapped at 1360px, 10-10)
      const most = Math.max(...FAMS.map((_, fi) => B.filter((b) => b[4] === fi).length));
      let bw = W < 520 ? 2 : W > 1100 ? 4 : 3;
      if (m === 'school' && !narrow) bw = Math.max(1.5, Math.min(bw, (W - pad - LW) / most - gap));
      const pos = new Array(B.length), boards = [], labels = [], cents = []; let y = 14;
      const flow = (idxs, x0) => {
        let row = [], x = x0; const rows = [];
        const flush = () => { if (!row.length) return; const top = y, mh = Math.max(...row.map((i) => H(B[i][3]))); row.forEach((i) => { pos[i].y = top + mh - H(B[i][3]); });
          boards.push(top + mh); rows.push(top); y += mh + 7 + rowGap; row = []; x = x0; };
        for (const i of idxs) { if (x + bw > W - pad && row.length) flush(); pos[i] = { x, y: 0 }; row.push(i); x += bw + gap; }
        flush(); return rows;
      };
      if (m === 'date') {
        const idx = B.map((_, i) => i); const rows = flow(idx, pad);
        let lastC = 0, lastX = -1e9, lastY = -1; idx.forEach((i) => { const c = Math.floor(B[i][5] / 100) * 100; if (c > lastC && c < 2000) { lastC = c; const sameRow = Math.abs(pos[i].y - lastY) < 70; if (!(sameRow && pos[i].x - lastX < 46)) { cents.push({ x: pos[i].x, y: pos[i].y - 22, t: c }); lastX = pos[i].x; lastY = pos[i].y; } } });
      } else {
        FAMS.forEach((k, fi) => { const idx = B.map((b, i) => [b, i]).filter(([b]) => b[4] === fi).map(([, i]) => i); if (!idx.length) return;
          if (narrow) { labels.push({ fi, n: idx.length, x: pad, y }); y += 40; flow(idx, pad); }
          else { const y0 = y; flow(idx, LW); labels.push({ fi, n: idx.length, x: 14, y: y0 + 4 }); } });
      }
      return { pos, boards, labels, cents, bw, height: y - rowGap + 6 };
    }
    function decorate(L, animate) {
      deco.forEach((d) => { if (G && animate) gsap.to(d, { opacity: 0, duration: 0.3, onComplete: () => d.remove() }); else d.remove(); }); deco = [];
      const add = (el, delay) => { host.appendChild(el); deco.push(el); if (G && animate) gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.6, delay }); else el.style.opacity = 1; };
      L.boards.forEach((by) => { const d = document.createElement('div'); d.className = 'board'; d.style.top = `${by}px`; add(d, 0.7); });
      L.labels.forEach(({ fi, n, x, y }) => { const d = document.createElement('div'); d.className = 'rl'; d.style.left = `${x}px`; d.style.top = `${y}px`;
        const nA = D.authors.filter((a) => a.f === FAMS[fi]).length + D.undated.filter((a) => a.f === FAMS[fi]).length;
        d.innerHTML = `<i style="background:${fcI(fi)}"></i>${esc(D.fam[fi][1])}<small>${fmt(n)} works · ${nA} authors</small>`; add(d, 0.9 + fi * 0.08); });
      L.cents.forEach(({ x, y, t }) => { const d = document.createElement('div'); d.className = 'cent'; d.style.left = `${x}px`; d.style.top = `${Math.max(0, y)}px`; d.textContent = t; add(d, 0.2); });
    }
    function apply(m, how) { // how: 'set' | 'flip'
      mode = m; const L = layout(m); host.style.height = `${L.height}px`; els.forEach((el) => { el.style.width = `${L.bw}px`; });
      document.querySelectorAll('.tg-cat .seg button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mode === m ? 'true' : 'false'));
      cap.innerHTML = method(m === 'date' ? 'Every book on the shelf in the order its author was born. A taller spine means more pages. Hover over a spine to see it. Open it to read.'
        : 'The same books grouped by school with the oldest first. The long runs are the great sets: the Salamanca course and Suárez’s works.');
      if (how === 'flip' && G) {
        els.forEach((el, i) => gsap.to(el, { x: L.pos[i].x, y: L.pos[i].y, duration: 1.15, ease: 'power3.inOut', delay: (B[i][4] * 0.05) + (i % 40) * 0.002 }));
      } else els.forEach((el, i) => { if (window.gsap) gsap.set(el, { x: L.pos[i].x, y: L.pos[i].y, opacity: 1 }); else el.style.transform = `translate(${L.pos[i].x}px,${L.pos[i].y}px)`; });
      decorate(L, how === 'flip');
      tick.textContent = '';
      if (window.ScrollTrigger) setTimeout(() => ScrollTrigger.refresh(), how === 'flip' ? 1300 : 50);
    }
    document.querySelectorAll('.tg-cat .seg button').forEach((b) => b.addEventListener('click', () => { if (b.dataset.mode !== mode) apply(b.dataset.mode, 'flip'); }));
    host.addEventListener('mouseover', (e) => { const a = e.target.closest('.bk'); if (!a) return; const b = B[+a.dataset.i];
      tip.innerHTML = `${esc(b[1])}<small>${esc(b[0])} · ${fmt(b[3])} pages · ${esc(D.fam[b[4]][1])}</small>`; tip.hidden = false; });
    host.addEventListener('mousemove', (e) => { if (tip.hidden) return; const r = host.getBoundingClientRect(); tip.style.left = `${Math.min(e.clientX - r.left + 12, r.width - 250)}px`; tip.style.top = `${e.clientY - r.top + 16}px`; });
    host.addEventListener('mouseleave', () => { tip.hidden = true; });
    host.addEventListener('focusin', (e) => { const a = e.target.closest('.bk'); if (a) { const b = B[+a.dataset.i]; tip.innerHTML = `${esc(b[1])}<small>${esc(b[0])}</small>`; tip.hidden = false; tip.style.left = '12px'; tip.style.top = '8px'; } });
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => apply(mode, 'set'), 160); });
    if (!G) { apply('school', 'set'); return; }
    // the intro: the books arrive in order of their authors' births, then go to their schools
    const L = layout('date'); host.style.height = `${L.height}px`; els.forEach((el) => { el.style.width = `${L.bw}px`; });
    els.forEach((el, i) => gsap.set(el, { x: L.pos[i].x, y: L.pos[i].y - 46, opacity: 0 }));
    decorate({ boards: L.boards, labels: [], cents: L.cents }, true);
    const n = els.length, per = 2.8 / n, counter = { i: 0 };
    const tl = TG.intro({ delay: 0.35 });
    els.forEach((el, i) => tl.to(el, { y: L.pos[i].y, opacity: 1, duration: 0.55, ease: 'back.out(1.7)' }, i * per));
    tl.to(counter, { i: n - 1, duration: n * per, ease: 'none', onUpdate() { const yv = B[Math.round(counter.i)][5]; tick.textContent = yv < 2000 ? yv : ''; } }, 0);
    tl.add(() => { tick.textContent = ''; }, '+=0.9').add(() => apply('school', 'flip'), '+=0.1');
  })();

  /* ---------- 1. the schools as streams ---------- */
  (function streams() {
    const box = document.getElementById('tg-stream-box'), svg = d3.select(box.querySelector('svg')), tip = box.querySelector('.tip');
    const W = 820, H = 480, X0 = 1450, X1 = 1980, x = d3.scaleLinear().domain([X0, X1]).range([20, W - 20]);
    svg.attr('viewBox', `0 0 ${W} ${H}`);
    const rows = D.dec.map((dec, i) => Object.fromEntries([['dec', dec], ...FAMS.map((k) => [k, D.streams[k][i]])]));
    const series = d3.stack().keys(FAMS).offset(d3.stackOffsetWiggle).order(d3.stackOrderInsideOut)(rows);
    const lo = d3.min(series, (s) => d3.min(s, (d) => d[0])), hi = d3.max(series, (s) => d3.max(s, (d) => d[1]));
    const y = d3.scaleLinear().domain([lo, hi]).range([H - 62, 70]);
    const area = d3.area().x((d) => x(d.data.dec + 5)).y0((d) => y(d[0])).y1((d) => y(d[1])).curve(d3.curveBasis);
    const defs = svg.append('defs'), clip = defs.append('clipPath').attr('id', 'tg-sclip').append('rect').attr('x', 0).attr('y', 0).attr('height', H).attr('width', 0);
    const hatch = defs.append('pattern').attr('id', 'tg-hatch').attr('width', 6).attr('height', 6).attr('patternUnits', 'userSpaceOnUse').attr('patternTransform', 'rotate(45)');
    hatch.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 6).attr('stroke', TG.css('--ink')).attr('stroke-opacity', 0.18).attr('stroke-width', 2);
    // axis and the turning points
    const ax = svg.append('g');
    for (let yr = 1450; yr <= 1950; yr += 50) ax.append('text').attr('class', 'ax').attr('x', x(yr)).attr('y', H - 34).attr('text-anchor', 'middle').text(yr);
    ax.append('line').attr('x1', x(X0)).attr('x2', x(X1)).attr('y1', H - 50).attr('y2', H - 50).attr('stroke', TG.css('--rule'));
    const EVS = [[1545, 1563, 'Trent'], [1597, 1607, 'De auxiliis'], [1653, 1653, 'Cum occasione'], [1682, 1682, 'Gallican Articles'], [1773, 1814, 'Jesuits suppressed'], [1879, 1879, 'Aeterni Patris']];
    const ev = svg.append('g').attr('class', 'ev');
    const evEls = EVS.map(([a, b, t], i) => { const g = ev.append('g').style('opacity', 0); const lane = i % 2 ? 36 : 16;
      if (b > a) g.append('rect').attr('x', x(a)).attr('y', lane + 8).attr('width', Math.max(2, x(b) - x(a))).attr('height', H - 58 - lane - 8).attr('fill', 'url(#tg-hatch)');
      g.append('line').attr('x1', x(a)).attr('x2', x(a)).attr('y1', lane + 6).attr('y2', H - 50);
      g.append('text').attr('x', x(a) + 4).attr('y', lane + 4).text(t); return { g, a }; });
    const g = svg.append('g').attr('clip-path', 'url(#tg-sclip)');
    g.selectAll('path').data(series).join('path').attr('d', area).attr('fill', (s) => fc(s.key)).attr('fill-opacity', 0.92).attr('stroke', TG.css('--paper')).attr('stroke-width', 0.8);
    // a label in each stream where it is widest
    const labs = series.map((s) => { let best = 0, bi = 0; s.forEach((d, i) => { const w = y(d[0]) - y(d[1]); if (w > best) { best = w; bi = i; } });
      const d = s[bi], nm = { thomist: 'Thomists', scotist: 'Scotists', jesuit: 'Jesuits', augustinian: 'Augustinians', secular: 'Seculars', history: 'Councils and historians' }[s.key];
      const lx = clamp(x(d.data.dec + 5), 70, W - 20 - nm.length * 4.2);
      return best > 14 ? { x: lx, y: (y(d[0]) + y(d[1])) / 2 + 5, t: nm, dec: d.data.dec } : null; }).filter(Boolean);
    const placed = labs.map((l) => [l.x - l.t.length * 4, l.y - 13, l.t.length * 8, 17]);
    const free = (bx) => !placed.some((q) => bx[0] < q[0] + q[2] && bx[0] + bx[2] > q[0] && bx[1] < q[1] + q[3] && bx[1] + bx[3] > q[1]);
    const labG = svg.append('g').attr('clip-path', 'url(#tg-sclip)');
    const labEls = labs.map((l) => ({ ...l, el: labG.append('text').attr('class', 'lab').attr('x', l.x).attr('y', l.y).attr('text-anchor', 'middle').text(l.t).style('opacity', 0) }));
    // the best-known writers as points in their stream
    const center = (k, yr) => { const s = series.find((q) => q.key === k), i = clamp(Math.floor((yr - 1450) / 10), 0, D.dec.length - 1), d = s[i]; return [x(yr), (y(d[0]) + y(d[1])) / 2, y(d[0]) - y(d[1])]; };
    const A = D.authors.filter((a) => a.f !== 'history' || a.p > 6000).map((a) => { const start = Math.max(1456, a.y1 - a.y0 > 30 ? a.y0 + 30 : a.y0); const [px, py, th] = center(a.f, Math.min(start, 1975)); return { a, start, px, py: py + (((a.n.length * 7) % 11) - 5) * Math.min(1, th / 30) }; });
    const top = new Set(A.slice().sort((p, q) => q.a.p - p.a.p).slice(0, 13).map((p) => p.a.n).concat(['Domingo Báñez', 'Luis de Molina', 'Cornelius Jansen', 'Jacques-Bénigne Bossuet']));
    const dots = svg.insert('g', () => labG.node());
    A.sort((p, q) => (top.has(q.a.n) - top.has(p.a.n)) || q.a.p - p.a.p);
    const dotEls = A.map((p) => { const gg = dots.append('g').style('opacity', 0).style('cursor', 'pointer');
      gg.append('circle').attr('cx', p.px).attr('cy', p.py).attr('r', top.has(p.a.n) ? 3.6 : 2.2).attr('fill', TG.css('--card')).attr('stroke', TG.css('--ink')).attr('stroke-width', 1.1);
      if (top.has(p.a.n)) { const nm = p.a.n.replace(/^(Francisco|Robert|Luis de|Domingo|Thomas|Cornelius a|Giovanni Domenico|Alfonso|Denis|Jacques-Bénigne|Cornelius|Caesar|Honoré|Emmanuel|Juan José) /, '');
        const w = nm.length * 6 + 4; for (const [dx, dy, anc] of [[6, -5, 'start'], [-6, -5, 'end'], [6, 13, 'start'], [-6, 13, 'end']]) { const bx = [anc === 'start' ? p.px + dx : p.px + dx - w, p.py + dy - 10, w, 13];
          if (free(bx) && bx[0] > 2 && bx[0] + w < W - 2) { placed.push(bx); gg.append('text').attr('class', 'who').attr('x', p.px + dx).attr('y', p.py + dy).attr('text-anchor', anc).text(nm); break; } } }
      gg.on('click', () => explorer && explorer.show(p.a.n)).on('mousemove', (e) => { const r = box.getBoundingClientRect(); tip.innerHTML = `${esc(p.a.n)}<small>${esc(TG.yr(p.a))} · ${esc(famName(p.a.f))}</small>`; tip.hidden = false; tip.style.left = `${Math.min(e.clientX - r.left + 10, r.width - 200)}px`; tip.style.top = `${e.clientY - r.top + 12}px`; }).on('mouseleave', () => { tip.hidden = true; });
      return { ...p, gg }; });
    const nowEl = document.getElementById('tg-now'), nowEv = document.getElementById('tg-now-ev'), nowWho = document.getElementById('tg-now-who');
    const NOTE = { 1450: 'The councils of the fifteenth century and the first Thomists: Gerson, Tostado and Cajetan.', };
    const ev2 = D.events; let lastKey = '';
    function render(yr) {
      clip.attr('width', x(yr));
      evEls.forEach((e) => e.g.style('opacity', yr >= e.a ? 1 : 0));
      labEls.forEach((l) => l.el.style('opacity', yr >= l.dec + 20 ? 1 : 0));
      dotEls.forEach((d) => d.gg.style('opacity', yr >= d.start ? 1 : 0));
      const dec = Math.floor(yr / 10) * 10; nowEl.textContent = `${dec}s`;
      let e = null; ev2.forEach((q) => { if (q[0] <= yr) e = q; });
      const live = D.authors.filter((a) => a.y0 + 25 <= yr && yr <= a.y1 && a.f !== 'history').sort((p, q) => q.p - p.p).slice(0, 9);
      const key = `${dec}|${e && e[0]}|${live.map((a) => a.n).join()}`; if (key === lastKey) return; lastKey = key;
      nowEv.innerHTML = e ? `<b style="font:600 .8rem var(--body);color:var(--rubric)">${e[0]}</b> ${esc(e[1])}: ${esc(e[2])}` : esc(NOTE[1450]);
      nowWho.innerHTML = live.map((a) => `<span><i style="background:${fc(a.f)}"></i>${esc(a.n)}</span>`).join('') || '<span class="small" style="border:0;background:none">No writer of the schools on this shelf is at work.</span>';
    }
    const st = TG.chapter('#tg-streams', 3800, (p, fin) => { render(lerp(1455, 1980, p)); if (fin) summary(); }, { scrub: 0.5 });
    function summary() { // phones and reduced motion: the whole river at once, and its busiest decade
      const tot = D.dec.map((dec, i) => [dec, FAMS.reduce((t, k) => t + D.streams[k][i], 0)]).sort((a, b) => b[1] - a[1])[0];
      const live = D.authors.filter((a) => a.y0 + 25 <= tot[0] + 9 && tot[0] <= a.y1 && a.f !== 'history').sort((p, q) => q.p - p.p).slice(0, 9);
      nowEl.textContent = `${tot[0]}s`; nowEv.textContent = `The busiest decade on the shelf: ${tot[1]} writers at work.`;
      nowWho.innerHTML = live.map((a) => `<span><i style="background:${fc(a.f)}"></i>${esc(a.n)}</span>`).join('');
    }
  })();

  const rgba = (hex, a) => { const h = hex.replace('#', ''), n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
  const tipAt = (tip, box, e, html) => { const r = box.getBoundingClientRect(); tip.innerHTML = html; tip.hidden = false;
    tip.style.left = `${Math.max(0, Math.min(e.clientX - r.left + 12, r.width - 260))}px`; tip.style.top = `${e.clientY - r.top + 14}px`; };
  const tipFor = (tip, box, el, html) => { const r = box.getBoundingClientRect(), b = el.getBoundingClientRect(); tip.innerHTML = html; tip.hidden = false;
    tip.style.left = `${Math.max(0, Math.min(b.left - r.left, r.width - 260))}px`; tip.style.top = `${b.bottom - r.top + 6}px`; };

  /* ---------- 2. the colleges on the map ---------- */
  (function road() {
    const box = document.getElementById('tg-map'), M = TG.map(box, LAND, [[-10, 36.6], [25.6, 55.4]], { parallels: [38, 54], phone: [[-9.5, 37], [18, 53.5]] });
    const cv = TG.canvas(box.querySelector('canvas')), {ctx} = cv, P = D.places;
    const SCH = new Set(D.schools.map((s) => s[0]));
    const J = D.journeys.map((j) => { const pts = j.s.map(([p, yy]) => ({ p, y: yy, ll: P[p] })), born = pts.length > 2 && !SCH.has(pts[0].p); return { ...j, pts, from: born ? pts[1].y - 4 : pts[0].y }; });
    const schools = D.schools.map(([p, yy]) => ({ p, y: yy, ll: P[p], note: D.school_note[p] }));
    const LBL = { Alcalá: [7, 12, 'left'], Madrid: [-7, 12, 'right'], Salamanca: [-7, -6, 'right'], Coimbra: [-7, -6, 'right'], Douai: [-7, -6, 'right'], Louvain: [7, -6, 'left'], Dillingen: [-7, 12, 'right'], Ingolstadt: [7, -6, 'left'] };
    const chron = TG.chronicle(document.getElementById('tg-chron'), D.events, ([yy, e, w]) => `<li><span class="d">${yy}</span><span class="e">${esc(e)}</span><span class="w">${esc(w)}</span></li>`);
    document.getElementById('tg-legend').innerHTML = `${D.fam.filter(([k]) => J.some((j) => j.f === k)).map(([k, n]) => `<span><i style="background:${fc(k)}"></i>${esc(n)}</span>`).join('')}<span><i style="background:transparent;border:1.5px solid var(--ink);border-radius:1px"></i>a university or college</span>`;
    const ribbon = document.getElementById('tg-ribbon'); let year = 1470, lastR = '';
    const curve = (a, b, t) => { const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], k = 0.18, cx = mx - dy * k, cy = my + dx * k, u = 1 - t; return [u * u * a[0] + 2 * u * t * cx + t * t * b[0], u * u * a[1] + 2 * u * t * cy + t * t * b[1]]; };
    function at(j, Y) {
      if (Y < j.from) return null; const pts = j.pts.map((s) => ({ ...s, xy: M.xy(s.ll) })); const trail = [pts[0].xy]; let pos = pts[0].xy, moving = false;
      for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1];
        if (Y >= b.y) { for (let s = 1; s <= 16; s++) trail.push(curve(a.xy, b.xy, s / 16)); pos = b.xy; continue; }
        if (Y > a.y) { const span = Math.max(1, b.y - a.y), travel = Math.min(span, 3), t = clamp((Y - (b.y - travel)) / travel, 0, 1), e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2)**2 / 2;
          for (let s = 1; s <= 16 * e; s++) trail.push(curve(a.xy, b.xy, s / 16)); pos = curve(a.xy, b.xy, e); moving = t > 0 && t < 1; }
        break; }
      return { pos, trail, alive: Y <= pts[pts.length - 1].y + 0.5, moving };
    }
    function render(Y) {
      year = Y; ctx.clearRect(0, 0, cv.W, cv.H); const ink = TG.css('--ink');
      ctx.font = `italic 12px ${TG.css('--display')}`;
      for (const s of schools) { if (s.y > Y) continue; const [px, py] = M.xy(s.ll), pop = clamp((Y - s.y) / 6, 0, 1), sz = 5 + 2 * (1 - pop);
        ctx.globalAlpha = 0.25 + 0.6 * pop; ctx.strokeStyle = ink; ctx.lineWidth = 1.3; ctx.strokeRect(px - sz / 2, py - sz / 2, sz, sz);
        const [dx, dy, al] = LBL[s.p] || [7, -6, 'left']; ctx.textAlign = al; ctx.fillStyle = ink; ctx.globalAlpha = 0.75 * pop; ctx.fillText(s.p, px + dx, py + dy); ctx.textAlign = 'left'; }
      ctx.globalAlpha = 1; const live = [], boxes = [];
      for (const j of J) { const r = at(j, Y); if (!r) continue; const c = fc(j.f);
        ctx.strokeStyle = c; ctx.lineWidth = r.alive ? 1.8 : 1.1; ctx.globalAlpha = r.alive ? 0.55 : 0.16; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); r.trail.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke();
        if (r.alive) live.push({ j, r, c }); else { ctx.globalAlpha = 0.35; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(r.pos[0], r.pos[1], 1.8, 0, 6.283); ctx.fill(); } }
      for (const { r, c } of live) { const [px, py] = r.pos; ctx.globalAlpha = 0.18; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(px, py, r.moving ? 10 : 7, 0, 6.283); ctx.fill();
        ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(px, py, 4.2, 0, 6.283); ctx.fill(); ctx.strokeStyle = TG.css('--card'); ctx.lineWidth = 1.5; ctx.stroke(); }
      ctx.font = `600 11.5px ${TG.css('--body')}`;
      for (const { j, r, c } of live.sort((a, b) => a.r.pos[1] - b.r.pos[1])) { const [px, py] = r.pos, w = ctx.measureText(j.a).width; let lx = px + 8, ly = py + 4;
        const hit = (bx, by) => boxes.some((b) => bx < b[0] + b[2] && bx + w > b[0] && by - 10 < b[1] + 4 && by + 2 > b[1] - 10);
        if (hit(lx, ly)) lx = px - 8 - w; if (hit(lx, ly)) { lx = px + 8; ly = py + 16; } if (hit(lx, ly)) continue;
        boxes.push([lx, ly, w]); ctx.fillStyle = TG.css('--land'); ctx.globalAlpha = 0.85; ctx.fillRect(lx - 2, ly - 11, w + 4, 14); ctx.globalAlpha = 1; ctx.fillStyle = c; ctx.fillText(j.a, lx, ly); }
      ctx.globalAlpha = 1;
      document.getElementById('tg-year').textContent = Math.round(Y);
      document.getElementById('tg-yearbar').style.width = `${(Y - 1470) / (1890 - 1470) * 100}%`;
      chron(Y);
      const names = live.map(({ j }) => j.a).join('|');
      if (names !== lastR) { lastR = names; ribbon.innerHTML = live.map(({ j, c }) => `<span><i style="background:${c}"></i>${esc(j.a)}</span>`).join('') || `<span class="small" style="border:0;background:none">${Y < 1600 ? 'None of these masters is yet at work.' : 'None of these masters is still living.'}</span>`; }
    }
    M.onfit = () => { cv.size(); render(year); };
    TG.chapter('#tg-road', 4600, (p) => render(lerp(1470, 1890, p)), { scrub: 0.4 });
  })();

  /* ---------- 3. Trent: twenty-five sessions in three periods ---------- */
  (function trent() {
    const T = D.trent, svg = document.getElementById('tg-trent-svg'), W = 760, H = 330, base = 250, X0 = 1545.6, X1 = 1564.1;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const mk = (tag, at, parent = svg) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); parent.appendChild(e); return e; };
    // three periods; inside each the sessions stand evenly in order, the long suspensions are breaks in the line
    const PER = [[1, 10, 'Paul III', '1545–1547'], [11, 16, 'Julius III', '1551–1552'], [17, 25, 'Pius IV', '1562–1563']], GAP = 46, step = (W - 100 - 2 * GAP) / 25;
    const sx = {}; let cx0 = 24;
    PER.forEach(([a, b, pope, yrs], pi) => { const n = b - a + 1, x0 = cx0, x1 = cx0 + n * step;
      mk('rect', { x: x0, y: base - 214, width: x1 - x0, height: 232, fill: TG.css('--paper-2'), rx: 4 });
      mk('line', { x1: x0, x2: x1, y1: base, y2: base, stroke: TG.css('--ink-2'), 'stroke-width': 1 });
      for (let k = a; k <= b; k++) sx[k] = x0 + (k - a + 0.5) * step;
      const t = mk('text', { x: (x0 + x1) / 2, y: base + 32, 'text-anchor': 'middle', class: 'per' }); t.textContent = yrs;
      const t2 = mk('text', { x: (x0 + x1) / 2, y: base + 46, 'text-anchor': 'middle', class: 'per' }); t2.textContent = pope;
      if (pi < 2) { const gx = x1 + GAP / 2, txt = pi === 0 ? 'four years' : 'ten years';
        mk('path', { d: `M${x1 + 6},${base} l6,-5 l6,10 l6,-10 l6,10 l6,-5`, fill: 'none', stroke: TG.css('--muted'), 'stroke-width': 1 });
        const g1 = mk('text', { x: gx, y: base + 32, 'text-anchor': 'middle', class: 'yr' }); g1.textContent = txt; const g2 = mk('text', { x: gx, y: base + 46, 'text-anchor': 'middle', class: 'yr' }); g2.textContent = 'suspended'; }
      cx0 = x1 + GAP; });
    const nowT = mk('text', { x: W - 20, y: 22, 'text-anchor': 'end', class: 'per' }); nowT.textContent = '';
    const S = T.sessions.map(([n, d, t, pl, what]) => { const g = mk('g', { opacity: 0 }), cx = sx[n], bol = pl === 'Bologna';
      if (what && !/council (moves|resumes|reopens|is suspended|opens)/.test(what)) { const short = what.replace(/; the council closes$/, '').replace('Purgatory, the saints, images, indulgences', 'Purgatory, saints, images, indulgences');
        mk('line', { x1: cx, x2: cx, y1: base - 12, y2: base - 22, stroke: TG.css('--rule'), 'stroke-width': 1 }, g);
        const lab = mk('text', { x: cx + 2, y: base - 26, class: 'ses', transform: `rotate(-62 ${cx + 2} ${base - 26})` }, g); lab.textContent = short; }
      mk('circle', { cx, cy: base, r: 9, fill: bol ? TG.css('--gilt') : TG.css('--rubric'), stroke: TG.css('--card'), 'stroke-width': 1.5 }, g);
      const tn = mk('text', { x: cx, y: base + 3.4, 'text-anchor': 'middle', class: 'sesn' }, g); tn.textContent = n;
      const tt = mk('title', {}, g); tt.textContent = `Session ${n} · ${d}${bol ? ' (Bologna)' : ''}${what ? `: ${what}` : ''}`;
      return { g, t, cx, n, d, pl }; });
    const bigY = { set textContent(v) {} };
    const list = document.getElementById('tg-trent-list');
    const evs = T.sessions.filter((s) => s[4]).map(([n, d, t, pl, what]) => [t, n, d, pl, what]);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const human = (d) => { const [yy, m, dd] = d.split('-').map(Number); return `${dd} ${months[m - 1]} ${yy}`; };
    const chron = TG.chronicle(list, evs, ([t, n, d, pl, what]) => `<li><span class="d">Session ${n}</span><span class="e">${esc(what)}</span><span class="w">${human(d)} at ${esc(pl)}</span></li>`);
    let shown = 0;
    function render(t) {
      const n = S.filter((s) => t >= s.t).length; nowT.textContent = n ? `Session ${S[n - 1].n} · ${human(S[n - 1].d)}${S[n - 1].pl === 'Bologna' ? ' · Bologna' : ''}` : '';
      S.forEach((s, i) => { const on = i < n;
        if (on && i >= shown && G) gsap.fromTo(s.g, { opacity: 0, y: -14 }, { opacity: 1, y: 0, duration: 0.5, ease: 'back.out(2)' });
        else if (!on && i < shown) { if (window.gsap) { gsap.killTweensOf(s.g); gsap.set(s.g, { opacity: 0 }); } else s.g.setAttribute('opacity', 0); }
        else if (on && !G) s.g.setAttribute('opacity', 1); });
      shown = n; chron(t);
    }
    TG.chapter('#tg-trent', 3000, (p) => render(lerp(X0, X1, p)), { scrub: 0.4 });
    // the council on the shelf
    const pages = (L) => L.reduce((s, w) => s + w[2], 0), mx = Math.max(...T.acts.map((w) => w[2]), ...T.sarpi.map((w) => w[2]), ...T.pallavicino.map((w) => w[2]));
    const sp = (L, cls) => L.map((w) => `<a class="${cls}" href="${TG.read(w[1])}" target="_blank" rel="noopener" title="${esc(w[0])} · ${fmt(w[2])} pages" style="height:${(24 + 48 * w[2] / mx).toFixed(0)}px"></a>`).join('');
    document.getElementById('tg-onshelf').innerHTML = `
      <div class="card reveal"><h3>The acts of the council</h3><div class="spines">${sp(T.acts, '')}</div><p class="small" style="margin:0">${T.acts.length} volumes and ${fmt(pages(T.acts))} pages of the council’s diaries, acts, letters and treatises.</p></div>
      <div class="card reveal"><h3>Two histories and the councils entire</h3><div class="spines">${sp(T.sarpi, 's')}<span style="width:10px"></span>${sp(T.pallavicino, 'p')}</div>
        <p class="small" style="margin:0">Paolo Sarpi’s history of 1619 is hostile to the papacy. The Jesuit Pietro Sforza Pallavicino answered it in 1656–1657. Mansi’s collection of the councils is a shelf of its own. It runs from the councils of the early Church to those of the Roman Catholic Church, in ${T.mansi.n} volumes and ${fmt(T.mansi.pages)} pages. <a href="${D.councils_guide}" target="_blank" rel="noopener">See the Councils guide</a>.</p></div>`;
  })();

  /* ---------- 4. the Thomists: the Summa, treatise by treatise, one row to a commentary ---------- */
  (function summa() {
    const S = D.summa, host = document.getElementById('tg-sm'), box = host.parentNode, tip = box.querySelector('.tip'), note = document.getElementById('tg-sm-note');
    const T = S.treat, PN = Object.fromEntries(S.parts.map(([k, n]) => [k, n])), ROMP = { Ia: 'Ia', IaIIae: 'Ia IIae', IIaIIae: 'IIa IIae', IIIa: 'IIIa', Suppl: 'Suppl.' };
    const SHORTN = { 'John of St Thomas': 'John of St Th.', 'Diego Ruiz de Montoya': 'Ruiz de Montoya', Salamanticenses: 'Salamant.' };
    const surname = (n) => SHORTN[n] || n.split(' ').pop();
    const rows = S.rows.filter((r) => r.f === 'thomist').concat(S.rows.filter((r) => r.f !== 'thomist'));
    const nTh = rows.filter((r) => r.f === 'thomist').length;
    const cols = []; T.forEach((t, i) => { if (i && T[i - 1][0] !== t[0]) cols.push(null); cols.push(i); });
    const colOf = (ti) => cols.indexOf(ti) + 2; // grid line of a treatise (the name is column 1)
    const maxCell = Math.max(...rows.flatMap((r) => r.cells.map((c) => c[1])));
    const tot = T.map((_, ti) => rows.reduce((s, r) => s + ((r.cells.find((c) => c[0] === ti) || [0, 0])[1]), 0));
    const maxTot = Math.max(...tot);
    const yrs = (r) => (r.y0 ? `${r.y0}–${r.y1}` : '');
    const GW = { shelf: 'not in the volumes on this shelf', never: 'no commentary by this author', open: 'not yet settled' };
    const nShelf = (r) => (r.gaps || []).filter((g) => g[1] === 'shelf').length;
    let html = '<div></div>';
    S.parts.forEach(([k]) => { const tis = T.map((t, i) => [t, i]).filter(([t]) => t[0] === k).map(([, i]) => i);
      html += `<div class="pt" style="grid-column:${colOf(tis[0])} / span ${tis.length}" title="${esc(PN[k])}"><span class="lg">${esc(PN[k])}</span><span class="sh">${ROMP[k]}</span></div>`; });
    const SHORT = { 'Government of the world': 'Government', 'Habits and virtues': 'Virtues', 'Justice and religion': 'Justice', 'Gifts and states of life': 'States of life',
      'Baptism and confirmation': 'Baptism', 'Penance, continued': 'Penance', 'The life of Christ': 'Life of Christ', 'Sacred doctrine': 'Doctrine', 'Extreme unction': 'Unction', 'The last things': 'Last things' };
    const lc = (n) => n.replace(/^The /, 'the ').replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase());
    html += `<div></div>${cols.map((ti) => (ti === null ? '<div></div>' : `<div class="th" role="columnheader" title="${esc(T[ti][3])}"><span>${esc(SHORT[T[ti][3]] || T[ti][3].replace(/^The (.)/, (m, c) => c.toUpperCase()))}</span></div>`)).join('')}`;
    rows.forEach((r, ri) => {
      if (ri === 0) html += '<div class="sep">The Thomists</div>';
      if (ri === nTh) html += '<div class="sep">The Jesuits on the same text</div>';
      const by = Object.fromEntries(r.cells.map((c) => [c[0], c])), gp = Object.fromEntries((r.gaps || []).map((g) => [g[0], g]));
      html += `<div class="who" role="rowheader" data-r="${ri}" title="${esc(r.n)}"><b class="lg">${esc(r.n)}</b><b class="sh">${esc(surname(r.n))}</b><small>${yrs(r)}${yrs(r) ? ' · ' : ''}${fmt(r.p)} pp.</small></div>`;
      html += cols.map((ti) => { if (ti === null) return '<span class="gap"></span>';
        // a blank says why it is blank (10-11, owner: "check that the gaps are legitimate"): hatched = written, in a volume not on this shelf; plain = no commentary
        const c = by[ti], g = gp[ti]; if (!c) return g ? `<span class="c g-${g[1]}" role="cell" data-r="${ri}" data-t="${ti}" data-g="${g[1]}" aria-label="${esc(r.n)} on ${esc(T[ti][3])}: ${GW[g[1]]}. ${esc(g[2])}"></span>` : '<span class="c" role="cell"></span>';
        const a = 0.2 + 0.8 * Math.sqrt(c[1] / maxCell);
        return `<a class="c" role="cell" data-r="${ri}" data-t="${ti}" href="${TG.read(c[2], c[3])}" target="_blank" rel="noopener" aria-label="${esc(r.n)} on ${esc(T[ti][3])}, ${fmt(c[1])} pages"><i style="background:${rgba(fc(r.f), a)}"></i></a>`; }).join('');
    });
    html += `<div class="totl">Pages on each treatise</div>${cols.map((ti) => (ti === null ? '<div></div>' : `<div class="tot" aria-hidden="true"><i data-s="j"></i><i data-s="t"></i></div>`)).join('')}`;
    host.innerHTML = html;
    const size = () => { host.style.gridTemplateColumns = `${host.clientWidth < 700 ? '4.6rem' : '10.5rem'} ${cols.map((c) => (c === null ? '5px' : 'minmax(0, 1fr)')).join(' ')}`; };
    size(); addEventListener('resize', size);
    const who = [...host.querySelectorAll('.who')], cells = rows.map((_, ri) => [...host.querySelectorAll(`a.c[data-r="${ri}"]`)].map((el) => ({ el: el.firstChild, ti: +el.dataset.t })));
    const bars = [...host.querySelectorAll('.tot')].map((el, k) => ({ el, ti: cols.filter((c) => c !== null)[k], j: el.children[0], t: el.children[1] }));
    bars.forEach((b) => { b.j.style.background = fc('jesuit'); b.t.style.background = fc('thomist'); });
    document.querySelectorAll('#tg-sm-key .k-f').forEach((k) => { k.style.background = `linear-gradient(90deg, ${fc('thomist')} 50%, ${fc('jesuit')} 50%)`; });
    const say = (r) => `<b>${esc(r.n)}</b>${yrs(r) ? ` (${yrs(r)})` : ''}: ${fmt(r.p)} pages in ${r.vols} ${r.vols === 1 ? 'volume' : 'volumes'}, on ${r.cells.length} of the ${T.length} treatises.${nShelf(r) ? ` ${nShelf(r)} more ${nShelf(r) === 1 ? 'is' : 'are'} in volumes not on this shelf.` : ''}${r.alt.length ? ` Also on the shelf in another printing: ${r.alt.map((a) => `<a href="${TG.read(a[1])}" target="_blank" rel="noopener">${esc(a[0])}</a>`).join(', ')}.` : ''}`;
    const top = tot.map((v, ti) => [v, ti]).sort((a, b) => b[0] - a[0]);
    const all = rows.reduce((s, r) => s + r.p, 0);
    const final = `<b>${fmt(all)}</b> pages of commentary on the Summa in these ${rows.length} works. The treatises that drew the most pages are ${esc(lc(T[top[0][1]][3]))} (${fmt(top[0][0])}) and ${esc(lc(T[top[1][1]][3]))} (${fmt(top[1][0])}).`;
    let last = -2;
    function render(p, fin) {
      const k = fin ? rows.length + 1 : p * (rows.length + 0.9); let cur = -1;
      const sum = T.map(() => [0, 0]);
      rows.forEach((r, ri) => {
        const o = clamp(k - ri, 0, 1); if (o > 0.15) cur = ri;
        who[ri].style.opacity = 0.3 + 0.7 * Math.min(1, o * 3);
        cells[ri].forEach(({ el, ti }) => { el.style.opacity = clamp((o - (cols.indexOf(ti) / cols.length) * 0.55) * 3, 0, 1); });
        r.cells.forEach((c) => { sum[c[0]][r.f === 'thomist' ? 0 : 1] += c[1] * o; });
      });
      bars.forEach((b) => { const [t, j] = sum[b.ti]; b.t.style.height = `${(44 * t / maxTot).toFixed(1)}px`; b.j.style.height = `${(44 * j / maxTot).toFixed(1)}px`; });
      const done = fin || p > 0.985, now = done ? -1 : cur;
      who.forEach((w, i) => w.classList.toggle('now', i === now));
      const key = done ? 'f' : now; if (key === last) return; last = key;
      note.innerHTML = done ? final : now >= 0 ? say(rows[now]) : 'Thomas Cajetan opens the table.';
    }
    host.addEventListener('mouseover', (e) => { const a = e.target.closest('a.c, .c[data-g]'); if (!a) return; const r = rows[+a.dataset.r], t = T[+a.dataset.t], c = r.cells.find((x) => x[0] === +a.dataset.t);
      if (a.dataset.g) { const g = r.gaps.find((x) => x[0] === +a.dataset.t);
        tipFor(tip, box, a, `${esc(r.n)} on ${esc(lc(t[3]))}: ${GW[g[1]]}<small>${esc(g[2])}</small>`); return; }
      tipFor(tip, box, a, `${esc(r.n)} on ${esc(lc(t[3]))}: ${fmt(c[1])} pages<small>${esc(PN[t[0]])}, questions ${t[1] === t[2] ? t[1] : `${t[1]}–${t[2]}`} · opens at page ${c[3]}</small>`); });
    host.addEventListener('mouseleave', () => { tip.hidden = true; });
    host.addEventListener('focusin', (e) => { const a = e.target.closest('a.c'); if (a) a.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
    TG.chapter('#tg-summa', 3600, (p, fin) => render(p, fin), { scrub: 0.5 });
  })();

  /* ---------- 5. the Scotists: Thomas against Scotus in Rada's controversies, and Mastri against Punch inside the school ---------- */
  (function scotists() {
    const X = D.scot, box = document.getElementById('tg-sc'), svg = box.querySelector('svg'), tip = box.querySelector('.tip'), card = document.getElementById('tg-sc-card');
    const R = X.rada, M = X.mastri, P = X.punch, RS = X.rada_vols, BOOK = ['I', 'II', 'III', 'IV'];
    const mk = (tag, at, parent = svg) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); parent.appendChild(e); return e; };
    const txt = (s, at, parent) => { const t = mk('text', at, parent); t.textContent = s; return t; };
    const brown = fc('scotist'), red = TG.css('--rubric'), ink = TG.css('--ink'), rule = TG.css('--rule');
    const radaP = R.reduce((s, r) => s + r.pp, 0), picks = R.filter((r) => r.pick);
    const mastriP = M.reduce((s, v) => s + v.pages, 0), busiest = M.slice().sort((a, b) => b.hits.length - a.hits.length)[0];
    const STEPS = [
      ['Thomas against Scotus', `Each block is one of Rada’s ${R.length} controversies. Its width is its pages (${fmt(radaP)} in all). The blocks follow the order of the four books of the Sentences.`],
      ['Where they parted', `${['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'][picks.length] || picks.length} of the questions, numbered on the bar and given in Rada’s own headings. Each block opens its controversy.`],
      ['Scotist against Scotist', `Bartolomeo Mastri and John Punch, both Franciscans, wrote rival courses on Scotus. Each mark is a page of Mastri’s eight volumes that names Punch: ${fmt(X.mastri_pages)} pages.`],
      ['Punch replies', `Punch’s Philosophy names Mastri ${fmt(P.mentions)} times. In its second edition he set replies to Mastri after the questions they concerned.`],
      ['Read them', ''],
    ];
    const stepsEl = document.getElementById('tg-scot-steps');
    stepsEl.innerHTML = STEPS.map(([b, p]) => `<li><b>${esc(b)}</b>${p ? `<p>${esc(p)}</p>` : '<p>Open any block or mark in the reader, at its page.</p>'}</li>`).join('');
    const lis = [...stepsEl.children];
    let L = null, cur = -2;
    function draw() {
      const W = Math.max(300, box.clientWidth), small = W < 640; svg.innerHTML = '';
      const gap = 8, x0 = 0, usable = W - 3 * gap, sx = usable / radaP;
      const top = 52, barH = small ? 30 : 36;
      const g1 = mk('g', { class: 'g-rada' });
      txt(small ? `Rada · ${R.length} controversies` : `Juan de Rada · ${R.length} controversies between Thomas and Scotus`, { x: 0, y: 12, class: 'cap' }, g1);
      let x = x0; const segs = [], books = [];
      BOOK.forEach((_, bi) => { const bx = x, gB = mk('g', {}, g1);
        R.filter((r) => RS[r.v][0] === RS[bi][0]).forEach((r) => { const w = Math.max(1, r.pp * sx), g = mk('g', { class: 'seg', tabindex: 0, role: 'link', 'aria-label': `${r.q}, ${r.pp} pages` }, gB);
          const rc = mk('rect', { x: x + 0.5, y: top, width: Math.max(0.6, w - 1), height: barH, fill: brown, rx: 1 }, g);
          segs.push({ r, g, rc, cx: x + w / 2 }); x += w; });
        books.push({ gB, bx, ex: x }); x += gap; });
      books.forEach(({ bx, ex }, bi) => { const n = R.filter((r) => RS[r.v][0] === RS[bi][0]).length;
        txt(`Book ${BOOK[bi]}`, { x: bx, y: top + barH + 16, class: 'lab' }, g1); if (ex - bx > (small ? 120 : 90)) txt(`${n} controversies`, { x: bx, y: top + barH + 30, class: 'n' }, g1); });
      // the questions picked out: a numbered mark over each block, the questions themselves in the card
      const gP = mk('g', { class: 'g-picks' });
      segs.filter((s) => s.r.pick).forEach((s, k) => { mk('line', { x1: s.cx, x2: s.cx, y1: top - 1, y2: top - 9, stroke: red, 'stroke-width': 1 }, gP);
        mk('circle', { cx: s.cx, cy: top - 18, r: 9, fill: red }, gP); txt(String(k + 1), { x: s.cx, y: top - 14, 'text-anchor': 'middle', style: 'font:600 10.5px var(--body);fill:#fffdf8' }, gP); });
      // Mastri and Punch: two strips of pages, a mark where each names the other
      const yM = top + barH + (small ? 70 : 96), sh = 14, tk = small ? 16 : 22;
      const placeLab = (rowEnds, x, w, t, y, parent) => { const tw = t.length * 6.2; x = Math.min(x, W - tw); for (let k = 0; k < 2; k++) { if (x >= rowEnds[k] + 6) { rowEnds[k] = x + tw; return txt(t, { x, y: y + k * 12, class: 'n' }, parent); } } return null; };
      const g2 = mk('g', { class: 'g-mastri' });
      txt(small ? `Mastri names Punch: ${fmt(X.mastri_pages)} pages` : `Bartolomeo Mastri names Punch on ${fmt(X.mastri_pages)} pages`, { x: 0, y: yM - tk - 12, class: 'cap' }, g2);
      const gapM = 5, sxM = (W - gapM * (M.length - 1)) / mastriP; let xm = 0; const mParts = [];
      M.forEach((v, vi) => { const w = v.pages * sxM; mk('rect', { x: xm, y: yM, width: w, height: sh, fill: TG.css('--paper-2'), stroke: rule }, g2);
        mParts.push({ v, x: xm, w }); xm += w + gapM; });
      const endsM = [-1e9, -1e9]; mParts.forEach(({ v, x: vx, w }) => placeLab(endsM, vx, w, small ? v.lab.replace('Sentences ', 'Sent. ').split(/,/)[0] : v.lab.replace('Soul, generation, heavens', 'Soul and heavens'), yM + sh + 13, g2));
      const ticksM = mk('g', { class: 'ticks' }, g2);
      let dM = ''; mParts.forEach(({ v, x: vx, w }) => v.hits.forEach((pg) => { const tx = vx + w * (pg - 0.5) / v.pages; dM += `M${tx.toFixed(1)},${yM - 1}v${-tk}`; }));
      mk('path', { d: dM, stroke: brown, 'stroke-width': 1, opacity: 0.85 }, ticksM);
      M.forEach((v, vi) => { const { x: vx, w } = mParts[vi]; const hit = mk('rect', { x: vx, y: yM - tk - 2, width: w, height: tk + sh + 2, fill: 'transparent', style: 'cursor:pointer' }, ticksM);
        hit.addEventListener('mousemove', (e) => tipAt(tip, box, e, `Mastri, ${esc(v.lab)}: ${fmt(v.hits.length)} of ${fmt(v.pages)} pages name Punch<small>Open the volume</small>`));
        hit.addEventListener('mouseleave', () => { tip.hidden = true; }); hit.addEventListener('click', () => open(TG.read(v.slug, v.hits[0]), '_blank', 'noopener')); });
      const phil = mParts.slice(0, 4), theo = mParts.slice(4);
      if (!small) [[phil, 'Philosophy'], [theo, 'Theology on the four books of the Sentences']].forEach(([ps, t]) => { const a = ps[0].x, b = ps[ps.length - 1].x + ps[ps.length - 1].w;
        mk('path', { d: `M${a},${yM + sh + 32} v4 H${b} v-4`, fill: 'none', stroke: TG.css('--muted'), 'stroke-width': 0.8 }, g2); txt(t, { x: a, y: yM + sh + 49, class: 'n', style: 'font-style:italic' }, g2); });
      const yP = yM + sh + (small ? 84 : 112);
      const g3 = mk('g', { class: 'g-punch' });
      txt(small ? `Punch names Mastri: ${fmt(P.mentions)} times` : `John Punch names Mastri ${fmt(P.mentions)} times`, { x: 0, y: yP - tk - 12, class: 'cap' }, g3);
      const parts = P.parts.map(([t, p0], i) => [t, p0, (P.parts[i + 1] ? P.parts[i + 1][1] : P.pages + 1) - p0]);
      const gapP = 4, sxP = (W - gapP * (parts.length - 1)) / parts.reduce((s, q) => s + q[2], 0); let xp = 0; const pParts = [];
      parts.forEach(([t, p0, n], i) => { const w = n * sxP; mk('rect', { x: xp, y: yP, width: w, height: sh, fill: TG.css('--paper-2'), stroke: rule }, g3);
        pParts.push({ t, p0, n, x: xp, w }); xp += w + gapP; });
      const endsP = [-1e9, -1e9]; pParts.forEach((q) => placeLab(endsP, q.x, q.w, q.t, yP + sh + 13, g3));
      const posP = (pg) => { const q = pParts.filter((s) => s.p0 <= pg).pop() || pParts[0]; return q.x + q.w * clamp((pg - q.p0 + 0.5) / q.n, 0, 1); };
      let dP = ''; P.at.forEach((pg) => { dP += `M${posP(pg).toFixed(1)},${yP - 1}v${-tk}`; });
      const ticksP = mk('g', { class: 'ticks' }, g3); mk('path', { d: dP, stroke: fc('scotist'), 'stroke-width': 1, opacity: 0.85 }, ticksP);
      pParts.forEach((s) => { const hit = mk('rect', { x: s.x, y: yP - tk - 2, width: s.w, height: tk + sh + 2, fill: 'transparent', style: 'cursor:pointer' }, ticksP);
        const n = P.at.filter((pg) => pg >= s.p0 && pg < s.p0 + s.n).length;
        hit.addEventListener('mousemove', (e) => tipAt(tip, box, e, `Punch, ${esc(s.t)}: names Mastri ${fmt(n)} times<small>Open the part</small>`));
        hit.addEventListener('mouseleave', () => { tip.hidden = true; }); hit.addEventListener('click', () => open(TG.read(P.slug, s.p0), '_blank', 'noopener')); });
      const H = yP + sh + 34; svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('height', H);
      segs.forEach(({ r, g }) => { const go = () => open(TG.read(RS[r.v][0], r.p), '_blank', 'noopener');
        g.addEventListener('click', go); g.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
        g.addEventListener('mousemove', (e) => tipAt(tip, box, e, `${esc(r.q)}?<small>Book ${BOOK[r.v]} · ${r.pp} pages · open it</small>`));
        g.addEventListener('mouseleave', () => { tip.hidden = true; }); });
      L = { books, gP, g2, g3, segs, ticksM, ticksP, W };
    }
    const qs = `<ol class="qs">${R.filter((r) => r.pick).map((r) => `<li><a href="${TG.read(RS[r.v][0], r.p)}" target="_blank" rel="noopener">${esc(r.q)}?</a> <span class="small">Book ${BOOK[r.v]}</span></li>`).join('')}</ol>`;
    const vlink = (s, t) => `<a href="${TG.read(s)}" target="_blank" rel="noopener">${t}</a>`;
    const cardFor = (i) => {
      if (i <= 0) return `<p>${RS.map(([s, n], k) => `${vlink(s, `Book ${BOOK[k]}`)} <span class="small">${fmt(n)} pp.</span>`).join(' · ')}</p>
        <p class="small">Francisco de Macedo’s <i>Collations of the Doctrine of St Thomas and Scotus</i> compares them in ${X.macedo.reduce((s, m) => s + m[1], 0)} collations: ${X.macedo.map((m, k) => vlink(m[0], `volume ${k + 1}`)).join(', ')}. The first generation of the school is on the Medieval shelf: ${vlink(X.bassolis[0], 'Joannes de Bassolis')}, a pupil of Scotus at Paris, on the four books.</p>`;
      if (i === 1) return qs;
      if (i === 2) return `<p>Mastri names Punch most often in ${esc(busiest.lab.replace('Sentences', 'his theology on the Sentences, book'))}: ${fmt(busiest.hits.length)} of ${fmt(busiest.pages)} pages.</p><p class="small">${M.map((v) => vlink(v.slug, esc(v.lab))).join(' · ')}</p>`;
      if (i === 3) return `<p>${vlink(P.slug, '<i>Philosophy According to Scotus</i>')}, read in English on this shelf. Punch’s preface says the additions answer “the things contained in the second part of Mastrius’s Metaphysics”.</p>`;
      return `${qs}<p class="small">${vlink(RS[0][0], 'Rada’s Controversies')} · ${vlink(X.macedo[0][0], 'Macedo’s Collations')} · ${vlink(M[4].slug, 'Mastri on the Sentences')} · ${vlink(P.slug, 'Punch’s Philosophy')}</p>`;
    };
    function step(i, instant) {
      if (i === cur && !instant) return; cur = i; lis.forEach((li, j) => li.classList.toggle('now', j === i));
      const anim = G && !instant, T = (el, v, d = 0.6, ex = {}) => (anim ? gsap.to(el, { ...v, duration: d, ease: 'power2.out', ...ex }) : window.gsap ? gsap.set(el, v) : el.setAttribute('opacity', v.opacity));
      L.books.forEach(({ gB, bx }, bi) => T(gB, { scaleX: i >= 0 ? 1 : 0, svgOrigin: `${bx} 0`, opacity: 1 }, 0.7, { delay: bi * 0.12 }));
      L.segs.forEach(({ r, rc }) => rc.setAttribute('fill', i >= 1 && r.pick ? red : brown));
      T(L.gP, { opacity: i >= 1 ? 1 : 0 }); T(L.g2, { opacity: i >= 2 ? 1 : 0 }); T(L.g3, { opacity: i >= 3 ? 1 : 0 });
      [[L.ticksM, 2], [L.ticksP, 3]].forEach(([g, s]) => T(g, { scaleY: i >= s ? 1 : 0, svgOrigin: `0 ${g.getBBox ? (g.getBBox().y + g.getBBox().height) : 0}` }, 0.8, { delay: 0.25 }));
      card.innerHTML = cardFor(i);
      if (anim) gsap.fromTo(card.children, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.05 });
    }
    draw();
    TG.chapter('#tg-scot', 3200, (p, fin) => step(fin ? 4 : p < 0.03 ? -1 : Math.min(4, Math.floor(p * 5)), fin), { scrub: true });
    if (!TG.plays()) lis.forEach((li) => li.classList.add('now'));
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { const c = cur; draw(); cur = -3; step(c, true); }, 180); });
  })();

  /* ---------- 6. the Jesuits: Cornelius a Lapide's commentary over the whole Bible ---------- */
  (function lapide() {
    const X = D.lapide, host = document.getElementById('tg-lp'), box = host.parentNode, tip = box.querySelector('.tip');
    const nEl = document.getElementById('tg-lp-n'), vEl = document.getElementById('tg-lp-v'), slugOf = Object.fromEntries(X.vols.map((v) => [v.v, v.slug]));
    const AB = { Genesis: 'Gen', Exodus: 'Ex', Leviticus: 'Lev', Numbers: 'Num', Deuteronomy: 'Deut', Joshua: 'Josh', Judges: 'Judg', Ruth: 'Ruth', '1 Samuel': '1 Sam', '2 Samuel': '2 Sam',
      '1 Kings': '1 Kgs', '2 Kings': '2 Kgs', '1 Chronicles': '1 Chr', '2 Chronicles': '2 Chr', Ezra: 'Ezra', Nehemiah: 'Neh', Tobit: 'Tob', Judith: 'Jdt', Esther: 'Esth',
      '1 Maccabees': '1 Mac', '2 Maccabees': '2 Mac', Job: 'Job', Psalms: 'Ps', Proverbs: 'Prov', Ecclesiastes: 'Eccl', 'Song of Songs': 'Song', Wisdom: 'Wis', Ecclesiasticus: 'Sir',
      Isaiah: 'Isa', Jeremiah: 'Jer', Lamentations: 'Lam', Baruch: 'Bar', Ezekiel: 'Ezek', Daniel: 'Dan', Hosea: 'Hos', Joel: 'Joel', Amos: 'Amos', Obadiah: 'Obad', Jonah: 'Jon',
      Micah: 'Mic', Nahum: 'Nah', Habakkuk: 'Hab', Zephaniah: 'Zeph', Haggai: 'Hag', Zechariah: 'Zech', Malachi: 'Mal', Matthew: 'Mt', Mark: 'Mk', Luke: 'Lk', John: 'Jn', Acts: 'Acts',
      Romans: 'Rom', '1 Corinthians': '1 Cor', '2 Corinthians': '2 Cor', Galatians: 'Gal', Ephesians: 'Eph', Philippians: 'Phil', Colossians: 'Col', '1 Thessalonians': '1 Th',
      '2 Thessalonians': '2 Th', '1 Timothy': '1 Tim', '2 Timothy': '2 Tim', Titus: 'Tit', Philemon: 'Phm', Hebrews: 'Heb', James: 'Jas', '1 Peter': '1 Pet', '2 Peter': '2 Pet',
      '1 John': '1 Jn', '2 John': '2 Jn', '3 John': '3 Jn', Jude: 'Jude', Apocalypse: 'Apoc' };
    const max = Math.max(...X.books.map((b) => b.pp)), total = X.books.reduce((s, b) => s + b.pp, 0), withP = X.books.filter((b) => b.pp);
    host.innerHTML = X.sections.map((sec) => `<div class="row" role="row"><div class="sec" role="rowheader">${esc(sec)}</div>${X.books.filter((b) => b.s === sec).map((b) => {
      const inner = `<b>${esc(AB[b.b] || b.b)}</b><span class="well"><i></i></span><small>${b.pp ? fmt(b.pp) : ''}</small>`;
      return b.pp ? `<a class="bk" role="cell" href="${TG.read(slugOf[b.at[0][0]], b.at[0][1])}" target="_blank" rel="noopener" aria-label="${esc(b.b)}, ${fmt(b.pp)} pages" data-b="${esc(b.b)}">${inner}</a>`
        : `<span class="bk none" role="cell" aria-label="${esc(b.b)}: not in the commentary on this shelf" data-b="${esc(b.b)}">${inner}</span>`; }).join('')}</div>`).join('');
    const tiles = [...host.querySelectorAll('.bk')].map((el) => ({ el, b: X.books.find((x) => x.b === el.dataset.b), bar: el.querySelector('.well i') }));
    host.addEventListener('mouseover', (e) => { const el = e.target.closest('.bk'); if (!el) return; const b = X.books.find((x) => x.b === el.dataset.b);
      tipFor(tip, box, el, b.pp ? `${esc(b.b)}: ${fmt(b.pp)} pages<small>${b.at.map(([v, p]) => `vol. ${v}, p. ${p}`).join('; ')}${b.alt.length ? ` · printed again in vol. ${b.alt.map((a) => a[0]).join(', ')}` : ''}</small>` : `${esc(b.b)}<small>No commentary on this book in the twenty-one volumes</small>`); });
    host.addEventListener('mouseleave', () => { tip.hidden = true; });
    const listB = (bs) => (bs.length > 1 ? `${bs.slice(0, -1).join(', ')} and ${bs[bs.length - 1]}` : bs[0] || '');
    document.getElementById('tg-lp-others').innerHTML = `Also on the shelf in other printings: ${X.others.map(([t, s, n, v]) => `<a href="${TG.read(s)}" target="_blank" rel="noopener">${esc(t)}</a>${v ? ` (${esc(v)})` : ''}`).join('; ')}.`;
    const longest = withP.slice().sort((a, b) => b.pp - a.pp);
    let lastKey = '';
    function render(p, fin) {
      const t = fin ? X.vols.length : p * (X.vols.length + 0.6); let sum = 0;
      const vNow = clamp(Math.floor(t) + 1, 1, X.vols.length), done = fin || t >= X.vols.length;
      tiles.forEach(({ el, b, bar }) => { if (!b.pp) return; let got = 0; b.at.forEach(([v, , pp]) => { got += pp * ease(clamp(t - (v - 1), 0, 1)); });
        sum += got; bar.style.transform = `scaleY(${(got / max).toFixed(4)})`; el.classList.toggle('now', !done && b.at.some(([v]) => v === vNow)); });
      nEl.textContent = fmt(Math.round(done ? total : sum));
      const key = done ? 'f' : vNow; if (key === lastKey) return; lastKey = key;
      if (done) { vEl.innerHTML = `pages on ${withP.length} books of the Bible. Lapide wrote on every book but Job and the Psalms. The longest commentaries are on ${esc(longest[0].b)} (${fmt(longest[0].pp)} pages) and ${esc(longest[1].b)} (${fmt(longest[1].pp)}).`; return; }
      const v = X.vols[vNow - 1];
      vEl.innerHTML = `pages so far. <a href="${TG.read(v.slug)}" target="_blank" rel="noopener">Volume ${v.v}</a> of ${X.vols.length}: ${esc(listB(v.books))}.`;
    }
    TG.chapter('#tg-lap', 3400, (p, fin) => render(p, fin), { scrub: 0.5 });
  })();

  /* ---------- 7. Suárez: four volumes open into fifty-four disputations ---------- */
  (function suarez() {
    const X = D.dm, box = document.getElementById('tg-dm-box'), svg = box.querySelector('svg'), tip = box.querySelector('.tip'), card = document.getElementById('tg-dm-card');
    const W = 760, H = 470, base = 340, gapG = 7, left = 18, right = 18;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const groupOf = (n) => X.groups.findIndex(([a, b]) => n >= a && n <= b);
    const nG = X.groups.length, cw = (W - left - right - gapG * (nG - 1)) / X.disp.length;
    const xs = X.disp.map((d) => left + (d.n - 1) * cw + groupOf(d.n) * gapG);
    const maxpp = Math.max(...X.disp.map((d) => d.pp)), hh = (pp) => 6 + 236 * pp / maxpp;
    const GC = ['#6b4632', '#8a5a2b', '#a07c35', '#a3382a', '#2f4a6b', '#5b6b3a', '#6d4c7d'];
    const mk = (tag, at, parent = svg) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); parent.appendChild(e); return e; };
    // the four volumes on the shelf
    const volMax = Math.max(...X.vols.map((v) => v.pages));
    const vols = X.vols.map((v, i) => { const x0 = xs[v.from - 1], x1 = xs[v.to - 1] + cw, h = 60 + 220 * v.pages / volMax, gg = mk('g', { class: 'vol' });
      mk('rect', { x: x0 + 2, y: base - h, width: x1 - x0 - 4, height: h, rx: 3, fill: '#5c3a2a' }, gg);
      mk('rect', { x: x0 + 8, y: base - h + 14, width: x1 - x0 - 16, height: 3, fill: '#a07c35' }, gg); mk('rect', { x: x0 + 8, y: base - 22, width: x1 - x0 - 16, height: 3, fill: '#a07c35' }, gg);
      const t = mk('text', { x: (x0 + x1) / 2, y: base - h + 46, 'text-anchor': 'middle', class: 'vl' }, gg); t.textContent = ['I', 'II', 'III', 'IV'][i];
      const s = mk('text', { x: (x0 + x1) / 2, y: base - h + 66, 'text-anchor': 'middle', class: 'vs' }, gg); s.textContent = `Disputations ${v.from}–${v.to}`;
      const s2 = mk('text', { x: (x0 + x1) / 2, y: base - h + 82, 'text-anchor': 'middle', class: 'vs' }, gg); s2.textContent = `${fmt(v.pages)} pages`;
      return gg; });
    const cols = X.disp.map((d, i) => { const gg = mk('g', { class: 'col', tabindex: 0, role: 'link', 'aria-label': `Disputation ${d.n}: ${d.s}, ${d.pp} pages` });
      const r = mk('rect', { x: xs[i] + 1, y: base - hh(d.pp), width: Math.max(2, cw - 2), height: hh(d.pp), rx: 1.5, fill: '#5c3a2a' }, gg);
      if (d.n % 5 === 0 || d.n === 1 || d.n === 54) { const t = mk('text', { x: xs[i] + cw / 2, y: base + 13, 'text-anchor': 'middle', class: 'num' }, gg); t.textContent = d.n; }
      return { gg, r, d }; });
    cols.forEach(({ gg, d }) => {
      const go = () => { const a = document.createElement('a'); a.href = TG.read(d.slug, d.page); a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); };
      gg.addEventListener('click', go); gg.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
      gg.addEventListener('mousemove', (e) => { const b = box.getBoundingClientRect(); tip.innerHTML = `Disputation ${d.n}: ${esc(d.s)}<small>${esc(d.t)} · ${d.pp} pages in ${d.secs.length} sections · open it</small>`; tip.hidden = false;
        tip.style.left = `${Math.min(e.clientX - b.left + 12, b.width - 260)}px`; tip.style.top = `${e.clientY - b.top + 14}px`; });
      gg.addEventListener('mouseleave', () => { tip.hidden = true; }); });
    // the two parts and the order of the questions
    const parts = mk('g', { opacity: 0 }), pY = base - hh(maxpp) - 26;
    [[1, 27, 'Part one · being in general'], [28, 54, 'Part two · the kinds of being']].forEach(([a, b, t]) => { const x0 = xs[a - 1], x1 = xs[b - 1] + cw;
      mk('path', { d: `M${x0},${pY + 10} V${pY} H${x1} V${pY + 10}`, fill: 'none', stroke: TG.css('--ink-2'), 'stroke-width': 1 }, parts);
      const tt = mk('text', { x: (x0 + x1) / 2, y: pY - 8, 'text-anchor': 'middle', class: 'part' }, parts); tt.textContent = t; });
    const grps = mk('g', { opacity: 0 });
    const laneEnd = [-1e9, -1e9, -1e9];
    X.groups.forEach(([a, b, t], gi) => { const x0 = xs[a - 1], x1 = xs[b - 1] + cw, yb = base + 22, w = t.length * 6.4;
      mk('rect', { x: x0 + 1, y: yb, width: x1 - x0 - 2, height: 5, fill: GC[gi], rx: 1 }, grps);
      const cx = clamp((x0 + x1) / 2, left + w / 2, W - right - w / 2); let lane = 0; while (lane < 2 && cx - w / 2 < laneEnd[lane] + 8) lane++; laneEnd[lane] = cx + w / 2;
      const lab = mk('text', { x: cx, y: yb + 21 + lane * 15, 'text-anchor': 'middle', class: 'grp' }, grps); lab.textContent = t; });
    const longest = X.disp.reduce((m, d) => (d.pp > m.pp ? d : m), X.disp[0]), focus = X.disp[28];
    const ROMN = (n) => { let s = ''; for (const [v, r] of [[50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]) while (n >= v) { s += r; n -= v; } return s; };
    const STEPS = [
      ['Four volumes', `On the shelf the Disputations fill four volumes. Together they run to ${fmt(X.vols.reduce((t, v) => t + v.pages, 0))} pages.`],
      ['Fifty-four disputations', `Each column is one disputation. Its height shows its pages. The longest is Disputation ${ROMN(longest.n)} (${longest.s}) at ${longest.pp} pages.`],
      ['Two parts', 'Suárez’s own plan has two parts. The first treats being in general with its unity, truth and goodness and its causes. The second treats the kinds of being from God down to the nine accidents.'],
      ['The order of the questions', 'The questions run from being and its properties to the four causes, God, created substance and the accidents one by one. The beings of reason come last.'],
      ['Inside a disputation', `Each disputation is cut into sections. Each section is cut into numbered paragraphs. Disputation ${ROMN(focus.n)} asks whether God can be known to exist by natural reason.`],
      ['Read it', ''],
    ];
    const stepsEl = document.getElementById('tg-dm-steps');
    stepsEl.innerHTML = STEPS.map(([b, p]) => `<li><b>${esc(b)}</b>${p ? `<p>${esc(p)}</p>` : '<p>Open any column to go to that disputation in the reader. The Latin stands beside the English.</p>'}</li>`).join('');
    const lis = [...stepsEl.children];
    const cardFor = (i) => {
      if (i === 0) return `<p class="eyebrow">Francisco Suárez · Salamanca, 1597</p><h3>Metaphysical Disputations</h3><p class="small">${X.vols.map((v, k) => `<a href="${TG.read(v.slug)}" target="_blank" rel="noopener">Volume ${k + 1}: disputations ${v.from}–${v.to}</a> · ${fmt(v.pages)} pages`).join('<br>')}</p>`;
      if (i === 1) return `<p class="eyebrow">The longest</p><h3><a href="${TG.read(longest.slug, longest.page)}" target="_blank" rel="noopener">Disputation ${ROMN(longest.n)}</a></h3><p>${esc(longest.t)}</p><p class="small">${longest.pp} pages in ${longest.secs.length} sections</p>`;
      if (i === 2) return `<p class="eyebrow">The plan</p><h3>Being, then the kinds of being</h3><p>Disputations 1 to 27 treat being as such. Disputations 28 to 53 divide it into infinite and finite and into substance and accident. The 54th treats the beings of reason. These exist only in the mind.</p>`;
      if (i === 3) return `<p class="eyebrow">The order</p><h3>From being to the nine accidents</h3><p>${X.groups.map(([a, b, t], gi) => `<span style="white-space:nowrap"><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${GC[gi]};margin-right:5px"></i>${esc(t)} (${a === b ? a : `${a}–${b}`})</span>`).join(' · ')}</p>`;
      const d = focus;
      return `<p class="eyebrow">Disputation ${ROMN(d.n)} · ${d.pp} pages</p><h3><a href="${TG.read(d.slug, d.page)}" target="_blank" rel="noopener">${esc(d.t)}</a></h3><ol>${d.secs.map(([t, p]) => `<li><a href="${TG.read(d.slug, p)}" target="_blank" rel="noopener">${esc(t.replace(/^[IVXL]+\.\s*/, ''))}</a> <span class="small">p. ${p}</span></li>`).join('')}</ol>`;
    };
    let cur = -1;
    function step(i, instant) {
      if (i === cur) return; const prev = cur; cur = i; lis.forEach((li, j) => li.classList.toggle('now', j === i));
      const anim = G && !instant, T = (el, v, d = 0.6, extra = {}) => (anim ? gsap.to(el, { ...v, duration: d, ease: 'power3.out', ...extra }) : window.gsap ? gsap.set(el, v) : Object.assign(el.style, { opacity: v.opacity }));
      vols.forEach((v, k) => T(v, { opacity: i === 0 ? 1 : 0, scaleY: i === 0 ? 1 : 0.2, transformOrigin: '50% 100%' }, 0.6, { delay: i === 0 ? 0 : k * 0.04 }));
      cols.forEach(({ gg, r, d }, k) => {
        const show = i >= 1, fill = i >= 3 ? GC[groupOf(d.n)] : '#5c3a2a', dim = i >= 4 && d.n !== focus.n;
        const vi = X.vols.findIndex((v) => d.n >= v.from && d.n <= v.to), vc = (xs[X.vols[vi].from - 1] + xs[X.vols[vi].to - 1] + cw) / 2;
        if (anim && show && prev < 1) gsap.fromTo(gg, { scaleY: 0.05, opacity: 1, svgOrigin: `${xs[k] + cw / 2} ${base}`, x: (vc - xs[k]) * 0.55 },
          { scaleY: 1, x: 0, duration: 1.0, ease: 'expo.out', delay: 0.15 + (k - (X.vols[vi].from - 1)) * 0.025 + vi * 0.05 });
        else T(gg, { opacity: show ? (dim ? 0.22 : 1) : 0, scaleY: show ? 1 : 0.05, x: 0, svgOrigin: `${xs[k] + cw / 2} ${base}` }, 0.5);
        r.setAttribute('fill', i >= 4 && d.n === focus.n ? TG.css('--rubric') : fill);
      });
      T(parts, { opacity: i >= 2 ? 1 : 0 }); T(grps, { opacity: i >= 3 ? 1 : 0 });
      card.innerHTML = cardFor(instant && i === 3 ? 4 : i === 5 ? 0 : i);
      if (anim) gsap.fromTo(card.children, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.05 });
    }
    TG.chapter('#tg-dm', 3000, (p, fin) => step(fin ? 3 : Math.min(5, Math.floor(p * 6)), fin), { scrub: true });
    if (!TG.plays()) lis.forEach((li) => li.classList.add('now'));
  })();

  /* ---------- 8. the quarrel over grace: the books on the shelf on either side, and Rome between them ---------- */
  (function grace() {
    const X = D.grace, host = document.getElementById('tg-gr'), yEl = document.getElementById('tg-gr-y'), nowEl = document.getElementById('tg-gr-now');
    const KN = [[1540, 0], [1580, 60], [1660, 380], [1760, 500], [1915, 600]];
    const Y = (y) => { for (let i = 0; i < KN.length - 1; i++) { const [a, ya] = KN[i], [b, yb] = KN[i + 1]; if (y <= b) return ya + (yb - ya) * (clamp(y, a, b) - a) / (b - a); } return KN[KN.length - 1][1]; };
    const items = [
      ...X.books.map((b) => ({ y: b.y, side: b.side === 'moves' ? 'l' : b.side === 'consent' ? 'r' : 'm', html: `<a href="${TG.read(b.slug)}" target="_blank" rel="noopener"><b>${b.y}</b>${esc(b.a)}<i>${esc(b.t)}</i></a>`, c: fc(b.f), say: `${esc(b.a)}, <i>${esc(b.t)}</i>${b.shelf ? ` (the copy on the shelf was printed in ${b.shelf})` : ''}.`, bk: 1 })),
      ...X.rome.map(([a, b, t, w]) => ({ y: a, y1: b, side: 'm', html: /Pistoia/.test(t) && X.pistoia ? `<a href="${TG.read(X.pistoia)}" target="_blank" rel="noopener"><b>${a}</b>${esc(t)}</a>` : `<span class="box"><b>${a === b ? a : `${a}–${String(b).slice(2)}`}</b>${esc(t)}</span>`,
        c: TG.css('--gilt'), say: `${esc(t)}${w ? `. ${esc(w)}` : ''}.`, bk: /Pistoia/.test(t) ? 1 : 0 })),
    ].sort((a, b) => a.y - b.y || (a.side === 'm') - (b.side === 'm'));
    host.innerHTML = `<div class="spine"></div><svg class="lead-svg" aria-hidden="true" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none"></svg><div class="now"></div>${ 
      items.map((it, i) => `<div class="it ${it.side}${it.bk && it.side === 'm' ? ' bk' : ''}" role="listitem" data-i="${i}" style="--c:${it.c}">${it.html}</div>`).join('')}`;
    const els = [...host.querySelectorAll('.it')], lead = host.querySelector('.lead-svg'), nowLine = host.querySelector('.now');
    document.getElementById('tg-gr-key').innerHTML = `${[['thomist', 'Dominicans'], ['augustinian', 'Augustinians'], ['jesuit', 'Jesuits']].map(([k, n]) => `<span><i style="background:${fc(k)}"></i>${n}</span>`).join('')}<span><i style="background:${TG.css('--gilt')}"></i>Rome</span>`;
    let list = false;
    function layout() {
      list = host.clientWidth < 640; host.classList.toggle('list', list);
      lead.innerHTML = ''; host.querySelectorAll('.span,.brk').forEach((e) => e.remove());
      if (list) { host.style.height = ''; els.forEach((el) => { el.style.top = ''; el.style.left = ''; el.style.right = ''; }); return; }
      const W = host.clientWidth, cx = W / 2, end = { l: -1e9, r: -1e9, m: -1e9 };
      items.forEach((it, i) => { const el = els[i], h = el.offsetHeight, want = Y(it.y) - (it.side === 'm' ? 8 : h / 2), top = Math.max(want, end[it.side] + 5); end[it.side] = top + h;
        el.style.top = `${top}px`; if (it.side === 'l') el.style.left = '0'; if (it.side === 'r') el.style.right = '0';
        it.top = top; it.h = h;
        const ns = 'http://www.w3.org/2000/svg', path = document.createElementNS(ns, 'path');
        if (it.side !== 'm') { const ex = it.side === 'l' ? el.offsetWidth : W - el.offsetWidth, mid = top + Math.min(h / 2, 14), sx = it.side === 'l' ? cx - 10 : cx + 10;
          path.setAttribute('d', `M${ex},${mid} H${sx} L${cx},${Y(it.y)}`); }
        else path.setAttribute('d', '');
        path.setAttribute('fill', 'none'); path.setAttribute('stroke', it.c); path.setAttribute('stroke-width', '1'); lead.appendChild(path); it.path = path;
        const dot = document.createElementNS(ns, 'circle'); dot.setAttribute('cx', cx); dot.setAttribute('cy', Y(it.y)); dot.setAttribute('r', it.side === 'm' ? 0 : 2.6); dot.setAttribute('fill', it.c); lead.appendChild(dot); it.dot = dot;
        if (it.y1 && it.y1 > it.y) { const s = document.createElement('div'); s.className = 'span'; s.style.top = `${Y(it.y)}px`; s.style.height = `${Y(it.y1) - Y(it.y)}px`; host.insertBefore(s, host.firstChild); } });
      const brk = document.createElement('div'); brk.className = 'brk'; brk.style.top = `${Y(1762)}px`; brk.title = 'The scale is closer after 1760'; host.appendChild(brk);
      host.style.height = `${Math.max(...items.map((it) => it.top + it.h)) + 6}px`;
    }
    let lastKey = '';
    let lastP = 0;
    function render(p, fin) {
      lastP = fin ? 1 : p; const year = fin ? 1915 : lerp(1545, 1912, p), done = fin || p > 0.985;
      items.forEach((it, i) => { const on = done || list || it.y <= year; els[i].classList.toggle('on', on);
        els[i].style.opacity = on ? 1 : 0; els[i].style.transform = on ? 'none' : `translateX(${it.side === 'l' ? -12 : it.side === 'r' ? 12 : 0}px)`;
        if (it.path) { it.path.style.opacity = on ? 0.45 : 0; it.dot.style.opacity = on ? 1 : 0; } });
      nowLine.style.opacity = done || list ? 0 : 1; nowLine.style.transform = `translateY(${Y(year)}px)`;
      const last = items.filter((it) => it.y <= year).pop();
      yEl.textContent = done ? `${items[0].y}–${X.books[X.books.length - 1].y}` : Math.floor(year);
      const key = done ? 'f' : last ? items.indexOf(last) : -1; if (key === lastKey) return; lastKey = key;
      if (done) { const n = (s) => X.books.filter((b) => b.side === s).length;
        nowEl.innerHTML = `${X.books.length} books on grace are on this shelf. ${n('moves')} argue for grace efficacious of itself and ${n('consent')} for the Jesuit answer. Erath tried to reconcile the two.`; return; }
      nowEl.innerHTML = last ? last.say : 'Before the quarrel: the decrees of Trent on justification, 1547.';
    }
    els.forEach((el) => { el.style.transition = 'opacity 0.35s ease, transform 0.35s ease'; });
    layout(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { layout(); lastKey = ''; render(lastP, lastP >= 1); });
    TG.chapter('#tg-grace', 3400, (p, fin) => render(p, fin), { scrub: 0.4 });
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { layout(); lastKey = ''; render(1, true); }, 180); });
  })();

  /* ---------- 9. merit: the writers between God's acceptance and the work's own worth, and Rome's two acts at the ends ---------- */
  (function merit() {
    const X = D.merit, host = document.getElementById('tg-mr'), rome = document.getElementById('tg-mr-rome'), hEl = document.getElementById('tg-mr-h'), nowEl = document.getElementById('tg-mr-now');
    const col = (f) => (f === 'nominal' ? TG.css('--muted') : fc(f));
    const ST = X.stations, by = (k) => X.writers.filter((w) => w.s === k);
    const q = (w) => (w.lang === 'la' ? `<i lang="la">“${esc(w.q)}”</i>` : `“${esc(w.q)}”`);
    host.innerHTML = `${ST.map(([k], i) => `<div class="chips" style="grid-column:${i + 1}">${by(k).map((w) => `<a class="mc" role="listitem" data-k="${k}" data-n="${esc(w.n)}" href="${TG.read(w.slug, w.p)}" target="_blank" rel="noopener" style="--c:${col(w.f)}" aria-label="${esc(w.n)}, ${esc(w.w)}, page ${w.p}"><b>${esc(w.n)}</b><i>${esc(w.w)}</i><span class="mq">${q(w)}</span></a>`).join('')}</div>`).join('') 
      }<div class="axis" aria-hidden="true"></div>${ST.map(([k, name], i) => `<div class="mname" data-k="${k}" style="grid-column:${i + 1}"><b>${i + 1}</b>${esc(name)}</div>`).join('')}`;
    // on phones the stations stack: each name above its writers
    const stack = () => { const narrow = host.clientWidth < 640; host.querySelectorAll('.chips').forEach((c, i) => { c.style.order = narrow ? 2 * i + 1 : ''; c.style.gridColumn = narrow ? '' : String(i + 1); });
      host.querySelectorAll('.mname').forEach((c, i) => { c.style.order = narrow ? 2 * i : ''; c.style.gridColumn = narrow ? '' : String(i + 1); }); };
    stack(); addEventListener('resize', stack);
    const R = { left: X.rome.filter((r) => r.side === 'left'), right: X.rome.filter((r) => r.side === 'right') };
    rome.innerHTML = ['left', 'right'].map((side) => { const L = R[side]; if (!L.length) return '';
      return `<div class="rc ${side}"><b>${L[0].y} · ${esc(L[0].act)}</b> <span class="arr">${side === 'left' ? '← bounds this end' : 'bounds this end →'}</span>${L.map((r) => `<div><a href="${TG.read(r.slug, r.p)}" target="_blank" rel="noopener">${esc(r.part)}</a>: <i lang="la">“${esc(r.q)}”</i>. ${esc(r.g)}</div>`).join('')}</div>`; }).join('');
    const chips = [...host.querySelectorAll('.mc')], names = [...host.querySelectorAll('.mname')], axis = host.querySelector('.axis'), cards = [...rome.querySelectorAll('.rc')];
    const quotes = (k) => `<ul>${by(k).map((w) => `<li><a href="${TG.read(w.slug, w.p)}" target="_blank" rel="noopener">${esc(w.n)}</a>, ${esc(w.w)}: ${q(w)}</li>`).join('')}</ul>`;
    const dated = X.writers.filter((w) => w.y0).slice().sort((a, b) => a.y0 - b.y0), first = dated[0], last = dated.reduce((m, w) => ((w.y1 || 0) > (m.y1 || 0) ? w : m), dated[0]);
    const words = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty'];
    const final = `<p>${words[X.writers.length] || X.writers.length} writers run from ${esc(first.n)} to ${esc(last.n)}. Each is linked to the page where the question is treated. Trent bounds one end: the works of the justified truly merit. Their reward is rendered according to God’s promise. Pius V bounds the other: no good work merits eternal life by its own nature.</p>`;
    let lastKey = '';
    function render(p, fin) {
      const k = fin ? 99 : p * (ST.length + 2.2), done = fin || k >= ST.length + 1.4;
      axis.style.clipPath = `inset(0 ${((1 - clamp(k, 0, 1)) * 100).toFixed(1)}% 0 0)`;
      ST.forEach(([key], i) => { const on = done || k >= i + 1; names[i].classList.toggle('on', on);
        chips.filter((c) => c.dataset.k === key).forEach((c, j) => { c.style.transitionDelay = on && !fin ? `${j * 70}ms` : '0ms'; c.classList.toggle('on', on); }); });
      cards.forEach((c) => c.classList.toggle('on', done || k >= ST.length + 0.6));
      const cur = done ? 'f' : k < 1 ? 'a' : Math.min(ST.length - 1, Math.floor(k) - 1); if (cur === lastKey) return; lastKey = cur;
      if (cur === 'f') { hEl.textContent = 'Merit on this shelf'; nowEl.innerHTML = final; return; }
      if (cur === 'a') { hEl.textContent = 'Merit'; nowEl.innerHTML = `<p>In the Summa (<a href="${TG.read('aq-st-i-ii-18', 239)}" target="_blank" rel="noopener">I-II q. 114</a>) Thomas asks whether a man in grace can merit eternal life <i>de condigno</i>.</p>`; return; }
      hEl.textContent = `${cur + 1} · ${ST[cur][1]}`; nowEl.innerHTML = quotes(ST[cur][0]) + (ST[cur][0] === 'self' && X.bull ? `<p class="small" style="margin:6px 0 0">In the same disputation Vásquez takes up the objection from Pius V’s bull: <a href="${TG.read(X.bull[0], X.bull[1])}" target="_blank" rel="noopener">chapter 13</a>.</p>` : '');
    }
    // hover or focus a writer: his words in the card
    host.addEventListener('mouseover', (e) => { const a = e.target.closest('.mc'); if (!a || !a.classList.contains('on')) return; const w = X.writers.find((x) => x.n === a.dataset.n);
      chips.forEach((c) => c.classList.toggle('hot', c === a)); hEl.textContent = w.n; nowEl.innerHTML = `<ul><li>${esc(w.w)}, <a href="${TG.read(w.slug, w.p)}" target="_blank" rel="noopener">page ${w.p}</a>: ${q(w)}</li></ul>`; lastKey = 'h'; });
    host.addEventListener('focusin', (e) => { const a = e.target.closest('.mc'); if (a) a.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
    host.addEventListener('mouseleave', () => { chips.forEach((c) => c.classList.remove('hot')); lastKey = ''; render(lastP, lastP >= 1); });
    let lastP = 0;
    TG.chapter('#tg-merit', 3400, (p, fin) => { lastP = fin ? 1 : p; render(p, fin); }, { scrub: 0.4 });
  })();

  /* ---------- explore ---------- */
  explorer = TG.explorer(document.getElementById('tg-explorer'), D, { range: [1360, 1990], first: 'Francisco Suárez', placeholder: 'Suárez, Báñez, grace, Trent…', label: 'Lifelines of the writers on the Roman Catholic shelf' });
  document.getElementById('tg-undated').innerHTML = `Also on the shelf, undated: ${D.undated.map((a) => `<a href="${TG.read(a.w[0][1])}" target="_blank" rel="noopener">${esc(a.n)}</a>`).join(', ')}.`;
  document.getElementById('tg-councils-link').href = D.councils_guide;
  TG.reveal('.tg .reveal');
})();
