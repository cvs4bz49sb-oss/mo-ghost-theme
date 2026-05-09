/*
 * Read the membership API base URL from the meta tag the theme
 * emits and expose it as window.MO_API_BASE for the membership-
 * related JS to consume. Replaces the per-template inline
 * <script>window.MO_API_BASE = "{{...}}";</script> setters that
 * used to live in custom-gift / custom-groups / custom-membership /
 * etc. — externalizing them lets us drop 'unsafe-inline' from CSP.
 */
(function () {
  const meta = document.querySelector('meta[name="mo-api-base"]');
  if (meta && meta.getAttribute("content")) {
    window.MO_API_BASE = meta.getAttribute("content");
  }
})();
