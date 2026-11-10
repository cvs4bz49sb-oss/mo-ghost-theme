/*
 * The Faith Received home: the header's Support goes to #support.
 *
 * Ian, 2026-09-22: "I want a Support The Work button here. It should
 * scroll to the bottom of the page where the Membership section is.
 * Make the header Support button do the same."
 *
 * The header's Support is a menu trigger (a <button class="nav-dropdown-toggle">
 * on desktop, opening the header menu from nav-mega.js; an .mm-acc-btn
 * section in the phone drawer). On this page only, a
 * click on it scrolls to the support section instead of opening the
 * menu. Everything the menu offers is in that section: membership and
 * the one-time gift.
 *
 * A capturing listener on the document, so it runs before the toggle's
 * own handler whatever order the two scripts load in, and stops that
 * handler from opening the menu. A FILE, not an inline script: the
 * theme's CSP has no 'unsafe-inline'.
 */
(function () {
  "use strict";

  const target = document.getElementById("support");
  if (!target) return;

  const isSupport = (el) => /^\s*support\b/i.test(el.textContent || "");

  document.addEventListener("click", (e) => {
    const toggle = e.target.closest && e.target.closest(".nav-dropdown-toggle, .mobile-nav-group-toggle, .mm-acc-btn");
    if (!toggle || !isSupport(toggle)) return;
    e.preventDefault();
    e.stopImmediatePropagation();

    // In the phone drawer, close it first or the scroll happens behind it.
    const drawer = document.getElementById("mobile-nav");
    const close = drawer && !drawer.hidden && drawer.querySelector(".mobile-nav-close");
    if (close) close.click();

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const go = () => target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    // The drawer takes 260ms to slide away (header-behaviors.js) and holds
    // the page still while it is open, so wait for it before scrolling.
    if (close) window.setTimeout(go, 300);
    else go();
    if (history.replaceState) history.replaceState(null, "", "#support");
  }, true);
})();
