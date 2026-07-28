/*
 * Sponsorship page — fetches ad-slot availability from admin worker
 * settings and renders status badges. Also fetches live audience
 * metrics (subscribers, downloads, pageviews) from the /sponsor-stats
 * endpoint and renders them in the stats bar.
 *
 * The admin worker's GET /settings and GET /sponsor-stats endpoints
 * are public (no auth required, 60s / 6h cache respectively).
 *
 * Each slot element has [data-slot="nl_top"] etc. The settings response
 * contains sponsor_<slot>_status ("available"/"filled") and
 * sponsor_<slot>_until (freeform date text).
 */
(function () {
  // ── Inventory status badges ────────────────────────────────────────

  const grid = document.querySelector("[data-sponsor-inventory]");
  if (grid) {
    const adminUrl = (grid.getAttribute("data-admin-url") || "").replace(/\/$/, "");
    if (adminUrl) {
      fetch(`${adminUrl}/settings`, { cache: "default" })
        .then((r) => { return r.ok ? r.json() : null; })
        .then((settings) => {
          if (!settings) return;
          const slots = grid.querySelectorAll("[data-slot]");
          for (let i = 0; i < slots.length; i++) {
            const el = slots[i];
            const key = el.getAttribute("data-slot");
            const status = settings[`sponsor_${key}_status`] || "available";
            const until = settings[`sponsor_${key}_until`] || "";
            const badge = el.querySelector("[data-slot-badge]");
            if (!badge) continue;

            if (status === "filled") {
              badge.textContent = until ? `Filled until ${until}` : "Filled";
              badge.className = "sponsor-slot-badge is-filled";
              el.classList.add("is-filled");
            } else {
              badge.textContent = "Available";
              badge.className = "sponsor-slot-badge is-available";
              el.classList.add("is-available");
            }
          }
        })
        .catch(() => {
          const slots = grid.querySelectorAll("[data-slot]");
          for (let i = 0; i < slots.length; i++) {
            const badge = slots[i].querySelector("[data-slot-badge]");
            if (badge) {
              badge.textContent = "Available";
              badge.className = "sponsor-slot-badge is-available";
            }
          }
        });
    }
  }

  // ── Audience stats bar ─────────────────────────────────────────────

  const statsSection = document.querySelector("[data-sponsor-stats]");
  if (statsSection) {
    const statsAdminUrl = (statsSection.getAttribute("data-admin-url") || "").replace(/\/$/, "");
    if (statsAdminUrl) {
      fetch(`${statsAdminUrl}/sponsor-stats`, { cache: "default" })
        .then((r) => { return r.ok ? r.json() : null; })
        .then((stats) => {
          if (!stats) {
            statsSection.style.display = "none";
            return;
          }

          let hasAny = false;

          // Subscribers
          if (stats.subscribers) {
            const subEl = statsSection.querySelector('[data-stat="subscribers"] [data-stat-number]');
            if (subEl) { subEl.textContent = formatNumber(stats.subscribers); hasAny = true; }
          }

          // Open rate
          if (stats.openRate != null) {
            const orEl = statsSection.querySelector('[data-stat="openRate"] [data-stat-number]');
            if (orEl) { orEl.textContent = `${stats.openRate}%`; hasAny = true; }
          }

          // Click rate
          if (stats.clickRate != null) {
            const crEl = statsSection.querySelector('[data-stat="clickRate"] [data-stat-number]');
            if (crEl) { crEl.textContent = `${stats.clickRate}%`; hasAny = true; }
          }

          // Podcast downloads. Buzzsprout only reports lifetime plays, so the
          // trailing figure is a delta the worker computes against a stored
          // snapshot. downloadDaysTracked is the window that delta actually
          // covers — 30 once the snapshot history is deep enough, fewer while
          // it is still filling, 0 when there is no baseline yet and we have
          // to fall back to the all-time total.
          const windowDays = stats.windowDays || 30;
          const days = stats.downloadDaysTracked || 0;
          const shortWindow = days > 0 && days < windowDays - 2;

          const mfRolling = days > 0 && stats.mfMonthlyDownloads != null;
          const mfValue = mfRolling ? stats.mfMonthlyDownloads : stats.mfTotalDownloads;
          if (mfValue) {
            const mfEl = statsSection.querySelector('[data-stat="mfDownloads"] [data-stat-number]');
            const mfLabelEl = statsSection.querySelector('[data-stat="mfDownloads"] .stat-label');
            if (mfEl) { mfEl.textContent = formatNumber(mfValue); hasAny = true; }
            if (mfLabelEl && !mfRolling) { mfLabelEl.textContent = "Mere Fidelity Downloads (All Time)"; }
          }

          const crcRolling = days > 0 && stats.crcMonthlyDownloads != null;
          const crcValue = crcRolling ? stats.crcMonthlyDownloads : stats.crcTotalDownloads;
          if (crcValue) {
            const crcEl = statsSection.querySelector('[data-stat="crcDownloads"] [data-stat-number]');
            const crcLabelEl = statsSection.querySelector('[data-stat="crcDownloads"] .stat-label');
            if (crcEl) { crcEl.textContent = formatNumber(crcValue); hasAny = true; }
            if (crcLabelEl && !crcRolling) { crcLabelEl.textContent = "Christians Reading Classics Downloads (All Time)"; }
          }

          // Pageviews
          if (stats.monthlyPageviews) {
            const pvEl = statsSection.querySelector('[data-stat="pageviews"] [data-stat-number]');
            if (pvEl) { pvEl.textContent = formatNumber(stats.monthlyPageviews); hasAny = true; }
          }

          // Period note. The markup already claims a clean trailing 30 days;
          // only rewrite it when something on the bar covers less than that,
          // so the page never advertises a window it did not measure.
          const noteEl = statsSection.querySelector("[data-stats-note]");
          if (noteEl) {
            const caveats = [];
            if (shortWindow) {
              caveats.push(`Podcast downloads cover the last ${days} days.`);
            } else if (days === 0 && (mfValue || crcValue)) {
              caveats.push("Podcast downloads are all-time totals.");
            }
            if (stats.emailWindowDays == null && stats.emailSampleSize) {
              caveats.push(`Email rates average the ${stats.emailSampleSize} most recent sends.`);
            }
            if (caveats.length) {
              noteEl.textContent = `Trailing ${windowDays} days. Free members is a current total. ${caveats.join(" ")}`;
            }
          }

          // If no data at all, hide the section
          if (!hasAny) {
            statsSection.style.display = "none";
          } else {
            statsSection.classList.add("is-loaded");
          }
        })
        .catch(() => {
          statsSection.style.display = "none";
        });
    }
  }

  // Format large numbers: 1234 → "1,234", 15400 → "15.4K", 1500000 → "1.5M"
  function formatNumber(n) {
    if (n >= 1000000) {
      const m = n / 1000000;
      return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
    }
    if (n >= 10000) {
      const k = n / 1000;
      return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K`;
    }
    return n.toLocaleString("en-US");
  }
})();
