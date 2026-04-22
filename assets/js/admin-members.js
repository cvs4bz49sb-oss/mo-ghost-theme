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
  var root = document.querySelector("[data-admin-members]");
  if (!root) return;

  var worker = (root.getAttribute("data-worker-url") || "").trim().replace(/\/$/, "");
  var email = (root.getAttribute("data-member-email") || "").trim();
  if (!worker || !email) {
    setEmpty(root.querySelector("[data-chart-placeholder]"), "Admin worker URL not configured.");
    setEmpty(root.querySelector("[data-recent-placeholder]"), "Admin worker URL not configured.");
    return;
  }

  Promise.all([
    api("/members/summary"),
    api("/members/timeseries?days=30"),
    api("/members/recent?limit=10"),
  ]).then(function (res) {
    // If any call came back 403, the caller isn't staff. Surface
    // a single clear "not authorized" state and stop.
    if (res.some(function (r) { return r && r.forbidden; })) {
      showForbidden();
      return;
    }
    if (res[0] && res[0].body) fillSummary(res[0].body);
    if (res[1] && res[1].body) fillChart(res[1].body);
    if (res[2] && res[2].body) fillRecent(res[2].body);
  }).catch(function () {
    setEmpty(root.querySelector("[data-chart-placeholder]"), "Couldn't reach the admin worker.");
    setEmpty(root.querySelector("[data-recent-placeholder]"), "Couldn't reach the admin worker.");
  });

  function api(path) {
    var sep = path.indexOf("?") > -1 ? "&" : "?";
    return fetch(worker + path + sep + "email=" + encodeURIComponent(email), { credentials: "omit" })
      .then(function (r) {
        if (r.status === 403) return { forbidden: true };
        return r.ok ? r.json().then(function (body) { return { body: body }; }) : null;
      })
      .catch(function () { return null; });
  }

  function showForbidden() {
    var stats = root.querySelector("[data-admin-stats]");
    if (stats) stats.remove();
    var split = root.querySelector(".admin-split");
    if (split) split.remove();
    var msg = document.createElement("div");
    msg.className = "admin-forbidden";
    msg.innerHTML =
      '<p class="eyebrow">Staff only</p>' +
      '<h2 class="section-heading"><em>Not authorized.</em></h2>' +
      "<p>Your member account isn't linked to a Ghost staff seat. " +
      "Ask an admin to add your email as a staff user at <code>/ghost/</code>, " +
      "then reload this page.</p>";
    var container = root.querySelector(".container");
    if (container) container.appendChild(msg);
  }

  // -------------------------------------------------------------------------

  function fillSummary(data) {
    Object.keys(data).forEach(function (k) {
      var el = root.querySelector('[data-stat="' + k + '"]');
      if (el) el.textContent = formatNumber(data[k]);
    });
  }

  function fillChart(payload) {
    var host = root.querySelector("[data-admin-chart]");
    if (!host) return;
    var series = (payload && payload.series) || [];
    if (!series.length) { setEmpty(host, "No data."); return; }

    var max = series.reduce(function (m, d) { return Math.max(m, d.total); }, 0) || 1;
    var W = 640, H = 160, P = 8;
    var innerW = W - P * 2, innerH = H - P * 2;
    var step = series.length > 1 ? innerW / (series.length - 1) : 0;

    var points = series.map(function (d, i) {
      var x = P + i * step;
      var y = P + innerH - (d.total / max) * innerH;
      return x + "," + y.toFixed(1);
    }).join(" ");

    // Filled area under the line.
    var area = "M" + P + "," + (P + innerH) + " L" + points.replace(/ /g, " L") + " L" + (P + innerW) + "," + (P + innerH) + " Z";

    var total = series.reduce(function (s, d) { return s + d.total; }, 0);
    var paid = series.reduce(function (s, d) { return s + (d.paid || 0); }, 0);

    host.innerHTML =
      '<p class="admin-chart-summary"><strong>' + formatNumber(total) + '</strong> new signups' +
      (paid ? ' &middot; <strong>' + formatNumber(paid) + '</strong> paid' : '') +
      ' over ' + payload.days + ' days.</p>' +
      '<svg class="admin-chart-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Signups per day">' +
        '<path d="' + area + '" class="admin-chart-area"/>' +
        '<polyline points="' + points + '" class="admin-chart-line"/>' +
      '</svg>' +
      '<p class="admin-chart-axis"><span>' + series[0].date + '</span><span>' + series[series.length - 1].date + '</span></p>';
  }

  function fillRecent(payload) {
    var host = root.querySelector("[data-admin-recent]");
    if (!host) return;
    var members = (payload && payload.members) || [];
    if (!members.length) { setEmpty(host, "Nothing yet."); return; }
    host.innerHTML = members.map(renderRecentItem).join("");
  }

  function renderRecentItem(m) {
    var when = m.created_at
      ? new Date(m.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "";
    var name = escapeHtml(m.name || m.email || "");
    var sub = escapeHtml(m.email || "");
    var tier = m.status
      ? '<span class="admin-recent-tier admin-recent-tier--' + escapeHtml(m.status) + '">' + escapeHtml(m.status) + '</span>'
      : "";
    return (
      '<li class="admin-recent-item">' +
        '<div class="admin-recent-person">' +
          '<p class="admin-recent-name">' + name + '</p>' +
          '<p class="admin-recent-email">' + sub + '</p>' +
        '</div>' +
        '<div class="admin-recent-meta">' + tier + '<span class="admin-recent-date">' + escapeHtml(when) + '</span></div>' +
      '</li>'
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
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
