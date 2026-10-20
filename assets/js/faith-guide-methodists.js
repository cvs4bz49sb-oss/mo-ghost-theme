/* The Methodists guide: the shelf as a hymn, the Atlantic crossings and presses, free grace, the hymnbook's order, four commentaries. */
(async () => {
  const method = (html) => (window.TFRMethod ? window.TFRMethod.html(html) : html);
  const {TG} = window, D = await TG.load('data');
  const { esc, fmt, clamp, ease, lerp } = TG, G = TG.hasG && !TG.reduce ? window.gsap : null;
  const FAMS = D.fam.map((f) => f[0]), fc = (k) => TG.css(`--f${FAMS.indexOf(k) + 1}`), famName = (k) => (D.fam.find((f) => f[0] === k) || [])[1];
  const NS = 'http://www.w3.org/2000/svg', mk = (tag, at) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); return e; };
  let explorer = null;

  /* ---------- hero: facts, and the shelf as a hymn on a grand staff ---------- */
  const facts = { works: D.n_works, authors: D.authors.length + D.undated.length, pages: D.n_pages, presses: Object.keys(D.press).length };
  document.querySelectorAll('[data-count]').forEach((el) => TG.countUp(el, facts[el.dataset.count], 1.8));
  (function stave() {
    const svg = document.querySelector('.stave svg'), cap = document.querySelector('.stave .cap');
    const X0 = 152, X1 = 664, Y0 = 1735, Y1 = 1895, YB = 1800, XB = X0 + 0.62 * (X1 - X0);
    const sx = (y) => (y <= YB ? X0 + (y - Y0) / (YB - Y0) * (XB - X0) : XB + (y - YB) / (Y1 - YB) * (X1 - XB));
    // two staves of five lines: the treble carries hymns, sermons, lives, Scripture; the bass carries doctrine, controversy, order
    const GAP = 13, T0 = 70, B0 = 236, lines = [];
    for (let i = 0; i < 5; i++) { lines.push(T0 + i * 2 * GAP); lines.push(B0 + i * 2 * GAP); }
    const LANE = { hymn: T0, sermon: T0 + 2 * GAP, life: T0 + 4 * GAP, bible: T0 + 6 * GAP, doct: B0 + 1 * GAP, argue: B0 + 4 * GAP, order: B0 + 7 * GAP };
    const kindName = Object.fromEntries(D.kinds);
    const g0 = mk('g', {}); svg.appendChild(g0);
    g0.appendChild(mk('text', { x: X0, y: 26, class: 'head' })).textContent = 'The Methodist shelf in the order of its editions';
    g0.appendChild(mk('text', { x: X0, y: 42, class: 'sub' })).textContent = `${D.n_works} WORKS · ${Y0 + 2}–${Y1 - 1}`;
    const staffLines = lines.map((y) => g0.appendChild(mk('line', { x1: X0 - 10, x2: X1, y1: y, y2: y, class: 'line' })));
    // the brace and the opening bar line
    const brace = g0.appendChild(mk('path', { d: `M${X0 - 22},${T0} C${X0 - 34},${T0 + 40} ${X0 - 16},${(T0 + B0 + 8 * GAP) / 2 - 20} ${X0 - 30},${(T0 + B0 + 8 * GAP) / 2} C${X0 - 16},${(T0 + B0 + 8 * GAP) / 2 + 20} ${X0 - 34},${B0 + 8 * GAP - 40} ${X0 - 22},${B0 + 8 * GAP}`, fill: 'none', stroke: TG.css('--ink-2'), 'stroke-width': 2 }));
    const bars = [];
    for (const y of [1740, 1760, 1780, 1800, 1840, 1880]) { const x = sx(y);
      bars.push(g0.appendChild(mk('line', { x1: x, x2: x, y1: T0, y2: T0 + 8 * GAP, class: 'bar' })), g0.appendChild(mk('line', { x1: x, x2: x, y1: B0, y2: B0 + 8 * GAP, class: 'bar' })));
      g0.appendChild(mk('text', { x, y: B0 + 8 * GAP + 22, class: 'yr', 'text-anchor': 'middle' })).textContent = y; }
    // where the time line changes speed: a break in both staves
    [T0 + 8 * GAP, B0 + 8 * GAP].forEach((y) => { g0.appendChild(mk('path', { d: `M${XB - 5},${y + 6} l4,-12 M${XB + 1},${y + 6} l4,-12`, stroke: TG.css('--ink-2'), 'stroke-width': 1.2, fill: 'none' })); });
    Object.entries(LANE).forEach(([k, y]) => { const t = g0.appendChild(mk('text', { x: X0 - 40, y: y + 4, class: 'lane', 'text-anchor': 'end' })); t.textContent = kindName[k]; });
    // the notes: whole notes for the long books, half notes for the middling, quarter notes for the short; close notes run on
    // close notes of one kind alternate between the line and the space above it, as a run of seconds, before they move on
    const last = {}; const notes = D.notes.map((n) => { const {k} = n, base = LANE[k]; let x = sx(n.y), up = 0; const L = last[k] || { x: -99, up: 1 };
      if (x < L.x + 3.4) { up = L.up ? 0 : 1; x = up ? L.x + 1.7 : L.x + 1.7; } last[k] = { x, up }; return { n, x, y: base - up * GAP * 0.55 }; });
    const NG = mk('g', {}); svg.appendChild(NG);
    const els = notes.map(({ n, x, y }) => {
      const type = n.p >= 400 ? 'whole' : n.p >= 100 ? 'half' : 'quarter', c = fc(n.f);
      const a = mk('a', { href: TG.read(n.s), target: '_blank', rel: 'noopener', class: 'note', 'aria-label': `${n.t}, ${n.a}, ${Math.floor(n.y)}` });
      const g = mk('g', {}); a.appendChild(g);
      g.appendChild(mk('ellipse', { class: 'hd', cx: x, cy: y, rx: type === 'whole' ? 5.6 : 4.6, ry: 3.5, transform: `rotate(-20 ${x} ${y})`,
        fill: type === 'quarter' ? c : TG.css('--card'), stroke: c, 'stroke-width': type === 'whole' ? 1.8 : 1.4 }));
      if (type !== 'whole') g.appendChild(mk('line', { x1: x + 4.1, x2: x + 4.1, y1: y - 1, y2: y - 22, stroke: c, 'stroke-width': 1.1 }));
      NG.appendChild(a);
      const say = () => { cap.dataset.m = ''; cap.textContent = `${n.t}${n.v ? `, ${n.v}` : ''} · ${n.a} · ${fmt(n.p)} pages${n.note ? ` · ${n.note}` : ''}`; };
      a.addEventListener('mouseenter', say); a.addEventListener('focus', say);
      return { g, x, n };
    });
    const def = 'Each note is a book on the shelf. It sits in the year of its edition and on the line of its kind. Whole notes are long books and quarter notes are short ones. After 1800 the years are drawn closer together.';
    const showDef = () => { if (cap.dataset.m !== '1') { cap.dataset.m = '1'; cap.innerHTML = method(def); } };
    svg.addEventListener('mouseleave', showDef); showDef();
    if (!G) return;
    const ph = svg.appendChild(mk('line', { x1: X0, x2: X0, y1: T0 - 16, y2: B0 + 8 * GAP + 6, class: 'ph' })), phy = svg.appendChild(mk('text', { x: X0, y: T0 - 22, class: 'phy', 'text-anchor': 'middle' }));
    gsap.set(els.map((e) => e.g), { opacity: 0, scale: 0.2, transformOrigin: 'center center' });
    const tl = TG.intro({ delay: 0.3 });
    tl.from(staffLines, { attr: { x2: X0 - 10 }, duration: 0.9, ease: 'power2.inOut', stagger: 0.03 })
      .from(brace, { opacity: 0, duration: 0.5 }, 0.4).from(bars, { opacity: 0, duration: 0.4, stagger: 0.02 }, 0.6);
    const head = { x: X0 }; let shown = 0;
    tl.to(head, { x: X1, duration: 5.2, ease: 'none', onUpdate() {
      ph.setAttribute('x1', head.x); ph.setAttribute('x2', head.x); phy.setAttribute('x', head.x); phy.textContent = Math.round(Y0 + (head.x - X0) / (X1 - X0) * (Y1 - Y0));
      while (shown < els.length && els[shown].x <= head.x) { const e = els[shown++]; gsap.to(e.g, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(3)' }); } } }, 1.0)
      .to([ph, phy], { opacity: 0, duration: 0.6 })
      .add(() => { els.slice(shown).forEach((e) => gsap.set(e.g, { opacity: 1, scale: 1 })); });
  })();

  /* ---------- 1. the ocean between: crossings, sites and presses on the North Atlantic ---------- */
  (function sea() {
    const box = document.getElementById('tg-map'), M = TG.map(box, D.land, [[-86, 29.5], [3, 56.5]], { parallels: [30, 55] });
    const cv = TG.canvas(box.querySelector('canvas')), { ctx } = cv, P = D.places;
    const chron = TG.chronicle(document.getElementById('tg-chron'), D.events, ([y, e, w]) => `<li><span class="d">${y}</span><span class="e">${esc(e)}</span><span class="w">${esc(w)}</span></li>`);
    const legend = document.getElementById('tg-legend');
    legend.innerHTML = `${D.fam.filter(([k]) => D.cross.some((c) => c.f === k)).map(([k, n]) => `<span><i style="background:${fc(k)}"></i>${esc(n)}</span>`).join('')}<span><i style="background:transparent;border:1.5px solid var(--ink);border-radius:50%"></i>a town that printed books now on this shelf</span>`;
    const pressEl = document.getElementById('tg-press'); let lastPress = '';
    const Y0 = 1729, Y1 = 1895; let year = Y0;
    const arc = (a, b, t) => { const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy), k = d > 200 ? 0.22 : 0.12;
      const cx = mx + dy * k, cy = my - Math.abs(dx) * k; const u = 1 - t; return [u * u * a[0] + 2 * u * t * cx + t * t * b[0], u * u * a[1] + 2 * u * t * cy + t * t * b[1]]; };
    function route(c, Y) {
      const pts = c.s.map(([p, y]) => ({ y, xy: M.xy(P[p]) })); if (Y < pts[0].y) return null;
      const trail = [pts[0].xy]; let pos = pts[0].xy, moving = false;
      for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1];
        if (Y >= b.y) { for (let s = 1; s <= 24; s++) trail.push(arc(a.xy, b.xy, s / 24)); pos = b.xy; continue; }
        const t = clamp((Y - a.y) / Math.max(0.01, b.y - a.y), 0, 1), e = ease(t); for (let s = 1; s <= 24 * e; s++) trail.push(arc(a.xy, b.xy, s / 24)); pos = arc(a.xy, b.xy, e); moving = true; break; }
      return { pos, trail, moving, done: Y > pts[pts.length - 1].y + 0.3 };
    }
    function render(Y) {
      year = Y; ctx.clearRect(0, 0, cv.W, cv.H); const ink = TG.css('--ink'), font = TG.css('--body');
      // the places of the revival
      ctx.font = `italic 12px ${TG.css('--display')}`;
      for (const [p, y, what] of D.sites) { if (y > Y) continue; const [x, yy] = M.xy(P[p]), f = clamp((Y - y) / 5, 0, 1);
        ctx.globalAlpha = 0.3 + 0.6 * f; ctx.strokeStyle = ink; ctx.lineWidth = 1.2; ctx.strokeRect(x - 3, yy - 3, 6, 6); }
      // the presses: a ring for each town, growing with the books it printed by this year
      const counts = [];
      for (const [p, list] of Object.entries(D.press)) { const n = list.filter((r) => r[0] <= Y).length; if (!n) continue; const [x, y] = M.xy(P[p]), fresh = list.some((r) => r[0] <= Y && r[0] > Y - 3);
        const r = 3 + Math.sqrt(n) * 2.6; counts.push([p, n]);
        if (fresh) { ctx.globalAlpha = 0.16; ctx.fillStyle = TG.css('--rubric'); ctx.beginPath(); ctx.arc(x, y, r + 7, 0, 6.283); ctx.fill(); }
        ctx.globalAlpha = 0.85; ctx.strokeStyle = fresh ? TG.css('--rubric') : ink; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.stroke(); }
      // the crossings
      const live = [];
      for (const c of D.cross) { const r = route(c, Y); if (!r) continue; const col = fc(c.f);
        ctx.strokeStyle = col; ctx.globalAlpha = r.done ? 0.22 : 0.6; ctx.lineWidth = r.done ? 1 : 1.6; ctx.setLineDash(r.done ? [] : [5, 4]);
        ctx.beginPath(); r.trail.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.setLineDash([]);
        if (!r.done) live.push({ c, r, col }); }
      for (const { c, r, col } of live) { const [x, y] = r.pos; ctx.globalAlpha = 1; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r.moving ? 4.6 : 3.6, 0, 6.283); ctx.fill();
        ctx.strokeStyle = TG.css('--card'); ctx.lineWidth = 1.4; ctx.stroke();
        ctx.font = `600 11.5px ${font}`; ctx.fillStyle = TG.css('--land'); const w = ctx.measureText(c.a).width; ctx.globalAlpha = 0.85; ctx.fillRect(x + 7, y - 15, w + 4, 14);
        ctx.globalAlpha = 1; ctx.fillStyle = col; ctx.fillText(c.a, x + 9, y - 4); }
      // labels of the presses that have printed the most
      ctx.font = `11px ${font}`; ctx.fillStyle = ink; const taken = [];
      const SIDE = { Boston: [1, -1], 'New York': [1, 1], Philadelphia: [-1, 0], Baltimore: [-1, 1], Charleston: [1, 0], London: [1, 0], Bristol: [-1, 1], Newburyport: [1, -1], Windham: [1, 0], Glasgow: [1, 0], Halifax: [1, 0], Cincinnati: [-1, 0], Nashville: [-1, 0] };
      counts.sort((a, b) => b[1] - a[1]).forEach(([p, n]) => { const [x, y] = M.xy(P[p]), r = 3 + Math.sqrt(n) * 2.6, w = ctx.measureText(p).width, [sx2, sy2] = SIDE[p] || [1, 0];
        let lx = sx2 > 0 ? x + r + 3 : x - r - 3 - w; const ly = y + 4 + sy2 * (r + 2);
        if (lx < 2) lx = x + r + 3; if (lx + w > cv.W - 2) lx = x - r - 3 - w; // never off the edge of a narrow map
        if (taken.some((b) => lx < b[0] + b[2] && lx + w > b[0] && ly - 10 < b[1] && ly > b[1] - 10)) return; taken.push([lx, ly, w]);
        ctx.globalAlpha = 0.9; ctx.fillStyle = TG.css('--land'); ctx.fillRect(lx - 2, ly - 10, w + 4, 13); ctx.fillStyle = ink; ctx.fillText(p, lx, ly); });
      ctx.globalAlpha = 1;
      document.getElementById('tg-year').textContent = Math.round(Y);
      document.getElementById('tg-yearbar').style.width = `${(Y - Y0) / (Y1 - Y0) * 100}%`;
      chron(Y);
      const sig = counts.map(([p, n]) => `${p}${n}`).join();
      if (sig !== lastPress) { lastPress = sig; pressEl.innerHTML = counts.length ? counts.slice(0, 8).map(([p, n]) => `<span>${esc(p)}<b>${n}</b></span>`).join('') : '<span class="small" style="border:0;background:none">No book on this shelf printed yet.</span>'; }
    }
    M.onfit = () => { cv.size(); render(year); };
    TG.chapter('#tg-sea', 4800, (p) => render(lerp(Y0, Y1, p)), { scrub: 0.4 });
  })();

  /* ---------- 2. free grace: the long argument, row by row, with its replies drawn ---------- */
  (function grace() {
    const host = document.getElementById('tg-gr'), rowsEl = host.querySelector('.rows'), links = host.querySelector('svg.links'), phase = document.getElementById('tg-phase');
    const ghostPlaced = new Set();
    const rows = D.grace.map((c) => {
      const row = document.createElement('div'); row.className = 'row';
      const cardHTML = `<a class="gc ${c.side}" href="${TG.read(c.s)}" target="_blank" rel="noopener" data-s="${c.s}" title="${esc(c.t)}, ${esc(c.v)}"><b>${esc(c.t)}</b><small>${esc(c.a)} · ${fmt(c.p)} pp.${c.note ? ` · ${esc(c.note)}` : ''}</small></a>`;
      let ghost = '';
      if (c.to && c.to.startsWith('ghost:') && !ghostPlaced.has(c.to)) { ghostPlaced.add(c.to); const [who, what] = D.ghosts[c.to.slice(6)];
        ghost = `<span class="gc ghost" data-g="${c.to}" title="${esc(who)}: ${esc(what)}"><b>${esc(who)}</b><small>${esc(what)} · not on this shelf</small></span>`; }
      row.innerHTML = c.side === 'U' ? `${cardHTML}<span class="yr">${c.y}</span>${ghost || '<span></span>'}` : `<span></span><span class="yr">${c.y}</span>${cardHTML}`;
      rowsEl.appendChild(row); return { row, c };
    });
    const PHASES = [[1739, 'Wesley and Whitefield in 1739–1746', 'The sermon at Bristol and the letter that answered it. Wesley’s tracts on predestination follow.'],
      [1765, 'The second quarrel of 1765–1777', 'Sellon against Hervey and Coles. After the Conference Minutes of 1770 the quarrel was at its hottest: Fletcher and Olivers against Toplady and Rowland Hill.'],
      [1790, 'Old books reprinted in the 1790s', 'Olivers on perseverance. Whitefield’s defense of election is printed again in Connecticut.'],
      [1815, 'In America in 1815–1864', 'Bangs against the New Divinity of New England, Fisk’s lectures, and Whedon’s answer to Jonathan Edwards.']];
    function drawLinks(upto) {
      const o = rowsEl.getBoundingClientRect(); let s = '';
      rows.forEach(({ row, c }, i) => { if (i > upto || !c.to) return;
        const from = row.querySelector('.gc:not(.ghost)'), to = c.to.startsWith('ghost:') ? rowsEl.querySelector(`[data-g="${c.to}"]`) : rowsEl.querySelector(`[data-s="${c.to}"]`);
        if (!from || !to) return; const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
        const ax = c.side === 'U' ? a.right - o.left : a.left - o.left, ay = a.top - o.top + a.height / 2, bx = c.side === 'U' ? b.left - o.left : b.right - o.left, by = b.top - o.top + b.height / 2;
        s += `<path data-i="${i}" d="M${ax},${ay} C${(ax + bx) / 2},${ay} ${(ax + bx) / 2},${by} ${bx + (c.side === 'U' ? -2 : 2)},${by}" marker-end="url(#tg-gah)"/>`; });
      links.innerHTML = `<defs><marker id="tg-gah" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,1 L8,5 L0,9" fill="none" stroke="#a3382a" stroke-width="1.6"/></marker></defs>${s}`;
    }
    let cur = -2;
    function show(k, instant) {
      const n = Math.round(k); if (n === cur && !instant) return; const prev = cur; cur = n;
      rows.forEach(({ row }, i) => { const on = i <= n; const kids = [...row.children];
        if (G && !instant) { if (on && i > prev) gsap.fromTo(kids, { opacity: 0, x: (j) => (j === 0 ? -24 : j === 2 ? 24 : 0) }, { opacity: 1, x: 0, duration: 0.5, ease: 'power3.out', stagger: 0.06 }); else if (!on) gsap.to(kids, { opacity: 0.06, duration: 0.25 }); }
        else kids.forEach((e) => { e.style.opacity = on ? 1 : 0.06; }); });
      drawLinks(n);
      const fresh = links.querySelector(`path[data-i="${n}"]`);
      if (G && !instant && fresh && n > prev) { const L = fresh.getTotalLength(); gsap.fromTo(fresh, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: 0.8, delay: 0.25, ease: 'power2.out' }); }
      const {y} = rows[Math.max(0, Math.min(rows.length - 1, n))].c; const ph = PHASES.filter((p) => p[0] <= y).pop() || PHASES[0];
      phase.innerHTML = `<b>${esc(ph[1])}</b>${esc(ph[2])}`;
    }
    TG.chapter('#tg-grace', 3400, (p, fin) => show(fin ? rows.length - 1 : p * (rows.length - 0.01) - 0.4, fin), { scrub: true });
    let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => drawLinks(cur), 150); });
  })();

  /* ---------- 3. the hymnbook: its parts and sections, with the line of a life drawn through them ---------- */
  (function hymns() {
    const H = D.hymnbook, host = document.getElementById('tg-hb'), path = host.querySelector('svg.path'), nEl = document.getElementById('tg-hymn-n');
    const max = Math.max(...H.parts.flatMap((p) => p.sec.map((s) => s.n)));
    const secs = [];
    H.parts.forEach((pt) => { const [num, name] = pt.t.split('|'); const d = document.createElement('div'); d.className = `part${pt.supp ? ' supp' : ''}`;
      d.innerHTML = `<div class="ph2"><b>${num === 'Supp' ? '+' : `Part ${esc(num)}`}</b><span>${esc(name)}</span></div>${pt.sec.map((s) => `<a class="sec" href="${TG.read(H.s, s.p)}" target="_blank" rel="noopener">${esc(s.t)} <small>${s.n}</small><i style="width:${(12 + 88 * s.n / max).toFixed(1)}%"></i></a>`).join('')}`;
      host.appendChild(d); d.querySelectorAll('.sec').forEach((a, i) => secs.push({ a, n: pt.sec[i].n, supp: !!pt.supp })); });
    const total = H.n, wes = H.parts.filter((p) => !p.supp).reduce((t, p) => t + p.sec.reduce((u, s) => u + s.n, 0), 0);
    let pts = [], lastP = 0;
    function trace() { // the reading order through Wesley's five parts: section after section, part after part
      const o = host.getBoundingClientRect();
      pts = secs.filter((s) => !s.supp).map(({ a }) => { const b = a.getBoundingClientRect(); return [b.left - o.left + 2, b.top - o.top + b.height - 3]; });
      show(lastP, true);
    }
    const seg = (a, b) => (b[0] > a[0] + 20 ? ` C${a[0] + 46},${a[1]} ${b[0] - 46},${b[1]} ${b[0]},${b[1]}` : ` L${b[0]},${b[1]}`);
    function show(p) {
      lastP = p; const k = p * (secs.length + 1); let sum = 0;
      secs.forEach((s, i) => { const u = clamp(k - i, 0, 1); s.a.style.opacity = 0.1 + 0.9 * u; s.a.querySelector('i').style.transform = `scaleX(${ease(u)})`; if (u > 0.5) sum += s.n; });
      if (pts.length) { const m = clamp(k, 0, pts.length - 1), whole = Math.floor(m), f = m - whole; let d = `M${pts[0][0]},${pts[0][1]}`;
        for (let i = 1; i <= whole; i++) d += seg(pts[i - 1], pts[i]);
        if (whole < pts.length - 1 && f > 0) { const a = pts[whole], b = pts[whole + 1]; d += seg(a, [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]); }
        path.innerHTML = `<path d="${d}"/>`; }
      nEl.textContent = p >= 0.999 ? `${fmt(wes)} hymns in Wesley’s five parts and ${fmt(total - wes)} more in the supplement. That makes ${fmt(total)} in the edition on the shelf.` : `${fmt(sum)} hymns`;
    }
    trace();
    TG.chapter('#tg-hymns', 3000, (p, fin) => show(fin ? 1 : p, fin), { scrub: 0.5 });
    let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { trace(); }, 150); });
  })();

  /* ---------- 4. one Bible, four commentaries ---------- */
  (function bible() {
    const host = document.getElementById('tg-bib'), svg = host.querySelector('svg'), tip = host.querySelector('.tip'), now = document.getElementById('tg-bnow');
    const B = D.books, S = D.bible, W = 1000, LW = 190, colW = (W - LW) / 66, RH = 64, top = 54, H = top + S.length * RH + 30;
    const max = Math.max(...S.flatMap((s) => s.cells.map((c) => c.n)));
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    let o = `<line x1="${LW}" x2="${LW + 39 * colW}" y1="22" y2="22" stroke="${TG.css('--ink')}"/><text x="${LW + 19.5 * colW}" y="15" class="tt" text-anchor="middle">THE OLD TESTAMENT</text>
      <line x1="${LW + 39 * colW + 2}" x2="${W}" y1="22" y2="22" stroke="${TG.css('--ink')}"/><text x="${LW + 52.5 * colW}" y="15" class="tt" text-anchor="middle">THE NEW</text>`;
    const AB = (b) => b.replace(/^(\d) /, '$1').replace('Song of Solomon', 'Song').slice(0, 4);
    const pri = ['Genesis', 'Psalms', 'Isaiah', 'Matthew', 'Romans', 'Revelation', 'Joshua', '1 Samuel', '1 Kings', 'Job', 'Jeremiah', 'Daniel', 'Jonah', 'John', 'Acts', 'Galatians', 'Hebrews', '1 John', 'Exodus', 'Judges', 'Ezra', 'Proverbs', 'Ezekiel', 'Micah', 'Luke', '1 Corinthians', 'Philippians', '1 Timothy', 'James'];
    const lab = []; pri.forEach((b) => { const i = B.indexOf(b); if (i >= 0 && lab.every((j) => Math.abs(j - i) >= 3)) lab.push(i); });
    lab.forEach((i) => { o += `<text x="${LW + (i + 0.5) * colW}" y="40" class="bk" text-anchor="middle">${esc(AB(B[i]))}</text>`; });
    S.forEach((s, r) => { const y = top + r * RH + RH - 10; o += `<text x="0" y="${y - 22}" class="rl">${esc(s.n)}</text><text x="0" y="${y - 8}" class="ry">${esc(s.y)}</text><line x1="${LW}" x2="${W}" y1="${y + 0.5}" y2="${y + 0.5}" stroke="${TG.css('--rule')}"/>`;
      const have = new Set(s.cells.map((c) => c.b));
      B.forEach((b, i) => { if (!have.has(i)) o += `<line class="gap" data-b="${i}" x1="${LW + i * colW + 3}" x2="${LW + (i + 1) * colW - 3}" y1="${y - 3}" y2="${y - 3}"/>`; });
      s.cells.forEach((c) => { const h = 4 + (RH - 16) * Math.sqrt(c.n / max); o += `<a href="${TG.read(c.s, c.p)}" target="_blank" rel="noopener"><rect class="c" data-r="${r}" data-b="${c.b}" x="${(LW + c.b * colW + 1).toFixed(1)}" y="${(y - h).toFixed(1)}" width="${(colW - 2).toFixed(1)}" height="${h.toFixed(1)}" fill="${TG.css(['--f1', '--f4', '--f3', '--f2'][r])}"/></a>`; }); });
    svg.innerHTML = o;
    const rects = [...svg.querySelectorAll('rect.c')], gaps = [...svg.querySelectorAll('.gap')];
    rects.forEach((rc) => { const s = S[+rc.dataset.r], c = s.cells.find((x) => x.b === +rc.dataset.b);
      rc.addEventListener('mousemove', (e) => { const b = host.getBoundingClientRect(); tip.innerHTML = `${esc(s.n.replace('’s', ''))} on ${esc(B[c.b])}<small>${fmt(c.n)} pages · open it in the reader</small>`; tip.hidden = false;
        tip.style.left = `${Math.min(e.clientX - b.left + 12, b.width - 230)}px`; tip.style.top = `${e.clientY - b.top + 14}px`; });
      rc.addEventListener('mouseleave', () => { tip.hidden = true; }); });
    function show(p) {
      const k = p * 67;
      rects.forEach((rc) => { const u = ease(clamp(k - +rc.dataset.b - 0.2 * +rc.dataset.r, 0, 1)); rc.style.transformBox = 'fill-box'; rc.style.transformOrigin = 'bottom'; rc.style.transform = `scaleY(${u})`; rc.style.opacity = u > 0 ? 1 : 0; });
      gaps.forEach((g) => { g.style.opacity = k > +g.dataset.b + 1 ? 1 : 0; });
      const b = Math.min(65, Math.floor(k)); now.textContent = p >= 0.999 ? `Genesis to Revelation: ${fmt(S.reduce((t, s) => t + s.cells.reduce((u, c) => u + c.n, 0), 0))} pages of Methodist commentary on the shelf.` : B[Math.max(0, b)];
    }
    TG.chapter('#tg-bible', 3400, (p, fin) => show(fin ? 1 : p), { scrub: 0.5 });
  })();

  /* ---------- the finder ---------- */
  explorer = TG.explorer(document.getElementById('tg-explorer'), D, { range: [1700, 1910], first: 'John Wesley', placeholder: 'Wesley, Whitefield, hymns, Notes…', label: 'Lifelines of the writers on the Methodist shelf' });
  TG.reveal('.tg .reveal');
})();
