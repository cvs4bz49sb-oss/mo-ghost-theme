/*
 * /the-faith-received/resources/ (2026-10-20): the Resources page, browser side.
 *
 * One tablist, one tab today (Articles). More tabs are added to the markup and need only a panel with the same
 * data-k; this file moves between whatever tabs are there (click, arrows, Home, End, #<key>).
 *
 * The Articles tab searches the Mere Orthodoxy essays that serve the library (MOArticles, assets/js/lib/mo-articles.js)
 * as you type, filters by kind, sorts, and shows 25 at a time. The address keeps ?q=, ?kind= and ?sort= (replaceState,
 * so Back leaves the page) and #articles; nothing else is stored anywhere.
 *
 * If the data does not load the page says so and offers a retry. Titles open the original on mereorthodoxy.com in a
 * new tab. All text from the data goes through esc() before it is written.
 */
(function () {
  "use strict";

  const M = window.MOArticles;
  const root = document.querySelector("[data-res-root]");
  if (!M || !root) return;

    const $ = (id) => document.getElementById(id);
  const $q = $("resQuery"), $clear = $("resClear"), $form = $("resForm"), $kinds = $("resKinds"), $sort = $("resSort");
  const $count = $("resCount"), $results = $("resResults");
  const $empty = $("resEmpty"), $reset = $("resReset");
  if (!$q || !$clear || !$form || !$kinds || !$sort || !$count || !$results || !$empty || !$reset) return;

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const enc = encodeURIComponent;

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

  /* ── links to the library's own pages ─────────────────────────── */
  const SD = () => window.MOScriptureDev;
  const shortTitle = (s) => String(s || "").replace(/\s*\([^)]*\)\s*$/, "");

  function verseParts(key) {
    const m = /^([a-z0-9-]+)\.(\d+)(?:\.(\d+)(?:-(\d+))?)?$/.exec(key);
    return m ? { book: m[1], c: m[2], a: m[3] || "", b: m[4] || "" } : null;
  }
  function verseLabel(key) {
    const v = verseParts(key);
    if (!v) return key;
    const sd = SD();
    const book = sd && sd.BOOK_BY_SLUG && sd.BOOK_BY_SLUG.get(v.book);
    const name = book ? (book.slug === "psalms" ? "Psalm" : book.name) : v.book;
    return `${name} ${v.c}${v.a ? `:${v.a}${v.b ? `-${v.b}` : ""}` : ""}`;
  }
  const TYPE_ORDER = ["doc", "work", "author", "topic", "verse"];
  // Up to three, one of each kind first so the line shows range, then whatever is left in order. Plain text: it goes in the card's title attribute.
  function serves(a) {
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

  /* ── state and address ────────────────────────────────────────── */
  const state = { q: "", kind: "", sort: "match" };
  const KIND_KEYS = ["doc", "work", "retrieval", "topic"];
  function readUrl() {
    const p = new URLSearchParams(window.location.search);
    state.q = (p.get("q") || "").slice(0, 200);
    state.kind = KIND_KEYS.includes(p.get("kind")) ? p.get("kind") : "";
    state.sort = ["new", "old"].includes(p.get("sort")) ? p.get("sort") : "match";
    $q.value = state.q;
    const key = window.location.hash.replace(/^#/, "");
    activate(key, false);
  }
  function writeUrl() {
    const p = new URLSearchParams();
    if (state.q.trim()) p.set("q", state.q.trim());
    if (state.kind) p.set("kind", state.kind);
    if (state.sort !== "match") p.set("sort", state.sort);
    const active = tabs().find((t) => t.getAttribute("aria-selected") === "true");
    const qs = p.toString();
    const url = `${window.location.pathname}${qs ? `?${qs}` : ""}#${active ? active.dataset.k : "articles"}`;
    try { window.history.replaceState(null, "", url); } catch (e) { /* a sandboxed frame; the page still works */ }
  }

  /* ── drawing ──────────────────────────────────────────────────── */
  const dateFmt = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  const niceDate = (d) => { const t = new Date(`${d}T00:00:00Z`); return Number.isNaN(t.getTime()) ? d : dateFmt.format(t); };
  const plural = (n, one, many) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

  const KIND_LABEL = { doc: "Creeds and confessions", work: "Works and authors", retrieval: "Theological retrieval", topic: "Doctrine and Scripture" };
  const SIZES = "(min-width: 1180px) 270px, (min-width: 1000px) 22vw, (min-width: 800px) 30vw, (min-width: 520px) 46vw, 100vw";
  const monthYear = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", timeZone: "UTC" });
  const niceMonth = (d) => { const t = new Date(`${d}T00:00:00Z`); return Number.isNaN(t.getTime()) ? d : monthYear.format(t); };

  // Why an essay is on the page: the build writes it (y) from what the essay matched and the scan's own reason; an essay with no strong signal
  // gets its kind in plain words, never a specific topic.
  const FALLBACK = { doc: "On creeds and confessions", work: "Engages works and authors in the library", retrieval: "On theological retrieval", topic: "Engages doctrine and Scripture" };
  const why = (a) => a.y || FALLBACK[a.k] || "";

  // One card, one link: the image (or a tinted tile with the kind), the title, author and month, the kind. What the essay serves rides in the title attribute.
  function card(a, ts, q) {
    const kind = M.kindsOf(a).map((k) => KIND_LABEL[k]).filter(Boolean).join(", ");
    const ph = KIND_LABEL[a.k] || "";
    const src3 = M.image(a, 300);
    const img = src3
      ? `<img class="fr-res-photo" src="${esc(src3)}" srcset="${esc(src3)} 300w, ${esc(M.image(a, 600))} 600w" sizes="${SIZES}" width="600" height="400" alt="${esc(a.ia || "")}" loading="lazy" decoding="async">`
      : `<span class="fr-res-ph" aria-hidden="true">${esc(ph)}</span>`;
    const s = serves(a);
    const also = q ? M.mentions(a, q) : [];
    const tip = s.length ? ` title="${esc(`Serves: ${s.join("; ")}`)}"` : "";
    return [
      '<li class="fr-res-card">',
      `<a class="fr-res-cardlink" href="${esc(a.u)}" target="_blank" rel="noopener"${tip}>`,
      `<span class="fr-res-img">${img}</span>`,
      `<span class="fr-res-ctitle">${highlight(a.t, ts)}</span>`,
      `<span class="fr-res-cmeta">${esc(a.a)} <span aria-hidden="true">&middot;</span> ${esc(niceMonth(a.d))}</span>`,
      `<span class="fr-res-cwhy">${esc(why(a))}</span>`,
      `<span class="fr-res-ckind">${esc(kind)}</span>`,
      also.length ? `<span class="fr-res-cmore">Also mentions: ${esc(also.join(", "))}</span>` : "",
      '<span class="fr-res-sr"> (opens in a new tab)</span>',
      "</a></li>",
    ].join("");
  }

  const GROUPS = [["retrieval", "Theological retrieval"], ["doc", "Creeds and confessions"], ["work", "Works and authors"], ["topic", "Doctrine and Scripture"]];

  function results() {
    const base = M.search(state.q, { kind: state.kind || undefined });
    const q = state.q.trim();
    let list = base;
    if (state.sort === "new" || (state.sort === "match" && !q)) list = base.slice().sort((x, y) => (x.d < y.d ? 1 : x.d > y.d ? -1 : 0));
    else if (state.sort === "old") list = base.slice().sort((x, y) => (x.d < y.d ? -1 : x.d > y.d ? 1 : 0));
    return list;
  }

  // Everything that matches is drawn, in one pass: off-screen cards are skipped by the browser (content-visibility), images load lazily.
  function render() {
    const q = state.q.trim();
    const ts = M.terms(q);
    const list = results();
    const total = list.length;
    const grouped = !q && !state.kind;
    let html = "";
    if (grouped) {
      for (const [k, label] of GROUPS) {
        const part = list.filter((a) => M.kindsOf(a).includes(k));
        if (!part.length) continue;
        html += `<section class="fr-res-section" aria-labelledby="res-g-${k}"><h3 class="fr-res-h" id="res-g-${k}">${esc(label)} <span class="fr-res-n">${part.length.toLocaleString("en-US")}</span></h3><ul class="fr-res-grid">${part.map((a) => card(a, ts, q)).join("")}</ul></section>`;
      }
    } else {
      html = `<ul class="fr-res-grid">${list.map((a) => card(a, ts, q)).join("")}</ul>`;
    }
    $results.innerHTML = total ? html : "";
    $empty.hidden = total > 0;
    $count.textContent = plural(total, "article", "articles");
    $clear.hidden = !$q.value;
  }

  function paintControls() {
    $kinds.innerHTML = [["", "All"]].concat(M.kinds().map((k) => [k.k, k.label]))
      .map(([k, label]) => `<button type="button" class="fr-res-opt" data-kind="${esc(k)}" aria-pressed="${state.kind === k ? "true" : "false"}">${esc(label)}</button>`).join("");
    Array.prototype.forEach.call($sort.querySelectorAll("[data-sort]"), (b) => b.setAttribute("aria-pressed", b.dataset.sort === state.sort ? "true" : "false"));
  }

  function update() {
    paintControls();
    render();
    writeUrl();
  }

  /* ── events ───────────────────────────────────────────────────── */
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
  $kinds.addEventListener("click", (e) => {
    const b = e.target.closest("[data-kind]");
    if (!b) return;
    state.kind = b.dataset.kind;
    update();
    const again = $kinds.querySelector(`[data-kind="${state.kind}"]`);
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
    state.kind = "";
    state.sort = "match";
    update();
    $q.focus();
  });
  window.addEventListener("hashchange", () => activate(window.location.hash.replace(/^#/, ""), false));

  /* ── start ────────────────────────────────────────────────────── */
  function start() {
    $count.textContent = "Loading the articles…";
    M.load().then((data) => {
      if (!data) {
        $count.innerHTML = 'The articles did not load. <button type="button" class="fr-res-link" id="resRetry">Try again</button>';
        const retry = $("resRetry");
        if (retry) retry.addEventListener("click", start);
        return;
      }
      paintControls();
      render();
      // The full text arrives after the page is usable; a search typed meanwhile is redrawn with it.
      M.loadIndex().then((idx) => { if (idx && state.q.trim()) render(); });
    });
  }
  readUrl();
  paintControls();
  start();
})();
