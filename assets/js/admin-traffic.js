/*
 * /admin/traffic/ hydration.
 *
 * Fetches from mo-admin worker /traffic/* endpoints and renders:
 *   - Summary stats (visitors, pageviews, visit duration, bounce)
 *   - Visitors-per-day sparkline SVG
 *   - Top pages (left column)
 *   - Top sources (right column)
 *   - Top countries (grid)
 *
 * Period buttons at the top re-fetch everything with the selected
 * period param ("7d", "30d", "month", "6mo", "12mo"). Worker passes
 * the string straight through to Plausible.
 */
(function () {
  var root = document.querySelector("[data-admin-traffic]");
  if (!root) return;

  var worker = (root.getAttribute("data-worker-url") || "").trim().replace(/\/$/, "");
  var email = (root.getAttribute("data-member-email") || "").trim();

  if (!worker || !email) {
    setEmpty("[data-chart-placeholder]", "Admin worker URL not configured.");
    setEmpty("[data-pages-placeholder]", "");
    setEmpty("[data-sources-placeholder]", "");
    setEmpty("[data-countries-placeholder]", "");
    return;
  }

  var period = "30d";

  // Period selector.
  root.querySelectorAll(".admin-period-option").forEach(function (btn) {
    btn.addEventListener("click", function () {
      period = btn.getAttribute("data-period");
      root.querySelectorAll(".admin-period-option").forEach(function (b) {
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
    root.querySelectorAll('[data-stat]').forEach(function (el) { el.textContent = "…"; });

    api("/traffic/summary").then(function (res) {
      if (!res) return setStatErr();
      if (res.forbidden) return showForbidden();
      fillSummary(res.body);
    });
    api("/traffic/timeseries").then(function (res) {
      if (!res) return setEmpty("[data-chart-placeholder]", "Couldn't load timeseries.");
      if (res.forbidden) return showForbidden();
      fillChart(res.body);
    });
    api("/traffic/top-articles?limit=20").then(function (res) {
      if (!res) return fill("[data-admin-top-articles]", '<li class="admin-empty">Couldn’t load articles.</li>');
      if (res.forbidden) return showForbidden();
      fillArticles(res.body);
    });
    api("/traffic/top-topics?limit=20").then(function (res) {
      if (!res) return fill("[data-admin-top-topics]", '<li class="admin-empty">Couldn’t load topics.</li>');
      if (res.forbidden) return showForbidden();
      fillTopics(res.body);
    });
    api("/traffic/top-authors?limit=20").then(function (res) {
      if (!res) return fill("[data-admin-top-authors]", '<li class="admin-empty">Couldn’t load contributors.</li>');
      if (res.forbidden) return showForbidden();
      fillAuthors(res.body);
    });
    api("/traffic/top-pages?limit=20").then(function (res) {
      if (!res) return fill("[data-admin-top-pages]", '<li class="admin-empty">Couldn’t load pages.</li>');
      if (res.forbidden) return showForbidden();
      fillPages(res.body);
    });
    api("/traffic/top-sources?limit=15").then(function (res) {
      if (!res) return fill("[data-admin-top-sources]", '<li class="admin-empty">Couldn’t load sources.</li>');
      if (res.forbidden) return showForbidden();
      fillSources(res.body);
    });
    api("/traffic/top-countries?limit=20").then(function (res) {
      if (!res) return fill("[data-admin-top-countries]", '<li class="admin-empty">Couldn’t load countries.</li>');
      if (res.forbidden) return showForbidden();
      fillCountries(res.body);
    });
  }

  function api(path) {
    var sep = path.indexOf("?") > -1 ? "&" : "?";
    var url = worker + path + sep + "email=" + encodeURIComponent(email) + "&period=" + encodeURIComponent(period);
    return fetch(url, { credentials: "omit" })
      .then(function (r) {
        if (r.status === 403) return { forbidden: true };
        if (!r.ok) {
          console.error("admin worker " + r.status + " on " + path);
          return null;
        }
        return r.json().then(function (body) { return { body: body }; });
      })
      .catch(function (err) {
        console.error("admin worker fetch failed on " + path, err);
        return null;
      });
  }

  function setStatErr() {
    root.querySelectorAll('[data-stat]').forEach(function (el) { el.textContent = "—"; });
  }

  function showForbidden() {
    var body = root.querySelector(".container");
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
    setStat("bounce_rate", (data.bounce_rate != null ? data.bounce_rate : 0) + "%");
  }

  function fillChart(payload) {
    var host = root.querySelector("[data-admin-chart]");
    if (!host) return;
    var series = (payload && payload.series) || [];
    if (!series.length) { host.innerHTML = '<p class="admin-empty">No data in this range.</p>'; return; }

    var max = series.reduce(function (m, d) { return Math.max(m, d.visitors || 0); }, 0) || 1;
    var W = 640, H = 160, P = 8;
    var innerW = W - P * 2, innerH = H - P * 2;
    var step = series.length > 1 ? innerW / (series.length - 1) : 0;

    var points = series.map(function (d, i) {
      var x = P + i * step;
      var y = P + innerH - ((d.visitors || 0) / max) * innerH;
      return x + "," + y.toFixed(1);
    }).join(" ");

    var area = "M" + P + "," + (P + innerH) + " L" + points.replace(/ /g, " L") + " L" + (P + innerW) + "," + (P + innerH) + " Z";

    var total = series.reduce(function (s, d) { return s + (d.visitors || 0); }, 0);
    var pv = series.reduce(function (s, d) { return s + (d.pageviews || 0); }, 0);

    // One label per data point, formatted mm-dd-yyyy. Grid with
    // N columns so labels align with the chart's data points.
    // CSS rotates each label -55deg so long date strings don't
    // overlap at 30-day+ ranges.
    var labels = series.map(function (d) {
      return '<span>' + formatDateUS(d.date) + '</span>';
    }).join("");

    host.innerHTML =
      '<p class="admin-chart-summary"><strong>' + formatNumber(total) + '</strong> visitors' +
      (pv ? ' &middot; <strong>' + formatNumber(pv) + '</strong> pageviews' : '') +
      ' over ' + series.length + ' days.</p>' +
      '<svg class="admin-chart-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Visitors per day">' +
        '<path d="' + area + '" class="admin-chart-area"/>' +
        '<polyline points="' + points + '" class="admin-chart-line"/>' +
      '</svg>' +
      '<div class="admin-chart-days" style="--days: ' + series.length + ';">' + labels + '</div>';
  }

  function fillArticles(payload) {
    var articles = (payload && payload.articles) || [];
    if (!articles.length) return fill("[data-admin-top-articles]", '<li class="admin-empty">No article reads recorded in this range yet. Custom events start accumulating after a page view on a post with the new tracker.</li>');
    var max = articles[0].visitors || 1;
    fill("[data-admin-top-articles]", articles.map(function (a) {
      var bar = Math.round(((a.visitors || 0) / max) * 100);
      return (
        '<li class="admin-ranked-item">' +
          '<div class="admin-ranked-bar" style="width: ' + bar + '%"></div>' +
          '<span class="admin-ranked-label">' + escapeHtml(a.title) + '</span>' +
          '<span class="admin-ranked-value">' + formatNumber(a.visitors) + '</span>' +
        '</li>'
      );
    }).join(""));
  }

  function fillTopics(payload) {
    var topics = (payload && payload.topics) || [];
    if (!topics.length) return fill("[data-admin-top-topics]", '<li class="admin-empty">No data yet.</li>');
    var max = topics[0].visitors || 1;
    fill("[data-admin-top-topics]", topics.map(function (t) {
      var bar = Math.round(((t.visitors || 0) / max) * 100);
      return (
        '<li class="admin-ranked-item">' +
          '<div class="admin-ranked-bar" style="width: ' + bar + '%"></div>' +
          '<span class="admin-ranked-label">' +
            '<a href="/tag/' + escapeAttr(t.slug) + '/">' + escapeHtml(t.name) + '</a>' +
          '</span>' +
          '<span class="admin-ranked-value">' + formatNumber(t.visitors) + '</span>' +
        '</li>'
      );
    }).join(""));
  }

  function fillAuthors(payload) {
    var authors = (payload && payload.authors) || [];
    if (!authors.length) return fill("[data-admin-top-authors]", '<li class="admin-empty">No data yet.</li>');
    var max = authors[0].visitors || 1;
    fill("[data-admin-top-authors]", authors.map(function (a) {
      var bar = Math.round(((a.visitors || 0) / max) * 100);
      return (
        '<li class="admin-ranked-item">' +
          '<div class="admin-ranked-bar" style="width: ' + bar + '%"></div>' +
          '<span class="admin-ranked-label">' +
            '<a href="/author/' + escapeAttr(a.slug) + '/">' + escapeHtml(a.name) + '</a>' +
          '</span>' +
          '<span class="admin-ranked-value">' + formatNumber(a.visitors) + '</span>' +
        '</li>'
      );
    }).join(""));
  }

  function fillPages(payload) {
    var pages = (payload && payload.pages) || [];
    if (!pages.length) return fill("[data-admin-top-pages]", '<li class="admin-empty">No data.</li>');
    var max = pages[0].visitors || 1;
    fill("[data-admin-top-pages]", pages.map(function (p) {
      var bar = Math.round(((p.visitors || 0) / max) * 100);
      return (
        '<li class="admin-ranked-item">' +
          '<div class="admin-ranked-bar" style="width: ' + bar + '%"></div>' +
          '<span class="admin-ranked-label">' +
            '<a href="' + escapeAttr(p.page) + '">' + escapeHtml(p.page) + '</a>' +
          '</span>' +
          '<span class="admin-ranked-value">' + formatNumber(p.visitors) + '</span>' +
        '</li>'
      );
    }).join(""));
  }

  function fillSources(payload) {
    var sources = (payload && payload.sources) || [];
    if (!sources.length) return fill("[data-admin-top-sources]", '<li class="admin-empty">No data.</li>');
    var max = sources[0].visitors || 1;
    fill("[data-admin-top-sources]", sources.map(function (s) {
      var bar = Math.round(((s.visitors || 0) / max) * 100);
      return (
        '<li class="admin-ranked-item">' +
          '<div class="admin-ranked-bar" style="width: ' + bar + '%"></div>' +
          '<span class="admin-ranked-label">' + escapeHtml(s.source) + '</span>' +
          '<span class="admin-ranked-value">' + formatNumber(s.visitors) + '</span>' +
        '</li>'
      );
    }).join(""));
  }

  function fillCountries(payload) {
    var countries = (payload && payload.countries) || [];
    if (!countries.length) return fill("[data-admin-top-countries]", '<li class="admin-empty">No data.</li>');
    var max = countries[0].visitors || 1;
    fill("[data-admin-top-countries]", countries.map(function (c) {
      var bar = Math.round(((c.visitors || 0) / max) * 100);
      return (
        '<li class="admin-ranked-item">' +
          '<div class="admin-ranked-bar" style="width: ' + bar + '%"></div>' +
          '<span class="admin-ranked-label">' + escapeHtml(c.country) + '</span>' +
          '<span class="admin-ranked-value">' + formatNumber(c.visitors) + '</span>' +
        '</li>'
      );
    }).join(""));
  }

  // ---------------------------------------------------------------------------
  function setStat(key, value) {
    var el = root.querySelector('[data-stat="' + key + '"]');
    if (el) el.textContent = value;
  }
  function setEmpty(sel, msg) {
    var el = root.querySelector(sel);
    if (el) el.textContent = msg;
  }
  function fill(sel, html) {
    var el = root.querySelector(sel);
    if (el) el.innerHTML = html;
  }
  function formatNumber(n) {
    if (typeof n !== "number") return String(n || "—");
    return n.toLocaleString("en-US");
  }
  // mm-dd-yyyy from Plausible's ISO "YYYY-MM-DD"
  function formatDateUS(iso) {
    if (!iso) return "";
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return iso;
    return m[2] + "-" + m[3] + "-" + m[1];
  }
  function formatDuration(s) {
    s = Math.round(s || 0);
    var m = Math.floor(s / 60);
    var sec = s % 60;
    return (m ? m + "m " : "") + sec + "s";
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function escapeAttr(s) {
    return escapeHtml(s);
  }
})();
