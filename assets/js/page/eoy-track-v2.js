/*
 * Year-end campaign tracker, browser side (2026-11-13). Loaded on every
 * page, before eoy-bar.js; does nothing until eoy-bar.js or eoy-page.js
 * calls it. The numbers show on /admin/slide-ins/.
 *
 * window.MOEoy:
 *   send(event, segment, goal)  counts one event at mo-admin POST /eoy/track
 *                               (worker: admin/lib/eoy-stats.js has the list)
 *   reachOnce(event, segment)   the same, at most once per reader per day
 *   rememberSource(src)         the bar was clicked (src = bar-a) or a link
 *                               in the Support menu / dashboard card
 *                               (src = menu / dash)
 *
 * Support menu and dashboard card (2026-11-20): their links carry
 * ?eoy=menu|dash (or Anedot's source_code=eoy-menu) in the template, which
 * the checkouts pass on. A click inside [data-eoy-src] also remembers the
 * source for /year-end/, counts a link_click (goal = data-hm-goal), and for
 * a Portal offer link adds ?eoy= to this page's URL, because Portal uses
 * the page it opened on as the checkout's cancel_url. The -v2 file name is
 * a cache-buster.
 *   recentSource()              that source, if it was in the last day
 *
 * Beacons are text/plain so they stay CORS-simple (no preflight), as in
 * heatmap-collect.js. Storage blocked: reach counts every page and the bar
 * source is lost, which only blurs the numbers.
 */
(function () {
  if (window.MOEoy) return;
  const SOURCES = ["bar-a", "bar-b", "menu", "dash", "email", "page"];
  const LINK_SOURCES = ["menu", "dash"];
  const SRC_KEY = "mo_eoy_src";
  const DAY_MS = 86400000;

  function workerUrl() {
    return ((document.body && document.body.getAttribute("data-admin-worker-url")) || "").replace(/\/+$/, "");
  }

  function send(e, s, g) {
    const base = workerUrl();
    if (!base) return;
    const url = `${base}/eoy/track`;
    const body = JSON.stringify({ e, s, g: g || "" });
    try {
      const blob = new Blob([body], { type: "text/plain;charset=UTF-8" });
      if (navigator.sendBeacon && navigator.sendBeacon(url, blob)) return;
    } catch (err) { /* fall through to fetch */ }
    try {
      fetch(url, {
        method: "POST", body, keepalive: true, mode: "cors", credentials: "omit",
        headers: { "content-type": "text/plain;charset=UTF-8" },
      }).catch(() => {});
    } catch (err) { /* noop */ }
  }

  function today() {
    try { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date()); }
    catch (err) { return new Date().toISOString().slice(0, 10); }
  }

  function reachOnce(e, s) {
    const key = `mo_eoy_${e}`;
    const mark = `${today()}|${s}`;
    try {
      if (window.localStorage.getItem(key) === mark) return;
      window.localStorage.setItem(key, mark);
    } catch (err) { /* count it */ }
    send(e, s);
  }

  function rememberSource(src) {
    if (SOURCES.indexOf(src) === -1) return;
    try { window.localStorage.setItem(SRC_KEY, JSON.stringify({ s: src, t: Date.now() })); } catch (err) { /* noop */ }
  }

  function recentSource() {
    try {
      const v = JSON.parse(window.localStorage.getItem(SRC_KEY) || "null");
      if (v && SOURCES.indexOf(v.s) !== -1 && Date.now() - Number(v.t) < DAY_MS) return v.s;
    } catch (err) { /* noop */ }
    return null;
  }

  window.MOEoy = { SOURCES, send, reachOnce, rememberSource, recentSource };

  // Clicks in the Support menu (desktop panel and its header link) and the
  // dashboard card. The phone drawer's copies carry ?eoy=menu in their
  // href, which is enough for the checkouts; they have no goal to count.
  document.addEventListener("click", (e) => {
    const a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    const holder = a.closest("[data-eoy-src]");
    let src = holder ? holder.getAttribute("data-eoy-src") : "";
    if (!src) {
      // Only an ?eoy= written into the link itself (the phone drawer's
      // copies), never one inherited from this page's own URL.
      const raw = a.getAttribute("href") || "";
      if (raw.indexOf("?") === -1) return;
      try { src = new URL(raw, window.location.href).searchParams.get("eoy") || ""; } catch (err) { src = ""; }
    }
    if (LINK_SOURCES.indexOf(src) === -1) return;
    rememberSource(src);
    const goal = a.getAttribute("data-hm-goal");
    if (goal) send("link_click", src, goal);
    if ((a.getAttribute("href") || "").indexOf("#/portal/offers/") === 0) {
      try {
        const q = new URLSearchParams(window.location.search);
        q.set("eoy", src);
        window.history.replaceState(window.history.state, "", `${window.location.pathname}?${q.toString()}${window.location.hash}`);
        window.sessionStorage.setItem("mo_checkout_pending", Date.now().toString());
      } catch (err) { /* the offer just goes uncredited */ }
    }
  }, true);
})();
