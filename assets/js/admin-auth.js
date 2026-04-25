/*
 * Admin auth helper for the theme.
 *
 * Workers (mo-admin, mo-membership/api/admin/*, mo-kit-bridge) require
 * an Authorization: Bearer <jwt> header where <jwt> is a Ghost members
 * identity token. Ghost mints these for the currently logged-in member
 * via GET /members/api/identity/. Tokens expire after ~10 minutes, so
 * we cache one and refetch on demand.
 *
 * Usage:
 *   const headers = await window.MOAdminAuth.headers();
 *   fetch(workerUrl + path, { headers });
 *
 * Returns an empty object on failure (e.g. user not logged in) — the
 * worker call will then 401 and the page should surface the denied
 * state. Callers don't have to special-case auth failures themselves.
 */
(function () {
  let cachedToken = null;
  let cachedExp = 0;

  async function fetchToken() {
    try {
      const r = await fetch("/members/api/identity/", { credentials: "same-origin" });
      if (!r.ok) return null;
      const text = (await r.text()).trim();
      // Ghost returns plain text in current versions; some older versions
      // wrapped it in JSON { identity }. Accept either.
      let token = text;
      if (text.startsWith("{")) {
        try {
          const j = JSON.parse(text);
          token = j.identity || j.token || null;
        } catch (_) { token = null; }
      }
      if (!token) return null;
      // Decode payload to learn expiry without verifying — we don't
      // need to verify here, the worker will.
      try {
        const parts = token.split(".");
        const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
        cachedExp = (payload.exp || 0) * 1000;
      } catch (_) {
        cachedExp = Date.now() + 5 * 60 * 1000; // assume 5 min
      }
      cachedToken = token;
      return token;
    } catch (_) {
      return null;
    }
  }

  async function getToken() {
    // Refresh ~30s before expiry to avoid races where we send a
    // token that expires mid-flight.
    if (cachedToken && Date.now() < cachedExp - 30 * 1000) return cachedToken;
    return await fetchToken();
  }

  async function headers(extra) {
    const t = await getToken();
    const h = Object.assign({}, extra || {});
    if (t) h["Authorization"] = "Bearer " + t;
    return h;
  }

  window.MOAdminAuth = { getToken, headers };
})();
