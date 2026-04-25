/*
 * Article gift-link button.
 *
 * Click flow: mint a signed token via mo-gift Worker, copy the
 * article URL with ?gift=TOKEN to the clipboard, flash a toast.
 *
 * The button is always wired up on any post where it renders. The
 * earlier "only show on past-gate posts" guard hid it during the
 * first gate_days of a post's life — exactly when members are most
 * likely to share — so we removed it. Gift tokens are no-ops while
 * a post is freely readable and useful once it isn't, so showing
 * the button universally costs nothing.
 */
(function () {
  var btn = document.querySelector("[data-article-gift]");
  if (!btn) return;

  var workerUrl = (btn.getAttribute("data-worker-url") || "").trim().replace(/\/$/, "");
  var email = (btn.getAttribute("data-member-email") || "").trim();
  var postId = (btn.getAttribute("data-post-id") || "").trim();
  var postUrl = (btn.getAttribute("data-post-url") || "").trim();
  // Hide only on genuine config errors. An empty email means the
  // visitor isn't signed in — feature-gate.js intercepts the click
  // and prompts them to subscribe, so the button must stay visible.
  if (!workerUrl || !postId || !postUrl) {
    btn.setAttribute("hidden", "");
    return;
  }

  btn.addEventListener("click", function () {
    if (btn.disabled) return;
    // Defense in depth: feature-gate should have caught an empty
    // email before this handler fires, but if somehow not, bail
    // quietly instead of making a fetch with no auth identity.
    if (!email) return;
    btn.disabled = true;
    fetch(workerUrl + "/mint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, postId: postId }),
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.token) { toast("Gift link unavailable. Try again."); return; }
        var u;
        try {
          u = new URL(postUrl);
          u.searchParams.set("gift", data.token);
        } catch (_) {
          toast("Couldn't build gift link.");
          return;
        }
        copyText(u.toString())
          .then(function () { toast("Gift link copied — share it with anyone."); })
          .catch(function () { toast("Link: " + u.toString(), 8000); });
        // Tag the gifter in Kit so the audience team can segment
        // who's actively sharing. mo-kit handles the enqueue; this
        // is fire-and-forget.
        if (window.__kitEmit) window.__kitEmit("gifted_article", { postId: postId });
      })
      .catch(function () { toast("Gift link unavailable. Try again."); })
      .then(function () { btn.disabled = false; });
  });

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand("copy");
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error("copy failed"));
      } catch (e) { reject(e); }
    });
  }

  function toast(msg, ttl) {
    var host = document.querySelector(".gift-toast");
    if (!host) {
      host = document.createElement("div");
      host.className = "gift-toast";
      host.setAttribute("role", "status");
      host.setAttribute("aria-live", "polite");
      document.body.appendChild(host);
    }
    host.textContent = msg;
    host.classList.add("is-visible");
    clearTimeout(host._hideT);
    host._hideT = setTimeout(function () { host.classList.remove("is-visible"); }, ttl || 3500);
  }
})();
