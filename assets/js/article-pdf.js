/*
 * Article "Download PDF" button.
 *
 * Rendered server-side on every post (see post.hbs). Click is gated
 * to paid access client-side, then we POST to mo-pdf's /sign endpoint
 * (JWT-authed) to mint a short-lived signed URL, then navigate the
 * browser to that URL to download.
 *
 * The mo-pdf worker URL is hardcoded here because the theme @custom
 * settings are at the 20-setting cap. The host is in admin-auth.js's
 * BUILTIN_TRUSTED_HOSTS so MOAuth.fetch lets the bearer through.
 * Codex audit 2026-05-11 — mo-pdf's GET /:id.pdf is no longer public,
 * so the signed URL is the only way the browser gets a 200.
 */
(function () {
  const PDF_WORKER_BASE = "https://mo-pdf.mo-podcast-feed.workers.dev";

  const link = document.querySelector("[data-article-pdf]");
  if (!link) return;
  const postId = link.getAttribute("data-post-id") || "";
  const slug = link.getAttribute("data-post-slug") || "";
  if (!postId) return;

  link.addEventListener("click", (e) => {
    // Bypass on programmatic re-click — see end of this handler for
    // why. The dataset flag is consumed (deleted) on the way through
    // so the next user click re-mints a fresh signed URL (the cached
    // one expires after 4h).
    //
    // Codex audit P1 (second pass): without this bypass, link.click()
    // at the end of the then() re-enters the same handler, hits
    // preventDefault again, and mints another URL → infinite sign
    // loop, no download.
    if (link.dataset.moSigned === "1") {
      delete link.dataset.moSigned;
      return; // let the browser navigate to the signed href
    }
    if (!hasPaidAccess()) {
      e.preventDefault();
      // eslint-disable-next-line no-restricted-syntax -- same-origin path literal
      window.location.href = "/membership/";
      return;
    }
    // Intercept the default navigation while we mint a signed URL.
    e.preventDefault();
    const prevText = link.textContent || "";
    link.textContent = "Preparing…";
    link.style.pointerEvents = "none";

    window.MOAuth.fetch(`${PDF_WORKER_BASE}/sign`, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postId }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`sign failed: ${r.status}`))))
      .then((data) => {
        if (!data || typeof data.url !== "string" || !data.url) {
          throw new Error("sign returned no url");
        }
        // Validate the URL the worker returned. MOSafeHref rejects
        // javascript:/data:/file: schemes. Defense in depth — the
        // worker MUST return its own host, but if it's ever
        // compromised we don't want it returning javascript:alert(1)
        // and us setting that on link.href.
        const safeUrl = window.MOSafeHref && window.MOSafeHref.sanitize(data.url);
        if (!safeUrl) throw new Error("sign returned unsafe url");
        link.setAttribute("href", safeUrl);
        if (slug) link.setAttribute("download", `${slug}.pdf`);
        link.textContent = prevText;
        link.style.pointerEvents = "";
        // Programmatic re-click. The bypass flag at the top of this
        // handler ensures the listener short-circuits and lets the
        // browser handle the navigation natively — Content-Disposition
        // + the download attribute give the pretty filename.
        link.dataset.moSigned = "1";
        link.click();
      })
      .catch((err) => {
        console.error("pdf sign failed", err);
        link.textContent = prevText;
        link.style.pointerEvents = "";
      });
  });

  function hasPaidAccess() {
    const status = document.body.getAttribute("data-member-status") || "";
    return status === "paid" || status === "comped";
  }
})();
