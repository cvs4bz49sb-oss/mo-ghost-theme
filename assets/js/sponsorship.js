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
 * sponsor_<slot>_until (freeform date text). Settings also carries the
 * hand-entered podcast download figures the stats bar prefers, so both
 * blocks below share a single /settings call.
 */
(function () {
  const anyAdminEl = document.querySelector("[data-sponsor-inventory], [data-sponsor-stats]");
  const adminUrl = anyAdminEl ? (anyAdminEl.getAttribute("data-admin-url") || "").replace(/\/$/, "") : "";
  const settingsPromise = adminUrl
    ? fetch(`${adminUrl}/settings`, { cache: "default" })
        .then((r) => { return r.ok ? r.json() : null; })
        .catch(() => null)
    : Promise.resolve(null);

  // ── Inventory status badges ────────────────────────────────────────

  const grid = document.querySelector("[data-sponsor-inventory]");
  if (grid) {
    if (adminUrl) {
      settingsPromise
        .then((settings) => {
          if (!settings) throw new Error("no settings");
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
    if (adminUrl) {
      Promise.all([
        fetch(`${adminUrl}/sponsor-stats`, { cache: "default" })
          .then((r) => { return r.ok ? r.json() : null; })
          .catch(() => null),
        settingsPromise
      ])
        .then((results) => {
          const stats = results[0];
          const settings = results[1] || {};
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

          // Podcast downloads over the trailing window.
          //
          // Buzzsprout has no stats API. The only download data the token
          // buys is total_plays per episode, which measures something
          // narrower than the downloads Buzzsprout itself reports — it came
          // out roughly 3x low against their own dashboard, both as a
          // monthly delta and averaged per episode. So the hand-entered
          // figure from Settings wins whenever it is set, and anything
          // derived is a clearly-labelled estimate behind it.
          const windowDays = stats.windowDays || 30;
          const days = stats.downloadDaysTracked || 0;

          const shows = [
            { stat: "mfDownloads", override: settings.sponsor_mf_downloads_30d, monthly: stats.mfMonthlyDownloads },
            { stat: "crcDownloads", override: settings.sponsor_crc_downloads_30d, monthly: stats.crcMonthlyDownloads }
          ];

          let estimated = 0;
          let confirmed = 0;
          for (let i = 0; i < shows.length; i++) {
            const show = shows[i];
            const numEl = statsSection.querySelector(`[data-stat="${show.stat}"] [data-stat-number]`);
            const entered = parseInt(String(show.override == null ? "" : show.override).replace(/[,\s]/g, ""), 10);
            let value = null;
            if (!isNaN(entered) && entered > 0) {
              value = entered;
              confirmed++;
            } else if (days > 0 && show.monthly) {
              value = show.monthly;
              estimated++;
            }
            if (value && numEl) { numEl.textContent = formatNumber(value); hasAny = true; }
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

            // Only the hand-entered figures match what Buzzsprout reports.
            // Anything derived says so rather than passing as measured.
            if (estimated && !confirmed) {
              parts.push(days > 0 && days < windowDays - 2
                ? `Podcast downloads are an estimate covering the last ${days} days.`
                : "Podcast downloads are an estimate.");
            } else if (estimated && confirmed) {
              parts.push("One podcast figure is an estimate.");
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
