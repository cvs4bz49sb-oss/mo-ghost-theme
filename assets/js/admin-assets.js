/*
 * Social asset creator — /admin/assets/
 *
 * Layer-based canvas editor. A panel is a background colour plus an
 * ordered list of layers (text, image, rule, box, scrim). Templates
 * are presets that *seed* layers; after that every element can be
 * dragged, resized, restyled, reordered, or deleted. Text layers
 * carry inline markup (**bold**, *italic*, __underline__) rendered
 * as styled runs, so a single layer can mix weights.
 *
 * Coordinates are canvas pixels. The canvas is displayed scaled to
 * fit, so pointer events convert through dispScale().
 */
(function () {
  "use strict";

  const root = document.querySelector("[data-asset-creator]");
  if (!root) return;

  const siteUrl = (root.dataset.siteUrl || "").replace(/\/$/, "");
  const contentApiKey = root.dataset.contentApiKey || "";
  const workerUrl = (root.dataset.workerUrl || "").replace(/\/+$/, "");

  const canvas = root.querySelector("[data-asset-canvas]");
  const ctx = canvas.getContext("2d");

  /* ── Output sizes ─────────────────────────────────────────────── */

  // safeTop / safeBottom are the bands the platform covers with its own
  // chrome. Instagram Stories puts the profile row over the top ~250px
  // and the reply bar over the bottom ~250px; X, LinkedIn and Facebook
  // crop feed previews toward the centre. Where a platform adds nothing,
  // the safe inset is just the design margin. Everything the tool lays
  // out — presets, auto-space, pinned furniture — stays inside this box.
  const MODES = {
    carousel: { w: 1080, h: 1350, panels: true },
    square: { w: 1080, h: 1080, panels: true },
    story: { w: 1080, h: 1920, panels: true, safeTop: 250, safeBottom: 250 },
    x: { w: 1600, h: 900, panels: true },
    linkedin: { w: 1200, h: 627, panels: true },
    facebook: { w: 1200, h: 630, panels: true },
  };

  const FONTS = {
    display: "'IM Fell Great Primer', 'Source Serif Pro', Georgia, serif",
    body: "'Source Serif Pro', Georgia, serif",
  };

  const MAX_PANELS = 12;
  const HANDLE_PX = 9; // handle size in *display* pixels
  const SNAP_PX = 6; // snap threshold in display pixels

  let mode = "carousel";
  let panels = [];
  let currentPanel = 0;
  let selectedId = null;
  let drag = null;
  let guides = [];
  let uid = 0;

  /* ── DOM refs ─────────────────────────────────────────────────── */

  const $modeButtons = root.querySelectorAll("[data-asset-mode]");
  const $templates = root.querySelectorAll("[data-template]");
  const $bgSwatches = root.querySelectorAll("[data-bg]");
  const $bgCustom = root.querySelector("[data-asset-bg-custom]");
  const $arrange = root.querySelector("[data-asset-arrange]");
  const $addButtons = root.querySelectorAll("[data-asset-add]");
  const $layerList = root.querySelector("[data-asset-layer-list]");
  const $layerFile = root.querySelector("[data-asset-layer-file]");
  const $inspector = root.querySelector("[data-asset-inspector]");
  const $inspTitle = root.querySelector("[data-asset-insp-title]");
  const $layerText = root.querySelector("[data-asset-layer-text]");
  const $urlInput = root.querySelector("[data-asset-url]");
  const $pullBtn = root.querySelector("[data-asset-pull]");
  const $panelStrip = root.querySelector("[data-asset-panel-strip]");
  const $panelAdd = root.querySelector("[data-asset-panel-add]");
  const $panelRemove = root.querySelector("[data-asset-panel-remove]");
  const $exportBtn = root.querySelector("[data-asset-export]");
  const $exportAllBtn = root.querySelector("[data-asset-export-all]");
  const $status = root.querySelector("[data-asset-status]");
  const $safeWarn = root.querySelector("[data-asset-safe-warn]");

  /* ── Small helpers ────────────────────────────────────────────── */

  function nextId() { uid += 1; return `l${uid}`; }
  function panel() { return panels[currentPanel]; }

  // The safe box for the current format, in canvas px.
  function safeArea() {
    const m = MODES[mode] || {};
    const side = Math.round(Math.min(canvas.width, canvas.height) * 0.075);
    const top = Math.round(m.safeTop || side);
    const bottom = Math.round(m.safeBottom || side);
    return {
      left: side,
      right: side,
      top,
      bottom,
      x: side,
      y: top,
      w: canvas.width - side * 2,
      h: canvas.height - top - bottom,
    };
  }

  function pad() { return safeArea().left; }
  function unit() { return canvas.width / 1080; }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function dispScale() {
    const r = canvas.getBoundingClientRect();
    return r.width ? r.width / canvas.width : 1;
  }

  function status(msg, isError) {
    if (!$status) return;
    $status.textContent = msg || "";
    $status.hidden = !msg;
    $status.classList.toggle("is-error", !!isError);
  }

  function hexToRgba(hex, a) {
    const h = (hex || "#000000").replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  /* ── Layer factories ──────────────────────────────────────────── */

  // Every factory takes an overrides object that is spread last, so a
  // preset can set any field without restating the defaults.
  function makeText(opts) {
    return {
      id: nextId(),
      type: "text",
      role: null,
      pin: null,
      visible: true,
      text: "",
      x: pad(),
      y: pad(),
      w: canvas.width - pad() * 2,
      font: "display",
      size: Math.round(48 * unit()),
      lineHeight: 1.2,
      tracking: 0,
      align: "center",
      color: "#ffffff",
      opacity: 1,
      bold: false,
      italic: true,
      caps: false,
      ...opts || {},
    };
  }

  function makeRule(opts) {
    return {
      id: nextId(),
      type: "rule",
      role: null,
      pin: null,
      visible: true,
      x: Math.round(canvas.width * 0.25),
      y: Math.round(canvas.height * 0.5),
      w: Math.round(canvas.width * 0.5),
      thickness: Math.max(1, Math.round(unit())),
      color: "#ffffff",
      opacity: 0.2,
      ...opts || {},
    };
  }

  function makeBox(opts) {
    return {
      id: nextId(),
      type: "box",
      role: null,
      pin: null,
      visible: true,
      x: Math.round(canvas.width * 0.25),
      y: Math.round(canvas.height * 0.45),
      w: Math.round(canvas.width * 0.5),
      h: Math.round(canvas.height * 0.08),
      radius: Math.round(30 * unit()),
      color: "#ffffff",
      opacity: 1,
      ...opts || {},
    };
  }

  function makeScrim(opts) {
    return {
      id: nextId(),
      type: "scrim",
      role: null,
      pin: null,
      visible: true,
      x: 0,
      y: Math.round(canvas.height * 0.45),
      w: canvas.width,
      h: Math.round(canvas.height * 0.55),
      radius: 0,
      direction: "up",
      color: "#000000",
      opacity: 0.75,
      ...opts || {},
    };
  }

  function makeImage(img, opts) {
    return {
      id: nextId(),
      type: "image",
      role: null,
      pin: null,
      visible: true,
      img,
      x: 0,
      y: 0,
      w: canvas.width,
      h: Math.round(canvas.height * 0.5),
      radius: 0,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
      opacity: 1,
      ...opts || {},
    };
  }

  function layerName(l) {
    if (l.role === "title") return "Title";
    if (l.role === "subtitle") return "Author / subtitle";
    if (l.role === "body") return "Body";
    if (l.role === "wordmark") return "Wordmark";
    if (l.role === "image") return "Article image";
    if (l.type === "text") {
      const t = (l.text || "").replace(/[*_\n]+/g, " ").trim();
      return t ? `${t.slice(0, 22)}${t.length > 22 ? "…" : ""}` : "Text";
    }
    return { rule: "Rule", box: "Box", scrim: "Scrim", image: "Image" }[l.type] || "Layer";
  }

  /* ── Inline markup → styled runs ──────────────────────────────── */

  function parseRuns(str) {
    const runs = [];
    let bold = false;
    let italic = false;
    let underline = false;
    let buf = "";
    const flush = () => {
      if (buf) runs.push({ text: buf, bold, italic, underline });
      buf = "";
    };
    let i = 0;
    while (i < str.length) {
      if (str.startsWith("**", i)) { flush(); bold = !bold; i += 2; continue; }
      if (str.startsWith("__", i)) { flush(); underline = !underline; i += 2; continue; }
      if (str[i] === "*") { flush(); italic = !italic; i += 1; continue; }
      buf += str[i];
      i += 1;
    }
    flush();
    if (!runs.length) runs.push({ text: "", bold: false, italic: false, underline: false });
    return runs;
  }

  // Layer italic is the baseline; a *marked* run flips it, so emphasis
  // inside an italic display headline renders upright the way a
  // typesetter would set it.
  function runFont(l, run) {
    const italic = run && run.italic ? !l.italic : l.italic;
    const bold = l.bold || (run && run.bold);
    return `${italic ? "italic " : ""}${bold ? "700" : "400"} ${l.size}px ${FONTS[l.font]}`;
  }

  function tokenize(l) {
    const out = [];
    parseRuns(l.text || "").forEach((run) => {
      run.text.split(/(\n)/).forEach((chunk) => {
        if (chunk === "\n") { out.push({ type: "br" }); return; }
        chunk.split(/(\s+)/).forEach((piece) => {
          if (!piece) return;
          if (/^\s+$/.test(piece)) out.push({ type: "sp", text: " ", run });
          else out.push({ type: "w", text: l.caps ? piece.toUpperCase() : piece, run });
        });
      });
    });
    return out;
  }

  function tokenWidth(l, tok) {
    ctx.font = runFont(l, tok.run);
    if (!l.tracking) return ctx.measureText(tok.text).width;
    let total = 0;
    for (let i = 0; i < tok.text.length; i += 1) {
      total += ctx.measureText(tok.text[i]).width + l.tracking;
    }
    return total;
  }

  function layoutText(l) {
    const maxW = Math.max(24, l.w);
    const toks = tokenize(l);
    const lines = [];
    let cur = [];
    let curW = 0;
    const trimEnd = () => {
      while (cur.length && cur[cur.length - 1].type === "sp") {
        curW -= tokenWidth(l, cur.pop());
      }
    };
    toks.forEach((t) => {
      if (t.type === "br") { trimEnd(); lines.push({ toks: cur, w: curW }); cur = []; curW = 0; return; }
      const tw = tokenWidth(l, t);
      if (t.type === "sp") {
        if (!cur.length) return;
        cur.push(t); curW += tw; return;
      }
      if (curW + tw > maxW && cur.length) {
        trimEnd();
        lines.push({ toks: cur, w: curW });
        cur = [t]; curW = tw;
      } else {
        cur.push(t); curW += tw;
      }
    });
    trimEnd();
    lines.push({ toks: cur, w: curW });
    const lineH = l.size * l.lineHeight;
    return { lines, lineH, height: Math.max(lines.length, 1) * lineH };
  }

  /* ── Geometry ─────────────────────────────────────────────────── */

  function boxOf(l) {
    if (l.type === "text") {
      return { x: l.x, y: l.y, w: l.w, h: layoutText(l).height };
    }
    if (l.type === "rule") {
      const t = Math.max(l.thickness, 12 * unit());
      return { x: l.x, y: l.y - t / 2, w: l.w, h: t };
    }
    return { x: l.x, y: l.y, w: l.w, h: l.h };
  }

  function isFullBleed(l, w, h) {
    return l.x <= 2 && l.y <= 2 && l.w >= w - 2 && (l.h || 0) >= h - 2;
  }

  /* ── Drawing ──────────────────────────────────────────────────── */

  function drawText(l) {
    const { lines, lineH } = layoutText(l);
    ctx.save();
    ctx.globalAlpha = l.opacity;
    ctx.fillStyle = l.color;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    lines.forEach((ln, i) => {
      let {x} = l;
      if (l.align === "center") x = l.x + (l.w - ln.w) / 2;
      else if (l.align === "right") x = l.x + (l.w - ln.w);
      const y = l.y + i * lineH + (lineH - l.size) / 2;
      ln.toks.forEach((t) => {
        ctx.font = runFont(l, t.run);
        const startX = x;
        if (l.tracking) {
          for (let c = 0; c < t.text.length; c += 1) {
            ctx.fillText(t.text[c], x, y);
            x += ctx.measureText(t.text[c]).width + l.tracking;
          }
        } else {
          ctx.fillText(t.text, x, y);
          x += ctx.measureText(t.text).width;
        }
        if (t.run && t.run.underline && t.type === "w") {
          const uy = y + l.size * 0.95;
          ctx.save();
          ctx.strokeStyle = l.color;
          ctx.lineWidth = Math.max(1, l.size * 0.045);
          ctx.beginPath();
          ctx.moveTo(startX, uy);
          ctx.lineTo(x, uy);
          ctx.stroke();
          ctx.restore();
        }
      });
    });
    ctx.restore();
  }

  function roundRectPath(x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    ctx.lineTo(x + rad, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.closePath();
  }

  function drawImageLayer(l) {
    // An empty image layer reads as a deliberate placeholder rather
    // than a colour wash, so "no photo yet" never ships by accident.
    if (!l.img) {
      ctx.save();
      ctx.fillStyle = "#8f8b86";
      roundRectPath(l.x, l.y, l.w, l.h, l.radius || 0);
      ctx.fill();
      ctx.clip();
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = Math.max(2, l.w * 0.004);
      for (let d = -l.h; d < l.w; d += Math.max(40, l.w * 0.06)) {
        ctx.beginPath();
        ctx.moveTo(l.x + d, l.y + l.h);
        ctx.lineTo(l.x + d + l.h, l.y);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = `600 ${Math.max(16, Math.round(l.w * 0.028))}px ${FONTS.body}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("No image yet", l.x + l.w / 2, l.y + l.h / 2);
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.globalAlpha = l.opacity;
    roundRectPath(l.x, l.y, l.w, l.h, l.radius || 0);
    ctx.clip();
    const iw = l.img.naturalWidth || l.img.width;
    const ih = l.img.naturalHeight || l.img.height;
    const scale = Math.max(l.w / iw, l.h / ih) * (l.zoom || 1);
    const sw = iw * scale;
    const sh = ih * scale;
    const cx = l.x + (l.w - sw) / 2 + (l.offsetX || 0);
    const cy = l.y + (l.h - sh) / 2 + (l.offsetY || 0);
    ctx.drawImage(l.img, cx, cy, sw, sh);
    ctx.restore();
  }

  function drawLayer(l) {
    if (!l.visible) return;
    if (l.type === "text") { drawText(l); return; }
    if (l.type === "image") { drawImageLayer(l); return; }
    if (l.type === "rule") {
      ctx.save();
      ctx.globalAlpha = l.opacity;
      ctx.strokeStyle = l.color;
      ctx.lineWidth = l.thickness;
      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(l.x + l.w, l.y);
      ctx.stroke();
      ctx.restore();
      return;
    }
    if (l.type === "box") {
      ctx.save();
      ctx.globalAlpha = l.opacity;
      ctx.fillStyle = l.color;
      roundRectPath(l.x, l.y, l.w, l.h, l.radius || 0);
      ctx.fill();
      ctx.restore();
      return;
    }
    if (l.type === "scrim") {
      ctx.save();
      ctx.globalAlpha = 1;
      const up = l.direction !== "down";
      const grad = ctx.createLinearGradient(0, up ? l.y : l.y + l.h, 0, up ? l.y + l.h : l.y);
      grad.addColorStop(0, hexToRgba(l.color, 0));
      grad.addColorStop(0.55, hexToRgba(l.color, l.opacity * 0.55));
      grad.addColorStop(1, hexToRgba(l.color, l.opacity));
      ctx.fillStyle = grad;
      roundRectPath(l.x, l.y, l.w, l.h, l.radius || 0);
      ctx.fill();
      ctx.restore();
    }
  }

  // Editor guide only — render(false) skips it, so it never exports.
  function drawSafeArea() {
    const sa = safeArea();
    const s = dispScale();
    const offenders = outsideSafe();
    ctx.save();
    ctx.strokeStyle = "#ff3b30";
    ctx.globalAlpha = offenders.length ? 0.5 : 0.28;
    ctx.lineWidth = 2 / s;
    ctx.setLineDash([14 / s, 10 / s]);
    ctx.strokeRect(sa.x, sa.y, sa.w, sa.h);
    ctx.restore();

    // Outline whatever is breaking out, so "something is unsafe" points
    // at the layer instead of leaving Ian to find it.
    if (!offenders.length) return;
    ctx.save();
    ctx.strokeStyle = "#ff3b30";
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 3 / s;
    ctx.setLineDash([]);
    offenders.forEach((l) => {
      const b = boxOf(l);
      ctx.strokeRect(b.x, b.y, b.w, b.h);
    });
    ctx.restore();
  }

  function drawChrome() {
    const l = selected();
    const s = dispScale();
    if (guides.length) {
      ctx.save();
      ctx.strokeStyle = "#ee7d51";
      ctx.lineWidth = 1 / s;
      ctx.setLineDash([6 / s, 6 / s]);
      guides.forEach((g) => {
        ctx.beginPath();
        if (g.axis === "x") { ctx.moveTo(g.at, 0); ctx.lineTo(g.at, canvas.height); }
        else { ctx.moveTo(0, g.at); ctx.lineTo(canvas.width, g.at); }
        ctx.stroke();
      });
      ctx.restore();
    }
    if (!l) return;
    const b = boxOf(l);
    ctx.save();
    ctx.strokeStyle = "#ee7d51";
    ctx.lineWidth = 2 / s;
    ctx.setLineDash([8 / s, 6 / s]);
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.setLineDash([]);
    const hs = HANDLE_PX / s;
    handlesFor(l).forEach((hd) => {
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#ee7d51";
      ctx.lineWidth = 1.5 / s;
      ctx.fillRect(hd.x - hs / 2, hd.y - hs / 2, hs, hs);
      ctx.strokeRect(hd.x - hs / 2, hd.y - hs / 2, hs, hs);
    });
    ctx.restore();
  }

  function render(withChrome) {
    const w = canvas.width;
    const h = canvas.height;
    const p = panel();
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, w, h);
    p.layers.forEach(drawLayer);
    if (withChrome !== false) {
      drawSafeArea();
      drawChrome();
      // Tied to the draw rather than to individual handlers: every path
      // that changes the canvas renders, so the readout cannot drift out
      // of step with what is on screen.
      refreshSafeWarning();
    }
  }

  /* ── Handles ──────────────────────────────────────────────────── */

  function handlesFor(l) {
    const b = boxOf(l);
    const midY = b.y + b.h / 2;
    if (l.type === "text" || l.type === "rule") {
      return [
        { id: "w", x: b.x, y: midY },
        { id: "e", x: b.x + b.w, y: midY },
      ];
    }
    return [
      { id: "nw", x: b.x, y: b.y },
      { id: "n", x: b.x + b.w / 2, y: b.y },
      { id: "ne", x: b.x + b.w, y: b.y },
      { id: "e", x: b.x + b.w, y: midY },
      { id: "se", x: b.x + b.w, y: b.y + b.h },
      { id: "s", x: b.x + b.w / 2, y: b.y + b.h },
      { id: "sw", x: b.x, y: b.y + b.h },
      { id: "w", x: b.x, y: midY },
    ];
  }

  function hitHandle(l, pt) {
    const tol = (HANDLE_PX + 4) / dispScale();
    return handlesFor(l).find((hd) => Math.abs(hd.x - pt.x) <= tol && Math.abs(hd.y - pt.y) <= tol) || null;
  }

  function hitLayer(pt) {
    const list = panel().layers;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const l = list[i];
      if (!l.visible) continue;
      const b = boxOf(l);
      if (pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h) return l;
    }
    return null;
  }

  /* ── Presets ──────────────────────────────────────────────────── */

  // Carries content across a template switch. Images are matched by
  // role first, then by any image layer — a photo the user uploaded by
  // hand has no role, and dropping it on a template change loses work.
  function harvest() {
    const out = { title: "", subtitle: "", body: "", img: null };
    if (!panels.length) return out;
    let anyImg = null;
    panel().layers.forEach((l) => {
      if (l.role === "title") out.title = l.text;
      if (l.role === "subtitle") out.subtitle = l.text;
      if (l.role === "body") out.body = l.text;
      if (l.role === "image" && l.img) out.img = l.img;
      if (l.type === "image" && l.img && !anyImg) anyImg = l.img;
    });
    if (!out.img) out.img = anyImg;
    return out;
  }

  function wordmarkLayer(align, color) {
    const u = unit();
    const sa = safeArea();
    return makeText({
      role: "wordmark",
      pin: "top",
      text: "MERE ORTHODOXY",
      font: "body",
      italic: false,
      bold: true,
      caps: true,
      size: Math.round(20 * u),
      tracking: 4 * u,
      lineHeight: 1.2,
      align: align || "center",
      color,
      opacity: 0.45,
      x: sa.x,
      y: sa.y,
      w: sa.w,
    });
  }

  function buildPreset(name, content) {
    const w = canvas.width;
    const h = canvas.height;
    const u = unit();
    const p = pad();
    const sa = safeArea();
    const fg = contrastOn(panel().bg);
    const inner = w - p * 2;
    const layers = [];

    if (name === "blank") return layers;

    if (name === "title-card") {
      if (content.img) {
        layers.push(makeImage(content.img, {
          role: "image", x: 0, y: 0, w, h: Math.round(h * 0.5),
        }));
      }
      layers.push(wordmarkLayer("center", fg));
      // Seed y in reading order — autoArrange() re-stacks by y, so the
      // preset's vertical sequence has to be monotonic here.
      layers.push(makeText({
        role: "title", text: content.title || "Article title", font: "display", italic: true,
        size: Math.round(fitTitleSize(content.title, inner, 84 * u)), lineHeight: 1.18,
        align: "center", color: fg, x: p, y: Math.round(h * 0.38), w: inner,
      }));
      layers.push(makeRule({
        x: Math.round(w * 0.3), w: Math.round(w * 0.4), y: Math.round(h * 0.56),
        color: fg, opacity: 0.18, thickness: Math.max(1, Math.round(u)),
      }));
      layers.push(makeText({
        role: "subtitle", text: content.subtitle || "Author name", font: "body", italic: false,
        size: Math.round(30 * u), lineHeight: 1.3, align: "center", color: fg, opacity: 0.65,
        x: p, y: Math.round(h * 0.6), w: inner,
      }));
      return layers;
    }

    if (name === "quote-card") {
      layers.push(makeText({
        // pin "free" = decorative; sits where it is placed and never
        // joins the auto-space stack.
        pin: "free",
        text: "“", font: "display", italic: true, size: Math.round(240 * u),
        lineHeight: 1, align: "left", color: fg, opacity: 0.1,
        x: p - Math.round(18 * u), y: p, w: Math.round(300 * u),
      }));
      layers.push(wordmarkLayer("right", fg));
      layers.push(makeText({
        role: "body", text: content.body || "Pull a sentence worth quoting.", font: "display",
        italic: true, size: Math.round(52 * u), lineHeight: 1.42, align: "left", color: fg,
        x: p, y: Math.round(h * 0.28), w: inner,
      }));
      layers.push(makeRule({
        pin: "bottom", x: p, w: Math.round(w * 0.3), y: h - sa.bottom - Math.round(96 * u),
        color: fg, opacity: 0.2, thickness: Math.max(1, Math.round(u)),
      }));
      layers.push(makeText({
        role: "subtitle", pin: "bottom", text: content.subtitle || "Author name", font: "body",
        italic: false, bold: true, size: Math.round(26 * u), lineHeight: 1.3, align: "left",
        color: fg, opacity: 0.7, x: p, y: h - sa.bottom - Math.round(72 * u), w: inner,
      }));
      layers.push(makeText({
        role: "title", pin: "bottom", text: content.title || "", font: "body", italic: true,
        size: Math.round(20 * u), lineHeight: 1.3, align: "left", color: fg, opacity: 0.45,
        x: p + Math.round(20 * u), y: h - sa.bottom - Math.round(34 * u), w: inner,
      }));
      return layers;
    }

    if (name === "image-card") {
      layers.push(makeImage(content.img, { role: "image", x: 0, y: 0, w, h }));
      layers.push(makeScrim({
        x: 0, y: Math.round(h * 0.42), w, h: Math.round(h * 0.58),
        color: "#000000", opacity: 0.85, direction: "up",
      }));
      layers.push(wordmarkLayer("right", "#ffffff"));
      layers.push(makeText({
        role: "title", text: content.title || "Article title", font: "display", italic: true,
        size: Math.round(fitTitleSize(content.title, inner, 54 * u)), lineHeight: 1.16,
        align: "left", color: "#ffffff", x: p, y: Math.round(h * 0.68), w: inner,
      }));
      layers.push(makeText({
        role: "subtitle", pin: "bottom", text: content.subtitle || "Author name", font: "body",
        italic: false, size: Math.round(24 * u), lineHeight: 1.3, align: "left",
        color: "#ffffff", opacity: 0.78, x: p, y: h - sa.bottom - Math.round(30 * u), w: inner,
      }));
      return layers;
    }

    if (name === "text-card") {
      layers.push(wordmarkLayer("center", fg));
      layers.push(makeRule({
        pin: "top", x: p, w: inner, y: p + Math.round(46 * u), color: fg, opacity: 0.14,
        thickness: Math.max(1, Math.round(u)),
      }));
      layers.push(makeText({
        role: "body", text: content.body || "Body text goes here.", font: "body", italic: false,
        size: Math.round(30 * u), lineHeight: 1.62, align: "left", color: fg,
        x: p, y: p + Math.round(100 * u), w: inner,
      }));
      layers.push(makeRule({
        pin: "bottom", x: p, w: inner, y: h - sa.bottom, color: fg, opacity: 0.14,
        thickness: Math.max(1, Math.round(u)),
      }));
      return layers;
    }

    if (name === "cta-card") {
      // Every layer here is "free": the card is a fixed composition and
      // the URL label has to stay centred on its pill, which it would
      // not if Auto-space restacked the text and left the box behind.
      layers.push(makeText({
        pin: "free",
        text: "¶", font: "display", italic: true, size: Math.round(120 * u), lineHeight: 1,
        align: "center", color: fg, opacity: 0.08, x: p, y: Math.round(h * 0.2), w: inner,
      }));
      layers.push(makeText({
        pin: "free",
        text: "READ MORE AT", font: "body", italic: false, bold: true, caps: true,
        size: Math.round(16 * u), tracking: 3 * u, lineHeight: 1.2, align: "center",
        color: fg, opacity: 0.45, x: p, y: Math.round(h * 0.38), w: inner,
      }));
      layers.push(makeText({
        pin: "free",
        text: "Mere Orthodoxy", font: "display", italic: true, size: Math.round(56 * u),
        lineHeight: 1.2, align: "center", color: fg, x: p, y: Math.round(h * 0.43), w: inner,
      }));
      const btnW = Math.round(w * 0.34);
      const btnH = Math.round(60 * u);
      layers.push(makeBox({
        pin: "free",
        x: Math.round((w - btnW) / 2), y: Math.round(h * 0.58), w: btnW, h: btnH,
        radius: Math.round(btnH / 2), color: fg, opacity: 1,
      }));
      layers.push(makeText({
        pin: "free",
        role: "title", text: "mereorthodoxy.com", font: "body", italic: false, bold: true,
        size: Math.round(20 * u), lineHeight: 1.2, align: "center", color: panel().bg,
        x: Math.round((w - btnW) / 2), y: Math.round(h * 0.58 + (btnH - 24 * u) / 2), w: btnW,
      }));
      return layers;
    }

    return layers;
  }

  // Rough first-guess title size so long headlines don't start huge.
  function fitTitleSize(text, maxW, base) {
    const chars = (text || "").length;
    if (!chars) return base;
    if (chars > 90) return base * 0.68;
    if (chars > 60) return base * 0.8;
    if (chars > 40) return base * 0.9;
    return base;
  }

  function contrastOn(bg) {
    const h = (bg || "#000000").replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.6 ? "#1d1b18" : "#ffffff";
  }

  function applyTemplate(name) {
    const content = harvest();
    const p = panel();
    p.template = name;
    p.layers = buildPreset(name, content);
    selectedId = null;
    autoArrange();
    refreshAll();
  }

  /* ── Safe area ────────────────────────────────────────────────── */

  // Content layers only. Photos and scrims are background and are meant
  // to bleed to the edge — pulling them inside the safe box would put a
  // margin around the picture, which is not what the guide is for.
  function isContentLayer(l) {
    return l.type === "text" || l.type === "rule" || l.type === "box";
  }

  // Pulls every content layer inside the safe box: narrows anything
  // wider than the safe width, then clamps it horizontally and
  // vertically. Text re-wraps as it narrows, so this runs before the
  // vertical re-stack, never after.
  function fitToSafe(target) {
    const p = target || panel();
    const sa = safeArea();
    p.layers.forEach((l) => {
      if (!isContentLayer(l) || !l.visible) return;
      if (l.w > sa.w) l.w = sa.w;
      l.x = Math.round(clamp(l.x, sa.x, sa.x + sa.w - l.w));
      const b = boxOf(l);
      if (b.h > sa.h && l.type !== "text") l.h = sa.h;
      const top = l.type === "rule" ? l.y - (boxOf(l).h / 2) : l.y;
      const maxTop = sa.y + sa.h - boxOf(l).h;
      const clampedTop = clamp(top, sa.y, Math.max(sa.y, maxTop));
      l.y = Math.round(l.type === "rule" ? clampedTop + (boxOf(l).h / 2) : clampedTop);
    });
  }

  // Anything a platform would crop or cover. Reported, never silently
  // moved — the canvas is Ian's to arrange.
  function outsideSafe(target) {
    const p = target || panel();
    const sa = safeArea();
    return p.layers.filter((l) => {
      if (!l.visible || !isContentLayer(l)) return false;
      const b = boxOf(l);
      return b.x < sa.x - 1 || b.y < sa.y - 1
        || b.x + b.w > sa.x + sa.w + 1
        || b.y + b.h > sa.y + sa.h + 1;
    });
  }

  /* ── Auto-space ───────────────────────────────────────────────── */

  // Re-stacks unpinned text/rule layers in reading order inside the
  // free vertical band, with gaps proportional to type size. This is
  // the one-click fix for overlapping lines after heavy editing.
  function autoArrange(target) {
    const p = target || panel();
    const h = canvas.height;
    const pd = pad();
    // Fit first: narrowing a text layer changes how it wraps, which
    // changes its height, which is what the stack below is measured on.
    fitToSafe(p);
    const stack = p.layers.filter((l) => l.visible && !l.pin && (l.type === "text" || l.type === "rule"));
    if (!stack.length) return;

    const sa = safeArea();
    let bandTop = sa.top;
    let bandBottom = h - sa.bottom;
    // A photo band across the top pushes the stack below it.
    p.layers.forEach((l) => {
      if (l.type !== "image" && l.type !== "box") return;
      if (isFullBleed(l, canvas.width, h)) return;
      const b = boxOf(l);
      if (b.y <= 4 && b.y + b.h < h * 0.85) bandTop = Math.max(bandTop, b.y + b.h + pd * 0.5);
    });
    // A scrim over the lower part of a photo is where the text is meant
    // to live — start the stack inside it rather than centring over the
    // picture, which is what makes an image card readable.
    p.layers.forEach((l) => {
      if (l.type !== "scrim" || !l.visible) return;
      if (l.direction === "down") return;
      if (l.y > h * 0.25) bandTop = Math.max(bandTop, l.y + pd * 0.4);
    });
    p.layers.forEach((l) => {
      if (!l.pin || l.type === "image") return;
      const b = boxOf(l);
      if (l.pin === "top") bandTop = Math.max(bandTop, b.y + b.h + pd * 0.6);
      if (l.pin === "bottom") bandBottom = Math.min(bandBottom, b.y - pd * 0.5);
    });

    // Reading order = current vertical order, ties broken by stacking
    // index so two layers seeded at the same y keep their preset order.
    const order = new Map(p.layers.map((l, i) => [l.id, i]));
    stack.sort((a, b) => (boxOf(a).y - boxOf(b).y) || (order.get(a.id) - order.get(b.id)));

    const heights = stack.map((l) => boxOf(l).h);
    const gaps = stack.map((l, i) => {
      if (i === stack.length - 1) return 0;
      const next = stack[i + 1];
      if (l.type === "rule" || next.type === "rule") return Math.round(pad() * 0.34);
      return Math.round((l.type === "text" ? l.size : pad()) * 0.55);
    });
    const total = heights.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0);
    let y = bandTop + Math.max(0, (bandBottom - bandTop - total) / 2);
    stack.forEach((l, i) => {
      if (l.type === "rule") l.y = Math.round(y + heights[i] / 2);
      else l.y = Math.round(y);
      y += heights[i] + gaps[i];
    });
  }

  // A headline that wraps to a second line used to grow straight over
  // whatever sat beneath it. Any edit that changes a text layer's
  // height pushes the unpinned layers that were already below it by the
  // same amount, so a stack stays a stack while you type. Dragging is
  // untouched — this only fires on content/type-size edits.
  function withReflow(l, fn) {
    if (!l || l.type !== "text") { fn(); return; }
    const before = boxOf(l);
    const prevBottom = before.y + before.h;
    fn();
    const after = boxOf(l);
    const delta = Math.round((after.y + after.h) - prevBottom);
    if (!delta) return;
    panel().layers.forEach((o) => {
      if (o.id === l.id || o.pin) return;
      if (o.type !== "text" && o.type !== "rule") return;
      if (boxOf(o).y >= prevBottom - 1) o.y += delta;
    });
  }

  /* ── Panels ───────────────────────────────────────────────────── */

  function makePanelState() {
    return { template: "title-card", bg: "#1d1b18", layers: [] };
  }

  // Moving between formats is not a uniform scale: 1080×1350 → 1600×900
  // is wider AND shorter. Horizontal geometry and type size follow the
  // width ratio; y and height follow the height ratio; autoArrange()
  // then rebuilds the vertical stack for the new proportions.
  //
  // Type deliberately tracks width ONLY. It is the one factor that has
  // to survive a round trip: scaling by min(sx, sy) would shrink the
  // headline a little on every format switch, so hopping
  // carousel → X → carousel would silently leave the type smaller than
  // it started. Width scaling is exactly invertible.
  function rescalePanel(p, oldW, oldH, newW, newH) {
    const sx = newW / oldW;
    const sy = newH / oldH;
    const round2 = (n) => Math.round(n * 100) / 100;
    p.layers.forEach((l) => {
      const full = isFullBleed(l, oldW, oldH);
      l.x = round2(l.x * sx);
      l.w = round2(l.w * sx);
      l.y = round2(l.y * sy);
      if (typeof l.h === "number") l.h = round2(l.h * sy);
      ["size", "tracking", "thickness", "radius", "offsetX", "offsetY"].forEach((k) => {
        if (typeof l[k] === "number") l[k] = round2(l[k] * sx);
      });
      if (full) { l.x = 0; l.y = 0; l.w = newW; l.h = newH; }
    });
    // Re-seat the pinned furniture against the new format's safe box.
    const sa = safeArea();
    p.layers.forEach((l) => {
      if (l.pin === "top") l.y = sa.top;
      if (l.pin === "bottom") l.y = Math.round(newH - sa.bottom - boxOf(l).h);
    });
  }

  function setMode(next) {
    const dim = MODES[next];
    if (!dim) return;
    const oldW = canvas.width;
    const oldH = canvas.height;
    mode = next;
    canvas.width = dim.w;
    canvas.height = dim.h;
    canvas.style.aspectRatio = `${dim.w} / ${dim.h}`;
    panels.forEach((p) => {
      rescalePanel(p, oldW, oldH, dim.w, dim.h);
      autoArrange(p);
    });
    $modeButtons.forEach((b) => { b.classList.toggle("is-active", b.dataset.assetMode === next); });
    refreshAll();
  }

  function rebuildPanelStrip() {
    $panelStrip.innerHTML = "";
    panels.forEach((_, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `asset-panel-thumb${i === currentPanel ? " is-active" : ""}`;
      btn.textContent = String(i + 1);
      btn.dataset.panelIdx = String(i);
      btn.addEventListener("click", () => {
        currentPanel = i;
        selectedId = null;
        refreshAll();
      });
      $panelStrip.appendChild(btn);
    });
  }

  /* ── Layer list ───────────────────────────────────────────────── */

  function rebuildLayerList() {
    $layerList.innerHTML = "";
    const list = panel().layers;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const l = list[i];
      const li = document.createElement("li");
      li.className = `asset-layer-row${l.id === selectedId ? " is-active" : ""}`;
      li.dataset.layerId = l.id;

      const eye = document.createElement("button");
      eye.type = "button";
      eye.className = "asset-layer-eye";
      eye.title = l.visible ? "Hide layer" : "Show layer";
      eye.setAttribute("aria-label", eye.title);
      eye.textContent = l.visible ? "◉" : "○";
      eye.addEventListener("click", (ev) => {
        ev.stopPropagation();
        l.visible = !l.visible;
        refreshAll();
      });

      const name = document.createElement("span");
      name.className = "asset-layer-name";
      name.textContent = layerName(l);

      const kind = document.createElement("span");
      kind.className = "asset-layer-kind";
      kind.textContent = l.type;

      const up = document.createElement("button");
      up.type = "button";
      up.className = "asset-layer-move";
      up.textContent = "▲";
      up.title = "Bring forward";
      up.setAttribute("aria-label", up.title);
      up.addEventListener("click", (ev) => { ev.stopPropagation(); moveLayer(l, 1); });

      const down = document.createElement("button");
      down.type = "button";
      down.className = "asset-layer-move";
      down.textContent = "▼";
      down.title = "Send backward";
      down.setAttribute("aria-label", down.title);
      down.addEventListener("click", (ev) => { ev.stopPropagation(); moveLayer(l, -1); });

      const del = document.createElement("button");
      del.type = "button";
      del.className = "asset-layer-del";
      del.textContent = "✕";
      del.title = "Delete layer";
      del.setAttribute("aria-label", del.title);
      del.addEventListener("click", (ev) => { ev.stopPropagation(); deleteLayer(l.id); });

      li.append(eye, name, kind, up, down, del);
      li.addEventListener("click", () => { selectedId = l.id; refreshAll(); });
      $layerList.appendChild(li);
    }
  }

  function moveLayer(l, dir) {
    const list = panel().layers;
    const i = list.indexOf(l);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    list.splice(i, 1);
    list.splice(j, 0, l);
    selectedId = l.id;
    refreshAll();
  }

  function deleteLayer(id) {
    const list = panel().layers;
    const i = list.findIndex((l) => l.id === id);
    if (i < 0) return;
    list.splice(i, 1);
    if (selectedId === id) selectedId = null;
    refreshAll();
  }

  function selected() {
    return panel().layers.find((l) => l.id === selectedId) || null;
  }

  /* ── Inspector ────────────────────────────────────────────────── */

  function syncInspector() {
    const l = selected();
    if (!l) { $inspector.hidden = true; return; }
    $inspector.hidden = false;
    $inspTitle.textContent = layerName(l);

    $inspector.querySelectorAll("[data-for]").forEach((el) => {
      el.hidden = !el.dataset.for.split(" ").includes(l.type);
    });

    if (l.type === "text" && document.activeElement !== $layerText) {
      $layerText.value = l.text || "";
    }

    $inspector.querySelectorAll("[data-asset-prop]").forEach((el) => {
      const key = el.dataset.assetProp;
      if (!(key in l) && key !== "opacity") return;
      if (el.type === "range" || el.type === "number") {
        el.value = key === "opacity" ? Math.round(l.opacity * 100) : l[key];
      } else {
        el.value = l[key];
      }
    });

    setVal("size", l.size ? `${Math.round(l.size)}px` : "");
    setVal("lineHeight", l.lineHeight ? l.lineHeight.toFixed(2) : "");
    setVal("tracking", typeof l.tracking === "number" ? l.tracking.toFixed(1) : "");
    setVal("thickness", l.thickness ? `${l.thickness}px` : "");
    setVal("radius", typeof l.radius === "number" ? `${Math.round(l.radius)}px` : "");
    setVal("zoom", l.zoom ? `${l.zoom.toFixed(2)}×` : "");
    setVal("opacity", `${Math.round((l.opacity || 0) * 100)}%`);

    $inspector.querySelectorAll("[data-align]").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.align === l.align);
    });
    $inspector.querySelectorAll("[data-asset-style]").forEach((b) => {
      b.classList.toggle("is-active", !!l[b.dataset.assetStyle]);
    });
    $inspector.querySelectorAll("[data-color]").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.color === l.color);
    });
  }

  function setVal(key, text) {
    const el = $inspector.querySelector(`[data-val="${key}"]`);
    if (el) el.textContent = text;
  }

  function refreshSafeWarning() {
    if (!$safeWarn) return;
    const bad = outsideSafe();
    if (!bad.length) {
      $safeWarn.hidden = true;
      $safeWarn.textContent = "";
      return;
    }
    const names = bad.map(layerName).join(", ");
    $safeWarn.hidden = false;
    $safeWarn.textContent = bad.length === 1
      ? `${names} sits outside the safe area — ${MODES[mode].safeTop ? "the app will cover it" : "it may be cropped"}. Auto-space fixes it.`
      : `${bad.length} layers sit outside the safe area (${names}). Auto-space fixes it.`;
  }

  function refreshAll() {
    rebuildPanelStrip();
    rebuildLayerList();
    syncInspector();
    $templates.forEach((b) => { b.classList.toggle("is-active", b.dataset.template === panel().template); });
    $bgSwatches.forEach((b) => { b.classList.toggle("is-active", b.dataset.bg === panel().bg); });
    $bgCustom.value = panel().bg;
    render(true);
  }

  /* ── Inline formatting on the textarea selection ──────────────── */

  const MARKERS = { bold: "**", italic: "*", underline: "__" };

  function wrapSelection(kind) {
    const mk = MARKERS[kind];
    const el = $layerText;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const v = el.value;
    const before = v.slice(0, start);
    const sel = v.slice(start, end);
    const after = v.slice(end);
    let next;
    let caret;
    if (before.endsWith(mk) && after.startsWith(mk)) {
      next = before.slice(0, -mk.length) + sel + after.slice(mk.length);
      caret = [start - mk.length, end - mk.length];
    } else if (sel.startsWith(mk) && sel.endsWith(mk) && sel.length > mk.length * 2) {
      next = before + sel.slice(mk.length, -mk.length) + after;
      caret = [start, end - mk.length * 2];
    } else {
      next = before + mk + sel + mk + after;
      caret = [start + mk.length, end + mk.length];
    }
    el.value = next;
    el.setSelectionRange(caret[0], caret[1]);
    el.focus();
    const l = selected();
    if (l) { l.text = next; render(true); rebuildLayerList(); }
  }

  /* ── Pointer interaction ──────────────────────────────────────── */

  function toCanvasPoint(ev) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (ev.clientX - r.left) * (canvas.width / r.width),
      y: (ev.clientY - r.top) * (canvas.height / r.height),
    };
  }

  // Pointer capture is a nicety (it keeps the drag alive past the canvas
  // edge) and throws when the pointer isn't active. Never let it take
  // selection down with it.
  function capture(ev) {
    try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* non-fatal */ }
  }

  canvas.addEventListener("pointerdown", (ev) => {
    const pt = toCanvasPoint(ev);
    const cur = selected();
    if (cur && cur.visible) {
      const hd = hitHandle(cur, pt);
      if (hd) {
        drag = { kind: "resize", handle: hd.id, start: pt, box: { ...boxOf(cur)}, size: cur.size };
        capture(ev);
        ev.preventDefault();
        return;
      }
    }
    const hit = hitLayer(pt);
    selectedId = hit ? hit.id : null;
    if (hit) {
      drag = { kind: "move", start: pt, orig: { x: hit.x, y: hit.y } };
      capture(ev);
    }
    canvas.focus({ preventScroll: true });
    refreshAll();
    if (hit) ev.preventDefault();
  });

  canvas.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    const l = selected();
    if (!l) return;
    const pt = toCanvasPoint(ev);
    const dx = pt.x - drag.start.x;
    const dy = pt.y - drag.start.y;

    if (drag.kind === "move") {
      let nx = drag.orig.x + dx;
      let ny = drag.orig.y + dy;
      if (ev.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) ny = drag.orig.y;
        else nx = drag.orig.x;
      }
      const snapped = applySnap(l, nx, ny, ev.altKey);
      l.x = Math.round(snapped.x);
      l.y = Math.round(snapped.y);
    } else {
      resizeLayer(l, drag, dx, dy, ev.shiftKey);
    }
    render(true);
    syncInspector();
  });

  function endDrag(ev) {
    if (!drag) return;
    drag = null;
    guides = [];
    try {
      if (ev && canvas.hasPointerCapture(ev.pointerId)) canvas.releasePointerCapture(ev.pointerId);
    } catch (e) { /* non-fatal */ }
    render(true);
    rebuildLayerList();
  }
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  canvas.addEventListener("dblclick", () => {
    const l = selected();
    if (l && l.type === "text") { $layerText.focus(); $layerText.select(); }
  });

  function resizeLayer(l, d, dx, dy, keepRatio) {
    const min = 20;
    const b = d.box;
    const hd = d.handle;
    if (l.type === "text" || l.type === "rule") {
      if (hd === "e") l.w = Math.max(min, Math.round(b.w + dx));
      if (hd === "w") {
        const nw = Math.max(min, Math.round(b.w - dx));
        l.x = Math.round(b.x + (b.w - nw));
        l.w = nw;
      }
      return;
    }
    let { x, y, w, h } = b;
    if (hd.includes("e")) w = Math.max(min, b.w + dx);
    if (hd.includes("s")) h = Math.max(min, b.h + dy);
    if (hd.includes("w")) { w = Math.max(min, b.w - dx); x = b.x + (b.w - w); }
    if (hd.includes("n")) { h = Math.max(min, b.h - dy); y = b.y + (b.h - h); }
    if (keepRatio && hd.length === 2 && b.h) {
      const ratio = b.w / b.h;
      h = w / ratio;
      if (hd.includes("n")) y = b.y + (b.h - h);
    }
    l.x = Math.round(x);
    l.y = Math.round(y);
    l.w = Math.round(w);
    l.h = Math.round(h);
  }

  function applySnap(l, nx, ny, disabled) {
    guides = [];
    if (disabled) return { x: nx, y: ny };
    const b = boxOf(l);
    const w = canvas.width;
    const h = canvas.height;
    const pd = pad();
    const thr = SNAP_PX / dispScale();

    const xTargets = [0, pd, w / 2, w - pd, w];
    const yTargets = [0, pd, h / 2, h - pd, h];
    panel().layers.forEach((o) => {
      if (o.id === l.id || !o.visible) return;
      const ob = boxOf(o);
      xTargets.push(ob.x, ob.x + ob.w / 2, ob.x + ob.w);
      yTargets.push(ob.y, ob.y + ob.h / 2, ob.y + ob.h);
    });

    let bestX = null;
    xTargets.forEach((t) => {
      [[nx, 0], [nx + b.w / 2, b.w / 2], [nx + b.w, b.w]].forEach((pair) => {
        const dist = Math.abs(pair[0] - t);
        if (dist <= thr && (!bestX || dist < bestX.dist)) bestX = { dist, at: t, val: t - pair[1] };
      });
    });
    let bestY = null;
    yTargets.forEach((t) => {
      [[ny, 0], [ny + b.h / 2, b.h / 2], [ny + b.h, b.h]].forEach((pair) => {
        const dist = Math.abs(pair[0] - t);
        if (dist <= thr && (!bestY || dist < bestY.dist)) bestY = { dist, at: t, val: t - pair[1] };
      });
    });
    if (bestX) guides.push({ axis: "x", at: bestX.at });
    if (bestY) guides.push({ axis: "y", at: bestY.at });
    return { x: bestX ? bestX.val : nx, y: bestY ? bestY.val : ny };
  }

  /* ── Keyboard ─────────────────────────────────────────────────── */

  canvas.addEventListener("keydown", (ev) => {
    const l = selected();
    if (!l) return;
    const step = ev.shiftKey ? 10 : 1;
    if (ev.key === "ArrowLeft") { l.x -= step; }
    else if (ev.key === "ArrowRight") { l.x += step; }
    else if (ev.key === "ArrowUp") { l.y -= step; }
    else if (ev.key === "ArrowDown") { l.y += step; }
    else if (ev.key === "Delete" || ev.key === "Backspace") { deleteLayer(l.id); ev.preventDefault(); return; }
    else if (ev.key === "Escape") { selectedId = null; refreshAll(); return; }
    else if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "d") { duplicateLayer(); ev.preventDefault(); return; }
    else return;
    ev.preventDefault();
    render(true);
    syncInspector();
  });

  function duplicateLayer() {
    const l = selected();
    if (!l) return;
    const copy = { ...l, id: nextId(),
      role: null,
      pin: null,
      x: l.x + Math.round(24 * unit()),
      y: l.y + Math.round(24 * unit()),};
    const list = panel().layers;
    list.splice(list.indexOf(l) + 1, 0, copy);
    selectedId = copy.id;
    refreshAll();
  }

  /* ── Wiring: canvas-level controls ────────────────────────────── */

  $modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => { setMode(btn.dataset.assetMode); });
  });

  $templates.forEach((btn) => {
    btn.addEventListener("click", () => { applyTemplate(btn.dataset.template); });
  });

  $bgSwatches.forEach((btn) => {
    btn.addEventListener("click", () => {
      panel().bg = btn.dataset.bg;
      refreshAll();
    });
  });
  $bgCustom.addEventListener("input", () => {
    panel().bg = $bgCustom.value;
    render(true);
  });

  $arrange.addEventListener("click", () => { autoArrange(); refreshAll(); });

  $addButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const kind = btn.dataset.assetAdd;
      if (kind === "image") { $layerFile.dataset.replace = ""; $layerFile.click(); return; }
      const fg = contrastOn(panel().bg);
      let layer;
      if (kind === "text") {
        layer = makeText({
          text: "New text", color: fg, size: Math.round(48 * unit()),
          y: Math.round(canvas.height * 0.4),
        });
      } else if (kind === "rule") layer = makeRule({ color: fg });
      else if (kind === "box") layer = makeBox({ color: fg });
      else layer = makeScrim({});
      panel().layers.push(layer);
      selectedId = layer.id;
      refreshAll();
    });
  });

  $layerFile.addEventListener("change", () => {
    const file = $layerFile.files[0];
    if (!file) return;
    const replaceId = $layerFile.dataset.replace;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const target = replaceId ? panel().layers.find((l) => l.id === replaceId) : null;
        if (target) {
          target.img = img;
        } else {
          const l = makeImage(img, {
            x: Math.round(canvas.width * 0.1),
            y: Math.round(canvas.height * 0.1),
            w: Math.round(canvas.width * 0.8),
            h: Math.round(canvas.width * 0.8 * (img.naturalHeight / img.naturalWidth)),
          });
          panel().layers.push(l);
          selectedId = l.id;
        }
        $layerFile.value = "";
        $layerFile.dataset.replace = "";
        refreshAll();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  /* ── Wiring: inspector ────────────────────────────────────────── */

  $layerText.addEventListener("input", () => {
    const l = selected();
    if (!l) return;
    withReflow(l, () => { l.text = $layerText.value; });
    render(true);
  });

  $layerText.addEventListener("keydown", (ev) => {
    if (!(ev.metaKey || ev.ctrlKey)) return;
    const key = ev.key.toLowerCase();
    const kind = key === "b" ? "bold" : key === "i" ? "italic" : key === "u" ? "underline" : null;
    if (!kind) return;
    ev.preventDefault();
    wrapSelection(kind);
  });

  root.querySelectorAll("[data-asset-fmt]").forEach((btn) => {
    btn.addEventListener("click", () => { wrapSelection(btn.dataset.assetFmt); });
  });

  root.querySelectorAll("[data-asset-style]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const l = selected();
      if (!l) return;
      const key = btn.dataset.assetStyle;
      withReflow(l, () => { l[key] = !l[key]; });
      refreshAll();
    });
  });

  root.querySelectorAll("[data-align]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const l = selected();
      if (!l) return;
      l.align = btn.dataset.align;
      refreshAll();
    });
  });

  root.querySelectorAll("[data-color]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const l = selected();
      if (!l) return;
      l.color = btn.dataset.color;
      refreshAll();
    });
  });

  const NUMERIC = ["size", "lineHeight", "tracking", "thickness", "radius", "zoom", "x", "y", "w", "h"];
  // Props that change how tall a text layer renders.
  const REFLOWING = ["size", "lineHeight", "tracking", "w", "font"];

  $inspector.addEventListener("input", (ev) => {
    const el = ev.target.closest("[data-asset-prop]");
    if (!el) return;
    const l = selected();
    if (!l) return;
    const key = el.dataset.assetProp;
    const apply = () => {
      if (key === "opacity") l.opacity = clamp(Number(el.value) / 100, 0, 1);
      else if (NUMERIC.includes(key)) l[key] = Number(el.value);
      else l[key] = el.value;
    };
    if (REFLOWING.includes(key)) withReflow(l, apply);
    else apply();
    render(true);
    syncInspector();
  });

  $inspector.addEventListener("change", (ev) => {
    if (ev.target.closest("[data-asset-prop]")) rebuildLayerList();
  });

  root.querySelectorAll("[data-crop]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const l = selected();
      if (!l || l.type !== "image") return;
      const step = Math.round(canvas.width * 0.02);
      const dir = btn.dataset.crop;
      if (dir === "up") l.offsetY -= step;
      if (dir === "down") l.offsetY += step;
      if (dir === "left") l.offsetX -= step;
      if (dir === "right") l.offsetX += step;
      if (dir === "reset") { l.offsetX = 0; l.offsetY = 0; l.zoom = 1; }
      render(true);
      syncInspector();
    });
  });

  root.querySelectorAll("[data-asset-center]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const l = selected();
      if (!l) return;
      const b = boxOf(l);
      if (btn.dataset.assetCenter === "h") l.x = Math.round((canvas.width - b.w) / 2);
      else l.y = Math.round((canvas.height - b.h) / 2);
      render(true);
      syncInspector();
    });
  });

  root.querySelector("[data-asset-fullbleed]").addEventListener("click", () => {
    const l = selected();
    if (!l) return;
    l.x = 0;
    l.y = 0;
    l.w = canvas.width;
    if (l.type !== "text" && l.type !== "rule") l.h = canvas.height;
    render(true);
    syncInspector();
  });

  root.querySelector("[data-asset-image-replace]").addEventListener("click", () => {
    const l = selected();
    if (!l || l.type !== "image") return;
    $layerFile.dataset.replace = l.id;
    $layerFile.click();
  });

  root.querySelector("[data-asset-duplicate]").addEventListener("click", duplicateLayer);
  root.querySelector("[data-asset-delete-layer]").addEventListener("click", () => {
    if (selectedId) deleteLayer(selectedId);
  });

  /* ── Panels ───────────────────────────────────────────────────── */

  $panelAdd.addEventListener("click", () => {
    if (panels.length >= MAX_PANELS) { status(`Maximum ${MAX_PANELS} panels.`, true); return; }
    const p = makePanelState();
    p.bg = panel().bg;
    panels.push(p);
    currentPanel = panels.length - 1;
    selectedId = null;
    applyTemplate("title-card");
  });

  $panelRemove.addEventListener("click", () => {
    if (panels.length <= 1) return;
    panels.splice(currentPanel, 1);
    if (currentPanel >= panels.length) currentPanel = panels.length - 1;
    selectedId = null;
    refreshAll();
  });

  /* ── Article pull ─────────────────────────────────────────────── */

  $pullBtn.addEventListener("click", pullArticle);
  $urlInput.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") { ev.preventDefault(); pullArticle(); }
  });

  function pullArticle() {
    const url = $urlInput.value.trim();
    if (!url) { status("Paste an article URL first.", true); return; }

    const previewId = extractPreviewId(url);
    if (previewId && !workerUrl) {
      status("Preview links need the admin worker URL configured for this theme.", true);
      return;
    }
    if (!previewId && !contentApiKey) {
      status("No Content API key configured for this theme.", true);
      return;
    }
    if (!previewId && !extractSlug(url)) {
      status("Could not read a slug from that URL.", true);
      return;
    }

    $pullBtn.disabled = true;
    $pullBtn.textContent = "Pulling...";
    status("");

    const load = previewId ? fetchPreview(previewId) : fetchPublished(extractSlug(url));
    load
      .then((post) => {
        setRole("title", post.title || "");
        setRole("subtitle", post.author || "");
        if (post.excerpt) setRole("body", post.excerpt);
        autoArrange();
        refreshAll();
        if (post.featureImage) loadArticleImage(post.featureImage);
        const draftNote = post.status && post.status !== "published" ? ` (${post.status})` : "";
        status(`Pulled “${post.title}”${draftNote}.`);
      })
      .catch((err) => { status(`Pull failed: ${err.message}`, true); })
      .finally(() => { $pullBtn.disabled = false; $pullBtn.textContent = "Pull"; });
  }

  // Published posts come straight from the Content API, keyed by slug.
  function fetchPublished(slug) {
    const apiUrl = `${siteUrl}/ghost/api/content/posts/slug/${slug}/?key=${contentApiKey}&include=authors,tags&formats=plaintext`;
    return fetch(apiUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`Ghost API ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const post = data.posts && data.posts[0];
        if (!post) throw new Error("No post found");
        const authorTags = (post.tags || [])
          .filter((t) => t.slug && t.slug.indexOf("author-") === 0)
          .map((t) => t.name);
        return {
          title: post.title || "",
          author: authorTags.length
            ? authorTags.join(", ")
            : (post.primary_author && post.primary_author.name) || "",
          excerpt: post.custom_excerpt || "",
          featureImage: post.feature_image || "",
          status: post.status || "published",
        };
      });
  }

  // A preview link points at a post that is usually still a draft, which
  // the Content API cannot see. The admin worker resolves it through the
  // Admin API under the caller's staff session.
  function fetchPreview(uuid) {
    if (!window.MOAuth || !window.MOAuth.fetch) {
      return Promise.reject(new Error("not signed in to MOAdmin"));
    }
    return window.MOAuth.fetch(`${workerUrl}/assets/lookup?uuid=${encodeURIComponent(uuid)}`)
      .then((r) => r.json().catch(() => null).then((body) => {
        if (r.ok) return body;
        // The route 404s until mo-admin ships the handler. Say so, rather
        // than reporting a bare status that reads like a bad link.
        if (r.status === 404 && !(body && body.error)) {
          throw new Error("preview lookup is not deployed yet — mo-admin needs a deploy");
        }
        throw new Error(body && body.error ? body.error : `worker ${r.status}`);
      }));
  }

  function setRole(role, text) {
    const l = panel().layers.find((x) => x.role === role);
    if (l) l.text = text;
  }

  // Ghost preview links are /p/<uuid>/, often with ?member_status= on
  // the end. The uuid is not a slug, so it has to be recognised before
  // the slug path or the Content API just 404s on it.
  function extractPreviewId(url) {
    try {
      const u = new URL(url, window.location.origin);
      const m = u.pathname.match(
        /^\/p\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i,
      );
      return m ? m[1].toLowerCase() : "";
    } catch (e) {
      return "";
    }
  }

  function extractSlug(url) {
    try {
      const u = new URL(url, window.location.origin);
      const parts = u.pathname.split("/").filter(Boolean);
      return parts[parts.length - 1] || "";
    } catch (e) {
      return "";
    }
  }

  function loadArticleImage(src) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const existing = panel().layers.find((l) => l.role === "image");
      if (existing) {
        existing.img = img;
      } else {
        const l = makeImage(img, { role: "image", x: 0, y: 0, w: canvas.width, h: Math.round(canvas.height * 0.5) });
        panel().layers.unshift(l);
        autoArrange();
      }
      refreshAll();
    };
    img.onerror = () => { status("Feature image could not be loaded.", true); };
    img.src = src;
  }

  /* ── Export ───────────────────────────────────────────────────── */

  function exportName(i) {
    return `mo-${mode}-${String(i + 1).padStart(2, "0")}.png`;
  }

  function downloadCanvas(filename) {
    let href;
    try {
      href = canvas.toDataURL("image/png");
    } catch (e) {
      status("Export blocked: an image on the canvas came from another domain. Upload it manually instead.", true);
      return false;
    }
    const link = document.createElement("a");
    link.download = filename;
    link.href = href;
    link.click();
    return true;
  }

  $exportBtn.addEventListener("click", () => {
    render(false);
    const ok = downloadCanvas(exportName(currentPanel));
    render(true);
    if (ok) status(`Downloaded ${exportName(currentPanel)}.`);
  });

  // Browsers throttle a burst of programmatic downloads and silently
  // drop the tail, so a 6-panel carousel could arrive as one file.
  // Space them out and only report what actually fired.
  $exportAllBtn.addEventListener("click", () => {
    const keep = currentPanel;
    const total = panels.length;
    let count = 0;
    $exportAllBtn.disabled = true;
    status(`Downloading ${total} panel${total === 1 ? "" : "s"}…`);

    const step = (i) => {
      if (i >= total) {
        currentPanel = keep;
        refreshAll();
        $exportAllBtn.disabled = false;
        status(`Downloaded ${count} of ${total} panel${total === 1 ? "" : "s"}.`);
        return;
      }
      currentPanel = i;
      render(false);
      if (downloadCanvas(exportName(i))) count += 1;
      setTimeout(() => step(i + 1), 250);
    };
    step(0);
  });

  /* ── Boot ─────────────────────────────────────────────────────── */

  panels = [makePanelState()];
  canvas.style.aspectRatio = `${MODES[mode].w} / ${MODES[mode].h}`;
  applyTemplate("title-card");

  // Web fonts land after first paint; metrics change, so re-measure.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { autoArrange(); render(true); });
  }
  window.addEventListener("resize", () => { render(true); });
})();
