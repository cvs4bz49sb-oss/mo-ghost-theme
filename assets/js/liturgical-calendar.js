/*
 * Liturgical Calendar Theme — members-only church-year color system.
 *
 * Applies a CSS class (lc-advent, lc-christmas, etc.) to <body> based
 * on the member's preference in localStorage. "auto" follows the
 * Western liturgical calendar; a specific season can be pinned.
 *
 * A tiny inline script in default.hbs applies the class before first
 * paint to prevent FOUC. This file handles the dashboard settings UI
 * and any runtime updates.
 */
(function () {
  const PREF_KEY = "mo_liturgical";
  const SEASONS = ["advent", "christmas", "epiphany", "lent", "easter", "pentecost", "ordinary"];

  // ── Easter (Anonymous Gregorian algorithm) ───────────────────
  function easter(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  function stripTime(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function adventStart(year) {
    const dec24 = new Date(year, 11, 24);
    const dow = dec24.getDay();
    const advent4 = dow === 0 ? dec24 : new Date(year, 11, 24 - dow);
    return addDays(advent4, -21);
  }

  // ── Season computation ───────────────────────────────────────
  function computeSeason(date) {
    const y = date.getFullYear();
    const m = date.getMonth();
    const d = date.getDate();
    const today = stripTime(date);

    if (m === 0 && d <= 5) return "christmas";

    const e = easter(y);
    const ashWed = addDays(e, -46);
    const holySat = addDays(e, -1);
    const pent = addDays(e, 49);
    const adv = adventStart(y);

    if (today >= new Date(y, 0, 6) && today < ashWed) return "epiphany";
    if (today >= ashWed && today <= holySat) return "lent";
    if (today >= e && today < pent) return "easter";
    if (today.getTime() === stripTime(pent).getTime()) return "pentecost";
    if (today > pent && today < adv) return "ordinary";
    if (today >= adv && m === 11 && d <= 24) return "advent";
    if (m === 11 && d >= 25) return "christmas";
    return "ordinary";
  }

  // ── Apply / remove class ─────────────────────────────────────
  function applySeason(season) {
    SEASONS.forEach((s) => { document.body.classList.remove(`lc-${s}`); });
    if (season) document.body.classList.add(`lc-${season}`);
  }

  function resolvedSeason(pref) {
    if (!pref || pref === "off") return null;
    if (pref === "auto") return computeSeason(new Date());
    return SEASONS.indexOf(pref) >= 0 ? pref : null;
  }

  const SEASON_LABELS = {
    advent: "Advent",
    christmas: "Christmas",
    epiphany: "Epiphany",
    lent: "Lent",
    easter: "Easter",
    pentecost: "Pentecost",
    ordinary: "Ordinary Time",
  };

  // ── Week-level label for the current liturgical date ─────────
  const ORD = ["", "First", "Second", "Third", "Fourth", "Fifth",
    "Sixth", "Seventh", "Eighth", "Ninth", "Tenth", "Eleventh",
    "Twelfth", "Thirteenth", "Fourteenth", "Fifteenth", "Sixteenth",
    "Seventeenth", "Eighteenth", "Nineteenth", "Twentieth",
    "Twenty-First", "Twenty-Second", "Twenty-Third", "Twenty-Fourth",
    "Twenty-Fifth", "Twenty-Sixth", "Twenty-Seventh", "Twenty-Eighth",
    "Twenty-Ninth", "Thirtieth"];

  function daysBetween(a, b) {
    return Math.floor((stripTime(b) - stripTime(a)) / 86400000);
  }

  function computeWeekLabel(date) {
    const y = date.getFullYear();
    const today = stripTime(date);
    const e = easter(y);
    const ashWed = addDays(e, -46);
    const palmSun = addDays(e, -7);
    const pent = addDays(e, 49);
    const adv = adventStart(y);
    const season = computeSeason(date);

    switch (season) {
      case "advent": {
        const w = Math.floor(daysBetween(adv, today) / 7) + 1;
        return `${ORD[w] || `${w}th`} Week of Advent`;
      }
      case "christmas":
        return "Christmastide";
      case "epiphany": {
        const d = daysBetween(new Date(y, 0, 6), today);
        if (d < 7) return "The Epiphany";
        const w = Math.floor(d / 7) + 1;
        return `${ORD[w] || `${w}th`} Week after the Epiphany`;
      }
      case "lent": {
        if (today >= palmSun) return "Holy Week";
        if (today.getTime() === ashWed.getTime()) return "Ash Wednesday";
        const w = Math.floor(daysBetween(ashWed, today) / 7) + 1;
        return `${ORD[w] || `${w}th`} Week of Lent`;
      }
      case "easter": {
        const d = daysBetween(e, today);
        if (d < 7) return "Easter Week";
        const w = Math.floor(d / 7) + 1;
        return `${ORD[w] || `${w}th`} Week of Easter`;
      }
      case "pentecost":
        return "The Day of Pentecost";
      case "ordinary": {
        const w = Math.floor(daysBetween(addDays(pent, 1), today) / 7) + 1;
        return `${ORD[w] || `${w}th`} Week of Ordinary Time`;
      }
      default:
        return "";
    }
  }

  // ── Populate dashboard week indicator + Collect dropdown ────
  // The week chip is a <details> element. Summary text is the week
  // label (e.g. "First Week of Advent"); body is the BCP 1979 Collect
  // for that week, lazy-loaded from assets/data/collects.json the
  // first time the user opens the dropdown.
  const weekEl = document.querySelector("[data-liturgical-week]");
  const weekLabelEl = document.querySelector("[data-liturgical-week-label]");
  const collectBodyEl = document.querySelector("[data-liturgical-collect-body]");
  if (weekEl && weekLabelEl) {
    const label = computeWeekLabel(new Date());
    if (label) {
      weekLabelEl.textContent = label;
      weekEl.hidden = false;

      let collectsCache = null;
      let loadStarted = false;
      const renderPlaceholder = (msg) => {
        if (collectBodyEl) collectBodyEl.textContent = msg;
      };
      const renderCollect = (label) => {
        if (!collectBodyEl) return;
        const text = collectsCache && collectsCache[label];
        if (text) {
          collectBodyEl.textContent = text;
        } else {
          renderPlaceholder(
            `The Collect for this week isn't in our local set yet. ` +
              `(Looking for: ${label})`
          );
        }
      };
      const ensureLoaded = async () => {
        if (collectsCache || loadStarted) return;
        loadStarted = true;
        renderPlaceholder("Loading…");
        try {
          // Static asset; Cloudflare/Ghost CDN caches it. ~25 KB.
          const res = await fetch("/assets/data/collects.json");
          if (!res.ok) throw new Error(`fetch ${res.status}`);
          collectsCache = await res.json();
        } catch (err) {
          console.error("collect fetch failed", err && err.message);
          renderPlaceholder(
            "Could not load the Collect. Try reloading the page."
          );
          loadStarted = false; // allow retry on next open
          return;
        }
        renderCollect(label);
      };
      // Lazy-load on first open. The <details> "toggle" event fires
      // whenever the open state changes; we fetch only if it just
      // opened and haven't fetched yet.
      weekEl.addEventListener("toggle", () => {
        if (weekEl.open) ensureLoaded();
      });
    }
  }

  // ── Dashboard settings UI ────────────────────────────────────
  const select = document.querySelector("[data-liturgical-select]");
  if (select) {
    let pref;
    try { pref = localStorage.getItem(PREF_KEY) || "off"; } catch (e) { pref = "off"; }
    select.value = pref;

    const previewEl = document.querySelector("[data-liturgical-preview]");
    const swatchEl = document.querySelector("[data-liturgical-swatch]");
    const labelEl = document.querySelector("[data-liturgical-label]");

    function updatePreview(val) {
      const season = resolvedSeason(val);
      if (season && previewEl) {
        swatchEl.className = `liturgical-preview-swatch lc-swatch-${season}`;
        labelEl.textContent = (val === "auto" ? "Currently: " : "") + SEASON_LABELS[season];
        previewEl.hidden = false;
      } else if (previewEl) {
        previewEl.hidden = true;
      }
    }

    updatePreview(pref);

    select.addEventListener("change", () => {
      const val = select.value;
      try { localStorage.setItem(PREF_KEY, val); } catch (e) {}
      const season = resolvedSeason(val);
      applySeason(season);
      updatePreview(val);
    });
  }

  // ── Apply on page load (backup for inline boot script) ───────
  const memberEmail = document.body.getAttribute("data-member-email");
  if (memberEmail) {
    let pref;
    try { pref = localStorage.getItem(PREF_KEY) || "off"; } catch (e) { pref = "off"; }
    applySeason(resolvedSeason(pref));
  }
})();
