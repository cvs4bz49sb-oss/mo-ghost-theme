/* One work, one set of sections (owner 2026-10-06: "there should be coherence on what's in the research rail and the
 * work desk"; "the work thing should have it all").
 *
 * The work page (author/#w/<slug>) shows every section of a work under one tab strip; the reader's Research rail shows
 * the same sections, in the same order and under the same names, as folds that end in a link to that tab. This file
 * holds what both share: the section list, the guide renderers fed by v1/enrich/works/<slug>.json (machine-written
 * library notes, every page reference checked against the work), and the links between the two places.
 *
 * Routes are configurable (FRWorkHub.config) so the Vercel research shell can use the same file with its own paths.
 */
(function (root) {
  "use strict";

  const SECTIONS = [
    { id: "overview", label: "Overview" },
    { id: "argument", label: "The argument" },
    { id: "sections", label: "Sections" },
    { id: "index", label: "Subject index" },
    { id: "terms", label: "Terms defined" },
    { id: "questions", label: "Questions asked" },
    { id: "quotes", label: "Quotations" },
    { id: "citedby", label: "Read later by" },
    { id: "scripture", label: "Scripture" },
    { id: "topics", label: "Topics" },
    { id: "positions", label: "Positions" },
    { id: "sources", label: "Sources cited" },
    { id: "names", label: "Names" },
    { id: "historical", label: "Historical subject index" },
  ];
  const GUIDE = ["overview", "argument", "sections", "index", "quotes"];
  const label = (id) => (SECTIONS.find((s) => s.id === id) || { label: id }).label;
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const cfg = {
    base: () => root.__FR_BLOB_BASE__ || "https://mo-tfr-library.mo-podcast-feed.workers.dev",
    deskHref: (slug, id) => `/the-faith-received/author/#w/${encodeURIComponent(slug)}${id && id !== "overview" ? "/" + id : ""}`,
    readerHref: (slug, page) => `/the-faith-received/read/?w=${encodeURIComponent(slug)}${page != null && page !== "" ? `#b${encodeURIComponent(page)}-0` : ""}`,
    setIndexHref: (id) => `/the-faith-received/set-index/?set=${encodeURIComponent(id)}`,
  };
  function config(over) { Object.assign(cfg, over || {}); }

  const getJSON = (url) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const cache = new Map();
  // The guide and, when it has section notes, the work's own contents (the notes are keyed by contents entry).
  function guide(slug) {
    if (!cache.has(slug)) {
      cache.set(slug, (async () => {
        const base = cfg.base();
        let d = await getJSON(`${base}/v1/enrich/works/${encodeURIComponent(slug)}.json`);
        // EVERY INDEXED WORK HAS ITS SUBJECT INDEX (2026-10-20, owner: "why … 9k vs 16k?"): the guide files (9,075 works) carry the
        // subject index, but the whole index (v1/enrich/index, 16,604 works) has it for every mined work; a work without a guide, or
        // a guide without an index, takes the subjects from there.
        if (!(d && Array.isArray(d.index) && d.index.length)) {
          const all = await fullIndex(slug);
          if (all && Array.isArray(all.subjects) && all.subjects.length) d = Object.assign({}, d || {}, { index: all.subjects });
        }
        if (!d) return null;
        const meta = d.sections && Object.keys(d.sections).length ? await getJSON(`${base}/v1/works/${encodeURIComponent(slug)}/meta.json`) : null;
        return Object.assign({}, d, { structure: (meta && meta.structure) || null });
      })());
    }
    return cache.get(slug);
  }

  // What each guide section holds, so a strip or a rail shows only the sections a work has.
  function counts(d) {
    if (!d) return {};
    const secs = sectionRows(d).length;
    return {
      overview: ((d.about && (d.about.blurb || d.about.summary)) || (d.start && d.start.length)) ? 1 : 0,
      argument: (d.argument && Array.isArray(d.argument.map) && d.argument.map.length) || 0,
      sections: secs,
      index: (Array.isArray(d.index) && d.index.length) || 0,
      quotes: (Array.isArray(d.quotes) && d.quotes.length) || 0,
    };
  }

  // A page reference: a button the host wires (the rail turns the page in place; the work page opens a preview).
  const page = (p, text) => `<button type="button" class="wh-page" data-page="${esc(p)}">${esc(text || `p. ${p}`)}</button>`;
  const pagesOf = (refs, max) => {
    const ps = (refs || []).slice(0, max || 8);
    return ps.length ? `<span class="wh-pp">${ps.length > 1 ? "pp." : "p."} ${ps.map((r) => page(r.p != null ? r.p : r, String(r.p != null ? r.p : r))).join(", ")}</span>` : "";
  };

  // A contents title without the printed Latin echo after " — " when that half is in capitals ("Objection XIII. —
  // OBIECTUM XIII."); a title whose second half is ordinary words keeps it.
  function cleanTitle(t) {
    const s = String(t || "").trim(), i = s.indexOf(" — ");
    if (i < 1) return s;
    const tail = s.slice(i + 3), letters = tail.replace(/[^A-Za-zÀ-ÿ]/g, "");
    return letters.length >= 3 && letters === letters.toUpperCase() ? s.slice(0, i).replace(/[.,;:]\s*$/, "") : s;
  }

  // The contents entry a page falls under ("p. 20 · Prefatory Address"), when the work's contents came with the guide.
  function where(d, p) {
    if (!Array.isArray(d.structure)) return "";
    const n = Number(String(p).replace(/^0+(?=\d)/, ""));
    let hit = null;
    for (const e of d.structure) {
      const q = e && Number(String(e.page).replace(/^0+(?=\d)/, ""));
      if (!Number.isFinite(q) || q > n) continue;
      if (!hit || q >= hit.q) hit = { q, t: e.title };
    }
    return hit && hit.t ? cleanTitle(hit.t) : "";
  }

  function overview(d, opt) {
    const a = d.about || {};
    const facts = [a.genre, a.date, a.place].filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join("");
    const start = (d.start || []).map((s, i) => {
      const at = where(d, s.page);
      return `<li><span class="wh-n">${i + 1}</span><div>${page(s.page, at ? `p. ${s.page} · ${at}` : `p. ${s.page}`)}<p>${esc(s.why)}</p></div></li>`;
    }).join("");
    const blurb = a.blurb || a.summary || "";
    const clamp = opt && opt.compact && blurb.length > 320;
    return `<div class="wh-ov"><div>${blurb ? `<p class="wh-blurb${clamp ? " wh-clamp" : ""}">${esc(blurb)}</p>${clamp ? '<button type="button" class="wh-more" aria-expanded="false">Read the whole summary</button>' : ""}` : ""}${facts ? `<p class="wh-facts">${facts}</p>` : ""}</div>
      ${start ? `<div><h3 class="wh-h">Where to start</h3><ol class="wh-start">${start}</ol></div>` : ""}</div>`;
  }

  function argument(d, opt) {
    const arg = d.argument || {};
    const list = (arg.map || []).slice(0, opt && opt.compact ? 4 : 99);
    const theses = list.map((t, i) => {
      const obj = (t.objections || []).map((o) => `<li><p><em>Objection.</em> ${esc(o.objection)}</p>${o.answer ? `<p><em>Answer.</em> ${esc(o.answer)}</p>` : ""}${pagesOf(o.refs)}</li>`).join("");
      return `<li><details${i === 0 && !(opt && opt.compact) ? " open" : ""}><summary><span class="wh-n">${i + 1}</span>${esc(t.thesis)}</summary>
        <div class="wh-body">${pagesOf(t.refs)}
        ${t.argued ? `<p><em>How it is argued.</em> ${esc(t.argued)}</p>${pagesOf(t.argued_refs)}` : ""}
        ${obj ? `<ul class="wh-objections">${obj}</ul>` : ""}
        ${t.distinctions ? `<p><em>Distinctions.</em> ${esc(t.distinctions)}</p>` : ""}</div></details></li>`;
    }).join("");
    return `${arg.summary ? `<p class="wh-blurb">${esc(arg.summary)}</p>` : ""}<ol class="wh-theses">${theses}</ol>`;
  }

  function sectionRows(d) {
    const out = [];
    if (!d.sections || !Array.isArray(d.structure)) return out;
    d.structure.forEach((e, i) => {
      const note = d.sections[String(i)];
      if (!note || !e || e.page == null) return;
      const depth = Number(e.depth) || 1;
      if (depth > 2) return;
      out.push({ page: e.page, title: cleanTitle(e.title) || `p. ${e.page}`, depth, note });
    });
    return out;
  }
  function sections(d, opt) {
    const rows = sectionRows(d).slice(0, opt && opt.compact ? 40 : 400);
    // a long contents gets the index's find box (titles and notes)
    const find = rows.length > 20 ? `<label class="wh-filter">Find a section <input type="search" placeholder="A word in a title or a note" autocomplete="off"></label>` : "";
    return `${find}<ul class="wh-sections">${rows.map((r) => `<li class="wh-d${r.depth}" data-k="${esc(`${r.title} ${r.note}`.toLowerCase())}">${page(r.page, r.title)}<p>${esc(r.note)}</p></li>`).join("")}</ul>${find ? '<p class="wh-none" hidden>No section matches.</p>' : ""}`;
  }

  // The subject index: a filter box, the headings in a column grid, their pages behind each.
  function index(d) {
    const rows = (d.index || []).map((e) => {
      const head = e.sub ? `${e.heading}, ${e.sub}` : e.heading;
      return `<li data-k="${esc(String(head).toLowerCase())}"><span class="wh-ih">${esc(head)}</span><span class="wh-ipp">${(e.pages || []).slice(0, 12).map((p) => page(p, String(p))).join(" ")}</span></li>`;
    }).join("");
    return `<label class="wh-filter">Find in the index <input type="search" placeholder="A subject, a name" autocomplete="off"></label><ul class="wh-index">${rows}</ul>
      <p class="wh-none" hidden>Nothing in the index matches.</p>`;
  }

  function quotes(d) {
    return `<ul class="wh-quotes">${(d.quotes || []).map((q) => `<li><blockquote>${esc(q.text)}</blockquote>${page(q.page)}</li>`).join("")}</ul>`;
  }

  // THE BACK-OF-BOOK INDEX, WHOLE (2026-10-20, owner: "Subjects, persons, Scripture, terms and questions"): v1/enrich/index/<slug>.json
  // (runs/minimax_1019/indices/build_full.py). Subjects fill the Subject index above; persons and Scripture are the Names and Scripture
  // tabs the work page already has; the terms the work defines and the questions it asks are new, each with its pages.
  const full = new Map();
  function fullIndex(slug) {
    if (!full.has(slug)) full.set(slug, getJSON(`${cfg.base()}/v1/enrich/index/${encodeURIComponent(slug)}.json`));
    return full.get(slug);
  }
  function terms(d) {
    const rows = (d.terms || []).map((e) => `<li data-k="${esc(String(e.term).toLowerCase())}"><span class="wh-ih">${esc(e.term)}</span><span class="wh-ipp">${(e.pages || []).slice(0, 12).map((p) => page(p, String(p))).join(" ")}</span></li>`).join("");
    return `<label class="wh-filter">Find a term <input type="search" placeholder="A term, in the work's language or English" autocomplete="off"></label><ul class="wh-index">${rows}</ul><p class="wh-none" hidden>No term matches.</p>`;
  }
  function questions(d) {
    const rows = (d.questions || []).map((e) => `<li data-k="${esc(String(e.q).toLowerCase())}"><span class="wh-ih">${esc(e.q)}</span><span class="wh-ipp">${page(e.page, `p. ${e.page}`)}</span></li>`).join("");
    return `<label class="wh-filter">Find a question <input type="search" placeholder="A word in the question" autocomplete="off"></label><ul class="wh-index">${rows}</ul><p class="wh-none" hidden>No question matches.</p>`;
  }
  const RENDER = { overview, argument, sections, index, quotes, terms, questions };

  // THE SET'S OWN INDEX (2026-10-20, owner: "plus combined indexes across sets such as WA and Migne"): v1/enrich/sets/<id>/
  // (runs/minimax_1019/indices/setindex.py). The Weimar Edition and Migne are known by the slug, the other sets by sets/by.json.
  const FAMILY = [["pld-", "pl", "Patrologia Latina"], ["pg-", "pg", "Patrologia Graeca"], ["luther-wa-", "luther-wa", "Weimar Edition"]];
  let byP = null;
  function setOf(slug) {
    const f = FAMILY.find(([p]) => String(slug).startsWith(p));
    if (f) return Promise.resolve({ id: f[1], label: `Index of the whole ${f[2]}` });
    if (!byP) byP = getJSON(`${cfg.base()}/v1/enrich/sets/by.json`);
    return byP.then((b) => { const x = b && b[slug]; return x ? { id: x[0], label: `Index of all ${x[1]} volumes of the set` } : null; });
  }

  // READ LATER BY (owner 2026-10-06, proposal 2): the library's page-to-page citation links turned round — for each page of
  // this work, the later pages that cite it (v1/enrich/citedby/<slug>.json, built by tools/enrich/citedby.py from the same
  // links as "Cited on this page"; sure links only). Citing works are named from the catalogue.
  const later = new Map();
  function citedBy(slug) {
    if (!later.has(slug)) later.set(slug, getJSON(`${cfg.base()}/v1/enrich/citedby/${encodeURIComponent(slug)}.json`).then((d) => (d && d.n ? d : null)));
    return later.get(slug);
  }
  let catalogue = null;
  function names() {
    return catalogue || (catalogue = getJSON(`${cfg.base()}/v1/works-index.json`).then((d) => {
      const m = {};
      ((d && d.works) || []).forEach((w) => { m[w.slug] = w; });
      return m;
    }));
  }
  const citerName = (cat, slug) => {
    const w = cat[slug] || {};
    return { author: w.author_en || w.author || "", title: w.title_en || w.title || slug };
  };
  const num = (p) => Number(String(p).replace(/^0+(?=\d)/, "")) || 0;
  // One citing page: who, which work, which page; on the work page a preview of that page opens under it.
  function citerRow(cat, r, opt) {
    const c = citerName(cat, r.w);
    const where = `${c.author ? `${esc(c.author)}, ` : ""}<em>${esc(c.title)}</em>, p. ${esc(r.p)}`;
    return `<li><a href="${esc(cfg.readerHref(r.w, r.p))}"${opt && opt.newTab ? ' target="_blank" rel="noopener"' : ""}>${where}</a>${r.k > 1 ? ` <span class="wh-k">${r.k}×</span>` : ""}${r.loc ? `<span class="wh-loc">${esc(r.loc)}</span>` : ""}${opt && opt.preview ? ` <button type="button" class="wh-page wh-pv" data-w="${esc(r.w)}" data-page="${esc(r.p)}">Preview</button>` : ""}</li>`;
  }
  // The work's cited pages, most cited first: one row a page; its later citations open in place (drawn when opened).
  function mountLater(host, d, cat, opt) {
    const compact = opt && opt.compact;
    const groups = Object.entries(d.pages || {}).map(([p, rs]) => ({ p, rs, k: rs.map((r) => { const c = citerName(cat, r.w); return `${c.author} ${c.title}`; }).join(" | ").toLowerCase() }))
      .sort((a, b) => b.rs.length - a.rs.length || num(a.p) - num(b.p));
    const STEP = compact ? 6 : 30;
    let shown = STEP, q = "";
    host.innerHTML = `${compact ? "" : `<p class="wh-blurb">Pages of this work cited ${Number(d.n).toLocaleString()} times by ${Number(d.works).toLocaleString()} later works in the library. Open a page to see who cites it.</p>
        <label class="wh-filter wh-lfilter">Find a later writer <input type="search" placeholder="A name or a title" autocomplete="off"></label>`}
      <ol class="wh-later"></ol><p class="wh-none" hidden>No later writer matches.</p>
      <button type="button" class="wh-more wh-later-more" hidden></button>`;
    const list = host.querySelector(".wh-later"), none = host.querySelector(".wh-none"), more = host.querySelector(".wh-later-more");
    function draw() {
      const words = q.split(/\s+/).filter(Boolean);
      const hit = groups.filter((g) => words.every((w) => g.k.includes(w)));
      const cut = hit.slice(0, shown);
      list.innerHTML = cut.map((g) => `<li data-p="${esc(g.p)}"><details${q && cut.length <= 3 ? " open" : ""}><summary><span class="wh-lp">p. ${esc(g.p)}</span><span class="wh-lc">${g.rs.length.toLocaleString()} later ${g.rs.length === 1 ? "citation" : "citations"}</span></summary><div class="wh-lbody"></div></details></li>`).join("");
      none.hidden = hit.length > 0;
      more.hidden = cut.length >= hit.length;
      more.textContent = `Show more pages (${(hit.length - cut.length).toLocaleString()} more)`;
      list.querySelectorAll("details[open]").forEach(fill);
    }
    function fill(det) {
      const body = det.querySelector(".wh-lbody");
      if (body.dataset.done) return;
      body.dataset.done = "1";
      const g = groups.find((x) => x.p === det.parentElement.dataset.p);
      const words = q.split(/\s+/).filter(Boolean);
      const rs = words.length ? g.rs.filter((r) => { const c = citerName(cat, r.w); const k = `${c.author} ${c.title}`.toLowerCase(); return words.every((w) => k.includes(w)); }) : g.rs;
      body.innerHTML = `${compact ? "" : `<p class="wh-lopen"><button type="button" class="wh-page" data-page="${esc(g.p)}">Read p. ${esc(g.p)} of this work</button></p>`}
        <ul class="wh-citers">${rs.slice(0, 200).map((r) => citerRow(cat, r, { preview: !compact, newTab: compact })).join("")}</ul>${rs.length > 200 ? `<p class="wh-none">and ${(rs.length - 200).toLocaleString()} more.</p>` : ""}`;
    }
    list.addEventListener("toggle", (e) => { if (e.target.open) fill(e.target); }, true);
    more.addEventListener("click", () => { shown += STEP * 3; draw(); });
    const box = host.querySelector(".wh-lfilter input");
    if (box) box.addEventListener("input", () => { q = box.value.trim().toLowerCase(); shown = STEP; draw(); });
    draw();
  }
  function render(id, d, opt) { return RENDER[id] ? RENDER[id](d, opt || {}) : ""; }

  // Filters and page buttons inside a rendered block; onPage(page) decides what a page reference does.
  function wire(host, onPage) {
    host.addEventListener("click", (e) => {
      const more = e.target.closest(".wh-more");
      if (more && host.contains(more)) {
        const p = more.previousElementSibling, open = more.getAttribute("aria-expanded") !== "true";
        if (p) p.classList.toggle("wh-clamp", !open);
        more.setAttribute("aria-expanded", String(open));
        more.textContent = open ? "Show less" : "Read the whole summary";
        return;
      }
      const b = e.target.closest(".wh-page");
      if (!b || !host.contains(b)) return;
      e.preventDefault();
      onPage(b.dataset.page, b);
    });
    host.addEventListener("input", (e) => {
      const box = e.target.closest(".wh-filter input");
      if (!box || box.closest(".wh-lfilter")) return;   // "Read later by" filters its own list
      const scope = box.closest(".wh-panel, .wh-fold, details") || host;
      const q = box.value.trim().toLowerCase();
      let shown = 0;
      scope.querySelectorAll(".wh-index li, .wh-sections li").forEach((li) => { const on = !q || li.dataset.k.includes(q); li.hidden = !on; if (on) shown++; });
      const none = scope.querySelector(".wh-none");
      if (none) none.hidden = shown > 0;
    });
  }

  const NOTE = "Library notes are machine-written from this work's own pages; every page reference was checked against the text.";
  // The note sits in the closed Methodology dropdown (tfr-method.js); a plain line where that script is not loaded.
  const noteHtml = () => (root.TFRMethod ? root.TFRMethod.html(`<p>${esc(NOTE)}</p>`) : `<p class="wh-note">${esc(NOTE)}</p>`);

  // A page reference on the work page opens the page window right under its line (page-window.js); a second click
  // closes it. Without the page window it opens the reader at that page.
  function inlinePage(slug, page, btn) {
    const row = btn.closest("li, p, .wh-panel") || btn.parentElement;
    let box = row.querySelector(":scope > .wh-pw");
    if (box) { box.remove(); btn.setAttribute("aria-expanded", "false"); return; }
    if (!root.FRPageWindow) { location.assign(cfg.readerHref(slug, page)); return; }
    box = document.createElement("div");
    box.className = "wh-pw peekwrap on";
    box.innerHTML = `<div><div class="peekhead"><strong>p. ${esc(page)}</strong><a href="${esc(cfg.readerHref(slug, page))}">Open in the reader ↗</a><button type="button" data-close-preview>Close</button></div><div class="peekbody"><p class="pw-wait" role="status">Loading the page…</p></div></div>`;
    row.appendChild(box);
    btn.setAttribute("aria-expanded", "true");
    box.querySelector("[data-close-preview]").onclick = () => { box.remove(); btn.setAttribute("aria-expanded", "false"); btn.focus(); };
    // a quotation's own words are marked on its page
    const hl = (btn.closest("li") && btn.closest("li").querySelector("blockquote") || {}).textContent || "";
    root.FRPageWindow.fill(box.querySelector(".peekbody"), { slug, page, hl }).then((ok) => {
      if (!ok) box.querySelector(".peekbody").innerHTML = `<p class="pw-wait"><a href="${esc(cfg.readerHref(slug, page))}">Open p. ${esc(page)} in the reader</a></p>`;
    });
  }

  // THE WORK DESK: the tab strip and its panels. The host page renders the panels it already has (Scripture, topics,
  // sources, the historical index); this adds the guide's panels, mounts positions and names on first view, and keeps
  // the address (#w/<slug>/<tab>) in step without re-running the page.
  let DESK = null;
  function desk(seg, body, o) {
    if (!seg || !body || !o || !o.slug) return;
    const slug = o.slug, order = SECTIONS.map((s) => s.id), present = {}, num = {}, mounted = new Set();
    Object.entries(o.has || {}).forEach(([k, v]) => { if (v) present[k] = true; });
    if (o.sources && o.author) present.positions = true;
    if (o.sources) present.names = true;
    const panel = (id) => {
      let el = body.querySelector(`.wh-panel[data-sec="${id}"]`);
      if (!el) {
        el = document.createElement("section"); el.className = "wh-panel"; el.dataset.sec = id; el.setAttribute("role", "tabpanel"); el.hidden = true;
        const after = order.slice(order.indexOf(id) + 1).map((x) => body.querySelector(`.wh-panel[data-sec="${x}"]`)).find(Boolean);
        body.insertBefore(el, after || null);
      }
      el.id = `wkp-${id}`;
      return el;
    };
    let active = null;
    // the set's index, linked from the work's own index panels
    const setP = setOf(slug);
    const addSet = (id) => setP.then((s) => {
      const el = s && body.querySelector(`.wh-panel[data-sec="${id}"]`);
      if (!el || el.querySelector(".wh-setlink")) return;
      const p = document.createElement("p"); p.className = "wh-setlink";
      p.innerHTML = `<a href="${esc(cfg.setIndexHref(s.id))}">${esc(s.label)}</a>`;
      const h = el.querySelector("h2.sect");
      if (h) h.after(p); else el.prepend(p);
    });
    function strip() {
      seg.innerHTML = order.filter((id) => present[id]).map((id) =>
        `<button type="button" role="tab" id="wkt-${id}" data-sec="${id}" aria-controls="wkp-${id}" aria-selected="${id === active}" tabindex="${id === active ? 0 : -1}"${id === active ? ' class="on"' : ""}>${esc(label(id))}${num[id] > 1 ? ` · ${Number(num[id]).toLocaleString()}` : ""}</button>`).join("");
    }
    // The selected tab, marked in place: re-drawing the strip on every switch would drop the focus a click gave the tab.
    function mark() {
      seg.querySelectorAll('[role="tab"]').forEach((b) => {
        const on = b.dataset.sec === active;
        b.setAttribute("aria-selected", String(on));
        b.tabIndex = on ? 0 : -1;
        b.classList.toggle("on", on);
      });
    }
    function show(id, write) {
      if (!present[id]) id = order.find((x) => present[x]);
      if (!id) { seg.hidden = true; return; }
      active = id;
      // positions and names are mounted the first time they are opened, BEFORE the panels are shown or hidden, so the
      // new panel is the one shown
      if (id === "citedby" && !mounted.has(id)) {
        mounted.add(id);
        const host = panel(id);
        host.innerHTML = `<h2 class="sect">${esc(label(id))}</h2><div class="wh-ref"><p class="pw-wait" role="status">Loading…</p></div>`;
        Promise.all([citedBy(slug), names()]).then(([d, cat]) => { if (d) mountLater(host.querySelector(".wh-ref"), d, cat || {}); });
      }
      if ((id === "positions" || id === "names") && !mounted.has(id) && o.sources) {
        mounted.add(id);
        const host = panel(id);
        host.innerHTML = `<h2 class="sect">${esc(label(id))}</h2><div class="wh-ref"></div>`;
        o.sources.mount(host.querySelector(".wh-ref"), { slug, author: o.author, blob: o.blob, only: [id], open: true, desk: true });
      }
      body.querySelectorAll(".wh-panel").forEach((p) => { p.hidden = p.dataset.sec !== id; p.id = `wkp-${p.dataset.sec}`; p.setAttribute("aria-labelledby", `wkt-${p.dataset.sec}`); });
      if (seg.querySelectorAll('[role="tab"]').length === order.filter((x) => present[x]).length) mark(); else strip();
      if (write) history.replaceState(null, "", `${location.pathname}${location.search}#w/${encodeURIComponent(slug)}${id === order.find((x) => present[x]) ? "" : "/" + id}`);
    }
    // The strip sticks under whatever the site keeps at the top (Mere Orthodoxy's header shows and hides on scroll with the
    // Faith Received bar below it; the library's own site keeps header.site), measured as the reader scrolls.
    const bars = [...document.querySelectorAll("header.site-header, nav.tfr-rail, header.site")];
    let raf = 0;
    const stick = () => {
      raf = 0;
      let b = 0;
      for (const el of bars) {
        const cs = getComputedStyle(el), r = el.getBoundingClientRect();
        if ((cs.position === "fixed" || cs.position === "sticky") && r.bottom > 0 && r.top <= b + 1) b = Math.max(b, r.bottom);
      }
      seg.style.top = `${Math.round(b)}px`;
    };
    if (DESK && DESK.onScroll) removeEventListener("scroll", DESK.onScroll);
    const onScroll = bars.length ? () => { if (!raf) raf = requestAnimationFrame(stick); } : null;
    if (onScroll) { stick(); addEventListener("scroll", onScroll, { passive: true }); }
    seg.addEventListener("click", (e) => {
      const b = e.target.closest('[role="tab"][data-sec]');
      if (!b) return;
      show(b.dataset.sec, true);
      const on = seg.querySelector(`[data-sec="${b.dataset.sec}"]`);
      if (on) {
        // the chosen tab in view along the strip (a phone scrolls it sideways)
        const r = on.getBoundingClientRect(), sr = seg.getBoundingClientRect();
        if (r.left < sr.left || r.right > sr.right) seg.scrollLeft += r.left - sr.left - 16;
      }
      // a new section starts at its top when the strip is already stuck above a long one
      const top = body.getBoundingClientRect().top, under = seg.getBoundingClientRect().bottom;
      if (top < under) window.scrollBy(0, top - under - 8);
    });
    wire(body, (page, btn) => inlinePage(btn.dataset.w || slug, page, btn));
    DESK = { slug, show, seg, onScroll };
    const want = o.tab || "";
    show(present[want] ? want : order.find((x) => present[x]), false);
    citedBy(slug).then((d) => {
      if ((o.run && !o.run()) || !d || DESK.seg !== seg) return;
      present.citedby = true; num.citedby = d.n;
      panel("citedby");
      show(want === "citedby" ? "citedby" : active, false);
    });
    fullIndex(slug).then((d) => {
      if ((o.run && !o.run()) || !d || DESK.seg !== seg) return;
      ["terms", "questions"].forEach((id) => {
        const n = Array.isArray(d[id]) ? d[id].length : 0;
        if (!n) return;
        present[id] = true; num[id] = n;
        panel(id).innerHTML = `<h2 class="sect">${esc(label(id))}</h2>${render(id, d)}${noteHtml()}`;
      });
      addSet("terms");
      show(want && present[want] ? want : active || order.find((x) => present[x]), false);
    });
    guide(slug).then((d) => {
      if ((o.run && !o.run()) || !d || DESK.seg !== seg) return;
      const c = counts(d);
      GUIDE.forEach((id) => {
        if (!c[id]) return;
        present[id] = true; num[id] = id === "overview" ? 0 : c[id];
        panel(id).innerHTML = `<h2 class="sect">${esc(label(id))}</h2>${render(id, d)}${id === "overview" ? noteHtml() : ""}`;
      });
      addSet("index");
      body.parentElement?.querySelector(".wk-unmined")?.remove();
      // the guide leads unless the address asked for another tab
      show(want && present[want] ? want : order.find((x) => present[x]), false);
    });
  }
  function deskSwitch(slug, tab) {
    if (!DESK || DESK.slug !== slug || !document.body.contains(DESK.seg)) return false;
    DESK.show(tab || SECTIONS[0].id, false);
    return true;
  }

  root.FRWorkHub = { SECTIONS, GUIDE, label, config, cfg, guide, counts, render, wire, esc, NOTE, noteHtml, desk, deskSwitch, inlinePage, citedBy, names, mountLater, citerRow, fullIndex, setOf,
    deskHref: (slug, id) => cfg.deskHref(slug, id), readerHref: (slug, p) => cfg.readerHref(slug, p) };
})(typeof window === "undefined" ? globalThis : window);
