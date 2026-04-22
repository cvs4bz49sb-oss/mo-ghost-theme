/*
 * /dashboard/ebooks/ — token rewriting.
 *
 * For each link marked data-requires-token, ask mo-ebook-access to
 * mint a short-lived HMAC token, then rewrite the link's href so a
 * click lands on the ebook's /api/ghost-verify endpoint (which sets
 * the sf_access cookie and redirects to /).
 *
 * If the worker URL isn't configured, or the mint call fails, the
 * link is left alone — user falls through to the ebook's existing
 * HubSpot-list email gate. No ebook goes offline on failure.
 */
(function () {
  var root = document.querySelector("[data-ebooks]");
  if (!root) return;

  var email = (root.getAttribute("data-member-email") || "").trim();
  var workerUrl = (root.getAttribute("data-worker-url") || "").trim().replace(/\/$/, "");
  if (!email || !workerUrl) return;

  var gated = root.querySelectorAll("a[data-ebook-link][data-requires-token='true']");
  if (!gated.length) return;

  var mintPromise = fetch(workerUrl + "/mint", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email }),
  })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) { return (data && data.token) || null; })
    .catch(function () { return null; });

  mintPromise.then(function (token) {
    if (!token) return;
    gated.forEach(function (a) {
      try {
        var base = a.getAttribute("href");
        var verifyPath = a.getAttribute("data-verify-path") || "/api/ghost-verify";
        var u = new URL(verifyPath, base);
        u.searchParams.set("t", token);
        a.setAttribute("href", u.toString());
      } catch (_) {
        // Leave original href in place on any URL parse failure.
      }
    });
  });
})();
