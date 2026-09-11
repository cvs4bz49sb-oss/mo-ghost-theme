/* fr-noblob.js — OWNER RULING (09-10): nothing in the MereO port goes to
 * Vercel Blob. Data on R2 still carries Blob URLs (img_base, scan strips)
 * from the Vercel era; this shim rebases them onto the library worker at
 * the data boundary, using the same host map as Ian's faith-reader.js
 * rebaseOnLibrary. The worker pulls any missing scan through from Blob
 * server-side and keeps it, so the CLIENT never touches Blob.
 * Loaded first in <head> on every ported page (before fr-esv.js, which
 * also wraps fetch — the two compose).
 * Streaming responses (ask NDJSON/SSE) are never buffered: only GET
 * responses whose content-type is plain JSON are rewritten. */
(function () {
  var LIB = "https://mo-tfr-library.mo-podcast-feed.workers.dev";
  var MAP = [
    // The Latin Library — same path on the worker.
    ["https://0ss8v4l06kodnhp0.public.blob.vercel-storage.com", LIB],
    // Migne's columns, Patrologia Graeca.
    ["https://xmw4yslyv6oq3m7i.public.blob.vercel-storage.com", LIB + "/pg/scan"],
    // The facsimile strip, Patrologia Orientalis.
    ["https://fqzfe6cpzqk0a5qv.public.blob.vercel-storage.com", LIB + "/po/scan"],
  ];
  function swap(s) {
    for (var i = 0; i < MAP.length; i++)
      if (s.indexOf(MAP[i][0]) >= 0) s = s.split(MAP[i][0]).join(MAP[i][1]);
    return s;
  }
  var OF = window.fetch;
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    // a direct Blob request (stale cached data, missed code path) is
    // rebased before it leaves the page
    var swapped = swap(url);
    if (swapped !== url) {
      input = typeof input === "string" ? swapped : new Request(swapped, input);
      url = swapped;
    }
    var method = (init && init.method) || (input && input.method) || "GET";
    return OF.call(window, input, init).then(function (r) {
      if (String(method).toUpperCase() !== "GET") return r;
      var ct = (r.headers && r.headers.get("content-type")) || "";
      if (!/\bjson\b/i.test(ct) || /ndjson|event-stream/i.test(ct)) return r;
      if (!/mo-podcast-feed\.workers\.dev|^\//.test(url) &&
          url.indexOf(location.origin) !== 0) return r;
      var probe = r.clone();
      return probe.text().then(function (t) {
        var out = swap(t);
        if (out === t) return r;
        return new Response(out, {
          status: r.status, statusText: r.statusText, headers: r.headers,
        });
      }, function () { return r; });
    });
  };
})();
