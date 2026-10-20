/* The Anglicans guide: a cathedral floor of ledger stones, the formularies, the Church in print, Andrewes's year, the bench of bishops. */
(async () => {
  const method = (html) => (window.TFRMethod ? window.TFRMethod.html(html) : html);
  const {TG} = window, D = await TG.load('data');
  const { esc, fmt, clamp, ease, lerp } = TG, G = TG.hasG && !TG.reduce ? window.gsap : null, NS = 'http://www.w3.org/2000/svg';
  const FAMS = D.fam.map((f) => f[0]), fc = (k) => TG.css(`--f${FAMS.indexOf(k) + 1}`), famName = (k) => (D.fam.find((f) => f[0] === k) || [])[1];
  const A = D.authors, byFull = Object.fromEntries(A.map((a) => [a.full, a]));
  const BISH = new Map(D.bishops.map((b) => [b.i, b]));
  const mk = (tag, at, parent) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); if (parent) parent.appendChild(e); return e; };
  let explorer = null;
  const anglink = document.getElementById('tg-anglink'); if (anglink) anglink.href = TG.href('anglicans/');
  const wmlink = document.getElementById('tg-wmlink'); if (wmlink) wmlink.href = TG.href('westminster-assembly/');

  /* ---------- hero: the facts, and every writer as a ledger stone in a cathedral floor ---------- */
  const facts = { works: D.n_works, authors: D.n_authors, pages: D.n_pages, bishops: D.bishops.length };
  document.querySelectorAll('[data-count]').forEach((el) => TG.countUp(el, facts[el.dataset.count], 1.8));
  (function floor() {
    const svg = document.querySelector('.plan svg'), cap = document.querySelector('.plan .cap');
    const VW = 1180, VH = 330; svg.setAttribute('viewBox', `0 0 ${VW} ${VH}`);
    const outline = 'M60,80 L640,80 L640,10 L740,10 L740,90 L1010,90 L1010,125 L1110,125 A40,40 0 0 1 1110,205 L1010,205 L1010,240 L740,240 L740,320 L640,320 L640,250 L60,250 L60,192 L38,192 L38,138 L60,138 Z';
    const wall = mk('path', { class: 'wall', d: outline }, svg);
    const ribs = mk('g', {}, svg), piers = mk('g', {}, svg), ins = mk('g', {}, svg);
    // the vaults: a cross in every bay of the nave, the crossing, the arms and the choir
    const bays = [];
    for (let k = 0; k < 8; k++) bays.push([60 + k * 72.5, 110, 72.5, 110]);
    bays.push([640, 110, 100, 110], [640, 14, 100, 66], [640, 250, 100, 66]);
    for (let k = 0; k < 5; k++) bays.push([740 + k * 54, 114, 54, 102]);
    bays.push([1010, 129, 100, 72]);
    const ribEls = bays.map(([x, y, w, h]) => mk('path', { class: 'rib', d: `M${x},${y} L${x + w},${y + h} M${x + w},${y} L${x},${y + h} M${x},${y} L${x + w},${y} M${x},${y + h} L${x + w},${y + h}` }, ribs));
    const pierEls = [];
    for (let k = 1; k < 8; k++) for (const y of [110, 220]) pierEls.push(mk('rect', { class: 'pier', x: 60 + k * 72.5 - 3, y: y - 3, width: 6, height: 6 }, piers));
    for (const [x, y] of [[640, 110], [740, 110], [640, 220], [740, 220]]) pierEls.push(mk('rect', { class: 'pier', x: x - 5, y: y - 5, width: 10, height: 10 }, piers));
    for (let k = 1; k < 5; k++) for (const y of [114, 216]) pierEls.push(mk('rect', { class: 'pier', x: 740 + k * 54 - 3, y: y - 3, width: 6, height: 6 }, piers));
    // a year scale let into the floor of the south aisle, and the two ends named
    const X0 = 1485, X1 = 1665, xOf = (y) => 74 + (clamp(y, X0, X1) - X0) / (X1 - X0) * (1000 - 74);
    [1500, 1550, 1600, 1650].forEach((y) => { const t = mk('text', { class: 'ins', x: xOf(y), y: 244, 'text-anchor': 'middle' }, ins); t.textContent = y; });
    mk('text', { class: 'ins big', x: 30, y: 128, 'text-anchor': 'middle' }, ins).textContent = 'WEST';
    mk('text', { class: 'ins big', x: 1166, y: 168, 'text-anchor': 'middle', transform: 'rotate(90 1166 168)' }, ins).textContent = 'EAST';
    mk('text', { class: 'ins', x: 1066, y: 122, 'text-anchor': 'middle' }, ins).textContent = 'the Lady chapel';
    mk('text', { class: 'ins', x: 690, y: 9, 'text-anchor': 'middle' }, ins).textContent = 'north transept';
    const yr = mk('text', { class: 'yr num', x: 74, y: 304 }, svg); yr.textContent = '';
    // the stones: born earliest at the west door; the long axis east and west, as graves lie
    const maxP = Math.max(...A.map((a) => a.p));
    const region = (x) => (x > 1010 ? [131, 199] : x > 740 ? [96, 234] : x >= 640 && x <= 740 ? [16, 314] : [84, 246]);
    const placed = [], stones = [];
    const born = A.filter((a) => a.y0);
    born.forEach((a) => {
      const w = 14 + 28 * Math.sqrt(a.p / maxP), h = Math.max(8, w * 0.52), late = a.y0 > 1700;
      let x = late ? 1060 - w / 2 : xOf(a.y0) - w / 2; const [lo, hi] = region(x + w / 2), cy = (lo + hi) / 2;
      let y = null;
      for (let s = 0; s < 40 && y === null; s++) {
        for (const dir of s ? [1, -1] : [1]) {
          const cand = cy - h / 2 + dir * s * (h * 0.55 + 1.5);
          if (cand < lo || cand + h > hi) continue;
          if (!placed.some((p) => x < p.x + p.w + 1.5 && x + w + 1.5 > p.x && cand < p.y + p.h + 1.5 && cand + h + 1.5 > p.y)) { y = cand; break; }
        }
        if (y === null && s > 6 && !late) x += 3; // nudge east a little when a bay is full
      }
      if (y === null) y = cy - h / 2;
      placed.push({ x, y, w, h });
      const b = BISH.get(A.indexOf(a));
      const g = mk('g', { class: `stone${b && b.arch ? ' arch' : ''}`, tabindex: 0, role: 'button', 'aria-label': `${a.n}, ${a.d}` }, svg);
      mk('rect', { x, y, width: w, height: h, rx: 1, fill: fc(a.f) }, g);
      if (b) { const mx = x + w / 2, my = y + h / 2, s2 = Math.min(5, h * 0.36); // a small mitre on a bishop's stone
        mk('path', { class: 'mitre', d: `M${mx - s2},${my + s2} L${mx - s2},${my - s2 * 0.2} L${mx - s2 * 0.45},${my - s2} L${mx},${my - s2 * 0.35} L${mx + s2 * 0.45},${my - s2} L${mx + s2},${my - s2 * 0.2} L${mx + s2},${my + s2} Z` }, g); }
      stones.push({ a, g });
    });
    const say = (a) => { if (!a && cap.dataset.m === '1') return; cap.dataset.m = a ? '' : '1'; cap.innerHTML = a ? `<b>${esc(a.n)}</b>, ${esc(a.d)}${BISH.get(A.indexOf(a)) ? ` · ${esc(BISH.get(A.indexOf(a)).arch ? 'archbishop' : 'bishop')}` : ''} · ${a.w.length} ${a.w.length === 1 ? 'work' : 'works'}, ${fmt(a.p)} pages · ${esc(famName(a.f))}`
      : method('Each ledger stone is a writer on the shelf. The earliest born lie at the west door. A miter marks a bishop and a gilt edge an archbishop. Larger stones mean more pages. Pusey lies alone in the Lady chapel.'); };
    stones.forEach(({ a, g }) => { const on = () => say(a); g.addEventListener('mouseenter', on); g.addEventListener('focus', on);
      g.addEventListener('click', () => explorer && explorer.show(a.n)); g.addEventListener('keydown', (e) => { if (e.key === 'Enter') explorer && explorer.show(a.n); }); });
    svg.addEventListener('mouseleave', () => say(null)); say(null);
    const leg = document.createElement('p'); leg.className = 'legend'; leg.style.justifyContent = 'center';
    leg.innerHTML = D.fam.filter(([k]) => A.some((a) => a.f === k)).map(([k, n]) => `<span><i style="background:${fc(k)}"></i>${esc(n)}</span>`).join(''); cap.after(leg);
    if (!G) return;
    const draw = (el) => { const L = el.getTotalLength(); el.style.strokeDasharray = L; el.style.strokeDashoffset = L; return el; };
    wall.style.fillOpacity = 0;
    const tl = TG.intro({ delay: 0.3 });
    tl.to(draw(wall), { strokeDashoffset: 0, duration: 2.0, ease: 'power2.inOut' })
      .to(wall, { fillOpacity: 1, duration: 0.8 }, '-=0.6')
      .from(pierEls, { scale: 0, transformOrigin: 'center', duration: 0.4, stagger: 0.012, ease: 'back.out(2)' }, '-=0.9')
      .to(ribEls.map(draw), { strokeDashoffset: 0, duration: 0.5, stagger: 0.05, ease: 'power1.out' }, '-=0.6')
      .from(ins.children, { opacity: 0, duration: 0.6, stagger: 0.05 }, '-=0.4');
    const ctr = { i: 0 };
    tl.from(stones.map((s) => s.g), { opacity: 0, y: -18, duration: 0.5, stagger: 0.035, ease: 'power3.out' }, '-=0.2')
      .to(ctr, { i: stones.length - 1, duration: 0.035 * stones.length, ease: 'none', onUpdate() { yr.textContent = stones[Math.round(ctr.i)].a.y0; } }, '<')
      .to(yr, { opacity: 0, duration: 0.6 });
  })();

  /* ---------- 1. the formularies: six books on the lectern ---------- */
  (function formularies() {
    const lect = document.getElementById('tg-lectern'), leaf = document.getElementById('tg-leaf'), F = D.form;
    lect.innerHTML = F.map((f, i) => `<button type="button" class="tome" aria-pressed="false" data-i="${i}"><small>${esc(f.lab)}</small><b>${esc(f.n.replace(/^The /, ''))}</b><small>${f.w.length} on the shelf</small></button>`).join('');
    const tomes = [...lect.children];
    let cur = -1;
    function open(i, instant) {
      if (i === cur) return; cur = i; const f = F[i];
      tomes.forEach((t, j) => t.setAttribute('aria-pressed', j === i ? 'true' : 'false'));
      const lib = [f.href ? `<a href="${TG.href(f.href)}" target="_blank" rel="noopener">${esc(f.hrefl)}</a>` : '', ...(f.conf || []).map(([s, t]) => `<a href="${TG.read(s)}" target="_blank" rel="noopener">${esc(t)}</a>`)].filter(Boolean).join('');
      leaf.innerHTML = `<p class="rub"><em>${esc(f.n.charAt(0))}</em>${esc(f.n.slice(1))}</p><div class="eds">${f.y.map((y) => `<span>${y}</span>`).join('')}</div>
        <p class="say2">${esc(f.say)}</p>${lib ? `<p class="lib">${lib}</p>` : ''}
        <ol>${f.w.map(([t, s, p, y, a]) => `<li><span class="y">${y || ''}</span><span><a href="${TG.read(s)}" target="_blank" rel="noopener">${esc(t)}</a><small>${esc(a)}${p ? ` · ${fmt(p)} pp.` : ''}</small></span></li>`).join('') || '<li style="display:block"><small>Nothing on the shelf expounds it directly.</small></li>'}</ol>`;
      if (G && !instant) {
        gsap.fromTo(tomes[i], { rotationX: -28, y: -10 }, { rotationX: 0, y: 0, duration: 0.7, ease: 'back.out(2)', transformPerspective: 900 });
        gsap.from(leaf.querySelectorAll('.rub, .eds span, .say2, .lib'), { opacity: 0, y: 10, duration: 0.45, stagger: 0.05, ease: 'power2.out' });
        gsap.from(leaf.querySelectorAll('li'), { opacity: 0, x: -14, duration: 0.4, stagger: 0.03, ease: 'power2.out', delay: 0.15 });
      }
    }
    tomes.forEach((t, i) => t.addEventListener('click', () => open(i)));
    if (G) gsap.from(tomes, { y: 40, opacity: 0, duration: 0.7, stagger: 0.08, ease: 'power3.out', scrollTrigger: { trigger: lect, start: 'top 85%', once: true } });
    open(0, true);
    TG.chapter('#tg-form', 3000, (p, fin) => { if (!fin) open(Math.min(F.length - 1, Math.floor(p * F.length))); }, { scrub: true });
  })();

  /* ---------- 2. the Church in print: every dated work at the year its copy was printed ---------- */
  (function press() {
    const box = document.querySelector('.press'), cv = TG.canvas(box.querySelector('canvas')), {ctx} = cv, tip = box.querySelector('.tip');
    const P = D.press, Y0 = 1540, Y1 = 1900, M = { l: 6, r: 6, t: 84, b: 28 };
    const chron = TG.chronicle(document.getElementById('tg-chron'), D.events, ([y, e, w]) => `<li><span class="d">${y}</span><span class="e">${esc(e)}</span><span class="w">${esc(w)}</span></li>`);
    const legend = document.getElementById('tg-plegend');
    legend.innerHTML = D.fam.filter(([k]) => A.some((a) => a.f === k)).map(([k, n]) => `<span><i style="background:${fc(k)}"></i>${esc(n)}</span>`).join('');
    const col = new Map(); P.forEach((x) => { if (!col.has(x[0])) col.set(x[0], []); col.get(x[0]).push(x); });
    const maxN = Math.max(...[...col.values()].map((v) => v.length));
    let year = Y0, blocks = [], bh = 3;
    // the shelf has almost nothing printed between 1720 and 1830, so the axis breaks there
    const B1 = 1722, B2 = 1828, SPLIT = 0.84, GAP = 0.04;
    const X = (y) => { const w = cv.W - M.l - M.r; return y <= B1 ? M.l + (y - Y0) / (B1 - Y0) * w * SPLIT : M.l + w * (SPLIT + GAP) + (clamp(y, B2, Y1) - B2) / (Y1 - B2) * w * (1 - SPLIT - GAP); };
    function layout() {
      blocks = []; const cw = Math.max(1.6, X(Y0 + 1) - X(Y0) - 0.5); bh = Math.min(5, (cv.H - M.t - M.b) / maxN - 0.4);
      col.forEach((v, y) => v.forEach((x, i) => blocks.push({ x: X(y), y: cv.H - M.b - (i + 1) * (bh + 0.4), w: cw, h: bh, d: x })));
    }
    function draw() {
      ctx.clearRect(0, 0, cv.W, cv.H); const base = cv.H - M.b;
      ctx.strokeStyle = TG.css('--rule'); ctx.beginPath(); ctx.moveTo(M.l, base + 0.5); ctx.lineTo(cv.W - M.r, base + 0.5); ctx.stroke();
      ctx.fillStyle = TG.css('--muted'); ctx.font = `11px ${TG.css('--body')}`; ctx.textAlign = 'center';
      for (const y of [1550, 1600, 1650, 1700, 1850, 1880]) ctx.fillText(y, X(y), base + 17);
      const gx = (X(B1) + X(B2)) / 2; ctx.strokeStyle = TG.css('--muted'); ctx.beginPath(); ctx.moveTo(gx - 6, base + 5); ctx.lineTo(gx - 2, base - 5); ctx.moveTo(gx + 2, base + 5); ctx.lineTo(gx + 6, base - 5); ctx.stroke();
      let shown = 0, pages = 0;
      for (const b of blocks) { if (b.d[0] > year) continue; shown++; pages += b.d[4]; const a = A[b.d[1]]; ctx.globalAlpha = year - b.d[0] < 6 ? 1 : 0.78; ctx.fillStyle = fc(a.f); ctx.fillRect(b.x, b.y, b.w, b.h); }
      ctx.globalAlpha = 1;
      // the compositor's line: where the press has reached
      const xx = X(year > B1 && year < B2 ? B1 : year); ctx.strokeStyle = TG.css('--rubric'); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(xx, M.t - 10); ctx.lineTo(xx, base); ctx.stroke(); ctx.lineWidth = 1;
      if (hover) { ctx.strokeStyle = TG.css('--ink'); ctx.strokeRect(hover.x - 1, hover.y - 1, hover.w + 2, hover.h + 2); }
      document.getElementById('tg-pyear').textContent = Math.round(year);
      document.getElementById('tg-ptally').textContent = `${fmt(shown)} works printed by ${Math.round(year)}`;
    }
    let hover = null;
    const pick = (mx, my) => blocks.find((b) => b.d[0] <= year && mx >= b.x - 1 && mx <= b.x + b.w + 1 && my >= b.y - 0.5 && my <= b.y + b.h + 0.5);
    cv.cv.addEventListener('mousemove', (e) => { const r = cv.cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, h = pick(mx, my); hover = h; draw();
      if (!h) { tip.hidden = true; cv.cv.style.cursor = 'crosshair'; return; } cv.cv.style.cursor = 'pointer'; const a = A[h.d[1]];
      tip.innerHTML = `${esc(h.d[2])}<small>${esc(a.n)} · ${h.d[0]}${h.d[4] ? ` · ${fmt(h.d[4])} pp.` : ''}</small>`; tip.hidden = false;
      tip.style.left = `${Math.min(mx + 12, r.width - 240)}px`; tip.style.top = `${Math.max(0, my - 40)}px`; });
    cv.cv.addEventListener('mouseleave', () => { hover = null; tip.hidden = true; draw(); });
    cv.cv.addEventListener('click', (e) => { const r = cv.cv.getBoundingClientRect(), h = pick(e.clientX - r.left, e.clientY - r.top); if (!h) return; const a = A[h.d[1]];
      document.getElementById('tg-ppick').innerHTML = `<span style="color:var(--rubric);font-weight:600">${h.d[0]}</span> <a href="${TG.read(h.d[3])}" target="_blank" rel="noopener">${esc(h.d[2])}</a><small>${esc(a.n)}</small>`; });
    layout(); draw();
    new ResizeObserver(() => { cv.size(); layout(); draw(); }).observe(cv.cv);
    TG.chapter('#tg-press', 3800, (p) => { year = p < 0.86 ? lerp(Y0, B1, p / 0.86) : lerp(B2, 1890, (p - 0.86) / 0.14); chron(year); draw(); }, { scrub: 0.4 });
  })();

  /* ---------- 3. the bench of bishops: the sees their records name ---------- */
  (function bench() {
    const GRID = { Derry: [0, 0], Durham: [4, 0], Armagh: [0, 1], 'Down and Connor': [1, 1], York: [4, 1], 'St Asaph': [2, 2], Chester: [3, 2], Lincoln: [5, 2],
      Worcester: [3, 3], 'Lichfield and Coventry': [4, 3], Ely: [6, 3], Norwich: [7, 3], "St David's": [1, 4], Gloucester: [3, 4], Oxford: [4, 4],
      'Bath and Wells': [2, 5], Salisbury: [3, 5], Winchester: [4, 5], London: [5, 5], Rochester: [6, 5], Canterbury: [7, 5], Exeter: [2, 6], Chichester: [5, 6] };
    const IRE = new Set(['Derry', 'Armagh', 'Down and Connor']);
    const grid = document.getElementById('tg-benchgrid'), cardEl = document.getElementById('tg-bcard'), nEl = document.getElementById('tg-bn'), note = document.getElementById('tg-bnote');
    const used = Object.keys(GRID).filter((s) => D.bishops.some((b) => b.sees.includes(s)));
    const tiles = {};
    used.forEach((s) => { const [c, r] = GRID[s], d = document.createElement('div'); d.className = `see${IRE.has(s) ? ' ire' : ''}`;
      d.style.gridColumn = `${c + 1}`; d.style.gridRow = s === 'Canterbury' ? `${r + 1} / span 2` : `${r + 1}`;
      d.innerHTML = `<h4 title="${esc(s)}">${esc(s.replace(' and Coventry', '').replace(' and Connor', ' & Connor').replace('Bath and Wells', 'Bath & Wells'))}</h4><span class="n">0</span><ul></ul>`; grid.appendChild(d); tiles[s] = { el: d, ul: d.querySelector('ul'), n: d.querySelector('.n') }; });
    const B = D.bishops.slice().sort((x, y) => (A[x.i].y0 || 0) - (A[y.i].y0 || 0));
    const surname = (n) => n.replace(/ (the Elder|of .*)$/, '').split(' ').pop();
    let state = new Map(); // bishop index → step reached (-1 none … sees.length - 1)
    function apply(k) {
      const next = new Map(); B.forEach((b, i) => { const u = clamp(k - i, 0, 1); next.set(b.i, u <= 0 ? -1 : Math.min(b.sees.length - 1, Math.floor(u * b.sees.length))); });
      // the moves since the last frame fly across the bench
      const moves = [];
      next.forEach((st, bi) => { const old = state.has(bi) ? state.get(bi) : -1; if (st > old && st >= 0) moves.push([bi, old, st]); });
      state = next;
      Object.values(tiles).forEach((t) => { t.list = []; });
      let placed = 0, arch = 0, lastB = null;
      B.forEach((b) => { const st = state.get(b.i); if (st < 0) return; placed++; if (b.arch) arch++; lastB = b;
        b.sees.forEach((s, j) => { if (j > st || !tiles[s]) return; tiles[s].list.push({ b, gone: j < st }); }); });
      Object.entries(tiles).forEach(([s, t]) => { const L = t.list;
        t.ul.innerHTML = L.map(({ b, gone }) => `<li class="${b.arch && (s === 'Canterbury' || s === 'York' || s === 'Armagh') ? 'arch' : ''}${gone ? ' gone' : ''}" title="${esc(A[b.i].n)}">${esc(surname(A[b.i].n))}</li>`).join('');
        t.n.textContent = L.filter((x) => !x.gone).length || ''; t.el.classList.toggle('lit', L.length > 0); });
      nEl.textContent = placed; note.textContent = `bishops on this shelf${arch ? `, ${arch} of them archbishops` : ''}`;
      if (lastB) { const a = A[lastB.i]; cardEl.innerHTML = `<b>${esc(a.n)}</b> <span class="small">${esc(a.d)}</span><small>${esc(a.aff)}</small>`; }
      if (G && moves.length && moves.length < 4) moves.forEach(([bi, old, st]) => { const b = D.bishops.find((x) => x.i === bi), to = tiles[b.sees[st]], from = old >= 0 ? tiles[b.sees[old]] : null;
        if (!to) return; const gr = grid.getBoundingClientRect(), tr = to.el.getBoundingClientRect(), fr = from ? from.el.getBoundingClientRect() : { left: gr.left - 120, top: tr.top, width: 0, height: 0 };
        const chip = document.createElement('div'); chip.className = 'fly'; chip.textContent = surname(A[bi].n); grid.appendChild(chip);
        gsap.fromTo(chip, { x: fr.left - gr.left + fr.width / 2 - 20, y: fr.top - gr.top + fr.height / 2 - 10, opacity: 0.0 },
          { x: tr.left - gr.left + 8, y: tr.top - gr.top + 18, opacity: 1, duration: 0.7, ease: 'power3.inOut', onComplete: () => gsap.to(chip, { opacity: 0, duration: 0.3, onComplete: () => chip.remove() }) }); });
    }
    TG.chapter('#tg-bench', 3400, (p, fin) => apply(fin ? B.length + 1 : p * (B.length + 0.6)), { scrub: 0.4 });
  })();

  /* ---------- 4. Andrewes preaches the year: the XCVI Sermons on a calendar ---------- */
  (function year() {
    const X = D.xcvi, S = X.sermons, GR = X.groups, svg = document.querySelector('#tg-ywrap svg'), card = document.getElementById('tg-sermon');
    const VW = 680, VH = 660, CX = 340, CY = 326, R0 = 50, R1 = 236, Y0 = 1588, Y1 = 1624; svg.setAttribute('viewBox', `0 0 ${VW} ${VH}`);
    const COL = { nat: '#a07c35', ash: '#6d4c7d', lent: '#6d4c7d', pas: '#2d2927', res: '#c9a24a', whit: '#a3382a', aug: '#2f4a6b', nov: '#2f4a6b', occ: '#8a8076' };
    const doy = (m, d) => { const c = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]; return c[m - 1] + d; };
    const TH = (day) => ((day - 335) / 365) * 2 * Math.PI - Math.PI / 2; // Advent at the top, the year going round clockwise
    const RR = (y) => R0 + (clamp(y, Y0, Y1) - Y0) / (Y1 - Y0) * (R1 - R0);
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const guide = mk('g', {}, svg);
    [1590, 1600, 1610, 1620].forEach((y) => { mk('circle', { class: 'ring', cx: CX, cy: CY, r: RR(y), 'stroke-dasharray': '2 4' }, guide);
      mk('text', { class: 'mon', x: CX + 3, y: CY - RR(y) - 3 }, guide).textContent = y; });
    mk('circle', { class: 'ring', cx: CX, cy: CY, r: R1 + 14 }, guide);
    MONTHS.forEach((m, i) => { const th = TH(doy(i + 1, 15)), r = R1 + 30; mk('text', { class: 'mon', x: CX + r * Math.cos(th), y: CY + r * Math.sin(th) + 4, 'text-anchor': 'middle' }, guide).textContent = m.toUpperCase();
      const t0 = TH(doy(i + 1, 1)); mk('line', { x1: CX + (R1 + 8) * Math.cos(t0), y1: CY + (R1 + 8) * Math.sin(t0), x2: CX + (R1 + 20) * Math.cos(t0), y2: CY + (R1 + 20) * Math.sin(t0), stroke: TG.css('--rule') }, guide); });
    [['Christmas', 12, 25], ['5 August', 8, 5], ['5 November', 11, 5]].forEach(([n, m, d]) => { const th = TH(doy(m, d)), r = R1 + 48;
      mk('text', { class: 'feast', x: CX + r * Math.cos(th), y: CY + r * Math.sin(th) + 4, 'text-anchor': Math.cos(th) > 0.2 ? 'start' : Math.cos(th) < -0.2 ? 'end' : 'middle' }, guide).textContent = n; });
    // the moveable feasts: their beads spread over weeks; the labels sit at the middle of each spread
    const med = {}; GR.forEach(([k]) => { const ds = S.filter((s) => GR[s.g][0] === k && s.m && s.d).map((s) => doy(s.m, s.d)).sort((a, b) => a - b); if (ds.length) med[k] = ds[Math.floor(ds.length / 2)]; });
    [['ash', 'Ash Wednesday'], ['res', 'Easter'], ['whit', 'Whitsunday']].forEach(([k, n]) => { if (!med[k]) return; const th = TH(med[k]), r = R1 + 48;
      mk('text', { class: 'feast', x: CX + r * Math.cos(th), y: CY + r * Math.sin(th) + 4, 'text-anchor': Math.cos(th) > 0.2 ? 'start' : Math.cos(th) < -0.2 ? 'end' : 'middle' }, guide).textContent = n; });
    const ylab = mk('text', { class: 'ylab num', x: CX, y: CY + 9, 'text-anchor': 'middle' }, svg); ylab.textContent = Y0;
    // the beads: those whose day is not printed (two prepared sermons) sit at the middle of their feast; two others have no day at all
    const off = [];
    const beads = S.map((s, i) => {
      const k = GR[s.g][0], day = s.m && s.d ? doy(s.m, s.d) : med[k] && (k === 'res' || k === 'whit') ? med[k] : null;
      if (!s.y || !day) off.push(s);
      const th = day ? TH(day) : 0, r = RR(s.y || Y0), x = day ? CX + r * Math.cos(th) : CX, y = day ? CY + r * Math.sin(th) : CY;
      const ln = mk('a', { href: TG.read(X.slug, s.p), target: '_blank', rel: 'noopener', 'aria-label': `${GR[s.g][2] || GR[s.g][1]}, ${s.y}, page ${s.p}` }, svg);
      const c = mk('circle', { class: `bead${s.prep ? ' prep' : ''}`, cx: x, cy: y, r: 5, fill: COL[k] }, ln);
      if (s.prep) c.setAttribute('stroke', COL[k]);
      return { s, c, ln, x, y, k, nd: !(s.m && s.d), ring: !!(s.y && day) };
    });
    document.getElementById('tg-ynote').innerHTML = method(`Hollow beads mark sermons that were prepared but not preached. Andrewes was too ill to preach them. ${off.length ? `${off.length} sermons with no day printed (${off.map((s) => s.y).join(', ')}) stand only in the book’s columns. ` : ''}${S.length} of the ninety-six are shown. Years are as printed. The English year then began on 25 March.`);
    const DAYN = (s) => (s.m && s.d ? `${s.d} ${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][s.m - 1]} ${s.y}` : `${s.y || ''}`);
    const show = (b) => { const {s} = b, g = GR[s.g]; card.innerHTML = `<b>${esc(g[1])}</b>${g[2] ? ` · ${esc(g[2])}` : ''}<small>${esc(DAYN(s))}${s.pl ? `, ${esc(s.pl)}` : ''}${s.who ? `, before ${s.who === 'James' ? 'King James' : 'Queen Elizabeth'}` : ''}${s.prep ? ' · prepared, not preached' : ''}</small><small><a href="${TG.read(X.slug, s.p)}" target="_blank" rel="noopener">Read it, page ${s.p} of the 1629 book</a></small>`; };
    beads.forEach((b) => { b.c.addEventListener('mouseenter', () => show(b)); b.ln.addEventListener('focus', () => show(b)); });
    // the book's columns: the same beads in the order Laud and Buckeridge printed them
    const cols = GR.map((g, gi) => ({ g, gi, xs: 30 + gi * ((VW - 50) / GR.length) }));
    const colLab = mk('g', { opacity: 0 }, svg);
    cols.forEach(({ g, xs }) => { const t = mk('text', { class: 'colh', x: xs + 4, y: 40, transform: `rotate(-38 ${xs + 4} 40)` }, colLab); t.textContent = g[1].replace('The sending of the Holy Ghost', 'Whitsunday').replace('Repentance and fasting', 'Ash Wednesday').replace('The fifth of ', '5 '); });
    function colPos(b) { const gi = b.s.g, list = beads.filter((x) => x.s.g === gi), i = list.indexOf(b); return [cols[gi].xs + 18, 70 + i * 26]; }
    let last = -1;
    function render(p, fin) {
      const yy = fin ? Y1 + 1 : lerp(Y0 - 0.5, Y1 + 0.5, clamp(p / 0.78, 0, 1)), book = fin ? 0 : clamp((p - 0.82) / 0.16, 0, 1);
      ylab.textContent = book > 0.05 ? '' : Math.min(Y1, Math.round(yy));
      guide.style.opacity = 1 - book; ylab.style.opacity = 1 - book; colLab.setAttribute('opacity', book);
      let latest = null;
      beads.forEach((b) => { const vis = b.ring ? b.s.y <= yy : book > 0.6; const e = ease(book), [cx2, cy2] = colPos(b);
        b.c.setAttribute('cx', lerp(b.x, cx2, e)); b.c.setAttribute('cy', lerp(b.y, cy2, e)); b.c.setAttribute('r', vis ? lerp(5, 7, e) : 0);
        if (!b.ring) { b.c.setAttribute('cx', cx2); b.c.setAttribute('cy', cy2); }
        if (vis && b.ring && (!latest || b.s.y > latest.s.y || (b.s.y === latest.s.y && (b.s.m || 0) * 40 + (b.s.d || 0) > (latest.s.m || 0) * 40 + (latest.s.d || 0)))) latest = b; });
      if (book > 0.5) { if (last !== -2) { last = -2; card.innerHTML = '<b>The book of 1629</b><small>The same sermons in the order Laud and Buckeridge printed them. The feasts of the year come first. Then come the fifth of August and the fifth of November and then several occasions. Choose one to open it.</small>'; } }
      else if (latest && latest.s !== last) { last = latest.s; show(latest); }
    }
    TG.chapter('#tg-year', 3600, render, { scrub: 0.5 });
    if (!TG.plays()) render(1, true);
  })();

  /* ---------- explore ---------- */
  explorer = TG.explorer(document.getElementById('tg-explorer'), D, { range: [1480, 1890], first: 'Lancelot Andrewes', placeholder: 'Andrewes, Hooker, catechism…', label: 'Lifelines of the writers on the Anglican shelf' });
  TG.reveal('.tg .reveal');
})();
