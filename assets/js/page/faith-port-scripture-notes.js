/* The passage's reception history and the commentaries that annotate it, on the Scripture reader and the Verse Desk.
 *   Reader (/the-faith-received/scripture/?ref=<book>.<chapter>[.<verse>], scripture-dev.js)
 *     chapter  in the overview beside the text (wide screens only, as the overview is): its key verses, then (after the
 *              most-cited verses) its reception history verse by verse (five, and the rest on a click);
 *     verse    under the panel's count: its reception history, century by century, with the pages, and its readings;
 *              then the commentaries with their own note on the verse, before the
 *              panel's commentary lists and citations; then the verses read with it, beside Similar passages.
 *   Desk (/the-faith-received/scripture/desk/?ref=<book>.<c>.<v>, scripture-dev-desk.js)
 *     the reception history as a section after the translations, the commentaries with a note on the verse above the
 *     commentary lists, and the verses read with it under Similar passages.
 * RECEPTION HISTORY, NOT A SUMMARY (2026-10-15, the owner: "How the library reads it is AI slop, this is reception
 * history"). The machine-written paragraph that opened the panel and the overview is gone; what is shown is the history:
 * which authors used the verse, in which centuries, and how, each with the pages it rests on.
 * Data: v1/enrich/scripture/<library slug>.json on the library worker (the book's lib slug: i-john for 1 John): the readings,
 * the verses read with it and the commentaries' notes (machine-written from the library's pages, every page link checked;
 * each block says so). A passage without notes shows nothing, and the page's own panels are left as they are.
 * THE HISTORY FROM THE PAGES THEMSELVES (2026-10-15, the owner: "go deep into curation and organization of reception history").
 * The machine-written periods misdated a fifth of their witnesses (20.7 % over 163,153: Aphraates, Eusebius and Athanasius under
 * "2nd-3rd centuries" for Romans 5:12). The history is now v1/reception/scripture/<lib>/<c>.json (runs/reception_1015/
 * reception.py): every page that cites the verse, dated by its author's life, in the same eras on every verse, each era with
 * its count of works and its leading witnesses, one per author, his best page for the verse first (a comment on it, a page
 * about it, then the plainest use), ranked by that, by commentaries on the book, and by how much the library cites him;
 * each with the page's own gist. No prose is written for it. It covers every cited verse (35,411), not only the 3,000 with notes.
 */
(function () {
  "use strict";

  const S = window.MOScriptureDev;
  if (!S) return;
  const $root = document.querySelector("[data-sd-reader]");
  const $desk = document.querySelector("[data-sd-desk]");
  if (!$root && !$desk) return;
  const BASE = window.__FR_BLOB_BASE__ || "https://mo-tfr-library.mo-podcast-feed.workers.dev";
  const { esc, fmt } = S;
  const cache = new Map();
  const bookFile = (book) => {
    if (!cache.has(book.lib)) {
      cache.set(book.lib, fetch(`${BASE}/v1/enrich/scripture/${encodeURIComponent(book.lib)}.json`, { credentials: "omit" })
        .then((r) => (r.ok ? r.json() : null)).catch(() => null));
    }
    return cache.get(book.lib);
  };
  const link = (w, p, label) => `<a href="${esc(S.sourceHref("", w, p))}">${esc(label)}</a>`;
  const recCache = new Map();
  const chapterReception = (book, c) => {
    const k = `${book.lib}/${c}`;
    if (!recCache.has(k)) {
      recCache.set(k, fetch(`${BASE}/v1/reception/scripture/${encodeURIComponent(book.lib)}/${c}.json`, { credentials: "omit" })
        .then((r) => (r.ok ? r.json() : null)).catch(() => null));
    }
    return recCache.get(k);
  };
  // the library's usual share of each century (every verse's citing works summed): a verse "stands out" where its own share is
  // half again as high or more (Matthew 26:26 and John 6:53 in the 11th century, Berengar; James 2:24 in the 16th)
  let baseline = null;
  const loadBaseline = () => baseline || (baseline = fetch(`${BASE}/v1/reception/scripture/_baseline.json`, { credentials: "omit" })
    .then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!d) return null;
      const m = new Map(d.centuries), total = d.centuries.reduce((a, [, n]) => a + n, 0);
      const peak = d.centuries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
      return { share: (c) => (m.get(c) || 0) / total, peak };
    }).catch(() => null));
  // the centuries where the verse is cited half again above the library's usual share, the strongest first (at most three)
  function outliers(x, base) {
    if (!base) return [];
    const out = [];
    for (const [c, n] of x.strip || []) {
      if (n < Math.max(3, 0.02 * x.works) || !base.share(c)) continue;
      const r = n / x.works / base.share(c);
      if (r >= 1.5) out.push([c, r]);
    }
    return out.sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => c);
  }
  const standsOut = (x, base) => outliers(x, base)[0] || null;
  const ord = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th")}`;
  const and = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
  // How the page uses the verse, in the site's one vocabulary (scripture-kinds.js: quotes, cites, alludes, expounds)
  const kindOf = (h) => {
    const K = window.FRScriptureKind;
    const v = K ? K.verb(h) : ({ quotation: "quotes", explicit: "cites", allusion: "alludes", exegesis: "expounds" }[h] || "cites");
    return v === "alludes" ? "alludes to it" : `${v} it`;
  };
  /* The eras by name for a reader who does not know the periods, with their years (the files carry the ids). */
  const ERA = {
    fathers: ["Early church", "to 600"], "early-medieval": ["Early Middle Ages", "600–1100"],
    scholastic: ["High and late Middle Ages", "1100–1500"], reformation: ["Reformation", "1500–1600"],
    "17th": ["Seventeenth century", "1600–1700"], "18th": ["Eighteenth century", "1700–1800"], modern: ["Modern era", "since 1800"],
  };
  const eraName = (e) => ERA[e.id] || [e.label, ""];
  // the author's life as the catalogue gives it ("c. 185–c. 254"), else the year the history dates him by
  const life = (x) => x.d || (x.y ? `fl. c. ${x.y}` : "");
  const REC_NOTE = "From every page in the library that cites the verse, dated by its author's life.";
  /* The century strip: works citing the verse in each century, the busiest at full height. */
  /* The century strip: works citing the verse in each century, the busiest at full height, the centuries where it is cited more
   * than the library's usual share in the accent colour; a sentence above says what the bars show. */
  function receptionStrip(rv, base) {
    const s = rv.strip || [];
    if (s.length < 2) return "";
    const max = Math.max(...s.map(([, n]) => n));
    const lo = s[0][0], hi = s[s.length - 1][0], by = new Map(s);
    const outs = outliers(rv, base), isOut = new Set(outs);
    const cols = [];
    for (let c = lo; c <= hi; c += 1) {
      const n = by.get(c) || 0;
      const tip = `${ord(c)} century: ${fmt(n)} ${n === 1 ? "work" : "works"}${isOut.has(c) ? ", more than usual" : ""}`;
      // square-root heights: the 17th century's hundreds must not flatten the Fathers' handful (the label says how many)
      cols.push(`<li${isOut.has(c) ? ' class="is-out"' : ""} style="--k:${n ? Math.max(0.06, Math.sqrt(n / max)).toFixed(3) : 0}" title="${tip}"><span class="fr-rh-bar" aria-hidden="true"></span><span class="fr-rh-c" aria-hidden="true">${c}</span><span class="fr-rh-sr">${tip}</span></li>`);
    }
    const lede = `${fmt(rv.works)} ${rv.works === 1 ? "work cites" : "works cite"} it, from the ${ord(lo)} century to the ${ord(hi)}${outs.length
      ? `; more often than usual in the ${and(outs.slice().sort((a, b) => a - b).map(ord))} ${outs.length > 1 ? "centuries" : "century"}` : ""}.`;
    const peak = base && base.peak;
    const cap = `Works citing it in each century.${peak ? ` The library holds the most from the ${ord(peak)} century, so that bar runs tall for most verses.` : ""}${outs.length > 1 ? " The coloured bars are the centuries where this verse is cited more than the library's usual share."
      : outs.length ? " The coloured bar is the century where this verse is cited more than the library's usual share." : ""}`;
    return `<p class="fr-rh-lede">${lede}</p><figure class="fr-rh-strip-wrap"><ol class="fr-rh-strip">${cols.join("")}</ol><figcaption class="sd-muted">${cap}</figcaption></figure>`;
  }
  // the page's gist, ended at a word (the files keep 180 characters of it), the whole on hover
  const gist = (g) => {
    const t = String(g || "").trim();
    if (!t) return "";
    const cut = /[.!?)\]"'”’]$/.test(t) ? t : `${t.length >= 170 ? t.replace(/\s+\S*$/, "") : t}…`; // a gist cut short says so
    return `<p class="fr-rh-g" title="${esc(t)}">${esc(cut)}</p>`;
  };
  // A commentary's note on the verse says what it is ("expounds it"); any other use carries the page's gist, which says how.
  const witness = (x, hidden) => `<li${hidden ? " hidden" : ""}><p class="fr-rh-who">${link(x.w, x.p, x.a || x.w)}${life(x) ? ` <span class="fr-rh-y">${esc(life(x))}</span>` : ""}</p>
      <p class="fr-rh-what"><cite>${esc(x.t || "")}</cite>, ${link(x.w, x.p, `p. ${x.p}`)} · ${esc(kindOf(x.how))}</p>${x.commentary && x.how === "exegesis" ? "" : gist(x.g)}</li>`;
  /* The eras, oldest first; on the Desk beside a period column, in the panel one under another. */
  function receptionEras(rv, book, c, v, desk) {
    const eras = rv.eras || [];
    if (!eras.length) return "";
    const more = (e) => (e.more ? `<p class="fr-rh-more sd-muted">${fmt(e.more)} more ${e.more === 1 ? "author" : "authors"} in this period${desk
      ? ` in <a href="#sd-h-all">All citations</a>` : ` on the <a href="${esc(S.deskHref(book, c, v))}">Verse Desk</a>`}.</p>` : "");
    const count = (e) => `${fmt(e.works)} ${e.works === 1 ? "work" : "works"}`;
    // An era's leading four, three on a phone (the files rank them: the commentaries' notes and the other uses in turn), set oldest first so the
    // era reads as a history; the rest of its leading witnesses, also oldest first, on a click.
    const SHOW = window.matchMedia("(max-width: 640px)").matches ? 3 : 4; // a phone shows three, one under another
    const byYear = (a, b) => (a.y || 9999) - (b.y || 9999);
    const list = (e) => {
      const xs = e.top.slice(0, SHOW).sort(byYear).concat(e.top.slice(SHOW).sort(byYear));
      return `<ul class="fr-rh-wit">${xs.map((x, i) => witness(x, i >= SHOW)).join("")}</ul>${xs.length > SHOW
        ? `<button type="button" class="sd-commentary-more fr-rh-all">Show ${fmt(xs.length - SHOW)} more</button>` : ""}`;
    };
    return desk
      ? `<ol class="fr-dn-timeline fr-rh">${eras.map((e) => { const [name, years] = eraName(e); return `<li><h4>${esc(name)}<span class="fr-rh-n">${years ? `${esc(years)} · ` : ""}${count(e)}</span></h4><div>${list(e)}${more(e)}</div></li>`; }).join("")}</ol>`
      : `<ol class="fr-sn-timeline fr-rh">${eras.map((e) => { const [name, years] = eraName(e); return `<li><h4>${esc(name)} <span class="fr-rh-n">· ${years ? `${esc(years)} · ` : ""}${count(e)}</span></h4>${list(e)}${more(e)}</li>`; }).join("")}</ol>`;
  }
  // A page names whose words it carries; a compiled page names its compiler ("Augustine of Hippo, via Eugippius").
  const who = (x) => `${x.a || x.author || "page"}${x.via ? `, via ${x.via}` : ""}`;
  const pages = (rs, n) => ((rs || []).length
    ? `<p class="fr-sn-pages">${rs.slice(0, n || 5).map((x) => link(x.w || x.work, x.p || x.page, `${who(x)}, p. ${x.p || x.page}`)).join(" · ")}</p>` : "");
  const NOTE = "Machine-written from the library's pages; every page link is checked.";
  const snip = (t) => {
    const s = String(t || "");
    return s.length > 110 ? `${s.slice(0, 108).replace(/\s+\S*$/, "")}…` : s;
  };
  // "I Corinthians 15:22" (the library's names) -> a link to that verse on this page's kind of page.
  function verseHref(ref, desk) {
    const m = String(ref || "").match(/^(.+?)\s+(\d{1,3}):(\d{1,3})/);
    const book = m && S.bookFrom(m[1]);
    if (!book || !(Number(m[2]) >= 1 && Number(m[2]) <= book.chapters)) return "";
    return desk ? S.deskHref(book, Number(m[2]), Number(m[3])) : S.readerHref(book, Number(m[2]), Number(m[3]));
  }
  const readWithList = (cn, desk) => `<ul class="fr-sn-list fr-sn-with">${cn.slice(0, 8).map((c) => {
    const href = verseHref(c.ref, desk);
    const ref = href ? `<a href="${esc(href)}">${esc(c.ref)}</a>` : esc(c.ref);
    return `<li><p><strong>${ref}.</strong> ${esc(c.why)}</p></li>`;
  }).join("")}</ul>`;

  /* Folds remember only what the reader chose: a click on the summary marks the toggle that follows, as the panel's own
   * folds do (bindPanelFolds in scripture-dev.js). A fold opened by a script or by default is not a choice. */
  const recalled = (key) => { try { return window.localStorage.getItem(`sd_panel_fold_${key}`); } catch (e) { return null; } };
  const remember = (key, open) => { try { window.localStorage.setItem(`sd_panel_fold_${key}`, open ? "1" : "0"); } catch (e) { /* not remembered */ } };
  const narrow = window.matchMedia("(max-width: 640px)");
  const isOpen = (key, wide) => {
    const r = recalled(key);
    if (r === "1") return true;
    if (r === "0") return false;
    return Boolean(wide) && !narrow.matches;
  };
  const fold = (key, title, count, body, wideOpen, unit) => `<details class="sd-panel-fold" data-fr-sn-fold="${key}"${isOpen(key, wideOpen) ? " open" : ""}>
    <summary>${esc(title)}${count == null ? "" : ` <span data-sd-summary-count>(${fmt(count)}${unit ? ` ${unit}` : ""})</span>`}</summary><div class="sd-panel-fold-body">${body}</div></details>`;
  document.addEventListener("click", (e) => {
    const sum = e.target.closest && e.target.closest("[data-fr-sn-fold] > summary");
    if (sum) sum.parentElement.dataset.frSnChosen = "1";
    const more = e.target.closest && e.target.closest(".fr-sn-readon");
    if (more) {
      const wrap = more.closest(".fr-sn-lede-wrap");
      const rest = wrap && wrap.querySelector(".fr-sn-rest");
      if (!rest) return;
      const open = more.getAttribute("aria-expanded") !== "true";
      rest.hidden = !open;
      more.setAttribute("aria-expanded", String(open));
      more.textContent = open ? "Show less" : "Read the whole note";
    }
    const era = e.target.closest && e.target.closest(".fr-rh-all");
    if (era) {
      era.parentElement.querySelectorAll(".fr-rh-wit > li[hidden]").forEach((li) => { li.hidden = false; });
      era.remove();
    }
    const vc = e.target.closest && e.target.closest(".fr-vc-all");
    if (vc) {
      const $l = vc.previousElementSibling;
      if ($l) $l.querySelectorAll(":scope > li[hidden]").forEach((li) => { li.hidden = false; });
      vc.remove();
    }
    const all = e.target.closest && e.target.closest(".fr-sn-all");
    if (all) {
      all.closest("[data-fr-sn]").querySelectorAll(".fr-sn-told > li[hidden]").forEach((li) => { li.hidden = false; });
      all.remove();
    }
  });
  document.addEventListener("toggle", (e) => {
    const f = e.target;
    if (!f || !f.dataset || !f.dataset.frSnFold || f.dataset.frSnChosen !== "1") return;
    delete f.dataset.frSnChosen;
    remember(f.dataset.frSnFold, f.open);
  }, true);

  // ── The chapter, in the overview ──
  const ovRow = (v, label, text, hidden) => `<li${hidden ? " hidden" : ""}><button type="button" class="sd-ov-verse fr-sn-row" data-v="${v}">
      <span class="sd-ov-ref">${esc(label)}</span><span class="sd-ov-snip">${esc(snip(text))}</span></button></li>`;
  function chapterReading(ch, book, c) {
    // Key verses in verse order: they are a reading guide to the chapter, not a ranking.
    const keys = (ch.key_verses || []).map((k) => [parseInt(String(k.ref || "").split(":")[1], 10), k])
      .filter(([v]) => v > 0).sort((a, b) => a[0] - b[0])
      .map(([v, k]) => ovRow(v, S.refLabel(book, c, v), k.why)).join("");
    return keys ? `<div class="fr-sn-chapter" data-fr-sn="chapter"><h3 class="sd-h3">Key verses</h3><ol class="sd-ov-top">${keys}</ol></div>` : "";
  }
  // Verse by verse, in verse order: how many works cite it, from which century, and when most ("from the 2nd century; most
  // in the 17th"), from the reception file's century counts (no prose).
  function chapterCenturies(rec, book, c, base) {
    const told = Object.entries((rec && rec.verses) || {}).filter(([, x]) => x && (x.strip || []).length)
      .map(([v, x]) => [Number(v), x]).sort((a, b) => a[0] - b[0]);
    if (!told.length) return "";
    const SHOW = 5;
    // the library holds most in the 17th century, so a verse's raw busiest century says little; its outlier says when it was argued over
    const line = (x) => {
      const out = standsOut(x, base);
      return `${fmt(x.works)} ${x.works === 1 ? "work" : "works"} · from the ${ord(x.strip[0][0])} century${out ? `; stands out in the ${ord(out)}` : ""}`;
    };
    return `<div class="fr-sn-chapter" data-fr-sn="chapter">
      <h3 class="sd-h3">Reception history, verse by verse</h3>
      <ol class="sd-ov-top fr-sn-told">${told.map(([v, x], i) => ovRow(v, S.refLabel(book, c, v), line(x), i >= SHOW)).join("")}</ol>
      ${told.length > SHOW ? `<button type="button" class="sd-commentary-more fr-sn-all">Show all ${fmt(told.length)} verses</button>` : ""}
      <p class="sd-muted fr-sn-note">${REC_NOTE}</p></div>`;
  }

  // ── The verse ──
  function verseParts(x, rv, ref, base) {
    if (!x && !rv) return null;
    x = x || {};
    const rd = x.readings || [];
    const cn = x.connections || [];
    const readings = rd.length ? `<ul class="fr-sn-list">${rd.map((r) => `<li><p><strong>${esc(r.label)}.</strong> ${esc(r.summary)}</p>${pages(r.refs)}</li>`).join("")}</ul>` : "";
    const has = rv && (rv.eras || []).length;
    const history = has ? `${receptionStrip(rv, base)}${receptionEras(rv, ref.book, ref.c, ref.v, false)}` : "";
    // The Desk sets the history as the Topics page sets a doctrine's: the period beside its witnesses (.fr-dn-timeline).
    const deskHistory = has ? `${receptionStrip(rv, base)}${receptionEras(rv, ref.book, ref.c, ref.v, true)}` : "";
    // each commentary's note on the verse, one page per commentary (the history's own pages first, then the notes')
    const seen = new Set();
    const commentaries = Object.entries((rv && rv.notes) || {}).map(([w, p]) => ({ w, p })).concat(x.commentaries || [])
      .filter((n) => n && n.w && !seen.has(n.w) && seen.add(n.w));
    return { readings, nReadings: rd.length, history, nWorks: has ? rv.works : null, deskHistory, with: cn.length ? readWithList(cn, ref.desk) : "", nWith: Math.min(cn.length, 8), commentaries };
  }

  /* A commentary row says when the commentary has its own comment on this verse, with the page (the notes'
   * `commentaries` for the verse). Rows carry their work's slug (data-w, scripture-dev-core.js). */
  function markCommentaries($host, list, label) {
    if (!$host || !list.length) return;
    const byW = new Map();
    list.forEach((x) => { if (x && x.w && !byW.has(x.w)) byW.set(x.w, x); });
    $host.querySelectorAll(".sd-commentary[data-w]").forEach((li) => {
      const hit = byW.get(li.dataset.w);
      const $meta = li.querySelector(".sd-source-meta");
      if (!hit || !$meta || li.querySelector(".fr-sn-has")) return;
      // The verse's own note says more than "Comment on Romans 5", so it takes that place.
      const $on = $meta.querySelector(".sd-comm-on");
      if ($on) $on.remove();
      $meta.insertAdjacentHTML("beforeend", ` <span class="fr-sn-has">· ${link(hit.w, hit.p, `its note on ${label}, p. ${hit.p}`)}</span>`);
    });
  }

  /* The commentaries a verse's notes name (w, p), drawn as the commentary lists draw theirs (commentaryItem: Preview opens its
   * note), with the catalogue's title and author and the commentary list's century; oldest first. A work the book's list does
   * not carry is shown from the catalogue, opening at its note. */
  async function fillVerseCommentaries($ol, book, c, v, notesList) {
    if (!$ol) return;
    // Each commentary at the one page the reception history gives it (notesList: the history's notes, then the notes' own), then
    // the commentaries' marked notes in the chapter file ("Its note on this verse": the print's verse markers) not yet named.
    const [d, cat, marked] = await Promise.all([
      S.fetchCommentaries(book, c, S.emptyFilters()).catch(() => null), S.loadCatalogue(),
      S.fetchVerse(book, c, v, { ...S.emptyFilters(), q: "note on this verse" }, 0, 50).catch(() => null),
    ]);
    const list = (notesList || []).concat(((marked && marked.rows) || []).filter((r) => r.how === "exegesis" && r.w && r.p).map((r) => ({ w: r.w, p: r.p })));
    const known = new Map(((d && d.items) || []).map((e) => [e.w, e]));
    const seen = new Set(), items = [];
    list.forEach((x) => {
      if (!x || !x.w || seen.has(x.w)) return;
      seen.add(x.w);
      const w = cat.get(x.w) || {};
      items.push(known.get(x.w) || { w: x.w, t: w.t || x.t || x.w, a: w.a || x.a || "", kind: "commentary", c1: 0, c2: 0, cen: null, href: `/read?w=${x.w}#b${x.p}-0`, anchored: "note" });
    });
    items.sort(S.byCentury);
    // none: the block stays (it keys the verse) but out of sight
    const $box = $ol.closest("[data-fr-sn]") || $ol.parentElement;
    if (!items.length) { if ($box) $box.hidden = true; return; }
    $ol.replaceChildren(...items.map((e) => S.commentaryItem(e, { book, c, v })));
    markCommentaries($ol, list, `${c}:${v}`);
    // In the panel, the first eight and the rest on a click (Romans 5:12 has 47); the Desk lists them all.
    const PANEL_SHOW = 8;
    if ($ol.closest("section.sd-panel") && items.length > PANEL_SHOW) {
      [...$ol.children].slice(PANEL_SHOW).forEach((li) => { li.hidden = true; });
      $ol.insertAdjacentHTML("afterend", `<button type="button" class="sd-commentary-more fr-vc-all">Show all ${fmt(items.length)} commentaries</button>`);
    }
    // the fold's count, now that the chapter file's notes are in
    const $n = $ol.closest("details") && $ol.closest("details").querySelector(":scope > summary [data-sd-summary-count]");
    if ($n) $n.textContent = `(${fmt(items.length)})`;
  }

  // ── Placing them as the reader draws its panels ──
  const $book = $root && $root.querySelector("[data-sd-book]");
  const $chapter = $root && $root.querySelector("[data-sd-chapter]");
  const here = () => {
    const book = $book && S.BOOK_BY_SLUG.get($book.value);
    const c = $chapter ? Number($chapter.value) : 0;
    return book && c > 0 ? { book, c, v: 0 } : null;
  };
  let busy = false;
  let again = false;
  async function place() {
    if (busy) { again = true; return; }
    busy = true;
    try {
      const r = here();
      if (!r || !r.book) return;
      // The reader keeps its two panel elements and replaces what is inside them, so the test is whether OUR
      // blocks are there for this chapter or verse; a passage known to have no notes is marked so it is not refetched.
      const $ov = $root.querySelector("section.sd-overview");
      const ovKey = `${r.book.lib}/${r.c}`;
      const ovReady = $ov && $ov.isConnected && $ov.querySelector(".sd-panel-ref") && !/Counting citations/.test($ov.textContent);
      const ovHas = ovReady && $ov.querySelector('[data-fr-sn="chapter"]');
      const needOv = ovReady && !(ovHas && ovHas.dataset.key === ovKey) && $ov.dataset.frSnNone !== ovKey;
      const $panel = $root.querySelector("section.sd-panel");
      const $ref = $panel && $panel.isConnected && $panel.querySelector(".sd-panel-ref");
      const vKey = $ref ? $ref.textContent.trim() : "";
      const vHas = $ref && $panel.querySelector('[data-fr-sn="verse"]');
      const needVerse = $ref && !(vHas && vHas.dataset.key === vKey) && $panel.dataset.frSnNone !== vKey;
      const $comm = $panel && $panel.querySelector("[data-sd-panel-commentaries]");
      const needMarks = $ref && $comm && $comm.querySelector(".sd-commentary[data-w]") && !$comm.dataset.frSnMarked;
      if (!needOv && !needVerse && !needMarks) return;
      const [d, rec, base] = await Promise.all([bookFile(r.book), chapterReception(r.book, r.c), loadBaseline()]);
      const ch = d && d.chapters && d.chapters[String(r.c)];
      if (needOv && $ov.isConnected) {
        $ov.querySelectorAll('[data-fr-sn="chapter"]').forEach((el) => el.remove());
        const top = ch ? chapterReading(ch, r.book, r.c) : "";
        const end = rec ? chapterCenturies(rec, r.book, r.c, base) : "";
        if (top || end) {
          // Under the counts and before the most-cited verses: what the chapter means, then how often it is cited.
          const $mostH = Array.prototype.find.call($ov.querySelectorAll(".sd-h3"), (el) => /most-cited/i.test(el.textContent));
          if (top) { if ($mostH) $mostH.insertAdjacentHTML("beforebegin", top); else $ov.insertAdjacentHTML("beforeend", top); }
          if (end) $ov.insertAdjacentHTML("beforeend", end);
          $ov.querySelectorAll('[data-fr-sn="chapter"]').forEach((el) => { el.dataset.key = ovKey; });
        } else $ov.dataset.frSnNone = ovKey;
      }
      const m = vKey.match(/:(\d+)$/);
      const v = (m ? Number(m[1]) : 0) || r.v; // the panel's own heading first: it is what the reader is showing
      const x = v && ch ? (ch.verses || {})[String(v)] : null;
      const rv = v && rec ? (rec.verses || {})[String(v)] : null;
      if (needVerse && $panel.isConnected) {
        $panel.querySelectorAll('[data-fr-sn="verse"]').forEach((el) => el.remove());
        const parts = verseParts(x, rv, { book: r.book, c: r.c, v, desk: false }, base) || { readings: "", history: "", with: "", commentaries: [] };
        {
          // Closed until opened, on every screen (2026-10-16): open by default the history and the commentaries made the panel
          // 9,400px tall beside a chapter of 2,500, and working in it scrolled the text out of sight (the panel is not sticky:
          // Ian, 09-23). The fold rows say what each holds; the Verse Desk shows them whole.
          const lead = `${parts.history ? fold("fr_history", "Reception history", parts.nWorks, `${parts.history}<p class="sd-muted fr-sn-note">${REC_NOTE}</p>`, false, parts.nWorks === 1 ? "work" : "works") : ""}` +
            `${parts.readings ? fold("fr_readings", "Readings", parts.nReadings, `${parts.readings}<p class="sd-muted fr-sn-note">${NOTE}</p>`) : ""}`;
          const $count = $panel.querySelector("[data-sd-count]");
          if (lead) {
            const html = `<div class="fr-sn-verse" data-fr-sn="verse">${lead}</div>`;
            if ($count) $count.insertAdjacentHTML("afterend", html); else $panel.insertAdjacentHTML("beforeend", html);
          }
          // The commentaries with their own note on the verse, open, before the commentary lists (2026-10-15).
          { // a verse the notes do not cover can still have commentaries' notes in the chapter file: always asked
            const $lists = $panel.querySelector("[data-sd-panel-commentaries]");
            const html = `<div class="fr-sn-verse" data-fr-sn="verse">${fold("fr_vcomm", `Commentaries on ${vKey}`, parts.commentaries.length, `<ol class="sd-sources sd-panel-commentaries" data-fr-sn-vcomm></ol>`, false)}</div>`;
            if ($lists) $lists.insertAdjacentHTML("beforebegin", html); else $panel.insertAdjacentHTML("beforeend", html);
            fillVerseCommentaries($panel.querySelector("[data-fr-sn-vcomm]"), r.book, r.c, v, parts.commentaries);
          }
          if (parts.with) {
            const html = `<div class="fr-sn-verse" data-fr-sn="verse">${fold("fr_with", "Read with", parts.nWith, parts.with)}</div>`;
            const $similar = $panel.querySelector('[data-sd-panel-section="similar"]');
            if ($similar) $similar.insertAdjacentHTML("beforebegin", html); else $panel.insertAdjacentHTML("beforeend", html);
          }
          $panel.querySelectorAll('[data-fr-sn="verse"]').forEach((el) => { el.dataset.key = vKey; });
        }
      }
      if ($comm && $comm.isConnected && $comm.querySelector(".sd-commentary[data-w]")) {
        // the page the history gives each commentary first, so the panel's lists and the history agree
        const vnotes = Object.entries((rv && rv.notes) || {}).map(([w, p]) => ({ w, p })).concat((x && x.commentaries) || []);
        markCommentaries($comm, vnotes, vKey.replace(/^.*?(\d+:\d+)$/, "$1"));
        $comm.dataset.frSnMarked = "1";
      }
    } finally {
      busy = false;
      if (again) { again = false; place(); }
    }
  }

  // ── The Verse Desk ──
  async function placeDesk() {
    const ref = S.parseRef(new URLSearchParams(location.search).get("ref"));
    if (!ref || !ref.v) return;
    const [d, rec, base] = await Promise.all([bookFile(ref.book), chapterReception(ref.book, ref.c), loadBaseline()]);
    const ch = d && d.chapters && d.chapters[String(ref.c)];
    const parts = verseParts(ch && (ch.verses || {})[String(ref.v)], rec && (rec.verses || {})[String(ref.v)], { book: ref.book, c: ref.c, v: ref.v, desk: true }, base)
      || { readings: "", deskHistory: "", with: "", commentaries: [] };
    const label = S.refLabel(ref.book, ref.c, ref.v);
    if (parts.readings || parts.deskHistory) {
      const $trans = $desk.querySelector('[aria-labelledby="sd-h-trans"]');
      const html = `<section class="sd-desk-sec fr-sn-desk" aria-labelledby="sd-h-reads" data-fr-sn="verse">
        <h2 class="sd-h2" id="sd-h-reads">Reception history of ${esc(label)}</h2>
        ${parts.deskHistory ? `${parts.deskHistory}<p class="sd-muted fr-sn-note">${REC_NOTE}</p>` : ""}
        ${parts.readings ? `<h3 class="sd-h3">Readings</h3><div class="fr-sn-desk-readings">${parts.readings}</div><p class="sd-muted fr-sn-note">${NOTE}</p>` : ""}</section>`;
      if ($trans) $trans.insertAdjacentHTML("afterend", html); else $desk.insertAdjacentHTML("beforeend", html);
      const $toc = $desk.querySelector("[data-sd-toc-reads]");
      if ($toc) $toc.hidden = false;
    }
    // The commentaries with their own note on the verse, in view above the commentary collections (2026-10-15).
    const $vc = $desk.querySelector("[data-sd-verse-comm]");
    if ($vc) {
      $vc.innerHTML = `<h3 class="sd-h3">Commentaries on ${esc(label)}</h3><ol class="sd-sources sd-panel-commentaries fr-sn-desk-vcomm" data-fr-sn-vcomm></ol>`;
      fillVerseCommentaries($vc.querySelector("[data-fr-sn-vcomm]"), ref.book, ref.c, ref.v, parts.commentaries);
    }
    if (parts.with) {
      const $grid = $desk.querySelector(".sd-similar-grid");
      if ($grid) $grid.insertAdjacentHTML("afterbegin", `<div class="sd-similar-block" data-fr-sn="verse"><h3 class="sd-h3">Read with</h3><p class="sd-muted">Verses the library reads alongside ${esc(label)}.</p>${parts.with}</div>`);
    }
    // The commentaries open later, on a click: mark them as they are drawn.
    const $panels = $desk.querySelectorAll("[data-sd-commentary-panel]");
    const short = `${ref.c}:${ref.v}`;
    const mark = () => $panels.forEach((p) => markCommentaries(p, parts.commentaries, short));
    mark();
    $panels.forEach((p) => new MutationObserver(mark).observe(p, { childList: true, subtree: true }));
  }

  if ($root) {
    // The reader redraws the overview and the verse panel on its own schedule (fetches, route changes, a phone
    // folding the side away); watch what it draws rather than racing it.
    new MutationObserver(() => { place(); }).observe($root, { childList: true, subtree: true });
    window.addEventListener("popstate", () => { place(); });
    place();
  }
  if ($desk) placeDesk();
})();
