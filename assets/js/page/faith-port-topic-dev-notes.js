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

  // The shared graphics module (tradition-graphics.js) fetches its author dates key from this host; on Mere Orthodoxy that is the
  // library worker, as every script on this page already assumes. Set before the module's first lookup, which is in this file.
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

  /* THE TOPIC IN GRAPHICS (2026-10-22), as The Faith Received's topic page draws it since that day's restructure (topic-notes.js;
   * owner: "restructure /topics … i would love more graphics and ui similar to /maps"). Three sections in the maps page's
   * language, drawn by FRTraditionGraphics (assets/js/port/tradition-graphics.js, a copy of the library's own module) under the
   * Topic Desk's hero, each named in the hero's "On this page" row:
   *   Authors through time   the topic's authors by quarter-century and tradition (v1/mine/topic2-all/<t2>.json, every author the
   *                          library indexes on it, not the four hundred of /v1/topic), the most recorded voice of each era
   *                          named at his year;
   *   Disputed questions     the atlas questions of the topic as one map: a row a question, its authors by century, its positions
   *                          as one divided bar, its doors to the map, every answer and the controversies; the question chosen
   *                          opens its positions below as the maps draw them (v1/maps/q/<id>.json), each author's pages with a
   *                          Preview of the page itself (page-window.js);
   *   Scripture by chapter   the chapters of the verses most particular to the topic along the canon, each opening the reader.
   * The centuries, the controversies and the Scripture come from one key, v1/enrich/topic_graphics.json; without it the map keeps
   * its bars and doors and the band is left out. The atlas has loci and a topic has its own slug (the locus's t2 in loci.json):
   * LOCI and NARROW, the library's tables in topic-notes.js, join them. Without the module, or when nothing can be drawn, the
   * page is as it was. */
  const MAPS = "/the-faith-received/maps/#";
  const ATLAS = "/the-faith-received/disputed-questions/#";
  const CONTROVERSIES = "/the-faith-received/controversies/#";
  const SCRIPTURE = "/the-faith-received/scripture/?ref=";
  const GRAPHICS = "/v1/enrich/topic_graphics.json";
  const LOCI = {
    "Scripture": ["scripture", "the-word-of-god"],
    "God": ["god"],
    "Predestination": ["predestination", "election", "election-predestination"],
    "Trinity": ["the-trinity"],
    "Christ": ["christ-christology"],
    "Man and sin": ["sin", "man-anthropology"],
    "Grace": ["grace"],
    "Justification": ["justification"],
    "Church": ["the-church"],
    "Sacraments": ["sacraments"],
    "Worship and the saints": ["religion-true-worship"],
    "Last things": ["last-things"],
    "Law and ethics": ["virtues-moral-theology"],
    "Philosophy in theology": ["prolegomena-theological-method"],
    "Creation and providence": ["providence", "creation"],
    "Angels and demons": ["angels"],
    "Covenant": ["covenant"],
    "Revelation and reason": ["revelation", "reason"],
    "Repentance and conversion": ["repentance", "conversion", "conversion-repentance"],
    "Sanctification and good works": ["sanctification", "good-works", "good-works-sanctification"],
    "Prayer": ["prayer"],
    "Ministry and church order": ["ministry", "ministry-holy-orders", "ministry-orders"],
    "Christ's work": ["redemption", "christ-christology", "atonement"],
    "Mary and the saints": ["the-virgin-mary"],
    "Soul and death": ["death", "last-things"],
    "Papal power and the civil order": ["the-civil-magistrate"],
    "Law and Gospel": ["law-and-gospel", "the-gospel"],
    "Councils and Fathers": ["tradition"],
    "Christian life": ["christian-liberty"],
    "Being and the transcendentals": ["prolegomena-theological-method"],
    "Matter, form and the categories": ["form-and-matter"],
    "Causes, potency and act": ["causality"],
    "God in metaphysics": ["god"],
  };
  /* Narrower topics take single disputed questions from any locus (q + atlas id). A topic named in LOCI keeps its loci and adds
   * these. (The library's table also names parts of its shared questions, "topic/part"; Mere Orthodoxy has no page of those, so
   * only the question ids are read here.) */
  const NARROW = {
    "the-existence-of-god": "q010 q011 q327 q329",
    "divine-simplicity": "q012 q013 q301",
    "the-divine-attributes-their-distinction": "q012 q013 q020 q258 q261 q262 q301",
    "god-s-knowledge-middle-knowledge": "q014 q260 q325 q326",
    "omnipotence-absolute-power": "q019 q141 q262",
    "the-will-of-god": "q017 q024 q263 q326",
    "god-s-will": "q017 q024 q263",
    "the-eternity-of-god": "q258 q330",
    "divine-omnipresence-immensity": "q330",
    "justice-of-god": "q017",
    "divine-justice": "q017",
    "providence": "q015 q016 q260",
    "creation": "q018 q145 q316",
    "the-beatific-vision": "q043 q111 q259",
    "beatitude": "q111 q259",
    "beatitude-eternal-life": "q111 q259",
    "eternal-life": "q064 q111 q158 q259",
    "the-filioque-the-procession-of-the-spirit": "q026",
    "subsistent-relations-the-divine-persons": "q027 q266 q307",
    "the-divine-processions-eternal-generation": "q026 q028 q031 q266",
    "the-holy-spirit": "q026 q030 q059 q171 q230",
    "the-word": "q028 q029 q031",
    "incarnation": "q020 q032 q035 q292 q293",
    "the-cross": "q039 q195 q197 q198",
    "atonement": "q039 q040",
    "redemption": "q039 q040 q041",
    "salvation-redemption": "q039 q040 q195 q198",
    "sacrifice": "q039 q093",
    "merit": "q038 q055 q064 q179",
    "good-works-merit": "q064 q179",
    "original-sin": "q042 q044 q045 q048 q289",
    "free-will": "q047 q053 q054 q055 q056 q231 q319 q320",
    "the-will": "q132 q319 q320",
    "the-image-of-god": "q051",
    "the-soul": "q046 q129 q133 q210 q211 q317 q318",
    "the-soul-intellect-and-will": "q132 q317 q318 q319",
    "the-intellect": "q132 q317 q321 q322",
    "knowledge": "q163 q321 q322",
    "conscience": "q125",
    "virtues-moral-theology": "q175 q290",
    "charity": "q059 q063",
    "charity-love": "q059 q063",
    "idolatry": "q095 q103 q104 q105 q207",
    "satan": "q148 q149 q151",
    "perseverance": "q057",
    "perseverance-of-the-saints": "q057",
    "assurance": "q058",
    "assurance-of-salvation": "q058",
    "effectual-calling": "q053 q054 q171 q232",
    "calling": "q053 q054 q232",
    "salvation-of-the-unevangelized": "q060 q159 q287 q288",
    "salvation": "q024 q060 q065 q159 q279 q288",
    "regeneration": "q089 q171 q172",
    "faith": "q062 q063 q069 q156 q160 q161 q167 q172 q229",
    "imputation": "q041 q045 q061 q196 q286",
    "good-works": "q064 q065",
    "good-works-necessity": "q064 q065",
    "reprobation": "q022 q023",
    "forgiveness": "q097 q168 q169",
    "antichrist": "q078",
    "schism": "q082 q239 q278",
    "heresy": "q081 q090 q278",
    "excommunication": "q190",
    "discipline": "q190 q191",
    "persecution": "q081 q245",
    "the-civil-magistrate": "q080 q081 q117 q118 q123 q125",
    "ministry": "q079 q083",
    "ordination": "q083 q101 q188 q192",
    "holy-orders": "q079 q083 q100 q101",
    "ministry-holy-orders": "q079 q083 q100 q101",
    "ministry-orders": "q079 q083 q100 q101",
    "preaching": "q193 q227 q281",
    "tradition": "q004 q234",
    "baptism": "q048 q087 q088 q089 q090 q115 q157 q269 q275",
    "the-lord-s-supper": "q034 q091 q092 q093 q094 q095 q102 q268 q272 q273 q274 q276 q305",
    "the-eucharist": "q034 q091 q092 q093 q094 q095 q102 q268 q272 q273 q274 q276 q305",
    "the-lord-s-sacrament": "q091 q092 q093 q094 q095 q102 q268 q272 q273 q274 q276",
    "the-mass": "q091 q093 q094 q095 q272 q276",
    "penance": "q096 q097 q098 q166 q168",
    "repentance-penance": "q096 q097 q166 q168",
    "confession": "q096",
    "absolution": "q096",
    "contrition": "q166",
    "indulgences": "q097 q098",
    "purgatory": "q097 q106 q107 q212",
    "marriage": "q099 q100",
    "matrimony": "q099 q100",
    "marriage-and-divorce": "q099",
    "divorce": "q099",
    "marriage-celibacy": "q099 q100",
    "marriage-and-family": "q099",
    "confirmation": "q270",
    "anointing-of-the-sick": "q270",
    "circumcision": "q271",
    "sabbath": "q109 q242",
    "vows": "q108 q175 q246",
    "oaths-and-vows": "q108 q121",
    "monasticism": "q108 q175 q246",
    "oaths": "q120 q121",
    "oaths-and-perjury": "q120 q121",
    "fasting": "q240 q241",
    "resurrection": "q113 q210",
    "hell": "q114 q197 q214 q215",
    "judgment": "q215 q216 q218",
    "salvation-of-infants": "q115 q157 q229",
    "usury": "q116 q248",
    "contracts": "q116 q248",
    "wealth-and-poverty": "q116 q246",
    "natural-law": "q122",
    "justice": "q119 q248",
    "truth": "q120 q297 q298",
    "the-law": "q052 q122 q123 q174 q177 q178 q226 q227 q228",
    "prophecy": "q164 q165",
    "prophets": "q164",
    "miracles": "q140 q164",
    "reason": "q010 q133 q134 q264",
    "salvation-history": "q153 q154 q158",
    "perfection": "q170 q175",
    "christian-liberty": "q110 q178",
    "the-lord-s-prayer": "q184",
    "the-virgin-mary": "q042 q292",
    "time": "q018 q258 q312",
    "motion": "q142 q309 q329",
    "good": "q297 q299",
    "goodness": "q297 q299",
    "the-world": "q018 q135 q141 q216",
  };
  const placeOf = (slug) => ({
    loci: Object.keys(LOCI).filter((l) => LOCI[l].includes(slug)),
    ids: String(NARROW[slug] || "").split(/\s+/).filter((t) => /^q\d+$/.test(t)),
  });
  // The topic's own loci first, then the loci its single questions come from, largest first; atlas order within each.
  function disputedOf(ax, where) {
    const ids = new Set(where.ids);
    const groups = new Map();
    for (const q of ((ax && ax.questions) || []).filter((x) => where.loci.includes(x.locus) || ids.has(x.id))) {
      if (!groups.has(q.locus)) groups.set(q.locus, []);
      groups.get(q.locus).push(q);
    }
    const own = (l) => where.loci.indexOf(l);
    return [...groups.entries()].sort((a, b) => {
      const oa = own(a[0]);
      const ob = own(b[0]);
      if (oa >= 0 || ob >= 0) return (oa < 0 ? 99 : oa) - (ob < 0 ? 99 : ob);
      return b[1].length - a[1].length;
    });
  }

  const fmt = (n) => Number(n || 0).toLocaleString("en-US");
  const nOf = (n, one, many) => `${fmt(n)} ${n === 1 ? one : many}`;
  const readURL = (w, p) => `${READ}${encodeURIComponent(w)}#b${encodeURIComponent(p)}-0`;
  // The Scripture reader names numbered books 1-, 2-, 3- and the last book "revelation"; the library's slugs use roman numerals.
  const scriptureHref = (slug, c) => `${SCRIPTURE}${String(slug).replace(/^iii-/, "3-").replace(/^ii-/, "2-").replace(/^i-/, "1-").replace(/^revelation-of-john$/, "revelation")}.${Number(c)}`;
  // Each index is fetched once a visit; a failed fetch is forgotten so the next topic tries again.
  const once = (() => {
    const seen = new Map();
    return (p) => {
      if (!seen.has(p)) seen.set(p, getJSON(`${BASE}${p}`).then((d) => { if (!d) seen.delete(p); return d; }));
      return seen.get(p);
    };
  })();

  // The most recorded named voice of each of the library's eras, named over the strip at his year.
  const UNNAMED = /^(unknown author|anonymous|various|unattributed)\b/i;
  function eraVoices(G, authors) {
    const best = new Map();
    for (const a of authors) {
      const y = Number(a.y) || (G.year ? G.year({ a: a.a }) : 0);
      if (!(y > 0) || UNNAMED.test(a.a || "") || (String(a.a || "").match(/,/g) || []).length >= 2) continue;
      const era = G.ERAS.findIndex(([lo, hi]) => y >= lo && y < hi);
      if (era < 0) continue;
      const cur = best.get(era);
      if (!cur || (a.np || 0) > (cur.np || 0)) best.set(era, a);
    }
    const voices = [...best.values()].filter((a) => (a.np || 0) > 0);
    const rank = voices.slice().sort((a, z) => (z.np || 0) - (a.np || 0));
    return voices.map((a) => {
      const y = Number(a.y) || (G.year ? G.year({ a: a.a }) : 0);
      const dt = a.dt || (G.dates ? G.dates.label(a.a) : "");
      return { y, label: a.a, p: rank.indexOf(a), sub: /^\d{3,4}–\d{3,4}$/.test(dt || "") ? dt : String(y) };
    });
  }
  function questionRows(groups, mx, tg, cx) {
    const maps = new Map(((mx && mx.questions) || []).map((q) => [q.id, q]));
    const keyed = (tg && tg.questions) || {};
    const titles = (cx && cx.debates) || {};
    return groups.flatMap(([, list]) => list).map((q) => {
      const m = maps.get(q.id);
      const k = keyed[q.id] || {};
      const d = (k.d || [])[0];
      const links = [];
      if (m) links.push({ href: `${MAPS}${q.id}`, label: "Map", title: `The map of the tradition: ${q.q}` });
      links.push({ href: `${ATLAS}${q.id}`, label: "Answers", title: `Every answer: ${q.q}` });
      if (d) links.push({ href: `${CONTROVERSIES}debate/${encodeURIComponent(d[0])}/${encodeURIComponent(d[2] || q.id)}`, label: nOf(d[1], "controversy", "controversies"), title: `${titles[d[0]] || "The controversies"}: ${nOf(d[1], "controversy", "controversies")} on ${q.q}` });
      return { id: q.id, q: q.q, locus: q.locus, authors: m ? m.authors : q.n_authors, positions: m ? m.positions : [], first: m ? m.first : null, centuries: k.c || null, undated: k.u || 0, links, mapped: Boolean(m) };
    });
  }
  // A section in the desk's own frame: its heading, then how the figure was made as a closed Methodology, then the figure.
  const section = (id, title, extra, note, body) => `<section class="tdk-mod tgt-sec" id="${id}" aria-labelledby="${id}-h"><div class="tdk-head">` +
    `<h3 class="tdk-h" id="${id}-h">${esc(title)}${extra}</h3>${method(note)}</div>${body}</section>`;
  function graphicsHTML(G, slug, topic, label, qs, sel, tg, labels) {
    const authors = (topic && topic.authors) || [];
    const named = esc(String(label).replace(/^The /, "the "));
    const strip = authors.length ? G.eraStrip(G.bin(authors.map((a) => ({ y: a.y, t: a.sh, a: a.a })), 25), { title: `${label}: the authors through time`, marks: eraVoices(G, authors), labels }) : "";
    const map = qs.length ? G.questionMap(qs, { selected: sel, controls: "tg-chosen" }) : "";
    const scr = tg && tg.scripture && tg.scripture[slug];
    const band = scr ? G.scriptureBand(scr.rows, { href: scriptureHref, listLabel: `The chapters of the verses most particular to ${label}` }) : "";
    return [
      strip && section("tg-time", "Authors through time", "",
        `<p>Every author the library indexes on ${named}, in columns of a quarter-century and stacked by tradition, the library's eras banded behind them. Each author is placed by the year the library gives him, most often the year of birth, else the first year he is attested: the catalogue's year, or where it has none, the year of his own record, his author page or his printed works. Each is counted once; those the library cannot date are counted, not drawn. Each era names its most recorded voice at his year. Select a tradition in the key to set it aside, and move along the strip with the pointer or the arrow keys to read a column.</p>`, strip),
      map && section("tg-questions", "Disputed questions", `<span class="tg-ct">${fmt(qs.length)}</span>`,
        `<p>The classic questions on this topic. For each, the authors answering by century, its positions as one bar divided by their size, the largest first, and the way to its map, to every answer, and to the controversies the library's works of controversy file under it. The answers, positions and centuries are read by machine from each author's pages. Choose a question to draw its positions below.</p>`,
        `${map}<p class="tg-meta tg-qm-more"><a href="${ATLAS.slice(0, -1)}">Every disputed question, by locus</a> · <a href="${MAPS.slice(0, -1)}">Maps of the tradition</a></p><div class="tg-chosen" id="tg-chosen" aria-live="polite"></div>`),
      // The heading counts what the band holds, as Disputed questions does (quality pass, 2026-10-22); the Methodology says which verses.
      band && section("tg-scripture", "Scripture by chapter", `<span class="tg-ct">${scr.rows.length === 1 ? "the most cited" : `the ${fmt(scr.rows.length)} most cited`}</span>`,
        `<p>The chapters of the verses most particular to ${named}, placed along the canon: the counts are the citations of those verses on the pages that treat the topic, summed by chapter. The most cited are named over their bars and listed below; each opens the chapter in the Scripture reader.</p>`, band),
    ].filter(Boolean).join("");
  }
  // The question chosen: its name, its shape and the axes it runs along, then its positions as the maps draw them.
  async function showQuestion(G, box, qs, id, focus, labels) {
    const slot = box.querySelector("#tg-chosen");
    const q = qs.find((x) => x.id === id);
    if (!slot || !q) return;
    slot.dataset.q = id;
    const head = (t) => `<h4 class="tg-chosen-h">${esc(t)}</h4>`;
    if (!q.mapped) {
      slot.innerHTML = `${head(q.q)}<p class="tg-meta">${esc(q.locus || "")} · ${nOf(q.authors || 0, "author", "authors")} answer · <a href="${ATLAS}${esc(q.id)}">every answer</a></p><p class="tg-wait">This question has no map of positions yet; the disputed questions give each author's answer.</p>`;
      // a question with no map is still chosen in view: on a phone the slot sits below the list (10-25)
      if (focus) slot.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      return;
    }
    slot.innerHTML = `${head(q.q)}<p class="tg-wait" role="status">Drawing its positions…</p>`;
    const d = await once(`/v1/maps/q/${encodeURIComponent(id)}.json`);
    if (!slot.isConnected || slot.dataset.q !== id) return;
    if (!d || !Array.isArray(d.positions)) { slot.innerHTML = `${head(q.q)}<p class="tg-wait">The positions could not load. <a href="${MAPS}${esc(id)}">Open the map of this question</a></p>`; return; }
    const total = d.n || d.positions.reduce((n, p) => n + (p.holders || []).length, 0) + (d.unplaced || []).length;
    // No reader of the Migne and EEBO pages here: their Preview is a link into the reader, as on the controversies page.
    const pv = G.preview({ read: readURL, col: ".tg-pos", host: ".tg-hr", text: "" });
    const o = { total, read: readURL, preview: pv.btn, level: 5, labels };
    slot.innerHTML = `${head(d.q || q.q)}
      <p class="tg-meta">${esc(d.locus || q.locus || "")} · ${nOf(total, "author", "authors")} · ${nOf(d.positions.length, "position", "positions")} · <a href="${MAPS}${esc(id)}">the map: every author placed, the lines between them</a> · <a href="${ATLAS}${esc(id)}">every answer</a></p>
      ${d.note ? `<p class="tg-shape">${esc(d.note)}</p>` : ""}${(d.axes || []).length ? `<dl class="tg-lab"><div><dt>Runs along</dt><dd><ol>${d.axes.map((a) => `<li>${esc(a)}</li>`).join("")}</ol></dd></div></dl>` : ""}
      ${d.positions.map((p) => G.positionBlock(p, o)).join("")}${(d.unplaced || []).length ? G.positionBlock({ id: "unplaced", label: "Not placed", holders: d.unplaced }, { ...o, note: "Answers the reading could not file under a position; each stands on his page." }) : ""}`;
    if (focus) slot.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
  // The section names, after the hero's "On this page" row has them first (it is the desk's; the three are added to its front).
  function addJumps($m) {
    const nav = $m.querySelector("#tdk-hero .tdk-jump");
    if (!nav || nav.querySelector("[data-tgt-jump]")) return;
    const links = [["tg-time", "Authors through time"], ["tg-questions", "Disputed questions"], ["tg-scripture", "Scripture by chapter"]]
      .filter(([k]) => $m.querySelector(`#${k}`)).map(([k, t]) => `<a href="#${k}" data-tgt-jump>${esc(t)}</a>`).join("");
    nav.insertAdjacentHTML("afterbegin", links);
  }

  let gRun = 0;
  async function drawGraphics() {
    const G = window.FRTraditionGraphics;
    const id = new URLSearchParams(location.search).get("t");
    const old = $root.querySelector("#tgTopic");
    if (!G || !id || !$root.querySelector("[data-td-main]")) { if (old) old.remove(); return; }
    if (old && old.dataset.id === id) return;
    if (old) old.remove();
    const my = ++gRun;
    const locus = (await loadLoci()).get(id);
    const slug = String((locus && locus.t2) || "").toLowerCase();
    if (my !== gRun || !slug) return;
    const where = placeOf(slug);
    const [topic, ax, mx, cx, tg] = await Promise.all([getJSON(`${BASE}/v1/mine/topic2-all/${encodeURIComponent(slug)}.json`),
      where.loci.length || where.ids.length ? once("/v1/atlas/index.json") : null, once("/v1/maps/index.json"),
      once("/v1/enrich/controversies/index.json"), once(GRAPHICS), G.dates ? G.dates.ready : null]);
    if (my !== gRun) return;
    const groups = disputedOf(ax, where);
    const qs = questionRows(groups, mx, tg, cx);
    // The question shown first: the most answered of the topic's own locus (the first group), else of all.
    const home = new Set(((groups[0] || [])[1] || []).map((q) => q.id));
    const pick = (list) => list.filter((q) => q.mapped).sort((a, z) => (z.authors || 0) - (a.authors || 0))[0];
    const sel = qs.length ? pick(qs.filter((q) => home.has(q.id))) || pick(qs) || qs[0] : null;
    const labels = (window.MOTopicDesk && window.MOTopicDesk.SHELF) || null;
    const html = graphicsHTML(G, slug, topic, locus.label, qs, sel && sel.id, tg, labels);
    if (!html) return;
    // The desk draws its hero and modules into its host in one go; the sections go under the hero once it has, or under the
    // topic's heading when it did not.
    const st = await deskReady();
    const $m = $root.querySelector("[data-td-main]");
    if (my !== gRun || !$m || new URLSearchParams(location.search).get("t") !== id || $m.querySelector("#tgTopic")) return;
    const box = document.createElement("div");
    box.className = "tg tg-topic tgt";
    box.id = "tgTopic";
    box.dataset.id = id;
    box.innerHTML = html;
    const hero = st === "drawn" ? $m.querySelector("#tdk-hero") : null;
    const head = $m.querySelector(".td-head");
    if (hero) hero.after(box); else if (head) head.after(box); else $m.prepend(box);
    if (hero) addJumps($m);
    G.mount(box);
    box.addEventListener("tg:question", (e) => showQuestion(G, box, qs, e.detail.id, true, labels));
    if (sel) showQuestion(G, box, qs, sel.id, false, labels);
  }

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
    // the page may have redrawn while the notes loaded
    const $m = $root.querySelector("[data-td-main]");
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
  new MutationObserver(() => { draw(); drawGraphics(); }).observe($root, { childList: true });
  window.addEventListener("popstate", () => { draw(); drawGraphics(); });
  draw();
  drawGraphics();
})();
