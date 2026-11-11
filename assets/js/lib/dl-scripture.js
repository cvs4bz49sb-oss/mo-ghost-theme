/*
 * Daily Liturgy Scripture: the reference parser and passage fetch shared
 * by the Daily Liturgy reader (daily-liturgy-reader.js) and the Daily
 * Office (dashboard-prayer.js). Moved here 2026-11-10 so the office could
 * embed the Bible in Two Years readings without a fourth copy of the
 * parser. Passages come from the mo-bible worker (meta mo-bible-base).
 *
 *   window.MODailyScripture.fetchScripture(ref, translation, base?)
 *     -> Promise<{ html, fallback? }>
 *   .parseScriptureRef(ref), .TRANSLATION_CODES, .SPAN_GAP
 */
(function () {
  "use strict";

  const TRANSLATION_CODES = {
    CSB: "CSB17",
    KJV: "KJV",
    ESV: "ESV",
    NASB: "NASB",
  };

  function defaultBase() {
    const m = document.querySelector('meta[name="mo-bible-base"]');
    return (m && m.content) || "";
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ── Scripture reference parser ────────────────────────────────
  const BOOK_NUMS = {
    "genesis": 1, "exodus": 2, "leviticus": 3, "numbers": 4,
    "deuteronomy": 5, "joshua": 6, "judges": 7, "ruth": 8,
    "1 samuel": 9, "2 samuel": 10, "1 kings": 11, "2 kings": 12,
    "1 chronicles": 13, "2 chronicles": 14, "ezra": 15,
    "nehemiah": 16, "esther": 17, "job": 18,
    "psalms": 19, "psalm": 19, "proverbs": 20,
    "ecclesiastes": 21, "song of solomon": 22, "song of songs": 22,
    "isaiah": 23, "jeremiah": 24, "lamentations": 25,
    "ezekiel": 26, "daniel": 27, "hosea": 28, "joel": 29,
    "amos": 30, "obadiah": 31, "jonah": 32, "micah": 33,
    "nahum": 34, "habakkuk": 35, "zephaniah": 36,
    "haggai": 37, "zechariah": 38, "malachi": 39,
    "matthew": 40, "mark": 41, "luke": 42, "john": 43,
    "acts": 44, "romans": 45, "1 corinthians": 46,
    "2 corinthians": 47, "galatians": 48, "ephesians": 49,
    "philippians": 50, "colossians": 51, "1 thessalonians": 52,
    "2 thessalonians": 53, "1 timothy": 54, "2 timothy": 55,
    "titus": 56, "philemon": 57, "hebrews": 58, "james": 59,
    "1 peter": 60, "2 peter": 61, "1 john": 62, "2 john": 63,
    "3 john": 64, "jude": 65, "revelation": 66,
    // Abbreviations. The devotional data is hand-entered, so "1 Thess 4"
    // shows up alongside the spelled-out names.
    "gen": 1, "ex": 2, "exod": 2, "lev": 3, "num": 4, "deut": 5,
    "josh": 6, "judg": 7, "1 sam": 9, "2 sam": 10, "1 kgs": 11,
    "2 kgs": 12, "1 chr": 13, "2 chr": 14, "neh": 16, "esth": 17,
    "ps": 19, "psa": 19, "prov": 20, "eccl": 21, "song": 22, "sos": 22,
    "isa": 23, "jer": 24, "lam": 25, "ezek": 26, "dan": 27, "hos": 28,
    "obad": 31, "jon": 32, "mic": 33, "nah": 34, "hab": 35, "zeph": 36,
    "hag": 37, "zech": 38, "mal": 39, "matt": 40, "mt": 40, "mk": 41,
    "lk": 42, "jn": 43, "rom": 45, "1 cor": 46, "2 cor": 47, "gal": 48,
    "eph": 49, "phil": 50, "col": 51, "1 thess": 52, "2 thess": 53,
    "1 tim": 54, "2 tim": 55, "tit": 56, "phlm": 57, "heb": 58,
    "jas": 59, "1 pet": 60, "2 pet": 61, "1 jn": 62, "2 jn": 63,
    "3 jn": 64, "rev": 66,
  };

  // Books that are a single chapter, so a bare "Obadiah" is already a
  // complete reference.
  const SINGLE_CHAPTER_BOOKS = { 31: true, 57: true, 63: true, 64: true, 65: true };

  // Psalm 119 is the longest chapter in the Bible, so 176 stands in for
  // "…through the end of the chapter" when a range runs into the next
  // one — the worker filters a chapter's verses by number, so an end
  // past the last verse should just yield the tail. fetchSpan falls
  // back to the whole chapter if it doesn't.
  const LAST_VERSE = 176;

  // A reference may fan out to at most this many chapter requests. The
  // devotional data tops out at three; the cap is a guard against a
  // typo like "Genesis 1-50" firing fifty fetches.
  const MAX_SPANS = 8;

  // Longest book name wins, so "1 John 2:28" isn't read as John 2:28
  // and "Song of Solomon 2" keeps its three words.
  function splitBookName(text) {
    const words = text.split(" ");
    for (let take = Math.min(words.length, 3); take >= 1; take--) {
      const name = words.slice(0, take).join(" ").toLowerCase();
      if (BOOK_NUMS[name]) {
        return { book: BOOK_NUMS[name], rest: words.slice(take).join(" ").trim() };
      }
    }
    return null;
  }

  // Some references restate the book part-way through: "Isaiah 52:13 -
  // Isaiah 53:12", "Genesis 18:1-15 and Genesis 21:1-7". Drop the
  // repeats so the rest is pure numbers. A *different* book mid-
  // reference isn't one passage the reader can render, so bail.
  function dropRepeatedBookNames(text, book) {
    const words = text.split(" ");
    const kept = [];
    for (let i = 0; i < words.length;) {
      let matched = 0;
      for (let take = Math.min(3, words.length - i); take >= 1; take--) {
        const name = words.slice(i, i + take).join(" ").toLowerCase().replace(/[.,]+$/, "");
        if (BOOK_NUMS[name]) {
          if (BOOK_NUMS[name] !== book) return null;
          matched = take;
          break;
        }
      }
      if (matched) {
        i += matched;
      } else {
        kept.push(words[i]);
        i++;
      }
    }
    return kept.join(" ");
  }

  /*
   * Devotional references are editorial prose, not a tidy grammar:
   *
   *   Hebrews 11:29-12:2                  range crossing a chapter
   *   Romans 16:17-20, 25-27              several spans in one chapter
   *   Genesis 49:1-2 & 8-12               same, with & / "and"
   *   2 Peter 3:8-15a                     partial-verse letters
   *   Jonah 3-4                           whole chapters
   *   Obadiah                             a whole one-chapter book
   *   Psalm 71 (prayer focused on 1-14)   editorial aside
   *
   * The worker serves one chapter per request, so this returns a list of
   * {book, chapter, vStart, vEnd} spans — one per chapter touched — or
   * null when the reference genuinely can't be read. vStart/vEnd null
   * means the whole chapter.
   */
  function parseScriptureRef(ref) {
    if (!ref) return null;

    const cleaned = String(ref)
      .replace(/\([^)]*\)/g, " ") // drop "(prayer focused on 1-14)"
      .replace(/[\u2010-\u2015]/g, "-") // en / em dashes to hyphens
      .replace(/\./g, " ") // "1 Thess. 4" reads as "1 Thess 4"
      .replace(/\s+/g, " ")
      .trim();

    const head = splitBookName(cleaned);
    if (!head) return null;
    const { book } = head;

    if (!head.rest) {
      if (!SINGLE_CHAPTER_BOOKS[book]) return null;
      return [{ book, chapter: 1, vStart: null, vEnd: null }];
    }

    const numbers = dropRepeatedBookNames(head.rest, book);
    if (!numbers) return null;

    // "1-2, 9-18", "1-2 & 8-12" and "1-2 and 14-28" all mean the same
    // thing. Verse-part letters ("15a", "1b") name a clause, which the
    // worker can't slice, so the whole verse is fetched.
    const parts = numbers
      .replace(/\band\b/gi, ",")
      .replace(/[&;]/g, ",")
      .split(",")
      .map((p) => { return p.replace(/(\d)\s*[a-z]\b/gi, "$1").replace(/\s+/g, ""); })
      .filter(Boolean);

    const spans = [];
    let chapter = null;
    // True while a chapter has been named without any verse ("Psalm 133"),
    // so a bare number after it is another chapter rather than a verse:
    // "Psalm 133 and 134" is two psalms, not verse 134 of Psalm 133. Once a
    // colon names a verse, bare numbers that follow are verses in that
    // chapter — "Romans 16:17-20, 25-27".
    let chapterOnly = false;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      let m;

      if ((m = part.match(/^(\d+):(\d+)-(\d+):(\d+)$/))) {
        // Crosses into a later chapter: tail of the first, whole
        // chapters between, head of the last.
        const from = parseInt(m[1], 10);
        const to = parseInt(m[3], 10);
        const vFrom = parseInt(m[2], 10);
        const vTo = parseInt(m[4], 10);
        if (to < from) return null;
        if (to === from) {
          spans.push({ book, chapter: from, vStart: vFrom, vEnd: vTo });
        } else {
          spans.push({ book, chapter: from, vStart: vFrom, vEnd: LAST_VERSE });
          for (let c = from + 1; c < to; c++) {
            if (spans.length > MAX_SPANS) return null;
            spans.push({ book, chapter: c, vStart: null, vEnd: null });
          }
          spans.push({ book, chapter: to, vStart: 1, vEnd: vTo });
        }
        chapter = to;
        chapterOnly = false;
      } else if ((m = part.match(/^(\d+):(\d+)-(\d+)$/))) {
        chapter = parseInt(m[1], 10);
        chapterOnly = false;
        spans.push({ book, chapter, vStart: parseInt(m[2], 10), vEnd: parseInt(m[3], 10) });
      } else if ((m = part.match(/^(\d+):(\d+)$/))) {
        chapter = parseInt(m[1], 10);
        chapterOnly = false;
        const verse = parseInt(m[2], 10);
        spans.push({ book, chapter, vStart: verse, vEnd: verse });
      } else if ((m = part.match(/^(\d+)-(\d+)$/))) {
        const from = parseInt(m[1], 10);
        const to = parseInt(m[2], 10);
        if (chapter === null || chapterOnly) {
          // No verse named yet, so these are chapters: "Jonah 3-4".
          if (to < from) return null;
          for (let c = from; c <= to; c++) {
            if (spans.length > MAX_SPANS) return null;
            spans.push({ book, chapter: c, vStart: null, vEnd: null });
          }
          chapter = to;
          chapterOnly = true;
        } else {
          // A later span carries verses only: "Romans 16:17-20, 25-27".
          spans.push({ book, chapter, vStart: from, vEnd: to });
        }
      } else if ((m = part.match(/^(\d+)$/))) {
        const num = parseInt(m[1], 10);
        if (chapter === null || chapterOnly) {
          // "Psalm 133 and 134" — a second whole chapter, not a verse.
          chapter = num;
          chapterOnly = true;
          spans.push({ book, chapter, vStart: null, vEnd: null });
        } else {
          spans.push({ book, chapter, vStart: num, vEnd: num });
        }
      } else {
        return null;
      }

      if (spans.length > MAX_SPANS) return null;
    }

    return spans.length ? spans : null;
  }

  // True when `b` picks up exactly where `a` left off, so the two can be
  // run together without an elision mark between them.
  function spansAdjoin(a, b) {
    if (b.chapter === a.chapter + 1) {
      // Into the next chapter, continuous only if `a` ran to the end of its
      // own. "Hebrews 11:29-12:2" does; "Genesis 2:15-17 & 3:1-7" skips
      // 2:18-25 and has to say so.
      const ranToChapterEnd = a.vEnd === null || a.vEnd === LAST_VERSE;
      return ranToChapterEnd && (b.vStart === null || b.vStart === 1);
    }
    if (b.chapter !== a.chapter) return false;
    return a.vEnd !== null && b.vStart === a.vEnd + 1;
  }

  // ── Scripture fetching ────────────────────────────────────────
  const scriptureCache = {};
  const SPAN_GAP = '<p class="dlr-scripture-gap" aria-hidden="true">&hellip;</p>';

  function fetchChapter(bollsCode, span, query, BIBLE_BASE) {
    const url = `${BIBLE_BASE}/chapter/${bollsCode}/${span.book}/${span.chapter}${query}`;
    return fetch(url, { credentials: "omit" })
      .then((r) => { return r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)); })
      .then((resp) => { return (resp && resp.data && resp.data.content) || null; });
  }

  function fetchSpan(bollsCode, span, BIBLE_BASE) {
    const cacheKey = `${bollsCode}:${span.book}:${span.chapter}:${span.vStart || ""}-${span.vEnd || ""}`;
    if (scriptureCache[cacheKey]) return Promise.resolve(scriptureCache[cacheKey]);

    let query = "";
    if (span.vStart !== null) {
      query = `?v=${span.vStart}${span.vEnd && span.vEnd !== span.vStart ? `-${span.vEnd}` : ""}`;
    }

    return fetchChapter(bollsCode, span, query, BIBLE_BASE)
      .catch(() => {
        // A span that runs to LAST_VERSE is asking past the end of a
        // chapter that may be shorter. The worker filters by verse
        // number, so that normally just returns the tail — but if it
        // ever rejects the range, a whole chapter beats an error where
        // the reading should be.
        if (span.vEnd !== LAST_VERSE) throw new Error("span failed");
        return fetchChapter(bollsCode, span, "", BIBLE_BASE);
      })
      .then((content) => {
        if (content) scriptureCache[cacheKey] = content;
        return content;
      })
      .catch(() => { return null; });
  }

  function fetchScripture(ref, translationKey, base) {
    const BIBLE_BASE = (base || defaultBase()).replace(/\/$/, "");
    const bollsCode = TRANSLATION_CODES[translationKey];
    if (!bollsCode) {
      return Promise.resolve({
        html: `<em>${translationKey} is not yet available. Showing ESV.</em>`,
        fallback: true,
      });
    }

    const spans = parseScriptureRef(ref);
    if (!spans) {
      return Promise.resolve({ html: `<em>Could not parse reference: ${escapeHtml(ref)}</em>` });
    }

    if (!BIBLE_BASE) {
      return Promise.resolve({ html: "<em>Bible worker not configured.</em>" });
    }

    return Promise.all(spans.map((span) => { return fetchSpan(bollsCode, span, BIBLE_BASE); }))
      .then((contents) => {
        const loaded = [];
        for (let i = 0; i < spans.length; i++) {
          if (contents[i]) loaded.push({ span: spans[i], html: contents[i] });
        }
        if (!loaded.length) {
          return { html: "<em>Could not load this passage. Try reloading.</em>" };
        }

        let { html } = loaded[0];
        for (let i = 1; i < loaded.length; i++) {
          if (!spansAdjoin(loaded[i - 1].span, loaded[i].span)) html += SPAN_GAP;
          html += loaded[i].html;
        }
        if (loaded.length < spans.length) {
          html += "<p><em>Part of this passage could not be loaded.</em></p>";
        }
        return { html };
      });
  }

  window.MODailyScripture = { fetchScripture, parseScriptureRef, TRANSLATION_CODES, SPAN_GAP };
}());
