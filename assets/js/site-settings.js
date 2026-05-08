/*
 * Public site-settings loader. Fetches operational settings from the
 * mo-admin worker (GET /settings, no auth) and applies them to the
 * current page. Settings are cached in sessionStorage for 5 minutes
 * so repeat navigations are instant.
 *
 * Consumers:
 *   - Homepage journal status: [data-journal-issue], [data-journal-stage]
 *   - Post gate: [data-post-gate] gets data-gate-days / data-gate-tier
 *
 * Fires a "mo:settings" CustomEvent on document when values are ready.
 */
(function () {
  var adminUrl = document.body.getAttribute("data-admin-worker-url");
  if (!adminUrl) return;

  var CACHE_KEY = "mo_site_settings";
  var CACHE_TTL = 5 * 60 * 1000;

  function apply(settings) {
    window.MO_SITE_SETTINGS = settings;

    var issueEl = document.querySelector("[data-journal-issue]");
    if (issueEl) issueEl.textContent = settings.journal_status_issue || "";

    var stages = document.querySelectorAll("[data-journal-stage]");
    for (var i = 0; i < stages.length; i++) {
      var el = stages[i];
      if (el.getAttribute("data-journal-stage") === settings.journal_status_stage) {
        el.classList.add("is-active");
      } else {
        el.classList.remove("is-active");
      }
    }

    var gateEl = document.querySelector("[data-post-gate]");
    if (gateEl) {
      gateEl.setAttribute("data-gate-days", settings.gate_days || "0");
      gateEl.setAttribute("data-gate-tier", settings.gate_tier || "members");
    }

    document.dispatchEvent(new CustomEvent("mo:settings", { detail: settings }));
  }

  try {
    var raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) {
      var data = JSON.parse(raw);
      if (Date.now() - data.ts < CACHE_TTL) {
        apply(data.settings);
        return;
      }
    }
  } catch (e) {}

  fetch(adminUrl + "/settings")
    .then(function (r) { return r.json(); })
    .then(function (settings) {
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), settings: settings })); } catch (e) {}
      apply(settings);
    })
    .catch(function () {});
})();
