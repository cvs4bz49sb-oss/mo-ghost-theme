/*
 * Event replay gate. partials/event-post.hbs loads it on #event posts.
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

  const content = article.querySelector("[data-event-content], .article-content");
  if (!content) return;

  /* ---- check member status ----------------------------------------- */
  const status = (document.body.getAttribute("data-member-status") || "anonymous").toLowerCase();
  if (status === "paid" || status === "comped" || status === "gift") {
    /* The hero's "Watch the replay" button jumps to #replay. */
    const first = content.querySelector('iframe[src*="youtube"], iframe[src*="youtu.be"], iframe[src*="vimeo"]');
    if (first) (first.closest(".kg-embed-card, .kg-card") || first).id = "replay";
    return;
  }

  /* ---- find and replace replay iframes ----------------------------- */
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

    const heading = document.createElement("h3");
    const em = document.createElement("em");
    em.textContent = "Replay is for Members only";
    heading.appendChild(em);

    const body = document.createElement("p");
    body.textContent = "Join Mere Orthodoxy to watch this forum and every past one.";

    const ctas = document.createElement("div");
    ctas.className = "inline-support-ctas";

    const btn = document.createElement("a");
    btn.href = "/membership/";
    btn.className = "btn btn-solid btn-primary";
    btn.textContent = "Become a Member";
    ctas.appendChild(btn);

    div.appendChild(heading);
    div.appendChild(body);
    div.appendChild(ctas);

    if (status === "anonymous") {
      const signin = document.createElement("p");
      signin.className = "event-replay-signin";
      signin.appendChild(document.createTextNode("Already a member? "));
      const a = document.createElement("a");
      a.href = "#/portal/signin";
      a.setAttribute("data-portal", "signin");
      a.textContent = "Sign in";
      signin.appendChild(a);
      div.appendChild(signin);
    }

    return div;
  }
})();
