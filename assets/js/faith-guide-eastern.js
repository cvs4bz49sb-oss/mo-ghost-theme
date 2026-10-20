/* The Eastern Fathers guide: the shelf as a rose of its eight languages, the tomes on one shelf, the opening of a work in each script, the
   churches of the East on a map, Severus's 125 homilies by the tome that printed them, and three books of the saints as wheels of the year. */
(async () => {
  const method = (html) => (window.TFRMethod ? window.TFRMethod.html(html) : html);
  const { TG } = window, D = await TG.load('data');
  const { esc, fmt, clamp, ease, lerp } = TG, G = TG.hasG && !TG.reduce ? window.gsap : null;
  const FK = D.fam.map((f) => f[0]), fc = (k) => TG.css(`--f${FK.indexOf(k) + 1}`), fname = (k) => (D.fam.find((f) => f[0] === k) || [])[1] || '';
  const NS = 'http://www.w3.org/2000/svg', mk = (tag, at, to) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); if (to) to.appendChild(e); return e; };
  const ROOM = (k) => `${TG.href('patrologia-orientalis/')}?view=tome&tome=${encodeURIComponent(k.startsWith('PS') ? 'PS' : k)}`;
  const LETTER = { syc: 'ܐ', ar: 'ا', cop: 'Ⲁ', gez: 'አ', hy: 'Ա', ka: 'ა', grc: 'α', chu: 'ѧ', la: '' }; // the first letter of each alphabet; Greek and Slavonic by a letter of their own
  const LANGTAG = { syc: 'syc', ar: 'ar', cop: 'cop', gez: 'gez', hy: 'hy', ka: 'ka', grc: 'grc', chu: 'cu', la: 'la' };
  const short = (k) => (k === 'la' ? 'Latin or no original' : fname(k));
  const yearOf = (t) => (t.y ? String(t.y) : /^\d+$/.test(t.k) && Number(t.k) <= 22 ? '1904–1930' : '');
  const tipAt = (tip, host, e, html) => { const b = host.getBoundingClientRect(); tip.innerHTML = html; tip.hidden = false;
    tip.style.left = `${Math.max(4, Math.min(e.clientX - b.left + 12, b.width - 260))}px`; tip.style.top = `${Math.min(e.clientY - b.top + 14, b.height - 40)}px`; };
  // the scripts' own faces, the Noto faces the reader loads
  if (!document.querySelector('link[data-tg-scripts]')) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.setAttribute('data-tg-scripts', '');
    l.href = 'https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic&family=Noto+Sans+Coptic&family=Noto+Sans+Syriac&family=Noto+Serif+Armenian&family=Noto+Serif+Ethiopic&family=Noto+Serif+Georgian&family=Noto+Serif:ital@0;1&display=swap';
    document.head.appendChild(l);
  }

  /* ---------- hero: facts, and the shelf as a rose of its languages ---------- */
  const facts = { tomes: D.n_tomes, works: D.n_works, langs: D.n_lang, pages: D.n_pages };
  document.querySelectorAll('[data-count]').forEach((el) => TG.countUp(el, facts[el.dataset.count], 1.8));
  (function rose() {
    const svg = document.querySelector('.rose svg'), cap = document.querySelector('.rose .cap');
    const PET = FK.length, SPAN = (2 * Math.PI) / PET, GAP = 0.03, R0 = 50;
    const by = FK.map((k) => D.hero.filter((h) => h[2] === k).sort((a, b) => a[4] - b[4])); // [slug, title, lang, pages, tome order, author, cite]
    // tiles fill each petal ring by ring outward, the earliest tomes nearest the center; the pitch is as large as lets the longest petal fit
    const place = (n, S) => { const out = []; let r = R0; while (out.length < n) { const room = Math.max(1, Math.floor(((SPAN - 2 * GAP) * r) / S)), m = Math.min(room, n - out.length);
      for (let j = 0; j < m; j++) out.push([r, (j + 0.5) / room + (room - m) / room / 2]); r += S; } return out; };
    let S = 20; while (S > 6 && Math.max(...by.map((L) => (L.length ? place(L.length, S).pop()[0] : 0))) > 262) S -= 0.25;
    const maxP = Math.max(...D.hero.map((h) => h[3])), g0 = mk('g', {}, svg), gT = mk('g', {}, svg), gL = mk('g', {}, svg), tiles = [];
    mk('circle', { r: R0 - 12, fill: 'none', stroke: TG.css('--rule'), 'stroke-width': 0.8 }, g0);
    by.forEach((L, i) => {
      const c = -Math.PI / 2 + i * SPAN, a0 = c - SPAN / 2 + GAP, a1 = c + SPAN / 2 - GAP, pos = place(L.length, S), sa = c - SPAN / 2;
      mk('line', { x1: (Math.cos(sa) * (R0 - 12)).toFixed(1), y1: (Math.sin(sa) * (R0 - 12)).toFixed(1), x2: (Math.cos(sa) * 300).toFixed(1), y2: (Math.sin(sa) * 300).toFixed(1), class: 'spoke' }, g0);
      L.forEach((h, j) => {
        const [r, f] = pos[j], a = a0 + (a1 - a0) * f, s = S * 0.8;
        const el = mk('a', { href: TG.read(h[0]), target: '_blank', rel: 'noopener', class: 'tile', 'aria-label': `${h[1]}, ${h[5]}, ${h[6]}, ${fname(h[2])}` }, gT);
        mk('rect', { x: (-s / 2).toFixed(1), y: (-s / 2).toFixed(1), width: s.toFixed(1), height: s.toFixed(1), rx: 1.6, fill: fc(h[2]), 'fill-opacity': (0.4 + 0.6 * Math.sqrt(h[3] / maxP)).toFixed(2),
          transform: `translate(${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}) rotate(${((a * 180) / Math.PI + 90).toFixed(1)})` }, el);
        const say = () => { cap.dataset.m = ''; cap.textContent = `${h[1]} · ${h[5]} · ${h[6]} · ${fmt(h[3])} pages · ${fname(h[2])}`; };
        el.addEventListener('mouseenter', say); el.addEventListener('focus', say);
        tiles.push({ el, t: h[4], r });
      });
      // the label stands off the end of its petal, on the side the petal points to
      const end = pos.length ? pos[pos.length - 1][0] : R0, cc = Math.cos(c), down = Math.sin(c) > 0.5, anc = cc > 0.45 ? 'start' : cc < -0.45 ? 'end' : 'middle';
      const lr = Math.min(300, end + S * 0.6 + (anc === 'middle' ? 18 : 10)), lx = cc * lr, ly = Math.sin(c) * lr, lg = mk('g', { class: 'lab' }, gL), gy = LETTER[FK[i]];
      if (gy) mk('text', { x: lx.toFixed(1), y: (ly + (down ? 6 : -6)).toFixed(1), class: `glyph sc-${FK[i]}`, fill: fc(FK[i]), 'text-anchor': anc }, lg).textContent = gy;
      mk('text', { x: lx.toFixed(1), y: (ly + (down ? 30 : gy ? 14 : 4)).toFixed(1), class: 'lname', 'text-anchor': anc }, lg).textContent = `${short(FK[i])} · ${L.length}`;
    });
    const mid = mk('text', { x: 0, y: 6, class: 'mid' }, gL), mids = mk('text', { x: 0, y: 22, class: 'mids' }, gL);
    const done = () => { mid.textContent = fmt(D.n_works); mid.style.fontSize = ''; mids.textContent = 'works'; };
    const def = 'Each tile is a work in the petal of the language it is printed in. The earliest tomes sit nearest the center. Darker tiles are longer works.';
    const showDef = () => { if (cap.dataset.m !== '1') { cap.dataset.m = '1'; cap.innerHTML = method(def); } };
    svg.addEventListener('mouseleave', showDef); showDef();
    if (!G) { done(); return; }
    // the series is shelved tome by tome: the rose grows outward from the Syriaca of 1894 to the tomes of the 1990s
    const order = tiles.slice().sort((a, b) => a.t - b.t || a.r - b.r), st = { t: 0 }; let shown = 0;
    gsap.set(order.map((t) => t.el), { opacity: 0 }); gsap.set(gL.querySelectorAll('.lab'), { opacity: 0 });
    TG.intro({ delay: 0.3 })
      .from(g0.children, { opacity: 0, duration: 0.5, stagger: 0.03 })
      .to(st, { t: D.tomes.length - 1, duration: 4.4, ease: 'none', onUpdate() {
        const T = Math.floor(st.t), tm = D.tomes[T];
        while (shown < order.length && order[shown].t <= T) gsap.to(order[shown++].el, { opacity: 1, duration: 0.3 });
        mid.textContent = tm.c; mid.style.fontSize = '24px'; mids.textContent = yearOf(tm); } }, 0.3)
      .add(() => { order.slice(shown).forEach((t) => gsap.set(t.el, { opacity: 1 })); done(); })
      .to(gL.querySelectorAll('.lab'), { opacity: 1, duration: 0.5, stagger: 0.06 });
  })();

  /* ---------- 1. the series: every tome on one shelf, as tall as its pages, then banded by the languages of its texts ---------- */
  (function series() {
    const host = document.getElementById('tg-stage'), svg = host.querySelector('svg'), tip = host.querySelector('.tip'), ph = document.getElementById('tg-tphase'), lgd = document.getElementById('tg-tlgd');
    const T = D.tomes, X0 = 30, X1 = 990, BASE = 380, HMAX = 330, step = (X1 - X0) / (T.length + 1), W = step * 0.76;
    const xs = T.map((t, i) => X0 + (i + (i >= 3 ? 1 : 0) + 0.5) * step), maxP = Math.max(...T.map((t) => t.p)), hOf = (p) => 6 + ((HMAX - 6) * p) / maxP;
    mk('rect', { x: X0 - 8, y: BASE, width: X1 - X0 + 16, height: 9, rx: 1, class: 'plank' }, svg);
    const gS = mk('g', {}, svg), gN = mk('g', {}, svg), gB = mk('g', {}, svg);
    const spines = T.map((t, i) => {
      const x = xs[i] - W / 2;
      if (!t.n) { const g = mk('g', {}, gS); mk('rect', { x: x.toFixed(1), y: BASE - 34, width: W.toFixed(1), height: 34, class: 'gap' }, g); return { t, i, g, empty: true }; }
      const h = hOf(t.p), a = mk('a', { href: ROOM(t.k), target: '_blank', rel: 'noopener', class: 'spine', 'aria-label': `${t.c}${yearOf(t) ? `, ${yearOf(t)}` : ''}: ${t.n} works, ${fmt(t.p)} pages` }, gS), g = mk('g', {}, a);
      const sk = mk('rect', { x: x.toFixed(1), y: (BASE - h).toFixed(1), width: W.toFixed(1), height: h.toFixed(1), rx: 1.5, class: 'sk' }, g), bands = [];
      let y = BASE; FK.forEach((k) => { const p = t.L[k]; if (!p) return; const bh = (h * p) / t.p; y -= bh;
        bands.push(mk('rect', { x: x.toFixed(1), y: y.toFixed(1), width: W.toFixed(1), height: bh.toFixed(2), fill: fc(k), stroke: TG.css('--card'), 'stroke-width': 0.6, opacity: 0 }, g)); });
      a.addEventListener('mousemove', (e) => tipAt(tip, host, e, `${esc(t.c)}${yearOf(t) ? ` · ${esc(yearOf(t))}` : ''}<small>${t.n} ${t.n === 1 ? 'work' : 'works'} · ${fmt(t.p)} pages</small>${t.w.slice(0, 5).map((w) => `<small><i style="display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:5px;background:${fc(w[3])}"></i>${esc(w[0])}</small>`).join('')}${t.n > 5 ? `<small>and ${t.n - 5} more: open the tome</small>` : ''}`));
      a.addEventListener('mouseleave', () => { tip.hidden = true; });
      return { t, i, g, sk, bands, h };
    });
    // the tome numbers under the plank, and the three parts of the shelf
    T.forEach((t, i) => { if (t.n && (i < 3 || Number(t.k) === 1 || Number(t.k) % 5 === 0 || Number(t.k) === 59)) mk('text', { x: xs[i].toFixed(1), y: BASE + 24, class: 'tn' }, gN).textContent = i < 3 ? t.k.slice(2) : t.k; });
    const last = T[T.length - 1], parts = [[0, 2, 'Patrologia Syriaca', `${T[0].y}–${T[2].y}`], [3, 24, `Tomes 1–22`, '1904–1930'],
      [25, T.length - 1, `Tomes 23–${last.k}`, `${T[25].y}–${last.y}${T.some((t) => !t.n) ? ` · ${T.filter((t) => !t.n).map((t) => t.k).join(' and ')} not held` : ''}`]];
    parts.forEach(([a, b, n, y]) => { const x0 = xs[a] - W / 2, x1 = xs[b] + W / 2, yy = BASE + 36;
      mk('path', { d: `M${x0.toFixed(1)},${yy} v7 H${x1.toFixed(1)} v-7`, class: 'brk' }, gB);
      mk('text', { x: ((x0 + x1) / 2).toFixed(1), y: yy + 28, class: 'bl' }, gB).textContent = n;
      mk('text', { x: ((x0 + x1) / 2).toFixed(1), y: yy + 44, class: 'bs' }, gB).textContent = y; });
    lgd.innerHTML = FK.filter((k) => T.some((t) => t.L[k])).map((k) => `<span><i style="background:${fc(k)}"></i>${esc(short(k))}</span>`).join('');
    const totals = {}; FK.forEach((k) => { totals[k] = T.reduce((s, t) => s + (t.L[k] || 0), 0); });
    const TR = { fr: 'French', la: 'Latin', en: 'English', it: 'Italian', de: 'German' };
    const trLine = Object.entries(D.tr).map(([k, n], j) => `${TR[k]}${j ? '' : ' for'} ${fmt(n)}`).join(', ');
    let last0 = '';
    function render(p) {
      const pA = clamp(p / 0.5, 0, 1), pB = clamp((p - 0.52) / 0.28, 0, 1), pC = clamp((p - 0.82) / 0.14, 0, 1), k = pA * (T.length + 0.5), kb = pB * (T.length + 6);
      let cur = -1; const seen = {};
      spines.forEach((s) => {
        const u = ease(clamp(k - s.i, 0, 1)); s.g.setAttribute('transform', `translate(0 ${BASE}) scale(1 ${Math.max(0.0001, u).toFixed(3)}) translate(0 ${-BASE})`);
        if (u > 0) cur = s.i;
        if (s.empty) return;
        const v = clamp(kb - s.i, 0, 1); s.bands.forEach((b) => { b.setAttribute('opacity', v.toFixed(2)); });
        if (v > 0.5) FK.forEach((f) => { seen[f] = (seen[f] || 0) + (s.t.L[f] || 0); });
      });
      spines.forEach((s) => { if (!s.empty) s.sk.classList.toggle('cur', pA < 1 && s.i === cur); });
      gB.style.opacity = pC; lgd.style.opacity = pB > 0 ? 1 : 0;
      let html;
      if (p >= 0.999 || pC > 0) html = `<b>${T.filter((t) => t.n).length} volumes, ${fmt(D.n_works)} works, ${fmt(D.n_pages)} pages</b>Each text was printed with a translation facing it: ${esc(trLine)} works.`;
      else if (pB > 0) { const ks = FK.filter((f) => seen[f]); html = `<b>The languages of the texts</b>Pages in each language on the tomes passed so far.<span class="ln">${ks.map((f) => `<span><i style="background:${fc(f)}"></i>${esc(short(f))} ${fmt(seen[f])}</span>`).join('')}</span>`; }
      else { const t = T[Math.max(0, cur)], big = t.w.slice().sort((a, b) => b[2] - a[2])[0];
        html = `<b>${esc(t.c)}${yearOf(t) ? ` · ${esc(yearOf(t))}` : ''}</b>${t.n ? `${t.n} ${t.n === 1 ? 'work' : 'works'}, ${fmt(t.p)} pages. The longest: ${esc(big[0])} (${esc(big[4])}).` : 'Not on the shelf.'}`; }
      if (html !== last0) { last0 = html; ph.innerHTML = html; }
    }
    TG.chapter('#tg-series', 3800, (p, fin) => render(fin ? 1 : p), { scrub: 0.5 });
  })();

  /* ---------- 2. the languages: the pages in each, and the opening of one of its works with the library's English ---------- */
  (function langs() {
    const grid = document.getElementById('tg-lgrid'), stack = document.getElementById('tg-stack'), sl = document.getElementById('tg-stack-l');
    const L = D.langs.filter((x) => x.s), rest = D.langs.find((x) => !x.s), tot = D.n_pages, pct = (p) => Math.round((100 * p) / tot);
    grid.innerHTML = L.map((x) => `<li class="lg" data-k="${x.k}"><span class="rule" style="background:${fc(x.k)}"></span><span class="gl sc sc-${x.k}" style="color:${fc(x.k)}" aria-hidden="true">${LETTER[x.k]}</span>
      <div class="hd"><b>${esc(x.name)}</b><small>${x.n} works · ${fmt(x.p)} pages</small></div>
      <p class="src sc sc-${x.k}" lang="${LANGTAG[x.k]}"${x.s.rtl ? ' dir="rtl"' : ''}>${esc(x.s.src)}</p>
      <p class="en">${esc(x.s.en)}</p>
      <p class="who">${esc(x.s.c)}, p. ${esc(x.s.pg)} · <a href="${TG.read(x.s.slug, x.s.pg)}" target="_blank" rel="noopener">${esc(x.s.t)}</a>${x.s.a ? ` · ${esc(x.s.a)}` : ''}</p></li>`).join('');
    const cards = [...grid.children], all = L.concat(rest ? [rest] : []);
    stack.innerHTML = all.map((x) => `<i style="background:${fc(x.k)}" title="${esc(x.name)}"></i>`).join('');
    const segs = [...stack.children];
    const fin = `${L.slice().sort((a, b) => b.p - a.p).map((x) => `${x.name} ${pct(x.p)}%`).join(', ')} of the pages${rest ? `; ${rest.n} short works are in Latin or have no original held` : ''}.`;
    let lastK = -2;
    function render(p, end) {
      const k = end ? all.length + 1 : p * (L.length + 0.8);
      cards.forEach((c, i) => {
        const u = clamp(k - i, 0, 1), x = L[i], src = c.querySelector('.src');
        c.style.opacity = (0.12 + 0.88 * clamp(u * 2, 0, 1)).toFixed(2);
        const w = 100 * (1 - ease(clamp(u * 1.25, 0, 1)));
        src.style.clipPath = w <= 0.01 ? 'none' : x.s.rtl ? `inset(0 0 0 ${w.toFixed(1)}%)` : `inset(0 ${w.toFixed(1)}% 0 0)`; // the line is uncovered in its own direction of reading
        c.querySelector('.en').style.opacity = clamp((u - 0.5) * 2.5, 0, 1).toFixed(2);
        c.querySelector('.gl').style.transform = `scale(${(0.6 + 0.4 * ease(clamp(u * 1.6, 0, 1))).toFixed(3)})`;
      });
      segs.forEach((s, i) => { const u = clamp(k - i, 0, 1); s.style.width = `${(((100 * all[i].p) / tot) * ease(u)).toFixed(2)}%`; });
      const now = Math.min(L.length - 1, Math.floor(k));
      if (now !== lastK) { lastK = now; cards.forEach((c, i) => c.classList.toggle('now', !end && i === now && k < L.length)); }
      sl.textContent = end || k >= L.length ? fin : k < 0.05 ? '' : `${L[now].name}: ${L[now].n} works, ${fmt(L[now].p)} of the shelf’s ${fmt(tot)} pages (${pct(L[now].p)}%).`;
    }
    TG.chapter('#tg-langs', 3400, (p, fin2) => render(fin2 ? 1 : p, fin2 || p >= 0.999), { scrub: 0.5 });
  })();

  /* ---------- 3. the churches of the East: the writers at the places their records name, century by century, beside the chronicle ---------- */
  (function east() {
    const box = document.getElementById('tg-map'), M = TG.map(box, D.land, [[9, 9.5], [70, 46]], { parallels: [15, 40], phone: [[24, 24], [52, 43]] });
    const cv = TG.canvas(box.querySelector('canvas')), { ctx } = cv, P = D.places;
    const q = D.biruni, quote = document.getElementById('tg-quote');
    quote.innerHTML = `<p class="src sc sc-ar" lang="ar" dir="rtl">${esc(q.src)}</p><p class="en">“${esc(q.en)}”</p>
      <p class="who">al-Biruni, a Muslim scholar of Khwarazm, around 1000 · <a href="${TG.read(q.slug, q.pg)}" target="_blank" rel="noopener">${esc(q.t)}</a>, PO 10, p. ${esc(q.pg)}</p>`;
    const chron = TG.chronicle(document.getElementById('tg-chron'), D.events, ([y, e, w]) => `<li><span class="d">${y}</span><span class="e">${esc(e)}</span><span class="w">${esc(w)}</span></li>`);
    const flo = (a) => Math.round(a.y0 + Math.min(40, ((a.y1 || a.y0 + 60) - a.y0) * 0.6)); // when a writer was at work (the finder's rule)
    const A = D.authors.filter((a) => a.pl && P[a.pl]).map((a) => ({ a, fl: flo(a) })).sort((x, y) => x.fl - y.fl), at = {};
    A.forEach((o) => { (at[o.a.pl] = at[o.a.pl] || []).push(o); o.j = at[o.a.pl].length - 1; });
    const nPl = Object.keys(at).length, council = (a) => /^The (Council|Synod)/.test(a.n), nPers = D.authors.filter((a) => !council(a)).length, rib = document.getElementById('tg-ribbon'), legend = document.getElementById('tg-legend');
    legend.innerHTML = `${FK.filter((k) => A.some((o) => o.a.f === k)).map((k) => `<span><i style="background:${fc(k)}"></i>${esc(short(k))}</span>`).join('')}<span>Each dot is a writer, at the place where he lived or served</span>`;
    const Y0 = 100, Y1 = 1700; let year = Y0, lastRib = '';
    function render(Y) {
      year = Y; ctx.clearRect(0, 0, cv.W, cv.H); const ink = TG.css('--ink'), body = TG.css('--body'), land = TG.css('--land');
      // the lands, set first: their boxes are kept free, so a place's name never covers them
      const taken = [];
      ctx.save(); ctx.font = `600 10px ${body}`; ctx.fillStyle = TG.css('--muted'); ctx.globalAlpha = 0.7; ctx.textAlign = 'center'; if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
      D.labels.forEach(([n, la, lo]) => { const [x, y] = M.xy([la, lo]), w = ctx.measureText(n).width; ctx.fillText(n, x, y); taken.push([x - w / 2, y, w]); }); ctx.restore();
      const counts = [], fresh = [];
      for (const [pl, L] of Object.entries(at)) {
        const on = L.filter((o) => o.fl <= Y); if (!on.length) continue; const [x, y] = M.xy(P[pl]);
        counts.push([pl, on.length, x, y]);
        ctx.globalAlpha = 0.9; ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 6.283); ctx.fill();
        on.forEach((o) => { const r = 4.2 * Math.sqrt(o.j + 0.55), an = o.j * 2.39996, px = x + Math.cos(an) * r, py = y + Math.sin(an) * r, f = Y - o.fl < 28 && Y < Y1 - 1;
          if (f) { fresh.push([o, px, py]); ctx.globalAlpha = 0.18; ctx.fillStyle = fc(o.a.f); ctx.beginPath(); ctx.arc(px, py, 10, 0, 6.283); ctx.fill(); }
          ctx.globalAlpha = 1; ctx.fillStyle = fc(o.a.f); ctx.beginPath(); ctx.arc(px, py, f ? 4.4 : 3.2, 0, 6.283); ctx.fill(); ctx.strokeStyle = TG.css('--card'); ctx.lineWidth = 1; ctx.stroke(); });
      }
      // names: the writers who have just appeared, then the places that hold the most
      const hit = (lx, y, w) => taken.some((b) => lx < b[0] + b[2] + 4 && lx + w + 4 > b[0] && y - 11 < b[1] && y > b[1] - 11);
      const put = (txt, x, y, font, color) => { ctx.font = font; const w = ctx.measureText(txt).width; let lx = x + 8; if (lx + w > cv.W - 4) lx = x - 8 - w;
        if (hit(lx, y, w)) { lx = x - 8 - w; if (lx < 4 || hit(lx, y, w)) return; } taken.push([lx, y, w]); // right of the place, else left of it
        ctx.globalAlpha = 0.88; ctx.fillStyle = land; ctx.fillRect(lx - 2, y - 10, w + 4, 13); ctx.globalAlpha = 1; ctx.fillStyle = color; ctx.fillText(txt, lx, y); };
      fresh.forEach(([o, x, y]) => put(o.a.n, x, y - 6, `600 11.5px ${body}`, fc(o.a.f)));
      counts.sort((a, b) => b[1] - a[1]).forEach(([pl, n, x, y]) => put(pl, x, y + 13, `italic 11px ${TG.css('--display')}`, ink));
      ctx.globalAlpha = 1;
      document.getElementById('tg-year').textContent = Math.round(Y);
      document.getElementById('tg-yearbar').style.width = `${((Y - Y0) / (Y1 - Y0)) * 100}%`;
      chron(Y);
      // the writers alive in this year
      const alive = D.authors.filter((a) => a.y0 <= Y && (a.y1 || a.y0) >= Y && !council(a)).slice(0, 8);
      const sig = Y >= Y1 - 1 ? 'end' : alive.map((a) => a.n).join('|');
      if (sig !== lastRib) { lastRib = sig;
        rib.innerHTML = sig === 'end' ? `<span>${A.length} writers at ${nPl} places. ${nPers - A.length} more lived beyond this map or at no known place.</span>`
          : alive.length ? alive.map((a) => `<span role="button" tabindex="0" data-n="${esc(a.n)}" style="cursor:pointer"><i style="background:${fc(a.f)}"></i>${esc(a.n)}</span>`).join('') : '<span class="small" style="border:0;background:none">No writer on the shelf alive in this year</span>';
        rib.querySelectorAll('[data-n]').forEach((s) => { const go = () => TG._open && TG._open(s.dataset.n); s.addEventListener('click', go); s.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); }); }); }
    }
    M.onfit = () => { cv.size(); render(year); };
    TG.chapter('#tg-east', 5200, (p, fin) => render(fin ? Y1 : lerp(Y0, Y1, p)), { scrub: 0.4 });
  })();

  /* ---------- 4. Severus at Antioch: the 125 homilies, each filled when the fascicle that prints it appears ---------- */
  (function severus() {
    const S = D.sev, host = document.getElementById('tg-hom'), wrap = host.parentElement, tip = wrap.querySelector('.tip'), say = document.getElementById('tg-hom-say');
    const groups = []; S.pubs.forEach((p, i) => { const g = groups[groups.length - 1]; if (g && g.k === p.k && g.f === p.f) { g.p.push(i); g.a = Math.min(g.a, p.a); g.b = Math.max(g.b, p.b); g.pp += p.p; } else groups.push({ k: p.k, f: p.f, c: p.c, y: p.y, p: [i], a: p.a, b: p.b, pp: p.p }); });
    const gOf = S.pubs.map((p, i) => groups.findIndex((g) => g.p.includes(i)));
    const LN = { syc: 'Syriac', grc: 'Greek', cop: 'Coptic' };
    const label = (g) => { const head = g.a === g.b ? `Homily ${g.a}` : `Homilies ${g.a}–${g.b}`, other = {};
      g.p.filter((i) => S.pubs[i].l !== 'syc').forEach((i) => { (other[S.pubs[i].l] = other[S.pubs[i].l] || []).push(S.pubs[i].a); });
      const ks = Object.keys(other); if (!ks.length) return head;
      if (g.a === g.b) return `${head}, in Syriac and in ${LN[ks[0]]}`;
      return `${head} (${ks.map((l) => `${other[l].join(' and ')} in ${LN[l]}`).join('; ')})`; };
    const chron = TG.chronicle(document.getElementById('tg-pubs'), groups.map((g, i) => [i, g]), ([, g]) => `<li><span class="d">${esc(g.c)}${g.f ? `.${esc(g.f)}` : ''}</span><span class="e">${esc(label(g))}</span><span class="w">${fmt(g.pp)} pages${g.y ? `, ${g.y}` : ''}</span></li>`);
    // a homily takes the color of the first text of it printed; a second text in another language is marked in its corner
    const cells = S.h.map((h) => { const first = h.i[0], P0 = S.pubs[first], other = h.i.slice(1).find((i) => S.pubs[i].l !== P0.l);
      const a = document.createElement('a'); a.href = TG.read(P0.s, h.pg[String(first)]); a.target = '_blank'; a.rel = 'noopener'; a.setAttribute('role', 'listitem');
      a.setAttribute('aria-label', `Homily ${h.n}${h.sj ? `: ${h.sj.toLowerCase()}` : ''}, ${P0.c}, ${LN[P0.l]}`);
      a.innerHTML = `${h.n}${other != null ? `<s class="${S.pubs[other].l}"></s>` : ''}`; host.appendChild(a);
      a.addEventListener('mousemove', (e) => tipAt(tip, wrap, e, `Homily ${h.n}${h.sj ? `<small style="font-variant-caps:all-small-caps;letter-spacing:0.02em">${esc(h.sj)}</small>` : ''}<small>${h.i.map((i) => `${esc(S.pubs[i].c)}, fasc. ${esc(S.pubs[i].f)} · ${LN[S.pubs[i].l]}`).join('<br>')}</small>`));
      a.addEventListener('mouseleave', () => { tip.hidden = true; });
      return { a, h, g: gOf[first], g2: other != null ? gOf[other] : -1, col: fc(P0.l) }; });
    const byLang = (l) => S.h.filter((h) => S.pubs[h.i[0]].l === l).map((h) => h.n);
    const odd = ['cop', 'grc'].map((l) => [l, byLang(l)]).filter(([, n]) => n.length), both = S.h.filter((h) => h.i.length > 1 && new Set(h.i.map((i) => S.pubs[i].l)).size > 1).map((h) => h.n);
    const fin = `All ${S.h.length} homilies, in ${groups.length} parts from ${groups[0].c} to ${groups[groups.length - 1].c}: ${fmt(S.p)} pages. ${odd.map(([l, n], j) => `${j ? (n.length > 1 ? 'homilies' : 'homily') : (n.length > 1 ? 'Homilies' : 'Homily')} ${n.join(' and ')} ${n.length > 1 ? 'are' : 'is'} printed in ${LN[l]}`).join('; ')}${both.length ? `; homily ${both.join(', ')} in Syriac and in Greek` : ''}.`;
    document.getElementById('tg-hom-lgd').innerHTML = `${['syc', 'grc', 'cop'].filter((l) => S.pubs.some((p) => p.l === l)).map((l) => `<span><i style="background:${fc(l)}"></i>${LN[l]}</span>`).join('')}<span>A corner mark: a second text in another language</span>`;
    let last = -2;
    function render(p, end) {
      const k = end ? groups.length + 1 : p * (groups.length + 0.4), now = Math.min(groups.length - 1, Math.floor(k));
      cells.forEach((c) => { const u = clamp(k - c.g, 0, 1), on = u > 0;
        c.a.style.background = on ? c.col : ''; c.a.style.color = on ? '#fff' : TG.css('--muted');
        c.a.style.opacity = on ? (0.35 + 0.65 * ease(u)).toFixed(2) : 1;
        c.a.style.transform = on && u < 1 ? `translateY(${(-9 * (1 - ease(u))).toFixed(1)}px)` : ''; // each homily sinks into its place
        c.a.classList.toggle('cur', !end && k < groups.length && c.g === now && on);
        const s = c.a.querySelector('s'); if (s) s.style.opacity = c.g2 >= 0 && k - c.g2 > 0.5 ? 1 : 0; });
      chron(end ? groups.length : now);
      if (now !== last || end) { last = now; const g = groups[Math.max(0, now)];
        say.textContent = end || k >= groups.length ? fin : k < 0.02 ? 'The homilies, by number, before the series printed any of them.' : `${g.c}, fascicle ${g.f}${g.y ? `, ${g.y}` : ''}: ${label(g)}, ${fmt(g.pp)} pages.`; }
    }
    TG.chapter('#tg-sev', 3600, (p, fin2) => render(fin2 ? 1 : p, fin2 || p >= 0.999), { scrub: 0.5 });
  })();

  /* ---------- 5. three books of the saints: the months of each year as a wheel, each volume drawn over its months in the order printed ---------- */
  (function saints() {
    const host = document.getElementById('tg-wheels'), svg = host.querySelector('svg'), tip = host.querySelector('.tip'), nowEl = document.getElementById('tg-nowvol');
    const C3 = D.cal, ORD = D.tomes.map((t) => t.k), all = [];
    C3.forEach((c, ci) => c.vols.forEach((v, vi) => all.push({ c, ci, v, vi })));
    all.sort((a, b) => ORD.indexOf(a.v.k) - ORD.indexOf(b.v.k) || (a.v.f || 0) - (b.v.f || 0) || a.ci - b.ci);
    // a year of twelve months of thirty days and five days more
    const DAYS = 365, ang = (d) => -Math.PI / 2 + (d / DAYS) * Math.PI * 2, m0 = (m) => m * 30, m1 = (m) => (m < 12 ? m * 30 + 30 : 365);
    const arcD = (r, a0, a1) => `M${(Math.cos(a0) * r).toFixed(2)},${(Math.sin(a0) * r).toFixed(2)} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${(Math.cos(a1) * r).toFixed(2)},${(Math.sin(a1) * r).toFixed(2)}`;
    let L = null, wide = null, lastNow = '';
    const cals10 = document.getElementById('tg-cals10');
    cals10.innerHTML = `Tome 10 also prints three calendars of the feasts: ${D.cals10.map(([s, t, a]) => `<a href="${TG.read(s)}" target="_blank" rel="noopener">${esc(t)}</a> by ${esc(a)}`).join('; ')}.`;
    function build() {
      wide = host.clientWidth >= 640; svg.innerHTML = '';
      const R = 140, r = 100, cx = wide ? [210, 640, 1070] : [215, 215, 215], cy = wide ? [228, 228, 228] : [225, 700, 1175];
      svg.setAttribute('viewBox', wide ? '0 0 1280 456' : '0 0 430 1400');
      L = C3.map((c, ci) => {
        const g = mk('g', { transform: `translate(${cx[ci]} ${cy[ci]})` }, svg), rm = (R + r) / 2;
        mk('circle', { r: rm, class: 'base', 'stroke-width': R - r }, g);
        const gv = mk('g', {}, g), gm = mk('g', {}, g), gl = mk('g', {}, g);
        c.months.forEach((name, m) => { const a = ang(m0(m)); mk('line', { x1: (Math.cos(a) * (r - 1)).toFixed(1), y1: (Math.sin(a) * (r - 1)).toFixed(1), x2: (Math.cos(a) * (R + 1)).toFixed(1), y2: (Math.sin(a) * (R + 1)).toFixed(1), class: 'ms' }, gm);
          const am = ang((m0(m) + m1(m)) / 2), lx = Math.cos(am) * (R + 10), ly = Math.sin(am) * (R + 10), anc = Math.abs(Math.cos(am)) < 0.2 ? 'middle' : Math.cos(am) > 0 ? 'start' : 'end';
          mk('text', { x: lx.toFixed(1), y: (ly + 3.5 + (Math.sin(am) > 0.85 ? 6 : Math.sin(am) < -0.85 ? -3 : 0)).toFixed(1), class: 'mn', 'text-anchor': anc }, gm).textContent = name; });
        const nm = c.name.replace(/^The /, '').split(/ (?=of )/);
        nm.forEach((t, j) => { mk('text', { x: 0, y: -26 + j * 19 + (nm.length === 1 ? 10 : 0), class: 'cn' }, g).textContent = t; });
        const sub = mk('text', { x: 0, y: 24, class: 'cs' }, g), sub2 = mk('text', { x: 0, y: 40, class: 'cs' }, g);
        const vols = c.vols.map((v, vi) => {
          const parts = c.vols.filter((x) => x.m.join() === v.m.join()), pi = parts.indexOf(v), d0 = m0(v.m[0]), d1 = m1(v.m[v.m.length - 1]);
          const s0 = d0 + ((d1 - d0) * pi) / parts.length, s1 = d0 + ((d1 - d0) * (pi + 1)) / parts.length, a0 = ang(s0) + 0.004, a1 = ang(s1) - 0.004;
          const path = mk('path', { d: arcD(rm, a0, a1), class: 'vol', stroke: fc(c.f), 'stroke-width': R - r - 2, 'stroke-opacity': vi % 2 ? 0.74 : 1 }, gv), len = rm * (a1 - a0);
          path.style.strokeDasharray = `${len} ${len}`;
          // its tome, in the middle of its first month (a volume of two or three months would otherwise put it on a month's edge)
          const am = v.m.length > 1 && parts.length === 1 ? ang(d0 + 15) : (a0 + a1) / 2, lab = mk('text', { x: (Math.cos(am) * rm).toFixed(1), y: (Math.sin(am) * rm + 4).toFixed(1), class: 'vt', 'text-anchor': 'middle' }, gl);
          lab.textContent = len > 30 ? v.c.replace('PO ', '') : '';
          path.addEventListener('mousemove', (e) => tipAt(tip, host, e, `${esc(v.t)}<small>${esc(c.name)} · ${esc(v.c)}${v.f ? `, fasc. ${v.f}` : ''}${v.y ? ` · ${v.y}` : ''} · ${fmt(v.p)} pages</small>`));
          path.addEventListener('mouseleave', () => { tip.hidden = true; });
          path.addEventListener('click', () => window.open(TG.read(v.s), '_blank', 'noopener'));
          return { path, lab, len };
        });
        return { c, vols, sub, sub2 };
      });
    }
    let lastP = 0;
    function render(p, end) {
      lastP = p; const k = end ? all.length + 1 : p * (all.length + 0.5), drawn = C3.map(() => [0, 0]);
      all.forEach((o, j) => { const u = ease(clamp(k - j, 0, 1)), V = L[o.ci].vols[o.vi];
        V.path.style.strokeDashoffset = (V.len * (1 - u)).toFixed(2); V.path.style.opacity = u > 0 ? 1 : 0; V.lab.style.opacity = u > 0.85 ? 1 : 0;
        if (u > 0.5) { drawn[o.ci][0]++; drawn[o.ci][1] += o.v.p; } });
      L.forEach((w, ci) => { const [n, pp] = drawn[ci], { c } = w; w.sub.textContent = `${n} of ${c.n} volumes`; w.sub2.textContent = n ? `${fmt(pp)} pages` : ''; });
      const cur = all[Math.min(all.length - 1, Math.max(0, Math.floor(k)))], first = all[0].v, lastV = all[all.length - 1].v;
      const html = end || k >= all.length ? `<b>${all.length} volumes, from ${esc(first.c)} to ${esc(lastV.c)}</b>${C3.map((c) => `${esc(c.name)}: ${c.n} volumes, ${fmt(c.p)} pages`).join('<br>')}`
        : k < 0.02 ? '<b>The months of each year</b>Each volume is drawn over the months it covers. The volumes appear in the order the series printed them.'
          : `<b>${esc(cur.v.c)}${cur.v.y ? ` · ${cur.v.y}` : /^\d+$/.test(cur.v.k) && Number(cur.v.k) <= 22 ? ' · 1904–1930' : ''}</b>${esc(cur.c.name)}: ${esc(cur.v.t.replace(/^.*?:\s*/, ''))}, ${fmt(cur.v.p)} pages`;
      if (html !== lastNow) { lastNow = html; nowEl.innerHTML = html; }
    }
    build();
    TG.chapter('#tg-saints', 3800, (p, fin) => render(fin ? 1 : p, fin || p >= 0.999), { scrub: 0.5 });
    let rt; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if ((host.clientWidth >= 640) !== wide) { build(); render(lastP, !TG.pinOK() || lastP >= 0.999); } }, 150); }).observe(host);
  })();

  /* ---------- explore ---------- */
  TG.explorer(document.getElementById('tg-explorer'), D, { range: [0, 1700], first: 'Severus of Antioch', placeholder: 'Severus, Ephrem, synaxarium, Gospels…', label: 'Lifelines of the writers on the Eastern Fathers shelf' });
  TG.reveal('.tg .reveal');
})();
