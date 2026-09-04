/*
 * /the-faith-received/research/ — the tab shell, and nothing else.
 *
 * Five workspaces on one page (Ask, Power Search, Bookmarks, Notebook,
 * Constellations); this file decides which one is on screen. The
 * mechanism is deliberately the same one faith-tfr-search.js's
 * showMode() uses on the Search page — [data-research-mode] buttons
 * toggle `is-active`/`aria-selected`, [data-research-panel] elements
 * toggle the `hidden` attribute — so there is one tab idiom in this
 * section of the site rather than two. It is a separate file rather
 * than a seventh mode inside faith-tfr-search.js because that file is
 * five hundred lines of Pagefind shard-merging and knows nothing about
 * this page; the only thing the two share is the pattern.
 *
 * Deep linking: the hash names the workspace (#ask, #power-search,
 * #bookmarks, #notebook, #constellations). Read on load, written with
 * history.replaceState on every tab change (replaceState, not
 * pushState — same as the Search page, so switching tabs doesn't build
 * a back-button trail through five panels of one page). replaceState
 * does not fire hashchange, so the listener below only ever sees a
 * real navigation: a pasted URL, an in-page anchor, or the back button
 * landing on an earlier hash.
 *
 * Nothing here knows what is inside a panel. Ask's markup comes from
 * partials/faith-received/_ask-panel.hbs and is driven by
 * page/faith-ask.js; Power Search by page/faith-power-search.js. Both
 * of those bind at parse time regardless of which panel is visible,
 * which is fine and is why neither needs telling that its tab became
 * active — a hidden [data-ask-form] is still in the document and still
 * has its listeners.
 *
 * Loaded as a page-template script, so per the theme's script-order
 * rule (FRONTEND §6.18) it runs before site.min.js. It touches no
 * bundle globals at all.
 */
(function () {
  const page = document.querySelector("[data-research-page]");
  if (!page) return;

  const tabs = Array.from(page.querySelectorAll("[data-research-mode]"));
  const panels = Array.from(page.querySelectorAll("[data-research-panel]"));
  if (!tabs.length || !panels.length) return;

  // Derived from the markup rather than hard-coded, so adding a sixth
  // workspace is a template change and not a template change plus a
  // list here that someone forgets. Order matters: it is the arrow-key
  // order and index 0 is the fallback for an unknown hash.
  const MODES = tabs.map((t) => t.getAttribute("data-research-mode"));

  function showMode(mode) {
    const target = MODES.indexOf(mode) >= 0 ? mode : MODES[0];
    panels.forEach((p) => {
      p.hidden = p.getAttribute("data-research-panel") !== target;
    });
    tabs.forEach((t) => {
      const active = t.getAttribute("data-research-mode") === target;
      t.classList.toggle("is-active", active);
      t.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  function selectMode(mode, focusTab) {
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, "", `#${mode}`);
    }
    showMode(mode);
    if (focusTab) {
      const t = tabs[MODES.indexOf(mode)];
      if (t) t.focus();
    }
  }

  tabs.forEach((t) => {
    t.addEventListener("click", () => {
      selectMode(t.getAttribute("data-research-mode"), false);
    });
  });

  // Arrow-key movement across the strip, the ordinary tablist
  // behaviour. Every tab stays in the natural tab order (no roving
  // tabindex), so this is an addition for people who expect arrows and
  // never the only way to reach a tab — the failure mode of a roving
  // tabindex with a broken key handler is a control a keyboard user
  // cannot operate at all.
  const KEY_DELTA = { ArrowRight: 1, ArrowLeft: -1 };
  page.addEventListener("keydown", (e) => {
    const btn = e.target.closest ? e.target.closest("[data-research-mode]") : null;
    if (!btn) return;
    const i = tabs.indexOf(btn);
    if (i < 0) return;

    let next = -1;
    if (Object.prototype.hasOwnProperty.call(KEY_DELTA, e.key)) {
      next = (i + KEY_DELTA[e.key] + tabs.length) % tabs.length;
    } else if (e.key === "Home") {
      next = 0;
    } else if (e.key === "End") {
      next = tabs.length - 1;
    }
    if (next < 0) return;

    e.preventDefault();
    selectMode(MODES[next], true);
  });

  // A real navigation to a different hash — a pasted link, an in-page
  // anchor, or the back button. replaceState above never fires this.
  window.addEventListener("hashchange", () => {
    showMode((window.location.hash || "").replace(/^#/, ""));
  });

  // Boot. An unknown or absent hash falls through to the first tab
  // rather than showing nothing; showMode() does that clamp itself, so
  // the hash is handed over raw.
  showMode((window.location.hash || "").replace(/^#/, ""));
})();
