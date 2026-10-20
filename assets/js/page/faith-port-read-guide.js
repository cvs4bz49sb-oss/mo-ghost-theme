/* The Research rail's Work tab: the work's sections, the same ones the work page shows (author/#w/<slug>), in the same order
 * and under the same names (owner 2026-10-06: "research rail and work page should cohere deeply").
 *
 * The section list and the guide renderers live in work-hub.js (FRWorkHub). The guide comes from v1/enrich/works/<slug>.json:
 * what the library has worked out from the work's own pages (an overview and where to start, the argument, a note per section,
 * a subject index, quotations kept only where they match the page word for word). Scripture, topics, positions, sources cited,
 * names and the historical index follow from work-research-sources.js in #nbWorkSources. Each fold ends in a link to its tab on
 * the work page. "Cited on this page" leads: it is the one fold that follows the page in view.
 *
 * A page number in a fold turns the reader to that page in place. A work without notes shows only the folds it has.
 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const panel = $("nbWorkPanel");
  if (!$("notebook") || !panel) return;

  const slug = new URLSearchParams(location.search).get("w");
  if (!slug) return;
  const HUB = window.FRWorkHub;
  const BASE = window.__FR_BLOB_BASE__ || "https://mo-tfr-library.mo-podcast-feed.workers.dev";
  const READ = "/the-faith-received/read/?w=";
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const here = (page) => `${READ}${encodeURIComponent(slug)}#b${encodeURIComponent(page)}-0`;
  const there = (w, page) => `${READ}${encodeURIComponent(w)}#b${encodeURIComponent(page)}-0`;
  const getJSON = (url) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const deskHref = (id) => (HUB ? HUB.deskHref(slug, id) : `/the-faith-received/author/#w/${encodeURIComponent(slug)}`);

  // A page in this work opens in place, through the reader's own navigation, so the rail closes on a phone and stays docked
  // on a desk.
  function go(page) {
    const url = here(page);
    if (window.FRReaderResearch && window.FRReaderResearch.navigate(url)) return;
    location.assign(url);
  }

  // The same fold the sources below use (.wrs-section), so the tab reads as one list.
  function fold(id, title, body, open, n) {
    const d = document.createElement("details");
    d.className = "wrs-section wh-fold";
    d.dataset.sec = id;
    if (open) d.open = true;
    const desk = id === "cited" ? "" : id === "later-page" ? "citedby" : id;
    d.innerHTML = `<summary>${esc(title)}${n > 1 ? ` <span class="wh-count">${Number(n).toLocaleString()}</span>` : ""}</summary><div class="wrs-section-body">${body}${desk ? `<a class="wrs-link wh-desk" href="${esc(deskHref(desk))}">${desk === "citedby" && id === "later-page" ? "Every later citation of this work" : "Open on the work page"}</a>` : ""}</div>`;
    return d;
  }

  // The page in view: the first rendered folio whose foot is below the toolbar.
  function pageInView() {
    const folios = document.querySelectorAll("#reading .folio[data-page]");
    for (const f of folios) {
      const r = f.getBoundingClientRect();
      if (r.bottom > 96) return String(f.dataset.page);
    }
    return null;
  }

  // The catalogue names the cited works; it is fetched the first time the fold opens (the reader's own search has usually
  // cached it by then).
  let catalogue = null;
  const works = () => catalogue || (catalogue = getJSON(`${BASE}/v1/works-index.json`).then((d) => {
    const m = {};
    ((d && d.works) || []).forEach((w) => { m[w.slug] = w; });
    return m;
  }));

  function citedFold(cites) {
    if (!cites || !cites.pages) return null;
    const d = fold("cited", "Cited on this page", `<div class="nb-guide-cited"></div>`, false);
    const box = d.querySelector(".nb-guide-cited");
    let shown = null;
    async function draw() {
      const page = pageInView();
      if (!page || page === shown) return;
      shown = page;
      // A Migne page is a spread of two columns; its citations sit under either.
      const n = Number(page);
      const keys = Number.isFinite(n) && /^p[gl]d?-/.test(slug) ? [String(n), String(n + 1)] : [page];
      const list = keys.flatMap((k) => cites.pages[k] || []);
      const names = await works();
      if (shown !== page) return;
      if (!list.length) { box.innerHTML = `<p class="wrs-note">No linked citations on p. ${esc(page)}.</p>`; return; }
      box.innerHTML = `<ul class="wh-cited">${list.map((c) => {
        const w = names[c.w];
        const name = w ? [w.author, w.title].filter(Boolean).join(", ") : c.w;
        return `<li><a href="${there(c.w, c.p)}" target="_blank" rel="noopener">${esc(name)}, p. ${esc(c.p)}</a>${c.loc ? `<span>${esc(c.loc)}</span>` : ""}</li>`;
      }).join("")}</ul>`;
    }
    d.addEventListener("toggle", () => { if (d.open) { shown = null; draw(); } });
    let t = 0;
    window.addEventListener("scroll", () => { if (!d.open) return; clearTimeout(t); t = setTimeout(draw, 250); }, { passive: true });
    window.addEventListener("fr-reader-navigation", () => { if (d.open) { shown = null; setTimeout(draw, 300); } });
    return d;
  }

  // The work's first door is its page, where the same sections sit under one tab strip. "Search this work" left the list
  // (the Search tab beside Work is that search).
  function door() {
    const list = panel.querySelector(".nb-work-primary");
    if (!list || $("nbWorkDesk")) return;
    const a = document.createElement("a");
    a.id = "nbWorkDesk";
    a.className = "nb-work-desk";
    a.href = deskHref("");
    a.textContent = "Open the work page";
    list.insertBefore(a, list.firstChild);
  }

  // READ LATER BY, the page in view: the later pages in the library that cite it (v1/enrich/citedby, FRWorkHub.citedBy).
  function laterFold(d) {
    if (!d) return null;
    const f = fold("later-page", "Read later by", `<div class="nb-guide-later"></div>`, false);
    const box = f.querySelector(".nb-guide-later");
    let shown = null;
    async function draw() {
      const page = pageInView();
      if (!page || page === shown) return;
      shown = page;
      const n = Number(page);
      const keys = Number.isFinite(n) && /^p[gl]d?-/.test(slug) ? [String(n), String(n + 1)] : [page];
      const rows = keys.flatMap((k) => d.pages[k] || d.pages[String(Number(k))] || []);
      const cat = await HUB.names();
      if (shown !== page) return;
      if (!rows.length) { box.innerHTML = `<p class="wrs-note">No later page in the library cites p. ${esc(page)}.</p>`; return; }
      box.innerHTML = `<p class="wrs-note">${rows.length.toLocaleString()} later ${rows.length === 1 ? "page cites" : "pages cite"} p. ${esc(page)}, oldest first.</p><ul class="wh-citers">${rows.slice(0, 60).map((r) => HUB.citerRow(cat || {}, r, { newTab: true })).join("")}</ul>${rows.length > 60 ? `<p class="wrs-note">and ${(rows.length - 60).toLocaleString()} more on the work page.</p>` : ""}`;
    }
    f.addEventListener("toggle", () => { if (f.open) { shown = null; draw(); } });
    let t = 0;
    window.addEventListener("scroll", () => { if (!f.open) return; clearTimeout(t); t = setTimeout(draw, 250); }, { passive: true });
    window.addEventListener("fr-reader-navigation", () => { if (f.open) { shown = null; setTimeout(draw, 300); } });
    return f;
  }

  // Two groups under the work's card: what follows the page in view (its citations, and the analysis extracted from it),
  // then the whole work's sections in the work page's order. The analysis fold is the tab's own (#nbAnalysisFold, filled
  // by work-research.js); it moves up beside "Cited on this page" and takes a name that says what it shows.
  const group = (text) => {
    const p = document.createElement("p");
    p.className = "wh-group";
    p.textContent = text;
    return p;
  };

  async function mount() {
    door();
    if (!HUB) return;
    const [data, cites, later] = await Promise.all([HUB.guide(slug), getJSON(`${BASE}/v1/enrich/cites/${encodeURIComponent(slug)}.json`), HUB.citedBy ? HUB.citedBy(slug) : null]);
    const c = HUB.counts(data);
    const guide = document.createElement("div");
    guide.id = "nbWorkGuide";
    guide.className = "wrs nb-work-guide";
    guide.appendChild(group("On this page"));
    const cited = citedFold(cites);
    if (cited) guide.appendChild(cited);
    const laterHere = laterFold(later);
    if (laterHere) guide.appendChild(laterHere);
    const analysis = $("nbAnalysisFold");
    if (analysis) {
      const s = analysis.querySelector(":scope > summary");
      if (s) s.textContent = "Analysis of this page";
      analysis.classList.add("wrs-section");
      guide.appendChild(analysis);
    }
    guide.appendChild(group("The whole work"));
    if (data) HUB.GUIDE.forEach((id) => {
      if (!c[id]) return;
      guide.appendChild(fold(id, HUB.label(id), HUB.render(id, data, { compact: true }), id === "overview", c[id]));
    });
    // the whole work's most-cited pages, after the quotations, as on the work page
    if (later) {
      const f = fold("citedby", HUB.label("citedby"), `<div class="nb-later-work"></div>`, false, later.n);
      guide.appendChild(f);
      f.addEventListener("toggle", async () => {
        const host = f.querySelector(".nb-later-work");
        if (!f.open || host.dataset.done) return;
        host.dataset.done = "1";
        HUB.mountLater(host, later, (await HUB.names()) || {}, { compact: true });
      });
    }
    HUB.wire(guide, (page) => go(page));
    const anchor = $("nbWorkSources");
    if (anchor) panel.insertBefore(guide, anchor); else panel.appendChild(guide);
    // The library notes are machine-written: said once, in a Methodology dropdown at the foot of the tab's sections.
    if (data && !$("nbWorkNote")) {
      const note = document.createElement("div");
      note.id = "nbWorkNote";
      note.className = "wrs-note wh-note";
      note.innerHTML = HUB.noteHtml ? HUB.noteHtml() : "";
      if (!note.innerHTML) note.textContent = HUB.NOTE;
      const after = $("nbWorkSources");
      if (after && after.parentNode === panel) panel.insertBefore(note, after.nextSibling); else guide.appendChild(note);
    }
  }

  // After the reader has named the work, so the tab's own controls come first.
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
})();
