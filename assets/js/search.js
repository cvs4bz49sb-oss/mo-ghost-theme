/*
 * Site search: the modal (every page) and the full results page (/search/).
 *
 * Backend: the mo-search worker (D1 full-text index), at
 * <body data-search-worker-url>, set from @custom.search_worker_url.
 * GET /api/search returns grouped results: authors, topics, essays and
 * podcasts, each with a count. Essay snippets mark matched words with
 * \u0002 and \u0003; they are split here and built as text nodes, so no
 * markup from an essay ever reaches innerHTML.
 *
 * Modal: opened by "/" (or any [data-mo-search] element). The nav's
 * search icon and the phone menu's Search are plain links to /search/. The input is a
 * combobox over one listbox; arrow keys move across every group, Enter
 * opens, Esc closes. With an empty box it lists recent searches
 * (localStorage, per browser, with a Clear button) or nothing. The last
 * row opens the full /search/ page with the same query.
 *
 * Page: assets/js/page/search-page.js, loaded only by custom-search.hbs.
 * It uses the helpers this file publishes as window.MOSearch.
 */
(function () {
  const workerUrl = (document.body.getAttribute("data-search-worker-url") || "").trim().replace(/\/$/, "");
  const MARK_OPEN = "\u0002";
  const MARK_CLOSE = "\u0003";
  const RECENT_KEY = "mo-search-recent";
  const SVG_NS = "http://www.w3.org/2000/svg";

  // ---- Shared helpers -------------------------------------------------

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function setHref(a, url) {
    if (window.MOSafeHref) window.MOSafeHref.set(a, url, "#");
  }

  /** Snippet text with \u0002…\u0003 around matches, as text nodes and <mark>s. */
  function appendSnippet(parent, text) {
    const s = String(text || "");
    let i = 0;
    while (i < s.length) {
      const open = s.indexOf(MARK_OPEN, i);
      if (open < 0) { parent.appendChild(document.createTextNode(s.slice(i))); break; }
      if (open > i) parent.appendChild(document.createTextNode(s.slice(i, open)));
      const close = s.indexOf(MARK_CLOSE, open + 1);
      const end = close < 0 ? s.length : close;
      parent.appendChild(el("mark", null, s.slice(open + 1, end)));
      i = end + 1;
    }
  }

  /*
   * Site sections a search can land on directly ("donate", "submit an
   * essay", "liturgy"). Matched by word prefix on title and keywords.
   */
  const SECTIONS = [
    { title: "The Faith Received", url: "/the-faith-received/", desc: "A library of historical Christian theology, from the Fathers to the Reformers.", kw: "library fathers reformers creeds confessions catechisms historical tfr patristics church history" },
    { title: "Membership", url: "/membership/", desc: "Support the work and receive the print journal.", kw: "membership member members subscribe subscription join support print journal" },
    { title: "Give a membership", url: "/give/", desc: "Give a year of Mere Orthodoxy as a gift.", kw: "gift gifts give present" },
    { title: "Donate", url: "/donate/", desc: "Make a gift to support Mere Orthodoxy.", kw: "donate donation donations giving tax deductible support" },
    { title: "Churches and schools", url: "/institutions/", desc: "Memberships for churches, schools and seminaries.", kw: "church churches school schools seminary institution institutions group groups" },
    { title: "Student rate", url: "/student/", desc: "A reduced membership for students.", kw: "student students discount" },
    { title: "The Daily Liturgy", url: "/daily-liturgy/read/", desc: "Today's prayers and readings.", kw: "liturgy daily prayer prayers office morning evening readings lectionary" },
    { title: "Online Forums", url: "/events/", desc: "Live conversations with our writers.", kw: "events event forum forums online webinar live conversation" },
    { title: "Writers Meetings", url: "/writers-meetings/", desc: "Meet the editors and talk about writing for us.", kw: "writers writing meeting meetings" },
    { title: "Submit an essay", url: "/submissions/", desc: "How to pitch or submit your work.", kw: "submit submission submissions pitch pitches write writing contribute" },
    { title: "eBooks", url: "/ebooks/", desc: "Short books from our writers.", kw: "ebook ebooks books download" },
    { title: "The Bookshelf", url: "/books/", desc: "Books by our writers and books we recommend.", kw: "books bookstore bookshop bookshelf reading recommendations" },
    { title: "Contributors", url: "/contributors/", desc: "Everyone who writes for Mere Orthodoxy.", kw: "contributors writers authors" },
    { title: "Archive", url: "/archive/", desc: "Every essay, newest first.", kw: "archive essays latest all" },
    { title: "About", url: "/about/", desc: "Who we are and what we are for.", kw: "about mission staff team editors masthead who" },
    { title: "Contact", url: "/contact/", desc: "Write to the editors or ask for help.", kw: "contact email help question questions support" },
    { title: "Sponsorship", url: "/sponsorship/", desc: "Sponsor the podcasts or the newsletter.", kw: "sponsor sponsorship sponsors advertise advertising ads" },
    { title: "Your dashboard", url: "/dashboard/", desc: "Your bookmarks, history and membership.", kw: "dashboard account bookmarks history profile settings manage" },
  ].map((x) => ({ ...x, words: `${x.title} ${x.kw}`.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean) }));

  function matchSections(q, limit) {
    const toks = String(q || "").toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
    if (!toks.length) return [];
    return SECTIONS
      .map((x) => ({ x, hits: toks.filter((t) => x.words.some((w) => w.startsWith(t))).length }))
      .filter((m) => m.hits === toks.length)
      .slice(0, limit || 3)
      .map((m) => m.x);
  }

  function formatDate(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }

  function plural(n, one, many) {
    return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
  }

  const responseCache = new Map();
  function fetchSearch(params, signal) {
    const sp = new URLSearchParams();
    Object.keys(params).forEach((k) => {
      if (params[k] !== "" && params[k] != null) sp.set(k, String(params[k]));
    });
    const key = sp.toString();
    if (responseCache.has(key)) return Promise.resolve(responseCache.get(key));
    return fetch(`${workerUrl}/api/search?${key}`, { signal })
      .then((res) => {
        if (!res.ok) throw new Error(`search ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (responseCache.size > 50) responseCache.clear();
        responseCache.set(key, data);
        return data;
      });
  }

  // The /search/ page needs its routes.yaml entry. Until it exists the
  // modal does not link to it.
  let pageCheck = null;
  function resultsPageAvailable() {
    if (pageCheck) return pageCheck;
    let known = null;
    try { known = sessionStorage.getItem("mo-search-page"); } catch (_) { /* storage blocked */ }
    if (known === "1") {
      pageCheck = Promise.resolve(true);
      return pageCheck;
    }
    pageCheck = fetch("/search/", { method: "HEAD", credentials: "same-origin" })
      .then((r) => r.ok)
      .catch(() => false)
      .then((ok) => {
        // Only a yes is remembered, so the link appears as soon as the route does.
        if (ok) { try { sessionStorage.setItem("mo-search-page", "1"); } catch (_) { /* storage blocked */ } }
        return ok;
      });
    return pageCheck;
  }

  function resultsPageUrl(q) {
    return `/search/?q=${encodeURIComponent(q)}`;
  }

  function readRecent() {
    try {
      const v = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 5) : [];
    } catch (_) {
      return [];
    }
  }

  function clearRecent() {
    try { localStorage.removeItem(RECENT_KEY); } catch (_) { /* storage blocked */ }
  }

  function saveRecent(q) {
    const t = String(q || "").trim().slice(0, 200);
    if (t.length < 2) return;
    try {
      const list = readRecent().filter((x) => x.toLowerCase() !== t.toLowerCase());
      list.unshift(t);
      localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 5)));
    } catch (_) { /* storage blocked */ }
  }

  function searchIcon(cls) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", cls);
    svg.setAttribute("width", "20");
    svg.setAttribute("height", "20");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("aria-hidden", "true");
    const c = document.createElementNS(SVG_NS, "circle");
    c.setAttribute("cx", "11"); c.setAttribute("cy", "11"); c.setAttribute("r", "7");
    const l = document.createElementNS(SVG_NS, "line");
    l.setAttribute("x1", "21"); l.setAttribute("y1", "21"); l.setAttribute("x2", "16.65"); l.setAttribute("y2", "16.65");
    svg.appendChild(c);
    svg.appendChild(l);
    return svg;
  }

  // ---- Result rows (shared by modal and page) -------------------------

  function essayRow(e) {
    const a = el("a", "mo-sr mo-sr-essay");
    setHref(a, e.url);
    a.appendChild(el("span", "mo-sr-title", e.title || "Untitled"));
    const meta = [e.authors, formatDate(e.published_at)].filter(Boolean).join(" · ");
    if (meta) a.appendChild(el("span", "mo-sr-meta", meta));
    if (e.snippet) {
      const p = el("span", "mo-sr-snippet");
      appendSnippet(p, e.snippet);
      a.appendChild(p);
    }
    return a;
  }

  function entityRow(x, noun) {
    const a = el("a", "mo-sr mo-sr-entity");
    setHref(a, x.url);
    a.appendChild(el("span", "mo-sr-title", x.name));
    a.appendChild(el("span", "mo-sr-meta", plural(x.post_count, noun, `${noun}s`)));
    return a;
  }

  function podcastRow(p) {
    const a = el("a", "mo-sr mo-sr-podcast");
    setHref(a, p.url);
    a.appendChild(el("span", "mo-sr-title", p.title));
    const meta = p.kind === "show" ? "Podcast" : [p.show, formatDate(p.published_at)].filter(Boolean).join(" · ");
    a.appendChild(el("span", "mo-sr-meta", meta));
    return a;
  }

  // ---- Modal ------------------------------------------------------------

  let modal = null;
  let panel = null;
  let input = null;
  let listbox = null;
  let statusEl = null;
  let clearBtn = null;
  let options = [];
  let activeIndex = -1;
  let lastQuery = null;
  let debounceTimer = null;
  let inflight = null;
  let returnFocus = null;
  let idSeq = 0;

  function buildModal() {
    if (modal) return;
    modal = el("div", "mo-search-modal");
    modal.hidden = true;

    const backdrop = el("div", "mo-search-backdrop");
    backdrop.addEventListener("click", close);
    modal.appendChild(backdrop);

    panel = el("div", "mo-search-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Search");

    const form = el("form", "mo-search-header");
    form.setAttribute("role", "search");
    form.addEventListener("submit", (e) => { e.preventDefault(); activate(activeIndex); });
    form.appendChild(searchIcon("mo-search-icon"));

    input = el("input", "mo-search-input");
    input.type = "search";
    input.placeholder = "Search essays, authors, topics, podcasts";
    input.setAttribute("aria-label", "Search");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("spellcheck", "false");
    input.setAttribute("enterkeyhint", "search");
    input.setAttribute("maxlength", "200");
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", "mo-search-listbox");
    input.addEventListener("input", onInput);
    input.addEventListener("keydown", onKeydown);
    form.appendChild(input);

    const closeBtn = el("button", "mo-search-close", "Close");
    closeBtn.type = "button";
    closeBtn.addEventListener("click", close);
    form.appendChild(closeBtn);
    panel.appendChild(form);

    statusEl = el("p", "mo-search-status");
    statusEl.setAttribute("role", "status");
    statusEl.hidden = true;
    panel.appendChild(statusEl);

    // Outside the listbox, which may hold only options and groups.
    clearBtn = el("button", "mo-search-clear", "Clear recent searches");
    clearBtn.type = "button";
    clearBtn.hidden = true;
    clearBtn.addEventListener("click", () => {
      clearRecent();
      clearList();
      setStatus("Recent searches cleared.");
      input.focus();
    });
    panel.appendChild(clearBtn);

    listbox = el("div", "mo-search-results");
    listbox.id = "mo-search-listbox";
    listbox.setAttribute("role", "listbox");
    listbox.setAttribute("aria-label", "Search results");
    panel.appendChild(listbox);

    panel.addEventListener("keydown", trapTab);
    modal.appendChild(panel);
    document.body.appendChild(modal);
  }

  function open() {
    buildModal();
    if (!modal.hidden) { input.focus(); return; }
    returnFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add("mo-search-open");
    input.focus();
    input.select();
    if (!workerUrl) { setStatus("Search is unavailable right now."); return; }
    if (!input.value.trim()) renderRecent();
    resultsPageAvailable();
  }

  function close() {
    if (!modal || modal.hidden) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    modal.hidden = true;
    document.body.classList.remove("mo-search-open");
    if (inflight) { try { inflight.abort(); } catch (_) { /* already done */ } inflight = null; }
    lastQuery = null;
    if (returnFocus && typeof returnFocus.focus === "function") returnFocus.focus();
  }

  // Options are reached with the arrow keys, so Tab cycles the input and
  // the buttons (Close, and Clear when recent searches show).
  function trapTab(e) {
    if (e.key !== "Tab") return;
    const stops = [input, ...panel.querySelectorAll("button")].filter((n) => !n.hidden && n.offsetParent !== null);
    const i = stops.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    stops[(i + (e.shiftKey ? stops.length - 1 : 1)) % stops.length].focus();
  }

  function setStatus(msg) {
    statusEl.textContent = msg || "";
    statusEl.hidden = !msg;
  }

  function clearList() {
    listbox.textContent = "";
    clearBtn.hidden = true;
    options = [];
    activeIndex = -1;
    input.removeAttribute("aria-activedescendant");
    input.setAttribute("aria-expanded", "false");
  }

  /** Register a row as a listbox option. `run` handles Enter and click. */
  function addOption(group, node, run) {
    idSeq += 1;
    node.id = `mo-search-opt-${idSeq}`;
    node.setAttribute("role", "option");
    node.setAttribute("aria-selected", "false");
    node.setAttribute("tabindex", "-1");
    const index = options.length;
    node.addEventListener("mousemove", () => { if (activeIndex !== index) setActive(index, false); });
    node.addEventListener("click", (e) => {
      // Let modified clicks open a new tab as links normally do.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      e.preventDefault();
      run();
    });
    options.push({ node, run });
    group.appendChild(node);
  }

  function addGroup(title) {
    idSeq += 1;
    const g = el("div", "mo-search-group");
    g.setAttribute("role", "group");
    const h = el("p", "mo-search-group-title", title);
    h.id = `mo-search-grp-${idSeq}`;
    g.setAttribute("aria-labelledby", h.id);
    g.appendChild(h);
    listbox.appendChild(g);
    return g;
  }

  function sectionRow(x) {
    const a = el("a", "mo-sr mo-sr-section");
    setHref(a, x.url);
    a.appendChild(el("span", "mo-sr-title", x.title));
    a.appendChild(el("span", "mo-sr-meta", x.desc));
    return a;
  }

  function navigate(url, q) {
    if (q) saveRecent(q);
    const safe = window.MOSafeHref ? window.MOSafeHref.sanitize(url) : "";
    // eslint-disable-next-line no-restricted-syntax -- validated by MOSafeHref.sanitize above
    if (safe) window.location.href = safe;
  }

  function setActive(i, scroll) {
    if (activeIndex >= 0 && options[activeIndex]) {
      options[activeIndex].node.classList.remove("is-active");
      options[activeIndex].node.setAttribute("aria-selected", "false");
    }
    activeIndex = i;
    if (i < 0 || !options[i]) { input.removeAttribute("aria-activedescendant"); return; }
    const n = options[i].node;
    n.classList.add("is-active");
    n.setAttribute("aria-selected", "true");
    input.setAttribute("aria-activedescendant", n.id);
    if (scroll) n.scrollIntoView({ block: "nearest" });
  }

  function activate(i) {
    const q = input.value.trim();
    if (i >= 0 && options[i]) { options[i].run(); return; }
    if (!q) return;
    resultsPageAvailable().then((ok) => {
      if (ok) navigate(resultsPageUrl(q), q);
      // Results on screen are for this query: open the first. Otherwise search now.
      else if (options[0] && lastQuery === q) options[0].run();
      else runSearch(q);
    });
  }

  function onKeydown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (options.length) setActive(activeIndex < options.length - 1 ? activeIndex + 1 : 0, true);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (options.length) setActive(activeIndex > 0 ? activeIndex - 1 : options.length - 1, true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }

  function onInput() {
    const q = input.value.trim();
    if (debounceTimer) clearTimeout(debounceTimer);
    if (!q) {
      lastQuery = null;
      if (inflight) { try { inflight.abort(); } catch (_) { /* done */ } }
      setStatus("");
      renderRecent();
      return;
    }
    debounceTimer = setTimeout(() => { runSearch(q); }, 180);
  }

  function renderRecent() {
    clearList();
    const recent = readRecent();
    if (!recent.length) return;
    const g = addGroup("Recent searches");
    clearBtn.hidden = false;
    recent.forEach((r) => {
      const row = el("div", "mo-sr mo-sr-recent");
      row.appendChild(el("span", "mo-sr-title", r));
      addOption(g, row, () => { input.value = r; runSearch(r); input.focus(); });
    });
    input.setAttribute("aria-expanded", "true");
  }

  function runSearch(q) {
    if (!workerUrl) return;
    if (q === lastQuery) return;
    lastQuery = q;
    if (inflight) { try { inflight.abort(); } catch (_) { /* done */ } }
    inflight = new AbortController();
    listbox.setAttribute("aria-busy", "true");
    setStatus("");
    Promise.all([fetchSearch({ q, page_size: 5 }, inflight.signal), resultsPageAvailable()])
      .then(([data, pageOk]) => {
        if (q !== lastQuery) return;
        listbox.removeAttribute("aria-busy");
        renderResults(q, data, pageOk);
      })
      .catch((err) => {
        if (err && err.name === "AbortError") return;
        listbox.removeAttribute("aria-busy");
        lastQuery = null;
        clearList();
        setStatus("Search is unavailable right now. Try again in a moment.");
      });
  }

  function renderResults(q, data, pageOk) {
    clearList();
    const g = (data && data.groups) || {};
    const authors = (g.authors && g.authors.items) || [];
    const topics = (g.topics && g.topics.items) || [];
    const essays = (g.essays && g.essays.items) || [];
    const podcasts = (g.podcasts && g.podcasts.items) || [];
    const essayCount = (g.essays && g.essays.count) || 0;
    const podcastCount = (g.podcasts && g.podcasts.count) || 0;
    const used = data && data.corrected ? data.query : q;
    const sections = matchSections(q, 2);

    if (!authors.length && !topics.length && !essays.length && !podcasts.length && !sections.length) {
      setStatus(`No results for “${q}”.`);
      return;
    }
    setStatus(data && data.corrected ? `Showing results for ${data.query}.` : "");

    if (authors.length) {
      const grp = addGroup("Authors");
      authors.forEach((x) => addOption(grp, entityRow(x, "essay"), () => navigate(x.url, used)));
    }
    if (topics.length) {
      const grp = addGroup("Topics");
      topics.forEach((x) => addOption(grp, entityRow(x, "post"), () => navigate(x.url, used)));
    }
    if (sections.length) {
      const grp = addGroup("Pages");
      sections.forEach((x) => addOption(grp, sectionRow(x), () => navigate(x.url, used)));
    }
    if (essays.length) {
      const grp = addGroup("Essays");
      essays.forEach((x) => addOption(grp, essayRow(x), () => navigate(x.url, used)));
    }
    if (podcasts.length) {
      const grp = addGroup("Podcasts");
      podcasts.forEach((x) => addOption(grp, podcastRow(x), () => navigate(x.url, used)));
    }
    if (pageOk && (essayCount || podcastCount)) {
      const grp = addGroup("All results");
      const url = resultsPageUrl(used);
      const more = el("a", "mo-sr mo-sr-more");
      setHref(more, url);
      more.appendChild(el("span", "mo-sr-title", "Filter and browse every result"));
      const counts = [essayCount ? plural(essayCount, "essay", "essays") : "", podcastCount ? plural(podcastCount, "podcast episode", "podcast episodes") : ""].filter(Boolean).join(" and ");
      more.appendChild(el("span", "mo-sr-meta", counts));
      addOption(grp, more, () => navigate(url, used));
    }
    input.setAttribute("aria-expanded", "true");
    listbox.scrollTop = 0;
  }

  // ---- Triggers -----------------------------------------------------------

  document.addEventListener("click", (e) => {
    const trigger = e.target && e.target.closest && e.target.closest("[data-mo-search]");
    if (!trigger) return;
    e.preventDefault();
    open();
  });

  document.addEventListener("keydown", (e) => {
    if (modal && !modal.hidden) {
      if (e.key === "Escape" && document.activeElement !== input) close();
      return;
    }
    if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
    e.preventDefault();
    open();
  });

  // ---- Shared with assets/js/page/search-page.js --------------------------

  window.MOSearch = {
    workerUrl,
    el,
    setHref,
    appendSnippet,
    formatDate,
    plural,
    fetchSearch,
    readRecent,
    saveRecent,
    clearRecent,
    matchSections,
    sections: SECTIONS,
    openModal: open,
  };
})();
