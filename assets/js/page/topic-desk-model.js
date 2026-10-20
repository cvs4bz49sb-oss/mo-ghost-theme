/*
 * The Topic Desk, as pure functions (Ian, 2026-10-19: "push the new desks").
 *
 * buildDeskModel(input)  data in, a model out: which modules have enough to show, and what they say.
 * renderDesk(model)      a model in, an HTML string out.
 *
 * Neither touches the page, the network, or the clock, so scripts/check-topic-desk.mjs runs them in Node
 * on the live data for ten topics. page/topic-desk.js is the thin browser part that fetches and mounts.
 *
 * THE RULES (the owner found wrong claims on the live site, 2026-10-19):
 *  1. Every number and sentence is computed from the library's data by a fixed rule. The only hand-written
 *     text is the short marquee file (assets/data/faith-received/topic-desk-marquee.json), which says what
 *     it is. A line from the marquee file is shown only when it passes the check beside it.
 *  2. No author is shown holding a view. A person is a name, a birth year, a church, and how many pages of
 *     their works the index reads on this topic. A document is shown in its own words.
 *  3. A module with too little data is OMITTED, not shown empty. Each module has a minimum below.
 *  4. Churches are named from the document or author (see CHURCH rules). A church with no mapped document
 *     and no mapped work gets no column, so there is no Orthodox column until a confession is mapped.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MOTopicDesk = api;
}(typeof window === "undefined" ? globalThis : window, () => {
  "use strict";

  const SHELF = {
    gf: "Greek Fathers", pl: "Latin Fathers", po: "Eastern Fathers", md: "Medieval", rc: "Roman Catholic",
    lu: "Lutheran", rf: "Continental Reformed", ed: "English writers", hl: "Humanism and Law",
  };
  const SHELF_ORDER = ["gf", "po", "pl", "md", "rc", "lu", "rf", "ed", "hl"];
  const ED_ORDER = ["Anglican", "Presbyterian", "Congregational", "Baptist", "Quaker", "Anabaptist", "Arminian", "Methodist", "Bohemian Brethren", "Waldensian", "Socinian"];
  const ED_TO_SHELF = { "Continental Reformed": "rf", Lutheran: "lu", "Roman Catholic": "rc" };
  const CHURCHES = [
    ["early", "The early church, to 1054"], ["rc", "Roman Catholic"], ["or", "Eastern Orthodox"], ["lu", "Lutheran"],
    ["rf", "Reformed"], ["an", "Anglican"], ["bp", "Baptist"],
  ];
  /* The era bands. The first boundary is the one the confession groups already use (1054). The others are the dates the
     library's own timelines and the Westminster Assembly fix: 1517, 1648, 1800. Stated in the caption on the page. */
  const ERAS = [
    { id: "early", label: "The early church", span: "to 1054", end: 1054 }, { id: "medieval", label: "Medieval", span: "1054 to 1517", end: 1517 },
    { id: "reformation", label: "Reformation", span: "1517 to 1648", end: 1648 }, { id: "post", label: "Post-Reformation", span: "1648 to 1800", end: 1800 },
    { id: "modern", label: "Modern", span: "after 1800", end: 9999 },
  ];
  const eraOf = (c) => ERAS.find((e) => c * 100 - 50 < e.end).id;
  // "About the Trinity", "About Justification": a leading On, Of, or De is dropped and a leading The follows About in lower case.
  const aboutTitle = (label) => {
    const t = String(label || "").trim().replace(/^(?:on|of|de)\s+/i, "");
    return `About ${/^the\s/i.test(t) ? `the ${t.slice(4)}` : t}`;
  };
  const ord = (n) => `${n}${[11, 12, 13].includes(n % 100) ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th")}`;
  const CHURCH_LABEL = Object.fromEntries(CHURCHES);
  // The early-church column stops here (the date the confession groups and the era bands already use). A work or author dated
  // later is never filed in it, whatever shelf the library keeps it on.
  const EARLY_END = 1054;
  const QUOTE_MAX = 820; // one sentence may run this long; sentences are added after it only while the whole stays under QUOTE_PAD
  const QUOTE_PAD = 420;
  // The shelves of the Fathers: a work on one of them counts as early only if its date is known and is no later than EARLY_END.
  const FATHER_GROUPS = new Set(["gf", "po", "pl"]);

  /* Minimums: a module with fewer rows than this is left out. */
  /* One switch per module (Ian, 2026-10-19, after the first desk went live with claims nobody had vetted). A module that is
     false is omitted whole: no heading, no empty box. Turn one back on only after its content has passed a relevance
     check. traditions also carries the fault-line row. */
  const MODULES_ON = { traditions: true, treatments: true, chron: true, verses: true, people: true, path: true, related: true };
  const MIN = { docs: 2, ruler: 3, columns: 2, treatments: 3, events: 5, verses: 5, citeArticles: 2, people: 6, pathSteps: 2, pathItems: 2, related: 3 };
  const CAP = { docsPerCentury: 4, quotesPerColumn: 3, worksPerColumn: 3, verses: 9, moreVerses: 15, people: 12, related: 8, eventsPerCentury: 2, events: 16 };

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => Number(n || 0).toLocaleString("en-US");
  const plural = (n, one, many) => `${fmt(n)} ${n === 1 ? one : many}`;
  const enc = encodeURIComponent;
  const clip = (s, n) => {
    const t = String(s || "").replace(/\s+/g, " ").trim();
    if (t.length <= n) return t;
    return `${t.slice(0, n).replace(/\s+\S*$/, "").replace(/[\s,;:.]+$/, "")} …`;
  };
  const cleanText = (t) => String(t || "").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/^#+\s*/gm, "")
    .replace(/^\s*\[[^\]\n]{1,100}\]\s*/, "").replace(/\s+/g, " ").trim();
  // Titles and headings from the data keep their words but not the dash (the site sets no em dashes).
  const plain = (s) => String(s || "").replace(/\s*—\s*/g, ": ");
  const stripYear = (doc) => String(doc || "").replace(/\s+\(?\d{3,4}(?:\s*[-–]\s*\d{3,4})?\)?\s*$/, "").trim();
  // The same fallback as scripture-dev-core.js sourceHref, so a page opens where the Topics page opens it.
  const readHref = (w, p) => `/the-faith-received/read/?w=${enc(w)}${p ? `#b${enc(p)}-0` : ""}`;
  const topicHref = (id) => `/the-faith-received/topics/?t=${enc(id)}`;
  const authorHref = (s) => `/the-faith-received/author/?a=${enc(s)}`;
  // A link from the data is used only when it has exactly the reader's shape; otherwise it is rebuilt from the slug.
  const safeRead = (href, w, p) => (/^\/the-faith-received\/read\/\?w=[A-Za-z0-9_.%-]+(#[A-Za-z0-9_.:-]*)?$/.test(String(href || "")) ? href : readHref(w, p));
  const COUNCILS_GUIDE = "/the-faith-received/guide/?s=councils";

  // ── Groups: shelves, with the English shelf split by church ───────
  const shelfKey = (e) => {
    const v = String((e && (e.sh || e.trad)) || "");
    if (v.length <= 3) return v;
    const hit = Object.entries(SHELF).find(([, lab]) => lab.toLowerCase() === v.toLowerCase());
    return hit ? hit[0] : (v.toLowerCase() === "english divines" ? "ed" : v);
  };
  const groupOf = (e, bodyOf) => {
    const k = shelfKey(e);
    if (k !== "ed") return k;
    const b = bodyOf ? bodyOf(e.author || e.a) : "";
    return ED_TO_SHELF[b] || (b ? `ed:${b}` : "ed");
  };
  const groupLabel = (g) => (String(g).startsWith("ed:") ? String(g).slice(3) : g === "ed" ? "Other English writers" : (SHELF[g] || g));
  // How a person's church reads on the people strip: one name for the Reformed, whichever table placed them.
  const personChurch = (g) => (g === "rf" || g === "ed:Reformed" ? "Reformed" : groupLabel(g));
  const groupOrder = (groups) => {
    const rank = (g) => {
      if (String(g).startsWith("ed:")) return SHELF_ORDER.indexOf("ed") + 0.1 + ED_ORDER.indexOf(String(g).slice(3)) / 100;
      return SHELF_ORDER.indexOf(g) + (g === "ed" ? 0.5 : 0);
    };
    return [...groups].sort((a, b) => rank(a) - rank(b));
  };
  /* A group's church column. Fathers go to the early church. The Medieval shelf (the Latin church before the
     Reformation) goes with Rome. Presbyterians and Congregationalists go with the Reformed. Anything else
     (Humanism and Law, Quakers, unplaced English writers) has no column. */
  const COLUMN_OF_GROUP = {
    gf: "early", po: "early", pl: "early", md: "rc", rc: "rc", lu: "lu", rf: "rf",
    "ed:Anglican": "an", "ed:Baptist": "bp", "ed:Presbyterian": "rf", "ed:Congregational": "rf",
  };

  // A confession document's church, from its date, type, and the library's own tradition field.
  const churchOfArticle = (a) => {
    const year = Number(a.year) || 0;
    const type = String(a.doc_type || "");
    const doc = String(a.doc || "");
    const trad = String(a.trad || "");
    if (year && year < 1054) return "early";
    if (!year) return /^(Creed|Council|Definition)$/.test(type) ? "early" : null;
    if (/orthodox/i.test(trad)) return "or";
    if (/lukar|lukaris/i.test(doc)) return null;
    if (/waldens|bohemian|moravian|brethren|socinian|racovian|mennonite|anabapt|quaker/i.test(doc)) return null;
    if (/baptist/i.test(doc)) return "bp";
    if (/thirty-nine articles|forty-two articles|irish articles|church of england|book of common prayer|lambeth/i.test(doc)) return "an";
    if (trad === "Lutheran") return "lu";
    if (trad === "Roman Catholic") return "rc";
    if (trad === "Reformed") return "rf";
    return null;
  };

  const showHeading = (h) => {
    const t = String(h || "").trim();
    if (!t || t.length >= 120) return false;
    const letters = t.replace(/[^A-Za-z]/g, "");
    return !(letters.length && letters.replace(/[^A-Z]/g, "").length / letters.length > 0.6);
  };

  /* ── Relevance: what counts as "about" a topic (2026-10-20) ─────────────────────────────────────────────
     The first desk showed whatever the library had mapped to a topic, and an independent review found Trent's chapter on
     Penance under Baptism, a table of duties as the Lutheran voice on the Church, and a treatise on a council's ordinance
     as a classic work on the Trinity. So now an article or a work is shown only if its own title or heading NAMES the
     topic, or (an article only) the library is highly confident and the topic is named in its first sentence. */
  const escRe = (x) => String(x).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const termRe = (src) => { try { return src ? new RegExp(src, "i") : null; } catch (e) { return null; } };
  const STOP_WORDS = new Set(["the", "of", "on", "and", "a", "an", "in", "to", "theological"]);
  // The words that name a topic when the marquee file gives none: its label, split at "and", a short word whole and a long one by its stem.
  const derivedTerms = (label) => {
    const parts = String(label || "").toLowerCase().replace(/['\u2019]/g, "").split(/\s+and\s+/).map((ph) => ph.split(/[^a-z]+/).filter((w) => w && !STOP_WORDS.has(w)));
    const pats = parts.filter((ws) => ws.length).map((ws) => ws.map((w) => (w.length <= 4 ? `${escRe(w)}(?:s|es)?\\b` : `${escRe(w.length >= 7 ? w.slice(0, -2) : w)}\\w*`)).join("[\\s-]+"));
    return pats.map((x) => `\\b${x}`).join("|");
  };
  // title: the words that must appear in a title or heading. lead: the words that may stand in for them in an article's first sentence.
  const topicTerms = (locus, hit) => {
    const title = termRe(hit && hit.terms) || termRe(derivedTerms(locus && locus.label));
    const lead = (hit && hit.terms && hit.lead && termRe(`${hit.terms}|${hit.lead}`)) || title;
    return title ? { title, lead } : null;
  };
  const leadOf = (text) => { const t = cleanText(text); const m = t.match(/^.{20,320}?[.!?](?=\s|$)/); return m ? m[0] : t.slice(0, 320); };
  const articleTitle = (a) => plain(a.article_display || a.article || "");
  /* Predestination: the library maps election of bishops and popes to this topic too. The Topics page drops those before it feeds the
     desk (topics-dev.js predestinationArticle); the same rule is applied here, so the desk is right however it is fed. */
  const DOCTRINAL_ELECTION = /\b(?:predestinat\w*|reprobation|election|elect|elects|chosen\s+(?:in\s+christ|before\s+the\s+foundation)|foreordain\w*)\b/i;
  const OFFICE_ELECTION = /(?:election|chosen|elect)\s+(?:of|a|the|by)[^.!;]{0,80}(?:bishop|presbyter|deacon|pope|pontiff|minister|abbot|patriarch|cardinal)|(?:bishop|presbyter|deacon|pope|pontiff|minister|abbot|patriarch|cardinal)[^.!;]{0,80}(?:election|chosen|elect)/i;
  const predestinationOk = (a) => {
    const title = String(a.article_display || a.article || "");
    const text = `${title} ${a.text || ""}`;
    const dort = /Canons of Dort/i.test(a.doc || "") && /First Head/i.test(title);
    return (dort || DOCTRINAL_ELECTION.test(text)) && !(!/predestinat|reprobation/i.test(text) && OFFICE_ELECTION.test(text));
  };
  const articleAbout = (a, T, locusId) => {
    if (!T || !a || !a.text) return false;
    if (locusId === "de-praedestinatione" && !predestinationOk(a)) return false;
    const title = articleTitle(a);
    if (/^or,\s/i.test(title) || /\bdifference\s+between\b/i.test(title)) return false; // a title page, and a chapter on two things at once
    const docName = normKey(stripYear(a.doc));
    const titleKey = normKey(title).replace(/[\s,.:;]+$/, "");
    if (titleKey.length >= 8 && docName.includes(titleKey)) return false; // the article's title is the document's own title: its title page
    if (T.title.test(title)) return true;
    return a.confidence === "high" && T.lead.test(leadOf(a.text));
  };
  // A work "0 sections" or "page from N evidence pages" is a whole-work guess, not a located treatment: it counts only if its title names the topic.
  const WEAK_WHY = /(?:^|\s)0 sections|page from \d+ evidence pages/;
  const workAbout = (e, T) => {
    if (!T || !e || !e.w) return false;
    if (T.title.test(String(e.title || ""))) return true;
    const h = String(e.heading || "");
    return h.length > 0 && h.length <= 160 && T.title.test(h) && !WEAK_WHY.test(String(e.why || ""));
  };
  /* A shown quotation is whole sentences: it starts at a sentence boundary and ends at a sentence end (2026-10-20, after a quotation
     stopped before the clause that mattered). It begins at the first sentence that names the topic and adds the sentences after it
     while they fit; if that sentence alone is too long, no quotation is made. */
  const sentencesOf = (t) => {
    const out = [];
    let from = 0;
    for (const m of t.matchAll(/[.!?]["\u201d\u2019)\]]?\s+(?=["\u201c\u2018(\[]?[A-Z])/g)) {
      const head = t.slice(from, m.index + 1);
      const before = t.slice(0, m.index);
      const word = (before.match(/([A-Za-z]+)$/) || ["", ""])[1];
      const open = (before.match(/\(/g) || []).length - (before.match(/\)/g) || []).length;
      if (open > 0 || (word.length <= 4 && /^[A-Z]/.test(word) && /[.]$/.test(m[0].charAt(0)))) continue;
      out.push(head.trim());
      from = m.index + m[0].length;
    }
    if (from < t.length) out.push(t.slice(from).trim());
    return out.filter(Boolean);
  };
  const excerpt = (raw, re, n) => {
    const sents = sentencesOf(cleanText(raw)).filter((x) => /^["\u201c\u2018]?[A-Z0-9]/.test(x) && !/^[A-Z][a-z]{0,4}\.\s*\d/.test(x));
    const i = re ? sents.findIndex((x) => re.test(x) && x.length >= 40 && x.length <= n) : -1;
    if (i < 0) return "";
    let out = sents[i];
    for (let j = i + 1; j < sents.length && out.length + sents[j].length + 1 <= Math.min(n, QUOTE_PAD); j += 1) out = `${out} ${sents[j]}`;
    return /[.!?]["\u201d\u2019)\]]?$/.test(out) ? out : "";
  };
  const normKey = (s) => cleanText(plain(s)).toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, " ");
  // A work's column. The Fathers' shelves are early only with a known date no later than EARLY_END; a later Latin author is Medieval.
  const columnOfGroup = (g, y) => {
    const k = COLUMN_OF_GROUP[g];
    if (k !== "early") return k || null;
    if (Number(y) > 0 && Number(y) <= EARLY_END) return "early";
    return g === "pl" ? "rc" : null;
  };
  const displayGroup = (g, y) => (g === "pl" && columnOfGroup(g, y) !== "early" ? "md" : g);
  // The rank of a document in a church's list of principal documents (the marquee file), or -1.
  const principalRank = (principal, col, w) => {
    const list = (principal && principal[col]) || [];
    return list.findIndex((sub) => String(w).includes(sub));
  };

  // ── The model ─────────────────────────────────────────────────
  function buildDeskModel(input) {
    const {
      locus, part, parent = null, topic = null, conf = null, scr = null, treat = [], data = {}, marquee = null, history = null, keyWorks = null,
      books = new Map(), loci = new Map(), bodyOf = null, principal = {}, vettedOnly = true,
    } = input;
    const counts = (topic && topic.counts) || {};
    const articles = ((conf && conf.articles) || []).filter((a) => a && a.w);
    const treatList = (treat || []).filter((e) => e && e.w);
    const trace = ((topic && topic.trace) || []).filter((t) => t.cen && t.total > 0);
    const authors = (topic && topic.authors) || [];
    const rows = ((scr && scr.rows) || []).filter((r) => books.has(r.b));
    const timeline = (conf && conf.timeline) || [];
    const omitted = [];
    const skip = (module, reason) => { omitted.push({ module, reason }); return null; };
    const hit = marquee || null;

    const model = {
      id: locus.id, label: locus.label, tier: "thin", modules: {}, omitted,
      from: conf && conf.from ? conf.from : null,
    };

    // Hero ----------------------------------------------------------
    const dek = hit && hit.dek ? hit.dek : (locus.definition || "");
    const tiles = [
      [articles.length, "Confession articles", "traditions"], [counts.works, "Works", "treatments"],
      [counts.authors, "Authors", "people"], [scr && scr.total, "Verses cited", "verses"],
    ].filter(([n]) => n > 0).map(([n, label, to]) => ({ n, label, to }));
    const kids = (locus.children || []).map((c) => ({ id: c.id, label: c.label }));

    // Ruler ---------------------------------------------------------
    let ruler = null;
    if (trace.length >= MIN.ruler) {
      const cens = trace.map((t) => t.cen);
      const minC = Math.min(...cens);
      const maxC = Math.max(...cens);
      const bars = [];
      for (let c = minC; c <= maxC; c += 1) {
        const t = trace.find((x) => x.cen === c);
        const by = {};
        ((t && t.by) || []).forEach((b) => { by[b.k] = b.n; });
        bars.push({ c, total: t ? t.total : 0, by });
      }
      const dated = timeline.filter((d) => Number(d.year) > (minC - 1) * 100 && Number(d.year) <= maxC * 100);
      const marks = [];
      (data.councils || []).forEach((cn) => {
        if (cn.y <= (minC - 1) * 100 || cn.y > maxC * 100) return;
        if (dated.some((d) => /^Council$/i.test(String(d.doc_type || "")) && Math.abs(Number(d.year) - cn.y) <= 1)) marks.push({ name: cn.name, y: cn.y });
      });
      const undated = ((topic && topic.trace) || []).filter((t) => !t.cen).reduce((s, t) => s + t.total, 0);
      const present = SHELF_ORDER.filter((k) => bars.some((b) => b.by[k]));
      ruler = {
        minC, maxC, bars, undated, positions: counts.positions || 0, shelves: present,
        docs: dated.map((d) => ({ y: Number(d.year), doc: plain(stripYear(d.doc)) })), councils: marks,
        hasCouncil: marks.length > 0,
      };
    } else skip("ruler", `${trace.length} dated centuries (needs ${MIN.ruler})`);

    // Church columns -----------------------------------------------
    /* What a column may show (2026-10-20). An article must be ABOUT the topic (articleAbout), from one of the church's principal
       documents (the marquee file lists them, in order) and long enough to be a statement, not a fragment. A work must have a title or
       section heading that names the topic (workAbout). A topic the marquee file has hand-vetted (it carries "articles" or "works") shows
       only those listed picks, each checked against the live data; any other topic gets the same rules applied to everything.
       Nothing that fails is shown: a column with nothing vetted to show is left out, never filled with a weaker pick. */
    const T = topicTerms(locus, hit);
    const vetted = Boolean(hit && (hit.articles || hit.works));
    const relevant = articles.filter((a) => articleAbout(a, T, locus.id));
    const colMap = new Map();
    const colOf = (k) => {
      if (!colMap.has(k)) colMap.set(k, { id: k, name: CHURCH_LABEL[k], arts: [], works: [], quotes: [], docs: new Set(), authors: 0 });
      return colMap.get(k);
    };
    relevant.forEach((a) => {
      const k = churchOfArticle(a);
      if (k) { const col = colOf(k); col.docs.add(`${a.w}`); col.arts.push(a); }
    });
    const quoteOf = (a) => {
      // A question-and-answer article often leaves the topic's name to its title (the question), which the caption prints; its answer then opens the quotation.
      let text = excerpt(a.text, T && T.lead, QUOTE_MAX);
      if (!text && T && T.title.test(articleTitle(a))) text = excerpt(a.text, /[\s\S]/, QUOTE_MAX);
      return text ? { doc: plain(stripYear(a.doc)), year: Number(a.year) || 0, article: articleTitle(a), text, w: a.w, p: a.p, href: a.href } : null;
    };
    const titleRank = (a) => (T && T.title.test(articleTitle(a)) ? 0 : 1);
    const workPool = [];
    const pinMiss = [];
    CHURCHES.forEach(([k]) => {
      const pickedDocs = new Set();
      const quotes = [];
      if (vetted) {
        (((hit.articles || {})[k]) || []).forEach((pin) => {
          const a = articles.find((x) => x.w === pin.w && (!pin.a || normKey(articleTitle(x)).startsWith(normKey(pin.a))));
          const q = a && quoteOf(a);
          if (q && churchOfArticle(a) === k && T.lead.test(`${articleTitle(a)} ${cleanText(a.text)}`) && quotes.length < CAP.quotesPerColumn) quotes.push({ ...q, why: pin.why || "" });
          else pinMiss.push(`${k}:${pin.w}`);
        });
      } else if (colMap.has(k)) {
        colMap.get(k).arts.map((a) => ({ a, r: principalRank(principal, k, a.w) })).filter(({ a, r }) => r >= 0 && cleanText(a.text).length >= 100)
          .sort((x, y) => x.r - y.r || titleRank(x.a) - titleRank(y.a) || (Number(x.a.year) || 0) - (Number(y.a.year) || 0)).forEach(({ a }) => {
            if (quotes.length >= CAP.quotesPerColumn || pickedDocs.has(a.w)) return;
            const q = quoteOf(a);
            if (q) { pickedDocs.add(a.w); quotes.push(q); }
          });
      }
      if (k === "early") quotes.splice(0, quotes.length, ...quotes.filter((q) => q.year > 0 && q.year < EARLY_END)); // no undated entry in a dated column
      if (quotes.length) { colOf(k).quotes = quotes.sort((x, y) => (x.year || 9999) - (y.year || 9999)); }
    });
    if (pinMiss.length) omitted.push({ module: "vetted-pick", reason: `not found or not about the topic: ${pinMiss.join(", ")}` });
    // Works: hand-vetted picks (checked against the topic's treatments) or, for any other topic, every treatment whose title or heading names the topic.
    if (vetted) {
      CHURCHES.forEach(([k]) => {
        (((hit.works || {})[k]) || []).forEach((pin) => {
          const base = treatList.find((x) => x.w === pin.w && (pin.p == null || Number(x.p) === Number(pin.p)));
          const early = k !== "early" || (Number(base && base.y) > 0 && Number(base.y) <= EARLY_END);
          if (base && early && workAbout(base, T) && colOf(k).works.length < CAP.worksPerColumn) {
            // at / heading: the page where the discussion itself begins (the library's section list), when the ranked page was an index or a preface.
            const e = { ...base, p: pin.at != null ? pin.at : base.p, heading: pin.heading != null ? pin.heading : base.heading, credit: pin.credit || "" };
            colOf(k).works.push(e);
            workPool.push({ e, k, why: pin.why || "" });
          } else pinMiss.push(`${k}:${pin.w}`);
        });
      });
    } else {
      treatList.filter((e) => workAbout(e, T)).forEach((e) => {
        const k = columnOfGroup(groupOf(e, bodyOf), e.y);
        workPool.push({ e, k, why: "" });
        if (!k) return;
        const col = colOf(k);
        if (col.works.length < CAP.worksPerColumn && !col.works.some((x) => x.author === e.author)) col.works.push(e);
      });
    }
    colMap.forEach((col) => { col.works.sort((x, y) => (Number(x.y) || 9999) - (Number(y.y) || 9999)); });
    authors.forEach((a) => {
      const k = columnOfGroup(groupOf(a, bodyOf), a.y);
      if (k && colMap.has(k)) colMap.get(k).authors += 1;
    });
    const columns = CHURCHES.map(([k]) => colMap.get(k)).filter(Boolean).map((col) => ({
      id: col.id, name: col.name, quotes: col.quotes,
      works: col.works.map((e) => ({ w: e.w, p: e.p, title: plain(clip(e.title, 70)), author: e.author, credit: e.credit || "", shelf: groupLabel(displayGroup(groupOf(e, bodyOf), e.y)), y: e.y })),
      nArticles: col.arts.length, nDocs: col.docs.size, nAuthors: col.authors,
    })).filter((c) => c.quotes.length || c.works.length);
    /* Documents the library maps to this topic that no column takes in: its church is not one of these (a Waldensian or Bohemian
       confession) or is not settled here (the Confession of Cyril Lukaris, 1629, which the library files as Reformed). Named, not counted. */
    const withheld = [];
    relevant.forEach((a) => {
      const label = plain(stripYear(a.doc));
      if (!churchOfArticle(a) && Number(a.year) >= EARLY_END && !/lukar/i.test(a.doc) && !withheld.some((x) => x.label === label)) withheld.push({ label, year: Number(a.year) });
    });

    // Fault-line row (marquee only; every quotation must be found word for word) --
    let fault = null;
    if (hit && hit.fault && hit.fault.rows) {
      const norm = (s) => cleanText(s).replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
      const okRows = hit.fault.rows.filter((r) => {
        const a = articles.find((x) => x.w === r.w && x.p === r.p);
        return a && norm(a.text).includes(norm(r.quote));
      });
      if (okRows.length >= 3 && okRows.length === hit.fault.rows.length) fault = { question: hit.fault.question, rows: okRows.map((r) => ({ church: r.church, doc: r.doc, quote: r.quote, href: readHref(r.w, null) })) };
      else skip("fault-line", "a quotation was not found in the mapped article");
    }

    let traditions = null;
    if (columns.length >= MIN.columns) {
      traditions = { columns, fault, nArticles: articles.length, from: model.from, noOrthodox: !columns.some((c) => c.id === "or"), withheld: withheld.slice(0, 6), lukaris: articles.some((a) => /lukar/i.test(a.doc)) };
    } else skip("traditions", `${columns.length} church columns (needs ${MIN.columns})`);

    // Classic treatments (only works whose title or section heading names the topic; a vetted topic only its vetted picks) --
    let treatments = null;
    const classic = workPool.map((x) => x.e);
    if (classic.length >= MIN.treatments) {
      const groups = new Map();
      classic.forEach((e) => {
        const g = displayGroup(groupOf(e, bodyOf), e.y);
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push({
          w: e.w, p: e.p, title: plain(clip(e.title, 70)), author: e.author, y: e.y || 0, authorId: e.author_id,
          section: showHeading(e.heading) ? plain(clip(e.heading, 110)) : "",
        });
      });
      groups.forEach((rowsG, g) => { if (FATHER_GROUPS.has(g) || g === "md") rowsG.sort((x, y) => (x.y || 9999) - (y.y || 9999)); });
      treatments = { n: classic.length, groups: groupOrder([...groups.keys()]).map((g) => ({ id: g, label: groupLabel(g), shelf: shelfKey({ sh: g.split(":")[0] }), rows: groups.get(g) })) };
    } else skip("treatments", `${classic.length} vetted treatments (needs ${MIN.treatments})`);

    // Timeline -----------------------------------------------------
    const typeRank = (t) => (/^(Council|Creed|Definition|Canons)$/.test(t) ? 0 : /^(Confession|Catechism|Articles|Formula|Apology)$/.test(t) ? 1 : 2);
    /* The doctrine through the centuries: the century counts from the worker's own trace, and as markers only the dated
       documents the library holds on this topic (each linked to its first article here). No quotation, no summary. */
    let chron = null;
    if (ruler) {
      const byCen = new Map();
      timeline.forEach((d) => {
        const y = Number(d.year) || 0;
        const first = articles.find((a) => a.w === d.w);
        if (!y || !first) return;
        const c = Math.ceil(y / 100);
        if (!byCen.has(c)) byCen.set(c, []);
        byCen.get(c).push({ y, title: plain(stripYear(d.doc)), type: String(d.doc_type || ""), rank: typeRank(d.doc_type), n: Number(d.n_articles) || 1, w: first.w, href: safeRead(first.href, first.w, first.p) });
      });
      const rowsC = ruler.bars.filter((b) => b.total || byCen.has(b.c)).map((b) => {
        const all = (byCen.get(b.c) || []).sort((x, y) => x.rank - y.rank || x.y - y.y);
        const shown = all.slice(0, CAP.docsPerCentury).sort((x, y) => x.y - y.y);
        return { c: b.c, total: b.total, by: b.by, docs: shown, more: all.length - shown.length, era: eraOf(b.c), kw: (keyWorks && keyWorks.get(b.c)) || [] };
      });
      const nDocs = rowsC.reduce((n, r) => n + r.docs.length + r.more, 0);
      /* The period summaries of the page's History data ("2nd-3rd centuries"), relocated onto the rows: each goes on the row of its first
         century, or on the next row after it when that century has none. A period that fits no row is kept, in order, after the rows. */
      const periods = (history && history.history ? history.history : []).map((h) => {
        const nums = (String(h.period || "").match(/\d+/g) || []).map(Number);
        return { period: String(h.period || ""), text: String(h.text || ""), refs: Array.isArray(h.refs) ? h.refs : [], first: nums[0] || 0, last: nums[1] || nums[0] || 0 };
      });
      const loose = [];
      periods.forEach((pd, i) => {
        pd.i = i;
        // A period shows under every century row it covers. The first of them carries the notes list; the others point to it.
        const cov = pd.first ? rowsC.filter((r) => r.c >= pd.first && r.c <= pd.last) : [];
        if (!cov.length) { loose.push(pd); return; }
        cov.forEach((r, k) => { (r.periods = r.periods || []).push({ pd, lead: k === 0, firstC: cov[0].c }); });
      });
      const eras = ERAS.map((e) => ({ ...e, rows: rowsC.filter((r) => r.era === e.id) })).filter((e) => e.rows.length);
      if (rowsC.filter((r) => r.total).length >= MIN.ruler) {
        chron = { eras, max: Math.max(...rowsC.map((r) => r.total)), positions: ruler.positions, shelves: ruler.shelves, nDocs, title: aboutTitle(locus.label), lede: history && history.summary ? String(history.summary) : "", loose, nPeriods: periods.length, compact: nDocs < MIN.docs, hasCouncil: rowsC.some((r) => r.docs.some((d) => d.rank === 0)) };
      } else skip("centuries", "fewer than 3 centuries with data");
    }

    // Key verses ---------------------------------------------------
    /* A key verse is a verse of the topic's own cited passages (the Scripture rows) that the topic's confession articles
       themselves cite: counted once per article, over the articles that are about the topic, a range counted verse by verse.
       A verse cited by fewer than two such articles is not a key verse, however often the library's index meets it. */
    let verses = null;
    const rowKey = (r) => `${r.b}.${r.c}.${r.v}`;
    const countCites = (arts) => {
      const cites = new Map();
      arts.forEach((a) => {
        const once = new Set();
        (a.scripture || []).forEach((r) => {
          const last = Math.min(Number(r.v2) || Number(r.v), Number(r.v) + 30);
          for (let v = Number(r.v); v <= last; v += 1) once.add(`${r.b}.${r.c}.${v}`);
        });
        once.forEach((k) => cites.set(k, (cites.get(k) || 0) + 1));
      });
      return cites;
    };
    const rankRows = (cites) => rows.map((r) => ({ r, k: cites.get(rowKey(r)) || 0 })).filter(({ k }) => k >= MIN.citeArticles)
      .sort((x, y) => y.k - x.k || (y.r.lift || 0) - (x.r.lift || 0));
    const cite = countCites(relevant);
    let keyRows = rankRows(cite);
    /* A topic with two sides (the marquee file's verseThemes: words that pick out the articles on each side, for the person and the
       work of Christ) takes its key verses alternately from each side's own most-cited list, so one side cannot fill the page. */
    const themes = ((hit && hit.verseThemes) || []).map((t) => (typeof t === "string" ? { terms: t, take: 1 } : t)).filter((t) => termRe(t.terms));
    if (themes.length) {
      const lists = themes.map((t) => ({ take: Number(t.take) || 1, list: rankRows(countCites(relevant.filter((a) => termRe(t.terms).test(`${articleTitle(a)} ${leadOf(a.text)}`)))).sort((x, y) => y.k * (y.r.lift || 1) - x.k * (x.r.lift || 1)) }));
      const seenRows = new Set();
      const mixed = [];
      const idx = lists.map(() => 0);
      for (let guard = 0; guard < 200 && mixed.length < keyRows.length; guard += 1) {
        lists.forEach((l, li) => {
          for (let t = 0; t < l.take && idx[li] < l.list.length; idx[li] += 1) {
            const row = l.list[idx[li]];
            if (!seenRows.has(rowKey(row.r))) { seenRows.add(rowKey(row.r)); mixed.push({ r: row.r, k: cite.get(rowKey(row.r)) || 0 }); t += 1; }
          }
        });
      }
      keyRows = [...mixed, ...keyRows.filter(({ r }) => !seenRows.has(rowKey(r)))];
    }
    /* Adjacent verses (up to three in a row, each a key verse) become one card, so a run like Ephesians 1:4, 5, and 6 takes one place, not three. */
    const byKey = new Map(keyRows.map((x) => [rowKey(x.r), x]));
    const taken = new Set();
    const cards = [];
    keyRows.forEach((x) => {
      if (taken.has(rowKey(x.r))) return;
      const run = [x];
      taken.add(rowKey(x.r));
      const at = (v) => { const y = byKey.get(`${x.r.b}.${x.r.c}.${v}`); return y && !taken.has(rowKey(y.r)) ? y : null; };
      for (let guard = 0; guard < 2; guard += 1) {
        const hi = at(Number(run[run.length - 1].r.v) + 1);
        const lo = at(Number(run[0].r.v) - 1);
        if (hi) { run.push(hi); taken.add(rowKey(hi.r)); } else if (lo) { run.unshift(lo); taken.add(rowKey(lo.r)); } else break;
      }
      cards.push(run);
    });
    if (cards.length >= MIN.verses) {
      const notes = (hit && hit.verseNotes) || {};
      const lab = (run) => {
        const { r } = run[0];
        const b = books.get(r.b);
        const last = run[run.length - 1].r;
        return `${b.slug === "psalms" ? "Psalm" : b.name} ${r.c}:${r.v}${run.length > 1 ? `\u2013${last.v}` : ""}`;
      };
      verses = {
        items: cards.slice(0, CAP.verses).map((run) => {
          const { r } = run[0];
          const n = run.reduce((t, y) => t + (Number(y.r.n) || 0), 0);
          const nAll = run.reduce((t, y) => t + (Number(y.r.n_all) || 0), 0);
          return {
            ref: lab(run), href: `/the-faith-received/scripture/desk/?ref=${books.get(r.b).slug}.${r.c}.${r.v}`, text: run.map((y) => y.r.t || "").filter(Boolean).join(" "),
            n, nAll, share: nAll ? Math.round((100 * n) / nAll) : 0, lift: r.lift, note: run.map((y) => notes[rowKey(y.r)] || "").filter(Boolean)[0] || "", articles: Math.max(...run.map((y) => y.k)),
          };
        }),
        more: cards.slice(CAP.verses, CAP.verses + CAP.moreVerses).map(lab),
        total: (scr && scr.total) || rows.length, nArticles: relevant.length,
      };
    } else skip("verses", `${cards.length} verse cards cited by ${MIN.citeArticles} or more of the topic's articles (needs ${MIN.verses})`);

    // People -------------------------------------------------------
    let people = null;
    const portrait = new Set(data.portraits || []);
    if (authors.length >= MIN.people) {
      const pool = [...authors].filter((a) => a.s && a.a).sort((x, y) => (y.n || 0) - (x.n || 0));
      const chosen = [];
      const perGroup = new Map();
      const take = (needPortrait) => pool.forEach((a) => {
        if (chosen.length >= CAP.people || chosen.includes(a)) return;
        if (needPortrait && !portrait.has(a.s)) return;
        const g = groupOf(a, bodyOf);
        if ((perGroup.get(g) || 0) >= 2) return;
        perGroup.set(g, (perGroup.get(g) || 0) + 1);
        chosen.push(a);
      });
      take(true);
      if (chosen.length < 8) { perGroup.clear(); chosen.forEach((a) => perGroup.set(groupOf(a, bodyOf), (perGroup.get(groupOf(a, bodyOf)) || 0) + 1)); take(false); }
      if (chosen.length >= MIN.people) {
        chosen.sort((a, b) => (Number(a.y) || 9999) - (Number(b.y) || 9999));
        people = {
          nAuthors: counts.authors || authors.length,
          items: chosen.map((a) => ({
            name: a.a, slug: a.s, born: Number(a.y) || 0, church: personChurch(groupOf(a, bodyOf)), pages: Number(a.pages) || 0, portrait: portrait.has(a.s),
          })),
        };
      } else skip("people", `${chosen.length} people (needs ${MIN.people})`);
    } else skip("people", `${authors.length} authors (needs ${MIN.people})`);

    // Reading path -------------------------------------------------
    /* Built only from what the columns already vetted: the shortest statements among the topic's principal-document articles,
       one vetted treatment from each church, and the earliest vetted treatments dated to the early church. */
    let path = null;
    {
      const typeOrder = ["Creed", "Catechism", "Confession", "Articles", "Formula", "Definition", "Council"];
      const pool = [];
      if (vetted) CHURCHES.forEach(([k]) => (((hit.articles || {})[k]) || []).forEach((pin) => {
        const a = articles.find((x) => x.w === pin.w && (!pin.a || normKey(articleTitle(x)).startsWith(normKey(pin.a))));
        if (a && columns.some((c) => c.id === k && c.quotes.length >= 2 && c.quotes.some((q) => q.w === a.w))) pool.push(a);
      }));
      else relevant.forEach((a) => { const k = churchOfArticle(a); if (k && principalRank(principal, k, a.w) >= 0) pool.push(a); });
      const cand = pool.map((a) => ({ a, t: cleanText(a.text) })).filter(({ t }) => t.length >= 120 && t.length <= 1500)
        .sort((x, y) => typeOrder.indexOf(x.a.doc_type) - typeOrder.indexOf(y.a.doc_type) || x.t.length - y.t.length);
      const start = [];
      const docs = new Set();
      [0, 1].forEach((pass) => cand.forEach(({ a }) => {
        if (start.length >= 3 || docs.has(a.w)) return;
        if (pass === 0 && start.some((x) => x.type === a.doc_type)) return;
        docs.add(a.w);
        start.push({ w: a.w, p: a.p, href: a.href, title: plain(clip(`${stripYear(a.doc)}, ${articleTitle(a)}`.replace(/,\s*$/, ""), 90)), type: a.doc_type });
      }));
      const deeper = [];
      ["rc", "lu", "rf", "an", "bp"].forEach((k) => {
        const m = workPool.find(({ e, k: wk }) => wk === k && !deeper.some((d) => d.author === e.author));
        if (m && deeper.length < 4) deeper.push({ w: m.e.w, p: m.e.p, title: plain(`${m.e.author}, ${clip(m.e.title, 60)}`), author: m.e.author });
      });
      const sources = [];
      workPool.filter(({ k }) => k === "early").map(({ e }) => e).sort((x, y) => (Number(x.y) || 9999) - (Number(y.y) || 9999)).forEach((e) => {
        if (sources.length < 4 && !sources.some((x) => x.author === e.author)) sources.push({ w: e.w, p: e.p, title: plain(`${e.author}, ${clip(e.title, 60)}`), author: e.author });
      });
      const steps = [
        { name: "Start here", note: "Short statements, a few minutes each.", items: start },
        { name: "Go deeper", note: "A treatment from each of several traditions, each with a title or section that names the topic.", items: deeper },
        { name: "To the sources", note: "The earliest treatments in the library, dated to 1054 or before, oldest first.", items: sources },
      ].filter((x) => x.items.length >= MIN.pathItems);
      if (steps.length >= MIN.pathSteps) path = { steps };
      else skip("path", `${steps.length} steps (needs ${MIN.pathSteps})`);
    }

    // Related topics -----------------------------------------------
    let related = null;
    const rel = ((data.related || {})[locus.id] || []).filter((r) => loci.has(r.id)).slice(0, CAP.related);
    if (rel.length >= MIN.related) related = { items: rel.map((r) => ({ id: r.id, label: loci.get(r.id).label, n: r.n })), label: locus.label };
    else skip("related", `${rel.length} neighbors (needs ${MIN.related})`);

    /* Scope (2026-10-20): the church columns, classic works, key verses, and reading path are on only for a topic the marquee file has
       hand-vetted. For every other topic they stay off, because the same rules still let weak picks through there (a volume's
       abbreviations as a classic work, a catechism question on swearing under Sin). */
    const off = (k, name, v) => { if (MODULES_ON[k] && (vetted || !vettedOnly)) return v; if (v) skip(name, MODULES_ON[k] ? "not hand-vetted: only the marquee topics show this module" : "switched off until its content is vetted"); return null; };
    traditions = off("traditions", "traditions", traditions);
    treatments = off("treatments", "treatments", treatments);
    verses = off("verses", "verses", verses);
    path = off("path", "path", path);
    model.modules = {
      hero: {
        title: locus.label, dek, kids, tiles, ruler,
        partLabel: part ? `Part ${part.n}` : "", parent: parent ? { id: parent.id, label: parent.label } : null,
      },
      traditions, treatments, chron, verses, people, path, related,
    };
    const full = articles.length >= 6 && treatList.length >= 8 && rows.length >= 20 && trace.length >= 8;
    model.tier = hit ? "marquee" : full ? "full" : "thin";
    return model;
  }

  // ── Rendering ─────────────────────────────────────────────────
  const link = (href, text, cls) => `<a${cls ? ` class="${cls}"` : ""} href="${esc(href)}">${esc(text)}</a>`;
  // How a figure was made is a closed Methodology under the heading (assets/js/lib/tfr-method.js). Without the helper (Node) the note is a plain paragraph.
  const method = (html) => {
    const M = typeof window !== "undefined" ? window.TFRMethod : globalThis.TFRMethod;
    return M ? M.html(html) : (/^</.test(html) ? html : `<p class="tdk-lede">${html}</p>`);
  };
  const modHead = (eyebrow, title, lede) =>
    `<div class="tdk-head"><p class="tdk-eyebrow">${esc(eyebrow)}</p><h3 class="tdk-h">${esc(title)}</h3>${lede ? method(lede) : ""}</div>`;

  function renderHero(h, tier, ids) {
    const jumps = [];
    const j = (id, label) => { if (ids[id]) jumps.push(link(`#tdk-${id}`, label)); };
    j("traditions", "Traditions"); j("treatments", "Classic works"); j("chron", "About"); j("verses", "Key verses");
    j("people", "People"); j("path", "Reading path"); j("related", "Related");
    jumps.push(link("#td-h-conf", "Full record"));
    const tiles = h.tiles.length ? `<ul class="tdk-tiles" aria-label="This topic in the library">${h.tiles.map((t) =>
      `<li>${ids[t.to] ? `<a href="#tdk-${t.to}"><b>${fmt(t.n)}</b><span>${esc(t.label)}</span></a>` : `<b>${fmt(t.n)}</b><span>${esc(t.label)}</span>`}</li>`).join("")}</ul>` : "";
    return `<div class="tdk-hero" id="tdk-hero" data-tier="${esc(tier)}"><div class="tdk-hero-grid">${h.dek ? `<p class="tdk-dek">${esc(h.dek)}</p>` : ""}${tiles}</div>` +
      `${jumps.length ? `<nav class="tdk-jump" aria-label="On this page">${jumps.join("")}</nav>` : ""}</div>`;
  }

  function renderTraditions(t, label) {
    const cols = t.columns.map((c) => {
      const quotes = c.quotes.map((q) =>
        `<figure class="tdk-quote"><blockquote>${esc(q.text)}</blockquote><figcaption>${link(safeRead(q.href, q.w, q.p), [q.doc, q.article && q.article !== q.doc ? q.article : ""].filter(Boolean).join(", "))}${q.year ? ` <span>${q.year}</span>` : ""}</figcaption></figure>`).join("");
      const works = c.works.length ? `<h4 class="tdk-h4">Key works</h4><ul class="tdk-keyworks">${c.works.map((w) =>
        `<li>${link(readHref(w.w, w.p), w.title)}<span class="by">${esc(w.author)}${w.credit ? ` (${esc(w.credit)})` : ""}${w.shelf && w.shelf !== c.name ? `, ${esc(w.shelf)}` : ""}</span></li>`).join("")}</ul>` : "";
      const stat = [c.nArticles ? `${plural(c.nArticles, "article", "articles")} in ${plural(c.nDocs, "document", "documents")} whose title or opening names this topic` : "", c.nAuthors ? `${plural(c.nAuthors, "author", "authors")} among the 400 with the most indexed passages` : ""].filter(Boolean).join(". ");
      return `<article class="tdk-card" id="tdk-trad-${esc(c.id)}"><h4 class="tdk-card-h">${esc(c.name)}</h4>${quotes ? `<h4 class="tdk-h4">What the documents say</h4>${quotes}` : ""}${works}${stat ? `<p class="tdk-small tdk-stat">${esc(stat)}.</p>` : ""}${c.id === "rf" && t.lukaris ? `<p class="tdk-small tdk-lukaris">The Confession of Cyril Lukaris (1629) is listed separately; it is not counted under Reformed.</p>` : ""}</article>`;
    }).join("");
    const f = t.fault;
    const fault = f ? `<table class="tdk-matrix"><caption>${esc(f.question)}</caption><thead><tr><th scope="col">Church</th><th scope="col">The text</th><th scope="col">Source</th></tr></thead><tbody>${f.rows.map((r) =>
      `<tr><th scope="row">${esc(r.church)}</th><td>“${esc(r.quote)}”</td><td>${link(r.href, r.doc)}</td></tr>`).join("")}</tbody></table>${t.noOrthodox ? `<p class="tdk-small">The library maps no Orthodox document, so the Eastern view appears only in the 381 text above.</p>` : ""}` : "";
    const notes = [!f && t.noOrthodox ? "The library maps no Orthodox document for this topic." : "",
      t.withheld.length ? `Mapped to this topic but not placed in a column: ${t.withheld.map((x) => `${x.label} (${x.year})`).join("; ")}.` : ""].filter(Boolean);
    const noteHtml = notes.length ? `<p class="tdk-small tdk-trad-note">${esc(notes.join(" "))}</p>` : "";
    return `<section class="tdk-mod" id="tdk-traditions">${modHead("How each tradition treats it", `${label} in the documents of the churches`,
      `Each column shows words from the principal documents of that church whose title or opening names this topic. All ${fmt(t.nArticles)} articles mapped to it are in the full record below.${t.from ? ` These documents are mapped to ${link(topicHref(t.from.id), t.from.label)}, which this topic belongs to.` : ""}`)}${fault}<div class="tdk-grid">${cols}</div>${noteHtml}</section>`;
  }

  function renderTreatments(t) {
    const groups = t.groups.map((g) => `<div class="tdk-tgroup"><h4 class="tdk-tgroup-h"><i class="b-${esc(g.shelf)}"></i>${esc(g.label)} <span>${g.rows.length}</span></h4><ul class="tdk-tlist">${g.rows.map((r) =>
      `<li>${link(readHref(r.w, r.p), r.title, "tw")}<span class="ta">${esc(r.author)}${r.y ? `, fl. ${r.y}` : ""}</span>${r.section ? `<span class="ts">${esc(r.section)}</span>` : ""}</li>`).join("")}</ul></div>`).join("");
    return `<section class="tdk-mod" id="tdk-treatments">${modHead("Classic treatments", "The standard works, section by section",
      `${plural(t.n, "treatment", "treatments")}. Each opens at the section that names the topic. Every link goes to that page in the reader.`)}<div class="tdk-tcols">${groups}</div></section>`;
  }

  // The page's History summary for one period, exactly as the page has always shown it (text and source links unchanged).
  const refWho = (r) => `${r.a || r.author || r.side || "page"}${r.via ? `, via ${r.via}` : ""}`;
  // "Covers the 2nd and 3rd centuries": said only when a period spans more than one.
  const coversLine = (pd) => (pd.last > pd.first ? `Covers the ${ord(pd.first)} ${pd.last - pd.first === 1 ? "and" : "to"} ${ord(pd.last)} centuries.` : "");
  function periodHtml(pd, lead = true, firstC = 0) {
    const covers = coversLine(pd);
    // The data gives one flat list of pages per period, not a source for each claim, so the list is numbered like notes to the paragraph as a whole and says so. No marker is placed in the text.
    const refs = pd.refs.length ? `<p class="tdk-small tdk-notes-h">Pages this paragraph was drawn from</p><ol class="tdk-notes fr-dn-pages" id="tdk-pd-${pd.i}-notes">${pd.refs.slice(0, 12).map((r) => `<li><a href="${esc(readHref(r.w, r.p))}">${esc(`${refWho(r)}, p. ${r.p}`)}</a></li>`).join("")}</ol>` : "";
    const see = pd.refs.length ? `<p class="tdk-small"><a href="#tdk-pd-${pd.i}-notes" data-notes-for="${Number(firstC)}">See the notes under the ${ord(Number(firstC))} century</a></p>` : "";
    return `<div class="tdk-period" data-period="${pd.i}">${covers ? `<p class="tdk-small tdk-covers">${esc(covers)}</p>` : ""}<p>${esc(pd.text)}</p>${lead ? refs : see}</div>`;
  }

  // Key works for one century: plain list rows, ranked and chosen by topic-key-works.js. The line under the title says what the ranking is.
  function keyWorksHtml(list) {
    if (!list || !list.length) return "";
    return `<div class="tdk-kw"><h5 class="tdk-kw-h">Key works</h5><p class="tdk-small">Works with the most passages on this topic</p><ul class="tdk-kwl">${list.map((w) =>
      `<li><a href="${esc(readHref(w.w, w.p))}"><i>${esc(plain(w.title))}</i></a><span>${esc(w.author)}, ${w.y ? `fl. ${Number(w.y)}` : `${ord(Number(w.cen))} century`}</span></li>`).join("")}</ul></div>`;
  }

  function renderChron(c) {
    let step = 0;
    const eras = c.eras.map((e) => {
      const rows = e.rows.map((r) => {
        step += 1;
        const bar = SHELF_ORDER.filter((k) => r.by[k]).map((k) => `<i class="b-${k}" style="width:${((100 * Math.sqrt(r.total / c.max) * r.by[k]) / r.total).toFixed(2)}%" title="${esc(SHELF[k])}: ${fmt(r.by[k])}"></i>`).join("");
        const label = `${fmt(r.total)} indexed passages in the ${ord(Number(r.c))} century`;
        const docs = r.docs.length || r.more ? `<ul class="tdk-docs">${r.docs.map((d) =>
          `<li class="${d.rank === 0 ? "is-council" : ""}"><a href="${esc(d.href)}" aria-label="${esc(`${d.title}, ${Number(d.y)}${d.type ? `, ${d.type}` : ""}. Opens the document.`)}"><b>${Number(d.y)}</b> ${esc(d.title)}${d.type ? `<span>${esc(d.type)}</span>` : ""}</a></li>`).join("")}${r.more ? `<li class="more"><a href="#td-h-conf">${fmt(r.more)} more in the full record</a></li>` : ""}</ul>` : "";
        const has = Boolean((r.periods && r.periods.length) || r.kw.length);
        const pid = `tdk-pn-${Number(r.c)}`;
        const head = `<span class="tdk-cn">${ord(Number(r.c))} century</span><span class="tdk-bar" role="img" aria-label="${esc(label)}" title="${esc(label)}">${bar}</span><span class="tdk-n">${fmt(r.total)}</span>${has ? `<span class="tdk-chev" aria-hidden="true"></span>` : ""}`;
        const header = has ? `<button type="button" class="tdk-row-h" aria-expanded="false" aria-controls="${pid}">${head}</button>` : `<div class="tdk-row-h is-static">${head}</div>`;
        const panel = has ? `<div class="tdk-pn" id="${pid}" hidden>${(r.periods || []).map((x) => periodHtml(x.pd, x.lead, x.firstC)).join("")}${keyWorksHtml(r.kw)}</div>` : "";
        return `<li class="tdk-row${has ? " has-period" : ""}" data-c="${Number(r.c)}" style="--d:${Math.min(step * 45, 900)}ms">${header}${docs}${panel}</li>`;
      }).join("");
      return `<li class="tdk-era tdk-era--${e.id}"><h4 class="tdk-era-h">${esc(e.label)} <span>${esc(e.span)}</span></h4><ol class="tdk-rows">${rows}</ol></li>`;
    }).join("");
    const loose = c.loose.length ? `<div class="tdk-loose"><h4 class="tdk-era-h">Other periods</h4>${c.loose.map((pd) => `<details class="tdk-loose-d"><summary>${esc(pd.period)}</summary>${periodHtml(pd, true, 0)}</details>`).join("")}</div>` : "";
    const caption = c.compact ? "" : `<p>Each document links to its first article on this topic.${c.hasCouncil ? ` For every council see the ${link(COUNCILS_GUIDE, "Councils guide")}.` : ""}</p>`;
    const histLede = c.lede ? `<p class="tdk-lede tdk-hist-lede">${esc(c.lede)}</p>` : "";
    const aiNote = c.lede && c.nPeriods ? `<p>Machine-written from the authors' own claims, not their words. Every page is checked.</p>` : "";
    const lede = `${histLede}${method(`<p>${fmt(c.positions)} indexed passages in the library, counted by century, with the ${c.nDocs ? `${plural(c.nDocs, "dated document", "dated documents")} on this topic` : "documents"} where the library has them. Bar length is square-root scaled so the early centuries show. A passage is a place in a work where the index finds this topic treated.</p>${caption}<p>Era bands: the early church to 1054, medieval to 1517, Reformation to 1648, post-Reformation to 1800, then modern.</p>${aiNote}`)}`;
    // One section, "About <topic>", with one tablist. History (this ruler) is the first tab and the default. faith-port-topic-dev-notes.js adds the others
    // (Scripture, A course of reading, Traditions compared, Concept guides) through MOAbout (topic-desk.js) when the topic has them.
    return `<section class="tdk-mod tdk-cent" id="tdk-chron" aria-labelledby="tdk-cent-h"><div class="tdk-head"><p class="tdk-eyebrow">Through time</p><h3 class="tdk-h tdk-cent-h" id="tdk-cent-h">${esc(c.title)}</h3></div>` +
      `<div class="tdk-tabs" role="tablist" aria-label="${esc(c.title)}" data-about-tabs><button type="button" role="tab" class="tdk-tab" id="about-history" aria-controls="about-panel-history" aria-selected="true" tabindex="0" data-k="history">History</button></div>` +
      `<div role="tabpanel" class="tdk-panel" id="about-panel-history" aria-labelledby="about-history" tabindex="0" data-about-panel="history">${lede}` +
      `<ul class="tdk-legend" aria-label="Shelves">${c.shelves.map((k) => `<li><i class="b-${k}"></i>${esc(SHELF[k])}</li>`).join("")}</ul>` +
      `<ol class="tdk-eras${c.compact ? " is-compact" : ""}">${eras}</ol>${loose}</div></section>`;
  }

  function renderVerses(v) {
    const items = v.items.map((x) => `<li class="tdk-verse">${link(x.href, x.ref, "vref")}<p class="vtxt">${esc(x.text)}</p>${x.note ? `<p class="vnote">${esc(x.note)}</p>` : ""}` +
      `<div class="meter" role="img" aria-label="${esc(`${fmt(x.n)} of ${fmt(x.nAll)} citations of this verse are on this topic`)}"><i style="width:${Math.max(2, x.share)}%"></i></div>` +
      `<p class="vmeta"><b>${fmt(x.n)}</b> of ${fmt(x.nAll)} citations of this verse are on this topic. ${plural(x.articles, "confession article", "confession articles")} here cite it.</p></li>`).join("");
    return `<section class="tdk-mod" id="tdk-verses">${modHead("Key verses", "The texts cited for it",
      `Verses that two or more of this topic's confession articles cite, the most cited first. Each opens its Verse Desk. The bar shows how much of that verse's citing in the library falls under this topic.${v.more.length ? ` Also frequent: ${esc(v.more.join(", "))}.` : ""}`)}<ul class="tdk-vgrid">${items}</ul></section>`;
  }

  function renderPeople(p) {
    const items = p.items.map((x) => {
      const ini = x.name.split(/\s+/).filter((w) => /^[A-Z]/.test(w)).slice(0, 2).map((w) => w[0]).join("");
      const img = x.portrait ? `<img src="/assets/data/faith-received/guides/portraits/${enc(x.slug)}.jpg" alt="Portrait of ${esc(x.name)}" width="84" height="84" loading="lazy" decoding="async" data-tdk-portrait data-por="${enc(x.slug)}" data-por-name="${esc(x.name)}">` : "";
      return `<li class="tdk-person"><a href="${esc(authorHref(x.slug))}"><span class="ph tfr-por tfr-por--m">${img}<span class="ini" aria-hidden="true"${x.portrait ? " hidden" : ""}>${esc(ini)}</span></span><b>${esc(x.name)}</b>` +
        `<span class="d">${Number(x.born) ? `b. ${Number(x.born)}` : ""}</span><span class="t">${esc(x.church)}</span>${x.pages ? `<span class="t">${plural(x.pages, "page", "pages")} indexed here</span>` : ""}</a></li>`;
    }).join("");
    return `<section class="tdk-mod" id="tdk-people">${modHead("People", "Voices on this topic",
      `${plural(p.items.length, "author", "authors")} of the ${fmt(p.nAuthors)} on this topic, listed by birth year, with authors of unknown birth year last. A fixed rule picks them. Authors with an engraved portrait come first, then those with the most pages indexed on this topic. No more than two come from one shelf.`)}<ul class="tdk-people">${items}</ul></section>`;
  }

  function renderPath(p) {
    const steps = p.steps.map((s, i) => `<li class="tdk-step"><span class="sn">${i + 1}</span><h4 class="tdk-card-h">${esc(s.name)}</h4><p class="tdk-small">${esc(s.note)}</p><ul>${s.items.map((it) =>
      `<li>${link(readHref(it.w, it.p), it.title)}</li>`).join("")}</ul></li>`).join("");
    return `<section class="tdk-mod" id="tdk-path">${modHead("Reading path", "Where to start", "Built only from works in the library: the shortest confession articles first, then a standard treatment from several traditions, then the earliest treatments.")}<ol class="tdk-path">${steps}</ol></section>`;
  }

  /* The related-topics hub. Every label is a block of lines (the name wrapped at 18 characters, then "N shared"), 15 units a line,
     and the block is placed from the node's edge: beside it for side nodes (centered on the node), wholly above it for the top node and
     wholly below it for the bottom node, with a fixed 10-unit gap. Nothing depends on how long a name is, so a label can never
     run into its own node (Ian, 2026-10-20: "16 shared" under a circle). */
  const wrapName = (name, max) => {
    const lines = [];
    String(name).split(/\s+/).forEach((w) => {
      const last = lines[lines.length - 1];
      if (last !== undefined && `${last} ${w}`.length <= max) lines[lines.length - 1] = `${last} ${w}`; else lines.push(w);
    });
    return lines;
  };
  function relSvg(r) {
    const cx = 470; const cy = 250; const rx = 215; const ry = 140; const LH = 15; const GAP = 10;
    const max = Math.max(...r.items.map((i) => Number(i.n)));
    const o = ['<svg class="tdk-rel" viewBox="0 0 940 520" aria-hidden="true" focusable="false">'];
    r.items.forEach((it, k) => {
      const ang = -Math.PI / 2 + (k * 2 * Math.PI) / r.items.length;
      const x = cx + rx * Math.cos(ang); const y = cy + ry * Math.sin(ang);
      const rad = 6 + (10 * Number(it.n)) / max;
      const c = Math.cos(ang);
      const lines = wrapName(it.label, 18);
      const h = (lines.length + 1) * LH;
      let anchor = "start"; let tx = x + rad + GAP; let top = y - h / 2;
      if (Math.abs(c) < 0.2) { anchor = "middle"; tx = x; top = Math.sin(ang) < 0 ? y - rad - GAP - h : y + rad + GAP; } else if (c < 0) { anchor = "end"; tx = x - rad - GAP; }
      const names = lines.map((ln, i) => `<text class="rel-t" x="${tx.toFixed(1)}" y="${(top + LH * (i + 1) - 3).toFixed(1)}" text-anchor="${anchor}">${esc(ln)}</text>`).join("");
      const text = `${names}<text class="rel-s" x="${tx.toFixed(1)}" y="${(top + LH * (lines.length + 1) - 3).toFixed(1)}" text-anchor="${anchor}">${fmt(it.n)} shared</text>`;
      o.push(`<line class="rel-l" x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" style="stroke-width:${(1 + (3 * Number(it.n)) / max).toFixed(1)}"/>` +
        `<circle class="rel-n" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(1)}"/>${text}`);
    });
    o.push(`<circle class="rel-c" cx="${cx}" cy="${cy}" r="40"/><text class="rel-ct" x="${cx}" y="${cy + 4}" text-anchor="middle">This topic</text></svg>`);
    return o.join("");
  }

  function renderRelated(r) {
    const list = r.items.map((it) => `<li>${link(topicHref(it.id), it.label)} <span>${fmt(it.n)} of the 60 most particular proof-texts are shared</span></li>`).join("");
    return `<section class="tdk-mod" id="tdk-related">${modHead("Related topics", "Topics that share its proof-texts",
      "Neighbors by shared proof-texts: how many of each topic's sixty most particular verses it has in common with this one.")}<div class="tdk-relgrid">${relSvg(r)}<ul class="tdk-rellist">${list}</ul></div></section>`;
  }

  /* The HTML for the modules, in page order. The hero is separate so the page can place it under the topic's
     title. Returns { hero, body }. A module that is null renders nothing at all. */
  function renderDesk(model) {
    const m = model.modules;
    const present = {
      traditions: Boolean(m.traditions), treatments: Boolean(m.treatments), chron: Boolean(m.chron), verses: Boolean(m.verses),
      people: Boolean(m.people), path: Boolean(m.path), related: Boolean(m.related),
    };
    const body = [
      m.chron && renderChron(m.chron), m.traditions && renderTraditions(m.traditions, model.label), m.treatments && renderTreatments(m.treatments),
      m.verses && renderVerses(m.verses), m.people && renderPeople(m.people), m.path && renderPath(m.path), m.related && renderRelated(m.related),
    ].filter(Boolean).join("");
    return { hero: renderHero(m.hero, model.tier, present), body };
  }

  return { buildDeskModel, renderDesk, readHref, churchOfArticle, groupOf, MIN, CAP, SHELF, CHURCHES, MODULES_ON, aboutTitle, topicTerms, articleAbout, workAbout, columnOfGroup, principalRank, excerpt, EARLY_END };
}));
