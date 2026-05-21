/*
 * Event replay gate — post.hbs loads this on every post page; it
 * bails immediately if the post is not tagged #event.
 *
 * For #event posts:
 *   - paid / comped members → no-op; replay plays normally.
 *   - free subscribers and anonymous visitors → every YouTube / Vimeo
 *     iframe inside .article-content is replaced with a membership CTA.
 *     The whole Ghost embed card (.kg-embed-card / .kg-card) is swapped
 *     out, not just the bare iframe.
 *
 * Member status comes from body[data-member-status], written by
 * default.hbs for signed-in users. Missing attribute = anonymous.
 *
 * No new CSS is required — the gate reuses .inline-support and
 * .inline-support-ctas which are already in screen.css.
 *
 * Security: gate content is built entirely via DOM construction;
 * no user-supplied data is inserted.
 */
(function () {
  /* ---- bail early if not an event post ----------------------------- */
  const article = document.querySelector("article[data-event-post]");
  if (!article) return;

  /* ---- check member status ----------------------------------------- */
  const status = (document.body.getAttribute("data-member-status") || "anonymous").toLowerCase();
  if (status === "paid" || status === "comped") return;

  /* ---- find and replace replay iframes ----------------------------- */
  const content = article.querySelector(".article-content");
  if (!content) return;

  for (const iframe of content.querySelectorAll("iframe")) {
    const src = iframe.getAttribute("src") || "";
    if (!/youtube\.com|youtu\.be|vimeo\.com/i.test(src)) continue;
    /* Replace the whole Ghost embed card if available, else the iframe. */
    const target = iframe.closest(".kg-embed-card, .kg-card") || iframe;
    target.parentNode.replaceChild(buildGate(), target);
  }

  /* ------------------------------------------------------------------ */
  function buildGate() {
    const div = document.createElement("div");
    div.className = "inline-support event-replay-gate";
    div.setAttribute("data-event-replay-gate", "");

    const eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = "Members Only";

    const heading = document.createElement("h3");
    const em = document.createElement("em");
    em.textContent = "Watch the Replay";
    heading.appendChild(em);

    const body = document.createElement("p");
    body.textContent = "This recording is available to Mere Orthodoxy members. Join to watch this replay and access every past forum.";

    const ctas = document.createElement("div");
    ctas.className = "inline-support-ctas";

    const btn = document.createElement("a");
    btn.href = "/membership/";
    btn.className = "btn btn-primary";
    btn.textContent = "Become a Member";
    ctas.appendChild(btn);

    div.appendChild(eyebrow);
    div.appendChild(heading);
    div.appendChild(body);
    div.appendChild(ctas);

    return div;
  }
})();
