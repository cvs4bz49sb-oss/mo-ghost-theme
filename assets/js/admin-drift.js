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
 * "Reconcile Drift" button pushes only_in_ghost members to Kit in
 * batches of 50 via POST /api/reconcile.
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

  // State for reconciliation
  let driftData = null;

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
      driftData = data;
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

    // Show reconcile button if there are Ghost members missing from Kit
    if (onlyGhost.length > 0) {
      const reconcileWrap = root.querySelector("[data-drift-reconcile]");
      if (reconcileWrap) reconcileWrap.hidden = false;
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
    if (typeof n !== "number") return String(n || "\u2014");
    return n.toLocaleString("en-US");
  }
  function formatDate(s) {
    if (!s) return "";
    try { return new Date(s).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }
    catch (_) { return s; }
  }

  // ── Reconcile Drift ─────────────────────────────────────────────
  const BATCH_SIZE = 50;

  const btn = root.querySelector("[data-reconcile-btn]");
  const progressEl = root.querySelector("[data-reconcile-progress]");

  if (btn) {
    btn.addEventListener("click", startReconcile);
  }

  async function startReconcile() {
    if (!driftData || !driftData.only_in_ghost || !driftData.only_in_ghost.length) return;

    const members = driftData.only_in_ghost;
    const total = members.length;

    btn.disabled = true;
    btn.textContent = "Syncing\u2026";
    setProgress(`0 / ${formatNumber(total)}`);

    let synced = 0;
    let failed = 0;
    const allFailures = [];

    // Process in batches of BATCH_SIZE
    for (let offset = 0; offset < total; offset += BATCH_SIZE) {
      const batch = members.slice(offset, offset + BATCH_SIZE);

      try {
        const res = await window.MOAuth.fetch(`${workerUrl}/api/reconcile`, {
          method: "POST",
          credentials: "omit",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ members: batch }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
        }

        const result = await res.json();
        synced += result.synced || 0;
        failed += result.failed || 0;
        if (result.failures) allFailures.push(...result.failures);
      } catch (err) {
        // Network error or worker error — count whole batch as failed
        failed += batch.length;
        allFailures.push({ email: "(batch)", error: err.message });
        console.error("reconcile batch failed", err);
      }

      setProgress(`${formatNumber(synced + failed)} / ${formatNumber(total)} (${formatNumber(synced)} synced, ${formatNumber(failed)} failed)`);
    }

    // Done — show final state
    btn.textContent = "Done";
    if (failed === 0) {
      setProgress(`${formatNumber(synced)} synced. Refreshing drift report\u2026`);
    } else {
      setProgress(`${formatNumber(synced)} synced, ${formatNumber(failed)} failed. Refreshing\u2026`);
      console.warn("reconcile failures:", allFailures);
    }

    // Refresh the drift report after a short pause
    setTimeout(() => refreshDrift(), 2000);
  }

  function setProgress(msg) {
    if (progressEl) progressEl.textContent = msg;
  }

  function refreshDrift() {
    // Re-fetch drift data and re-render the page
    setStatus("Refreshing drift report\u2026");

    // Hide all sections for clean re-render
    root.querySelectorAll("[data-drift-section]").forEach((s) => { s.hidden = true; });
    const clean = root.querySelector("[data-drift-clean]");
    if (clean) clean.hidden = true;
    const reconcileWrap = root.querySelector("[data-drift-reconcile]");
    if (reconcileWrap) reconcileWrap.hidden = true;

    window.MOAuth.fetch(`${workerUrl}/api/drift`, { credentials: "omit" })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!data) {
          setStatus("Couldn't refresh drift report.");
          return;
        }
        driftData = data;
        render(data);

        // Reset button
        btn.disabled = false;
        btn.textContent = "Reconcile Drift";
        setProgress("");
      })
      .catch(() => {
        setStatus("Network error refreshing drift report.");
      });
  }
})();
