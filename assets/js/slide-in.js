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
 *   4. Exclude any the visitor has dismissed within its frequency window.
 *   5. Pick the highest-priority remaining item.
 *   6. Render it and animate in after a short delay.
 */
(function () {
  const workerUrl = (document.body.getAttribute("data-admin-worker-url") || "").replace(/\/$/, "");
  if (!workerUrl) return;

  const CACHE_KEY = "mo_slide_ins";
  const CACHE_TTL = 5 * 60 * 1000;
  const DISMISS_PREFIX = "mo_sid_";

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
  // an exclusion. A trailing "*" covers everything under a path
  // ("/dashboard/*" hides it on /dashboard/ and every page beneath it).
  function isExcluded(item) {
    const raw = item.exclude_paths || "";
    if (!raw) return false;
    return raw.split(",").some((entry) => {
      const pattern = entry.trim().toLowerCase();
      if (!pattern) return false;
      if (pattern.slice(-1) === "*") {
        const prefix = pattern.slice(0, -1).replace(/\/+$/, "");
        if (!prefix) return true;
        return currentPath.indexOf(`${prefix}/`) === 0;
      }
      return currentPath === normalizePath(pattern);
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

  function isDismissed(item) {
    try {
      const raw = localStorage.getItem(DISMISS_PREFIX + item.id);
      if (!raw) return false;
      const ts = parseInt(raw, 10);
      if (isNaN(ts)) return false;
      const now = Date.now();
      const f = item.frequency;
      if (f === "once") return true;
      const windows = { daily: 86400000, weekly: 604800000, biweekly: 1209600000, monthly: 2592000000 };
      const window = windows[f] || 604800000;
      return (now - ts) < window;
    } catch (e) { return false; }
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
      .filter((i) => { return !isDismissed(i); });

    if (!candidates.length) return;

    candidates.sort((a, b) => { return (b.priority || 0) - (a.priority || 0); });
    attachTrigger(candidates[0]);
  });
})();
