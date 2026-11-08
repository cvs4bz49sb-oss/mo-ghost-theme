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
  const bareRx = (n) => new RegExp(`^\\(?${n}\\b\\s*[.:,)\\]]`);
  const strongNum = (s) => { const m = new RegExp(`^${HEAD}\\(?(\\d{1,3})\\b\\s*[.:,)\\]]`, 'i').exec(s); return m ? +m[1] : null; };
  // a bare numbered line; a number in parentheses is a footnote mark, not a verse, and is not counted
  const bareNum = (s) => { const m = /^(\d{1,3})\s*[.:)\]]\s*\S/.exec(s); return m ? +m[1] : null; };
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
  function lemmaParts(paras) {
    const text = new Set(), ahead = new Set(), notes = new Map(), runs = [];
    const app = apparatusIndexes(paras);
    const nums = paras.map((s, i) => (app.has(i) || quotesVerse(s) ? null : strongNum(s) == null ? bareNum(s) : null));
    for (let i = 0; i < paras.length; i += 1) {
      if (nums[i] == null) continue;
      let j = i;
      while (j + 1 < paras.length && nums[j + 1] === nums[j] + 1) j += 1;
      const run = paras.slice(i, j + 1);
      if (run.length >= 5 || (run.length >= 3 && run.every((s) => s.length < 220))) { for (let k = i; k <= j; k += 1) text.add(k); }
      i = j;
    }
    paras.forEach((s, i) => {
      if (app.has(i) || strongNum(s) != null) return; // a note under a "Vers. N." heading may list 1. 2. 3. inside it; it is still the note
      const marks = (s.match(/\s(\d{1,3})\.\s+\S/g) || []).map((m) => parseInt(m, 10));
      if (marks.some((n, k) => marks[k + 1] === n + 1)) text.add(i);
    });
    // a verse's number as the text prints it, "12. " ("1:12 " is Aquinas's chapter and verse, read as 1 above); a note's number as
    // that, or with no stop ("13 But")
    const vn = paras.map((s, i) => { const m = nums[i] != null && /^(\d{1,3})\.\s+\S/.exec(s); return m ? +m[1] : null; });
    const wn = paras.map((s, i) => { if (vn[i] != null || app.has(i) || quotesVerse(s)) return vn[i]; const m = /^(\d{1,3})\s+["\u201c\u2018']?[A-Z]/.exec(s); return m ? +m[1] : null; });
    for (let i = 0; i < paras.length; i += 1) {
      if (vn[i] == null) continue;
      let j = i, top = innerTop(paras[i], vn[i]), shape = top > vn[i], long = paras[i].length;
      while (j + 1 < paras.length && vn[j + 1] != null) {
        const n = vn[j + 1];
        // the same verse again (in the original), once, after a paragraph that carried that verse alone
        if (n === vn[j] && (j === i || vn[j - 1] !== n) && top === n) shape = true;
        else if (n !== top + 1) break;
        j += 1;
        top = Math.max(top, innerTop(paras[j], n));
        if (top > n) shape = true;
        long = Math.max(long, paras[j].length);
      }
      const k1 = j + 1;
      if (shape && k1 < paras.length && wn[k1] === vn[i] && paras[k1].length >= 2 * long) {
        for (let k = i; k <= j; k += 1) ahead.add(k);
        runs.push([j + 1, vn[i], top]);
        i = j;
      }
    }
    for (const [from, a, b] of runs) {
      let last = a;
      for (let m = from; m < paras.length && !ahead.has(m); m += 1) {
        const x = wn[m]; if (x == null) continue;
        if (x < last || x > b) break;
        notes.set(m, x); last = x;
      }
    }
    return { text, ahead, notes, all: new Set([...text, ...ahead]) };
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
  function findNote(paras, printed, loose, ch) {
    const { all: lemma, notes } = lemmaParts(paras), app = apparatusIndexes(paras);
    const sx = strongRx(printed), bx = bareRx(printed);
    let i = paras.findIndex((s, k) => !app.has(k) && sx.test(s)); // the heading word marks a note even where the note lists 1. 2. 3. inside it
    if (i < 0) i = paras.findIndex((s, k) => !lemma.has(k) && !app.has(k) && bx.test(s) && (loose || !/^\(/.test(s)));
    if (i < 0) for (const [k, x] of notes) if (x === printed) { i = k; break; } // "14 For if we believe." after the text
    if (i < 0 && ch != null) i = paras.findIndex((s, k) => !app.has(k) && cvMarks(s, ch).some((x) => x.v === +printed));
    return i;
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
    const { all: lemma, ahead, notes } = lemmaParts(paras), app = apparatusIndexes(paras), max = cap || 14;
    let seen = 0; // the editors' notes neither end the note nor count toward the cap
    for (let j = start + 1; j < paras.length && seen < max; j += 1) {
      if (app.has(j)) continue;
      seen += 1;
      // the next verse marked in the run of the text: a paragraph that opens with it is the next note; one that has it further on
      // still ends this note, and is kept
      if (ch != null) { const nx = cvMarks(paras[j], ch).find((x) => x.v > +printed); if (nx) return nx.at > 0 ? j + 1 : j; }
      if (isHead(paras[j])) return j;
      const sn = strongNum(paras[j]);
      if (sn != null && sn !== printed) return j;
      if (notes.has(j) && notes.get(j) > printed) return j; // "7 Emptied himself." ends the note on verse 6
      const bn = sn == null ? bareNum(paras[j]) : null;
      if (bn != null && bn > printed && (!lemma.has(j) || ahead.has(j))) return j;
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
  const romanNum = (r) => {
    const V = { I: 1, V: 5, X: 10, L: 50, C: 100 }, u = String(r).toUpperCase();
    let n = 0;
    for (let i = 0; i < u.length; i += 1) { const x = V[u[i]], y = V[u[i + 1]] || 0; if (!x) return NaN; n += x < y ? -x : x; }
    return n;
  };
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
    // The section is every page from the chapter's reprinted text to the next chapter's page (or, with no usable next chapter, 150
    // pages on), read once: it gives the section's start, and an index of the note headings in it ("Vers. 20.", "9. LET THE WATERS"),
    // each the first heading of its number that follows the one before, so a cross-reference or a repeated number cannot take it.
    const section = (c, w) => once(`sec|${c.slug}|${w.name}|${w.ch}`, async () => {
      const from = c.open != null ? +c.open : 0;
      const hi = from <= 0 ? Infinity : (c.close != null && +c.close > from ? Math.min(+c.close, from + 260) : from + 150);
      const pages = [];
      let lo = from, best = 5;
      if (from > 0) {
        for (let n = from; n < hi; n += 1) {
          const [en, la] = await getParas(c.slug, n);
          const ps = en.length ? en : la;
          pages.push([n, ps]);
          // the chapter's text in one piece; a section's verses printed ahead of its notes (Calvin's, every few verses) say nothing of
          // where the chapter begins, and would start it at the longest of them
          const run = lemmaParts(ps).text.size;
          if (run > best) { best = run; lo = n; }
        }
      }
      const heads = {}, caps = [], ranges = [], marks = [];
      let last = 0, pos = 0;
      for (const [n, ps] of pages) {
        // a heading that names its verses says so wherever it stands in the section (Augustine's Tractate I, col. 35)
        if (n < lo) { for (const s of ps) { const r = rangeOf(s, w.ch); if (r) ranges.push({ p: n, pos: -1, ...r }); } continue; }
        const lemma = lemmaIndexes(ps), app = apparatusIndexes(ps);
        for (let i = 0; i < ps.length; i += 1, pos += 1) {
          if (app.has(i)) continue; // "13 zu Inanis et vacua" is the editors' line number, not verse 13
          const r = rangeOf(ps[i], w.ch); if (r) ranges.push({ p: n, pos, ...r });
          for (const x of cvMarks(ps[i], w.ch)) if (!marks.some((y) => y.v === x.v)) marks.push({ p: n, i, pos, v: x.v });
          const num = strongNum(ps[i]) != null ? strongNum(ps[i]) : (lemma.has(i) ? null : capsNum(ps[i]));
          if (num != null && num > last && num - last <= 12) { heads[num] = { p: n, i, pos }; last = num; } else if (num == null && !lemma.has(i)) {
            const m = /^[\u00ab"\u201c\u2018']?([A-Z][A-Z\u2019' -]{6,}[A-Z])\s*(?:[.,;:\u2014\u2013]|$)/.exec(ps[i]);
            if (m) caps.push({ p: n, i, pos, words: m[1].toLowerCase().split(/[^a-z]+/).filter(Boolean) });
          }
        }
      }
      return { lo, hi, heads, caps, ranges, marks };
    });
    // THE NOTE AFTER ITS TEXT (2026-11-08, QA). The library indexes Calvin's note on a verse at the page where the verse is printed
    // ahead of his notes (Galatians 2:16 at p. 29, with the text of 2:11-16; Isaiah 53:5 at p. 61, with 53:1-12), and his note on
    // it comes after those on the verses before it (p. 34; p. 64). Where the indexed page and the next carry the verse only in such
    // a text, with no note on it, the place is the first of the section's following pages, ten at most, that carries one.
    const noteAfterText = async (c, p0, printed, hi, ch) => {
      const [[e1, l1], [e2, l2]] = [await getParas(c.slug, p0), await getParas(c.slug, p0 + 1)];
      let held = false;
      for (const all of [[...e1, ...e2], [...l1, ...l2]]) {
        if (!all.length) continue;
        if (findNote(all, printed, true, ch) >= 0) return null;
        if ([...lemmaParts(all).ahead].some((k) => +(/^(\d{1,3})\./.exec(all[k]) || [])[1] === printed)) held = true;
      }
      for (let n = p0 + 2; held && n < Math.min(hi, p0 + 12); n += 1) {
        const [en, la] = await getParas(c.slug, n);
        if (findNote(en, printed, false, ch) >= 0 || findNote(la, printed, false, ch) >= 0) return n;
      }
      return null;
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
    const located = (c, v, w) => {
      return once(`loc|${c.slug}|${w.name}|${w.ch}|${v}`, async () => {
        const printed = printedOf(c, v), sec = await section(c, w);
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
        if (c.notes[v] != null && +c.notes[v] >= sec.lo && +c.notes[v] < sec.hi && inRun(sec, +printed, +c.notes[v])) {
          const after = await noteAfterText(c, +c.notes[v], printed, sec.hi, w.ch);
          return { p: after != null ? after : +c.notes[v], v, indexed: true };
        }
        for (const cand of candidatePages((c.rows || {})[v], c.slug, w.name, w.ch, v).filter((x) => x.p >= sec.lo && x.p < sec.hi && inRun(sec, +printed, x.p)).slice(0, 8)) {
          for (const p of [cand.p - 2, cand.p - 1, cand.p]) {
            if (p < Math.max(1, sec.lo)) continue;
            const [en, la] = await getParas(c.slug, p);
            if (apparatusShare(en.length ? en : la) >= 0.8) continue; // a page of the editors' notes alone is no note on the verse
            if (findNote(en, printed, false, w.ch) >= 0 || findNote(la, printed, false, w.ch) >= 0) return { p, v };
          }
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
      const claims = [];
      for (const x of candidatePages((c.rows || {})[v], c.slug, w.name, w.ch, v)) {
        if (x.claim !== 'yes' || x.p < sec.lo || x.p >= sec.hi) continue;
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

  return { strongRx, bareRx, strongNum, bareNum, capsNum, isApparatus, apparatusIndexes, apparatusShare, quotesVerse, lemmaParts, lemmaIndexes, cvMarks, findNote, noteEnd, gistClaims, candidatePages, rangeOf, createResolver };
}));
