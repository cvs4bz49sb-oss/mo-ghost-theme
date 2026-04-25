/*
 * Article gift-link button.
 *
 * Click flow:
 *   1. Mint a signed token via the mo-gift Worker.
 *   2. Show a toast with a "Copy link" button. Tapping that button is a
 *      fresh user gesture — the clipboard write is guaranteed to land.
 *
 * Why not auto-copy after the fetch resolves? Browsers (Safari + most
 * mobile) require clipboard writes inside an active user-gesture
 * context. By the time the fetch promise settles, that context is
 * gone, so navigator.clipboard.writeText silently rejects and we get
 * an "ugly link" fallback. Splitting into "mint, then user taps Copy"
 * keeps the gesture chain intact for the actual write.
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
    if (!email) return;
    btn.disabled = true;
    showToast({ message: "Generating gift link\u2026" });
    fetch(workerUrl + "/mint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, postId: postId }),
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.token) { showToast({ message: "Gift link unavailable. Try again." }); return; }
        var u;
        try {
          u = new URL(postUrl);
          u.searchParams.set("gift", data.token);
        } catch (_) {
          showToast({ message: "Couldn't build gift link." });
          return;
        }
        showToast({ message: "Gift link ready.", actionLabel: "Copy link", url: u.toString() });
        // Fire-and-forget Kit tag: who's actively sharing.
        if (window.__kitEmit) window.__kitEmit("gifted_article", { postId: postId });
      })
      .catch(function () { showToast({ message: "Gift link unavailable. Try again." }); })
      .then(function () { btn.disabled = false; });
  });

  // copySync runs inside the action-button's click handler so the
  // user-gesture context is fresh. Prefers execCommand (synchronous
  // and reliable post-async-chain); falls back to navigator.clipboard
  // for browsers that have removed execCommand.
  function copySync(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (_) { ok = false; }
    document.body.removeChild(ta);
    if (ok) return Promise.resolve();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return Promise.reject(new Error("copy unavailable"));
  }

  // Single toast, reused across states. opts:
  //   message       — required; the leading text
  //   actionLabel   — optional; renders an inline button
  //   url           — required when actionLabel is set; gets copied on tap
  //   ttl           — auto-dismiss in ms; defaults to 3500 (no action) or
  //                   stays open until copied for action toasts.
  function showToast(opts) {
    var host = document.querySelector(".gift-toast");
    if (!host) {
      host = document.createElement("div");
      host.className = "gift-toast";
      host.setAttribute("role", "status");
      host.setAttribute("aria-live", "polite");
      document.body.appendChild(host);
    }
    host.innerHTML = "";
    var msg = document.createElement("span");
    msg.className = "gift-toast-msg";
    msg.textContent = opts.message;
    host.appendChild(msg);

    if (opts.actionLabel && opts.url) {
      var action = document.createElement("button");
      action.type = "button";
      action.className = "gift-toast-action";
      action.textContent = opts.actionLabel;
      action.addEventListener("click", function () {
        copySync(opts.url)
          .then(function () {
            msg.textContent = "Copied! Share it with anyone.";
            action.remove();
            scheduleHide(host, 2500);
          })
          .catch(function () {
            // Last-ditch: surface the URL in a selectable input so
            // the user can copy it themselves. Better than failing
            // silently, less ugly than dumping it inline.
            host.innerHTML = "";
            var label = document.createElement("span");
            label.className = "gift-toast-msg";
            label.textContent = "Select and copy:";
            var field = document.createElement("input");
            field.type = "text";
            field.readOnly = true;
            field.value = opts.url;
            field.className = "gift-toast-field";
            field.addEventListener("focus", function () { field.select(); });
            host.appendChild(label);
            host.appendChild(field);
            field.focus();
            scheduleHide(host, 9000);
          });
      });
      host.appendChild(action);
    }

    host.classList.add("is-visible");
    if (!opts.actionLabel) scheduleHide(host, opts.ttl || 3500);
  }

  function scheduleHide(host, ttl) {
    clearTimeout(host._hideT);
    host._hideT = setTimeout(function () { host.classList.remove("is-visible"); }, ttl);
  }
})();
