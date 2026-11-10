/*
 * Full-width header menu (partials/nav-mega.hbs).
 *
 *   1. Desktop (1262px and up, where the bar shows): each [data-mm-trigger]
 *      in the header opens its panel under the bar. Hover opens after a
 *      short delay so a pointer crossing the bar on its way to the page
 *      does not flash panels; once one is open, moving along the bar
 *      swaps instantly. Click toggles (touch screens wide enough for the
 *      bar have no hover). Escape, the backdrop, scrolling the page or
 *      leaving the menu closes it.
 *
 *   2. Read: the first time the menu is used, essays come from the
 *      Content API (the key ghost_head already exposes; related.js reads
 *      it the same way). Latest and Must Reads load first; a topic loads
 *      when its name is hovered. Must Reads uses the homepage column's
 *      filter (index.hbs): featured, no #event, no #podcast-transcript.
 *      Bylines come from the author-* tags, as everywhere else.
 *
 *   3. Listen: the two newest episodes of each show, from the podcast
 *      worker the podcast pages read (body[data-podcast-feed-url]).
 *      Passages: Nicaea is a closed series heard from the start, so it
 *      shows its first two instead ([data-mm-first]).
 *
 *   4. Phone drawer: the list in #mobile-nav is rebuilt from the panels as
 *      one collapsible section per panel, so the drawer and the bar carry
 *      the same links. The server-rendered @site.navigation list stays as
 *      the fallback if this script never runs.
 *
 * Every fetch fails quietly: the index links, show links and drawer still
 * work without any of the fetched content.
 */
(function () {
  const mega = document.querySelector("[data-mm]");
  const backdrop = document.querySelector("[data-mm-backdrop]");
  const triggers = Array.prototype.slice.call(document.querySelectorAll("[data-mm-trigger]"));
  const header = document.querySelector(".site-header");
  if (!mega || !triggers.length || !header) return;

  const panels = Array.prototype.slice.call(mega.querySelectorAll("[data-mm-panel]"));
  const DESKTOP = window.matchMedia("(min-width: 1262px)");
  const OPEN_DELAY = 120;
  // The Faith Received home sends the header's Support to its own #support
  // section (page/faith-support-scroll.js), so hovering it there opens nothing.
  // Checked on use: this file runs in the header, before the page body exists.
  function supportScrolls() {
    return !!document.getElementById("support") && !!document.querySelector("script[src*='faith-support-scroll']");
  }
  const CLOSE_DELAY = 220;
  let openTimer = 0;
  let closeTimer = 0;
  let current = null;
  let openedAtY = 0;
  let hoverOpenedAt = 0;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ── 1. Panels ───────────────────────────────────────────────────────

  function place() {
    // The bar can carry a banner above it, and it slides away on scroll,
    // so the panel hangs from wherever the bar's bottom edge is now.
    const bottom = Math.max(0, header.getBoundingClientRect().bottom);
    mega.style.top = `${bottom}px`;
    mega.style.maxHeight = `calc(100vh - ${bottom}px)`;
  }

  function open(name) {
    if (!DESKTOP.matches) return;
    clearTimeout(closeTimer);
    current = name;
    triggers.forEach((t) => {
      t.setAttribute("aria-expanded", t.getAttribute("data-mm-trigger") === name ? "true" : "false");
    });
    panels.forEach((p) => {
      p.classList.toggle("is-active", p.getAttribute("data-mm-panel") === name);
    });
    place();
    mega.hidden = false;
    backdrop.hidden = false;
    // Read layout once so the fade runs from the hidden state. Not a rAF:
    // a page that never paints a frame would leave the panel invisible.
    void mega.offsetWidth;
    mega.classList.add("is-open");
    backdrop.classList.add("is-open");
    openedAtY = window.scrollY;
    if (name === "read") loadEssays();
    if (name === "listen") loadEpisodes();
  }

  function close() {
    clearTimeout(openTimer);
    if (!current) return;
    current = null;
    triggers.forEach((t) => { t.setAttribute("aria-expanded", "false"); });
    mega.classList.remove("is-open");
    backdrop.classList.remove("is-open");
    setTimeout(() => {
      if (current) return;
      mega.hidden = true;
      backdrop.hidden = true;
    }, 200);
  }

  triggers.forEach((t, i) => {
    const name = t.getAttribute("data-mm-trigger");
    t.addEventListener("mouseenter", () => {
      clearTimeout(closeTimer);
      clearTimeout(openTimer);
      if (name === "support" && supportScrolls()) return;
      // Start the fetch on intent so the panel is usually full on arrival.
      if (name === "read") loadEssays();
      if (name === "listen") loadEpisodes();
      // A touch screen fires a mouseenter just before its click, so the
      // instant swap counts as a hover-open too.
      if (current) { open(name); hoverOpenedAt = Date.now(); }
      else openTimer = setTimeout(() => { open(name); hoverOpenedAt = Date.now(); }, OPEN_DELAY);
    });
    t.addEventListener("mouseleave", () => {
      clearTimeout(openTimer);
      closeTimer = setTimeout(close, CLOSE_DELAY);
    });
    t.addEventListener("click", (e) => {
      e.preventDefault();
      clearTimeout(openTimer);
      // A click that lands just after hover opened this panel is the
      // same intent, not a request to close it.
      if (current === name && Date.now() - hoverOpenedAt > 600) close();
      else if (current !== name) open(name);
    });
    t.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const step = e.key === "ArrowRight" ? 1 : -1;
        triggers[(i + step + triggers.length) % triggers.length].focus();
      } else if (e.key === "Tab" && !e.shiftKey && current === name) {
        // The panel sits after the header in the page, so Tab from an open
        // trigger would skip it. Step into it instead.
        const first = focusables()[0];
        if (first) { e.preventDefault(); first.focus(); }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        open(name);
        const first = mega.querySelector(".mm-panel.is-active a, .mm-panel.is-active input");
        if (first) first.focus();
      }
    });
  });

  function focusables() {
    const panel = mega.querySelector(".mm-panel.is-active");
    if (!panel) return [];
    return Array.prototype.filter.call(
      panel.querySelectorAll("a[href], button, input"),
      (el) => { return el.getAttribute("tabindex") !== "-1" && !el.disabled && el.offsetParent !== null; },
    );
  }

  // Tab past the panel's last item goes on to the next trigger; Shift+Tab
  // before its first returns to the trigger that opened it.
  mega.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || !current) return;
    const list = focusables();
    const i = triggers.findIndex((t) => { return t.getAttribute("data-mm-trigger") === current; });
    if (!e.shiftKey && document.activeElement === list[list.length - 1]) {
      e.preventDefault();
      const next = triggers[i + 1];
      close();
      if (next) next.focus();
      else {
        const after = header.querySelector(".nav-actions a, .nav-actions button");
        if (after) after.focus();
      }
    } else if (e.shiftKey && document.activeElement === list[0]) {
      e.preventDefault();
      triggers[i].focus();
    }
  });

  mega.addEventListener("mouseenter", () => { clearTimeout(closeTimer); });
  mega.addEventListener("mouseleave", () => {
    // Someone typing into the sign-up form must not lose it to a stray
    // pointer movement.
    if (mega.contains(document.activeElement) && document.activeElement.matches("input")) return;
    closeTimer = setTimeout(close, CLOSE_DELAY);
  });
  backdrop.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !current) return;
    const t = triggers.find((x) => { return x.getAttribute("data-mm-trigger") === current; });
    close();
    if (t) t.focus();
  });
  document.addEventListener("focusin", (e) => {
    if (!current) return;
    if (mega.contains(e.target) || header.contains(e.target)) return;
    close();
  });
  // The bar slides away on a 10px scroll (header-behaviors.js HIDE_DELTA);
  // the menu goes with it rather than hanging in the air.
  window.addEventListener("scroll", () => {
    if (current && Math.abs(window.scrollY - openedAtY) > 10) close();
  }, { passive: true });
  // Opening from the keyboard while the bar is hidden brings it back with a
  // slide; follow it to where it stops.
  header.addEventListener("transitionend", () => { if (current) place(); });
  window.addEventListener("resize", () => {
    if (!current) return;
    if (DESKTOP.matches) place(); else close();
  });

  // ── 2. Read ─────────────────────────────────────────────────────────

  const keyMeta = document.querySelector('meta[name="ghost-content-api-key"]');
  const API_KEY = keyMeta ? keyMeta.getAttribute("content") : "";
  const API_BASE = `${window.location.origin}/ghost/api/content/posts/`;
  const BASE_FILTER = "tag:-hash-event+tag:-hash-podcast-transcript";
  const sets = Object.create(null); // name -> Promise<posts[]>

  const index = mega.querySelector("[data-mm-index]");
  const indexLinks = index ? Array.prototype.slice.call(index.querySelectorAll("a[data-mm-set]")) : [];
  const rowsEl = mega.querySelector("[data-mm-rows]");
  const leadEl = mega.querySelector("[data-mm-lead]");
  const setTitle = mega.querySelector("[data-mm-set-title]");
  const setMore = mega.querySelector("[data-mm-set-more]");
  let shownSet = "latest";

  function fetchSet(name) {
    if (sets[name]) return sets[name];
    if (!API_KEY) return Promise.resolve([]);
    let filter = BASE_FILTER;
    if (name === "must") filter = `featured:true+${BASE_FILTER}`;
    else if (name !== "latest") filter = `tag:${name}+${BASE_FILTER}`;
    const url = `${API_BASE}?key=${encodeURIComponent(API_KEY)}&limit=5&include=tags,authors`
      + `&fields=id,url,title,feature_image&filter=${encodeURIComponent(filter)}`;
    sets[name] = fetch(url, { cache: "default" })
      .then((r) => {
        if (r.ok) return r.json();
        delete sets[name];
        return { posts: [] };
      })
      .then((d) => { return Array.isArray(d.posts) ? d.posts : []; })
      .catch(() => { delete sets[name]; return []; });
    return sets[name];
  }

  function loadEssays() {
    fetchSet("latest");
    fetchSet("must");
    showSet(shownSet);
  }

  function byline(post) {
    const names = (post.tags || [])
      .filter((t) => { return t.slug && t.slug.indexOf("author-") === 0; })
      .map((t) => { return t.name; });
    if (names.length) return names.join(" and ");
    const a = post.authors && post.authors[0];
    return a ? a.name : "";
  }

  // Ask the image host for a small copy: Ghost storage takes a /size/
  // segment, Unsplash a w= parameter. Anything else is left alone.
  function sized(src, w) {
    if (!src) return "";
    if (src.indexOf("/content/images/") !== -1 && src.indexOf("/size/") === -1) {
      return src.replace("/content/images/", `/content/images/size/w${w}/`);
    }
    if (src.indexOf("images.unsplash.com") !== -1) {
      return src.replace(/([?&])w=\d+/, `$1w=${w}`);
    }
    return src;
  }

  // API values go into the page as text and through MOSafeHref (boot.min.js,
  // loaded in <head>), never as markup: a URL is only ever an http(s) link.
  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }
  function safeHref(a, url) {
    if (window.MOSafeHref) window.MOSafeHref.set(a, url, "/archive/");
    else a.href = /^https?:\/\//.test(url || "") ? url : "/archive/";
  }
  function safeSrc(url) {
    if (!url) return "";
    if (window.MOSafeHref) return window.MOSafeHref.sanitize(url, "");
    return /^https:\/\//.test(url) ? url : "";
  }
  function plate(src, lazy) {
    const wrap = el("div", "mm-plate");
    const img = el("img");
    img.src = src;
    img.alt = "";
    if (lazy) img.loading = "lazy";
    wrap.appendChild(img);
    return wrap;
  }

  function showSet(name) {
    shownSet = name;
    const link = indexLinks.find((a) => { return a.getAttribute("data-mm-set") === name; });
    if (!link) return;
    indexLinks.forEach((a) => { a.setAttribute("aria-current", a === link ? "true" : "false"); });
    const all = name === "latest" || name === "must";
    if (setTitle) setTitle.textContent = link.textContent;
    if (setMore) {
      setMore.href = all ? "/archive/" : link.getAttribute("href");
      setMore.textContent = all ? "All essays" : `All in ${link.textContent}`;
    }
    fetchSet(name).then((posts) => {
      if (shownSet !== name) return;
      const lead = posts[0];
      leadEl.textContent = "";
      rowsEl.textContent = "";
      if (lead) {
        const a = el("a", "mm-feature mm-swap");
        safeHref(a, lead.url);
        const src = safeSrc(sized(lead.feature_image, 600));
        if (src) a.appendChild(plate(src, false));
        a.appendChild(el("p", "mm-feature-title", lead.title));
        a.appendChild(el("div", "mm-by", byline(lead)));
        leadEl.appendChild(a);
      }
      posts.slice(1, 5).forEach((p) => {
        const li = el("li", "mm-swap");
        const a = el("a", "mm-row");
        safeHref(a, p.url);
        const src = safeSrc(sized(p.feature_image, 150));
        a.appendChild(src ? plate(src, true) : el("div", "mm-plate"));
        const text = el("div");
        text.appendChild(el("div", "mm-row-title", p.title));
        text.appendChild(el("div", "mm-row-by", byline(p)));
        a.appendChild(text);
        li.appendChild(a);
        rowsEl.appendChild(li);
      });
    });
  }

  indexLinks.forEach((a) => {
    const name = a.getAttribute("data-mm-set");
    a.addEventListener("mouseenter", () => { showSet(name); });
    a.addEventListener("focus", () => { showSet(name); });
  });

  // ── 3. Listen ───────────────────────────────────────────────────────

  const FEED_URL = document.body.getAttribute("data-podcast-feed-url") || "";
  let episodesLoaded = false;

  function showUrl(slug) {
    return slug === "daily-liturgy" ? "/daily-liturgy/" : `/podcasts/${slug}/`;
  }

  function epMeta(slug, ep) {
    const mins = Math.round((Number(ep.duration) || 0) / 60);
    const date = new Date(ep.pubDate);
    let day = "";
    // The Daily Liturgy's titles are already the date.
    if (slug !== "daily-liturgy" && !isNaN(date)) {
      const opts = { month: "short", day: "numeric" };
      if (date.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
      day = date.toLocaleDateString("en-US", opts);
    }
    return [day, mins ? `${mins} min` : ""].filter(Boolean).join(" · ");
  }

  function renderEpisodes(bySlug) {
    mega.querySelectorAll("[data-mm-show]").forEach((el) => {
      const slug = el.getAttribute("data-mm-show");
      const eps = bySlug[slug];
      if (!eps || !eps.length) return;
      const list = el.querySelector(".mm-eps");
      list.innerHTML = eps.slice(0, 2).map((ep) => {
        const href = slug === "daily-liturgy" ? showUrl(slug) : `${showUrl(slug)}#ep-${encodeURIComponent(ep.id)}`;
        return `<li><a href="${esc(href)}"><span class="mm-ep-title">${esc(ep.title)}</span>`
          + `<span class="mm-ep-meta">${esc(epMeta(slug, ep))}</span></a></li>`;
      }).join("");
    });
  }

  function loadEpisodes() {
    if (episodesLoaded || !FEED_URL) return;
    episodesLoaded = true;
    const get = (q) => {
      return fetch(FEED_URL + q, { cache: "default" }).then((r) => {
        return r.ok ? r.json() : Promise.reject(new Error(String(r.status)));
      });
    };
    const firsts = Array.prototype.map.call(mega.querySelectorAll("[data-mm-show][data-mm-first]"), (el) => {
      return el.getAttribute("data-mm-show");
    });
    // The worker's limit tops out at 20, which covers a closed series.
    Promise.all([get("")].concat(firsts.map((s) => {
      return get(`?show=${encodeURIComponent(s)}&limit=20`).catch(() => { return null; });
    }))).then((results) => {
      const all = results[0] || {};
      const bySlug = {};
      Object.keys(all).forEach((k) => { bySlug[k] = (all[k] && all[k].episodes) || []; });
      firsts.forEach((slug, i) => {
        const d = results[i + 1];
        const eps = d && d[slug] && d[slug].episodes;
        if (eps && eps.length) bySlug[slug] = eps.slice(-2).reverse();
      });
      renderEpisodes(bySlug);
    }).catch(() => { episodesLoaded = false; });
  }

  // ── 4. Phone drawer ─────────────────────────────────────────────────

  const drawerList = document.querySelector("#mobile-nav .mobile-nav-links");
  if (drawerList) {
    const CARET = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
    const sections = triggers.map((t, n) => {
      const name = t.getAttribute("data-mm-trigger");
      const panel = panels.find((p) => { return p.getAttribute("data-mm-panel") === name; });
      if (!panel) return "";
      const seen = Object.create(null);
      const links = Array.prototype.map.call(
        panel.querySelectorAll(".mm-links a, .mm-index a, .mm-show > a.mm-row, .mm-feature > .btn:not(.btn-solid), a.mm-feature"),
        (a) => {
          const href = a.getAttribute("href");
          const titleEl = a.querySelector(".mm-row-title, .mm-col-title");
          let label = titleEl ? titleEl.textContent : "";
          if (!label) {
            const text = Array.prototype.find.call(a.childNodes, (c) => { return c.nodeType === 3 && c.textContent.trim(); });
            label = text ? text.textContent : "";
          }
          label = label.trim();
          // A feature with no label of its own (About's picture) repeats a
          // link already in the list.
          if (!label || seen[`${href}|${label}`]) return "";
          seen[`${href}|${label}`] = true;
          return `<a href="${esc(href)}">${esc(label)}</a>`;
        },
      ).join("");
      const id = `mm-acc-${n}`;
      return `<div class="mm-acc"><button type="button" class="mm-acc-btn" aria-expanded="false" aria-controls="${id}">${esc(t.textContent.trim())}${CARET}</button>`
        + `<div class="mm-acc-body" id="${id}" hidden>${links}</div></div>`;
    }).join("");
    drawerList.removeAttribute("data-nav-dropdowns");
    drawerList.classList.add("mm-drawer");
    drawerList.innerHTML = sections;
    drawerList.querySelectorAll(".mm-acc-btn").forEach((b) => {
      b.addEventListener("click", () => {
        const on = b.getAttribute("aria-expanded") !== "true";
        b.setAttribute("aria-expanded", on ? "true" : "false");
        document.getElementById(b.getAttribute("aria-controls")).hidden = !on;
      });
    });
  }
}());
