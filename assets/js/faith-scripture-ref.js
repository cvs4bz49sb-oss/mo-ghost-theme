/*
 * Finding a scripture citation inside the text that makes it.
 *
 * The scripture index knows that Perkins cites Romans 8. For the
 * Latin Library it also knows the page, and the reader lands there.
 * For Early English Books it knows nothing but the work, and that is
 * the larger half of the index by a long way: the source ships
 * { "Romans 8": ["6", "231", …] } and no locator at all. Following one
 * of those citations opened a folio at its title page and left the
 * reader to hunt.
 *
 * So find it in the words instead. Every EEBO work arrives as a single
 * gzipped document rather than in shards, which means the whole text is
 * already in the page when the reader asks — the citation can be
 * matched, marked and scrolled to without another request.
 *
 * The hard part is that nobody wrote "Romans 8". Between 1473 and 1700
 * a printer wrote Rom. 8, Rom. viii, Roman. 8, Romans viij, or Rom.
 * 8. 28, and set J as I, so John is Iohn and James is Iames. The
 * pattern below accepts any prefix of the book's name three letters or
 * longer, an optional stop, an optional ordinal in arabic or roman, and
 * the chapter in either numeral.
 */
(function () {
  // Book names whose usual citation form is not a prefix of the name.
  //
  // Mostly this is the Vulgate name, which is what an English writer of
  // the period reached for: Isaiah is Esay or Esaie almost everywhere
  // before the Authorised Version settles it, Hosea is Osee, Revelation
  // is the Apocalypse. Sampling the collection, Esay accounts for more
  // citations of Isaiah than Isaiah does.
  const ALIAS = {
    "Song of Songs": ["Canticles", "Cantica", "Song of Solomon", "Cant"],
    Revelation: ["Apocalypse", "Apocalips", "Apoc", "Revelacion"],
    Ecclesiasticus: ["Ecclus", "Sirach"],
    Psalms: ["Psalter", "Psalmes"],
    Acts: ["Actes"],
    Isaiah: ["Esay", "Esaie", "Esa", "Isai"],
    Jeremiah: ["Ieremie", "Jeremy", "Ieremy"],
    Ezekiel: ["Ezechiel"],
    Hosea: ["Osee"],
    Obadiah: ["Abdias"],
    Jonah: ["Jonas"],
    Micah: ["Micheas"],
    Habakkuk: ["Abacuc"],
    Zephaniah: ["Sophonias"],
    Haggai: ["Aggeus"],
    Zechariah: ["Zacharias", "Zachary"],
    Malachi: ["Malachias", "Malachy"],
    Wisdom: ["Sapientia", "Sapience", "Sap."],
    "1 Chronicles": ["Paralipomenon"],
    "2 Chronicles": ["Paralipomenon"],
    Proverbs: ["Prouerbes"],
  };

  // Three letters is the floor, which is what a printer set: Rom.,
  // Gen., Heb. These are the names where three would collide with
  // another book or with an ordinary English word. "Son" for the Song
  // of Songs would match every occurrence of the word son; "The" for
  // Thessalonians is worse; Jude, Judges and Judith are all "Jud".
  const MIN = {
    Psalms: 2,
    "Song of Songs": 8,
    "1 Thessalonians": 4, "2 Thessalonians": 4,
    Jude: 4, Judges: 4, Judith: 4,
    Philippians: 4, Philemon: 6,
    Ecclesiastes: 5, Ecclesiasticus: 7,
  };

  const ORDINAL = {
    1: "(?:1|I|First)", 2: "(?:2|II|Second)", 3: "(?:3|III|Third)",
  };

  const ROMAN = [
    [1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"],
    [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"],
  ];

  function roman(n) {
    let v = parseInt(n, 10);
    if (!v || v < 1 || v > 200) return "";
    let out = "";
    ROMAN.forEach(([val, sym]) => {
      while (v >= val) { out += sym; v -= val; }
    });
    return out;
  }

  // The subtractive form is the modern convention. A seventeenth
  // century printer was as likely to set the additive one, so Job 14
  // is xiiij as often as it is xiv, and matching only the tidy form
  // missed it.
  const ADDITIVE = [["cm", "dcccc"], ["cd", "cccc"], ["xc", "lxxxx"], ["xl", "xxxx"], ["ix", "viiii"], ["iv", "iiii"]];
  function romanAdditive(n) {
    let r = roman(n);
    if (!r) return "";
    ADDITIVE.forEach(([sub, add]) => { r = r.replace(sub, add); });
    return r;
  }

  function esc(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // "Corinthians" with a floor of 3 becomes
  // Cor(?:i(?:n(?:t(?:h(?:i(?:a(?:n(?:s)?)?)?)?)?)?)?)?
  // which matches Cor, Cori, Corinth and the whole word, and nothing
  // shorter. Written as nested options rather than a list because the
  // list for a long book name runs to a dozen alternatives.
  function prefixes(word, min) {
    const w = esc(word);
    const floor = Math.min(min || 3, w.length);
    let out = "";
    for (let i = w.length; i > floor; i -= 1) {
      out = `(?:${w[i - 1]}${out})?`;
    }
    return w.slice(0, floor) + out;
  }

  // J was set as I throughout the period, and u and v were one letter.
  // Applied to the name, not to the reader's own text, so the pattern
  // widens rather than the corpus being rewritten.
  function earlyModern(pattern) {
    // u and v first, then J: the J rule introduces a character class
    // and a second pass over it would rewrite its own output.
    return pattern
      .replace(/[uv]/g, "[uv]")
      .replace(/J/g, "[IJ]").replace(/j/g, "[ij]");
  }

  function bookPattern(book) {
    const name = String(book || "").trim();
    if (!name) return "";
    const m = name.match(/^([123])\s+(.*)$/);
    const stem = m ? m[2] : name;
    // An alias written with its stop, "Sap.", must be followed by one:
    // Wisdom is cited 3,910 times in this collection and almost always
    // as Sap., but sap is also an English word, and "the sap 1 of the
    // vine" is not a citation. The stop is matched by lookahead so it
    // stays available as the separator before the chapter.
    const alts = [prefixes(stem, MIN[name] || MIN[stem] || 3)]
      .concat((ALIAS[name] || []).map((a) => (a.slice(-1) === "."
        ? `${esc(a.slice(0, -1))}(?=\\.)`
        : prefixes(a, Math.min(4, a.length)))));
    let body = `(?:${alts.join("|")})`;
    if (m) body = `${ORDINAL[m[1]]}\\s*\\.?\\s*${body}`;
    return earlyModern(body);
  }

  function chapterPattern(chapter) {
    const n = parseInt(chapter, 10);
    if (!n) return "";
    // Printers set a terminal i as j: viij for 8, xiiij for 14.
    const forms = [roman(n), romanAdditive(n)]
      .filter((r, i, a) => r && a.indexOf(r) === i)
      .map((r) => r.replace(/i$/, "[ij]"))
      // Longest first, so xiiij is tried before xiij would half-match.
      .sort((a, b) => b.length - a.length);
    return `(?:${n}|${forms.join("|")})`;
  }

  // A verse, when the index knows one, makes the match exact: a work
  // that cites Romans 8 four times and Romans 8:28 once should open at
  // the 28, not at the first mention of the chapter.
  function pattern(book, chapter, verse) {
    const b = bookPattern(book);
    const c = chapterPattern(chapter);
    if (!b || !c) return null;
    const v = parseInt(verse, 10);
    if (v > 0) {
      try {
        return new RegExp(
          `\\b${b}[\\s.,:]{1,4}${c}[\\s.,:]{1,4}${v}(?![0-9])`, "i"
        );
      } catch (_) { return null; }
    }
    // A citation is the book, then a separator, then the chapter. The
    // separator is required rather than optional: without it the roman
    // numeral for chapter 1 matched the i inside the book's own name,
    // so every mention of Genesis was read as a citation of Genesis 1.
    //
    // The trailing guard keeps Romans 8 out of Romans 80 and Luke xv
    // out of Luke xvi.
    try {
      return new RegExp(`\\b${b}[\\s.,:]{1,4}${c}(?![0-9A-Za-z])`, "i");
    } catch (_) {
      return null;
    }
  }

  // First occurrence in the rendered text. Returns the text node and
  // the offsets, so the caller can wrap exactly the citation rather
  // than highlighting a whole paragraph.
  function locate(root, book, chapter, verse) {
    const re = pattern(book, chapter, verse);
    if (!re || !root) return null;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || node.nodeValue.length < 3) return NodeFilter.FILTER_REJECT;
        const p = node.parentNode;
        // The citation chips and the reader's own chrome carry
        // references too, and a hit there scrolls nowhere.
        if (p && p.closest && p.closest(".faith-cite, .faith-find, .faith-notebook, .faith-toc-sidebar")) {
          return NodeFilter.FILTER_REJECT;
        }
        return re.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const node = walker.nextNode();
    if (!node) return null;
    const m = node.nodeValue.match(re);
    if (!m) return null;
    return { node, index: m.index, length: m[0].length };
  }

  window.MOScriptureRef = { pattern, locate, roman };
}());
