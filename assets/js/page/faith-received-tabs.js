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
  const sections = document.querySelectorAll("[data-faith-section]");
  const navLinks = document.querySelectorAll(".faith-section-nav-link[data-faith-tab-target]");
  if (!sections.length) return;

  function show(name) {
    Array.prototype.forEach.call(sections, (s) => {
      const match = s.getAttribute("data-faith-section") === name;
      if (match) s.removeAttribute("hidden");
      else s.setAttribute("hidden", "");
    });
    Array.prototype.forEach.call(navLinks, (a) => {
      const match = a.getAttribute("data-faith-tab-target") === name;
      a.classList.toggle("is-active", match);
      if (match) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  function fromHash() {
    const h = (window.location.hash || "").replace(/^#/, "");
    const valid = ["start", "documents", "library", "traditions", "topics", "scripture", "today", "devotional"];
    if (valid.indexOf(h) >= 0) return h;
    // A ?collection= or ?author= link points into the Library browse.
    // Without this a shared browse position opens on Documents, with
    // the thing it names rendered but hidden behind another tab.
    try {
      const q = new URLSearchParams(window.location.search);
      if (q.get("collection") || q.get("author")) return "library";
    } catch (_) {}
    // The front door, not the filing cabinet.
    return "start";
  }

  Array.prototype.forEach.call(navLinks, (a) => {
    a.addEventListener("click", (e) => {
      const target = a.getAttribute("data-faith-tab-target");
      if (!target) return;
      e.preventDefault();
      if (window.location.hash !== `#${target}`) {
        history.pushState(null, "", `#${target}`);
      }
      show(target);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  window.addEventListener("hashchange", () => { show(fromHash()); });
  show(fromHash());
})();

// ---- Traditions sub-tabs -------------------------------------------------
(function () {
  const subNav = document.querySelector("[data-faith-tradition-tabs]");
  if (!subNav) return;
  const tabs = subNav.querySelectorAll("[data-faith-tradition-target]");
  const bands = document.querySelectorAll("[data-faith-tradition]");
  if (!tabs.length || !bands.length) return;

  function show(slug) {
    Array.prototype.forEach.call(bands, (b) => {
      const match = b.getAttribute("data-faith-tradition") === slug;
      if (match) b.removeAttribute("hidden");
      else b.setAttribute("hidden", "");
    });
    Array.prototype.forEach.call(tabs, (t) => {
      const match = t.getAttribute("data-faith-tradition-target") === slug;
      t.classList.toggle("is-active", match);
      t.setAttribute("aria-pressed", match ? "true" : "false");
    });
  }

  Array.prototype.forEach.call(tabs, (t) => {
    t.addEventListener("click", (e) => {
      e.preventDefault();
      const slug = t.getAttribute("data-faith-tradition-target");
      if (slug) show(slug);
    });
  });
})();
