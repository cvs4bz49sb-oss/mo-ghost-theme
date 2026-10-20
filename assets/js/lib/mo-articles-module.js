/*
 * "From Mere Orthodoxy": the one small module that lists Mere Orthodoxy essays on a page they relate to (2026-10-20).
 *
 * Ian reviewed the 493 Mere Orthodoxy articles matched to The Faith Received and said they are all good matches and all
 * should be used. This file draws them wherever a page matches: the Verse Desk, the Topic Desk, an author's room, a work, a
 * confession or creed. Data and the lookups come from mo-articles.js (MOArticles); the page's own script decides WHICH
 * articles belong to it and hands them here. This file only draws, and it draws nothing at all when it has nothing.
 *
 * TRUST. Every row is "an essay that engages this": a title, an author and a date, a link to the original, and (where there
 * is room) the short excerpt. The words around the rows never say the essay states the library's position or an author's.
 *
 * DESIGN. The Topic Desk's and Verse Desk's language: an eyebrow ("From Mere Orthodoxy") over a serif section heading, a one-sentence
 * intro, then a grid of cards (the essay's featured image with rounded corners, title, author and month, the plain-words why line, and a
 * dek only when the excerpt holds a complete sentence). Three across at desk width, two on a tablet, one on a phone, by the width of the
 * place it sits in. Every essay is drawn: nothing is truncated and there is no "Show all" unless a caller sets a limit. A hollow
 * "All Mere Orthodoxy articles" button ends it. The narrow rail and verse panel take the compact rows with a small image.
 * Podcast episodes are the same shape (the placements merge them in) and read "Podcast, <show>" in the author line.
 * No pills, no display face, colors are tokens only (assets/css/mo-articles-module.css).
 *
 * Pure parts (html, dateLine, safeUrl) take plain data, so scripts/check-mo-placements.mjs runs them without a DOM.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MOArticlesModule = api;
}(typeof window !== "undefined" ? window : globalThis, () => {
  "use strict";

  const ALL_HREF = "/the-faith-received/resources/#articles";
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // The library's machine-matched text can carry an em dash; the site's copy has none.
  const plain = (s) => String(s == null ? "" : s).replace(/\s*—\s*/g, ", ").replace(/\s+/g, " ").trim();

  // Only an https or http address becomes a link; anything else (javascript:, data:) is dropped with its row.
  function safeUrl(u) {
    const s = String(u == null ? "" : u).trim();
    return /^https?:\/\/[^\s"'<>]+$/i.test(s) ? s : "";
  }

  // "2019-05-14" or an ISO timestamp -> "May 2019". Read from the text, never through Date, so the month cannot slip a time zone.
  function monthYear(d) {
    const m = /^(\d{4})-(\d{2})/.exec(String(d == null ? "" : d));
    if (!m) return /^\d{4}$/.test(String(d)) ? String(d) : "";
    const mo = Number(m[2]);
    return mo >= 1 && mo <= 12 ? `${MONTHS[mo - 1]} ${m[1]}` : m[1];
  }
  const dateLine = (a) => [plain(a.a), monthYear(a.d)].filter(Boolean).join(", ");

  // A short excerpt: first sentence-ish run, cut on a word, never more than max characters.
  function excerpt(x, max) {
    const s = plain(x);
    if (!s) return "";
    if (s.length <= max) return s;
    const cut = s.slice(0, max);
    return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 30)).replace(/[\s,;:.]+$/, "")}…`;
  }

  /* The module's HTML, or "" when there is nothing to draw.
       items  article entries ({ id, t, u, d, a, y, i }); a row may carry `why` (the plain-words reason it is on this page) and `note`
              ("on this chapter", shown after the author line)
       opts   id       element id prefix (unique per module on a page)
              variant  "cards" (a grid with each essay's featured image; the default) or "rows" (compact rows with a small thumbnail, for a
                       narrow rail or panel)
              title    the heading itself, "From Mere Orthodoxy" unless the page names its subject ("Mere Orthodoxy on Augustine of Hippo");
                       a title also gets "From Mere Orthodoxy" above it as the eyebrow (cards)
              context  the words after the heading ("on this passage"), part of the heading's accessible name
              limit    rows shown before "Show all N" (the rest are in the markup, hidden, and open in place); leave out to show every row
              image    (article, width) -> image URL, "" for none (MOArticles.image); without it every card has the tinted tile
              tag      heading element (h2 to h4), default h3
              foot     false to leave out the "All Mere Orthodoxy articles" button
              allHref/allLabel   where the foot button goes (an on-site path), "All Mere Orthodoxy articles" by default
              cap      most rows ever drawn (a narrow panel: 2); moreHref/moreLabel then name where the rest are (an on-site path)
       groups (resources only) see resources() */
  const KIND_NAME = { doc: "Creeds and confessions", work: "Works and authors", retrieval: "Theological retrieval", topic: "Doctrine and Scripture" };
  const FALLBACK_WHY = { doc: "On creeds and confessions", work: "Engages works and authors in the library", retrieval: "On theological retrieval", topic: "Engages doctrine and Scripture" };
  const whyOf = (a) => plain(a.why || a.y || FALLBACK_WHY[a.k] || "");
  const onSite = (p) => (typeof p === "string" && /^\/[^/\\]/.test(p) ? p : "");

  // A short dek, only where the essay's own excerpt holds a COMPLETE first sentence (the data's excerpts are cut at 240 characters with an
  // ellipsis; a cut sentence is never shown). "" when there is none.
  function dek(a) {
    const x = plain(a.x);
    const m = /^(.{40,190}?[.!?])(?:["\u201d\u2019']?)(?:\s|$)/.exec(x);
    if (!m || /(?:\b(?:St|Dr|Mr|Mrs|Ms|Fr|Rev|Jr|Sr|vs|No|cf|ca|c)|\b[A-Z])\.$/.test(m[1]) || /\u2026|\.\.\./.test(m[1])) return "";
    return m[0].trim();
  }
  const sentence = (t) => { const s = plain(t); return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; };

  function row(a, i, o, limit) {
    const meta = dateLine(a);
    const note = "";
    const sized = typeof o.image === "function" && !a.img;
    const src = a.img || (sized ? o.image(a, o.variant === "rows" ? 300 : 600) : "");
    const src2 = sized && src ? o.image(a, o.variant === "rows" ? 600 : 1000) : "";
    const alt = a.ia ? esc(plain(a.ia)) : "";
    const img = safeUrl(src)
      ? `<span class="moa-img"><img class="moa-photo" src="${esc(safeUrl(src))}"${safeUrl(src2) ? ` srcset="${esc(safeUrl(src))} 1x, ${esc(safeUrl(src2))} 2x"` : ""} width="600" height="400" alt="${alt}" loading="lazy" decoding="async"></span>`
      : `<span class="moa-img" aria-hidden="true"><span class="moa-ph">${esc(a.s ? "Podcast" : KIND_NAME[a.k] || "")}</span></span>`;
    // A page-specific reason ("on this chapter", "on the Westminster Confession") is the why line; else the essay's own.
    const why = a.note ? sentence(a.note) : whyOf(a);
    const d = o.variant === "rows" || o.dek === false ? "" : dek(a);
    return `<li class="moa-row"${i >= limit ? " hidden data-moa-extra" : ""}>` +
      `<a class="moa-link" href="${esc(safeUrl(a.u))}" target="_blank" rel="noopener">${img}<span class="moa-txt">` +
      `<span class="moa-t">${esc(plain(a.t))}</span><span class="moa-sr"> (Mere Orthodoxy, opens in a new tab)</span>` +
      `${meta || note ? `<span class="moa-meta">${esc(meta)}${meta && note ? " · " : ""}${note}</span>` : ""}` +
      `${why ? `<span class="moa-why">${esc(why)}</span>` : ""}${d ? `<span class="moa-x">${esc(d)}</span>` : ""}</span></a></li>`;
  }

  // groups: [{ id, label, items }]. A group with a label draws it as a sub-heading (resources); the lone unlabelled group is the plain module.
  function build(groups, o) {
    const cleaned = groups.map((g) => ({ ...g, rows: (Array.isArray(g.items) ? g.items : []).filter((a) => a && plain(a.t) && safeUrl(a.u)) })).filter((g) => g.rows.length);
    if (!cleaned.length) return "";
    const variant = o.variant === "rows" ? "rows" : "cards";
    const o2 = { ...o, variant };
    const hasLimit = Number(o.limit) > 0;
    const limit = hasLimit ? Math.max(1, Number(o.limit)) : Infinity;
    const tag = /^h[2-4]$/.test(o.tag || "") ? o.tag : "h3";
    const sub = tag === "h2" ? "h3" : tag === "h3" ? "h4" : "h5";
    const id = esc(o.id || "moa");
    const ctx = plain(o.context);
    const title = plain(o.title);
    const eyebrow = title && variant === "cards" && o.eyebrow !== "" ? `<p class="moa-eyebrow">${esc(plain(o.eyebrow) || "From Mere Orthodoxy")}</p>` : "";
    let total = 0;
    let shown = 0;
    const lists = cleaned.map((g, gi) => {
      let { rows } = g;
      total += rows.length;
      // cap: a hard ceiling (a narrow panel shows two and no more); the rest are reached through moreHref, not drawn.
      if (o.cap && rows.length > o.cap) rows = rows.slice(0, Math.max(1, Number(o.cap)));
      shown += rows.length;
      const n = rows.length;
      const li = rows.map((a, i) => row(a, i, o2, limit)).join("");
      const more = n > limit ? `<button type="button" class="moa-more" aria-expanded="false" aria-controls="${id}-list${gi}" data-moa-more data-n="${n}">Show all ${n}</button>` : "";
      const head = g.label ? `<${sub} class="moa-kh">${esc(plain(g.label))} <span class="moa-n">${n}</span></${sub}>` : "";
      return `<div class="moa-kind"${g.id ? ` data-moa-kind="${esc(g.id)}"` : ""}>${head}<ul class="moa-list" id="${id}-list${gi}">${li}</ul>${more ? `<div class="moa-foot">${more}</div>` : ""}</div>`;
    }).join("");
    const rest = total > shown && onSite(o.moreHref) ? `<a class="moa-all" href="${esc(onSite(o.moreHref))}">${esc(o.moreLabel || `All ${total}`)}</a>` : "";
    const allHref = onSite(o.allHref) || ALL_HREF;
    const foot = o.foot === false ? rest : `${rest}<a class="moa-btn" href="${esc(allHref)}">${esc(plain(o.allLabel) || "All Mere Orthodoxy articles")}</a>`;
    return `<section class="moa moa--${variant}${o.resources ? " moa--res" : ""}" data-moa aria-labelledby="${id}-h">` +
      `<div class="moa-head">${eyebrow}<${tag} class="moa-h" id="${id}-h">${esc(title || "From Mere Orthodoxy")}${ctx ? `<span class="moa-ctx"> ${esc(ctx)}</span>` : ""}</${tag}>` +
      `</div>` +
      `${lists}${foot ? `<div class="moa-foot moa-foot--end">${foot}</div>` : ""}</section>`;
  }

  const html = (items, opts) => build([{ items }], opts || {});

  /* The "Resources on this work" section: one sub-section per KIND of resource, each with its own heading and count. Articles are the
     first kind; another dataset (podcast episodes) adds its own group here and nothing else changes.
       kinds  [{ id: "articles", label: "Mere Orthodoxy articles", items }]  (a kind with no items is left out) */
  function resources(kinds, opts) {
    const o = { ...(opts || {}), resources: true };
    return build((Array.isArray(kinds) ? kinds : []).map((k) => ({ id: k.id, label: k.label, items: k.items })), o);
  }

  // One delegated handler per host: "Show all N" opens the hidden rows in place, "Show fewer" folds them back.
  function bind(host) {
    if (host.dataset.moaBound) return;
    host.dataset.moaBound = "1";
    host.addEventListener("click", (e) => {
      const b = e.target.closest && e.target.closest("[data-moa-more]");
      if (!b || !host.contains(b)) return;
      const sec = b.closest(".moa-kind") || b.closest("[data-moa]");
      const open = b.getAttribute("aria-expanded") !== "true";
      sec.querySelectorAll("[data-moa-extra]").forEach((li) => { li.hidden = !open; });
      b.setAttribute("aria-expanded", String(open));
      b.textContent = open ? "Show fewer" : `Show all ${b.dataset.n}`;
    });
  }

  /* Draw into `host` (an element the page owns). Returns true when something was drawn. Replaces what an earlier call drew
     there; draws nothing, and leaves the host as it was, when there is nothing to show. */
  function mount(host, items, opts) {
    if (!host || typeof host.insertAdjacentHTML !== "function") return false;
    const out = opts && opts.kinds ? resources(opts.kinds, opts) : html(items, opts);
    host.querySelectorAll(":scope > [data-moa]").forEach((el) => el.remove());
    if (!out) return false;
    host.insertAdjacentHTML("beforeend", out);
    bind(host);
    return true;
  }

  /* Make a host element, put it where `place(host)` says, and mount into it; the host is removed again if nothing is drawn.
     Used by pages whose markup this file does not own (an author's room, a work page). */
  function mountAt(place, items, opts) {
    if (typeof document === "undefined") return null;
    const host = document.createElement("div");
    host.className = "moa-host";
    host.dataset.moaHost = String((opts && opts.id) || "moa");
    if (!mount(host, items, opts)) return null;
    place(host);
    return host;
  }


  /* ── WHICH ARTICLES BELONG TO A PAGE ───────────────────────────────────────────────────────────────────────────────────
     Pure functions over MOArticles (mo-articles.js), so scripts/check-mo-placements.mjs runs them on the real data. Each returns
     entries ready for html(): the article itself, or a copy carrying a short `note` where the reason is not the page's own subject.
     Nothing is dropped: every article that the data ties to a verse, topic, author, work or document is returned for that page. */
  const fold0 = (s) => String(s == null ? "" : s).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  function withWhy(a, why) { return { ...a, why }; }
  const withNote = (a, note) => (note ? { ...a, note } : a);
  const dedupe = (lists) => {
    const seen = new Set();
    const out = [];
    lists.forEach((l) => l.forEach((a) => { if (a && !seen.has(a.id)) { seen.add(a.id); out.push(a); } }));
    return out;
  };
  /* A document's name for a note. The data's own label for some council slugs is the title of one decree inside it ("The Primacy
     of the Roman Pontiff" for Chalcedon), so the named documents are spelled out here and the data's label is only a fallback. */
  const DOC_NAMES = {
    "cf-001-apostolic-and-ancient-creeds": "the ancient creeds", "cf-013-council-of-nicea-i-325": "the Council of Nicaea",
    "cf-025-council-of-chalcedon-451": "the Council of Chalcedon", "cf-048-council-of-nicea-ii-787": "the Second Council of Nicaea",
    "cf-092-council-of-trent-1545-1563": "the Council of Trent", "lc-002-augsburg-confession-1530": "the Augsburg Confession",
    "rc-057-belgic-confession-1561": "the Belgic Confession", "rc-061-heidelberg-catechism-1563": "the Heidelberg Catechism",
    "rc-105-canons-of-dort-1618": "the Canons of Dort", "rc-111-westminster-confession-of-faith-1646": "the Westminster Confession",
    "rc-114-westminster-larger-catechism-1647": "the Westminster Larger Catechism", "rc-115-westminster-shorter-catechism-1647": "the Westminster Shorter Catechism",
  };
  const docLabel = (A, a, slug) => {
    if (DOC_NAMES[slug]) return DOC_NAMES[slug];
    const e = (A.entities(a) || []).find((x) => x.type === "doc" && x.key === slug);
    return e ? e.label : "";
  };

  // A verse: the essays on it, then essays on a range that covers it, then essays on the whole chapter, then essays on other verses of
  // the chapter. The last two read "on this chapter" so a reader never takes them for essays on this verse.
  function verse(A, slug, c, v) {
    const chap = `${slug}.${c}`;
    const exact = `${chap}.${v}`;
    const inChapter = A.forVerse(chap);
    const tier = (a) => {
      const vs = a.verses || [];
      if (vs.includes(exact)) return 0;
      const range = vs.some((k) => {
        const m = /^(.+)\.(\d+)-(\d+)$/.exec(k);
        return m && m[1] === chap && Number(m[2]) <= Number(v) && Number(v) <= Number(m[3]);
      });
      if (range) return 1;
      return vs.includes(chap) ? 2 : 3;
    };
    const rank = new Map(inChapter.map((a, i) => [a.id, i]));
    return inChapter.map((a) => [tier(a), a]).sort((x, y) => x[0] - y[0] || rank.get(x[1].id) - rank.get(y[1].id))
      .map(([t, a]) => withNote(a, t >= 2 ? "on this chapter" : ""));
  }

  const hay = (a) => `${a.t || ""} ${(a.w || []).join(" ")} ${a.x || ""}`;
  const reEsc = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const hayTK = (a) => `${a.t || ""} ${(a.w || []).join(" ")}`;
  const hasTermTK = (a, terms) => terms.length > 0 && new RegExp(`\\b(?:${terms.map(reEsc).join("|")})`, "i").test(hayTK(a));
  const hasTerm = (a, terms) => terms.length > 0 && new RegExp(`\\b(?:${terms.map(reEsc).join("|")})`, "i").test(hay(a));

  /* Namesakes: the matcher tied some essays to a theologian by name when they are about someone else. An essay whose title or
     excerpt names the namesake is left off that author's page and off any list built from the author's name. */
  const NAMESAKES = {
    "Martin Luther": /martin luther king|\bMLK\b|king jr/i,
    "John Calvin": /calvin (coolidge|and hobbes|klein|college|university)|hobbes/i,
    "John Owen": /owen (strachan|wilson|jones|barfield)/i,
    "Augustine of Hippo": /st\.? augustine,? (fl|florida)|augustine, florida/i,
    "Bernard of Clairvaux": /bernard (madoff|sanders|lewis|williams)/i,
    "Thomas Aquinas": /aquinas college/i,
    "John Wesley": /wesley (snipes|crusher)/i,
    "Thomas Goodwin": /goodwin (kearns|college)|doris kearns/i,
    "Richard Hooker": /hooker (hall)/i,
  };
  const nsKey = (name) => Object.keys(NAMESAKES).find((k) => k.toLowerCase() === String(name).toLowerCase().trim());
  const namesake = (name, a) => { const k = nsKey(name); return Boolean(k && NAMESAKES[k].test(`${a.t} ${a.x}`)); };
  const excluded = (A) => {
    const out = [];
    Object.keys(NAMESAKES).forEach((name) => A.forAuthor(name).forEach((a) => { if (namesake(name, a)) out.push({ author: name, id: a.id, title: a.t }); }));
    return out;
  };

  /* Words that stand for a topic: its name, its aliases and its search words (loci.json), less the few that are common English
     (works, cross, mass, canon) and so say nothing. */
  const COMMON = new Set(["works", "merit", "word", "the word", "prophecy", "prophets", "cross", "mass", "canon", "bible", "ministry", "preaching",
    "discipline", "decree", "decrees", "sacrifice", "salvation", "persecution", "martyrdom", "reason", "tradition", "heresy", "revelation",
    "adoption", "theology", "method", "forgiveness", "faith", "law", "church", "christ", "god", "sin", "grace", "love", "death", "life", "worship"]);
  function topicTerms(locus) {
    if (!locus) return [];
    const raw = [locus.label, ...(locus.aliases || []).map((x) => String(x).replace(/-/g, " ")), ...(locus.find || [])];
    const label = String(locus.label || "").replace(/^(the|of|on)\s+/i, "").replace(/^person and work of /i, "");
    return [...new Set([...raw, label].map((x) => String(x || "").toLowerCase().trim()).filter((x) => x.length > 3 && !COMMON.has(x)))];
  }

  /* A topic's essays. The topic's own list is the matcher's, filtered to a STRONG signal: a word for the topic in the title; or a high-confidence document or work essay that has this topic first or second; or one of the Passages
     creed series. The rest are left off. Then essays on the confession documents that speak to it, each named. */
  function topic(A, id, docSlugs, terms) {
    const ts = terms || [];
    // Keywords and the excerpt are not signals on their own: one keyword among twelve, or a passing mention, put a Kairos-time essay on
    // Baptism and a veils essay on the Atonement (Ian's review). The topic's word must be in the title, or in both a keyword and the excerpt.
    const strong = (a) => hasTermTK({ t: a.t, w: [] }, ts) || (hasTermTK(a, ts) && hasTerm({ t: "", w: [], x: a.x }, ts)) || /^[\u2018\u2019'"]?Passages[,.:]? (Season|Chapter|Episode)/i.test(a.t || "") ||
      ((a.k === "doc" || a.k === "work") && a.f === "high" && (a.topics || []).slice(0, 2).includes(id) && hasTerm(a, ts));
    const own = A.forTopic(id).filter((a) => !terms || strong(a));
    const viaDocs = [];
    (docSlugs || []).forEach((slug) => doc(A, slug).forEach((a) => viaDocs.push(withNote(a, `on ${docLabel(A, a, slug) || "a confession"}`))));
    return dedupe([own, viaDocs]);
  }

  /* An author's essays, most about the author first (the data's own order). The why line is the essay's own when it names the author;
     an essay filed under two authors would otherwise say "Engages John Calvin" on Luther's page. */
  const author = (A, name) => {
    const bits = fold0(name).split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !["hippo", "alexandria", "canterbury", "clairvaux"].includes(w));
    return A.forAuthor(name).filter((a) => !namesake(name, a)).map((a) => {
      const y = fold0(a.y || "");
      return withWhy(a, a.y && bits.some((b) => y.includes(b)) ? a.y : `Engages ${name}`);
    });
  };

  /* Creed documents: an essay is on the creed only when it says so (a creed word in its title, keywords or excerpt). The Apostles'
     Creed page and the Nicene page share a document, so each takes its own words. */
  const DOC_TERMS = {
    "cf-001-apostolic-and-ancient-creeds": ["creed", "nicene", "nicaea", "apostles", "athanasian", "niceno"],
    "cf-013-council-of-nicea-i-325": ["nicene", "nicaea", "nicea", "niceno", "arius", "homoousios"],
    "cf-025-council-of-chalcedon-451": ["chalcedon", "chalcedonian"],
    "cf-048-council-of-nicea-ii-787": ["nicaea", "nicea", "iconoclas", "icons", "adoptionis"],
    "cf-092-council-of-trent-1545-1563": ["trent", "tridentine"],
  };
  const CREED_PAGE_TERMS = { apostles: ["apostles creed", "apostles’ creed", "apostles' creed", "apostles"], nicene: ["nicene", "nicaea", "niceno"] };
  function doc(A, slugs, termsOverride) {
    const list = Array.isArray(slugs) ? slugs : [slugs];
    return dedupe(list.map((s) => {
      const terms = termsOverride || DOC_TERMS[s];
      const articles = A.forDoc(s);
      return /^cf-/.test(s) && terms ? articles.filter((a) => hasTerm(a, terms.map((t) => t.replace(/’/g, "'")).concat(terms))) : articles;
    }));
  }

  /* The Summa and the Contra Gentiles are cited in five or six parts that each carry the same essays; an essay shows on a part only
     when it names that part, and the work's other essays are on the author's page. */
  const PARTS = {
    "aq-st-i-16": ["prima pars", "first part", "summa theologiae i\\b", "\\bST I\\b"], "aq-st-i-ii-17": ["prima secundae", "first part of the second"],
    "aq-st-ii-ii-19": ["secunda secundae", "second part of the second"], "aq-st-ii-ii-20": ["secunda secundae", "second part of the second"],
    "aq-st-iii-21": ["tertia pars", "third part"], "aq-st-iiisup-23": ["supplement"],
    "aq-scg1-11": ["book i\\b", "book 1\\b"], "aq-scg2-12": ["book ii\\b", "book 2\\b"], "aq-scg3-13": ["book iii\\b", "book 3\\b"], "aq-scg4-14": ["book iv\\b", "book 4\\b"],
  };

  /* A work's resources, from every way the data ties an essay to it, most direct first. Each entry carries `why`, the plain-words reason
     it is on this page (nothing says an essay states a position):
       1  the work itself (the data's own tie)                   why: the essay's own line, else "On this work"
       2  a document: a creed, confession, catechism or council    why: "On the Nicene Creed", "On the ancient creeds", "On the Council of Nicaea"
          (the page's slug can be a public name such as nicene-creed or heidelberg-catechism: DOC_ALIASES)
       3  the work's author, when essays are about the author      why: "On Augustine of Hippo, who wrote this work"
          (ctx.author(slug) names the author; the theme's work map holds it)
       4  confessions with nothing of their own                    why: "On creeds and confessions in general"
     An essay appears once, under its first reason. */
  const ANCIENT = "cf-001-apostolic-and-ancient-creeds";
  // A public or short name -> the documents it is. `own` are the words that make an essay about THIS creed within a group document.
  const DOC_ALIASES = {
    "nicene-creed": { docs: [ANCIENT, "cf-013-council-of-nicea-i-325"], own: { [ANCIENT]: [CREED_PAGE_TERMS.nicene, "the Nicene Creed"] }, name: "Nicene Creed" },
    "apostles-creed": { docs: [ANCIENT], own: { [ANCIENT]: [CREED_PAGE_TERMS.apostles, "the Apostles’ Creed"] }, name: "Apostles Creed" },
    athanasian: { docs: [ANCIENT], own: { [ANCIENT]: [["athanasian", "quicunque", "athanasius"], "the Athanasian Creed"] }, name: "Athanasian Creed" },
    "athanasian-creed": { same: "athanasian" },
    chalcedonian: { docs: ["cf-025-council-of-chalcedon-451"], name: "Chalcedonian Definition" },
    "chalcedonian-definition": { same: "chalcedonian" },
    heidelberg: { docs: ["rc-061-heidelberg-catechism-1563"], name: "Heidelberg Catechism" },
    "heidelberg-catechism": { same: "heidelberg" },
    "westminster-confession": { docs: ["rc-111-westminster-confession-of-faith-1646"], name: "Westminster Confession" },
    "westminster-confession-of-faith": { same: "westminster-confession" },
    "westminster-larger": { docs: ["rc-114-westminster-larger-catechism-1647"], name: "Westminster Larger Catechism" },
    "westminster-larger-catechism": { same: "westminster-larger" },
    "westminster-shorter": { docs: ["rc-115-westminster-shorter-catechism-1647"], name: "Westminster Shorter Catechism" },
    "westminster-shorter-catechism": { same: "westminster-shorter" },
    belgic: { docs: ["rc-057-belgic-confession-1561"], name: "Belgic Confession" },
    "belgic-confession": { same: "belgic" },
    augsburg: { docs: ["lc-002-augsburg-confession-1530"], name: "Augsburg Confession" },
    "augsburg-confession": { same: "augsburg" },
    "canons-of-dort": { docs: ["rc-105-canons-of-dort-1618"], name: "Canons of Dort" },
    dort: { same: "canons-of-dort" },
  };
  const aliasOf = (key) => { let a = DOC_ALIASES[key]; if (a && a.same) a = DOC_ALIASES[a.same]; return a || null; };
  // A confession, creed or council in the library's confessions catalogue (rc-, cf-, lc-) or one of the aliased short names.
  const isConfession = (key) => /^(?:cf|rc|lc)-\d+-/.test(key) || Boolean(aliasOf(key));
  function work(A, slug, ctx) {
    const s = String(slug || "").trim();
    const key = /^\d+$/.test(s) ? `pld-${s}` : s;
    const alias = aliasOf(key);
    const tiers = [];
    let direct = A.forWork(key);
    if (PARTS[key]) direct = direct.filter((a) => new RegExp(`(?:${PARTS[key].join("|")})`, "i").test(hay(a)));
    tiers.push(direct.map((a) => withWhy(a, a.y || "On this work")));
    const docSlugs = alias ? alias.docs : [key];
    docSlugs.forEach((d) => {
      const list = doc(A, d);
      const own = alias && alias.own && alias.own[d];
      const mine = own ? list.filter((a) => hasTerm(a, own[0])) : [];
      const rest = own ? list.filter((a) => !mine.includes(a)) : list;
      tiers.push(mine.map((a) => withWhy(a, `On ${own[1]}`)));
      tiers.push(rest.map((a) => withWhy(a, `On ${DOC_NAMES[d] || docLabel(A, a, d) || "this document"}`)));
    });
    const who = ctx && typeof ctx.author === "function" ? ctx.author(key) : "";
    if (who) tiers.push(author(A, who).map((a) => withWhy(a, `On ${who}, who wrote this work`)));
    let list = dedupe(tiers);
    if (!list.length && isConfession(key)) {
      list = A.all().filter((a) => A.kindsOf(a).includes("doc") && !(a.docs && a.docs.length)).map((a) => withWhy(a, "On creeds and confessions in general"));
    }
    return list.map((a) => (/reading plans?/i.test(a.t) ? { ...a, note: "a reading plan" } : a));
  }

  // Words for the Resources page's search, for "See all resources" on a work: the document's name, the work's title, or the author.
  function searchWords(A, slug, ctx) {
    const key = /^\d+$/.test(String(slug)) ? `pld-${slug}` : String(slug || "").trim();
    const alias = aliasOf(key);
    if (alias) return alias.name;
    if (DOC_NAMES[key]) return DOC_NAMES[key].replace(/^the /, "");
    const first = A.forWork(key)[0];
    const e = first && (A.entities(first) || []).find((x) => x.type === "work" && x.key === key);
    if (e && e.label) return e.label;
    return (ctx && typeof ctx.author === "function" && ctx.author(key)) || "";
  }

  const pick = { verse, topic, author, work, doc, searchWords, DOC_ALIASES, isConfession, dedupe, DOC_NAMES, topicTerms, excluded, NAMESAKES, CREED_PAGE_TERMS };

  return { html, resources, mount, mountAt, bind, safeUrl, monthYear, dateLine, excerpt, plain, pick, ALL_HREF };
}));
