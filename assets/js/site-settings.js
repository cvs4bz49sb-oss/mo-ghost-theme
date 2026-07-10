/*
 * Public site-settings loader. Fetches operational settings from the
 * mo-admin worker (GET /settings, no auth) and applies them to the
 * current page. Settings are cached in sessionStorage for 5 minutes
 * so repeat navigations are instant.
 *
 * Consumers:
 *   - Post gate: [data-post-gate] gets data-gate-days / data-gate-tier
 *
 * Journal status (issue label + stage) is now rendered server-side
 * from Ghost custom settings (@custom.journal_status_*) in index.hbs.
 *
 * Fires a "mo:settings" CustomEvent on document when values are ready.
 */
(function () {
  const adminUrl = document.body.getAttribute("data-admin-worker-url");
  if (!adminUrl) return;

  const CACHE_KEY = "mo_site_settings";
  const CACHE_TTL = 5 * 60 * 1000;

  function apply(settings) {
    window.MO_SITE_SETTINGS = settings;

    const gateEl = document.querySelector("[data-post-gate]");
    if (gateEl) {
      gateEl.setAttribute("data-gate-days", settings.gate_days || "0");
      gateEl.setAttribute("data-gate-tier", settings.gate_tier || "members");
    }

    document.dispatchEvent(new CustomEvent("mo:settings", { detail: settings }));
  }

  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Date.now() - data.ts < CACHE_TTL) {
        apply(data.settings);
        return;
      }
    }
  } catch (e) {}

  fetch(`${adminUrl}/settings`)
    .then((r) => { return r.json(); })
    .then((settings) => {
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), settings })); } catch (e) {}
      apply(settings);
    })
    .catch(() => {});
})();
