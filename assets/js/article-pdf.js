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
      // Stop, but do not navigate. feature-gate.js runs on the capture
      // phase and shows the Members Only modal before this handler is
      // reached, so in practice we never get here. When we do — gate
      // script failed to load, sessionStorage threw in private mode —
      // silently throwing the reader off the essay to /membership/ is
      // the worst available outcome, and was how this bug presented.
      e.preventDefault();
      return;
    }
    // Intercept the default navigation while we mint a signed URL.
    e.preventDefault();
    link.classList.add("is-loading");
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
        // Validate the URL the worker returned. Strict check: must
        // be an HTTPS URL on the mo-pdf worker host. If the worker
        // is ever compromised, we don't want it returning
        // javascript:/data:/mailto: or a URL pointing somewhere
        // else and us navigating to it.
        const safeUrl = (function validatePdfSignUrl(raw) {
          if (typeof raw !== "string" || !raw) return null;
          try {
            const u = new URL(raw);
            if (u.protocol !== "https:") return null;
            const expected = new URL(PDF_WORKER_BASE);
            if (u.host !== expected.host) return null;
            return u.toString();
          } catch (_) { return null; }
        })(data.url);
        if (!safeUrl) throw new Error("sign returned unsafe or off-host url");
        // Record the download the same way audio and gifting do, so PDFs
        // appear alongside the other features rather than being the one
        // people use invisibly. Fired after signing succeeds, so a failed
        // request is not counted as a download.
        if (window.__kitEmit) {
          try {
            window.__kitEmit("pdf_downloaded", {
              postId,
              postTags: (document.body.getAttribute("data-post-tags") || "")
                .split(",").map((t) => t.trim()).filter(Boolean)
            });
          } catch (_) { /* never let counting break the download */ }
        }
        // Navigate directly via window.location.href rather than
        // programmatic link.click(). Programmatic clicks from async
        // promise chains can lose "transient user activation" in
        // some browsers (especially Safari/iOS), silently failing
        // to trigger navigation. Direct location assignment doesn't
        // need the user-gesture context.
        //
        // Cross-origin <a download> is ignored per HTML spec, so
        // the download attribute on the original link would never
        // have forced a save dialog anyway. The worker returns
        // Content-Disposition: inline + correct content-type, so
        // the browser opens the PDF in its native viewer. Browser's
        // built-in save button works from there.
        //
        // This also eliminates the click-recursion bug that Codex
        // pass-2 caught in the link.click() version (and the
        // bypass-flag workaround it required).
        //
        // eslint-disable-next-line no-restricted-syntax -- safeUrl already host-validated against PDF_WORKER_BASE above; MOSafeHref.sanitize would be looser (allows other schemes)
        window.location.href = safeUrl;
      })
      .catch((err) => {
        console.error("pdf sign failed", err);
        link.classList.remove("is-loading");
        link.style.pointerEvents = "";
      });
  });

  function hasPaidAccess() {
    const status = document.body.getAttribute("data-member-status") || "";
    return status === "paid" || status === "comped";
  }
})();
