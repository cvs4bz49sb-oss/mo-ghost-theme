/*
 * /the-faith-received/ tab navigation. Two pieces:
 *
 *   1. Section tabs (Documents / Library / Traditions / Topics /
 *      Scripture / Today / Devotional). Hash-driven; click swaps
 *      view + scrolls to top. No navigation between routes.
 *
 *   2. Traditions sub-tabs (Patristic / Catholic / Lutheran /
 *      Anglican / Reformed / Baptist / Evangelical). In-page only —
 *      sub-tab state resets on each visit; the top-level #traditions
 *      hash drives the outer tab.
 */

// ---- Section tabs --------------------------------------------------------
(function () {
  var sections = document.querySelectorAll("[data-faith-section]");
  var navLinks = document.querySelectorAll(".faith-section-nav-link[data-faith-tab-target]");
  if (!sections.length) return;

  function show(name) {
    Array.prototype.forEach.call(sections, function (s) {
      var match = s.getAttribute("data-faith-section") === name;
      if (match) s.removeAttribute("hidden");
      else s.setAttribute("hidden", "");
    });
    Array.prototype.forEach.call(navLinks, function (a) {
      var match = a.getAttribute("data-faith-tab-target") === name;
      a.classList.toggle("is-active", match);
      if (match) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  function fromHash() {
    var h = (window.location.hash || "").replace(/^#/, "");
    var valid = ["documents", "library", "traditions", "topics", "scripture", "today", "devotional"];
    return valid.indexOf(h) >= 0 ? h : "documents";
  }

  Array.prototype.forEach.call(navLinks, function (a) {
    a.addEventListener("click", function (e) {
      var target = a.getAttribute("data-faith-tab-target");
      if (!target) return;
      e.preventDefault();
      if (window.location.hash !== "#" + target) {
        history.pushState(null, "", "#" + target);
      }
      show(target);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  window.addEventListener("hashchange", function () { show(fromHash()); });
  show(fromHash());
})();

// ---- Traditions sub-tabs -------------------------------------------------
(function () {
  var subNav = document.querySelector("[data-faith-tradition-tabs]");
  if (!subNav) return;
  var tabs = subNav.querySelectorAll("[data-faith-tradition-target]");
  var bands = document.querySelectorAll("[data-faith-tradition]");
  if (!tabs.length || !bands.length) return;

  function show(slug) {
    Array.prototype.forEach.call(bands, function (b) {
      var match = b.getAttribute("data-faith-tradition") === slug;
      if (match) b.removeAttribute("hidden");
      else b.setAttribute("hidden", "");
    });
    Array.prototype.forEach.call(tabs, function (t) {
      var match = t.getAttribute("data-faith-tradition-target") === slug;
      t.classList.toggle("is-active", match);
      t.setAttribute("aria-pressed", match ? "true" : "false");
    });
  }

  Array.prototype.forEach.call(tabs, function (t) {
    t.addEventListener("click", function (e) {
      e.preventDefault();
      var slug = t.getAttribute("data-faith-tradition-target");
      if (slug) show(slug);
    });
  });
})();
