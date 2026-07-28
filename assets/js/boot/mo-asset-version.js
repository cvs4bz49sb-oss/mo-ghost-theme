/*
 * Cache-bust the theme's JSON data files.
 *
 * Ghost stamps every asset it emits through {{asset}} with a single
 * hash for the whole theme — js/faith-corpora.js?v=e0dfbd9e70,
 * built/screen.css?v=e0dfbd9e70 — and changes that hash on each
 * upload. Anything fetched from JS bypasses the helper and so bypasses
 * the stamp, and Ghost serves /assets/** with
 *
 *   cache-control: public, max-age=31536000
 *
 * A year. That is right for a file whose URL changes when its contents
 * do, and wrong for the ones we fetch by hand: the EEBO filter list,
 * the daily catechism, the scripture index, the prayer of the day.
 * Regenerating one of those and redeploying leaves every returning
 * reader — and every CDN edge — on the old copy indefinitely. Caught
 * when a rebuilt EEBO filter deployed clean and the site kept serving
 * the previous list.
 *
 * So expose the theme's own hash and give the JS a helper that appends
 * it. Same lifetime as the rest of the theme: the URL changes exactly
 * when a deploy happens, which is exactly when the data can change.
 *
 * The meta tag carries a full asset URL rather than a bare hash
 * because Ghost has no helper for the hash alone.
 */
(function () {
  const meta = document.querySelector('meta[name="mo-asset-version"]');
  const raw = (meta && meta.getAttribute("content")) || "";
  const m = raw.match(/[?&]v=([a-z0-9]+)/i);
  const v = m ? m[1] : "";

  window.MO_ASSET_V = v;

  // Fails open: with no hash the URL is returned untouched, which is
  // the behaviour we had before. A missing meta tag should not stop a
  // page fetching its data.
  window.moAssetUrl = function (path) {
    if (!v) return path;
    return `${path}${path.indexOf("?") >= 0 ? "&" : "?"}v=${v}`;
  };
})();
