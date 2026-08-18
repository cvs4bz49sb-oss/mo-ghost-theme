/*
 * /admin/heatmap/ — homepage click heatmap.
 *
 * Frames the live homepage, re-projects aggregated clicks onto it, and
 * paints the familiar blue→red heat overlay on top. Alongside the
 * picture it answers the two questions the picture alone can't:
 * where conversions happen (goal clicks per section, as a share of the
 * sessions that actually reached that section) and where visitors fall
 * off (scroll-depth funnel, section reach, dead and rage clicks).
 *
 * Why the frame instead of a screenshot
 * =====================================
 * A stored screenshot goes stale the day the homepage changes, and
 * quietly starts lying about where the clicks were. Framing the real
 * page means the overlay is always drawn on the layout that exists
 * right now. Clicks arrive from the worker anchored to
 * [data-hm-section] boxes as permille offsets (see
 * assets/js/heatmap-collect.js), so this file only has to measure each
 * section in the frame and multiply.
 *
 * The frame is same-origin, so we read its document to measure. If a
 * future frame-ancestors header blocks that, everything except the
 * canvas still works and a banner explains what is missing.
 *
 * Why the frame is fetched signed out
 * ===================================
 * Staff are signed in, so a plain frame of "/" renders the member
 * homepage: "Your Dashboard" where a visitor sees the subscribe CTA,
 * the account button where a visitor sees Sign in. Nearly every
 * recorded click comes from a signed-out visitor, so drawing those
 * clicks on the member layout puts blobs against the wrong buttons and
 * hides the very CTAs the tool exists to measure. The HTML is
 * therefore fetched with credentials omitted, which is what the server
 * sends a stranger, and written into the frame.
 *
 * The write goes into a frame already navigated to /?mo-hm-preview=1,
 * so the document keeps that URL. That matters: heatmap-collect.js
 * reads window.location.search to decide to stand down, so srcdoc or a
 * blob URL would quietly turn staff review back into a recording
 * session against the data being displayed.
 *
 * Data: mo-admin worker, GET /heatmap/summary and GET /heatmap/points,
 * both JWT+staff. See WORKER-PATCH-heatmap.md.
 */
(function () {
  const root = document.querySelector("[data-admin-heatmap]");
  if (!root) return;

  const WORKER = (root.getAttribute("data-worker-url") || "").replace(/\/+$/, "");

  // ── Reference widths ──────────────────────────────────────────────
  //
  // The frame is rendered at a fixed width per device bucket so the
  // heatmap is reproducible: same data, same picture, on Ian's laptop
  // and on a 4K monitor. The stage scales the whole thing down to fit.
  const REF_WIDTH = { desktop: 1440, tablet: 834, mobile: 390 };

  // Canvas is rendered at half the frame's pixel size and stretched by
  // CSS. The homepage runs past 8000px tall; a full-resolution canvas
  // at that height is ~46MB of image data per redraw, and the blur of
  // a heat blob hides the difference entirely.
  const RENDER_SCALE = 0.5;

  // One array covers both page buckets. The two blocks never co-occur
  // in a single response — a homepage query cannot return `body`, an
  // article query cannot return `hero` — so the only ordering that
  // matters is within a block, plus the shared keys pinned to the end.
  const SECTION_ORDER = [
    // Homepage
    "header", "hero", "today", "digest", "this-week", "dlp-band",
    "listen", "journal", "readers",
    // Article, in reading order
    "header-block", "feature-img", "toc-mobile", "toc", "share-rail",
    "body", "inline-cta", "author-bio", "read-next",
    // Shared
    "join", "footer", "page",
  ];

  const SECTION_LABEL = {
    header: "Site header",
    hero: "Hero",
    today: "Latest + Must Reads",
    digest: "Digest / upgrade band",
    "this-week": "This Week",
    "dlp-band": "Daily Liturgy band",
    listen: "Podcasts",
    journal: "Print journal",
    readers: "Reader quotes",
    "header-block": "Title + byline + tools",
    "feature-img": "Feature image",
    "toc-mobile": "Contents (mobile)",
    toc: "Contents rail",
    "share-rail": "Share rail",
    body: "Essay body",
    "inline-cta": "In-essay CTA",
    "author-bio": "Author bio",
    "read-next": "Read Next",
    join: "Membership (#join)",
    footer: "Footer",
    page: "Unsectioned",
  };

  const GOAL_LABEL = {
    "member-cta": "Become a Member",
    "join-checkout": "Pricing card checkout",
    "join-lifetime": "Lifetime checkout",
    "digest-signup": "Digest signup",
    dashboard: "Your Dashboard",
    gift: "Gift a membership",
    journal: "Print journal CTA",
    article: "Article link",
    archive: "Browse the archive",
    podcast: "Podcast link",
    nav: "Header navigation",
    listen: "Listen to this essay",
    bookmark: "Bookmark",
    pdf: "Download PDF",
    "gift-essay": "Gift this essay",
    "dark-mode": "Dark mode toggle",
    share: "Share buttons",
    "read-next": "Read Next essay",
  };

  // ── Elements ──────────────────────────────────────────────────────
  const el = {
    days: root.querySelector("[data-hm-days]"),
    page: root.querySelector("[data-hm-page]"),
    device: root.querySelector("[data-hm-device]"),
    mode: root.querySelector("[data-hm-mode]"),
    intensity: root.querySelector("[data-hm-intensity]"),
    radius: root.querySelector("[data-hm-radius]"),
    scrim: root.querySelector("[data-hm-scrim]"),
    refresh: root.querySelector("[data-hm-refresh]"),
    stage: root.querySelector("[data-hm-stage]"),
    scaler: root.querySelector("[data-hm-scaler]"),
    frame: root.querySelector("[data-hm-frame]"),
    canvas: root.querySelector("[data-hm-canvas]"),
    scrimLayer: root.querySelector("[data-hm-scrim-layer]"),
    status: root.querySelector("[data-hm-status]"),
    note: root.querySelector("[data-hm-note]"),
    tiles: root.querySelector("[data-hm-tiles]"),
    goals: root.querySelector("[data-hm-goals]"),
    funnel: root.querySelector("[data-hm-funnel]"),
    scroll: root.querySelector("[data-hm-scroll]"),
    elements: root.querySelector("[data-hm-elements]"),
    dead: root.querySelector("[data-hm-dead]"),
    legendMax: root.querySelector("[data-hm-legend-max]"),
  };

  const state = {
    summary: null,
    points: [],
    maxN: 0,
    frameReady: false,
    frameBlocked: false,
    frameHtml: null,
    frameAnon: false,
    loading: false,
    // Resolved once per page bucket: the URL the frame should show.
    // "home" is always "/", "post" is whatever the newest essay is.
    frameUrls: { home: "/" },
  };

  // ── Small helpers ─────────────────────────────────────────────────
  function num(n) {
    return typeof n === "number" && isFinite(n) ? n.toLocaleString() : "—";
  }

  function pct(part, whole) {
    if (!whole) return "—";
    return `${Math.round((part / whole) * 100)}%`;
  }

  function duration(ms) {
    if (!ms) return "—";
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  }

  function setStatus(text, isError) {
    if (!el.status) return;
    el.status.textContent = text || "";
    el.status.hidden = !text;
    el.status.classList.toggle("is-error", !!isError);
  }

  function showNote(text) {
    if (!el.note) return;
    el.note.textContent = text || "";
    el.note.hidden = !text;
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  // Every string below originates in visitor-supplied DOM text that the
  // worker stored. It goes in as textContent, never as markup.
  function cell(tag, text, className) {
    const node = document.createElement(tag);
    node.textContent = text == null ? "" : String(text);
    if (className) node.className = className;
    return node;
  }

  function emptyRow(tbody, colspan, text) {
    const tr = document.createElement("tr");
    const td = cell("td", text, "hm-empty-cell");
    td.colSpan = colspan;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  function currentDevice() {
    return (el.device && el.device.value) || "desktop";
  }

  function currentDays() {
    return parseInt((el.days && el.days.value) || "30", 10);
  }

  function currentMode() {
    return (el.mode && el.mode.value) || "heat";
  }

  function currentPage() {
    return (el.page && el.page.value) || "home";
  }

  // `days` is inclusive of today, so 1 is today alone. The worker reads
  // it the same way; see hmRange() in admin.js.
  function rangeLabel() {
    const days = currentDays();
    return days === 1 ? "today" : `last ${days} days`;
  }

  function pointKind() {
    const mode = currentMode();
    if (mode === "dead") return "dead";
    if (mode === "rage") return "rage";
    return "all";
  }

  // ── Fetch ─────────────────────────────────────────────────────────
  function api(path) {
    if (!WORKER) return Promise.reject(new Error("no-worker"));
    if (!window.MOAuth) return Promise.reject(new Error("no-auth"));
    return window.MOAuth.fetch(WORKER + path).then((res) => {
      if (res.status === 404) throw new Error("not-deployed");
      if (res.status === 401 || res.status === 403) throw new Error("forbidden");
      if (!res.ok) throw new Error(`http-${res.status}`);
      return res.json();
    });
  }

  function load() {
    if (state.loading) return;
    state.loading = true;
    setStatus("Loading…");

    const q =
      `?days=${currentDays()}` +
      `&dev=${encodeURIComponent(currentDevice())}` +
      `&page=${encodeURIComponent(currentPage())}`;

    Promise.all([
      api(`/heatmap/summary${q}`),
      api(`/heatmap/points${q}&kind=${pointKind()}`),
    ])
      .then(([summary, points]) => {
        state.summary = summary || {};
        state.points = (points && points.points) || [];
        state.maxN = (points && points.max) || state.points.reduce(
          (m, p) => Math.max(m, p.n || 0), 0
        );
        renderPanels();
        draw();
        const total = state.summary.sessions || 0;
        const noun = currentPage() === "post" ? "article page views" : "homepage sessions";
        setStatus(
          total
            ? `${num(total)} ${noun} · ${num(state.summary.clicks || 0)} clicks · ${rangeLabel()}`
            : `No sessions recorded yet for this page, range, and device.`
        );
      })
      .catch((err) => {
        state.summary = null;
        state.points = [];
        renderPanels();
        draw();
        if (err && err.message === "not-deployed") {
          setStatus(
            "The mo-admin worker has no /heatmap endpoints yet — apply WORKER-PATCH-heatmap.md and redeploy.",
            true
          );
        } else if (err && err.message === "forbidden") {
          setStatus("Not authorized. This tool is staff-only.", true);
        } else if (err && err.message === "no-worker") {
          setStatus("Admin worker URL is not configured in theme settings.", true);
        } else {
          setStatus("Could not load heatmap data.", true);
        }
      })
      .finally(() => {
        state.loading = false;
      });
  }

  // ── Panels ────────────────────────────────────────────────────────
  function renderPanels() {
    renderTiles();
    renderGoals();
    renderFunnel();
    renderScroll();
    renderElements();
    renderDead();
  }

  function renderTiles() {
    if (!el.tiles) return;
    clear(el.tiles);
    const s = state.summary || {};
    const sessions = s.sessions || 0;

    // On the article bucket a "session" is one essay page view, not one
    // tab: the collector scopes its id per path so a visitor who reads
    // three essays counts three times, which is the denominator the
    // per-template rates below actually want.
    const isPost = currentPage() === "post";
    const sessionNoun = isPost ? "Page views" : "Sessions";

    // Labelled "Avg", not "Median": the worker computes these with
    // AVG(), and on dwell time the two are far apart. Renaming beats
    // quietly leaving the more flattering number under the more
    // conservative word. A real median needs a window function.
    const tiles = [
      { label: sessionNoun, value: num(sessions), sub: rangeLabel() },
      {
        label: "Clicks",
        value: num(s.clicks || 0),
        sub: `${num(s.clickSessions || 0)} ${isPost ? "views" : "sessions"} clicked`,
      },
      {
        label: "Clicked anything",
        value: pct(s.clickSessions || 0, sessions),
        sub: `share of ${isPost ? "views" : "sessions"}`,
      },
      {
        label: "Avg scroll",
        value: s.medianScroll ? `${Math.round(s.medianScroll / 10)}%` : "—",
        sub: "of page height",
      },
      {
        label: "Avg time",
        value: duration(s.medianDwellMs || s.avgDwellMs),
        sub: isPost ? "on the essay" : "on the homepage",
      },
      {
        label: "Dead clicks",
        value: num(s.deadClicks || 0),
        sub: `${pct(s.deadClicks || 0, s.clicks || 0)} of clicks`,
      },
    ];

    tiles.forEach((t) => {
      const box = document.createElement("div");
      box.className = "hm-tile";
      box.appendChild(cell("p", t.value, "hm-tile-value"));
      box.appendChild(cell("p", t.label, "hm-tile-label"));
      box.appendChild(cell("p", t.sub, "hm-tile-sub"));
      el.tiles.appendChild(box);
    });
  }

  function renderGoals() {
    if (!el.goals) return;
    clear(el.goals);
    const s = state.summary || {};
    const goals = s.goals || [];
    const sessions = s.sessions || 0;

    if (!goals.length) {
      emptyRow(el.goals, 4, "No goal clicks recorded in this range.");
      return;
    }

    goals
      .slice()
      .sort((a, b) => (b.clicks || 0) - (a.clicks || 0))
      .forEach((g) => {
        const tr = document.createElement("tr");
        tr.appendChild(cell("td", GOAL_LABEL[g.goal] || g.goal, "hm-cell-name"));
        tr.appendChild(cell("td", num(g.clicks || 0), "hm-cell-num"));
        tr.appendChild(cell("td", num(g.sessions || 0), "hm-cell-num"));
        tr.appendChild(cell("td", pct(g.sessions || 0, sessions), "hm-cell-num"));
        el.goals.appendChild(tr);
      });
  }

  // Section funnel. "Reached" is the honest denominator: a section
  // nobody scrolled to hasn't failed to convert, it has failed to be
  // seen. The bar shows reach; the engagement column shows what share
  // of the people who saw it clicked inside it.
  function renderFunnel() {
    if (!el.funnel) return;
    clear(el.funnel);
    const s = state.summary || {};
    const sections = s.sections || [];
    const sessions = s.sessions || 0;

    if (!sections.length) {
      el.funnel.appendChild(cell("p", "No section data in this range.", "admin-sub"));
      return;
    }

    const byKey = {};
    sections.forEach((row) => { byKey[row.sec] = row; });

    const ordered = SECTION_ORDER.filter((k) => byKey[k])
      .concat(sections.map((r) => r.sec).filter((k) => SECTION_ORDER.indexOf(k) === -1));

    let previousReach = null;

    ordered.forEach((key) => {
      const row = byKey[key];
      if (!row) return;
      const reached = row.reached || 0;
      const share = sessions ? reached / sessions : 0;

      const item = document.createElement("div");
      item.className = "hm-funnel-row";

      const head = document.createElement("div");
      head.className = "hm-funnel-head";
      head.appendChild(cell("span", SECTION_LABEL[key] || key, "hm-funnel-name"));
      head.appendChild(cell("span", `${num(reached)} reached · ${pct(reached, sessions)}`, "hm-funnel-value"));
      item.appendChild(head);

      const bar = document.createElement("div");
      bar.className = "hm-funnel-bar";
      const fill = document.createElement("div");
      fill.className = "hm-funnel-fill";
      fill.style.width = `${Math.max(0, Math.min(100, share * 100))}%`;
      bar.appendChild(fill);
      item.appendChild(bar);

      const meta = document.createElement("p");
      meta.className = "hm-funnel-meta";
      // A drop is only worth printing if it rounds to something. Two
      // sessions out of four thousand is measurement noise, and "−0% vs
      // previous section" on every row trains the eye to skip the line
      // where the real drops appear.
      const drop = previousReach && previousReach > reached
        ? Math.round(((previousReach - reached) / previousReach) * 100)
        : 0;
      const dropText = drop >= 1 ? ` · −${drop}% vs previous section` : "";
      meta.textContent =
        `${num(row.clicks || 0)} clicks · ` +
        `${pct(row.clickSessions || 0, reached)} of viewers clicked here${dropText}`;
      if (drop >= 10) meta.classList.add("is-drop");
      item.appendChild(meta);

      el.funnel.appendChild(item);
      previousReach = reached;
    });
  }

  function renderScroll() {
    if (!el.scroll) return;
    clear(el.scroll);
    const s = state.summary || {};
    const buckets = s.scroll || [];
    const sessions = s.sessions || 0;

    if (!buckets.length) {
      el.scroll.appendChild(cell("p", "No scroll data in this range.", "admin-sub"));
      return;
    }

    buckets
      .slice()
      .sort((a, b) => (a.bucket || 0) - (b.bucket || 0))
      .forEach((b) => {
        const reached = b.sessions || 0;
        const row = document.createElement("div");
        row.className = "hm-scroll-row";
        row.appendChild(cell("span", `${b.bucket}%`, "hm-scroll-depth"));

        const bar = document.createElement("div");
        bar.className = "hm-scroll-bar";
        const fill = document.createElement("div");
        fill.className = "hm-scroll-fill";
        fill.style.width = `${sessions ? Math.min(100, (reached / sessions) * 100) : 0}%`;
        bar.appendChild(fill);
        row.appendChild(bar);

        row.appendChild(cell("span", pct(reached, sessions), "hm-scroll-value"));
        el.scroll.appendChild(row);
      });
  }

  function renderElements() {
    if (!el.elements) return;
    clear(el.elements);
    const rows = (state.summary && state.summary.elements) || [];

    if (!rows.length) {
      emptyRow(el.elements, 4, "No element clicks recorded in this range.");
      return;
    }

    rows.slice(0, 25).forEach((r) => {
      const tr = document.createElement("tr");

      const nameCell = document.createElement("td");
      nameCell.className = "hm-cell-name";
      nameCell.appendChild(cell("span", r.label || "(no label)", "hm-el-label"));
      nameCell.appendChild(cell("span", r.sel || "", "hm-el-sel"));
      tr.appendChild(nameCell);

      tr.appendChild(cell("td", SECTION_LABEL[r.sec] || r.sec || "—"));
      tr.appendChild(cell("td", r.goal ? GOAL_LABEL[r.goal] || r.goal : "—"));
      tr.appendChild(cell("td", num(r.clicks || 0), "hm-cell-num"));
      el.elements.appendChild(tr);
    });
  }

  function renderDead() {
    if (!el.dead) return;
    clear(el.dead);
    const s = state.summary || {};
    const rows = (s.dead || []).slice(0, 10);
    const rage = (s.rage || []).slice(0, 5);

    if (!rows.length && !rage.length) {
      el.dead.appendChild(cell("p", "No dead or rage clicks recorded. That's a good sign.", "admin-sub"));
      return;
    }

    if (rows.length) {
      el.dead.appendChild(cell("p", "Clicked but not clickable", "hm-list-heading"));
      const list = document.createElement("ul");
      list.className = "hm-list";
      rows.forEach((r) => {
        const li = document.createElement("li");
        li.appendChild(cell("span", r.label || r.sel || "(unlabelled)", "hm-list-name"));
        li.appendChild(cell("span", `${num(r.clicks || 0)} · ${SECTION_LABEL[r.sec] || r.sec || ""}`, "hm-list-value"));
        list.appendChild(li);
      });
      el.dead.appendChild(list);
    }

    if (rage.length) {
      el.dead.appendChild(cell("p", "Rage clicks (repeated, same spot)", "hm-list-heading"));
      const list = document.createElement("ul");
      list.className = "hm-list";
      rage.forEach((r) => {
        const li = document.createElement("li");
        li.appendChild(cell("span", r.label || r.sel || "(unlabelled)", "hm-list-name"));
        li.appendChild(cell("span", `${num(r.clicks || 0)} · ${SECTION_LABEL[r.sec] || r.sec || ""}`, "hm-list-value"));
        list.appendChild(li);
      });
      el.dead.appendChild(list);
    }
  }

  // ── Frame ─────────────────────────────────────────────────────────
  const FRAME_SIGNED_IN_NOTE =
    "Couldn't load a signed-out copy of the homepage, so the frame below " +
    "is your own signed-in view. Section positions may differ from what " +
    "most visitors see.";

  let frameObserver = null;

  function frameDoc() {
    try {
      const doc = el.frame.contentDocument;
      if (!doc || !doc.body) return null;
      return doc;
    } catch (_) {
      return null;
    }
  }

  function loadFrame() {
    if (!el.frame) return;
    const width = REF_WIDTH[currentDevice()] || REF_WIDTH.desktop;
    state.frameReady = false;
    state.frameBlocked = false;
    state.frameHtml = null;
    state.frameAnon = false;
    el.scaler.style.width = `${width}px`;
    el.frame.style.width = `${width}px`;
    el.frame.style.height = "800px";

    // Fetch first, navigate second. The load handler has to know
    // whether an anonymous copy arrived before it decides to inject,
    // and resolving the fetch up front removes that race.
    framePath().then((path) => {
      if (!path) {
        setStatus("Could not find a recent essay to draw the article map on.", true);
        return;
      }
      const url = `${path}?mo-hm-preview=1&w=${width}`;
      fetchSignedOut(url).then((html) => {
        state.frameHtml = html;
        state.frameAnon = Boolean(html);
        el.frame.setAttribute("src", url);
      });
    });
  }

  // Which URL the overlay is drawn on. The article heatmap aggregates
  // every essay, so there is no one true page to frame — the most
  // recent one stands in for the template. Clicks are anchored to
  // section keys, not pixels, so any essay with the same sections
  // projects the same map; what changes underneath is the prose.
  function framePath() {
    const page = currentPage();
    if (state.frameUrls[page]) return Promise.resolve(state.frameUrls[page]);

    return fetchSignedOut("/").then((html) => {
      if (!html) return null;
      let doc;
      try {
        doc = new DOMParser().parseFromString(html, "text/html");
      } catch (_) {
        return null;
      }
      // Hero feature first, then the grid: newest essay either way.
      const link =
        doc.querySelector("a.hero-feature[href]") ||
        doc.querySelector("a.feature-entry[href]") ||
        doc.querySelector("a.entry[href]");
      if (!link) return null;

      // Same-origin, path only. The href comes from page markup, so it
      // is treated as untrusted input rather than dropped into src.
      let path;
      try {
        const parsed = new URL(link.getAttribute("href"), window.location.origin);
        if (parsed.origin !== window.location.origin) return null;
        path = parsed.pathname;
      } catch (_) {
        return null;
      }
      if (!path || path === "/") return null;

      state.frameUrls[page] = path;
      return path;
    });
  }

  // credentials:"omit" is the whole trick: same origin, no member
  // cookie, so Ghost renders the page it serves a stranger. Failure is
  // not fatal; the frame falls back to the signed-in render and
  // settleFrame() says so rather than quietly showing the wrong page.
  function fetchSignedOut(url) {
    if (typeof fetch !== "function") return Promise.resolve(null);
    return fetch(url, { credentials: "omit", cache: "no-store" })
      .then((res) => (res.ok ? res.text() : null))
      .catch(() => null);
  }

  // The homepage finishes composing itself after load: the podcast
  // worker fills the Patient Conversations row, images decode, the
  // liturgy band reveals its player. Measuring at the load event alone
  // gives a height that's short by a section or two, which pushes every
  // blob below it out of place. Settle first, then measure, then keep
  // watching for later growth.
  function settleFrame() {
    const doc = frameDoc();
    if (!doc) {
      state.frameBlocked = true;
      showNote(
        "Can't read the framed homepage, so the overlay is unavailable. " +
        "Everything below still reflects the recorded data."
      );
      fitStage();
      return;
    }

    showNote(state.frameAnon ? "" : FRAME_SIGNED_IN_NOTE);
    applyFrameStyles(doc);

    const measure = () => {
      const height = Math.max(
        doc.documentElement.scrollHeight,
        doc.body.scrollHeight
      );
      if (!height) return;
      el.frame.style.height = `${height}px`;
      el.scaler.style.height = `${height}px`;
      state.frameReady = true;
      fitStage();
      draw();
    };

    measure();
    setTimeout(measure, 600);
    setTimeout(measure, 1800);

    // settleFrame can run twice for a single load, because
    // document.write may or may not re-fire the frame's load event
    // depending on the browser. Replace the observer instead of
    // stacking a new one on every pass.
    if (typeof ResizeObserver === "function") {
      if (frameObserver) frameObserver.disconnect();
      frameObserver = new ResizeObserver(() => { measure(); });
      frameObserver.observe(doc.body);
    }
  }

  // Frozen for measurement: no sticky header sliding over the blobs, no
  // entrance animations mid-draw, no slide-in covering the section it
  // is being measured against.
  function applyFrameStyles(doc) {
    const existing = doc.getElementById("mo-hm-preview-style");
    if (existing) return;
    const style = doc.createElement("style");
    style.id = "mo-hm-preview-style";
    style.textContent =
      ".site-header{position:static !important;}" +
      "body{padding-top:0 !important;}" +
      ".slide-in,.mo-slide-in,[data-slide-in]{display:none !important;}" +
      "*{animation:none !important;transition:none !important;scroll-behavior:auto !important;}";
    doc.head.appendChild(style);
  }

  function fitStage() {
    if (!el.stage || !el.scaler) return;
    const width = REF_WIDTH[currentDevice()] || REF_WIDTH.desktop;
    const available = el.stage.clientWidth;
    const scale = available && available < width ? available / width : 1;
    el.scaler.style.transform = `scale(${scale})`;
    // The scaler's layout box stays at the reference width whatever the
    // transform does, so a mobile frame would sit against the left edge
    // of a desktop-wide panel. Nudge it into the middle by hand.
    const slack = available - width * scale;
    el.scaler.style.marginLeft = slack > 0 ? `${Math.round(slack / 2)}px` : "0";
    // The scaler is transform-scaled, which doesn't affect layout, so
    // the stage needs the scaled height to scroll correctly.
    const height = parseFloat(el.scaler.style.height || "0");
    el.stage.style.height = height ? `${Math.round(height * scale)}px` : "";
  }

  // ── Heat rendering ────────────────────────────────────────────────
  function sectionRects() {
    const doc = frameDoc();
    if (!doc) return null;
    const rects = {};
    const scrollY = doc.documentElement.scrollTop || doc.body.scrollTop || 0;
    const scrollX = doc.documentElement.scrollLeft || doc.body.scrollLeft || 0;

    doc.querySelectorAll("[data-hm-section]").forEach((node) => {
      const key = node.getAttribute("data-hm-section");
      if (!key || rects[key]) return;
      const r = node.getBoundingClientRect();
      rects[key] = {
        left: r.left + scrollX,
        top: r.top + scrollY,
        width: r.width,
        height: r.height,
      };
    });

    // Clicks that landed outside every marked section are stored
    // against the document itself.
    rects.page = {
      left: 0,
      top: 0,
      width: doc.documentElement.scrollWidth,
      height: Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight),
    };

    return rects;
  }

  let gradientCache = null;

  function gradientRamp() {
    if (gradientCache) return gradientCache;
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 1;
    const ctx = c.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0.00, "rgba(0,0,255,0)");
    g.addColorStop(0.22, "rgba(0,0,255,1)");
    g.addColorStop(0.42, "rgba(0,225,255,1)");
    g.addColorStop(0.60, "rgba(0,230,60,1)");
    g.addColorStop(0.78, "rgba(255,230,0,1)");
    g.addColorStop(1.00, "rgba(255,0,0,1)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 1);
    gradientCache = ctx.getImageData(0, 0, 256, 1).data;
    return gradientCache;
  }

  function blobTemplate(radius) {
    const c = document.createElement("canvas");
    const size = radius * 2;
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return c;
  }

  function projected() {
    const rects = sectionRects();
    if (!rects) return null;
    const out = [];
    state.points.forEach((p) => {
      const rect = rects[p.s];
      if (!rect || !rect.height) return;
      out.push({
        px: rect.left + (rect.width * (p.x || 0)) / 1000,
        py: rect.top + (rect.height * (p.y || 0)) / 1000,
        n: p.n || 0,
        label: p.l || "",
        goal: p.g || "",
      });
    });
    return out;
  }

  function draw() {
    if (!el.canvas) return;
    const ctx = el.canvas.getContext("2d");
    const width = REF_WIDTH[currentDevice()] || REF_WIDTH.desktop;
    const height = parseFloat(el.scaler.style.height || "0") || 0;

    el.canvas.width = Math.max(1, Math.round(width * RENDER_SCALE));
    el.canvas.height = Math.max(1, Math.round(height * RENDER_SCALE));
    el.canvas.style.width = `${width}px`;
    el.canvas.style.height = `${height}px`;
    ctx.clearRect(0, 0, el.canvas.width, el.canvas.height);

    const showScrim = !!(el.scrim && el.scrim.checked);
    if (el.scrimLayer) el.scrimLayer.hidden = !showScrim;

    if (!state.frameReady || !state.points.length) {
      if (el.legendMax) el.legendMax.textContent = "—";
      return;
    }

    const points = projected();
    if (!points || !points.length) {
      if (el.legendMax) el.legendMax.textContent = "—";
      return;
    }

    const maxN = state.maxN || points.reduce((m, p) => Math.max(m, p.n), 0) || 1;
    if (el.legendMax) el.legendMax.textContent = num(maxN);

    const intensity = parseFloat((el.intensity && el.intensity.value) || "1");
    const radiusCss = parseInt((el.radius && el.radius.value) || "34", 10);
    // Coordinates are stored as a fraction of section width, so a blob's
    // meaning is proportional to page width, not absolute pixels. Left
    // fixed, the desktop's 34px spread swallows a tenth of a 390px phone
    // and every blob merges into one column. The slider stays calibrated
    // to desktop and is rescaled from there.
    const widthFactor = Math.max(0.3, width / REF_WIDTH.desktop);
    const radius = Math.max(5, Math.round(radiusCss * widthFactor * RENDER_SCALE));

    if (currentMode() === "dots") {
      drawDots(ctx, points, maxN, width);
      return;
    }

    const template = blobTemplate(radius);
    points.forEach((p) => {
      // Square-root scaling: a spot with 100 clicks should read as
      // hotter than one with 10, not as a hundred times the blob.
      const weight = Math.sqrt(p.n / maxN);
      ctx.globalAlpha = Math.max(0.04, Math.min(1, weight * intensity));
      ctx.drawImage(
        template,
        Math.round(p.px * RENDER_SCALE) - radius,
        Math.round(p.py * RENDER_SCALE) - radius
      );
    });
    ctx.globalAlpha = 1;

    colorize(ctx, el.canvas.width, el.canvas.height);
  }

  function colorize(ctx, w, h) {
    if (!w || !h) return;
    const image = ctx.getImageData(0, 0, w, h);
    const { data } = image;
    const ramp = gradientRamp();

    for (let i = 3; i < data.length; i += 4) {
      const alpha = data[i];
      if (alpha < 6) {
        data[i] = 0;
        continue;
      }
      const offset = alpha * 4;
      data[i - 3] = ramp[offset];
      data[i - 2] = ramp[offset + 1];
      data[i - 1] = ramp[offset + 2];
      data[i] = Math.min(255, Math.round(alpha * 1.5));
    }

    ctx.putImageData(image, 0, 0);
  }

  // Discrete-count mode. The blur is the right way to read pressure
  // across a region; it is the wrong way to read "how many people
  // pressed this exact button", which is what a CTA review needs.
  //
  // The raw grid is 1% cells, which on a real page means a dozen cells
  // per button and a dozen overlapping numbers nobody can read. Merge
  // anything within a click's-worth of distance, then show only the
  // busiest few dozen — a legible 40 beats an illegible 400.
  const DOT_MERGE_PX = 26;
  const DOT_LIMIT = 40;

  function clusterDots(points, width) {
    const merge = DOT_MERGE_PX * Math.max(0.3, width / REF_WIDTH.desktop);
    const clusters = [];

    points
      .slice()
      .sort((a, b) => b.n - a.n)
      .forEach((p) => {
        // Seeded hottest-first, so a cluster's anchor and label come from
        // its busiest cell rather than whichever one happened to be first.
        const hit = clusters.find(
          (c) => Math.abs(c.px - p.px) <= merge && Math.abs(c.py - p.py) <= merge
        );
        if (hit) {
          hit.n += p.n;
          if (!hit.label) hit.label = p.label;
          if (!hit.goal) hit.goal = p.goal;
          return;
        }
        clusters.push({ px: p.px, py: p.py, n: p.n, label: p.label, goal: p.goal });
      });

    return clusters.sort((a, b) => b.n - a.n).slice(0, DOT_LIMIT);
  }

  function drawDots(ctx, points, maxN, width) {
    const dots = clusterDots(points, width);
    const top = dots.length ? dots[0].n : maxN;
    // Labels already drawn, so two legitimately distinct clusters sitting
    // a few pixels apart don't stack their numbers into mush. Dots are
    // drawn busiest-first, so when two labels collide the bigger count
    // keeps its number and the smaller one shows as a bare dot.
    const taken = [];
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    dots.forEach((p) => {
      const r = Math.max(7, Math.sqrt(p.n / (top || 1)) * 30) * RENDER_SCALE;
      const x = p.px * RENDER_SCALE;
      const y = p.py * RENDER_SCALE;

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = p.goal ? "rgba(196, 62, 16, 0.92)" : "rgba(29, 27, 24, 0.78)";
      ctx.fill();
      ctx.lineWidth = 1.5 * RENDER_SCALE;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.stroke();

      const label = String(p.n);
      const size = Math.max(9, Math.min(r * 1.1, 22));
      if (r < 8) return;
      ctx.font = `700 ${Math.round(size)}px system-ui, -apple-system, sans-serif`;

      const halfW = ctx.measureText(label).width / 2;
      const halfH = size / 2;
      const box = { x1: x - halfW, x2: x + halfW, y1: y - halfH, y2: y + halfH };
      const collides = taken.some(
        (t) => box.x1 < t.x2 && box.x2 > t.x1 && box.y1 < t.y2 && box.y2 > t.y1
      );
      if (collides) return;
      taken.push(box);

      ctx.lineWidth = Math.max(2, size / 5);
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.strokeText(label, x, y);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, x, y);
    });
  }

  // ── Wiring ────────────────────────────────────────────────────────
  if (el.frame) {
    el.frame.addEventListener("load", () => {
      // First load after a successful fetch: swap in the anonymous
      // HTML. Writing into the already-navigated document keeps its
      // /?mo-hm-preview=1 URL, so the collector still sees the param
      // and stands down.
      if (state.frameHtml) {
        const html = state.frameHtml;
        state.frameHtml = null;
        const doc = frameDoc();
        if (doc) {
          try {
            doc.open();
            doc.write(html);
            doc.close();
          } catch (_) {
            state.frameAnon = false;
          }
          setTimeout(settleFrame, 0);
          return;
        }
        state.frameAnon = false;
      }
      settleFrame();
    });
    loadFrame();
  }

  if (el.device) {
    el.device.addEventListener("change", () => {
      loadFrame();
      load();
    });
  }

  if (el.page) {
    el.page.addEventListener("change", () => {
      loadFrame();
      load();
    });
  }

  if (el.days) el.days.addEventListener("change", load);
  if (el.mode) el.mode.addEventListener("change", load);
  if (el.refresh) el.refresh.addEventListener("click", load);
  if (el.intensity) el.intensity.addEventListener("input", draw);
  if (el.radius) el.radius.addEventListener("input", draw);
  if (el.scrim) el.scrim.addEventListener("change", draw);

  window.addEventListener("resize", () => {
    fitStage();
  });

  load();
})();
