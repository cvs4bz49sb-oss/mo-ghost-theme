/*
 * The Traditions index, reworked (the owner, 2026-10-11: "do a separate pr and rework, the list is too sparse").
 *
 * On /the-faith-received/traditions/ faith-tradition.js renders the index as a list into [data-trad-root]. This file draws, above it,
 *   - the family tree: every tradition as a line from the year it begins, branching from the one it came out of, swept in from
 *     the first century to the present when it comes into view; a line is a link to its tradition below;
 *   - a card for each tradition: its era and counts, its opening, the people to meet first (portraits from the guides' set, each
 *     a link to the author's room), its key documents, and the ways in (the tradition's page, its guides, its works).
 * The list stays in the page, hidden: its counts (documents arrive later) are read from it as they come. If anything here fails,
 * the list is shown as before. Data: traditions.json (the site's own), traditions-index.json (people, documents, guides, tree).
 * Text from the data goes through esc() before it reaches innerHTML.
 */
(() => {
  if (!/\/traditions\/?$/.test(location.pathname)) return;
  const root = document.querySelector("[data-trad-root]");
  if (!root) return;
  const url = (p) => (window.moDataUrl ? window.moDataUrl(p) : (window.moAssetUrl ? window.moAssetUrl(p) : p));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const BASE = "/the-faith-received/";
  const tradHref = (s) => `${BASE}tradition/?t=${encodeURIComponent(s)}`;
  const PORTRAITS = "/assets/data/faith-received/guides/";
  // the colors of the families: the early church and the East in gilt, the Latin West in red, the Reformation's churches in their own
  const COLOR = {
    "the-whole-church": "#a07c35", "eastern-orthodox": "#b8892f", "medieval-church": "#9b2c2c", "roman-catholic": "#7f1d1d",
    protestant: "#2f4a6b", waldensian: "#6b7f99", "bohemian-brethren": "#6b7f99", lutheran: "#24476b", reformed: "#2e6e6a",
    anabaptist: "#7a8a6a", anglican: "#6d4c7d", presbyterian: "#3f6b4a", congregational: "#5b6b3a", baptist: "#4f6b3a",
    arminian: "#8a6a2a", quaker: "#8a7f74", methodist: "#b2652a",
  };
  const firstSentences = (t, n = 260) => {
    const ss = String(t || "").match(/[^.!?]+[.!?]+["”’)]?(\s|$)/g) || [];
    let o = ""; for (const x of ss) { if ((o + x).length > n && o) break; o += x; }
    return o.trim() || String(t || "").slice(0, n);
  };
  const initials = (n) => { const w = String(n).split(/\s+/).filter((x) => /^[A-ZÀ-Ý]/.test(x)); return ((w[0] || "?")[0] + (w.length > 1 ? w[w.length - 1][0] : "")).toUpperCase(); };

  const CSS = `
.tix { --ink: #2d2927; --muted: #6b6660; --rule: #d9c6a7; --card: #fffdfa; --accent: #c1593c; color: var(--ink); font-family: "Source Serif Pro", Georgia, serif; }
.tix-band { padding-block: 56px 8px; }
.tix-eyebrow { font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--accent); margin: 0 0 8px; }
.tix h2 { font-size: clamp(1.7rem, 3.4vw, 2.5rem); line-height: 1.12; margin: 0 0 10px; font-weight: 400; text-wrap: balance; }
.tix-say { max-width: 46rem; color: var(--muted); margin: 0 0 22px; font-size: 1.02rem; line-height: 1.6; }
.tix-tree { position: relative; overflow-x: auto; border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); padding-block: 14px 6px; }
.tix-tree svg { display: block; min-width: 720px; width: 100%; height: auto; overflow: visible; }
.tix-tree .ax { font-size: 11px; fill: var(--muted); font-variant-numeric: tabular-nums; }
.tix-tree .grid { stroke: var(--rule); stroke-width: 1; }
.tix-tree .ln { fill: none; stroke-linecap: round; }
.tix-tree .br { fill: none; stroke-width: 1.4; opacity: 0.8; }
.tix-tree .lb { font-size: 13px; fill: var(--ink); transition: opacity 0.5s; }
.tix-tree .lb.off { opacity: 0; }
.tix-tree a:hover .lb, .tix-tree a:focus .lb { fill: var(--accent); text-decoration: underline; }
.tix-tree a:focus { outline: none; }
.tix-tree a:focus-visible .lb { outline: 2px solid var(--accent); }
.tix-tree .now { stroke: var(--accent); stroke-width: 1; stroke-dasharray: 3 4; }
.tix-tree .yr { font-size: 22px; fill: var(--accent); font-variant-numeric: tabular-nums; }
.tix-cards { display: grid; gap: 18px; padding-block: 28px 64px; }
.tix-card { background: var(--card); border: 1px solid var(--rule); border-radius: 3px; padding: 22px 24px 20px; display: grid; gap: 12px; scroll-margin-top: 120px;
  opacity: 0; transform: translateY(14px); transition: opacity 0.6s ease, transform 0.6s ease; }
.tix-card.in { opacity: 1; transform: none; }
.tix-card .tix-era { margin: 0; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); }
.tix-card .tix-era i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 8px; vertical-align: -1px; }
.tix-card h3 { margin: 2px 0 0; font-size: 1.65rem; font-weight: 400; line-height: 1.15; }
.tix-card h3 a { color: inherit; text-decoration: none; } .tix-card h3 a:hover { color: var(--accent); }
.tix-card .tix-dek { margin: 4px 0 0; color: var(--muted); font-style: italic; }
.tix-card .tix-ov { margin: 0; max-width: 62ch; line-height: 1.6; }
.tix-faces { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 14px 18px; }
.tix-faces li { width: 86px; text-align: center; opacity: 0; transform: translateY(8px); transition: opacity 0.45s ease, transform 0.45s ease; }
.tix-card.in .tix-faces li { opacity: 1; transform: none; }
.tix-faces a { color: inherit; text-decoration: none; display: grid; justify-items: center; gap: 6px; }
.tix-faces .pic { --por-ground: var(--card); --por-rule: var(--rule); --por-ink: var(--muted); --por-accent: var(--accent); }
.tix-faces .nm { font-size: 0.82rem; line-height: 1.2; }
.tix-faces .dt { display: block; font-size: 0.7rem; color: var(--muted); font-variant-numeric: tabular-nums; }
.tix-faces a:hover .nm { color: var(--accent); text-decoration: underline; }
.tix-docs { display: flex; flex-wrap: wrap; gap: 6px 16px; align-items: baseline; margin: 0; font-size: 0.95rem; }
.tix-l { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); }
.tix-docs a { color: var(--ink); text-decoration-color: var(--rule); text-underline-offset: 3px; } .tix-docs a:hover { color: var(--accent); }
.tix-docs small { color: var(--muted); margin-left: 4px; font-variant-numeric: tabular-nums; }
.tix-go { display: flex; flex-wrap: wrap; gap: 8px 10px; margin: 6px 0 0; padding-top: 12px; border-top: 1px solid var(--rule); }
.tix-go a { font-size: 13px; letter-spacing: 0.06em; padding: 8px 14px; border: 1px solid var(--accent); border-radius: 3px; color: var(--accent); text-decoration: none; }
.tix-go a:hover, .tix-go a:focus-visible { background: var(--accent); color: #fff; }
.tix-go a.main { background: var(--accent); color: #fff; }
.tix-sub { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 420px), 1fr)); margin-top: 6px; }
.tix-sub .tix-card { padding: 18px 18px 16px; } .tix-sub .tix-card h3 { font-size: 1.35rem; }
.tix-subhead { margin: 10px 0 0; font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--muted); }
@media (max-width: 640px) { .tix-card { padding: 18px 16px; } .tix-faces li { width: 74px; } }
@media (prefers-reduced-motion: reduce) { .tix-card, .tix-faces li { opacity: 1; transform: none; transition: none; } }`;

  function tree(list, X, host) {
    const NS = "http://www.w3.org/2000/svg";
    const mk = (tag, at, parent) => { const e = document.createElementNS(NS, tag); Object.entries(at).forEach(([k, v]) => e.setAttribute(k, v)); (parent || svg).appendChild(e); return e; };
    const rows = list.filter((t) => X[t.slug]);
    // the names in a column of their own, so no branch crosses one; the years open out where the churches multiply (1450-1800)
    const W = 1100, RH = 28, top = 64, H = top + rows.length * RH + 30, LBL = 188, L = LBL + 14, R = 18, Y1 = 2030;
    const DOM = [30, 1000, 1450, 1800, Y1], FR = [0, 0.27, 0.45, 0.9, 1];
    const x = (y) => { let i = 0; while (i < DOM.length - 2 && y > DOM[i + 1]) i++; const f = FR[i] + (FR[i + 1] - FR[i]) * (Math.max(DOM[0], Math.min(Y1, y)) - DOM[i]) / (DOM[i + 1] - DOM[i]); return L + f * (W - L - R); };
    const yOf = new Map(rows.map((t, i) => [t.slug, top + i * RH + RH / 2]));
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "The family tree of the traditions: each a line from the year it begins, branching from the tradition it came out of");
    host.appendChild(svg);
    for (let y = 100; y <= 2000; y += 100) {
      const major = [100, 500, 1000, 1500, 1600, 1700, 1800, 2000].includes(y);
      mk("line", { class: "grid", x1: x(y), y1: top - 8, x2: x(y), y2: H - 26, opacity: major ? 0.9 : 0.35 });
      if (major || y === 1400) { const t = mk("text", { class: "ax", x: x(y), y: H - 10, "text-anchor": "middle" }); t.textContent = y === 100 ? "AD 100" : String(y); }
    }
    const defs = mk("defs", {}); const cp = mk("clipPath", { id: "tix-clip" }, defs); const clip = mk("rect", { x: 0, y: 0, width: reduce ? W : L, height: H }, cp);
    const g = mk("g", { "clip-path": "url(#tix-clip)" });
    const labels = [];
    rows.forEach((t) => {
      const d = X[t.slug], y = yOf.get(t.slug), c = COLOR[t.slug] || "#6b6660", n = (d.people || []).length;
      const a = document.createElementNS(NS, "a"); a.setAttribute("href", `#tix-${t.slug}`); g.appendChild(a);
      const tt = mk("title", {}, a); tt.textContent = `${t.name}: ${t.era || `from ${d.start}`}`;
      if (d.parent && yOf.has(d.parent)) {
        const py = yOf.get(d.parent), bx = x(d.start);
        mk("path", { class: "br", d: `M${bx - 18},${py} C${bx - 4},${py} ${bx - 10},${y} ${bx + 4},${y}`, stroke: c }, a);
      }
      mk("line", { class: "ln", x1: x(d.start), y1: y, x2: x(d.end), y2: y, stroke: c, "stroke-width": 3 + Math.min(4, n * 0.5) }, a);
      mk("line", { x1: x(d.start), y1: y - 12, x2: x(d.end), y2: y - 12, stroke: "transparent", "stroke-width": 24 }, a);
      // the name in the left column, and a dotted lead from it to where the line begins
      mk("line", { x1: LBL + 4, y1: y, x2: x(d.start) - 4, y2: y, stroke: "#d9c6a7", "stroke-width": 1, "stroke-dasharray": "1 4" }, a);
      const lb = mk("text", { class: `lb${reduce ? "" : " off"}`, x: LBL, y: y + 4, "text-anchor": "end" }, a);
      lb.textContent = t.name;
      labels.push([d.start, lb]);
    });
    // a few dated landmarks above the lines, on two levels so that neighbors do not touch
    [[325, "Nicaea"], [451, "Chalcedon"], [1054, "East and West part"], [1517, "Luther’s theses"], [1563, "Trent closes"], [1646, "Westminster Confession"]].forEach(([y, t], i) => {
      const xx = x(y), ly = top - 12 - (i % 2) * 13;
      mk("line", { class: "grid", x1: xx, y1: ly + 3, x2: xx, y2: top - 6, opacity: 0.9 });
      const e = mk("text", { class: "ax", x: xx, y: ly, "text-anchor": "middle" }); e.textContent = `${y} ${t}`;
    });
    const now = mk("line", { class: "now", x1: L, y1: top - 14, x2: L, y2: H - 26, opacity: reduce ? 0 : 1 });
    const yr = mk("text", { class: "yr", x: W - 4, y: 26, "text-anchor": "end" }); yr.textContent = reduce ? "" : "AD 30";
    if (reduce) return;
    // the sweep: one rule moves from the first century to the present; each line shows as far as it has come
    let done = false;
    const run = () => {
      if (done) return; done = true;
      const T = 5200, t0 = performance.now(), ease = (k) => 1 - (1 - k)**2.2;
      const step = (ts) => {
        const k = Math.min(1, (ts - t0) / T), year = 30 + ease(k) * (Y1 - 30), xx = x(year);
        clip.setAttribute("width", xx + 2); now.setAttribute("x1", xx); now.setAttribute("x2", xx);
        yr.textContent = year < 1999 ? `AD ${Math.round(year)}` : "";
        labels.forEach(([s, lb]) => { if (s <= year + 8) lb.classList.remove("off"); });
        if (k < 1) requestAnimationFrame(step); else { now.setAttribute("opacity", 0); clip.setAttribute("width", W); }
      };
      requestAnimationFrame(step);
    };
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); run(); } }, { threshold: 0.35 });
      io.observe(svg);
    } else run();
  }

  function card(t, d, meta) {
    const people = (d.people || []).map((p, i) => `<li style="transition-delay:${120 + i * 70}ms"><a href="${BASE}author/?a=${encodeURIComponent(p.n)}">`
      + `<span class="pic tfr-por tfr-por--s">${p.src ? `<img src="${esc(PORTRAITS + p.src)}" alt="Portrait of ${esc(p.show)}" width="56" height="56" loading="lazy" decoding="async" data-por="${esc(String(p.src).replace(/^.*\//, "").replace(/\.jpg.*$/, ""))}" data-por-name="${esc(p.show)}">` : `<span class="tfr-por-ini" aria-hidden="true">${esc(initials(p.show))}</span>`}</span>`
      + `<span class="nm">${esc(p.show)}${p.d ? `<span class="dt">${esc(p.d)}</span>` : ""}</span></a></li>`).join("");
    const docs = (d.docs || []).map(([s, title, y]) => `<a href="${BASE}read/?w=${encodeURIComponent(s)}">${esc(title)}</a>${y ? `<small>${esc(y)}</small>` : ""}`).join("");
    const all = t.allWorks && t.allWorks.q ? `${BASE}all-works/?collection=all&${t.allWorks.q}` : "";
    const go = [`<a class="main" href="${tradHref(t.slug)}">The tradition</a>`]
      .concat((d.guides || []).map(([k, nm]) => `<a href="${BASE}guide/?s=${encodeURIComponent(k)}">Guide to ${esc(nm)}</a>`))
      .concat(all ? [`<a href="${esc(all)}">Its works</a>`] : []).join("");
    return `<article class="tix-card" id="tix-${esc(t.slug)}"><div><p class="tix-era" data-tix-meta="${esc(t.slug)}"><i style="background:${COLOR[t.slug] || "#6b6660"}"></i>${esc(meta || t.era || "")}</p>`
      + `<h3><a href="${tradHref(t.slug)}">${esc(t.name)}</a></h3><p class="tix-dek">${esc(t.dek)}</p></div>${
       (t.overview || []).length ? `<p class="tix-ov">${esc(firstSentences(t.overview[0]))}</p>` : ""
       }${people ? `<ul class="tix-faces" aria-label="People to meet first">${people}</ul>` : ""
       }${docs ? `<p class="tix-docs"><span class="tix-l">Key documents</span>${docs}</p>` : ""
       }<p class="tix-go">${go}</p></article>`;
  }

  // the counts the list shows (an era, documents once they load, authors), read from it as it renders
  const metaOf = () => {
    const m = new Map();
    root.querySelectorAll("a.tfr-trad-ix").forEach((a) => {
      const s = new URL(a.href, location.href).searchParams.get("t"); const t = a.querySelector(".tfr-trad-ixm");
      if (s && t) m.set(s, t.textContent.trim());
    });
    return m;
  };

  Promise.all([fetch(url("/assets/data/faith-received/traditions.json")).then((r) => r.json()),
    fetch(url("/assets/data/faith-received/traditions-index.json")).then((r) => r.json())]).then(([T, I]) => {
    const list = (T.traditions || []).filter((t) => t.showInIndex !== false);
    const X = I.traditions || {};
    const meta = metaOf();
    if (!document.getElementById("tix-css")) { const st = document.createElement("style"); st.id = "tix-css"; st.textContent = CSS; document.head.appendChild(st); }
    const sec = document.createElement("section"); sec.className = "tix container";
    const top = list.filter((t) => !t.parent);
    const kids = (p) => list.filter((k) => k.parent === p.slug);
    sec.innerHTML = `<div class="tix-band"><p class="tix-eyebrow">The family tree</p><h2>Two thousand years of the church</h2>`
      + `<p class="tix-say">Each line is a tradition from the year it begins. A branch shows the church it came out of. Choose a line to read about that tradition below.</p>`
      + `<div class="tix-tree"></div></div>`
      + `<div class="tix-band" style="padding-block:40px 0"><p class="tix-eyebrow">The traditions</p><h2>The churches and the people to meet first</h2>`
      + `<p class="tix-say">For each tradition: where it begins, the writers to read first, its confessions, and the guides and pages that open it.</p></div>`
      + `<div class="tix-cards">${top.map((t) => {
        const ks = kids(t);
        return card(t, X[t.slug] || {}, meta.get(t.slug))
          + (ks.length ? `<p class="tix-subhead">The churches of the ${esc(t.name === "Protestant" ? "Reformation" : t.name)}</p><div class="tix-sub">${ks.map((k) => card(k, X[k.slug] || {}, meta.get(k.slug))).join("")}</div>` : "");
      }).join("")}</div>`;
    root.parentNode.insertBefore(sec, root);
    tree(list, X, sec.querySelector(".tix-tree"));
    root.hidden = true;
    // the counts follow the list as it fills in
    new MutationObserver(() => { metaOf().forEach((v, s) => { const el = sec.querySelector(`[data-tix-meta="${window.CSS && window.CSS.escape ? window.CSS.escape(s) : s}"]`); if (el && el.lastChild && el.lastChild.nodeType === 3) el.lastChild.textContent = v; }); })
      .observe(root, { childList: true, subtree: true, characterData: true });
    // the cards rise as they come into view
    const cards = [...sec.querySelectorAll(".tix-card")];
    if (reduce || !("IntersectionObserver" in window)) cards.forEach((c) => c.classList.add("in"));
    else { const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" }); cards.forEach((c) => io.observe(c)); }
  }).catch(() => { root.hidden = false; });
})();
