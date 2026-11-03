/*
 * Contents titles: one rule for numbered divisions.
 *
 * Ian, 2026-09-24, on Owen's "Of the mortification of sin" (eebo-32524):
 * "Here's an example of chapter numbers being in the TOC but only one
 * subtitle of the chapter made it to the TOC with the chapter number. We
 * need a standard rule for this that gets applied across all applicable
 * works." The sidebar read Chap. I ... Chap. XI, then Chap. XII with its
 * whole argument, then Chap. XIII and XIV bare.
 *
 * THE RULE. An outline entry that opens with a numbered division label
 * (Chap. VIII, Chapter 3, Book II, Lib. I, Cap. 4, Part One, Sect. 2,
 * Question 5, Article 7, Sermon 3, Lecture, Disputation, Homily, Psalm,
 * "The Second Part", English and Latin forms, a few Greek) shows
 *
 *     <label>. <short title>
 *
 * where the short title comes from the work itself, in this order:
 *   1. the entry's own words after the label ("CHAP. XII. The Eighth
 *      Direction. ..."), or the heading's on the page when the outline
 *      dropped them ("Homily 3" / "HOMILY III. ON THE CIRCUMCISION ...");
 *   2. the argument the work prints under the heading, when the page marks
 *      it as a title: a second heading, a paragraph that opens in italics
 *      (the printed convention for an argument), or a run of capitals
 *      before the text begins ("ON LOT AND HIS DAUGHTERS. Although ...");
 *   3. a short paragraph under the heading ("The question on which the
 *      whole work hangs."), or one sentence before the numbered text
 *      ("On the blessings of the patriarchs. 1. It must ..."), but only
 *      when most of the entry's siblings are followed the same way, so a
 *      chapter that merely opens with a short paragraph is not titled by
 *      its first line.
 * The short title is the first sentence (one under 24 characters carries
 * the next with it: "The Eighth Direction. Thoughtfulness of ..."); one
 * much over 70 characters is cut at its first clause or on a word
 * boundary near 70, with an ellipsis. Nothing is invented: every word is
 * the work's. When no title is found the label stands alone. Labels are
 * normalised within a set of siblings (same parent, same kind of
 * division): one spelling of the word ("Chap.", "Book" for "Booke"),
 * numbers in words as roman numerals, roman or arabic as most siblings
 * have them, never all capitals. The full heading and argument stay on
 * the entry's tooltip. Entries without a label (Calvin's chapter titles,
 * the Heidelberg's questions) are left as they are.
 *
 * WHERE THE WORDS COME FROM. The page data already in memory, never the
 * rendered text (long works render lazily): TEI_PAGES (the engine's
 * lanes of heading and paragraph elements, EEBO and the Latin and Greek
 * Patrologies), then DATA.pages (the born-digital editions' markdown).
 * A work streaming its pages in gets its titles as they arrive.
 *
 * THE ENGINE'S TITLE IS KEPT. reader-core's goNav reads the clicked
 * entry's .nn-t text to find the heading on the page, and
 * faith-reader-folds.js does the same. The engine's own text is stored
 * on the link as data-fr-title-original; folds prefers it, and a click
 * puts it back for the moment the engine reads it. Display only: no
 * data changes. The Expand contents overlay copies titles from #nav
 * when it opens, so it shows these too.
 */
(function () {
  "use strict";

  const nav = document.getElementById("nav");
  if (!nav) return;

  const dataOf = () => {
    try { return typeof DATA !== "undefined" ? DATA : null; }
    catch (_) { return null; }
  };
  const teiOf = () => {
    try { return typeof TEI_PAGES !== "undefined" ? TEI_PAGES : null; }
    catch (_) { return null; }
  };

  /* ---------- labels ---------- */

  // Division words. Full words print without a period; anything else is
  // an abbreviation and prints with one ("Chap.", "Lib.", "Q.").
  const FULL = new Set(("chapter caput capitulum book booke liber part pars section sectio " +
    "question quaestio article articulus sermon sermo lecture lectio disputation " +
    "disputatio homily homilia psalm psalmus treatise tractatus tractate distinction " +
    "distinctio epistle epistola letter oration oratio discourse thesis proposition " +
    "aphorism canon session tome tomus volume concio exercitation meditation dialogue " +
    "lesson decade century canto stanza collatio controversy controversia " +
    "metrum meter metre carmen poem prosa prose " +
    "κεφάλαιον λόγος ὁμιλία βιβλίον τόμος").split(" "));
  // Kind of division, for grouping siblings: "Chap." and "Chapter" are one kind.
  const FAMILY = [
    [/^(chap|chapter|ch|c|cap|caput|capitulum|capit|κεφάλαιον|κεφ)$/, "chapter"],
    [/^(book|booke|lib|liber|βιβλίον)$/, "book"],
    [/^(part|pars|pt)$/, "part"],
    [/^(sect|section|sectio|§)$/, "section"],
    [/^(question|quaestio|quaest|quest|qu|q)$/, "question"],
    [/^(article|articulus|art|a)$/, "article"],
    [/^(sermon|sermo|serm|concio|conc)$/, "sermon"],
    [/^(lecture|lectio|lect)$/, "lecture"],
    [/^(disputation|disputatio|disp)$/, "disputation"],
    [/^(homily|homilia|hom|ὁμιλία)$/, "homily"],
    [/^(psalm|psalmus|ps)$/, "psalm"],
    [/^(treatise|tractatus|tractate|tract)$/, "treatise"],
    [/^(distinction|distinctio|dist)$/, "distinction"],
    [/^(epistle|epistola|epist|ep|letter)$/, "epistle"],
    [/^(oration|oratio|orat|λόγος)$/, "oration"],
    [/^(metrum|meter|metre|carmen|poem)$/, "poem"],
    [/^(prosa|prose)$/, "prose"],
  ];
  const KW = "chapter|chap|ch|capitulum|capit|caput|cap|c|booke|book|liber|lib|part|pars|pt|" +
    "section|sectio|sect|§|question|quaestio|quaest|quest|qu|q|article|articulus|art|a|" +
    "sermon|sermo|serm|concio|conc|lecture|lectio|lect|disputation|disputatio|disp|" +
    "homily|homilia|hom|psalm|psalmus|ps|treatise|tractatus|tractate|tract|" +
    "distinction|distinctio|dist|epistle|epistola|epist|ep|letter|oration|oratio|orat|" +
    "discourse|thesis|proposition|prop|aphorism|canon|session|sess|tome|tomus|tom|" +
    "volume|vol|exercitation|exercit|meditation|medit|dialogue|lesson|decade|century|" +
    "cent|canto|stanza|collatio|controversy|controversia|contr|" +
    "metrum|metre|meter|carmen|poem|prosa|prose|" +
    "κεφάλαιον|κεφ|λόγος|ὁμιλία|βιβλίον|τόμος";
  const WORDNUM = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
    "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
    "seventeen", "eighteen", "nineteen"];
  const ORDNUM = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh",
    "eighth", "ninth", "tenth", "eleventh", "twelfth", "thirteenth", "fourteenth",
    "fifteenth", "sixteenth", "seventeenth", "eighteenth", "nineteenth"];
  const TENS = ["", "", "twent", "thirt", "fort", "fift", "sixt", "sevent", "eight", "ninet"];
  const LATORD = ["", "prim", "secund", "terti", "quart", "quint", "sext", "septim",
    "octav", "non", "decim"];
  // "Twenty", "Twentieth", "Twenty-One", "Twenty Second": words up to 99.
  const UNIT = `${WORDNUM.slice(1, 10).join("|")}|${ORDNUM.slice(1, 10).join("|")}`;
  const WORDS = `(?:${TENS.slice(2).join("|")})(?:y|ieth)(?:[-\\s](?:${UNIT}))?|` +
    `${WORDNUM.slice(1).join("|")}|${ORDNUM.slice(1).join("|")}`;
  const NUM = `[ivxlcdm]+j?|\\d{1,4}|${WORDS}|(?:${LATORD.slice(1).join("|")})(?:us|a|um)|` +
    `[α-ω]{1,3}[ʹ΄']`;
  const LABEL = new RegExp(`^\\s*(${KW})(\\.\\s*|\\s+)(?:the\\s+)?(${NUM})(?=$|[\\s.,:;)\\]—–-])\\.?`, "iu");
  // Ordinal first: "The Second Part", "First Sermon".
  const ORDS = `(?:${TENS.slice(2).join("|")})(?:ieth|y[-\\s](?:${ORDNUM.slice(1, 10).join("|")}))|` +
    `${ORDNUM.slice(1).join("|")}`;
  const STRAY_LEAD = new RegExp(`^\\d{1,4}\\s+(?=(?:${KW})\\.?\\s+(?:${NUM})(?=$|[\\s.,:;)\\]—–-]))`, "iu");
  const STRAY_MID = new RegExp(`^((?:${KW})\\.?)\\s+\\d{1,4}\\s+(?=(?:[ivxlcdm]+j?|${WORDS}|(?:${LATORD.slice(1).join("|")})(?:us|a|um))(?=$|[\\s.,:;)\\]—–-]))`, "iu");
  const LABEL_ORD = new RegExp(`^\\s*(?:the\\s+)?(${ORDS})\\s+(${KW})(?=$|[\\s.,:;)\\]—–-])\\.?`, "iu");

  const romanToInt = (r) => {
    const v = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
    let n = 0;
    const s = r.toLowerCase().replace(/j$/, "i");
    for (let i = 0; i < s.length; i++) {
      const a = v[s[i]], b = v[s[i + 1]] || 0;
      n += a < b ? -a : a;
    }
    return n;
  };
  const intToRoman = (n) => {
    const t = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
      [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
    let out = "";
    for (const [v, s] of t) while (n >= v) { out += s; n -= v; }
    return out;
  };
  // A numeral as {kind, value, text}: kind roman | arabic | word | greek.
  function numeral(tok) {
    const low = tok.toLowerCase();
    if (/^\d+$/.test(low)) return { kind: "arabic", value: Number(low), text: low };
    if (/^[ivxlcdm]+j?$/.test(low)) {
      return { kind: "roman", value: romanToInt(low), text: low.replace(/j$/, "i").toUpperCase() };
    }
    const word = (w) => {
      let n = WORDNUM.indexOf(w);
      if (n < 0) n = ORDNUM.indexOf(w);
      return n;
    };
    let v = word(low);
    if (v < 0) {
      const t = low.match(/^([a-z]+?)(?:y|ieth)(?:[-\s]([a-z]+))?$/);
      const ten = t ? TENS.indexOf(t[1]) : -1;
      if (ten >= 2) v = ten * 10 + (t[2] ? Math.max(0, word(t[2])) : 0);
    }
    if (v < 0) {
      const lat = LATORD.findIndex((s) => s && new RegExp(`^${s}(?:us|a|um)$`).test(low));
      if (lat > 0) v = lat;
    }
    // Numbers in words are shown as roman numerals, the house form, so
    // "Book Second" and "Book Three" become Book II and Book III.
    if (v > 0) return { kind: "roman", value: v, text: intToRoman(v) };
    return { kind: "greek", value: null, text: tok };
  }

  const titleWord = (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  const family = (kw) => {
    const k = kw.toLowerCase();
    for (const [re, f] of FAMILY) if (re.test(k)) return f;
    return k;
  };

  // Old spellings of the division word print in the modern form; a bare
  // "C." is a chapter and a bare "A." an article (Aquinas).
  const SPELL = { booke: "book", c: "chap", a: "art" };

  /* Parse "CHAP. XII. The Eighth Direction..." into labels + rest. Up to
     three labels in a row ("Part I. Chapter II. ...") make one label. */
  function parse(title) {
    let s = String(title || "").replace(/\s+/g, " ").trim();
    // The Patrologia prints its note and column numbers into headings:
    // "1 METRUM PRIMUM.", "METER 432 II.". A number before a label, or
    // between a label word and its numeral, is not part of the label.
    s = s.replace(STRAY_LEAD, "").replace(STRAY_MID, "$1 ");
    const labels = [];
    for (let k = 0; k < 3; k++) {
      let m = s.match(LABEL);
      // A one-letter label ("A.", "C.", "Q.") needs its period: "A 1662
      // sermon" is not an article.
      if (m && m[1].length === 1 && m[1] !== "§" && !m[2].includes(".")) m = null;
      if (m) m = { all: m[0], kw: m[1], num: m[3] };
      else {
        const o = s.match(LABEL_ORD);
        // "The Second Part of the Treatise" is a phrase, not a label.
        if (o && FULL.has(o[2].toLowerCase()) && !/^[\s.,:;—–-]*\p{Ll}/u.test(s.slice(o[0].length))) {
          m = { all: o[0], kw: o[2], num: o[1] };
        }
      }
      if (!m) break;
      const {kw} = m;
      const abbrev = !FULL.has(kw.toLowerCase());
      const lab = {
        kw: kw === "§" ? "§" : titleWord(SPELL[kw.toLowerCase()] || kw) + (abbrev ? "." : ""),
        fam: family(kw),
        num: numeral(m.num),
      };
      // (2026-10-31) an outline's bilingual echo names one division twice ("Chapter III — CAPUT III.", the Migne Scripturae Sacrae
      // Cursus and the other English-and-Latin outlines): one label, not "Chapter III. Chapter III"
      const prev = labels[labels.length - 1];
      const same = prev && prev.fam === lab.fam && (prev.num.value && lab.num.value ? prev.num.value === lab.num.value : prev.num.text.toLowerCase() === lab.num.text.toLowerCase());
      if (!same) labels.push(lab);
      s = s.slice(m.all.length).replace(/^[\s.,:;—–-]+/, "");
    }
    if (!labels.length) return null;
    const sig = labels.map((l) => `${l.fam}:${l.num.value || l.num.text.toLowerCase()}`).join("+");
    return { labels, rest: s, sig };
  }

  /* ---------- text ---------- */

  const isPld = () => /^pld?-/.test(String((dataOf() || {}).slug || ""));

  /* Latin division words in English, for English display only (the
     English lane showing: English alone or beside the Latin). With the
     Latin alone (#app.only-la) the contents keep the Latin words. */
  const LAT_EN = {
    liber: "Book", lib: "Book", caput: "Chapter", capitulum: "Chapter", cap: "Chapter",
    capit: "Chapter", pars: "Part", sectio: "Section", quaestio: "Question",
    quaest: "Question", articulus: "Article", sermo: "Sermon", serm: "Sermon",
    concio: "Sermon", lectio: "Lecture", disputatio: "Disputation", homilia: "Homily",
    epistola: "Letter", epist: "Letter", tractatus: "Treatise", distinctio: "Distinction",
    metrum: "Poem", meter: "Poem", metre: "Poem", carmen: "Poem", prosa: "Prose",
    oratio: "Oration", psalmus: "Psalm", tomus: "Volume", collatio: "Conference",
    controversia: "Controversy",
  };
  const LAT_WORD = {
    praefatio: "Preface", prefatio: "Preface", prologus: "Prologue", prooemium: "Preface",
    procemium: "Preface", epilogus: "Epilogue", argumentum: "Argument", appendix: "Appendix",
    index: "Index", dedicatio: "Dedication",
  };
  function englishShown() {
    const app = document.getElementById("app");
    if (app && app.classList.contains("only-la")) return false;
    return !!document.querySelector('#reading [lang="en"]');
  }
  function clean(t) {
    let s = String(t || "")
      .replace(/\p{Cc}/gu, " ")
      .replace(/<[^>]*>/g, "")
      .replace(/[*_]+/g, "")
      .replace(/^#{1,6}\s*/, "")
      .replace(/\[[^\]]*\]/g, " ")
      .replace(/\s+([.,;:?!])/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
    // The Patrologia's inline footnote numbers ("in this way 64 .") and
    // column numbers ("BOOK FOUR 446 . In which ...").
    if (isPld()) {
      s = s.replace(/(^|[\p{L},;])\s+\d{1,4}(?=\s*(?:[.,;:]|$|\s+\p{Ll}))/gu, "$1")
        .replace(/^\d{1,4}\.?\s+(?=\p{Lu})/u, "");
    }
    s = s.replace(/\s+([.,;:?!])/g, "$1").replace(/\s+/g, " ").trim();
    return s;
  }
  // Capital runs are title-cased for display, as the engine does its own.
  function unshout(s) {
    const letters = s.replace(/[^\p{L}]/gu, "");
    if (letters.length < 4 || letters !== letters.toUpperCase() || letters === letters.toLowerCase()) return s;
    const SMALL = /^(of|the|and|in|on|to|a|an|or|for|by|with|vpon|upon|from|at|as|that|is|be|de|et|in|ad|per|cum)$/i;
    let first = true;
    return s.replace(/\p{L}[\p{L}'’]*/gu, (w) => {
      const f = first;
      first = false;
      if (/^[IVXLCDM]+$/.test(w) && w.length > 1) return w;
      if (!f && SMALL.test(w)) return w.toLowerCase();
      return titleWord(w);
    });
  }

  const ABBR = /^(?:cap|art|lib|tom|vol|vid|seq|seqq|ibid|etc|viz|fol|pag|num|col|cent|quaest|disp|sect|conf|resp|cit|loc|matth|mat|marc|luc|ioh|joh|act|rom|cor|gal|eph|phil|coloss|col|thess|tim|tit|philem|hebr|heb|iac|jac|pet|petr|iud|jud|apoc|rev|gen|exod|ex|lev|deut|jos|judg|sam|reg|kin|chron|esd|neh|esth|psal|ps|prov|eccl|eccles|cant|sap|eccli|isa|esa|jer|lam|bar|ezek|dan|hos|joel|amos|obad|jon|mic|nah|hab|zeph|hag|zech|mal|mr|mrs|dr|st|ch|chap|p|pp|v|vv|ver|vers|cf|ed|fr|lat|gr|n|no|sc|scil|q|qu|sr|s)$/i;
  // End offsets of sentences: at . ? ! (and a closing quote or bracket)
  // before a capital or the end, never after a common abbreviation or a
  // single letter.
  function sentences(s) {
    const out = [];
    const re = /[.?!]['’”)]*(?=\s+['‘“(]?[\p{Lu}\d]|\s*$)/gu;
    let m;
    while ((m = re.exec(s))) {
      const before = s.slice(0, m.index);
      const w = (before.match(/([\p{L}]+)$/u) || [])[1] || "";
      if (m[0][0] === "." && w && (ABBR.test(w) || w.length === 1)) continue;
      out.push(m.index + m[0].length);
    }
    return out;
  }
  const MAX = 70;
  const TIDY = (s) => s.replace(/[\s.,;:—–-]+$/u, "");

  /* NO EM DASH IN THE OUTLINE (health check 2026-11-02, on the Migne Scripturae Sacrae Cursus: a chapter row read as
     the English, an em dash, then the Latin capitals; house style has no em dash). The outline data joins an entry's
     English to the Latin the volume prints with a spaced em dash (U+2014), and reader-core splits the row on it the
     same way: English in the link, the capitals beside it. So the English half alone is parsed here for the label and
     short title (the Latin's own section label leaked into the short title before), the tooltip joins the two halves
     as two sentences, and any other spaced em dash left in a shown title becomes a full stop before a capital or a
     number and a colon before anything else. Display only: the data, and the dash that other code splits on, stay as
     they are. */
  function bilingual(t) {
    const s = String(t || ""), i = s.indexOf(" — ");
    if (i < 1) return null;
    const la = s.slice(i + 3).trim(), letters = la.replace(/[^A-Za-z]/g, "");
    return letters && letters === letters.toUpperCase() ? { en: s.slice(0, i).trim(), la } : null;
  }
  const undash = (s) => String(s || "")
    .replace(/([.?!]['’”)]*)\s+—\s+/gu, "$1 ")
    .replace(/[\s,;:]*\s—\s+(?=['‘“(]?[\p{Lu}§\d])/gu, ". ")
    .replace(/[\s,;:]*\s—\s+/gu, ": ");
  const withEcho = (en, la) => undash(la ? `${en} — ${la}` : en);
  function trimWords(s, max) {
    if (s.length <= max) return { text: s, cut: false };
    let cut = s.slice(0, max + 1);
    const sp = cut.lastIndexOf(" ");
    cut = sp > max * 0.5 ? cut.slice(0, sp) : s.slice(0, max);
    return { text: TIDY(cut), cut: true };
  }
  /* The short title: first sentence (a very short one takes the next
     along), cut at the first clause or a word boundary when long. */
  function shortTitle(full) {
    const s = full;
    if (!s) return "";
    const ends = sentences(s);
    let end = ends.length ? ends[0] : s.length;
    if (s.slice(0, end).length < 24 && ends.length > 1) end = ends[1];
    let t = TIDY(s.slice(0, end).trim());
    let cut = false;
    if (t.length > MAX + 6) {
      let at = -1;
      const semi = t.search(/[;:](\s|$)/);
      if (semi >= 20 && semi <= MAX) at = semi;
      if (at < 0) {
        const re = /,\s/g;
        let m;
        while ((m = re.exec(t))) { if (m.index > MAX) break; if (m.index >= 30) at = m.index; }
      }
      if (at > 0) { t = t.slice(0, at); cut = true; }
      else { const w = trimWords(t, MAX); t = w.text; cut = w.cut; }
    }
    t = TIDY(t);
    return t ? t + (cut ? "…" : "") : "";
  }

  /* ---------- the work's own data ---------- */

  let pageOrder = null, pageOrderFor = null;
  function order() {
    const d = dataOf();
    const pages = (d && d.pages) || [];
    if (pageOrderFor === pages && pageOrder && pageOrder.size === pages.length) return pageOrder;
    pageOrder = new Map();
    pages.forEach((p, i) => pageOrder.set(String(p.n), i));
    pageOrderFor = pages;
    return pageOrder;
  }
  const pageAt = (i) => { const d = dataOf(); const p = d && d.pages && d.pages[i]; return p ? String(p.n) : null; };

  // Items for one page of one lane: {text, raw, head, path}.
  const laneCache = new Map();
  function items(lane, page) {
    const key = `${lane}|${page}`;
    const tei = teiOf();
    const d = dataOf();
    let src = null;
    if (lane === "en" || lane === "la") src = tei && tei[lane] && tei[lane][page];
    else {
      const p = d && d.pages && d.pages[order().get(page)];
      src = p && typeof p[lane.slice(3)] === "string" ? p[lane.slice(3)] : null;
    }
    if (!src) return null;
    const hit = laneCache.get(key);
    if (hit && hit.src === src && hit.len === src.length) return hit.list;
    let list = [];
    if (typeof src === "string") {
      list = src.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean).map((b) => ({
        raw: b, text: clean(b), head: /^#{1,6}\s/.test(b), path: null,
      }));
    } else {
      for (const el of Array.from(src)) {
        if (!el || typeof el.textContent !== "string") continue;
        const raw = el.textContent.trim();
        if (!raw) continue;
        list.push({
          raw, text: clean(raw), head: /^head$/i.test(el.nodeName || ""),
          path: el.getAttribute ? el.getAttribute("data-source-path") : null,
        });
      }
    }
    laneCache.set(key, { src, len: src.length, list });
    return list;
  }
  const LANES = ["en", "md-en", "la", "md-la"];
  const fold = (t) => String(t || "").normalize("NFKC").replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();

  /* The heading for an entry and the item after it: {head, next}. */
  function locate(entry) {
    const ord = order();
    const start = ord.get(String(entry.page));
    if (start == null) return null;
    const want = fold(entry.full);
    const wantLabel = fold(entry.labelRaw);
    if (!want) return null;
    for (const lane of LANES) {
      // The entry's own page first, then the next two, then the one
      // before (an outline page number can be a page off either way).
      for (const pi of [start, start + 1, start + 2, start - 1]) {
        const page = pageAt(pi);
        const list = page != null ? items(lane, page) : null;
        if (!list) continue;
        let found = -1;
        for (let i = 0; i < list.length && found < 0; i++) {
          const it = list[i];
          if (entry.path && it.path != null) {
            if (it.path === entry.path && it.head) found = i;
            continue;
          }
          const f = fold(it.text);
          if (!f) continue;
          if (f === want) { found = i; break; }
          // Otherwise the same division, under any spelling: "Homily 3" in
          // the outline, "HOMILY III. ON THE CIRCUMCISION ..." on the page.
          // (Never a prefix: "Chapter X" is not "Chapter XI".)
          if (it.text.length < 600 && f[0] === wantLabel[0]) {
            if (it.sig === undefined) { const q = parse(it.text); it.sig = q ? q.sig : ""; it.rest = q ? q.rest : ""; }
            if (it.sig && it.sig === entry.parsed.sig) found = i;
          }
        }
        if (found < 0) continue;
        let next = list[found + 1] || null;
        if (!next) {
          const nl = pageAt(pi + 1) != null ? items(lane, pageAt(pi + 1)) : null;
          next = nl && nl[0] ? nl[0] : null;
        }
        return { head: list[found], next };
      }
    }
    return null;
  }

  /* ---------- the outline ---------- */

  const ALL_TITLES = new Set();
  function rows() {
    const out = [];
    const nodes = Array.from(nav.querySelectorAll(".nav-node"));
    const stack = [];
    ALL_TITLES.clear();
    nodes.forEach((node, idx) => {
      const nn = node.querySelector(".nn-t");
      if (!nn) return;
      const depth = Number((node.className.match(/\bnd(\d)\b/) || [])[1] || 1);
      while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
      const parent = stack.length ? stack[stack.length - 1].idx : -1;
      stack.push({ depth, idx });
      // The engine's tooltip is the entry's whole title; once this file has written its own (frTipShown), the
      // engine's is the one it kept (frTitleRaw), unless the engine has since written a new one.
      const attr = node.getAttribute("title");
      if (attr && attr !== node.dataset.frTipShown) node.dataset.frTitleRaw = attr;
      if (nn.dataset.frTitleOriginal == null || nn.textContent !== nn.dataset.frTocShown) {
        nn.dataset.frTitleOriginal = nn.textContent;
        node.dataset.frTitleFull = node.dataset.frTitleRaw || nn.textContent;
        delete nn.dataset.frTocShown;
      }
      const whole = node.dataset.frTitleFull || nn.dataset.frTitleOriginal;
      const bi = bilingual(whole);
      const full = bi ? bi.en : whole;
      ALL_TITLES.add(fold(whole));
      if (bi) { ALL_TITLES.add(fold(bi.en)); ALL_TITLES.add(fold(bi.la)); }
      out.push({ node, nn, depth, parent, full, la: bi ? bi.la : "", page: node.dataset.page, path: node.dataset.sourcePath || null });
    });
    return out;
  }

  /* What follows the heading, as a title: {text, strong, len}. Strong
     candidates are marked as titles by the page itself: a heading of
     their own, an italic argument, or a run of capitals before the text
     begins ("ON LOT AND HIS DAUGHTERS. Although they ..."). The rest
     count only when the set of siblings bears them out (see run). */
  const CAPS_RUN = /^((?:[^\p{Ll}]*?\p{Lu}{2,}){3}[^\p{Ll}]*?[.:])(?=\s|$)/u;
  function candidate(entry) {
    const found = locate(entry);
    if (!found) return null;
    // The heading on the page may carry the words the outline dropped.
    const own = found.head.rest !== undefined ? found.head.rest : ((parse(found.head.text) || {}).rest || "");
    if (/\p{L}{2}/u.test(own) && fold(own) !== fold(entry.parsed.rest)) {
      return { text: own, strong: true, len: own.length };
    }
    const n = found.next;
    if (!n) return null;
    // A heading that is itself an outline entry, or another label, is a
    // division of its own, not this one's title.
    if (ALL_TITLES.has(fold(n.text)) || LABEL.test(n.text)) return null;
    if (n.path != null && entry.path && n.path !== entry.path && !n.path.startsWith(`${entry.path}.`)) return null;
    const {text} = n;
    if (!text || !/\p{L}/u.test(text)) return null;
    if (n.head || /^\s*(?:\d{1,3}\.\s*)?\*/.test(n.raw)) return { text, strong: true, len: text.length };
    const caps = text.match(CAPS_RUN);
    if (caps) return { text: caps[1], strong: true, len: caps[1].length };
    // "On the conception of Rebecca and her delivery. 1. Regarding ...":
    // one sentence, then the numbered text.
    const numbered = text.match(/^(.{8,220}?[.?!])\s+1\.\s+\p{Lu}/u);
    if (numbered && sentences(numbered[1]).length === 1) {
      return { text: numbered[1], strong: false, len: numbered[1].length };
    }
    return { text, strong: false, len: text.length };
  }

  let busy = false;
  function apply() {
    if (busy) return;
    busy = true;
    try { run(); } finally { busy = false; }
  }

  let pending = 0;
  let english = false;
  function run() {
    english = englishShown();
    const list = rows();
    const labelled = [];
    for (const e of list) {
      const p = parse(e.full);
      if (!p) continue;
      e.parsed = p;
      e.labelRaw = e.full.slice(0, e.full.length - p.rest.length);
      labelled.push(e);
    }
    // A label behind a short run-in title ("Of Conscience.Cap. I. What
    // conscience is", the part's title printed on its first chapter)
    // counts when its siblings carry the same kind of label.
    const kinds = new Set(labelled.map((e) => `${e.parent}|${e.parsed.labels[0].fam}`));
    for (const e of list) {
      if (e.parsed) continue;
      const m = e.full.match(/^([^.:]{3,40}[.:])\s*(\S.*)$/u);
      const p = m && parse(m[2]);
      if (p && kinds.has(`${e.parent}|${p.labels[0].fam}`)) {
        e.parsed = p;
        e.labelRaw = m[2].slice(0, m[2].length - p.rest.length);
        labelled.push(e);
      }
    }
    // Siblings: same parent, same kind of division.
    const groups = new Map();
    for (const e of labelled) {
      const k = `${e.parent}|${e.parsed.labels.map((l) => l.fam).join("+")}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(e);
    }
    pending = 0;
    for (const group of groups.values()) {
      // Label spelling and numerals, by the set's majority.
      const slots = Math.max(...group.map((e) => e.parsed.labels.length));
      const kwPick = [], numPick = [];
      for (let s = 0; s < slots; s++) {
        const kc = new Map(), nc = new Map();
        for (const e of group) {
          const l = e.parsed.labels[s];
          if (!l) continue;
          kc.set(l.kw, (kc.get(l.kw) || 0) + 1);
          nc.set(l.num.kind, (nc.get(l.num.kind) || 0) + 1);
        }
        kwPick[s] = [...kc.entries()].sort((a, b) => b[1] - a[1])[0][0];
        numPick[s] = [...nc.entries()].sort((a, b) => b[1] - a[1])[0][0];
      }
      for (const e of group) {
        e.label = e.parsed.labels.map((l, s) => {
          let num = l.num.text;
          if (l.num.value && numPick[s] !== l.num.kind) {
            if (numPick[s] === "roman") num = intToRoman(l.num.value);
            else if (numPick[s] === "arabic") num = String(l.num.value);
          }
          let kw = kwPick[s] && family(kwPick[s].replace(/\.$/, "")) === l.fam ? kwPick[s] : l.kw;
          // English display: the Latin division word in English, and a
          // poem or prose section numbered 1, 2, 3 (Boethius).
          if (english) {
            kw = LAT_EN[kw.replace(/\.$/, "").toLowerCase()] || kw;
            if ((l.fam === "poem" || l.fam === "prose") && l.num.value) num = String(l.num.value);
          }
          return `${kw} ${num}`;
        }).join(". ");
        const rest = undash(unshout(clean(e.parsed.rest)));
        e.source = /\p{L}{2}/u.test(rest) ? rest : "";
        if (!e.source) e.cand = candidate(e);
      }
      // Short summary paragraphs count as arguments only when they are
      // the pattern of the set, not one chapter that opens briefly.
      const bare = group.filter((e) => !e.source);
      const shortish = bare.filter((e) => e.cand && e.cand.len <= 300);
      const summaries = bare.length >= 3 && shortish.length >= bare.length * 0.6;
      for (const e of bare) {
        const c = e.cand;
        if (c && (c.strong || (summaries && c.len <= 400))) e.source = undash(unshout(clean(c.text)));
        else if (!c) pending++;
      }
      for (const e of group) paint(e);
    }
    if (english) {
      for (const e of list) {
        if (e.shown) continue;
        const w = LAT_WORD[clean(e.full).replace(/[.:\s]+$/, "").toLowerCase()];
        if (w) { e.shown = w; e.tip = e.full; }
      }
    }
    nest(list);
    for (const e of list) write(e);
    if (pending || (!english && !document.querySelector("#reading .row"))) schedule(true);
  }

  // (2026-10-31) no title: one that only says the label again ("Chapter XII. Chapter XII" under the page's own "CAPUT XII." heading),
  // or one that is the numbered text itself, a verse or section opening "1." ("Chapter III. 1" in the Migne Scripturae Sacrae Cursus,
  // whose chapters open with the Vulgate's verse 1 in italics)
  const notTitle = (label, s) => {
    const k = (x) => String(x || "").toLowerCase().replace(/\b(?:chap(?:ter)?|cap(?:ut|itulum)?)\b\.?/g, "chapter").replace(/[^a-z0-9]+/g, " ").trim();
    return !!s && (k(s) === k(label) || /^\s*\d{1,3}(?:\s*[.)]|\s*$)/.test(s));
  };
  function paint(e) {
    let short = e.source ? shortTitle(e.source) : "";
    if (notTitle(e.label, short)) short = "";
    e.shown = short ? `${e.label}. ${short}` : e.label;
    e.tip = e.source && !notTitle(e.label, e.source) ? `${e.label}. ${e.source}` : e.full;
  }
  function write(e) {
    e.node.classList.toggle("fr-toc-sub", !!e.sub);
    if (!e.shown) {
      // An English word from an earlier pass, now that only the Latin shows.
      const nn = e.nn;
      if (nn.dataset.frTocShown != null && nn.textContent === nn.dataset.frTocShown) {
        nn.textContent = nn.dataset.frTitleOriginal;
        delete nn.dataset.frTocShown;
      }
      tip(e.node, withEcho(e.full, e.la));
      return;
    }
    if (e.nn.textContent !== e.shown) e.nn.textContent = e.shown;
    e.nn.dataset.frTocShown = e.shown;
    tip(e.node, withEcho(e.tip, e.la));
  }
  function tip(node, t) {
    if (!t) return;
    if (node.getAttribute("title") !== t) node.setAttribute("title", t);
    node.dataset.frTipShown = t;
  }

  /* Books printed as flat siblings of their sections (Boethius: "1
     METRUM PRIMUM.", "LIBER PRIMUS.", "9 PROSA PRIMA.", ...). The
     Patrologia prints the book's title after its first section's
     heading, so the outline lists "Metrum I" before "Liber I". When a
     book entry follows a section numbered 1, the two
     trade their words (both jump to the same place), and every entry
     after a book is indented under it. Display only: each link keeps
     its own original text for the click. */
  function nest(list) {
    const isBook = (e) => e.parsed && e.parsed.labels.length === 1 && e.parsed.labels[0].fam === "book";
    for (const e of list) e.sub = false;
    const books = list.filter(isBook);
    if (!books.length) return;
    const depth = books[0].depth;
    if (books.some((b) => b.depth !== depth)) return;
    // Only a flat outline: a book with its own children is already nested.
    const flat = list.filter((e) => e.depth === depth);
    if (flat.length !== list.length) return;
    if (!flat.some((e) => e.parsed && !isBook(e))) return;
    for (let k = 1; k < list.length; k++) {
      const b = list[k], p = list[k - 1];
      if (!isBook(b) || isBook(p) || !p.parsed || !p.shown || !b.shown) continue;
      if (p.parsed.labels[0].num.value !== 1) continue;
      if (k >= 2 && isBook(list[k - 2])) continue;
      list[k - 1] = b; list[k] = p;
      b.swapNode = p.node; p.swapNode = b.node;
    }
    let inBook = false;
    for (const e of list) {
      if (isBook(e)) { inBook = true; continue; }
      if (inBook) e.sub = true;
    }
    // Swapped entries paint into each other's rows.
    for (const e of list) {
      if (!e.swapNode) continue;
      e.node = e.swapNode;
      e.nn = e.node.querySelector(".nn-t");
      delete e.swapNode;
    }
  }

  /* The engine reads the clicked entry's text to find the heading on the
     page: give it its own text for the length of the click. */
  let swapping = false;
  nav.addEventListener("click", (ev) => {
    const row = ev.target.closest && ev.target.closest(".nav-node");
    const nn = row && row.querySelector(".nn-t");
    if (!nn || nn.dataset.frTitleOriginal == null || nn.dataset.frTocShown == null) return;
    const shown = nn.dataset.frTocShown;
    if (nn.textContent !== shown) return;
    swapping = true;
    nn.textContent = nn.dataset.frTitleOriginal;
    setTimeout(() => {
      if (nn.isConnected && nn.textContent === nn.dataset.frTitleOriginal) nn.textContent = shown;
      swapping = false;
    }, 0);
  }, true);

  let timer = 0, polls = 0;
  function schedule(poll) {
    clearTimeout(timer);
    if (poll) {
      if (polls > 30) return;
      polls++;
    }
    timer = setTimeout(() => { if (!swapping) apply(); else schedule(false); }, poll ? 2000 : 60);
  }
  new MutationObserver(() => { if (!swapping && !busy) schedule(false); })
    .observe(nav, { childList: true, subtree: true, characterData: true });
  // Showing or hiding the English changes the contents' words.
  const appEl = document.getElementById("app");
  if (appEl) {
    let wasEn = null;
    new MutationObserver(() => {
      const now = englishShown();
      if (now !== wasEn) { wasEn = now; schedule(false); }
    }).observe(appEl, { attributes: true, attributeFilter: ["class"] });
  }
  schedule(false);
})();
