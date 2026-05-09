/*
 * Safe-href helper.
 *
 * Many places in the theme set <a>.href or window.location from a URL
 * that crossed a trust boundary (worker response, Ghost Content API,
 * admin @custom value, build-time JSON, user-controlled commonplace
 * entry). escapeAttr() escapes HTML special characters but does NOT
 * reject `javascript:` URLs — assigning one to .href is a confirmed
 * XSS sink.
 *
 * This helper validates that the URL is on an allowed scheme before
 * letting the caller use it. Allowed:
 *   - https: or http:
 *   - mailto: (used for support links)
 *   - tel: (used in a few footers)
 *   - path-relative ("/foo", "foo/bar", "#anchor", "?query")
 * Rejected:
 *   - javascript:, data:, vbscript:, file:, blob:, etc.
 *
 * Usage:
 *   var clean = window.MOSafeHref.sanitize(url);   // returns "" if rejected
 *   if (window.MOSafeHref.isSafe(url)) { ... }
 *   window.MOSafeHref.set(el, url, "#fallback");   // assigns el.href
 */
(function () {
  var ALLOWED_SCHEMES = ["http:", "https:", "mailto:", "tel:"];

  function isPathRelative(url) {
    if (typeof url !== "string") return false;
    if (url === "") return false;
    var first = url.charAt(0);
    // Path-, query-, or fragment-relative — never carries a scheme.
    if (first === "/" || first === "#" || first === "?") return true;
    // A relative path like "foo/bar" — no scheme, no protocol-relative.
    if (first !== "." && url.indexOf(":") === -1) return true;
    if (first === ".") return true;
    return false;
  }

  function isSafe(url) {
    if (url == null) return false;
    if (typeof url !== "string") return false;
    if (isPathRelative(url)) return true;
    try {
      var u = new URL(url, window.location.origin);
      for (var i = 0; i < ALLOWED_SCHEMES.length; i++) {
        if (u.protocol === ALLOWED_SCHEMES[i]) return true;
      }
      console.error("MOSafeHref rejected:", url, "(protocol:", u.protocol + ")");
      return false;
    } catch (_) {
      console.error("MOSafeHref rejected (unparsable):", url);
      return false;
    }
  }

  function sanitize(url, fallback) {
    return isSafe(url) ? url : (fallback || "");
  }

  function set(el, url, fallback) {
    if (!el) return;
    el.href = sanitize(url, fallback || "#");
  }

  window.MOSafeHref = {
    isSafe: isSafe,
    sanitize: sanitize,
    set: set,
  };
})();
