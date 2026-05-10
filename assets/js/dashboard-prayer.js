/**
 * Dashboard Daily Office — /dashboard/prayer/
 *
 * Loads the 1928 BCP Morning/Evening Prayer data from a static JSON
 * asset, renders the appropriate office based on time of day, and
 * provides a language toggle (modern ↔ original).
 *
 * Design: simple, elegant, out of the way. Each section of the
 * office renders as a collapsible <details> element. The core
 * sections (Confession through Creed) start open; supplementary
 * prayers start closed.
 */
(function () {
  "use strict";

  var DATA_URL = "/assets/data/faith-received/prayer.json";

  // ── Sections that start open by default ──────────────────────
  // These are the core Daily Office sections. Others collapse.
  var CORE_SECTIONS = new Set([
    "Opening Sentences of Scripture",
    "A General Confession",
    "The Declaration of Absolution",
    "The Lord's Prayer",
    "Versicles and Responses",
    "Venite, Exultemus Domino",
    "Te Deum Laudamus",
    "Magnificat",
    "Benedictus",
    "Nunc Dimittis",
    "The Apostles' Creed",
    "Suffrages",
    "Collect for the Day",
    "A Collect for Peace",
    "A Collect for Grace",
    "A Collect for Aid Against Perils",
    "The Grace",
  ]);

  // ── Sections to skip (rubrical notes, not prayers) ───────────
  var SKIP_SECTIONS = new Set([
    "The Psalter and First Lesson",
    "The Second Lesson",
    "Rubric on the Litany",
    "Rubric on Closing",
  ]);

  // ── State ─────────────────────────────────────────────────────
  var data = null;
  var currentOffice = "morning";
  var useModern = true;

  // ── DOM refs ──────────────────────────────────────────────────
  var sectionsEl = document.querySelector("[data-prayer-sections]");
  var greetingEl = document.querySelector("[data-prayer-greeting]");
  var subEl = document.querySelector("[data-prayer-sub]");
  var langToggle = document.querySelector("[data-prayer-lang-toggle]");
  var langLabel = document.querySelector("[data-prayer-lang-label]");
  var officeBtns = document.querySelectorAll("[data-prayer-office]");

  if (!sectionsEl) return;

  // ── Determine office from time of day ─────────────────────────
  var hour = new Date().getHours();
  currentOffice = hour >= 16 ? "evening" : "morning";

  // ── Load data ─────────────────────────────────────────────────
  fetch(DATA_URL)
    .then(function (r) { return r.json(); })
    .then(function (d) {
      data = d;
      render();
      initControls();
    })
    .catch(function () {
      sectionsEl.innerHTML =
        '<p class="prayer-error">Could not load the Daily Office. <a href="/the-faith-received/1928-bcp/">Read the full text instead &rarr;</a></p>';
    });

  function render() {
    if (!data) return;

    var book = currentOffice === "morning" ? data.books[0] : data.books[1];
    var chapters = book.chapters || [];

    // Update hero
    if (greetingEl) greetingEl.textContent = currentOffice === "morning" ? "Morning" : "Evening";
    if (subEl) subEl.textContent = "From the 1928 Book of Common Prayer.";

    // Update office toggle
    for (var i = 0; i < officeBtns.length; i++) {
      var btn = officeBtns[i];
      var isActive = btn.getAttribute("data-prayer-office") === currentOffice;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", String(isActive));
    }

    // Render sections
    var html = "";
    for (var c = 0; c < chapters.length; c++) {
      var ch = chapters[c];
      if (SKIP_SECTIONS.has(ch.title)) continue;

      var isCore = CORE_SECTIONS.has(ch.title);
      var paras = useModern ? (ch.modernized || ch.paragraphs) : ch.paragraphs;

      var subtitle = ch.subtitle
        ? '<span class="prayer-section-subtitle">' + escHtml(ch.subtitle) + "</span>"
        : "";

      var bodyHtml = "";
      for (var p = 0; p < paras.length; p++) {
        var text = paras[p];
        // Detect versicle/response patterns (V. / R.)
        if (/^V\.\s/.test(text)) {
          bodyHtml += '<p class="prayer-versicle">' + escHtml(text) + "</p>\n";
        } else if (/^R\.\s/.test(text)) {
          bodyHtml += '<p class="prayer-response"><strong>' + escHtml(text) + "</strong></p>\n";
        } else if (text.indexOf("*") > -1) {
          // Canticle verse with * half-verse mark
          bodyHtml += '<p class="prayer-verse">' + escHtml(text) + "</p>\n";
        } else {
          bodyHtml += "<p>" + escHtml(text) + "</p>\n";
        }
      }

      html +=
        '<details class="prayer-section"' + (isCore ? " open" : "") +
        ' id="prayer-' + c + '">' +
        '<summary class="prayer-section-summary">' +
        '<h2 class="prayer-section-title"><em>' + escHtml(ch.title) + "</em></h2>" +
        subtitle +
        '<span class="prayer-section-chev" aria-hidden="true"></span>' +
        "</summary>" +
        '<div class="prayer-section-body article-content">' +
        bodyHtml +
        "</div>" +
        "</details>\n";
    }

    sectionsEl.innerHTML = html;
  }

  function initControls() {
    // Office toggle
    for (var i = 0; i < officeBtns.length; i++) {
      officeBtns[i].addEventListener("click", function () {
        currentOffice = this.getAttribute("data-prayer-office");
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    // Language toggle
    if (langToggle) {
      langToggle.addEventListener("click", function () {
        useModern = !useModern;
        langToggle.setAttribute("aria-pressed", String(useModern));
        if (langLabel) langLabel.textContent = useModern ? "Modern English" : "Original Language";
        render();
      });
    }
  }

  function escHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
})();
