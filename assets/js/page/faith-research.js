/*
 * /the-faith-received/research/ — the tab shell, and nothing else.
 *
 * Seven workspaces on one page (Ask, Power Search, Compare, Bookmarks,
 * Notebook, Connections, the Desk); this file decides which one is on
 * screen. The mechanism is deliberately the same one
 * faith-tfr-search.js's showMode() uses on the Search page —
 * [data-research-mode] buttons toggle `is-active`/`aria-selected`,
 * [data-research-panel] elements toggle the `hidden` attribute — so
 * there is one tab idiom in this section of the site rather than two. It
 * is a separate file rather than an eighth mode inside
 * faith-tfr-search.js because that file is five hundred lines of
 * Pagefind shard-merging and knows nothing about this page; the only
 * thing the two share is the pattern.
 *
 * ── THE ADDRESS ──────────────────────────────────────────────────
 *
 * The hash is `#<mode>` optionally followed by `&<state>`:
 *
 *     #ask
 *     #notebook
 *     #compare
 *     #compare&a=augustine-of-hippo,jerome&sel=sin&g=canon
 *
 * MODE IS THE FIRST SEGMENT, everything after the first "&" is the
 * panel's own business. That grammar was chosen because it is the only
 * one that keeps BOTH halves working unchanged:
 *
 *   - the five hashes that shipped before Compare and the Desk arrived
 *     (#ask, #power-search, #bookmarks, #notebook, #constellations) are
 *     bare tokens with no "&" in them, so splitting on "&" and taking
 *     segment 0 reads them exactly as this file always did. No old deep
 *     link changes meaning.
 *   - Compare's own state is already a URLSearchParams string
 *     (a=&sel=&g=&s=&q=), which is what makes a comparison shareable.
 *     `new URLSearchParams(tail)` parses the tail directly, so
 *     faith-compare.js keeps the parser it had; all it does differently
 *     is write its mode in front and refuse to read a hash whose mode is
 *     not its own.
 *
 * Anything else was worse. Putting the mode in a query parameter would
 * have made every existing #ask link land on Ask-by-accident rather than
 * Ask-by-address and would have put tab state in a place Ghost sometimes
 * rewrites. Giving each panel its own separator (#compare/a=…) would
 * have meant a second grammar for the panels that have no state.
 *
 * THIS FILE STILL KNOWS NOTHING ABOUT PANEL INTERNALS. The tail is an
 * opaque string here: it is never parsed, only carried. What it carries
 * is remembered per mode, so that flipping to the Notebook and back does
 * not throw away the comparison someone had set up — see `tails` below.
 *
 * replaceState, not pushState, on every tab change, same as the Search
 * page, so switching tabs doesn't build a back-button trail through
 * seven panels of one page. replaceState does not fire hashchange, so
 * the listener below only ever sees a real navigation: a pasted URL, an
 * in-page anchor, or the back button landing on an earlier hash.
 *
 * ── WAKING PANELS ────────────────────────────────────────────────
 *
 * Nothing here mounts anything. Ask and Power Search bind at parse time
 * regardless of which panel is visible, which is fine — a hidden
 * [data-ask-form] is still in the document and still has its listeners.
 * The panels whose first act costs something (Compare fetches nine
 * shelf rosters, the Desk creates a paper) wait for their own tab by
 * watching the `hidden` attribute this file toggles, with a
 * MutationObserver. That contract is one-way and deliberately so: they
 * observe an attribute the shell was already setting, and the shell has
 * no idea they are watching. faith-constellations.js documents why it
 * has to be a MutationObserver and not a ResizeObserver.
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

  // Derived from the markup rather than hard-coded, so adding an eighth
  // workspace is a template change and not a template change plus a
  // list here that someone forgets. Order matters: it is the arrow-key
  // order and index 0 is the fallback for an unknown hash.
  const MODES = tabs.map((t) => t.getAttribute("data-research-mode"));

  /* ── Reading the address ─────────────────────────────────────── */

  // "#compare&a=x&sel=y" -> "compare". A bare "#ask" has no "&" and so
  // returns itself, which is why every hash written before this file
  // learned about tails still resolves.
  function modeOf(hash) {
    return String(hash || "").replace(/^#/, "").split("&")[0];
  }

  // Everything from the first "&" onward, separator included, or "".
  // Never parsed here. Handed back to whichever panel wrote it, byte for
  // byte, so that a panel can change its own state grammar without this
  // file being touched.
  function tailOf(hash) {
    const s = String(hash || "").replace(/^#/, "");
    const i = s.indexOf("&");
    return i === -1 ? "" : s.slice(i);
  }

  function hashOfHref(href) {
    const i = String(href || "").indexOf("#");
    return i === -1 ? "" : String(href).slice(i);
  }

  /* ── Remembering what each panel had in the address ──────────── *
   *
   * The problem this solves: a reader builds a comparison, so the
   * address is #compare&a=augustine-of-hippo,jerome&sel=sin. They open
   * the Notebook to check a note. If the shell simply wrote #notebook
   * and, on the way back, simply wrote #compare, the comparison would
   * still be on screen (faith-compare.js holds it in memory) but the
   * address would no longer describe it, so copying the URL out of the
   * bar would share the wrong thing. Silently handing someone a broken
   * link is worse than losing the state outright.
   *
   * So the tail is harvested off the address the instant before it is
   * overwritten, filed under the mode it belonged to, and put back when
   * that mode returns. Harvested from `location.hash` rather than from a
   * variable this file keeps, because the panels write the address
   * themselves and the browser's copy is therefore the only one that is
   * always current. */
  const tails = Object.create(null);

  function harvest(hash) {
    const m = modeOf(hash);
    if (MODES.indexOf(m) >= 0) tails[m] = tailOf(hash);
  }

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
    return target;
  }

  function selectMode(mode, focusTab) {
    // Before anything is overwritten.
    harvest(window.location.hash);
    const target = MODES.indexOf(mode) >= 0 ? mode : MODES[0];
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, "", `#${target}${tails[target] || ""}`);
    }
    showMode(target);
    if (focusTab) {
      const t = tabs[MODES.indexOf(target)];
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
  // anchor, or the back button. replaceState above never fires this, and
  // neither does a panel's own replaceState.
  //
  // oldURL carries the address being left, which is where that panel's
  // tail still is; location.hash is already the new one by the time this
  // runs, so harvesting from it would file the incoming tail under the
  // outgoing mode.
  window.addEventListener("hashchange", (e) => {
    harvest(hashOfHref(e && e.oldURL));
    harvest(window.location.hash);
    showMode(modeOf(window.location.hash));
  });

  /* The Research tools index above the desk (2026-10-24). An Open link whose address is a workspace of THIS page (Compare, Bookmarks,
     Notebook) opens that tab and brings the desk into view, instead of changing a hash the reader cannot see happen. Every other Open
     link is an ordinary navigation to the tool's own page. A reader with no account never loads this file (the template wraps it in
     {{#if @member}}), and feature-gate.js sees these clicks first anyway. */
  const deskTitle = document.getElementById("rx-desk-title");
  document.addEventListener("click", (e) => {
    const a = e.target.closest ? e.target.closest("a.rx-open") : null;
    if (!a || !deskTitle || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    let u;
    try { u = new URL(a.getAttribute("href"), window.location.href); } catch (err) { return; }
    if (u.pathname !== window.location.pathname || MODES.indexOf(modeOf(u.hash)) < 0) return;
    e.preventDefault();
    selectMode(modeOf(u.hash), false);
    deskTitle.scrollIntoView({ block: "start" });
  });

  /* ── Boot ────────────────────────────────────────────────────── *
   *
   * An unknown or absent hash falls through to the first tab rather than
   * showing nothing; showMode() does that clamp itself.
   *
   * A hash that named a real mode is left exactly as it arrived, tail
   * and all, so that a panel reading the address on its own boot sees
   * what was actually shared. An unknown hash is NOT rewritten either:
   * a share payload aimed at some other surface (#c=… , the notebook's
   * constellation format) would otherwise be destroyed by the tab strip
   * on the way past. */
  harvest(window.location.hash);
  showMode(modeOf(window.location.hash));
})();
