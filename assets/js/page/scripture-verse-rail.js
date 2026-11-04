/* THE VERSE RAIL, ORGANIZED (2026-10-21; owner: "this whole thing needs a pass for design UI organization around author and tradition
 * and actual relevance to the text", "too many methodology eyebrows", "no repeated rows for one work"). Three renderers the Scripture
 * page's rail calls (commentary-pane.js on both sites, the verse panel on The Faith Received, scripture-dev-core.js on Mere Orthodoxy),
 * each a pure function of its data and a routes object, so one file serves both sites:
 *
 *   directory   every commentary on the chapter, chapter commentaries and whole-Bible sets alike: by tradition, then author, then
 *               work (a set's volumes folded under one entry), each group shut with its count, each work previewable in place and
 *               openable in the reader; a find box. The panes' Commentary list since 2026-10-21 evening.
 *   picker      the earlier Commentary picker (four groups by what a commentary holds for THIS verse), kept for a cached pane.
 *   reception   the verse's history: one line of counts, the century strip, the commentaries on the verse (each author once, keys
 *               first, then by tradition), then each period's witnesses by standing, the page's gist behind the row, and the rest
 *               of a period one click away in Citations. One methodology line for the whole rail.
 *   citations   every use of the verse grouped by author (one row an author: his works and pages inline, his kinds as counts, the
 *               gists behind the row), tradition and kind chips.
 *
 * Standing, never counts, orders authors (rank.json: cfg.rankOf). Rows link to the page (cfg.read(slug, page)).
 */
(function (root) {
  "use strict";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => Number(n || 0).toLocaleString("en-US");
  const ord = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th")}`;
  const DOT = " · ";
  const VERB = { quotation: "quotes it", explicit: "cites it", allusion: "alludes to it", exegesis: "expounds it" };
  const KIND = { exegesis: "expounds", quotation: "quotes", explicit: "cites", allusion: "alludes" };
  const KIND_ORDER = ["exegesis", "quotation", "explicit", "allusion"];
  // the reception periods against the rows' era letters (E before 500, L to 800, C to 1100, H to 1500, R the Reformation, P the 17th century, M later, U undated)
  const ERA_CODES = { fathers: "EL", "early-medieval": "LC", scholastic: "H", reformation: "R", "17th": "P", "18th": "M", modern: "M" };
  const ERA_NAME = { fathers: "The Fathers", "early-medieval": "Early Middle Ages", scholastic: "High and late Middle Ages", reformation: "Reformation", "17th": "Seventeenth century", "18th": "Eighteenth century", modern: "Since 1800" };
  // the shelves as the lists name them; a Latin writer from the 8th century on reads as Medieval, a Greek from the 9th as Byzantine
  const TRADS = [["gf", "Greek Fathers"], ["pl", "Latin Fathers"], ["po", "Eastern Fathers"], ["by", "Byzantine"], ["md", "Medieval"],
    ["lu", "Lutheran"], ["rf", "Continental Reformed"], ["rc", "Roman Catholic"], ["ed", "English Divines"], ["hl", "Humanism and Law"]];
  const TRAD_NAME = Object.assign(Object.fromEntries(TRADS), { x: "Other", "": "Other" });
  const tradIndex = (k) => { const i = TRADS.findIndex(([x]) => x === k); return i < 0 ? TRADS.length : i; };
  // a page's gist is cut at a fixed length; a cut one ends in an ellipsis
  const gist = (g) => { const t = String(g || "").trim(); if (!t) return ""; return /[.!?)\]"'”’]$/.test(t) ? t : `${t.replace(/\s+\S*$/, "")}…`; };
  const years = (x) => x.d || (x.y ? `fl. c. ${x.y}` : "");
  // a byline set right for a row: the catalogue's title-first strings ("Archbishop of Bulgaria Theophylact") turned about, a guessed
  // attribution ("Uncertain author (Bede?)") read as "Bede (uncertain)"; the map's run-together byline for the Catena Aurea read as the
  // catalogue prints it
  const NAMES = { "collected by Thomas Aquinas The catena": "The catena, collected by Thomas Aquinas", "collected by Thomas Aquinas": "The catena, collected by Thomas Aquinas" };
  const properName = (a) => {
    const s = String(a || "").trim(); if (!s) return s;
    if (NAMES[s]) return NAMES[s];
    const m = /^((?:Arch)?bishop of [A-Z][\w\- ]+?)\s+([A-Z][\w\-]+)$/.exec(s); if (m) return `${m[2]}, ${m[1]}`;
    return s.replace(/^Uncertain author\s*\((.+?)\??\)(?:;.*)?$/i, "$1 (uncertain)");
  };
  // standing from rank.json (curated, never counts): a work's importance, else its author's; loaded once a page
  const RANK = { works: {}, authors: {}, books: {} };
  let rankP = null;
  const loadRank = (base) => rankP || (rankP = fetch(`${String(base).replace(/\/$/, "")}/v1/scripture/rank.json`).then((r) => (r.ok ? r.json() : null))
    .then((d) => { if (d) { Object.assign(RANK.works, d.works || {}); Object.assign(RANK.authors, d.authors || {}); Object.assign(RANK.books, d.books || {}); } }).catch(() => {}));
  const standing = (a, w) => { const r = RANK.works[w]; return -(r ? r[0] : (RANK.authors[a] || 0)); };

  // ── the picker ───────────────────────────────────────────────────────────────────────────────────────────────────────────
  /* rows: the pane's S.list entries {slug, a, t, vol, notes {v: p}, open, hit {v, n}, sh, wb, score}; keys: the curated key
   * commentaries in the order their authors wrote; verse: the verse in view. cfg: {cur, bookName, ch, tradOf, volShort, rankOf}. */
  function picker(rows, keys, verse, cfg) {
    const keySet = new Set(keys.map((c) => c.slug)), keyAt = (c) => keys.findIndex((k) => k.slug === c.slug);
    const rel = (c) => (c.wb === 2 ? "cites" : verse && c.notes && String(verse) in c.notes ? "verse" : (c.notes && Object.keys(c.notes).length) || c.open != null ? "chapter" : "other");
    const byAuthor = (list) => {
      const by = new Map();
      for (const c of list) { const k = c.a || c.slug; if (!by.has(k)) by.set(k, []); by.get(k).push(c); }
      return [...by.values()].map((cs) => { const main = cs.find((c) => keySet.has(c.slug)) || cs[0]; return { main, more: cs.filter((c) => c !== main) }; });
    };
    const order = (xs) => xs.sort((p, q) => {
      const kp = keySet.has(p.main.slug), kq = keySet.has(q.main.slug);
      if (kp !== kq) return kp ? -1 : 1;
      if (kp && kq) return keyAt(p.main) - keyAt(q.main);
      return tradIndex(cfg.tradOf(p.main)) - tradIndex(cfg.tradOf(q.main)) || (q.main.score || 0) - (p.main.score || 0);
    });
    const mark = (c) => {
      const r = rel(c);
      if (r === "verse") return `v. ${esc(verse)}`;
      if (r === "cites") return c.hit ? `cites ${c.hit.v && c.hit.v.length ? `v. ${c.hit.v.slice(0, 3).join(", ")}` : "the chapter"}` : "cites it";
      const n = c.notes ? Object.keys(c.notes).length : 0;
      return n ? `${n} ${n === 1 ? "note" : "notes"} in ch. ${esc(cfg.ch)}` : `ch. ${esc(cfg.ch)}`;
    };
    const li = (c, sub) => `<li role="option" data-slug="${esc(c.slug)}" data-find="${esc(`${c.a || ""} ${c.t || ""}`.toLowerCase())}" aria-selected="${!!(cfg.cur && cfg.cur.slug === c.slug)}"${sub ? ' class="vr-sub"' : ""}>`
      + `${sub ? "" : `<span class="vr-a">${esc(properName(c.a) || c.t)}</span>`}<span class="vr-t">${esc(c.t)}${cfg.volShort(c.vol) ? `${DOT}${esc(cfg.volShort(c.vol))}` : ""}</span>`
      + `<span class="vr-n">${mark(c)}</span></li>`;
    // a tradition's name once above its first author, inside a group that mixes traditions
    const group = (title, xs, opts) => {
      if (!xs.length) return "";
      let out = `<li class="vr-h" role="presentation" data-group="${esc(title)}">${esc(title)}<small>${xs.length}</small></li>`, last = null;
      for (const r of xs) {
        const isKey = keySet.has(r.main.slug), t = isKey ? "key" : cfg.tradOf(r.main);
        if (!opts.flat && t !== last) { out += `<li class="vr-trad" role="presentation">${esc(isKey ? "Key commentaries" : TRAD_NAME[t] || "Other")}</li>`; last = t; }
        out += li(r.main, false) + r.more.map((c) => li(c, true)).join("");
      }
      return out;
    };
    const onBook = rows.filter((c) => c.wb === 0), whole = rows.filter((c) => c.wb === 1), cited = rows.filter((c) => c.wb === 2);
    const onVerse = order(byAuthor(onBook.filter((c) => rel(c) === "verse")));
    const onChapter = order(byAuthor(onBook.filter((c) => rel(c) !== "verse")));
    const wholeRows = order(byAuthor(whole));
    // works on other books that cite the chapter: one row an author, his volumes folded, the whole group shut until asked
    const citedRows = byAuthor(cited).sort((p, q) => cfg.rankOf(p.main.slug, p.main.a) - cfg.rankOf(q.main.slug, q.main.a) || (p.main.a || "").localeCompare(q.main.a || ""));
    const citedLi = (r) => {
      const n = r.more.length + 1;
      return `<li role="option" data-slug="${esc(r.main.slug)}" data-find="${esc(`${r.main.a || ""} ${r.main.t || ""}`.toLowerCase())}" aria-selected="${!!(cfg.cur && cfg.cur.slug === r.main.slug)}" class="vr-cited">`
        + `<span class="vr-a">${esc(properName(r.main.a) || r.main.t)}</span><span class="vr-t">${n > 1 ? `${n} volumes${DOT}` : ""}${esc(r.main.t)}${cfg.volShort(r.main.vol) ? `${DOT}${esc(cfg.volShort(r.main.vol))}` : ""}</span>`
        + `<span class="vr-n">${mark(r.main)}</span>${n > 1 ? `<button type="button" class="vr-vols" aria-expanded="false" aria-label="Show the other ${n - 1} volumes">+${n - 1}</button>` : ""}</li>${
         r.more.map((c) => li(c, true).replace('class="vr-sub"', 'class="vr-sub vr-vol" hidden')).join("")}`;
    };
    const v = verse ? `${esc(cfg.bookName)} ${esc(cfg.ch)}:${esc(verse)}` : `${esc(cfg.bookName)} ${esc(cfg.ch)}`;
    const find = `<li class="vr-find" role="presentation"><input type="search" placeholder="Find a commentator or work" aria-label="Find a commentary on ${esc(cfg.bookName)} ${esc(cfg.ch)}" autocomplete="off" spellcheck="false"></li>`;
    const body = group(`Notes on ${v}`, onVerse, {}) + group(`On ${esc(cfg.bookName)} ${esc(cfg.ch)}`, onChapter, {}) + group("On the whole Bible", wholeRows, { flat: true })
      + (citedRows.length ? `<li class="vr-h vr-h-fold" role="presentation"><button type="button" class="vr-fold" aria-expanded="false">Also cite this chapter<small>${citedRows.length} ${citedRows.length === 1 ? "author" : "authors"}</small></button></li>`
        + `<li class="vr-folded" role="presentation" hidden><ul role="group" aria-label="Works on other books that cite this chapter">${citedRows.map(citedLi).join("")}</ul></li>` : "");
    return find + (body || `<li class="vr-h" role="presentation">No commentary on this chapter yet</li>`);
  }

  // the picker's own behaviour: the find box filters, the folded group opens, an author's volumes unfold
  function wirePicker(list) {
    if (list.dataset.vrWired) return; list.dataset.vrWired = "1";
    list.addEventListener("input", (e) => {
      const box = e.target.closest(".vr-find input"); if (!box) return;
      const q = box.value.trim().toLowerCase();
      const folded = list.querySelector(".vr-folded"), fold = list.querySelector(".vr-fold");
      if (q && folded) { folded.hidden = false; if (fold) fold.setAttribute("aria-expanded", "true"); }
      list.querySelectorAll("[data-slug]").forEach((li) => { li.hidden = q ? !(li.dataset.find || "").includes(q) : li.classList.contains("vr-vol"); });
      list.querySelectorAll(".vr-h, .vr-trad").forEach((h) => {
        let el = h.nextElementSibling, any = false;
        while (el && !el.classList.contains("vr-h") && !(h.classList.contains("vr-trad") && el.classList.contains("vr-trad"))) { if (el.matches("[data-slug]") && !el.hidden) { any = true; break; } el = el.nextElementSibling; }
        h.hidden = q ? !any : false;
      });
    });
    list.addEventListener("click", (e) => {
      const fold = e.target.closest(".vr-fold");
      if (fold) { e.stopPropagation(); const box = list.querySelector(".vr-folded"), open = fold.getAttribute("aria-expanded") !== "true"; fold.setAttribute("aria-expanded", String(open)); if (box) box.hidden = !open; return; }
      const vols = e.target.closest(".vr-vols");
      if (vols) {
        e.stopPropagation(); const open = vols.getAttribute("aria-expanded") !== "true"; vols.setAttribute("aria-expanded", String(open));
        let el = vols.closest("li").nextElementSibling;
        while (el && el.classList.contains("vr-vol")) { el.hidden = !open; el = el.nextElementSibling; }
      }
    });
    list.addEventListener("keydown", (e) => { if (e.key === "Escape" && e.target.closest(".vr-find")) { e.target.value = ""; e.target.dispatchEvent(new Event("input", { bubbles: true })); } });
    const box = list.querySelector(".vr-find input"); if (box) box.addEventListener("click", (e) => e.stopPropagation());
  }

  // ── the directory: every commentary on the chapter, by tradition, then author, then work ──────────────────────────────────
  /* (2026-10-21, owner: "need to be able to click into all chapter and whole bible commentaries seamlessly, and every should be
   * collapsed by tradition author expandable and previewable"). Replaces the picker in both panes. One entry a work: the volumes of
   * one set (one author with one title, or one slug stem before a volume number: Denys's tomes, Poole's Synopsis, Salmeron's
   * eleven) fold under it, the volume with the verse's note (else the chapter's page) leading. The traditions in the lists' order,
   * each shut with its count; inside, the authors in the order they wrote; an author with one work is one row, an author with more
   * is shut with his count. Each work: the row reads it beside the text, its page opens in the reader, Preview opens its note on the
   * verse (or its chapter's page) under the row, fetched the first time (on.preview). The works on other books that cite the
   * chapter are one more group, last.
   * rows: the pane's S.list entries {slug, a, t, vol, notes {v: p}, open, hit, sh, wb (0 on the book, 1 a set on the whole Bible,
   * 2 a work on another book citing the chapter), score, born}.
   * cfg: {cur, verse, ch, bookName, tradOf(c), when(c), rankOf(slug, a), volShort(t), read(slug, p), pg(slug, p), volOf(slug),
   * open: Set of the groups the reader has opened ("t:gf", "a:<author key>")}. */
  const foldText = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const authorKey = (a) => foldText(properName(a)).replace(/[^a-z0-9]+/g, " ").trim();
  const VOL_WORDS = /[\s.,:;(]*\b(?:vol(?:ume)?|tom(?:e|us)?|pars|part|band)\.?\s*[ivxlc\d]+\b.*$/i;
  const titleKey = (t) => foldText(t).replace(VOL_WORDS, "").replace(/[^a-z0-9]+/g, " ").trim();
  const ORDINALS = ["primus", "secundus", "tertius", "quartus", "quintus", "sextus", "septimus", "octavus", "nonus", "decimus", "undecimus", "duodecimus"];
  const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  const VOL_SLUG = new RegExp(`-(?:(?:vol|tom|tomus|pars|part|band)-[a-z0-9]+(?:-.*)?|${ORDINALS.join("|")})$`);
  const stemOf = (slug) => (VOL_SLUG.test(slug) ? String(slug).replace(VOL_SLUG, "") : "");
  // a volume's label from its slug where nothing else names it: "-vol-15" Vol. 15, "-tom-iv-gospels" Tom. IV, "-quintus" Tom. V
  const slugVolume = (slug) => {
    const m = /-(vol|tom|tomus|pars|part|band)-([a-z0-9]+)/.exec(slug);
    if (m) { const n = /^[ivxlc]+$/.test(m[2]) ? m[2].toUpperCase() : m[2]; return `${{ vol: "Vol.", tom: "Tom.", tomus: "Tom.", pars: "Part", part: "Part", band: "Vol." }[m[1]]} ${n}`; }
    const o = ORDINALS.findIndex((x) => String(slug).endsWith(`-${x}`));
    return o >= 0 ? `Tom. ${ROMAN[o]}` : "";
  };
  // the collected volume holding a piece is named by the piece; the rest by their title, or by their slug's stem
  const workKey = (c) => `${authorKey(c.a) || c.slug}|${c.vol ? `p:${titleKey(c.t)}` : stemOf(c.slug) ? `s:${stemOf(c.slug)}` : `t:${titleKey(c.t)}`}`;
  const notedOn = (c, v) => !!(v && c.notes && Object.prototype.hasOwnProperty.call(c.notes, String(v)));
  // how far back the volume's nearest note before the verse is (0 its note on the verse; Infinity none)
  const backTo = (c, v) => {
    if (notedOn(c, v)) return 0;
    const ks = Object.keys(c.notes || {}).map(Number).filter((x) => x > 0 && x < v);
    return ks.length ? v - Math.max(...ks) : Infinity;
  };
  // (10-22) a row's page is where its Read opens: the host's own place for the verse (cfg.place, the pane's), else the same order
  // reckoned here: the note on the verse, the nearest note before, the chapter's page, the first note, the book's first page
  const pageFor = (c, v, cfg) => {
    if (cfg && cfg.place) { const t = cfg.place(c, v); return t ? t.p : null; }
    if (notedOn(c, v)) return c.notes[String(v)];
    const ks = Object.keys(c.notes || {}).map(Number).filter((x) => x > 0).sort((p, q) => p - q), prev = ks.filter((x) => x < v).pop();
    if (prev != null) return c.notes[String(prev)];
    if (c.open != null) return c.open;
    if (ks.length) return c.notes[String(ks[0])];
    return c.bookAt != null ? c.bookAt : null;
  };
  let dirSeq = 0;

  /* THE DIRECTORY BY KIND, IN CURATED ORDER (10-22, owner: "make sure we collect everything rank it properly"). Five groups, each shut
   * with its count: the key commentaries on the book (rank.json `books`, the curated keys, in their order); the other commentaries on
   * the book (curated standing, rank.json, then the order they wrote); the sets on the whole Bible (their curated order, then date); the
   * homilies and sermons on the passage, by period (the Reception view's periods, by the author's working years), those with a sermon
   * on the verse in view first, then standing; the works on other books that cite the chapter. One row an author with his works and
   * volumes nested, his tradition said on the row. A series of homilies through the book (Chrysostom on Matthew, Augustine's Tractates
   * on John) is a commentary, as the pane weighs it: only what the host marks c.kd "sermons" is filed with the sermons; any work may
   * carry its sermons on the passage (c.ser), listed under its row.
   * rows: the pane's list; cfg.keyOrder: the book's curated key slugs in order. A work the map files under the book with no page for the
   * chapter is on the hits as own: listed here as a commentary where its page is the chapter's own (c.treats), else with the citations,
   * whose group is now "Cited in commentaries on other passages" (other books, and other chapters of this one). */
  const ERA_SPANS = [["fathers", 600], ["early-medieval", 1100], ["scholastic", 1500], ["reformation", 1600], ["17th", 1700], ["18th", 1800], ["modern", 1e9]];
  const ERA_LABEL = { ...ERA_NAME, undated: "Undated" };
  const eraOfYear = (y) => (y && y < 9000 ? (ERA_SPANS.find(([, end]) => y < end) || ERA_SPANS[ERA_SPANS.length - 1])[0] : "undated");
  // the periods in order, the undated last
  const eraIndex = (k) => { const i = ERA_SPANS.findIndex(([x]) => x === k); return i < 0 ? ERA_SPANS.length : i; };
  const kindOf = (c) => (c.wb === 2 ? "cited" : c.kd === "sermons" ? "sermons" : c.wb === 1 ? "whole" : "book");
  // the sermons of a work on the passage, the one on the verse first
  const sermonsOf = (c, v) => (c.ser || []).slice().sort((p, q) => (onVerse(q, v) ? 1 : 0) - (onVerse(p, v) ? 1 : 0) || Number(p.p) - Number(q.p));
  const onVerse = (x, v) => !!(v && x.v1 && !x.vul && x.v1 <= v && v <= (x.v2 || x.v1));
  // what the sermons are called by their own headings: "Homily I …" a homily, "Tractate …" a tractate; else a sermon
  const SER_WORDS = [["homil", "homily", "homilies"], ["tract", "tractate", "tractates"], ["discourse", "discourse", "discourses"], ["lecture", "lecture", "lectures"], ["oration", "oration", "orations"]];
  const serWord = (xs, many) => {
    const w = SER_WORDS.find(([k]) => xs.length && xs.every((x) => String(x.t || "").toLowerCase().startsWith(k)));
    return w ? (many ? w[2] : w[1]) : many ? "sermons" : "sermon";
  };
  function directoryModel(rows, cfg) {
    const v = cfg.verse || 0, by = new Map(), keyAt = new Map((cfg.keyOrder || []).map((s, i) => [s, i]));
    for (const c of rows || []) { const kd = kindOf(c), k = `${workKey(c)}|${kd}`; if (!by.has(k)) by.set(k, { key: k, vols: [], kind: kd }); by.get(k).vols.push(c); }
    const ws = [...by.values()];
    const has = (c) => (Object.keys(c.notes || {}).length ? 1 : 0);
    for (const w of ws) {
      // the volume that leads is the one the pane opens for the verse: its note on it, else the nearest note before, then the chapter's
      // page, any notes in the chapter, standing
      w.vols.sort((p, q) => backTo(p, v) - backTo(q, v) || (q.open != null ? 1 : 0) - (p.open != null ? 1 : 0) || has(q) - has(p) || (q.score || 0) - (p.score || 0));
      w.main = w.vols[0];
      w.wb = Math.min(...w.vols.map((c) => (c.wb == null ? 0 : c.wb)));
      w.keyAt = Math.min(...w.vols.map((c) => (keyAt.has(c.slug) ? keyAt.get(c.slug) : Infinity)));
      // a curated key is a key whatever else it is (a series of homilies, a set on the whole Bible); never a work on another book
      if (w.keyAt < Infinity && w.kind !== "cited") w.kind = "keys";
      w.onV = w.vols.some((c) => notedOn(c, v) || (c.ser || []).some((x) => onVerse(x, v)));
    }
    const authors = (list) => {
      const am = new Map();
      for (const w of list) { const k = authorKey(w.main.a) || w.main.slug; if (!am.has(k)) am.set(k, { key: k, name: properName(w.main.a) || w.main.t, works: [] }); am.get(k).works.push(w); }
      for (const au of am.values()) {
        au.works.sort((p, q) => (notedOn(q.main, v) ? 1 : 0) - (notedOn(p.main, v) ? 1 : 0) || p.keyAt - q.keyAt || (q.main.score || 0) - (p.main.score || 0) || String(p.main.t).localeCompare(String(q.main.t)));
        // an author is said once to be of the tradition most of his works are filed under, a named one before "Other"
        const n = new Map();
        for (const w of au.works) { const t = cfg.tradOf(w.main) || "x"; n.set(t, (n.get(t) || 0) + (t === "x" ? 0.5 : 1)); }
        au.trad = [...n.entries()].sort((p, q) => q[1] - p[1] || tradIndex(p[0]) - tradIndex(q[0]))[0][0];
        au.when = Math.min(...au.works.map((w) => cfg.when(w.main) || 9999));
        au.rank = Math.min(...au.works.map((w) => cfg.rankOf(w.main.slug, w.main.a)));
        au.keyAt = Math.min(...au.works.map((w) => w.keyAt));
        au.era = eraOfYear(au.when);
        au.onV = au.works.some((w) => w.onV);
      }
      return [...am.values()];
    };
    const byName = (p, q) => p.name.localeCompare(q.name);
    const ORDER = {
      keys: (p, q) => p.keyAt - q.keyAt || p.when - q.when,
      book: (p, q) => p.rank - q.rank || p.when - q.when || byName(p, q),
      whole: (p, q) => p.rank - q.rank || p.when - q.when || byName(p, q),
      sermons: (p, q) => eraIndex(p.era) - eraIndex(q.era) || (q.onV ? 1 : 0) - (p.onV ? 1 : 0) || p.rank - q.rank || p.when - q.when || byName(p, q),
      cited: (p, q) => p.rank - q.rank || byName(p, q),
    };
    const book = cfg.bookName === "Psalm" ? "the Psalms" : cfg.bookName || "the book", ref = `${cfg.bookName || ""} ${cfg.ch || ""}`.trim();
    const NAMES = { keys: `Key commentaries on ${book}`, book: `Commentaries on ${book}`, whole: "Whole-Bible commentaries", sermons: `Homilies and sermons on ${ref}`, cited: "Cited in commentaries on other passages" };
    const groups = ["keys", "book", "whole", "sermons", "cited"].map((k) => ({ key: k, name: NAMES[k], authors: authors(ws.filter((w) => w.kind === k)).sort(ORDER[k]) }))
      .filter((g) => g.authors.length);
    for (const g of groups) {
      if (g.key !== "sermons") continue;
      g.eras = [];
      for (const au of g.authors) { let e = g.eras[g.eras.length - 1]; if (!e || e.key !== au.era) { e = { key: au.era, name: ERA_LABEL[au.era] || "Undated", authors: [] }; g.eras.push(e); } e.authors.push(au); }
    }
    const count = (gs) => gs.reduce((n, g) => n + g.authors.reduce((k, au) => k + au.works.length, 0), 0);
    const sermonCount = (gs) => gs.filter((g) => g.key === "sermons").reduce((n, g) => n + g.authors.reduce((k, au) => k + au.works.reduce((m, w) => m + Math.max(1, (w.main.ser || []).length), 0), 0), 0);
    const main = groups.filter((g) => g.key !== "cited");
    return { groups, cited: [], works: count(main.filter((g) => g.key !== "sermons")), sermons: sermonCount(main), citedWorks: count(groups.filter((g) => g.key === "cited")) };
  }

  function directory(rows, cfg) {
    const m = directoryModel(rows, cfg), v = cfg.verse || 0, open = cfg.open || new Set();
    const pg = cfg.pg || ((slug, p) => `p. ${p}`);
    const ref = `${cfg.bookName || ""} ${cfg.ch}`.trim();
    // what the work holds for the verse in view
    const meta = (w) => {
      const c = w.main, bits = [];
      if (w.wb === 2) bits.push(c.hit && c.hit.v && c.hit.v.length ? `Cites ${cfg.ch}:${c.hit.v.slice(0, 4).join(", ")}${c.hit.v.length > 4 ? " and more" : ""}` : `Cites chapter ${cfg.ch}`);
      else if (w.kind === "sermons" && (c.ser || []).length) {
        const ons = c.ser.filter((x) => onVerse(x, v)), on = ons.length, n = c.ser.length;
        const one = serWord(on ? ons : c.ser, false), many = serWord(c.ser, true);
        bits.push(on ? `${on === n && n === 1 ? `${one[0].toUpperCase()}${one.slice(1)}` : `${on} of ${n} ${many}`} on ${cfg.ch}:${v}` : `${n} ${n === 1 ? one : many} on ${ref}`);
      }
      else if (notedOn(c, v)) bits.push(`Note on ${cfg.ch}:${v}`);
      // (10-22) a work the map files under the book with no page for the chapter, whose page here is the chapter's own
      else if (c.treats && !Object.keys(c.notes || {}).length) bits.push(`Treats this chapter${c.hit && c.hit.v && c.hit.v.length ? ` (${cfg.ch}:${c.hit.v.slice(0, 4).join(", ")})` : ""}`);
      else {
        // its notes elsewhere in the chapter: the verses themselves when they are few ("Notes on 1:18, 20"), else how many
        const vs = Object.keys(c.notes || {}).map(Number).filter((x) => x > 0).sort((p, q) => p - q), n = vs.length;
        // a set whose map knows only where the book begins (10-22) says so, not "On chapter 51"
        bits.push(!n && c.open == null && c.bookAt != null ? `Chapter ${cfg.ch} not mapped` : !n ? `On chapter ${cfg.ch}` : n <= 3 ? `${n === 1 ? "Note" : "Notes"} on ${cfg.ch}:${vs.join(", ")}` : `Notes on ${n} verses of chapter ${cfg.ch}`);
      }
      if (w.wb === 1) bits.push("whole Bible");
      return bits.join(DOT);
    };
    // a volume's name: the catalogue's, the collected edition's ("WA 38"), the slug's ("Tom. XII"), else its title's ("Vol. II")
    const titleVolume = (t) => { const x = /\b(Vol(?:ume)?|Tom(?:us)?)\.?\s+([IVXLC]+|\d+)\b/.exec(String(t || "")); return x ? `${/^T/.test(x[1]) ? "Tom." : "Vol."} ${x[2]}` : ""; };
    const volName = (c) => (cfg.volOf && cfg.volOf(c.slug)) || cfg.volShort(c.vol) || slugVolume(c.slug) || titleVolume(c.t) || "";
    // a heading in English, the printed one (Latin, German …) in the title attribute
    const orig = (x) => (x && x.tl && x.tl !== x.t ? ` title="${esc(x.tl)}"` : "");
    // the sermons of a work on the passage, each with its heading, the verses it is on and its page
    const sermons = (c) => {
      const xs = sermonsOf(c, v); if (!xs.length) return "";
      return `<ul class="vr-gl vr-ser">${xs.slice(0, 12).map((x) => `<li><a href="${esc(cfg.read(c.slug, x.p))}">${esc(pg(c.slug, x.p))}</a> <span${orig(x)}>${esc(x.t)}</span>`
        + `${x.ref ? `${DOT}<span class="vr-k">${esc(x.vul ? `${x.ref} (Vulgate count)` : x.ref)}</span>` : ""}</li>`).join("")}${xs.length > 12 ? `<li class="vr-k">and ${fmt(xs.length - 12)} more</li>` : ""}</ul>`;
    };
    const entry = (w, au, solo) => {
      const c = w.main, p = pageFor(c, v, cfg), id = `vr-pv-${++dirSeq}`;
      const cur = w.vols.some((x) => x.slug === cfg.cur);
      const vol = w.vols.length > 1 ? "" : volName(c);
      const find = foldText(`${au.name} ${c.a || ""} ${w.vols.map((x) => `${x.t || ""} ${x.tl || ""} ${volName(x)} ${(x.ser || []).map((y) => `${y.t} ${y.tl || ""}`).join(" ")}`).join(" ")}`);
      const vols = w.vols.length > 1 ? `<p class="vr-e-vols"><span>${w.vols.length} volumes</span>${w.vols.map((x) => {
        const q = pageFor(x, v, cfg), label = volName(x) || (q != null ? pg(x.slug, q) : x.t);
        return `<button type="button" class="vr-e-vol" data-vr-read="${esc(x.slug)}"${x.slug === cfg.cur ? ' aria-current="true"' : ""} aria-label="${esc(`Read ${label} beside the text`)}">${esc(label)}</button>`;
      }).join("")}</p>` : "";
      const trad = solo && TRAD_NAME[au.trad] && au.trad !== "x" ? `<span class="vr-k">${esc(TRAD_NAME[au.trad])}</span>` : "";
      return `<li class="vr-e${solo ? " vr-e-solo" : ""}${cur ? " is-cur" : ""}" data-find="${esc(find)}">`
        + `<div class="vr-e-row"><button type="button" class="vr-e-read" data-vr-read="${esc(c.slug)}"${cur ? ' aria-current="true"' : ""}>`
        + `${solo ? `<span class="vr-a">${esc(au.name)}</span>` : ""}<span class="vr-e-t"${orig(c)}>${esc(c.t)}${vol ? `${DOT}${esc(vol)}` : ""}</span><span class="vr-e-m">${esc(meta(w))}${trad ? DOT : ""}${trad}</span></button>`
        + `${p != null ? `<a class="vr-e-pg" href="${esc(cfg.read(c.slug, p))}" aria-label="${esc(`${c.t}, ${pg(c.slug, p)}, in the reader`)}">${esc(pg(c.slug, p))}</a>` : "<span></span>"}`
        + `<button type="button" class="vr-e-pv" data-vr-preview="${esc(c.slug)}" data-vr-title="${esc(c.t)}" aria-expanded="false" aria-controls="${id}" aria-label="${esc(`Preview ${c.t}`)}">Preview</button></div>`
        + `${vols}${sermons(c)}<div class="vr-e-box" id="${id}" hidden></div></li>`;
    };
    const fold = (id, cls, head, n, body) => {
      const isOpen = open.has(id);
      return `<li class="${cls}"><button type="button" class="vr-fold-btn" data-vr-fold="${esc(id)}" aria-expanded="${isOpen}">${head}<span class="vr-fold-n">${esc(n)}</span></button>`
        + `<ul class="vr-fold-list"${isOpen ? "" : " hidden"}>${body}</ul></li>`;
    };
    const author = (au) => (au.works.length === 1 ? entry(au.works[0], au, true)
      : fold(`a:${au.key}`, "vr-au-g", `<span class="vr-a">${esc(au.name)}</span>${TRAD_NAME[au.trad] && au.trad !== "x" ? ` <span class="vr-k">${esc(TRAD_NAME[au.trad])}</span>` : ""}`, `${au.works.length} works`, au.works.map((w) => entry(w, au, false)).join("")));
    const nOf = (aus) => aus.reduce((k, au) => k + au.works.length, 0);
    const groups = m.groups.map((g) => {
      const body = g.eras ? g.eras.map((e) => fold(`e:${e.key}`, "vr-au-g vr-era-g", `<span class="vr-a">${esc(e.name)}</span>`, fmt(nOf(e.authors)), e.authors.map(author).join(""))).join("")
        : g.authors.map(author).join("");
      return fold(`g:${g.key}`, `vr-tg${g.key === "cited" ? " vr-tg-cited" : ""}`, `<span class="vr-tg-name">${esc(g.name)}</span>`, fmt(nOf(g.authors)), body);
    }).join("");
    const find = `<div class="vr-dir-find"><input type="search" placeholder="Find a commentator, preacher or work" aria-label="${esc(`Find a commentary or sermon on ${ref}`)}" autocomplete="off" spellcheck="false"></div>`;
    if (!m.groups.length) return `<div class="vr-dir"><p class="vr-empty">No commentary on ${esc(ref)} is in the library yet.</p></div>`;
    return `<div class="vr-dir">${find}<ul class="vr-dir-list">${groups}</ul><p class="vr-empty vr-dir-none" hidden>No commentary matches.</p></div>`;
  }

  /* HYMNS ON THE PASSAGE (10-22, owner: "have hymns be online in option too"): the hymns whose heading or opening names the chapter
   * (v1/scripture/preach/<book>.json, from the sermons page's index), those on the verse in view first, then by year; one row a hymn:
   * its English title (the printed one in the title attribute), the poet or book, the year, the passage and the page. cfg: {name, ch,
   * v, read(slug, p), pg(slug, p), all: the sermons page's hymns on the book (address), allLabel}. */
  function hymns(rows, cfg) {
    const v = cfg.verse || 0, pg = cfg.pg || ((slug, p) => `p. ${p}`);
    const xs = (rows || []).slice().sort((p, q) => (onVerse(q, v) ? 1 : 0) - (onVerse(p, v) ? 1 : 0) || (p.year || 9999) - (q.year || 9999) || String(p.a).localeCompare(String(q.a)));
    const li = (x) => `<li class="vr-row vr-wit"><p class="vr-line"><a class="vr-a" href="${esc(cfg.read(x.slug, x.p))}"${x.tl && x.tl !== x.t ? ` title="${esc(x.tl)}"` : ""}>${esc(x.t)}</a>${x.year ? ` <span class="vr-y">${esc(x.year)}</span>` : ""}`
      + `<span class="vr-what">${esc(properName(x.a) || "")}${x.ref ? `${DOT}${esc(x.vul ? `${x.ref} (Vulgate count)` : x.ref)}` : ""}${DOT}<a href="${esc(cfg.read(x.slug, x.p))}">${esc(pg(x.slug, x.p))}</a></span></p>`
      + `${x.first ? `<p class="vr-g">${esc(x.first)}</p>` : ""}</li>`;
    const on = xs.filter((x) => onVerse(x, v)), rest = xs.filter((x) => !onVerse(x, v));
    const head = `<header class="vr-rec-head"><h3>Hymns on ${esc(cfg.name)} ${esc(cfg.ch)}</h3><p class="vr-count"><b>${fmt(xs.length)}</b> ${xs.length === 1 ? "hymn" : "hymns"}${on.length ? `${DOT}<b>${fmt(on.length)}</b> on ${esc(cfg.ch)}:${esc(v)}` : ""}</p></header>`;
    return `${head}<section class="vr-sec"><ul class="vr-rows">${on.concat(rest).map(li).join("")}</ul></section>`
      + `${cfg.all ? `<p class="vr-foot"><a href="${esc(cfg.all)}">${esc(cfg.allLabel || "Every hymn on the book")}</a></p>` : ""}`;
  }

  // the find box over the directory: a match opens the groups that hold it (without forgetting which the reader opened)
  function filterDirectory(host, raw) {
    const q = foldText(String(raw || "").trim());
    host.querySelectorAll(".vr-e").forEach((li) => { li.hidden = !!q && !(li.dataset.find || "").includes(q); });
    const folds = [...host.querySelectorAll(".vr-au-g, .vr-tg")];
    // the innermost folds first (an author inside a period inside a group), then those holding them
    const depth = (el) => { let d = 0; for (let x = el.parentElement; x && x !== host; x = x.parentElement) if (x.classList.contains("vr-fold-list")) d += 1; return d; };
    for (const f of folds.map((el) => [depth(el), el]).sort((p, q2) => q2[0] - p[0]).map(([, el]) => el)) {
      const list = f.querySelector(":scope > .vr-fold-list"), btn = f.querySelector(":scope > .vr-fold-btn");
      const any = !!list.querySelector(":scope > .vr-e:not([hidden]), :scope > .vr-au-g:not([hidden])");
      f.hidden = !!q && !any;
      list.hidden = q ? !any : btn.getAttribute("aria-expanded") !== "true";
    }
    const none = host.querySelector(".vr-dir-none");
    if (none) none.hidden = !q || !!host.querySelector(".vr-dir-list > li:not([hidden])");
  }

  // the directory's behaviour: folds, the find box, Preview (on.preview(slug) -> HTML, fetched once), and reading a work beside the
  // text (on.read(slug)); on.fold(id, open) lets the host remember what is open
  function wireDirectory(host, on) {
    if (host.dataset.vrDirWired) return; host.dataset.vrDirWired = "1";
    host.addEventListener("input", (e) => { if (e.target.closest(".vr-dir-find input")) filterDirectory(host, e.target.value); });
    host.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && e.target.closest(".vr-dir-find input") && e.target.value) { e.stopPropagation(); e.target.value = ""; filterDirectory(host, ""); }
    });
    host.addEventListener("click", (e) => {
      const f = e.target.closest("[data-vr-fold]");
      if (f) {
        const open = f.getAttribute("aria-expanded") !== "true", list = f.parentElement.querySelector(":scope > .vr-fold-list");
        f.setAttribute("aria-expanded", String(open)); if (list) list.hidden = !open;
        if (on && on.fold) on.fold(f.dataset.vrFold, open);
        return;
      }
      const pv = e.target.closest("[data-vr-preview]");
      if (pv) {
        const box = host.querySelector(`#${pv.getAttribute("aria-controls")}`); if (!box) return;
        const open = pv.getAttribute("aria-expanded") !== "true";
        pv.setAttribute("aria-expanded", String(open)); box.hidden = !open;
        // the name says what the button now does, as its label does ("Close preview of …")
        pv.textContent = open ? "Close preview" : "Preview";
        pv.setAttribute("aria-label", `${open ? "Close preview of" : "Preview"} ${pv.dataset.vrTitle || ""}`.trim());
        if (open && !box.dataset.loaded && on && on.preview) {
          box.dataset.loaded = "1";
          box.innerHTML = '<p class="vr-pv-wait" role="status">Opening the page…</p>';
          Promise.resolve(on.preview(pv.dataset.vrPreview)).then((html) => { box.innerHTML = html || '<p class="vr-empty">Nothing on this page to show.</p>'; })
            .catch(() => { box.dataset.loaded = ""; box.innerHTML = '<p class="vr-empty">The page could not be opened. Close the preview and try again.</p>'; });
        }
        return;
      }
      const rd = e.target.closest("[data-vr-read]");
      if (rd && on && on.read) { e.preventDefault(); on.read(rd.dataset.vrRead); }
    });
  }

  // ── reception ────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const reception = {
    /* rv: the verse's record {works, strip, notes, eras}; notes: [{slug, p, a, t, sh}] already resolved; cfg: {name, ch, v, read,
     * rankOf, tradOf, keySet, era: {id: [label, years]}, more(eraId): the Citations view for that period} */
    head(rv, ns, cfg) {
      const strip = rv.strip || [], span = strip.length ? `${DOT}${ord(strip[0][0])} to ${ord(strip[strip.length - 1][0])} century` : "";
      return `<header class="vr-rec-head"><h3>${esc(cfg.name)} ${esc(cfg.ch)}:${esc(cfg.v)}</h3><p class="vr-count"><b>${fmt(rv.works)}</b> ${rv.works === 1 ? "work cites it" : "works cite it"}`
        + `${ns.length ? `${DOT}<b>${fmt(ns.length)}</b> ${ns.length === 1 ? "expounds it" : "expound it"}` : ""}${span}</p></header>`;
    },
    strip(strip) {
      if (!strip || strip.length < 2) return "";
      const max = Math.max(...strip.map(([, k]) => k)), by = new Map(strip), cols = [];
      for (let c = strip[0][0]; c <= strip[strip.length - 1][0]; c += 1) {
        const k = by.get(c) || 0, tip = `${ord(c)} century: ${fmt(k)} ${k === 1 ? "work" : "works"}`;
        cols.push(`<li${k ? "" : ' class="is-zero"'} style="--k:${k ? Math.max(0.08, Math.sqrt(k / max)).toFixed(3) : 0}" title="${tip}"><span class="cp-bar"></span><small aria-hidden="true">${c}</small><span class="cp-sr">${tip}</span></li>`);
      }
      return `<figure class="cp-rec-strip vr-strip"><ol>${cols.join("")}</ol><figcaption>Works citing it, by century</figcaption></figure>`;
    },
    // the commentaries with a note on the verse: each author once (his key work), keys first in the order they wrote, then by tradition
    notes(ns, cfg) {
      if (!ns.length) return "";
      const by = new Map();
      for (const c of ns) { const k = c.a || c.slug; if (!by.has(k) || (cfg.keySet.has(c.slug) && !cfg.keySet.has(by.get(k).slug))) by.set(k, c); }
      const keyAt = (c) => cfg.keyOrder ? cfg.keyOrder.indexOf(c.slug) : 0;
      const rows = [...by.values()].sort((p, q) => {
        const kp = cfg.keySet.has(p.slug), kq = cfg.keySet.has(q.slug);
        if (kp !== kq) return kp ? -1 : 1;
        if (kp && kq) return keyAt(p) - keyAt(q);
        return tradIndex(cfg.tradOf(p)) - tradIndex(cfg.tradOf(q)) || cfg.rankOf(p.slug, p.a) - cfg.rankOf(q.slug, q.a) || (p.a || "").localeCompare(q.a || "");
      });
      let last = null, out = "";
      for (const c of rows) {
        const t = cfg.keySet.has(c.slug) ? "key" : cfg.tradOf(c);
        if (t !== last && rows.length > 6) { out += `<li class="vr-trad" role="presentation">${esc(t === "key" ? "Key commentaries" : TRAD_NAME[t] || "Other")}</li>`; last = t; }
        out += `<li class="vr-row"><button type="button" class="vr-open" data-cp-open="${esc(c.slug)}" data-cp-p="${esc(c.p)}" title="Read the note beside the text"><span class="vr-a">${esc(properName(c.a) || c.t)}</span><span class="vr-t">${esc(c.t)}</span></button>`
          + `<a class="vr-pg" href="${esc(cfg.read(c.slug, c.p))}" aria-label="${esc(`${c.a || c.t}, page ${c.p}, in the reader`)}">p. ${esc(c.p)}</a></li>`;
      }
      return `<section class="vr-sec"><h4>Commentaries on this verse<small>${rows.length}</small></h4><ul class="vr-rows">${out}</ul></section>`;
    },
    // each period's witnesses by standing, six shown, the rest of the period in Citations; the page's gist behind the row
    eras(eras, cfg) {
      const SHOW = cfg.show || 6;
      const items = (eras || []).map((e) => {
        const [label, span] = (cfg.era && cfg.era[e.id]) || [e.label, ""];
        const xs = (e.top || []).slice().sort((p, q) => cfg.rankOf(p.w, p.a) - cfg.rankOf(q.w, q.a) || (p.y || 9999) - (q.y || 9999));
        const rows = xs.map((x, j) => {
          const g = gist(x.g && !(x.commentary && x.how === "exegesis") ? x.g : "");
          return `<li class="vr-row vr-wit"${j >= SHOW ? " hidden" : ""}><p class="vr-line"><a class="vr-a" href="${esc(cfg.read(x.w, x.p))}">${esc(properName(x.a) || x.w)}</a>${years(x) ? ` <span class="vr-y">${esc(years(x))}</span>` : ""}`
            + `<span class="vr-what"><cite>${esc(x.t || "")}</cite>, <a href="${esc(cfg.read(x.w, x.p))}">p. ${esc(x.p)}</a>${DOT}${esc(VERB[x.how] || "cites it")}</span>`
            + `${g ? `<button type="button" class="vr-gbtn" aria-expanded="false" aria-label="What the page says">gist</button>` : ""}${pvBtn(x.w, x.p, x.t)}</p>${g ? `<p class="vr-g" hidden>${esc(g)}</p>` : ""}<div class="vr-wpvw" hidden></div></li>`;
        }).join("");
        const rest = Math.max(0, xs.length - SHOW), more = Number(e.more || 0);
        return `<li class="vr-era"><h5>${esc(label)}<small>${span ? `${esc(span)}${DOT}` : ""}${fmt(e.works)} ${e.works === 1 ? "work" : "works"}</small></h5><ul class="vr-rows">${rows}</ul>`
          + `<p class="vr-era-foot">${rest ? `<button type="button" class="vr-more">Show ${fmt(rest)} more</button>` : ""}${more ? `<button type="button" class="vr-all" data-era="${esc(e.id)}">All ${fmt(e.works)} in Citations</button>` : ""}</p></li>`;
      }).join("");
      return items ? `<section class="vr-sec"><h4>Through the centuries</h4><ol class="vr-eras">${items}</ol></section>` : "";
    },
    foot(text) { return `<p class="vr-foot">${esc(text)}</p>`; },
  };

  // ── citations, by author ─────────────────────────────────────────────────────────────────────────────────────────────────
  /* rows: the chapter file's rows for the verse {a, e, sh, w, t, how, p, g}; cfg: {read, rankAuthor(a, w), tradOf(row), state
   * {trad, kind}, open: Set of authors whose pages are shown}. */
  function citations(rows, cfg) {
    const st = cfg.state || {}, rankAuthor = cfg.rankAuthor || standing, tradOf = cfg.tradOf || ((r) => r.sh || "");
    const codes = st.era && ERA_CODES[st.era], eraOf = cfg.eraOf || ((r) => r.e || "U");
    const all = rows; rows = codes ? rows.filter((r) => codes.includes(eraOf(r))) : rows;
    const by = new Map();
    for (const r of rows) { const k = r.a || r.w; if (!by.has(k)) by.set(k, { a: k, rows: [], trads: new Set(), kinds: {} }); const g = by.get(k); g.rows.push(r); g.trads.add(tradOf(r)); g.kinds[r.how] = (g.kinds[r.how] || 0) + 1; }
    const groups = [...by.values()];
    const tradCount = {}, kindCount = {};
    for (const g of groups) { for (const t of g.trads) tradCount[t] = (tradCount[t] || 0) + 1; for (const [k, n] of Object.entries(g.kinds)) kindCount[k] = (kindCount[k] || 0) + n; }
    const shown = groups.filter((g) => (!st.trad || g.trads.has(st.trad)) && (!st.kind || g.kinds[st.kind]))
      .sort((p, q) => (p.kinds.exegesis ? 0 : 1) - (q.kinds.exegesis ? 0 : 1) || rankAuthor(p.a, p.rows[0].w) - rankAuthor(q.a, q.rows[0].w) || q.rows.length - p.rows.length || p.a.localeCompare(q.a));
    const chips = (name, counts, order, label, cur) => `<p class="vr-chips" role="group" aria-label="${label}"><button type="button" data-vr-${name}="" aria-pressed="${!cur}">All</button>${
       order.filter((k) => counts[k]).map((k) => `<button type="button" data-vr-${name}="${esc(k)}" aria-pressed="${cur === k}">${esc(name === "kind" ? KIND[k] : TRAD_NAME[k] || k)}<small>${fmt(counts[k])}</small></button>`).join("")}</p>`;
    const tradOrder = TRADS.map(([k]) => k).concat(Object.keys(tradCount).filter((k) => !TRADS.some(([t]) => t === k)));
    const authorRow = (g) => {
      const works = new Map();
      for (const r of g.rows.slice().sort((p, q) => KIND_ORDER.indexOf(p.how) - KIND_ORDER.indexOf(q.how) || Number(p.p) - Number(q.p))) { if (!works.has(r.w)) works.set(r.w, { t: r.t, rows: [] }); works.get(r.w).rows.push(r); }
      const kinds = KIND_ORDER.filter((k) => g.kinds[k]).map((k) => `${KIND[k]} ${fmt(g.kinds[k])}`).join(DOT);
      const first = g.rows[0], trad = [...g.trads].map((t) => TRAD_NAME[t]).filter(Boolean)[0] || "";
      const open = cfg.open && cfg.open.has(g.a);
      const pages = [...works.entries()].map(([w, x]) => `<li class="vr-work"><cite>${esc(x.t || w)}</cite> <span class="vr-pp">${x.rows.slice(0, 12).map((r) => `<a href="${esc(cfg.read(w, r.p))}" title="${esc(KIND[r.how] || "")}">${esc(r.p)}</a>`).join(" ")}${x.rows.length > 12 ? ` <span class="vr-k">+${x.rows.length - 12}</span>` : ""}</span>${pvBtn(w, x.rows[0].p, x.t || w)}`
        + `${x.rows.some((r) => r.g) ? `<ul class="vr-gl">${x.rows.filter((r) => r.g).slice(0, 6).map((r) => `<li><a href="${esc(cfg.read(w, r.p))}">p. ${esc(r.p)}</a> ${esc(gist(r.g))}</li>`).join("")}</ul>` : ""}<div class="vr-wpvw" hidden></div></li>`).join("");
      return `<li class="vr-row vr-au${open ? " is-open" : ""}" data-author="${esc(g.a)}"><button type="button" class="vr-aubtn" aria-expanded="${!!open}"><span class="vr-a">${esc(properName(g.a))}</span>`
        + `<span class="vr-meta">${[years(first), trad].filter(Boolean).map(esc).join(DOT)}</span><span class="vr-n">${fmt(g.rows.length)} ${g.rows.length === 1 ? "page" : "pages"}${kinds ? `${DOT}${kinds}` : ""}</span></button>`
        + `<ul class="vr-works"${open ? "" : " hidden"}>${pages}</ul></li>`;
    };
    const LIMIT = cfg.limit || 40, list = shown.slice(0, LIMIT);
    const period = codes ? `<p class="vr-period">${esc(ERA_NAME[st.era] || st.era)} only${DOT}<button type="button" data-vr-era="">Every period</button></p>` : "";
    return `<div class="vr-cit"><p class="vr-count"><b>${fmt(rows.length)}</b>${codes ? ` of ${fmt(all.length)}` : ""} ${rows.length === 1 ? "page" : "pages"} by <b>${fmt(groups.length)}</b> ${groups.length === 1 ? "author" : "authors"}</p>${period}${
       chips("trad", tradCount, tradOrder, "Tradition", st.trad)}${chips("kind", kindCount, KIND_ORDER, "Kind of citation", st.kind)
       }<ol class="vr-rows vr-authors">${list.map(authorRow).join("")}</ol>${shown.length > LIMIT ? `<button type="button" class="vr-more" data-vr-limit="${LIMIT + 40}">Show ${fmt(Math.min(40, shown.length - LIMIT))} more authors</button>` : ""}`
      + `${!shown.length ? '<p class="vr-empty">No citation of that kind in that tradition.</p>' : ""}</div>`;
  }

  /* READ IN PLACE (10-28, owner: "allow preview of citations/reception so a user can read inline"): a witness in the Reception view and
   * a work in the Citations view open their page under the row, English with the source a press away, earlier and later pages, the way
   * the commentaries' directory does (the pane's page reader, window.FRCommentaryText; where it is absent the page link stays the way) */
  function pvBtn(w, p, t) {
    if (p == null || p === "") return "";
    return `<button type="button" class="vr-gbtn vr-wpv" data-vr-wpv="${esc(w)}|${esc(p)}" aria-expanded="false" aria-label="${esc(`Preview ${t || w}, page ${p}`)}">Preview</button>`;
  }
  function wirePreview(b) {
    const li = b.closest("li"), box = li && li.querySelector(":scope > .vr-wpvw"); if (!box) return;
    const open = b.getAttribute("aria-expanded") !== "true";
    b.setAttribute("aria-expanded", String(open)); b.textContent = open ? "Close preview" : "Preview"; box.hidden = !open;
    if (!open) { box.innerHTML = ""; box.classList.remove("pw"); return; }
    const [slug, p] = b.dataset.vrWpv.split("|"), T = root.FRCommentaryText;
    box.innerHTML = '<p class="vr-pv-wait" role="status">Opening the page…</p>';
    (T && T.fill ? T.fill(box, { slug, page: p }).catch(() => false) : Promise.resolve(false)).then((ok) => {
      if (!ok && box.isConnected) { box.classList.remove("pw"); box.innerHTML = '<p class="vr-empty">This page cannot be shown here: the page number opens it in the reader.</p>'; }
    });
  }
  // the rail's shared behaviour inside a rendered block: gist toggles, Show more, author rows, Preview in place; chips and "all in
  // Citations" are the host's
  function wire(host, on) {
    if (host.dataset.vrWired) return; host.dataset.vrWired = "1";
    host.addEventListener("click", (e) => {
      const wp = e.target.closest(".vr-wpv");
      if (wp) { e.preventDefault(); wirePreview(wp); return; }
      const g = e.target.closest(".vr-gbtn");
      if (g) { const p = g.closest("li").querySelector(".vr-g"), open = g.getAttribute("aria-expanded") !== "true"; g.setAttribute("aria-expanded", String(open)); if (p) p.hidden = !open; return; }
      const more = e.target.closest(".vr-more");
      if (more && !more.dataset.vrLimit) { more.closest(".vr-era, .vr-cit").querySelectorAll("li[hidden]").forEach((li) => { li.hidden = false; }); more.remove(); return; }
      const au = e.target.closest(".vr-aubtn");
      if (au) { const li = au.closest(".vr-au"), ul = li.querySelector(".vr-works"), open = au.getAttribute("aria-expanded") !== "true"; au.setAttribute("aria-expanded", String(open)); ul.hidden = !open; li.classList.toggle("is-open", open); if (on && on.author) on.author(li.dataset.author, open); return; }
      const all = e.target.closest(".vr-all");
      if (all && on && on.era) { on.era(all.dataset.era); return; }
      const chip = e.target.closest("[data-vr-trad], [data-vr-kind], [data-vr-limit], [data-vr-era]");
      if (chip && on && on.filter) on.filter(chip.dataset.vrTrad !== undefined ? { trad: chip.dataset.vrTrad } : chip.dataset.vrKind !== undefined ? { kind: chip.dataset.vrKind } : chip.dataset.vrEra !== undefined ? { era: chip.dataset.vrEra } : { limit: +chip.dataset.vrLimit });
    });
  }

  root.FRVerseRail = { picker, wirePicker, directory, directoryModel, wireDirectory, filterDirectory, authorKey, workKey, slugVolume, reception, citations, hymns, eraOfYear, wire, loadRank, standing, properName, RANK, ERA_CODES, ERA_NAME, TRADS, TRAD_NAME, KIND, VERB, esc, fmt, ord, gist };
})(typeof window === "undefined" ? globalThis : window);
