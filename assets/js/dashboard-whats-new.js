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
 *   3. Wire the save-for-later buttons. Essays save as a Ghost post
 *      id; the devotional and the two episodes save as typed items,
 *      since mo-kit has no way to resolve them later. One shared
 *      ids_only lookup covers both for the initial state.
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
          const identified = link && /^[\w-]+$/.test(id);
          if (identified) link.hash = `ep-${id}`;

          // The episode is only saveable once we know which episode it
          // is, so its button ships hidden and is revealed here. A show
          // whose feed didn't resolve keeps a tile with no save control
          // rather than one that saves the wrong thing.
          const btn = li.querySelector("[data-dash-new-bookmark]");
          if (btn && identified && /^[a-z0-9-]+$/.test(slug)) {
            btn.setAttribute("data-item-id", `podcast:${slug}:${id}`);
            btn.setAttribute("data-item-url", `/podcasts/${slug}/#ep-${id}`);
            btn.removeAttribute("hidden");
          }
        });
        paintBookmarks();
        setActiveTile();
      })
      .catch(() => { /* fallback titles stay */ });
  }

  /* ── 3. Save for later ───────────────────────────────────────── */
  //
  // Two shapes go to the same endpoints. An essay tile carries
  // data-post-id and saves as a Ghost post. The devotional and the two
  // episodes have no post id, so they save as typed items —
  // itemId + type + title + same-site url + cover — which mo-kit stores
  // with their display data and hands back to /dashboard/bookmarks/
  // in the same shape as an enriched post.

  const saved = Object.create(null);
  const busy = Object.create(null);
  let bookmarkButtons = [];

  function bookmarkKey(btn) {
    return btn.getAttribute("data-post-id") || btn.getAttribute("data-item-id") || "";
  }

  // Read the title off the tile rather than a data attribute: the
  // podcast titles are replaced when the feed lands, and the label
  // should follow.
  function tileTitle(btn) {
    const li = btn.closest(".dash-new-item");
    const el = li && li.querySelector(".dash-new-item-title");
    return el ? (el.textContent || "").trim() : "";
  }

  function paintBookmark(btn) {
    const on = !!saved[bookmarkKey(btn)];
    const title = tileTitle(btn);
    btn.classList.toggle("is-bookmarked", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.setAttribute(
      "aria-label",
      on
        ? `Remove bookmark${title ? ` from ${title}` : ""}`
        : `Save${title ? ` ${title}` : ""} for later`,
    );
  }

  function paintBookmarks() {
    bookmarkButtons.forEach(paintBookmark);
  }

  function bookmarkBody(btn) {
    const postId = btn.getAttribute("data-post-id");
    if (postId) return { postId };
    const itemId = btn.getAttribute("data-item-id");
    if (!itemId) return null;
    return {
      itemId,
      type: btn.getAttribute("data-item-type") || "",
      title: tileTitle(btn),
      url: btn.getAttribute("data-item-url") || "",
      image: btn.getAttribute("data-item-image") || "",
      label: btn.getAttribute("data-item-label") || "",
    };
  }

  function wireBookmarks() {
    bookmarkButtons = Array.prototype.slice.call(
      rail.querySelectorAll("[data-dash-new-bookmark]"),
    );
    if (!bookmarkButtons.length) return;

    const worker = (document.body.getAttribute("data-kit-worker-url") || "").replace(/\/$/, "");
    const email = document.body.getAttribute("data-member-email") || "";
    const status = document.body.getAttribute("data-member-status") || "";
    // The rail only renders inside the paid/comped dashboard body, but
    // don't assume it: an unsaveable button is worse than no button.
    if (!worker || !email || (status !== "paid" && status !== "comped")) {
      bookmarkButtons.forEach((b) => b.remove());
      bookmarkButtons = [];
      return;
    }

    // The devotional is identified by the day it belongs to, so it can be
    // saved before (or without) the podcast feed resolving. Same date the
    // essay tiles are filtered against, so it stays in the site's timezone.
    const devotional = rail.querySelector('[data-item-type="devotional"]');
    if (devotional) {
      devotional.setAttribute("data-item-id", `devotional:${resolveToday()}`);
      devotional.removeAttribute("hidden");
    }

    paintBookmarks();

    window.MOAuth.fetch(`${worker}/bookmarks?ids_only=1`, {
      method: "GET", mode: "cors", credentials: "omit",
    })
      .then((r) => { return r.ok ? r.json() : null; })
      .then((data) => {
        if (!data) return;
        (data.postIds || []).forEach((id) => { saved[id] = true; });
        (data.itemIds || []).forEach((id) => { saved[id] = true; });
        paintBookmarks();
      })
      .catch(() => { /* buttons start unsaved */ });

    bookmarkButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const key = bookmarkKey(btn);
        const body = bookmarkBody(btn);
        if (!key || !body || busy[key]) return;
        busy[key] = true;
        const next = !saved[key];
        saved[key] = next;
        paintBookmark(btn);
        window.MOAuth.fetch(worker + (next ? "/bookmarks/add" : "/bookmarks/remove"), {
          method: "POST",
          mode: "cors",
          credentials: "omit",
          headers: { "content-type": "application/json" },
          // Removal only needs the identifier; sending the whole item
          // would let a stale tile overwrite nothing, but it is noise.
          body: JSON.stringify(next ? body : (body.postId ? { postId: body.postId } : { itemId: body.itemId })),
        })
          .then((r) => {
            if (r.ok) return;
            // A 400 on a typed item means this mo-kit doesn't understand
            // them yet (the theme deploys on push; the worker doesn't).
            // Drop the control rather than leave one that can't save.
            if (r.status === 400 && !body.postId) btn.remove();
            throw new Error(`worker ${r.status}`);
          })
          .catch(() => { saved[key] = !next; paintBookmark(btn); })
          .then(() => { busy[key] = false; });
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
