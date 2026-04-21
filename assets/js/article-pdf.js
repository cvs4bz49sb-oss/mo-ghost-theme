/*
 * Article "Download PDF" button.
 *
 * Rendered server-side on every post (see post.hbs). Click is
 * gated to paid access — non-paid visitors navigate to
 * /membership/ instead. Paid visitors get routed to the mo-pdf
 * worker's /{id}.pdf endpoint, which generates or serves the
 * cached PDF and the browser downloads it via the `download`
 * attribute.
 *
 * The mo-pdf worker URL is hardcoded here because the theme
 * @custom settings are at the 20-setting cap. To move accounts,
 * edit PDF_WORKER_BASE below.
 */
(function () {
  var PDF_WORKER_BASE = "https://mo-pdf.mo-podcast-feed.workers.dev";

  var link = document.querySelector("[data-article-pdf]");
  if (!link) return;
  var postId = link.getAttribute("data-post-id") || "";
  var slug = link.getAttribute("data-post-slug") || "";
  if (!postId) return;

  link.addEventListener("click", function (e) {
    if (!hasPaidAccess()) {
      e.preventDefault();
      window.location.href = "/membership/";
      return;
    }
    var href = PDF_WORKER_BASE.replace(/\/$/, "") + "/" + postId + ".pdf";
    link.setAttribute("href", href);
    if (slug) link.setAttribute("download", slug + ".pdf");
    // Letting the browser handle the navigation; the worker returns
    // a Content-Disposition: inline header, so combined with the
    // `download` attribute the browser saves with the pretty name.
  });

  function hasPaidAccess() {
    var b = document.body;
    var status = b.getAttribute("data-member-status") || "";
    if (status === "paid" || status === "comped") return true;
    var email = (b.getAttribute("data-member-email") || "").toLowerCase();
    var preview = (b.getAttribute("data-preview-email") || "").toLowerCase();
    return !!(email && preview && email === preview);
  }
})();
