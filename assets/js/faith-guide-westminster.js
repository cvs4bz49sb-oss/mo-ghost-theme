/* The Westminster Assembly guide: the Jerusalem Chamber, the sittings as a ledger of days, the Confession as a building, where the
   divines came from, and the press of their books. */
(async () => {
  const method = (html) => (window.TFRMethod ? window.TFRMethod.html(html) : html);
  const {TG} = window, D = await TG.load('data'), LAND = await TG.load('land');
  const { esc, fmt, clamp, ease, lerp } = TG, G = TG.hasG && !TG.reduce ? window.gsap : null;
  const FAMS = D.fam.map((f) => f[0]), fc = (k) => TG.css(`--f${FAMS.indexOf(k) + 1}`), famName = (k) => (D.fam.find((f) => f[0] === k) || [])[1];
  const ALL = D.authors.concat(D.undated), byName = Object.fromEntries(ALL.map((a) => [a.n, a]));
  const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const parse = (s) => { const [y, mo, day] = String(s).split('-').map(Number); return { y, mo, day, t: Date.UTC(y, mo - 1, day || 15) }; }; // day 0: known to the month
  const doy = (p) => (p.t - Date.UTC(p.y, 0, 1)) / 864e5;
  const fy = (s) => { const p = parse(s); return p.y + doy(p) / 366; };
  // England kept the Julian calendar until 1752: its weekday is the Gregorian one of a date ten days later (eleven from March 1700)
  const julianDay = (p) => new Date(p.t + (p.y < 1700 || (p.y === 1700 && p.mo < 3) ? 10 : 11) * 864e5).getUTCDay();
  const long = (s) => { const p = parse(s); return p.day ? `${DAYS[julianDay(p)]}, ${p.day} ${MON[p.mo - 1]} ${p.y}` : `${MON[p.mo - 1]} ${p.y}`; };
  let explorer = null;
  document.getElementById('tg-shelf-link').href = TG.href('westminster-assembly/');

  /* ---------- hero: facts and the Jerusalem Chamber ---------- */
  const facts = { divines: ALL.length, works: D.n_works, pages: D.n_pages, meetings: D.sessions.length };
  document.querySelectorAll('[data-count]').forEach((el) => TG.countUp(el, facts[el.dataset.count], 1.8));
  (function chamber() {
    const svg = document.querySelector('.chamber svg'), cap = document.querySelector('.chamber .cap'), NS = 'http://www.w3.org/2000/svg';
    const mk = (tag, at, parent = svg) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); parent.appendChild(e); return e; };
    const room = mk('g', {}), furn = mk('g', {}), seatsG = mk('g', {}), labs = mk('g', {});
    // the room: the upper end at the top, the door at the foot, the fire on the wall at the prolocutor's left
    mk('rect', { class: 'floor', x: 40, y: 30, width: 520, height: 410, rx: 2 }, room);
    const walls = [mk('path', { class: 'wall', d: 'M270 440 H40 V30 H560 V440 H330' }, room), mk('path', { class: 'wall2', d: 'M270 446 H34 V24 H566 V446 H330' }, room)];
    mk('rect', { class: 'board', x: 554, y: 282, width: 10, height: 40 }, room);
    const fire = mk('path', { class: 'fire', d: 'M556 312 q2 -10 4 -2 q1 -9 3 0 q1 -6 1 2 z' }, room);
    // the prolocutor's chair on its frame, the assessors before it, the long table and its scribes
    mk('rect', { class: 'board', x: 272, y: 40, width: 56, height: 26, rx: 2 }, furn);
    mk('rect', { class: 'board', x: 282, y: 106, width: 36, height: 230, rx: 2 }, furn);
    // the forms: at the prolocutor's right hand (the viewer's left) three ranks, the Scots on the lowest and Parliament's men behind;
    // at his left hand, from the upper end to the chimney, five stages; and five more at the foot of the room
    const formL = [244, 220, 196], formR = [356, 382, 408, 434, 460], formB = [372, 394, 416];
    formL.forEach((x) => mk('line', { class: 'form', x1: x, y1: 112, x2: x, y2: 232 }, furn));
    formR.forEach((x) => mk('line', { class: 'form', x1: x, y1: 96, x2: x, y2: 270 }, furn));
    formB.forEach((y) => mk('line', { class: 'form', x1: 92, y1: y, x2: 508, y2: y }, furn));
    [176, 152].forEach((x) => mk('line', { class: 'form', x1: x, y1: 250, x2: x, y2: 350 }, furn));
    const L = (x, y, t, cls = 'lab', anchor = 'middle') => { const e = mk('text', { x, y, class: cls, 'text-anchor': anchor }, labs); e.textContent = t; return e; };
    L(300, 15, 'The upper end'); L(300, 462, 'The door'); L(560, 338, 'The fire', 'lab', 'end');
    L(336, 57, 'the prolocutor', 'lab2', 'start'); L(270, 88, 'assessors', 'lab', 'end'); L(300, 146, 'scribes', 'lab2');
    L(244, 248, 'the Scots', 'lab2'); L(150, 106, 'members of Parliament', 'lab'); L(410, 88, 'the divines where they pleased', 'lab2');
    // Parliament's lay members sat behind the Scots: their places are drawn empty, for none of their books are on this shelf
    for (const x of [220, 196]) for (let i = 0; i < 6; i++) mk('rect', { class: 'mp', x: x - 6, y: 118 + i * 19, width: 12, height: 12, rx: 3 }, furn);
    const SEAT = 13, seats = [];
    const place = (name, x, y) => { const a = byName[name]; if (!a) return null; const r = mk('rect', { class: 'seat', x: x - SEAT / 2, y: y - SEAT / 2, width: SEAT, height: SEAT, rx: 3, fill: fc(a.f), tabindex: 0, role: 'button', 'aria-label': `${a.n}${a.role ? `, ${a.role}` : ''}` }, seatsG); seats.push({ a, r }); return r; };
    // the officers in Baillie's places
    place('William Twisse', 300, 52); place('Cornelius Burges', 285, 84); place('John White', 315, 84);
    place('Henry Roborough', 274, 118); place('Adoniram Byfield', 326, 118);
    // the Scots commissioners on the lowest form at the prolocutor's right hand (Lord Maitland, the fifth, wrote nothing on this shelf)
    ['Alexander Henderson', 'Samuel Rutherford', 'Robert Baillie', 'George Gillespie'].forEach((n, i) => place(n, 244, 124 + i * 22));
    mk('rect', { class: 'mp', x: 238, y: 206, width: 12, height: 12, rx: 3 }, furn);
    // the rest, as they came in at the door: the foot of the room, the stages at the prolocutor's left, the back of the table
    const pos = [];
    formB.slice().reverse().forEach((y) => { for (let x = 104; x <= 496; x += 20) pos.push([x, y]); });
    formR.forEach((x) => { for (let y = 106; y <= 262; y += 20) pos.push([x, y]); });
    [176, 152].forEach((x) => { for (let y = 262; y <= 342; y += 20) pos.push([x, y]); });
    const placed = new Set(seats.map((s) => s.a.n)), rest = ALL.filter((a) => !placed.has(a.n)).sort((a, b) => (a.y0 || 1600) - (b.y0 || 1600));
    const step = pos.length / Math.max(1, rest.length); // spread the divines over every form, as a full chamber looks
    rest.forEach((a, i) => { const q = pos[Math.min(pos.length - 1, Math.floor(i * step))]; if (q) place(a.n, q[0], q[1]); });
    const say = (s) => { if (!s && cap.dataset.m === '1') return; cap.dataset.m = s ? '' : '1'; if (s) cap.textContent = `${s.a.n}${s.a.role ? `, ${s.a.role.toLowerCase()}` : ''} · ${s.a.d || TG.yr(s.a) || 'dates unknown'} · ${famName(s.a.f)} · ${s.a.w.length} ${s.a.w.length === 1 ? 'work' : 'works'}`;
      else cap.innerHTML = method('The Jerusalem Chamber as the Scots commissioner Robert Baillie described it in December 1643. Each seat is a divine whose books are on the shelf. The divines sat where they pleased.'); };
    seats.forEach((s) => { s.r.addEventListener('mouseenter', () => say(s)); s.r.addEventListener('focus', () => say(s));
      s.r.addEventListener('click', () => explorer && explorer.show(s.a.n)); s.r.addEventListener('keydown', (e) => { if (e.key === 'Enter') explorer && explorer.show(s.a.n); }); });
    svg.addEventListener('mouseleave', () => say(null)); say(null);
    if (!G) return;
    const draw = (el) => { const n = el.getTotalLength(); el.style.strokeDasharray = n; el.style.strokeDashoffset = n; return el; };
    const tl = TG.intro({ delay: 0.2 });
    tl.from(room.querySelector('.floor'), { opacity: 0, duration: 0.6 })
      .to(walls.map(draw), { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut', stagger: 0.15 }, 0)
      .from(furn.children, { opacity: 0, duration: 0.5, stagger: 0.01 }, 0.8)
      .from(labs.children, { opacity: 0, y: 4, duration: 0.5, stagger: 0.05 }, 1.2)
      .from(seats.slice(0, 9).map((s) => s.r), { scale: 0, transformOrigin: 'center', transformBox: 'fill-box', duration: 0.5, ease: 'back.out(2)', stagger: 0.09 }, 1.4)
      .from(seats.slice(9).map((s) => s.r), { opacity: 0, y: 30, duration: 0.45, ease: 'power3.out', stagger: 0.025 }, 2.1);
    gsap.to(fire, { opacity: 0.55, scaleY: 0.85, transformOrigin: '50% 100%', transformBox: 'fill-box', duration: 0.6, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  })();

  /* ---------- 1. the sittings: a row of days for each year ---------- */
  (function sittings() {
    const box = document.getElementById('tg-ledger'), cv = TG.canvas(box.querySelector('canvas')), {ctx} = cv, tip = box.querySelector('.tip'), pick = document.getElementById('tg-sit-pick');
    const S = D.sessions.map(([n, d, v, p]) => ({ n, d, v, p, ...parse(d) })), Y0 = 1643, Y1 = 1652;
    const EV = D.events.map(([d, title, text]) => ({ d, title, text, ...parse(d) })), evDays = new Set(EV.map((e) => e.d));
    const printed = {}; ALL.forEach((a) => a.yrs.forEach((y) => { if (y) printed[y] = (printed[y] || 0) + 1; }));
    const pmax = Math.max(...Object.keys(printed).filter((y) => y >= Y0 && y <= Y1).map((y) => printed[y]));
    const chron = TG.chronicle(document.getElementById('tg-chron'), EV.map((e) => [fy(e.d), e.title, e.text, e.d]), ([, t, w, d]) => `<li><span class="d">${esc(long(d).replace(/^\w+, /, ''))}</span><span class="e">${esc(t)}</span>${w ? `<span class="w">${esc(w)}</span>` : ''}</li>`);
    const T0 = Date.UTC(1643, 5, 1), T1 = Date.UTC(1652, 3, 1);
    let cursor = T1, hover = null, geo = null;
    function layout() {
      const {W} = cv, {H} = cv, left = 44, right = 64, top = 24, rowH = (H - top - 8) / (Y1 - Y0 + 1), gw = W - left - right;
      geo = { W, H, left, right, top, rowH, gw, x: (p) => left + doy(p) / 366 * gw, y: (yr) => top + (yr - Y0) * rowH };
    }
    function draw() {
      const g = geo; ctx.clearRect(0, 0, g.W, g.H);
      const ink = TG.css('--ink-2'), muted = TG.css('--muted'), rule = TG.css('--rule-2'), gilt = TG.css('--gilt'), rub = TG.css('--rubric'), f1 = TG.css('--f1'), font = TG.css('--body');
      ctx.font = `10.5px ${font}`; ctx.fillStyle = muted; ctx.textAlign = 'center';
      MON.forEach((m, i) => { const x = g.left + (Date.UTC(2001, i, 15) - Date.UTC(2001, 0, 1)) / 864e5 / 366 * g.gw; ctx.fillText(m[0], x, 14); });
      for (let yr = Y0; yr <= Y1; yr++) {
        const y = g.y(yr); ctx.strokeStyle = rule; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(g.left, y + g.rowH - 3.5); ctx.lineTo(g.left + g.gw, y + g.rowH - 3.5); ctx.stroke();
        ctx.fillStyle = TG.css('--ink'); ctx.textAlign = 'right'; ctx.font = `13px ${TG.css('--display')}`; ctx.fillText(yr, g.left - 8, y + g.rowH * 0.62);
        // the divines' books printed that year, a bar at the row's end that grows as the year passes
        const frac = clamp((cursor - Date.UTC(yr, 0, 1)) / (Date.UTC(yr + 1, 0, 1) - Date.UTC(yr, 0, 1)), 0, 1), n = (printed[yr] || 0) * frac;
        if (n > 0) { const bw = (g.right - 26) * (n / pmax); ctx.fillStyle = rub; ctx.globalAlpha = 0.8; ctx.fillRect(g.left + g.gw + 8, y + g.rowH * 0.25, bw, g.rowH * 0.4); ctx.globalAlpha = 1;
          ctx.fillStyle = muted; ctx.textAlign = 'left'; ctx.font = `10px ${font}`; ctx.fillText(Math.round(n), g.left + g.gw + 10 + bw, y + g.rowH * 0.58); }
      }
      for (const s of S) { if (s.t > cursor) continue; const x = g.x(s), y = g.y(s.y), ev = evDays.has(s.d);
        ctx.fillStyle = ev ? gilt : s.n ? ink : f1; ctx.globalAlpha = s.n ? 0.85 : 0.55; ctx.fillRect(x - 0.6, y + g.rowH * 0.18, 1.6, g.rowH * 0.6); }
      ctx.globalAlpha = 1;
      for (const e of EV) { if (e.t > cursor) continue; const x = g.x(e), y = g.y(e.y);
        ctx.fillStyle = gilt; ctx.save(); ctx.translate(x, y + g.rowH * 0.1); ctx.rotate(Math.PI / 4); ctx.fillRect(-3.5, -3.5, 7, 7); ctx.restore(); }
      if (cursor < T1) { const c = new Date(cursor), p = { y: c.getUTCFullYear(), t: cursor }; if (p.y >= Y0 && p.y <= Y1) { const x = g.x(p), y = g.y(p.y);
        ctx.strokeStyle = rub; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x, y + g.rowH - 4); ctx.stroke(); ctx.lineWidth = 1; } }
      if (hover) { const x = g.x(hover), y = g.y(hover.y); ctx.strokeStyle = rub; ctx.lineWidth = 1.5; ctx.strokeRect(x - 3, y + g.rowH * 0.12, 6, g.rowH * 0.72); ctx.lineWidth = 1; }
    }
    const at = (mx, my) => { if (!geo || mx < geo.left || mx > geo.left + geo.gw) return null; const yr = Y0 + Math.floor((my - geo.top) / geo.rowH); let best = null, bd = 6;
      for (const s of S) if (s.y === yr && s.t <= cursor) { const d = Math.abs(geo.x(s) - mx); if (d < bd) { bd = d; best = s; } } return best; };
    const label = (s) => `${s.n ? `Session ${s.n}` : 'The committee'}, ${long(s.d)}`;
    box.addEventListener('mousemove', (e) => { const b = cv.cv.getBoundingClientRect(), s = at(e.clientX - b.left, e.clientY - b.top); hover = s; draw();
      if (!s) { tip.hidden = true; cv.cv.style.cursor = 'default'; return; } cv.cv.style.cursor = 'pointer'; const ev = EV.find((x) => x.d === s.d);
      tip.innerHTML = `${esc(label(s))}${ev ? `<small>${esc(ev.title)}</small>` : ''}<small>choose it to open the minutes</small>`; tip.hidden = false;
      tip.style.left = `${Math.min(e.clientX - b.left + 12, b.width - 240)}px`; tip.style.top = `${e.clientY - b.top + 14}px`; });
    box.addEventListener('mouseleave', () => { hover = null; tip.hidden = true; draw(); });
    // a mark opens its day in the minutes at once (owner 10-11: "i cant click into session minutes"): the link this used to write under
    // the ledger fell below the window while the scene was pinned, so a click seemed to do nothing. The link stays there as a record.
    box.addEventListener('click', (e) => { const b = cv.cv.getBoundingClientRect(), s = at(e.clientX - b.left, e.clientY - b.top); if (!s) return;
      window.open(TG.read(s.v, s.p), '_blank', 'noopener');
      pick.innerHTML = `<a href="${TG.read(s.v, s.p)}" target="_blank" rel="noopener">${esc(label(s))}</a><small>in the Minutes and Papers of the Assembly</small>`;
      if (G) gsap.from(pick, { opacity: 0, y: 6, duration: 0.3 }); });
    pick.innerHTML = '<span class="small">Choose any mark to open that day in the minutes.</span>';
    layout();
    let last = -1;
    const render = (p) => { cursor = lerp(T0, T1, p); draw(); const yrF = 1643 + (cursor - Date.UTC(1643, 0, 1)) / (365.25 * 864e5); if (Math.abs(yrF - last) > 0.002) { chron(yrF); last = yrF; } };
    new ResizeObserver(() => { cv.size(); layout(); draw(); }).observe(box);
    TG.chapter('#tg-sit', 3800, (p) => render(p), { scrub: 0.4 });
  })();

  /* ---------- 2. where they came from ---------- */
  (function where() {
    const box = document.getElementById('tg-map'), M = TG.map(box, LAND, [[-8.4, 49.9], [5.2, 58.8]], { parallels: [50, 58] });
    const cv = TG.canvas(box.querySelector('canvas')), {ctx} = cv, names = document.getElementById('tg-where-names');
    const P = Object.entries(D.placed).map(([k, ns]) => ({ k, ns, ll: D.places[k] })).sort((a, b) => b.ns.length - a.ns.length || a.ll[0] - b.ll[0]);
    let shown = 0, sel = null;
    const famOf = (p) => { const c = {}; p.ns.forEach((n) => { const f = (byName[n] || {}).f || 'body'; c[f] = (c[f] || 0) + 1; }); return Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]; };
    function draw() {
      ctx.clearRect(0, 0, cv.W, cv.H); const font = TG.css('--body'), boxes = [];
      P.forEach((p, i) => { const vis = clamp(shown - i, 0, 1); if (vis <= 0) return; const [x, y] = M.xy(p.ll), r = (3 + 2.6 * Math.sqrt(p.ns.length)) * (0.4 + 0.6 * ease(vis)), on = sel === p;
        ctx.globalAlpha = on ? 1 : 0.8; ctx.fillStyle = fc(famOf(p)); ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
        ctx.strokeStyle = on ? TG.css('--rubric') : TG.css('--card'); ctx.lineWidth = on ? 2.4 : 1.2; ctx.stroke(); p.x = x; p.y = y; p.r = r; });
      ctx.globalAlpha = 1; ctx.font = `600 11px ${font}`;
      P.forEach((p, i) => { if (shown - i < 1 || !(p.ns.length > 1 || sel === p || ['Glasgow', 'St Andrews', 'Edinburgh', 'Dublin', 'Amsterdam', 'Leiden', 'Norwich', 'Manchester'].includes(p.k))) return;
        const w = ctx.measureText(p.k).width; let lx = p.x + p.r + 4; const ly = p.y + 4; if (lx + w > cv.W - 4) lx = p.x - p.r - 4 - w;
        if (boxes.some((b) => lx < b[0] + b[2] && lx + w > b[0] && Math.abs(ly - b[1]) < 12)) return; boxes.push([lx, ly, w]);
        ctx.fillStyle = TG.css('--land'); ctx.globalAlpha = 0.85; ctx.fillRect(lx - 2, ly - 10, w + 4, 13); ctx.globalAlpha = 1; ctx.fillStyle = TG.css('--ink'); ctx.fillText(p.k, lx, ly); });
    }
    const list = (p) => { names.innerHTML = p ? `<span style="border:0;background:none;padding-left:0"><b>${esc(p.k)}</b></span>${p.ns.map((n) => `<span><i style="background:${fc((byName[n] || {}).f || 'body')}"></i>${esc(n)}</span>`).join('')}` : ''; };
    box.addEventListener('click', (e) => { const b = cv.cv.getBoundingClientRect(), mx = e.clientX - b.left, my = e.clientY - b.top;
      const hit = P.find((p) => p.x != null && Math.hypot(p.x - mx, p.y - my) <= p.r + 4); if (hit) { sel = hit; list(hit); draw(); } });
    cv.cv.style.cursor = 'pointer';
    M.onfit = () => { cv.size(); draw(); };
    TG.chapter('#tg-where', 2600, (p, fin) => { shown = fin ? P.length : p * (P.length + 1.5); const cur = fin ? P[0] : P[Math.max(0, Math.min(P.length - 1, Math.floor(shown) - 1))]; if (!sel) list(cur); draw(); }, { scrub: 0.5 });
  })();

  /* ---------- 3. the press: the books by year, then by kind ---------- */
  (function press() {
    const box = document.getElementById('tg-pressbox'), K = D.kinds.map((k) => k[0]), KN = Object.fromEntries(D.kinds);
    const KC = { parl: '--rubric', sermon: '--gilt', script: '--f1', treat: '--f2', order: '--f5', learn: '--f7' };
    const B = D.books.map(([t, s, p, y, k, a, f]) => ({ t, s, p, y, k, a, f })).sort((a, b) => (a.y || 9999) - (b.y || 9999) || K.indexOf(a.k) - K.indexOf(b.k));
    const els = B.map((b) => { const d = document.createElement('a'); d.className = 'bk'; d.href = TG.read(b.s); d.target = '_blank'; d.rel = 'noopener';
      d.style.background = TG.css(KC[b.k]); d.title = `${b.t}, ${b.a}${b.y ? `, ${b.y}` : ''}`; d.setAttribute('aria-label', d.title); d.tabIndex = -1; box.appendChild(d); return d; });
    const axis = document.createElement('div'); axis.className = 'axis'; box.appendChild(axis);
    const band = document.createElement('div'); band.className = 'band'; band.innerHTML = '<span>the Assembly sits</span>'; box.appendChild(band);
    const yls = [1600, 1620, 1640, 1660, 1680, 1700].map((y) => { const e = document.createElement('div'); e.className = 'yl'; e.textContent = y; box.appendChild(e); return { y, e }; });
    const heads = K.map((k) => { const n = B.filter((b) => b.k === k).length, e = document.createElement('div'); e.className = 'colh'; e.innerHTML = `${esc(KN[k])}<small>${fmt(n)} ${n === 1 ? 'work' : 'works'}</small>`; e.tabIndex = 0; e.setAttribute('role', 'button'); box.appendChild(e); return { k, e }; });
    const listEl = document.getElementById('tg-kindlist');
    heads.forEach(({ k, e }) => { const open = () => { const ws = B.filter((b) => b.k === k).sort((a, b) => b.p - a.p);
      listEl.hidden = false; listEl.innerHTML = `<p class="eyebrow" style="margin:0 0 4px"><i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(${KC[k]});margin-right:6px"></i>${esc(KN[k])} · ${fmt(ws.length)} works</p>
        <ul class="wlist">${ws.slice(0, 40).map((b) => `<li><a href="${TG.read(b.s)}" target="_blank" rel="noopener">${esc(b.t)}</a><small>${esc(b.a)}${b.y ? `, ${b.y}` : ''}</small></li>`).join('')}</ul>${ws.length > 40 ? `<p class="small" style="margin:8px 0 0">and ${fmt(ws.length - 40)} more in the finder below.</p>` : ''}`;
      if (G) gsap.from(listEl.querySelectorAll('li'), { opacity: 0, y: 6, duration: 0.3, stagger: 0.01 }); };
      e.addEventListener('click', open); e.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') open(); }); });
    let L = null;
    function layout() {
      const W = box.clientWidth, H = box.clientHeight, s = W < 600 ? 4 : 6, g = 1, base = H - 66, Y0 = 1596, Y1 = 1704, X = (y) => 8 + (y - Y0) / (Y1 - Y0) * (W - 24);
      const A = [], stack = {}; B.forEach((b, i) => { const y = b.y && b.y >= Y0 && b.y <= Y1 ? b.y : null, key = y || 'u', h = stack[key] = (stack[key] || 0) + 1;
        const x = y ? X(y) - s / 2 : W / 2, yy = y ? base - h * (s + g) : base + 40; A[i] = { x, y: Math.max(8, yy) }; });
      // by kind: a column each, the books in rows, oldest at the foot
      const cg = W < 600 ? 6 : 16, cw = (W - cg * (K.length - 1)) / K.length, Bk = [], seen = {}, most = Math.max(...K.map((k) => B.filter((b) => b.k === k).length));
      // the sorted tiles grow until the largest kind fills most of the height
      let s2 = s; for (let t = s; t <= 14; t += 0.5) { const per = Math.max(1, Math.floor(cw / (t + g))); if (Math.ceil(most / per) * (t + g) <= base * 0.78) s2 = t; }
      const per = Math.max(1, Math.floor(cw / (s2 + g)));
      B.forEach((b, i) => { const ci = K.indexOf(b.k), n = seen[b.k] = (seen[b.k] || 0); seen[b.k]++; Bk[i] = { x: ci * (cw + cg) + (n % per) * (s2 + g), y: base - (Math.floor(n / per) + 1) * (s2 + g) }; });
      axis.style.top = `${base + 2}px`; band.style.left = `${X(1643)}px`; band.style.width = `${X(1652) - X(1643)}px`; band.style.top = '0px'; band.style.height = `${base}px`;
      yls.forEach(({ y, e }) => { e.style.left = `${X(y)}px`; e.style.top = `${base + 8}px`; });
      heads.forEach(({ e }, i) => { e.style.left = `${i * (cw + cg)}px`; e.style.width = `${cw}px`; e.style.top = `${base + 8}px`; });
      els.forEach((el) => { el.style.width = `${s}px`; el.style.height = `${s}px`; });
      L = { A, Bk, X, base, W, sc: s2 / s };
    }
    function render(p, fin) {
      if (!L) layout(); const yearP = fin ? 1 : clamp(p / 0.5, 0, 1), sortP = fin ? 1 : ease(clamp((p - 0.6) / 0.35, 0, 1)), Ycur = 1596 + yearP * 108;
      B.forEach((b, i) => { const a = L.A[i], k = L.Bk[i], vis = !b.y ? 0 : clamp((Ycur - b.y) / 1.5, 0, 1);
        const st = sortP > 0 ? clamp(sortP * 1.3 - (i % 37) / 37 * 0.3, 0, 1) : 0, x = lerp(a.x, k.x, st), y = lerp(a.y - (1 - ease(vis)) * 40, k.y, st);
        els[i].style.transform = `translate(${x}px, ${y}px) scale(${lerp(1, L.sc, st)})`; els[i].style.opacity = sortP > 0 ? (b.y ? 1 : st) : vis; els[i].tabIndex = sortP >= 1 ? 0 : -1; });
      const pre = 1 - sortP; axis.style.opacity = pre; band.style.opacity = pre; yls.forEach(({ e }) => { e.style.opacity = pre; });
      heads.forEach(({ e }) => { e.style.opacity = sortP; e.style.pointerEvents = sortP > 0.9 ? 'auto' : 'none'; });
    }
    new ResizeObserver(() => { layout(); render(lastP, lastF); }).observe(box);
    let lastP = 0, lastF = false;
    TG.chapter('#tg-press', 3600, (p, fin) => { lastP = p; lastF = fin; render(p, fin); }, { scrub: 0.5 });
  })();

  /* ---------- 4. the Confession as a building: thirty-three columns, a stone for each section ---------- */
  (function confession() {
    const C = D.conf.ch, svg = document.querySelector('#tg-confbox svg'), NS = 'http://www.w3.org/2000/svg', card = document.getElementById('tg-chap');
    const mk = (tag, at, parent = svg) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); parent.appendChild(e); return e; };
    const W = 800, base = 372, shaftTop = 150, gap = 6, cw = (W - 40 - gap * 32) / 33, x0 = 20;
    svg.setAttribute('viewBox', `0 0 ${W} 424`);
    const RO = (n) => { let s = ''; for (const [v, r] of [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]) while (n >= v) { s += r; n -= v; } return s; };
    const plinth = mk('rect', { x: 8, y: base, width: W - 16, height: 10, fill: TG.css('--leather') });
    const steps = [mk('rect', { x: 0, y: base + 10, width: W, height: 8, fill: TG.css('--rule') })];
    const ent = mk('g', {}); mk('rect', { x: 10, y: shaftTop - 26, width: W - 20, height: 22, fill: TG.css('--card'), stroke: TG.css('--ink-2'), 'stroke-width': 1 }, ent);
    const et = mk('text', { x: W / 2, y: shaftTop - 10, 'text-anchor': 'middle', fill: TG.css('--ink-2'), style: `font: 600 10px ${TG.css('--body')}; letter-spacing: 0.32em` }, ent); et.textContent = 'AGREED UPON BY THE ASSEMBLY OF DIVINES AT WESTMINSTER';
    const ped = mk('g', {}); const tri = mk('path', { d: `M10 ${shaftTop - 28} L${W / 2} ${shaftTop - 118} L${W - 10} ${shaftTop - 28} Z`, fill: TG.css('--card'), stroke: TG.css('--ink-2'), 'stroke-width': 1.2 }, ped);
    const pt = mk('text', { x: W / 2, y: shaftTop - 52, 'text-anchor': 'middle', fill: TG.css('--rubric'), style: `font: 400 26px ${TG.css('--display')}` }, ped); pt.textContent = 'The Confession of Faith';
    const pd = mk('text', { x: W / 2, y: shaftTop - 36, 'text-anchor': 'middle', fill: TG.css('--muted'), style: `font: italic 12px ${TG.css('--display')}` }, ped); pd.textContent = 'presented to Parliament in December 1646';
    const cols = C.map((c, i) => {
      const x = x0 + i * (cw + gap), g = mk('g', { class: 'blk', tabindex: 0, role: 'button', 'aria-label': `Chapter ${c.r}: ${c.t} (${c.sec} sections)` }), stones = [];
      const H = base - shaftTop, sh = (H - (c.sec - 1) * 2) / c.sec;
      mk('rect', { x: x - 2, y: shaftTop - 4, width: cw + 4, height: 5, class: 'cap' }, g);
      for (let k = 0; k < c.sec; k++) stones.push(mk('rect', { x, y: base - (k + 1) * sh - k * 2, width: cw, height: sh, rx: 1.5, fill: TG.css('--paper-2'), stroke: TG.css('--rule'), 'stroke-width': 0.8 }, g));
      const n = mk('text', { x: x + cw / 2, y: base + (i % 2 ? 44 : 30), 'text-anchor': 'middle', class: 'num' }, g); n.textContent = RO(c.n);
      return { c, g, stones, n };
    });
    function show(i) {
      const { c } = cols[i]; cols.forEach((o, j) => o.stones.forEach((s) => s.setAttribute('fill', j === i ? TG.css('--gilt') : TG.css('--paper-2'))));
      card.innerHTML = `<p class="eyebrow" style="margin:0 0 4px">Chapter ${c.r} · ${c.sec} ${c.sec === 1 ? 'section' : 'sections'}</p>
        <h3><a href="${TG.read(D.conf.slug, c.p)}" target="_blank" rel="noopener">${esc(c.t)}</a></h3>
        ${c.k ? `<p class="small" style="margin:6px 0 0">${c.k} ${c.k === 1 ? 'book' : 'books'} by the divines name this subject in the title${c.w.length < c.k ? '; the largest:' : ':'}</p><ul>${c.w.map(([t, s, a]) => `<li><a href="${TG.read(s)}" target="_blank" rel="noopener">${esc(t)}</a><small>${esc(a)}</small></li>`).join('')}</ul>`
          : '<p class="small" style="margin:6px 0 0">No book by the divines names this subject in its title.</p>'}`;
    }
    cols.forEach((o, i) => { o.g.addEventListener('mouseenter', () => show(i)); o.g.addEventListener('focus', () => show(i)); o.g.addEventListener('click', () => show(i)); });
    let shown = -1;
    function render(p, fin) {
      const k = fin ? 33 : p * 33.6, built = Math.min(33, Math.floor(k));
      cols.forEach((o, i) => { const u = clamp(k - i, 0, 1); o.stones.forEach((s, j) => { const v = clamp(u * o.stones.length - j, 0, 1); s.style.opacity = v; s.style.transform = `translateY(${(1 - ease(v)) * -14}px)`; });
        o.g.querySelector('.cap').style.opacity = u >= 1 ? 1 : 0; o.n.style.opacity = 0.25 + 0.75 * u; });
      const roof = fin ? 1 : clamp((p - 0.86) / 0.12, 0, 1);
      ent.style.opacity = roof; ent.style.transform = `translateY(${(1 - roof) * -10}px)`; ped.style.opacity = clamp(roof * 1.4 - 0.4, 0, 1);
      const cur = fin ? 0 : Math.min(32, Math.max(0, Math.floor(k - 0.5)));
      if (cur !== shown && (!fin || shown < 0)) { shown = cur; show(cur); }
    }
    TG.chapter('#tg-conf', 3400, render, { scrub: 0.5 });
  })();

  /* ---------- the debates: the members the minutes name, re-ranked month by month ---------- */
  (function debates() {
    const B = D.debate, P = B.people, M = B.months, box = document.getElementById('tg-debbox'), now = document.getElementById('tg-deb-now'), card = document.getElementById('tg-deb-card');
    const last = Math.max(...P.flatMap((p) => p.m.map(([mi]) => mi)));
    const cum = P.map((p) => { const a = new Array(M.length).fill(0); p.m.forEach(([mi, k]) => { a[mi] += k; }); for (let i = 1; i < a.length; i++) a[i] += a[i - 1]; return a; });
    const perMonth = M.map((_, i) => P.reduce((t, p) => t + (p.m.find(([mi]) => mi === i) || [0, 0])[1], 0));
    const cumAll = perMonth.reduce((acc, v) => { acc.push((acc.length ? acc[acc.length - 1] : 0) + v); return acc; }, []); // the scroll is paced by the speeches, not the months
    const notes = D.events.concat(B.notes).sort((a, b) => (a[0] < b[0] ? -1 : 1));
    const noteAt = (mo) => notes.filter((e) => e[0].slice(0, 7) <= mo).pop();
    const monthName = (mo) => { const [y, m] = mo.split('-').map(Number); return `${MON[m - 1]} ${y}`; };
    const RH = 23, max = Math.max(...P.map((p) => p.c));
    box.style.height = `${P.length * RH}px`;
    const rows = P.map((p, i) => {
      const r = document.createElement('button'); r.type = 'button'; r.className = 'row'; r.setAttribute('role', 'listitem');
      r.innerHTML = `<span class="nm">${esc(p.n)}</span><span class="bar"><i style="background:${fc(p.f)}"></i></span><b class="ct num">0</b>`;
      r.style.transform = `translateY(${i * RH}px)`;
      r.addEventListener('click', () => pick(i)); box.appendChild(r); return r;
    });
    document.getElementById('tg-deb-vols').innerHTML = `Read the minutes: ${D.vols.map((v) => `<a href="${TG.read(v.s)}" target="_blank" rel="noopener">${esc(v.label.split(':')[0])}${/papers/i.test(v.label) ? ' (the papers)' : ''}</a>`).join(' · ')}`;
    const firstOf = {}; D.sessions.forEach((s) => { const mo = s[1].slice(0, 7); if (!firstOf[mo]) firstOf[mo] = s; });
    const monthLink = (mo) => { const s = firstOf[mo]; return s ? `<a href="${TG.read(s[2], s[3])}" target="_blank" rel="noopener">${monthName(mo)}</a>` : monthName(mo); };
    const used = D.fam.filter(([k]) => P.some((p) => p.f === k));
    document.getElementById('tg-deb-key').innerHTML = used.map(([k, n]) => `<span><i style="background:${fc(k)}"></i>${esc(n)}</span>`).join('');
    let picked = -1, shownMo = '';
    function pick(i) {
      picked = i; const p = P[i]; rows.forEach((r, j) => r.classList.toggle('on', j === i));
      const [fd, fl, fv, fp] = p.first, [td, tl, tv, tp] = p.top;
      const name = p.on ? `<a href="${TG.author(p.n)}" target="_blank" rel="noopener">${esc(p.n)}</a>` : esc(p.n);
      card.innerHTML = `<p class="eyebrow" style="margin:0 0 4px">${esc(famName(p.f))}</p><h3>${name}</h3>
        <p class="small" style="margin:6px 0 0">The minutes give him ${fmt(p.c)} speeches. The first is in <a href="${TG.read(fv, fp)}" target="_blank" rel="noopener">${esc(fl)}, ${esc(long(fd))}</a>. He spoke most in <a href="${TG.read(tv, tp)}" target="_blank" rel="noopener">${esc(tl)}, ${esc(long(td))}</a>.</p>`;
    }
    function summary() {
      const f = B.by_f;
      card.innerHTML = `<p class="eyebrow" style="margin:0 0 4px">${fmt(B.named)} speeches by a named member</p><h3>The parties on the floor</h3>
        <p class="small" style="margin:6px 0 0">The Independents made ${fmt(f.indep || 0)} of them. The Scottish commissioners made ${fmt(f.scots || 0)} and the Erastians ${fmt(f.erast || 0)}. The body of the Assembly made the other ${fmt(f.body || 0)}. Choose a member to open the day he spoke most.</p>`;
    }
    function render(p, fin) {
      const k = fin ? last : Math.min(last, Math.max(0, cumAll.findIndex((v) => v >= p * B.named))), mo = M[k];
      const vals = cum.map((a) => a[k]);
      vals.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).forEach(([v, i], r) => {
        const row = rows[i]; row.style.transform = `translateY(${r * RH}px)`; row.style.opacity = v ? 1 : 0.4;
        row.querySelector('.bar i').style.width = `${(100 * v) / max}%`; row.querySelector('.ct').textContent = fmt(v);
      });
      const note = noteAt(mo);
      now.innerHTML = fin || k === last ? `<b>${monthLink(M[0])} to ${monthLink(M[last])}</b> · ${fmt(B.named)} named speeches` : `<b>${monthLink(mo)}</b> · ${fmt(perMonth[k])} named ${perMonth[k] === 1 ? 'speech' : 'speeches'}`;
      if (picked >= 0) return;
      if (fin || k === last) { summary(); shownMo = ''; return; }
      if (note && note[0] !== shownMo) { shownMo = note[0]; card.innerHTML = `<p class="eyebrow" style="margin:0 0 4px">${esc(long(note[0]))}</p><h3>${esc(note[1])}</h3>${note[2] ? `<p class="small" style="margin:6px 0 0">${esc(note[2])}</p>` : ''}`; }
    }
    TG.chapter('#tg-deb', 3600, render, { scrub: 0.5 });
  })();

  /* ---------- the Annotations of 1645: every chapter of the Bible, shaded by the length of its notes ---------- */
  (function annotations() {
    const A = D.annot, svg = document.querySelector('#tg-annbox svg'), NS = 'http://www.w3.org/2000/svg', card = document.getElementById('tg-ann-card'), tip = document.querySelector('#tg-annbox .tip');
    const mk = (tag, at, parent = svg) => { const e = document.createElementNS(NS, tag); for (const key in at) e.setAttribute(key, at[key]); parent.appendChild(e); return e; };
    document.getElementById('tg-annot').href = TG.read(A.slug);
    document.getElementById('tg-ann-start').href = TG.read(A.slug, A.preface_page);
    document.getElementById('tg-ann-adv').href = TG.read(A.slug, A.adv_page);
    const sel = document.getElementById('tg-ann-pick');
    A.books.forEach(([name], bi) => { const o = document.createElement('option'); o.value = bi; o.textContent = name; sel.appendChild(o); });
    sel.addEventListener('change', () => { if (sel.value === '') return; const bi = Number(sel.value); showBook(bi); window.open(TG.read(A.slug, A.books[bi][1]), '_blank', 'noopener'); });
    const PER = 40, CS = 12, STEP = 14, TOP = 18, GAPY = 34, W = PER * STEP;
    const nz = A.books.flatMap((b) => b[2].map((c) => c[0])).filter((w) => w > 0).sort((a, b) => a - b);
    const rank = (w) => { let lo = 0, hi = nz.length; while (lo < hi) { const m = (lo + hi) >> 1; if (nz[m] < w) lo = m + 1; else hi = m; } return lo / (nz.length - 1); };
    const shade = (w) => (w ? 0.1 + 0.9 * rank(w) : 0);
    const isAdv = (b, ch) => A.adv.some(([n, c]) => n === b && c === ch);
    const cells = []; let col = 0, row = 0, y0 = TOP;
    const lab = (t, y) => { const e = mk('text', { x: 0, y: y - 6, class: 'tlab' }); e.textContent = t; };
    lab('Old Testament', TOP);
    A.books.forEach(([name, p0, chs], bi) => {
      if (bi === 39) { y0 = TOP + (row + (col ? 1 : 0)) * STEP + GAPY; row = 0; col = 0; lab('New Testament', y0); }
      chs.forEach(([w, pg], ci) => {
        const x = col * STEP, y = y0 + row * STEP, adv = isAdv(name, ci + 1);
        const r = mk('rect', { x, y, width: CS, height: CS, rx: 1.5, class: 'cell', tabindex: -1,
          fill: w ? TG.css('--ink-2') : 'none', 'fill-opacity': shade(w), stroke: w ? 'none' : TG.css('--muted'), 'stroke-dasharray': w ? '' : '2 2', 'stroke-width': 1 });
        if (ci === 0 && col) mk('line', { x1: x - 1, x2: x - 1, y1: y - 1.5, y2: y + CS + 1.5, stroke: TG.css('--ink'), 'stroke-width': 1.2, opacity: 0.5 });
        cells.push({ r, bi, ci, w, pg, adv, x, y });
        col += 1; if (col === PER) { col = 0; row += 1; }
      });
    });
    const KY = y0 + (row + (col ? 1 : 0)) * STEP + 16, H = KY + 22;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const key = mk('g', { class: 'tlab' });
    [0.1, 0.32, 0.55, 0.78, 1].forEach((s, i) => mk('rect', { x: 74 + i * STEP, y: KY, width: CS, height: CS, rx: 1.5, fill: TG.css('--ink-2'), 'fill-opacity': s }, key));
    const k1 = mk('text', { x: 0, y: KY + 10, class: 'tlab' }, key); k1.textContent = 'Shorter';
    const k2 = mk('text', { x: 74 + 5 * STEP + 6, y: KY + 10, class: 'tlab' }, key); k2.textContent = 'Longer notes';
    mk('rect', { x: 290, y: KY, width: CS, height: CS, rx: 1.5, fill: 'none', stroke: TG.css('--muted'), 'stroke-dasharray': '2 2' }, key);
    const k3 = mk('text', { x: 290 + STEP + 6, y: KY + 10, class: 'tlab' }, key); k3.textContent = 'No notes of its own';
    const SHORT = { Philippians: 'Phil.', '1 Timothy': '1 Tim.', Hebrews: 'Heb.' };
    const placed = []; // a label that would touch the one before it on the same row goes under its square
    const rings = cells.filter((c) => c.adv).map((c) => {
      const below = placed.some((q) => q.y === c.y && Math.abs(q.x - c.x) < 54); placed.push(c);
      const g = mk('g', { opacity: 0 }); mk('rect', { x: c.x - 2.5, y: c.y - 2.5, width: CS + 5, height: CS + 5, rx: 3, fill: 'none', stroke: TG.css('--rubric'), 'stroke-width': 2 }, g);
      const l = mk('text', { x: c.x + CS / 2, y: below ? c.y + CS + 14 : c.y - 6, 'text-anchor': 'middle', class: 'alab' }, g); l.textContent = `${SHORT[A.books[c.bi][0]]} ${c.ci + 1}`; return g;
    });
    const bookWords = A.books.map((b) => b[2].reduce((t, c) => t + c[0], 0));
    const longest = (bi) => A.books[bi][2].reduce((m, c, i, a) => (c[0] > a[m][0] ? i : m), 0) + 1;
    const testament = (bi) => (bi < 39 ? 'Old Testament' : 'New Testament');
    function showBook(bi) {
      const [name, p0, chs] = A.books[bi];
      card.innerHTML = `<p class="eyebrow" style="margin:0 0 4px">${testament(bi)} · book ${bi + 1} of 66</p><h3><a href="${TG.read(A.slug, p0)}" target="_blank" rel="noopener">${esc(name)}</a></h3>
        <p class="small" style="margin:6px 0 0">${chs.length} ${chs.length === 1 ? 'chapter' : 'chapters'} and ${fmt(bookWords[bi])} words of notes. The longest notes are on chapter ${longest(bi)}.</p>`;
    }
    function showAdv() {
      const s = D.debate.tim517, inNov = s.filter((x) => x[0] >= '1643-11-01' && x[0] <= '1643-12-31'), first = s[0];
      card.innerHTML = `<p class="eyebrow" style="margin:0 0 4px">An advertisement before the notes</p><h3>Philippians 1:1, 1 Timothy 3:1 and 5:17, Hebrews 6:2</h3>
        <p class="small" style="margin:6px 0 0">One annotator’s notes on these places seemed to defend bishops. The others left his notes as they stood and answered them in <a href="${TG.read(A.slug, A.adv_page)}" target="_blank" rel="noopener">an advertisement at the front of the book</a>. The Assembly argued over the same verse. The minutes cite 1 Timothy 5:17 in ${s.length} sessions. The debate on ruling elders in November and December 1643 accounts for ${inNov.length} of them. The first is <a href="${TG.read(first[2], first[3])}" target="_blank" rel="noopener">${esc(first[1])}</a>.</p>`;
    }
    const wrap = document.getElementById('tg-annbox');
    let hover = -1, lastK = 0;
    const paint = () => cells.forEach((c, i) => { c.r.style.opacity = (0.12 + 0.88 * clamp(lastK - i, 0, 1)) * (hover < 0 || c.bi === hover ? 1 : 0.35); });
    const dim = () => paint();
    svg.addEventListener('mousemove', (e) => {
      const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const q = pt.matrixTransform(svg.getScreenCTM().inverse());
      const c = cells.find((o) => q.x >= o.x - 1 && q.x <= o.x + STEP - 1 && q.y >= o.y - 1 && q.y <= o.y + STEP - 1);
      if (!c) { tip.hidden = true; if (hover >= 0) { hover = -1; dim(); } return; }
      const name = A.books[c.bi][0], b = wrap.getBoundingClientRect();
      tip.innerHTML = `${esc(name)} ${c.ci + 1}<small>${c.w ? `${fmt(c.w)} words of notes · choose it to read them` : 'No notes of its own. The notes on chapter 43 end with a discussion of the whole vision.'}</small>`;
      tip.hidden = false; tip.style.left = `${Math.min(e.clientX - b.left + 12, b.width - 240)}px`; tip.style.top = `${e.clientY - b.top + 14}px`;
      if (hover !== c.bi) { hover = c.bi; dim(); }
      showChapter(c);
    });
    svg.addEventListener('mouseleave', () => { tip.hidden = true; hover = -1; dim(); });
    const pageOf = (c) => (c.w ? c.pg : A.books[c.bi][2][42][1]); // Ezekiel 44-48 open the notes on chapter 43
    function showChapter(c) {
      const [name, , chs] = A.books[c.bi];
      card.innerHTML = `<p class="eyebrow" style="margin:0 0 4px">${testament(c.bi)} · ${esc(name)}</p><h3><a href="${TG.read(A.slug, pageOf(c))}" target="_blank" rel="noopener">${esc(name)} ${c.ci + 1}</a></h3>
        <p class="small" style="margin:6px 0 0">${c.w ? `${fmt(c.w)} words of notes.` : 'No notes of its own. The notes on chapter 43 end with a discussion of the whole vision.'} The book has ${chs.length} ${chs.length === 1 ? 'chapter' : 'chapters'} and ${fmt(bookWords[c.bi])} words of notes.</p>`;
    }
    let touch = false, tapped = null;
    svg.addEventListener('pointerdown', (e) => { touch = e.pointerType !== 'mouse'; });
    svg.addEventListener('click', (e) => {
      const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const q = pt.matrixTransform(svg.getScreenCTM().inverse());
      const c = cells.find((o) => q.x >= o.x - 1 && q.x <= o.x + STEP - 1 && q.y >= o.y - 1 && q.y <= o.y + STEP - 1);
      if (!c) return;
      if (touch && tapped !== c) { tapped = c; hover = c.bi; dim(); showChapter(c); return; }
      window.open(TG.read(A.slug, pageOf(c)), '_blank', 'noopener');
    });
    let shownBook = -2;
    function render(p, fin) {
      const n = cells.length, k = fin ? n : clamp(p / 0.86, 0, 1) * n;
      lastK = k; paint();
      const adv = fin ? 1 : clamp((p - 0.88) / 0.08, 0, 1);
      rings.forEach((r) => r.setAttribute('opacity', adv));
      if (hover >= 0) return;
      if (adv > 0.5) { if (shownBook !== -1) { shownBook = -1; showAdv(); } return; }
      const {bi} = cells[Math.min(n - 1, Math.max(0, Math.floor(k) - 1))];
      if (bi !== shownBook) { shownBook = bi; showBook(bi); }
    }
    TG.chapter('#tg-ann', 4000, render, { scrub: 0.5 });
  })();

  /* ---------- the Assembly's own texts ---------- */
  (function texts() {
    const docs = D.docs.map(([s, t, y]) => `<a href="${TG.read(s)}" target="_blank" rel="noopener"><b>${esc(t)}</b><small>${y} · in the Confessions</small></a>`);
    const pages = [['westminster-shorter/', 'Learn the Shorter Catechism', 'question by question'], ['westminster-larger/', 'Learn the Larger Catechism', 'question by question']]
      .map(([h, t, s]) => `<a href="${TG.href(h)}"><b>${esc(t)}</b><small>${esc(s)}</small></a>`);
    const vols = D.vols.map((v) => `<a href="${TG.read(v.s)}" target="_blank" rel="noopener"><b>${esc(v.label.replace(/^Vol\. ([\w ,]+?): /, 'The Minutes, $1: '))}</b><small>${fmt(v.p)} pages</small></a>`);
    document.getElementById('tg-texts').innerHTML = docs.concat(pages, vols).join('');
    if (G) gsap.from('#tg-texts a', { opacity: 0, y: 14, duration: 0.5, stagger: 0.05, ease: 'power2.out', scrollTrigger: { trigger: '#tg-texts', start: 'top 85%', once: true } });
  })();

  /* ---------- the finder ---------- */
  explorer = TG.explorer(document.getElementById('tg-explorer'), D, { range: [1560, 1710], first: 'William Twisse', placeholder: 'Twisse, Rutherford, covenant, catechism…', label: 'Lifelines of the Assembly divines on the shelf',
    hint: 'Each line is a life. A short mark is a divine known only by the year he died (or was born). Choose one to see his works on the shelf.' });
  TG.reveal('.tg .reveal');
})();
