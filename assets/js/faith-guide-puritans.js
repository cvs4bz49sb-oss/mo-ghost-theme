/* The Puritans guide: a plain-glass window, the press year by year, a chain of preachers, Richard Baxter's pen, the plain style, three countries. */
(async () => {
  const method = (html) => (window.TFRMethod ? window.TFRMethod.html(html) : html);
  const {TG} = window, D = await TG.load('data');
  const { esc, fmt, clamp, ease, lerp } = TG, G = TG.hasG && !TG.reduce ? window.gsap : null;
  const FAMS = D.fam.map((f) => f[0]), fc = (k) => TG.css(`--f${FAMS.indexOf(k) + 1}`), famName = (k) => (D.fam.find((f) => f[0] === k) || [])[1];
  const gc = (i) => TG.css(`--g${i + 1}`);
  let explorer = null;
  const room = document.getElementById('tg-pur-room'); if (room) room.href = TG.href('puritans/');

  /* ---------- hero: facts, and the writers as the quarries of a plain-glass window ---------- */
  const forties = D.per_dec.filter(([d]) => d === 1640).reduce((t, [, n]) => t + n, 0);
  const facts = { works: D.n_works, authors: D.n_authors, pages: D.n_pages, forties };
  document.querySelectorAll('[data-count]').forEach((el) => TG.countUp(el, facts[el.dataset.count], 1.8));
  (function windowOfQuarries() {
    const svg = document.querySelector('.win svg'), cap = document.querySelector('.win .cap'), NS = 'http://www.w3.org/2000/svg';
    const mk = (tag, at, parent = svg) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); parent.appendChild(e); return e; };
    const A = D.authors.slice().sort((a, b) => (a.y0 - b.y0) || a.n.localeCompare(b.n)), maxP = Math.max(...A.map((a) => a.p));
    // three lights under a four-centered head, in a stone frame
    const LX = [26, 202, 378], LW = 160, TOP = 92, BOT = 676, defs = mk('defs', {});
    const head = (x) => `M${x},${TOP} Q${x},${TOP - 44} ${x + LW / 2},${TOP - 52} Q${x + LW},${TOP - 44} ${x + LW},${TOP}`;
    const lightPath = (x) => `${head(x)} L${x + LW},${BOT} L${x},${BOT} Z`;
    mk('path', { class: 'stone', d: `M8,${BOT + 26} L8,${TOP - 10} Q8,${TOP - 78} 282,${TOP - 86} Q556,${TOP - 78} 556,${TOP - 10} L556,${BOT + 26} Z` });
    LX.forEach((x, i) => { const cp = mk('clipPath', { id: `tg-light-${i}` }, defs); mk('path', { d: lightPath(x) }, cp); });
    // quarry size: the largest diamond lattice that still gives every dated writer a whole pane
    const centres = (cw, ch) => { const out = []; LX.forEach((x, li) => { for (let m = 0; m * ch / 2 <= BOT - TOP + 60; m++) for (let k = 0; k * cw / 2 <= LW + cw; k++) { if ((k + m) % 2) continue;
      const cx = x + k * cw / 2, cy = TOP - 50 + m * ch / 2; out.push({ li, cx, cy, inside: cx - cw / 2 >= x - 0.5 && cx + cw / 2 <= x + LW + 0.5 && cy - ch / 2 >= TOP - 6 && cy + ch / 2 <= BOT + 0.5 }); } }); return out; };
    let cw = 46, Q;
    for (; cw > 18; cw -= 1) { Q = centres(cw, cw * 1.38); if (Q.filter((q) => q.inside).length >= A.length) break; }
    const ch = cw * 1.38;
    const inside = Q.filter((q) => q.inside).sort((p, q) => p.cy - q.cy || p.li - q.li || p.cx - q.cx);
    const slot = new Map(); A.forEach((a, i) => slot.set(inside[Math.round(i * (inside.length - 1) / Math.max(1, A.length - 1))], a));
    let seed = 7; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const groups = LX.map((_, i) => mk('g', { 'clip-path': `url(#tg-light-${i})` }));
    const panes = [];
    Q.forEach((q) => { const a = slot.get(q), d = `M${q.cx},${q.cy - ch / 2} L${q.cx + cw / 2},${q.cy} L${q.cx},${q.cy + ch / 2} L${q.cx - cw / 2},${q.cy} Z`;
      const tint = 0.9 + rnd() * 0.1, base = `rgb(${Math.round(238 * tint)},${Math.round(240 * tint)},${Math.round(232 * tint)})`;
      const p = mk('path', { class: `q${a ? ' a' : ''}`, d, fill: base }, groups[q.li]);
      if (a) { const lit = 0.1 + 0.62 * Math.log(1 + a.p / 30) / Math.log(1 + maxP / 30);
        p.setAttribute('tabindex', 0); p.setAttribute('role', 'button'); p.setAttribute('aria-label', `${a.n}, ${a.d || TG.yr(a)}`);
        panes.push({ p, a, lit, base }); } });
    LX.forEach((x) => mk('path', { class: 'frame', d: lightPath(x) }));
    const sun = mk('linearGradient', { id: 'tg-sun', x1: '-0.6', y1: '0', x2: '-0.2', y2: '1' }, defs);
    [['0', 0], ['0.5', 0.55], ['1', 0]].forEach(([o, a]) => mk('stop', { offset: o, 'stop-color': '#fff7df', 'stop-opacity': a }, sun));
    const beam = LX.map((x, i) => mk('path', { d: lightPath(x), fill: 'url(#tg-sun)', 'pointer-events': 'none', opacity: 0 }));
    const yr = mk('text', { x: 282, y: 712, 'text-anchor': 'middle', fill: TG.css('--muted'), 'font-size': 13, 'font-family': TG.css('--body') });
    const light = (pn, on) => pn.p.setAttribute('fill', on ? `color-mix(in srgb, #efc978 ${Math.round(pn.lit * 100)}%, ${pn.base})` : pn.base);
    const say = (a) => {
      if (a) { cap.dataset.m = ''; cap.textContent = `${a.n}, ${a.d || TG.yr(a)} · ${a.w.length} ${a.w.length === 1 ? 'work' : 'works'} · ${fmt(a.p)} pages · ${famName(a.f)}`; }
      else if (cap.dataset.m !== '1') { cap.dataset.m = '1'; cap.innerHTML = method('Each quarry of plain glass is a writer on the shelf. The writers run in order of birth from the top. Brighter panes hold more pages.'); }
    };
    panes.forEach((pn) => { const on = () => say(pn.a); pn.p.addEventListener('mouseenter', on); pn.p.addEventListener('focus', on);
      pn.p.addEventListener('click', () => explorer && explorer.show(pn.a.n)); pn.p.addEventListener('keydown', (e) => { if (e.key === 'Enter') explorer && explorer.show(pn.a.n); }); });
    svg.addEventListener('mouseleave', () => say(null)); say(null);
    if (!G) { panes.forEach((pn) => light(pn, true)); yr.textContent = `born ${A[0].y0} to ${A[A.length - 1].y0}`; return; }
    const tl = TG.intro({ delay: 0.2 });
    const frames = [...svg.querySelectorAll('.frame')]; frames.forEach((f) => { const L = f.getTotalLength(); f.style.strokeDasharray = L; f.style.strokeDashoffset = L; });
    tl.from(svg.querySelector('.stone'), { opacity: 0, duration: 0.6 })
      .to(frames, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut', stagger: 0.12 }, 0.1)
      .from(groups.map((g) => g.children), { opacity: 0, duration: 0.5, stagger: { each: 0.002, from: 'start' } }, 0.5);
    const o = { i: 0 };
    tl.to(o, { i: panes.length, duration: Math.min(4.2, panes.length * 0.02), ease: 'none', onUpdate() {
      const k = Math.floor(o.i); panes.forEach((pn, j) => { if (j < k && !pn.on) { pn.on = true; light(pn, true); } });
      const cur = panes[Math.min(panes.length - 1, k)]; if (cur) yr.textContent = `born ${cur.a.y0}`; } }, 1.3)
      .add(() => { panes.forEach((pn) => light(pn, true)); yr.textContent = `born ${A[0].y0} to ${A[A.length - 1].y0}`; })
      .to(beam, { opacity: 1, duration: 0.3 })
      .fromTo(sun, { attr: { x1: -0.6, x2: -0.2 } }, { attr: { x1: 1.1, x2: 1.5 }, duration: 2.6, ease: 'power1.inOut' }, '<')
      .to(beam, { opacity: 0, duration: 0.4 });
  })();

  /* ---------- 1. the press: every dated edition in the column of its year ---------- */
  (function press() {
    const box = document.querySelector('.pressbox'), cv = TG.canvas(box.querySelector('canvas')), {ctx} = cv, tip = box.querySelector('.tip');
    const Y0 = 1560, Y1 = 1722, P = D.press, n = P.length;
    const byYear = new Map(); P.forEach((e, i) => { if (!byYear.has(e[0])) byYear.set(e[0], []); byYear.get(e[0]).push(i); });
    const maxY = Math.max(...[...byYear.values()].map((a) => a.length));
    const chron = TG.chronicle(document.getElementById('tg-chron'), D.events, ([y, e, w]) => `<li><span class="d">${y}</span><span class="e">${esc(e)}</span><span class="w">${esc(w)}${y === 1643 ? ` ${D.wa_here.length} writers on this shelf sat in it or served it. <a href="${TG.href('guide/?s=westminster')}">The Westminster guide</a>` : ''}</span></li>`);
    const nEl = document.getElementById('tg-press-n'), capEl = document.getElementById('tg-press-cap'), leg = document.getElementById('tg-glegend');
    leg.innerHTML = D.groups.map(([k, nm], i) => `<span data-g="${i}"><i style="background:var(--g${i + 1})"></i>${esc(nm)} <b>0</b></span>`).join('');
    const legB = [...leg.querySelectorAll('b')];
    let cur = Y0, geo = null;
    function layout() { const {W} = cv, {H} = cv, M = { l: 6, r: 6, t: 34, b: 24 }, cwid = (W - M.l - M.r) / (Y1 - Y0 + 1), th = Math.max(1.2, Math.min(4.2, (H - M.t - M.b) / maxY));
      geo = { W, H, M, cwid, th, x: (y) => M.l + (y - Y0) * cwid, base: H - M.b }; }
    function draw(Y) {
      cur = Y; if (!geo) layout(); const { W, H, M, cwid, th, x, base } = geo; ctx.clearRect(0, 0, W, H);
      const muted = TG.css('--muted'), rule = TG.css('--rule'), rub = TG.css('--rubric');
      ctx.strokeStyle = rule; ctx.beginPath(); ctx.moveTo(M.l, base + 0.5); ctx.lineTo(W - M.r, base + 0.5); ctx.stroke();
      ctx.fillStyle = muted; ctx.font = `11px ${TG.css('--body')}`; ctx.textAlign = 'center';
      for (let y = 1570; y <= 1720; y += 10) { if (W < 560 && y % 50) continue; ctx.fillText(String(y), x(y) + cwid / 2, base + 16); }
      const counts = D.groups.map(() => 0); let shown = 0;
      const colors = D.groups.map((_, i) => gc(i));
      byYear.forEach((ids, y) => { if (y > Y + 1) return; const f = clamp(Y - y + 1, 0, 1), xx = x(y) + 0.5, w = Math.max(1, cwid - 1);
        ids.forEach((i, j) => { const e = P[i], drop = (1 - ease(clamp(f * 1.4 - j / ids.length * 0.4, 0, 1))) * (base - M.t);
          ctx.fillStyle = colors[e[1]]; ctx.globalAlpha = f < 1 ? 0.5 + 0.5 * f : 0.92; ctx.fillRect(xx, base - (j + 1) * th - drop, w, Math.max(0.8, th - 0.4)); if (f >= 0.5) { counts[e[1]]++; shown++; } }); });
      ctx.globalAlpha = 1;
      // the turning points: a mark for each one passed, a label for the latest
      let latest = null; D.events.forEach((ev) => { if (ev[0] <= Y) latest = ev; });
      D.events.forEach(([y]) => { if (y > Y) return; const xx = x(y) + cwid / 2, isNow = latest && latest[0] === y;
        ctx.strokeStyle = rub; ctx.globalAlpha = isNow ? 0.55 : 0.18; ctx.beginPath(); ctx.moveTo(xx, 24); ctx.lineTo(xx, base); ctx.stroke();
        ctx.globalAlpha = isNow ? 1 : 0.55; ctx.fillStyle = rub; ctx.save(); ctx.translate(xx, 24); ctx.rotate(Math.PI / 4); ctx.fillRect(-3, -3, 6, 6); ctx.restore(); });
      if (latest) { const xx = x(latest[0]) + cwid / 2; ctx.globalAlpha = 1; ctx.fillStyle = rub; ctx.font = `italic 13px ${TG.css('--display')}`;
        const lab = `${latest[0]} · ${latest[1]}`, w = ctx.measureText(lab).width; ctx.textAlign = xx + w / 2 > W - 8 ? 'right' : xx - w / 2 < 8 ? 'left' : 'center'; ctx.fillText(lab, ctx.textAlign === 'right' ? W - 8 : ctx.textAlign === 'left' ? 8 : xx, 14); ctx.textAlign = 'center'; }
      ctx.globalAlpha = 1;
      // the year cursor
      if (Y < Y1) { const xx = x(Math.floor(Y)) + cwid; ctx.strokeStyle = TG.css('--ink'); ctx.globalAlpha = 0.35; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(xx, M.t - 4); ctx.lineTo(xx, base); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; }
      nEl.textContent = fmt(shown); capEl.textContent = Y >= Y1 - 1 ? `dated editions on the shelf from ${D.per_dec[0][0]} to ${D.per_dec[D.per_dec.length - 1][0] + 9}. The 1640s alone printed ${fmt(forties)}.` : `editions printed by ${Math.floor(Y)}`;
      legB.forEach((b, i) => { b.textContent = fmt(counts[i]); });
      chron(Y);
    }
    function pick(mx, my) { if (!geo) return null; const { x, cwid, th, base } = geo, y = Y0 + Math.floor((mx - geo.M.l) / cwid), ids = byYear.get(y); if (!ids || y > cur) return null;
      const j = Math.floor((base - my) / th); return j >= 0 && j < ids.length ? P[ids[j]] : null; }
    const cvel = box.querySelector('canvas');
    cvel.addEventListener('mousemove', (ev) => { const b = cvel.getBoundingClientRect(), e = pick(ev.clientX - b.left, ev.clientY - b.top); if (!e) { tip.hidden = true; cvel.style.cursor = 'default'; return; }
      const a = D.authors[e[2]]; cvel.style.cursor = 'pointer'; tip.innerHTML = `${esc(e[4])}<small>${a ? esc(a.n) : ''} · ${e[0]} · ${esc(D.groups[e[1]][1])}</small>`; tip.hidden = false;
      const bb = box.getBoundingClientRect(); tip.style.left = `${Math.min(ev.clientX - bb.left + 12, bb.width - 250)}px`; tip.style.top = `${ev.clientY - bb.top + 14}px`; });
    cvel.addEventListener('mouseleave', () => { tip.hidden = true; });
    const chosen = document.getElementById('tg-press-pick');
    cvel.addEventListener('click', (ev) => { const b = cvel.getBoundingClientRect(), e = pick(ev.clientX - b.left, ev.clientY - b.top); if (!e) return; const a = D.authors[e[2]];
      chosen.innerHTML = `<span class="d">${e[0]}</span> <a href="${TG.read(e[3])}" target="_blank" rel="noopener">${esc(e[4])}</a> <span class="small">${a ? esc(a.n) : ''} · ${esc(D.groups[e[1]][1])}</span>`;
      if (G) gsap.from(chosen, { opacity: 0, y: 6, duration: 0.3 }); });
    new ResizeObserver(() => { cv.size(); layout(); draw(cur); }).observe(cvel);
    TG.chapter('#tg-press', 4400, (p) => draw(lerp(Y0, Y1, p)), { scrub: 0.4 });
  })();

  /* ---------- 2. three countries: the presses (imprints) and the places the records name, in two maps at their own scales ---------- */
  (function lands() {
    const P = D.places, NE = new Set(D.ne), LOW = new Set(D.low);
    const GOF = { London: 0, Cambridge: 1, Oxford: 1, Edinburgh: 2, Glasgow: 2, Aberdeen: 2, Amsterdam: 3, Leiden: 3, Rotterdam: 3, Middelburg: 3, Dordrecht: 3, 'The Hague': 3, Boston: 4, 'Cambridge, Massachusetts': 4 };
    const presses = D.presses.map(([k, n]) => ({ k, n, g: GOF[k] ?? 5, ll: P[k] }));
    const recs = Object.entries(D.recplaces).map(([k, names]) => ({ k, names, ll: P[k], ne: NE.has(k), low: LOW.has(k) }));
    const total = presses.reduce((t, p) => t + p.n, 0), sumG = (gs) => presses.filter((p) => gs.includes(p.g)).reduce((t, p) => t + p.n, 0);
    const neMen = new Set(recs.filter((r) => r.ne).flatMap((r) => r.names)).size;
    const STEPS = [
      ['London', `London printed ${fmt(sumG([0]))} of the ${fmt(total)} dated editions whose imprint names a town. Most of them were printed for booksellers around St Paul’s.`, [0]],
      ['The universities and Scotland', `Cambridge and Oxford printed ${fmt(sumG([1]))}. Edinburgh, Glasgow and Aberdeen printed ${fmt(sumG([2]))}. The Scottish divines’ books are among them.`, [1, 2]],
      ['The Low Countries', `${fmt(sumG([3]))} came from Amsterdam, Rotterdam, Leiden, Middelburg and Dordrecht. English congregations in exile had their printers there.`, [3]],
      ['New England', `Boston and Cambridge in Massachusetts printed ${fmt(sumG([4]))}. ${neMen} writers on the shelf lived or served in New England.`, [4]],
    ];
    const key = document.getElementById('tg-lands-key');
    key.innerHTML = STEPS.map(([b, p]) => `<li><b>${esc(b)}</b><p>${esc(p)}</p></li>`).join(''); const kLis = [...key.children];
    const RADIUS = (n, W) => (2 + Math.sqrt(n) * 0.95) * Math.min(1.2, W / 480);
    const views = [
      { box: document.getElementById('tg-map'), ext: [[-6.4, 50.2], [7.2, 58.4]], par: [51, 57], keep: (ll) => ll[1] > -20 },
      { box: document.getElementById('tg-map-ne'), ext: [[-73.9, 41.05], [-69.7, 43.0]], par: [41, 43], keep: (ll) => ll[1] < -50 },
    ].map((v) => { const M = TG.map(v.box, D.land, v.ext, { parallels: v.par }), cv = TG.canvas(v.box.querySelector('canvas')); return { ...v, M, cv, ctx: cv.ctx, tip: v.box.querySelector('.tip') }; });
    let stepK = 3, grow = 1;
    function drawView(V) {
      const { M, cv, ctx } = V; ctx.clearRect(0, 0, cv.W, cv.H); if (!M.proj) return;
      const on = stepK >= STEPS.length ? [0, 1, 2, 3, 4, 5] : STEPS[Math.max(0, stepK)][2], ink = TG.css('--ink'), rub = TG.css('--rubric'), font = TG.css('--body');
      presses.filter((pr) => V.keep(pr.ll)).forEach((pr) => { const p = M.xy(pr.ll); const vis = on.includes(pr.g), r = RADIUS(pr.n, cv.W) * (vis ? grow : 1);
        ctx.globalAlpha = vis ? 0.72 : 0.14; ctx.fillStyle = gc(pr.g); ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 6.283); ctx.fill();
        if (vis) { ctx.globalAlpha = 1; ctx.fillStyle = ink; ctx.font = `600 11.5px ${font}`; const lab = `${pr.k === 'Cambridge, Massachusetts' ? 'Cambridge' : pr.k} ${fmt(pr.n)}`;
          const left = ['Rotterdam', 'Dordrecht', 'Leiden', 'The Hague', 'Middelburg', 'Cambridge, Massachusetts'].includes(pr.k); ctx.textAlign = left ? 'right' : 'left';
          const dy = { Leiden: -2, 'The Hague': 8, Rotterdam: 4, Dordrecht: 12, Middelburg: 4, Amsterdam: -6, Boston: 4, 'Cambridge, Massachusetts': -6 }[pr.k] ?? 4;
          ctx.fillText(lab, p[0] + (left ? -r - 4 : r + 4), p[1] + dy); } });
      recs.filter((r) => V.keep(r.ll)).forEach((r) => { const p = M.xy(r.ll); if (p[0] < -10 || p[0] > cv.W + 10 || p[1] < -10 || p[1] > cv.H + 10) return;
        const vis = (r.ne && on.includes(4)) || (r.low && on.includes(3)) || (!r.ne && !r.low && on.some((g) => g <= 2)), s = 3.2 + Math.sqrt(r.names.length) * 1.3;
        ctx.globalAlpha = vis ? 0.95 : 0.22; ctx.strokeStyle = ink; ctx.fillStyle = TG.css('--card'); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(p[0], p[1] - s); ctx.lineTo(p[0] + s, p[1]); ctx.lineTo(p[0], p[1] + s); ctx.lineTo(p[0] - s, p[1]); ctx.closePath(); ctx.fill(); ctx.stroke(); });
      // the writers whose records name both an old-world place and a new one
      D.crossings.forEach(([a, from, to]) => { const dest = P[to]; if (!V.keep(dest)) return; const p = V.M.xy(dest), vis = (NE.has(to) && on.includes(4)) || (LOW.has(to) && on.includes(3)); if (!vis) return;
        ctx.globalAlpha = 1; ctx.fillStyle = rub; ctx.font = `italic 12px ${TG.css('--display')}`; ctx.textAlign = 'left'; ctx.fillText(`${a} from ${from}`, p[0] + 9, p[1] - 9); });
      ctx.globalAlpha = 1;
    }
    const drawAll = () => views.forEach(drawView);
    views.forEach((V) => { V.M.onfit = () => { V.cv.size(); drawView(V); };
      const el = V.box.querySelector('canvas');
      el.addEventListener('mousemove', (ev) => { const b = el.getBoundingClientRect(), mx = ev.clientX - b.left, my = ev.clientY - b.top; let hit = null;
        presses.filter((pr) => V.keep(pr.ll)).forEach((pr) => { const p = V.M.xy(pr.ll); if (Math.hypot(p[0] - mx, p[1] - my) < RADIUS(pr.n, V.cv.W) + 2) hit = `${pr.k}: ${fmt(pr.n)} ${pr.n === 1 ? 'edition' : 'editions'} printed here`; });
        recs.filter((r) => V.keep(r.ll)).forEach((r) => { const p = V.M.xy(r.ll); if (Math.hypot(p[0] - mx, p[1] - my) < 7) hit = `${r.k}: ${r.names.slice(0, 8).join(', ')}${r.names.length > 8 ? ` and ${r.names.length - 8} more` : ''}`; });
        if (!hit) { V.tip.hidden = true; return; } V.tip.textContent = hit; V.tip.hidden = false; V.tip.style.left = `${Math.min(mx + 12, b.width - 220)}px`; V.tip.style.top = `${my + 14}px`; });
      el.addEventListener('mouseleave', () => { V.tip.hidden = true; }); });
    function step(k, instant) { if (k === stepK && !instant) return; stepK = k; kLis.forEach((li, j) => li.classList.toggle('now', j === k || k >= STEPS.length));
      if (G && !instant) { const o = { g: 0.15 }; gsap.to(o, { g: 1, duration: 0.8, ease: 'back.out(1.8)', onUpdate() { grow = o.g; drawAll(); } }); } else { grow = 1; drawAll(); } }
    const st = TG.chapter('#tg-lands', 2800, (p, fin) => step(fin ? STEPS.length : Math.min(3, Math.floor(p * 4)), fin), { scrub: true });
    if (!st) { kLis.forEach((li) => li.classList.add('now')); }
  })();

  /* ---------- 3. a chain of preachers (and a sixth link, made by a book, hanging from Sibbes) ---------- */
  (function chain() {
    const C = D.chain, svg = document.querySelector('.chainbox svg'), NS = 'http://www.w3.org/2000/svg', card = document.getElementById('tg-link-card');
    const golden = D.golden.find((g) => /Golden chain, or the description/i.test(g[0])) || D.golden[0]; if (golden) document.getElementById('tg-golden').href = TG.read(golden[1]);
    const mk = (tag, at, parent = svg) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); parent.appendChild(e); return e; };
    const defs = mk('defs', {}); const gr = mk('linearGradient', { id: 'tg-gold', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    [['0', '#e8cf8a'], ['0.5', '#b98c3a'], ['1', '#7d5a22']].forEach(([o, c]) => mk('stop', { offset: o, 'stop-color': c }, gr));
    const pew = mk('linearGradient', { id: 'tg-pewter', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    [['0', '#d9d6cf'], ['0.5', '#a9a49a'], ['1', '#7e786e']].forEach(([o, c]) => mk('stop', { offset: o, 'stop-color': c }, pew));
    const cx = (i) => 92 + i * 169, CY = 118, RX = 92, RY = 50, rub = TG.css('--rubric');
    // a link made by a book hangs from the link of the book's author, turned upright: it closes through the bottom of that link
    const links = C.map((p, i) => { const g = mk('g', {}), bk = p.book, x = bk ? cx(bk.from) : cx(i), y = bk ? CY + RY + RX - 12 : CY, rx = bk ? RY - 6 : RX, ry = bk ? RX : RY;
      const o = mk('ellipse', { class: 'lk', cx: x, cy: y, rx, ry, stroke: 'url(#tg-pewter)' }, g);
      mk('ellipse', { class: 'lk-in', cx: x, cy: y, rx: rx - 12, ry: ry - 12, stroke: '#fff' }, g);
      const t = mk('text', { class: 'nm', x, y: y + 2 }, g); t.textContent = p.n.split(' ').slice(-1)[0];
      const yr = mk('text', { class: 'yr', x, y: y + 20 }, g); yr.textContent = p.d.replace(/^c\.\s*/, 'c. ');
      const L = { g, o, x, y, marks: [] };
      if (bk) { // the thread of the book: a label and an open book beside the hanging link
        const lx = x + rx + 18, ly = y + 6, bg = mk('g', { opacity: 0 });
        mk('path', { d: `M${lx},${ly - 26} q9,-5 18,0 q9,-5 18,0 v14 q-9,-5 -18,0 q-9,-5 -18,0 z M${lx + 18},${ly - 26} v14`, fill: 'none', stroke: rub, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }, bg);
        const v = mk('text', { class: 'via', x: lx, y: ly, 'text-anchor': 'start' }, bg); v.textContent = 'by a book:';
        const v2 = mk('text', { class: 'via', x: lx, y: ly + 16, 'text-anchor': 'start' }, bg); v2.textContent = 'The Bruised Reed';
        L.marks.push(bg);
      } else if (i > 0) {
        // preaching is marked above the chain, so the book's thread below it stays clear
        const lab = mk('text', { class: 'via', x: (cx(i - 1) + cx(i)) / 2, y: CY - RY - 26, opacity: 0 }); lab.textContent = 'brought to faith';
        L.marks.push(lab, mk('path', { d: `M${(cx(i - 1) + cx(i)) / 2 - 20},${CY - RY - 16} l20,8 l20,-8`, fill: 'none', stroke: rub, 'stroke-width': 1.2, opacity: 0 }));
      }
      return L; });
    const steps = document.getElementById('tg-chain-steps');
    steps.innerHTML = `${C.map((p) => `<li><b>${esc(p.n)}</b><p>${esc(p.link ? `${p.link[0].toUpperCase()}${p.link.slice(1)}.` : 'The first link.')}</p></li>`).join('')}<li><b>The chain runs on</b><p>It ran from Cambridge to the London pulpits. With Cotton and Hooker it reached New England in 1633. In Baxter’s books it ran past the Restoration.</p></li>`;
    const lis = [...steps.children];
    const show = (p) => `<p class="eyebrow" style="margin:0 0 4px">${p.link ? esc(p.link) : 'The first link'}</p><h3>${esc(p.n)}</h3><p class="meta">${esc(p.d)}</p><p style="margin:0">${esc(p.say)}</p>
      <div class="stat"><span><b>${p.works}</b>works on the shelf</span><span><b>${fmt(p.pages)}</b>pages</span>${p.first ? `<span><b>${p.first}${p.last !== p.first ? `–${String(p.last).slice(2)}` : ''}</b>printed</span>` : ''}</div>
      <p class="small" style="margin:10px 0 0">The largest here is <a href="${TG.read(p.big[1])}" target="_blank" rel="noopener">${esc(p.big[0])}</a> (${fmt(p.big[2])} pages).${p.book ? ` In his own words: <a href="${TG.read(p.book.cite[0], p.book.cite[1])}" target="_blank" rel="noopener">Reliquiae Baxterianae, p. ${p.book.cite[1]}</a>.` : ''}</p>`;
    let cur = -1;
    function step(k, instant) {
      if (k === cur) return; cur = k; lis.forEach((li, j) => li.classList.toggle('now', j === k));
      links.forEach((L, i) => { const on = i <= k, now = i === k || (k >= C.length && i === C.length - 1);
        L.o.setAttribute('stroke', on ? 'url(#tg-gold)' : 'url(#tg-pewter)');
        if (G && !instant) gsap.to(L.g, { opacity: on ? 1 : 0.38, scale: now ? 1.06 : 1, svgOrigin: `${L.x} ${L.y}`, duration: 0.5, ease: 'back.out(2)' }); else { L.g.setAttribute('opacity', on ? 1 : 0.38); }
        if (L.marks.length) { const v = on ? 1 : 0; if (G && !instant) gsap.to(L.marks, { opacity: v, duration: 0.4 }); else L.marks.forEach((m) => m.setAttribute('opacity', v)); } });
      const p = C[Math.min(k, C.length - 1)], preach = C.filter((c) => !c.book);
      card.innerHTML = k >= C.length ? `<p class="eyebrow" style="margin:0 0 4px">The chain runs on</p><h3>${preach.length === 5 ? 'Five' : preach.length} preachers and a reader with ${fmt(C.reduce((t, c) => t + c.works, 0))} works on this shelf</h3><p style="margin:0">Perkins died in 1602. Preston died in 1628. Cotton died at Boston in New England in 1652. Baxter died in London in 1691. Between them they shaped the preaching of Cambridge, the Inns of Court and the first churches of Massachusetts. Baxter’s books carried it past the Restoration.</p><div class="stat">${C.map((c) => `<span><b>${c.works}</b>${esc(c.n.split(' ').slice(-1)[0])}</span>`).join('')}</div>` : show(p);
      if (G && !instant) gsap.from(card.children, { opacity: 0, y: 8, duration: 0.4, stagger: 0.05, ease: 'power2.out' });
    }
    const st = TG.chapter('#tg-chain', 3400, (p, fin) => step(fin ? C.length : Math.min(C.length, Math.floor(p * (C.length + 1))), fin), { scrub: true });
    if (!st) lis.forEach((li) => li.classList.add('now'));
  })();

  /* ---------- 4. the plain style: Perkins's four rules, and Brooks's The Silent Soul opened part by part ---------- */
  (function plain() {
    const R = D.perkins, S = D.sermon, rules = document.getElementById('tg-rules');
    document.getElementById('tg-arte').href = TG.read(R.slug, R.page);
    document.getElementById('tg-brooks').href = TG.read(S.slug);
    document.getElementById('tg-brooks').textContent = `The Silent Soul by Thomas Brooks (${S.year})`;
    rules.innerHTML = R.rules.map((r) => `<li>${esc(r)}</li>`).join(''); document.getElementById('tg-sum').textContent = `“The Sum of the Sum. ${R.sum}”`;
    const rLis = [...rules.children], stack = document.getElementById('tg-stack'), parts = document.getElementById('tg-parts'), N = S.pages;
    const H = () => stack.clientHeight || 520, Y = (p) => (p - 1) / N * H();
    stack.innerHTML = [1, 100, 200, 300, N].map((p) => `<span class="pg" style="top:${(p - 1) / N * 100}%">p. ${p}</span>`).join('') + S.parts.map((pt, i) => `<div class="seg" data-i="${i}" style="top:${(pt.p[0] - 1) / N * 100}%;height:${Math.max(0.6, (pt.p[1] - pt.p[0] + (pt.p[1] === pt.p[0] ? 1 : 0)) / N * 100)}%"></div>`).join('');
    parts.innerHTML = S.parts.map((pt, i) => `<div class="part" data-i="${i}"><span class="tick"></span><div class="lab"><i>${['Text', 'Sense', 'Doctrine', 'Doctrine', 'Doctrine', 'Use', 'Use', 'Use'][i]}</i>${esc(pt.h)}<small>${pt.p[0] === pt.p[1] ? `p. ${pt.p[0]}` : `pp. ${pt.p[0]}–${pt.p[1]}`}</small></div>
      <div class="q">${esc(pt.q)}<a href="${TG.read(S.slug, pt.p[0] >= 16 ? pt.p[0] : null)}" target="_blank" rel="noopener">read it</a></div></div>`).join('');
    const segs = [...stack.querySelectorAll('.seg')], pEls = [...parts.querySelectorAll('.part')];
    // the labels sit beside their pages, pushed apart where parts are short (the first pages hold four of them)
    function place(open) { const hgt = parts.clientHeight || H(), gap = 30; let last = -1e9;
      const want = S.parts.map((pt) => ((pt.p[0] - 1 + pt.p[1] - 1) / 2) / N * hgt), tops = [];
      want.forEach((w, i) => { const t = Math.max(w - 12, last + gap + (open >= 0 && i - 1 === open ? pEls[open].querySelector('.q').offsetHeight + 8 : 0)); tops.push(t); last = t; });
      const over = last + 40 + (open === S.parts.length - 1 ? pEls[open].querySelector('.q').offsetHeight : 0) - hgt; if (over > 0) for (let i = tops.length - 1; i >= 0; i--) { tops[i] -= over * (i / (tops.length - 1)); }
      pEls.forEach((el, i) => { if (G) gsap.to(el, { top: tops[i], duration: 0.45, ease: 'power2.out' }); else el.style.top = `${tops[i]}px`; }); }
    let cur = -2;
    function step(k, instant) {
      if (k === cur) return; cur = k;
      const pt = S.parts[Math.min(k, S.parts.length - 1)];
      rLis.forEach((li, j) => li.classList.toggle('now', k >= 0 && k < S.parts.length && j === pt.rule));
      segs.forEach((s, i) => { s.classList.toggle('on', i === k); s.classList.toggle('past', i < k); });
      pEls.forEach((el, i) => { el.classList.toggle('on', i === k); el.style.opacity = i <= k || k >= S.parts.length ? 1 : 0.32; });
      if (TG.pinOK()) place(k);
      const on = pEls[k]; if (on && G && !instant) gsap.fromTo(on.querySelector('.q'), { scaleX: 0.2, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.55, ease: 'expo.out', transformOrigin: 'left center' });
    }
    if (TG.pinOK()) { requestAnimationFrame(() => place(-1)); }
    const st = TG.chapter('#tg-sermon', 3600, (p, fin) => step(fin ? -1 : Math.min(S.parts.length - 1, Math.floor(p * S.parts.length)), fin), { scrub: true });
    if (!st) { rLis.forEach((li) => li.classList.add('now')); pEls.forEach((el) => { el.style.opacity = 1; }); }
  })();

  /* ---------- 5. Richard Baxter: the pages of his editions here, added up year by year in four kinds, under the stations of his life ---------- */
  (function baxter() {
    const B = D.baxter, box = document.getElementById('tg-bx'), svg = box.querySelector('svg'), NS = 'http://www.w3.org/2000/svg';
    const E = B.eds, K = B.kinds, X0 = 1640, X1 = 1698, KC = [gc(1), gc(4), gc(2), gc(3)];
    const ORDER = [3, 2, 1, 0]; // kinds as data.json lists them: life, peace, doctrine, practice; stacked practice at the bottom
    const SY = B.steps.map((s) => s[0]);
    const yrs = []; for (let y = X0; y <= X1; y++) yrs.push(y);
    // cum[k][j]: pages of kind k printed by the end of year yrs[j]
    const cum = K.map(() => yrs.map(() => 0)); E.forEach(([y, k, p]) => { for (let j = y - X0; j < yrs.length; j++) cum[k][j] += p; });
    const tot = yrs.map((_, j) => K.reduce((t, _k, k) => t + cum[k][j], 0)), TOT = tot[tot.length - 1];
    const before = E.filter((e) => e[0] <= 1662), alive = E.filter((e) => e[0] > 1662 && e[0] <= 1691), after = E.filter((e) => e[0] > 1691);
    const pins = B.pins.map(([slug, label]) => { const e = E.find((x) => x[4] === slug); return { slug, label, y: e[0], p: e[2] }; });
    document.getElementById('tg-bx-say').innerHTML = `The largest writer on this shelf: ${B.n_works} works, ${fmt(E.reduce((t, e) => t + e[2], 0))} pages in ${E.length} editions printed from ${E[0][0]} to ${E[E.length - 1][0]}.`;
    const steps = document.getElementById('tg-bx-steps');
    steps.innerHTML = B.steps.map(([y, h, t]) => `<li><b>${esc(h)}</b><p>${esc(t)}</p></li>`).join('');
    const lis = [...steps.children];
    const leg = document.getElementById('tg-bx-legend');
    leg.innerHTML = ORDER.map((k) => `<span><i style="background:${KC[k]}"></i>${esc(K[k][1])} <b>0</b></span>`).join('');
    const legB = [...leg.querySelectorAll('b')];
    const nEl = document.getElementById('tg-bx-n'), capEl = document.getElementById('tg-bx-cap');
    document.getElementById('tg-bx-note').innerHTML = `${B.late.length ? `One later reprint, of ${B.late[0][0]}, lies beyond the chart.` : ''} <a href="#explore" id="tg-bx-all">All ${B.n_works} works</a>`;
    document.getElementById('tg-bx-all').addEventListener('click', (ev) => { if (TG._open) { ev.preventDefault(); document.getElementById('explore').scrollIntoView({ behavior: 'smooth' }); TG._open('Richard Baxter'); } });
    const mk = (tag, at, parent) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); (parent || svg).appendChild(e); return e; };
    let G0 = null, cur = X0, curStep = -1;
    function build() {
      const W = Math.max(320, Math.round(box.clientWidth - 16)), narrow = W < 540, H = Math.round(Math.max(330, Math.min(470, W * 0.66)));
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.textContent = '';
      const M = { l: narrow ? 34 : 44, r: 10, t: 74, b: 26 }, pw = W - M.l - M.r, ph = H - M.t - M.b;
      const x = (y) => M.l + (y - X0) / (X1 + 1 - X0) * pw, base = M.t + ph, yv = (v) => base - v / (TOT * 1.04) * ph;
      const defs = mk('defs', {});
      const hat = mk('pattern', { id: 'tg-bx-hatch', width: 5, height: 5, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
      mk('rect', { width: 5, height: 5, fill: TG.css('--stone') || '#ddd3c2' }, hat); mk('line', { x1: 0, y1: 0, x2: 0, y2: 5, stroke: '#a99c86', 'stroke-width': 1.4 }, hat);
      const clip = mk('clipPath', { id: 'tg-bx-clip' }, defs), clipR = mk('rect', { x: 0, y: 0, width: 0, height: H }, clip);
      // axes: a rule a decade, pages up the side
      for (let y = 1640; y <= X1; y += 10) { mk('line', { class: 'grid', x1: x(y), y1: M.t, x2: x(y), y2: base, opacity: 0.55 }); const t = mk('text', { class: 'ax', x: x(y), y: base + 16, 'text-anchor': 'middle' }); t.textContent = y; }
      const step = TOT > 30000 ? 10000 : 5000;
      for (let v = step; v < TOT; v += step) { mk('line', { class: 'grid', x1: M.l, y1: yv(v), x2: W - M.r, y2: yv(v), 'stroke-dasharray': '2 4' }); const t = mk('text', { class: 'ax', x: M.l - 5, y: yv(v) + 3.5, 'text-anchor': 'end' }); t.textContent = narrow ? `${v / 1000}k` : fmt(v); }
      mk('line', { x1: M.l, y1: base + 0.5, x2: W - M.r, y2: base + 0.5, stroke: TG.css('--ink'), 'stroke-width': 1, opacity: 0.6 });
      { const t = mk('text', { class: 'ax', x: M.l - 5, y: M.t - 10, 'text-anchor': 'end' }); t.textContent = 'pages'; }
      // the stations of his life: a strip above the plot; short stations are named above it
      const life = mk('g', {}); const sy = 40, sh = 13;
      const rows = []; // a station too short for its name is named above the strip, on the lowest row where the name is clear
      B.life.forEach(([a, b, lab, say], i) => { const cls = lab === 'Prison' ? 'st x' : lab === 'After his death' ? 'st p' : /Kidderminster/.test(lab) ? 'st k' : 'st';
        const r = mk('rect', { class: cls, x: x(a), y: sy, width: Math.max(2, x(b) - x(a) - 1), height: sh, rx: 2 }, life); const tt = mk('title', {}, r); tt.textContent = `${lab}: ${say}`;
        const w = x(b) - x(a), tw = lab.length * 6.2, short = tw > w - 6, again = B.life.some((l, j) => j > i && l[2] === lab);
        if ((short && (narrow || lab === 'After his death')) || (short && again)) return;
        let row = 0; const cx = Math.max(M.l + tw / 2, (x(a) + x(b)) / 2), x0 = cx - tw / 2 - 4, x1 = cx + tw / 2 + 4;
        if (short) { while ((rows[row] || []).some(([u, v]) => !(x1 < u || x0 > v))) row++; (rows[row] = rows[row] || []).push([x0, x1]); }
        const t = mk('text', { class: 'stl', x: short ? cx : x(a) + 5, y: short ? sy - 6 - row * 13 : sy + sh - 3, 'text-anchor': short ? 'middle' : 'start' }, life); t.textContent = lab; });
      // the 1662 rule
      const r62 = mk('g', { opacity: 0 }); mk('line', { class: 'rule62', x1: x(1662.65), y1: M.t - 8, x2: x(1662.65), y2: base }, r62);
      const r62t = mk('text', { class: 'r62', x: x(1662.65) + 5, y: M.t + 4 }, r62); r62t.textContent = narrow ? 'Ejected, 1662' : 'Ejected, August 1662';
      const died = mk('g', { opacity: 0 }); mk('line', { x1: x(1691.93), y1: M.t + 14, x2: x(1691.93), y2: base, stroke: TG.css('--ink'), 'stroke-width': 1, 'stroke-dasharray': '1 3' }, died);
      { const t = mk('text', { class: 'ax', x: x(1691.93) + 4, y: base - 6 }, died); t.textContent = 'd. 1691'; }
      const prison = mk('rect', { x: x(1685.3), y: M.t, width: x(1687) - x(1685.3), height: ph, fill: 'url(#tg-bx-hatch)', opacity: 0 });
      // the four bands, stacked; the pen line is their top
      const plot = mk('g', { 'clip-path': 'url(#tg-bx-clip)' });
      const px = (j) => x(yrs[j] + 1);
      let lower = yrs.map(() => 0);
      const bands = ORDER.map((k) => { const upper = lower.map((v, j) => v + cum[k][j]);
        let d = `M${x(X0)},${yv(lower[0])}`; yrs.forEach((_, j) => { d += ` L${px(j)},${yv(upper[j])}`; }); for (let j = yrs.length - 1; j >= 0; j--) d += ` L${px(j)},${yv(lower[j])}`; d += ` L${x(X0)},${yv(lower[0])} Z`;
        const el = mk('path', { d, fill: KC[k], opacity: 0.82 }, plot); lower = upper; return el; });
      let pd = `M${x(X0)},${yv(0)}`; yrs.forEach((_, j) => { pd += ` L${px(j)},${yv(tot[j])}`; }); mk('path', { class: 'pen', d: pd }, plot);
      const nib = mk('circle', { class: 'nib', r: 4.5, cx: x(X0), cy: base });
      // the line at any x (for the pen's nib and for placing labels clear of it)
      const lineAt = (xx) => { const yr = X0 + (xx - M.l) / pw * (X1 + 1 - X0) - 1, j = Math.floor(yr - X0); if (j < 0) return yv(0); if (j >= yrs.length - 1) return yv(TOT);
        const f = yr - X0 - j; return yv(tot[j] + (tot[j + 1] - tot[j]) * f); };
      // the named books: a pin on the line at the end of its year, the label in the clear space above-left (the line only rises), else above-right over the line
      const boxes = [], pinEls = pins.map((pn, i) => { const cx = px(pn.y - X0), cy = yv(tot[pn.y - X0]), major = [0, 3, 5, 7].includes(i), g = mk('g', { class: 'pin', opacity: 0 });
        const a = mk('a', { href: TG.read(pn.slug), target: '_blank', rel: 'noopener' }, g); const tt = mk('title', {}, a); tt.textContent = `${pn.label}, ${pn.y} · ${fmt(pn.p)} pages`;
        let lx = 0, ly = 0, anchor = 'end';
        if (!narrow || major) {
          const w = Math.min(pn.label.length * 6.6, 190) + 4; const left = cx - 8 - w >= 2;
          anchor = left ? 'end' : 'start'; lx = left ? cx - 8 : cx + 8;
          const x0 = left ? lx - w : lx, x1 = left ? lx : lx + w; const top = left ? cy - 16 : Math.min(cy, ...[0, 0.25, 0.5, 0.75, 1].map((f) => lineAt(x0 + (x1 - x0) * f))) - 14;
          ly = top; for (let n = 0; n < 12 && boxes.some((b) => !(x1 < b[0] || x0 > b[2] || ly - 26 > b[3] || ly + 2 < b[1])); n++) ly -= 14;
          ly = Math.max(M.t + 22, ly); boxes.push([x0, ly - 26, x1, ly + 2]);
          mk('line', { x1: cx, y1: cy - 5, x2: left ? cx : cx, y2: ly + 3 }, a);
          const t = mk('text', { x: lx, y: ly - 12, 'text-anchor': anchor }, a); t.textContent = pn.label;
          const t2 = mk('text', { x: lx, y: ly + 1, 'text-anchor': anchor }, a); const ts = mk('tspan', { class: 'y' }, t2); ts.textContent = `${pn.y} · ${fmt(pn.p)} pp.`;
        }
        mk('circle', { cx, cy, r: major ? 4.6 : 3.6 }, a);
        return g; });
      G0 = { x, yv, base, clipR, nib, lineAt, r62, prison, died, pinEls, M, W };
    }
    function draw(Y, k) {
      cur = Y; if (!G0) build(); const { x, clipR, nib, lineAt, r62, prison, died, pinEls } = G0, xx = x(Math.min(X1 + 1, Y + 1));
      clipR.setAttribute('width', xx);
      nib.setAttribute('cx', xx); nib.setAttribute('cy', lineAt(xx)); nib.setAttribute('opacity', Y >= X1 ? 0 : 1);
      r62.setAttribute('opacity', Y >= 1662.5 ? 1 : 0); prison.setAttribute('opacity', Y >= 1685.3 ? 0.55 : 0); died.setAttribute('opacity', Y >= 1691.9 ? 1 : 0);
      const named = k >= 0 && k < B.steps.length ? B.steps[k][3] : [];
      pinEls.forEach((g, i) => { g.setAttribute('opacity', pins[i].y <= Y ? 1 : 0); g.classList.toggle('now', named.includes(i)); });
      const upto = E.filter((e) => e[0] <= Y), pages = upto.reduce((t, e) => t + e[2], 0);
      nEl.textContent = fmt(pages);
      capEl.textContent = Y >= X1 ? `pages in ${E.length} editions: ${before.length} printed by 1662, ${alive.length} after his ejection in his lifetime, ${after.length} after his death` : `pages in ${upto.length} editions printed by ${Math.floor(Y)}`;
      ORDER.forEach((kk, i) => { legB[i].textContent = fmt(upto.filter((e) => e[1] === kk).length); });
    }
    function setStep(k) { if (k === curStep) return; curStep = k; lis.forEach((li, j) => li.classList.toggle('now', j === k)); }
    new ResizeObserver(() => { const w = box.clientWidth; if (G0 && Math.abs((G0.W + 16) - w) < 4) return; G0 = null; draw(cur, curStep); }).observe(box);
    const smooth = (t) => t * t * (3 - 2 * t);
    const st = TG.chapter('#tg-baxter', 4200, (p, fin) => {
      if (fin) { setStep(-1); draw(X1, -1); lis.forEach((li) => li.classList.add('now')); return; }
      const n = SY.length, k = Math.min(n - 1, Math.floor(p * n)), t = clamp((p * n - k) / 0.6, 0, 1), from = k ? SY[k - 1] : X0;
      setStep(k); draw(from + (SY[k] - from) * smooth(t), k);
    }, { scrub: 0.4 });
    if (!st) lis.forEach((li) => li.classList.add('now'));
  })();

  /* ---------- explore ---------- */
  explorer = TG.explorer(document.getElementById('tg-explorer'), D, { range: [1530, 1740], first: 'Richard Sibbes', placeholder: 'Sibbes, Owen, The Bruised Reed…', label: 'Lifelines of the writers on the Puritan shelf' });
  TG.reveal('.tg .reveal');
})();
