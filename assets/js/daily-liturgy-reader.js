/*
 * Daily Liturgy Reader — displays one devotional per day with
 * backward navigation and member translation switching.
 *
 * Data lives in /assets/data/daily-liturgy/:
 *   calendar.json   — { "2026-11-30": { key, season }, ... }
 *   devotionals.json — { "advent-w1-mon": { ...fields }, ... }
 *
 * Scripture is fetched live from the mo-bible worker (API.Bible proxy).
 * Translation preference stored in localStorage.
 */
(function () {
  "use strict";

  const CALENDAR_URL = "/assets/data/daily-liturgy/calendar.json";
  const DEVOTIONALS_URL = "/assets/data/daily-liturgy/devotionals.json";
  const LS_TRANSLATION = "mo-liturgy-translation";
  const DEFAULT_TRANSLATION = "CSB";

  // bolls.life translation codes
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

  const $ = (sel) => page.querySelector(sel);
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

  const bibleMeta = page.querySelector('meta[name="mo-bible-base"]');
  const BIBLE_BASE = (bibleMeta && bibleMeta.content || "").replace(/\/$/, "");

  // ── State ─────────────────────────────────────────────────────
  let calendar = null;
  let devotionals = null;
  let currentDate = null;
  let translation = DEFAULT_TRANSLATION;

  // ── Helpers ───────────────────────────────────────────────────
  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function addDaysStr(dateStr, n) {
    const d = new Date(dateStr + "T12:00:00");
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function isSunday(dateStr) {
    return new Date(dateStr + "T12:00:00").getDay() === 0;
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

  function showState(state) {
    $body.hidden = state !== "content";
    $loading.hidden = state !== "loading";
    $error.hidden = state !== "error";
    $empty.hidden = state !== "empty";
    $nav.hidden = state === "loading" || state === "error";
    var $bar = $(".dlr-settings-bar");
    if ($bar) $bar.hidden = state !== "content";
  }

  // ── Scripture reference parser ────────────────────────────────
  // Converts "Isaiah 55" → { book: 23, chapter: 55 }
  // Converts "Isaiah 2:1-5" → { book: 23, chapter: 2, vStart: 1, vEnd: 5 }
  // Book numbers use standard Protestant order (Genesis=1 … Revelation=66)
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
  };

  function parseScriptureRef(ref) {
    if (!ref) return null;
    ref = ref.trim();
    var m = ref.match(/^(.+?)\s+(\d+)(?::(\d+)(?:\s*[-–]\s*(\d+))?)?$/);
    if (!m) return null;
    var bookName = m[1].toLowerCase().trim();
    var chapter = parseInt(m[2], 10);
    var vStart = m[3] ? parseInt(m[3], 10) : null;
    var vEnd = m[4] ? parseInt(m[4], 10) : null;
    var bookNum = BOOK_NUMS[bookName];
    if (!bookNum) return null;
    return { book: bookNum, chapter: chapter, vStart: vStart, vEnd: vEnd };
  }

  // ── Scripture fetching ────────────────────────────────────────
  const scriptureCache = {};

  function fetchScripture(ref, translationKey) {
    var bollsCode = TRANSLATION_CODES[translationKey];
    if (!bollsCode) {
      return Promise.resolve({
        html: "<em>" + translationKey + " is not yet available. Showing CSB.</em>",
        fallback: true,
      });
    }

    var parsed = parseScriptureRef(ref);
    if (!parsed) {
      return Promise.resolve({ html: "<em>Could not parse reference: " + escapeHtml(ref) + "</em>" });
    }

    var url = BIBLE_BASE + "/chapter/" + bollsCode + "/" + parsed.book + "/" + parsed.chapter;
    if (parsed.vStart !== null) {
      url += "?v=" + parsed.vStart + (parsed.vEnd && parsed.vEnd !== parsed.vStart ? "-" + parsed.vEnd : "");
    }

    var cacheKey = bollsCode + ":" + parsed.book + ":" + parsed.chapter + ":" + (parsed.vStart || "") + "-" + (parsed.vEnd || "");
    if (scriptureCache[cacheKey]) return Promise.resolve(scriptureCache[cacheKey]);

    if (!BIBLE_BASE) {
      return Promise.resolve({ html: "<em>Bible worker not configured.</em>" });
    }

    return fetch(url, { credentials: "omit" })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status)); })
      .then(function (resp) {
        var content = resp && resp.data && resp.data.content;
        if (!content) return { html: "<em>This passage is unavailable.</em>" };
        var result = { html: content };
        scriptureCache[cacheKey] = result;
        return result;
      })
      .catch(function () {
        return { html: "<em>Could not load this passage. Try reloading.</em>" };
      });
  }

  // ── Render ────────────────────────────────────────────────────
  function renderDevotional(dateStr) {
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
      $errorMsg.textContent = "Devotional content missing for " + entry.key;
      showState("error");
      return;
    }

    currentDate = dateStr;
    const isToday = dateStr === todayStr();

    // Header
    $title.textContent = dev.title;
    $season.textContent = entry.season;

    // Navigation
    const prevDate = findPrevDate(dateStr);
    const nextDate = findNextDate(dateStr);
    $prev.disabled = !prevDate;
    $next.disabled = !nextDate;
    $prev._date = prevDate;
    $next._date = nextDate;
    $today.hidden = isToday;
    $catchup.hidden = isToday;

    // Prayer content
    renderPrayer("[data-dlr-opening-prayer]", dev.openingPrayerText, true);
    renderPrayer("[data-dlr-confession]", dev.confession);
    renderPrayer("[data-dlr-adoration]", dev.adoration);
    renderPrayer("[data-dlr-consecration]", dev.consecration);
    renderPrayer("[data-dlr-benediction]", dev.benediction);

    // Scripture references
    $("[data-dlr-ot-ref]").textContent = dev.otReading + " (" + translation + ")";
    $("[data-dlr-nt-ref]").textContent = dev.ntReading + " (" + translation + ")";
    $("[data-dlr-psalm-ref]").textContent = dev.psalmReading + " (" + translation + ")";

    showState("content");

    // Fetch Scripture texts
    loadScripture(dev.otReading, "[data-dlr-ot-text]");
    loadScripture(dev.ntReading, "[data-dlr-nt-text]");
    loadScripture(dev.psalmReading, "[data-dlr-psalm-text]");

    // Smooth scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderPrayer(selector, text, asLines) {
    const el = $(selector);
    if (!el || !text) return;
    if (asLines) {
      el.innerHTML = text.split("\n")
        .filter((l) => l.trim())
        .map((l) => `<span class="dlr-line">${escapeHtml(l)}</span>`)
        .join("");
    } else {
      el.innerHTML = `<p>${escapeHtml(text)}</p>`;
    }
  }

  function loadScripture(ref, textSelector) {
    const el = $(textSelector);
    if (!el) return;
    el.innerHTML = "Loading&hellip;";

    let activeTranslation = translation;
    fetchScripture(ref, activeTranslation).then((result) => {
      if (result.fallback) {
        return fetchScripture(ref, "CSB").then((csb) => {
          el.innerHTML = result.html + csb.html;
          const refEl = el.parentElement.querySelector(".dlr-scripture-ref");
          if (refEl) refEl.textContent = ref + " (CSB)";
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

  // ── Translation switching ─────────────────────────────────────
  if ($translationSelect) {
    try {
      const saved = localStorage.getItem(LS_TRANSLATION);
      if (saved && TRANSLATION_CODES[saved] !== undefined) translation = saved;
    } catch (e) {}

    $translationSelect.value = translation;
    $translationSelect.addEventListener("change", function () {
      var t = $translationSelect.value;
      if (t === translation) return;
      translation = t;
      try { localStorage.setItem(LS_TRANSLATION, t); } catch (e) {}
      if (currentDate) renderDevotional(currentDate);
    });
  }

  // ── Navigation ────────────────────────────────────────────────
  $prev.addEventListener("click", () => {
    if ($prev._date) renderDevotional($prev._date);
  });
  $next.addEventListener("click", () => {
    if ($next._date) renderDevotional($next._date);
  });
  $today.addEventListener("click", () => {
    const d = findTodayOrLatest();
    if (d) renderDevotional(d);
  });
  if ($retry) {
    $retry.addEventListener("click", () => init());
  }

  // Keyboard nav
  document.addEventListener("keydown", (e) => {
    const t = e.target;
    if (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA") return;
    if (e.key === "ArrowLeft" && !$prev.disabled) { e.preventDefault(); $prev.click(); }
    if (e.key === "ArrowRight" && !$next.disabled) { e.preventDefault(); $next.click(); }
  });

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    showState("loading");
    Promise.all([
      fetch(CALENDAR_URL).then((r) => r.ok ? r.json() : Promise.reject(new Error("Calendar not found"))),
      fetch(DEVOTIONALS_URL).then((r) => r.ok ? r.json() : Promise.reject(new Error("Devotionals not found"))),
    ])
      .then(([cal, devs]) => {
        calendar = cal;
        devotionals = devs;
        const startDate = findTodayOrLatest();
        if (!startDate) {
          if (isSunday(todayStr())) {
            showState("empty");
          } else {
            $errorMsg.textContent = "No devotional available for today. The Daily Liturgy may not have started yet.";
            showState("error");
          }
          return;
        }
        renderDevotional(startDate);
      })
      .catch((err) => {
        console.error("dlr init", err);
        $errorMsg.textContent = "Could not load devotional data.";
        showState("error");
      });
  }

  init();
})();
