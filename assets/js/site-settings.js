/*
 * Public site-settings loader. Fetches operational settings from the
 * mo-admin worker (GET /settings, no auth) and applies them to the
 * current page. Settings are cached in sessionStorage for 5 minutes
 * so repeat navigations are instant.
 *
 * Consumers:
 *   - Journal status (homepage, header menu): [data-journal-issue], [data-journal-stage]
 *   - Post gate: [data-post-gate] gets data-gate-days / data-gate-tier
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

    // Homepage tracker and the header menu's Journal panel.
    const issues = document.querySelectorAll("[data-journal-issue]");
    for (let i = 0; i < issues.length; i++) issues[i].textContent = settings.journal_status_issue || "";

    const stages = document.querySelectorAll("[data-journal-stage]");
    for (let i = 0; i < stages.length; i++) {
      const el = stages[i];
      if (el.getAttribute("data-journal-stage") === settings.journal_status_stage) {
        el.classList.add("is-active");
        el.parentNode.setAttribute("aria-current", "step");
      } else {
        el.classList.remove("is-active");
        el.parentNode.removeAttribute("aria-current");
      }
    }

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
