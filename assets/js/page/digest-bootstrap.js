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
 *
 *   3. Publish window.MODigestRoot so the digest modules can read the
 *      mount point's data-* config without hardcoding an id. The
 *      rename in step 2 means a literal
 *      getElementById("mo-digest-root") elsewhere returns null by the
 *      time React renders — that silently disabled image upload in
 *      content-editor.jsx (workerUrl fell back to "", canUpload went
 *      false, the Upload button never rendered and no error showed).
 *      Digest modules must go through this accessor, never an id
 *      literal, so the two can't drift again.
 */
(function () {
  const SOURCE_ID = "mo-digest-root"; // the id custom-digest-gen.hbs emits
  const MOUNT_ID = "root"; // the id app.jsx mounts on

  const meta = document.querySelector('meta[name="mo-digest-assets"]');
  if (meta && meta.getAttribute("content")) {
    try { window.MO_DIGEST_ASSETS = JSON.parse(meta.getAttribute("content")); }
    catch (_) { window.MO_DIGEST_ASSETS = {}; }
  }

  const existing = document.getElementById(MOUNT_ID);
  const ownRoot = document.getElementById(SOURCE_ID);

  // Bound to the element by reference, so it survives the rename below,
  // stays correct whether or not step 2 ran, and never resolves to some
  // other #root a later DOM injection put on the page.
  // Raw data-* value, "" when absent. dataset keys are camelCase:
  // data-worker-url -> "workerUrl".
  const readData = (key) => (ownRoot && ownRoot.dataset && ownRoot.dataset[key]) || "";
  window.MODigestRoot = {
    el() { return ownRoot; },
    data(key) { return readData(key); },
    // Same, normalized for use as a fetch base (no trailing slash).
    url(key) { return readData(key).replace(/\/$/, ""); },
  };

  if (!ownRoot) return;
  if (existing && existing !== ownRoot) {
    existing.id = `__non_digest_root_${Math.random().toString(36).slice(2)}`;
  }
  ownRoot.id = MOUNT_ID;
})();
