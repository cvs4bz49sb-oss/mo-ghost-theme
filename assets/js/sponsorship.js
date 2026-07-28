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

          // Podcast tiles lead with downloads per episode. Buzzsprout has no
          // stats API, so a monthly aggregate can only be a delta against a
          // stored lifetime total — but total_plays per episode is exact, and
          // per-episode is the number a pre-roll or mid-roll buy turns on.
          //
          // The monthly aggregate is still computed and goes in the note
          // below once the snapshot history is deep enough to mean 30 days.
          // Older workers predate these fields; fall back to what they send.
          const windowDays = stats.windowDays || 30;
          const days = stats.downloadDaysTracked || 0;
          const monthlyIsReal = days >= windowDays - 2;

          const shows = [
            {
              stat: "mfDownloads",
              perEpisode: stats.mfDownloadsPerEpisode,
              monthly: stats.mfMonthlyDownloads,
              total: stats.mfTotalDownloads,
              fallbackLabel: "Mere Fidelity Downloads"
            },
            {
              stat: "crcDownloads",
              perEpisode: stats.crcDownloadsPerEpisode,
              monthly: stats.crcMonthlyDownloads,
              total: stats.crcTotalDownloads,
              fallbackLabel: "Christians Reading Classics Downloads"
            }
          ];

          let perEpisodeShown = 0;
          for (let i = 0; i < shows.length; i++) {
            const show = shows[i];
            const numEl = statsSection.querySelector(`[data-stat="${show.stat}"] [data-stat-number]`);
            const labelEl = statsSection.querySelector(`[data-stat="${show.stat}"] .stat-label`);
            let value = show.perEpisode;
            if (value != null) {
              perEpisodeShown++;
            } else {
              // Pre-per-episode worker: keep the old behaviour rather than
              // blanking the tile, and relabel so the number is not read as
              // a per-episode average.
              value = (days > 0 && show.monthly != null) ? show.monthly : show.total;
              if (labelEl && value) {
                labelEl.textContent = (days > 0 && show.monthly != null)
                  ? show.fallbackLabel
                  : `${show.fallbackLabel} (All Time)`;
              }
            }
            if (value) {
              if (numEl) { numEl.textContent = formatNumber(value); hasAny = true; }
            }
          }

          // Pageviews
          if (stats.monthlyPageviews) {
            const pvEl = statsSection.querySelector('[data-stat="pageviews"] [data-stat-number]');
            if (pvEl) { pvEl.textContent = formatNumber(stats.monthlyPageviews); hasAny = true; }
          }

          // Period note. Everything the bar cannot say inside a label goes
          // here, in one line, and nothing gets claimed that was not
          // measured — no window is asserted until it is real.
          const noteEl = statsSection.querySelector("[data-stats-note]");
          if (noteEl) {
            const parts = [`Trailing ${windowDays} days. Free members is a current total.`];

            if (perEpisodeShown) {
              const maturity = stats.episodeMaturityDays || 30;
              parts.push(`Podcast figures are average downloads per episode, across episodes published at least ${maturity} days ago.`);
              // The monthly aggregate is a snapshot delta, so it only gets
              // stated once the history actually spans the window.
              if (monthlyIsReal && stats.mfMonthlyDownloads && stats.crcMonthlyDownloads) {
                parts.push(`Across all episodes the shows drew ${formatNumber(stats.mfMonthlyDownloads)} and ${formatNumber(stats.crcMonthlyDownloads)} downloads over that period.`);
              }
            } else if (days > 0 && days < windowDays - 2) {
              parts.push(`Podcast downloads cover the last ${days} days.`);
            } else if (days === 0) {
              parts.push("Podcast downloads are all-time totals.");
            }

            if (stats.emailWindowDays == null && stats.emailSampleSize) {
              parts.push(`Email rates average the ${stats.emailSampleSize} most recent sends.`);
            }

            noteEl.textContent = parts.join(" ");
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
