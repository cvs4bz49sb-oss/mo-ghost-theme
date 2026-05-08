/*
 * Slide-in CTA — a single, subtle notification that slides into the
 * bottom-right on desktop or bottom-edge on mobile. Configured via
 * /admin/slide-ins/ (KV-backed). Targeting by page type, tag, and
 * audience; frequency-capped per localStorage.
 *
 * On each page load:
 *   1. Fetch active slide-ins (sessionStorage cache, 5-min TTL).
 *   2. Filter to those matching the current page + audience.
 *   3. Exclude any the visitor has dismissed within its frequency window.
 *   4. Pick the highest-priority remaining item.
 *   5. Render it and animate in after a short delay.
 */
(function () {
  var workerUrl = (document.body.getAttribute("data-admin-worker-url") || "").replace(/\/$/, "");
  if (!workerUrl) return;

  var CACHE_KEY = "mo_slide_ins";
  var CACHE_TTL = 5 * 60 * 1000;
  var DISMISS_PREFIX = "mo_sid_";

  // ── Page context ──────────────────────────────────────────────
  var bodyClass = document.body.className || "";
  var isHome = /\bhome-template\b/.test(bodyClass);
  var isPost = /\bpost-template\b/.test(bodyClass);
  var pageTags = [];
  if (isPost) {
    var m = bodyClass.match(/\btag-([a-z0-9-]+)/g);
    if (m) pageTags = m.map(function (c) { return c.replace("tag-", ""); });
  }

  var memberEmail = document.body.getAttribute("data-member-email") || "";
  var memberStatus = document.body.getAttribute("data-member-status") || "";
  var isMember = !!memberEmail;
  var isPaid = memberStatus === "paid";
  var isFree = isMember && !isPaid;

  // ── Fetch ─────────────────────────────────────────────────────
  function load(cb) {
    try {
      var cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        var parsed = JSON.parse(cached);
        if (parsed.ts && Date.now() - parsed.ts < CACHE_TTL) { cb(parsed.items); return; }
      }
    } catch (e) {}

    fetch(workerUrl + "/slide-ins")
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (items) {
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), items: items })); } catch (e) {}
        cb(items);
      })
      .catch(function () { cb([]); });
  }

  // ── Matching ──────────────────────────────────────────────────
  function matchesPage(item) {
    var p = item.pages;
    if (p === "all") return true;
    if (p === "homepage") return isHome;
    if (p === "posts") return isPost;
    if (p.indexOf("tag:") === 0) {
      var slug = p.slice(4);
      return isPost && pageTags.indexOf(slug) >= 0;
    }
    return false;
  }

  function matchesAudience(item) {
    var a = item.audience;
    if (a === "everyone") return true;
    if (a === "not-signed-in") return !isMember;
    if (a === "signed-in") return isMember;
    if (a === "free") return isFree;
    if (a === "paid") return isPaid;
    return false;
  }

  function isDismissed(item) {
    try {
      var raw = localStorage.getItem(DISMISS_PREFIX + item.id);
      if (!raw) return false;
      var ts = parseInt(raw, 10);
      if (isNaN(ts)) return false;
      var now = Date.now();
      var f = item.frequency;
      if (f === "once") return true;
      var windows = { daily: 86400000, weekly: 604800000, biweekly: 1209600000, monthly: 2592000000 };
      var window = windows[f] || 604800000;
      return (now - ts) < window;
    } catch (e) { return false; }
  }

  function dismiss(item) {
    try { localStorage.setItem(DISMISS_PREFIX + item.id, String(Date.now())); } catch (e) {}
  }

  // ── Render ────────────────────────────────────────────────────
  function render(item) {
    var el = document.createElement("aside");
    el.className = "slide-in" + (item.image ? " has-image" : "");
    el.setAttribute("role", "complementary");
    el.setAttribute("aria-label", item.headline);

    var close = document.createElement("button");
    close.type = "button";
    close.className = "slide-in-close";
    close.setAttribute("aria-label", "Dismiss");
    close.innerHTML = "&times;";
    el.appendChild(close);

    if (item.image) {
      var img = document.createElement("img");
      img.className = "slide-in-image";
      img.src = item.image;
      img.alt = "";
      img.loading = "lazy";
      el.appendChild(img);
    }

    var content = document.createElement("div");
    content.className = "slide-in-content";

    if (item.eyebrow) {
      var ey = document.createElement("p");
      ey.className = "eyebrow slide-in-eyebrow";
      ey.textContent = item.eyebrow;
      content.appendChild(ey);
    }

    var h = document.createElement("h3");
    h.className = "slide-in-headline";
    var em = document.createElement("em");
    em.textContent = item.headline;
    h.appendChild(em);
    content.appendChild(h);

    if (item.body) {
      var p = document.createElement("p");
      p.className = "slide-in-body";
      p.textContent = item.body;
      content.appendChild(p);
    }

    var btn = document.createElement("a");
    btn.href = item.button_url;
    btn.className = "btn btn-primary slide-in-btn";
    btn.textContent = item.button_text;
    content.appendChild(btn);

    el.appendChild(content);

    close.addEventListener("click", function () {
      dismiss(item);
      el.classList.remove("is-visible");
      setTimeout(function () { el.remove(); }, 400);
    });

    document.body.appendChild(el);

    setTimeout(function () { el.classList.add("is-visible"); }, 50);
  }

  // ── Trigger helpers ────────────────────────────────────────────
  function getScrollPercent() {
    var h = document.documentElement;
    var b = document.body;
    var st = h.scrollTop || b.scrollTop;
    var sh = Math.max(h.scrollHeight, b.scrollHeight) - window.innerHeight;
    return sh > 0 ? (st / sh) * 100 : 100;
  }

  function attachTrigger(item) {
    var trigger = item.trigger || "delay";
    var value = parseInt(item.trigger_value, 10) || 0;
    var shown = false;

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
      var pct = value > 0 ? value : 50;
      function checkScroll() {
        if (getScrollPercent() >= pct) {
          window.removeEventListener("scroll", checkScroll);
          show();
        }
      }
      window.addEventListener("scroll", checkScroll, { passive: true });
      checkScroll();
    } else {
      var ms = (value > 0 ? value : 3) * 1000;
      setTimeout(show, ms);
    }
  }

  // ── Init ──────────────────────────────────────────────────────
  load(function (items) {
    if (!items || !items.length) return;

    var candidates = items
      .filter(matchesPage)
      .filter(matchesAudience)
      .filter(function (i) { return !isDismissed(i); });

    if (!candidates.length) return;

    candidates.sort(function (a, b) { return (b.priority || 0) - (a.priority || 0); });
    attachTrigger(candidates[0]);
  });
})();
