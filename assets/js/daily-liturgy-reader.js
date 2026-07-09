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

  var CALENDAR_URL = "/assets/data/daily-liturgy/calendar.json";
  var DEVOTIONALS_URL = "/assets/data/daily-liturgy/devotionals.json";
  var BI2Y_URL = "/assets/data/daily-liturgy/bible-in-2-years.json";
  var BI2Y_START = "2026-01-01";
  var BI2Y_TOTAL_DAYS = 736;
  var LS_TRANSLATION = "mo-liturgy-translation";
  var LS_MODE = "mo-liturgy-mode";
  var LS_SCRIPTURE = "mo-liturgy-scripture";
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
  var $loading = $("[data-dlr-loading]");
  var $error = $("[data-dlr-error]");
  var $errorMsg = $("[data-dlr-error-msg]");
  var $retry = $("[data-dlr-retry]");
  var $empty = $("[data-dlr-empty]");
  var $nav = $("[data-dlr-nav]");
  var $translationSelect = $("[data-dlr-translation-select]");
  var $modeToggle = $("[data-dlr-mode-toggle]");

  // Section labels we swap between modes
  var $psalmSection = page.querySelector("[data-dlr-psalm-reading]");
  var $psalmLabel = $psalmSection ? $psalmSection.closest(".dlr-section").querySelector(".dlr-label") : null;
  var $psalmTransition = $psalmSection ? $psalmSection.closest(".dlr-section").querySelector(".dlr-transition") : null;

  var bibleMeta = page.querySelector('meta[name="mo-bible-base"]');
  var BIBLE_BASE = (bibleMeta && bibleMeta.content || "").replace(/\/$/, "");

  // ── State ─────────────────────────────────────────────────────
  var calendar = null;
  var devotionals = null;
  var bi2yPlan = null;
  var currentDate = null;
  var translation = DEFAULT_TRANSLATION;
  var mode = "devotional";
  var scriptureExpanded = true;

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

  function bi2yDayForDate(dateStr) {
    var diff = daysBetween(BI2Y_START, dateStr) + 1;
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
    $body.hidden = !isContent;
    var $bar = $(".dlr-settings-bar");
    if ($bar) $bar.hidden = !isContent;
    var $modeRow = $(".dlr-mode-row");
    if ($modeRow) $modeRow.hidden = !isContent;
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

  // ── Render ────────────────────────────────────────────────────
  function render(dateStr) {
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

    // Prayers always from devotional
    renderPrayer("[data-dlr-opening-prayer]", dev.openingPrayerText, true);
    renderPrayer("[data-dlr-confession]", dev.confession);
    renderPrayer("[data-dlr-adoration]", dev.adoration);
    renderPrayer("[data-dlr-consecration]", dev.consecration);
    renderPrayer("[data-dlr-benediction]", dev.benediction);

    // Scripture: BI2Y overrides if active and data loaded
    var otRef = dev.otReading;
    var ntRef = dev.ntReading;
    var psalmRef = dev.psalmReading;

    if (mode === "bi2y" && bi2yPlan) {
      var dayNum = bi2yDayForDate(dateStr);
      var bi2y = bi2yPlan[String(dayNum)];
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

    $("[data-dlr-ot-ref]").textContent = otRef + " (" + translation + ")";
    $("[data-dlr-nt-ref]").textContent = ntRef + " (" + translation + ")";
    $("[data-dlr-psalm-ref]").textContent = psalmRef + " (" + translation + ")";

    showState("content");

    loadScripture(otRef, "[data-dlr-ot-text]");
    loadScripture(ntRef, "[data-dlr-nt-text]");
    loadScripture(psalmRef, "[data-dlr-psalm-text]");

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

  // ── Mode switching ───────────────────────────────────────────
  function setMode(newMode) {
    mode = newMode;
    try { localStorage.setItem(LS_MODE, mode); } catch (e) {}

    if ($modeToggle) {
      var buttons = $modeToggle.querySelectorAll("[data-dlr-mode]");
      for (var i = 0; i < buttons.length; i++) {
        buttons[i].classList.toggle("is-active", buttons[i].getAttribute("data-dlr-mode") === mode);
      }
    }

    if (mode === "bi2y" && !bi2yPlan) {
      fetch(BI2Y_URL)
        .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("Plan not found")); })
        .then(function (plan) {
          bi2yPlan = plan;
          if (currentDate) render(currentDate);
        })
        .catch(function (err) {
          console.error("bi2y load", err);
        });
    } else if (currentDate) {
      render(currentDate);
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
      if (currentDate) render(currentDate);
    });
  }

  // ── Scripture expand/collapse ──────────────────────────────────
  var $scriptureToggle = $("[data-dlr-scripture-toggle]");
  var allScriptures = page.querySelectorAll(".dlr-scripture");

  function setScriptureExpanded(expanded) {
    scriptureExpanded = expanded;
    try { localStorage.setItem(LS_SCRIPTURE, expanded ? "expand" : "collapse"); } catch (e) {}

    for (var i = 0; i < allScriptures.length; i++) {
      allScriptures[i].classList.toggle("is-collapsed", !expanded);
      var ref = allScriptures[i].querySelector(".dlr-scripture-ref");
      if (ref) ref.setAttribute("aria-expanded", String(expanded));
    }

    if ($scriptureToggle) {
      var btns = $scriptureToggle.querySelectorAll("[data-dlr-expand]");
      for (var j = 0; j < btns.length; j++) {
        var isExpand = btns[j].getAttribute("data-dlr-expand") === "expand";
        btns[j].classList.toggle("is-active", isExpand === expanded);
      }
    }
  }

  if ($scriptureToggle) {
    var sBtns = $scriptureToggle.querySelectorAll("[data-dlr-expand]");
    for (var si = 0; si < sBtns.length; si++) {
      sBtns[si].addEventListener("click", function () {
        setScriptureExpanded(this.getAttribute("data-dlr-expand") === "expand");
      });
    }
  }

  // Individual scripture ref click toggles that one block
  for (var ri = 0; ri < allScriptures.length; ri++) {
    (function (scripture) {
      var ref = scripture.querySelector(".dlr-scripture-ref");
      if (ref) {
        ref.addEventListener("click", function () {
          var collapsed = scripture.classList.toggle("is-collapsed");
          ref.setAttribute("aria-expanded", String(!collapsed));
        });
      }
    })(allScriptures[ri]);
  }

  // ── Navigation ────────────────────────────────────────────────
  $prev.addEventListener("click", function () {
    if ($prev._date) render($prev._date);
  });
  $next.addEventListener("click", function () {
    if ($next._date) render($next._date);
  });
  $today.addEventListener("click", function () {
    var d = findTodayOrLatest();
    if (d) render(d);
  });
  if ($retry) {
    $retry.addEventListener("click", function () { init(); });
  }

  document.addEventListener("keydown", function (e) {
    var t = e.target;
    if (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA") return;
    if (e.key === "ArrowLeft" && !$prev.disabled) { e.preventDefault(); $prev.click(); }
    if (e.key === "ArrowRight" && !$next.disabled) { e.preventDefault(); $next.click(); }
  });

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    showState("loading");

    var fetches = [
      fetch(CALENDAR_URL).then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("Calendar not found")); }),
      fetch(DEVOTIONALS_URL).then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("Devotionals not found")); }),
    ];

    if (mode === "bi2y") {
      fetches.push(
        fetch(BI2Y_URL).then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("Plan not found")); })
      );
    }

    Promise.all(fetches)
      .then(function (results) {
        calendar = results[0];
        devotionals = results[1];
        if (results[2]) bi2yPlan = results[2];

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
        render(startDate);
      })
      .catch(function (err) {
        console.error("dlr init", err);
        $errorMsg.textContent = "Could not load devotional data.";
        showState("error");
      });
  }

  // Restore saved preferences
  try {
    var savedMode = localStorage.getItem(LS_MODE);
    if (savedMode === "bi2y") mode = "bi2y";
    var savedScripture = localStorage.getItem(LS_SCRIPTURE);
    if (savedScripture === "collapse") {
      scriptureExpanded = false;
      setScriptureExpanded(false);
    }
  } catch (e) {}

  if ($modeToggle) {
    var allBtns = $modeToggle.querySelectorAll("[data-dlr-mode]");
    for (var j = 0; j < allBtns.length; j++) {
      allBtns[j].classList.toggle("is-active", allBtns[j].getAttribute("data-dlr-mode") === mode);
    }
  }

  init();
})();
