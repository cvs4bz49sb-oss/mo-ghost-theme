/*
 * /admin/members/ hydration.
 *
 * Reads the worker URL + caller's email from the body's
 * [data-admin-members] host, then fetches:
 *   - /members/summary     → populates the stat cells
 *   - /members/timeseries  → renders an SVG sparkline of daily signups
 *   - /members/recent      → renders the last-ten list
 *
 * Worker rejects non-admin emails with 403; the JS surfaces a
 * generic error in that case.
 */
(function () {
  const root = document.querySelector("[data-admin-members]");
  if (!root) return;

  const worker = (root.getAttribute("data-worker-url") || "").trim().replace(/\/$/, "");
  if (!worker) {
    setEmpty(root.querySelector("[data-chart-placeholder]"), "Admin worker URL not configured.");
    setEmpty(root.querySelector("[data-recent-placeholder]"), "Admin worker URL not configured.");
    return;
  }

  // Kick off independently so a slow timeseries doesn't block the
  // summary + recent cells from rendering.
  api("/members/summary").then((res) => {
    if (!res) return setStatErr("Couldn't load summary.");
    if (res.forbidden) return showForbidden();
    fillSummary(res.body);
  });
  api("/members/timeseries?days=30").then((res) => {
    if (!res) return setEmpty(root.querySelector("[data-chart-placeholder]"), "Couldn't load signup timeseries.");
    if (res.forbidden) return showForbidden();
    fillChart(res.body);
  });
  api("/members/recent?limit=10").then((res) => {
    if (!res) return setEmpty(root.querySelector("[data-recent-placeholder]"), "Couldn't load recent signups.");
    if (res.forbidden) return showForbidden();
    fillRecent(res.body);
  });

  function api(path) {
    return window.MOAuth.fetch(worker + path, { credentials: "omit" })
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

  function setStatErr(msg) {
    root.querySelectorAll('[data-stat]').forEach((el) => { el.textContent = "—"; });
    console.error(msg);
  }

  function showForbidden() {
    const stats = root.querySelector("[data-admin-stats]");
    if (stats) stats.remove();
    const split = root.querySelector(".admin-split");
    if (split) split.remove();
    const msg = document.createElement("div");
    msg.className = "admin-forbidden";
    msg.innerHTML =
      '<p class="eyebrow">Staff only</p>' +
      '<h2 class="section-heading"><em>Not authorized.</em></h2>' +
      "<p>Your member account isn't linked to a Ghost staff seat. " +
      "Ask an admin to add your email as a staff user at <code>/ghost/</code>, " +
      "then reload this page.</p>";
    const container = root.querySelector(".container");
    if (container) container.appendChild(msg);
  }

  // -------------------------------------------------------------------------

  function fillSummary(data) {
    Object.keys(data).forEach((k) => {
      const el = root.querySelector(`[data-stat="${k}"]`);
      if (el) el.textContent = formatNumber(data[k]);
    });
  }

  function fillChart(payload) {
    const host = root.querySelector("[data-admin-chart]");
    if (!host) return;
    const series = (payload && payload.series) || [];
    if (!series.length) { setEmpty(host, "No data."); return; }

    const max = series.reduce((m, d) => { return Math.max(m, d.total); }, 0) || 1;
    const W = 640, H = 160, P = 8;
    const innerW = W - P * 2, innerH = H - P * 2;
    const step = series.length > 1 ? innerW / (series.length - 1) : 0;

    const points = series.map((d, i) => {
      const x = P + i * step;
      const y = P + innerH - (d.total / max) * innerH;
      return `${x},${y.toFixed(1)}`;
    }).join(" ");

    // Filled area under the line.
    const area = `M${P},${P + innerH} L${points.replace(/ /g, " L")} L${P + innerW},${P + innerH} Z`;

    const total = series.reduce((s, d) => { return s + d.total; }, 0);
    const paid = series.reduce((s, d) => { return s + (d.paid || 0); }, 0);

    host.innerHTML =
      `<p class="admin-chart-summary"><strong>${formatNumber(total)}</strong> new signups${ 
      paid ? ` &middot; <strong>${formatNumber(paid)}</strong> paid` : '' 
      } over ${payload.days} days.</p>` +
      `<svg class="admin-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Signups per day">` +
        `<path d="${area}" class="admin-chart-area"/>` +
        `<polyline points="${points}" class="admin-chart-line"/>` +
      `</svg>` +
      `<p class="admin-chart-axis"><span>${series[0].date}</span><span>${series[series.length - 1].date}</span></p>`;
  }

  function fillRecent(payload) {
    const host = root.querySelector("[data-admin-recent]");
    if (!host) return;
    const members = (payload && payload.members) || [];
    if (!members.length) { setEmpty(host, "Nothing yet."); return; }
    host.innerHTML = members.map(renderRecentItem).join("");
  }

  function renderRecentItem(m) {
    const when = m.created_at
      ? new Date(m.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "";
    const name = escapeHtml(m.name || m.email || "");
    const sub = escapeHtml(m.email || "");
    const tier = m.status
      ? `<span class="admin-recent-tier admin-recent-tier--${escapeHtml(m.status)}">${escapeHtml(m.status)}</span>`
      : "";
    return (
      `<li class="admin-recent-item">` +
        `<div class="admin-recent-person">` +
          `<p class="admin-recent-name">${name}</p>` +
          `<p class="admin-recent-email">${sub}</p>` +
        `</div>` +
        `<div class="admin-recent-meta">${tier}<span class="admin-recent-date">${escapeHtml(when)}</span></div>` +
      `</li>`
    );
  }

  function setEmpty(el, msg) {
    if (!el) return;
    el.textContent = msg;
  }
  function formatNumber(n) {
    if (typeof n !== "number") return String(n || "—");
    return n.toLocaleString("en-US");
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
