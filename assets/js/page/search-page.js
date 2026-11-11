/*
 * /search/ page (custom-search.hbs). Loaded only there, deferred, after
 * site.min.js has published window.MOSearch (assets/js/search.js).
 *
 * Two states, both kept in the URL (q, type, author, topic, from, to,
 * sort, page) so any view can be linked and Back works:
 *
 *   Navigator  no query, no filter: recent searches, topics, latest
 *              essays, podcasts, contributors, essays per year and the
 *              site's sections. From GET /api/search?view=nav.
 *   Results    a query or a filter: a filter sidebar with counts (type,
 *              sort, year, author, topic) beside essays and podcast
 *              episodes. From GET /api/search?...&facets=1. On phones
 *              the sidebar is a sheet behind a Filters button.
 *
 * Everything from the worker is set with textContent, links go through
 * MOSafeHref, and images must be https URLs.
 */
(function () {
  const S = window.MOSearch;
  const root = document.getElementById("mo-search-page");
  if (!S || !root) return;
  const { el, setHref, appendSnippet, formatDate, plural, fetchSearch } = S;

  const PAGE_SIZE = 20;
  const qInput = root.querySelector("#sp-q");
  const form = root.querySelector(".sp-form");
  const statsEl = root.querySelector("[data-sp-stats]");
  const navEl = root.querySelector("[data-sp-nav]");
  const resultsEl = root.querySelector("[data-sp-results]");
  const facetsEl = root.querySelector("[data-sp-facets]");
  const statusEl = root.querySelector("[data-sp-status]");
  const activeEl = root.querySelector("[data-sp-active]");
  const listEl = root.querySelector("[data-sp-list]");
  const pagerEl = root.querySelector("[data-sp-pager]");
  const sidebar = root.querySelector("[data-sp-sidebar]");
  const toggleBtn = root.querySelector("[data-sp-filter-toggle]");
  const backdrop = root.querySelector(".sp-sheet-backdrop");

  // Names for slugs, learned from every response, for chips and labels.
  const names = { author: new Map(), topic: new Map() };
  let nav = null;
  let abort = null;
  let typingTimer = null;
  let lastFacets = null;
  let sheetAction = false;
  const expanded = { author: false, topic: false };

  // ---- Small builders -----------------------------------------------------

  function sized(url, w) {
    const u = String(url || "");
    if (!/^https:\/\//i.test(u)) return "";
    if (/\/content\/images\//.test(u) && !/\/size\/w\d+/.test(u) && !/\.(svg|gif)(\?|$)/i.test(u)) {
      return u.replace("/content/images/", `/content/images/size/w${w}/`);
    }
    if (/^https:\/\/images\.unsplash\.com\//i.test(u)) {
      try {
        const x = new URL(u);
        x.searchParams.set("w", String(w));
        x.searchParams.set("q", "70");
        return x.toString();
      } catch (_) { return u; }
    }
    return u;
  }

  function img(url, w, cls, width, height) {
    const src = sized(url, w);
    if (!src) return null;
    const i = el("img", cls || null);
    i.src = src;
    i.alt = "";
    i.loading = "lazy";
    i.decoding = "async";
    if (width) i.width = width;
    if (height) i.height = height;
    // A dead image link leaves the slot empty, and essay rows close up.
    i.addEventListener("error", () => {
      const slot = i.parentNode;
      i.remove();
      if (slot && slot.classList.contains("sp-essay-image")) slot.classList.add("sp-essay-image-empty");
    });
    return i;
  }

  function initials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    return ((parts[0] || "")[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "");
  }

  function avatar(name, image, size) {
    const wrap = el("span", "sp-avatar");
    wrap.style.width = `${size}px`;
    wrap.style.height = `${size}px`;
    wrap.style.fontSize = `${Math.max(10, Math.round(size * 0.36))}px`;
    const i = image ? img(image, 200, null, size, size) : null;
    if (i) wrap.appendChild(i);
    else {
      wrap.classList.add("sp-avatar-initials");
      wrap.appendChild(el("span", null, initials(name)));
    }
    return wrap;
  }

  function link(cls, url, text) {
    const a = el("a", cls, text);
    setHref(a, url);
    return a;
  }

  function button(cls, text, onClick) {
    const b = el("button", cls, text);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
  }

  function sectionHead(title, actionText, action) {
    const head = el("div", "sp-section-head");
    head.appendChild(el("h2", "sp-section-title", title));
    if (actionText && action) {
      if (typeof action === "string") head.appendChild(link("sp-section-link", action, actionText));
      else head.appendChild(button("sp-section-link", actionText, action));
    }
    return head;
  }

  function micIcon() {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("width", "14");
    svg.setAttribute("height", "14");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("aria-hidden", "true");
    const p1 = document.createElementNS(ns, "rect");
    p1.setAttribute("x", "9"); p1.setAttribute("y", "3"); p1.setAttribute("width", "6"); p1.setAttribute("height", "11"); p1.setAttribute("rx", "3");
    const p2 = document.createElementNS(ns, "path");
    p2.setAttribute("d", "M5 11a7 7 0 0 0 14 0M12 18v3");
    svg.appendChild(p1);
    svg.appendChild(p2);
    return svg;
  }

  // ---- Cards --------------------------------------------------------------

  /** Essay row: kicker, title, byline, snippet, image on the right. */
  function essayCard(e) {
    const a = el("a", "sp-essay");
    setHref(a, e.url);
    const body = el("span", "sp-essay-body");
    const kicker = el("span", "sp-kicker");
    kicker.appendChild(el("span", "sp-type sp-type-essay", "Essay"));
    if (e.topics && e.topics.length) kicker.appendChild(el("span", "sp-kicker-topics", e.topics.join(", ")));
    body.appendChild(kicker);
    body.appendChild(el("span", "sp-essay-title", e.title || "Untitled"));
    const meta = [e.authors, formatDate(e.published_at)].filter(Boolean).join(" · ");
    if (meta) body.appendChild(el("span", "sp-meta", meta));
    if (e.snippet) {
      const p = el("span", "sp-snippet");
      appendSnippet(p, e.snippet);
      body.appendChild(p);
    }
    a.appendChild(body);
    const pic = el("span", "sp-essay-image");
    const i = img(e.feature_image, 600, null, 300, 200);
    if (i) pic.appendChild(i);
    else pic.classList.add("sp-essay-image-empty");
    a.appendChild(pic);
    return a;
  }

  /** Essay tile for the navigator: image on top. */
  function essayTile(e) {
    const a = el("a", "sp-tile-essay");
    setHref(a, e.url);
    const pic = el("span", "sp-tile-essay-image");
    const i = img(e.feature_image, 600, null, 400, 250);
    if (i) pic.appendChild(i);
    a.appendChild(pic);
    if (e.topics && e.topics.length) a.appendChild(el("span", "sp-kicker-topics", e.topics[0]));
    a.appendChild(el("span", "sp-tile-essay-title", e.title));
    a.appendChild(el("span", "sp-meta", [e.authors, formatDate(e.published_at)].filter(Boolean).join(" · ")));
    return a;
  }

  /** Podcast episode card: square cover art, a Podcast label. */
  function episodeCard(p) {
    const a = el("a", "sp-episode");
    setHref(a, p.url);
    const cover = el("span", "sp-cover");
    const i = img(p.image, 300, null, 120, 120);
    if (i) cover.appendChild(i);
    else cover.appendChild(el("span", "sp-cover-fallback", initials(p.show || p.title)));
    a.appendChild(cover);
    const body = el("span", "sp-episode-body");
    const kicker = el("span", "sp-kicker");
    const t = el("span", "sp-type sp-type-podcast");
    t.appendChild(micIcon());
    t.appendChild(document.createTextNode(p.kind === "show" ? "Podcast" : "Episode"));
    kicker.appendChild(t);
    if (p.kind !== "show" && p.show) kicker.appendChild(el("span", "sp-kicker-topics", p.show));
    body.appendChild(kicker);
    body.appendChild(el("span", "sp-episode-title", p.title));
    if (p.published_at) body.appendChild(el("span", "sp-meta", formatDate(p.published_at)));
    // Daily Liturgy notes repeat one credit line; the date says enough.
    if (p.description && p.show_slug !== "daily-liturgy") body.appendChild(el("span", "sp-snippet", p.description));
    a.appendChild(body);
    return a;
  }

  /** Show card for the navigator: large cover, description, episode count. */
  function showCard(s) {
    const a = el("a", "sp-show");
    setHref(a, s.url);
    const cover = el("span", "sp-show-cover");
    const i = img(s.image, 600, null, 300, 300);
    if (i) cover.appendChild(i);
    else cover.appendChild(el("span", "sp-cover-fallback", initials(s.title)));
    a.appendChild(cover);
    a.appendChild(el("span", "sp-show-title", s.title));
    if (s.description) a.appendChild(el("span", "sp-show-desc", s.description));
    const meta = [s.episodes ? plural(s.episodes, "episode", "episodes") : "", s.latest ? `Latest ${formatDate(s.latest)}` : ""].filter(Boolean).join(" · ");
    if (meta) a.appendChild(el("span", "sp-meta", meta));
    return a;
  }

  /** Topic tile: image under a dark wash, name and count. Filters in place. */
  function topicTile(t) {
    const b = el("button", "sp-topic");
    b.type = "button";
    const i = img(t.image, 600, "sp-topic-image", 300, 200);
    if (i) b.appendChild(i);
    const label = el("span", "sp-topic-label");
    label.appendChild(el("span", "sp-topic-name", t.name));
    label.appendChild(el("span", "sp-topic-count", plural(t.post_count, "essay", "essays")));
    b.appendChild(label);
    b.setAttribute("aria-label", `${t.name}, ${plural(t.post_count, "essay", "essays")}`);
    b.addEventListener("click", () => go({ q: "", type: "all", author: "", topic: t.slug, from: "", to: "", sort: "newest", page: 1 }));
    names.topic.set(t.slug, t.name);
    return b;
  }

  /** Contributor: portrait medallion, name, count. Filters in place. */
  function personCard(p) {
    const b = el("button", "sp-person");
    b.type = "button";
    b.appendChild(avatar(p.name, p.image, 72));
    b.appendChild(el("span", "sp-person-name", p.name));
    b.appendChild(el("span", "sp-meta", plural(p.post_count, "essay", "essays")));
    b.addEventListener("click", () => go({ q: "", type: "all", author: p.slug, topic: "", from: "", to: "", sort: "newest", page: 1 }));
    names.author.set(p.slug, p.name);
    return b;
  }

  /** Author match at the top of results: portrait, bio, a filter button. */
  function authorMatch(p, q) {
    const card = el("div", "sp-match sp-match-author");
    card.appendChild(avatar(p.name, p.image, 64));
    const body = el("div", "sp-match-body");
    body.appendChild(el("span", "sp-type sp-type-person", "Contributor"));
    body.appendChild(link("sp-match-title", p.url, p.name));
    if (p.description) body.appendChild(el("p", "sp-match-desc", p.description));
    const actions = el("div", "sp-match-actions");
    actions.appendChild(button("btn sp-btn-small", `Their ${plural(p.post_count, "essay", "essays")}`, () => {
      names.author.set(p.slug, p.name);
      go({ ...state, q: residualQuery(q, p.name), author: p.slug, page: 1, sort: residualQuery(q, p.name) ? state.sort : "newest" });
    }));
    actions.appendChild(link("sp-match-link", p.url, "Profile"));
    body.appendChild(actions);
    card.appendChild(body);
    return card;
  }

  // "matt anderson augustine" with Matthew Lee Anderson -> "augustine".
  function residualQuery(q, name) {
    const nameToks = String(name || "").toLowerCase().split(/\s+/);
    return String(q || "").split(/\s+/)
      .filter((t) => t && !nameToks.some((n) => n.startsWith(t.toLowerCase().replace(/[^a-z]/g, ""))))
      .join(" ");
  }

  function topicMatch(t) {
    const card = el("div", "sp-match sp-match-topic");
    const pic = el("span", "sp-match-image");
    const i = img(t.image, 300, null, 96, 64);
    if (i) pic.appendChild(i);
    card.appendChild(pic);
    const body = el("div", "sp-match-body");
    body.appendChild(el("span", "sp-type sp-type-topic", "Topic"));
    body.appendChild(link("sp-match-title", t.url, t.name));
    const actions = el("div", "sp-match-actions");
    actions.appendChild(button("btn sp-btn-small", `Browse ${plural(t.post_count, "essay", "essays")}`, () => {
      names.topic.set(t.slug, t.name);
      go({ ...state, q: "", topic: t.slug, page: 1, sort: "newest" });
    }));
    body.appendChild(actions);
    card.appendChild(body);
    return card;
  }

  function sectionMatch(x) {
    const a = el("a", "sp-match sp-match-section");
    setHref(a, x.url);
    const body = el("span", "sp-match-body");
    body.appendChild(el("span", "sp-type sp-type-page", "Page"));
    body.appendChild(el("span", "sp-match-title", x.title));
    body.appendChild(el("span", "sp-match-desc", x.desc));
    a.appendChild(body);
    return a;
  }

  // ---- State and URL --------------------------------------------------------

  const DEFAULT = { q: "", type: "all", author: "", topic: "", from: "", to: "", sort: "relevance", page: 1 };
  let state = { ...DEFAULT };

  function readUrl() {
    const sp = new URLSearchParams(window.location.search);
    const year = (v) => (/^\d{4}$/.test(v || "") ? v : "");
    const slug = (v) => (/^[a-z0-9][a-z0-9-]{0,99}$/.test(v || "") ? v : "");
    const type = ["all", "essays", "podcasts", "topics", "authors"].includes(sp.get("type")) ? sp.get("type") : "all";
    let from = year(sp.get("from"));
    let to = year(sp.get("to"));
    if (from && to && from > to) [from, to] = [to, from];
    return {
      q: (sp.get("q") || "").trim().slice(0, 200),
      type,
      author: slug(sp.get("author")),
      topic: slug(sp.get("topic")),
      from,
      to,
      sort: ["relevance", "newest", "oldest"].includes(sp.get("sort")) ? sp.get("sort") : "relevance",
      page: Math.max(1, Math.min(50, parseInt(sp.get("page"), 10) || 1)),
    };
  }

  function urlFor(s) {
    const sp = new URLSearchParams();
    if (s.q) sp.set("q", s.q);
    if (s.type !== "all") sp.set("type", s.type);
    ["author", "topic", "from", "to"].forEach((k) => { if (s[k]) sp.set(k, s[k]); });
    if (s.sort !== "relevance") sp.set("sort", s.sort);
    if (s.page > 1) sp.set("page", String(s.page));
    const qs = sp.toString();
    return `${window.location.pathname}${qs ? `?${qs}` : ""}`;
  }

  function hasFilters(s) { return !!(s.author || s.topic || s.from || s.to); }
  function isNavigator(s) { return !s.q && !hasFilters(s) && s.type === "all"; }

  /** Move to a new state: URL, then render. `replace` while typing. */
  function go(next, replace) {
    clearTimeout(typingTimer);
    let s = { ...state, ...next };
    if (s.from && s.to && s.from > s.to) s = { ...s, from: s.to, to: s.from };
    // Sorting by relevance needs words to be relevant to.
    if (!s.q && s.sort === "relevance") s.sort = "newest";
    state = s;
    const url = urlFor(s);
    if (replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
    // A pick inside the phone sheet keeps it open for the next pick;
    // "Show results" closes it.
    if (!sheetAction) closeSheet();
    sheetAction = false;
    load(s);
  }

  // ---- Loading ------------------------------------------------------------

  function load(s) {
    // Typing passes a trimmed query; keep the reader's trailing space.
    if (qInput.value.trim() !== s.q) qInput.value = s.q;
    document.title = s.q ? `${s.q} | Search | Mere Orthodoxy` : "Search | Mere Orthodoxy";
    if (abort) { try { abort.abort(); } catch (_) { /* done */ } }
    abort = new AbortController();
    if (!S.workerUrl) { showResults(); statusEl.textContent = "Search is unavailable right now."; return; }
    if (isNavigator(s)) { loadNavigator(); return; }
    showResults();
    resultsEl.setAttribute("aria-busy", "true");
    statusEl.textContent = "Searching";
    const apiType = s.type === "all" ? "all" : s.type;
    fetchSearch({
      q: s.q,
      type: apiType,
      author: s.author,
      topic: s.topic,
      from: s.from ? `${s.from}-01-01` : "",
      to: s.to ? `${s.to}-12-31` : "",
      sort: s.q ? s.sort : (s.sort === "oldest" ? "oldest" : "newest"),
      page: s.page,
      page_size: s.type === "topics" || s.type === "authors" ? 48 : PAGE_SIZE,
      facets: s.type === "topics" || s.type === "authors" ? "" : "1",
    }, abort.signal).then((data) => {
      if (s !== state) return;
      resultsEl.removeAttribute("aria-busy");
      if (s.q) S.saveRecent(s.q);
      render(s, data);
    }).catch((err) => {
      if (err && err.name === "AbortError") return;
      resultsEl.removeAttribute("aria-busy");
      listEl.textContent = "";
      pagerEl.textContent = "";
      statusEl.textContent = "Search is unavailable right now. Try again in a moment.";
    });
  }

  function showResults() {
    navEl.hidden = true;
    resultsEl.hidden = false;
  }

  function loadNavigator() {
    resultsEl.hidden = true;
    navEl.hidden = false;
    if (nav) { renderNavigator(nav); return; }
    navEl.setAttribute("aria-busy", "true");
    navEl.textContent = "";
    navEl.appendChild(el("p", "sp-status", "Loading"));
    fetchSearch({ view: "nav" }, abort.signal).then((data) => {
      navEl.removeAttribute("aria-busy");
      nav = data;
      renderStats(data);
      if (isNavigator(state)) renderNavigator(data);
    }).catch((err) => {
      if (err && err.name === "AbortError") return;
      navEl.removeAttribute("aria-busy");
      navEl.textContent = "";
      navEl.appendChild(el("p", "sp-status", "Search is unavailable right now. Try again in a moment."));
    });
  }

  function renderStats(data) {
    const t = data && data.totals;
    if (!t || !statsEl) return;
    const first = data.years && data.years.length ? data.years[data.years.length - 1].year : "";
    statsEl.textContent = `${plural(t.essays, "essay", "essays")}, ${plural(t.podcasts, "podcast episode", "podcast episodes")}, ${plural(t.authors, "contributor", "contributors")} and ${plural(t.topics, "topic", "topics")}${first ? ` since ${first}` : ""}.`;
  }

  // ---- Navigator ------------------------------------------------------------

  function renderNavigator(data) {
    navEl.textContent = "";

    const recent = S.readRecent();
    if (recent.length) {
      const sec = el("section", "sp-section sp-recent");
      const head = sectionHead("Recent searches");
      const clear = button("sp-section-link", "Clear", () => {
        S.clearRecent();
        sec.remove();
        qInput.focus();
      });
      clear.setAttribute("aria-label", "Clear recent searches");
      head.appendChild(clear);
      sec.appendChild(head);
      const row = el("div", "sp-recent-row");
      recent.forEach((r) => row.appendChild(button("btn sp-btn-small", r, () => go({ ...DEFAULT, q: r }))));
      sec.appendChild(row);
      navEl.appendChild(sec);
    }

    if (data.topics && data.topics.length) {
      const sec = el("section", "sp-section");
      sec.appendChild(sectionHead("Browse by topic", `All ${plural(data.totals.topics, "topic", "topics")}`, () => go({ ...DEFAULT, type: "topics", sort: "newest" })));
      const grid = el("div", "sp-topic-grid");
      data.topics.slice(0, 12).forEach((t) => grid.appendChild(topicTile(t)));
      sec.appendChild(grid);
      navEl.appendChild(sec);
    }

    if (data.latest && data.latest.length) {
      const sec = el("section", "sp-section");
      sec.appendChild(sectionHead("Latest essays", "The archive", "/archive/"));
      const grid = el("div", "sp-essay-grid");
      data.latest.slice(0, 8).forEach((e) => grid.appendChild(essayTile(e)));
      sec.appendChild(grid);
      navEl.appendChild(sec);
    }

    if (data.shows && data.shows.length) {
      const sec = el("section", "sp-section sp-podcasts");
      sec.appendChild(sectionHead("Podcasts", `All ${plural(data.totals.podcasts, "episode", "episodes")}`, () => go({ ...DEFAULT, type: "podcasts", sort: "newest" })));
      const shows = el("div", "sp-show-grid");
      data.shows.forEach((s) => shows.appendChild(showCard(s)));
      sec.appendChild(shows);
      if (data.episodes && data.episodes.length) {
        sec.appendChild(el("h3", "sp-subhead", "Latest episodes"));
        const eps = el("div", "sp-episode-grid");
        data.episodes.slice(0, 6).forEach((p) => eps.appendChild(episodeCard(p)));
        sec.appendChild(eps);
      }
      navEl.appendChild(sec);
    }

    if (data.authors && data.authors.length) {
      const sec = el("section", "sp-section");
      sec.appendChild(sectionHead("Contributors", `All ${plural(data.totals.authors, "contributor", "contributors")}`, () => go({ ...DEFAULT, type: "authors", sort: "newest" })));
      const grid = el("div", "sp-person-grid");
      data.authors.filter((p) => !/^guest/i.test(p.name)).slice(0, 12).forEach((p) => grid.appendChild(personCard(p)));
      sec.appendChild(grid);
      navEl.appendChild(sec);
    }

    if (data.years && data.years.length) {
      const sec = el("section", "sp-section");
      sec.appendChild(sectionHead("Essays by year"));
      sec.appendChild(el("p", "sp-section-note", "Choose a year to read what we published then."));
      sec.appendChild(yearChart(data.years, "", "", (y) => go({ ...DEFAULT, from: y, to: y, sort: "newest" }), "sp-years-wide"));
      navEl.appendChild(sec);
    }

    const sec = el("section", "sp-section");
    sec.appendChild(sectionHead("Around the site"));
    const grid = el("div", "sp-site-grid");
    S.sections.slice(0, 16).forEach((x) => {
      const a = el("a", "sp-site");
      setHref(a, x.url);
      a.appendChild(el("span", "sp-site-title", x.title));
      a.appendChild(el("span", "sp-site-desc", x.desc));
      grid.appendChild(a);
    });
    sec.appendChild(grid);
    navEl.appendChild(sec);
  }

  /** Bars per year, oldest left. Each bar is a button that picks the year. */
  function yearChart(years, from, to, onPick, extra) {
    const wrap = el("div", `sp-years ${extra || ""}`);
    const sorted = years.slice().sort((a, b) => a.year.localeCompare(b.year));
    const max = Math.max(1, ...sorted.map((y) => y.count));
    sorted.forEach((y, i) => {
      const b = el("button", "sp-year");
      b.type = "button";
      const inRange = (from || to) && (!from || y.year >= from) && (!to || y.year <= to);
      if (inRange) b.classList.add("is-on");
      b.setAttribute("aria-pressed", inRange ? "true" : "false");
      b.dataset.key = `year:${y.year}`;
      b.setAttribute("aria-label", `${y.year}: ${plural(y.count, "essay", "essays")}`);
      b.title = `${y.year}: ${plural(y.count, "essay", "essays")}`;
      const bar = el("span", "sp-year-bar");
      bar.style.height = `${Math.max(4, Math.round((y.count / max) * 100))}%`;
      b.appendChild(bar);
      // Ends always; in between every 5 years (10 in the narrow sidebar),
      // kept two bars clear of the ends so labels never collide.
      const last = sorted.length - 1;
      const step = extra ? 5 : 10;
      const showLabel = i === 0 || i === last || (Number(y.year) % step === 0 && i >= 2 && i <= last - 2);
      const label = el("span", "sp-year-label", showLabel ? y.year : "");
      label.setAttribute("aria-hidden", "true");
      b.appendChild(label);
      b.addEventListener("click", () => onPick(y.year));
      wrap.appendChild(b);
    });
    return wrap;
  }

  // ---- Results --------------------------------------------------------------

  function render(s, data) {
    const g = data.groups || {};
    const f = data.facets || null;
    if (f) lastFacets = f;
    (f && f.authors || []).forEach((a) => names.author.set(a.slug, a.name));
    (f && f.topics || []).forEach((t) => names.topic.set(t.slug, t.name));
    renderFacets(s, f || lastFacets);
    renderActive(s);
    listEl.textContent = "";
    pagerEl.textContent = "";

    if (s.type === "topics" || s.type === "authors") { renderDirectory(s, g); return; }

    const essays = g.essays || { items: [], count: 0 };
    const pods = g.podcasts || { items: [], count: 0 };
    const authors = (g.authors && g.authors.items) || [];
    const topics = (g.topics && g.topics.items) || [];
    const sections = s.q && s.page === 1 && s.type === "all" && !hasFilters(s) ? S.matchSections(s.q, 2) : [];
    const shown = s.type === "podcasts" ? pods.count : essays.count;

    // Status line.
    const counts = [];
    if (s.type !== "podcasts" && essays.count) counts.push(plural(essays.count, "essay", "essays"));
    if (s.type !== "essays" && pods.count) counts.push(plural(pods.count, "podcast episode", "podcast episodes"));
    const what = data.corrected ? `Showing results for ${data.query}` : (s.q ? `for “${s.q}”` : "");
    if (!counts.length && !authors.length && !topics.length && !sections.length) {
      statusEl.textContent = s.q ? `Nothing matches “${s.q}”${hasFilters(s) ? " with these filters" : ""}.` : "Nothing matches these filters.";
      renderEmpty(s);
      return;
    }
    statusEl.textContent = data.corrected
      ? `${what}: ${counts.join(" and ") || "no essays"}.`
      : `${counts.join(" and ") || "No essays or episodes"}${what ? ` ${what}` : ""}.`;

    // Best matches: people, topics, pages, a named show.
    if (s.page === 1 && s.type === "all" && (authors.length || topics.length || sections.length)) {
      const sec = el("section", "sp-section sp-matches");
      sec.appendChild(sectionHead("Best matches"));
      const grid = el("div", "sp-match-grid");
      authors.slice(0, 2).forEach((p) => grid.appendChild(authorMatch(p, data.query || s.q)));
      topics.slice(0, 2).forEach((t) => grid.appendChild(topicMatch(t)));
      sections.forEach((x) => grid.appendChild(sectionMatch(x)));
      sec.appendChild(grid);
      listEl.appendChild(sec);
    }

    if (s.type !== "podcasts" && essays.items && essays.items.length) {
      const sec = el("section", "sp-section");
      sec.appendChild(sectionHead(s.type === "essays" ? "Essays" : `Essays (${essays.count.toLocaleString("en-US")})`));
      const list = el("ol", "sp-essay-list");
      list.setAttribute("start", String((s.page - 1) * PAGE_SIZE + 1));
      essays.items.forEach((e) => {
        const li = el("li");
        li.appendChild(essayCard(e));
        list.appendChild(li);
      });
      sec.appendChild(list);
      listEl.appendChild(sec);
    }

    const podItems = (pods.items || []);
    if (s.type !== "essays" && podItems.length && (s.type === "podcasts" || s.page === 1)) {
      const sec = el("section", "sp-section sp-podcasts");
      const more = s.type === "all" && pods.count > podItems.length
        ? [`All ${plural(pods.count, "episode", "episodes")}`, () => go({ ...state, type: "podcasts", page: 1 })]
        : [null, null];
      sec.appendChild(sectionHead(s.type === "podcasts" ? "Podcast episodes" : `Podcasts (${pods.count.toLocaleString("en-US")})`, more[0], more[1]));
      const grid = el("div", "sp-episode-grid");
      podItems.forEach((p) => grid.appendChild(episodeCard(p)));
      sec.appendChild(grid);
      listEl.appendChild(sec);
    }

    renderPager(s, shown);
    if (s.page > 1) root.querySelector(".sp-main").scrollIntoView({ block: "start" });
  }

  function renderEmpty(s) {
    const box = el("div", "sp-empty");
    box.appendChild(el("p", "sp-empty-lead", hasFilters(s)
      ? "Remove a filter or try fewer words."
      : "Check the spelling, try fewer words, or browse instead."));
    const row = el("div", "sp-recent-row");
    if (hasFilters(s)) row.appendChild(button("btn sp-btn-small", "Clear filters", () => go({ ...state, author: "", topic: "", from: "", to: "", page: 1 })));
    row.appendChild(button("btn sp-btn-small", "Browse topics", () => go({ ...DEFAULT })));
    row.appendChild(link("btn sp-btn-small", "/archive/", "The archive"));
    box.appendChild(row);
    listEl.appendChild(box);
  }

  /** "All topics" and "All contributors": tiles and portraits, 48 a page. */
  function renderDirectory(s, g) {
    const isTopics = s.type === "topics";
    const grp = (isTopics ? g.topics : g.authors) || { items: [], count: 0 };
    const items = (grp && grp.items) || [];
    statusEl.textContent = isTopics
      ? `${plural(grp.count || 0, "topic", "topics")}. Most written about first.`
      : `${plural(grp.count || 0, "contributor", "contributors")}. Most published first.`;
    const grid = el("div", isTopics ? "sp-topic-grid" : "sp-person-grid");
    items.forEach((x) => grid.appendChild(isTopics ? topicTile(x) : personCard(x)));
    listEl.appendChild(grid);
    renderPager(s, grp.count || 0, 48);
    facetsEl.textContent = "";
    facetsEl.appendChild(typeGroup(s, null));
  }

  function renderPager(s, count, size) {
    const per = size || PAGE_SIZE;
    const pages = Math.min(50, Math.ceil(count / per));
    if (pages <= 1) return;
    if (s.page > 1) pagerEl.appendChild(button("btn", "Previous", () => go({ ...state, page: s.page - 1 })));
    pagerEl.appendChild(el("span", "sp-pageno", `Page ${s.page} of ${pages}`));
    if (s.page < pages) pagerEl.appendChild(button("btn", "Next", () => go({ ...state, page: s.page + 1 })));
  }

  // ---- Active filters --------------------------------------------------------

  function renderActive(s) {
    activeEl.textContent = "";
    const chips = [];
    if (s.author) chips.push([`Author: ${names.author.get(s.author) || s.author.replace(/^author-/, "").replace(/-/g, " ")}`, { author: "" }]);
    if (s.topic) chips.push([`Topic: ${names.topic.get(s.topic) || s.topic.replace(/-/g, " ")}`, { topic: "" }]);
    if (s.from || s.to) {
      const label = s.from && s.to ? (s.from === s.to ? s.from : `${s.from} to ${s.to}`) : (s.from ? `${s.from} and later` : `Up to ${s.to}`);
      chips.push([`Years: ${label}`, { from: "", to: "" }]);
    }
    activeEl.hidden = !chips.length;
    if (!chips.length) { updateToggle(0); return; }
    chips.forEach(([label, clear]) => {
      const b = button("sp-chip", "", () => go({ ...state, ...clear, page: 1 }));
      b.appendChild(el("span", null, label));
      b.appendChild(el("span", "sp-chip-x", "×"));
      b.setAttribute("aria-label", `Remove ${label}`);
      activeEl.appendChild(b);
    });
    if (chips.length > 1) activeEl.appendChild(button("sp-chip-clear", "Clear all", () => go({ ...state, author: "", topic: "", from: "", to: "", page: 1 })));
    updateToggle(chips.length);
  }

  function updateToggle(n) {
    toggleBtn.textContent = n ? `Filters (${n})` : "Filters";
  }

  // ---- Sidebar facets -------------------------------------------------------

  function facetGroup(title) {
    const g = el("div", "sp-facet");
    g.appendChild(el("h3", "sp-facet-title", title));
    return g;
  }

  function typeGroup(s, f) {
    const g = facetGroup("Show");
    const row = el("div", "sp-seg");
    const types = f && f.types ? f.types : null;
    const opts = [
      ["all", "Everything", types ? types.essays + types.podcasts : null],
      ["essays", "Essays", types ? types.essays : null],
      ["podcasts", "Podcasts", types ? types.podcasts : null],
    ];
    opts.forEach(([key, label, n]) => {
      const b = button("sp-seg-btn", "", () => go({ ...state, type: key, page: 1 }));
      b.dataset.key = `type:${key}`;
      b.appendChild(el("span", null, label));
      if (n != null) b.appendChild(el("span", "sp-count", n.toLocaleString("en-US")));
      const on = s.type === key;
      b.setAttribute("aria-pressed", on ? "true" : "false");
      if (key === "podcasts" && (s.author || s.topic)) {
        b.disabled = true;
        b.title = "Podcast episodes are not tagged by author or topic.";
      }
      row.appendChild(b);
    });
    if (s.type === "topics" || s.type === "authors") {
      const back = button("sp-seg-btn", "", () => go({ ...DEFAULT }));
      back.appendChild(el("span", null, "Back to browsing"));
      row.appendChild(back);
    }
    g.appendChild(row);
    if (s.author || s.topic) g.appendChild(el("p", "sp-facet-note", "Podcasts can’t be filtered by author or topic."));
    return g;
  }

  function sortGroup(s) {
    const g = facetGroup("Sort");
    const sel = el("select", "sp-select");
    sel.id = "sp-sort";
    sel.dataset.key = "sort";
    const label = el("label", "visually-hidden", "Sort results");
    label.setAttribute("for", "sp-sort");
    const choices = s.q ? [["relevance", "Best match"], ["newest", "Newest first"], ["oldest", "Oldest first"]] : [["newest", "Newest first"], ["oldest", "Oldest first"]];
    choices.forEach(([v, t]) => {
      const o = el("option", null, t);
      o.value = v;
      if (s.sort === v) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener("change", () => go({ ...state, sort: sel.value, page: 1 }));
    g.appendChild(label);
    g.appendChild(sel);
    return g;
  }

  function yearGroup(s, f) {
    const g = facetGroup("Years");
    // The bars count essays, so the podcasts view keeps only the range.
    if (s.type !== "podcasts" && f && f.years && f.years.length) {
      g.appendChild(yearChart(f.years, s.from, s.to, (y) => {
        // A second pick next to a chosen year makes a range.
        if (s.from && s.from === s.to && y !== s.from) go({ ...state, from: y < s.from ? y : s.from, to: y > s.to ? y : s.to, page: 1 });
        else if (s.from === y && s.to === y) go({ ...state, from: "", to: "", page: 1 });
        else go({ ...state, from: y, to: y, page: 1 });
      }));
      g.appendChild(el("p", "sp-facet-note", "Choose two years to set a range."));
    }
    const range = el("div", "sp-range");
    const thisYear = new Date().getFullYear();
    [["from", "From"], ["to", "To"]].forEach(([k, t]) => {
      const lab = el("label", "sp-range-label", t);
      const sel = el("select", "sp-select");
      sel.dataset.key = `range:${k}`;
      const any = el("option", null, "Any");
      any.value = "";
      sel.appendChild(any);
      for (let y = thisYear; y >= 2005; y--) {
        const o = el("option", null, String(y));
        o.value = String(y);
        if (s[k] === String(y)) o.selected = true;
        sel.appendChild(o);
      }
      sel.addEventListener("change", () => go({ ...state, [k]: sel.value, page: 1 }));
      lab.appendChild(sel);
      range.appendChild(lab);
    });
    g.appendChild(range);
    return g;
  }

  /** Author or topic list: top 8, more on request, plus a finder box. */
  function listGroup(kind, s, items) {
    const g = facetGroup(kind === "author" ? "Authors" : "Topics");
    const selected = s[kind];
    const list = el("ul", "sp-facet-list");
    const limit = expanded[kind] ? 40 : 8;
    (items || []).slice(0, limit).forEach((x) => {
      const li = el("li");
      const on = x.slug === selected;
      const b = button(`sp-facet-item${on ? " is-on" : ""}`, "", () => go({ ...state, [kind]: on ? "" : x.slug, page: 1 }));
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.dataset.key = `${kind}:${x.slug}`;
      if (kind === "author") b.appendChild(avatar(x.name, x.image, 24));
      b.appendChild(el("span", "sp-facet-name", x.name));
      b.appendChild(el("span", "sp-count", x.count.toLocaleString("en-US")));
      li.appendChild(b);
      list.appendChild(li);
    });
    if (!items || !items.length) list.appendChild(el("li", "sp-facet-none", "None for these results."));
    g.appendChild(list);
    if (items && items.length > 8) {
      const more = g.appendChild(button("sp-facet-more", expanded[kind] ? "Show fewer" : `Show ${Math.min(items.length, 40) - 8} more`, () => {
        expanded[kind] = !expanded[kind];
        renderFacets(state, lastFacets);
      }));
      more.dataset.key = `more:${kind}`;
    }
    g.appendChild(finder(kind));
    return g;
  }

  /** "Find an author" box: suggests from the index, applies on choice. */
  function finder(kind) {
    const group = kind === "author" ? "authors" : "topics";
    const wrap = el("div", "sp-finder");
    const id = `sp-find-${kind}`;
    const label = el("label", "visually-hidden", kind === "author" ? "Find an author" : "Find a topic");
    label.setAttribute("for", id);
    const input = el("input", "sp-finder-input");
    input.id = id;
    input.dataset.key = `find:${kind}`;
    input.type = "text";
    input.autocomplete = "off";
    input.placeholder = kind === "author" ? "Find an author" : "Find a topic";
    input.setAttribute("list", `${id}-list`);
    const dl = el("datalist");
    dl.id = `${id}-list`;
    const found = new Map();
    let t = null;
    input.addEventListener("input", () => {
      clearTimeout(t);
      const v = input.value.trim();
      const hit = found.get(v.toLowerCase());
      if (hit) { names[kind].set(hit.slug, hit.name); go({ ...state, [kind]: hit.slug, page: 1 }); return; }
      if (v.length < 2) return;
      t = setTimeout(() => {
        fetchSearch({ q: v, type: group, page_size: 8 }).then((data) => {
          if (!input.isConnected) return;
          const items = (data.groups && data.groups[group] && data.groups[group].items) || [];
          dl.textContent = "";
          items.forEach((x) => {
            found.set(x.name.toLowerCase(), x);
            const o = el("option");
            o.value = x.name;
            dl.appendChild(o);
          });
        }).catch(() => {});
      }, 200);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const v = input.value.trim().toLowerCase();
      if (!v) return;
      const hit = found.get(v) || [...found.values()].find((x) => x.name.toLowerCase().startsWith(v));
      if (hit) { names[kind].set(hit.slug, hit.name); go({ ...state, [kind]: hit.slug, page: 1 }); }
    });
    wrap.appendChild(label);
    wrap.appendChild(input);
    wrap.appendChild(dl);
    return wrap;
  }

  function renderFacets(s, f) {
    // Re-rendering replaces the controls; put focus back where it was.
    const had = document.activeElement && facetsEl.contains(document.activeElement)
      ? document.activeElement.dataset.key : "";
    facetsEl.textContent = "";
    facetsEl.appendChild(typeGroup(s, f));
    facetsEl.appendChild(sortGroup(s));
    facetsEl.appendChild(yearGroup(s, f));
    if (s.type !== "podcasts") {
      facetsEl.appendChild(listGroup("author", s, f && f.authors));
      facetsEl.appendChild(listGroup("topic", s, f && f.topics));
    }
    if (had) {
      const again = [...facetsEl.querySelectorAll("[data-key]")].find((n) => n.dataset.key === had);
      if (again) again.focus({ preventScroll: true });
    }
  }

  // ---- Phone sheet ----------------------------------------------------------

  let sheetReturn = null;
  let inerted = [];
  // Everything outside the sheet: the page beside it and the site around it.
  function outsideSheet() {
    const out = [root.querySelector(".sp-hero"), root.querySelector(".sp-main")];
    for (let n = root; n && n !== document.body; n = n.parentElement) {
      [...n.parentElement.children].forEach((sib) => { if (sib !== n && sib.tagName !== "SCRIPT") out.push(sib); });
    }
    return out.filter(Boolean);
  }
  function openSheet() {
    sheetReturn = document.activeElement;
    sidebar.setAttribute("role", "dialog");
    sidebar.setAttribute("aria-modal", "true");
    sidebar.setAttribute("aria-labelledby", "sp-sheet-title");
    inerted = outsideSheet().filter((n) => !n.inert);
    inerted.forEach((n) => { n.inert = true; });
    resultsEl.classList.add("is-sheet-open");
    backdrop.hidden = false;
    toggleBtn.setAttribute("aria-expanded", "true");
    document.body.classList.add("sp-sheet-lock");
    const first = sidebar.querySelector("button, select, input");
    if (first) first.focus();
  }
  function closeSheet() {
    if (!resultsEl.classList.contains("is-sheet-open")) return;
    resultsEl.classList.remove("is-sheet-open");
    sidebar.removeAttribute("role");
    sidebar.removeAttribute("aria-modal");
    sidebar.removeAttribute("aria-labelledby");
    inerted.forEach((n) => { n.inert = false; });
    inerted = [];
    backdrop.hidden = true;
    toggleBtn.setAttribute("aria-expanded", "false");
    document.body.classList.remove("sp-sheet-lock");
    if (sheetReturn && sheetReturn.focus) sheetReturn.focus();
  }
  toggleBtn.addEventListener("click", () => {
    if (resultsEl.classList.contains("is-sheet-open")) closeSheet();
    else openSheet();
  });
  root.querySelectorAll("[data-sp-sheet-close]").forEach((n) => n.addEventListener("click", closeSheet));
  // Marks a go() that a pick inside the open sheet started.
  ["click", "change", "input", "keydown"].forEach((type) => {
    sidebar.addEventListener(type, (e) => {
      if (resultsEl.classList.contains("is-sheet-open") && !e.target.closest("[data-sp-sheet-close]")) sheetAction = true;
    }, true);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && resultsEl.classList.contains("is-sheet-open")) closeSheet();
  });

  // ---- Search box -------------------------------------------------------------

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    clearTimeout(typingTimer);
    const q = qInput.value.trim().slice(0, 200);
    go({ q, page: 1, sort: q ? "relevance" : state.sort, type: state.type === "topics" || state.type === "authors" ? "all" : state.type });
  });

  // Results follow the typing; the URL is replaced, not pushed, so Back
  // skips the half-typed words.
  qInput.addEventListener("input", () => {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      const q = qInput.value.trim().slice(0, 200);
      if (q === state.q) return;
      if (q && q.length < 2) return;
      go({ q, page: 1, sort: q ? "relevance" : "newest", type: state.type === "topics" || state.type === "authors" ? "all" : state.type }, true);
    }, 350);
  });

  // "/" on this page goes to the big box, not the modal.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    qInput.focus();
    qInput.select();
  }, true);

  window.addEventListener("popstate", () => {
    clearTimeout(typingTimer);
    state = readUrl();
    closeSheet();
    load(state);
  });

  // ---- Start ------------------------------------------------------------------

  state = readUrl();
  if (!state.q && state.sort === "relevance") state.sort = "newest";
  load(state);
  // Totals for the hero line, even when the page opens on results.
  if (!isNavigator(state)) {
    fetchSearch({ view: "nav" }).then((data) => { nav = data; renderStats(data); }).catch(() => {});
  }
  if (!state.q && isNavigator(state)) qInput.focus({ preventScroll: true });
})();
