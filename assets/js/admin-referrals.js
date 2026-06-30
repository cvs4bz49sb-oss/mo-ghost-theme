(function () {
  "use strict";

  var root = document.querySelector("[data-admin-referrals]");
  if (!root) return;

  var apiBase = (root.getAttribute("data-api-base") || "").replace(/\/+$/, "");
  if (!apiBase || !window.MOAuth) return;

  function api(path) {
    return window.MOAuth.fetch(apiBase + path, { credentials: "omit" })
      .then(function (r) {
        if (r.status === 401 || r.status === 403) return { forbidden: true };
        if (!r.ok) return null;
        return r.json().then(function (body) { return { body: body }; });
      })
      .catch(function () { return null; });
  }

  function fmt(n) {
    return typeof n === "number" ? n.toLocaleString() : "0";
  }

  function dollars(cents) {
    return "$" + (Math.abs(cents || 0) / 100).toFixed(2);
  }

  function shortDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function statusBadge(status) {
    var cls = "ref-status-badge ref-status-badge--" + (status || "pending");
    return '<span class="' + cls + '">' + (status || "pending") + "</span>";
  }

  function esc(s) {
    var el = document.createElement("span");
    el.textContent = s || "";
    return el.innerHTML;
  }

  api("/api/admin/referrals").then(function (res) {
    if (!res) return showError("Could not load referral data.");
    if (res.forbidden) return showForbidden();

    var data = res.body;
    fillStats(data.referral_summary || []);
    fillGrants(data.grant_summary || []);
    fillReview(data.needs_review || []);
    fillLeaderboard(data.top_referrers || []);
    fillRecent(data.recent || []);
  });

  function showError(msg) {
    root.innerHTML = '<p class="admin-table-status">' + esc(msg) + "</p>";
  }

  function showForbidden() {
    root.innerHTML =
      '<div class="admin-forbidden">' +
      '<p class="eyebrow">Staff only</p>' +
      '<h2 class="section-heading"><em>Not authorized.</em></h2>' +
      "</div>";
  }

  function fillStats(summary) {
    var counts = { pending: 0, converted: 0, rewarded: 0, void: 0 };
    for (var i = 0; i < summary.length; i++) {
      if (summary[i].status in counts) counts[summary[i].status] = summary[i].n;
    }
    var keys = Object.keys(counts);
    for (var j = 0; j < keys.length; j++) {
      var el = root.querySelector('[data-stat="' + keys[j] + '"]');
      if (el) el.textContent = fmt(counts[keys[j]]);
    }
  }

  function fillGrants(summary) {
    var host = root.querySelector("[data-ref-grants]");
    var status = root.querySelector("[data-grants-status]");
    if (!host) return;

    var monthGranted = 0, monthCents = 0, halfoffGranted = 0, halfoffCents = 0, stuck = 0;
    for (var i = 0; i < summary.length; i++) {
      var g = summary[i];
      if (g.kind === "month" && g.status === "granted") { monthGranted = g.n; monthCents = g.cents; }
      if (g.kind === "halfoff" && g.status === "granted") { halfoffGranted = g.n; halfoffCents = g.cents; }
      if (g.status === "granting") stuck += g.n;
    }

    var html =
      '<div class="ref-grants-grid">' +
      '<div class="ref-grant-card"><strong>' + fmt(monthGranted) + '</strong><span class="ref-grant-label">Free months granted (' + dollars(monthCents) + ' in credits)</span></div>' +
      '<div class="ref-grant-card"><strong>' + fmt(halfoffGranted) + '</strong><span class="ref-grant-label">50%-off renewals granted (' + dollars(halfoffCents) + ' in credits)</span></div>' +
      '<div class="ref-grant-card"><strong>' + dollars(monthCents + halfoffCents) + '</strong><span class="ref-grant-label">Total credits issued</span></div>' +
      '</div>';

    if (status) status.remove();
    host.insertAdjacentHTML("beforeend", html);
  }

  function fillReview(rows) {
    var section = root.querySelector("[data-ref-review]");
    if (!section) return;
    if (!rows.length) return;

    section.hidden = false;
    var tbody = section.querySelector("[data-review-tbody]");
    if (!tbody) return;

    var html = "";
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      html +=
        "<tr>" +
        "<td>" + esc(r.referrer_email) + "</td>" +
        "<td>" + esc(r.kind) + "</td>" +
        "<td>" + dollars(r.amount_cents) + "</td>" +
        "<td>" + esc(r.detail || "") + "</td>" +
        "<td>" + shortDate(r.created_at) + "</td>" +
        "</tr>";
    }
    tbody.innerHTML = html;
  }

  function fillLeaderboard(rows) {
    var status = root.querySelector("[data-leaderboard-status]");
    var table = root.querySelector("[data-leaderboard-table]");
    var tbody = root.querySelector("[data-leaderboard-tbody]");
    if (!tbody) return;

    if (!rows.length) {
      if (status) status.textContent = "No referrals yet.";
      return;
    }

    if (status) status.remove();
    if (table) table.hidden = false;

    var html = "";
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      html +=
        "<tr>" +
        "<td>" + esc(r.referrer_email) + "</td>" +
        "<td><code>" + esc(r.code || "") + "</code></td>" +
        "<td><strong>" + fmt(r.confirmed) + "</strong></td>" +
        "<td>" + fmt(r.vesting) + "</td>" +
        "<td>" + fmt(r.pending) + "</td>" +
        "<td>" + fmt(r.voided) + "</td>" +
        "<td>" + dollars(r.total_credited_cents) + "</td>" +
        "</tr>";
    }
    tbody.innerHTML = html;
  }

  function fillRecent(rows) {
    var status = root.querySelector("[data-recent-status]");
    var table = root.querySelector("[data-recent-table]");
    var tbody = root.querySelector("[data-recent-tbody]");
    if (!tbody) return;

    if (!rows.length) {
      if (status) status.textContent = "No referrals yet.";
      return;
    }

    if (status) status.remove();
    if (table) table.hidden = false;

    var html = "";
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      html +=
        "<tr>" +
        "<td>" + esc(r.referrer_email) + "</td>" +
        "<td>" + esc(r.referred_email) + "</td>" +
        "<td>" + statusBadge(r.status) + "</td>" +
        "<td>" + shortDate(r.created_at) + "</td>" +
        "<td>" + shortDate(r.converted_at) + "</td>" +
        "<td>" + shortDate(r.rewarded_at) + "</td>" +
        "</tr>";
    }
    tbody.innerHTML = html;
  }
})();
