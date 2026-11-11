/*
 * /dashboard/faith-received/: Bookmarks and Notebook as two tabs (Ian,
 * 2026-11-10). The address hash (#bookmarks, #notebook) opens a tab, and
 * choosing one writes the hash back without a jump. Arrow keys, Home and
 * End move between the buttons. Without this script the bar stays
 * hidden and both panels show.
 */
(function () {
  "use strict";
  const bar = document.querySelector("[data-dft-tabs]");
  if (!bar) return;
  const tabs = [...bar.querySelectorAll("[data-dft-tab]")];
  const panels = [...document.querySelectorAll("[data-dft-panel]")];
  if (!tabs.length || tabs.length !== panels.length) return;
  const ids = tabs.map((t) => t.dataset.dftTab);

  function show(id, focus) {
    if (!ids.includes(id)) id = ids[0];
    tabs.forEach((t) => {
      const on = t.dataset.dftTab === id;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.classList.toggle("is-active", on);
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    panels.forEach((p) => { p.hidden = p.id !== id; });
  }

  bar.hidden = false;
  show(decodeURIComponent((location.hash || "").slice(1)), false);

  function choose(id, focus) {
    show(id, focus);
    try { history.replaceState(null, "", `#${id}`); } catch (e) { /* no history */ }
  }

  tabs.forEach((t, i) => {
    t.addEventListener("click", () => { choose(t.dataset.dftTab, false); });
    t.addEventListener("keydown", (e) => {
      let j = -1;
      if (e.key === "ArrowRight") j = (i + 1) % tabs.length;
      else if (e.key === "ArrowLeft") j = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") j = 0;
      else if (e.key === "End") j = tabs.length - 1;
      if (j < 0) return;
      e.preventDefault();
      choose(tabs[j].dataset.dftTab, true);
    });
  });
  window.addEventListener("hashchange", () => {
    show(decodeURIComponent((location.hash || "").slice(1)), false);
  });
}());
