/* The Councils guide (Mansi): the shelf assembling, where the Church met, the anatomy of a page, and the tools under them. */
(async () => {
  const PIN = () => { const r = document.querySelector('.tfr-rail'); return r && /sticky|fixed/.test(getComputedStyle(r).position) ? r.offsetHeight : 0; };
  // a scene taller than the room under the site's bars is pinned by its foot, so its last lines stay on the screen (10-11, as in the engine)
  const foot = (sel) => { const el = document.querySelector(sel); return el && el.offsetHeight > innerHeight - PIN() + 2 ? 'bottom bottom' : `top top+=${PIN()}`; };
  // MereO (Ian, 2026-10-12): each pinned scene is fitted under the bars by the engine, as the other guides' chapters are
  const fitIn = (sel) => { if (window.TG && TG.fitScene) TG.fitScene(document.querySelector(sel)); return sel; };
  const ROOT = document.querySelector('[data-guide-root]') || document.querySelector('.tg-cou');
  const load = (n) => { const el = document.getElementById(`tg-${n}`); return el ? Promise.resolve(JSON.parse(el.textContent)) : fetch(ROOT.dataset[n]).then((r) => r.json()); };
  const IDX = await load('data');
  if (window.TG && TG.linkify && IDX.lk) TG.linkify(ROOT, IDX.lk); // every person and work it names opens its room
  const D = { generated: IDX.generated, tomes: IDX.tomes, people: IDX.people, ecumenical: IDX.ecumenical, sites: IDX.sites,
    councils: IDX.councils.map((c) => [c.t, c.v, c.p, c.y]), site_councils: IDX.councils.filter((c) => c.pl && IDX.sites[c.pl]).map((c) => [c.y, c.pl]) };
  const LANDGEO = await load('land');
  const READ = (slug, p) => `${ROOT.dataset.base ?? 'https://mereorthodoxy.com'}/the-faith-received/read/?w=${encodeURIComponent(slug)}#b${p}-0`;
  const ROM = (n) => { let s = ''; for (const [v, r] of [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']]) while (n >= v) { s += r; n -= v; } return s; };
  const num = (v) => parseInt(v, 10);
  const tomeName = (v) => { const n = num(v), suf = v.replace(/^\d+/, ''); return suf === '-suppl' ? `Suppl. ${ROM(n)}` : suf === '-18' ? `${ROM(n)}–XVIII` : suf ? `${ROM(n)}.${suf.slice(1)}` : ROM(n); };
  const T = Object.fromEntries(D.tomes.map((t) => [t.v, t]));
  const css = (n) => getComputedStyle(ROOT).getPropertyValue(n).trim();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const C = D.councils.map(([t, v, p, y]) => ({ t, v, p, y }));
  const pages = D.tomes.reduce((a, t) => a + (t.pages || 0), 0);
  document.getElementById('facts').innerHTML = [[D.tomes.length, 'volumes'], [C.length.toLocaleString('en-US'), 'councils dated'], [`${Math.min(...C.map((c) => c.y))}–${Math.max(...C.map((c) => c.y))}`, 'years'], [pages.toLocaleString('en-US'), 'pages']]
    .map(([b, s]) => `<li><b>${b}</b><span>${s}</span></li>`).join('');
  if (window.gsap && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
  const canPin = !!(window.gsap && window.ScrollTrigger) && !reduce && innerWidth > 860;
  const canPlay = !canPin && !!(window.TG && TG.autoplay && TG.plays && TG.plays()); // phones: no pin, but each scene plays when it comes into view

  // ---------- hero: the councils rain into a skyline (gilt on night) ----------
  (function rain() {
    const cv = document.getElementById('rain'), ctx = cv.getContext('2d'); let W, H, dots, t0;
    function setup() { const dpr = devicePixelRatio || 1; W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const bw = 10, buckets = {}; C.forEach((c) => { const k = Math.floor((c.y - 30) / bw); (buckets[k] ||= []).push(c); });
      const max = Math.max(...Object.values(buckets).map((a) => a.length)), pitch = Math.min(4, (H * 0.5) / max), x = (y) => W * 0.04 + (y - 30) / 1850 * W * 0.92;
      dots = []; for (const k in buckets) buckets[k].forEach((c, i) => dots.push({ x: x(30 + (+k + 0.5) * bw), y: H - 18 - i * pitch, d: Math.random(), e: false }));
      D.ecumenical.forEach((e) => dots.push({ x: x(e.y), y: H - 18 - (buckets[Math.floor((e.y - 30) / bw)] || []).length * pitch - 10, d: Math.random(), e: true }));
      t0 = performance.now(); }
    function frame(now) { const t = reduce ? 1 : Math.min(1, (now - t0) / 3200); ctx.clearRect(0, 0, W, H); const gilt = css('--gilt'), rub = css('--rubric');
      for (const p of dots) { const delay = (p.x / W) * 0.5, u = Math.max(0, Math.min(1, (t - delay) / 0.5)), e = 1 - (1 - u)**3; if (u <= 0) continue;
        const y = p.y * e - (1 - e) * (40 + 200 * p.d); ctx.globalAlpha = p.e ? 1 : 0.55; ctx.fillStyle = p.e ? rub : gilt;
        if (p.e) { ctx.save(); ctx.translate(p.x, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-3, -3, 6, 6); ctx.restore(); } else { ctx.beginPath(); ctx.arc(p.x, y, 1.3, 0, 6.28); ctx.fill(); } }
      ctx.globalAlpha = 1; if (t < 1) requestAnimationFrame(frame); }
    setup(); requestAnimationFrame(frame); let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { setup(); requestAnimationFrame(frame); }, 200); });
  })();

  // ---------- chapter one: the shelf assembles in printing order ----------
  const shelf = document.getElementById('shelf'), maxP = Math.max(...D.tomes.map((t) => t.pages || 0));
  const orig = (t) => !/suppl/.test(t.v) && num(t.v) <= 31;
  const order = D.tomes.slice().sort((a, b) => (orig(a) ? 0 : 1) - (orig(b) ? 0 : 1) || num(a.v) - num(b.v) || a.v.localeCompare(b.v));
  const spines = order.map((t, i) => { const a = document.createElement(t.live ? 'a' : 'span'); a.className = `spine${orig(t) ? '' : ' paris'}`;
    a.style.height = `${150 + 150 * ((t.pages || maxP * 0.7) / maxP)}px`; a.style.background = `var(--leather-${(num(t.v) % 3) + 1})`;
    if (t.live) { a.href = READ(t.slug, 1); a.target = '_blank'; a.rel = 'noopener'; }
    a.title = `${t.label}${t.pages ? `, ${t.pages} pages` : ''}`; a.setAttribute('aria-label', a.title);
    a.innerHTML = `<span class="t"><b>${tomeName(t.v)}</b>${t.y0 ? ` · ${t.y0}–${t.y1}` : ''}</span>`; shelf.appendChild(a); return a; });
  const nOrig = order.filter(orig).length;
  document.getElementById('shelfKey').textContent = `${D.tomes.filter((t) => t.live).length} of ${D.tomes.length} volumes are in the library. Open any spine to read it beside its scan.`;
  function shelfAt(p) { // p 0..1 → how many spines stand
    const n = Math.round(p * spines.length); spines.forEach((s, i) => { s.style.opacity = i < n ? 1 : 0; s.style.transform = i < n ? 'none' : 'translateY(40px)'; });
    document.getElementById('shelfN').textContent = n;
    const paris = n > nOrig; document.getElementById('phaseName').textContent = paris ? 'Paris, 1901–1927' : 'Florence and Venice, 1757–1798';
    document.getElementById('phaseNote').textContent = paris ? 'The reprint, its supplements and the continuation to the First Vatican Council' : `The original edition: the councils to Florence (${n} of ${nOrig} tomes)`;
  }
  if (canPin) { spines.forEach((s) => { s.style.transition = 'opacity .35s, transform .35s'; });
    ScrollTrigger.create({ trigger: fitIn('#s-shelf'), start: () => foot('#s-shelf'), end: '+=1600', pin: true, scrub: true, onUpdate: (st) => shelfAt(st.progress) }); shelfAt(0); }
  else if (canPlay) { spines.forEach((s) => { s.style.transition = 'opacity .35s, transform .35s'; }); TG.autoplay(document.getElementById('s-shelf'), 1600, (p, fin) => shelfAt(fin ? 1 : p), { vis: shelf, dur: 4.5 }); }
  else shelfAt(1);

  // ---------- chapter two: the map and the chronicle ----------
  const EVENTS = [
    [50, 'The Council of Jerusalem', 'The apostles decide that Gentile converts need not keep the Law of Moses (Acts 15).', ['Peter', 'James', 'Paul']],
    [325, 'Nicaea', 'Arius is condemned and the Creed of Nicaea is set down.', ['Constantine', 'Athanasius', 'Arius']],
    [381, 'Constantinople I', 'The council affirms the divinity of the Holy Spirit and completes the Creed.', ['Theodosius I', 'Gregory of Nazianzus']],
    [431, 'Ephesus', 'Mary is proclaimed Theotokos. Nestorius is deposed.', ['Cyril of Alexandria', 'Nestorius']],
    [451, 'Chalcedon', 'Christ is confessed in two natures. The Tome of Leo is received.', ['Leo the Great', 'Emperor Marcian']],
    [589, 'Toledo III', 'The Visigothic king Reccared renounces Arianism.', ['Reccared', 'Leander of Seville']],
    [787, 'Nicaea II', 'The veneration of images is restored.', ['Empress Irene', 'Tarasius']],
    [794, 'Frankfurt', "Charlemagne's synod condemns Adoptionism.", ['Charlemagne', 'Alcuin']],
    [1054, 'East and West part', 'The papal legates and Patriarch Michael Cerularius excommunicate each other.', ['Leo IX', 'Michael Cerularius']],
    [1122, 'The Concordat of Worms', "The investiture struggle of Gregory VII's reform is settled. Lateran I confirms it in 1123.", ['Gregory VII', 'Henry IV', 'Calixtus II']],
    [1215, 'Lateran IV', 'Transubstantiation is defined and yearly confession required.', ['Innocent III']],
    [1274, 'Lyon II', 'A short-lived union with the Greeks.', ['Gregory X', 'Bonaventure']],
    [1309, 'The popes at Avignon', 'The papacy resides at Avignon until 1377.', ['Clement V', 'Gregory XI']],
    [1378, 'The Western Schism', 'Rival popes sit in Rome and Avignon. From 1409 another sits at Pisa.', ['Urban VI', 'Clement VII']],
    [1414, 'Constance', 'The Schism is ended. Jan Hus is condemned and burned (1415).', ['Emperor Sigismund', 'Martin V', 'Jan Hus']],
    [1439, 'Florence', 'Union with the Greeks is proclaimed. It does not last.', ['Eugenius IV', 'John VIII Palaiologos', 'Bessarion']],
    [1517, 'Lateran V closes', 'In the same year Luther posts his theses.', ['Leo X', 'Martin Luther']],
    [1545, 'Trent', 'Decrees on Scripture and tradition, justification and the sacraments. The council sits until 1563.', ['Paul III', 'Pius IV', 'Charles Borromeo']],
    [1869, 'Vatican I', 'The primacy and infallibility of the pope are defined (1870).', ['Pius IX']],
  ];
  const chron = document.getElementById('chron');
  chron.innerHTML = EVENTS.map(([y, e, w, pp]) => `<li><span class="d">${y}</span><span class="e">${esc(e)}</span><span class="w">${esc(w)}</span><span class="pp">${pp.map((p) => `<span>${esc(p)}</span>`).join('')}</span></li>`).join('');
  const lis = [...chron.children];
  const mapbox = document.getElementById('mapbox'), svg = d3.select('#land'), sc = document.getElementById('sites'), sctx = sc.getContext('2d');
  const land = { type: 'Feature', geometry: LANDGEO };
  let proj, MW, MH, RS = 1; // RS: circles scale with the map, so a phone's narrow map is not covered by them
  if (window.TG && TG.small && TG.small()) TG.declutter(sctx);
  const sites = Object.entries(D.sites).map(([k, [lat, lon]]) => ({ k, lat, lon, ys: D.site_councils.filter(([, s]) => s === k).map(([y]) => y).sort((a, b) => a - b) }));
  const LABEL = new Set(['CONSTANTINOPLE', 'ROME', 'TOLEDO', 'PARIS', 'LONDON', 'REIMS', 'ANTIOCH', 'CARTHAGE', 'MAINZ', 'TRENT', 'CONSTANCE', 'FLORENCE', 'EPHESUS', 'LYONS', 'MILAN', 'JERUSALEM', 'CANTERBURY', 'COLOGNE']);
  const title = (k) => k.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
  function mapSetup() { MW = mapbox.clientWidth; MH = mapbox.clientHeight; RS = Math.min(1, MW / 640); const dpr = devicePixelRatio || 1; sc.width = MW * dpr; sc.height = MH * dpr; sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    proj = d3.geoConicConformal().parallels([35, 55]).rotate([-14, 0]).fitExtent([[10, 10], [MW - 10, MH - 10]], { type: 'MultiPoint', coordinates: [[-10, 33], [42, 33], [-10, 58], [42, 58], [35, 31]] });
    svg.attr('viewBox', `0 0 ${MW} ${MH}`).selectAll('*').remove();
    svg.append('path').datum(land).attr('d', d3.geoPath(proj)).attr('fill', css('--land')).attr('stroke', css('--coast')).attr('stroke-width', 0.8);
    sites.forEach((s) => { const p = proj([s.lon, s.lat]); s.x = p[0]; s.y = p[1]; }); }
  let curYear = 50;
  function mapAt(year) {
    curYear = year; const rub = css('--rubric'), ink = css('--ink'), gilt = css('--gilt'), muted = css('--muted');
    sctx.clearRect(0, 0, MW, MH); let shown = 0, total = 0;
    for (const s of sites) { let n = 0, recent = 0; for (const y of s.ys) { if (y <= year) { n++; if (year - y < 40) recent++; } }
      total += n; if (!n) continue; shown++; const r = (2 + Math.sqrt(n) * 1.7) * RS;
      if (recent) { sctx.globalAlpha = 0.18; sctx.fillStyle = rub; sctx.beginPath(); sctx.arc(s.x, s.y, r + (6 + recent) * RS, 0, 6.28); sctx.fill(); }
      sctx.globalAlpha = recent ? 0.95 : 0.55; sctx.fillStyle = recent ? rub : ink; sctx.beginPath(); sctx.arc(s.x, s.y, r, 0, 6.28); sctx.fill();
      if (LABEL.has(s.k) && (n >= 3 || recent)) { sctx.globalAlpha = 0.9; sctx.fillStyle = ink; sctx.font = `${RS < 1 ? 10.5 : 11.5}px ${css('--body')}`; sctx.fillText(title(s.k), s.x + r + 3, s.y + 4); } }
    sctx.globalAlpha = 1;
    document.getElementById('year').textContent = Math.round(year);
    document.getElementById('yearbar').style.width = `${(year - 50) / (1902 - 50) * 100}%`;
    let now = -1; EVENTS.forEach(([y], i) => { if (y <= year) now = i; });
    lis.forEach((li, i) => { li.classList.toggle('now', i === now); li.classList.toggle('past', i < now); });
    if (now >= 0 && canPin) { const li = lis[now]; chron.scrollTop = Math.max(0, li.offsetTop - chron.clientHeight * 0.35); }
    const P = D.people.filter((p) => p.y0 - 15 <= year && year <= p.y1 + 15).slice(0, 10);
    document.getElementById('ribbon').innerHTML = P.map((p) => `<span class="${/^Pope/.test(p.name) ? 'pope' : ''}">${esc(p.name)}</span>`).join('');
    document.getElementById('mapNote').textContent = `${total.toLocaleString('en-US')} councils at ${shown} places by ${Math.round(year)}. Larger circles held more councils. Red ones met in the last forty years.`;
  }
  mapSetup(); let mrt; new ResizeObserver(() => { clearTimeout(mrt); mrt = setTimeout(() => { mapSetup(); mapAt(curYear); }, 120); }).observe(mapbox);
  if (canPin) ScrollTrigger.create({ trigger: fitIn('#s-map'), start: () => foot('#s-map'), end: '+=3600', pin: true, scrub: 0.5, onUpdate: (st) => mapAt(50 + st.progress * 1852) });
  if (canPlay) TG.autoplay(document.getElementById('s-map'), 3600, (p, fin) => mapAt(fin ? 1902 : 50 + p * 1852), { vis: mapbox, dur: 8 });
  else mapAt(canPin ? 50 : 1902);

  // ---------- chapter three: the anatomy of a page ----------
  const STEPS = [
    ['Two columns to a page', 'Mansi numbers columns rather than pages. The running head here shows columns 197 and 198 of tome VI.', [[6.3, 3.3, 6.4, 2.6], [75.8, 3.5, 5.8, 2.8]]],
    ['Letters in the gutter', 'Letters A to E printed between the columns divide each column. “Mansi 6:197A” is the top of the left column.', [[43.4, 3.5, 3, 2.5], [42.8, 19.7, 3, 2.5], [43.4, 31.8, 3, 2.5], [44.8, 58, 3, 2.5]]],
    ['The margins', 'Mansi’s side notes summarize and point. One reads “Attende auctoritatem Summi Pontificis”: mark the authority of the supreme pontiff.', [[0, 4.7, 7.6, 4.6], [0, 29.5, 7.6, 4], [80.5, 20.7, 8.8, 5], [80.5, 60.3, 8.8, 6.4]]],
    ['A document begins', 'In Letter 106 Leo the Great rebukes Anatolius for his ambition after Chalcedon. Anatolius was bishop of Constantinople. The letter comes with a synopsis of its six points.', [[17, 37, 55, 7], [6.4, 44.8, 68.6, 10]]],
    ['Greek beside Latin', 'Where both survive, the Greek and the Latin stand side by side and line by line.', [[6.4, 54.6, 38.6, 10.2], [45.4, 55.4, 35, 9.4]]],
    ['The editors’ notes', 'The notes below come from the Ballerini brothers’ edition of Leo. They give the readings of the manuscripts.', [[0, 67.4, 82, 24]]],
  ];
  const stepsEl = document.getElementById('steps'), page = document.getElementById('page');
  stepsEl.innerHTML = STEPS.map(([b, p]) => `<li><b>${esc(b)}</b><p>${esc(p)}</p></li>`).join('');
  const boxes = STEPS.map(([, , rects]) => rects.map(([x, y, w, h]) => { const d = document.createElement('div'); d.className = 'hl'; Object.assign(d.style, { left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` }); page.appendChild(d); return d; }));
  const stepLis = [...stepsEl.children];
  function stepAt(i) { stepLis.forEach((li, j) => li.classList.toggle('now', j === i)); boxes.forEach((bs, j) => bs.forEach((b) => { if (window.gsap) gsap.to(b, { opacity: j === i ? 1 : 0, duration: reduce ? 0 : 0.35 }); else b.style.opacity = j === i ? 1 : 0; })); }
  if (canPin) ScrollTrigger.create({ trigger: fitIn('#s-page'), start: () => foot('#s-page'), end: '+=2400', pin: true, scrub: true, onUpdate: (st) => stepAt(Math.min(STEPS.length - 1, Math.floor(st.progress * STEPS.length))) });
  const allSteps = () => { stepLis.forEach((li) => li.classList.add('now')); boxes.flat().forEach((b) => { b.style.opacity = 1; }); };
  if (!canPin && canPlay) TG.autoplay(document.getElementById('s-page'), 2400, (p, fin) => (fin ? allSteps() : stepAt(Math.min(STEPS.length - 1, Math.floor(p * STEPS.length)))), { vis: page, dur: 7 });
  else if (!canPin) allSteps();
  if (canPin) stepAt(0);

  // ---------- people ----------
  let pYear = 9999, pPlayed = false, pParts = null;
  function people() { const s = document.getElementById('people'), P = D.people.slice().sort((a, b) => a.y0 - b.y0), w = Math.max(640, s.parentElement.clientWidth), y0 = 420, y1 = 1560, sx = (y) => 8 + (y - y0) / (y1 - y0) * (w - 16), rows = [];
    const placed = P.map((p) => { const x0 = sx(p.y0), x1 = Math.max(sx(p.y1), x0 + 6), lw = p.name.length * 6.6 + 10, left = x0 > w - 150 ? x1 - lw : x0; let row = 0; while (rows[row] !== undefined && rows[row] > left - 4) row++; rows[row] = Math.max(x1, left + lw); return { p, x0, x1, row }; });
    const h = rows.length * 22 + 34, rub = css('--rubric'), ink = css('--ink'), muted = css('--muted'), rule = css('--rule'); s.setAttribute('viewBox', `0 0 ${w} ${h}`); s.setAttribute('width', w); s.setAttribute('height', h);
    let o = ''; for (let y = 500; y <= 1500; y += 100) { const x = sx(y); o += `<line x1="${x}" x2="${x}" y1="0" y2="${h - 22}" stroke="${rule}"/><text x="${x}" y="${h - 6}" fill="${muted}" font-size="11" text-anchor="middle">${y}</text>`; }
    for (const { p, x0, x1, row } of placed) { const y = row * 22 + 8, pope = /^Pope/.test(p.name), col = pope ? rub : ink, right = x0 > w - 150;
      o += `<g class="pp"><title>${esc(p.name)}: named in ${p.n} headings, ${p.y0}–${p.y1}</title><rect x="${x0}" y="${y}" width="${x1 - x0}" height="6" rx="3" fill="${col}" opacity="${pope ? 0.9 : 0.7}"/><text x="${right ? x1 : x0}" text-anchor="${right ? 'end' : 'start'}" y="${y + 17}" fill="${col}" font-size="11.5">${esc(p.name)}</text></g>`; }
    o += `<g class="cursor" opacity="0"><line y1="0" y2="${h - 22}" stroke="${rub}" stroke-width="1.5"/><text y="${h - 28}" fill="${rub}" font-size="12.5" font-weight="600" text-anchor="start" stroke="${css('--paper') || '#f6f1e7'}" stroke-width="3" paint-order="stroke"></text></g>`;
    s.innerHTML = o;
    pParts = { gs: [...s.querySelectorAll('g.pp')], placed, sx, cur: s.querySelector('g.cursor') };
    peopleAt(pYear); }
  function peopleAt(Y) { // Y: the year the sweep has reached; past the end, every span stands whole
    pYear = Y; if (!pParts) return; const { gs, placed, sx, cur } = pParts, end = Y >= 1560;
    placed.forEach(({ p, x0, x1 }, i) => { const g = gs[i], r = g.firstElementChild.nextElementSibling, on = end || Y >= p.y0;
      g.style.opacity = on ? 1 : 0; r.setAttribute('width', Math.max(0.5, end ? x1 - x0 : Math.min(x1, Math.max(x0, sx(Y))) - x0)); });
    cur.setAttribute('opacity', end ? 0 : 1); const x = sx(Math.min(Y, 1560)); cur.firstElementChild.setAttribute('x1', x); cur.firstElementChild.setAttribute('x2', x);
    cur.lastElementChild.setAttribute('x', x + 5); cur.lastElementChild.textContent = Math.round(Y); }
  people(); addEventListener('resize', () => people());
  if (window.gsap && !reduce && 'IntersectionObserver' in window) {
    const box = document.getElementById('people'), st = { y: 420 };
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'tg-replay'; btn.textContent = 'Play again'; btn.hidden = true;
    box.parentElement.insertAdjacentElement('afterend', btn);
    const play = () => { btn.hidden = true; st.y = 420; peopleAt(420); gsap.to(st, { y: 1560, duration: 6, ease: 'none', onUpdate: () => peopleAt(st.y), onComplete() { peopleAt(9999); btn.hidden = false; } }); };
    btn.addEventListener('click', play);
    peopleAt(420);
    const io = new IntersectionObserver((es) => { const e = es[es.length - 1], h = Math.min(e.boundingClientRect.height, innerHeight); // half of what the screen can show of it, by height
      if (!pPlayed && h > 0 && e.intersectionRect.height / h >= 0.5) { pPlayed = true; io.disconnect(); play(); } }, { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] });
    io.observe(box);
  }
  const redraw = () => { people(); mapSetup(); mapAt(curYear); };
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redraw);
  new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // ======== the selection tools: search, and the councils by council, by tome, by place, by century ========
  {
  const D = IDX;

  const READ = (slug, p) => `${ROOT.dataset.base ?? 'https://mereorthodoxy.com'}/the-faith-received/read/?w=${encodeURIComponent(slug)}#b${p}-0`;
  const ROM = (n) => { let s = ''; for (const [v, r] of [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']]) while (n >= v) { s += r; n -= v; } return s; };
  const num = (v) => parseInt(v, 10);
  const tomeName = (v) => { const n = num(v), suf = v.replace(/^\d+/, ''); return suf === '-suppl' ? `Suppl. ${ROM(n)}` : suf === '-18' ? `${ROM(n)}–XVIII` : suf ? `${ROM(n)}.${suf.slice(1)}` : ROM(n); };
  const T = Object.fromEntries(D.tomes.map((t) => [t.v, t])), css = (n) => getComputedStyle(ROOT).getPropertyValue(n).trim();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const title = (k) => k.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
  const C = D.councils.filter((c) => T[c.v]).sort((a, b) => (a.y || 9999) - (b.y || 9999));
  const yr = (c) => (c.ya ? 'c. ' : '') + c.y;
  const ref = (c) => `Tome ${tomeName(c.v)}${c.c ? `, col. ${c.c}` : `, p. ${c.p}`}`;
  const G = window.gsap && !reduce ? window.gsap : null, clamp = (u) => Math.max(0, Math.min(1, u));
  const outC = (u) => 1 - (1 - u)**3, inOut = (u) => u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2)**3 / 2, outBack = (u) => 1 + 2.2 * (u - 1)**3 + 1.2 * (u - 1)**2;
  if (G && window.ScrollTrigger) G.registerPlugin(ScrollTrigger);

  // tabs
  const tabs = [...document.querySelectorAll('.csh [role=tab]')], ink = document.getElementById('sh-tabink'); let cur = null;
  function moveInk(instant) { const btn = tabs.find((t) => t.getAttribute('aria-selected') === 'true'); if (!btn) return; const x = btn.offsetLeft, w = btn.offsetWidth, y = btn.offsetTop + btn.offsetHeight - ink.parentElement.offsetHeight;
    if (G && !instant) G.to(ink, { x, y, width: w, duration: 0.5, ease: 'power3.out' }); else if (window.gsap) gsap.set(ink, { x, y, width: w }); else Object.assign(ink.style, { transform: `translate(${x}px,${y}px)`, width: `${w}px` }); }
  const firstShow = {};
  function show(id, instant) { if (id === cur) return; cur = id; let pane;
    tabs.forEach((t) => { const on = t.id === `sh-t-${id}`, el = document.getElementById(t.getAttribute('aria-controls')); t.setAttribute('aria-selected', on); el.hidden = !on; if (on) pane = el; });
    moveInk(instant); if (G && !instant) G.fromTo(pane, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out', clearProps: 'transform,opacity' });
    if (id === 'tome' && !firstShow.tome) { firstShow.tome = 1; if (G) G.from('#sh-shelf .spine', { scaleY: 0, transformOrigin: '50% 100%', duration: 0.6, stagger: 0.012, ease: 'power3.out', clearProps: 'transform' }); }
    if (id === 'place') mapInit(); if (id === 'century') tlInit(); if (!instant) try { history.replaceState(null, '', `#by-${id}`); } catch (e) {} }
  tabs.forEach((t) => { t.onclick = () => show(t.id.slice(5)); });
  new ResizeObserver(() => moveInk(true)).observe(ink.parentElement);

  // ---------- by council: century folds ----------
  const CENT = (y) => Math.floor((y - 1) / 100) + 1, ORD = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : (n % 10 < 4 ? n % 10 : 0)]);
  const clist = document.getElementById('sh-clist');
  function drawCouncils(q) {
    const ql = (q || '').toLowerCase(), hits = ql ? C.filter((c) => c.t.toLowerCase().includes(ql) || (c.pl && c.pl.toLowerCase().includes(ql))) : C, by = new Map();
    hits.forEach((c) => { const k = c.y ? CENT(c.y) : 0; if (!by.has(k)) by.set(k, []); by.get(k).push(c); });
    document.getElementById('sh-c-intro').textContent = ql ? `${hits.length.toLocaleString('en-US')} councils match “${q}”.` : `${C.length.toLocaleString('en-US')} councils and synods in the order of time. Each opens at its first page. The reference gives the tome and Mansi's printed column.`;
    const mark = (t) => ql ? esc(t).replace(new RegExp(ql.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), (m) => `<mark>${m}</mark>`) : esc(t);
    const spark = (k, a) => { const x = (y) => ((y - (k - 1) * 100 - 1) / 99 * 100).toFixed(2), g = D.ecumenical.filter((e) => CENT(e.y) === k);
      return `<svg class="spark" viewBox="0 0 100 18" preserveAspectRatio="none" aria-hidden="true">${a.map((c) => `<line x1="${x(c.y)}" x2="${x(c.y)}" y1="5" y2="15" vector-effect="non-scaling-stroke"/>`).join('')}${g.map((e) => `<line class="g" x1="${x(e.y)}" x2="${x(e.y)}" y1="1" y2="18" vector-effect="non-scaling-stroke"/>`).join('')}</svg>`; };
    clist.innerHTML = [...by.entries()].map(([k, a], i) => `<details class="century"${ql || i === 0 ? ' open' : ''}><summary><b>${k ? `${ORD(k)} century` : 'Undated'}</b><span>${a.length} council${a.length === 1 ? '' : 's'}</span>${k ? spark(k, a) : ''}<i aria-hidden="true">›</i></summary><ul class="clist">${
       a.map((c) => `<li><span class="y">${c.ya ? '<small style="display:inline;color:var(--muted)">c.</small>' : ''}${c.y || ''}</span><span><a href="${READ(T[c.v].slug, c.p)}" target="_blank" rel="noopener">${mark(c.t)}</a><small>${ref(c)}${c.pl ? ` · ${title(c.pl)}` : ''}</small></span></li>`).join('')}</ul></details>`).join('');
    return hits.length;
  }
  clist.addEventListener('toggle', (ev) => { const d = ev.target; if (G && d.open) G.from(d.querySelectorAll('.clist li:nth-child(-n+40)'), { opacity: 0, y: 8, duration: 0.35, stagger: 0.012, ease: 'power2.out', clearProps: 'opacity,transform' }); }, true);
  let sparkShown = false;
  function sparkIn() { if (!G) return; G.fromTo('#sh-clist .spark', { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 1.1, stagger: 0.045, ease: 'power2.inOut', clearProps: 'clipPath' }); }
  drawCouncils('');
  if (G && window.ScrollTrigger) ScrollTrigger.create({ trigger: '#sh-clist', start: 'top 85%', once: true, onEnter() { sparkShown = true; sparkIn(); } });

  // ---------- unified search: a citation opens; anything else filters the councils ----------
  function locate(n, col, suppl) { const cands = D.tomes.filter((t) => num(t.v) === n && (!!suppl === /suppl/.test(t.v)));
    for (const t of cands) { const cs = t.cols || []; if (!cs.some(Boolean)) continue; let page = 0; for (let i = 0; i < cs.length; i++) if (cs[i] && cs[i] <= col) page = i + 1;
      const first = cs.find(Boolean), last = Math.max(...cs.filter(Boolean)); if (page && col >= first && col <= last + 1) return { t, page, exact: true }; }
    const t = cands[0]; return t ? { t, page: Math.max(1, Math.min(t.pages || 1, Math.round(col / 2) + 6)), exact: false } : null; }
  function citeSvg(col, left, li) { const cx = left ? 12 : 60, lines = (x) => Array.from({ length: 15 }, (_, i) => `<line x1="${x}" x2="${x + 36 - (i % 4 === 3 ? 14 : 0)}" y1="${30 + i * 8}" y2="${30 + i * 8}"/>`).join('');
    return `<svg viewBox="0 0 108 156" aria-hidden="true"><rect x="0.5" y="0.5" width="107" height="155" rx="2" fill="none" stroke="currentColor" stroke-opacity="0.5"/>
      <text x="${12 + 18}" y="16" text-anchor="middle" font-size="9" fill="currentColor">${left ? col : col - 1}</text><text x="${60 + 18}" y="16" text-anchor="middle" font-size="9" fill="currentColor">${left ? col + 1 : col}</text>
      <rect id="sh-cite-col" x="${cx - 4}" y="22" width="44" height="124" fill="var(--gilt)" fill-opacity="0.28"/>
      <g stroke="currentColor" stroke-opacity="0.45" stroke-width="2">${lines(12)}${lines(60)}</g>
      ${'ABCDE'.split('').map((c, i) => `<text x="54" y="${36 + i * 24}" text-anchor="middle" font-size="8" fill="var(--gilt)">${c}</text>`).join('')}
      ${li >= 0 ? `<rect id="sh-cite-band" x="${cx - 4}" y="${26 + li * 24}" width="44" height="14" fill="none" stroke="var(--gilt)" stroke-width="1.5"/>` : ''}</svg>`; }
  const fq = document.getElementById('sh-fq'), fout = document.getElementById('sh-fout');
  document.getElementById('sh-finder').addEventListener('submit', (ev) => { ev.preventDefault(); const q = fq.value.trim(); fout.textContent = '';
    const m = q.match(/^(?:mansi\s*)?(\d{1,2})\s*(suppl\.?|s)?\s*[,:.]\s*(\d{1,4})\s*([A-Ea-e])?$/i);
    if (m) { const r = locate(+m[1], +m[3], m[2]); if (!r) { fout.textContent = `Tome ${ROM(+m[1])} is not in the collection.`; return; }
      const col = +m[3], L = m[4] ? m[4].toUpperCase() : '', left = col % 2 === 1, li = 'ABCDE'.indexOf(L);
      fout.innerHTML = `<span class="cite">${citeSvg(col, left, li)}<p>Tome ${tomeName(r.t.v)}, column ${col}${L ? `, at ${L}` : ''}. Column ${col} is the ${left ? 'left' : 'right'}-hand column of its page${L ? `, and ${L} marks the ${['top', 'upper part', 'middle', 'lower part', 'foot'][li]} of it` : ''}. That is ${r.exact ? '' : 'about '}page ${r.page} of the scan. <a href="${READ(r.t.slug, r.page)}" target="_blank" rel="noopener">Open it</a></p></span>`;
      if (G) { G.from('#sh-cite-col', { scaleY: 0, transformOrigin: '50% 0%', duration: 0.7, ease: 'power3.out' }); if (li >= 0) G.from('#sh-cite-band', { y: -li * 24, opacity: 0, duration: 0.7, delay: 0.45, ease: 'power3.inOut' }); G.from('.cite p', { opacity: 0, x: -8, duration: 0.5, delay: 0.2 }); }
      return; }
    show('council'); const n = drawCouncils(q);
    // the councils by name are below; the words of the text answer here, under the box
    if (n) fout.innerHTML = `<a href="#sh-p-council">${n === 1 ? 'One council' : `${n.toLocaleString('en-US')} councils`} by that name, below</a>`;
    textSearch(q); });
  fq.addEventListener('input', () => { if (!fq.value.trim()) { fout.textContent = ''; drawCouncils(''); textSearch(''); } });

  // ---------- the text of the tomes (2026-10-16, a reader: "I don't see a full-text search option on the Councils shelf") ----------
  // Every page of the 57 tomes is in the library's word index. The panel is the search page's and the author rooms' own
  // (port/word-index-search.js), each request kept to the collection's catalogue name: how many pages, which tomes, then the pages.
  const MANSI = 'The councils, collected by G. D. Mansi', WORDS = 'https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/words?r=';
  const ftext = document.getElementById('sh-text');
  const b64 = (o) => btoa(String.fromCharCode.apply(null, new TextEncoder().encode(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const wixPost = (b) => fetch(WORDS + b64({ ...b, authors: [MANSI] }), { signal: AbortSignal.timeout(90000) })
    .then((r) => r.json().then((j) => { if (!r.ok || j.error) throw Error(j.error || r.status); return j; }));
  const colPage = (p) => { const s = p == null ? '' : String(p), m = /^\d+:0*(\d+)[A-Da-d]?$/.exec(s); return m ? m[1] : (/^\d+$/.test(s) ? s.replace(/^0+(?=\d)/, '') : s); };
  const bySlug = new Map(D.tomes.map((t) => [t.slug, t]));
  function textSearch(q) {
    if (!ftext) return;
    if (!window.FRWordIndex || q.length < 2) { ftext.innerHTML = ''; ftext.hidden = true; return; }
    ftext.hidden = false;
    window.FRWordIndex.mount(ftext, { query: q, post: wixPost, scope: { label: 'the 57 tomes of Mansi' },
      readHref(w, page, hl) { const u = READ(w, page == null || page === '' ? '' : colPage(page)), i = u.indexOf('#'), h = hl ? `&hl=${encodeURIComponent(hl)}` : '';
        return page == null || page === '' ? u.slice(0, i) + h : u.slice(0, i) + h + u.slice(i); },
      // the panel groups the tomes as one work by one author; its heading is the collection's title, the tomes are its chips
      title: (w, row) => esc(bySlug.has(w) ? 'New and Most Ample Collection of the Sacred Councils' : (row && row.title) || w),
      meta(row) { const t = bySlug.get(row && row.slug); return t && t.y0 ? esc(t.y1 && t.y1 !== t.y0 ? `${t.y0}–${t.y1}` : String(t.y0)) : esc((row && row.volume) || ''); } });
  }
  // a search handed in by a link (?s=councils&q=…: the reader's "Search all 57 volumes", the shelf card) runs once the guide is drawn
  { const q0 = new URLSearchParams(location.search).get('q'); if (q0 && q0.trim()) { fq.value = q0.trim().slice(0, 200); document.getElementById('sh-finder').requestSubmit(); document.getElementById('find').scrollIntoView({ block: 'start' }); } }

  // ---------- by tome: the shelf and the outline ----------
  const shelf = document.getElementById('sh-shelf'), panel = document.getElementById('sh-tomepanel'), maxP = Math.max(...D.tomes.map((t) => t.pages || 0));
  const counts = {}; C.forEach((c) => { counts[c.v] = (counts[c.v] || 0) + 1; });
  function openTome(t, btn) { shelf.querySelectorAll('.spine').forEach((s) => s.setAttribute('aria-pressed', 'false')); if (btn) btn.setAttribute('aria-pressed', 'true');
    const ol = (D.outlines[t.v] || []).map(([d, p, ti]) => `<li class="d${d}"><a href="${READ(t.slug, p)}" target="_blank" rel="noopener">${esc(ti)}</a></li>`).join('');
    const RX = (y) => 4 + (y - 30) / 1875 * 292, a = RX(t.y0 || 30), b = Math.max(a + 2.5, RX(t.y1 || t.y0 || 30));
    const rib = `<svg class="ribbon2" viewBox="0 0 300 30" aria-label="Years ${t.y0}–${t.y1} on a line from AD 30 to 1905"><line x1="4" x2="296" y1="12" y2="12" stroke="var(--rule)" stroke-width="1"/>${[500, 1000, 1500].map((y) => `<line x1="${RX(y)}" x2="${RX(y)}" y1="9" y2="15" stroke="var(--rule)"/><text x="${RX(y)}" y="27" text-anchor="middle">${y}</text>`).join('')}<rect class="span" x="${a}" y="8" width="${b - a}" height="8" rx="1.5" fill="var(--rubric)"/><text x="${Math.min(280, Math.max(20, (a + b) / 2))}" y="5" text-anchor="middle" style="fill:var(--ink)">${t.y0 === t.y1 ? t.y0 : `${t.y0}–${t.y1}`}</text></svg>`;
    panel.innerHTML = `<h3>Tome ${tomeName(t.v)}</h3><p class="meta">${(t.pages || 0).toLocaleString('en-US')} pages · ${counts[t.v] || 0} ${counts[t.v] === 1 ? 'council' : 'councils and synods'}</p>${t.y0 ? rib : ''}<ol>${ol || '<li>Contents are being prepared.</li>'}</ol>${t.live ? `<a class="open" href="${READ(t.slug, 1)}" target="_blank" rel="noopener">Open the tome</a>` : ''}`;
    if (G && btn) { G.from(panel.children, { opacity: 0, y: 8, duration: 0.4, stagger: 0.05, ease: 'power2.out', clearProps: 'opacity,transform' }); G.from(panel.querySelector('.ribbon2 .span'), { attr: { width: 0 }, duration: 0.8, delay: 0.15, ease: 'power3.out' }); } }
  D.tomes.forEach((t) => { const b = document.createElement('button'); b.type = 'button'; b.className = `spine${t.live ? '' : ' off'}`; b.setAttribute('aria-pressed', 'false');
    b.style.height = `${130 + 120 * ((t.pages || maxP * 0.7) / maxP)}px`; b.style.background = `var(--leather-${(num(t.v) % 3) + 1})`; b.title = t.label;
    b.innerHTML = `<span class="t"><b>${tomeName(t.v)}</b>${t.y0 ? ` · ${t.y0}–${t.y1}` : ''}</span>`; b.onclick = () => openTome(t, b); shelf.appendChild(b); });
  document.getElementById('sh-shelfkey').textContent = `${D.tomes.filter((t) => t.live).length} of ${D.tomes.length} volumes are in the library.`;
  openTome(T['06'], shelf.children[D.tomes.findIndex((t) => t.v === '06')]);

  // ---------- by place: the map ----------
  let mapReady = false;
  function mapInit() { if (mapReady) return; mapReady = true;
    const box = document.getElementById('sh-mapbox'), svg = d3.select('#sh-land'), sc = document.getElementById('sh-sites'), ctx = sc.getContext('2d'), side = document.getElementById('sh-placeside');
    // rewind any land ring d3 would read inside-out (spherical area over a hemisphere), so land fills as land everywhere
    const land = LANDGEO, per = {}; C.forEach((c) => { if (c.pl && D.sites[c.pl]) (per[c.pl] ||= []).push(c); });
    const sites = Object.entries(per).map(([k, a]) => ({ k, a, lat: D.sites[k][0], lon: D.sites[k][1] })).sort((a, b) => b.a.length - a.a.length);
    let proj, W, H, sel = null, grow = G ? 0 : 1, ring = 1, raf = null, t0 = performance.now(), r0 = 0;
    function tick(now) { grow = G ? clamp((now - t0) / 1400) : 1; ring = clamp((now - r0) / 800); draw(); raf = grow < 1 || ring < 1 ? requestAnimationFrame(tick) : null; }
    const run = () => { if (!raf) raf = requestAnimationFrame(tick); };
    function list(s) { sel = s; if (s && G) { r0 = performance.now(); ring = 0; run(); } else draw();
      if (G && side.firstElementChild) G.from(side, { opacity: 0, x: 10, duration: 0.35, ease: 'power2.out', clearProps: 'opacity,transform' }); side.innerHTML = s ? `<h3>${esc(title(s.k))}</h3><p class="small">${s.a.length} council${s.a.length === 1 ? '' : 's'}</p><ul class="placelist">${s.a.map((c) => `<li><span class="y" style="color:var(--rubric);font-weight:600">${yr(c)}</span> <a href="${READ(T[c.v].slug, c.p)}" target="_blank" rel="noopener" style="color:var(--ink)">${esc(c.t)}</a> <span class="small">· ${ref(c)}</span></li>`).join('')}</ul>`
      : `<h3>Most councils</h3><ul class="placelist">${sites.slice(0, 24).map((x) => `<li><button class="chip" data-k="${x.k}">${esc(title(x.k))}</button> <span class="small">${x.a.length}</span></li>`).join('')}</ul>`;
      side.querySelectorAll('[data-k]').forEach((b) => { b.onclick = () => list(sites.find((x) => x.k === b.dataset.k)); }); }
    function setup() { W = box.clientWidth; H = box.clientHeight; const dpr = devicePixelRatio || 1; sc.width = W * dpr; sc.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      proj = d3.geoConicConformal().parallels([35, 55]).rotate([-14, 0]).fitExtent([[10, 10], [W - 10, H - 10]], { type: 'MultiPoint', coordinates: [[-10, 33], [42, 33], [-10, 58], [42, 58], [35, 31]] });
      svg.attr('viewBox', `0 0 ${W} ${H}`).selectAll('*').remove(); svg.append('path').datum(land).attr('d', d3.geoPath(proj)).attr('fill', css('--land')).attr('stroke', css('--coast')).attr('stroke-width', 0.8);
      sites.forEach((s) => { const p = proj([s.lon, s.lat]); s.x = p[0]; s.y = p[1]; s.r = 2.2 + Math.sqrt(s.a.length) * 1.6; }); draw(); }
    function draw() { ctx.clearRect(0, 0, W, H); const ink = css('--ink'), rub = css('--rubric'), n = sites.length, boxes = [];
      ctx.font = `11.5px ${css('--body')}`; const free = (x, y, w) => { const b = [x - 2, y - 11, x + w + 2, y + 4]; if (boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) return false; boxes.push(b); return true; };
      if (sel) free(sel.x + sel.r + 3, sel.y + 4, ctx.measureText(title(sel.k)).width);
      for (let i = 0; i < n; i++) { const s = sites[i], on = sel && sel.k === s.k, f = clamp((grow - (i / n) * 0.55) / 0.45); if (f <= 0) continue; const r = s.r * outBack(f);
        ctx.globalAlpha = on ? 1 : 0.55; ctx.fillStyle = on ? rub : ink; ctx.beginPath(); ctx.arc(s.x, s.y, Math.max(0, r), 0, 6.28); ctx.fill();
        if (on && ring < 1) { ctx.globalAlpha = 1 - ring; ctx.strokeStyle = rub; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s.x, s.y, s.r + 4 + 22 * outC(ring), 0, 6.28); ctx.stroke(); ctx.lineWidth = 1; }
        const lab = title(s.k); if ((s.a.length >= 14 || on) && f >= 1 && (on || free(s.x + s.r + 3, s.y + 4, ctx.measureText(lab).width))) { ctx.globalAlpha = 0.9; ctx.fillStyle = on ? rub : ink; ctx.fillText(lab, s.x + s.r + 3, s.y + 4); } } ctx.globalAlpha = 1; }
    sc.addEventListener('click', (ev) => { const b = sc.getBoundingClientRect(), mx = ev.clientX - b.left, my = ev.clientY - b.top; let best = null, bd = 1e9;
      for (const s of sites) { const d = Math.hypot(s.x - mx, s.y - my) - s.r; if (d < bd) { bd = d; best = s; } } if (best && bd < 8) list(best); });
    sc.style.cursor = 'pointer'; setup(); list(null); t0 = performance.now(); run(); new ResizeObserver(() => setup()).observe(box); }

  // ---------- by century: the skyline explorer ----------
  let tlReady = false;
  function tlInit() { if (tlReady) return; tlReady = true;
    const ERAS = [['All', 30, 1905], ['To Gregory the Great', 30, 610], ['Early Middle Ages', 600, 1050], ['Reform and the Lateran', 1040, 1300], ['Councils of union', 1290, 1450], ['Trent and after', 1440, 1905]];
    const eraBox = document.getElementById('sh-eras'); let range = [30, 1905];
    ERAS.forEach(([name, a, b], i) => { const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'chip'; btn.textContent = name; btn.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
      btn.onclick = () => { eraBox.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', 'false')); btn.setAttribute('aria-pressed', 'true'); range = [a, b]; layout('move');
        const k = dots.filter((d) => d.c.y >= a && d.c.y <= b).length; document.getElementById('sh-count').textContent = i ? `${k.toLocaleString('en-US')} councils, ${a}–${Math.min(b, 1902)}` : `${dots.length.toLocaleString('en-US')} dated councils`; }; eraBox.appendChild(btn); eraBox.append(' '); });
    const cv = document.getElementById('sh-tl'), ctx = cv.getContext('2d'), tip = document.getElementById('sh-tip'); const M = { l: 14, r: 14, t: 96, b: 46 }; let W, H, r = 2.4, bk, hover = null, prog = 1, mode = 'snap', start = 0, raf = null;
    const dots = C.filter((c) => c.y).map((c) => ({ c }));
    const X = (y) => M.l + (y - range[0]) / (range[1] - range[0]) * (W - M.l - M.r);
    function size() { const dpr = devicePixelRatio || 1; W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    function layout(m = 'snap') { const span = range[1] - range[0], bw = Math.max(1, Math.round(span / Math.max(40, (W - M.l - M.r) / 9))), base = H - M.b, buckets = new Map();
      for (const d of dots) { const {y} = d.c; d.out = y < range[0] || y > range[1]; if (d.out) continue; const k = Math.floor((y - range[0]) / bw); if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(d); }
      let max = 1; buckets.forEach((a) => { max = Math.max(max, a.length); }); const pitch = Math.max(2.2, Math.min(7, (base - M.t) / max)); r = Math.max(0.9, Math.min(2.8, pitch * 0.42));
      buckets.forEach((a, k) => { a.sort((p, q) => p.c.y - q.c.y); const cx = X(range[0] + (k + 0.5) * bw); a.forEach((d, i) => { d.tx = cx; d.ty = base - r - i * pitch; }); }); bk = { buckets, bw, pitch };
      for (const d of dots) { if (d.out) { d.tx = X(d.c.y); d.ty = base - r; } d.fx = m === 'drop' ? d.tx : (d.x ?? d.tx); d.fy = m === 'drop' ? -20 - Math.random() * 160 : (d.y ?? d.ty); if (m === 'snap' || !G) { d.x = d.tx; d.y = d.ty; } }
      mode = m; if (m === 'snap' || !G) { prog = 1; draw(); return; } start = performance.now(); prog = 0; hover = null; tip.hidden = true; if (!raf) raf = requestAnimationFrame(tick); }
    function tick(now) { prog = clamp((now - start) / (mode === 'drop' ? 1700 : 950)); const e = mode === 'drop' ? outC : inOut;
      for (const d of dots) { const lag = clamp((d.tx - M.l) / W) * 0.4, u = e(clamp((prog - lag) / 0.6)); d.x = d.fx + (d.tx - d.fx) * u; d.y = d.fy + (d.ty - d.fy) * u; }
      draw(); raf = prog < 1 ? requestAnimationFrame(tick) : null; }
    function draw() { ctx.clearRect(0, 0, W, H); const muted = css('--muted'), rub = css('--rubric'), rule = css('--rule'), base = H - M.b;
      ctx.strokeStyle = rule; ctx.beginPath(); ctx.moveTo(M.l, base + 0.5); ctx.lineTo(W - M.r, base + 0.5); ctx.stroke(); const span = range[1] - range[0], step = span > 900 ? 100 : span > 400 ? 50 : 25;
      ctx.fillStyle = muted; ctx.font = `12px ${css('--body')}`; ctx.textAlign = 'center'; for (let y = Math.ceil(range[0] / step) * step; y <= range[1]; y += step) ctx.fillText(String(y), X(y), base + 19);
      for (const d of dots) { if (d.x < -6 || d.x > W + 6) continue; ctx.globalAlpha = d.out ? 0.62 * (1 - prog) : 0.62; ctx.fillStyle = muted; ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, 6.28); ctx.fill(); }
      const la = prog < 1 ? clamp((prog - 0.55) / 0.45) : 1; if (la <= 0) { ctx.globalAlpha = 1; return; }
      ctx.globalAlpha = 1; ctx.font = `11.5px ${css('--body')}`; const lanes = [14, 30, 46, 62, 78], lastX = lanes.map(() => -1e9);
      for (const e of D.ecumenical) { if (e.y < range[0] || e.y > range[1]) continue; const x = X(e.y), label = e.name.replace('Basel–Ferrara–Florence', 'Basel–Florence'); let lane = 0; const w = ctx.measureText(label).width + 10;
        while (lane < lanes.length - 1 && x - w / 2 < lastX[lane]) lane++; lastX[lane] = x + w / 2; ctx.strokeStyle = rub; ctx.globalAlpha = 0.35 * la; ctx.beginPath(); ctx.moveTo(x + 0.5, lanes[lane] + 6); ctx.lineTo(x + 0.5, base); ctx.stroke(); ctx.globalAlpha = la;
        ctx.fillStyle = rub; ctx.save(); ctx.translate(x, lanes[lane] + 10); ctx.rotate(Math.PI / 4); ctx.fillRect(-3.5, -3.5, 7, 7); ctx.restore(); ctx.fillText(label, x, lanes[lane] + 2); } ctx.globalAlpha = 1;
      if (hover) { ctx.strokeStyle = rub; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(hover.x, hover.y, r + 2.5, 0, 6.28); ctx.stroke(); ctx.lineWidth = 1; } }
    function pick(mx, my) { const y = range[0] + (mx - M.l) / (W - M.l - M.r) * (range[1] - range[0]), k = Math.floor((y - range[0]) / bk.bw); let best = null, bd = 1e9;
      if (prog < 1) return null; for (const kk of [k - 1, k, k + 1]) for (const d of bk.buckets.get(kk) || []) { const dd = Math.hypot(d.x - mx, d.y - my); if (dd < bd) { bd = dd; best = d; } } return best && bd < Math.max(9, bk.pitch * 1.6) ? best : null; }
    cv.addEventListener('mousemove', (ev) => { const b = cv.getBoundingClientRect(), mx = ev.clientX - b.left, my = ev.clientY - b.top, h = pick(mx, my); hover = h; draw();
      if (!h) { tip.hidden = true; return; } tip.innerHTML = `${esc(h.c.t)}<small>${yr(h.c)} · ${ref(h.c)}</small>`; tip.hidden = false;
      let left = mx + 14; const top = my - 10; if (left + tip.offsetWidth > b.width) left = mx - tip.offsetWidth - 14; tip.style.left = `${Math.max(0, left)}px`; tip.style.top = `${Math.max(0, top)}px`; });
    cv.addEventListener('mouseleave', () => { hover = null; tip.hidden = true; draw(); });
    const tlpick = document.getElementById('sh-tlpick');
    cv.addEventListener('click', (ev) => { const b = cv.getBoundingClientRect(), h = pick(ev.clientX - b.left, ev.clientY - b.top); if (!h) return; hover = h; draw();
      tlpick.innerHTML = `<span style="color:var(--rubric);font-weight:600">${yr(h.c)}</span> <a href="${READ(T[h.c.v].slug, h.c.p)}" target="_blank" rel="noopener">${esc(h.c.t)}</a><small>${ref(h.c)}</small>`;
      if (G) G.from(tlpick, { opacity: 0, y: 6, duration: 0.3, ease: 'power2.out', clearProps: 'opacity,transform' }); });
    document.getElementById('sh-count').textContent = `${dots.length.toLocaleString('en-US')} dated councils`;
    size(); layout('drop'); let firstRO = true; new ResizeObserver(() => { if (firstRO) { firstRO = false; return; } size(); layout('snap'); }).observe(cv); }

  const h = (location.hash.match(/^#by-(council|tome|place|century)$/) || [])[1]; show(h || 'council', true);

  }
})();
