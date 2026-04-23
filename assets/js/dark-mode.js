/*
 * Dark-mode toggle for post article bodies.
 *
 * Scope: sets data-theme="dark" on <html>. CSS overrides in screen.css
 * are scoped to html[data-theme="dark"] .article-body so only the
 * article body reacts — masthead, hero, footer stay unchanged.
 *
 * State: persisted in localStorage under `mo-article-theme`. On first
 * visit with no saved preference, respects prefers-color-scheme so
 * a reader whose OS is in dark mode doesn't get slapped with a bright
 * page.
 *
 * The toggle button is feature-flagged by @custom.enable_dark_mode in
 * post.hbs — this script is inert on pages that don't render the
 * [data-dark-mode-toggle] element.
 *
 * Initial apply runs before DOMContentLoaded so there's no light→dark
 * flash on load (FOUC). The button wiring happens after DOM is ready.
 */
(function () {
  var KEY = "mo-article-theme";

  function apply(theme) {
    if (theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }

  function current() {
    return document.documentElement.getAttribute("data-theme") === "dark"
      ? "dark"
      : "light";
  }

  // Resolve initial state immediately (before DOM ready) so the page
  // paints in the correct theme on first render.
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { /* no-op */ }
  if (saved === "dark" || saved === "light") {
    apply(saved);
  } else if (
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    apply("dark");
  }

  function updateButton(btn) {
    var isDark = current() === "dark";
    btn.setAttribute("aria-pressed", isDark ? "true" : "false");
    btn.setAttribute(
      "aria-label",
      isDark ? "Switch to light mode" : "Switch to dark mode"
    );
  }

  function wireButtons() {
    var buttons = document.querySelectorAll("[data-dark-mode-toggle]");
    if (!buttons.length) return;
    buttons.forEach(function (btn) {
      updateButton(btn);
      btn.addEventListener("click", function () {
        var next = current() === "dark" ? "light" : "dark";
        apply(next);
        try { localStorage.setItem(KEY, next); } catch (e) { /* no-op */ }
        buttons.forEach(updateButton);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireButtons);
  } else {
    wireButtons();
  }
})();
