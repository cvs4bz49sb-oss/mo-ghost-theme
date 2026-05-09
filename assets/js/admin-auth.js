/*
 * MOAuth — closure-private Ghost member JWT helper.
 *
 * The Ghost members identity token (RS512, sub=email) is fetched from
 * /members/api/session/ on demand and cached in module-scope variables
 * inside this IIFE. The token NEVER appears on `window` — only the
 * single public method `MOAuth.fetch(url, init)` is exposed, which
 * attaches the bearer header internally before delegating to
 * window.fetch.
 *
 * Threat model: with admin-auth.js loaded site-wide (default.hbs), an
 * XSS anywhere on the site previously could call
 * `await window.MOAdminAuth.getToken()` and walk away with the bearer.
 * Closure-private design: the XSS can still call `MOAuth.fetch` to
 * make authenticated requests in the visitor's name — we can't stop
 * that without removing the helper entirely — but it CANNOT extract
 * the bearer to use against other systems or persist for later abuse.
 *
 * Public API (window.MOAuth):
 *   fetch(url, init?)
 *     Returns Promise<Response>. Identical to fetch() but with
 *     `Authorization: Bearer <jwt>` attached if a member is signed in.
 *     Init.headers is preserved; Authorization is overwritten.
 *
 * Notes:
 * - When no member is signed in (or token fetch fails) the request
 *   goes out without an Authorization header. Worker is responsible
 *   for returning 401 if it requires auth.
 * - Token expiry: refreshed ~30s before exp claim. On 401 the token
 *   is invalidated immediately so the next call re-fetches a fresh one.
 *
 * Back-compat:
 * - The previous global `window.MOAdminAuth` (with .headers() and
 *   .getToken()) is REMOVED in this commit. Any caller still using
 *   it will error loudly — the synthesis flagged that as the desired
 *   behavior so a regression doesn't silently send unauthenticated
 *   requests. All in-tree callers were converted in the same commit.
 */
(function () {
  let cachedToken = null;
  let cachedExp = 0;

  async function fetchTokenInternal() {
    try {
      const r = await fetch("/members/api/session/", { credentials: "same-origin" });
      if (!r.ok) return null;
      const text = (await r.text()).trim();
      let token = text;
      if (text.startsWith("{")) {
        try {
          const j = JSON.parse(text);
          token = j.identity || j.token || null;
        } catch (_) { token = null; }
      }
      if (!token) return null;
      try {
        const parts = token.split(".");
        const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
        cachedExp = (payload.exp || 0) * 1000;
      } catch (_) {
        cachedExp = Date.now() + 5 * 60 * 1000;
      }
      cachedToken = token;
      return token;
    } catch (_) {
      return null;
    }
  }

  async function getTokenInternal() {
    if (cachedToken && Date.now() < cachedExp - 30 * 1000) return cachedToken;
    return await fetchTokenInternal();
  }

  function invalidate() {
    cachedToken = null;
    cachedExp = 0;
  }

  async function authedFetch(url, init) {
    const opts = Object.assign({}, init || {});
    const headers = new Headers((init && init.headers) || {});
    const token = await getTokenInternal();
    if (token) headers.set("Authorization", "Bearer " + token);
    opts.headers = headers;
    const res = await fetch(url, opts);
    // If the worker rejects the bearer (401), drop the cached token
    // so the next call refetches. Don't auto-retry — the caller may
    // want to surface the 401 to the user.
    if (res.status === 401) invalidate();
    return res;
  }

  // Pre-warm the token on load so the first authenticated fetch
  // (often during pagehide for kit-events) doesn't need to wait
  // for /members/api/session/. Fire-and-forget.
  try { getTokenInternal(); } catch (_) { /* noop */ }

  window.MOAuth = { fetch: authedFetch };
})();
