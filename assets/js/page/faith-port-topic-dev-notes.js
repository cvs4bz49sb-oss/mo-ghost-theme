/* The live Topics page (/the-faith-received/topics/?t=<locus>, topics-dev.js): a third block under the
 * topic, "The doctrine through the centuries", in the page's own fold-and-tabs style (.td-block,
 * .td-tabs): how the library's authors developed the doctrine period by period, a course of readings in
 * order, the traditions compared on it, and its concept guides.
 *
 * Data: v1/enrich/topics/<slug>.json on the library worker. Its slugs are the old Topics page's, which is
 * each locus's t2 in loci.json (the table topics-dev.js itself reads); a locus without a file of its own
 * falls back to its aliases. Machine-written from the authors' own claims, paraphrase never quotation,
 * every page checked; the block says so. A topic without notes shows nothing, and nothing else on the
 * page changes: the block is added after the page draws a topic and again whenever it redraws one.
 */
(function () {
  "use strict";

  // Notes use the canonical Mere Orthodoxy library host.
  window.__FR_BLOB_BASE__ = window.__FR_BLOB_BASE__ || "https://mo-tfr-library.mo-podcast-feed.workers.dev";
  const $root = document.querySelector("[data-td-root]");
  if (!$root) return;
  const BASE = window.__FR_BLOB_BASE__ || "https://mo-tfr-library.mo-podcast-feed.workers.dev";
  const READ = "/the-faith-received/read/?w=";
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // A note on how a figure was made is a closed Methodology (assets/js/lib/tfr-method.js); without the helper it stays the paragraph it was.
  const method = (html) => (window.TFRMethod ? window.TFRMethod.html(html) : html);
  const getJSON = (url) => fetch(url, { credentials: "omit" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const pageLink = (w, p, label) => `<a href="${READ}${encodeURIComponent(w)}#b${encodeURIComponent(p)}-0">${esc(label)}</a>`;
  // A page names whose words it carries; a compiled page names its compiler ("Augustine of Hippo, via Eugippius").
  const who = (r) => `${r.a || r.author || r.side || "page"}${r.via ? `, via ${r.via}` : ""}`;
  const pagesLine = (rs) => ((rs || []).length
    ? `<p class="fr-dn-pages">${rs.slice(0, 6).map((r) => pageLink(r.w, r.p, `${who(r)}, p. ${r.p}`)).join(" · ")}</p>` : "");

  // ── The page's own taxonomy: locus id -> its old topic slug (t2) and aliases ──
  let loci = null;
  const lociUrl = () => (window.moAssetUrl ? window.moAssetUrl("/assets/data/faith-received/loci.json") : "/assets/data/faith-received/loci.json");
  const loadLoci = () => loci || (loci = getJSON(lociUrl()).then((d) => {
    const m = new Map();
    ((d && d.parts) || []).forEach((part) => (part.loci || []).forEach((l) => {
      m.set(l.id, l);
      (l.children || []).forEach((ch) => m.set(ch.id, ch));
    }));
    return m;
  }));
  const cache = new Map();
  const topicFile = (slug) => {
    if (!cache.has(slug)) cache.set(slug, getJSON(`${BASE}/v1/enrich/topics/${encodeURIComponent(slug)}.json`));
    return cache.get(slug);
  };
  const hasNotes = (d) => d && ((d.guide && (d.guide.history || []).length) || (d.traditions || []).length || (d.concepts || []).length);
  async function notesFor(locus) {
    for (const slug of [locus.t2, ...(locus.aliases || [])].filter(Boolean)) {
      const d = await topicFile(String(slug).toLowerCase());
      if (hasNotes(d)) return d;
    }
    return null;
  }

  // ── The four views ──
  function historyView(g) {
    return `${g.summary ? `<p class="fr-dn-lede">${esc(g.summary)}</p>` : ""}<ol class="fr-dn-timeline">${g.history.map((h) => `<li>
      <h4>${esc(h.period)}</h4><div><p>${esc(h.text)}</p>${pagesLine(h.refs)}</div></li>`).join("")}</ol>`;
  }

  /* The three views are laid out as cards (2026-10-20). Every sentence and link is the data's, unchanged; only the markup around
     them is new. A tradition's color is the shelf color of its name, and a name with no shelf gets the neutral edge. */
  const EDGE = { "roman catholic": "rc", lutheran: "lu", reformed: "rf", "continental reformed": "rf", "english divines": "ed", anglican: "ed", "greek fathers": "gf", "latin fathers": "pl", medieval: "md", "eastern fathers": "po" };
  const edge = (name) => EDGE[String(name || "").toLowerCase()] || "hl";

  function courseView(g) {
    return `<ol class="fr-dn-course">${g.course.map((c, i) => `<li class="fr-dn-step"><span class="fr-dn-n" aria-hidden="true">${i + 1}</span><div class="fr-dn-step-body">
      <p class="fr-dn-course-head">${pageLink(c.w, c.p, `${who(c)}${c.t ? `, ${c.t}` : ""}, p. ${c.p}`)}</p>
      <p>${esc(c.why)}</p>${c.thesis ? `<p class="fr-dn-thesis">${esc(c.thesis)}</p>` : ""}</div></li>`).join("")}</ol>`;
  }

  /* The comparison prose cites its sources by number into two lists the page never received: "(X1, Y7)" means the first tradition's sample, item 1, and the
     second's, item 7. The refs the data does carry are only the cited subset, with no index, so a number cannot be matched to a page. The raw tokens are
     taken out of the prose (nothing else in a sentence is changed) and the pages are listed as numbered notes to the paragraph as a whole. */
  const GROUP = /\s*[(\[]\s*[XY]\d+(?:\s*[–—-]\s*[XY]?\d+)?(?:\s*[,;]\s*[XY]\d+(?:\s*[–—-]\s*[XY]?\d+)?)*\s*[)\]]/g;
  const BARE = /\s+[XY]\d+\b/g;
  const clean = (t) => String(t || "").replace(GROUP, "").replace(/(^|[.!?]\s+)[XY]\d+\b/g, "$1A sampled source").replace(BARE, "").replace(/\s+([.,;:])/g, "$1");
  const CONF_DOC = /^(?:cf|rc|lc|bc)-\d/;
  function notesList(refs) {
    // A confession or catechism among the cited pages comes first.
    const list = (refs || []).filter((r) => r && r.w).slice().sort((x, y) => Number(CONF_DOC.test(y.w)) - Number(CONF_DOC.test(x.w)));
    if (!list.length) return "";
    return `<p class="fr-dn-notes-h">Pages this paragraph was drawn from</p><ol class="fr-dn-notes">${list.slice(0, 12).map((r) => `<li>${pageLink(r.w, r.p, `${who(r)}, p. ${r.p}`)}</li>`).join("")}</ol>`;
  }
  // Which of the desk's church columns holds a tradition's vetted confessions. English Divines and Medieval have no column of their own, so no row.
  const COLUMN_OF = { Reformed: "rf", Lutheran: "lu", "Roman Catholic": "rc", "Latin Fathers": "early", "Greek Fathers": "early" };
  function sampleLine(p) {
    const refs = [...(p.agree_refs || []), ...(p.differ_refs || [])];
    const pages = new Set(refs.map((r) => `${r.w}|${r.p}`)).size;
    const authors = new Set(refs.map((r) => r.author).filter(Boolean));
    if (!pages) return "";
    const by = (side) => [...new Set(refs.filter((r) => r.side === side).map((r) => r.author).filter(Boolean))];
    const list = [p.x, p.y].map((t) => `${esc(t)}: ${by(t).map(esc).join(", ") || "none"}`).join(". ");
    return method(`<p class="fr-dn-sample">Drawn from a sample of ${pages} cited ${pages === 1 ? "page" : "pages"} by ${authors.size} ${authors.size === 1 ? "author" : "authors"}. Not every author in a tradition is represented. Sampled authors, ${list}.</p>`);
  }
  function halfHtml(label, extra, used) {
    // Latin and Greek Fathers share one column (the early church): its documents are shown once in a card, in the first half that asks.
    const colId = COLUMN_OF[label];
    const col = colId && !used.has(colId) && extra && extra.columns && extra.columns.find((c) => c.id === colId);
    if (col) used.add(colId);
    const docs = col && col.quotes && col.quotes.length ? `<div class="fr-dn-row"><h5>Confessions and catechisms</h5><ul>${col.quotes.slice(0, 6).map((q) =>
      `<li><a href="${esc(q.href || `${READ}${encodeURIComponent(q.w)}`)}">${esc([q.doc, q.article && q.article !== q.doc ? q.article : ""].filter(Boolean).join(", "))}</a>${q.year ? ` <span>${esc(q.year)}</span>` : ""}</li>`).join("")}</ul></div>` : "";
    const names = extra && extra.principal && extra.principal.traditions && extra.principal.traditions[label];
    const rows = names && window.MOTopicPrincipal && extra.topic ? window.MOTopicPrincipal.principalRows(names, extra.topic.authors, extra.topic.works, 8) : [];
    const writers = rows.length ? `<div class="fr-dn-row"><h5>Principal writers on this topic in the library</h5><ul>${rows.map((r) =>
      `<li><a href="${esc(r.href)}">${esc(r.name)}</a> <span>${r.n.toLocaleString("en-US")} passages</span></li>`).join("")}</ul>${method(`<p class="fr-dn-note">Listed from the library's passages on this topic. The comparison above was written from a sample and may not draw on every writer here.</p>`)}</div>` : "";
    return docs || writers ? `<div class="fr-dn-half"><h5 class="fr-dn-half-h">${esc(label)}</h5>${docs}${writers}</div>` : "";
  }
  function traditionsView(prs, extra) {
    return `<ol class="fr-dn-pairs">${prs.map((p) => {
      const used = new Set();
      const halves = [halfHtml(p.x, extra, used), halfHtml(p.y, extra, used)].join("");
      return `<li class="fr-dn-card"><span class="fr-dn-edge" aria-hidden="true"><i class="e-${edge(p.x)}"></i><i class="e-${edge(p.y)}"></i></span><h4>${esc(p.x)} and ${esc(p.y)}</h4>
      <p>${esc(clean(p.summary))}</p>
      ${p.agree ? `<p><em>Agree.</em> ${esc(clean(p.agree))}</p>${notesList(p.agree_refs)}` : ""}
      ${p.differ ? `<p><em>Differ.</em> ${esc(clean(p.differ))}</p>${notesList(p.differ_refs)}` : ""}${sampleLine(p)}${halves ? `<div class="fr-dn-halves">${halves}</div>` : ""}</li>`;
    }).join("")}</ol>`;
  }

  function conceptsView(cs) {
    return `<ul class="fr-dn-concepts">${cs.map((c) => `<li class="fr-dn-card fr-dn-concept"><p><strong>${esc(c.label)}</strong> ${esc(c.gloss)}</p>
      <button type="button" class="sd-clear fr-dn-open" data-concept="${esc(c.id)}" aria-expanded="false">Read the guide</button>
      <div class="fr-dn-guide" hidden></div></li>`).join("")}</ul>`;
  }

  function guideHTML(g) {
    const pos = (g.positions || []).map((p) => `<li><strong>${esc(p.tradition)}.</strong> ${esc(p.summary)}
      ${(p.evidence || []).length ? `<p class="fr-dn-pages">${p.evidence.slice(0, 5).map((e) => pageLink(e.work, e.page, `p. ${e.page}`)).join(" · ")}</p>` : ""}</li>`).join("");
    const read = (g.read || []).map((r) => `<li>${pageLink(r.work, r.page, r.title || r.work)} <span>${esc(r.why)}</span></li>`).join("");
    return `${g.brief ? `<p>${esc(g.brief)}</p>` : ""}${g.scope_note ? `<p><em>Scope.</em> ${esc(g.scope_note)}</p>` : ""}
      ${g.differed ? `<p><em>Where the traditions differed.</em> ${esc(g.differed)}</p>` : ""}
      ${pos ? `<h5>Positions</h5><ul>${pos}</ul>` : ""}${read ? `<h5>Where to read</h5><ul>${read}</ul>` : ""}`;
  }

  const root_MOTS = window.MOTopicScripture || null;
  // "Read the guide" on a concept card: loads the guide in place.
  function bindConcepts($el) {
    $el.addEventListener("click", async (e) => {
      const b = e.target.closest(".fr-dn-open");
      if (!b || b.hasAttribute("data-tsc-all")) return;
      const slot = b.nextElementSibling;
      if (!slot.hidden) { slot.hidden = true; b.textContent = "Read the guide"; b.setAttribute("aria-expanded", "false"); return; }
      if (!slot.dataset.loaded) {
        const cg = await getJSON(`${BASE}/v1/enrich/concepts/${encodeURIComponent(b.dataset.concept)}.json`);
        slot.innerHTML = cg ? guideHTML(cg) : "<p class=\"sd-muted\">This guide did not load.</p>";
        slot.dataset.loaded = "1";
      }
      slot.hidden = false;
      b.textContent = "Close the guide";
      b.setAttribute("aria-expanded", "true");
    });
  }

  // The Topic Desk says when it has drawn ("pending", then "drawn" or "failed"); this waits for that, so the tabs know where they go.
  const deskReady = () => new Promise((res) => {
    const st = () => $root.dataset.deskState || "none";
    if (st() !== "pending") { res(st()); return; }
    const t = setTimeout(() => res("timeout"), 12000);
    const f = () => { if (st() !== "pending") { clearTimeout(t); $root.removeEventListener("tdk:state", f); res(st()); } };
    $root.addEventListener("tdk:state", f);
  });

  // ── The block ──
  let run = 0;
  async function draw() {
    const id = new URLSearchParams(location.search).get("t");
    const $main = $root.querySelector("[data-td-main]");
    const old = $root.querySelector("[data-fr-dn]");
    if (!id || !$main) { if (old) old.remove(); return; }
    if (old && old.dataset.id === id) return;
    if (old) old.remove();
    const my = ++run;
    const locus = (await loadLoci()).get(id);
    const d = locus ? await notesFor(locus) : null;
    const $m = $root.querySelector("[data-td-main]"); // the page may have redrawn while the notes loaded
    if (my !== run || !d || !$m || new URLSearchParams(location.search).get("t") !== id || $m.querySelector("[data-fr-dn]")) return;
    const g = d.guide || {};
    const views = [];
    // The Scripture tab (topic-scripture-tab.js) comes first when the topic has verses its confession articles cite.
    const sc = root_MOTS ? await root_MOTS.prepare(id, locus).catch(() => null) : null;
    if (sc) views.push(["scripture", "Scripture", () => `<div class="tsc" data-tsc></div>`]);
    // When the Topic Desk has put the History on its century rows, this block starts at the reading course.
    const merged = $root.dataset.deskHistory === id;
    if ((g.history || []).length && !merged) views.push(["history", "History", () => historyView(g)]);
    if ((g.course || []).length) views.push(["course", "A course of reading", () => courseView(g)]);
    if ((d.traditions || []).length) views.push(["traditions", "Traditions compared", () => traditionsView(d.traditions, window.MOTopicDeskData || null)]);
    if ((d.concepts || []).length) views.push(["concepts", "Concept guides", () => conceptsView(d.concepts)]);
    if (!views.length) return;
    // With the Topic Desk's About section on the page, these views become its tabs (one tablist, History first). Otherwise they keep a block of their own.
    const st = await deskReady();
    if (my !== run) return;
    const section = $m.querySelector("#tdk-chron");
    if (st === "drawn" && section && window.MOAbout && window.MOAbout.host) {
      if (section.dataset.joined) return;
      section.dataset.joined = "1";
      views.filter((v) => v[0] !== "history").forEach(([k, lab, fn]) => {
        const panel = document.createElement("div");
        panel.className = "fr-dn fr-dn--in";
        panel.dataset.lazy = "1";
        panel.addEventListener("about:show", () => {
          if (!panel.dataset.lazy) return;
          delete panel.dataset.lazy;
          if (k === "scripture") { panel.innerHTML = `<div class="tsc" data-tsc></div>`; root_MOTS.fill(panel.querySelector("[data-tsc]"), id, sc); return; }
          panel.innerHTML = `${method(`<p class="sd-muted td-note">Machine-written from their own claims, not their words; every page is checked.</p>`)}${fn()}`;
        });
        bindConcepts(panel);
        window.MOAbout.add(k, lab, panel);
      });
      return;
    }
    const box = document.createElement("details");
    box.className = "td-block fr-dn";
    box.open = true;
    box.dataset.frDn = "";
    box.dataset.id = id;
    box.innerHTML = `<summary class="td-fold-sum"><h3 class="td-block-h" id="td-h-history">${merged ? "Ways into this topic" : "The doctrine through the centuries"}</h3>
</summary>
      ${method(`<p class="sd-muted td-note">Machine-written from their own claims, not their words; every page is checked.</p>`)}
      <div class="fr-dn-tabs" role="tablist" aria-label="Ways into this topic">${views.map(([k, lab], i) =>
        `<button type="button" class="fr-dn-tab" role="tab" id="fr-dn-tab-${k}" aria-controls="fr-dn-panel" aria-selected="${i ? "false" : "true"}" tabindex="${i ? "-1" : "0"}" data-fr-view="${k}">${esc(lab)}</button>`).join("")}</div>
      <div class="td-view fr-dn-view" id="fr-dn-panel" role="tabpanel" tabindex="0" aria-labelledby="fr-dn-tab-${views[0][0]}" data-fr-dn-view>${views[0][2]()}</div>`;
    const $view = box.querySelector("[data-fr-dn-view]");
    const tabs = [...box.querySelectorAll(".fr-dn-tab")];
    if (views[0][0] === "scripture" && sc) root_MOTS.fill($view.querySelector("[data-tsc]"), id, sc);
    const pick = (t, focus) => {
      const v = views.find((x) => x[0] === t.dataset.frView);
      if (!v) return;
      tabs.forEach((o) => { o.setAttribute("aria-selected", String(o === t)); o.tabIndex = o === t ? 0 : -1; });
      $view.setAttribute("aria-labelledby", t.id);
      $view.innerHTML = v[2]();
      if (v[0] === "scripture" && sc) root_MOTS.fill($view.querySelector("[data-tsc]"), id, sc);
      if (focus) t.focus();
    };
    box.querySelector(".fr-dn-tabs").addEventListener("click", (e) => { const t = e.target.closest(".fr-dn-tab"); if (t) pick(t, false); });
    box.querySelector(".fr-dn-tabs").addEventListener("keydown", (e) => {
      const i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      const to = { ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      pick(tabs[to], true);
    });
    bindConcepts($view);
    // Up under the Topic Desk's century showpiece when it has drawn (Ian, 2026-10-19); topic-desk.js moves it there if the desk draws later.
    const after = $m.querySelector("#tdk-chron") || $m.querySelector("[data-td-desk]");
    if (after) after.after(box); else $m.appendChild(box);
  }

  // topics-dev.js redraws the whole topic into the root (innerHTML) on every route; a view switch only
  // redraws inside it. So watch the root's own children, and the history.
  window.MOTopicNotesDraw = draw;
  new MutationObserver(() => { draw(); }).observe($root, { childList: true });
  window.addEventListener("popstate", () => { draw(); });
  draw();
})();
