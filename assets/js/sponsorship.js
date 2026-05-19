/*
 * Sponsorship page — fetches ad-slot availability from admin worker
 * settings and renders status badges. The admin worker's GET /settings
 * endpoint is public (no auth required, 60s cache).
 *
 * Each slot element has [data-slot="nl_top"] etc. The settings response
 * contains sponsor_<slot>_status ("available"/"filled") and
 * sponsor_<slot>_until (freeform date text).
 */
(function () {
  var grid = document.querySelector("[data-sponsor-inventory]");
  if (!grid) return;

  var adminUrl = (grid.getAttribute("data-admin-url") || "").replace(/\/$/, "");
  if (!adminUrl) return;

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
      // If the fetch fails, show "Available" as fallback
      var slots = grid.querySelectorAll("[data-slot]");
      for (var i = 0; i < slots.length; i++) {
        var badge = slots[i].querySelector("[data-slot-badge]");
        if (badge) {
          badge.textContent = "Available";
          badge.className = "sponsor-slot-badge is-available";
        }
      }
    });
})();
