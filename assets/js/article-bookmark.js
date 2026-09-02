/*
 * Article bookmark toggle.
 *
 * Renders server-side only when the reader is signed in and the
 * mo-kit worker URL is configured (see post.hbs). Click toggles
 * the bookmark state on the worker and updates the button.
 */
(function () {
  const btn = document.querySelector("[data-article-bookmark]");
  if (!btn) return;
  const {body} = document;
  const WORKER = body.getAttribute("data-kit-worker-url") || "";
  const EMAIL = body.getAttribute("data-member-email") || "";
  const postId = btn.getAttribute("data-post-id") || "";
  if (!postId) return;

  const base = WORKER.replace(/\/$/, "");
  const label = btn.querySelector(".article-bookmark-label");
  const state = { bookmarked: false, busy: false };

  // Non-paid: bind nothing. feature-gate.js intercepts the click on the
  // capture phase and shows the Members Only modal, which explains what
  // bookmarking is and offers the upgrade in place. This used to also
  // navigate to /membership/, which raced the modal and threw the reader
  // off the essay they were reading. Same fix as article-pdf.js.
  if (!hasPaidAccess()) return;

  if (!WORKER || !EMAIL) return;

  // All mo-kit calls are now JWT-authed via MOAuth.fetch (which keeps
  // the bearer closure-private); worker derives email from payload.sub.
  window.MOAuth.fetch(`${base}/bookmarks?ids_only=1`, {
    method: "GET", mode: "cors", credentials: "omit",
  })
    .then((r) => { return r.ok ? r.json() : null; })
    .then((data) => {
      const ids = (data && data.postIds) || [];
      setState(ids.indexOf(postId) !== -1);
    })
    .catch(() => { /* silent; button starts unbookmarked */ });

  btn.addEventListener("click", () => {
    if (state.busy) return;
    state.busy = true;
    const endpoint = state.bookmarked ? "/bookmarks/remove" : "/bookmarks/add";
    const optimistic = !state.bookmarked;
    setState(optimistic);
    window.MOAuth.fetch(base + endpoint, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postId }),
    })
      .then((r) => { if (!r.ok) throw new Error(`worker ${r.status}`); })
      .catch(() => { setState(!optimistic); })
      .then(() => { state.busy = false; });
  });

  function hasPaidAccess() {
    const status = document.body.getAttribute("data-member-status") || "";
    return status === "paid" || status === "comped";
  }

  function setState(bookmarked) {
    state.bookmarked = !!bookmarked;
    btn.classList.toggle("is-bookmarked", state.bookmarked);
    btn.setAttribute("aria-pressed", state.bookmarked ? "true" : "false");
    btn.setAttribute("aria-label", state.bookmarked ? "Remove bookmark" : "Bookmark this essay");
    if (label) label.textContent = state.bookmarked ? "Bookmarked" : "Bookmark";
  }
})();
