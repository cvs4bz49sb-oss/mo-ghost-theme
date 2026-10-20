/* The Medieval shelf guide: rose window, the masters' journeys, the Sentences ledger, an article of the Summa, the glossed law, Aristotle. */
(async () => {
  const method = (html) => (window.TFRMethod ? window.TFRMethod.html(html) : html);
  const {TG} = window, D = await TG.load('data'), LAND = await TG.load('land');
  const { esc, fmt, clamp, ease, lerp } = TG, G = TG.hasG && !TG.reduce ? window.gsap : null;
  const FAMS = D.fam.map((f) => f[0]), fc = (k) => TG.css(`--f${FAMS.indexOf(k) + 1}`), famName = (k) => (D.fam.find((f) => f[0] === k) || [])[1];
  const byName = Object.fromEntries(D.authors.map((a) => [a.n, a]));
  let explorer = null;

  /* ---------- hero: facts, and the shelf as a rose window ---------- */
  const facts = { works: D.n_works, authors: D.authors.length, pages: D.n_pages, sent: D.sent.length };
  document.querySelectorAll('[data-count]').forEach((el) => TG.countUp(el, facts[el.dataset.count], 1.8));
  (function rose() {
    const svg = document.querySelector('.rose svg'), cap = document.querySelector('.rose .cap'), NS = 'http://www.w3.org/2000/svg';
    const A = D.authors.filter((a) => a.y0).slice().sort((a, b) => a.y0 - b.y0 || a.n.localeCompare(b.n)), n = A.length;
    const C = 300, R0 = 78, RMAX = 288, maxP = Math.max(...A.map((a) => a.p)), step = (2 * Math.PI) / n;
    const mk = (tag, at) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); return e; };
    const pt = (r, th) => [C + r * Math.cos(th), C + r * Math.sin(th)];
    const trace = mk('g', { class: 'trace' }); svg.appendChild(trace);
    const rings = [mk('circle', { cx: C, cy: C, r: RMAX + 6, 'stroke-width': 2.2 }), mk('circle', { cx: C, cy: C, r: RMAX + 12, 'stroke-width': 0.8 }), mk('circle', { cx: C, cy: C, r: R0 - 6, 'stroke-width': 1.6 })];
    rings.forEach((c) => trace.appendChild(c));
    // cusps: little arcs on the outer ring between panes, as in a rose's tracery
    const cusps = []; for (let i = 0; i < n; i++) { const th = -Math.PI / 2 + (i + 0.5) * step, [x1, y1] = pt(RMAX + 6, th - step * 0.5), [x2, y2] = pt(RMAX + 6, th + step * 0.5);
      const c = mk('path', { d: `M${x1},${y1} A ${(RMAX + 6) * Math.sin(step / 2) * 1.05} ${(RMAX + 6) * Math.sin(step / 2) * 1.05} 0 0 0 ${x2},${y2}`, 'stroke-width': 0.9, opacity: 0.55 }); trace.appendChild(c); cusps.push(c); }
    const spokes = []; for (let i = 0; i < n; i++) { const th = -Math.PI / 2 + i * step, [x1, y1] = pt(R0 - 6, th), [x2, y2] = pt(RMAX + 6, th);
      const l = mk('line', { x1, y1, x2, y2, 'stroke-width': 0.7, opacity: 0.45 }); trace.appendChild(l); spokes.push(l); }
    const lmax = Math.log(1 + maxP / 40);
    const lancet = (th, rA, rB, half) => { // a pointed lancet between radii rA and rB whose sides follow the spokes
      const w = (r) => r * Math.tan(half), h = Math.min(w(rB) * 2.3, (rB - rA) * 0.5), rs = rB - h;
      const L = (r, s2) => { const off = s2 * w(r); return [C + r * Math.cos(th) - off * Math.sin(th), C + r * Math.sin(th) + off * Math.cos(th)]; };
      const [ax, ay] = L(rA, -1), [bx, by] = L(rs, -1), [tx, ty] = pt(rB, th), [cx, cy] = L(rs, 1), [dx, dy] = L(rA, 1), [q1x, q1y] = L(rs + h * 0.62, -1), [q2x, q2y] = L(rs + h * 0.62, 1);
      return { d: `M${ax},${ay} L${bx},${by} Q${q1x},${q1y} ${tx},${ty} Q${q2x},${q2y} ${cx},${cy} L${dx},${dy} Z`, L, rs };
    };
    const panes = A.map((a, i) => {
      const th = -Math.PI / 2 + (i + 0.5) * step, half = step * 0.4, full = lancet(th, R0, RMAX - 2, half);
      const f = Math.log(1 + a.p / 40) / lmax, r1 = R0 + 30 + (RMAX - 2 - R0 - 30) * f, glass = lancet(th, R0, r1, half);
      const g = mk('g', { class: 'lancet', tabindex: 0, role: 'button', 'aria-label': `${a.n}, ${TG.yr(a)}, ${a.p} pages` });
      g.appendChild(mk('path', { class: 'clear', d: full.d, fill: TG.css('--card') }));
      const col = mk('path', { class: 'glass', d: glass.d, fill: fc(a.f) }); g.appendChild(col);
      const [hx1, hy1] = glass.L(R0 + 6, -0.45), [hx2, hy2] = glass.L(Math.max(R0 + 8, glass.rs - 2), -0.45);
      g.appendChild(mk('path', { class: 'hi', d: `M${hx1},${hy1} L${hx2},${hy2}` }));
      svg.appendChild(g); return { a, g, th, col };
    });
    const leads = mk('g', { class: 'lead' }); [140, 200, 252].forEach((r) => leads.appendChild(mk('circle', { cx: C, cy: C, r }))); svg.appendChild(leads);
    const med = mk('g', {}); svg.appendChild(med);
    med.appendChild(mk('circle', { cx: C, cy: C, r: R0 - 10, fill: TG.css('--card'), stroke: TG.css('--ink'), 'stroke-width': 1 }));
    const yr = mk('text', { x: C, y: C + 8, 'text-anchor': 'middle', class: 'yr num' }); yr.textContent = A[0].y0; med.appendChild(yr);
    const yr2 = mk('text', { x: C, y: C + 28, 'text-anchor': 'middle', class: 'yr2' }); yr2.textContent = 'born'; med.appendChild(yr2);
    // names of the largest writers around the rim
    const big = panes.slice().sort((p, q) => q.a.p - p.a.p).slice(0, 9);
    const labels = big.map(({ a, th }) => { const [x, y] = pt(RMAX + 24, th), right = Math.cos(th) >= 0;
      const t = mk('text', { x, y: y + 4, 'text-anchor': Math.abs(Math.cos(th)) < 0.2 ? 'middle' : right ? 'start' : 'end', class: 'lbl' }); t.textContent = a.n.replace(/^John /, ''); svg.appendChild(t); return t; });
    const say = (p) => {
      if (p) { cap.dataset.m = ''; cap.textContent = `${p.a.n}, ${TG.yr(p.a)} · ${p.a.w.length} ${p.a.w.length === 1 ? 'work' : 'works'}, ${fmt(p.a.p)} pages · ${famName(p.a.f)}`; }
      else if (cap.dataset.m !== '1') { cap.dataset.m = '1'; cap.innerHTML = method('Each pane is a writer. The panes run clockwise from the top in order of birth. The colored glass fills with the pages on the shelf.'); }
    };
    panes.forEach((p) => {
      const on = () => { say(p); yr.textContent = p.a.y0; yr2.textContent = 'born'; };
      p.g.addEventListener('mouseenter', on); p.g.addEventListener('focus', on);
      p.g.addEventListener('click', () => explorer && explorer.show(p.a.n));
      p.g.addEventListener('keydown', (e) => { if (e.key === 'Enter') explorer && explorer.show(p.a.n); });
    });
    svg.addEventListener('mouseleave', () => say(null));
    say(null);
    if (!G) { panes.forEach((p) => { p.g.style.opacity = 1; }); yr.textContent = `${A[0].y0}–${A[n - 1].y1}`; yr.setAttribute('font-size', 24); yr2.textContent = 'the shelf'; return; }
    const draw = (el) => { const L = el.getTotalLength ? el.getTotalLength() : 1000; el.style.strokeDasharray = L; el.style.strokeDashoffset = L; return el; };
    const tl = TG.intro({ delay: 0.25 });
    tl.to(rings.map(draw), { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut', stagger: 0.12 })
      .to(spokes.map(draw), { strokeDashoffset: 0, duration: 0.5, ease: 'power1.out', stagger: 0.012 }, '-=0.9')
      .from(labels, { opacity: 0, duration: 0.6, stagger: 0.05 }, '-=0.2');
    const counter = { i: 0 };
    tl.to(panes.map((p) => p.g), { opacity: 1, duration: 0.6, ease: 'power2.out', stagger: 0.02 }, 0.6)
      .from(leads.children, { opacity: 0, duration: 0.8, stagger: 0.1 }, 0.9)
      .from(panes.map((p) => p.col), { scale: 0, transformOrigin: `${C}px ${C}px`, duration: 0.9, ease: 'power3.out', stagger: 0.07 }, 1.0)
      .to(counter, { i: n - 1, duration: 0.07 * n, ease: 'none', onUpdate() { const p = panes[Math.round(counter.i)]; yr.textContent = p.a.y0; } }, 1.0)
      .to(cusps.map(draw), { strokeDashoffset: 0, duration: 0.4, stagger: 0.02 }, '-=1')
      .add(() => { yr.textContent = `${A[0].y0}`; yr2.textContent = `to ${A[n - 1].y1}`; });
    // then light passes once round the glass, as the sun moves across a rose
    tl.to(panes.map((p) => p.col), { keyframes: [{ filter: 'brightness(1.35) saturate(1.2)', duration: 0.25 }, { filter: 'brightness(1) saturate(1)', duration: 0.6 }], stagger: 0.035 }, '+=0.2');
  })();

  /* ---------- 1. the masters on the road ---------- */
  (function road() {
    const box = document.getElementById('tg-map'), M = TG.map(box, LAND, [[-9, 37.2], [29.5, 56.5]], { parallels: [38, 56], phone: [[-4.5, 39.5], [18, 53.5]] });
    const cv = TG.canvas(box.querySelector('canvas')), {ctx} = cv, P = D.places;
    const SCH = new Set(D.schools.map((x) => x[0]));
    const J = D.journeys.map((j) => { const pts = j.s.map(([p, y]) => ({ p, y, ll: P[p] })), born = pts.length > 2 && !SCH.has(pts[0].p);
      return { ...j, pts, from: born ? pts[1].y - 4 : pts[0].y }; });
    const LBL = { Montpellier: [-7, 12, 'right'], Avignon: [7, 12, 'left'], Toulouse: [-7, -6, 'right'] };
    const schools = D.schools.map(([p, y, what]) => ({ p, y, what, ll: P[p] }));
    const chron = TG.chronicle(document.getElementById('tg-chron'), D.events, ([y, e, w]) => `<li><span class="d">${y}</span><span class="e">${esc(e)}</span><span class="w">${esc(w)}</span></li>`);
    const legend = document.getElementById('tg-legend');
    legend.innerHTML = `${D.fam.filter(([k]) => J.some((j) => j.f === k)).map(([k, n]) => `<span><i style="background:${fc(k)}"></i>${esc(n)}</span>`).join('')}<span><i style="background:transparent;border:1.5px solid var(--ink);border-radius:1px"></i>a school or the papal court</span>`;
    const ribbon = document.getElementById('tg-ribbon');
    let year = 1080, lastRibbon = '';
    const curve = (a, b, t) => { // a gentle arc between two places, bowed to the left of travel
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], k = 0.18;
      const cx = mx - dy * k, cy = my + dx * k, u = 1 - t; return [u * u * a[0] + 2 * u * t * cx + t * t * b[0], u * u * a[1] + 2 * u * t * cy + t * t * b[1]]; };
    function at(j, Y) { // where a master is in year Y, and the path behind him
      const pts = j.pts.map((s) => ({ ...s, xy: M.xy(s.ll) }));
      if (Y < j.from) return null;
      const trail = [pts[0].xy]; let pos = pts[0].xy, moving = false;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        if (Y >= b.y) { for (let s = 1; s <= 16; s++) trail.push(curve(a.xy, b.xy, s / 16)); pos = b.xy; continue; }
        if (Y > a.y) { const span = Math.max(1, b.y - a.y), travel = Math.min(span, 3), t = clamp((Y - (b.y - travel)) / travel, 0, 1); // he stays, then travels in the last years before the next stop
          const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2)**2 / 2; for (let s = 1; s <= 16 * e; s++) trail.push(curve(a.xy, b.xy, s / 16)); pos = curve(a.xy, b.xy, e); moving = t > 0 && t < 1; }
        break;
      }
      return { pos, trail, alive: Y <= pts[pts.length - 1].y + 0.5, moving };
    }
    function render(Y) {
      year = Y; ctx.clearRect(0, 0, cv.W, cv.H); const ink = TG.css('--ink'), rub = TG.css('--rubric'), font = TG.css('--body');
      // schools
      ctx.font = `italic 12px ${TG.css('--display')}`;
      for (const s of schools) { if (s.y > Y) continue; const [x, y] = M.xy(s.ll), pop = clamp((Y - s.y) / 6, 0, 1), sz = 5 + 2 * (1 - pop);
        ctx.globalAlpha = 0.25 + 0.6 * pop; ctx.strokeStyle = ink; ctx.lineWidth = 1.3; ctx.strokeRect(x - sz / 2, y - sz / 2, sz, sz);
        const [dx, dy, al] = LBL[s.p] || [7, -6, 'left']; ctx.textAlign = al; ctx.fillStyle = ink; ctx.globalAlpha = 0.75 * pop; ctx.fillText(s.p, x + dx, y + dy); ctx.textAlign = 'left'; }
      ctx.globalAlpha = 1;
      const live = [], boxes = [];
      for (const j of J) { const r = at(j, Y); if (!r) continue; const c = fc(j.f);
        ctx.strokeStyle = c; ctx.lineWidth = r.alive ? 1.8 : 1.1; ctx.globalAlpha = r.alive ? 0.55 : 0.16; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); r.trail.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
        if (r.alive) live.push({ j, r, c });
        else { ctx.globalAlpha = 0.35; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(r.pos[0], r.pos[1], 1.8, 0, 6.283); ctx.fill(); } }
      for (const { j, r, c } of live) { const [x, y] = r.pos;
        ctx.globalAlpha = 0.18; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r.moving ? 10 : 7, 0, 6.283); ctx.fill();
        ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(x, y, 4.2, 0, 6.283); ctx.fill(); ctx.strokeStyle = TG.css('--card'); ctx.lineWidth = 1.5; ctx.stroke(); }
      ctx.font = `600 11.5px ${font}`;
      for (const { j, r, c } of live.sort((a, b) => a.r.pos[1] - b.r.pos[1])) { const [x, y] = r.pos, w = ctx.measureText(j.a).width;
        let lx = x + 8, ly = y + 4; const hit = (bx, by) => boxes.some((b) => bx < b[0] + b[2] && bx + w > b[0] && by - 10 < b[1] + 4 && by + 2 > b[1] - 10);
        if (hit(lx, ly)) { lx = x - 8 - w; } if (hit(lx, ly)) { lx = x + 8; ly = y + 16; } if (hit(lx, ly)) continue;
        boxes.push([lx, ly, w]); ctx.fillStyle = TG.css('--land'); ctx.globalAlpha = 0.85; ctx.fillRect(lx - 2, ly - 11, w + 4, 14); ctx.globalAlpha = 1; ctx.fillStyle = c; ctx.fillText(j.a, lx, ly); }
      ctx.globalAlpha = 1;
      document.getElementById('tg-year').textContent = Math.round(Y);
      document.getElementById('tg-yearbar').style.width = `${(Y - 1080) / (1500 - 1080) * 100}%`;
      chron(Y);
      const names = live.map(({ j }) => j.a).join('|');
      if (names !== lastRibbon) { lastRibbon = names; ribbon.innerHTML = live.map(({ j, c }) => `<span><i style="background:${c}"></i>${esc(j.a)}</span>`).join('') || `<span class="small" style="border:0;background:none">${Y < 1290 ? 'No master on this shelf is at work yet.' : 'No master on this shelf is still at work.'}</span>`; }
    }
    M.onfit = () => { cv.size(); render(year); };
    TG.chapter('#tg-road', 4600, (p) => render(lerp(1080, 1500, p)), { scrub: 0.4 });
  })();

  /* ---------- 2. the Sentences: a ledger of commentaries, book by book ---------- */
  (function sentences() {
    const L = D.lombard, host = document.getElementById('tg-ledger');
    document.getElementById('tg-lombard').href = TG.read(L.slug, L.col);
    document.getElementById('tg-sicnon').href = TG.read('peter-abelard-peter-abelard-sic-et-non');
    document.getElementById('tg-halensis').href = TG.read('alexander-of-hales-alexander-of-hales-summa-universae-theologiae-summa');
    const max = Math.max(...D.sent.flatMap((s) => s.b)), roman = ['I', 'II', 'III', 'IV'];
    host.innerHTML = `<div class="bk" role="columnheader"><span style="min-height:0">Commentary</span></div>${L.books.map((b, i) => `<div class="bk" role="columnheader"><b>${roman[i]}</b><span>${esc(b)}</span></div>`).join('') 
      }${D.sent.map((s, r) => `<div class="row" role="row" data-r="${r}"><div class="who" role="rowheader"><b>${esc(s.a)}</b><small>${esc(s.lab)}</small></div>${ 
        s.b.map((n, i) => `<div class="cell" role="cell">${n ? `<a href="${TG.read(s.s[i])}" target="_blank" rel="noopener" aria-label="${esc(s.a)}, book ${roman[i]}, ${fmt(n)} pages" style="width:${(6 + 72 * Math.sqrt(n / max)).toFixed(1)}%;background:${fc(s.f)}"></a><small>${fmt(n)}</small>` : '<small>·</small>'}</div>`).join('')}</div>`).join('')}`;
    const rows = [...host.querySelectorAll('.row')].map((row) => ({ row, kids: [...row.children], bars: [...row.querySelectorAll('.cell a')] }));
    const total = D.sent.reduce((t, s) => t + s.b.reduce((u, v) => u + v, 0), 0), nEl = document.getElementById('tg-sent-n'), note = document.getElementById('tg-sent-note');
    const scotus = D.sent.find((s) => /Scotus/.test(s.a)), scot = scotus ? scotus.b.reduce((a, b) => a + b, 0) : 0;
    function render(p) {
      const k = p * (rows.length + 0.6); let sum = 0, cur = -1;
      rows.forEach((R, i) => { const o = clamp(k - i, 0, 1), g = ease(clamp((k - i - 0.15) / 0.85, 0, 1));
        R.kids.forEach((c) => { c.style.opacity = 0.08 + 0.92 * o; });
        R.bars.forEach((b) => { b.style.transform = `scaleX(${g})`; });
        sum += D.sent[i].b.reduce((a, b) => a + b, 0) * g; if (o > 0.5) cur = i; });
      rows.forEach((R, i) => R.row.classList.toggle('now', i === cur && p < 1));
      nEl.textContent = fmt(Math.round(sum));
      note.textContent = p >= 0.999 ? `pages of commentary on the four books. Scotus alone fills ${fmt(scot)}. Gregory of Rimini and Baconthorpe are here for the first book only.` : 'pages of commentary';
    }
    TG.chapter('#tg-sent', 3200, render, { scrub: 0.5 });
  })();

  /* ---------- 3. how a question is argued ---------- */
  (function article() {
    const A = D.article, {la} = A, {en} = A, host = document.querySelector('#tg-article .grid'), arrows = document.querySelector('#tg-article svg.arrows');
    // MereO fix (Ian, 2026-10-11): the first step, The question, reads la.title / en.title, which the data does not carry,
    // and both excerpt lanes printed "undefined". The heading block's own words.
    if (la.title == null) la.title = 'Utrum Deus sit.';
    if (en.title == null) en.title = 'Whether God exists.';
    const first = (s, n) => { const w = s.split(/\s+/); return w.slice(0, n).join(' ') + (w.length > n ? ' …' : ''); };
    const tail = (s) => { const m = s.match(/(?:[,;]\s*)((?:et hoc|quam|quod)[^,;.]*Deum[^.]*)\.?\s*$/i); return m ? m[1] : ''; };
    const NAMES = ['Motion', 'Causes', 'What can and must be', 'Degrees', 'Order'];
    const ways = ['co2', 'co3', 'co4', 'co5', 'co6'].map((k, i) => ({ k, name: NAMES[i], la: first(la[k].replace(/^(Prima|Secunda|Tertia|Quarta|Quinta)[^.]*?(est|sumitur)[^.,]*/i, (m) => m), 9), end: tail(la[k]) }));
    host.innerHTML = `
      <div class="blk title" data-s="0"><span class="k">Article 3</span><span class="la">Utrum Deus sit</span><span class="en">Whether God exists</span></div>
      <div class="blk arg" data-s="1" data-k="arg1"><span class="k">Objection 1</span><span class="la">${esc(first(la.arg1.replace(/^Ad tertium sic proceditur\.\s*/, ''), 12))}</span><span class="en">${esc(first(en.arg1.replace(/^Objection 1\.\s*/, ''), 14))}</span></div>
      <div class="blk arg" data-s="1" data-k="arg2"><span class="k">Objection 2</span><span class="la">${esc(first(la.arg2, 12))}</span><span class="en">${esc(first(en.arg2.replace(/^Objection 2\.\s*/, ''), 14))}</span></div>
      <div class="blk sc" data-s="2" data-k="sc"><span class="k">On the contrary</span><span class="la">${esc(la.sc)}</span><span class="en">${esc(en.sc.replace(/^On the contrary,\s*/, ''))}</span></div>
      <div class="blk co" data-s="3" data-k="co1"><span class="k">I answer that</span><span class="la">${esc(la.co1)}</span><span class="en">${esc(en.co1.replace(/^I answer that,\s*/, ''))}</span></div>
      <div class="ways" data-s="3">${ways.map((w, i) => `<div class="way" data-k="${w.k}"><b>${i + 1}. ${esc(w.name)}</b><span class="la">${esc(w.la)}</span>${w.end ? `<span class="end">${esc(w.end)}</span>` : ''}</div>`).join('')}</div>
      <div class="blk ad" data-s="4" data-k="ad1"><span class="k">Reply to objection 1</span><span class="la">${esc(first(la.ad1, 12))}</span><span class="en">${esc(first(en.ad1.replace(/^Reply to Objection 1\.\s*/, ''), 14))}</span></div>
      <div class="blk ad" data-s="4" data-k="ad2"><span class="k">Reply to objection 2</span><span class="la">${esc(first(la.ad2, 12))}</span><span class="en">${esc(first(en.ad2.replace(/^Reply to Objection 2\.\s*/, ''), 14))}</span></div>`;
    const STEPS = [
      ['The question', 'An article opens with a question that can be answered yes or no. It begins with Utrum: whether.', 'title'],
      ['The objections', 'First comes the case for the other side as strongly as it can be put. There is evil in the world. Nature and human will seem to explain everything without God.', 'arg1'],
      ['On the contrary', 'One authority stands against the objections. Here it is God’s own name: “I am who am” (Exodus 3:14).', 'sc'],
      ['I answer that', 'The body of the article gives Thomas’s own answer. Here it is the five ways. Each ends in the same words: and this everyone calls God.', 'co1'],
      ['The replies', 'Each objection is answered in turn. The reply to the first draws on Augustine: God would not allow evil unless he could bring good out of it.', 'ad1'],
      ['Read it', '', ''],
    ];
    const stepsEl = document.getElementById('tg-steps');
    stepsEl.innerHTML = STEPS.map(([b, p], i) => i === 5 ? `<li><b>Read the whole article</b><p><a href="${TG.read(A.slug, A.page)}" target="_blank" rel="noopener">Summa of Theology I, question 2, article 3</a> is on page ${A.page} of the first volume. The Latin and English stand side by side.</p></li>` : `<li><b>${esc(b)}</b><p>${esc(p)}</p></li>`).join('');
    const lis = [...stepsEl.children], blocks = [...host.querySelectorAll('[data-s]')], wayEls = [...host.querySelectorAll('.way')];
    const ex = document.getElementById('tg-excerpt'), exLa = ex.querySelector('.la'), exEn = ex.querySelector('.en');
    const curvePath = (from, to, side) => { const a = from.getBoundingClientRect(), b = to.getBoundingClientRect(), o = arrows.getBoundingClientRect();
      const x1 = side < 0 ? a.left - o.left : a.right - o.left, y1 = a.top - o.top + a.height / 2, x2 = side < 0 ? b.left - o.left : b.right - o.left, y2 = b.top - o.top + b.height / 2, out = side * 34;
      return `M${x1},${y1} C${x1 + out},${y1} ${x2 + out},${y2} ${x2 + side * 3},${y2}`; };
    function drawArrows(show) {
      const pairs = [['ad1', 'arg1', -1], ['ad2', 'arg2', 1]].map(([a, b, sd]) => [host.querySelector(`[data-k="${a}"]`), host.querySelector(`[data-k="${b}"]`), sd]);
      arrows.innerHTML = `<defs><marker id="tg-ah" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L8,5 L0,9" fill="none" stroke="#a3382a" stroke-width="1.6"/></marker></defs>${ 
        pairs.map(([f, t, sd]) => `<path class="arw" d="${curvePath(f, t, sd)}" marker-end="url(#tg-ah)"/>`).join('')}`;
      const ps = [...arrows.querySelectorAll('path.arw')];
      ps.forEach((p) => { const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = show && !G ? 0 : L; p.style.opacity = show ? 1 : 0; });
      if (show && G) gsap.to(ps, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut', stagger: 0.2 });
    }
    let cur = -1;
    function step(i, instant) {
      if (i === cur) return; const prev = cur; cur = i;
      lis.forEach((li, j) => li.classList.toggle('now', j === i));
      const shown = Math.min(i, 4);
      blocks.forEach((b) => { const s = +b.dataset.s, vis = s <= shown, now = s === shown;
        b.classList.toggle('on', now && i < 5 && b.classList.contains('blk'));
        const to = { opacity: vis ? (now || i === 5 ? 1 : 0.5) : 0.06, y: vis ? 0 : 10 };
        if (G && !instant) gsap.to(b, { ...to, duration: 0.45, ease: 'power2.out' }); else if (window.gsap) gsap.set(b, to); else b.style.opacity = to.opacity; });
      // the five ways open out of the answer
      if (G && !instant) {
        if (shown >= 3 && prev < 3) gsap.fromTo(wayEls, { scaleX: 0.2, scaleY: 0.4, opacity: 0, transformOrigin: '50% 0%', x: (k) => (2 - k) * 60 }, { scaleX: 1, scaleY: 1, opacity: 1, x: 0, duration: 0.8, ease: 'expo.out', stagger: 0.07 });
        if (shown < 3) gsap.to(wayEls, { opacity: 0, duration: 0.3 });
      } else wayEls.forEach((w) => { w.style.opacity = shown >= 3 ? 1 : 0; });
      drawArrows(shown >= 4);
      const key = (STEPS[Math.min(i, 4)] || [])[2], k2 = i === 3 ? 'co2' : key;
      if (key) { exLa.textContent = la[key] + (i === 3 ? ` ${la.co2}` : ''); exEn.textContent = en[key] + (i === 3 ? ` ${en.co2}` : ''); }
      else { exLa.textContent = la.ad1; exEn.textContent = en.ad1; }
      if (G && !instant) gsap.fromTo(ex.children, { opacity: 0 }, { opacity: 1, duration: 0.5 });
    }
    const st = TG.chapter('#tg-art', 3000, (p, fin) => step(fin ? 5 : Math.min(5, Math.floor(p * 6)), fin), { scrub: true });
    if (!st) { lis.forEach((li) => li.classList.add('now')); }
    let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => drawArrows(cur >= 4), 150); });
  })();

  /* ---------- 4. text and gloss: the Corpus of Canon Law as glossed leaves ---------- */
  (function law() {
    const book = document.getElementById('tg-book'), list = document.getElementById('tg-layers'), C = D.corpus;
    const pages = (c) => c.w.reduce((t, w) => t + w[2], 0), gpages = (g) => g[2].reduce((t, w) => t + w[2], 0);
    list.innerHTML = C.map((c) => `<li><span class="d">${esc(c.lab)}</span><b>${esc(c.n)}</b> <span class="small">${esc(c.who)} · ${fmt(pages(c))} pp.</span><p>${esc(c.say)}</p>
      <span class="gls">${c.w.map((w) => `<a href="${TG.read(w[1])}" target="_blank" rel="noopener">Read ${c.w.length > 1 ? esc(w[0].replace(/\s*\(.*\)$/, '')) : `the ${esc(c.n)}`}</a>`).join('')}${c.gloss.filter((g) => g[2].length).map((g) => `<a href="${TG.read(g[2][0][1])}" target="_blank" rel="noopener">${esc(g[0])}, ${esc(g[1])}</a>`).join('')}</span></li>`).join('');
    const lis = [...list.children], maxGloss = Math.max(...C.map((c) => c.gloss.reduce((t, g) => t + gpages(g), 0)));
    // one leaf per collection: a two-column text block, the gloss wrapped round it, the glossators named in the margin
    const leafSVG = (c, li) => {
      let rnd = (li + 1) * 9301; const rand = () => ((rnd = (rnd * 9301 + 49297) % 233280) / 233280);
      const W = 300, H = 400, tx = 92, tw = 116, ty = 92, th = 196;
      let s = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true"><text x="${W / 2}" y="34" text-anchor="middle" class="head">${esc(c.n.toUpperCase())}</text><text x="${W / 2}" y="50" text-anchor="middle" class="yr">${esc(c.who)}, ${esc(c.lab)}</text>`;
      s += `<text x="${tx - 2}" y="${ty + 34}" class="init">${esc(c.n[0])}</text>`;
      const lines = []; for (let col = 0; col < 2; col++) for (let r = 0; r < 24; r++) { const x = tx + col * (tw / 2 + 4) + (col === 0 && r < 4 ? 30 : 0), w = tw / 2 - 4 - (col === 0 && r < 4 ? 30 : 0);
        lines.push(`<rect class="ln" x="${x}" y="${ty + r * 8.2}" width="${(w * (r % 9 === 8 ? 0.55 : 0.9 + rand() * 0.1)).toFixed(1)}" height="3.2" rx="1"/>`); }
      s += `<g class="text">${lines.join('')}</g>`;
      const gl = [], G2 = (x, y, w) => gl.push(`<rect class="gn" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="2.2" rx="1"/>`);
      const k = Math.sqrt(c.gloss.reduce((t, g) => t + gpages(g), 0) / maxGloss); // 0..1: how much gloss the shelf holds for this book
      const side = Math.round(36 * Math.min(1, k * 1.6)), below = Math.round(14 * k), above = Math.round(4 * Math.min(1, k * 2));
      for (let r = 0; r < above; r++) G2(30, 62 + r * 6, 240 * (0.88 + rand() * 0.12));
      for (let r = 0; r < side; r++) { G2(30, ty + r * 5.6, 54 * (0.85 + rand() * 0.15)); G2(tx + tw + 8, ty + r * 5.6, 62 * (0.85 + rand() * 0.15)); }
      for (let r = 0; r < below; r++) G2(30, ty + th + 8 + r * 5.8, 240 * (r === below - 1 ? 0.5 : 0.9 + rand() * 0.1));
      s += `<g class="gloss">${gl.join('')}</g>`;
      const names = c.gloss.map((g) => g[0]); const spots = [[18, 140], [282, 200], [18, 270], [282, 120]];
      s += names.map((n, i) => `<text class="gl gname" x="${spots[i % 4][0]}" y="${spots[i % 4][1]}" text-anchor="${spots[i % 4][0] < 100 ? 'start' : 'end'}" transform="rotate(${spots[i % 4][0] < 100 ? -90 : 90} ${spots[i % 4][0]} ${spots[i % 4][1]})">${esc(n)}</text>`).join('');
      if (!names.length) s += `<text class="gl" x="${W / 2}" y="${H - 22}" text-anchor="middle">no great gloss on this shelf</text>`;
      return `${s}</svg>`;
    };
    const leaves = C.map((c, i) => { const d = document.createElement('div'); d.className = 'leaf'; d.innerHTML = leafSVG(c, i); d.style.zIndex = i + 1; book.appendChild(d); return d; });
    let cur = -2;
    function show(i, instant) {
      if (i === cur) return; const prev = cur; cur = i;
      lis.forEach((li, j) => { li.classList.toggle('now', j === i); li.classList.toggle('past', j < i); });
      leaves.forEach((lf, j) => {
        const st = j < i ? { rotationY: 0, x: -(i - j) * 7, y: (i - j) * 4, scale: 1 - (i - j) * 0.025, opacity: 1, filter: `brightness(${1 - (i - j) * 0.05})` }
          : j === i ? { rotationY: 0, x: 0, y: 0, scale: 1, opacity: 1, filter: 'brightness(1)' } : { rotationY: -96, x: 0, y: 0, scale: 1, opacity: 0, filter: 'brightness(1)' };
        if (!G || instant) { if (window.gsap) gsap.set(lf, st); else lf.style.opacity = j <= i ? 1 : 0; return; }
        gsap.to(lf, { ...st, duration: j === i && prev < i ? 1.0 : 0.6, ease: j === i ? 'power3.out' : 'power2.inOut', transformPerspective: 1600 });
      });
      const lf = leaves[i]; if (!lf) return;
      if (G && !instant && prev < i) {
        gsap.fromTo(lf.querySelectorAll('.text rect'), { scaleX: 0, transformOrigin: 'left center' }, { scaleX: 1, duration: 0.5, stagger: 0.006, ease: 'power2.out', delay: 0.3 });
        gsap.fromTo(lf.querySelectorAll('.gloss rect'), { scaleX: 0, opacity: 0, transformOrigin: 'left center' }, { scaleX: 1, opacity: 1, duration: 0.4, stagger: { each: 0.004, from: 'center' }, ease: 'power2.out', delay: 0.75 });
        gsap.fromTo(lf.querySelectorAll('.gname'), { opacity: 0 }, { opacity: 1, duration: 0.5, stagger: 0.25, delay: 1.1 });
      }
    }
    TG.chapter('#tg-law', 3200, (p, fin) => show(fin ? C.length - 1 : Math.min(C.length - 1, Math.floor(p * C.length)), fin), { scrub: true });
    if (!TG.pinOK()) lis.forEach((li) => li.classList.add('now'));
  })();

  /* ---------- 5. Aristotle in the schools ---------- */
  (function aristotle() {
    const X = D.ari, host = document.getElementById('tg-ari'), tip = host.querySelector('.tip'), max = Math.max(...X.cells.map((c) => c[4]));
    const fam = X.cols.map((c) => (byName[c] || {}).f || 'franciscan');
    const cell = (r, c) => X.cells.filter((x) => x[0] === r && x[1] === c);
    const t = document.createElement('table');
    t.innerHTML = `<colgroup><col class="r">${X.cols.map(() => '<col>').join('')}</colgroup><thead><tr><th class="r" style="border-bottom:1px solid var(--ink)">Aristotle</th>${X.cols.map((c, i) => `<th><span style="display:block;width:10px;height:10px;border-radius:50%;background:${fc(fam[i])};margin:0 auto 6px"></span>${esc(c.replace(' the Great', '').replace('Thomas ', '').replace('John Duns ', '').replace('William of ', ''))}<small>${esc(TG.yr(byName[c] || {}))}</small></th>`).join('')}</tr></thead>
      <tbody>${X.rows.map((r, ri) => `<tr><th class="r" scope="row">${esc(r)}</th>${X.cols.map((_, ci) => `<td>${cell(ri, ci).map((x) => { const d = 8 + 22 * Math.sqrt(x[4] / max); return `<a href="${TG.read(x[3])}" target="_blank" rel="noopener" data-t="${esc(x[2])}" data-p="${x[4]}" data-a="${esc(X.cols[ci])}" style="width:${d.toFixed(1)}px;height:${d.toFixed(1)}px;background:${fc(fam[ci])}" aria-label="${esc(X.cols[ci])}: ${esc(x[2])}, ${x[4]} pages"></a>`; }).join('')}</td>`).join('')}</tr>`).join('')}</tbody>`;
    host.appendChild(t);
    host.querySelectorAll('td a').forEach((a) => { a.addEventListener('mousemove', (e) => { const b = host.getBoundingClientRect(); tip.innerHTML = `${esc(a.dataset.t)}<small>${esc(a.dataset.a)} · ${fmt(a.dataset.p)} pages</small>`; tip.hidden = false;
      tip.style.left = `${Math.min(e.clientX - b.left + 12, b.width - 230)}px`; tip.style.top = `${e.clientY - b.top + 14}px`; }); a.addEventListener('mouseleave', () => { tip.hidden = true; }); });
    if (G) gsap.from(host.querySelectorAll('td a'), { scale: 0, duration: 0.6, ease: 'back.out(2)', stagger: { each: 0.018, grid: 'auto', from: 'start' }, scrollTrigger: { trigger: host, start: 'top 80%', once: true } });
  })();

  /* ---------- explore ---------- */
  explorer = TG.explorer(document.getElementById('tg-explorer'), D, { range: [1070, 1500], first: 'Thomas Aquinas', placeholder: 'Thomas, Ockham, Decretals…', label: 'Lifelines of the forty writers on the Medieval shelf' });
  TG.reveal('.tg .reveal');
})();
