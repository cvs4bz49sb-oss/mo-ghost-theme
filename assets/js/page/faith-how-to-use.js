/*
 * /the-faith-received/how-to-use/: turns the three guide links into tabs.
 *
 * The markup is complete without this file: three tab links to #laity, #pastors and #academics, and all three
 * guides in order below them. This file adds the roles, shows one guide at a time and keeps the address in step:
 * a link to #pastors opens Pastors, no hash opens Laity. A file and not an inline script, because the theme's CSP
 * refuses inline script.
 */
(function () {
  "use strict";

  /* Runs in the <head>, before the page paints: name the guide to show on <html> so the CSS can hide the other two at once. */
  const NAMES = ["laity", "pastors", "academics"];
  const openFromHash = () => {
    let h = "";
    try { h = decodeURIComponent(window.location.hash.slice(1)); } catch (_) { h = ""; }
    if (NAMES.indexOf(h) > -1) return h;
    /* a block's id starts with its guide's name: #pastors-ask opens Pastors */
    const guide = h.split("-")[0];
    return NAMES.indexOf(guide) > -1 ? guide : NAMES[0];
  };
  const html = document.documentElement;
  html.classList.add("ht-js");
  html.setAttribute("data-ht-open", openFromHash());
  document.addEventListener("DOMContentLoaded", wire);

  function wire() {
    const root = document.getElementById("ht-root");
    if (!root) { html.classList.remove("ht-js"); html.removeAttribute("data-ht-open"); return; }
    const tabs = Array.prototype.slice.call(root.querySelectorAll("[data-ht-tab]"));
    const panels = Array.prototype.slice.call(root.querySelectorAll("[data-ht-panel]"));
    if (!tabs.length || tabs.length !== panels.length) { html.classList.remove("ht-js"); html.removeAttribute("data-ht-open"); return; }

    const names = tabs.map((t) => t.getAttribute("data-ht-tab"));
    const list = tabs[0].parentNode;
    list.setAttribute("role", "tablist");

    tabs.forEach((tab) => {
      const name = tab.getAttribute("data-ht-tab");
      tab.id = `ht-tab-${name}`;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-controls", name);
    });
    panels.forEach((panel) => {
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", `ht-tab-${panel.getAttribute("data-ht-panel")}`);
      panel.removeAttribute("aria-label");
      panel.tabIndex = 0;
    });

    const fromHash = openFromHash;

    const show = (name) => {
      html.setAttribute("data-ht-open", name);
      tabs.forEach((tab) => {
        const on = tab.getAttribute("data-ht-tab") === name;
        tab.setAttribute("aria-selected", on ? "true" : "false");
        tab.tabIndex = on ? 0 : -1;
      });
      panels.forEach((panel) => { panel.hidden = panel.getAttribute("data-ht-panel") !== name; });
    };

    const choose = (name, focus) => {
      show(name);
      if (window.location.hash !== `#${name}`) {
        try { window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${name}`); } catch (_) { /* the tab still changes */ }
      }
      if (focus) document.getElementById(`ht-tab-${name}`).focus();
    };

    tabs.forEach((tab) => {
      tab.addEventListener("click", (e) => {
        e.preventDefault();
        choose(tab.getAttribute("data-ht-tab"), false);
      });
      tab.addEventListener("keydown", (e) => {
        const i = names.indexOf(tab.getAttribute("data-ht-tab"));
        let next = -1;
        if (e.key === "ArrowRight") next = (i + 1) % names.length;
        else if (e.key === "ArrowLeft") next = (i + names.length - 1) % names.length;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = names.length - 1;
        if (next < 0) return;
        e.preventDefault();
        choose(names[next], true);
      });
    });

    const reveal = () => {
      let h = "";
      try { h = decodeURIComponent(window.location.hash.slice(1)); } catch (_) { h = ""; }
      const el = h && names.indexOf(h) < 0 ? document.getElementById(h) : null;
      if (el) el.scrollIntoView({ behavior: "instant", block: "start" });
    };
    window.addEventListener("hashchange", () => { show(fromHash()); reveal(); });
    show(fromHash());
    reveal();
  }
})();
