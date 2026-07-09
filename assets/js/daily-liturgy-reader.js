/*
 * Daily Liturgy Reader — two modes:
 *   1. Devotional: liturgical devotional from calendar.json + devotionals.json
 *   2. Bible in 2 Years: sequential OT/NT/Wisdom reading plan from bible-in-2-years.json
 *
 * Mode preference + translation saved to localStorage.
 */
(function () {
  "use strict";

  var CALENDAR_URL = "/assets/data/daily-liturgy/calendar.json";
  var DEVOTIONALS_URL = "/assets/data/daily-liturgy/devotionals.json";
  var BI2Y_URL = "/assets/data/daily-liturgy/bible-in-2-years.json";
  var BI2Y_START = "2026-01-01";
  var BI2Y_TOTAL_DAYS = 736;
  var LS_TRANSLATION = "mo-liturgy-translation";
  var LS_MODE = "mo-liturgy-mode";
  var DEFAULT_TRANSLATION = "CSB";

  var TRANSLATION_CODES = {
    CSB: "CSB17",
    KJV: "KJV",
    ESV: "ESV",
    NIV: "NIV",
    NASB: "NASB",
  };

  // ── DOM refs ──────────────────────────────────────────────────
  var page = document.querySelector("[data-dlr-page]");
  if (!page) return;

  var $ = function (sel) { return page.querySelector(sel); };
  var $title = $("[data-dlr-title]");
  var $season = $("[data-dlr-season]");
  var $prev = $("[data-dlr-prev]");
  var $next = $("[data-dlr-next]");
  var $today = $("[data-dlr-today]");
  var $catchup = $("[data-dlr-catchup]");
  var $body = $("[data-dlr-body]");
  var $bi2yBody = $("[data-dlr-bi2y-body]");
  var $loading = $("[data-dlr-loading]");
  var $error = $("[data-dlr-error]");
  var $errorMsg = $("[data-dlr-error-msg]");
  var $retry = $("[data-dlr-retry]");
  var $empty = $("[data-dlr-empty]");
  var $nav = $("[data-dlr-nav]");
  var $translationSelect = $("[data-dlr-translation-select]");
  var $modeToggle = $("[data-dlr-mode-toggle]");

  var bibleMeta = page.querySelector('meta[name="mo-bible-base"]');
  var BIBLE_BASE = (bibleMeta && bibleMeta.content || "").replace(/\/$/, "");

  // ── State ─────────────────────────────────────────────────────
  var calendar = null;
  var devotionals = null;
  var bi2yPlan = null;
  var currentDate = null;
  var currentBi2yDay = null;
  var translation = DEFAULT_TRANSLATION;
  var mode = "devotional";

  // ── Helpers ───────────────────────────────────────────────────
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function addDaysStr(dateStr, n) {
    var d = new Date(dateStr + "T12:00:00");
    d.setDate(d.getDate() + n);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function daysBetween(a, b) {
    var da = new Date(a + "T12:00:00");
    var db = new Date(b + "T12:00:00");
    return Math.round((db - da) / 86400000);
  }

  function isSunday(dateStr) {
    return new Date(dateStr + "T12:00:00").getDay() === 0;
  }

  function findPrevDate(dateStr) {
    var d = addDaysStr(dateStr, -1);
    for (var i = 0; i < 7; i++) {
      if (calendar[d]) return d;
      d = addDaysStr(d, -1);
    }
    return null;
  }

  function findNextDate(dateStr) {
    var today = todayStr();
    var d = addDaysStr(dateStr, 1);
    for (var i = 0; i < 7; i++) {
      if (d > today) return null;
      if (calendar[d]) return d;
      d = addDaysStr(d, 1);
    }
    return null;
  }

  function findTodayOrLatest() {
    var today = todayStr();
    if (calendar[today]) return today;
    return findPrevDate(today);
  }

  function bi2yDayForToday() {
    var diff = daysBetween(BI2Y_START, todayStr()) + 1;
    if (diff < 1) return 1;
    if (diff > BI2Y_TOTAL_DAYS) return BI2Y_TOTAL_DAYS;
    return diff;
  }

  function showState(state) {
    var isContent = state === "content";
    $loading.hidden = state !== "loading";
    $error.hidden = state !== "error";
    $empty.hidden = state !== "empty";
    $nav.hidden = state === "loading" || state === "error";
    var $bar = $(".dlr-settings-bar");
    if ($bar) $bar.hidden = !isContent;

    if (mode === "devotional") {
      $body.hidden = !isContent;
      if ($bi2yBody) $bi2yBody.hidden = true;
    } else {
      $body.hidden = true;
      if ($bi2yBody) $bi2yBody.hidden = !isContent;
    }
  }

  // ── Scripture reference parser ────────────────────────────────
  var BOOK_NUMS = {
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
  var scriptureCache = {};

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

  // ── Render: Devotional ───────────────────────────────────────
  function renderDevotional(dateStr) {
    var entry = calendar[dateStr];
    if (!entry) {
      if (isSunday(dateStr)) {
        showState("empty");
      } else {
        $errorMsg.textContent = "No devotional found for this date.";
        showState("error");
      }
      return;
    }

    var dev = devotionals[entry.key];
    if (!dev) {
      $errorMsg.textContent = "Devotional content missing for " + entry.key;
      showState("error");
      return;
    }

    currentDate = dateStr;
    var isToday = dateStr === todayStr();

    $title.textContent = dev.title;
    $season.textContent = entry.season;

    var prevDate = findPrevDate(dateStr);
    var nextDate = findNextDate(dateStr);
    $prev.disabled = !prevDate;
    $next.disabled = !nextDate;
    $prev._date = prevDate;
    $next._date = nextDate;
    $today.hidden = isToday;
    $catchup.hidden = isToday;

    renderPrayer("[data-dlr-opening-prayer]", dev.openingPrayerText, true);
    renderPrayer("[data-dlr-confession]", dev.confession);
    renderPrayer("[data-dlr-adoration]", dev.adoration);
    renderPrayer("[data-dlr-consecration]", dev.consecration);
    renderPrayer("[data-dlr-benediction]", dev.benediction);

    $("[data-dlr-ot-ref]").textContent = dev.otReading + " (" + translation + ")";
    $("[data-dlr-nt-ref]").textContent = dev.ntReading + " (" + translation + ")";
    $("[data-dlr-psalm-ref]").textContent = dev.psalmReading + " (" + translation + ")";

    showState("content");

    loadScripture(dev.otReading, "[data-dlr-ot-text]");
    loadScripture(dev.ntReading, "[data-dlr-nt-text]");
    loadScripture(dev.psalmReading, "[data-dlr-psalm-text]");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderPrayer(selector, text, asLines) {
    var el = $(selector);
    if (!el || !text) return;
    if (asLines) {
      el.innerHTML = text.split("\n")
        .filter(function (l) { return l.trim(); })
        .map(function (l) { return '<span class="dlr-line">' + escapeHtml(l) + "</span>"; })
        .join("");
    } else {
      el.innerHTML = "<p>" + escapeHtml(text) + "</p>";
    }
  }

  function loadScripture(ref, textSelector) {
    var el = $(textSelector);
    if (!el) return;
    el.innerHTML = "Loading&hellip;";

    fetchScripture(ref, translation).then(function (result) {
      if (result.fallback) {
        return fetchScripture(ref, "CSB").then(function (csb) {
          el.innerHTML = result.html + csb.html;
          var refEl = el.parentElement.querySelector(".dlr-scripture-ref");
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

  // ── Render: Bible in 2 Years ─────────────────────────────────
  function renderBi2y(dayNum) {
    var entry = bi2yPlan[String(dayNum)];
    if (!entry) {
      $errorMsg.textContent = "No reading found for day " + dayNum + ".";
      showState("error");
      return;
    }

    currentBi2yDay = dayNum;
    var todayDay = bi2yDayForToday();
    var isToday = dayNum === todayDay;

    $title.textContent = "Day " + dayNum + " of " + BI2Y_TOTAL_DAYS;
    $season.textContent = "Bible in Two Years";

    $prev.disabled = dayNum <= 1;
    $next.disabled = dayNum >= todayDay;
    $prev._bi2yDay = dayNum - 1;
    $next._bi2yDay = dayNum + 1;
    $today.hidden = isToday;
    $catchup.hidden = isToday;

    $("[data-dlr-bi2y-ot-ref]").textContent = entry.ot + " (" + translation + ")";
    $("[data-dlr-bi2y-nt-ref]").textContent = entry.nt + " (" + translation + ")";
    $("[data-dlr-bi2y-wisdom-ref]").textContent = entry.wisdom + " (" + translation + ")";

    showState("content");

    loadScripture(entry.ot, "[data-dlr-bi2y-ot-text]");
    loadScripture(entry.nt, "[data-dlr-bi2y-nt-text]");
    loadScripture(entry.wisdom, "[data-dlr-bi2y-wisdom-text]");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ── Mode switching ───────────────────────────────────────────
  function setMode(newMode) {
    mode = newMode;
    try { localStorage.setItem(LS_MODE, mode); } catch (e) {}

    var buttons = $modeToggle.querySelectorAll("[data-dlr-mode]");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle("is-active", buttons[i].getAttribute("data-dlr-mode") === mode);
    }

    if (mode === "devotional") {
      if (calendar && devotionals) {
        var d = currentDate || findTodayOrLatest();
        if (d) renderDevotional(d);
      } else {
        initDevotional();
      }
    } else {
      if (bi2yPlan) {
        renderBi2y(currentBi2yDay || bi2yDayForToday());
      } else {
        initBi2y();
      }
    }
  }

  if ($modeToggle) {
    var buttons = $modeToggle.querySelectorAll("[data-dlr-mode]");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener("click", function () {
        var m = this.getAttribute("data-dlr-mode");
        if (m !== mode) setMode(m);
      });
    }
  }

  // ── Translation switching ─────────────────────────────────────
  if ($translationSelect) {
    try {
      var saved = localStorage.getItem(LS_TRANSLATION);
      if (saved && TRANSLATION_CODES[saved] !== undefined) translation = saved;
    } catch (e) {}

    $translationSelect.value = translation;
    $translationSelect.addEventListener("change", function () {
      var t = $translationSelect.value;
      if (t === translation) return;
      translation = t;
      try { localStorage.setItem(LS_TRANSLATION, t); } catch (e) {}
      if (mode === "devotional" && currentDate) {
        renderDevotional(currentDate);
      } else if (mode === "bi2y" && currentBi2yDay) {
        renderBi2y(currentBi2yDay);
      }
    });
  }

  // ── Navigation ────────────────────────────────────────────────
  $prev.addEventListener("click", function () {
    if (mode === "devotional") {
      if ($prev._date) renderDevotional($prev._date);
    } else {
      if ($prev._bi2yDay >= 1) renderBi2y($prev._bi2yDay);
    }
  });
  $next.addEventListener("click", function () {
    if (mode === "devotional") {
      if ($next._date) renderDevotional($next._date);
    } else {
      if ($next._bi2yDay <= bi2yDayForToday()) renderBi2y($next._bi2yDay);
    }
  });
  $today.addEventListener("click", function () {
    if (mode === "devotional") {
      var d = findTodayOrLatest();
      if (d) renderDevotional(d);
    } else {
      renderBi2y(bi2yDayForToday());
    }
  });
  if ($retry) {
    $retry.addEventListener("click", function () {
      if (mode === "devotional") initDevotional();
      else initBi2y();
    });
  }

  document.addEventListener("keydown", function (e) {
    var t = e.target;
    if (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA") return;
    if (e.key === "ArrowLeft" && !$prev.disabled) { e.preventDefault(); $prev.click(); }
    if (e.key === "ArrowRight" && !$next.disabled) { e.preventDefault(); $next.click(); }
  });

  // ── Init ──────────────────────────────────────────────────────
  function initDevotional() {
    showState("loading");
    Promise.all([
      fetch(CALENDAR_URL).then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("Calendar not found")); }),
      fetch(DEVOTIONALS_URL).then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("Devotionals not found")); }),
    ])
      .then(function (results) {
        calendar = results[0];
        devotionals = results[1];
        var startDate = findTodayOrLatest();
        if (!startDate) {
          if (isSunday(todayStr())) {
            showState("empty");
          } else {
            $errorMsg.textContent = "No devotional available for today.";
            showState("error");
          }
          return;
        }
        renderDevotional(startDate);
      })
      .catch(function (err) {
        console.error("dlr init", err);
        $errorMsg.textContent = "Could not load devotional data.";
        showState("error");
      });
  }

  function initBi2y() {
    showState("loading");
    fetch(BI2Y_URL)
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("Plan not found")); })
      .then(function (plan) {
        bi2yPlan = plan;
        renderBi2y(bi2yDayForToday());
      })
      .catch(function (err) {
        console.error("bi2y init", err);
        $errorMsg.textContent = "Could not load reading plan data.";
        showState("error");
      });
  }

  // Restore saved mode
  try {
    var savedMode = localStorage.getItem(LS_MODE);
    if (savedMode === "bi2y") mode = "bi2y";
  } catch (e) {}

  if ($modeToggle) {
    var allBtns = $modeToggle.querySelectorAll("[data-dlr-mode]");
    for (var j = 0; j < allBtns.length; j++) {
      allBtns[j].classList.toggle("is-active", allBtns[j].getAttribute("data-dlr-mode") === mode);
    }
  }

  if (mode === "bi2y") {
    initBi2y();
  } else {
    initDevotional();
  }
})();
