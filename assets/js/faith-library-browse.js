/*
 * The Faith Received — Latin Library Browse
 *
 * Fetches the works index from R2 and renders a filterable card grid
 * on the Library tab of /the-faith-received/.
 */

(function () {
  "use strict";

  var grid = document.querySelector("[data-fr-library-grid]");
  if (!grid) return;

  var filtersEl = document.querySelector("[data-fr-filters]");
  var baseMeta = document.querySelector('meta[name="tfr-library-base"]');
  var BASE = ((baseMeta && baseMeta.getAttribute("content")) || "").replace(/\/+$/, "");

  if (!BASE) {
    grid.innerHTML = '<p>Library configuration missing.</p>';
    return;
  }

  var works = [];
  var activeFilter = "all";

  fetch(BASE + "/v1/works-index.json")
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (data) {
      works = data.works || [];
      var traditions = data.traditions || [];
      buildFilters(traditions);
      renderGrid(works);
    })
    .catch(function (err) {
      grid.innerHTML = '<p>Could not load the library. (' + err.message + ')</p>';
    });

  function buildFilters(traditions) {
    if (!filtersEl || !traditions.length) return;
    traditions.forEach(function (t) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "faith-lang-btn";
      btn.setAttribute("data-fr-filter", t);
      btn.setAttribute("aria-pressed", "false");
      btn.textContent = t;
      filtersEl.appendChild(btn);
    });

    filtersEl.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-fr-filter]");
      if (!btn) return;
      activeFilter = btn.getAttribute("data-fr-filter");
      filtersEl.querySelectorAll("[data-fr-filter]").forEach(function (b) {
        b.setAttribute("aria-pressed", b === btn ? "true" : "false");
      });
      renderGrid(works);
    });
  }

  function renderGrid(allWorks) {
    var filtered = activeFilter === "all"
      ? allWorks
      : allWorks.filter(function (w) { return w.tradition === activeFilter; });

    if (!filtered.length) {
      grid.innerHTML = '<p>No works found.</p>';
      return;
    }

    var html = filtered.map(function (w) {
      var tradition = escapeHtml(w.tradition || "");
      var title = escapeHtml(w.title || w.slug);
      var author = escapeHtml(w.author || "");
      var pages = w.n_pages ? w.n_pages + " pp." : "";
      return '<a class="faith-card" href="/the-faith-received/reader/?w=' + encodeURIComponent(w.slug) + '">' +
        (tradition ? '<p class="faith-card-date">' + tradition + '</p>' : '') +
        '<h3 class="faith-card-title"><em>' + title + '</em></h3>' +
        (author ? '<p class="faith-card-author"><em>' + author + '</em></p>' : '') +
        (pages ? '<p class="faith-card-desc">' + pages + '</p>' : '') +
        '<span class="faith-card-link">Read <span class="faith-card-arrow" aria-hidden="true">&rarr;</span></span>' +
        '</a>';
    }).join("");

    grid.innerHTML = html;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
