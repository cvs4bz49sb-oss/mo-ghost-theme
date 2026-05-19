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

  var grid = document.querySelector("[data-sponsor-inventory]");
  if (grid) {
    var adminUrl = (grid.getAttribute("data-admin-url") || "").replace(/\/$/, "");
    if (adminUrl) {
      fetch(adminUrl + "/settings", { cache: "default" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (settings) {
          if (!settings) return;
          var slots = grid.querySelectorAll("[data-slot]");
          for (var i = 0; i < slots.length; i++) {
            var el = slots[i];
            var key = el.getAttribute("data-slot");
            var status = settings["sponsor_" + key + "_status"] || "available";
            var until = settings["sponsor_" + key + "_until"] || "";
            var badge = el.querySelector("[data-slot-badge]");
            if (!badge) continue;

            if (status === "filled") {
              badge.textContent = until ? "Filled until " + until : "Filled";
              badge.className = "sponsor-slot-badge is-filled";
              el.classList.add("is-filled");
            } else {
              badge.textContent = "Available";
              badge.className = "sponsor-slot-badge is-available";
              el.classList.add("is-available");
            }
          }
        })
        .catch(function () {
          var slots = grid.querySelectorAll("[data-slot]");
          for (var i = 0; i < slots.length; i++) {
            var badge = slots[i].querySelector("[data-slot-badge]");
            if (badge) {
              badge.textContent = "Available";
              badge.className = "sponsor-slot-badge is-available";
            }
          }
        });
    }
  }

  // ── Audience stats bar ─────────────────────────────────────────────

  var statsSection = document.querySelector("[data-sponsor-stats]");
  if (statsSection) {
    var statsAdminUrl = (statsSection.getAttribute("data-admin-url") || "").replace(/\/$/, "");
    if (statsAdminUrl) {
      fetch(statsAdminUrl + "/sponsor-stats", { cache: "default" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (stats) {
          if (!stats) {
            statsSection.style.display = "none";
            return;
          }

          var hasAny = false;

          // Subscribers
          if (stats.subscribers) {
            var subEl = statsSection.querySelector('[data-stat="subscribers"] [data-stat-number]');
            if (subEl) { subEl.textContent = formatNumber(stats.subscribers); hasAny = true; }
          }

          // Downloads — prefer monthly, fall back to total
          var dlValue = stats.monthlyDownloads || stats.totalDownloads;
          var dlLabel = stats.monthlyDownloads ? "Monthly Downloads" : "Total Downloads";
          if (dlValue) {
            var dlEl = statsSection.querySelector('[data-stat="downloads"] [data-stat-number]');
            var dlLabelEl = statsSection.querySelector('[data-stat="downloads"] .stat-label');
            if (dlEl) { dlEl.textContent = formatNumber(dlValue); hasAny = true; }
            if (dlLabelEl) { dlLabelEl.textContent = dlLabel; }
          }

          // Pageviews
          if (stats.monthlyPageviews) {
            var pvEl = statsSection.querySelector('[data-stat="pageviews"] [data-stat-number]');
            if (pvEl) { pvEl.textContent = formatNumber(stats.monthlyPageviews); hasAny = true; }
          }

          // If no data at all, hide the section
          if (!hasAny) {
            statsSection.style.display = "none";
          } else {
            statsSection.classList.add("is-loaded");
          }
        })
        .catch(function () {
          statsSection.style.display = "none";
        });
    }
  }

  // Format large numbers: 1234 → "1,234", 15400 → "15.4K", 1500000 → "1.5M"
  function formatNumber(n) {
    if (n >= 1000000) {
      var m = n / 1000000;
      return (m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)) + "M";
    }
    if (n >= 10000) {
      var k = n / 1000;
      return (k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)) + "K";
    }
    return n.toLocaleString("en-US");
  }
})();
