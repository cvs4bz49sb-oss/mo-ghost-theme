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
 * Modal: opened by any [data-mo-search] element or by "/". The input is a
 * combobox over one listbox; arrow keys move across every group, Enter
 * opens, Esc closes. With an empty box it lists recent searches
 * (localStorage, per browser) or nothing.
 *
 * Page: custom-search.hbs renders #mo-search-page. Filters (author, topic,
 * years) and paging live in the URL, so a results page can be linked.
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

  // Options are reached with the arrow keys, so Tab cycles input and Close.
  function trapTab(e) {
    if (e.key !== "Tab") return;
    const closeBtn = panel.querySelector(".mo-search-close");
    if (e.shiftKey && document.activeElement === input) { e.preventDefault(); closeBtn.focus(); }
    else if (!e.shiftKey && document.activeElement === closeBtn) { e.preventDefault(); input.focus(); }
  }

  function setStatus(msg) {
    statusEl.textContent = msg || "";
    statusEl.hidden = !msg;
  }

  function clearList() {
    listbox.textContent = "";
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
    const used = data && data.corrected ? data.query : q;

    if (!authors.length && !topics.length && !essays.length && !podcasts.length) {
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
    if (essays.length) {
      const grp = addGroup("Essays");
      essays.forEach((x) => addOption(grp, essayRow(x), () => navigate(x.url, used)));
      if (pageOk && essayCount > essays.length) {
        const url = resultsPageUrl(used);
        const more = el("a", "mo-sr mo-sr-more", `Show all ${plural(essayCount, "essay", "essays")}`);
        setHref(more, url);
        addOption(grp, more, () => navigate(url, used));
      }
    }
    if (podcasts.length) {
      const grp = addGroup("Podcasts");
      podcasts.forEach((x) => addOption(grp, podcastRow(x), () => navigate(x.url, used)));
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

  // ---- /search/ page ------------------------------------------------------

  const page = document.getElementById("mo-search-page");
  if (page) initPage(page);

  function initPage(root) {
    const form = root.querySelector(".search-page-form");
    const qInput = root.querySelector("#search-page-q");
    const authorInput = root.querySelector("#search-page-author");
    const topicInput = root.querySelector("#search-page-topic");
    const fromSel = root.querySelector("#search-page-from");
    const toSel = root.querySelector("#search-page-to");
    const statusLine = root.querySelector(".search-page-status");
    const results = root.querySelector(".search-page-results");
    const pager = root.querySelector(".search-page-pager");
    const authorList = root.querySelector("#search-page-authors");
    const topicList = root.querySelector("#search-page-topics");
    const PAGE_SIZE = 20;
    const names = { author: new Map(), topic: new Map() };
    if (!form || !qInput || !results) return;

    // Year choices, newest first, back to the first archive year.
    const thisYear = new Date().getFullYear();
    [fromSel, toSel].forEach((sel) => {
      for (let y = thisYear; y >= 2005; y--) {
        const o = el("option", null, String(y));
        o.value = String(y);
        sel.appendChild(o);
      }
    });

    function readUrl() {
      const sp = new URLSearchParams(window.location.search);
      const year = (v) => (/^\d{4}$/.test(v || "") ? v : "");
      const slug = (v) => (/^[a-z0-9][a-z0-9-]{0,99}$/.test(v || "") ? v : "");
      return {
        q: (sp.get("q") || "").trim().slice(0, 200),
        author: slug(sp.get("author")),
        topic: slug(sp.get("topic")),
        from: year(sp.get("from")),
        to: year(sp.get("to")),
        page: Math.max(1, Math.min(50, parseInt(sp.get("page"), 10) || 1)),
      };
    }

    function writeUrl(s) {
      const sp = new URLSearchParams();
      ["q", "author", "topic", "from", "to"].forEach((k) => { if (s[k]) sp.set(k, s[k]); });
      if (s.page > 1) sp.set("page", String(s.page));
      window.history.pushState(null, "", `${window.location.pathname}?${sp.toString()}`);
    }

    // Author and topic boxes suggest names from the index and map them to slugs.
    function suggest(kind, text) {
      const group = kind === "author" ? "authors" : "topics";
      const list = kind === "author" ? authorList : topicList;
      const t = text.trim();
      if (t.length < 2) return Promise.resolve([]);
      return fetchSearch({ q: t, type: group, page_size: 8 })
        .then((data) => {
          const items = (data.groups && data.groups[group] && data.groups[group].items) || [];
          list.textContent = "";
          items.forEach((x) => {
            names[kind].set(x.name.toLowerCase(), x.slug);
            names[kind].set(`slug:${x.slug}`, x.name);
            const o = el("option");
            o.value = x.name;
            list.appendChild(o);
          });
          return items;
        })
        .catch(() => []);
    }

    let suggestTimer = null;
    [[authorInput, "author"], [topicInput, "topic"]].forEach(([inp, kind]) => {
      inp.addEventListener("input", () => {
        clearTimeout(suggestTimer);
        suggestTimer = setTimeout(() => suggest(kind, inp.value), 200);
      });
    });

    function resolve(kind, text) {
      const t = text.trim();
      if (!t) return Promise.resolve("");
      const hit = names[kind].get(t.toLowerCase());
      if (hit) return Promise.resolve(hit);
      return suggest(kind, t).then((items) => (items[0] ? items[0].slug : ""));
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      Promise.all([resolve("author", authorInput.value), resolve("topic", topicInput.value)]).then(([author, topic]) => {
        if (authorInput.value.trim() && !author) {
          statusLine.textContent = `No author matches \u201c${authorInput.value.trim()}\u201d.`;
          return;
        }
        if (topicInput.value.trim() && !topic) {
          statusLine.textContent = `No topic matches \u201c${topicInput.value.trim()}\u201d.`;
          return;
        }
        // A range typed backward still means the same years.
        let from = fromSel.value;
        let to = toSel.value;
        if (from && to && from > to) [from, to] = [to, from];
        const s = {
          q: qInput.value.trim().slice(0, 200),
          author,
          topic,
          from,
          to,
          page: 1,
        };
        if (s.q) saveRecent(s.q);
        writeUrl(s);
        fill(s);
        load(s);
      });
    });

    window.addEventListener("popstate", () => { const s = readUrl(); fill(s); load(s); });

    function fill(s) {
      qInput.value = s.q;
      fromSel.value = s.from;
      toSel.value = s.to;
      authorInput.value = s.author ? (names.author.get(`slug:${s.author}`) || "") : "";
      topicInput.value = s.topic ? (names.topic.get(`slug:${s.topic}`) || "") : "";
    }

    function section(title, count) {
      const sec = el("section", "search-page-group");
      const h = el("h2", "search-page-group-title", title);
      if (count != null) h.appendChild(el("span", "search-page-count", ` ${count.toLocaleString("en-US")}`));
      sec.appendChild(h);
      const list = el("ol", "search-page-list");
      sec.appendChild(list);
      results.appendChild(sec);
      return list;
    }

    function li(list, node) {
      const item = el("li");
      item.appendChild(node);
      list.appendChild(item);
    }

    let pageAbort = null;
    function load(s) {
      results.textContent = "";
      pager.textContent = "";
      statusLine.textContent = "";
      if (!s.q) { document.title = "Search | Mere Orthodoxy"; return; }
      if (!workerUrl) { statusLine.textContent = "Search is unavailable right now."; return; }
      document.title = `${s.q} | Search | Mere Orthodoxy`;
      if (pageAbort) { try { pageAbort.abort(); } catch (_) { /* done */ } }
      pageAbort = new AbortController();
      results.setAttribute("aria-busy", "true");
      fetchSearch({
        q: s.q,
        author: s.author,
        topic: s.topic,
        from: s.from ? `${s.from}-01-01` : "",
        to: s.to ? `${s.to}-12-31` : "",
        page: s.page,
        page_size: PAGE_SIZE,
      }, pageAbort.signal).then((data) => {
        results.removeAttribute("aria-busy");
        render(s, data);
      }).catch((err) => {
        if (err && err.name === "AbortError") return;
        results.removeAttribute("aria-busy");
        statusLine.textContent = "Search is unavailable right now. Try again in a moment.";
      });
    }

    function render(s, data) {
      const g = data.groups || {};
      const authors = (g.authors && g.authors.items) || [];
      const topics = (g.topics && g.topics.items) || [];
      const essays = g.essays || { items: [], count: 0 };
      const podcasts = (g.podcasts && g.podcasts.items) || [];
      const filtered = !!(s.author || s.topic || s.from || s.to);
      if (!authors.length && !topics.length && !essays.items.length && !podcasts.length) {
        statusLine.textContent = filtered
          ? `No essays match “${s.q}” with these filters.`
          : `No results for “${s.q}”.`;
        return;
      }
      statusLine.textContent = data.corrected ? `Showing results for ${data.query}.` : "";
      const firstPage = s.page === 1 && !filtered;
      if (firstPage && authors.length) {
        const list = section("Authors");
        authors.forEach((x) => li(list, entityRow(x, "essay")));
      }
      if (firstPage && topics.length) {
        const list = section("Topics");
        topics.forEach((x) => li(list, entityRow(x, "post")));
      }
      if (essays.items.length) {
        const list = section("Essays", essays.count);
        list.setAttribute("start", String((s.page - 1) * PAGE_SIZE + 1));
        essays.items.forEach((x) => li(list, essayRow(x)));
      } else if (filtered) {
        statusLine.textContent = `No essays match “${s.q}” with these filters.`;
      }
      if (firstPage && podcasts.length) {
        const list = section("Podcasts");
        podcasts.forEach((x) => li(list, podcastRow(x)));
      }
      renderPager(s, essays.count);
    }

    function renderPager(s, count) {
      const pages = Math.min(50, Math.ceil(count / PAGE_SIZE));
      if (pages <= 1) return;
      const go = (n) => {
        const next = { ...s, page: n };
        writeUrl(next);
        load(next);
        root.scrollIntoView({ block: "start" });
      };
      if (s.page > 1) {
        const prev = el("button", "btn", "Previous");
        prev.type = "button";
        prev.addEventListener("click", () => go(s.page - 1));
        pager.appendChild(prev);
      }
      pager.appendChild(el("span", "search-page-pageno", `Page ${s.page} of ${pages}`));
      if (s.page < pages) {
        const nextBtn = el("button", "btn", "Next");
        nextBtn.type = "button";
        nextBtn.addEventListener("click", () => go(s.page + 1));
        pager.appendChild(nextBtn);
      }
    }

    const initial = readUrl();
    fill(initial);
    // Turn slugs from a shared link back into names for the filter boxes.
    Promise.all([
      initial.author ? suggest("author", initial.author.replace(/^author-/, "").replace(/-/g, " ")) : null,
      initial.topic ? suggest("topic", initial.topic.replace(/-/g, " ")) : null,
    ]).then(() => fill(initial));
    load(initial);
    if (!initial.q) qInput.focus();
  }
})();
