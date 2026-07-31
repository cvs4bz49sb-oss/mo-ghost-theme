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
  const PODCAST_FEED_URL = "https://mo-podcast-feed.mo-podcast-feed.workers.dev";
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
  };

  function parseScriptureRef(ref) {
    if (!ref) return null;
    ref = ref.trim();
    const m = ref.match(/^(.+?)\s+(\d+)(?::(\d+)(?:\s*[-–]\s*(\d+))?)?$/);
    if (!m) return null;
    const bookName = m[1].toLowerCase().trim();
    const chapter = parseInt(m[2], 10);
    const vStart = m[3] ? parseInt(m[3], 10) : null;
    const vEnd = m[4] ? parseInt(m[4], 10) : null;
    const bookNum = BOOK_NUMS[bookName];
    if (!bookNum) return null;
    return { book: bookNum, chapter, vStart, vEnd };
  }

  // ── Scripture fetching ────────────────────────────────────────
  const scriptureCache = {};

  function fetchScripture(ref, translationKey) {
    const bollsCode = TRANSLATION_CODES[translationKey];
    if (!bollsCode) {
      return Promise.resolve({
        html: `<em>${translationKey} is not yet available. Showing ESV.</em>`,
        fallback: true,
      });
    }

    const parsed = parseScriptureRef(ref);
    if (!parsed) {
      return Promise.resolve({ html: `<em>Could not parse reference: ${escapeHtml(ref)}</em>` });
    }

    let url = `${BIBLE_BASE}/chapter/${bollsCode}/${parsed.book}/${parsed.chapter}`;
    if (parsed.vStart !== null) {
      url += `?v=${parsed.vStart}${parsed.vEnd && parsed.vEnd !== parsed.vStart ? `-${parsed.vEnd}` : ""}`;
    }

    const cacheKey = `${bollsCode}:${parsed.book}:${parsed.chapter}:${parsed.vStart || ""}-${parsed.vEnd || ""}`;
    if (scriptureCache[cacheKey]) return Promise.resolve(scriptureCache[cacheKey]);

    if (!BIBLE_BASE) {
      return Promise.resolve({ html: "<em>Bible worker not configured.</em>" });
    }

    return fetch(url, { credentials: "omit" })
      .then((r) => { return r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)); })
      .then((resp) => {
        const content = resp && resp.data && resp.data.content;
        if (!content) return { html: "<em>This passage is unavailable.</em>" };
        const result = { html: content };
        scriptureCache[cacheKey] = result;
        return result;
      })
      .catch(() => {
        return { html: "<em>Could not load this passage. Try reloading.</em>" };
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

    const MONTH_MAP = {
      january: "01", february: "02", march: "03", april: "04",
      may: "05", june: "06", july: "07", august: "08",
      september: "09", october: "10", november: "11", december: "12"
    };

    const episodesByDate = {};
    let pendingDate = null;
    let loadedEpisode = null; // whose audioUrl is in the <audio>
    let viewEpisode = null; // episode for the day on screen
    let scrubbing = false;

    function parseEpisodeDate(title) {
      const m = (title || "").match(/^(?:\w+),\s+(\w+)\s+(\d+),\s+(\d{4})/);
      if (!m) return null;
      const mon = MONTH_MAP[m[1].toLowerCase()];
      if (!mon) return null;
      return `${m[3]}-${mon}-${String(parseInt(m[2], 10)).padStart(2, "0")}`;
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
    function load(ep) {
      loadedEpisode = ep;
      $audio.pause();
      $audio.src = ep.audioUrl;
      $audio.currentTime = 0;
      $bar.style.width = "0%";
      $elapsed.textContent = "0:00";
      $time.textContent = ep.duration ? fmt(ep.duration) : "";
      $ptitle.textContent = ep.title || "Today's episode";
      $note.textContent = DEFAULT_NOTE;
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
      else $note.textContent = DEFAULT_NOTE;
    }

    function showEpisode(dateStr) {
      viewEpisode = episodesByDate[dateStr] || null;
      const busy = !$audio.paused && loadedEpisode;
      if (busy) {
        const sameEp = viewEpisode && viewEpisode.audioUrl === loadedEpisode.audioUrl;
        $note.textContent = sameEp
          ? DEFAULT_NOTE
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

    updatePodcastForDate = function (dateStr) {
      if (!Object.keys(episodesByDate).length) {
        pendingDate = dateStr;
        return;
      }
      showEpisode(dateStr);
    };

    fetch(`${PODCAST_FEED_URL}?show=daily-liturgy&limit=30`, { credentials: "omit" })
      .then((r) => { return r.json(); })
      .then((data) => {
        const show_ = data["daily-liturgy"];
        if (!show_ || !show_.episodes || !show_.episodes.length) return;
        show_.episodes.forEach((ep) => {
          const d = parseEpisodeDate(ep.title);
          if (d) episodesByDate[d] = ep;
        });
        if (pendingDate) showEpisode(pendingDate);
        else if (currentDate) showEpisode(currentDate);
      })
      .catch(() => {});

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
