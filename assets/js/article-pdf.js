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
        if (!data || !data.url) throw new Error("sign returned no url");
        link.setAttribute("href", data.url);
        if (slug) link.setAttribute("download", `${slug}.pdf`);
        link.textContent = prevText;
        link.style.pointerEvents = "";
        // Browser navigates to the signed URL via .click() — this
        // works because the link now has the signed href + download
        // attribute. Letting the browser handle it gets us
        // Content-Disposition: inline + the pretty filename.
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
