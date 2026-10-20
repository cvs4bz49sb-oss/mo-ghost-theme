/* The English Divines guide: a title page whose border is the shelf's writers, the press year by year, the parties as shares,
   where they served in Britain, the printed sermons sorted by the pulpit they were preached from, and the finder. */
(async () => {
  const {TG} = window, D = await TG.load('data'), LAND = await TG.load('land');
  const method = (html) => (window.TFRMethod ? window.TFRMethod.html(html) : html);
  const { esc, fmt, clamp, ease, lerp } = TG, G = TG.hasG && !TG.reduce ? window.gsap : null;
  const FAMS = D.fam.map((f) => f[0]), fcI = (i) => TG.css(`--f${i + 1}`), fc = (k) => fcI(FAMS.indexOf(k)), famName = (k) => (D.fam.find((f) => f[0] === k) || [])[1];
  const ALL = D.authors.concat(D.undated);
  let explorer = null;

  /* ---------- hero: facts, and the shelf as a title page ---------- */
  const facts = { works: D.n_works, authors: ALL.length, pages: D.n_pages, dated: D.n_dated };
  document.querySelectorAll('[data-count]').forEach((el) => TG.countUp(el, facts[el.dataset.count], 1.8));
  (function titlePage() {
    const svg = document.querySelector('.tp svg'), cap = document.querySelector('.tp .cap'), NS = 'http://www.w3.org/2000/svg';
    const mk = (tag, at, txt) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); if (txt != null) e.textContent = txt; svg.appendChild(e); return e; };
    const Wd = 420, Ht = 560;
    mk('rect', { class: 'paper', x: 0, y: 0, width: Wd, height: Ht, rx: 2 });
    const rules = [mk('rect', { class: 'rule', x: 12, y: 12, width: Wd - 24, height: Ht - 24, 'stroke-width': 1.8 }), mk('rect', { class: 'rule', x: 17, y: 17, width: Wd - 34, height: Ht - 34, 'stroke-width': 0.6 }),
      mk('rect', { class: 'rule', x: 46, y: 46, width: Wd - 92, height: Ht - 92, 'stroke-width': 0.6 }), mk('rect', { class: 'rule', x: 50, y: 50, width: Wd - 100, height: Ht - 100, 'stroke-width': 1.4 })];
    // the border: every writer with a date, one ornament each, clockwise from the top left in order of birth; size by pages
    const A = D.authors.concat(D.undated), n = A.length, inset = 31.5, pw = Wd - 2 * inset, ph = Ht - 2 * inset, per = 2 * (pw + ph), maxP = Math.max(...A.map((a) => a.p));
    const at = (s) => { s %= per; if (s < pw) return [inset + s, inset]; s -= pw; if (s < ph) return [inset + pw, inset + s]; s -= ph; if (s < pw) return [inset + pw - s, inset + ph]; s -= pw; return [inset, inset + ph - s]; };
    const orns = A.map((a, i) => { const [x, y] = at((i + 0.5) / n * per), r = 1.7 + 3.1 * Math.sqrt(a.p / maxP);
      const g = mk('g', { class: 'orn', transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` });
      const d = document.createElementNS(NS, 'path'); d.setAttribute('d', `M0,${-r} L${r},0 L0,${r} L${-r},0 Z`); d.setAttribute('fill', fc(a.f)); if (!a.y0) d.setAttribute('fill-opacity', 0.45); g.appendChild(d);
      return { a, g, x, y }; });
    // corner pieces: a quatrefoil in each corner of the border
    const corners = [[inset, inset], [Wd - inset, inset], [Wd - inset, Ht - inset], [inset, Ht - inset]].map(([x, y]) => { const g = mk('g', { transform: `translate(${x} ${y})` });
      [[0, -4], [4, 0], [0, 4], [-4, 0]].forEach(([dx, dy]) => { const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', dx); c.setAttribute('cy', dy); c.setAttribute('r', 3.6); c.setAttribute('fill', '#a3382a'); g.appendChild(c); });
      const c = document.createElementNS(NS, 'circle'); c.setAttribute('r', 2.2); c.setAttribute('fill', '#f8f0dc'); g.appendChild(c); return g; });
    const X = Wd / 2, lines = [
      mk('text', { x: X, y: 104, 'text-anchor': 'middle', class: 't-sc' }, 'THE'),
      mk('text', { x: X, y: 160, 'text-anchor': 'middle', class: 't-big' }, 'ENGLISH'),
      mk('text', { x: X, y: 212, 'text-anchor': 'middle', class: 't-big t-red' }, 'DIVINES'),
      mk('text', { x: X, y: 244, 'text-anchor': 'middle', class: 't-it' }, 'or,'),
      mk('text', { x: X, y: 270, 'text-anchor': 'middle', class: 't-cap' }, 'A SHELF OF THE CHURCH'),
      mk('text', { x: X, y: 288, 'text-anchor': 'middle', class: 't-cap' }, 'OF ENGLAND'),
      mk('text', { x: X, y: 313, 'text-anchor': 'middle', class: 't-it' }, 'her Reformers and her Bishops,'),
      mk('text', { x: X, y: 332, 'text-anchor': 'middle', class: 't-it' }, 'her Puritans and Dissenters,'),
      mk('text', { x: X, y: 351, 'text-anchor': 'middle', class: 't-it' }, 'and her Methodists.')];
    const rule2 = mk('path', { class: 'rule', d: `M${X - 70},228 L${X + 70},228 M${X - 50},366 L${X + 50},366`, 'stroke-width': 0.8 });
    // the printer's device: a roundel that counts the writers as they are set in the border
    const dev = mk('g', { transform: `translate(${X} 408)` });
    [['circle', { r: 34, fill: 'none', stroke: '#3a3029', 'stroke-width': 1.2 }], ['circle', { r: 29, fill: 'none', stroke: '#3a3029', 'stroke-width': 0.5 }]].forEach(([t, a]) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); dev.appendChild(e); });
    const devN = document.createElementNS(NS, 'text'); devN.setAttribute('class', 'dev-n'); devN.setAttribute('text-anchor', 'middle'); devN.setAttribute('y', 4); devN.textContent = '0'; dev.appendChild(devN);
    const devL = document.createElementNS(NS, 'text'); devL.setAttribute('class', 'dev-l'); devL.setAttribute('text-anchor', 'middle'); devL.setAttribute('y', 17); devL.textContent = 'writers'; dev.appendChild(devL);
    const imprint = [mk('text', { x: X, y: 462, 'text-anchor': 'middle', class: 't-cap' }, 'LONDON,'),
      mk('text', { x: X, y: 478, 'text-anchor': 'middle', class: 't-sm' }, 'Printed for the library of The Faith Received,'),
      mk('text', { x: X, y: 492, 'text-anchor': 'middle', class: 't-sm' }, `${fmt(D.n_works)} books, from the Reformers to the Oxford Movement.`)];
    const say = (o) => {
      if (o) { cap.dataset.m = ''; cap.textContent = `${o.a.n}, ${o.a.d || TG.yr(o.a)} · ${o.a.w.length} ${o.a.w.length === 1 ? 'work' : 'works'} · ${famName(o.a.f)}`; }
      else if (cap.dataset.m !== '1') { cap.dataset.m = '1'; cap.innerHTML = method('Each ornament in the border is one of the shelf’s writers. They run clockwise from the top left in order of birth. Writers with no dates close the border. Larger ornaments mean more pages. Point at one to read it.'); }
    };
    let hot = null;
    svg.addEventListener('mousemove', (e) => { const b = svg.getBoundingClientRect(), k = Wd / b.width, mx = (e.clientX - b.left) * k, my = (e.clientY - b.top) * k;
      let best = null, bd = 9; for (const o of orns) { const d = Math.hypot(o.x - mx, o.y - my); if (d < bd) { bd = d; best = o; } }
      if (best !== hot) { if (hot) hot.g.setAttribute('transform', `translate(${hot.x.toFixed(1)} ${hot.y.toFixed(1)})`); hot = best; if (hot) hot.g.setAttribute('transform', `translate(${hot.x.toFixed(1)} ${hot.y.toFixed(1)}) scale(2.2)`); say(hot); } });
    svg.addEventListener('mouseleave', () => { if (hot) hot.g.setAttribute('transform', `translate(${hot.x.toFixed(1)} ${hot.y.toFixed(1)})`); hot = null; say(null); });
    svg.addEventListener('click', () => { if (hot && explorer) explorer.show(hot.a.n); });
    say(null);
    if (!G) { devN.textContent = fmt(n); return; }
    const draw = (el) => { const L = el.getTotalLength ? el.getTotalLength() : 1000; el.style.strokeDasharray = L; el.style.strokeDashoffset = L; return el; };
    const tl = TG.intro({ delay: 0.2 });
    tl.to([...rules, rule2].map(draw), { strokeDashoffset: 0, duration: 1.2, ease: 'power2.inOut', stagger: 0.1 })
      .from(lines, { opacity: 0, scale: 1.06, filter: 'blur(3px)', transformOrigin: '50% 50%', duration: 0.7, ease: 'power2.out', stagger: 0.09 }, 0.4)
      .from(corners, { scale: 0, transformOrigin: '50% 50%', duration: 0.5, ease: 'back.out(2)', stagger: 0.1 }, 0.9)
      .from(orns.map((o) => o.g.firstChild), { scale: 0, transformOrigin: '0 0', duration: 0.35, ease: 'back.out(3)', stagger: 2.6 / n }, 1.1)
      .to({ v: 0 }, { v: n, duration: 2.6, ease: 'none', onUpdate() { devN.textContent = fmt(Math.round(this.targets()[0].v)); } }, 1.1)
      .from([dev, ...imprint], { opacity: 0, y: 6, duration: 0.6, stagger: 0.12 }, 1.4)
      // the impression: the page meets the platen once
      .to(svg, { scale: 0.985, transformOrigin: '50% 50%', duration: 0.18, ease: 'power2.in' }, '+=0.15')
      .to(svg, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.5)' });
  })();

  /* ---------- 1. the press: every dated printing, year by year ---------- */
  (function press() {
    const box = document.getElementById('tg-pressbox'), cv = TG.canvas(box.querySelector('canvas')), {ctx} = cv, tip = box.querySelector('.tip');
    const P = D.press, Y0 = 1530, Y1 = 1700, yrEl = document.getElementById('tg-pyr'), ct = document.getElementById('tg-pct').querySelector('b');
    const chron = TG.chronicle(document.getElementById('tg-chron'), D.events.filter((e) => e[0] <= 1700), ([y, e, w]) => `<li><span class="d">${y}</span><span class="e">${esc(e)}</span><span class="w">${esc(w)}</span></li>`);
    document.getElementById('tg-plegend').innerHTML = D.fam.map(([k, nm], i) => [nm, i, D.press.filter((r) => r[1] === i).length]).filter((x) => x[2]).map(([nm, i, c]) => `<span><i style="background:${fcI(i)}"></i>${esc(nm)} <span class="num">${fmt(c)}</span></span>`).join('');
    const pre = P.filter((r) => r[0] < Y0).length;
    document.getElementById('tg-pnote').innerHTML = method(`<p>Each mark is one printed book on the shelf. It stands in the year it came from the press and takes the color of its party.</p><p>${fmt(P.length)} printings dated from 1530 to 1700${pre ? ` (and ${pre} earlier)` : ''}. The Early English Books end in 1700. The shelf goes on after them in later editions: Wesley and Whitefield, the Methodist preachers, and Pusey.</p>`);
    // stack each year's printings by party
    const byY = new Map(); P.forEach((r, i) => { if (r[0] < Y0) return; if (!byY.has(r[0])) byY.set(r[0], []); byY.get(r[0]).push(i); });
    const maxN = Math.max(...[...byY.values()].map((a) => a.length));
    let year = Y0; const M = { l: 14, r: 14, t: 110, b: 30 };
    const geom = () => { const cw = (cv.W - M.l - M.r) / (Y1 - Y0 + 1), ih = Math.max(1.6, Math.min(4.2, (cv.H - M.t - M.b) / maxN)); return { cw, ih, base: cv.H - M.b }; };
    function render(Y) {
      year = Y; ctx.clearRect(0, 0, cv.W, cv.H); const { cw, ih, base } = geom(), ink = TG.css('--rule'), muted = TG.css('--muted');
      ctx.strokeStyle = ink; ctx.beginPath(); ctx.moveTo(M.l, base + 0.5); ctx.lineTo(cv.W - M.r, base + 0.5); ctx.stroke();
      ctx.fillStyle = muted; ctx.font = `11px ${TG.css('--body')}`; ctx.textAlign = 'center';
      for (let y = 1550; y <= 1700; y += 25) ctx.fillText(String(y), M.l + (y - Y0 + 0.5) * cw, base + 18);
      let shown = 0;
      byY.forEach((idx, y) => {
        if (y > Y) return; const fresh = clamp(Y - y, 0, 1), drop = 1 - ease(fresh), x = M.l + (y - Y0) * cw;
        idx.forEach((i, k) => { const r = P[i]; ctx.globalAlpha = 0.86; ctx.fillStyle = fcI(r[1]);
          const yy = base - (k + 1) * ih - drop * (60 + k * 3); ctx.fillRect(x + 0.4, yy, Math.max(1, cw - 0.8), Math.max(1, ih - 0.6)); });
        shown += idx.length;
      });
      ctx.globalAlpha = 1;
      const cx = M.l + (Math.min(Y, Y1) - Y0 + 0.5) * cw; ctx.strokeStyle = TG.css('--rubric'); ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(cx, M.t - 20); ctx.lineTo(cx, base); ctx.stroke(); ctx.globalAlpha = 1;
      yrEl.textContent = Math.round(Math.min(Y, Y1)); ct.textContent = fmt(shown); chron(Y);
    }
    const hitAt = (mx, my) => { const { cw, ih, base } = geom(), y = Y0 + Math.floor((mx - M.l) / cw), idx = byY.get(y); if (!idx || y > year) return null; const k = Math.floor((base - my) / ih); return idx[k] != null ? P[idx[k]] : null; };
    box.addEventListener('mousemove', (e) => { const b = box.getBoundingClientRect(), r = hitAt(e.clientX - b.left, e.clientY - b.top);
      if (!r) { tip.hidden = true; box.style.cursor = ''; return; } const a = D.authors[r[4]]; box.style.cursor = 'pointer';
      tip.innerHTML = `${esc(r[3])}<small>${r[0]}${a ? ` · ${esc(a.n)}` : ''} · ${esc(D.fam[r[1]][1])}</small>`; tip.hidden = false;
      tip.style.left = `${Math.min(e.clientX - b.left + 12, b.width - 260)}px`; tip.style.top = `${Math.max(8, e.clientY - b.top - 60)}px`; });
    box.addEventListener('mouseleave', () => { tip.hidden = true; });
    const pick = document.getElementById('tg-ppick');
    box.addEventListener('click', (e) => { const b = box.getBoundingClientRect(), r = hitAt(e.clientX - b.left, e.clientY - b.top); if (!r) return; const a = D.authors[r[4]];
      pick.innerHTML = `<span class="num" style="color:var(--rubric);font-weight:600">${r[0]}</span> <a href="${TG.read(r[2])}" target="_blank" rel="noopener">${esc(r[3])}</a>${a ? ` · ${esc(a.n)}` : ''}`;
      if (G) gsap.fromTo(pick, { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 0.3 }); });
    let rt; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { cv.size(); render(year); }, 100); }).observe(box);
    TG.chapter('#tg-press', 4200, (p) => render(lerp(Y0, Y1 + 0.99, p)), { scrub: 0.4 });
  })();

  /* ---------- 2. the parties: the decades as columns, then as shares, then each party ---------- */
  (function parties() {
    const host = document.getElementById('tg-shares'), svg = host.querySelector('svg'), tip = host.querySelector('.tip'), card = document.getElementById('tg-pcard');
    const S = D.streams.filter((r) => r[1] + r[2] + r[3] + r[4] > 0), NS = 'http://www.w3.org/2000/svg';
    const W = 640, Hh = 300, ml = 34, mb = 26, cw = (W - ml - 6) / S.length, maxT = Math.max(...S.map((r) => r[1] + r[2] + r[3] + r[4]));
    svg.setAttribute('viewBox', `0 0 ${W} ${Hh}`);
    const axis = document.createElementNS(NS, 'g'); svg.appendChild(axis);
    S.forEach((r, i) => { if (r[0] % 50 === 0) { const t = document.createElementNS(NS, 'text'); t.setAttribute('x', ml + (i + 0.5) * cw); t.setAttribute('y', Hh - 8); t.setAttribute('text-anchor', 'middle'); t.textContent = r[0]; axis.appendChild(t); } });
    const yl = document.createElementNS(NS, 'text'); yl.setAttribute('x', 0); yl.setAttribute('y', 12); axis.appendChild(yl);
    const rects = S.map((r, i) => [0, 1, 2, 3].map((p) => { const e = document.createElementNS(NS, 'rect'); e.setAttribute('x', ml + i * cw + 1); e.setAttribute('width', Math.max(1, cw - 2)); e.setAttribute('fill', fcI(p)); e.setAttribute('y', Hh - mb); e.setAttribute('height', 0); svg.appendChild(e);
      e.addEventListener('mousemove', (ev) => { const b = host.getBoundingClientRect(), tot = r[1] + r[2] + r[3] + r[4]; tip.innerHTML = `${r[0]}s: ${fmt(r[p + 1])} ${D.fam[p][1].toLowerCase()}<small>${Math.round(100 * r[p + 1] / tot)}% of ${fmt(tot)} works that decade</small>`; tip.hidden = false;
        tip.style.left = `${Math.min(ev.clientX - b.left + 12, b.width - 220)}px`; tip.style.top = `${ev.clientY - b.top - 50}px`; });
      e.addEventListener('mouseleave', () => { tip.hidden = true; }); return e; }));
    const layout = (mode, focus) => S.map((r, i) => { const tot = r[1] + r[2] + r[3] + r[4], hgt = Hh - mb - 18; let y = Hh - mb;
      return [0, 1, 2, 3].map((p) => { const v = r[p + 1], h = mode === 'abs' ? hgt * v / maxT : hgt * v / (tot || 1); y -= h; return { y, h, o: focus == null || focus === p ? 1 : 0.16 }; }); });
    const top = (p) => ALL.filter((a) => FAMS.indexOf(a.f) === p).sort((a, b) => b.w.length - a.w.length).slice(0, 6).map((a) => a.n);
    const PARTY = [
      ['Puritans', 'The godly who pressed for a further reformation of the church’s worship and discipline and the Dissenters who left it after 1662.', 'puritans/', 'the Puritans'],
      ['Anglicans', 'The church of the Prayer Book and the bishops: the Elizabethan and Caroline divines, the churchmen of the Restoration, and in the nineteenth century the Oxford Movement.', 'anglicans/', 'the Anglicans'],
      ['Methodists', 'The revival of John and Charles Wesley and George Whitefield from 1738. The preachers and commentators of the societies came after them.', 'methodists/', 'the Methodists'],
    ];
    const STEPS = [
      ['Decade by decade', `${fmt(D.n_works)} works by the decade they were printed. Later books go by the decade their writers were at work. The years of the war and of the Restoration stand highest.`],
      ['As shares', 'The same decades drawn to one height. Each column shows the parties’ share of the shelf in its time.'],
      ['The Puritans', ''], ['The Anglicans', ''], ['The Methodists', ''],
      ['Three guides', 'Each party has a guide of its own. So does the Westminster Assembly.']];
    const stepsEl = document.getElementById('tg-psteps'); stepsEl.innerHTML = STEPS.map(([b, p2], i) => `<li><b>${esc(b)}</b>${p2 ? `<p>${esc(p2)}</p>` : `<p>${esc(PARTY[i - 2][1])}</p>`}</li>`).join('');
    const lis = [...stepsEl.children];
    function cardFor(k) {
      if (k <= 1) { card.innerHTML = `<h3>${fmt(D.n_works)} works</h3><p class="who">${D.fam.map(([, nm], i) => `<span style="white-space:nowrap"><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${fcI(i)};margin-right:5px"></i>${esc(nm)} ${fmt(D.n_party[i])}</span>`).join(' · ')}</p><p>Most of the shelf is Puritan. The Anglicans come next and the Methodists after them.</p>`; return; }
      if (k <= 4) { const p = k - 2, [nm, , href, lab] = PARTY[p];
        card.innerHTML = `<h3><i style="background:${fcI(p)}"></i>${nm} <span class="small">${fmt(D.n_party[p])} works</span></h3><p class="who">Most here: ${top(p).map(esc).join(', ')}</p><div class="go"><a href="${TG.href(href)}" target="_blank" rel="noopener">Browse ${lab} on their shelf</a></div>`; return; }
      card.innerHTML = `<h3>Guides of their own</h3><p>The Puritans, the Anglicans and the Methodists each have a guide. So does the Westminster Assembly of 1643 to 1653. Their shelves are in the library now:</p>
        <div class="go"><a href="${TG.href('puritans/')}" target="_blank" rel="noopener">The Puritans</a><a href="${TG.href('anglicans/')}" target="_blank" rel="noopener">The Anglicans</a><a href="${TG.href('methodists/')}" target="_blank" rel="noopener">The Methodists</a><a href="${TG.href('westminster-assembly/')}" target="_blank" rel="noopener">The Westminster Assembly</a></div>`;
    }
    let cur = -1;
    function step(k, instant) {
      if (k === cur) return; cur = k; lis.forEach((li, i) => li.classList.toggle('now', i === k));
      const L = layout(k === 0 ? 'abs' : 'share', k >= 2 && k <= 4 ? k - 2 : null);
      yl.textContent = k === 0 ? `${fmt(maxT)} works` : '100%';
      rects.forEach((col, i) => col.forEach((e, p) => { const b = L[i][p];
        if (G && !instant) gsap.to(e, { attr: { y: b.y, height: b.h }, opacity: b.o, duration: 0.8, ease: 'power3.inOut', delay: i * 0.012 });
        else { e.setAttribute('y', b.y); e.setAttribute('height', b.h); e.style.opacity = b.o; } }));
      cardFor(k); if (G && !instant) gsap.fromTo(card.children, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.05 });
    }
    step(0, true);
    if (G) gsap.from(rects.flat(), { attr: { height: 0, y: Hh - mb }, duration: 0.8, stagger: 0.003, ease: 'power2.out', scrollTrigger: { trigger: host, start: 'top 85%', once: true } });
    const st = TG.chapter('#tg-parties', 3000, (p, fin) => step(fin ? 5 : Math.min(5, Math.floor(p * 6)), fin), { scrub: true });
    if (!st) lis.forEach((li) => li.classList.add('now'));
  })();

  /* ---------- 3. where they served: places named in the writers' own records ---------- */
  (function britain() {
    const box = document.getElementById('tg-bmap'), M = TG.map(box, LAND, [[-10.6, 49.9], [2.1, 58.7]], { parallels: [50, 58] });
    const cv = TG.canvas(box.querySelector('canvas')), {ctx} = cv, A = D.authors;
    const arrive = (a) => (a.printed ? a.y0 : a.y0 + 25);
    const BR = (ll) => ll[1] > -11 && ll[1] < 2.5 && ll[0] > 49.5 && ll[0] < 59.5;
    const places = Object.entries(D.places).map(([k, v]) => ({ k, ll: v.ll, a: v.a })).filter((p) => BR(p.ll));
    const abroadP = Object.entries(D.places).filter(([, v]) => !BR(v.ll)).map(([k]) => k);
    document.getElementById('tg-abroad').innerHTML = `${D.overseas.length ? `<b>Across the Atlantic:</b> ${D.overseas.map((i) => esc(A[i].n)).join(', ')}. ` : ''}${abroadP.length ? `<b>Abroad:</b> ${abroadP.map(esc).join(', ')}.` : ''}`;
    const yEl = document.getElementById('tg-byr'), ribbon = document.getElementById('tg-bribbon'); let year = 1500, lastR = '';
    function render(Y) {
      year = Y; ctx.clearRect(0, 0, cv.W, cv.H); const ink = TG.css('--ink'), boxes = []; ctx.font = `italic 12px ${TG.css('--display')}`;
      const vis = places.map((p) => { const here = p.a.filter((i) => arrive(A[i]) <= Y); return { p, here }; }).filter((v) => v.here.length).sort((a, b) => b.here.length - a.here.length);
      const R = (here) => 2.6 + Math.sqrt(here.length) * 2.5, labs = [];
      for (const { p, here } of vis.slice().reverse()) { const [x, y] = M.xy(p.ll), r = R(here), cnt = [0, 0, 0, 0]; here.forEach((i) => { cnt[FAMS.indexOf(A[i].f)]++; });
        let a0 = -Math.PI / 2; cnt.forEach((c, fi) => { if (!c) return; const a1 = a0 + c / here.length * Math.PI * 2; ctx.fillStyle = fcI(fi); ctx.globalAlpha = 0.88; ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r, a0, a1); ctx.closePath(); ctx.fill(); a0 = a1; });
        const fresh = here.some((i) => Y - arrive(A[i]) < 12); ctx.globalAlpha = 1; ctx.strokeStyle = fresh ? TG.css('--rubric') : TG.css('--card'); ctx.lineWidth = fresh ? 2 : 1.2; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.stroke(); ctx.lineWidth = 1;
        labs.push({ k: p.k, x, y, r, n: here.length, fresh }); }
      // the names last, largest places first, none over another
      for (const L of labs.sort((a, b) => b.n - a.n)) { if (L.n < 2 && !L.fresh) continue; const w = ctx.measureText(L.k).width; let lx = L.x + L.r + 4, ly = L.y + 4;
        const hit = (bx, by2) => boxes.some((b) => bx < b[0] + b[2] && bx + w > b[0] && by2 - 10 < b[1] + 3 && by2 + 3 > b[1] - 10);
        if (hit(lx, ly)) { lx = L.x - L.r - 4 - w; } if (hit(lx, ly)) { lx = L.x - w / 2; ly = L.y + L.r + 13; } if (hit(lx, ly)) continue;
        boxes.push([lx, ly, w]); ctx.fillStyle = TG.css('--land'); ctx.globalAlpha = 0.8; ctx.fillRect(lx - 2, ly - 11, w + 4, 14); ctx.globalAlpha = 1; ctx.fillStyle = ink; ctx.fillText(L.k, lx, ly); }
      yEl.textContent = Math.round(Y);
      const recent = A.filter((a) => arrive(a) <= Y && arrive(a) > Y - 30 && places.some((p) => p.a.includes(A.indexOf(a)))).slice(-10);
      const key = recent.map((a) => a.n).join('|'); if (key !== lastR) { lastR = key; ribbon.innerHTML = recent.map((a) => `<span><i style="background:${fc(a.f)}"></i>${esc(a.n)}</span>`).join(''); }
    }
    M.onfit = () => { cv.size(); render(year); };
    TG.chapter('#tg-brit', 3800, (p) => render(lerp(1500, 1880, p)), { scrub: 0.4 });
  })();

  /* ---------- 4. the pulpits: every printed sermon, sorted into rows by the pulpit its title page names ---------- */
  (function pulpits() {
    const U = D.pulpits, box = document.getElementById('tg-ubox'), cv = TG.canvas(box.querySelector('canvas')), {ctx} = cv, tip = box.querySelector('.tip'), card = document.getElementById('tg-ucard');
    const [Y0, Y1] = U.range, NR = U.rows.length, PILE = NR - 1, Sy = U.say, NS = 8;
    // each sermon as [year, row, party, writer, slug, title, title as first printed]; one that is also a printing in the press keeps only its index there
    const S = U.s.map((r) => (r.length === 3 ? (([y, f, slug, t, ai]) => [y, r[1], f, ai, slug, t, r[2]])(D.press[r[0]]) : r));
    const N = S.length, cnt = U.rows.map((_, k) => S.filter((r) => r[1] === k).length), named = N - cnt[PILE], pp = Sy.party, sp = Sy.span;
    const STEPS = [
      ['Every printed sermon', `${fmt(N)} sermons on the shelf were printed from ${Y0} to ${Y1}. Each is a dot in the year it came from the press, colored by its party. ${Math.round(100 * named / N)}% name on the title page where they were preached or to whom.`],
      ['Paul’s Cross', `The open-air pulpit in the churchyard of St Paul’s, London. The shelf’s ${cnt[0]} sermons from it were printed between ${sp[0][0]} and ${sp[0][1]}.`],
      ['Before Parliament', `${cnt[1]} sermons were preached to the Commons or the Lords. ${Sy.parl_1640s} of them were printed in the 1640s. ${Sy.parl_fast} name a day of fasting or humiliation and ${Sy.parl_thanks} a thanksgiving. ${pp[1][0]} are by Puritans.`],
      ['At court', `${cnt[2]} sermons were preached before the King or the Queen at Whitehall and the royal chapels. ${Sy.court_1660} were printed after 1660 and ${Sy.court_1690s} in the 1690s alone. ${pp[2][1]} are by Anglicans.`],
      ['At a funeral', `${cnt[3]} sermons preached at a funeral, ${Sy.funeral_1650} of them printed after 1650.`],
      ['The City of London', `${cnt[4]} sermons were preached to the City. ${Sy.city_mayor} name the Lord Mayor or the aldermen. ${Sy.city_spital} are Spital sermons of Easter week. ${Sy.city_artillery} were preached to the Artillery Company.`],
      ['Assizes and visitations', `${Sy.assize} sermons to the judges at the assizes, and ${Sy.visit} to the clergy at a bishop’s visitation.`],
      ['No occasion named', `${fmt(cnt[PILE])} name no single pulpit: sermons on a text, courses of sermons, and collections. The six rows above hold the other ${fmt(named)}.`]];
    const stepsEl = document.getElementById('tg-usteps'); stepsEl.innerHTML = STEPS.map(([b, t]) => `<li><b>${esc(b)}</b><p>${esc(t)}</p></li>`).join('');
    const lis = [...stepsEl.children];
    document.getElementById('tg-ulegend').innerHTML = D.fam.map(([, nm], i) => [nm, i, S.filter((r) => r[2] === i).length]).filter((x) => x[2]).map(([nm, i, c]) => `<span><i style="background:${fcI(i)};border-radius:50%"></i>${esc(nm)} <span class="num">${fmt(c)}</span></span>`).join('');
    const out = U.out.reduce((a, b) => a + b, 0);
    document.getElementById('tg-unote').innerHTML = method(`The pulpit is read from each title as it was first printed. ${fmt(out)} more sermons on the shelf carry no printed date or come after ${Y1}, and are not drawn.`);
    // the card: the sermon of the step, or the one chosen
    const showCard = (i, label) => {
      if (i == null) { card.innerHTML = method(`<p class="k">How to read it</p><p class="ft">Each dot is one printed sermon. Point at one for its title. Choose it to read the title as first printed and open the book.</p>`); return; }
      const r = S[i], a = D.authors[r[3]];
      card.innerHTML = `<p class="k">${esc(label)}${r[6] ? ' · as first printed' : ''}</p><p class="ft">${esc(r[6] || r[5])}</p><p class="by"><i style="background:${fcI(r[2])}"></i>${r[0]}${a ? ` · ${esc(a.n)}` : ''} · <a href="${TG.read(r[4])}" target="_blank" rel="noopener">Read it</a></p>`;
    };
    // a beeswarm: each dot at its year, pushed off the line just far enough to touch no other (both ways for a row, upward for the pile)
    let xs = [], R = 2.6, G0 = null;
    function dodge(idx, r, up) {
      const d = 2 * r + 0.5, d2 = d * d - 0.01, placed = [], res = new Map(); let head = 0;
      for (const i of idx.slice().sort((a, b) => xs[a] - xs[b] || a - b)) {
        const x = xs[i]; while (head < placed.length && placed[head].x < x - d) head++;
        const near = placed.slice(head), cands = [0];
        for (const q of near) { const dy = Math.sqrt(Math.max(0, d * d - (x - q.x) ** 2)); cands.push(q.y + dy, q.y - dy); }
        const ok = cands.filter((c) => !up || c >= 0).sort((a, b) => Math.abs(a) - Math.abs(b)).find((c) => near.every((q) => (x - q.x) ** 2 + (c - q.y) ** 2 >= d2));
        const y = ok ?? Math.max(0, ...near.map((q) => Math.abs(q.y))) + d;
        placed.push({ x, y }); res.set(i, y);
      }
      return res;
    }
    const ML = 14, MR = 14, LH = 19, GAP = 9, AX = 26;
    function layout() {
      const W = box.clientWidth, maxH = TG.pinOK() ? TG.clamp(innerHeight - (parseFloat(TG.css('--tg-pin')) || 0) - 150, 380, 640) : 900;
      const cw = (W - ML - MR) / (Y1 - Y0 + 1), byRow = U.rows.map((_, k) => S.map((r, i) => (r[1] === k ? i : -1)).filter((i) => i >= 0));
      for (let r = 2.8; r >= 1.3; r -= 0.15) {
        const seen = {}; xs = S.map((s) => { const n = (seen[s[0]] = (seen[s[0]] || 0) + 1); return ML + (s[0] - Y0 + 0.5) * cw + (((n * 0.618) % 1) - 0.5) * cw * 0.8; });
        const rows = byRow.slice(0, PILE).map((idx) => dodge(idx, r, false)), half = rows.map((m) => Math.max(0, ...[...m.values()].map(Math.abs)) + r);
        const piles = []; for (let m = 0; m <= PILE; m++) piles.push(dodge(S.map((s, i) => (s[1] >= m ? i : -1)).filter((i) => i >= 0), r, true));
        const ptop = piles.map((m) => Math.max(0, ...m.values()) + r);
        let y = 6; const mid = [], lab = [];
        half.forEach((h) => { lab.push(y + 14); y += LH; mid.push(y + h); y += 2 * h + GAP; });
        const pileLab = y + 14; y += LH; const base = y + ptop[PILE]; y = base + r + AX;
        G0 = { r, cw, rows, half, piles, ptop, mid, lab, pileLab, base, H: Math.ceil(y), W };
        if (y <= maxH) break;
      }
      R = G0.r; box.style.height = `${G0.H}px`; cv.size();
    }
    const pos = new Float32Array(N * 2); let P = 0, cur = -1, sel = -1;
    const tk = (s, k) => clamp((s - (k + 1)) / 0.72, 0, 1);
    function render(p) {
      P = p; if (!G0) return; const g = G0, s = p * NS, {W} = cv; ctx.clearRect(0, 0, W, cv.H);
      const ink = TG.css('--ink'), muted = TG.css('--muted'), rule = TG.css('--rule'), rub = TG.css('--rubric'), disp = TG.css('--display'), body = TG.css('--body');
      const T = U.rows.map((_, k) => (k < PILE ? tk(s, k) : 0)); let m = 0; while (m < PILE && T[m] >= 1) m++;
      const settle = m < PILE ? ease(clamp((T[m] - 0.45) / 0.45, 0, 1)) : 1, step = Math.min(NS - 1, Math.floor(s));
      // the year rules and the axis: light, behind everything
      ctx.font = `11px ${body}`; ctx.textAlign = 'center'; ctx.fillStyle = muted;
      for (let y = 1550; y <= Y1; y += 50) { const x = ML + (y - Y0 + 0.5) * g.cw; ctx.strokeStyle = rule; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(x, 4); ctx.lineTo(x, g.base + R + 4); ctx.stroke(); ctx.setLineDash([]); }
      ctx.strokeStyle = rule; ctx.beginPath(); ctx.moveTo(ML, g.base + R + 4.5); ctx.lineTo(W - MR, g.base + R + 4.5); ctx.stroke();
      for (let y = 1550; y <= Y1; y += 25) ctx.fillText(String(y), ML + (y - Y0 + 0.5) * g.cw, g.base + R + 19);
      // the rows: a ledger line through each, the name once its sermons begin to rise; a row still under the pile waits unseen
      const ptop = lerp(g.ptop[m], g.ptop[Math.min(PILE, m + 1)], m < PILE ? settle : 0), clear = g.base - ptop - 26;
      ctx.textAlign = 'left';
      for (let k = 0; k < PILE; k++) {
        const a = clamp(T[k] * 2.5, 0, 1); if (!a && g.mid[k] > clear) continue; ctx.strokeStyle = rule; ctx.globalAlpha = 0.35 + 0.65 * a; ctx.beginPath(); ctx.moveTo(ML, g.mid[k] + 0.5); ctx.lineTo(W - MR, g.mid[k] + 0.5); ctx.stroke();
        ctx.globalAlpha = 0.28 + 0.72 * a; ctx.fillStyle = step === k + 1 ? rub : ink; ctx.font = `400 15px ${disp}`; ctx.fillText(U.rows[k][1], ML, g.lab[k]);
        if (a > 0) { const w = ctx.measureText(U.rows[k][1]).width; ctx.globalAlpha = a; ctx.fillStyle = muted; ctx.font = `12px ${body}`; ctx.fillText(fmt(cnt[k]), ML + w + 8, g.lab[k]); }
      }
      ctx.globalAlpha = 1;
      // the dots
      for (let i = 0; i < N; i++) {
        const r = S[i], k = r[1], x = xs[i]; let y, al;
        if (k < m) { y = g.mid[k] + g.rows[k].get(i); al = 0.95; }
        else if (k === m && k < PILE) { const td = ease(clamp(T[k] * 1.6 - ((x - ML) / (W - ML - MR)) * 0.6, 0, 1)); y = lerp(g.base - g.piles[m].get(i), g.mid[k] + g.rows[k].get(i), td); al = lerp(0.5, 0.95, td); }
        else { y = lerp(g.base - g.piles[m].get(i), g.base - g.piles[Math.min(PILE, m + 1)].get(i), m < PILE ? settle : 0); al = s < 1 ? 0.85 : k === PILE && m >= PILE ? 0.6 : 0.5; }
        pos[2 * i] = x; pos[2 * i + 1] = y; ctx.globalAlpha = al; ctx.fillStyle = fcI(r[2]); ctx.beginPath(); ctx.arc(x, y, R, 0, 6.2832); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // the pile's name rides on top of it
      const left = cnt[PILE] + U.rows.slice(0, PILE).reduce((a, _, k) => a + (T[k] < 0.5 ? cnt[k] : 0), 0);
      const pl = s < 1 ? 'Every printed sermon' : m >= PILE ? 'No occasion named' : 'Still to sort', py = Math.min(g.pileLab, g.base - ptop - 7);
      ctx.font = `400 15px ${disp}`; const pw = ctx.measureText(pl).width; ctx.fillStyle = TG.css('--card'); ctx.globalAlpha = 0.85; ctx.fillRect(ML - 3, py - 13, pw + 60, 18); ctx.globalAlpha = 1;
      ctx.fillStyle = step === NS - 1 ? rub : ink; ctx.fillText(pl, ML, py); ctx.fillStyle = muted; ctx.font = `12px ${body}`; ctx.fillText(fmt(left), ML + pw + 8, py);
      // the sermon on the card, ringed
      const ring = sel >= 0 ? sel : step >= 1 ? U.feat[step - 1] : -1;
      if (ring >= 0) { ctx.strokeStyle = rub; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(pos[2 * ring], pos[2 * ring + 1], R + 4, 0, 6.2832); ctx.stroke(); ctx.lineWidth = 1; }
      if (step !== cur) { cur = step; sel = -1; lis.forEach((li, i) => li.classList.toggle('now', i === step)); showCard(step >= 1 ? U.feat[step - 1] : null, step >= 1 ? U.rows[step - 1][1] : '');
        if (G) gsap.fromTo(card.children, { opacity: 0, y: 5 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.05 }); }
    }
    const hit = (e) => { const b = box.getBoundingClientRect(), mx = e.clientX - b.left, my = e.clientY - b.top; let best = -1, bd = (R + 4) ** 2;
      for (let i = 0; i < N; i++) { const d = (pos[2 * i] - mx) ** 2 + (pos[2 * i + 1] - my) ** 2; if (d < bd) { bd = d; best = i; } } return [best, mx, my, b]; };
    box.addEventListener('mousemove', (e) => { const [i, mx, my, b] = hit(e); if (i < 0) { tip.hidden = true; box.style.cursor = ''; return; }
      const r = S[i], a = D.authors[r[3]]; box.style.cursor = 'pointer';
      tip.innerHTML = `${esc(r[5])}<small>${r[0]}${a ? ` · ${esc(a.n)}` : ''} · ${esc(U.rows[r[1]][1])}</small>`; tip.hidden = false;
      tip.style.left = `${Math.min(mx + 12, b.width - 250)}px`; tip.style.top = `${Math.max(6, my - 58)}px`; });
    box.addEventListener('mouseleave', () => { tip.hidden = true; });
    box.addEventListener('click', (e) => { const [i] = hit(e); if (i < 0) return; sel = i; showCard(i, 'Chosen'); render(P); if (G) gsap.fromTo(card.children, { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 0.3, stagger: 0.04 }); });
    let rt, w0 = 0; new ResizeObserver(() => { if (Math.abs(box.clientWidth - w0) < 2) return; w0 = box.clientWidth; clearTimeout(rt); rt = setTimeout(() => { layout(); render(P); }, 80); }).observe(box);
    layout(); w0 = box.clientWidth;
    const st = TG.chapter('#tg-pulpits', 5200, (p, fin) => render(fin ? 1 : p), { scrub: 0.5 });
    if (!st) lis.forEach((li) => li.classList.add('now'));
  })();

  /* ---------- the finder ---------- */
  explorer = TG.explorer(document.getElementById('tg-explorer'), D, { range: [1480, 1890], first: 'Richard Baxter', placeholder: 'Baxter, Hooker, Pilgrim, sermon…', label: 'Lifelines of the writers on the English shelf' });
  TG.reveal('.tg .reveal');
})();
