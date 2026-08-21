/*
 * The reading tools, docked.
 *
 * They used to be a row above the text, which meant they were only
 * reachable from the top of the work. A reader four hundred pages into
 * a folio who wanted larger type, or the contents, or the way back to
 * the beginning, had to scroll all the way up to ask for it, and then
 * find their place again.
 *
 * So the tools sit at the bottom right of the viewport and stay there.
 * Three buttons always: back to the top, the contents, and the tools
 * themselves. Everything else lives in a panel that opens above them.
 *
 * The panel's contents are not built here. faith-reader-tools.js,
 * faith-reader-prefs.js, faith-bookmark.js and faith-reader.js each
 * mount into it by data attribute, and moving the row into a dock left
 * every one of those hooks where it was.
 */
(function () {
  const dock = document.querySelector("[data-faith-dock]");
  if (!dock) return;

  const panel = dock.querySelector("[data-faith-controls]");
  const toggle = dock.querySelector("[data-faith-dock-toggle]");
  const topBtn = dock.querySelector("[data-faith-dock-top]");
  const contentsBtn = dock.querySelector("[data-faith-dock-contents]");
  if (!panel || !toggle) return;

  // ── The panel ────────────────────────────────────────────────
  function setOpen(on) {
    panel.hidden = !on;
    dock.classList.toggle("is-open", on);
    toggle.setAttribute("aria-expanded", String(on));
  }

  toggle.addEventListener("click", () => setOpen(panel.hidden));

  // Escape closes it, and the focus goes back to the button that
  // opened it rather than to the top of the document.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || panel.hidden) return;
    setOpen(false);
    toggle.focus();
  });

  // A click anywhere else closes it. Not on the dock itself, and not
  // on the preferences panel, which opens out of the dock and would
  // otherwise close the thing it belongs to on its first press.
  document.addEventListener("click", (e) => {
    if (panel.hidden) return;
    if (dock.contains(e.target)) return;
    if (e.target.closest && e.target.closest(".faith-prefs-panel")) return;
    setOpen(false);
  });

  // ── Back to the top ──────────────────────────────────────────
  //
  // Hidden until there is a top to go back to, so it is not a button
  // that does nothing on arrival.
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      ticking = false;
      if (topBtn) topBtn.hidden = window.pageYOffset < 600;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (topBtn) {
    topBtn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      const head = document.querySelector("[data-fr-title]");
      if (head) head.setAttribute("tabindex", "-1");
      if (head) head.focus({ preventScroll: true });
    });
  }

  // ── Contents ─────────────────────────────────────────────────
  //
  // The drawer already has a button in the header, which scrolls away
  // with it. This is the same drawer from wherever the reader is.
  if (contentsBtn) {
    contentsBtn.addEventListener("click", () => {
      const opener = document.querySelector("[data-faith-toc-toggle]");
      if (opener) { opener.click(); return; }
      const rail = document.querySelector(".faith-toc-sidebar");
      if (rail) rail.scrollIntoView({ block: "start" });
    });
  }
}());
