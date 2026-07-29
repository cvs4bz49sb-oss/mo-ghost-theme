/*
 * "New on Mere Orthodoxy" rail (/dashboard/).
 *
 * Four jobs, each independent — any one failing leaves the rest of
 * the rail intact:
 *
 *   1. Reveal the essay tiles published today. Both the rail's
 *      data-today and each tile's data-date are rendered server-side
 *      in the site timezone, so the comparison is timezone-correct.
 *      If data-today is missing or implausible (more than 36h from
 *      the reader's own date, which would mean the template picked up
 *      some other context's date), fall back to the local date rather
 *      than silently showing nothing.
 *   2. Upgrade the three podcast tiles with their latest episode
 *      title from the mo-podcast-feed worker. The tiles already carry
 *      artwork, a fallback title, and a working link, so a worker
 *      outage costs nothing but the episode name.
 *   3. Remember whether the section is collapsed.
 *   4. On phones the rail is a snap carousel: the tile nearest the
 *      centre keeps its colour, the rest desaturate. Desktop is a
 *      plain row and this does nothing.
 *
 * No remote URL is ever written into the DOM — the cover art is fixed
 * per show in the template and hrefs are built from literals.
 */
(function () {
  "use strict";

  const root = document.querySelector("[data-dash-new]");
  if (!root) return;
  const rail = root.querySelector("[data-dash-new-rail]");
  if (!rail) return;

  const STORE_KEY = "mo-dash-new-open";
  const DAY_MS = 24 * 60 * 60 * 1000;

  function items() {
    return Array.prototype.slice.call(rail.querySelectorAll(".dash-new-item"));
  }

  /* ── 1. Today's essays ───────────────────────────────────────── */

  function pad(n) { return n < 10 ? `0${n}` : String(n); }

  function localDate() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function resolveToday() {
    const local = localDate();
    const server = (rail.getAttribute("data-today") || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(server)) return local;
    // Site timezone and reader timezone can legitimately disagree by a
    // day. Anything further apart means the value isn't "now".
    const drift = Math.abs(Date.parse(`${server}T12:00:00Z`) - Date.parse(`${local}T12:00:00Z`));
    return drift <= 1.5 * DAY_MS ? server : local;
  }

  function revealTodaysPosts() {
    const today = resolveToday();
    rail.querySelectorAll("[data-dash-new-post]").forEach((li) => {
      if (li.getAttribute("data-date") === today) li.removeAttribute("hidden");
    });
  }

  /* ── 2. Latest episode titles ────────────────────────────────── */

  function fillEpisodeTitles() {
    const feedUrl = document.body.getAttribute("data-podcast-feed-url") || "";
    if (!feedUrl) return;
    const url = `${feedUrl}${feedUrl.indexOf("?") > -1 ? "&" : "?"}limit=1`;

    fetch(url, { mode: "cors", credentials: "omit", cache: "default" })
      .then((r) => { return r.ok ? r.json() : null; })
      .then((data) => {
        if (!data) return;
        rail.querySelectorAll("[data-dash-new-slot]").forEach((li) => {
          const slug = li.getAttribute("data-dash-new-slot");
          const payload = data[slug];
          if (!payload || payload.error || !Array.isArray(payload.episodes)) return;
          const ep = payload.episodes[0];
          if (!ep || !ep.title) return;

          const titleEl = li.querySelector("[data-dash-new-title]");
          if (titleEl) titleEl.textContent = ep.title;

          // Deep-link the podcast tiles to the episode's own card on
          // the show page. renderShowCard() there emits id="ep-<id>".
          // The Daily Liturgy tile keeps its reader link.
          const link = li.querySelector("[data-dash-new-link]");
          const id = ep.id == null ? "" : String(ep.id);
          if (link && /^[\w-]+$/.test(id)) link.hash = `ep-${id}`;
        });
        setActiveTile();
      })
      .catch(() => { /* fallback titles stay */ });
  }

  /* ── 3. Collapse state ───────────────────────────────────────── */

  function wireCollapse() {
    try {
      if (window.localStorage.getItem(STORE_KEY) === "0") root.removeAttribute("open");
    } catch (e) { /* private mode */ }

    root.addEventListener("toggle", () => {
      try {
        window.localStorage.setItem(STORE_KEY, root.open ? "1" : "0");
      } catch (e) { /* private mode */ }
      if (root.open) setActiveTile();
    });
  }

  /* ── 4. Mobile centre-highlight ──────────────────────────────── */

  const narrow = window.matchMedia("(max-width: 640px)");
  let ticking = false;

  function setActiveTile() {
    const visible = items().filter((li) => !li.hasAttribute("hidden"));
    if (!narrow.matches) {
      visible.forEach((li) => li.classList.remove("is-active"));
      return;
    }
    const box = rail.getBoundingClientRect();
    const centre = box.left + box.width / 2;
    let winner = null;
    let closest = Infinity;
    visible.forEach((li) => {
      const r = li.getBoundingClientRect();
      const d = Math.abs(r.left + r.width / 2 - centre);
      if (d < closest) { closest = d; winner = li; }
    });
    visible.forEach((li) => li.classList.toggle("is-active", li === winner));
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      ticking = false;
      setActiveTile();
    });
  }

  /* ── Boot ────────────────────────────────────────────────────── */

  revealTodaysPosts();
  wireCollapse();
  fillEpisodeTitles();
  setActiveTile();

  rail.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  // Safari < 14 only has the deprecated listener form.
  if (typeof narrow.addEventListener === "function") {
    narrow.addEventListener("change", setActiveTile);
  } else if (typeof narrow.addListener === "function") {
    narrow.addListener(setActiveTile);
  }
})();
