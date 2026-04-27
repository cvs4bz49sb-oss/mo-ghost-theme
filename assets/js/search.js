/*
 * Site search — semantic, powered by mo-search (Cloudflare Worker
 * + Vectorize + OpenAI embeddings). Replaces Ghost's built-in
 * sodo-search modal so we get full-body matches instead of just
 * title/excerpt/tag matches, in MO's editorial UI register.
 *
 * Trigger: any [data-mo-search] element. Click → open modal.
 * Keyboard "/" anywhere also opens (unless typing in an input).
 *
 * Worker URL is read from <body data-search-worker-url="...">,
 * set in default.hbs from @custom.search_worker_url. If empty,
 * the modal renders a "Search isn't configured yet" hint instead
 * of erroring.
 */
(function () {
  var workerUrl = (document.body.getAttribute("data-search-worker-url") || "").trim().replace(/\/$/, "");

  // ---- DOM construction (lazy — only built on first open) -----------

  var modal = null;
  var input = null;
  var resultsEl = null;
  var statusEl = null;
  var hintEl = null;
  var activeIndex = -1;
  var currentResults = [];
  var lastQuery = "";
  var debounceTimer = null;
  var inflightAbort = null;

  function buildModal() {
    if (modal) return;

    modal = document.createElement("div");
    modal.className = "mo-search-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "Search");
    modal.hidden = true;

    var backdrop = document.createElement("div");
    backdrop.className = "mo-search-backdrop";
    backdrop.addEventListener("click", close);
    modal.appendChild(backdrop);

    var panel = document.createElement("div");
    panel.className = "mo-search-panel";

    var header = document.createElement("div");
    header.className = "mo-search-header";

    // Magnifier icon left of input.
    var icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("class", "mo-search-icon");
    icon.setAttribute("width", "20"); icon.setAttribute("height", "20");
    icon.setAttribute("viewBox", "0 0 24 24"); icon.setAttribute("fill", "none");
    icon.setAttribute("stroke", "currentColor"); icon.setAttribute("stroke-width", "2");
    icon.setAttribute("stroke-linecap", "round"); icon.setAttribute("stroke-linejoin", "round");
    icon.innerHTML = '<circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>';
    header.appendChild(icon);

    input = document.createElement("input");
    input.type = "text";
    input.className = "mo-search-input";
    input.placeholder = "Search the archive\u2026";
    input.setAttribute("autocomplete", "off");
    input.setAttribute("spellcheck", "false");
    input.setAttribute("aria-label", "Search query");
    input.addEventListener("input", onInput);
    input.addEventListener("keydown", onInputKeydown);
    header.appendChild(input);

    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "mo-search-close";
    closeBtn.setAttribute("aria-label", "Close search");
    closeBtn.innerHTML = "Esc";
    closeBtn.addEventListener("click", close);
    header.appendChild(closeBtn);

    panel.appendChild(header);

    statusEl = document.createElement("p");
    statusEl.className = "mo-search-status";
    statusEl.setAttribute("aria-live", "polite");
    panel.appendChild(statusEl);

    resultsEl = document.createElement("ol");
    resultsEl.className = "mo-search-results";
    resultsEl.setAttribute("role", "listbox");
    panel.appendChild(resultsEl);

    hintEl = document.createElement("p");
    hintEl.className = "mo-search-hint";
    hintEl.innerHTML = '<span><kbd>\u2191</kbd><kbd>\u2193</kbd> to navigate</span> <span><kbd>Enter</kbd> to open</span> <span><kbd>Esc</kbd> to close</span>';
    panel.appendChild(hintEl);

    modal.appendChild(panel);
    document.body.appendChild(modal);
  }

  // ---- Open / close ------------------------------------------------

  function open() {
    buildModal();
    modal.hidden = false;
    document.body.classList.add("mo-search-open");
    setTimeout(function () { input.focus(); }, 0);
    if (!workerUrl) {
      setStatus("Search isn't configured yet (no worker URL set in theme settings).");
    } else if (!input.value) {
      setStatus("Type to search the archive\u2014titles, ideas, and full essay content.");
    }
  }

  function close() {
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("mo-search-open");
    if (inflightAbort) { try { inflightAbort.abort(); } catch (_) {} inflightAbort = null; }
  }

  // ---- Input handling ---------------------------------------------

  function onInput() {
    var q = input.value.trim();
    if (!q) {
      setStatus("Type to search the archive\u2014titles, ideas, and full essay content.");
      renderResults([]);
      return;
    }
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () { runSearch(q); }, 220);
  }

  function onInputKeydown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActive(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActive(-1);
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && currentResults[activeIndex]) {
        e.preventDefault();
        window.location.href = currentResults[activeIndex].url;
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }

  function moveActive(dir) {
    if (!currentResults.length) return;
    activeIndex = (activeIndex + dir + currentResults.length) % currentResults.length;
    var lis = resultsEl.querySelectorAll(".mo-search-result");
    lis.forEach(function (li, i) {
      li.classList.toggle("is-active", i === activeIndex);
      if (i === activeIndex) li.scrollIntoView({ block: "nearest" });
    });
  }

  // ---- Worker call -------------------------------------------------

  function runSearch(q) {
    if (!workerUrl) {
      setStatus("Search isn't configured yet (no worker URL set in theme settings).");
      return;
    }
    if (q === lastQuery) return;
    lastQuery = q;

    if (inflightAbort) { try { inflightAbort.abort(); } catch (_) {} }
    inflightAbort = new AbortController();
    setStatus("Searching the archive\u2026");

    fetch(workerUrl + "/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: q }),
      signal: inflightAbort.signal,
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (q !== lastQuery) return; // stale; a newer query is in flight
        var results = (data && data.results) || [];
        currentResults = results;
        activeIndex = results.length ? 0 : -1;
        if (!results.length) {
          setStatus('No results for "' + q + '". Try a different phrasing.');
          renderResults([]);
        } else {
          setStatus("");
          renderResults(results);
        }
      })
      .catch(function (err) {
        if (err && err.name === "AbortError") return;
        console.error("search failed", err);
        setStatus("Search failed. Try again in a moment.");
      });
  }

  // ---- Render ------------------------------------------------------

  function renderResults(results) {
    resultsEl.innerHTML = "";
    if (!results.length) return;
    results.forEach(function (r, i) {
      var li = document.createElement("li");
      li.className = "mo-search-result";
      if (i === activeIndex) li.classList.add("is-active");
      li.setAttribute("role", "option");

      var a = document.createElement("a");
      a.href = r.url;
      a.className = "mo-search-result-link";

      var titleEl = document.createElement("h3");
      titleEl.className = "mo-search-result-title";
      var em = document.createElement("em");
      em.textContent = r.title || "(untitled)";
      titleEl.appendChild(em);
      a.appendChild(titleEl);

      // Eyebrow: author + date + tag.
      var meta = [];
      if (r.primary_author) meta.push("By " + r.primary_author);
      if (r.published_at) meta.push(formatDate(r.published_at));
      if (r.primary_tag) meta.push(r.primary_tag);
      if (meta.length) {
        var metaEl = document.createElement("p");
        metaEl.className = "mo-search-result-meta";
        metaEl.textContent = meta.join("  \u00b7  ");
        a.appendChild(metaEl);
      }

      if (r.excerpt) {
        var excerptEl = document.createElement("p");
        excerptEl.className = "mo-search-result-excerpt";
        excerptEl.innerHTML = highlight(r.excerpt, lastQuery);
        a.appendChild(excerptEl);
      }

      li.appendChild(a);
      li.addEventListener("mouseenter", function () {
        activeIndex = i;
        var lis = resultsEl.querySelectorAll(".mo-search-result");
        lis.forEach(function (n, idx) { n.classList.toggle("is-active", idx === i); });
      });
      resultsEl.appendChild(li);
    });
  }

  function setStatus(msg) {
    if (!statusEl) return;
    statusEl.textContent = msg || "";
    statusEl.style.display = msg ? "" : "none";
  }

  // ---- Term highlighting (best-effort) ----------------------------

  function highlight(text, query) {
    var escaped = escapeHtml(text);
    if (!query) return escaped;
    // Highlight any word from the query that appears in the excerpt
    // (case-insensitive). Semantic matches won't always have literal
    // overlap — that's expected; the result is still ranked correctly.
    var words = query.toLowerCase().split(/\s+/).filter(function (w) {
      return w.length > 2; // skip stopwords-by-length
    });
    if (!words.length) return escaped;
    var pattern = new RegExp("(" + words.map(escapeRegex).join("|") + ")", "ig");
    return escaped.replace(pattern, "<mark>$1</mark>");
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  function formatDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  // ---- Trigger wiring ---------------------------------------------

  document.addEventListener("click", function (e) {
    var trigger = e.target && e.target.closest && e.target.closest("[data-mo-search]");
    if (!trigger) return;
    e.preventDefault();
    open();
  });

  // "/" from anywhere on the page opens search, unless we're already
  // typing into an input/textarea/contenteditable.
  document.addEventListener("keydown", function (e) {
    if (e.key !== "/") return;
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    e.preventDefault();
    open();
  });
})();
