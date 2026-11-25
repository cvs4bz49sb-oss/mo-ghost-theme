/*
 * Click-heatmap collector.
 *
 * Records where visitors click, which sections they actually reach, how
 * far down they read, and which clicks go nowhere — the raw material for
 * /admin/heatmap/ and MOOS. Ships in site.min.js and runs on every page
 * family the site has (window.MOPageKey, page-key.js): the homepage,
 * essays, every part of The Faith Received, the Daily Liturgy and its
 * reader, membership and giving, podcasts, the journal, tag and author
 * pages. Pages are bucketed by template family, not by URL: every essay
 * aggregates into one "post" heatmap rather than one per URL. Staff
 * tools under /admin/ are never recorded.
 *
 * What it stores
 * ==============
 * Nothing that identifies a person. Per pageview:
 *   - a random id for that one page view, made fresh on every load and
 *     kept nowhere, so two page views (even in one tab) cannot be joined
 *     into a browsing history. sessionStorage holds only the sampling
 *     coin, so a sampled-in tab stays sampled in.
 *   - device bucket, viewport width and height, document height
 *   - whether the visitor was signed in (boolean — never the email)
 *   - referrer HOSTNAME only, never the full referring URL
 *   - time the tab was visible, deepest scroll, and (on reading pages)
 *     the deepest point reached in the text; which sections came into view
 * Per click:
 *   - the section it landed in and the position inside that section
 *   - a short selector + visible label for the element. Never the text
 *     of a form field or a member's own words: a click on nothing
 *     clickable, on a field, on a member's workspace (notes, collections,
 *     saved views, drafts) or anywhere on the account pages is named by
 *     its tag and class instead (PRIVATE_PAGES, PRIVATE_ZONES)
 *   - the conversion goal, if the element carries data-hm-goal or is a
 *     link to one of the destinations in goalFor()
 *   - dead/rage flags
 *
 * Units
 * =====
 * scroll  permille (0-1000) of the scrolled height the bottom of the
 *         viewport reached, the deepest it got all visit. The scrolled
 *         height is the document, or on pages that scroll a pane rather
 *         than the window (the Faith Received reader on a desktop) that
 *         pane. scroll / 10 is the percent of the page seen.
 * depth   permille of the reading block the viewport bottom passed: the
 *         office on the Daily Liturgy reader, the essay body on a post,
 *         the text on a Faith Received document. Absent on pages with no
 *         reading block. depth / 10 is the percent of the text reached;
 *         1000 means the end of it was on screen.
 *
 * Coordinates are anchored to sections (page-key.js) and stored as
 * permille of that section's box, NOT as raw page pixels. A pixel
 * heatmap drifts the moment a page gains a paragraph or the visitor's
 * viewport differs from the reviewer's; section-relative coordinates
 * survive both, and let the admin tool re-project clicks onto today's
 * layout at any width.
 *
 * Off switch: Ghost Admin -> Design -> Customize -> "Homepage heatmap
 * sampling". Set it to Off and this file stops collecting. Do Not
 * Track and Global Privacy Control are honored unconditionally.
 *
 * Ingest: POST {admin_worker_url}/heatmap/collect via sendBeacon, same
 * public-beacon shape as the slide-in impression pings (origin
 * allowlist + rate limit on the worker side; see
 * WORKER-PATCH-heatmap.md). A visit beacons when the tab is hidden, and
 * again on each later hide that has something new (a deeper scroll, more
 * reading time, clicks), because the worker keeps the maximum of each:
 * a reader who locks the phone mid-office and comes back is measured to
 * where they finished, not to where the screen went dark.
 */
(function () {
  const PREVIEW_PARAM = "mo-hm-preview";

  // ── Preview mode ──────────────────────────────────────────────────
  //
  // /admin/heatmap/ frames the live homepage to draw the overlay on.
  // That frame must not record clicks (the reviewer's own clicks would
  // pollute the data it is displaying) and must not pop slide-ins over
  // the layout being measured. Both are handled by a class on <html>
  // plus an early return.
  const isPreview = (function () {
    try {
      return new URLSearchParams(window.location.search).get(PREVIEW_PARAM) === "1";
    } catch (_) {
      return false;
    }
  })();

  if (isPreview) {
    document.documentElement.classList.add("hm-preview");
    return;
  }

  // ── Page bucket ───────────────────────────────────────────────────
  const keys = window.MOPageKey;
  const PAGE = typeof keys === "function" ? keys() : null;
  if (!PAGE) return;

  // ── Consent signals ───────────────────────────────────────────────
  if (
    navigator.doNotTrack === "1" ||
    window.doNotTrack === "1" ||
    navigator.msDoNotTrack === "1" ||
    navigator.globalPrivacyControl === true
  ) return;

  const { body } = document;
  if (!body) return;

  const WORKER = (body.getAttribute("data-admin-worker-url") || "").replace(/\/+$/, "");
  if (!WORKER) return;

  const samplePct = parseInt(body.getAttribute("data-heatmap-sample") || "100", 10);
  if (!samplePct || samplePct <= 0) return;

  // ── Page-view identity ────────────────────────────────────────────
  //
  // Random per page view and kept nowhere. Not a cookie, not a
  // fingerprint, not shared with the next page: it exists so the worker
  // can count "page views that reached the join section" without
  // counting one page view twice across its early flush and its final
  // beacon. (It used to be a tab id plus a hash of the path, which let
  // anyone holding the table rebuild a tab's reading history and, with
  // the path hash reversed against the sitemap, its exact URLs.)
  const SAMPLED_KEY = "mo_hm_in";

  function randomId() {
    const buf = new Uint8Array(8);
    crypto.getRandomValues(buf);
    return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  const sid = randomId() + randomId().slice(0, 8);

  let sampledIn;
  try {
    // The sampling coin is flipped once per tab, not once per pageview,
    // so a sampled-in visitor's whole session is captured rather than a
    // ragged half of it.
    const stored = sessionStorage.getItem(SAMPLED_KEY);
    if (stored === null) {
      sampledIn = Math.random() * 100 < samplePct;
      sessionStorage.setItem(SAMPLED_KEY, sampledIn ? "1" : "0");
    } else {
      sampledIn = stored === "1";
    }
  } catch (_) {
    // Private mode with storage disabled: flip the coin per page view.
    sampledIn = Math.random() * 100 < samplePct;
  }

  if (!sampledIn) return;

  // ── Constants ─────────────────────────────────────────────────────
  // Per session: a hard cap on stored clicks, and the buffer size that
  // triggers an early flush so a long session is not lost to a crash.
  const MAX_CLICKS = 200;
  const FLUSH_AT = 25;
  const RAGE_WINDOW_MS = 800;
  const RAGE_RADIUS_PX = 40;
  const RAGE_COUNT = 3;
  const LABEL_MAX = 60;
  const SELECTOR_MAX = 120;
  const DWELL_MAX = 3600000;
  // A later hide re-sends only when the visit has moved on: deeper, a
  // section newly reached, or this much more reading time.
  const RESEND_DWELL_MS = 10000;
  // Reading blocks that fill in after load (the office's Scripture, a
  // Faith Received text) are not measured until they have settled.
  const DEPTH_SETTLE_MS = 1500;

  // Pages that scroll a pane instead of the window, and the reading
  // block whose depth is measured. [data-hm-scroller] / [data-hm-depth]
  // in markup win over these.
  const SCROLLERS = {
    "tfr-reader": "#scroll",
    welcome: ".welcome-page",
    "complete-membership": ".welcome-page",
  };
  // Pages whose reading block arrives by fetch. Until it has, the page is
  // a loading screen whose scroll and depth mean nothing (the reader's
  // pane cannot scroll yet, so the window path reads it as 100%).
  const PENDING = {
    "tfr-reader": "#reading > .loading",
    "liturgy-reader": "[data-dlr-loading]:not([hidden])",
  };
  function pending() {
    const sel = PENDING[PAGE];
    return !!(sel && document.querySelector(sel));
  }

  const DEPTH_TARGETS = {
    post: "[data-hm-section='body']",
    "liturgy-reader": "[data-dlr-body]",
    "tfr-document": "main.faith-doc",
    "tfr-reader": "#reading",
  };

  const startedAt = Date.now();
  let clicks = [];
  let recorded = 0;
  let maxScroll = 0;
  let maxDepth = 0;
  // Set the first time the reading block has a height. A block that
  // never showed (the office on a Sunday, an error state) sends no
  // depth at all rather than a zero that would drag the average down.
  let depthSettleAt = 0;
  const seen = Object.create(null);
  const recentClicks = [];

  // Time the tab was actually visible. A phone locked on the office for
  // an hour is not an hour of reading.
  let visibleMs = 0;
  let visibleSince = document.visibilityState === "hidden" ? 0 : startedAt;
  function dwellNow() {
    const open = visibleSince ? Date.now() - visibleSince : 0;
    return Math.min(visibleMs + open, DWELL_MAX);
  }

  function deviceBucket(w) {
    if (w < 600) return "mobile";
    if (w < 1024) return "tablet";
    return "desktop";
  }

  function clean(text, max) {
    return String(text || "")
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001F\u007F]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max);
  }

  // ── Section anchoring ─────────────────────────────────────────────
  function sectionFor(el) {
    if (keys && keys.sectionOf) return keys.sectionOf(el, document);
    return { key: "page", node: document.documentElement };
  }

  function permille(value, size) {
    if (!size) return 0;
    const v = Math.round((value / size) * 1000);
    if (v < 0) return 0;
    if (v > 1000) return 1000;
    return v;
  }

  // ── Element description ───────────────────────────────────────────
  //
  // A short ancestor path, enough for staff to find the element in the
  // template. Stops at <body>: "html > body > " prefixes every selector
  // and identifies nothing.
  function describe(el) {
    const parts = [];
    let node = el;
    let depth = 0;
    while (node && node.nodeType === 1 && depth < 4) {
      const tag = node.tagName.toLowerCase();
      if (tag === "body" || tag === "html") break;
      let part = node.tagName.toLowerCase();
      if (node.id) {
        part += `#${node.id}`;
        parts.unshift(part);
        break;
      }
      const cls = (node.getAttribute("class") || "").trim().split(/\s+/)[0];
      if (cls) part += `.${cls}`;
      parts.unshift(part);
      node = node.parentElement;
      depth += 1;
    }
    return clean(parts.join(" > "), SELECTOR_MAX);
  }

  // Where text is never read for a label. Whole page families that show
  // a member their own data (the dashboard, the manage pages, the
  // welcome survey, Ask and the Faith Received workspaces), and the
  // components that hold a member's own words on any page: the notebook,
  // personal and verse research, saved comparison views, the Ask panel's
  // history and folders. [data-hm-private]
  // marks any other.
  const PRIVATE_PAGES = /^(dashboard|account|welcome|complete-membership|tfr-ask|tfr-workspace)$/;
  const PRIVATE_ZONES = "[data-hm-private], [data-fn-root], .faith-notebook, [data-pr-workspace], " +
    ".pr-sequence, .pr-inspector, .vr-comparison, .vr-draft, .cmp-saved-row, " +
    // The Ask panel on the reader and search pages: its history rows are
    // the member's own questions, its folders the names they chose.
    "#fra-workspace";

  function shape(node) {
    if (node.tagName === "IMG") return "(img)";
    const cls = (node.getAttribute("class") || "").trim().split(/\s+/)[0];
    return clean(`(${node.tagName.toLowerCase()}${cls ? `.${cls}` : ""})`, LABEL_MAX);
  }

  // An element's own words, leaving out any field inside it: a <label>
  // wrapping a <textarea> would otherwise read as the textarea's saved
  // value, which is a member's note.
  function ownText(node) {
    return Array.from(node.childNodes, (c) => {
      if (c.nodeType === 3) return c.nodeValue;
      if (c.nodeType !== 1 || /^(INPUT|TEXTAREA|SELECT|SCRIPT|STYLE|TEMPLATE)$/.test(c.tagName)) return "";
      return ` ${ownText(c)} `;
    }).join("");
  }

  function labelFor(el, dead) {
    const explicit = el.closest("[data-hm-label]");
    if (explicit) return clean(explicit.getAttribute("data-hm-label"), LABEL_MAX);

    // A click on nothing clickable is named by what it hit, not by the
    // text it hit: on the reading pages that text is the essay, the
    // office or a Faith Received work, and every paragraph would become
    // a label of its own.
    if (dead) return shape(el);

    const interactive = el.closest("a, button, [role='button'], label, summary, input, select, textarea") || el;

    if (PRIVATE_PAGES.test(PAGE) || interactive.closest(PRIVATE_ZONES)) return shape(interactive);

    // A field is named by its fixed aria-label or its shape, never by
    // what is in it.
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(interactive.tagName)) {
      const fieldAria = interactive.getAttribute("aria-label");
      return fieldAria ? clean(fieldAria, LABEL_MAX) : shape(interactive);
    }

    const aria = interactive.getAttribute && interactive.getAttribute("aria-label");
    if (aria) return clean(aria, LABEL_MAX);

    const text = clean(ownText(interactive), LABEL_MAX);
    if (text) return text;

    const img = interactive.querySelector ? interactive.querySelector("img[alt]") : null;
    if (img) return clean(img.getAttribute("alt"), LABEL_MAX);

    const title = interactive.getAttribute && interactive.getAttribute("title");
    if (title) return clean(title, LABEL_MAX);

    const href = interactive.getAttribute && interactive.getAttribute("href");
    if (href) return clean(href, LABEL_MAX);

    return clean(interactive.tagName ? interactive.tagName.toLowerCase() : "", LABEL_MAX);
  }

  // Where a link without its own data-hm-goal is headed, when that
  // destination is one the numbers care about. A link that stays inside
  // the page's own family (a Faith Received link on a Faith Received
  // page) is navigation, not a conversion, and gets no goal.
  const DESTINATIONS = [
    [/^\/membership\//, "to-membership"],
    [/^\/give\//, "to-give"],
    [/^\/donate\//, "to-donate"],
    [/^\/year-end\//, "to-year-end"],
    [/^\/journal\//, "to-journal"],
    [/^\/daily-liturgy\//, "to-liturgy", /^liturgy/],
    [/^\/the-faith-received\//, "to-tfr", /^tfr-/],
    [/^\/podcasts\//, "to-podcast", /^podcast$/],
    [/^\/(store|books)\//, "to-store", /^store$/],
    [/^\/dashboard\//, "to-dashboard", /^dashboard$/],
  ];

  function linkGoal(a) {
    let url;
    try {
      url = new URL(a.getAttribute("href"), window.location.href);
    } catch (_) {
      return "";
    }
    if (url.hash.indexOf("#/portal/") === 0) {
      return `portal-${clean(url.hash.slice(9).split(/[/?]/)[0], 16) || "home"}`;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    if (url.hostname === "secure.anedot.com") return "to-donate";
    if (url.hostname === "buy.stripe.com" || url.hostname === "checkout.stripe.com") return "to-checkout";
    if (url.hostname !== window.location.hostname) return "outbound";
    for (const [re, goal, sameFamily] of DESTINATIONS) {
      if (!re.test(url.pathname)) continue;
      if (sameFamily && sameFamily.test(PAGE)) return "";
      return goal;
    }
    return "";
  }

  // Explicit data-hm-goal wins. Then the derived rules: article links
  // (the homepage's highest-volume action, far too numerous to tag by
  // hand in the post-entry partials), Portal triggers, form submits and
  // links to the destinations above.
  function goalFor(el) {
    const tagged = el.closest("[data-hm-goal]");
    if (tagged) return clean(tagged.getAttribute("data-hm-goal"), 40);
    if (el.closest("a.entry, a.feature-entry, a.hero-feature, .read-list a")) return "article";
    const portal = el.closest("[data-portal]");
    if (portal) return `portal-${clean(String(portal.getAttribute("data-portal") || "").split(/[/?#]/)[0], 16) || "home"}`;
    if (el.closest("[data-signup-submit], button[type='submit'], input[type='submit']")) return "form-submit";
    const a = el.closest("a[href]");
    if (a) return linkGoal(a);
    return "";
  }

  function isInteractive(el) {
    return !!el.closest(
      "a, button, input, select, textarea, label, summary, [role='button'], " +
      "[role='link'], [role='tab'], [onclick], [data-hm-goal], [data-portal], " +
      "[tabindex]:not([tabindex='-1'])"
    );
  }

  function isRage(pageX, pageY, now) {
    recentClicks.push({ x: pageX, y: pageY, t: now });
    while (recentClicks.length && now - recentClicks[0].t > RAGE_WINDOW_MS) recentClicks.shift();
    if (recentClicks.length < RAGE_COUNT) return false;
    const near = recentClicks.filter(
      (c) => Math.abs(c.x - pageX) <= RAGE_RADIUS_PX && Math.abs(c.y - pageY) <= RAGE_RADIUS_PX
    );
    return near.length >= RAGE_COUNT;
  }

  // ── Click capture ─────────────────────────────────────────────────
  document.addEventListener(
    "click",
    (event) => {
      if (recorded >= MAX_CLICKS) return;
      const el = event.target;
      if (!el || el.nodeType !== 1) return;

      const { key, node } = sectionFor(el);
      const rect = node.getBoundingClientRect();
      const now = Date.now();

      const { pageX, pageY } = event;
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      const dead = !isInteractive(el);

      const entry = {
        s: key,
        x: permille(localX, rect.width),
        y: permille(localY, rect.height),
        g: dead ? "" : goalFor(el),
        l: labelFor(el, dead),
        e: describe(el),
        t: Math.min(now - startedAt, DWELL_MAX),
      };
      if (dead) entry.d = 1;
      if (isRage(pageX, pageY, now)) entry.r = 1;

      clicks.push(entry);
      recorded += 1;
      if (clicks.length >= FLUSH_AT) flush(false);
    },
    true
  );

  // ── Scroll depth ──────────────────────────────────────────────────
  let scrollerEl = null;
  function scroller() {
    if (scrollerEl && scrollerEl.isConnected) return scrollerEl;
    const sel = SCROLLERS[PAGE];
    scrollerEl = document.querySelector("[data-hm-scroller]") || (sel ? document.querySelector(sel) : null);
    return scrollerEl;
  }

  // A pane counts only while it is the thing scrolling. On a phone the
  // reader's pane grows to its content and the window scrolls instead.
  function activePane() {
    const s = scroller();
    return s && s.scrollHeight > s.clientHeight + 4 ? s : null;
  }

  let depthEl = null;
  function depthTarget() {
    if (depthEl && depthEl.isConnected) return depthEl;
    const sel = DEPTH_TARGETS[PAGE];
    depthEl = document.querySelector("[data-hm-depth]") || (sel ? document.querySelector(sel) : null);
    return depthEl;
  }

  function trackDepth(force) {
    if (pending()) return;
    const el = depthTarget();
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.height < 1) return; // hidden, or not rendered yet
    const now = Date.now();
    if (!depthSettleAt) depthSettleAt = now + DEPTH_SETTLE_MS;
    if (!force && now < depthSettleAt) return;
    const pane = activePane();
    const bottom = pane
      ? Math.min(window.innerHeight, pane.getBoundingClientRect().bottom)
      : window.innerHeight;
    const reached = permille(bottom - r.top, r.height);
    if (reached > maxDepth) maxDepth = reached;
  }

  // ── Section reach ─────────────────────────────────────────────────
  //
  // "Reached" means a quarter of the section entered the viewport, or,
  // for a section too tall for that (an essay body, a long Scripture
  // reading), that it filled half the screen. That is the denominator
  // the admin funnel divides clicks by: a section nobody scrolled to has
  // not failed to convert, it has failed to be seen, and those are
  // different problems.
  const keyOfNode = new Map();
  const onScreen = new Set();

  function markSeen(node, ratio, visibleHeight) {
    const k = keyOfNode.get(node);
    if (!k || seen[k]) return;
    if (ratio >= 0.25 || visibleHeight >= window.innerHeight * 0.5) seen[k] = 1;
  }

  // The observer reports a tall section once, as it enters; whether it
  // has filled half the screen is checked again as the visitor scrolls.
  function checkTallSections() {
    onScreen.forEach((node) => {
      const k = keyOfNode.get(node);
      if (!k || seen[k]) return;
      const r = node.getBoundingClientRect();
      const visible = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
      markSeen(node, r.height ? visible / r.height : 0, visible);
    });
  }

  // New blocks (a reader that renders from data, a late section) are
  // picked up as the visitor scrolls, at most every two seconds.
  let lastObserve = 0;

  function trackScroll() {
    if (Date.now() - lastObserve > 2000) {
      lastObserve = Date.now();
      observeSections();
    }
    if (pending()) return;
    const pane = activePane();
    let reached;
    if (pane) {
      reached = permille(pane.scrollTop + pane.clientHeight, pane.scrollHeight);
    } else {
      const doc = document.documentElement;
      const height = Math.max(doc.scrollHeight, document.body.scrollHeight);
      if (!height) return;
      reached = permille(window.scrollY + window.innerHeight, height);
    }
    if (reached > maxScroll) maxScroll = reached;
    trackDepth(false);
    checkTallSections();
  }

  let scrollTick = false;
  // Capture on the document: an element's scroll event does not bubble,
  // and the Faith Received reader scrolls a pane, not the window.
  document.addEventListener(
    "scroll",
    (event) => {
      // Only the page or the reading pane; a carousel or a sidebar list
      // scrolling is not the visitor moving down the page.
      if (event.target !== document && event.target !== scroller()) return;
      if (scrollTick) return;
      scrollTick = true;
      requestAnimationFrame(() => {
        trackScroll();
        scrollTick = false;
      });
    },
    { passive: true, capture: true }
  );

  let observer = null;
  function observeSections() {
    if (typeof IntersectionObserver !== "function" || !keys || !keys.sections) return;
    if (!observer) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              onScreen.add(e.target);
              markSeen(e.target, e.intersectionRatio, e.intersectionRect.height);
            } else {
              onScreen.delete(e.target);
            }
          });
        },
        { threshold: [0, 0.05, 0.1, 0.25, 0.5] }
      );
    }
    keys.sections(document).forEach(({ key, node }) => {
      if (keyOfNode.has(node)) return;
      keyOfNode.set(node, key);
      observer.observe(node);
    });
  }

  // No measurement at boot: the first paint of a page that fills in by
  // fetch is a loading screen. The final flush measures where the
  // visitor actually is. A throw here must not stop the rest of
  // site.min.js, which is plain concatenation.
  try { observeSections(); } catch (_) { /* telemetry only */ }
  window.addEventListener("load", () => {
    try { observeSections(); } catch (_) { /* telemetry only */ }
  }, { once: true });

  // ── Flush ─────────────────────────────────────────────────────────
  function referrerHost() {
    // Hostname only. The full referrer can carry search terms, member
    // tokens, and private URLs; none of that belongs in a heatmap.
    try {
      const { referrer } = document;
      if (!referrer) return "";
      const url = new URL(referrer);
      if (url.hostname === window.location.hostname) return "";
      return clean(url.hostname, 80);
    } catch (_) {
      return "";
    }
  }

  function payload(final) {
    const doc = document.documentElement;
    const data = {
      v: 1,
      sid,
      page: PAGE,
      dev: deviceBucket(window.innerWidth),
      vw: window.innerWidth,
      vh: window.innerHeight,
      dh: Math.max(doc.scrollHeight, document.body.scrollHeight),
      mem: body.hasAttribute("data-member-email"),
      ref: referrerHost(),
      dwell: dwellNow(),
      scroll: maxScroll,
      seen: Object.keys(seen),
      final: final ? 1 : 0,
      clicks,
    };
    if (depthSettleAt) data.depth = maxDepth;
    return data;
  }

  // What the last beacon reported, so a later hide sends only news.
  let last = null;

  function changedSinceLast() {
    if (!last) return true;
    return (
      maxScroll > last.scroll ||
      maxDepth > last.depth ||
      Object.keys(seen).length > last.seen ||
      dwellNow() - last.dwell >= RESEND_DWELL_MS
    );
  }

  function flush(final) {
    // A background tab closed without ever being looked at is not a
    // page view anyone read.
    if (final && !visibleMs && !visibleSince && !clicks.length) return;
    if (final) {
      trackScroll();
      trackDepth(true);
      if (!clicks.length && !changedSinceLast()) return;
    } else if (!clicks.length) {
      return;
    }
    const data = payload(final);
    clicks = [];
    last = { scroll: maxScroll, depth: maxDepth, seen: data.seen.length, dwell: data.dwell };

    const url = `${WORKER}/heatmap/collect`;
    const json = JSON.stringify(data);

    // text/plain keeps the beacon a CORS-simple request. An
    // application/json beacon needs a preflight, which sendBeacon
    // cannot perform during pagehide — the payload would be dropped
    // exactly when it matters most. The worker parses the text.
    try {
      const blob = new Blob([json], { type: "text/plain;charset=UTF-8" });
      if (navigator.sendBeacon && navigator.sendBeacon(url, blob)) return;
    } catch (_) { /* fall through to fetch */ }

    try {
      fetch(url, {
        method: "POST",
        body: json,
        keepalive: true,
        mode: "cors",
        credentials: "omit",
        headers: { "content-type": "text/plain;charset=UTF-8" },
      }).catch(() => {});
    } catch (_) { /* give up silently — this is telemetry, not the product */ }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      if (visibleSince) visibleMs += Date.now() - visibleSince;
      visibleSince = 0;
      flush(true);
    } else if (!visibleSince) {
      visibleSince = Date.now();
    }
  });
  window.addEventListener("pagehide", () => { flush(true); });
})();
