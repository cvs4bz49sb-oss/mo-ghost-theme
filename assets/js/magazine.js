/*
 * Magazine view for the journal and ebook readers (Ian, 2026-11-11).
 *
 * The print-journal flipbook from the redesign artifact, without its
 * toggles, set the way the printed journal is (Ian's photos of Issue
 * 008, 2026-11-11): an essay opens on a single full-width column with
 * its title a third of the way down, then runs in two columns; spaced
 * paragraphs, a plain drop cap, folios in the outer corner, no running
 * heads, and the bio under the emblem in capitals. Turn pages by
 * dragging a corner, clicking a page edge, or with the arrow keys. Every reader page carries the same markup (.rd-cover,
 * h1.rd-title, section.content-section > h2.section-title +
 * p.essay-author + body), so one script serves every issue and ebook.
 *
 * Pages are typeset once at the size the book is shown (container units
 * scale the type with the page) and again if that size changes. The
 * flip itself is page-flip 2.0.7 (MIT), vendored in js/vendor because
 * the reader CSP allows same-origin scripts only; it loads on first open.
 */
(function () {
  "use strict";

  const me = document.currentScript;
  const FLIP_SRC = me && me.getAttribute("data-flip");
  const EMBLEM = me && me.getAttribute("data-emblem");
  const sections = Array.prototype.slice.call(document.querySelectorAll("article.rd-text section.content-section"))
    .filter((s) => { return s.querySelector("h2.section-title"); });
  if (!FLIP_SRC || !sections.length) return;

  const TRIM_W = 540;
  const TRIM_H = 701;
  const titleEl = document.querySelector("h1.rd-title");
  const BOOK_TITLE = titleEl ? titleEl.textContent.trim() : "";

  const JOURNAL = /^Issue\s/i.test(BOOK_TITLE);
  const BOARD =
    '<div class="mp-ic-board">' +
      '<p class="mp-ic-board-h">The Mere Orthodoxy Editorial Board</p>' +
      "<p>Leadership Team</p>" +
      "<p><i>Mark Kremer: Publisher, Jake Meador: Editor-in-chief, Ian Harber: Director of Communications</i></p>" +
      "<p>Editorial Board</p>" +
      "<p><i>Jake Meador (Editor-in-Chief), Nadya Williams (Books Editor), Matthew Loftus, Susannah Black Roberts, Samuel James, Kirsten Sanders, Tessa Carman, Matthew Lee Anderson (Founding Editor)</i></p>" +
      '<p class="mp-ic-pub"><i>Mere Orthodoxy is a publication of the Institute for Christianity and Common Life based at 2040 South St, Lincoln NE, 68502. Learn more about supporting our work at <span class="mp-ic-url">mereorthodoxy.com/give</span></i></p>' +
    "</div>";
  const ELIOT =
    '<div class="mp-eliot-in"><p class="mp-eliot-by">T.S. Eliot</p>' +
    "<p class=\"mp-eliot-q\">I confess, however, that I am not myself very much concerned with the question of influence, or with those publicists who have impressed their names upon the public by catching the morning tide and rowing very fast in the direction in which the current was flowing; but rather that there should always be a few writers preoccupied in penetrating to the core of the matter, in trying to arrive at the truth and to set it forth, without too much hope, without ambition to alter the immediate course of affairs, and without being downcast or defeated when nothing appears to ensue.</p></div>";

  // ── Doors: a button on the title page and one in the reader bar ────
  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z"/><path d="M12 6.5v13"/></svg>';
  const actions = document.querySelector(".rd-title-page .rd-actions");
  if (actions) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "rd-cta";
    b.setAttribute("data-mag-open", "");
    b.textContent = "Magazine view";
    const cont = actions.querySelector("#rdContinue");
    actions.insertBefore(b, cont ? cont.nextSibling : null);
  }
  const tools = document.querySelector(".rd-bar .rd-tools");
  if (tools) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "rd-btn mag-door";
    b.setAttribute("data-mag-open", "");
    b.setAttribute("aria-label", "Magazine view");
    b.title = "Magazine view";
    b.innerHTML = ICON;
    tools.insertBefore(b, tools.firstChild);
  }

  // ── The overlay ─────────────────────────────────────────────────────
  const mag = document.createElement("div");
  mag.className = "mag";
  mag.id = "mag";
  mag.hidden = true;
  mag.setAttribute("role", "dialog");
  mag.setAttribute("aria-modal", "true");
  mag.setAttribute("aria-label", `Magazine view: ${BOOK_TITLE}`);
  const touch = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  mag.innerHTML =
    '<button type="button" class="mag-close" data-mag-close aria-label="Close magazine view">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
    '<div class="mag-app">' +
      '<div class="mag-stage" data-mag-stage></div>' +
      '<div class="mag-bar" role="toolbar" aria-label="Magazine navigation">' +
        '<button type="button" data-mag-prev aria-label="Previous page">&larr; Previous</button>' +
        '<button type="button" data-mag-toc>Contents</button>' +
        '<span class="mag-where" data-mag-where aria-live="polite">Cover</span>' +
        '<button type="button" data-mag-next aria-label="Next page">Next &rarr;</button>' +
      "</div>" +
      `<p class="mag-hint">${touch ? "Swipe, or tap a page edge, to turn the page." : "Drag a page corner, click a page edge, or use the arrow keys."}</p>` +
    "</div>" +
    '<p class="mag-loading" data-mag-loading>Setting the pages</p>';
  document.body.appendChild(mag);

  const stage = mag.querySelector("[data-mag-stage]");
  const whereEl = mag.querySelector("[data-mag-where]");
  const loadingEl = mag.querySelector("[data-mag-loading]");

  let flip = null;
  let pages = [];
  let tocIdx = 1;
  let MW = 0;
  let opener = null;
  let building = null;

  function loadFlip() {
    if (window.St && window.St.PageFlip) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = FLIP_SRC;
      s.onload = () => { resolve(); };
      s.onerror = () => { reject(new Error("page-flip did not load")); };
      document.head.appendChild(s);
    });
  }

  // ── Typesetting ─────────────────────────────────────────────────────
  // Two-column pages overflow sideways, into a third column.
  function over(pc) { return pc.scrollHeight > pc.clientHeight + 1 || pc.scrollWidth > pc.clientWidth + 1; }

  const VOID = /^(br|img|hr|wbr|input|source)$/i;
  // A word is a run of text and the tags touching it, split at spaces.
  function words(html) {
    const parts = html.match(/<[^>]*>|[^<\s]+|\s+/g) || [];
    const out = [];
    let cur = "";
    parts.forEach((p) => {
      if (/^\s+$/.test(p)) { if (cur) { out.push(cur); cur = ""; } } else cur += p;
    });
    if (cur) out.push(cur);
    return out;
  }
  // The inline tags still open at the end of a head, so the tail can
  // reopen them (an <em> split across pages stays italic on both).
  function openTags(html) {
    const stack = [];
    (html.match(/<[^>]*>/g) || []).forEach((t) => {
      const m = /^<\s*(\/)?\s*([a-z0-9]+)/i.exec(t);
      if (!m || VOID.test(m[2]) || /\/>$/.test(t)) return;
      if (m[1]) {
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i].name === m[2].toLowerCase()) { stack.splice(i, 1); break; }
        }
      } else stack.push({ name: m[2].toLowerCase(), tag: t });
    });
    return stack.map((s) => { return s.tag; }).join("");
  }

  // Put as much of the text block b as fits at the foot of pc. Returns
  // the rest (a continuation of b), or b itself when too little fits.
  function splitText(pc, b) {
    const toks = words(b.innerHTML);
    if (toks.length < 8) return b;
    const piece = b.cloneNode(false);
    pc.appendChild(piece);
    let lo = 0;
    let hi = toks.length - 1;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      piece.innerHTML = toks.slice(0, mid).join(" ");
      if (over(pc)) hi = mid - 1; else lo = mid;
    }
    // Carry at least three words, so the next page never opens on a
    // stray word or two.
    lo = Math.min(lo, toks.length - 3);
    if (lo < 4) { piece.remove(); return b; }
    const head = toks.slice(0, lo).join(" ");
    piece.innerHTML = head;
    piece.classList.add("mag-split");
    const rest = b.cloneNode(false);
    rest.removeAttribute("id");
    rest.innerHTML = openTags(head) + toks.slice(lo).join(" ");
    rest.classList.add("mag-cont");
    rest.classList.remove("mag-dc");
    return rest;
  }

  // A list or a block quotation splits between its children; a child
  // that is itself too long splits at a word.
  function splitBox(pc, b) {
    const kids = Array.prototype.slice.call(b.children);
    if (!kids.length) return splitText(pc, b);
    const shell = b.cloneNode(false);
    pc.appendChild(shell);
    let i = 0;
    for (; i < kids.length; i++) {
      shell.appendChild(kids[i]);
      if (over(pc)) { shell.removeChild(kids[i]); break; }
    }
    let carry = null;
    if (i < kids.length && /^(P|LI)$/.test(kids[i].tagName)) {
      const r = splitText(shell, kids[i]);
      if (r !== kids[i]) carry = r;
    }
    if (!shell.children.length) { shell.remove(); return b; }
    const rest = b.cloneNode(false);
    rest.removeAttribute("id");
    if (b.tagName === "OL") rest.setAttribute("start", String((parseInt(b.getAttribute("start"), 10) || 1) + shell.children.length - (carry ? 1 : 0)));
    if (carry) rest.appendChild(carry);
    kids.slice(i + (carry ? 1 : 0)).forEach((k) => { rest.appendChild(k); });
    if (!rest.children.length) return null;
    return rest;
  }

  function split(pc, b) {
    if (/^(P|H5|H6)$/.test(b.tagName)) return splitText(pc, b);
    if (/^(BLOCKQUOTE|UL|OL)$/.test(b.tagName)) return splitBox(pc, b);
    return b;
  }

  // Fill pc from the front of the queue. Returns when the page is full.
  function fill(pc, queue) {
    while (queue.length) {
      const b = queue[0];
      pc.appendChild(b);
      if (!over(pc)) { queue.shift(); continue; }
      pc.removeChild(b);
      const rest = split(pc, b);
      if (rest === null) queue.shift();
      else if (rest !== b) queue[0] = rest;
      else if (!pc.querySelector(".mag-b, .mag-split")) { pc.appendChild(b); queue.shift(); }
      break;
    }
    // A heading never ends a page.
    let last = pc.lastElementChild;
    while (queue.length && last && /^H[3-6]$/.test(last.tagName) && pc.children.length > 1) {
      queue.unshift(last);
      pc.removeChild(last);
      last = pc.lastElementChild;
    }
  }

  // The essay body as page blocks: links become plain text (they cannot
  // be followed from inside a turning page) and reader furniture goes.
  function blocksOf(section) {
    const out = [];
    Array.prototype.forEach.call(section.children, (el) => {
      if (el.matches("h2.section-title, p.essay-author, p.rd-essay-n, .rd-next, .kg-embed-card, iframe, script")) return;
      const c = el.cloneNode(true);
      c.querySelectorAll("a").forEach((a) => {
        const s = document.createElement("span");
        s.innerHTML = a.innerHTML;
        a.replaceWith(s);
      });
      c.querySelectorAll("[id]").forEach((n) => { n.removeAttribute("id"); });
      c.removeAttribute("id");
      c.querySelectorAll("img").forEach((img) => { img.loading = "eager"; img.removeAttribute("srcset"); img.removeAttribute("sizes"); });
      if (c.tagName === "P" && !c.textContent.trim() && !c.querySelector("img")) return;
      c.classList.add("mag-b");
      if (c.matches("p.contributor-bio")) {
        // The bio sits under the emblem, as in print, and never splits.
        const prev = out[out.length - 1];
        if (prev && prev.classList.contains("mp-bio")) {
          c.classList.remove("mag-b");
          prev.appendChild(c);
          return;
        }
        const bio = document.createElement("div");
        bio.className = "mp-bio mag-b";
        if (EMBLEM) bio.innerHTML = `<img class="mp-emblem" src="${EMBLEM}" alt="">`;
        c.classList.remove("mag-b");
        bio.appendChild(c);
        out.push(bio);
        return;
      }
      out.push(c);
    });
    const first = out.find((b) => { return b.tagName === "P" && !b.className.match(/contributor-bio|essay-heading|callout/) && b.textContent.trim().length > 120; });
    if (first && /^[“"'‘A-Za-z]/.test(first.textContent.trim())) first.classList.add("mag-dc");
    return out;
  }

  function esc(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function page(book, cls, inner) {
    const i = pages.length;
    const el = document.createElement("div");
    el.className = `mp ${i % 2 === 1 ? "mp-l" : "mp-r"} ${cls}`;
    el.innerHTML = `<div class="mp-in">${inner}</div>`;
    book.appendChild(el);
    pages.push({ el, essay: null });
    return el;
  }
  function furniture(el) {
    el.querySelector(".mp-in").insertAdjacentHTML("beforeend", `<div class="mp-fo">${pages.length}</div>`);
  }

  function build(book) {
    pages = [];
    const toc = [];

    // Cover: the reader's own cover, an image or the drawn ebook cover.
    const cover = document.querySelector(".rd-title-page .rd-cover");
    const cv = page(book, "mp-cover", "");
    const art = cover && cover.firstElementChild ? cover.firstElementChild.cloneNode(true) : null;
    if (art) {
      art.removeAttribute("role");
      art.setAttribute("aria-hidden", "true");
      cv.querySelector(".mp-in").appendChild(art);
    } else {
      cv.querySelector(".mp-in").innerHTML = `<div class="mp-mast">Mere<br>Orthodoxy</div><div class="mp-cover-t">${esc(BOOK_TITLE)}</div>`;
    }

    // Inside cover, after the printed journal: CONTENTS between
    // hairlines, one line per essay (page number, then title and
    // author in italic), the editorial board under it, and the Eliot
    // epigraph on the facing page. Ebooks get the contents alone.
    tocIdx = pages.length;
    const tp = page(book, "mp-ic",
      `<div class="mp-pc"><h2 class="mp-ic-h">Contents</h2><ol class="mp-ic-list">${
        sections.map((s, n) => {
          const t = s.querySelector("h2.section-title").textContent.trim();
          const a = (s.querySelector("p.essay-author") || { textContent: "" }).textContent.replace(/^\s*By\s+/i, "").trim();
          return `<li><button type="button" data-mag-go="${n}"><span class="mp-ic-pg" data-mag-pg="${n}"></span><span class="mp-ic-t">${esc(t)}${a ? ` <span class="mp-ic-by">by</span> ${esc(a)}` : ""}</span></button></li>`;
        }).join("")
      }</ol>${JOURNAL ? BOARD : ""}</div>`);
    let tpc = tp.querySelector(".mp-pc");
    // The board gives way first when the contents run long.
    if (over(tpc) && tpc.querySelector(".mp-ic-board")) tpc.querySelector(".mp-ic-board").remove();
    let guardT = 0;
    while (over(tpc) && guardT++ < 4) {
      const list = tpc.querySelector(".mp-ic-list");
      const np = page(book, "mp-ic mp-ic--more", '<div class="mp-pc"><ol class="mp-ic-list"></ol></div>');
      const nl = np.querySelector(".mp-ic-list");
      while (over(tpc) && list.children.length > 1) nl.insertBefore(list.lastElementChild, nl.firstChild);
      tpc = np.querySelector(".mp-pc");
    }
    if (JOURNAL && pages.length % 2 === 0) page(book, "mp-eliot", ELIOT);

    sections.forEach((s, n) => {
      const title = s.querySelector("h2.section-title").textContent.trim();
      const by = s.querySelector("p.essay-author");
      const queue = blocksOf(s);
      const op = page(book, "mp-op",
        `<div class="mp-pc"><h2 class="mp-title">${esc(title)}</h2>${by ? `<p class="mp-by">${esc(by.textContent.replace(/^\s*By\s+/i, "").trim())}</p>` : ""}</div>`);
      furniture(op);
      pages[pages.length - 1].essay = n;
      toc[n] = pages.length - 1;
      fill(op.querySelector(".mp-pc"), queue);
      let guard = 0;
      while (queue.length && guard++ < 400) {
        const ct = page(book, "mp-ct", '<div class="mp-pc"></div>');
        furniture(ct);
        pages[pages.length - 1].essay = n;
        const before = queue.length;
        const head = queue[0];
        fill(ct.querySelector(".mp-pc"), queue);
        if (queue.length === before && queue[0] === head) break;
      }
      // A bio that did not fit under the essay sits alone on its page:
      // center it there.
      const tail = pages[pages.length - 1].el;
      const tailPc = tail.querySelector(".mp-pc");
      if (tailPc.children.length === 1 && tailPc.firstElementChild.classList.contains("mp-bio")) tail.classList.add("mp-solo");
    });

    // The back cover closes the book on a left-hand page.
    if (pages.length % 2 === 0) page(book, "mp-blank", '<div class="mp-orn" aria-hidden="true">❦</div>');
    page(book, "mp-back", `<div class="mp-backin"><div class="mp-mast">Mere<br>Orthodoxy</div><div class="mp-est">Est. MMV</div><div class="mp-url">mereorthodoxy.com</div></div>`);

    book.querySelectorAll("[data-mag-pg]").forEach((el) => {
      const i = toc[+el.getAttribute("data-mag-pg")];
      el.textContent = i === undefined ? "" : String(i + 1).padStart(2, "0");
    });
    book.querySelectorAll("[data-mag-go]").forEach((el) => {
      el.setAttribute("data-mag-idx", String(toc[+el.getAttribute("data-mag-go")]));
    });
  }

  function update(i) {
    const last = pages.length - 1;
    let label;
    if (i === 0) label = "Cover";
    else if (i === last) label = "Back cover";
    else {
      const portrait = flip && flip.getOrientation && flip.getOrientation() === "portrait";
      const idx = portrait ? [i] : (i % 2 === 1 ? [i, i + 1] : [i - 1, i]);
      label = idx.length > 1 && idx[1] < last ? `Pages ${idx[0] + 1}–${idx[1] + 1}` : `Page ${idx[0] + 1}`;
    }
    whereEl.textContent = label;
  }

  function shownWidth() {
    try { return Math.round(flip.getRender().getRect().pageWidth); } catch (_) { return 0; }
  }

  // Best guess at the page width before the flip exists, so the first
  // typesetting is usually the only one.
  function guessWidth() {
    const w = stage.getBoundingClientRect().width;
    const h = w / 2 * TRIM_H / TRIM_W;
    return Math.round(w < 700 || h < 220 ? w : w / 2);
  }

  function setup(at) {
    try { if (flip) flip.destroy(); } catch (_) { /* already gone */ }
    flip = null;
    stage.innerHTML = "";
    const book = document.createElement("div");
    book.className = "mag-book mag-measure";
    book.lang = document.documentElement.lang || "en";
    book.style.setProperty("--mw", `${MW}px`);
    stage.appendChild(book);
    build(book);
    book.classList.remove("mag-measure");
    pages[0].el.setAttribute("data-density", "hard");
    pages[pages.length - 1].el.setAttribute("data-density", "hard");
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    flip = new window.St.PageFlip(book, {
      width: TRIM_W, height: TRIM_H, size: "stretch",
      minWidth: 240, maxWidth: 1400, minHeight: 312, maxHeight: 1820,
      showCover: true, maxShadowOpacity: 0.45, mobileScrollSupport: false,
      flippingTime: reduce ? 1 : 800, usePortrait: true, startPage: 0,
      clickEventForward: true, useMouseEvents: true, swipeDistance: 30, showPageCorners: true,
    });
    flip.loadFromHTML(pages.map((p) => { return p.el; }));
    flip.on("flip", (e) => { update(e.data); });
    flip.on("changeOrientation", () => { update(flip.getCurrentPageIndex()); });
    if (at > 0) flip.turnToPage(Math.min(at, pages.length - 1));
    update(flip.getCurrentPageIndex());
  }

  function typeset(at) {
    loadingEl.hidden = false;
    mag.classList.add("is-setting");
    const fonts = document.fonts
      ? Promise.all(['20px "EB Garamond"', 'italic 20px "EB Garamond"', '500 20px "EB Garamond"', 'italic 20px "IM Fell Great Primer"', '20px "IM Fell Great Primer"']
        .map((f) => { return document.fonts.load(f).catch(() => {}); })).then(() => { return document.fonts.ready; })
      : Promise.resolve();
    return Promise.all([loadFlip(), fonts]).then(() => {
      // Let the overlay lay out before measuring it. A timer, not a
      // frame: frames stop in a background tab and the build would wait.
      return new Promise((r) => { setTimeout(r, 30); });
    }).then(() => {
      if (!MW) MW = guessWidth();
      setup(at);
      // Line breaks do not scale exactly, so set again at the real size.
      const w = shownWidth();
      if (w >= 200 && Math.abs(w - MW) > 2) { MW = w; setup(at); }
    }).finally(() => {
      loadingEl.hidden = true;
      mag.classList.remove("is-setting");
    });
  }

  function open(trigger) {
    opener = trigger || null;
    mag.hidden = false;
    document.documentElement.classList.add("mag-open");
    if (!building) building = typeset(0).catch(() => {
      loadingEl.hidden = false;
      loadingEl.textContent = "The magazine view could not load. Close it and try again.";
      building = null;
    });
    else if (flip) {
      const w = shownWidth();
      if (w >= 200 && Math.abs(w - MW) > 2) { MW = w; building = typeset(flip.getCurrentPageIndex()); }
    }
    mag.querySelector("[data-mag-close]").focus();
  }
  function close() {
    mag.hidden = true;
    document.documentElement.classList.remove("mag-open");
    if (opener && opener.focus) opener.focus();
  }
  function go(i) {
    if (!flip || isNaN(i)) return;
    const cur = flip.getCurrentPageIndex();
    if (Math.abs(i - cur) <= 2) flip.flip(i); else { flip.turnToPage(i); update(flip.getCurrentPageIndex()); }
  }

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-mag-open]");
    if (t) { e.preventDefault(); open(t); }
  });
  mag.querySelector("[data-mag-close]").addEventListener("click", close);
  mag.querySelector("[data-mag-prev]").addEventListener("click", () => { if (flip) flip.flipPrev(); });
  mag.querySelector("[data-mag-next]").addEventListener("click", () => { if (flip) flip.flipNext(); });
  mag.querySelector("[data-mag-toc]").addEventListener("click", () => { go(tocIdx); });
  // Capture phase: a contents line must jump before page-flip reads the
  // click as a page turn.
  stage.addEventListener("click", (e) => {
    const g = e.target.closest("[data-mag-idx]");
    if (g) { e.stopPropagation(); go(+g.getAttribute("data-mag-idx")); }
  }, true);
  document.addEventListener("keydown", (e) => {
    if (mag.hidden) return;
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowRight" && flip) { e.preventDefault(); flip.flipNext(); }
    else if (e.key === "ArrowLeft" && flip) { e.preventDefault(); flip.flipPrev(); }
    else if (e.key === "Tab") {
      // Keep focus inside the dialog.
      const f = Array.prototype.slice.call(mag.querySelectorAll("button:not([disabled])")).filter((b) => { return b.offsetParent; });
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  let refitT;
  window.addEventListener("resize", () => {
    clearTimeout(refitT);
    refitT = setTimeout(() => {
      if (mag.hidden || !flip) return;
      const w = shownWidth();
      if (w >= 200 && Math.abs(w - MW) > 2) { MW = w; building = typeset(flip.getCurrentPageIndex()); }
    }, 400);
  });
})();
