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

  // API.Bible translation IDs (mapped by abbreviation)
  const BIBLE_IDS = {
    CSB: "a556c5305ee15c3f-01",
    KJV: "de4e12af7f28f599-02",
    ESV: null,
    NIV: null,
    NASB: null,
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
  const $translations = $("[data-dlr-translations]");

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
    if ($translations) $translations.hidden = state !== "content";
  }

  // ── Scripture reference parser ────────────────────────────────
  // Converts "Isaiah 2:1-5" → "ISA.2.1-ISA.2.5" for API.Bible
  const BOOK_ABBREVS = {
    "genesis": "GEN", "exodus": "EXO", "leviticus": "LEV",
    "numbers": "NUM", "deuteronomy": "DEU", "joshua": "JOS",
    "judges": "JDG", "ruth": "RUT", "1 samuel": "1SA",
    "2 samuel": "2SA", "1 kings": "1KI", "2 kings": "2KI",
    "1 chronicles": "1CH", "2 chronicles": "2CH", "ezra": "EZR",
    "nehemiah": "NEH", "esther": "EST", "job": "JOB",
    "psalms": "PSA", "psalm": "PSA", "proverbs": "PRO",
    "ecclesiastes": "ECC", "song of solomon": "SNG",
    "song of songs": "SNG", "isaiah": "ISA", "jeremiah": "JER",
    "lamentations": "LAM", "ezekiel": "EZK", "daniel": "DAN",
    "hosea": "HOS", "joel": "JOL", "amos": "AMO",
    "obadiah": "OBA", "jonah": "JON", "micah": "MIC",
    "nahum": "NAM", "habakkuk": "HAB", "zephaniah": "ZEP",
    "haggai": "HAG", "zechariah": "ZEC", "malachi": "MAL",
    "matthew": "MAT", "mark": "MRK", "luke": "LUK",
    "john": "JHN", "acts": "ACT", "romans": "ROM",
    "1 corinthians": "1CO", "2 corinthians": "2CO",
    "galatians": "GAL", "ephesians": "EPH", "philippians": "PHP",
    "colossians": "COL", "1 thessalonians": "1TH",
    "2 thessalonians": "2TH", "1 timothy": "1TI",
    "2 timothy": "2TI", "titus": "TIT", "philemon": "PHM",
    "hebrews": "HEB", "james": "JAS", "1 peter": "1PE",
    "2 peter": "2PE", "1 john": "1JN", "2 john": "2JN",
    "3 john": "3JN", "jude": "JUD", "revelation": "REV",
  };

  function parseScriptureRef(ref) {
    if (!ref) return null;
    ref = ref.trim();
    // Match: "Book Chapter:VerseStart-VerseEnd" or "Book Chapter"
    // Also handles "Psalm 122" (whole chapter) and "Isaiah 2:1-5"
    const m = ref.match(/^(.+?)\s+(\d+)(?::(\d+)(?:\s*[-–]\s*(\d+))?)?$/);
    if (!m) return null;
    const bookName = m[1].toLowerCase().trim();
    const chapter = m[2];
    const vStart = m[3] || null;
    const vEnd = m[4] || null;
    const bookId = BOOK_ABBREVS[bookName];
    if (!bookId) return null;

    if (vStart && vEnd) {
      return `${bookId}.${chapter}.${vStart}-${bookId}.${chapter}.${vEnd}`;
    }
    if (vStart) {
      return `${bookId}.${chapter}.${vStart}`;
    }
    return `${bookId}.${chapter}`;
  }

  // ── Scripture fetching ────────────────────────────────────────
  const scriptureCache = {};

  function fetchScripture(ref, translationKey) {
    const bibleId = BIBLE_IDS[translationKey];
    if (!bibleId) {
      return Promise.resolve({
        html: `<em>${translationKey} is not yet available. Showing CSB.</em>`,
        fallback: true,
      });
    }

    const passageId = parseScriptureRef(ref);
    if (!passageId) {
      return Promise.resolve({ html: `<em>Could not parse reference: ${escapeHtml(ref)}</em>` });
    }

    const cacheKey = `${bibleId}:${passageId}`;
    if (scriptureCache[cacheKey]) return Promise.resolve(scriptureCache[cacheKey]);

    if (!BIBLE_BASE) {
      return Promise.resolve({ html: `<em>Bible worker not configured.</em>` });
    }

    const isChapter = !passageId.includes(".");
    const endpoint = passageId.split("-").length > 1 || passageId.split(".").length > 2
      ? "passages" : "chapters";

    const q = "?content-type=html&include-notes=false&include-titles=true" +
      "&include-chapter-numbers=false&include-verse-numbers=true&include-verse-spans=false";

    return fetch(`${BIBLE_BASE}/api/bible/v1/bibles/${bibleId}/${endpoint}/${passageId}${q}`, {
      credentials: "omit",
    })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((resp) => {
        const content = resp && resp.data && resp.data.content;
        if (!content) return { html: `<em>This passage is unavailable.</em>` };
        const result = { html: content };
        scriptureCache[cacheKey] = result;
        return result;
      })
      .catch(() => {
        return { html: `<em>Could not load this passage. Try reloading.</em>` };
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
  if ($translations) {
    try {
      const saved = localStorage.getItem(LS_TRANSLATION);
      if (saved && BIBLE_IDS[saved] !== undefined) translation = saved;
    } catch (e) {}

    // Set initial active pill
    const pills = $translations.querySelectorAll("[data-dlr-translation]");
    pills.forEach((pill) => {
      pill.classList.toggle("is-active", pill.dataset.dlrTranslation === translation);
    });

    $translations.addEventListener("click", (e) => {
      const pill = e.target.closest("[data-dlr-translation]");
      if (!pill) return;
      const t = pill.dataset.dlrTranslation;
      if (t === translation) return;
      translation = t;
      try { localStorage.setItem(LS_TRANSLATION, t); } catch (e) {}
      pills.forEach((p) => p.classList.toggle("is-active", p.dataset.dlrTranslation === t));
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
