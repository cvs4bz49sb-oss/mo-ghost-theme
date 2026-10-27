/*
 * /the-faith-received/topics/ — a systematic theology from the
 * primary sources (Ian, 2026-09-22).
 *
 * TWO VIEWS, ONE ROUTE.
 *   no ?t=     the contents: ten parts in the classic order of the loci
 *              (Prolegomena to Last Things), every locus and its children.
 *   ?t=<id>    one locus across the full reading workspace, with a sidebar
 *              on the right only when an author or source is open. &view=
 *              picks the tab.
 *
 * THE ORDER IS AN EDITORIAL DECISION, stated once in
 * assets/data/faith-received/loci.json: the Reformed-scholastic sequence
 * (Turretin, Heppe), with all 43 of the library's loci and all 179 mined
 * topics placed in it (the small ones as aliases). Ian delegated the call.
 *
 * A LOCUS PAGE: two blocks with the same four tabs (Ian, 2026-09-22).
 *   What the church confessed   creeds, confessions, catechisms and
 *                               councils only (no papal letters or local
 *                               synods), their articles in their own words.
 *   What its teachers wrote     the classic treatments in each tradition's
 *                               major works (assets/data/faith-received/
 *                               treatments.json, machine-ranked and meant
 *                               to be edited), each section read in place.
 *   Tabs: Read, Compare (traditions side by side), Trace (a timeline in
 *   the manner of Connections: one strip, a row per tradition, points by
 *   date), Scripture (proof-texts, each to its Verse Desk).
 *
 * THE TOPIC DESK (2026-10-19). Above the two blocks, assets/js/page/topic-desk.js draws a desk for every topic: hero with a century
 * ruler, the churches' own documents, classic works, a timeline, key verses, people, a reading path, related topics. Each module
 * is computed from the data (topic-desk-model.js) and left out when the data is thin. This file only feeds it (deskFeed), so if
 * the desk fails the two blocks below are exactly what they were.
 *
 * The earlier stream of single verified sentences was dropped: sentences
 * cut from their argument, chosen by what verified rather than by what
 * mattered. Verified quotations remain in the author sidebar.
 *
 * Data: mo-tfr-verse /v1/topic, /v1/topic/confessions, /v1/topic/sources
 * (sidebar), /v1/topic/scripture, /v1/verse/passage (max= for sections). Shared parts (filters, buttons, charts, the panel)
 * come from scripture-dev-core.js, so Topics works like the Scripture
 * reader and the Verse Desk.
 */
(function () {
  "use strict";
  const S = window.MOScriptureDev;
  if (!S) return;
  const { esc, fmt, plural } = S;
  // How a figure was made is a closed Methodology under it (assets/js/lib/tfr-method.js); without the helper it stays the paragraph it was.
  const method = (html) => (window.TFRMethod ? window.TFRMethod.html(html) : html);
  const $root = document.querySelector("[data-td-root]");
  if (!$root) return;

  const BASE = "/the-faith-received/topics/";
  const VIEWS = [["read", "Read"], ["compare", "Compare"], ["trace", "Trace"], ["scripture", "Scripture"]];
  const TRADS = [["rc", "Roman Catholic"], ["lu", "Lutheran"], ["rf", "Continental Reformed"], ["ed", "English Divines"], ["hl", "Humanism and Law"],
    ["pl", "Latin Fathers"], ["gf", "Greek Fathers"], ["md", "Medieval"], ["po", "Eastern Fathers"]];
  const narrow = window.matchMedia("(max-width: 899px)");

  const topicHref = (id, view, cview) => `${BASE}?t=${encodeURIComponent(id)}${
    cview && cview !== "read" ? `&c=${cview}` : ""}${view && view !== "read" ? `&view=${view}` : ""}`;
  const compact = (n) => {
    const x = Number(n || 0);
    if (x >= 1e6) return `${(x / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
    if (x >= 1e4) return `${Math.round(x / 1e3)}k`;
    return fmt(x);
  };
  const confessionTitle = (c) => c.article_display || c.article || "";

  // ── The taxonomy ──────────────────────────────────────────────
  let LOCI = null;
  // id -> {locus, part, parent}
  const INDEX = new Map();
  function loadLoci() {
    const url = window.moAssetUrl ? window.moAssetUrl("/assets/data/faith-received/loci.json") : "/assets/data/faith-received/loci.json";
    return fetch(url, { credentials: "omit" }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))).then((d) => {
      LOCI = d;
      d.parts.forEach((part) => part.loci.forEach((l) => {
        INDEX.set(l.id, { locus: l, part, parent: null });
        (l.children || []).forEach((ch) => INDEX.set(ch.id, { locus: ch, part, parent: l }));
      }));
      return d;
    });
  }

  // ── The contents page ─────────────────────────────────────────
  function renderContents() {
    document.title = "Topics | The Faith Received | Mere Orthodoxy";
    $root.classList.remove("has-topic", "has-desk");
    $root.innerHTML =
      `<header class="td-head td-head--contents">` +
        `<label class="sd-search td-find"><span class="sd-filter-label">Find a topic</span><input type="search" data-td-find placeholder="Justification, the Trinity, baptism…" autocomplete="off"></label>` +
        `<p class="sd-muted td-find-empty" data-td-find-empty role="status" hidden>No topic matches. Try a broader word.</p>` +
      `</header>` +
      `<div class="td-parts">${LOCI.parts.map((p) =>
        `<section class="td-part" aria-labelledby="td-part-${esc(p.id)}">` +
          `<h2 class="td-part-h" id="td-part-${esc(p.id)}"><span class="td-roman">${esc(p.n)}</span> ${esc(p.label)}</h2>` +
          `<ol class="td-loci">${p.loci.map((l) => locusRow(l, false)).join("")}</ol>` +
        `</section>`).join("")}</div>`;
    const $find = $root.querySelector("[data-td-find]");
    const $empty = $root.querySelector("[data-td-find-empty]");
    $find.addEventListener("input", () => {
      const q = $find.value.trim().toLowerCase();
      let shown = 0;
      $root.querySelectorAll(".td-locus").forEach((li) => {
        const hit = !q || li.dataset.find.includes(q);
        li.hidden = !hit;
        if (hit) shown += 1;
      });
      // A child that matches keeps its parent row visible.
      $root.querySelectorAll(".td-locus > .td-loci").forEach((ol) => {
        if (ol.querySelector(".td-locus:not([hidden])")) ol.parentElement.hidden = false;
      });
      $root.querySelectorAll(".td-part").forEach((sec) => { sec.hidden = !sec.querySelector(".td-locus:not([hidden])"); });
      $empty.hidden = shown > 0;
      if (!shown) $empty.textContent = q ? `No topic matches “${$find.value.trim()}”. Try a broader word.` : "No topic matches. Try a broader word.";
    });
  }

  function locusRow(l, child) {
    const words = [l.label, l.id.replace(/^de-/, "").replace(/-/g, " "), ...(l.aliases || []).map((a) => a.replace(/-/g, " ")), ...(l.find || [])].join(" ").toLowerCase();
    const kids = (l.children || []).map((ch) => locusRow(ch, true)).join("");
    return `<li class="td-locus${child ? " td-locus--child" : ""}" data-find="${esc(words)}">` +
      `<a class="td-locus-link" href="${esc(topicHref(l.id))}">${esc(l.label)}</a>${
      kids ? `<ol class="td-loci">${kids}</ol>` : ""
    }</li>`;
  }

  // ── A locus ───────────────────────────────────────────────────
  /* Two blocks, each with the same four ways in (Ian, 2026-09-22):
   *   What the church confessed        creeds, confessions, catechisms,
   *                                    councils; never papal letters or
   *                                    local synods. &c=<view>
   *   What the church's teachers wrote the classic treatments of the
   *                                    topic in each tradition's major
   *                                    works. &view=<view>
   * Trace in both is a timeline in the manner of Connections: one strip,
   * rows by tradition, each point placed by its date. */
  const state = { id: "", view: "read", cview: "read", data: null, conf: null };
  // The Topic Desk's handle (topic-desk.js), and a feed that never lets it break this page.
  let deskCtl = null;
  const deskFeed = (kind, payload, extra) => { try { if (deskCtl) deskCtl.feed(kind, payload, extra); } catch (e) { /* the page carries on without the desk */ } };
  let $main = null;
  let $side = null;
  const $panel = document.createElement("section");
  $panel.className = "sd-panel td-panel";

  let TREAT = null;
  function loadTreatments() {
    if (TREAT) return Promise.resolve(TREAT);
    const url = window.moAssetUrl ? window.moAssetUrl("/assets/data/faith-received/treatments.json") : "/assets/data/faith-received/treatments.json";
    return fetch(url, { credentials: "omit" }).then((r) => (r.ok ? r.json() : { loci: {} })).catch(() => ({ loci: {} }))
      .then((d) => { TREAT = d || { loci: {} }; return TREAT; });
  }
  const LABEL_TO_SH = new Map(TRADS.map(([k, lab]) => [lab.toLowerCase(), k]));
  // the worker's label for that shelf
  LABEL_TO_SH.set("english divines", "ed");
  const shelfOf = (e) => {
    const v = String(e.sh || e.trad || "");
    return v.length <= 3 ? v : (LABEL_TO_SH.get(v.toLowerCase()) || v);
  };

  /* NO "ENGLISH DIVINES" (Ian, 2026-09-22, on a reader who found Benjamin
   * Keach filed under English Divines rather than Baptist). That shelf is
   * a nationality, not a church. Its authors are placed by the library's
   * denomination table (assets/js/faith-denominations.js, MODenom), so
   * the groups, Compare's columns and Trace's rows read Anglican,
   * Presbyterian, Congregational, Baptist and so on. A man the table
   * files as Continental Reformed, Lutheran or Roman Catholic joins that
   * shelf. Anyone it does not place stays together as "Other English
   * writers" rather than being guessed into a church. Every grouping
   * reads its key from shOf, so this one function is the whole change. */
  const DEN = window.MODenom;
  const ED_TO_SHELF = { "Continental Reformed": "rf", Lutheran: "lu", "Roman Catholic": "rc" };
  const ED_ORDER = ["Anglican", "Presbyterian", "Congregational", "Baptist", "Quaker", "Anabaptist", "Arminian", "Methodist", "Bohemian Brethren", "Waldensian", "Socinian"];
  // The Latin Library catalogue holds some men (John Owen) only under a corpus-scoped row, so a name with no body is asked again as that corpus's.
  const bodyOf = (name) => (DEN && DEN.loaded() && name
    ? DEN.of({ author: String(name) }).body || DEN.of({ author: String(name), corpus: "tfr" }).body || "" : "");
  const shOf = (e) => {
    const k = shelfOf(e);
    if (k !== "ed") return k;
    const b = bodyOf(e.author || e.a);
    return ED_TO_SHELF[b] || (b ? `ed:${b}` : "ed");
  };
  const expandOrder = (order) => order.flatMap((k) => (k === "ed" ? [...ED_ORDER.map((b) => `ed:${b}`), "ed"] : [k]));
  const baseOf = (k) => String(k).split(":")[0];
  const tradLabel = (k) => (String(k).startsWith("ed:") ? String(k).slice(3)
    : k === "ed" ? "Other English writers" : (TRADS.find((t) => t[0] === k) || [k, k])[1]);

  // Confession groups: the early church before the schism of 1054 (the
  // data files the ancient creeds and councils under "Roman Catholic"),
  // then Rome, Wittenberg and the Reformed.
  const CGROUPS = [["early", "The early church"], ["rc", "Roman Catholic"], ["lu", "Lutheran"], ["rf", "Reformed"]];
  const cgroup = (a) => (Number(a.year) && Number(a.year) < 1054 ? "early"
    : a.trad === "Roman Catholic" ? "rc" : a.trad === "Lutheran" ? "lu" : "rf");
  const cgroupLabel = (k) => (CGROUPS.find((g) => g[0] === k) || [k, k])[1];

  /* "Election" is a doctrinal synonym only in context. The mined index
   * previously treated every election as predestination, admitting the
   * election of bishops, popes and council officers. Keep the correction
   * at the topic boundary so Read, Compare, Trace and the headline counts
   * all describe the same doctrinal corpus. */
  const PREDESTINATION_TERMS = /\b(?:predestinat\w*|reprobation|eternal\s+election|divine\s+election|election\s+(?:and\s+reprobation|to\s+(?:life|salvation)|unto\s+(?:life|salvation)|of\s+(?:grace|the\s+saints)|is\s+(?:made|also)|made\s+infallible)|decrees?\s+of\s+god|book\s+of\s+life)\b/i;
  const DOCTRINAL_ELECTION = /\b(?:predestinat\w*|reprobation|election|elect|elects|chosen\s+(?:in\s+christ|before\s+the\s+foundation)|foreordain\w*)\b/i;
  const OFFICE_ELECTION = /(?:election|chosen|elect)\s+(?:of|a|the|by)[^.!;]{0,80}(?:bishop|presbyter|deacon|pope|pontiff|minister|abbot|patriarch|cardinal)|(?:bishop|presbyter|deacon|pope|pontiff|minister|abbot|patriarch|cardinal)[^.!;]{0,80}(?:election|chosen|elect)/i;
  const predestinationArticle = (a) => {
    if (state.id !== "de-praedestinatione") return true;
    const title = String(a.article_display || a.article || "");
    const text = `${title} ${a.text || ""}`;
    const dort = /Canons of Dort/i.test(a.doc || "") && /First Head/i.test(title);
    return (dort || DOCTRINAL_ELECTION.test(text)) && !(!/predestinat|reprobation/i.test(text) && OFFICE_ELECTION.test(text));
  };
  const relevantSections = (w) => {
    const secs = w.secs || [];
    if (state.id !== "de-praedestinatione") return secs;
    return secs.filter((s) => {
      const title = String(s.t || "");
      return PREDESTINATION_TERMS.test(title) && !(!/predestinat|reprobation/i.test(title) && OFFICE_ELECTION.test(title));
    });
  };
  const curateTopicData = (d) => {
    if (state.id !== "de-praedestinatione") return d;
    const works = (d.works || []).map((w) => ({ ...w, secs: relevantSections(w) })).filter((w) =>
      PREDESTINATION_TERMS.test(`${w.t || ""} ${w.a || ""}`) || w.secs.length);
    const names = new Set(works.map((w) => w.a).filter(Boolean));
    const selected = (TREAT && TREAT.loci && TREAT.loci[state.id]) || [];
    selected.forEach((e) => names.add(e.author));
    const authors = (d.authors || []).filter((a) => names.has(a.a));
    return { ...d, works, authors, counts: { ...(d.counts || {}), authors: names.size, works: works.length } };
  };

  const indexCard = (key, title, meta, open, controls, attr) =>
    `<button type="button" class="sd-index-card td-index-card" ${attr}="${esc(key)}" aria-expanded="${open ? "true" : "false"}" aria-controls="${esc(controls)}"><span>${esc(title)}</span><small>${esc(meta)}</small></button>`;

  function renderLocus(id, view, cview) {
    const hit = INDEX.get(id);
    if (!hit) { renderContents(); return; }
    const { locus, part, parent } = hit;
    state.id = id;
    state.view = VIEWS.some((v) => v[0] === view) ? view : "read";
    state.cview = VIEWS.some((v) => v[0] === cview) ? cview : "read";
    state.data = null;
    state.conf = null;
    document.title = `${locus.label} | Topics | The Faith Received | Mere Orthodoxy`;
    $root.classList.add("has-topic");
    $root.classList.remove("has-desk");
    const tabs = (block, cur) => `<nav class="td-tabs" aria-label="${block === "c" ? "Ways to read the confessions" : "Ways to read the teachers"}">${VIEWS.map(([k, lab]) =>
      `<a class="td-tab" href="${esc(topicHref(id, block === "w" ? k : state.view, block === "c" ? k : state.cview))}" data-block="${block}" data-view="${k}"${k === cur ? ' aria-current="true"' : ""}>${lab}</a>`).join("")}</nav>`;
    $root.innerHTML =
      `<div class="td-main" data-td-main>` +
        `<header class="td-head">` +
          `<p class="sd-eyebrow td-topic-path"><a href="${BASE}">All topics</a><span aria-hidden="true"> · </span>Part ${esc(part.n)} · ${esc(part.label)}${parent ? ` · <a href="${esc(topicHref(parent.id))}">${esc(parent.label)}</a>` : ""}</p>` +
          `<h2 class="td-title">${esc(locus.label)}</h2>` +
          // The topic's numbers as boxes (Ian, 2026-09-23: thin-line boxes,
          // the whole width). Each fills in as its source arrives; the
          // counts line below is kept for the error and retry.
          `<div class="td-stats" data-td-stats aria-live="polite">` +
            `<div class="td-stat" data-k="conf"><b>…</b><span>Confessional articles</span></div>` +
            `<div class="td-stat" data-k="authors"><b>…</b><span>Authors</span></div>` +
            `<div class="td-stat" data-k="works"><b>…</b><span>Treatises</span></div>` +
          `</div>` +
          `<p class="td-counts sd-muted" data-td-counts hidden></p>${
            (locus.children || []).length ? `<p class="td-kids">Within this topic: ${locus.children.map((ch) => `<a href="${esc(topicHref(ch.id))}">${esc(ch.label)}</a>`).join(" · ")}</p>` : ""
          }</header>` +
        // The Topic Desk (topic-desk.js) draws here when it has data. Empty until then, and empty for good if it fails.
        `<div class="td-desk" data-td-desk></div>` +
        // Both blocks fold (Ian, 2026-09-24). <details>, open to start:
        // the heading and its note are the summary, so a closed block is
        // one line with its chevron.
        `<details class="td-block" open>` +
          `<summary class="td-fold-sum"><h3 class="td-block-h" id="td-h-conf">Creeds, Confessions, and Catechisms</h3>` +
          `</summary>` +
          `${tabs("c", state.cview)}<div class="td-view" data-td-cview></div>` +
        `</details>` +
        `<details class="td-block" open>` +
          `<summary class="td-fold-sum"><h3 class="td-block-h" id="td-h-teach">Works</h3>` +
          `</summary>` +
          `${tabs("w", state.view)}<div class="td-view" data-td-view></div>` +
        `</details>` +
      `</div>` +
      `<aside class="td-side sd-side" data-td-side hidden aria-label="Author"></aside>`;
    $main = $root.querySelector("[data-td-main]");
    $side = $root.querySelector("[data-td-side]");
    deskCtl = null;
    try {
      deskCtl = window.MOTopicDeskMount
        ? window.MOTopicDeskMount({ host: $main.querySelector("[data-td-desk]"), root: $root, id, locus, part, parent, S, loci: INDEX, bodyOf })
        : null;
    } catch (e) { deskCtl = null; }
    $main.querySelectorAll(".td-tabs").forEach((nav) => nav.addEventListener("click", (e) => {
      const a = e.target.closest(".td-tab");
      if (!a) return;
      e.preventDefault();
      if (a.dataset.block === "c") setCView(a.dataset.view, true); else setView(a.dataset.view, true);
    }));
    setCView(state.cview, false);
    setView(state.view, false);
    loadConfessions(id, hit);
    Promise.all([S.api("/v1/topic", { id, t2: locus.t2 }), loadTreatments()]).then(([d]) => {
      if (state.id !== id) return;
      if (!d) throw new Error("no topic");
      state.data = curateTopicData(d);
      deskFeed("topic", state.data, (TREAT && TREAT.loci && TREAT.loci[id]) || []);
      const c = state.data.counts || {};
      setStat("authors", c.authors || 0);
      setStat("works", c.works || 0);
      setView(state.view, false);
    }).catch(() => {
      if (state.id !== id) return;
      const $counts = $main.querySelector("[data-td-counts]");
      $counts.hidden = false;
      $counts.innerHTML = `This topic did not load. <button type="button" class="sd-clear" data-td-retry>Try again</button>`;
      setStat("authors", null);
      setStat("works", null);
      $main.querySelector("[data-td-retry]").addEventListener("click", () => renderLocus(id, state.view, state.cview));
    });
  }

  // A child locus with no articles of its own borrows its parent's,
  // and says so.
  function loadConfessions(id, hit) {
    const get = (lid) => S.api("/v1/topic/confessions", { id: lid, limit: 500 });
    get(id).then((d) => {
      if (d && (d.articles || []).length) return { d, from: null };
      if (hit.parent) return get(hit.parent.id).then((pd) => ({ d: pd, from: hit.parent }));
      return { d, from: null };
    }).then(({ d, from }) => {
      if (state.id !== id) return;
      const clean = d ? { ...d, articles: (d.articles || []).filter(predestinationArticle) } : { articles: [], scripture: [] };
      state.conf = { d: clean, from };
      deskFeed("conf", {
        articles: clean.articles, from,
        timeline: (clean.timeline || []).filter((t) => clean.articles.some((a) => a.w === t.w)),
      });
      setStat("conf", clean.articles.length);
      setCView(state.cview, false);
    }).catch(() => {
      if (state.id !== id) return;
      state.conf = { d: null, from: null, error: true };
      deskFeed("conf", null);
      setStat("conf", null);
      setCView(state.cview, false);
    });
  }

  // One stat box in the topic's header. null is "did not load": a dash,
  // never a zero, which would claim nobody wrote on the topic.
  function setStat(k, n) {
    const $b = $main && $main.querySelector(`[data-td-stats] [data-k="${k}"] b`);
    if ($b) $b.textContent = n == null ? "–" : fmt(n);
  }

  function syncTabs(block, view) {
    $main.querySelectorAll(`.td-tab[data-block="${block}"]`).forEach((a) => {
      if (a.dataset.view === view) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
      a.setAttribute("href", topicHref(state.id, a.dataset.block === "w" ? a.dataset.view : state.view, a.dataset.block === "c" ? a.dataset.view : state.cview));
    });
  }
  function writeUrl(push) {
    const url = topicHref(state.id, state.view, state.cview);
    if (location.pathname + location.search !== url) history[push ? "pushState" : "replaceState"](null, "", url);
  }

  function setView(view, push) {
    state.view = view;
    syncTabs("w", view); syncTabs("c", state.cview);
    writeUrl(push);
    const $view = $main.querySelector("[data-td-view]");
    if (!state.data) { $view.innerHTML = `<p class="sd-muted">Loading…</p>`; return; }
    if (view === "compare") renderTeachCompare($view);
    else if (view === "trace") renderTeachTrace($view);
    else if (view === "scripture") renderScripture($view, null);
    else renderTreatments($view);
  }

  function setCView(view, push) {
    state.cview = view;
    syncTabs("c", view); syncTabs("w", state.view);
    writeUrl(push);
    const $view = $main.querySelector("[data-td-cview]");
    const c = state.conf;
    if (!c) { $view.innerHTML = `<p class="sd-muted">Loading the confessions…</p>`; return; }
    if (c.error) {
      $view.innerHTML = `<p class="sd-muted">The confessions did not load. <button type="button" class="sd-clear" data-td-cretry>Try again</button></p>`;
      $view.querySelector("[data-td-cretry]").addEventListener("click", () => { state.conf = null; setCView(state.cview, false); loadConfessions(state.id, INDEX.get(state.id)); });
      return;
    }
    const arts = (c.d && c.d.articles) || [];
    if (!arts.length) {
      $view.innerHTML = `<p class="sd-muted">No creed, confession or catechism article is linked to this topic yet.</p>`;
      return;
    }
    const from = c.from ? `<p class="sd-muted td-note">From <a href="${esc(topicHref(c.from.id))}">${esc(c.from.label)}</a>, which this topic belongs to.</p>` : "";
    if (view === "compare") renderConfCompare($view, arts, from);
    else if (view === "trace") renderConfTrace($view, arts, from);
    else if (view === "scripture") renderScripture($view, (c.d.scripture || []), from);
    else renderConfRead($view, arts, from);
  }

  // ── Confessions: Read ─────────────────────────────────────────
  function articleItem(a, i, opts) {
    const li = document.createElement("li");
    li.className = "td-article";
    if (i != null) li.id = `td-art-${i}`;
    const text = String(a.text || "").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/^#+\s*/gm, "").trim();
    const short = opts && opts.short ? 280 : 700;
    const long = text.length > short + 80;
    const head = text.slice(0, short).replace(/\s+\S*$/, "");
    const href = S.sourceHref(a.href, a.w, a.p);
    const proofs = (a.scripture || []).filter((x) => LIB_TO_BOOK.has(x.b)).slice(0, 12);
    const t = S.recalledTranslation();
    li.innerHTML =
      `<p class="td-article-doc">${[a.year, a.doc].filter(Boolean).map(esc).join(" · ")}${a.doc_type ? ` <span class="td-type">${esc(a.doc_type)}</span>` : ""}</p>` +
      `<h${opts && opts.short ? 5 : 4} class="td-article-h">${esc(a.article_display || a.article || "")}</h${opts && opts.short ? 5 : 4}>${ 
      text ? `<blockquote class="sd-quote td-article-text">${esc(long ? `${head} …` : text)}</blockquote>` : "" 
      }<p class="td-article-foot">${long ? `<button type="button" class="sd-clear" data-td-more aria-expanded="false">Read the whole article</button>` : ""}` +
        `${href ? `<a class="sd-read-link" href="${esc(href)}">Read in context</a>` : ""}</p>${ 
      proofs.length ? `<p class="td-proof-chips"><span class="sd-filter-label">Proofs</span> ${proofs.map((x) => {
        const book = LIB_TO_BOOK.get(x.b);
        const c = Number(x.c) || 1;
        const v = Number(x.v) || 0;
        return `<a href="${esc(S.deskHref(book, c, v, t === "ESV" ? "" : t))}">${esc(S.refLabel(book, c, v))}${x.v2 ? `–${Number(x.v2) || ""}` : ""}</a>`;
      }).join("")}</p>` : ""}`;
    const $more = li.querySelector("[data-td-more]");
    if ($more) $more.addEventListener("click", () => {
      const open = $more.getAttribute("aria-expanded") !== "true";
      $more.setAttribute("aria-expanded", String(open));
      $more.textContent = open ? "Show less" : "Read the whole article";
      li.querySelector(".td-article-text").textContent = open ? `${text}${a.clipped_end ? " …" : ""}` : `${head} …`;
    });
    return li;
  }

  function chipsFor(keys, labelOf, countOf, onPick) {
    const wrap = document.createElement("div");
    wrap.className = "td-chips";
    wrap.setAttribute("role", "group");
    wrap.innerHTML = `<button type="button" class="td-chip" aria-pressed="true" data-k="">All (${countOf("")})</button>${
      keys.map((k) => `<button type="button" class="td-chip" aria-pressed="false" data-k="${esc(k)}">${esc(labelOf(k))} (${countOf(k)})</button>`).join("")}`;
    wrap.addEventListener("click", (e) => {
      const b = e.target.closest(".td-chip");
      if (!b) return;
      wrap.querySelectorAll(".td-chip").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      onPick(b.dataset.k);
    });
    return wrap;
  }

  function renderConfRead($view, arts, from) {
    $view.innerHTML = `${from}<div data-td-cchips></div><div class="td-document-index" data-td-docs></div>` +
      `<button type="button" class="sd-more td-documents-more" data-td-documents-more hidden>Show more documents</button>` +
      `<p class="sd-muted td-conf-note">Choose a document to read its articles on this topic.</p>`;
    const $docs = $view.querySelector("[data-td-docs]");
    const $docsMore = $view.querySelector("[data-td-documents-more]");
    let filterK = "";
    let openDoc = "";
    let shownDocs = 25;
    const groups = () => {
      const map = new Map();
      arts.forEach((a, i) => {
        if (filterK && cgroup(a) !== filterK) return;
        const key = `${a.year || ""}|${a.doc || "Document"}`;
        if (!map.has(key)) map.set(key, { key, title: a.doc || "Document", year: a.year, rows: [] });
        map.get(key).rows.push([a, i]);
      });
      return [...map.values()];
    };
    const paint = () => {
      const allDocs = groups();
      if (openDoc && !allDocs.some((d) => d.key === openDoc)) openDoc = "";
      const target = openDoc ? allDocs.findIndex((d) => d.key === openDoc) : -1;
      const visible = Math.min(allDocs.length, Math.max(shownDocs, target + 1));
      const docs = allDocs.slice(0, visible);
      const frag = document.createDocumentFragment();
      for (let start = 0; start < docs.length; start += 5) {
        const set = document.createElement("div");
        set.className = "sd-expand-group td-document-set";
        const grid = document.createElement("div");
        grid.className = "sd-index-grid td-document-grid";
        const chunk = docs.slice(start, start + 5);
        chunk.forEach((doc, i) => {
          const id = `td-doc-panel-${start + i}`;
          grid.insertAdjacentHTML("beforeend", indexCard(doc.key, doc.title,
            [doc.year, plural(doc.rows.length, "article", "articles")].filter(Boolean).join(" · "), openDoc === doc.key, id, "data-td-doc"));
        });
        set.appendChild(grid);
        const selected = chunk.find((d) => d.key === openDoc);
        if (selected) {
          const panel = document.createElement("section");
          panel.className = "sd-expand-panel td-document-panel";
          panel.id = `td-doc-panel-${start + chunk.indexOf(selected)}`;
          panel.innerHTML = `<header><div><h4>${esc(selected.title)}</h4><p>${[selected.year, plural(selected.rows.length, "article", "articles")].filter(Boolean).map(esc).join(" · ")}</p></div><button type="button" class="sd-panel-close" data-td-doc-close aria-label="Close document">×</button></header><ol class="td-articles"></ol><button type="button" class="sd-more" data-td-doc-more hidden>Show more</button>`;
          const $ol = panel.querySelector("ol");
          const $more = panel.querySelector("[data-td-doc-more]");
          let shown = 0;
          const page = () => {
            const target = pendingArticle == null ? -1 : selected.rows.findIndex(([, i]) => i === pendingArticle);
            const upto = Math.min(selected.rows.length, Math.max(shown + 10, target + 1));
            selected.rows.slice(shown, upto).forEach(([a, i]) => $ol.appendChild(articleItem(a, i)));
            shown = upto;
            $more.hidden = shown >= selected.rows.length;
            $more.textContent = `Show more (${fmt(selected.rows.length - shown)} left)`;
            if (pendingArticle != null) {
              const el = $ol.querySelector(`#td-art-${pendingArticle}`);
              if (el) { pendingArticle = null; el.classList.add("is-picked"); requestAnimationFrame(() => el.scrollIntoView({ block: "start" })); }
            }
          };
          $more.addEventListener("click", page);
          page();
          set.appendChild(panel);
        }
        frag.appendChild(set);
      }
      $docs.replaceChildren(frag);
      $docsMore.hidden = visible >= allDocs.length;
      $docsMore.textContent = `Show ${Math.min(25, allDocs.length - visible)} more documents (${fmt(allDocs.length - visible)} left)`;
    };
    $docs.addEventListener("click", (e) => {
      const card = e.target.closest("[data-td-doc]");
      if (card) { openDoc = openDoc === card.dataset.tdDoc ? "" : card.dataset.tdDoc; paint(); }
      else if (e.target.closest("[data-td-doc-close]")) { openDoc = ""; paint(); }
    });
    $docsMore.addEventListener("click", () => { shownDocs += 25; paint(); });
    const keys = CGROUPS.map((g) => g[0]).filter((k) => arts.some((a) => cgroup(a) === k));
    if (keys.length > 1) {
      $view.querySelector("[data-td-cchips]").appendChild(chipsFor(keys, cgroupLabel,
        (k) => (k ? arts.filter((a) => cgroup(a) === k).length : arts.length),
        (k) => { filterK = k; openDoc = ""; shownDocs = 25; paint(); }));
    }
    const want = pendingCGroup;
    pendingCGroup = null;
    const chip = want && $view.querySelector(`.td-chip[data-k="${want}"]`);
    if (chip) chip.click();
    if (pendingArticle != null) {
      const row = arts[pendingArticle];
      if (row) openDoc = `${row.year || ""}|${row.doc || "Document"}`;
    }
    paint();
  }
  let pendingArticle = null;
  // a tradition to open Read on (Compare sets it)
  let pendingCGroup = null;

  // ── Confessions: Compare ──────────────────────────────────────
  function renderConfCompare($view, arts, from) {
    const keys = CGROUPS.map((g) => g[0]).filter((k) => arts.some((a) => cgroup(a) === k));
    $view.innerHTML = `${from}<div class="td-cmp" style="--td-cols:${Math.min(4, keys.length)}">${keys.map((k) =>
      `<section class="td-cmp-col"><h4 class="td-cmp-h">${esc(cgroupLabel(k))}</h4><ol class="td-articles" data-g="${k}"></ol></section>`).join("")}</div>`;
    // Five per tradition, so the columns stay side by side; the rest are
    // one click away in Read, already filtered to that tradition.
    keys.forEach((k) => {
      const $ol = $view.querySelector(`.td-articles[data-g="${k}"]`);
      const mine = arts.filter((a) => cgroup(a) === k);
      mine.slice(0, 5).forEach((a) => $ol.appendChild(articleItem(a, null, { short: true })));
      if (mine.length > 5) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "sd-clear td-cmp-all";
        b.textContent = `All ${fmt(mine.length)} in Read`;
        b.addEventListener("click", () => { pendingCGroup = k; setCView("read", true); });
        $ol.after(b);
      }
    });
  }

  // ── Confessions: Trace ────────────────────────────────────────
  function renderConfTrace($view, arts, from) {
    const docs = new Map();
    arts.forEach((a, i) => {
      const k = `${a.doc}|${a.year}`;
      if (!docs.has(k)) docs.set(k, { x: Number(a.year) || 0, row: cgroup(a), label: `${a.year || ""} ${a.doc}`.trim(), n: 0, i });
      docs.get(k).n += 1;
    });
    const items = [...docs.values()].filter((d) => d.x);
    $view.innerHTML = `${from}${method(`<p class="sd-muted td-note">Each point is a document, placed by its date and sized by how many of its articles treat this topic. Select one to read it.</p>`)}<div data-td-tl></div>`;
    timeline($view.querySelector("[data-td-tl]"), items, {
      rows: CGROUPS.filter(([k]) => items.some((d) => d.row === k)),
      colour: (k) => `var(--td-g-${k})`,
      pointLabel: (d) => `${d.label}: ${plural(d.n, "article", "articles")}`,
      onPick(d) { pendingArticle = d.i; setCView("read", true); },
    });
  }

  // ── Teachers: Read (classic treatments) ───────────────────────
  // Migne's section "headings" are the volume's title page in capitals
  // ("S. AURELII AUGUSTINI HIPPONENSIS EPISCOPI, DE PECCATORUM…"); the
  // work's title already says it, better.
  const showHeading = (h) => {
    const t = String(h || "").trim();
    if (!t) return false;
    const letters = t.replace(/[^A-Za-z]/g, "");
    const caps = letters.replace(/[^A-Z]/g, "").length;
    return !(t.length > 40 && letters.length && caps / letters.length > 0.6);
  };

  function treatmentItem(e, opts) {
    const li = document.createElement("li");
    li.className = "td-treat";
    const pid = `tdt-${Math.random().toString(36).slice(2, 9)}`;
    const href = S.sourceHref(e.href, e.w, e.p);
    const who = e.author_id
      ? `<button type="button" class="td-author-link" data-author="${esc(e.author_id)}" data-name="${esc(e.author || "")}" data-trad="${esc(shOf(e) === "ed" ? "" : tradLabel(shOf(e)))}" data-cen="${esc(Number(e.cen) || "")}">${esc(e.author || "")}</button>`
      : `<span class="td-treat-author">${esc(e.author || "")}</span>`;
    li.innerHTML =
      `<p class="td-treat-who">${who} <span class="sd-source-meta">${[S.centuryLabel(e.cen)].filter(Boolean).map(esc).join(" · ")}</span></p>` +
      `<h5 class="td-treat-h"><span class="td-treat-work">${esc(e.title || e.w)}</span>${showHeading(e.heading) ? `<span class="td-treat-sec">${esc(e.heading)}</span>` : ""}</h5>${ 
      e.excerpt && !(opts && opts.bare) ? `<blockquote class="sd-quote td-treat-excerpt"${e.lang ? ` lang="${esc(e.lang)}"` : ""}>${esc(e.excerpt)} …</blockquote>` : "" 
      }<div class="td-treat-actions"><button type="button" class="sd-preview-btn" data-label="Read the section" aria-expanded="false" aria-controls="${pid}">Read the section</button>` +
        `${href ? `<a class="sd-read-link" href="${esc(href)}">Read in context</a>` : ""}</div>` +
      `<div class="sd-preview" id="${pid}" hidden></div>`;
    wirePreview(li, () => S.api("/v1/verse/passage", { w: e.w, p: e.p, t: e.heading || "", max: 6000 }), href);
    return li;
  }

  function renderTreatments($view) {
    const list = ((TREAT && TREAT.loci && TREAT.loci[state.id]) || []).slice();
    const order = expandOrder(["gf", "pl", "po", "md", "rc", "lu", "rf", "ed", "hl"]);
    const keys = order.filter((k) => list.some((e) => shOf(e) === k));
    $view.innerHTML =
      `<div data-td-tchips></div><div class="td-treatment-index" data-td-treatment-index></div>` +
      `<details class="td-all-works"><summary>More indexed works (${fmt((state.data.works || []).length)})</summary><div data-td-works></div></details>`;
    const $index = $view.querySelector("[data-td-treatment-index]");
    if (!list.length) {
      $index.innerHTML = `<p class="sd-muted">No classic treatments are chosen for this topic yet. The indexed works are available below.</p>`;
      $view.querySelector(".td-all-works").open = true;
    }
    let filterK = "";
    let openTreatment = "";
    const keyed = list.map((e, i) => ({ e, key: `${e.w || "work"}|${e.p || 0}|${i}` }));
    const paint = () => {
      const rows = keyed.filter(({ e }) => !filterK || shOf(e) === filterK);
      if (openTreatment && !rows.some((r) => r.key === openTreatment)) openTreatment = "";
      const frag = document.createDocumentFragment();
      for (let start = 0; start < rows.length; start += 5) {
        const set = document.createElement("div");
        set.className = "sd-expand-group td-treatment-set";
        const grid = document.createElement("div");
        grid.className = "sd-index-grid td-treatment-grid";
        const chunk = rows.slice(start, start + 5);
        chunk.forEach(({ e, key }, i) => {
          const id = `td-treatment-panel-${start + i}`;
          grid.insertAdjacentHTML("beforeend", indexCard(key, e.title || e.w,
            [e.author, tradLabel(shOf(e))].filter(Boolean).join(" · "), openTreatment === key, id, "data-td-treatment"));
        });
        set.appendChild(grid);
        const selected = chunk.find((r) => r.key === openTreatment);
        if (selected) {
          const panel = document.createElement("section");
          panel.className = "sd-expand-panel td-treatment-panel";
          panel.id = `td-treatment-panel-${start + chunk.indexOf(selected)}`;
          panel.innerHTML = `<header><div><h4>${esc(selected.e.title || selected.e.w)}</h4><p>${[selected.e.author, tradLabel(shOf(selected.e))].filter(Boolean).map(esc).join(" · ")}</p></div><button type="button" class="sd-panel-close" data-td-treatment-close aria-label="Close treatise">×</button></header><ol class="td-treats"></ol>`;
          panel.querySelector("ol").appendChild(treatmentItem(selected.e));
          set.appendChild(panel);
        }
        frag.appendChild(set);
      }
      $index.replaceChildren(frag);
    };
    $index.addEventListener("click", (e) => {
      const card = e.target.closest("[data-td-treatment]");
      if (card) { openTreatment = openTreatment === card.dataset.tdTreatment ? "" : card.dataset.tdTreatment; paint(); }
      else if (e.target.closest("[data-td-treatment-close]")) { openTreatment = ""; paint(); }
    });
    if (keys.length > 1) {
      $view.querySelector("[data-td-tchips]").appendChild(chipsFor(keys, tradLabel,
        (k) => (k ? list.filter((e) => shOf(e) === k).length : list.length),
        (k) => { filterK = k; openTreatment = ""; paint(); }));
    }
    paint();
    renderWorks($view.querySelector("[data-td-works]"), state.data.works || []);
  }

  /* A titled item that opens the text at its page, in place. Used for
   * confession articles and for the sections of works: both are real
   * places in real texts, so the preview is the text itself. */
  function previewItem(o) {
    const li = document.createElement("li");
    li.className = "sd-source";
    const pid = `tdp-${Math.random().toString(36).slice(2, 9)}`;
    const href = S.sourceHref(o.href, o.w, o.p);
    li.innerHTML =
      `<div class="sd-source-head"><div class="sd-source-id">` +
        `<span class="sd-source-title">${esc(o.title)}</span>${ 
        o.sub ? `<span class="td-source-sub">${esc(o.sub)}</span>` : "" 
        }${o.meta ? `<span class="sd-source-meta">${esc(o.meta)}</span>` : "" 
      }</div><button type="button" class="sd-preview-btn" aria-expanded="false" aria-controls="${pid}">Preview</button></div>` +
      `<div class="sd-preview" id="${pid}" hidden></div>`;
    // t= lets the worker start the window at this heading: a confession
    // page often holds several articles, and conf_topics can be a page off.
    wirePreview(li, () => S.api("/v1/verse/passage", { w: o.w, p: o.p, t: o.heading }), href);
    return li;
  }

  function wirePreview(li, load, href) {
    const $btn = li.querySelector(".sd-preview-btn");
    const $pv = li.querySelector(".sd-preview");
    let loaded = false;
    $btn.addEventListener("click", () => {
      const open = $btn.getAttribute("aria-expanded") !== "true";
      $btn.setAttribute("aria-expanded", String(open));
      $btn.textContent = open ? "Hide" : ($btn.dataset.label || "Preview");
      $pv.hidden = !open;
      if (!open || loaded) return;
      loaded = true;
      $pv.innerHTML = `<p class="sd-muted">Finding the passage…</p>`;
      load().then((d) => {
        const link = S.sourceHref(d && d.href) || href;
        const read = link ? `<a class="sd-read-link" href="${esc(link)}">Read in context</a>` : "";
        if (d && d.found && d.text) {
          // Some editions carry Markdown emphasis round their paragraph
          // numbers (Denzinger's "**796.**"); it is markup, not text.
          const body = String(d.text).replace(/\*\*([^*]+)\*\*/g, "$1").replace(/^#+\s*/gm, "");
          const text = `${d.clipped_start ? "… " : ""}${body}${d.clipped_end ? " …" : ""}`;
          $pv.innerHTML = `<blockquote class="sd-quote"${d.lang ? ` lang="${esc(d.lang)}"` : ""}>${esc(text)}</blockquote>` +
            `<p class="sd-preview-foot">${d.locator ? `<span>${esc(d.locator)}</span>` : ""}${read}</p>`;
        } else {
          const why = d && d.reason === "licensed"
            ? "This edition's text is licensed, so it cannot be previewed here."
            : "The passage could not be extracted from this edition.";
          $pv.innerHTML = `<p class="sd-muted">${why}</p><p class="sd-preview-foot">${read}</p>`;
        }
      }).catch(() => {
        loaded = false;
        $btn.setAttribute("aria-expanded", "false");
        $btn.textContent = $btn.dataset.label || "Preview";
        $pv.hidden = false;
        $pv.innerHTML = `<p class="sd-muted">The passage did not load. Select ${esc($btn.textContent)} to try again.</p>`;
      });
    });
  }

  /* One verified quotation. The quote is the author's own words, so it
   * is shown at once; "More context" reads the whole page around it. The
   * author's name opens the sidebar with everything they say here. */
  function quoteItem(row) {
    const li = document.createElement("li");
    li.className = "sd-source td-quote-item";
    const pid = `tdq-${Math.random().toString(36).slice(2, 9)}`;
    // The worker's reader link carries q= so the reader highlights the
    // quotation; keep it when it has exactly that shape.
    const href = /^\/the-faith-received\/reader\/\?c=[a-z]+&w=[^&#"]+&(?:p=\d+&)?q=[^#"]*$/.test(String(row.href || ""))
      ? row.href : S.sourceHref(row.href, row.w, row.p);
    const meta = [row.wt, row.locus, S.centuryLabel(row.cen)].filter(Boolean).map(esc).join(" · ");
    li.innerHTML =
      `<blockquote class="sd-quote"${row.lang ? ` lang="${esc(row.lang)}"` : ""}>${esc(row.quote)}</blockquote>` +
      `<div class="sd-source-head td-quote-foot"><div class="sd-source-id">` +
        `<button type="button" class="td-author-link" data-author="${esc(row.author_id || "")}" data-name="${esc(row.a || "")}" data-trad="${esc(shOf(row) === "ed" ? "" : tradLabel(shOf(row)))}" data-cen="${esc(row.cen || "")}">${esc(row.a || "")}</button>` +
        `<span class="sd-source-meta">${meta}</span>` +
      `</div><button type="button" class="sd-preview-btn" data-label="More context" aria-expanded="false" aria-controls="${pid}">More context</button></div>` +
      `<div class="sd-preview" id="${pid}" hidden></div>`;
    // t= is the quote's opening, so the window starts at the quotation
    // rather than the top of the page (2 of 12 hits without it, 9 with).
    wirePreview(li, () => S.api("/v1/verse/passage", { w: row.w, p: row.p, t: String(row.quote || "").slice(0, 80) }), href);
    return li;
  }

  function renderWorks($host, works) {
    if (!works.length) {
      $host.innerHTML = `<p class="sd-muted">No treatise in the library is catalogued under this topic by itself.</p>`;
      return;
    }
    let openWork = "";
    const rows = works.map((w, i) => ({ w, key: `${w.w || "work"}|${i}` }));
    const paint = () => {
      const frag = document.createDocumentFragment();
      for (let start = 0; start < rows.length; start += 5) {
        const set = document.createElement("div");
        set.className = "sd-expand-group td-work-set";
        const grid = document.createElement("div");
        grid.className = "sd-index-grid td-work-grid";
        const chunk = rows.slice(start, start + 5);
        chunk.forEach(({ w, key }, i) => {
          const id = `td-work-panel-${start + i}`;
          const secs = w.secs || [];
          grid.insertAdjacentHTML("beforeend", indexCard(key, w.t || w.w,
            [w.a, secs.length ? plural(secs.length, "relevant section", "relevant sections") : S.centuryLabel(w.cen)].filter(Boolean).join(" · "), openWork === key, id, "data-td-work"));
        });
        set.appendChild(grid);
        const selected = chunk.find((r) => r.key === openWork);
        if (selected) {
          const {w} = selected;
          const panel = document.createElement("section");
          panel.className = "sd-expand-panel td-work-panel";
          panel.id = `td-work-panel-${start + chunk.indexOf(selected)}`;
          panel.innerHTML = `<header><div><h4>${esc(w.t || w.w)}</h4><p>${[w.a, S.centuryLabel(w.cen)].filter(Boolean).map(esc).join(" · ")}</p></div><button type="button" class="sd-panel-close" data-td-work-close aria-label="Close work">×</button></header><div class="td-work-panel-body"></div>`;
          const body = panel.querySelector(".td-work-panel-body");
          const secs = w.secs || [];
          if (secs.length) {
            const ol = document.createElement("ol");
            ol.className = "sd-sources";
            secs.forEach((s) => ol.appendChild(previewItem({ title: s.t, heading: s.t, w: w.w, p: s.p, href: s.href, meta: s.p ? `p. ${s.p}` : "" })));
            body.appendChild(ol);
          } else {
            const href = S.sourceHref(w.href, w.w);
            body.innerHTML = href ? `<p><a class="sd-read-link" href="${esc(href)}">Read this work</a></p>` : `<p class="sd-muted">No section headings are indexed for this work.</p>`;
          }
          set.appendChild(panel);
        }
        frag.appendChild(set);
      }
      $host.replaceChildren(frag);
    };
    $host.addEventListener("click", (e) => {
      const card = e.target.closest("[data-td-work]");
      if (card) { openWork = openWork === card.dataset.tdWork ? "" : card.dataset.tdWork; paint(); }
      else if (e.target.closest("[data-td-work-close]")) { openWork = ""; paint(); }
    });
    paint();
  }

  // ── Teachers: Compare ─────────────────────────────────────────
  function renderTeachCompare($view) {
    const d = state.data;
    const list = (TREAT && TREAT.loci && TREAT.loci[state.id]) || [];
    const present = new Set([...list.map((e) => shOf(e)), ...(d.authors || []).map((a) => shOf(a))]);
    const avail = expandOrder(TRADS.map(([k]) => k)).filter((k) => present.has(k)).map((k) => [k, tradLabel(k)]);
    const pick = ["rc", "lu", "rf"].filter((k) => present.has(k));
    while (pick.length < Math.min(3, avail.length)) pick.push(avail.find(([k]) => !pick.includes(k))[0]);
    const select = (i) => `<label class="sd-filter"><span class="sd-filter-label">Tradition ${i + 1}</span><select data-td-cmp="${i}">${
      avail.map(([k, lab]) => `<option value="${k}"${pick[i] === k ? " selected" : ""}>${esc(lab)}</option>`).join("")}</select></label>`;
    $view.innerHTML = avail.length
      ? `<div class="sd-filter-row td-cmp-pick">${pick.map((_, i) => select(i)).join("")}</div><div class="td-cmp" data-td-cmp-cols></div>`
      : `<p class="sd-muted">Not enough traditions are indexed on this topic to compare.</p>`;
    if (!avail.length) return;
    const paint = () => {
      const keys = [...$view.querySelectorAll("[data-td-cmp]")].map((s) => s.value);
      const $cols = $view.querySelector("[data-td-cmp-cols]");
      $cols.style.setProperty("--td-cols", String(Math.max(1, keys.length)));
      $cols.innerHTML = keys.map((k) => `<section class="td-cmp-col"><h4 class="td-cmp-h">${esc(tradLabel(k))}</h4><div data-td-col></div></section>`).join("");
      const hosts = $cols.querySelectorAll("[data-td-col]");
      keys.forEach((k, i) => {
        const ts = list.filter((e) => shOf(e) === k);
        const authors = (d.authors || []).filter((a) => shOf(a) === k).slice(0, 6);
        hosts[i].innerHTML = `<h5 class="td-cmp-sub">Classic treatments</h5>${ts.length ? `<ol class="td-treats"></ol>` : `<p class="sd-muted">None chosen yet.</p>`}` +
          `<h5 class="td-cmp-sub">Who wrote most on it</h5>${authors.length ? `<ol class="td-cmp-authors">${authors.map((a) =>
            `<li><button type="button" class="td-author-link" data-author="${esc(a.id)}">${esc(a.a)}</button> <span class="sd-muted">${esc(S.centuryLabel(a.cen))}</span></li>`).join("")}</ol>` : `<p class="sd-muted">None indexed.</p>`}`;
        const $ol = hosts[i].querySelector(".td-treats");
        if ($ol) ts.forEach((e) => $ol.appendChild(treatmentItem(e, { bare: true })));
      });
    };
    $view.querySelectorAll("[data-td-cmp]").forEach((s) => s.addEventListener("change", paint));
    paint();
  }

  // ── Teachers: Trace (the timeline) ────────────────────────────
  const phone = window.matchMedia("(max-width: 640px)");
  function renderTeachTrace($view) {
    const authors = (state.data.authors || []).filter((a) => Number(a.y) > 0);
    const shelves = ["gf", "pl", "po", "md", "rc", "lu", "rf", "ed", "hl"];
    const order = expandOrder(shelves);
    const cenOf = (x) => Math.floor((x - 1) / 100) + 1;
    let items = authors.map((a) => ({ x: Number(a.y) + 40, row: shOf(a), n: Number(a.n) || 0, label: a.a, id: a.id, a }));
    // On a phone, 370 authors are 370 specks on a 300px strip. One point
    // per tradition per century instead; tapping it lists who is in it.
    const grouped = phone.matches;
    if (grouped) {
      const g = new Map();
      items.forEach((d) => {
        const key = `${d.row}|${cenOf(d.x)}`;
        if (!g.has(key)) g.set(key, { x: (cenOf(d.x) - 1) * 100 + 50, row: d.row, n: 0, people: [] });
        const b = g.get(key);
        b.n += d.n;
        b.people.push(d);
      });
      items = [...g.values()];
    }
    $view.innerHTML =
      `${method(`<p class="sd-muted td-note">Everyone the library holds on ${esc(INDEX.get(state.id).locus.label.toLowerCase())}, placed by when they wrote, a row for each tradition, and sized by how much they wrote on it. ${grouped ? "Each point is a century; select one to see who wrote then." : "Select anyone to read what they said."}</p>`)}` +
      `<div data-td-tl></div><div class="td-tl-people" data-td-people></div>`;
    const $people = $view.querySelector("[data-td-people]");
    timeline($view.querySelector("[data-td-tl]"), items, {
      label: "Authors by date",
      rows: order.filter((k) => items.some((d) => d.row === k)).map((k) => [k, tradLabel(k)]),
      colour: (k) => `var(--td-c-${shelves.includes(baseOf(k)) ? baseOf(k) : "x"})`,
      pointLabel: (d) => (grouped
        ? `${tradLabel(d.row)}, ${S.centuryLabel(cenOf(d.x))}: ${plural(d.people.length, "author", "authors")}`
        : `${d.label}, ${S.centuryLabel(cenOf(d.x))}`),
      authorPoints: !grouped,
      onPick(d) {
        $people.innerHTML = `<h5 class="sd-h3">${esc(tradLabel(d.row))}, ${esc(S.centuryLabel(cenOf(d.x)))}</h5><ol class="td-cmp-authors">${
          d.people.sort((a, b) => b.n - a.n).map((p) => `<li><button type="button" class="td-author-link" data-author="${esc(p.id)}" data-name="${esc(p.label)}">${esc(p.label)}</button></li>`).join("")}</ol>`;
        $people.scrollIntoView({ block: "nearest" });
      },
    });
  }

  /* One strip of time, a row per tradition, each point placed by its
   * date: the Connections timeline, for one topic. Points are buttons
   * positioned in percent, so the strip is as wide as the page on any
   * screen and every point can be reached by keyboard. */
  function timeline($host, items, o) {
    if (!items.length) { $host.innerHTML = `<p class="sd-muted">Nothing here is dated closely enough to place on a timeline.</p>`; return; }
    const xs = items.map((d) => d.x);
    const lo = Math.floor(Math.min(...xs) / 100) * 100;
    const hi = Math.ceil((Math.max(...xs) + 1) / 100) * 100;
    const span = Math.max(100, hi - lo);
    const pos = (x) => ((x - lo) / span) * 100;
    const maxN = Math.max(...items.map((d) => d.n || 1)) || 1;
    const size = (n) => Math.round(8 + 18 * Math.sqrt((n || 1) / maxN));
    const step = span > 1200 ? 200 : 100;
    const ticks = [];
    for (let y = lo; y <= hi; y += step) ticks.push(y);
    $host.innerHTML =
      `<div class="td-tl" role="group" aria-label="${esc(o.label || "Timeline")}. Arrow keys move along a row.">${ 
        o.rows.map(([k, lab]) => `<div class="td-tl-row"><span class="td-tl-label">${esc(lab)}</span><div class="td-tl-track">${
          items.filter((d) => d.row === k).sort((a, b) => (b.n || 0) - (a.n || 0)).map((d) => {
            const s = size(d.n);
            return `<button type="button" class="td-tl-pt${d.id ? " td-author-link" : ""}"${d.id ? ` data-author="${esc(d.id)}" data-name="${esc(d.label)}"` : ""} data-i="${items.indexOf(d)}" style="left:${pos(d.x).toFixed(2)}%;width:${s}px;height:${s}px;background:${o.colour(k)}" title="${esc(o.pointLabel(d))}" aria-label="${esc(o.pointLabel(d))}"></button>`;
          }).join("")}</div></div>`).join("") 
        }<div class="td-tl-row td-tl-axis"><span class="td-tl-label"></span><div class="td-tl-track">${ticks.map((y) =>
          `<span class="td-tl-tick" style="left:${pos(y).toFixed(2)}%">${y === 0 ? "AD 1" : y}</span>`).join("")}</div></div>` +
      `</div>`;
    if (!o.authorPoints) {
      $host.addEventListener("click", (e) => {
        const b = e.target.closest(".td-tl-pt");
        if (b) o.onPick(items[Number(b.dataset.i)]);
      });
    }
    // One tab stop per row, arrow keys along it (roving tabindex): with
    // every point a stop, getting past 370 authors took 370 presses.
    $host.querySelectorAll(".td-tl-track").forEach((track) => {
      const pts = [...track.querySelectorAll(".td-tl-pt")].sort((a, b) => parseFloat(a.style.left) - parseFloat(b.style.left));
      pts.forEach((p, i) => p.setAttribute("tabindex", i ? "-1" : "0"));
      track.addEventListener("keydown", (e) => {
        const i = pts.indexOf(document.activeElement);
        if (i < 0) return;
        const j = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? pts.length - 1 : null;
        if (j == null || !pts[j]) return;
        e.preventDefault();
        pts[i].setAttribute("tabindex", "-1");
        pts[j].setAttribute("tabindex", "0");
        pts[j].focus();
      });
    });
  }

  // ── Scripture: the proof-texts ────────────────────────────────
  const LIB_TO_BOOK = new Map(S.BOOKS.map((b) => [b.lib, b]));
  /* rows given: a confession block's proofs (cited in N articles);
   * rows null: the teachers' proof-texts from /v1/topic/scripture. */
  function renderScripture($view, given, from) {
    const {locus} = INDEX.get(state.id);
    const conf = Boolean(given);
    $view.innerHTML = `${from || "" 
      }${method(`<p class="sd-muted td-note">${conf
        ? "The proof-texts the confessions cite in their articles on this topic, most cited first. Each opens its Verse Desk."
        : `The passages the teachers cite where they treat ${esc(locus.label.toLowerCase())}, those most particular to it first. Each opens its Verse Desk.`}</p>`)}` +
      `<ol class="td-proofs" data-td-proofs><li class="sd-muted">Loading…</li></ol>` +
      `<button type="button" class="sd-more" data-td-pmore hidden>Show more</button>`;
    const $ol = $view.querySelector("[data-td-proofs]");
    const $more = $view.querySelector("[data-td-pmore]");
    const load = conf ? Promise.resolve({ rows: given }) : S.api("/v1/topic/scripture", { id: state.id, t2: locus.t2, limit: 60 });
    load.then((r) => {
      const rows = ((r && r.rows) || []).filter((x) => LIB_TO_BOOK.has(x.b));
      if (!rows.length) { $ol.innerHTML = `<li class="sd-muted">No passages are linked to this topic yet.</li>`; return; }
      const max = Math.max(...rows.map((x) => Number(x.n) || 0)) || 1;
      let shown = 0;
      const t = S.recalledTranslation();
      const page = () => {
        rows.slice(shown, shown + 15).forEach((x) => {
          const book = LIB_TO_BOOK.get(x.b);
          const c = Number(x.c) || 1;
          const v = Number(x.v) || 0;
          const li = document.createElement("li");
          li.className = "td-proof";
          li.innerHTML =
            `<div class="td-proof-head"><a class="td-proof-ref" href="${esc(S.deskHref(book, c, v, t === "ESV" ? "" : t))}">${esc(S.refLabel(book, c, v))}</a>` +
            `<span class="sd-cbar-track td-proof-bar"><span class="sd-cbar-fill" style="width:${Math.max(2, Math.round(((Number(x.n) || 0) / max) * 100))}%"></span></span>` +
            `<span class="sd-cbar-n td-proof-n">${conf ? `in ${plural(Number(x.n) || 0, "article", "articles")}` : `cited ${fmt(x.n)}×`}</span></div>` +
            `<p class="td-proof-text sd-muted">…</p>`;
          $ol.appendChild(li);
          if (v) {
            S.fetchVerseText(t, book, c, v)
              .then((txt) => { li.querySelector(".td-proof-text").textContent = txt || ""; })
              .catch(() => { li.querySelector(".td-proof-text").textContent = ""; });
          } else li.querySelector(".td-proof-text").textContent = "";
        });
        shown += 15;
        $more.hidden = shown >= rows.length;
      };
      $ol.innerHTML = "";
      page();
      $more.addEventListener("click", page);
    }).catch(() => { $ol.innerHTML = `<li class="sd-muted">Passages did not load.</li>`; });
  }

  // ── The sidebar: one author on this topic ─────────────────────
  function openAuthor(authorId, $from) {
    const d = state.data;
    // The topic's author list holds its top 400; anyone else is known
    // from the quotation that was clicked.
    const a = ((d && d.authors) || []).find((x) => x.id === authorId) || ($from && $from.dataset.name ? {
      id: authorId, a: $from.dataset.name, trad: $from.dataset.trad,
      cen: Number($from.dataset.cen) || 0, n: 0,
    } : null);
    const {locus} = INDEX.get(state.id);
    $panel.innerHTML =
      `<header class="sd-panel-head">` +
        `<p class="sd-eyebrow">On ${esc(locus.label.toLowerCase())}</p>` +
        `<h2 class="sd-panel-ref" tabindex="-1">${esc(a ? a.a : "Author")}</h2>` +
        `<p class="sd-source-meta td-panel-meta">${a ? [a.sh ? (shOf(a) === "ed" ? "" : tradLabel(shOf(a))) : a.trad, a.y ? `b. ${a.y}` : S.centuryLabel(a.cen), a.n ? `${fmt(a.n)} positions here` : ""].filter(Boolean).map(esc).join(" · ") : ""}</p>` +
        `<button type="button" class="sd-close" aria-label="Close author panel">Close</button>` +
      `</header>` +
      `<h3 class="sd-h3">Their works on this topic</h3><ol class="td-side-works"></ol>` +
      `<h3 class="sd-h3">In their words</h3><ol class="sd-sources" data-td-arows><li class="sd-muted">Loading…</li></ol>` +
      `<button type="button" class="sd-more" data-td-amore hidden>Show more</button>`;
    const works = ((d && d.works) || []).filter((w) => a && w.a === a.a);
    const $w = $panel.querySelector(".td-side-works");
    $w.innerHTML = works.length
      ? works.map((w) => `<li><a href="${esc(S.sourceHref(w.href, w.w))}">${esc(w.t)}</a></li>`).join("")
      : `<li class="sd-muted">No treatise of theirs is catalogued under this topic.</li>`;
    $panel.querySelector(".sd-close").addEventListener("click", () => closePanel($from));
    const $rows = $panel.querySelector("[data-td-arows]");
    const $more = $panel.querySelector("[data-td-amore]");
    let offset = 0;
    const load = (more) => {
      $more.disabled = true;
      S.api("/v1/topic/sources", { t2: locus.t2, au: authorId, offset, limit: 10 }).then((r) => {
        $more.disabled = false;
        if (!more) $rows.innerHTML = "";
        ((r && r.rows) || []).forEach((row) => $rows.appendChild(quoteItem(row)));
        if (!$rows.children.length) $rows.innerHTML = `<li class="sd-muted">No verified quotations of theirs on this topic yet.</li>`;
        offset = (r && r.next_offset) || 0;
        $more.hidden = !offset;
      }).catch(() => { $more.disabled = false; $rows.innerHTML = `<li class="sd-muted">Did not load.</li>`; });
    };
    $more.addEventListener("click", () => load(true));
    load(false);
    if (narrow.matches) {
      // Never inside a button: a timeline point opens the panel under
      // the whole timeline (inside the dot it measured 34px wide).
      const li = $from && $from.closest("li");
      const tl = $from && $from.closest(".td-tl");
      if (li) li.appendChild($panel);
      else if (tl) tl.after($panel);
      else if ($from) $from.after($panel);
      $side.hidden = true;
      $root.classList.remove("has-side");
    } else {
      $side.appendChild($panel);
      $side.hidden = false;
      $root.classList.add("has-side");
    }
    const $ref = $panel.querySelector(".sd-panel-ref");
    if ($ref) $ref.focus({ preventScroll: !narrow.matches });
  }

  function closePanel($from) {
    $panel.remove();
    if ($side) $side.hidden = true;
    $root.classList.remove("has-side");
    if ($from && $from.isConnected) $from.focus({ preventScroll: true });
  }

  let lastAuthorBtn = null;
  $root.addEventListener("click", (e) => {
    const b = e.target.closest(".td-author-link");
    if (!b || !b.dataset.author) return;
    // A name inside the panel is replaced when the panel re-renders, so
    // focus returns to whatever opened the panel in the first place.
    const opener = $panel.contains(b) ? lastAuthorBtn : b;
    lastAuthorBtn = opener;
    openAuthor(b.dataset.author, opener);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !$panel.isConnected) return;
    if (e.target.closest && e.target.closest("input, select, textarea")) return;
    closePanel(lastAuthorBtn);
  });

  // ── Routing ───────────────────────────────────────────────────
  function route() {
    const qs = new URLSearchParams(location.search);
    let t = qs.get("t");
    // The old Topics page linked topics as #<topic slug> (the mined topic2
    // slugs); links across the site still do. Resolve to the locus that
    // holds that slug, as its own topic or as an alias.
    if (!t && location.hash.length > 1) {
      const slug = decodeURIComponent(location.hash.slice(1)).replace(/^t=/, "").toLowerCase();
      for (const [id, hit] of INDEX) {
        if (hit.locus.t2 === slug || (hit.locus.aliases || []).includes(slug)) { t = id; break; }
      }
      if (t) history.replaceState(null, "", topicHref(t));
    }
    if (t && INDEX.has(t)) {
      const ok = (v) => (VIEWS.some((x) => x[0] === v) ? v : "read");
      if (t === state.id && $main && $main.isConnected) {
        const c = ok(qs.get("c"));
        const v = ok(qs.get("view"));
        if (c !== state.cview) setCView(c, false);
        if (v !== state.view) setView(v, false);
        return;
      }
      renderLocus(t, ok(qs.get("view")), ok(qs.get("c")));
    } else {
      state.id = "";
      // An unknown ?t= shows the contents under their own address.
      if (t) history.replaceState(null, "", BASE);
      renderContents();
    }
    window.scrollTo(0, 0);
  }
  window.addEventListener("popstate", route);
  narrow.addEventListener("change", () => { if ($panel.isConnected) closePanel(null); });

  // The denomination table must be in before the first render, or the
  // English groups paint once as "Other English writers" and then split.
  Promise.all([loadLoci(), DEN ? DEN.ready() : null]).then(route).catch(() => {
    $root.innerHTML = `<p class="bible-status is-error" role="alert">The topics did not load. Reload the page to try again.</p>`;
  });
})();
