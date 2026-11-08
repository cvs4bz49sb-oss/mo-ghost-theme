/* WHERE A COMMENTARY OPENS ON A VERSE (2026-10-19, owner: "the commentary needs to open to the actual commentary on the verse, not
   the place where the commentary reproduces the verse that's selected").

   Pure functions, no DOM, so scripts/check-commentary-anchor.mjs can run them on real page text. commentary-pane.js uses them.

   The trap this file exists for. A commentary prints the chapter's text before it comments on it (the lemma): "1. In the beginning
   God created the heaven and the earth. 2. And the earth was void …", a numbered line for every verse. A search for "the paragraph
   that starts with the verse's number" lands on that copy of the text, and the reader is shown the Bible again where the
   commentator's own note should be. Three things tell the two apart:
     - the note usually carries a heading word ("Vers. 1.", "Verse 12.");
     - the copy is a run of numbered lines whose numbers climb by one (1., 2., 3. …), or one paragraph with several verse marks in it;
     - the library files a page that merely prints the verse as `quotation`, and one that discusses it as `explicit` or `exegesis`.
   Where the library has indexed a note for the verse itself (`exegesis`, "Its note on this verse") that page is trusted and nothing
   here second-guesses it, save one case: a page that carries the verse only in the text printed ahead of the notes, with no note
   on it, gives way to the page where the note follows (2026-11-08, Calvin; noteAfterText); everything else below is for the
   commentaries that have no such row. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FRCommentaryAnchor = api;
}(typeof window !== 'undefined' ? window : globalThis, () => {
  'use strict';

  const HEAD = '(?:ver(?:s(?:e|us)?)?\\.?\\s*|v\\.\\s*)';
  const strongRx = (n) => new RegExp(`^${HEAD}\\(?${n}\\b\\s*[.:,)\\]]`, 'i');
  // a bare numbered line; "31:35" opens with a chapter and its verse (Aquinas on Jeremiah), not with verse 31 (2026-11-08: Aquinas's
  // lemma "31:35 Thus says the Lord" was marked as his note on Jeremiah 31:31)
  const bareRx = (n) => new RegExp(`^\\(?${n}\\b(?!\\s*:\\s*\\d)\\s*[.:,)\\]]`);
  // a bare numbered line; a number in parentheses is a footnote mark, not a verse, and is not counted
  const bareNum = (s) => { const m = /^(\d{1,3})(?!\s*:\s*\d)\s*[.:)\]]\s*\S/.exec(s); return m ? +m[1] : null; };
  const romanNum = (r) => {
    const V = { I: 1, V: 5, X: 10, L: 50, C: 100 }, u = String(r).toUpperCase();
    let n = 0;
    for (let i = 0; i < u.length; i += 1) { const x = V[u[i]], y = V[u[i + 1]] || 0; if (!x) return NaN; n += x < y ? -x : x; }
    return n;
  };
  const WORDNUM = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN',
    'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN', 'TWENTY'];
  const numOf = (x) => (/^\d+$/.test(x) ? +x : WORDNUM.includes(String(x).toUpperCase()) ? WORDNUM.indexOf(String(x).toUpperCase()) + 1 : romanNum(x));

  /* THE VERSE A HEADING NAMES (2026-11-08, owner: "do more testing and then fix"; a survey of 2,674 landings over 80 verses). A note's
   * heading names its verse in more forms than "Vers. 1.", and none of these was read:
   *   - in brackets, after the section's or the column's own number: "(Vers. 14.)", "305 (Chap. I.--Ver. 1.)" (Jerome, the default
   *     commentary on the Prophets, which opened at the library's page with nothing marked), "2. [vers. 2, 3.]" (Augustine on the
   *     Psalms), "28. (Vers. 13, 14)." (Bonaventure);
   *   - several verses, as a list or a range: "VERSES 6, 7.", "VERS. 2-3.--", "Verses 1–3." (the catenae, the Gloss, Benson);
   *   - the chapter in Roman numerals: "LII. [Ib. XXI, 13.]", "[Gen. XV, 6.]" (Augustine's Questions), "TO GENESIS CHAP. I. v. I." (Calov);
   *   - Hammond's "Paraphrase. 10." and "Paraphrase 4, 5, 6.": he prints the verses, then his paraphrase of them, which is his comment
   *     (the reader was shown the verse he prints, marked as his note; on Hebrews 6:4, the verse alone, a line of his text).
   * verseHead(s) gives {a, b, list, chap}: every verse the heading names, and the chapter where it names one. A heading for another
   * chapter names none of this one's verses: Jerome's "(Chap. XIV.--Ver. 3.)" is not his note on Genesis 12:3. The number before a
   * bracket is the section's or the column's, never the verse: Augustine's "7. [vers. 8.]" is his note on verse 8, and it was marked as
   * his note on Psalm 2:7. "(Vers. 6 seqq.)" names its first verse only, as the print gives no end to it. A verse followed by a comment
   * with no such word is left as it is: the Catena Aurea's "26. And as they were eating …", then "Jerome When the typical Passover …",
   * cannot be told from a heading followed by its text (Willet's "3. The Exegesis or Theological Explication.", then "QVEST. I. …"), and
   * Baxter's and Patrick's verse is followed by their paraphrase under the same number. */
  const VWORD = '(?:ver(?:s(?:e|es|us)?)?\\.?|vv?\\.|paraphrase\\.?)';
  const CWORD = '(?:chap(?:ter)?|cap(?:ut)?)\\.?\\s*([IVXLC]+|\\d{1,3})\\.?';
  const H_LEAD = new RegExp(`^(?:\\d{1,4}|[IVXLC]{1,7})\\.?\\s+(?=[(\\[]|${CWORD}\\s*[-\\u2013\\u2014]{1,2}\\s*[(\\[])`, 'i');
  const H_CHAP_OUT = new RegExp(`^${CWORD}\\s*[-\\u2013\\u2014]{1,2}\\s*(?=[(\\[])`, 'i');
  const H_CHAP_IN = new RegExp(`^${CWORD}\\s*(?:[-\\u2013\\u2014]{1,2}|,)\\s*`, 'i');
  const H_WORD = new RegExp(`^${VWORD}\\s*\\(?(\\d{1,3})(?!\\d)`, 'i');
  const H_QUAEST = /^(?:Ib(?:id)?|[A-Z][a-z]{1,5})\.\s*([IVXLC]+)\s*,\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\s*\.?\s*\]/;
  // (the chapter's numeral ends at a stop, a comma or a space, and so does the verse's word: "CHAP. XVII." is no chapter X with a verse
  // II, and Piscator's "ANALYSIS CHAP. V. VI. &" no chapter V with a verse I)
  const H_ROMAN = /^(?:[A-Z]{2,}\s+){0,3}(?:CHAP|Chap|CAP|Cap)\.?\s*([IVXLC]+|\d{1,3})(?:\.\s*,?\s*|\s*,\s*|\s+)[Vv](?:[Ee][Rr](?:[Ss](?:[Ee]|[Uu][Ss])?)?)?(?:\.\s*|\s+)([IVXLC]+|\d{1,3})\s*[.:,]/;
  const spanOf = (a, b) => Array.from({ length: b - a + 1 }, (_, k) => a + k);
  function verseHead(s) {
    // (a part of a psalm's division ahead of its verse: Lombard's "PART II. VERS. 2.--")
    let t = String(s || '').replace(/^#{1,6}\s+/, '').replace(/^\s+/, '').replace(/^part\s+[IVXLC]+\.?\s*(?:[-–—]{1,2}\s*)?(?=ver|vv?\.)/i, '');
    let chap = null, m = H_ROMAN.exec(t);
    if (m) { const c = numOf(m[1]), v = numOf(m[2]); return c > 0 && v > 0 ? { a: v, b: v, list: [v], chap: c, br: false } : null; }
    const lead = H_LEAD.exec(t);
    if (lead) t = t.slice(lead[0].length);
    if ((m = H_CHAP_OUT.exec(t))) { chap = numOf(m[1]); t = t.slice(m[0].length); }
    const br = /^[(\[]\s*/.exec(t);
    if (br) t = t.slice(br[0].length);
    else if (lead) return null; // a number before a heading is the section's only where a bracket follows it
    if (br && (m = H_CHAP_IN.exec(t))) { chap = numOf(m[1]); t = t.slice(m[0].length); }
    if (br && br[0][0] === '[' && chap == null && (m = H_QUAEST.exec(t))) {
      const a = +m[2], b = m[3] ? +m[3] : a;
      return b >= a && b - a <= 40 ? { a, b, list: spanOf(a, b), chap: romanNum(m[1]), br: true } : null;
    }
    if (!(m = H_WORD.exec(t))) return null;
    // the verses: one, a list, or a range ("2, 3", "13-15", "9 and 10"), always climbing ("V. 3, 1 Cor. 2:9" is verse 3 and a citation)
    const a = +m[1], list = [a];
    let b = a, pos = m[0].length;
    for (;;) {
      const x = /^\s*(,|&|and\b|to\b|[-–—])\s*(\d{1,3})(?!\d)/i.exec(t.slice(pos));
      if (!x || +x[2] <= b || +x[2] - a > 40) break;
      if (/^(?:,|&|and)$/i.test(x[1])) list.push(+x[2]); else for (let k = b + 1; k <= +x[2]; k += 1) list.push(k);
      b = +x[2]; pos += x[0].length;
    }
    const rest = t.slice(pos).replace(/^\s*(?:et\s+)?(?:seqq?|sqq?|ff?)\.?/i, '');
    return /^\s*(?:[.:,;)\]–—-]|$)/.test(rest) ? { a, b, list, chap, br: !!br } : null;
  }
  // the first verse a heading names, in any chapter
  const strongNum = (s) => { const h = verseHead(s); return h ? h.a : null; };
  // a bare numbered line whose first words are set in capitals: how some commentaries head a note ("3. AND GOD SAID - by word")
  const capsNum = (s) => { const m = /^(\d{1,3})\s*[.:]\s+["\u201c\u2018']?[A-Z]{2,}[A-Z\u2019' ,;.-]*[A-Z]/.exec(s); return m ? +m[1] : null; };
  const isHead = (s) => /^#{1,6}\s+/.test(s);

  // CRITICAL APPARATUS (2026-10-19). A scholarly edition prints its editors' notes at the foot of each page: Weimar Luther runs
  // them as short lines that begin with the line number of the text they gloss and give the variant readings of the early printings
  // under their sigla ("17 jha B", "20 ynn] jhn B augenplick B sag C", "16 zu Zeit fuer (vor B ) Gott ungemessen . r ABCD",
  // "[zu Bl. A5 a Terra quae bis A6 a tenens vgl. R 99, 32 – 101, 24]"). They are the editors' words about the printing, never the
  // author's commentary, and "13 zu Inanis et vacua" must not be read as a note on verse 13. isApparatus() recognizes one such
  // paragraph, on shape alone, with no word list of any one language. It is deliberately narrow: it wants a line number or a
  // bracketed "[zu Bl. …]" at the start, AND siglum letters (isolated capitals A to H, or Rorer's "r") standing after words, so a
  // paragraph of prose that merely mentions a letter, or a numbered verse ("13. And God said"), is not caught.
  const SIGLUM = /^[A-H]{1,4}$/;
  function siglaIn(words) {
    let n = 0;
    for (let i = 1; i < words.length; i += 1) {
      const w = words[i];
      if (SIGLUM.test(w) && !(w === 'A' && /[.!?]$/.test(words[i - 1]))) n += 1; // "…it was so. A great question" is a sentence, not a siglum
      else if (w === 'r' && (words[i - 1] === '.' || SIGLUM.test(words[i + 1] || ''))) n += 1; // Rorer's manuscript, "… rohe . r"
    }
    return n;
  }
  // text with no line number that is nonetheless a run of variant readings: three or more sigla, a fifth of its words
  function sigRun(t) {
    const words = t.split(/\s+/);
    if (words.length > 80) return false;
    const n = siglaIn(words);
    return n >= 3 && n / words.length >= 0.2;
  }
  function isApparatus(s) {
    const t = String(s || '').trim();
    if (!t || t.length > 700 || /^#{1,6}\s/.test(t)) return false;
    if (/^\[(?:zu|vgl\.?|Bl\.)\s/.test(t) && /\]$/.test(t)) return true; // "[zu Bl. A5 a Terra quae bis A6 a … vgl. R 99, 32 – 101, 24]"
    // a line number, then a space (a verse is "13." or "13)"; an apparatus line is "13 zu …", "17 jha B")
    if (!/^\d{1,3}\s+[^\d\s.:;)\]–-]/.test(t)) return (/\bvgl\./.test(t) && /\bBl\.\s*[A-H]?\d/.test(t)) || sigRun(t);
    if (/^\d{1,3}\s+zu\s/.test(t)) return true;
    const words = t.split(/\s+/), n = siglaIn(words);
    return n >= 1 && words.length <= 60 && n / words.length >= 0.1;
  }
  // the indexes of the apparatus paragraphs of a page
  const apparatusIndexes = (paras) => { const out = new Set(); (paras || []).forEach((s, i) => { if (isApparatus(s)) out.add(i); }); return out; };
  // the share of a page's characters that are apparatus: a page that is nearly all of it holds no commentary
  const apparatusShare = (paras) => {
    let all = 0, app = 0;
    for (const s of paras || []) { all += s.length; if (isApparatus(s)) app += s.length; }
    return all ? app / all : 0;
  };

  // A NOTE THAT QUOTES ITS VERSE (2026-11-08, QA on John 1:1). A commentary that annotates verse by verse opens each note with the
  // verse's number and its first words, closed by a bracket: "32. I saw the Spirit … descending like a dove] Either in the form of
  // …" (Poole's Synopsis), "9. Erat lux vera] Or, That light …" (the Critici Sacri). Such notes count up one by one as the reprinted
  // text does: Poole's twelve notes on John 1:32-43 on p. 595 were taken for the chapter's text, the section was started there,
  // and his note on 1:1 at p. 584, which the map and the library both give, was passed over ("No note on John 1:1 was found").
  // The bracket with the comment after it marks a note, so such a paragraph is never counted as the text. A bracket that closes
  // one opened before it ("the law [109] is manifested", a footnote's number; "[vers. 1.]") is not this one, nor one that only
  // closes the verse (Hammond prints his text "42. So also is the resurrection of the dead … raised in incorruption.]").
  function quotesVerse(s) {
    const t = String(s || '');
    let open = 0;
    for (let i = 0; i < Math.min(t.length, 300); i += 1) {
      if (t[i] === '[') open += 1;
      else if (t[i] === ']') { if (!open) return t.length - i > 20; open -= 1; }
    }
    return false;
  }
  // the highest verse mark a paragraph carries after its own number, counting on from it ("1. Have mercy upon me … 2. Multiply to
  // wash me …" carries verses 1 and 2)
  function innerTop(s, n) {
    let top = n;
    for (const m of String(s).matchAll(/\s(\d{1,3})\.\s+\S/g)) if (+m[1] === top + 1) top += 1;
    return top;
  }

  // The indexes of paragraphs that are the Bible's own words reprinted, in two parts:
  //   text   a run of numbered lines counting up (five or more, or three and four of them short, as verses are and a commentator's
  //          notes seldom are), or a paragraph carrying several verse marks that count up inside it ("… 29. And God said: Behold
  //          … 30. and to all beasts … 31. And God saw …"): the chapter's text, as Lapide prints it ahead of his notes;
  //   ahead  a section's verses printed ahead of the notes on them, each verse twice (see below).
  // THE TEXT PRINTED AHEAD OF ITS NOTES, EVERY VERSE TWICE (2026-11-08, QA: Calvin, the default commentary on Hebrews and Romans,
  // marked only the reprinted verse as the note at Hebrews 12:1, 12:5, 12:14 and Romans 3:23). The Calvin Translation Society
  // prints each section's verses before Calvin's notes on them, every verse in the translation and then in Calvin's Latin ("1.
  // Wherefore seeing we also …", "1. Proinde nos quoque …", "2. Looking unto Jesus …", "2. Intuentes …"), or several verses to a
  // paragraph ("1. Have mercy upon me … 2. Multiply to wash me …"); then the notes start the count again ("1. Wherefore, seeing we
  // also, etc. This conclusion is …"). The numbers go 1, 1, 2, 2, so no run counting up by one was found, the English verse was
  // taken for the note, the note was ended at "2. Looking unto Jesus", and Calvin's comment was left behind "Keep reading". A run
  // of verse numbers ("1. ") each printed once or twice in a row, with at least one printed twice or one paragraph carrying the
  // next verse inside it, is that text when the paragraph straight after it starts again at the run's first number and is at
  // least twice as long as any line of the run: the first note. A commentator's own notes, one to a verse, do not start again; a
  // paraphrase printed after each verse (Baxter: "5. And ye have forgotten …", "5. Have ye forgotten the Lord's gentle words …")
  // goes on to the next verse; an outline's heads ("2. The parties resembled", "2. His brethren", "2. The extent of that
  // evidence", Gouge) start again, but with a line no longer than they are; a homily's text ("49. Respondit Nathanael … 50. …")
  // is followed by the homily's own first section ("1. Multa nobis cura …"), not by verse 49. All are left alone.
  // Some of the Society's volumes set the notes' numbers with no stop ("13 But I would not have you ignorant.", "6 Inasmuch as he
  // was in the form of God."), a shape read nowhere else (an editor's line number is set so); after such a text, and up to the
  // next one, a paragraph so numbered, within the text's verses and in their order, is a note (`notes`: index to verse).
  // TWO LINES OF ONE NUMBER, THE SECOND IN THE OTHER TONGUE (2026-11-08, owner: "do more testing and then fix"; Calvin marked the verse
  // at Hebrews 1:3, 1 John 4:8, Isaiah 40:8, Daniel 7:13). A pair such as "15. And I will put enmity between thee and the woman …" and
  // "15. Et inimicitias ponam inter te et inter mulierem …" is the text, whatever follows it: the first note was often too short to be
  // twice as long as the verse, or stood two pages on (Genesis 3 is printed on pp. 58-59, the first note on p. 60). Such a pair has
  // next to no word in common and about one length; an outline's heads (Gouge) are too short to tell. A verse and its paraphrase in one
  // tongue may share as few ("8. I am Alpha and Omega, the beginning and the ending …", then Baxter's "8. I am everlasting, before all
  // Worlds and without end …"), but both carry English's small words, which a Latin line does not.
  // A SECTION'S TEXT UNDER ITS REFERENCE (same day: Calvin on John 1:14, Psalm 3:1). The Society heads each section with the verses
  // it takes ("John 1:14", "Psalm 3:1-2", "Hebrews Chapter 12:1-3", "MATTHEW 26:26-30; MARK 14:22-26; LUKE 22:17-20") and prints
  // them under it: the numbered lines straight after such a heading, within its verses and in their order, are that text when one of
  // them is printed twice in the two tongues, or carries the next verse inside it, or when the line after them starts the count again
  // (John 1:14: the verse, then "14. And the Speech was made flesh. The Evangelist shows …", the note). Where such a section of a few
  // verses is followed by prose with no number, that prose is the comment on its first verse (`after`: verse to index; Daniel 7:13,
  // "After Daniel has narrated …").
  const wordsOf = (s) => new Set(String(s).toLowerCase().replace(/^\W*\d{1,3}\W*/, '').split(/[^a-zß-ɏ]+/).filter((w) => w.length > 2));
  const EN_SMALL = /\b(?:the|and|of|to|that|unto|shall|thou|thee|thy|his|he|which|for|with|not|was|is|be|it|they|them|their|ye|my)\b/g;
  const english = (s) => new Set(String(s).toLowerCase().match(EN_SMALL) || []).size >= 2;
  function translated(x, y) {
    if (x.length < 30 || y.length < 30 || x.length > 700 || y.length > 700 || quotesVerse(x) || quotesVerse(y)) return false;
    if (english(x) && english(y)) return false;
    const r = y.length / x.length; if (r < 0.5 || r > 2) return false;
    const a = wordsOf(x), b = wordsOf(y); if (a.size < 4 || b.size < 4) return false;
    let n = 0; for (const w of a) if (b.has(w)) n += 1;
    return n / Math.min(a.size, b.size) <= 0.15;
  }
  const REF_ONE = /^(?:(?:[1-3]|I{1,3})\s+)?[A-Z][A-Za-z]+(?:\s+(?:of\s+)?[A-Z][A-Za-z]+)?\.?\s+(?:Chapter\s+)?(\d{1,3})\s*:\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?$/;
  function refHead(s) {
    const t = String(s || '').replace(/^#{1,6}\s+/, '').trim();
    if (!t || t.length > 120) return null;
    const out = [];
    for (const part of t.split(/\s*;\s*/)) { const m = REF_ONE.exec(part); if (!m) return null; const a = +m[2], b = m[3] ? +m[3] : a; if (b < a) return null; out.push([a, b]); }
    return out;
  }
  const prose = (s) => s.length >= 80 && !/^#{1,6}\s/.test(s) && /^[«"“‘']?[A-Za-z]/.test(s) && verseHead(s) == null && refHead(s) == null;
  function lemmaParts(paras) {
    const text = new Set(), runText = new Set(), ahead = new Set(), notes = new Map(), after = new Map(), runs = [];
    const app = apparatusIndexes(paras);
    // a paragraph with a verse heading of its own ("2. [vers. 2, 3.]") is a note, never a line of the text, whatever number it opens with
    const hd = paras.map((s) => verseHead(s) != null);
    const nums = paras.map((s, i) => (app.has(i) || quotesVerse(s) || hd[i] ? null : bareNum(s)));
    for (let i = 0; i < paras.length; i += 1) {
      if (nums[i] == null) continue;
      let j = i;
      while (j + 1 < paras.length && nums[j + 1] === nums[j] + 1) j += 1;
      const run = paras.slice(i, j + 1);
      if (run.length >= 5 || (run.length >= 3 && run.every((s) => s.length < 220))) { for (let k = i; k <= j; k += 1) { text.add(k); runText.add(k); } }
      i = j;
    }
    paras.forEach((s, i) => {
      if (app.has(i) || hd[i]) return; // a note under a "Vers. N." heading may list 1. 2. 3. inside it; it is still the note
      const marks = (s.match(/\s(\d{1,3})\.\s+\S/g) || []).map((m) => parseInt(m, 10));
      if (marks.some((n, k) => marks[k + 1] === n + 1)) text.add(i);
    });
    // a verse's number as the text prints it, "12. " ("1:12 " is Aquinas's chapter and verse, read as 1 above); a note's number as
    // that, or with no stop ("13 But")
    const vn = paras.map((s, i) => { const m = nums[i] != null && /^(\d{1,3})\.\s+\S/.exec(s); return m ? +m[1] : null; });
    const wn = paras.map((s, i) => { if (vn[i] != null || app.has(i) || quotesVerse(s)) return vn[i]; const m = /^(\d{1,3})\s+["\u201c\u2018']?[A-Z]/.exec(s); return m ? +m[1] : null; });
    for (let i = 0; i < paras.length; i += 1) {
      if (vn[i] == null) continue;
      let j = i, top = innerTop(paras[i], vn[i]), shape = top > vn[i], long = paras[i].length, pair = false;
      while (j + 1 < paras.length && vn[j + 1] != null) {
        const n = vn[j + 1];
        // the same verse again (in the original), once, after a paragraph that carried that verse alone
        // (a run that opens with a verse and its translation: notes counting up before the next section's text are not that text)
        if (n === vn[j] && (j === i || vn[j - 1] !== n) && top === n) { shape = true; if (j === i && translated(paras[j], paras[j + 1])) pair = true; }
        else if (n !== top + 1) break;
        j += 1;
        top = Math.max(top, innerTop(paras[j], n));
        if (top > n) shape = true;
        long = Math.max(long, paras[j].length);
      }
      const k1 = j + 1;
      if (pair || (shape && k1 < paras.length && wn[k1] === vn[i] && paras[k1].length >= 2 * long)) {
        for (let k = i; k <= j; k += 1) ahead.add(k);
        runs.push([j + 1, vn[i], top]);
        i = j;
      }
    }
    for (let i = 0; i < paras.length; i += 1) {
      let rs = refHead(paras[i]);
      if (!rs) continue;
      let j = i;
      while (j + 1 < paras.length && refHead(paras[j + 1])) { j += 1; rs = rs.concat(refHead(paras[j])); } // the Harmony names three
      // each named passage's text is entered once, at its first verse (the Harmony's three, one after another)
      const inR = (n) => rs.some(([a, b]) => a <= n && n <= b), entered = new Set();
      const enter = (n) => { const q = rs.findIndex(([a], x) => a === n && !entered.has(x)); if (q >= 0) entered.add(q); return q >= 0; };
      const got = [];
      let last = null, twice = false, top = -1, firm = false, k = j + 1;
      for (; k < paras.length; k += 1) {
        if (app.has(k)) continue;
        const n = vn[k];
        if (n == null || !inR(n)) break;
        if (n === last) { if (twice || !translated(paras[got[got.length - 1]], paras[k])) break; twice = true; firm = true; } else {
          if (last == null) enter(n);
          else if (n <= top && !enter(n)) break; // the count starts again: the first note
          twice = false;
        }
        const t = innerTop(paras[k], n);
        if (t > n) firm = true;
        got.push(k); last = n; top = Math.max(top, t);
      }
      const nx = k < paras.length ? (vn[k] != null ? vn[k] : wn[k]) : null;
      if (got.length && (firm || (nx != null && nx <= top && inR(nx)))) {
        const a = vn[got[0]];
        for (const g of got) ahead.add(g);
        runs.push([k, a, top]);
        if (top - a <= 3 && k < paras.length && nx == null && prose(paras[k])) after.set(a, k);
      }
      i = Math.max(i, k - 1);
    }
    for (const [from, a, b] of runs) {
      let last = a;
      for (let m = from; m < paras.length && !ahead.has(m); m += 1) {
        const x = wn[m]; if (x == null) continue;
        if (x < last || x > b) break;
        notes.set(m, x); last = x;
      }
    }
    return { text, runText, ahead, notes, after, all: new Set([...text, ...ahead]) };
  }
  const lemmaIndexes = (paras) => lemmaParts(paras).all;

  // A VERSE MARKED BY ITS CHAPTER AND NUMBER IN THE RUN OF THE TEXT (2026-11-08, owner "fix this": Luther's Galatians, WA 40 I, said
  // "No note on Galatians 2:16 was found"). The Weimar edition prints the verse's place before its first words, inside the paragraph:
  // "… non solum ceremonias cavillatur. 2, 16 Scientes autem, quod non iustificatur homo ex operibus legis." (English: "… ceremonies
  // only. 2, 16 Knowing that a man is not justified …"). A marker is the chapter's number, a comma and the verse's, at a paragraph's
  // start or after a sentence's last word (a word in small letters and its stop, so "Gal. 2, 16" in a citation, or "cf. 2, 16", is
  // not one), before the verse's first word in capitals (a bare "2, 16" in the margin is a cross-reference: Rörer's notes list "2, 16", "2, 14", "2, 12"). cvMarks(s, ch) gives the markers of chapter `ch` in a paragraph:
  // [{v, at}], `at` where the marker stands.
  const CV_START = /^\s*(\d{1,3})\s*,\s*(\d{1,3})(?!\d)\s?(?=[A-Z\u00c0-\u00de\u2018\u201c'"])/;
  const CV_IN = /(^|[^A-Za-z\u00c0-\u024f])([a-z\u00df-\u024f]{3,})[.!?;:]['"\u2019\u201d\u00bb)\]]?\s{1,2}(\d{1,3})\s*,\s*(\d{1,3})(?!\d)\s?(?=[A-Z\u00c0-\u00de\u2018\u201c'"])/g;
  const CV_ABBR = new Set(['vgl', 'ibid', 'cap', 'vers', 'col', 'pag', 'fol', 'lib', 'sect', 'art', 'dist', 'etc', 'seq', 'sqq', 'supra', 'infra', 'ver', 'loc']);
  function cvMarks(s, ch) {
    const t = String(s || ''), c = Number(ch), out = [];
    if (!(c > 0)) return out;
    const m0 = CV_START.exec(t); if (m0 && +m0[1] === c) out.push({ v: +m0[2], at: 0 });
    for (const m of t.matchAll(CV_IN)) if (+m[3] === c && !CV_ABBR.has(m[2])) out.push({ v: +m[4], at: m.index + m[1].length + m[2].length + 1 });
    return out;
  }

  // The paragraph where the commentator's own note on verse `printed` begins, or -1. Never the reprinted text. A number in
  // parentheses is a footnote mark ("(1) Quaest. hebr. in Genes.") unless `loose` is set, which is for a page the library itself
  // indexed as holding the note (some commentaries print a psalm's verse as "(22)"). With the chapter `ch`, a verse marked by its
  // chapter and number in the run of the text ("2, 16 Scientes autem") is found too.
  // (2026-11-08) The heading is any of verseHead's forms, of this chapter (a heading that names another chapter, and those after it,
  // are that chapter's), the narrowest where several name the verse ("VERS. 8.--" before "VERS. 1-8.--"). A paragraph that carries
  // such a heading is never read by the number it opens with: "7. [vers. 8.]" is not verse 7. `skip`, the section's reprinted text as
  // the resolver read it over its pages (a text that runs over a page break is not seen whole on one page), is never the note.
  function findNote(paras, printed, loose, ch, skip) {
    const { all: lemma, notes, after } = lemmaParts(paras), app = apparatusIndexes(paras);
    const v = +printed, bx = bareRx(printed), off = (k) => app.has(k) || !!(skip && skip.has(paras[k]));
    // the chapter a paragraph stands under, by a heading on a line of its own ("CHAPTER ONE.", Piscator's "ANALYSIS CHAP. V. VI. &")
    let hc = null;
    const under = paras.map((s) => { const m = chapterHead(s, false) || chapterHead(s, true); if (m) hc = m; return hc; });
    // (a note under a heading of another chapter is that chapter's: Psalm 33's "1. REjoyce in the LORD" below "PSAL. XXXIII.", on the
    // page Poole's Annotations are indexed at for Psalm 32; a psalm's number in the Vulgate's count is this one's)
    const mine = (k) => ch == null || under[k] == null || under[k] === +ch || vulgateOf(+ch).includes(under[k]);
    let i = -1, width = Infinity, cur = null;
    for (let k = 0; k < paras.length; k += 1) {
      // past a chapter's heading, once the verse's heading is found, what follows is the next chapter's (Lombard's Philemon "VERS. 1-6.--"
      // after his Titus 3 "VERS. 1-15.--" is no narrower note on Titus 3:5)
      if (i >= 0 && under[k] !== under[i]) break;
      const h = app.has(k) ? null : verseHead(paras[k]);
      if (!h) continue;
      if (h.chap != null) cur = h.chap;
      if (ch != null && cur != null && cur !== +ch) continue;
      // the heading word marks a note even where the note lists 1. 2. 3. inside it
      if (h.list.includes(v) && h.list.length < width && !off(k) && mine(k)) { i = k; width = h.list.length; }
    }
    if (i < 0) i = paras.findIndex((s, k) => !lemma.has(k) && !off(k) && mine(k) && verseHead(s) == null && bx.test(s) && (loose || !/^\(/.test(s)));
    if (i < 0) { const q = bracketNotes(paras, app).find((x) => x[1] === v && !off(x[0]) && mine(x[0])); if (q) i = q[0]; }
    if (i < 0) for (const [k, x] of notes) if (x === v && !off(k)) { i = k; break; } // "14 For if we believe." after the text
    if (i < 0 && ch != null) i = paras.findIndex((s, k) => !off(k) && cvMarks(s, ch).some((x) => x.v === v));
    if (i < 0 && after.has(v) && !off(after.get(v))) i = after.get(v); // the comment after a section's text that opens with the verse
    if (i < 0 && ch != null) i = refNote(paras, v, +ch, off);
    return i;
  }
  /* A NOTE HEADED BY ITS SECTION'S REFERENCE (2026-11-08, survey: Calvin's Harmony of the Law, the default commentary on Exodus 20:3,
   * marked the verse it prints). Calvin's Harmonies head each passage with its reference ("Exodus 20:3"; "MATTHEW 26:26-30; MARK 14:22-26;
   * LUKE 22:17-20") and head his note on a verse with it again ("Exodus 20:3 Thou shalt have no other gods before me. In this commandment
   * God enjoins …"). A paragraph that opens with a reference of the chapter's verse, in a book a section's heading on the same pages
   * names, and goes on, is that note. */
  const REF_BOOK = /^((?:(?:[1-3]|I{1,3})\s+)?[A-Z][A-Za-z]+(?:\s+(?:of\s+)?[A-Z][A-Za-z]+)?)\.?\s+(?:Chapter\s+)?(\d{1,3})\s*:\s*(\d{1,3})(?:\s*[-\u2013]\s*(\d{1,3}))?/;
  function refNote(paras, v, ch, off) {
    const named = [];
    for (const s of paras) {
      if (!refHead(s)) continue;
      for (const part of String(s).replace(/^#{1,6}\s+/, '').trim().split(/\s*;\s*/)) {
        const m = REF_BOOK.exec(part); if (m) named.push({ book: m[1].toLowerCase(), c: +m[2], a: +m[3], b: m[4] ? +m[4] : +m[3] });
      }
    }
    if (!named.length) return -1;
    return paras.findIndex((s, k) => {
      if (off(k) || refHead(s) || s.length < 40) return false;
      const m = REF_BOOK.exec(s); if (!m || m.index !== 0 || +m[2] !== ch) return false;
      const a = +m[3], b = m[4] ? +m[4] : a;
      return a <= v && v <= b && named.some((x) => x.book === m[1].toLowerCase() && x.c === ch && x.a <= v && v <= x.b);
    });
  }
  /* NOTES NUMBERED WITH NO STOP THAT QUOTE THEIR VERSE (2026-11-08, survey: Piscator's "7 I will declare the decree] Namely, the decree
   * of Jehovah God the Father", never found). A number, a space, the verse's first words closed by a bracket and the comment after them,
   * is the note on that verse where the pages carry two or more such notes counting up and no editors' apparatus (whose lines are
   * numbered so too: Weimar's "5 Iustitiam] Iu cf P[romissionem] …"). Without the bracket, a number with no stop is left alone ("10
   * Because …", Denys): it may be anything. [index, verse] for each. */
  function bracketNotes(paras, app) {
    if (app.size) return [];
    const xs = [];
    paras.forEach((s, k) => { const m = /^(\d{1,3})\s+(?=[^\d\s.:;,)\]–-])/.exec(s); if (m && quotesVerse(s) && verseHead(s) == null) xs.push([k, +m[1]]); });
    return xs.length >= 2 && xs.every((x, j) => !j || x[1] >= xs[j - 1][1]) ? xs : [];
  }

  // the index `max` paragraphs after `start`, not counting apparatus, and carrying on over an apparatus run that follows
  function capAt(paras, start, max, app) {
    let seen = 0, j = start + 1;
    for (; j < paras.length && seen < max; j += 1) if (!app.has(j)) seen += 1;
    while (j < paras.length && app.has(j)) j += 1;
    return Math.min(paras.length, Math.max(j, start + 1));
  }

  // Where that note ends: the next heading, or the next verse's note, or the next section's verses printed ahead of their notes
  // (Calvin's note on Hebrews 12:3 ends where verses 4 to 8 are printed), or `cap` paragraphs on.
  function noteEnd(paras, start, printed, cap, ch) {
    const { all: lemma, ahead, notes } = lemmaParts(paras), app = apparatusIndexes(paras), max = cap || 14, v = +printed;
    const qs = new Map(bracketNotes(paras, app));
    let seen = 0; // the editors' notes neither end the note nor count toward the cap
    for (let j = start + 1; j < paras.length && seen < max; j += 1) {
      if (app.has(j)) continue;
      seen += 1;
      // the next verse marked in the run of the text: a paragraph that opens with it is the next note; one that has it further on
      // still ends this note, and is kept
      if (ch != null) { const nx = cvMarks(paras[j], ch).find((x) => x.v > v); if (nx) return nx.at > 0 ? j + 1 : j; }
      if (isHead(paras[j])) return j;
      // a heading of another verse, or of another chapter, begins another note; one that names this verse again does not
      const h = verseHead(paras[j]);
      if (h && (!h.list.includes(v) || (ch != null && h.chap != null && h.chap !== +ch))) return j;
      if (notes.has(j) && notes.get(j) > v) return j; // "7 Emptied himself." ends the note on verse 6
      if (qs.has(j) && qs.get(j) !== v) return j; // "8 Ask of me] …" ends Piscator's note on verse 7
      const bn = h ? null : bareNum(paras[j]);
      if (bn != null && bn > v && (!lemma.has(j) || ahead.has(j))) return j;
    }
    return capAt(paras, start, max, app);
  }

  // Whether a page's one-line gist, as the reception file carries it, is about this verse: 'yes' (it names a range holding the verse
  // in this chapter of this book), 'no' (it names verses, but not this one), or 'unknown' (it names none). "A commentary on
  // Genesis 1:3-4 …" is 'no' for 1:1; "… on 2 Peter 1:1" is 'no' for Genesis 1:1.
  const ROMAN = { i: '1', ii: '2', iii: '3' };
  const SHORT = { mt: 'matthew', mk: 'mark', mc: 'mark', lk: 'luke', jn: 'john', jhn: 'john', ps: 'psalms', pss: 'psalms', gen: 'genesis', ex: 'exodus',
    lev: 'leviticus', num: 'numbers', dt: 'deuteronomy', deut: 'deuteronomy', canticles: 'song of solomon', song: 'song of solomon', sam: 'samuel',
    kgs: 'kings', chr: 'chronicles', cor: 'corinthians', thess: 'thessalonians', tim: 'timothy', pet: 'peter', rom: 'romans', heb: 'hebrews' };
  function gistClaims(gist, bookName, ch, v) {
    const g = String(gist || '');
    const rx = /(?:^|[^A-Za-z0-9])((?:[1-3]|I{1,3})\.?\s+)?([A-Z][a-z]{1,11})\.?\s+(\d{1,3})\s*[:.]\s*(\d{1,3})(?:\s*[-\u2013\u2014]\s*(\d{1,3}))?/g;
    const mine = /^\s*([1-3]|I{1,3})\.?\s+(.*)$/.exec(String(bookName || '')), num = mine ? (ROMAN[mine[1].toLowerCase()] || mine[1]) : '';
    const book = (mine ? mine[2] : String(bookName || '')).toLowerCase();
    let m, any = false;
    while ((m = rx.exec(g))) {
      any = true;
      const pre = m[1] ? (ROMAN[m[1].replace(/\./, '').trim().toLowerCase()] || m[1].replace(/\./, '').trim()) : '';
      let word = m[2].toLowerCase();
      word = SHORT[word] || word;
      const same = pre === num && word.length >= 2 && (book === word || book.startsWith(word) || book.endsWith(` ${word}`) || word.startsWith(book));
      const a = +m[4], b = m[5] ? +m[5] : a;
      if (same && +m[3] === +ch && a <= v && v <= b) return 'yes';
    }
    return any ? 'no' : 'unknown';
  }

  // The pages worth opening to look for the commentary's note on verse `v`, from the chapter file's rows for that verse: only
  // pages the library files as discussing the verse (not as printing it), only those not plainly about another verse or book;
  // those that name the verse first, then by page. Returns [{p, claim}].
  function candidatePages(rows, slug, bookName, ch, v) {
    const seen = new Map();
    for (const r of rows || []) {
      if (r.w !== slug || (r.how !== 'explicit' && r.how !== 'exegesis')) continue;
      const claim = gistClaims(r.g, bookName, ch, v);
      if (claim === 'no') continue;
      const p = +r.p; if (!(p > 0)) continue;
      if (!seen.has(p) || claim === 'yes') seen.set(p, claim);
    }
    return [...seen].map(([p, claim]) => ({ p, claim }))
      .sort((x, y) => (x.claim === y.claim ? x.p - y.p : x.claim === 'yes' ? -1 : 1));
  }

  // A LECTURE HEADED BY THE VERSES IT TAKES (2026-11-08, QA on Romans 3:23). Aquinas's lectures open "L. 3 (3:21–26) Christ the
  // redemption for all …", a lecture to a page, with no heading inside them for a verse; none of his notes on Romans 3 is indexed, so
  // the pane opened Romans 3:23 at the chapter's first page, Lecture 1 on 3:1-8. A paragraph that opens with a lecture's (homily's,
  // sermon's, tractate's) number and a range in parentheses gives the verses of chapter `ch` it takes, {a, b}, or null: "(3:21–26)"
  // is 21 to 26 of chapter 3, "(2:28–3:8)" is 1 to 8 of chapter 3 and 28 on of chapter 2.
  const RANGE = /^(?:#{1,6}\s+)?(?:L|Lect(?:ure|io)?|Lesson|Hom(?:ily|ilia)?|Sermo(?:n)?|Tract(?:ate|atus)?)\.?\s*(?:[IVXLC]+|\d{1,3})\.?\s*\(\s*(\d{1,3})\s*:\s*(\d{1,3})(?:\s*[-\u2013\u2014]\s*(?:(\d{1,3})\s*:\s*)?(\d{1,3}))?\s*\)/i;
  // (2026-11-08, owner "fix this": Augustine's Tractates on John said "No note on John 1:1 was found" at col. 35, the head of Tractate
  // I) Migne's heads give the chapter and verses after the tractate's subject: "TRACTATUS I. In illud Joannis, In principio erat Verbum
  // … usque ad id, Et tenebrae eam non comprehenderunt. Cap. I, V. 1-5." ("Chap. I, V. 1-5."). A heading that opens with the
  // division's word and number and names, in its first lines, the chapter and its verses, gives them too.
  const DIV_HEAD = /^(?:#{1,6}\s+)?\W*(?:L|Lect(?:ure|io)?|Lesson|Hom(?:ily|ilia)?|Sermo(?:n)?|Tract(?:ate|atus)?|Enarratio|Concio)\.?\s*(?:[IVXLCDM]+|\d{1,3})\b/i;
  const CAP_V = /\b(?:Cap(?:ut|itulum)?|Chap(?:ter)?)\.?\s*([IVXLC]+|\d{1,3})\s*[,.;]?\s*(?:V|Vv|Vers(?:e|us)?|Ver)\\?\.?\s*(\d{1,3})(?:\s*(?:[-\u2013\u2014]|ad|to)\s*(\d{1,3}))?/gi;
  function rangeOf(s, ch) {
    const t = String(s || ''), m = RANGE.exec(t);
    if (!m) {
      if (!DIV_HEAD.test(t)) return null;
      for (const x of t.slice(0, 600).matchAll(CAP_V)) {
        const c1 = /^\d+$/.test(x[1]) ? +x[1] : romanNum(x[1]), a = +x[2], b = x[3] ? +x[3] : a;
        if (c1 === +ch && b >= a) return { a, b };
      }
      return null;
    }
    const c = +ch, c1 = +m[1], a = +m[2], c2 = m[3] ? +m[3] : c1, b = m[4] ? +m[4] : a;
    if (c1 === c && c2 === c) return b >= a ? { a, b } : null;
    if (c1 === c && c2 > c) return { a, b: Infinity };
    if (c1 < c && c2 === c) return { a: 1, b };
    return null;
  }

  /* A CHAPTER'S OWN HEADING (2026-11-08, survey): "CHAPTER XII.", "CHAP. 7.", "Chapter 1", "CAPUT V.", "COMMENTARY ON GENESIS, CHAP.
   * III.", "PSALM LI.", "ENARRATION ON PSALM II. A psalm of David …": the whole paragraph, or set in capitals at its start with a title
   * after it. The word is the book's, a psalm's for the Psalms and a chapter's for the rest (Lapide's essay on the six days cites "Psalm
   * CIII." on a line of its own). chapterHead(s, psalms) gives its number, or 0. */
  const CH_WORD = { ps: '(?:[Pp]sal(?:m(?:us|i)?)?|PSAL(?:M(?:US|I)?)?)', ch: '(?:[Cc]hap(?:ter)?|CHAP(?:TER)?|[Cc]ap(?:ut|itulum)?|CAP(?:UT|ITULUM)?)' };
  const CH_CAPS_WORD = { ps: 'PSAL(?:M(?:US|I)?)?', ch: '(?:CHAP(?:TER)?|CAP(?:UT|ITULUM)?)' };
  const CH_ALONE = {}, CH_CAPS = {};
  for (const k of ['ps', 'ch']) {
    CH_ALONE[k] = new RegExp(`^(?:#{1,6}\\s+)?(?:[A-Z][A-Za-z]*,?\\s+){0,4}${CH_WORD[k]}\\.?\\s+([IVXLC]+|\\d{1,3}|${WORDNUM.join('|')})\\.?\\s*$`);
    CH_CAPS[k] = new RegExp(`^(?:#{1,6}\\s+)?(?:[A-Z]+,?\\s+){0,4}${CH_CAPS_WORD[k]}\\.?\\s+([IVXLC]+|\\d{1,3}|${WORDNUM.join('|')})\\.(?:\\s|$)`);
  }
  function chapterHead(s, psalms) {
    const t = String(s || '').trim(), k = psalms ? 'ps' : 'ch';
    if (!t) return 0;
    // (in capitals at its start, a heading may run on into the chapter's argument: "PSAL. XXXIII. The ARGUMENT. This Psalm contains …",
    // Poole's Annotations; "CHAP. III. PVt them in remembrance …", Taylor)
    const m = (t.length <= 160 && CH_ALONE[k].exec(t)) || CH_CAPS[k].exec(t);
    return (m && numOf(m[1])) || 0;
  }
  // the Vulgate's number for a psalm (the Hebrew's 11 is its 10), which a Latin commentary's heading gives
  const vulgateOf = (n) => (n <= 8 ? [n] : n <= 10 ? [9] : n <= 113 ? [n - 1] : n <= 115 ? [113] : n === 116 ? [114, 115] : n <= 146 ? [n - 1] : n === 147 ? [146, 147] : [n]);
  // the psalms whose title the Hebrew and the Vulgate count as a verse of its own (as two in 51, 52, 54 and 60), and the English not
  const TITLED = { 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 12: 1, 13: 1, 18: 1, 19: 1, 20: 1, 21: 1, 22: 1, 30: 1, 31: 1, 34: 1, 36: 1, 38: 1,
    39: 1, 40: 1, 41: 1, 42: 1, 44: 1, 45: 1, 46: 1, 47: 1, 48: 1, 49: 1, 51: 2, 52: 2, 53: 1, 54: 2, 55: 1, 56: 1, 57: 1, 58: 1, 59: 1, 60: 2,
    61: 1, 62: 1, 63: 1, 64: 1, 65: 1, 67: 1, 68: 1, 69: 1, 70: 1, 75: 1, 76: 1, 77: 1, 80: 1, 81: 1, 83: 1, 84: 1, 85: 1, 88: 1, 89: 1, 92: 1,
    102: 1, 108: 1, 140: 1, 142: 1 };
  const TITLE_WORDS = /^[\W\d]*(?:unto the end|for the end|to the end|in finem|(?:to|for) the chief musician|a psalm|psalmus|(?:for its |the )?title|inscription|superscription)\b/i;
  const afterHead = (s) => String(s || '').replace(/^#{1,6}\s+/, '')
    .replace(/^\s*(?:(?:\d{1,4}|[IVXLC]{1,7})\.?\s+)?[(\[][^)\]]*[)\]]\.?\s*|^\s*(?:ver(?:s(?:e|es|us)?)?\.?|vv?\.)\s*\d{1,3}(?:\s*[,–-]\s*\d{1,3})*\.?\s*/i, '');

  // The search itself. `getParas(slug, n)` gives a page's paragraphs as [english[], latin[]]. A work `c` is
  // {slug, notes: {verse: page}, rows: {verse: [row]}, pv: {verse: printed number}, open: the map's page for the chapter,
  // close: the map's page for the NEXT chapter}; `w` is {name, ch}. resolve() gives {p, how, v, indexed}, where how is, in order of
  // preference:
  //   note     the library indexed the work's own note on the verse, or its page text carries one;
  //   range    a lecture, homily or tractate headed by a range of the chapter's verses holding it begins there ({a, b});
  //   page     the library files a page as discussing the verse, lying between the notes on the verses either side of it;
  //   later    the work's next note after the verse (within four verses);
  //   nearest  its closest note before (within twelve); then a later one within twelve;
  //   chapter  the page the map gives as the chapter's opening, said to be nothing more.
  // Only pages of the commentary's own section on the chapter are looked at. The map's opening can be wrong (Lapide's vol. 1 maps
  // Genesis 1 to an essay on the six days printed ahead of his own Genesis, at p. 75; his chapter begins at p. 196, with the
  // chapter's text), so the section starts at the page that carries the longest run of reprinted verses between the map's opening
  // and the next chapter's, and ends at the next chapter's.
  function createResolver(getParas, opts) {
    const verseText = (opts && opts.verseText) || (() => '');
    const printedOf = (c, v) => (c.pv && c.pv[v]) || v;
    const memo = new Map();
    const once = (k, make) => { if (!memo.has(k)) memo.set(k, make()); return memo.get(k); };
    // The section is the chapter's pages, read once: it gives the section's start, and an index of the note headings in it ("Vers.
    // 20.", "9. LET THE WATERS", "(Vers. 14.)", "VERS. 2-3.--": a heading of several verses holds each, the narrowest heading of a verse
    // taking it), each the first heading of its number that follows the one before, so a cross-reference or a repeated number cannot
    // take it; a heading that names another chapter, and those after it, are that chapter's.
    /* THE SECTION'S BOUNDS (2026-11-08, owner: "do more testing and then fix"; a survey of 2,674 landings over 80 verses). Three faults:
     *   - the next chapter's page was left out, where the chapter's last verses often stand (Grotius on 2 Peter 1:21 at p. 126, Piscator
     *     on Genesis 12:3 at p. 75): the section now runs to the map's page for the next chapter, that page too, and stops at the next
     *     chapter's heading on it (`hi` is that last page, read);
     *   - with no next chapter on the map, or one on the same page, the section was read for 150 pages and started at the longest run of
     *     reprinted verses in them: the Westminster Annotations opened Revelation (p. 476) for verses of the Gospels and the Epistles, de
     *     Dieu his index (p. 905), Grotius his errata (p. 573), Poole's Annotations Psalm 106 for Psalm 2. The start now moves only where
     *     the next chapter's page is known and lies after this one's, and never past a later chapter's heading; otherwise forty pages
     *     are read from the map's page;
     *   - the last notes of the chapter before, above this chapter's heading on its first page (Augustine's Psalm 1 above "ENARRATION
     *     ON PSALM II."), took the index's first numbers, and this chapter's own were refused as going back: the section now starts at
     *     the chapter's own heading where it stands on the map's page or the next (for a psalm, its number or the Vulgate's).
     * The section's reprinted text is read across its pages as one run (`text`), so a text that runs over a page break is still
     * the text where it is seen on one page alone (Calvin's Genesis 1 over pp. 19-21). */
    const section = (c, w) => once(`sec|${c.slug}|${w.name}|${w.ch}`, async () => {
      const from = c.open != null ? +c.open : 0, ch = +w.ch, psalms = /^psalm/i.test(String(w.name || '').trim());
      const known = from > 0 && c.close != null && +c.close >= from;
      // with no next chapter on the map: forty pages, or as far as most of the library's own rows on the chapter's verses go (the ninth
      // tenth of them, so that a stray row on an index or another chapter does not carry it), 150 at most: Taylor's Titus 3 runs from p.
      // 539 to p. 745, Burroughs's Hosea 6 from p. 547, his note on 6:6 at p. 598
      const rowPages = [...Object.values(c.notes || {}), ...Object.values(c.rows || {}).flat().map((r) => r && r.p)].map(Number)
        .filter((p) => p >= from && p <= from + 150).sort((x, y) => x - y);
      const rowsTo = rowPages.length ? rowPages[Math.floor((rowPages.length - 1) * 0.9)] : 0;
      const end = from <= 0 ? 0 : known ? Math.min(+c.close, from + 260) : Math.max(from + 40, rowsTo);
      const pages = [];
      for (let n = from; from > 0 && n <= end; n += 1) { const [en, la] = await getParas(c.slug, n); pages.push([n, en.length ? en : la]); }
      const alias = psalms ? vulgateOf(ch).filter((m) => m !== ch) : [];
      const later = (m) => m > ch && m <= ch + 3 && !alias.includes(m);
      // the start: the chapter's own heading on the map's page or the next, else the page with the longest run of reprinted verses.
      // A psalm's own number and the Vulgate's can both stand there: Augustine's "ENARRATION ON PSALM XV." is Psalm 16, and the "XVI." on
      // his next column is Psalm 17; in a work that counts as the English does, "PSALM XV." would be the psalm before. The heading that
      // stands at or before the library's notes on the chapter (the first quarter of them, by its column) is its own, and with no note a
      // psalm's is not taken, as one number alone tells nothing there (the Gloss's page for Psalm 51 carries only "PSALM LI.", its Psalm
      // 52); a heading below the library's notes is no start (Piscator prints Isaiah 53's text, then "CHAPTER LIII."). And it is the start
      // only where another chapter's heading stands above it on its page (the Westminster Annotations print John 1, 2 and 3 on p. 399), or
      // every verse heading above it is numbered higher than the first below it (the chapter before's last notes): Lombard's "PSALM
      // XXII." stands on its column below his note on verse 1, Migne's Hosea 6 between his last notes on chapter 5.
      let p0 = 0, i0 = 0, own = null, cut = false;
      const colOf = (q, s) => (q + 1 < pages.length && pages[q + 1][1].includes(s) ? pages[q + 1][0] : pages[q][0]);
      const cands = [];
      for (let q = 0; q < Math.min(2, pages.length); q += 1) {
        pages[q][1].forEach((s, k) => {
          const m = chapterHead(s, psalms);
          if ((m === ch || alias.includes(m)) && !cands.some((x) => x.s === s)) cands.push({ q, k, m, s, col: colOf(q, s) });
        });
      }
      const noted = Object.values(c.notes || {}).map(Number).filter((p) => p >= from).sort((a, b) => a - b);
      const first = noted.length ? noted[Math.floor(noted.length / 4)] : null;
      const fit = first == null ? (alias.length ? [] : cands) : cands.filter((x) => x.col <= first);
      // (a psalm's two numbers both at or before them tell nothing either: the Gloss's "PSALMUS XV." and "XVI." on Psalm 16)
      const pick = (alias.length ? (new Set(fit.map((x) => x.m)).size === 1 ? fit[fit.length - 1] : null) : fit[0]) || null;
      if (pick) {
        const above = pages[pick.q][1].slice(0, pick.k).map(verseHead).filter(Boolean);
        let below = null;
        for (let q = pick.q; q < pages.length && !below; q += 1) for (const s of pages[q][1].slice(q === pick.q ? pick.k + 1 : 0)) { const h = verseHead(s); if (h) { below = h; break; } }
        own = pick.m;
        const before = pages[pick.q][1].slice(0, pick.k).some((s) => { const m = chapterHead(s, psalms); return m && m !== pick.m; });
        if (before || !below || above.every((h) => h.a > below.a)) { p0 = pick.q; i0 = pick.k; cut = true; }
      }
      if (!cut && known && +c.close > from) {
        let best = 5;
        // (never on the next chapter's page: the text it prints is that chapter's, Lapide's Genesis 2 at p. 235; nor past the middle of the
        // library's own notes on the chapter, three or more of them over more than one page: Bellarmine's notes on Psalm 23 are at pp.
        // 137-138, the text of his Psalm 24 at p. 140; the middle, as some rows are keyed to another chapter (Clarke's on 2 Timothy 3:16
        // and 3:17 stand at 2 Timothy 1:16-17, p. 136); an index that puts every verse on one page, Albert's on Matthew 5, says nothing)
        const until = noted.length >= 3 && noted[0] !== noted[noted.length - 1] ? noted[Math.floor(noted.length / 2)] : Infinity;
        for (let q = 0; q < pages.length && pages[q][0] < +c.close && pages[q][0] <= until; q += 1) {
          const ps = pages[q][1], at = ps.findIndex((s) => later(chapterHead(s, psalms))), part = at >= 0 ? ps.slice(0, at) : ps;
          // the chapter's text in one piece; a section's verses printed ahead of its notes (Calvin's, every few verses) say nothing of
          // where the chapter begins, and would start it at the longest of them. (2026-11-08) Its lines are a verse long: a run of a
          // homily's numbered sections is no text (Ambrose's on Luke 22 moved the start past all his notes on the chapter)
          const run = [...lemmaParts(part).runText].filter((k) => part[k].length < 300).length;
          if (run > best) { best = run; p0 = q; }
          if (at >= 0) break;
        }
      }
      // the end: the next chapter's heading after the start, or a verse heading that names a later chapter ("(Chap. VII.--Vers. 1.)")
      let p1 = pages.length - 1, i1 = p1 >= 0 ? pages[p1][1].length : 0, stopped = false;
      // (below the chapter's own heading, where it stands, even where the section is not cut there: the chapters before it on its page are
      // no end of it)
      const [q0, k0] = pick && (pick.q > p0 || (pick.q === p0 && pick.k >= i0)) ? [pick.q, pick.k] : [p0, i0];
      find: for (let q = q0; q < pages.length; q += 1) {
        const ps = pages[q][1];
        for (let k = q === q0 ? k0 + 1 : 0; k < ps.length; k += 1) {
          const m = chapterHead(ps[k], psalms), h = m ? null : verseHead(ps[k]);
          const next = m ? (own != null ? m !== own && (m === 1 || (m > own && m <= own + 3)) : later(m)) : !!(h && h.chap != null && later(h.chap));
          // (not where most of the library's notes on the chapter stand after it: Theophylact's "CHAPTER XI." heads col. 599, his notes
          // on Mark 10 are indexed at cols. 601-607)
          if (next && noted.filter((p) => p > pages[q][0]).length * 2 > noted.length) continue;
          if (next) { p1 = q; i1 = k; stopped = true; break find; }
        }
      }
      // the next chapter's page with no heading of it found: what it carries is taken for the next chapter's (Bellarmine's Psalm 24 and
      // Calov's 23 open on their map pages under no heading the section knows)
      if (!stopped && known && +c.close > from && p1 > p0 && pages[p1][0] === +c.close) i1 = 0;
      const lo = pages.length ? pages[p0][0] : from, hi = pages.length ? pages[p1][0] : (from <= 0 ? Infinity : end);
      // the section's paragraphs from its start to its end, each once (a page of two columns repeats its second on the next page)
      const joined = [], at = [];
      for (let q = p0; q <= p1 && q < pages.length; q += 1) {
        const [n, ps] = pages[q], prev = q > p0 ? new Set(pages[q - 1][1]) : null;
        for (let k = q === p0 ? i0 : 0; k < (q === p1 ? i1 : ps.length); k += 1) if (!prev || !prev.has(ps[k])) { joined.push(ps[k]); at.push([n, k]); }
      }
      // (the text printed whole: a run of verses, or the verses ahead of their notes; not a long note that lists 1. 2. 3. inside it, as
      // Poole's Synopsis does, which a paragraph seen alone may be taken for)
      const parts = lemmaParts(joined), app = apparatusIndexes(joined), text = new Set([...parts.runText, ...parts.ahead].map((k) => joined[k]));
      const ahead = new Set([...parts.ahead].map((k) => joined[k])), aheadAt = new Map();
      for (const k of [...parts.ahead].sort((x, y) => x - y)) { const m = /^(\d{1,3})\./.exec(joined[k]); if (m && !aheadAt.has(+m[1])) aheadAt.set(+m[1], at[k][0]); }
      // the notes numbered with no stop after that text ("7 Emptied himself."), known only from the section read whole
      const nostop = new Map([...parts.notes].map(([k, x]) => [joined[k], x]));
      // (2026-11-08) what stands under the references of another chapter, with the text they name after them, is that chapter's, to the
      // next chapter's heading: Calvin's Harmony of the Law prints Deuteronomy 9:1-6 and his notes on it within the pages the map gives
      // his Deuteronomy 6, and his "4. Speak not thou in thine heart" was marked as his note on 6:4. Such paragraphs are never the note
      // (`skip`, with the section's text). A run of references is read as one: the Harmony of the Gospels heads a section "Matthew
      // 16:13-19", "Mark 8:27-29", "Luke 9:18-20", and its notes are on all three
      const foreign = new Set(), chapsOf = (x) => String(x).replace(/^#{1,6}\s+/, '').trim().split(/\s*;\s*/).map((y) => +REF_ONE.exec(y)[1]);
      let rc = null;
      for (let k = 0; k < joined.length; k += 1) {
        let j = k;
        if (refHead(joined[k])) {
          let rs = refHead(joined[k]), cs = chapsOf(joined[k]);
          while (j + 1 < joined.length && refHead(joined[j + 1])) { j += 1; rs = rs.concat(refHead(joined[j])); cs = cs.concat(chapsOf(joined[j])); }
          const n = bareNum(joined[j + 1] || '');
          if (n != null && rs.some(([a, b]) => a <= n && n <= b)) rc = cs;
        } else if (chapterHead(joined[k], psalms)) rc = null;
        for (let q = k; q <= j; q += 1) if (rc && !rc.some((x) => x === ch || alias.includes(x))) foreign.add(joined[q]);
        k = j;
      }
      const skip = new Set([...text, ...foreign]);
      const heads = {}, caps = [], ranges = [], marks = [];
      // a heading that names its verses says so wherever it stands in the section (Augustine's Tractate I, col. 35)
      pages.forEach(([n, ps], q) => { if (q <= p0) for (const s of q < p0 ? ps : ps.slice(0, i0)) { const r = rangeOf(s, w.ch); if (r) ranges.push({ p: n, pos: -1, ...r }); } });
      // the first verses that the next two headings after `pos` name, a few paragraphs on at most, in this chapter
      const nextHeads = (pos) => {
        const xs = [];
        for (let k = pos + 1; k < joined.length && k <= pos + 8 && xs.length < 2; k += 1) {
          const g = app.has(k) ? null : verseHead(joined[k]); if (!g) continue;
          if (g.chap != null && g.chap !== ch) break;
          xs.push(g.a);
        }
        return xs;
      };
      let last = 0, lastA = 0, cur = null, named = false, title = '';
      for (let pos = 0; pos < joined.length; pos += 1) {
        if (app.has(pos)) continue; // "13 zu Inanis et vacua" is the editors' line number, not verse 13
        const s = joined[pos], [n, i] = at[pos];
        const r = rangeOf(s, w.ch); if (r) ranges.push({ p: n, pos, ...r });
        for (const x of cvMarks(s, w.ch)) if (!marks.some((y) => y.v === x.v)) marks.push({ p: n, i, pos, v: x.v });
        let h = verseHead(s);
        if (h && h.chap != null) {
          // the first heading that names this chapter's first verse is where it starts: what the index took before it was another
          // chapter's; once it is named, a heading that names another chapter ends it (Trapp's "CHAP. III. Verse 1." of Hebrews, after
          // his Titus 3, is no new start of Titus 3)
          if (h.chap !== ch) { if (named) break; cur = h.chap; continue; }
          if (!named && h.a === 1) { for (const x of Object.keys(heads)) delete heads[x]; last = 0; lastA = 0; }
          cur = ch; named = true;
        } else if (h && cur != null && cur !== ch) continue;
        if (!h && !parts.all.has(pos)) { const cn = capsNum(s); if (cn != null) h = { a: cn, b: cn, list: [cn] }; }
        if (h) {
          // (a section cut at the chapter's heading holds nothing of the chapter before: a sparse annotator's notes may stand further apart,
          // Grotius's on Proverbs 8 at verses 1, 14 and 22; but a heading that runs ahead of the count, where the next two run on from the
          // last, is none of the chapter's: Migne's footnote "v. 18. In similar language John the Baptist is called Elijah", between his
          // notes on 1 John 4:3 and 4:4, took the place of verses 4 to 17, and the reader was sent to 4:3 for 4:8)
          const nx = h.a > last + 1 ? nextHeads(pos) : [];
          const stray = nx.length === 2 && nx[0] > lastA && nx[0] < nx[1] && nx[1] < h.a;
          if (h.a > lastA && h.a - last <= (cut ? 25 : 12) && !stray) {
            for (const x of h.list) if (!heads[x] || heads[x].w > h.list.length) heads[x] = { p: n, i, pos, w: h.list.length, s, br: !!h.br };
            if (!title && h.list.includes(1)) title = s;
            lastA = h.a; last = Math.max(last, h.b);
          }
        } else if (!parts.all.has(pos)) {
          const m = /^[«"“‘']?([A-Z][A-Z’' -]{6,}[A-Z])\s*(?:[.,;:—–]|$)/.exec(s);
          if (m) caps.push({ p: n, i, pos, words: m[1].toLowerCase().split(/[^a-z]+/).filter(Boolean) });
        }
      }
      // a psalm's title counted as its first verse (located): its heading of verse 1 is on the title ("1. [vers. 1.] Unto the end, to the
      // servant of the Lord", the Gloss's "VERSE 1.-- Unto the end, a psalm."), or its bracketed headings, Augustine's, run past the
      // psalm's last verse in the English count by the title's verses (his Psalm 3 to "[vers. 9.]"; Cassiodorus's "Ver." headings run
      // past it for other reasons, and his "Ver. 1." on Psalm 18 is "I will love thee, O Lord")
      let titleOff = 0;
      const t = psalms ? TITLED[ch] || 0 : 0;
      if (t) {
        let nv = 0;
        try { while (nv < 200 && String(verseText(nv + 1) || '').trim()) nv += 1; } catch (_) { nv = 0; }
        if ((nv > 0 && Object.keys(heads).some((k) => +k > nv && +k <= nv + t && heads[k].br)) || TITLE_WORDS.test(afterHead(title))) titleOff = t;
      }
      // the next chapter on the chapter's own first page, with no heading of a later chapter there, says nothing of where the chapter
      // ends: the lectures and homilies that name their chapter and verses are read on, forty pages (Aquinas on Romans 9, whose map
      // gives Romans 10 at p. 50 too: his lecture on 9:6-13 is at p. 51, and the reader was sent to the chapter's opening for 9:13).
      // Only they are: a bare verse heading there may be any chapter's
      if (known && +c.close === from && !stopped) {
        let pos = joined.length;
        for (let n = from + 1; n <= from + 40; n += 1) {
          const [en, la] = await getParas(c.slug, n);
          for (const s of en.length ? en : la) { const r = rangeOf(s, w.ch); if (r) ranges.push({ p: n, pos, ...r }); pos += 1; }
        }
      }
      // the library's own rows on the chapter's verses need no page read: with no next chapter on the map and no heading of it found in
      // the pages read, they are taken as far as the section once ran (150 pages; Taylor's Titus 3 runs from p. 539, his note on 3:6 is
      // at p. 622)
      const far = !known && from > 0 && !stopped ? from + 150 : hi;
      // (2026-11-08) with the next chapter on this chapter's own first page and no heading of it read there, the library's own rows on
      // the chapter's verses are taken as far as they rise with the verses, forty pages at most: Jerome's on Zechariah 12, whose map gives
      // chapter 13 on col. 1508 too, are indexed at cols. 1510-1515, and the reader was sent to the column of 12:9 for 12:10
      let rowsFar = far;
      if (known && +c.close === from && !stopped) {
        const rs = Object.entries(c.notes || {}).map(([x, p]) => [+x, +p]).filter(([, p]) => p >= from).sort((x, y) => x[0] - y[0]);
        if (rs.length >= 3 && rs.every(([, p], k) => !k || p >= rs[k - 1][1])) rowsFar = Math.max(far, Math.min(from + 40, rs[rs.length - 1][1]));
      }
      // (the section's last page, and where on it the section ends: the next chapter's heading, or its top where none is read there)
      const endAt = pages.length ? { p: pages[p1][0], i: i1 } : null;
      return { lo, hi, far, rowsFar, endAt, heads, caps, ranges, marks, text, skip, foreign, ahead, aheadAt, nostop, titleOff };
    });
    // THE NOTE AFTER ITS TEXT (2026-11-08, QA). The library indexes Calvin's note on a verse at the page where the verse is printed
    // ahead of his notes (Galatians 2:16 at p. 29, with the text of 2:11-16; Isaiah 53:5 at p. 61, with 53:1-12), and his note on
    // it comes after those on the verses before it (p. 34; p. 64). Where the indexed page and the next carry the verse only in such
    // a text, with no note on it, the place is the first of the section's following pages that carries one. (2026-11-08, survey) The
    // text is the section's, read whole (Calvin prints Genesis 3 on pp. 58-59), and the search runs to the section's end, forty pages
    // at most: his note on Genesis 3:15 is at p. 72. The same holds for a page the library files as discussing the verse.
    const noteAfterText = async (c, sec, p0, printed, ch) => {
      const [[e1, l1], [e2, l2]] = [await getParas(c.slug, p0), await getParas(c.slug, p0 + 1)];
      let held = false;
      for (const all of [[...e1, ...e2], [...l1, ...l2]]) {
        if (!all.length) continue;
        if (findNote(all, printed, true, ch, sec.skip) >= 0) return null;
        const { ahead } = lemmaParts(all);
        if (all.some((s, k) => (ahead.has(k) || sec.ahead.has(s)) && +(/^(\d{1,3})\./.exec(s) || [])[1] === +printed)) held = true;
      }
      for (let n = p0 + 2; held && n <= Math.min(sec.far, p0 + 40); n += 1) {
        if (await noteOn(c, sec, n, printed, ch)) return n;
        // another passage's text begins under its reference: the note on this verse came before it, unfound (Calvin's Harmony of the
        // Law runs from Exodus 20:3 on to Deuteronomy 13:3, whose note is no note on Exodus 20:3)
        const [en] = await getParas(c.slug, n);
        if (en.some((s) => { const r = refHead(s); return r && !r.some(([a, b]) => a <= +printed && +printed <= b); })) return null;
      }
      return null;
    };
    // whether pages p and p + 1 carry the verse's number only in a line of the text (a verse long, never a numbered note that runs on), or
    // under another chapter's heading, and no note on it. The text is a run of verses or the verses ahead of their notes, never a note
    // that lists "1. … 2." inside it (Poole's Synopsis on 1 John 4:8, "8. He that loveth not (either, 1. a brother: or, 2. God …) knoweth
    // not God] That is …", was dropped from his index)
    const textOnly = async (c, sec, p, printed, ch) => {
      const [[e1, l1], [e2, l2]] = [await getParas(c.slug, p), await getParas(c.slug, p + 1)];
      let seen = false;
      for (const all of [[...e1, ...e2], [...l1, ...l2]]) {
        if (!all.length) continue;
        if (findNote(all, printed, true, ch, sec.skip) >= 0) return false;
        const { runText, ahead } = lemmaParts(all);
        let hc = null;
        for (let k = 0; k < all.length; k += 1) {
          const m = chapterHead(all[k], false) || chapterHead(all[k], true); if (m) hc = m;
          if (bareNum(all[k]) !== +printed || verseHead(all[k]) != null) continue;
          const elsewhere = (hc != null && hc !== +ch && !vulgateOf(+ch).includes(hc)) || sec.foreign.has(all[k]);
          if (!elsewhere && (all[k].length >= 300 || !(runText.has(k) || ahead.has(k) || sec.text.has(all[k])))) return false;
          seen = true;
        }
      }
      return seen;
    };
    // whether page n carries the note on the verse: by its own reading, or as the section read whole ("7 Emptied himself.")
    const noteOn = async (c, sec, n, printed, ch) => {
      const [en, la] = await getParas(c.slug, n);
      return findNote(en, printed, false, ch, sec.skip) >= 0 || findNote(la, printed, false, ch, sec.skip) >= 0 || en.some((s) => sec.nostop.get(s) === +printed && !sec.foreign.has(s));
    };
    /* A NOTE OUTSIDE THE TRACTATE ON ITS VERSE (2026-11-08, found testing Augustine on John 1). The library indexed the numbered sections
     * of Augustine's Tractate I (on John 1:1-5) as notes on verses: its §13, at col. 1385 on 1:3, became "his note on John 1:13", though
     * Tractate II, on 1:6-14, begins at col. 1388. Where a heading in the section names a run of verses holding this one, a page that lies
     * outside that run (before its heading, or past the next one) is not the note on it. */
    const inRun = (sec, printed, p) => {
      const r = sec.ranges.filter((x) => x.a <= printed && printed <= x.b).sort((x, y) => (x.b - x.a) - (y.b - y.a) || x.p - y.p)[0];
      if (!r) return true;
      const next = sec.ranges.filter((x) => x.p > r.p).sort((x, y) => x.p - y.p)[0];
      return p >= r.p && (!next || p <= next.p);
    };
    /* A PSALM'S TITLE COUNTED AS A VERSE (2026-11-08, found testing the bracketed headings). The Hebrew and the Vulgate count most
     * psalms' titles as their first verse (TITLED), the English does not: Augustine's "[vers. 7.]" on Psalm 51 (his 50) is the English
     * 51:5, and his "1. [vers. 1.]" on Psalm 18 is on its title. The library's index has it right (51:5 at col. 591, where "[vers. 7.]"
     * stands), but the pane marks a heading by the English number: once his headings were read, the reader would have been shown the
     * comment on another verse, marked as his note on this one. Where a work counts the title, the place is its heading of the verse in
     * that count (51:5 at "[vers. 7.]"), on the column where it stands, opened with nothing marked ("Its comment on Psalm 51:5", how
     * 'range'); with no such heading, the chapter's opening, said to be that. A work the map gives printed numbers for (`pv`) is read
     * by them. */
    const counted = (c, sec, v) => sec.titleOff && !(c.pv && c.pv[v] != null);
    const located = (c, v, w) => {
      return once(`loc|${c.slug}|${w.name}|${w.ch}|${v}`, async () => {
        const printed = printedOf(c, v), sec = await section(c, w);
        if (counted(c, sec, v)) {
          const h = sec.heads[+printed + sec.titleOff];
          if (!h) return null;
          const [en, la] = await getParas(c.slug, h.p + 1);
          return { p: en.includes(h.s) || la.includes(h.s) ? h.p + 1 : h.p, v, range: { a: v, b: v } };
        }
        if (sec.heads[printed]) return { p: sec.heads[printed].p, v };
        // the verse's place printed in the run of the text ("2, 16 Knowing that …", the Weimar edition)
        const mk = sec.marks.find((x) => x.v === +printed); if (mk) return { p: mk.p, v };
        // a note headed only by the verse's words in capitals ("AND GOD SAW THE LIGHT THAT IT WAS GOOD."): between the notes on the
        // verses either side, the heading whose words are all in the verse
        let text; try { text = String(verseText(v) || '').toLowerCase(); } catch (_) { text = ''; }
        if (text) {
          const ks = Object.keys(sec.heads).map(Number);
          const before = Math.max(-1, ...ks.filter((k) => k < printed).map((k) => sec.heads[k].pos));
          const after = Math.min(Infinity, ...ks.filter((k) => k > printed).map((k) => sec.heads[k].pos));
          const have = new Set(text.split(/[^a-z]+/).filter(Boolean));
          const score = (x) => x.words.filter((q) => have.has(q)).length;
          const fit = sec.caps.filter((x) => x.pos > before && x.pos < after && x.words.length >= 3 && score(x) / x.words.length >= 0.7)
            .sort((x, y) => score(y) - score(x) || x.pos - y.pos);
          if (fit.length) return { p: fit[0].p, v };
        }
        // the library's own indexed note, if it lies in this commentary's section of the chapter (an index row can point into
        // another work printed in the same volume), or the note itself where that page carries the verse only as the text
        // (2026-11-08) on the section's last page, the next chapter's, where no heading of that chapter is read, only for a verse after the
        // section's last heading: the chapter's last notes run on to it (Wesley's on 1 Corinthians 13:13, p. 249), its first do not. The
        // library's rows put Coke's Psalm 18:1 at p. 53, where his Psalm 19 opens under "PSA.L., XIX.", which the section cannot read,
        // past his notes on 18:7-50 at pp. 46-52; the note there was his "Ver. 1. The heaven's declare", on 19:1
        const onNext = (p) => !!sec.endAt && p === sec.endAt.p && sec.endAt.i === 0 && Object.keys(sec.heads).some((k) => +k > +printed);
        if (c.notes[v] != null && +c.notes[v] >= sec.lo && +c.notes[v] <= sec.rowsFar && inRun(sec, +printed, +c.notes[v]) && !onNext(+c.notes[v])) {
          const after = await noteAfterText(c, sec, +c.notes[v], printed, w.ch);
          if (after != null) return { p: after, v, indexed: true };
          // (2026-11-08) a page that carries the verse only as a line of the text, with no note on it there or after, is no note: Albert's
          // every verse of Matthew 5 is indexed at the page of his text, and the reader was shown the verse marked as his note; nor one
          // whose line of that number stands under another chapter's heading (Poole's Annotations on Psalm 32:1, at p. 445: Psalm 33's
          // "1. REjoyce in the LORD")
          if (!(await textOnly(c, sec, +c.notes[v], printed, w.ch))) return { p: +c.notes[v], v, indexed: true };
        }
        // (2026-11-08) inside a tractate, homily or lecture whose heading names a run of verses holding this one, a paragraph numbered
        // as the verse is the division's own section of that number, and only a heading that names the verse is its note: Augustine's
        // Tractate CV on John 17:1-5 opens his "3. Some accept the Son glorified by the Father …", which was marked as his note on 17:3
        const divided = sec.ranges.some((x) => x.a <= printed && printed <= x.b && x.b > x.a);
        const noteIn = (ps) => { const k = findNote(ps, printed, false, w.ch, sec.skip); return k >= 0 && (!divided || (verseHead(ps[k]) || { list: [] }).list.includes(+printed)); };
        for (const cand of candidatePages((c.rows || {})[v], c.slug, w.name, w.ch, v).filter((x) => x.p >= sec.lo && x.p <= sec.far && inRun(sec, +printed, x.p)).slice(0, 8)) {
          for (const p of [cand.p - 2, cand.p - 1, cand.p]) {
            if (p < Math.max(1, sec.lo)) continue;
            const [en, la] = await getParas(c.slug, p);
            if (apparatusShare(en.length ? en : la) >= 0.8) continue; // a page of the editors' notes alone is no note on the verse
            // (on the section's last page, only above the next chapter's heading, or as above where none is read there)
            if (sec.endAt && p === sec.endAt.p) {
              const ps = en.length ? en : la, i = sec.endAt.i;
              if (i > 0 && i < ps.length) { if (noteIn(ps.slice(0, i))) return { p, v }; continue; }
              if (onNext(p)) continue;
            }
            if (noteIn(en) || noteIn(la)) return { p, v };
          }
          // (2026-11-08) a page that carries the verse only in the text printed ahead of the notes: the note is where it follows
          const after = await noteAfterText(c, sec, cand.p, printed, w.ch);
          if (after != null) return { p: after, v };
        }
        // (2026-11-08) with no row of the library's to go by, the verse where the section prints it ahead of the notes: the note follows
        // (Calvin on Genesis 3:15, printed on p. 59, his note at p. 72)
        if (sec.aheadAt.has(+printed)) {
          const tp = sec.aheadAt.get(+printed);
          for (const p of [tp, tp + 1]) if (await noteOn(c, sec, p, printed, w.ch)) return { p, v };
          const after = await noteAfterText(c, sec, tp, printed, w.ch); if (after != null) return { p: after, v };
        }
        // the lecture whose heading names a range of the chapter's verses holding this one (the narrowest)
        const r = sec.ranges.filter((x) => x.a <= printed && printed <= x.b).sort((x, y) => (x.b - x.a) - (y.b - y.a) || x.pos - y.pos)[0];
        if (r) return { p: r.p, v, range: { a: r.a, b: r.b } };
        return null;
      });
    };
    async function resolve(c, v, w) {
      const here = await located(c, v, w);
      if (here) return here.range ? { p: here.p, how: 'range', v, a: here.range.a, b: here.range.b } : { p: here.p, how: 'note', v, indexed: !!here.indexed };
      const sec = await section(c, w);
      // a psalm whose title the work counts, with no heading of the verse: no other verse's note is offered for it
      if (counted(c, sec, v)) return c.open != null ? { p: Math.max(+c.open, sec.lo), how: 'chapter' } : null;
      const claims = [];
      for (const x of candidatePages((c.rows || {})[v], c.slug, w.name, w.ch, v)) {
        if (x.claim !== 'yes' || x.p < sec.lo || x.p > sec.far) continue;
        const [en, la] = await getParas(c.slug, x.p);
        if (apparatusShare(en.length ? en : la) < 0.8) claims.push(x); // a page that is nearly all the editors' notes is not "the comment"
      }
      const seek = async (dir, max) => {
        for (let d = 1; d <= max; d += 1) {
          const x = v + dir * d; if (x < 1) return null;
          const hit = await located(c, x, w);
          if (hit) return { p: hit.p, v: x };
        }
        return null;
      };
      const next = await seek(1, 12), prev = await seek(-1, 12);
      if (claims.length && (next || prev)) {
        const lo = prev ? prev.p : 0, hi = next ? next.p : Infinity;
        const mid = claims.map((x) => x.p).filter((p) => p >= lo && p <= hi).sort((x, y) => x - y)[0];
        if (mid != null) return { p: mid, how: 'page', v };
      }
      if (next && next.v - v <= 4) return { p: next.p, how: 'later', v: next.v };
      if (prev) return { p: prev.p, how: 'nearest', v: prev.v };
      if (next) return { p: next.p, how: 'later', v: next.v };
      if (c.open != null) return { p: Math.max(+c.open, sec.lo), how: 'chapter' };
      return null;
    }
    return { located, resolve, section };
  }

  return { strongRx, bareRx, strongNum, bareNum, capsNum, verseHead, chapterHead, refHead, isApparatus, apparatusIndexes, apparatusShare, quotesVerse, lemmaParts, lemmaIndexes, cvMarks, findNote, noteEnd, gistClaims, candidatePages, rangeOf, createResolver };
}));
