/*
 * The reader's contents expand, and the toolbar folds away.
 *
 * Ian, 2026-09-23: the dictionary's expand/collapse/shrink functions, for
 * the reader. A first version put three text buttons in a row of their
 * own inside the toolbar; on works without a witness row the toolbar
 * does not wrap, the row sat inline and crushed the title ("the reader
 * is totally messed up"). This version puts each control where it
 * belongs instead of in a row of its own:
 *
 *   Hide contents         beside Expand contents at the top of the
 *       sidebar (Ian, 2026-10-02: "we lost the hide contents button").
 *       It presses the toolbar's own ☰ (#sbT), so the port keeps its
 *       state. With the toolbar also hidden, "Show contents" waits top
 *       left, as "Show toolbar" does top right.
 *   Expand contents       a quiet button at the top of the contents
 *       sidebar. It lays the outline over the text: one card per
 *       top-level section with its subsections, or one ruled list for a
 *       flat outline, read across in rows. Choosing an entry clicks the
 *       outline's own link (the port navigates) and the overlay closes.
 *   Hide bar              joins the toolbar's view group (Pages, Find,
 *       Aa, theme). It pins the state the port uses when a reader
 *       scrolls down: masthead and toolbar away, the text takes the
 *       screen. "Show toolbar" stays top right. Remembered per browser.
 *
 * Phones and tablets too (Ian, 2026-10-02: "make all of this work on
 * mobile and tablet"). On a phone (html.g-mobile) Hide contents and
 * Expand contents sit at the top of the contents drawer, Hide toolbar
 * is a cell in the Tools drawer (faith-port-read-drawer.js), and hiding
 * takes the thumb bar too; "Show toolbar" waits bottom right, in reach
 * of a thumb. Labels by textContent; outline titles copied as text.
 */
(function () {
  "use strict";

  const html = document.documentElement;
  const app = document.getElementById("app");
  const ph = document.querySelector(".ph");
  const nav = document.getElementById("nav");
  if (!app || !ph || !nav) return;

  const KEY = "fr_read_chrome";
  let barHidden = false;
  try { barHidden = (JSON.parse(window.localStorage.getItem(KEY) || "{}") || {}).bar === true; } catch (e) { /* shown */ }
  const remember = () => {
    try { window.localStorage.setItem(KEY, JSON.stringify({ bar: barHidden })); } catch (e) { /* not remembered */ }
  };

  const mobile = () => html.classList.contains("g-mobile");

  function button(label, cls) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = cls;
    b.textContent = label;
    return b;
  }

  // ── Where the controls go ────────────────────────────────────────
  const ctr = ph.querySelector(".ctr");
  const sidebar = document.querySelector("aside.sidebar");
  const bBar = button("Hide toolbar", "fr-tb-focus");
  bBar.title = "Hide the toolbar";
  if (ctr) ctr.appendChild(bBar);

  /* Ian, 2026-09-23, three more for the bar:
     - Report a problem, out of the Aa menu and beside Tools. The Aa row
       stays for phones, where Tools is hidden and Aa is the one menu on
       screen (see the note on that row in the template); on desktop
       CSS hides it so the choice is made once.
     - Back to top, at the far right.
     - Expand all / Collapse all, over the books, chapters and notes
       faith-reader-folds.js folds. That file owns the state
       (window.FRReaderFolds) and loads deferred, so it is looked up on
       use and the label is set once it has run. */
  // "Report" with " a problem" dropped below 1440px (CSS), where the
  // bar needs the room for the work's title.
  const bReport = button("Report", "fr-tb-report");
  const more = document.createElement("span");
  more.className = "fr-tb-more";
  // No leading space: the button is a flex row with its own gap, and a
  // space as well read "Report  a problem".
  more.textContent = "a problem";
  bReport.appendChild(more);
  bReport.setAttribute("aria-label", "Report a problem");
  bReport.setAttribute("data-report-issue", "");
  bReport.setAttribute("data-feature-gate", "tfr-report");
  bReport.title = "Tell us about a problem with this work: a bad scan, wrong text, a broken link";
  const bTop = button("Top", "fr-tb-top");
  bTop.title = "Back to the top of the work";
  bTop.setAttribute("aria-label", "Back to top");
  const bFolds = button("Collapse all", "fr-tb-folds");
  bFolds.title = "Fold or unfold every book and chapter";
  if (ctr) ctr.append(bReport, bTop, bFolds);

  const scroller = document.getElementById("scroll");
  /* The reader renders pages around the one in view and loads earlier
     ones as you scroll up, so scrolling #scroll to 0 lands on the top
     of whatever is loaded (measured: 2085px to 1973px, not to 0). Top
     goes to the work's first page through the reader's own jump(), then
     to the very top once that page is the first one on screen. DATA is
     the engine's bare global. */
  function firstPage() {
    try {
      const d = typeof DATA !== "undefined" ? DATA : null;
      return d && Array.isArray(d.pages) && d.pages[0] ? String(d.pages[0].n) : "";
    } catch (e) { return ""; }
  }
  bTop.addEventListener("click", () => {
    const first = firstPage();
    if (first && typeof window.jump === "function") window.jump(first);
    window.setTimeout(() => {
      const f = document.querySelector("#reading .folio");
      if (scroller && (!first || (f && String(f.dataset.page) === first))) scroller.scrollTo({ top: 0 });
    }, 350);
  });

  const folds = () => window.FRReaderFolds;
  function paintFolds() {
    const f = folds();
    const open = !f || f.anyOpen();
    bFolds.textContent = open ? "Collapse all" : "Expand all";
  }
  bFolds.addEventListener("click", () => {
    const f = folds();
    if (!f) return;
    f.setAll(!f.anyOpen());
    paintFolds();
  });
  document.addEventListener("fr-folds-change", paintFolds);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", paintFolds);
  else paintFolds();

  /* The search glyph. The port writes "⌕", whose side bearings in the
     reading face sit it left of centre and low in a square box; a drawn
     lens centres exactly. The port never rewrites the label. */
  function lens() {
    const rs = document.getElementById("rsBtn");
    if (!rs || rs.querySelector(".fr-tb-lens")) return Boolean(rs);
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("width", "15");
    svg.setAttribute("height", "15");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", "fr-tb-lens");
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", "6.75");
    c.setAttribute("cy", "6.75");
    c.setAttribute("r", "4.75");
    const l = document.createElementNS(NS, "path");
    l.setAttribute("d", "M10.25 10.25 14 14");
    [c, l].forEach((n) => {
      n.setAttribute("fill", "none");
      n.setAttribute("stroke", "currentColor");
      n.setAttribute("stroke-width", "1.5");
      n.setAttribute("stroke-linecap", "round");
      svg.appendChild(n);
    });
    rs.replaceChildren(svg);
    return true;
  }
  // read-tools.js, which builds #rsBtn, is injected by reader-core.js
  // after this file runs; wait for it.
  if (!lens() && ctr) {
    const mo = new MutationObserver(() => { if (lens()) mo.disconnect(); });
    mo.observe(ctr, { childList: true });
    window.setTimeout(() => mo.disconnect(), 30000);
  }
  const sbT = document.getElementById("sbT");
  const bHide = button("Hide contents", "fr-read-fold");
  bHide.hidden = !sbT;
  const bExpand = button("Expand contents", "fr-read-fold");
  bExpand.setAttribute("aria-controls", "fr-read-toc");
  if (sidebar) {
    const actions = document.createElement("div");
    actions.className = "fr-sb-actions";
    actions.append(bHide, bExpand);
    const navEl = sidebar.querySelector("#nav");
    if (navEl) navEl.before(actions);
    else sidebar.prepend(actions);
  }

  const restore = button("Show toolbar", "fr-read-restore");
  restore.hidden = true;
  document.body.appendChild(restore);
  const restoreSb = button("Show contents", "fr-read-restore fr-read-restore-sb");
  restoreSb.hidden = true;
  document.body.appendChild(restoreSb);

  // ── Hide toolbar: the port's scrolled-away state, pinned ─────────
  /* The band of chrome is measured with the rail in it (boot and early
     scripts). A page that loads with the toolbar hidden measures the
     rail at 0, so showing the toolbar again put the reader's bar under
     the rail (Ian, 2026-10-02: "it doesn't fully show"). Measure again
     whenever the toolbar comes back. */
  function measureHead() {
    const h = document.querySelector("header.site-header, header.site, .site-header");
    if (!h || !h.offsetHeight) return;
    const rail = document.querySelector(".tfr-rail");
    const railPx = rail && rail.offsetHeight ? rail.offsetHeight : 0;
    html.style.setProperty("--mo-mast", `${h.offsetHeight}px`);
    html.style.setProperty("--mo-head", `${h.offsetHeight + railPx}px`);
  }
  function paintBar() {
    const was = html.classList.contains("fr-bar-hidden");
    html.classList.toggle("fr-bar-hidden", barHidden);
    restore.hidden = !barHidden;
    // A phone keeps Contents on the thumb bar; no second door needed.
    restoreSb.hidden = !(barHidden && !mobile() && app.classList.contains("nosb"));
    if (was && !barHidden) measureHead();
  }
  bBar.addEventListener("click", () => { barHidden = true; remember(); paintBar(); restore.focus({ preventScroll: true }); });
  restore.addEventListener("click", () => { barHidden = false; remember(); paintBar(); bBar.focus({ preventScroll: true }); });
  paintBar();

  // ── The page itself never scrolls (owner, 2026-10-13) ────────────
  /* On a desktop the text scrolls in #scroll and the page is one screen
     under fixed chrome (faith-port-reader-skin.css). When anything leaves
     the page taller than the screen (the members' Commonplace tooltip did,
     by 33px), a jump to a section scrolls the page itself, and the sidebar
     and the text slide that far up under the toolbar, Hide contents and
     Expand contents half covered. Put the page back where it belongs. */
  window.addEventListener("scroll", () => {
    if (!mobile() && (window.scrollY || window.pageYOffset)) window.scrollTo(0, 0);
  }, { passive: true });

  // ── Hide contents: the port's ☰, labeled ─────────────────────────
  if (sbT) {
    bHide.addEventListener("click", () => { sbT.click(); });
    restoreSb.addEventListener("click", () => { if (app.classList.contains("nosb")) sbT.click(); });
    new MutationObserver(paintBar).observe(app, { attributes: true, attributeFilter: ["class"] });
  }

  // ── Expand contents: the outline as cards over the text ──────────
  const overlay = document.createElement("div");
  overlay.className = "fr-read-toc";
  overlay.id = "fr-read-toc";
  overlay.hidden = true;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-label", "Contents");
  app.appendChild(overlay);

  function depthOf(node) {
    const m = String(node.className).match(/\bnd(\d+)\b/);
    if (m) return Number(m[1]);
    const v = parseInt(node.style.getPropertyValue("--nav-depth"), 10);
    return Number.isFinite(v) ? v + 1 : 1;
  }

  function build() {
    const nodes = Array.from(nav.querySelectorAll(".nav-node"));
    overlay.replaceChildren();
    const head = document.createElement("div");
    head.className = "fr-read-toc-head";
    const h = document.createElement("h2");
    h.textContent = "Contents";
    const close = button("Shrink contents", "fr-read-fold");
    close.addEventListener("click", () => setExpanded(false));
    head.append(h, close);
    overlay.appendChild(head);
    if (!nodes.length) {
      const p = document.createElement("p");
      p.className = "fr-read-toc-empty";
      p.textContent = "This work has no outline yet. Use Pages in the sidebar to move through it.";
      overlay.appendChild(p);
      return;
    }
    const depths = nodes.map(depthOf);
    const top = Math.min(...depths);
    const grid = document.createElement("div");
    grid.className = "fr-read-toc-grid";
    // A flat outline (every entry at one level: Irenaeus's 173 chapters)
    // is a ruled list across the width, as the dictionary's expanded
    // index is, rather than 173 cards of one line each.
    if (depths.every((d) => d === top)) {
      grid.classList.add("fr-read-toc-flat");
      nodes.forEach((node) => {
        const link = node.querySelector("a.nn-t") || node.querySelector("a");
        const title = ((link || node).textContent || "").trim();
        if (!title) return;
        const entry = button(title, "fr-read-toc-entry");
        if (node.classList.contains("on")) entry.classList.add("is-current");
        entry.addEventListener("click", () => { setExpanded(false); (link || node).click(); });
        grid.appendChild(entry);
      });
      overlay.appendChild(grid);
      return;
    }
    /* FULL PAGE (Ian, 2026-09-23: "Expand contents should go full page,
       not whatever this is"). A work with one or two top-level parts
       ("Opera") made one card holding everything, a narrow column down
       the left of an empty screen. The cards are now one level down in
       that case, and the top-level parts become headings across the
       width, so the whole outline spreads over the page. */
    const tops = depths.filter((d) => d === top).length;
    const deeper = depths.some((d) => d > top);
    const cardDepth = tops <= 2 && deeper ? top + 1 : top;
    let card = null;
    let list = null;
    nodes.forEach((node) => {
      const link = node.querySelector("a.nn-t") || node.querySelector("a");
      const title = ((link || node).textContent || "").trim();
      if (!title) return;
      const d = depthOf(node);
      const entry = button(title, "fr-read-toc-entry");
      if (node.classList.contains("on")) entry.classList.add("is-current");
      entry.addEventListener("click", () => {
        setExpanded(false);
        (link || node).click();
      });
      if (d < cardDepth) {
        entry.classList.add("fr-read-toc-part");
        grid.appendChild(entry);
        card = null;
        list = null;
      } else if (d === cardDepth || !card) {
        card = document.createElement("section");
        card.className = "fr-read-toc-card";
        entry.classList.add("fr-read-toc-title");
        card.appendChild(entry);
        list = null;
        grid.appendChild(card);
      } else {
        if (!list) { list = document.createElement("ul"); card.appendChild(list); }
        const li = document.createElement("li");
        li.style.paddingLeft = `${Math.max(0, d - cardDepth - 1) * 14}px`;
        li.appendChild(entry);
        list.appendChild(li);
      }
    });
    overlay.appendChild(grid);
  }

  function setExpanded(on) {
    const want = Boolean(on);
    if (want) build();
    // On a phone the contents are a drawer over the text: close it so
    // the expanded outline is what the reader sees.
    if (want && mobile() && sbT && !app.classList.contains("nosb")) sbT.click();
    overlay.hidden = !want;
    html.classList.toggle("fr-toc-open", want);
    bExpand.textContent = want ? "Shrink contents" : "Expand contents";
    bExpand.setAttribute("aria-expanded", String(want));
    if (want) {
      const current = overlay.querySelector(".is-current") || overlay.querySelector(".fr-read-toc-entry");
      if (current) current.scrollIntoView({ block: "center" });
    }
  }
  bExpand.addEventListener("click", () => setExpanded(overlay.hidden));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.hidden) { setExpanded(false); bExpand.focus({ preventScroll: true }); }
  });
  setExpanded(false);
})();
