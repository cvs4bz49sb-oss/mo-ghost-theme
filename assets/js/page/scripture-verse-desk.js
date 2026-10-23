/* THE VERSE DESK, ONE MODULE FOR BOTH SITES (2026-10-22; owner: "do a whole design restructuring and graphics pass and ui and
 * collapsibility and organizational pass on verse deck"; "make sure its both mereo and tfr"). The Verse Desk of The Faith Received
 * (research_shell.html, #b/<book>/<c>?v=<v>&view=desk) and Mere Orthodoxy's (/the-faith-received/scripture/desk/?ref=<book>.<c>.<v>,
 * scripture-dev-desk.js) mount this one file, word for word on both, as they share scripture-verse-rail.js.
 *
 * On the desk, top to bottom:
 *   the verse   its reference, the verses before and after as quiet arrows, the text in the translation chosen (the picker inline),
 *               and small controls beside it: the verse in every translation, the source filter (where the host has one), Save verse,
 *               the chapter in the reader
 *   the band    who treats the verse, by tradition and century: one era strip (tradition-graphics.js) of every author who comments on,
 *               preaches on, cites or sets the verse, each once at his year, the landmark commentators named on it, the authors counted
 *               under each century; under it the kinds (commentaries, homilies and sermons, citations, hymns) as a bar of counts that
 *               filters what is shown
 *   the groups  folded lists, one open at a time: the landmark commentaries (the book's curated keys and the landmark sets on the whole
 *               Bible, in the commentary pane's order), the other commentaries by tradition in the order of the tradition's history,
 *               the homilies and sermons on the passage, the hymns, and the citations of the verse (their traditions as a bar; inside,
 *               by tradition again, a row a work). A row is one line (author, dates, work, page, Preview); opened, it shows the work's
 *               passage on the verse as a block quote, in English with the source a press away, and the ways on: beside the text, in
 *               the reader.
 *
 * WHERE THE PLACES COME FROM: the commentary pane's rules of 2026-10-22 (commentary-pane.js: the chapter's commentaries, the volume that
 * holds the verse, the page for a verse said for what it is, the note found on the page by its heading), read from the same files on the
 * host's data store (cfg.base): the chapter file, the commentary map, the overlay of collected notes, the reception history, the hits on
 * other books, the sermons and hymns on the book, the curated standing. Nothing is guessed: a page that does not carry the verse's note
 * says what it is. Standing, never counts, orders every list (rank.json).
 *
 * KEYS. In the lists, Up and Down move from row to row (a group's head is a row), Right opens, Left closes; the host keeps the open
 * group and row in the address (cfg.onState). */
(function (root) {
  "use strict";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => Number(n || 0).toLocaleString("en-US");
  const ord = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th")}`;
  const plural = (n, one, many) => `${fmt(n)} ${n === 1 ? one : many}`;
  const DOT = " · ";
  const foldText = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const cut = (s, n) => (s.length > n ? `${s.slice(0, n).replace(/\s+\S*$/, "")}…` : s);
  const reEsc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const reduced = () => !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);

  /* THE SHELVES, closed (the library's nine), in the order the owner reads them on the desk (10-22: "Greek Fathers, Latin Fathers,
   * Medieval, Reformed, Lutheran, Roman Catholic, English Divines"). A work takes the commentary pane's shelf: the map's, a Father in
   * Migne or the Patrologia Orientalis on his Patrologia's, a Latin writer from the 8th century on with the Medieval. */
  const TRADS = [["gf", "Greek Fathers"], ["pl", "Latin Fathers"], ["po", "Eastern Fathers"], ["md", "Medieval"], ["rf", "Continental Reformed"],
    ["lu", "Lutheran"], ["rc", "Roman Catholic"], ["ed", "English Divines"], ["hl", "Humanism and Law"], ["x", "Other"]];
  const TRAD_NAME = Object.fromEntries(TRADS);
  const tradAt = (k) => { const i = TRADS.findIndex(([x]) => x === k); return i < 0 ? TRADS.length : i; };
  const X_SHELF = { Reformed: "rf", "Continental Reformed": "rf", "Roman Catholic": "rc", Lutheran: "lu", Medieval: "md", "English Divines": "ed",
    "Humanism & Law": "hl", "Humanism and Law": "hl", "Greek Fathers": "gf", "Latin Fathers": "pl", "Eastern Fathers": "po" };
  const famShelf = (slug) => { const m = /^(pld|pg|po)-/.exec(slug || ""); return m ? { pld: "pl", pg: "gf", po: "po" }[m[1]] : ""; };
  const shelfOk = (k) => (TRAD_NAME[k] && k !== "x" ? k : "x");

  /* NAMES (scripture-verse-rail.js's rules, so a set and an author are one on both lists): the catalogue's title-first bylines turned
   * about, a guessed attribution read as "Bede (uncertain)"; a work's set is its author and its title or slug stem */
  const NAMES = { "collected by Thomas Aquinas The catena": "The catena, collected by Thomas Aquinas", "collected by Thomas Aquinas": "The catena, collected by Thomas Aquinas" };
  const properName = (a) => {
    const s = String(a || "").trim(); if (!s) return s;
    if (NAMES[s]) return NAMES[s];
    const m = /^((?:Arch)?bishop of [A-Z][\w\- ]+?)\s+([A-Z][\w-]+)$/.exec(s); if (m) return `${m[2]}, ${m[1]}`;
    return s.replace(/^Uncertain author\s*\((.+?)\??\)(?:;.*)?$/i, "$1 (uncertain)");
  };
  const authorKey = (a) => foldText(properName(a)).replace(/[^a-z0-9]+/g, " ").trim();
  const VOL_WORDS = /[\s.,:;(]*\b(?:vol(?:ume)?|tom(?:e|us)?|pars|part|band)\.?\s*[ivxlc\d]+\b.*$/i;
  const titleKey = (t) => foldText(t).replace(VOL_WORDS, "").replace(/[^a-z0-9]+/g, " ").trim();
  const ORDINALS = ["primus", "secundus", "tertius", "quartus", "quintus", "sextus", "septimus", "octavus", "nonus", "decimus", "undecimus", "duodecimus"];
  const VOL_SLUG = new RegExp(`-(?:(?:vol|tom|tomus|pars|part|band)-[a-z0-9]+(?:-.*)?|${ORDINALS.join("|")})$`);
  const stemOf = (slug) => (VOL_SLUG.test(slug) ? String(slug).replace(VOL_SLUG, "") : "");
  const workKey = (c) => `${authorKey(c.a) || c.slug}|${c.vol ? `p:${titleKey(c.t)}` : stemOf(c.slug) ? `s:${stemOf(c.slug)}` : `t:${titleKey(c.t)}`}`;
  // the name a landmark carries on the strip: "Augustine", "Chrysostom", "Glossa", "Critici Sacri" (the pane's key buttons)
  const SHORT = { "Augustine of Hippo": "Augustine", "John Chrysostom": "Chrysostom", "Walafrid Strabo": "Glossa", "Walahfrid Strabo": "Glossa",
    "Westminster Assembly": "Westminster Annotations", "Gregory I": "Gregory the Great", "Theophylact, Archbishop of Bulgaria": "Theophylact",
    "The critics, collected by John Pearson and others": "Critici Sacri", "Cornelius a Lapide": "Lapide", "collected by Thomas Aquinas": "Catena Aurea",
    "collected by Thomas Aquinas The catena": "Catena Aurea", "The catena, collected by Thomas Aquinas": "Catena Aurea", "Denys the Carthusian": "Denys",
    "Willem van Est": "Estius", "Willem Hessels van Est": "Estius", "Nicholas of Lyra": "Lyra", "Matthew Poole": "Poole" };
  const short = (a) => {
    if (SHORT[a]) return SHORT[a];
    // a body, a collection or an unnamed author is named whole ("Acts of the Council of Trent", "Various authors")
    if (/^(?:various|unknown|anonymous|acts|canons|decrees|council|the)\b/i.test(a || "")) return properName(a);
    if (/catena/i.test(a) && /aquinas/i.test(a)) return "Catena Aurea";
    if (/^(?:Arch)?bishop\b/i.test(a || "")) return String(a).trim().split(/\s+/).pop();
    const b = String(a || "").replace(/^Uncertain author\s*\(?/i, "").replace(/\)$/, "").replace(/\s+(?:of|the)\s+.*$/i, "").trim();
    const p = b.split(/\s+/);
    return /^[IVXL]+$/.test(p[p.length - 1]) ? b : p[p.length - 1];
  };

  // ── the data store: JSON gzipped or not (Blob serves the .json.gz bytes, Mere Orthodoxy's library worker serves them opened) ────────
  function store(base, site) {
    const cache = new Map();
    const once = (k, make) => {
      if (!cache.has(k)) { const p = Promise.resolve().then(make); p.catch(() => { if (cache.get(k) === p) cache.delete(k); }); cache.set(k, p); }
      return cache.get(k);
    };
    const load = (u) => fetch(u, { credentials: "omit" }).then(async (r) => {
      if (!r.ok) throw new Error(u);
      const buf = new Uint8Array(await r.arrayBuffer());
      const text = buf[0] === 0x1f && buf[1] === 0x8b
        ? await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).text()
        : new TextDecoder().decode(buf);
      return JSON.parse(text);
    });
    const json = (u) => once(`json:${u}`, () => load(u));
    const text = (u) => once(`text:${u}`, () => fetch(u, { credentials: "omit" }).then((r) => { if (!r.ok) throw new Error(u); return r.text(); }));
    return { base: String(base || "").replace(/\/$/, ""), site: site || "tfr", once, json, text };
  }

  // ── a commentary's pages (commentary-pane.js 10-22: a work's shards or TEI, Migne's columns, an EEBO book) ────────────────────────
  const CANON = /^(pld|pg|po)-(\d+)$/;
  const EEBO = /^eebo-(\d+)$/;
  const XML_NS = "http://www.w3.org/XML/1998/namespace";
  const SRC_NAME = { la: "Latin", lat: "Latin", grc: "Greek", el: "Greek", gr: "Greek", fr: "French", de: "German", nl: "Dutch", syr: "Syriac" };
  const langOf = (el) => {
    for (let x = el; x && x.nodeType === 1; x = x.parentElement) { const l = x.getAttributeNS(XML_NS, "lang") || x.getAttribute("xml:lang"); if (l) return l; }
    return "";
  };
  const stride = (slug) => (CANON.test(slug) ? 2 : 1);
  // a page or a column: only Migne's volumes are numbered by the column (as the rest of the site says it)
  const pgOf = (slug, p) => `${/^(pld|pg)-/.test(String(slug || "")) ? "col." : "p."} ${p}`;
  const paragraphs = (t) => String(t || "").replace(/\[\^[^\]]*\]/g, "").split(/\n+/).map((s) => s.trim()).filter(Boolean);
  const decodeEnt = (s) => String(s || "")
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  function pageReader(D) {
    const canonCols = (slug) => D.once(`canon:${slug}`, async () => {
      const [, fam, id] = CANON.exec(slug);
      const xml = await D.text(D.site === "mo" ? `${D.base}/v1/tei/${fam}/${id}.xml` : `${D.base}/tei/${fam}/${id}.xml`);
      const doc = new DOMParser().parseFromString(xml, "application/xml");
      const en = new Map(), src = new Map(), cols = [], langs = {};
      let cur = null;
      const top = doc.querySelector("body") || doc.querySelector("text") || doc.documentElement;
      for (const el of top.querySelectorAll("*")) {
        const tag = el.localName;
        if (tag === "milestone" || tag === "pb") {
          if (tag === "milestone" && el.getAttribute("unit") !== "column") continue;
          const raw = String(el.getAttribute("n") || "");
          if (fam === "pld" && tag === "milestone" && !raw.includes(":")) continue;
          const c = parseInt(raw.split(":").pop(), 10);
          if (c) { cur = c; if (!cols.includes(c)) cols.push(c); }
        } else if ((tag === "p" || tag === "head") && cur != null && !el.closest("note")) {
          const t = el.textContent.replace(/\s+/g, " ").trim(); if (!t) continue;
          const l = langOf(el), m = l === "en" ? en : src;
          if (l !== "en") langs[l] = (langs[l] || 0) + 1;
          if (!m.has(cur)) m.set(cur, []);
          m.get(cur).push(t);
        }
      }
      const lang = Object.entries(langs).sort((a, b) => b[1] - a[1])[0];
      return { en, la: src, cols, src: SRC_NAME[lang && lang[0]] || (fam === "pg" ? "Greek" : "Latin") };
    });
    const eeboBook = (slug) => D.once(`eebo:${slug}`, async () => {
      const data = await D.json(`${D.base}/eebo/${EEBO.exec(slug)[1]}.json.gz`);
      const out = [], pages = new Map();
      const walk = (nodes) => { for (const nd of nodes || []) { if (nd.html) out.push(nd.html); walk(nd.kids); } };
      walk(data && data.toc);
      const flat = out.join("\n")
        .replace(/<span class="pb" data-n="(\d+)"><\/span>/g, (m, n) => `\n${n}\n`)
        .replace(/<\/(?:p|h\d|div|li|blockquote|tr)>|<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "");
      let cur = "0";
      for (const line of decodeEnt(flat).split("\n")) {
        const mark = /^(\d+)$/.exec(line);
        if (mark) { cur = mark[1]; continue; }
        const t = line.replace(/\s+/g, " ").trim();
        if (t) { if (!pages.has(cur)) pages.set(cur, []); pages.get(cur).push(t); }
      }
      const nums = [...pages.keys()].map(Number).filter((n) => n > 0);
      return { pages, last: nums.length ? Math.max(...nums) : 0 };
    });
    const teiPages = (slug, meta) => D.once(`tei:${slug}`, async () => {
      const read = async (lane) => {
        const m = new Map();
        try {
          const doc = new DOMParser().parseFromString(await D.text(`${D.base}/v1/works/${slug}/tei.${lane}.xml?v=${meta.tei_v || ""}`), "application/xml");
          let cur = "0";
          const top = doc.querySelector("body") || doc.querySelector("text") || doc.documentElement;
          for (const el of top.querySelectorAll("*")) {
            const tag = el.localName;
            if (tag === "pb") cur = String(Number(el.getAttribute("n")) || el.getAttribute("n"));
            else if ((tag === "p" || tag === "head") && !el.closest("note")) { const t = el.textContent.replace(/\s+/g, " ").trim(); if (t) { if (!m.has(cur)) m.set(cur, []); m.get(cur).push(t); } }
          }
        } catch (_) { /* a lane the work does not have */ }
        return m;
      };
      const [en, la] = await Promise.all([read("en"), meta.en_only ? Promise.resolve(new Map()) : read("la")]);
      return { en, la };
    });
    // {p: {n, en, la} | null, last, src: the source language's name}
    async function page(slug, n) {
      if (CANON.test(slug)) {
        const d = await canonCols(slug);
        let at = Number(n);
        if (!d.cols.includes(at)) { const nx = d.cols.filter((x) => x > at).sort((a, b) => a - b)[0]; if (nx != null) at = nx; }
        const two = (m) => [at, at + 1].flatMap((c) => m.get(c) || []).join("\n");
        const p = { n: at, en: two(d.en), la: two(d.la) };
        return { p: p.en || p.la ? p : null, last: d.cols[d.cols.length - 1] || n, src: d.src };
      }
      if (EEBO.test(slug)) {
        const d = await eeboBook(slug);
        const lines = d.pages.get(String(n));
        return { p: lines && lines.length ? { n, en: lines.join("\n"), la: "" } : null, last: d.last, src: "" };
      }
      const meta = await D.json(`${D.base}/v1/works/${slug}/meta.json`);
      const last = meta.n_pages || (meta.shards && meta.shards.length && meta.shards[meta.shards.length - 1].to);
      const src = SRC_NAME[meta.src_lang] || "Latin";
      if (!(meta.shards || []).length && meta.has_tei) {
        const lanes = await teiPages(slug, meta);
        const p = { n, en: (lanes.en.get(String(n)) || []).join("\n"), la: (lanes.la.get(String(n)) || []).join("\n") };
        return { p: p.en || p.la ? p : null, last, src };
      }
      const shard = (meta.shards || []).find((s) => s.from <= n && n <= s.to);
      const d = shard ? await D.json(`${D.base}/v1/works/${slug}/${shard.file}`) : await D.json(`${D.base}/v1/works/${slug}/work.json`);
      const p = (d.pages || []).find((x) => Number(x.n) === Number(n));
      return { p: p || null, last, src };
    }
    return { page };
  }

  // ── the chapter's commentaries, sermons and hymns (commentary-pane.js commentaries(), init() and addSermons(), 10-22) ───────────────
  const KIND_W = { commentary: 1, sermons: 0.8, collected: 0.7 };
  const preachRow = (r) => ({ slug: r[0], p: r[1], t: r[2], tl: r[3] || "", a: r[4] || "", tr: r[5] || "", year: r[6] || null, v1: r[7] || null,
    v2: r[8] || null, theme: r[9] || "", ref: r[10] || "", first: r[11] || "", vul: r[12] === "v", fl: r[13] || null });
  // a sermon on the verse: its heading names the verse (never one in the Vulgate's count of a psalm)
  const serOn = (x, v) => !!(v && x.v1 && !x.vul && x.v1 <= v && v <= (x.v2 || x.v1));

  async function chapterModel(D, cfg) {
    const book = cfg.book.slug, ch = Number(cfg.ch);
    const [file, dev, ov, rec, rank, hitsD, pr, setsD] = await Promise.all([
      cfg.chapter ? Promise.resolve(cfg.chapter) : D.json(`${D.base}/v1/bible/all/${book}/${ch}.json.gz`).catch(() => null),
      cfg.devotion ? Promise.resolve(cfg.devotion) : D.json(`${D.base}/v1/devotion.json.gz`).catch(() => null),
      D.json(`${D.base}/v1/bible/commentary-overlay.json`).catch(() => null),
      D.json(`${D.base}/v1/reception/scripture/${book}/${ch}.json`).catch(() => null),
      D.json(`${D.base}/v1/scripture/rank.json`).catch(() => null),
      D.json(`${D.base}/v1/scripture/hits/${book}/${ch}.json`).catch(() => null),
      D.json(`${D.base}/v1/scripture/preach/${book}.json`).catch(() => null),
      D.json(`${D.base}/v1/scripture/sets.json`).catch(() => null)]);
    const RANK = { works: (rank && rank.works) || {}, authors: (rank && rank.authors) || {}, books: (rank && rank.books) || {} };
    // the whole-Bible sets (v1/scripture/sets.json, 10-23): one row a set, by tradition (owner: "each whole bible is grouped by tradition")
    const SETS = { list: (setsD && setsD.sets) || [], of: (setsD && setsD.of) || {}, trads: (setsD && setsD.trads) || [] };
    const M = { book, ch, name: cfg.book.name, file, rec, RANK, SETS, meta: {}, sigla: {}, heads: new Map(), years: new Map(), list: [], hymns: [], preach: pr, pages: pageReader(D), D };
    const impOf = (slug, a) => { const r = RANK.works[slug]; return r ? r[0] : (RANK.authors[a] || 0); };
    M.impOf = impOf;
    const weigh = (c) => {
      const kind = c.k === "sermons" && c.cov >= 5 ? 1 : (KIND_W[c.k] || (c.overlay ? 1 : 0.65));
      const cov = c.cov >= 5 ? 1 : c.cov >= 2 ? 0.92 : 0.86;
      c.wb = (RANK.works[c.slug] || [])[1] === 1 || !!c.overlay || !!SETS.of[c.slug] ? 1 : 0;
      c.score = impOf(c.slug, c.a) * kind * cov + ((c.own != null ? c.own : Object.keys(c.notes).length) ? 0.5 : 0);
      return c;
    };
    const by = new Map(), byline = {};
    const take = (slug, a, t) => { if (!by.has(slug)) by.set(slug, { slug, a: a || "", t: t || slug, notes: {}, open: null }); return by.get(slug); };
    for (const v of (file && file.verses) || []) {
      for (const r of v.rows || []) if (r.w && !M.meta[r.w]) M.meta[r.w] = { a: r.a || "", t: r.t || r.w, sh: r.sh || "" };
      for (const r of v.rows || []) if (r.how === "exegesis" && /note on this verse/i.test(r.g || "")) {
        const c = take(r.w, r.a, r.t); if (!(v.v in c.notes)) c.notes[v.v] = r.p;
        if (r.sh && r.sh !== "x") c.sh = c.sh || r.sh;
      }
    }
    for (const e of ((dev && dev.books && dev.books[book]) || [])) {
      const piece = (e.stc && e.stc[ch]) || e.st;
      const pieceL = (e.stc && e.stc[ch] ? e.stcl && e.stcl[ch] : e.stl) || "";
      M.meta[e.w] = { a: e.a || "", t: piece || e.t || e.w, tl: pieceL, sh: e.sh === "x" ? (X_SHELF[e.tr] || "x") : e.sh };
      if (e.a) byline[e.w] = e.a;
      if (ch < (e.c1 || 1) || ch > (e.c2 || 999)) continue;
      const c = take(e.w, e.a, e.t);
      if (piece) { c.t = piece; c.vol = e.t; if (pieceL) c.tl = pieceL; }
      c.sh = c.sh || (e.sh === "x" ? (X_SHELF[e.tr] || "x") : e.sh);
      c.k = c.k || e.k; c.cov = Math.max(c.cov || 0, Object.keys(e.an || {}).length || ((Number(e.c2) || 0) - (Number(e.c1) || 0) + 1));
      if (e.an && e.an[ch] != null) { c.open = e.an[ch]; if (e.an[String(ch + 1)] != null) c.close = e.an[String(ch + 1)]; }
      else if (e.sp != null && e.c1 > 0 && e.c2 >= e.c1 && (RANK.works[e.w] || [])[1] === 1 && c.bookAt == null) c.bookAt = e.sp;
    }
    for (const [slug, w] of Object.entries((ov && ov.works) || {})) if (w.sigla) M.sigla[slug] = w.sigla;
    const fromOverlay = [];
    for (const [slug, w] of Object.entries((ov && ov.works) || {})) {
      const x = w.books && w.books[book] && w.books[book][ch]; if (!x) continue;
      const fresh = !by.has(slug), c = take(slug, w.a, w.t); c.open = x.p; Object.assign(c.notes, x.v || {}); c.overlay = true;
      if (x.c) { c.collected = x.c; for (const v of Object.keys(x.c)) if (!(v in c.notes)) c.notes[v] = x.c[v][0][1]; }
      if (x.pv) c.pv = { ...(c.pv || {}), ...x.pv };
      fromOverlay.push({ c, fresh, label: String(w.vol || "").replace(/^[^:]*:\s*/, "") });
    }
    for (const c of by.values()) if (byline[c.slug]) { c.a = byline[c.slug]; M.meta[c.slug] = { ...(M.meta[c.slug] || {}), a: byline[c.slug] }; }
    // one volume of a set for the chapter where some of its volumes' labels name the book (Denys's Tom. XII, not XIV, for John 1)
    const named = new RegExp(`\\b${reEsc(book.replace(/-/g, " "))}\\b`, "i"), sets = new Map();
    for (const o of fromOverlay) { const k = workKey(o.c); if (!sets.has(k)) sets.set(k, []); sets.get(k).push(o); }
    for (const os of sets.values()) {
      const yes = os.filter((o) => o.label && named.test(o.label));
      if (os.length > 1 && yes.length && yes.length < os.length) for (const o of os) if (!yes.includes(o) && o.fresh) by.delete(o.c.slug);
    }
    // the verse notes the reception history knows, for every verse
    const own = new Map([...by.values()].map((c) => [c, new Set(Object.keys(c.notes))]));
    for (const [v, x] of Object.entries((rec && rec.verses) || {})) {
      for (const [slug, p] of Object.entries(x.notes || {})) { const c = by.get(slug); if (c && !(v in c.notes)) c.notes[v] = p; }
    }
    // a note out of its chapter's pages is a mis-keyed row, dropped; unless most of them lie out together (the map's page is wrong)
    for (const c of by.values()) {
      const lo = Number(c.open), hi = Number(c.close);
      if (lo > 0 && hi > lo) {
        const out = Object.entries(c.notes).filter(([, p]) => { const n = Number(p); return n && (n < lo - 2 || n > hi + 2); });
        if (out.length >= 3 && out.length > Object.keys(c.notes).length - out.length) {
          const ps = out.map(([, p]) => Number(p)).sort((a, b) => a - b), mid = Math.floor(ps.length / 2);
          let i = mid, j = mid;
          while (i > 0 && ps[i] - ps[i - 1] <= 6) i -= 1;
          while (j < ps.length - 1 && ps[j + 1] - ps[j] <= 6) j += 1;
          c.open = ps[i]; c.close = ps[j] + 1; c.mapOff = true;
        } else for (const [v] of out) delete c.notes[v];
      }
      c.own = [...own.get(c)].filter((v) => v in c.notes).length;
      weigh(c);
      if (c.k === "sermons" && !(c.cov >= 5) && c.wb === 0) c.kd = "sermons";
    }
    if (typeof cfg.title === "function") for (const c of by.values()) {
      const full = cfg.title(c.slug), t = String(c.t || "").replace(/…$/, "").trim();
      if (!c.vol && full && t && full.length > t.length && full.startsWith(t)) c.t = full;
    }
    const list = [...by.values()].filter((c) => Object.keys(c.notes).length || c.open != null || c.bookAt != null)
      .sort((x, y) => x.wb - y.wb || y.score - x.score || ((RANK.works[x.slug] || [])[2] || 99) - ((RANK.works[y.slug] || [])[2] || 99) || x.a.localeCompare(y.a));
    // the works on other books that cite the chapter (wb 2), and those the map files under the book that treat it on their page
    const have = new Set(list.map((c) => c.slug));
    for (const x of (hitsD && hitsD.hits) || []) {
      if (have.has(x.w)) continue;
      const treats = !!(x.own && x.treats);
      list.push({ slug: x.w, a: x.a || "", t: x.t || x.w, notes: {}, open: x.p, hit: { v: x.v || [], n: x.n, g: x.g }, sh: x.sh,
        wb: treats ? ((RANK.works[x.w] || [])[1] === 1 ? 1 : 0) : 2, treats, score: 0 });
    }
    const citing = new Map(list.filter((y) => y.wb === 2 || y.treats).map((y) => [y.slug, y]));
    for (const [v, x] of Object.entries((rec && rec.verses) || {})) for (const [slug, p] of Object.entries(x.notes || {})) {
      const c = citing.get(slug); if (c && !(v in c.notes)) c.notes[v] = p;
    }
    // the sermons and homilies whose headings name the chapter; the hymns
    const pc = (pr && pr.chapters && pr.chapters[String(ch)]) || {};
    const works = (pr && pr.works) || {}, bySlug = new Map(list.map((c) => [c.slug, c])), of = new Map();
    for (const r of pc.s || []) { const x = preachRow(r); if (!of.has(x.slug)) of.set(x.slug, []); of.get(x.slug).push(x); }
    for (const [slug, xs] of of) {
      let c = bySlug.get(slug);
      if (c && c.wb === 2) { c.wb = 0; c.kd = "sermons"; }
      if (!c) {
        const [t] = String(works[slug] || "").split(" · "), m = M.meta[slug] || {};
        c = { slug, a: m.a || xs[0].a, t: t || m.t || slug, notes: {}, open: null, sh: X_SHELF[xs[0].tr] || famShelf(slug) || "x", wb: 0, score: 0,
          kd: "sermons", born: xs[0].fl || xs[0].year || null };
        list.push(c); bySlug.set(slug, c);
      }
      c.ser = xs;
    }
    M.hymns = (pc.h || []).map(preachRow);
    M.hymnBook = (pr && pr.hb) || "";
    M.list = list;
    // the years the reception history dates its authors by (their floruit), for an author the key of names cannot date
    for (const x of Object.values((rec && rec.verses) || {})) for (const e of x.eras || []) for (const r of e.top || []) {
      const k = authorKey(r.a); if (k && r.y && !M.years.has(k)) M.years.set(k, { y: Number(r.y), d: r.d || "" });
    }
    landmarks(M);
    return M;
  }

  // ── standing, shelf and year ────────────────────────────────────────────────────────────────────────────────────────────────────
  // the shelf a source filter reads (the map's, a Father in Migne on his Patrologia's), and the tradition a list files it under
  const rawShelf = (c) => (c.sh && c.sh !== "x" ? c.sh : famShelf(c.slug) || c.sh || "x");
  const tradOf = (M, c) => {
    let sh = c.sh || "";
    if (!sh || sh === "x") sh = famShelf(c.slug) || sh;
    const cen = (M.RANK.works[c.slug] || [])[2] || 0;
    return shelfOk(sh === "pl" && cen >= 8 ? "md" : sh);
  };
  const TG = () => root.FRTraditionGraphics || null;
  const dateRec = (a) => { const G = TG(); return (G && G.dates && G.dates.get(a)) || null; };
  // the year of an author: the key of names (his birth, else floruit, else death), else the curated key's, else the reception history's
  const yearOf = (M, a, c) => {
    const d = dateRec(a); if (d && Number(d.y) > 0) return Number(d.y);
    if (c && c.born) return Number(c.born);
    const r = M.years.get(authorKey(a)); if (r && r.y) return r.y;
    const cen = c ? (M.RANK.works[c.slug] || [])[2] || 0 : 0;
    return cen ? cen * 100 - 50 : 0;
  };
  const datesOf = (M, a) => { const d = dateRec(a); if (d && d.dates) return d.dates; const r = M.years.get(authorKey(a)); return (r && r.d) || ""; };
  const rankOf = (M, c) => -M.impOf(c.slug, c.a);

  /* THE LANDMARKS (commentary-pane.js fillList, 10-22): the book's curated key commentaries (rank.json `books`, at most ten, in the
   * order their authors wrote), then the landmark sets on the whole Bible in their curated order (at most six), one an author */
  function landmarks(M) {
    const keys = [];
    for (const [, slugs, born] of (M.RANK.books[M.book] || [])) {
      const have = slugs.map((s) => M.list.find((c) => c.slug === s)).filter(Boolean);
      const c = have.find((x) => x.open != null) || have.find((x) => Object.keys(x.notes).length) || have[0];
      if (c) { c.born = born; keys.push(c); }
    }
    const when = (c) => c.born || yearOf(M, c.a, c) || 9999;
    const onBook = M.list.filter((c) => c.wb === 0 && c.kd !== "sermons"), whole = M.list.filter((c) => c.wb === 1 && c.kd !== "sermons");
    const firstsOf = (xs) => { const seen = new Set(), out = []; for (const c of xs.slice().sort((x, y) => y.score - x.score)) { const k = authorKey(c.a) || c.slug; if (!seen.has(k)) { seen.add(k); out.push(c); } } return out; };
    const tierOf = (c) => (M.RANK.works[c.slug] || [])[4] || 0;
    const firsts = firstsOf(onBook);
    const bookKeys = (keys.length ? keys.slice(0, 10) : firsts.filter((c) => tierOf(c)).sort((x, y) => tierOf(x) - tierOf(y) || y.score - x.score).slice(0, 5))
      .sort((x, y) => when(x) - when(y) || y.score - x.score);
    const seenA = new Set(), seenL = new Set();
    const keep = (c) => { const k = authorKey(c.a) || c.slug, l = short(c.a); if (seenA.has(k) || seenL.has(l)) return false; seenA.add(k); seenL.add(l); return true; };
    M.head = (bookKeys.length ? bookKeys : firsts.slice(0, 4)).filter(keep);
    M.tail = M.SETS && M.SETS.list.length ? [] : firstsOf(whole).filter(keep).slice(0, 6);
    M.keyOrder = (M.RANK.books[M.book] || []).flatMap(([, slugs]) => slugs || []);
  }

  // ── the place for a verse, said for what it is (commentary-pane.js targetOf, sermonAt, volumeFor, headPage, locate, 10-22) ───────────
  function sermonAt(c, v) {
    const xs = c.ser || []; if (!xs.length) return null;
    if (c.kd !== "sermons" && (c.notes[v] != null || (c.collected && c.collected[v]))) return null;
    const span = (x) => (x.v2 || x.v1) - x.v1;
    const on = xs.filter((x) => serOn(x, v)).sort((a, b) => span(a) - span(b) || a.p - b.p)[0];
    if (on) return { p: on.p, how: "sermon", v, x: on };
    if (c.kd !== "sermons" || c.notes[v] != null) return null;
    const before = xs.filter((x) => x.v1 && !x.vul && x.v1 < v).sort((a, b) => b.v1 - a.v1 || a.p - b.p)[0];
    const x = before || xs.slice().sort((a, b) => (a.v1 || 0) - (b.v1 || 0) || a.p - b.p)[0];
    return { p: x.p, how: "sermon-ch", x };
  }
  function targetOf(M, c, v) {
    if (!c) return null;
    const sp = sermonAt(c, v); if (sp) return sp;
    if (c.collected) {
      if (c.collected[v]) return { p: c.collected[v][0][1], how: "collected", v, items: c.collected[v] };
      const prev = Object.keys(c.collected).map(Number).filter((x) => x < v).sort((a, b) => b - a)[0];
      if (prev != null) return { p: c.collected[prev][0][1], how: "collected", v: prev, items: c.collected[prev], nearest: true };
    }
    if (c.notes[v] != null) return { p: c.notes[v], how: "note", v };
    const before = Object.keys(c.notes).map(Number).filter((x) => x < v).sort((a, b) => b - a)[0];
    if (before != null) return { p: c.notes[before], how: "nearest", v: before };
    if (c.open != null) return { p: c.open, how: c.wb === 2 ? "cites" : c.treats ? "treats" : "chapter" };
    const first = Object.keys(c.notes).map(Number).sort((a, b) => a - b)[0];
    if (first != null) return { p: c.notes[first], how: "later", v: first };
    if (c.bookAt == null) return null;
    const h = M.heads.get(`${c.slug}|${M.book}|${M.ch}`);
    return h ? { p: h, how: "head" } : { p: c.bookAt, how: "book" };
  }
  const holds = (c, v) => {
    if ((c.collected && c.collected[v]) || c.notes[v] != null || (c.ser || []).some((x) => serOn(x, v))) return [2, 0];
    const before = Object.keys(c.notes).map(Number).filter((x) => x < v);
    return before.length ? [1, v - Math.max(...before)] : [0, 0];
  };
  function volumeFor(M, c, v) {
    if (!c || c.wb === 2 || !v) return c;
    const k = workKey(c);
    let best = c, [bt, bd] = holds(c, v);
    for (const x of M.list) {
      if (x === best || x.wb === 2 || workKey(x) !== k) continue;
      const [t, d] = holds(x, v);
      if (t > bt || (t === 1 && bt === 1 && d < bd)) { best = x; bt = t; bd = d; }
    }
    return best;
  }
  const ROMAN = (n) => { let x = Number(n), s = ""; for (const [v, r] of [[100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]]) while (x >= v) { s += r; x -= v; } return s; };
  const romans = (n) => { const r = ROMAN(n), old = r.replace(/IV/g, "IIII").replace(/IX/g, "VIIII"); return old === r ? [r] : [r, old]; };
  const HEAD_WORD = (book) => (book === "psalms" ? "psal(?:m(?:e|us|i)?)?" : "(?:chap(?:ter|itre)?|cap(?:ut|itulum)?|kap(?:itel)?)");
  const headRx = (ch, book) => new RegExp(`^(?:#{1,6}\\s+)?${HEAD_WORD(book)}\\.?\\s+(?:${[String(Number(ch)), ...romans(ch)].join("|")})\\.?\\s*$`, "i");
  const anyHead = (book) => new RegExp(`^(?:#{1,6}\\s+)?${HEAD_WORD(book)}\\.?\\s+([IVXLC]+|\\d+)\\.?\\s*$`, "i");
  const headNum = (s, book) => {
    const m = anyHead(book).exec(s); if (!m) return 0;
    if (/^\d+$/.test(m[1])) return Number(m[1]);
    const val = { I: 1, V: 5, X: 10, L: 50, C: 100 }, u = m[1].toUpperCase();
    let n = 0; for (let i = 0; i < u.length; i += 1) n += val[u[i]] < (val[u[i + 1]] || 0) ? -val[u[i]] : val[u[i]];
    return n;
  };
  function headPage(M, c) {
    const k = `${c.slug}|${M.book}|${M.ch}`;
    if (M.heads.has(k)) return Promise.resolve(M.heads.get(k));
    const rx = headRx(M.ch, M.book);
    return (async () => {
      let last = 0;
      for (let n = Number(c.bookAt), end = Number(c.bookAt) + 400; n <= end; n += stride(c.slug)) {
        const g = await M.pages.page(c.slug, n).catch(() => null);
        if (!g || (g.last && n > g.last)) break;
        for (const s of paragraphs(g.p && (g.p.en || g.p.la))) {
          if (rx.test(s)) { M.heads.set(k, n); return n; }
          const h = headNum(s, M.book);
          if (h) { if (h + 1 < last) { M.heads.set(k, null); return null; } last = Math.max(last, h); }
        }
      }
      M.heads.set(k, null);
      return null;
    })();
  }
  const noteRx = (v) => new RegExp(`^(?:ver(?:s(?:e|us)?)?\\.?\\s*|v\\.\\s*)?\\(?${v}\\b\\s*[.:,)\\]]`, "i");
  const anyNote = /^(?:ver(?:s(?:e|us)?)?\.?\s*|v\.\s*)?\(?\d{1,3}\b\s*[.:,)\]]/i;
  const strongRx = (v) => new RegExp(`^(?:ver(?:s(?:e|us)?)?\\.?\\s*|v\\.\\s*)\\(?${v}\\b\\s*[.:,)\\]]`, "i");
  const foldHead = (s) => String(s || "").replace(/^#{1,6}\s+/, "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const DIV = "sermo|sermon|homilia|homily|homilie|tractatus|tractate|concio|contio|oratio|oration|discourse|lectio|lecture|predigt|ode|hymnus|hymn";
  function headingAt(all, x) {
    const keys = [x && x.tl, x && x.t].map((s) => foldHead(s).slice(0, 16)).filter((k) => k.length >= 6);
    let i = keys.length ? all.findIndex((s) => { const f = foldHead(s); return keys.some((k) => f.startsWith(k)); }) : -1;
    if (i >= 0) return i;
    const m = new RegExp(`^\\W*(?:${DIV})\\.?\\s+([IVXLCDM]+|\\d+)\\b`, "i").exec(String((x && (x.tl || x.t)) || ""));
    if (!m) return -1;
    const rx = new RegExp(`^(?:#{1,6}\\s+)?\\W*(?:${DIV})\\.?\\s+${m[1]}\\b`, "i");
    i = all.findIndex((s) => rx.test(s));
    return i;
  }
  function locate(M, all, c, t, v) {
    const printed = (x) => (c && c.pv && c.pv[x]) || x;
    const out = { hit: -1, found: false, head: -1 };
    if (t.how === "collected" || t.how === "cites" || t.how === "treats") return out;
    if (t.how === "sermon" || t.how === "sermon-ch") { out.hit = headingAt(all, t.x); return out; }
    const hx = headRx(M.ch, M.book);
    out.head = all.findIndex((s) => hx.test(s));
    const lo = out.head + 1;
    let hi = all.length;
    for (let i = lo; i < all.length; i += 1) if (headNum(all[i], M.book)) { hi = i; break; }
    const find = (x) => {
      const sx = strongRx(printed(x)), bx = noteRx(printed(x));
      for (let i = lo; i < hi; i += 1) if (sx.test(all[i])) return i;
      for (let i = lo; i < hi; i += 1) if (bx.test(all[i])) return i;
      return -1;
    };
    if (t.how === "note" || t.how === "nearest" || t.how === "later") out.hit = find(t.v);
    if (t.how === "note") return out;
    const from = t.how === "nearest" && out.hit >= 0 ? out.hit + 1 : out.head >= 0 ? lo : -1;
    if (from < 0) return out;
    const sx = strongRx(printed(v));
    for (let i = from; i < hi; i += 1) if (sx.test(all[i])) { out.hit = i; out.found = true; break; }
    return out;
  }
  const clip = (s, n) => { const t = String(s || "").replace(/[.\s]+$/, ""); return t.length > n ? `${t.slice(0, n).replace(/[\s,;:]+\S*$/, "")}…` : t; };
  const refName = (M) => (M.book === "psalms" ? "Psalm" : M.name);
  function placeSay(M, t, v, at, loc) {
    const name = refName(M), ref = (x) => `${name} ${M.ch}:${x}`, none = `no note on verse ${v} recorded`;
    if (t.how === "sermon") return `${clip(t.x.t, 120)}, ${at}`;
    if (t.how === "sermon-ch") return `${clip(t.x.t, 110)}, on ${t.x.vul ? `${t.x.ref}, the Vulgate's count` : t.x.ref || `${name} ${M.ch}`}, ${at} (no sermon on verse ${v} recorded)`;
    if (loc.found) return `Its note on ${ref(v)}, ${at}, found on the page`;
    if (t.how === "note") return `Its note on ${ref(t.v)}, ${at}`;
    if (t.how === "nearest") return `Opens at its note on ${ref(t.v)}, ${at} (${none})`;
    if (t.how === "later") return `Opens at its first note in ${name} ${M.ch}, on ${M.ch}:${t.v}, ${at} (${none})`;
    if (t.how === "chapter") return `Opens at ${name} ${M.ch}, ${at} (${none})`;
    if (t.how === "cites") return `Cites ${name} ${M.ch} on ${at}, in its commentary on another passage (${none})`;
    if (t.how === "treats") return `Treats this chapter on ${at} (${none})`;
    if (t.how === "head") return `Opens at ${name} ${M.ch}, ${at}, found by its heading (${none})`;
    if (t.how === "book") return `Opens at the start of ${M.book === "psalms" ? "the Psalms" : name}, ${at}: chapter ${M.ch} is not mapped`;
    return `${at[0].toUpperCase()}${at.slice(1)}`;
  }
  const critSay = (M, t, v, at) => {
    const crit = new Set(t.items.map((x) => x[0])).size, them = `${crit} ${crit === 1 ? "critic" : "critics"} on ${refName(M)} ${M.ch}:${t.v}, ${at}`;
    return t.nearest ? `Opens at ${them} (no critic on verse ${v} recorded)` : `${them[0].toUpperCase()}${them.slice(1)}`;
  };

  /* THE PASSAGE ON THE VERSE (commentary-pane.js preview(), 10-22), in both of the page's languages: the work's note on the verse (else
   * where its chapter opens, said so), the note and the paragraphs that carry it on, about 900 characters; a collection (the Critici
   * Sacri) gives its critics on the verse. {slug, page, at, where, en: [{t, head, hit, who}], src: [...], srcName} */
  async function passage(M, c0, v) {
    const c = volumeFor(M, c0, v);
    if (!c) return null;
    let t = targetOf(M, c, v);
    if (t && t.how === "book") { await headPage(M, c); t = targetOf(M, c, v); }
    const { slug } = c;
    if (!t) return { slug, none: `Nothing in it is indexed on ${refName(M)} ${M.ch}.` };
    if (t.how === "collected") {
      const items = t.items.slice(0, 8), ns = [...new Set(items.map((x) => Number(x[1])))];
      const got = await Promise.all(ns.map((n) => M.pages.page(slug, n).catch(() => null)));
      const byPage = Object.fromEntries(ns.map((n, i) => [n, got[i] && got[i].p]));
      const notes = (lane) => items.map(([who, pn, k, pv]) => {
        const p = byPage[pn]; if (!p) return null;
        const rx = noteRx(pv || t.v);
        const pick = (ln) => paragraphs(p[ln]).filter((x) => rx.test(x))[k] || paragraphs(p[ln]).filter((x) => rx.test(x))[0];
        const note = (pick(lane) || "").replace(/^#{1,6}\s+/, "");
        return note ? { who, t: cut(note, 520) } : null;
      }).filter(Boolean);
      const at = pgOf(slug, t.items[0][1]), en = notes("en"), src = notes("la");
      return { slug, page: t.items[0][1], at, where: critSay(M, t, v, at), en: en.length ? en : null, src: src.length ? src : null,
        srcName: ((got.find(Boolean) || {}).src) || "Latin", none: en.length || src.length ? "" : "The notes could not be found on their page." };
    }
    const [a, b] = await Promise.all([M.pages.page(slug, Number(t.p)).catch(() => null), M.pages.page(slug, Number(t.p) + stride(slug)).catch(() => null)]);
    const pages = [a && a.p, b && b.p].filter(Boolean);
    const srcName = (a && a.src) || (b && b.src) || "Latin";
    if (!pages.length) return { slug, page: t.p, at: pgOf(slug, t.p), where: placeSay(M, t, v, pgOf(slug, t.p), { hit: -1, found: false, head: -1 }), none: "This page could not be opened here." };
    const lane = (ln) => {
      const all = [], onPage = [];
      pages.forEach((p) => paragraphs(p[ln]).forEach((s) => { all.push(s); onPage.push(p.n); }));
      if (!all.length) return null;
      const loc = locate(M, all, c, t, v), from = loc.hit >= 0 ? loc.hit : Math.max(0, loc.head);
      const out = []; let len = 0;
      for (let i = from; i < all.length && len < 900; i += 1) {
        const s = all[i];
        if (i > from && loc.hit >= 0 && anyNote.test(s)) break;
        const head = /^#{1,6}\s+/.test(s), txt = head ? s.replace(/^#{1,6}\s+/, "") : s;
        out.push({ t: cut(txt, Math.max(160, 900 - len)), head, hit: i === loc.hit });
        len += txt.length;
      }
      const hitPage = loc.found ? onPage[loc.hit] : t.p;
      return { paras: out, loc, hitPage };
    };
    const en = lane("en"), src = lane("la"), lead = en || src;
    if (!lead) return { slug, page: t.p, at: pgOf(slug, t.p), where: placeSay(M, t, v, pgOf(slug, t.p), { hit: -1, found: false, head: -1 }), none: "A blank page." };
    const at = pgOf(slug, lead.hitPage);
    return { slug, page: lead.hitPage, at, where: placeSay(M, t, v, at, lead.loc), en: en && en.paras, src: src && src.paras, srcName, how: t.how };
  }

  // ── the verse's lists ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
  /* One row a work: the volumes of a set fold under one entry (scripture-verse-rail.js workKey), the volume that holds the verse leading
   * (its note on it, else the nearest note before, then the chapter's page). keep(): the host's source filter. */
  function verseModel(M, v, keep) {
    const shelfOf = (c) => tradOf(M, c);
    const ok = (c) => keep({ sh: rawShelf(c), w: c.slug, a: c.a });
    const backTo = (c) => { if (c.notes && Object.prototype.hasOwnProperty.call(c.notes, String(v))) return 0; const ks = Object.keys(c.notes || {}).map(Number).filter((x) => x > 0 && x < v); return ks.length ? v - Math.max(...ks) : Infinity; };
    const by = new Map();
    for (const c of M.list) {
      if (!ok(c)) continue;
      // a work on another book that cites the chapter is listed with the citations, unless the book's curated keys name it
      const kd = c.wb === 2 ? "cited" : c.kd === "sermons" ? "sermons" : "comm", k = kd === "cited" ? `${c.slug}|cited` : `${workKey(c)}|${kd}`;
      if (!by.has(k)) by.set(k, { key: k, kind: kd, vols: [] });
      by.get(k).vols.push(c);
    }
    const has = (c) => (Object.keys(c.notes || {}).length ? 1 : 0);
    const works = [...by.values()];
    for (const w of works) {
      w.vols.sort((p, q) => backTo(p) - backTo(q) || (q.open != null ? 1 : 0) - (p.open != null ? 1 : 0) || has(q) - has(p) || (q.score || 0) - (p.score || 0));
      w.main = volumeFor(M, w.vols[0], v);
      w.id = w.main.slug;
      w.trad = shelfOf(w.main);
      w.rank = Math.min(...w.vols.map((c) => rankOf(M, c)));
      w.year = yearOf(M, w.main.a, w.main);
      w.onV = w.vols.some((c) => (c.notes && c.notes[v] != null) || (c.ser || []).some((x) => serOn(x, v)));
    }
    const ofSlug = new Map();
    for (const w of works) for (const c of w.vols) ofSlug.set(c.slug, w);
    // THE WHOLE-BIBLE SETS (10-23): a set's volumes, whatever their titles (Trapp's five commentaries, Lapide's twenty-one volumes), one
    // row, the volume that holds the verse leading; by tradition in the registry's order, each by its author's year
    const SO = (M.SETS && M.SETS.of) || {}, setVols = new Map();
    for (const w of works) if (w.kind === "comm") for (const c of w.vols) { const id = SO[c.slug]; if (id) { if (!setVols.has(id)) setVols.set(id, []); setVols.get(id).push(c); } }
    const inSet = new Set();
    const whole = ((M.SETS && M.SETS.trads) || []).map(([k, name]) => ({ k, name, works: (M.SETS.list || []).filter((s) => s.trad === k && setVols.has(s.id)).sort((p, q) => p.year - q.year).map((s) => {
      const vols = setVols.get(s.id).slice().sort((p, q) => backTo(p) - backTo(q) || (q.open != null ? 1 : 0) - (p.open != null ? 1 : 0) || has(q) - has(p));
      for (const c of vols) inSet.add(c.slug);
      const main = volumeFor(M, vols[0], v);
      return { key: `set:${s.id}`, kind: "comm", vols, main, id: main.slug, set: s, trad: k, whole: true, year: s.year || yearOf(M, main.a, main),
        rank: Math.min(...vols.map((c) => rankOf(M, c))), onV: vols.some((c) => c.notes && c.notes[v] != null) };
    }) })).filter((g) => g.works.length);
    // the landmarks first, in the pane's order: the book's keys, then the sets on the whole Bible
    // (a curated key is a landmark whatever else it is, a series of homilies included, as the pane's key strip has it)
    const landmark = [], seen = new Set();
    for (const c of [...(M.head || []), ...(M.tail || [])]) { const w = ofSlug.get(c.slug); if (w && !seen.has(w)) { seen.add(w); w.whole = c.wb === 1; landmark.push(w); } }
    const rest = works.filter((w) => w.kind === "comm" && !seen.has(w) && !(whole.length && w.vols.every((c) => inSet.has(c.slug))));
    const trads = TRADS.map(([k, name]) => ({ k, name, works: rest.filter((w) => w.trad === k).sort((p, q) => p.rank - q.rank || p.year - q.year || String(p.main.a).localeCompare(String(q.main.a))) }))
      .filter((g) => g.works.length);
    // the homilies and sermons on the passage: one row a sermon, those on the verse first, then by their years, then standing
    const sermons = [];
    for (const w of works) if (w.kind === "sermons" && !seen.has(w)) for (const x of w.main.ser || []) sermons.push({ w, x, on: serOn(x, v) });
    for (const w of works) if (w.kind === "sermons" && !seen.has(w)) for (const c of w.vols) if (c !== w.main) for (const x of c.ser || []) sermons.push({ w, x, c, on: serOn(x, v) });
    sermons.sort((p, q) => (q.on ? 1 : 0) - (p.on ? 1 : 0) || (Number(p.x.fl || p.x.year) || p.w.year || 9999) - (Number(q.x.fl || q.x.year) || q.w.year || 9999) || p.w.rank - q.w.rank || Number(p.x.p) - Number(q.x.p));
    const hymns = M.hymns.filter((x) => keep({ sh: X_SHELF[x.tr] || famShelf(x.slug) || "x", w: x.slug, a: x.a }))
      .slice().sort((p, q) => (serOn(q, v) ? 1 : 0) - (serOn(p, v) ? 1 : 0) || (p.year || 9999) - (q.year || 9999) || String(p.a).localeCompare(String(q.a)));
    return { landmark, whole, trads, sermons, hymns, works };
  }

  /* THE CITATIONS OF THE VERSE: the chapter file's rows for it, one row a work (its pages and their kinds together), by tradition, a
   * work that expounds the verse first, then by standing and year. A row with the shelf "x" takes the shelf its work has in the map. */
  const KIND = { exegesis: "expounds", quotation: "quotes", explicit: "cites", allusion: "alludes" };
  const KIND_ORDER = ["exegesis", "quotation", "explicit", "allusion"];
  function citationModel(M, v, keep) {
    const vv = ((M.file && M.file.verses) || []).find((x) => Number(x.v) === Number(v)) || { rows: [], n: 0 };
    const rows = (vv.rows || []).filter((r) => r && r.w && keep(r));
    const by = new Map();
    for (const r of rows) {
      if (!by.has(r.w)) {
        const m = M.meta[r.w] || {};
        let sh = r.sh && r.sh !== "x" ? r.sh : (m.sh && m.sh !== "x" ? m.sh : famShelf(r.w) || "x");
        const cen = (M.RANK.works[r.w] || [])[2] || 0;
        if (sh === "pl" && cen >= 8) sh = "md";
        by.set(r.w, { w: r.w, a: r.a || m.a || "", t: r.t || m.t || r.w, trad: shelfOk(sh), pages: [], kinds: {} });
      }
      const g = by.get(r.w);
      if (!g.pages.some((x) => String(x.p) === String(r.p) && x.how === r.how)) g.pages.push({ p: r.p, how: r.how, g: r.g || "" });
      g.kinds[r.how] = (g.kinds[r.how] || 0) + 1;
    }
    const works = [...by.values()];
    for (const g of works) {
      g.pages.sort((p, q) => KIND_ORDER.indexOf(p.how) - KIND_ORDER.indexOf(q.how) || Number(p.p) - Number(q.p));
      g.ex = g.kinds.exegesis ? 0 : 1;
      g.rank = -M.impOf(g.w, g.a);
      g.year = yearOf(M, g.a, null) || 9999;
      g.id = `w:${g.w}`;
    }
    const trads = TRADS.map(([k, name]) => ({ k, name, works: works.filter((g) => g.trad === k).sort((p, q) => p.ex - q.ex || p.rank - q.rank || p.year - q.year || p.a.localeCompare(q.a)) }))
      .filter((g) => g.works.length);
    return { rows, works, trads, total: Number(vv.n || 0), loaded: (vv.rows || []).length, full: !!vv.full || (vv.rows || []).length >= Number(vv.n || 0), vv };
  }

  // ── the band: who treats the verse, by tradition and century ───────────────────────────────────────────────────────────────────────
  const KINDS = [["comm", "Commentaries", "commentary", "commentaries"], ["sermons", "Homilies and sermons", "sermon", "sermons"], ["cite", "Citations", "citation", "citations"], ["hymns", "Hymns", "hymn", "hymns"]];
  function bandItems(M, vm, cm, only) {
    const au = new Map();
    const add = (name, t, y, kind) => {
      const k = authorKey(name); if (!k) return;
      if (!au.has(k)) au.set(k, { name: properName(name), t: t || "x", y: 0, kinds: new Set() });
      const a = au.get(k);
      if (!a.y && y) a.y = y;
      if (a.t === "x" && t && t !== "x") a.t = t;
      a.kinds.add(kind);
    };
    if (!only || only === "comm") for (const w of [...vm.landmark, ...vm.trads.flatMap((g) => g.works)]) add(w.main.a, w.trad, w.year, "comm");
    if (!only || only === "sermons") for (const s of vm.sermons) add(s.x.a || s.w.main.a, s.w.trad, Number(s.x.fl || s.x.year) || yearOf(M, s.x.a || s.w.main.a, null), "sermons");
    if (!only || only === "cite") for (const g of cm.works) add(g.a, g.trad, g.year < 9999 ? g.year : 0, "cite");
    if (!only || only === "hymns") for (const x of vm.hymns) add(x.a, shelfOk(X_SHELF[x.tr] || famShelf(x.slug) || "x"), Number(x.year) || yearOf(M, x.a, null), "hymns");
    return [...au.values()];
  }

  // ── the page preview: a work's page under its row (page-window.js), a Father in Migne or an EEBO book read here ─────────────────
  const FAMILY = /^(?:pld|pg|po|eebo)-\d+$/;
  async function previewInto(M, box, slug, p, hl) {
    if (!FAMILY.test(slug) && root.FRPageWindow && root.FRPageWindow.fill) {
      try { if (await root.FRPageWindow.fill(box, { slug, page: p, hl })) return true; } catch (_) { /* read here instead */ }
    }
    const k = stride(slug);
    let first = null;
    try { first = await M.pages.page(slug, Number(p)); } catch (_) { return false; }
    if (!first || !first.p) return false;
    const at = Number(first.p.n) || Number(p), srcName = first.src || "Latin", got = new Map([[at, first.p]]);
    const pageAt = (x) => (got.has(x) ? Promise.resolve(got.get(x)) : M.pages.page(slug, x).then((g) => { const q = g && g.p; got.set(x, q); return q; }).catch(() => null));
    const both = !!(first.p.en && first.p.la);
    let lane = first.p.en ? "en" : "src", lo = at, hi = at + k, drawing = 0;
    box.classList.add("pw");
    box.innerHTML = `<div class="pw-bar">${both ? `<div class="pw-lanes" role="group" aria-label="Text"><button type="button" data-lane="en">English</button><button type="button" data-lane="src">${esc(srcName)}</button><button type="button" data-lane="both">Both</button></div>` : ""}`
      + '<span class="pw-span" role="status"></span><span class="pw-more"><button type="button" data-more="-1">Earlier page</button><button type="button" data-more="1">Later page</button></span></div><div class="pw-pages"></div>';
    const pagesEl = box.querySelector(".pw-pages"), spanEl = box.querySelector(".pw-span");
    const col = (q, l) => {
      const ps = paragraphs(l === "en" ? q.en : q.la);
      const body = ps.map((s) => (/^#{1,6}\s+/.test(s) ? `<h5>${esc(s.replace(/^#{1,6}\s+/, ""))}</h5>` : `<p>${esc(s)}</p>`)).join("");
      return `<div class="pw-col" lang="${l === "en" ? "en" : "la"}">${body || `<p class="pw-none">No ${l === "en" ? "English" : esc(srcName)} on this page.</p>`}</div>`;
    };
    const draw = async () => {
      const token = ++drawing, rows = [];
      box.querySelectorAll("[data-lane]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lane === lane)));
      for (let x = lo; x <= hi; x += k) { const q = await pageAt(x); if (q && (q.en || q.la)) rows.push(q); }
      if (token !== drawing) return;
      const canon = CANON.test(slug), lab = (q) => (canon ? `cols. ${q.n}–${Number(q.n) + 1}` : pgOf(slug, q.n));
      spanEl.textContent = !rows.length ? "" : rows.length === 1 ? lab(rows[0]) : canon ? `cols. ${rows[0].n}–${Number(rows[rows.length - 1].n) + 1}` : `pp. ${rows[0].n}–${rows[rows.length - 1].n}`;
      pagesEl.innerHTML = rows.map((q) => `<section class="pw-page${Number(q.n) === at ? " pw-cited" : ""}" data-n="${esc(q.n)}"><h4>${esc(lab(q))}</h4>${lane === "both" ? `<div class="pw-two">${col(q, "en")}${col(q, "src")}</div>` : col(q, lane)}</section>`).join("");
    };
    box.addEventListener("click", (e) => {
      const l = e.target.closest("[data-lane]");
      if (l) { lane = l.dataset.lane; draw(); return; }
      const mo = e.target.closest("[data-more]");
      if (mo) { if (mo.dataset.more === "-1") lo = Math.max(1, lo - k); else hi += k; draw(); }
    });
    await draw();
    return true;
  }

  // ── the desk ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  let SEQ = 0;
  const ICON = {
    prev: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false"><path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    next: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false"><path d="M7.5 4.5 13 10l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  /* cfg: {base, site ("tfr" | "mo"), book {slug, name}, ch, verse, verses [n…], chapter (the chapter file, if the host holds it),
   *   devotion (the commentary map, if held), text(v) → the verse's text (or a promise), translation {code, name, options [[code, label,
   *   title]], set(code)}, compare(v) → promise of [{label, title, text}], sources {label, html} (the host's source filter, its own
   *   markup), keep(item) → whether a source is in the filter, save(v) → promise of a message, read(slug, page) → the reader's address,
   *   beside(slug, v) → the Scripture reader with the commentary beside the text, chapterHref(v), deskHref(v), go(v) → true when the host
   *   changes the verse in place, step(dir) → {href, label} across chapters, state {g, r}, onState({v, g, r}), loadAll() → promise,
   *   tools {browse(el, mode), compare(el, mode)} (the host's citation tools), method(html) → the host's methodology note, onReady() once drawn} */
  function mount(host, cfg) {
    const D = store(cfg.base, cfg.site);
    const id = `vdb${(++SEQ).toString(36)}`;
    const keep = typeof cfg.keep === "function" ? cfg.keep : () => true;
    const method = typeof cfg.method === "function" ? cfg.method : (html) => `<p class="vdb-method">${html.replace(/^<p>|<\/p>$/g, "")}</p>`;
    let v = Number(cfg.verse) || Number((cfg.verses || [])[0]) || 1;
    let M = null, VM = null, CM = null, dead = false;
    const st = { g: cfg.state && cfg.state.g != null ? String(cfg.state.g) : null, r: (cfg.state && cfg.state.r) || "", k: "", tool: "", lane: new Map(), limit: new Map() };
    let verses = (cfg.verses || []).map(Number);
    const ref = (x) => `${cfg.book.slug === "psalms" ? "Psalm" : cfg.book.name} ${cfg.ch}:${x}`;
    const chRef = `${cfg.book.slug === "psalms" ? "Psalm" : cfg.book.name} ${cfg.ch}`;
    host.classList.add("vdb", `vdb-site-${cfg.site || "tfr"}`);
    host.innerHTML = `<header class="vdb-head" aria-labelledby="${id}-t">
        <div class="vdb-top"><h2 class="vdb-title" id="${id}-t" tabindex="-1"></h2><nav class="vdb-step" aria-label="Verses"></nav></div>
        <blockquote class="vdb-verse"><p data-vdb-text>…</p></blockquote>
        <div class="vdb-tools"></div>
        <div class="vdb-drawer" data-vdb-drawer="compare" id="${id}-cmp" hidden></div>
        <div class="vdb-drawer" data-vdb-drawer="sources" id="${id}-src" hidden></div>
        <p class="vdb-said" role="status" hidden></p>
      </header>
      <section class="vdb-band" aria-labelledby="${id}-bh"><div class="vdb-band-h"><h3 id="${id}-bh">Who treats this verse</h3><p class="vdb-band-sum" data-vdb-sum></p></div>
        <div class="vdb-strip" data-vdb-strip><p class="vdb-wait" role="status">Gathering who treats the verse…</p></div>
        <div class="vdb-kinds" role="group" aria-label="Show only" data-vdb-kinds></div></section>
      <div class="vdb-groups" data-vdb-groups><p class="vdb-wait" role="status">Opening the commentaries on ${esc(chRef)}…</p></div>
      <div class="vdb-after" data-vdb-after></div>`;
    const $ = (s) => host.querySelector(s);

    // ── the verse ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
    const tools = () => {
      const T = cfg.translation;
      const bits = [];
      if (T && T.options && T.options.length > 1) bits.push(`<label class="vdb-tr"><span class="vdb-sr">Translation</span><select data-vdb-tr>${T.options.map(([code, label, title]) => `<option value="${esc(code)}"${code === T.code ? " selected" : ""}${title ? ` title="${esc(title)}"` : ""}>${esc(label)}</option>`).join("")}</select></label>`);
      else if (T && T.name) bits.push(`<span class="vdb-trname">${esc(T.name)}</span>`);
      if (cfg.compare) bits.push(`<button type="button" class="vdb-tool" data-vdb-open="compare" aria-expanded="false" aria-controls="${id}-cmp">Compare translations</button>`);
      if (cfg.sources) bits.push(`<button type="button" class="vdb-tool" data-vdb-open="sources" aria-expanded="false" aria-controls="${id}-src">${esc(cfg.sources.label)}</button>`);
      if (cfg.save) bits.push('<button type="button" class="vdb-tool" data-vdb-save>Save verse</button>');
      if (cfg.chapterHref) bits.push(`<a class="vdb-tool" href="${esc(cfg.chapterHref(v))}">Read ${esc(chRef)}</a>`);
      return bits.join("");
    };
    const step = () => {
      const i = verses.indexOf(v);
      const arrow = (dir) => {
        const to = verses[i + dir], x = to ? null : cfg.step ? cfg.step(dir) : null;
        const href = to ? (cfg.deskHref ? cfg.deskHref(to) : "#") : x && x.href;
        const label = to ? `${dir < 0 ? "Previous" : "Next"} verse, ${ref(to)}` : x ? `${dir < 0 ? "Previous" : "Next"}: ${x.label}` : "";
        return href ? `<a class="vdb-arrow" href="${esc(href)}"${to ? ` data-vdb-go="${to}"` : ""} aria-label="${esc(label)}" title="${esc(label)}">${dir < 0 ? ICON.prev : ICON.next}</a>`
          : `<span class="vdb-arrow" aria-hidden="true">${dir < 0 ? ICON.prev : ICON.next}</span>`;
      };
      const sel = verses.length > 1 ? `<label class="vdb-vsel"><span class="vdb-sr">Verse</span><select data-vdb-verse>${verses.map((x) => `<option value="${x}"${x === v ? " selected" : ""}>${cfg.ch}:${x}</option>`).join("")}</select></label>` : "";
      return `${arrow(-1)}${sel}${arrow(1)}`;
    };
    const drawHead = () => {
      $(".vdb-title").textContent = ref(v);
      $(".vdb-step").innerHTML = step();
      $(".vdb-tools").innerHTML = tools();
      const T = cfg.translation;
      const say = (t) => { $("[data-vdb-text]").textContent = t || `${ref(v)} is not in this translation.`; };
      $(".vdb-verse").setAttribute("aria-label", `${ref(v)}${T && T.name ? `, ${T.name}` : ""}`);
      const t = cfg.text ? cfg.text(v) : "";
      if (t && typeof t.then === "function") { $("[data-vdb-text]").textContent = "…"; const at = v; t.then((x) => { if (at === v && !dead) say(x); }).catch(() => say("")); } else say(t);
      host.querySelectorAll("[data-vdb-drawer]").forEach((d) => { d.hidden = true; });
    };
    const said = (text) => { const p = $(".vdb-said"); p.textContent = text; p.hidden = !text; };
    async function openDrawer(which, btn) {
      const d = host.querySelector(`[data-vdb-drawer="${which}"]`), open = d.hidden;
      host.querySelectorAll("[data-vdb-drawer]").forEach((x) => { x.hidden = true; });
      host.querySelectorAll("[data-vdb-open]").forEach((b) => b.setAttribute("aria-expanded", "false"));
      if (!open) return;
      d.hidden = false; btn.setAttribute("aria-expanded", "true");
      if (which === "sources") { d.innerHTML = cfg.sources.html(); return; }
      d.innerHTML = '<p class="vdb-wait" role="status">Reading the verse in every translation…</p>';
      const at = v;
      try {
        const xs = await cfg.compare(v);
        if (at !== v || dead) return;
        d.innerHTML = `<dl class="vdb-cmp">${xs.map((x) => `<div><dt${x.title ? ` title="${esc(x.title)}"` : ""}>${esc(x.label)}</dt><dd>${esc(x.text || "Not in this translation.")}</dd></div>`).join("")}</dl>`;
      } catch (_) { d.innerHTML = '<p class="vdb-wait">The translations could not be read. Close and open this again.</p>'; }
    }

    // ── the band ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
    function drawBand() {
      const G = TG(), box = $("[data-vdb-strip]");
      const items = bandItems(M, VM, CM, st.k);
      const all = bandItems(M, VM, CM, "");
      const n = all.length, notes = VM.works.filter((w) => w.kind === "comm" && w.onV).length;
      const years = all.map((a) => a.y).filter((y) => y > 0 && y < 2100), lo = years.length ? Math.min(...years) : 0, hi = years.length ? Math.max(...years) : 0;
      // the citations not yet loaded (a verse cited thousands of times comes in two parts) are said, and one press away
      const part = !CM.full && CM.total > CM.loaded ? `${DOT}among the first ${fmt(CM.loaded)} of ${fmt(CM.total)} citations ` : "";
      $("[data-vdb-sum]").innerHTML = n ? `${esc(plural(n, "author", "authors"))}${lo ? `, ${ord(Math.floor(lo / 100) + 1)} to ${ord(Math.floor(hi / 100) + 1)} century` : ""}${notes ? `${DOT}${esc(plural(notes, "commentary has", "commentaries have"))} a note on the verse` : ""}${part ? `${esc(part)}<button type="button" class="vdb-act vdb-act-in" data-vdb-loadall>Load the other ${fmt(CM.total - CM.loaded)}</button>` : ""}` : "";
      if (!G || !items.length) { box.innerHTML = items.length ? "" : `<p class="vdb-wait">${st.k ? "None of this kind on the verse in these sources." : "No author in the library treats this verse yet."}</p>`; drawKinds(); return; }
      const data = G.bin(items.map((a) => ({ y: a.y, t: a.t, name: a.name })), 25);
      const marks = [...(M.head || []), ...(M.tail || [])].filter((c) => keep({ sh: rawShelf(c), w: c.slug, a: c.a }))
        .map((c, i) => ({ y: yearOf(M, c.a, c), label: short(c.a), p: i })).filter((m) => m.y > 0);
      const kindName = st.k ? (KINDS.find((k) => k[0] === st.k) || [])[3] : "";
      let html = G.eraStrip(data, { unit: "author", units: "authors", marks, title: `Who treats ${ref(v)}${kindName ? `: ${kindName}` : ""}`, legendLabel: "Traditions shown" });
      // the authors under each century, set under its name on the axis (the strip's own positions)
      const cents = new Map();
      for (const a of items) if (a.y > 0 && a.y < 2100) { const c = Math.floor(a.y / 100); cents.set(c, (cents.get(c) || 0) + 1); }
      const row = html.match(/<div class="tg-ax"[^>]*>([\s\S]*?)<\/div>/);
      if (row) {
        const spans = [...row[1].matchAll(/<span class="tg-c([^"]*)" style="left:([^"]+)">(\d+)\w+<\/span>/g)];
        const counts = spans.map(([, cls, left, nth]) => { const k = cents.get(Number(nth) - 1) || 0; return `<span class="vdb-cn${cls}" style="left:${left}"${k ? "" : ' data-zero="1"'}>${k ? fmt(k) : ""}</span>`; }).join("");
        html = html.replace(row[0], `${row[0]}<div class="vdb-cents" aria-hidden="true">${counts}</div>`);
      }
      box.innerHTML = html;
      if (!box.__vdbTg) { box.__vdbTg = true; G.mount(box); } else G.layout(box);
      if (!box.querySelector(".vdb-method")) box.insertAdjacentHTML("beforeend", method(`<p>Each author once, at his birth (else when first recorded), on his tradition's shelf; named over the bars, the landmark commentators on ${esc(chRef)}. Point at the strip, or use its arrow keys, for a quarter-century's authors.</p>`));
      drawKinds();
    }
    function kindCounts() {
      return { comm: VM.landmark.length + (VM.whole || []).reduce((s, g) => s + g.works.length, 0) + VM.trads.reduce((s, g) => s + g.works.length, 0), sermons: VM.sermons.length, cite: CM.rows.length, hymns: VM.hymns.length };
    }
    function drawKinds() {
      const n = kindCounts();
      $("[data-vdb-kinds]").innerHTML = `<button type="button" class="vdb-kind" data-vdb-kind="" aria-pressed="${!st.k}">All</button>${KINDS.filter(([k]) => n[k]).map(([k, label]) =>
        `<button type="button" class="vdb-kind" data-vdb-kind="${k}" aria-pressed="${st.k === k}">${esc(label)}<span class="vdb-n">${fmt(n[k])}</span></button>`).join("")}`;
    }

    // ── the groups ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
    const pv = (slug, p, label) => (p != null && p !== "" ? `<button type="button" class="vdb-pv" data-vdb-pv="${esc(slug)}|${esc(p)}" aria-expanded="false" aria-label="Preview ${esc(label || pgOf(slug, p))}">Preview</button>` : "");
    const pageLink = (slug, p, label) => (p != null && p !== "" ? `<a class="vdb-pg" href="${esc(cfg.read(slug, p))}" aria-label="${esc(`${label}, ${pgOf(slug, p)}, in the reader`)}">${esc(pgOf(slug, p))}</a>` : "");
    const glimpse = (names) => { const u = [...new Set(names.filter(Boolean))]; return u.slice(0, 3).map((x) => cut(String(x), 30)).join(", ") + (u.length > 3 ? ", …" : ""); };
    const whenOf = (a, y) => datesOf(M, a) || (y && y < 9999 ? (y % 100 === 50 ? `${ord(Math.floor(y / 100) + 1)} century` : `c. ${y}`) : "");
    const hasLine = (w) => {
      const c = w.main;
      if (c.wb === 2) return c.hit && c.hit.v && c.hit.v.length ? `Cites ${cfg.ch}:${c.hit.v.slice(0, 4).join(", ")}${c.hit.v.length > 4 ? " and more" : ""}` : `Cites chapter ${cfg.ch}`;
      if (c.ser && c.kd === "sermons") { const on = c.ser.filter((x) => serOn(x, v)).length; return on ? `${on === 1 ? "A sermon" : `${on} sermons`} on ${cfg.ch}:${v}` : `${plural(c.ser.length, "sermon", "sermons")} on ${chRef}`; }
      if (c.collected && c.collected[v]) return `Critics on ${cfg.ch}:${v}`;
      if (c.notes && c.notes[v] != null) return `Note on ${cfg.ch}:${v}`;
      if (c.treats && !Object.keys(c.notes || {}).length) return "Treats this chapter";
      const vs = Object.keys(c.notes || {}).map(Number).filter((x) => x > 0).sort((p, q) => p - q);
      if (!vs.length && c.open == null && c.bookAt != null) return `Chapter ${cfg.ch} not mapped`;
      return !vs.length ? `On chapter ${cfg.ch}` : vs.length <= 3 ? `${vs.length === 1 ? "Note" : "Notes"} on ${cfg.ch}:${vs.join(", ")}` : `Notes on ${vs.length} verses of the chapter`;
    };
    const row = (o) => `<div class="vdb-r${o.cls ? ` ${o.cls}` : ""}" data-vdb-row="${esc(o.id)}"><div class="vdb-rl">`
      + `<button type="button" class="vdb-rb" data-vdb-r="${esc(o.id)}" aria-expanded="false" aria-controls="${id}-o-${esc(o.key)}">`
      + `<span class="vdb-who">${esc(o.who)}${o.when ? `<small>${esc(o.when)}</small>` : ""}</span>`
      + `<span class="vdb-what"><cite${o.tl ? ` title="${esc(o.tl)}"` : ""}>${esc(o.what)}</cite>${o.has ? `<small>${esc(o.has)}</small>` : ""}</span></button>`
      + `<span class="vdb-ra">${o.page || ""}${o.pv || ""}<button type="button" class="vdb-lane" data-vdb-lane aria-pressed="false" hidden>Latin</button></span></div>`
      + `<div class="vdb-ro" id="${id}-o-${esc(o.key)}" hidden></div><div class="vdb-pvw" hidden></div></div>`;
    const keyOf = (s) => String(s).replace(/[^A-Za-z0-9_-]+/g, "_");
    const workRow = (w) => {
      const c = w.main, t = targetOf(M, c, v), p = t ? t.p : null;
      const vol = w.vols.length > 1 ? "" : c.vol && /\d/.test(c.vol) ? ` (${String(c.vol).replace(/^Weimar Edition: Writings, Volume\s*/i, "WA ")})` : "";
      return row({ id: c.slug, key: keyOf(c.slug), who: properName(c.a) || c.t, when: whenOf(c.a, w.year), what: `${c.t}${vol}`, tl: c.tl,
        has: `${hasLine(w)}${w.vols.length > 1 ? `${DOT}${w.vols.length} volumes` : ""}${w.whole ? `${DOT}whole Bible` : ""}`, page: pageLink(c.slug, p, c.t), pv: pv(c.slug, p, `${c.t}, ${p != null ? pgOf(c.slug, p) : ""}`) });
    };
    const sermonRow = (s) => {
      const c = s.c || s.w.main, { x } = s, who = properName(x.a || c.a) || c.t;
      return row({ id: `s:${c.slug}@${x.p}`, key: keyOf(`s-${c.slug}-${x.p}`), who, when: whenOf(x.a || c.a, Number(x.fl || x.year) || s.w.year),
        what: x.t, tl: x.tl && x.tl !== x.t ? x.tl : "", has: `${x.ref ? (x.vul ? `${x.ref}, the Vulgate's count` : x.ref) : chRef}${s.on ? `${DOT}on ${cfg.ch}:${v}` : ""}`,
        page: pageLink(c.slug, x.p, x.t), pv: pv(c.slug, x.p, `${x.t}, ${pgOf(c.slug, x.p)}`) });
    };
    const hymnRow = (x) => row({ id: `h:${x.slug}@${x.p}`, key: keyOf(`h-${x.slug}-${x.p}`), who: x.t, when: x.year ? String(x.year) : "", what: properName(x.a) || "", tl: x.tl && x.tl !== x.t ? x.tl : "",
      has: `${x.ref ? (x.vul ? `${x.ref}, the Vulgate's count` : x.ref) : chRef}${serOn(x, v) ? `${DOT}on ${cfg.ch}:${v}` : ""}`, page: pageLink(x.slug, x.p, x.t), pv: pv(x.slug, x.p, `${x.t}, ${pgOf(x.slug, x.p)}`), cls: "vdb-hymn" });
    const citeRow = (g) => {
      const ps = g.pages.map((x) => x.p).filter((p, i, a) => a.indexOf(p) === i);
      const first = g.pages[0], kinds = KIND_ORDER.filter((k) => g.kinds[k]).map((k) => KIND[k]);
      const pgs = ps.length === 1 ? pageLink(g.w, ps[0], g.t) : `<span class="vdb-pgs">${esc(/^(pld|pg)-/.test(g.w) ? "cols." : "pp.")} ${ps.slice(0, 4).map((p) => `<a class="vdb-pg" href="${esc(cfg.read(g.w, p))}">${esc(p)}</a>`).join(", ")}${ps.length > 4 ? ` <span class="vdb-more-n">+${ps.length - 4}</span>` : ""}</span>`;
      return row({ id: g.id, key: keyOf(g.id), who: properName(g.a) || g.t, when: whenOf(g.a, g.year), what: g.t, has: `${kinds.join(", ")}${first && first.g ? `${DOT}${first.g}` : ""}`,
        page: pgs, pv: pv(g.w, first && first.p, `${g.t}, ${first ? pgOf(g.w, first.p) : ""}`), cls: "vdb-cite" });
    };
    const groupHead = (gid, title, n, names, extra) => `<h3 class="vdb-gh"><button type="button" class="vdb-gb" data-vdb-g="${esc(gid)}" aria-expanded="false" aria-controls="${id}-g-${keyOf(gid)}">`
      + `<span class="vdb-sign" aria-hidden="true"></span><span class="vdb-gt">${esc(title)}</span><span class="vdb-n">${esc(n)}</span>${names ? `<span class="vdb-glimpse">${esc(names)}</span>` : ""}${extra || ""}</button></h3>`;
    const groupHTML = (gid, kind, title, n, names, body, cls, after) => `<section class="vdb-g${cls ? ` ${cls}` : ""}" data-vdb-gid="${esc(gid)}" data-vdb-kind="${kind}">${groupHead(gid, title, n, names)}${after || ""}`
      + `<div class="vdb-gp" id="${id}-g-${keyOf(gid)}" data-vdb-body="${esc(gid)}" hidden></div></section>`;
    const LIMIT = 40;
    function groupBody(gid) {
      if (gid === "landmark") return VM.landmark.map(workRow).join("");
      if (gid === "whole") return (VM.whole || []).map((g) => `<p class="vdb-wh">${esc(g.name)}</p>${g.works.map(workRow).join("")}`).join("");
      if (gid.startsWith("t:")) { const g = VM.trads.find((x) => `t:${x.k}` === gid); return g ? g.works.map(workRow).join("") : ""; }
      if (gid === "sermons") return VM.sermons.map(sermonRow).join("");
      if (gid === "hymns") return VM.hymns.map(hymnRow).join("");
      if (gid.startsWith("c:")) {
        const g = CM.trads.find((x) => `c:${x.k}` === gid); if (!g) return "";
        const lim = st.limit.get(gid) || LIMIT, more = g.works.length - lim;
        return g.works.slice(0, lim).map(citeRow).join("") + (more > 0 ? `<button type="button" class="vdb-more" data-vdb-more="${esc(gid)}">Show ${fmt(Math.min(LIMIT, more))} more of ${fmt(g.works.length)}</button>` : "");
      }
      return "";
    }
    const citeBar = () => {
      const t = CM.trads.map((g) => [g.k, g.works.length]), tot = t.reduce((s, x) => s + x[1], 0) || 1;
      return `<span class="vdb-trbar" role="img" aria-label="${esc(`By tradition: ${CM.trads.map((g) => `${g.name} ${g.works.length}`).join(", ")}`)}">${t.map(([k, n]) => `<i style="flex-grow:${n};--c:var(--tg-${k === "x" ? "x" : k})" title="${esc(`${TRAD_NAME[k]}: ${plural(n, "work", "works")}`)}"></i>`).join("")}</span>`;
    };
    function drawGroups() {
      const box = $("[data-vdb-groups]");
      const names = (ws) => glimpse(ws.map((w) => short(w.main.a)));
      let html = "";
      if (VM.landmark.length) html += groupHTML("landmark", "comm", "Landmark commentaries on this verse", fmt(VM.landmark.length), names(VM.landmark), "", "vdb-g-key");
      const wholeN = (VM.whole || []).reduce((s, g) => s + g.works.length, 0);
      if (wholeN) html += groupHTML("whole", "comm", "Whole-Bible commentaries", fmt(wholeN), glimpse(VM.whole.flatMap((g) => g.works.map((w) => w.set.label))), "", "vdb-g-key vdb-g-whole");
      for (const g of VM.trads) html += groupHTML(`t:${g.k}`, "comm", g.name, fmt(g.works.length), names(g.works), "", `vdb-g-trad`);
      if (VM.sermons.length) html += groupHTML("sermons", "sermons", `Homilies and sermons on ${chRef}`, fmt(VM.sermons.length), glimpse(VM.sermons.map((s) => short(s.x.a || s.w.main.a))), "");
      if (VM.hymns.length) html += groupHTML("hymns", "hymns", `Hymns on ${chRef}`, fmt(VM.hymns.length), glimpse(VM.hymns.map((x) => x.t)), "");
      // the citations: one fold, its traditions as a bar, the two tools on its head; inside, by tradition, a row a work
      const total = CM.total || CM.rows.length;
      const filtered = CM.rows.length < CM.loaded;
      html += `<section class="vdb-g vdb-cit" data-vdb-gid="cite" data-vdb-kind="cite"><div class="vdb-cith">${groupHead("cite", `Citations of ${ref(v)}`, `${fmt(CM.rows.length)}${filtered ? ` of ${fmt(CM.loaded)}` : ""} ${CM.rows.length === 1 ? "source page" : "source pages"}`, "", citeBar())}`
        + `<span class="vdb-acts" role="group" aria-label="Citation tools">${[["browse", "Browse sources"], ["compare", "Compare passages"]].filter(([k]) => cfg.tools && cfg.tools[k]).map(([k, l]) => `<button type="button" class="vdb-act" data-vdb-tool="${k}" aria-pressed="${st.tool === k}">${l}</button>`).join("")}</span></div>`
        + `<div class="vdb-gp" id="${id}-g-cite" data-vdb-body="cite" hidden><div class="vdb-cl">${CM.trads.map((g) => `<section class="vdb-g vdb-sub" data-vdb-gid="c:${g.k}" data-vdb-parent="cite">`
          + `${groupHead(`c:${g.k}`, g.name, fmt(g.works.length), glimpse(g.works.map((x) => short(x.a))))}<div class="vdb-gp" id="${id}-g-${keyOf(`c:${g.k}`)}" data-vdb-body="c:${g.k}" hidden></div></section>`).join("")
          || `<p class="vdb-wait">${CM.loaded ? "No citation of the verse in these sources." : "No page in the library cites this verse yet."}</p>`}`
        + `${!CM.full && total > CM.loaded ? `<p class="vdb-loadall"><span>${fmt(CM.loaded)} of ${fmt(total)} citations are loaded.</span><button type="button" class="vdb-act" data-vdb-loadall>Load the remaining ${fmt(total - CM.loaded)}</button></p>` : ""}</div>`
        + `<div class="vdb-toolarea" data-vdb-toolarea hidden></div></div></section>`;
      box.innerHTML = html;
      applyKind();
      restore();
    }
    const groupEl = (gid) => host.querySelector(`[data-vdb-gid="${CSS.escape(gid)}"]`);
    function fill(gid) {
      const b = host.querySelector(`[data-vdb-body="${CSS.escape(gid)}"]`);
      if (!b || gid === "cite" || b.dataset.filled === "1") return;
      b.innerHTML = groupBody(gid); b.dataset.filled = "1";
    }
    // one group open at a time, at its own level (the citations' traditions inside the citations)
    function setGroup(gid, open, quiet) {
      const sec = groupEl(gid); if (!sec) return;
      const parent = sec.dataset.vdbParent || "";
      host.querySelectorAll(".vdb-g").forEach((x) => {
        if ((x.dataset.vdbParent || "") !== parent || x === sec) return;
        const b = x.querySelector(":scope > .vdb-gh .vdb-gb, :scope > .vdb-cith .vdb-gb"), body = x.querySelector(":scope > .vdb-gp");
        if (b && b.getAttribute("aria-expanded") === "true") { b.setAttribute("aria-expanded", "false"); if (body) body.hidden = true; x.classList.remove("is-open"); }
      });
      const b = sec.querySelector(":scope > .vdb-gh .vdb-gb, :scope > .vdb-cith .vdb-gb"), body = sec.querySelector(":scope > .vdb-gp");
      if (open) fill(gid);
      b.setAttribute("aria-expanded", String(open)); body.hidden = !open; sec.classList.toggle("is-open", open);
      if (!quiet) { st.g = open ? gid : parent; if (!open || !(st.r && sec.querySelector(`[data-vdb-row="${CSS.escape(st.r)}"]`))) st.r = ""; report(); }
    }
    function restore() {
      let { g } = st;
      if (g == null) g = VM.landmark.length ? "landmark" : "";
      if (!g) { report(); return; }
      if (g.startsWith("c:")) { setGroup("cite", true, true); }
      if (!groupEl(g)) g = VM.landmark.length ? "landmark" : "";
      if (g) setGroup(g, true, true);
      st.g = g;
      if (st.r) { const r = host.querySelector(`[data-vdb-row="${CSS.escape(st.r)}"]`); if (r) openRow(r, true, true); else st.r = ""; }
    }
    const report = () => { if (cfg.onState) cfg.onState({ v, g: st.g, r: st.r }); };
    function applyKind() {
      host.querySelectorAll(".vdb-groups > .vdb-g").forEach((s) => { s.hidden = !!st.k && s.dataset.vdbKind !== st.k; });
    }

    // ── a row opened: the passage as a block quote, English first, the source a press away ───────────────────────────────────────────
    const workOf = (rid) => VM.works.find((w) => w.vols.some((c) => c.slug === rid)) || null;
    const LANG = { Latin: "la", Greek: "grc", French: "fr", German: "de", Dutch: "nl", Syriac: "syr" };
    const quoteHTML = (P, lane) => {
      const src = lane === "src" ? !!P.src : !P.en, ps = (src ? P.src : P.en) || [];
      return `<blockquote class="vdb-q" lang="${src ? LANG[P.srcName] || "la" : "en"}">${ps.map((x) => `<p${x.head ? ' class="vdb-qh"' : ""}>${x.who ? `<b>${esc(x.who)}</b> ` : ""}${esc(x.t)}</p>`).join("")}</blockquote>`;
    };
    async function rowPassage(rowEl, rid) {
      const box = rowEl.querySelector(".vdb-ro"), lb = rowEl.querySelector("[data-vdb-lane]");
      if (box.dataset.ready) return;
      box.dataset.ready = "1";
      box.innerHTML = '<p class="vdb-wait" role="status">Opening the page…</p>';
      let P = null, beside = "", read = "";
      try {
        if (rid.startsWith("w:")) {
          const g = CM.works.find((x) => x.id === rid);
          box.innerHTML = g ? `<ul class="vdb-cps">${g.pages.map((x) => `<li><a class="vdb-pg" href="${esc(cfg.read(g.w, x.p))}">${esc(pgOf(g.w, x.p))}</a><span class="vdb-k">${esc(KIND[x.how] || "cites")}</span>${x.g ? `<span class="vdb-gist">${esc(x.g)}</span>` : ""}${pv(g.w, x.p, `${g.t}, ${pgOf(g.w, x.p)}`)}</li>`).join("")}</ul>` : "";
          return;
        }
        if (rid.startsWith("h:")) {
          const [slug, p] = rid.slice(2).split("@"), x = VM.hymns.find((h) => h.slug === slug && String(h.p) === p);
          box.innerHTML = x && x.first ? `<blockquote class="vdb-q" lang="en"><p>${esc(x.first)}</p></blockquote><p class="vdb-go"><a href="${esc(cfg.read(slug, p))}">Open in the reader</a></p>` : `<p class="vdb-go"><a href="${esc(cfg.read(slug, p))}">Open in the reader</a></p>`;
          return;
        }
        let c;
        if (rid.startsWith("s:")) {
          const [slug, p] = rid.slice(2).split("@"), s = VM.sermons.find((y) => (y.c || y.w.main).slug === slug && String(y.x.p) === p);
          c = s ? { ...(s.c || s.w.main), ser: [s.x], kd: "sermons" } : null;
          if (c) P = await passage(M, c, s.on ? v : 0);
        } else {
          const w = workOf(rid); c = w ? w.vols.find((x) => x.slug === rid) || w.main : null;
          if (c) P = await passage(M, c, v);
        }
        if (!P) { box.innerHTML = '<p class="vdb-wait">Nothing to show for this work.</p>'; return; }
        beside = cfg.beside ? cfg.beside(P.slug, v) : "";
        read = cfg.read(P.slug, P.page);
      } catch (_) { box.dataset.ready = ""; box.innerHTML = '<p class="vdb-wait">The page could not be opened. Close the row and open it again.</p>'; return; }
      if (dead || !box.isConnected) return;
      const lane = st.lane.get(rid) || "en";
      const body = P.none && !(P.en || P.src) ? `<p class="vdb-wait">${esc(P.none)}</p>` : quoteHTML(P, lane);
      box.innerHTML = `${P.where ? `<p class="vdb-where">${esc(P.where)}</p>` : ""}<div data-vdb-quote>${body}</div><p class="vdb-go">${beside ? `<a href="${esc(beside)}">Read beside the text</a>` : ""}<a href="${esc(read)}">Open in the reader</a></p>`;
      box.__P = P;
      if (lb && P.en && P.src) { lb.hidden = false; lb.textContent = P.srcName || "Latin"; lb.setAttribute("aria-pressed", String(lane === "src")); lb.setAttribute("aria-label", `Show the ${P.srcName || "Latin"} of this passage`); }
    }
    function openRow(rowEl, open, quiet) {
      const b = rowEl.querySelector(".vdb-rb"), box = rowEl.querySelector(".vdb-ro"), rid = rowEl.dataset.vdbRow;
      if (open) {
        // one row open in a group
        const grp = rowEl.closest(".vdb-gp");
        if (grp) grp.querySelectorAll(":scope > .vdb-r.is-open").forEach((x) => { if (x !== rowEl) openRow(x, false, true); });
      }
      b.setAttribute("aria-expanded", String(open)); box.hidden = !open; rowEl.classList.toggle("is-open", open);
      const lb = rowEl.querySelector("[data-vdb-lane]"); if (lb && !open) lb.hidden = true;
      if (open) { rowPassage(rowEl, rid); if (box.__P && lb && box.__P.en && box.__P.src) lb.hidden = false; }
      if (!quiet) { st.r = open ? rid : ""; report(); }
    }
    async function togglePreview(btn) {
      const rowEl = btn.closest(".vdb-r, li"), box = rowEl.classList.contains("vdb-r") ? rowEl.querySelector(":scope > .vdb-pvw") : (rowEl.querySelector(".vdb-pvw") || rowEl.appendChild(Object.assign(document.createElement("div"), { className: "vdb-pvw" })));
      const open = btn.getAttribute("aria-expanded") !== "true";
      btn.setAttribute("aria-expanded", String(open)); btn.textContent = open ? "Close preview" : "Preview";
      box.hidden = !open;
      if (!open) { box.innerHTML = ""; box.classList.remove("pw"); return; }
      const [slug, p] = btn.dataset.vdbPv.split("|");
      box.innerHTML = '<p class="vdb-wait" role="status">Loading the page…</p>';
      const ok = await previewInto(M, box, slug, p, "").catch(() => false);
      if (!ok && box.isConnected) box.innerHTML = `<p class="vdb-wait">This page cannot be shown here. <a href="${esc(cfg.read(slug, p))}">Open ${esc(pgOf(slug, p))} in the reader</a></p>`;
    }

    // ── the citation tools on the fold's head ────────────────────────────────────────────────────────────────────────────────────
    function setTool(which) {
      st.tool = st.tool === which ? "" : which;
      const sec = groupEl("cite"); if (!sec) return;
      if (st.tool && !sec.classList.contains("is-open")) setGroup("cite", true);
      sec.querySelectorAll("[data-vdb-tool]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.vdbTool === st.tool)));
      const area = sec.querySelector("[data-vdb-toolarea]"), list = sec.querySelector(".vdb-cl");
      area.hidden = !st.tool; if (list) list.hidden = !!st.tool;
      const loadAll = sec.querySelector(".vdb-loadall"); if (loadAll) loadAll.hidden = !!st.tool;
      const fn = st.tool && cfg.tools ? cfg.tools[st.tool] : null;
      if (fn === "builtin" && st.tool === "compare") compareWorks(area);
      else if (typeof fn === "function") fn(area, st.tool);
      if (st.tool) area.scrollIntoView({ block: "nearest", behavior: reduced() ? "auto" : "smooth" });
    }

    /* COMPARE PASSAGES, where the host has no tool of its own (cfg.tools.compare "builtin"): three citing works side by side, of the first
     * standing (rank.json) until the reader chooses others, each with its pages, what each page says and the page itself a press away.
     * Nothing is inferred about agreement. */
    function compareWorks(area) {
      const ws = CM.works.slice().sort((p, q) => p.rank - q.rank || p.ex - q.ex || p.year - q.year);
      st.cmp = (st.cmp || []).filter((gid) => CM.works.some((g) => g.id === gid));
      for (const g of ws) { if (st.cmp.length >= 3) break; if (!st.cmp.includes(g.id)) st.cmp.push(g.id); }
      const options = (sel) => TRADS.map(([k, name]) => { const xs = CM.works.filter((g) => g.trad === k); return xs.length ? `<optgroup label="${esc(name)}">${xs.map((g) => `<option value="${esc(g.id)}"${g.id === sel ? " selected" : ""}>${esc(properName(g.a))}, ${esc(cut(String(g.t), 56))}</option>`).join("")}</optgroup>` : ""; }).join("");
      const column = (gid, i) => {
        const g = CM.works.find((x) => x.id === gid); if (!g) return "";
        return `<section class="vdb-cmpcol"><label class="vdb-cmpsel"><span class="vdb-sr">The ${ord(i + 1)} work</span><select data-vdb-cmp="${i}">${options(gid)}</select></label>`
          + `<h4 class="vdb-cmph">${esc(properName(g.a))}${whenOf(g.a, g.year) ? `<small>${esc(whenOf(g.a, g.year))}</small>` : ""}</h4><p class="vdb-cmpw"><cite>${esc(g.t)}</cite></p>`
          + `<ul class="vdb-cps">${g.pages.slice(0, 8).map((x) => `<li><a class="vdb-pg" href="${esc(cfg.read(g.w, x.p))}">${esc(pgOf(g.w, x.p))}</a><span class="vdb-k">${esc(KIND[x.how] || "cites")}</span>${x.g ? `<span class="vdb-gist">${esc(x.g)}</span>` : ""}${pv(g.w, x.p, `${g.t}, ${pgOf(g.w, x.p)}`)}</li>`).join("")}</ul></section>`;
      };
      area.innerHTML = CM.works.length ? `<p class="vdb-wait">Three works that cite ${esc(ref(v))}, side by side: of the first standing until you choose others. Read each page in its place; no agreement or disagreement is inferred.</p><div class="vdb-cmpgrid">${st.cmp.map(column).join("")}</div>`
        : '<p class="vdb-wait">No citation of the verse to compare in these sources.</p>';
    }

    // ── keys: Up and Down from row to row, Right opens, Left closes ──────────────────────────────────────────────────────────────────
    host.addEventListener("keydown", (e) => {
      const t = e.target;
      if (!t.matches || !t.matches(".vdb-gb, .vdb-rb")) return;
      const items = [...host.querySelectorAll(".vdb-groups .vdb-gb, .vdb-groups .vdb-rb")].filter((x) => x.getClientRects().length);
      const i = items.indexOf(t);
      const go = (x) => { if (x) { e.preventDefault(); x.focus(); x.scrollIntoView({ block: "nearest" }); } };
      if (e.key === "ArrowDown") return go(items[i + 1]);
      if (e.key === "ArrowUp") return go(items[i - 1]);
      if (e.key === "Home") return go(items[0]);
      if (e.key === "End") return go(items[items.length - 1]);
      const open = t.getAttribute("aria-expanded") === "true";
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (t.matches(".vdb-gb")) { if (!open) setGroup(t.dataset.vdbG, true); else go(items[i + 1]); }
        else if (!open) openRow(t.closest(".vdb-r"), true);
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (t.matches(".vdb-rb")) {
          if (open) openRow(t.closest(".vdb-r"), false);
          else { const h = t.closest(".vdb-g").querySelector(":scope > .vdb-gh .vdb-gb, :scope > .vdb-cith .vdb-gb"); if (h) h.focus(); }
        } else if (open) setGroup(t.dataset.vdbG, false);
        else { const up = t.closest(".vdb-g").parentElement && t.closest(".vdb-g").parentElement.closest(".vdb-g"); const h = up && up.querySelector(":scope > .vdb-gh .vdb-gb, :scope > .vdb-cith .vdb-gb"); if (h) h.focus(); }
      }
    });
    host.addEventListener("click", (e) => {
      const t = e.target;
      const gb = t.closest(".vdb-gb");
      if (gb) { setGroup(gb.dataset.vdbG, gb.getAttribute("aria-expanded") !== "true"); return; }
      const rb = t.closest(".vdb-rb");
      if (rb) { openRow(rb.closest(".vdb-r"), rb.getAttribute("aria-expanded") !== "true"); return; }
      const p = t.closest("[data-vdb-pv]");
      if (p) { e.preventDefault(); togglePreview(p); return; }
      const lb = t.closest("[data-vdb-lane]");
      if (lb) {
        const rowEl = lb.closest(".vdb-r"), box = rowEl.querySelector(".vdb-ro"), rid = rowEl.dataset.vdbRow, P = box.__P;
        if (!P) return;
        const lane = (st.lane.get(rid) || "en") === "en" ? "src" : "en";
        st.lane.set(rid, lane); lb.setAttribute("aria-pressed", String(lane === "src"));
        if (box.hidden) openRow(rowEl, true);
        const q = box.querySelector("[data-vdb-quote]"); if (q) q.innerHTML = quoteHTML(P, lane);
        return;
      }
      const k = t.closest("[data-vdb-kind]");
      if (k && k.classList.contains("vdb-kind")) { st.k = st.k === k.dataset.vdbKind ? "" : k.dataset.vdbKind; applyKind(); drawBand(); return; }
      const more = t.closest("[data-vdb-more]");
      if (more) { const gid = more.dataset.vdbMore; st.limit.set(gid, (st.limit.get(gid) || LIMIT) + LIMIT); const b = host.querySelector(`[data-vdb-body="${CSS.escape(gid)}"]`); b.dataset.filled = ""; fill(gid); return; }
      const tool = t.closest("[data-vdb-tool]");
      if (tool) { setTool(tool.dataset.vdbTool); return; }
      if (t.closest("[data-vdb-loadall]")) { loadAll(t.closest("[data-vdb-loadall]")); return; }
      const op = t.closest("[data-vdb-open]");
      if (op) { openDrawer(op.dataset.vdbOpen, op); return; }
      if (t.closest("[data-vdb-save]")) {
        const b = t.closest("[data-vdb-save]"); b.disabled = true;
        Promise.resolve(cfg.save(v)).then((msg) => said(msg || "Verse saved.")).catch(() => said("The verse could not be saved. Please try again.")).finally(() => { b.disabled = false; });
        return;
      }
      const gv = t.closest("[data-vdb-go]");
      if (gv && cfg.go && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) { const to = Number(gv.dataset.vdbGo); if (cfg.go(to) !== false) { e.preventDefault(); setVerse(to, true); } }
    });
    host.addEventListener("change", (e) => {
      const t = e.target;
      if (t.matches("[data-vdb-tr]") && cfg.translation && cfg.translation.set) { cfg.translation.set(t.value); return; }
      if (t.matches("[data-vdb-cmp]")) { st.cmp[Number(t.dataset.vdbCmp)] = t.value; const area = host.querySelector("[data-vdb-toolarea]"); if (area) compareWorks(area); const sel = host.querySelector(`[data-vdb-cmp="${t.dataset.vdbCmp}"]`); if (sel) sel.focus(); return; }
      if (t.matches("[data-vdb-verse]")) { const to = Number(t.value); if (cfg.go && cfg.go(to) !== false) setVerse(to, true); else if (cfg.deskHref) { const a = document.createElement("a"); a.href = cfg.deskHref(to); a.click(); } }
    });
    // a tradition switched off in the legend takes its authors out of the century counts too
    host.addEventListener("click", (e) => {
      if (!e.target.closest(".tg-lg button[data-tg-k]")) return;
      setTimeout(() => {
        const fig = host.querySelector(".tg-era"); if (!fig) return;
        const on = new Set([...fig.querySelectorAll(".tg-lg button[data-tg-k]")].filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.dataset.tgK));
        const cents = new Map();
        for (const a of bandItems(M, VM, CM, st.k)) if (a.y > 0 && a.y < 2100 && on.has(TG().key(a.t))) { const c = Math.floor(a.y / 100); cents.set(c, (cents.get(c) || 0) + 1); }
        fig.querySelectorAll(".vdb-cn").forEach((s, i) => {
          const ax = fig.querySelectorAll(".tg-ax span")[i]; const nth = ax ? parseInt(ax.textContent, 10) : 0; const n = cents.get(nth - 1) || 0;
          s.textContent = n ? fmt(n) : ""; s.toggleAttribute("data-zero", !n);
        });
      }, 0);
    });
    async function loadAll(btn) {
      btn.disabled = true; btn.textContent = "Loading citations…";
      // the list comes back with every citation; a tool open on the old list is closed with it
      st.tool = "";
      try {
        if (cfg.loadAll) await cfg.loadAll();
        else {
          const extra = await D.json(`${D.base}/v1/bible/all/${M.book}/${M.ch}.more.json.gz`);
          for (const x of (M.file && M.file.verses) || []) { if (x.full) continue; x.rows = (x.rows || []).concat((extra.verses || {})[String(x.v)] || []); x.full = true; }
        }
        CM = citationModel(M, v, keep);
        drawGroups(); drawBand();
        setGroup("cite", true);
      } catch (_) { btn.disabled = false; btn.textContent = "Retry loading the remaining citations"; }
    }

    function render() {
      VM = verseModel(M, v, keep);
      CM = citationModel(M, v, keep);
      drawGroups();
      drawBand();
    }
    function setVerse(to, notify) {
      if (!verses.includes(Number(to))) return;
      v = Number(to);
      st.r = ""; st.lane.clear(); st.limit.clear();
      if (st.tool) { st.tool = ""; }
      drawHead();
      if (M) render();
      if (notify) report();
      const h = $(".vdb-title"); if (h && notify) h.focus({ preventScroll: true });
    }
    drawHead();
    (async () => {
      try {
        const G = TG();
        const [model] = await Promise.all([chapterModel(D, cfg), G && G.dates ? Promise.race([G.dates.ready, new Promise((res) => setTimeout(res, 6000))]) : null]);
        if (dead) return;
        M = model;
        if (!verses.length && M.file) { verses = (M.file.verses || []).map((x) => Number(x.v)).filter(Boolean); drawHead(); }
        render();
        if (cfg.onReady) cfg.onReady();
      } catch (err) {
        if (dead) return;
        $("[data-vdb-groups]").innerHTML = `<p class="vdb-wait">The commentaries on ${esc(chRef)} could not load. <button type="button" class="vdb-act" data-vdb-retry>Try again</button></p>`;
        $("[data-vdb-strip]").innerHTML = "";
        const r = host.querySelector("[data-vdb-retry]"); if (r) r.onclick = () => { host.innerHTML = ""; mount(host, cfg); };
      }
    })();
    return {
      setVerse,
      refresh() { if (M) { CM = citationModel(M, v, keep); render(); } },
      verse: () => v,
      after: () => $("[data-vdb-after]"),
      toolArea: () => host.querySelector("[data-vdb-toolarea]"),
      destroy() { dead = true; },
    };
  }

  root.FRVerseDesk = { mount, chapterModel, verseModel, citationModel, landmarks, passage, targetOf, locate, placeSay, bandItems, store, pageReader, TRADS, properName, workKey, short, serOn, preachRow };
})(typeof window === "undefined" ? globalThis : window);
