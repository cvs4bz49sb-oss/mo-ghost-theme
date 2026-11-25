/*
 * window.MOOS_WEB for MOOS on the web (/admin/moos/app/, MOCA
 * website/moos/WEB.md "Web adapter"). MOOS's web adapter (assets/moos/web.js)
 * and its Tools read it; without it MOOS runs as the Claude artifact does.
 *
 *   { api: "<mo-admin base>", workers: { admin, email, site, podcast } }
 *
 * The values are the theme's own settings, rendered by
 * custom-admin-moos-app.hbs onto this script's data attributes (the CSP allows
 * no inline script, so a template cannot set a global itself). Loaded as a
 * classic script in the page head, so it has run before web.js and every
 * MOOS module.
 *
 * Every worker here must be in that page's CSP connect-src. One that takes
 * the staff bearer (MOAuth.fetch) must also be in its mo-trusted-hosts meta.
 */
(function () {
  "use strict";
  const el = document.currentScript;
  if (!el) return;

  // An https base with no trailing slash, or "" for an unset or odd value.
  function base(value) {
    try {
      const u = new URL(String(value || "").trim());
      if (u.protocol !== "https:" || u.search || u.hash) return "";
      return `${u.origin}${u.pathname.replace(/\/+$/, "")}`;
    } catch (_) {
      return "";
    }
  }

  const api = base(el.getAttribute("data-admin"));
  if (!api) {
    console.error("[MOOS] admin_worker_url is not set in the theme settings, so MOOS has no data source.");
    return;
  }

  window.MOOS_WEB = {
    api,
    workers: {
      admin: api,
      email: base(el.getAttribute("data-email")),
      site: window.location.origin,
      podcast: base(el.getAttribute("data-podcast")),
    },
  };
})();
