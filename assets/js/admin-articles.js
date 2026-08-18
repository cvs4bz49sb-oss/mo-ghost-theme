/*
 * /admin/articles/ — Article Performance.
 *
 * Renders a skeleton the template shipped empty. Every number comes from
 * mo-admin GET /articles, which verifies the caller against the live Ghost
 * staff list and omits the signup and conversion fields for anyone without
 * the members tool. Nothing is inlined in the page.
 *
 * Design notes worth keeping:
 *  - Six columns by default. The request was for nine, but four of them are
 *    nested subsets of one another and read as four findings when they are
 *    one. The rest live in the row expansion.
 *  - The verdict column is the point. Numbers say what happened; the verdict
 *    says which lever it implies.
 *  - A cell is never a bare 0 when the truth is "not measurable". Three
 *    distinct marks, explained in the on-page key rather than a title
 *    attribute, which is undiscoverable and dead on touch.
 */
(function () {
  const root = document.querySelector("[data-articles]");
  if (!root) return;

  const WORKER = (root.getAttribute("data-worker-url") || "").replace(/\/+$/, "");
  const tableHost = root.querySelector("[data-art-table]");
  const statsHost = root.querySelector("[data-art-stats]");
  const periodHost = root.querySelector("[data-art-periods]");
  const statusEl = root.querySelector("[data-art-status]");
  const keyEl = root.querySelector("[data-art-key]");
  const footEl = root.querySelector("[data-art-foot]");
  const stampEl = root.querySelector("[data-art-stamp]");

  const PERIODS = [
    { key: "30d", label: "Last 30 days" },
    { key: "90d", label: "Last 90 days" },
    { key: "180d", label: "Last 6 months" },
    { key: "365d", label: "Last year" },
  ];
  let period = "90d";
  let DATA = null;
  let sort = { col: "published", dir: "desc" };
  const expanded = {};
  // Paged in the browser, not the worker: the endpoint already returns the
  // whole window in one response, so paging is instant and a sort still
  // orders every piece rather than only the 25 currently on screen.
  const PAGE_SIZE = 25;
  let page = 0;

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }
  function say(msg) { if (statusEl) statusEl.textContent = msg || ""; }
  const num = (v) => (v === null || v === undefined ? null : v);
  const fmt = (v) => (v === null || v === undefined ? "·" : v.toLocaleString());
  const fmtRate = (v) => (v === null || v === undefined ? "·" : String(v));

  // Columns. `get` returns null for "not measurable", which is what sinks a
  // row rather than letting it sort as a zero.
  const COLS = [
    { key: "published", label: "Published", hint: "newest first", num: false,
      get: (r) => Date.parse(r.publishedAt) || 0 },
    { key: "verdict", label: "Verdict", hint: "what to do about it", num: false,
      get: (r) => r.verdict && r.verdict.label },
    { key: "views", label: "Views", hint: "page views", num: true, get: (r) => num(r.views) },
    { key: "readers", label: "Readers", hint: "unique visitors", num: true, get: (r) => num(r.readers) },
    { key: "signups", label: "Subscribed", hint: "free signups credited here", num: true, get: (r) => num(r.signups) },
    { key: "conversions", label: "Upgraded", hint: "paid conversions credited here", num: true, get: (r) => num(r.conversions) },
  ];

  function sortedRows() {
    const col = COLS.find((c) => c.key === sort.col) || COLS[0];
    const rows = DATA.rows.slice();
    const dir = sort.dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      // Immature posts sink in every METRIC ordering — their counts are real
      // but incomplete, and letting them rank would put a two-day-old piece
      // at the bottom of a list it has not finished competing in. Sorting by
      // date is the exception: there, being newest IS the question.
      if (col.key !== "published") {
        if (a.immature !== b.immature) return a.immature ? 1 : -1;
      }
      const av = col.get(a);
      const bv = col.get(b);
      const an = av === null || av === undefined;
      const bn = bv === null || bv === undefined;
      if (an && bn) return 0;
      // Unmeasurable is always last, in both directions.
      if (an) return 1;
      if (bn) return -1;
      if (typeof av === "string") return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
    return rows;
  }

  function renderPeriods() {
    if (!periodHost || periodHost.childElementCount) return;
    PERIODS.forEach((p) => {
      const b = el("button", `admin-period-option${p.key === period ? " is-active" : ""}`, p.label);
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", p.key === period ? "true" : "false");
      b.addEventListener("click", () => {
        if (period === p.key) return;
        period = p.key;
        page = 0;
        [].forEach.call(periodHost.children, (c) => {
          const on = c === b;
          c.classList.toggle("is-active", on);
          c.setAttribute("aria-selected", on ? "true" : "false");
        });
        load();
      });
      periodHost.appendChild(b);
    });
  }

  function renderStats() {
    statsHost.textContent = "";
    const t = DATA.totals || {};
    const items = [
      ["Pieces", t.posts],
      ["Views", t.views],
    ];
    if (DATA.canSeeMembers) {
      items.push(["Subscribed", t.signups]);
      items.push(["Upgraded", t.conversions]);
    }
    items.forEach(([label, v]) => {
      const li = el("li", "admin-stat");
      li.appendChild(el("div", "admin-stat-value", v === null || v === undefined ? "·" : v.toLocaleString()));
      li.appendChild(el("div", "admin-stat-label", label));
      statsHost.appendChild(li);
    });
  }

  function renderKey() {
    keyEl.textContent = "";
    const parts = [
      ["still accumulating", `published less than ${DATA.maturityDays} days ago, so the counts are real but the rates are not judged yet`],
      ["too little traffic to judge", `under ${DATA.viewFloor} views, where one signup swings a rate more than a real difference would`],
      ["·", "not measurable, which is not the same as zero"],
    ];
    parts.forEach(([term, meaning], i) => {
      if (i) keyEl.appendChild(el("span", "art-key-sep", " · "));
      const b = el("strong", "art-key-term", term);
      keyEl.appendChild(b);
      keyEl.appendChild(el("span", "art-key-meaning", ` ${meaning}`));
    });
  }

  function detailRow(r, colspan) {
    const tr = el("tr", "art-detail");
    const td = el("td");
    td.setAttribute("colspan", String(colspan));
    const dl = el("div", "art-detail-grid");
    const add = (label, value) => {
      const w = el("div", "art-detail-item");
      w.appendChild(el("span", "art-detail-label", label));
      w.appendChild(el("span", "art-detail-value", value));
      dl.appendChild(w);
    };
    add("Age", `${r.ageDays} days`);
    add("Visibility", r.visibility === "public" ? "Public" : r.visibility);
    if (DATA.canSeeMembers) {
      add("Signups per 1k views", fmtRate(r.signupPer1k));
      add("Upgrades per 1k views", fmtRate(r.convPer1k));
    }
    if (r.verdict && r.verdict.hint) add("Why", r.verdict.hint);
    td.appendChild(dl);
    tr.appendChild(td);
    return tr;
  }

  function pager(total, pages) {
    const bar = el("div", "aud-controls art-pager");
    const prev = el("button", "kpi-btn", "Previous");
    prev.type = "button";
    prev.disabled = page === 0;
    prev.addEventListener("click", () => {
      if (page === 0) return;
      page -= 1;
      renderTable();
      tableHost.scrollIntoView({ block: "start" });
    });
    const next = el("button", "kpi-btn", "Next");
    next.type = "button";
    next.disabled = page >= pages - 1;
    next.addEventListener("click", () => {
      if (page >= pages - 1) return;
      page += 1;
      renderTable();
      // Otherwise the next page opens wherever the last one ended, which on
      // a phone is 25 cards below its own first row.
      tableHost.scrollIntoView({ block: "start" });
    });
    const from = total ? page * PAGE_SIZE + 1 : 0;
    const to = Math.min((page + 1) * PAGE_SIZE, total);
    bar.appendChild(prev);
    bar.appendChild(next);
    bar.appendChild(el("span", "aud-legend", `${from}\u2013${to} of ${total}`));
    return bar;
  }

  function renderTable() {
    tableHost.textContent = "";
    const all = sortedRows();
    if (!all.length) {
      tableHost.appendChild(el("p", "admin-sub", "Nothing published in this window."));
      return;
    }
    const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    if (page > pages - 1) page = pages - 1;
    const rows = all.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    if (pages > 1) tableHost.appendChild(pager(all.length, pages));
    const cols = COLS.filter((c) => DATA.canSeeMembers || (c.key !== "signups" && c.key !== "conversions"));

    const wrap = el("div", "aud-tablewrap art-tablewrap");
    const t = el("table", "aud-table art-table");
    const thead = el("thead");
    const hr = el("tr");
    const artTh = el("th", "aud-th-sort");
    artTh.setAttribute("scope", "col");
    artTh.appendChild(el("span", "aud-th-band", "Article"));
    hr.appendChild(artTh);
    cols.forEach((c) => {
      const th = el("th", `aud-th-sort${sort.col === c.key ? " is-sorted" : ""}${c.num ? " aud-th-right" : ""}`);
      th.setAttribute("scope", "col");
      th.setAttribute("aria-sort", sort.col === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none");
      const b = el("button", "aud-th-btn");
      b.type = "button";
      b.setAttribute("data-art-sort", c.key);
      b.appendChild(el("span", "aud-th-band", c.label));
      b.appendChild(el("span", "aud-th-n", c.hint));
      if (sort.col === c.key) b.appendChild(el("span", "aud-th-caret", sort.dir === "asc" ? "↑" : "↓"));
      b.setAttribute("aria-label", `Sort by ${c.label}`);
      b.addEventListener("click", () => {
        const keepLeft = wrap.scrollLeft;
        if (sort.col === c.key) sort.dir = sort.dir === "asc" ? "desc" : "asc";
        else sort = { col: c.key, dir: c.num || c.key === "published" ? "desc" : "asc" };
        // A re-sort makes the old page number meaningless.
        page = 0;
        renderTable();
        // Rebuilding the table resets the horizontal scroller, which on a
        // phone snaps the view back to column one and makes the sort look
        // like it did nothing.
        const w2 = tableHost.querySelector(".art-tablewrap");
        if (w2) w2.scrollLeft = keepLeft;
        const again = tableHost.querySelector(`[data-art-sort="${c.key}"]`);
        if (again) again.focus();
      });
      th.appendChild(b);
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    t.appendChild(thead);

    const tb = el("tbody");
    rows.forEach((r) => {
      const tr = el("tr", r.immature ? "art-immature" : null);
      const th = el("th", "aud-rowhead art-title");
      th.setAttribute("scope", "row");
      const toggle = el("button", "art-toggle");
      toggle.type = "button";
      toggle.setAttribute("aria-expanded", expanded[r.id] ? "true" : "false");
      toggle.setAttribute("aria-label", `Show the working for ${r.title}`);
      toggle.textContent = expanded[r.id] ? "−" : "+";
      toggle.addEventListener("click", () => { expanded[r.id] = !expanded[r.id]; renderTable(); });
      const a = el("a", "art-title-link", r.title);
      // Non-literal href: routed through the theme's allowlist helper rather
      // than assigned directly.
      if (window.MOSafeHref) window.MOSafeHref.set(a, r.url);
      else a.setAttribute("href", r.url);
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener");
      const meta = el("span", "art-title-meta", `${(r.publishedAt || "").slice(0, 10)} · ${r.ageDays}d old`);
      const stack = el("span", "art-title-stack");
      stack.appendChild(a);
      stack.appendChild(meta);
      th.appendChild(toggle);
      th.appendChild(stack);
      tr.appendChild(th);

      cols.forEach((c) => {
        const td = el("td", c.num ? "aud-num" : null);
        td.setAttribute("data-label", c.label);
        if (c.key === "published") {
          td.textContent = (r.publishedAt || "").slice(0, 10);
        } else if (c.key === "verdict") {
          const v = r.verdict || { key: "", label: "·" };
          td.appendChild(el("span", `art-verdict art-v-${v.key}`, v.label));
        } else {
          td.textContent = fmt(r[c.key]);
        }
        tr.appendChild(td);
      });
      tb.appendChild(tr);
      if (expanded[r.id]) tb.appendChild(detailRow(r, cols.length + 1));
    });
    t.appendChild(tb);
    wrap.appendChild(t);
    tableHost.appendChild(wrap);
    if (pages > 1) tableHost.appendChild(pager(all.length, pages));
  }

  function renderFoot() {
    footEl.textContent = "";
    const bits = [];
    bits.push("Views and readers come from Plausible page data, counted over the same window the period selector picks, so a piece cannot borrow traffic from before it existed.");
    if (DATA.canSeeMembers) {
      bits.push("Subscribed and Upgraded are Ghost's own attribution, which is LAST TOUCH: it credits the last page someone was on before joining, which is not always the piece that persuaded them.");
    }
    bits.push(`Anything published in the last ${DATA.maturityDays} days is marked as still accumulating and sinks to the bottom of any sort by a number, because its counts are not finished.`);
    if (DATA.sources && DATA.sources.plausible !== "ok") {
      bits.push("Traffic data did not load on this request, so the view columns are blank rather than zero.");
    }
    footEl.textContent = bits.join(" ");
  }

  function renderAll() {
    renderStats();
    renderKey();
    renderTable();
    renderFoot();
    if (stampEl) {
      const when = DATA.cachedAt || DATA.generatedAt;
      stampEl.textContent = when ? `As of ${new Date(when).toLocaleString()}` : "";
    }
  }

  function load() {
    say("Loading…");
    tableHost.textContent = "";
    tableHost.appendChild(el("p", "admin-sub", "Loading article performance…"));
    window.MOAuth.fetch(`${WORKER}/articles?period=${encodeURIComponent(period)}`)
      .then((res) => {
        if (res.status === 401 || res.status === 403) throw new Error("forbidden");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((d) => {
        if (d.error) throw new Error(d.error);
        DATA = d;
        say("");
        renderAll();
      })
      .catch((err) => {
        tableHost.textContent = "";
        say("");
        tableHost.appendChild(el("p", "admin-sub", err && err.message === "forbidden"
          ? "You don't have permission to view article performance."
          : "Couldn't load article performance. Nothing else on this page is affected."));
      });
  }

  if (!WORKER || !window.MOAuth) {
    tableHost.appendChild(el("p", "admin-sub", "This page needs the admin worker."));
    return;
  }
  renderPeriods();
  load();
})();
