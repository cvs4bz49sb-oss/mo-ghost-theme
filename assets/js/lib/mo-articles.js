/*
 * MOArticles: the Mere Orthodoxy essays that serve the library (2026-10-20).
 *
 * One cached fetch of assets/data/faith-received/mo-articles.json (built by scripts/build-mo-articles.mjs), then
 * lookups by page and a keyword search over just these essays. No DOM: the same code runs in the browser and in
 * scripts/check-mo-articles.mjs. Every article links to the original on mereorthodoxy.com; only a short excerpt is held.
 *
 *   MOArticles.load()               Promise of the data, fetched once. A failed fetch resolves to null and is retried next call.
 *   MOArticles.forVerse(ref)        "romans.8.28" | "romans.8" | "romans.8.28-30": that verse's essays, then essays on its whole chapter
 *   MOArticles.forTopic(id)         a locus id from loci.json ("de-trinitate")
 *   MOArticles.forWork(slug)        a library work slug ("pld-2722")
 *   MOArticles.forAuthor(name)      the library's author name ("Augustine of Hippo"); accents, case and spacing do not matter
 *   MOArticles.forDoc(slug)         a creed, confession or council slug ("rc-061-heidelberg-catechism-1563")
 *   MOArticles.search(q, {kind, limit})   AND across the terms, prefix on the last. Title, keywords, byline, names and excerpt, and (once
 *                                   loadIndex() has answered) the full text of each essay through mo-articles-index.json. Adjacent words
 *                                   that the index holds as a phrase ("ten commandments", "rule of life") are matched as that phrase;
 *                                   "double quotes" force a phrase; the alias groups below make common names find each other.
 *   MOArticles.loadIndex()          Promise of the full-text index, fetched once under its own version. Search works without it, on the fields only.
 *   MOArticles.mentions(article, q) the terms of the query that matched only deep in the essay's text, for an "Also mentions" line
 *   MOArticles.kinds()              [{k, label, n}] in display order; n counts every essay that has the kind, so the counts overlap
 *   MOArticles.podcasts             the same API over the podcast episodes (mo-podcasts.json): the Passages, Mere Fidelity and Christians Reading
 *                                   Classics episodes that serve the library; a: show name, s: show key, u: the episode's page
 *   MOArticles.kindsOf(article)     the essay's kinds, primary first ([k] when it has only one)
 *   MOArticles.terms(q)             the folded words of a query, for highlighting
 *   MOArticles.image(article, w)   the featured image URL at width w (300, 600, 1000), or "" when there is none
 *   MOArticles.entities(article)    [{type, key, label}] the article serves, most specific first
 *
 * ALIASES (ALIASES below): each group is names for one thing, and a query term that is one of them also matches the others, as an OR group
 * inside the AND. Only the names listed are joined: "the law" is not an alias of the Ten Commandments, "election" is one of predestination.
 *
 * The index holds term counts and postings only (no positions, no sentences): single words (stemmed: possessives and plurals only, stopwords out),
 * and two- and three-word phrases found in two or more essays. Words in over 30% of the essays are listed, not indexed, and are left out of a
 * multi-word query rather than matching everything.
 *
 * Every lookup answers [] until the data is loaded. Lists come in the order the build set: about the subject first,
 * then newest. Articles are shared objects; do not change them.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MOArticles = api;
}(typeof window !== "undefined" ? window : globalThis, () => {
  "use strict";

  // The loader's own ?v= (Ghost stamps it with the theme hash, which changes on every deploy), read now while the script is running.
  const SELF_V = (() => {
    try { const m = /[?&]v=([a-z0-9]+)/i.exec((document.currentScript && document.currentScript.src) || ""); return m ? m[1] : ""; } catch (e) { return ""; }
  })();
  const DATA_PATH = "/assets/data/faith-received/mo-articles.json";
  const INDEX_PATH = "/assets/data/faith-received/mo-articles-index.json";
  const KINDS = [
    ["doc", "Creeds and confessions"],
    ["work", "Works and authors"],
    ["retrieval", "Theological retrieval"],
    ["topic", "Doctrine and Scripture"],
  ];

  // The tokenizer the full-text index is built with (scripts/prep-mo-articles-search.mjs requires this file) and the query is read with,
  // so a word is stemmed the same way on both sides. Possessives drop ('s, s'), plurals lose their s, and nothing else is stemmed.
  const STOP = new Set(("a about above across after again against all almost also although always am among an and another any are around as at away back be " +
    "because been before being between both but by can cannot could did do does doing done down during each either else even ever every few for from further get " +
    "gets got had has have having he her here hers herself him himself his how however i if in into is it its itself just know like made make makes many may me " +
    "might more most much must my myself never no nor not now of off often on once one only or other others our ours out over own per perhaps quite rather said " +
    "same say says see seems she should since so some such than that the their theirs them themselves then there these they this those though through thus to " +
    "too toward under until up upon us use used uses using very was way we well were what when where whether which while who whom whose why will with " +
    "within without would yet you your yours").split(/\s+/).filter(Boolean));
  const stem = (w) => {
    if (w.length > 4 && w.endsWith("ies")) return `${w.slice(0, -3)}y`;
    if (w.length > 4 && /(?:ss|ch|sh|x|z)es$/.test(w)) return w.slice(0, -2);
    if (w.length > 3 && w.endsWith("s") && !/(?:ss|us|is)$/.test(w)) return w.slice(0, -1);
    return w;
  };
  const fold0 = (s) => String(s == null ? "" : s).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  // Every token in order, stemmed, with stopwords kept as null so phrases can tell what was adjacent.
  const stream = (s) => (fold0(s).replace(/[\u2018\u2019]/g, "'").match(/[a-z0-9]+(?:'[a-z]+)?/g) || []).map((t) => {
    const w = stem(t.replace(/'.*$/, ""));
    return w.length < 3 || STOP.has(w) ? (w === "of" ? "of" : null) : w;
  });

  // Words in order, folded, possessives dropped, stopwords kept (a query needs to see "of" and the words around it).
  const wl = (s) => (fold0(s).replace(/[\u2018\u2019]/g, "'").match(/[a-z0-9]+(?:'[a-z]+)?/g) || []).map((t) => t.replace(/'.*$/, ""));
  const content = (w) => w.length >= 3 && !STOP.has(w);

  // Names for one thing. Written as a reader would, stemmed when read.
  const ALIASES = [
    ["ten commandments", "decalogue"],
    ["lord's supper", "eucharist", "communion"],
    ["apostles creed", "symbolum apostolorum"],
    ["nicene creed", "niceno constantinopolitan creed", "creed of nicaea"],
    ["athanasian creed", "quicunque vult"],
    ["nicaea", "nicea"],
    ["chalcedon", "chalcedonian"],
    ["trinity", "triune"],
    ["predestination", "election"],
    ["atonement", "propitiation"],
    ["baptism", "baptize", "baptized"],
  ];

  // Every kind an essay really has (ks, written when there is more than one); k is the primary, first in the list.
  const kindsOf = (a) => (a && a.ks && a.ks.length ? a.ks : [a && a.k]);

  const fold = (s) => String(s == null ? "" : s).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const words = (s) => fold(s).match(/[a-z0-9]+/g) || [];
  const terms = (q) => words(q);

  // Weights: title over keywords over the byline over the names of what it serves over the excerpt.
  const W = { title: 10, keyword: 6, byline: 5, entity: 4, excerpt: 1 };

  // A loader over one dataset. The default is the articles; MOArticles.podcasts is the same machine over mo-podcasts.json. opts: dataPath,
  // indexPath, dvKey and indexDvKey (the window globals the build's stamp file sets).
  function create(opts) {
    const o0 = opts || {};
    const dataPath = o0.dataPath || DATA_PATH;
    const indexPath = o0.indexPath || INDEX_PATH;
    const dvKey = o0.dvKey || "MO_ARTICLES_DV";
    const indexDvKey = o0.indexDvKey || "MO_ARTICLES_INDEX_DV";
    let data = null;
    let byId = new Map();
    let pending = null;
    const memo = new Map();

    const hit = (set, term, last) => {
      if (set.has(term)) return true;
      if (!last) return false;
      for (const w of set) if (w.startsWith(term)) return true;
      return false;
    };

    // Per-article folded fields (stemmed words), built the first time a search needs them.
    function fields(a) {
      let f = memo.get(a.id);
      if (f) return f;
      const lab = (data && data.lab) || {};
      const names = [];
      for (const s of a.authors || []) names.push(s);
      for (const s of a.works || []) names.push((lab.works || {})[s] || "");
      for (const s of a.docs || []) names.push((lab.docs || {})[s] || "");
      for (const s of a.topics || []) names.push((lab.topics || {})[s] || "");
      for (const s of a.n || []) names.push(s);
      const set = (list) => new Set(list.flatMap(wl).map(stem));
      f = {
        title: set([a.t]),
        keyword: set(a.w || []),
        byline: set([a.a]),
        entity: set(names),
        excerpt: set([a.x]),
        phrase: wl(a.t).map(stem).join(" "),
      };
      memo.set(a.id, f);
      return f;
    }

    function use(d) {
      if (!d || !Array.isArray(d.articles) || !d.idx) return null;
      data = d;
      byId = new Map(d.articles.map((a) => [a.id, a]));
      memo.clear();
      return d;
    }

    function load() {
      if (data) return Promise.resolve(data);
      if (!pending) {
        const path = dataPath;
        // The CDN keys data files on ?v= alone and keeps old copies under old keys, so the data's own version goes in v: the stamp
        // (mo-articles-dv.js, built with the data), else the theme hash this script was loaded under, else the site's hourly helper.
        const dv = typeof window !== "undefined" && window[dvKey];
        let url = path;
        if (dv) url = `${path}?v=${dv}`;
        else if (SELF_V) url = `${path}?v=${SELF_V}`;
        else if (typeof window !== "undefined" && window.moDataUrl) url = window.moDataUrl(path);
        pending = fetch(url, { credentials: "omit" })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d && typeof console !== "undefined") {
              if (d.imgBase && !d.articles.some((a) => a.i)) console.warn("MOArticles: the data names an image base but no article has one, so a stale copy was served.", url);
              if (dv && d.dv !== dv) console.warn("MOArticles: data version", d.dv, "is not the expected", dv, url);
            }
            return d;
          })
          .then(use)
          .catch(() => null)
          .then((d) => { if (!d) pending = null; return d; });
      }
      return pending;
    }

    const pick = (table, key) => {
      const list = data && data.idx[table] && data.idx[table][key];
      return list ? list.map((id) => byId.get(id)).filter(Boolean) : [];
    };
    const merge = (...lists) => {
      const seen = new Set();
      const out = [];
      for (const l of lists) for (const a of l) if (!seen.has(a.id)) { seen.add(a.id); out.push(a); }
      return out;
    };

    function forVerse(ref) {
      const m = /^([a-z0-9-]+)\.(\d{1,3})(?:\.(\d{1,3})(?:-(\d{1,3}))?)?$/.exec(fold(ref).trim());
      if (!m) return [];
      const chapter = `${m[1]}.${m[2]}`;
      if (!m[3]) return pick("verse", chapter);
      const from = Number(m[3]);
      const to = m[4] ? Number(m[4]) : from;
      const lists = [];
      for (let v = from; v <= Math.min(to, from + 175); v++) lists.push(pick("verse", `${chapter}.${v}`));
      // An essay on the whole chapter serves each of its verses; one on other verses of the chapter does not.
      const whole = pick("verse", chapter).filter((a) => (a.verses || []).includes(chapter));
      return merge(...lists, whole);
    }

    function forAuthor(name) {
      if (!data) return [];
      const direct = pick("author", name);
      if (direct.length) return direct;
      const f = fold(name).replace(/[^a-z0-9]+/g, "");
      if (!f) return [];
      const key = Object.keys(data.idx.author).find((k) => fold(k).replace(/[^a-z0-9]+/g, "") === f);
      return key ? pick("author", key) : [];
    }

    /* ── the full-text index ─────────────────────────────────────── */
    let index = null;
    let indexPending = null;
    let uniKeys = null;
    const decoded = new Map();
    const posOf = new Map();

    function useIndex(d) {
      if (!d || !d.t || !Array.isArray(d.ids)) return null;
      index = d;
      uniKeys = Object.keys(d.t).filter((k) => k.indexOf(" ") < 0);
      d.ids.forEach((id, i) => posOf.set(id, i));
      d.commonSet = new Set(d.common || []);
      decoded.clear();
      return d;
    }

    function loadIndex() {
      if (index) return Promise.resolve(index);
      if (!indexPending) {
        const path = indexPath;
        const dv = typeof window !== "undefined" && window[indexDvKey];
        let url = path;
        if (dv) url = `${path}?v=${dv}`;
        else if (SELF_V) url = `${path}?v=${SELF_V}`;
        else if (typeof window !== "undefined" && window.moDataUrl) url = window.moDataUrl(path);
        indexPending = fetch(url, { credentials: "omit" })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d && dv && d.dv !== dv && typeof console !== "undefined") console.warn("MOArticles: index version", d.dv, "is not the expected", dv, url);
            return d;
          })
          .then(useIndex)
          .catch(() => null)
          .then((d) => { if (!d) indexPending = null; return d; });
      }
      return indexPending;
    }

    // term -> Map(article position -> count), decoded once.
    function postings(term) {
      let m = decoded.get(term);
      if (m) return m;
      m = new Map();
      const raw = index && index.t[term];
      if (raw) {
        let pos = 0;
        for (const part of raw.split(",")) {
          const dot = part.indexOf(".");
          pos += parseInt(dot < 0 ? part : part.slice(0, dot), 36);
          m.set(pos, dot < 0 ? 1 : parseInt(part.slice(dot + 1), 36));
        }
      }
      decoded.set(term, m);
      return m;
    }
    // A word typed so far: every indexed word that starts with it, merged.
    function prefixPostings(term) {
      const key = `${term}*`;
      let m = decoded.get(key);
      if (m) return m;
      m = new Map();
      let n = 0;
      for (const k of uniKeys) {
        if (!k.startsWith(term)) continue;
        for (const [pos, c] of postings(k)) m.set(pos, (m.get(pos) || 0) + c);
        if (++n > 300) break;
      }
      decoded.set(key, m);
      return m;
    }

    /* ── reading a query ─────────────────────────────────────────── */
    const aliasOf = new Map();
    for (const g of ALIASES) for (const name of g) aliasOf.set(wl(name).map(stem).join(" "), g);

    // An alt is one way to say a thing: its stemmed words (and "of" where it joins them), what to show for it.
    const makeAlt = (ws, label, prefix) => {
      const stems = ws.map(stem);
      return { stems, words: stems.filter((w) => w !== "of"), key: stems.join(" "), label, prefix: Boolean(prefix) };
    };

    // Terms the query is made of: [{alts, common}], every one of which must match (AND), each satisfied by any of its alts (OR).
    function parse(q, endsOpen) {
      const items = [];
      const quoted = [];
      const plain = String(q || "").replace(/["“”]([^"“”]+)["“”]/g, (m, inner) => { quoted.push(wl(inner)); return " "; });
      for (const ws of quoted) {
        const cw = ws.filter(content);
        if (cw.length) items.push({ alts: [makeAlt(ws.filter((w) => content(w) || w === "of"), ws.join(" "), false)], phrase: true });
      }
      const ws = wl(plain);
      let i = 0;
      while (i < ws.length) {
        const w = ws[i];
        // alias group, longest window first
        let group = null;
        let len = 0;
        for (const n of [3, 2, 1]) {
          if (i + n > ws.length) continue;
          const g = aliasOf.get(ws.slice(i, i + n).map(stem).join(" "));
          if (g) { group = g; len = n; break; }
        }
        if (group && !(i + len === ws.length && endsOpen && len === 1 && false)) {
          items.push({ alts: group.map((name) => makeAlt(wl(name), name, false)) });
          i += len;
          continue;
        }
        if (!content(w)) { i++; continue; }
        // a phrase the index knows (three words, "X of Y", two words), else the word alone
        let took = 0;
        const known = (key) => index && index.t[key];
        const w2 = ws[i + 1];
        const w3 = ws[i + 2];
        const lastOpen = (end) => endsOpen && end === ws.length;
        if (w2 && content(w2) && w3 && content(w3) && known([w, w2, w3].map(stem).join(" "))) took = 3;
        else if (w2 === "of" && w3 && content(w3) && known([w, "of", w3].map(stem).join(" "))) took = 3;
        else if (w2 && content(w2) && known([w, w2].map(stem).join(" "))) took = 2;
        if (took) { items.push({ alts: [makeAlt(ws.slice(i, i + took), ws.slice(i, i + took).join(" "), lastOpen(i + took))] }); i += took; continue; }
        // two content words in a row that the index does not hold as a phrase: keep them as one AND item so they read as "ten commandments"
        items.push({ alts: [makeAlt([w], w, lastOpen(i + 1))] });
        i++;
      }
      return items;
    }

    // A query made only of short or common words still has to find something: the words themselves, on the fields.
    function fallbackItems(q, endsOpen) {
      const ws = wl(q).filter((w) => w);
      return ws.map((w, i) => ({ alts: [makeAlt([w], w, endsOpen && i === ws.length - 1)], fieldsOnly: true }));
    }

    const FIELD_W = { title: 10, keyword: 7, byline: 5, entity: 4, excerpt: 1 };

    // How one way of saying a thing matches one essay: { field, body } scores (0 when it does not).
    function altMatch(alt, a, f, pos) {
      let field = 0;
      const wordsHit = (set) => alt.words.every((w, i) => (alt.prefix && i === alt.words.length - 1 ? hit(set, w, true) : set.has(w)));
      for (const name of ["title", "keyword", "byline", "entity", "excerpt"]) {
        if (FIELD_W[name] > field && wordsHit(f[name])) field = FIELD_W[name];
      }
      if (field && alt.words.length > 1 && f.phrase.includes(alt.words.join(" "))) field += 3;
      let body = 0;
      if (index && pos !== undefined) {
        if (alt.words.length === 1) {
          const w = alt.words[0];
          const m = alt.prefix ? prefixPostings(w) : postings(w);
          const c = m.get(pos);
          if (c) body = 2 + Math.min(c, 10) * 0.15 + Math.min(1, Math.log(index.n / Math.max(1, m.size)) / Math.log(index.n));
        } else if (index.t[alt.key] !== undefined) {
          const c = postings(alt.key).get(pos);
          if (c) body = 5.5;
        } else {
          // not an indexed phrase (in one essay at most, or longer than three words): every word somewhere in the text
          let all = true;
          for (let i = 0; i < alt.words.length && all; i++) {
            const w = alt.words[i];
            const m = alt.prefix && i === alt.words.length - 1 ? prefixPostings(w) : postings(w);
            all = m.has(pos) || (index.commonSet.has(w));
          }
          if (all) body = 2;
        }
      }
      return { field, body };
    }

    function plan(q) {
      const text = String(q || "");
      const endsOpen = text.length > 0 && !/\s$/.test(text);
      let items = parse(text, endsOpen);
      const all = items.length;
      if (index) {
        // words in most essays say nothing about one of them: left out unless that leaves nothing
        const keepers = items.filter((it) => !(it.alts.length === 1 && it.alts[0].words.length === 1 && index.commonSet.has(it.alts[0].words[0]) && !it.alts[0].prefix));
        if (keepers.length) items = keepers;
      }
      if (!all) items = fallbackItems(text, endsOpen);
      return items;
    }

    function run(q, list) {
      const items = plan(q);
      if (!items.length) return list.slice();
      const scored = [];
      for (const a of list) {
        const f = fields(a);
        const pos = index ? posOf.get(a.id) : undefined;
        let total = 0;
        let ok = true;
        for (const it of items) {
          let best = 0;
          for (const alt of it.alts) {
            const m = altMatch(alt, a, f, it.fieldsOnly ? undefined : pos);
            const sc = Math.max(m.field, m.body);
            if (sc > best) best = sc;
          }
          if (!best) { ok = false; break; }
          total += best;
        }
        if (ok) scored.push([total, a]);
      }
      scored.sort((x, y) => y[0] - x[0] || (x[1].d < y[1].d ? 1 : x[1].d > y[1].d ? -1 : x[1].id < y[1].id ? -1 : 1));
      return scored.map((p) => p[1]);
    }

    function search(q, opts) {
      if (!data) return [];
      const o = opts || {};
      let list = data.articles;
      if (o.kind) list = list.filter((a) => kindsOf(a).includes(o.kind));
      let out;
      if (!wl(q).length) out = list.slice().sort((x, y) => (x.d < y.d ? 1 : x.d > y.d ? -1 : x.id < y.id ? -1 : 1));
      else out = run(q, list);
      return o.limit > 0 ? out.slice(0, o.limit) : out;
    }

    // What matched only deep in the text: for each term of the query, the way the reader said it (or the alias that matched) when no
    // visible field holds it. [] when the index is not loaded or every term shows in the title, byline, names or excerpt.
    function mentions(a, q) {
      if (!index || !a) return [];
      const f = fields(a);
      const pos = posOf.get(a.id);
      const out = [];
      for (const it of plan(q)) {
        if (it.fieldsOnly) continue;
        let shown = false;
        let via = "";
        for (const alt of it.alts) {
          const m = altMatch(alt, a, f, pos);
          if (m.field) { shown = true; break; }
          if (m.body && !via) via = alt.label;
        }
        if (!shown && via && !out.includes(via)) out.push(via);
      }
      return out;
    }

    function kinds() {
      const n = {};
      if (data) for (const a of data.articles) for (const k of kindsOf(a)) n[k] = (n[k] || 0) + 1;
      return KINDS.map(([k, label]) => ({ k, label, n: n[k] || 0 }));
    }

    // The featured image at a width Ghost serves (300, 600, 1000). A path is under data.imgBase; a full URL (Unsplash) takes ?w=.
    function image(a, w) {
      if (!a || !a.i) return "";
      if (/^https:/.test(a.i)) {
        if (!/images\.unsplash\.com/.test(a.i)) return a.i;
        try { const u = new URL(a.i); u.searchParams.set("w", String(w)); return u.toString(); } catch (e) { return a.i; }
      }
      return `${(data && data.imgBase) || ""}size/w${w}/${a.i}`;
    }

    function entities(a) {
      const lab = (data && data.lab) || {};
      const out = [];
      for (const s of a.docs || []) out.push({ type: "doc", key: s, label: (lab.docs || {})[s] || s });
      for (const s of a.works || []) out.push({ type: "work", key: s, label: (lab.works || {})[s] || s });
      for (const s of a.authors || []) out.push({ type: "author", key: s, label: s });
      for (const s of a.topics || []) out.push({ type: "topic", key: s, label: (lab.topics || {})[s] || s });
      for (const s of a.verses || []) out.push({ type: "verse", key: s, label: s });
      return out;
    }

    return {
      load, use, loadIndex, useIndex, mentions, search, kinds, entities, image, forVerse, forAuthor,
      forTopic: (id) => pick("topic", id),
      forWork: (slug) => pick("work", slug),
      forDoc: (slug) => pick("doc", slug),
      article: (id) => byId.get(id) || null,
      all: () => (data ? data.articles : []),
      terms, fold, stream, stem, ALIASES, kindsOf,
      create,
    };
  }

  const api = create();
  // The podcast episodes that serve the library: the same API over mo-podcasts.json (built by scripts/build-mo-podcasts.mjs).
  api.podcasts = create({ dataPath: "/assets/data/faith-received/mo-podcasts.json", indexPath: "/assets/data/faith-received/mo-podcasts-index.json", dvKey: "MO_PODCASTS_DV", indexDvKey: "MO_PODCASTS_INDEX_DV" });
  return api;
}));
