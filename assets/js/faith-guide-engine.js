/* The shelf guides' shared engine (10-10). Each guide's own scenes live in its page; this file only gives them the common parts:
   reader links, pinned scroll chapters (GSAP ScrollTrigger; stacked and static on phones or with reduced motion), count-ups,
   reveal-on-scroll, a conic map of Europe and the Mediterranean, and the lifelines explorer every shelf ends with. */
window.TG = (() => {
  const method = (html) => (window.TFRMethod ? window.TFRMethod.html(html) : html);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasG = !!(window.gsap && window.ScrollTrigger);
  if (hasG) gsap.registerPlugin(ScrollTrigger);
  const root = document.querySelector('.tg');
  // reader links: absolute in the stand-alone previews, relative on MereO itself (the theme sets data-base="")
  const BASE = root && root.dataset.base != null ? root.dataset.base : 'https://mereorthodoxy.com';
  // on MereO the masthead and the rail stay on screen: pinned chapters start under them
  // (MereO hides its masthead on scroll and keeps the TFR rail: the rail's height is what stays on screen)
  const pinTop = () => !root?.dataset.pinBelow ? 0 : [...document.querySelectorAll(root.dataset.pinBelow)].filter((e) => /sticky|fixed/.test(getComputedStyle(e).position)).reduce((t, e) => t + e.getBoundingClientRect().height, 0);
  if (root) root.style.setProperty('--tg-pin', `${pinTop()}px`);
  // MereO sets html { scroll-behavior: smooth }. ScrollTrigger measures its pins by jumping the scroll position on a refresh; a smoothed
  // jump is measured mid-glide and the pins start in the wrong place (10-11: the English press scene pinned over its hero on the live
  // site). The guide page scrolls without smoothing while it runs.
  if (root && hasG) document.documentElement.style.scrollBehavior = 'auto';
  // refresh the pins when the page above them changes height (a hero that rearranges itself, a fold that opens, the site's band above
  // the guide, which sits outside it), and once the web fonts are in, since a title set in IM Fell is taller than its fallback
  if (root && hasG && 'ResizeObserver' in window) { let h0 = 0, rt; const box = root.closest('main') || root; new ResizeObserver(() => { const h = box.offsetHeight; if (Math.abs(h - h0) < 40) return; h0 = h; clearTimeout(rt); rt = setTimeout(() => ScrollTrigger.refresh(), 200); }).observe(box); }
  if (root && hasG && document.fonts && document.fonts.ready) document.fonts.ready.then(() => setTimeout(() => ScrollTrigger.refresh(), 60));
  // on MereO the loader (faith-guide.js) keeps a cover over the guide while it is drawn (a reader, 10-11: "a few little glitchy
  // things...might wanna have it give a loading status until all the elements are loaded"); figures count up and lines come in
  // once it lifts, so they play in view. The stand-alone previews have no cover and go at once.
  const shown = new Promise((res) => { const w = document.querySelector('[data-guide-root]'); if (w && w.classList.contains('tg-wait')) w.addEventListener('tg-shown', () => res(), { once: true }); else res(); });
  const TG = {
    reduce, hasG, shown,
    pinOK: () => hasG && !reduce && innerWidth > 860,
    esc: (s) => String(s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])),
    // a link to a page goes into the reader; a link to a whole work goes to the work's room (owner 10-10: "we need linking to work and author rooms")
    read: (slug, n) => (n ? `${BASE}/the-faith-received/read/?w=${encodeURIComponent(slug)}#b${n}-0` : `${BASE}/the-faith-received/author/#w/${encodeURIComponent(slug)}`),
    work: (slug) => `${BASE}/the-faith-received/author/#w/${encodeURIComponent(slug)}`,
    author: (name) => `${BASE}/the-faith-received/author/?a=${encodeURIComponent(name)}`,
    href: (path) => `${BASE}/the-faith-received/${path}`,
    css: (n) => getComputedStyle(root).getPropertyValue(n).trim(),
    fmt: (n) => Number(n).toLocaleString('en-US'),
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    ease: (t) => 1 - (1 - t)**3,
    lerp: (a, b, t) => a + (b - a) * t,
  };
  // data: inline <script type="application/json" id="tg-<name>"> in the stand-alone page, or the theme's asset URL in data-<name>
  TG.load = (name) => {
    const el = document.getElementById(`tg-${name}`);
    const got = el ? Promise.resolve(JSON.parse(el.textContent)) : fetch(root.dataset[name]).then((r) => r.json());
    if (name === 'data') got.then((D) => { if (D && D.keys) setTimeout(() => TG.keynames(D), 0); if (D && D.keyworks) setTimeout(() => TG.keyworks(D), 0); if (D && D.lk) TG.linkify(root, D.lk); });
    return got;
  };
  // every person and work a guide names opens its room (owner 10-11: "can we open everything mentioned in the guides?"): the first
  // mention of each in a paragraph, in the page's copy and in every caption and card the scenes write (D.lk, built by common/links.py)
  TG.linkify = (scope, L) => {
    if (!scope || TG.linked || !L || !L.length) return;
    TG.linked = true;
    let re;
    const to = new Map(L.map(([p, k, t, n]) => [p, k === 'a' ? TG.author(t) : TG.read(t, n || 0)]));
    try { re = new RegExp(`(?<![\\p{L}\\p{N}])(${[...to.keys()].map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\p{L}\\p{N}])`, 'gu'); } catch (e) { return; }
    const SKIP = 'a,button,select,option,label,textarea,input,script,style,svg,canvas,h1,h2,.eyebrow,.tip,nav,#explore,[data-nolink]';
    const run = (el) => {
      if (!el || !el.isConnected || el.closest(SKIP)) return;
      const nodes = [], w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) { re.lastIndex = 0; if (re.test(n.nodeValue) && n.parentElement && !n.parentElement.closest(SKIP)) nodes.push(n); }
      nodes.forEach((node) => {
        if (!node.isConnected) return;
        const blk = node.parentElement.closest('p,li,dd,td,figcaption,h3,h4,div') || node.parentElement;
        const done = new Set([...blk.querySelectorAll('a.tg-ln')].map((a) => a.textContent));
        const s = node.nodeValue, frag = document.createDocumentFragment(); let last = 0, any = false, m;
        re.lastIndex = 0;
        while ((m = re.exec(s))) {
          if (done.has(m[1])) continue;
          done.add(m[1]); any = true;
          frag.append(s.slice(last, m.index));
          const a = document.createElement('a'); a.className = 'tg-ln'; a.href = to.get(m[1]); a.target = '_blank'; a.rel = 'noopener'; a.textContent = m[1];
          frag.append(a); last = m.index + m[1].length;
        }
        if (any) { frag.append(s.slice(last)); node.replaceWith(frag); }
      });
    };
    run(scope);
    let todo = new Set(), raf = 0;
    new MutationObserver((ms) => {
      ms.forEach((mu) => { const t = mu.target.nodeType === 3 ? mu.target.parentElement : mu.target; if (t) todo.add(t); });
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; const els = [...todo]; todo = new Set(); els.forEach(run); });
    }).observe(scope, { childList: true, subtree: true, characterData: true });
  };
  TG.yr = (a) => (a.y0 && a.y1 ? (a.y0 === a.y1 ? `${a.y0}` : `${a.y0}–${a.y1}`) : a.d || '');
  // count a number up when it scrolls into view
  TG.countUp = (el, to, dur = 1.6) => {
    if (!hasG || reduce) { el.textContent = TG.fmt(to); return; }
    const o = { v: 0 }; el.textContent = '0';
    shown.then(() => gsap.to(o, { v: to, duration: dur, ease: 'power2.out', onUpdate() { el.textContent = TG.fmt(Math.round(o.v)); }, scrollTrigger: { trigger: el, start: 'top 92%', once: true } }));
  };
  TG.reveal = (sel) => {
    const els = [...document.querySelectorAll(sel)];
    if (reduce || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px' });
    shown.then(() => els.forEach((e) => io.observe(e)));
  };
  // a hero's opening timeline: built with the scene, played from its start (and its delay) when the cover lifts
  TG.intro = (vars = {}) => { const tl = gsap.timeline({ ...vars, paused: true }); shown.then(() => tl.restart(true)); return tl; };
  // refresh the pins in the order they stand on the page (10-11). ScrollTrigger measures pins in the order they were made, and a pin
  // measured before the pins above it starts as if they took no room. The Key Works pin is made as soon as the data arrives, before a
  // shelf's own scenes (which wait for more data), so it started thousands of pixels too early, on top of an earlier scene; on the
  // Westminster guide it lay over the session ledger. Every new pin therefore puts all of them back in page order once the batch is made.
  TG.inOrder = () => { if (!window.ScrollTrigger) return; ScrollTrigger.sort((a, b) => { const x = a.trigger, y = b.trigger; if (!x || !y || x === y) return 0; return x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1; }); ScrollTrigger.refresh(); };
  let reord = 0; const reorder = () => { clearTimeout(reord); reord = setTimeout(TG.inOrder, 0); };
  // MereO fit (Ian, 2026-10-12, of the Reformed type case and map with their tops under the site's bars: "this is just a bug that
  // shouldn't happen"). Pinning a tall scene by its foot hid its heading and the top of its picture for the whole scene. A scene now
  // fits the room under the bars: when its content is taller, the content is scaled down (CSS zoom on its .wrap, so the scene's own
  // height shrinks and the pin measures what is drawn). Measured again before every ScrollTrigger refresh (resize, fonts).
  // Every pinned scene is set a step smaller on a desktop (Ian, 2026-10-12: "simply shrink every section by a small bit. Not making it
  // tiny or anything"), so the scenes keep one size together; a scene still taller than the room goes smaller only as far as it must.
  TG.fitScene = (el) => {
    const BASE = 0.9;
    const fit = () => {
      const w = el && el.querySelector(':scope > .wrap'); if (!w) return;
      // measured on the .wrap as drawn, never on the scene: once pinned, ScrollTrigger fixes the scene's height inline
      const cs = getComputedStyle(el), pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
      // the bars come from the scene's own guide root (the Councils guide's root is .tg-cou, which pinTop does not see)
      const pr = el.closest('[data-pin-below]'), bars = pr ? [...document.querySelectorAll(pr.dataset.pinBelow)].filter((e) => /sticky|fixed/.test(getComputedStyle(e).position)).reduce((t, e) => t + e.getBoundingClientRect().height, 0) : pinTop();
      const drawn = () => w.getBoundingClientRect().height, room = innerHeight - bars - pad;
      w.style.zoom = '';
      let z = Math.max(0.55, Math.min(BASE, room / Math.max(1, drawn())));
      w.style.zoom = z.toFixed(3);
      // a drawing that sizes itself from its box can come out taller than the scale promised: check, and correct, up to three times
      for (let i = 0; i < 3 && drawn() > room + 2 && z > 0.55; i++) {
        z = Math.max(0.55, z * room / drawn()); w.style.zoom = z.toFixed(3);
      }
    };
    fit(); if (window.ScrollTrigger) ScrollTrigger.addEventListener('refreshInit', fit);
    // content that grows after the pin is made (a card filled in, fonts) is fitted again, and the pins re-measured once
    { const w = el && el.querySelector(':scope > .wrap'); let rt = 0, last = '';
      if (w && 'ResizeObserver' in window) new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { fit(); const z = w.style.zoom; if (z !== last) { last = z; ScrollTrigger.refresh(); } }, 200); }).observe(w); }
  };
  // a pinned chapter: onUpdate(progress 0..1) while it is scrubbed; on phones and with reduced motion it gets its last state once.
  // A scene taller than the room under the site's bars is pinned by its foot, so the step being told and the picture's last lines stay
  // on the screen; its heading has been read on the way in (10-11: the Reformed method scene hid its current step below the window).
  TG.chapter = (sel, length, onUpdate, opts = {}) => {
    const el = document.querySelector(sel);
    if (!TG.pinOK()) { if (TG.plays() && el) return TG.autoplay(el, length, onUpdate); onUpdate(1, true); return null; } // a phone's player stands in for the pin
    onUpdate(0, false);
    TG.fitScene(el);
    const st = ScrollTrigger.create({ trigger: el, start: () => (el.offsetHeight > innerHeight - pinTop() + 2 ? 'bottom bottom' : `top top+=${pinTop()}`), end: `+=${length}`, pin: true, scrub: opts.scrub ?? 0.6, anticipatePin: 1,
      onUpdate: (t) => onUpdate(t.progress, false) });
    reorder(); return st;
  };
  // phones (owner 10-11: "make sure the maps land, they load but it isnt in the motion"): a scene is not pinned on a small screen, but it
  // still plays: once its picture is half in view it runs from start to end by itself, then offers to play again
  TG.plays = () => TG.pinOK() || (hasG && !reduce && 'IntersectionObserver' in window);
  TG.autoplay = (el, length, onUpdate, opt = {}) => {
    const pick = () => { // the scene's picture: a known box, else the picture column of the scene, else its first drawn canvas or SVG
      const k = el.querySelector('.mapbox, .stage, .art, .conf, .deb, .ann, .fig'); if (k && k.getBoundingClientRect().height) return k;
      const g = el.querySelector('.scene-grid > :last-child'); if (g && g.getBoundingClientRect().height) return g;
      return [...el.querySelectorAll('canvas, svg')].find((x) => x.getBoundingClientRect().width > 40) || el;
    };
    const vis = opt.vis || pick();
    const dur = opt.dur || TG.clamp(length / 520, 4, 9), st = { p: 0 }; let tw = null;
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'tg-replay'; btn.textContent = 'Play again'; btn.hidden = true;
    const play = () => { if (tw) tw.kill(); io.disconnect(); st.p = 0; btn.hidden = true; onUpdate(0, false);
      tw = gsap.to(st, { p: 1, duration: dur, ease: 'none', onUpdate: () => onUpdate(st.p, false), onComplete() { onUpdate(1, true); btn.textContent = 'Play again'; btn.hidden = false; } }); };
    btn.addEventListener('click', play);
    (vis === el ? el : vis).insertAdjacentElement(vis === el ? 'beforeend' : 'afterend', btn);
    onUpdate(0, false);
    // it plays once half of what the screen can show of it is in view (by height: a picture wider than the phone scrolls sideways);
    // a reader who scrolls past before that finds its last frame and a button to play it
    let passed = false;
    const io = new IntersectionObserver((es) => {
      const e = es[es.length - 1], r = e.boundingClientRect;
      if (!r.width && !r.height) { io.disconnect(); onUpdate(1, true); return; } // a picture hidden on this screen: its last frame
      const h = Math.min(r.height, innerHeight);
      if (h > 0 && e.intersectionRect.height / h >= 0.5) { io.disconnect(); btn.textContent = 'Play again'; play(); return; }
      if (r.bottom < 0 && !passed) { passed = true; onUpdate(1, true); btn.textContent = 'Play'; btn.hidden = false; }
    }, { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] });
    io.observe(vis);
    return { play };
  };
  // the chronicle beside a map: which entry is "now\"
  TG.chronicle = (ul, events, render) => {
    ul.innerHTML = events.map(render).join('');
    const lis = [...ul.children];
    return (year) => {
      let now = -1; events.forEach((e, i) => { if (e[0] <= year) now = i; });
      lis.forEach((li, i) => { li.classList.toggle('now', i === now); li.classList.toggle('past', i < now); });
      if (now >= 0 && TG.plays()) { const li = lis[now]; ul.scrollTop = Math.max(0, li.offsetTop - ul.clientHeight * 0.3); }
      return now;
    };
  };
  // Europe and the Mediterranean: Lambert conformal conic fitted to a lon/lat box; the land is drawn once into an SVG
  TG.map = (box, land, extent, opts = {}) => {
    const svg = d3.select(box.querySelector('svg')); let proj, W, H;
    const fit = () => {
      W = box.clientWidth; H = box.clientHeight;
      const [[x0, y0], [x1, y1]] = TG.small() && opts.phone ? opts.phone : extent;
      proj = d3.geoConicConformal().parallels(opts.parallels || [38, 56]).rotate([-(x0 + x1) / 2, 0])
        .fitExtent([[6, 6], [W - 6, H - 6]], { type: 'MultiPoint', coordinates: [[x0, y0], [x1, y0], [x0, y1], [x1, y1], [(x0 + x1) / 2, y1 + 1.5]] });
      svg.attr('viewBox', `0 0 ${W} ${H}`).selectAll('*').remove();
      const g = svg.append('g');
      g.append('path').datum({ type: 'Feature', geometry: land }).attr('d', d3.geoPath(proj)).attr('fill', TG.css('--land')).attr('stroke', TG.css('--coast')).attr('stroke-width', 0.8);
      const grat = d3.geoGraticule().step([10, 10]).extent([[x0 - 10, y0 - 10], [x1 + 10, y1 + 10]]);
      g.append('path').datum(grat()).attr('d', d3.geoPath(proj)).attr('fill', 'none').attr('stroke', TG.css('--rule')).attr('stroke-width', 0.4).attr('stroke-dasharray', '2 3').lower();
      M.proj = proj; M.W = W; M.H = H; if (M.onfit) M.onfit();
    };
    const M = { fit, xy: (lonlat) => proj([lonlat[1], lonlat[0]]) };
    fit(); let t; new ResizeObserver(() => { clearTimeout(t); t = setTimeout(() => { if (Math.abs(box.clientWidth - W) > 2 || Math.abs(box.clientHeight - H) > 2) fit(); }, 120); }).observe(box);
    if (TG.small()) { // the SVG labels a scene sets over its map: the larger first, then in the order drawn; a label that covers a kept one is hidden
      let raf = 0;
      const thin = () => {
        raf = 0; const kept = [];
        [...box.querySelectorAll('svg text')].map((e, i) => ({ e, i, f: parseFloat(getComputedStyle(e).fontSize) || 10 })).sort((a, b) => b.f - a.f || a.i - b.i).forEach(({ e }) => {
          e.style.visibility = ''; const r = e.getBoundingClientRect();
          if (!r.width) return;
          if (kept.some((o) => o.left < r.right - 1 && r.left < o.right - 1 && o.top < r.bottom - 1 && r.top < o.bottom - 1)) e.style.visibility = 'hidden'; else kept.push(r);
        });
      };
      new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(thin); }).observe(box, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['x', 'y', 'transform'] });
    }
    return M;
  };
  TG.canvas = (cv) => { const c = { cv, ctx: cv.getContext('2d') }; c.size = () => { const d = devicePixelRatio || 1; c.W = cv.clientWidth; c.H = cv.clientHeight; cv.width = c.W * d; cv.height = c.H * d; c.ctx.setTransform(d, 0, 0, d, 0, 0); }; c.size(); if (TG.small()) TG.declutter(c.ctx); return c; };
  // phones (owner 10-11: "geography on mobile pls fix"): a map shrinks to the width of the screen, so its labels would sit on one
  // another; a label that would cover one already drawn in the same frame is left out (its halo and its text count as one label)
  TG.small = () => innerWidth <= 860;
  TG.declutter = (ctx) => {
    const placed = [], clear = ctx.clearRect.bind(ctx), fill = ctx.fillText.bind(ctx), stroke = ctx.strokeText.bind(ctx);
    const boxOf = (s, x, y) => {
      const m = ctx.measureText(s), w = m.width, up = m.actualBoundingBoxAscent || 9, dn = m.actualBoundingBoxDescent || 3, al = ctx.textAlign, bl = ctx.textBaseline;
      const x0 = al === 'center' ? x - w / 2 : (al === 'right' || al === 'end') ? x - w : x;
      const y0 = bl === 'top' || bl === 'hanging' ? y : bl === 'middle' ? y - (up + dn) / 2 : bl === 'bottom' || bl === 'ideographic' ? y - up - dn : y - up;
      const T = ctx.getTransform(), p = (px, py) => [T.a * px + T.c * py + T.e, T.b * px + T.d * py + T.f];
      const q = [p(x0, y0), p(x0 + w, y0), p(x0, y0 + up + dn), p(x0 + w, y0 + up + dn)];
      return { k: `${s}|${Math.round(x)}|${Math.round(y)}`, x0: Math.min(...q.map((v) => v[0])) - 2, x1: Math.max(...q.map((v) => v[0])) + 2, y0: Math.min(...q.map((v) => v[1])) - 1, y1: Math.max(...q.map((v) => v[1])) + 1 };
    };
    const ok = (s, x, y) => {
      if (!s || String(s).length < 3) return true;
      const b = boxOf(String(s), x, y), same = placed.find((o) => o.k === b.k);
      if (same) return true;
      if (placed.some((o) => o.x0 < b.x1 && b.x0 < o.x1 && o.y0 < b.y1 && b.y0 < o.y1)) return false;
      placed.push(b); return true;
    };
    ctx.clearRect = (...a) => { placed.length = 0; clear(...a); };
    ctx.fillText = (s, x, y, ...r) => { if (ok(s, x, y)) fill(s, x, y, ...r); };
    ctx.strokeText = (s, x, y, ...r) => { if (ok(s, x, y)) stroke(s, x, y, ...r); };
  };

  /* ---------- the finder every guide ends with (owner 10-10: "the previous dropdown selection tools … add that same capability elsewhere"):
     one search over authors and titles, the family chips, and two ways in, each a tab (owner 10-10: "get rid of By title filtering"):
       By author  — the centuries as folds, each author a fold of its own that opens to the works (links into the reader)
       By century — every life as a line, an author card under it
     Authors without dates sit in their own fold; a life that runs past the chart's range is clipped with an arrow. ---------- */
  TG.explorer = (host, D, opt) => {
    const fams = D.fam, famColor = (k) => TG.css(`--f${fams.findIndex((f) => f[0] === k) + 1}`), {esc} = TG, {fmt} = TG;
    const AU = D.authors.concat((D.undated || []).filter((u) => !D.authors.includes(u)).map((u) => ({ ...u, w: u.w || [] })));
    const ORD = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : (n % 10 < 4 ? n % 10 : 0)]);
    // when a writer was at work: three-fifths into his life, at most forty years after his birth
    const fl = (a) => (a.y0 ? Math.round(a.y0 + Math.min(40, ((a.y1 || a.y0 + 60) - a.y0) * 0.6)) : null), CENT = (y) => Math.floor((y - 1) / 100) + 1;
    const nW = AU.reduce((t, a) => t + a.w.length, 0);
    host.innerHTML = `<div class="fx-top"><label class="fx-search"><span>Find</span><input type="search" placeholder="${esc(opt.placeholder || 'An author or a title')}" autocomplete="off" aria-label="Find an author or a title on this shelf"></label><span class="fams"></span></div>
      <p class="fx-count small" aria-live="polite"></p>
      <div class="fx-tabs" role="tablist" aria-label="Ways into the shelf"><button type="button" role="tab" data-t="author" aria-selected="true">By author</button><button type="button" role="tab" data-t="century" aria-selected="false">${(opt.range[1] - opt.range[0]) > 350 ? 'By century' : 'Over time'}</button><span class="fx-ink" aria-hidden="true"></span></div>
      <section class="fx-panel" data-p="author" role="tabpanel"><div class="fx-folds"></div></section>
      <section class="fx-panel" data-p="century" role="tabpanel" hidden><div class="instrument"><div style="position:relative;overflow-x:auto"><svg class="lives" role="img" aria-label="${esc(opt.label || 'Lifelines of every author on the shelf')}"></svg><div class="tip" hidden></div></div>
        <div class="hint" style="margin:6px 0 0">${method(esc(opt.hint || 'Each line is a life. Choose one to see the works on the shelf.'))}</div></div><div class="card pick" style="margin-top:14px" aria-live="polite"></div></section>`;
    const $ = (s2) => host.querySelector(s2), svg = $('svg.lives'), tip = $('.tip'), input = $('input'), pick = $('.pick'), folds = $('.fx-folds'), count = $('.fx-count');
    let on = new Set(fams.map((f) => f[0])), q = '', cur = null, tab = 'author';
    $('.fams').innerHTML = fams.filter((f) => AU.some((a) => a.f === f[0])).map(([k, n]) => `<button type="button" class="chip" aria-pressed="true" data-f="${k}"><i style="background:var(--f${fams.findIndex((x) => x[0] === k) + 1})"></i>${esc(n)}</button>`).join('');
    host.querySelectorAll('.chip[data-f]').forEach((b) => { b.onclick = () => {
      const k = b.dataset.f, all = on.size === fams.length;
      if (all) { on = new Set([k]); } else if (on.has(k)) { on.delete(k); if (!on.size) on = new Set(fams.map((f) => f[0])); } else on.add(k);
      host.querySelectorAll('.chip[data-f]').forEach((c) => c.setAttribute('aria-pressed', on.has(c.dataset.f) ? 'true' : 'false')); refresh(true); }; });
    const hitW = (w) => !q || w[0].toLowerCase().includes(q);
    const match = (a) => !q || a.n.toLowerCase().includes(q) || a.full?.toLowerCase().includes(q) || a.w.some(hitW);
    const mark = (t) => (q ? esc(t).replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), (m) => `<mark>${m}</mark>`) : esc(t));
    const works = (a, all) => { const ws = all || !q || a.n.toLowerCase().includes(q) || a.full?.toLowerCase().includes(q) ? a.w : a.w.filter(hitW);
      return `<ul class="wlist">${ws.map((w) => `<li><a href="${TG.read(w[1], w[3])}" target="_blank" rel="noopener">${mark(w[0])}</a><small>${w[2] ? `${fmt(w[2])} pp.` : ''}</small></li>`).join('')}</ul>`; };
    // the tabs, with an ink rule that slides to the chosen one
    const tabs = [...host.querySelectorAll('.fx-tabs [role=tab]')], ink = $('.fx-ink');
    const moveInk = (instant) => { const b = tabs.find((t) => t.dataset.t === tab); if (!b) return; const to = { x: b.offsetLeft, width: b.offsetWidth };
      if (hasG && !reduce && !instant) gsap.to(ink, { ...to, duration: 0.45, ease: 'power3.out' }); else if (window.gsap) gsap.set(ink, to); else Object.assign(ink.style, { transform: `translateX(${to.x}px)`, width: `${to.width}px` }); };
    function setTab(t, instant) {
      tab = t; tabs.forEach((b) => b.setAttribute('aria-selected', b.dataset.t === t ? 'true' : 'false'));
      let pane = null; host.querySelectorAll('.fx-panel').forEach((p2) => { p2.hidden = p2.dataset.p !== t; if (!p2.hidden) pane = p2; });
      moveInk(instant); if (t === 'century') draw(!instant);
      if (hasG && !reduce && !instant && pane) gsap.fromTo(pane, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', clearProps: 'opacity,transform' });
    }
    tabs.forEach((b) => { b.onclick = () => setTab(b.dataset.t); });
    new ResizeObserver(() => moveInk(true)).observe($('.fx-tabs'));
    // By author: the centuries as folds, each author a fold
    // the folds take the shelf's own scale (owner 10-10: "by century doesn't work when all the authors are 17th century"): centuries for the
    // Fathers, half or quarter centuries or decades for a shelf that lives inside one or two, so there are always a handful of folds
    const dated = AU.filter((a) => a.y0).map(fl);
    const SIZE = [100, 50, 25, 10].find((s) => { const c = {}; dated.forEach((y) => { const k = Math.floor(y / s); c[k] = (c[k] || 0) + 1; });
      return Object.keys(c).length >= 4 && Math.max(...Object.values(c)) <= dated.length * 0.4; }) || 10; // at least four folds, none with more than two-fifths of the writers
    const bucket = (y) => Math.floor(y / SIZE) * SIZE;
    const blabel = (k) => (SIZE === 100 ? `${ORD(CENT(k + 1))} century` : SIZE === 10 ? `The ${k}s` : `${k} to ${k + SIZE - 1}`);
    function authors(anim) {
      const A = AU.filter((a) => on.has(a.f) && match(a) && (a.y0 || q)), by = new Map(); // writers with no date at all are found by search
      A.forEach((a) => { const k = a.y0 ? bucket(fl(a)) : -1; if (!by.has(k)) by.set(k, []); by.get(k).push(a); });
      const keys = [...by.keys()].sort((x, y) => (x < 0 ? 1e9 : x) - (y < 0 ? 1e9 : y));
      const spark = (k, as) => { const x = (y) => ((y - k) / SIZE * 100).toFixed(2), mx = Math.max(...as.map((a) => a.w.length), 1);
        return `<svg class="fx-spark" viewBox="0 0 100 18" preserveAspectRatio="none" aria-hidden="true">${as.map((a) => `<line x1="${x(fl(a))}" x2="${x(fl(a))}" y1="${(16 - 13 * Math.sqrt(a.w.length / mx)).toFixed(1)}" y2="16" stroke="${famColor(a.f)}" vector-effect="non-scaling-stroke"/>`).join('')}</svg>`; };
      folds.innerHTML = keys.length ? keys.map((k, i) => { const as = by.get(k).sort((x, y) => (x.y0 || 0) - (y.y0 || 0)), nw = as.reduce((t, a) => t + (q ? a.w.filter(hitW).length || a.w.length : a.w.length), 0);
        return `<details class="fx-cent" data-k="${k}"${q || i === 0 ? ' open' : ''}><summary><b>${k >= 0 ? blabel(k) : 'Dates not recorded'}</b><span>${as.length} ${as.length === 1 ? 'author' : 'authors'} · ${fmt(nw)} ${nw === 1 ? 'work' : 'works'}</span>${k >= 0 ? spark(k, as) : ''}<i aria-hidden="true">›</i></summary>
          <div class="fx-who-list">${as.map((a) => `<details class="fx-who" data-i="${AU.indexOf(a)}"${q && A.length <= 6 ? ' open' : ''}><summary><i style="background:${famColor(a.f)}"></i><b title="${esc(a.full && a.full !== a.n ? a.full : '')}">${mark(a.n)}</b><span class="d">${esc(a.d || TG.yr(a))}</span><span class="n">${a.w.length} ${a.w.length === 1 ? 'work' : 'works'}${a.p ? `, ${fmt(a.p)} pp.` : ''}</span></summary>
            <div class="fx-body">${a.aff ? `<p class="small" style="margin:0 0 4px">${esc(a.aff)}</p>` : ''}${works(a)}<p class="small" style="margin:6px 0 0"><a href="${TG.author(a.full || a.n)}" target="_blank" rel="noopener">The author’s room</a></p></div></details>`).join('')}</div></details>`; }).join('')
        : `<p class="small">Nothing on this shelf matches “${esc(q)}”.</p>`;
      if (anim && hasG && !reduce) gsap.fromTo(folds.querySelectorAll('.fx-spark'), { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 1, stagger: 0.05, ease: 'power2.inOut', clearProps: 'clipPath' });
      count.textContent = q ? ((nT) => `${A.length} ${A.length === 1 ? 'author' : 'authors'} and ${fmt(nT)} ${nT === 1 ? 'title' : 'titles'} match “${input.value.trim()}”.`)(A.reduce((t, a) => t + a.w.filter(hitW).length, 0)) : `${AU.length} authors and ${fmt(nW)} works on this shelf.`;
    }
    folds.addEventListener('toggle', (ev) => { const d = ev.target; if (!d.open || !hasG || reduce) return;
      if (d.classList.contains('fx-cent')) gsap.from(d.querySelectorAll(':scope > .fx-who-list > .fx-who'), { opacity: 0, y: 8, duration: 0.35, stagger: 0.02, ease: 'power2.out', clearProps: 'opacity,transform' });
      if (d.classList.contains('fx-who')) gsap.from(d.querySelectorAll('.wlist li'), { opacity: 0, x: -6, duration: 0.3, stagger: 0.012, ease: 'power2.out', clearProps: 'opacity,transform' }); }, true);
    // By century: the lifelines and the author card
    function draw(anim) {
      if (tab !== 'century') return;
      const A = AU.filter((a) => on.has(a.f) && match(a) && a.y0);
      const w = Math.max(680, svg.parentElement.clientWidth), [Y0, Y1] = opt.range, cl = (y) => Math.max(Y0, Math.min(Y1, y)), sx = (y) => 12 + (cl(y) - Y0) / (Y1 - Y0) * (w - 24);
      const rows = []; const placed = A.map((a) => { const x0 = sx(a.y0), x1 = Math.max(sx(a.y1 || a.y0), x0 + 5), lw = a.n.length * 6.4 + 12, right = x0 > w - 170, left = right ? x1 - lw : x0;
        let r = 0; while (rows[r] !== undefined && rows[r] > left - 6) r++; rows[r] = Math.max(x1, left + lw); return { a, x0, x1, r, right, cut: (a.y1 || a.y0) > Y1 || a.y0 < Y0 }; });
      const h = Math.max(rows.length, 1) * 24 + 36; svg.setAttribute('viewBox', `0 0 ${w} ${h}`); svg.setAttribute('width', w); svg.setAttribute('height', h);
      let o = ''; const step = (Y1 - Y0) > 900 ? 100 : (Y1 - Y0) > 300 ? 50 : (Y1 - Y0) > 120 ? 25 : 10;
      for (let y = Math.ceil(Y0 / step) * step; y <= Y1; y += step) { const x = sx(y); o += `<line x1="${x}" x2="${x}" y1="0" y2="${h - 22}" stroke="${TG.css('--rule-2')}"/><text x="${x}" y="${h - 6}" fill="${TG.css('--muted')}" font-size="11" text-anchor="middle">${y}</text>`; }
      for (const { a, x0, x1, r, right, cut } of placed) { const y = r * 24 + 8, c = famColor(a.f), sel = cur === a;
        o += `<g class="life" data-i="${AU.indexOf(a)}" tabindex="0" role="button" aria-label="${esc(a.n)}, ${esc(TG.yr(a))}" style="cursor:pointer">
          <rect x="${x0 - 2}" y="${y - 4}" width="${Math.max(x1 - x0, right ? 0 : a.n.length * 6.4 + 10) + 4}" height="24" fill="transparent"/>
          <rect class="bar" x="${x0}" y="${y}" width="${x1 - x0}" height="${sel ? 8 : 6}" rx="3" fill="${a.u ? 'none' : c}" stroke="${a.u ? c : 'none'}" stroke-dasharray="${a.u ? '3 3' : ''}" opacity="${sel ? 1 : 0.82}"/>${cut ? `<path d="M${x1 + 2},${y - 1} l5,4 l-5,4" fill="none" stroke="${c}" stroke-width="1.5"/>` : ''}
          <text x="${right ? x1 : x0}" text-anchor="${right ? 'end' : 'start'}" y="${y + 18}" fill="${sel ? TG.css('--rubric') : TG.css('--ink')}" font-size="11.5" font-weight="${sel ? 600 : 400}">${esc(a.n)}</text></g>`; }
      svg.innerHTML = o;
      svg.querySelectorAll('g.life').forEach((g) => { const a = AU[+g.dataset.i];
        g.addEventListener('click', () => card(a)); g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card(a); } });
        g.addEventListener('mousemove', (e) => { const b = svg.parentElement.getBoundingClientRect(); tip.innerHTML = `${esc(a.n)}<small>${esc(a.d || TG.yr(a))}${a.u ? ' (dates uncertain)' : ''} · ${a.w.length} ${a.w.length === 1 ? 'work' : 'works'} · ${fmt(a.p)} pages</small>`; tip.hidden = false;
          tip.style.left = `${Math.min(e.clientX - b.left + 12, b.width - 200)}px`; tip.style.top = `${e.clientY - b.top + 14}px`; });
        g.addEventListener('mouseleave', () => { tip.hidden = true; }); });
      if (anim && hasG && !reduce) gsap.from(svg.querySelectorAll('rect.bar'), { scaleX: 0, transformOrigin: 'left center', duration: 0.6, ease: 'power3.out', stagger: 0.008 });
    }
    function card(a) {
      cur = a; draw(false);
      pick.innerHTML = `<p class="eyebrow" style="margin:0 0 4px"><i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${famColor(a.f)};margin-right:6px"></i>${esc((fams.find((f) => f[0] === a.f) || [])[1] || '')}</p>
        <h3><a href="${TG.author(a.full || a.n)}" target="_blank" rel="noopener">${esc(a.n)}</a> <span class="small">${esc(a.d || TG.yr(a))}</span></h3>
        ${a.aff ? `<p class="small" style="margin:0 0 6px">${esc(a.aff)}</p>` : ''}${a.sig ? `<p style="margin:0;max-width:52rem">${esc(a.sig)}</p>` : ''}${works(a)}`;
      if (hasG && !reduce) gsap.from(pick.querySelectorAll('.wlist li'), { opacity: 0, y: 6, duration: 0.35, stagger: 0.015, ease: 'power2.out' });
    }
    function refresh(anim) { authors(anim); draw(anim); }
    let it; input.addEventListener('input', () => { clearTimeout(it); it = setTimeout(() => { q = input.value.trim().toLowerCase(); refresh(false); const hit = AU.find((a) => on.has(a.f) && q && match(a) && a.y0); if (hit) card(hit); }, 120); });
    refresh(false); setTab('author', true);
    if (hasG && !reduce) ScrollTrigger.create({ trigger: host, start: 'top 85%', once: true, onEnter: () => authors(true) });
    let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => draw(false), 150); });
    const first = AU.find((a) => a.n === opt.first) || AU.find((a) => a.y0) || AU[0]; if (first) card(first);
    // a click elsewhere on the page (a pane of the rose, a bead, a spine, a card in Who's who) opens that author's fold
    const api = { show(name) { const a = AU.find((x) => x.n === name || x.full === name); if (!a) return;
      if (!on.has(a.f)) { on = new Set(fams.map((f) => f[0])); host.querySelectorAll('.chip[data-f]').forEach((c) => c.setAttribute('aria-pressed', 'true')); }
      if (q) { q = ''; input.value = ''; } refresh(false); setTab('author', true); card(a);
      const d = folds.querySelector(`.fx-who[data-i="${AU.indexOf(a)}"]`); if (!d) return; d.closest('.fx-cent').open = true; d.open = true;
      d.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      if (hasG && !reduce) gsap.fromTo(d, { backgroundColor: 'rgba(160, 124, 53, 0.28)' }, { backgroundColor: 'rgba(160, 124, 53, 0)', duration: 1.6, delay: 0.5, clearProps: 'backgroundColor' }); } };
    TG._open = api.show;
    return api;
  };

  /* ---------- the people in the conversation (owner 10-10: "key name intros … do this for all shelves", "curate the authors that are important,
     keeping in mind each guide introduces people to the conversation"). A curated cast per shelf (common/keys.json, merged into the data
     as D.keys), group by group, each person in order of time with a ruler above them; the intro is the library's own record. ---------- */
  /* ---------- key works (owner 10-10: "we want to show key works for each shelf too"; "motion graphics are so important"): the shelf's
     key books stood on one shelf in the order they were written. Scrolled, they are set on the shelf one by one, each pulled forward with
     its card while it is the one being read about; at the end the whole shelf stands and any book can be taken down. ---------- */
  /* ---------- portraits as engravings (owner 10-10: "motion graphic the authors too, could u draw portraits if possible"): a real likeness
     (a public-domain painting, engraving or icon, common/portraits.json) is redrawn as an engraver's parallel lines whose weight follows the
     darkness of the picture, inside an oval; the lines are cut one after another when the card appears. No likeness is invented: a writer
     without one gets his initials engraved the same way. ---------- */
  TG.engrave = (cv, src, opt = {}) => {
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth || 96, H = cv.clientHeight || 120;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const GW = 72, GH = Math.round(GW * H / W), off = document.createElement('canvas'); off.width = GW; off.height = GH; const o = off.getContext('2d');
    o.fillStyle = '#fff'; o.fillRect(0, 0, GW, GH);
    if (typeof src === 'string') { // initials: set in the display face, then engraved like a picture
      o.fillStyle = '#000'; o.textAlign = 'center'; o.textBaseline = 'middle'; o.font = `${Math.round(GH * 0.42)}px ${TG.css('--display') || 'serif'}`; o.fillText(src, GW / 2, GH * 0.53);
    } else { const r = Math.max(GW / src.naturalWidth, GH / src.naturalHeight), w = src.naturalWidth * r, h = src.naturalHeight * r; o.drawImage(src, (GW - w) / 2, (GH - h) * 0.3, w, h); }
    const px = o.getImageData(0, 0, GW, GH).data, lum = (x, y) => { const i = (Math.min(GH - 1, Math.max(0, y)) * GW + Math.min(GW - 1, Math.max(0, x))) * 4; return (px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11) / 255; };
    // the picture's own range, so a pale engraving and a dark oil come out alike
    let lo = 1, hi = 0; for (let i = 0; i < px.length; i += 16) { const v = (px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11) / 255; lo = Math.min(lo, v); hi = Math.max(hi, v); }
    const norm = (v) => Math.min(1, Math.max(0, (v - lo) / Math.max(0.15, hi - lo)));
    const ink = opt.ink || TG.css('--ink') || '#2d2927', gap = opt.gap || 2.6, rows = Math.floor(H / gap), maxW = gap * 0.92, cx = W / 2, cy = H / 2, rx = W / 2 - 3, ry = H / 2 - 3;
    const inOval = (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
    // one line per row: a band whose half-width follows the darkness under it, with a slight wave and a tilt like a burin's cut
    const lines = []; for (let r = 0; r < rows; r++) { const y0 = (r + 0.5) * gap, top = [], bot = []; let any = false;
      for (let x = 0; x <= W; x += 1.5) { const y = y0 + Math.sin(x * 0.11 + r * 0.7) * 0.35 + (x - cx) * 0.04; if (!inOval(x, y)) { if (top.length) break; continue; }
        const d = 1 - norm(lum(Math.round(x / W * (GW - 1)), Math.round(y / H * (GH - 1)))), t = Math.max(0.12, maxW * d**1.15 / 2); top.push([x, y - t]); bot.push([x, y + t]); any = true; }
      if (any) lines.push({ top, bot }); }
    const frame = () => { g.save(); g.strokeStyle = ink; g.globalAlpha = 0.8; g.lineWidth = 1.1; g.beginPath(); g.ellipse(cx, cy, rx + 1.5, ry + 1.5, 0, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = 0.45; g.lineWidth = 0.6; g.beginPath(); g.ellipse(cx, cy, rx + 3.2, ry + 3.2, 0, 0, Math.PI * 2); g.stroke(); g.restore(); };
    const cut = (L, f) => { const n = Math.max(2, Math.round(L.top.length * f)); g.beginPath(); g.moveTo(L.top[0][0], L.top[0][1]); for (let i = 1; i < n; i++) g.lineTo(L.top[i][0], L.top[i][1]);
      for (let i = n - 1; i >= 0; i--) g.lineTo(L.bot[i][0], L.bot[i][1]); g.closePath(); g.fill(); };
    g.clearRect(0, 0, W, H); g.fillStyle = ink;
    if (reduce || !opt.animate) { lines.forEach((L) => cut(L, 1)); frame(); return; }
    // cut from the top down, each line drawn left to right; the frame is struck first
    const T = opt.duration || 1400, each = 420, t0 = performance.now(); frame();
    const tick = (now) => { const t = now - t0; g.clearRect(0, 0, W, H); frame(); g.fillStyle = ink; let done = true;
      lines.forEach((L, i) => { const start = (i / lines.length) * (T - each), f = Math.min(1, Math.max(0, (t - start) / each)); if (f < 1) done = false; if (f > 0) cut(L, 1 - (1 - f)**3); });
      if (!done) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  };
  TG.portrait = (cv, p, initials, animate) => { // p: {src} from the manifest, or nothing
    if (!p || !p.src) { TG.engrave(cv, initials, { animate }); return; }
    const im = new Image(); im.onload = () => TG.engrave(cv, im, { animate }); im.onerror = () => TG.engrave(cv, initials, { animate });
    im.src = /^(data:|https?:|\/)/.test(p.src) ? p.src : `${(root && root.dataset.assets) || ''}${p.src}`; // the theme gives a path inside the guides' data folder
  };
  TG.keyworks = (D) => {
    if (!root || root.querySelector('#works') || !D.keyworks || !D.keyworks.works.length) return;
    const before = root.querySelector('#explore'); if (!before) return;
    const {esc} = TG, {fmt} = TG, K = D.keyworks.works, fams = D.fam || [], A = D.authors || [];
    const SHELF = { latin: 'Latin Fathers', greek: 'Greek Fathers', medieval: 'Medieval', catholic: 'Roman Catholic', reformed: 'Continental Reformed', lutheran: 'Lutheran', english: 'English Divines' };
    const fam = (w) => { const a = A.concat(D.undated || []).find((x) => x.n === w.a || x.full === w.af); const i = a ? fams.findIndex((f) => f[0] === a.f) : -1; return TG.css(`--f${(i < 0 ? 0 : i) + 1}`) || TG.css('--ink-2'); };
    const sec = document.createElement('section'); sec.className = 'scene gut kw'; sec.id = 'works'; sec.setAttribute('aria-labelledby', 'tg-h-works');
    sec.innerHTML = `<div class="wrap"><div class="kw-head"><p class="eyebrow">Key works</p><h2 id="tg-h-works">The books to know</h2>${D.keyworks.say ? `<p class="say">${esc(D.keyworks.say)}</p>` : ''}</div>
      <div class="kw-stage"><div class="kw-shelf" role="list" aria-label="Key works, in the order they were written"></div><div class="kw-board" aria-hidden="true"></div><div class="kw-years" aria-hidden="true"></div></div>
      <div class="kw-card card" aria-live="polite"></div></div>`;
    const names = root.querySelector('#names'); (names && names.parentNode === before.parentNode ? names : before).insertAdjacentElement(names ? 'afterend' : 'beforebegin', sec);
    const shelf = sec.querySelector('.kw-shelf'), years = sec.querySelector('.kw-years'), card = sec.querySelector('.kw-card');
    const size = (w) => w.p || (w.span ? w.span / 2 : 400), maxP = Math.max(...K.map((w) => size(w) / w.vols));
    // a set of volumes per work: the height follows the pages in a volume, the first spine carries the title
    shelf.innerHTML = K.map((w, i) => { const per = size(w) / w.vols, h = Math.round(130 + 110 * Math.sqrt(per / maxP)), n = Math.min(w.vols, 8), c = fam(w);
      const sp = Array.from({ length: n }, (_, j) => `<span class="kw-sp${j ? '' : ' first'}" style="--h:${h - (j % 3) * 3}px;--c:${c}">${j ? '' : `<b>${esc(w.t)}</b>`}</span>`).join('');
      return `<button type="button" class="kw-set" role="listitem" data-i="${i}" aria-label="${esc(`${w.t}, ${w.a}, ${w.d}`)}"><span class="kw-drop">${sp}${w.vols > 8 ? `<em class="kw-more">+${w.vols - 8}</em>` : ''}</span></button>`; }).join('');
    const sets = [...shelf.children];
    if (TG.pinOK()) sets.forEach((b) => { b.style.opacity = 0; }); // scrolled: the shelf starts empty
    years.innerHTML = K.map((w) => `<span>${esc(String(w.y || ''))}</span>`).join('');
    if (TG.pinOK()) [...years.children].forEach((y) => { y.style.opacity = 0; });
    const yl = [...years.children];
    const place = () => sets.forEach((b, i) => { const r = b.getBoundingClientRect(), s0 = shelf.getBoundingClientRect(); yl[i].style.left = `${r.left - s0.left + r.width / 2}px`; });
    new ResizeObserver(place).observe(shelf);
    const meas = (w) => (w.cols ? w.cols : `${fmt(w.p)} pages${w.vols > 1 ? ` in ${w.vols} volumes` : ''}`);
    let cur = -1, shown = -1;
    const stage = sec.querySelector('.kw-stage');
    function show(i, instant) {
      if (i === cur) return; cur = i; const w = K[i];
      if (w && stage.scrollWidth > stage.clientWidth + 4) { const b = sets[i], to = b.offsetLeft + b.offsetWidth / 2 - stage.clientWidth / 2; stage.scrollTo({ left: Math.max(0, to), behavior: instant || reduce ? 'auto' : 'smooth' }); }
      sets.forEach((b, j) => { b.classList.toggle('now', j === i); b.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
      const por = w && (D.portraits || {})[w.a];
      card.classList.toggle('has-por', !!por);
      card.innerHTML = w ? `${por ? '<canvas class="kw-por" aria-hidden="true"></canvas>' : ''}<p class="kw-d">${esc(w.d)} · <a href="${TG.author(w.af || w.a)}" target="_blank" rel="noopener">${esc(w.a)}</a>${w.from ? ` <span class="small">· on the ${esc(SHELF[w.from] || w.from)} shelf</span>` : ''}</p>
        <h3><a href="${TG.work(w.s)}" target="_blank" rel="noopener">${esc(w.t)}</a>${w.o ? ` <i>${esc(w.o)}</i>` : ''}</h3><p class="kw-note">${esc(w.note)}</p>
        <p class="kw-m"><span>${esc(meas(w))}</span><a href="${TG.work(w.s)}" target="_blank" rel="noopener">Open the work</a><a href="${TG.author(w.af || w.a)}" target="_blank" rel="noopener">The author’s room</a></p>`
        : `<p class="kw-d">${esc(K[0].d)} to ${esc(K[K.length - 1].d)}</p><h3>${K.length} works</h3><p class="kw-note">Choose a book to take it down from the shelf.</p>`;
      if (por) TG.portrait(card.querySelector('.kw-por'), por, '', !instant && !reduce);
      if (hasG && !reduce && !instant) gsap.fromTo(card.children, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.04, ease: 'power2.out', clearProps: 'opacity,transform' });
    }
    // set the first k books on the shelf; a book arrives from above, settles, and the year under it appears
    function upto(k, instant) {
      if (k === shown) return; const prev = shown; shown = k;
      sets.forEach((b, j) => { const on = j <= k; if (prev >= 0 && on === (j <= prev) && !instant) return;
        // the set fades; its inner row (.kw-drop) falls, so the drop never fights the pull forward on the button. A book still falling
        // when the reader scrolls back stops: left running, its bounce outlived the fade and left the book standing.
        const row = b.firstElementChild;
        if (hasG) gsap.killTweensOf([b, row]);
        if (hasG && !reduce && !instant) {
          if (on) { gsap.to(b, { opacity: 1, duration: 0.2 }); gsap.fromTo(row, { y: -60 }, { y: 0, duration: 0.55, ease: 'bounce.out', clearProps: 'transform' }); }
          else { gsap.set(row, { clearProps: 'transform' }); gsap.to(b, { opacity: 0, duration: 0.2 }); }
        } else { if (hasG) gsap.set(row, { clearProps: 'transform' }); b.style.opacity = on ? 1 : 0; }
        yl[j].style.opacity = on ? 1 : 0; });
    }
    sets.forEach((b, i) => b.addEventListener('click', () => { if (+b.style.opacity === 0) return; show(i); }));
    const st = TG.chapter('#works', Math.max(1600, K.length * 260), (p, fin) => {
      if (fin) { upto(K.length - 1, true); show(0, true); return; }
      const k = Math.min(K.length - 1, Math.floor(p * K.length * 1.08)); upto(k); show(k);
    }, { scrub: true });
    if (!st) { upto(K.length - 1, true); show(0, true); }
    requestAnimationFrame(place);
  };
  TG.keynames = (D) => {
    if (!root || root.querySelector('#names') || !D.keys || !D.keys.length) return;
    const before = root.querySelector('#explore'); if (!before) return;
    const {esc} = TG, {fmt} = TG, fams = D.fam || [], famColor = (k) => TG.css(`--f${Math.max(0, fams.findIndex((f) => f[0] === k)) + 1}`);
    const A = D.authors || [], find = (n) => A.find((a) => a.n === n || a.full === n);
    // start with the writer's key work on this shelf when there is one, else his largest
    const keyw = (a) => { const k = ((D.keyworks || {}).works || []).find((w) => w.a === a.n || (a.full && w.af === a.full)); return k ? { t: k.t, href: TG.read(k.s) } : null; };
    const largest = (a) => { const kw = keyw(a); if (kw) return kw; if (a.w && a.w.length) { const w = a.w.slice().sort((x, y) => (y[2] || 0) - (x[2] || 0))[0]; return { t: w[0], href: TG.read(w[1], w[3]) }; }
      if (D.works) { const i = A.indexOf(a), ws = D.works.filter((w) => w[5] === i); if (ws.length) { const w = ws.sort((x, y) => ((y[4] || 0) - (y[3] || 0)) - ((x[4] || 0) - (x[3] || 0)))[0]; return { t: w[0], href: TG.read(w[1], w[3]) }; } } return null; };
    const nworks = (a) => (a.w && a.w.length) || a.nw || (D.works ? D.works.filter((w) => w[5] === A.indexOf(a)).length : 0);
    // whole sentences only: a record cut short upstream must not end mid-word
    const brief = (t, n = 300) => { if (!t) return ''; const ss = t.match(/[^.!?]+[.!?]+["”’)]?(\s|$)/g) || []; let o = ''; for (const x of ss) { if ((o + x).length > n && o) break; o += x; }
      if (!o) { const cut = t.slice(0, n); o = `${cut.slice(0, cut.lastIndexOf(' '))}…`; } return o.trim(); };
    // a name is {n, as (display), note, a (a record borrowed from another shelf)}; each group reads in order of time
    const groups = D.keys.map((g) => ({ ...g, people: g.names.map((e) => { const a = e.a || find(e.n); return a ? { ...a, sig: e.sig || a.sig || e.bio || '', kn: e.as || a.n, knote: e.note || '', cross: !!e.a } : null; })
      .filter(Boolean).sort((x, y) => (x.y0 || 9999) - (y.y0 || 9999)) })).filter((g) => g.people.length);
    groups.forEach((g) => { const home = g.people.filter((p) => !p.cross).map((p) => p.f); const f = home.sort((a, b) => home.filter((x) => x === b).length - home.filter((x) => x === a).length)[0];
      g.people.forEach((p) => { if (p.cross) p.f = f; }); }); // a writer borrowed from another shelf takes his group's color
    if (!groups.length) return;
    const sec = document.createElement('section'); sec.className = 'tool gut'; sec.id = 'names'; sec.setAttribute('aria-labelledby', 'tg-h-names');
    sec.innerHTML = `<div class="wrap"><p class="eyebrow">Who’s who</p><h2 id="tg-h-names">The people in the conversation</h2>
      <p class="say" style="max-width:46rem">${esc(D.keys_say || 'Where to begin on this shelf: the writers the others read, answered and argued with. Each group runs in the order they wrote.')}</p>
      <div class="kn-tabs" role="tablist" aria-label="Groups on this shelf">${groups.map((g, i) => `<button type="button" role="tab" aria-selected="${i ? 'false' : 'true'}" data-i="${i}">${esc(g.label)}</button>`).join('')}</div>
      <p class="kn-say" aria-live="polite"></p><svg class="kn-ruler" aria-hidden="true"></svg><div class="kn-grid"></div></div>`;
    before.parentNode.insertBefore(sec, before);
    const tabs = [...sec.querySelectorAll('.kn-tabs button')], say = sec.querySelector('.kn-say'), grid = sec.querySelector('.kn-grid'), ruler = sec.querySelector('.kn-ruler');
    let cur = -1;
    function drawRuler(g) {
      const P = g.people.filter((a) => a.y0), W = Math.max(320, ruler.clientWidth || grid.clientWidth), lo = Math.min(...P.map((a) => a.y0)), hi = Math.max(...P.map((a) => a.y1 || a.y0));
      const pad = Math.max(10, (hi - lo) * 0.06), Y0 = lo - pad, Y1 = hi + pad, sx = (y) => 8 + (y - Y0) / (Y1 - Y0) * (W - 16), rows = [];
      const placed = P.map((a) => { const x0 = sx(a.y0), x1 = Math.max(sx(a.y1 || a.y0), x0 + 4), lw = a.kn.replace(/ \(.*\)$/, '').length * 6.2 + 10; let r = 0; while (rows[r] !== undefined && rows[r] > x0 - 6) r++; rows[r] = Math.max(x1, x0 + lw); return { a, x0, x1, r }; });
      const H = rows.length * 22 + 24, step = (Y1 - Y0) > 600 ? 100 : (Y1 - Y0) > 250 ? 50 : 25;
      let o = ''; for (let y = Math.ceil(Y0 / step) * step; y <= Y1; y += step) o += `<line x1="${sx(y)}" x2="${sx(y)}" y1="0" y2="${H - 16}" stroke="${TG.css('--rule-2')}"/><text x="${sx(y)}" y="${H - 3}" font-size="10.5" fill="${TG.css('--muted')}" text-anchor="middle">${y}</text>`;
      o += placed.map(({ a, x0, x1, r }) => `<g data-n="${esc(a.n)}"><rect class="kn-bar" x="${x0}" y="${r * 22 + 4}" width="${x1 - x0}" height="5" rx="2.5" fill="${a.u ? 'none' : famColor(a.f)}" stroke="${famColor(a.f)}" stroke-dasharray="${a.u ? '3 3' : ''}"/><text x="${x0}" y="${r * 22 + 19}" font-size="11.5" fill="${TG.css('--ink')}">${esc(a.kn.replace(/ \(.*\)$/, ''))}</text></g>`).join('');
      ruler.setAttribute('viewBox', `0 0 ${W} ${H}`); ruler.setAttribute('height', H); ruler.innerHTML = o;
      if (hasG && !reduce) gsap.from(ruler.querySelectorAll('.kn-bar'), { scaleX: 0, transformOrigin: 'left center', duration: 0.7, stagger: 0.06, ease: 'power3.out' });
    }
    function card(a) {
      const w = largest(a), n = nworks(a);
      const por = (D.portraits || {})[a.n], pdate = por && por.date && /^\D*\d{3,4}/.test(por.date) && !/^\s*(19|20)\d\d-\d\d-\d\d/.test(por.date) && +(por.date.match(/\d{3,4}/) || [9999])[0] < 1900 ? por.date : '';
      const cap = por ? [por.kind && por.kind !== 'other' ? por.kind : 'likeness', por.artist, pdate].filter(Boolean).join(', ') : '';
      return `<article class="kn-card" data-n="${esc(a.n)}"><div class="kn-top"><figure class="kn-por"${cap ? ` title="${esc(cap)}"` : ''}><canvas aria-hidden="true"></canvas>${cap ? `<figcaption class="sr">${esc(`Portrait: ${cap}`)}</figcaption>` : ''}</figure><div><p class="kn-d">${esc(a.d || TG.yr(a))}${a.u ? ' <span class="small">(uncertain)</span>' : ''}</p>
        <h3><a href="${TG.author(a.full || a.n)}" target="_blank" rel="noopener">${esc(a.kn)}</a></h3>${a.knote ? `<p class="kn-note">${esc(a.knote)}</p>` : ''}</div></div>${a.aff ? `<p class="kn-aff">${esc(brief(a.aff, 120))}</p>` : ''}
        ${a.sig ? `<p class="kn-sig">${esc(brief(a.sig.replace(/\*([^*]+)\*/g, '\u2063$1\u2064'))).replace(/\u2063([^\u2064]*)\u2064/g, '<i>$1</i>')}</p>` : ''}
        <p class="kn-go">${w ? `<a href="${w.href}" target="_blank" rel="noopener">Start with <i>${esc(w.t)}</i></a>` : ''}${n > 1 ? `<a class="kn-all" href="${TG.author(a.full || a.n)}" target="_blank" rel="noopener">All ${fmt(n)} works</a>` : ''}</p></article>`;
    }
    function show(i, first) {
      if (i === cur) return; const prev = cur; cur = i; const g = groups[i];
      tabs.forEach((t, j) => t.setAttribute('aria-selected', j === i ? 'true' : 'false'));
      const fill = () => {
        const g = groups[cur];
        say.textContent = g.say || ''; grid.innerHTML = g.people.map(card).join(''); drawRuler(g);
        // each likeness is engraved as its card arrives, one after another
        const ini = (n) => { const w = n.replace(/\s*\(.*\)$/, '').split(/[\s,]+/).filter((x) => /^[A-ZÀ-Ý]/.test(x)); return (w.length > 1 ? w[0][0] + w[w.length - 1][0] : (w[0] || '?').slice(0, 2)).toUpperCase(); };
        grid.querySelectorAll('.kn-card').forEach((c, j) => { const a = g.people[j], cv = c.querySelector('.kn-por canvas'); if (!cv) return;
          setTimeout(() => TG.portrait(cv, (D.portraits || {})[a.n], ini(a.kn), !reduce), hasG && !reduce ? 120 + j * 110 : 0); });
        grid.querySelectorAll('.kn-card').forEach((c) => { const hl = (on) => { const r = ruler.querySelector(`g[data-n="${CSS.escape(c.dataset.n)}"] .kn-bar`); if (r) r.style.opacity = on ? 1 : ''; ruler.classList.toggle('dim', on); if (r) r.parentNode.classList.toggle('on', on); };
          c.addEventListener('mouseenter', () => hl(true)); c.addEventListener('mouseleave', () => hl(false)); });
        if (hasG && !reduce) gsap.fromTo(grid.children, { opacity: 0, y: 18, rotateX: -12 }, { opacity: 1, y: 0, rotateX: 0, duration: 0.55, stagger: 0.06, ease: 'power3.out', transformPerspective: 900, clearProps: 'transform' });
      };
      if (hasG && !reduce && prev >= 0) gsap.to(grid.children, { opacity: 0, y: -10, duration: 0.18, stagger: 0.02, onComplete: fill }); else fill();
    }
    let chosen = false;
    tabs.forEach((t) => { t.onclick = () => { chosen = true; show(+t.dataset.i); }; });
    if (hasG && !reduce) ScrollTrigger.create({ trigger: sec, start: 'top 80%', once: true, onEnter() { if (chosen) return; cur = -1; show(0, true); } });
    show(0, true);
    let rt; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => cur >= 0 && drawRuler(groups[cur]), 150); }).observe(grid);
    if (hasG) ScrollTrigger.refresh();
  };
  return TG;
})();
