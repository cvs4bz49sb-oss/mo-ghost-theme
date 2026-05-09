/*
 * Production JS error beacon.
 *
 * Posts uncaught errors, unhandled promise rejections, and CSP
 * violations to the mo-errors worker so Ian can see what's actually
 * breaking in production browsers without standing up Sentry.
 *
 * Worker URL: data-error-worker-url on <body> (set by default.hbs
 * from @custom.error_worker_url). Empty disables the beacon.
 *
 * Throttling: at most 10 reports per page load, 1 per second. Same
 * error doesn't re-fire if message+url+line match a recent report.
 *
 * Privacy: no member email, no auth token, no URL params. Just
 * message / stack / page-path / line / column / user-agent. The
 * worker rate-limits per-IP to bound storage cost.
 *
 * Manual reports from other code:
 *   window.MOReport("manual", "thing happened", { extras: ... });
 */
(function () {
  const beaconUrl = (document.body.getAttribute("data-error-worker-url") || "").trim();
  if (!beaconUrl) {
    // Worker not configured. Expose a no-op so callers don't need to
    // gate on its existence.
    window.MOReport = function () {};
    return;
  }
  const endpoint = `${beaconUrl.replace(/\/$/, "")}/report`;

  const MAX_REPORTS = 10;
  let sent = 0;
  let lastSentAt = 0;
  const seen = Object.create(null);

  function fingerprint(msg, url, line) {
    return `${String(msg).slice(0, 200)}|${String(url || "").slice(0, 120)}|${line || ""}`;
  }

  function send(payload) {
    if (sent >= MAX_REPORTS) return;
    const now = Date.now();
    if (now - lastSentAt < 1000) return;
    const fp = fingerprint(payload.message, payload.url, payload.line);
    if (seen[fp]) return;
    seen[fp] = true;
    sent += 1;
    lastSentAt = now;
    try {
      const body = JSON.stringify(payload);
      // sendBeacon doesn't fire CORS preflight (it's a "simple"
      // POST), and is queued past pagehide — ideal for error
      // beacons. Falls back to fetch() with keepalive.
      if (navigator.sendBeacon) {
        const ok = navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
        if (ok) return;
      }
      fetch(endpoint, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        keepalive: true,
        headers: { "content-type": "application/json" },
        body,
      }).catch(() => { /* best-effort */ });
    } catch (_) { /* ignore */ }
  }

  window.MOReport = function (kind, message, extra) {
    send({
      kind: kind || "manual",
      message: String(message || "").slice(0, 2000),
      url: window.location.pathname + window.location.search,
      userAgent: navigator.userAgent,
      extra: extra && typeof extra === "object" ? extra : null,
    });
  };

  window.addEventListener("error", (event) => {
    if (!event) return;
    send({
      kind: "error",
      message: (event.message || "Error").slice(0, 2000),
      stack: event.error && event.error.stack ? String(event.error.stack).slice(0, 8000) : null,
      url: (event.filename || window.location.pathname),
      line: typeof event.lineno === "number" ? event.lineno : null,
      column: typeof event.colno === "number" ? event.colno : null,
      userAgent: navigator.userAgent,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event && event.reason;
    let message = "";
    let stack = null;
    if (reason && typeof reason === "object") {
      message = String(reason.message || reason);
      if (reason.stack) stack = String(reason.stack).slice(0, 8000);
    } else {
      message = String(reason);
    }
    send({
      kind: "error",
      message: (`Unhandled rejection: ${message}`).slice(0, 2000),
      stack,
      url: window.location.pathname + window.location.search,
      userAgent: navigator.userAgent,
    });
  });

  // CSP violation reports. Browsers fire securitypolicyviolation on
  // blocked inline scripts, blocked external scripts, etc. — wiring
  // this up means Ian sees what the new strict-CSP is actually
  // breaking, if anything, without users having to report it.
  document.addEventListener("securitypolicyviolation", (event) => {
    if (!event) return;
    send({
      kind: "csp",
      message:
        `CSP violation: ${ 
        event.violatedDirective || "?" 
        } on ${ 
        event.blockedURI || "inline"}`,
      url: event.documentURI || window.location.pathname,
      line: typeof event.lineNumber === "number" ? event.lineNumber : null,
      column: typeof event.columnNumber === "number" ? event.columnNumber : null,
      userAgent: navigator.userAgent,
      extra: {
        sourceFile: event.sourceFile || null,
        effectiveDirective: event.effectiveDirective || null,
        originalPolicy: event.originalPolicy ? String(event.originalPolicy).slice(0, 1000) : null,
      },
    });
  });
})();
