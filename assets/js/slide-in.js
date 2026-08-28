/*
 * Slide-in CTA — a single, subtle notification that slides into the
 * bottom-right on desktop or bottom-edge on mobile. Configured via
 * /admin/slide-ins/ (KV-backed). Targeting by page type, tag, and
 * audience; frequency-capped per localStorage.
 *
 * On each page load:
 *   1. Fetch active slide-ins (sessionStorage cache, 5-min TTL).
 *   2. Filter to those matching the current page + audience.
 *   3. Drop any whose exclude_paths list covers the current path.
 *   4. Drop any the visitor has already been shown or has dismissed
 *      (see § Frequency below).
 *   5. Pick the highest-priority remaining item.
 *   6. Render it and animate in after a short delay.
 *
 * § Frequency. The window on each slide-in caps how often it can be
 * SHOWN, not just how long a dismissal lasts. Before 2026-08-28 only a
 * dismissal was recorded, so a visitor who ignored a slide-in — closed
 * the tab, scrolled past it, navigated away — got it again on every
 * single page load, forever. Reported by a reader who was seeing the
 * Kirk giveaway every morning. Three rules now hold, in order:
 *
 *   - dismissed (the × was clicked) → gone for DISMISS_WINDOW, or for
 *     good when frequency is "once". Closing it is a deliberate act and
 *     outranks whatever the campaign's frequency says.
 *   - shown recently → nothing again until the frequency window passes,
 *     whether or not the visitor touched it.
 *   - shown SEEN_CAP times without a click → gone for good. Someone who
 *     has ignored it five times is not going to convert on the sixth.
 */
(function () {
  const workerUrl = (document.body.getAttribute("data-admin-worker-url") || "").replace(/\/$/, "");
  if (!workerUrl) return;

  const CACHE_KEY = "mo_slide_ins";
  const CACHE_TTL = 5 * 60 * 1000;
  const DISMISS_PREFIX = "mo_sid_";
  const SEEN_PREFIX = "mo_sis_";
  const DISMISS_WINDOW = 90 * 86400000;
  const SEEN_CAP = 5;

  // ── Page context ──────────────────────────────────────────────
  const bodyClass = document.body.className || "";
  const isHome = /\bhome-template\b/.test(bodyClass);
  const isPost = /\bpost-template\b/.test(bodyClass);
  let pageTags = [];
  if (isPost) {
    const m = bodyClass.match(/\btag-([a-z0-9-]+)/g);
    if (m) pageTags = m.map((c) => { return c.replace("tag-", ""); });
  }

  // Every path is compared lowercase with exactly one trailing slash, so
  // "/Membership", "/membership/" and "/membership//" all normalize the
  // same way. "/" normalizes to "/".
  function normalizePath(p) {
    const s = String(p || "/").toLowerCase().split("?")[0].split("#")[0];
    return `${s.replace(/\/+$/, "")}/`;
  }
  const currentPath = normalizePath(window.location.pathname);

  const memberEmail = document.body.getAttribute("data-member-email") || "";
  const memberStatus = document.body.getAttribute("data-member-status") || "";
  const isMember = !!memberEmail;
  // Ghost member.status is "free", "paid", or "comped". Comped members
  // have complimentary full access, so treat them as paid — they must
  // NOT match a "free subscribers only" audience. Only a true "free"
  // status is a free subscriber.
  const isPaid = memberStatus === "paid" || memberStatus === "comped";
  const isFree = isMember && memberStatus === "free";

  // ── Fetch ─────────────────────────────────────────────────────
  function load(cb) {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.ts && Date.now() - parsed.ts < CACHE_TTL) { cb(parsed.items); return; }
      }
    } catch (e) {}

    fetch(`${workerUrl}/slide-ins`)
      .then((r) => { return r.ok ? r.json() : []; })
      .then((items) => {
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), items })); } catch (e) {}
        cb(items);
      })
      .catch(() => { cb([]); });
  }

  // ── Matching ──────────────────────────────────────────────────
  function matchesPage(item) {
    const p = item.pages;
    if (p === "all") return true;
    if (p === "homepage") return isHome;
    if (p === "posts") return isPost;
    if (p.indexOf("tag:") === 0) {
      const slug = p.slice(4);
      return isPost && pageTags.indexOf(slug) >= 0;
    }
    return false;
  }

  // exclude_paths is a comma-separated list of page paths the slide-in
  // must never appear on. It is checked AFTER matchesPage, so it always
  // wins: "all posts, but not this one" is expressed as pages=posts plus
  // an exclusion.
  //
  // An entry covers its own path AND everything beneath it, so
  // "/daily-liturgy/" hides the slide-in on /daily-liturgy/read/ too.
  // It used to be an exact match, which meant excluding a section left
  // its sub-pages uncovered and looked like the exclusion had silently
  // failed. A trailing "*" is still accepted and means the same thing.
  // "/" is the one exception: it matches only the homepage, since a
  // prefix match there would hide the slide-in on the whole site.
  function isExcluded(item) {
    const raw = item.exclude_paths || "";
    if (!raw) return false;
    return raw.split(",").some((entry) => {
      const trimmed = entry.trim().toLowerCase();
      if (!trimmed) return false;
      const pattern = normalizePath(trimmed.replace(/\*+$/, ""));
      if (pattern === "/") return trimmed.slice(-1) === "*" ? true : currentPath === "/";
      return currentPath === pattern || currentPath.indexOf(pattern) === 0;
    });
  }

  function matchesAudience(item) {
    const parts = (item.audience || "everyone").split(",");
    return parts.some((a) => {
      if (a === "everyone") return true;
      if (a === "not-signed-in") return !isMember;
      if (a === "signed-in") return isMember;
      if (a === "free") return isFree;
      if (a === "paid") return isPaid;
      return false;
    });
  }

  function frequencyWindow(item) {
    const windows = { daily: 86400000, weekly: 604800000, biweekly: 1209600000, monthly: 2592000000 };
    return windows[item.frequency] || 604800000;
  }

  // { n: times shown, t: last shown }. Written on every impression, so a
  // slide-in nobody interacts with still runs out its own frequency
  // window instead of returning on the next page load.
  function readSeen(id) {
    try {
      const raw = localStorage.getItem(SEEN_PREFIX + id);
      if (!raw) return { n: 0, t: 0 };
      const parsed = JSON.parse(raw);
      return { n: parseInt(parsed.n, 10) || 0, t: parseInt(parsed.t, 10) || 0 };
    } catch (e) { return { n: 0, t: 0 }; }
  }

  function isSuppressed(item) {
    const now = Date.now();

    try {
      const raw = localStorage.getItem(DISMISS_PREFIX + item.id);
      if (raw) {
        const ts = parseInt(raw, 10);
        if (!isNaN(ts)) {
          if (item.frequency === "once") return true;
          if (now - ts < DISMISS_WINDOW) return true;
        }
      }
    } catch (e) {}

    const seen = readSeen(item.id);
    if (seen.n >= SEEN_CAP) return true;
    if (seen.t && now - seen.t < frequencyWindow(item)) return true;
    return false;
  }

  function markSeen(item) {
    const seen = readSeen(item.id);
    try {
      localStorage.setItem(SEEN_PREFIX + item.id, JSON.stringify({ n: seen.n + 1, t: Date.now() }));
    } catch (e) {}
  }

  function dismiss(item) {
    try { localStorage.setItem(DISMISS_PREFIX + item.id, String(Date.now())); } catch (e) {}
  }

  // ── Render ────────────────────────────────────────────────────
  function render(item) {
    const el = document.createElement("aside");
    el.className = `slide-in${item.image ? " has-image" : ""}`;
    el.setAttribute("role", "complementary");
    el.setAttribute("aria-label", item.headline);

    const close = document.createElement("button");
    close.type = "button";
    close.className = "slide-in-close";
    close.setAttribute("aria-label", "Dismiss");
    close.innerHTML = "&times;";
    el.appendChild(close);

    if (item.image && window.MOSafeHref.isSafe(item.image)) {
      const img = document.createElement("img");
      img.className = "slide-in-image";
      img.src = item.image;
      img.alt = "";
      img.loading = "lazy";
      el.appendChild(img);
    }

    const content = document.createElement("div");
    content.className = "slide-in-content";

    if (item.eyebrow) {
      const ey = document.createElement("p");
      ey.className = "eyebrow slide-in-eyebrow";
      ey.textContent = item.eyebrow;
      content.appendChild(ey);
    }

    const h = document.createElement("h3");
    h.className = "slide-in-headline";
    const em = document.createElement("em");
    em.textContent = item.headline;
    h.appendChild(em);
    content.appendChild(h);

    if (item.body) {
      const p = document.createElement("p");
      p.className = "slide-in-body";
      p.textContent = item.body;
      content.appendChild(p);
    }

    // Validate the worker-supplied URL against MOSafeHref's scheme
    // allowlist (http(s)/mailto/tel/path-relative). A javascript:
    // URL here would XSS every visitor on every page that shows the
    // slide-in.
    const btn = document.createElement("a");
    window.MOSafeHref.set(btn, item.button_url);
    btn.className = "btn btn-primary slide-in-btn";
    btn.textContent = item.button_text;
    content.appendChild(btn);

    el.appendChild(content);

    close.addEventListener("click", () => {
      dismiss(item);
      el.classList.remove("is-visible");
      setTimeout(() => { el.remove(); }, 400);
    });

    btn.addEventListener("click", () => {
      track(item.id, "click");
    });

    document.body.appendChild(el);

    setTimeout(() => {
      el.classList.add("is-visible");
      markSeen(item);
      track(item.id, "impression");
    }, 50);
  }

  function track(id, type) {
    try { navigator.sendBeacon(`${workerUrl}/slide-ins/${id}/${type}`); } catch (e) {}
  }

  // ── Trigger helpers ────────────────────────────────────────────
  function getScrollPercent() {
    const h = document.documentElement;
    const b = document.body;
    const st = h.scrollTop || b.scrollTop;
    const sh = Math.max(h.scrollHeight, b.scrollHeight) - window.innerHeight;
    return sh > 0 ? (st / sh) * 100 : 100;
  }

  function attachTrigger(item) {
    const trigger = item.trigger || "delay";
    const value = parseInt(item.trigger_value, 10) || 0;
    let shown = false;

    function show() {
      if (shown) return;
      shown = true;
      render(item);
    }

    if (trigger === "exit") {
      document.documentElement.addEventListener("mouseleave", function handler(e) {
        if (e.clientY <= 0) {
          document.documentElement.removeEventListener("mouseleave", handler);
          show();
        }
      });
      setTimeout(show, 60000);
    } else if (trigger === "scroll") {
      const pct = value > 0 ? value : 50;
      function checkScroll() {
        if (getScrollPercent() >= pct) {
          window.removeEventListener("scroll", checkScroll);
          show();
        }
      }
      window.addEventListener("scroll", checkScroll, { passive: true });
      checkScroll();
    } else {
      const ms = (value > 0 ? value : 3) * 1000;
      setTimeout(show, ms);
    }
  }

  // ── Init ──────────────────────────────────────────────────────
  load((items) => {
    if (!items || !items.length) return;

    const candidates = items
      .filter(matchesPage)
      .filter((i) => { return !isExcluded(i); })
      .filter(matchesAudience)
      .filter((i) => { return !isSuppressed(i); });

    if (!candidates.length) return;

    candidates.sort((a, b) => { return (b.priority || 0) - (a.priority || 0); });
    attachTrigger(candidates[0]);
  });
})();
