/*
 * /digest/ admin-tool bootstrap (runs before the React modules):
 *
 *   1. Read MO_DIGEST_ASSETS from the meta tag the template emits
 *      (template can't be inlined any other way — paths include
 *      {{@site.url}}). Make available as window.MO_DIGEST_ASSETS so
 *      the rest of the digest JS picks it up unchanged.
 *
 *   2. Take over the #root mount point. The shipped JSX hardcodes
 *      ReactDOM.createRoot(document.getElementById('root')); we
 *      rename any pre-existing #root on the page (avoids stomping
 *      a host page that uses #root for its own purposes) and then
 *      apply the #root id to our scoped #mo-digest-root.
 */
(function () {
  var meta = document.querySelector('meta[name="mo-digest-assets"]');
  if (meta && meta.getAttribute("content")) {
    try { window.MO_DIGEST_ASSETS = JSON.parse(meta.getAttribute("content")); }
    catch (_) { window.MO_DIGEST_ASSETS = {}; }
  }

  var existing = document.getElementById("root");
  var ownRoot = document.getElementById("mo-digest-root");
  if (!ownRoot) return;
  if (existing && existing !== ownRoot) {
    existing.id = "__non_digest_root_" + Math.random().toString(36).slice(2);
  }
  ownRoot.id = "root";
})();
