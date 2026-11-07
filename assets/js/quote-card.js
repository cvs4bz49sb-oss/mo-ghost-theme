/*
 * Quote cards: a typeset image of a passage, in a brand and a size.
 *
 * The designs are the PhotoCraft masters in MOCA
 * brand/tfr-quote-templates/ (spec.json, build.mjs). This file draws the
 * same layout on a canvas so readers can make one in the browser. Change a
 * color, font or ratio in spec.json and here together, or the web card and
 * the masters drift apart.
 *
 *   MOQuoteCard.render({ brand, size, quote, author, cite }) → Promise<{ url, name, width, height }>
 *   MOQuoteCard.openDialog({ brand, quote, author, cite })   preview, size choice, download, share
 *
 * Brands here: "tfr" and "mo". The podcast brands exist as masters only.
 */
(function () {
  // An element with id="MOQuoteCard" in post content would otherwise pass.
  if (window.MOQuoteCard && typeof window.MOQuoteCard.render === "function") return;

  const SIZES = {
    link:     { w: 1200, h: 630, label: "Link card (1200×630)" },
    x:        { w: 1600, h: 900, label: "X (1600×900)" },
    square:   { w: 1080, h: 1080, label: "Square (1080×1080)" },
    portrait: { w: 1080, h: 1350, label: "Portrait (1080×1350)" },
    story:    { w: 1080, h: 1920, label: "Story (1080×1920)" },
  };

  const L = {
    marginY: 0.09, quoteMax: 0.1, quoteMin: 0.03, quoteLeading: 1.32,
    authorSize: 0.026, authorTracking: 0.12, citeSize: 0.03, citeLeading: 1.3,
    headerGap: 0.05, attribGap: 0.05, footerGap: 0.05, attribLineGap: 0.012,
  };

  // The masters use Source Serif 4; the site serves Source Serif Pro, its
  // predecessor, and the two set the same at these sizes.
  const BRANDS = {
    tfr: {
      paper: "#F8F4EC", ink: "#1C1C1A", accent: "#775B43", muted: "#6E6458",
      quoteFont: '"EB Garamond", Georgia, serif',
      citeFont: '"EB Garamond", Georgia, serif',
      authorFont: '"Source Serif Pro", Georgia, serif',
      header: null,
      footer: { kind: "text", text: "The Faith Received", font: '"IM Fell Great Primer", Georgia, serif', size: 0.042 },
      fonts: ['400 40px "EB Garamond"', 'italic 400 40px "EB Garamond"', '600 40px "Source Serif Pro"', '400 40px "IM Fell Great Primer"'],
    },
    mo: {
      paper: "#F6F3F2", ink: "#2D2927", accent: "#A43A27", muted: "#76695C",
      quoteFont: '"Source Serif Pro", Georgia, serif',
      citeFont: '"IM Fell Great Primer", Georgia, serif',
      authorFont: '"Source Serif Pro", Georgia, serif',
      header: { kind: "rule", w: 0.07, weight: 3, color: "#EE7D51" },
      footer: { kind: "image", src: "/assets/images/quote-card/mo-logo.png", height: 0.062 },
      fonts: ['400 40px "Source Serif Pro"', '600 40px "Source Serif Pro"', 'italic 400 40px "IM Fell Great Primer"'],
    },
  };

  const images = {};
  function loadImage(src) {
    if (!images[src]) {
      images[src] = new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => { delete images[src]; reject(new Error(`image failed: ${src}`)); };
        img.src = src;
      });
    }
    return images[src];
  }

  // A font the page never declared resolves empty and the canvas falls
  // back to Georgia. That is a plainer card, not a broken one.
  function loadFonts(brand) {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all(brand.fonts.map((f) => document.fonts.load(f).catch(() => null)));
  }

  function wrap(x, text, maxW) {
    const words = text.split(/\s+/).filter(Boolean), lines = [];
    let line = "";
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (line && x.measureText(t).width > maxW) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
    return lines;
  }

  function metrics(x) {
    const m = x.measureText("Hg");
    return { ascent: m.fontBoundingBoxAscent || m.actualBoundingBoxAscent, descent: m.fontBoundingBoxDescent || m.actualBoundingBoxDescent };
  }

  // A block of wrapped lines: its height and how to draw it at a top edge.
  function block(x, font, text, maxW, leading, maxLines) {
    x.font = font;
    let lines = wrap(x, text, maxW);
    if (maxLines && lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      let last = lines[maxLines - 1];
      while (last && x.measureText(`${last}…`).width > maxW) last = last.replace(/\s*\S+$/, "");
      lines[maxLines - 1] = `${last.replace(/[,;:.\s]+$/, "")}…`;
    }
    const { ascent, descent } = metrics(x);
    const height = Math.ceil(ascent + (lines.length - 1) * leading + descent);
    return { lines, height, ascent, font, leading };
  }

  function drawBlock(x, b, left, top, color) {
    x.font = b.font; x.fillStyle = color;
    b.lines.forEach((l, i) => x.fillText(l, left, top + b.ascent + i * b.leading));
  }

  function drawTracked(x, text, left, baseline, tracking) {
    let at = left;
    for (const ch of text) { x.fillText(ch, at, baseline); at += x.measureText(ch).width + tracking; }
  }

  // The width drawTracked gives a line: its letters plus the tracking
  // between them.
  function trackedWidth(x, text, tracking) {
    let w = 0;
    for (const ch of text) w += x.measureText(ch).width + tracking;
    return Math.max(0, w - tracking);
  }

  // The card supplies the outer double quotes, so marks inside the passage
  // become single ones. A passage already wrapped in a matched pair loses
  // that pair; one that only opens with a quotation keeps it (“He that
  // followeth me…,” saith the Lord).
  function cleanQuote(q) {
    let t = String(q || "").replace(/\s+/g, " ").trim();
    if (/^[“"]/.test(t) && /[”"]$/.test(t)) {
      // Wrapped only if the marks inside open and close in order (not
      // “A” and “B”).
      const inner = t.slice(1, -1);
      let depth = 0, nested = true;
      for (const ch of inner) {
        if (ch === "“") depth++;
        else if (ch === "”" && --depth < 0) { nested = false; break; }
      }
      if (nested && depth === 0) t = inner;
    }
    return t.replace(/“/g, "‘").replace(/”/g, "’");
  }

  async function render(opts) {
    const brand = BRANDS[opts.brand] || BRANDS.tfr;
    const size = SIZES[opts.size] || SIZES.link;
    const W = size.w, H = size.h, s = Math.min(W, H);
    const mx = Math.round(Math.max(s * 0.1, W * 0.09)), my = Math.round(s * L.marginY), colW = W - 2 * mx;

    const footerImg = brand.footer.kind === "image" ? loadImage(brand.footer.src).catch(() => null) : null;
    await loadFonts(brand);

    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const x = c.getContext("2d");
    x.textBaseline = "alphabetic";
    x.fillStyle = brand.paper; x.fillRect(0, 0, W, H);

    // Footer, on the bottom margin.
    const f = brand.footer;
    let footerH;
    const img = footerImg ? await footerImg : null;
    if (f.kind === "image" && img) {
      footerH = Math.round(s * f.height);
      x.drawImage(img, mx, H - my - footerH, img.naturalWidth * footerH / img.naturalHeight, footerH);
    } else {
      const fs = Math.round(s * (f.size || 0.042));
      x.font = `400 ${fs}px ${f.font || brand.citeFont}`;
      const m = metrics(x);
      footerH = Math.ceil(m.ascent + m.descent);
      x.fillStyle = brand.accent;
      x.fillText(f.text || "Mere Orthodoxy", mx, H - my - m.descent);
    }

    const top = my, bottom = H - my - footerH - Math.round(s * L.footerGap), regionH = bottom - top;
    const h = brand.header;
    const headerH = h ? h.weight : 0, headerGap = h ? Math.round(s * L.headerGap) : 0;

    // Attribution: author in tracked caps, the citation beneath it.
    const attrib = [];
    const author = String(opts.author || "").trim();
    if (author) {
      // block() fits a line untracked, and the tracking widens it, so a
      // byline of two or three writers ran into the right margin. Set it
      // down to three quarters size to fit every name; past that, trim at a
      // word.
      const full = Math.round(s * L.authorSize), text = author.toUpperCase();
      let as = full, ab;
      for (;;) {
        ab = block(x, `600 ${as}px ${brand.authorFont}`, text, colW, as, 1);
        ab.tracking = as * L.authorTracking;
        if (ab.lines[0] === text && trackedWidth(x, text, ab.tracking) <= colW) break;
        if (as <= Math.round(full * 0.75)) break;
        as -= 1;
      }
      ab.caps = true;
      let line = ab.lines[0] || "";
      if (trackedWidth(x, line, ab.tracking) > colW) {
        let t = line.replace(/…$/, "");
        while (t && trackedWidth(x, `${t}…`, ab.tracking) > colW) t = t.replace(/\s*\S+$/, "");
        line = `${t.replace(/[,;:.\s]+$/, "")}…`;
      }
      ab.lines[0] = line;
      attrib.push(ab);
    }
    const cite = String(opts.cite || "").replace(/\s+/g, " ").trim();
    if (cite) {
      const cs = Math.round(s * L.citeSize);
      attrib.push(block(x, `italic 400 ${cs}px ${brand.citeFont}`, cite, colW, Math.round(cs * L.citeLeading), 2));
    }
    const lineGap = Math.round(s * L.attribLineGap);
    const attribH = attrib.reduce((a, b) => a + b.height, 0) + lineGap * Math.max(0, attrib.length - 1);

    // Quote: the largest size that fits, then trim at a word if even the
    // smallest size runs over.
    const fixed = headerH + headerGap + Math.round(s * L.attribGap) + attribH;
    const avail = regionH - fixed;
    const body = cleanQuote(opts.quote);
    const qb = (sz, t) => block(x, `400 ${sz}px ${brand.quoteFont}`, `“${t}”`, colW, Math.round(sz * L.quoteLeading));
    let lo = Math.round(s * L.quoteMin), hi = Math.round(s * L.quoteMax), best = null;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1, b = qb(mid, body);
      if (b.height <= avail) { best = b; lo = mid + 1; } else hi = mid - 1;
    }
    if (!best) {
      const sz = Math.round(s * L.quoteMin), words = body.split(" ");
      best = qb(sz, body);
      while (best.height > avail && words.length > 8) {
        words.pop();
        best = qb(sz, `${words.join(" ").replace(/[,;:.]+$/, "")}…`);
      }
    }

    // Draw the group centered in its region.
    let y = top + Math.max(0, Math.round((regionH - (fixed + best.height)) / 2));
    if (h && h.kind === "rule") { x.fillStyle = h.color; x.fillRect(mx, y, Math.round(s * h.w), h.weight); }
    y += headerH + headerGap;
    drawBlock(x, best, mx, y, brand.ink);
    y += best.height + Math.round(s * L.attribGap);
    for (const a of attrib) {
      if (a.caps) {
        x.font = a.font; x.fillStyle = brand.accent;
        drawTracked(x, a.lines[0], mx, y + a.ascent, a.tracking);
      } else drawBlock(x, a, mx, y, brand.muted);
      y += a.height + lineGap;
    }

    const blob = await new Promise((resolve) => c.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("The image could not be made.");
    return { url: URL.createObjectURL(blob), blob, name: filename(opts, size), width: W, height: H };
  }

  function filename(opts, size) {
    const base = [opts.author, opts.cite].filter(Boolean).join(", ")
      .replace(/[^\p{L}\p{N} .,'()–-]+/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "quote";
    return `${base} (${size.w}x${size.h}).png`;
  }

  // Each surface remembers its own size: the reader mostly cites (link
  // card), essays mostly go to social (square).
  const sizeKey = (surface) => `mo-quote-card-size-${surface}`;
  function savedSize(surface, fallback) {
    try { const v = localStorage.getItem(sizeKey(surface)); if (v && SIZES[v]) return v; } catch (e) { /* storage blocked */ }
    return fallback;
  }
  function saveSize(surface, v) { try { localStorage.setItem(sizeKey(surface), v); } catch (e) { /* storage blocked */ } }

  function sizeSelect(current) {
    const sel = document.createElement("select");
    for (const [k, v] of Object.entries(SIZES)) {
      const o = document.createElement("option");
      o.value = k; o.textContent = v.label; if (k === current) o.selected = true;
      sel.appendChild(o);
    }
    return sel;
  }

  // ---- dialog used on Mere Orthodoxy essays --------------------------
  let dialog = null;
  function buildDialog() {
    const d = document.createElement("dialog");
    d.className = "quote-card-dialog";
    d.setAttribute("aria-labelledby", "quoteCardTitle");
    d.innerHTML =
      '<div class="quote-card-dialog-inner">' +
        '<h2 id="quoteCardTitle" class="quote-card-dialog-title">Share image</h2>' +
        '<div class="quote-card-dialog-preview"><img alt=""></div>' +
        '<label class="quote-card-dialog-size">Size </label>' +
        '<p class="quote-card-dialog-status" role="status"></p>' +
        '<div class="quote-card-dialog-actions">' +
          '<a class="btn btn-solid quote-card-download" download>Download</a>' +
          '<button type="button" class="btn quote-card-share" hidden>Share</button>' +
          '<button type="button" class="btn quote-card-close">Close</button>' +
        "</div>" +
      "</div>";
    document.body.appendChild(d);
    d.querySelector(".quote-card-close").addEventListener("click", () => d.close());
    d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
    d.addEventListener("close", () => { if (d._url) { URL.revokeObjectURL(d._url); d._url = ""; } });
    return d;
  }

  async function openDialog(opts) {
    dialog = dialog || buildDialog();
    const d = dialog;
    const label = d.querySelector(".quote-card-dialog-size");
    const old = label.querySelector("select"); if (old) old.remove();
    const sel = sizeSelect(savedSize("essay", "square"));
    label.appendChild(sel);
    const img = d.querySelector("img"), dl = d.querySelector(".quote-card-download");
    const share = d.querySelector(".quote-card-share"), status = d.querySelector(".quote-card-dialog-status");
    let current = null, painting = 0;
    // The last open's image was revoked on close; clear it so a reopen
    // shows no broken image and Download has nothing to follow.
    img.removeAttribute("src"); img.alt = "";
    share.hidden = true;

    async function paint() {
      const run = ++painting;
      status.textContent = "Preparing image…";
      dl.setAttribute("aria-disabled", "true"); dl.removeAttribute("href");
      try {
        const r = await render({ ...opts, size: sel.value });
        // A newer size was picked while this one drew.
        if (run !== painting || !d.open) { URL.revokeObjectURL(r.url); return; }
        if (d._url) URL.revokeObjectURL(d._url);
        d._url = r.url; current = r;
        img.src = r.url; img.width = r.width; img.height = r.height;
        img.alt = `Quote image: ${cleanQuote(opts.quote).slice(0, 140)}`;
        dl.href = r.url; dl.download = r.name; dl.removeAttribute("aria-disabled");
        share.hidden = !(navigator.canShare && navigator.canShare(sharePayload(r)));
        status.textContent = "";
      } catch (e) {
        if (run === painting) status.textContent = "The image could not be made. Try again.";
      }
    }
    // The link goes as text: some share targets drop `url` when a file
    // comes with it.
    function sharePayload(r) {
      const p = { files: [new File([r.blob], r.name, { type: "image/png" })] };
      if (opts.url) p.text = opts.url;
      return p;
    }
    sel.onchange = () => { saveSize("essay", sel.value); paint(); };
    share.onclick = async () => {
      if (!current) return;
      try { await navigator.share(sharePayload(current)); } catch (e) { /* cancelled */ }
    };
    if (!d.open) d.showModal();
    await paint();
  }

  window.MOQuoteCard = { SIZES, render, openDialog, savedSize, saveSize, sizeSelect };
})();
