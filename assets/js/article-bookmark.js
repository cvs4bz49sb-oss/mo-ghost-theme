/*
 * Article bookmark toggle.
 *
 * Renders server-side only when the reader is signed in and the
 * mo-kit worker URL is configured (see post.hbs). Click toggles
 * the bookmark state on the worker and updates the button.
 */
(function () {
  var btn = document.querySelector("[data-article-bookmark]");
  if (!btn) return;
  var body = document.body;
  var WORKER = body.getAttribute("data-kit-worker-url") || "";
  var EMAIL = body.getAttribute("data-member-email") || "";
  var postId = btn.getAttribute("data-post-id") || "";
  if (!postId) return;

  var base = WORKER.replace(/\/$/, "");
  var label = btn.querySelector(".article-bookmark-label");
  var state = { bookmarked: false, busy: false };

  // Non-paid click handler: redirect to the membership page. No
  // pre-fetch of current state since we can't save bookmarks for them.
  if (!hasPaidAccess()) {
    btn.addEventListener("click", function () {
      window.location.href = "/membership/";
    });
    return;
  }

  if (!WORKER || !EMAIL) return;

  fetch(base + "/bookmarks?email=" + encodeURIComponent(EMAIL) + "&ids_only=1", {
    method: "GET", mode: "cors", credentials: "omit",
  })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      var ids = (data && data.postIds) || [];
      setState(ids.indexOf(postId) !== -1);
    })
    .catch(function () { /* silent; button starts unbookmarked */ });

  btn.addEventListener("click", function () {
    if (state.busy) return;
    state.busy = true;
    var endpoint = state.bookmarked ? "/bookmarks/remove" : "/bookmarks/add";
    var optimistic = !state.bookmarked;
    setState(optimistic);
    fetch(base + endpoint, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: EMAIL, postId: postId }),
    })
      .then(function (r) { if (!r.ok) throw new Error("worker " + r.status); })
      .catch(function () { setState(!optimistic); })
      .then(function () { state.busy = false; });
  });

  function hasPaidAccess() {
    var b = document.body;
    var status = b.getAttribute("data-member-status") || "";
    if (status === "paid" || status === "comped") return true;
    var email = (b.getAttribute("data-member-email") || "").toLowerCase();
    var preview = (b.getAttribute("data-preview-email") || "").toLowerCase();
    return !!(email && preview && email === preview);
  }

  function setState(bookmarked) {
    state.bookmarked = !!bookmarked;
    btn.classList.toggle("is-bookmarked", state.bookmarked);
    btn.setAttribute("aria-pressed", state.bookmarked ? "true" : "false");
    btn.setAttribute("aria-label", state.bookmarked ? "Remove bookmark" : "Bookmark this essay");
    if (label) label.textContent = state.bookmarked ? "Bookmarked" : "Bookmark";
  }
})();
