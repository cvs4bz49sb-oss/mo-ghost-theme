/*
 * The Faith Received — front door.
 *
 * Two things: a catechism question for the day, and a hand-picked
 * shelf of twelve. Both exist so the first screen asks nothing of a
 * visitor who does not yet know what a confession is, while the rail
 * above still takes a scholar straight to the indexes.
 */

(function () {
  "use strict";

  const dailyEl = document.querySelector("[data-faith-daily]");
  const shelfEl = document.querySelector("[data-faith-shelf]");
  if (!dailyEl && !shelfEl) return;

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ── Today's question ──────────────────────────────────────────
   *
   * Keyed on the date, not on a random number, so everyone reading on
   * the same day reads the same question — that is what makes it
   * something a household or a parish can keep together, and it means
   * a reload does not reshuffle it.
   */

  function dayIndex(count) {
    const now = new Date();
    // Local midnight, so the question turns over at the reader's
    // midnight rather than UTC's.
    const days = Math.floor(
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86400000
    );
    return ((days % count) + count) % count;
  }

  function renderDaily(q) {
    const url = `/the-faith-received/${encodeURIComponent(q.source)}/#${encodeURIComponent(q.anchor)}`;
    dailyEl.innerHTML =
      `<p class="faith-today-source">${escapeHtml(q.sourceLabel)} &middot; ${escapeHtml(q.year)}` +
      ` &middot; Question ${q.n}</p>` +
      `<h2 class="faith-today-q"><em>${escapeHtml(q.question)}</em></h2>` +
      `<div class="faith-today-a article-content"><p>${escapeHtml(q.answer)}</p></div>` +
      `<p class="faith-today-actions">` +
      `<a href="${url}">Read it in the catechism <span aria-hidden="true">&rarr;</span></a>` +
      `</p>`;
  }

  if (dailyEl) {
    // Same path the rest of the Faith Received JS uses for theme data.
    fetch(window.moAssetUrl("/assets/data/faith-received/catechism-daily.json"), { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        const qs = d.questions || [];
        if (!qs.length) throw new Error("empty");
        renderDaily(qs[dayIndex(qs.length)]);
      })
      .catch(() => {
        // No question is better than a broken promise of one.
        dailyEl.remove();
      });
  }

  /* ── Start here ────────────────────────────────────────────────
   *
   * EDITORIAL — this list is the whole value of the front door and it
   * belongs to Ian and Jake, not to the code. Twelve provisional
   * picks, every one already a live route. Replace freely; the shape
   * is what matters, and a sentence in MO's own voice beats a
   * catalogue description every time.
   */

  const SHELF = [
    { slug: "apostles-creed", eyebrow: "The creed", title: "The Apostles' Creed",
      note: "The oldest summary of the faith, learned at baptism for eighteen centuries." },
    { slug: "nicene-creed", eyebrow: "325 &amp; 381", title: "The Nicene Creed",
      note: "What the whole church settled about Christ, and still confesses together." },
    { slug: "heidelberg", eyebrow: "1563", title: "The Heidelberg Catechism",
      note: "Warmest of the catechisms. Begins not with doctrine but with comfort." },
    { slug: "westminster-shorter", eyebrow: "1647", title: "The Westminster Shorter Catechism",
      note: "A hundred and seven questions that shaped English-speaking Protestantism." },
    { slug: "didache", eyebrow: "c. 50&ndash;120", title: "The Didache",
      note: "How the first Christians were taught to live, pray and gather." },
    { slug: "augustine-confessions", eyebrow: "Augustine", title: "The Confessions",
      note: "The book that invented the inner life as a subject worth writing about." },
    { slug: "athanasius-incarnation", eyebrow: "Athanasius", title: "On the Incarnation",
      note: "Why God became man, argued by the man who would not let it go." },
    { slug: "imitation-of-christ", eyebrow: "&agrave; Kempis", title: "The Imitation of Christ",
      note: "Four centuries of readers have called this the book to keep by the bed." },
    { slug: "belgic", eyebrow: "1561", title: "The Belgic Confession",
      note: "Written by a man who was hanged for it four years later." },
    { slug: "thirty-nine-articles", eyebrow: "1571", title: "The Thirty-Nine Articles",
      note: "The settlement that made a national church out of a reformation." },
    { slug: "1689", eyebrow: "1689", title: "The London Baptist Confession",
      note: "Baptists borrowing Westminster's frame and quietly changing the walls." },
    { slug: "edwards-resolutions", eyebrow: "Edwards", title: "The Resolutions",
      note: "Seventy resolutions a nineteen-year-old wrote and reread weekly for life." },
  ];

  if (shelfEl) {
    shelfEl.innerHTML = SHELF.map((w) =>
      `<a class="faith-card" href="/the-faith-received/${encodeURIComponent(w.slug)}/">` +
      `<p class="faith-card-date">${w.eyebrow}</p>` +
      `<h3 class="faith-card-title"><em>${escapeHtml(w.title)}</em></h3>` +
      `<p class="faith-card-desc">${escapeHtml(w.note)}</p>` +
      `<span class="faith-card-link">Read <span class="faith-card-arrow" aria-hidden="true">&rarr;</span></span>` +
      `</a>`
    ).join("");
  }
})();
