/*
 * Kit engagement events.
 *
 * All events go through window.__kitEmit(type, extras). The helper
 * POSTs to the mo-kit worker's /event endpoint. No-ops when:
 *   - body[data-kit-worker-url] is empty (integration disabled)
 *   - body[data-member-email] is empty (visitor isn't signed in)
 *
 * This file wires the passive events: /membership visits, article
 * read-completed (80% scroll OR 60s dwell per post), upgrade-link
 * clicks. Other scripts (article-audio.js, a future comments hook)
 * call __kitEmit directly for their own event types.
 */
(function () {
  const {body} = document;
  const WORKER = body.getAttribute("data-kit-worker-url") || "";
  const EMAIL = body.getAttribute("data-member-email") || "";

  window.__kitEmit = function (type, extras) {
    if (!WORKER || !EMAIL || !type) return;
    const payload = {type, email: EMAIL, ...extras || {}};
    // MOAuth.fetch attaches the JWT inside its closure. Worker
    // verifies and derives identity from payload.sub.
    try {
      window.MOAuth.fetch(`${WORKER.replace(/\/$/, "")}/event`, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        keepalive: true,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => { /* best-effort */ });
    } catch (_) { /* ignore */ }
  };

  if (!WORKER || !EMAIL) return;

  // The MOAuth IIFE pre-warms the token at module init, so the
  // first __kitEmit firing during pagehide finds a hot cache.
  // No additional warm-up needed here.

  // ---- visited_membership ------------------------------------------------
  const membershipPaths = ["/membership", "/groups", "/institutions", "/gift"];
  const path = window.location.pathname.replace(/\/+$/, "");
  for (let i = 0; i < membershipPaths.length; i++) {
    if (path === membershipPaths[i] || path.indexOf(`${membershipPaths[i]}/`) === 0) {
      window.__kitEmit("visited_membership", { path });
      break;
    }
  }

  // ---- clicked_upgrade ---------------------------------------------------
  // Any outbound link to Stripe payment links, /membership, or
  // join.mereorthodoxy.com counts. We don't intercept navigation —
  // just fire the ping and let the browser go.
  document.addEventListener("click", (e) => {
    const a = e.target && e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    const href = a.getAttribute("href") || "";
    if (!/stripe\.com|join\.mereorthodoxy\.com|^\/membership\/?/.test(href)) return;
    window.__kitEmit("clicked_upgrade", { href });
  });

  // ---- read_completed ----------------------------------------------------
  // Fires once per page load when the reader has either scrolled past
  // 80% of the article OR spent 60+ seconds on the page. Only fires
  // on post pages (the <article> tag + a data-post-id on the audio
  // widget is a reliable signal we're on one).
  const article = document.querySelector(".article-content");
  const postId = (document.querySelector("[data-post-id]") || {}).getAttribute
    ? document.querySelector("[data-post-id]").getAttribute("data-post-id")
    : null;
  if (!article || !postId) return;

  const topicTags = [];
  const tagEls = document.querySelectorAll(".article-topic [data-tag-slug], .article-topic-tag[data-tag-slug]");
  for (let t = 0; t < tagEls.length; t++) {
    const slug = tagEls[t].getAttribute("data-tag-slug");
    if (slug) topicTags.push(slug);
  }

  let fired = false;
  function markRead() {
    if (fired) return;
    fired = true;
    window.__kitEmit("read_completed", {
      postId,
      postTags: topicTags,
    });
  }

  const startedAt = Date.now();
  setTimeout(() => { markRead(); }, 60 * 1000);

  function checkScroll() {
    if (fired) return;
    const rect = article.getBoundingClientRect();
    const viewBottom = window.innerHeight || document.documentElement.clientHeight;
    // How far past the top of the article has the reader scrolled?
    const scrolled = Math.max(0, viewBottom - rect.top);
    const total = article.offsetHeight;
    if (total > 0 && scrolled / total >= 0.8) markRead();
  }
  window.addEventListener("scroll", checkScroll, { passive: true });
  window.addEventListener("resize", checkScroll);
})();
