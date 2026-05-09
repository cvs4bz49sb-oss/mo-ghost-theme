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
  const root = document.querySelector("[data-drift]");
  if (!root) return;

  const workerUrl = (root.getAttribute("data-kit-bridge-url") || "").trim().replace(/\/$/, "");
  const statusEl = root.querySelector("[data-drift-status]");

  if (!workerUrl) {
    setStatus("Kit bridge URL not configured. Set @custom.kit_bridge_url in theme settings.");
    return;
  }

  window.MOAuth.fetch(`${workerUrl}/api/drift`, { credentials: "omit" })
    .then((res) => {
      if (res.status === 401 || res.status === 403) {
        setStatus("Forbidden — your email isn't in the admin allowlist.");
        return null;
      }
      if (!res.ok) {
        setStatus(`Couldn't load drift report (${res.status}).`);
        return null;
      }
      return res.json();
    })
    .then((data) => {
      if (!data) return;
      render(data);
    })
    .catch((err) => {
      console.error("drift fetch failed", err);
      setStatus("Network error loading drift report.");
    });

  function render(data) {
    setStatus("");
    fillCounts(data.counts || {});

    const onlyGhost = data.only_in_ghost || [];
    const onlyKit = data.only_in_kit || [];
    const mismatch = data.status_mismatch || [];

    if (onlyGhost.length) showSection("only_in_ghost", onlyGhost, renderGhostRow);
    if (onlyKit.length) showSection("only_in_kit", onlyKit, renderKitRow);
    if (mismatch.length) showSection("status_mismatch", mismatch, renderMismatchRow);

    if (!onlyGhost.length && !onlyKit.length && !mismatch.length) {
      const clean = root.querySelector("[data-drift-clean]");
      if (clean) clean.hidden = false;
    }
  }

  function fillCounts(counts) {
    Object.keys(counts).forEach((k) => {
      const el = root.querySelector(`[data-stat="${k}"]`);
      if (el) el.textContent = formatNumber(counts[k]);
    });
  }

  // DOM construction (rather than innerHTML + escapeHtml) eliminates
  // the class of bug where a future edit forgets to escape one field.
  // Pass 3 (#6 in audits/SYNTHESIS.md) flagged this file as having
  // the same fragility H4 noted in admin-editorial.js.
  function showSection(key, rows, rowRenderer) {
    const section = root.querySelector(`[data-drift-section="${key}"]`);
    const tbody = root.querySelector(`[data-drift-tbody="${key}"]`);
    if (!section || !tbody) return;
    tbody.replaceChildren();
    rows.forEach((r) => { tbody.appendChild(rowRenderer(r)); });
    section.hidden = false;
  }

  function buildRow(cells) {
    const tr = document.createElement("tr");
    cells.forEach((v) => {
      const td = document.createElement("td");
      td.textContent = v == null ? "" : String(v);
      tr.appendChild(td);
    });
    return tr;
  }

  function renderGhostRow(r) {
    return buildRow([r.email, r.name, r.status, formatDate(r.created_at)]);
  }
  function renderKitRow(r) {
    return buildRow([r.email, r.name, r.state, (r.tags || []).join(", ")]);
  }
  function renderMismatchRow(r) {
    return buildRow([
      r.email, r.name, r.ghost_status,
      r.kit_status_tag || "(none)",
      r.kit_has_paid_platform_tag ? "yes" : "no",
    ]);
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
})();
