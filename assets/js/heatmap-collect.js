/*
 * Click-heatmap collector.
 *
 * Records where visitors click, which sections they actually reach, and
 * which clicks go nowhere — the raw material for /admin/heatmap/.
 * Ships in site.min.js and runs on two page buckets: the homepage, and
 * the article template (every essay aggregated into one heatmap, not
 * one heatmap per URL). Everywhere else it returns immediately, so the
 * cost is a string compare and a class check.
 *
 * What it stores
 * ==============
 * Nothing that identifies a person. Per pageview:
 *   - a random tab-scoped id (sessionStorage, cleared when the tab
 *     closes), mixed with a hash of the path so one tab reading three
 *     essays counts as three page views rather than one
 *   - device bucket, viewport width, document height
 *   - whether the visitor was signed in (boolean — never the email)
 *   - referrer HOSTNAME only, never the full referring URL
 *   - max scroll depth + which sections came into view
 * Per click:
 *   - the section it landed in and the position inside that section
 *   - a short selector + visible label for the element
 *   - the conversion goal, if the element carries data-hm-goal
 *   - dead/rage flags
 *
 * Coordinates are anchored to [data-hm-section] elements and stored as
 * permille of that section's box, NOT as raw page pixels. A pixel
 * heatmap drifts the moment the homepage gains a paragraph or the
 * visitor's viewport differs from the reviewer's; section-relative
 * coordinates survive both, and let the admin tool re-project clicks
 * onto today's layout at any width.
 *
 * Off switch: Ghost Admin -> Design -> Customize -> "Homepage heatmap
 * sampling". Set it to Off and this file stops collecting. Do Not
 * Track and Global Privacy Control are honored unconditionally.
 *
 * Ingest: POST {admin_worker_url}/heatmap/collect via sendBeacon, same
 * public-beacon shape as the slide-in impression pings (origin
 * allowlist + rate limit on the worker side; see
 * WORKER-PATCH-heatmap.md).
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
  //
  // Clicks are bucketed by TEMPLATE, not by URL. "post" is every essay
  // on the site rolled into one heatmap: per-URL tracking would mean
  // thousands of heatmaps with a handful of sessions each, which is
  // both useless statistically and unbounded in storage. Templates
  // that carry no [data-hm-section] markers stay unrecorded — a page
  // with no sections yields nothing but a shapeless `page` blob.
  const PAGE = (function () {
    if (window.location.pathname === "/") return "home";
    if (document.body && document.body.classList.contains("post-template")) return "post";
    return null;
  })();

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

  // ── Session identity ──────────────────────────────────────────────
  //
  // Tab-scoped and random. Not a cookie, not a fingerprint, not stable
  // across visits — it exists so the worker can count "sessions that
  // reached the join section" without counting one visitor twice.
  const SID_KEY = "mo_hm_sid";
  const SAMPLED_KEY = "mo_hm_in";

  function randomId() {
    const buf = new Uint8Array(8);
    crypto.getRandomValues(buf);
    return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  // heatmap_sessions is keyed on sid alone, and section/goal rows on
  // (sid, sec) and (sid, goal). A tab that reads three essays would
  // collapse into one row and report the deepest scroll of the three as
  // if it were one page view. Mixing a hash of the path into the tab id
  // makes the id per-page-view: stable across this page's early flush
  // and its pagehide beacon, distinct between pages, still hex for the
  // worker's sid check. The path never leaves the browser.
  function pathHash(path) {
    let h = 0x811c9dc5;
    for (let i = 0; i < path.length; i += 1) {
      h ^= path.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  }

  let sid;
  let sampledIn;
  try {
    sid = sessionStorage.getItem(SID_KEY);
    if (!sid) {
      sid = randomId();
      sessionStorage.setItem(SID_KEY, sid);
    }
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
    // Private mode with storage disabled: fall back to a per-pageview id.
    sid = randomId();
    sampledIn = Math.random() * 100 < samplePct;
  }

  if (!sampledIn) return;

  // Tab id from here on is the page-view id.
  sid = sid.slice(0, 16) + pathHash(window.location.pathname);

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

  const startedAt = Date.now();
  let clicks = [];
  let recorded = 0;
  let maxScroll = 0;
  let sent = false;
  const seen = Object.create(null);
  const recentClicks = [];

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
    const node = el && el.closest ? el.closest("[data-hm-section]") : null;
    if (node) return { key: node.getAttribute("data-hm-section") || "page", node };
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

  function labelFor(el) {
    const explicit = el.closest("[data-hm-label]");
    if (explicit) return clean(explicit.getAttribute("data-hm-label"), LABEL_MAX);

    const interactive = el.closest("a, button, [role='button'], label, summary, input, select, textarea") || el;

    const aria = interactive.getAttribute && interactive.getAttribute("aria-label");
    if (aria) return clean(aria, LABEL_MAX);

    const text = clean(interactive.textContent, LABEL_MAX);
    if (text) return text;

    const img = interactive.querySelector ? interactive.querySelector("img[alt]") : null;
    if (img) return clean(img.getAttribute("alt"), LABEL_MAX);

    const href = interactive.getAttribute && interactive.getAttribute("href");
    if (href) return clean(href, LABEL_MAX);

    return clean(interactive.tagName ? interactive.tagName.toLowerCase() : "", LABEL_MAX);
  }

  // Explicit data-hm-goal wins. The one derived rule covers article
  // links, which are the homepage's highest-volume action and are far
  // too numerous to tag by hand in the post-entry partials.
  function goalFor(el) {
    const tagged = el.closest("[data-hm-goal]");
    if (tagged) return clean(tagged.getAttribute("data-hm-goal"), 40);
    if (el.closest("a.entry, a.feature-entry, a.hero-feature, .read-list a")) return "article";
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

      const entry = {
        s: key,
        x: permille(localX, rect.width),
        y: permille(localY, rect.height),
        g: goalFor(el),
        l: labelFor(el),
        e: describe(el),
        t: Math.min(now - startedAt, 3600000),
      };
      if (!isInteractive(el)) entry.d = 1;
      if (isRage(pageX, pageY, now)) entry.r = 1;

      clicks.push(entry);
      recorded += 1;
      if (clicks.length >= FLUSH_AT) flush(false);
    },
    true
  );

  // ── Scroll depth ──────────────────────────────────────────────────
  function trackScroll() {
    const doc = document.documentElement;
    const height = Math.max(doc.scrollHeight, document.body.scrollHeight);
    if (!height) return;
    const reached = permille(window.scrollY + window.innerHeight, height);
    if (reached > maxScroll) maxScroll = reached;
  }

  let scrollTick = false;
  window.addEventListener(
    "scroll",
    () => {
      if (scrollTick) return;
      scrollTick = true;
      requestAnimationFrame(() => {
        trackScroll();
        scrollTick = false;
      });
    },
    { passive: true }
  );
  trackScroll();

  // ── Section reach ─────────────────────────────────────────────────
  //
  // "Reached" means at least a quarter of the section entered the
  // viewport. That is the denominator the admin funnel divides clicks
  // by: a section nobody scrolled to has not failed to convert, it has
  // failed to be seen, and those are different problems.
  if (typeof IntersectionObserver === "function") {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const k = e.target.getAttribute("data-hm-section");
          if (k) seen[k] = 1;
        });
      },
      { threshold: 0.25 }
    );
    document.querySelectorAll("[data-hm-section]").forEach((el) => { observer.observe(el); });
  }

  // ── Flush ─────────────────────────────────────────────────────────
  function payload(final) {
    const doc = document.documentElement;
    return {
      v: 1,
      sid,
      page: PAGE,
      dev: deviceBucket(window.innerWidth),
      vw: window.innerWidth,
      vh: window.innerHeight,
      dh: Math.max(doc.scrollHeight, document.body.scrollHeight),
      mem: body.hasAttribute("data-member-email"),
      ref: referrerHost(),
      dwell: Math.min(Date.now() - startedAt, 3600000),
      scroll: maxScroll,
      seen: Object.keys(seen),
      final: final ? 1 : 0,
      clicks,
    };
  }

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

  function flush(final) {
    if (final && sent) return;
    if (!final && !clicks.length) return;
    const data = payload(final);
    clicks = [];
    if (final) sent = true;

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
    if (document.visibilityState === "hidden") flush(true);
  });
  window.addEventListener("pagehide", () => { flush(true); });
})();
