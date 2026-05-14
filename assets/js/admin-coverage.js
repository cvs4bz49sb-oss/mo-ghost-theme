/*
 * /admin/coverage/ — Coverage Scan UI.
 *
 * Loads the most recent scan from the mo-admin worker, renders the
 * editorial radar (headlines per publication + gaps + contested +
 * pitches). The "Run scan" button triggers POST /coverage/scan which
 * synchronously fetches all 16 feeds, calls Claude, stores the
 * report, and returns it.
 *
 * Auth: all worker calls go through MOAuth.fetch (admin-auth.js),
 * which signs them with the Ghost member JWT. Server gates by Ghost
 * staff status.
 */
(function () {
  "use strict";

  const root = document.querySelector("[data-coverage-app]");
  if (!root) return;
  const workerUrl = (root.dataset.workerUrl || "").replace(/\/$/, "");
  if (!workerUrl) {
    setStatus("Coverage worker URL not configured (Ghost admin → Customize → admin_worker_url).", true);
    return;
  }

  const $last = root.querySelector("[data-coverage-last]");
  const $status = root.querySelector("[data-coverage-status]");
  const $runBtn = root.querySelector("[data-coverage-run]");
  const $runLabel = $runBtn.querySelector(".coverage-scan-btn-label");
  const $report = root.querySelector("[data-coverage-report]");
  const $empty = root.querySelector("[data-coverage-empty]");
  const $date = root.querySelector("[data-coverage-date]");
  const $sub = root.querySelector("[data-coverage-sub]");
  const $stats = root.querySelectorAll("[data-coverage-stat]");
  const $headlinesSub = root.querySelector("[data-coverage-headlines-sub]");
  const $headlines = root.querySelector("[data-coverage-headlines]");
  const $contested = root.querySelector("[data-coverage-contested]");
  const $gaps = root.querySelector("[data-coverage-gaps]");
  const $pitches = root.querySelector("[data-coverage-pitches]");
  const $copyAll = root.querySelector("[data-coverage-copy-all]");

  $runBtn.addEventListener("click", runScan);
  if ($copyAll) $copyAll.addEventListener("click", copyAllPitches);

  // Wait until MOAuth is ready (admin-auth.js loads before us, but it
  // initializes on DOMContentLoaded; small idle until it's there).
  whenAuthReady().then(loadLatest).catch((err) => {
    setStatus("Sign in as staff to use this page.", true);
    console.warn("coverage: auth not ready", err && err.message);
  });

  function whenAuthReady() {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      (function poll() {
        if (window.MOAuth && typeof window.MOAuth.fetch === "function") return resolve();
        if (Date.now() - start > 5000) return reject(new Error("MOAuth not present"));
        setTimeout(poll, 100);
      })();
    });
  }

  async function loadLatest() {
    setStatus("Loading latest scan…");
    try {
      const resp = await window.MOAuth.fetch(`${workerUrl}/coverage/latest`, { method: "GET" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (!data.report) {
        setStatus("");
        $empty.hidden = false;
        return;
      }
      render(data.report);
    } catch (err) {
      console.error("coverage load failed", err);
      setStatus(`Could not load latest scan: ${err.message || err}`, true);
    }
  }

  async function runScan() {
    if ($runBtn.disabled) return;
    setStatus("Pulling 16 feeds and calling Claude — this takes ~30 seconds…");
    $runBtn.disabled = true;
    $runLabel.textContent = "Scanning…";
    $empty.hidden = true;
    try {
      const resp = await window.MOAuth.fetch(`${workerUrl}/coverage/scan`, { method: "POST" });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || data.error || `HTTP ${resp.status}`);
      render(data.report);
      setStatus("");
    } catch (err) {
      console.error("coverage scan failed", err);
      setStatus(`Scan failed: ${err.message || err}`, true);
    } finally {
      $runBtn.disabled = false;
      $runLabel.textContent = "Run scan";
    }
  }

  function render(report) {
    $report.hidden = false;
    $empty.hidden = true;

    // Toolbar timestamp.
    $last.textContent = formatScanTimestamp(report.scannedAt);

    // Radar block.
    $date.textContent = formatRadarDate(report.date);
    $sub.textContent = `Captured at ${formatTime(report.scannedAt)} · refreshed daily at 6 AM Eastern`;

    // Stat tiles.
    $stats.forEach((el) => {
      const key = el.getAttribute("data-coverage-stat");
      const n = (report.summary && report.summary[key]) || 0;
      const numEl = el.querySelector(".coverage-stat-n");
      if (numEl) numEl.textContent = n;
    });

    // Headlines grid.
    if ($headlinesSub) {
      const itemCount = report.summary.headlines;
      const pubCount = report.summary.publications;
      $headlinesSub.textContent = `${itemCount} item${itemCount === 1 ? "" : "s"} pulled across ${pubCount} publication${pubCount === 1 ? "" : "s"}`;
    }
    $headlines.innerHTML = (report.headlines || []).map(renderHeadlinesCard).join("");

    // Contested + gaps.
    $contested.innerHTML = (report.contested || []).map(renderBlock("DISPUTED")).join("");
    $gaps.innerHTML = (report.gaps || []).map(renderBlock("UNDERSERVED")).join("");

    // Pitches.
    $pitches.innerHTML = (report.pitches || []).map(renderPitch).join("");

    // Wire per-pitch copy buttons.
    $pitches.querySelectorAll("[data-pitch-copy]").forEach((btn) => {
      btn.addEventListener("click", () => copyPitch(btn));
    });
  }

  function renderHeadlinesCard(group) {
    const count = group.count || 0;
    const items = (group.items || []).slice(0, 10).map((it) => {
      const safeUrl = it.url || "#";
      return `<li class="coverage-headlines-item"><a href="${escapeAttr(safeUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(it.title)}</a></li>`;
    }).join("");
    const errorNote = group.error
      ? `<p class="coverage-headlines-error">Feed unavailable: ${escapeHtml(group.error)}</p>`
      : "";
    return `
      <li class="coverage-headlines-card">
        <header class="coverage-headlines-head">
          <span class="coverage-headlines-name">${escapeHtml(group.name)}</span>
          <span class="coverage-headlines-count">${count}</span>
        </header>
        <ol class="coverage-headlines-list">${items}</ol>
        ${errorNote}
      </li>`;
  }

  function renderBlock(eyebrow) {
    return (block) => `
      <li class="coverage-block">
        <p class="coverage-block-eyebrow">${escapeHtml(eyebrow)}</p>
        <h4 class="coverage-block-title">${escapeHtml(block.title || "")}</h4>
        <p class="coverage-block-body">${escapeHtml(block.body || "")}</p>
      </li>`;
  }

  function renderPitch(p, i) {
    const num = String(i + 1).padStart(2, "0");
    return `
      <li class="coverage-pitch">
        <header class="coverage-pitch-head">
          <span class="coverage-pitch-numeral">${num}</span>
          <button type="button" class="coverage-pitch-copy" data-pitch-copy data-pitch-i="${i}" aria-label="Copy pitch">⧉</button>
        </header>
        <h4 class="coverage-pitch-title">${escapeHtml(p.title || "")}</h4>
        <p class="coverage-pitch-body">${escapeHtml(p.body || "")}</p>
      </li>`;
  }

  function copyPitch(btn) {
    const i = parseInt(btn.getAttribute("data-pitch-i"), 10);
    const card = btn.closest(".coverage-pitch");
    if (!card) return;
    const title = card.querySelector(".coverage-pitch-title").textContent;
    const body = card.querySelector(".coverage-pitch-body").textContent;
    const text = `${title}\n\n${body}`;
    navigator.clipboard.writeText(text).then(() => flashBtn(btn));
  }

  function copyAllPitches() {
    const cards = $pitches.querySelectorAll(".coverage-pitch");
    const text = Array.prototype.map.call(cards, (c, i) => {
      const t = c.querySelector(".coverage-pitch-title").textContent;
      const b = c.querySelector(".coverage-pitch-body").textContent;
      return `${i + 1}. ${t}\n   ${b}`;
    }).join("\n\n");
    navigator.clipboard.writeText(text).then(() => flashBtn($copyAll));
  }

  function flashBtn(btn) {
    const prev = btn.textContent;
    btn.textContent = "Copied";
    btn.classList.add("is-copied");
    setTimeout(() => {
      btn.textContent = prev;
      btn.classList.remove("is-copied");
    }, 1400);
  }

  function setStatus(text, isError) {
    $status.textContent = text || "";
    $status.classList.toggle("is-error", !!isError);
    $status.hidden = !text;
  }

  function formatRadarDate(isoDate) {
    // isoDate is YYYY-MM-DD.
    const d = new Date(`${isoDate}T12:00:00Z`);
    return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  }
  function formatTime(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  function formatScanTimestamp(iso) {
    const d = new Date(iso);
    return `${d.toLocaleDateString()}, ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function escapeAttr(s) { return escapeHtml(s); }
})();
