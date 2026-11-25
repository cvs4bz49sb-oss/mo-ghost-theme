/*
 * /admin/ opens MOOS while the "Try MOOS" switch is on (Ian, 2026-11-25; MOCA
 * website/moos/WEB.md). The switch stores localStorage["mo-moos"]: "1" on,
 * "0" off (assets/js/moos-switch.js).
 *
 * Loaded in custom-admin.hbs's head, for signed-in members only, so the
 * classic dashboard never paints before the move. replace() keeps /admin/ out
 * of the history, so Back does not bounce.
 *
 * It also needs "mo-moos-ok", which the MOOS page stores once it has
 * rendered in this browser, so a click made before routes.yaml carried
 * /admin/moos/app/ (a 404) cannot trap /admin/.
 *
 * /admin/?moos=0 turns the switch off from here and stays. It is the way out
 * if MOOS will not load, since the switch inside MOOS is the usual one.
 */
(function () {
  "use strict";
  let on = false;
  try {
    if (/(?:^|[?&])moos=0(?:&|$)/.test(window.location.search.slice(1))) localStorage.setItem("mo-moos", "0");
    on = localStorage.getItem("mo-moos") === "1" && localStorage.getItem("mo-moos-ok") === "1";
  } catch (_) {
    return; // storage blocked: the switch cannot have been turned on
  }
  if (!on) return;
  // eslint-disable-next-line no-restricted-syntax -- a fixed same-origin path, never data
  window.location.replace("/admin/moos/app/");
})();
