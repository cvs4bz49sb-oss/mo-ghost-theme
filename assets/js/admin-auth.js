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
 * couldn't extract it via `window.MOAdminAuth.getToken()`. The first
 * Codex audit (2026-05-11) added a destination allowlist so the bearer
 * couldn't be sent to `attacker.workers.dev`. The second Codex pass
 * (same day) found a bypass: the allowlist was harvested from DOM
 * data attributes (`[data-worker-url]` etc.) and re-harvested on
 * cache misses, so an XSS could inject a node with the right attribute
 * and extend the allowlist arbitrarily.
 *
 * This version eliminates the DOM mutation surface. The allowlist
 * comes from a SINGLE server-rendered <meta name="mo-trusted-hosts">
 * stamped into <head> by default.hbs (rendered from @custom worker
 * URLs at template-render time + hardcoded mo-audio/mo-pdf hosts).
 * admin-auth.js reads that meta exactly ONCE at IIFE time, before
 * {{{body}}} renders, before any page-template scripts run, before
 * any XSS could possibly fire — and freezes the result. The runtime
 * never re-reads DOM-mutable state.
 *
 * authedFetch:
 *   - rejects (TypeError, console.error'd) for any destination not in
 *     the frozen allowlist
 *   - rejects for non-https cross-origin destinations
 *   - attaches Authorization: Bearer <jwt> for allowlisted destinations
 *   - falls through to fetch() without auth for same-origin (the JWT
 *     isn't useful to same-origin code anyway — it's for workers)
 *
 * Irreducible residue: an XSS can still call MOAuth.fetch against a
 * legitimately trusted worker (e.g. POST a bookmark in the user's
 * name). We can't distinguish legitimate JS from XSS-injected JS
 * once they share the page. But the JWT can no longer be exfiltrated
 * to use against other systems or persist for later abuse.
 *
 * Public API (window.MOAuth):
 *   fetch(url, init?)
 *     Returns Promise<Response>. Identical to fetch() but with
 *     Authorization attached iff destination is allowlisted.
 *
 * Adding a new worker:
 *   Edit default.hbs <meta name="mo-trusted-hosts"> to include its
 *   URL. (And add the host to CSP `connect-src`.)
 *
 * Back-compat:
 *   The previous global `window.MOAdminAuth` is REMOVED. Any caller
 *   still using it errors loudly.
 */
(function () {
  let cachedToken = null;
  let cachedExp = 0;

  // ---------------------------------------------------------------------
  // Destination allowlist — frozen at IIFE time, never re-read.
  // ---------------------------------------------------------------------

  const trustedHosts = (function buildAllowlist() {
    const out = new Set();
    out.add(location.host); // same-origin is always trusted
    const meta = document.querySelector('meta[name="mo-trusted-hosts"]');
    if (!meta) return out;
    const raw = meta.getAttribute("content") || "";
    // Pipe-separated full URLs. Empty values (from un-set @custom slots)
    // are skipped; malformed URLs are skipped.
    for (const candidate of raw.split("|")) {
      const url = candidate.trim();
      if (!url) continue;
      try {
        const parsed = new URL(url);
        // Only https destinations get into the allowlist. Stamped
        // values from @custom should always be https — this is
        // defense in depth against a misconfigured @custom URL.
        if (parsed.protocol !== "https:") continue;
        out.add(parsed.host);
      } catch (_) { /* malformed — skip */ }
    }
    return out;
  })();

  function isTrusted(url) {
    let parsed;
    try { parsed = new URL(url, location.href); }
    catch (_) { return false; }
    // Allowlist is frozen. We do NOT re-harvest the DOM on miss —
    // that was the P0 bypass vector. If a destination isn't in the
    // server-rendered list, it doesn't get the bearer, full stop.
    if (!trustedHosts.has(parsed.host)) return false;
    // Reject non-https cross-origin even if host is in allowlist —
    // defense against a future bug where someone stamps http:// in
    // the meta tag.
    if (parsed.origin !== location.origin && parsed.protocol !== "https:") {
      return false;
    }
    return true;
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
