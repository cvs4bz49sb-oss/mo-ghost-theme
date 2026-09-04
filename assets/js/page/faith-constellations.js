/*
 * Constellations — the map workspace on
 * /the-faith-received/research/ (the "Constellations" tab).
 *
 * WHAT IT DRAWS. Every shelf in the library has been read for the
 * Scripture it quotes, and each author, work and doctrinal topic
 * carries the resulting fingerprint. Two points sit near each other
 * when their fingerprints agree. The layout is NOT computed here: the
 * worker ships finished x/y coordinates in a 0-1000 box and this file
 * plots them. Running a force simulation in the browser over 2,600
 * nodes would draw a different picture on every load, which is the one
 * thing a map may not do.
 *
 * THE DATA. Three public GET routes on mo-tfr-library. No auth, no
 * cost, no LLM call:
 *
 *   /v1/mine/constellations/index.json
 *     -> { version, shelves: [ { shelf, slug, have: { authors, works,
 *          doctrines }, pages, authors, works } ] }
 *     `have` is the authority on which views a shelf has. A view a
 *     shelf lacks is a 404, not an empty map (measured 2026-09-04:
 *     augustinians/authors.json -> 404), so the picker offers only what
 *     `have` lists rather than letting the reader discover it by
 *     pressing a button that fails.
 *
 *   /v1/mine/constellations/{shelfSlug}/{authors|doctrines|works}.json
 *     -> { version, shelf, shelfWorks,
 *          nodes: [ { a, x, y, n, e, sub, pg, nr, w, t,
 *                     rows: [ { t, s, h, g } ] } ],
 *          edges: [ [fromIndex, toIndex, weight], … ],
 *          cats:  [ { k, l } ] }
 *
 * Four things about that payload are load-bearing, none of them are
 * uniform across the three views, and all four were measured against
 * the live endpoint rather than assumed:
 *
 *   - `e` (the category key) can be ABSENT. 9 of the 37 nodes in
 *     augustinians/doctrines carry no category. They are drawn as an
 *     open ring rather than a filled dot, and the legend says
 *     "Unclassified", because colouring them as one of the seven would
 *     be a claim the data does not make.
 *   - `w` and `t` (a work slug and its full title) exist ONLY in the
 *     `works` view, where the node itself IS a work. That is the only
 *     view whose node has a reader link of its own.
 *   - `rows[].h` is often missing. Every row in both `works` payloads
 *     sampled has none (they are Scripture chapters, not works), and 55
 *     of 861 rows in english-divines/authors have none either. A row
 *     without an `h` renders as plain text, never as a dead link.
 *   - `rows[].g` (a gloss) appears in the `doctrines` view only.
 *
 * READER LINKS. `rows[].h` arrives in the SOURCE site's URL shape,
 * `/read?w=<id>`, which is not ours. Ours is
 * /the-faith-received/reader/?c=<corpus>&w=<id>, and the `c` is
 * mandatory for every non-native collection: `?c=pld&w=2741`, never
 * `?w=pld-2741`. Getting it wrong produces a link that silently loads
 * nothing. readerUrlFromSlug() mirrors collectionFor() and
 * readerUrlFor() in website/workers/tfr-library/lib/collections.js,
 * which is the authority; read that file before touching the prefix
 * table. No `p=` is emitted: most of this corpus has no printed page
 * numbers, and the section ordinal the rest carry is not something the
 * reader can land on. Any `#fragment` on the source href is dropped as
 * well, since it addresses the source site's own block ids.
 *
 * ACCESS. Not gated, deliberately. These are static JSON files on a
 * public route; nothing here spends an embedding call or reaches an
 * LLM, which is what the standing both-sides gating rule is about, and
 * the panel is the same shape as Bookmarks in that respect. Adding
 * data-feature-gate would tell a free reader they cannot have something
 * the worker hands to anyone with curl. Note for whoever revisits this:
 * the page's own "For members" list does name Constellations, so if it
 * is meant to be paid-only the gate belongs on the worker route first
 * and here second.
 *
 * RENDERING. Everything below crossed the network. Built with
 * createElement + textContent throughout, so there is no escaping step
 * to forget and no path from a server string to markup at all; each
 * URL goes through MOSafeHref. Same shape as
 * assets/js/page/faith-power-search.js.
 *
 * Loaded as a page-template script (FRONTEND §6.18): runs before
 * site.min.js and touches no bundle global. window.MOSafeHref ships in
 * boot.min.js in <head> and is already present.
 */
(function () {
  const root = document.querySelector("[data-cn-root]");
  if (!root) return;
  // Idempotent: this partial ships its own <script>, so a host page
  // that also loads the file must not bind twice.
  if (root.getAttribute("data-cn-bound") === "1") return;
  root.setAttribute("data-cn-bound", "1");

  const WORKER = "https://mo-tfr-library.mo-podcast-feed.workers.dev";
  const BASE = `${WORKER}/v1/mine/constellations`;
  const READER = "/the-faith-received/reader/";

  /* ── DOM contract ─────────────────────────────────────────────────
   * Every querySelector in this file, in one place. The partial's
   * header lists the same set; keep the two together. */
  const shelfSel = root.querySelector("[data-cn-shelf]");
  const viewBtns = Array.from(root.querySelectorAll("[data-cn-view]"));
  const viewsNote = root.querySelector("[data-cn-views-note]");
  const statusEl = root.querySelector("[data-cn-status]");
  const errorEl = root.querySelector("[data-cn-error]");
  const stageEl = root.querySelector("[data-cn-stage]");
  const canvas = root.querySelector("[data-cn-canvas]");
  const zoomInBtn = root.querySelector("[data-cn-zoom-in]");
  const zoomOutBtn = root.querySelector("[data-cn-zoom-out]");
  const resetBtn = root.querySelector("[data-cn-reset]");
  const legendEl = root.querySelector("[data-cn-legend]");
  const captionEl = root.querySelector("[data-cn-caption]");
  const dossierEl = root.querySelector("[data-cn-dossier]");
  const indexEl = root.querySelector("[data-cn-index]");
  const indexFilter = root.querySelector("[data-cn-index-filter]");
  const indexListEl = root.querySelector("[data-cn-index-list]");
  const indexNoteEl = root.querySelector("[data-cn-index-note]");
  const liveEl = root.querySelector("[data-cn-live]");

  if (!canvas || !stageEl || !shelfSel) return;
  const ctx = canvas.getContext ? canvas.getContext("2d") : null;
  if (!ctx) return;

  /* ── Palette ──────────────────────────────────────────────────────
   *
   * Seven category swatches, read from the custom properties the
   * stylesheet defines on [data-cn-root] rather than written here, so
   * the colours sit in one auditable place with the rest of the theme's
   * tokens (DESIGN §3a M1). Custom properties resolve as authored text,
   * which is why they are plain hex there and why canvas can take them
   * directly. The literals below are a fallback for a stylesheet that
   * failed to load, never a second source of truth.
   *
   * The accent (--color-primary) is deliberately NOT in the ramp: it
   * means "this is the one you chose" and nothing else. It is also
   * 2.38:1 on the cream plot ground and would fail WCAG 1.4.11 as a
   * 3px dot; every one of the seven clears 3:1 there.
   */
  const CAT_FALLBACK = ["#2d2927", "#b45f3d", "#7d6f57", "#9c4126", "#6b6660", "#c1593c", "#8a7a62"];
  let catColors = CAT_FALLBACK.slice();
  let edgeColor = "#6b6660";
  let ghostColor = "#d9c6a7";
  let accentColor = "#ee7d51";
  let inkColor = "#2d2927";
  let paperColor = "#f5efe1";

  function readPalette() {
    let cs;
    try {
      cs = window.getComputedStyle(root);
    } catch (_) {
      return;
    }
    const pick = (name, fallback) => {
      const v = (cs.getPropertyValue(name) || "").trim();
      return v || fallback;
    };
    catColors = CAT_FALLBACK.map((f, i) => pick(`--cn-cat-${i + 1}`, f));
    edgeColor = pick("--cn-edge", edgeColor);
    ghostColor = pick("--cn-ghost", ghostColor);
    accentColor = pick("--cn-accent", accentColor);
    inkColor = pick("--cn-ink", inkColor);
    paperColor = pick("--cn-paper", paperColor);
  }

  /* ── Reader links ─────────────────────────────────────────────────
   *
   * Mirrors collectionFor() in tfr-library/lib/collections.js. `cut` is
   * the length of the prefix INCLUDING its hyphen, because the reader
   * addresses these collections by their own bare id. Anything without
   * a known prefix is the native collection and takes no `c=` at all.
   */
  const PREFIXES = [
    { re: /^pld-/, corpus: "pld", cut: 4 },
    { re: /^eebo-/, corpus: "eebo", cut: 5 },
    { re: /^pg-/, corpus: "pg", cut: 3 },
    { re: /^po-/, corpus: "po", cut: 3 },
    { re: /^mo-/, corpus: "mo", cut: 3 },
  ];

  function readerUrlFromSlug(slug) {
    const s = typeof slug === "string" ? slug.trim() : "";
    if (!s) return "";
    for (let i = 0; i < PREFIXES.length; i++) {
      const p = PREFIXES[i];
      if (p.re.test(s)) {
        return `${READER}?c=${p.corpus}&w=${encodeURIComponent(s.slice(p.cut))}`;
      }
    }
    return `${READER}?w=${encodeURIComponent(s)}`;
  }

  // The source href is "/read?w=<id>", sometimes with a "#b1-0" block
  // anchor that means nothing on our side. Pulled out by hand rather
  // than through new URL(): the value is data, its shape is fixed, and
  // a regex cannot be talked into resolving against the current origin.
  function slugFromSourceHref(h) {
    if (typeof h !== "string" || !h) return "";
    const m = /[?&]w=([^&#]+)/.exec(h);
    if (!m) return "";
    try {
      return decodeURIComponent(m[1]);
    } catch (_) {
      return m[1];
    }
  }

  function readerUrlFromSourceHref(h) {
    const slug = slugFromSourceHref(h);
    return slug ? readerUrlFromSlug(slug) : "";
  }

  /* ── Copy that depends on the view ───────────────────────────── */

  const VIEW_LABEL = { authors: "Authors", doctrines: "Doctrines", works: "Works" };
  const VIEW_BLURB = {
    authors:
      "Each point is an author on this shelf, placed by which parts of Scripture they quote. Two authors sit close together when they quote alike.",
    works:
      "Each point is a work on this shelf, placed by which parts of Scripture it quotes. Two works sit close together when they quote alike.",
    doctrines:
      "Each point is a doctrinal topic on this shelf, placed by the passages that carry it. Two topics sit close together when they rest on the same texts.",
  };
  const ROWS_HEADING = {
    authors: "Principal works",
    works: "Most cited chapters",
    doctrines: "Passages",
  };
  const NODE_NOUN = { authors: "author", works: "work", doctrines: "topic" };

  /* ── State ────────────────────────────────────────────────────── */

  let shelves = [];
  let shelfSlug = "";
  let view = "";
  let nodes = [];
  let edges = [];
  let cats = [];
  let catIndex = {}; // category key -> ramp slot
  let hiddenCats = {}; // category key ("" for unclassified) -> true
  let selected = -1;
  let hovered = -1;
  let loadToken = 0;
  let indexBuilt = false;

  const cache = new Map();

  // The view transform, in screen pixels. `scale()` is the fitted base
  // scale times the reader's zoom; panX/panY move the fitted centre.
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let baseScale = 1;
  let cx = 500;
  let cy = 500;
  let spanX = 1000;
  let spanY = 1000;
  let cssW = 0;
  let cssH = 0;

  const MIN_ZOOM = 1;
  const MAX_ZOOM = 12;

  /* ── Status, error, and the rule that an empty state is a claim ──
   *
   * FRONTEND §6.33: a failed fetch is never allowed to paint "nothing
   * here". showError() clears the map and says which failure it was. */
  function setStatus(message) {
    if (!statusEl) return;
    if (!message) {
      statusEl.hidden = true;
      statusEl.textContent = "";
      return;
    }
    statusEl.hidden = false;
    statusEl.textContent = message;
  }

  function showError(message) {
    setStatus("");
    if (!errorEl) return;
    errorEl.hidden = false;
    errorEl.textContent = message;
  }

  function clearError() {
    if (!errorEl) return;
    errorEl.hidden = true;
    errorEl.textContent = "";
  }

  function announce(message) {
    if (liveEl) liveEl.textContent = message;
  }

  function fmt(n) {
    return Number(n || 0).toLocaleString("en-US");
  }

  /* ── Geometry ─────────────────────────────────────────────────── */

  function measure() {
    const rect = stageEl.getBoundingClientRect();
    cssW = Math.max(0, Math.round(rect.width));
    cssH = Math.max(0, Math.round(rect.height));
    if (!cssW || !cssH) return false;
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    // setTransform, not scale(): this runs on every resize and a
    // cumulative scale() would compound.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }

  const PAD = 26;

  function fit() {
    if (!nodes.length || !cssW || !cssH) return;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    }
    // One node, or every node stacked on one coordinate, gives a zero
    // span and a scale of Infinity.
    spanX = Math.max(1, maxX - minX);
    spanY = Math.max(1, maxY - minY);
    cx = (minX + maxX) / 2;
    cy = (minY + maxY) / 2;
    baseScale = Math.min((cssW - PAD * 2) / spanX, (cssH - PAD * 2) / spanY);
    if (!isFinite(baseScale) || baseScale <= 0) baseScale = 1;
  }

  function scale() {
    return baseScale * zoom;
  }

  /* ── Node radius ──────────────────────────────────────────────────
   *
   * Log, not linear and not sqrt. `n` spans 12 to 62,039 across the
   * shelves measured and is heavily bottom-weighted, so a linear or
   * sqrt map leaves nine points in ten at the floor radius and the map
   * reads as uniform. Radius is in SCREEN pixels and does not scale
   * with zoom: zooming is for separating crowded points, and dots that
   * grow with it turn a dense region into one blob at every
   * magnification.
   */
  let logMin = 0;
  let logSpan = 1;

  function computeWeights() {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const v = Math.log(Math.max(1, nodes[i].n || 1));
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    logMin = isFinite(lo) ? lo : 0;
    logSpan = Math.max(0.0001, (isFinite(hi) ? hi : 1) - logMin);
  }

  function radiusFor(n) {
    const small = cssW < 520;
    const rMin = small ? 2.2 : 2.6;
    const rMax = small ? 7 : 9.5;
    const t = (Math.log(Math.max(1, n || 1)) - logMin) / logSpan;
    return rMin + (rMax - rMin) * Math.max(0, Math.min(1, t));
  }

  /* ── Categories ───────────────────────────────────────────────── */

  function catKeyOf(node) {
    return typeof node.e === "string" && node.e ? node.e : "";
  }

  function slotOf(node) {
    const slot = catIndex[catKeyOf(node)];
    return typeof slot === "number" ? slot : -1;
  }

  function isVisible(node) {
    return !hiddenCats[catKeyOf(node)];
  }

  /* ── Drawing ──────────────────────────────────────────────────────
   *
   * Synchronous, not deferred through requestAnimationFrame. rAF does
   * not fire in a hidden tab (FRONTEND §6.30) and a map that has to be
   * verifiable in a harness cannot afford a draw path that never runs
   * there. The cost does not need it: edges go out as four batched
   * paths, one per alpha tier, rather than 3,753 separate strokes, and
   * the nodes are grouped by colour so fillStyle changes eight times
   * rather than 2,600.
   */
  const EDGE_TIERS = [
    { max: 0.5, alpha: 0.07 },
    { max: 0.65, alpha: 0.11 },
    { max: 0.8, alpha: 0.17 },
    { max: Infinity, alpha: 0.26 },
  ];

  function draw() {
    if (!cssW || !cssH) return;
    ctx.clearRect(0, 0, cssW, cssH);
    if (!nodes.length) return;

    const s = scale();
    const margin = 40;

    // Screen positions once per frame; the edge pass and the node pass
    // both need them.
    const px = new Float64Array(nodes.length);
    const py = new Float64Array(nodes.length);
    const onScreen = new Uint8Array(nodes.length);
    for (let i = 0; i < nodes.length; i++) {
      const x = (nodes[i].x - cx) * s + cssW / 2 + panX;
      const y = (nodes[i].y - cy) * s + cssH / 2 + panY;
      px[i] = x;
      py[i] = y;
      onScreen[i] = x >= -margin && x <= cssW + margin && y >= -margin && y <= cssH + margin ? 1 : 0;
    }

    // Edges. An edge is drawn only when both of its ends are showing:
    // if either end's category is switched off the edge goes with it,
    // so the legend filter cannot leave a line hanging off a point that
    // is no longer there.
    ctx.lineWidth = 1;
    ctx.strokeStyle = edgeColor;
    for (let t = 0; t < EDGE_TIERS.length; t++) {
      const tier = EDGE_TIERS[t];
      const lo = t === 0 ? -Infinity : EDGE_TIERS[t - 1].max;
      ctx.globalAlpha = tier.alpha;
      ctx.beginPath();
      let any = false;
      for (let i = 0; i < edges.length; i++) {
        const e = edges[i];
        const w = e[2];
        if (!(w > lo && w <= tier.max)) continue;
        const a = e[0];
        const b = e[1];
        if (!onScreen[a] && !onScreen[b]) continue;
        if (!isVisible(nodes[a]) || !isVisible(nodes[b])) continue;
        ctx.moveTo(px[a], py[a]);
        ctx.lineTo(px[b], py[b]);
        any = true;
      }
      if (any) ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Filtered-out points stay on the map as faint marks. Removing them
    // outright would make the shelf appear to lose half its contents
    // whenever the legend is used.
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = ghostColor;
    ctx.beginPath();
    let anyGhost = false;
    for (let i = 0; i < nodes.length; i++) {
      if (!onScreen[i] || isVisible(nodes[i])) continue;
      ctx.moveTo(px[i] + 2, py[i]);
      ctx.arc(px[i], py[i], 2, 0, Math.PI * 2);
      anyGhost = true;
    }
    if (anyGhost) ctx.fill();
    ctx.globalAlpha = 1;

    // Each moveTo before an arc is load-bearing: without it, canvas
    // joins consecutive arcs in one path with a straight line.
    for (let c = 0; c < catColors.length; c++) {
      ctx.fillStyle = catColors[c];
      ctx.beginPath();
      let any = false;
      for (let i = 0; i < nodes.length; i++) {
        if (!onScreen[i]) continue;
        const node = nodes[i];
        if (!isVisible(node) || slotOf(node) !== c) continue;
        const r = radiusFor(node.n);
        ctx.moveTo(px[i] + r, py[i]);
        ctx.arc(px[i], py[i], r, 0, Math.PI * 2);
        any = true;
      }
      if (any) ctx.fill();
    }

    // Unclassified: an open ring. "We do not know" is not one of the
    // seven answers and must not be painted as though it were.
    ctx.strokeStyle = edgeColor;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    let anyRing = false;
    for (let i = 0; i < nodes.length; i++) {
      if (!onScreen[i]) continue;
      const node = nodes[i];
      if (!isVisible(node) || slotOf(node) >= 0) continue;
      const r = radiusFor(node.n);
      ctx.moveTo(px[i] + r, py[i]);
      ctx.arc(px[i], py[i], r, 0, Math.PI * 2);
      anyRing = true;
    }
    if (anyRing) ctx.stroke();

    // Selection, then hover. Rings rather than a colour change, so the
    // category colour is never overwritten by interaction state.
    if (selected >= 0 && selected < nodes.length && isVisible(nodes[selected])) {
      ring(px[selected], py[selected], radiusFor(nodes[selected].n) + 4, accentColor, 2);
    }
    if (hovered >= 0 && hovered < nodes.length && hovered !== selected && isVisible(nodes[hovered])) {
      ring(px[hovered], py[hovered], radiusFor(nodes[hovered].n) + 4, inkColor, 1.5);
    }

    const labelFor = hovered >= 0 ? hovered : selected;
    if (labelFor >= 0 && labelFor < nodes.length && isVisible(nodes[labelFor])) {
      drawLabel(nodes[labelFor].a, px[labelFor], py[labelFor], radiusFor(nodes[labelFor].n));
    }
  }

  function ring(x, y, r, color, width) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  /*
   * The hover label is painted on the canvas rather than positioned as
   * a DOM tooltip: it cannot then be clipped by the stage's overflow,
   * cannot force a layout on every pointer move, and cannot sit under
   * the pointer and swallow the click. The screen-reader path is the
   * index list further down, not this.
   *
   * Drawn from the top of the line box (textBaseline "top") so the
   * plate is exactly the height of the text and the two cannot drift
   * apart (FRONTEND §6.34).
   */
  function drawLabel(text, x, y, r) {
    const label = String(text == null ? "" : text).slice(0, 90);
    if (!label) return;
    const fontSize = 12;
    ctx.font = `${fontSize}px "Source Serif Pro", Georgia, serif`;
    ctx.textBaseline = "top";
    const padX = 7;
    const padY = 5;
    const w = ctx.measureText(label).width + padX * 2;
    const h = fontSize + padY * 2 + 2;

    let lx = x + r + 8;
    let ly = y - h / 2;
    // Flip and clamp rather than letting the plate run off the stage.
    if (lx + w > cssW - 4) lx = x - r - 8 - w;
    if (lx < 4) lx = 4;
    if (ly < 4) ly = 4;
    if (ly + h > cssH - 4) ly = Math.max(4, cssH - 4 - h);

    ctx.globalAlpha = 0.94;
    ctx.fillStyle = inkColor;
    ctx.fillRect(lx, ly, w, h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = paperColor;
    ctx.fillText(label, lx + padX, ly + padY);
  }

  /* ── Hit testing ──────────────────────────────────────────────────
   *
   * A linear scan. At 2,600 nodes that is a few thousand comparisons
   * per pointer move, cheaper than maintaining a quadtree that would
   * have to be rebuilt on every shelf change. Filtered-out points are
   * skipped, so a ghosted mark cannot be clicked.
   */
  function hitTest(mx, my) {
    const s = scale();
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (!isVisible(node)) continue;
      const dx = mx - ((node.x - cx) * s + cssW / 2 + panX);
      const dy = my - ((node.y - cy) * s + cssH / 2 + panY);
      const d2 = dx * dx + dy * dy;
      // The drawn radius plus enough slack for a fingertip on the
      // smallest dots.
      const reach = Math.max(radiusFor(node.n) + 4, 11);
      if (d2 <= reach * reach && d2 < bestDist) {
        bestDist = d2;
        best = i;
      }
    }
    return best;
  }

  /* ── The dossier ──────────────────────────────────────────────── */

  function textEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null) el.textContent = text;
    return el;
  }

  function renderDossierEmpty() {
    if (!dossierEl) return;
    dossierEl.textContent = "";
    dossierEl.appendChild(
      textEl("p", "cn-dossier-empty", "Choose a point to see what stands behind it.")
    );
  }

  function renderDossier(i) {
    if (!dossierEl) return;
    const node = nodes[i];
    if (!node) {
      renderDossierEmpty();
      return;
    }
    dossierEl.textContent = "";

    const key = catKeyOf(node);
    const cat = cats.find((c) => c && c.k === key);
    dossierEl.appendChild(textEl("p", "cn-dossier-kicker", cat && cat.l ? cat.l : "Unclassified"));
    dossierEl.appendChild(textEl("h3", "cn-dossier-title", node.t || node.a || "Untitled"));
    if (node.sub) dossierEl.appendChild(textEl("p", "cn-dossier-sub", node.sub));

    // The `works` view is the only one whose node is itself a work, and
    // so the only one with a reader link of its own.
    if (node.w) {
      const url = readerUrlFromSlug(node.w);
      if (url) {
        const p = document.createElement("p");
        p.className = "cn-dossier-open";
        const a = document.createElement("a");
        a.className = "cn-open-link";
        window.MOSafeHref.set(a, url, "#");
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = "Open in the reader";
        p.appendChild(a);
        dossierEl.appendChild(p);
      }
    }

    const rows = Array.isArray(node.rows) ? node.rows : [];
    if (!rows.length) return;

    dossierEl.appendChild(
      textEl("p", "cn-dossier-heading", ROWS_HEADING[view] || "Behind this point")
    );
    const ul = document.createElement("ul");
    ul.className = "cn-rows";
    rows.forEach((r) => {
      const li = document.createElement("li");
      li.className = "cn-row";
      const url = readerUrlFromSourceHref(r && r.h);
      const title = (r && r.t) || "Untitled";
      if (url) {
        const a = document.createElement("a");
        a.className = "cn-row-title cn-row-link";
        window.MOSafeHref.set(a, url, "#");
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = title;
        li.appendChild(a);
      } else {
        // No href on the row. A span, never an <a href="#">: a link
        // that goes nowhere is worse than a line of text that never
        // claimed to.
        li.appendChild(textEl("span", "cn-row-title", title));
      }
      if (r && r.s) li.appendChild(textEl("span", "cn-row-meta", r.s));
      if (r && r.g) li.appendChild(textEl("span", "cn-row-gloss", r.g));
      ul.appendChild(li);
    });
    dossierEl.appendChild(ul);
  }

  function select(i, opts) {
    selected = i;
    renderDossier(i);
    if (i >= 0 && nodes[i]) {
      announce(`${nodes[i].a || "Point"} selected.`);
      if (opts && opts.centre) centreOn(i);
    }
    draw();
  }

  function clearSelection() {
    selected = -1;
    renderDossierEmpty();
  }

  function centreOn(i) {
    const node = nodes[i];
    if (!node || !cssW) return;
    if (zoom < 2) zoom = 2;
    panX = -(node.x - cx) * scale();
    panY = -(node.y - cy) * scale();
    clampPan();
    syncTouchAction();
  }

  /* ── Pan and zoom ─────────────────────────────────────────────────
   *
   * Deliberately conservative on the wheel. A plain two-finger scroll
   * over the map SCROLLS THE PAGE, as it does everywhere else; only a
   * pinch (which a trackpad reports as a wheel event with ctrlKey set)
   * or a held modifier zooms. Hijacking page scroll is the usual way a
   * map like this comes to feel broken, and the buttons mean nothing
   * depends on the gesture being discovered.
   */
  function clampPan() {
    // At zoom 1 the fitted layout already fills the stage, so there is
    // nowhere to pan and drifting off-centre only loses the map. Past
    // that, half a stage of overscroll in each direction.
    if (zoom <= MIN_ZOOM) {
      panX = 0;
      panY = 0;
      return;
    }
    const s = scale();
    const limX = (spanX * s) / 2 + cssW / 2;
    const limY = (spanY * s) / 2 + cssH / 2;
    panX = Math.max(-limX, Math.min(limX, panX));
    panY = Math.max(-limY, Math.min(limY, panY));
  }

  function zoomAt(factor, sx, sy) {
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
    if (next === zoom) return;
    const before = scale();
    const wx = (sx - cssW / 2 - panX) / before + cx;
    const wy = (sy - cssH / 2 - panY) / before + cy;
    zoom = next;
    const after = scale();
    panX = sx - cssW / 2 - (wx - cx) * after;
    panY = sy - cssH / 2 - (wy - cy) * after;
    clampPan();
    syncTouchAction();
    draw();
  }

  function resetView() {
    zoom = 1;
    panX = 0;
    panY = 0;
    syncTouchAction();
    draw();
  }

  /*
   * touch-action is switched rather than fixed. At zoom 1 the whole map
   * is on screen and there is nothing to pan to, so the canvas keeps
   * `pan-y` and a finger dragged down the page scrolls the page as it
   * should. Once zoomed in, panning is the point, so it becomes `none`.
   * A canvas that is permanently `touch-action: none` is a trap on a
   * phone; one that is permanently `pan-y` can never be panned.
   */
  function syncTouchAction() {
    canvas.style.touchAction = zoom > MIN_ZOOM ? "none" : "pan-y";
  }

  let dragging = false;
  let dragMoved = false;
  let dragId = null;
  let dragX = 0;
  let dragY = 0;

  function localPoint(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (e.button != null && e.button !== 0) return;
    const p = localPoint(e);
    dragging = true;
    dragMoved = false;
    dragId = e.pointerId;
    dragX = p.x;
    dragY = p.y;
    // setPointerCapture throws on a pointer id it does not consider
    // active, and the throw would take the rest of this handler with it
    // (FRONTEND §6.34). Capture is a convenience, not a precondition.
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) { /* capture unavailable; the move handler still works */ }
  });

  canvas.addEventListener("pointermove", (e) => {
    const p = localPoint(e);
    if (dragging && e.pointerId === dragId) {
      const dx = p.x - dragX;
      const dy = p.y - dragY;
      if (!dragMoved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) dragMoved = true;
      if (dragMoved) {
        if (zoom > MIN_ZOOM) {
          panX += dx;
          panY += dy;
          clampPan();
        }
        dragX = p.x;
        dragY = p.y;
        draw();
      }
      return;
    }
    const hit = hitTest(p.x, p.y);
    if (hit !== hovered) {
      hovered = hit;
      canvas.style.cursor = hit >= 0 ? "pointer" : "default";
      draw();
    }
  });

  function endDrag(e) {
    if (!dragging) return;
    if (e && e.pointerId !== dragId) return;
    dragging = false;
    dragId = null;
    try {
      if (e) canvas.releasePointerCapture(e.pointerId);
    } catch (_) { /* nothing was captured */ }
  }

  canvas.addEventListener("pointerup", (e) => {
    const wasDrag = dragMoved;
    endDrag(e);
    if (wasDrag) return;
    const p = localPoint(e);
    const hit = hitTest(p.x, p.y);
    if (hit >= 0) {
      select(hit);
    } else {
      clearSelection();
      draw();
    }
    syncIndexSelection();
  });

  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("pointerleave", (e) => {
    endDrag(e);
    if (hovered !== -1) {
      hovered = -1;
      draw();
    }
  });

  canvas.addEventListener(
    "wheel",
    (e) => {
      if (!e.ctrlKey && !e.metaKey) return; // let the page scroll
      e.preventDefault();
      const p = localPoint(e);
      zoomAt(e.deltaY < 0 ? 1.16 : 1 / 1.16, p.x, p.y);
    },
    { passive: false }
  );

  // The canvas is focusable so the map is not an island in the tab
  // order for someone who reads it visually but drives with a keyboard.
  // The path for anyone who cannot see it is the index list.
  canvas.addEventListener("keydown", (e) => {
    const step = 40;
    let handled = true;
    if (e.key === "ArrowLeft") panX += step;
    else if (e.key === "ArrowRight") panX -= step;
    else if (e.key === "ArrowUp") panY += step;
    else if (e.key === "ArrowDown") panY -= step;
    else if (e.key === "+" || e.key === "=") zoomAt(1.25, cssW / 2, cssH / 2);
    else if (e.key === "-" || e.key === "_") zoomAt(1 / 1.25, cssW / 2, cssH / 2);
    else if (e.key === "0") resetView();
    else handled = false;
    if (!handled) return;
    e.preventDefault();
    clampPan();
    draw();
  });

  if (zoomInBtn) zoomInBtn.addEventListener("click", () => zoomAt(1.35, cssW / 2, cssH / 2));
  if (zoomOutBtn) zoomOutBtn.addEventListener("click", () => zoomAt(1 / 1.35, cssW / 2, cssH / 2));
  if (resetBtn) resetBtn.addEventListener("click", resetView);

  /* ── Legend ───────────────────────────────────────────────────────
   *
   * Also the filter. Seven warm swatches from a closed palette cannot
   * be told apart reliably at a 3px dot, so colour is never the only
   * channel: pressing a legend entry isolates its category, the dossier
   * names the category in words, and unclassified points differ in
   * shape as well as colour. WCAG 1.4.1 in practice rather than on
   * paper.
   */
  function renderLegend() {
    if (!legendEl) return;
    legendEl.textContent = "";
    if (!cats.length && !nodes.length) return;

    const entries = cats.filter((c) => c && typeof c.k === "string");
    if (nodes.some((n) => !catKeyOf(n))) entries.push({ k: "", l: "Unclassified" });

    entries.forEach((c) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cn-legend-item";
      const on = !hiddenCats[c.k];
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      if (!on) btn.classList.add("is-off");

      const dot = document.createElement("span");
      dot.className = "cn-legend-dot";
      dot.setAttribute("aria-hidden", "true");
      const slot = catIndex[c.k];
      if (typeof slot === "number") dot.style.background = catColors[slot % catColors.length];
      else dot.classList.add("cn-legend-dot--ring");
      btn.appendChild(dot);
      btn.appendChild(textEl("span", "cn-legend-label", c.l || "Unclassified"));

      btn.addEventListener("click", () => {
        const off = !hiddenCats[c.k];
        if (off) hiddenCats[c.k] = true;
        else delete hiddenCats[c.k];
        // Updated in place rather than by re-rendering the legend.
        // Rebuilding replaces the button that was just pressed, and a
        // keyboard user who activates a toggle then finds focus on
        // <body> has lost their place in the page with no way back but
        // to start tabbing again. Measured 2026-09-04: the rebuild sent
        // document.activeElement to body every time.
        btn.setAttribute("aria-pressed", off ? "false" : "true");
        btn.classList.toggle("is-off", off);
        // A selection that has just been filtered off the map must not
        // stay in the dossier claiming to be on it.
        if (selected >= 0 && nodes[selected] && !isVisible(nodes[selected])) clearSelection();
        renderIndex();
        renderCaption();
        draw();
      });

      legendEl.appendChild(btn);
    });
  }

  /* ── The index: the keyboard and screen-reader path ───────────────
   *
   * A canvas is opaque to assistive technology, so every point is also
   * a real focusable button here and pressing one does exactly what
   * clicking the dot does. Capped and paired with a filter box rather
   * than rendering all 2,600 at once: 2,600 buttons is a slow
   * disclosure and an unusable one to arrow through, and the filter
   * searches the WHOLE set, so nothing is unreachable. The cap is
   * stated on screen rather than left to be discovered.
   */
  const INDEX_CAP = 200;

  // Held so the selected state can be repainted WITHOUT rebuilding the
  // list. Same reason as the legend: the button a keyboard user just
  // pressed must still be there, and still be focused, afterwards.
  let indexButtons = [];

  function syncIndexSelection() {
    for (let k = 0; k < indexButtons.length; k++) {
      const entry = indexButtons[k];
      const on = entry.i === selected;
      entry.el.classList.toggle("is-selected", on);
      entry.el.setAttribute("aria-pressed", on ? "true" : "false");
    }
  }

  function visibleOrder() {
    const out = [];
    for (let i = 0; i < nodes.length; i++) {
      if (isVisible(nodes[i])) out.push(i);
    }
    out.sort((a, b) => (nodes[b].n || 0) - (nodes[a].n || 0));
    return out;
  }

  function renderIndex() {
    if (!indexListEl || !indexBuilt) return;
    indexListEl.textContent = "";
    indexButtons = [];

    const q = indexFilter ? (indexFilter.value || "").trim().toLowerCase() : "";
    let order = visibleOrder();
    if (q) {
      order = order.filter((i) => {
        const n = nodes[i];
        return (
          String(n.a || "").toLowerCase().indexOf(q) >= 0 ||
          String(n.sub || "").toLowerCase().indexOf(q) >= 0
        );
      });
    }

    const total = order.length;
    const shown = order.slice(0, INDEX_CAP);

    shown.forEach((i) => {
      const li = document.createElement("li");
      li.className = "cn-index-row";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cn-index-btn";
      if (i === selected) btn.classList.add("is-selected");
      btn.setAttribute("aria-pressed", i === selected ? "true" : "false");
      btn.appendChild(textEl("span", "cn-index-name", nodes[i].a || "Untitled"));
      if (nodes[i].sub) btn.appendChild(textEl("span", "cn-index-sub", nodes[i].sub));
      btn.addEventListener("click", () => {
        select(i, { centre: true });
        syncIndexSelection();
      });
      // Focus is the keyboard's hover: arrowing down the list moves the
      // label around the map, which is the only way someone who cannot
      // use a pointer gets the "where is this one?" answer at all.
      btn.addEventListener("focus", () => {
        hovered = i;
        draw();
      });
      btn.addEventListener("blur", () => {
        if (hovered !== i) return;
        hovered = -1;
        draw();
      });
      li.appendChild(btn);
      indexListEl.appendChild(li);
      indexButtons.push({ i, el: btn });
    });

    if (!indexNoteEl) return;
    if (!total) {
      // Three different reasons for an empty list, and they are not
      // interchangeable (FRONTEND §6.33). With no nodes at all the view
      // failed to load or was never mined, and [data-cn-error] above is
      // already saying which; this line stays silent rather than
      // blaming a legend the reader never touched. Measured 2026-09-04:
      // it did exactly that on a 404 before this branch existed.
      if (!nodes.length) indexNoteEl.textContent = "";
      else if (q) indexNoteEl.textContent = `Nothing on this shelf matches “${q}”.`;
      else indexNoteEl.textContent = "Every category is switched off in the legend.";
    } else if (total > shown.length) {
      indexNoteEl.textContent = `Showing the ${shown.length} largest of ${fmt(total)}. Filter to reach the rest.`;
    } else {
      indexNoteEl.textContent = `${fmt(total)} ${total === 1 ? "point" : "points"}.`;
    }
  }

  if (indexEl) {
    // Built on first disclosure, not on load: a shelf change while the
    // list is closed should not pay for 200 buttons nobody asked for.
    indexEl.addEventListener("toggle", () => {
      if (!indexEl.open || indexBuilt) return;
      indexBuilt = true;
      renderIndex();
    });
  }
  if (indexFilter) indexFilter.addEventListener("input", renderIndex);

  /* ── Caption ──────────────────────────────────────────────────── */

  function renderCaption() {
    if (!captionEl) return;
    captionEl.textContent = "";
    if (!nodes.length) return;
    const noun = NODE_NOUN[view] || "point";
    let visible = 0;
    for (let i = 0; i < nodes.length; i++) {
      if (isVisible(nodes[i])) visible++;
    }
    const count =
      visible === nodes.length
        ? `${fmt(nodes.length)} ${noun}${nodes.length === 1 ? "" : "s"}`
        : `${fmt(visible)} of ${fmt(nodes.length)} ${noun}s`;
    captionEl.appendChild(
      textEl("span", "cn-caption-count", `${count}, ${fmt(edges.length)} links`)
    );
    captionEl.appendChild(textEl("span", "cn-caption-blurb", VIEW_BLURB[view] || ""));
    if (canvas) {
      const shelfName = (shelves.find((s) => s.slug === shelfSlug) || {}).shelf || "this shelf";
      canvas.setAttribute("aria-label", `Map of ${count} on the ${shelfName} shelf.`);
    }
  }

  /* ── Loading ──────────────────────────────────────────────────── */

  async function getJSON(url) {
    if (cache.has(url)) return cache.get(url);
    const resp = await fetch(url, { credentials: "omit" });
    if (!resp.ok) {
      const err = new Error(`HTTP ${resp.status}`);
      err.status = resp.status;
      throw err;
    }
    const json = await resp.json();
    cache.set(url, json);
    return json;
  }

  function availableViews(slug) {
    const s = shelves.find((x) => x.slug === slug);
    const have = (s && s.have) || {};
    return ["authors", "works", "doctrines"].filter((v) => Number(have[v]) > 0);
  }

  function renderViewButtons() {
    const avail = availableViews(shelfSlug);
    viewBtns.forEach((b) => {
      const v = b.getAttribute("data-cn-view");
      const ok = avail.indexOf(v) >= 0;
      b.hidden = !ok;
      const on = ok && v === view;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    // Said out loud rather than left as an unexplained gap: a shelf with
    // one view reads as a broken picker otherwise.
    if (!viewsNote) return;
    if (avail.length >= 3) {
      viewsNote.hidden = true;
      viewsNote.textContent = "";
      return;
    }
    const names = avail.map((v) => (VIEW_LABEL[v] || v).toLowerCase());
    const shelfName = (shelves.find((x) => x.slug === shelfSlug) || {}).shelf || "This shelf";
    viewsNote.hidden = false;
    viewsNote.textContent = names.length
      ? `${shelfName} has been mined for ${names.length === 1 ? names[0] : names.join(" and ")} only.`
      : `${shelfName} has not been mined yet.`;
  }

  function clearMap() {
    nodes = [];
    edges = [];
    cats = [];
    catIndex = {};
    hiddenCats = {};
    clearSelection();
    hovered = -1;
    renderLegend();
    renderCaption();
    if (indexBuilt) renderIndex();
    draw();
  }

  function adopt(payload) {
    nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
    cats = Array.isArray(payload.cats) ? payload.cats : [];
    // Drop any edge whose endpoints are not both real node indices, so
    // a malformed pair cannot throw inside the draw loop.
    edges = (Array.isArray(payload.edges) ? payload.edges : []).filter(
      (e) =>
        Array.isArray(e) &&
        Number.isInteger(e[0]) &&
        Number.isInteger(e[1]) &&
        e[0] >= 0 &&
        e[1] >= 0 &&
        e[0] < nodes.length &&
        e[1] < nodes.length
    );

    catIndex = {};
    cats.forEach((c, i) => {
      if (c && typeof c.k === "string") catIndex[c.k] = i;
    });
    hiddenCats = {};
    hovered = -1;
    clearSelection();
    computeWeights();
    fit();
    resetView();
    renderLegend();
    renderCaption();
    if (indexBuilt) {
      if (indexFilter) indexFilter.value = "";
      renderIndex();
    }
    draw();
  }

  async function load() {
    if (!shelfSlug || !view) return;
    const token = ++loadToken;
    clearError();
    setStatus("Drawing the map…");
    const url = `${BASE}/${encodeURIComponent(shelfSlug)}/${encodeURIComponent(view)}.json`;

    let payload;
    try {
      payload = await getJSON(url);
    } catch (err) {
      console.error("[faith-constellations] could not load", url, err);
      if (token !== loadToken) return;
      setStatus("");
      // Never "this shelf is empty": a 404 means the view was not
      // mined, which is a different sentence from a network failure,
      // and both are different from "there is nothing to show".
      showError(
        err && err.status === 404
          ? "That view has not been mined for this shelf yet."
          : "Could not reach the library. Please check your connection and try again."
      );
      clearMap();
      return;
    }

    if (token !== loadToken) return;
    setStatus("");
    adopt(payload);
  }

  function setView(next) {
    if (!next || next === view) return;
    view = next;
    renderViewButtons();
    load();
  }

  function setShelf(slug) {
    shelfSlug = slug;
    const avail = availableViews(slug);
    // Keep the reader's chosen view across a shelf change when the new
    // shelf has it; otherwise fall back to the first it does have,
    // rather than requesting a 404.
    if (avail.indexOf(view) < 0) view = avail[0] || "";
    renderViewButtons();
    if (!view) {
      showError("This shelf has not been mined yet.");
      clearMap();
      return;
    }
    load();
  }

  viewBtns.forEach((b) => {
    b.addEventListener("click", () => setView(b.getAttribute("data-cn-view")));
  });
  shelfSel.addEventListener("change", () => setShelf(shelfSel.value));

  async function boot() {
    readPalette();
    setStatus("Reading the shelves…");
    let index;
    try {
      index = await getJSON(`${BASE}/index.json`);
    } catch (err) {
      console.error("[faith-constellations] could not load the shelf index", err);
      setStatus("");
      showError("Could not reach the library. Please check your connection and try again.");
      return;
    }

    shelves = Array.isArray(index && index.shelves) ? index.shelves : [];
    if (!shelves.length) {
      setStatus("");
      showError("The library returned no shelves.");
      return;
    }

    shelfSel.textContent = "";
    shelves.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.slug;
      opt.textContent = s.shelf || s.slug;
      shelfSel.appendChild(opt);
    });
    shelfSel.disabled = false;

    // A shareable starting point. Read, never written: the tab shell
    // already owns the URL through replaceState and two writers would
    // rewrite each other.
    let wantShelf = "";
    let wantView = "";
    try {
      const q = new URLSearchParams(window.location.search);
      wantShelf = q.get("shelf") || "";
      wantView = q.get("view") || "";
    } catch (_) { /* malformed query string; fall through to the defaults */ }

    const first = shelves.some((s) => s.slug === wantShelf) ? wantShelf : shelves[0].slug;
    shelfSel.value = first;
    if (wantView && availableViews(first).indexOf(wantView) >= 0) view = wantView;
    setShelf(first);
  }

  /* ── Waking up ────────────────────────────────────────────────────
   *
   * The panel ships `hidden` (it is one of five tabs), so at parse time
   * the stage has zero width. A canvas measured then would be sized 0
   * and stay that way, and half a megabyte of JSON fetched then would
   * be spent on a reader who never opened the tab. So the panel waits
   * for its first real size and treats that as "the tab was opened".
   *
   * THREE triggers, not one, and the MutationObserver is the load-
   * bearing one. ResizeObserver delivery happens in the "update the
   * rendering" steps, which a browser does not run for a tab it is not
   * painting — the same throttle that makes requestAnimationFrame
   * useless there (FRONTEND §6.30). Measured 2026-09-04: in the browser
   * pane a ResizeObserver on this stage fires NOT ONCE, not even its
   * initial observation, so a panel that woke on RO alone would sit
   * blank forever in any environment that throttles it. A
   * MutationObserver is delivered as a microtask and does not care
   * whether anything is being painted, and `hidden` flipping on the
   * panel is precisely the signal, so that is what the boot hangs on.
   * RO and the window resize event are kept for what they are actually
   * good at: re-fitting the map after a rotation or a window drag.
   *
   * Nothing here has to know how faith-research.js switches tabs; the
   * only thing it reads is the `hidden` attribute the shell already
   * toggles.
   */
  let booted = false;
  let lastW = 0;
  let lastH = 0;

  function onResize() {
    if (!measure()) return;
    if (cssW === lastW && cssH === lastH) return;
    lastW = cssW;
    lastH = cssH;
    if (!booted) {
      booted = true;
      syncTouchAction();
      boot();
      return;
    }
    fit();
    clampPan();
    draw();
  }

  // The tab being opened. getBoundingClientRect inside the callback
  // forces the layout it needs, so the stage reports its real size on
  // the same turn the attribute changed.
  const hostPanel = root.closest ? root.closest("[data-research-panel]") : null;
  if (hostPanel && typeof MutationObserver === "function") {
    new MutationObserver(() => {
      if (!hostPanel.hidden) onResize();
    }).observe(hostPanel, { attributes: true, attributeFilter: ["hidden"] });
  }

  // Re-fitting after a rotation or a window drag. onResize returns
  // early when the box has not actually changed, so having both of
  // these plus the observer above costs nothing.
  if (typeof ResizeObserver === "function") new ResizeObserver(onResize).observe(stageEl);
  window.addEventListener("resize", onResize);

  // And immediately, for the case where this partial is dropped on a
  // page of its own rather than behind a tab.
  onResize();

  // measureText is wrong until the body face has actually loaded, which
  // would leave the first hover label's plate mis-sized. One repaint
  // when the fonts settle costs nothing and fixes it.
  if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === "function") {
    document.fonts.ready.then(() => draw()).catch(() => {});
  }
})();
