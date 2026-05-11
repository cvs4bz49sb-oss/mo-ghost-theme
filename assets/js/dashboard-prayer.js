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

  const DATA_URL = "/assets/data/faith-received/prayer.json";

  // ── Sections that start open by default ──────────────────────
  // These are the core Daily Office sections. Others collapse.
  const CORE_SECTIONS = new Set([
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
  const SKIP_SECTIONS = new Set([
    "The Psalter and First Lesson",
    "The Second Lesson",
    "Rubric on the Litany",
    "Rubric on Closing",
  ]);

  // ── State ─────────────────────────────────────────────────────
  let data = null;
  let currentOffice = "morning";
  let useModern = true;

  // ── DOM refs ──────────────────────────────────────────────────
  const sectionsEl = document.querySelector("[data-prayer-sections]");
  const greetingEl = document.querySelector("[data-prayer-greeting]");
  const subEl = document.querySelector("[data-prayer-sub]");
  const langToggle = document.querySelector("[data-prayer-lang-toggle]");
  const langLabel = document.querySelector("[data-prayer-lang-label]");
  const officeBtns = document.querySelectorAll("[data-prayer-office]");

  if (!sectionsEl) return;

  // ── Determine office from time of day ─────────────────────────
  const hour = new Date().getHours();
  currentOffice = hour >= 16 ? "evening" : "morning";

  // ── Load data ─────────────────────────────────────────────────
  fetch(DATA_URL)
    .then((r) => { return r.json(); })
    .then((d) => {
      data = d;
      render();
      initControls();
    })
    .catch(() => {
      sectionsEl.innerHTML =
        '<p class="prayer-error">Could not load the Daily Office. <a href="/the-faith-received/1928-bcp/">Read the full text instead &rarr;</a></p>';
    });

  function render() {
    if (!data) return;

    const book = currentOffice === "morning" ? data.books[0] : data.books[1];
    const chapters = book.chapters || [];

    // Update hero
    if (greetingEl) greetingEl.textContent = currentOffice === "morning" ? "Morning" : "Evening";
    if (subEl) subEl.textContent = "From the 1928 Book of Common Prayer.";

    // Update office toggle
    for (let i = 0; i < officeBtns.length; i++) {
      const btn = officeBtns[i];
      const isActive = btn.getAttribute("data-prayer-office") === currentOffice;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", String(isActive));
    }

    // Render sections
    let html = "";
    for (let c = 0; c < chapters.length; c++) {
      const ch = chapters[c];
      if (SKIP_SECTIONS.has(ch.title)) continue;

      const isCore = CORE_SECTIONS.has(ch.title);
      const paras = useModern ? (ch.modernized || ch.paragraphs) : ch.paragraphs;

      const subtitle = ch.subtitle
        ? `<span class="prayer-section-subtitle">${escHtml(ch.subtitle)}</span>`
        : "";

      let bodyHtml = "";
      for (let p = 0; p < paras.length; p++) {
        const text = paras[p];
        // Detect versicle/response patterns (V. / R.)
        if (/^V\.\s/.test(text)) {
          bodyHtml += `<p class="prayer-versicle">${escHtml(text)}</p>\n`;
        } else if (/^R\.\s/.test(text)) {
          bodyHtml += `<p class="prayer-response"><strong>${escHtml(text)}</strong></p>\n`;
        } else if (text.indexOf("*") > -1) {
          // Canticle verse with * half-verse mark
          bodyHtml += `<p class="prayer-verse">${escHtml(text)}</p>\n`;
        } else {
          bodyHtml += `<p>${escHtml(text)}</p>\n`;
        }
      }

      html +=
        `<details class="prayer-section"${isCore ? " open" : "" 
        } id="prayer-${c}">` +
        `<summary class="prayer-section-summary">` +
        `<h2 class="prayer-section-title"><em>${escHtml(ch.title)}</em></h2>${ 
        subtitle 
        }<span class="prayer-section-chev" aria-hidden="true"></span>` +
        `</summary>` +
        `<div class="prayer-section-body article-content">${ 
        bodyHtml 
        }</div>` +
        `</details>\n`;
    }

    sectionsEl.innerHTML = html;
  }

  function initControls() {
    // Office toggle
    for (let i = 0; i < officeBtns.length; i++) {
      officeBtns[i].addEventListener("click", function () {
        currentOffice = this.getAttribute("data-prayer-office");
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    // Language toggle
    if (langToggle) {
      langToggle.addEventListener("click", () => {
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
