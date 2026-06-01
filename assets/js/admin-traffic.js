/*
 * /admin/traffic/ hydration.
 *
 * Fetches from mo-admin worker /traffic/* endpoints and renders:
 *   - Summary stats (visitors, pageviews, visit duration, bounce)
 *   - Visitors-per-day sparkline SVG
 *   - Top articles, topics, contributors
 *   - Top pages + top sources (split)
 *   - Top countries (grid), then top states + top cities (split)
 * Every ranked list is capped at 10 entries.
 *
 * Period buttons at the top re-fetch everything with the selected
 * period param ("7d", "30d", "month", "6mo", "12mo"). Worker passes
 * the string straight through to Plausible.
 */
(function () {
  const root = document.querySelector("[data-admin-traffic]");
  if (!root) return;

  const worker = (root.getAttribute("data-worker-url") || "").trim().replace(/\/$/, "");

  if (!worker) {
    setEmpty("[data-chart-placeholder]", "Admin worker URL not configured.");
    setEmpty("[data-pages-placeholder]", "");
    setEmpty("[data-sources-placeholder]", "");
    setEmpty("[data-countries-placeholder]", "");
    return;
  }

  let period = "30d";

  // Period selector.
  root.querySelectorAll(".admin-period-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      period = btn.getAttribute("data-period");
      root.querySelectorAll(".admin-period-option").forEach((b) => {
        b.classList.toggle("is-active", b === btn);
        b.setAttribute("aria-selected", b === btn ? "true" : "false");
      });
      hydrate();
    });
  });

  hydrate();

  function hydrate() {
    // Reset placeholders.
    setEmpty("[data-chart-placeholder]", "Loading…");
    fill("[data-admin-top-articles]", '<li class="admin-empty">Loading…</li>');
    fill("[data-admin-top-topics]", '<li class="admin-empty">Loading…</li>');
    fill("[data-admin-top-authors]", '<li class="admin-empty">Loading…</li>');
    fill("[data-admin-top-pages]", '<li class="admin-empty">Loading…</li>');
    fill("[data-admin-top-sources]", '<li class="admin-empty">Loading…</li>');
    fill("[data-admin-top-countries]", '<li class="admin-empty">Loading…</li>');
    fill("[data-admin-top-regions]", '<li class="admin-empty">Loading…</li>');
    fill("[data-admin-top-cities]", '<li class="admin-empty">Loading…</li>');
    root.querySelectorAll('[data-stat]').forEach((el) => { el.textContent = "…"; });

    api("/traffic/summary").then((res) => {
      if (!res) return setStatErr();
      if (res.forbidden) return showForbidden();
      fillSummary(res.body);
    });
    api("/traffic/timeseries").then((res) => {
      if (!res) return setEmpty("[data-chart-placeholder]", "Couldn't load timeseries.");
      if (res.forbidden) return showForbidden();
      fillChart(res.body);
    });
    api("/traffic/top-articles?limit=10").then((res) => {
      if (!res) return fill("[data-admin-top-articles]", '<li class="admin-empty">Couldn’t load articles.</li>');
      if (res.forbidden) return showForbidden();
      fillArticles(res.body);
    });
    api("/traffic/top-topics?limit=10").then((res) => {
      if (!res) return fill("[data-admin-top-topics]", '<li class="admin-empty">Couldn’t load topics.</li>');
      if (res.forbidden) return showForbidden();
      fillTopics(res.body);
    });
    api("/traffic/top-authors?limit=10").then((res) => {
      if (!res) return fill("[data-admin-top-authors]", '<li class="admin-empty">Couldn’t load contributors.</li>');
      if (res.forbidden) return showForbidden();
      fillAuthors(res.body);
    });
    api("/traffic/top-pages?limit=10").then((res) => {
      if (!res) return fill("[data-admin-top-pages]", '<li class="admin-empty">Couldn’t load pages.</li>');
      if (res.forbidden) return showForbidden();
      fillPages(res.body);
    });
    api("/traffic/top-sources?limit=10").then((res) => {
      if (!res) return fill("[data-admin-top-sources]", '<li class="admin-empty">Couldn’t load sources.</li>');
      if (res.forbidden) return showForbidden();
      fillSources(res.body);
    });
    api("/traffic/top-countries?limit=10").then((res) => {
      if (!res) return fill("[data-admin-top-countries]", '<li class="admin-empty">Couldn’t load countries.</li>');
      if (res.forbidden) return showForbidden();
      fillCountries(res.body);
    });
    api("/traffic/top-regions?limit=10").then((res) => {
      if (!res) return fill("[data-admin-top-regions]", '<li class="admin-empty">Couldn’t load states.</li>');
      if (res.forbidden) return showForbidden();
      fillRegions(res.body);
    });
    api("/traffic/top-cities?limit=10").then((res) => {
      if (!res) return fill("[data-admin-top-cities]", '<li class="admin-empty">Couldn’t load cities.</li>');
      if (res.forbidden) return showForbidden();
      fillCities(res.body);
    });
  }

  function api(path) {
    const sep = path.indexOf("?") > -1 ? "&" : "?";
    const url = `${worker + path + sep}period=${encodeURIComponent(period)}`;
    return window.MOAuth.fetch(url, { credentials: "omit" })
    .then((r) => {
      if (r.status === 401 || r.status === 403) return { forbidden: true };
      if (!r.ok) {
        console.error(`admin worker ${r.status} on ${path}`);
        return null;
      }
      return r.json().then((body) => { return { body }; });
    })
    .catch((err) => {
      console.error(`admin worker fetch failed on ${path}`, err);
      return null;
    });
  }

  function setStatErr() {
    root.querySelectorAll('[data-stat]').forEach((el) => { el.textContent = "—"; });
  }

  function showForbidden() {
    const body = root.querySelector(".container");
    if (!body) return;
    body.innerHTML =
      '<div class="admin-forbidden">' +
        '<p class="eyebrow">Staff only</p>' +
        '<h2 class="section-heading"><em>Not authorized.</em></h2>' +
        "<p>Your email isn't in the admin allowlist on mo-admin. Add it to <code>ADMIN_EMAILS</code> and redeploy, then reload.</p>" +
      '</div>';
  }

  // ---------------------------------------------------------------------------

  function fillSummary(data) {
    setStat("visitors", formatNumber(data.visitors));
    setStat("pageviews", formatNumber(data.pageviews));
    setStat("visit_duration", formatDuration(data.visit_duration_seconds));
    setStat("bounce_rate", `${data.bounce_rate != null ? data.bounce_rate : 0}%`);
  }

  function fillChart(payload) {
    const host = root.querySelector("[data-admin-chart]");
    if (!host) return;
    const series = (payload && payload.series) || [];
    if (!series.length) { host.innerHTML = '<p class="admin-empty">No data in this range.</p>'; return; }

    const max = series.reduce((m, d) => { return Math.max(m, d.visitors || 0); }, 0) || 1;
    // Round max up to a nice value so y-axis ticks land on readable
    // numbers (10, 25, 50, 100, 250, ...) instead of the raw peak.
    const niceMax = niceCeil(max);
    const W = 640, H = 160, P = 8;
    const innerW = W - P * 2, innerH = H - P * 2;
    const step = series.length > 1 ? innerW / (series.length - 1) : 0;

    const points = series.map((d, i) => {
      const x = P + i * step;
      const y = P + innerH - ((d.visitors || 0) / niceMax) * innerH;
      return `${x},${y.toFixed(1)}`;
    }).join(" ");

    const area = `M${P},${P + innerH} L${points.replace(/ /g, " L")} L${P + innerW},${P + innerH} Z`;

    const total = series.reduce((s, d) => { return s + (d.visitors || 0); }, 0);
    const pv = series.reduce((s, d) => { return s + (d.pageviews || 0); }, 0);

    // Y-axis ticks: 4 evenly-spaced values from niceMax down to 0.
    // Rendered as HTML spans alongside the SVG (not inside it) so
    // preserveAspectRatio="none" doesn't distort the text.
    const tickCount = 4;
    const tickValues = [];
    for (let t = 0; t < tickCount; t++) {
      tickValues.push(Math.round(niceMax * (tickCount - 1 - t) / (tickCount - 1)));
    }
    const yaxis = tickValues.map((v) => {
      return `<span>${formatNumber(v)}</span>`;
    }).join("");
    // Gridlines at each tick, subtle. Drawn inside the SVG because
    // they need to scale with the plot area.
    const gridlines = tickValues.map((v) => {
      const y = P + innerH - (v / niceMax) * innerH;
      return `<line x1="${P}" x2="${P + innerW}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" class="admin-chart-gridline"/>`;
    }).join("");

    // Per-day totals — one number per data point, rendered above the
    // chart in a grid that matches the x-axis date labels below.
    const values = series.map((d) => {
      return `<span>${formatNumber(d.visitors || 0)}</span>`;
    }).join("");

    // One date label per data point, formatted mm-dd-yyyy. Grid with
    // N columns so labels align with the chart's data points.
    // CSS rotates each label -55deg so long date strings don't
    // overlap at 30-day+ ranges.
    const labels = series.map((d) => {
      return `<span>${formatDateUS(d.date)}</span>`;
    }).join("");

    host.innerHTML =
      `<p class="admin-chart-summary"><strong>${formatNumber(total)}</strong> visitors${ 
      pv ? ` &middot; <strong>${formatNumber(pv)}</strong> pageviews` : '' 
      } over ${series.length} days.</p>` +
      `<div class="admin-chart-plot">` +
        `<div class="admin-chart-values" style="--days: ${series.length};">${values}</div>` +
        `<div class="admin-chart-canvas">` +
          `<div class="admin-chart-yaxis" aria-hidden="true">${yaxis}</div>` +
          `<svg class="admin-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Visitors per day">` +
            `<g class="admin-chart-gridlines">${gridlines}</g>` +
            `<path d="${area}" class="admin-chart-area"/>` +
            `<polyline points="${points}" class="admin-chart-line"/>` +
          `</svg>` +
        `</div>` +
        `<div class="admin-chart-days" style="--days: ${series.length};">${labels}</div>` +
      `</div>`;
  }

  // Round n up to a readable tick max (10, 25, 50, 100, 250, 500, 1k, …).
  // Keeps the y-axis landing on numbers you'd actually write down.
  function niceCeil(n) {
    if (n <= 1) return 1;
    const mag = 10**Math.floor(Math.log10(n));
    const rel = n / mag;
    if (rel <= 1) return mag;
    if (rel <= 2) return 2 * mag;
    if (rel <= 2.5) return 2.5 * mag;
    if (rel <= 5) return 5 * mag;
    return 10 * mag;
  }

  function fillArticles(payload) {
    const articles = (payload && payload.articles) || [];
    if (!articles.length) return fill("[data-admin-top-articles]", '<li class="admin-empty">No article reads recorded in this range yet. Custom events start accumulating after a page view on a post with the new tracker.</li>');
    const max = articles[0].visitors || 1;
    fill("[data-admin-top-articles]", articles.map((a) => {
      const bar = Math.round(((a.visitors || 0) / max) * 100);
      return (
        `<li class="admin-ranked-item">` +
          `<div class="admin-ranked-bar" style="width: ${bar}%"></div>` +
          `<span class="admin-ranked-label">${escapeHtml(a.title)}</span>` +
          `<span class="admin-ranked-value">${formatNumber(a.visitors)}</span>` +
        `</li>`
      );
    }).join(""));
  }

  function fillTopics(payload) {
    const topics = (payload && payload.topics) || [];
    if (!topics.length) return fill("[data-admin-top-topics]", '<li class="admin-empty">No data yet.</li>');
    const max = topics[0].visitors || 1;
    fill("[data-admin-top-topics]", topics.map((t) => {
      const bar = Math.round(((t.visitors || 0) / max) * 100);
      return (
        `<li class="admin-ranked-item">` +
          `<div class="admin-ranked-bar" style="width: ${bar}%"></div>` +
          `<span class="admin-ranked-label">` +
            `<a href="/tag/${escapeAttr(t.slug)}/">${escapeHtml(t.name)}</a>` +
          `</span>` +
          `<span class="admin-ranked-value">${formatNumber(t.visitors)}</span>` +
        `</li>`
      );
    }).join(""));
  }

  function fillAuthors(payload) {
    const authors = (payload && payload.authors) || [];
    if (!authors.length) return fill("[data-admin-top-authors]", '<li class="admin-empty">No data yet.</li>');
    const max = authors[0].visitors || 1;
    fill("[data-admin-top-authors]", authors.map((a) => {
      const bar = Math.round(((a.visitors || 0) / max) * 100);
      return (
        `<li class="admin-ranked-item">` +
          `<div class="admin-ranked-bar" style="width: ${bar}%"></div>` +
          `<span class="admin-ranked-label">` +
            `<a href="/author/${escapeAttr(a.slug)}/">${escapeHtml(a.name)}</a>` +
          `</span>` +
          `<span class="admin-ranked-value">${formatNumber(a.visitors)}</span>` +
        `</li>`
      );
    }).join(""));
  }

  function fillPages(payload) {
    const pages = (payload && payload.pages) || [];
    if (!pages.length) return fill("[data-admin-top-pages]", '<li class="admin-empty">No data.</li>');
    const max = pages[0].visitors || 1;
    fill("[data-admin-top-pages]", pages.map((p) => {
      const bar = Math.round(((p.visitors || 0) / max) * 100);
      // Plausible returns paths like "/some/article/". Reject anything
      // not strictly path-shaped so a polluted upstream can't render
      // an unsafe href into the admin UI. (Codex audit 2026-05-11:
      // "Admin traffic page renders upstream page values directly
      // into href".) escapeAttr alone wouldn't stop a javascript:
      // value — escapes special chars but doesn't validate scheme.
      const safePath = safeAdminPath(p.page);
      return (
        `<li class="admin-ranked-item">` +
          `<div class="admin-ranked-bar" style="width: ${bar}%"></div>` +
          `<span class="admin-ranked-label">` +
            `<a href="${escapeAttr(safePath)}">${escapeHtml(p.page)}</a>` +
          `</span>` +
          `<span class="admin-ranked-value">${formatNumber(p.visitors)}</span>` +
        `</li>`
      );
    }).join(""));
  }

  // Strict path-only validator for upstream-supplied page values.
  // Accepts "/some/path" or "/some/path?query". Rejects absolute URLs,
  // protocol-relative URLs, javascript:, data:, fragments without a
  // leading slash, etc. Returns "#" for anything that doesn't match,
  // which keeps the link clickable (no-op) without breaking the row.
  function safeAdminPath(value) {
    if (typeof value !== "string" || !value) return "#";
    if (value.charAt(0) !== "/") return "#";
    // Reject protocol-relative ("//attacker.com") and the backslash
    // variant some browsers historically normalized into //.
    if (value.length >= 2 && (value.charAt(1) === "/" || value.charAt(1) === "\\")) return "#";
    // Reject anything containing a colon — paths don't carry schemes.
    if (value.indexOf(":") !== -1) return "#";
    return value;
  }

  function fillSources(payload) {
    const sources = (payload && payload.sources) || [];
    if (!sources.length) return fill("[data-admin-top-sources]", '<li class="admin-empty">No data.</li>');
    const max = sources[0].visitors || 1;
    fill("[data-admin-top-sources]", sources.map((s) => {
      const bar = Math.round(((s.visitors || 0) / max) * 100);
      return (
        `<li class="admin-ranked-item">` +
          `<div class="admin-ranked-bar" style="width: ${bar}%"></div>` +
          `<span class="admin-ranked-label">${escapeHtml(s.source)}</span>` +
          `<span class="admin-ranked-value">${formatNumber(s.visitors)}</span>` +
        `</li>`
      );
    }).join(""));
  }

  function fillCountries(payload) {
    const countries = (payload && payload.countries) || [];
    if (!countries.length) return fill("[data-admin-top-countries]", '<li class="admin-empty">No data.</li>');
    const max = countries[0].visitors || 1;
    fill("[data-admin-top-countries]", countries.map((c) => {
      const bar = Math.round(((c.visitors || 0) / max) * 100);
      return (
        `<li class="admin-ranked-item">` +
          `<div class="admin-ranked-bar" style="width: ${bar}%"></div>` +
          `<span class="admin-ranked-label">${escapeHtml(c.country)}</span>` +
          `<span class="admin-ranked-value">${formatNumber(c.visitors)}</span>` +
        `</li>`
      );
    }).join(""));
  }

  function fillRegions(payload) {
    const regions = (payload && payload.regions) || [];
    if (!regions.length) return fill("[data-admin-top-regions]", '<li class="admin-empty">No data.</li>');
    const max = regions[0].visitors || 1;
    fill("[data-admin-top-regions]", regions.map((r) => {
      const bar = Math.round(((r.visitors || 0) / max) * 100);
      return (
        `<li class="admin-ranked-item">` +
          `<div class="admin-ranked-bar" style="width: ${bar}%"></div>` +
          `<span class="admin-ranked-label">${escapeHtml(r.region)}</span>` +
          `<span class="admin-ranked-value">${formatNumber(r.visitors)}</span>` +
        `</li>`
      );
    }).join(""));
  }

  function fillCities(payload) {
    const cities = (payload && payload.cities) || [];
    if (!cities.length) return fill("[data-admin-top-cities]", '<li class="admin-empty">No data.</li>');
    const max = cities[0].visitors || 1;
    fill("[data-admin-top-cities]", cities.map((c) => {
      const bar = Math.round(((c.visitors || 0) / max) * 100);
      return (
        `<li class="admin-ranked-item">` +
          `<div class="admin-ranked-bar" style="width: ${bar}%"></div>` +
          `<span class="admin-ranked-label">${escapeHtml(c.city)}</span>` +
          `<span class="admin-ranked-value">${formatNumber(c.visitors)}</span>` +
        `</li>`
      );
    }).join(""));
  }

  // ---------------------------------------------------------------------------
  function setStat(key, value) {
    const el = root.querySelector(`[data-stat="${key}"]`);
    if (el) el.textContent = value;
  }
  function setEmpty(sel, msg) {
    const el = root.querySelector(sel);
    if (el) el.textContent = msg;
  }
  function fill(sel, html) {
    const el = root.querySelector(sel);
    if (el) el.innerHTML = html;
  }
  function formatNumber(n) {
    if (typeof n !== "number") return String(n || "—");
    return n.toLocaleString("en-US");
  }
  // mm-dd-yyyy from Plausible's ISO "YYYY-MM-DD"
  function formatDateUS(iso) {
    if (!iso) return "";
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return iso;
    return `${m[2]}-${m[3]}-${m[1]}`;
  }
  function formatDuration(s) {
    s = Math.round(s || 0);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${(m ? `${m}m ` : "") + sec}s`;
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function escapeAttr(s) {
    return escapeHtml(s);
  }
})();
