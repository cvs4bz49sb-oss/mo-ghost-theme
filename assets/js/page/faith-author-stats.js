/*
 * The author room's numbers, as boxes.
 *
 * Ian, 2026-09-23: "Some thin-line boxes? Use the whole width." The port
 * renders an author's numbers as one run-on line:
 *
 *   <div class="stats"><b>969</b> works · <b>7,824</b> pages ·
 *     <b>40,505</b> Scripture citations · <span data-author-church>…</span>
 *     · <a>Explore citation map</a> · <a>Compare with other authors</a></div>
 *
 * CSS cannot box a count and the words after it when the words are bare
 * text, so this regroups them: each <b> and its label becomes a stat box,
 * the tradition becomes a box of its own, and the links go on a line
 * underneath. The styling is in faith-port-surfaces.css.
 *
 * THE PORT'S NODES ARE MOVED, NEVER COPIED OR REBUILT. The <b>, the
 * tradition <span> and the links are the same elements the port made, so
 * anything that finds them later (faith-author-curated.js fills in the
 * tradition after load) still finds them and still writes into them. The
 * .stats wrapper keeps its class for the same reason. Only the "·"
 * separators, which have no meaning inside boxes, are dropped.
 *
 * The port re-renders the room when the reader moves to another author
 * without a page load, so a MutationObserver re-applies this to each new
 * .stats. "Done" is read from the boxes being there, not from a flag on
 * the element: if the port rewrites the line inside the same .stats (to
 * update a count, say), a flag would survive the rewrite and block the
 * re-box, and the run-on line would come back.
 * Text is only ever moved or assigned with textContent: no HTML is parsed.
 */
(function () {
  "use strict";

  function regroup(stats) {
    if (!stats || stats.querySelector(":scope > .ar-stats")) return;
    // Nothing to box until the port has written its numbers in.
    if (!stats.querySelector("b")) return;

    const grid = document.createElement("div");
    grid.className = "ar-stats";
    const links = document.createElement("div");
    links.className = "ar-links";
    let open = null; // the box waiting for its label

    Array.from(stats.childNodes).forEach((node) => {
      if (node.nodeType === 1 && node.tagName === "B") {
        open = document.createElement("div");
        open.className = "ar-stat";
        const label = document.createElement("span");
        open.append(node, label);
        grid.appendChild(open);
        return;
      }
      if (node.nodeType === 3) {
        const words = node.nodeValue.replace(/[·\s]+/g, " ").trim();
        const label = open && open.lastElementChild;
        if (words && label && !label.textContent) label.textContent = words;
        node.remove();
        return;
      }
      if (node.nodeType === 1 && node.matches("[data-author-church]")) {
        const box = document.createElement("div");
        box.className = "ar-stat ar-stat--word";
        const value = document.createElement("b");
        const label = document.createElement("span");
        label.textContent = "Tradition";
        value.appendChild(node);
        box.append(value, label);
        grid.appendChild(box);
        open = null;
        return;
      }
      if (node.nodeType === 1 && node.tagName === "A") {
        links.appendChild(node);
        open = null;
        return;
      }
      // Anything else the port adds later is kept, after the boxes.
      if (node.nodeType === 1) links.appendChild(node);
    });

    stats.textContent = "";
    stats.appendChild(grid);
    if (links.childNodes.length) stats.appendChild(links);
  }

  /* A WORK's page (/author/#w/<id>) is the same engine in another
     view, and its head is a run of loose siblings: title, author line,
     cover, numbers. They are gathered into one panel (moved, not copied:
     #wcover is filled after load and is found by its id wherever it
     sits), and the numbers are boxed as on the author's page. Added
     2026-09-23: "do the same for... whatever page type this is too". */
  function gatherWorkHead(main) {
    if (!main || main.querySelector(":scope > .ar-work-head")) return;
    const headline = main.querySelector(":scope > .headline");
    const stats = main.querySelector(":scope > .stats");
    if (!headline || !stats) return;
    const panel = document.createElement("div");
    panel.className = "ar-work-head";
    headline.before(panel);
    ["headline", "deck"].forEach((cls) => {
      const el = main.querySelector(`:scope > .${cls}`);
      if (el) panel.appendChild(el);
    });
    const cover = main.querySelector(":scope > #wcover");
    if (cover) panel.appendChild(cover);
    panel.appendChild(stats);
  }

  /* Ian, 2026-09-23: 'change all "Read about [author]" to just "About
     [author]"'. The port writes the summary; only its text changes. */
  function aboutLabel(summary) {
    const t = summary.textContent;
    if (/^Read about /.test(t)) summary.textContent = t.replace(/^Read about /, "About ");
  }

  /* The directory's note described the old counts. They now include
     every work the library holds (faith-room-counts.js), so the note
     says so. The port rewrites it on every paint; this follows. */
  function orderNote() {
    const note = document.getElementById("author-order-note");
    if (!note) return;
    const target = note.querySelector("p") || note;
    const t = target.textContent;
    const fixed = t.replace("Counts are the works each author has in the research rooms", "Counts are every work the library holds by each author");
    if (fixed !== t) target.textContent = fixed;
  }

  /* The port writes "(1 works)" in an author's "Also on" line. */
  function oneWork() {
    document.querySelectorAll(".rx-editions a").forEach((a) => {
      const t = a.textContent;
      if (/\(1 works\)$/.test(t)) a.textContent = t.replace(/\(1 works\)$/, "(1 work)");
    });
  }

  function scan() {
    orderNote();
    oneWork();
    document.querySelectorAll(".rx-author-bio > summary").forEach(aboutLabel);
    document.querySelectorAll("main.research-room .rx-profile .stats").forEach(regroup);
    document.querySelectorAll("main.research-work").forEach((main) => {
      gatherWorkHead(main);
      main.querySelectorAll(":scope > .ar-work-head .stats").forEach(regroup);
    });
  }

  const page = document.getElementById("page") || document.body;
  new MutationObserver(scan).observe(page, { childList: true, subtree: true });
  scan();
})();
