/*
 * /admin/drift/ hydration.
 *
 * Reads the mo-kit-bridge URL + caller's email from the [data-drift]
 * host, fetches GET /api/drift, and renders three tables:
 *   - only_in_ghost    (Ghost has them, Kit doesn't)
 *   - only_in_kit      (Kit has them, Ghost doesn't)
 *   - status_mismatch  (both have them, tiers disagree)
 *
 * Sections auto-hide if their count is 0. If all three are 0, an
 * "all clear" block shows instead.
 *
 * Worker rejects non-admin emails with 403.
 */
(function () {
  var root = document.querySelector("[data-drift]");
  if (!root) return;

  var workerUrl = (root.getAttribute("data-kit-bridge-url") || "").trim().replace(/\/$/, "");
  var email = (root.getAttribute("data-member-email") || "").trim();
  var statusEl = root.querySelector("[data-drift-status]");

  if (!workerUrl || !email) {
    setStatus("Kit bridge URL not configured. Set @custom.kit_bridge_url in theme settings.");
    return;
  }

  var url = workerUrl + "/api/drift?admin=" + encodeURIComponent(email);
  fetch(url, {
    headers: { "X-Admin-Email": email },
    credentials: "omit",
  })
    .then(function (res) {
      if (res.status === 403) {
        setStatus("Forbidden — your email isn't in the admin allowlist.");
        return null;
      }
      if (!res.ok) {
        setStatus("Couldn't load drift report (" + res.status + ").");
        return null;
      }
      return res.json();
    })
    .then(function (data) {
      if (!data) return;
      render(data);
    })
    .catch(function (err) {
      console.error("drift fetch failed", err);
      setStatus("Network error loading drift report.");
    });

  function render(data) {
    setStatus("");
    fillCounts(data.counts || {});

    var onlyGhost = data.only_in_ghost || [];
    var onlyKit = data.only_in_kit || [];
    var mismatch = data.status_mismatch || [];

    if (onlyGhost.length) showSection("only_in_ghost", onlyGhost, renderGhostRow);
    if (onlyKit.length) showSection("only_in_kit", onlyKit, renderKitRow);
    if (mismatch.length) showSection("status_mismatch", mismatch, renderMismatchRow);

    if (!onlyGhost.length && !onlyKit.length && !mismatch.length) {
      var clean = root.querySelector("[data-drift-clean]");
      if (clean) clean.hidden = false;
    }
  }

  function fillCounts(counts) {
    Object.keys(counts).forEach(function (k) {
      var el = root.querySelector('[data-stat="' + k + '"]');
      if (el) el.textContent = formatNumber(counts[k]);
    });
  }

  function showSection(key, rows, rowRenderer) {
    var section = root.querySelector('[data-drift-section="' + key + '"]');
    var tbody = root.querySelector('[data-drift-tbody="' + key + '"]');
    if (!section || !tbody) return;
    tbody.innerHTML = rows.map(rowRenderer).join("");
    section.hidden = false;
  }

  function renderGhostRow(r) {
    return (
      "<tr>" +
        td(r.email) +
        td(r.name) +
        td(r.status) +
        td(formatDate(r.created_at)) +
      "</tr>"
    );
  }
  function renderKitRow(r) {
    return (
      "<tr>" +
        td(r.email) +
        td(r.name) +
        td(r.state) +
        td((r.tags || []).join(", ")) +
      "</tr>"
    );
  }
  function renderMismatchRow(r) {
    return (
      "<tr>" +
        td(r.email) +
        td(r.name) +
        td(r.ghost_status) +
        td(r.kit_status_tag || "(none)") +
        td(r.kit_has_paid_platform_tag ? "yes" : "no") +
      "</tr>"
    );
  }

  function td(v) {
    return "<td>" + escapeHtml(v == null ? "" : String(v)) + "</td>";
  }
  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
  }
  function formatNumber(n) {
    if (typeof n !== "number") return String(n || "—");
    return n.toLocaleString("en-US");
  }
  function formatDate(s) {
    if (!s) return "";
    try { return new Date(s).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }
    catch (_) { return s; }
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
