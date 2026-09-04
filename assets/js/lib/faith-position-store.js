/*
 * The Faith Received — where you left off, in one place.
 *
 * A bookmark says WHICH work. This says WHERE IN IT. The two are kept
 * apart on purpose, because they do not live in the same place and
 * cannot be made to:
 *
 *   Bookmarks are in the mo-kit Worker's KV, per member, and follow
 *   the reader between devices. `GET /bookmarks?ids_only=1` hands back
 *   bare "tfr:<corpus>:<work>" strings — there is no field on a
 *   bookmark to carry a position, and adding one is a worker change.
 *
 *   A position is here, in localStorage, per browser. So the work
 *   follows the reader to their phone and the place in it does not.
 *   Every surface that offers to resume says so in as many words; see
 *   partials/faith-received/_bookmarks-panel.hbs. If bookmarks ever
 *   grow a position field, this file is what gets replaced, and both
 *   the reader and the Bookmarks workspace follow without either being
 *   rewritten.
 *
 * WHAT IS STORED. One localStorage key, `fr_positions`, holding an
 * object keyed `<corpus>|<work>` — the same key shape the Notebook
 * workspace groups by:
 *
 *   { "pld|2741": { p: 57, a: "section-12", t: 1756900000000 }, … }
 *
 *     p  printed page, or null. ONLY ever set where the reader could
 *        prove a section covers it (see below).
 *     a  the anchor: the block's data-src-id, or its DOM id, or the
 *        id of the section that holds it.
 *     t  when it was captured, which is also the eviction order.
 *
 * WHY THE PAGE IS OFTEN NULL. `?p=` is not a universal locator. It
 * works because openInitialSection() finds the section whose
 * [data-from, data-to) covers the page, and opens THAT. Early English
 * Books renders sections with no data-from at all, so a `?p=` there
 * resolves to nothing and the reader lands at the top of the work
 * having been promised otherwise. So the page is written only when the
 * capturing side has already found the section that covers it, which
 * makes a `?p=` that cannot resolve structurally impossible rather
 * than merely unlikely. Everything else addresses by fragment, which
 * is the convention already in hitUrl() (faith-browse-search.js) and
 * readerUrl() (faith-notebook-store.js).
 *
 * THE RESTORE URL. Built by appendTo(), which takes a reader URL that
 * someone else already owns — the catalogue's own `url`, or the one
 * pushRecent() builds — and adds the locator to it:
 *
 *   paginated    /the-faith-received/reader/?c=pld&w=2741&p=57
 *   unpaginated  /the-faith-received/reader/?c=pld&w=2741#r42942
 *   no position  the URL exactly as it arrived, never a dead link
 *
 * Both are already handled by openInitialSection(); no new parameter
 * was invented for this and none is needed.
 */
(function () {
  "use strict";

  const KEY = "fr_positions";
  // Positions are small (~60 bytes each) but this is a 68,724-work
  // library and the map is never pruned by anything else.
  const MAX = 120;

  const keyFor = (corpus, work) => `${String(corpus || "tfr")}|${String(work || "")}`;

  function load() {
    try {
      const raw = window.localStorage.getItem(KEY);
      const map = raw ? JSON.parse(raw) : {};
      return map && typeof map === "object" && !Array.isArray(map) ? map : {};
    } catch (_) {
      return {};
    }
  }

  function save(map) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(map));
      return true;
    } catch (_) {
      return false;
    }
  }

  // Oldest first out. A reader who has 120 works on the go is not the
  // case being designed for; a reader whose oldest position quietly
  // ages out is.
  function prune(map) {
    const keys = Object.keys(map);
    if (keys.length <= MAX) return map;
    keys
      .sort((a, b) => (map[b].t || 0) - (map[a].t || 0))
      .slice(MAX)
      .forEach((k) => { delete map[k]; });
    return map;
  }

  // Never returns a half-record: a stored value that has neither a
  // usable page nor a usable anchor is the same as no position at all,
  // and saying so here keeps every caller from re-checking.
  function get(corpus, work) {
    if (!work) return null;
    const hit = load()[keyFor(corpus, work)];
    if (!hit || typeof hit !== "object") return null;
    const page = typeof hit.p === "number" && isFinite(hit.p) && hit.p > 0 ? hit.p : null;
    const anchor = typeof hit.a === "string" ? hit.a : "";
    if (!page && !anchor) return null;
    return { page, anchor, at: typeof hit.t === "number" ? hit.t : 0 };
  }

  // `page` is the caller's promise that a section covering it exists.
  // Anything that is not a positive finite number is stored as null
  // rather than coerced, because a `?p=NaN` is a worse answer than no
  // page at all.
  function set(corpus, work, pos) {
    if (!work) return false;
    const page = pos && typeof pos.page === "number" && isFinite(pos.page) && pos.page > 0
      ? Math.floor(pos.page) : null;
    const anchor = pos && typeof pos.anchor === "string" ? pos.anchor.slice(0, 200) : "";
    if (!page && !anchor) return false;
    const map = load();
    map[keyFor(corpus, work)] = { p: page, a: anchor, t: Date.now() };
    return save(prune(map));
  }

  function clear(corpus, work) {
    const map = load();
    delete map[keyFor(corpus, work)];
    save(map);
  }

  /* ── The restore URL ─────────────────────────────────────────── */

  // Only reader links get a locator. A locator on anything else is at
  // best meaningless and at worst a `p=` landing in someone's search
  // query, so a URL that is not the reader is handed back untouched.
  const READER_PATH = "/the-faith-received/reader/";

  function isReaderUrl(url) {
    const s = String(url || "");
    // Absolute or relative; either way the path is what decides.
    try {
      const u = new URL(s, window.location.origin);
      return u.pathname === READER_PATH;
    } catch (_) {
      return s.indexOf(READER_PATH) === 0;
    }
  }

  // The locator is appended to a URL somebody else built, so the only
  // parts written here are a number and an encoded anchor. Neither can
  // introduce a scheme, a host, or a second fragment, which is why this
  // is safe to run AFTER MOSafeHref has passed the base URL: appending
  // "#r42942" to a sanitized link cannot unsanitize it.
  function appendTo(url, corpus, work) {
    const base = String(url || "");
    if (!base || !isReaderUrl(base)) return base;
    const pos = get(corpus, work);
    if (!pos) return base;
    // A URL that already carries a locator was built by someone with
    // more information than we have — a search hit, a citation link —
    // and is left alone.
    if (base.indexOf("#") >= 0 || /[?&]p=/.test(base)) return base;
    if (pos.page) {
      return `${base}${base.indexOf("?") >= 0 ? "&" : "?"}p=${encodeURIComponent(pos.page)}`;
    }
    return `${base}#${encodeURIComponent(pos.anchor)}`;
  }

  // True where appendTo() would actually add something — the question
  // a surface asks before it prints "picks up where you left off".
  function has(corpus, work) {
    return !!get(corpus, work);
  }

  window.MOFaithPosition = {
    KEY,
    MAX,
    keyFor,
    load,
    get,
    set,
    clear,
    has,
    appendTo,
    isReaderUrl,
  };
})();
