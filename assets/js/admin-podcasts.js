/*
 * /admin/podcasts/ hydration.
 *
 * Fetches live episode data from the mo-podcast-feed worker (both
 * shows, limit 20, top=true) and download aggregates from the
 * mo-admin /sponsor-stats endpoint. Renders:
 *
 *   1. Combined metrics bar — monthly downloads, all-time, total
 *      episodes, latest pub date.
 *   2. Show cards — per-show stats + latest episode with embed player.
 *   3. Timeline — interleaved recent episodes, expandable with show
 *      notes + Buzzsprout embed.
 *   4. Leaderboard — top episodes by total_plays, bar chart visual.
 *
 * Auth: window.MOAuth.fetch for the admin worker (staff-gated);
 * podcast-feed worker is public (no auth needed).
 */
(function () {
  const root = document.querySelector("[data-admin-podcasts]");
  if (!root) return;

  const podcastBase = (root.getAttribute("data-podcast-feed") || "").replace(/\/$/, "");
  const adminBase = (root.getAttribute("data-admin-url") || "").replace(/\/$/, "");
  const statusEl = root.querySelector("[data-podcast-status]");

  // Data stores populated by fetches.
  let showData = {}; // { "mere-fidelity": { show, episodes, topEpisodes }, ... }
  let downloadStats = {}; // { mfMonthlyDownloads, mfTotalDownloads, crcMonthlyDownloads, crcTotalDownloads }
  let expandedId = null; // Currently expanded timeline card.
  const collapsedPanels = new Set(); // Collapsed leaderboard panel ids.

  hydrate();

  // ---------------------------------------------------------------------------
  // Data fetching

  function hydrate() {
    if (!podcastBase) {
      setStatus("Podcast feed URL not configured — set podcast_feed_url in theme settings.");
      return;
    }

    const feedPromise = fetch(`${podcastBase}/?limit=20&top=true`)
      .then((r) => {
        if (!r.ok) throw new Error(`Feed ${r.status}`);
        return r.json();
      })
      .then((data) => { showData = data || {}; })
      .catch((err) => {
        console.error("podcast feed fetch failed", err);
        setStatus("Could not load podcast episodes.");
      });

    const statsPromise = adminBase
      ? window.MOAuth.fetch(`${adminBase}/sponsor-stats`)
          .then((r) => r.json())
          .then((data) => { downloadStats = data || {}; })
          .catch((err) => { console.error("sponsor-stats fetch failed", err); })
      : Promise.resolve();

    Promise.all([feedPromise, statsPromise]).then(() => { render(); });
  }

  // ---------------------------------------------------------------------------
  // Rendering

  function render() {
    renderMetrics();
    renderShowCards();
    renderTimeline();
    renderLeaderboard();
  }

  // -- Metrics bar ---

  function renderMetrics() {
    const mfEps = getEpisodes("mere-fidelity");
    const crcEps = getEpisodes("christians-reading-classics");
    const totalEps = mfEps.length + crcEps.length;

    const mfMonthly = downloadStats.mfMonthlyDownloads || 0;
    const crcMonthly = downloadStats.crcMonthlyDownloads || 0;
    const mfTotal = downloadStats.mfTotalDownloads || 0;
    const crcTotal = downloadStats.crcTotalDownloads || 0;

    setMetric("combined-monthly", formatNumber(mfMonthly + crcMonthly));
    setMetric("combined-total", formatNumber(mfTotal + crcTotal));
    setMetric("combined-episodes", totalEps || "—");

    const allEps = mfEps.concat(crcEps);
    if (allEps.length) {
      allEps.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
      setMetric("latest-date", formatDate(allEps[0].pubDate));
    }
  }

  // -- Show cards ---

  function renderShowCards() {
    renderShowCard("mere-fidelity", "mf");
    renderShowCard("christians-reading-classics", "crc");
  }

  function renderShowCard(slug, prefix) {
    const episodes = getEpisodes(slug);
    const monthly = downloadStats[`${prefix}MonthlyDownloads`] || 0;
    const total = downloadStats[`${prefix}TotalDownloads`] || 0;

    const metaEl = root.querySelector(`[data-show-meta="${slug}"]`);
    if (metaEl) {
      metaEl.textContent = episodes.length
        ? `${episodes.length} recent episodes loaded`
        : "No episodes loaded";
    }

    setShowStat(`${prefix}-monthly`, formatNumber(monthly));
    setShowStat(`${prefix}-total`, formatNumber(total));
    setShowStat(`${prefix}-episodes`, episodes.length || "—");

    const latestEl = root.querySelector(`[data-show-latest="${slug}"]`);
    if (!latestEl) return;

    if (!episodes.length) {
      latestEl.innerHTML = `<p class="podcast-latest-placeholder">No episodes available.</p>`;
      return;
    }

    const ep = episodes[0];
    const dur = formatDuration(ep.duration);
    latestEl.innerHTML =
      `<div class="podcast-latest-ep">` +
        `<p class="podcast-latest-label">Latest episode</p>` +
        `<p class="podcast-latest-title">${escapeHtml(ep.title)}</p>` +
        `<p class="podcast-latest-meta">${escapeHtml(formatDate(ep.pubDate))}${dur ? ` &middot; ${escapeHtml(dur)}` : ''}${ep.episode ? ` &middot; Ep ${escapeHtml(String(ep.episode))}` : ''}</p>${ 
        isAllowedEmbedHost(ep.embedUrl)
          ? `<iframe src="${escapeAttr(ep.embedUrl)}" loading="lazy" width="100%" height="200" frameborder="0" scrolling="no" sandbox="allow-scripts allow-same-origin allow-popups" title="${escapeAttr(ep.title)}" class="podcast-embed"></iframe>`
          : ''
      }</div>`;
  }

  // -- Timeline ---

  function renderTimeline() {
    const el = root.querySelector("[data-podcast-timeline]");
    if (!el) return;

    const mfEps = getEpisodes("mere-fidelity").map((e) => ({ ...e, _show: "mere-fidelity", _badge: "MF" }));
    const crcEps = getEpisodes("christians-reading-classics").map((e) => ({ ...e, _show: "christians-reading-classics", _badge: "CRC" }));
    const all = mfEps.concat(crcEps);
    all.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    if (!all.length) {
      el.innerHTML = `<p class="podcast-empty">No episodes loaded.</p>`;
      return;
    }

    el.innerHTML = all.map((ep) => {
      const isExpanded = expandedId === `${ep._show}-${ep.id}`;
      const dur = formatDuration(ep.duration);
      const badgeClass = ep._show === "mere-fidelity" ? "podcast-badge--mf" : "podcast-badge--crc";
      return (
        `<div class="podcast-tl-row${isExpanded ? ' is-expanded' : ''}" data-tl-id="${escapeAttr(`${ep._show}-${ep.id}`)}">` +
          `<div class="podcast-tl-head" role="button" tabindex="0" aria-expanded="${isExpanded}" data-action="toggle-tl" data-tl-id="${escapeAttr(`${ep._show}-${ep.id}`)}">` +
            `<span class="podcast-badge ${badgeClass}">${escapeHtml(ep._badge)}</span>` +
            `<span class="podcast-tl-title">${escapeHtml(ep.title)}</span>` +
            `<span class="podcast-tl-meta">${escapeHtml(formatDate(ep.pubDate))}${dur ? ` &middot; ${escapeHtml(dur)}` : ''}</span>` +
            `<span class="podcast-tl-chevron">${isExpanded ? '&#9650;' : '&#9660;'}</span>` +
          `</div>${ 
          isExpanded
            ? `<div class="podcast-tl-detail">${renderTlDetail(ep)}</div>`
            : '' 
        }</div>`
      );
    }).join("");

    wireTimeline(el);
  }

  function renderTlDetail(ep) {
    const parts = [];
    if (ep.episode) parts.push(`<span class="podcast-tl-tag">Episode ${escapeHtml(String(ep.episode))}</span>`);
    if (ep.season) parts.push(`<span class="podcast-tl-tag">Season ${escapeHtml(String(ep.season))}</span>`);

    let html =
      `<div class="podcast-tl-detail-meta">${parts.join('')}</div>`;

    if (ep.description) {
      html += `<p class="podcast-tl-description">${escapeHtml(ep.description)}</p>`;
    }

    if (isAllowedEmbedHost(ep.embedUrl)) {
      html += `<iframe src="${escapeAttr(ep.embedUrl)}" loading="lazy" width="100%" height="200" frameborder="0" scrolling="no" sandbox="allow-scripts allow-same-origin allow-popups" title="${escapeAttr(ep.title)}" class="podcast-embed"></iframe>`;
    }

    return html;
  }

  function wireTimeline(host) {
    host.querySelectorAll('[data-action="toggle-tl"]').forEach((el) => {
      const toggle = () => {
        const id = el.getAttribute("data-tl-id");
        expandedId = expandedId === id ? null : id;
        renderTimeline();
      };
      el.addEventListener("click", toggle);
      el.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); toggle(); }
      });
    });
  }

  // -- Leaderboards (All Time + This Quarter) ---

  function renderLeaderboard() {
    renderLeaderboardAllTime();
    renderLeaderboardQuarter();
    wireLeaderboardToggles();
  }

  function renderLeaderboardAllTime() {
    const body = root.querySelector('[data-lb-body="all-time"]');
    if (!body) return;

    const mfTop = getTopEpisodes("mere-fidelity").map((e) => ({ ...e, _show: "mere-fidelity", _badge: "MF" }));
    const crcTop = getTopEpisodes("christians-reading-classics").map((e) => ({ ...e, _show: "christians-reading-classics", _badge: "CRC" }));
    const combined = mfTop.concat(crcTop);
    combined.sort((a, b) => (b.plays || 0) - (a.plays || 0));
    const top10 = combined.slice(0, 10);

    body.innerHTML = buildLeaderboardHtml(top10, "No play data available.");
  }

  function renderLeaderboardQuarter() {
    const body = root.querySelector('[data-lb-body="this-quarter"]');
    if (!body) return;

    const { start, end } = getQuarterRange();
    const mfEps = getEpisodes("mere-fidelity").map((e) => ({ ...e, _show: "mere-fidelity", _badge: "MF" }));
    const crcEps = getEpisodes("christians-reading-classics").map((e) => ({ ...e, _show: "christians-reading-classics", _badge: "CRC" }));
    const all = mfEps.concat(crcEps);

    const inQuarter = all.filter((ep) => {
      const d = new Date(ep.pubDate);
      return !isNaN(d.getTime()) && d >= start && d < end;
    });

    // Use totalPlays if available (requires updated worker), fall back to 0.
    inQuarter.forEach((ep) => { ep.plays = ep.totalPlays || 0; });
    inQuarter.sort((a, b) => (b.plays || 0) - (a.plays || 0));
    const top10 = inQuarter.slice(0, 10);

    body.innerHTML = buildLeaderboardHtml(top10, "No episodes published this quarter yet.");
  }

  function buildLeaderboardHtml(episodes, emptyMsg) {
    if (!episodes.length) {
      return `<p class="podcast-empty">${escapeHtml(emptyMsg)}</p>`;
    }

    const maxPlays = episodes[0].plays || 1;

    return `<div class="podcast-lb-list">${
      episodes.map((ep, i) => {
        const pct = maxPlays > 0 ? Math.round(((ep.plays || 0) / maxPlays) * 100) : 0;
        const badgeClass = ep._show === "mere-fidelity" ? "podcast-badge--mf" : "podcast-badge--crc";
        return (
          `<div class="podcast-lb-row">` +
            `<span class="podcast-lb-rank">${i + 1}</span>` +
            `<span class="podcast-badge ${badgeClass}">${escapeHtml(ep._badge)}</span>` +
            `<div class="podcast-lb-info">` +
              `<span class="podcast-lb-title">${escapeHtml(ep.title)}</span>` +
              `<div class="podcast-lb-bar-track">` +
                `<div class="podcast-lb-bar" style="width:${pct}%"></div>` +
              `</div>` +
            `</div>` +
            `<span class="podcast-lb-plays">${formatNumber(ep.plays || 0)}</span>` +
          `</div>`
        );
      }).join("")
    }</div>`;
  }

  function wireLeaderboardToggles() {
    root.querySelectorAll('[data-action="toggle-lb"]').forEach((btn) => {
      // Avoid re-wiring.
      if (btn._lbWired) return;
      btn._lbWired = true;

      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-lb-target");
        const panel = root.querySelector(`[data-lb-panel="${target}"]`);
        if (!panel) return;

        const isCollapsed = collapsedPanels.has(target);
        if (isCollapsed) {
          collapsedPanels.delete(target);
          panel.classList.remove("is-collapsed");
          btn.setAttribute("aria-expanded", "true");
        } else {
          collapsedPanels.add(target);
          panel.classList.add("is-collapsed");
          btn.setAttribute("aria-expanded", "false");
        }
      });

      // Apply initial state.
      const target = btn.getAttribute("data-lb-target");
      if (collapsedPanels.has(target)) {
        const panel = root.querySelector(`[data-lb-panel="${target}"]`);
        if (panel) panel.classList.add("is-collapsed");
        btn.setAttribute("aria-expanded", "false");
      }
    });
  }

  function getQuarterRange() {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const qStart = Math.floor(month / 3) * 3;
    return {
      start: new Date(year, qStart, 1),
      end: new Date(year, qStart + 3, 1),
    };
  }

  // ---------------------------------------------------------------------------
  // Data helpers

  function getEpisodes(slug) {
    const s = showData[slug];
    return (s && Array.isArray(s.episodes)) ? s.episodes : [];
  }

  function getTopEpisodes(slug) {
    const s = showData[slug];
    return (s && Array.isArray(s.topEpisodes)) ? s.topEpisodes : [];
  }

  // ---------------------------------------------------------------------------
  // Helpers

  function setMetric(key, val) {
    const el = root.querySelector(`[data-metric="${key}"]`);
    if (el) el.textContent = val;
  }

  function setShowStat(key, val) {
    const el = root.querySelector(`[data-show-stat="${key}"]`);
    if (el) el.textContent = val;
  }

  function setStatus(msg) { if (statusEl) statusEl.textContent = msg || ""; }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }

  function escapeAttr(s) { return escapeHtml(s); }

  const ALLOWED_EMBED_HOSTS = new Set([
    "www.buzzsprout.com",
  ]);

  function isAllowedEmbedHost(url) {
    if (!url || typeof url !== "string") return false;
    try {
      const u = new URL(url, window.location.origin);
      if (u.protocol !== "https:") return false;
      return ALLOWED_EMBED_HOSTS.has(u.host);
    } catch (_) {
      return false;
    }
  }

  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function formatNumber(n) {
    if (n == null || n === 0) return "0";
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
  }

  function formatDuration(seconds) {
    const s = parseInt(seconds, 10);
    if (!s || isNaN(s)) return "";
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m} min`;
  }
})();
