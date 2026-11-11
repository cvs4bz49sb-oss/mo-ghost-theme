/*
 * The Faith Received rail: opening and closing its panels.
 *
 * Everything the rail links to is in the markup already, so this file
 * only decides what is shown. If it never loads, the rail is still its
 * row of items and the panels are simply closed.
 *
 * A FILE, NOT AN INLINE SCRIPT: the theme's CSP is script-src 'self'
 * with no 'unsafe-inline', so an inline handler is refused by the
 * browser and silently never runs.
 *
 * DROPDOWNS, NOT DRAWERS (Ian, 2026-11-11): "make the navrail a mini
 * version of the same style [as the header menu] ... instead of the
 * slide out, it's the drop downs." Read, Research and About each open a
 * panel of columns under the rail. The sideways drawer, its measured
 * width animation and the scroll cue that went with it are gone.
 */
(function () {
  "use strict";

  const rail = document.querySelector(".tfr-rail");
  if (!rail) return;

  const toggles = Array.prototype.slice.call(rail.querySelectorAll("[data-tfr-drawer]"));
  if (!toggles.length) return;

  const drawerFor = (name) => rail.querySelector(`[data-tfr-drawer-for="${name}"]`);

  /* THE OPEN PANEL LIVES OUTSIDE THE SCROLLING ROW. On a phone the row
     (.tfr-rail-inner) scrolls sideways, and iOS WebKit clips an
     absolutely positioned child to a touch-scrolling ancestor even when
     the spec says it should escape (Ian, 2026-09-22: "Nothing happens
     when I tap Read on iPhone Brave"). So an open panel is moved to be a
     direct child of .tfr-rail, and put back in its group when it closes.
     Every lookup here is rail-scoped, so the move changes nothing else. */
  const homes = new Map();
  function lift(d) {
    if (d.parentNode === rail) return;
    homes.set(d, d.parentNode);
    rail.appendChild(d);
  }
  function restore(d) {
    const home = homes.get(d);
    if (home && d.parentNode !== home) home.appendChild(d);
    homes.delete(d);
  }

  function close(toggle) {
    const d = drawerFor(toggle.dataset.tfrDrawer);
    if (!d) return;
    toggle.setAttribute("aria-expanded", "false");
    d.classList.remove("is-open");
    d.hidden = true;
    restore(d);
    if (!rail.querySelector(".tfr-rail-drawer.is-open")) rail.classList.remove("tfr-rail--open");
  }

  function closeAll(except) {
    toggles.forEach((t) => { if (t !== except) close(t); });
  }

  // At once, in the same task: a frame's delay let a quick second tap
  // close a panel that had not opened yet (2026-09-21).
  function open(toggle) {
    const d = drawerFor(toggle.dataset.tfrDrawer);
    if (!d) return;
    closeAll(toggle);
    toggle.setAttribute("aria-expanded", "true");
    d.hidden = false;
    lift(d);
    d.classList.add("is-open");
    rail.classList.add("tfr-rail--open");
  }

  toggles.forEach((t) => {
    t.addEventListener("click", (e) => {
      e.preventDefault();
      if (t.getAttribute("aria-expanded") === "true") { close(t); return; }
      open(t);
    });
  });

  // Escape closes, and returns the focus to the control that opened it,
  // or the reader is left with the caret somewhere they cannot see.
  rail.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const openToggle = toggles.filter((t) => t.getAttribute("aria-expanded") === "true")[0];
    if (!openToggle) return;
    close(openToggle);
    openToggle.focus();
  });

  // A click anywhere else is a decision not to use the panel.
  document.addEventListener("click", (e) => {
    if (rail.contains(e.target)) return;
    closeAll(null);
  });

  /* ASK OPENS HERE WHEN IT CAN.
   *
   * The Scripture tool, the author room and the compare desk all load
   * ask-workspace.js, which puts Ask on the page as an overlay: it knows
   * what work or passage you are looking at, and closing it puts you back
   * where you were. Those three used to reach it through a button in the
   * ported navigation bar, which the rail has now replaced.
   *
   * Following the link instead would leave the page to ask a question
   * about it, which is the wrong trade. So where the overlay exists, the
   * Research drawer's Ask opens it; everywhere else the href stands and
   * the reader goes to the Ask workspace, which is why this is an
   * enhancement on a real link rather than a button.
   */
  rail.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest('a[href^="/the-faith-received/ask/"]');
    if (!a || !rail.contains(a)) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return; // open-in-new-tab still works
    const ask = window.FRAsk;
    if (!ask || typeof ask.open !== "function") return; // no overlay here: follow the link
    e.preventDefault();
    closeAll(null);
    ask.open();
  });

  /* Mark where we are, so the rail says which part of the library the
     reader is standing in. Prefix match, because a surface may carry a
     query or a hash. The brand is exempt: every page is under it, and
     marking it on all of them would say nothing. */
  const here = `${window.location.pathname.replace(/\/+$/, "")}/`;
  /* Two rail items can now share a path and differ only by hash:
     Bookmarks is /research/#bookmarks and Notebook is
     /research/#notebook, both panels of the Research desk. The matcher
     compared paths alone, so standing on /research/ lit BOTH of them
     and drew one underline across the pair.

     A link that names a panel is current only when that panel is the
     one open. The Research page's hash is `#<mode>` with the panel's
     own state after the first "&" (the grammar is at the top of
     assets/js/page/faith-research.js), so the mode is everything before
     it. A link with no hash keeps the old rule. */
  const mode = window.location.hash.replace(/^#/, "").split("&")[0];
  Array.prototype.slice.call(rail.querySelectorAll("a[href]")).forEach((a) => {
    const raw = a.getAttribute("href");
    const href = raw.split("#")[0].split("?")[0];
    const wants = raw.indexOf("#") >= 0 ? raw.split("#")[1].split("&")[0] : "";
    if (!href || href === "/the-faith-received/") return;
    const path = `${href.replace(/\/+$/, "")}/`;
    if (here !== path) return;
    if (wants && wants !== mode) return;
    a.setAttribute("aria-current", "page");
    const group = a.closest(".tfr-rail-group");
    const toggle = group && group.querySelector("[data-tfr-drawer]");
    if (toggle) toggle.classList.add("is-current");
  });

  /* The hash changes without a page load on the Research desk, so the
     mark has to follow it. Re-running the same pass is cheaper than
     tracking which link was marked last. */
  window.addEventListener("hashchange", () => {
    const now = window.location.hash.replace(/^#/, "").split("&")[0];
    Array.prototype.slice.call(rail.querySelectorAll("a[href]")).forEach((a) => {
      const raw = a.getAttribute("href");
      if (raw.indexOf("#") < 0) return;
      const href = raw.split("#")[0].split("?")[0];
      if (`${href.replace(/\/+$/, "")}/` !== here) return;
      const wants = raw.split("#")[1].split("&")[0];
      if (wants === now) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  });
})();
