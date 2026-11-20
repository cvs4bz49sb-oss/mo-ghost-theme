/*
 * Live year-end meter (Ian, 2026-11-17). Fills every [data-eoy-meter]
 * (partials/year-end-meter.hbs: the /year-end/ hero, the bottom bar and,
 * from 2026-11-20, the header menu's Support panel)
 * from mo-admin GET /eoy/meter, which adds every online payment since
 * Nov 13 to the offline amount staff keep on /admin/slide-ins/
 * (admin/lib/eoy-stats.js in mo-workers).
 *
 * The answer is kept in sessionStorage for 2 minutes so moving between
 * pages does not ask again. If the worker cannot be reached the template's
 * own figures stay, so the meter is never blank.
 */
(function () {
  // Skip the bar's meter when the bar stays hidden (closed, a skipped page,
  // campaign over). eoy-bar.js has already run by now. The header menu
  // (#mm, partials/nav-mega.hbs) is hidden until it opens, so its meter is
  // filled anyway.
  //
  // The -v2 suffix is a cache-buster (2026-11-20): the CDN keys on path, so
  // an edited file keeps serving its old bytes at the old name.
  const meters = Array.prototype.filter.call(document.querySelectorAll("[data-eoy-meter]"), (el) => !el.closest("[hidden]") || el.closest("[data-mm]"));
  if (!meters.length) return;
  const base = ((document.body && document.body.getAttribute("data-admin-worker-url")) || "").replace(/\/+$/, "");
  if (!base) return;
  const KEY = "mo_eoy_meter";
  const TTL = 120000;

  const dollars = (cents) => `$${Math.round(cents / 100).toLocaleString("en-US")}`;

  function paint(m) {
    const goal = Number(m.goal_cents) || 0;
    const raised = Math.max(0, Number(m.raised_cents) || 0);
    if (!goal) return;
    const pct = Math.min(100, Math.floor((100 * raised) / goal));
    const left = Math.max(0, goal - raised);
    let asof = "";
    try {
      asof = new Date(m.as_of).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" });
    } catch (e) { /* leave the template's line */ }
    meters.forEach((el) => {
      el.querySelectorAll("[data-eoy-raised]").forEach((n) => { n.textContent = dollars(raised); });
      el.querySelectorAll("[data-eoy-left]").forEach((n) => {
        n.textContent = left ? `${dollars(left)} to go` : "Goal met. Thank you.";
      });
      el.querySelectorAll("[data-eoy-fill]").forEach((n) => { n.style.width = `${pct}%`; });
      el.querySelectorAll("[data-eoy-track]").forEach((n) => {
        n.setAttribute("aria-valuenow", String(pct));
        n.setAttribute("aria-valuetext", `${dollars(raised)} of ${dollars(goal)} raised`);
      });
      if (asof) el.querySelectorAll("[data-eoy-asof]").forEach((n) => { n.textContent = `Updated ${asof}`; });
    });
  }

  try {
    const hit = JSON.parse(window.sessionStorage.getItem(KEY) || "null");
    if (hit && Date.now() - hit.t < TTL && hit.m) { paint(hit.m); return; }
  } catch (e) { /* fetch below */ }

  fetch(`${base}/eoy/meter`, { credentials: "omit" })
    .then((r) => (r.ok ? r.json() : null))
    .then((m) => {
      if (!m || !m.goal_cents) return;
      paint(m);
      try { window.sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), m })); } catch (e) { /* noop */ }
    })
    .catch(() => { /* keep the template's figures */ });
})();
