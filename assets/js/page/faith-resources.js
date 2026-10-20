/*
 * /the-faith-received/resources/ (2026-10-20): the Resources page, browser side.
 *
 * One tablist: Articles and Podcasts. A tab is a button with data-k and a panel with the same data-k; this file moves between them
 * (click, arrows, Home, End, #<key>). Each panel is the same machine over its own data (createPanel):
 *   Articles  the Mere Orthodoxy essays that serve the library (MOArticles, assets/js/lib/mo-articles.js), filtered by kind
 *   Podcasts  the Passages, Mere Fidelity and Christians Reading Classics episodes that serve it (MOArticles.podcasts), filtered by show
 * Search runs as you type (120 ms), everything that matches is drawn, and the address keeps the state (replaceState, so Back leaves
 * the page): ?q= ?kind= ?sort= for Articles, ?pq= ?show= ?psort= for Podcasts, and #articles or #podcasts. Nothing else is stored.
 *
 * If the data does not load the page says so and offers a retry. Titles open the original in a new tab. All text from the data goes
 * through esc() before it is written.
 */
(function () {
  "use strict";

  const MA = window.MOArticles;
  const root = document.querySelector("[data-res-root]");
  if (!MA || !root) return;
  const $ = (id) => document.getElementById(id);

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ── tabs ─────────────────────────────────────────────────────── */
  const tabs = () => Array.prototype.slice.call(root.querySelectorAll("[data-res-tabs] [role=tab]"));
  const panelFor = (tab) => $(tab.getAttribute("aria-controls"));
  function activate(key, focus) {
    const list = tabs();
    const on = list.find((t) => t.dataset.k === key) || list[0];
    if (!on) return;
    list.forEach((t) => {
      const sel = t === on;
      t.setAttribute("aria-selected", sel ? "true" : "false");
      t.tabIndex = sel ? 0 : -1;
      const p = panelFor(t);
      if (p) p.hidden = !sel;
    });
    if (focus) on.focus();
  }

  /* ── what a card says about the library ───────────────────────── */
  const SD = () => window.MOScriptureDev;
  const shortTitle = (s) => String(s || "").replace(/\s*\([^)]*\)\s*$/, "");
  function verseLabel(key) {
    const m = /^([a-z0-9-]+)\.(\d+)(?:\.(\d+)(?:-(\d+))?)?$/.exec(key);
    if (!m) return key;
    const sd = SD();
    const book = sd && sd.BOOK_BY_SLUG && sd.BOOK_BY_SLUG.get(m[1]);
    const name = book ? (book.slug === "psalms" ? "Psalm" : book.name) : m[1];
    return `${name} ${m[2]}${m[3] ? `:${m[3]}${m[4] ? `-${m[4]}` : ""}` : ""}`;
  }
  const TYPE_ORDER = ["doc", "work", "author", "topic", "verse"];
  // Up to three, one of each kind first so the line shows range, then whatever is left in order. Plain text: it goes in the card's title attribute.
  function serves(M, a) {
    const all = M.entities(a);
    const picked = [];
    for (const t of TYPE_ORDER) {
      const e = all.find((x) => x.type === t);
      if (e && picked.length < 3) picked.push(e);
    }
    for (const e of all) if (picked.length < 3 && !picked.includes(e)) picked.push(e);
    picked.sort((x, y) => TYPE_ORDER.indexOf(x.type) - TYPE_ORDER.indexOf(y.type));
    return picked.map((e) => (e.type === "verse" ? verseLabel(e.key) : e.type === "work" ? shortTitle(e.label) : e.label));
  }

  /* ── highlighting: fold as the search does, mark the original text ─ */
  function highlight(text, ts) {
    const src = String(text || "");
    if (!ts.length) return esc(src);
    let folded = "";
    const at = [];
    for (let i = 0; i < src.length; i++) {
      const f = src[i].normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
      for (let j = 0; j < f.length; j++) at.push(i);
      folded += f;
    }
    const last = ts[ts.length - 1];
    const spans = [];
    const re = /[a-z0-9]+/g;
    let m;
    while ((m = re.exec(folded))) {
      const w = m[0];
      if (ts.includes(w) || w.startsWith(last)) spans.push([at[m.index], at[m.index + w.length - 1] + 1]);
    }
    let out = "";
    let pos = 0;
    for (const [s, e] of spans) {
      if (s < pos) continue;
      out += `${esc(src.slice(pos, s))}<mark>${esc(src.slice(s, e))}</mark>`;
      pos = e;
    }
    return `${out}${esc(src.slice(pos))}`;
  }

  const plural = (n, one, many) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
  const SIZES = "(min-width: 1180px) 270px, (min-width: 1000px) 22vw, (min-width: 800px) 30vw, (min-width: 520px) 46vw, 100vw";
  const monthYear = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", timeZone: "UTC" });
  const niceMonth = (d) => { const t = new Date(`${d}T00:00:00Z`); return Number.isNaN(t.getTime()) ? d : monthYear.format(t); };

  const KIND_LABEL = { doc: "Creeds and confessions", work: "Works and authors", retrieval: "Theological retrieval", topic: "Doctrine and Scripture" };
  // Why an item is on the page: the build writes it (y) from what the item matched and the scan's own reason; with no strong signal it gets
  // its kind in plain words, never a specific topic.
  const FALLBACK = { doc: "On creeds and confessions", work: "Engages works and authors in the library", retrieval: "On theological retrieval", topic: "Engages doctrine and Scripture" };
  const why = (a) => a.y || FALLBACK[a.k] || "";

  const PANELS = {
    articles: {
      key: "articles", prefix: "res", M: MA, noun: ["article", "articles"], loading: "Loading the articles…", failed: "The articles did not load.",
      params: { q: "q", f: "kind", s: "sort" },
      filters: () => MA.kinds().map((k) => [k.k, k.label]),
      has: (a, f) => MA.kindsOf(a).includes(f),
      groups: [["retrieval", "Theological retrieval"], ["doc", "Creeds and confessions"], ["work", "Works and authors"], ["topic", "Doctrine and Scripture"]],
      inGroup: (a, g) => MA.kindsOf(a).includes(g),
      label: (a) => MA.kindsOf(a).map((k) => KIND_LABEL[k]).filter(Boolean).join(", "),
      tile: (a) => KIND_LABEL[a.k] || "",
      meta: (a) => `${esc(a.a)} <span aria-hidden="true">&middot;</span> ${esc(niceMonth(a.d))}`,
      labelFirst: false,
    },
    podcasts: {
      key: "podcasts", prefix: "pod", M: MA.podcasts, noun: ["episode", "episodes"], loading: "Loading the episodes…", failed: "The episodes did not load.",
      params: { q: "pq", f: "show", s: "psort" },
      filters: () => [["passages", "Passages"], ["mere-fidelity", "Mere Fidelity"], ["christians-reading-classics", "Christians Reading Classics"]],
      has: (a, f) => a.s === f,
      groups: [["passages", "Passages"], ["mere-fidelity", "Mere Fidelity"], ["christians-reading-classics", "Christians Reading Classics"]],
      inGroup: (a, g) => a.s === g,
      label: (a) => a.a,
      tile: (a) => a.a,
      meta: (a) => esc(niceMonth(a.d)),
      labelFirst: true,
    },
  };

  function createPanel(cfg) {
    const { M } = cfg;
    const ids = (n) => $(`${cfg.prefix}${n}`);
    const $q = ids("Query"), $clear = ids("Clear"), $form = ids("Form"), $filters = ids("Filters"), $sort = ids("Sort");
    const $count = ids("Count"), $results = ids("Results"), $empty = ids("Empty"), $reset = ids("Reset");
    if (!M || !$q || !$clear || !$form || !$filters || !$sort || !$count || !$results || !$empty || !$reset) return null;
    const state = { q: "", f: "", sort: "match" };
    const filterKeys = cfg.filters().map((x) => x[0]);

    // One card, one link: the image (or a tinted tile), the label, the title, the date, why it is here. What it serves rides in the title attribute.
    function card(a, ts, q) {
      const src3 = M.image(a, 300);
      const img = src3
        ? `<img class="fr-res-photo" src="${esc(src3)}" srcset="${esc(src3)} 300w, ${esc(M.image(a, 600))} 600w" sizes="${SIZES}" width="600" height="400" alt="${esc(a.ia || "")}" loading="lazy" decoding="async">`
        : `<span class="fr-res-ph" aria-hidden="true">${esc(cfg.tile(a))}</span>`;
      const s = serves(M, a);
      const also = q ? M.mentions(a, q) : [];
      const tip = s.length ? ` title="${esc(`Serves: ${s.join("; ")}`)}"` : "";
      const label = `<span class="fr-res-ckind${cfg.labelFirst ? " fr-res-ckind--first" : ""}">${esc(cfg.label(a))}</span>`;
      return [
        '<li class="fr-res-card">',
        `<a class="fr-res-cardlink" href="${esc(a.u)}" target="_blank" rel="noopener"${tip}>`,
        `<span class="fr-res-img">${img}</span>`,
        cfg.labelFirst ? label : "",
        `<span class="fr-res-ctitle">${highlight(a.t, ts)}</span>`,
        `<span class="fr-res-cmeta">${cfg.meta(a)}</span>`,
        `<span class="fr-res-cwhy">${esc(why(a))}</span>`,
        cfg.labelFirst ? "" : label,
        also.length ? `<span class="fr-res-cmore">Also mentions: ${esc(also.join(", "))}</span>` : "",
        '<span class="fr-res-sr"> (opens in a new tab)</span>',
        "</a></li>",
      ].join("");
    }

    function results() {
      const q = state.q.trim();
      let list = M.search(state.q);
      if (state.f) list = list.filter((a) => cfg.has(a, state.f));
      if (state.sort === "new" || (state.sort === "match" && !q)) list = list.slice().sort((x, y) => (x.d < y.d ? 1 : x.d > y.d ? -1 : 0));
      else if (state.sort === "old") list = list.slice().sort((x, y) => (x.d < y.d ? -1 : x.d > y.d ? 1 : 0));
      return list;
    }

    // Everything that matches is drawn, in one pass: off-screen cards are skipped by the browser (content-visibility), images load lazily.
    function render() {
      const q = state.q.trim();
      const ts = M.terms(q);
      const list = results();
      const total = list.length;
      const grouped = !q && !state.f;
      let html = "";
      if (grouped) {
        for (const [g, label] of cfg.groups) {
          const part = list.filter((a) => cfg.inGroup(a, g));
          if (!part.length) continue;
          html += `<section class="fr-res-section" aria-labelledby="${cfg.prefix}-g-${g}"><h3 class="fr-res-h" id="${cfg.prefix}-g-${g}">${esc(label)} <span class="fr-res-n">${part.length.toLocaleString("en-US")}</span></h3><ul class="fr-res-grid">${part.map((a) => card(a, ts, q)).join("")}</ul></section>`;
        }
      } else {
        html = `<ul class="fr-res-grid">${list.map((a) => card(a, ts, q)).join("")}</ul>`;
      }
      $results.innerHTML = total ? html : "";
      $empty.hidden = total > 0;
      $count.textContent = plural(total, cfg.noun[0], cfg.noun[1]);
      $clear.hidden = !$q.value;
    }

    function paintControls() {
      $filters.innerHTML = [["", "All"]].concat(cfg.filters())
        .map(([k, label]) => `<button type="button" class="fr-res-opt" data-f="${esc(k)}" aria-pressed="${state.f === k ? "true" : "false"}">${esc(label)}</button>`).join("");
      Array.prototype.forEach.call($sort.querySelectorAll("[data-sort]"), (b) => b.setAttribute("aria-pressed", b.dataset.sort === state.sort ? "true" : "false"));
    }

    function update() {
      paintControls();
      render();
      writeUrl();
    }

    let timer = 0;
    $q.addEventListener("input", () => {
      $clear.hidden = !$q.value;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { state.q = $q.value; update(); }, 120);
    });
    $q.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && $q.value) { e.preventDefault(); $q.value = ""; window.clearTimeout(timer); state.q = ""; update(); }
    });
    $form.addEventListener("submit", (e) => e.preventDefault());
    $clear.addEventListener("click", () => { $q.value = ""; window.clearTimeout(timer); state.q = ""; update(); $q.focus(); });
    $filters.addEventListener("click", (e) => {
      const b = e.target.closest("[data-f]");
      if (!b) return;
      state.f = b.dataset.f;
      update();
      const again = $filters.querySelector(`[data-f="${state.f}"]`);
      if (again) again.focus();
    });
    $sort.addEventListener("click", (e) => {
      const b = e.target.closest("[data-sort]");
      if (!b) return;
      state.sort = b.dataset.sort;
      update();
      const again = $sort.querySelector(`[data-sort="${state.sort}"]`);
      if (again) again.focus();
    });
    $reset.addEventListener("click", () => {
      $q.value = "";
      window.clearTimeout(timer);
      state.q = "";
      state.f = "";
      state.sort = "match";
      update();
      $q.focus();
    });

    function read(p) {
      state.q = (p.get(cfg.params.q) || "").slice(0, 200);
      state.f = filterKeys.includes(p.get(cfg.params.f)) ? p.get(cfg.params.f) : "";
      state.sort = ["new", "old"].includes(p.get(cfg.params.s)) ? p.get(cfg.params.s) : "match";
      $q.value = state.q;
    }
    function write(p) {
      if (state.q.trim()) p.set(cfg.params.q, state.q.trim());
      if (state.f) p.set(cfg.params.f, state.f);
      if (state.sort !== "match") p.set(cfg.params.s, state.sort);
    }
    function start() {
      $count.textContent = cfg.loading;
      M.load().then((data) => {
        if (!data) {
          $count.innerHTML = `${cfg.failed} <button type="button" class="fr-res-link" data-retry>Try again</button>`;
          const retry = $count.querySelector("[data-retry]");
          if (retry) retry.addEventListener("click", start);
          return;
        }
        paintControls();
        render();
        // The full text arrives after the page is usable; a search typed meanwhile is redrawn with it.
        M.loadIndex().then((idx) => { if (idx && state.q.trim()) render(); });
      });
    }
    return { read, write, start, paintControls };
  }

  const panels = Object.values(PANELS).map(createPanel).filter(Boolean);

  function readUrl() {
    const p = new URLSearchParams(window.location.search);
    panels.forEach((x) => x.read(p));
    activate(window.location.hash.replace(/^#/, ""), false);
  }
  function writeUrl() {
    const p = new URLSearchParams();
    panels.forEach((x) => x.write(p));
    const active = tabs().find((t) => t.getAttribute("aria-selected") === "true");
    const qs = p.toString();
    const url = `${window.location.pathname}${qs ? `?${qs}` : ""}#${active ? active.dataset.k : "articles"}`;
    try { window.history.replaceState(null, "", url); } catch (e) { /* a sandboxed frame; the page still works */ }
  }

  root.querySelector("[data-res-tabs]").addEventListener("click", (e) => {
    const t = e.target.closest("[role=tab]");
    if (t) { activate(t.dataset.k, false); writeUrl(); }
  });
  root.querySelector("[data-res-tabs]").addEventListener("keydown", (e) => {
    const list = tabs();
    const i = list.indexOf(document.activeElement);
    if (i < 0) return;
    const to = { ArrowRight: (i + 1) % list.length, ArrowLeft: (i + list.length - 1) % list.length, Home: 0, End: list.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    activate(list[to].dataset.k, true);
    writeUrl();
  });
  window.addEventListener("hashchange", () => activate(window.location.hash.replace(/^#/, ""), false));

  readUrl();
  panels.forEach((x) => { x.paintControls(); x.start(); });
})();
