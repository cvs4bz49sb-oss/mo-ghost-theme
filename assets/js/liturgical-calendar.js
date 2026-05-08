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
  var PREF_KEY = "mo_liturgical";
  var SEASONS = ["advent", "christmas", "epiphany", "lent", "easter", "pentecost", "ordinary"];

  // ── Easter (Anonymous Gregorian algorithm) ───────────────────
  function easter(year) {
    var a = year % 19;
    var b = Math.floor(year / 100);
    var c = year % 100;
    var d = Math.floor(b / 4);
    var e = b % 4;
    var f = Math.floor((b + 8) / 25);
    var g = Math.floor((b - f + 1) / 3);
    var h = (19 * a + b - d - g + 15) % 30;
    var i = Math.floor(c / 4);
    var k = c % 4;
    var l = (32 + 2 * e + 2 * i - h - k) % 7;
    var m = Math.floor((a + 11 * h + 22 * l) / 451);
    var month = Math.floor((h + l - 7 * m + 114) / 31);
    var day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  function addDays(date, n) {
    var d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  function stripTime(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function adventStart(year) {
    var dec24 = new Date(year, 11, 24);
    var dow = dec24.getDay();
    var advent4 = dow === 0 ? dec24 : new Date(year, 11, 24 - dow);
    return addDays(advent4, -21);
  }

  // ── Season computation ───────────────────────────────────────
  function computeSeason(date) {
    var y = date.getFullYear();
    var m = date.getMonth();
    var d = date.getDate();
    var today = stripTime(date);

    if (m === 0 && d <= 5) return "christmas";

    var e = easter(y);
    var ashWed = addDays(e, -46);
    var holySat = addDays(e, -1);
    var pent = addDays(e, 49);
    var adv = adventStart(y);

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
    SEASONS.forEach(function (s) { document.body.classList.remove("lc-" + s); });
    if (season) document.body.classList.add("lc-" + season);
  }

  function resolvedSeason(pref) {
    if (!pref || pref === "off") return null;
    if (pref === "auto") return computeSeason(new Date());
    return SEASONS.indexOf(pref) >= 0 ? pref : null;
  }

  var SEASON_LABELS = {
    advent: "Advent",
    christmas: "Christmas",
    epiphany: "Epiphany",
    lent: "Lent",
    easter: "Easter",
    pentecost: "Pentecost",
    ordinary: "Ordinary Time",
  };

  // ── Week-level label for the current liturgical date ─────────
  var ORD = ["", "First", "Second", "Third", "Fourth", "Fifth",
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
    var y = date.getFullYear();
    var today = stripTime(date);
    var e = easter(y);
    var ashWed = addDays(e, -46);
    var palmSun = addDays(e, -7);
    var pent = addDays(e, 49);
    var adv = adventStart(y);
    var season = computeSeason(date);

    switch (season) {
      case "advent":
        var w = Math.floor(daysBetween(adv, today) / 7) + 1;
        return (ORD[w] || w + "th") + " Week of Advent";
      case "christmas":
        return "Christmastide";
      case "epiphany":
        var d = daysBetween(new Date(y, 0, 6), today);
        if (d < 7) return "The Epiphany";
        var w = Math.floor(d / 7) + 1;
        return (ORD[w] || w + "th") + " Week after the Epiphany";
      case "lent":
        if (today >= palmSun) return "Holy Week";
        if (today.getTime() === ashWed.getTime()) return "Ash Wednesday";
        var w = Math.floor(daysBetween(ashWed, today) / 7) + 1;
        return (ORD[w] || w + "th") + " Week of Lent";
      case "easter":
        var d = daysBetween(e, today);
        if (d < 7) return "Easter Week";
        var w = Math.floor(d / 7) + 1;
        return (ORD[w] || w + "th") + " Week of Easter";
      case "pentecost":
        return "The Day of Pentecost";
      case "ordinary":
        var w = Math.floor(daysBetween(addDays(pent, 1), today) / 7) + 1;
        return (ORD[w] || w + "th") + " Week of Ordinary Time";
    }
    return "";
  }

  // ── Populate dashboard week indicator ───────────────────────
  var weekEl = document.querySelector("[data-liturgical-week]");
  if (weekEl) {
    weekEl.textContent = computeWeekLabel(new Date());
  }

  // ── Dashboard settings UI ────────────────────────────────────
  var select = document.querySelector("[data-liturgical-select]");
  if (select) {
    var pref;
    try { pref = localStorage.getItem(PREF_KEY) || "off"; } catch (e) { pref = "off"; }
    select.value = pref;

    var previewEl = document.querySelector("[data-liturgical-preview]");
    var swatchEl = document.querySelector("[data-liturgical-swatch]");
    var labelEl = document.querySelector("[data-liturgical-label]");

    function updatePreview(val) {
      var season = resolvedSeason(val);
      if (season && previewEl) {
        swatchEl.className = "liturgical-preview-swatch lc-swatch-" + season;
        labelEl.textContent = (val === "auto" ? "Currently: " : "") + SEASON_LABELS[season];
        previewEl.hidden = false;
      } else if (previewEl) {
        previewEl.hidden = true;
      }
    }

    updatePreview(pref);

    select.addEventListener("change", function () {
      var val = select.value;
      try { localStorage.setItem(PREF_KEY, val); } catch (e) {}
      var season = resolvedSeason(val);
      applySeason(season);
      updatePreview(val);
    });
  }

  // ── Apply on page load (backup for inline boot script) ───────
  var memberEmail = document.body.getAttribute("data-member-email");
  if (memberEmail) {
    var pref;
    try { pref = localStorage.getItem(PREF_KEY) || "off"; } catch (e) { pref = "off"; }
    applySeason(resolvedSeason(pref));
  }
})();
