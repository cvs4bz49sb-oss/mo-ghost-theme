/*
 * Daily Liturgy Reader
 *
 * Two scripture modes (toggle saved to localStorage):
 *   Devotional  — readings from the daily devotional data
 *   Bible in 2 Years — 736-day plan replaces the three scripture
 *                       blocks; prayers/liturgy still from devotional
 */
(function () {
  "use strict";

  const CALENDAR_URL = window.moAssetUrl("/assets/data/daily-liturgy/calendar.json");
  const DEVOTIONALS_URL = window.moAssetUrl("/assets/data/daily-liturgy/devotionals.json");
  const BI2Y_URL = window.moAssetUrl("/assets/data/daily-liturgy/bible-in-2-years.json");
  const BI2Y_START = "2026-01-01";
  const BI2Y_TOTAL_DAYS = 736;
  // Every other feed consumer (podcast-feed.js, dlp-band.js) reads the
  // worker URL off body[data-podcast-feed-url], which Ghost fills from
  // @custom.podcast_feed_url. This page had it hardcoded, so repointing
  // the setting would leave the reader talking to the old worker.
  const PODCAST_FEED_DEFAULT = "https://mo-podcast-feed.mo-podcast-feed.workers.dev";
  const PODCAST_FEED_URL =
    (document.body.getAttribute("data-podcast-feed-url") || "").trim() || PODCAST_FEED_DEFAULT;
  const LS_TRANSLATION = "mo-liturgy-translation";
  const LS_MODE = "mo-liturgy-mode";
  const LS_SCRIPTURE = "mo-liturgy-scripture";
  const DEFAULT_TRANSLATION = "ESV";

  const TRANSLATION_CODES = {
    CSB: "CSB17",
    KJV: "KJV",
    ESV: "ESV",
    NIV: "NIV",
    NASB: "NASB",
  };

  // ── DOM refs ──────────────────────────────────────────────────
  const page = document.querySelector("[data-dlr-page]");
  if (!page) return;

  const $ = function (sel) { return page.querySelector(sel); };
  const $title = $("[data-dlr-title]");
  const $season = $("[data-dlr-season]");
  const $prev = $("[data-dlr-prev]");
  const $next = $("[data-dlr-next]");
  const $today = $("[data-dlr-today]");
  const $catchup = $("[data-dlr-catchup]");
  const $body = $("[data-dlr-body]");
  const $loading = $("[data-dlr-loading]");
  const $error = $("[data-dlr-error]");
  const $errorMsg = $("[data-dlr-error-msg]");
  const $retry = $("[data-dlr-retry]");
  const $empty = $("[data-dlr-empty]");
  const $nav = $("[data-dlr-nav]");
  const $translationSelect = $("[data-dlr-translation-select]");
  const $modeToggle = $("[data-dlr-mode-toggle]");

  // Section labels we swap between modes
  const $psalmSection = page.querySelector("[data-dlr-psalm-reading]");
  const $psalmLabel = $psalmSection ? $psalmSection.closest(".dlr-section").querySelector(".dlr-label") : null;
  const $psalmTransition = $psalmSection ? $psalmSection.closest(".dlr-section").querySelector(".dlr-transition") : null;

  const bibleMeta = page.querySelector('meta[name="mo-bible-base"]');
  const BIBLE_BASE = (bibleMeta && bibleMeta.content || "").replace(/\/$/, "");

  // ── State ─────────────────────────────────────────────────────
  let calendar = null;
  let devotionals = null;
  let bi2yPlan = null;
  let currentDate = null;
  let translation = DEFAULT_TRANSLATION;
  let mode = "devotional";
  let scriptureExpanded = true;

  // ── Helpers ───────────────────────────────────────────────────
  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function addDaysStr(dateStr, n) {
    const d = new Date(`${dateStr}T12:00:00`);
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function daysBetween(a, b) {
    const da = new Date(`${a}T12:00:00`);
    const db = new Date(`${b}T12:00:00`);
    return Math.round((db - da) / 86400000);
  }

  function isSunday(dateStr) {
    return new Date(`${dateStr}T12:00:00`).getDay() === 0;
  }

  function findPrevDate(dateStr) {
    let d = addDaysStr(dateStr, -1);
    for (let i = 0; i < 7; i++) {
      if (calendar[d]) return d;
      d = addDaysStr(d, -1);
    }
    return null;
  }

  function findNextDate(dateStr) {
    const today = todayStr();
    let d = addDaysStr(dateStr, 1);
    for (let i = 0; i < 7; i++) {
      if (d > today) return null;
      if (calendar[d]) return d;
      d = addDaysStr(d, 1);
    }
    return null;
  }

  function findTodayOrLatest() {
    const today = todayStr();
    if (calendar[today]) return today;
    return findPrevDate(today);
  }

  function bi2yDayForDate(dateStr) {
    const diff = daysBetween(BI2Y_START, dateStr) + 1;
    if (diff < 1) return 1;
    if (diff > BI2Y_TOTAL_DAYS) return BI2Y_TOTAL_DAYS;
    return diff;
  }

  function showState(state) {
    const isContent = state === "content";
    $loading.hidden = state !== "loading";
    $error.hidden = state !== "error";
    $empty.hidden = state !== "empty";
    $nav.hidden = state === "loading" || state === "error";
    $body.hidden = !isContent;
    const $options = $(".dlr-options");
    if ($options) $options.hidden = !isContent;
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
            spans.push({ book, chapter: c, vStart: null, vEnd: null });
          }
          spans.push({ book, chapter: to, vStart: 1, vEnd: vTo });
        }
        chapter = to;
      } else if ((m = part.match(/^(\d+):(\d+)-(\d+)$/))) {
        chapter = parseInt(m[1], 10);
        spans.push({ book, chapter, vStart: parseInt(m[2], 10), vEnd: parseInt(m[3], 10) });
      } else if ((m = part.match(/^(\d+):(\d+)$/))) {
        chapter = parseInt(m[1], 10);
        const verse = parseInt(m[2], 10);
        spans.push({ book, chapter, vStart: verse, vEnd: verse });
      } else if ((m = part.match(/^(\d+)-(\d+)$/))) {
        const from = parseInt(m[1], 10);
        const to = parseInt(m[2], 10);
        if (chapter === null) {
          // No chapter named yet, so these are chapters: "Jonah 3-4".
          if (to < from) return null;
          for (let c = from; c <= to; c++) {
            spans.push({ book, chapter: c, vStart: null, vEnd: null });
          }
          chapter = to;
        } else {
          // A later span carries verses only: "Romans 16:17-20, 25-27".
          spans.push({ book, chapter, vStart: from, vEnd: to });
        }
      } else if ((m = part.match(/^(\d+)$/))) {
        const num = parseInt(m[1], 10);
        if (chapter === null) {
          chapter = num;
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
    if (b.chapter === a.chapter + 1) return b.vStart === null || b.vStart === 1;
    if (b.chapter !== a.chapter) return false;
    return a.vEnd !== null && b.vStart === a.vEnd + 1;
  }

  // ── Scripture fetching ────────────────────────────────────────
  const scriptureCache = {};
  const SPAN_GAP = '<p class="dlr-scripture-gap" aria-hidden="true">&hellip;</p>';

  function fetchChapter(bollsCode, span, query) {
    const url = `${BIBLE_BASE}/chapter/${bollsCode}/${span.book}/${span.chapter}${query}`;
    return fetch(url, { credentials: "omit" })
      .then((r) => { return r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)); })
      .then((resp) => { return (resp && resp.data && resp.data.content) || null; });
  }

  function fetchSpan(bollsCode, span) {
    const cacheKey = `${bollsCode}:${span.book}:${span.chapter}:${span.vStart || ""}-${span.vEnd || ""}`;
    if (scriptureCache[cacheKey]) return Promise.resolve(scriptureCache[cacheKey]);

    let query = "";
    if (span.vStart !== null) {
      query = `?v=${span.vStart}${span.vEnd && span.vEnd !== span.vStart ? `-${span.vEnd}` : ""}`;
    }

    return fetchChapter(bollsCode, span, query)
      .catch(() => {
        // A span that runs to LAST_VERSE is asking past the end of a
        // chapter that may be shorter. The worker filters by verse
        // number, so that normally just returns the tail — but if it
        // ever rejects the range, a whole chapter beats an error where
        // the reading should be.
        if (span.vEnd !== LAST_VERSE) throw new Error("span failed");
        return fetchChapter(bollsCode, span, "");
      })
      .then((content) => {
        if (content) scriptureCache[cacheKey] = content;
        return content;
      })
      .catch(() => { return null; });
  }

  function fetchScripture(ref, translationKey) {
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

    return Promise.all(spans.map((span) => { return fetchSpan(bollsCode, span); }))
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

  // ── Render ────────────────────────────────────────────────────
  function render(dateStr) {
    const entry = calendar[dateStr];
    if (!entry) {
      if (isSunday(dateStr)) {
        showState("empty");
      } else {
        $errorMsg.textContent = "No devotional found for this date.";
        showState("error");
      }
      return;
    }

    const dev = devotionals[entry.key];
    if (!dev) {
      $errorMsg.textContent = `Devotional content missing for ${entry.key}`;
      showState("error");
      return;
    }

    currentDate = dateStr;
    const isToday = dateStr === todayStr();

    $title.textContent = dev.title.replace(/\s+of\s+.*$/, "");
    $season.textContent = entry.season;

    const prevDate = findPrevDate(dateStr);
    const nextDate = findNextDate(dateStr);
    $prev.disabled = !prevDate;
    $next.disabled = !nextDate;
    $prev._date = prevDate;
    $next._date = nextDate;
    $today.hidden = isToday;
    $catchup.hidden = isToday;

    // Prayers always from devotional
    renderPrayer("[data-dlr-opening-prayer]", dev.openingPrayerText, true);
    renderPrayer("[data-dlr-confession]", dev.confession);
    renderPrayer("[data-dlr-adoration]", dev.adoration);
    renderPrayer("[data-dlr-consecration]", dev.consecration);
    renderPrayer("[data-dlr-benediction]", dev.benediction);

    // Scripture: BI2Y overrides if active and data loaded
    let otRef = dev.otReading;
    let ntRef = dev.ntReading;
    let psalmRef = dev.psalmReading;

    if (mode === "bi2y" && bi2yPlan) {
      const dayNum = bi2yDayForDate(dateStr);
      const bi2y = bi2yPlan[String(dayNum)];
      if (bi2y) {
        otRef = bi2y.ot;
        ntRef = bi2y.nt;
        psalmRef = bi2y.wisdom;
      }
    }

    // Update the Psalm section label for BI2Y
    if ($psalmLabel) {
      $psalmLabel.textContent = mode === "bi2y" ? "Psalms, Proverbs & Ecclesiastes" : "Psalm Reading";
    }
    if ($psalmTransition) {
      $psalmTransition.textContent = mode === "bi2y"
        ? "The word of the Lord"
        : "The word of the Lord, from the Psalms";
    }

    $("[data-dlr-ot-ref]").textContent = `${otRef} (${translation})`;
    $("[data-dlr-nt-ref]").textContent = `${ntRef} (${translation})`;
    $("[data-dlr-psalm-ref]").textContent = `${psalmRef} (${translation})`;

    showState("content");

    if (updatePodcastForDate) updatePodcastForDate(dateStr);

    loadScripture(otRef, "[data-dlr-ot-text]");
    loadScripture(ntRef, "[data-dlr-nt-text]");
    loadScripture(psalmRef, "[data-dlr-psalm-text]");

    const $closing = $("[data-dlr-closing]");
    if ($closing) {
      const dow = new Date(`${dateStr}T12:00:00`).getDay();
      $closing.textContent = dow === 6
        ? "We’ll see you again Monday for another Daily Liturgy."
        : "We’ll see you again tomorrow for another Daily Liturgy.";
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderPrayer(selector, text, asLines) {
    const el = $(selector);
    if (!el || !text) return;
    if (asLines) {
      el.innerHTML = text.split("\n")
        .filter((l) => { return l.trim(); })
        .map((l) => { return `<span class="dlr-line">${escapeHtml(l)}</span>`; })
        .join("");
    } else {
      el.innerHTML = `<p>${escapeHtml(text)}</p>`;
    }
  }

  function loadScripture(ref, textSelector) {
    const el = $(textSelector);
    if (!el) return;
    el.innerHTML = "Loading&hellip;";

    fetchScripture(ref, translation).then((result) => {
      if (result.fallback) {
        return fetchScripture(ref, "ESV").then((csb) => {
          el.innerHTML = result.html + csb.html;
          const refEl = el.parentElement.querySelector(".dlr-scripture-ref");
          if (refEl) refEl.textContent = `${ref} (ESV)`;
        });
      }
      el.innerHTML = result.html;
    });
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ── Mode switching ───────────────────────────────────────────
  function setMode(newMode) {
    mode = newMode;
    try { localStorage.setItem(LS_MODE, mode); } catch (e) {}

    if ($modeToggle) {
      const buttons = $modeToggle.querySelectorAll("[data-dlr-mode]");
      for (let i = 0; i < buttons.length; i++) {
        buttons[i].classList.toggle("is-active", buttons[i].getAttribute("data-dlr-mode") === mode);
      }
    }

    if (mode === "bi2y" && !bi2yPlan) {
      fetch(BI2Y_URL)
        .then((r) => { return r.ok ? r.json() : Promise.reject(new Error("Plan not found")); })
        .then((plan) => {
          bi2yPlan = plan;
          if (currentDate) render(currentDate);
        })
        .catch((err) => {
          console.error("bi2y load", err);
        });
    } else if (currentDate) {
      render(currentDate);
    }
  }

  if ($modeToggle) {
    const buttons = $modeToggle.querySelectorAll("[data-dlr-mode]");
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener("click", function () {
        const m = this.getAttribute("data-dlr-mode");
        if (m !== mode) setMode(m);
      });
    }
  }

  // ── Translation switching ─────────────────────────────────────
  if ($translationSelect) {
    try {
      const saved = localStorage.getItem(LS_TRANSLATION);
      if (saved && TRANSLATION_CODES[saved] !== undefined) translation = saved;
    } catch (e) {}

    $translationSelect.value = translation;
    $translationSelect.addEventListener("change", () => {
      const t = $translationSelect.value;
      if (t === translation) return;
      translation = t;
      try { localStorage.setItem(LS_TRANSLATION, t); } catch (e) {}
      if (currentDate) render(currentDate);
    });
  }

  // ── Scripture expand/collapse ──────────────────────────────────
  const $scriptureToggle = $("[data-dlr-scripture-toggle]");
  const allScriptures = page.querySelectorAll(".dlr-scripture");

  function setScriptureExpanded(expanded) {
    scriptureExpanded = expanded;
    try { localStorage.setItem(LS_SCRIPTURE, expanded ? "expand" : "collapse"); } catch (e) {}

    for (let i = 0; i < allScriptures.length; i++) {
      allScriptures[i].classList.toggle("is-collapsed", !expanded);
      const ref = allScriptures[i].querySelector(".dlr-scripture-ref");
      if (ref) ref.setAttribute("aria-expanded", String(expanded));
    }

    if ($scriptureToggle) {
      const btns = $scriptureToggle.querySelectorAll("[data-dlr-expand]");
      for (let j = 0; j < btns.length; j++) {
        const isExpand = btns[j].getAttribute("data-dlr-expand") === "expand";
        btns[j].classList.toggle("is-active", isExpand === expanded);
      }
    }
  }

  if ($scriptureToggle) {
    const sBtns = $scriptureToggle.querySelectorAll("[data-dlr-expand]");
    for (let si = 0; si < sBtns.length; si++) {
      sBtns[si].addEventListener("click", function () {
        setScriptureExpanded(this.getAttribute("data-dlr-expand") === "expand");
      });
    }
  }

  // Individual scripture ref click toggles that one block
  for (let ri = 0; ri < allScriptures.length; ri++) {
    (function (scripture) {
      const ref = scripture.querySelector(".dlr-scripture-ref");
      if (ref) {
        ref.addEventListener("click", () => {
          const collapsed = scripture.classList.toggle("is-collapsed");
          ref.setAttribute("aria-expanded", String(!collapsed));
        });
      }
    })(allScriptures[ri]);
  }

  // ── Navigation ────────────────────────────────────────────────
  $prev.addEventListener("click", () => {
    if ($prev._date) render($prev._date);
  });
  $next.addEventListener("click", () => {
    if ($next._date) render($next._date);
  });
  $today.addEventListener("click", () => {
    const d = findTodayOrLatest();
    if (d) render(d);
  });
  if ($retry) {
    $retry.addEventListener("click", () => { init(); });
  }

  document.addEventListener("keydown", (e) => {
    const t = e.target;
    if (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA") return;
    if (e.key === "ArrowLeft" && !$prev.disabled) { e.preventDefault(); $prev.click(); }
    if (e.key === "ArrowRight" && !$next.disabled) { e.preventDefault(); $next.click(); }
  });

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    showState("loading");

    const fetches = [
      fetch(CALENDAR_URL).then((r) => { return r.ok ? r.json() : Promise.reject(new Error("Calendar not found")); }),
      fetch(DEVOTIONALS_URL).then((r) => { return r.ok ? r.json() : Promise.reject(new Error("Devotionals not found")); }),
    ];

    if (mode === "bi2y") {
      fetches.push(
        fetch(BI2Y_URL).then((r) => { return r.ok ? r.json() : Promise.reject(new Error("Plan not found")); })
      );
    }

    Promise.all(fetches)
      .then((results) => {
        calendar = results[0];
        devotionals = results[1];
        if (results[2]) bi2yPlan = results[2];

        const startDate = findTodayOrLatest();
        if (!startDate) {
          if (isSunday(todayStr())) {
            showState("empty");
          } else {
            $errorMsg.textContent = "No devotional available for today.";
            showState("error");
          }
          return;
        }
        render(startDate);
      })
      .catch((err) => {
        console.error("dlr init", err);
        $errorMsg.textContent = "Could not load devotional data.";
        showState("error");
      });
  }

  // ── Engagement ping ───────────────────────────────────────────
  //
  // One `devotional_engaged` event per page session, sent to mo-kit,
  // which records the day and derives streaks. Not fired on page load:
  // opening the tab is not using the thing. It takes reaching the
  // Benediction, a minute and a half on the page, or pressing play.
  //
  // No date is sent. The worker stamps the day the member turned up in
  // the liturgy's own timezone — see the DAILY LITURGY USAGE block in
  // kit.js for why that beats the date of whichever devotional is open.
  // Audio gets its own ping rather than sharing the read guard: someone
  // who reads for two minutes and *then* presses play would otherwise
  // never be counted as a listener. Two events per session at the very
  // most, and the worker only writes to Kit on the first audio play the
  // member has ever made.
  const DWELL_MS = 90000;
  let engagementSent = false;
  let audioSent = false;

  function markEngaged(via) {
    // kit-events.js ships in site.min.js and no-ops for signed-out
    // visitors, but this file is loaded standalone at the end of the
    // template, so the helper may not exist yet on a slow connection.
    if (!window.__kitEmit) return;
    if (via === "audio") {
      if (audioSent) return;
      audioSent = true;
      engagementSent = true;
      window.__kitEmit("devotional_engaged", { via: "audio" });
      return;
    }
    if (engagementSent) return;
    engagementSent = true;
    window.__kitEmit("devotional_engaged", { via: "read" });
  }

  (function () {
    setTimeout(() => { markEngaged("read"); }, DWELL_MS);

    // Reaching the Benediction is the strongest read signal the page
    // has — it is the last thing in the liturgy.
    const $benediction = page.querySelector(".dlr-section--benediction");
    if ($benediction && "IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            markEngaged("read");
            io.disconnect();
            return;
          }
        }
      }, { threshold: 0.4 });
      io.observe($benediction);
    }
  })();

  // ── Podcast player (date-aware) ────────────────────────────────
  let updatePodcastForDate = null;

  (function () {
    const $podcast = $("[data-dlr-podcast]");
    const $audio = $("[data-dlr-audio]");
    const $playBtn = $("[data-dlr-play]");
    const $backBtn = $("[data-dlr-back]");
    const $fwdBtn = $("[data-dlr-forward]");
    const $playIcon = $podcast && $podcast.querySelector(".dlr-play-icon");
    const $pauseIcon = $podcast && $podcast.querySelector(".dlr-pause-icon");
    const $ptitle = $("[data-dlr-player-title]");
    const $note = $("[data-dlr-player-note]");
    const $progress = $("[data-dlr-progress]");
    const $bar = $("[data-dlr-bar]");
    const $elapsed = $("[data-dlr-elapsed]");
    const $time = $("[data-dlr-time]");
    if (!$podcast || !$audio) return;

    const ARTWORK_URL = "https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/07/Mere-Orthodoxy-Podcast-Covers--2-.jpg";
    const SKIP_SECONDS = 15;
    const DEFAULT_NOTE = "Follows the Devotional Plan";
    const LATEST_NOTE = "Latest episode";

    const MONTH_MAP = {
      jan: "01", feb: "02", mar: "03", apr: "04",
      may: "05", jun: "06", jul: "07", aug: "08",
      sep: "09", oct: "10", nov: "11", dec: "12"
    };

    const episodesByDate = {};
    let feedLoaded = false;
    let latestEpisode = null; // newest released episode, whatever day it is
    let latestRank = -Infinity;
    let pendingDate = null;
    let loadedEpisode = null; // whose audioUrl is in the <audio>
    let viewEpisode = null; // episode for the day on screen
    let viewIsFallback = false; // showing the latest episode, not the day's
    let scrubbing = false;

    // Episode titles carry the day the episode is for — the show writes
    // them "Tuesday, August 4, 2026". A title is hand-typed metadata
    // though, so match the date wherever it sits in the string and
    // accept abbreviated months; pubDate stands in when the title
    // carries no readable date at all. Anchoring on the old exact
    // "Weekday, Month D, YYYY" prefix meant one retitled episode
    // dropped the day out of the map and hid the player outright.
    function ymd(year, monthName, day) {
      const mon = MONTH_MAP[monthName.slice(0, 3).toLowerCase()];
      if (!mon) return null;
      return `${year}-${mon}-${String(parseInt(day, 10)).padStart(2, "0")}`;
    }

    function dateFromText(text) {
      const s = String(text || "");
      const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
      // "August 4, 2026" — how the show writes its titles.
      const named = s.match(/([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/);
      if (named) return ymd(named[3], named[1], named[2]);
      // "Tue, 04 Aug 2026 05:00:00 -0400" — RFC 822, which is what the
      // worker hands back for pubDate when it passes the RSS value
      // through untouched. Day before month, so it needs its own pass.
      const rfc = s.match(/(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})/);
      if (rfc) return ymd(rfc[3], rfc[2], rfc[1]);
      return null;
    }

    // Read pubDate as text, not through Date: both the ISO form (with the
    // publisher's offset) and the RFC 822 form carry the day the episode
    // was released in the show's own zone, and parsing shifts it into the
    // reader's — which lands on the wrong day for anyone west of Coram Deo.
    function episodeDate(ep) {
      if (!ep) return null;
      return dateFromText(ep.title) || dateFromText(ep.pubDate);
    }

    // Buzzsprout keeps accepted-but-unreleased episodes in the feed with
    // a future pubDate. The worker filters them, but the theme can't
    // assume that: an unreleased episode must never become the fallback.
    // Fail open — an unparseable date counts as released.
    function isScheduled(ep) {
      const t = Date.parse((ep && ep.pubDate) || "");
      return !Number.isNaN(t) && t > Date.now();
    }

    // The worker answers `?show=daily-liturgy` with a slug-keyed object.
    // Accept a bare list or a bare `{episodes}` too, so a worker-side
    // shape change degrades to "player still works" instead of "player
    // vanishes". Never fall back to another show's key.
    function pickEpisodes(data) {
      if (!data) return [];
      if (Array.isArray(data)) return data;
      if (Array.isArray(data.episodes)) return data.episodes;
      const show = data["daily-liturgy"];
      return show && Array.isArray(show.episodes) ? show.episodes : [];
    }

    function fmt(s) {
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return `${m}:${sec < 10 ? "0" : ""}${sec}`;
    }

    // `hidden` is an HTMLElement property, so `svg.hidden = true` only
    // sets a JS expando and never reaches the attribute the CSS keys
    // on. SVG icons have to be toggled through the attribute directly.
    function show(node, visible) {
      if (!node) return;
      if (visible) { node.removeAttribute("hidden"); }
      else { node.setAttribute("hidden", ""); }
    }

    // ─── Media Session (lock screen / Bluetooth controls) ──────────
    //
    // Without this the audio still plays with the screen locked, but
    // iOS shows a generic "web page" tile with no title, artwork or
    // scrubber. AirPods ear-detection rides on the play/pause handlers.
    function safeSessionHandler(action, fn) {
      try { navigator.mediaSession.setActionHandler(action, fn); }
      catch (_) { /* unsupported action on this platform */ }
    }

    function wireMediaSession() {
      if (!("mediaSession" in navigator)) return;
      try {
        navigator.mediaSession.metadata = new window.MediaMetadata({
          title: (loadedEpisode && loadedEpisode.title) || "The Daily Liturgy",
          artist: "The Daily Liturgy Podcast",
          album: "Mere Orthodoxy",
          artwork: [{ src: ARTWORK_URL, sizes: "512x512", type: "image/jpeg" }],
        });
      } catch (_) { /* older browsers */ }
      safeSessionHandler("play", () => { play(); });
      safeSessionHandler("pause", () => { $audio.pause(); });
      safeSessionHandler("seekbackward", (e) => { nudge(-((e && e.seekOffset) || SKIP_SECONDS)); });
      safeSessionHandler("seekforward", (e) => { nudge((e && e.seekOffset) || SKIP_SECONDS); });
      safeSessionHandler("seekto", (e) => {
        if (!e) return;
        if (e.fastSeek && "fastSeek" in $audio) $audio.fastSeek(e.seekTime);
        else $audio.currentTime = e.seekTime;
        paint();
      });
    }

    function updatePositionState() {
      if (!("mediaSession" in navigator) || !navigator.mediaSession.setPositionState) return;
      if (!$audio.duration || !isFinite($audio.duration)) return;
      try {
        navigator.mediaSession.setPositionState({
          duration: $audio.duration,
          playbackRate: $audio.playbackRate,
          position: Math.min($audio.currentTime, $audio.duration),
        });
      } catch (_) { /* ignore */ }
    }

    // ─── Transport ────────────────────────────────────────────────
    function play() {
      wireMediaSession();
      markEngaged("audio");
      const p = $audio.play();
      if (p && p.catch) p.catch(() => {});
    }

    function nudge(delta) {
      const dur = $audio.duration;
      if (!dur || !isFinite(dur)) return;
      $audio.currentTime = Math.min(dur, Math.max(0, $audio.currentTime + delta));
      paint();
    }

    function paint() {
      const dur = $audio.duration;
      const known = dur && isFinite(dur);
      const pct = known ? ($audio.currentTime / dur) * 100 : 0;
      $bar.style.width = `${pct}%`;
      $elapsed.textContent = fmt($audio.currentTime || 0);
      if (known) $time.textContent = fmt(dur);
      $progress.setAttribute("aria-valuenow", String(Math.round(pct)));
      $progress.setAttribute(
        "aria-valuetext",
        `${fmt($audio.currentTime || 0)}${known ? ` of ${fmt(dur)}` : ""}`
      );
    }

    // ─── Episode loading ──────────────────────────────────────────
    function noteText() {
      return viewIsFallback ? LATEST_NOTE : DEFAULT_NOTE;
    }

    function load(ep) {
      loadedEpisode = ep;
      $audio.pause();
      $audio.src = ep.audioUrl;
      $audio.currentTime = 0;
      $bar.style.width = "0%";
      $elapsed.textContent = "0:00";
      $time.textContent = ep.duration ? fmt(ep.duration) : "";
      $ptitle.textContent = ep.title || "Today's episode";
      $note.textContent = noteText();
      show($playIcon, true);
      show($pauseIcon, false);
      $podcast.classList.remove("is-playing");
      $podcast.hidden = false;
    }

    // Navigating to another day while something is playing does not cut
    // the audio off — the swap is deferred until playback stops, the
    // way a podcast app keeps playing while you browse the library.
    function applyDeferred() {
      if (!viewEpisode) {
        if (loadedEpisode) $podcast.hidden = true;
        return;
      }
      if (!loadedEpisode || viewEpisode.audioUrl !== loadedEpisode.audioUrl) load(viewEpisode);
      else $note.textContent = noteText();
    }

    // The day's episode drops in the morning. Before it lands — or when
    // a title we can't read keeps it out of the map — the newest
    // released episode is still the right thing to offer, labelled so
    // nobody takes it for today's. Hiding the whole player was the
    // worst of the options: no audio, and nothing to tell you why.
    function resolveEpisode(dateStr) {
      const exact = episodesByDate[dateStr];
      if (exact) return { ep: exact, fallback: false };
      if (!latestEpisode) return { ep: null, fallback: false };
      const dated = Object.keys(episodesByDate).length > 0;
      if (dateStr >= todayStr() || !dated) return { ep: latestEpisode, fallback: true };
      return { ep: null, fallback: false };
    }

    function showEpisode(dateStr) {
      const resolved = resolveEpisode(dateStr);
      viewEpisode = resolved.ep;
      viewIsFallback = resolved.fallback;
      const busy = !$audio.paused && loadedEpisode;
      if (busy) {
        const sameEp = viewEpisode && viewEpisode.audioUrl === loadedEpisode.audioUrl;
        $note.textContent = sameEp
          ? noteText()
          : `Still playing ${loadedEpisode.title || "the previous episode"}`;
        $podcast.hidden = false;
        return;
      }
      if (!viewEpisode) {
        $podcast.hidden = true;
        return;
      }
      applyDeferred();
      $podcast.hidden = false;
    }

    // Gate on "the feed answered", not on "some episode had a readable
    // date" — the old size check left the player waiting forever on a
    // feed whose titles it couldn't parse.
    updatePodcastForDate = function (dateStr) {
      if (!feedLoaded) {
        pendingDate = dateStr;
        return;
      }
      showEpisode(dateStr);
    };

    function ingest(data) {
      const episodes = pickEpisodes(data);
      // "The worker doesn't serve this show" and "no episode today" look
      // identical on the page. Name the difference in the console: the
      // keys the feed did return say which one you're looking at.
      if (!episodes.length && window.console) {
        const keys = data && typeof data === "object" && !Array.isArray(data)
          ? Object.keys(data).join(", ") || "(none)"
          : String(data);
        window.console.warn(`Daily Liturgy podcast feed returned no episodes for show=daily-liturgy. Feed keys: ${keys}`);
      }
      episodes.forEach((ep) => {
        if (!ep || !ep.audioUrl) return;
        const d = episodeDate(ep);
        if (d && !episodesByDate[d]) episodesByDate[d] = ep;
        if (isScheduled(ep)) return;
        const ts = Date.parse(ep.pubDate || "");
        const rank = Number.isNaN(ts) ? -Infinity : ts;
        if (!latestEpisode || rank > latestRank) {
          latestEpisode = ep;
          latestRank = rank;
        }
      });
      feedLoaded = true;
      const dateStr = pendingDate || currentDate;
      if (dateStr) showEpisode(dateStr);
    }

    const feedSep = PODCAST_FEED_URL.indexOf("?") > -1 ? "&" : "?";
    fetch(`${PODCAST_FEED_URL}${feedSep}show=daily-liturgy&limit=30`, { credentials: "omit" })
      .then((r) => {
        if (!r.ok) throw new Error(`podcast feed HTTP ${r.status}`);
        return r.json();
      })
      .then(ingest)
      .catch((err) => {
        // A bare catch here is why a missing player looks identical to a
        // day with no episode. Leave a breadcrumb in the console.
        if (window.console) window.console.warn("Daily Liturgy podcast feed unavailable:", err);
      });

    $playBtn.addEventListener("click", () => {
      if ($audio.paused) play();
      else $audio.pause();
    });
    $backBtn.addEventListener("click", () => { nudge(-SKIP_SECONDS); });
    $fwdBtn.addEventListener("click", () => { nudge(SKIP_SECONDS); });

    // playbackState is what the lock screen reads to decide whether it
    // shows a play or a pause control; it does not track the element.
    function setPlaybackState(state) {
      if (!("mediaSession" in navigator)) return;
      try { navigator.mediaSession.playbackState = state; } catch (_) { /* ignore */ }
    }

    $audio.addEventListener("play", () => {
      show($playIcon, false);
      show($pauseIcon, true);
      $playBtn.setAttribute("aria-label", "Pause episode");
      $podcast.classList.add("is-playing");
      setPlaybackState("playing");
    });
    $audio.addEventListener("pause", () => {
      show($playIcon, true);
      show($pauseIcon, false);
      $playBtn.setAttribute("aria-label", "Play episode");
      $podcast.classList.remove("is-playing");
      setPlaybackState("paused");
      applyDeferred();
    });
    $audio.addEventListener("ended", () => { applyDeferred(); });
    $audio.addEventListener("loadedmetadata", () => { paint(); updatePositionState(); });
    $audio.addEventListener("timeupdate", () => {
      if (scrubbing) return;
      paint();
      updatePositionState();
    });

    // ─── Scrubbing ────────────────────────────────────────────────
    function seekToEvent(clientX) {
      const dur = $audio.duration;
      if (!dur || !isFinite(dur)) return;
      const rect = $progress.getBoundingClientRect();
      const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      $audio.currentTime = pct * dur;
      paint();
    }

    $progress.addEventListener("pointerdown", (e) => {
      if (!$audio.duration || !isFinite($audio.duration)) return;
      scrubbing = true;
      $progress.classList.add("is-scrubbing");
      $progress.setPointerCapture(e.pointerId);
      seekToEvent(e.clientX);
    });
    $progress.addEventListener("pointermove", (e) => {
      if (scrubbing) seekToEvent(e.clientX);
    });
    ["pointerup", "pointercancel"].forEach((evt) => {
      $progress.addEventListener(evt, () => {
        if (!scrubbing) return;
        scrubbing = false;
        $progress.classList.remove("is-scrubbing");
        updatePositionState();
      });
    });
    $progress.addEventListener("keydown", (e) => {
      const dur = $audio.duration;
      if (!dur || !isFinite(dur)) return;
      const keys = {
        ArrowLeft: -5, ArrowRight: 5,
        ArrowDown: -5, ArrowUp: 5,
        PageDown: -30, PageUp: 30,
      };
      if (e.key in keys) { nudge(keys[e.key]); }
      else if (e.key === "Home") { $audio.currentTime = 0; paint(); }
      else if (e.key === "End") { $audio.currentTime = dur; paint(); }
      else return;
      e.preventDefault();
    });
  })();

  // Restore saved preferences
  try {
    const savedMode = localStorage.getItem(LS_MODE);
    if (savedMode === "bi2y") mode = "bi2y";
    const savedScripture = localStorage.getItem(LS_SCRIPTURE);
    if (savedScripture === "collapse") {
      scriptureExpanded = false;
      setScriptureExpanded(false);
    }
  } catch (e) {}

  if ($modeToggle) {
    const allBtns = $modeToggle.querySelectorAll("[data-dlr-mode]");
    for (let j = 0; j < allBtns.length; j++) {
      allBtns[j].classList.toggle("is-active", allBtns[j].getAttribute("data-dlr-mode") === mode);
    }
  }

  init();
})();
