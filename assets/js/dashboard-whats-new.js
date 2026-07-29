/*
 * "New on Mere Orthodoxy" rail (/dashboard/).
 *
 * Five jobs, each independent — any one failing leaves the rest of
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
 *   3. Wire the save-for-later buttons on the essay tiles — same
 *      mo-kit endpoints as the article page's bookmark button, one
 *      shared ids_only lookup for the initial state.
 *   4. Remember whether the section is collapsed.
 *   5. On phones the rail is a snap carousel: the tile nearest the
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

  // Fail open: an unparseable date keeps the episode.
  function isReleased(ep) {
    if (!ep) return false;
    const t = Date.parse(ep.pubDate || "");
    return Number.isNaN(t) || t <= Date.now();
  }

  function fillEpisodeTitles() {
    const feedUrl = document.body.getAttribute("data-podcast-feed-url") || "";
    if (!feedUrl) return;
    // limit=3, not 1: a show can have a scheduled-but-unreleased episode
    // sorted ahead of the live one, and asking for a single episode would
    // return only that one, leaving nothing after the isReleased filter.
    const url = `${feedUrl}${feedUrl.indexOf("?") > -1 ? "&" : "?"}limit=3`;

    fetch(url, { mode: "cors", credentials: "omit", cache: "default" })
      .then((r) => { return r.ok ? r.json() : null; })
      .then((data) => {
        if (!data) return;
        rail.querySelectorAll("[data-dash-new-slot]").forEach((li) => {
          const slug = li.getAttribute("data-dash-new-slot");
          const payload = data[slug];
          if (!payload || payload.error || !Array.isArray(payload.episodes)) return;
          // Skip episodes Buzzsprout has scheduled but not released — the
          // only tell is a future pubDate, and they sort to the front.
          // mo-podcast-feed filters them at the source; this is the same
          // guard on the theme side, which deploys on every push.
          const ep = payload.episodes.filter(isReleased)[0];
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

  /* ── 3. Save for later ───────────────────────────────────────── */

  function wireBookmarks() {
    const buttons = Array.prototype.slice.call(
      rail.querySelectorAll("[data-dash-new-bookmark]"),
    );
    if (!buttons.length) return;

    const worker = (document.body.getAttribute("data-kit-worker-url") || "").replace(/\/$/, "");
    const email = document.body.getAttribute("data-member-email") || "";
    const status = document.body.getAttribute("data-member-status") || "";
    // The rail only renders inside the paid/comped dashboard body, but
    // don't assume it: an unsaveable button is worse than no button.
    if (!worker || !email || (status !== "paid" && status !== "comped")) {
      buttons.forEach((b) => b.remove());
      return;
    }

    const saved = Object.create(null);
    const busy = Object.create(null);

    function paint(btn, on) {
      const title = btn.getAttribute("data-title") || "";
      btn.classList.toggle("is-bookmarked", !!on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.setAttribute("aria-label", on ? `Remove bookmark${title ? ` from ${title}` : ""}` : `Bookmark${title ? ` ${title}` : ""}`);
    }

    // The aria-label ships as "Bookmark <title>"; keep the title so the
    // label can be rebuilt when the state flips.
    buttons.forEach((btn) => {
      const label = btn.getAttribute("aria-label") || "";
      btn.setAttribute("data-title", label.replace(/^Bookmark\s*/, ""));
    });

    window.MOAuth.fetch(`${worker}/bookmarks?ids_only=1`, {
      method: "GET", mode: "cors", credentials: "omit",
    })
      .then((r) => { return r.ok ? r.json() : null; })
      .then((data) => {
        const ids = (data && data.postIds) || [];
        ids.forEach((id) => { saved[id] = true; });
        buttons.forEach((btn) => {
          paint(btn, saved[btn.getAttribute("data-post-id")]);
        });
      })
      .catch(() => { /* buttons start unsaved */ });

    buttons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const id = btn.getAttribute("data-post-id");
        if (!id || busy[id]) return;
        busy[id] = true;
        const next = !saved[id];
        saved[id] = next;
        paint(btn, next);
        window.MOAuth.fetch(worker + (next ? "/bookmarks/add" : "/bookmarks/remove"), {
          method: "POST",
          mode: "cors",
          credentials: "omit",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ postId: id }),
        })
          .then((r) => { if (!r.ok) throw new Error(`worker ${r.status}`); })
          .catch(() => { saved[id] = !next; paint(btn, !next); })
          .then(() => { busy[id] = false; });
      });
    });
  }

  /* ── 4. Collapse state ───────────────────────────────────────── */

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

  /* ── 5. Mobile centre-highlight ──────────────────────────────── */

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
  wireBookmarks();
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
