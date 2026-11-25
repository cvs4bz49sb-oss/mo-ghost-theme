/*
 * "Try MOOS" (Ian, 2026-11-25; MOCA website/moos/WEB.md, "Host page and
 * switch"). Markup and styles: partials/moos-switch.hbs.
 *
 * The switch shows where you are. On an admin page it is off: turning it on
 * stores localStorage["mo-moos"] = "1" and opens /admin/moos/app/, and while
 * "1" is stored /admin/ itself opens MOOS (assets/js/moos-redirect.js). In MOOS
 * it is on: turning it off stores "0" and opens /admin/.
 *
 * The MOOS page also stores "mo-moos-ok" = "1" when it renders, and
 * moos-redirect.js asks for both. The theme deploys without routes.yaml, so
 * for a while the switch can reach a /admin/moos/app/ that 404s. Without the
 * second key, one click then would send every later /admin/ to that 404.
 *
 * On admin pages it shows for Ghost staff only, because MOOS's web API answers
 * staff and nobody else; a delegated admin user would get an empty app. The
 * staff flag is the /my-permissions answer admin-sidebar.js already fetches
 * (the "mo:admin-perms" event), kept for the tab in sessionStorage so a page
 * that does not load admin-sidebar.js (Migration) still shows it. In MOOS it
 * always shows: it is the way back, and it must work even if MOOS does not.
 */
(function () {
  "use strict";

  const btn = document.querySelector("[data-moos-switch]");
  if (!btn) return;

  const PREF = "mo-moos";
  const STAFF = "mo-moos-staff";
  const APP = "/admin/moos/app/";
  const HOME = "/admin/";
  const inApp = btn.getAttribute("aria-checked") === "true";
  const email = (document.body.getAttribute("data-member-email") || "").trim().toLowerCase();

  function remember(value) {
    try { localStorage.setItem(PREF, value); } catch (_) { /* storage blocked: the switch still moves this once */ }
  }
  function tabGet(key) {
    try { return sessionStorage.getItem(key); } catch (_) { return null; }
  }
  function tabSet(key, value) {
    try {
      if (value) sessionStorage.setItem(key, value);
      else sessionStorage.removeItem(key);
    } catch (_) { /* storage blocked */ }
  }

  btn.addEventListener("click", () => {
    if (btn.hasAttribute("data-moos-going")) return;
    btn.setAttribute("data-moos-going", "");
    btn.setAttribute("aria-checked", inApp ? "false" : "true");
    remember(inApp ? "0" : "1");
    // eslint-disable-next-line no-restricted-syntax -- one of two fixed same-origin paths, never data
    window.location.assign(inApp ? HOME : APP);
  });

  // Back from the other view can restore this page from the back-forward
  // cache with the switch still mid-flip. Put it back to where you are.
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    btn.removeAttribute("data-moos-going");
    btn.setAttribute("aria-checked", inApp ? "true" : "false");
  });

  if (inApp) {
    try { localStorage.setItem("mo-moos-ok", "1"); } catch (_) { /* storage blocked */ }
    btn.hidden = false;
    return;
  }

  function fromPerms(perms) {
    const staff = !!perms && perms.isStaff === true;
    tabSet(STAFF, staff && email ? email : "");
    btn.hidden = !staff;
  }

  if (email && tabGet(STAFF) === email) btn.hidden = false;
  if (window.__moPerms) fromPerms(window.__moPerms);
  else document.addEventListener("mo:admin-perms", (event) => fromPerms(event.detail));
})();
